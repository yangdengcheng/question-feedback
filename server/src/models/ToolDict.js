const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// 工具包字典：省份(province) + 分类(category) 统一表，靠 type 区分
const ToolDict = sequelize.define(
  "ToolDict",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: {
      type: DataTypes.ENUM("province", "category"),
      allowNull: false,
    },
    code: { type: DataTypes.STRING(50), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  },
  {
    tableName: "tool_dicts",
    indexes: [{ unique: true, fields: ["type", "code"] }],
  },
);

module.exports = ToolDict;
