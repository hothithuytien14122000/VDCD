// Khung dùng chung cho 6 page phân hệ A. Tên test = "[ID] tiêu đề" lấy từ testcases/docs/catalog.json (nguồn chuẩn).
import { test as base, expect, Page, Locator } from '@playwright/test';
import fs from 'node:fs';
import { goto, uid } from '../helpers';
import { apiStatus, tokenOf, apiDelete, findIdByCode, API_BASE } from '../api';
import cfg from '../../accounts.mjs';
if (!cfg.password) throw new Error('Thiếu DEFAULT_PASSWORD trong .env (xem .env.example)');

type TC = { id: string; title: string; account?: string | null };
const CATALOG: TC[] = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8'));
/** Tên test theo catalog; báo lỗi nếu ID không có trong catalog (đảm bảo script ⇄ testcase 1-1). */
export const tc = (id: string): string => {
  const x = CATALOG.find(c => c.id === id);
  if (!x) throw new Error(`Testcase ${id} không có trong catalog`);
  return `[${id}] ${x.title}`;
};
/** Test chạy bằng tài khoản của TÁC NHÂN chính (catalog.json: account, lấy từ cột "Tên tác nhân chính" của UC_1409). Test đã khai báo phiên rỗng (chưa đăng nhập) thì giữ nguyên. */
export const test = base.extend({
  page: async ({ browser, baseURL, storageState, context }, use, testInfo) => {
    const id = testInfo.title.match(/^\[([A-Z]{3}-[A-Z]\d+)\]/)?.[1];
    const key = id ? CATALOG.find(c => c.id === id)?.account : undefined;
    const anon = typeof storageState === 'object' && storageState !== null && !(storageState as any).origins?.length;
    if (!key || anon || !fs.existsSync(`auth/${key}.json`)) { await use(await context.newPage()); return; }
    const ctx = await browser.newContext({ storageState: `auth/${key}.json`, baseURL });
    await use(await ctx.newPage()); await ctx.close();
  },
});
export const WRITE = process.env.RUN_WRITE === '1';
export const needWrite = () => test.skip(!WRITE, 'Test ghi dữ liệu: chạy với RUN_WRITE=1');

