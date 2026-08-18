import request from "./request";

export function createTicket(data) { return request.post("/tickets", data); }
export function listTickets(params) { return request.get("/tickets", { params }); }
export function listAssignees() { return request.get("/tickets/assignees"); }
export function getTicketStats() { return request.get("/tickets/stats"); }
export function listSimilarTickets(keyword) { return request.get("/tickets/similar", { params: { keyword } }); }
export function getTicketDetail(id) { return request.get(`/tickets/${id}`); }
export function updateTicketStatus(id, status) { return request.patch(`/tickets/${id}/status`, { status }); }
export function transferTicket(id, data) { return request.patch(`/tickets/${id}/transfer`, data); }
export function reopenTicket(id, data) { return request.post(`/tickets/${id}/reopen`, data); }
export function listComments(ticketId) { return request.get(`/tickets/${ticketId}/comments`); }
export function createComment(ticketId, data) { return request.post(`/tickets/${ticketId}/comments`, data); }
