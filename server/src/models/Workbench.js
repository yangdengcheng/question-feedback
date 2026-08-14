const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// 工作台：每张卡片对应一个服务地址（如监控面板）
const Workbench = sequelize.define(
  "Workbench",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false, comment: "工作台名称" },
    url: { type: DataTypes.STRING(255), allowNull: false, comment: "服务地址" },
    visitCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "visit_count", comment: "访问次数" },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: "乐观锁版本号" },
    createdBy: { type: DataTypes.INTEGER, allowNull: false, field: "created_by" },
  },
  {
    tableName: "workbenches",
  },
);

module.exports = Workbench;
