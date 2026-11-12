// Khung dùng chung cho 6 page phân hệ A. Tên test = "[ID] tiêu đề" lấy từ testcases/docs/catalog.json (nguồn chuẩn).
import { test as base, expect, Page, Locator } from '@playwright/test';
import fs from 'node:fs';
import { goto, uid, hidePwExpiry } from '../helpers';
import { apiStatus, tokenOf, apiDelete, findIdByCode, API_BASE } from '../api';
import cfg from '../../accounts.mjs';
if (!cfg.password) throw new Error('Thiếu DEFAULT_PASSWORD trong .env (xem .env.example)');

type TC = { id: string; title: string; account?: string | null };
const CATALOG: TC[] = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8'));
/** Tên test theo catalog; báo lỗi nếu ID không có trong catalog (đảm bảo script ⇄ testcase 1-1). */
/** ID đã loại (testcases/docs/removed.json) → tiêu đề gắn nhãn [ĐÃ LOẠI], playwright.config.ts bỏ qua bằng grepInvert. */
const REMOVED: Record<string, string> = fs.existsSync('testcases/docs/removed.json') ? JSON.parse(fs.readFileSync('testcases/docs/removed.json', 'utf8')) : {};
export const tc = (id: string): string => {
  if (REMOVED[id]) return `[ĐÃ LOẠI] [${id}]`;
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
    if (!key || anon || !fs.existsSync(`auth/${key}.json`)) { await hidePwExpiry(context); await use(await context.newPage()); return; }
    const ctx = await browser.newContext({ storageState: `auth/${key}.json`, baseURL });
    await hidePwExpiry(ctx);
    await use(await ctx.newPage()); await ctx.close();
  },
});
// Môi trường test: luôn chạy test ghi dữ liệu (có case xóa để dọn dữ liệu rác).
export const WRITE = true;
export const needWrite = () => {};

