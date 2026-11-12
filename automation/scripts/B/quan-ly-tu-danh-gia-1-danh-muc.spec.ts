// B.III.1 QUẢN LÝ TỰ ĐÁNH GIÁ › DANH MỤC — script bám testcase CMP-L/V/C/E/D/G/S/P (testcases/docs/catalog.json)
// Mỗi test chạy UI bằng tài khoản TÁC NHÂN trong catalog (admin/lanhdaobo); dữ liệu nền & dọn dẹp qua API superadmin.
// Kỳ đã trình/duyệt/từ chối KHÔNG xóa được → dùng kỳ "fixture" tạo một lần (tên cố định, tái sử dụng), kỳ Nháp xóa sau mỗi test.
import { Page, Locator, Browser } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  test, expect, tc, needWrite, dataRows, waitList, totalOf, dlg, btnCancel, btnSave, toast, rowMenuItems, confirmYes, confirmNo,
  api, tokenOf, goto, apiStatus, code8,
} from './common';

const R = 'dti/self-assessment-campaigns', ROUTE = 'self-assessment-campaigns', NAME = 'qc.automation CMP1';
const FAKE = '00000000-0000-4000-8000-000000000000';
const LBL: Record<string, string> = { Draft: 'Nháp', Submitted: 'Chờ phê duyệt', Approved: 'Đã phê duyệt', Rejected: 'Bị từ chối' };
const TAB: Record<string, string> = { Periodic: 'Định kỳ', AdHoc: 'Đột xuất' };
const FORB = /không có quyền/i;
const pad = (n: number) => String(n).padStart(2, '0');
const rid = () => code8() + Math.random().toString(36).slice(2, 4);
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const iso = (d: Date, end = false) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${end ? '23:59:59' : '00:00:00'}`;
const dmy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------- Dữ liệu nền qua API ----------
const _memo: Record<string, Promise<any>> = {};
const memo = <T>(k: string, f: () => Promise<T>): Promise<T> => (_memo[k] ??= f());
async function pages(res: string, size = 100, as = 'admin'): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 30; p++) {
    const r = await api('GET', `${res}${res.includes('?') ? '&' : '?'}page=${p}&size=${size}`, undefined, as);
    out.push(...(r.data?.content ?? []));
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return out;
}
const lockedSets = () => memo('sets', async () => (await pages('dti/indicator-sets')).filter(s => s.status === 'Locked'));
const draftSets = async () => (await pages('dti/indicator-sets')).filter(s => s.status === 'Draft');
/** Bộ chỉ số nhỏ (BCS-001) để tạo kỳ; MBCS_QC01 (4 nhóm/120 chỉ số) cho test nhân bản/hiệu năng. */
const smallSet = () => memo('small', async () => (await lockedSets()).find(s => s.code === 'BCS-001') ?? (await lockedSets())[0]);
const bigSet = () => memo('big', async () => (await lockedSets()).find(s => s.code === 'MBCS_QC01'));
const scales = () => memo('scales', async () => (await pages('dti/score-scales')));
const scaleId = async (code = 'TXL-001') => (await scales()).find(s => s.code === code)?.id;
const orgDp = () => memo('org', async () => {
  const r = await api('GET', `organizations?page=1&size=20&filter=${encodeURIComponent(JSON.stringify({ keyword: 'QC_DP' }))}`);
  return (r.data.content as any[]).find(o => o.code === 'QC_DP');
});
const allCamps = () => pages(R);
const byName = async (name: string) => (await allCamps()).find(c => c.name === name);
const getCamp = async (id: string, as = 'admin') => (await api('GET', `${R}/${id}`, undefined, as)).data;

/** Kỳ Nháp tự tạo (xóa sau test nếu còn Nháp). */
const draftIds: string[] = [];
test.afterEach(async () => {
  for (const id of draftIds.splice(0)) {
    const c = await getCamp(id).catch(() => null);
    if (c?.status === 'Draft') await api('DELETE', `${R}/${id}`);
  }
});
async function body(o: any = {}) {
  const v = (k: string, d: any) => (k in o ? o[k] : d);   // truyền null = cố ý gửi null
  const type = v('type', 'AdHoc');
  const b: any = { name: v('name', `${NAME} ${rid()}`), type, indicatorSetId: v('setId', (await smallSet()).id), scaleId: v('scaleId', await scaleId()), reminderDaysBeforeDue: o.remind };
  if (type === 'AdHoc') { b.startDate = v('start', iso(inDays(1))); b.endDate = v('end', iso(inDays(30), true)); }
  else b.periodType = v('periodType', 'Quarter');
  return { ...b, ...(o.extra ?? {}) };
}
async function mk(o: any = {}) {
  const r = await api('POST', R, await body(o), o.as);
  if (r.status !== 200) throw new Error(`tạo kỳ lỗi ${r.status} ${r.message}`);
  draftIds.push(r.data.id); return r.data;
}
async function mkAssigned(o: any = {}) {
  const c = await mk(o);
  const a = await api('PUT', `${R}/${c.id}/organizations`, [(await orgDp()).id]);
  if (a.status !== 200) throw new Error(`phân công lỗi ${a.status} ${a.message}`);
  return c;
}
const act = (id: string, what: 'submit' | 'approve' | 'reject', as: string, b: any = {}) => api('POST', `${R}/${id}/${what}`, what === 'reject' ? { reason: 'qc.automation fixture', ...b } : b, as);

const LEGACY: Record<string, string[]> = {
  'Approved/AdHoc': ['qc.automation CMP flow A'], 'Approved/Periodic': ['qc.automation CMP flow P'], 'Rejected/AdHoc': ['qc.automation CMP flow R'],
};
/** Kỳ fixture ở trạng thái state/type: dùng lại nếu đã có (kể cả kỳ thăm dò cũ), chưa có mới tạo (đơn vị QA - Địa phương). */
function fixture(state: 'Submitted' | 'Approved' | 'Rejected', type: 'AdHoc' | 'Periodic'): Promise<any> {
  return memo(`fx/${state}/${type}`, async () => {
    const names = [`${NAME} fixture ${state} ${type}`, ...(LEGACY[`${state}/${type}`] ?? [])];
    const all = await allCamps();
    for (const n of names) { const c = all.find(x => x.name.startsWith(n) && x.status === state && x.type === type); if (c) return c; }
    needWrite();
    // kỳ fixture cùng tên có thể đã bị các test khác chuyển sang trạng thái khác (Duyệt/Trình lại) → tên cũ bị trùng, tạo bản mới với hậu tố
    const name = all.some(x => x.name === names[0]) ? `${names[0]} ${Date.now().toString(36).slice(-5)}` : names[0];
    const r = await api('POST', R, await body({ name, type }));
    if (r.status !== 200) throw new Error(`tạo fixture lỗi ${r.status} ${r.message}`);
    const id = r.data.id;
    await api('PUT', `${R}/${id}/organizations`, [(await orgDp()).id]);
    const s = await act(id, 'submit', 'canbo'); if (s.status !== 200) throw new Error(`trình fixture lỗi ${s.status} ${s.message}`);
    if (state === 'Approved') await act(id, 'approve', 'lanhdaobo'); else if (state === 'Rejected') await act(id, 'reject', 'lanhdaobo');
    return getCamp(id);
  });
}
/** Kỳ Đã phê duyệt có nhiều đơn vị (chỉ đọc). */
const bigApproved = () => memo('bigAp', async () => {
  const all = (await allCamps()).filter(c => c.status === 'Approved' && c.childrenCount >= 2);
  return all.find(c => c.name === 'qc.automation RES1 fixture BA') ?? all.sort((a, b) => b.childrenCount - a.childrenCount)[0];
});
/** Kỳ có > 10 đơn vị (chỉ đọc, mọi trạng thái). */
const manyOrgs = () => memo('many', async () => (await allCamps()).sort((a, b) => b.childrenCount - a.childrenCount)[0]);

// ---------- UI ----------
const clickTab = async (page: Page, t: string) => { await page.locator('label').filter({ hasText: new RegExp(`^\\s*${t}\\s*$`) }).first().click(); await waitList(page); };
async function openList(page: Page, tab = 'Định kỳ') {
  const same = page.url().endsWith(`/${ROUTE}`);   // goto cùng hash không tải lại → nạp lại để về trạng thái ban đầu
  await goto(page, ROUTE);
  if (same) await page.reload({ waitUntil: 'networkidle' });
  await dataRows(page).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  await clickTab(page, tab);
}
const searchBox = (page: Page) => page.getByPlaceholder(/tìm kiếm tên đánh giá/i);
const search = async (page: Page, kw: string) => { await searchBox(page).fill(kw); await waitList(page); };
/** Mở danh sách đúng tab, tìm kỳ rồi trả dòng. */
async function findRow(page: Page, c: { type: string; name: string }, kw?: string): Promise<Locator> {
  await openList(page, TAB[c.type]);
  await search(page, kw ?? c.name);
  return dataRows(page).filter({ hasText: kw ?? c.name }).first();
}
const cells = async (row: Locator) => (await row.locator('td').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
async function menuOf(page: Page, row: Locator): Promise<string[]> {
  if (!(await row.locator('button.ant-dropdown-trigger').count())) return [];
  return rowMenuItems(page, row);
}
const pick = async (page: Page, row: Locator, re: RegExp) => {
  await row.locator('button.ant-dropdown-trigger').first().click();
  const it = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: re }).first();
  await it.waitFor({ state: 'visible' }); await it.click(); await page.waitForTimeout(800);
};
const main = (page: Page) => page.locator('main, .ant-layout-content').last();
/** Mở chi tiết và chờ dữ liệu nạp xong (đổi id chỉ bằng hash đôi khi không nạp lại → tải lại trang). */
async function openDetail(page: Page, id: string) {
  const loaded = () => page.getByText(/TDG-\d{4}-/).first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false);
  await goto(page, `${ROUTE}/${id}`);
  if (!(await loaded())) { await page.reload({ waitUntil: 'networkidle' }); await loaded(); }
  await page.waitForTimeout(500);
}
const btn = (page: Page, re: RegExp) => main(page).getByRole('button', { name: re });
const text = async (l: Locator) => (await l.innerText()).replace(/[ \t]+/g, ' ');
const anyToast = (page: Page) => page.locator('.ant-message-notice, .ant-notification-notice');
async function toasts(page: Page, wait = 1500) { await page.waitForTimeout(wait); return (await anyToast(page).allInnerTexts()).join(' | '); }

// ---------- Form thêm/sửa ----------
const formDlg = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('input#name') });
const formItem = (d: Locator, re: RegExp) => d.locator('.ant-form-item').filter({ hasText: re });
async function selectIn(page: Page, d: Locator, label: RegExp, opt: string | RegExp) {
  await formItem(d, label).locator('.ant-select').first().click();
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.waitFor({ state: 'visible' });
  if (typeof opt === 'string') await page.keyboard.type(opt.slice(0, 20)).catch(() => {});
  await page.waitForTimeout(500);
  await dd.locator('.ant-select-item-option', { hasText: opt }).first().click();
  await page.waitForTimeout(400);
}
async function setDate(page: Page, d: Locator, id: 'startDate' | 'endDate', v: string) {
  const i = d.locator(`input#${id}`); await i.click(); await i.fill(v); await i.press('Enter'); await page.waitForTimeout(300);
}
interface F { name?: string; type?: 'Định kỳ' | 'Đột xuất'; set?: string; period?: string; start?: string; end?: string; remind?: string; scale?: string }
async function fill(page: Page, d: Locator, f: F) {
  if (f.name !== undefined) await d.locator('input#name').fill(f.name);
  if (f.type) await selectIn(page, d, /phân loại/i, f.type);
  if (f.set) await selectIn(page, d, /bộ chỉ số/i, f.set);
  if (f.period) await selectIn(page, d, /^\s*kỳ\b/i, f.period);
  if (f.start) await setDate(page, d, 'startDate', f.start);
  if (f.end) await setDate(page, d, 'endDate', f.end);
  if (f.remind) await d.locator('input#reminderDaysBeforeDue').fill(f.remind);
  if (f.scale) await selectIn(page, d, /thang xếp loại/i, f.scale);
}
async function openAdd(page: Page, tab = 'Định kỳ') {
  await openList(page, tab);
  await page.getByRole('button', { name: /thêm mới tự đánh giá/i }).first().click();
  const d = formDlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator, timeout = 30_000) => d.locator('button', { hasText: /^\s*Thêm mới tự đánh giá\s*$/ }).last().click({ timeout });
