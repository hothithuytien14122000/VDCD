// B.I.2 NHÓM CHỈ SỐ — script bám testcase IGR-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, cellText, findRow, pickOption, pickByLabel,
  dlg, btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, goto, totalOf,
  registerAuthTest, registerMatrixTest, registerPerfTest, registerNotFoundTest, FILTERS, SPECIAL_NAME,
  ensurePillar, ensureGroup, ensureIndicator,
} from './common';

const cfg = PAGES.IGR;
const RES = cfg.res;
const made = new Made();
test.afterEach(async () => { await made.clean(); });

const PH_CODE = /nhập mã nhóm chỉ số/i, PH_NAME = /nhập tên nhóm chỉ số/i;
const LOCK_RE = /^\s*kh(oá|óa)\s*$/i, UNLOCK_RE = /mở kh(oá|óa)/i, DEL_RE = /xo[áạ]/i, EDIT_RE = /cập nhật/i;
const SAVE_ADD = /^\s*Thêm mới Nhóm chỉ số\s*$/;

async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới nhóm chỉ số/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: SAVE_ADD }).last().click();
async function openEdit(page: Page, code: string) {
  await openList(page, cfg);
  await rowAction(page, await findRow(page, cfg, code), EDIT_RE);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
}
const detailOf = (page: Page, id: string) => goto(page, `${cfg.route}/${id}`);
/** Nhóm đã khóa có 1 chỉ số rồi mở khóa lại (chỉ tạo được chỉ số khi nhóm đã khóa). */
async function groupWithIndicator(unlock = true) {
  const g = await ensureGroup(made);
  const ind = await ensureIndicator(made, { groupId: g.id, pillarId: g.pillarId });
  if (unlock) await api('PUT', `${RES}/${g.id}/unlock`, {});
  return { g, ind };
}
const recOf = async (code: string) => findApi(RES, code);
const fillAdd = async (page: Page, d: Locator, pillarName: string, code: string, name = `qc.automation Nhóm ${code}`) => {
  await pickByLabel(page, d, /trụ cột/i, pillarName);
  await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(name);
};

/** Nhóm có sẵn của hệ thống (không phải dữ liệu auto) - ổn định khi các test khác đang tạo/xóa dữ liệu song song. */
async function stableGroup() {
  const r = await api('GET', `${RES}?page=1&size=100`);
  const x = (r.data?.content ?? []).find((g: any) => !/^QCA/i.test(g.code) && !/^qc\.automation/i.test(g.name));
  if (!x) throw new Error('Không có nhóm chỉ số có sẵn của hệ thống để tìm kiếm');
  return x as { code: string; name: string };
}

// ================= Danh sách / Tìm kiếm / Phân trang =================
test.describe('Nhóm chỉ số › Danh sách / Tìm kiếm / Phân trang', () => {
  test(tc('IGR-L01'), async ({ page }) => {
    await openList(page, cfg);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    for (const re of cfg.cols) expect(heads.some(h => re.test(h)), `thiếu cột ${re} trong [${heads.join(' | ')}]`).toBeTruthy();
    expect(await dataRows(page).count()).toBeGreaterThan(0);
  });
  test(tc('IGR-L02'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page), rows = await dataRows(page).count();
    expect(rows).toBe(Math.min(10, n));
    expect(await page.locator('.ant-pagination').first().innerText()).toMatch(/trong\s+\d+/i);
  });
  test(tc('IGR-L03'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await stableGroup()).code;
    await searchFor(page, cfg, kw);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('IGR-L04'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await stableGroup()).name.slice(0, 25).trim();
    await searchFor(page, cfg, kw);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('IGR-L05'), async ({ page }) => {
    await openList(page, cfg);
    await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
    expect(await dataRows(page).count()).toBe(0);
    await expect(page.locator('.ant-empty, .ant-table-placeholder').first()).toBeVisible();
  });
  test(tc('IGR-L06'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await stableGroup()).code;
    await searchFor(page, cfg, kw.toUpperCase()); const a = await totalOf(page);
    await searchFor(page, cfg, kw.toLowerCase()); const b = await totalOf(page);
    expect(a).toBeGreaterThan(0);
    expect(b, 'HOA/thường phải cho cùng số kết quả').toBe(a);
  });
  test(tc('IGR-L07'), async ({ page }) => {
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
  test(tc('IGR-L08'), async ({ page }) => {
    await openList(page, cfg);
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    const before = (await rowTexts(page)).join('|');
    await page.locator('.ant-pagination-item-2').first().click();
    await waitList(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    expect((await rowTexts(page)).join('|')).not.toBe(before);
  });
  test(tc('IGR-L09'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await pickOption(page, page.locator('.ant-pagination-options .ant-select').first(), '20');
    await waitList(page);
    expect(await dataRows(page).count()).toBe(Math.min(20, n));
    expect(await totalOf(page)).toBe(n);
  });
  test(tc('IGR-L10'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page);
    await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
    expect(await totalOf(page)).toBe(0);
    await searchFor(page, cfg, '');
    expect(await totalOf(page)).toBe(n);
  });
});

