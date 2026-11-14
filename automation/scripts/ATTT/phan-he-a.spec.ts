// ATTT cấp độ 2 — PHÂN HỆ A (Quản trị hệ thống). Testcase ATA-* (testcases/docs/catalog-ATTT.mjs, sheet "ATTT mức 2").
// Bộ chung X/Q/V/W/L/S/N/H sinh bởi registerModuleSuite; phần riêng: tham số hệ thống, nhật ký truy cập, sao lưu, IP, thông tin người dùng.
import { Made, ensureOrg, ensureRole, ensureUser, findApi, code8 } from '../A/common';
import cfg from '../../accounts.mjs';
import { test, expect, at, call, rowsOf, perms, myInfo, liveRoles, FAKE, LEAK, sensitiveKeys, logSnapshot, newLogs, expectLogs, logPage, registerModuleSuite, cleanupCreated, API_BASE, txt, authzSnapshot, newAuthz, isPrivateIp } from '../attt';
import { Page } from '@playwright/test';
import { Locator } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test as __g_test } from '../A/common';
import { expect as __g_expect } from '../A/common';
import { tc } from '../A/common';
import { PAGES } from '../A/common';
import { dataRows } from '../A/common';
import { openList } from '../A/common';
import { searchFor } from '../A/common';
import { findRow } from '../A/common';
import { dlg } from '../A/common';
import { btnCancel } from '../A/common';
import { btnSave } from '../A/common';
import { toast } from '../A/common';
import { rowAction } from '../A/common';
import { rowMenuItems } from '../A/common';
import { waitList } from '../A/common';
import { cellText } from '../A/common';
import { api } from '../A/common';
import { userBody } from '../A/common';
import { pickByLabel } from '../A/common';
import { FILTERS } from '../A/common';
import { tokenOf } from '../A/common';
import { fold } from '../A/common';
import { API_BASE as __g_API_BASE } from '../api';
import { guardSession } from '../session-guard';

const UT = 'unit-types';
// Mã loại đơn vị do hệ thống tự sinh (LDV-nnn, API bỏ qua `code` client gửi) → body không gửi code, lấy mã thật từ response.
const utBody = (o: any = {}) => ({ name: `qc.automation ATTT ${Date.now().toString(36)}${code8().slice(3)}`, adminLevel: 2, ...o });
async function makeUnitType(o: any = {}) {
  const body = utBody(o); const r = await call('POST', UT, { body });
  if (r.status >= 300) throw new Error(`tạo loại đơn vị lỗi ${r.status} ${r.message}`);
  const id = r.data?.id as string;
  const code = String(r.data?.code ?? (await call('GET', `${UT}/${id}`)).data?.code ?? id);
  return {
    id, code,
    update: async () => { const cur = (await call('GET', `${UT}/${id}`)).data ?? body; return call('PUT', `${UT}/${id}`, { body: { ...cur, name: `${body.name} sửa` } }); },
    remove: () => call('DELETE', `${UT}/${id}`),
  };
}

