import { defineStore } from "pinia";
import { ref } from "vue";
import router from "../router";
import * as notificationApi from "../api/notifications";
import { isTrayConnected } from "../utils/traySocket";

export const useNotificationStore = defineStore("notification", () => {
  const unreadCount = ref(0);
  let pollingTimer = null;
  let initialized = false;
  const seenIds = new Set();

  async function fetchUnreadCount() {
    try {
      const data = await notificationApi.getUnreadCount();
      const newCount = data.count;
      unreadCount.value = newCount;

      if (newCount > 0) {
        try {
          const list = await notificationApi.listNotifications({ page: 1, pageSize: 10 });
          const unreadItems = (list.rows || []).filter(n => !n.isRead);
          if (!initialized) {
            // 首次拉取：把现有未读标记为已见，避免登录时一次性弹一堆通知
            unreadItems.forEach(n => seenIds.add(n.id));
          } else {
            // 后续拉取：对未见过的新通知弹浏览器提醒
            const newItems = unreadItems.filter(n => !seenIds.has(n.id));
            for (const n of newItems.slice(0, 3)) {
              await showBrowserNotification(n);
              seenIds.add(n.id);
            }
          }
        } catch (_) { /* silent */ }
      }
      initialized = true;
    } catch (error) { /* silent */ }
  }

  // 桌面托盘程序本地通知服务：把通知推给托盘，由托盘用 Element Plus 卡片弹系统级通知。
  // 托盘在运行（WS 已连接）→ 只走托盘，不弹浏览器通知；托盘未运行 → 回退浏览器原生通知。
  async function pushToTray(notification) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch("http://127.0.0.1:21333/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        id: notification.id,
        content: notification.content,
        ticketId: notification.ticketId,
        type: notification.type,
        comment: notification.comment?.content ?? null,
        images: (notification.comment?.attachments || []).map((a) => a.filePath).filter(Boolean),
      }),
        signal: ctrl.signal,
      });
      return res.ok;
    } catch (_) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async function showBrowserNotification(notification) {
    if (isTrayConnected()) {
      await pushToTray(notification);
      return;
    }
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const n = new Notification("TradeMatrix", {
      body: notification.content,
      icon: "/favicon.ico",
      tag: `ticket-${notification.ticketId}`,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      if (notification.ticketId) {
        router.push(`/tickets/${notification.ticketId}`);
      } else {
        router.push("/notifications");
      }
      n.close();
    };
  }

  function requestPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function startPolling() {
    stopPolling();
    fetchUnreadCount();
    pollingTimer = setInterval(fetchUnreadCount, 30000);
  }

  function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
  }

  return { unreadCount, fetchUnreadCount, startPolling, stopPolling, requestPermission };
});
