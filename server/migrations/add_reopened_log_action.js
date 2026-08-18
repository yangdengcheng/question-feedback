// 一次性迁移：ticket_logs.action 枚举增加 'reopened'（幂等，可重复执行）
// 用法：在 server 目录下 node migrations/add_reopened_log_action.js
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8")
  .split(/\r?\n/)
  .forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  });

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  const [rows] = await conn.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ticket_logs' AND COLUMN_NAME = 'action'",
    [env.DB_NAME]
  );
  if (rows.length === 0) {
    console.log("FAIL: ticket_logs.action column not found");
    process.exit(1);
  }
  if (rows[0].COLUMN_TYPE.includes("'reopened'")) {
    console.log("OK: 'reopened' already in action enum");
  } else {
    await conn.query(
      "ALTER TABLE ticket_logs MODIFY action ENUM('created','assigned','transferred','status_changed','commented','reopened') NOT NULL COMMENT '操作类型'"
    );
    console.log("OK: 'reopened' added to action enum");
  }
  await conn.end();
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
