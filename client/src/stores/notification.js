import { defineStore } from "pinia";
import { ref } from "vue";
import * as notificationApi from "../api/notifications";

export const useNotificationStore = defineStore("notification", () => {
  const unreadCount = ref(0);
  let pollingTimer = null;

  async function fetchUnreadCount() {
    try {
      const data = await notificationApi.getUnreadCount();
      unreadCount.value = data.count;
    } catch (error) { /* silent */ }
  }

  function startPolling() {
    stopPolling();
    fetchUnreadCount();
    pollingTimer = setInterval(fetchUnreadCount, 30000);
  }

  function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
  }

  return { unreadCount, fetchUnreadCount, startPolling, stopPolling };
});
