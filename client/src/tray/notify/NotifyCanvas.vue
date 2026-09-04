<template>
  <!-- 无可见内容：ElNotification 由命令式调用渲染，画布本身全透明 -->
  <div class="notify-canvas"></div>
</template>

<script setup>
import { h, onMounted, onBeforeUnmount } from "vue";
import { ElNotification } from "element-plus";

const invoke = window.__TAURI_INTERNALS__
  ? (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args)
  : () => Promise.reject(new Error("no tauri"));

// 截图/跳转地址基址（.env 注入），图片拼 /uploads/<文件名>
const BASE = (import.meta.env.VITE_TM_URL || "").replace(/\/$/, "");

const MAX_VISIBLE = 4; // 同屏上限，与画布窗口高度匹配
const queue = []; // 超出上限的通知排队，关闭一条补进一条

// ---------------- 点击区域裁剪 ----------------
// 透明画布整窗会挡住桌面点击，所以把窗口点击区域动态裁成卡片实际包围盒：
// 卡片外（透明部分）点击穿透到桌面，卡片内可交互；无卡片时整窗穿透。
// 进出场动画期间包围盒连续变化，用短间隔轮询跟随。
let lastRegionKey = "__init__";
function measureAndSync() {
  const els = document.querySelectorAll(".el-notification");
  let rects = [];
  if (els.length) {
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    els.forEach((el) => {
      const rc = el.getBoundingClientRect();
      l = Math.min(l, rc.left);
      t = Math.min(t, rc.top);
      r = Math.max(r, rc.right);
      b = Math.max(b, rc.bottom);
    });
    // 外扩 8px 保住卡片阴影和叉叉热区
    l -= 8;
    t -= 8;
    r += 8;
    b += 8;
    rects = [[Math.floor(l), Math.floor(t), Math.ceil(r - l), Math.ceil(b - t)]];
  }
  const key = rects.length ? rects[0].join(",") : "";
  if (key !== lastRegionKey) {
    lastRegionKey = key;
    invoke("set_clip_region", { rects }).catch(() => {});
  }
}

// 评论正文截断展示，全文放 title 悬浮可见
function clip(text, max) {
  const s = typeof text === "string" ? text : String(text ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function buildMessage(payload) {
  const children = [
    h("div", { class: "tm-notify-body", title: payload.content }, clip(payload.content, 120)),
  ];
  // 评论类通知：摘要下面再放评论正文 + 截图
  if (payload.comment) {
    children.push(
      h("div", { class: "tm-notify-comment", title: payload.comment }, clip(payload.comment, 200))
    );
  }
  if (Array.isArray(payload.images) && payload.images.length) {
    children.push(
      h(
        "div",
        { class: "tm-notify-imgs" },
        payload.images.map((p) =>
          h("img", { src: `${BASE}/uploads/${p}`, alt: "评论截图", loading: "lazy" })
        )
      )
    );
  }
  return h("div", children);
}

function show(payload) {
  let handle;
  handle = ElNotification({
    title: "TradeMatrix通知",
    message: buildMessage(payload),
    duration: 0, // 不自动关闭，只能点右上角叉叉或点卡片手动关（大人 09-04 要求）
    offset: 16,
    position: "top-right",
    onClick: () => {
      // 点卡片：打开对应工单，同时关掉这张通知
      invoke("open_ticket", { ticket: payload.ticketId ?? null }).catch(() => {});
      handle?.close();
    },
    onClose: () => {
      if (queue.length) show(queue.shift());
    },
  });
}

let pollTimer = null;
let regionTimer = null;
onMounted(() => {
  pollTimer = setInterval(() => {
    invoke("poll_notify")
      .then((items) => {
        if (!items || !items.length) return;
        const visible = document.querySelectorAll(".el-notification").length;
        items.forEach((p, i) => {
          if (visible + i >= MAX_VISIBLE) queue.push(p);
          else show(p);
        });
      })
      .catch(() => {});
  }, 500);
  regionTimer = setInterval(measureAndSync, 150);
  measureAndSync();
});
onBeforeUnmount(() => {
  clearInterval(pollTimer);
  clearInterval(regionTimer);
});
</script>

<style>
html,
body {
  margin: 0;
  overflow: hidden;
  background: transparent;
}
.tm-notify-body {
  font-size: 13px;
  color: #4e5969;
  line-height: 1.5;
  word-break: break-all;
}
.tm-notify-comment {
  margin-top: 6px;
  padding: 6px 8px;
  background: #f7f8fa;
  border-radius: 4px;
  font-size: 12px;
  color: #1f2329;
  line-height: 1.5;
  word-break: break-all;
}
.tm-notify-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.tm-notify-imgs img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #e5e6eb;
}
</style>
