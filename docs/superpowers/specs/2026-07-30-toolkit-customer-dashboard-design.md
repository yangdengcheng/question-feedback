# 工具包模块 + 客户看板 设计文档

- 日期：2026-07-30
- 状态：已评审，待实现
- 关联系统：问题反馈工单系统（Vue 3 + Element Plus + Node/Express + Sequelize + MySQL，暗色"工程操作台"主题，方案 C 信号橙）

## 1. 背景与目标

系统当前已具备工单创建/流转/转交/评论/附件/看板/通知/在线状态等能力，但存在两块缺口：

1. **客户没有看板**：现有看板入口仅对内部角色开放，客户对自己提交的工单缺少概览视图。
2. **缺少工具包分发能力**：团队按省份维护一批油猴脚本（.js）工具包，需要让所有用户在线浏览、查看说明、下载，并由系统开发持续更新、沉淀使用说明。

本设计目标：

- 为客户开放"我创建的工单"看板，形态与内部看板对称。
- 新增"工具包"模块：按省份 + 分类组织，支持版本化更新、在线 Markdown 说明文档（含图片）、全员浏览下载、维护者管理。

## 2. 范围与非目标（YAGNI）

**范围内**

- 客户看板（复用现有 stats 接口，放开入口与拦截）。
- 工具包：主表 + 版本表 + 字典表（省份/分类）；列表/详情/下载/版本历史；维护者 CRUD 与上下架；在线 Markdown 说明（含图片上传）。

**非目标（明确不做）**

- 工具包硬删除：仅做"下架"（`is_active=false`），避免误删历史版本。
- 图片资源级联清理：说明文档图片以 url 引用，删除工具包不清理孤儿图片。
- 工具包文件复用 Attachment 表：版本文件信息存版本表自身，保持工单附件语义干净。
- 多文件/压缩包工具包：每个版本仅单个 .js 文件。
- 省份/分类的复杂管理页：字典用轻量弹窗维护，不单独成页。
- 工具包评价/下载量统计/订阅更新通知：本期不做。

## 3. 角色与权限

- **查看 / 下载 / 查看说明**：所有登录用户（含 `customer`）。
- **维护者**（新建工具包、发布版本、编辑信息与说明、上下架、维护字典）：`developer` / `dev_lead` / `admin`。
  - 实现上抽常量 `MAINTAINER_ROLES = ["developer","dev_lead","admin"]`，沿用现有"角色数组 + `req.user.role`"判断方式（参考 `ticketController.listAssignees` 的 `INTERNAL_ROLES` 写法）。
- 字典项删除前校验：若仍有工具包引用该字典项，则拒绝删除并提示。

## 4. 数据模型

沿用现有 Sequelize 约定：字段驼峰、列名 snake_case（`field`）、在 `models/index.js` 注册关联。

### 4.1 tool_dict（省份 + 分类统一字典）

| 字段                  | 类型                        | 说明                                    |
| --------------------- | --------------------------- | --------------------------------------- |
| id                    | INT PK                      | 自增                                    |
| type                  | ENUM(`province`,`category`) | 字典类别                                |
| code                  | STRING                      | 业务编码（如 `anhui` / `tampermonkey`） |
| name                  | STRING                      | 显示名（如 安徽 / 油猴脚本）            |
| sort                  | INT                         | 排序，默认 0                            |
| isActive              | BOOLEAN                     | 是否启用，默认 true，列 `is_active`     |
| createdAt / updatedAt | DATE                        | —                                       |

约束：`(type, code)` 唯一。
种子数据：province=安徽、江苏；category=油猴脚本（sync 后初始化，已存在则跳过）。

### 4.2 tool_package（工具包主表）