// ================= Bộ lọc / cột Chỉ số =================
test.describe('Nhóm chỉ số › Bộ lọc', () => {
  // Giao diện chỉ có bộ lọc theo Trụ cột (không có lọc trạng thái khóa)
  test(tc('IGR-L12'), async ({ page }) => {
    await openList(page, cfg);
    const pillar = await cellText(page, 0, 3);
    await pickOption(page, page.locator(FILTERS).first(), new RegExp(`^\\s*${pillar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`));
    await waitList(page);
    const n = await dataRows(page).count();
    expect(n, `phải có nhóm thuộc trụ cột "${pillar}"`).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect(await cellText(page, i, 3)).toBe(pillar);
  });
  test(tc('IGR-L13'), async ({ page }) => {
    // nhóm có sẵn chỉ số cha + con để kiểm tra cách tính "tính cả chỉ số con"
    const g = await ensureGroup(made);
    const p = await ensureIndicator(made, { groupId: g.id, pillarId: g.pillarId });
    await ensureIndicator(made, { groupId: g.id, pillarId: g.pillarId, parentId: p.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, g.code);
    const shown = Number((await row.first().locator('td').nth(4).innerText()).trim());
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/indicator-groups\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1500);
    const rows = await dataRows(page).count();
    expect(shown, `cột Chỉ số (${shown}) phải bằng số dòng bảng chi tiết (${rows})`).toBe(rows);
  });
});

// ================= Xem chi tiết =================
test.describe('Nhóm chỉ số › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('IGR-V01'), async ({ page }) => {
    const { g, ind } = await groupWithIndicator();
    await detailOf(page, g.id);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [g.code, g.pillarName, 'Thứ tự hiển thị', 'Số chỉ số', 'Tổng điểm tối đa', ind.code]) expect(txt, `thiếu "${s}"`).toContain(s);
    expect(txt).toMatch(/Số chỉ số\s*1\b/); expect(txt).toMatch(/Tổng điểm tối đa\s*10,0/);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim());
    for (const h of ['MÃ CHỈ SỐ', 'TÊN CHỈ SỐ', 'ĐIỂM TỐI THIỂU', 'ĐIỂM TỐI ĐA', 'TRẠNG THÁI', 'THAO TÁC']) expect(heads, `thiếu cột ${h}`).toContain(h);
    for (const b of [/xuất excel/i, /^\s*cập nhật\s*$/i, /thêm chỉ số/i]) await expect(page.locator('button', { hasText: b }).first()).toBeVisible();
  });
  test(tc('IGR-V03'), async ({ page }) => {
    const g = await ensureGroup(made); // mặc định đã khóa
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRow(page, cfg, g.code));
    expect(items.some(i => EDIT_RE.test(i)), 'menu danh sách nhóm đã khóa không có Cập nhật').toBeFalsy();
    await detailOf(page, g.id);
    for (const [re, label] of [[/^\s*cập nhật\s*$/i, 'Cập nhật'], [/thêm chỉ số/i, 'Thêm chỉ số']] as const) {
      const b = page.locator('.ant-layout-content button', { hasText: re });
      const shown = (await b.count()) > 0 && await b.first().isVisible() && await b.first().isEnabled();
      expect(shown, `nhóm đã khóa nhưng chi tiết vẫn cho "${label}" (menu danh sách đã ẩn Cập nhật)`).toBeFalsy();
    }
  });
});
registerNotFoundTest('IGR-V02', cfg);

