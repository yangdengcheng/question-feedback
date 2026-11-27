use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    utils::config::Color,
    Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::ManagerExt;

/// 本地通知服务端口（浏览器页面推送通知 + 调试端点）
const HTTP_ADDR: &str = "127.0.0.1:21333";
/// WebSocket 端口（页面在线探测 + 聚焦指令 + 登录态下发）
const WS_ADDR: &str = "127.0.0.1:21334";
/// 通知画布窗口尺寸（逻辑像素），固定不动态调整
const NOTIFY_W: f64 = 380.0;
const NOTIFY_H: f64 = 520.0;
/// 画布距屏幕右上角的边距
const NOTIFY_MARGIN: f64 = 8.0;

// ---------------- 全局状态 ----------------

struct AppState {
    /// 已连接的已登录页面（WebSocket 写端）
    peers: Mutex<Vec<Arc<Mutex<TcpStream>>>>,
    /// 已弹过的通知 id（两个来源共用去重，先进先出）
    seen: Mutex<VecDeque<String>>,
    /// 等待通知窗口轮询取走的通知 payload
    pending: Mutex<VecDeque<serde_json::Value>>,
    /// 已完成未读基线的账号（首次直连只记基线不弹窗）
    baselined_for: Mutex<Option<String>>,
    /// 菜单项句柄（运行时改文字）
    login_item: Mutex<Option<MenuItem<tauri::Wry>>>,
    autostart_item: Mutex<Option<MenuItem<tauri::Wry>>>,
    /// 调试日志（/dbg 端点取）
    dbg: Mutex<Vec<String>>,
}

impl AppState {
    fn new() -> Self {
        AppState {
            peers: Mutex::new(Vec::new()),
            seen: Mutex::new(VecDeque::new()),
            pending: Mutex::new(VecDeque::new()),
            baselined_for: Mutex::new(None),
            login_item: Mutex::new(None),
            autostart_item: Mutex::new(None),
            dbg: Mutex::new(Vec::new()),
        }
    }
}

fn dbg_log<R: tauri::Runtime>(app: &tauri::AppHandle<R>, msg: String) {
    let state = app.state::<Arc<AppState>>();
    let mut v = state.dbg.lock().unwrap();
    v.push(msg);
    let n = v.len();
    if n > 60 {
        v.drain(0..n - 60);
    }
}

// ---------------- 运行时配置（tm 服务器地址，前端 .env 注入） ----------------

#[derive(Serialize, Deserialize, Default)]
struct RuntimeConfig {
    #[serde(default)]
    tm_url: String,
}

fn config_file() -> Option<std::path::PathBuf> {
    Some(config_dir()?.join("config.json"))
}

