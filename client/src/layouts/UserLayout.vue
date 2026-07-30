<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="glass-card-static border-b border-indigo-500/20 rounded-none"
    >
      <div
        class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center"
          >
            <el-icon :size="18" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <span class="text-lg font-semibold text-slate-200">问题反馈中心</span>
        </div>

        <nav class="flex items-center gap-6">
          <router-link
            to="/"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path === '/'
                ? 'text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            工单
          </router-link>
          <router-link
            to="/notifications"
            class="text-sm transition-colors duration-200 relative"
            :class="
              $route.path === '/notifications'
                ? 'text-indigo-400'
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
                ? 'text-indigo-400'
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
            <el-avatar :size="32" class="bg-indigo-600">
              {{ authStore.user?.realName?.charAt(0) || "U" }}
            </el-avatar>
            <span class="text-sm">{{ authStore.user?.realName }}</span>
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
});

onUnmounted(() => {
  notificationStore.stopPolling();
});

function handleCommand(command) {
  if (command === "logout") {
    authStore.logout();
    notificationStore.stopPolling();
    router.push("/login");
  }
}
</script>