// ================= Thêm mới =================
test.describe('Nhóm chỉ số › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('IGR-C01'), async ({ page }) => {
    const pil = await ensurePillar(made); const code = made.addDti(RES, code8());
    const d = await openAdd(page);
    await fillAdd(page, d, pil.name, code);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await recOf(code);
    expect(rec?.name).toBe(`qc.automation Nhóm ${code}`); expect(rec?.pillarId).toBe(pil.id); expect(rec?.isLocked).toBeFalsy();
    const row = await findRow(page, cfg, code);
    await expect(row.first()).toContainText(pil.name); await expect(row.first()).toContainText('Chưa khóa');
  });
  test(tc('IGR-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count(), 'phải báo lỗi bắt buộc ở 3 trường').toBeGreaterThanOrEqual(3);
    await expect(d).toBeVisible();
  });
  test(tc('IGR-C03'), async ({ page }) => {
    const a = await ensureGroup(made);
    const d = await openAdd(page);
    await fillAdd(page, d, a.pillarName, a.code, 'qc.automation Nhóm trùng mã');
    await submitAdd(d);
    expect(await toast(page)).toMatch(/mã nhóm chỉ số đã tồn tại/i);
    expect((await listApi(RES, a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('IGR-C04'), async () => {
    const pil = await ensurePillar(made, { lock: false });
    const code1 = made.addDti(RES, code8()), code2 = made.addDti(RES, code8());
    const r1 = await api('POST', RES, { pillarId: pil.id, code: code1, name: 'qc.automation Nhóm', displayOrder: 0 });
    expect(r1.status, `trụ cột chưa khóa (HTTP ${r1.status}: ${r1.message})`).toBe(400);
    expect(r1.message).toMatch(/chỉ có thể chọn trụ cột đã được khóa/i);
    const r2 = await api('POST', RES, { code: code2, name: 'qc.automation Nhóm', displayOrder: 0 });
    expect(r2.status, `thiếu pillarId (HTTP ${r2.status}: ${r2.message})`).toBe(400);
    expect(r2.message).toMatch(/trụ cột không hợp lệ/i);
  });
  test(tc('IGR-C05'), async () => {
    const a = await ensureGroup(made);
    const low = a.code.toLowerCase();
    const r = await api('POST', RES, { pillarId: a.pillarId, code: low, name: 'qc.automation Nhóm khác hoa/thường', displayOrder: 0 });
    if (r.status < 300) made.addDti(RES, low);
    expect(r.status, `mã chỉ khác hoa/thường phải bị coi là trùng (HTTP ${r.status}: ${r.message})`).toBeGreaterThanOrEqual(400);
  });
  test(tc('IGR-C06'), async ({ page }) => {
    const pil = await ensurePillar(made); const code = made.addDti(RES, code8());
    const d = await openAdd(page);
    await fillAdd(page, d, pil.name, code);
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await recOf(code)).toBeNull();
  });
  test(tc('IGR-C07'), async ({ page }) => {
    const pil = await ensurePillar(made);
    const c50 = made.addDti(RES, code8() + 'Z'.repeat(42)), c51 = made.addDti(RES, code8() + 'Y'.repeat(43));
    expect(c50).toHaveLength(50); expect(c51).toHaveLength(51);
    let d = await openAdd(page);
    await fillAdd(page, d, pil.name, c50);
    await submitAdd(d);
    expect(await toast(page), 'mã 50 ký tự phải tạo được').toMatch(/thành công/i);
    expect(await recOf(c50)).toBeTruthy();
    d = await openAdd(page);
    await fillAdd(page, d, pil.name, c51);
    await submitAdd(d); await page.waitForTimeout(800);
    const msg = (await toast(page)) + ' ' + (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ');
    expect(msg, 'mã 51 ký tự phải báo vượt quá 50 ký tự').toMatch(/vượt quá 50/i);
    expect(await recOf(c51), 'mã 51 ký tự không được tạo').toBeNull();
  });
  test(tc('IGR-C08'), async () => {
    const pil = await ensurePillar(made);
    const c = made.addDti(RES, code8());
    const a = await api('POST', RES, { pillarId: pil.id, code: c, name: '', displayOrder: 0 });
    expect(a.status, `name rỗng (HTTP ${a.status}: ${a.message})`).toBe(400); expect(a.message).not.toBe('');
    const b = await api('POST', RES, { pillarId: pil.id, code: '', name: 'qc.automation Nhóm', displayOrder: 0 });
    expect(b.status, `code rỗng (HTTP ${b.status}: ${b.message})`).toBe(400); expect(b.message).not.toBe('');
  });
});

// ================= Chỉnh sửa =================
test.describe('Nhóm chỉ số › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('IGR-E01'), async ({ page }) => {
    const g = await ensureGroup(made, { lock: false }); const nn = `qc.automation Nhóm đã sửa ${g.code}`;
    const d = await openEdit(page, g.code);
    await d.getByPlaceholder(PH_NAME).fill(nn); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await recOf(g.code))?.name).toBe(nn);
    await expect((await findRow(page, cfg, g.code)).first()).toContainText(nn);
  });
  test(tc('IGR-E02'), async ({ page }) => {
    const g = await ensureGroup(made, { lock: false });
    const d = await openEdit(page, g.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await recOf(g.code))?.name).toBe(g.name);
  });
  test(tc('IGR-E03'), async ({ page }) => {
    const g = await ensureGroup(made, { lock: false });
    const d = await openEdit(page, g.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await recOf(g.code))?.name).toBe(g.name);
  });
  test(tc('IGR-E04'), async () => {
    const g = await ensureGroup(made); // đã khóa
    const r = await api('PUT', `${RES}/${g.id}`, { pillarId: g.pillarId, code: g.code, name: 'qc.automation đổi tên', displayOrder: 0 });
    expect(r.status, `sửa nhóm đã khóa (HTTP ${r.status}: ${r.message})`).toBe(400);
    expect(r.message).toMatch(/kh(oá|óa)/i);
    expect((await recOf(g.code))?.name).toBe(g.name);
  });
  test(tc('IGR-E05'), async ({ page }) => {
    const { g } = await groupWithIndicator();
    const p2 = await ensurePillar(made);
    const before = [(await api('GET', `dti/pillars/${g.pillarId}`)).data, (await api('GET', `dti/pillars/${p2.id}`)).data];
    const d = await openEdit(page, g.code);
    await pickByLabel(page, d, /trụ cột/i, p2.name); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await recOf(g.code))?.pillarId, 'nhóm phải chuyển sang trụ cột mới').toBe(p2.id);
    const after = [(await api('GET', `dti/pillars/${g.pillarId}`)).data, (await api('GET', `dti/pillars/${p2.id}`)).data];
    expect(after[0].indicatorCount, 'trụ cột cũ giảm số chỉ số').toBe(before[0].indicatorCount - 1);
    expect(after[1].indicatorCount, 'trụ cột mới tăng số chỉ số').toBe(before[1].indicatorCount + 1);
    expect(after[1].totalMaxScore).toBe(before[1].totalMaxScore + 10);
  });
});

