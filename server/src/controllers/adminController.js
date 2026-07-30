const { Ticket, User } = require("../models");
const { Op } = require("sequelize");
const { notifyAssigned, notifyStatusChange } = require("../services/notificationService");
const { logAction } = require("../services/ticketLogService");

async function listTickets(req, res, next) {
  try {
    const { page = 1, pageSize = 20, status, type, priority } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    const { keyword, ticketNo } = req.query;
    if (keyword) {
      where.title = { [Op.like]: `%${keyword}%` };
    }
    if (ticketNo) {
      where.ticketNo = { [Op.like]: `%${ticketNo}%` };
    }
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
      const oldAssigneeId = ticket.assigneeId;
      ticket.assigneeId = assigneeId;
      if (assigneeId) {
        const assignee = await User.findByPk(assigneeId);
        if (assignee) await notifyAssigned(ticket, assignee);
      }
      await logAction({ ticketId: ticket.id, userId: req.user.id, action: "assigned", fromAssigneeId: oldAssigneeId, toAssigneeId: assigneeId });
    }
    if (status && status !== ticket.status) {
      const oldStatus = ticket.status;
      ticket.status = status;
      await notifyStatusChange(ticket, status);
      await logAction({ ticketId: ticket.id, userId: req.user.id, action: "status_changed", fromStatus: oldStatus, toStatus: status });
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
    if (req.body.realName !== undefined) user.realName = req.body.realName;
    if (req.body.email !== undefined) user.email = req.body.email;
    await user.save();
    const { passwordHash, ...rest } = user.toJSON();
    res.json(rest);
  } catch (error) { next(error); }
}

async function createUser(req, res, next) {
  try {
    const bcrypt = require("bcryptjs");
    const { username, password, realName, email, role } = req.body;
    if (!username || !password || !realName || !role) {
      return res.status(400).json({ message: "用户名、密码、姓名、角色为必填项" });
    }
    const validRoles = ["customer", "data_maintenance", "dev_lead", "developer", "tester", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "无效的角色" });
    }
    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(409).json({ message: "用户名已存在" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash, realName, email: email || null, role });
    const { passwordHash: _, ...rest } = user.toJSON();
    res.status(201).json(rest);
  } catch (error) { next(error); }
}

module.exports = { listTickets, updateTicket, listUsers, updateUser, createUser };
