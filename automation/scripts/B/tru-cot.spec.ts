// B.I.1 TRỤ CỘT — script bám testcase PIL-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, cellText, findRow, pickOption, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, totalOf,
  registerAuthTest, registerMatrixTest, registerPerfTest, registerNotFoundTest, FILTERS, ensurePillar, ensureGroup, ensureIndicator, pickByLabel,
} from './common';

const cfg = PAGES.PIL;
const made = new Made();
test.afterEach(async () => { await made.clean(); });

const PH_CODE = /vui lòng nhập mã trụ cột/i, PH_NAME = /vui lòng nhập tên trụ cột/i;
const UNKNOWN = 'zzqcxx_khongtontai_999';
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới trụ cột/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: /^\s*Thêm mới/ }).last().click();
async function openEdit(page: Page, code: string) {
  await openList(page, cfg);
  await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
}
async function openDetail(page: Page, code?: string, minGroups = 0) {
  await openList(page, cfg);
  const row = code ? await findRow(page, cfg, code) : dataRows(page).nth(await stableRow(page, minGroups));
  await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/pillars\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
}
/** Tạo trụ cột qua API (chưa khóa, mã tùy ý) — dùng khi cần mã/tên riêng. */
async function mkPillar(code: string, name = `qc.automation Trụ cột ${code}`, extra: any = {}) {
  made.add('dti/pillars', code);
  return api('POST', 'dti/pillars', { code, name, displayOrder: 0, ...extra });
}
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
/** Chỉ số dòng ổn định: bỏ qua dòng dữ liệu auto (QCA…) vì có thể bị tạo/xóa bởi test khác chạy song song. */
async function stableRow(page: Page, minGroups = 0): Promise<number> {
  const n = await dataRows(page).count();
  for (let i = 0; i < n; i++) if (!/^QCA/i.test(await cellText(page, i, cfg.codeIdx)) && Number(await cellText(page, i, 3)) >= minGroups) return i;
  return 0;
}
const statusOf = async (page: Page, code: string) => (await (await findRow(page, cfg, code)).first().innerText()).replace(/\s+/g, ' ');

