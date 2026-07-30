import request from "./request";

export function createTicket(data) { return request.post("/tickets", data); }
export function listTickets(params) { return request.get("/tickets", { params }); }
export function getTicketDetail(id) { return request.get(`/tickets/${id}`); }
export function updateTicketStatus(id, status) { return request.patch(`/tickets/${id}/status`, { status }); }
export function listComments(ticketId) { return request.get(`/tickets/${ticketId}/comments`); }
export function createComment(ticketId, data) { return request.post(`/tickets/${ticketId}/comments`, data); }
