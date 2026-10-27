// A.IV.2 ĐƠN VỊ HÀNH CHÍNH CẤP XÃ — script bám testcase COM-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, FILTERS, dataRows, openList, searchFor, waitList, rowTexts, findRow, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg, ensureProvince,
  ensureCommune, registerListSuite, registerAuthTest, registerMatrixTest, registerPerfTest,
} from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';

const cfg = PAGES.COM;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('COM');

const PH_CODE = /vd: 15052/i, PH_NAME = /vd: Xã Mường Lát/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới xã\/phường/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: /^\s*Thêm mới/ }).last().click();
async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  await (await findRow(page, cfg, code)).first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/communes\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
}

test.describe('Xã/phường › Lọc & chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('COM-L12'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    await openList(page, cfg);
    await pickOption(page, page.locator(FILTERS).first(), p.name ?? `qc.automation Tỉnh ${p.code}`); await waitList(page);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(`qc.automation Tỉnh ${p.code}`);
    expect(texts.join('|')).toContain(c.code);
  });
  test(tc('COM-V01'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id, communeId: c.id });
    await openDetail(page, c.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [c.code, c.name, `qc.automation Tỉnh ${p.code}`, o.name]) expect(txt, `thiếu "${s}"`).toContain(s);
    for (const b of [/chỉnh sửa/i, /thêm mới đơn vị vào xã/i]) await expect(page.getByRole('button', { name: b }).first()).toBeVisible();
  });
});

test.describe('Xã/phường › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('COM-C01'), async ({ page }) => {
    const p = await ensureProvince(made); const code = made.add('communes', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${code}`);
    await pickByLabel(page, d, /tỉnh\/thành trực thuộc/i, `qc.automation Tỉnh ${p.code}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('communes', code);
    expect(rec?.provinceId).toBe(p.id);
    await expect((await findRow(page, cfg, code)).first()).toContainText(`qc.automation Tỉnh ${p.code}`);
  });
  test(tc('COM-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(2);
  });
  test(tc('COM-C03'), async ({ page }) => {
    const a = await ensureCommune(made, null);
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(a.code); await d.getByPlaceholder(PH_NAME).fill('qc.automation Xã trùng mã');
    await submitAdd(d);
    expect(await toast(page)).toMatch(/đã tồn tại/i);
    expect((await listApi('communes', a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('COM-C04'), async ({ page }) => {
    const code = made.add('communes', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill('qc.automation hủy');
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi('communes', code)).toBeNull();
  });
  test(tc('COM-C05'), async ({ page }) => {
    const code = made.add('communes', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${code}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('communes', code);
    expect(rec, 'xã không chọn tỉnh được tạo ở trạng thái Chưa tham chiếu').toBeTruthy();
    expect(rec.provinceId ?? null).toBeNull();
  });
});

test.describe('Xã/phường › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openEdit(page: Page, code: string) {
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
  }
  test(tc('COM-E01'), async ({ page }) => {
    const c = await ensureCommune(made, null); const nn = `qc.automation Xã đã sửa ${c.code}`;
    const d = await openEdit(page, c.code);
    await d.getByPlaceholder(PH_NAME).fill(nn); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('communes', c.code))?.name).toBe(nn);
  });
  test(tc('COM-E02'), async ({ page }) => {
    const p1 = await ensureProvince(made), p2 = await ensureProvince(made);
    const c = await ensureCommune(made, p1.id);
    const d = await openEdit(page, c.code);
    await pickByLabel(page, d, /tỉnh\/thành trực thuộc/i, `qc.automation Tỉnh ${p2.code}`); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('communes', c.code))?.provinceId).toBe(p2.id);
  });
  test(tc('COM-E03'), async ({ page }) => {
    const c = await ensureCommune(made, null);
    const d = await openEdit(page, c.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('communes', c.code))?.name).toBe(c.name);
  });
  test(tc('COM-E04'), async ({ page }) => {
    const c = await ensureCommune(made, null);
    const d = await openEdit(page, c.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('communes', c.code))?.name).toBe(c.name);
  });
});

test.describe('Xã/phường › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('COM-D01'), async ({ page }) => {
    const c = await ensureCommune(made, null);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, c.code), /xo[áạ]/i); await confirmYes(page);
    expect(await findApi('communes', c.code)).toBeNull();
  });
  test(tc('COM-D02'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    await ensureOrg(made, { __level: 3, provinceId: p.id, communeId: c.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, c.code);
    const items = await rowMenuItems(page, row);
    if (items.some(i => /xo[áạ]/i.test(i))) { await rowAction(page, row, /xo[áạ]/i); await confirmYes(page); expect(await toast(page)).toMatch(/không thể xóa|đang được|tham chiếu/i); }
    expect(await findApi('communes', c.code), 'xã đang có đơn vị tham chiếu không được xóa').toBeTruthy();
    expect((await api('DELETE', `communes/${c.id}`)).status, 'API xóa xã đang được tham chiếu').toBeGreaterThanOrEqual(400);
  });
  test(tc('COM-D03'), async ({ page }) => {
    const c = await ensureCommune(made, null);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, c.code), /xo[áạ]/i); await confirmNo(page);
    expect(await findApi('communes', c.code)).toBeTruthy();
  });
});

test.describe('Xã/phường › Tham chiếu đơn vị', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('COM-R01'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id });
    await openDetail(page, c.code);
    await page.getByRole('button', { name: /thêm mới đơn vị vào xã/i }).click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(1200);
    const row = d.locator('tbody tr.ant-table-row').filter({ hasText: o.code });
    await row.first().locator('label').first().click();
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('organizations', o.code))?.communeId).toBe(c.id);
    await page.waitForTimeout(1000);
    await expect(dataRows(page).filter({ hasText: o.code })).toHaveCount(1);
  });
  test(tc('COM-R02'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id, communeId: c.id });
    await openDetail(page, c.code);
    const row = dataRows(page).filter({ hasText: o.code });
    await row.first().locator('button').last().click();
    await page.waitForTimeout(500);
    const item = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: /bỏ|hủy|gỡ/i });
    if (await item.count()) await item.first().click();
    await page.waitForTimeout(500);
    if (await page.getByRole('button', { name: /^\s*(có|đồng ý|xác nhận)\s*$/i }).filter({ visible: true }).count()) await confirmYes(page);
    await page.waitForTimeout(1200);
    expect((await findApi('organizations', o.code))?.communeId ?? null).toBeNull();
  });
});

test.describe('Xã/phường › Bảo mật / Hiệu năng', () => {
  registerAuthTest('COM-S01', cfg);
  registerMatrixTest('COM-S02', cfg);
  registerPerfTest('COM-P01', cfg);
});

registerEdgeTests({
  P: 'COM', cfg, made, openAdd, submit: submitAdd,
  fillBlank: async d => { await d.getByPlaceholder(PH_CODE).fill('   '); await d.getByPlaceholder(PH_NAME).fill('   '); },
  fillValid: async (_p, d, code) => { await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${code}`); },
  makeNamed: async name => { const code = made.add('communes', code8()); const r = await api('POST', 'communes', { code, name }); if (r.status !== 200) throw new Error(r.message); return code; },
  apiEmpty: async () => { const code = made.add('communes', code8()); const r = await api('POST', 'communes', { code, name: '' }); return { status: r.status, message: r.message }; },
});

registerNotFoundTest('COM-V02', cfg);
