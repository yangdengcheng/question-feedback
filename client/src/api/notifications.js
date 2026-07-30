import request from "./request";

export function listNotifications(params) { return request.get("/notifications", { params }); }
export function getUnreadCount() { return request.get("/notifications/unread-count"); }
export function markRead(data) { return request.patch("/notifications/read", data); }
