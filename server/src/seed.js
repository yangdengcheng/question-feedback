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

    const devPasswordHash = await bcrypt.hash("dev123", 10);
    const dev = await User.create({
      username: "developer",
      passwordHash: devPasswordHash,
      realName: "张开发",
      email: "dev@example.com",
      role: "user",
    });
    console.log("开发者创建成功: developer / dev123");

    const userPasswordHash = await bcrypt.hash("user123", 10);
    const user = await User.create({
      username: "testuser",
      passwordHash: userPasswordHash,
      realName: "李用户",
      email: "user@example.com",
      role: "user",
    });
    console.log("普通用户创建成功: testuser / user123");

    await NotifyRule.create({ userId: admin.id, ticketType: null });
    await NotifyRule.create({ userId: dev.id, ticketType: "bug" });
    console.log("通知规则创建成功");

    const ticketNo1 = await generateTicketNo();
    const ticket1 = await Ticket.create({
      ticketNo: ticketNo1,
      title: "登录页面在 Safari 浏览器上显示异常",
      description: "在 Safari 15 上打开登录页面，输入框样式错乱，按钮无法点击。\n\n复现步骤：\n1. 打开 Safari 浏览器\n2. 访问登录页面\n3. 观察输入框和按钮样式",
      type: "bug",
      status: "processing",
      priority: "high",
      userId: user.id,
      assigneeId: dev.id,
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
      title: "建议增加工单模板功能",
      description: "很多用户反馈的问题类型相似，建议增加工单模板功能，让用户可以选择模板快速提交工单，提高提交效率。",
      type: "suggestion",
      status: "resolved",
      priority: "low",
      userId: user.id,
      assigneeId: admin.id,
    });
    console.log("示例工单创建成功");

    await Comment.create({
      ticketId: ticket1.id,
      userId: dev.id,
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
      content: "感谢建议！工单模板功能已纳入下一版本开发计划，预计两周后上线。",
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
