const { Notification, Ticket } = require("../models");

async function list(req, res, next) {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const { count, rows } = await Notification.findAndCountAll({
      where: { userId: req.user.id },
      include: [{ model: Ticket, as: "ticket", attributes: ["id", "ticketNo", "title"] }],
      order: [["createdAt", "DESC"]],
      limit: parseInt(pageSize, 10), offset,
    });
    res.json({ count, rows, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
  } catch (error) { next(error); }
}

async function unreadCount(req, res, next) {
  try {
    const count = await Notification.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ count });
  } catch (error) { next(error); }
}

async function markRead(req, res, next) {
  try {
    const { ids, all } = req.body;
    if (all) {
      await Notification.update({ isRead: true, readAt: new Date() }, { where: { userId: req.user.id, isRead: false } });
    } else if (ids && ids.length > 0) {
      await Notification.update({ isRead: true, readAt: new Date() }, { where: { id: ids, userId: req.user.id } });
    } else {
      return res.status(400).json({ message: "请提供 ids 数组或 all: true" });
    }
    res.json({ message: "标记成功" });
  } catch (error) { next(error); }
}

module.exports = { list, unreadCount, markRead };
