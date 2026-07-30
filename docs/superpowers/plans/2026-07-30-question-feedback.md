# 问题反馈工单系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ticket-based feedback system where users submit issues, developers discuss and resolve them, with in-app notifications replacing email/WeChat groups.

**Architecture:** Vue 3 SPA frontend with Element Plus + TailwindCSS (dark tech theme), Node.js Express REST API backend with JWT auth, MySQL via Sequelize ORM. Attachments stored on local disk. Notifications via polling.

**Tech Stack:** Vue 3, Vite, Element Plus, TailwindCSS, Pinia, Vue Router | Node.js, Express, Sequelize, MySQL2, JWT, bcrypt, multer | Jest + Supertest (backend tests)

---

## File Structure

```
question-feedback/
├── server/
│   ├── package.json
│   ├── .env / .env.example
│   ├── jest.config.js
│   ├── src/
│   │   ├── app.js (Express app, no listen)
│   │   ├── server.js (entry point)
│   │   ├── config/database.js (Sequelize instance)
│   │   ├── models/ (User, Ticket, Comment, Attachment, Notification, NotifyRule, index.js)
│   │   ├── middleware/ (auth.js JWT, admin.js role check, errorHandler.js)
│   │   ├── routes/ (auth, tickets, comments, attachments, notifications, admin)
│   │   ├── controllers/ (authController, ticketController, commentController, attachmentController, notificationController, adminController)
│   │   └── services/ (notificationService, ticketService)
│   ├── tests/ (setup.js, auth.test.js, tickets.test.js, comments.test.js, notifications.test.js, admin.test.js)
│   └── uploads/
├── client/
│   ├── package.json, vite.config.js, tailwind.config.js, postcss.config.js
│   ├── src/
│   │   ├── main.js, App.vue
│   │   ├── styles/theme.css
│   │   ├── api/ (request.js axios instance, auth.js, tickets.js, notifications.js, admin.js)
│   │   ├── router/index.js
│   │   ├── stores/ (auth.js, notification.js)
│   │   ├── layouts/ (UserLayout.vue, AdminLayout.vue)
│   │   ├── components/ (TicketCard.vue, StatusBadge.vue, CommentItem.vue, FileUpload.vue)
│   │   └── views/ (Login, Register, TicketList, TicketCreate, TicketDetail, Notifications, NotFound, admin/AdminTickets, admin/AdminNotifyRules, admin/AdminUsers)
│   └── public/
└── docs/
```

---

## Task 1: Server Project Scaffolding

**Files:**

- `server/package.json`
- `server/.gitignore`
- `server/.env.example`
- `server/.env`
- `server/src/config/database.js`
- `server/src/app.js`
- `server/src/server.js`
- `server/src/middleware/errorHandler.js`
- `server/jest.config.js`
- `server/tests/setup.js`

- [ ] **Step 1: Initialize server project and install dependencies**

```bash
mkdir -p server
cd server
npm init -y
npm install express sequelize mysql2 jsonwebtoken bcryptjs multer cors dotenv
npm install --save-dev jest supertest nodemon
```

- [ ] **Step 2: Create .gitignore**

```gitignore
node_modules/
.env
uploads/*
!uploads/.gitkeep
.superpowers/
```

- [ ] **Step 3: Create .env.example**

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=question_feedback
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_change_in_production
PORT=3000
```

- [ ] **Step 4: Create .env**

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=question_feedback
DB_USER=root
DB_PASSWORD=root
JWT_SECRET=question-feedback-jwt-secret-2026
PORT=3000
```

- [ ] **Step 5: Create server/src/config/database.js**

```javascript
const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "question_feedback",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    dialect: "mysql",
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
  },
);

module.exports = sequelize;
```

- [ ] **Step 6: Create server/src/middleware/errorHandler.js**

```javascript
function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message || err);

  if (err.name === "SequelizeValidationError") {
    const messages = err.errors.map((e) => e.message);
    return res.status(400).json({ message: messages.join("; ") });
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    const messages = err.errors.map((e) => e.message);
    return res.status(409).json({ message: messages.join("; ") });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "服务器内部错误",
  });
}

module.exports = errorHandler;
```

- [ ] **Step 7: Create server/src/app.js**

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 8: Create server/src/server.js**

```javascript
const app = require("./app");
const sequelize = require("./config/database");
require("dotenv").config();

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("数据库连接成功");
    await sequelize.sync();
    console.log("数据库同步完成");
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("启动失败:", error);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 9: Create server/jest.config.js**

```javascript
module.exports = {
  testEnvironment: "node",
  setupFiles: ["./tests/setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
};
```

- [ ] **Step 10: Create server/tests/setup.js**

```javascript
process.env.DB_NAME = "question_feedback_test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.NODE_ENV = "test";
```

- [ ] **Step 11: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "test": "jest --forceExit --detectOpenHandles"
  }
}
```

- [ ] **Step 12: Create uploads directory with .gitkeep**

```bash
mkdir -p uploads
touch uploads/.gitkeep
```

- [ ] **Step 13: Verify app loads**

```bash
node -e "require('./src/app'); console.log('app loaded ok')"
```

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(server): scaffold Express project with Sequelize config and error handling"
```

---

## Task 2: Sequelize Models

**Files:**

- `server/src/models/User.js`
- `server/src/models/Ticket.js`
- `server/src/models/Comment.js`
- `server/src/models/Attachment.js`
- `server/src/models/Notification.js`
- `server/src/models/NotifyRule.js`
- `server/src/models/index.js`

- [ ] **Step 1: Create server/src/models/User.js**

```javascript
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: "用户名不能为空" },
        len: { args: [2, 50], msg: "用户名长度为2-50个字符" },
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password_hash",
    },
    realName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "real_name",
      validate: {
        notEmpty: { msg: "姓名不能为空" },
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: { msg: "邮箱格式不正确" },
      },
    },
    role: {
      type: DataTypes.ENUM("user", "admin"),
      allowNull: false,
      defaultValue: "user",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "users",
  },
);

module.exports = User;
```

- [ ] **Step 2: Create server/src/models/Ticket.js**

```javascript
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Ticket = sequelize.define(
  "Ticket",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticketNo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      field: "ticket_no",
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: { msg: "标题不能为空" },
        len: { args: [1, 200], msg: "标题长度不能超过200个字符" },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("bug", "question", "suggestion"),
      allowNull: false,
      defaultValue: "bug",
    },
    status: {
      type: DataTypes.ENUM("pending", "processing", "resolved", "closed"),
      allowNull: false,
      defaultValue: "pending",
    },
    priority: {
      type: DataTypes.ENUM("low", "medium", "high"),
      allowNull: false,
      defaultValue: "medium",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    assigneeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assignee_id",
    },
  },
  {
    tableName: "tickets",
  },
);

module.exports = Ticket;
```

- [ ] **Step 3: Create server/src/models/Comment.js**

```javascript
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Comment = sequelize.define(
  "Comment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "ticket_id",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: "评论内容不能为空" },
      },
    },
  },
  {
    tableName: "comments",
  },
);

module.exports = Comment;
```

- [ ] **Step 4: Create server/src/models/Attachment.js**

```javascript
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Attachment = sequelize.define(
  "Attachment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "ticket_id",
    },
    commentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "comment_id",
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "file_name",
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: "file_path",
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "file_size",
    },
    fileType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "file_type",
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "uploaded_by",
    },
  },
  {
    tableName: "attachments",
    updatedAt: false,
  },
);

module.exports = Attachment;
```

- [ ] **Step 5: Create server/src/models/Notification.js**

```javascript
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "ticket_id",
    },
    type: {
      type: DataTypes.ENUM(
        "new_ticket",
        "new_comment",
        "status_change",
        "assigned",
      ),
      allowNull: false,
    },
    content: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_read",
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "read_at",
    },
  },
  {
    tableName: "notifications",
    updatedAt: false,
  },
);

module.exports = Notification;
```

- [ ] **Step 6: Create server/src/models/NotifyRule.js**

```javascript
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NotifyRule = sequelize.define(
  "NotifyRule",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    ticketType: {
      type: DataTypes.ENUM("bug", "question", "suggestion"),
      allowNull: true,
      field: "ticket_type",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "notify_rules",
    updatedAt: false,
  },
);

module.exports = NotifyRule;
```

- [ ] **Step 7: Create server/src/models/index.js with all associations**

```javascript
const sequelize = require("../config/database");
const User = require("./User");
const Ticket = require("./Ticket");
const Comment = require("./Comment");
const Attachment = require("./Attachment");
const Notification = require("./Notification");
const NotifyRule = require("./NotifyRule");

// User <-> Ticket (creator)
User.hasMany(Ticket, { foreignKey: "userId", as: "tickets" });
Ticket.belongsTo(User, { foreignKey: "userId", as: "creator" });

// User <-> Ticket (assignee)
User.hasMany(Ticket, { foreignKey: "assigneeId", as: "assignedTickets" });
Ticket.belongsTo(User, { foreignKey: "assigneeId", as: "assignee" });

// Ticket <-> Comment
Ticket.hasMany(Comment, { foreignKey: "ticketId", as: "comments" });
Comment.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

// User <-> Comment
User.hasMany(Comment, { foreignKey: "userId", as: "comments" });
Comment.belongsTo(User, { foreignKey: "userId", as: "author" });

// Ticket <-> Attachment
Ticket.hasMany(Attachment, { foreignKey: "ticketId", as: "attachments" });
Attachment.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

// Comment <-> Attachment
Comment.hasMany(Attachment, { foreignKey: "commentId", as: "attachments" });
Attachment.belongsTo(Comment, { foreignKey: "commentId", as: "comment" });

// User <-> Attachment
User.hasMany(Attachment, {
  foreignKey: "uploadedBy",
  as: "uploadedAttachments",
});
Attachment.belongsTo(User, { foreignKey: "uploadedBy", as: "uploader" });

// User <-> Notification
User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "userId", as: "user" });

// Ticket <-> Notification
Ticket.hasMany(Notification, { foreignKey: "ticketId", as: "notifications" });
Notification.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

// User <-> NotifyRule
User.hasMany(NotifyRule, { foreignKey: "userId", as: "notifyRules" });
NotifyRule.belongsTo(User, { foreignKey: "userId", as: "user" });

module.exports = {
  sequelize,
  User,
  Ticket,
  Comment,
  Attachment,
  Notification,
  NotifyRule,
};
```

- [ ] **Step 8: Verify models load**

```bash
node -e "const m = require('./src/models'); console.log(Object.keys(m)); console.log('models loaded ok')"
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(server): add Sequelize models with associations for User, Ticket, Comment, Attachment, Notification, NotifyRule"
```

---

## Task 3: Auth API

**Files:**

- `server/tests/auth.test.js`
- `server/src/middleware/auth.js`
- `server/src/middleware/admin.js`
- `server/src/controllers/authController.js`
- `server/src/routes/auth.js`
- `server/src/app.js` (update)

- [ ] **Step 1: Write auth tests first**

```javascript
// server/tests/auth.test.js
const request = require("supertest");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ where: {} });
});

