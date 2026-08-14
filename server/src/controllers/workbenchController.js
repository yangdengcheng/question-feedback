const { Op, literal } = require("sequelize");
const sequelize = require("../config/database");
const { Workbench, User } = require("../models");

// LIKE 模糊匹配：转义 % _ 防止通配符注入
function like(v) {
  return { [Op.like]: `%${String(v).replace(/[%_]/g, "\\$&")}%` };
}

const PAGE_SIZE = 12; // 卡片布局：4 行 × 3 列

// 系统全部角色（与 users.role ENUM 一致）
const VALID_ROLES = ["customer", "data_maintenance", "dev_lead", "developer", "tester", "admin"];
// 可新增/编辑/删除工作台的角色：管理员、系统开发主管、系统开发
const MODIFY_ROLES = ["admin", "dev_lead", "developer"];

// 可见性范围：roles 为空表示全员可见；否则仅配置的角色可见。
// 管理员/系统开发主管/系统开发 始终可见全部（返回 null 表示不限制）。
// 注意：返回对象用 Op.or（Symbol）作键，调用方不得用 Object.keys 判空，统一用 null 显式表达「不限制」
function visibleScope(user) {
  if (MODIFY_ROLES.includes(user.role)) return null;
  return {
    [Op.or]: [
      { roles: null },
      { roles: "" },
      literal(`FIND_IN_SET(${sequelize.escape(user.role)}, roles) > 0`),
    ],
  };
}

// 可见角色解析：数组/逗号串均可，校验合法性后存逗号分隔串，空值存 null（全员可见）
function parseRoles(input) {
  let arr = Array.isArray(input) ? input : String(input || "").split(",");
  arr = [...new Set(arr.map((r) => String(r).trim()).filter(Boolean))];
  const invalid = arr.filter((r) => !VALID_ROLES.includes(r));
  if (invalid.length) return { error: `无效的角色: ${invalid.join(", ")}` };
  return { value: arr.length ? arr.join(",") : null };
}

// 地址规范化：缺协议自动补 http://，再校验合法性
function normalizeUrl(raw) {
  let url = String(raw || "").trim();
  if (!url) return { error: "服务地址不能为空" };
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return { error: "地址格式不正确，请填写如 http://192.168.0.3:5180/" };
  }
  if (!parsed.hostname) return { error: "地址中未解析到有效主机" };
  if (url.length > 255) return { error: "地址过长（最多 255 个字符）" };
  return { url };
}

// 名称规范化：必填、去首尾空格、限长 100
function normalizeName(raw) {
  const name = String(raw || "").trim();
  if (!name) return { error: "工作台名称不能为空" };
  if (name.length > 100) return { error: "名称过长（最多 100 个字符）" };
  return { name };
}

// 标签规范化：空值→null（未分类）；去首尾空格、限长 50
function normalizeTag(raw) {
  const tag = String(raw ?? "").trim();
  if (!tag) return { value: null };
  if (tag.length > 50) return { error: "标签过长（最多 50 个字符）" };
  return { value: tag };
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(48, Math.max(1, parseInt(req.query.pageSize) || PAGE_SIZE));
    // 可见性范围 + 关键词过滤并存，用 Op.and 避免两个 Op.or 互相覆盖
    const filters = [];
    const scope = visibleScope(req.user);
    if (scope) filters.push(scope);
    if (req.query.keyword) {
      const k = like(req.query.keyword);
      filters.push({ [Op.or]: [{ name: k }, { url: k }] });
    }
    // 标签筛选（tab 栏选中），与可见性/关键词叠加生效；untagged=1 表示「其他」（未绑标签）
    if (req.query.tag) {
      filters.push({ tag: String(req.query.tag) });
    } else if (req.query.untagged === "1") {
      filters.push({ [Op.or]: [{ tag: null }, { tag: "" }] });
    }
    const where = filters.length ? { [Op.and]: filters } : {};
    const { count, rows } = await Workbench.findAndCountAll({
      where,
      include: [{ model: User, as: "creator", attributes: ["id", "realName"] }],
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ count, rows, page, pageSize });
  } catch (error) {
    next(error);
  }
}

