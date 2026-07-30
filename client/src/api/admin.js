import request from "./request";

export function listTickets(params) { return request.get("/admin/tickets", { params }); }
export function updateTicket(id, data) { return request.patch(`/admin/tickets/${id}`, data); }
export function listNotifyRules() { return request.get("/admin/notify-rules"); }
export function createNotifyRule(data) { return request.post("/admin/notify-rules", data); }
export function updateNotifyRule(id, data) { return request.patch(`/admin/notify-rules/${id}`, data); }
export function deleteNotifyRule(id) { return request.delete(`/admin/notify-rules/${id}`); }
export function listUsers() { return request.get("/admin/users"); }
export function createUser(data) { return request.post("/admin/users", data); }
export function updateUser(id, data) { return request.patch(`/admin/users/${id}`, data); }
