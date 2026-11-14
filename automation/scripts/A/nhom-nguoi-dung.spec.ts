// A.II.2 NHÓM NGƯỜI DÙNG — script bám testcase GRP-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, findRow, pickOption, dlg, btnCancel, btnSave, toast,
  rowAction, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureRole, ensureUser, registerListSuite,
  registerAuthTest, registerMatrixTest, registerPerfTest,
  anyOrgId, findByName, AUTO_CODE, checkAutoCodeUI } from './common';
import { DUP_CODE } from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';
import { totalOf } from './common';
import { FILTERS } from './common';
import { api as apiAs } from './common';
import { uid } from './common';
import { goto } from './common';
import __g_cfg from '../../accounts.mjs';
import { guardSession } from '../session-guard';

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
// Giao diện mới: chọn thành viên → nút "Xóa (N)" (trước đây "Xóa khỏi nhóm"), hộp xác nhận Huỷ / Xoá
const RM_SELECTED = /x[oó][aá] khỏi nhóm|^\s*x[oó][aá]\s*\(\d+\)\s*$/i;

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
    for (const s of [r.code, r.name, 'qc.automation mô tả chi tiết', 'Số người dùng', 'Cập nhật lần cuối']) expect(txt).toContain(s);
    expect(txt).toMatch(/Số người dùng\s*1\b/);
    // Giao diện mới: bảng thành viên có Mã người dùng, Đơn vị; bỏ cột "Ngày thêm"
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).join('|').toLowerCase();
    for (const h of ['mã người dùng', 'tên đăng nhập', 'họ tên', 'email', 'đơn vị', 'trạng thái']) expect(heads).toContain(h);
  });
});

// ---------- Thêm mới ----------
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm (mới )?nhóm người dùng/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
// Giao diện mới: form chỉ còn Tên nhóm + Mô tả (mã tự sinh NQ-nnn), nút "Lưu"
const PH_NAME = /nhập tên nhóm/i, PH_DESC = /phạm vi công việc/i;
const fillRole = async (d: Locator, f: { name?: string; desc?: string }) => {
  if (f.name !== undefined) await d.getByPlaceholder(PH_NAME).fill(f.name);
  if (f.desc !== undefined) await d.getByPlaceholder(PH_DESC).fill(f.desc);
};
const submitAdd = (d: Locator) => btnSave(d).click();

