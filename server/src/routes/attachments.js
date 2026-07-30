const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const attachmentController = require("../controllers/attachmentController");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, path.join(__dirname, "..", "..", "uploads")); },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/upload", auth, upload.single("file"), attachmentController.upload);
router.get("/attachments/:id", attachmentController.download);

module.exports = router;
