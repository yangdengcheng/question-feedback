import request from "./request";

// 工作台
export function listWorkbenches(params) { return request.get("/workbench", { params }); }
export function workbenchTags() { return request.get("/workbench/tags"); }
export function topWorkbenches() { return request.get("/workbench/top"); }
export function visitWorkbench(id) { return request.post(`/workbench/${id}/visit`); }
export function createWorkbench(data) { return request.post("/workbench", data); }
export function updateWorkbench(id, data) { return request.put(`/workbench/${id}`, data); }
export function deleteWorkbench(id) { return request.delete(`/workbench/${id}`); }
