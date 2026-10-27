// A.IV.4 ĐƠN VỊ — script bám testcase ORG-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, FILTERS, dataRows, openList, waitList, rowTexts, findRow, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg,
  ensureProvince, ensureUnitType, ensureUser, registerListSuite, registerAuthTest, registerMatrixTest, registerPerfTest,
} from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';

const cfg = PAGES.ORG;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('ORG');

const PH_CODE = /vui lòng nhập mã đơn vị/i, PH_NAME = /vui lòng nhập tên đơn vị/i, PH_MAIL = /vanphong@donvi/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới đơn vị/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: /^\s*Thêm mới/ }).last().click();
async function openEdit(page: Page, code: string) {
  await openList(page, cfg);
  await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return d;
}
async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  await (await findRow(page, cfg, code)).first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/organizations\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1500);
}
async function pickFilter(page: Page, sel: Locator, text: string) {
  await sel.click(); await page.keyboard.type(text.slice(-8)); await page.waitForTimeout(1200);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option', { hasText: text }).first().click();
}
const pageText = async (page: Page) => (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');

test.describe('Đơn vị › Lọc & chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('ORG-L12'), async ({ page }) => {
    const ut = await ensureUnitType(made, 2); const o = await ensureOrg(made, { unitTypeId: ut.id });
    await openList(page, cfg);
    await pickFilter(page, page.locator(FILTERS).first(), `qc.automation Loại ${ut.code}`); await waitList(page);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(`qc.automation Loại ${ut.code}`);
    expect(texts.join('|')).toContain(o.code);
  });
  test(tc('ORG-L13'), async ({ page }) => {
    const p = await ensureProvince(made); const o = await ensureOrg(made, { provinceId: p.id });
    await openList(page, cfg);
    await pickFilter(page, page.locator(FILTERS).nth(1), `qc.automation Tỉnh ${p.code}`); await waitList(page);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(`qc.automation Tỉnh ${p.code}`);
    expect(texts.join('|')).toContain(o.code);
  });
  test(tc('ORG-V01'), async ({ page }) => {
    const p = await ensureProvince(made); const o = await ensureOrg(made, { provinceId: p.id });
    await ensureUser(made, { organizationId: o.id });
    await openDetail(page, o.code);
    const txt = await pageText(page);
    for (const s of [o.name, o.code, `qc.automation Loại`, `qc.automation Tỉnh ${p.code}`, 'Kỳ đánh giá hiện tại']) expect(txt, `thiếu "${s}"`).toContain(s);
    expect(txt).toMatch(/Người dùng\s*1\b/);
    await expect(page.getByRole('button', { name: /thêm người dùng vào đơn vị/i })).toBeVisible();
  });
  test(tc('ORG-V02'), async ({ page }) => {
    const o = await ensureOrg(made); const u = await ensureUser(made, { organizationId: o.id });
    await openDetail(page, o.code);
    const heads = (await page.locator('thead th').allInnerTexts()).join('|').toLowerCase();
    for (const h of ['tên đăng nhập', 'họ tên', 'vai trò', 'email', 'trạng thái']) expect(heads).toContain(h);
    await expect(dataRows(page).filter({ hasText: u.userName })).toHaveCount(1);
    await expect(page.locator(FILTERS).first()).toContainText(/tất cả vai trò/i);
  });
});

