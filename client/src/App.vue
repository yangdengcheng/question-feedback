<template>
  <router-view />
</template>

<script setup>
import { watch } from "vue";
import { useAuthStore } from "./stores/auth";
import { useNotificationStore } from "./stores/notification";

const authStore = useAuthStore();
const notificationStore = useNotificationStore();

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
