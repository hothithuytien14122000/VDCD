// A.IV.3 LOẠI ĐƠN VỊ — script bám testcase UTY-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, findRow, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg,
  ensureUnitType, registerListSuite, registerAuthTest, registerMatrixTest, registerPerfTest, FILTERS,
} from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';

const cfg = PAGES.UTY;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('UTY');

const PH_CODE = /vd: LDV-05/i, PH_NAME = /vd: Cấp Sở/i, PH_DESC = /mô tả phạm vi/i;
const LEVEL = { 1: 'Trung ương', 2: 'Cấp tỉnh', 3: 'Cấp xã' } as const;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới loại đơn vị/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: /^\s*Thêm/ }).last().click();
async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  await (await findRow(page, cfg, code)).first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/unit-types\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
}

test.describe('Loại đơn vị › Bộ lọc', () => {
  test(tc('UTY-L12'), async ({ page }) => {
    await openList(page, cfg);
    for (const label of ['Cấp tỉnh', 'Cấp xã', 'Trung ương']) {
      await pickOption(page, page.locator(FILTERS).first(), label); await waitList(page);
      const texts = await rowTexts(page);
      expect(texts.length, `phải có loại cấp "${label}"`).toBeGreaterThan(0);
      for (const t of texts) expect(t).toContain(label);
    }
  });
});

test.describe('Loại đơn vị › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('UTY-V01'), async ({ page }) => {
    const ut = await ensureUnitType(made, 2); const o = await ensureOrg(made, { unitTypeId: ut.id });
    await openDetail(page, ut.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [ut.code, 'Cấp tỉnh', 'Số đơn vị', 'Cập nhật lần cuối', o.name]) expect(txt, `thiếu "${s}"`).toContain(s);
    expect(txt).toMatch(/mô tả/i);
    for (const b of [/^\s*cập nhật\s*$/i, /thêm mới đơn vị/i, /xuất excel/i]) await expect(page.locator('button', { hasText: b }).first()).toBeVisible();
  });
  test(tc('UTY-V02'), async ({ page }) => {
    const ut = await ensureUnitType(made, 2); await ensureOrg(made, { unitTypeId: ut.id }); await ensureOrg(made, { unitTypeId: ut.id });
    await openDetail(page, ut.code);
    const m = (await page.locator('.ant-layout-content').first().innerText()).match(/ĐƠN VỊ THUỘC LOẠI\s*-\s*(\d+)/i);
    expect(m, 'không thấy tiêu đề "ĐƠN VỊ THUỘC LOẠI - N"').toBeTruthy();
    expect(Number(m![1])).toBe(2);
    expect(await dataRows(page).count()).toBe(2);
  });
});

test.describe('Loại đơn vị › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('UTY-C01'), async ({ page }) => {
    const code = made.add('unit-types', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Loại ${code}`);
    await pickByLabel(page, d, /cấp hành chính/i, 'Cấp tỉnh');
    await d.getByPlaceholder(PH_DESC).fill('qc.automation mô tả');
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('unit-types', code);
    expect(rec?.name).toBe(`qc.automation Loại ${code}`); expect(rec?.description).toBe('qc.automation mô tả'); expect(rec?.adminLevel).toBe(2);
    const row = await findRow(page, cfg, code);
    await expect(row.first()).toContainText('Cấp tỉnh');
    expect((await row.first().locator('td').nth(4).innerText()).trim()).toBe('0');
  });
  test(tc('UTY-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(3);
  });
  test(tc('UTY-C03'), async ({ page }) => {
    const a = await ensureUnitType(made);
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(a.code); await d.getByPlaceholder(PH_NAME).fill('qc.automation Loại trùng mã');
    await pickByLabel(page, d, /cấp hành chính/i, 'Cấp tỉnh');
    await submitAdd(d);
    expect(await toast(page)).toMatch(/đã tồn tại/i);
    expect((await listApi('unit-types', a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('UTY-C04'), async ({ page }) => {
    const code = made.add('unit-types', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill('qc.automation hủy');
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi('unit-types', code)).toBeNull();
  });
  test(tc('UTY-C05'), async ({ page }) => {
    for (const [lvl, label] of [[1, 'Trung ương'], [2, 'Cấp tỉnh'], [3, 'Cấp xã']] as const) {
      const code = made.add('unit-types', code8());
      const d = await openAdd(page);
      await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Loại ${label}`);
      await pickByLabel(page, d, /cấp hành chính/i, label);
      await submitAdd(d);
      expect(await toast(page)).toMatch(/thành công/i);
      expect((await findApi('unit-types', code))?.adminLevel, `cấp "${label}"`).toBe(lvl);
      await expect((await findRow(page, cfg, code)).first()).toContainText(label);
    }
  });
});