fn load_config() -> RuntimeConfig {
    config_file()
        .and_then(|p| std::fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn save_config(c: &RuntimeConfig) -> Result<(), String> {
    let path = config_file().ok_or_else(|| "无法定位配置目录".to_string())?;
    let json = serde_json::to_vec_pretty(c).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

/// 取 tm 服务器地址（未配置时报错）
fn tm_url() -> Result<String, String> {
    let url = load_config().tm_url;
    if url.is_empty() {
        Err("尚未配置 tm 服务器地址".to_string())
    } else {
        Ok(url)
    }
}

// ---------------- DPAPI 加密（仅当前 Windows 账号可解密） ----------------

#[repr(C)]
struct DataBlob {
    cb_data: u32,
    pb_data: *mut u8,
}

#[link(name = "crypt32")]
extern "system" {
    fn CryptProtectData(
        pdatain: *const DataBlob,
        szdatadescr: *const u16,
        poptionalentropy: *const DataBlob,
        pvreserved: *mut std::ffi::c_void,
        ppromptstruct: *mut std::ffi::c_void,
        dwflags: u32,
        pdataout: *mut DataBlob,
    ) -> i32;
    fn CryptUnprotectData(
        pdatain: *const DataBlob,
        ppszdatadescr: *mut *mut u16,
        poptionalentropy: *const DataBlob,
        pvreserved: *mut std::ffi::c_void,
        ppromptstruct: *mut std::ffi::c_void,
        dwflags: u32,
        pdataout: *mut DataBlob,
    ) -> i32;
}

extern "system" {
    fn LocalFree(hmem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn FindWindowW(classname: *const u16, windowname: *const u16) -> isize;
    fn CreateRectRgn(x1: i32, y1: i32, x2: i32, y2: i32) -> isize;
    fn CombineRgn(hrgndst: isize, hrgnsrc1: isize, hrgnsrc2: isize, mode: i32) -> i32;
    fn SetWindowRgn(hwnd: isize, hrgn: isize, bredraw: i32) -> i32;
    fn DeleteObject(h: isize) -> i32;
    // 白条问题：关闭 notify 窗口（含 WebView2 子窗口）的 DWM 非客户区渲染用
    fn DwmSetWindowAttribute(
        hwnd: isize,
        attr: u32,
        value: *const std::ffi::c_void,
        size: u32,
    ) -> i32;
    fn EnumChildWindows(
        parent: isize,
        cb: Option<unsafe extern "system" fn(isize, isize) -> i32>,
        lparam: isize,
    ) -> i32;
}

/// DWMWINDOWATTRIBUTE：DWMWA_NCRENDERING_ENABLED=1 只读；设置要用
/// DWMWA_NCRENDERING_POLICY=2，值 DWMNCRP_DISABLED=1（禁用 NC 渲染）
const DWMWA_NCRENDERING_POLICY: u32 = 2;
const DWMNCRP_DISABLED: i32 = 1;

const RGN_OR: i32 = 2;

const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x01;

fn dpapi(data: &[u8], protect: bool) -> Option<Vec<u8>> {
    unsafe {
        let in_blob = DataBlob {
            cb_data: data.len() as u32,
            pb_data: data.as_ptr() as *mut u8,
        };
        let mut out_blob = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };
        let ok = if protect {
            CryptProtectData(
                &in_blob,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            )
        } else {
            CryptUnprotectData(
                &in_blob,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            )
        };
        if ok == 0 || out_blob.pb_data.is_null() {
            return None;
        }
        let out = std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize).to_vec();
        LocalFree(out_blob.pb_data as *mut std::ffi::c_void);
        Some(out)
    }
}

// ---------------- 凭据存取 ----------------

#[derive(Serialize, Deserialize)]
struct Credentials {
    username: String,
    password: String,
    #[serde(default)]
    token: String,
    #[serde(default)]
    user: serde_json::Value,
}

fn config_dir() -> Option<std::path::PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    let dir = std::path::PathBuf::from(appdata).join("TradeMatrixTray");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// 数据目录路径（不创建）：清除数据场景用，避免清完又顺手把目录建回来
fn data_dir_no_create() -> Option<std::path::PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    Some(std::path::PathBuf::from(appdata).join("TradeMatrixTray"))
}

fn auth_file() -> Option<std::path::PathBuf> {
    Some(config_dir()?.join("auth.bin"))
}

fn save_credentials(c: &Credentials) -> Result<(), String> {
    let json = serde_json::to_vec(c).map_err(|e| e.to_string())?;
    let blob = dpapi(&json, true).ok_or_else(|| "DPAPI 加密失败".to_string())?;
    let path = auth_file().ok_or_else(|| "无法定位配置目录".to_string())?;
    std::fs::write(path, blob).map_err(|e| e.to_string())
}

fn load_credentials() -> Option<Credentials> {
    let path = auth_file()?;
    let blob = std::fs::read(path).ok()?;
    let json = dpapi(&blob, false)?;
    serde_json::from_slice(&json).ok()
}

fn clear_credentials() {
    if let Some(path) = auth_file() {
        let _ = std::fs::remove_file(path);
    }
}

// ---------------- 多账号存储（记住密码/自动登录） ----------------

/// 留存的账号条目：密码明文经 DPAPI 整体加密后落盘
#[derive(Serialize, Deserialize, Clone)]
struct AccountEntry {
    username: String,
    password: String,
    #[serde(default)]
    auto_login: bool,
}

fn accounts_file() -> Option<std::path::PathBuf> {
    Some(config_dir()?.join("accounts.bin"))
}

fn load_accounts() -> Vec<AccountEntry> {
    let Some(path) = accounts_file() else { return Vec::new() };
    let Ok(blob) = std::fs::read(path) else { return Vec::new() };
    let Some(json) = dpapi(&blob, false) else { return Vec::new() };
    serde_json::from_slice(&json).unwrap_or_default()
}

fn save_accounts(list: &[AccountEntry]) -> Result<(), String> {
    let json = serde_json::to_vec(list).map_err(|e| e.to_string())?;
    let blob = dpapi(&json, true).ok_or_else(|| "DPAPI 加密失败".to_string())?;
    let path = accounts_file().ok_or_else(|| "无法定位配置目录".to_string())?;
    std::fs::write(path, blob).map_err(|e| e.to_string())
}

/// 保证自动登录互斥：只留 username 指定的那个勾选，其余全部清掉
/// （save_username=None 时全清——编辑气泡里取消勾选的场景）
fn set_auto_login(list: &mut [AccountEntry], username: Option<&str>) {
    for a in list.iter_mut() {
        a.auto_login = username.map(|u| a.username == u).unwrap_or(false);
    }
}

/// 列出留存账号（前端快速登录/编辑用）。password 一并返回——
/// 数据整体 DPAPI 加密落盘，只有本机当前 Windows 账号能解，展示给本人无风险。
#[tauri::command]
fn list_accounts() -> Vec<serde_json::Value> {
    load_accounts()
        .into_iter()
        .map(|a| {
            serde_json::json!({
                "username": a.username,
                "password": a.password,
                "autoLogin": a.auto_login,
            })
        })
        .collect()
}

/// 新增/更新一个留存账号（登录时勾了「记住密码」调用）。
/// auto_login=true 时自动取消其他账号的勾选（互斥）。
#[tauri::command]
fn upsert_account(username: String, password: String, auto_login: bool) -> Result<(), String> {
    let mut list = load_accounts();
    list.retain(|a| a.username != username);
    list.push(AccountEntry { username, password, auto_login: false });
    if auto_login {
        let name = list.last().unwrap().username.clone();
        set_auto_login(&mut list, Some(&name));
    }
    save_accounts(&list)
}

/// 编辑气泡保存：更新账号密码 + 重设自动登录勾选（互斥逻辑在 set_auto_login）
#[tauri::command]
fn update_account(username: String, password: String, auto_login: bool) -> Result<(), String> {
    let mut list = load_accounts();
    let target = list.iter_mut().find(|a| a.username == username);
    match target {
        Some(a) => {
            a.password = password;
        }
        None => {
            list.push(AccountEntry { username: username.clone(), password, auto_login: false });
        }
    }
    set_auto_login(&mut list, if auto_login { Some(username.as_str()) } else { None });
    save_accounts(&list)
}

/// 删除一个留存账号（编辑气泡里删账号按钮用，暂未在前端暴露）
#[tauri::command]
fn remove_account(username: String) -> Result<(), String> {
    let mut list = load_accounts();
    list.retain(|a| a.username != username);
    save_accounts(&list)
}

/// 启动时自动登录：找 auto_login 的账号静默登录（凭据错/网络失败不弹窗，静默保持未登录）
fn try_auto_login(app: &tauri::AppHandle) {
    let accounts = load_accounts();
    let Some(acc) = accounts.into_iter().find(|a| a.auto_login) else { return };
    match api_login(&acc.username, &acc.password) {
        Ok((token, user)) => {
            let _ = save_credentials(&Credentials {
                username: acc.username,
                password: acc.password,
                token,
                user,
            });
            let state = app.state::<Arc<AppState>>();
            *state.baselined_for.lock().unwrap() = None;
            refresh_login_item(app);
            poll_once(app);
        }
        Err(_) => {}
    }
}

// ---------------- tm 后端 API ----------------

enum ApiErr {
    Unauthorized,
    Other(String),
}

fn api_login(username: &str, password: &str) -> Result<(String, serde_json::Value), String> {
    let base = tm_url()?;
    let body = serde_json::json!({ "username": username, "password": password });
    match ureq::post(&format!("{base}/api/auth/login")).send_json(body) {
        Ok(resp) => {
            let v: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
            let token = v
                .get("token")
                .and_then(|t| t.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "登录响应缺少 token".to_string())?;
            let user = v.get("user").cloned().unwrap_or(serde_json::json!({}));
            Ok((token, user))
        }
        Err(ureq::Error::Status(_, resp)) => {
            let msg = resp
                .into_json()
                .ok()
                .and_then(|v: serde_json::Value| {
                    v.get("message").and_then(|m| m.as_str()).map(|s| s.to_string())
                })
                .unwrap_or_else(|| "登录失败".to_string());
            Err(msg)
        }
        Err(e) => Err(e.to_string()),
    }
}

fn api_unread(token: &str) -> Result<Vec<serde_json::Value>, ApiErr> {
    let base = tm_url().map_err(ApiErr::Other)?;
    let url = format!("{base}/api/notifications?unread=true&pageSize=20");
    match ureq::get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
    {
        Ok(resp) => {
            let v: serde_json::Value = resp
                .into_json()
                .map_err(|e| ApiErr::Other(e.to_string()))?;
            Ok(v.get("rows")
                .and_then(|r| r.as_array())
                .cloned()
                .unwrap_or_default())
        }
        Err(ureq::Error::Status(401, _)) => Err(ApiErr::Unauthorized),
        Err(ureq::Error::Status(_, resp)) => {
            let msg = resp
                .into_json()
                .ok()
                .and_then(|v: serde_json::Value| {
                    v.get("message").and_then(|m| m.as_str()).map(|s| s.to_string())
                })
                .unwrap_or_else(|| "请求失败".to_string());
            Err(ApiErr::Other(msg))
        }
        Err(e) => Err(ApiErr::Other(e.to_string())),
    }
}

// ---------------- 通知队列 ----------------

/// 通知入队，等通知窗口轮询取走
fn queue_notify<R: tauri::Runtime>(app: &tauri::AppHandle<R>, payload: serde_json::Value) {
    let state = app.state::<Arc<AppState>>();
    let mut pending = state.pending.lock().unwrap();
    pending.push_back(payload);
    while pending.len() > 10 {
        pending.pop_front();
    }
}

/// 通知窗口取走全部待弹通知
#[tauri::command]
fn poll_notify(app: tauri::AppHandle) -> Vec<serde_json::Value> {
    let state = app.state::<Arc<AppState>>();
    let mut pending = state.pending.lock().unwrap();
    pending.drain(..).collect()
}

/// 页面侧调试埋点
#[tauri::command]
fn dbg_client(app: tauri::AppHandle, msg: String) {
    dbg_log(&app, format!("client: {}", msg));
}

/// 前端把 .env 里的 tm 服务器地址注入托盘（notify 页启动时调用）
#[tauri::command]
fn configure_tm_url(app: tauri::AppHandle, tm_url: String) -> Result<(), String> {
    let url = tm_url.trim().trim_end_matches('/').to_string();
    if url.is_empty() {
        return Err("tm 地址为空，请检查 client/.env 的 VITE_TM_URL".to_string());
    }
    let mut cfg = load_config();
    if cfg.tm_url != url {
        cfg.tm_url = url.clone();
        save_config(&cfg)?;
    }
    dbg_log(&app, format!("configure tm_url={url}"));
    Ok(())
}

/// 白条防护：给 notify 顶层窗口 + 全部子窗口（WebView2 渲染宿主等）关
/// DWM 非客户区渲染。上一版只关顶层白条仍在，说明画白条的是 WebView2
/// 子窗口自己的 NC 顶边（mousedown 命中卡片 → 子窗口激活切换 → 子窗口
/// NC 边框被画出来）。EnumChildWindows 逐个关，cb 里递归后代层级。
/// 注意：不要在这里子类化窗口（SetWindowLongPtrW）——跨线程换 wndproc
/// 轻则弄坏托盘事件链重则崩溃（11-26 踩坑两次）。
#[tauri::command]
fn install_nc_guard(app: tauri::AppHandle) {
    let title: Vec<u16> = "TradeMatrixNotify".encode_utf16().chain([0]).collect();
    let hwnd = unsafe { FindWindowW(std::ptr::null(), title.as_ptr()) };
    if hwnd == 0 {
        dbg_log(&app, "nc guard: window not found".to_string());
        return;
    }
    unsafe {
        let policy: i32 = DWMNCRP_DISABLED;
        let hr = DwmSetWindowAttribute(
            hwnd,
            DWMWA_NCRENDERING_POLICY,
            &policy as *const i32 as *const std::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        );
        let _ = EnumChildWindows(hwnd, Some(child_nc_cb), 0);
        dbg_log(&app, format!("nc guard top hr={hr}"));
    }
}

/// 递归关子窗口 NC 渲染
unsafe extern "system" fn child_nc_cb(h: isize, _l: isize) -> i32 {
    let policy: i32 = DWMNCRP_DISABLED;
    let _ = DwmSetWindowAttribute(
        h,
        DWMWA_NCRENDERING_POLICY,
        &policy as *const i32 as *const std::ffi::c_void,
        std::mem::size_of::<i32>() as u32,
    );
    let _ = EnumChildWindows(h, Some(child_nc_cb), 0);
    1
}

/// 点击区域裁剪：页面量出当前通知卡片的包围盒，Rust 侧把窗口点击/绘制区域
/// 设为这些矩形之并集——卡片外（透明部分）点击穿透到桌面，卡片内可交互。
/// rects 为空 → 清除区域并整窗穿透（空闲态）。
/// rects 坐标为页面 CSS 像素（视口原点左上），乘 scale 换成物理像素。
#[tauri::command]
fn set_clip_region(app: tauri::AppHandle, rects: Vec<(i32, i32, i32, i32)>) {
    let Some(w) = app.get_webview_window("notify") else {
        return;
    };
    let _ = w.set_ignore_cursor_events(rects.is_empty());
    let title: Vec<u16> = "TradeMatrixNotify".encode_utf16().chain([0]).collect();
    let hwnd = unsafe { FindWindowW(std::ptr::null(), title.as_ptr()) };
    if hwnd == 0 {
        return;
    }
    let scale = w.scale_factor().unwrap_or(1.0);
    unsafe {
        if rects.is_empty() {
            // 空闲时保留 1x1 透明像素的 region（不能用 NULL/零区域）：
            // region 归零时 DWM 会把窗口从合成树剔除，首张卡片把 region 撑起来时
            // 窗口要重新入树（重配合成资源/重传纹理），过渡瞬间闪半透明。
            // 保留 1px 让窗口永远留在合成树里，首卡只是 region 变大，无重新入树。
            let keepalive = CreateRectRgn(0, 0, 1, 1);
            if keepalive != 0 {
                SetWindowRgn(hwnd, keepalive, 0);
            }
            return;
        }
        let mut combined = 0isize;
        for (x, y, rw, rh) in rects {
            let rgn = CreateRectRgn(
                (x as f64 * scale).floor() as i32,
                (y as f64 * scale).floor() as i32,
                ((x + rw) as f64 * scale).ceil() as i32,
                ((y + rh) as f64 * scale).ceil() as i32,
            );
            if rgn == 0 {
                continue;
            }
            if combined == 0 {
                combined = rgn;
            } else {
                CombineRgn(combined, combined, rgn, RGN_OR);
                DeleteObject(rgn);
            }
        }
        if combined != 0 {
            // 成功后区域归系统所有，不能再 DeleteObject
            // bRedraw=0：不强制整窗重绘，避免首卡出现时合成切换闪烁
            SetWindowRgn(hwnd, combined, 0);
        }
    }
}

/// 已见过返回 true；否则记入并返回 false（容量 500）
fn mark_seen(state: &AppState, id: &str) -> bool {
    let mut seen = state.seen.lock().unwrap();
    if seen.iter().any(|s| s == id) {
        return true;
    }
    seen.push_back(id.to_string());
    while seen.len() > 500 {
        seen.pop_front();
    }
    false
}

fn open_in_browser(url: &str) {
    let _ = open::that(url);
}

// ---------------- Win32 唤起浏览器窗口 ----------------
// 页面侧 window.focus() 会被浏览器安全策略拦截（后台 tab 无用户激活不允许前台），
// 这里直接找浏览器顶层窗口强制前置。FFI 声明零新依赖。
// 注意：Chrome_WidgetWin_1 是 Chromium 全系通用类名，WebView2（托盘自己）也是它，
// 所以必须 EnumWindows 遍历 + 按进程名过滤，FindWindowW 只拿第一个会命中错误窗口。
#[cfg(windows)]
mod win_focus {
    #![allow(non_snake_case)]

    use std::ffi::c_void;
    use std::sync::atomic::{AtomicIsize, Ordering};

    #[link(name = "user32")]
    extern "system" {
        fn EnumWindows(lpEnumFunc: extern "system" fn(isize, *mut c_void) -> i32, lparam: *mut c_void) -> i32;
        fn GetWindowThreadProcessId(hwnd: isize, lpdwProcessId: *mut u32) -> u32;
        fn SetForegroundWindow(hwnd: isize) -> i32;
        fn IsIconic(hwnd: isize) -> i32;
        fn IsWindowVisible(hwnd: isize) -> i32;
        fn ShowWindow(hwnd: isize, nCmdShow: i32) -> i32;
        fn GetClassNameW(hwnd: isize, lpClassName: *mut u16, nMaxCount: i32) -> i32;
        fn GetWindowTextW(hwnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn BringWindowToTop(hwnd: isize) -> i32;
        fn keybd_event(bvk: u8, bscan: u8, dwflags: u32, dwextrainfo: usize);
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> isize;
        fn CloseHandle(hObject: isize) -> i32;
    }

    #[link(name = "psapi")]
    extern "system" {
        fn GetModuleBaseNameW(hProcess: isize, lpBaseAddress: *const c_void, lpBaseName: *mut u16, nSize: u32) -> u32;
    }

    const SW_RESTORE: i32 = 9;
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const VK_MENU: u8 = 0x12; // ALT 键
    const KEYEVENTF_KEYUP: u32 = 0x0002;

    static FOUND: AtomicIsize = AtomicIsize::new(0);
    /// 窗口模块调试日志（模块级共享；曾错写成函数内各自 static 导致读写两个存储、日志全空）
    static LOGS: std::sync::Mutex<Option<Vec<String>>> = std::sync::Mutex::new(None);

    fn class_name(hwnd: isize) -> String {
        let mut buf = [0u16; 256];
        let n = unsafe { GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        if n <= 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buf[..n as usize])
    }

    fn process_name(pid: u32) -> String {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h == 0 {
                return String::new();
            }
            let mut buf = [0u16; 256];
            let n = GetModuleBaseNameW(h, std::ptr::null(), buf.as_mut_ptr(), buf.len() as u32);
            CloseHandle(h);
            if n == 0 {
                return String::new();
            }
            String::from_utf16_lossy(&buf[..n as usize]).to_lowercase()
        }
    }

    /// 浏览器进程名白名单：主市占浏览器（chrome/edge/firefox）+ 常见国产
    fn is_browser_process(name: &str) -> bool {
        matches!(
            name,
            "chrome.exe" | "msedge.exe" | "firefox.exe" | "brave.exe" | "opera.exe"
                | "vivaldi.exe" | "360se.exe" | "360chrome.exe" | "qqbrowser.exe"
                | "ucbrowser.exe" | "liebao.exe" | "sogouexplorer.exe" | "2345explorer.exe"
        )
    }

    fn window_title(hwnd: isize) -> String {
        let mut buf = [0u16; 512];
        let n = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        if n <= 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buf[..n as usize])
    }

    extern "system" fn enum_cb(hwnd: isize, _lparam: *mut c_void) -> i32 {
        // 只要可见的（最小化窗口也满足 IsWindowVisible；rect 在 -32000 无妨，不做尺寸过滤）
        if unsafe { IsWindowVisible(hwnd) } == 0 {
            return 1;
        }
        let class = class_name(hwnd);
        if class != "Chrome_WidgetWin_1" && class != "MozillaWindowClass" {
            return 1;
        }
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        if pid == 0 {
            return 1;
        }
        // 排除自己（托盘内嵌 WebView2 也是 Chrome_WidgetWin_1 类）
        if std::process::id() == pid {
            return 1;
        }
        // 两条准入路径，命中任一即可：
        // ① 进程名白名单（权限够、能查到进程名时）
        // ② 窗口标题含 TM 标识（进程名查不到时的兜底——托盘是普通权限，
        //    OpenProcess 查高保护浏览器进程可能拿不到名字导致全部漏选，
        //    这正是"no browser window found"的根因）
        let title = window_title(hwnd);
        let title_hit = title.contains("TradeMatrix") || title.contains("TradeMatrix - ");
        let proc_hit = is_browser_process(&process_name(pid));
        if !proc_hit && !title_hit {
            return 1;
        }
        // 挑窗口面积最大的候选（最小化窗口 rect=-32000 面积算负数不会当选，
        // 但如果全是最小化窗口则面积全是"负"，取负得最多的=实际最大的那个也行）
        let prev = FOUND.load(Ordering::SeqCst);
        if prev == 0 || window_area(hwnd) > window_area(prev) {
            FOUND.store(hwnd, Ordering::SeqCst);
        }
        1
    }

    fn window_area(hwnd: isize) -> i64 {
        #[repr(C)]
        struct Rect {
            left: i32,
            top: i32,
            right: i32,
            bottom: i32,
        }
        extern "system" {
            fn GetWindowRect(hwnd: isize, lprect: *mut Rect) -> i32;
        }
        let mut rc = Rect { left: 0, top: 0, right: 0, bottom: 0 };
        unsafe { GetWindowRect(hwnd, &mut rc) };
        let w = (rc.right - rc.left).max(0) as i64;
        let h = (rc.bottom - rc.top).max(0) as i64;
        w * h
    }

    /// 遍历所有顶层窗口找浏览器窗口并前置（最小化先恢复）
    /// 前台锁解法：SetForegroundWindow 只允许"有用户交互的进程"抢前台，
    /// 后台进程直接调会被静默拒绝（浏览器已开 TM 页但最小化时唤不动的根因）。
    /// 标准三板斧：①最小化先 SW_RESTORE ②模拟一次 ALT 键按下抬起（系统认为
    /// 有键盘交互，解锁前台锁）③SetForegroundWindow + BringWindowToTop 双保险。
    /// dbg：把每步结果写进 /dbg 日志（唤起失败时定位卡在哪一环）。
    pub fn focus_browser_dbg(tag: &str) {
        FOUND.store(0, Ordering::SeqCst);
        unsafe { EnumWindows(enum_cb, std::ptr::null_mut()) };
        let h = FOUND.load(Ordering::SeqCst);
        if h == 0 {
            dbg_global(&format!("focus[{tag}]: no browser window found"));
            return;
        }
        unsafe {
            let iconic = IsIconic(h) != 0;
            if iconic {
                ShowWindow(h, SW_RESTORE);
            }
            // 模拟 ALT 击键解锁前台锁（对用户唯一影响：无副作用的单次按键）
            keybd_event(VK_MENU, 0, 0, 0);
            keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
            let ok = SetForegroundWindow(h);
            if ok == 0 {
                // 前台锁没解开时的兜底：BringWindowToTop 至少把窗口拉到 Z 序顶
                BringWindowToTop(h);
            }
            dbg_global(&format!(
                "focus[{tag}]: hwnd={h} iconic={iconic} setfg={ok} proc={} title={}",
                process_name_of_hwnd(h),
                window_title(h)
            ));
        }
    }

    fn process_name_of_hwnd(hwnd: isize) -> String {
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        if pid == 0 {
            return "?".to_string();
        }
        process_name(pid)
    }

    /// 全局调试日志（窗口模块没 AppHandle，写进模块级 LOGS，/dbg 请求时收编）
    fn dbg_global(msg: &str) {
        if let Ok(mut guard) = LOGS.lock() {
            guard.get_or_insert_with(Vec::new).push(format!("[win] {msg}"));
        }
    }

    /// 取走积压的窗口模块日志（/dbg 端点收编用）
    pub fn drain_logs() -> Vec<String> {
        let mut out = Vec::new();
        if let Ok(mut guard) = LOGS.lock() {
            if let Some(v) = guard.as_mut() {
                out = std::mem::take(v);
            }
        }
        out
    }

    pub fn focus_browser() {
        focus_browser_dbg("default");
    }
}

