const express = require("express");
const router = express.Router();
const dictController = require("../controllers/dictController");
const auth = require("../middleware/auth");

router.use(auth);
// 根据字典编码获取字典值列表，如 GET /api/dicts/system_code
router.get("/:code", dictController.listByCode);

module.exports = router;
