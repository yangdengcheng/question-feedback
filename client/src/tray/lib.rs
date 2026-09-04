use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::Duration;

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
}

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
            SetWindowRgn(hwnd, 0, 1);
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
            SetWindowRgn(hwnd, combined, 1);
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

    {
        let baseline = state.baselined_for.lock().unwrap();
        if baseline.as_deref() != Some(creds.username.as_str()) {
            drop(baseline);
            // 首次基线：当前未读全部记为已见，不弹窗
            let mut baseline = state.baselined_for.lock().unwrap();
            for id in &id_strs {
                mark_seen(&state, id);
            }
            *baseline = Some(creds.username.clone());
            return;
        }
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

/// 左键托盘：已开着的页面通知它聚焦，同时一律用默认浏览器打开 TM 系统。
/// 新开的页面会通过 WS 连上托盘，托盘下发登录态实现免登录（大人 09-04 要求：点击必须开浏览器）
fn focus_or_open(app: &tauri::AppHandle) {
    broadcast_ws(app, "{\"type\":\"focus\"}");
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
        .inner_size(380.0, 400.0)
        .resizable(false)
        .maximizable(false)
        .center()
        .build();
}

// ---------------- 前端命令 ----------------

/// 点通知卡片：用默认浏览器打开对应工单
#[tauri::command]
fn open_ticket(ticket: serde_json::Value) {
    let id = match &ticket {
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_string()),
        _ => None,
    };
    let path = match id {
        Some(id) => format!("/tickets/{id}"),
        None => "/".to_string(),
    };
    if let Some(url) = authed_url(&path) {
        open_in_browser(&url);
    }
}

/// 登录窗口提交：验证账号密码并加密保存
#[tauri::command]
fn try_login(app: tauri::AppHandle, username: String, password: String) -> Result<(), String> {
    let (token, user) = api_login(&username, &password)?;
    save_credentials(&Credentials {
        username,
        password,
        token,
        user,
    })?;
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

/// 清除本机保存的账号
#[tauri::command]
fn logout(app: tauri::AppHandle) {
    clear_credentials();
    let state = app.state::<Arc<AppState>>();
    *state.baselined_for.lock().unwrap() = None;
    refresh_login_item(&app);
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
            if let Some(w) = app.get_webview_window("notify") {
                let _ = w.set_ignore_cursor_events(true);
            }

            start_http_server(app.handle().clone());
            start_ws_server(app.handle().clone());
            start_poller(app.handle().clone());

            // 托盘菜单
            let login_item = MenuItemBuilder::with_id("login", "账号登录...").build(app)?;
            let autostart_item = MenuItemBuilder::with_id("autostart", "开机自启").build(app)?;
            let test_item = MenuItemBuilder::with_id("test_notify", "测试阶段：弹一条测试通知").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&login_item, &autostart_item, &test_item, &quit_item])
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
            set_clip_region,
            open_ticket,
            try_login,
            close_login,
            get_saved_username,
            logout
        ])
        .run(tauri::generate_context!())
        .expect("error while running TradeMatrix tray");
}
