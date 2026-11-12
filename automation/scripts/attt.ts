// Dùng chung cho kiểm tra ATTT cấp độ 2 (testcases/docs/catalog-ATTT.mjs). Tên test = "[ID] tiêu đề" từ catalog.json.
// registerModuleSuite(P, cfg) sinh bộ kiểm tra chung (X/Q/V/W/L/S/N/H) cho 1 phân hệ; chỉ đăng ký test có automation = Auto.
import fs from 'node:fs';
import tls from 'node:tls';
import { test as base, expect, Page } from '@playwright/test';
import { tokenOf, API_BASE, apiDelete } from './api';
import { hidePwExpiry } from './helpers';
export { expect, tokenOf, API_BASE };

type TC = { id: string; title: string; auto: string };
const CATALOG: TC[] = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8'));
/** ID đã loại (testcases/docs/removed.json) → tiêu đề gắn nhãn [ĐÃ LOẠI], playwright.config.ts bỏ qua bằng grepInvert. */
const REMOVED: Record<string, string> = fs.existsSync('testcases/docs/removed.json') ? JSON.parse(fs.readFileSync('testcases/docs/removed.json', 'utf8')) : {};
export const tc = (id: string): string => {
  if (REMOVED[id]) return `[ĐÃ LOẠI] [${id}]`;
  const x = CATALOG.find(c => c.id === id);
  if (!x) throw new Error(`Testcase ${id} không có trong catalog`);
  return `[${id}] ${x.title}`;
};
export const isAuto = (id: string) => CATALOG.find(c => c.id === id)?.auto === 'Auto';
export const test = base;
/** Đăng ký test nếu testcase là Auto (testcase Manual không có script). */
export function at(id: string, fn: (a: { page: Page; browser: any }) => Promise<void>) {
  if (isAuto(id)) test(tc(id), async ({ page, browser }) => fn({ page, browser }));
}

export const FAKE = '00000000-0000-4000-8000-000000000000';
export const HOST = new URL(API_BASE).host;
export const ROLES = ['canbo', 'cbdp', 'ldd', 'ldp', 'lanhdaobo', 'xemonly'].filter(k => fs.existsSync(`auth/${k}.json`));
const ADMIN = 'superadmin';

// ---------- Gọi API thô ----------
export interface Res { status: number; text: string; json: any; data: any; message: string; headers: Headers }
export async function call(method: string, resource: string, o: { as?: string | null; token?: string; body?: any; raw?: string; ctype?: string; headers?: Record<string, string> } = {}): Promise<Res> {
  const h: Record<string, string> = { ...(o.headers ?? {}) };
  const tok = o.token ?? (o.as === null ? undefined : tokenOf(o.as ?? ADMIN));
  if (tok) h.Authorization = `Bearer ${tok}`;
  if (o.body !== undefined || o.raw !== undefined) h['Content-Type'] = o.ctype ?? 'application/json';
  const r = await fetch(`${API_BASE}/api/v1/${resource}`, { method, headers: h, body: o.raw ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined) });
  const text = await r.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: r.status, text, json, data: json?.data, message: String(json?.message ?? ''), headers: r.headers };
}
export const rowsOf = (d: any): any[] => d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
export async function perms(as: string): Promise<Map<string, string>> {
  const r = await call('GET', 'idm/permission-matrix/me', { as });
  return new Map((r.data ?? []).map((x: any) => [x.code, x.scope]));
}
export async function myInfo(as: string) { return (await call('GET', 'idm/users/info', { as })).data ?? {}; }

