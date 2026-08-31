/**
 * 全局预览 iframe 池（LinkPreview 配套）
 * 设计目标：
 * 1. 只显隐不销毁 —— 反复悬浮同一工作台、或几个工作台来回切换，
 *    每个地址只完整加载一次，之后零请求、秒开
 * 2. 池容量 MAX_POOL，超出按「最早未使用」逐出，防内存失控
 * 3. 隐藏后超过 POOL_TTL 整池销毁，释放内存并终止目标页
 *    后台请求（轮询/定时器），避免长期占用目标系统资源
 */
const MAX_POOL = 4;
const POOL_TTL = 5 * 60 * 1000;
const SCALE = 3;
const PAD = 8;

let host = null;
let viewport = null;
let loading = null;
let label = null;
let hideTimer = null;
const pool = new Map(); // url -> { iframe, lastUsed }

function injectStyle() {
  if (document.getElementById("lp-pool-style")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "lp-pool-style";
  styleEl.textContent =
    "@keyframes lp-pop{0%{transform:scale3d(.4,.4,1)}60%{transform:scale3d(1.03,1.03,1)}100%{transform:scale3d(1,1,1)}}" +
    ".lp-pop{animation:lp-pop .3s ease;transform-origin:center bottom;}" +
    "@keyframes lp-spin{to{transform:rotate(360deg)}}" +
    ".lp-spinner{width:28px;height:28px;border-radius:50%;" +
    "border:3px solid rgba(148,163,184,.25);border-top-color:#f59e0b;" +
    "animation:lp-spin .8s linear infinite;}";
  document.head.appendChild(styleEl);
}

function initHost() {
  if (host) return;
  injectStyle();
  host = document.createElement("div");
  host.style.cssText =
    "position:fixed;z-index:3000;pointer-events:none;display:none;box-sizing:border-box;";

  const frameBox = document.createElement("div");
  frameBox.style.cssText =
    "width:100%;height:100%;box-sizing:border-box;padding:4px;border-radius:12px;" +
    "background:#fff;box-shadow:0 16px 40px rgba(0,0,0,.18);";

  viewport = document.createElement("div");
  viewport.style.cssText =
    "position:relative;width:100%;height:100%;border-radius:8px;overflow:hidden;background:#fff;";

  loading = document.createElement("div");
  loading.innerHTML = '<div class="lp-spinner"></div><span>正在加载预览…</span>';
  // z-index 必须压过 iframe：两者同为绝对定位，iframe 后插入 DOM 会盖住无层级的 loading
  loading.style.cssText =
    "position:absolute;inset:0;z-index:2;display:none;flex-direction:column;gap:10px;" +
    "align-items:center;justify-content:center;font-size:12px;color:#94a3b8;" +
    "background:rgba(255,255,255,.92);";

  // 左下角灰底名称标签：悬浮预览时展示工作台完整名称（长名自动换行不截断；放底部避免遮挡目标页 header）
  label = document.createElement("div");
  label.style.cssText =
    "position:absolute;bottom:8px;left:8px;z-index:3;display:none;max-width:calc(100% - 16px);" +
    "padding:2px 8px;border-radius:6px;font-size:12px;line-height:18px;color:#fff;" +
    "background:rgba(100,116,139,.85);box-sizing:border-box;" +
    "white-space:normal;word-break:break-all;";

  viewport.appendChild(loading);
  viewport.appendChild(label);
  frameBox.appendChild(viewport);
  host.appendChild(frameBox);
  document.body.appendChild(host);
}

function syncTheme() {
  const dark = document.documentElement.classList.contains("dark");
  const bg = dark ? "#111827" : "#ffffff";
  host.firstElementChild.style.background = bg;
  viewport.style.background = bg;
  loading.style.background = dark ? "rgba(17,24,39,.92)" : "rgba(255,255,255,.92)";
}

function makeFrame(url, style) {
  const iframe = document.createElement("iframe");
  iframe.title = "link-preview";
  iframe.style.cssText =
    "position:absolute;left:0;top:0;border:0;background:#fff;transform-origin:top left;";
  iframe.style.width = (style.width - PAD) * SCALE + "px";
  iframe.style.height = (style.height - PAD) * SCALE + "px";
  iframe.style.transform = `scale(${1 / SCALE})`;
  iframe.addEventListener("load", () => {
    loading.style.display = "none";
  });
  iframe.src = url;
  return iframe;
}

function evictOldest() {
  let oldestUrl = null;
  let oldestTime = Infinity;
  pool.forEach((entry, url) => {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestUrl = url;
    }
  });
  if (oldestUrl) {
    pool.get(oldestUrl).iframe.remove();
    pool.delete(oldestUrl);
  }
}

function destroyPool() {
  pool.forEach((entry) => entry.iframe.remove());
  pool.clear();
}

export function showPreview(url, style, title) {
  if (!url) return;
  initHost();
  syncTheme();
  clearTimeout(hideTimer);

  host.style.left = style.left + "px";
  host.style.top = style.top + "px";
  host.style.width = style.width + "px";
  host.style.height = style.height + "px";
  host.style.display = "block";
  // 强制回流以重新触发弹出动画
  host.classList.remove("lp-pop");
  void host.offsetWidth;
  host.classList.add("lp-pop");

  // 名称标签：有名称就显示，没有就隐藏
  if (title) {
    label.textContent = title;
    label.style.display = "block";
  } else {
    label.style.display = "none";
  }

  let entry = pool.get(url);
  if (!entry) {
    if (pool.size >= MAX_POOL) evictOldest();
    loading.style.display = "flex";
    entry = { iframe: makeFrame(url, style), lastUsed: Date.now() };
    pool.set(url, entry);
    viewport.appendChild(entry.iframe);
  } else {
    loading.style.display = "none";
  }
  entry.lastUsed = Date.now();

  pool.forEach((e, u) => {
    e.iframe.style.display = u === url ? "block" : "none";
  });
}

export function hidePreview() {
  if (!host) return;
  host.style.display = "none";
  clearTimeout(hideTimer);
  hideTimer = setTimeout(destroyPool, POOL_TTL);
}