test.describe('Loại đơn vị › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openEdit(page: Page, code: string) {
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
  }
  test(tc('UTY-E01'), async ({ page }) => {
    const ut = await ensureUnitType(made); const nn = `qc.automation Loại đã sửa ${ut.code}`;
    const d = await openEdit(page, ut.code);
    await d.getByPlaceholder(PH_NAME).fill(nn); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('unit-types', ut.code))?.name).toBe(nn);
    await expect((await findRow(page, cfg, ut.code)).first()).toContainText(nn);
  });
  test(tc('UTY-E02'), async ({ page }) => {
    const ut = await ensureUnitType(made, 2);
    const d = await openEdit(page, ut.code);
    await pickByLabel(page, d, /cấp hành chính/i, 'Cấp xã');
    await d.getByPlaceholder(PH_DESC).fill('qc.automation mô tả đã sửa'); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('unit-types', ut.code);
    expect(rec?.adminLevel).toBe(3); expect(rec?.description).toBe('qc.automation mô tả đã sửa');
    await expect((await findRow(page, cfg, ut.code)).first()).toContainText('Cấp xã');
  });
  test(tc('UTY-E03'), async ({ page }) => {
    const ut = await ensureUnitType(made);
    const d = await openEdit(page, ut.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('unit-types', ut.code))?.name).toBe(`qc.automation Loại ${ut.code}`);
  });
  test(tc('UTY-E04'), async ({ page }) => {
    const ut = await ensureUnitType(made);
    const d = await openEdit(page, ut.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('unit-types', ut.code))?.name).toBe(`qc.automation Loại ${ut.code}`);
  });
});

test.describe('Loại đơn vị › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('UTY-D01'), async ({ page }) => {
    const ut = await ensureUnitType(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, ut.code), /xo[áạ]/i); await confirmYes(page);
    expect(await findApi('unit-types', ut.code)).toBeNull();
    await searchFor(page, cfg, ut.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('UTY-D02'), async () => {
    const ut = await ensureUnitType(made); await ensureOrg(made, { unitTypeId: ut.id });
    const r = await api('DELETE', `unit-types/${ut.id}`);
    expect(r.status).toBe(400); expect(r.message).toMatch(/không thể xóa/i);
    expect(await findApi('unit-types', ut.code)).toBeTruthy();
  });
  test(tc('UTY-D03'), async ({ page }) => {
    const ut = await ensureUnitType(made); await ensureOrg(made, { unitTypeId: ut.id });
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRow(page, cfg, ut.code));
    expect(items.some(i => /cập nhật/i.test(i))).toBeTruthy();
    expect(items.some(i => /xo[áạ]/i.test(i)), `menu: ${items.join(' | ')}`).toBeFalsy();
  });
  test(tc('UTY-D04'), async ({ page }) => {
    const ut = await ensureUnitType(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, ut.code), /xo[áạ]/i); await confirmNo(page);
    expect(await findApi('unit-types', ut.code)).toBeTruthy();
  });
});

test.describe('Loại đơn vị › Bảo mật / Hiệu năng', () => {
  registerAuthTest('UTY-S01', cfg);
  registerMatrixTest('UTY-S02', cfg);
  registerPerfTest('UTY-P01', cfg);
});

registerEdgeTests({
  P: 'UTY', cfg, made, openAdd, submit: submitAdd,
  fillBlank: async d => { await d.getByPlaceholder(PH_CODE).fill('   '); await d.getByPlaceholder(PH_NAME).fill('   '); },
  fillValid: async (page, d, code) => { await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Loại ${code}`); await pickByLabel(page, d, /cấp hành chính/i, 'Cấp tỉnh'); },
  makeNamed: async name => { const code = made.add('unit-types', code8()); const r = await api('POST', 'unit-types', { code, name, adminLevel: 2 }); if (r.status !== 200) throw new Error(r.message); return code; },
  apiEmpty: async () => { const code = made.add('unit-types', code8()); const r = await api('POST', 'unit-types', { code, name: '', adminLevel: 2 }); return { status: r.status, message: r.message }; },
});

registerNotFoundTest('UTY-V03', cfg);
