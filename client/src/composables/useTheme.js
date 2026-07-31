// client/src/composables/useTheme.js
import { ref, readonly } from "vue";

const theme = ref("dark");

// 初始化：读 localStorage（index.html 内联脚本已设 data-theme，此处同步 ref）
try {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") theme.value = saved;
} catch (_) {}

function applyTheme(t) {
  theme.value = t;
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("theme", t);
  } catch (_) {}
}

function toggle() {
  applyTheme(theme.value === "dark" ? "light" : "dark");
}

function setTheme(t) {
  if (t === "light" || t === "dark") applyTheme(t);
}

export function useTheme() {
  return { theme: readonly(theme), toggle, setTheme };
}
