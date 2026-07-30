<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-bold text-slate-200">工单看板</h1>
      <p class="text-sm text-slate-500 mt-1">{{ authStore.isInternal ? "分配给我的工单概览" : "我创建的工单概览" }}</p>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-primary" :size="32"><Loading /></el-icon>
    </div>

    <template v-else>
      <!-- 状态统计卡片 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div
          v-for="card in statCards"
          :key="card.key"
          class="panel p-5 cursor-pointer hover:border-primary/40 transition-colors"
          @click="goList"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-slate-400">{{ card.label }}</span>
            <span class="w-2.5 h-2.5 rounded-full" :class="card.dot"></span>
          </div>
          <p class="text-3xl font-bold tnum" :class="card.color">
            {{ stats.byStatus[card.key] }}
          </p>
        </div>
      </div>

      <!-- 最近工单 -->
      <div class="panel p-6">
        <h2 class="text-base font-semibold text-slate-200 mb-4">最近工单</h2>
        <div v-if="stats.recent.length === 0" class="text-center py-10">
          <p class="text-slate-500 text-sm">{{ authStore.isInternal ? "暂无分配给您的工单" : "暂无工单，去创建一个吧" }}</p>
        </div>
        <div v-else class="divide-y divide-line">
          <router-link
            v-for="t in stats.recent"
            :key="t.id"
            :to="`/tickets/${t.id}`"
            class="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <span class="text-xs text-slate-500 font-mono tnum w-36 shrink-0">{{ t.ticketNo }}</span>
            <span class="flex-1 text-sm text-slate-300 truncate">{{ t.title }}</span>
            <el-tag size="small" :type="typeTagType(t.type)">{{ typeLabel(t.type) }}</el-tag>
            <StatusBadge :status="t.status" />
            <span class="text-xs text-slate-500 tnum w-24 text-right shrink-0">{{ formatTime(t.updatedAt) }}</span>
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getTicketStats } from "../api/tickets";
import { useAuthStore } from "../stores/auth";
import StatusBadge from "../components/StatusBadge.vue";

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const stats = reactive({
  byStatus: { pending: 0, processing: 0, resolved: 0, closed: 0 },
  total: 0,
  recent: [],
});

const statCards = [
  { key: "pending", label: "待处理", color: "text-amber-400", dot: "bg-amber-400" },
  { key: "processing", label: "处理中", color: "text-st-processing", dot: "bg-st-processing" },
  { key: "resolved", label: "已解决", color: "text-green-400", dot: "bg-green-400" },
  { key: "closed", label: "已关闭", color: "text-slate-400", dot: "bg-slate-500" },
];

onMounted(() => {
  fetchStats();
});

async function fetchStats() {
  loading.value = true;
  try {
    const data = await getTicketStats();
    stats.byStatus = data.byStatus;
    stats.total = data.total;
    stats.recent = data.recent;
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

function goList() {
  router.push("/");
}

function typeLabel(type) {
  const map = { bug: "Bug", question: "使用问题" };
  return map[type] || type;
}

function typeTagType(type) {
  const map = { bug: "danger", question: "warning" };
  return map[type] || "info";
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>
