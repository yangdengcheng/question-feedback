# 主题明暗切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为问题反馈系统新增明暗主题切换，浅色为白底工程操作台风格，默认暗色，记忆用户选择。

**Architecture:** CSS 变量双主题（`data-theme` 根属性驱动）+ 语义化 Tailwind token 接 `var()` + `useTheme` composable 单例 + `index.html` 内联防闪烁脚本。全部差异收敛到 `theme.css` 变量层，组件层只用语义 token。

**Tech Stack:** Vue 3 Composition API、TailwindCSS（`darkMode:"class"`）、Element Plus（`--el-*` 变量换肤）、md-editor-v3（`theme` 属性）、localStorage

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `client/src/styles/theme.css` | 改 | 双主题 CSS 变量（暗/浅）+ Element Plus 双套覆盖 + 写死值变量化 |
| `client/tailwind.config.js` | 改 | 语义 token 接 `var()` + 新增 `accent-text/accent-soft/accent-border` |
| `client/index.html` | 改 | 防闪烁内联脚本（Vue 挂载前设 `data-theme`） |
| `client/src/composables/useTheme.js` | 新建 | 主题单例 composable（`theme`/`toggle`/`setTheme`） |
| `client/src/components/ThemeToggle.vue` | 新建 | 太阳/月亮切换按钮 |
| `client/src/layouts/UserLayout.vue` | 改 | 接入 ThemeToggle + 替换硬编码颜色类 |
| `client/src/layouts/AdminLayout.vue` | 改 | 接入 ThemeToggle + 替换硬编码颜色类 |
| 其余 16 个 `.vue` 文件 | 改 | 替换硬编码 `slate-*` / `text-primary` / `bg-primary/10` 等类 |
| `client/src/components/MarkdownEditor.vue` | 改 | md-editor 主题跟随 |
| `client/src/views/ToolkitDetail.vue` | 改 | MdPreview 主题跟随 + 替换硬编码类 |

---

## Task 1: theme.css 双主题变量重构

**Files:**
- Modify: `client/src/styles/theme.css`

- [ ] **Step 1: 在 `:root` 暗色兜底块中补充新变量**

在现有 `:root { ... }` 块（第 11–56 行）的 `/* 主色（信号橙） */` 部分追加两个变量，并在块末追加输入/遮罩/滚动条变量：

```css
:root {
  /* 基底 */
  --ink: #0b1120;
  --surface: #121a2b;
  --surface-2: #1a2438;
  --line: rgba(148, 163, 184, 0.14);
  --line-strong: rgba(148, 163, 184, 0.24);

  /* 文本 */
  --text: #e6edf6;
  --text-2: #9aa7bc;
  --text-3: #5c6b82;

  /* 主色（信号橙） */
  --accent: #fbbf24;
  --accent-strong: #f59e0b;
  --accent-deep: #b45309;
  --accent-soft: rgba(251, 191, 36, 0.1);
  --accent-glow: rgba(251, 191, 36, 0.32);
  --accent-text: #fbbf24;          /* 新增：文字/链接用，暗色与 --accent 同值 */
  --accent-border: rgba(251, 191, 36, 0.35); /* 新增：强调边框 alpha 变量 */

  /* 状态色 */
  --st-pending: #f59e0b;
  --st-processing: #38bdf8;
  --st-resolved: #34d399;
  --st-closed: #64748b;

  /* 字体 */
  --font-disp: "Space Grotesk", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-body: "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;

  /* 圆角：收紧，工程感 */
  --radius-s: 4px;
  --radius-m: 6px;
  --radius-l: 10px;

  /* 阴影 */
  --shadow-panel: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 8px 24px rgba(2, 6, 16, 0.45);
  --shadow-pop: 0 12px 32px rgba(2, 6, 16, 0.6);

  /* 蓝图网格背景 */
  --grid-bg:
    radial-gradient(900px 500px at 85% -10%, rgba(251, 191, 36, 0.05), transparent 60%),
    linear-gradient(rgba(148, 163, 184, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px);

  /* 新增：输入框/遮罩/滚动条（暗色值） */
  --input-bg: rgba(11, 17, 32, 0.6);
  --autofill-bg: rgba(11, 17, 32, 0.6);
  --table-header-bg: rgba(26, 36, 56, 0.55);
  --mask-bg: rgba(4, 8, 18, 0.7);
  --scrollbar-thumb: rgba(148, 163, 184, 0.22);
  --scrollbar-thumb-hover: rgba(148, 163, 184, 0.38);
}
```