describe("POST /api/auth/register", () => {
  it("应该成功注册新用户", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "testuser",
      password: "password123",
      realName: "测试用户",
      email: "test@example.com",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe("testuser");
    expect(res.body.user.realName).toBe("测试用户");
    expect(res.body.token).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("应该拒绝重复用户名", async () => {
    await request(app).post("/api/auth/register").send({
      username: "testuser",
      password: "password123",
      realName: "用户1",
    });

    const res = await request(app).post("/api/auth/register").send({
      username: "testuser",
      password: "password456",
      realName: "用户2",
    });
    expect(res.status).toBe(409);
  });

  it("应该拒绝缺少必填字段", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "testuser" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      username: "testuser",
      password: "password123",
      realName: "测试用户",
    });
  });

  it("应该成功登录", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe("testuser");
  });

  it("应该拒绝错误密码", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "testuser",
      password: "password123",
      realName: "测试用户",
    });
    token = res.body.token;
  });

  it("应该返回当前用户信息", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("testuser");
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("应该拒绝无token请求", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Create server/src/middleware/auth.js**

```javascript
const jwt = require("jsonwebtoken");
const { User } = require("../models");

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "未提供认证令牌" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "用户不存在" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "账号已被禁用" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "认证令牌无效或已过期" });
  }
}

module.exports = auth;
```

- [ ] **Step 3: Create server/src/middleware/admin.js**

```javascript
function admin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "需要管理员权限" });
  }
  next();
}

module.exports = admin;
```

- [ ] **Step 4: Create server/src/controllers/authController.js**

```javascript
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user.toJSON();
  return rest;
}

async function register(req, res, next) {
  try {
    const { username, password, realName, email } = req.body;

    if (!username || !password || !realName) {
      return res.status(400).json({ message: "用户名、密码和姓名为必填项" });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "用户名已存在" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash,
      realName,
      email: email || null,
    });

    const token = generateToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "用户名和密码为必填项" });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "账号已被禁用" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }

    const token = generateToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    res.json(sanitizeUser(req.user));
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, me };
```

- [ ] **Step 5: Create server/src/routes/auth.js**

```javascript
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", auth, authController.me);

module.exports = router;
```

- [ ] **Step 6: Register auth routes in app.js**

Update `server/src/app.js`:

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 7: Run tests**

```bash
npx jest tests/auth.test.js --forceExit --detectOpenHandles
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(server): add auth API with register, login, me endpoints and JWT middleware"
```

---

## Task 4: Tickets API + Services

**Files:**

- `server/tests/tickets.test.js`
- `server/src/services/ticketService.js`
- `server/src/services/notificationService.js`
- `server/src/controllers/ticketController.js`
- `server/src/routes/tickets.js`
- `server/src/app.js` (update)

- [ ] **Step 1: Write ticket tests first**

```javascript
// server/tests/tickets.test.js
const request = require("supertest");
const app = require("../src/app");
const { sequelize, User, Ticket } = require("../src/models");

let token;
let userId;

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  const res = await request(app).post("/api/auth/register").send({
    username: "testuser",
    password: "password123",
    realName: "测试用户",
  });
  token = res.body.token;
  userId = res.body.user.id;
});

describe("POST /api/tickets", () => {
  it("应该成功创建工单", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "登录页面报错",
        description: "点击登录按钮后页面白屏",
        type: "bug",
        priority: "high",
      });
    expect(res.status).toBe(201);
    expect(res.body.ticketNo).toMatch(/^FB-\d{8}-\d{3}$/);
    expect(res.body.title).toBe("登录页面报错");
    expect(res.body.status).toBe("pending");
  });

  it("应该拒绝缺少标题", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "没有标题" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tickets", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "工单1", type: "bug" });
    await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "工单2", type: "question" });
  });

  it("应该返回我的工单列表", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(2);
    expect(res.body.count).toBe(2);
  });

  it("应该支持按状态筛选", async () => {
    const res = await request(app)
      .get("/api/tickets?status=pending")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(2);
  });
});

describe("GET /api/tickets/:id", () => {
  it("应该返回工单详情", async () => {
    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "测试工单", type: "bug" });

    const res = await request(app)
      .get(`/api/tickets/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("测试工单");
    expect(res.body.creator).toBeDefined();
  });
});

describe("PATCH /api/tickets/:id/status", () => {
  it("普通用户不能直接设置为processing", async () => {
    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "测试工单", type: "bug" });

    const res = await request(app)
      .patch(`/api/tickets/${createRes.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "processing" });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Create server/src/services/ticketService.js**

```javascript
const { Ticket, sequelize } = require("../models");
const { Op } = require("sequelize");

async function generateTicketNo() {
  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const prefix = `FB-${dateStr}-`;

  const lastTicket = await Ticket.findOne({
    where: {
      ticketNo: { [Op.like]: `${prefix}%` },
    },
    order: [["ticketNo", "DESC"]],
  });

  let seq = 1;
  if (lastTicket) {
    const lastSeq = parseInt(lastTicket.ticketNo.split("-")[2], 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

module.exports = { generateTicketNo };
```

- [ ] **Step 3: Create server/src/services/notificationService.js**

```javascript
const { Notification, NotifyRule, Ticket, User } = require("../models");

async function notifyNewTicket(ticket) {
  const rules = await NotifyRule.findAll({
    where: { isActive: true },
  });

  const notifications = [];
  for (const rule of rules) {
    if (rule.ticketType && rule.ticketType !== ticket.type) {
      continue;
    }
    if (rule.userId === ticket.userId) {
      continue;
    }
    notifications.push({
      userId: rule.userId,
      ticketId: ticket.id,
      type: "new_ticket",
      content: `新工单 ${ticket.ticketNo}：${ticket.title}`,
    });
  }

  if (notifications.length > 0) {
    await Notification.bulkCreate(notifications);
  }
}

async function notifyComment(ticket, comment, commenter) {
  const userIdsToNotify = new Set();

  if (ticket.userId !== commenter.id) {
    userIdsToNotify.add(ticket.userId);
  }

  if (ticket.assigneeId && ticket.assigneeId !== commenter.id) {
    userIdsToNotify.add(ticket.assigneeId);
  }

  const notifications = [];
  for (const uid of userIdsToNotify) {
    notifications.push({
      userId: uid,
      ticketId: ticket.id,
      type: "new_comment",
      content: `${commenter.realName} 在工单 ${ticket.ticketNo} 中发表了新评论`,
    });
  }

  if (notifications.length > 0) {
    await Notification.bulkCreate(notifications);
  }
}

async function notifyStatusChange(ticket, newStatus) {
  const statusLabels = {
    pending: "待处理",
    processing: "处理中",
    resolved: "已解决",
    closed: "已关闭",
  };

  await Notification.create({
    userId: ticket.userId,
    ticketId: ticket.id,
    type: "status_change",
    content: `工单 ${ticket.ticketNo} 状态变更为「${statusLabels[newStatus]}」`,
  });
}

async function notifyAssigned(ticket, assignee) {
  await Notification.create({
    userId: assignee.id,
    ticketId: ticket.id,
    type: "assigned",
    content: `您被分配了工单 ${ticket.ticketNo}：${ticket.title}`,
  });
}

module.exports = {
  notifyNewTicket,
  notifyComment,
  notifyStatusChange,
  notifyAssigned,
};
```

- [ ] **Step 4: Create server/src/controllers/ticketController.js**

```javascript
const { Ticket, User, Attachment, Comment } = require("../models");
const { generateTicketNo } = require("../services/ticketService");
const {
  notifyNewTicket,
  notifyStatusChange,
} = require("../services/notificationService");

async function create(req, res, next) {
  try {
    const { title, description, type, priority, attachmentIds } = req.body;

    if (!title) {
      return res.status(400).json({ message: "标题不能为空" });
    }

    const ticketNo = await generateTicketNo();
    const ticket = await Ticket.create({
      ticketNo,
      title,
      description: description || null,
      type: type || "bug",
      priority: priority || "medium",
      userId: req.user.id,
    });

    if (attachmentIds && attachmentIds.length > 0) {
      await Attachment.update(
        { ticketId: ticket.id },
        { where: { id: attachmentIds, uploadedBy: req.user.id } },
      );
    }

    await notifyNewTicket(ticket);

    const result = await Ticket.findByPk(ticket.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "realName"],
        },
        { model: Attachment, as: "attachments" },
      ],
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const { page = 1, pageSize = 20, status, type, priority } = req.query;
    const where = { userId: req.user.id };

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const { count, rows } = await Ticket.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "realName"],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "username", "realName"],
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: parseInt(pageSize, 10),
      offset,
    });

    res.json({
      count,
      rows,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "realName"],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "username", "realName"],
        },
        { model: Attachment, as: "attachments" },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ message: "工单不存在" });
    }

    if (
      ticket.userId !== req.user.id &&
      req.user.role !== "admin" &&
      ticket.assigneeId !== req.user.id
    ) {
      return res.status(403).json({ message: "无权查看此工单" });
    }

    res.json(ticket);
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "工单不存在" });
    }

    if (req.user.role !== "admin") {
      if (ticket.userId !== req.user.id) {
        return res.status(403).json({ message: "无权操作此工单" });
      }

      const allowedTransitions = {
        resolved: ["closed", "processing"],
      };

      const allowed = allowedTransitions[ticket.status];
      if (!allowed || !allowed.includes(status)) {
        return res.status(403).json({ message: "不允许的状态变更" });
      }
    }

    ticket.status = status;
    await ticket.save();

    if (ticket.userId !== req.user.id) {
      await notifyStatusChange(ticket, status);
    }

    const result = await Ticket.findByPk(ticket.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "realName"],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "username", "realName"],
        },
      ],
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { create, list, detail, updateStatus };
```

- [ ] **Step 5: Create server/src/routes/tickets.js**

```javascript
const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const auth = require("../middleware/auth");

router.use(auth);

router.post("/", ticketController.create);
router.get("/", ticketController.list);
router.get("/:id", ticketController.detail);
router.patch("/:id/status", ticketController.updateStatus);

module.exports = router;
```

- [ ] **Step 6: Register ticket routes in app.js**

Update `server/src/app.js`:

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 7: Run tests**

```bash
npx jest tests/tickets.test.js --forceExit --detectOpenHandles
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(server): add tickets API with CRUD, status transitions, and notification services"
```

---

## Task 5: Comments API

**Files:**

- `server/tests/comments.test.js`
- `server/src/controllers/commentController.js`
- `server/src/routes/comments.js`
- `server/src/app.js` (update)

- [ ] **Step 1: Write comment tests first**

```javascript
// server/tests/comments.test.js
const request = require("supertest");
const app = require("../src/app");
const { sequelize } = require("../src/models");

let token;
let ticketId;

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  const regRes = await request(app).post("/api/auth/register").send({
    username: "testuser",
    password: "password123",
    realName: "测试用户",
  });
  token = regRes.body.token;

  const ticketRes = await request(app)
    .post("/api/tickets")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "测试工单", type: "bug" });
  ticketId = ticketRes.body.id;
});