test.describe('Nhóm người dùng › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('GRP-C01'), async ({ page }) => {
    const tag = made.add('idm/roles', code8(), 'nameHas');
    const d = await openAdd(page);
    await fillRole(d, { name: `qc.automation Nhóm ${tag}`, desc: 'qc.automation mô tả' });
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findByName('idm/roles', tag);
    expect(rec?.name).toBe(`qc.automation Nhóm ${tag}`); expect(rec?.description).toBe('qc.automation mô tả');
    expect(rec?.code, 'mã tự sinh').toMatch(AUTO_CODE['idm/roles']);
    await expect((await findRow(page, cfg, rec.code)).first()).toBeVisible();
  });
  test(tc('GRP-C02'), async ({ page }) => {
    const tag = made.add('idm/roles', code8(), 'nameHas');
    const d = await openAdd(page);
    await fillRole(d, { name: `qc.automation Nhóm ${tag}` });
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect(await findByName('idm/roles', tag)).toBeTruthy();
  });
  test(tc('GRP-C03'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count(), 'thiếu Tên nhóm').toBeGreaterThanOrEqual(1);
    await expect(d).toBeVisible();
  });
  test(tc('GRP-C04'), async ({ page }) => {
    // Mã tự sinh → không nhập mã nên không thể trùng: form không có ô Mã, mã sinh đúng mẫu NQ-nnn và duy nhất
    const a = await ensureRole(made);
    await checkAutoCodeUI(page, cfg, made, { openAdd, submit: submitAdd, existing: a,
      fillValid: async (_p, d, tag) => { await fillRole(d, { name: `qc.automation Nhóm ${tag}` }); } });
  });
  test(tc('GRP-C05'), async ({ page }) => {
    const tag = made.add('idm/roles', code8(), 'nameHas');
    const d = await openAdd(page);
    await fillRole(d, { name: `qc.automation hủy ${tag}` });
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findByName('idm/roles', tag)).toBeNull();
  });
  test(tc('GRP-C06'), async () => {
    const r = await api('POST', 'idm/roles', { name: '' });
    if (r.status === 200) made.add('idm/roles', '', 'nameHas');
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
    await d.getByPlaceholder(PH_NAME).fill(nn);
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('idm/roles', r.code))?.name).toBe(nn);
    await expect((await findRow(page, cfg, r.code)).first()).toContainText(nn);
  });
  test(tc('GRP-E02'), async ({ page }) => {
    const r = await ensureRole(made);
    const d = await openEdit(page, r.code);
    await d.getByPlaceholder(PH_DESC).fill('qc.automation mô tả mới');
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('idm/roles', r.code))?.description).toBe('qc.automation mô tả mới');
  });
  test(tc('GRP-E03'), async ({ page }) => {
    const r = await ensureRole(made);
    const d = await openEdit(page, r.code);
    await d.getByPlaceholder(PH_NAME).fill('');
    await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('idm/roles', r.code))?.name).toBe(r.name);
  });
  test(tc('GRP-E04'), async ({ page }) => {
    const r = await ensureRole(made);
    const d = await openEdit(page, r.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU');
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
    await d.getByPlaceholder(/tìm theo .*tên đăng nhập/i).fill(kw); await page.waitForTimeout(1500);
  }
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
    await page.getByRole('button', { name: RM_SELECTED }).click();
    await confirmYes(page);
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
  P: 'GRP', cfg, made, openAdd, submit: submitAdd, autoCode: AUTO_CODE['idm/roles'],
  fillBlank: async d => { await fillRole(d, { name: '   ' }); },
  fillValid: async (_p, d, tag) => { await fillRole(d, { name: `qc.automation Nhóm ${tag}` }); },
  // API tạo nhóm không trả data → dọn theo tên (mọi tên test đều có mã QCA… duy nhất)
  mk: async (code, name) => { made.add('idm/roles', name, 'nameHas'); const r = await api('POST', 'idm/roles', { code, name, description: 'qc.automation' }); return { status: r.status, message: r.message, data: r.data }; },
  makeNamed: async name => { const r = await ensureRole(made, { name }); return r.code; },
});

registerNotFoundTest('GRP-V04', cfg);
test.describe('Nhóm người dùng › Bổ sung', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('GRP-C07'), async () => {
    // Mã tự sinh: gửi mã chỉ khác hoa/thường với nhóm có sẵn → mã bị bỏ qua, nhóm mới nhận mã tự sinh khác (không trùng)
    const a = await ensureRole(made); const name = `qc.automation Nhóm khác hoa thường ${code8()}`;
    made.add('idm/roles', name, 'nameHas');
    const r = await api('POST', 'idm/roles', { code: a.code.toLowerCase(), name });
    expect(r.status, `tạo nhóm (HTTP ${r.status}: ${r.message})`).toBe(200);
    const rec = await findByName('idm/roles', name);
    expect(rec?.code, 'mã tự sinh').toMatch(AUTO_CODE['idm/roles']);
    expect(String(rec?.code).toUpperCase(), 'mã không trùng (kể cả khác hoa/thường) với nhóm có sẵn').not.toBe(a.code.toUpperCase());
  });
  test(tc('GRP-E05'), async ({ page }) => {
    const r = await ensureRole(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, r.code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
    // Mã tự sinh: form Cập nhật không có ô Mã (không sửa được); nếu có thì phải chỉ-đọc
    const codeInput = d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: /^\s*Mã\b/ }) }).locator('input');
    if (await codeInput.count()) {
      const locked = (await codeInput.first().isDisabled()) || (await codeInput.first().getAttribute('readonly')) !== null;
      expect(locked, 'mã nhóm phải ở trạng thái chỉ-đọc khi sửa').toBeTruthy();
    }
    await expect(d.getByPlaceholder(PH_NAME)).toHaveValue(r.name);
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
    await page.getByRole('button', { name: RM_SELECTED }).click();
    await confirmNo(page);
    await page.waitForTimeout(1000);
    await expect(memberRows(page).filter({ hasText: u.userName })).toHaveCount(1);
    expect((await findApi('idm/users', u.userName, 'userName'))?.roleCode).toBe(r.code);
  });
});

