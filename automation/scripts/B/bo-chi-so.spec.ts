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