test.describe('Đơn vị › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('ORG-C01'), async ({ page }) => {
    const ut = await ensureUnitType(made, 2); const code = made.add('organizations', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${code}`);
    await pickByLabel(page, d, /loại đơn vị/i, `qc.automation Loại ${ut.code}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('organizations', code);
    expect(rec?.unitTypeId).toBe(ut.id);
    const row = await findRow(page, cfg, code);
    await expect(row.first()).toContainText(/chưa khóa|chưa khoá/i);
  });
  test(tc('ORG-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(3);
  });
  test(tc('ORG-C03'), async ({ page }) => {
    const code = made.add('organizations', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${code}`);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(1);
    expect(await findApi('organizations', code)).toBeNull();
  });
  test(tc('ORG-C04'), async ({ page }) => {
    const a = await ensureOrg(made);
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(a.code); await d.getByPlaceholder(PH_NAME).fill('qc.automation ĐV trùng mã');
    await pickByLabel(page, d, /loại đơn vị/i, `qc.automation Loại`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/đã tồn tại/i);
    expect((await listApi('organizations', a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('ORG-C05'), async ({ page }) => {
    const par = await ensureOrg(made, {}, true); const code = made.add('organizations', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${code}`);
    await pickByLabel(page, d, /loại đơn vị/i);
    await pickByLabel(page, d, /đơn vị cha/i, par.code);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('organizations', code))?.parentId).toBe(par.id);
  });
  test(tc('ORG-C06'), async ({ page }) => {
    const p = await ensureProvince(made); const code = made.add('organizations', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${code}`);
    await pickByLabel(page, d, /loại đơn vị/i);
    await pickByLabel(page, d, /đơn vị hành chính cấp tỉnh/i, `qc.automation Tỉnh ${p.code}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('organizations', code))?.provinceId).toBe(p.id);
    await expect((await findRow(page, cfg, code)).first()).toContainText(`qc.automation Tỉnh ${p.code}`);
  });
  test(tc('ORG-C07'), async ({ page }) => {
    const code = made.add('organizations', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${code}`);
    await pickByLabel(page, d, /loại đơn vị/i);
    await d.getByPlaceholder(PH_MAIL).fill('abc');
    await submitAdd(d); await page.waitForTimeout(1000);
    expect(await d.locator('.ant-form-item-explain-error').count(), 'email sai định dạng phải bị chặn').toBeGreaterThan(0);
    expect(await findApi('organizations', code)).toBeNull();
  });
  test(tc('ORG-C08'), async ({ page }) => {
    const code = made.add('organizations', code8());
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill('qc.automation hủy');
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi('organizations', code)).toBeNull();
  });
  test(tc('ORG-C09'), async () => {
    const p = await ensureProvince(made);
    const cr = await api('POST', 'communes', { code: made.add('communes', code8()), name: 'qc.automation Xã rule', provinceId: p.id });
    const ut = await ensureUnitType(made, 2);   // cấp tỉnh
    const code = made.add('organizations', code8());
    const r = await api('POST', 'organizations', { code, name: `qc.automation ĐV ${code}`, unitTypeId: ut.id, provinceId: p.id, communeId: cr.data?.id });
    expect(r.status, `đơn vị loại cấp tỉnh không được tham chiếu xã (HTTP ${r.status}: ${r.message})`).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Đơn vị › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('ORG-E01'), async ({ page }) => {
    const o = await ensureOrg(made); const nn = `qc.automation ĐV đã sửa ${o.code}`;
    const d = await openEdit(page, o.code);
    await d.getByPlaceholder(PH_NAME).fill(nn); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('organizations', o.code))?.name).toBe(nn);
  });
  test(tc('ORG-E02'), async ({ page }) => {
    const o = await ensureOrg(made); const ut2 = await ensureUnitType(made, 2);
    const d = await openEdit(page, o.code);
    await pickByLabel(page, d, /loại đơn vị/i, `qc.automation Loại ${ut2.code}`); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('organizations', o.code))?.unitTypeId).toBe(ut2.id);
  });
  test(tc('ORG-E03'), async ({ page }) => {
    const o = await ensureOrg(made);
    const d = await openEdit(page, o.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('organizations', o.code))?.name).toBe(o.name);
  });
  test(tc('ORG-E04'), async ({ page }) => {
    const o = await ensureOrg(made);
    const d = await openEdit(page, o.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('organizations', o.code))?.name).toBe(o.name);
  });
});

test.describe('Đơn vị › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('ORG-D01'), async ({ page }) => {
    const o = await ensureOrg(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, o.code), /xo[áạ]/i); await confirmYes(page);
    expect(await findApi('organizations', o.code)).toBeNull();
  });
  test(tc('ORG-D02'), async ({ page }) => {
    const o = await ensureOrg(made); await ensureUser(made, { organizationId: o.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, o.code);
    if ((await rowMenuItems(page, row)).some(i => /xo[áạ]/i.test(i))) { await rowAction(page, row, /xo[áạ]/i); await confirmYes(page); await page.waitForTimeout(1000); }
    expect(await findApi('organizations', o.code), 'đơn vị đang có người dùng không được xóa').toBeTruthy();
  });
  test(tc('ORG-D03'), async ({ page }) => {
    const o = await ensureOrg(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, o.code), /xo[áạ]/i); await confirmNo(page);
    expect(await findApi('organizations', o.code)).toBeTruthy();
  });
});

test.describe('Đơn vị › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('ORG-K01'), async ({ page }) => {
    const o = await ensureOrg(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, o.code), /^\s*kho[áa]/i); await confirmYes(page);
    expect(await toast(page)).toMatch(/thành công/i);
    await page.waitForTimeout(800);
    expect((await findApi('organizations', o.code))?.isLocked ?? (await findApi('organizations', o.code))?.locked).toBeTruthy();
    await expect((await findRow(page, cfg, o.code)).first()).toContainText(/đã khóa|đã khoá/i);
    const items = await rowMenuItems(page, await findRow(page, cfg, o.code));
    expect(items.join('|')).not.toMatch(/xo[áạ]|cập nhật/i);
  });
  test(tc('ORG-K02'), async ({ page }) => {
    const o = await ensureOrg(made, {}, true);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, o.code), /mở kho[áa]/i);
    if (await page.getByRole('button', { name: /^\s*(có|đồng ý|xác nhận|mở khoá|mở khóa)\s*$/i }).filter({ visible: true }).count()) await confirmYes(page);
    expect(await toast(page)).toMatch(/thành công/i);
    await page.waitForTimeout(800);
    await expect((await findRow(page, cfg, o.code)).first()).toContainText(/chưa khóa|chưa khoá/i);
  });
});

test.describe('Đơn vị › Tham chiếu tỉnh', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('ORG-R01'), async ({ page }) => {
    const p1 = await ensureProvince(made), p2 = await ensureProvince(made);
    const o = await ensureOrg(made, { provinceId: p1.id });
    await openDetail(page, o.code);
    await page.getByRole('button', { name: /đổi tỉnh/i }).click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    await pickByLabel(page, d, /tỉnh/i, `qc.automation Tỉnh ${p2.code}`);
    await d.locator('button', { hasText: /^\s*(Lưu|Cập nhật|Xác nhận)\s*$/ }).last().click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('organizations', o.code))?.provinceId).toBe(p2.id);
  });
  test(tc('ORG-R02'), async ({ page }) => {
    const p = await ensureProvince(made); const o = await ensureOrg(made, { provinceId: p.id });
    await openDetail(page, o.code);
    await page.getByRole('button', { name: /bỏ tham chiếu/i }).click();
    await page.waitForTimeout(500);
    if (await page.getByRole('button', { name: /^\s*(có|đồng ý|xác nhận|bỏ tham chiếu)\s*$/i }).filter({ visible: true }).count()) await confirmYes(page);
    await page.waitForTimeout(1500);
    expect((await findApi('organizations', o.code))?.provinceId ?? null).toBeNull();
  });
});

test.describe('Đơn vị › Người dùng trong đơn vị', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('ORG-M01'), async ({ page }) => {
    const o = await ensureOrg(made); const u = await ensureUser(made);
    await openDetail(page, o.code);
    await page.getByRole('button', { name: /thêm người dùng vào đơn vị/i }).click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(1200);
    const ph = d.getByPlaceholder(/tìm/i);
    if (await ph.count()) { await ph.first().fill(u.userName); await page.waitForTimeout(1500); }
    await d.locator('tbody tr.ant-table-row').filter({ hasText: u.userName }).first().locator('label').first().click();
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công|đã thêm/i);
    expect((await findApi('idm/users', u.userName, 'userName'))?.organizationId).toBe(o.id);
    await page.waitForTimeout(1000);
    await expect(dataRows(page).filter({ hasText: u.userName })).toHaveCount(1);
  });
  test(tc('ORG-M02'), async ({ page }) => {
    const o = await ensureOrg(made); const u = await ensureUser(made, { organizationId: o.id });
    await openDetail(page, o.code);
    const row = dataRows(page).filter({ hasText: u.userName });
    await row.first().locator('label').first().click();
    await page.getByRole('button', { name: /xóa \d+ đã chọn/i }).click();
    await confirmYes(page);
    await page.waitForTimeout(1500);
    await expect(dataRows(page).filter({ hasText: u.userName })).toHaveCount(0);
    expect((await findApi('idm/users', u.userName, 'userName'))?.organizationId ?? null).toBeNull();
  });
});

test.describe('Đơn vị › Bảo mật / Hiệu năng', () => {
  registerAuthTest('ORG-S01', cfg);
  registerMatrixTest('ORG-S02', cfg);
  registerPerfTest('ORG-P01', cfg);
});

registerEdgeTests({
  P: 'ORG', cfg, made, openAdd, submit: submitAdd,
  fillBlank: async d => { await d.getByPlaceholder(PH_CODE).fill('   '); await d.getByPlaceholder(PH_NAME).fill('   '); },
  fillValid: async (page, d, code) => { await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${code}`); await pickByLabel(page, d, /loại đơn vị/i); },
  makeNamed: async name => { const ut = await ensureUnitType(made, 2); const code = made.add('organizations', code8()); const r = await api('POST', 'organizations', { code, name, unitTypeId: ut.id }); if (r.status !== 200) throw new Error(r.message); return code; },
});

