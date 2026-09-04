// 与桌面托盘程序的本地 WebSocket 通道
// - focus：单击托盘时让已打开的页签聚焦（不新开页签）
// - auth：托盘下发登录态，页面写入 localStorage 实现免二次登录
import { useAuthStore } from "../stores/auth";
import router from "../router";

let ws = null;
let retryTimer = null;

export function isTrayConnected() {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

// 向托盘汇报浏览器本地缓存的登录态：
// 网页退出过（localStorage 被清）→ 托盘收到 loggedIn:false 会重新下发登录态，
// 保证每次通过托盘打开 tm 都免登录
function sendAuthStatus() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "auth-status",
      loggedIn: !!localStorage.getItem("token"),
    }));
  }
}

export function initTraySocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket("ws://127.0.0.1:21334");
    ws.onopen = () => sendAuthStatus();
    ws.onmessage = (e) => {
      let msg = null;
      try {
        msg = JSON.parse(e.data);
      } catch (_) {
        msg = null;
      }
      const type = msg?.type || (e.data === "focus" ? "focus" : null);
      if (type === "focus") {
        window.focus();
        sendAuthStatus(); // 点托盘时若页面已退出登录，托盘会补发登录态
      } else if (type === "auth" && msg?.token && msg?.user) {
        const authStore = useAuthStore();
        if (authStore.token !== msg.token) {
          authStore.applyExternalAuth({ token: msg.token, user: msg.user });
        }
        const path = router.currentRoute.value.path;
        if (path === "/login" || path === "/register") {
          router.push("/");
        }
      }
    };
    ws.onclose = () => {
      ws = null;
      retryTimer = setTimeout(initTraySocket, 8000);
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch (_) {
        /* noop */
      }
    };
  } catch (_) {
    retryTimer = setTimeout(initTraySocket, 8000);
  }
}
