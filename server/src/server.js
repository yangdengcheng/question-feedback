const app = require("./app");
const sequelize = require("./config/database");
const seedToolkitDicts = require("./services/seedToolkitDicts");
require("dotenv").config();

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("数据库连接成功");
    await sequelize.sync();
    console.log("数据库同步完成");
    await seedToolkitDicts();
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("启动失败:", error);
    process.exit(1);
  }
}

start();
