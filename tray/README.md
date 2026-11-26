# TradeMatrixTray — TradeMatrix 桌面托盘通知程序

Tauri 2 实现的 Windows 桌面托盘程序，为 TradeMatrix 工单系统（question-feedback）服务：
用户启动本程序并登录一次后，**无需打开/登录网站**即可收到工单通知弹窗，点击弹窗用默认浏览器免登录直开工单页面。

本目录与 `client/`（主站前端）、`server/`（后端）同级但**完全独立**：独立源码、独立构建链、独立产物。
主站前端发版不影响本程序；本程序更新也不需要重编主站。两者唯一交集是同一个 git 仓库。

## 功能一览

- 托盘常驻（右键菜单：登录/退出/开机自启开关），未读工单轮询 + WebSocket 实时通知
- 账号密码 DPAPI 加密存储在 `%APPDATA%\TradeMatrixTray\auth.bin`（仅当前 Windows 账号可解）
- 点击通知卡片或左键托盘 → 默认浏览器打开对应工单页（URL 带一次性 `tray_token` 免登录）
- 开机自启

## 目录结构

```
tray/
├── Cargo.toml / Cargo.lock / main.rs / lib.rs / build.rs   Rust 工程与全部托盘业务逻辑
├── tauri.conf.json       tauri 配置（frontendDist=../ui-dist，编译期内嵌）
├── ui/                   托盘自己渲染的两个页面源码（前端工程）
│   ├── login.html        托盘登录窗（纯静态页）
│   ├── notify.html       通知画布入口
│   └── notify/           通知画布 Vue 源码（Element Plus 卡片）
├── vite.config.js        托盘 UI 独立构建配置（仅 login+notify 双入口）
├── .env                  VITE_TM_URL：tm 系统地址（编译期注入）
├── scripts/sync-exe.mjs  构建前后处理（防 exe 套娃/同步产物到 release/）
├── icons/                托盘图标与应用图标
├── gen/schemas/          tauri 生成的权限 schema（随代码提交）
├── ui-dist/              UI 构建产物（npm run build:ui 产出，不入库）
├── target/               Rust 编译缓存（不入库）
└── release/              成品分发目录（TradeMatrixTray.exe，不入库）
```

## 从零构建（新环境一次性准备）

需要安装 4 样东西，全部装完才能编 exe：

| # | 工具 | 安装方式 | 说明 |
| --- | --- | --- | --- |
| 1 | **Node.js 20+** | https://nodejs.org 常规安装 | 跑构建命令 |
| 2 | **Rust 工具链** | https://rustup.rs 下载 rustup-init 安装（stable 通道） | 自动带 cargo/rustc，编 Rust 代码 |
| 3 | **MSVC 编译工具** | 装 Visual Studio 生成工具（Build Tools），勾选「使用 C++ 的桌面开发」 | Rust 在 Windows 上的链接器后端，约几个 GB |
| 4 | **WebView2** | 无需安装 | Win10/Win11 系统内置，Tauri 用它渲染 UI |

安装 Rust/MSVC 后**重启一次终端**让 PATH 生效，然后验证：

```bash
node --version     # v20+
cargo --version    # 任意稳定版本
```

## 构建步骤

在**本目录（tray/）**执行：

```bash
npm install        # 首次拉代码后执行（装 vite/vue/element-plus/tauri-cli）
npm run build      # 一条命令完成：UI 构建 → tauri 编译 → 产物同步 release/
```

分开跑的话：

```bash
npm run build:ui   # 只编托盘 UI 页面 → ui-dist/
npm run build      # 完整构建（含 UI + Rust + NSIS 可选）
```

- 首次全量编译约 5-15 分钟（几百个 Rust 依赖从零编译），之后增量 1-2 分钟
- 成品：`release/TradeMatrixTray.exe`（单文件免安装，可直接分发）
- `npm run build` 会自动停掉正在运行的旧托盘（防文件锁），编完手动重开

## 服务器地址配置

`tray/.env` 里的 `VITE_TM_URL` 是编译期注入的 tm 系统地址（默认 `http://58.221.192.245:3333`）。
本地联调可改为 `http://127.0.0.1:5173`（需主站 dev server 在跑）。改完必须重新构建才生效。
运行时托盘会把该地址写回本地 `%APPDATA%\TradeMatrixTray\config.json`。

## 发布 exe 给用户

`release/TradeMatrixTray.exe` 需作为静态资源放到服务器 nginx 的主站 dist 目录
（`/usr/local/nginx/html/question-feedback/dist/`），用户从 TM 系统导航栏下载。
**exe 更新与主站前端发版是两个独立动作**：改主站永远不用重编 exe；改了托盘 UI/逻辑才需要。

## 排错

- 托盘没反应：浏览器访问 `http://127.0.0.1:21333/ping`，返回 `{"ok":true}` 说明进程活着；`/dbg` 可看内部日志
- 本地端口：21333（HTTP，页面推通知 + 调试）、21334（WebSocket，页面在线探测 + 登录态下发）
- 编译报 `failed to read file ...target...`：目录搬迁后旧缓存失效，删掉 `target/` 重编
- 编译报找不到 link.exe：MSVC 未装全，重装勾「使用 C++ 的桌面开发」
