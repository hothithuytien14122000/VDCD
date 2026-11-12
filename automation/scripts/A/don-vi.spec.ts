// A.IV.4 ĐƠN VỊ — script bám testcase ORG-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, FILTERS, dataRows, openList, waitList, rowTexts, findRow, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg,
  ensureProvince, ensureUnitType, ensureUser, registerListSuite, registerAuthTest, registerMatrixTest, registerPerfTest,
  findByName, AUTO_CODE, checkAutoCodeUI, searchFor,
} from './common';
import { DUP_CODE } from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';

const cfg = PAGES.ORG;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('ORG');

// Giao diện mới: không còn ô Mã (mã tự sinh DV-nnnn); nút lưu "Lưu"; Đơn vị cha chọn qua popover có ô tìm;
// ô Tỉnh/thành chỉ bật sau khi chọn Loại đơn vị; ô Xã chỉ bật với loại cấp xã.
const PH_NAME = /vui lòng nhập tên đơn vị/i, PH_MAIL = /vanphong@donvi/i, PROV = /^\s*tỉnh\/thành/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm (mới )?đơn vị/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return d;
}
const submitAdd = (d: Locator) => btnSave(d).click();
/** Chọn Đơn vị cha: nút "Chọn đơn vị cha..." mở popover có ô "Tìm theo mã, tên đơn vị" → bấm dòng có tên đơn vị. */
async function pickParent(page: Page, d: Locator, name: string) {
  await d.getByRole('button', { name: /chọn đơn vị cha/i }).click();
  const pop = page.locator('.ant-popover').filter({ visible: true }).last();
  await pop.getByPlaceholder(/tìm theo mã, tên đơn vị/i).fill(name.slice(-8)); await page.waitForTimeout(1500);
  await pop.getByText(name, { exact: true }).first().click(); await page.waitForTimeout(500);
}
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
/** Ô "Loại đơn vị" chỉ nạp 200 loại đầu tiên (unit-types?size=200&sort=+code) — loại mới tạo (mã LDV-5xx) nằm ngoài danh sách nên
 *  không chọn được và form Cập nhật hiện GUID, ô Tỉnh/thành bị khóa (lỗi đã ghi nhận). Test UI dùng loại đơn vị có sẵn trong 200 loại đầu. */
const stdUT: Record<number, { id: string; name: string; code: string }[]> = {};
async function stdUnitTypes(level = 2) {
  if (!stdUT[level]) {
    const l = (await api('GET', 'unit-types?page=1&size=200&sort=%2Bcode')).data;
    const xs = (l?.content ?? l?.items ?? l ?? []) as any[];
    stdUT[level] = xs.filter(x => x.adminLevel === level && !/qc\.automation/i.test(x.name) && xs.filter(y => y.name === x.name).length === 1)
      .map(x => ({ id: x.id, name: x.name, code: x.code }));
    if (stdUT[level].length < 2) throw new Error(`Không có đủ loại đơn vị cấp ${level} trong 200 loại đầu để test`);
  }
  return stdUT[level];
}
const pageText = async (page: Page) => (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');

test.describe('Đơn vị › Lọc & chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('ORG-L12'), async ({ page }) => {
    const ut = (await stdUnitTypes(2))[0]; const o = await ensureOrg(made, { unitTypeId: ut.id });
    await openList(page, cfg);
    await pickFilter(page, page.locator(FILTERS).first(), ut.name); await waitList(page);
    await searchFor(page, cfg, o.code);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(ut.name);
    expect(texts.join('|')).toContain(o.code);
  });
  test(tc('ORG-V01'), async ({ page }) => {
    const p = await ensureProvince(made); const o = await ensureOrg(made, { provinceId: p.id });
    const u = await ensureUser(made, { organizationId: o.id });
    await openDetail(page, o.code);
    const txt = await pageText(page);
    // Giao diện mới: Mã đơn vị, Loại đơn vị, Đơn vị cha, Tỉnh/thành, Xã/phường, Địa chỉ, SĐT, Email, Cập nhật lần cuối + bảng người dùng thuộc đơn vị
    for (const s of [o.name, o.code, 'qc.automation Loại', p.name, 'Đơn vị cha', 'Xã/phường', 'Cập nhật lần cuối', 'Người dùng thuộc đơn vị', u.userName]) expect(txt, `thiếu "${s}"`).toContain(s);
    await expect(page.getByRole('button', { name: /thêm người dùng vào đơn vị/i })).toBeVisible();
  });
  test(tc('ORG-V02'), async ({ page }) => {
    const o = await ensureOrg(made); const u = await ensureUser(made, { organizationId: o.id });
    await openDetail(page, o.code);
    const heads = (await page.locator('thead th').allInnerTexts()).join('|').toLowerCase();
    for (const h of ['tên đăng nhập', 'họ tên', 'email', 'nhóm người dùng', 'trạng thái']) expect(heads).toContain(h);
    await expect(dataRows(page).filter({ hasText: u.userName })).toHaveCount(1);
    // Giao diện mới: bỏ bộ lọc "Tất cả vai trò", thay bằng ô tìm theo tên đăng nhập, họ tên, email
    await expect(page.getByPlaceholder(/tìm theo tên đăng nhập, họ tên, email/i)).toBeVisible();
  });
});