describe("POST /api/tickets/:ticketId/comments", () => {
  it("应该成功添加评论", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "这是一条评论" });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe("这是一条评论");
    expect(res.body.author).toBeDefined();
  });

  it("应该拒绝空评论", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tickets/:ticketId/comments", () => {
  beforeEach(async () => {
    await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "第一条评论" });
    await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "第二条评论" });
  });

  it("应该返回评论列表及作者信息", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].author.realName).toBe("测试用户");
    expect(res.body[0].content).toBe("第一条评论");
  });
});
```

- [ ] **Step 2: Create server/src/controllers/commentController.js**

```javascript
const { Comment, Ticket, User, Attachment } = require("../models");
const { notifyComment } = require("../services/notificationService");

async function create(req, res, next) {
  try {
    const { content, attachmentIds } = req.body;
    const ticketId = req.params.ticketId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "评论内容不能为空" });
    }

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "工单不存在" });
    }

    const comment = await Comment.create({
      ticketId: parseInt(ticketId, 10),
      userId: req.user.id,
      content: content.trim(),
    });

    if (attachmentIds && attachmentIds.length > 0) {
      await Attachment.update(
        { commentId: comment.id, ticketId: parseInt(ticketId, 10) },
        { where: { id: attachmentIds, uploadedBy: req.user.id } },
      );
    }

    // 如果工单状态为 resolved 且评论者是工单创建者，自动重新打开
    if (ticket.status === "resolved" && ticket.userId === req.user.id) {
      ticket.status = "processing";
      await ticket.save();
    }

    await notifyComment(ticket, comment, req.user);

    const result = await Comment.findByPk(comment.id, {
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "realName"],
        },
        { model: Attachment, as: "attachments" },
      ],
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const ticketId = req.params.ticketId;

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "工单不存在" });
    }

    const comments = await Comment.findAll({
      where: { ticketId: parseInt(ticketId, 10) },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "realName"],
        },
        { model: Attachment, as: "attachments" },
      ],
      order: [["createdAt", "ASC"]],
    });

    res.json(comments);
  } catch (error) {
    next(error);
  }
}

module.exports = { create, list };
```

- [ ] **Step 3: Create server/src/routes/comments.js**

```javascript
const express = require("express");
const router = express.Router({ mergeParams: true });
const commentController = require("../controllers/commentController");
const auth = require("../middleware/auth");

router.use(auth);

router.get("/", commentController.list);
router.post("/", commentController.create);

module.exports = router;
```

- [ ] **Step 4: Register comment routes in app.js**

Update `server/src/app.js`:

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const commentRoutes = require("./routes/comments");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/tickets/:ticketId/comments", commentRoutes);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 5: Run tests**

```bash
npx jest tests/comments.test.js --forceExit --detectOpenHandles
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): add comments API with auto-reopen and notification on comment"
```

---

## Task 6: Upload/Attachments API

**Files:**

- `server/src/controllers/attachmentController.js`
- `server/src/routes/attachments.js`
- `server/src/app.js` (update)

- [ ] **Step 1: Create server/src/controllers/attachmentController.js**

```javascript
const path = require("path");
const { Attachment } = require("../models");

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-rar-compressed",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

async function upload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "请选择要上传的文件" });
    }

    if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({
        message:
          "不支持的文件类型，允许：jpg, png, gif, mp4, pdf, doc, docx, xls, xlsx, zip, rar",
      });
    }

    if (req.file.size > MAX_SIZE) {
      return res.status(400).json({ message: "文件大小不能超过10MB" });
    }

    const attachment = await Attachment.create({
      ticketId: 0,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      uploadedBy: req.user.id,
    });

    res.status(201).json(attachment);
  } catch (error) {
    next(error);
  }
}

async function download(req, res, next) {
  try {
    const attachment = await Attachment.findByPk(req.params.id);
    if (!attachment) {
      return res.status(404).json({ message: "附件不存在" });
    }

    const filePath = path.resolve(attachment.filePath);
    res.download(filePath, attachment.fileName);
  } catch (error) {
    next(error);
  }
}

module.exports = { upload, download, ALLOWED_TYPES, MAX_SIZE };
```

- [ ] **Step 2: Create server/src/routes/attachments.js**

```javascript
const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const attachmentController = require("../controllers/attachmentController");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "..", "uploads"));
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${random}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post(
  "/upload",
  auth,
  upload.single("file"),
  attachmentController.upload,
);
router.get("/attachments/:id", attachmentController.download);

module.exports = router;
```

- [ ] **Step 3: Register attachment routes in app.js**

Update `server/src/app.js`:

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const commentRoutes = require("./routes/comments");
const attachmentRoutes = require("./routes/attachments");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/tickets/:ticketId/comments", commentRoutes);
app.use("/api", attachmentRoutes);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(server): add file upload and attachment download API with multer"
```

---

## Task 7: Notifications API

**Files:**

- `server/tests/notifications.test.js`
- `server/src/controllers/notificationController.js`
- `server/src/routes/notifications.js`
- `server/src/app.js` (update)

- [ ] **Step 1: Write notification tests first**

```javascript
// server/tests/notifications.test.js
const request = require("supertest");
const app = require("../src/app");
const { sequelize, Notification, User, Ticket } = require("../src/models");

let token;
let userId;

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  const regRes = await request(app).post("/api/auth/register").send({
    username: "testuser",
    password: "password123",
    realName: "测试用户",
  });
  token = regRes.body.token;
  userId = regRes.body.user.id;

  const ticketRes = await request(app)
    .post("/api/tickets")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "测试工单", type: "bug" });

  await Notification.bulkCreate([
    {
      userId,
      ticketId: ticketRes.body.id,
      type: "new_comment",
      content: "测试通知1",
    },
    {
      userId,
      ticketId: ticketRes.body.id,
      type: "status_change",
      content: "测试通知2",
    },
  ]);
});

describe("GET /api/notifications", () => {
  it("应该返回通知列表", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(2);
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("应该返回未读数量", async () => {
    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

describe("PATCH /api/notifications/read", () => {
  it("应该标记全部已读", async () => {
    const res = await request(app)
      .patch("/api/notifications/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ all: true });
    expect(res.status).toBe(200);

    const countRes = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`);
    expect(countRes.body.count).toBe(0);
  });
});
```

- [ ] **Step 2: Create server/src/controllers/notificationController.js**

```javascript
const { Notification, Ticket } = require("../models");
const { Op } = require("sequelize");

async function list(req, res, next) {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

    const { count, rows } = await Notification.findAndCountAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Ticket,
          as: "ticket",
          attributes: ["id", "ticketNo", "title"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(pageSize, 10),
      offset,
    });

    res.json({
      count,
      rows,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });
  } catch (error) {
    next(error);
  }
}

async function unreadCount(req, res, next) {
  try {
    const count = await Notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const { ids, all } = req.body;

    if (all) {
      await Notification.update(
        { isRead: true, readAt: new Date() },
        { where: { userId: req.user.id, isRead: false } },
      );
    } else if (ids && ids.length > 0) {
      await Notification.update(
        { isRead: true, readAt: new Date() },
        { where: { id: ids, userId: req.user.id } },
      );
    } else {
      return res.status(400).json({ message: "请提供 ids 数组或 all: true" });
    }

    res.json({ message: "标记成功" });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, unreadCount, markRead };
```

- [ ] **Step 3: Create server/src/routes/notifications.js**

```javascript
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const auth = require("../middleware/auth");

router.use(auth);

router.get("/", notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.patch("/read", notificationController.markRead);

module.exports = router;
```

- [ ] **Step 4: Register notification routes in app.js**

Update `server/src/app.js`:

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const commentRoutes = require("./routes/comments");
const attachmentRoutes = require("./routes/attachments");
const notificationRoutes = require("./routes/notifications");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/tickets/:ticketId/comments", commentRoutes);
app.use("/api", attachmentRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 5: Run tests**

```bash
npx jest tests/notifications.test.js --forceExit --detectOpenHandles
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): add notifications API with list, unread count, and mark read"
```

---

## Task 8: Admin API

**Files:**

- `server/tests/admin.test.js`
- `server/src/controllers/adminController.js`
- `server/src/routes/admin.js`
- `server/src/app.js` (update)

- [ ] **Step 1: Write admin tests first**

```javascript
// server/tests/admin.test.js
const request = require("supertest");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");
const bcrypt = require("bcryptjs");

let adminToken;
let userToken;
let adminId;
let userId;

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.sync({ force: true });

  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await User.create({
    username: "admin",
    passwordHash,
    realName: "管理员",
    role: "admin",
  });
  adminId = admin.id;

  const userRes = await request(app).post("/api/auth/register").send({
    username: "testuser",
    password: "password123",
    realName: "测试用户",
  });
  userToken = userRes.body.token;
  userId = userRes.body.user.id;

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "admin123" });
  adminToken = loginRes.body.token;
});