- [ ] **Step 2: 紧接 `:root` 块后插入 `:root[data-theme="dark"]` 显式暗色块**

在 `:root { ... }` 块结束后、`/* ============================ 全局基底 ============================ */` 注释前，插入：

```css
/* 显式暗色主题（与 :root 兜底值相同，供 data-theme="dark" 使用） */
:root[data-theme="dark"] {
  --ink: #0b1120;
  --surface: #121a2b;
  --surface-2: #1a2438;
  --line: rgba(148, 163, 184, 0.14);
  --line-strong: rgba(148, 163, 184, 0.24);
  --text: #e6edf6;
  --text-2: #9aa7bc;
  --text-3: #5c6b82;
  --accent: #fbbf24;
  --accent-strong: #f59e0b;
  --accent-deep: #b45309;
  --accent-soft: rgba(251, 191, 36, 0.1);
  --accent-glow: rgba(251, 191, 36, 0.32);
  --accent-text: #fbbf24;
  --accent-border: rgba(251, 191, 36, 0.35);
  --st-pending: #f59e0b;
  --st-processing: #38bdf8;
  --st-resolved: #34d399;
  --st-closed: #64748b;
  --shadow-panel: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 8px 24px rgba(2, 6, 16, 0.45);
  --shadow-pop: 0 12px 32px rgba(2, 6, 16, 0.6);
  --grid-bg:
    radial-gradient(900px 500px at 85% -10%, rgba(251, 191, 36, 0.05), transparent 60%),
    linear-gradient(rgba(148, 163, 184, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px);
  --input-bg: rgba(11, 17, 32, 0.6);
  --autofill-bg: rgba(11, 17, 32, 0.6);
  --table-header-bg: rgba(26, 36, 56, 0.55);
  --mask-bg: rgba(4, 8, 18, 0.7);
  --scrollbar-thumb: rgba(148, 163, 184, 0.22);
  --scrollbar-thumb-hover: rgba(148, 163, 184, 0.38);
}
```

- [ ] **Step 3: 紧接暗色块后插入 `:root[data-theme="light"]` 浅色块**

```css
/* 浅色主题：白底工程操作台 */
:root[data-theme="light"] {
  --ink: #f4f6fa;
  --surface: #ffffff;
  --surface-2: #f8fafc;
  --line: rgba(15, 23, 42, 0.08);
  --line-strong: rgba(15, 23, 42, 0.16);
  --text: #0f172a;
  --text-2: #475569;
  --text-3: #94a3b8;
  --accent: #f59e0b;
  --accent-strong: #d97706;
  --accent-deep: #92400e;
  --accent-soft: rgba(245, 158, 11, 0.1);
  --accent-glow: rgba(245, 158, 11, 0.24);
  --accent-text: #b45309;
  --accent-border: rgba(245, 158, 11, 0.4);
  --st-pending: #d97706;
  --st-processing: #0284c7;
  --st-resolved: #059669;
  --st-closed: #64748b;
  --shadow-panel: 0 1px 3px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.06);
  --shadow-pop: 0 8px 24px rgba(15, 23, 42, 0.12);
  --grid-bg:
    radial-gradient(900px 500px at 85% -10%, rgba(245, 158, 11, 0.04), transparent 60%),
    linear-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px);
  --input-bg: rgba(248, 250, 252, 0.9);
  --autofill-bg: rgba(255, 255, 255, 0.95);
  --table-header-bg: rgba(248, 250, 252, 0.9);
  --mask-bg: rgba(15, 23, 42, 0.4);
  --scrollbar-thumb: rgba(15, 23, 42, 0.18);
  --scrollbar-thumb-hover: rgba(15, 23, 42, 0.32);
}
```

- [ ] **Step 4: 将 Element Plus `:root` 覆盖块拆为暗/浅两套**

将原文件中第二个 `:root { ... }` 块（Element Plus 覆盖，原第 312–376 行）替换为：

