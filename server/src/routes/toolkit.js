const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { maintainerOnly } = require("../middleware/roles");
const dictCtrl = require("../controllers/toolkitDictController");
const pkgCtrl = require("../controllers/toolkitController");
const verCtrl = require("../controllers/toolkitVersionController");

// 工具包模块全部接口需登录
router.use(auth);

// 字典（省份 / 分类）
router.get("/dicts", dictCtrl.list);
router.post("/dicts", maintainerOnly, dictCtrl.create);
router.put("/dicts/:id", maintainerOnly, dictCtrl.update);
router.delete("/dicts/:id", maintainerOnly, dictCtrl.remove);

// 工具包
router.get("/packages", pkgCtrl.list);
router.get("/packages/:id", pkgCtrl.detail);
router.post("/packages", maintainerOnly, pkgCtrl.create);
router.put("/packages/:id", maintainerOnly, pkgCtrl.update);
router.put("/packages/:id/toggle", maintainerOnly, pkgCtrl.toggle);

// 版本
router.get("/packages/:id/versions", verCtrl.listVersions);
router.post("/packages/:id/versions", maintainerOnly, verCtrl.createVersion);
router.get("/versions/:vid/download", verCtrl.download);

module.exports = router;
