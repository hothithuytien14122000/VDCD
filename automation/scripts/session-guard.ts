// Chốt chặn session cho các spec: tránh PASS giả khi session hết hạn và trang bị đẩy về màn Đăng nhập
// (khi đó bảng rỗng → các assert kiểu "không có X" luôn đúng).
//  - beforeAll: token của project (storageState auth/<key>.json) phải còn hợp lệ phía máy chủ, nếu không → FAIL ngay.
//  - afterEach: nếu bất kỳ trang nào đang ở màn Đăng nhập / báo "Phiên đăng nhập hết hạn" → FAIL test đó.
// Dùng: import { guardSession } from '../session-guard'; guardSession(test);  (hoặc guardSession(test, 'admin') nếu spec tự tạo context bằng auth/admin.json)
import fs from 'node:fs';
import path from 'node:path';
import { API_BASE } from './api';

const TOKEN_KEY = 'b316682e-54f3-4ae1-89e3-bbc505e19e54';
const LOGIN_URL = /\/auth\/login/;

function tokenFromState(state: unknown): string | null {
  if (typeof state !== 'string') return null;
  const file = path.resolve(state);
  if (!fs.existsSync(file)) return null;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const o of j.origins ?? []) for (const l of o.localStorage ?? []) if (l.name === TOKEN_KEY) return l.value;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function guardSession(test: any, key?: string) {
  test.beforeAll(async ({}, testInfo: any) => {
    const state = key ? `auth/${key}.json` : testInfo.project.use?.storageState;
    const token = tokenFromState(state);
    if (!token) return; // project không dùng session (vd auth)
    const k = String(state).replace(/^.*auth\/|\.json$/g, '');
    const r = await fetch(`${API_BASE}/api/v1/dti/ranking/defaults`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) throw new Error(`Session ${state} đã hết hạn (401) — kết quả sẽ không hợp lệ. Đăng nhập lại: node login.mjs ${k}`);
  });

  test.afterEach(async ({ browser }: any) => {
    for (const ctx of browser.contexts()) for (const p of ctx.pages()) {
      if (p.isClosed()) continue;
      const expired = await p.getByText('Phiên đăng nhập hết hạn').isVisible().catch(() => false);
      if (LOGIN_URL.test(p.url()) || expired)
        throw new Error(`Trang bị đẩy về màn Đăng nhập (${p.url()}) — session hết hạn, kết quả test không hợp lệ.`);
    }
  });
}
