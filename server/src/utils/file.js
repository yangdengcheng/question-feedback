const fs = require("fs");
const path = require("path");

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

module.exports = { repairFileName, removeFileQuiet };
