const request = require("supertest");
const app = require("../src/app");
const { sequelize, User, Ticket, SysDict } = require("../src/models");

let token;
let userId;

// 「所属系统」字典测试种子值（与建单接口校验的 system_code 字典对应）
const SYSTEM_VALUE = "新江苏电力交易辅助系统";

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  await SysDict.bulkCreate([
    { dictCode: "system_code", dictValue: SYSTEM_VALUE, sort: 1 },
    { dictCode: "system_code", dictValue: "老安徽电力交易辅助系统", sort: 2 },
  ]);
  const res = await request(app).post("/api/auth/register").send({
    username: "testuser",
    password: "password123",
    realName: "测试用户",
  });
  token = res.body.token;
  userId = res.body.user.id;
});

describe("POST /api/tickets", () => {
  it("应该成功创建工单", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "登录页面报错", description: "点击登录按钮后页面白屏", type: "bug", priority: "high", systemCode: SYSTEM_VALUE });
    expect(res.status).toBe(201);
    expect(res.body.ticketNo).toMatch(/^FB-\d{8}-\d{3}$/);
    expect(res.body.title).toBe("登录页面报错");
    expect(res.body.status).toBe("pending");
    expect(res.body.systemCode).toBe(SYSTEM_VALUE);
  });

  it("应该拒绝缺少标题", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "没有标题", systemCode: SYSTEM_VALUE });
    expect(res.status).toBe(400);
  });

  it("应该拒绝缺少所属系统", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "缺少所属系统", description: "测试" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("所属系统");
  });

  it("应该拒绝不在字典内的所属系统", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "非法所属系统", description: "测试", systemCode: "不存在的系统" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tickets", () => {
  beforeEach(async () => {
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "工单1", type: "bug", systemCode: SYSTEM_VALUE });
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "工单2", type: "question", systemCode: SYSTEM_VALUE });
  });

  it("应该返回我的工单列表", async () => {
    const res = await request(app).get("/api/tickets").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(2);
    expect(res.body.count).toBe(2);
  });

  it("应该支持按状态筛选", async () => {
    const res = await request(app).get("/api/tickets?status=pending").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(2);
  });
});

describe("GET /api/tickets/:id", () => {
  it("应该返回工单详情", async () => {
    const createRes = await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "测试工单", type: "bug", systemCode: SYSTEM_VALUE });
    const res = await request(app).get(`/api/tickets/${createRes.body.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("测试工单");
    expect(res.body.creator).toBeDefined();
    expect(res.body.systemCode).toBe(SYSTEM_VALUE);
  });
});

describe("PATCH /api/tickets/:id/status", () => {
  it("普通用户不能直接设置为processing", async () => {
    const createRes = await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "测试工单", type: "bug", systemCode: SYSTEM_VALUE });
    const res = await request(app).patch(`/api/tickets/${createRes.body.id}/status`).set("Authorization", `Bearer ${token}`).send({ status: "processing" });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/tickets 扩展筛选", () => {
  it("应该支持按所属系统筛选", async () => {
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "江苏工单", type: "bug", systemCode: SYSTEM_VALUE });
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "安徽工单", type: "bug", systemCode: "老安徽电力交易辅助系统" });
    const res = await request(app)
      .get(`/api/tickets?systemCode=${encodeURIComponent(SYSTEM_VALUE)}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(1);
    expect(res.body.rows[0].title).toBe("江苏工单");
  });

  it("应该支持提交人姓名模糊查询", async () => {
    const reg2 = await request(app).post("/api/auth/register").send({ username: "zhangsan", password: "password123", realName: "张三" });
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${reg2.body.token}`).send({ title: "张三的工单", type: "bug", systemCode: SYSTEM_VALUE });
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "我的工单", type: "bug", systemCode: SYSTEM_VALUE });
    const res = await request(app)
      .get("/api/tickets?creator=张")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(1);
    expect(res.body.rows[0].title).toBe("张三的工单");
  });

  it("应该支持处理人姓名模糊查询", async () => {
    const createRes = await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "待分配工单", type: "bug", systemCode: SYSTEM_VALUE });
    // 直接指定处理人为当前测试用户（realName=测试用户）
    await Ticket.update({ assigneeId: userId }, { where: { id: createRes.body.id } });
    const res = await request(app)
      .get("/api/tickets?assignee=测试")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.some((t) => t.title === "待分配工单")).toBe(true);
  });
});
