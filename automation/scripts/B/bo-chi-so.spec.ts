// B.II BỘ CHỈ SỐ — script bám testcase SET-* (testcases/docs/catalog.json). Viết lại theo giao diện khảo sát 08/11/2026:
// form không còn ô Mã (BCS-nnn tự sinh), bắt trùng theo tên, Năm áp dụng là ô chọn #effectiveYear; chi tiết có Thao tác/Xuất Excel/Cập nhật/Cấu hình;
// trang Cấu hình (/builder) có 1 nút Lưu chung, hộp "Thêm nhóm chỉ số vào bộ", "Thêm chỉ số", nút "Xóa khỏi bộ chỉ số <mã nhóm>", "Xoá <mã chỉ số>", công tắc "Tính điểm <mã>".
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, PAGES, dataRows, openList, searchFor, waitList, rowTexts, pickOption, dlg, toast, rowAction, rowMenuItems,
  confirmYes, confirmNo, confirmIfAsked, api, listApi, Made, code8, registerListSuite, registerCodeNameRules, registerAuthTest,
  registerPerfTest, registerNotFoundTest, FILTERS, ensurePillar, ensureGroup, ensureIndicator,
} from './common';
import { PAGES as PagesA } from '../A/common';
import { BASE } from '../helpers';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { guardSession } from '../session-guard';

const cfg = PAGES.SET;
const SETS = 'dti/indicator-sets';
const CAMPS = 'dti/self-assessment-campaigns';
const YEAR = new Date().getFullYear();
const made = new Made();
const tags: string[] = [];     // tag QCA… nằm trong tên các bộ do test tạo (kể cả tạo qua giao diện và bản nhân bản cùng tên)
const campIds: string[] = [];  // kỳ tự đánh giá do test tạo

/** Dọn: kỳ trước; rồi mọi bộ có tên "qc.automation …<tag>…" (so khớp chính xác phía client), mở khóa bằng POST rồi xóa; sau đó dữ liệu nền. */
async function cleanSets() {
  for (const id of campIds.splice(0)) await api('DELETE', `${CAMPS}/${id}`).catch(() => {});
  for (const tag of tags.splice(0)) {
    const xs = (await listApi(SETS, tag).catch(() => [])).filter((s: any) => String(s.name ?? '').startsWith('qc.automation') && String(s.name).includes(tag));
    for (const s of xs) { if (s.status === 'Locked') await api('POST', `${SETS}/${s.id}/unlock`, {}); await api('DELETE', `${SETS}/${s.id}`); }
  }
}
test.afterEach(async () => { await cleanSets(); await made.clean(); });
PagesA.SET = cfg; // registerListSuite tra cấu hình trong PAGES của A → bổ sung cấu hình SET
registerListSuite('SET', { pageSize: 10 });
registerCodeNameRules({ P: 'SET', cfg, made, autoCode: /^BCS-\d{3,}$/,
  mk: async (_code, name) => { const r = await api('POST', SETS, { name, effectiveYear: YEAR }); return { status: r.status, message: r.message, data: r.data }; } });

// ---------- Dữ liệu nền qua API ----------
let seq = 0; // code8() chỉ đổi theo mili-giây → thêm bộ đếm để tag tạo liên tiếp không trùng
const newTag = () => { const t = code8() + (seq++ % 36).toString(36).toUpperCase(); tags.push(t); return t; };
async function mkSet(extra: any = {}) {
  const tag = newTag();
  const body = { name: `qc.automation Bộ ${tag}`, effectiveYear: YEAR, ...extra };
  const r = await api('POST', SETS, body);
  if (r.status >= 300) throw new Error(`tạo bộ chỉ số lỗi ${r.status} ${r.message}`);
  return { id: r.data.id as string, code: r.data.code as string, name: body.name as string, tag };
}
const lockSet = async (id: string) => { const r = await api('POST', `${SETS}/${id}/lock`, {}); if (r.status !== 200) throw new Error('khóa bộ lỗi: ' + r.message); };
const getSet = async (id: string) => (await api('GET', `${SETS}/${id}`)).data;
async function lockedScaleId() {
  const r = await api('GET', 'dti/score-scales?page=1&size=100');
  const s = (r.data?.content ?? []).find((x: any) => x.status === 'Locked' || x.isLocked);
  if (!s) throw new Error('không có thang xếp loại đã khóa để tạo kỳ');
  return s.id as string;
}
const day = (n: number) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
async function mkCampaign(setId: string) {
  const r = await api('POST', CAMPS, { name: `qc.automation kỳ ${code8()}`, type: 'AdHoc', indicatorSetId: setId, scaleId: await lockedScaleId(), startDate: `${day(1)}T00:00:00`, endDate: `${day(20)}T23:59:59`, reminderDays: 3 });
  if (r.status >= 300) throw new Error(`tạo kỳ lỗi ${r.status} ${r.message}`);
  campIds.push(r.data.id); return r.data;
}
interface TG { g: any; par: any; c1: any; c2: any }
/** 1 trụ cột, n nhóm (đã khóa); mỗi nhóm có 1 chỉ số cha (10đ) và 2 chỉ số con (5đ + 5đ), đã khóa. Điểm bộ = tổng điểm chỉ số con. */
async function mkTree(n = 1) {
  const pillar = await ensurePillar(made);
  const groups: TG[] = [];
  for (let i = 0; i < n; i++) {
    const g = await ensureGroup(made, { pillarId: pillar.id });
    const par = await ensureIndicator(made, { groupId: g.id, pillarId: pillar.id, max: 10, lock: true });
    const c1 = await ensureIndicator(made, { groupId: g.id, pillarId: pillar.id, parentId: par.id, max: 5, lock: true });
    const c2 = await ensureIndicator(made, { groupId: g.id, pillarId: pillar.id, parentId: par.id, max: 5, lock: true });
    groups.push({ g, par, c1, c2 });
  }
  return { pillar, groups };
}
const indBody = (x: TG, skip: string[] = []) => [
  { indicatorId: x.par.id, weight: 0, isScored: true, minScore: 0, maxScore: 10 },
  { indicatorId: x.c1.id, weight: 1, isScored: true, minScore: 0, maxScore: 5 },
  { indicatorId: x.c2.id, weight: 1, isScored: true, minScore: 0, maxScore: 5 },
].filter(b => !skip.includes(b.indicatorId));
const putGroups = (setId: string, groups: TG[]) => api('PUT', `${SETS}/${setId}/groups`, groups.map((x, i) => ({ indicatorGroupId: x.g.id, displayOrder: i + 1, isScored: true })));
const putInds = (setId: string, body: any[]) => api('PUT', `${SETS}/${setId}/indicators`, body.map((x, i) => ({ displayOrder: i + 1, ...x })));
async function fillStruct(setId: string, groups: TG[], skip: string[] = []) {
  const a = await putGroups(setId, groups); if (a.status !== 200) throw new Error('ghi nhóm lỗi: ' + a.message);
  const b = await putInds(setId, groups.flatMap(x => indBody(x, skip))); if (b.status !== 200) throw new Error('ghi chỉ số lỗi: ' + b.message);
}
async function mkFilled(n = 1, extra: any = {}) {
  const tree = await mkTree(n); const s = await mkSet(extra);
  await fillStruct(s.id, tree.groups);
  return { ...s, ...tree };
}
/** Mọi chỉ số (cha + con) trong cấu trúc bộ trả về từ API. */
const flatInds = (d: any): any[] => (d?.groups ?? []).flatMap((g: any) => (g.indicators ?? []).flatMap((i: any) => [i, ...(i.children ?? [])]));
const indOf = (d: any, id: string) => flatInds(d).find((i: any) => i.indicatorId === id || i.id === id);

// ---------- Helper UI ----------
const C = (page: Page) => page.locator('.ant-layout-content').first();
const text = async (page: Page) => (await C(page).innerText()).replace(/\s+/g, ' ');
const num = (s?: string) => Number(String(s ?? '').replace(/\./g, '').replace(',', '.'));
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm bộ chỉ số/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(300); return d;
}
const nameInput = (d: Locator) => d.getByPlaceholder(/nhập tên bộ chỉ số/i);
const descInput = (d: Locator) => d.locator('textarea').first();
const saveBtn = (d: Locator) => d.locator('button', { hasText: /^\s*Lưu\s*$/ }).last();
const cancelBtn = (d: Locator) => d.locator('button', { hasText: /^\s*Hu[ỷy]\s*$/ }).last();
const yearSelect = (page: Page, d: Locator) => d.locator('.ant-select').filter({ has: page.locator('#effectiveYear') }).first();
async function yearOptions(page: Page, d: Locator) {
  await yearSelect(page, d).click();
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last(); await dd.waitFor({ state: 'visible' });
  const opts = (await dd.locator('.ant-select-item-option').allInnerTexts()).map(s => s.trim());
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); return opts;
}
async function pickYear(page: Page, d: Locator, year: number) {
  await yearSelect(page, d).click();
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last(); await dd.waitFor({ state: 'visible' });
  await dd.locator('.ant-select-item-option', { hasText: new RegExp(`^\\s*${year}\\s*$`) }).first().click(); await page.waitForTimeout(300);
}
async function fillAdd(page: Page, d: Locator, name: string, year = YEAR, desc?: string) {
  await nameInput(d).fill(name); await pickYear(page, d, year);
  if (desc !== undefined) await descInput(d).fill(desc);
}
const errorsOf = async (d: Locator) => (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' | ');
const setsByTag = async (tag: string) => (await listApi(SETS, tag)).filter((s: any) => String(s.name ?? '').includes(tag));