// ---------- Cấu hình từng page ----------
export interface PageCfg {
  P: string; name: string; route: string; res: string; search: RegExp;
  cols: RegExp[]; codeIdx: number; nameIdx: number; perm: string; lookupOnly?: boolean;
}
export const PAGES: Record<string, PageCfg> = {
  USR: { P: 'USR', name: 'Người dùng', route: 'users', res: 'idm/users', search: /tìm kiếm theo tên, email/i, perm: 'USER',
    cols: [/stt/i, /tên đăng nhập/i, /họ tên/i, /số điện thoại/i, /email/i, /đơn vị/i, /trạng thái/i, /thao tác/i], codeIdx: 2, nameIdx: 3 },
  GRP: { P: 'GRP', name: 'Nhóm người dùng', route: 'roles', res: 'idm/roles', search: /tìm theo mã, tên nhóm/i, perm: 'ROLE',
    cols: [/stt/i, /mã nhóm/i, /tên nhóm/i, /mô tả/i, /số người dùng/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  PRV: { P: 'PRV', name: 'Tỉnh/thành', route: 'provinces', res: 'provinces', search: /tìm theo mã, tên tỉnh\/thành/i, perm: 'PROVINCE',
    cols: [/stt/i, /mã tỉnh/i, /tên tỉnh/i, /số đơn vị/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  COM: { P: 'COM', name: 'Xã/phường', route: 'communes', res: 'communes', search: /tìm theo mã, tên xã/i, perm: 'COMMUNE',
    cols: [/stt/i, /mã xã/i, /tên xã/i, /^tỉnh\/thành$/i, /số đơn vị/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
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
/** Số bản ghi/trang đang chọn ở thanh phân trang (mặc định hiện tại của hệ thống: 20). */
export async function pageSizeOf(page: Page): Promise<number> {
  const t = await page.locator('.ant-pagination-options .ant-select').first().innerText().catch(() => '');
  const m = t.match(/(\d+)/); return m ? Number(m[1]) : 10;
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
  // ô chọn có tìm kiếm + danh sách ảo (chỉ render phần đang thấy) → gõ để lọc trước khi chọn
  if (typeof text === 'string' && await select.evaluate(e => e.classList.contains('ant-select-show-search')).catch(() => false)) {
    await page.keyboard.type(text.slice(-8)); await page.waitForTimeout(1200);
  }
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
  if (!(await t.count())) return '';   // không có thông báo → trả rỗng ngay (textContent sẽ chờ vô hạn)
  return ((await t.textContent({ timeout: 2000 }).catch(() => '')) || '').trim();
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
/** Hộp xác nhận: giao diện mới dùng nút hành động ("Xoá", "Khoá", "Mở khoá", "Xác nhận"…) + "Huỷ"; giao diện cũ "Có"/"Không". */
const CONFIRM_BOX = '.ant-modal-confirm, .ant-popconfirm, .ant-modal-wrap:not([style*="display: none"]) .ant-modal';
/** Nếu đang có hộp xác nhận (Huỷ / Khoá / Xoá / Mở khoá / Có …) thì bấm nút đồng ý; không có thì bỏ qua. */
export async function confirmIfAsked(page: Page) {
  await page.waitForTimeout(400);
  if (await page.locator(CONFIRM_BOX).filter({ visible: true }).count()) await confirmYes(page);
}
export async function confirmYes(page: Page) {
  const box = page.locator(CONFIRM_BOX).filter({ visible: true }).last();
  await box.getByRole('button', { name: /^\s*(có|xo[áa]|kho[áa]|mở kho[áa]|xác nhận|đồng ý|ok|tiếp tục|gửi|duyệt|phê duyệt|từ chối)\s*$|xác nhận|đồng ý/i }).last().click();
  await page.waitForTimeout(1200);
}
export async function confirmNo(page: Page) {
  await page.locator(CONFIRM_BOX).filter({ visible: true }).last().getByRole('button', { name: /^\s*(không|hu[ỷy]|đóng)\s*$/i }).last().click();
  await page.waitForTimeout(800);
}

// ---------- API tiện ích ----------
export const H = () => ({ Authorization: `Bearer ${tokenOf('admin')}`, 'Content-Type': 'application/json' });
export async function api(method: string, resource: string, body?: any, as: string = 'admin') {
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
  /** field: 'code' | 'userName' | ... (tìm bản ghi có x[field] === key) · 'id' (xóa thẳng theo id) · 'nameHas' (xóa MỌI bản ghi có tên chứa key — dùng khi mã do hệ thống tự sinh, chưa biết id) */
  add(res: string, key: string, field = 'code') { this.items.push({ res, key, field }); return key; }
  addDti(res: string, key: string, field = 'code') { return this.add(res, key, field); }
  /** Dọn theo id (mã tự sinh: lấy id từ response khi tạo). */
  addId(res: string, id: string) { if (id) this.add(res, id, 'id'); return id; }
  async clean() {
    for (const it of this.items.reverse()) {
      try {
        const xs = it.field === 'id' ? [{ id: it.key, isLocked: true }]
          : it.field === 'nameHas' ? (await listApi(it.res, it.key)).filter((x: any) => String(x.name ?? '').includes(it.key))
          : [await findApi(it.res, it.key, it.field)];
        for (const x of xs) {
          if (!x?.id) continue;
          if (it.res === 'organizations' && x.isLocked) await api('PUT', `organizations/${x.id}/unlock`, {});
          if (it.res.startsWith('dti/') && x.isLocked) await api(it.res === 'dti/indicator-sets' ? 'POST' : 'PUT', `${it.res}/${x.id}/unlock`, {});
          await apiDelete(it.res, x.id);
        }
      } catch { /* bỏ qua */ }
    }
    this.items = [];
  }
}
/** Mẫu mã do hệ thống tự sinh (form Thêm mới không còn ô Mã, API bỏ qua `code` client gửi). */
export const AUTO_CODE: Record<string, RegExp> = {
  'unit-types': /^LDV-\d{3,}$/, provinces: /^TINH-\d{3,}$/, communes: /^XA-\d{4,}$/, organizations: /^DV-\d{4,}$/,
  'idm/roles': /^NQ-\d{3,}$/, 'idm/users': /^NS-\d{5,}$/,
};
/** Tìm bản ghi theo chuỗi con của tên (tag duy nhất do test sinh). */
export async function findByName(resource: string, tag: string) {
  return (await listApi(resource, tag)).find((x: any) => String(x.name ?? '').includes(tag)) ?? null;
}
export const code8 = () => uid();               // QCAxxxxx (8 ký tự)
export const uname = () => uid().toLowerCase(); // qcaxxxxx

// ---------- Body API tạo nhanh ----------
/** Body tạo người dùng. API mới báo "Không có role người dùng này" khi roleCode = '' → chỉ gửi roleCode khi có giá trị. */
export const userBody = (u: string, extra: any = {}) => {
  const b: any = {
    name: `qc.automation ${u}`, email: `${u}@cds.local`, userName: u, password: cfg.password,
    isRequireChangePassword: false, isRequestMailInfo: false, organizationId: null, ...extra,
  };
  if (b.roleCode === '' || b.roleCode == null) delete b.roleCode;
  return b;
};
// Mã do hệ thống tự sinh → các hàm ensure* KHÔNG gửi code, lấy mã thật từ response (`r.data.code`), dọn theo id.
// `tag` (QCAxxxxx) nằm trong tên để tìm lại bản ghi; `code` = mã thật hệ thống sinh ra.
export async function ensureUnitType(made: Made, level = 2) {
  const tag = code8(), name = `qc.automation Loại ${tag}`;
  const r = await api('POST', 'unit-types', { name, adminLevel: level });
  if (r.status !== 200) throw new Error('Tạo loại đơn vị lỗi: ' + r.message);
  made.addId('unit-types', r.data.id);
  return { code: r.data.code as string, id: r.data.id as string, name, tag };
}
export async function ensureProvince(made: Made) {
  const tag = code8(), name = `qc.automation Tỉnh ${tag}`;
  const r = await api('POST', 'provinces', { name });
  if (r.status !== 200) throw new Error('Tạo tỉnh lỗi: ' + r.message);
  made.addId('provinces', r.data.id);
  return { code: r.data.code as string, id: r.data.id as string, name, tag };
}
/** Tạo đơn vị qua API. lock=true: khóa (đưa vào sử dụng) để có thể chọn trong các ô chọn Đơn vị của form khác. */
export async function ensureOrg(made: Made, extra: any = {}, lock = false) {
  const ut = extra.unitTypeId ? null : await ensureUnitType(made, extra.__level ?? 2);
  delete extra.__level; delete extra.code;
  const tag = code8(), name = extra.name ?? `qc.automation ĐV ${tag}`;
  const r = await api('POST', 'organizations', { name, unitTypeId: extra.unitTypeId ?? ut!.id, ...extra });
  if (r.status !== 200) throw new Error('Tạo đơn vị lỗi: ' + r.message);
  made.addId('organizations', r.data.id);
  if (lock) { const l = await api('PUT', `organizations/${r.data.id}/lock`, {}); if (l.status !== 200) throw new Error('Khóa đơn vị lỗi: ' + l.message); }
  return { code: r.data.code as string, id: r.data.id as string, name, tag, unitTypeId: (extra.unitTypeId ?? ut!.id) as string };
}
export async function ensureUser(made: Made, extra: any = {}) {
  const u = uname(); made.add('idm/users', u, 'userName');
  const r = await api('POST', 'idm/users', userBody(u, extra));
  if (r.status !== 200) throw new Error('Tạo user lỗi: ' + r.message);
  const rec = r.data?.id ? r.data : await findApi('idm/users', u, 'userName');   // API tạo user không trả data → tra lại theo userName
  return { userName: u, id: rec?.id as string, code: rec?.code as string, name: `qc.automation ${u}` };
}
export async function ensureRole(made: Made, extra: any = {}) {
  const tag = code8(), name = extra.name ?? `qc.automation Nhóm ${tag}`;
  const body: any = { name, description: 'qc.automation', ...extra }; delete body.code;
  const r = await api('POST', 'idm/roles', body);
  if (r.status !== 200) throw new Error('Tạo nhóm lỗi: ' + r.message);
  const rec = r.data?.id ? r.data : await findByName('idm/roles', name);   // API tạo nhóm không trả data → tra lại theo tên
  if (rec?.id) made.addId('idm/roles', rec.id); else made.add('idm/roles', name, 'nameHas');
  return { code: rec?.code as string, id: rec?.id as string, name, tag };
}

// ================= BỘ TEST DANH SÁCH (L01..L11) =================
export const padMade = new Made();
export function registerListSuite(P: string, opts: { exportBtn?: boolean; pageSize?: number } = {}) {
  const DEF = opts.pageSize ?? 20;   // số bản ghi/trang mặc định của page (đa số 20; Bộ chỉ số 10)
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
      // Mặc định hiện tại của hệ thống: 20 bản ghi/trang (trước đây 10)
      const n = await totalOf(page), rows = await dataRows(page).count();
      expect(await pageSizeOf(page)).toBe(DEF);
      expect(rows).toBe(Math.min(DEF, n));
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
      await expect(page.locator('.ant-table-placeholder').first(), 'phải hiện "Không tìm thấy dữ liệu phù hợp"').toContainText(/không tìm thấy dữ liệu phù hợp/i);
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
    // Đủ dữ liệu để phân trang: nếu chỉ có 1 trang và được phép ghi thì tự tạo thêm user (dọn bởi afterEach của spec)
    const padUsers = async (page: Page) => {
      if (P !== 'USR' || !WRITE) return;
      const n = await totalOf(page), size = await pageSizeOf(page);
      if (n > size) return;
      for (let i = n; i < size + 2; i++) await ensureUser(padMade);
      await page.reload(); await waitList(page);
    };
    test(tc(`${P}-L08`), async ({ page }) => {
      await openList(page, cfg);
      await padUsers(page);
      test.skip((await totalOf(page)) <= (await pageSizeOf(page)), 'Dữ liệu chỉ có 1 trang');
      const before = (await rowTexts(page)).join('|');
      await page.locator('.ant-pagination-item-2').first().click();
      await waitList(page);
      await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
      expect((await rowTexts(page)).join('|')).not.toBe(before);
    });
    test(tc(`${P}-L09`), async ({ page }) => {
      await openList(page, cfg);
      await padUsers(page);
      const n = await totalOf(page), size = await pageSizeOf(page);
      test.skip(n <= Math.min(size, 10), 'Dữ liệu chỉ có 1 trang');
      // Mặc định hiện là 20/trang → đổi sang 10 (nếu mặc định khác 20 thì đổi sang 20 như testcase gốc)
      const target = size === 20 ? 10 : 20;
      await pickOption(page, page.locator('.ant-pagination-options .ant-select').first(), new RegExp(`^\\s*${target}\\b`));
      await waitList(page);
      expect(await dataRows(page).count()).toBe(Math.min(target, n));
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
  registerSearchRules(P, cfg);
}

// ================= QUY TẮC TÌM KIẾM CHUNG (L31..L33) =================
/** Bỏ dấu tiếng Việt + về chữ thường (so khớp "không phân biệt hoa/thường, không phân biệt dấu"). */
export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
/** Tìm tương đối không dấu; bỏ khoảng trắng đầu/cuối, cả cụm tìm như 1 chuỗi liền; % _ ' là ký tự thường. */
export function registerSearchRules(P: string, cfg: PageCfg = PAGES[P]) {
  test.describe(`${cfg.name} › Quy tắc tìm kiếm chung`, () => {
    test(tc(`${P}-L31`), async ({ page }) => {
      await openList(page, cfg);
      const n = Math.min(await dataRows(page).count(), 10); let name = '';
      for (let i = 0; i < n && !name; i++) { const v = (await cellText(page, i, cfg.nameIdx)).trim(); if (fold(v) !== v.toLowerCase()) name = v; }
      test.skip(!name, 'Trang 1 không có tên chứa dấu tiếng Việt');
      const kw = fold(name).slice(0, 25).trim();
      await searchFor(page, cfg, kw);
      const texts = await rowTexts(page);
      expect(texts.length, `gõ không dấu "${kw}" phải ra "${name}"`).toBeGreaterThan(0);
      for (const t of texts) expect(fold(t), `dòng không chứa "${kw}"`).toContain(kw);
      await searchFor(page, cfg, kw.toUpperCase());
      expect((await rowTexts(page)).length, 'HOA không dấu cùng kết quả').toBe(texts.length);
    });
    test(tc(`${P}-L32`), async ({ page }) => {
      await openList(page, cfg);
      const code = (await cellText(page, 0, cfg.codeIdx)).trim();
      await searchFor(page, cfg, code); const a = await totalOf(page);
      await searchFor(page, cfg, `   ${code}   `); const b = await totalOf(page);
      expect(a).toBeGreaterThan(0);
      expect(b, 'khoảng trắng đầu/cuối phải bị bỏ').toBe(a);
      // cả cụm là 1 chuỗi liền: đảo thứ tự 2 từ đầu của tên thì mọi dòng trả về phải chứa nguyên cụm đảo
      const words = (await cellText(page, 0, cfg.nameIdx)).trim().split(/\s+/);
      test.skip(words.length < 2 || words[0] === words[1], 'Tên chỉ có 1 từ');
      const phrase = `${words[1]} ${words[0]}`;
      await searchFor(page, cfg, phrase);
      for (const t of await rowTexts(page)) expect(fold(t), `cụm "${phrase}" phải khớp liền, không tách từ`).toContain(fold(phrase));
    });
    test(tc(`${P}-L33`), async ({ page }) => {
      await openList(page, cfg);
      for (const ch of ['%', '_', "'"]) {
        await searchFor(page, cfg, ch);
        const body = (await page.locator('body').innerText()).toLowerCase();
        expect(body).not.toMatch(/internal server error|exception|stack ?trace|syntax error/);
        for (const t of await rowTexts(page)) expect(t.toLowerCase(), `"${ch}" là ký tự thường: dòng phải chứa đúng ký tự này`).toContain(ch);
      }
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
  const tag = code8(), name = `qc.automation Xã ${tag}`;
  const r = await api('POST', 'communes', { name, ...(provinceId ? { provinceId } : {}) });
  if (r.status !== 200) throw new Error('Tạo xã lỗi: ' + r.message);
  made.addId('communes', r.data.id);
  return { code: r.data.code as string, id: r.data.id as string, name, tag };
}

// ================= EDGE / ERROR dùng chung (G01..G05) =================
/** Tên có ký tự đặc biệt + thẻ HTML. Hệ thống hiện CHẶN thẻ HTML trong tên ("Dữ liệu không được chứa thẻ HTML hoặc script"). */
export const SPECIAL_NAME = `qc.automation Ngô Thị Ơ Ữ <b>in đậm</b> & "nháy" 'đơn' 100%`;
/** Tên có ký tự đặc biệt nhưng không có thẻ HTML (được phép lưu) — kiểm tra hiển thị nguyên văn, không render. */
export const SPECIAL_NAME_SAFE = `qc.automation Ngô Thị Ơ Ữ & "nháy" 'đơn' 100% <3 &lt;b&gt;`;
/** Thông báo chặn thẻ HTML trong dữ liệu nhập. */
export const HTML_BLOCKED = /không được chứa thẻ HTML hoặc script/i;
export type MkResult = { status: number; message: string; data?: any };
export interface EdgeOpts {
  P: string; cfg: PageCfg; made: Made;
  openAdd: (page: Page) => Promise<Locator>;
  submit: (d: Locator) => Promise<void>;
  /** điền các trường văn bản bắt buộc chỉ bằng khoảng trắng */
  fillBlank: (d: Locator) => Promise<void>;
  /** điền form hợp lệ (không bấm lưu). `tag` là chuỗi duy nhất phải nằm trong Tên (Người dùng: tag = tên đăng nhập). Mã do hệ thống tự sinh nên form không còn ô Mã. */
  fillValid: (page: Page, d: Locator, tag: string) => Promise<void>;
  /** tạo bản ghi qua API với tên cho trước → trả mã (thật, do hệ thống sinh; Người dùng: tên đăng nhập) để tìm trên danh sách */
  makeNamed: (name: string) => Promise<string>;
  /** [API] tạo với tên rỗng; bỏ qua nếu page đã có testcase riêng */
  apiEmpty?: () => Promise<{ status: number; message: string }>;
  /** [API] tạo bản ghi với mã (tên đăng nhập với Người dùng) và tên (Họ tên) bất kỳ; `parent` 'A'/'B' = hai cha khác nhau (chỉ page có cha: Xã → Tỉnh, Đơn vị → Đơn vị cha). Nên trả `data` (bản ghi tạo được) để dọn theo id / đọc mã tự sinh. */
  mk?: (code: string, name: string, parent?: 'A' | 'B') => Promise<MkResult>;
  hasParent?: boolean;
  /** Mẫu mã tự sinh (vd /^TINH-\d{3,}$/) → G07–G09 kiểm tra hành vi mã tự sinh thay cho quy tắc nhập mã */
  autoCode?: RegExp;
}
/** Thông báo trùng mã theo quy tắc chung: "Mã [ABC] đã tồn tại. Vui lòng nhập mã khác." */
export const DUP_CODE = /Mã \[?.+?\]? đã tồn tại\. Vui lòng nhập mã khác\./;
export function registerEdgeTests(o: EdgeOpts) {
  const { P, cfg, made } = o;
  const isUser = cfg.res === 'idm/users';
  /** các bản ghi được tạo từ form với tag (Người dùng: userName = tag; trang khác: tên chứa tag) */
  const byTag = async (tag: string) => (await listApi(cfg.res, tag)).filter((x: any) => isUser ? x.userName === tag : String(x.name ?? '').includes(tag));
  const track = (tag: string) => isUser ? made.add(cfg.res, tag, 'userName') : made.add(cfg.res, tag, 'nameHas');
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
      // (1) Tên chứa thẻ HTML bị chặn phía server (thay đổi có chủ đích: "Dữ liệu không được chứa thẻ HTML hoặc script")
      if (o.mk) {
        const k = isUser ? code8().toLowerCase() : code8();
        if (isUser) made.add(cfg.res, k, 'userName');
        const r = await o.mk(k, SPECIAL_NAME);
        if (r.data?.id) made.addId(cfg.res, r.data.id);
        expect(r.status, `tên chứa thẻ HTML phải bị từ chối (HTTP ${r.status}: ${r.message})`).toBe(400);
        expect(r.message).toMatch(HTML_BLOCKED);
      }
      // (2) Tên có dấu, nháy, &, %, "<" không phải thẻ → lưu & hiển thị nguyên văn sau F5, không render HTML
      // thêm mã ngẫu nhiên để không trùng tên với dữ liệu cũ còn sót (tên trùng bị từ chối)
      const safeName = `${SPECIAL_NAME_SAFE} ${code8()}`;
      if (!isUser) made.add(cfg.res, safeName, 'nameHas');
      const code = await o.makeNamed(safeName);
      await openList(page, cfg); await page.reload(); await waitList(page);
      const row = await findRow(page, cfg, code);
      expect((await row.first().innerText()).replace(/\s+/g, ' ')).toContain(safeName);
      expect(await row.first().locator('b').count(), 'HTML trong tên phải hiển thị dạng chữ, không được render').toBe(0);
    });
    if (o.apiEmpty) test(tc(`${P}-G03`), async () => {
      const r = await o.apiEmpty!();
      expect(r.status, `tên rỗng qua API (HTTP ${r.status}: ${r.message})`).toBe(400);
    });
    test(tc(`${P}-G06`), async ({ page }) => {
      const tag = track(isUser ? code8().toLowerCase() : code8());
      const d = await o.openAdd(page); await o.fillValid(page, d, tag);
      // 2 lần bấm gần như đồng thời; lần nào không bấm được (nút đang tải/đã đóng form) thì bỏ qua
      await Promise.race([Promise.all([o.submit(d).catch(() => {}), o.submit(d).catch(() => {})]), page.waitForTimeout(4000)]);
      await page.waitForTimeout(2500);
      expect((await byTag(tag)).length, 'bấm Lưu 2 lần chỉ được tạo đúng 1 bản ghi').toBe(1);
    });
    if (o.mk) registerCodeNameRules({ P, cfg, made, mk: o.mk, hasParent: o.hasParent, autoCode: o.autoCode });
    for (const [id, mode] of [[`${P}-G04`, 'http500'], [`${P}-G05`, 'offline']] as const) {
      test(tc(id), async ({ page }) => {
        const tag = track(isUser ? code8().toLowerCase() : code8());
        const d = await o.openAdd(page); await o.fillValid(page, d, tag);
        await page.route(new RegExp(`/api/v1/${cfg.res}$`), r => {
          if (r.request().method() !== 'POST') return r.continue();
          return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
        });
        await o.submit(d); await page.waitForTimeout(1500);
        await expect(d, 'form phải còn mở để người dùng thử lại').toBeVisible();
        const body = (await page.locator('body').innerText()).toLowerCase();
        expect(body).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
        expect(await d.locator('input:not([disabled]):not([role=combobox]):not([type=search])').first().inputValue(), 'dữ liệu đã nhập không được mất').not.toBe('');
        await page.unroute(new RegExp(`/api/v1/${cfg.res}$`));
        expect(await byTag(tag)).toHaveLength(0);
      });
    }
  });
}

export interface RuleOpts {
  P: string; cfg: PageCfg; made: Made; hasParent?: boolean; nameMax?: number;
  /** [API] tạo bản ghi với mã (tên đăng nhập với Người dùng) và tên (Họ tên) bất kỳ; `parent` 'A'/'B' = hai nhóm cha khác nhau. Trả `data` (nếu có) → tự dọn theo id. */
  mk: (code: string, name: string, parent?: 'A' | 'B') => Promise<MkResult>;
  /** Mẫu mã do hệ thống tự sinh. Có giá trị → G07–G09 kiểm tra: mã client gửi bị bỏ qua, mã sinh đúng mẫu, không trùng (thay cho quy tắc nhập mã ≤50, ký tự hợp lệ, bắt trùng). */
  autoCode?: RegExp;
}
/** Quy tắc chung Mã/Tên (API): Mã ≤ 50 ký tự, ký tự hợp lệ, trùng mã không phân biệt hoa/thường; Tên ≤ nameMax, trùng tên chỉ trong cùng nhóm cha (không phân biệt hoa/thường, có phân biệt dấu). */
export function registerCodeNameRules(o: RuleOpts) {
  const { P, cfg, made } = o; const nameMax = o.nameMax ?? 255;
  const mk = async (code: string, name: string, parent?: 'A' | 'B') => {
    const r = await o.mk(code, name, parent);
    if (r.data?.id) made.addId(cfg.res, r.data.id);
    return r;
  };
  // uid() chỉ khác nhau theo mili-giây → thêm bộ đếm để các mã tạo liên tiếp trong 1 test không trùng nhau
  let seq = 0; const code8 = () => (uid() + (seq++).toString(36)).toUpperCase(); const uname = () => code8().toLowerCase();
  test.describe(`${cfg.name} › Quy tắc chung Mã/Tên`, () => {
    test.describe.configure({ timeout: 60_000 });
    needWrite();
    {
      const isUser = cfg.res === 'idm/users';
      const nameOf = () => `qc.automation Trùng ${code8()}`;
      const auto = !isUser ? o.autoCode : undefined;
      /** mã thật của bản ghi vừa tạo (response hoặc tra lại theo tên) */
      const codeOf = async (r: MkResult, name: string) => r.data?.code ?? (await listApi(cfg.res, name)).find((x: any) => x.name === name)?.code;
      if (auto) {
        test(tc(`${P}-G07`), async () => {
          const sent = code8() + 'A'.repeat(45), name = nameOf();
          made.add(cfg.res, name, 'nameHas');
          const r = await mk(sent, name);
          expect(r.status, `tạo bản ghi (gửi kèm mã ${sent.length} ký tự) phải thành công vì mã do hệ thống tự sinh (HTTP ${r.status}: ${r.message})`).toBe(200);
          const got = await codeOf(r, name);
          expect(got, 'mã client gửi phải bị bỏ qua').not.toBe(sent);
          expect(got, `mã tự sinh đúng mẫu ${auto}`).toMatch(auto);
          expect(got.length, 'mã tự sinh ≤ 50 ký tự').toBeLessThanOrEqual(50);
        });
        test(tc(`${P}-G08`), async () => {
          const bad: string[] = [];
          for (const sent of ['QC AUTO ' + code8(), 'Mã' + code8(), code8() + '@#', code8() + 'é']) {
            const name = nameOf(); made.add(cfg.res, name, 'nameHas');
            const r = await mk(sent, name);
            const got = r.status === 200 ? await codeOf(r, name) : undefined;
            if (r.status !== 200 || !auto.test(String(got)) || got === sent) bad.push(`gửi "${sent}" → HTTP ${r.status} "${r.message}", mã lưu "${got}"`);
          }
          expect(bad, `mã client chứa khoảng trắng/dấu/ký tự đặc biệt phải bị bỏ qua, mã lưu là mã tự sinh đúng mẫu ${auto}: ` + bad.join('; ')).toEqual([]);
        });
        test(tc(`${P}-G09`), async () => {
          const codes: string[] = [];
          for (let i = 0; i < 3; i++) {
            const name = nameOf(); made.add(cfg.res, name, 'nameHas');
            const r = await mk('QCADUP', name);
            expect(r.status, `lần ${i + 1}: gửi cùng một mã "QCADUP" vẫn phải tạo được (HTTP ${r.status}: ${r.message})`).toBe(200);
            codes.push(String(await codeOf(r, name)));
          }
          for (const c of codes) expect(c).toMatch(auto);
          expect(new Set(codes.map(c => c.toUpperCase())).size, `mã tự sinh không được trùng: ${codes.join(', ')}`).toBe(3);
          for (const c of codes) expect((await listApi(cfg.res, c)).filter((x: any) => String(x.code).toUpperCase() === c.toUpperCase()), `mã ${c} là duy nhất trong danh mục`).toHaveLength(1);
        });
      }
      if (!auto) test(tc(`${P}-G07`), async () => {
        const code = isUser ? uname() + 'a'.repeat(45) : code8() + 'A'.repeat(45);
        expect(code.length).toBeGreaterThan(50);
        made.add(cfg.res, code, isUser ? 'userName' : 'code');
        const r = await mk(code, nameOf());
        expect(r.status, `${isUser ? 'Tên đăng nhập' : 'Mã'} ${code.length} ký tự phải bị từ chối (HTTP ${r.status}: ${r.message})`).toBe(400);
        expect(r.message).toMatch(/(không vượt quá|tối đa) 50/i);
      });
      if (!isUser && !auto) test(tc(`${P}-G08`), async () => {
        const bad: string[] = [];
        for (const code of ['QC AUTO ' + code8(), 'Mã' + code8(), code8() + '@#', code8() + 'é']) {
          made.add(cfg.res, code);
          const r = await mk(code, nameOf());
          if (r.status < 400) bad.push(`"${code}" → HTTP ${r.status}`);
        }
        expect(bad, 'mã chỉ gồm A–Z, 0–9, - _ . (không khoảng trắng, không dấu): ' + bad.join('; ')).toEqual([]);
      });
      if (!isUser && !auto) test(tc(`${P}-G09`), async () => {
        const code = code8(); made.add(cfg.res, code);
        expect((await mk(code, nameOf())).status).toBe(200);
        const bad: string[] = [];
        for (const c of [code, code.toLowerCase(), code.toUpperCase()]) {
          const r = await mk(c, nameOf());
          if (r.status < 400 || !DUP_CODE.test(r.message)) bad.push(`"${c}" → HTTP ${r.status} "${r.message}"`);
        }
        expect(bad, 'mã trùng (không phân biệt hoa/thường) phải báo "Mã [ABC] đã tồn tại. Vui lòng nhập mã khác.": ' + bad.join('; ')).toEqual([]);
      });
      test(tc(`${P}-G10`), async () => {
        const c1 = code8(), c2 = code8(); made.add(cfg.res, c1, isUser ? 'userName' : 'code'); made.add(cfg.res, c2, isUser ? 'userName' : 'code');
        if (isUser) { made.add(cfg.res, c1.toLowerCase(), 'userName'); made.add(cfg.res, c2.toLowerCase(), 'userName'); }
        if (!isUser) { made.add(cfg.res, c1, 'nameHas'); made.add(cfg.res, c2, 'nameHas'); }
        // tên chứa mã ngẫu nhiên → không trùng dữ liệu cũ (tên trùng bị từ chối, không phải do độ dài)
        const ok = await mk(isUser ? c1.toLowerCase() : c1, `qc.automation ${c1} ` + 'b'.repeat(nameMax - 15 - c1.length));
        expect(ok.status, `tên đúng ${nameMax} ký tự phải được nhận (HTTP ${ok.status}: ${ok.message})`).toBe(200);
        const r = await mk(isUser ? c2.toLowerCase() : c2, `qc.automation ${c2} ` + 'a'.repeat(nameMax - 14 - c2.length));
        expect(r.status, `tên ${nameMax + 1} ký tự phải bị từ chối (HTTP ${r.status}: ${r.message})`).toBe(400);
        expect(r.message).toMatch(new RegExp(`(không vượt quá|tối đa) ${nameMax}`, 'i'));
      });
      if (isUser) test(tc(`${P}-G11`), async () => {
        const name = nameOf(); const a = uname(), b = uname(); made.add(cfg.res, a, 'userName'); made.add(cfg.res, b, 'userName');
        expect((await mk(a, name)).status).toBe(200);
        const r = await mk(b, name);
        expect(r.status, `Họ tên không bắt trùng (HTTP ${r.status}: ${r.message})`).toBe(200);
      });
      if (!isUser) {
        test(tc(`${P}-G11`), async () => {
          const name = nameOf(); const a = code8(), b = code8(), c = code8(); [a, b, c].forEach(x => made.add(cfg.res, x));
          made.add(cfg.res, name, 'nameHas');
          expect((await mk(a, name, 'A')).status).toBe(200);
          const bad: string[] = [];
          for (const [code, n] of [[b, name], [c, name.toUpperCase()]] as const) { const r = await mk(code, n, 'A'); if (r.status < 400) bad.push(`"${n}" → HTTP ${r.status}`); }
          expect(bad, 'tên trùng trong cùng nhóm cha (không phân biệt hoa/thường) phải bị chặn: ' + bad.join('; ')).toEqual([]);
        });
        test(tc(`${P}-G12`), async () => {
          const name = nameOf(); const a = code8(), b = code8(); [a, b].forEach(x => made.add(cfg.res, x));
          const n2 = name.replace('Trùng', 'Trung'); made.add(cfg.res, name, 'nameHas'); made.add(cfg.res, n2, 'nameHas');
          expect((await mk(a, name, 'A')).status).toBe(200);
          const r = await mk(b, n2, 'A');
          expect(r.status, `tên chỉ khác dấu là tên khác, phải được nhận (HTTP ${r.status}: ${r.message})`).toBe(200);
        });
        if (o.hasParent) test(tc(`${P}-G13`), async () => {
          const name = nameOf(); const a = code8(), b = code8(); [a, b].forEach(x => made.add(cfg.res, x));
          made.add(cfg.res, name, 'nameHas');
          expect((await mk(a, name, 'A')).status).toBe(200);
          const r = await mk(b, name, 'B');
          expect(r.status, `tên trùng nhưng khác nhóm cha phải được nhận (HTTP ${r.status}: ${r.message})`).toBe(200);
        });
      }
    }
  });
}

/** Mã tự sinh trên giao diện (thay cho testcase "Trùng mã bị từ chối"): form Thêm mới không có ô Mã; bản ghi tạo từ form nhận mã tự sinh đúng mẫu,
 *  khác mã bản ghi đã có (không trùng); form Cập nhật hiển thị mã ở ô bị khóa (disabled). */
export async function checkAutoCodeUI(page: Page, cfg: PageCfg, made: Made, o: {
  openAdd: (page: Page) => Promise<Locator>; fillValid: (page: Page, d: Locator, tag: string) => Promise<void>; submit: (d: Locator) => Promise<void>;
  existing: { code: string };
}) {
  const pattern = AUTO_CODE[cfg.res];
  const tag = made.add(cfg.res, code8(), 'nameHas');
  const d = await o.openAdd(page);
  const codeItems = d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: /^\s*Mã\b/ }) });
  expect(await codeItems.count(), 'form Thêm mới không còn ô Mã (mã do hệ thống tự sinh)').toBe(0);
  await o.fillValid(page, d, tag); await o.submit(d);
  expect(await toast(page)).toMatch(/thành công/i);
  const rec = await findByName(cfg.res, tag);
  expect(rec, 'bản ghi được tạo').toBeTruthy();
  made.addId(cfg.res, rec.id);
  expect(rec.code, `mã tự sinh đúng mẫu ${pattern}`).toMatch(pattern);
  expect(rec.code, 'mã tự sinh không trùng mã đã có').not.toBe(o.existing.code);
  expect((await listApi(cfg.res, rec.code)).filter((x: any) => String(x.code).toUpperCase() === rec.code.toUpperCase()), `mã ${rec.code} là duy nhất`).toHaveLength(1);
  // form Cập nhật: giao diện mới không còn ô Mã; nếu có thì phải hiển thị mã tự sinh và bị khóa
  await openList(page, cfg);
  await rowAction(page, await findRow(page, cfg, rec.code), /cập nhật/i);
  const e = dlg(page); await e.waitFor({ state: 'visible' }); await page.waitForTimeout(600);
  const inp = e.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: /^\s*Mã\b/ }) }).locator('input').first();
  if (await inp.count()) {
    await expect(inp, 'ô Mã ở form Cập nhật hiển thị mã tự sinh').toHaveValue(rec.code);
    await expect(inp, 'ô Mã ở form Cập nhật không sửa được').toBeDisabled();
  }
  return rec;
}
/** [API] Sửa bản ghi kèm `code` khác → mã không đổi (PUT bỏ qua mã client gửi). `get` = bản ghi hiện tại (GET theo id). */
export async function checkCodeImmutableApi(res: string, id: string, body: any = {}) {
  const cur = (await api('GET', `${res}/${id}`)).data;
  const r = await api('PUT', `${res}/${id}`, { ...cur, ...body, code: 'QCAHACK' + Date.now().toString(36).toUpperCase() });
  const after = (await api('GET', `${res}/${id}`)).data;
  return { put: r, before: cur?.code as string, after: after?.code as string };
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
