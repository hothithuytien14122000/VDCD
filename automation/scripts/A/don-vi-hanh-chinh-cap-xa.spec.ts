// A.IV.2 ĐƠN VỊ HÀNH CHÍNH CẤP XÃ — script bám testcase COM-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, FILTERS, dataRows, openList, searchFor, waitList, rowTexts, findRow, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg, ensureProvince,
  ensureCommune, registerListSuite, registerAuthTest, registerMatrixTest, registerPerfTest, findByName, AUTO_CODE, checkAutoCodeUI,
} from './common';
import { DUP_CODE } from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';

const cfg = PAGES.COM;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('COM');

// Giao diện mới: form không còn ô Mã (mã tự sinh XA-nnnn); Tỉnh/thành bắt buộc; nút "Thêm xã/phường", nút lưu "Lưu"
const PH_NAME = /nhập tên xã\/phường/i, PROV = /^\s*tỉnh\/thành/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm (mới )?xã\/phường/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => btnSave(d).click();
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
    for (const t of texts) expect(t).toContain(p.name);
    expect(texts.join('|')).toContain(c.code);
  });
  test(tc('COM-V01'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id, communeId: c.id });
    await openDetail(page, c.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [c.code, c.name, p.name, 'Số đơn vị', 'Đơn vị thuộc xã/phường', o.name]) expect(txt, `thiếu "${s}"`).toContain(s);
    // Giao diện mới: màn chi tiết chỉ còn nút Cập nhật / Xoá (bỏ "Thêm mới đơn vị vào xã")
    await expect(page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first()).toBeVisible();
  });
});

test.describe('Xã/phường › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('COM-C01'), async ({ page }) => {
    const p = await ensureProvince(made); const tag = made.add('communes', code8(), 'nameHas');
    const d = await openAdd(page);
    await pickByLabel(page, d, PROV, p.name);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${tag}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findByName('communes', tag);
    expect(rec?.provinceId).toBe(p.id);
    expect(rec?.code, 'mã tự sinh').toMatch(AUTO_CODE.communes);
    await expect((await findRow(page, cfg, rec.code)).first()).toContainText(p.name);
  });
  test(tc('COM-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(2);
  });
  test(tc('COM-C03'), async ({ page }) => {
    // Mã tự sinh: không còn nhập mã nên không thể trùng → form không có ô Mã, mã sinh đúng mẫu & không trùng
    const p = await ensureProvince(made); const a = await ensureCommune(made, p.id);
    await checkAutoCodeUI(page, cfg, made, { openAdd, submit: submitAdd, existing: a,
      fillValid: async (pg, d, tag) => { await pickByLabel(pg, d, PROV, p.name); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${tag}`); } });
  });
  test(tc('COM-C04'), async ({ page }) => {
    const tag = made.add('communes', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation hủy ${tag}`);
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findByName('communes', tag)).toBeNull();
  });
  test(tc('COM-C05'), async ({ page }) => {
    // Giao diện mới: Tỉnh/thành là trường bắt buộc → không chọn tỉnh thì báo lỗi, không tạo xã
    const tag = made.add('communes', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${tag}`);
    await submitAdd(d); await page.waitForTimeout(800);
    await expect(d).toBeVisible();
    await expect(d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: PROV }) }).locator('.ant-form-item-explain-error')).toHaveCount(1);
    expect(await findByName('communes', tag), 'không chọn tỉnh thì không được tạo').toBeNull();
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
  test(tc('COM-E02'), async ({ page }) => {
    const p1 = await ensureProvince(made), p2 = await ensureProvince(made);
    const c = await ensureCommune(made, p1.id);
    const d = await openEdit(page, c.code);
    await pickByLabel(page, d, PROV, p2.name); await btnSave(d).click();
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
    // Giao diện mới: màn chi tiết xã không còn nút "Thêm mới đơn vị vào xã"; tham chiếu xã được chọn ở form Đơn vị (ô "Đơn vị hành chính cấp xã")
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id });
    const cur = (await api('GET', `organizations/${o.id}`)).data;
    const u = await api('PUT', `organizations/${o.id}`, { ...cur, provinceId: p.id, communeId: c.id });
    expect(u.status, `gán xã cho đơn vị (HTTP ${u.status}: ${u.message})`).toBe(200);
    expect((await findApi('organizations', o.code))?.communeId).toBe(c.id);
    await openDetail(page, c.code);
    await expect(dataRows(page).filter({ hasText: o.code })).toHaveCount(1);
    expect((await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ')).toMatch(/Số đơn vị\s*1\b/);
  });
  test(tc('COM-R02'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id, communeId: c.id });
    // Giao diện mới: bỏ tham chiếu xã bằng cách sửa đơn vị (xóa ô xã) → đơn vị không còn trong danh sách đơn vị của xã
    await openDetail(page, c.code);
    await expect(dataRows(page).filter({ hasText: o.code })).toHaveCount(1);
    const cur = (await api('GET', `organizations/${o.id}`)).data;
    const u = await api('PUT', `organizations/${o.id}`, { ...cur, communeId: null });
    expect(u.status, `bỏ tham chiếu xã (HTTP ${u.status}: ${u.message})`).toBe(200);
    expect((await findApi('organizations', o.code))?.communeId ?? null).toBeNull();
    await page.reload(); await page.waitForTimeout(1500);
    await expect(dataRows(page).filter({ hasText: o.code })).toHaveCount(0);
  });
});

test.describe('Xã/phường › Bảo mật / Hiệu năng', () => {
  registerAuthTest('COM-S01', cfg);
  registerMatrixTest('COM-S02', cfg);
  registerPerfTest('COM-P01', cfg);
});

let pv: Record<string, { id: string; name?: string }> = {};
test.afterEach(() => { pv = {}; });
registerEdgeTests({
  P: 'COM', cfg, made, openAdd, submit: submitAdd, autoCode: AUTO_CODE.communes,
  fillBlank: async d => { await d.getByPlaceholder(PH_NAME).fill('   '); },
  // danh sách tỉnh trong form được nạp khi mở trang → tỉnh tạo sau đó chưa có; chọn tỉnh đầu tiên sẵn có
  fillValid: async (pg, d, tag) => { await pickByLabel(pg, d, PROV); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${tag}`); },
  hasParent: true,
  mk: async (code, name, parent = 'A') => { pv[parent] ??= await ensureProvince(made); const r = await api('POST', 'communes', { code, name, provinceId: pv[parent].id }); return { status: r.status, message: r.message, data: r.data }; },
  makeNamed: async name => { const r = await api('POST', 'communes', { name }); if (r.status !== 200) throw new Error(r.message); made.addId('communes', r.data.id); return r.data.code; },
  apiEmpty: async () => { const r = await api('POST', 'communes', { name: '' }); if (r.data?.id) made.addId('communes', r.data.id); return { status: r.status, message: r.message }; },
});

registerNotFoundTest('COM-V02', cfg);
