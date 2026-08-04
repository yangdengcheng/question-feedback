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
export function deleteVersion(vid) { return request.delete(`/toolkit/versions/${vid}`); }

// 从 Content-Disposition 中解析文件名（优先 UTF-8 编码的 filename*）
function parseFileName(disposition, fallback) {
  if (!disposition) return fallback;
  const utf8 = disposition.match(/filename\*\s*=\s*[^']*''([^;]+)/i);
  if (utf8) {
    try { return decodeURIComponent(utf8[1].trim()); } catch (_) { /* 继续回退 */ }
  }
  const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (plain) return plain[1].trim();
  return fallback;
}

// 下载（携带鉴权头，拿到 blob 后触发浏览器下载）
export async function downloadVersion(vid, fileName) {
  const res = await request.get(`/toolkit/versions/${vid}/download`, { responseType: "blob" });
  const name = parseFileName(res.headers["content-disposition"], fileName || "download");
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