// 标签清单：对当前用户可见的工作台按 tag 分组去重（数据量小，无需独立标签表）
async function tags(req, res, next) {
  try {
    const filters = [];
    const scope = visibleScope(req.user);
    if (scope) filters.push(scope);
    filters.push({ tag: { [Op.ne]: null } }, { tag: { [Op.ne]: "" } });
    const rows = await Workbench.findAll({
      attributes: ["tag"],
      where: { [Op.and]: filters },
      group: ["tag"],
      order: [["tag", "ASC"]],
      raw: true,
    });
    res.json(rows.map((r) => r.tag));
  } catch (error) {
    next(error);
  }
}

// 访问排行：按访问次数降序，只取前 10，且只统计当前用户可见的工作台
async function top(req, res, next) {
  try {
    const rows = await Workbench.findAll({
      where: visibleScope(req.user) || {},
      attributes: ["id", "name", "url", "visitCount"],
      order: [["visitCount", "DESC"], ["id", "DESC"]],
      limit: 10,
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

// 访问计数 +1：version 乐观锁（CAS），冲突自动重试；不可见的工作台一律 404
async function visit(req, res, next) {
  try {
    const id = req.params.id;
    for (let attempt = 0; attempt < 3; attempt++) {
      const wb = await Workbench.findOne({
        where: { id, ...(visibleScope(req.user) || {}) },
        attributes: ["id", "version"],
      });
      if (!wb) return res.status(404).json({ message: "工作台不存在" });
      const [affected] = await Workbench.update(
        {
          visitCount: literal("visit_count + 1"),
          version: literal("version + 1"),
        },
        { where: { id, version: wb.version } },
      );
      if (affected > 0) {
        const updated = await Workbench.findByPk(id, { attributes: ["id", "visitCount"] });
        return res.json({ visitCount: updated.visitCount });
      }
      // affected === 0 说明 version 已被其他请求推进，重试
    }
    res.status(409).json({ message: "并发冲突，请稍后重试" });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    if (!MODIFY_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: "仅管理员、系统开发主管、系统开发可新增工作台" });
    }
    const nameRes = normalizeName(req.body.name);
    if (nameRes.error) return res.status(400).json({ message: nameRes.error });
    const { error, url } = normalizeUrl(req.body.url);
    if (error) return res.status(400).json({ message: error });
    const rolesRes = parseRoles(req.body.roles ?? null);
    if (rolesRes.error) return res.status(400).json({ message: rolesRes.error });
    const tagRes = normalizeTag(req.body.tag);
    if (tagRes.error) return res.status(400).json({ message: tagRes.error });

    const exists = await Workbench.findOne({ where: { url } });
    if (exists) return res.status(400).json({ message: "该地址已在工作台中，请勿重复添加" });

    const wb = await Workbench.create({
      name: nameRes.name,
      url,
      roles: rolesRes.value,
      tag: tagRes.value,
      createdBy: req.user.id,
    });
    await wb.reload({
      include: [{ model: User, as: "creator", attributes: ["id", "realName"] }],
    });
    res.status(201).json(wb);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    if (!MODIFY_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: "仅管理员、系统开发主管、系统开发可编辑工作台" });
    }
    const wb = await Workbench.findByPk(req.params.id);
    if (!wb) return res.status(404).json({ message: "工作台不存在" });

    const nameRes = normalizeName(req.body.name);
    if (nameRes.error) return res.status(400).json({ message: nameRes.error });
    const { error, url } = normalizeUrl(req.body.url);
    if (error) return res.status(400).json({ message: error });
    let roles = wb.roles;
    if (req.body.roles !== undefined) {
      const rolesRes = parseRoles(req.body.roles);
      if (rolesRes.error) return res.status(400).json({ message: rolesRes.error });
      roles = rolesRes.value;
    }
    let tag = wb.tag;
    if (req.body.tag !== undefined) {
      const tagRes = normalizeTag(req.body.tag);
      if (tagRes.error) return res.status(400).json({ message: tagRes.error });
      tag = tagRes.value;
    }

    const exists = await Workbench.findOne({ where: { url, id: { [Op.ne]: wb.id } } });
    if (exists) return res.status(400).json({ message: "该地址已在工作台中，请勿重复添加" });

    await wb.update({ name: nameRes.name, url, roles, tag });
    res.json(wb);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    if (!MODIFY_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: "仅管理员、系统开发主管、系统开发可删除工作台" });
    }
    const wb = await Workbench.findByPk(req.params.id);
    if (!wb) return res.status(404).json({ message: "工作台不存在" });
    await wb.destroy();
    res.json({ message: "已删除" });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, tags, top, visit, create, update, remove };