async function openDetail(page: Page, id: string) {
  await page.goto(`${BASE}/vi/indicator-sets/${id}`, { waitUntil: 'networkidle' });
  await C(page).getByText('Cấu trúc bộ chỉ số').first().waitFor({ timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800);
}
const detailBtn = (page: Page, re: RegExp) => C(page).getByRole('button', { name: re }).first();
async function openEdit(page: Page, id: string) {
  await openDetail(page, id);
  await detailBtn(page, /^cập nhật$/i).click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
}
const totalScore = async (page: Page) => num((await text(page)).match(/Tổng điểm tối đa\s*([\d.,]+)/)?.[1]);

async function openBuilder(page: Page, id: string) {
  await page.goto(`${BASE}/vi/indicator-sets/${id}/builder`, { waitUntil: 'networkidle' });
  await C(page).getByText('Cấu hình bộ chỉ số').first().waitFor({ timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1000);
}
const groupMax = async (page: Page) => num((await text(page)).match(/Điểm tối đa của nhóm\s*([\d.,]+)/)?.[1]);
async function builderSave(page: Page) {
  await C(page).locator('button', { hasText: /^\s*Lưu\s*$/ }).first().click();
  const t = await toast(page); await page.waitForTimeout(800); return t;
}
/** Hộp "Xác nhận xóa … Huỷ / Xoá" của trang Cấu hình. */
async function confirmDelete(page: Page) {
  const box = page.locator('.ant-modal').filter({ visible: true }).filter({ hasText: /xác nhận xóa/i }).last();
  await box.waitFor({ state: 'visible' });
  await box.locator('button', { hasText: /^\s*Xo[áa]\s*$/ }).click(); await page.waitForTimeout(600);
}
const delInd = async (page: Page, code: string) => { await C(page).getByRole('button', { name: `Xoá ${code}`, exact: true }).click(); await confirmDelete(page); };
async function openGroupModal(page: Page) {
  await C(page).getByRole('button', { name: /thêm nhóm/i }).click();
  const m = page.locator('.ant-modal').filter({ visible: true }).filter({ hasText: /thêm nhóm chỉ số vào bộ/i }).last();
  await m.waitFor({ state: 'visible' }); await page.waitForTimeout(800); return m;
}
async function modalSearch(page: Page, m: Locator, kw: string) {
  await m.getByPlaceholder(/tìm theo mã, tên nhóm chỉ số/i).fill(kw); await page.waitForTimeout(1500);
  return m.locator('tbody tr.ant-table-row');
}
async function listRow(page: Page, tag: string) {
  await openList(page, cfg); await searchFor(page, cfg, tag);
  const r = dataRows(page).filter({ hasText: tag }); await r.first().waitFor({ state: 'visible' }); return r;
}

// ================= DANH SÁCH / BỘ LỌC =================
test.describe('Bộ chỉ số › Bộ lọc / Trạng thái', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('SET-L12'), async ({ page }) => {
    await openList(page, cfg);
    for (const label of ['Đã khóa', 'Chưa khóa']) {
      await pickOption(page, page.locator(FILTERS).first(), label); await waitList(page);
      const texts = await rowTexts(page);
      expect(texts.length, `phải có bộ chỉ số "${label}"`).toBeGreaterThan(0);
      for (const t of texts) expect(t, `dòng không khớp bộ lọc "${label}"`).toContain(label);
    }
  });
  test(tc('SET-L13'), async ({ page }) => {
    const a = await mkSet(), b = await mkSet(); await lockSet(b.id);
    for (const s of [a, b]) {
      const row = await listRow(page, s.tag);
      const label = (await row.first().innerText()).match(/Chưa khóa|Đã khóa/)?.[0];
      expect(label, 'dòng phải có nhãn trạng thái').toBeTruthy();
      await openDetail(page, s.id);
      expect((await text(page)).slice(0, 200), 'chip trạng thái ở chi tiết').toContain(label!);
    }
  });
  test(tc('SET-L14'), async ({ page }) => {
    const s = await mkSet();
    await openList(page, cfg); await searchFor(page, cfg, s.tag);
    await pickOption(page, page.locator(FILTERS).first(), 'Đã khóa'); await waitList(page);
    expect(await dataRows(page).count(), 'từ khóa + "Đã khóa" không có dòng').toBe(0);
    await pickOption(page, page.locator(FILTERS).first(), 'Chưa khóa'); await waitList(page);
    const t = await rowTexts(page);
    expect(t.length).toBe(1); expect(t[0]).toContain(s.tag);
  });
  test(tc('SET-L15'), async ({ page }) => {
    const s = await mkFilled(1);
    const row = (await listRow(page, s.tag)).first();
    const cells = (await row.locator('td').allInnerTexts()).map(x => x.trim());
    expect(cells[1], 'cột Mã').toBe(s.code);
    expect(cells[3], 'cột Phiên bản').toMatch(/^v?1$/i);
    expect(cells[4], 'cột Năm áp dụng').toBe(String(YEAR));
    expect(cells[5], 'cột Nhóm chỉ số').toBe('1');
    expect(cells[6], 'cột Chỉ số').toBe('3');
  });
  test(tc('SET-L16'), async ({ page }) => {
    const s = await mkSet();
    const open = await rowMenuItems(page, await listRow(page, s.tag));
    for (const it of [/cấu hình bộ chỉ số/i, /^kho[áa]$/i, /nhân bản/i, /cập nhật/i, /^xo[áa]$/i]) expect(open.some(x => it.test(x)), `menu Chưa khóa thiếu ${it}: [${open}]`).toBeTruthy();
    await lockSet(s.id);
    const locked = await rowMenuItems(page, await listRow(page, s.tag));
    expect(locked.some(x => /mở kho[áa]/i.test(x)) && locked.some(x => /nhân bản/i.test(x)), `menu Đã khóa: [${locked}]`).toBeTruthy();
    for (const it of [/cập nhật/i, /^xo[áa]$/i, /cấu hình/i, /^kho[áa]$/i]) expect(locked.some(x => it.test(x)), `menu Đã khóa không được có ${it}`).toBeFalsy();
  });
});

// ================= XEM CHI TIẾT =================
test.describe('Bộ chỉ số › Xem chi tiết', () => {
  test.describe.configure({ timeout: 120_000 });
  test(tc('SET-V01'), async ({ page }) => {
    const s = await mkFilled(1, { description: 'qc mô tả chi tiết' });
    await openDetail(page, s.id);
    const t = await text(page);
    for (const v of [s.name, 'Chưa khóa', 'Thông tin và cấu trúc bộ chỉ số', 'Mã bộ chỉ số', s.code, 'Năm áp dụng', String(YEAR), 'Mô tả', 'qc mô tả chi tiết', 'Tổng điểm tối đa', 'Cập nhật lần cuối'])
      expect(t, `chi tiết thiếu "${v}"`).toContain(v);
    for (const b of [/^thao tác$/i, /xuất excel/i, /^cập nhật$/i, /^cấu hình$/i]) await expect(detailBtn(page, b), `nút ${b}`).toBeVisible();
  });
  test(tc('SET-V02'), async ({ page }) => {
    const s = await mkFilled(1); const x = s.groups[0];
    await openDetail(page, s.id);
    const t = await text(page);
    for (const v of [s.pillar.realCode, x.g.realCode, x.par.realCode, x.c1.realCode, x.c2.realCode, 'Mã · tên', 'Tính điểm', 'Điểm tối thiểu', 'Điểm tối đa'])
      expect(t, `cây cấu trúc thiếu "${v}"`).toContain(v);
    expect(t, 'chỉ số tính điểm hiện "Có"').toMatch(/(^|\s)Có(\s|$)/);   // \b không dùng được với chữ có dấu
    const c1 = C(page).getByText(x.c1.realCode).first();
    await expect(c1).toBeVisible();
    await detailBtn(page, /thu gọn tất cả/i).click(); await page.waitForTimeout(800);
    await expect(c1, 'Thu gọn tất cả phải ẩn các dòng chỉ số').toBeHidden();
  });
  test(tc('SET-V03'), async ({ page }) => {
    const s = await mkFilled(1);
    await openDetail(page, s.id);
    expect(await totalScore(page), 'tổng điểm = 5 + 5 (chỉ số con), không cộng điểm chỉ số cha').toBe(10);
  });
  test(tc('SET-V04'), async ({ page }) => {
    const s = await mkFilled(1);
    await openDetail(page, s.id);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), detailBtn(page, /xuất excel/i).click()]);
    expect(dl.suggestedFilename()).toMatch(new RegExp(`^bo-chi-so_${s.code.toLowerCase()}_v1_\\d{8}\\.xlsx$`, 'i'));
  });
  test(tc('SET-V07'), async ({ page }) => {
    const s = await mkSet();
    await openDetail(page, s.id);
    const t = await text(page);
    expect(t).toContain('Bộ chỉ số chưa có cấu trúc');
    expect(await totalScore(page)).toBe(0);
    expect(t, 'mô tả trống hiện "–"').toMatch(/Mô tả\s*[–-]\s/);
  });
  test(tc('SET-V08'), async ({ page }) => {
    const s = await mkSet({ description: 'qc mô tả V08' });
    const d = await openEdit(page, s.id);
    await expect(d).toContainText(/cập nhật thông tin bộ chỉ số/i);
    expect(await nameInput(d).inputValue()).toBe(s.name);
    expect(await descInput(d).inputValue()).toBe('qc mô tả V08');
    await expect(yearSelect(page, d)).toContainText(String(YEAR));
    await cancelBtn(d).click(); await expect(d).toBeHidden();
    await detailBtn(page, /^cấu hình$/i).click();
    await page.waitForURL(/\/builder/, { timeout: 15_000 });
    await expect(C(page).getByText('Cấu hình bộ chỉ số').first()).toBeVisible();
  });
});
registerNotFoundTest('SET-V05', cfg);

