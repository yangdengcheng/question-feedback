const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/workbenchController");

// 工作台：登录即可访问（可见范围由每条记录的 roles 字段控制）；
// 新增/编辑/删除在控制器内限定为 admin / dev_lead / developer
router.use(auth);

router.get("/", ctrl.list);
router.get("/tags", ctrl.tags);
router.get("/top", ctrl.top);
router.post("/:id/visit", ctrl.visit);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
