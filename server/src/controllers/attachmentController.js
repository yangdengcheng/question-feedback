const path = require("path");
const { Attachment } = require("../models");

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "video/mp4", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/x-rar-compressed"];
const MAX_SIZE = 10 * 1024 * 1024;

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "请选择要上传的文件" });
    if (!ALLOWED_TYPES.includes(req.file.mimetype)) return res.status(400).json({ message: "不支持的文件类型" });
    if (req.file.size > MAX_SIZE) return res.status(400).json({ message: "文件大小不能超过10MB" });
    const attachment = await Attachment.create({
      ticketId: 0, fileName: req.file.originalname, filePath: req.file.path,
      fileSize: req.file.size, fileType: req.file.mimetype, uploadedBy: req.user.id,
    });
    res.status(201).json(attachment);
  } catch (error) { next(error); }
}

async function download(req, res, next) {
  try {
    const attachment = await Attachment.findByPk(req.params.id);
    if (!attachment) return res.status(404).json({ message: "附件不存在" });
    const filePath = path.resolve(attachment.filePath);
    res.download(filePath, attachment.fileName);
  } catch (error) { next(error); }
}

module.exports = { upload, download, ALLOWED_TYPES, MAX_SIZE };
