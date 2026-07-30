const express = require("express");
const router = express.Router({ mergeParams: true });
const commentController = require("../controllers/commentController");
const auth = require("../middleware/auth");

router.use(auth);
router.get("/", commentController.list);
router.post("/", commentController.create);

module.exports = router;
