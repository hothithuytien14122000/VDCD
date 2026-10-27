// A.II.2 NHÓM NGƯỜI DÙNG — script bám testcase GRP-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, findRow, pickOption, dlg, btnCancel, btnSave, toast,
  rowAction, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureRole, ensureUser, registerListSuite,
  registerAuthTest, registerMatrixTest, registerPerfTest,
  anyOrgId } from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';

const cfg = PAGES.GRP;
const made = new Made();
test.afterEach(async () => { await made.clean(); });

registerListSuite('GRP');

async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  const row = await findRow(page, cfg, code);
  await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/roles\/[0-9a-f-]{20,}/i);
  await page.waitForTimeout(1200);
}
const memberRows = (page: Page) => dataRows(page);

test.describe('Nhóm người dùng › Danh sách & Chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('GRP-L12'), async ({ page }) => {
    const r = await ensureRole(made);
    await ensureUser(made, { roleCode: r.code }); await ensureUser(made, { roleCode: r.code });
    await openList(page, cfg);
    const row = await findRow(page, cfg, r.code);
    expect((await row.first().locator('td').nth(4).innerText()).trim()).toBe('2');
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/roles\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
    expect(await memberRows(page).count()).toBe(2);
  });
  test(tc('GRP-V01'), async ({ page }) => {
    const r = await ensureRole(made, { description: 'qc.automation mô tả chi tiết' });
    await ensureUser(made, { roleCode: r.code });
    await openDetail(page, r.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [r.code, r.name, 'qc.automation mô tả chi tiết']) expect(txt).toContain(s);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).join('|').toLowerCase();
    for (const h of ['tên đăng nhập', 'họ tên', 'email', 'ngày thêm', 'trạng thái']) expect(heads).toContain(h);
  });
  test(tc('GRP-V02'), async ({ page }) => {
    const r = await ensureRole(made);
    await ensureUser(made, { roleCode: r.code });
    await openDetail(page, r.code);
    await pickOption(page, page.locator('.ant-select:not(.ant-pagination-options .ant-select)').first(), 'Đang hoạt động');
    await waitList(page);
    expect(await memberRows(page).count()).toBe(1);
    await pickOption(page, page.locator('.ant-select:not(.ant-pagination-options .ant-select)').first(), 'Đã khóa');
    await waitList(page);
    expect(await memberRows(page).count(), 'thành viên đang hoạt động không hiện ở lọc Đã khóa').toBe(0);
  });
  test(tc('GRP-V03'), async ({ page }) => {
    const r = await ensureRole(made);
    await ensureUser(made, { roleCode: r.code });
    await openDetail(page, r.code);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10_000 }), page.getByRole('button', { name: /xuất excel/i }).first().click()]);
    expect(dl.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
});

// ---------- Thêm mới ----------
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới nhóm người dùng/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const fillRole = async (d: Locator, f: { code?: string; name?: string; desc?: string }) => {
  if (f.code !== undefined) await d.getByPlaceholder(/vd: LEADER/i).fill(f.code);
  if (f.name !== undefined) await d.getByPlaceholder(/vd: Cán bộ địa phương/i).fill(f.name);
  if (f.desc !== undefined) await d.getByPlaceholder(/mô tả ngắn/i).fill(f.desc);
};
const submitAdd = (d: Locator) => d.locator('button', { hasText: /^\s*Thêm mới/ }).last().click();

