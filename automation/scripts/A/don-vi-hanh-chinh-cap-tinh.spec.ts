// A.IV.1 ĐƠN VỊ HÀNH CHÍNH CẤP TỈNH — script bám testcase PRV-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, findRow, dlg, btnCancel, btnSave, toast, rowAction,
  rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg, ensureProvince, registerListSuite, DUP_CODE,
  registerAuthTest, registerMatrixTest, registerPerfTest, findByName, AUTO_CODE, checkAutoCodeUI,
} from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';

const cfg = PAGES.PRV;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('PRV');

// Giao diện mới: form không còn ô Mã (mã tự sinh TINH-nnn); nút "Thêm tỉnh/thành", nút lưu "Lưu"
const PH_NAME = /nhập tên tỉnh/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm (mới )?tỉnh/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => btnSave(d).click();
async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  await (await findRow(page, cfg, code)).first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/provinces\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
}

test.describe('Tỉnh/thành › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-V01'), async ({ page }) => {
    const p = await ensureProvince(made); const o = await ensureOrg(made, { provinceId: p.id });
    await openDetail(page, p.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [p.code, p.name, 'Số xã/phường', 'Số đơn vị', 'Đơn vị thuộc tỉnh/thành', o.name]) expect(txt, `thiếu "${s}"`).toContain(s);
    // Giao diện mới: màn chi tiết chỉ còn nút Cập nhật / Xoá (bỏ "Thêm mới đơn vị vào tỉnh", "Mở module đơn vị")
    await expect(page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first()).toBeVisible();
  });
  test(tc('PRV-V02'), async ({ page }) => {
    const p = await ensureProvince(made); await ensureOrg(made, { provinceId: p.id }); await ensureOrg(made, { provinceId: p.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, p.code);
    expect((await row.first().locator('td').nth(4).innerText()).trim()).toBe('2');   // cột Số đơn vị (sau cột Số xã/phường)
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/provinces\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
    expect(await dataRows(page).count()).toBe(2);
  });
  test(tc('PRV-V03'), async ({ page }) => {
    const p = await ensureProvince(made);
    await openDetail(page, p.code);
    await page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' });
    await expect(d.getByPlaceholder(PH_NAME)).toHaveValue(p.name);
  });
});

test.describe('Tỉnh/thành › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-C01'), async ({ page }) => {
    const tag = made.add('provinces', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${tag}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findByName('provinces', tag);
    expect(rec?.name).toBe(`qc.automation Tỉnh ${tag}`);
    expect(rec?.code, 'mã tự sinh').toMatch(AUTO_CODE.provinces);
    const row = await findRow(page, cfg, rec.code);
    await expect(row.first()).toBeVisible();
    expect((await row.first().locator('td').nth(4).innerText()).trim()).toBe('0');
  });
  test(tc('PRV-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    // form mới chỉ còn 1 trường bắt buộc: Tên tỉnh/thành (Mã tự sinh)
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(1);
  });
  test(tc('PRV-C03'), async ({ page }) => {
    // Mã tự sinh: không còn nhập mã nên không thể trùng → form không có ô Mã, mã sinh đúng mẫu & không trùng
    const a = await ensureProvince(made);
    await checkAutoCodeUI(page, cfg, made, { openAdd, submit: submitAdd, existing: a,
      fillValid: async (_pg, d, tag) => { await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${tag}`); } });
  });
  test(tc('PRV-C04'), async ({ page }) => {
    // Mã tự sinh: không còn ô nhập Mã → mã dài không nhập được qua form; [API] mã 51 ký tự client gửi bị bỏ qua, mã lưu là mã tự sinh
    const d = await openAdd(page);
    expect(await d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: /^\s*Mã\b/ }) }).count(), 'form không còn ô Mã').toBe(0);
    const sent = code8() + 'A'.repeat(43); expect(sent.length).toBe(51);
    const r = await api('POST', 'provinces', { code: sent, name: `qc.automation Tỉnh mã dài ${sent.slice(0, 8)}` });
    if (r.data?.id) made.addId('provinces', r.data.id);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(200);
    expect(r.data?.code, 'mã client gửi bị bỏ qua').not.toBe(sent);
    expect(r.data?.code).toMatch(AUTO_CODE.provinces);
  });
  test(tc('PRV-C05'), async ({ page }) => {
    const tag = made.add('provinces', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation hủy ${tag}`);
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findByName('provinces', tag)).toBeNull();
  });
  test(tc('PRV-C06'), async () => {
    const a = await ensureProvince(made);
    const code = made.add('provinces', code8());
    const r = await api('POST', 'provinces', { code, name: a.name });
    if (r.data?.id) made.addId('provinces', r.data.id);
    expect(r.status, `tạo tỉnh trùng tên (HTTP ${r.status})`).toBe(400);
  });
});