async function openEdit(page: Page, c: { type: string; name: string }, kw?: string) {
  const row = await findRow(page, c, kw);
  await pick(page, row, /cập nhật/i);
  const d = formDlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
}
const errs = async (d: Locator) => (await d.locator('.ant-form-item-explain-error').allInnerTexts()).map(s => s.trim());
/** Form thêm hợp lệ (Đột xuất, bộ chỉ số nhỏ, thang mặc định). */
async function fillValid(page: Page, d: Locator, name: string, over: F = {}) {
  const s = await smallSet();
  await fill(page, d, { name, type: 'Đột xuất', set: s.name, start: dmy(inDays(3)), end: dmy(inDays(20)), scale: 'TXL-001', ...over });
}
/** Tìm kỳ theo tên rồi đăng ký dọn (Nháp) — dùng sau khi UI tạo. */
async function track(name: string) { const c = await byName(name); if (c) draftIds.push(c.id); return c; }
const adminName = () => JSON.parse(Buffer.from(tokenOf('admin').split('.')[1], 'base64').toString())['x-fullName'] as string;

// ================= DANH SÁCH =================
test.describe('Quản lý tự đánh giá › Danh sách / Tìm kiếm / Phân trang', () => {
  test.describe.configure({ timeout: 60_000 });
  const UNKNOWN = 'zzqcxx_khongtontai_999';
  const nameAt = async (page: Page, i = 0) => (await cells(dataRows(page).nth(i)))[1];

  test(tc('CMP-L05'), async ({ page }) => {
    await openList(page);
    await search(page, UNKNOWN);
    expect(await dataRows(page).count()).toBe(0);
    await expect(page.locator('.ant-empty, .ant-table-placeholder').first()).toBeVisible();
  });
  test(tc('CMP-L06'), async ({ page }) => {
    await openList(page);
    await search(page, 'QC.AUTOMATION'); const a = await totalOf(page);
    await search(page, 'qc.automation'); const b = await totalOf(page);
    expect(a, 'từ khóa HOA phải có kết quả').toBeGreaterThan(0);
    expect(b, 'HOA/thường phải cho cùng số kết quả').toBe(a);
  });
  test(tc('CMP-L07'), async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', d => { dialogSeen = true; d.dismiss().catch(() => {}); });
    await openList(page);
    for (const bad of ["' OR 1=1 --", '<script>alert(1)</script>', '"; DROP TABLE users; --']) {
      await search(page, bad);
      expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/internal server error|exception|stack ?trace|sqlexception|syntax error/);
      for (const t of await dataRows(page).allInnerTexts()) expect(t.toLowerCase(), `"${bad}" khớp bản ghi không chứa chuỗi này`).toContain(bad.toLowerCase());
    }
    expect(dialogSeen, 'không được thực thi script (XSS)').toBeFalsy();
  });
  test(tc('CMP-L08'), async ({ page }) => {
    await openList(page);
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    const before = (await dataRows(page).allInnerTexts()).join('|');
    await page.locator('.ant-pagination-item-2').first().click(); await waitList(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    expect((await dataRows(page).allInnerTexts()).join('|')).not.toBe(before);
  });
  test(tc('CMP-L09'), async ({ page }) => {
    await openList(page);
    const n = await totalOf(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await page.locator('.ant-pagination-options .ant-select').first().click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: '20' }).first().click(); await waitList(page);
    expect(await dataRows(page).count()).toBe(Math.min(20, n));
    expect(await totalOf(page)).toBe(n);
  });
  test(tc('CMP-L10'), async ({ page }) => {
    await openList(page);
    await search(page, UNKNOWN);
    expect(await totalOf(page)).toBe(0);
    await search(page, '');
    const api1 = (await api('GET', `${R}?page=1&size=1&filter=${encodeURIComponent(JSON.stringify({ type: 'Periodic' }))}`)).data.totalElements;
    expect(await totalOf(page), 'xóa từ khóa phải trở về đầy đủ (bằng tổng API cùng thời điểm)').toBe(api1);
  });
  test(tc('CMP-L13'), async ({ page }) => {
    const per = await fixture('Approved', 'Periodic');
    const reqs: string[] = [];
    page.on('request', r => { if (r.url().includes(`/api/v1/${R}?`)) reqs.push(decodeURIComponent(r.url())); });
    await openList(page, 'Đột xuất');
    await search(page, per.name);
    expect(await dataRows(page).count(), 'kỳ Định kỳ không được lẫn vào tab Đột xuất').toBe(0);
    expect(reqs.some(u => u.includes('"type":"AdHoc"') && u.includes('keyword'))).toBeTruthy();
  });
  test(tc('CMP-L14'), async ({ page }) => {
    needWrite();
    const k = rid(), c = await mk({ name: `${NAME} Kỳ đánh giá ${k}` });
    await openList(page, 'Đột xuất');
    await search(page, `ky danh gia ${k}`);
    expect(await dataRows(page).filter({ hasText: c.name }).count(), 'tìm không dấu "ky danh gia" phải ra kỳ "Kỳ đánh giá"').toBeGreaterThan(0);
  });
  test(tc('CMP-L15'), async ({ page }) => {
    await openList(page);
    await search(page, '%');
    expect(await dataRows(page).count(), '"%" phải là ký tự thường, không khớp mọi tên').toBe(0);
    await search(page, '_');
    for (const t of await dataRows(page).all()) expect((await cells(t))[1], '"_" chỉ khớp tên có dấu gạch dưới').toContain('_');
  });
  test(tc('CMP-L16'), async ({ page }) => {
    await openList(page);
    await search(page, 'qc.automation CMP'); const a = await totalOf(page);
    await search(page, '   qc.automation CMP  '); const b = await totalOf(page);
    expect(a).toBeGreaterThan(0);
    expect(b, 'khoảng trắng đầu/cuối không được làm đổi kết quả').toBe(a);
  });
  test(tc('CMP-L19'), async ({ page }) => {
    needWrite();
    const s = await smallSet(), c = await mk({ name: `${NAME} L19 ${rid()}` });
    const row = await findRow(page, c);
    const col = (await cells(row))[2];
    expect(col).toContain(s.name);
    expect(col, 'không được hiển thị mã bản sao dạng X_xxxxxxxx').not.toMatch(/_[0-9a-f]{8}/i);
  });
  test(tc('CMP-L21'), async ({ page }) => {
    await openList(page);
    test.skip((await totalOf(page)) <= 10, 'Tab Định kỳ chỉ có 1 trang');
    await page.locator('.ant-pagination-item-2').first().click(); await waitList(page);
    await clickTab(page, 'Đột xuất');
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('1');
    const tot = (await api('GET', `${R}?page=1&size=1&filter=${encodeURIComponent(JSON.stringify({ type: 'AdHoc' }))}`)).data.totalElements;
    expect(await totalOf(page)).toBe(tot);
  });
  test(tc('CMP-L22'), async ({ page }) => {
    needWrite();
    const k = rid(), c = await mk({ name: (`${NAME} L22 ${k} ` + 'tên đánh giá rất dài '.repeat(20)).slice(0, 255) });   // tên thực tế dài 255 ký tự (có khoảng trắng, xuống dòng/cắt "…" được)
    await mk({ name: `${NAME} L22 ngắn ${k}` });
    await findRow(page, c, k);
    const longRow = dataRows(page).filter({ hasText: 'rất dài' }).first(), shortRow = dataRows(page).filter({ hasText: 'ngắn' }).first();
    await expect(longRow).toBeVisible(); await expect(shortRow).toBeVisible();
    const edge = async (r: Locator) => { const b = (await r.getByRole('button', { name: /xem chi tiết/i }).boundingBox())!; return b.x + b.width; };
    // so với dòng tên ngắn cùng bảng: tab Đột xuất vốn rộng hơn khung 1280 (thêm 2 cột ngày) nên không so với khung nhìn
    expect(await edge(longRow), 'nút Thao tác của dòng tên dài không được bị đẩy lệch so với dòng tên ngắn').toBeLessThanOrEqual((await edge(shortRow)) + 2);
    expect((await longRow.boundingBox())!.height, 'dòng không được giãn quá cao').toBeLessThan(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'trang không được tràn ngang').toBeTruthy();
  });
  for (const [id, type] of [['CMP-L23', 'Periodic'], ['CMP-L24', 'AdHoc']] as const) {
    test(tc(id), async ({ page }) => {
      const c = await fixture('Submitted', type);
      const row = await findRow(page, c);
      expect((await cells(row))[type === 'AdHoc' ? 7 : 5]).toBe('Chờ phê duyệt');
      const menu = await menuOf(page, row);
      expect(menu.filter(m => /cập nhật|xoá|xóa|trình/i.test(m)), `menu: ${menu}`).toEqual([]);
    });
  }
  test(tc('CMP-L25'), async () => {
    const r = await api('GET', `${R}?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ status: 'Submitted' }))}`);
    const rows = r.data.content as any[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter(x => x.status !== 'Submitted').map(x => x.name)).toEqual([]);
    expect(r.data.totalElements).toBe((await allCamps()).filter(c => c.status === 'Submitted').length);
  });
  for (const [id, type, st] of [['CMP-L26', 'Periodic', 5], ['CMP-L27', 'AdHoc', 7]] as const) {
    test(tc(id), async ({ page }) => {
      const c = await fixture('Submitted', type);
      const row = await findRow(page, c);
      expect(await row.count(), 'Lãnh đạo Bộ phải thấy kỳ Chờ phê duyệt').toBe(1);
      expect((await cells(row))[st]).toBe('Chờ phê duyệt');
      expect(await menuOf(page, row)).toEqual(['Phê duyệt', 'Từ chối']);
      if (id === 'CMP-L26') {
        await expect(page.getByRole('button', { name: /thêm mới tự đánh giá/i })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /xuất excel/i })).toHaveCount(0);
      }
    });
  }
  test(tc('CMP-L28'), async ({ page }) => {
    needWrite();
    const list = [await mk({ name: `${NAME} L28 ${rid()}` }), await fixture('Approved', 'AdHoc'), await fixture('Rejected', 'AdHoc')];
    for (const c of list) {
      const row = await findRow(page, c);
      if (!(await row.count())) { expect(c.status, 'chỉ kỳ Nháp mới được ẩn khỏi Lãnh đạo Bộ').toBe('Draft'); continue; }
      expect(await menuOf(page, row), `kỳ ${c.name}`).toEqual([]);
    }
  });
  test(tc('CMP-L30'), async ({ page }) => {
    await openList(page, 'Đột xuất');
    await search(page, UNKNOWN);
    expect(await dataRows(page).count()).toBe(0);
    await expect(page.locator('.ant-empty').first()).toContainText(/trống/i);
  });
  async function exportDl(page: Page) {
    const b = page.getByRole('button', { name: /xuất excel/i }).first();
    await expect(b).toBeVisible();
    const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await b.click(); return dl;
  }
  test(tc('CMP-L31'), async ({ page }) => {
    for (const tab of ['Định kỳ', 'Đột xuất']) {
      await openList(page, tab);
      const dl = await exportDl(page);
      expect(dl, `tab ${tab}: bấm "Xuất Excel" không tải về file nào`).not.toBeNull();
      expect(dl!.suggestedFilename()).toMatch(/\.xlsx?$/i);
    }
  });
  test(tc('CMP-L32'), async ({ page }) => {
    await openList(page);
    const kw = 'CMP flow';
    await search(page, kw);
    const dl = await exportDl(page);
    expect(dl, 'bấm "Xuất Excel" không tải về file nào').not.toBeNull();
    const f = path.join(os.tmpdir(), `cmp1-${rid()}.xlsx`); await dl!.saveAs(f);
    const strings = execFileSync('unzip', ['-p', f, 'xl/sharedStrings.xml']).toString();
    expect(strings.toLowerCase()).toContain(kw.toLowerCase());
    fs.rmSync(f, { force: true });
  });
});