test.describe('Nhóm người dùng › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('GRP-C01'), async ({ page }) => {
    const code = made.add('idm/roles', code8());
    const d = await openAdd(page);
    await fillRole(d, { code, name: `qc.automation Nhóm ${code}`, desc: 'qc.automation mô tả' });
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('idm/roles', code);
    expect(rec?.name).toBe(`qc.automation Nhóm ${code}`); expect(rec?.description).toBe('qc.automation mô tả');
    await expect((await findRow(page, cfg, code)).first()).toBeVisible();
  });
  test(tc('GRP-C02'), async ({ page }) => {
    const code = made.add('idm/roles', code8());
    const d = await openAdd(page);
    await fillRole(d, { code, name: `qc.automation Nhóm ${code}` });
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect(await findApi('idm/roles', code)).toBeTruthy();
  });
  test(tc('GRP-C03'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(2);
  });
  test(tc('GRP-C04'), async ({ page }) => {
    const a = await ensureRole(made);
    const d = await openAdd(page);
    await fillRole(d, { code: a.code, name: 'qc.automation Nhóm trùng mã' });
    await submitAdd(d);
    expect(await toast(page)).toMatch(/đã tồn tại/i);
    expect((await listApi('idm/roles', a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('GRP-C05'), async ({ page }) => {
    const code = made.add('idm/roles', code8());
    const d = await openAdd(page);
    await fillRole(d, { code, name: 'qc.automation hủy' });
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi('idm/roles', code)).toBeNull();
  });
  test(tc('GRP-C06'), async () => {
    const code = made.add('idm/roles', code8());
    const r = await api('POST', 'idm/roles', { code, name: '' });
    expect(r.status, `server nhận tên nhóm rỗng (HTTP ${r.status})`).toBe(400);
  });
});

// ---------- Chỉnh sửa ----------
test.describe('Nhóm người dùng › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openEdit(page: Page, code: string) {
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
  }
  test(tc('GRP-E01'), async ({ page }) => {
    const r = await ensureRole(made); const nn = `qc.automation Nhóm đã sửa ${r.code}`;
    const d = await openEdit(page, r.code);
    await d.getByPlaceholder(/vd: Cán bộ địa phương/i).fill(nn);
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('idm/roles', r.code))?.name).toBe(nn);
    await expect((await findRow(page, cfg, r.code)).first()).toContainText(nn);
  });
  test(tc('GRP-E02'), async ({ page }) => {
    const r = await ensureRole(made);
    const d = await openEdit(page, r.code);
    await d.getByPlaceholder(/mô tả ngắn/i).fill('qc.automation mô tả mới');
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('idm/roles', r.code))?.description).toBe('qc.automation mô tả mới');
  });
  test(tc('GRP-E03'), async ({ page }) => {
    const r = await ensureRole(made);
    const d = await openEdit(page, r.code);
    await d.getByPlaceholder(/vd: Cán bộ địa phương/i).fill('');
    await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('idm/roles', r.code))?.name).toBe(r.name);
  });
  test(tc('GRP-E04'), async ({ page }) => {
    const r = await ensureRole(made);
    const d = await openEdit(page, r.code);
    await d.getByPlaceholder(/vd: Cán bộ địa phương/i).fill('qc.automation KHÔNG LƯU');
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('idm/roles', r.code))?.name).toBe(r.name);
  });
});

// ---------- Xóa ----------
test.describe('Nhóm người dùng › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('GRP-D01'), async ({ page }) => {
    const r = await ensureRole(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, r.code), /xo[áạ]/i);
    await confirmYes(page);
    expect(await findApi('idm/roles', r.code)).toBeNull();
    await searchFor(page, cfg, r.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('GRP-D02'), async ({ page }) => {
    const r = await ensureRole(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, r.code), /xo[áạ]/i);
    await confirmNo(page);
    expect(await findApi('idm/roles', r.code)).toBeTruthy();
  });
  test(tc('GRP-D03'), async ({ page }) => {
    const r = await ensureRole(made);
    const u = await ensureUser(made, { roleCode: r.code });
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, r.code), /xo[áạ]/i);
    await confirmYes(page);
    const stillThere = await findApi('idm/roles', r.code);
    expect(stillThere, 'nhóm đang có thành viên không được xóa (hoặc phải có cảnh báo chặn)').toBeTruthy();
    expect((await findApi('idm/users', u.userName, 'userName'))?.roleCode).toBe(r.code);
  });
});