#[cfg(not(windows))]
mod win_focus {
    pub fn focus_browser() {}
    pub fn focus_browser_dbg(_tag: &str) {}
    pub fn drain_logs() -> Vec<String> {
        Vec::new()
    }
}

/// 唤起浏览器窗口（Win32 兜底，页面 window.focus 被浏览器拦截时靠它）
fn focus_browser_window() {
    win_focus::focus_browser();
}

/// 拿一个肯定有效的 token：先试保存的，过期（401）就用保存的账号密码重登并写回
fn fresh_token() -> Option<String> {
    let mut creds = load_credentials()?;
    if creds.token.is_empty() {
        return None;
    }
    let base = tm_url().ok()?;
    let probe = ureq::get(&format!("{base}/api/auth/me"))
        .set("Authorization", &format!("Bearer {}", creds.token))
        .call();
    match probe {
        Ok(_) => return Some(creds.token.clone()),
        Err(ureq::Error::Status(401, _)) => {}
        // 网络抖动不折腾，旧 token 先拿去用（页面侧 401 还有 WS 补发兏底）
        Err(_) => return Some(creds.token.clone()),
    }
    // 走到这里是 401：用保存的账号密码重登并写回
    let (token, user) = api_login(&creds.username, &creds.password).ok()?;
    creds.token = token.clone();
    creds.user = user;
    let _ = save_credentials(&creds);
    Some(token)
}

