const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NotifyRule = sequelize.define(
  "NotifyRule",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    ticketType: { type: DataTypes.ENUM("bug", "question", "suggestion"), allowNull: true, field: "ticket_type" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  },
  { tableName: "notify_rules", updatedAt: false },
);

module.exports = NotifyRule;