test.describe('Đơn vị › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('ORG-C01'), async ({ page }) => {
    const ut = (await stdUnitTypes(2))[0]; const tag = made.add('organizations', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${tag}`);
    await pickByLabel(page, d, /loại đơn vị/i, ut.name);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findByName('organizations', tag);
    expect(rec?.unitTypeId).toBe(ut.id);
    expect(rec?.code, 'mã tự sinh').toMatch(AUTO_CODE.organizations);
    const row = await findRow(page, cfg, rec.code);
    await expect(row.first()).toContainText(/chưa khóa|chưa khoá/i);
  });
  test(tc('ORG-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count(), 'thiếu Tên và Loại đơn vị').toBeGreaterThanOrEqual(2);
  });
  test(tc('ORG-C03'), async ({ page }) => {
    const tag = made.add('organizations', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${tag}`);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(1);
    expect(await findByName('organizations', tag)).toBeNull();
  });
  test(tc('ORG-C04'), async ({ page }) => {
    // Mã tự sinh → không nhập mã nên không thể trùng: form không có ô Mã, mã sinh đúng mẫu DV-nnnn và duy nhất
    const a = await ensureOrg(made);
    await checkAutoCodeUI(page, cfg, made, { openAdd, submit: submitAdd, existing: a,
      fillValid: async (pg, d, tag) => { await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${tag}`); await pickByLabel(pg, d, /loại đơn vị/i); } });
  });
  test(tc('ORG-C05'), async ({ page }) => {
    const par = await ensureOrg(made, {}, true); const tag = made.add('organizations', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${tag}`);
    await pickByLabel(page, d, /loại đơn vị/i);
    await pickParent(page, d, par.name);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findByName('organizations', tag))?.parentId).toBe(par.id);
  });
  test(tc('ORG-C06'), async ({ page }) => {
    const p = await ensureProvince(made); const ut = (await stdUnitTypes(2))[0]; const tag = made.add('organizations', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${tag}`);
    await pickByLabel(page, d, /loại đơn vị/i, ut.name);   // ô Tỉnh/thành chỉ bật sau khi chọn Loại đơn vị
    await pickByLabel(page, d, PROV, p.name);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findByName('organizations', tag);
    expect(rec?.provinceId).toBe(p.id);
    await expect((await findRow(page, cfg, rec.code)).first()).toContainText(p.name);
  });
  test(tc('ORG-C07'), async ({ page }) => {
    const tag = made.add('organizations', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${tag}`);
    await pickByLabel(page, d, /loại đơn vị/i);
    await d.getByPlaceholder(PH_MAIL).fill('abc');
    await submitAdd(d); await page.waitForTimeout(1000);
    expect(await d.locator('.ant-form-item-explain-error').count(), 'email sai định dạng phải bị chặn').toBeGreaterThan(0);
    expect(await findByName('organizations', tag)).toBeNull();
  });
  test(tc('ORG-C08'), async ({ page }) => {
    const tag = made.add('organizations', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation hủy ${tag}`);
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findByName('organizations', tag)).toBeNull();
  });
  test(tc('ORG-C09'), async () => {
    const p = await ensureProvince(made);
    const cr = await api('POST', 'communes', { name: `qc.automation Xã rule ${code8()}`, provinceId: p.id }); made.addId('communes', cr.data?.id);
    const ut = await ensureUnitType(made, 2);   // cấp tỉnh
    const tag = code8();
    const r = await api('POST', 'organizations', { name: `qc.automation ĐV ${tag}`, unitTypeId: ut.id, provinceId: p.id, communeId: cr.data?.id });
    if (r.data?.id) made.addId('organizations', r.data.id);
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
    const [ut1, ut2] = await stdUnitTypes(2); const o = await ensureOrg(made, { unitTypeId: ut1.id });
    const d = await openEdit(page, o.code);
    await pickByLabel(page, d, /loại đơn vị/i, ut2.name); await btnSave(d).click();
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
    const o = await ensureOrg(made, { provinceId: p1.id, unitTypeId: (await stdUnitTypes(2))[0].id });
    // Giao diện mới: bỏ nút "Đổi tỉnh" ở màn chi tiết → đổi Tỉnh/thành trong form Cập nhật (nút Cập nhật ở màn chi tiết)
    await openDetail(page, o.code);
    await page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    await pickByLabel(page, d, PROV, p2.name);
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('organizations', o.code))?.provinceId).toBe(p2.id);
    await page.waitForTimeout(800);
    expect(await pageText(page)).toContain(p2.name);
  });
  test(tc('ORG-R02'), async ({ page }) => {
    const p = await ensureProvince(made); const o = await ensureOrg(made, { provinceId: p.id, unitTypeId: (await stdUnitTypes(2))[0].id });
    // Giao diện mới: bỏ nút "Bỏ tham chiếu" → xóa Tỉnh/thành trong form Cập nhật (để trống = Chưa tham chiếu)
    await openDetail(page, o.code);
    await page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    const sel = d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: PROV }) }).locator('.ant-select').first();
    await sel.hover(); await page.waitForTimeout(300);
    const clear = sel.locator('.ant-select-clear');
    expect(await clear.count(), 'ô Tỉnh/thành phải xóa được (để trống = Chưa tham chiếu)').toBeGreaterThan(0);
    await clear.first().click(); await page.waitForTimeout(400);
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    await page.waitForTimeout(800);
    expect((await findApi('organizations', o.code))?.provinceId ?? null).toBeNull();
    expect(await pageText(page)).toMatch(/Tỉnh\/thành\s*Chưa tham chiếu/);
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

let og: Record<string, { id: string }> = {};
test.afterEach(() => { og = {}; });
registerEdgeTests({
  P: 'ORG', cfg, made, openAdd, submit: submitAdd, autoCode: AUTO_CODE.organizations,
  fillBlank: async d => { await d.getByPlaceholder(PH_NAME).fill('   '); },
  fillValid: async (page, d, tag) => { await d.getByPlaceholder(PH_NAME).fill(`qc.automation ĐV ${tag}`); await pickByLabel(page, d, /loại đơn vị/i); },
  hasParent: true,
  mk: async (code, name, parent) => {
    const ut = await ensureUnitType(made, 2);
    if (parent) { og[parent] ??= await ensureOrg(made, { unitTypeId: ut.id }); }
    const r = await api('POST', 'organizations', { code, name, unitTypeId: ut.id, parentId: parent ? og[parent].id : null });
    return { status: r.status, message: r.message, data: r.data };   // có data.id → tự dọn theo id (sau cha/loại)
  },
  makeNamed: async name => { const ut = await ensureUnitType(made, 2); const r = await api('POST', 'organizations', { name, unitTypeId: ut.id }); if (r.status !== 200) throw new Error(r.message); made.addId('organizations', r.data.id); return r.data.code; },
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