registerModuleSuite('ATA', {
  mods: [
    { res: 'idm/users', perm: 'USER', route: 'users' }, { res: 'idm/roles', perm: 'ROLE', route: 'roles' },
    { res: 'provinces', perm: 'PROVINCE', route: 'provinces' }, { res: 'communes', perm: 'COMMUNE', route: 'communes' },
    { res: UT, perm: 'UNIT_TYPE', route: 'unit-types' }, { res: 'organizations', perm: 'ORGANIZATION', route: 'organizations' },
    { res: 'idm/permission-matrix/roles', perm: 'ROLE_PERMISSION', route: 'permission-matrix', crud: false },
    { res: 'system/params', perm: 'SYSTEM_PARAMETER', route: 'system-config', crud: false },
    { res: 'system/backups', perm: 'BACKUP', route: 'backup', crud: false },
    { res: 'log-audit-resource', perm: 'LOG_AUDIT_RESOURCE', route: 'audit-log', crud: false },
  ],
  make: () => makeUnitType(),
  invalid: {
    res: UT, valid: () => utBody(), cleanup: cleanupCreated(UT),
    // Mã do hệ thống tự sinh (không còn nhập) → kiểm tra các trường người dùng còn nhập: Tên (≤ 255, bắt buộc), Cấp hành chính (số, miền hợp lệ), Mô tả (≤ 1.000)
    bodies: { 'tên 5.000 ký tự': utBody({ name: 'x'.repeat(5000) }), 'adminLevel là chuỗi': utBody({ adminLevel: 'abc' }), 'tên = null': utBody({ name: null }), 'tên chỉ có khoảng trắng': utBody({ name: '   ' }), 'adminLevel ngoài miền (99)': utBody({ adminLevel: 99 }), 'mô tả 1.001 ký tự': utBody({ description: 'd'.repeat(1001) }) },
  },
  biz: async () => {
    const made = new Made(); const o = await ensureOrg(made, {}, true);
    await call('PUT', `organizations/${o.id}/unlock`, { body: {} });
    return { re: new RegExp(`${o.code}|${o.id}`, 'i'), what: `khóa/mở khóa đơn vị ${o.code}`, done: () => made.clean() };
  },
  xss: async name => {
    const body = utBody({ name }); const r = await call('POST', UT, { body });
    if (r.status >= 400 && r.status < 500) return { rejected: `${r.status} ${r.message}` };
    return { route: 'unit-types', keyword: String(r.data?.code ?? body.name), done: async () => { if (r.data?.id) await call('DELETE', `${UT}/${r.data.id}`); } };
  },
  idor: async () => {
    for (const role of await liveRoles()) {
      const pm = await perms(role); const me = await myInfo(role);
      for (const [perm, res, field] of [['USER.VIEW', 'idm/users', 'organizationId'], ['ORGANIZATION.VIEW', 'organizations', 'id']] as const) {
        if (!['unit', 'unitAndChildren'].includes(pm.get(perm) ?? '')) continue;
        const other = rowsOf((await call('GET', `${res}?page=1&size=100`)).data).find((x: any) => x[field] && x[field] !== me.organizationId);
        if (other) return { role, url: `${res}/${other.id}` };
      }
    }
    return 'Không có tài khoản QC nào có quyền Xem người dùng/đơn vị theo phạm vi đơn vị (đều "all" hoặc không có quyền)';
  },
  sensitive: async () => { const made = new Made(); await ensureUser(made); await made.clean(); return [cfg.password]; },
});

// ===================== Thông tin người dùng =====================
test.describe('ATTT ATA › Dữ liệu nhạy cảm người dùng', () => {
  at('ATA-S02', async () => {
    const bad: string[] = [];
    const info = await call('GET', 'idm/users/info', { as: 'canbo' }); bad.push(...sensitiveKeys(info.data).map(k => `users/info: ${k}`));
    const list = await call('GET', 'idm/users?page=1&size=50'); bad.push(...sensitiveKeys(list.data).map(k => `users: ${k}`));
    const id = rowsOf(list.data)[0]?.id; if (id) bad.push(...sensitiveKeys((await call('GET', `idm/users/${id}`)).data).map(k => `users/{id}: ${k}`));
    expect([...new Set(bad)]).toEqual([]);
  });
});

