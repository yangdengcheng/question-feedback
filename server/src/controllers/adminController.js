const { sequelize, Ticket, User, Comment, Attachment, Notification, TicketLog, ToolPackage, ToolPackageVersion } = require("../models");
const { Op } = require("sequelize");
const { notifyAssigned, notifyStatusChange } = require("../services/notificationService");
const { logAction } = require("../services/ticketLogService");
const { removeFileQuiet, resolveAttachmentPath } = require("../utils/file");

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

// 删除工单及其关联数据（通知、附件+磁盘文件、评论、操作日志）
async function destroyTickets(ids) {
  const tickets = await Ticket.findAll({ where: { id: ids }, attributes: ["id"] });
  if (tickets.length === 0) return 0;
  const ticketIds = tickets.map((t) => t.id);
  const attachments = await Attachment.findAll({ where: { ticketId: ticketIds }, attributes: ["filePath"] });
  const t = await sequelize.transaction();
  try {
    await Notification.destroy({ where: { ticketId: ticketIds }, transaction: t });
    await Attachment.destroy({ where: { ticketId: ticketIds }, transaction: t });
    await Comment.destroy({ where: { ticketId: ticketIds }, transaction: t });
    await TicketLog.destroy({ where: { ticketId: ticketIds }, transaction: t });
    await Ticket.destroy({ where: { id: ticketIds }, transaction: t });
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
  attachments.forEach((a) => { const p = resolveAttachmentPath(a.filePath); if (p) removeFileQuiet(p); });
  return ticketIds.length;
}

async function deleteTicket(req, res, next) {
  try {
    const count = await destroyTickets([req.params.id]);
    if (!count) return res.status(404).json({ message: "工单不存在" });
    res.json({ message: "删除成功" });
  } catch (error) { next(error); }
}

async function batchDeleteTickets(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "请选择要删除的工单" });
    }
    const count = await destroyTickets(ids);
    res.json({ message: `已删除 ${count} 条工单`, count });
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

// 删除用户并级联清理：其创建的工单（含评论/附件/通知/日志）、其在他人工单下的评论与附件、
// 其收到的通知、处理人引用，工具包/版本创建人移交操作者，最后删除磁盘附件文件
async function destroyUsers(userIds, operatorId) {
  const users = await User.findAll({ where: { id: userIds }, attributes: ["id"] });
  if (users.length === 0) return 0;
  const ids = users.map((u) => u.id);

  // 这些用户创建的工单（需级联删除）
  const ownedTickets = await Ticket.findAll({ where: { userId: ids }, attributes: ["id"] });
  const ticketIds = ownedTickets.map((t) => t.id);
  // 这些用户发表的评论（含他人工单下的）
  const ownComments = await Comment.findAll({ where: { userId: ids }, attributes: ["id"] });
  const commentIds = ownComments.map((c) => c.id);

  // 待删磁盘文件：其上传的附件 / 属于被删工单的附件 / 属于其评论的附件
  const attachOr = [{ uploadedBy: ids }];
  if (ticketIds.length) attachOr.push({ ticketId: ticketIds });
  if (commentIds.length) attachOr.push({ commentId: commentIds });
  const attachments = await Attachment.findAll({ where: { [Op.or]: attachOr }, attributes: ["filePath"] });

  const t = await sequelize.transaction();
  try {
    // 通知：其收到的 + 属于被删工单的
    const notiOr = [{ userId: ids }];
    if (ticketIds.length) notiOr.push({ ticketId: ticketIds });
    await Notification.destroy({ where: { [Op.or]: notiOr }, transaction: t });
    // 附件须先于评论/工单/日志删除（外键约束）
    await Attachment.destroy({ where: { [Op.or]: attachOr }, transaction: t });
    // 评论：被删工单下的 + 其发表的
    const commentDelOr = [{ userId: ids }];
    if (ticketIds.length) commentDelOr.push({ ticketId: ticketIds });
    await Comment.destroy({ where: { [Op.or]: commentDelOr }, transaction: t });
    // 操作日志：被删工单的 + 其操作的
    const logDelOr = [{ userId: ids }];
    if (ticketIds.length) logDelOr.push({ ticketId: ticketIds });
    await TicketLog.destroy({ where: { [Op.or]: logDelOr }, transaction: t });
    if (ticketIds.length) await Ticket.destroy({ where: { id: ticketIds }, transaction: t });
    // 剩余工单的处理人引用置空
    await Ticket.update({ assigneeId: null }, { where: { assigneeId: ids }, transaction: t });
    // 工具包/版本创建人移交操作者
    await ToolPackage.update({ createdBy: operatorId }, { where: { createdBy: ids }, transaction: t });
    await ToolPackageVersion.update({ createdBy: operatorId }, { where: { createdBy: ids }, transaction: t });
    await User.destroy({ where: { id: ids }, transaction: t });
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
  attachments.forEach((a) => { const p = resolveAttachmentPath(a.filePath); if (p) removeFileQuiet(p); });
  return ids.length;
}

// 删除前校验：不能删自己、不能删最后一个管理员
async function validateUserDeletion(ids, operatorId) {
  if (ids.includes(operatorId)) return "不能删除当前登录用户";
  const targets = await User.findAll({ where: { id: ids }, attributes: ["id", "role"] });
  if (targets.some((u) => u.role === "admin")) {
    const adminLeft = await User.count({ where: { role: "admin", id: { [Op.notIn]: ids } } });
    if (adminLeft === 0) return "不能删除最后一个管理员";
  }
  return null;
}

async function deleteUser(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "用户不存在" });
    const reason = await validateUserDeletion([id], req.user.id);
    if (reason) return res.status(400).json({ message: reason });
    await destroyUsers([id], req.user.id);
    res.json({ message: "删除成功" });
  } catch (error) { next(error); }
}

async function batchDeleteUsers(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "请选择要删除的用户" });
    }
    const reason = await validateUserDeletion(ids, req.user.id);
    if (reason) return res.status(400).json({ message: reason });
    const count = await destroyUsers(ids, req.user.id);
    res.json({ message: `已删除 ${count} 个用户`, count });
  } catch (error) { next(error); }
}

module.exports = { listTickets, updateTicket, deleteTicket, batchDeleteTickets, listUsers, updateUser, createUser, deleteUser, batchDeleteUsers };
