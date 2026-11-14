// B.TXL THANG XẾP LOẠI — script bám testcase SCL-* (testcases/docs/catalog.json)
// Lưu ý API: khóa/mở khóa là POST dti/score-scales/{id}/lock|unlock?rowVersion=N (không phải PUT).
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, WRITE, PAGES, dataRows, openList, searchFor, waitList, rowTexts, findRow, pickOption, dlg,
  btnCancel, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, code8, goto, FILTERS, SPECIAL_NAME,
  registerAuthTest, registerPerfTest, registerNotFoundTest,
} from './common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BASE } from '../helpers';
import { guardSession } from '../session-guard';

const cfg = PAGES.SCL;
const R = 'dti/score-scales', CAMP = 'dti/self-assessment-campaigns';
const MSG104 = /đang được kỳ sử dụng nên không thể sửa, mở khóa hoặc xóa/i;

// ---------- Dữ liệu test & dọn dẹp ----------
const mk = { scales: [] as string[], camps: [] as string[] };
async function cleanAll() {
  for (const id of mk.camps.splice(0).reverse()) await api('DELETE', `${CAMP}/${id}`).catch(() => {});
  for (const id of mk.scales.splice(0).reverse()) {
    const g = await api('GET', `${R}/${id}`).catch(() => null);
    if (!g || g.status !== 200) continue;
    if (g.data.isLocked) await api('POST', `${R}/${id}/unlock?rowVersion=${g.data.rowVersion}`, {});
    await api('DELETE', `${R}/${id}`);
  }
}
test.afterEach(async () => { await cleanAll(); });

