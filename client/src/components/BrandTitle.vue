<script setup>
// 品牌标题：Trade + LineShadowText 斜纹流动阴影特效
// 移植自 magicui line-shadow-text（React → Vue3 SFC，动画为纯 CSS，无需 motion 库）
// 阴影颜色默认跟随项目深浅主题（浅底黑纹 / 暗底白纹），可用 shadowColor 覆盖
import { computed } from "vue";
import { useTheme } from "../composables/useTheme";

const props = defineProps({
  text: { type: String, default: "Matrix" },
  shadowColor: { type: String, default: "" },
});

const { theme } = useTheme();
const isDark = computed(() => theme.value === "dark");
const shadow = computed(() => props.shadowColor || (isDark.value ? "white" : "black"));
</script>

<template>
  <span class="brand-title">
    Trade<span
      class="line-shadow-text italic"
      :data-text="text"
      :style="{ '--shadow-color': shadow }"
      >{{ text }}</span
    >
  </span>
</template>

<style scoped>
.brand-title {
  display: inline-flex;
  align-items: baseline;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

/* 阴影层：复制一份文字，用 45° 斜纹渐变裁成文字形状，偏移到右下并流动 */
.line-shadow-text {
  position: relative;
  z-index: 0;
  display: inline-flex;
}
.line-shadow-text::after {
  content: attr(data-text);
  position: absolute;
  top: 0.04em;
  left: 0.04em;
  z-index: -1;
  background: linear-gradient(
    45deg,
    transparent 45%,
    var(--shadow-color) 45%,
    var(--shadow-color) 55%,
    transparent 0
  );
  background-size: 0.06em 0.06em;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: line-shadow 15s linear infinite;
  pointer-events: none;
}
@keyframes line-shadow {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 100% -100%;
  }
}
</style>