// ===================== Tham số hệ thống (A.III.2) =====================
const params = async () => Object.fromEntries((((await call('GET', 'system/params')).data ?? []) as any[]).map(p => [p.key ?? p.code, p.value]));
// system/configurations không còn tồn tại (404) — nguồn cấu hình duy nhất là system/params
const configs = async (): Promise<Record<string, any>> => ({});
const hasCode = (o: Record<string, any>, re: RegExp, not?: RegExp) => Object.keys(o).filter(k => re.test(k) && !(not && not.test(k)));
test.describe('ATTT ATA › Tham số hệ thống', () => {
  at('ATA-C01', async () => {
    const p = await params(); const miss: string[] = [];
    if (!(Number(p.PASSWORD_MIN_LENGTH) > 0)) miss.push('PASSWORD_MIN_LENGTH');
    if (!('PASSWORD_REQUIRE_MIXED_CASE' in p) && !('PASSWORD_REQUIRE_UPPER_LOWER' in p) && !(hasCode(p, /UPPER/).length && hasCode(p, /LOWER/).length)) miss.push('chữ hoa / chữ thường');
    for (const k of ['PASSWORD_REQUIRE_NUMBER', 'PASSWORD_REQUIRE_SPECIAL_CHAR']) if (!(k in p)) miss.push(k);
    expect(miss, 'Thiếu tham số chính sách mật khẩu').toEqual([]);
  });
  at('ATA-C02', async () => {
    // Màn "Hiệu lực & đổi mật khẩu": "Yêu cầu đổi mật khẩu trước khi hết hạn" (PASSWORD_EXPIRY_WARN_DAYS) = thời gian yêu cầu thay đổi mật khẩu theo QĐ 742 mục 1.3 c)
    const p = await params();
    expect(Number(p.PASSWORD_EXPIRY_WARN_DAYS), 'PASSWORD_EXPIRY_WARN_DAYS (Yêu cầu đổi mật khẩu trước khi hết hạn)').toBeGreaterThan(0);
  });
  at('ATA-C05', async () => { expect(Number((await params()).SESSION_TIMEOUT_MINUTES), 'SESSION_TIMEOUT_MINUTES').toBeGreaterThan(0); });
  at('ATA-C06', async () => {
    const p = { ...(await params()), ...(await configs()) };
    expect(hasCode(p, /IP|CIDR|WHITELIST|ALLOWLIST|ALLOWED_NETWORK/), 'Chưa có cấu hình danh sách IP/CIDR được phép quản trị').not.toEqual([]);
  });
  at('ATA-C08', async () => {
    const a = await call('GET', 'system/params', { as: null });
    expect([401, 403], `Không token GET system/params → ${a.status} (lộ cấu hình bảo mật)`).toContain(a.status);
    const role = (await Promise.all((await liveRoles()).map(async r => [r, (await perms(r)).has('SYSTEM_PARAMETER.VIEW')] as const))).find(([, v]) => !v)?.[0];
    if (role) { const b = await call('GET', 'system/params', { as: role }); expect([401, 403], `${role} không có quyền SYSTEM_PARAMETER.VIEW → ${b.status}`).toContain(b.status); }
  });
  at('ATA-C09', async () => {
    const p = await params(); const c = await configs();
    const diff = Object.keys(c).filter(k => k in p && String(p[k]) !== String(c[k])).map(k => `${k}: parameters=${p[k]} ≠ configurations=${c[k]}`);
    expect(diff, 'Hai nguồn cấu hình mâu thuẫn').toEqual([]);
  });
});