type Lv = [string, number];
let seq = 0;
const sname = () => `qc.automation Thang ${code8()}${(++seq).toString(36)}`;
const lvBody = (lv: Lv[]) => lv.map(([name, to], i) => ({ name, fromPercent: i ? lv[i - 1][1] : 0, toPercent: to }));
const LV2: Lv[] = [['Kém', 50], ['Tốt', 100]];
const LV3: Lv[] = [['Kém', 40], ['Khá', 90], ['Tốt', 100]];
const getScale = async (id: string) => (await api('GET', `${R}/${id}`)).data;
const lockApi = async (id: string) => api('POST', `${R}/${id}/lock?rowVersion=${(await getScale(id)).rowVersion}`, {});
const unlockApi = async (id: string) => api('POST', `${R}/${id}/unlock?rowVersion=${(await getScale(id)).rowVersion}`, {});
async function mkScale(o: { name?: string; desc?: string; lv?: Lv[]; lock?: boolean } = {}) {
  const r = await api('POST', R, { name: o.name ?? sname(), description: o.desc, levels: lvBody(o.lv ?? LV2) });
  if (r.status !== 200) throw new Error(`tạo thang lỗi ${r.status} ${r.message}`);
  mk.scales.push(r.data.id);
  if (o.lock) { const l = await lockApi(r.data.id); if (l.status !== 200) throw new Error('khóa thang lỗi: ' + l.message); }
  return (o.lock ? await getScale(r.data.id) : r.data) as any;
}
let setId = '';
async function lockedSetId() {
  if (setId) return setId;
  const r = await api('GET', `dti/indicator-sets?page=1&size=20&filter=${encodeURIComponent(JSON.stringify({ status: 'Locked' }))}`);
  setId = r.data.content[0].id; return setId;
}
/** Thang đã gán cho kỳ: tạo thang → khóa → tạo kỳ đột xuất dùng thang đó. */
async function mkAssigned(lv: Lv[] = LV3) {
  const s = await mkScale({ lv, lock: true });
  const r = await api('POST', CAMP, { name: `qc.automation kỳ ${code8()}`, type: 'AdHoc', indicatorSetId: await lockedSetId(), startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T00:00:00.000Z', scaleId: s.id });
  if (r.status !== 200) throw new Error(`tạo kỳ lỗi ${r.status} ${r.message}`);
  mk.camps.push(r.data.id);
  return { ...(await getScale(s.id)), campName: r.data.name as string };
}

// ---------- Helper UI ----------
const content = (p: Page) => p.locator('.ant-layout-content').first();
const contentText = async (p: Page) => (await content(p).innerText()).replace(/\s+/g, ' ');
const BTN = (p: Page, re: RegExp) => p.getByRole('button', { name: re }).filter({ visible: true });
const PH_NAME = 'Vui lòng nhập tên thang', PH_LV = 'Vui lòng nhập tên mức';
const lvRows = (p: Page) => p.locator('tbody tr.ant-table-row');
const lvName = (p: Page, i: number) => lvRows(p).nth(i).locator('input').first();
const lvEnd = (p: Page, i: number) => lvRows(p).nth(i).locator('input').last();
const nameInp = (p: Page) => p.getByPlaceholder(PH_NAME);
const saveBtn = (p: Page) => p.getByRole('button', { name: /^\s*Lưu\s*$/ });
const footer = async (p: Page) => (await saveBtn(p).locator('xpath=../..').innerText()).replace(/\s*Huỷ\s*Lưu\s*$/, '').replace(/\s+/g, ' ').trim();
const SUA = /^(sửa|cập nhật|chỉnh sửa)$/i, KHOA = /^kh(oá|óa)$/i, MOKHOA = /^mở kh(oá|óa)$/i, XOA = /^x(oá|óa)$/i;
const idOfUrl = (u: string) => u.match(/score-scales\/([0-9a-f-]{36})/i)?.[1];

async function total(page: Page): Promise<number> {
  const pager = page.locator('.ant-pagination').first();
  const t = (await pager.count() ? await pager.innerText() : '').replace(/\s+/g, ' ');
  const m = t.match(/trong\s+(\d+)/i) ?? t.match(/hiển thị\s+(\d+)\s+thang/i);
  return m ? Number(m[1]) : await dataRows(page).count();
}
async function codeOfRow(row: Locator) {
  return ((await row.locator('td').first().innerText()).split('\n').map(s => s.trim()).filter(Boolean))[1];
}
async function nameOfRow(row: Locator) {
  return ((await row.locator('td').first().innerText()).split('\n').map(s => s.trim()).filter(Boolean))[0];
}
/** Đủ dữ liệu để phân trang (chỉ khi được ghi): tạo thêm thang cho đến khi > 10 bản ghi. */
async function padScales(page: Page) {
  if (!WRITE) return;
  const n = await total(page);
  if (n > 10) return;
  for (let i = n; i < 12; i++) await mkScale();
  await page.reload(); await waitList(page);
}
async function openDetail(page: Page, id: string) {
  await goto(page, `score-scales/${id}`);
  await content(page).getByText('Thông tin chung').first().waitFor({ timeout: 10_000 });
}
async function openEditUrl(page: Page, id: string) {
  await goto(page, `score-scales/${id}/edit`);
  await page.reload({ waitUntil: 'networkidle' });
  await lvName(page, 0).waitFor({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(500);
}
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm (mới )?thang xếp loại/i }).first().click();
  await page.waitForURL(/score-scales\/create/); await lvName(page, 0).waitFor();
}
/** Điền các mức: [tên, đến dưới]; dòng kế được hệ thống tự thêm khi Đến dưới < 100. */
async function fillLv(page: Page, lv: Lv[]) {
  for (let i = 0; i < lv.length; i++) {
    await lvName(page, i).waitFor({ timeout: 5000 });
    await lvName(page, i).fill(lv[i][0]);
    await lvEnd(page, i).fill(String(lv[i][1]));
    await page.waitForTimeout(250);
  }
}
async function saveNew(page: Page) {
  await saveBtn(page).click();
  await page.waitForURL(/score-scales\/[0-9a-f-]{36}$/i, { timeout: 10_000 });
  const id = idOfUrl(page.url())!; mk.scales.push(id); await page.waitForTimeout(800); return id;
}
async function rowOf(page: Page, s: any) {
  await openList(page, cfg);
  return (await findRow(page, cfg, s.code)).first();
}
async function menuOf(page: Page, row: Locator) {
  if (!(await row.locator('button.ant-dropdown-trigger').count())) return [] as string[];
  return rowMenuItems(page, row);
}
const dialogText = async (page: Page) => {
  const d = page.locator('.ant-modal-content, .ant-popover-content, .ant-popconfirm, [role=dialog]').filter({ visible: true }).last();
  await d.waitFor({ state: 'visible', timeout: 5000 });
  return (await d.innerText()).replace(/\s+/g, ' ');
};
/** Danh sách option của select "Thang xếp loại" trong form tạo kỳ tự đánh giá. */
async function campaignScaleOptions(page: Page): Promise<string[]> {
  await goto(page, 'self-assessment-campaigns');
  await page.getByRole('button', { name: /thêm mới tự đánh giá/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' });
  await d.locator('.ant-form-item').filter({ hasText: /Thang xếp loại/ }).locator('.ant-select').first().click();
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.waitFor({ state: 'visible' }); await page.waitForTimeout(600);
  const items = (await dd.locator('.ant-select-item-option').allInnerTexts()).map(s => s.trim());
  await page.keyboard.press('Escape'); await btnCancel(d).click().catch(() => {});
  return items;
}

// ================= DANH SÁCH =================
test.describe('Thang xếp loại › Danh sách / Tìm kiếm / Phân trang', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('SCL-L01'), async ({ page }) => {
    await openList(page, cfg);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    for (const re of cfg.cols) expect(heads.some(h => re.test(h)), `thiếu cột ${re} trong [${heads.join(' | ')}]`).toBeTruthy();
    expect(await dataRows(page).count()).toBeGreaterThan(0);
    expect(await codeOfRow(dataRows(page).first()), 'mã thang phải nằm ở dòng phụ dưới tên').toMatch(/^TXL-\d+/);
  });
  test(tc('SCL-L03'), async ({ page }) => {
    await openList(page, cfg);
    const kw = await codeOfRow(dataRows(page).first());
    await searchFor(page, cfg, kw);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('SCL-L04'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await nameOfRow(dataRows(page).first())).slice(0, 25).trim();
    await searchFor(page, cfg, kw);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('SCL-L05'), async ({ page }) => {
    await openList(page, cfg);
    await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
    expect(await dataRows(page).count()).toBe(0);
    await expect(page.locator('.ant-empty, .ant-table-placeholder').first()).toBeVisible();
  });
  test(tc('SCL-L06'), async ({ page }) => {
    await openList(page, cfg);
    const kw = await codeOfRow(dataRows(page).first());
    await searchFor(page, cfg, kw.toUpperCase()); const a = await total(page);
    await searchFor(page, cfg, kw.toLowerCase()); const b = await total(page);
    expect(a).toBeGreaterThan(0);
    expect(b, 'HOA/thường phải cho cùng số kết quả').toBe(a);
  });
  test(tc('SCL-L07'), async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', d => { dialogSeen = true; d.dismiss().catch(() => {}); });
    await openList(page, cfg);
    for (const bad of ["' OR 1=1 --", '<script>alert(1)</script>', '"; DROP TABLE users; --']) {
      await searchFor(page, cfg, bad);
      const body = (await page.locator('body').innerText()).toLowerCase();
      expect(body).not.toMatch(/internal server error|exception|stack ?trace|sqlexception|syntax error/);
      for (const t of await rowTexts(page)) expect(t.toLowerCase(), `"${bad}" khớp bản ghi không chứa chuỗi này`).toContain(bad.toLowerCase());
    }
    expect(dialogSeen, 'không được thực thi script (XSS)').toBeFalsy();
  });
  test(tc('SCL-L09'), async ({ page }) => {
    await openList(page, cfg); await padScales(page);
    const n = await total(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await pickOption(page, page.locator('.ant-pagination-options .ant-select').first(), '20');
    await waitList(page);
    expect(await dataRows(page).count()).toBe(Math.min(20, n));
    expect(await total(page)).toBe(n);
  });
  test(tc('SCL-L10'), async ({ page }) => {
    await openList(page, cfg);
    const n = await total(page);
    await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
    expect(await total(page)).toBe(0);
    await searchFor(page, cfg, '');
    expect(await total(page)).toBe(n);
  });
});

test.describe('Thang xếp loại › Bộ lọc & hiển thị dòng', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SCL-L12'), async ({ page }) => {
    await mkScale(); await mkScale({ lock: true });
    await openList(page, cfg);
    const sel = page.locator(FILTERS).first();
    expect(await sel.innerText(), 'mặc định phải là "Tất cả"').toMatch(/tất cả/i);
    const all = await total(page);
    for (const label of ['Chưa khóa', 'Đã khóa']) {
      await pickOption(page, sel, label); await waitList(page);
      const texts = await rowTexts(page);
      expect(texts.length, `phải có thang "${label}"`).toBeGreaterThan(0);
      const other = label === 'Đã khóa' ? 'Chưa khóa' : 'Đã khóa';
      for (const t of texts) { expect(t).toContain(label); expect(t).not.toContain(other); }
    }
    // quay lại "Tất cả": xóa lọc hoặc chọn mục "Tất cả"
    await sel.hover();
    const clr = sel.locator('.ant-select-clear');
    if (await clr.isVisible().catch(() => false)) await clr.click();
    else {
      await sel.click();
      const opt = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: /tất cả/i });
      expect(await opt.count(), 'bộ lọc Trạng thái phải có mục "Tất cả" (hoặc nút xóa lọc)').toBeGreaterThan(0);
      await opt.first().click();
    }
    await waitList(page);
    expect(await total(page)).toBe(all);
  });
  test(tc('SCL-L13'), async ({ page }) => {
    const p = `qc.automation Kết hợp ${code8()}`;
    const a = await mkScale({ name: `${p} A` }), b = await mkScale({ name: `${p} B`, lock: true });
    await openList(page, cfg); await searchFor(page, cfg, p);
    expect(await dataRows(page).count()).toBe(2);
    const sel = page.locator(FILTERS).first();
    await pickOption(page, sel, 'Đã khóa'); await waitList(page);
    let texts = await rowTexts(page);
    expect(texts.length, 'Từ khóa + Đã khóa').toBe(1);
    expect(texts[0]).toContain(b.code); expect(texts[0]).toContain('Đã khóa');
    await pickOption(page, sel, 'Chưa khóa'); await waitList(page);
    texts = await rowTexts(page);
    expect(texts.length, 'Từ khóa + Chưa khóa').toBe(1);
    expect(texts[0]).toContain(a.code); expect(texts[0]).toContain('Chưa khóa');
  });
  test(tc('SCL-L14'), async ({ page }) => {
    const s = await mkScale({ lv: LV3 });
    const row = await rowOf(page, s);
    expect(await codeOfRow(row)).toBe(s.code);
    const segs = row.locator('td').nth(1).locator('div.h-full');
    expect(await segs.count(), 'thanh các mức phải có 1 đoạn/mức').toBe(3);
    const widths = await segs.evaluateAll(e => e.map(x => parseFloat((x as HTMLElement).style.width)));
    [40, 50, 10].forEach((w, i) => expect(Math.abs(widths[i] - w), `đoạn ${i + 1} rộng ${widths[i]}% (kỳ vọng ${w}%)`).toBeLessThan(1.5));
    const colors = await segs.evaluateAll(e => e.map(x => (x as HTMLElement).style.backgroundColor));
    expect(new Set(colors).size, 'các mức phải khác màu').toBe(3);
    expect((await row.locator('td').nth(1).innerText()).replace(/\s+/g, ' ')).toContain('Kém · Khá · Tốt');
  });
  test(tc('SCL-L15'), async ({ page }) => {
    const free = await mkScale(), used = await mkAssigned();
    let row = await rowOf(page, free);
    expect((await row.locator('td').nth(2).innerText()).trim()).toBe('Chưa dùng');
    row = await rowOf(page, used);
    expect((await row.locator('td').nth(2).innerText()).trim(), 'thang gán 1 kỳ').toBe('1');
  });
  // Hệ thống luôn có sẵn thang mặc định TXL-001 đang được dùng và không được xóa dữ liệu có sẵn
  test.fixme(`${tc('SCL-L17')} — không tạo được trạng thái rỗng (không được xóa dữ liệu có sẵn)`, async () => {});
});

