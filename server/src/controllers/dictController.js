const { SysDict } = require("../models");

// 根据字典编码获取字典值列表（通用下拉数据源）
// GET /api/dicts/:code -> [{ id, dictCode, dictValue, sort }]
async function listByCode(req, res, next) {
  try {
    const code = String(req.params.code || "").trim();
    if (!code) return res.status(400).json({ message: "字典编码不能为空" });

    const rows = await SysDict.findAll({
      where: { dictCode: code, isActive: true },
      attributes: ["id", "dictCode", "dictValue", "sort"],
      order: [["sort", "ASC"], ["id", "ASC"]],
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

module.exports = { listByCode };