// ===================== Nhật ký truy cập (A.III.3) =====================
test.describe('ATTT ATA › Nhật ký truy cập', () => {
  at('ATA-N08', async () => {
    const made = new Made();
    try {
      const r = await ensureRole(made); const role = ((await call('GET', 'idm/permission-matrix/roles')).data as any[]).find(x => x.name === r.name);
      const snap = await logSnapshot();
      await call('PUT', `idm/permission-matrix/roles/${role.id}`, { body: { permissions: [{ code: 'USER.VIEW', scope: 'all' }] } });
      await call('PUT', `idm/permission-matrix/roles/${role.id}`, { body: { permissions: [] } });
      expectLogs(await newLogs(snap), new RegExp(`${r.code}|${role.id}|USER\\.VIEW`, 'i'), `gán/gỡ quyền USER.VIEW cho nhóm ${r.code}`, 2);
    } finally { await made.clean(); }
  });
  at('ATA-I03', async () => {
    // log-audit-resource không có trường IP; IP được ghi ở authorization/audits (mỗi quyết định phân quyền) → tra bản ghi theo id loại đơn vị vừa xóa
    const snap = await logSnapshot(); const az = await authzSnapshot();
    const XFF = { 'X-Forwarded-For': '10.6.6.6', 'X-Real-IP': '10.6.6.6' };
    const r = await call('POST', UT, { body: utBody(), headers: XFF }); const id = r.data?.id;
    expect(r.status, `tạo loại đơn vị: ${r.message}`).toBeLessThan(300);
    await call('DELETE', `${UT}/${id}`, { headers: XFF });
    expectLogs(await newLogs(snap), new RegExp(id, 'i'), `thêm/xóa loại đơn vị ${r.data?.code} kèm X-Forwarded-For giả`);
    const hit = (await newAuthz(az)).filter(x => x.resourceId === id);   // bản ghi DELETE mang resourceId = id
    expect(hit.length, `authorization/audits không có bản ghi cho thao tác trên loại đơn vị ${id}`).toBeGreaterThan(0);
    const ips = [...new Set(hit.map(h => String(h.ipAddress ?? '')))];
    test.info().annotations.push({ type: 'Bằng chứng', description: `IP ghi nhận: ${ips.join(', ')}` });
    expect(ips.filter(ip => !ip), 'Bản ghi không có địa chỉ IP').toEqual([]);
    expect(ips.filter(ip => ip.includes('10.6.6.6')), 'Nhật ký ghi IP giả mạo do client tự gửi (X-Forwarded-For)').toEqual([]);
    expect(ips.filter(isPrivateIp), 'Nhật ký ghi IP nội bộ (reverse proxy) thay vì IP thật').toEqual([]);
  });
  at('ATA-N09', async () => {
    const before = (await logPage(1)).total;
    const x = await makeUnitType(); await x.remove(); await new Promise(f => setTimeout(f, 1500));
    const after = (await logPage(1)).total;
    expect(after, `Tổng bản ghi nhật ký trước ${before}, sau ${after} — hệ thống không ghi nhật ký thao tác`).toBeGreaterThan(before);
  });
  const openLog = async (page: any) => { await page.goto(`${API_BASE}/#/vi/audit-log`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); };
  /** Màn thật: ô tìm kiếm + nút "Bộ lọc" mở ngăn kéo "Bộ lọc nâng cao" (Sự kiện, Đơn vị, Kết quả, Khoảng thời gian). */
  const openFilter = async (page: any) => { await page.getByRole('button', { name: /Bộ lọc/ }).click(); await page.waitForTimeout(800); return page.locator('.ant-drawer-content, .ant-drawer').first().innerText(); };
  at('ATA-N12', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'auth/admin.json' }); const page = await ctx.newPage();
    try {
      await openLog(page);
      const miss: string[] = [];
      const ph = (await page.locator('input[placeholder*="Tìm"], input[placeholder*="tìm"]').first().getAttribute('placeholder').catch(() => '')) ?? '';
      if (!ph) miss.push('ô từ khóa');
      for (const [k, re] of [['tìm theo người dùng', /người dùng|tên đăng nhập/i], ['tìm theo IP', /\bIP\b/i]] as const) if (!re.test(ph)) miss.push(k);
      const d = await openFilter(page);
      if (!await page.locator('.ant-drawer input[placeholder*="Từ ngày"]').count()) miss.push('lọc Từ ngày – Đến ngày');
      for (const [k, re] of [['lọc sự kiện/hành động', /sự kiện|hành động/i], ['lọc kết quả', /kết quả/i]] as const) if (!re.test(d)) miss.push(k);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      const t = await page.locator('body').innerText();
      if (await page.locator('tbody tr.ant-table-row').count() && !/hiển thị|tổng|bản ghi/i.test(t)) miss.push('phân trang / tổng số bản ghi');
      expect(miss, 'Màn Nhật ký thiếu chức năng tra cứu').toEqual([]);
    } finally { await ctx.close(); }
  });
  at('ATA-N15', async () => {
    const id = (await logPage(1)).list[0]?.id ?? FAKE;
    const bad: string[] = [];
    for (const [m, u, b] of [['PUT', `log-audit-resource/${id}`, { description: 'qca' }], ['PATCH', `log-audit-resource/${id}`, { description: 'qca' }], ['DELETE', `log-audit-resource/${id}`], ['POST', 'log-audit-resource', { action: 'qca', description: 'giả' }]] as [string, string, any?][]) {
      const r = await call(m, u, { body: b }); if (![403, 404, 405].includes(r.status)) bad.push(`${m} ${u} → ${r.status}`);
    }
    expect(bad, 'Nhật ký sửa/xóa/chèn được qua API').toEqual([]);
  });
  at('ATA-N20', async () => {
    const bad: string[] = [];
    for (const role of await liveRoles()) { const r = await call('GET', 'log-audit-resource', { as: role }); if (![401, 403].includes(r.status)) bad.push(`${role} → ${r.status}`); }
    const pm = await perms('admin');
    for (const c of ['LOG_AUDIT_RESOURCE.VIEW', 'LOG_AUDIT_RESOURCE.EXPORT']) if (!pm.has(c)) bad.push(`thiếu mã quyền ${c}`);
    expect(bad).toEqual([]);
  });
});

