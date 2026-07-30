const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { maintainerOnly } = require("../middleware/roles");
const dictCtrl = require("../controllers/toolkitDictController");

// 工具包模块全部接口需登录
router.use(auth);

// 字典（省份 / 分类）
router.get("/dicts", dictCtrl.list);
router.post("/dicts", maintainerOnly, dictCtrl.create);
router.put("/dicts/:id", maintainerOnly, dictCtrl.update);
router.delete("/dicts/:id", maintainerOnly, dictCtrl.remove);

module.exports = router;