// ---------- Phiên tài khoản QC còn sống ----------
// Phiên hết hạn (401) không kiểm tra được quyền: mọi API đều 401 → bỏ qua tài khoản đó (ghi chú ENV), không tính là lỗi phân quyền.
let liveP: Promise<{ ok: string[]; dead: string[] }> | null = null;
export async function liveRoles(): Promise<string[]> {
  liveP ??= (async () => {
    const ok: string[] = [], dead: string[] = [];
    for (const r of ROLES) { const s = (await call('GET', 'idm/users/info', { as: r })).status; (s === 200 ? ok : dead).push(s === 200 ? r : `${r} (HTTP ${s})`); }
    return { ok, dead };
  })();
  const { ok, dead } = await liveP;
  if (dead.length) test.info().annotations.push({ type: 'ENV', description: `Phiên hết hạn, không kiểm tra được: ${dead.join(', ')}` });
  return ok;
}

// ---------- Nhật ký quyết định phân quyền (authorization/audits) ----------
// Hệ thống ghi mọi lần BE từ chối (decision = DENY, reason = NO_PERMISSION) kèm userId, resource, action, ipAddress vào authorization/audits.
export async function authzSnapshot() { return new Set(rowsOf((await call('GET', 'authorization/audits?page=1&size=200')).data).map(keyOf)); }
export async function newAuthz(snap: Set<string>): Promise<any[]> {
  await new Promise(f => setTimeout(f, 1500));
  return rowsOf((await call('GET', 'authorization/audits?page=1&size=200')).data).filter(x => !snap.has(keyOf(x)));
}
// ---------- Nhật ký truy cập (system/access-logs: đăng nhập, đăng xuất, phiên, đổi/đặt lại mật khẩu) ----------
export async function accessSnapshot() { return new Set(rowsOf((await call('GET', 'system/access-logs?page=1&size=200')).data).map(keyOf)); }
export async function newAccess(snap: Set<string>): Promise<any[]> {
  await new Promise(f => setTimeout(f, 1500));
  return rowsOf((await call('GET', 'system/access-logs?page=1&size=200')).data).filter(x => !snap.has(keyOf(x)));
}
export const isPrivateIp = (ip: string) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/i.test(ip);

// ---------- Token giả ----------
const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function forgedTokens(): Record<string, string> {
  const real = tokenOf('canbo'); const [h, p, s] = real.split('.');
  const pl = JSON.parse(Buffer.from(p, 'base64url').toString());
  return {
    'chuỗi ngẫu nhiên': 'qca.' + Math.random().toString(36).slice(2) + '.attt',
    'sửa payload (x-roles=SUPER_ADMIN), giữ chữ ký cũ': `${h}.${b64({ ...pl, 'x-roles': 'SUPER_ADMIN', 'x-level': 0 })}.${s}`,
    'alg=none, bỏ chữ ký': `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...pl, 'x-roles': 'SUPER_ADMIN' })}.`,
  };
}

