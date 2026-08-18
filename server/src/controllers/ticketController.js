const { sequelize, Ticket, User, Attachment, TicketLog } = require("../models");
const { Op, fn, col } = require("sequelize");
const { generateTicketNo } = require("../services/ticketService");
const { notifyNewTicket, notifyStatusChange, notifyAssigned, notifyReopen } = require("../services/notificationService");
const { logAction } = require("../services/ticketLogService");

const INTERNAL_ROLES = ["data_maintenance", "dev_lead", "developer", "tester", "admin"];

// 用户可见的工单数据范围（列表与看板统计共用，保证口径一致）：
// admin/dev_lead 看全部；其他用户看「我创建的 + 分配给我的 + 公开的」
function visibleWhere(user) {
  if (user.role === "admin" || user.role === "dev_lead") return {};
  return { [Op.or]: [{ userId: user.id }, { assigneeId: user.id }, { isPublic: true }] };
}

async function create(req, res, next) {
  try {
    const { title, description, type, priority, attachmentIds, isPublic } = req.body;
    if (!title) {
      return res.status(400).json({ message: "标题不能为空" });
    }
    const ticketNo = await generateTicketNo();
    const ticket = await Ticket.create({
      ticketNo, title,
      description: description || null,
      type: type || "bug",
      priority: priority || "medium",
      isPublic: isPublic === undefined ? true : !!isPublic,
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

    let where = visibleWhere(req.user);

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const { keyword } = req.query;
    if (keyword) {
      where.title = { [Op.like]: `%${keyword}%` };
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const { count, rows } = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "realName"] },
        { model: User, as: "assignee", attributes: ["id", "username", "realName"] },
      ],
      // 排序：状态（待处理→处理中→已解决→已关闭）→ 优先级（高→中→低）→ 创建时间降序
      order: [
        [sequelize.literal("FIELD(status, 'pending', 'processing', 'resolved', 'closed')"), "ASC"],
        [sequelize.literal("FIELD(priority, 'high', 'medium', 'low')"), "ASC"],
        ["createdAt", "DESC"],
      ],
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
          separate: true,
          order: [["createdAt", "ASC"]],
          include: [
            { model: User, as: "operator", attributes: ["id", "realName"] },
            { model: User, as: "fromAssignee", attributes: ["id", "realName"] },
            { model: User, as: "toAssignee", attributes: ["id", "realName"] },
            { model: Attachment, as: "attachments" },
          ],
        },
      ],
    });
    if (!ticket) return res.status(404).json({ message: "工单不存在" });
    // 可见口径与列表一致：admin/dev_lead 看全部；其他用户限 我创建的/分配给我的/公开的
    const canView =
      req.user.role === "admin" ||
      req.user.role === "dev_lead" ||
      ticket.userId === req.user.id ||
      ticket.assigneeId === req.user.id ||
      !!ticket.isPublic;
    if (!canView) {
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

    // 已关闭工单统一走「重新打开」操作（必填说明 + 通知相关方），不再允许直接变更状态
    if (ticket.status === "closed") return res.status(400).json({ message: "已关闭的工单请通过「重新打开」操作恢复" });

    // Internal roles can change status freely
    const INTERNAL_ROLES = ["data_maintenance", "dev_lead", "developer", "tester", "admin"];
    const isInternal = INTERNAL_ROLES.includes(req.user.role);

    if (!isInternal) {
      // Customer: only resolved → closed or resolved → processing
      if (ticket.userId !== req.user.id) return res.status(403).json({ message: "无权操作此工单" });
      const allowedTransitions = { resolved: ["closed", "processing"], closed: ["processing"] };
      const allowed = allowedTransitions[ticket.status];
      if (!allowed || !allowed.includes(status)) return res.status(403).json({ message: "不允许的状态变更" });
    } else {
      // 内部：仅处理人或管理员（admin/dev_lead）可变更状态
      if (req.user.role !== "admin" && req.user.role !== "dev_lead" && ticket.assigneeId !== req.user.id) {
        return res.status(403).json({ message: "仅处理人或管理员可变更状态" });
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
    const { toUserId, content, attachmentIds } = req.body;
    if (!toUserId) return res.status(400).json({ message: "请选择转交人" });
    if (!content || !content.trim()) return res.status(400).json({ message: "转工单必须填写说明" });

    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ message: "工单不存在" });

    const INTERNAL_ROLES = ["data_maintenance", "dev_lead", "developer", "tester", "admin"];
    if (!INTERNAL_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: "仅内部人员可转工单" });
    }
    // 仅处理人或管理员（admin/dev_lead）可转工单
    if (req.user.role !== "admin" && req.user.role !== "dev_lead" && ticket.assigneeId !== req.user.id) {
      return res.status(403).json({ message: "仅处理人或管理员可转工单" });
    }

    const targetUser = await User.findByPk(toUserId);
    if (!targetUser) return res.status(400).json({ message: "目标用户不存在" });

    const oldAssigneeId = ticket.assigneeId;
    ticket.assigneeId = toUserId;
    if (ticket.status === "pending") ticket.status = "processing";
    await ticket.save();

    const log = await logAction({
      ticketId: ticket.id,
      userId: req.user.id,
      action: "transferred",
      fromAssigneeId: oldAssigneeId,
      toAssigneeId: toUserId,
      content: content.trim(),
    });

    // 关联转交附件到该流转记录
    if (attachmentIds && attachmentIds.length > 0) {
      await Attachment.update(
        { logId: log.id, ticketId: ticket.id },
        { where: { id: attachmentIds, uploadedBy: req.user.id } },
      );
    }

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

