const path = require("path");
const { Attachment } = require("../models");
const { repairFileName, resolveAttachmentPath } = require("../utils/file");

// 准入只看扩展名，MIME 仅入库留档：同一个 zip 文件在不同机器上浏览器上报的
// MIME 可能是 application/zip、application/x-zip-compressed 或 application/octet-stream，
// 取决于本机装了什么解压软件（Windows 下读注册表），拿 MIME 做白名单会误杀。
// 清单与前端 FileUpload.vue 的 acceptTypes 保持一致。
// .js 前端未列入 accept、但历史上后端一直放行（调试脚本类附件），保持兼容
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".mp4", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".rar", ".js"];
const MAX_SIZE = 10 * 1024 * 1024;

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "请选择要上传的文件" });
    const ext = path.extname(repairFileName(req.file.originalname)).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) return res.status(400).json({ message: "不支持的文件类型" });
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

module.exports = { upload, download, ALLOWED_EXTS, MAX_SIZE };
