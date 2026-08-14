const { Op } = require("sequelize");
const { Workbench, User } = require("../models");

const PAGE_SIZE = 12; // 卡片布局：4 行 × 3 列

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

function canModify(wb, user) {
  return wb.createdBy === user.id || user.role === "admin";
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(48, Math.max(1, parseInt(req.query.pageSize) || PAGE_SIZE));
    const { count, rows } = await Workbench.findAndCountAll({
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

async function create(req, res, next) {
  try {
    const nameRes = normalizeName(req.body.name);
    if (nameRes.error) return res.status(400).json({ message: nameRes.error });
    const { error, url } = normalizeUrl(req.body.url);
    if (error) return res.status(400).json({ message: error });

    const exists = await Workbench.findOne({ where: { url } });
    if (exists) return res.status(400).json({ message: "该地址已在工作台中，请勿重复添加" });

    const wb = await Workbench.create({ name: nameRes.name, url, createdBy: req.user.id });
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
    const wb = await Workbench.findByPk(req.params.id);
    if (!wb) return res.status(404).json({ message: "工作台不存在" });
    if (!canModify(wb, req.user)) {
      return res.status(403).json({ message: "只能修改自己创建的工作台" });
    }

    const nameRes = normalizeName(req.body.name);
    if (nameRes.error) return res.status(400).json({ message: nameRes.error });
    const { error, url } = normalizeUrl(req.body.url);
    if (error) return res.status(400).json({ message: error });

    const exists = await Workbench.findOne({ where: { url, id: { [Op.ne]: wb.id } } });
    if (exists) return res.status(400).json({ message: "该地址已在工作台中，请勿重复添加" });

    await wb.update({ name: nameRes.name, url });
    res.json(wb);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const wb = await Workbench.findByPk(req.params.id);
    if (!wb) return res.status(404).json({ message: "工作台不存在" });
    if (!canModify(wb, req.user)) {
      return res.status(403).json({ message: "只能删除自己创建的工作台" });
    }
    await wb.destroy();
    res.json({ message: "已删除" });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, create, update, remove };
