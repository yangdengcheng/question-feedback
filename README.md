# 问题反馈工单系统

一个面向客户与内部团队的**问题反馈 / 工单跟踪 + 工具包管理**系统。客户可提交问题反馈、参与讨论、查看工单看板与工具包；管理员与开发团队可处理工单、管理用户、维护工具包及其版本。

前端采用暗色「工程操作台」风格（信号橙 / 琥珀主题色），并支持**明暗主题切换**（默认暗色，记忆用户偏好）。

---

## 功能概览

### 工单
- 客户创建工单（类型：bug / question，优先级，附件上传）
- 工单列表 / 详情 / 状态流转（pending → processing → resolved → closed）
- 工单讨论区（评论、实时轮询与新评论提示）
- 工单操作日志
- 客户工单看板（Dashboard 统计）

### 通知
- 站内通知（工单状态变更、新评论等触发）
- 通知列表与已读标记

### 工具包
- 工具包列表 / 详情（Markdown 说明文档）
- 工具包版本发布与管理
- 工具字典管理（分类 / 工具条目）

### 后台管理
- 用户管理（角色分配）
- 工单管理（分配、状态处理）

### 通用
- 注册 / 登录（JWT 鉴权）
- 文件 / 图片 / 脚本附件上传
- 明暗主题切换

---

## 角色

| 角色 | 标识 | 说明 |
| --- | --- | --- |
| 管理员 | `admin` | 全部权限，用户与工单管理 |
| 开发主管 | `dev_lead` | 工单分配与处理 |
| 开发者 | `developer` | 处理工单、参与讨论 |
| 测试人员 | `tester` | 参与工单处理与验证 |
| 客户 | `customer` | 提交工单、查看看板与工具包 |

---

## 技术栈

### 前端（`client/`）
- Vue 3（`<script setup>` Composition API）
- Vite
- Vue Router + Pinia
- Element Plus + `@element-plus/icons-vue`
- TailwindCSS（`darkMode: "class"`，语义化 token 接 CSS 变量）
- Axios
- md-editor-v3（Markdown 编辑 / 预览）

### 后端（`server/`）
- Node.js + Express 5
- Sequelize 6 + MySQL（mysql2）
- JWT（jsonwebtoken）+ bcryptjs
- Multer（文件上传）
- Jest + Supertest（测试）

---

## 目录结构

```
question-feedback/
├── client/                     # 前端（Vue 3 + Vite）
│   ├── src/
│   │   ├── api/                # 接口封装（request.js 为 axios 实例）
│   │   ├── components/         # 通用组件（ThemeToggle / MarkdownEditor 等）
│   │   ├── composables/        # useTheme 主题 composable
│   │   ├── layouts/            # UserLayout / AdminLayout
│   │   ├── router/             # 路由与守卫
│   │   ├── stores/             # Pinia（auth / notification）
│   │   ├── styles/theme.css    # 双主题 CSS 变量 + Element Plus 覆盖
│   │   └── views/              # 页面（含 admin/）
│   ├── index.html              # 含防闪烁内联脚本
│   └── tailwind.config.js
├── server/                     # 后端（Express + Sequelize）
│   ├── src/
│   │   ├── config/database.js  # Sequelize 连接
│   │   ├── controllers/        # 控制器
│   │   ├── middleware/         # auth / admin / roles / errorHandler
│   │   ├── models/             # 数据模型
│   │   ├── routes/             # 路由
│   │   ├── services/           # 业务服务（含字典种子）
│   │   ├── app.js              # Express 应用装配
│   │   ├── server.js           # 启动入口（连接 + 同步 + 监听）
│   │   └── seed.js             # 种子数据
│   ├── tests/                  # Jest 测试
│   ├── uploads/                # 上传文件存储目录
│   └── .env.example
└── docs/                       # 设计与实现文档
    ├── deployment.md           # 部署文档
    └── superpowers/
        ├── specs/              # 设计文档
        └── plans/              # 实现计划
```

---

## 本地开发

### 环境要求
- Node.js 20.19+（或 22.12+）
- MySQL 5.7+ / 8.0+

### 1. 初始化数据库
创建数据库（名称默认 `question_feedback`）：

```sql
CREATE DATABASE question_feedback DEFAULT CHARACTER SET utf8mb4;
```

### 2. 启动后端

```bash
cd server
cp .env.example .env       # Windows: copy .env.example .env
# 编辑 .env 填入数据库账号密码与 JWT_SECRET
npm install
npm run seed               # 重建表并写入种子数据（含示例账号）
npm run dev                # nodemon 热重载，默认 http://localhost:3000
```

### 3. 启动前端

```bash
cd client
npm install
npm run dev                # http://localhost:5173，已配置 /api 与 /uploads 代理到 :3000
```

### 环境变量（`server/.env`）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DB_HOST` | `localhost` | 数据库主机 |
| `DB_PORT` | `3306` | 数据库端口 |
| `DB_NAME` | `question_feedback` | 数据库名 |
| `DB_USER` | `root` | 数据库用户 |
| `DB_PASSWORD` | （空） | 数据库密码 |
| `JWT_SECRET` | — | JWT 签名密钥（生产务必修改） |
| `PORT` | `3000` | 后端监听端口 |

### 种子账号（`npm run seed` 后）

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `admin123` | 管理员 |
| `devlead` | `dev123` | 开发主管 |
| `dev1` | `dev123` | 开发者 |
| `tester1` | `test123` | 测试人员 |
| `testuser` | `user123` | 客户 |

> `npm run seed` 使用 `sync({ force: true })`，会**清空并重建**所有表，仅用于本地初始化。

---

## 测试

```bash
cd server
npm test                   # Jest + Supertest
```

---

## 主要 API 前缀

| 前缀 | 说明 |
| --- | --- |
| `/api/health` | 健康检查 |
| `/api/auth` | 注册 / 登录 |
| `/api/tickets` | 工单 |
| `/api/tickets/:ticketId/comments` | 工单评论 |
| `/api/notifications` | 通知 |
| `/api/admin` | 后台管理 |
| `/api/toolkit` | 工具包 |
| `/uploads` | 上传文件静态资源 |

---

## 部署

生产环境部署（MySQL + PM2 + Nginx）详见 [docs/deployment.md](./docs/deployment.md)。

---

## 相关文档

- [部署文档](./docs/deployment.md)
- 设计文档：`docs/superpowers/specs/`
- 实现计划：`docs/superpowers/plans/`
