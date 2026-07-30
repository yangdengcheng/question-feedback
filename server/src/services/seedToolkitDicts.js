const { ToolDict } = require("../models");

// 工具包字典初始数据：省份 + 分类。findOrCreate 幂等，已存在则跳过。
const SEEDS = [
  { type: "province", code: "anhui", name: "安徽", sort: 1 },
  { type: "province", code: "jiangsu", name: "江苏", sort: 2 },
  { type: "category", code: "tampermonkey", name: "油猴脚本", sort: 1 },
];

async function seedToolkitDicts() {
  for (const s of SEEDS) {
    await ToolDict.findOrCreate({
      where: { type: s.type, code: s.code },
      defaults: { name: s.name, sort: s.sort, isActive: true },
    });
  }
}

module.exports = seedToolkitDicts;
