const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// 系统字典：通用下拉数据源，按 dict_code 分组，一行一个字典值
const SysDict = sequelize.define(
  "SysDict",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    dictCode: { type: DataTypes.STRING(50), allowNull: false, field: "dict_code" },
    dictValue: { type: DataTypes.STRING(200), allowNull: false, field: "dict_value" },
    sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
    remark: { type: DataTypes.STRING(200), allowNull: true },
  },
  {
    tableName: "sys_dicts",
    indexes: [{ unique: true, fields: ["dict_code", "dict_value"] }],
  },
);

module.exports = SysDict;