// ================= XEM CHI TIẾT =================
test.describe('Thang xếp loại › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('SCL-V01'), async ({ page }) => {
    const s = await mkScale({ lv: LV3, desc: 'qc.automation mô tả chi tiết' });
    await openDetail(page, s.id);
    const t = await contentText(page);
    for (const x of ['Mã thang', s.code, 'Số mức', 'Số kỳ sử dụng', 'Mô tả', 'qc.automation mô tả chi tiết']) expect(t, `thiếu "${x}"`).toContain(x);
    expect(t).toMatch(/Số mức\s*3/); expect(t).toMatch(/Số kỳ sử dụng\s*Chưa dùng/);
    const u = await mkAssigned(); await openDetail(page, u.id);
    expect(await contentText(page)).toMatch(/Số kỳ sử dụng\s*1(\s|$)/);
  });
  test(tc('SCL-V02'), async ({ page }) => {
    const s = await mkScale({ lv: LV3 });
    await openDetail(page, s.id);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(x => x.trim());
    for (const re of [/^#$|stt/i, /tên mức/i, /từ \(%\)/i, /đến dưới \(%\)/i, /tương đương trên 1\.000 điểm/i]) expect(heads.some(h => re.test(h)), `thiếu cột ${re} trong [${heads.join(' | ')}]`).toBeTruthy();
    const rows = lvRows(page).filter({ hasText: /Kém|Khá|Tốt/ });
    expect(await rows.count()).toBe(3);
    const last = (await rows.last().innerText()).replace(/\s+/g, ' ');
    expect(last, 'mức cuối phải ghi "100 (gồm 100)"').toMatch(/100\s*\(gồm 100\)/);
  });
  test(tc('SCL-V03'), async ({ page }) => {
    const s = await mkScale({ lv: LV3 });
    await openDetail(page, s.id);
    const eq = (await lvRows(page).filter({ hasText: /Kém|Khá|Tốt/ }).evaluateAll(r => r.map(x => (x.lastElementChild as HTMLElement).innerText.trim())));
    expect(eq[0]).toMatch(/^0\s*[-–]\s*dưới 400$/);
    expect(eq[1]).toMatch(/^400\s*[-–]\s*dưới 900$/);
    expect(eq[2]).toMatch(/^900\s*[-–]\s*1\.000$/);
  });
  test(tc('SCL-V04'), async ({ page }) => {
    const s = await mkScale({ lv: LV3 });
    await openDetail(page, s.id);
    const t = await contentText(page);
    for (const m of ['0%', '40%', '90%', '100%']) expect(t, `thanh các mức thiếu mốc ${m}`).toContain(m);
    expect(await content(page).locator('div[style*="background"]').count(), 'thanh phải có các đoạn màu').toBeGreaterThanOrEqual(3);
  });
  test(tc('SCL-V06'), async ({ page }) => {
    const u = await mkAssigned();
    await openDetail(page, u.id);
    expect(await contentText(page)).toMatch(MSG104);
    for (const re of [/^\s*(sửa|cập nhật)\s*$/i, /^\s*kh(oá|óa)\s*$/i, /^\s*mở kh(oá|óa)\s*$/i, /^\s*x(oá|óa)\s*$/i]) expect(await BTN(page, re).count(), `không được có nút ${re}`).toBe(0);
  });
});
registerNotFoundTest('SCL-V08', cfg);

