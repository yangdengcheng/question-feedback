<template>
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-slate-200">通知中心</h1>
      <el-button
        v-if="notifications.length > 0"
        type="primary"
        text
        @click="handleMarkAllRead"
      >
        <el-icon class="mr-1"><Check /></el-icon>全部已读
      </el-button>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-indigo-400" :size="32"
        ><Loading
      /></el-icon>
    </div>

    <div v-else-if="notifications.length === 0" class="text-center py-20">
      <el-icon :size="48" class="text-slate-600 mb-4"><Bell /></el-icon>
      <p class="text-slate-500">暂无通知</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in notifications"
        :key="item.id"
        class="glass-card p-4 cursor-pointer flex items-start gap-4"
        :class="{ 'opacity-60': item.isRead }"
        @click="goTicket(item)"
      >
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          :class="iconBgClass(item.type)"
        >
          <el-icon :size="18" color="#fff">
            <component :is="iconName(item.type)" />
          </el-icon>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-300">{{ item.content }}</p>
          <p class="text-xs text-slate-500 mt-1">
            {{ formatTime(item.createdAt) }}
          </p>
        </div>
        <span
          v-if="!item.isRead"
          class="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2"
        ></span>
      </div>
    </div>

    <div v-if="total > pageSize" class="flex justify-center mt-8">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="fetchNotifications"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { listNotifications, markRead } from "../api/notifications";
import { useNotificationStore } from "../stores/notification";

const router = useRouter();
const notificationStore = useNotificationStore();

const notifications = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

onMounted(() => {
  fetchNotifications();
});

async function fetchNotifications() {
  loading.value = true;
  try {
    const data = await listNotifications({
      page: page.value,
      pageSize: pageSize.value,
    });
    notifications.value = data.rows;
    total.value = data.count;
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function handleMarkAllRead() {
  try {
    await markRead({ all: true });
    ElMessage.success("已全部标记为已读");
    notificationStore.fetchUnreadCount();
    fetchNotifications();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function goTicket(item) {
  if (item.ticketId) {
    router.push(`/tickets/${item.ticketId}`);
  }
}

function iconName(type) {
  const map = {
    new_ticket: "Plus",
    new_comment: "ChatDotRound",
    status_change: "Refresh",
    assigned: "User",
  };
  return map[type] || "Bell";
}

function iconBgClass(type) {
  const map = {
    new_ticket: "bg-indigo-600",
    new_comment: "bg-cyan-600",
    status_change: "bg-amber-600",
    assigned: "bg-green-600",
  };
  return map[type] || "bg-slate-600";
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>
