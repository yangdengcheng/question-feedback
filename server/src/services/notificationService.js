const { Notification, NotifyRule } = require("../models");

async function notifyNewTicket(ticket) {
  const rules = await NotifyRule.findAll({ where: { isActive: true } });
  const notifications = [];
  for (const rule of rules) {
    if (rule.ticketType && rule.ticketType !== ticket.type) continue;
    if (rule.userId === ticket.userId) continue;
    notifications.push({
      userId: rule.userId,
      ticketId: ticket.id,
      type: "new_ticket",
      content: `新工单 ${ticket.ticketNo}：${ticket.title}`,
    });
  }
  if (notifications.length > 0) {
    await Notification.bulkCreate(notifications);
  }
}

async function notifyComment(ticket, comment, commenter) {
  const userIdsToNotify = new Set();
  if (ticket.userId !== commenter.id) userIdsToNotify.add(ticket.userId);
  if (ticket.assigneeId && ticket.assigneeId !== commenter.id) userIdsToNotify.add(ticket.assigneeId);

  const notifications = [];
  for (const uid of userIdsToNotify) {
    notifications.push({
      userId: uid,
      ticketId: ticket.id,
      type: "new_comment",
      content: `${commenter.realName} 在工单 ${ticket.ticketNo} 中发表了新评论`,
    });
  }
  if (notifications.length > 0) {
    await Notification.bulkCreate(notifications);
  }
}

async function notifyStatusChange(ticket, newStatus) {
  const statusLabels = { pending: "待处理", processing: "处理中", resolved: "已解决", closed: "已关闭" };
  await Notification.create({
    userId: ticket.userId,
    ticketId: ticket.id,
    type: "status_change",
    content: `工单 ${ticket.ticketNo} 状态变更为「${statusLabels[newStatus]}」`,
  });
}

async function notifyAssigned(ticket, assignee) {
  await Notification.create({
    userId: assignee.id,
    ticketId: ticket.id,
    type: "assigned",
    content: `您被分配了工单 ${ticket.ticketNo}：${ticket.title}`,
  });
}

module.exports = { notifyNewTicket, notifyComment, notifyStatusChange, notifyAssigned };