// ================= THÊM MỚI (giao diện) =================
test.describe('Thang xếp loại › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  const okName = () => sname();
  test(tc('SCL-C01'), async ({ page }) => {
    const name = okName();
    await openAdd(page);
    await nameInp(page).fill(name); await fillLv(page, LV2);
    const id = await saveNew(page);
    expect(await contentText(page)).toMatch(/TXL-\d+/); expect(await contentText(page)).toContain('Chưa khóa');
    const s = await getScale(id);
    expect(s.name).toBe(name); expect(s.code).toMatch(/^TXL-\d{3,}$/); expect(s.isLocked).toBe(false);
  });
  test(tc('SCL-C03'), async () => {
    const a = await mkScale();
    expect((await api('DELETE', `${R}/${a.id}`)).status).toBe(200);
    const b = await mkScale();
    const n = (c: string) => Number(c.replace(/\D/g, ''));
    expect(b.code).not.toBe(a.code);
    expect(n(b.code), `mã mới ${b.code} phải lớn hơn mã đã xóa ${a.code}`).toBeGreaterThan(n(a.code));
  });
  test(tc('SCL-C04'), async ({ page }) => {
    await openAdd(page);
    await fillLv(page, LV2);
    await nameInp(page).focus(); await nameInp(page).blur(); await page.waitForTimeout(500);
    // QA xác nhận: app chặn bằng cách vô hiệu nút Lưu cho tới khi nhập đủ, không hiện câu báo lỗi → chỉ cần Lưu bị vô hiệu
    await expect(saveBtn(page), 'tên rỗng thì nút Lưu phải bị vô hiệu').toBeDisabled();
    await nameInp(page).fill('qc.automation C04 tạm'); await page.waitForTimeout(400);
    await expect(saveBtn(page), 'nhập đủ tên thì nút Lưu phải bật').toBeEnabled();
  });
  test(tc('SCL-C06'), async ({ page }) => {
    const desc = 'dòng 1\ndòng 2\ndòng 3';
    await openAdd(page);
    await nameInp(page).fill(okName()); await page.locator('textarea').fill(desc); await fillLv(page, LV2);
    const id = await saveNew(page);
    expect((await getScale(id)).description).toBe(desc);
    // QA xác nhận: chi tiết hiển thị đủ nội dung các dòng (không cần giữ đúng ký tự xuống dòng)
    const shown = await contentText(page);
    for (const l of ['dòng 1', 'dòng 2', 'dòng 3']) expect(shown, `mô tả nhiều dòng phải hiển thị đủ "${l}" ở chi tiết`).toContain(l);
  });
  test(tc('SCL-C07'), async ({ page }) => {
    await openAdd(page);
    await nameInp(page).fill(okName()); await fillLv(page, [['Duy nhất', 100]]);
    await expect(saveBtn(page)).toBeDisabled();
    expect(await footer(page)).toMatch(/cần ít nhất 2 mức/i);
  });
  test(tc('SCL-C08'), async ({ page }) => {
    test.setTimeout(120_000);
    const lv: Lv[] = Array.from({ length: 10 }, (_, i) => [`Mức ${i + 1}`, (i + 1) * 10] as Lv);
    await openAdd(page); await nameInp(page).fill(okName()); await fillLv(page, lv);
    await expect(saveBtn(page)).toBeEnabled();
    const id = await saveNew(page);
    expect((await getScale(id)).levelCount).toBe(10);
  });
  test(tc('SCL-C09'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName()); await fillLv(page, [['A', 50], ['B', 90]]);
    await expect(saveBtn(page)).toBeDisabled();
    expect(await footer(page), 'phải báo lỗi mức cuối chưa đến 100% (MSG-107)').toMatch(/phải phủ đủ từ 0 đến 100%|chưa nhập mốc|nhập 100/i);
  });
  test(tc('SCL-C10'), async ({ page }) => {
    await openAdd(page);
    await lvName(page, 0).fill('A'); await lvEnd(page, 0).fill('40'); await page.waitForTimeout(500);
    const from = (i: number) => lvRows(page).nth(i).locator('td').nth(2);
    expect((await from(0).innerText()).trim()).toBe('0'); expect(await from(0).locator('input').count(), 'Từ mức 1 phải chỉ-đọc').toBe(0);
    expect((await from(1).innerText()).trim()).toBe('40'); expect(await from(1).locator('input').count(), 'Từ mức 2 phải chỉ-đọc').toBe(0);
  });
  test(tc('SCL-C11'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName());
    await lvName(page, 0).fill('A'); await lvEnd(page, 0).fill('50'); await page.waitForTimeout(300);
    await lvName(page, 1).fill('B'); await lvEnd(page, 1).focus(); await lvEnd(page, 1).blur(); await page.waitForTimeout(400);
    await expect(saveBtn(page)).toBeDisabled();
    expect(await contentText(page) + ' ' + await footer(page), 'phải báo lỗi chưa nhập Đến dưới (MSG-010)').toMatch(/vui lòng nhập đến dưới|chưa nhập mốc/i);
  });
  test(tc('SCL-C12'), async ({ page }) => {
    const name = okName();
    await openAdd(page); await nameInp(page).fill(name); await fillLv(page, [['A', 33.33], ['B', 100]]);
    const id = await saveNew(page);
    expect((await getScale(id)).levels[0].toPercent).toBe(33.33);
    expect(await contentText(page)).toMatch(/33[.,]33/);
    await openAdd(page); await nameInp(page).fill(okName());
    await lvName(page, 0).fill('A'); await lvEnd(page, 0).fill('33.333'); await lvEnd(page, 0).blur(); await page.waitForTimeout(500);
    // QA xác nhận: hệ thống chặn nhập quá 2 chữ số thập phân (tự làm tròn về 2 chữ số hoặc báo lỗi) → đạt
    const typed = await lvEnd(page, 0).inputValue(), msg = await contentText(page) + ' ' + await footer(page);
    expect(/tối đa 2 chữ số thập phân/i.test(msg) || !/\.\d{3,}/.test(typed), `33.333 phải bị chặn: ô còn "${typed}"`).toBeTruthy();
  });
  test(tc('SCL-C13'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName());
    await lvName(page, 0).fill('A'); await lvEnd(page, 0).fill('40'); await page.waitForTimeout(300);
    await lvName(page, 1).fill('B');
    for (const v of ['40', '30']) {
      await lvEnd(page, 1).fill(v); await page.waitForTimeout(400);
      expect(await footer(page), `Đến dưới = ${v}`).toMatch(/Đến dưới phải lớn hơn Từ \(40%\)/);
      await expect(saveBtn(page)).toBeDisabled();
    }
  });
  test(tc('SCL-C14'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName());
    await lvName(page, 0).fill('A');
    for (const v of ['-1', '101']) {
      await lvEnd(page, 0).fill(v); await lvEnd(page, 0).blur(); await page.waitForTimeout(500);
      const shown = await lvEnd(page, 0).inputValue();
      // QA xác nhận: hệ thống chặn giá trị ngoài 0–100 (tự đưa về khoảng hợp lệ hoặc báo lỗi) → đạt
      const msg = await contentText(page) + ' ' + await footer(page), n = Number(shown.replace(',', '.'));
      expect(/ngoài khoảng|từ 0 đến 100|trong khoảng/i.test(msg) || (Number.isFinite(n) && n >= 0 && n <= 100), `${v} phải bị chặn ngoài 0–100: ô còn "${shown}"`).toBeTruthy();
    }
  });
  test(tc('SCL-C15'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName()); await fillLv(page, [['A', 30], ['B', 60], ['C', 100]]);
    await lvEnd(page, 1).fill('100'); await page.waitForTimeout(500);
    expect(await footer(page)).toMatch(/Mốc 100 chỉ dùng cho mức cuối/);
    await expect(saveBtn(page)).toBeDisabled();
  });
  test(tc('SCL-C17'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName());
    await fillLv(page, [['Tốt', 50], ['tốt', 100]]);
    await expect(saveBtn(page)).toBeDisabled();
    expect(await footer(page), 'phải báo lỗi trùng tên mức (MSG-014)').toMatch(/tên mức đã tồn tại|đã bị trùng/i);
  });
  test(tc('SCL-C19'), async ({ page }) => {
    await openAdd(page); await fillLv(page, [['A', 30], ['B', 60], ['C', 100]]);
    await lvRows(page).nth(1).locator('button[title=Xoá]').click();
    expect(await toast(page)).toMatch(/Đã xóa mức\s+B.*Khoảng\s*30%\s*đến\s*60%\s*gộp vào mức\s+C/i);
    expect(await lvRows(page).count()).toBe(2);
    expect((await lvRows(page).nth(1).locator('td').nth(2).innerText()).trim(), 'mức 3 mở rộng: Từ = 30').toBe('30');
  });
  test(tc('SCL-C20'), async ({ page }) => {
    await openAdd(page); await fillLv(page, [['A', 30], ['B', 60], ['C', 100]]);
    await lvRows(page).nth(2).locator('button[title=Xoá]').click();
    expect(await toast(page)).toMatch(/Đã xóa mức\s+C.*Mức\s+B thành mức cuối.*100%/i);
    expect(await lvRows(page).count()).toBe(2);
    expect(await lvRows(page).nth(1).innerText()).toMatch(/mức cuối/i);
  });
  test(tc('SCL-C21'), async ({ page }) => {
    await openAdd(page);
    await lvName(page, 0).fill('Kém'); await lvEnd(page, 0).fill('40'); await page.waitForTimeout(500);
    const t = await contentText(page);
    expect(t, 'xem trước phải có mức Kém tô màu rồi tới vùng "chưa có mức"').toMatch(/Xem trước\s*Kém\s*chưa có mức/);
  });
  test(tc('SCL-C22'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName());
    await lvName(page, 0).fill('A'); await lvEnd(page, 0).fill('50'); await page.waitForTimeout(400);
    await expect(saveBtn(page)).toBeDisabled();
    expect(await footer(page), 'chân trang phải báo lỗi cần sửa').toMatch(/còn \d+ lỗi cần sửa|chưa nhập mốc|chưa nhập tên mức/i);
    await lvName(page, 1).fill('B'); await lvEnd(page, 1).fill('100'); await page.waitForTimeout(400);
    await expect(saveBtn(page)).toBeEnabled();
    expect(await footer(page)).toMatch(/2 mức, đủ 0 đến 100%, lưu được/i);
  });
  test(tc('SCL-C23'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill('qc.automation hủy');
    await btnCancel(page.locator('body')).click(); await page.waitForTimeout(700);
    const t = await dialogText(page).catch(() => '');
    expect(t, 'phải hiện hộp thoại MSG-009 "Thoát khi chưa lưu"').toMatch(/các thay đổi chưa lưu sẽ bị mất/i);
    await page.getByRole('button', { name: /ở lại/i }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/score-scales\/create/); expect(await nameInp(page).inputValue()).toBe('qc.automation hủy');
    await btnCancel(page.locator('body')).click();
    await page.getByRole('button', { name: /^\s*thoát\s*$/i }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/score-scales$/);
  });
  test(tc('SCL-C24'), async ({ page }) => {
    await openList(page, cfg); const n = await total(page);
    await openAdd(page);
    await btnCancel(page.locator('body')).click(); await page.waitForTimeout(800);
    await expect(page).toHaveURL(/score-scales$/);
    expect(await page.locator('.ant-modal-content, .ant-popconfirm').filter({ visible: true }).count(), 'không được có hộp thoại').toBe(0);
    await waitList(page); expect(await total(page)).toBe(n);
  });
  test(tc('SCL-C25'), async () => {
    const before = (await api('GET', `${R}?page=1&size=1`)).data.totalElements;
    const cases: [string, Lv[]][] = [['0–60%', [['A', 30], ['B', 60]]], ['1 mức', [['A', 100]]]];
    const bad: string[] = [];
    for (const [label, lv] of cases) {
      const r = await api('POST', R, { name: sname(), levels: lvBody(lv) });
      if (r.status === 200) mk.scales.push(r.data.id);
      if (r.status !== 400 || !r.message) bad.push(`${label}: HTTP ${r.status} "${r.message}"`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
    expect((await api('GET', `${R}?page=1&size=1`)).data.totalElements, 'không được tạo bản ghi').toBe(before);
  });
  test(tc('SCL-C26'), async () => {
    const cases: [string, any[]][] = [
      ['chồng lấn', [{ name: 'A', fromPercent: 0, toPercent: 60 }, { name: 'B', fromPercent: 50, toPercent: 100 }]],
      ['không liên tục', [{ name: 'A', fromPercent: 0, toPercent: 40 }, { name: 'B', fromPercent: 50, toPercent: 100 }]],
      ['tên mức rỗng', [{ name: '', fromPercent: 0, toPercent: 50 }, { name: 'B', fromPercent: 50, toPercent: 100 }]],
    ];
    const bad: string[] = [];
    for (const [label, levels] of cases) {
      const r = await api('POST', R, { name: sname(), levels });
      if (r.status === 200) mk.scales.push(r.data.id);
      if (r.status !== 400 || !r.message) bad.push(`${label}: HTTP ${r.status} "${r.message}" (kỳ vọng 400)`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ================= CHỈNH SỬA =================
test.describe('Thang xếp loại › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  const goBackDetail = (p: Page) => p.waitForURL(/score-scales\/[0-9a-f-]{36}$/i, { timeout: 10_000 });
  test(tc('SCL-E01'), async ({ page }) => {
    const s = await mkScale({ desc: 'mô tả cũ' }); const nn = `qc.automation Thang sửa ${code8()}`;
    await rowAction(page, await rowOf(page, s), /cập nhật|sửa/i);
    await page.waitForURL(/\/edit$/); await lvName(page, 0).waitFor(); await page.waitForTimeout(500);
    await nameInp(page).fill(nn); await page.locator('textarea').fill('mô tả mới');
    await lvName(page, 0).fill('Yếu'); await lvEnd(page, 0).fill('40'); await page.waitForTimeout(300);
    await saveBtn(page).click(); await goBackDetail(page); await page.waitForTimeout(800);
    const t = await contentText(page);
    expect(t).toContain(nn); expect(t).toContain('mô tả mới'); expect(t).toContain('Yếu'); expect(t).toContain('Chưa khóa');
    const g = await getScale(s.id);
    expect(g.name).toBe(nn); expect(g.levels[0].name).toBe('Yếu'); expect(g.levels[0].toPercent).toBe(40); expect(g.isLocked).toBe(false);
  });
  test(tc('SCL-E05'), async ({ page }) => {
    const s = await mkScale();
    await openEditUrl(page, s.id);
    await nameInp(page).fill(''); await page.waitForTimeout(400);
    await expect.soft(saveBtn(page)).toBeDisabled();
    expect.soft(await contentText(page), 'xóa tên phải báo MSG-010').toMatch(/vui lòng nhập tên thang/i);
    await openEditUrl(page, s.id);
    await lvRows(page).nth(1).locator('button[title=Xoá]').click(); await page.waitForTimeout(500);
    await expect.soft(saveBtn(page)).toBeDisabled();
    expect.soft(await footer(page), 'xóa mức còn 1 phải báo MSG-109').toMatch(/cần ít nhất 2 mức/i);
    await openEditUrl(page, s.id);
    await lvEnd(page, 0).fill('50'); await lvEnd(page, 1).fill('90'); await page.waitForTimeout(500);
    await expect.soft(saveBtn(page)).toBeDisabled();
    expect.soft(await footer(page), 'mức cuối 90 phải báo lỗi (MSG-107)').toMatch(/phải phủ đủ từ 0 đến 100%|chưa nhập mốc|nhập 100/i);
  });
  test(tc('SCL-E06'), async ({ page }) => {
    const s = await mkScale();
    await openEditUrl(page, s.id);
    const r = await api('PUT', `${R}/${s.id}`, { name: `qc.automation phiên khác ${code8()}`, rowVersion: s.rowVersion, levels: lvBody(LV2) });
    expect(r.status, 'giả lập phiên khác sửa trước').toBe(200);
    await nameInp(page).fill(`qc.automation phiên này ${code8()}`); await saveBtn(page).click();
    expect(await toast(page)).toMatch(/Dữ liệu đã được người khác thay đổi\. Vui lòng tải lại trang/);
    expect((await getScale(s.id)).name).toBe(r.data.name);
  });
  test(tc('SCL-E07'), async ({ page }) => {
    const s = await mkScale();
    await openEditUrl(page, s.id);
    await nameInp(page).fill('qc.automation KHÔNG LƯU');
    await btnCancel(page.locator('body')).click(); await page.waitForTimeout(700);
    expect(await dialogText(page).catch(() => ''), 'phải hiện hộp thoại xác nhận thoát').toMatch(/các thay đổi chưa lưu sẽ bị mất/i);
    await page.getByRole('button', { name: /ở lại/i }).filter({ visible: true }).first().click();
    expect(await nameInp(page).inputValue()).toBe('qc.automation KHÔNG LƯU');
    await btnCancel(page.locator('body')).click();
    await page.getByRole('button', { name: /^\s*thoát\s*$/i }).filter({ visible: true }).first().click();
    await page.waitForTimeout(800);
    expect((await getScale(s.id)).name).toBe(s.name);
  });
});

// ================= XÓA =================
test.describe('Thang xếp loại › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('SCL-D02'), async ({ page }) => {
    const s = await mkScale();
    const row = await rowOf(page, s);
    await rowAction(page, row, XOA); await confirmYes(page);
    expect((await api('GET', `${R}/${s.id}`)).status, 'thang phải biến mất khỏi API').toBeGreaterThanOrEqual(400);
    await searchFor(page, cfg, s.code); expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('SCL-D04'), async ({ page }) => {
    const s = await mkScale();
    await rowAction(page, await rowOf(page, s), XOA); await confirmNo(page);
    expect((await api('GET', `${R}/${s.id}`)).status).toBe(200);
  });
  test(tc('SCL-D05'), async () => {
    const u = await mkAssigned();
    const r = await api('DELETE', `${R}/${u.id}`);
    // QA xác nhận: UI không cho xóa (menu Xoá bị làm mờ); API chặn bằng 400 → chấp nhận cả thông báo "đang khóa" của API
    expect(r.status).toBe(400); expect(r.message, 'phải có thông báo chặn xóa (MSG-104 hoặc "đang khóa")').toMatch(new RegExp(`${MSG104.source}|đang khóa nên không thể sửa hoặc xóa`, 'i'));
    expect((await api('GET', `${R}/${u.id}`)).status, 'thang còn nguyên').toBe(200);
  });
});

// ================= KHÓA / MỞ KHÓA =================
test.describe('Thang xếp loại › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SCL-K02'), async ({ page }) => {
    const s = await mkScale();
    await rowAction(page, await rowOf(page, s), KHOA); await confirmYes(page);
    expect((await getScale(s.id)).isLocked).toBe(true);
    await expect((await rowOf(page, s))).toContainText('Đã khóa');
    const opts = await campaignScaleOptions(page);
    expect(opts.some(o => o.includes(s.code)), `thang ${s.code} phải có trong danh sách chọn của kỳ: [${opts.join(' | ')}]`).toBeTruthy();
  });
  test(tc('SCL-K03'), async () => {
    const s = await mkScale({ lock: true });
    const r = await lockApi(s.id);
    expect(r.status, 'khóa thang đã khóa phải bị từ chối').toBeGreaterThanOrEqual(400);
    expect(r.message).not.toBe('');
    expect((await getScale(s.id)).isLocked).toBe(true);
    const f = await api('POST', `${R}/00000000-0000-4000-8000-000000000000/lock?rowVersion=1`, {});
    expect(f.status).toBeGreaterThanOrEqual(400); expect(f.status).toBeLessThan(500);
  });
  test(tc('SCL-K04'), async ({ page }) => {
    const s = await mkScale();
    await rowAction(page, await rowOf(page, s), KHOA); await confirmYes(page);
    const items = await menuOf(page, await rowOf(page, s));
    expect(items.some(i => SUA.test(i)), `menu: ${items.join(' | ')}`).toBeTruthy();
    expect(items.some(i => MOKHOA.test(i))).toBeTruthy(); expect(items.some(i => XOA.test(i))).toBeTruthy();
  });
  test(tc('SCL-K06'), async ({ page }) => {
    const s = await mkScale({ lock: true });
    await rowAction(page, await rowOf(page, s), MOKHOA); await confirmYes(page);
    expect((await getScale(s.id)).isLocked).toBe(false);
    await expect((await rowOf(page, s))).toContainText('Chưa khóa');
    const opts = await campaignScaleOptions(page);
    expect(opts.some(o => o.includes(s.code)), `thang ${s.code} không được còn trong danh sách chọn: [${opts.join(' | ')}]`).toBeFalsy();
  });
  test(tc('SCL-K07'), async () => {
    const u = await mkAssigned();
    const r = await unlockApi(u.id);
    expect(r.status).toBe(400); expect(r.message, 'phải báo MSG-104').toMatch(MSG104);
    expect((await getScale(u.id)).isLocked).toBe(true);
  });
});