```css
/* Element Plus 暗色覆盖 */
:root,
:root[data-theme="dark"] {
  --el-color-primary: #fbbf24;
  --el-color-primary-light-3: #fcd34d;
  --el-color-primary-light-5: rgba(251, 191, 36, 0.42);
  --el-color-primary-light-7: rgba(251, 191, 36, 0.24);
  --el-color-primary-light-8: rgba(251, 191, 36, 0.14);
  --el-color-primary-light-9: rgba(251, 191, 36, 0.08);
  --el-color-primary-dark-2: #f59e0b;
  --el-color-success: #34d399;
  --el-color-success-light-9: rgba(52, 211, 153, 0.1);
  --el-color-warning: #f59e0b;
  --el-color-warning-light-9: rgba(245, 158, 11, 0.1);
  --el-color-danger: #f87171;
  --el-color-danger-light-9: rgba(248, 113, 113, 0.1);
  --el-color-info: #64748b;
  --el-color-info-light-9: rgba(100, 116, 139, 0.12);
  --el-text-color-primary: #e6edf6;
  --el-text-color-regular: #c3cedd;
  --el-text-color-secondary: #9aa7bc;
  --el-text-color-placeholder: #5c6b82;
  --el-text-color-disabled: #475569;
  --el-border-color: rgba(148, 163, 184, 0.18);
  --el-border-color-light: rgba(148, 163, 184, 0.14);
  --el-border-color-lighter: rgba(148, 163, 184, 0.1);
  --el-border-color-extra-light: rgba(148, 163, 184, 0.07);
  --el-border-color-hover: rgba(251, 191, 36, 0.55);
  --el-fill-color: #1a2438;
  --el-fill-color-light: #162032;
  --el-fill-color-lighter: #121a2b;
  --el-fill-color-extra-light: #0f1727;
  --el-fill-color-blank: #121a2b;
  --el-bg-color: #121a2b;
  --el-bg-color-page: #0b1120;
  --el-bg-color-overlay: #162032;
  --el-mask-color: rgba(4, 8, 18, 0.72);
  --el-mask-color-extra-light: rgba(4, 8, 18, 0.4);
  --el-border-radius-base: 6px;
  --el-border-radius-small: 4px;
  --el-border-radius-round: 16px;
  --el-font-family: var(--font-body);
  --el-font-size-base: 13px;
  --el-box-shadow: var(--shadow-pop);
  --el-box-shadow-light: 0 6px 20px rgba(2, 6, 16, 0.5);
  --el-box-shadow-lighter: 0 4px 12px rgba(2, 6, 16, 0.4);
  --el-transition-duration: 0.18s;
}

/* Element Plus 浅色覆盖 */
:root[data-theme="light"] {
  --el-color-primary: #f59e0b;
  --el-color-primary-light-3: #fbbf24;
  --el-color-primary-light-5: rgba(245, 158, 11, 0.42);
  --el-color-primary-light-7: rgba(245, 158, 11, 0.24);
  --el-color-primary-light-8: rgba(245, 158, 11, 0.14);
  --el-color-primary-light-9: rgba(245, 158, 11, 0.08);
  --el-color-primary-dark-2: #d97706;
  --el-color-success: #059669;
  --el-color-success-light-9: rgba(5, 150, 105, 0.1);
  --el-color-warning: #d97706;
  --el-color-warning-light-9: rgba(217, 119, 6, 0.1);
  --el-color-danger: #dc2626;
  --el-color-danger-light-9: rgba(220, 38, 38, 0.1);
  --el-color-info: #64748b;
  --el-color-info-light-9: rgba(100, 116, 139, 0.1);
  --el-text-color-primary: #0f172a;
  --el-text-color-regular: #334155;
  --el-text-color-secondary: #475569;
  --el-text-color-placeholder: #94a3b8;
  --el-text-color-disabled: #cbd5e1;
  --el-border-color: rgba(15, 23, 42, 0.14);
  --el-border-color-light: rgba(15, 23, 42, 0.1);
  --el-border-color-lighter: rgba(15, 23, 42, 0.07);
  --el-border-color-extra-light: rgba(15, 23, 42, 0.05);
  --el-border-color-hover: rgba(245, 158, 11, 0.55);
  --el-fill-color: #f8fafc;
  --el-fill-color-light: #f1f5f9;
  --el-fill-color-lighter: #f8fafc;
  --el-fill-color-extra-light: #ffffff;
  --el-fill-color-blank: #ffffff;
  --el-bg-color: #ffffff;
  --el-bg-color-page: #f4f6fa;
  --el-bg-color-overlay: #ffffff;
  --el-mask-color: rgba(15, 23, 42, 0.4);
  --el-mask-color-extra-light: rgba(15, 23, 42, 0.2);
  --el-border-radius-base: 6px;
  --el-border-radius-small: 4px;
  --el-border-radius-round: 16px;
  --el-font-family: var(--font-body);
  --el-font-size-base: 13px;
  --el-box-shadow: var(--shadow-pop);
  --el-box-shadow-light: 0 4px 16px rgba(15, 23, 42, 0.1);
  --el-box-shadow-lighter: 0 2px 8px rgba(15, 23, 42, 0.08);
  --el-transition-duration: 0.18s;
}
```