// ---------- Cấu hình từng page ----------
export interface PageCfg {
  P: string; name: string; route: string; res: string; search: RegExp;
  cols: RegExp[]; codeIdx: number; nameIdx: number; perm: string; lookupOnly?: boolean;
}
export const PAGES: Record<string, PageCfg> = {
  USR: { P: 'USR', name: 'Người dùng', route: 'users', res: 'idm/users', search: /tìm kiếm theo tên, email/i, perm: 'USER',
    cols: [/stt/i, /tên đăng nhập/i, /họ tên/i, /số điện thoại/i, /email/i, /đơn vị/i, /trạng thái/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  GRP: { P: 'GRP', name: 'Nhóm người dùng', route: 'roles', res: 'idm/roles', search: /tìm kiếm theo tên nhóm/i, perm: 'ROLE',
    cols: [/stt/i, /mã nhóm/i, /tên nhóm/i, /mô tả/i, /thành viên/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  PRV: { P: 'PRV', name: 'Tỉnh/thành', route: 'provinces', res: 'provinces', search: /tìm tỉnh\/thành/i, perm: 'PROVINCE',
    cols: [/stt/i, /mã tỉnh/i, /tên tỉnh/i, /số đơn vị/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  COM: { P: 'COM', name: 'Xã/phường', route: 'communes', res: 'communes', search: /tìm theo mã, tên xã/i, perm: 'COMMUNE',
    cols: [/stt/i, /mã xã/i, /tên xã/i, /tỉnh\/thành trực thuộc/i, /số đơn vị/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  UTY: { P: 'UTY', name: 'Loại đơn vị', route: 'unit-types', res: 'unit-types', search: /tìm theo mã, tên loại/i, perm: 'UNIT_TYPE',
    cols: [/stt/i, /mã loại/i, /tên loại/i, /cấp/i, /số đơn vị/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  ORG: { P: 'ORG', name: 'Đơn vị', route: 'organizations', res: 'organizations', search: /tìm theo tên, mã đơn vị/i, perm: 'ORGANIZATION',
    cols: [/stt/i, /mã đơn vị/i, /tên đơn vị/i, /loại đơn vị/i, /tỉnh\/thành tham chiếu/i, /số lượng thành viên/i, /trạng thái/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
};

// ---------- Helper UI ----------
export const dataRows = (page: Page): Locator => page.locator('tbody tr.ant-table-row');
export const FILTERS = '.ant-select:not(.ant-pagination-options .ant-select)';
export async function waitList(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(900);
}
export async function openList(page: Page, cfg: PageCfg) {
  await goto(page, cfg.route);
  await dataRows(page).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
}
export async function totalOf(page: Page): Promise<number> {
  const pager = page.locator('.ant-pagination').first();
  if (!(await pager.count())) return await dataRows(page).count();
  const t = await pager.innerText().catch(() => '');
  const m = t.replace(/\s+/g, ' ').match(/trong\s+(\d+)/i);
  return m ? Number(m[1]) : await dataRows(page).count();
}
export async function searchFor(page: Page, cfg: PageCfg, kw: string) {
  await page.getByPlaceholder(cfg.search).fill(kw);
  await waitList(page);
}
export async function rowTexts(page: Page): Promise<string[]> {
  return (await dataRows(page).allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
}
export async function cellText(page: Page, rowIdx: number, colIdx: number): Promise<string> {
  const t = await dataRows(page).nth(rowIdx).locator('td').nth(colIdx).innerText();
  return t.split('\n')[0].trim();
}
/** Tìm theo mã rồi trả về dòng khớp. */
export async function findRow(page: Page, cfg: PageCfg, code: string): Promise<Locator> {
  await searchFor(page, cfg, code);
  return dataRows(page).filter({ hasText: code });
}
/** Chọn option trong 1 ant-select (theo text hoặc option đầu tiên khả dụng). */
export async function pickOption(page: Page, select: Locator, text?: string | RegExp) {
  await select.click();
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.waitFor({ state: 'visible' });
  const opt = text !== undefined
    ? dd.locator('.ant-select-item-option', { hasText: text }).first()
    : dd.locator('.ant-select-item-option:not(.ant-select-item-option-disabled)').first();
  const label = (await opt.innerText()).trim();
  await opt.click();
  await page.waitForTimeout(600);
  return label;
}
export const dlg = (page: Page) => page.getByRole('dialog').last();
export const btnCancel = (d: Locator) => d.locator('button', { hasText: /^\s*Huỷ\s*$/ }).last();
export async function toast(page: Page): Promise<string> {
  const t = page.locator('.ant-message-notice, .ant-notification-notice').last();
  await t.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  return ((await t.textContent().catch(() => '')) || '').trim();
}
/** Mở menu thao tác (chevron) của dòng và chọn mục theo text. */
export async function rowAction(page: Page, row: Locator, action: RegExp) {
  await row.first().locator('button.ant-dropdown-trigger').first().click();
  const item = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: action }).first();
  await item.waitFor({ state: 'visible' });
  await item.click();
}
export async function rowMenuItems(page: Page, row: Locator): Promise<string[]> {
  await row.first().locator('button.ant-dropdown-trigger').first().click();
  await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item').first().waitFor({ state: 'visible' });
  const items = await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item').allInnerTexts();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return items.map(s => s.trim());
}
export async function confirmYes(page: Page) {
  await page.getByRole('button', { name: /^\s*có\s*$|xác nhận|đồng ý/i }).filter({ visible: true }).last().click();
  await page.waitForTimeout(1200);
}
export async function confirmNo(page: Page) {
  await page.getByRole('button', { name: /^\s*không\s*$/i }).filter({ visible: true }).last().click();
  await page.waitForTimeout(800);
}

// ---------- API tiện ích ----------
export const H = () => ({ Authorization: `Bearer ${tokenOf('superadmin')}`, 'Content-Type': 'application/json' });
export async function api(method: string, resource: string, body?: any, as: string = 'superadmin') {
  const r = await fetch(`${API_BASE}/api/v1/${resource}`, {
    method, headers: { Authorization: `Bearer ${tokenOf(as)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, message: String(j?.message ?? ''), data: j?.data, raw: j };
}
const rowsOf = (d: any): any[] => d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
/** API không đồng nhất giữa các tài nguyên (có nơi bỏ qua `keyword`, có nơi bỏ qua `filter`) → thử filter JSON, không khớp thì quét toàn bộ các trang. */
export async function listApi(resource: string, keyword: string): Promise<any[]> {
  const kw = keyword.toLowerCase();
  const hit = (x: any) => [x.code, x.userName, x.name].some((v: any) => String(v ?? '').toLowerCase().includes(kw));
  const q = await api('GET', `${resource}?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ keyword, fullTextSearch: keyword }))}`);
  const first = rowsOf(q.data);
  if (first.some(hit)) return first.filter(hit);
  const out: any[] = [];
  for (let page = 1; page <= 30; page++) {
    const r = await api('GET', `${resource}?page=${page}&size=100`);
    out.push(...rowsOf(r.data).filter(hit));
    if (page >= (r.data?.totalPages ?? 1)) break;
  }
  return out;
}
export async function findApi(resource: string, key: string, field = 'code') {
  return (await listApi(resource, key)).find((x: any) => x[field] === key) ?? null;
}

/** Ghi nhận dữ liệu test đã tạo để dọn sau mỗi test (xóa theo thứ tự ngược: con trước, cha sau). */
export class Made {
  private items: { res: string; key: string; field: string }[] = [];
  add(res: string, key: string, field = 'code') { this.items.push({ res, key, field }); return key; }
  addDti(res: string, key: string, field = 'code') { return this.add(res, key, field); }
  async clean() {
    for (const it of this.items.reverse()) {
      try {
        const x = it.field === 'id' ? { id: it.key, isLocked: true } : await findApi(it.res, it.key, it.field);
        if (x?.id) {
          if (it.res === 'organizations' && x.isLocked) await api('PUT', `organizations/${x.id}/unlock`, {});
          if (it.res.startsWith('dti/') && x.isLocked) await api('PUT', `${it.res}/${x.id}/unlock`, {});
          await apiDelete(it.res, x.id);
        }
      } catch { /* bỏ qua */ }
    }
    this.items = [];
  }
}
export const code8 = () => uid();               // QCAxxxxx (8 ký tự)
export const uname = () => uid().toLowerCase(); // qcaxxxxx

// ---------- Body API tạo nhanh ----------
export const userBody = (u: string, extra: any = {}) => ({
  name: `qc.automation ${u}`, email: `${u}@cds.local`, userName: u, password: cfg.password,
  isRequireChangePassword: false, isRequestMailInfo: false, organizationId: null, roleCode: '', ...extra,
});
export async function ensureUnitType(made: Made, level = 2) {
  const code = code8(); made.add('unit-types', code);
  const r = await api('POST', 'unit-types', { code, name: `qc.automation Loại ${code}`, adminLevel: level });
  if (r.status !== 200) throw new Error('Tạo loại đơn vị lỗi: ' + r.message);
  return { code, id: r.data.id as string };
}
export async function ensureProvince(made: Made) {
  const code = code8(); made.add('provinces', code);
  const r = await api('POST', 'provinces', { code, name: `qc.automation Tỉnh ${code}` });
  if (r.status !== 200) throw new Error('Tạo tỉnh lỗi: ' + r.message);
  return { code, id: r.data.id as string };
}
/** Tạo đơn vị qua API. lock=true: khóa (đưa vào sử dụng) để có thể chọn trong các ô chọn Đơn vị của form khác. */
export async function ensureOrg(made: Made, extra: any = {}, lock = false) {
  const ut = extra.unitTypeId ? null : await ensureUnitType(made, extra.__level ?? 2);
  delete extra.__level;
  const code = code8(); made.add('organizations', code);
  const r = await api('POST', 'organizations', { code, name: `qc.automation ĐV ${code}`, unitTypeId: extra.unitTypeId ?? ut!.id, ...extra });
  if (r.status !== 200) throw new Error('Tạo đơn vị lỗi: ' + r.message);
  if (lock) { const l = await api('PUT', `organizations/${r.data.id}/lock`, {}); if (l.status !== 200) throw new Error('Khóa đơn vị lỗi: ' + l.message); }
  return { code, id: r.data.id as string, name: `qc.automation ĐV ${code}`, unitTypeId: (extra.unitTypeId ?? ut!.id) as string };
}
export async function ensureUser(made: Made, extra: any = {}) {
  const u = uname(); made.add('idm/users', u, 'userName');
  const r = await api('POST', 'idm/users', userBody(u, extra));
  if (r.status !== 200) throw new Error('Tạo user lỗi: ' + r.message);
  return { userName: u, id: r.data?.id as string };
}
export async function ensureRole(made: Made, extra: any = {}) {
  const code = code8(); made.add('idm/roles', code);
  const r = await api('POST', 'idm/roles', { code, name: `qc.automation Nhóm ${code}`, description: 'qc.automation', ...extra });
  if (r.status !== 200) throw new Error('Tạo nhóm lỗi: ' + r.message);
  return { code, name: `qc.automation Nhóm ${code}` };
}

// ================= BỘ TEST DANH SÁCH (L01..L11) =================
export const padMade = new Made();
export function registerListSuite(P: string, opts: { exportBtn?: boolean } = {}) {
  test.afterEach(async () => { await padMade.clean(); });
  const cfg = PAGES[P];
  test.describe(`${cfg.name} › Danh sách / Tìm kiếm / Phân trang`, () => {
    test(tc(`${P}-L01`), async ({ page }) => {
      await openList(page, cfg);
      const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
      for (const re of cfg.cols) expect(heads.some(h => re.test(h)), `thiếu cột ${re} trong [${heads.join(' | ')}]`).toBeTruthy();
      expect(await dataRows(page).count()).toBeGreaterThan(0);
    });
    test(tc(`${P}-L02`), async ({ page }) => {
      await openList(page, cfg);
      const n = await totalOf(page), rows = await dataRows(page).count();
      expect(rows).toBe(Math.min(10, n));
      expect(await page.locator('.ant-pagination').first().innerText()).toMatch(/trong\s+\d+/i);
    });
    test(tc(`${P}-L03`), async ({ page }) => {
      await openList(page, cfg);
      const kw = await cellText(page, 0, cfg.codeIdx);
      await searchFor(page, cfg, kw);
      const texts = await rowTexts(page);
      expect(texts.length).toBeGreaterThan(0);
      for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
    });
    test(tc(`${P}-L04`), async ({ page }) => {
      await openList(page, cfg);
      const kw = (await cellText(page, 0, cfg.nameIdx)).slice(0, 25).trim();
      await searchFor(page, cfg, kw);
      const texts = await rowTexts(page);
      expect(texts.length).toBeGreaterThan(0);
      for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
    });
    test(tc(`${P}-L05`), async ({ page }) => {
      await openList(page, cfg);
      await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
      expect(await dataRows(page).count()).toBe(0);
      await expect(page.locator('.ant-empty, .ant-table-placeholder').first()).toBeVisible();
    });
    test(tc(`${P}-L06`), async ({ page }) => {
      await openList(page, cfg);
      const kw = await cellText(page, 0, cfg.codeIdx);
      await searchFor(page, cfg, kw.toUpperCase()); const a = await totalOf(page);
      await searchFor(page, cfg, kw.toLowerCase()); const b = await totalOf(page);
      expect(a).toBeGreaterThan(0);
      expect(b, 'HOA/thường phải cho cùng số kết quả').toBe(a);
    });
    test(tc(`${P}-L07`), async ({ page }) => {
      let dialogSeen = false;
      page.on('dialog', d => { dialogSeen = true; d.dismiss().catch(() => {}); });
      await openList(page, cfg);
      for (const bad of ["' OR 1=1 --", '<script>alert(1)</script>', '"; DROP TABLE users; --']) {
        await searchFor(page, cfg, bad);
        const body = (await page.locator('body').innerText()).toLowerCase();
        expect(body).not.toMatch(/internal server error|exception|stack ?trace|sqlexception|syntax error/);
        // chuỗi tấn công chỉ được khớp bản ghi nào thực sự chứa nguyên văn chuỗi đó (không "OR 1=1" trả về tất cả)
        for (const t of await rowTexts(page)) expect(t.toLowerCase(), `"${bad}" khớp bản ghi không chứa chuỗi này`).toContain(bad.toLowerCase());
      }
      expect(dialogSeen, 'không được thực thi script (XSS)').toBeFalsy();
    });
    // Đủ dữ liệu để phân trang: nếu ít hơn 11 bản ghi và được phép ghi thì tự tạo thêm user (dọn bởi afterEach của spec)
    const padUsers = async (page: Page) => {
      if (P !== 'USR' || !WRITE) return;
      const n = await totalOf(page);
      if (n > 10) return;
      for (let i = n; i < 12; i++) await ensureUser(padMade);
      await page.reload(); await waitList(page);
    };
    test(tc(`${P}-L08`), async ({ page }) => {
      await openList(page, cfg);
      await padUsers(page);
      test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
      const before = (await rowTexts(page)).join('|');
      await page.locator('.ant-pagination-item-2').first().click();
      await waitList(page);
      await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
      expect((await rowTexts(page)).join('|')).not.toBe(before);
    });
    test(tc(`${P}-L09`), async ({ page }) => {
      await openList(page, cfg);
      await padUsers(page);
      const n = await totalOf(page);
      test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
      await pickOption(page, page.locator('.ant-pagination-options .ant-select').first(), '20');
      await waitList(page);
      expect(await dataRows(page).count()).toBe(Math.min(20, n));
      expect(await totalOf(page)).toBe(n);
    });
    test(tc(`${P}-L10`), async ({ page }) => {
      await openList(page, cfg);
      const n = await totalOf(page);
      await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
      expect(await totalOf(page)).toBe(0);
      await searchFor(page, cfg, '');
      expect(await totalOf(page)).toBe(n);
    });
    test(tc(`${P}-L11`), async ({ page }) => {
      await openList(page, cfg);
      const btn = page.getByRole('button', { name: /xuất excel/i }).first();
      await expect(btn, 'trang danh sách phải có nút "Xuất Excel"').toBeVisible({ timeout: 3000 });
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10_000 }), btn.click()]);
      expect(dl.suggestedFilename()).toMatch(/\.xlsx?$/i);
    });
  });
}

// ================= BẢO MẬT & HIỆU NĂNG DÙNG CHUNG =================
/** 401 khi không token / token giả. */
export function registerAuthTest(id: string, cfg: PageCfg) {
  test(tc(id), async () => {
    const a = await apiStatus({ resource: `${cfg.res}?pageSize=5`, rawToken: '' });
    const b = await apiStatus({ resource: `${cfg.res}?pageSize=5`, rawToken: 'abc.def.ghi' });
    expect(a, 'không token').toBe(401);
    expect(b, 'token giả').toBe(401);
  });
}
async function myPerms(as: string): Promise<Set<string>> {
  const r = await api('GET', 'idm/permission-matrix/me', undefined, as);
  return new Set(Object.values(r.data ?? {}).map((x: any) => x.code));
}
/** Quyền thực thi API đúng theo ma trận quyền của tài khoản canbo (có quyền → không 403; không → 403). */
export function registerMatrixTest(id: string, cfg: PageCfg) {
  test(tc(id), async () => {
    const perms = await myPerms('canbo');
    const fake = '00000000-0000-0000-0000-000000000000';
    const checks: [string, string, any, string][] = [
      ['GET', `${cfg.res}?pageSize=1`, undefined, `${cfg.perm}.VIEW`],
      ['POST', cfg.res, {}, `${cfg.perm}.CREATE`],
      ['DELETE', `${cfg.res}/${fake}`, undefined, `${cfg.perm}.DELETE`],
    ];
    const bad: string[] = [];
    for (const [m, url, body, perm] of checks) {
      const s = (await api(m, url, body, 'canbo')).status;
      const has = perms.has(perm);
      if (has && (s === 401 || s === 403)) bad.push(`${m} ${cfg.res}: có ${perm} nhưng bị ${s}`);
      if (!has && s !== 403) bad.push(`${m} ${cfg.res}: KHÔNG có ${perm} nhưng trả ${s} (kỳ vọng 403)`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
}
const API_MAX_MS = 3000, RENDER_MAX_MS = 6000;
export function registerPerfTest(id: string, cfg: PageCfg) {
  test(tc(id), async ({ page }) => {
    const respP = page.waitForResponse(r => r.url().includes(`/api/v1/${cfg.res}`) && r.request().method() === 'GET', { timeout: 20_000 });
    const t0 = Date.now();
    await page.goto(`/#/vi/${cfg.route}`, { waitUntil: 'commit' });
    const resp = await respP; const apiMs = Date.now() - t0;
    expect(resp.status()).toBeLessThan(400);
    await dataRows(page).first().waitFor({ state: 'visible', timeout: RENDER_MAX_MS });
    const renderMs = Date.now() - t0;
    console.log(`  ⏱ ${cfg.name}: API ${apiMs}ms, hiển thị ${renderMs}ms`);
    expect(apiMs, `API < ${API_MAX_MS}ms`).toBeLessThan(API_MAX_MS);
    expect(renderMs, `hiển thị < ${RENDER_MAX_MS}ms`).toBeLessThan(RENDER_MAX_MS);
  });
}
export { apiStatus, tokenOf, goto, uid, expect, test };

/** Chọn option trong ant-select (có ô tìm) thuộc form-item có nhãn labelRe: gõ để lọc rồi chọn option chứa text. */
export async function pickByLabel(page: Page, scope: Locator, labelRe: RegExp, text?: string) {
  const sel = scope.locator('.ant-form-item').filter({ hasText: labelRe }).locator('.ant-select').first();
  await sel.click();
  if (text) { await page.keyboard.type(text.slice(-8)); await page.waitForTimeout(1500); }
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.waitFor({ state: 'visible' });
  const opt = text
    ? dd.getByText(text).first()
    : dd.locator('.ant-select-item-option:not(.ant-select-item-option-disabled)').first();
  await opt.click();
  await page.waitForTimeout(500);
}
export async function setCheckbox(scope: Locator, labelRe: RegExp, on: boolean) {
  const label = scope.locator('label', { hasText: labelRe }).first();
  const cb = label.locator('input[type=checkbox]').first();
  for (let i = 0; i < 3 && (await cb.isChecked()) !== on; i++) { await label.click(); await scope.page().waitForTimeout(250); }
  expect(await cb.isChecked(), `checkbox ${labelRe}`).toBe(on);
}
export const btnSave = (d: Locator) => d.locator('button', { hasText: /^\s*Lưu( thay đổi)?\s*$/ }).last();

/** Id một đơn vị có sẵn (không phải dữ liệu auto) - dùng gán cho user test; modal "thêm người dùng vào nhóm" chỉ liệt kê user đã có đơn vị. */
export async function anyOrgId(): Promise<string> {
  const r = await api('GET', 'organizations?page=1&size=5');
  const arr = r.data?.content ?? r.data ?? [];
  return (arr.find((o: any) => !/^QCA/i.test(o.code ?? '')) ?? arr[0]).id;
}

export async function ensureCommune(made: Made, provinceId: string | null) {
  const code = code8(); made.add('communes', code);
  const r = await api('POST', 'communes', { code, name: `qc.automation Xã ${code}`, ...(provinceId ? { provinceId } : {}) });
  if (r.status !== 200) throw new Error('Tạo xã lỗi: ' + r.message);
  return { code, id: r.data.id as string, name: `qc.automation Xã ${code}` };
}

// ================= EDGE / ERROR dùng chung (G01..G05) =================
export const SPECIAL_NAME = `qc.automation Ngô Thị Ơ Ữ <b>in đậm</b> & "nháy" 'đơn' 100%`;
export interface EdgeOpts {
  P: string; cfg: PageCfg; made: Made;
  openAdd: (page: Page) => Promise<Locator>;
  submit: (d: Locator) => Promise<void>;
  /** điền các trường văn bản bắt buộc chỉ bằng khoảng trắng */
  fillBlank: (d: Locator) => Promise<void>;
  /** điền form hợp lệ với mã `code` (không bấm lưu) */
  fillValid: (page: Page, d: Locator, code: string) => Promise<void>;
  /** tạo bản ghi qua API với tên cho trước → trả mã để tìm trên danh sách */
  makeNamed: (name: string) => Promise<string>;
  /** [API] tạo với tên rỗng; bỏ qua nếu page đã có testcase riêng */
  apiEmpty?: () => Promise<{ status: number; message: string }>;
}
export function registerEdgeTests(o: EdgeOpts) {
  const { P, cfg, made } = o;
  test.describe(`${cfg.name} › Edge / Lỗi`, () => {
    test.describe.configure({ timeout: 60_000 });
    needWrite();
    test(tc(`${P}-G01`), async ({ page }) => {
      const d = await o.openAdd(page);
      await o.fillBlank(d); await o.submit(d);
      await page.waitForTimeout(900);
      const msg = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' ');
      const inline = await d.locator('.ant-form-item-explain-error').count();
      expect(inline > 0 || /không được để trống|bắt buộc|không hợp lệ/i.test(msg), `chuỗi chỉ có khoảng trắng phải bị báo lỗi (inline=${inline}, toast="${msg}")`).toBeTruthy();
      expect(msg, 'không được báo tạo thành công').not.toMatch(/thành công/i);
      await expect(d).toBeVisible();
    });
    test(tc(`${P}-G02`), async ({ page }) => {
      const code = await o.makeNamed(SPECIAL_NAME);
      await openList(page, cfg); await page.reload(); await waitList(page);
      const row = await findRow(page, cfg, code);
      expect((await row.first().innerText()).replace(/\s+/g, ' ')).toContain(SPECIAL_NAME);
      expect(await row.first().locator('b').count(), 'HTML trong tên phải hiển thị dạng chữ, không được render').toBe(0);
    });
    if (o.apiEmpty) test(tc(`${P}-G03`), async () => {
      const r = await o.apiEmpty!();
      expect(r.status, `tên rỗng qua API (HTTP ${r.status}: ${r.message})`).toBe(400);
    });
    test(tc(`${P}-G06`), async ({ page }) => {
      const field = cfg.res === 'idm/users' ? 'userName' : 'code';
      const code = made.add(cfg.res, cfg.res === 'idm/users' ? code8().toLowerCase() : code8(), field);
      const d = await o.openAdd(page); await o.fillValid(page, d, code);
      await Promise.all([o.submit(d), Promise.race([o.submit(d).catch(() => {}), page.waitForTimeout(3000)])]);
      await page.waitForTimeout(2500);
      const same = (await listApi(cfg.res, code)).filter((x: any) => x[field] === code);
      expect(same.length, 'bấm Lưu 2 lần chỉ được tạo đúng 1 bản ghi').toBe(1);
    });
    for (const [id, mode] of [[`${P}-G04`, 'http500'], [`${P}-G05`, 'offline']] as const) {
      test(tc(id), async ({ page }) => {
        const code = made.add(cfg.res, code8());
        const d = await o.openAdd(page); await o.fillValid(page, d, code);
        await page.route(new RegExp(`/api/v1/${cfg.res}$`), r => {
          if (r.request().method() !== 'POST') return r.continue();
          return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
        });
        await o.submit(d); await page.waitForTimeout(1500);
        await expect(d, 'form phải còn mở để người dùng thử lại').toBeVisible();
        const body = (await page.locator('body').innerText()).toLowerCase();
        expect(body).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
        expect(await d.locator('input').first().inputValue(), 'dữ liệu đã nhập không được mất').not.toBe('');
        await page.unroute(new RegExp(`/api/v1/${cfg.res}$`));
        expect(await findApi(cfg.res, code, cfg.res === 'idm/users' ? 'userName' : 'code')).toBeNull();
      });
    }
  });
}

/** Mở chi tiết với id không tồn tại: API 404 (không 500) và giao diện không vỡ / không lộ lỗi nội bộ. */
export function registerNotFoundTest(id: string, cfg: PageCfg, ui = true) {
  test(tc(id), async ({ page }) => {
    const fake = '00000000-0000-4000-8000-000000000000';
    const r = await api('GET', `${cfg.res}/${fake}`);
    expect(r.status, `GET ${cfg.res}/<id lạ> phải 404, không 500 (HTTP ${r.status})`).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    if (!ui) return;
    await page.goto(`/#/vi/${cfg.route}/${fake}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toMatch(/stack ?trace|exception|at com\.|undefined|cannot read/);
    expect((await page.locator('.ant-layout-content, #root').first().innerText()).trim().length, 'trang không được trắng').toBeGreaterThan(0);
  });
}
