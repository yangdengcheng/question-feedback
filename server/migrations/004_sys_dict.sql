-- ============================================================
-- 004_sys_dict.sql — 系统字典表 + 工单「所属系统」字段
-- 说明：通用下拉数据源，按 dict_code 分组、一行一个字典值；
--       工单新增必填的「所属系统」，存储 system_code 字典值文本
-- ============================================================

-- 系统字典表
CREATE TABLE IF NOT EXISTS sys_dicts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  dict_code  VARCHAR(50)  NOT NULL COMMENT '字典编码，如 system_code',
  dict_value VARCHAR(200) NOT NULL COMMENT '字典值（下拉显示文本，也是存储值）',
  sort       INT          NOT NULL DEFAULT 0 COMMENT '排序号，小的在前',
  is_active  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用：1启用 0停用',
  remark     VARCHAR(200) NULL COMMENT '备注',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code_value (dict_code, dict_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统字典表';

-- 「所属系统」初始字典数据（幂等：重复执行不报错）
INSERT INTO sys_dicts (dict_code, dict_value, sort) VALUES
  ('system_code', '新江苏电力交易辅助系统', 1),
  ('system_code', '老安徽电力交易辅助系统', 2)
ON DUPLICATE KEY UPDATE sort = VALUES(sort);

-- 工单表增加「所属系统」列（存字典值文本；存量工单为 NULL）
ALTER TABLE tickets
  ADD COLUMN system_code VARCHAR(200) NULL COMMENT '所属系统（sys_dicts 中 system_code 的字典值）' AFTER priority;
