# 主题明暗切换 · 设计文档

- 日期：2026-07-30
- 状态：已确认，待实现
- 方案：A · CSS 变量双主题 + 语义化 Tailwind token

## 1. 背景与目标

当前系统为全站固定暗色主题（"工程操作台 · 方案 C · 信号橙"），由 `client/src/styles/theme.css` 的一整套 `--*` CSS 变量 + Element Plus `--el-*` 覆盖驱动。但仍有大量颜色写死：

- 18 个 `.vue` 文件中共 117 处写死的 Tailwind 颜色类（`text-slate-*` / `bg-slate-*` / `border-slate-*`）。
- `theme.css` 内部若干写死的 `rgba(...)`（输入框底、autofill hack、按钮色等）。
- `tailwind.config.js` 的语义色（`ink/surface/line/ink-text/st-*`）目前是写死的暗色值，未接 CSS 变量。
- `md-editor-v3`（说明文档编辑/预览）固定暗色主题。

目标：新增**明暗主题切换**，用户可手动切换并记忆；浅色模式为"白底工程操作台"风格（保留信号橙强调色与网格/等宽数字等工程元素）。

## 2. 已确认的设计决策

| 决策项 | 结论 |
|---|---|
| 浅色视觉方向 | 工程操作台·浅色版：**白底**、保留信号橙、保留网格与等宽数字 |
| 默认主题 | 暗色（保持现状体验） |
| 记忆策略 | 记住用户上次选择（`localStorage`），手动切换后持久生效 |
| 技术路线 | 方案 A：CSS 变量双主题 + 语义化 Tailwind token |

## 3. 切换机制

- 根节点挂 `data-theme="dark" | "light"`，全部主题差异由 CSS 变量驱动。
- 新增 `src/composables/useTheme.js`（模块级单例 `ref`，跨组件共享）：
  - 暴露 `theme`（只读 ref）、`toggle()`、`setTheme(t)`。
  - 初始化：读 `localStorage.theme`；非法或缺失则回退 `dark`。
  - 变更：写回 `localStorage` 并同步 `document.documentElement.dataset.theme`。
- `index.html` `<head>` 内联脚本在 Vue 挂载前设置 `data-theme`，**避免首屏闪烁**（缺省暗色）。现有 `<html class="dark">` 与本次机制无关（未使用 Tailwind `dark:` 变体），可保留或移除，不影响。

## 4. 浅色配色方案

| 变量 | 暗色（现状） | 浅色（新增） | 说明 |
|---|---|---|---|
| `--ink` | `#0b1120` | `#f4f6fa` | 页面底 |
| `--surface` | `#121a2b` | `#ffffff` | 面板（白底） |
| `--surface-2` | `#1a2438` | `#f8fafc` | 次级面板 / 弹层 |
| `--line` | `rgba(148,163,184,.14)` | `rgba(15,23,42,.08)` | 边框 |
| `--line-strong` | `rgba(148,163,184,.24)` | `rgba(15,23,42,.16)` | 强边框 |
| `--text` | `#e6edf6` | `#0f172a` | 主文本 |
| `--text-2` | `#9aa7bc` | `#475569` | 次级文本 |
| `--text-3` | `#5c6b82` | `#94a3b8` | 弱化文本 |
| `--accent`（填充） | `#fbbf24` | `#f59e0b` | 按钮/圆点/边框等填充 |
| `--accent-text`（文字） | `#fbbf24` | `#b45309` | 文字/链接/图标（见 §5） |
| `--st-pending` | `#f59e0b` | `#d97706` | 状态色浅色下整体调深一档 |
| `--st-processing` | `#38bdf8` | `#0284c7` | 同上 |
| `--st-resolved` | `#34d399` | `#059669` | 同上 |
| `--st-closed` | `#64748b` | `#64748b` | 不变 |
| `--grid-bg` | 亮线 + 琥珀微光 | 淡线 `rgba(15,23,42,.04)` + 更淡琥珀微光 | 网格背景 |
| `--shadow-panel/pop` | 重阴影 | 轻阴影 `rgba(15,23,42,.08~.12)` | 阴影 |

> 具体数值在实现时按观感微调，以"白底、信号橙、工程感"为准。

## 5. 两个必须处理的技术点

### 5.1 强调色对比度（填充橙 vs 文字橙）

亮色 `#fbbf24` 作按钮**填充**（配深色文字 `#1a1204`）没问题，但作**文字/链接**放在白底上对比度不足。因此拆成两个变量：

- `--accent`：填充用（按钮底、圆点、边框、tint 基色）。
- `--accent-text`：文字/链接/激活态文本用。暗色两者同值 `#fbbf24`；浅色 `--accent-text` 取更深的 `#b45309` 保证白底可读。

`theme.css` 中所有"把 accent 当文字色"的地方（如 `.btn-ghost:hover{color:var(--accent)}`、`.el-menu` 激活色、下拉选中色等）改用 `var(--accent-text)`。

### 5.2 Tailwind 透明度修饰符不能直接作用于 `var()`

代码中存在 `bg-primary/10`、`border-primary/30` 这类写法。Tailwind 对 `var(--x)` 形式的颜色**无法**叠加 `/10` 透明度（会生成无效的 `rgb(var(--x)/0.1)`）。解决：改用专门的 alpha 变量，避免在 var 上叠透明度：

- 已有 `--accent-soft: rgba(251,191,36,.1)` → 新增 token `accent-soft`，映射 `bg-primary/10 → bg-accent-soft`。
- 新增 `--accent-border: rgba(251,191,36,.35)`（浅色下相应调整）→ token `accent-border`，映射 `border-primary/30 → border-accent-border`。
- 其余 `bg-primary`（实色）、`text-primary` 正常映射（`text-primary → text-accent-text`）。

