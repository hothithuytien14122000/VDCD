// B.TXL THANG XẾP LOẠI — script bám testcase SCL-* (testcases/docs/catalog.json)
// Lưu ý API: khóa/mở khóa là POST dti/score-scales/{id}/lock|unlock?rowVersion=N (không phải PUT).
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, WRITE, PAGES, dataRows, openList, searchFor, waitList, rowTexts, findRow, pickOption, dlg,
  btnCancel, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, code8, goto, FILTERS, SPECIAL_NAME,
  registerAuthTest, registerPerfTest, registerNotFoundTest,
} from './common';

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
  await page.getByRole('button', { name: /thêm thang xếp loại/i }).first().click();
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
  test(tc('SCL-L02'), async ({ page }) => {
    await openList(page, cfg); await padScales(page);
    const n = await total(page), rows = await dataRows(page).count();
    expect(rows).toBe(Math.min(10, n));
    const pg = (await page.locator('.ant-pagination').first().innerText()).replace(/\s+/g, ' ');
    expect(pg, `thanh phân trang phải có "Hiển thị 1-10 trong N bản ghi" (thực tế: "${pg}")`).toMatch(/hiển thị\s+1\s*-\s*\d+\s+trong\s+\d+\s+bản ghi/i);
    if (n > 10) await expect(page.locator('.ant-pagination-item-2').first()).toBeVisible();
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
  test(tc('SCL-L08'), async ({ page }) => {
    await openList(page, cfg); await padScales(page);
    test.skip((await total(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    const before = (await rowTexts(page)).join('|');
    await page.locator('.ant-pagination-item-2').first().click();
    await waitList(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    expect((await rowTexts(page)).join('|')).not.toBe(before);
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
  test(tc('SCL-L16'), async ({ page }) => {
    const a = await mkScale(), b = await mkScale({ lock: true }), c = await mkAssigned();
    const bad: string[] = [];
    const chk = async (s: any, label: string, want: RegExp[]) => {
      const row = await rowOf(page, s);
      const first = (await row.locator('button').first().innerText()).trim();
      if (!/xem/i.test(first)) bad.push(`${label}: "Xem" không đứng đầu (đầu tiên: "${first}")`);
      const items = await menuOf(page, row);
      const ok = items.length === want.length && want.every((re, i) => re.test(items[i]));
      if (!ok) bad.push(`${label}: menu [${items.join(' | ')}], kỳ vọng ${want.length ? want.join(', ') : 'chỉ Xem (không còn mục nào)'}`);
    };
    await chk(a, 'Chưa khóa', [SUA, KHOA, XOA]);
    await chk(b, 'Đã khóa chưa gán', [SUA, MOKHOA, XOA]);
    await chk(c, 'Đã gán', []);
    expect(bad, bad.join('\n')).toEqual([]);
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
  test(tc('SCL-V05'), async ({ page }) => {
    const u = await mkAssigned();
    await openDetail(page, u.id);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(x => x.trim());
    for (const re of [/tên đánh giá/i, /phân loại/i, /bộ chỉ số/i, /thời gian/i]) expect(heads.some(h => re.test(h)), `thiếu cột ${re} trong [${heads.join(' | ')}]`).toBeTruthy();
    expect(await contentText(page)).toContain(u.campName);
    await expect(content(page).locator('.ant-pagination-options').first(), 'bảng Kỳ sử dụng phân trang 10/trang').toContainText('10');
    const f = await mkScale(); await openDetail(page, f.id);
    expect(await contentText(page), 'thang chưa gán phải hiện MSG-022 "Chưa có dữ liệu"').toMatch(/chưa có dữ liệu/i);
  });
  test(tc('SCL-V06'), async ({ page }) => {
    const u = await mkAssigned();
    await openDetail(page, u.id);
    expect(await contentText(page)).toMatch(MSG104);
    for (const re of [/^\s*(sửa|cập nhật)\s*$/i, /^\s*kh(oá|óa)\s*$/i, /^\s*mở kh(oá|óa)\s*$/i, /^\s*x(oá|óa)\s*$/i]) expect(await BTN(page, re).count(), `không được có nút ${re}`).toBe(0);
  });
  test(tc('SCL-V07'), async ({ page }) => {
    const s = await mkScale();
    await openDetail(page, s.id);
    const edit = BTN(page, /^\s*(sửa|cập nhật)\s*$/i).first();
    await expect(edit).toBeVisible(); await expect(BTN(page, /^\s*kh(oá|óa)\s*$/i).first()).toBeVisible(); await expect(BTN(page, /^\s*x(oá|óa)\s*$/i).first()).toBeVisible();
    const cls = await edit.getAttribute('class') ?? '';
    expect(cls, 'nút Sửa phải là nút chính (primary)').toMatch(/ant-btn-primary|ant-btn-variant-solid|(^|\s)bg-primary(\s|$)/);
    await lockApi(s.id); await page.reload(); await waitList(page);
    await expect(BTN(page, /^\s*mở kh(oá|óa)\s*$/i).first()).toBeVisible();
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
  test(tc('SCL-C02'), async ({ page }) => {
    await openAdd(page);
    const code = page.getByPlaceholder('Tự động sinh khi lưu');
    await expect(code, 'ô mã hiển thị "Tự động sinh khi lưu"').toBeVisible();
    expect(await code.isDisabled() || await code.getAttribute('readonly') !== null, 'ô mã phải chỉ-đọc').toBeTruthy();
    expect(await code.inputValue()).toBe('');
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
    await expect(saveBtn(page)).toBeDisabled();
    expect(await contentText(page), 'phải báo lỗi "Vui lòng nhập Tên thang"').toMatch(/vui lòng nhập tên thang/i);
  });
  test(tc('SCL-C05'), async ({ page }) => {
    await openAdd(page); await fillLv(page, LV2);
    await nameInp(page).fill('a'.repeat(200)); await page.waitForTimeout(400);
    expect((await nameInp(page).inputValue()).length).toBe(200);
    expect(await contentText(page)).not.toMatch(/tối đa 200 ký tự/i);
    await expect(saveBtn(page), '200 ký tự phải hợp lệ').toBeEnabled();
    // 201 ký tự: giao diện chặn nhập quá 200 hoặc báo MSG-013
    await nameInp(page).fill('a'.repeat(201)); await page.waitForTimeout(400);
    const len = (await nameInp(page).inputValue()).length;
    if (len > 200) expect(await contentText(page)).toMatch(/tên thang tối đa 200 ký tự/i);
    // API phải từ chối 201
    const r = await api('POST', R, { name: 'a'.repeat(201), levels: lvBody(LV2) });
    if (r.status === 200) mk.scales.push(r.data.id);
    expect(r.status).toBe(400); expect(r.message).toMatch(/tên thang tối đa 200 ký tự/i);
  });
  test(tc('SCL-C06'), async ({ page }) => {
    const desc = 'dòng 1\ndòng 2\ndòng 3';
    await openAdd(page);
    await nameInp(page).fill(okName()); await page.locator('textarea').fill(desc); await fillLv(page, LV2);
    const id = await saveNew(page);
    expect((await getScale(id)).description).toBe(desc);
    const el = content(page).getByText('dòng 1').first();
    expect((await el.innerText()).trim(), 'mô tả nhiều dòng phải hiển thị đủ các dòng ở chi tiết').toBe(desc);
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
    expect(await footer(page), 'phải báo MSG-107').toMatch(/phải phủ đủ từ 0 đến 100%/i);
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
    expect(await contentText(page) + ' ' + await footer(page), 'phải báo MSG-010 "Vui lòng nhập Đến dưới (%)"').toMatch(/vui lòng nhập đến dưới/i);
  });
  test(tc('SCL-C12'), async ({ page }) => {
    const name = okName();
    await openAdd(page); await nameInp(page).fill(name); await fillLv(page, [['A', 33.33], ['B', 100]]);
    const id = await saveNew(page);
    expect((await getScale(id)).levels[0].toPercent).toBe(33.33);
    expect(await contentText(page)).toMatch(/33[.,]33/);
    await openAdd(page); await nameInp(page).fill(okName());
    await lvName(page, 0).fill('A'); await lvEnd(page, 0).fill('33.333'); await lvEnd(page, 0).blur(); await page.waitForTimeout(500);
    expect(await contentText(page) + ' ' + await footer(page), '33.333 phải báo "tối đa 2 chữ số thập phân" (giao diện đang tự làm tròn thành ' + await lvEnd(page, 0).inputValue() + ')').toMatch(/tối đa 2 chữ số thập phân/i);
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
      expect(await contentText(page) + ' ' + await footer(page), `${v} phải báo ngoài khoảng 0–100 (giao diện đang tự đổi thành ${shown})`).toMatch(/ngoài khoảng|từ 0 đến 100|trong khoảng/i);
    }
  });
  test(tc('SCL-C15'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName()); await fillLv(page, [['A', 30], ['B', 60], ['C', 100]]);
    await lvEnd(page, 1).fill('100'); await page.waitForTimeout(500);
    expect(await footer(page)).toMatch(/Mốc 100 chỉ dùng cho mức cuối/);
    await expect(saveBtn(page)).toBeDisabled();
  });
  test(tc('SCL-C16'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName());
    await lvEnd(page, 0).fill('100'); await lvName(page, 0).focus(); await lvName(page, 0).blur(); await page.waitForTimeout(400);
    expect(await contentText(page) + ' ' + await footer(page), 'tên mức trống phải báo MSG-010 "Vui lòng nhập Tên mức"').toMatch(/vui lòng nhập tên mức/i);
    await lvName(page, 0).fill('x'.repeat(50)); await page.waitForTimeout(300);
    expect(await contentText(page) + ' ' + await footer(page)).not.toMatch(/tối đa 50 ký tự/i);
    await lvName(page, 0).fill('x'.repeat(51)); await page.waitForTimeout(300);
    const len = (await lvName(page, 0).inputValue()).length;
    if (len > 50) expect(await contentText(page) + ' ' + await footer(page)).toMatch(/tên mức tối đa 50 ký tự/i);
    const r = await api('POST', R, { name: okName(), levels: lvBody([['x'.repeat(51), 50], ['B', 100]]) });
    if (r.status === 200) mk.scales.push(r.data.id);
    expect(r.status).toBe(400); expect(r.message).toMatch(/tên mức tối đa 50 ký tự/i);
  });
  test(tc('SCL-C17'), async ({ page }) => {
    await openAdd(page); await nameInp(page).fill(okName());
    await fillLv(page, [['Tốt', 50], ['tốt', 100]]);
    await expect(saveBtn(page)).toBeDisabled();
    expect(await footer(page), 'phải báo MSG-014 "Tên mức đã tồn tại"').toMatch(/tên mức đã tồn tại/i);
  });
  test(tc('SCL-C18'), async ({ page }) => {
    await openAdd(page);
    await lvName(page, 0).fill('A'); await lvEnd(page, 0).fill('50'); await page.waitForTimeout(900);
    expect(await lvRows(page).count(), 'phải tự thêm dòng mức tiếp theo').toBe(2);
    const focus = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.placeholder ?? '');
    expect(focus, 'con trỏ phải vào ô Tên mức của dòng mới').toBe(PH_LV);
    expect(await lvName(page, 1).inputValue()).toBe('');
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
    expect(await footer(page), 'trạng thái lỗi phải dạng "Còn n lỗi cần sửa"').toMatch(/còn \d+ lỗi cần sửa/i);
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
  test(tc('SCL-E02'), async ({ page }) => {
    const s = await mkScale({ lock: true }); const nn = `qc.automation Thang khóa sửa ${code8()}`;
    await openEditUrl(page, s.id);
    await nameInp(page).fill(nn); await saveBtn(page).click();
    const msg = await toast(page);
    expect(msg, 'thang Đã khóa chưa gán phải sửa được').toMatch(/thành công/i);
    const g = await getScale(s.id);
    expect(g.name).toBe(nn); expect(g.isLocked, 'phải giữ Đã khóa').toBe(true);
  });
  test(tc('SCL-E03'), async ({ page }) => {
    const u = await mkAssigned();
    await openEditUrl(page, u.id);
    expect.soft(await BTN(page, /^\s*Lưu\s*$/).count(), 'UI /edit: không được vào màn Sửa').toBe(0);
    expect.soft(await page.locator('body').innerText(), 'UI /edit phải báo MSG-104').toMatch(MSG104);
    const r = await api('PUT', `${R}/${u.id}`, { name: 'qc.automation đổi', rowVersion: u.rowVersion, levels: lvBody(LV3) });
    expect.soft(r.status).toBe(400); expect.soft(r.message, 'API PUT phải báo MSG-104').toMatch(MSG104);
    expect((await getScale(u.id)).name, 'dữ liệu không đổi').toBe(u.name);
  });
  test(tc('SCL-E04'), async ({ page }) => {
    const s = await mkScale();
    await openEditUrl(page, s.id);
    const code = page.locator('input').first();
    expect(await code.inputValue(), 'mã thang phải hiển thị trong form sửa').toBe(s.code);
    expect(await code.isDisabled() || await code.getAttribute('readonly') !== null, 'mã thang phải chỉ-xem').toBeTruthy();
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
    expect.soft(await footer(page), 'mức cuối 90 phải báo MSG-107').toMatch(/phải phủ đủ từ 0 đến 100%/i);
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
  test(tc('SCL-D01'), async ({ page }) => {
    const s = await mkScale({ lv: LV3 });
    await rowAction(page, await rowOf(page, s), XOA);
    const t = await dialogText(page);
    await confirmNo(page);
    expect(t, 'hộp thoại phải nêu tên thang (MSG-006)').toContain(s.name);
    expect(t).toMatch(/bạn có chắc chắn muốn xóa/i);
    expect(t).toContain(s.code); expect(t).toMatch(/Số mức/i); expect(t).toMatch(/không (thể )?hoàn tác/i);
  });
  test(tc('SCL-D02'), async ({ page }) => {
    const s = await mkScale();
    const row = await rowOf(page, s);
    await rowAction(page, row, XOA); await confirmYes(page);
    expect((await api('GET', `${R}/${s.id}`)).status, 'thang phải biến mất khỏi API').toBeGreaterThanOrEqual(400);
    await searchFor(page, cfg, s.code); expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('SCL-D03'), async ({ page }) => {
    const s = await mkScale({ lock: true });
    await rowAction(page, await rowOf(page, s), XOA);
    await page.getByRole('button', { name: /^\s*có\s*$/i }).filter({ visible: true }).last().click();
    const msg = await toast(page);
    const g = await api('GET', `${R}/${s.id}`);
    expect(g.status, `thang Đã khóa chưa gán phải xóa được (không phụ thuộc trạng thái khóa); hệ thống báo: "${msg}"`).toBeGreaterThanOrEqual(400);
  });
  test(tc('SCL-D04'), async ({ page }) => {
    const s = await mkScale();
    await rowAction(page, await rowOf(page, s), XOA); await confirmNo(page);
    expect((await api('GET', `${R}/${s.id}`)).status).toBe(200);
  });
  test(tc('SCL-D05'), async () => {
    const u = await mkAssigned();
    const r = await api('DELETE', `${R}/${u.id}`);
    expect(r.status).toBe(400); expect(r.message, 'phải báo MSG-104').toMatch(MSG104);
    expect((await api('GET', `${R}/${u.id}`)).status, 'thang còn nguyên').toBe(200);
  });
});

// ================= KHÓA / MỞ KHÓA =================
test.describe('Thang xếp loại › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SCL-K01'), async ({ page }) => {
    const s = await mkScale();
    await rowAction(page, await rowOf(page, s), KHOA);
    const t = await dialogText(page); await confirmNo(page);
    expect(t, 'hộp thoại phải nêu tên thang (MSG-007)').toContain(s.name);
    expect(t).toMatch(/bạn có chắc chắn muốn khóa/i);
    expect(t).toContain(s.code); expect(t).toMatch(/Số mức/i); expect(t).toMatch(/thang hiện trong danh sách chọn của kỳ/i);
  });
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
  test(tc('SCL-K05'), async ({ page }) => {
    const s = await mkScale({ lock: true });
    await rowAction(page, await rowOf(page, s), MOKHOA);
    const t = await dialogText(page); await confirmNo(page);
    expect(t, 'hộp thoại phải nêu tên thang (MSG-008)').toContain(s.name);
    expect(t).toMatch(/bạn có chắc chắn muốn mở khóa/i); expect(t).toMatch(/thang không còn hiện trong danh sách chọn/i);
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
  test(tc('SCL-G02'), async ({ page }) => {
    const s = await mkScale({ name: SPECIAL_NAME });
    await openList(page, cfg); await page.reload(); await waitList(page);
    const row = await findRow(page, cfg, s.code);
    expect((await row.first().innerText()).replace(/\s+/g, ' ')).toContain(SPECIAL_NAME);
    expect(await row.first().locator('b').count(), 'HTML trong tên phải hiển thị dạng chữ, không được render').toBe(0);
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
