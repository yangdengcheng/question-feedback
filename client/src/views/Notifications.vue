<template>
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-ink-text">通知中心</h1>
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
      <el-icon class="is-loading text-accent-text" :size="32"
        ><Loading
      /></el-icon>
    </div>

    <div v-else-if="notifications.length === 0" class="text-center py-20">
      <el-icon :size="48" class="text-ink-text-3 mb-4"><Bell /></el-icon>
      <p class="text-ink-text-3">暂无通知</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in notifications"
        :key="item.id"
        class="panel panel-hover p-4 cursor-pointer flex items-start gap-4 relative"
        :class="{ 'ring-1 ring-accent-border': !item.isRead }"
        @click="goTicket(item)"
      >
        <span
          v-if="!item.isRead"
          class="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500"
          aria-label="未读"
        ></span>
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          :class="iconBgClass(item.type)"
        >
          <el-icon :size="18" color="#fff">
            <component :is="iconName(item.type)" />
          </el-icon>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-ink-text-2">{{ item.content }}</p>
          <p class="text-xs text-ink-text-3 mt-1">
            {{ formatTime(item.createdAt) }}
          </p>
        </div>
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
    // 拉取全部通知（含已读），已读后列表不消失，仅未读标记清除
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

async function goTicket(item) {
  // 点击查看即标记单条已读，同步刷新右上角未读角标
  if (!item.isRead) {
    try {
      await markRead({ ids: [item.id] });
      item.isRead = true;
      notificationStore.fetchUnreadCount();
    } catch (error) {
      // 标记失败不阻断跳转
    }
  }
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
    new_ticket: "bg-st-pending",
    new_comment: "bg-st-processing",
    status_change: "bg-amber-600",
    assigned: "bg-green-600",
  };
  return map[type] || "bg-ink-text-3";
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>