// 可转交的内部用户列表（所有内部角色可访问）
async function listAssignees(req, res, next) {
  try {
    if (!INTERNAL_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: "无权访问" });
    }
    const users = await User.findAll({
      where: { role: { [Op.in]: INTERNAL_ROLES }, isActive: true },
      attributes: ["id", "realName", "role"],
      order: [["createdAt", "DESC"]],
    });
    res.json(users);
  } catch (error) { next(error); }
}

// 工单看板：统计口径与工单列表一致（visibleWhere）
async function stats(req, res, next) {
  try {
    const where = visibleWhere(req.user);

    const grouped = await Ticket.findAll({
      where,
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    });
    const byStatus = { pending: 0, processing: 0, resolved: 0, closed: 0 };
    let total = 0;
    for (const g of grouped) {
      const c = parseInt(g.count, 10);
      byStatus[g.status] = c;
      total += c;
    }

    const recent = await Ticket.findAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "realName"] },
        { model: User, as: "assignee", attributes: ["id", "realName"] },
      ],
      order: [["updatedAt", "DESC"]],
      limit: 8,
    });

    res.json({ byStatus, total, recent });
  } catch (error) { next(error); }
}

// 相似工单：title 的 ngram FULLTEXT 分词模糊查询（新建工单页左侧防重复提交提示用）
// 采用 BOOLEAN 模式 + 应用侧拆 bigram：每个 bigram 作为可选词（OR 语义 + 相关度排序），
// 规避 NATURAL LANGUAGE 模式「出现在 >50% 行的词被忽略」的小样本陷阱
async function similar(req, res, next) {
  try {
    const keyword = String(req.query.keyword || "").trim();
    if (keyword.length < 2) return res.json([]);

    let phrase;
    if (keyword.length === 2) {
      phrase = keyword;
    } else {
      const grams = [];
      for (let i = 0; i <= keyword.length - 2; i++) grams.push(keyword.slice(i, i + 2));
      phrase = [...new Set(grams)].join(" ");
    }

    const matchExpr = `MATCH(title) AGAINST(${sequelize.escape(phrase)} IN BOOLEAN MODE)`;
    // 召回所有可见工单（含自己历史创建的）：用户可能遗忘自己半年前提过的单，
    // 需要能在相似列表里查到并直接「重新打开」，避免重复新建
    const rows = await Ticket.findAll({
      where: {
        [Op.and]: [
          sequelize.literal(matchExpr),
          visibleWhere(req.user),
        ],
      },
      attributes: ["id", "ticketNo", "title", "status", "priority", "type", "createdAt"],
      order: sequelize.literal(`${matchExpr} DESC`),
      limit: 6,
    });
    res.json(rows);
  } catch (error) { next(error); }
}

// 重新打开工单：任何可见该工单的用户都可操作；处理人保持不变，状态回到待处理
async function reopen(req, res, next) {
  try {
    const { content, attachmentIds } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: "相关说明必须填写" });

    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ message: "工单不存在" });
    if (ticket.status !== "closed") return res.status(400).json({ message: "仅已关闭的工单可重新打开" });

    // 可见口径与详情一致：非可见用户无权重新打开
    const canView =
      req.user.role === "admin" ||
      req.user.role === "dev_lead" ||
      ticket.userId === req.user.id ||
      ticket.assigneeId === req.user.id ||
      !!ticket.isPublic;
    if (!canView) return res.status(403).json({ message: "无权操作此工单" });

    const oldStatus = ticket.status;
    ticket.status = "pending"; // 处理人（assigneeId）保持不变
    await ticket.save();

    const log = await logAction({
      ticketId: ticket.id,
      userId: req.user.id,
      action: "reopened",
      fromStatus: oldStatus,
      toStatus: "pending",
      content: content.trim(),
    });

    // 关联附件到该流转记录
    if (attachmentIds && attachmentIds.length > 0) {
      await Attachment.update(
        { logId: log.id, ticketId: ticket.id },
        { where: { id: attachmentIds, uploadedBy: req.user.id } },
      );
    }

    await notifyReopen(ticket, req.user);

    const result = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "realName"] },
        { model: User, as: "assignee", attributes: ["id", "username", "realName"] },
      ],
    });
    res.json(result);
  } catch (error) { next(error); }
}

module.exports = { create, list, detail, updateStatus, transfer, listAssignees, stats, similar, reopen };