/// 开浏览器的 URL：带一次性登录态参数 tray_token，
/// 页面在路由首次导航前同步写入 localStorage 并清掉参数——不依赖 WS 时序，深链接也不丢
fn authed_url(path: &str) -> Option<String> {
    let base = tm_url().ok()?;
    match fresh_token() {
        Some(token) => Some(format!(
            "{base}{path}{}tray_token={token}",
            if path.contains('?') { "&" } else { "?" }
        )),
        None => Some(format!("{base}{path}")),
    }
}

// ---------------- 托盘直连轮询（已保存账号时） ----------------

fn poll_once(app: &tauri::AppHandle) {
    let Some(mut creds) = load_credentials() else {
        return;
    };
    if creds.token.is_empty() {
        match api_login(&creds.username, &creds.password) {
            Ok((t, u)) => {
                creds.token = t;
                creds.user = u;
                let _ = save_credentials(&creds);
            }
            Err(_) => return,
        }
    }
    let rows = match api_unread(&creds.token) {
        Ok(r) => r,
        Err(ApiErr::Unauthorized) => match api_login(&creds.username, &creds.password) {
            Ok((t, u)) => {
                creds.token = t;
                creds.user = u;
                let _ = save_credentials(&creds);
                match api_unread(&creds.token) {
                    Ok(r) => r,
                    Err(_) => return,
                }
            }
            Err(_) => return,
        },
        Err(_) => return,
    };

    let state = app.state::<Arc<AppState>>();
    let id_strs: Vec<String> = rows
        .iter()
        .filter_map(|r| r.get("id").map(|v| v.to_string()))
        .collect();

    // 换账号/重启后的首次轮询：不吞通知，正常走下方弹窗链路
    // （托盘的本职就是用户不开网站也能收到消息；积压未读也要弹，popped 限量防风暴）
    {
        let mut baseline = state.baselined_for.lock().unwrap();
        *baseline = Some(creds.username.clone());
    }

    let mut popped = 0;
    for (idx, row) in rows.iter().rev().enumerate() {
        let Some(id) = id_strs.get(rows.len() - 1 - idx) else {
            continue;
        };
        if mark_seen(&state, id) {
            continue;
        }
        if popped >= 3 {
            continue; // 超量的只记不弹
        }
        queue_notify(
            app,
            serde_json::json!({
                "id": row.get("id"),
                "content": row.get("content"),
                "ticketId": row.get("ticketId"),
                "type": row.get("type"),
                "comment": row.get("comment").and_then(|c| c.get("content")),
                "commentAuthor": row.get("comment").and_then(|c| c.get("author"))
                    .and_then(|a| a.get("realName")),
                "images": row
                    .get("comment")
                    .and_then(|c| c.get("attachments"))
                    .and_then(|a| a.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|a| a.get("filePath").and_then(|f| f.as_str()))
                            .collect::<Vec<_>>()
                    }),
            }),
        );
        popped += 1;
    }
}

