import request from "./request";

export function listTickets(params) { return request.get("/admin/tickets", { params }); }
export function updateTicket(id, data) { return request.patch(`/admin/tickets/${id}`, data); }
export function listUsers() { return request.get("/admin/users"); }
export function createUser(data) { return request.post("/admin/users", data); }
export function updateUser(id, data) { return request.patch(`/admin/users/${id}`, data); }
