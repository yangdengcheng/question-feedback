-- ============================================================
-- 002_workbench.sql — 工作台（2026-08-14 新增）
-- 说明：工作台卡片表，每张卡片对应一个服务地址（如监控面板）。
-- ============================================================

CREATE TABLE IF NOT EXISTS workbenches (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL COMMENT '工作台名称',
  url        VARCHAR(255) NOT NULL COMMENT '服务地址，如 http://192.168.0.3:5180/',
  created_by INT          NOT NULL COMMENT '创建人',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX uk_url (url),
  INDEX idx_created_by (created_by),
  CONSTRAINT fk_workbenches_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作台（服务地址卡片）';