fn start_poller(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(30));
        poll_once(&app);
    });
}

// ---------------- 本地通知服务（HTTP，供浏览器页面推送 + 调试） ----------------

fn find_header_end(data: &[u8]) -> Option<usize> {
    data.windows(4).position(|w| w == b"\r\n\r\n")
}

fn parse_content_length(headers: &str) -> usize {
    for line in headers.lines() {
        let mut it = line.splitn(2, ':');
        if let (Some(k), Some(v)) = (it.next(), it.next()) {
            if k.trim().eq_ignore_ascii_case("content-length") {
                return v.trim().parse().unwrap_or(0);
            }
        }
    }
    0
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let resp = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: content-type\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(resp.as_bytes());
}

fn handle_conn(mut stream: TcpStream, app: tauri::AppHandle) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let mut buf = [0u8; 8192];
    let mut data: Vec<u8> = Vec::new();

    let (headers, body) = loop {
        match stream.read(&mut buf) {
            Ok(0) => break (None, Vec::new()),
            Ok(n) => {
                data.extend_from_slice(&buf[..n]);
                if let Some(end) = find_header_end(&data) {
                    let headers = String::from_utf8_lossy(&data[..end]).to_string();
                    let need = parse_content_length(&headers);
                    let body_start = end + 4;
                    while data.len() < body_start + need {
                        match stream.read(&mut buf) {
                            Ok(0) => break,
                            Ok(m) => data.extend_from_slice(&buf[..m]),
                            Err(_) => break,
                        }
                    }
                    let body = data[body_start..(body_start + need).min(data.len())].to_vec();
                    break (Some(headers), body);
                }
                if data.len() > 200_000 {
                    break (None, Vec::new());
                }
            }
            Err(_) => break (None, Vec::new()),
        }
    };

    let Some(headers) = headers else {
        return;
    };
    let first_line = headers.lines().next().unwrap_or_default().to_string();
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let path = parts.next().unwrap_or_default();

    match (method, path) {
        ("OPTIONS", _) => respond(&mut stream, "204 No Content", ""),
        ("GET", "/ping") => respond(&mut stream, "200 OK", "{\"ok\":true}"),
        ("GET", "/dbg") => {
            let state = app.state::<Arc<AppState>>();
            // 先收编窗口模块积压的日志（focus_browser_dbg 写在全局 Vec）
            for line in win_focus::drain_logs() {
                state.dbg.lock().unwrap().push(line);
            }
            let lines: Vec<String> = state.dbg.lock().unwrap().drain(..).collect();
            let body = serde_json::to_string(&lines).unwrap_or_else(|_| "[]".to_string());
            respond(&mut stream, "200 OK", &body);
        }
        ("POST", "/notify") => {
            let state = app.state::<Arc<AppState>>();
            let payload: serde_json::Value =
                serde_json::from_slice(&body).unwrap_or_else(|_| serde_json::json!({}));
            if let Some(id) = payload.get("id").map(|v| v.to_string()) {
                if mark_seen(&state, &id) {
                    respond(&mut stream, "200 OK", "{\"ok\":true,\"dup\":true}");
                    return;
                }
            }
            queue_notify(&app, payload);
            respond(&mut stream, "200 OK", "{\"ok\":true}");
        }
        _ => respond(&mut stream, "404 Not Found", "{\"ok\":false}"),
    }
}

