import request from "./request";

// 字典（省份 / 分类）
export function listDicts(type) { return request.get("/toolkit/dicts", { params: { type } }); }
export function createDict(data) { return request.post("/toolkit/dicts", data); }
export function updateDict(id, data) { return request.put(`/toolkit/dicts/${id}`, data); }
export function deleteDict(id) { return request.delete(`/toolkit/dicts/${id}`); }

// 工具包
export function listPackages(params) { return request.get("/toolkit/packages", { params }); }
export function getPackageDetail(id) { return request.get(`/toolkit/packages/${id}`); }
export function createPackage(data) { return request.post("/toolkit/packages", data); }
export function updatePackage(id, data) { return request.put(`/toolkit/packages/${id}`, data); }
export function togglePackage(id) { return request.put(`/toolkit/packages/${id}/toggle`); }

// 版本
export function listVersions(id) { return request.get(`/toolkit/packages/${id}/versions`); }
export function createVersion(id, data) { return request.post(`/toolkit/packages/${id}/versions`, data); }

// 下载（携带鉴权头，拿到 blob 后触发浏览器下载）
export async function downloadVersion(vid, fileName) {
  const blob = await request.get(`/toolkit/versions/${vid}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
