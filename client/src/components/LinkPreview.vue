<script setup>
/**
 * 工作台卡片链接悬浮预览触发器。
 * iframe 的创建/缓存/销毁全部交给 previewPool 全局池：
 * 同一地址只完整加载一次，之后悬浮只做显隐，避免来回切换
 * 反复触发目标页加载（验证码、登录接口等副作用）。
 * 不做防抖：缓存命中时悬浮零成本秒开，防抖只会拖慢高频路径；
 * 未缓存地址的并发加载由池容量上限兜底。
 */
import { ref } from "vue";
import { showPreview, hidePreview } from "./previewPool";

const props = defineProps({
  url: { type: String, default: "" },
  title: { type: String, default: "" },
  width: { type: Number, default: 420 },
  height: { type: Number, default: 260 },
});

const triggerRef = ref(null);

function computeStyle() {
  const offset = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect =
    triggerRef.value?.getBoundingClientRect() || { left: 0, top: 0, bottom: 0, width: 0 };
  // 水平以卡片居中：位置稳定不随鼠标漂移，预览窗永远贴着卡片
  let x = rect.left + rect.width / 2 - props.width / 2;
  x = Math.min(Math.max(8, x), vw - props.width - 8);
  let y = rect.top - props.height - offset;
  if (y < 8) {
    y = Math.min(rect.bottom + offset, vh - props.height - 8);
  }
  return { left: x, top: y, width: props.width, height: props.height };
}

function handleMouseEnter() {
  if (!props.url) return;
  showPreview(props.url, computeStyle(), props.title);
}

function handleMouseLeave() {
  hidePreview();
}
</script>

<template>
  <div
    ref="triggerRef"
    class="relative"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <slot />
  </div>
</template>
