const request = require("supertest");
const app = require("../src/app");
const { sequelize } = require("../src/models");

let token;
let ticketId;

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

beforeEach(async () => {
  await sequelize.sync({ force: true });
  const regRes = await request(app).post("/api/auth/register").send({ username: "testuser", password: "password123", realName: "测试用户" });
  token = regRes.body.token;
  const ticketRes = await request(app).post("/api/tickets").set("Authorization", `Bearer ${token}`).send({ title: "测试工单", type: "bug" });
  ticketId = ticketRes.body.id;
});

describe("POST /api/tickets/:ticketId/comments", () => {
  it("应该成功添加评论", async () => {
    const res = await request(app).post(`/api/tickets/${ticketId}/comments`).set("Authorization", `Bearer ${token}`).send({ content: "这是一条评论" });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe("这是一条评论");
    expect(res.body.author).toBeDefined();
  });
  it("应该拒绝空评论", async () => {
    const res = await request(app).post(`/api/tickets/${ticketId}/comments`).set("Authorization", `Bearer ${token}`).send({ content: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tickets/:ticketId/comments", () => {
  beforeEach(async () => {
    await request(app).post(`/api/tickets/${ticketId}/comments`).set("Authorization", `Bearer ${token}`).send({ content: "第一条评论" });
    await request(app).post(`/api/tickets/${ticketId}/comments`).set("Authorization", `Bearer ${token}`).send({ content: "第二条评论" });
  });
  it("应该返回评论列表及作者信息", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}/comments`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].author.realName).toBe("测试用户");
  });
});