// ================= THÊM MỚI =================
test.describe('Bộ chỉ số › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('SET-C01'), async ({ page }) => {
    const tag = newTag(), name = `qc.automation Bộ ${tag}`;
    const d = await openAdd(page);
    await expect(d).toContainText('Thêm bộ chỉ số');
    await fillAdd(page, d, name, YEAR, 'qc mô tả C01');
    await saveBtn(d).click();
    expect(await toast(page)).toMatch(/thêm bộ chỉ số thành công/i);
    await expect(d, 'form đóng sau khi lưu').toBeHidden();
    const [x] = await setsByTag(tag);
    expect(x, 'bộ mới phải có trong API').toBeTruthy();
    expect(x.code).toMatch(/^BCS-\d{3,}$/);
    expect([x.version, x.status, x.effectiveYear, x.description]).toEqual([1, 'Draft', YEAR, 'qc mô tả C01']);
    await searchFor(page, cfg, tag);
    const t = await rowTexts(page);
    expect(t.length).toBe(1); expect(t[0]).toContain(x.code); expect(t[0]).toContain('Chưa khóa');
  });
  test(tc('SET-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await saveBtn(d).click(); await page.waitForTimeout(700);
    const e = await errorsOf(d);
    expect(e).toMatch(/vui lòng nhập tên bộ chỉ số/i);
    expect(e).toMatch(/vui lòng chọn năm áp dụng/i);
    await expect(d, 'form còn mở').toBeVisible();
  });
  test(tc('SET-C03'), async ({ page }) => {
    const a = await mkSet();
    const d = await openAdd(page);
    await fillAdd(page, d, a.name.toUpperCase());
    await saveBtn(d).click();
    expect(await toast(page)).toMatch(/đã tồn tại\. Vui lòng nhập tên khác/i);
    await expect(d, 'form còn mở').toBeVisible();
    const same = (await setsByTag(a.tag)).filter((x: any) => x.name.toLowerCase() === a.name.toLowerCase());
    expect(same, 'không tạo bản ghi thứ hai').toHaveLength(1);
  });
  test(tc('SET-C04'), async ({ page }) => {
    const d = await openAdd(page);
    const opts = (await yearOptions(page, d)).map(Number);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0], 'năm đầu tiên = năm hiện tại').toBe(YEAR);
    expect(opts.filter(y => y < YEAR), 'không có năm quá khứ').toEqual([]);
    const tag = newTag();
    const r = await api('POST', SETS, { name: `qc.automation Bộ ${tag}`, effectiveYear: 2000 });
    expect(r.status, `API năm 2000 (HTTP ${r.status}: ${r.message})`).toBe(400);
    expect(r.message).toMatch(/không được nhỏ hơn năm hiện tại/i);
  });
  test(tc('SET-C05'), async ({ page }) => {
    const tag = newTag();
    const d = await openAdd(page);
    await nameInput(d).fill(`qc.automation Bộ ${tag}`);
    await cancelBtn(d).click();
    await expect(d).toBeHidden();
    expect(await setsByTag(tag)).toHaveLength(0);
  });
  test(tc('SET-C07'), async () => {
    for (const name of ['', '   ']) {
      const r = await api('POST', SETS, { name, effectiveYear: YEAR });
      expect(r.status, `tên "${name}" (HTTP ${r.status}: ${r.message})`).toBe(400);
      expect(r.message).toMatch(/vui lòng nhập/i);
    }
  });
  test(tc('SET-C08'), async ({ page }) => {
    const d = await openAdd(page);
    expect(await d.locator('.ant-form-item-label').allInnerTexts(), 'form không có ô Mã').not.toContainEqual(expect.stringMatching(/^\s*\*?\s*mã/i));
    expect(await d.getByPlaceholder(/mã/i).count(), 'không có ô nhập mã').toBe(0);
    const tag = newTag(), sent = 'QC' + tag;
    const r = await api('POST', SETS, { code: sent, name: `qc.automation Bộ ${tag}`, effectiveYear: YEAR });
    expect(r.status).toBe(200);
    expect(r.data.code, 'mã client gửi bị bỏ qua').not.toBe(sent);
    expect(r.data.code).toMatch(/^BCS-\d{3,}$/);
    expect((await listApi(SETS, r.data.code)).filter((x: any) => x.code === r.data.code), 'mã là duy nhất').toHaveLength(1);
  });
  test(tc('SET-C09'), async ({ page }) => {
    const d = await openAdd(page);
    expect(await descInput(d).getAttribute('maxlength')).toBe('1000');
    const a = newTag(), b = newTag();
    const ok = await api('POST', SETS, { name: `qc.automation Bộ ${a}`, effectiveYear: YEAR, description: 'x'.repeat(1000) });
    expect(ok.status, `mô tả 1000 ký tự (HTTP ${ok.status}: ${ok.message})`).toBe(200);
    const bad = await api('POST', SETS, { name: `qc.automation Bộ ${b}`, effectiveYear: YEAR, description: 'x'.repeat(1001) });
    expect(bad.status, `mô tả 1001 ký tự (HTTP ${bad.status})`).toBe(400);
    expect(bad.message).toMatch(/mô tả không vượt quá 1000 ký tự/i);
  });
  test(tc('SET-C10'), async () => {
    for (const html of ['<script>alert(1)</script>', '<b>x</b>']) {
      const tag = newTag();
      const r = await api('POST', SETS, { name: `qc.automation Bộ ${tag} ${html}`, effectiveYear: YEAR });
      expect(r.status, `tên chứa ${html} (HTTP ${r.status}: ${r.message})`).toBe(400);
      expect(r.message).toMatch(/không được chứa thẻ HTML hoặc script/i);
    }
  });
});

// ================= CHỈNH SỬA =================
test.describe('Bộ chỉ số › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('SET-E01'), async ({ page }) => {
    const s = await mkSet();
    const d = await openEdit(page, s.id);
    const nn = `${s.name} sửa`;
    await nameInput(d).fill(nn); await descInput(d).fill('qc mô tả đã sửa');
    await saveBtn(d).click();
    expect(await toast(page)).toMatch(/cập nhật bộ chỉ số thành công/i);
    await openDetail(page, s.id);
    const t = await text(page);
    expect(t).toContain(nn); expect(t).toContain('qc mô tả đã sửa');
  });
  test(tc('SET-E02'), async ({ page }) => {
    const s = await mkSet();
    const d = await openEdit(page, s.id);
    await pickYear(page, d, YEAR + 1); await saveBtn(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await getSet(s.id)).effectiveYear).toBe(YEAR + 1);
    const row = (await listRow(page, s.tag)).first();
    expect((await row.locator('td').nth(4).innerText()).trim()).toBe(String(YEAR + 1));
  });
  test(tc('SET-E03'), async ({ page }) => {
    const s = await mkSet();
    const d = await openEdit(page, s.id);
    await nameInput(d).fill(''); await saveBtn(d).click(); await page.waitForTimeout(700);
    expect(await errorsOf(d)).toMatch(/vui lòng nhập tên bộ chỉ số/i);
    expect((await getSet(s.id)).name).toBe(s.name);
  });
  test(tc('SET-E04'), async ({ page }) => {
    const s = await mkSet();
    const d = await openEdit(page, s.id);
    await nameInput(d).fill(`${s.name} huỷ`); await cancelBtn(d).click();
    await expect(d).toBeHidden();
    expect((await getSet(s.id)).name).toBe(s.name);
    expect(await text(page)).not.toContain(`${s.name} huỷ`);
  });
  test(tc('SET-E05'), async ({ page }) => {
    const s = await mkFilled(1); await lockSet(s.id);
    await openDetail(page, s.id);
    await expect(detailBtn(page, /^cập nhật$/i), 'nút Cập nhật bị vô hiệu').toBeDisabled();
    await openBuilder(page, s.id);
    expect(await text(page)).toContain('Đã khóa');
    for (const b of [/^\s*Lưu\s*$/, /thêm nhóm/i, /thêm chỉ số/i]) expect(await C(page).locator('button', { hasText: b }).count(), `trang Cấu hình bộ đã khóa không được có nút ${b}`).toBe(0);
    const r = await api('PUT', `${SETS}/${s.id}`, { name: `${s.name} x`, effectiveYear: YEAR });
    expect(r.status, `API sửa bộ đã khóa (HTTP ${r.status})`).toBe(400);
    expect(r.message).toMatch(/đã bị khoá, không thể chỉnh sửa/i);
  });
  test(tc('SET-E06'), async () => {
    const a = await mkSet(), b = await mkSet();
    const dup = await api('PUT', `${SETS}/${a.id}`, { name: b.name, effectiveYear: YEAR });
    expect(dup.status, `tên trùng (HTTP ${dup.status}: ${dup.message})`).toBe(400);
    const past = await api('PUT', `${SETS}/${a.id}`, { name: a.name, effectiveYear: YEAR - 1 });
    expect(past.status, `năm quá khứ (HTTP ${past.status}: ${past.message})`).toBe(400);
    expect(past.message).toMatch(/không được nhỏ hơn năm hiện tại/i);
    const g = await getSet(a.id); expect([g.name, g.effectiveYear]).toEqual([a.name, YEAR]);
    const nf = await api('PUT', `${SETS}/00000000-0000-4000-8000-000000000000`, { name: 'x', effectiveYear: YEAR });
    expect(nf.status).toBe(404);
  });
});

// ================= XÓA =================
test.describe('Bộ chỉ số › Xóa', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('SET-D01'), async ({ page }) => {
    const s = await mkSet();
    await rowAction(page, await listRow(page, s.tag), /^\s*Xo[áa]\s*$/);
    await confirmYes(page);
    expect(await toast(page)).toMatch(/xóa bộ chỉ số thành công/i);
    expect((await api('GET', `${SETS}/${s.id}`)).status).toBe(404);
    await searchFor(page, cfg, s.tag);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('SET-D02'), async ({ page }) => {
    const s = await mkSet();
    await rowAction(page, await listRow(page, s.tag), /^\s*Xo[áa]\s*$/);
    await confirmNo(page);
    expect((await api('GET', `${SETS}/${s.id}`)).status).toBe(200);
    expect(await dataRows(page).filter({ hasText: s.tag }).count()).toBe(1);
  });
  test(tc('SET-D03'), async ({ page }) => {
    const s = await mkSet(); await lockSet(s.id);
    const items = await rowMenuItems(page, await listRow(page, s.tag));
    expect(items.some(x => /^xo[áa]$/i.test(x)), `menu bộ đã khóa không có Xoá: [${items}]`).toBeFalsy();
    const r = await api('DELETE', `${SETS}/${s.id}`);
    expect(r.status).toBe(400); expect(r.message).toMatch(/không thể xóa bộ chỉ số đã khoá/i);
  });
  test(tc('SET-D04'), async () => {
    const s = await mkFilled(1); await lockSet(s.id);
    await mkCampaign(s.id);
    await api('POST', `${SETS}/${s.id}/unlock`, {});
    const r = await api('DELETE', `${SETS}/${s.id}`);
    expect(r.status, `xóa bộ đang được kỳ dùng (HTTP ${r.status}: ${r.message})`).toBe(400);
    expect(r.message).toMatch(/đang được dùng trong ít nhất 1 kỳ tự đánh giá/i);
    expect((await api('GET', `${SETS}/${s.id}`)).status).toBe(200);
  });
  test(tc('SET-D05'), async () => {
    const s = await mkSet();
    expect((await api('DELETE', `${SETS}/${s.id}`)).status).toBe(200);
    expect((await api('DELETE', `${SETS}/${s.id}`)).status).toBe(404);
    expect((await api('DELETE', `${SETS}/00000000-0000-4000-8000-000000000000`)).status).toBe(404);
  });
});

// ================= KHÓA / MỞ KHÓA =================
test.describe('Bộ chỉ số › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('SET-K01'), async ({ page }) => {
    const s = await mkFilled(1);
    await rowAction(page, await listRow(page, s.tag), /^\s*Kho[áa]\s*$/);
    await confirmIfAsked(page);
    expect(await toast(page)).toMatch(/khoá bộ chỉ số thành công|khóa bộ chỉ số thành công/i);
    expect((await getSet(s.id)).status).toBe('Locked');
  });
  test(tc('SET-K02'), async ({ page }) => {
    const s = await mkFilled(1); await lockSet(s.id);
    await rowAction(page, await listRow(page, s.tag), /mở kho[áa]/i);
    await confirmIfAsked(page);
    await expect.poll(async () => (await getSet(s.id)).status).toBe('Draft');
    const items = await rowMenuItems(page, await listRow(page, s.tag));
    expect(items.some(x => /cập nhật/i.test(x)) && items.some(x => /^xo[áa]$/i.test(x)), `menu sau mở khóa: [${items}]`).toBeTruthy();
  });
  test(tc('SET-K03'), async ({ page }) => {
    const a = await mkFilled(1); await lockSet(a.id);   // đã khóa
    const b = await mkFilled(1);                         // chưa khóa
    const r = await api('POST', CAMPS, { name: `qc.automation kỳ ${code8()}`, type: 'AdHoc', indicatorSetId: b.id, scaleId: await lockedScaleId(), startDate: `${day(1)}T00:00:00`, endDate: `${day(20)}T23:59:59`, reminderDays: 3 });
    if (r.data?.id) campIds.push(r.data.id);
    expect(r.status, `API tạo kỳ với bộ chưa khóa (HTTP ${r.status}: ${r.message})`).toBe(400);
    expect(r.message).toMatch(/chỉ chọn được bộ chỉ số đã khóa/i);
    await page.goto(`${BASE}/vi/self-assessment-campaigns`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /thêm mới tự đánh giá|thêm kỳ|thêm mới/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    const sel = d.locator('.ant-form-item').filter({ hasText: /bộ chỉ số/i }).locator('.ant-select').first();
    const optsFor = async (kw: string) => {
      await sel.click(); await page.keyboard.press('Control+A'); await page.keyboard.type(kw); await page.waitForTimeout(1200);
      const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
      const t = await dd.locator('.ant-select-item-option').allInnerTexts();
      await page.keyboard.press('Escape'); return t.join('|');
    };
    expect(await optsFor(a.tag), 'bộ đã khóa phải được liệt kê').toContain(a.tag);
    expect(await optsFor(b.tag), 'bộ chưa khóa không được liệt kê').not.toContain(b.tag);
  });
  test(tc('SET-K04'), async () => {
    const s = await mkFilled(1); await lockSet(s.id);
    const cp = await mkCampaign(s.id);
    const r = await api('POST', `${SETS}/${s.id}/unlock`, {});
    expect(r.status, `mở khóa bộ đang được kỳ dùng (HTTP ${r.status}: ${r.message})`).toBe(200);
    expect((await getSet(s.id)).status).toBe('Draft');
    expect((await api('GET', `${CAMPS}/${cp.id}`)).status, 'kỳ vẫn tồn tại').toBe(200);
  });
  test(tc('SET-K05'), async () => {
    const s = await mkFilled(1); await lockSet(s.id);
    const again = await api('POST', `${SETS}/${s.id}/lock`, {});
    expect(again.status).toBe(400); expect(again.message).toMatch(/đã được khoá/i);
    expect((await api('POST', `${SETS}/00000000-0000-4000-8000-000000000000/lock`, {})).status).toBe(404);
  });
});