describe("GET /api/admin/tickets", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ title: "测试工单", type: "bug" });
  });

  it("管理员应该能查看所有工单", async () => {
    const res = await request(app)
      .get("/api/admin/tickets")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(1);
  });

  it("普通用户应该被拒绝", async () => {
    const res = await request(app)
      .get("/api/admin/tickets")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/tickets/:id", () => {
  it("应该能分配工单", async () => {
    const ticketRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ title: "测试工单", type: "bug" });

    const res = await request(app)
      .patch(`/api/admin/tickets/${ticketRes.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ assigneeId: adminId, status: "processing" });
    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(adminId);
    expect(res.body.status).toBe("processing");
  });
});

describe("Notify Rules CRUD", () => {
  it("应该能创建通知规则", async () => {
    const res = await request(app)
      .post("/api/admin/notify-rules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: adminId, ticketType: "bug" });
    expect(res.status).toBe(201);
    expect(res.body.ticketType).toBe("bug");
  });

  it("应该能列出通知规则", async () => {
    await request(app)
      .post("/api/admin/notify-rules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: adminId, ticketType: null });

    const res = await request(app)
      .get("/api/admin/notify-rules")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});
```

- [ ] **Step 2: Create server/src/controllers/adminController.js**

```javascript
const { Ticket, User, NotifyRule, Notification } = require("../models");
const {
  notifyAssigned,
  notifyStatusChange,
} = require("../services/notificationService");

async function listTickets(req, res, next) {
  try {
    const { page = 1, pageSize = 20, status, type, priority } = req.query;
    const where = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const { count, rows } = await Ticket.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "realName"],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "username", "realName"],
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: parseInt(pageSize, 10),
      offset,
    });

    res.json({
      count,
      rows,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });
  } catch (error) {
    next(error);
  }
}

async function updateTicket(req, res, next) {
  try {
    const { assigneeId, status } = req.body;
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "工单不存在" });
    }

    if (assigneeId !== undefined) {
      ticket.assigneeId = assigneeId;
      if (assigneeId) {
        const assignee = await User.findByPk(assigneeId);
        if (assignee) {
          await notifyAssigned(ticket, assignee);
        }
      }
    }

    if (status && status !== ticket.status) {
      ticket.status = status;
      await notifyStatusChange(ticket, status);
    }

    await ticket.save();

    const result = await Ticket.findByPk(ticket.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "realName"],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "username", "realName"],
        },
      ],
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listNotifyRules(req, res, next) {
  try {
    const rules = await NotifyRule.findAll({
      include: [
        { model: User, as: "user", attributes: ["id", "username", "realName"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(rules);
  } catch (error) {
    next(error);
  }
}

async function createNotifyRule(req, res, next) {
  try {
    const { userId, ticketType } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "用户ID不能为空" });
    }

    const rule = await NotifyRule.create({
      userId,
      ticketType: ticketType || null,
    });

    const result = await NotifyRule.findByPk(rule.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "username", "realName"] },
      ],
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function updateNotifyRule(req, res, next) {
  try {
    const rule = await NotifyRule.findByPk(req.params.id);
    if (!rule) {
      return res.status(404).json({ message: "规则不存在" });
    }

    const { isActive, ticketType } = req.body;
    if (isActive !== undefined) rule.isActive = isActive;
    if (ticketType !== undefined) rule.ticketType = ticketType;

    await rule.save();

    const result = await NotifyRule.findByPk(rule.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "username", "realName"] },
      ],
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function deleteNotifyRule(req, res, next) {
  try {
    const rule = await NotifyRule.findByPk(req.params.id);
    if (!rule) {
      return res.status(404).json({ message: "规则不存在" });
    }

    await rule.destroy();
    res.json({ message: "删除成功" });
  } catch (error) {
    next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["passwordHash"] },
      order: [["createdAt", "DESC"]],
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "用户不存在" });
    }

    const { isActive, role } = req.body;
    if (isActive !== undefined) user.isActive = isActive;
    if (role !== undefined) user.role = role;

    await user.save();

    const { passwordHash, ...rest } = user.toJSON();
    res.json(rest);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTickets,
  updateTicket,
  listNotifyRules,
  createNotifyRule,
  updateNotifyRule,
  deleteNotifyRule,
  listUsers,
  updateUser,
};
```

- [ ] **Step 3: Create server/src/routes/admin.js**

```javascript
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

router.use(auth);
router.use(admin);

router.get("/tickets", adminController.listTickets);
router.patch("/tickets/:id", adminController.updateTicket);
router.get("/notify-rules", adminController.listNotifyRules);
router.post("/notify-rules", adminController.createNotifyRule);
router.patch("/notify-rules/:id", adminController.updateNotifyRule);
router.delete("/notify-rules/:id", adminController.deleteNotifyRule);
router.get("/users", adminController.listUsers);
router.patch("/users/:id", adminController.updateUser);

module.exports = router;
```

- [ ] **Step 4: Register admin routes in app.js**

Update `server/src/app.js`:

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const commentRoutes = require("./routes/comments");
const attachmentRoutes = require("./routes/attachments");
const notificationRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/tickets/:ticketId/comments", commentRoutes);
app.use("/api", attachmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 5: Run ALL tests**

```bash
npx jest --forceExit --detectOpenHandles
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): add admin API for ticket management, notify rules, and user management"
```

---

## Task 9: Client Scaffolding + Theme

**Files:**

- `client/package.json`
- `client/vite.config.js`
- `client/tailwind.config.js`
- `client/postcss.config.js`
- `client/src/styles/theme.css`
- `client/src/main.js`
- `client/src/App.vue`
- `client/index.html`

- [ ] **Step 1: Create Vue project with Vite**

```bash
cd ..
npm create vite@latest client -- --template vue
cd client
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install element-plus @element-plus/icons-vue vue-router@4 pinia axios
npm install --save-dev tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Configure tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#6366f1",
        accent: "#06b6d4",
        surface: "#0f172a",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Configure postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create src/styles/theme.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #6366f1;
  --color-accent: #06b6d4;
  --color-surface: #0f172a;
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-status-pending: #fbbf24;
  --color-status-processing: #818cf8;
  --color-status-resolved: #4ade80;
  --color-status-closed: #64748b;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1a1a2e 50%, #16213e 100%);
  color: var(--color-text-primary);
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

body::before {
  content: "";
  position: fixed;
  top: -20%;
  left: -10%;
  width: 500px;
  height: 500px;
  background: radial-gradient(
    circle,
    rgba(99, 102, 241, 0.08) 0%,
    transparent 70%
  );
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

body::after {
  content: "";
  position: fixed;
  bottom: -15%;
  right: -5%;
  width: 600px;
  height: 600px;
  background: radial-gradient(
    circle,
    rgba(6, 182, 212, 0.06) 0%,
    transparent 70%
  );
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

#app {
  position: relative;
  z-index: 1;
  min-height: 100vh;
}

.glass-card {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.glass-card:hover {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.4);
}

.glass-card-static {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 12px;
}

.btn-gradient {
  background: linear-gradient(135deg, #6366f1, #06b6d4);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-gradient:hover {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
  transform: translateY(-1px);
}

.text-primary {
  color: var(--color-text-primary);
}

.text-secondary {
  color: var(--color-text-secondary);
}

.text-muted {
  color: var(--color-text-muted);
}

/* Element Plus 暗色主题覆盖 */
:root {
  --el-bg-color: #0f172a;
  --el-bg-color-overlay: #1e293b;
  --el-bg-color-page: #0f172a;
  --el-text-color-primary: #e2e8f0;
  --el-text-color-regular: #cbd5e1;
  --el-text-color-secondary: #94a3b8;
  --el-text-color-placeholder: #64748b;
  --el-border-color: rgba(99, 102, 241, 0.2);
  --el-border-color-light: rgba(99, 102, 241, 0.15);
  --el-border-color-lighter: rgba(99, 102, 241, 0.1);
  --el-fill-color: #1e293b;
  --el-fill-color-light: #1e293b;
  --el-fill-color-lighter: #162032;
  --el-fill-color-blank: #0f172a;
  --el-color-primary: #6366f1;
  --el-color-primary-light-3: #818cf8;
  --el-color-primary-light-5: #a5b4fc;
  --el-color-primary-light-7: #c7d2fe;
  --el-color-primary-light-9: #e0e7ff;
  --el-color-primary-dark-2: #4f46e5;
  --el-mask-color: rgba(15, 23, 42, 0.8);
  --el-disabled-bg-color: #1e293b;
  --el-disabled-text-color: #475569;
  --el-disabled-border-color: rgba(99, 102, 241, 0.1);
}

.el-input__wrapper {
  background-color: rgba(30, 41, 59, 0.8) !important;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2) inset !important;
}

.el-input__wrapper:hover {
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.4) inset !important;
}

.el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px #6366f1 inset !important;
}

.el-textarea__inner {
  background-color: rgba(30, 41, 59, 0.8) !important;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2) inset !important;
  color: #e2e8f0 !important;
}

.el-textarea__inner:focus {
  box-shadow: 0 0 0 1px #6366f1 inset !important;
}

.el-select .el-input__wrapper {
  background-color: rgba(30, 41, 59, 0.8) !important;
}

.el-dialog {
  background-color: #1e293b !important;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.el-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(30, 41, 59, 0.5);
  --el-table-row-hover-bg-color: rgba(99, 102, 241, 0.08);
  --el-table-border-color: rgba(99, 102, 241, 0.1);
  --el-table-text-color: #e2e8f0;
  --el-table-header-text-color: #94a3b8;
}

.el-menu {
  border-right: none !important;
}

.el-pagination {
  --el-pagination-bg-color: transparent;
  --el-pagination-text-color: #94a3b8;
  --el-pagination-button-bg-color: rgba(30, 41, 59, 0.5);
  --el-pagination-hover-color: #6366f1;
}

.el-upload-dragger {
  background-color: rgba(30, 41, 59, 0.5) !important;
  border-color: rgba(99, 102, 241, 0.3) !important;
}

.el-upload-dragger:hover {
  border-color: #6366f1 !important;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}
```

- [ ] **Step 6: Create src/main.js**

```javascript
import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import App from "./App.vue";
import router from "./router";
import "./styles/theme.css";

const app = createApp(App);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

app.mount("#app");
```

- [ ] **Step 7: Create src/App.vue**

```vue
<template>
  <router-view />
</template>

<script setup></script>

<style></style>
```

- [ ] **Step 8: Update index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>问题反馈中心</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 9: Configure vite.config.js**

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(client): scaffold Vue 3 project with Element Plus, TailwindCSS dark tech theme"
```

---

## Task 10: Client Router + Stores + API Layer

**Files:**

- `client/src/api/request.js`
- `client/src/api/auth.js`
- `client/src/api/tickets.js`
- `client/src/api/notifications.js`
- `client/src/api/admin.js`
- `client/src/stores/auth.js`
- `client/src/stores/notification.js`
- `client/src/router/index.js`

- [ ] **Step 1: Create src/api/request.js**

```javascript
import axios from "axios";
import { ElMessage } from "element-plus";
import router from "../router";

const request = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || "请求失败";
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.push("/login");
      ElMessage.error("登录已过期，请重新登录");
    } else {
      ElMessage.error(message);
    }
    return Promise.reject(error);
  },
);

export default request;
```

- [ ] **Step 2: Create src/api/auth.js**

```javascript
import request from "./request";

export function register(data) {
  return request.post("/auth/register", data);
}

export function login(data) {
  return request.post("/auth/login", data);
}

export function getMe() {
  return request.get("/auth/me");
}
```

- [ ] **Step 3: Create src/api/tickets.js**

```javascript
import request from "./request";

export function createTicket(data) {
  return request.post("/tickets", data);
}

export function listTickets(params) {
  return request.get("/tickets", { params });
}

export function getTicketDetail(id) {
  return request.get(`/tickets/${id}`);
}

export function updateTicketStatus(id, status) {
  return request.patch(`/tickets/${id}/status`, { status });
}

export function listComments(ticketId) {
  return request.get(`/tickets/${ticketId}/comments`);
}

export function createComment(ticketId, data) {
  return request.post(`/tickets/${ticketId}/comments`, data);
}
```

- [ ] **Step 4: Create src/api/notifications.js**

```javascript
import request from "./request";

export function listNotifications(params) {
  return request.get("/notifications", { params });
}

export function getUnreadCount() {
  return request.get("/notifications/unread-count");
}

export function markRead(data) {
  return request.patch("/notifications/read", data);
}
```

- [ ] **Step 5: Create src/api/admin.js**

```javascript
import request from "./request";

export function listTickets(params) {
  return request.get("/admin/tickets", { params });
}

export function updateTicket(id, data) {
  return request.patch(`/admin/tickets/${id}`, data);
}

export function listNotifyRules() {
  return request.get("/admin/notify-rules");
}

export function createNotifyRule(data) {
  return request.post("/admin/notify-rules", data);
}

export function updateNotifyRule(id, data) {
  return request.patch(`/admin/notify-rules/${id}`, data);
}

export function deleteNotifyRule(id) {
  return request.delete(`/admin/notify-rules/${id}`);
}

export function listUsers() {
  return request.get("/admin/users");
}

export function updateUser(id, data) {
  return request.patch(`/admin/users/${id}`, data);
}
```

- [ ] **Step 6: Create src/stores/auth.js**

```javascript
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as authApi from "../api/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(JSON.parse(localStorage.getItem("user") || "null"));
  const token = ref(localStorage.getItem("token") || "");

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === "admin");

  async function login(credentials) {
    const data = await authApi.login(credentials);
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  }

  async function register(formData) {
    const data = await authApi.register(formData);
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  }

  function logout() {
    token.value = "";
    user.value = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  async function fetchMe() {
    try {
      const data = await authApi.getMe();
      user.value = data;
      localStorage.setItem("user", JSON.stringify(data));
    } catch (error) {
      logout();
    }
  }

  return { user, token, isLoggedIn, isAdmin, login, register, logout, fetchMe };
});
```

- [ ] **Step 7: Create src/stores/notification.js**

```javascript
import { defineStore } from "pinia";
import { ref } from "vue";
import * as notificationApi from "../api/notifications";

