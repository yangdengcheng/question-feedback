<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-slate-200">我的工单</h1>
      <router-link to="/tickets/new">
        <button class="btn-gradient">
          <el-icon class="mr-1"><Plus /></el-icon>新建工单
        </button>
      </router-link>
    </div>

    <div class="glass-card-static p-4 mb-6 flex items-center gap-4 flex-wrap">
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
        <el-option label="功能建议" value="suggestion" />
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
      <el-icon class="is-loading text-indigo-400" :size="32"
        ><Loading
      /></el-icon>
    </div>

    <div v-else-if="tickets.length === 0" class="text-center py-20">
      <el-icon :size="48" class="text-slate-600 mb-4"><FolderOpened /></el-icon>
      <p class="text-slate-500 mb-2">暂无工单</p>
      <p class="text-slate-600 text-sm mb-6">
        遇到问题？提交一个工单让我们帮您解决
      </p>
      <router-link to="/tickets/new">
        <button class="btn-gradient">新建工单</button>
      </router-link>
    </div>

    <div v-else class="space-y-4">
      <TicketCard v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" />
    </div>

    <div v-if="total > pageSize" class="flex justify-center mt-8">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="fetchTickets"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from "vue";
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

const filters = reactive({
  status: "",
  type: "",
  priority: "",
});

watch(filters, () => {
  page.value = 1;
  fetchTickets();
});

onMounted(() => {
  fetchTickets();
});

async function fetchTickets() {
  loading.value = true;
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