// ---------- Danh sách / Tìm kiếm / Phân trang ----------
test.describe('Trụ cột › Danh sách / Tìm kiếm / Phân trang', () => {
  test(tc('PIL-L01'), async ({ page }) => {
    await openList(page, cfg);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    for (const re of cfg.cols) expect(heads.some(h => re.test(h)), `thiếu cột ${re} trong [${heads.join(' | ')}]`).toBeTruthy();
    expect(await dataRows(page).count()).toBeGreaterThan(0);
  });
  test(tc('PIL-L02'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page), rows = await dataRows(page).count();
    expect(rows).toBe(Math.min(10, n));
    expect(await page.locator('.ant-pagination').first().innerText()).toMatch(/hiển thị 1-\d+ trong\s+\d+/i);
    if (n > 10) await expect(page.locator('.ant-pagination-item-2').first()).toBeVisible();
  });
  test(tc('PIL-L03'), async ({ page }) => {
    await openList(page, cfg);
    const kw = await cellText(page, await stableRow(page), cfg.codeIdx);
    await searchFor(page, cfg, kw);
    if (!(await dataRows(page).count())) { await page.waitForTimeout(1500); await searchFor(page, cfg, kw); } // chờ debounce/dữ liệu đang đổi
    const texts = await rowTexts(page);
    expect(texts.length, `tìm "${kw}" không ra dòng nào`).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('PIL-L04'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await cellText(page, await stableRow(page), cfg.nameIdx)).slice(0, 25).trim();
    await searchFor(page, cfg, kw);
    if (!(await dataRows(page).count())) { await page.waitForTimeout(1500); await searchFor(page, cfg, kw); } // chờ debounce/dữ liệu đang đổi
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('PIL-L05'), async ({ page }) => {
    await openList(page, cfg);
    await searchFor(page, cfg, UNKNOWN);
    expect(await dataRows(page).count()).toBe(0);
    await expect(page.locator('.ant-empty, .ant-table-placeholder').first()).toBeVisible();
  });
  test(tc('PIL-L06'), async ({ page }) => {
    await openList(page, cfg);
    const kw = await cellText(page, await stableRow(page), cfg.codeIdx);
    await searchFor(page, cfg, kw.toUpperCase()); const a = await totalOf(page);
    await searchFor(page, cfg, kw.toLowerCase()); const b = await totalOf(page);
    expect(a).toBeGreaterThan(0);
    expect(b, 'HOA/thường phải cho cùng số kết quả').toBe(a);
  });
  test(tc('PIL-L07'), async ({ page }) => {
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
  test(tc('PIL-L08'), async ({ page }) => {
    await openList(page, cfg);
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    const before = (await rowTexts(page)).join('|');
    await page.locator('.ant-pagination-item-2').first().click();
    await waitList(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    expect((await rowTexts(page)).join('|')).not.toBe(before);
  });
  test(tc('PIL-L09'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await pickOption(page, page.locator('.ant-pagination-options .ant-select').first(), '20');
    await waitList(page);
    expect(await dataRows(page).count()).toBe(Math.min(20, n));
    expect(await totalOf(page)).toBe(n);
  });
  test(tc('PIL-L10'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page);
    await searchFor(page, cfg, UNKNOWN);
    expect(await totalOf(page)).toBe(0);
    await searchFor(page, cfg, '');
    let back = await totalOf(page);
    if (back !== n) { // dữ liệu có thể đổi do test khác chạy song song → đối chiếu với tổng thực tế từ API
      const all = await api('GET', 'dti/pillars?page=1&size=1');
      back = back === (all.data?.totalElements ?? all.data?.total) ? n : back;
    }
    expect(back).toBe(n);
  });
  test(tc('PIL-L12'), async ({ page }) => {
    await openList(page, cfg);
    for (const label of ['Đã khóa', 'Chưa khóa']) {
      await pickOption(page, page.locator(FILTERS).first(), label); await waitList(page);
      const texts = await rowTexts(page);
      expect(texts.length, `phải có trụ cột "${label}"`).toBeGreaterThan(0);
      // "Chưa khóa" không chứa chuỗi "Đã khóa" nên so khớp chính xác theo ô trạng thái
      for (const t of texts) expect(t, `dòng không có trạng thái "${label}"`).toContain(label);
    }
  });
  test(tc('PIL-L13'), async ({ page }) => {
    await openList(page, cfg);
    const rows = await dataRows(page).count(); let idx = -1, n = 0;
    for (let i = 0; i < rows; i++) { const v = Number(await cellText(page, i, 3)); if (v > 0 && v <= 10) { idx = i; n = v; break; } }
    test.skip(idx < 0, 'Không có trụ cột nào có 1–10 nhóm chỉ số');
    await dataRows(page).nth(idx).getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/pillars\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
    expect(await dataRows(page).count(), 'số dòng bảng nhóm trong chi tiết').toBe(n);
  });
});

// ---------- Xem chi tiết ----------
test.describe('Trụ cột › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  test(tc('PIL-V01'), async ({ page }) => {
    needWrite();
    const ind = await ensureIndicator(made); const g = await api('GET', `dti/indicator-groups/${ind.indicatorGroupId ?? ''}`);
    const p = (await api('GET', `dti/pillars/${ind.pillarId}`)).data;
    await openDetail(page, p.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [p.code, 'Thứ tự hiển thị', 'Số nhóm chỉ số', 'Số chỉ số', 'Tổng điểm tối đa', 'Cập nhật lần cuối', 'Nhóm chỉ số thuộc trụ cột', g.data?.code ?? '']) expect(txt, `thiếu "${s}"`).toContain(s);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).join('|');
    for (const h of [/mã nhóm/i, /tên nhóm/i, /số chỉ số/i, /tổng điểm tối đa/i, /thứ tự/i, /thao tác/i]) expect(heads).toMatch(h);
    for (const b of [/xuất excel/i, /^\s*cập nhật\s*$/i, /thêm mới nhóm chỉ số/i]) await expect(page.getByRole('button', { name: b }).first()).toBeVisible();
  });
  test(tc('PIL-V02'), async ({ page }) => {
    needWrite();
    const p = await ensurePillar(made);
    const g1 = await ensureGroup(made, { pillarId: p.id }), g2 = await ensureGroup(made, { pillarId: p.id });
    await ensureIndicator(made, { groupId: g1.id, pillarId: p.id, max: 10 });
    await ensureIndicator(made, { groupId: g2.id, pillarId: p.id, max: 20 });
    await openDetail(page, p.code);
    const rows = dataRows(page);
    expect(await rows.count()).toBe(2);
    let sumInd = 0, sumPts = 0;
    for (let i = 0; i < 2; i++) { sumInd += num(await cellText(page, i, 3)); sumPts += num(await cellText(page, i, 4)); }
    const txt = (await page.locator('.ant-layout-content').first().innerText());
    const pick = (label: string) => num((txt.match(new RegExp(label + '\\s*\\n+\\s*([\\d.,]+)')) ?? [])[1] ?? 'NaN');
    expect(pick('Số chỉ số'), 'Số chỉ số của trụ cột = tổng các nhóm').toBe(sumInd);
    expect(pick('Tổng điểm tối đa'), 'Tổng điểm tối đa của trụ cột = tổng các nhóm').toBe(sumPts);
    expect(sumInd).toBeGreaterThan(0);
  });
  test(tc('PIL-V03'), async ({ page }) => {
    await openDetail(page, undefined, 1);
    const btn = page.getByRole('button', { name: /xuất excel/i }).first();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), btn.click()]);
    expect(dl.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
  registerNotFoundTest('PIL-V04', cfg);
  test(tc('PIL-V05'), async ({ page }) => {
    needWrite();
    const p = await ensurePillar(made);
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRow(page, cfg, p.code));
    expect(items.join('|'), 'menu danh sách của trụ cột đã khóa').toMatch(/mở kho[áa]/i);
    await openDetail(page, p.code);
    const btn = page.getByRole('button', { name: /^\s*cập nhật\s*$/i }).first();
    const blocked = (await btn.count()) === 0 || await btn.isDisabled();
    expect(blocked, 'chi tiết trụ cột đã khóa phải ẩn/vô hiệu nút Cập nhật').toBeTruthy();
  });
});

