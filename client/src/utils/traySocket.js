// 与桌面托盘程序的本地 WebSocket 通道
// - focus：单击托盘时让已打开的页签聚焦（不新开页签）
// - auth：托盘下发登录态，页面写入 localStorage 实现免二次登录
import { useAuthStore } from "../stores/auth";
import router from "../router";

let ws = null;
let retryTimer = null;
// 托盘断开回调：由 notification store 注册（原生通知兜底准备）
let onTrayGone = null;

export function setTrayGoneHandler(fn) {
  onTrayGone = fn;
}

function notifyTrayGone() {
  if (onTrayGone) {
    try {
      onTrayGone();
    } catch (_) {
      /* noop */
    }
  }
}

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
      } else if (type === "navigate" && msg?.path) {
        // 托盘点通知卡片：复用当前 tab 路由跳转到对应工单，不开新页签
        window.focus();
        router.push(msg.path).catch(() => {});
      } else if (type === "auth" && msg?.token && msg?.user) {
        // 托盘是登录态权威源：无条件应用，覆盖浏览器本地缓存里的旧登录态
        // （托盘中切换账号后，已打开的页面也要跟着切到新账号）
        const authStore = useAuthStore();
        const prevToken = authStore.token;
        authStore.applyExternalAuth({ token: msg.token, user: msg.user });
        const path = router.currentRoute.value.path;
        if (path === "/login" || path === "/register") {
          router.push("/");
        }
        // 账号真的变了（托盘切了用户）：页面数据还是旧账号渲染的（用户名/角色/通知列表），
        // 刷新整页让所有组件用新登录态重新加载——不刷的话要用户手动刷新才能看到切换效果
        if (prevToken && prevToken !== msg.token) {
          window.location.reload();
        }
      }
    };
    ws.onclose = () => {
      ws = null;
      // 托盘断开兜底：通知原生弹窗分支准备好（权限未授予时弹一次授权框，denied 时页面引导）
      notifyTrayGone();
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
