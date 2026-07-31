# 工具包模块 + 客户看板 实现计划

- 日期：2026-07-30
- 状态：已完成（回溯整理）
- 设计文档：[2026-07-30-toolkit-customer-dashboard-design.md](../specs/2026-07-30-toolkit-customer-dashboard-design.md)

> 本计划为**回溯整理**：功能已实现并合入 `main`，此处按实际提交序列还原实现步骤，便于后续维护与回顾。每个 Task 标注对应 commit。

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `server/src/models/ToolDict.js` | 字典模型（省份 / 分类，`(type,code)` 唯一） |
| `server/src/models/ToolPackage.js` | 工具包主表（含 `docMarkdown`、`currentVersionId`） |
| `server/src/models/ToolPackageVersion.js` | 版本表（`(package_id,version)` 唯一） |
| `server/src/models/index.js` | 注册三者关联 |
| `server/src/services/seedToolkitDicts.js` | 字典种子（启动时幂等写入） |
| `server/src/middleware/roles.js` | 角色守卫（`MAINTAINER_ROLES`） |
| `server/src/controllers/toolkitDictController.js` | 字典 CRUD（删除前引用校验） |
| `server/src/controllers/toolkitController.js` | 工具包 CRUD + 上下架 + 列表筛选分页 |
| `server/src/controllers/toolkitVersionController.js` | 发版 + 历史 + 下载流 |
| `server/src/routes/toolkit.js` | `/api/toolkit/*` 路由装配 |
| `client/src/api/toolkit.js` | 工具包接口封装 |
| `client/src/components/MarkdownEditor.vue` | md-editor-v3 封装（含图片上传回调） |
| `client/src/components/DictManager.vue` | 字典管理弹窗 |
| `client/src/views/ToolkitList.vue` | 列表页（筛选 + 卡片网格 + 新建/编辑） |
| `client/src/views/ToolkitDetail.vue` | 详情页（说明渲染 + 信息卡 + 版本历史 + 下载） |
| `client/src/layouts/UserLayout.vue` | 导航「工具包」「看板」入口放开 |
| `client/src/views/Dashboard.vue` | 移除客户拦截 |

---

## Task 1：数据模型 + 字典种子（commit `0d04693`）

- [x] 新建 `ToolDict` / `ToolPackage` / `ToolPackageVersion` 三个模型，字段驼峰、列名 snake_case。
- [x] `models/index.js` 注册关联：`hasMany` 版本、`belongsTo` currentVersion / province / category / creator。
- [x] 新建 `seedToolkitDicts.js`，服务启动时幂等写入种子（province=安徽/江苏，category=油猴脚本）。
- [x] `server.js` 启动流程接入 `seedToolkitDicts()`。

## Task 2：字典接口 + 角色守卫（commit `4d4c907`）

- [x] `middleware/roles.js` 抽 `MAINTAINER_ROLES = ["developer","dev_lead","admin"]` 守卫。
- [x] `toolkitDictController`：`GET /dicts`（全员）、`POST/PUT/DELETE`（维护者）。
- [x] 删除前校验：仍有工具包引用该字典项则返回 409。

## Task 3：工具包与版本接口（commit `fc440bf`）

- [x] `toolkitController`：列表（省份/分类/关键词筛选 + 分页，仅上架）、详情（含 currentVersion 与字典名）、新建、编辑、上下架 `toggle`。
- [x] `toolkitVersionController`：发版（回写 `currentVersionId`）、历史列表（`createdAt DESC`）、下载流（`Content-Disposition: attachment`）。
- [x] `routes/toolkit.js` 装配，挂载 `auth`，维护者接口加角色守卫。

## Task 4：允许上传 .js 脚本（commit `02b4fe7`）

- [x] 上传接口文件类型白名单新增 `.js`，供版本脚本文件上传复用现有 `/api/upload`。

## Task 5：Markdown 编辑器封装（commit `51d99e6`）

- [x] 前端安装 `md-editor-v3`。
- [x] 封装 `MarkdownEditor.vue`：工具栏 + 实时预览 + 代码高亮。
- [x] `onUploadImg` 回调调用 `/api/upload`，取得 url 后 `callback([url])` 插入文档。

## Task 6：列表页 + 字典管理（commit `86f0216`）

- [x] `ToolkitList.vue`：省份/分类下拉 + 关键词防抖筛选 + 响应式卡片网格（名称/标签/最新版本号/更新时间/简介）。
- [x] 维护者右上「新建工具包」「管理省份/分类」。
- [x] `DictManager.vue` 轻量弹窗，按 type 维护字典增删改。
- [x] 新建/编辑表单中说明文档使用 Markdown 编辑器。

## Task 7：详情页（commit `c369f38`）

- [x] `ToolkitDetail.vue`：Markdown 说明渲染（图片 + 代码高亮）。
- [x] 信息卡（省份/分类/最新版本/更新时间/下载按钮）+ 版本历史列表（含旧版下载）。
- [x] 维护者操作：发布新版本、编辑信息与说明、上架/下架。

## Task 8：路由与导航入口（commit `38c0421`）

- [x] 路由 `/toolkit`、`/toolkit/:id`（全员）。
- [x] `UserLayout` 顶栏新增「工具包」入口，所有登录用户可见。

## Task 9：客户看板放开（commit `7641e88`）

- [x] `UserLayout` 导航「看板」入口移除 `isInternal` 限制。
- [x] `Dashboard.vue` 移除「非内部角色 `router.replace('/')`」拦截。
- [x] 核对 `stats`：客户返回「我创建的」，内部返回「分配给我的」。

## Task 10：修复收尾

- [x] 说明文档图片上传后回填 url（commit `0ab77c9`）。
- [x] 修复 `sync` 重复追加唯一索引导致启动失败（commit `67fd455`）。

---

## 验证

- [x] 后端启动正常，字典种子幂等写入。
- [x] 全员可浏览/下载工具包；维护者可新建/发版/编辑/上下架/维护字典。
- [x] 客户可进入看板查看「我创建的」工单统计。
- [x] 前端构建通过。

## 提交序列

```
9bf5179 docs(spec): 新增工具包模块与客户看板设计文档
0d04693 feat(toolkit): 新增工具包数据模型与字典种子
4d4c907 feat(toolkit): 字典接口与角色守卫
fc440bf feat(toolkit): 工具包与版本接口
02b4fe7 feat(upload): 允许上传 .js 脚本文件
51d99e6 feat(toolkit): 引入 md-editor-v3 并封装 Markdown 编辑器
86f0216 feat(toolkit): 工具包列表页与字典管理
c369f38 feat(toolkit): 工具包详情页
38c0421 feat(toolkit): 路由与导航入口
7641e88 feat(dashboard): 对客户开放工单看板
0ab77c9 fix(toolkit): 修正说明文档图片上传回填 url
67fd455 fix(models): 修复 sync 重复追加唯一索引导致启动失败
```