fn start_http_server(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let listener = match TcpListener::bind(HTTP_ADDR) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("notify server bind failed: {e}");
                return;
            }
        };
        for stream in listener.incoming() {
            if let Ok(stream) = stream {
                let app2 = app.clone();
                std::thread::spawn(move || handle_conn(stream, app2));
            }
        }
    });
}

// ---------------- WebSocket：页面在线探测 + 聚焦 + 登录态下发 ----------------

/// 构造服务端→客户端的文本帧（服务端帧不需掩码）
fn ws_text_frame(payload: &str) -> Vec<u8> {
    let bytes = payload.as_bytes();
    let len = bytes.len();
    let mut frame = vec![0x81u8];
    if len < 126 {
        frame.push(len as u8);
    } else if len < 65536 {
        frame.push(126);
        frame.push((len >> 8) as u8);
        frame.push((len & 0xff) as u8);
    } else {
        frame.push(127);
        for i in (0..8).rev() {
            frame.push(((len as u64) >> (8 * i)) as u8);
        }
    }
    frame.extend_from_slice(bytes);
    frame
}

/// 向所有已连接页面广播一条文本消息
fn broadcast_ws(app: &tauri::AppHandle, text: &str) -> bool {
    let state = app.state::<Arc<AppState>>();
    let peers = state.peers.lock().unwrap();
    let frame = ws_text_frame(text);
    let mut delivered = false;
    for peer in peers.iter() {
        if let Ok(mut sock) = peer.lock() {
            if sock.write_all(&frame).is_ok() {
                delivered = true;
            }
        }
    }
    delivered
}

/// 把托盘保存的登录态推给页面（页面写入 localStorage，免二次登录）
fn push_auth_to_pages(app: &tauri::AppHandle) {
    let Some(creds) = load_credentials() else { return };
    if creds.token.is_empty() {
        return;
    }
    let msg = serde_json::json!({
        "type": "auth",
        "token": creds.token,
        "user": creds.user,
    });
    broadcast_ws(app, &msg.to_string());
}

