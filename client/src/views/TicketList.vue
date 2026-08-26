<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-ink-text">工单列表</h1>
      <router-link to="/tickets/new">
        <button class="btn-accent">
          <el-icon class="mr-1"><Plus /></el-icon>新建工单
        </button>
      </router-link>
    </div>

    <div
      class="panel p-4 mb-6 sticky top-16 z-40"
      @mouseenter="filterHover = true"
      @mouseleave="filterHover = false"
    >
      <!-- 第一行：常显 -->
      <div class="flex items-center gap-3 flex-wrap">
        <el-input v-model="keyword" placeholder="搜索工单标题..." clearable class="w-56" @input="handleSearch" @clear="handleSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="filters.status"
          placeholder="状态"
          clearable
          size="default"
          class="w-32"
        >
          <el-option label="待处理" value="pending" />
          <el-option label="处理中" value="processing" />
          <el-option label="已解决" value="resolved" />
          <el-option label="已关闭" value="closed" />
        </el-select>
        <el-input
          v-model="filters.creator"
          placeholder="提交人"
          clearable
          class="w-32"
        />
        <el-input
          v-model="filters.assignee"
          placeholder="处理人"
          clearable
          class="w-32"
        />
        <el-select
          v-model="filters.type"
          placeholder="类型"
          clearable
          size="default"
          class="w-32"
        >
          <el-option label="Bug" value="bug" />
          <el-option label="使用问题" value="question" />
        </el-select>
        <el-select
          v-model="filters.systemCode"
          placeholder="所属系统"
          clearable
          size="default"
          class="w-52"
          :loading="systemLoading"
        >
          <el-option
            v-for="item in systemOptions"
            :key="item.id"
            :label="item.dictValue"
            :value="item.dictValue"
          />
        </el-select>
      </div>

      <!-- 第二行：悬浮卡片时展开 -->
      <div class="filter-second" :class="{ 'is-open': filterOpen }">
        <div class="flex items-center gap-3 pt-3">
          <el-select
            v-model="filters.priority"
            placeholder="优先级"
            clearable
            size="default"
            class="w-32"
            @visible-change="(v) => (priorityDropOpen = v)"
          >
            <el-option label="低" value="low" />
            <el-option label="中" value="medium" />
            <el-option label="高" value="high" />
          </el-select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-accent-text" :size="32"
        ><Loading
      /></el-icon>
    </div>

    <div v-else-if="tickets.length === 0" class="text-center py-20">
      <el-icon :size="48" class="text-ink-text-3 mb-4"><FolderOpened /></el-icon>
      <p class="text-ink-text-3 mb-2">暂无工单</p>
      <p class="text-ink-text-3 text-sm mb-6">
        遇到问题？提交一个工单让我们帮您解决
      </p>
      <router-link to="/tickets/new">
        <button class="btn-accent">新建工单</button>
      </router-link>
    </div>

    <div v-else class="space-y-4">
      <TicketCard v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" />
    </div>

    <div v-if="total > 0" class="flex justify-center mt-8">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @current-change="fetchTickets"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import { listTickets } from "../api/tickets";
import { getDictValues } from "../api/dicts";
import TicketCard from "../components/TicketCard.vue";

const tickets = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const keyword = ref("");
let searchTimer = null;
function handleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { fetchTickets(); }, 300);
}

function handleSizeChange() {
  page.value = 1;
  fetchTickets();
}

const filters = reactive({
  status: "",
  type: "",
  priority: "",
  systemCode: "",
  creator: "",
  assignee: "",
});

// 所属系统下拉选项（system_code 字典）
const systemOptions = ref([]);
const systemLoading = ref(false);
onMounted(async () => {
  systemLoading.value = true;
  try {
    systemOptions.value = await getDictValues("system_code");
  } catch (error) {
    // 拦截器已提示，下拉保持空
  } finally {
    systemLoading.value = false;
  }
});

// 筛选变化：下拉立即生效、输入框防抖 300ms 统一走这里
let filterTimer = null;
watch(filters, () => {
  page.value = 1;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => fetchTickets(), 300);
});

// ---------- 筛选面板展开交互 ----------
// 默认一行；鼠标悬浮卡片展开第二行，移开自动收起；
// 优先级下拉打开期间、或已选优先级时保持展开（避免选到一半收起/生效中的筛选看不见）
const filterHover = ref(false);
const priorityDropOpen = ref(false);
const filterOpen = computed(
  () => filterHover.value || priorityDropOpen.value || !!filters.priority,
);

let pollingTimer = null;

onMounted(() => {
  fetchTickets();
  pollingTimer = setInterval(() => fetchTickets(true), 30000);
});

onUnmounted(() => {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
});

async function fetchTickets(silent = false) {
  if (!silent) loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value, keyword: keyword.value || undefined };
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    if (filters.priority) params.priority = filters.priority;
    if (filters.systemCode) params.systemCode = filters.systemCode;
    if (filters.creator) params.creator = filters.creator.trim();
    if (filters.assignee) params.assignee = filters.assignee.trim();

    const data = await listTickets(params);
    tickets.value = data.rows;
    total.value = data.count;
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* 第二行筛选：默认收起，展开时平滑过渡 */
.filter-second {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.25s ease, opacity 0.2s ease;
}
.filter-second.is-open {
  max-height: 64px;
  opacity: 1;
}
</style>
 
