const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ToolPackageVersion = sequelize.define(
  "ToolPackageVersion",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    packageId: { type: DataTypes.INTEGER, allowNull: false, field: "package_id" },
    version: { type: DataTypes.STRING(50), allowNull: false },
    releaseNote: { type: DataTypes.TEXT, allowNull: true, field: "release_note" },
    fileUrl: { type: DataTypes.STRING(500), allowNull: false, field: "file_url" },
    fileName: { type: DataTypes.STRING(255), allowNull: false, field: "file_name" },
    fileSize: { type: DataTypes.INTEGER, allowNull: false, field: "file_size" },
    createdBy: { type: DataTypes.INTEGER, allowNull: false, field: "created_by" },
  },
  {
    tableName: "tool_package_versions",
    updatedAt: false,
    indexes: [{ unique: true, fields: ["package_id", "version"] }],
  },
);

module.exports = ToolPackageVersion;
