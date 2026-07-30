<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="panel border-b border-line rounded-none"
    >
      <div
        class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-primary text-[#1a1204] flex items-center justify-center"
          >
            <el-icon :size="18" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <span class="text-lg font-semibold text-slate-200">问题反馈中心</span>
        </div>

        <nav class="flex items-center gap-6">
          <router-link
            to="/dashboard"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path === '/dashboard'
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            看板
          </router-link>
          <router-link
            to="/"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path === '/'
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            工单
          </router-link>
          <router-link
            to="/toolkit"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path.startsWith('/toolkit')
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            工具包
          </router-link>
          <router-link
            to="/notifications"
            class="text-sm transition-colors duration-200 relative"
            :class="
              $route.path === '/notifications'
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            通知
            <span
              v-if="notificationStore.unreadCount > 0"
              class="absolute -top-2 -right-4 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
            >
              {{
                notificationStore.unreadCount > 99
                  ? "99+"
                  : notificationStore.unreadCount
              }}
            </span>
          </router-link>
          <router-link
            v-if="authStore.isAdmin"
            to="/admin/tickets"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path.startsWith('/admin')
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            管理后台
          </router-link>
        </nav>

        <el-dropdown trigger="click" @command="handleCommand">
          <span
            class="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-slate-100 transition-colors"
          >
            <el-avatar :size="32" class="bg-primary text-[#1a1204] font-bold">
              {{ authStore.user?.realName?.charAt(0) || "U" }}
            </el-avatar>
            <span class="text-sm"><span class="w-2 h-2 rounded-full bg-green-400 inline-block mr-1"></span>{{ authStore.user?.realName }}</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <main class="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notification";

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

onMounted(() => {
  notificationStore.startPolling();
  notificationStore.requestPermission();
  window.addEventListener("beforeunload", sendOfflineBeacon);
});

onUnmounted(() => {
  notificationStore.stopPolling();
  window.removeEventListener("beforeunload", sendOfflineBeacon);
});

// 关闭页签/浏览器时主动下线（keepalive 保证请求能在页面卸载时发出）
function sendOfflineBeacon() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    fetch("/api/auth/offline", {
      method: "POST",
      keepalive: true,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (_) {
    /* 忽略：页面卸载时的尽力而为请求 */
  }
}

function handleCommand(command) {
  if (command === "logout") {
    authStore.logout();
    notificationStore.stopPolling();
    router.push("/login");
  }
}
</script>
