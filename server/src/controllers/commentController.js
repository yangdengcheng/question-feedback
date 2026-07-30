const { Comment, Ticket, User, Attachment } = require("../models");
const { notifyComment } = require("../services/notificationService");

async function create(req, res, next) {
  try {
    const { content, attachmentIds } = req.body;
    const ticketId = req.params.ticketId;
    if (!content || !content.trim()) return res.status(400).json({ message: "评论内容不能为空" });
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: "工单不存在" });
    const comment = await Comment.create({ ticketId: parseInt(ticketId, 10), userId: req.user.id, content: content.trim() });
    if (attachmentIds && attachmentIds.length > 0) {
      await Attachment.update({ commentId: comment.id, ticketId: parseInt(ticketId, 10) }, { where: { id: attachmentIds, uploadedBy: req.user.id } });
    }
    if (ticket.status === "resolved" && ticket.userId === req.user.id) {
      ticket.status = "processing";
      await ticket.save();
    }
    await notifyComment(ticket, comment, req.user);
    const result = await Comment.findByPk(comment.id, {
      include: [{ model: User, as: "author", attributes: ["id", "username", "realName"] }, { model: Attachment, as: "attachments" }],
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function list(req, res, next) {
  try {
    const ticketId = req.params.ticketId;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: "工单不存在" });
    const comments = await Comment.findAll({
      where: { ticketId: parseInt(ticketId, 10) },
      include: [{ model: User, as: "author", attributes: ["id", "username", "realName"] }, { model: Attachment, as: "attachments" }],
      order: [["createdAt", "ASC"]],
    });
    res.json(comments);
  } catch (error) { next(error); }
}

module.exports = { create, list };
