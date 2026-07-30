const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Comment = sequelize.define(
  "Comment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketId: { type: DataTypes.INTEGER, allowNull: false, field: "ticket_id" },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    content: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: { msg: "评论内容不能为空" } } },
  },
  { tableName: "comments" },
);

module.exports = Comment;
