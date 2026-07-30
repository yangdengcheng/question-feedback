const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Attachment = sequelize.define(
  "Attachment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketId: { type: DataTypes.INTEGER, allowNull: true, field: "ticket_id" },
    commentId: { type: DataTypes.INTEGER, allowNull: true, field: "comment_id" },
    logId: { type: DataTypes.INTEGER, allowNull: true, field: "log_id" },
    fileName: { type: DataTypes.STRING(255), allowNull: false, field: "file_name" },
    filePath: { type: DataTypes.STRING(500), allowNull: false, field: "file_path" },
    fileSize: { type: DataTypes.INTEGER, allowNull: false, field: "file_size" },
    fileType: { type: DataTypes.STRING(100), allowNull: false, field: "file_type" },
    uploadedBy: { type: DataTypes.INTEGER, allowNull: false, field: "uploaded_by" },
  },
  { tableName: "attachments", updatedAt: false },
);

module.exports = Attachment;