- [ ] **Step 5: 替换 theme.css 中写死的 rgba 值为变量**

逐处替换（使用 SearchReplace）：

1. `.input-base` 的 `background: rgba(11, 17, 32, 0.6)` → `background: var(--input-bg)`
2. `.el-input__wrapper` 等的 `background-color: rgba(11, 17, 32, 0.6) !important` → `background-color: var(--input-bg) !important`
3. autofill hack 的 `-webkit-box-shadow: 0 0 0 1000px rgba(11, 17, 32, 0.6) inset` → `0 0 0 1000px var(--autofill-bg) inset`（两行均改）
4. `.el-table` 的 `--el-table-header-bg-color: rgba(26, 36, 56, 0.55)` → `var(--table-header-bg)`
5. `.el-upload-dragger` 的 `background: rgba(11, 17, 32, 0.5) !important` → `background: var(--input-bg) !important`
6. `.el-loading-mask` 的 `background-color: rgba(4, 8, 18, 0.7) !important` → `background-color: var(--mask-bg) !important`
7. `::-webkit-scrollbar-thumb` 的 `background: rgba(148, 163, 184, 0.22)` → `background: var(--scrollbar-thumb)`
8. `::-webkit-scrollbar-thumb:hover` 的 `background: rgba(148, 163, 184, 0.38)` → `background: var(--scrollbar-thumb-hover)`

- [ ] **Step 6: 将"accent 当文字色"的地方改为 `var(--accent-text)`**

逐处替换：

1. `.btn-ghost:hover { color: var(--accent) }` → `color: var(--accent-text)`
2. `.el-button--default` 的 `--el-button-hover-text-color: var(--accent)` → `var(--accent-text)`
3. `.el-button--primary.is-plain` 的 `--el-button-text-color: var(--accent)` → `var(--accent-text)`；`--el-button-hover-text-color: #fcd34d` → `var(--accent-text)`
4. `.el-select-dropdown__item:hover { color: var(--accent) }` → `color: var(--accent-text)`
5. `.el-select-dropdown__item.selected { color: var(--accent) !important }` → `color: var(--accent-text) !important`
6. `.el-pager li.is-active { color: var(--accent) !important }` → `color: var(--accent-text) !important`
7. `.el-menu` 的 `--el-menu-active-color: var(--accent)` → `var(--accent-text)`
8. `.el-radio__input.is-checked + .el-radio__label` 和 `.el-checkbox__input.is-checked + .el-checkbox__label` 的 `color: var(--accent)` → `color: var(--accent-text)`
9. `.el-pagination` 的 `--el-pagination-hover-color: var(--accent)` → `var(--accent-text)`

- [ ] **Step 7: 提交**

```bash
git add client/src/styles/theme.css
git commit -m "feat(theme): theme.css 双主题变量重构（暗/浅 + Element Plus 双套 + 写死值变量化）"
```

---

## Task 2: tailwind.config.js 语义 token 接变量 + index.html 防闪烁脚本

**Files:**
- Modify: `client/tailwind.config.js`
- Modify: `client/index.html`

- [ ] **Step 1: 更新 tailwind.config.js 颜色为 var() 引用**

将 `colors` 块完整替换为：