// ---------- Thêm mới ----------
test.describe('Trụ cột › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PIL-C01'), async ({ page }) => {
    const code = made.add('dti/pillars', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Trụ cột ${code}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('dti/pillars', code);
    expect(rec?.name).toBe(`qc.automation Trụ cột ${code}`); expect(rec?.isLocked).toBe(false);
    const row = await findRow(page, cfg, code);
    await expect(row.first()).toContainText('Chưa khóa');
    expect((await cellText(page, 0, 3)).trim()).toBe('0');
  });
  test(tc('PIL-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(2);
  });
  test(tc('PIL-C03'), async ({ page }) => {
    const a = await ensurePillar(made, { lock: false });
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(a.code); await d.getByPlaceholder(PH_NAME).fill('qc.automation Trụ cột trùng mã');
    await submitAdd(d);
    expect(await toast(page)).toMatch(/đã tồn tại/i);
    expect((await listApi('dti/pillars', a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('PIL-C04'), async () => {
    const a = await ensurePillar(made, { lock: false });
    const low = made.add('dti/pillars', a.code.toLowerCase());
    const r = await api('POST', 'dti/pillars', { code: low, name: `qc.automation Trụ cột ${low}`, displayOrder: 0 });
    expect(r.status, `mã "${low}" chỉ khác hoa/thường với "${a.code}" phải bị từ chối (HTTP ${r.status})`).toBeGreaterThanOrEqual(400);
  });
  test(tc('PIL-C05'), async () => {
    const a = await ensurePillar(made, { lock: false });
    const code = made.add('dti/pillars', code8());
    const r = await api('POST', 'dti/pillars', { code, name: a.name, displayOrder: 0 });
    expect(r.status, `tên trùng "${a.name}" (mã khác) phải bị từ chối (HTTP ${r.status})`).toBeGreaterThanOrEqual(400);
  });
  test(tc('PIL-C06'), async ({ page }) => {
    const c50 = made.add('dti/pillars', (code8() + 'X'.repeat(50)).slice(0, 50));
    const c51 = made.add('dti/pillars', (code8() + 'Y'.repeat(51)).slice(0, 51));
    let d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(c50); await d.getByPlaceholder(PH_NAME).fill('qc.automation Trụ cột mã 50');
    await submitAdd(d);
    expect(await toast(page), 'mã 50 ký tự phải tạo được').toMatch(/thành công/i);
    expect(await findApi('dti/pillars', c50)).toBeTruthy();
    d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(c51); await d.getByPlaceholder(PH_NAME).fill('qc.automation Trụ cột mã 51');
    await submitAdd(d); await page.waitForTimeout(900);
    const msg = (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ') + ' ' + (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' ');
    expect(msg, 'mã 51 ký tự phải báo vượt quá 50 ký tự').toMatch(/vượt quá 50 ký tự/i);
    expect(await findApi('dti/pillars', c51)).toBeNull();
  });
  test(tc('PIL-C07'), async () => {
    const code = made.add('dti/pillars', code8());
    const r = await api('POST', 'dti/pillars', { code, name: 'qc.automation ' + 'N'.repeat(286), displayOrder: 0 });
    expect(r.status, `tên 300 ký tự phải bị chặn (HTTP ${r.status})`).toBeGreaterThanOrEqual(400);
  });
  test(tc('PIL-C08'), async ({ page }) => {
    const code = made.add('dti/pillars', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill('qc.automation hủy');
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi('dti/pillars', code)).toBeNull();
  });
  test(tc('PIL-C09'), async () => {
    const c1 = made.add('dti/pillars', code8()), c2 = made.add('dti/pillars', code8());
    const a = await api('POST', 'dti/pillars', { code: c1, name: '', displayOrder: 0 });
    const b = await api('POST', 'dti/pillars', { code: '', name: 'qc.automation rỗng mã', displayOrder: 0 });
    expect(a.status, `name rỗng: ${a.message}`).toBe(400); expect(a.message).toMatch(/không được để trống/i);
    expect(b.status, `code rỗng: ${b.message}`).toBe(400); expect(b.message).toMatch(/không được để trống/i);
    expect(await findApi('dti/pillars', c1)).toBeNull(); void c2;
  });
});

// ---------- Chỉnh sửa ----------
test.describe('Trụ cột › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PIL-E01'), async ({ page }) => {
    const p = await ensurePillar(made, { lock: false }); const nn = `qc.automation Trụ cột đã sửa ${p.code}`;
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(nn); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('dti/pillars', p.code))?.name).toBe(nn);
    await expect((await findRow(page, cfg, p.code)).first()).toContainText(nn);
    await openDetail(page, p.code);
    await expect(page.locator('.ant-layout-content').first()).toContainText(nn);
  });
  test(tc('PIL-E02'), async ({ page }) => {
    const p = await ensurePillar(made, { lock: false });
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation sửa ${p.code}`); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('dti/pillars', p.code);
    expect(rec?.code).toBe(p.code); expect(rec?.id).toBe(p.id);
  });
  test(tc('PIL-E03'), async ({ page }) => {
    const p = await ensurePillar(made, { lock: false });
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('dti/pillars', p.code))?.name).toBe(p.name);
  });
  test(tc('PIL-E04'), async ({ page }) => {
    const p = await ensurePillar(made, { lock: false });
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('dti/pillars', p.code))?.name).toBe(p.name);
  });
  test(tc('PIL-E05'), async () => {
    const p = await ensurePillar(made);
    const r = await api('PUT', `dti/pillars/${p.id}`, { code: p.code, name: 'qc.automation đổi tên khi khóa', displayOrder: 0 });
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect(r.message).toMatch(/đã bị kho[áa]/i);
    expect((await findApi('dti/pillars', p.code))?.name).toBe(p.name);
  });
  test(tc('PIL-E06'), async () => {
    const a = await ensurePillar(made, { lock: false }), b = await ensurePillar(made, { lock: false });
    const r = await api('PUT', `dti/pillars/${b.id}`, { code: b.code, name: a.name, displayOrder: 0 });
    expect(r.status, `đổi tên trùng "${a.name}" phải bị từ chối (HTTP ${r.status})`).toBeGreaterThanOrEqual(400);
  });
});

// ---------- Khóa / Mở khóa ----------
test.describe('Trụ cột › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PIL-K01'), async ({ page }) => {
    const p = await ensurePillar(made, { lock: false });
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /^\s*kho[áa]\s*$/i); await confirmYes(page);
    expect((await findApi('dti/pillars', p.code))?.isLocked).toBe(true);
    await page.reload(); await waitList(page);
    const row = await findRow(page, cfg, p.code);
    await expect(row.first()).toContainText('Đã khóa');
    const items = await rowMenuItems(page, row);
    expect(items.length, `menu: ${items.join(' | ')}`).toBe(1);
    expect(items[0]).toMatch(/mở kho[áa]/i);
  });
  test(tc('PIL-K02'), async ({ page }) => {
    const p = await ensurePillar(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /mở kho[áa]/i);
    await page.waitForTimeout(500);
    if (await page.getByRole('button', { name: /^\s*có\s*$/i }).filter({ visible: true }).count()) await confirmYes(page);
    expect((await findApi('dti/pillars', p.code))?.isLocked).toBe(false);
    await page.reload(); await waitList(page);
    const row = await findRow(page, cfg, p.code);
    await expect(row.first()).toContainText('Chưa khóa');
    const items = (await rowMenuItems(page, row)).join('|');
    for (const re of [/^kho[áa]$|\|kho[áa]\||^kho[áa]\|/i, /cập nhật/i, /xo[áạ]/i]) expect(items, `menu: ${items}`).toMatch(re);
  });
  test(tc('PIL-K03'), async ({ page }) => {
    const free = await ensurePillar(made, { lock: false }), locked = await ensurePillar(made);
    await page.goto('/#/vi/indicator-groups'); await waitList(page);
    await page.getByRole('button', { name: /thêm mới nhóm chỉ số/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' });
    const sel = d.locator('.ant-form-item').filter({ hasText: /trụ cột/i }).locator('.ant-select').first();
    await sel.click(); await page.keyboard.type('qc.automation Trụ cột'); await page.waitForTimeout(1500);
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    const opts = (await dd.locator('.ant-select-item-option').allInnerTexts()).join('|');
    expect(opts, 'trụ cột đã khóa phải chọn được').toContain(locked.code);
    expect(opts, 'trụ cột CHƯA khóa không được xuất hiện').not.toContain(free.code);
    const gc = made.add('dti/indicator-groups', code8());
    const r = await api('POST', 'dti/indicator-groups', { pillarId: free.id, code: gc, name: `qc.automation Nhóm ${gc}`, displayOrder: 0 });
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400); expect(r.message).toMatch(/trụ cột đã được kh/i);
  });
  test.fixme(tc('PIL-K04') + ' [bỏ qua: quy tắc chưa xác định, cần BA]', async () => {});
});

// ---------- Xóa ----------
test.describe('Trụ cột › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PIL-D01'), async ({ page }) => {
    const p = await ensurePillar(made, { lock: false });
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /xo[áạ]/i); await confirmYes(page);
    expect(await findApi('dti/pillars', p.code)).toBeNull();
    await searchFor(page, cfg, p.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('PIL-D02'), async ({ page }) => {
    const p = await ensurePillar(made, { lock: false });
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /xo[áạ]/i); await confirmNo(page);
    expect(await findApi('dti/pillars', p.code)).toBeTruthy();
  });
  test(tc('PIL-D03'), async ({ page }) => {
    const p = await ensurePillar(made);
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRow(page, cfg, p.code));
    expect(items.some(i => /xo[áạ]/i.test(i)), `menu: ${items.join(' | ')}`).toBeFalsy();
    const r = await api('DELETE', `dti/pillars/${p.id}`);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400); expect(r.message).toMatch(/đã bị kho[áa]/i);
    expect(await findApi('dti/pillars', p.code)).toBeTruthy();
  });
  test(tc('PIL-D04'), async ({ page }) => {
    const p = await ensurePillar(made); await ensureGroup(made, { pillarId: p.id });
    const u = await api('PUT', `dti/pillars/${p.id}/unlock`, {});
    expect(u.status, `mở khóa: ${u.message}`).toBe(200);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /xo[áạ]/i); await confirmYes(page);
    const msg = await toast(page);
    expect(msg).toMatch(/không thể xóa/i);
    expect(await findApi('dti/pillars', p.code)).toBeTruthy();
  });
});

// ---------- Edge / Lỗi ----------
test.describe('Trụ cột › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  const fillValid = async (d: Locator, code: string) => { await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Trụ cột ${code}`); };
  test(tc('PIL-G01'), async ({ page }) => {
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill('   '); await d.getByPlaceholder(PH_NAME).fill('   ');
    await submitAdd(d); await page.waitForTimeout(900);
    const msg = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' ');
    const inline = await d.locator('.ant-form-item-explain-error').count();
    expect(inline > 0 || /không được để trống|bắt buộc|không hợp lệ/i.test(msg), `chuỗi chỉ có khoảng trắng phải bị báo lỗi (inline=${inline}, toast="${msg}")`).toBeTruthy();
    expect(msg).not.toMatch(/thành công/i);
    await expect(d).toBeVisible();
  });
  test(tc('PIL-G02'), async ({ page }) => {
    const SPECIAL = `qc.automation Ngô Thị Ơ Ữ <b>in đậm</b> & "nháy" 'đơn' 100%`;
    const code = code8(); const r = await mkPillar(code, SPECIAL);
    expect(r.status, r.message).toBe(200);
    await openList(page, cfg); await page.reload(); await waitList(page);
    const row = await findRow(page, cfg, code);
    expect((await row.first().innerText()).replace(/\s+/g, ' ')).toContain(SPECIAL);
    expect(await row.first().locator('b').count(), 'HTML trong tên phải hiển thị dạng chữ').toBe(0);
  });
  for (const [id, mode] of [['PIL-G03', 'http500'], ['PIL-G04', 'offline']] as const) {
    test(tc(id), async ({ page }) => {
      const code = made.add('dti/pillars', code8());
      const d = await openAdd(page); await fillValid(d, code);
      const re = /\/api\/v1\/dti\/pillars$/;
      await page.route(re, r => {
        if (r.request().method() !== 'POST') return r.continue();
        return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
      });
      await submitAdd(d); await page.waitForTimeout(1500);
      await expect(d, 'form phải còn mở để người dùng thử lại').toBeVisible();
      expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
      expect(await d.getByPlaceholder(PH_CODE).inputValue(), 'dữ liệu đã nhập không được mất').toBe(code);
      await page.unroute(re);
      expect(await findApi('dti/pillars', code)).toBeNull();
    });
  }
  test(tc('PIL-G05'), async ({ page }) => {
    const code = made.add('dti/pillars', code8());
    const d = await openAdd(page); await fillValid(d, code);
    const btn = d.locator('button', { hasText: /^\s*Thêm mới/ }).last();
    await Promise.all([btn.click(), btn.click({ timeout: 1500 }).catch(() => {})]);
    await page.waitForTimeout(2500);
    expect((await listApi('dti/pillars', code)).filter((x: any) => x.code === code).length, 'bấm Lưu 2 lần chỉ được tạo đúng 1 bản ghi').toBe(1);
  });
});

// ---------- Bảo mật / Hiệu năng ----------
test.describe('Trụ cột › Phân quyền / Hiệu năng', () => {
  registerAuthTest('PIL-A01', cfg);
  registerMatrixTest('PIL-A02', cfg);
  test.describe('chưa đăng nhập', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test(tc('PIL-A03'), async ({ page }) => {
      await page.goto('/#/vi/pillars', { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(await page.locator('input[type=password]').count(), 'phải hiện màn đăng nhập').toBeGreaterThan(0);
      expect(await dataRows(page).count(), 'không lộ dữ liệu').toBe(0);
    });
  });
  registerPerfTest('PIL-P01', cfg);
});
