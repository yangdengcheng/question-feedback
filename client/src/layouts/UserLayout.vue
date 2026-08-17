<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="panel border-b border-line rounded-none sticky top-0 z-50"
    >
      <div
        class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <img :src="logo" alt="林洋" class="h-8 w-auto object-contain" />
          <BrandTitle class="text-xl text-ink-text" />
        </div>

        <nav class="flex items-center gap-6">
          <router-link
            to="/dashboard"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path === '/dashboard'
                ? 'text-accent-text'
                : 'text-ink-text-2 hover:text-ink-text'
            "
          >
            看板
          </router-link>
          <router-link
            to="/"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path === '/'
                ? 'text-accent-text'
                : 'text-ink-text-2 hover:text-ink-text'
            "
          >
            工单
          </router-link>
          <router-link
            to="/toolkit"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path.startsWith('/toolkit')
                ? 'text-accent-text'
                : 'text-ink-text-2 hover:text-ink-text'
            "
          >
            工具包
          </router-link>
          <router-link
            to="/workbench"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path === '/workbench'
                ? 'text-accent-text'
                : 'text-ink-text-2 hover:text-ink-text'
            "
          >
            工作台
          </router-link>
          <router-link
            to="/notifications"
            class="text-sm transition-colors duration-200 relative"
            :class="
              $route.path === '/notifications'
                ? 'text-accent-text'
                : 'text-ink-text-2 hover:text-ink-text'
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
            v-if="authStore.canAccessAdmin"
            to="/admin/tickets"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path.startsWith('/admin')
                ? 'text-accent-text'
                : 'text-ink-text-2 hover:text-ink-text'
            "
          >
            管理后台
          </router-link>
        </nav>

        <div class="flex items-center gap-3">
          <ThemeToggle />
          <el-dropdown trigger="click" @command="handleCommand">
            <span
              class="flex items-center gap-2 cursor-pointer text-ink-text-2 hover:text-ink-text transition-colors"
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
      </div>
    </header>

    <main class="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
import logo from "../assets/logo.png";
import BrandTitle from "../components/BrandTitle.vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notification";
import ThemeToggle from "../components/ThemeToggle.vue";

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

onMounted(() => {
  window.addEventListener("beforeunload", sendOfflineBeacon);
});

onUnmounted(() => {
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
    router.push("/login");
  }
}
</script>
