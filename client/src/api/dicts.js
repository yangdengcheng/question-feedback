import request from "./request";

/**
 * 通用字典工具：按字典编码拉取后端字典项（下拉框数据源）
 * 后端契约：GET /api/dicts/:code -> [{ id, dictCode, dictValue, sort }]
 *
 * 用法示例：
 *   import { getDictValues } from "../api/dicts";
 *   const options = await getDictValues("system_code");
 *   // options: [{ id, dictCode, dictValue, sort }, ...]
 */

const dictCache = new Map(); // code -> 字典项数组（页面生命周期内缓存，避免重复请求）
const pending = new Map(); // code -> 进行中的 Promise（并发去重：同一 code 同时多处调用只发一次请求）

/**
 * 按字典编码获取启用中的字典项列表
 * @param {string} code 字典编码，如 "system_code"
 * @param {{ force?: boolean }} [options] force=true 时跳过缓存强制刷新
 * @returns {Promise<Array<{ id:number, dictCode:string, dictValue:string, sort:number }>>}
 */
export function getDictValues(code, { force = false } = {}) {
  if (!code) return Promise.resolve([]);
  if (!force && dictCache.has(code)) return Promise.resolve(dictCache.get(code));
  if (pending.has(code)) return pending.get(code);

  const promise = request
    .get(`/dicts/${code}`)
    .then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      dictCache.set(code, list);
      return list;
    })
    .finally(() => pending.delete(code));

  pending.set(code, promise);
  return promise;
}

/** 清除字典缓存：传 code 清单个，不传全清（字典数据在后台变更后可调用） */
export function clearDictCache(code) {
  if (code) dictCache.delete(code);
  else dictCache.clear();
}
