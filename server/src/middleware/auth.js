const jwt = require("jsonwebtoken");
const { User } = require("../models");

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "未提供认证令牌" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "用户不存在" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "账号已被禁用" });
    }
    req.user = user;
    // Update last active time (non-blocking); skip for offline beacon to avoid clobbering the null
    if (req.path !== "/offline") {
      user.update({ lastActiveAt: new Date() }).catch(() => {});
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: "认证令牌无效或已过期" });
  }
}

module.exports = auth;
