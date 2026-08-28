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
let hideTimer = null;
const pool = new Map(); // url -> { iframe, lastUsed }

function injectStyle() {
  if (document.getElementById("lp-pool-style")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "lp-pool-style";
  styleEl.textContent =
    "@keyframes lp-pop{0%{transform:scale3d(.4,.4,1)}60%{transform:scale3d(1.03,1.03,1)}100%{transform:scale3d(1,1,1)}}" +
    ".lp-pop{animation:lp-pop .3s ease;transform-origin:center bottom;}";
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
  loading.textContent = "正在加载预览…";
  loading.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
    "font-size:12px;color:#9ca3af;";

  viewport.appendChild(loading);
  frameBox.appendChild(viewport);
  host.appendChild(frameBox);
  document.body.appendChild(host);
}

function syncTheme() {
  const dark = document.documentElement.classList.contains("dark");
  const bg = dark ? "#111827" : "#ffffff";
  host.firstElementChild.style.background = bg;
  viewport.style.background = bg;
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

export function showPreview(url, style) {
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
