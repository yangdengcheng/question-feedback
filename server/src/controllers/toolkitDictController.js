const { Op } = require("sequelize");
const { ToolDict, ToolPackage } = require("../models");

const VALID_TYPES = ["province", "category"];

async function list(req, res, next) {
  try {
    const where = {};
    if (req.query.type) {
      if (!VALID_TYPES.includes(req.query.type)) {
        return res.status(400).json({ message: "无效的字典类型" });
      }
      where.type = req.query.type;
    }
    const rows = await ToolDict.findAll({ where, order: [["sort", "ASC"], ["id", "ASC"]] });
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { type, code, name, sort } = req.body;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ message: "无效的字典类型" });
    if (!code || !name) return res.status(400).json({ message: "编码和名称不能为空" });
    const item = await ToolDict.create({
      type,
      code: String(code).trim(),
      name: String(name).trim(),
      sort: Number(sort) || 0,
      isActive: true,
    });
    res.status(201).json(item);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "该编码已存在" });
    }
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const item = await ToolDict.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: "字典项不存在" });
    const { code, name, sort, isActive } = req.body;
    const patch = {};
    if (code !== undefined) patch.code = String(code).trim();
    if (name !== undefined) patch.name = String(name).trim();
    if (sort !== undefined) patch.sort = Number(sort) || 0;
    if (isActive !== undefined) patch.isActive = !!isActive;
    if (patch.code === "" || patch.name === "") {
      return res.status(400).json({ message: "编码和名称不能为空" });
    }
    await item.update(patch);
    res.json(item);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "该编码已存在" });
    }
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const item = await ToolDict.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: "字典项不存在" });
    const ref = await ToolPackage.count({
      where: { [Op.or]: [{ provinceId: item.id }, { categoryId: item.id }] },
    });
    if (ref > 0) {
      return res.status(409).json({ message: "该字典项已被工具包引用，无法删除" });
    }
    await item.destroy();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, create, update, remove };