// ================= Khóa / Mở khóa =================
test.describe('Nhóm chỉ số › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('IGR-K01'), async ({ page }) => {
    const g = await ensureGroup(made, { lock: false });
    await openList(page, cfg);
    const row = await findRow(page, cfg, g.code);
    await rowAction(page, row, LOCK_RE); await confirmYes(page);
    expect((await recOf(g.code))?.isLocked).toBe(true);
    await page.waitForTimeout(800);
    const r2 = await findRow(page, cfg, g.code);
    await expect(r2.first()).toContainText('Đã khóa');
    const items = await rowMenuItems(page, r2);
    expect(items.some(i => UNLOCK_RE.test(i)), `menu: ${items.join(' | ')}`).toBeTruthy();
    expect(items.some(i => EDIT_RE.test(i) || DEL_RE.test(i)), `không được còn Cập nhật/Xoá: ${items.join(' | ')}`).toBeFalsy();
  });
  test(tc('IGR-K02'), async ({ page }) => {
    const g = await ensureGroup(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, g.code), UNLOCK_RE); await confirmYes(page);
    expect((await recOf(g.code))?.isLocked).toBe(false);
    await page.waitForTimeout(800);
    const r2 = await findRow(page, cfg, g.code);
    await expect(r2.first()).toContainText('Chưa khóa');
    const items = await rowMenuItems(page, r2);
    expect(items.some(i => EDIT_RE.test(i)) && items.some(i => DEL_RE.test(i)), `menu: ${items.join(' | ')}`).toBeTruthy();
  });
  test(tc('IGR-K03'), async ({ page }) => {
    const a = await ensureGroup(made);                                         // đã khóa
    const b = await ensureGroup(made, { pillarId: a.pillarId, lock: false });  // chưa khóa, cùng trụ cột
    await goto(page, 'indicators');
    await page.getByRole('button', { name: /thêm mới/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' });
    await pickByLabel(page, d, /^\s*trụ cột/i, a.pillarName);
    await d.locator('.ant-form-item').filter({ hasText: /nhóm chỉ số/i }).locator('.ant-select').first().click();
    await page.waitForTimeout(1000);
    const opts = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').allInnerTexts();
    expect(opts.some(o => o.includes(a.name)), `nhóm đã khóa phải có trong [${opts.join(' | ')}]`).toBeTruthy();
    expect(opts.some(o => o.includes(b.name)), `nhóm chưa khóa không được liệt kê: [${opts.join(' | ')}]`).toBeFalsy();
  });
});