export const useNotificationStore = defineStore("notification", () => {
  const unreadCount = ref(0);
  let pollingTimer = null;

  async function fetchUnreadCount() {
    try {
      const data = await notificationApi.getUnreadCount();
      unreadCount.value = data.count;
    } catch (error) {
      // 静默失败
    }
  }

  function startPolling() {
    stopPolling();
    fetchUnreadCount();
    pollingTimer = setInterval(fetchUnreadCount, 30000);
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  return { unreadCount, fetchUnreadCount, startPolling, stopPolling };
});
```

- [ ] **Step 8: Create src/router/index.js**

```javascript
import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue"),
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("../views/Register.vue"),
  },
  {
    path: "/",
    component: () => import("../layouts/UserLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "TicketList",
        component: () => import("../views/TicketList.vue"),
      },
      {
        path: "tickets/new",
        name: "TicketCreate",
        component: () => import("../views/TicketCreate.vue"),
      },
      {
        path: "tickets/:id",
        name: "TicketDetail",
        component: () => import("../views/TicketDetail.vue"),
      },
      {
        path: "notifications",
        name: "Notifications",
        component: () => import("../views/Notifications.vue"),
      },
    ],
  },
  {
    path: "/admin",
    component: () => import("../layouts/AdminLayout.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: "tickets",
        name: "AdminTickets",
        component: () => import("../views/admin/AdminTickets.vue"),
      },
      {
        path: "notify-rules",
        name: "AdminNotifyRules",
        component: () => import("../views/admin/AdminNotifyRules.vue"),
      },
      {
        path: "users",
        name: "AdminUsers",
        component: () => import("../views/admin/AdminUsers.vue"),
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("../views/NotFound.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (to.meta.requiresAuth && !token) {
    next("/login");
    return;
  }

  if (to.meta.requiresAdmin && user?.role !== "admin") {
    next("/");
    return;
  }

  if ((to.path === "/login" || to.path === "/register") && token) {
    next("/");
    return;
  }

  next();
});

export default router;
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(client): add router, Pinia stores, and API layer with axios interceptors"
```

---

## Task 11: Client Layouts + Auth Pages

**Files:**

- `client/src/layouts/UserLayout.vue`
- `client/src/layouts/AdminLayout.vue`
- `client/src/views/Login.vue`
- `client/src/views/Register.vue`

- [ ] **Step 1: Create src/layouts/UserLayout.vue**

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="glass-card-static border-b border-indigo-500/20 rounded-none"
    >
      <div
        class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center"
          >
            <el-icon :size="18" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <span class="text-lg font-semibold text-slate-200">问题反馈中心</span>
        </div>

        <nav class="flex items-center gap-6">
          <router-link
            to="/"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path === '/'
                ? 'text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            工单
          </router-link>
          <router-link
            to="/notifications"
            class="text-sm transition-colors duration-200 relative"
            :class="
              $route.path === '/notifications'
                ? 'text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            通知
            <span
              v-if="notificationStore.unreadCount > 0"
              class="absolute -top-2 -right-4 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
            >
              {{
                notificationStore.unreadCount > 99
                  ? "99+"
                  : notificationStore.unreadCount
              }}
            </span>
          </router-link>
          <router-link
            v-if="authStore.isAdmin"
            to="/admin/tickets"
            class="text-sm transition-colors duration-200"
            :class="
              $route.path.startsWith('/admin')
                ? 'text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            管理后台
          </router-link>
        </nav>

        <el-dropdown trigger="click" @command="handleCommand">
          <span
            class="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-slate-100 transition-colors"
          >
            <el-avatar :size="32" class="bg-indigo-600">
              {{ authStore.user?.realName?.charAt(0) || "U" }}
            </el-avatar>
            <span class="text-sm">{{ authStore.user?.realName }}</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <main class="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notification";

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

onMounted(() => {
  notificationStore.startPolling();
});

onUnmounted(() => {
  notificationStore.stopPolling();
});

function handleCommand(command) {
  if (command === "logout") {
    authStore.logout();
    notificationStore.stopPolling();
    router.push("/login");
  }
}
</script>
```

- [ ] **Step 2: Create src/layouts/AdminLayout.vue**

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="glass-card-static border-b border-indigo-500/20 rounded-none"
    >
      <div
        class="max-w-full mx-auto px-6 h-16 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center"
          >
            <el-icon :size="18" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <span class="text-lg font-semibold text-slate-200">问题反馈中心</span>
          <el-tag size="small" type="warning" class="ml-2">管理后台</el-tag>
        </div>

        <div class="flex items-center gap-4">
          <router-link
            to="/"
            class="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            返回前台
          </router-link>
          <el-dropdown trigger="click" @command="handleCommand">
            <span
              class="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-slate-100 transition-colors"
            >
              <el-avatar :size="32" class="bg-indigo-600">
                {{ authStore.user?.realName?.charAt(0) || "A" }}
              </el-avatar>
              <span class="text-sm">{{ authStore.user?.realName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </header>

    <div class="flex flex-1">
      <aside
        class="w-56 glass-card-static rounded-none border-r border-indigo-500/20 border-t-0 border-b-0 border-l-0"
      >
        <el-menu
          :default-active="activeMenu"
          router
          background-color="transparent"
          text-color="#94a3b8"
          active-text-color="#818cf8"
          class="border-none"
        >
          <el-menu-item index="/admin/tickets">
            <el-icon><Tickets /></el-icon>
            <span>工单管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/notify-rules">
            <el-icon><Bell /></el-icon>
            <span>通知规则</span>
          </el-menu-item>
          <el-menu-item index="/admin/users">
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
        </el-menu>
      </aside>

      <main class="flex-1 px-8 py-8 overflow-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeMenu = computed(() => route.path);

function handleCommand(command) {
  if (command === "logout") {
    authStore.logout();
    router.push("/login");
  }
}
</script>
```

- [ ] **Step 3: Create src/views/Login.vue**

```vue
<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center"
        >
          <el-icon :size="32" color="#fff"><ChatDotRound /></el-icon>
        </div>
        <h1 class="text-2xl font-bold text-slate-200">问题反馈中心</h1>
        <p class="text-slate-500 mt-2 text-sm">登录您的账号</p>
      </div>

      <div class="glass-card-static p-8">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="handleSubmit"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              prefix-icon="User"
              size="large"
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              prefix-icon="Lock"
              size="large"
              show-password
              @keyup.enter="handleSubmit"
            />
          </el-form-item>

          <el-form-item>
            <button
              type="submit"
              class="btn-gradient w-full py-3 text-base font-medium"
              :disabled="loading"
            >
              {{ loading ? "登录中..." : "登 录" }}
            </button>
          </el-form-item>
        </el-form>

        <div class="text-center text-sm text-slate-500">
          还没有账号？
          <router-link
            to="/register"
            class="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            立即注册
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref(null);
const loading = ref(false);

const form = reactive({
  username: "",
  password: "",
});

const rules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await authStore.login(form);
    ElMessage.success("登录成功");
    router.push("/");
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>
```

- [ ] **Step 4: Create src/views/Register.vue**

```vue
<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center"
        >
          <el-icon :size="32" color="#fff"><ChatDotRound /></el-icon>
        </div>
        <h1 class="text-2xl font-bold text-slate-200">问题反馈中心</h1>
        <p class="text-slate-500 mt-2 text-sm">创建新账号</p>
      </div>

      <div class="glass-card-static p-8">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="handleSubmit"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名（2-50个字符）"
              prefix-icon="User"
              size="large"
            />
          </el-form-item>

          <el-form-item label="姓名" prop="realName">
            <el-input
              v-model="form.realName"
              placeholder="请输入您的姓名"
              prefix-icon="Postcard"
              size="large"
            />
          </el-form-item>

          <el-form-item label="邮箱（选填）" prop="email">
            <el-input
              v-model="form.email"
              placeholder="请输入邮箱"
              prefix-icon="Message"
              size="large"
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码（至少6位）"
              prefix-icon="Lock"
              size="large"
              show-password
            />
          </el-form-item>

          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              prefix-icon="Lock"
              size="large"
              show-password
              @keyup.enter="handleSubmit"
            />
          </el-form-item>

          <el-form-item>
            <button
              type="submit"
              class="btn-gradient w-full py-3 text-base font-medium"
              :disabled="loading"
            >
              {{ loading ? "注册中..." : "注 册" }}
            </button>
          </el-form-item>
        </el-form>

        <div class="text-center text-sm text-slate-500">
          已有账号？
          <router-link
            to="/login"
            class="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            立即登录
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref(null);
const loading = ref(false);

const form = reactive({
  username: "",
  realName: "",
  email: "",
  password: "",
  confirmPassword: "",
});

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error("两次输入的密码不一致"));
  } else {
    callback();
  }
};

const rules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 2, max: 50, message: "用户名长度为2-50个字符", trigger: "blur" },
  ],
  realName: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  email: [{ type: "email", message: "邮箱格式不正确", trigger: "blur" }],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码至少6位", trigger: "blur" },
  ],
  confirmPassword: [
    { required: true, message: "请确认密码", trigger: "blur" },
    { validator: validateConfirmPassword, trigger: "blur" },
  ],
};

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await authStore.register({
      username: form.username,
      password: form.password,
      realName: form.realName,
      email: form.email || undefined,
    });
    ElMessage.success("注册成功");
    router.push("/");
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(client): add user/admin layouts and login/register pages with dark theme"
```

---

## Task 12: Client Ticket List + Create

**Files:**

- `client/src/components/StatusBadge.vue`
- `client/src/components/TicketCard.vue`
- `client/src/components/FileUpload.vue`
- `client/src/views/TicketList.vue`
- `client/src/views/TicketCreate.vue`

- [ ] **Step 1: Create src/components/StatusBadge.vue**

```vue
<template>
  <el-tag :type="tagType" size="small" effect="dark" round>
    {{ label }}
  </el-tag>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  status: {
    type: String,
    required: true,
  },
});

const statusMap = {
  pending: { label: "待处理", type: "warning" },
  processing: { label: "处理中", type: "primary" },
  resolved: { label: "已解决", type: "success" },
  closed: { label: "已关闭", type: "info" },
};