// ===== Case bổ sung từ bug GitLab (gộp từ nhom-nguoi-dung-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
test.describe(() => {
const cfg = __g_cfg;
const AS = 'admin';
const api = (m: string, r: string, b?: any) => apiAs(m, r, b, AS);
const rowsOf = (d: any): any[] => d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
let seq = 0;
const tag = () => (uid() + (seq++).toString(36)).toUpperCase();          // QCAxxxxx + bộ đếm
const DASH = /^[–—-]$/;
/** Nhãn trạng thái người dùng đã khóa (giao diện hiện tại: "Không hoạt động"). */
const LOCKED = /đã kh(oá|óa)|không hoạt động/i;

// ---------- Dọn dữ liệu (token admin) ----------
const trash: (() => Promise<unknown>)[] = [];
test.afterEach(async () => { for (const f of trash.splice(0).reverse()) await f().catch(() => {}); });

async function scan(res: string, hit: (x: any) => boolean): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 30; p++) {
    const r = await api('GET', `${res}?page=${p}&size=100`);
    out.push(...rowsOf(r.data).filter(hit));
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return out;
}
const userByName = async (u: string) => (await scan('idm/users', x => x.userName === u))[0] ?? null;
const roleByName = async (n: string) => (await scan('idm/roles', x => x.name === n))[0] ?? null;
const delUser = async (u: string) => { for (const x of await scan('idm/users', y => String(y.userName).toLowerCase() === u.toLowerCase())) await api('DELETE', `idm/users/${x.id}`); };
const trackUser = (u: string) => { trash.push(() => delUser(u)); return u; };
async function delRole(id: string) {
  await api('PUT', `idm/permission-matrix/roles/${id}`, { permissions: [] });
  await api('DELETE', `idm/roles/${id}`);
}
const trackRoleName = (name: string) => { trash.push(async () => { for (const x of await scan('idm/roles', y => y.name === name)) await delRole(x.id); }); return name; };

async function mkUser(extra: any = {}) {
  const u = trackUser(`qca${Date.now().toString(36).slice(-5)}${(seq++).toString(36)}`);
  const body: any = { name: `qc.automation ${u}`, email: `${u}@cds.local`, userName: u, password: cfg.password,
    isRequireChangePassword: false, isRequestMailInfo: false, organizationId: null, ...extra };
  if (!body.roleCode) delete body.roleCode;
  const r = await api('POST', 'idm/users', body);
  if (r.status !== 200) throw new Error(`Tạo người dùng lỗi (HTTP ${r.status}): ${r.message}`);
  const rec = await userByName(u);
  return { userName: u, id: rec?.id as string, code: rec?.code as string, name: body.name as string };
}
async function mkRole(extra: any = {}) {
  const name = trackRoleName(extra.name ?? `qc.automation Nhóm ${tag()}`);
  const body: any = { name, ...extra };
  const r = await api('POST', 'idm/roles', body);
  if (r.status !== 200) throw new Error(`Tạo nhóm lỗi (HTTP ${r.status}): ${r.message}`);
  const rec = await roleByName(name);
  return { id: rec.id as string, code: rec.code as string, name };
}
async function mkOrg(o: { name?: string; lock?: boolean } = {}) {
  const t = tag();
  const ut = await api('POST', 'unit-types', { name: `qc.automation Loại ${t}`, adminLevel: 2 });
  if (ut.status !== 200) throw new Error('Tạo loại đơn vị lỗi: ' + ut.message);
  trash.push(() => api('DELETE', `unit-types/${ut.data.id}`));
  const name = o.name ?? `qc.automation ĐV ${t}`;
  const r = await api('POST', 'organizations', { name, unitTypeId: ut.data.id });
  if (r.status !== 200) throw new Error('Tạo đơn vị lỗi: ' + r.message);
  const id = r.data.id as string;
  trash.push(async () => { await api('PUT', `organizations/${id}/unlock`, {}); await api('DELETE', `organizations/${id}`); });
  if (o.lock) { const l = await api('PUT', `organizations/${id}/lock`, {}); if (l.status !== 200) throw new Error('Khóa đơn vị lỗi: ' + l.message); }
  return { id, name, code: r.data.code as string };
}

// ---------- UI: Người dùng ----------
const SEARCH_USR = /tìm kiếm theo tên/i;
async function openUsers(page: Page) {
  await goto(page, 'users');
  await expect(page.locator('.ant-table-thead th').first(), 'Bảng Người dùng không hiển thị (session hết hạn?)').toBeVisible({ timeout: 15_000 });
  await dataRows(page).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}); // danh sách có thể rỗng
}
async function findUserRow(page: Page, u: string) {
  await page.getByPlaceholder(SEARCH_USR).fill(u); await waitList(page);
  return dataRows(page).filter({ hasText: u }).first();
}
async function openUserDetail(page: Page, u: string) {
  await openUsers(page);
  await (await findUserRow(page, u)).getByRole('button', { name: /xem chi tiết/i }).click();
  const d = page.locator('.ant-drawer-open .ant-drawer-section, .ant-drawer-open [role=dialog]').last();
  await d.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
  return d;
}
/** Giá trị <dd> theo nhãn <dt> ở drawer chi tiết. */
const ddOf = (d: Locator, label: string) => d.locator('dl > div').filter({ has: d.page().locator('dt', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) }).locator('dd').first();
async function openAddUser(page: Page) {
  await openUsers(page);
  await page.getByRole('button', { name: /thêm (mới )?người dùng\s*$/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
  return d;
}
const PH = { name: 'Ví dụ: Nguyễn Thị Lan', user: 'voi.lan.nt', mail: /ten@donvi\.gov\.vn/, phone: '0912345678', pw: /^Tối thiểu \d+ ký tự$/ };
async function fillUser(d: Locator, f: { name?: string; userName?: string; email?: string; phone?: string; password?: string }) {
  if (f.name !== undefined) await d.getByPlaceholder(PH.name).fill(f.name);
  if (f.userName !== undefined) await d.getByPlaceholder(PH.user).fill(f.userName);
  if (f.email !== undefined) await d.getByPlaceholder(PH.mail).fill(f.email);
  if (f.phone !== undefined) await d.getByPlaceholder(PH.phone).fill(f.phone);
  if (f.password !== undefined) await d.getByPlaceholder(PH.pw).fill(f.password);
}
const errOf = (d: Locator, id: string) => d.locator('.ant-form-item').filter({ has: d.page().locator(`#${id}`) }).locator('.ant-form-item-explain-error');
const css = (l: Locator, props: string[]) => l.evaluate((e, ps) => { const s = getComputedStyle(e); return Object.fromEntries(ps.map(p => [p, s.getPropertyValue(p)])); }, props);
const inputsOf = (d: Locator) => d.locator('input:not([type=search]):not([type=checkbox]):not([type=radio]), textarea').evaluateAll(es => es.map(e => (e as HTMLInputElement).value));
const selectValues = (d: Locator) => d.locator('.ant-select .ant-select-content-value, .ant-select .ant-select-selection-item').allInnerTexts();

// ================= NGƯỜI DÙNG — danh sách =================
guardSession(test);

// ================= NGƯỜI DÙNG — xem chi tiết (drawer) =================

// ================= NGƯỜI DÙNG — thêm mới / chỉnh sửa =================

// ================= NHÓM NGƯỜI DÙNG =================
async function openRoles(page: Page) {
  await goto(page, 'roles');
  await dataRows(page).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
}
const SEARCH_GRP = /tìm theo mã, tên nhóm/i;
async function findRoleRow(page: Page, kw: string) {
  await page.getByPlaceholder(SEARCH_GRP).fill(kw); await waitList(page);
  return dataRows(page).filter({ hasText: kw }).first();
}
async function openRoleDetail(page: Page, code: string) {
  await openRoles(page);
  await (await findRoleRow(page, code)).getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/roles\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1500);
}
const RM_SELECTED = /x[oó][aá] khỏi nhóm|^\s*x[oó][aá]\s*\(\d+\)\s*$/i;

test.describe('Nhóm người dùng', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('GRP-L14'), async ({ page }) => {
    const a = await mkRole();
    await openRoles(page);
    const kw = a.name.split(' ').pop()!;
    await page.getByPlaceholder(SEARCH_GRP).fill(kw); await waitList(page);
    const before = (await dataRows(page).allInnerTexts()).join('|');
    await dataRows(page).filter({ hasText: a.code }).first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/roles\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /quay lại/i }).first().click();
    await page.waitForURL(/roles(\?|$|#)|\/roles$/i).catch(() => {}); await waitList(page);
    await expect(page.getByPlaceholder(SEARCH_GRP), 'giữ nguyên từ khóa tìm kiếm').toHaveValue(kw);
    expect((await dataRows(page).allInnerTexts()).join('|'), 'giữ nguyên kết quả').toBe(before);
  });
  test(tc('GRP-V09'), async ({ page }) => {
    // Phần chắc chắn: tiêu đề trang là tên nhóm người dùng. (Có kèm badge Mã nhóm trong tiêu đề hay không — cần BA xác nhận, không kiểm.)
    const r = await mkRole(); await mkUser({ roleCode: r.code });
    await openRoleDetail(page, r.code);
    await expect(page.locator('.ant-layout-content h1').first()).toContainText(r.name);
  });
  test(tc('GRP-V10'), async ({ page }) => {
    const r = await mkRole({ description: 'qc.automation mô tả nhóm' }); await mkUser({ roleCode: r.code });
    await openRoleDetail(page, r.code);
    const txt = await page.locator('.ant-layout-content').first().innerText();
    expect(txt).not.toMatch(/\{\{[^}]*\}\}/);
    expect(txt.replace(/\s+/g, ' ')).toMatch(/Mô tả qc\.automation mô tả nhóm/);
  });
  test(tc('GRP-V11'), async ({ page }) => {
    const desc = 'qc.automation mô tả dài ' + 'Nhóm cán bộ phụ trách tổng hợp, rà soát và báo cáo kết quả chuyển đổi số của đơn vị. '.repeat(4);
    const r = await mkRole({ description: desc.trim() }); await mkUser({ roleCode: r.code });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openRoleDetail(page, r.code);
    const el = page.locator('.ant-layout-content').getByText(desc.trim().slice(0, 40), { exact: false }).first();
    const clamp = await el.evaluate(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
    expect(clamp, 'mô tả dài phải được rút gọn "..."').toBe(true);
    await el.hover(); await page.waitForTimeout(1200);
    const tip = (await page.locator('.ant-tooltip:not(.ant-tooltip-hidden), .ant-popover:not(.ant-popover-hidden), [role=tooltip]').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
    const title = (await el.getAttribute('title')) ?? (await el.locator('xpath=..').getAttribute('title')) ?? '';
    expect(tip.includes(desc.trim()) || title.replace(/\s+/g, ' ') === desc.trim(), `hover phải hiện tooltip đầy đủ mô tả (tooltip="${tip.slice(0, 80)}", title="${title.slice(0, 40)}")`).toBe(true);
  });
  test(tc('GRP-C08'), async ({ page }) => {
    const name = trackRoleName(`qc.automation Nhóm ${tag()}`);
    await openRoles(page);
    const addBtn = page.getByRole('button', { name: /thêm (mới )?nhóm người dùng/i }).first();
    await addBtn.click();
    let d = dlg(page); await d.waitFor({ state: 'visible' });
    await d.getByPlaceholder(/nhập tên nhóm/i).fill(name);
    await d.getByPlaceholder(/phạm vi công việc/i).fill('qc.automation mô tả');
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await addBtn.click(); d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(400);
    expect((await inputsOf(d)).filter(Boolean), 'mở lại sau khi lưu: form trống').toEqual([]);
    await d.getByPlaceholder(/nhập tên nhóm/i).fill('qc.automation tạm');
    await btnCancel(d).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await addBtn.click(); d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(400);
    expect((await inputsOf(d)).filter(Boolean), 'mở lại sau khi Huỷ: form trống').toEqual([]);
  });
  test(tc('GRP-M10'), async ({ page }) => {
    const r = await mkRole(); const u = await mkUser({ roleCode: r.code });
    await openRoleDetail(page, r.code);
    const row = dataRows(page).filter({ hasText: u.userName }).first();
    const btn = page.getByRole('button', { name: RM_SELECTED });
    await expect(btn, 'chưa chọn: không có nút Xóa').toHaveCount(0);
    await row.locator('label').first().click(); await page.waitForTimeout(400);
    await expect(btn.first(), 'chọn 1 người dùng: hiện nút Xóa').toBeVisible();
    await expect(btn.first()).toContainText('1');
    await row.locator('label').first().click(); await page.waitForTimeout(400);
    await expect(btn, 'bỏ chọn: nút ẩn').toHaveCount(0);
  });
});

// ================= MA TRẬN PHÂN QUYỀN (chỉ trên nhóm tự tạo) =================
let TOTAL = 0;
});
