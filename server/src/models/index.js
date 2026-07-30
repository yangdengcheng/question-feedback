const sequelize = require("../config/database");
const User = require("./User");
const Ticket = require("./Ticket");
const Comment = require("./Comment");
const Attachment = require("./Attachment");
const Notification = require("./Notification");
const NotifyRule = require("./NotifyRule");
const TicketLog = require("./TicketLog");

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

// User <-> Attachment
User.hasMany(Attachment, { foreignKey: "uploadedBy", as: "uploadedAttachments" });
Attachment.belongsTo(User, { foreignKey: "uploadedBy", as: "uploader" });

// User <-> Notification
User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "userId", as: "user" });

// Ticket <-> Notification
Ticket.hasMany(Notification, { foreignKey: "ticketId", as: "notifications" });
Notification.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

// User <-> NotifyRule
User.hasMany(NotifyRule, { foreignKey: "userId", as: "notifyRules" });
NotifyRule.belongsTo(User, { foreignKey: "userId", as: "user" });

// Ticket <-> TicketLog
Ticket.hasMany(TicketLog, { foreignKey: "ticketId", as: "logs" });
TicketLog.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });
User.hasMany(TicketLog, { foreignKey: "userId", as: "ticketLogs" });
TicketLog.belongsTo(User, { foreignKey: "userId", as: "operator" });
TicketLog.belongsTo(User, { foreignKey: "fromAssigneeId", as: "fromAssignee" });
TicketLog.belongsTo(User, { foreignKey: "toAssigneeId", as: "toAssignee" });

module.exports = { sequelize, User, Ticket, Comment, Attachment, Notification, NotifyRule, TicketLog };
