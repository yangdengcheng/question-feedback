const { Op } = require("sequelize");
const { ToolPackage, ToolDict, ToolPackageVersion, User } = require("../models");
const { MAINTAINER_ROLES } = require("../middleware/roles");

function like(v) {
  return { [Op.like]: `%${String(v).replace(/[%_]/g, "\\$&")}%` };
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const where = { isActive: true };
    if (req.query.provinceId) where.provinceId = req.query.provinceId;
    if (req.query.categoryId) where.categoryId = req.query.categoryId;
    if (req.query.keyword) where.name = like(req.query.keyword);

    const { count, rows } = await ToolPackage.findAndCountAll({
      where,
      include: [
        { model: ToolDict, as: "province", attributes: ["id", "name", "code"] },
        { model: ToolDict, as: "category", attributes: ["id", "name", "code"] },
        { model: ToolPackageVersion, as: "currentVersion", attributes: ["id", "version"] },
      ],
      order: [["updatedAt", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ count, rows, page, pageSize });
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const pkg = await ToolPackage.findByPk(req.params.id, {
      include: [
        { model: ToolDict, as: "province", attributes: ["id", "name", "code"] },
        { model: ToolDict, as: "category", attributes: ["id", "name", "code"] },
        { model: ToolPackageVersion, as: "currentVersion" },
        { model: User, as: "creator", attributes: ["id", "realName"] },
      ],
    });
    if (!pkg) return res.status(404).json({ message: "工具包不存在" });
    if (!pkg.isActive && !MAINTAINER_ROLES.includes(req.user.role)) {
      return res.status(404).json({ message: "工具包不存在" });
    }
    res.json(pkg);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { name, provinceId, categoryId, summary, docMarkdown } = req.body;
    if (!name || !provinceId || !categoryId) {
      return res.status(400).json({ message: "名称、省份、分类不能为空" });
    }
    const pkg = await ToolPackage.create({
      name: String(name).trim(),
      provinceId,
      categoryId,
      summary: summary || null,
      docMarkdown: docMarkdown || "",
      createdBy: req.user.id,
    });
    await pkg.reload({
      include: [
        { model: ToolDict, as: "province", attributes: ["id", "name", "code"] },
        { model: ToolDict, as: "category", attributes: ["id", "name", "code"] },
      ],
    });
    res.status(201).json(pkg);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const pkg = await ToolPackage.findByPk(req.params.id);
    if (!pkg) return res.status(404).json({ message: "工具包不存在" });
    const { name, provinceId, categoryId, summary, docMarkdown } = req.body;
    const patch = {};
    if (name !== undefined) patch.name = String(name).trim();
    if (provinceId !== undefined) patch.provinceId = provinceId;
    if (categoryId !== undefined) patch.categoryId = categoryId;
    if (summary !== undefined) patch.summary = summary || null;
    if (docMarkdown !== undefined) patch.docMarkdown = docMarkdown || "";
    if (patch.name === "") return res.status(400).json({ message: "名称不能为空" });
    await pkg.update(patch);
    await pkg.reload({
      include: [
        { model: ToolDict, as: "province", attributes: ["id", "name", "code"] },
        { model: ToolDict, as: "category", attributes: ["id", "name", "code"] },
        { model: ToolPackageVersion, as: "currentVersion" },
      ],
    });
    res.json(pkg);
  } catch (error) {
    next(error);
  }
}

async function toggle(req, res, next) {
  try {
    const pkg = await ToolPackage.findByPk(req.params.id);
    if (!pkg) return res.status(404).json({ message: "工具包不存在" });
    await pkg.update({ isActive: !pkg.isActive });
    res.json(pkg);
  } catch (error) {
    next(error);
  }
}

module.exports = { list, detail, create, update, toggle };