```js
colors: {
  // 方案 C · 信号橙（接 CSS 变量，随主题切换）
  primary: "var(--accent)",
  "primary-strong": "var(--accent-strong)",
  accent: "var(--accent)",
  "accent-text": "var(--accent-text)",
  "accent-soft": "var(--accent-soft)",
  "accent-border": "var(--accent-border)",
  // 基底
  ink: "var(--ink)",
  surface: {
    DEFAULT: "var(--surface)",
    2: "var(--surface-2)",
  },
  line: {
    DEFAULT: "var(--line)",
    strong: "var(--line-strong)",
  },
  // 文本
  "ink-text": "var(--text)",
  "ink-text-2": "var(--text-2)",
  "ink-text-3": "var(--text-3)",
  // 状态色
  "st-pending": "var(--st-pending)",
  "st-processing": "var(--st-processing)",
  "st-resolved": "var(--st-resolved)",
  "st-closed": "var(--st-closed)",
},
```

- [ ] **Step 2: 在 index.html `<head>` 中加入防闪烁内联脚本**

在 `<title>` 标签前插入：

```html
<script>
  // 防闪烁：Vue 挂载前读取记忆主题并设置 data-theme（缺省暗色）
  (function () {
    var t = "dark";
    try {
      var s = localStorage.getItem("theme");
      if (s === "light" || s === "dark") t = s;
    } catch (e) {}
    document.documentElement.dataset.theme = t;
  })();
</script>
```

同时将 `<html lang="zh-CN" class="dark">` 改为 `<html lang="zh-CN">`（移除无用 `class="dark"`）。

- [ ] **Step 3: 提交**

```bash
git add client/tailwind.config.js client/index.html
git commit -m "feat(theme): tailwind token 接 CSS 变量 + index.html 防闪烁脚本"
```

---

## Task 3: useTheme composable + ThemeToggle 组件 + Layout 接入

**Files:**
- Create: `client/src/composables/useTheme.js`
- Create: `client/src/components/ThemeToggle.vue`
- Modify: `client/src/layouts/UserLayout.vue`
- Modify: `client/src/layouts/AdminLayout.vue`

- [ ] **Step 1: 创建 useTheme.js**

```js
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
```

- [ ] **Step 2: 创建 ThemeToggle.vue**

```vue
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
```

- [ ] **Step 3: UserLayout.vue 接入 ThemeToggle**

在 `<script setup>` 的 import 区追加：

```js
import ThemeToggle from "../components/ThemeToggle.vue";
```

在模板中，`<el-dropdown>` 前插入 `<ThemeToggle />`（通知铃铛与头像之间）：

```html
<ThemeToggle />
<el-dropdown trigger="click" @command="handleCommand">
```

- [ ] **Step 4: AdminLayout.vue 接入 ThemeToggle**

在 `<script setup>` 的 import 区追加：

```js
import ThemeToggle from "../components/ThemeToggle.vue";
```

在模板中，`<el-dropdown>` 前插入 `<ThemeToggle />`（返回前台链接与头像之间）：

```html
<ThemeToggle />
<el-dropdown trigger="click" @command="handleCommand">
```

- [ ] **Step 5: 提交**

```bash
git add client/src/composables/useTheme.js client/src/components/ThemeToggle.vue client/src/layouts/UserLayout.vue client/src/layouts/AdminLayout.vue
git commit -m "feat(theme): useTheme composable + ThemeToggle 组件 + 两个 Layout 接入"
```

---

## Task 4: 逐页替换硬编码颜色类（批次 A）

**Files:**
- Modify: `client/src/layouts/UserLayout.vue`
- Modify: `client/src/layouts/AdminLayout.vue`
- Modify: `client/src/views/Dashboard.vue`
- Modify: `client/src/views/TicketList.vue`
- Modify: `client/src/views/TicketDetail.vue`

**替换规则（按 §8 映射）：**
- `text-slate-100` / `text-slate-200` → `text-ink-text`
- `text-slate-300` → `text-ink-text-2`
- `text-slate-400` → `text-ink-text-2`
- `text-slate-500` / `text-slate-600` → `text-ink-text-3`
- `hover:text-slate-100` / `hover:text-slate-200` → `hover:text-ink-text`
- `hover:text-slate-300` → `hover:text-ink-text-2`
- `bg-slate-500` / `bg-slate-600` → `bg-ink-text-3`
- `border-slate-7xx` / `border-slate-8xx` → `border-line`
- `text-primary`（文字/链接语境）→ `text-accent-text`
- `bg-primary/10` → `bg-accent-soft`
- `border-primary/30` → `border-accent-border`

