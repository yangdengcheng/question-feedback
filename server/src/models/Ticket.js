const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Ticket = sequelize.define(
  "Ticket",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketNo: { type: DataTypes.STRING(20), allowNull: false, field: "ticket_no" },
    title: {
      type: DataTypes.STRING(200), allowNull: false,
      validate: { notEmpty: { msg: "标题不能为空" }, len: { args: [1, 200], msg: "标题长度不能超过200个字符" } },
    },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM("bug", "question"), allowNull: false, defaultValue: "bug" },
    status: { type: DataTypes.ENUM("pending", "processing", "resolved", "closed"), allowNull: false, defaultValue: "pending" },
    priority: { type: DataTypes.ENUM("low", "medium", "high"), allowNull: false, defaultValue: "medium" },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    assigneeId: { type: DataTypes.INTEGER, allowNull: true, field: "assignee_id" },
  },
  { tableName: "tickets", indexes: [{ unique: true, fields: ["ticket_no"] }] },
);

module.exports = Ticket;