test.describe('Tỉnh/thành › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openEdit(page: Page, code: string) {
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
  }
  test(tc('PRV-E01'), async ({ page }) => {
    const p = await ensureProvince(made); const nn = `qc.automation Tỉnh đã sửa ${p.code}`;
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(nn); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('provinces', p.code))?.name).toBe(nn);
    await expect((await findRow(page, cfg, p.code)).first()).toContainText(nn);
  });
  test(tc('PRV-E02'), async ({ page }) => {
    const p = await ensureProvince(made);
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh sửa mã ${p.code}`); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('provinces', p.code);
    expect(rec?.code).toBe(p.code); expect(rec?.id).toBe(p.id);
  });
  test(tc('PRV-E03'), async ({ page }) => {
    const p = await ensureProvince(made);
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('provinces', p.code))?.name).toBe(p.name);
  });
  test(tc('PRV-E04'), async ({ page }) => {
    const p = await ensureProvince(made);
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('provinces', p.code))?.name).toBe(p.name);
  });
});

test.describe('Tỉnh/thành › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-D01'), async ({ page }) => {
    const p = await ensureProvince(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /xo[áạ]/i); await confirmYes(page);
    expect(await findApi('provinces', p.code)).toBeNull();
    await searchFor(page, cfg, p.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('PRV-D02'), async ({ page }) => {
    const p = await ensureProvince(made); await ensureOrg(made, { provinceId: p.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, p.code);
    const items = await rowMenuItems(page, row);
    if (items.some(i => /xo[áạ]/i.test(i))) { await rowAction(page, row, /xo[áạ]/i); await confirmYes(page); expect(await toast(page)).toMatch(/không thể xóa/i); }
    expect(await findApi('provinces', p.code), 'tỉnh đang có đơn vị không được xóa').toBeTruthy();
    expect((await api('DELETE', `provinces/${p.id}`)).message).toMatch(/không thể xóa/i);
  });
  test(tc('PRV-D03'), async ({ page }) => {
    const p = await ensureProvince(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /xo[áạ]/i); await confirmNo(page);
    expect(await findApi('provinces', p.code)).toBeTruthy();
  });
});

test.describe('Tỉnh/thành › Bảo mật / Hiệu năng', () => {
  registerAuthTest('PRV-S01', cfg);
  registerMatrixTest('PRV-S02', cfg);
  registerPerfTest('PRV-P01', cfg);
});

registerEdgeTests({
  P: 'PRV', cfg, made, openAdd, submit: submitAdd, autoCode: AUTO_CODE.provinces,
  fillBlank: async d => { await d.getByPlaceholder(PH_NAME).fill('   '); },
  fillValid: async (_p, d, tag) => { await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${tag}`); },
  mk: async (code, name) => { const r = await api('POST', 'provinces', { code, name }); return { status: r.status, message: r.message }; },
  makeNamed: async name => { const r = await api('POST', 'provinces', { name }); if (r.status !== 200) throw new Error(r.message); made.addId('provinces', r.data.id); return r.data.code; },
  apiEmpty: async () => { const r = await api('POST', 'provinces', { name: '' }); if (r.data?.id) made.addId('provinces', r.data.id); return { status: r.status, message: r.message }; },
});

registerNotFoundTest('PRV-V04', cfg);
test.describe('Tỉnh/thành › Bổ sung', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-E05'), async ({ page }) => {
    const a = await ensureProvince(made), b = await ensureProvince(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, b.code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
    await d.getByPlaceholder(PH_NAME).fill(a.name); await btnSave(d).click(); await page.waitForTimeout(1500);
    expect((await findApi('provinces', b.code))?.name, 'sửa tên trùng tỉnh khác phải bị từ chối').toBe(b.name);
  });
});
