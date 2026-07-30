# 问题反馈工单系统 — 设计文档

> 日期：2026-07-30
> 状态：已确认

## 1. 项目概述

### 背景

团队当前通过微信群收集用户反馈的系统问题和缺陷，存在信息分散、难以追踪、无法闭环等问题。需要一个结构化的 Web 工单系统来替代。

### 目标

- 用户（内部团队 + 外部客户）可以方便地提交问题反馈
- 开发人员可以在工单内与用户进行讨论，形成闭环
- 管理员可以分配工单、管理通知规则
- 站内通知替代邮件/微信群，所有沟通集中在系统内

### 核心原则

- **提交极简**：用户登录后 30 秒内完成工单提交
- **讨论即沟通**：工单详情页就是沟通现场，无需切换工具
- **状态驱动**：状态变更自动通知，用户无需反复追问
- **管理轻量**：管理员核心操作不超过三个

## 2. 技术架构

### 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端 | Vue 3 + Vite + Element Plus + TailwindCSS |
| 后端 | Node.js + Express |
| 数据库 | MySQL |
| 认证 | JWT |
| 附件存储 | 服务器本地磁盘（uploads/ 目录） |

### 架构图

```
┌─────────────────────────────────────────────────┐
│              浏览器（内网访问）                     │
│     Vue 3 + Vite + Element Plus + TailwindCSS   │
└──────────────────────┬──────────────────────────┘
                       │ REST API + JWT
┌──────────────────────▼──────────────────────────┐
│              Node.js + Express                   │
│  ┌──────────┬──────────┬─────────────────────┐  │
│  │ 用户认证  │ 工单管理  │ 站内通知             │  │
│  │ JWT      │ CRUD     │ 未读/已读/轮询        │  │
│  └──────────┴──────────┴─────────────────────┘  │
│  ┌──────────┬──────────┬─────────────────────┐  │
│  │ 工单讨论  │ 附件上传  │ 通知规则管理         │  │
│  │ 评论回复  │ 本地磁盘  │ 动态配置             │  │
│  └──────────┴──────────┴─────────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                    MySQL                         │
│  users / tickets / comments / notifications     │
│  attachments / notify_rules                     │
└─────────────────────────────────────────────────┘
```

### 部署方式

- 内网部署，前后端可部署在同一服务器
- 前端构建为静态文件，由 Express 静态服务或 Nginx 托管
- 后端单进程运行，PM2 管理

## 3. 数据模型

### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| username | VARCHAR(50) UNIQUE | 登录名 |
| password_hash | VARCHAR(255) | bcrypt 加密密码 |
| real_name | VARCHAR(50) | 姓名 |
| email | VARCHAR(100) | 邮箱（展示用） |
| role | ENUM('user','admin') | 角色，默认 user |
| is_active | BOOLEAN DEFAULT TRUE | 是否启用 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### tickets（工单表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| ticket_no | VARCHAR(20) UNIQUE | 工单编号，格式 FB-YYYYMMDD-NNN |
| title | VARCHAR(200) | 标题 |
| description | TEXT | 详细描述 |
| type | ENUM('bug','question','suggestion') | 类型 |
| status | ENUM('pending','processing','resolved','closed') | 状态，默认 pending |
| priority | ENUM('low','medium','high') | 优先级，默认 medium |
| user_id | INT FK → users.id | 提交人 |
| assignee_id | INT FK → users.id NULL | 处理人（管理员分配） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### comments（工单讨论）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| ticket_id | INT FK → tickets.id | 所属工单 |
| user_id | INT FK → users.id | 评论人 |
| content | TEXT | 评论内容 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### attachments（附件）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| ticket_id | INT FK → tickets.id | 关联工单 |
| comment_id | INT FK → comments.id NULL | 关联评论（空=工单级附件） |
| file_name | VARCHAR(255) | 原始文件名 |
| file_path | VARCHAR(500) | 服务器存储路径 |
| file_size | INT | 文件大小（字节） |
| file_type | VARCHAR(100) | MIME 类型 |
| uploaded_by | INT FK → users.id | 上传人 |
| created_at | DATETIME | 创建时间 |

### notifications（站内通知）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| user_id | INT FK → users.id | 接收人 |
| ticket_id | INT FK → tickets.id | 关联工单 |
| type | ENUM('new_ticket','new_comment','status_change','assigned') | 通知类型 |
| content | VARCHAR(500) | 通知摘要文本 |
| is_read | BOOLEAN DEFAULT FALSE | 是否已读 |
| created_at | DATETIME | 创建时间 |
| read_at | DATETIME NULL | 阅读时间 |

### notify_rules（通知规则）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| user_id | INT FK → users.id | 被通知的开发/管理员 |
| ticket_type | ENUM('bug','question','suggestion') NULL | 关注的工单类型（空=全部） |
| is_active | BOOLEAN DEFAULT TRUE | 是否启用 |
| created_at | DATETIME | 创建时间 |

## 4. 交互流程

### 工单生命周期

```
pending（待处理）──管理员分配──→ processing（处理中）
                                    │
                              开发标记解决
                                    ▼
                             resolved（已解决）
                                    │
                         用户确认 ──→ closed（已关闭）
                         用户不满意 ──→ processing（重新打开）
```

### 用户侧流程

1. 注册/登录
2. 首页查看「我的工单」列表（按更新时间倒序）
3. 点击「新建工单」→ 填写标题、类型、优先级、描述、可选附件 → 提交
4. 提交成功 → 显示工单编号 → 跳转工单详情页
5. 在工单详情页的讨论区与开发来回沟通
6. 状态变为 resolved 后 → 用户点击「确认解决」关闭工单，或继续评论重新打开

### 管理员侧流程

