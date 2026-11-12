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

test.describe('Bug GitLab › Người dùng › Danh sách', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('USR-L35'), async ({ page }) => {
    await openUsers(page);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    expect(heads.some(h => /số điện thoại/i.test(h)), `bảng còn cột Số điện thoại: [${heads.join(' | ')}]`).toBe(false);
  });
  test(tc('USR-L37'), async ({ page }) => {
    await openUsers(page);
    const n0 = await totalOf(page);
    const sel = page.locator(FILTERS).nth(0);
    await sel.click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dd.locator('.ant-select-item-option').first().waitFor({ state: 'visible' });
    const opts = (await dd.locator('.ant-select-item-option').allInnerTexts()).map(s => s.trim());
    expect(opts[0], `mục đầu tiên của bộ lọc: [${opts.slice(0, 4).join(' | ')}]`).toBe('Tất cả nhóm người dùng');
    await dd.locator('.ant-select-item-option').nth(1).click(); await waitList(page);
    const n1 = await totalOf(page);
    await sel.click();
    const dd2 = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dd2.locator('.ant-select-item-option', { hasText: /^\s*Tất cả nhóm người dùng\s*$/ }).first().click(); await waitList(page);
    expect(n1, 'lọc theo 1 nhóm phải thu hẹp danh sách').toBeLessThanOrEqual(n0);
    expect(await totalOf(page), 'chọn lại "Tất cả nhóm người dùng" thì tổng số bản ghi bằng lúc chưa lọc').toBe(n0);
  });
  test(tc('USR-L41'), async ({ page }) => {
    await openUsers(page);
    const size = 20;
    for (let i = await totalOf(page); i <= size; i++) await mkUser();   // đảm bảo có trang 2
    await page.reload(); await waitList(page);
    await page.locator('.ant-pagination-item-2').first().click(); await waitList(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    const before = (await dataRows(page).allInnerTexts()).join('|');
    await page.reload(); await waitList(page); await page.waitForTimeout(800);
    await expect(page.locator('.ant-pagination-item-active'), 'sau F5 phải vẫn ở trang 2').toHaveText('2');
    expect((await dataRows(page).allInnerTexts()).join('|'), 'dữ liệu trang 2 giống trước khi F5').toBe(before);
  });
});

