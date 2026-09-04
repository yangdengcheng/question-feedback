import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import App from "./App.vue";
import router from "./router";
import { initTraySocket } from "./utils/traySocket";
import { useAuthStore } from "./stores/auth";
import "./styles/theme.css";

// 托盘免登录引导：托盘开浏览器时 URL 带一次性 tray_token 参数，
// 这里在路由首次导航前同步写入 localStorage 并清掉参数（不进历史记录），
// 保证点托盘/点通知开浏览器都免登录，深链接也不丢
(function bootstrapTrayToken() {
  try {
    const u = new URL(window.location.href);
    const t = u.searchParams.get("tray_token");
    if (!t) return;
    localStorage.setItem("token", t);
    u.searchParams.delete("tray_token");
    window.history.replaceState(null, "", u.toString());
  } catch (_) {
    /* noop */
  }
})();

const app = createApp(App);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

app.mount("#app");

// 桌面托盘通道：应用启动即连接（未登录也连，用于接收托盘下发的登录态）
initTraySocket();

// URL 引导只写了 token 没有 user 信息：补一次 fetchMe 把用户资料拉全
{
  const authStore = useAuthStore();
  if (authStore.isLoggedIn && !authStore.user) {
    authStore.fetchMe().catch(() => {});
  }
}