// ================= CẤU TRÚC: NHÓM CHỈ SỐ =================
test.describe('Bộ chỉ số › Cấu trúc (nhóm chỉ số)', () => {
  test.describe.configure({ timeout: 120_000 });
  test(tc('SET-S01'), async ({ page }) => {
    const s = await mkFilled(2);
    await openBuilder(page, s.id);
    const t = await text(page);
    for (const v of ['Cấu hình bộ chỉ số', 'Chưa khóa', 'Nhóm chỉ số', s.pillar.realCode, s.groups[0].g.realCode, s.groups[1].g.realCode]) expect(t, `thiếu "${v}"`).toContain(v);
    expect(t, 'trụ cột kèm tổng điểm').toMatch(new RegExp(`${s.pillar.realCode}\\s*20 điểm`));
    for (const b of [/^\s*Huỷ\s*$/, /^\s*Lưu\s*$/, /thêm nhóm/i]) await expect(C(page).locator('button', { hasText: b }).first()).toBeVisible();
  });
  test(tc('SET-S02'), async ({ page }) => {
    const tree = await mkTree(2); const s = await mkSet();
    const [x, y] = tree.groups;
    await putGroups(s.id, [x]); await putInds(s.id, indBody(x));
    await openBuilder(page, s.id);
    const m = await openGroupModal(page);
    const rows = await modalSearch(page, m, y.g.realCode);
    await expect(rows).toHaveCount(1);
    await rows.first().locator('input[type=checkbox]').check();
    await expect(m).toContainText(/đã chọn 1 nhóm chỉ số/i);
    await m.locator('button', { hasText: /^\s*Lưu\s*$/ }).last().click(); await expect(m).toBeHidden();
    expect(await text(page)).toContain(y.g.realCode);
    expect(await text(page), 'điểm trụ cột tăng 10 → 20').toMatch(new RegExp(`${tree.pillar.realCode}\\s*20 điểm`));
    expect(await builderSave(page)).toMatch(/cập nhật nội dung bộ chỉ số thành công/i);
    const d = await getSet(s.id);
    const g = d.groups.find((gg: any) => gg.indicatorGroupId === y.g.id || gg.indicatorGroupCode === y.g.realCode);
    expect(d.groups.length).toBe(2);
    expect(g, 'nhóm vừa thêm có trong API').toBeTruthy();
    expect(flatInds({ groups: [g] }).length, 'chỉ số của nhóm được thêm theo').toBe(3);
  });
  test(tc('SET-S03'), async ({ page }) => {
    const s = await mkFilled(1);
    await openBuilder(page, s.id);
    const m = await openGroupModal(page);
    await expect(await modalSearch(page, m, s.groups[0].g.realCode), 'nhóm đã có trong bộ không được liệt kê').toHaveCount(0);
    const r = await api('PUT', `${SETS}/${s.id}/groups`, [1, 2].map(o => ({ indicatorGroupId: s.groups[0].g.id, displayOrder: o, isScored: true })));
    expect(r.status, `API thêm trùng nhóm (HTTP ${r.status}: ${r.message})`).toBe(400);
    expect(r.message).toMatch(/bị trùng lặp/i);
  });
  test(tc('SET-S04'), async ({ page }) => {
    const s = await mkFilled(1);
    const gU = await ensureGroup(made, { pillarId: s.pillar.id, lock: false });
    await openBuilder(page, s.id);
    const m = await openGroupModal(page);
    await expect(m).toContainText(/chọn nhóm chỉ số đã khóa/i);
    await expect(await modalSearch(page, m, gU.realCode), 'nhóm chưa khóa không được liệt kê').toHaveCount(0);
    const r = await api('PUT', `${SETS}/${s.id}/groups`, [{ indicatorGroupId: gU.id, displayOrder: 1, isScored: true }]);
    expect(r.status).toBe(400); expect(r.message).toMatch(/chưa được khóa/i);
  });
  test(tc('SET-S05'), async ({ page }) => {
    const s = await mkFilled(2);
    const [x, y] = s.groups;
    const r = await putGroups(s.id, [y, x]);
    expect(r.status, r.message).toBe(200);
    const d = await getSet(s.id);
    expect(d.groups.map((g: any) => g.indicatorGroupCode)).toEqual([y.g.realCode, x.g.realCode]);
    expect((await api('GET', `dti/indicator-groups/${x.g.id}`)).data?.name, 'nhóm gốc không đổi').toBe(x.g.name);
    await openDetail(page, s.id);
    const t = await text(page);
    expect(t.indexOf(y.g.realCode), 'cây ở chi tiết theo thứ tự mới').toBeLessThan(t.indexOf(x.g.realCode));
  });
  test(tc('SET-S06'), async ({ page }) => {
    const s = await mkFilled(2); const y = s.groups[1];
    await openBuilder(page, s.id);
    await C(page).getByRole('button', { name: `Xóa khỏi bộ chỉ số ${y.g.realCode}`, exact: true }).click();
    await confirmDelete(page);
    expect(await builderSave(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(d.groups.map((g: any) => g.indicatorGroupCode)).toEqual([s.groups[0].g.realCode]);
    expect(indOf(d, y.c1.id), 'chỉ số của nhóm đã xóa rời bộ').toBeFalsy();
    expect((await api('GET', `dti/indicator-groups/${y.g.id}`)).status, 'nhóm gốc còn nguyên').toBe(200);
  });
  test(tc('SET-S07'), async ({ page }) => {
    const s = await mkFilled(1);
    await openBuilder(page, s.id);
    expect(await groupMax(page)).toBe(10);
    await C(page).locator('.ant-switch:not([aria-label])').first().click(); await page.waitForTimeout(500);
    expect(await groupMax(page), 'điểm nhóm về 0').toBe(0);
    expect(await text(page)).toMatch(new RegExp(`${s.pillar.realCode}\\s*0 điểm`));
    expect(await builderSave(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(d.groups[0].isScored).toBe(false);
    expect(flatInds(d).every((i: any) => i.isScored === false), 'mọi chỉ số của nhóm không tính điểm').toBeTruthy();
    await openDetail(page, s.id);
    expect(await totalScore(page)).toBe(0);
  });
  test(tc('SET-S08'), async () => {
    const s = await mkSet();
    const r = await api('PUT', `${SETS}/${s.id}/groups`, [{ indicatorGroupId: '00000000-0000-4000-8000-000000000000', displayOrder: 1, isScored: true }]);
    expect(r.status).toBe(400); expect(r.message).toMatch(/không hợp lệ/i);
  });
  test(tc('SET-S09'), async () => {
    const s = await mkFilled(1); await lockSet(s.id);
    const before = JSON.stringify((await getSet(s.id)).groups);
    const g = await putGroups(s.id, s.groups);
    expect(g.status).toBe(400); expect(g.message).toMatch(/đã khoá, hãy mở khoá trước khi sửa cấu trúc/i);
    const i = await putInds(s.id, indBody(s.groups[0]).map(b => ({ ...b, maxScore: b.maxScore + 1 })));
    expect(i.status).toBe(400); expect(i.message).toMatch(/đã khoá, hãy mở khoá trước khi sửa nội dung/i);
    expect(JSON.stringify((await getSet(s.id)).groups), 'cấu trúc không đổi').toBe(before);
  });
  test(tc('SET-S10'), async ({ page }) => {
    const s = await mkFilled(1); const x = s.groups[0];
    await openBuilder(page, s.id);
    await delInd(page, x.c1.realCode);
    expect(await text(page)).not.toContain(x.c1.realCode);
    await C(page).locator('button', { hasText: /^\s*Huỷ\s*$/ }).first().click();
    await page.waitForURL(u => !/\/builder/.test(u.toString()), { timeout: 15_000 });
    expect(indOf(await getSet(s.id), x.c1.id), 'thay đổi chưa lưu không được ghi').toBeTruthy();
  });
});

// ================= NỘI DUNG: CHỈ SỐ =================
test.describe('Bộ chỉ số › Nội dung (chỉ số)', () => {
  test.describe.configure({ timeout: 120_000 });
  test(tc('SET-I01'), async ({ page }) => {
    const s = await mkFilled(1); const x = s.groups[0];
    await openBuilder(page, s.id);
    const t = await text(page);
    for (const v of ['Tính điểm cho nhóm', 'Điểm tối đa của nhóm', 'Mã', 'Chỉ số', 'Tính điểm', 'Điểm tối thiểu', 'Điểm tối đa', x.par.realCode, x.c1.realCode, x.c2.realCode]) expect(t, `thiếu "${v}"`).toContain(v);
    for (const c of [x.c1, x.c2]) await expect(C(page).locator('tr').filter({ hasText: c.realCode }).last().locator('input[role=spinbutton]'), `chỉ số con ${c.realCode} có 2 ô điểm`).toHaveCount(2);
    expect(await groupMax(page)).toBe(10);
  });
  test(tc('SET-I02'), async ({ page }) => {
    const tree = await mkTree(1); const x = tree.groups[0]; const s = await mkSet();
    await fillStruct(s.id, [x], [x.c1.id]);
    await openBuilder(page, s.id);
    expect(await text(page)).not.toContain(x.c1.realCode);
    expect(await groupMax(page)).toBe(5);
    await C(page).getByRole('button', { name: /thêm chỉ số/i }).click();
    const m = page.locator('.ant-modal').filter({ visible: true }).filter({ hasText: /thêm chỉ số/i }).last(); await m.waitFor();
    await m.locator('.ant-select').first().click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last(); await dd.waitFor();
    await dd.getByText(x.c1.realCode).first().click(); await page.waitForTimeout(400);
    if (await dd.isVisible()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    await m.locator('button', { hasText: /^\s*Thêm chỉ số\s*$/ }).last().click(); await expect(m).toBeHidden();
    expect(await text(page)).toContain(x.c1.realCode);
    expect(await groupMax(page), 'điểm nhóm tăng 5 → 10').toBe(10);
    expect(await builderSave(page)).toMatch(/thành công/i);
    expect(indOf(await getSet(s.id), x.c1.id), 'chỉ số đã thêm có trong API').toBeTruthy();
  });
  test(tc('SET-I03'), async () => {
    const s = await mkFilled(1); const x = s.groups[0];
    const iU = await ensureIndicator(made, { groupId: x.g.id, pillarId: s.pillar.id, max: 5, lock: false });
    const a = await putInds(s.id, [...indBody(x), { indicatorId: iU.id, weight: 1, isScored: true, minScore: 0, maxScore: 5 }]);
    expect(a.status).toBe(400); expect(a.message).toMatch(/có chỉ số chưa được khóa/i);
    const b = await putInds(s.id, [...indBody(x), { indicatorId: x.c1.id, weight: 1, isScored: true, minScore: 0, maxScore: 5 }]);
    expect(b.status).toBe(400); expect(b.message).toMatch(/danh sách chỉ số bị trùng lặp/i);
  });
  test(tc('SET-I04'), async () => {
    const s = await mkFilled(1); const x = s.groups[0];
    const r = await putInds(s.id, indBody(x).map(b => b.indicatorId === x.c1.id ? { ...b, maxScore: 8 } : b));
    expect(r.status, r.message).toBe(200);
    expect(indOf(await getSet(s.id), x.c1.id).maxScore).toBe(8);
    expect((await api('GET', `dti/indicators/${x.c1.id}`)).data.maxScore, 'chỉ số gốc không đổi').toBe(5);
  });
  test(tc('SET-I05'), async ({ page }) => {
    const s = await mkFilled(1); const x = s.groups[0];
    await openBuilder(page, s.id);
    await delInd(page, x.c1.realCode);
    expect(await groupMax(page), 'điểm nhóm giảm 10 → 5').toBe(5);
    expect(await builderSave(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(indOf(d, x.c1.id), 'chỉ số rời bộ').toBeFalsy();
    expect(indOf(d, x.c2.id)).toBeTruthy();
    expect((await api('GET', `dti/indicators/${x.c1.id}`)).status, 'chỉ số gốc còn').toBe(200);
  });
  test(tc('SET-I06'), async ({ page }) => {
    const s = await mkFilled(1); const x = s.groups[0];
    await openBuilder(page, s.id);
    const sw = C(page).getByRole('switch', { name: `Tính điểm ${x.c1.realCode}`, exact: true });
    await sw.click(); await expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(await groupMax(page), 'điểm nhóm 10 → 5').toBe(5);
    expect(await builderSave(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(indOf(d, x.c1.id).isScored).toBe(false); expect(indOf(d, x.c2.id).isScored).toBe(true);
    await openDetail(page, s.id);
    expect(await totalScore(page)).toBe(5);
  });
  test(tc('SET-I07'), async ({ page }) => {
    const s = await mkFilled(1); const x = s.groups[0];
    await openBuilder(page, s.id);
    const inp = C(page).locator('tr').filter({ hasText: x.c1.realCode }).last().locator('input[role=spinbutton]').last();
    await inp.fill('8'); await inp.blur(); await page.waitForTimeout(400);
    expect(await groupMax(page), 'điểm nhóm 10 → 13').toBe(13);
    expect(await builderSave(page)).toMatch(/thành công/i);
    expect(indOf(await getSet(s.id), x.c1.id).maxScore).toBe(8);
    await openDetail(page, s.id);
    expect(await totalScore(page)).toBe(13);
  });
  test(tc('SET-I08'), async ({ page }) => {
    const s = await mkFilled(1); const x = s.groups[0];
    await openBuilder(page, s.id);
    const inp = C(page).locator('tr').filter({ hasText: x.c2.realCode }).last().locator('input[role=spinbutton]').first();
    await inp.fill('9'); await inp.blur(); await page.waitForTimeout(300);
    expect(await builderSave(page)).toMatch(/điểm tối thiểu không được lớn hơn điểm tối đa/i);
    expect(indOf(await getSet(s.id), x.c2.id).minScore, 'không lưu').toBe(0);
    for (const o of [{ maxScore: 1001 }, { minScore: -1 }]) {
      const r = await putInds(s.id, indBody(x).map(b => b.indicatorId === x.c1.id ? { ...b, ...o } : b));
      expect(r.status, `${JSON.stringify(o)} (HTTP ${r.status}: ${r.message})`).toBe(400);
      expect(r.message).toMatch(/từ 0 đến 1000/);
    }
    const ok = await putInds(s.id, indBody(x).map(b => b.indicatorId === x.c1.id ? { ...b, maxScore: 1000 } : b));
    expect(ok.status, `biên 1000 (HTTP ${ok.status}: ${ok.message})`).toBe(200);
  });
  test(tc('SET-I09'), async ({ page }) => {
    const s = await mkFilled(1);
    await openBuilder(page, s.id);
    await C(page).getByRole('button', { name: /thêm chỉ số/i }).click();
    const m = page.locator('.ant-modal').filter({ visible: true }).last(); await m.waitFor();
    await expect(m).toContainText(/không còn chỉ số để thêm/i);
    await m.locator('button', { hasText: /^\s*Đóng\s*$/ }).click(); await expect(m).toBeHidden();
  });
});

// ================= NHÂN BẢN =================
test.describe('Bộ chỉ số › Nhân bản', () => {
  test.describe.configure({ timeout: 90_000 });
  const cloneApi = async (id: string) => { const r = await api('POST', `${SETS}/${id}/clone`, {}); if (r.status !== 200) throw new Error('nhân bản lỗi: ' + r.message); return r.data; };
  test(tc('SET-N01'), async ({ page }) => {
    const s = await mkFilled(1);
    await rowAction(page, await listRow(page, s.tag), /nhân bản/i);
    const box = page.getByRole('dialog', { name: /xác nhận nhân bản/i });
    await expect(box, 'hộp "Xác nhận nhân bản"').toBeVisible();
    await box.getByRole('button', { name: /^\s*Nhân bản\s*$/ }).click();
    expect(await toast(page)).toMatch(/nhân bản bộ chỉ số thành công/i);
    const all = await setsByTag(s.tag);
    const copy = all.find((x: any) => x.id !== s.id);
    expect(copy, 'phải có bản sao').toBeTruthy();
    expect(copy.code).not.toBe(s.code); expect(copy.code).toMatch(/^BCS-\d{3,}$/);
    expect(copy.status).toBe('Draft');
    const [o, c] = [await getSet(s.id), await getSet(copy.id)];
    expect([c.groups.length, flatInds(c).length]).toEqual([o.groups.length, flatInds(o).length]);
  });
  test(tc('SET-N02'), async ({ page }) => {
    const s = await mkFilled(1); await lockSet(s.id);
    const items = await rowMenuItems(page, await listRow(page, s.tag));
    expect(items.some(x => /nhân bản/i.test(x)), `menu bộ đã khóa có Nhân bản: [${items}]`).toBeTruthy();
    const c = await cloneApi(s.id);
    expect((await getSet(c.id)).status).toBe('Draft');
    expect((await getSet(s.id)).status, 'bản gốc vẫn Đã khóa').toBe('Locked');
  });
  test(tc('SET-N04'), async () => {
    const s = await mkFilled(1); const x = s.groups[0];
    const c = await cloneApi(s.id);
    const r = await putInds(c.id, indBody(x).map(b => b.indicatorId === x.c1.id ? { ...b, maxScore: 4 } : b));
    expect(r.status, r.message).toBe(200);
    expect(indOf(await getSet(c.id), x.c1.id).maxScore).toBe(4);
    expect(indOf(await getSet(s.id), x.c1.id).maxScore, 'bản gốc giữ nguyên').toBe(5);
  });
  test(tc('SET-N05'), async () => {
    const r = await api('POST', `${SETS}/00000000-0000-4000-8000-000000000000/clone`, {});
    expect(r.status, `nhân bản id lạ (HTTP ${r.status}: ${r.message})`).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });
});

// ================= EDGE / LỖI (G01, G03..G05 của SET) =================
test.describe('Bộ chỉ số › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 60_000 });
  test(tc('SET-G01'), async ({ page }) => {
    const d = await openAdd(page);
    await fillAdd(page, d, '     ');
    await saveBtn(d).click(); await page.waitForTimeout(700);
    expect(await errorsOf(d)).toMatch(/vui lòng nhập tên bộ chỉ số/i);
    await expect(d).toBeVisible();
  });
  for (const [id, mode] of [['SET-G03', 'http500'], ['SET-G04', 'offline']] as const) {
    test(tc(id), async ({ page }) => {
      const tag = newTag();
      const d = await openAdd(page); await fillAdd(page, d, `qc.automation Bộ ${tag}`);
      const re = /\/api\/v1\/dti\/indicator-sets$/;
      await page.route(re, r => {
        if (r.request().method() !== 'POST') return r.continue();
        return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
      });
      await saveBtn(d).click(); await page.waitForTimeout(1500);
      await expect(d, 'form phải còn mở để người dùng thử lại').toBeVisible();
      expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
      expect(await nameInput(d).inputValue(), 'dữ liệu đã nhập không được mất').toContain(tag);
      await page.unroute(re);
      expect(await setsByTag(tag)).toHaveLength(0);
    });
  }
  test(tc('SET-G05'), async ({ page }) => {
    const tag = newTag();
    const d = await openAdd(page); await fillAdd(page, d, `qc.automation Bộ ${tag}`);
    const b = saveBtn(d);
    await Promise.all([b.click(), b.click({ delay: 30 }).catch(() => {})]);
    await page.waitForTimeout(2500);
    expect(await setsByTag(tag), 'chỉ tạo đúng 1 bản ghi').toHaveLength(1);
  });
});

// ================= PHÂN QUYỀN / HIỆU NĂNG =================
test.describe('Bộ chỉ số › Bảo mật / Hiệu năng', () => {
  registerAuthTest('SET-A01', cfg);
  // quyền Xem/Thêm/Sửa/Xóa/Khóa của tài khoản canbo theo ma trận quyền
  test(tc('SET-A03'), async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/vi/${cfg.route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(page.url() + ' ' + body, 'phải chuyển về màn đăng nhập').toMatch(/login|đăng nhập/);
    expect(await dataRows(page).count(), 'không được lộ dữ liệu').toBe(0);
    await ctx.close();
  });
  registerPerfTest('SET-P01', cfg);
});

// ===== Case bổ sung từ bug GitLab (gộp từ bo-chi-so-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
test.describe(() => {
test.describe.configure({ timeout: 120_000 });

// ---------------------------------------------------------------- API (luôn bằng phiên admin)
const ADM = 'admin';
const A = (m: string, r: string, b?: any, as = ADM) => api(m, r, b, as);
const F = (o: any) => encodeURIComponent(JSON.stringify(o));
const must = (r: any, w: string) => { if (r.status >= 300) throw new Error(`${w}: HTTP ${r.status} ${r.message}`); return r; };
const PIL = 'dti/pillars', IGR = 'dti/indicator-groups', IND = 'dti/indicators', SETS = 'dti/indicator-sets', SCL = 'dti/score-scales', CAMP = 'dti/self-assessment-campaigns';
const TAG = `QCB${Date.now().toString(36).slice(-5).toUpperCase()}`;   // tag của lần chạy (mỗi worker một tag)
let seq = 0;
const nm = (kind: string) => `qc.automation ${kind} ${TAG}${(++seq).toString(36).toUpperCase()}`;
const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();

async function listKw(res: string, kw: string): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 20; p++) {
    const r = await A('GET', `${res}?page=${p}&size=100&filter=${F({ keyword: kw, fullTextSearch: kw })}`);
    out.push(...(r.data?.content ?? []));
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return out.filter(x => String(x.name ?? '').includes(kw));
}
const lockPil = (id: string) => A('PUT', `${PIL}/${id}/lock`, {});
const lockGrp = (id: string) => A('PUT', `${IGR}/${id}/lock`, {});
const lockInd = (id: string) => A('PUT', `${IND}/${id}/lock`, {});
async function mkPillar(name = nm('Trụ cột')) { return must(await A('POST', PIL, { name, description: 'qc.automation mô tả trụ cột', displayOrder: 0 }), 'tạo trụ cột').data; }
async function mkGroup(pillarId: string, name = nm('Nhóm'), lock = true) {
  const g = must(await A('POST', IGR, { pillarId, name, description: 'qc.automation mô tả nhóm', displayOrder: 0 }), 'tạo nhóm').data;
  if (lock) must(await lockGrp(g.id), 'khóa nhóm'); return g;
}
async function mkInd(groupId: string, pillarId: string, o: { name?: string; parentId?: string; max?: number; lock?: boolean } = {}) {
  const r = must(await A('POST', IND, { indicatorGroupId: groupId, pillarId, parentId: o.parentId, name: o.name ?? nm('Chỉ số'), minScore: 0, maxScore: o.max ?? 5 }), 'tạo chỉ số').data;
  if (o.lock) must(await lockInd(r.id), 'khóa chỉ số'); return r;
}
async function mkSet(extra: any = {}) { return must(await A('POST', SETS, { name: nm('Bộ'), effectiveYear: 2026, ...extra }), 'tạo bộ').data; }
const putSetGroups = (id: string, gids: string[]) => A('PUT', `${SETS}/${id}/groups`, gids.map((g, i) => ({ indicatorGroupId: g, displayOrder: i + 1, isScored: true })));
const putSetInds = (id: string, xs: { id: string; max: number; w?: number }[]) =>
  A('PUT', `${SETS}/${id}/indicators`, xs.map((x, i) => ({ indicatorId: x.id, weight: x.w ?? 1, isScored: true, minScore: 0, maxScore: x.max, displayOrder: i + 1 })));
const getScale = async (id: string) => (await A('GET', `${SCL}/${id}`)).data;
const lvBody = (lv: [string, number][]) => lv.map(([name, to], i) => ({ name, fromPercent: i ? lv[i - 1][1] : 0, toPercent: to }));
async function mkScale(o: { lock?: boolean; levels?: any[] } = {}) {
  const s = must(await A('POST', SCL, { name: nm('Thang'), levels: o.levels ?? lvBody([['Kém', 50], ['Tốt', 100]]) }), 'tạo thang').data;
  if (o.lock) must(await A('POST', `${SCL}/${s.id}/lock?rowVersion=${(await getScale(s.id)).rowVersion}`, {}), 'khóa thang');
  return await getScale(s.id);
}

// ---------------------------------------------------------------- Dữ liệu nền dùng chung (lazy, mỗi worker tạo một lần)
let _fx: Promise<any> | undefined;
/** Trụ cột → nhóm (khóa) → chỉ số cha (khóa) + 2 con 5đ/3đ (khóa); thêm 1 chỉ số Chưa khóa (c3) và 1 Đã khóa (c4) chưa có trong bộ;
 *  bộ chỉ số Chưa khóa chứa nhóm + cha + 2 con. */
const fx = () => (_fx ??= (async () => {
  const p = await mkPillar(); must(await lockPil(p.id), 'khóa trụ cột');
  const g = await mkGroup(p.id);
  const par = await mkInd(g.id, p.id, { name: nm('Chỉ số cha'), max: 10 });
  const c1 = await mkInd(g.id, p.id, { name: nm('Chỉ số con 5đ'), parentId: par.id, max: 5, lock: true });
  const c2 = await mkInd(g.id, p.id, { name: nm('Chỉ số con 3đ'), parentId: par.id, max: 3, lock: true });
  must(await lockInd(par.id), 'khóa chỉ số cha');
  const c3 = await mkInd(g.id, p.id, { name: nm('Chỉ số chưa khóa'), max: 4 });
  const c4 = await mkInd(g.id, p.id, { name: nm('Chỉ số đã khóa'), max: 4, lock: true });
  const s = await mkSet({ description: 'qc.automation mô tả bộ' });
  must(await putSetGroups(s.id, [g.id]), 'ghi nhóm vào bộ');
  must(await putSetInds(s.id, [{ id: par.id, max: 8, w: 0 }, { id: c1.id, max: 5 }, { id: c2.id, max: 3 }]), 'ghi chỉ số vào bộ');
  const get = async (r: string, id: string) => (await A('GET', `${r}/${id}`)).data;
  return { p: await get(PIL, p.id), g: await get(IGR, g.id), par: await get(IND, par.id), c1, c2, c3, c4, s: await get(SETS, s.id) };
})());
let _big: Promise<any> | undefined;
/** Bộ lớn: 9 nhóm (nhóm 1 tên ~320 ký tự), 50 chỉ số (chỉ số 1 tên ~320 ký tự) → cấu trúc > 50 dòng. */
const LONG = ' Tên rất dài để kiểm tra bố cục trang cấu hình'.repeat(8);
const big = () => (_big ??= (async () => {
  const { p } = await fx();
  const groups: { g: any; inds: any[] }[] = [];
  for (let i = 0; i < 9; i++) groups.push({ g: await mkGroup(p.id, i === 0 ? (nm('Nhóm dài') + LONG).slice(0, 320) : nm(`Nhóm ${i}`)), inds: [] });
  for (let k = 0; k < 50; k++) {
    const gi = k < 42 ? 0 : k - 41;
    groups[gi].inds.push(await mkInd(groups[gi].g.id, p.id, { name: k === 0 ? (nm('Chỉ số dài') + LONG).slice(0, 320) : nm(`CS ${k}`), max: 2, lock: true }));
  }
  const s = await mkSet();
  must(await putSetGroups(s.id, groups.map(x => x.g.id)), 'ghi nhóm bộ lớn');
  must(await putSetInds(s.id, groups.flatMap(x => x.inds.map(i => ({ id: i.id, max: 2 })))), 'ghi chỉ số bộ lớn');
  return { s, groups, longGroup: (await A('GET', `${IGR}/${groups[0].g.id}`)).data.name as string, longInd: (await A('GET', `${IND}/${groups[0].inds[0].id}`)).data.name as string };
})());
let _base: Promise<any> | undefined;
/** Dữ liệu nền dùng chung có sẵn (CHỈ ĐỌC / dùng để tạo kỳ Nháp): bộ BCS-001, thang TXL-001, đơn vị QC_DP, QC_BO. */
const base = () => (_base ??= (async () => {
  const find = async (res: string, code: string) => {
    const r = await A('GET', `${res}?page=1&size=50&filter=${F({ keyword: code, fullTextSearch: code })}`);
    const x = (r.data?.content ?? []).find((y: any) => y.code === code); if (!x) throw new Error(`thiếu dữ liệu nền ${res} ${code}`); return x;
  };
  const set = await find(SETS, 'BCS-001'), scale = await find(SCL, 'TXL-001'), dp = await find('organizations', 'QC_DP'), bo = await find('organizations', 'QC_BO');
  return { set, scale, dp, bo };
})());
async function mkCamp(o: { orgs?: string[]; name?: string } = {}) {
  const b = await base();
  const c = must(await A('POST', CAMP, { name: o.name ?? nm('kỳ'), type: 'AdHoc', indicatorSetId: b.set.id, scaleId: b.scale.id, startDate: '2026-11-13T00:00:00', endDate: '2026-11-30T23:59:59' }), 'tạo kỳ').data;
  if (o.orgs?.length) must(await A('PUT', `${CAMP}/${c.id}/organizations`, o.orgs), 'phân công');
  return (await A('GET', `${CAMP}/${c.id}`)).data;
}
const getCamp = async (id: string) => (await A('GET', `${CAMP}/${id}`)).data;
const orgCount = async (id: string) => ((await getCamp(id)).organizations ?? []).length;

// ---------------------------------------------------------------- Dọn dữ liệu (quét theo TAG)
const leftovers: string[] = [];
test.afterAll(async ({}, ti) => {
  ti.setTimeout(600_000);
  for (const c of await listKw(CAMP, TAG)) { const r = await A('DELETE', `${CAMP}/${c.id}`); if (r.status >= 300) leftovers.push(`kỳ ${c.name} (${c.status})`); }
  for (const s of await listKw(SETS, TAG)) { if (s.status === 'Locked') await A('POST', `${SETS}/${s.id}/unlock`, {}); const r = await A('DELETE', `${SETS}/${s.id}`); if (r.status >= 300) leftovers.push(`bộ ${s.code} ${s.name}: ${r.message}`); }
  for (const s of await listKw(SCL, TAG)) {
    const g = await getScale(s.id); if (g?.isLocked) await A('POST', `${SCL}/${s.id}/unlock?rowVersion=${g.rowVersion}`, {});
    const r = await A('DELETE', `${SCL}/${s.id}`); if (r.status >= 300) leftovers.push(`thang ${s.code} ${s.name}: ${r.message}`);
  }
  const inds = await listKw(IND, TAG);
  inds.sort((a, b) => Number(!!b.parentId) - Number(!!a.parentId));   // con trước, cha sau
  for (const x of inds) { if (x.isLocked) await A('PUT', `${IND}/${x.id}/unlock`, {}); }
  for (const x of inds) { const r = await A('DELETE', `${IND}/${x.id}`); if (r.status >= 300) leftovers.push(`chỉ số ${x.code}: ${r.message}`); }
  for (const x of await listKw(IGR, TAG)) { if (x.isLocked) await A('PUT', `${IGR}/${x.id}/unlock`, {}); const r = await A('DELETE', `${IGR}/${x.id}`); if (r.status >= 300) leftovers.push(`nhóm ${x.code}: ${r.message}`); }
  for (const x of await listKw(PIL, TAG)) { if (x.isLocked) await A('PUT', `${PIL}/${x.id}/unlock`, {}); const r = await A('DELETE', `${PIL}/${x.id}`); if (r.status >= 300) leftovers.push(`trụ cột ${x.code}: ${r.message}`); }
  if (leftovers.length) console.log(`[bug-gitlab B] dữ liệu không xóa được (tag ${TAG}):\n  ` + leftovers.join('\n  '));
});

// ---------------------------------------------------------------- Helper UI
const C = (p: Page) => p.locator('.ant-layout-content').first();
const ctext = async (p: Page) => norm(await C(p).innerText());
async function go(page: Page, route: string) {
  await page.goto(`${BASE}/vi/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
}
async function goDetail(page: Page, route: string, ready: string | RegExp) {
  await go(page, route);
  if (!(await C(page).getByText(ready).first().isVisible().catch(() => false))) { await page.reload({ waitUntil: 'networkidle' }); }
  await C(page).getByText(ready).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
}
const btn = (scope: Page | Locator, re: RegExp) => scope.locator('button').filter({ hasText: re }).filter({ visible: true });
/** font-weight của nút văn bản đầu tiên (không rỗng) trong phần tử. */
const textWeight = (l: Locator) => l.evaluate(e => {
  const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.textContent ?? '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
  const n = w.nextNode(); return getComputedStyle((n?.parentElement ?? e) as Element).fontWeight;
});
/** innerText nếu phần tử đang có, không thì '' (tránh chờ vô hạn). */
const textIf = async (l: Locator) => ((await l.count()) ? await l.innerText({ timeout: 5000 }).catch(() => '') : '');
const modal = (p: Page) => p.locator('.ant-modal').filter({ visible: true }).last();
async function searchList(page: Page, ph: RegExp, kw: string) { await page.getByPlaceholder(ph).first().fill(kw); await page.waitForTimeout(1800); }

// ---------------------------------------------------------------- Đọc .xlsx (unzip + XML, không cần thư viện)
type Cell = { v: string; t: string; fmt: string };
function readXlsx(file: string, sheet = 1): Record<string, Cell> {
  const x = (p: string) => { try { return execFileSync('unzip', ['-p', file, p]).toString(); } catch { return ''; } };
  const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const sst = [...x('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const styles = x('xl/styles.xml');
  const fmts: Record<string, string> = { '0': 'General' };
  for (const m of styles.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)) fmts[m[1]] = dec(m[2]);
  const xfs = [...(styles.match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] ?? '').matchAll(/<xf\b([^>]*)/g)].map(m => m[1].match(/numFmtId="(\d+)"/)?.[1] ?? '0');
  const out: Record<string, Cell> = {};
  for (const m of x(`xl/worksheets/sheet${sheet}.xml`).matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[2], body = m[3] ?? '';
    const t = attrs.match(/\bt="(\w+)"/)?.[1] ?? 'n', s = attrs.match(/\bs="(\d+)"/)?.[1] ?? '0';
    let v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
    if (t === 's') v = sst[Number(v)] ?? ''; else v = dec(v);
    out[m[1]] = { v, t: body ? t : '', fmt: fmts[xfs[Number(s)] ?? '0'] ?? `#${xfs[Number(s)]}` };
  }
  return out;
}
/** Giá trị Excel HIỂN THỊ (đủ cho định dạng General / 0 / 0.0 / #,##0.0 …). */
function shown(c?: Cell): string {
  if (!c || c.v === '') return '';
  if (c.t !== 'n') return c.v;
  const dec = c.fmt.match(/0\.(0+)/)?.[1].length ?? 0;
  return dec ? Number(c.v).toFixed(dec) : String(Number(c.v));
}
const rowsOf = (cells: Record<string, Cell>) => {
  const rows: Record<number, Record<string, Cell>> = {};
  for (const [ref, c] of Object.entries(cells)) { const m = ref.match(/^([A-Z]+)(\d+)$/)!; (rows[Number(m[2])] ??= {})[m[1]] = c; }
  return rows;
};
async function download(page: Page, click: () => Promise<any>, name: string) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), click()]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcb-dl-'));
  const f = path.join(dir, name); await dl.saveAs(f); return { file: f, suggested: dl.suggestedFilename() };
}

// ====================================================================== TRỤ CỘT
guardSession(test);

// ====================================================================== NHÓM CHỈ SỐ

// ====================================================================== CHỈ SỐ

// ====================================================================== BỘ CHỈ SỐ
const openSetDetail = (page: Page, id: string) => goDetail(page, `indicator-sets/${id}`, 'Cấu trúc bộ chỉ số');
const openBuilder = async (page: Page, id: string) => { await goDetail(page, `indicator-sets/${id}/builder`, 'Cấu hình bộ chỉ số'); await page.waitForTimeout(800); };
const structSearch = (page: Page) => C(page).getByPlaceholder(/tìm trụ cột, nhóm chỉ số, chỉ số/i);

test.describe('Bộ chỉ số', () => {
  test.describe.configure({ timeout: 300_000 });
  test(tc('SET-V16'), async ({ page }) => {
    const { p, g, s, c1, c2 } = await fx();
    await openSetDetail(page, s.id);
    await structSearch(page).fill(c1.name); await page.waitForTimeout(1500);
    const t = await ctext(page);
    expect(t, 'không được báo "chưa có cấu trúc"').not.toContain('Bộ chỉ số chưa có cấu trúc');
    expect(t, 'dòng khớp từ khóa').toContain(c1.name);
    expect(t, 'kèm trụ cột cha').toContain(p.name); expect(t, 'kèm nhóm cha').toContain(g.name);
    expect(t, 'dòng không khớp bị lọc bỏ').not.toContain(c2.name);
  });
  test(tc('SET-V17'), async ({ page }) => {
    const { s } = await fx();
    await openSetDetail(page, s.id);
    await structSearch(page).fill('zzqcxx_khongtontai_999'); await page.waitForTimeout(1500);
    const t = await ctext(page);
    expect(t).not.toContain('Bộ chỉ số chưa có cấu trúc');
    expect(t).toContain('Không tìm thấy dữ liệu phù hợp');
  });
  test(tc('SET-V18'), async ({ page }) => {
    const { s } = await fx();
    await openSetDetail(page, s.id);
    const th = C(page).locator('th').filter({ hasText: /^Tên$/ }).first();
    const other = C(page).locator('th').filter({ hasText: /^Tính điểm$/ }).first();
    const w0 = (await th.boundingBox())!.width;
    const sep = th.locator('[role=separator]');
    expect(await sep.count(), 'tiêu đề cột Tên có tay kéo đổi độ rộng').toBeGreaterThan(0);
    const b = (await sep.first().boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + 60, b.y + b.height / 2, { steps: 8 }); await page.mouse.move(b.x + 120, b.y + b.height / 2, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(600);
    const w1 = (await th.boundingBox())!.width;
    expect(Math.abs(w1 - w0), `độ rộng cột Tên trước ${w0}px, sau khi kéo ${w1}px`).toBeGreaterThan(30);
    await expect(other, 'các cột khác vẫn hiển thị').toBeVisible();
  });
  test(tc('SET-C12'), async ({ page }) => {
    await go(page, 'indicator-sets');
    await btn(page, /thêm bộ chỉ số/i).first().click();
    const d = dlg(page); await d.waitFor(); await page.waitForTimeout(500);
    await d.getByPlaceholder(/nhập tên bộ chỉ số/i).fill('qc.automation không lưu');
    await d.locator('textarea').first().fill('mô tả không lưu');
    const counters = await d.locator('.ant-input-show-count-suffix, .ant-input-data-count').allInnerTexts();
    const txt = norm(await d.innerText());
    expect({ counters, match: txt.match(/\d+\s*\/\s*\d{2,4}/g) ?? [] }, 'popup Thêm bộ chỉ số còn bộ đếm ký tự').toEqual({ counters: [], match: [] });
  });
  test(tc('SET-C13'), async ({ page }) => {
    await go(page, 'indicator-sets');
    await btn(page, /thêm bộ chỉ số/i).first().click();
    const d = dlg(page); await d.waitFor(); await page.waitForTimeout(500);
    expect(norm(await d.innerText()), 'không có dòng "* Trường bắt buộc"').not.toMatch(/trường bắt buộc/i);
    const lbl = d.locator('label', { hasText: /^Tên bộ chỉ số$/ }).first();
    const mark = await lbl.evaluate(e => [getComputedStyle(e, '::before').content, getComputedStyle(e, '::after').content, e.textContent ?? ''].join(' '));
    expect(mark, 'label trường bắt buộc vẫn có dấu *').toContain('*');
  });
  test(tc('SET-I10'), async ({ page }) => {
    const b = await big();
    await openBuilder(page, b.s.id);
    const scrollParent = (l: Locator) => l.evaluate(el => {
      let e: HTMLElement | null = el.parentElement;
      while (e && e !== document.body) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2) { e.setAttribute('data-qc-scroll', String(Math.random())); return e.getAttribute('data-qc-scroll'); } e = e.parentElement; }
      return '';
    });
    const gScroll = await scrollParent(C(page).getByText(b.groups[8].g.name).first());
    const iScroll = await scrollParent(C(page).locator('tbody tr.ant-table-row').first());
    expect(gScroll, 'cột nhóm có vùng cuộn riêng').not.toBe('');
    expect(iScroll, 'bảng chỉ số có vùng cuộn riêng').not.toBe('');
    expect(gScroll, 'cột nhóm và bảng chỉ số cuộn độc lập').not.toBe(iScroll);
    for (const k of [gScroll, iScroll]) await page.locator(`[data-qc-scroll="${k}"]`).evaluate(e => { e.scrollTop = e.scrollHeight; });
    await page.waitForTimeout(500);
    await expect(C(page).getByText(b.groups[8].g.name).first(), 'xem được nhóm cuối').toBeInViewport();
    await expect(C(page).locator('tbody tr.ant-table-row').last(), 'xem được chỉ số cuối').toBeInViewport();
    for (const re of [/^\s*Lưu\s*$/, /^\s*Hu[ỷy]\s*$/]) await expect(btn(C(page), re).first(), `nút ${re} luôn truy cập được`).toBeInViewport();
  });
  test(tc('SET-I14'), async ({ page }) => {
    const b = await big();
    await openBuilder(page, b.s.id);
    const check = async (full: string, what: string) => {
      const el = C(page).getByText(full.slice(0, 40)).first();
      await el.scrollIntoViewIfNeeded();
      const st = await el.evaluate(e => ({ cut: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1, title: e.getAttribute('title') ?? e.closest('[title]')?.getAttribute('title') ?? '' }));
      if (!st.cut) return;   // không bị rút gọn → đã hiện đủ tên
      await el.hover({ timeout: 8000 }).catch(() => el.hover({ force: true, timeout: 8000 }).catch(() => {})); await page.waitForTimeout(1000);
      const tip = norm(await textIf(page.locator('.ant-tooltip, .ant-popover').filter({ visible: true }).last()));
      expect.soft(norm(tip) === norm(full) || norm(st.title) === norm(full), `${what} bị rút gọn nhưng di chuột không hiện tên đầy đủ (tooltip "${tip.slice(0, 60)}…", title ${st.title.length} ký tự / tên ${full.length})`).toBe(true);
    };
    await check(b.longGroup, 'tên nhóm');
    await check(b.longInd, 'tên chỉ số');   // nhóm dài là nhóm đầu tiên → đang được chọn sẵn
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('SET-I15'), async ({ page }) => {
    // So với bộ tên ngắn (fx.s): tên dài không được làm bảng rộng ra, nút Xoá / ô điểm vẫn thẳng hàng, tên nằm gọn trong ô / cột.
    const tableW = async () => Math.round((await C(page).locator('table').first().boundingBox())!.width);
    const { s: small } = await fx();
    await openBuilder(page, small.id); const w0 = await tableW();
    const b = await big();
    await openBuilder(page, b.s.id); const w1 = await tableW();
    expect.soft(w1, `bảng chỉ số rộng ${w1}px khi có tên dài (tên ngắn: ${w0}px)`).toBeLessThanOrEqual(w0 + 2);
    const xs = async (sel: string) => (await C(page).locator('tbody tr.ant-table-row').evaluateAll((rs, s) => rs.slice(0, 8).map(r => Math.round(r.querySelector(s)?.getBoundingClientRect().left ?? -1)), sel)).filter(x => x >= 0);
    const del = await xs('button[aria-label^="Xoá"]'), max = await xs('input[aria-label^="Điểm tối đa"]');
    expect.soft(del.length, 'có nút Xoá trên các dòng').toBeGreaterThan(1);
    expect.soft(new Set(del).size, `nút Xoá không thẳng hàng: ${del}`).toBe(1);
    expect.soft(new Set(max).size, `ô Điểm tối đa không thẳng hàng: ${max}`).toBe(1);
    const fits = async (full: string, container: string) => C(page).getByText(full.slice(0, 40)).first().evaluate((e, sel) => {
      const c = e.closest(sel) as HTMLElement | null; if (!c) return 'không tìm thấy khung chứa';
      const r = e.getBoundingClientRect(), k = c.getBoundingClientRect();
      return r.right <= k.right + 1 && r.bottom <= k.bottom + 1 ? '' : `tràn: tên [${Math.round(r.left)},${Math.round(r.right)}]×${Math.round(r.bottom)} khung [${Math.round(k.left)},${Math.round(k.right)}]×${Math.round(k.bottom)}`;
    }, container);
    expect.soft(await fits(b.longInd, 'td'), 'tên chỉ số dài nằm gọn trong ô').toBe('');
    expect.soft(await fits(b.longGroup, 'button, li, a, [role=button], div.rounded-lg, div[class*=border]'), 'tên nhóm dài nằm gọn trong khung nhóm').toBe('');
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('SET-I16'), async ({ page }) => {
    const { s, c3, c4 } = await fx();
    await openBuilder(page, s.id);
    await btn(C(page), /^\s*Thêm chỉ số\s*$/).first().click();
    const m = modal(page); await m.waitFor(); await page.waitForTimeout(800);
    await m.locator('.ant-select').first().click(); await page.waitForTimeout(2000);
    const opts = norm(await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().innerText());
    expect.soft(opts, 'chỉ số Đã khóa phải có trong danh sách chọn').toContain(c4.code);
    expect.soft(opts, 'chỉ số Chưa khóa không được có trong danh sách chọn').not.toContain(c3.code);
    expect(test.info().errors.length).toBe(0);
  });
});

// ====================================================================== BỘ CHỈ SỐ — Xuất Excel chi tiết BCS-333 (catalog-BUG.mjs, #289) — CHỈ ĐỌC
const B333 = '2c5306e7-4c6c-46ed-b526-88ffbc4b3dad';
let _x333: Promise<any> | undefined;
async function x333(page: Page) {
  return (_x333 ??= (async () => {
    await openSetDetail(page, B333);
    const t = await ctext(page);
    expect(t, 'đúng bộ BCS-333').toContain('BCS-333');
    const screen = (await C(page).locator('tbody tr.ant-table-row').evaluateAll(rs => rs.map(r => [...r.querySelectorAll('td')].map(td => (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim()))));
    const updated = t.match(/Cập nhật lần cuối\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/)?.[1] ?? '';
    const { file } = await download(page, () => btn(C(page), /xuất excel/i).first().click(), 'bcs-333.xlsx');
    const cells = readXlsx(file); const rows = rowsOf(cells);
    const info: Record<string, Cell> = {};
    for (const r of Object.values(rows)) if (r.A && r.B && !r.C?.v) info[r.A.v] = r.B;
    const hr = Number(Object.entries(rows).find(([, r]) => Object.values(r).some(c => c.v === 'Điểm tối đa'))?.[0] ?? 0);
    const head = Object.fromEntries(Object.entries(rows[hr] ?? {}).map(([col, c]) => [c.v, col]));
    const data: Record<string, Cell>[] = [];
    for (let i = hr + 1; rows[i]; i++) data.push(rows[i]);
    return { screen, updated, info, head, data };
  })());
}
const NONE = (s: string) => (/^[–—-]?$/.test((s ?? '').trim()) ? '' : s.trim());
test.describe('Bộ chỉ số › Xuất Excel BCS-333', () => {
  test(tc('SET-V09'), async ({ page }) => {
    const x = await x333(page);
    for (const h of ['Tên', 'Tính điểm', 'Điểm tối thiểu', 'Điểm tối đa']) expect.soft(Object.keys(x.head), `file thiếu cột "${h}"`).toContain(h);
    for (const extra of ['Số nhóm', 'Số chỉ số']) expect.soft(Object.keys(x.head), `file thừa cột "${extra}"`).not.toContain(extra);
    const nameCol = x.head['Tên'] ?? 'B';
    for (const [name, sc, mn] of x.screen) {
      const r = x.data.find(d => norm(d[nameCol]?.v) === norm(name));
      expect.soft(r, `file thiếu dòng "${name}"`).toBeTruthy(); if (!r) continue;
      expect.soft(NONE(shown(r[x.head['Tính điểm']])), `Tính điểm "${name}"`).toBe(NONE(sc));
      expect.soft(NONE(shown(r[x.head['Điểm tối thiểu']])).replace(/\.0+$/, ''), `Điểm tối thiểu "${name}"`).toBe(NONE(mn));
    }
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('SET-V10'), async ({ page }) => {
    const x = await x333(page);
    const nameHead = Object.keys(x.head).find(h => /tên|trụ cột|nhóm/i.test(h)) ?? '';
    const ok = /^tên$/i.test(nameHead) || (/trụ cột/i.test(nameHead) && /nhóm/i.test(nameHead) && /chỉ số\s*$/i.test(nameHead.replace(/nhóm chỉ số/i, '')));
    expect(ok, `tiêu đề cột tên trong file: "${nameHead}"`).toBe(true);
  });
});

// ====================================================================== THANG XẾP LOẠI
const lvRows = (p: Page) => C(p).locator('tbody tr.ant-table-row');

// ====================================================================== QUẢN LÝ TỰ ĐÁNH GIÁ
const CR = 'self-assessment-campaigns';
const openCampDetail = (page: Page, id: string) => goDetail(page, `${CR}/${id}`, 'Mã kỳ');
async function unitsTab(page: Page, id: string) {
  await openCampDetail(page, id);
  await btn(C(page), /^\s*Đơn vị tham gia\s*$/).first().click(); await page.waitForTimeout(1800);
}
/** Tiêu đề cột của bảng Đơn vị tham gia (tab Chi tiết bị ẩn vẫn còn bảng trong DOM). */
const unitHeads = async (page: Page) => (await C(page).locator('table').filter({ has: page.locator('th', { hasText: /^Mã đơn vị$/ }) }).first().locator('thead th').allInnerTexts()).map(norm);
async function openAddCamp(page: Page) {
  await go(page, CR);
  await btn(page, /^\s*Thêm tự đánh giá\s*$/).first().click();
  const d = dlg(page); await d.waitFor(); await page.waitForTimeout(600); return d;
}
const fItem = (page: Page, d: Locator, re: RegExp) => d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: re }) });
async function selIn(page: Page, d: Locator, label: RegExp, opt: string, typed?: string) {
  await fItem(page, d, label).locator('.ant-select').first().click();
  if (typed) { await page.keyboard.type(typed); }
  await page.waitForTimeout(1000);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option', { hasText: opt }).first().click();
  await page.waitForTimeout(400);
}
async function setDate(page: Page, d: Locator, label: RegExp, v: string) {
  const i = fItem(page, d, label).locator('input').first(); await i.click(); await i.fill(v); await i.press('Enter'); await page.waitForTimeout(300);
}
async function fillCamp(page: Page, d: Locator, o: { name: string; type: 'Định kỳ' | 'Đột xuất'; period?: string; units: string[] }) {
  const b = await base();
  await d.getByPlaceholder(/nhập tên đánh giá/i).fill(o.name);
  await selIn(page, d, /^Loại kỳ$/, o.type);
  if (o.type === 'Định kỳ') await selIn(page, d, /^Kỳ$/, o.period ?? 'Quý');
  else { await setDate(page, d, /^Ngày bắt đầu$/, '13/11/2026'); await setDate(page, d, /^Ngày kết thúc$/, '30/11/2026'); }
  await selIn(page, d, /^Bộ chỉ số áp dụng$/, b.set.name, '001');
  await selIn(page, d, /^Thang xếp loại$/, 'TXL-001');
  for (const u of o.units) { await selIn(page, d, /^Đơn vị tham gia$/, u, u); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
}
async function saveCamp(page: Page, d: Locator) {
  await btn(d, /^\s*Lưu\s*$/).last().click();
  const t: string[] = [];
  for (let i = 0; i < 10; i++) { t.push(...await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()); await page.waitForTimeout(300); }
  return norm([...new Set(t)].join(' | '));
}

// ====================================================================== ATB — validate Mã ở API (#208)
const RES3 = [PIL, IGR, IND] as const;
async function postWithCode(res: string, code: any) {
  const { p, g } = await fx();
  const body: any = res === PIL ? { code, name: nm('ATB trụ cột'), displayOrder: 0 }
    : res === IGR ? { pillarId: p.id, code, name: nm('ATB nhóm'), displayOrder: 0 }
    : { indicatorGroupId: g.id, pillarId: p.id, code, name: nm('ATB chỉ số'), minScore: 0, maxScore: 1 };
  const r = await A('POST', res, body);
  return { status: r.status, message: r.message, code: r.data?.code };
}
});
