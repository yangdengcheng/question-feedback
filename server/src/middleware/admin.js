function admin(req, res, next) {
  const allowedRoles = ["admin", "dev_lead"];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "需要管理员或开发主管权限" });
  }
  next();
}

module.exports = admin;