| 字段                  | 类型                        | 说明                                        |
| --------------------- | --------------------------- | ------------------------------------------- |
| id                    | INT PK                      | 自增                                        |
| name                  | STRING                      | 工具包名称                                  |
| provinceId            | INT FK→tool_dict            | 省份                                        |
| categoryId            | INT FK→tool_dict            | 分类                                        |
| summary               | STRING                      | 一句话简介，可空                            |
| docMarkdown           | LONGTEXT                    | 说明文档 Markdown，列 `doc_markdown`        |
| isActive              | BOOLEAN                     | 上下架，默认 true，列 `is_active`           |
| currentVersionId      | INT FK→tool_package_version | 冗余最新版本，可空，列 `current_version_id` |
| createdBy             | INT FK→user                 | 创建人，列 `created_by`                     |
| createdAt / updatedAt | DATE                        | —                                           |

说明：`docMarkdown` 中图片以 url 引用现有上传资源，不另建图片关联表。

### 4.3 tool_package_version（版本表）

| 字段        | 类型                | 说明                        |
| ----------- | ------------------- | --------------------------- |
| id          | INT PK              | 自增                        |
| packageId   | INT FK→tool_package | 所属工具包，列 `package_id` |
| version     | STRING              | 版本号字符串（如 `1.2.0`）  |
| releaseNote | TEXT                | 更新说明，列 `release_note` |
| fileUrl     | STRING              | 脚本文件 url，列 `file_url` |
| fileName    | STRING              | 原始文件名，列 `file_name`  |
| fileSize    | INT                 | 字节数，列 `file_size`      |
| createdBy   | INT FK→user         | 发布人，列 `created_by`     |
| createdAt   | DATE                | 发布时间                    |

约束：`(package_id, version)` 唯一。
发布新版本时回写 `tool_package.currentVersionId`。

### 4.4 关联

- `ToolPackage.hasMany(ToolPackageVersion, { foreignKey: "packageId" })`
- `ToolPackage.belongsTo(ToolPackageVersion, { as: "currentVersion", foreignKey: "currentVersionId" })`
- `ToolPackage.belongsTo(ToolDict, { as: "province", foreignKey: "provinceId" })`
- `ToolPackage.belongsTo(ToolDict, { as: "category", foreignKey: "categoryId" })`
- `ToolPackage.belongsTo(User, { as: "creator", foreignKey: "createdBy" })`
- `ToolPackageVersion.belongsTo(User, { as: "creator", foreignKey: "createdBy" })`

## 5. REST 接口

全部位于 `/api/toolkit/*`，挂载 `auth` 中间件。维护者接口在控制器内校验 `MAINTAINER_ROLES`。

字典：

- `GET /dicts?type=province|category`（全员）
- `POST /dicts`（维护者）body `{ type, code, name, sort }`
- `PUT /dicts/:id`（维护者）
- `DELETE /dicts/:id`（维护者；有引用则 409 拒绝）

工具包：

- `GET /packages?provinceId&categoryId&keyword&page&pageSize`（全员，分页；列表统一仅返回 `isActive=true` 的上架工具包，维护者视图一致；下架项不进入列表）
- `GET /packages/:id`（全员；含 `currentVersion`、省份/分类名、`docMarkdown`；下架项仅维护者可看详情）
- `POST /packages`（维护者）body `{ name, provinceId, categoryId, summary, docMarkdown }`
- `PUT /packages/:id`（维护者；编辑信息 + 说明）
- `PUT /packages/:id/toggle`（维护者；切换 `isActive`）

版本：

- `GET /packages/:id/versions`（全员；历史列表，按 `createdAt DESC`）
- `POST /packages/:id/versions`（维护者）body `{ version, releaseNote, fileUrl, fileName, fileSize }`（文件先经现有 `/api/upload` 上传取得 url）
- `GET /versions/:vid/download`（全员；读 `fileUrl` 对应文件，流式响应 + `Content-Disposition: attachment` 强制下载）

## 6. 前端

### 6.1 路由与导航

- `/toolkit` → `ToolkitList.vue`（全员）
- `/toolkit/:id` → `ToolkitDetail.vue`（全员）
- 导航：`UserLayout` 顶栏新增「工具包」入口，所有登录用户可见。`AdminLayout` 顶栏若具备公共导航区则同步加入口，便于后台内直达（实现时视顶栏结构定）。

