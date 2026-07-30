const bcrypt = require("bcryptjs");
const sequelize = require("./config/database");
const { User, Ticket, Comment, NotifyRule } = require("./models");
const { generateTicketNo } = require("./services/ticketService");

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("数据库连接成功");
    await sequelize.sync({ force: true });
    console.log("数据库表已重建");

    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    const admin = await User.create({
      username: "admin",
      passwordHash: adminPasswordHash,
      realName: "系统管理员",
      email: "admin@example.com",
      role: "admin",
    });
    console.log("管理员创建成功: admin / admin123");

    const devLeadPasswordHash = await bcrypt.hash("dev123", 10);
    const devLead = await User.create({
      username: "developer",
      passwordHash: devLeadPasswordHash,
      realName: "张开发",
      email: "dev@example.com",
      role: "dev_lead",
    });
    console.log("开发组长创建成功: developer / dev123");

    const userPasswordHash = await bcrypt.hash("user123", 10);
    const user = await User.create({
      username: "testuser",
      passwordHash: userPasswordHash,
      realName: "李用户",
      email: "user@example.com",
      role: "customer",
    });
    console.log("普通用户创建成功: testuser / user123");

    const dev1PasswordHash = await bcrypt.hash("dev123", 10);
    const dev1 = await User.create({
      username: "dev1",
      passwordHash: dev1PasswordHash,
      realName: "王开发",
      email: "dev1@example.com",
      role: "developer",
    });
    console.log("开发者创建成功: dev1 / dev123");

    const tester1PasswordHash = await bcrypt.hash("test123", 10);
    const tester1 = await User.create({
      username: "tester1",
      passwordHash: tester1PasswordHash,
      realName: "赵测试",
      email: "tester1@example.com",
      role: "tester",
    });
    console.log("测试人员创建成功: tester1 / test123");

    const ticketNo1 = await generateTicketNo();
    const ticket1 = await Ticket.create({
      ticketNo: ticketNo1,
      title: "登录页面在 Safari 浏览器上显示异常",
      description: "在 Safari 15 上打开登录页面，输入框样式错乱，按钮无法点击。\n\n复现步骤：\n1. 打开 Safari 浏览器\n2. 访问登录页面\n3. 观察输入框和按钮样式",
      type: "bug",
      status: "processing",
      priority: "high",
      userId: user.id,
      assigneeId: devLead.id,
    });

    const ticketNo2 = await generateTicketNo();
    const ticket2 = await Ticket.create({
      ticketNo: ticketNo2,
      title: "如何导出工单数据？",
      description: "请问系统是否支持将工单数据导出为 Excel 文件？如果支持，应该如何操作？",
      type: "question",
      status: "pending",
      priority: "medium",
      userId: user.id,
    });

    const ticketNo3 = await generateTicketNo();
    const ticket3 = await Ticket.create({
      ticketNo: ticketNo3,
      title: "工单列表加载缓慢",
      description: "当工单数量较多时，工单列表页面加载非常缓慢，需要等待很长时间才能显示数据。",
      type: "question",
      status: "resolved",
      priority: "low",
      userId: user.id,
      assigneeId: admin.id,
    });
    console.log("示例工单创建成功");

    await Comment.create({
      ticketId: ticket1.id,
      userId: devLead.id,
      content: "已收到反馈，正在排查 Safari 兼容性问题。初步判断是 CSS flex 布局的兼容性问题。",
    });

    await Comment.create({
      ticketId: ticket1.id,
      userId: user.id,
      content: "好的，谢谢！补充一下，我的 Safari 版本是 15.4，macOS Monterey 系统。",
    });

    await Comment.create({
      ticketId: ticket3.id,
      userId: admin.id,
      content: "已优化查询性能，增加了分页和索引，问题已解决。",
    });
    console.log("示例评论创建成功");

    console.log("\n种子数据创建完成！");
    process.exit(0);
  } catch (error) {
    console.error("种子数据创建失败:", error);
    process.exit(1);
  }
}

seed();
