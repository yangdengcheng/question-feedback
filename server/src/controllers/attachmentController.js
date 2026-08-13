const path = require("path");
const { Attachment } = require("../models");
const { repairFileName, resolveAttachmentPath } = require("../utils/file");

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "video/mp4", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/x-rar-compressed", "text/javascript", "application/javascript", "application/x-javascript"];
const MAX_SIZE = 10 * 1024 * 1024;

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "请选择要上传的文件" });
    if (!ALLOWED_TYPES.includes(req.file.mimetype)) return res.status(400).json({ message: "不支持的文件类型" });
    if (req.file.size > MAX_SIZE) return res.status(400).json({ message: "文件大小不能超过10MB" });
    // 只存文件名（相对 uploads 目录），部署目录搬迁不会导致历史附件失效
    const attachment = await Attachment.create({
      ticketId: null, fileName: repairFileName(req.file.originalname), filePath: req.file.filename,
      fileSize: req.file.size, fileType: req.file.mimetype, uploadedBy: req.user.id,
    });
    res.status(201).json(attachment);
  } catch (error) { next(error); }
}

async function download(req, res, next) {
  try {
    const attachment = await Attachment.findByPk(req.params.id);
    if (!attachment) return res.status(404).json({ message: "附件不存在" });
    const filePath = resolveAttachmentPath(attachment.filePath);
    if (!filePath) return res.status(404).json({ message: "文件已丢失或不存在，请联系管理员从备份恢复" });
    res.download(filePath, repairFileName(attachment.fileName));
  } catch (error) { next(error); }
}

module.exports = { upload, download, ALLOWED_TYPES, MAX_SIZE };
