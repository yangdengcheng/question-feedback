const { TicketLog } = require("../models");

async function logAction({ ticketId, userId, action, fromStatus, toStatus, fromAssigneeId, toAssigneeId, content }) {
  return TicketLog.create({
    ticketId,
    userId,
    action,
    fromStatus: fromStatus || null,
    toStatus: toStatus || null,
    fromAssigneeId: fromAssigneeId || null,
    toAssigneeId: toAssigneeId || null,
    content: content || null,
  });
}

module.exports = { logAction };