// ================= EDGE / LỖI =================
test.describe('Thang xếp loại › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('SCL-G01'), async ({ page }) => {
    const before = (await api('GET', `${R}?page=1&size=1`)).data.totalElements;
    await openAdd(page); await fillLv(page, LV2);
    await nameInp(page).fill('   '); await nameInp(page).blur(); await page.waitForTimeout(600);
    if (await saveBtn(page).isEnabled()) await saveBtn(page).click();
    await page.waitForTimeout(900);
    const msg = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' ') + ' ' + await contentText(page);
    expect(msg, 'chuỗi chỉ có khoảng trắng phải bị báo lỗi bắt buộc').toMatch(/vui lòng nhập tên thang|không được để trống|bắt buộc/i);
    await expect(page).toHaveURL(/score-scales\/create/);
    const r = await api('POST', R, { name: '   ', levels: lvBody(LV2) });
    if (r.status === 200) mk.scales.push(r.data.id);
    expect(r.status, 'API cũng phải từ chối tên toàn khoảng trắng').toBe(400);
    expect((await api('GET', `${R}?page=1&size=1`)).data.totalElements, 'không được tạo bản ghi').toBe(before);
  });
  for (const [id, mode] of [['SCL-G03', 'http500'], ['SCL-G04', 'offline']] as const) {
    test(tc(id), async ({ page }) => {
      const name = sname();
      await openAdd(page); await nameInp(page).fill(name); await fillLv(page, LV2);
      const re = /\/api\/v1\/dti\/score-scales$/;
      await page.route(re, r => {
        if (r.request().method() !== 'POST') return r.continue();
        return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
      });
      await saveBtn(page).click(); await page.waitForTimeout(1800);
      await expect(page, 'form phải còn mở để thử lại').toHaveURL(/score-scales\/create/);
      const body = (await page.locator('body').innerText()).toLowerCase();
      expect(body).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
      expect(await nameInp(page).inputValue(), 'dữ liệu đã nhập không được mất').toBe(name);
      expect(await lvRows(page).count()).toBeGreaterThanOrEqual(2);
      await page.unroute(re);
      expect(await findApi(R, name, 'name')).toBeNull();
    });
  }
  test(tc('SCL-G05'), async ({ page }) => {
    const name = sname();
    await openAdd(page); await nameInp(page).fill(name); await fillLv(page, LV2);
    await saveBtn(page).dblclick().catch(() => {});
    await page.waitForTimeout(3000);
    const same = (await listApi(R, name)).filter((x: any) => x.name === name);
    same.forEach((x: any) => mk.scales.push(x.id));
    expect(same.length, 'bấm Lưu 2 lần chỉ được tạo đúng 1 bản ghi').toBe(1);
  });
});