// ================= NGƯỜI DÙNG — xem chi tiết (drawer) =================
test.describe('Bug GitLab › Người dùng › Xem chi tiết', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('USR-V06'), async ({ page }) => {
    const u = await mkUser();
    const d = await openUserDetail(page, u.userName);
    const txt = (await d.innerText()).replace(/\s+/g, ' ');
    for (const s of [/ngày tạo/i, /đổi mật khẩu/i, /đăng nhập gần nhất/i, /01\/01\/1901/]) expect(txt, `drawer còn "${s.source}"`).not.toMatch(s);
  });
  test(tc('USR-V08'), async ({ page }) => {
    const u = await mkUser();
    await openUsers(page);
    await rowAction(page, await findUserRow(page, u.userName), /^\s*kho[áạ]\s*$/i);
    await confirmYes(page); await waitList(page);
    const row = await findUserRow(page, u.userName);
    const listBadge = row.locator('span.inline-flex', { hasText: LOCKED }).first();
    await expect(listBadge, 'người dùng phải ở trạng thái đã khóa').toBeVisible();
    const P = ['background-color', 'color', 'border-top-color', 'border-top-width'];
    const a = await css(listBadge, P);
    await row.getByRole('button', { name: /xem chi tiết/i }).click();
    const d = page.locator('.ant-drawer-open .ant-drawer-section').last(); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600);
    const drawerBadge = ddOf(d, 'Trạng thái').locator('span.inline-flex, span', { hasText: LOCKED }).first();
    const b = await css(drawerBadge, P);
    expect(b, 'label "Đã khóa" ở drawer phải giống badge ở danh sách').toEqual(a);
  });
  test(tc('USR-V10'), async ({ page }) => {
    const r = await mkRole(); const u = await mkUser({ roleCode: r.code });
    const d = await openUserDetail(page, u.userName);
    const labels = (await d.locator('dt').allInnerTexts()).map(s => s.trim());
    expect(labels.some(l => /^vai trò$/i.test(l)), `drawer có trường "Vai trò": [${labels.join(' | ')}]`).toBe(false);
    expect(labels, 'phân quyền thể hiện qua "Nhóm người dùng"').toContain('Nhóm người dùng');
  });
  test(tc('USR-V11'), async ({ page }) => {
    const r = await mkRole(); const u = await mkUser({ roleCode: r.code });
    const d = await openUserDetail(page, u.userName);
    await expect(d.getByText(/xem quyền của nhóm/i)).toHaveCount(0);
  });
  test(tc('USR-V12'), async ({ page }) => {
    // (1) người dùng chưa đăng nhập lần nào → trạng thái trống
    const u = await mkUser();
    let d = await openUserDetail(page, u.userName);
    const sec = d.locator('xpath=.//div[normalize-space(text())="Truy cập gần đây" or normalize-space(text())="Đăng nhập gần đây"]/following-sibling::*[1]');
    await expect(sec, 'người dùng chưa đăng nhập: mục Đăng nhập gần đây hiển thị trạng thái trống').toHaveText(/chưa có/i);
    // (2) tài khoản quản trị đang dùng (chỉ XEM, không đăng nhập lại): dòng đầu tiên khớp lần đăng nhập mới nhất trong Nhật ký truy cập
    const me = (await api('GET', 'idm/users/info')).data;
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    d = await openUserDetail(page, me.userName);
    const txt = (await d.innerText()).replace(/\s+/g, ' ');
    // đọc nhật ký NGAY SAU khi đọc drawer (tài khoản dùng chung có thể phát sinh lượt truy cập mới)
    const logs = rowsOf((await api('GET', 'system/access-logs?page=1&size=200')).data)
      .filter((x: any) => x.userId === me.id && x.eventCode === 'AUTH.LOGIN');
    expect(logs.length, 'Nhật ký truy cập phải có lần đăng nhập của tài khoản quản trị').toBeGreaterThan(0);
    const latest = logs[0];
    const [, y, mo, da, hh, mi] = String(latest.occurredOn).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)!;
    const when = new RegExp(`^${da}/${mo}/${y}.{0,6}${hh}:${mi}`);
    const after = txt.split(/(Truy cập|Đăng nhập) gần đây/i).pop() ?? '';
    const entries = after.split(/(?=\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/).map(x => x.trim()).filter(x => /^\d{2}\/\d{2}\/\d{4}/.test(x));
    const logins = entries.filter(x => /Đăng nhập/.test(x));
    expect(logins.length, `mục Đăng nhập gần đây phải có lượt đăng nhập (các dòng: ${entries.slice(0, 3).join(' | ')})`).toBeGreaterThan(0);
    const first = logins[0];
    const dev = String(latest.device ?? '').replace(/\s*[·•]\s*/g, ' · ');
    expect(first, `lượt đăng nhập trên cùng phải là lần mới nhất trong Nhật ký (${latest.occurredOn}, ${dev}, IP ${latest.ipAddress})`).toMatch(when);
    expect(first.includes(latest.ipAddress) || first.replace(/\s*[·•]\s*/g, ' · ').includes(dev), `dòng "${first}" phải có IP ${latest.ipAddress} hoặc thiết bị "${dev}"`).toBe(true);
    const ts = entries.map(x => { const m = x.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/)!; return `${m[3]}${m[2]}${m[1]}${m[4]}${m[5]}`; });
    expect(ts, 'mới nhất ở trên (sắp giảm dần theo thời gian)').toEqual([...ts].sort().reverse());
  });
  test(tc('USR-V14'), async ({ page }) => {
    const u = await mkUser();
    let d = await openUserDetail(page, u.userName);
    await page.mouse.click(60, 500); await page.waitForTimeout(800);
    await expect(d, 'bấm ra ngoài: drawer vẫn mở').toBeVisible();
    await d.locator('.ant-drawer-header button[aria-label]').first().click(); await page.waitForTimeout(800);
    await expect(page.locator('.ant-drawer-open'), 'bấm X: drawer đóng').toHaveCount(0);
    d = await openUserDetail(page, u.userName);
    await d.locator('.ant-drawer-footer').getByRole('button', { name: /^\s*(đóng|hu[ỷy])\s*$/i }).click(); await page.waitForTimeout(800);
    await expect(page.locator('.ant-drawer-open'), 'bấm nút Đóng: drawer đóng').toHaveCount(0);
  });
  test(tc('USR-V15'), async ({ page }) => {
    const phone = '09' + String(Date.now()).slice(-8);
    const u = await mkUser({ phoneNumber: phone });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const d = await openUserDetail(page, u.userName);
    const cell = ddOf(d, 'Số điện thoại');
    expect((await cell.innerText()).replace(/\D/g, ''), 'ô SĐT hiển thị đúng số').toBe(phone);
    const btn = cell.locator('button, [role=button], .anticon-copy, [aria-label*="sao chép" i], [aria-label*="copy" i]').first();
    await expect(btn, 'phải có biểu tượng sao chép cạnh SĐT').toBeVisible({ timeout: 3000 });
    await btn.click();
    expect(await toast(page), 'bấm sao chép phải có thông báo đã sao chép').toMatch(/sao chép|đã copy/i);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(phone);
  });
  test(tc('USR-V16'), async ({ page }) => {
    const u = await mkUser();
    await openUsers(page);
    const base = parseFloat((await css(dataRows(page).first().locator('td').nth(3), ['font-size']))['font-size']);
    const d = await openUserDetail(page, u.userName);
    const sizes = await d.locator('dl dt, dl dd').evaluateAll(es => es.map(e => [e.textContent?.trim(), parseFloat(getComputedStyle(e).fontSize)] as [string, number]));
    const small = sizes.filter(([, s]) => s < base);
    expect(small, `chữ trong drawer nhỏ hơn cỡ chữ nội dung bảng (${base}px): ${small.map(([t, s]) => `${t}=${s}px`).join(', ')}`).toEqual([]);
  });
});

