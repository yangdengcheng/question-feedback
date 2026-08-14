const sequelize = require("../config/database");
const User = require("./User");
const Ticket = require("./Ticket");
const Comment = require("./Comment");
const Attachment = require("./Attachment");
const Notification = require("./Notification");
const TicketLog = require("./TicketLog");
const ToolDict = require("./ToolDict");
const ToolPackage = require("./ToolPackage");
const ToolPackageVersion = require("./ToolPackageVersion");
const Workbench = require("./Workbench");

// User <-> Ticket (creator)
User.hasMany(Ticket, { foreignKey: "userId", as: "tickets" });
Ticket.belongsTo(User, { foreignKey: "userId", as: "creator" });

// User <-> Ticket (assignee)
User.hasMany(Ticket, { foreignKey: "assigneeId", as: "assignedTickets" });
Ticket.belongsTo(User, { foreignKey: "assigneeId", as: "assignee" });

// Ticket <-> Comment
Ticket.hasMany(Comment, { foreignKey: "ticketId", as: "comments" });
Comment.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

// User <-> Comment
User.hasMany(Comment, { foreignKey: "userId", as: "comments" });
Comment.belongsTo(User, { foreignKey: "userId", as: "author" });

// Ticket <-> Attachment
Ticket.hasMany(Attachment, { foreignKey: "ticketId", as: "attachments" });
Attachment.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

// Comment <-> Attachment
Comment.hasMany(Attachment, { foreignKey: "commentId", as: "attachments" });
Attachment.belongsTo(Comment, { foreignKey: "commentId", as: "comment" });

// TicketLog <-> Attachment
TicketLog.hasMany(Attachment, { foreignKey: "logId", as: "attachments" });
Attachment.belongsTo(TicketLog, { foreignKey: "logId", as: "log" });

// User <-> Attachment
User.hasMany(Attachment, { foreignKey: "uploadedBy", as: "uploadedAttachments" });
Attachment.belongsTo(User, { foreignKey: "uploadedBy", as: "uploader" });

// User <-> Notification
User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "userId", as: "user" });

// Ticket <-> Notification
Ticket.hasMany(Notification, { foreignKey: "ticketId", as: "notifications" });
Notification.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

// Ticket <-> TicketLog
Ticket.hasMany(TicketLog, { foreignKey: "ticketId", as: "logs" });
TicketLog.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });
User.hasMany(TicketLog, { foreignKey: "userId", as: "ticketLogs" });
TicketLog.belongsTo(User, { foreignKey: "userId", as: "operator" });
TicketLog.belongsTo(User, { foreignKey: "fromAssigneeId", as: "fromAssignee" });
TicketLog.belongsTo(User, { foreignKey: "toAssigneeId", as: "toAssignee" });

// ToolPackage <-> ToolDict (province / category)
ToolPackage.belongsTo(ToolDict, { foreignKey: "provinceId", as: "province" });
ToolPackage.belongsTo(ToolDict, { foreignKey: "categoryId", as: "category" });

// ToolPackage <-> User (creator)
ToolPackage.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

// ToolPackage <-> ToolPackageVersion
ToolPackage.hasMany(ToolPackageVersion, { foreignKey: "packageId", as: "versions" });
ToolPackageVersion.belongsTo(ToolPackage, { foreignKey: "packageId", as: "package" });
ToolPackage.belongsTo(ToolPackageVersion, { foreignKey: "currentVersionId", as: "currentVersion" });

// ToolPackageVersion <-> User (creator)
ToolPackageVersion.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

// Workbench <-> User (creator)
User.hasMany(Workbench, { foreignKey: "createdBy", as: "workbenches" });
Workbench.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

module.exports = {
  sequelize, User, Ticket, Comment, Attachment, Notification, TicketLog,
  ToolDict, ToolPackage, ToolPackageVersion, Workbench,
};
