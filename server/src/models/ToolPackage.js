const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ToolPackage = sequelize.define(
  "ToolPackage",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    provinceId: { type: DataTypes.INTEGER, allowNull: false, field: "province_id" },
    categoryId: { type: DataTypes.INTEGER, allowNull: false, field: "category_id" },
    summary: { type: DataTypes.STRING(500), allowNull: true },
    docMarkdown: { type: DataTypes.TEXT("long"), allowNull: true, field: "doc_markdown" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
    currentVersionId: { type: DataTypes.INTEGER, allowNull: true, field: "current_version_id" },
    createdBy: { type: DataTypes.INTEGER, allowNull: false, field: "created_by" },
  },
  { tableName: "tool_packages" },
);

module.exports = ToolPackage;