// ================= NGƯỜI DÙNG — thêm mới / chỉnh sửa =================
test.describe('Bug GitLab › Người dùng › Thêm mới / Chỉnh sửa', () => {
  test.describe.configure({ timeout: 90_000 });
  const okUser = (u: string) => ({ name: `qc.automation ${u}`, userName: u, email: `${u}@cds.local`, password: cfg.password });
  async function orgOptions(page: Page, d: Locator, kw: string) {
    const sel = d.locator('.ant-form-item').filter({ has: page.locator('#organizationId') }).locator('.ant-select').first();
    await sel.click(); await page.keyboard.type(kw); await page.waitForTimeout(2000);
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    return dd.locator('.ant-select-item-option');
  }
  const badUserName = (id: string, base: string) => test(tc(id), async ({ page }) => {
    const t = tag().toLowerCase().slice(3);
    const u = base.replace('#', t);
    trackUser(u); trackUser(u.toLowerCase());
    const mail = `qca${t}@cds.local`;
    const d = await openAddUser(page);
    await fillUser(d, { ...okUser(`qca${t}`), userName: u, email: mail });
    await btnSave(d).click(); await page.waitForTimeout(1500);
    const err = (await errOf(d, 'userName').allInnerTexts()).join(' ');
    const created = await scan('idm/users', x => x.email === mail);
    if (id === 'USR-C26') {
      // chấp nhận: báo lỗi định dạng HOẶC tự chuyển về chữ thường; không được lưu tên đăng nhập có chữ hoa
      expect(created.filter(x => /[A-Z]/.test(x.userName)).map(x => x.userName), 'không lưu tên đăng nhập có chữ hoa').toEqual([]);
      if (!created.length) expect(err, 'không tạo thì phải báo lỗi tại ô Tên đăng nhập').not.toBe('');
      return;
    }
    expect(created.map(x => x.userName), `không được tạo người dùng "${u}"`).toEqual([]);
    expect(err, 'phải báo lỗi định dạng tại ô Tên đăng nhập').not.toBe('');
  });
  badUserName('USR-C24', 'qca#nguyễnvăn');
  badUserName('USR-C25', 'qca# nguyen van');
  badUserName('USR-C26', 'QCA#NguyenVan');
  test(tc('USR-C23'), async ({ page }) => {
    const t = tag().toLowerCase();
    const long = (t + 'a'.repeat(60)).slice(0, 51);
    trackUser(long); trackUser(long.slice(0, 50));
    const s5xx: string[] = [];
    page.on('response', r => { if (r.status() >= 500 && /\/api\//.test(r.url())) s5xx.push(`${r.request().method()} ${r.url()} → ${r.status()}`); });
    const d = await openAddUser(page);
    await fillUser(d, { ...okUser(t), userName: long, email: `${t}@cds.local` });
    const v = await d.getByPlaceholder(PH.user).inputValue();
    await btnSave(d).click(); await page.waitForTimeout(1500);
    const err = (await errOf(d, 'userName').allInnerTexts()).join(' ');
    expect(v.length <= 50 || /không vượt quá 50|tối đa 50/i.test(err), `ô nhận ${v.length} ký tự, lỗi tại ô: "${err}"`).toBe(true);
    expect(s5xx, 'không được gửi request gây lỗi 5xx').toEqual([]);
    expect((await scan('idm/users', x => x.userName === long)).length, 'không lưu tên đăng nhập 51 ký tự').toBe(0);
  });
  test(tc('USR-C28'), async ({ page }) => {
    const t = tag().toLowerCase(); trackUser(t);
    const d = await openAddUser(page);
    await fillUser(d, { ...okUser(t), phone: '09' + String(Date.now()).slice(-8) });
    await btnSave(d).click();
    expect(await toast(page), 'lưu lần 1 thành công').toMatch(/thành công/i);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: /thêm (mới )?người dùng\s*$/i }).first().click();
    let d2 = dlg(page); await d2.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
    expect((await inputsOf(d2)).filter(Boolean), 'mở lại sau khi lưu: các ô phải trống').toEqual([]);
    expect(await selectValues(d2), 'ô chọn phải về mặc định').toEqual([]);
    await fillUser(d2, { name: 'qc.automation tạm', userName: 'qcatam' });
    await btnCancel(d2).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: /thêm (mới )?người dùng\s*$/i }).first().click();
    d2 = dlg(page); await d2.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
    expect((await inputsOf(d2)).filter(Boolean), 'mở lại sau khi Huỷ: các ô phải trống').toEqual([]);
  });
  async function openEditUser(page: Page, u: string) {
    await openUsers(page);
    await rowAction(page, await findUserRow(page, u), /cập nhật|chỉnh sửa/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    return d;
  }
  test(tc('USR-E10'), async ({ page }) => {
    const u = await mkUser();
    const d = await openEditUser(page, u.userName);
    const inp = d.locator('input#userName, input#code').first();
    await expect(inp).toHaveValue(u.userName);
    expect(await inp.inputValue()).not.toBe(`${u.userName}@cds.local`);
  });
  test(tc('USR-E13'), async ({ page }) => {
    const org = await mkOrg({ lock: true });
    const u = await mkUser({ organizationId: org.id });
    expect((await userByName(u.userName))?.organizationId, 'người dùng thử phải có đơn vị').toBe(org.id);
    const d = await openEditUser(page, u.userName);
    const sel = d.locator('.ant-form-item').filter({ has: page.locator('#organizationId') }).locator('.ant-select').first();
    await expect(sel).toContainText(org.name);
    await sel.hover();
    const clear = sel.locator('.ant-select-clear');
    await expect(clear, 'ô Đơn vị phải có nút xóa giá trị').toBeVisible({ timeout: 3000 });
    await clear.click(); await page.waitForTimeout(400);
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = (await api('GET', `idm/users/${u.id}`)).data;
    expect(rec?.organizationId ?? null, 'API: người dùng không còn đơn vị').toBeNull();
  });
  test(tc('USR-X06'), async ({ page }) => {
    const r = await mkRole(); const u = await mkUser({ roleCode: r.code });
    await openUsers(page);
    await rowAction(page, await findUserRow(page, u.userName), /^\s*xo[áạ]\s*$/i);
    const [res] = await Promise.all([
      page.waitForResponse(x => x.request().method() === 'DELETE' && /idm\/users\//.test(x.url()), { timeout: 15_000 }),
      confirmYes(page),
    ]);
    expect(res.status(), 'API xóa trả 200').toBe(200);
    await goto(page, `roles/${r.id}`); await page.waitForTimeout(1500);
    await expect(dataRows(page).filter({ hasText: u.userName }), 'người dùng đã xóa không còn trong bảng thành viên').toHaveCount(0);
    await goto(page, 'roles'); await page.getByPlaceholder(/tìm theo mã, tên nhóm/i).fill(r.code); await waitList(page);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim());
    const cnt = (await dataRows(page).filter({ hasText: r.code }).first().locator('td').nth(heads.findIndex(h => /số người dùng|thành viên/i.test(h))).innerText()).trim();
    expect(cnt, 'cột số thành viên của nhóm giảm về 0').toBe('0');
  });
});

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

// ================= MA TRẬN PHÂN QUYỀN (chỉ trên nhóm tự tạo) =================
let TOTAL = 0;