// ---------- Dấu hiệu lộ thông tin ----------
export const LEAK = /Exception|\bat [A-Z][\w.]+\(|Npgsql|System\.[A-Z]|Microsoft\.|\/opt\/|\/home\/|\/var\/www|stack ?trace|SELECT .* FROM|INSERT INTO|pg_dump/i;
const SENS_KEY = /^(password|passwordHash|passwordSalt|securityStamp|resetPasswordToken|emailVerifyToken|refreshToken|accessToken|secret|clientSecret|connectionString|apiKey|otp)$/i;
/** Trả danh sách đường dẫn khóa nhạy cảm đang mang giá trị (khác null/rỗng). */
export function sensitiveKeys(o: any, path = ''): string[] {
  if (!o || typeof o !== 'object') return [];
  return Object.entries(o).flatMap(([k, v]) => [
    ...(SENS_KEY.test(k) && v !== null && v !== '' && v !== undefined ? [`${path}${k}`] : []),
    ...(typeof v === 'object' ? sensitiveKeys(v, `${path}${k}.`) : []),
  ]);
}

// ---------- Nhật ký (log-audit-resource) ----------
// Không phụ thuộc tên trường thời gian: chụp danh sách bản ghi trước thao tác, so với sau thao tác để lấy bản ghi MỚI.
const keyOf = (x: any) => x?.id ?? JSON.stringify(x);
export async function logPage(n = 3): Promise<{ list: any[]; total: number }> {
  const list: any[] = []; let total = 0;
  for (let p = 1; p <= n; p++) {
    const r = await call('GET', `log-audit-resource?page=${p}&size=100`);
    list.push(...rowsOf(r.data)); total = r.data?.totalElements ?? list.length;
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return { list, total };
}
export async function logSnapshot() { const { list, total } = await logPage(); return { keys: new Set(list.map(keyOf)), total }; }
export async function newLogs(snap: { keys: Set<string> }): Promise<any[]> {
  await new Promise(f => setTimeout(f, 1500));   // ghi nhật ký có thể bất đồng bộ
  return (await logPage()).list.filter(x => !snap.keys.has(keyOf(x)));
}
export const txt = (x: any) => JSON.stringify(x);
export function expectLogs(logs: any[], re: RegExp, what: string, min = 1) {
  expect(logs.length, `Không có bản ghi nhật ký mới nào sau khi ${what} (log-audit-resource không ghi nhận)`).toBeGreaterThan(0);
  const hit = logs.filter(x => re.test(txt(x)));
  expect(hit.length, `Có ${logs.length} bản ghi mới nhưng không bản ghi nào khớp ${re} cho thao tác: ${what}. Mẫu: ${txt(logs[0]).slice(0, 300)}`).toBeGreaterThanOrEqual(min);
  return hit;
}

// ---------- HTTP / TLS ----------
export async function httpRedirect(path: string) {
  const r = await fetch(`http://${HOST}${path}`, { redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location') ?? '' };
}
export function tlsHandshake(o: { minVersion?: tls.SecureVersion; maxVersion?: tls.SecureVersion }): Promise<string> {
  return new Promise(resolve => {
    const s = tls.connect({ host: HOST, servername: HOST, port: 443, ciphers: 'DEFAULT@SECLEVEL=0', rejectUnauthorized: false, ...o }, () => { const v = s.getProtocol() ?? 'ok'; s.end(); resolve(v); });
    s.on('error', () => resolve('FAIL')); s.setTimeout(10_000, () => { s.destroy(); resolve('FAIL'); });
  });
}

// ---------- Bộ kiểm tra chung cho 1 phân hệ ----------
export interface Mod { res: string; perm: string; route?: string; crud?: boolean }
export interface SuiteCfg {
  mods: Mod[];
  /** Tạo dữ liệu QCA hợp lệ: trả {id, code, update(), remove()} — dùng cho N02/N03/N06/W01. */
  make?: () => Promise<{ id: string; code: string; update: () => Promise<Res>; remove: () => Promise<Res> }>;
  /** Body sai cho V01 (POST lên res đầu tiên có crud). */
  invalid?: { res: string; bodies: Record<string, any>; valid?: () => any; cleanup?: (r: Res) => Promise<void> };
  /** Thao tác nghiệp vụ đặc thù cho N03; trả regex khớp bản ghi nhật ký. */
  biz?: () => Promise<{ re: RegExp; what: string; done: () => Promise<void> }>;
  /** XSS lưu trữ (W01): tạo bản ghi có tên payload, trả route + từ khóa tìm + hàm dọn. */
  xss?: (name: string) => Promise<{ route: string; keyword: string; done: () => Promise<void> } | { rejected: string }>;
  /** IDOR (Q04): trả {role, url} — url là API tới bản ghi ngoài phạm vi đơn vị của role; null nếu không dựng được. */
  idor?: () => Promise<{ role: string; url: string } | string>;
  /** Thêm thao tác nhạy cảm cho N06; trả các chuỗi bí mật không được xuất hiện trong nhật ký. */
  sensitive?: () => Promise<string[]>;
}

export function registerModuleSuite(P: string, cfg: SuiteCfg) {
  const list = cfg.mods; const crud = list.filter(m => m.crud !== false);
  const one = async (m: Mod) => rowsOf((await call('GET', `${m.res}?page=1&size=1`)).data)[0];

  test.describe(`ATTT ${P} › Xác thực & phân quyền BE (KT 1.3.1a)`, () => {
    at(`${P}-X01`, async () => {
      const bad: string[] = [];
      for (const m of list) {
        const id = (await one(m))?.id ?? FAKE;
        const l = await call('GET', m.res, { as: null }); if (![401, 403].includes(l.status)) bad.push(`${m.res} → ${l.status}`);
        const d = await call('GET', `${m.res}/${id}`, { as: null }); if (d.status < 300) bad.push(`${m.res}/{id} → ${d.status}`);   // 404 = không có route chi tiết, không phải lộ dữ liệu
      }
      expect(bad, `API trả dữ liệu khi không có token: ${bad.join('; ')}`).toEqual([]);
    });
    at(`${P}-X02`, async () => {
      const bad: string[] = [];
      for (const [k, tok] of Object.entries(forgedTokens())) for (const m of list) { const r = await call('GET', m.res, { token: tok }); if (r.status !== 401) bad.push(`${k}: ${m.res} → ${r.status}`); }
      expect(bad, bad.join('; ')).toEqual([]);
    });
    at(`${P}-X03`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } }); await hidePwExpiry(ctx); const page = await ctx.newPage();
      const bad: string[] = [];
      for (const m of list.filter(x => x.route)) {
        await page.goto(`${API_BASE}/#/vi/${m.route}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
        if (!/(#\/)?vi\/auth\/login/.test(page.url()) ||   // URL mới không còn dấu # (/#/vi/x → /vi/x)
           await page.locator('tbody tr.ant-table-row').count()) bad.push(`${m.route} → ${page.url()}`);
      }
      await ctx.close();
      expect(bad, `Màn không chuyển về đăng nhập: ${bad.join('; ')}`).toEqual([]);
    });
    at(`${P}-Q01`, async () => {
      const bad: string[] = []; let n = 0;
      for (const role of await liveRoles()) {
        const pm = await perms(role);
        for (const m of list) if (!pm.has(`${m.perm}.VIEW`)) { n++; const r = await call('GET', m.res, { as: role }); if (![401, 403].includes(r.status)) bad.push(`${role} không có ${m.perm}.VIEW nhưng GET ${m.res} → ${r.status}`); }
      }
      test.skip(!n, 'Mọi tài khoản QC đều có quyền Xem các API của phân hệ → không có trường hợp kiểm tra');
      expect(bad, bad.join('; ')).toEqual([]);
    });
    at(`${P}-Q02`, async () => {
      const bad: string[] = []; let n = 0;
      for (const role of await liveRoles()) {
        const pm = await perms(role);
        for (const m of crud) {
          if (!pm.has(`${m.perm}.CREATE`)) { n++; const r = await call('POST', m.res, { as: role, body: {} }); if (r.status !== 403) bad.push(`${role} POST ${m.res} → ${r.status}`); }
          if (!pm.has(`${m.perm}.UPDATE`)) { n++; const r = await call('PUT', `${m.res}/${FAKE}`, { as: role, body: {} }); if (r.status !== 403) bad.push(`${role} PUT ${m.res}/{id} → ${r.status}`); }
          if (!pm.has(`${m.perm}.DELETE`)) { n++; const r = await call('DELETE', `${m.res}/${FAKE}`, { as: role }); if (r.status !== 403) bad.push(`${role} DELETE ${m.res}/{id} → ${r.status}`); }
        }
      }
      test.skip(!n, 'Không có trường hợp kiểm tra: phân hệ không có API thêm/sửa/xóa trực tiếp hoặc mọi tài khoản QC đều có quyền ghi');
      expect(bad, `Kiểm tra quyền phải chạy trước kiểm tra dữ liệu (403, không 400/404): ${bad.join('; ')}`).toEqual([]);
    });
    at(`${P}-Q03`, async ({ browser }) => {
      let pair: { role: string; m: Mod } | null = null;
      for (const role of await liveRoles()) { const pm = await perms(role); const m = list.find(x => x.route && !pm.has(`${x.perm}.VIEW`)); if (m) { pair = { role, m }; break; } }
      test.skip(!pair, 'Không có tài khoản QC nào thiếu quyền Xem màn của phân hệ');
      const ctx = await browser.newContext({ storageState: `auth/${pair!.role}.json` }); await hidePwExpiry(ctx); const page = await ctx.newPage();
      const denied: number[] = []; page.on('response', r => { if (r.url().includes(`/api/v1/${pair!.m.res}`)) denied.push(r.status()); });
      await page.goto(`${API_BASE}/#/vi/${pair!.m.route}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
      const rows = await page.locator('tbody tr.ant-table-row').count();
      await ctx.close();
      expect(rows, `${pair!.role} mở trực tiếp #/vi/${pair!.m.route} vẫn thấy ${rows} dòng dữ liệu`).toBe(0);
      expect(denied.filter(s => s < 300), `API ${pair!.m.res} trả 2xx cho ${pair!.role}`).toEqual([]);
    });
    at(`${P}-Q04`, async () => {
      const x = await cfg.idor!();
      test.skip(typeof x === 'string', String(x));
      const { role, url } = x as { role: string; url: string };
      const r = await call('GET', url, { as: role });
      expect([403, 404], `${role} GET ${url} (bản ghi ngoài phạm vi đơn vị) → ${r.status}`).toContain(r.status);
    });
  });

  test.describe(`ATTT ${P} › Kiểm tra đầu vào & lỗi (KT 1.3.4, KT 1.3.3a-3, PM 3)`, () => {
    at(`${P}-V01`, async () => {
      const iv = cfg.invalid!;
      if (iv.valid) { const ok = await call('POST', iv.res, { body: iv.valid() }); await iv.cleanup?.(ok); test.skip(ok.status >= 300, `Body hợp lệ cũng bị từ chối (${ok.status} "${ok.message}") → không phân biệt được validate`); }
      const bad: string[] = [];
      for (const [k, body] of Object.entries(iv.bodies)) {
        const r = await call('POST', iv.res, { body });
        if (r.status < 300) { bad.push(`${k} → ${r.status} (đã lưu)`); await iv.cleanup?.(r); }
        else if (r.status >= 500) bad.push(`${k} → ${r.status}`);
      }
      expect(bad, `BE không từ chối dữ liệu sai: ${bad.join('; ')}`).toEqual([]);
    });
    at(`${P}-V02`, async () => {
      const bad: string[] = [];
      for (const m of list) {
        const base = await call('GET', `${m.res}?page=1&size=20`);
        const n0 = base.data?.totalElements ?? rowsOf(base.data).length;
        const qs: Record<string, string> = {
          sqli: `keyword=${encodeURIComponent("' OR 1=1 --")}&filter=${encodeURIComponent(JSON.stringify({ keyword: "' OR 1=1 --" }))}`,
          xss: `keyword=${encodeURIComponent('<script>alert(1)</script>')}`,
          'filter hỏng': `filter=${encodeURIComponent('{bad')}`, 'page âm': 'page=-1&size=20', 'size lớn': 'page=1&size=100000',
        };
        for (const [k, q] of Object.entries(qs)) {
          const r = await call('GET', `${m.res}?${q}`);
          if (r.status >= 500) bad.push(`${m.res} ${k} → ${r.status}`);
          if (k === 'sqli' && r.status < 300 && (r.data?.totalElements ?? 0) > n0) bad.push(`${m.res} SQLi trả nhiều bản ghi hơn bình thường`);
        }
        const g = await call('GET', `${m.res}/not-a-guid`); if (g.status >= 500 || g.status < 300) bad.push(`${m.res}/not-a-guid → ${g.status}`);
      }
      expect(bad, bad.join('; ')).toEqual([]);
    });
    at(`${P}-V03`, async () => {
      const bad: string[] = [];
      for (const m of crud) for (const [k, o] of Object.entries({ 'JSON hỏng': { raw: '{bad json' }, 'text/plain': { raw: 'name=qca', ctype: 'text/plain' } })) {
        const r = await call('POST', m.res, o as any);
        if (![400, 415].includes(r.status)) bad.push(`${m.res} ${k} → ${r.status}`);
        if (LEAK.test(r.text)) bad.push(`${m.res} ${k} lộ chi tiết: ${r.text.slice(0, 120)}`);
      }
      expect(bad, bad.join('; ')).toEqual([]);
    });
    at(`${P}-W01`, async ({ browser }) => {
      const name = `qc.automation <img src=x onerror="window.__xss=1">`;
      const x0 = await cfg.xss!(name);
      if ('rejected' in x0) { test.info().annotations.push({ type: 'Đạt', description: `BE chặn nhập HTML/script: ${x0.rejected}` }); return; }
      const x = x0;
      const ctx = await browser.newContext({ storageState: `auth/${ADMIN}.json` }); await hidePwExpiry(ctx); const page = await ctx.newPage();
      try {
        await page.goto(`${API_BASE}/#/vi/${x.route}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
        const box = page.locator('input[placeholder*="Tìm"], input[placeholder*="tìm"]').first();
        if (await box.count()) { await box.fill(x.keyword); await box.press('Enter'); await page.waitForTimeout(1500); }
        expect(await page.evaluate(() => (window as any).__xss), 'script trong dữ liệu đã được thực thi (XSS)').toBeUndefined();
        expect(await page.locator('tbody img[src="x"]').count(), 'thẻ <img> trong dữ liệu được render thành phần tử thật').toBe(0);
      } finally { await ctx.close(); await x.done(); }
    });
    at(`${P}-L01`, async () => {
      const bad: string[] = [];
      for (const m of list) for (const [u, meth, body] of [[`${m.res}/not-a-guid`, 'GET'], [`${m.res}?filter=%7Bbad&page=abc&size=-5`, 'GET'], [m.res, 'POST', {}], [`${m.res}/${FAKE}`, 'PUT', { id: 'x' }]] as [string, string, any?][]) {
        if (meth !== 'GET' && m.crud === false) continue;
        const r = await call(meth, u, { body });
        if (LEAK.test(r.text)) bad.push(`${meth} ${u} → ${r.status}: ${r.text.match(LEAK)?.[0]} … ${r.text.slice(0, 150)}`);
      }
      expect(bad, `Phản hồi lỗi lộ thông tin nội bộ: ${bad.join(' || ')}`).toEqual([]);
    });
    at(`${P}-S01`, async () => {
      const bad: string[] = [];
      for (const m of list) {
        const l = await call('GET', `${m.res}?page=1&size=20`); bad.push(...sensitiveKeys(l.data).map(k => `${m.res}: ${k}`));
        const id = rowsOf(l.data)[0]?.id; if (id) { const d = await call('GET', `${m.res}/${id}`); bad.push(...sensitiveKeys(d.data).map(k => `${m.res}/{id}: ${k}`)); }
      }
      expect([...new Set(bad)], 'Phản hồi chứa trường nhạy cảm có giá trị').toEqual([]);
    });
    at(`${P}-H01`, async () => {
      const bad: string[] = [];
      for (const m of list) { const r = await httpRedirect(`/api/v1/${m.res}`); if (![301, 308].includes(r.status) || !r.location.startsWith('https://')) bad.push(`${m.res} → ${r.status} ${r.location}`); }
      expect(bad, bad.join('; ')).toEqual([]);
    });
  });

  test.describe(`ATTT ${P} › Nhật ký (KT 1.3.3a, NK)`, () => {
    at(`${P}-N01`, async () => {
      const snap = await logSnapshot();
      for (const m of list) { const id = (await one(m))?.id; await call('GET', `${m.res}?page=1&size=10`); if (id) await call('GET', `${m.res}/${id}`); }
      const logs = await newLogs(snap);
      expectLogs(logs, new RegExp(list.map(m => m.perm.replace(/_/g, '[_ ]?') + '|' + m.res.split('/').pop()).join('|'), 'i'), `xem danh sách/chi tiết ${list.map(m => m.res).join(', ')}`);
    });
    at(`${P}-N02`, async () => {
      const snap = await logSnapshot();
      const x = await cfg.make!(); await x.update(); await x.remove();
      const hit = expectLogs(await newLogs(snap), new RegExp(`${x.code}|${x.id}`, 'i'), `thêm/sửa/xóa bản ghi ${x.code}`, 3);
      expect(hit.some(h => /old|new|before|after|cu|moi|truoc|sau/i.test(Object.keys(h).join(' '))), 'Bản ghi Cập nhật không có giá trị trước → sau').toBe(true);
    });
    at(`${P}-N03`, async () => {
      const snap = await logSnapshot();
      const b = await cfg.biz!();
      try { expectLogs(await newLogs(snap), b.re, b.what, 2); } finally { await b.done(); }
    });
    at(`${P}-N05`, async () => {
      let role = ''; let m: Mod | undefined;
      for (const r of await liveRoles()) { const pm = await perms(r); m = crud.find(x => !pm.has(`${x.perm}.CREATE`)); if (m) { role = r; break; } }
      test.skip(!m, 'Không có trường hợp kiểm tra: phân hệ không có API thêm trực tiếp hoặc mọi tài khoản QC đều có quyền Thêm');
      const snap = await logSnapshot(); const az = await authzSnapshot();
      const r = await call('POST', m!.res, { as: role, body: {} });
      const me = await myInfo(role); const user = me.userName ?? role;
      // Hệ thống ghi lần bị từ chối vào authorization/audits (decision = DENY) — vẫn chấp nhận nếu log-audit-resource có bản ghi Thất bại của tài khoản đó
      const deny = (await newAuthz(az)).filter(x => x.userId === me.id && x.decision === 'DENY');
      const fail = (await newLogs(snap)).filter(x => new RegExp(user, 'i').test(txt(x)) && (x.status === 2 || /fail|thất bại|denied|forbidden|403/i.test(txt(x))));
      expect(deny.length + fail.length, `${role} POST ${m!.res} bị từ chối (${r.status}) nhưng không có bản ghi Thất bại nào trong authorization/audits hay log-audit-resource`).toBeGreaterThan(0);
      if (deny.length) {
        test.info().annotations.push({ type: 'Bằng chứng', description: `authorization/audits: ${txt(deny[0]).slice(0, 300)}` });
        expect(deny[0].ipAddress, 'Bản ghi từ chối không có địa chỉ IP').toBeTruthy();
      }
    });
    at(`${P}-N06`, async () => {
      const snap = await logSnapshot();
      const secrets = [tokenOf(ADMIN).split('.')[2], ...(await cfg.sensitive?.() ?? [])];
      if (cfg.make) { const x = await cfg.make(); await x.update(); await x.remove(); }
      const logs = await newLogs(snap);
      test.skip(!logs.length, 'Chưa có bản ghi nhật ký mới để kiểm tra (xem testcase ghi nhật ký N01/N02)');
      const leak = logs.filter(l => secrets.some(s => s && txt(l).includes(s)) || /Bearer\s+ey/i.test(txt(l)));
      expect(leak.map(l => txt(l).slice(0, 200)), 'Nhật ký chứa mật khẩu/token/nội dung tệp').toEqual([]);
    });
  });
}

/** Dọn bản ghi theo id nếu request tạo lỡ thành công. */
export const cleanupCreated = (res: string) => async (r: Res) => { const id = r.data?.id ?? r.data; if (r.status < 300 && typeof id === 'string') await apiDelete(res, id); };
