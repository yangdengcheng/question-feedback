// 密码重置脚本：将所有研发主管（dev_lead）的密码初始化为统一密码。
// - 仅更新 role = "dev_lead" 的用户，不影响其他角色。
// - 幂等：可重复执行。
// 用法：npm run reset-devlead-pwd  或  node src/resetDevLeadPassword.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize, User } = require("./models");

// 研发主管统一密码（首次登录后建议修改）
const DEV_LEAD_PASSWORD = "Ly12345678";

async function resetDevLeadPassword() {
  await sequelize.authenticate();
  console.log(`已连接数据库: ${sequelize.config.database}`);

  const passwordHash = await bcrypt.hash(DEV_LEAD_PASSWORD, 10);

  const leads = await User.findAll({
    where: { role: "dev_lead" },
    order: [["id", "ASC"]],
  });

  if (leads.length === 0) {
    console.log("未找到任何研发主管（dev_lead）用户，无需处理");
    process.exit(0);
  }

  for (const u of leads) {
    u.passwordHash = passwordHash;
    await u.save();
    console.log(`  [已重置] ${u.username} (${u.realName})`);
  }

  console.log(`\n=== 完成：共重置 ${leads.length} 位研发主管的密码 ===`);
  console.log(`统一密码: ${DEV_LEAD_PASSWORD}`);
  process.exit(0);
}

resetDevLeadPassword().catch((e) => {
  console.error("密码重置失败:", e);
  process.exit(1);
});
