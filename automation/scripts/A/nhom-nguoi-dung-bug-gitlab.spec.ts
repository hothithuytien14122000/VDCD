// Testcase BỔ SUNG từ bug GitLab — Người dùng / Nhóm người dùng / Ma trận phân quyền (testcases/docs/catalog-BUG-A1.mjs + GRP-L13, GRP-V06 ở catalog-BUG.mjs).
// Chạy bằng phiên Quản trị hệ thống `auth/admin.json` (catalog: account = admin) → mọi lệnh API cũng dùng token admin (KHÔNG dùng superadmin).
// An toàn: chỉ thao tác trên dữ liệu tự tạo (qc.automation… / QCA…), dọn qua API sau mỗi test; ma trận phân quyền chỉ sửa trên nhóm tự tạo
// rồi gỡ hết quyền và xóa nhóm. Không đăng nhập, không đụng tài khoản QC dùng chung và nhóm của chúng.
// Case không tự động hóa được (so design không có giá trị cụ thể, cần đăng nhập tài khoản mới, cần BA) → để Manual trong catalog, không viết test.
import { Page, Locator } from '@playwright/test';
import { test, expect, tc, dataRows, waitList, totalOf, dlg, toast, rowAction, confirmYes, btnSave, btnCancel, FILTERS, api as apiAs, uid, goto } from './common';
import cfg from '../../accounts.mjs';
import { guardSession } from '../session-guard';

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

test.describe('Bug GitLab › Nhóm người dùng', () => {
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