// ===================== Sao lưu (A.III.1) =====================
test.describe('ATTT ATA › Sao lưu', () => {
  const backups = async () => rowsOf((await call('GET', 'system/backups?page=1&size=20')).data);
  at('ATA-D01', async () => {
    const b = await backups();
    expect(b.length, 'Chưa có bản sao lưu nào').toBeGreaterThan(0);
    const last = b[0];
    expect(last.status, `Bản sao lưu mới nhất (${last.startedDate}) lỗi: ${last.errorMessage ?? ''}`).toMatch(/success|thành công|completed/i);
    expect(Number(last.fileSizeBytes), 'Bản sao lưu không có dung lượng').toBeGreaterThan(0);
  });
  at('ATA-D06', async () => {
    const bad: string[] = [];
    for (const role of await liveRoles()) {
      const pm = await perms(role);
      if (!pm.has('BACKUP.VIEW')) { const r = await call('GET', 'system/backups', { as: role }); if (![401, 403].includes(r.status)) bad.push(`${role} GET → ${r.status}`); }
      if (!pm.has('BACKUP.DELETE')) { const r = await call('DELETE', `system/backups/${FAKE}`, { as: role }); if (r.status < 300) bad.push(`${role} DELETE → ${r.status}`); }
    }
    expect(bad).toEqual([]);
  });
});

