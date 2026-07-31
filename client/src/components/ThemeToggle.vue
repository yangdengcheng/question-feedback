<!-- client/src/components/ThemeToggle.vue -->
<template>
  <button
    class="theme-toggle"
    :title="theme === 'dark' ? '切换浅色模式' : '切换暗色模式'"
    @click="toggle"
  >
    <el-icon :size="16">
      <Sunny v-if="theme === 'dark'" />
      <Moon v-else />
    </el-icon>
  </button>
</template>

<script setup>
import { Sunny, Moon } from "@element-plus/icons-vue";
import { useTheme } from "../composables/useTheme";

const { theme, toggle } = useTheme();
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.theme-toggle:hover {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
</style>
