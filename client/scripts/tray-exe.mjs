// client 打包后：把托盘成品从 ../tray/release 拷进 dist（dist 直接可部署）
// 托盘编译在 tray 工程内独立完成；防套娃逻辑在 tray/scripts/sync-exe.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // client/
const dist = path.join(clientRoot, "dist");
const release = path.join(clientRoot, "..", "tray", "release", "TradeMatrixTray.exe");
const inDist = path.join(dist, "TradeMatrixTray.exe");

if (fs.existsSync(release)) {
  fs.copyFileSync(release, inDist);
  console.log("[tray-exe] 托盘成品已拷入 dist，dist 可直接部署");
} else {
  console.log("[tray-exe] tray/release 暂无成品，跳过（托盘构建后会自动补齐）");
}