// ===== Case bổ sung từ bug GitLab (gộp từ phan-he-a-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
test.describe(() => {
const test = __g_test;
const expect = __g_expect;
const API_BASE = __g_API_BASE;
const ADM = 'admin';
const A = (m: string, r: string, b?: any, as = ADM) => api(m, r, b, as);
const rowsOf = (d: any): any[] => d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
const B = API_BASE;
const ROUTE: Record<string, string> = { PRV: 'provinces', COM: 'communes', UTY: 'unit-types', ORG: 'organizations' };
const P4 = ['PRV', 'COM', 'UTY', 'ORG'] as const;
const ADD_BTN: Record<string, RegExp> = { PRV: /thêm (mới )?tỉnh/i, COM: /thêm (mới )?xã/i, UTY: /thêm (mới )?loại đơn vị/i, ORG: /thêm (mới )?đơn vị/i };
const PH_NAME: Record<string, RegExp> = { PRV: /nhập tên tỉnh/i, COM: /nhập tên xã/i, UTY: /vd: Cấp Sở|nhập tên loại/i, ORG: /nhập tên đơn vị/i };
const ADMIN_NAME = () => JSON.parse(Buffer.from(tokenOf(ADM).split('.')[1], 'base64url').toString())['x-fullName'] as string;

// ---------------------------------------------------------------- dữ liệu thử (token admin) + dọn
async function findByTag(res: string, tag: string): Promise<any[]> {
  const hit = (x: any) => [x.name, x.userName, x.code].some((v: any) => String(v ?? '').includes(tag));
  const q = await A('GET', `${res}?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ keyword: tag, fullTextSearch: tag }))}`);
  const first = rowsOf(q.data).filter(hit); if (first.length) return first;
  const out: any[] = [];
  for (let p = 1; p <= 6; p++) { const r = await A('GET', `${res}?page=${p}&size=100`); out.push(...rowsOf(r.data).filter(hit)); if (p >= (r.data?.totalPages ?? 1)) break; }
  return out;
}
class Track {
  private items: { res: string; key: string; byTag: boolean }[] = [];
  id(res: string, id: string) { if (id) this.items.push({ res, key: id, byTag: false }); return id; }
  tag(res: string, tag: string) { this.items.push({ res, key: tag, byTag: true }); return tag; }
  async clean() {
    // thứ tự dọn: người dùng → đơn vị → xã → loại → tỉnh (con trước cha)
    const order = ['idm/users', 'organizations', 'communes', 'unit-types', 'provinces'];
    const its = this.items.reverse().sort((a, b) => order.indexOf(a.res) - order.indexOf(b.res)); this.items = [];
    for (const it of its) {
      try {
        const xs = it.byTag ? await findByTag(it.res, it.key) : [{ id: it.key }];
        for (const x of xs) {
          if (it.res === 'idm/users') {
            const u = (await A('GET', `idm/users/${x.id}`)).data;
            // người dùng bị xóa mềm vẫn chặn xóa đơn vị → gỡ khỏi đơn vị trước khi xóa
            if (u?.organizationId) await A('POST', `organizations/${u.organizationId}/users/remove`, { userIds: [x.id] });
          }
          if (it.res === 'organizations') { const o = (await A('GET', `organizations/${x.id}`)).data; if (o?.isLocked) await A('PUT', `organizations/${x.id}/unlock`, {}); }
          await A('DELETE', `${it.res}/${x.id}`);
        }
      } catch { /* bỏ qua */ }
    }
  }
}
const made = new Track();
test.afterEach(async () => { await made.clean(); });

const nm = (kind: string, tag = code8()) => ({ tag, name: `qc.automation ${kind} ${tag}` });
async function mkProvince() { const { tag, name } = nm('Tỉnh'); const r = await A('POST', 'provinces', { name }); if (r.status !== 200) throw new Error('Tạo tỉnh lỗi: ' + r.message); made.id('provinces', r.data.id); return { ...r.data, name, tag }; }
async function mkCommune(provinceId: string) { const { tag, name } = nm('Xã'); const r = await A('POST', 'communes', { name, provinceId }); if (r.status !== 200) throw new Error('Tạo xã lỗi: ' + r.message); made.id('communes', r.data.id); return { ...r.data, name, tag }; }
async function mkType(adminLevel = 2, extra: any = {}) { const { tag, name } = nm('Loại'); const r = await A('POST', 'unit-types', { name, adminLevel, ...extra }); if (r.status !== 200) throw new Error('Tạo loại lỗi: ' + r.message); made.id('unit-types', r.data.id); return { ...r.data, name, tag }; }
async function mkOrg(extra: any = {}, lock = false) {
  const unitTypeId = extra.unitTypeId ?? (await mkType(2)).id;
  const { tag, name } = nm('ĐV'); const r = await A('POST', 'organizations', { name, ...extra, unitTypeId });
  if (r.status !== 200) throw new Error('Tạo đơn vị lỗi: ' + r.message); made.id('organizations', r.data.id);
  if (lock) { const l = await A('PUT', `organizations/${r.data.id}/lock`, {}); if (l.status !== 200) throw new Error('Khóa lỗi ' + l.message); }
  return { ...r.data, name, tag };
}
async function mkUser(organizationId: string | null) {
  const u = code8().toLowerCase(); made.tag('idm/users', u);
  const r = await A('POST', 'idm/users', userBody(u, { organizationId }));
  if (r.status !== 200) throw new Error('Tạo user lỗi: ' + r.message);
  const rec = (await findByTag('idm/users', u)).find(x => x.userName === u);
  return { userName: u, id: rec?.id as string };
}
/** Loại đơn vị chuẩn trong 200 loại đầu (ô chọn Loại đơn vị của form Đơn vị chỉ nạp 200 loại đầu theo mã). */
async function stdType(level: number) {
  const xs = rowsOf((await A('GET', 'unit-types?page=1&size=200&sort=%2Bcode')).data);
  const t = xs.find(x => x.adminLevel === level && !/qc\.automation|qc_/i.test(x.name) && xs.filter(y => y.name === x.name).length === 1 && x.name.length > 4);
  if (!t) throw new Error(`Không có loại đơn vị cấp ${level} trong 200 loại đầu`);
  return t as { id: string; name: string; code: string };
}

// ---------------------------------------------------------------- UI tiện ích
const content = (page: Page) => page.locator('.ant-layout-content').first();
const pageText = async (page: Page) => (await content(page).innerText()).replace(/\s+/g, ' ');
async function openAddP(page: Page, P: string) {
  await openList(page, PAGES[P]);
  await page.locator('.ant-layout-content button', { hasText: ADD_BTN[P] }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return d;
}
async function openEditP(page: Page, P: string, code: string) {
  await openList(page, PAGES[P]);
  await rowAction(page, await findRow(page, PAGES[P], code), /cập nhật/i);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return d;
}
async function openDetailId(page: Page, P: string, id: string) {
  await page.goto(`${B}/vi/${ROUTE[P]}/${id}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
}
const crumbs = (page: Page) => page.locator('header .text-ink-breadcrumb > span');
const dlgTitle = (d: Locator) => d.locator('h3').first();
const CONFIRM = '.ant-modal-confirm, .ant-popconfirm, .ant-modal-wrap:not([style*="display: none"]) .ant-modal';
const confirmBox = (page: Page) => page.locator(CONFIRM).filter({ visible: true }).last();
const css = (l: Locator, props: string[]) => l.evaluate((e, ps) => { const s = getComputedStyle(e); return Object.fromEntries(ps.map(p => [p, s.getPropertyValue(p)])); }, props);
const primaryBg = async (page: Page) => (await css(page.locator('.ant-layout-content button', { hasText: /^\s*Thêm/ }).first(), ['background-color']))['background-color'];
/** Đọc file xlsx (giải nén bằng unzip hệ thống) → mảng dòng. */
function xlsxRows(file: string): string[][] {
  const z = (n: string) => { try { return execFileSync('unzip', ['-p', file, n], { maxBuffer: 64 << 20 }).toString('utf8'); } catch { return ''; } };
  const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const shared = [...z('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const sheet = z('xl/worksheets/sheet1.xml');
  const colIdx = (ref: string) => { const L = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A'; let n = 0; for (const ch of L) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r => {
    const out: string[] = [];
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = /t="(\w+)"/.exec(c[1])?.[1], body = c[2] ?? '', ref = /r="([A-Z]+\d+)"/.exec(c[1])?.[1];
      const v = t === 's' ? shared[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])] ?? '' : t === 'inlineStr' ? dec([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')) : dec(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
      out[ref ? colIdx(ref) : out.length] = v.trim();
    }
    return Array.from(out, x => x ?? '');
  });
}
async function exportXlsx(page: Page, name: string) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByRole('button', { name: /xuất excel/i }).first().click()]);
  const f = `/tmp/qca-a2-${name}-${Date.now()}.xlsx`; await dl.saveAs(f); return f;
}
/** Thông tin cột của bảng chính: tiêu đề, căn lề th/td, font của th, font-weight phần chữ trong td (dòng 1). */
async function tableInfo(page: Page) {
  return page.evaluate(() => {
    const ths = [...document.querySelectorAll('.ant-layout-content .ant-table-thead')].find(h => (h as HTMLElement).offsetParent)!
      .querySelectorAll('th:not(.ant-table-cell-scrollbar)');
    const tr = document.querySelector('.ant-layout-content tbody tr.ant-table-row')!;
    const tds = [...tr.querySelectorAll(':scope > td')];
    const txtWeight = (el: Element) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n: Node | null; while ((n = w.nextNode())) if ((n.textContent || '').trim()) return getComputedStyle(n.parentElement!).fontWeight; return ''; };
    return [...ths].map((th, i) => ({
      head: (th as HTMLElement).innerText.trim(), thAlign: getComputedStyle(th).textAlign, thSize: getComputedStyle(th).fontSize,
      tdAlign: tds[i] ? getComputedStyle(tds[i]).textAlign : '', weight: tds[i] ? txtWeight(tds[i]) : '', text: tds[i] ? (tds[i] as HTMLElement).innerText.trim() : '',
    }));
  });
}
const side = (a: string) => /right|end/.test(a) ? 'right' : /center/.test(a) ? 'center' : 'left';

// ======================================================================= ĐƠN VỊ HÀNH CHÍNH CẤP TỈNH
guardSession(test);

async function rowTexts4(page: Page) {
  return dataRows(page).evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll(':scope > td')].map(td => ((td as HTMLElement).innerText || '').split('\n')[0].trim())));
}

// ======================================================================= ĐƠN VỊ HÀNH CHÍNH CẤP XÃ

// ======================================================================= LOẠI ĐƠN VỊ

// ======================================================================= ĐƠN VỊ

// ======================================================================= THAM SỐ HỆ THỐNG / NHẬT KÝ / XÁC THỰC / API CHUNG
test.describe('Tham số hệ thống, Nhật ký, phiên, tệp minh chứng', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('ATA-C12'), async ({ page }) => {
    // CHỈ kiểm phần hiển thị: KHÔNG bấm Lưu; chặn mọi request ghi tới system/* để chắc chắn không đổi tham số dùng chung.
    // Phần "Lưu → tải lại giữ đúng lựa chọn" = BLOCKED (đổi tham số ảnh hưởng toàn môi trường, các agent khác đang chạy song song).
    const writes: string[] = [];
    await page.route(/\/api\/v1\/system\//, r => { if (r.request().method() !== 'GET') { writes.push(r.request().url()); return r.abort(); } return r.continue(); });
    page.on('dialog', x => x.accept().catch(() => {}));
    await page.goto(`${B}/vi/system-config`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    await page.locator('.ant-tabs-tab', { hasText: 'Minh chứng' }).click(); await page.waitForTimeout(1200);
    const pane = page.locator('.ant-tabs-tabpane-active').first();
    await expect(pane).toContainText(/định dạng tệp cho phép/i);
    const fmt = (f: string) => pane.locator('button[aria-pressed], [role=switch], [role=checkbox], label', { hasText: new RegExp(`^\\s*\\.?${f}\\s*$`, 'i') }).first();
    for (const f of ['pdf', 'docx', 'xlsx', 'jpg', 'png']) await expect(fmt(f), `thiếu định dạng ${f.toUpperCase()} (chọn/bỏ được)`).toBeVisible();
    // chọn/bỏ được: bấm DOCX đổi trạng thái, bấm lại trở về (không lưu)
    const el = fmt('docx');
    const st = () => el.evaluate(e => [e.getAttribute('aria-pressed'), e.getAttribute('aria-checked'), getComputedStyle(e).backgroundColor].join('|'));
    const s0 = await st(); await el.click(); await page.waitForTimeout(400); const s1 = await st();
    await el.click(); await page.waitForTimeout(400); const s2 = await st();
    expect(s1, 'bấm DOCX phải đổi trạng thái chọn').not.toBe(s0);
    expect(s2, 'bấm lại phải trở về trạng thái ban đầu').toBe(s0);
    await page.reload({ waitUntil: 'networkidle' });
    expect(writes, 'không được có request ghi tham số').toEqual([]);
  });
  test(tc('ATA-N25'), async ({ page }) => {
    // Phần "không có dòng chữ phụ thừa dưới giá trị chính": design không có giá trị cụ thể → chỉ kiểm cột Thiết bị
    await page.goto(`${B}/vi/audit-log`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    const heads = (await page.locator('.ant-layout-content .ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    expect(heads.length).toBeGreaterThan(0);
    expect(heads.filter(h => /thiết bị/i.test(h)), `cột: ${heads.join(' | ')}`).toEqual([]);
  });
  test(tc('ATU-T05'), async ({ browser }) => {
    // Chỉ kiểm phần mở tab mới dùng chung phiên. KHÔNG đăng xuất (phần "đăng xuất ở một tab" sẽ hủy session admin dùng chung).
    const ctx = await browser.newContext({ storageState: 'auth/admin.json' });
    try {
      const t1 = await ctx.newPage(); await t1.goto(`${B}/vi/provinces`, { waitUntil: 'networkidle' }); await t1.waitForTimeout(1500);
      await expect(t1.locator('tbody tr.ant-table-row').first()).toBeVisible();
      const bad: string[] = [];
      for (const r of ['', 'vi/organizations']) {
        const t2 = await ctx.newPage(); await t2.goto(`${B}/${r}`, { waitUntil: 'networkidle' }); await t2.waitForTimeout(2500);
        const login = await t2.locator('input[type=password]').filter({ visible: true }).count();
        if (login || /login|dang-nhap|sign-?in/i.test(t2.url())) bad.push(`tab mới mở "/${r}" bị yêu cầu đăng nhập (${t2.url()})`);
        else if (r && !(await t2.locator('tbody tr.ant-table-row').first().isVisible().catch(() => false))) bad.push(`tab mới "/${r}" không vào thẳng màn nghiệp vụ (${t2.url()})`);
        await t2.close();
      }
      expect(bad, bad.join('\n')).toEqual([]);
    } finally { await ctx.close(); }
  });
});
});
