const request = require("supertest");
const app = require("../src/app");
const { sequelize, Notification } = require("../src/models");

let token, userId;

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

beforeEach(async () => {
  await sequelize.sync({ force: true });
  const regRes = await request(app).post("/api/auth/register").send({ username: "testuser", password: "password123", realName: "测试用户" });
  token = regRes.body.token;
  userId = regRes.body.user.id;
  const ticketRes = await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "测试工单", type: "bug" });
  await Notification.bulkCreate([
    { userId, ticketId: ticketRes.body.id, type: "new_comment", content: "测试通知1" },
    { userId, ticketId: ticketRes.body.id, type: "status_change", content: "测试通知2" },
  ]);
});

describe("GET /api/notifications", () => {
  it("应该返回通知列表", async () => {
    const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(2);
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("应该返回未读数量", async () => {
    const res = await request(app).get("/api/notifications/unread-count").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

describe("PATCH /api/notifications/read", () => {
  it("应该标记全部已读", async () => {
    await request(app).patch("/api/notifications/read").set("Authorization", `Bearer ${token}`).send({ all: true });
    const countRes = await request(app).get("/api/notifications/unread-count").set("Authorization", `Bearer ${token}`);
    expect(countRes.body.count).toBe(0);
  });
});
