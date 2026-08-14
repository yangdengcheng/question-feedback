<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="panel border-b border-line rounded-none"
    >
      <div
        class="max-w-full mx-auto px-6 h-16 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <img :src="lyLogo" alt="林洋" class="h-8 w-auto object-contain" />
          <span class="text-lg font-semibold text-ink-text">TradeMatrix</span>
          <el-tag size="small" type="warning" class="ml-2">管理后台</el-tag>
        </div>

        <div class="flex items-center gap-4">
          <router-link
            to="/toolkit"
            class="text-sm text-ink-text-2 hover:text-ink-text transition-colors"
          >
            工具包
          </router-link>
          <router-link
            to="/"
            class="text-sm text-ink-text-2 hover:text-ink-text transition-colors"
          >
            返回前台
          </router-link>
          <ThemeToggle />
          <el-dropdown trigger="click" @command="handleCommand">
            <span
              class="flex items-center gap-2 cursor-pointer text-ink-text-2 hover:text-ink-text transition-colors"
            >
              <el-avatar :size="32" class="bg-primary text-[#1a1204] font-bold">
                {{ authStore.user?.realName?.charAt(0) || "A" }}
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
      </div>
    </header>

    <div class="flex flex-1">
      <aside
        class="w-56 panel rounded-none border-r border-line border-t-0 border-b-0 border-l-0"
      >
        <el-menu
          :default-active="activeMenu"
          router
          background-color="transparent"
          text-color="var(--text-2)"
          active-text-color="var(--accent-text)"
          class="border-none"
        >
          <el-menu-item index="/admin/tickets">
            <el-icon><Tickets /></el-icon>
            <span>工单管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/users">
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
        </el-menu>
      </aside>

      <main class="flex-1 px-8 py-8 overflow-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import lyLogo from "../assets/lylogo.png";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import ThemeToggle from "../components/ThemeToggle.vue";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeMenu = computed(() => route.path);

function handleCommand(command) {
  if (command === "logout") {
    authStore.logout();
    router.push("/login");
  }
}
</script>
