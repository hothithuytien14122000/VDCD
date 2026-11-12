// Tiện ích dùng chung cho testcase PHÂN HỆ E — Khảo sát mức độ hài lòng của người dân.
// ID tự đánh số theo (page, nhóm chữ cái); mỗi testcase gắn 1 "điều kiện" (tag) để requirements-E.mjs truy vết:
// điều kiện khai trong requirements-E mà không có testcase nào gắn tag => trace-check báo thiếu.
export const REG = new Map();           // 'SVY|tag' -> [id,…]
const cnt = {};
export const M = why => 'Manual: ' + why;
export function mkAdd(t, P) {
  return (tag, letter, uc, fn, title, type, pri, steps, exp, note = '', auto = 'Auto') => {
    const k = P + letter; cnt[k] = (cnt[k] || 0) + 1;
    const id = `${P}-${letter}${String(cnt[k]).padStart(2, '0')}`;
    t(id, uc, fn, title, type, pri, steps, exp, auto, note);
    const key = `${P}|${letter}.${tag}`; if (!REG.has(key)) REG.set(key, []); REG.get(key).push(id);
    return id;
  };
}
export const ids = (P, ...tags) => tags.flatMap(g => REG.get(`${P}|${g}`) || []).join('|') || `${P}-NONE`;
export const BA = 'Cần BA xác nhận quy tắc';
