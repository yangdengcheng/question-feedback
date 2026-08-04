/**
 * 轻量数据库迁移执行器
 *
 * 约定：
 *   - SQL 文件放在 migrations/ 目录下，按编号命名：001_init.sql、002_xxx.sql …
 *   - 已执行过的迁移记录在 _migrations 表中，不会重复执行。
 *   - 迁移文件内容为空或仅有注释时跳过。
 *
 * 用法：
 *   npm run migrate          执行所有未执行的迁移
 *   npm run migrate -- --status  仅查看迁移状态（不执行）
 */
const fs = require("fs");
const path = require("path");
const sequelize = require("../config/database");

const MIGRATIONS_DIR = __dirname;
const TABLE_NAME = "_migrations";

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
}

async function ensureTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getExecuted() {
  const [rows] = await sequelize.query(`SELECT name FROM ${TABLE_NAME} ORDER BY id`);
  return new Set(rows.map((r) => r.name));
}

async function run() {
  await sequelize.authenticate();
  await ensureTable();

  const files = getMigrationFiles();
  const executed = await getExecuted();
  const pending = files.filter((f) => !executed.has(f));

  if (process.argv.includes("--status")) {
    console.log("迁移状态：");
    for (const f of files) {
      const done = executed.has(f);
      console.log(`  [${done ? "✓ 已执行" : "○ 待执行"}] ${f}`);
    }
    console.log(`\n共 ${files.length} 个迁移，${pending.length} 个待执行`);
    process.exit(0);
  }

  if (pending.length === 0) {
    console.log("没有待执行的迁移");
    process.exit(0);
  }

  console.log(`待执行 ${pending.length} 个迁移：${pending.join(", ")}`);

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf8").trim();
    if (!sql || sql.split("\n").every((l) => l.startsWith("--") || l === "")) {
      console.log(`  ${file} — 跳过（空文件）`);
      await sequelize.query(`INSERT INTO ${TABLE_NAME} (name) VALUES (:name)`, {
        replacements: { name: file },
      });
      continue;
    }
    const t = await sequelize.transaction();
    try {
      await sequelize.query(sql, { transaction: t });
      await sequelize.query(
        `INSERT INTO ${TABLE_NAME} (name) VALUES (:name)`,
        { replacements: { name: file }, transaction: t },
      );
      await t.commit();
      console.log(`  ${file} — 已执行`);
    } catch (error) {
      await t.rollback();
      console.error(`  ${file} — 执行失败:`, error.original?.message || error.message);
      process.exit(1);
    }
  }

  console.log("\n迁移完成。");
  process.exit(0);
}

run();