registerNotFoundTest('ORG-V03', cfg);
test.describe('Đơn vị › Bổ sung', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('ORG-V04'), async ({ page }) => {
    const o = await ensureOrg(made); const u1 = await ensureUser(made, { organizationId: o.id }); const u2 = await ensureUser(made, { organizationId: o.id });
    await openDetail(page, o.code);
    expect(await dataRows(page).count()).toBe(2);
    await page.getByPlaceholder(/tìm/i).first().fill(u1.userName); await page.waitForTimeout(1500);
    await expect(dataRows(page)).toHaveCount(1);
    await expect(dataRows(page).first()).toContainText(u1.userName);
  });
  test(tc('ORG-M03'), async ({ page }) => {
    const a = await ensureOrg(made), b = await ensureOrg(made); const u = await ensureUser(made, { organizationId: a.id });
    await openDetail(page, b.code);
    await page.getByRole('button', { name: /thêm người dùng vào đơn vị/i }).click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(1200);
    const ph = d.getByPlaceholder(/tìm/i); if (await ph.count()) { await ph.first().fill(u.userName); await page.waitForTimeout(1500); }
    await d.locator('tbody tr.ant-table-row').filter({ hasText: u.userName }).first().locator('label').first().click();
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công|đã thêm/i);
    expect((await findApi('idm/users', u.userName, 'userName'))?.organizationId, 'người dùng phải được chuyển sang đơn vị mới').toBe(b.id);
  });
});
