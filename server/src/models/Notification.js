const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notification = sequelize.define(
  "Notification",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    ticketId: { type: DataTypes.INTEGER, allowNull: false, field: "ticket_id" },
    type: { type: DataTypes.ENUM("new_ticket", "new_comment", "status_change", "assigned"), allowNull: false },
    content: { type: DataTypes.STRING(500), allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_read" },
    readAt: { type: DataTypes.DATE, allowNull: true, field: "read_at" },
  },
  { tableName: "notifications", updatedAt: false },
);

module.exports = Notification;
