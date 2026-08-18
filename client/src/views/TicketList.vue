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

    <div class="panel p-4 mb-6 flex items-center gap-4 flex-wrap sticky top-16 z-40">
      <el-input v-model="keyword" placeholder="搜索工单标题..." clearable class="w-64" @input="handleSearch" @clear="handleSearch">
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
        v-model="filters.priority"
        placeholder="优先级"
        clearable
        size="default"
        class="w-32"
      >
        <el-option label="低" value="low" />
        <el-option label="中" value="medium" />
        <el-option label="高" value="high" />
      </el-select>
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
import { ref, reactive, watch, onMounted, onUnmounted } from "vue";
import { listTickets } from "../api/tickets";
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
});

watch(filters, () => {
  page.value = 1;
  fetchTickets();
});

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
