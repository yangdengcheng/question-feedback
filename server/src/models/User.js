const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: {
      type: DataTypes.STRING(50), allowNull: false, unique: true,
      validate: { notEmpty: { msg: "用户名不能为空" }, len: { args: [2, 50], msg: "用户名长度为2-50个字符" } },
    },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: "password_hash" },
    realName: {
      type: DataTypes.STRING(50), allowNull: false, field: "real_name",
      validate: { notEmpty: { msg: "姓名不能为空" } },
    },
    email: {
      type: DataTypes.STRING(100), allowNull: true,
      validate: { isEmail: { msg: "邮箱格式不正确" } },
    },
    role: { type: DataTypes.ENUM("user", "admin"), allowNull: false, defaultValue: "user" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  },
  { tableName: "users" },
);

module.exports = User;