// ================= CHI TIẾT =================
test.describe('Quản lý tự đánh giá › Chi tiết kỳ', () => {
  test.describe.configure({ timeout: 60_000 });
  const orgTable = (page: Page) => main(page).locator('tbody tr.ant-table-row');
  const num = (t: string, label: string) => Number(t.replace(/\s+/g, ' ').match(new RegExp(`${label}\\s*(\\d+)`))?.[1]);

  test(tc('CMP-V08'), async ({ page }) => {
    const r = await api('GET', `${R}/${FAKE}`);
    expect(r.status).toBe(404); expect(r.message).toMatch(/không tìm thấy kỳ tự đánh giá/i);
    await goto(page, `${ROUTE}/${FAKE}`);
    const t = (await page.locator('body').innerText()).toLowerCase();
    expect(t).not.toMatch(/stack ?trace|exception|at com\.|undefined|cannot read/);
    expect((await page.locator('#root, .ant-layout-content').first().innerText()).trim().length).toBeGreaterThan(0);
  });
  test(tc('CMP-V09'), async () => {
    const r = await api('GET', `${R}/abc`);
    expect(r.status, `GET /abc: HTTP ${r.status}`).toBe(404);
    expect(JSON.stringify(r.raw).toLowerCase()).not.toMatch(/stack ?trace|npgsql|exception/);
  });
  test(tc('CMP-V11'), async ({ page }) => {
    const c = await fixture('Submitted', 'AdHoc');
    await openDetail(page, c.id);
    await expect(btn(page, /^trình phê duyệt$/i)).toHaveCount(0); await expect(btn(page, /^phân công đơn vị$/i)).toHaveCount(0);
    expect(await text(main(page))).toContain('Chờ phê duyệt');
  });
});

