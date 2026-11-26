// 托盘构建前后的 exe 同步
//   pre ：编译前清理 ui-dist 里可能的旧 exe 残留（tauri 内嵌整个 frontendDist，不清理会把旧 exe 嵌进新 exe，逐代变大）
//   post：编译后停掉运行中的旧托盘（防文件锁），新成品拷到 release/ 供分发
// 与主站前端（client/dist）完全隔离：exe 上服务器供下载的动作在发版流程里单独处理，本脚本不碰 client
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const trayRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // tray/
const uiDist = path.join(trayRoot, "ui-dist");
const inUiDist = path.join(uiDist, "TradeMatrixTray.exe");
const release = path.join(trayRoot, "release", "TradeMatrixTray.exe");
const built = path.join(trayRoot, "target", "release", "tradematrix-tray.exe");

const cmd = process.argv[2];

if (cmd === "pre") {
  if (fs.existsSync(inUiDist)) {
    fs.rmSync(inUiDist);
    console.log("[tray-sync] 编译前已移除 ui-dist 中的 exe，防止内嵌套娃");
  }
} else if (cmd === "post") {
  if (fs.existsSync(built)) {
    try {
      execSync("taskkill /IM TradeMatrixTray.exe /F", { stdio: "ignore" });
    } catch (_) {
      /* 没在运行就算了 */
    }
    fs.mkdirSync(path.dirname(release), { recursive: true });
    fs.copyFileSync(built, release);
    console.log("[tray-sync] 新成品已同步到 release/（旧托盘进程已停，需要请手动重开）");
  } else {
    console.log("[tray-sync] 未找到编译产物，跳过");
  }
} else {
  console.log("[tray-sync] 用法: node scripts/sync-exe.mjs <pre|post>");
}
