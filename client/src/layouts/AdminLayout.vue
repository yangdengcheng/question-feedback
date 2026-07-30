<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="glass-card-static border-b border-indigo-500/20 rounded-none"
    >
      <div
        class="max-w-full mx-auto px-6 h-16 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center"
          >
            <el-icon :size="18" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <span class="text-lg font-semibold text-slate-200">问题反馈中心</span>
          <el-tag size="small" type="warning" class="ml-2">管理后台</el-tag>
        </div>

        <div class="flex items-center gap-4">
          <router-link
            to="/"
            class="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            返回前台
          </router-link>
          <el-dropdown trigger="click" @command="handleCommand">
            <span
              class="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-slate-100 transition-colors"
            >
              <el-avatar :size="32" class="bg-indigo-600">
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
        class="w-56 glass-card-static rounded-none border-r border-indigo-500/20 border-t-0 border-b-0 border-l-0"
      >
        <el-menu
          :default-active="activeMenu"
          router
          background-color="transparent"
          text-color="#94a3b8"
          active-text-color="#818cf8"
          class="border-none"
        >
          <el-menu-item index="/admin/tickets">
            <el-icon><Tickets /></el-icon>
            <span>工单管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/notify-rules">
            <el-icon><Bell /></el-icon>
            <span>通知规则</span>
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
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

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
