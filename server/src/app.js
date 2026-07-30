const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const commentRoutes = require("./routes/comments");
const attachmentRoutes = require("./routes/attachments");
const notificationRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");
const toolkitRoutes = require("./routes/toolkit");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => { res.json({ status: "ok" }); });

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/tickets/:ticketId/comments", commentRoutes);
app.use("/api", attachmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/toolkit", toolkitRoutes);

app.use(errorHandler);

module.exports = app;
