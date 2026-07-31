# 部署文档

本文档描述如何将「问题反馈工单系统」部署到一台 Linux 服务器（自建部署）。整体架构：

```
浏览器
  │
  ▼
Nginx（:80 / :443）
  ├── 静态资源  →  client/dist（前端构建产物）
  ├── /api/*    →  反向代理 → Node.js（:3000，PM2 守护）
  └── /uploads/*→  反向代理 → Node.js（:3000）或 alias 到上传目录
                                    │
                                    ▼
                              MySQL（:3306）
```

- **前端**：Vite 构建为纯静态文件，由 Nginx 直接托管。
- **后端**：Express 服务监听 `3000`，由 PM2 守护进程。
- **数据库**：MySQL，后端通过 Sequelize 连接。
- **上传文件**：存储在 `server/uploads/`，通过后端 `/uploads` 静态路由对外提供。

---

## 一、环境要求

| 组件 | 版本 |
| --- | --- |
| Node.js | 20.19+（或 22.12+） |
| MySQL | 5.7+ / 8.0+ |
| Nginx | 1.18+ |
| PM2 | 5.x（`npm i -g pm2`） |

---

## 二、准备数据库

```bash
mysql -u root -p
```

```sql
CREATE DATABASE question_feedback DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 建议为应用创建独立账号（替换为你的密码）
CREATE USER 'qfeedback'@'localhost' IDENTIFIED BY '强密码';
GRANT ALL PRIVILEGES ON question_feedback.* TO 'qfeedback'@'localhost';
FLUSH PRIVILEGES;
```

> 表结构无需手动导入：后端首次启动时 `sequelize.sync()` 会自动建表；工具字典种子（`seedToolkitDicts`）也会在服务启动时自动写入。

---

## 三、部署后端

### 1. 获取代码

```bash
cd /var/www
git clone <你的仓库地址> question-feedback
cd question-feedback/server
```

### 2. 安装依赖

```bash
npm install --omit=dev
```

### 3. 配置环境变量

```bash
cp .env.example .env
vim .env
```

生产环境 `.env` 示例：

```ini
DB_HOST=localhost
DB_PORT=3306
DB_NAME=question_feedback
DB_USER=qfeedback
DB_PASSWORD=强密码
JWT_SECRET=一段足够长且随机的字符串_生产务必修改
PORT=3000
```

> `JWT_SECRET` 请使用随机长字符串（如 `openssl rand -hex 32` 生成），切勿沿用示例值。

### 4. 初始化数据（可选）

若需要示例账号与演示数据，可执行种子脚本。**注意：`seed.js` 会 `sync({ force: true })` 清空并重建所有表，仅用于首次初始化或测试环境，生产环境慎用。**

```bash
npm run seed
```

若仅需建表而不写入演示数据，直接进行下一步，首次启动会自动建表。生产环境的管理员账号建议通过注册接口或单独脚本创建，并及时修改默认密码。

### 5. 使用 PM2 启动

```bash
pm2 start src/server.js --name qfeedback-server
pm2 save
pm2 startup        # 按提示执行返回的命令，设置开机自启
```

常用运维命令：

```bash
pm2 status                 # 查看进程状态
pm2 logs qfeedback-server  # 查看日志
pm2 restart qfeedback-server
```

### 6. 验证后端

```bash
curl http://localhost:3000/api/health
# 期望输出：{"status":"ok"}
```

### 7. 上传目录

确保上传目录存在且进程可写：

```bash
mkdir -p uploads
# 若以非 root 用户运行 PM2，确保该用户对 uploads 有写权限
```

---

## 四、构建前端

```bash
cd /var/www/question-feedback/client
npm install
npm run build
```

构建产物输出到 `client/dist/`，由 Nginx 托管。

> 前端通过相对路径 `/api` 与 `/uploads` 访问后端，由 Nginx 反向代理，因此**无需**在构建时配置后端地址。

---

## 五、配置 Nginx

创建站点配置 `/etc/nginx/conf.d/qfeedback.conf`：

```nginx
server {
    listen 80;
    server_name your.domain.com;   # 替换为你的域名或服务器 IP

    # 前端静态资源
    root /var/www/question-feedback/client/dist;
    index index.html;

    # 上传大小限制（按需调整，需 ≥ 后端允许的最大附件）
    client_max_body_size 20m;

    # SPA 前端路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件反向代理（也可改为 alias 直接由 Nginx 托管）
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

> 若希望由 Nginx 直接托管上传文件以减轻 Node 压力，可将 `/uploads/` 块改为：
>
> ```nginx
> location /uploads/ {
>     alias /var/www/question-feedback/server/uploads/;
> }
> ```

启用并重载：

```bash
nginx -t                 # 校验配置
systemctl reload nginx   # 或 nginx -s reload
```

### HTTPS（推荐）

使用 certbot 申请免费证书：

```bash
apt install certbot python3-certbot-nginx   # Debian/Ubuntu
certbot --nginx -d your.domain.com
```

certbot 会自动改写 Nginx 配置并配置 80 → 443 跳转与自动续期。

---

## 六、上线验证清单

- [ ] `curl http://localhost:3000/api/health` 返回 `{"status":"ok"}`
- [ ] 浏览器访问域名，前端首页正常加载（无 404 / 白屏）
- [ ] 登录功能正常（JWT 签发与鉴权）
- [ ] 工单创建、列表、详情正常
- [ ] 附件 / 图片上传与回显正常（`/uploads` 可访问）
- [ ] 刷新前端子路由（如 `/tickets/1`）不 404（SPA 回退生效）
- [ ] `pm2 status` 中进程为 `online`，重启服务器后自动拉起

---

## 七、更新发布

```bash
cd /var/www/question-feedback
git pull

# 后端：依赖有变更时重新安装并重启
cd server
npm install --omit=dev
pm2 restart qfeedback-server

# 前端：重新构建
cd ../client
npm install
npm run build
```

前端为纯静态文件，构建完成后 Nginx 即时生效，无需重启。

> 数据库表结构变更：本项目使用 `sequelize.sync()` 自动同步模型。新增字段/表会在重启后端时自动创建；但 `sync()` **不会**安全地修改/删除已有列，涉及破坏性结构变更时请手动执行 SQL 迁移。

---

## 八、常见问题

| 现象 | 排查方向 |
| --- | --- |
| 前端能打开但接口 502 | 后端未启动 / PM2 进程异常，`pm2 logs` 查看 |
| 接口返回 401 | `JWT_SECRET` 变更导致旧 token 失效，重新登录 |
| 上传失败 413 | Nginx `client_max_body_size` 过小，调大后 reload |
| 上传文件无法访问 | `uploads/` 目录权限，或 `/uploads` 代理 / alias 配置 |
| 刷新子路由 404 | Nginx 缺少 `try_files ... /index.html` 回退 |
| 数据库连接失败 | `.env` 中数据库账号密码 / 主机端口，及 MySQL 账号授权 |
| 中文乱码 | 数据库字符集应为 `utf8mb4` |

---

## 九、备份

定期备份 MySQL 与上传目录：

```bash
# 数据库
mysqldump -u qfeedback -p question_feedback > backup_$(date +%F).sql

# 上传文件
tar -czf uploads_$(date +%F).tar.gz /var/www/question-feedback/server/uploads
```

建议通过 crontab 设置每日自动备份并异地留存。
