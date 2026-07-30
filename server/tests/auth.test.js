const request = require("supertest");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ where: {} });
});

describe("POST /api/auth/register", () => {
  it("应该成功注册新用户", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "testuser",
      password: "password123",
      realName: "测试用户",
      email: "test@example.com",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe("testuser");
    expect(res.body.user.realName).toBe("测试用户");
    expect(res.body.token).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("应该拒绝重复用户名", async () => {
    await request(app).post("/api/auth/register").send({
      username: "testuser", password: "password123", realName: "用户1",
    });
    const res = await request(app).post("/api/auth/register").send({
      username: "testuser", password: "password456", realName: "用户2",
    });
    expect(res.status).toBe(409);
  });

  it("应该拒绝缺少必填字段", async () => {
    const res = await request(app).post("/api/auth/register").send({ username: "testuser" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      username: "testuser", password: "password123", realName: "测试用户",
    });
  });

  it("应该成功登录", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "testuser", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe("testuser");
  });

  it("应该拒绝错误密码", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "testuser", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  let token;
  beforeEach(async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "testuser", password: "password123", realName: "测试用户",
    });
    token = res.body.token;
  });

  it("应该返回当前用户信息", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("testuser");
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("应该拒绝无token请求", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
