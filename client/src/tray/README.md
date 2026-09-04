# TradeMatrix 桌面托盘客户端

Tauri 2 实现的桌面托盘程序：常驻通知画布、托盘登录、开机自启、未读工单轮询、打开浏览器免登录。

## 目录结构

```
src/tray/
├── Cargo.toml / Cargo.lock   Rust 工程定义与依赖锁定
├── main.rs / lib.rs          入口与全部业务逻辑（托盘/登录/轮询/WS/HTTP）
├── build.rs                  tauri 构建脚本
├── tauri.conf.json           tauri 配置（frontendDist 指向 ../../dist，编译期内嵌）
├── icons/                    托盘图标与应用图标
├── gen/schemas/              tauri 生成的权限 schema（随代码提交）
├── login.html                托盘登录窗页面（编译期从 dist 内嵌）
├── notify.html               通知画布页面入口（同上）
├── notify/                   通知画布的 Vue 源码（Element Plus 卡片）
├── target/                   Rust 编译缓存（不入库，勿手动改）
└── release/                  成品分发目录（不入库，本地构建产出；线上用户从 TM 系统导航栏下载）
```

## 新开发环境搭建（一次性）

1. **Node.js**：常规安装即可（项目已依赖 @tauri-apps/cli）
2. **Rust 工具链**：安装 [rustup](https://rustup.rs/)，自动带 cargo 与 rustc（stable 通道）
3. **MSVC 编译工具**（仅 Windows）：安装 Visual Studio 生成工具，勾选「使用 C++ 的桌面开发」
4. **WebView2**：Win10/Win11 已内置，无需处理

## 构建

```bash
# 在 client 目录执行
npm install        # 首次拉代码后执行
npm run build:all  # 先编网页端（产出 dist），再编托盘 exe
```

也可以分开跑：

```bash
npm run build        # 只编网页端
npm run tray:build   # 只编托盘（前提：dist 已存在）
```

**为什么必须先编网页**：`tauri.conf.json` 的 `frontendDist` 是编译期内嵌——dist 里的页面（含 login.html、notify.html、主站）在编 exe 那一刻被打包进二进制。所以网页代码变更后，托盘必须重编才能用上新页面。

## 产物位置

| 产物 | 路径 |
| --- | --- |
| 原始 exe | `src/tray/target/release/tradematrix-tray.exe` |
| NSIS 安装包 | `src/tray/target/release/bundle/nsis/*.exe` |
| 分发副本 | `src/tray/release/TradeMatrixTray.exe`（不入库；发版时由部署脚本随 dist 一起上服务器作静态资源） |

首次全量编译约 5-15 分钟（从零编几百个 Rust 依赖），之后增量编译 1-2 分钟。

## 运行时行为

- **服务器地址**：编译期从 `client/.env` 的 `VITE_TM_URL` 注入页面，托盘启动后由常驻通知页写回本地 `config.json`；改地址改 `.env` 后重编
- **本地数据目录**：`%APPDATA%\TradeMatrixTray\`
  - `auth.bin`：账号密码（DPAPI 加密，仅当前 Windows 账号可解）
  - `config.json`：运行时配置（tm 服务器地址）
- **本地端口**：21333（HTTP，页面推通知 + 调试端点 /ping /dbg /notify）、21334（WebSocket，页面在线探测 + 聚焦 + 登录态下发）

## 免登录机制

托盘开浏览器（左键托盘或点通知卡片）时，URL 带一次性 `tray_token` 参数；网页在路由首次导航前同步写入 localStorage 并清掉参数，不依赖 WS 时序，深链接不丢。WS 下发登录态保留作兜底。

## 排错

- 托盘没反应：浏览器访问 `http://127.0.0.1:21333/ping`，返回 `{"ok":true}` 说明进程活着；`/dbg` 可看内部日志
- 编译报 `failed to read file ...target...`：目录搬迁后旧缓存失效，删掉 `target/` 重编