const label = computed(() => statusMap[props.status]?.label || props.status);
const tagType = computed(() => statusMap[props.status]?.type || "info");
</script>
```

- [ ] **Step 2: Create src/components/TicketCard.vue**

```vue
<template>
  <div class="glass-card p-5 cursor-pointer" @click="goDetail">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500 font-mono">{{
          ticket.ticketNo
        }}</span>
        <el-tag size="small" effect="plain" :type="typeTagType">{{
          typeLabel
        }}</el-tag>
      </div>
      <StatusBadge :status="ticket.status" />
    </div>

    <h3 class="text-base font-medium text-slate-200 mb-2 line-clamp-1">
      {{ ticket.title }}
    </h3>

    <div class="flex items-center justify-between text-xs text-slate-500">
      <div class="flex items-center gap-4">
        <span>
          <el-icon class="mr-1"><Flag /></el-icon>
          {{ priorityLabel }}
        </span>
        <span v-if="ticket.assignee">
          处理人：{{ ticket.assignee.realName }}
        </span>
      </div>
      <span>{{ formatTime(ticket.updatedAt) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps({
  ticket: {
    type: Object,
    required: true,
  },
});

const router = useRouter();

const typeMap = {
  bug: { label: "Bug", type: "danger" },
  question: { label: "使用问题", type: "warning" },
  suggestion: { label: "功能建议", type: "success" },
};

const priorityMap = {
  low: "低",
  medium: "中",
  high: "高",
};

const typeLabel = computed(
  () => typeMap[props.ticket.type]?.label || props.ticket.type,
);
const typeTagType = computed(() => typeMap[props.ticket.type]?.type || "info");
const priorityLabel = computed(
  () => priorityMap[props.ticket.priority] || props.ticket.priority,
);

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function goDetail() {
  router.push(`/tickets/${props.ticket.id}`);
}
</script>
```

- [ ] **Step 3: Create src/components/FileUpload.vue**

```vue
<template>
  <div>
    <el-upload
      drag
      :auto-upload="true"
      :http-request="handleUpload"
      :show-file-list="false"
      :accept="acceptTypes"
      multiple
    >
      <el-icon class="el-icon--upload text-indigo-400" :size="40"
        ><UploadFilled
      /></el-icon>
      <div class="el-upload__text text-slate-400">
        拖拽文件到此处，或 <em class="text-indigo-400">点击上传</em>
      </div>
      <template #tip>
        <div class="el-upload__tip text-slate-500">
          支持 jpg/png/gif/mp4/pdf/doc/docx/xls/xlsx/zip/rar，单文件不超过 10MB
        </div>
      </template>
    </el-upload>

    <div v-if="fileList.length > 0" class="mt-3 space-y-2">
      <div
        v-for="file in fileList"
        :key="file.id"
        class="flex items-center justify-between glass-card-static px-4 py-2 rounded-lg"
      >
        <div class="flex items-center gap-3 min-w-0">
          <el-image
            v-if="file.fileType.startsWith('image/')"
            :src="`/api/attachments/${file.id}`"
            :preview-src-list="[`/api/attachments/${file.id}`]"
            class="w-10 h-10 rounded object-cover"
            fit="cover"
          />
          <el-icon v-else :size="20" class="text-slate-400"
            ><Document
          /></el-icon>
          <span class="text-sm text-slate-300 truncate">{{
            file.fileName
          }}</span>
          <span class="text-xs text-slate-500">{{
            formatSize(file.fileSize)
          }}</span>
        </div>
        <el-button type="danger" text size="small" @click="removeFile(file.id)">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import request from "../api/request";

const emit = defineEmits(["update:attachmentIds"]);

const fileList = ref([]);
const acceptTypes =
  ".jpg,.jpeg,.png,.gif,.mp4,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar";

async function handleUpload(options) {
  const formData = new FormData();
  formData.append("file", options.file);

  try {
    const data = await request.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    fileList.value.push(data);
    emitIds();
    ElMessage.success(`${options.file.name} 上传成功`);
  } catch (error) {
    ElMessage.error(`${options.file.name} 上传失败`);
  }
}

function removeFile(id) {
  fileList.value = fileList.value.filter((f) => f.id !== id);
  emitIds();
}

function emitIds() {
  emit(
    "update:attachmentIds",
    fileList.value.map((f) => f.id),
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
</script>
```

- [ ] **Step 4: Create src/views/TicketList.vue**

```vue
<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-slate-200">我的工单</h1>
      <router-link to="/tickets/new">
        <button class="btn-gradient">
          <el-icon class="mr-1"><Plus /></el-icon>新建工单
        </button>
      </router-link>
    </div>

    <div class="glass-card-static p-4 mb-6 flex items-center gap-4 flex-wrap">
      <el-select
        v-model="filters.status"
        placeholder="状态"
        clearable
        size="default"
        class="w-32"
      >
        <el-option label="待处理" value="pending" />
        <el-option label="处理中" value="processing" />
        <el-option label="已解决" value="resolved" />
        <el-option label="已关闭" value="closed" />
      </el-select>
      <el-select
        v-model="filters.type"
        placeholder="类型"
        clearable
        size="default"
        class="w-32"
      >
        <el-option label="Bug" value="bug" />
        <el-option label="使用问题" value="question" />
        <el-option label="功能建议" value="suggestion" />
      </el-select>
      <el-select
        v-model="filters.priority"
        placeholder="优先级"
        clearable
        size="default"
        class="w-32"
      >
        <el-option label="低" value="low" />
        <el-option label="中" value="medium" />
        <el-option label="高" value="high" />
      </el-select>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-indigo-400" :size="32"
        ><Loading
      /></el-icon>
    </div>

    <div v-else-if="tickets.length === 0" class="text-center py-20">
      <el-icon :size="48" class="text-slate-600 mb-4"><FolderOpened /></el-icon>
      <p class="text-slate-500 mb-2">暂无工单</p>
      <p class="text-slate-600 text-sm mb-6">
        遇到问题？提交一个工单让我们帮您解决
      </p>
      <router-link to="/tickets/new">
        <button class="btn-gradient">新建工单</button>
      </router-link>
    </div>

    <div v-else class="space-y-4">
      <TicketCard v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" />
    </div>

    <div v-if="total > pageSize" class="flex justify-center mt-8">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="fetchTickets"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from "vue";
import { listTickets } from "../api/tickets";
import TicketCard from "../components/TicketCard.vue";

const tickets = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const filters = reactive({
  status: "",
  type: "",
  priority: "",
});

watch(filters, () => {
  page.value = 1;
  fetchTickets();
});

onMounted(() => {
  fetchTickets();
});

async function fetchTickets() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    if (filters.priority) params.priority = filters.priority;

    const data = await listTickets(params);
    tickets.value = data.rows;
    total.value = data.count;
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>
```

- [ ] **Step 5: Create src/views/TicketCreate.vue**

```vue
<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-6">
      <router-link
        to="/"
        class="text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        ← 返回工单列表
      </router-link>
      <h1 class="text-xl font-bold text-slate-200 mt-2">新建工单</h1>
    </div>

    <div class="glass-card-static p-8">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="标题" prop="title">
          <el-input
            v-model="form.title"
            placeholder="简要描述您遇到的问题"
            maxlength="200"
            show-word-limit
            size="large"
          />
        </el-form-item>

        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio-button value="bug">Bug</el-radio-button>
            <el-radio-button value="question">使用问题</el-radio-button>
            <el-radio-button value="suggestion">功能建议</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="优先级" prop="priority">
          <el-radio-group v-model="form.priority">
            <el-radio-button value="low">低</el-radio-button>
            <el-radio-button value="medium">中</el-radio-button>
            <el-radio-button value="high">高</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="详细描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="6"
            placeholder="请详细描述问题，包括操作步骤、预期结果和实际结果"
          />
        </el-form-item>

        <el-form-item label="附件（可选）">
          <FileUpload v-model:attachment-ids="attachmentIds" />
        </el-form-item>

        <el-form-item>
          <button
            type="submit"
            class="btn-gradient px-8 py-3"
            :disabled="loading"
          >
            {{ loading ? "提交中..." : "提交工单" }}
          </button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { createTicket } from "../api/tickets";
import FileUpload from "../components/FileUpload.vue";

const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const attachmentIds = ref([]);

const form = reactive({
  title: "",
  type: "bug",
  priority: "medium",
  description: "",
});

const rules = {
  title: [{ required: true, message: "请输入标题", trigger: "blur" }],
};

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const data = await createTicket({
      ...form,
      attachmentIds: attachmentIds.value,
    });
    ElMessage.success(`工单 ${data.ticketNo} 创建成功`);
    router.push(`/tickets/${data.id}`);
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(client): add ticket list, create page, and shared components with dark theme"
```

---

## Task 13: Client Ticket Detail + Discussion

**Files:**

- `client/src/components/CommentItem.vue`
- `client/src/views/TicketDetail.vue`

- [ ] **Step 1: Create src/components/CommentItem.vue**

```vue
<template>
  <div class="flex" :class="isOwn ? 'justify-end' : 'justify-start'">
    <div class="max-w-[80%]" :class="isOwn ? 'order-1' : ''">
      <div
        class="flex items-center gap-2 mb-1"
        :class="isOwn ? 'justify-end' : ''"
      >
        <span class="text-xs font-medium text-slate-400">{{
          comment.author?.realName
        }}</span>
        <span class="text-xs text-slate-600">{{
          formatTime(comment.createdAt)
        }}</span>
      </div>
      <div
        class="rounded-xl px-4 py-3 text-sm leading-relaxed"
        :class="
          isOwn
            ? 'bg-indigo-600/20 border border-indigo-500/30 text-slate-200'
            : 'glass-card-static text-slate-300'
        "
      >
        <p class="whitespace-pre-wrap">{{ comment.content }}</p>

        <div
          v-if="comment.attachments && comment.attachments.length > 0"
          class="mt-3 space-y-2"
        >
          <template v-for="att in comment.attachments" :key="att.id">
            <el-image
              v-if="att.fileType.startsWith('image/')"
              :src="`/api/attachments/${att.id}`"
              :preview-src-list="[`/api/attachments/${att.id}`]"
              class="max-w-[200px] rounded-lg"
              fit="contain"
            />
            <a
              v-else
              :href="`/api/attachments/${att.id}`"
              target="_blank"
              class="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <el-icon><Document /></el-icon>
              {{ att.fileName }}
            </a>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useAuthStore } from "../stores/auth";

const props = defineProps({
  comment: {
    type: Object,
    required: true,
  },
});

const authStore = useAuthStore();
const isOwn = computed(() => props.comment.userId === authStore.user?.id);

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>
```

- [ ] **Step 2: Create src/views/TicketDetail.vue**

```vue
<template>
  <div class="max-w-4xl mx-auto">
    <div class="mb-6">
      <router-link
        to="/"
        class="text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        ← 返回工单列表
      </router-link>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-indigo-400" :size="32"
        ><Loading
      /></el-icon>
    </div>

    <template v-else-if="ticket">
      <!-- 工单信息卡片 -->
      <div class="glass-card-static p-6 mb-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <span class="text-xs text-slate-500 font-mono">{{
                ticket.ticketNo
              }}</span>
              <el-tag size="small" effect="plain" :type="typeTagType">{{
                typeLabel
              }}</el-tag>
              <StatusBadge :status="ticket.status" />
            </div>
            <h1 class="text-lg font-bold text-slate-200">{{ ticket.title }}</h1>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-slate-500">优先级</span>
            <p class="text-slate-300 mt-1">{{ priorityLabel }}</p>
          </div>
          <div>
            <span class="text-slate-500">提交人</span>
            <p class="text-slate-300 mt-1">{{ ticket.creator?.realName }}</p>
          </div>
          <div>
            <span class="text-slate-500">处理人</span>
            <p class="text-slate-300 mt-1">
              {{ ticket.assignee?.realName || "未分配" }}
            </p>
          </div>
          <div>
            <span class="text-slate-500">创建时间</span>
            <p class="text-slate-300 mt-1">
              {{ formatTime(ticket.createdAt) }}
            </p>
          </div>
        </div>

        <div
          v-if="ticket.description"
          class="mt-4 pt-4 border-t border-indigo-500/10"
        >
          <p class="text-sm text-slate-400 whitespace-pre-wrap">
            {{ ticket.description }}
          </p>
        </div>

        <div
          v-if="ticket.attachments && ticket.attachments.length > 0"
          class="mt-4 pt-4 border-t border-indigo-500/10"
        >
          <span class="text-sm text-slate-500 mb-2 block">附件</span>
          <div class="flex flex-wrap gap-3">
            <template v-for="att in ticket.attachments" :key="att.id">
              <el-image
                v-if="att.fileType.startsWith('image/')"
                :src="`/api/attachments/${att.id}`"
                :preview-src-list="[`/api/attachments/${att.id}`]"
                class="w-20 h-20 rounded-lg"
                fit="cover"
              />
              <a
                v-else
                :href="`/api/attachments/${att.id}`"
                target="_blank"
                class="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 glass-card-static px-3 py-2 rounded-lg transition-colors"
              >
                <el-icon><Document /></el-icon>
                {{ att.fileName }}
              </a>
            </template>
          </div>
        </div>

        <!-- 状态操作按钮 -->
        <div
          v-if="
            ticket.status === 'resolved' && ticket.userId === authStore.user?.id
          "
          class="mt-4 pt-4 border-t border-indigo-500/10 flex gap-3"
        >
          <el-button type="success" @click="handleStatusChange('closed')">
            <el-icon class="mr-1"><Check /></el-icon>确认解决
          </el-button>
          <el-button type="warning" @click="handleStatusChange('processing')">
            <el-icon class="mr-1"><RefreshRight /></el-icon>未解决，继续讨论
          </el-button>
        </div>
      </div>

      <!-- 讨论区 -->
      <div class="glass-card-static p-6">
        <h2 class="text-base font-semibold text-slate-200 mb-6">讨论记录</h2>

        <div v-if="comments.length === 0" class="text-center py-10">
          <p class="text-slate-500 text-sm">暂无讨论，发表第一条评论吧</p>
        </div>

        <div v-else class="space-y-6">
          <CommentItem
            v-for="comment in comments"
            :key="comment.id"
            :comment="comment"
          />
        </div>

        <!-- 评论输入区 -->
        <div class="mt-8 pt-6 border-t border-indigo-500/10">
          <el-input
            v-model="newComment"
            type="textarea"
            :rows="3"
            placeholder="输入您的评论..."
            class="mb-3"
          />
          <div class="flex items-center justify-between">
            <FileUpload v-model:attachment-ids="commentAttachmentIds" />
            <button
              class="btn-gradient px-6 py-2 ml-4 shrink-0"
              :disabled="!newComment.trim() || submitting"
              @click="submitComment"
            >
              {{ submitting ? "发送中..." : "发送" }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import {
  getTicketDetail,
  updateTicketStatus,
  listComments,
  createComment,
} from "../api/tickets";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notification";
import StatusBadge from "../components/StatusBadge.vue";
import CommentItem from "../components/CommentItem.vue";
import FileUpload from "../components/FileUpload.vue";

const route = useRoute();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const ticket = ref(null);
const comments = ref([]);
const loading = ref(false);
const newComment = ref("");
const commentAttachmentIds = ref([]);
const submitting = ref(false);

const typeMap = {
  bug: { label: "Bug", type: "danger" },
  question: { label: "使用问题", type: "warning" },
  suggestion: { label: "功能建议", type: "success" },
};

const priorityMap = { low: "低", medium: "中", high: "高" };

const typeLabel = computed(() => typeMap[ticket.value?.type]?.label || "");
const typeTagType = computed(() => typeMap[ticket.value?.type]?.type || "info");
const priorityLabel = computed(() => priorityMap[ticket.value?.priority] || "");

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

onMounted(() => {
  fetchTicket();
  fetchComments();
});

async function fetchTicket() {
  loading.value = true;
  try {
    ticket.value = await getTicketDetail(route.params.id);
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function fetchComments() {
  try {
    comments.value = await listComments(route.params.id);
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function handleStatusChange(status) {
  try {
    await updateTicketStatus(route.params.id, status);
    ElMessage.success("状态更新成功");
    notificationStore.fetchUnreadCount();
    fetchTicket();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function submitComment() {
  if (!newComment.value.trim()) return;

  submitting.value = true;
  try {
    await createComment(route.params.id, {
      content: newComment.value,
      attachmentIds: commentAttachmentIds.value,
    });
    newComment.value = "";
    commentAttachmentIds.value = [];
    ElMessage.success("评论发送成功");
    fetchComments();
    fetchTicket();
    notificationStore.fetchUnreadCount();
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    submitting.value = false;
  }
}
</script>
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(client): add ticket detail page with discussion timeline and status actions"
```

---

## Task 14: Client Notifications + Admin Pages

**Files:**

- `client/src/views/Notifications.vue`
- `client/src/views/admin/AdminTickets.vue`
- `client/src/views/admin/AdminNotifyRules.vue`
- `client/src/views/admin/AdminUsers.vue`
- `client/src/views/NotFound.vue`

- [ ] **Step 1: Create src/views/Notifications.vue**

```vue
<template>
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-slate-200">通知中心</h1>
      <el-button
        v-if="notifications.length > 0"
        type="primary"
        text
        @click="handleMarkAllRead"
      >
        <el-icon class="mr-1"><Check /></el-icon>全部已读
      </el-button>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-indigo-400" :size="32"
        ><Loading
      /></el-icon>
    </div>

    <div v-else-if="notifications.length === 0" class="text-center py-20">
      <el-icon :size="48" class="text-slate-600 mb-4"><Bell /></el-icon>
      <p class="text-slate-500">暂无通知</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in notifications"
        :key="item.id"
        class="glass-card p-4 cursor-pointer flex items-start gap-4"
        :class="{ 'opacity-60': item.isRead }"
        @click="goTicket(item)"
      >
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          :class="iconBgClass(item.type)"
        >
          <el-icon :size="18" color="#fff">
            <component :is="iconName(item.type)" />
          </el-icon>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-300">{{ item.content }}</p>
          <p class="text-xs text-slate-500 mt-1">
            {{ formatTime(item.createdAt) }}
          </p>
        </div>
        <span
          v-if="!item.isRead"
          class="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2"
        ></span>
      </div>
    </div>

    <div v-if="total > pageSize" class="flex justify-center mt-8">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="fetchNotifications"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { listNotifications, markRead } from "../api/notifications";
import { useNotificationStore } from "../stores/notification";

const router = useRouter();
const notificationStore = useNotificationStore();

const notifications = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

onMounted(() => {
  fetchNotifications();
});

async function fetchNotifications() {
  loading.value = true;
  try {
    const data = await listNotifications({
      page: page.value,
      pageSize: pageSize.value,
    });
    notifications.value = data.rows;
    total.value = data.count;
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function handleMarkAllRead() {
  try {
    await markRead({ all: true });
    ElMessage.success("已全部标记为已读");
    notificationStore.fetchUnreadCount();
    fetchNotifications();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function goTicket(item) {
  if (item.ticketId) {
    router.push(`/tickets/${item.ticketId}`);
  }
}

function iconName(type) {
  const map = {
    new_ticket: "Plus",
    new_comment: "ChatDotRound",
    status_change: "Refresh",
    assigned: "User",
  };
  return map[type] || "Bell";
}

function iconBgClass(type) {
  const map = {
    new_ticket: "bg-indigo-600",
    new_comment: "bg-cyan-600",
    status_change: "bg-amber-600",
    assigned: "bg-green-600",
  };
  return map[type] || "bg-slate-600";
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>
```

- [ ] **Step 2: Create src/views/admin/AdminTickets.vue**

```vue
<template>
  <div>
    <h1 class="text-xl font-bold text-slate-200 mb-6">工单管理</h1>

    <div class="glass-card-static p-4 mb-6 flex items-center gap-4">
      <el-select
        v-model="filters.status"
        placeholder="状态"
        clearable
        class="w-32"
      >
        <el-option label="待处理" value="pending" />
        <el-option label="处理中" value="processing" />
        <el-option label="已解决" value="resolved" />
        <el-option label="已关闭" value="closed" />
      </el-select>
      <el-select
        v-model="filters.type"
        placeholder="类型"
        clearable
        class="w-32"
      >
        <el-option label="Bug" value="bug" />
        <el-option label="使用问题" value="question" />
        <el-option label="功能建议" value="suggestion" />
      </el-select>
    </div>

    <div class="glass-card-static p-4">
      <el-table :data="tickets" v-loading="loading" stripe>
        <el-table-column prop="ticketNo" label="工单号" width="160" />
        <el-table-column
          prop="title"
          label="标题"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="typeTagType(row.type)">{{
              typeLabel(row.type)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="80">
          <template #default="{ row }">{{
            priorityLabel(row.priority)
          }}</template>
        </el-table-column>
        <el-table-column label="提交人" width="100">
          <template #default="{ row }">{{ row.creator?.realName }}</template>
        </el-table-column>
        <el-table-column label="处理人" width="100">
          <template #default="{ row }">{{
            row.assignee?.realName || "未分配"
          }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="160">
          <template #default="{ row }">{{
            formatTime(row.updatedAt)
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              text
              @click="openAssignDialog(row)"
            >
              分配
            </el-button>
            <el-dropdown
              trigger="click"
              @command="(cmd) => handleStatusChange(row, cmd)"
            >
              <el-button size="small" type="warning" text>
                变更状态<el-icon class="ml-1"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="pending">待处理</el-dropdown-item>
                  <el-dropdown-item command="processing"
                    >处理中</el-dropdown-item
                  >
                  <el-dropdown-item command="resolved">已解决</el-dropdown-item>
                  <el-dropdown-item command="closed">已关闭</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="flex justify-center mt-6">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="fetchTickets"
        />
      </div>
    </div>

    <!-- 分配对话框 -->
    <el-dialog v-model="assignDialogVisible" title="分配处理人" width="400px">
      <el-select
        v-model="selectedAssignee"
        placeholder="选择处理人"
        class="w-full"
      >
        <el-option
          v-for="user in users"
          :key="user.id"
          :label="user.realName"
          :value="user.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssign">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
import * as adminApi from "../../api/admin";
import StatusBadge from "../../components/StatusBadge.vue";

const tickets = ref([]);
const users = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const assignDialogVisible = ref(false);
const selectedAssignee = ref(null);
const currentTicket = ref(null);

const filters = reactive({ status: "", type: "" });

watch(filters, () => {
  page.value = 1;
  fetchTickets();
});

onMounted(() => {
  fetchTickets();
  fetchUsers();
});

async function fetchTickets() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    const data = await adminApi.listTickets(params);
    tickets.value = data.rows;
    total.value = data.count;
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function fetchUsers() {
  try {
    users.value = await adminApi.listUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function openAssignDialog(row) {
  currentTicket.value = row;
  selectedAssignee.value = row.assigneeId;
  assignDialogVisible.value = true;
}

async function handleAssign() {
  try {
    await adminApi.updateTicket(currentTicket.value.id, {
      assigneeId: selectedAssignee.value,
    });
    ElMessage.success("分配成功");
    assignDialogVisible.value = false;
    fetchTickets();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function handleStatusChange(row, status) {
  try {
    await adminApi.updateTicket(row.id, { status });
    ElMessage.success("状态变更成功");
    fetchTickets();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function typeLabel(type) {
  const map = { bug: "Bug", question: "使用问题", suggestion: "功能建议" };
  return map[type] || type;
}

function typeTagType(type) {
  const map = { bug: "danger", question: "warning", suggestion: "success" };
  return map[type] || "info";
}

function priorityLabel(p) {
  const map = { low: "低", medium: "中", high: "高" };
  return map[p] || p;
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>
```

- [ ] **Step 3: Create src/views/admin/AdminNotifyRules.vue**

```vue
<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-slate-200">通知规则</h1>
      <el-button type="primary" @click="openAddDialog">
        <el-icon class="mr-1"><Plus /></el-icon>新增规则
      </el-button>
    </div>

    <div class="glass-card-static p-4">
      <el-table :data="rules" v-loading="loading" stripe>
        <el-table-column label="用户" width="150">
          <template #default="{ row }"
            >{{ row.user?.realName }} ({{ row.user?.username }})</template
          >
        </el-table-column>
        <el-table-column label="工单类型" width="150">
          <template #default="{ row }">
            {{ row.ticketType ? typeLabel(row.ticketType) : "全部类型" }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? "启用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button
              size="small"
              text
              :type="row.isActive ? 'warning' : 'success'"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? "停用" : "启用" }}
            </el-button>
            <el-button
              size="small"
              text
              type="danger"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增规则对话框 -->
    <el-dialog v-model="addDialogVisible" title="新增通知规则" width="400px">
      <el-form label-position="top">
        <el-form-item label="选择用户">
          <el-select
            v-model="newRule.userId"
            placeholder="选择用户"
            class="w-full"
          >
            <el-option
              v-for="user in users"
              :key="user.id"
              :label="user.realName"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="工单类型">
          <el-select
            v-model="newRule.ticketType"
            placeholder="全部类型"
            clearable
            class="w-full"
          >
            <el-option label="Bug" value="bug" />
            <el-option label="使用问题" value="question" />
            <el-option label="功能建议" value="suggestion" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdd">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as adminApi from "../../api/admin";

const rules = ref([]);
const users = ref([]);
const loading = ref(false);
const addDialogVisible = ref(false);

const newRule = reactive({
  userId: null,
  ticketType: null,
});

onMounted(() => {
  fetchRules();
  fetchUsers();
});

async function fetchRules() {
  loading.value = true;
  try {
    rules.value = await adminApi.listNotifyRules();
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function fetchUsers() {
  try {
    users.value = await adminApi.listUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function openAddDialog() {
  newRule.userId = null;
  newRule.ticketType = null;
  addDialogVisible.value = true;
}

async function handleAdd() {
  if (!newRule.userId) {
    ElMessage.warning("请选择用户");
    return;
  }
  try {
    await adminApi.createNotifyRule({
      userId: newRule.userId,
      ticketType: newRule.ticketType || null,
    });
    ElMessage.success("规则创建成功");
    addDialogVisible.value = false;
    fetchRules();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function toggleActive(row) {
  try {
    await adminApi.updateNotifyRule(row.id, { isActive: !row.isActive });
    ElMessage.success(row.isActive ? "已停用" : "已启用");
    fetchRules();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm("确定要删除此规则吗？", "提示", {
      type: "warning",
    });
    await adminApi.deleteNotifyRule(row.id);
    ElMessage.success("删除成功");
    fetchRules();
  } catch (error) {
    // 取消或错误
  }
}

function typeLabel(type) {
  const map = { bug: "Bug", question: "使用问题", suggestion: "功能建议" };
  return map[type] || type;
}
</script>
```

- [ ] **Step 4: Create src/views/admin/AdminUsers.vue**

```vue
<template>
  <div>
    <h1 class="text-xl font-bold text-slate-200 mb-6">用户管理</h1>

    <div class="glass-card-static p-4">
      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column
          prop="email"
          label="邮箱"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">{{ row.email || "-" }}</template>
        </el-table-column>
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.role === 'admin' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.role === "admin" ? "管理员" : "用户" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
              {{ row.isActive ? "启用" : "禁用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="160">
          <template #default="{ row }">{{
            formatTime(row.createdAt)
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              text
              :type="row.isActive ? 'danger' : 'success'"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? "禁用" : "启用" }}
            </el-button>
            <el-button
              size="small"
              text
              type="primary"
              @click="toggleRole(row)"
            >
              {{ row.role === "admin" ? "设为用户" : "设为管理员" }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import * as adminApi from "../../api/admin";

const users = ref([]);
const loading = ref(false);

onMounted(() => {
  fetchUsers();
});

async function fetchUsers() {
  loading.value = true;
  try {
    users.value = await adminApi.listUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function toggleActive(row) {
  try {
    await adminApi.updateUser(row.id, { isActive: !row.isActive });
    ElMessage.success(row.isActive ? "已禁用" : "已启用");
    fetchUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function toggleRole(row) {
  try {
    const newRole = row.role === "admin" ? "user" : "admin";
    await adminApi.updateUser(row.id, { role: newRole });
    ElMessage.success("角色变更成功");
    fetchUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>
```

- [ ] **Step 5: Create src/views/NotFound.vue**

```vue
<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-indigo-500/30 mb-4">404</h1>
      <p class="text-slate-400 mb-8">页面不存在</p>
      <router-link to="/">
        <button class="btn-gradient">返回首页</button>
      </router-link>
    </div>
  </div>
</template>

<script setup></script>
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(client): add notifications page, admin pages (tickets, notify rules, users), and 404 page"
```

---

## Task 15: Integration + Seed Data + Final Verification

**Files:**

- `server/src/seed.js`
- `server/package.json` (update scripts)

- [ ] **Step 1: Create server/src/seed.js**

```javascript
const bcrypt = require("bcryptjs");
const sequelize = require("./config/database");
const { User, Ticket, Comment, NotifyRule } = require("./models");
const { generateTicketNo } = require("./services/ticketService");

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("数据库连接成功");
    await sequelize.sync({ force: true });
    console.log("数据库表已重建");

    // 创建管理员
    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    const admin = await User.create({
      username: "admin",
      passwordHash: adminPasswordHash,
      realName: "系统管理员",
      email: "admin@example.com",
      role: "admin",
    });
    console.log("管理员创建成功: admin / admin123");

    // 创建开发者
    const devPasswordHash = await bcrypt.hash("dev123", 10);
    const dev = await User.create({
      username: "developer",
      passwordHash: devPasswordHash,
      realName: "张开发",
      email: "dev@example.com",
      role: "user",
    });
    console.log("开发者创建成功: developer / dev123");

    // 创建普通用户
    const userPasswordHash = await bcrypt.hash("user123", 10);
    const user = await User.create({
      username: "testuser",
      passwordHash: userPasswordHash,
      realName: "李用户",
      email: "user@example.com",
      role: "user",
    });
    console.log("普通用户创建成功: testuser / user123");

    // 创建通知规则
    await NotifyRule.create({ userId: admin.id, ticketType: null });
    await NotifyRule.create({ userId: dev.id, ticketType: "bug" });
    console.log("通知规则创建成功");

    // 创建示例工单
    const ticketNo1 = await generateTicketNo();
    const ticket1 = await Ticket.create({
      ticketNo: ticketNo1,
      title: "登录页面在 Safari 浏览器上显示异常",
      description:
        "在 Safari 15 上打开登录页面，输入框样式错乱，按钮无法点击。\n\n复现步骤：\n1. 打开 Safari 浏览器\n2. 访问登录页面\n3. 观察输入框和按钮样式",
      type: "bug",
      status: "processing",
      priority: "high",
      userId: user.id,
      assigneeId: dev.id,
    });

    const ticketNo2 = await generateTicketNo();
    const ticket2 = await Ticket.create({
      ticketNo: ticketNo2,
      title: "如何导出工单数据？",
      description:
        "请问系统是否支持将工单数据导出为 Excel 文件？如果支持，应该如何操作？",
      type: "question",
      status: "pending",
      priority: "medium",
      userId: user.id,
    });

    const ticketNo3 = await generateTicketNo();
    const ticket3 = await Ticket.create({
      ticketNo: ticketNo3,
      title: "建议增加工单模板功能",
      description:
        "很多用户反馈的问题类型相似，建议增加工单模板功能，让用户可以选择模板快速提交工单，提高提交效率。",
      type: "suggestion",
      status: "resolved",
      priority: "low",
      userId: user.id,
      assigneeId: admin.id,
    });
    console.log("示例工单创建成功");

    // 创建示例评论
    await Comment.create({
      ticketId: ticket1.id,
      userId: dev.id,
      content:
        "已收到反馈，正在排查 Safari 兼容性问题。初步判断是 CSS flex 布局的兼容性问题。",
    });

    await Comment.create({
      ticketId: ticket1.id,
      userId: user.id,
      content:
        "好的，谢谢！补充一下，我的 Safari 版本是 15.4，macOS Monterey 系统。",
    });

    await Comment.create({
      ticketId: ticket3.id,
      userId: admin.id,
      content: "感谢建议！工单模板功能已纳入下一版本开发计划，预计两周后上线。",
    });
    console.log("示例评论创建成功");

    console.log("\n种子数据创建完成！");
    process.exit(0);
  } catch (error) {
    console.error("种子数据创建失败:", error);
    process.exit(1);
  }
}

seed();
```

- [ ] **Step 2: Add seed script to package.json**

Update `server/package.json` scripts:

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "test": "jest --forceExit --detectOpenHandles",
    "seed": "node src/seed.js"
  }
}
```

- [ ] **Step 3: Run full backend test suite**

```bash
cd server
npx jest --forceExit --detectOpenHandles
```

- [ ] **Step 4: Run seed data**

```bash
npm run seed
```

- [ ] **Step 5: Start server and client for manual verification**

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd client
npm run dev
```

- [ ] **Step 6: Verify full flow manually**

Verify the following flow works end-to-end:

1. 打开 http://localhost:5173 → 跳转到登录页
2. 注册新用户 → 自动登录 → 跳转首页
3. 新建工单（填写标题、类型、优先级、描述）→ 提交成功 → 跳转详情页
4. 在工单详情页发表评论
5. 用 admin/admin123 登录 → 进入管理后台
6. 管理后台分配工单处理人 → 变更状态为 resolved
7. 切回普通用户 → 查看通知（应收到状态变更通知）
8. 在工单详情页点击「确认解决」→ 工单关闭
9. 通知中心标记全部已读

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: add seed data and complete full-stack integration verification"
```