实现时如再发现其他透明度修饰符写法，按同样思路补 alpha 变量。

## 6. theme.css 重构

- 现有暗色变量整体移入 `:root[data-theme="dark"]`；`:root` 保留一份暗色默认值作为无 JS/未设属性时的兜底。
- 新增 `:root[data-theme="light"]` 浅色变量集（§4）。
- Element Plus `--el-*` 覆盖同样拆成暗/浅两套（浅色用白底、深色文字、浅边框、琥珀主色）。
- 写死的 `rgba(11,17,32,…)`（输入框底、上传拖拽区、加载遮罩等）改为引用变量或分主题给出浅色值。
- autofill hack 的 `inset` 阴影色 `rgba(11,17,32,.6)` 在浅色下改为接近白的 `rgba(255,255,255,.9)`（分主题）。
- 主按钮 `.el-button--primary` 的深色文字 `#1a1204` 两套通用，保留。

## 7. tailwind.config.js 语义 token

将现有写死的语义色改为引用 CSS 变量（token 名沿用，便于替换）：

```
primary / accent      -> var(--accent)
accent-text(新增)     -> var(--accent-text)
accent-soft(新增)     -> var(--accent-soft)
accent-border(新增)   -> var(--accent-border)
ink                   -> var(--ink)
surface / surface.2   -> var(--surface) / var(--surface-2)
line / line.strong    -> var(--line) / var(--line-strong)
ink-text / -2 / -3    -> var(--text) / var(--text-2) / var(--text-3)
st-pending/processing/resolved/closed -> var(--st-*)
```

> 说明：`ink-text` 系列名称偏暗色语义，浅色下含义为"主文本色"，仅变量值随主题变化，token 名不变以减少改动。

## 8. 硬编码颜色类替换映射（18 文件 / 117 处）

| 原类 | 替换为 | 语义 |
|---|---|---|
| `text-slate-100` / `text-slate-200` | `text-ink-text` | 标题 / 强文本 |
| `text-slate-300` | `text-ink-text-2`（个别正文用 `text-ink-text`） | 正文 / 次强 |
| `text-slate-400` | `text-ink-text-2` | 次级文本 |
| `text-slate-500` / `text-slate-600` | `text-ink-text-3` | 弱化 / 图标 / 标签 |
| `hover:text-slate-100/200` | `hover:text-ink-text` | 悬停提亮 |
| `hover:text-slate-300` | `hover:text-ink-text-2` | 悬停 |
| `bg-slate-500` / `bg-slate-600`（圆点） | `bg-ink-text-3` | 中性圆点 |
| `border-slate-7xx/8xx` | `border-line` | 边框 |
| `text-primary`（文字/链接） | `text-accent-text` | 强调文字 |
| `bg-primary/10` | `bg-accent-soft` | 强调浅底 |
| `border-primary/30` | `border-accent-border` | 强调边框 |
| `bg-primary`（实色） | 保持 `bg-primary`（已 var 化） | 强调填充 |

逐处按上下文语义替换；`text-slate-300` 等少数需结合语境判断归 `ink-text` 还是 `ink-text-2`。

## 9. 组件适配

- **MarkdownEditor.vue / ToolkitDetail.vue**：`MdEditor` / `MdPreview` 的 `theme`、`preview-theme` 属性绑定 `useTheme()` 的当前主题（`dark`/`light`），随切换响应。
- **StatusBadge.vue**：文字色已用 `var(--st-*)`（随主题变），边框/底的半透明 tint 在两主题下均可用；浅色下如观感偏淡再微调。
- **ThemeToggle 组件（新增）**：太阳/月亮图标按钮，调用 `useTheme().toggle()`；放入 `UserLayout` 顶栏（通知铃铛旁）与 `AdminLayout` 顶栏（返回前台旁）。

## 10. 实现拆分（每步单独 commit）

1. `theme.css` 双主题变量重构（暗/浅两套 + Element Plus 双套 + 写死值变量化 + accent 双变量 + alpha 变量）。
2. `tailwind.config.js` 语义 token 接变量 + `index.html` 防闪烁脚本。
3. `useTheme` composable + `ThemeToggle` 组件 + 两个 Layout 接入。
4. 逐页替换硬编码颜色类（18 文件，分 2~3 批，按 §8 映射）。
5. `md-editor` 主题跟随 + `StatusBadge` 等组件适配。
6. 构建验证 + 明暗双主题端到端自测（登录页 autofill、弹层、表格、Markdown 预览、状态徽章在各主题下核对）。

## 11. 验证要点

- `npm run build` 通过，无 Tailwind 透明度修饰符失效导致的样式异常。
- 暗色主题：与改造前观感一致（无回归）。
- 浅色主题：白底、信号橙、网格/等宽数字保留；正文/标题/边框/弹层/表格/输入框/下拉/分页/对话框/消息提示均可读协调。
- 切换：前后台顶栏按钮可切换；刷新后记忆；首屏无闪烁。
- Markdown 编辑/预览随主题切换。
- 登录/注册页 Chrome autofill 在两主题下均正常。

## 12. 风险与备注

- 改动面广（全前端），需逐页核对，建议分批提交、分批自测。
- 浅色具体色值为初稿，以最终观感微调为准。
- 不引入新依赖；`md-editor-v3` 原生支持 `theme` 属性。
- 后端无改动。