// ================= Xóa =================
test.describe('Nhóm chỉ số › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('IGR-D01'), async ({ page }) => {
    const g = await ensureGroup(made, { lock: false });
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, g.code), DEL_RE); await confirmYes(page);
    expect(await recOf(g.code)).toBeNull();
    await searchFor(page, cfg, g.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('IGR-D02'), async ({ page }) => {
    const g = await ensureGroup(made, { lock: false });
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, g.code), DEL_RE); await confirmNo(page);
    expect(await recOf(g.code)).toBeTruthy();
  });
  test(tc('IGR-D03'), async ({ page }) => {
    const g = await ensureGroup(made); // đã khóa
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRow(page, cfg, g.code));
    expect(items.some(i => DEL_RE.test(i)), `menu: ${items.join(' | ')}`).toBeFalsy();
    const r = await api('DELETE', `${RES}/${g.id}`);
    expect(r.status, `DELETE nhóm đã khóa (HTTP ${r.status}: ${r.message})`).toBe(400);
    expect(await recOf(g.code)).toBeTruthy();
  });
  test(tc('IGR-D04'), async ({ page }) => {
    const { g, ind } = await groupWithIndicator();
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, g.code), DEL_RE); await confirmYes(page);
    expect(await toast(page)).toMatch(/không thể xóa/i);
    expect(await recOf(g.code), 'nhóm phải còn nguyên').toBeTruthy();
    expect(await findApi('dti/indicators', ind.code), 'chỉ số phải còn nguyên').toBeTruthy();
  });
});

