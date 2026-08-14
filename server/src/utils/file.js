const fs = require("fs");
const path = require("path");

/** 上传文件统一存放目录（server/uploads） */
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

/**
 * 修复文件名乱码：multer 按 latin1 解析 multipart 头，
 * UTF-8 中文文件名会存成含 Ã/Â 等字符的乱码串。
 * 仅对包含 latin1 高位字符（0x80-0xFF）的名字做还原，正常名字原样返回。
 */
function repairFileName(name) {
  if (!name) return name;
  if (!/[\u0080-\u00FF]/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    if (!decoded.includes("\uFFFD")) return decoded;
  } catch (_) {
    // 解码失败则保留原名
  }
  return name;
}

/** 静默删除文件（不存在或失败时忽略） */
function removeFileQuiet(filePath) {
  try {
    const abs = path.resolve(filePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (_) {
    // 忽略删除失败
  }
}

/**
 * 解析附件磁盘路径。
 * 历史数据存的是上传时的绝对路径，部署目录一旦搬迁文件就「消失」；
 * 新数据只存文件名。这里先试原路径，再回退到当前 uploads 目录按文件名查找，
 * 两种记录格式都能定位；文件确实不存在时返回 null。
 */
function resolveAttachmentPath(filePath) {
  if (!filePath) return null;
  const candidates = [path.resolve(filePath), path.join(UPLOAD_DIR, path.basename(filePath))];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {
      // 忽略单条候选路径的访问异常，继续尝试下一个
    }
  }
  return null;
}

module.exports = { repairFileName, removeFileQuiet, resolveAttachmentPath, UPLOAD_DIR };
