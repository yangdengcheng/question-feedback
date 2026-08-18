// 一次性迁移：tickets.title 增加 ngram FULLTEXT 索引（幂等，可重复执行）
// 用法：在 server 目录下 node migrations/add_fulltext_title.js
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// 解析 .env，避免凭据硬编码
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
  const [rows] = await conn.query("SHOW INDEX FROM tickets WHERE Key_name = 'ft_tickets_title'");
  if (rows.length === 0) {
    await conn.query("ALTER TABLE tickets ADD FULLTEXT INDEX ft_tickets_title (title) WITH PARSER ngram");
    console.log("OK: FULLTEXT index ft_tickets_title created");
  } else {
    console.log("OK: FULLTEXT index ft_tickets_title already exists");
  }
  await conn.end();
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
