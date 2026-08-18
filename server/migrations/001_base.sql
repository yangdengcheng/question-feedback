-- ============================================================
-- 001_base.sql — 初始建库（基线，线上已存在则跳过）
-- 说明：本文件为数据库结构的基线记录，
-- 线上已有表时会因 IF NOT EXISTS / 幂等操作而安全跳过。
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL UNIQUE COMMENT '登录账号',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 哈希',
  real_name  VARCHAR(50)  NOT NULL COMMENT '真实姓名',
  email      VARCHAR(100) NULL COMMENT '邮箱',
  role       ENUM('customer','data_maintenance','dev_lead','developer','tester','admin') NOT NULL DEFAULT 'customer' COMMENT '角色',
  is_active  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '启用状态',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 工单表
CREATE TABLE IF NOT EXISTS tickets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  ticket_no   VARCHAR(20)  NOT NULL UNIQUE COMMENT '工单编号（FB-YYYYMMDD-NNN）',
  title       VARCHAR(200) NOT NULL COMMENT '标题',
  description TEXT         NULL COMMENT '详细描述',
  type        ENUM('bug','question') NOT NULL DEFAULT 'bug' COMMENT '类型',
  status      ENUM('pending','processing','resolved','closed') NOT NULL DEFAULT 'pending' COMMENT '状态',
  priority    ENUM('low','medium','high') NOT NULL DEFAULT 'medium' COMMENT '优先级',
  is_public   TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否公开：1公开（所有人可见） 0非公开（仅创建人和处理人可见）',
  user_id     INT          NOT NULL COMMENT '创建人',
  assignee_id INT          NULL COMMENT '处理人',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_user_id (user_id),
  INDEX idx_assignee_id (assignee_id),
  FULLTEXT KEY ft_tickets_title (title) WITH PARSER ngram,
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_tickets_assignee FOREIGN KEY (assignee_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单表';

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id  INT          NOT NULL COMMENT '所属工单',
  user_id    INT          NOT NULL COMMENT '评论人',
  content    TEXT         NOT NULL COMMENT '评论内容',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评论表';

-- 附件表
CREATE TABLE IF NOT EXISTS attachments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id   INT          NULL COMMENT '关联工单',
  comment_id  INT          NULL COMMENT '关联评论',
  log_id      INT          NULL COMMENT '关联操作日志',
  file_name   VARCHAR(255) NOT NULL COMMENT '原始文件名',
  file_path   VARCHAR(500) NOT NULL COMMENT '服务端存储路径',
  file_size   INT          NOT NULL COMMENT '文件大小（字节）',
  file_type   VARCHAR(100) NOT NULL COMMENT 'MIME 类型',
  uploaded_by INT          NOT NULL COMMENT '上传人',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_comment_id (comment_id),
  INDEX idx_log_id (log_id),
  CONSTRAINT fk_attachments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  CONSTRAINT fk_attachments_comment FOREIGN KEY (comment_id) REFERENCES comments(id),
  CONSTRAINT fk_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='附件表';

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL COMMENT '接收人',
  ticket_id  INT          NOT NULL COMMENT '关联工单',
  type       ENUM('new_ticket','new_comment','status_change','assigned') NOT NULL COMMENT '通知类型',
  content    VARCHAR(500) NOT NULL COMMENT '通知内容',
  is_read    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '已读标记',
  read_at    DATETIME     NULL COMMENT '已读时间',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_notifications_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知表';

-- 工单操作日志表
CREATE TABLE IF NOT EXISTS ticket_logs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id        INT          NOT NULL COMMENT '关联工单',
  user_id          INT          NOT NULL COMMENT '操作人',
  action           ENUM('created','assigned','transferred','status_changed','commented','reopened') NOT NULL COMMENT '操作类型',
  from_status      VARCHAR(20)  NULL COMMENT '原状态',
  to_status        VARCHAR(20)  NULL COMMENT '新状态',
  from_assignee_id INT          NULL COMMENT '原处理人',
  to_assignee_id   INT          NULL COMMENT '新处理人',
  content          TEXT         NULL COMMENT '附加说明',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_id (ticket_id),
  CONSTRAINT fk_ticket_logs_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单操作日志表';

-- 工具包字典表（省份/分类）
CREATE TABLE IF NOT EXISTS tool_dicts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       ENUM('province','category') NOT NULL COMMENT '字典类型',
  code       VARCHAR(50)  NULL COMMENT '编码',
  name       VARCHAR(50)  NOT NULL COMMENT '名称',
  is_active  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '启用状态',
  sort_order INT          NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具包字典表';

-- 工具包表
CREATE TABLE IF NOT EXISTS tool_packages (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(100) NOT NULL COMMENT '工具包名称',
  province_id        INT          NULL COMMENT '省份（字典）',
  category_id        INT          NULL COMMENT '分类（字典）',
  summary            VARCHAR(200) NULL COMMENT '一句话简介',
  doc_markdown       MEDIUMTEXT   NULL COMMENT '说明文档（Markdown）',
  current_version_id INT          NULL COMMENT '当前最新版本',
  is_active          TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '上架状态',
  created_by         INT          NOT NULL COMMENT '创建人',
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tool_packages_province FOREIGN KEY (province_id) REFERENCES tool_dicts(id),
  CONSTRAINT fk_tool_packages_category FOREIGN KEY (category_id) REFERENCES tool_dicts(id),
  CONSTRAINT fk_tool_packages_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具包表';

-- 工具包版本表
CREATE TABLE IF NOT EXISTS tool_package_versions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  package_id   INT          NOT NULL COMMENT '所属工具包',
  version      VARCHAR(50)  NOT NULL COMMENT '版本号',
  release_note TEXT         NULL COMMENT '更新说明',
  file_url     VARCHAR(500) NOT NULL COMMENT '文件存储路径',
  file_name    VARCHAR(255) NOT NULL COMMENT '原始文件名',
  file_size    INT          NOT NULL COMMENT '文件大小',
  created_by   INT          NOT NULL COMMENT '发布人',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_package_version (package_id, version),
  CONSTRAINT fk_tool_package_versions_package FOREIGN KEY (package_id) REFERENCES tool_packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_tool_package_versions_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具包版本表';

-- 工具包 current_version 自引用（建表后补加，幂等）
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_tool_packages_current_version');
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE tool_packages ADD CONSTRAINT fk_tool_packages_current_version FOREIGN KEY (current_version_id) REFERENCES tool_package_versions(id) ON DELETE SET NULL',
  'SELECT ''FK already exists'' AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
