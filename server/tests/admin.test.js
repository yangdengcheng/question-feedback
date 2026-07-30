const request = require("supertest");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");
const bcrypt = require("bcryptjs");

let adminToken, userToken, adminId, userId;

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

beforeEach(async () => {
  await sequelize.sync({ force: true });
  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await User.create({ username: "admin", passwordHash, realName: "管理员", role: "admin" });
  adminId = admin.id;
  const userRes = await request(app).post("/api/auth/register").send({ username: "testuser", password: "password123", realName: "测试用户" });
  userToken = userRes.body.token;
  userId = userRes.body.user.id;
  const loginRes = await request(app).post("/api/auth/login").send({ username: "admin", password: "admin123" });
  adminToken = loginRes.body.token;
});

describe("GET /api/admin/tickets", () => {
  beforeEach(async () => {
    await request(app).post("/api/tickets").set("Authorization", `Bearer ${userToken}`).send({ title: "测试工单", type: "bug" });
  });
  it("管理员应该能查看所有工单", async () => {
    const res = await request(app).get("/api/admin/tickets").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(1);
  });
  it("普通用户应该被拒绝", async () => {
    const res = await request(app).get("/api/admin/tickets").set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/tickets/:id", () => {
  it("应该能分配工单", async () => {
    const ticketRes = await request(app).post("/api/tickets").set("Authorization", `Bearer ${userToken}`).send({ title: "测试工单", type: "bug" });
    const res = await request(app).patch(`/api/admin/tickets/${ticketRes.body.id}`).set("Authorization", `Bearer ${adminToken}`).send({ assigneeId: adminId, status: "processing" });
    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(adminId);
    expect(res.body.status).toBe("processing");
  });
});

describe("Notify Rules CRUD", () => {
  it("应该能创建通知规则", async () => {
    const res = await request(app).post("/api/admin/notify-rules").set("Authorization", `Bearer ${adminToken}`).send({ userId: adminId, ticketType: "bug" });
    expect(res.status).toBe(201);
    expect(res.body.ticketType).toBe("bug");
  });
  it("应该能列出通知规则", async () => {
    await request(app).post("/api/admin/notify-rules").set("Authorization", `Bearer ${adminToken}`).send({ userId: adminId, ticketType: null });
    const res = await request(app).get("/api/admin/notify-rules").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});
