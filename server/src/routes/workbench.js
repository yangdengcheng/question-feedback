const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { maintainerOnly } = require("../middleware/roles");
const ctrl = require("../controllers/workbenchController");

// 工作台：需登录 + 维护者角色（developer / dev_lead / admin），与服务监控入口一致
router.use(auth, maintainerOnly);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
