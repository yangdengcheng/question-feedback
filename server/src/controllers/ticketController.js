const { Ticket, User, Attachment, TicketLog } = require("../models");
const { Op } = require("sequelize");
const { generateTicketNo } = require("../services/ticketService");
const { notifyNewTicket, notifyStatusChange, notifyAssigned } = require("../services/notificationService");
const { logAction } = require("../services/ticketLogService");

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
    await logAction({ ticketId: ticket.id, userId: req.user.id, action: "created", toStatus: "pending" });
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

    const INTERNAL_ROLES = ["data_maintenance", "dev_lead", "developer", "tester", "admin"];
    const isInternal = INTERNAL_ROLES.includes(req.user.role);

    let where = {};
    if (isInternal && (req.user.role === "admin" || req.user.role === "dev_lead")) {
      where = {};
    } else if (isInternal) {
      where = { [Op.or]: [{ userId: req.user.id }, { assigneeId: req.user.id }] };
    } else {
      where = { userId: req.user.id };
    }

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
        {
          model: TicketLog,
          as: "logs",
          include: [
            { model: User, as: "operator", attributes: ["id", "realName"] },
            { model: User, as: "fromAssignee", attributes: ["id", "realName"] },
            { model: User, as: "toAssignee", attributes: ["id", "realName"] },
          ],
          order: [["createdAt", "ASC"]],
        },
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

    // Internal roles can change status freely
    const INTERNAL_ROLES = ["data_maintenance", "dev_lead", "developer", "tester", "admin"];
    const isInternal = INTERNAL_ROLES.includes(req.user.role);

    if (!isInternal) {
      // Customer: only resolved → closed or resolved → processing
      if (ticket.userId !== req.user.id) return res.status(403).json({ message: "无权操作此工单" });
      const allowedTransitions = { resolved: ["closed", "processing"] };
      const allowed = allowedTransitions[ticket.status];
      if (!allowed || !allowed.includes(status)) return res.status(403).json({ message: "不允许的状态变更" });
    } else {
      // Internal: must be assignee, creator, or admin/dev_lead
      if (req.user.role !== "admin" && req.user.role !== "dev_lead" && ticket.assigneeId !== req.user.id && ticket.userId !== req.user.id) {
        return res.status(403).json({ message: "无权操作此工单" });
      }
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    await ticket.save();
    await logAction({ ticketId: ticket.id, userId: req.user.id, action: "status_changed", fromStatus: oldStatus, toStatus: status });
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

async function transfer(req, res, next) {
  try {
    const { toUserId, content } = req.body;
    if (!toUserId) return res.status(400).json({ message: "请选择转交人" });
    if (!content || !content.trim()) return res.status(400).json({ message: "转工单必须填写说明" });

    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ message: "工单不存在" });

    const INTERNAL_ROLES = ["data_maintenance", "dev_lead", "developer", "tester", "admin"];
    if (!INTERNAL_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: "仅内部人员可转工单" });
    }

    const targetUser = await User.findByPk(toUserId);
    if (!targetUser) return res.status(400).json({ message: "目标用户不存在" });

    const oldAssigneeId = ticket.assigneeId;
    ticket.assigneeId = toUserId;
    if (ticket.status === "pending") ticket.status = "processing";
    await ticket.save();

    await logAction({
      ticketId: ticket.id,
      userId: req.user.id,
      action: "transferred",
      fromAssigneeId: oldAssigneeId,
      toAssigneeId: toUserId,
      content: content.trim(),
    });

    // Notify the new assignee
    await notifyAssigned(ticket, targetUser);

    const result = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "realName"] },
        { model: User, as: "assignee", attributes: ["id", "username", "realName"] },
      ],
    });
    res.json(result);
  } catch (error) { next(error); }
}

module.exports = { create, list, detail, updateStatus, transfer };
