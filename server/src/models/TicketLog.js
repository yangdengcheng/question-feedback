const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TicketLog = sequelize.define(
  "TicketLog",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketId: { type: DataTypes.INTEGER, allowNull: false, field: "ticket_id" },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    action: { type: DataTypes.ENUM("created", "assigned", "transferred", "status_changed", "commented"), allowNull: false },
    fromStatus: { type: DataTypes.STRING(20), allowNull: true, field: "from_status" },
    toStatus: { type: DataTypes.STRING(20), allowNull: true, field: "to_status" },
    fromAssigneeId: { type: DataTypes.INTEGER, allowNull: true, field: "from_assignee_id" },
    toAssigneeId: { type: DataTypes.INTEGER, allowNull: true, field: "to_assignee_id" },
    content: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "ticket_logs", updatedAt: false },
);

module.exports = TicketLog;
