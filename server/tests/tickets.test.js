const request = require("supertest");
const app = require("../src/app");
const { sequelize, User, Ticket } = require("../src/models");

let token;
let userId;

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
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
      .send({ title: "登录页面报错", description: "点击登录按钮后页面白屏", type: "bug", priority: "high" });
    expect(res.status).toBe(201);
    expect(res.body.ticketNo).toMatch(/^FB-\d{8}-\d{3}$/);
    expect(res.body.title).toBe("登录页面报错");
    expect(res.body.status).toBe("pending");
  });

  it("应该拒绝缺少标题", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "没有标题" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tickets", () => {
  beforeEach(async () => {
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "工单1", type: "bug" });
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "工单2", type: "question" });
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
    const createRes = await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "测试工单", type: "bug" });
    const res = await request(app).get(`/api/tickets/${createRes.body.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("测试工单");
    expect(res.body.creator).toBeDefined();
  });
});

describe("PATCH /api/tickets/:id/status", () => {
  it("普通用户不能直接设置为processing", async () => {
    const createRes = await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "测试工单", type: "bug" });
    const res = await request(app).patch(`/api/tickets/${createRes.body.id}/status`).set("Authorization", `Bearer ${token}`).send({ status: "processing" });
    expect(res.status).toBe(403);
  });
});
