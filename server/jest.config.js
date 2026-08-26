module.exports = {
  testEnvironment: "node",
  setupFiles: ["./tests/setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
  // 测试库在远端 MySQL（172.30.1.248），sequelize.sync({force:true}) 建表约 10s，默认 5s 钩子超时不够用
  testTimeout: 120000,
};
