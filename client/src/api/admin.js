import request from "./request";

export function listTickets(params) { return request.get("/admin/tickets", { params }); }
export function updateTicket(id, data) { return request.patch(`/admin/tickets/${id}`, data); }
export function deleteTicket(id) { return request.delete(`/admin/tickets/${id}`); }
export function batchDeleteTickets(ids) { return request.post("/admin/tickets/batch-delete", { ids }); }
export function listUsers() { return request.get("/admin/users"); }
export function createUser(data) { return request.post("/admin/users", data); }
export function updateUser(id, data) { return request.patch(`/admin/users/${id}`, data); }
export function deleteUser(id) { return request.delete(`/admin/users/${id}`); }
export function batchDeleteUsers(ids) { return request.post("/admin/users/batch-delete", { ids }); }