// ---------- Thành viên ----------
test.describe('Nhóm người dùng › Thành viên', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  async function openAddMember(page: Page, code: string) {
    await openDetail(page, code);
    await page.getByRole('button', { name: /thêm người dùng vào nhóm/i }).click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(800); return d;
  }
  const modalRow = (d: Locator, u: string) => d.locator('tbody tr.ant-table-row').filter({ hasText: u });
  async function searchModal(page: Page, d: Locator, kw: string) {
    await d.getByPlaceholder(/tìm theo tên đăng nhập/i).fill(kw); await page.waitForTimeout(1500);
  }
  test(tc('GRP-M01'), async ({ page }) => {
    const r = await ensureRole(made); const u = await ensureUser(made, { organizationId: await anyOrgId() });
    const d = await openAddMember(page, r.code);
    await searchModal(page, d, u.userName);
    await modalRow(d, u.userName).first().locator('input[type=checkbox]').check({ force: true });
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công|đã thêm/i);
    await page.waitForTimeout(1000);
    await expect(memberRows(page).filter({ hasText: u.userName })).toHaveCount(1);
    expect((await findApi('idm/users', u.userName, 'userName'))?.roleCode).toBe(r.code);
  });
  test(tc('GRP-M02'), async ({ page }) => {
    const A = await ensureRole(made), B = await ensureRole(made);
    const u = await ensureUser(made, { roleCode: A.code, organizationId: await anyOrgId() });
    const d = await openAddMember(page, B.code);
    await searchModal(page, d, u.userName);
    const row = modalRow(d, u.userName);
    if (await row.count()) {
      const cb = row.first().locator('input[type=checkbox]');
      if (await cb.isEnabled()) { await cb.check({ force: true }); await btnSave(d).click(); await page.waitForTimeout(1500); }
    }
    const rec = await findApi('idm/users', u.userName, 'userName');
    const groups: string[] = [...(rec?.roleListCode ?? [])]; if (rec?.roleCode) groups.push(rec.roleCode);
    const both = groups.includes(A.code) && groups.includes(B.code);
    expect(both, `user thuộc đồng thời 2 nhóm: ${[...new Set(groups)].join(',')}`).toBeFalsy();
  });
  test(tc('GRP-M03'), async ({ page }) => {
    const r = await ensureRole(made); const u = await ensureUser(made, { roleCode: r.code, organizationId: await anyOrgId() });
    const d = await openAddMember(page, r.code);
    await searchModal(page, d, u.userName);
    const row = modalRow(d, u.userName);
    if (await row.count()) await expect(row.first().locator('input[type=checkbox]')).toBeDisabled();
    else expect(await row.count()).toBe(0);
  });
  test(tc('GRP-M04'), async ({ page }) => {
    const r = await ensureRole(made); const u = await ensureUser(made, { organizationId: await anyOrgId() });
    const d = await openAddMember(page, r.code);
    await searchModal(page, d, u.userName);
    const n = await d.locator('tbody tr.ant-table-row').count();
    expect(n).toBeGreaterThan(0);
    for (const t of await d.locator('tbody tr.ant-table-row').allInnerTexts()) expect(t.toLowerCase()).toContain(u.userName);
  });
  test(tc('GRP-M05'), async ({ page }) => {
    const r = await ensureRole(made); const u1 = await ensureUser(made, { organizationId: await anyOrgId() }); const u2 = await ensureUser(made, { organizationId: await anyOrgId() });
    const d = await openAddMember(page, r.code);
    for (const u of [u1, u2]) {
      await searchModal(page, d, u.userName);
      await modalRow(d, u.userName).first().locator('input[type=checkbox]').check({ force: true });
    }
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công|đã thêm/i);
    await page.waitForTimeout(1000);
    expect(await memberRows(page).count()).toBe(2);
  });
  test(tc('GRP-M06'), async ({ page }) => {
    const r = await ensureRole(made);
    const d = await openAddMember(page, r.code);
    const save = btnSave(d);
    if (await save.isEnabled()) await save.click();
    await page.waitForTimeout(1000);
    expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/internal server error|exception/);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    expect(await memberRows(page).count()).toBe(0);
  });
  test(tc('GRP-M07'), async ({ page }) => {
    const r = await ensureRole(made); const u = await ensureUser(made, { roleCode: r.code, organizationId: await anyOrgId() });
    await openDetail(page, r.code);
    const row = memberRows(page).filter({ hasText: u.userName });
    await row.first().locator('label').first().click();
    await page.getByRole('button', { name: /xóa khỏi nhóm/i }).click();
    await dlg(page).getByRole('button', { name: /xóa khỏi nhóm/i }).click();
    await page.waitForTimeout(1200);
    await expect(memberRows(page).filter({ hasText: u.userName })).toHaveCount(0);
    const rec = await findApi('idm/users', u.userName, 'userName');
    expect(rec, 'user vẫn tồn tại').toBeTruthy();
    expect(rec.roleCode || '').not.toBe(r.code);
  });
});

