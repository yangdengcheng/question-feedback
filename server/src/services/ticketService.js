const { Ticket } = require("../models");
const { Op } = require("sequelize");

async function generateTicketNo() {
  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const prefix = `FB-${dateStr}-`;

  const lastTicket = await Ticket.findOne({
    where: { ticketNo: { [Op.like]: `${prefix}%` } },
    order: [["ticketNo", "DESC"]],
  });

  let seq = 1;
  if (lastTicket) {
    const lastSeq = parseInt(lastTicket.ticketNo.split("-")[2], 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

module.exports = { generateTicketNo };
