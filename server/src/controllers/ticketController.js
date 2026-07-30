const { Ticket, User, Attachment } = require("../models");
const { generateTicketNo } = require("../services/ticketService");
const { notifyNewTicket, notifyStatusChange } = require("../services/notificationService");

async function create(req, res, next) {
  try {
    const { title, description, type, priority, attachmentIds } = req.body;
    if (!title) {
      return res.status(400).json({ message: "标题不能为空" });
    }
    const ticketNo = await generateTicketNo();
    const ticket = await Ticket.create({
      ticketNo, title,
      description: description || null,
      type: type || "bug",
      priority: priority || "medium",
      userId: req.user.id,
    });
    if (attachmentIds && attachmentIds.length > 0) {
      await Attachment.update({ ticketId: ticket.id }, { where: { id: attachmentIds, uploadedBy: req.user.id } });
    }
    await notifyNewTicket(ticket);
    const result = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "realName"] },
        { model: Attachment, as: "attachments" },
      ],
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const { page = 1, pageSize = 20, status, type, priority } = req.query;
    const where = { userId: req.user.id };
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
      limit: parseInt(pageSize, 10),
      offset,
    });
    res.json({ count, rows, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "realName"] },
        { model: User, as: "assignee", attributes: ["id", "username", "realName"] },
        { model: Attachment, as: "attachments" },
      ],
    });
    if (!ticket) return res.status(404).json({ message: "工单不存在" });
    if (ticket.userId !== req.user.id && req.user.role !== "admin" && ticket.assigneeId !== req.user.id) {
      return res.status(403).json({ message: "无权查看此工单" });
    }
    res.json(ticket);
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ message: "工单不存在" });

    if (req.user.role !== "admin") {
      if (ticket.userId !== req.user.id) return res.status(403).json({ message: "无权操作此工单" });
      const allowedTransitions = { resolved: ["closed", "processing"] };
      const allowed = allowedTransitions[ticket.status];
      if (!allowed || !allowed.includes(status)) return res.status(403).json({ message: "不允许的状态变更" });
    }

    ticket.status = status;
    await ticket.save();
    if (ticket.userId !== req.user.id) await notifyStatusChange(ticket, status);

    const result = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "realName"] },
        { model: User, as: "assignee", attributes: ["id", "username", "realName"] },
      ],
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { create, list, detail, updateStatus };