// ================= Bảo mật / Hiệu năng =================
test.describe('Nhóm chỉ số › Bảo mật / Hiệu năng', () => {
  registerAuthTest('IGR-A01', cfg);
  registerMatrixTest('IGR-A02', cfg);
  test.describe('chưa đăng nhập', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test(tc('IGR-A03'), async ({ page }) => {
      await page.goto(`/#/vi/${cfg.route}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(await page.locator('input[type=password]').count(), 'phải hiện màn đăng nhập').toBeGreaterThan(0);
      expect(await dataRows(page).count(), 'không lộ dữ liệu').toBe(0);
    });
  });
  registerPerfTest('IGR-P01', cfg);
});

// ================= Edge / Lỗi =================
test.describe('Nhóm chỉ số › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('IGR-G01'), async ({ page }) => {
    const pil = await ensurePillar(made);
    const d = await openAdd(page);
    await pickByLabel(page, d, /trụ cột/i, pil.name);
    await d.getByPlaceholder(PH_CODE).fill('   '); await d.getByPlaceholder(PH_NAME).fill('   ');
    await submitAdd(d); await page.waitForTimeout(900);
    const msg = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' ');
    const inline = await d.locator('.ant-form-item-explain-error').count();
    expect(inline > 0 || /không được để trống|bắt buộc|không hợp lệ/i.test(msg), `chuỗi chỉ có khoảng trắng phải bị báo lỗi (inline=${inline}, toast="${msg}")`).toBeTruthy();
    expect(msg, 'không được báo tạo thành công').not.toMatch(/thành công/i);
    await expect(d).toBeVisible();
  });
  test(tc('IGR-G02'), async ({ page }) => {
    const pil = await ensurePillar(made); const code = made.addDti(RES, code8());
    const r = await api('POST', RES, { pillarId: pil.id, code, name: SPECIAL_NAME, displayOrder: 0 });
    if (r.status >= 300) throw new Error(r.message);
    await openList(page, cfg); await page.reload(); await waitList(page);
    const row = await findRow(page, cfg, code);
    expect((await row.first().innerText()).replace(/\s+/g, ' ')).toContain(SPECIAL_NAME);
    expect(await row.first().locator('b').count(), 'HTML trong tên phải hiển thị dạng chữ, không được render').toBe(0);
  });
  for (const [id, mode] of [['IGR-G03', 'http500'], ['IGR-G04', 'offline']] as const) {
    test(tc(id), async ({ page }) => {
      const pil = await ensurePillar(made); const code = made.addDti(RES, code8());
      const d = await openAdd(page); await fillAdd(page, d, pil.name, code);
      const re = new RegExp(`/api/v1/${RES}$`);
      await page.route(re, r => {
        if (r.request().method() !== 'POST') return r.continue();
        return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
      });
      await submitAdd(d); await page.waitForTimeout(1500);
      await expect(d, 'form phải còn mở để người dùng thử lại').toBeVisible();
      expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
      expect(await d.getByPlaceholder(PH_CODE).inputValue(), 'dữ liệu đã nhập không được mất').toBe(code);
      await page.unroute(re);
      expect(await recOf(code)).toBeNull();
    });
  }
  test(tc('IGR-G05'), async ({ page }) => {
    const pil = await ensurePillar(made); const code = made.addDti(RES, code8());
    const d = await openAdd(page); await fillAdd(page, d, pil.name, code);
    await Promise.all([submitAdd(d), submitAdd(d).catch(() => {})]);
    await page.waitForTimeout(2500);
    const same = (await listApi(RES, code)).filter((x: any) => x.code === code);
    expect(same.length, 'bấm Lưu 2 lần chỉ được tạo đúng 1 bản ghi').toBe(1);
  });
});
