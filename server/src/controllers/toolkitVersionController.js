const fs = require("fs");
const path = require("path");
const { sequelize, ToolPackage, ToolPackageVersion, User } = require("../models");
const { MAINTAINER_ROLES } = require("../middleware/roles");

async function listVersions(req, res, next) {
  try {
    const pkg = await ToolPackage.findByPk(req.params.id);
    if (!pkg) return res.status(404).json({ message: "工具包不存在" });
    if (!pkg.isActive && !MAINTAINER_ROLES.includes(req.user.role)) {
      return res.status(404).json({ message: "工具包不存在" });
    }
    const rows = await ToolPackageVersion.findAll({
      where: { packageId: pkg.id },
      include: [{ model: User, as: "creator", attributes: ["id", "realName"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function createVersion(req, res, next) {
  try {
    const pkg = await ToolPackage.findByPk(req.params.id);
    if (!pkg) return res.status(404).json({ message: "工具包不存在" });
    const { version, releaseNote, fileUrl, fileName, fileSize } = req.body;
    if (!version || !fileUrl || !fileName) {
      return res.status(400).json({ message: "版本号和文件不能为空" });
    }
    const t = await sequelize.transaction();
    try {
      const ver = await ToolPackageVersion.create(
        {
          packageId: pkg.id,
          version: String(version).trim(),
          releaseNote: releaseNote || null,
          fileUrl,
          fileName,
          fileSize: Number(fileSize) || 0,
          createdBy: req.user.id,
        },
        { transaction: t },
      );
      await pkg.update({ currentVersionId: ver.id }, { transaction: t });
      await t.commit();
      res.status(201).json(ver);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "该版本号已存在" });
    }
    next(error);
  }
}

async function download(req, res, next) {
  try {
    const ver = await ToolPackageVersion.findByPk(req.params.vid, {
      include: [{ model: ToolPackage, as: "package", attributes: ["id", "isActive"] }],
    });
    if (!ver) return res.status(404).json({ message: "版本不存在" });
    if (!ver.package.isActive && !MAINTAINER_ROLES.includes(req.user.role)) {
      return res.status(404).json({ message: "版本不存在" });
    }
    const abs = path.resolve(ver.fileUrl);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: "文件不存在" });
    res.download(abs, ver.fileName);
  } catch (error) {
    next(error);
  }
}

module.exports = { listVersions, createVersion, download };
