// 用户初始化脚本：批量创建用户。
// - 保留已有用户（含 admin），仅追加，绝不删除。
// - 幂等：用户名已存在则跳过，可重复执行。
// 用法：npm run init-users  或  node src/initUsers.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize, User } = require("./models");

// 统一初始密码（首次登录后建议修改）
const DEFAULT_PASSWORD = "Ly123456";

// 合法角色枚举（与 User 模型一致）
const VALID_ROLES = [
  "customer",         // 客户
  "data_maintenance", // 数据维护
  "dev_lead",         // 开发主管
  "developer",        // 开发者
  "tester",           // 测试
  "admin",            // 管理员
];

// 待初始化用户名单。email 可省略。
// 将下方示例替换为真实名单后再执行。
const USERS = [
  // 研发主管
  { username: "yangdengcheng", realName: "杨登程", role: "dev_lead", email: "yangdengcheng@linyangzw.com" },
  { username: "yangjiangang", realName: "杨建刚", role: "dev_lead", email: "yangjiangang@linyangzw.com" },
  { username: "dingyang", realName: "丁阳", role: "dev_lead", email: "dingyang@linyangzw.com" },

  // 系统开发
  { username: "linkang", realName: "林慷", role: "developer", email: "linkang@linyangzw.com" },
  { username: "liukeying", realName: "刘可盈", role: "developer", email: "liukeying@linyangzw.com" },
  { username: "mawanlu", realName: "马婉露", role: "developer", email: "mawanlu@linyangzw.com" },
  { username: "xuwenbin", realName: "徐文彬", role: "developer", email: "xuwenbin@linyangzw.com" },
  { username: "kangjunjie", realName: "康俊杰", role: "developer", email: "kangjunjie@linyangzw.com" },
  { username: "lvhuan", realName: "吕欢", role: "developer", email: "lvhuan@linyangzw.com" },
  { username: "jinyangming", realName: "金扬明", role: "developer", email: "jinyangming@linyangzw.com" },
  { username: "yinhao", realName: "殷浩", role: "developer", email: "yinhao@linyangzw.com" },

  // 测试
  { username: "zhanglianxiang", realName: "张连香", role: "tester", email: "zhanglianxiang@linyangzw.com" },

  // 数据维护
  { username: "jinyu", realName: "金语", role: "data_maintenance", email: "jinyu@linyangzw.com" },
  { username: "tangxudong", realName: "汤旭东", role: "data_maintenance", email: "tangxudong@linyangzw.com" },

  // 客户
  { username: "wangkang", realName: "王康", role: "customer", email: "wangkang@linyangzw.com" },
  { username: "fanfenyan", realName: "樊芬岩", role: "customer", email: "fanfenyan@linyangzw.com" },
  { username: "haoxiaobo", realName: "郝晓玻", role: "customer", email: "haoxiaobo@linyangzw.com" },
  { username: "kongziliang", realName: "孔子亮", role: "customer", email: "kongziliang@linyangzw.com" },
  { username: "liweixing", realName: "李炜星", role: "customer", email: "liweixing@linyangzw.com" },
  { username: "manying", realName: "满缨", role: "customer", email: "manying@linyangzw.com" },
  { username: "qiyingyi", realName: "齐英屹", role: "customer", email: "qiyingyi@linyangzw.com" },
  { username: "tianjunfan", realName: "田俊凡", role: "customer", email: "tianjunfan@linyangzw.com" },
  { username: "yangjiayi", realName: "杨佳宜", role: "customer", email: "yangjiayi@linyangzw.com" },
  { username: "yangxiaoling", realName: "杨小玲", role: "customer", email: "yangxiaoling@linyangzw.com" },
  { username: "yuzhiyang", realName: "俞智扬", role: "customer", email: "yuzhiyang@linyangzw.com" },
  { username: "zhangjingdan", realName: "张警丹", role: "customer", email: "zhangjingdan@linyangzw.com" },
  { username: "zhangmengshi", realName: "张梦诗", role: "customer", email: "zhangmengshi@linyangzw.com" },
  { username: "zhengxinyu", realName: "郑心宇", role: "customer", email: "zhengxinyu@linyangzw.com" },
  { username: "chenwenhao", realName: "陈文浩", role: "customer", email: "chenwenhao@linyangzw.com" },
  { username: "liyelin", realName: "李叶霖", role: "customer", email: "liyelin@linyangzw.com" },
  { username: "luhehe", realName: "卢贺贺", role: "customer", email: "luhehe@linyangzw.com" },
  { username: "luohao", realName: "罗皓", role: "customer", email: "luohao@linyangzw.com" },
  { username: "nidandan", realName: "倪丹丹", role: "customer", email: "nidandan@linyangzw.com" },
  { username: "xuruling", realName: "许茹灵", role: "customer", email: "xuruling@linyangzw.com" },
  { username: "wangpeng", realName: "王鹏", role: "customer", email: "wangpeng@linyangzw.com" },
  { username: "zengye", realName: "曾叶", role: "customer", email: "zengye@linyangzw.com" },
];

async function initUsers() {
  await sequelize.authenticate();
  console.log(`已连接数据库: ${sequelize.config.database}`);

  if (sequelize.config.database === "question_feedback_test") {
    throw new Error("检测到测试库，拒绝执行");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let created = 0, skipped = 0, invalid = 0;

  for (const u of USERS) {
    if (!u.username || !u.realName || !VALID_ROLES.includes(u.role)) {
      console.log(`  [非法] 跳过（字段缺失或角色不在枚举内）: ${JSON.stringify(u)}`);
      invalid++;
      continue;
    }
    const existing = await User.findOne({ where: { username: u.username } });
    if (existing) {
      console.log(`  [已存在] 跳过: ${u.username}`);
      skipped++;
      continue;
    }
    await User.create({
      username: u.username,
      realName: u.realName,
      role: u.role,
      email: u.email || null,
      passwordHash,
    });
    console.log(`  [新建] ${u.username} (${u.realName}, ${u.role})`);
    created++;
  }

  const total = await User.count();
  console.log(`\n=== 完成：新建 ${created}，跳过 ${skipped}，非法 ${invalid} ===`);
  console.log(`统一初始密码: ${DEFAULT_PASSWORD}`);
  console.log(`当前用户总数: ${total}`);
  process.exit(0);
}

initUsers().catch((e) => {
  console.error("初始化失败:", e);
  process.exit(1);
});
