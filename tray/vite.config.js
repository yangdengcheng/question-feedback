import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 托盘 UI 独立构建：只有 login.html + notify.html 两个入口（托盘程序自己渲染的窗口）
// root=ui 使两个入口页面作为构建根，输出摊平到 ui-dist/ 根下（tauri 的 WebviewUrl::App("login.html") 要求）
// ui-dist 由 tauri.conf.json 的 frontendDist 内嵌进 exe，与主站前端（client/dist）完全隔离
export default defineConfig({
  plugins: [vue()],
  root: fileURLToPath(new URL("./ui", import.meta.url)),
  // envDir 必须显式指回 tray/ 根：Vite 默认只在 root（即 ui/）下找 .env，
  // 不指定的话 tray/.env 的 VITE_TM_URL 不会被注入，运行时 tm 地址变成空
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL("./ui-dist", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        login: fileURLToPath(new URL("./ui/login.html", import.meta.url)),
        notify: fileURLToPath(new URL("./ui/notify.html", import.meta.url)),
      },
    },
  },
});
