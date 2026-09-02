const request = require("supertest");
const app = require("../src/app");
const { sequelize, SysDict } = require("../src/models");

let token;

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  const res = await request(app).post("/api/auth/register").send({
    username: "dictuser",
    password: "password123",
    realName: "字典测试",
  });
  token = res.body.token;
  await SysDict.bulkCreate([
    // 故意乱序，验证接口按 sort 排序
    { dictCode: "system_code", dictValue: "新江苏电力交易辅助系统", sort: 2 },
    { dictCode: "system_code", dictValue: "老安徽电力交易辅助系统", sort: 1 },
    { dictCode: "system_code", dictValue: "已停用系统", isActive: false },
    { dictCode: "other_code", dictValue: "其他字典值" },
  ]);
});

describe("GET /api/dicts/:code", () => {
  it("按编码返回启用中的字典项，并按 sort 排序", async () => {
    const res = await request(app)
      .get("/api/dicts/system_code")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((d) => d.dictValue)).toEqual([
      "老安徽电力交易辅助系统",
      "新江苏电力交易辅助系统",
    ]);
  });

  it("停用字典项不返回", async () => {
    const res = await request(app)
      .get("/api/dicts/system_code")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.some((d) => d.dictValue === "已停用系统")).toBe(false);
  });

  it("不同编码互不影响", async () => {
    const res = await request(app)
      .get("/api/dicts/other_code")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].dictValue).toBe("其他字典值");
  });

  it("未知编码返回空数组", async () => {
    const res = await request(app)
      .get("/api/dicts/not_exists")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("未登录返回 401", async () => {
    const res = await request(app).get("/api/dicts/system_code");
    expect(res.status).toBe(401);
  });
});