// ================= BẢO MẬT & HIỆU NĂNG =================
test.describe('Thang xếp loại › Bảo mật / Hiệu năng', () => {
  registerAuthTest('SCL-A01', cfg);
  test(tc('SCL-A02'), async () => {
    const pm = await api('GET', 'idm/permission-matrix/me', undefined, 'canbo');
    const perms = new Set(Object.values(pm.data ?? {}).map((x: any) => x.code));
    const fake = '00000000-0000-0000-0000-000000000000';
    const checks: [string, string, any, string][] = [
      ['GET', `${R}?pageSize=1`, undefined, `${cfg.perm}.VIEW`],
      ['POST', R, {}, `${cfg.perm}.CREATE`],
      ['PUT', `${R}/${fake}`, {}, `${cfg.perm}.UPDATE`],
      ['DELETE', `${R}/${fake}`, undefined, `${cfg.perm}.DELETE`],
      ['POST', `${R}/${fake}/lock?rowVersion=1`, {}, `${cfg.perm}.LOCK`],
      ['POST', `${R}/${fake}/unlock?rowVersion=1`, {}, `${cfg.perm}.LOCK`],
    ];
    const bad: string[] = [];
    for (const [m, url, body, perm] of checks) {
      const s = (await api(m, url, body, 'canbo')).status, has = perms.has(perm);
      if (has && (s === 401 || s === 403)) bad.push(`${m} ${url}: có ${perm} nhưng bị ${s}`);
      if (!has && s !== 403) bad.push(`${m} ${url}: KHÔNG có ${perm} nhưng trả ${s} (kỳ vọng 403)`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  registerPerfTest('SCL-P01', cfg);
});
test.describe('Thang xếp loại › Chưa đăng nhập', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test(tc('SCL-A03'), async ({ page }) => {
    await page.goto('/#/vi/score-scales', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    expect(page.url() + ' ' + body, 'phải chuyển về màn đăng nhập').toMatch(/login|đăng nhập|dang-nhap/i);
    expect(body, 'không được lộ dữ liệu thang').not.toMatch(/TXL-\d+|Thang xếp loại mặc định/);
  });
});

// ===== Case bổ sung từ bug GitLab (gộp từ thang-xep-loai-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
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

// ====================================================================== THANG XẾP LOẠI
const lvRows = (p: Page) => C(p).locator('tbody tr.ant-table-row');
test.describe('Thang xếp loại', () => {
  test(tc('SCL-C27'), async ({ page }) => {
    await go(page, 'score-scales'); await btn(page, /thêm thang xếp loại/i).first().click();
    await page.waitForURL(/score-scales\/create/); await page.waitForTimeout(800);
    const lbl = norm(await C(page).locator('label').filter({ hasText: /^Mô tả/ }).first().innerText());
    expect(lbl).toBe('Mô tả');
    expect(await ctext(page)).not.toMatch(/không bắt buộc/i);
  });
  test(tc('SCL-E08'), async ({ page }) => {
    const s = await mkScale({ lock: true });
    const b = await base();
    must(await A('POST', CAMP, { name: nm('kỳ gán thang'), type: 'AdHoc', indicatorSetId: b.set.id, scaleId: s.id, startDate: '2026-11-13T00:00:00', endDate: '2026-11-30T23:59:59' }), 'tạo kỳ gán thang');
    expect((await getScale(s.id)).isAssigned, 'thang đã gán kỳ').toBe(true);
    await page.goto(`${BASE}/vi/score-scales/${s.id}/edit`, { waitUntil: 'networkidle' });
    const msgs: string[] = [];
    for (let i = 0; i < 8; i++) { msgs.push(...await page.locator('.ant-message-notice, .ant-notification-notice, .ant-alert').allInnerTexts()); await page.waitForTimeout(400); }
    await page.waitForTimeout(1000);
    expect.soft(msgs.join(' | '), 'thông báo MSG-104').toMatch(/đang được kỳ sử dụng nên không thể sửa, mở khóa hoặc xóa/i);
    expect.soft(page.url(), 'phải về màn chi tiết').not.toMatch(/\/edit$/);
    expect.soft(await btn(C(page), /^\s*Lưu\s*$/).count(), 'không có nút Lưu / form Sửa').toBe(0);
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('SCL-V09'), async ({ page }) => {
    const s = await mkScale();
    await goDetail(page, `score-scales/${s.id}`, 'Thông tin chung');
    const btns = await C(page).locator('button.h-10').filter({ visible: true }).evaluateAll(bs => bs.map(b => ({ t: (b.textContent ?? '').trim(), bg: getComputedStyle(b).backgroundColor, cls: b.className })));
    const upd = btns.find(b => /^Cập nhật$/.test(b.t));
    expect(upd, `có nút Cập nhật (${btns.map(b => b.t)})`).toBeTruthy();
    const white = (c: string) => /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(c);
    expect(white(upd!.bg), `nút Cập nhật nền ${upd!.bg} — phải là nút primary`).toBe(false);
    for (const b of btns.filter(b => b !== upd && b.t)) expect.soft(white(b.bg), `nút "${b.t}" nền ${b.bg} — phải là secondary`).toBe(true);
    expect(test.info().errors.length).toBe(0);
  });
});

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
