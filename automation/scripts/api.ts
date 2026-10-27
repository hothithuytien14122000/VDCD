// Dọn dữ liệu test qua API bằng token admin (đáng tin hơn thao tác UI).
import fs from 'node:fs';
import cfg from '../accounts.mjs';
const BASE = cfg.baseURL;

export function tokenOf(key: string): string {
  const st = JSON.parse(fs.readFileSync(`auth/${key}.json`, 'utf8'));
  const ls = st.origins[0].localStorage as { name: string; value: string }[];
  return ls.map(x => x.value).find(v => v.split('.').length === 3)!;
}
function token(): string { return tokenOf('superadmin'); }
const H = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

// Gọi API thô với vai trò/không token (test phân quyền & auth). Trả HTTP status.
export async function apiStatus(opts: {
  method?: string; resource: string; body?: any; as?: string; rawToken?: string;
}): Promise<number> {
  const { method = 'GET', resource, body, as, rawToken } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (rawToken !== undefined) headers.Authorization = `Bearer ${rawToken}`;
  else if (as) headers.Authorization = `Bearer ${tokenOf(as)}`;
  const res = await fetch(`${BASE}/api/v1/${resource}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}
export const API_BASE = BASE;

// resource: 'unit-types' | 'provinces' | 'communes' | 'organizations' | 'idm/roles' | 'idm/users'
export async function findIdByCode(resource: string, code: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/v1/${resource}?pageSize=200&keyword=${encodeURIComponent(code)}`, { headers: H() });
  const j = await res.json();
  const list = j?.data?.content ?? j?.data?.items ?? j?.data ?? [];
  const hit = list.find((x: any) => x.code === code || x.userName === code || x.email === code || x.name === code);
  return hit?.id ?? null;
}
// Lấy nguyên bản ghi theo mã (để khẳng định dữ liệu đã lưu đúng).
export async function apiFind(resource: string, code: string): Promise<any | null> {
  const res = await fetch(`${BASE}/api/v1/${resource}?pageSize=200&keyword=${encodeURIComponent(code)}`, { headers: H() });
  const j = await res.json();
  const list = j?.data?.content ?? j?.data?.items ?? j?.data ?? [];
  return list.find((x: any) => x.code === code || x.userName === code || x.email === code) ?? null;
}
// Tìm bản ghi theo chuỗi con trong name (dùng cho resource không có mã, vd kỳ đánh giá).
export async function apiFindByName(resource: string, nameSub: string): Promise<any | null> {
  const res = await fetch(`${BASE}/api/v1/${resource}?pageSize=500&keyword=${encodeURIComponent(nameSub)}`, { headers: H() });
  const j = await res.json();
  const list = j?.data?.content ?? j?.data?.items ?? j?.data ?? [];
  return list.find((x: any) => (x.name || '').includes(nameSub)) ?? null;
}
export async function apiDelete(resource: string, id: string): Promise<number> {
  const res = await fetch(`${BASE}/api/v1/${resource}/${id}`, { method: 'DELETE', headers: H() });
  return res.status;
}
// Dọn: tìm theo mã rồi xóa. Trả true nếu đã xóa hoặc không còn tồn tại.
export async function cleanup(resource: string, code: string): Promise<boolean> {
  const id = await findIdByCode(resource, code);
  if (!id) return true;
  const st = await apiDelete(resource, id);
  return st >= 200 && st < 300;
}

// Dọn theo chuỗi con trong name (xóa mọi bản ghi khớp).
export async function cleanupByName(resource: string, nameSub: string): Promise<number> {
  const res = await fetch(`${BASE}/api/v1/${resource}?pageSize=500&keyword=${encodeURIComponent(nameSub)}`, { headers: H() });
  const j = await res.json().catch(() => ({}));
  const list = j?.data?.content ?? j?.data?.items ?? j?.data ?? [];
  let n = 0;
  for (const x of list) {
    if (x?.id && (x.name || '').includes(nameSub)) { await apiDelete(resource, x.id); n++; }
  }
  return n;
}
// Tạo nhanh bản ghi qua API (tiền điều kiện cho test sửa/xóa).
// Một số resource (idm/roles) trả 200 mà không kèm id -> trả null, test tìm theo mã trên UI.
export async function apiCreate(resource: string, body: any): Promise<string | null> {
  const res = await fetch(`${BASE}/api/v1/${resource}`, { method:'POST', headers: H(), body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!(res.status >= 200 && res.status < 300)) throw new Error('apiCreate lỗi: ' + (j?.message || res.status));
  return j?.data?.id ?? null;
}
