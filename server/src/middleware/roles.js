// 通用角色守卫中间件
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "无权操作" });
    }
    next();
  };
}

// 工具包维护者角色
const MAINTAINER_ROLES = ["developer", "dev_lead", "admin"];
const maintainerOnly = requireRoles(...MAINTAINER_ROLES);

module.exports = { requireRoles, MAINTAINER_ROLES, maintainerOnly };