// ---------- Bảo mật & hiệu năng ----------
test.describe('Nhóm người dùng › Bảo mật / Hiệu năng', () => {
  registerAuthTest('GRP-S01', cfg);
  registerMatrixTest('GRP-S02', cfg);
  registerPerfTest('GRP-P01', cfg);
});

registerEdgeTests({
  P: 'GRP', cfg, made, openAdd, submit: submitAdd,
  fillBlank: async d => { await fillRole(d, { code: '   ', name: '   ' }); },
  fillValid: async (_p, d, code) => { await fillRole(d, { code, name: `qc.automation Nhóm ${code}` }); },
  makeNamed: async name => { const r = await ensureRole(made, { name }); return r.code; },
});

registerNotFoundTest('GRP-V04', cfg);
test.describe('Nhóm người dùng › Bổ sung', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('GRP-C07'), async () => {
    const a = await ensureRole(made);
    const r = await api('POST', 'idm/roles', { code: a.code.toLowerCase(), name: `qc.automation Nhóm khác hoa thường ${a.code}` });
    if (r.status === 200) made.add('idm/roles', a.code.toLowerCase());
    expect(r.status, `mã nhóm chỉ khác hoa/thường phải bị coi là trùng (HTTP ${r.status}: ${r.message})`).toBeGreaterThanOrEqual(400);
  });
  test(tc('GRP-E05'), async ({ page }) => {
    const r = await ensureRole(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, r.code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
    const codeInput = d.getByPlaceholder(/vd: LEADER/i);
    const locked = (await codeInput.isDisabled()) || (await codeInput.getAttribute('readonly')) !== null;
    expect(locked, 'mã nhóm phải ở trạng thái chỉ-đọc khi sửa').toBeTruthy();
  });
  test(tc('GRP-V05'), async ({ page }) => {
    const r = await ensureRole(made); const u1 = await ensureUser(made, { roleCode: r.code }); const u2 = await ensureUser(made, { roleCode: r.code });
    await openDetail(page, r.code);
    expect(await memberRows(page).count()).toBe(2);
    await page.getByPlaceholder(/tìm/i).first().fill(u1.userName); await page.waitForTimeout(1500);
    await expect(memberRows(page)).toHaveCount(1);
    await expect(memberRows(page).first()).toContainText(u1.userName);
    await page.getByPlaceholder(/tìm/i).first().fill(u2.userName + 'zzz'); await page.waitForTimeout(1500);
    await expect(memberRows(page)).toHaveCount(0);
  });
  test(tc('GRP-M08'), async ({ page }) => {
    const r = await ensureRole(made); const u = await ensureUser(made, { roleCode: r.code });
    await openDetail(page, r.code);
    await memberRows(page).filter({ hasText: u.userName }).first().locator('label').first().click();
    await page.getByRole('button', { name: /xóa khỏi nhóm/i }).click();
    await dlg(page).getByRole('button', { name: /^\s*hu[ỷy]\s*$/i }).click();
    await page.waitForTimeout(1000);
    await expect(memberRows(page).filter({ hasText: u.userName })).toHaveCount(1);
    expect((await findApi('idm/users', u.userName, 'userName'))?.roleCode).toBe(r.code);
  });
});