// ================= THÊM MỚI =================
const apiHas = async (name: string) => (await allCamps()).filter(c => c.name === name).length;
const SUCCESS_ADD = /tạo kỳ tự đánh giá thành công/i;
test.describe('Quản lý tự đánh giá › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  const CREATE_ERR = ['Vui lòng nhập tên đợt đánh giá', 'Vui lòng chọn phân loại đánh giá', 'Vui lòng chọn bộ chỉ số', 'Vui lòng chọn ngày bắt đầu', 'Vui lòng chọn ngày kết thúc', 'Vui lòng chọn thang xếp loại'];
  /** Tạo kỳ Định kỳ qua UI với kỳ `period`; trả kỳ vừa tạo (đã đăng ký dọn). */
  async function createPeriodic(page: Page, period: string) {
    const name = `${NAME} ${period} ${rid()}`, d = await openAdd(page);
    await fill(page, d, { name, type: 'Định kỳ', set: (await smallSet()).name, period, scale: 'TXL-001' });
    await submitAdd(d);
    expect(await toasts(page)).toMatch(SUCCESS_ADD);
    return (await track(name))!;
  }
  /** Gửi form với một trường bị thiếu → báo đúng lỗi, form còn mở, không tạo kỳ. */
  async function missing(page: Page, over: F, msg: string) {
    needWrite();
    const name = `${NAME} miss ${rid()}`, d = await openAdd(page);
    await fillValid(page, d, name, over);
    await submitAdd(d); await page.waitForTimeout(800);
    const all = [...(await errs(d)), await toasts(page, 300)].join(' | ');
    expect(all, `phải báo "${msg}"`).toContain(msg);
    await expect(d).toBeVisible();
    expect(await apiHas(name), 'không được tạo kỳ').toBe(0);
  }

  test(tc('CMP-C06'), async ({ page }) => {
    const d = await openAdd(page);
    await selectIn(page, d, /phân loại/i, 'Định kỳ');
    await expect(formItem(d, /^\s*kỳ\b/i)).toBeVisible(); await expect(d.locator('input#startDate')).toHaveCount(0); await expect(d.locator('input#endDate')).toHaveCount(0);
    await selectIn(page, d, /phân loại/i, 'Đột xuất');
    await expect(d.locator('input#startDate')).toBeVisible(); await expect(d.locator('input#endDate')).toBeVisible(); await expect(formItem(d, /^\s*kỳ\b/i)).toHaveCount(0);
  });
  test(tc('CMP-C07'), async ({ page }) => {
    const d = await openAdd(page);
    await selectIn(page, d, /phân loại/i, 'Định kỳ');
    await formItem(d, /^\s*kỳ\b/i).locator('.ant-select').first().click();
    const opts = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').allInnerTexts();
    expect(opts.map(s => s.trim())).toEqual(['Kỳ - Tháng', 'Kỳ - Quý', 'Kỳ - Năm']);
  });
  test(tc('CMP-C16'), async () => {
    needWrite();
    const name = (`${NAME} C16 ${rid()} ` + 'a'.repeat(300)).slice(0, 255);
    const r = await api('POST', R, await body({ name }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status, r.message).toBe(200); expect(r.data.name.length).toBe(255); expect(r.data.name).toBe(name);
  });
  test(tc('CMP-C17'), async () => {
    needWrite();
    const name = (`${NAME} C17 ${rid()} ` + 'a'.repeat(301)).slice(0, 256);
    const r = await api('POST', R, await body({ name }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status).toBe(400); expect(r.message).toMatch(/không vượt quá 255/i);
  });
  test(tc('CMP-C18'), async ({ page }) => {
    const d = await openAdd(page);
    const inp = d.locator('input#name');
    await inp.fill('b'.repeat(310));
    const max = Number(await inp.getAttribute('maxlength'));
    const len = (await inp.inputValue()).length;
    expect(max, 'ô tên phải giới hạn độ dài').toBeGreaterThan(0);
    expect(len).toBe(Math.min(max, 310)); expect(len, 'Tên tối đa 255 ký tự').toBeLessThanOrEqual(255);
    expect(await toasts(page, 300)).not.toMatch(/500|lỗi hệ thống/i);
  });
  test(tc('CMP-C19'), async () => {
    needWrite();
    const r = await api('POST', R, await body({ name: '<script>alert(1)</script>' }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status).toBe(400); expect(r.message).toMatch(/không được chứa thẻ html hoặc script/i);
  });
  test(tc('CMP-C21'), async () => {
    needWrite();
    const name = `${NAME} C21 ${rid()}`;
    await mk({ name });
    const r = await api('POST', R, await body({ name }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status, `tạo kỳ thứ 2 cùng tên "${name}" phải bị từ chối/cảnh báo trùng (HTTP ${r.status}: ${r.message})`).toBeGreaterThanOrEqual(400);
  });
  test(tc('CMP-C24'), async () => {
    needWrite();
    const day = iso(inDays(10));
    const r = await api('POST', R, await body({ start: day, end: day.slice(0, 10) + 'T23:59:59', name: `${NAME} C24 ${rid()}` }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status, r.message).toBeLessThan(500);
    if (r.status === 200) { expect(r.data.startDate.slice(0, 10)).toBe(day.slice(0, 10)); expect(r.data.endDate.slice(0, 10)).toBe(day.slice(0, 10)); }
    else expect(r.message).not.toBe('');
  });
  test(tc('CMP-C25'), async () => {
    needWrite();
    const r = await api('POST', R, await body({ start: '2020-01-01T00:00:00', end: '2020-01-31T23:59:59', name: `${NAME} C25 ${rid()}` }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status, r.message).toBeLessThan(500);
    if (r.status === 200) expect(r.data.startDate.slice(0, 10)).toBe('2020-01-01'); else expect(r.message).not.toBe('');
  });
  test(tc('CMP-C26'), async () => {
    needWrite();
    const r = await api('POST', R, await body({ start: 'abc', name: `${NAME} C26 ${rid()}` }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status, r.message).toBe(400);
  });
  test(tc('CMP-C27'), async () => {
    needWrite();
    const r = await api('POST', R, await body({ type: 'Periodic', periodType: 'Month', name: `${NAME} C27 ${rid()}`, extra: { startDate: '2030-01-01T00:00:00', endDate: '2030-01-31T23:59:59' } }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status, r.message).toBe(200);
    const n = new Date();
    expect(r.data.periodValue).toBe(`Tháng ${n.getMonth() + 1} ${n.getFullYear()}`);
    expect(r.data.startDate.slice(0, 4), 'ngày gửi kèm phải bị bỏ qua').toBe(String(n.getFullYear()));
  });
  test(tc('CMP-C28'), async ({ page }) => {
    const locked = await lockedSets(), lockedNames = new Set(locked.map(s => s.name));
    const drafts = (await draftSets()).filter(s => !lockedNames.has(s.name)).slice(0, 3);
    expect(drafts.length).toBeGreaterThan(0);
    const d = await openAdd(page);
    const sel = formItem(d, /bộ chỉ số/i).locator('.ant-select').first();
    await sel.click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    for (const s of drafts) {
      await page.keyboard.press('Control+A'); await page.keyboard.type(s.name.slice(0, 20)); await page.waitForTimeout(700);
      const opts = (await dd.locator('.ant-select-item-option').allInnerTexts()).filter(o => o.includes(s.name));
      expect(opts, `bộ Nháp "${s.name}" không được xuất hiện`).toEqual([]);
    }
    await page.keyboard.press('Control+A'); await page.keyboard.type(locked[0].name.slice(0, 20)); await page.waitForTimeout(700);
    expect((await dd.locator('.ant-select-item-option').allInnerTexts()).some(o => o.includes(locked[0].name)), 'bộ Đã khóa phải có trong danh sách').toBeTruthy();
  });
  test(tc('CMP-C29'), async () => {
    needWrite();
    const ds = (await draftSets()).find(s => s.status === 'Draft');
    const r = await api('POST', R, await body({ setId: ds.id, name: `${NAME} C29 ${rid()}` }));
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status, `bộ "${ds.code}" đang Nháp phải bị từ chối (HTTP ${r.status}: ${r.message})`).toBe(400);
  });
  test(tc('CMP-C31'), async () => {
    needWrite();
    for (const [label, over] of [['id lạ', { scaleId: FAKE }], ['thiếu', { scaleId: null }]] as const) {
      const b = await body({ name: `${NAME} C31 ${rid()}`, ...over }); if (over.scaleId === null) delete b.scaleId;
      const r = await api('POST', R, b); if (r.status === 200) draftIds.push(r.data.id);
      expect(r.status, label).toBe(400); expect(r.message, label).toMatch(/thang xếp loại không hợp lệ/i);
    }
  });
  test(tc('CMP-C33'), async ({ page }) => {
    const d = await openAdd(page);
    await formItem(d, /thang xếp loại/i).locator('.ant-select').first().click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    const opts = (await dd.locator('.ant-select-item-option').allInnerTexts()).map(s => s.trim());
    expect(opts.some(o => /^TXL-001/.test(o)) && opts.some(o => /^TXL-002/.test(o)), `options: ${opts}`).toBeTruthy();
    await dd.locator('.ant-select-item-option', { hasText: 'TXL-001' }).first().click();
    expect((await formItem(d, /thang xếp loại/i).locator('.ant-select').first().innerText()).trim()).toBe('TXL-001 – Thang xếp loại mặc định');
  });
  test(tc('CMP-C34'), async ({ page }) => {
    needWrite();
    const d = await openAdd(page), name = `${NAME} C34 ${rid()}`;
    await fillValid(page, d, name); await btnCancel(d).click();
    await expect(d).toBeHidden(); expect(await apiHas(name)).toBe(0);
  });
  test(tc('CMP-C38'), async () => {
    needWrite();
    const s = await smallSet(), a = await mk({ name: `${NAME} C38a ${rid()}` }), b = await mk({ name: `${NAME} C38b ${rid()}` });
    expect(a.indicatorSetId).not.toBe(b.indicatorSetId); expect(a.indicatorSetCode).not.toBe(b.indicatorSetCode);
    expect(a.originalIndicatorSetId).toBe(s.id); expect(b.originalIndicatorSetId).toBe(s.id);
  });
  test(tc('CMP-C39'), async () => {
    needWrite();
    const s = await smallSet();
    await mk({ name: `${NAME} C39 ${rid()}` });
    const after = (await api('GET', `dti/indicator-sets/${s.id}`)).data;
    expect(after.status).toBe('Locked'); expect(after.version).toBe(s.version);
  });
  test(tc('CMP-C41'), async () => {
    needWrite();
    const s = await smallSet(), cnt = async () => (await pages('dti/indicator-sets')).find(x => x.id === s.id).campaignCount;
    const before = await cnt();
    await mk({ name: `${NAME} C41 ${rid()}` });
    expect(await cnt(), 'campaignCount phải tăng 1').toBe(before + 1);
  });
});

// ================= CẬP NHẬT =================
const putBody = (c: any, over: any = {}) => {
  const b: any = { name: c.name, type: c.type, scaleId: c.scaleId, reminderDaysBeforeDue: c.reminderDaysBeforeDue };
  if (c.type === 'AdHoc') { b.startDate = c.startDate; b.endDate = c.endDate; } else b.periodType = c.periodType;
  return { ...b, ...over };
};
const put = (id: string, b: any, as?: string) => api('PUT', `${R}/${id}`, b, as);
const UPD_OK = /cập nhật kỳ tự đánh giá thành công/i;
test.describe('Quản lý tự đánh giá › Cập nhật', () => {
  test.describe.configure({ timeout: 60_000 });
  const newName = (s: string) => `${NAME} ${s} ${rid()}`;
  const save = async (page: Page, d: Locator) => { await btnSave(d).click(); return toasts(page); };

  test(tc('CMP-E01'), async ({ page }) => {
    needWrite();
    const c = await mk({ name: newName('E01') }), nn = newName('E01 sửa');
    const d = await openEdit(page, c);
    await d.locator('input#name').fill(nn);
    expect(await save(page, d)).toMatch(UPD_OK);
    expect((await getCamp(c.id)).name).toBe(nn);
    const row = await findRow(page, { type: 'AdHoc', name: nn });
    expect((await cells(row))[1]).toBe(nn);
    await openDetail(page, c.id);
    expect(await text(main(page))).toContain(nn);
  });
  test(tc('CMP-E02'), async ({ page }) => {
    needWrite();
    const c = await fixture('Rejected', 'Periodic'), orig = c.name, nn = `${orig} e02`;
    try {
      const d = await openEdit(page, c);
      await d.locator('input#name').fill(nn);
      expect(await save(page, d)).toMatch(UPD_OK);
      const after = await getCamp(c.id);
      expect(after.name).toBe(nn); expect(after.status, 'trạng thái vẫn Bị từ chối').toBe('Rejected');
    } finally {
      const cur = await getCamp(c.id);
      if (cur.name !== orig) await put(c.id, putBody(cur, { name: orig }), 'canbo');
    }
  });
  test(tc('CMP-E03'), async ({ page }) => {
    needWrite();
    const s = inDays(3), e = inDays(20), c = await mk({ name: newName('E03'), start: iso(s), end: iso(e, true), remind: 3 });
    const d = await openEdit(page, c);
    expect(await d.locator('input#name').inputValue()).toBe(c.name);
    expect(await formItem(d, /phân loại/i).innerText()).toContain('Đột xuất');
    expect(await d.locator('input#startDate').inputValue()).toBe(dmy(s)); expect(await d.locator('input#endDate').inputValue()).toBe(dmy(e));
    expect(await d.locator('input#reminderDaysBeforeDue').inputValue()).toBe('3');
    expect(await formItem(d, /thang xếp loại/i).innerText()).toContain('TXL-001');
    expect(await d.locator('input#indicatorSetId').isDisabled(), 'Bộ chỉ số phải bị vô hiệu khi cập nhật').toBeTruthy();
  });
  test(tc('CMP-E04'), async ({ page }) => {
    needWrite();
    const c = await mk({ name: newName('E04') });
    const d = await openEdit(page, c);
    await d.locator('input#name').fill('');
    await btnSave(d).click().catch(() => {}); await page.waitForTimeout(800);
    expect((await errs(d)).join('|')).toMatch(/nhập tên/i); await expect(d).toBeVisible();
    expect((await getCamp(c.id)).name).toBe(c.name);
    const r = await put(c.id, putBody(c, { name: '' }));
    expect(r.status).toBe(400); expect((await getCamp(c.id)).name).toBe(c.name);
  });
  test(tc('CMP-E05'), async () => {
    needWrite();
    const c = await mk({ name: newName('E05') });
    const r = await put(c.id, putBody(c, { name: ('a' + rid()).padEnd(256, 'a') }));
    expect(r.status).toBe(400); expect(r.message).toMatch(/không vượt quá 255/i);
    expect((await getCamp(c.id)).name).toBe(c.name);
  });
  test(tc('CMP-E06'), async () => {
    needWrite();
    const c = await mk({ name: newName('E06') });
    const r = await put(c.id, putBody(c, { name: '<b>x</b>' }));
    expect(r.status, `PUT tên "<b>x</b>" phải bị chặn như POST (HTTP ${r.status}: ${r.message})`).toBe(400);
    expect(r.message).toMatch(/không được chứa thẻ html hoặc script/i);
  });
  test(tc('CMP-E07'), async ({ page }) => {
    needWrite();
    const c = await mk({ name: newName('E07') });
    const d = await openEdit(page, c);
    await d.locator('input#name').fill(newName('E07 đổi'));
    await btnCancel(d).click(); await expect(d).toBeHidden();
    expect((await getCamp(c.id)).name).toBe(c.name);
  });
  test(tc('CMP-E10'), async ({ page }) => {
    needWrite();
    const c = await mk({ type: 'Periodic', periodType: 'Quarter', name: newName('E10') });
    const d = await openEdit(page, c);
    await fill(page, d, { period: 'Kỳ - Tháng' });
    expect(await save(page, d)).toMatch(UPD_OK);
    const a = await getCamp(c.id), n = new Date();
    expect(a.periodValue).toBe(`Tháng ${n.getMonth() + 1} ${n.getFullYear()}`);
    expect(a.startDate.slice(0, 10)).toBe(iso(new Date(n.getFullYear(), n.getMonth(), 1)).slice(0, 10));
    expect(a.endDate.slice(0, 10)).toBe(iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)).slice(0, 10));
  });
  test(tc('CMP-E12'), async () => {
    needWrite();
    const c = await mk({ name: newName('E12') });
    const r = await put(c.id, putBody(c, { startDate: iso(inDays(20)), endDate: iso(inDays(5), true) }));
    expect(r.status).toBe(400); expect(r.message).toMatch(/ngày kết thúc phải sau ngày bắt đầu/i);
    const a = await getCamp(c.id); expect(a.startDate).toBe(c.startDate); expect(a.endDate).toBe(c.endDate);
  });
  test(tc('CMP-E13'), async () => {
    needWrite();
    const c = await mk({ name: newName('E13') });
    const r = await put(c.id, putBody(c, { startDate: null, endDate: null }));
    expect(r.status).toBe(400); expect(r.message).toMatch(/vui lòng chọn ngày bắt đầu và ngày kết thúc/i);
  });
  test(tc('CMP-E14'), async () => {
    needWrite();
    const c = await mk({ name: newName('E14' ) });
    const r = await put(c.id, putBody(c, { scaleId: FAKE }));
    expect(r.status).toBe(400); expect(r.message).toMatch(/thang xếp loại không hợp lệ/i);
  });
  test(tc('CMP-E15'), async () => {
    needWrite();
    const c = await mk({ name: newName('E15') });
    const r = await put(c.id, putBody(c, { type: 'Foo' }));
    expect(r.status).toBe(400); expect(r.message).toMatch(/loại kỳ tự đánh giá không hợp lệ/i);
  });
  test(tc('CMP-E16'), async ({ page }) => {
    const c = await fixture('Submitted', 'AdHoc');
    const row = await findRow(page, c);
    expect(await menuOf(page, row)).not.toContain('Cập nhật');
    const r = await put(c.id, putBody(c, { name: `${c.name} sửa` }), 'canbo');
    expect(r.status, `API sửa kỳ Chờ phê duyệt phải bị từ chối (HTTP ${r.status}: ${r.message})`).toBeGreaterThanOrEqual(400);
    expect((await getCamp(c.id)).name).toBe(c.name);
  });
  test(tc('CMP-E17'), async ({ page }) => {
    const c = await fixture('Approved', 'AdHoc');
    const row = await findRow(page, c);
    expect(await menuOf(page, row), 'Quản trị hệ thống cũng không được Cập nhật kỳ Đã phê duyệt').not.toContain('Cập nhật');
    const r = await put(c.id, putBody(c, { name: `${c.name} sửa` }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await getCamp(c.id)).name).toBe(c.name);
  });
  test(tc('CMP-E18'), async ({ page }) => {
    needWrite();
    const d = await mk({ name: newName('E18') }), rj = await fixture('Rejected', 'AdHoc');
    for (const c of [d, rj]) {
      expect(await menuOf(page, await findRow(page, c)), c.name).toContain('Cập nhật');
      expect((await getCamp(c.id)).allowedActions).toContain('UPDATE');
    }
  });
  test(tc('CMP-E19'), async () => {
    const r = await put(FAKE, { name: 'x', type: 'AdHoc', scaleId: await scaleId(), startDate: iso(inDays(1)), endDate: iso(inDays(2), true) });
    expect(r.status).toBe(404); expect(r.message).toMatch(/không tìm thấy kỳ tự đánh giá/i);
  });
  test(tc('CMP-E21'), async ({ page }) => {
    needWrite();
    const c = await mk({ name: newName('E21') }), nn = newName('E21 sửa');
    const d = await openEdit(page, c);
    await d.locator('input#name').fill(nn);
    await Promise.all([btnSave(d).click(), btnSave(d).click({ timeout: 2000 }).catch(() => {})]);
    const t = await toasts(page, 2000);
    expect(t).not.toMatch(/lỗi|không tìm thấy|thất bại/i);
    expect((await getCamp(c.id)).name).toBe(nn);
  });
  test(tc('CMP-E22'), async () => {
    needWrite();
    const c = await mk({ name: newName('E22') });
    const snap = async () => { const x = (await api('GET', `dti/indicator-sets/${c.indicatorSetId}`)).data; delete x.lastModifiedOnDate; delete x.lastModifiedByUserName; return JSON.stringify(x); };
    const before = await snap();
    const r = await put(c.id, putBody(c, { scaleId: await scaleId('TXL-002') }));
    expect(r.status, r.message).toBe(200);
    expect(await snap(), 'bộ chỉ số bản sao không được đổi').toBe(before);
  });
});

// ================= XÓA =================
test.describe('Quản lý tự đánh giá › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  const newName = (s: string) => `${NAME} ${s} ${rid()}`;
  const askDelete = async (page: Page, c: any) => {
    const row = await findRow(page, c);
    await pick(page, row, /xoá|xóa/i);
    await expect(page.locator('.ant-modal-confirm-title')).toHaveText('Bạn có chắc chắn muốn xóa bản ghi này không?');
  };
  test(tc('CMP-D05'), async ({ page, browser }) => {
    needWrite();
    const d = await mk({ name: newName('D05') }), sub = await fixture('Submitted', 'AdHoc'), ap = await fixture('Approved', 'AdHoc'), rj = await fixture('Rejected', 'AdHoc');
    const draft = ['Cấu hình bộ chỉ số', 'Phân công đơn vị', 'Trình phê duyệt', 'Cập nhật', 'Xoá'];
    expect(await menuOf(page, await findRow(page, d)), 'Nháp').toEqual(draft);
    expect(await menuOf(page, await findRow(page, rj)), 'Bị từ chối').toEqual(draft.slice(0, 4));
    expect((await menuOf(page, await findRow(page, sub))).filter(m => !/^(Phê duyệt|Từ chối)$/.test(m)), 'Chờ phê duyệt (admin chỉ có Phê duyệt/Từ chối)').toEqual([]);
    expect(await menuOf(page, await findRow(page, ap)), 'Đã phê duyệt').toEqual([]);
    // Cán bộ (đúng như bước kiểm thử): kỳ Chờ phê duyệt / Đã phê duyệt không có thao tác
    const ctx = await browser.newContext({ storageState: 'auth/canbo.json', baseURL: page.url().split('#')[0] }), p2 = await ctx.newPage();
    try {
      expect(await menuOf(p2, await findRow(p2, sub)), 'Cán bộ - Chờ phê duyệt').toEqual([]);
      expect(await menuOf(p2, await findRow(p2, ap)), 'Cán bộ - Đã phê duyệt').toEqual([]);
    } finally { await ctx.close(); }
  });
  test(tc('CMP-D06'), async () => {
    const c = await fixture('Submitted', 'AdHoc');
    const r = await api('DELETE', `${R}/${c.id}`, undefined, 'canbo');
    expect(r.status).toBe(403); expect((await getCamp(c.id)).status).toBe('Submitted');
  });
  test(tc('CMP-D07'), async () => {
    const c = await fixture('Approved', 'AdHoc');
    const r = await api('DELETE', `${R}/${c.id}`);
    expect(r.status).toBe(400); expect(r.message).toMatch(/chỉ có thể xóa kỳ tự đánh giá đang ở trạng thái nháp/i);
    expect((await getCamp(c.id)).status).toBe('Approved');
  });
  test(tc('CMP-D08'), async () => {
    const c = await fixture('Rejected', 'AdHoc');
    const r = await api('DELETE', `${R}/${c.id}`);
    expect([400, 403], `HTTP ${r.status}: ${r.message}`).toContain(r.status);
    expect((await getCamp(c.id)).status).toBe('Rejected');
  });
  test(tc('CMP-D09'), async () => {
    needWrite();
    const a = await api('DELETE', `${R}/${FAKE}`);
    expect(a.status).toBe(404); expect(a.message).toMatch(/không tìm thấy kỳ tự đánh giá/i);
    const c = await mk({ name: newName('D09') });
    expect((await api('DELETE', `${R}/${c.id}`)).status).toBe(200);
    const b = await api('DELETE', `${R}/${c.id}`);
    expect(b.status).toBe(404); expect(b.message).toMatch(/không tìm thấy kỳ tự đánh giá/i);
  });
  test(tc('CMP-D10'), async () => {
    needWrite();
    const c = await mk({ name: newName('D10') }), bad: string[] = [];
    for (const as of ['lanhdaobo', 'xemonly', 'ldd', 'cbdp', 'ldp']) {
      const r = await api('DELETE', `${R}/${c.id}`, undefined, as);
      if (r.status !== 403 || !FORB.test(r.message)) bad.push(`${as}: HTTP ${r.status} "${r.message}"`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
    expect((await getCamp(c.id)).status).toBe('Draft');
  });
});

// ================= EDGE / LỖI =================
const GET_LIST = (r: string) => `${R}${r}`;
/** Chặn request theo method + regex URL: 500 hoặc ngắt kết nối. */
async function breakApi(page: Page, method: string, re: RegExp, mode: 'http500' | 'offline', hit: { n: number }) {
  await page.route(re, r => {
    if (r.request().method() !== method) return r.continue();
    hit.n++;
    return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
  });
}
const noLeak = async (page: Page) => expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/stack ?trace|exception|at com\.|undefined|npgsql/);
const RE_LIST = new RegExp(`/api/v1/${R}(\\?.*)?$`);
test.describe('Quản lý tự đánh giá › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 60_000 });
  const newName = (s: string) => `${NAME} ${s} ${rid()}`;
  const MODES = ['http500', 'offline'] as const;

  test(tc('CMP-G03'), async ({ page }) => {
    needWrite();
    const c = await mk({ name: newName('G03') }), nn = newName('G03 sửa');
    for (const mode of MODES) {
      const d = await openEdit(page, c), hit = { n: 0 };
      await d.locator('input#name').fill(nn);
      if (mode === 'offline') await page.context().setOffline(true); else await breakApi(page, 'PUT', new RegExp(`/api/v1/${R}/[0-9a-f-]+$`), mode, hit);
      await btnSave(d).click(); const t = await toasts(page, 1500);
      expect(t.trim(), `${mode}: phải có thông báo lỗi`).not.toBe(''); expect(t).not.toMatch(UPD_OK);
      await expect(d).toBeVisible(); expect(await d.locator('input#name').inputValue(), `${mode}: giữ dữ liệu`).toBe(nn);
      await page.context().setOffline(false); await page.unrouteAll({ behavior: 'ignoreErrors' });
      expect((await getCamp(c.id)).name, 'dữ liệu server không đổi').toBe(c.name);
      await btnCancel(d).click(); await expect(d).toBeHidden();
    }
  });
  test(tc('CMP-G04'), async ({ page }) => {
    needWrite();
    const c = await mk({ name: newName('G04') });
    for (const mode of MODES) {
      const row = await findRow(page, c), hit = { n: 0 };
      await pick(page, row, /xoá|xóa/i);
      if (mode === 'offline') await page.context().setOffline(true); else await breakApi(page, 'DELETE', new RegExp(`/api/v1/${R}/[0-9a-f-]+$`), mode, hit);
      await confirmYes(page); const t = await toasts(page, 1000);
      expect(t.trim(), `${mode}: phải có thông báo lỗi`).not.toBe(''); expect(t).not.toMatch(/xóa kỳ tự đánh giá thành công/i);
      await page.context().setOffline(false); await page.unrouteAll({ behavior: 'ignoreErrors' });
      expect((await getCamp(c.id))?.status, 'kỳ vẫn còn').toBe('Draft');
    }
    expect(await dataRows(page).filter({ hasText: c.name }).count(), 'kỳ vẫn trong danh sách').toBe(1);
  });
  test(tc('CMP-G05'), async ({ page }) => {
    needWrite();
    const c = await mk({ name: newName('G05') });
    for (const mode of MODES) {
      const row = await findRow(page, c), hit = { n: 0 };
      await pick(page, row, /phân công đơn vị/i);
      const m = page.getByRole('dialog').filter({ hasText: /phân công đơn vị/i }).last();
      await m.getByPlaceholder(/tìm theo mã, tên đơn vị/i).fill('QC_DP'); await page.waitForTimeout(1000);
      await m.locator('tr', { hasText: 'QC_DP' }).locator('.ant-checkbox').first().click();
      if (mode === 'offline') await page.context().setOffline(true); else await breakApi(page, 'PUT', new RegExp(`/api/v1/${R}/[0-9a-f-]+/organizations$`), mode, hit);
      await m.locator('button', { hasText: /^\s*Lưu\s*$/ }).last().click(); const t = await toasts(page, 1200);
      expect(t.trim(), `${mode}: phải có thông báo lỗi`).not.toBe('');
      await expect(m, 'modal giữ nguyên').toBeVisible();
      expect(await m.locator('tr', { hasText: 'QC_DP' }).locator('input[type=checkbox]').first().isChecked(), 'lựa chọn giữ nguyên').toBeTruthy();
      await page.context().setOffline(false); await page.unrouteAll({ behavior: 'ignoreErrors' });
      expect((await api('GET', `${R}/${c.id}/organizations`)).data.totalElements, 'chưa phân công').toBe(0);
      await btnCancel(m).click(); await expect(m).toBeHidden();
    }
  });
  test(tc('CMP-G09'), async ({ page }) => {
    const hit = { n: 0 };
    await breakApi(page, 'GET', RE_LIST, 'http500', hit);
    await goto(page, ROUTE);
    expect(hit.n).toBeGreaterThan(0);
    await noLeak(page);
    expect((await page.locator('body').innerText()).trim().length, 'trang không được trắng').toBeGreaterThan(50);
    await expect(page.getByText('Quản lý tự đánh giá').first(), 'menu vẫn dùng được').toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.getByText('Trụ cột', { exact: true }).first().click(); await page.waitForTimeout(1500);
    expect(page.url()).toContain('pillars');
  });
  test(tc('CMP-G10'), async () => {
    const bad: string[] = [];
    for (const p of [0, -1]) {
      const r = await api('GET', `${R}?page=${p}&size=10`);
      const leak = /npgsql|stacktrace|offset must/i.test(JSON.stringify(r.raw));
      if (r.status >= 500 || leak) bad.push(`page=${p}: HTTP ${r.status}${leak ? ' (lộ lỗi nội bộ Npgsql/Stacktrace)' : ''}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('CMP-G11'), async () => {
    const r = await api('GET', `${R}?page=1&size=10&filter=${encodeURIComponent('{bad')}`);
    expect(r.status, 'filter sai định dạng').toBe(400);
  });
  test(tc('CMP-G13'), async () => {
    const r = await api('GET', `${R}?page=1&size=100000`);
    expect(r.status).toBe(200);
    expect(r.data.size, `size=100000 phải bị giới hạn tối đa (hiện trả size=${r.data.size})`).toBeLessThanOrEqual(1000);
  });
  test(tc('CMP-G16'), async ({ browser }) => {
    const c = await fixture('Approved', 'AdHoc');
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } }), p = await ctx.newPage();
    try {
      await p.goto(`https://cds.geneat.pro/#/vi/${ROUTE}/${c.id}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
      expect(p.url()).toContain('login');
      expect(await p.locator('body').innerText()).not.toContain(c.name);
    } finally { await ctx.close(); }
  });
  test(tc('CMP-G20'), async ({ page }) => {
    needWrite();
    const c = await fixture('Rejected', 'Periodic'), orig = c.name;
    const row = await findRow(page, c);
    await row.locator('button.ant-dropdown-trigger').first().click();            // phiên A mở menu khi kỳ đang Bị từ chối
    const item = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: /cập nhật/i }).first();
    await item.waitFor({ state: 'visible' });
    try {
      expect((await act(c.id, 'submit', 'canbo')).status).toBe(200);              // phiên B trình lại → Chờ phê duyệt
      await item.click(); await page.waitForTimeout(800);
      const d = formDlg(page);
      if (await d.isVisible().catch(() => false)) { await d.locator('input#name').fill(`${orig} g20`); await btnSave(d).click(); await toasts(page, 1200); }
      const now = await getCamp(c.id);
      expect(now.status).toBe('Submitted'); expect(now.name, 'phiên A không được sửa kỳ đã trình').toBe(orig);
    } finally {
      const cur = await getCamp(c.id);
      if (cur.status === 'Submitted') await act(c.id, 'reject', 'lanhdaobo');
      const c2 = await getCamp(c.id); if (c2.name !== orig) await put(c.id, putBody(c2, { name: orig }), 'canbo');
    }
  });
});

// ================= BẢO MẬT / PHÂN QUYỀN =================
/** Mở trang bằng phiên của role khác (không đổi tài khoản tác nhân của test). */
async function asRole<T>(browser: Browser, key: string, fn: (p: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ storageState: `auth/${key}.json`, baseURL: 'https://cds.geneat.pro' });
  try { return await fn(await ctx.newPage()); } finally { await ctx.close(); }
}
const sidebar = async (p: Page) => (await p.locator('aside, nav, .ant-layout-sider').allInnerTexts()).join(' ');
test.describe('Quản lý tự đánh giá › Bảo mật / Phân quyền', () => {
  test.describe.configure({ timeout: 60_000 });
  const newName = (s: string) => `${NAME} ${s} ${rid()}`;
  const NOT_ALLOWED = ['xemonly', 'ldd', 'cbdp', 'ldp'];

  test(tc('CMP-S01'), async () => {
    expect(await apiStatus({ resource: `${R}?page=1&size=5`, rawToken: '' })).toBe(401);
    const r = await fetch(`https://cds.geneat.pro/api/v1/${R}?page=1&size=5`); expect(r.status).toBe(401);
  });
  test(tc('CMP-S02'), async () => { expect(await apiStatus({ resource: `${R}?page=1&size=5`, rawToken: 'abc.def.ghi' })).toBe(401); });
  test(tc('CMP-S03'), async () => {
    needWrite();
    const name = newName('S03'), b = await body({ name });
    expect(await apiStatus({ method: 'POST', resource: R, body: b, rawToken: '' }), 'không token').toBe(401);
    expect(await apiStatus({ method: 'POST', resource: R, body: b, rawToken: 'abc.def.ghi' }), 'token giả').toBe(401);
    expect(await apiHas(name)).toBe(0);
  });
  test(tc('CMP-S04'), async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } }), p = await ctx.newPage();
    try { await p.goto(`https://cds.geneat.pro/#/vi/${ROUTE}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); expect(p.url()).toContain('login'); } finally { await ctx.close(); }
  });
  test(tc('CMP-S06'), async ({ browser }) => {
    const bad: string[] = [];
    for (const k of ['ldd', 'cbdp', 'ldp']) {
      await asRole(browser, k, async p => {
        await goto(p, ROUTE);
        const t = await p.locator('body').innerText();
        if (!/403/.test(t) || !/truy cập bị từ chối/i.test(t)) bad.push(`${k}: mở URL trực tiếp không ra trang 403`);
        const sb = await sidebar(p);
        if (sb.trim().length > 0 && /Quản lý tự đánh giá/.test(sb)) bad.push(`${k}: menu có "Quản lý tự đánh giá"`);
      });
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('CMP-S08'), async ({ page }) => {
    await openList(page);
    await expect(page.getByRole('button', { name: /thêm mới tự đánh giá/i }), 'không được có Thêm mới').toHaveCount(0);
    await expect(page.getByRole('button', { name: /xuất excel/i }), 'không được có Xuất Excel').toHaveCount(0);
    const perm = (await api('GET', `${R}?page=1&size=1`, undefined, 'lanhdaobo')).data.allowedActions as string[];
    expect(perm.filter(a => ['CREATE', 'UPDATE', 'DELETE'].includes(a)), 'ma trận quyền không tạo/sửa/xóa').toEqual([]);
  });
  test(tc('CMP-S10'), async () => {
    needWrite();
    const c = await mk({ name: newName('S10') }), bad: string[] = [];
    for (const as of ['lanhdaobo', 'xemonly', 'ldd', 'cbdp', 'ldp']) {
      const r = await put(c.id, putBody(c, { name: `${c.name} ${as}` }), as);
      if (r.status !== 403 || !FORB.test(r.message)) bad.push(`${as}: HTTP ${r.status} "${r.message}"`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
    expect((await getCamp(c.id)).name).toBe(c.name);
  });
  test(tc('CMP-S11'), async ({ page }) => {
    const c = await fixture('Submitted', 'AdHoc');
    expect(await menuOf(page, await findRow(page, c))).toEqual(['Phê duyệt', 'Từ chối']);
  });
  test(tc('CMP-S14'), async ({ page }) => {
    needWrite();
    await openList(page);
    await expect(page.getByRole('button', { name: /thêm mới tự đánh giá/i })).toBeVisible(); await expect(page.getByRole('button', { name: /xuất excel/i })).toBeVisible();
    const d = await mk({ name: newName('S14') }), sub = await fixture('Submitted', 'AdHoc'), ap = await fixture('Approved', 'AdHoc'), rj = await fixture('Rejected', 'AdHoc');
    const draft = ['Cấu hình bộ chỉ số', 'Phân công đơn vị', 'Trình phê duyệt', 'Cập nhật', 'Xoá'];
    expect(await menuOf(page, await findRow(page, d)), 'Nháp').toEqual(draft);
    expect(await menuOf(page, await findRow(page, rj)), 'Bị từ chối').toEqual(draft.slice(0, 4));
    expect(await menuOf(page, await findRow(page, sub)), 'Chờ phê duyệt').toEqual(['Phê duyệt', 'Từ chối']);
    expect(await menuOf(page, await findRow(page, ap)), 'Đã phê duyệt').toEqual([]);
  });
  test(tc('CMP-S16'), async ({ page }) => {
    needWrite();
    const c = await mk({ as: 'canbo', name: newName('S16') });
    const row = await findRow(page, c);
    expect(await row.count(), 'Quản trị hệ thống phải thấy kỳ do Cán bộ tạo').toBe(1);
    const r = await put(c.id, putBody(c, { name: `${c.name} sửa` }), 'admin');
    expect(r.status, `Quản trị sửa kỳ của Cán bộ (HTTP ${r.status}: ${r.message})`).toBe(200);
  });
});

// ================= HIỆU NĂNG =================
test.describe('Quản lý tự đánh giá › Hiệu năng', () => {
  test.describe.configure({ timeout: 60_000 });
  test(tc('CMP-P01'), async ({ page }) => {
    const t0 = Date.now();
    await page.goto(`/#/vi/${ROUTE}`, { waitUntil: 'commit' });
    await dataRows(page).first().waitFor({ state: 'visible', timeout: 15_000 });
    const ms = Date.now() - t0; console.log(`  ⏱ Danh sách tự đánh giá hiển thị ${ms}ms`);
    expect(ms, 'bảng hiển thị dữ liệu ≤ 3000ms').toBeLessThanOrEqual(3000);
  });
  test(tc('CMP-P04'), async () => {
    needWrite();
    const big = await bigSet(); test.skip(!big, 'không có bộ MBCS_QC01');
    const t0 = Date.now();
    const r = await api('POST', R, await body({ setId: big.id, name: `${NAME} P04 ${rid()}` }));
    const ms = Date.now() - t0;
    if (r.status === 200) draftIds.push(r.data.id);
    expect(r.status, r.message).toBe(200);
    const cp = (await api('GET', `dti/indicator-sets/${r.data.indicatorSetId}`)).data;
    console.log(`  ⏱ Tạo kỳ (bộ ${cp.childrenCount} chỉ số) ${ms}ms`);
    expect(cp.childrenCount, 'bản sao đủ chỉ số').toBe(big.childrenCount);
    expect(ms, 'tạo kỳ ≤ 5000ms').toBeLessThanOrEqual(5000);
  });
  test(tc('CMP-P05'), async ({ page }) => {
    needWrite();
    const c = await mk({ name: `${NAME} P05 ${rid()}` });
    const row = await findRow(page, c);
    await pick(page, row, /phân công đơn vị/i);
    const m = page.getByRole('dialog').filter({ hasText: /phân công đơn vị/i }).last();
    const n = Number((await m.locator('.ant-pagination').first().innerText()).match(/trong\s+(\d+)/)?.[1]);
    if (n > 10) {   // chọn hết các đơn vị: tăng số dòng/trang để "chọn tất cả" bao trọn
      await m.locator('.ant-pagination-options .ant-select').first().click();
      await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: /^(50|100)/ }).first().click(); await page.waitForTimeout(800);
    }
    await m.locator('thead .ant-checkbox').first().click();
    const t0 = Date.now();
    await m.locator('button', { hasText: /^\s*Lưu\s*$/ }).last().click();
    await anyToast(page).filter({ hasText: /thành công/i }).first().waitFor({ timeout: 15_000 });
    const ms = Date.now() - t0; console.log(`  ⏱ Phân công ${n} đơn vị và lưu ${ms}ms`);
    expect((await getCamp(c.id)).organizations?.length ?? (await api('GET', `${R}/${c.id}/organizations`)).data.totalElements, 'Số đơn vị cập nhật').toBe(n);
    expect(ms, 'lưu ≤ 3000ms').toBeLessThanOrEqual(3000);
  });
});
