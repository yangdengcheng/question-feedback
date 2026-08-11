const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "question_feedback",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    dialect: "mysql",
    timezone: "+08:00", // 按东八区读写 MySQL DATETIME，保证库里存的是北京时间
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
  },
);

module.exports = sequelize;
