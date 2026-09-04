// 托盘通知画布入口：独立 Vue 小应用，内嵌 Element Plus，
// 由托盘常驻透明窗口加载，负责把待弹通知渲染成 ElNotification。
import { createApp } from "vue";
import ElementPlus from "element-plus";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
import "element-plus/dist/index.css";
import NotifyCanvas from "./NotifyCanvas.vue";

const app = createApp(NotifyCanvas);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");

// 把 .env 注入的 tm 服务器地址交给托盘 Rust 侧（登录/通知轮询/打开浏览器都用它）
const tmUrl = import.meta.env.VITE_TM_URL || "";
if (tmUrl && window.__TAURI_INTERNALS__) {
  window.__TAURI_INTERNALS__
    .invoke("configure_tm_url", { tmUrl })
    .catch(() => {});
}
