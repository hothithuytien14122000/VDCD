// A.IV.1 ĐƠN VỊ HÀNH CHÍNH CẤP TỈNH — script bám testcase PRV-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, findRow, dlg, btnCancel, btnSave, toast, rowAction,
  rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg, ensureProvince, registerListSuite,
  registerAuthTest, registerMatrixTest, registerPerfTest,
} from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';

const cfg = PAGES.PRV;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('PRV');

const PH_CODE = /nhập mã tỉnh/i, PH_NAME = /nhập tên tỉnh/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới tỉnh/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: /^\s*Thêm mới/ }).last().click();
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
    for (const s of [p.code, `qc.automation Tỉnh ${p.code}`, o.name]) expect(txt, `thiếu "${s}"`).toContain(s);
    for (const b of [/chỉnh sửa/i, /thêm mới đơn vị vào tỉnh/i, /mở module đơn vị/i]) await expect(page.getByRole('button', { name: b }).first()).toBeVisible();
  });
  test(tc('PRV-V02'), async ({ page }) => {
    const p = await ensureProvince(made); await ensureOrg(made, { provinceId: p.id }); await ensureOrg(made, { provinceId: p.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, p.code);
    expect((await row.first().locator('td').nth(3).innerText()).trim()).toBe('2');
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/provinces\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
    expect(await dataRows(page).count()).toBe(2);
  });
  test(tc('PRV-V03'), async ({ page }) => {
    const p = await ensureProvince(made);
    await openDetail(page, p.code);
    await page.getByRole('button', { name: /chỉnh sửa/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' });
    await expect(d.getByPlaceholder(PH_NAME)).toHaveValue(`qc.automation Tỉnh ${p.code}`);
  });
});

test.describe('Tỉnh/thành › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-C01'), async ({ page }) => {
    const code = made.add('provinces', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${code}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('provinces', code))?.name).toBe(`qc.automation Tỉnh ${code}`);
    const row = await findRow(page, cfg, code);
    await expect(row.first()).toBeVisible();
    expect((await row.first().locator('td').nth(3).innerText()).trim()).toBe('0');
  });
  test(tc('PRV-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(2);
  });
  test(tc('PRV-C03'), async ({ page }) => {
    const a = await ensureProvince(made);
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(a.code); await d.getByPlaceholder(PH_NAME).fill('qc.automation Tỉnh trùng mã');
    await submitAdd(d);
    expect(await toast(page)).toMatch(/đã tồn tại/i);
    expect((await listApi('provinces', a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('PRV-C04'), async ({ page }) => {
    const code = 'QCA' + code8().slice(3) + 'XYZ';   // 11 ký tự
    expect(code.length).toBe(11);
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill('qc.automation Tỉnh mã dài');
    await submitAdd(d); await page.waitForTimeout(1000);
    const msg = (await toast(page)) + ' ' + (await d.locator('.ant-form-item-explain-error').allInnerTexts().catch(() => [])).join(' ');
    expect(msg).toMatch(/vượt quá 10 ký tự/i);
    expect(await findApi('provinces', code)).toBeNull();
  });
  test(tc('PRV-C05'), async ({ page }) => {
    const code = made.add('provinces', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill('qc.automation hủy');
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi('provinces', code)).toBeNull();
  });
  test(tc('PRV-C06'), async () => {
    const a = await ensureProvince(made);
    const code = made.add('provinces', code8());
    const r = await api('POST', 'provinces', { code, name: `qc.automation Tỉnh ${a.code}` });
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
    expect((await findApi('provinces', p.code))?.name).toBe(`qc.automation Tỉnh ${p.code}`);
  });
  test(tc('PRV-E04'), async ({ page }) => {
    const p = await ensureProvince(made);
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('provinces', p.code))?.name).toBe(`qc.automation Tỉnh ${p.code}`);
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
  P: 'PRV', cfg, made, openAdd, submit: submitAdd,
  fillBlank: async d => { await d.getByPlaceholder(PH_CODE).fill('   '); await d.getByPlaceholder(PH_NAME).fill('   '); },
  fillValid: async (_p, d, code) => { await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${code}`); },
  makeNamed: async name => { const code = made.add('provinces', code8()); const r = await api('POST', 'provinces', { code, name }); if (r.status !== 200) throw new Error(r.message); return code; },
  apiEmpty: async () => { const code = made.add('provinces', code8()); const r = await api('POST', 'provinces', { code, name: '' }); return { status: r.status, message: r.message }; },
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
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${a.code}`); await btnSave(d).click(); await page.waitForTimeout(1500);
    expect((await findApi('provinces', b.code))?.name, 'sửa tên trùng tỉnh khác phải bị từ chối').toBe(`qc.automation Tỉnh ${b.code}`);
  });
});