1. 登录（admin 角色）
2. 管理后台 → 工单列表（按状态筛选、排序）
3. 分配处理人 → 自动通知该开发
4. 变更工单状态
5. 配置通知规则（哪些开发接收哪类工单的通知）
6. 管理用户（启用/禁用）

### 通知触发规则

| 事件 | 通知对象 |
|------|----------|
| 新工单提交 | notify_rules 中匹配的开发/管理员 |
| 分配处理人 | 被分配的开发 |
| 新评论 | 工单提交者 + 处理人（排除评论者自己） |
| 状态变更 | 工单提交者 |

## 5. 页面结构

### 路由

| 路径 | 页面 | 权限 |
|------|------|------|
| /login | 登录页 | 公开 |
| /register | 注册页 | 公开 |
| / | 首页（我的工单列表） | 登录用户 |
| /tickets/new | 新建工单 | 登录用户 |
| /tickets/:id | 工单详情 + 讨论区 | 登录用户（本人或管理员） |
| /notifications | 通知中心 | 登录用户 |
| /admin/tickets | 全部工单管理 | admin |
| /admin/notify-rules | 通知规则配置 | admin |
| /admin/users | 用户管理 | admin |

### 布局

- **用户侧**：顶部导航栏（Logo + 系统名 | 工单 / 通知(未读角标) | 用户下拉菜单）+ 内容区
- **管理后台**：顶部导航 + 左侧菜单 + 右侧内容区

## 6. API 设计

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册（username, password, real_name, email） |
| POST | /api/auth/login | 登录，返回 JWT |
| GET | /api/auth/me | 获取当前用户信息 |

### 工单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tickets | 创建工单（可带附件 ID 列表） |
| GET | /api/tickets | 我的工单列表（分页，支持 status/type/priority 筛选） |
| GET | /api/tickets/:id | 工单详情（含附件列表） |
| PATCH | /api/tickets/:id/status | 变更状态（用户：确认解决/重新打开） |

### 讨论

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tickets/:id/comments | 获取讨论列表（分页） |
| POST | /api/tickets/:id/comments | 发表评论（可带附件 ID 列表） |

### 附件

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/upload | 上传附件（multipart/form-data） |
| GET | /api/attachments/:id | 下载/预览附件 |

### 通知

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/notifications | 通知列表（分页） |
| GET | /api/notifications/unread-count | 未读数量 |
| PATCH | /api/notifications/read | 标记已读（支持单条/全部） |

### 管理（admin 角色）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/tickets | 全部工单（筛选/排序/分页） |
| PATCH | /api/admin/tickets/:id | 分配处理人 / 变更状态 |
| GET | /api/admin/notify-rules | 通知规则列表 |
| POST | /api/admin/notify-rules | 新增规则 |
| PATCH | /api/admin/notify-rules/:id | 启用/停用规则 |
| DELETE | /api/admin/notify-rules/:id | 删除规则 |
| GET | /api/admin/users | 用户列表 |
| PATCH | /api/admin/users/:id | 启用/禁用用户 |

### 约束

- 附件上传：单文件 ≤ 10MB，允许类型 jpg/png/gif/mp4/pdf/doc/docx/xls/xlsx/zip/rar
- 通知未读数轮询间隔：30 秒
- 工单编号生成规则：FB-YYYYMMDD-NNN（NNN 为当日递增序号）
- 分页默认：每页 20 条

## 7. 视觉设计

### 风格：深空渐变科技风

- **背景**：深色（#0f172a → #1a1a2e → #16213e 渐变）
- **主色调**：紫蓝（#6366f1）+ 青色（#06b6d4）渐变
- **卡片**：毛玻璃效果（backdrop-filter: blur）+ 微光边框（rgba 半透明边框）
- **光效**：背景散布渐变光晕（radial-gradient），营造深空感
- **文字**：主文字 #e2e8f0 / #f1f5f9，次要文字 #64748b / #94a3b8
- **状态色**：待处理 #fbbf24（琥珀）、处理中 #818cf8（紫蓝）、已解决 #4ade80（绿）、已关闭 #64748b（灰）
- **组件库**：Element Plus 暗色主题 + TailwindCSS 自定义覆盖
- **交互**：按钮/卡片 hover 时边框发光（box-shadow glow），过渡动画 0.2-0.3s

### 设计原则

- 科技感但不刺眼，适合长时间使用
- 信息层次通过透明度和边框区分，而非强对比色块
- 避免过度装饰，保持工具类产品的效率感

## 8. 项目结构（预期）

```
question-feedback/
├── client/                  # 前端 Vue 3 项目
│   ├── src/
│   │   ├── api/             # API 请求封装
│   │   ├── assets/          # 静态资源
│   │   ├── components/      # 公共组件
│   │   ├── layouts/         # 布局组件
│   │   ├── router/          # 路由配置
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── views/           # 页面视图
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── server/                  # 后端 Express 项目
│   ├── src/
│   │   ├── config/          # 配置（数据库、JWT 等）
│   │   ├── middleware/      # 中间件（认证、角色校验、错误处理）
│   │   ├── routes/          # 路由
│   │   ├── controllers/     # 控制器
│   │   ├── models/          # 数据模型（Sequelize）
│   │   ├── services/        # 业务逻辑（通知生成等）
│   │   └── app.js           # Express 入口
│   ├── uploads/             # 附件存储目录
│   └── package.json
├── docs/                    # 文档
└── README.md
```

## 9. 后续扩展（不在本期范围）

- 邮件通知（架构预留，后续可接入 SMTP）
- 工单导出（Excel）
- 数据统计看板（工单趋势、处理时效）
- WebSocket 实时推送（替代轮询）
- 工单模板（常见问题快捷提交）