fn start_ws_server(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let listener = match TcpListener::bind(WS_ADDR) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("ws server bind failed: {e}");
                return;
            }
        };
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            let writer = match stream.try_clone() {
                Ok(w) => w,
                Err(_) => continue,
            };
            let app2 = app.clone();
            std::thread::spawn(move || {
                let mut ws = match tungstenite::accept(stream) {
                    Ok(ws) => ws,
                    Err(_) => return,
                };
                let writer = Arc::new(Mutex::new(writer));
                {
                    let state = app2.state::<Arc<AppState>>();
                    state.peers.lock().unwrap().push(writer.clone());
                }
                // 页面一连上就下发登录态（开机自启场景：开浏览器即已登录）
                push_auth_to_pages(&app2);
                loop {
                    match ws.read() {
                        Ok(tungstenite::Message::Text(s)) => {
                            // 页面汇报本地缓存登录态：未登录且托盘有凭据 → 下发登录态
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                                if v.get("type").and_then(|t| t.as_str()) == Some("auth-status")
                                    && v.get("loggedIn").and_then(|b| b.as_bool()) == Some(false)
                                {
                                    if let Some(creds) = load_credentials() {
                                        if !creds.token.is_empty() {
                                            let msg = serde_json::json!({
                                                "type": "auth",
                                                "token": creds.token,
                                                "user": creds.user,
                                            });
                                            let frame = ws_text_frame(&msg.to_string());
                                            if let Ok(mut sock) = writer.lock() {
                                                let _ = sock.write_all(&frame);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Ok(_) => {}
                        Err(_) => break,
                    }
                }
                let state = app2.state::<Arc<AppState>>();
                state
                    .peers
                    .lock()
                    .unwrap()
                    .retain(|p| !Arc::ptr_eq(p, &writer));
            });
        }
    });
}

/// 左键托盘：已有 TM 页面连着（WS peers 非空）→ 广播 focus 唤起已有窗口（不新开 tab）；
/// 一个页面都没连 → 用默认浏览器打开 TM 系统（新开的页面会通过 WS 连上托盘，托盘下发登录态免登录）
/// 上次「开浏览器」时刻：冷却期内连点不再重复开 tab。
/// 场景：首次点击后浏览器要花 1-3 秒才连上 WS（peers 仍为空），
/// 期间再点会被误判为「没打开过」又开一个 tab。
static LAST_OPEN: Mutex<Option<Instant>> = Mutex::new(None);
const OPEN_COOLDOWN: Duration = Duration::from_secs(5);

fn focus_or_open(app: &tauri::AppHandle) {
    let state = app.state::<Arc<AppState>>();
    let has_peers = {
        let peers = state.peers.lock().unwrap();
        !peers.is_empty()
    };
    if has_peers {
        broadcast_ws(app, "{\"type\":\"focus\"}");
        win_focus::focus_browser_dbg("tray-click");
        return;
    }
    {
        let mut last = LAST_OPEN.lock().unwrap();
        if let Some(t) = *last {
            if t.elapsed() < OPEN_COOLDOWN {
                // 冷却期内：刚开过浏览器，大概率还在启动中，只尝试唤起不再开新 tab
                win_focus::focus_browser_dbg("tray-click-cooldown");
                return;
            }
        }
        *last = Some(Instant::now());
    }
    if let Some(url) = authed_url("/") {
        open_in_browser(&url);
    }
}

// ---------------- 菜单文字维护 ----------------

fn refresh_login_item(app: &tauri::AppHandle) {
    let state = app.state::<Arc<AppState>>();
    let item = state.login_item.lock().unwrap().clone();
    let Some(item) = item else { return };
    let text = match load_credentials() {
        Some(c) => format!("已登录：{}（点击切换）", c.username),
        None => "账号登录...".to_string(),
    };
    let _ = item.set_text(text);
}

fn refresh_autostart_item(app: &tauri::AppHandle) {
    let state = app.state::<Arc<AppState>>();
    let item = state.autostart_item.lock().unwrap().clone();
    let Some(item) = item else { return };
    let on = app.autolaunch().is_enabled().unwrap_or(false);
    let _ = item.set_text(if on { "开机自启 ✓" } else { "开机自启" });
}

// ---------------- 登录窗口 ----------------

fn show_login_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("login") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "login", WebviewUrl::App("login.html".into()))
        .title("TradeMatrix 账号登录")
        .inner_size(400.0, 340.0)
        .resizable(false)
        .maximizable(false)
        .center()
        .build();
}

// ---------------- 前端命令 ----------------

/// 点通知卡片：已有 TM 页面连着 → WS 下发 navigate 让页面路由跳转到对应工单（复用 tab）+ 唤起浏览器窗口；
/// 没有页面 → 用默认浏览器打开工单 URL（新页面 WS 连上后由托盘下发登录态免登录）
/// 打开/跳转前都先下发托盘登录态对齐页面身份（弹窗轮询是托盘账号，页面账号错配会 404 转圈）
#[tauri::command]
fn open_ticket(app: tauri::AppHandle, ticket: serde_json::Value) {
    let id = match &ticket {
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_string()),
        _ => None,
    };
    let path = match id {
        Some(id) => format!("/tickets/{id}"),
        None => "/".to_string(),
    };
    push_auth_to_pages(&app);
    let state = app.state::<Arc<AppState>>();
    let has_peers = {
        let peers = state.peers.lock().unwrap();
        !peers.is_empty()
    };
    if has_peers {
        let msg = serde_json::json!({
            "type": "navigate",
            "path": path,
        });
        broadcast_ws(&app, &msg.to_string());
        win_focus::focus_browser_dbg("ticket-navigate");
        return;
    }
    {
        // 冷却期内连点不再重复开 tab（浏览器启动中 WS 还没连上，会被误判为没打开过）
        let mut last = LAST_OPEN.lock().unwrap();
        if let Some(t) = *last {
            if t.elapsed() < OPEN_COOLDOWN {
                focus_browser_window();
                return;
            }
        }
        *last = Some(Instant::now());
    }
    if let Some(url) = authed_url(&path) {
        open_in_browser(&url);
    }
}

/// 登录窗口提交：验证账号密码并加密保存
/// remember=true → 账号留存到快速登录列表；auto_login=true → 设为自动登录账号（互斥）
#[tauri::command]
fn try_login(
    app: tauri::AppHandle,
    username: String,
    password: String,
    remember: bool,
    auto_login: bool,
) -> Result<(), String> {
    let (token, user) = api_login(&username, &password)?;
    save_credentials(&Credentials {
        username: username.clone(),
        password: password.clone(),
        token,
        user,
    })?;
    if remember {
        let _ = upsert_account(username, password, auto_login);
    }
    let state = app.state::<Arc<AppState>>();
    *state.baselined_for.lock().unwrap() = None; // 下次轮询先建基线
    refresh_login_item(&app);
    push_auth_to_pages(&app); // 已开着的页面立即免登录
    poll_once(&app);
    Ok(())
}

#[tauri::command]
fn close_login(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("login") {
        let _ = w.close();
    }
}

#[tauri::command]
fn get_saved_username() -> Option<String> {
    load_credentials().map(|c| c.username)
}

/// 登录窗「打开数据文件夹」：资源管理器打开 %APPDATA%\TradeMatrixTray\
/// 目录不存在时先创建（用户可能刚清除过数据又想看看）
#[tauri::command]
fn open_data_dir() {
    if let Some(dir) = config_dir() {
        let _ = open::that(dir.as_os_str());
    }
}

