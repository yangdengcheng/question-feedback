/**
 * 重置测试数据脚本：清空工单、评论、附件、通知、操作日志、工具包及其版本，
 * 并删除 uploads 目录下的物理文件。
 * 保留：用户账号、工具包字典（省份/分类）。
 *
 * 用法：
 *   npm run reset-data        需要输入 y 确认
 *   npm run reset-data -- --yes  跳过确认直接执行
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {
  sequelize, Ticket, Comment, Attachment, Notification, TicketLog,
  ToolPackage, ToolPackageVersion,
} = require("./models");
const { removeFileQuiet } = require("./utils/file");

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(String(answer).trim()));
    });
  });
}

async function reset() {
  await sequelize.authenticate();
  console.log("数据库连接成功");

  const stats = {};

  // 1. 通知
  stats.notifications = await Notification.destroy({ where: {} });

  // 2. 附件（先删磁盘文件再删记录）
  const attachments = await Attachment.findAll({ attributes: ["filePath"] });
  attachments.forEach((a) => removeFileQuiet(a.filePath));
  stats.attachments = await Attachment.destroy({ where: {} });

  // 3. 评论 / 操作日志 / 工单
  stats.comments = await Comment.destroy({ where: {} });
  stats.ticketLogs = await TicketLog.destroy({ where: {} });
  stats.tickets = await Ticket.destroy({ where: {} });

  // 4. 工具包版本与工具包（先解除 currentVersionId 引用）
  await ToolPackage.update({ currentVersionId: null }, { where: {} });
  const versions = await ToolPackageVersion.findAll({ attributes: ["fileUrl"] });
  versions.forEach((v) => removeFileQuiet(v.fileUrl));
  stats.versions = await ToolPackageVersion.destroy({ where: {} });
  stats.packages = await ToolPackage.destroy({ where: {} });

  // 5. 兜底清理 uploads 目录（未关联记录的残留文件）
  const uploadDir = path.join(__dirname, "..", "uploads");
  let cleanedFiles = 0;
  if (fs.existsSync(uploadDir)) {
    for (const entry of fs.readdirSync(uploadDir)) {
      if (entry === ".gitkeep") continue;
      fs.rmSync(path.join(uploadDir, entry), { recursive: true, force: true });
      cleanedFiles++;
    }
  }

  console.log("\n已清空：");
  console.log(`  工单        ${stats.tickets} 条`);
  console.log(`  评论        ${stats.comments} 条`);
  console.log(`  附件        ${stats.attachments} 条`);
  console.log(`  通知        ${stats.notifications} 条`);
  console.log(`  工单操作日志 ${stats.ticketLogs} 条`);
  console.log(`  工具包版本   ${stats.versions} 个`);
  console.log(`  工具包      ${stats.packages} 个`);
  console.log(`  uploads 残留文件 ${cleanedFiles} 个`);
  console.log("\n用户账号与工具包字典已保留。");
}

async function main() {
  const skipConfirm = process.argv.includes("--yes") || process.argv.includes("-y");
  if (!skipConfirm) {
    const ok = await confirm("⚠️  将清空所有工单、评论、附件、通知、工具包数据及上传文件（保留用户与字典），确认执行？(y/N) ");
    if (!ok) {
      console.log("已取消");
      process.exit(0);
    }
  }
  try {
    await reset();
    process.exit(0);
  } catch (error) {
    console.error("重置失败:", error);
    process.exit(1);
  }
}

main();
