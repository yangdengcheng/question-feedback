<template>
  <el-config-provider :message="messageConfig">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { watch } from "vue";
import { useAuthStore } from "./stores/auth";
import { useNotificationStore } from "./stores/notification";

const authStore = useAuthStore();
const notificationStore = useNotificationStore();

// 全局 Message 配置：offset 76px 让提示落在 64px 导航栏下方不遮挡；
// duration 2.5s 比默认 3s 更干脆，避免长时间悬在页面上
const messageConfig = { offset: 76, duration: 2500 };

// 全局通知轮询：只要处于登录态，任何页面（含后台）都接收通知
watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      notificationStore.startPolling();
      notificationStore.requestPermission();
    } else {
      notificationStore.stopPolling();
    }
  },
  { immediate: true },
);
</script>

<style></style>