/// 清除本机保存的账号
#[tauri::command]
fn logout(app: tauri::AppHandle) {
    clear_credentials();
    let state = app.state::<Arc<AppState>>();
    *state.baselined_for.lock().unwrap() = None;
    refresh_login_item(&app);
}

/// 点弹窗打开工单时同步把通知标记已读（根治反复弹：后端 isRead 一直是 false，
/// 托盘重启后 mark_seen 内存去重清零，整批历史未读又会被轮询拉出来重弹）
#[tauri::command]
fn mark_notification_read(id: serde_json::Value) {
    let Some(id) = id.as_i64() else { return };
    let Some(creds) = load_credentials() else { return };
    if creds.token.is_empty() {
        return;
    }
    let Ok(base) = tm_url() else { return };
    let body = serde_json::json!({ "ids": [id] });
    let _ = ureq::patch(&format!("{base}/api/notifications/read"))
        .set("Authorization", &format!("Bearer {}", creds.token))
        .send_json(body);
}

// ---------------- 启动 ----------------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(Arc::new(AppState::new()))
        .setup(|app| {
            // 通知画布窗口：固定尺寸、常驻屏幕右上角、透明、空闲点击穿透。
            // 窗口本身永不移动/缩放/隐藏——ElNotification 在画布内自行堆叠演动画，
            // 从根上规避离屏停车/动态 resize 触发的 WebView2 渲染坑。
            let (x, y) = app
                .primary_monitor()
                .ok()
                .flatten()
                .map(|m| {
                    let scale = m.scale_factor();
                    let size = m.size();
                    (
                        size.width as f64 / scale - NOTIFY_W - NOTIFY_MARGIN,
                        NOTIFY_MARGIN,
                    )
                })
                .unwrap_or((1200.0, NOTIFY_MARGIN));

            // 透明画布：tao 在 Windows 上用 DWM BlurBehind 空区域实现整窗透明，
            // 页面背景全透明，只有 ElNotification 卡片像素可见（大人 09-04 实测确认该效果可用）。
            WebviewWindowBuilder::new(app, "notify", WebviewUrl::App("notify.html".into()))
                .title("TradeMatrixNotify")
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .focusable(false)
                .shadow(false)
                .transparent(true)
                .background_color(Color(0, 0, 0, 0))
                .position(x, y)
                .inner_size(NOTIFY_W, NOTIFY_H)
                .build()?;
            // 空闲时点击穿透，透明画布不遮挡桌面任何操作
            // 注意：白条防护（子类化/关 NC 渲染）不能在这里立刻做——建窗后 tao
            // 的窗口过程还在初始化中途，立刻 SetWindowLongPtrW 覆盖会把
            // tray 事件链弄坏（右键菜单/左键点击失灵，11-26 踩坑）。
            // 改为前端 notify 页启动时 invoke install_nc_guard（见下方命令）
            if let Some(w) = app.get_webview_window("notify") {
                let _ = w.set_ignore_cursor_events(true);
            }

            start_http_server(app.handle().clone());
            start_ws_server(app.handle().clone());
            start_poller(app.handle().clone());
            try_auto_login(app.handle());

            // 托盘菜单（test_notify 功能保留但菜单项隐藏——测试阶段结束，将来要测再挂回来）
            let login_item = MenuItemBuilder::with_id("login", "账号登录...").build(app)?;
            let autostart_item = MenuItemBuilder::with_id("autostart", "开机自启").build(app)?;
            let wipe_item = MenuItemBuilder::with_id("wipe_data", "清除账号数据").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&login_item, &autostart_item, &wipe_item, &quit_item])
                .build()?;

            {
                let state = app.state::<Arc<AppState>>();
                *state.login_item.lock().unwrap() = Some(login_item.clone());
                *state.autostart_item.lock().unwrap() = Some(autostart_item.clone());
            }
            refresh_login_item(app.handle());
            refresh_autostart_item(app.handle());

            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().unwrap())
                .tooltip("TradeMatrix")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "login" => show_login_window(app),
                    "autostart" => {
                        let launcher = app.autolaunch();
                        let on = launcher.is_enabled().unwrap_or(false);
                        if on {
                            let _ = launcher.disable();
                        } else {
                            let _ = launcher.enable();
                        }
                        refresh_autostart_item(app);
                        // 切换后弹通知告知当前状态（duration 3000 = 3 秒自动关闭）
                        let now = launcher.is_enabled().unwrap_or(false);
                        let seq = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis())
                            .unwrap_or(0);
                        queue_notify(
                            app,
                            serde_json::json!({
                                "id": format!("autostart-{seq}"),
                                "content": if now {
                                    "已开启开机自启：电脑开机后托盘将自动运行"
                                } else {
                                    "已关闭开机自启"
                                },
                                "ticketId": null,
                                "duration": 3000,
                            }),
                        );
                    }
                    "test_notify" => {
                        let seq = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis())
                            .unwrap_or(0);
                        queue_notify(
                            app,
                            serde_json::json!({
                                "id": format!("test-{seq}"),
                                "content": "这是一条测试通知（托盘右键菜单触发）",
                                "ticketId": null,
                            }),
                        );
                    }
                    "wipe_data" => {
                        // 清除账号数据：删除 %APPDATA%\TradeMatrixTray\ 整个目录
                        // （auth.bin 账号密码 + config.json 配置），回到从未使用过的状态。
                        // 先清内存登录态（含基线账号、通知去重记录），再删目录，
                        // 最后弹出一条确认通知告知用户已恢复初始状态。
                        let state = app.state::<Arc<AppState>>();
                        clear_credentials();
                        *state.baselined_for.lock().unwrap() = None;
                        state.seen.lock().unwrap().clear();
                        state.pending.lock().unwrap().clear();
                        refresh_login_item(app);
                        if let Some(dir) = data_dir_no_create() {
                            if dir.exists() {
                                let _ = std::fs::remove_dir_all(&dir);
                            }
                        }
                        let seq = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis())
                            .unwrap_or(0);
                        queue_notify(
                            app,
                            serde_json::json!({
                                "id": format!("wipe-{seq}"),
                                "content": "账号数据已清除（登录信息与本地配置已删除），回到未使用状态",
                                "ticketId": null,
                            }),
                        );
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        focus_or_open(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            poll_notify,
            dbg_client,
            configure_tm_url,
            install_nc_guard,
            set_clip_region,
            open_ticket,
            try_login,
            close_login,
            get_saved_username,
            logout,
            mark_notification_read,
            open_data_dir,
            list_accounts,
            upsert_account,
            update_account,
            remove_account
        ])
        .run(tauri::generate_context!())
        .expect("error while running TradeMatrix tray");
}
