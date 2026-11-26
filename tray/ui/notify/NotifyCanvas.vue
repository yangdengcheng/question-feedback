<template>
  <!-- 无可见内容：ElNotification 由命令式调用渲染，画布本身全透明 -->
  <div class="notify-canvas">
    <!-- 合成器心跳：2px 近全透明元素做无限 transform 动画，强制 WebView2
         持续出帧。否则空闲时渲染管线休眠，第一张卡片到达时要先唤醒管线，
         入场动画头几帧冻在半透明状态（第二张开始管线已热所以丝滑） -->
    <div class="compositor-keepalive"></div>
  </div>
</template>

<script setup>
import { h, onMounted, onBeforeUnmount, nextTick } from "vue";
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
    // 左右下外扩 8px 保住卡片阴影和叉叉热区；顶部绝不能外扩：
    // region 顶边伸进卡片上方的透明带后，鼠标按下激活窗口时系统会沿
    // region 边界重绘，那条边在透明区里就露成"一行白条"（点任意卡片、
    // 按住不松都出现，所有卡片关闭 region 缩回才消失）。
    // 顶部内缩 2px 让顶边落在卡片自身白色背景内，白条无处可见。
    l -= 8;
    t += 2;
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
  // 评论类通知：正文后用冒号拼接评论人 + 完整评论内容（不截断，卡片内滚动可看全文）
  if (payload.comment) {
    const author = payload.commentAuthor ? `${payload.commentAuthor}：` : "";
    children.push(
      h("div", { class: "tm-notify-comment", title: payload.comment }, author + payload.comment)
    );
  }
  if (Array.isArray(payload.images) && payload.images.length) {
    children.push(
      h(
        "div",
        { class: "tm-notify-imgs" },
        payload.images.map((p) =>
          // 不用 loading=lazy：ElNotification 同步用 offsetHeight 算堆叠偏移，
          // 懒加载图片高度为 0 会让多张卡片算出同一 offset 叠在一起（重叠 bug 根源）
          h("img", { src: `${BASE}/uploads/${p}`, alt: "评论截图" })
        )
      )
    );
  }
  return h("div", children);
}

// 渲染就绪门（问题1核心修复）：收到通知不直接挂卡片，先等 rAF 连续出帧——
// rAF 回调触发 = WebView2 合成器活着且在出帧（管线休眠时 rAF 不触发）。
// 确认管线热了再播入场动画，把"唤醒期冻帧半透明"整个躲掉（大人 11-26 提的思路）
function show(payload) {
  const begin = () =>
    requestAnimationFrame(() => requestAnimationFrame(() => doShow(payload)));
  if (document.readyState === "complete") begin();
  else document.addEventListener("load", begin, { once: true });
}

function doShow(payload) {
  let handle;
  handle = ElNotification({
    title: "TradeMatrix通知",
    message: buildMessage(payload),
    duration: 0, // 不自动关闭，只能点右上角叉叉或点卡片手动关（大人 09-04 要求）
    offset: 16,
    position: "top-right",
    onClick: () => {
      // 点卡片：打开对应工单 + 同步把该通知标记已读（防托盘重启后重弹），关掉这张通知
      invoke("open_ticket", { ticket: payload.ticketId ?? null }).catch(() => {});
      if (payload.id != null) {
        invoke("mark_notification_read", { id: payload.id }).catch(() => {});
      }
      handle?.close();
    },
    onClose: () => {
      if (queue.length) show(queue.shift());
    },
  });
  // 兜底重排：消息内容/图片渲染完成后强制重算堆叠偏移，
  // 兜底重排：消息内容/图片渲染完成后强制重算堆叠偏移，
  // 防止卡片高度变化（图片加载完成变高）导致的重叠
  nextTick(() => {
    ElNotification.updateOffsets?.();
    requestAnimationFrame(() => ElNotification.updateOffsets?.());
  });
}

let pollTimer = null;
let regionTimer = null;

// 预热渲染路径（问题1修复）：ElNotification 首挂有一次性成本（组件树创建 +
// CSS 首算 + 首帧合成），首张真实卡片的入场动画会掉帧；先用一张立刻关闭的
// 隐形卡片把这些成本在启动阶段付掉。放负偏移窗外 + 100ms 后关，用户无感。
function warmup() {
  const h1 = ElNotification({
    title: " ",
    message: " ",
    duration: 0,
    position: "top-right",
    offset: -600, // 画布高度 520，-600 保证整卡在窗外
    onClose: () => {},
  });
  setTimeout(() => h1?.close(), 100);
}
onMounted(() => {
  // 预热：挂一张窗外隐形卡片立即关闭，让 ElNotification 组件树/CSS/首帧合成
  // 提前跑一遍。否则首张真实卡片要付一次性首挂成本，入场动画前几帧被卡，
  // 撞上裁剪区域切换就是肉眼可见的"半透明闪现"（第二张开始走热路径所以丝滑）
  warmup();

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
.compositor-keepalive {
  position: absolute;
  left: 0;
  top: 0;
  width: 2px;
  height: 2px;
  background: rgba(0, 0, 0, 0.01);
  animation: keepalive-blink 2s linear infinite;
}
@keyframes keepalive-blink {
  0% { transform: translateY(0px); }
  50% { transform: translateY(1px); }
  100% { transform: translateY(0px); }
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
  /* 完整评论可能很长：限高滚动，保住整张卡片布局 */
  max-height: 200px;
  overflow-y: auto;
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