### 6.2 列表页 ToolkitList.vue

- 顶部筛选：省份下拉 + 分类下拉 + 关键词输入（防抖）；维护者右上「新建工具包」「管理省份/分类」（轻量 `el-dialog` 弹窗，内含字典的增删改列表，按 type 分两个 tab 或两段）。
- 主体：卡片网格（响应式列数）。卡片内容=名称 + 省份标签 + 分类标签 + 最新版本号（`tnum`）+ 更新时间（`tnum`）+ 一句话简介；整卡可点进详情，悬停 `panel-hover`。
- 空态：复用工程操作台空态样式。

### 6.3 详情页 ToolkitDetail.vue

- 说明文档区：Markdown 渲染（含图片 + 代码块高亮）。
- 信息卡：省份 / 分类 / 最新版本号 / 更新时间 / 下载按钮（`btn-accent`，调 download 接口）。
- 版本历史列表：版本号 + 更新说明 + 发布日期 + 下载旧版链接。
- 维护者操作（`v-if isMaintainer`）：「发布新版本」「编辑信息与说明」「上架/下架」。
- 编辑/新建/发版表单中，说明文档使用 Markdown 编辑器。

### 6.4 Markdown 编辑器

- 引入 `md-editor-v3`（Vue 3，工具栏 + 实时预览 + 代码高亮 + 图片上传回调）。
- 图片上传回调 `onUploadImg(files, callback)` 内调用现有 `/api/upload`，取得 url 后 `callback([url])` 插入文档，**无需新增上传接口**。
- 查看侧使用同一组件的预览模式（或 `MdPreview`）。

### 6.5 设计系统复用

- 全部沿用 `theme.css` 的 `panel / panel-accent / panel-hover / btn-accent / btn-ghost / tnum / panel-title`，状态色与 Element Plus 琥珀主题变量，**不另起风格**。
- 表单/弹窗/表格/分页自动继承 Element Plus 琥珀主题覆盖。

## 7. 客户看板

现有 `ticketController.stats` 已按角色区分统计范围（内部=分配给我，客户=我创建的），后端基本就绪。改动：

1. `UserLayout` 导航「看板」入口对客户放开（移除 `isInternal` 限制，所有登录用户可见）。
2. `Dashboard.vue` 移除"非内部角色则 `router.replace('/')`"的拦截。
3. 实现时核对 `stats` 的 `recent` 列表：客户应返回"我创建的"工单，内部返回"分配给我的"工单；如不一致则修正控制器分支。
4. 展示形态与内部看板对称：状态卡片 + 最近工单列表。

## 8. 依赖变更

- 前端 `package.json` 新增 `md-editor-v3`。
- 无后端新依赖。

## 9. 实现拆分建议（粗粒度，供实现计划细化）

1. 后端模型 + 关联 + 字典种子 + 数据库迁移。
2. 后端字典接口 + 维护者校验。
3. 后端工具包接口（CRUD + 上下架 + 列表筛选分页）。
4. 后端版本接口（发版 + 历史 + 下载流）。
5. 前端依赖安装 + Markdown 编辑器封装。
6. 前端列表页 + 字典管理弹窗 + 新建/编辑表单。
7. 前端详情页 + 发版表单 + 下载 + 版本历史。
8. 导航入口 + 路由。
9. 客户看板放开（导航 + Dashboard 拦截 + stats 核对）。
10. 构建验证 + 端到端自测。

每个逻辑单元完成后单独 commit，保持 git 历史清晰。

## 10. 风险与开放项

- 无未决开放项，关键分叉（版本历史、省份/分类可配置、单 js 文件、Markdown 含图片、卡片+详情架构、维护权限、全员可下载）均已确认。
- 风险点：`md-editor-v3` 体积与暗色主题适配——实现时确认其暗色样式与工程操作台协调，必要时局部覆盖。