- [ ] **Step 1: UserLayout.vue 替换**

逐处替换（注意 `text-primary` 在 router-link 激活态中是文字色，改为 `text-accent-text`）：

- `text-slate-200`（标题）→ `text-ink-text`
- `text-slate-400 hover:text-slate-200`（nav 链接非激活）→ `text-ink-text-2 hover:text-ink-text`
- `text-primary`（nav 链接激活）→ `text-accent-text`
- `text-slate-300 hover:text-slate-100`（头像区）→ `text-ink-text-2 hover:text-ink-text`

- [ ] **Step 2: AdminLayout.vue 替换**

- `text-slate-200`（标题）→ `text-ink-text`
- `text-slate-400 hover:text-slate-200`（工具包/返回前台链接）→ `text-ink-text-2 hover:text-ink-text`
- `text-slate-300 hover:text-slate-100`（头像区）→ `text-ink-text-2 hover:text-ink-text`
- `el-menu` 的 `text-color="#94a3b8"` → `text-color="var(--text-2)"`；`active-text-color="#fbbf24"` → `active-text-color="var(--accent-text)"`

- [ ] **Step 3: Dashboard.vue 替换**

读取文件后按映射表逐处替换所有 `slate-*` 类及 `text-primary`（文字语境）→ `text-accent-text`，`bg-primary/10` → `bg-accent-soft`。

- [ ] **Step 4: TicketList.vue 替换**

同上，按映射表逐处替换。

- [ ] **Step 5: TicketDetail.vue 替换**

同上，按映射表逐处替换。

- [ ] **Step 6: 提交**

```bash
git add client/src/layouts/UserLayout.vue client/src/layouts/AdminLayout.vue client/src/views/Dashboard.vue client/src/views/TicketList.vue client/src/views/TicketDetail.vue
git commit -m "feat(theme): 替换硬编码颜色类（批次 A：Layout/Dashboard/TicketList/TicketDetail）"
```

---

## Task 5: 逐页替换硬编码颜色类（批次 B）

**Files:**
- Modify: `client/src/views/TicketCreate.vue`
- Modify: `client/src/views/ToolkitList.vue`
- Modify: `client/src/views/ToolkitDetail.vue`
- Modify: `client/src/components/DictManager.vue`
- Modify: `client/src/components/FileUpload.vue`

- [ ] **Step 1: TicketCreate.vue 替换**

按映射表逐处替换所有 `slate-*` 类；`text-primary`（文字）→ `text-accent-text`；`bg-primary/10` → `bg-accent-soft`。

- [ ] **Step 2: ToolkitList.vue 替换**

同上。

- [ ] **Step 3: ToolkitDetail.vue 替换**

同上（MdPreview 主题跟随在 Task 6 处理，此处只替换 Tailwind 颜色类）。

- [ ] **Step 4: DictManager.vue 替换**

同上。

- [ ] **Step 5: FileUpload.vue 替换**

同上。

- [ ] **Step 6: 提交**

```bash
git add client/src/views/TicketCreate.vue client/src/views/ToolkitList.vue client/src/views/ToolkitDetail.vue client/src/components/DictManager.vue client/src/components/FileUpload.vue
git commit -m "feat(theme): 替换硬编码颜色类（批次 B：TicketCreate/Toolkit/DictManager/FileUpload）"
```

---

## Task 6: 逐页替换硬编码颜色类（批次 C）

**Files:**
- Modify: `client/src/views/Login.vue`
- Modify: `client/src/views/Register.vue`
- Modify: `client/src/views/NotFound.vue`
- Modify: `client/src/views/Notifications.vue`
- Modify: `client/src/views/admin/AdminTickets.vue`
- Modify: `client/src/views/admin/AdminUsers.vue`
- Modify: `client/src/components/TicketCard.vue`
- Modify: `client/src/components/CommentItem.vue`

- [ ] **Step 1: Login.vue / Register.vue 替换**

按映射表替换；注意登录/注册页的 `text-primary`（链接/强调文字）→ `text-accent-text`。

- [ ] **Step 2: NotFound.vue / Notifications.vue 替换**

按映射表替换。

- [ ] **Step 3: AdminTickets.vue / AdminUsers.vue 替换**

按映射表替换。

- [ ] **Step 4: TicketCard.vue / CommentItem.vue 替换**

按映射表替换。

