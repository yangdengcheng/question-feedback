import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 托盘静态页归位：源码都在 src/tray/ 下，构建后摆到 dist 根目录供托盘内嵌加载
// - notify.html 是多入口，vite 会输出到 dist/src/tray/notify.html，这里拷回 dist/notify.html
// - login.html 是纯静态页（不参与打包），直接拷到 dist/login.html
function trayPages() {
  return {
    name: "tray-pages",
    closeBundle() {
      const root = path.dirname(fileURLToPath(import.meta.url));
      const copies = [
        ["dist/src/tray/notify.html", "dist/notify.html"],
        ["src/tray/login.html", "dist/login.html"],
      ];
      for (const [from, to] of copies) {
        const f = path.join(root, from);
        const t = path.join(root, to);
        if (fs.existsSync(f)) fs.copyFileSync(f, t);
      }
    },
  };
}

export default defineConfig({
  plugins: [vue(), trayPages()],
  build: {
    // 多入口：主应用 index.html + 托盘通知画布 notify.html（内嵌 Element Plus 通知）
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        notify: fileURLToPath(new URL("./src/tray/notify.html", import.meta.url)),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:5180", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:5180", changeOrigin: true },
    },
  },
});
