const { Ticket, User, NotifyRule } = require("../models");
const { notifyAssigned, notifyStatusChange } = require("../services/notificationService");

async function listTickets(req, res, next) {
  try {
    const { page = 1, pageSize = 20, status, type, priority } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const { count, rows } = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "realName"] },
        { model: User, as: "assignee", attributes: ["id", "username", "realName"] },
      ],
      order: [["updatedAt", "DESC"]],
      limit: parseInt(pageSize, 10), offset,
    });
    res.json({ count, rows, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
  } catch (error) { next(error); }
}

async function updateTicket(req, res, next) {
  try {
    const { assigneeId, status } = req.body;
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ message: "工单不存在" });
    if (assigneeId !== undefined) {
      ticket.assigneeId = assigneeId;
      if (assigneeId) {
        const assignee = await User.findByPk(assigneeId);
        if (assignee) await notifyAssigned(ticket, assignee);
      }
    }
    if (status && status !== ticket.status) {
      ticket.status = status;
      await notifyStatusChange(ticket, status);
    }
    await ticket.save();
    const result = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "realName"] },
        { model: User, as: "assignee", attributes: ["id", "username", "realName"] },
      ],
    });
    res.json(result);
  } catch (error) { next(error); }
}

async function listNotifyRules(req, res, next) {
  try {
    const rules = await NotifyRule.findAll({
      include: [{ model: User, as: "user", attributes: ["id", "username", "realName"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(rules);
  } catch (error) { next(error); }
}

async function createNotifyRule(req, res, next) {
  try {
    const { userId, ticketType } = req.body;
    if (!userId) return res.status(400).json({ message: "用户ID不能为空" });
    const rule = await NotifyRule.create({ userId, ticketType: ticketType || null });
    const result = await NotifyRule.findByPk(rule.id, {
      include: [{ model: User, as: "user", attributes: ["id", "username", "realName"] }],
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function updateNotifyRule(req, res, next) {
  try {
    const rule = await NotifyRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ message: "规则不存在" });
    const { isActive, ticketType } = req.body;
    if (isActive !== undefined) rule.isActive = isActive;
    if (ticketType !== undefined) rule.ticketType = ticketType;
    await rule.save();
    const result = await NotifyRule.findByPk(rule.id, {
      include: [{ model: User, as: "user", attributes: ["id", "username", "realName"] }],
    });
    res.json(result);
  } catch (error) { next(error); }
}

async function deleteNotifyRule(req, res, next) {
  try {
    const rule = await NotifyRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ message: "规则不存在" });
    await rule.destroy();
    res.json({ message: "删除成功" });
  } catch (error) { next(error); }
}

async function listUsers(req, res, next) {
  try {
    const users = await User.findAll({ attributes: { exclude: ["passwordHash"] }, order: [["createdAt", "DESC"]] });
    res.json(users);
  } catch (error) { next(error); }
}

async function updateUser(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "用户不存在" });
    const { isActive, role } = req.body;
    if (isActive !== undefined) user.isActive = isActive;
    if (role !== undefined) user.role = role;
    await user.save();
    const { passwordHash, ...rest } = user.toJSON();
    res.json(rest);
  } catch (error) { next(error); }
}

module.exports = { listTickets, updateTicket, listNotifyRules, createNotifyRule, updateNotifyRule, deleteNotifyRule, listUsers, updateUser };
