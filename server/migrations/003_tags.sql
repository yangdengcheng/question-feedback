-- 工作台增加标签字段（一个工作台只绑一个标签；标签清单由 GROUP BY tag 动态查出，不单独建表）
ALTER TABLE workbenches
  ADD COLUMN tag VARCHAR(50) NULL COMMENT '标签，NULL/空=未分类' AFTER roles;