- [ ] **Step 5: 提交**

```bash
git add client/src/views/Login.vue client/src/views/Register.vue client/src/views/NotFound.vue client/src/views/Notifications.vue client/src/views/admin/AdminTickets.vue client/src/views/admin/AdminUsers.vue client/src/components/TicketCard.vue client/src/components/CommentItem.vue
git commit -m "feat(theme): 替换硬编码颜色类（批次 C：Login/Register/Notifications/admin/组件）"
```

---

## Task 7: md-editor 主题跟随 + StatusBadge 适配

**Files:**
- Modify: `client/src/components/MarkdownEditor.vue`
- Modify: `client/src/views/ToolkitDetail.vue`

- [ ] **Step 1: MarkdownEditor.vue 主题跟随**

将固定 `theme="'dark'"` / `preview-theme="'dark'"` 改为绑定 `useTheme()`：

```vue
<template>
  <div class="md-wrap">
    <MdEditor
      :model-value="modelValue"
      :theme="theme"
      :preview-theme="theme"
      :code-theme="theme === 'dark' ? 'atom' : 'github'"
      :style="{ height }"
      @update:model-value="(v) => emit('update:modelValue', v)"
      @on-upload-img="onUploadImg"
    />
  </div>
</template>

<script setup>
import { MdEditor } from "md-editor-v3";
import "md-editor-v3/lib/style.css";
import { ElMessage } from "element-plus";
import request from "../api/request";
import { useTheme } from "../composables/useTheme";

const { theme } = useTheme();

defineProps({
  modelValue: { type: String, default: "" },
  height: { type: String, default: "420px" },
});

const emit = defineEmits(["update:modelValue"]);

async function onUploadImg(files, callback) {
  const urls = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const data = await request.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const name = String(data.filePath).replace(/\\/g, "/").split("/").pop();
      const url = `/uploads/${name}`;
      urls.push({ url, alt: file.name, title: file.name });
    } catch (error) {
      ElMessage.error(`${file.name} 上传失败`);
    }
  }
  callback(urls);
}
</script>

<style scoped>
.md-wrap :deep(.md-editor) {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  background: var(--surface);
}
.md-wrap :deep(.md-editor-content) {
  background: var(--surface);
}
</style>
```

- [ ] **Step 2: ToolkitDetail.vue MdPreview 主题跟随**

在 `<script setup>` 中引入 `useTheme`：

```js
import { useTheme } from "../composables/useTheme";
const { theme } = useTheme();
```

将模板中 `<MdPreview ... theme="dark" preview-theme="dark" code-theme="atom" />` 改为：

```html
<MdPreview :model-value="pkg.docMarkdown" :theme="theme" :preview-theme="theme" :code-theme="theme === 'dark' ? 'atom' : 'github'" />
```

- [ ] **Step 3: 提交**

```bash
git add client/src/components/MarkdownEditor.vue client/src/views/ToolkitDetail.vue
git commit -m "feat(theme): md-editor 主题跟随 + StatusBadge 适配"
```

---

## Task 8: 构建验证

**Files:** 无新建，验证全前端

- [ ] **Step 1: 运行构建**

```bash
cd client
npm run build
```

Expected: `✓ built in ...` 无错误。

- [ ] **Step 2: 检查构建输出中是否有 Tailwind 透明度修饰符警告**

构建输出中不应出现 `bg-primary/10` 等无效类（已在 Task 4-6 中替换为 `bg-accent-soft`）。如有遗漏，补充替换后重新构建。

- [ ] **Step 3: 如有修复则提交**

```bash
git add -A
git commit -m "fix(theme): 构建验证修复"
```

- [ ] **Step 4: 端到端自测清单（手动）**

启动开发服务器后逐项核对：

- [ ] 暗色主题：与改造前观感一致，无回归
- [ ] 浅色主题：白底、信号橙、网格背景保留
- [ ] 顶栏切换按钮（前台/后台）可切换主题
- [ ] 刷新后主题记忆（localStorage）
- [ ] 首屏无闪烁（直接刷新浅色页面）
- [ ] 登录页 Chrome autofill 两主题均正常
- [ ] 弹层/对话框/下拉/分页/表格两主题可读
- [ ] Markdown 编辑/预览随主题切换
- [ ] 状态徽章（StatusBadge）两主题可读
