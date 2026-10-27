// A.II.1 NGƯỜI DÙNG — script bám testcase USR-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, WRITE, PAGES, dataRows, openList, searchFor, waitList, totalOf, rowTexts, cellText, findRow,
  pickOption, dlg, btnCancel, toast, rowAction, confirmYes, confirmNo, api, listApi, findApi, Made, uname, userBody, FILTERS,
  ensureOrg, ensureRole, ensureUser, registerListSuite, registerAuthTest, registerMatrixTest, registerPerfTest, pickByLabel, setCheckbox, goto, rowMenuItems, btnSave,
} from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';
import accountsCfg from '../../accounts.mjs';

const cfg = PAGES.USR;
const made = new Made();
test.afterEach(async () => { await made.clean(); });

registerListSuite('USR');

// ---------- Tìm kiếm / bộ lọc bổ sung ----------
test.describe('Người dùng › Bộ lọc', () => {
  test(tc('USR-L12'), async ({ page }) => {
    await openList(page, cfg);
    const email = await cellText(page, 0, 4);
    await searchFor(page, cfg, email);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase()).toContain(email.toLowerCase());
  });
  test(tc('USR-L13'), async ({ page }) => {
    await openList(page, cfg);
    const all = await totalOf(page);
    const label = await pickOption(page, page.locator(FILTERS).nth(0));
    await waitList(page);
    const role = (await listApi('idm/roles', label.slice(0, 15))).find((r: any) => r.name === label);
    expect(role, `không tìm thấy nhóm "${label}" qua API`).toBeTruthy();
    const users = await listApi('idm/users', '');
    const expected = users.filter((u: any) => u.roleCode === role.code).length;
    const got = await totalOf(page);
    expect(got).toBeLessThanOrEqual(all);
    expect(got, `số người dùng thuộc nhóm "${label}"`).toBe(expected);
  });
  test(tc('USR-L14'), async ({ page }) => {
    test.skip(!WRITE, 'Cần RUN_WRITE=1 (tự tạo user khóa)');
    // tự tạo 1 user rồi khóa qua UI để không phụ thuộc dữ liệu có sẵn
    const x = await ensureUser(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, x.userName), /^\s*kho[áạ]\s*$/i);
    if (await page.getByRole('button', { name: /^\s*có\s*$/i }).filter({ visible: true }).count()) await confirmYes(page);
    await waitList(page);
    await searchFor(page, cfg, '');
    for (const [label, re] of [['Đã khóa', /đã khóa/i], ['Đang hoạt động', /đang hoạt động/i]] as const) {
      await pickOption(page, page.locator(FILTERS).nth(1), label);
      await waitList(page);
      const texts = await rowTexts(page);
      expect(texts.length, `phải có người dùng "${label}"`).toBeGreaterThan(0);
      for (const t of texts) expect(t).toMatch(re);
    }
  });
  test(tc('USR-L15'), async ({ page }) => {
    await openList(page, cfg);
    await searchFor(page, cfg, 'qc');
    await pickOption(page, page.locator(FILTERS).nth(1), 'Đang hoạt động');
    await waitList(page);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) { expect(t.toLowerCase()).toContain('qc'); expect(t).toMatch(/đang hoạt động/i); }
  });
});

// ---------- Xem chi tiết ----------
test.describe('Người dùng › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openDetail(page: Page, u: string) {
    await openList(page, cfg);
    const row = await findRow(page, cfg, u);
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    const d = dlg(page); await d.waitFor({ state: 'visible' });
    return d;
  }
  test(tc('USR-V01'), async ({ page }) => {
    const org = await ensureOrg(made); const role = await ensureRole(made);
    const u = await ensureUser(made, { organizationId: org.id, roleCode: role.code });
    const d = await openDetail(page, u.userName);
    const txt = (await d.innerText()).replace(/\s+/g, ' ');
    for (const s of [u.userName, `qc.automation ${u.userName}`, `${u.userName}@cds.local`, org.name, role.name, 'Đang hoạt động'])
      expect(txt, `chi tiết thiếu "${s}"`).toContain(s);
    expect(txt).toMatch(/ngày tạo/i);
  });
  test(tc('USR-V02'), async ({ page }) => {
    const u = await ensureUser(made);
    const d = await openDetail(page, u.userName);
    await d.getByRole('button', { name: /^đóng$/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
  test(tc('USR-V03'), async ({ page }) => {
    const u = await ensureUser(made);
    const d = await openDetail(page, u.userName);
    await d.locator('button', { hasText: /^\s*Cập nhật\s*$/ }).last().click();
    await page.waitForTimeout(800);
    const e = dlg(page);
    await expect(e.getByPlaceholder('Ví dụ: Nguyễn Thị Lan')).toHaveValue(`qc.automation ${u.userName}`);
    await expect(e.getByPlaceholder('ten.dv@cds.gov.vn')).toHaveValue(`${u.userName}@cds.local`);
  });
});

// ---------- Thêm mới ----------
type UF = { name?: string; phone?: string; email?: string; userName?: string; password?: string };
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới người dùng/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' });
  return d;
}
async function fillForm(d: Locator, f: UF) {
  if (f.name !== undefined) await d.getByPlaceholder('Ví dụ: Nguyễn Thị Lan').fill(f.name);
  if (f.phone !== undefined) await d.getByPlaceholder('0912345678').fill(f.phone);
  if (f.email !== undefined) await d.getByPlaceholder('ten.dv@cds.gov.vn').fill(f.email);
  if (f.userName !== undefined) await d.getByPlaceholder('voi.lan.nt').fill(f.userName);
  if (f.password !== undefined) await d.getByPlaceholder('Tối thiểu 6 ký tự').fill(f.password);
}
const submitAdd = (d: Locator) => d.getByRole('button', { name: /thêm mới người dùng/i }).last().click();
const okForm = (u: string): UF => ({ name: `qc.automation ${u}`, email: `${u}@cds.local`, userName: u, password: accountsCfg.password });

test.describe('Người dùng › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();

  test(tc('USR-C01'), async ({ page }) => {
    const u = made.add('idm/users', uname(), 'userName');
    const d = await openAdd(page);
    await fillForm(d, { ...okForm(u), phone: '0912345678' });
    await setCheckbox(d, /gửi thông tin đăng nhập qua email/i, false);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('idm/users', u, 'userName');
    expect(rec).toBeTruthy();
    expect(rec.name).toBe(`qc.automation ${u}`); expect(rec.email).toBe(`${u}@cds.local`); expect(rec.phoneNumber).toBe('0912345678');
    const row = await findRow(page, cfg, u);
    await expect(row.first()).toContainText(/đang hoạt động/i);
  });
  test(tc('USR-C02'), async ({ page }) => {
    const u = made.add('idm/users', uname(), 'userName');
    const d = await openAdd(page);
    await fillForm(d, okForm(u));
    await setCheckbox(d, /gửi thông tin đăng nhập qua email/i, false);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect(await findApi('idm/users', u, 'userName')).toBeTruthy();
  });
  test(tc('USR-C03'), async ({ page }) => {
    const org = await ensureOrg(made, {}, true); const role = await ensureRole(made);   // đơn vị phải ở trạng thái Đã khóa (đưa vào sử dụng) mới chọn được
    const u = made.add('idm/users', uname(), 'userName');
    const d = await openAdd(page);
    await fillForm(d, okForm(u));
    await pickByLabel(page, d, /đơn vị/i, org.name);
    await pickByLabel(page, d, /nhóm người dùng/i, role.name);
    await setCheckbox(d, /gửi thông tin đăng nhập qua email/i, false);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('idm/users', u, 'userName');
    expect(rec?.organizationId).toBe(org.id);
    expect(rec?.roleCode).toBe(role.code);
  });
  test(tc('USR-C04'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d);
    await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(4);
    await expect(d).toBeVisible();
  });
  const invalid = (id: string, f: Partial<UF>, msg: RegExp) => test(tc(id), async ({ page }) => {
    const u = made.add('idm/users', uname(), 'userName');
    const d = await openAdd(page);
    await fillForm(d, { ...okForm(u), ...f });
    await setCheckbox(d, /gửi thông tin đăng nhập qua email/i, false);
    await submitAdd(d);
    await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').allInnerTexts()).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
    expect(await findApi('idm/users', u, 'userName'), 'không được tạo bản ghi').toBeNull();
  });
  invalid('USR-C05', { email: 'abc' }, /email không đúng định dạng/i);
  invalid('USR-C06', { phone: 'abc' }, /số điện thoại không đúng định dạng/i);
  invalid('USR-C07', { password: '123' }, /mật khẩu chưa đáp ứng/i);

  test(tc('USR-C08'), async ({ page }) => {
    const a = await ensureUser(made);
    const d = await openAdd(page);
    await fillForm(d, { ...okForm(a.userName), email: `${uname()}@cds.local` });
    await setCheckbox(d, /gửi thông tin đăng nhập qua email/i, false);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/đã (được )?(sử dụng|tồn tại)/i);
    expect((await listApi('idm/users', a.userName)).filter((x: any) => x.userName === a.userName)).toHaveLength(1);
  });
  test(tc('USR-C09'), async ({ page }) => {
    const a = await ensureUser(made);
    const u2 = made.add('idm/users', uname(), 'userName');
    const d = await openAdd(page);
    await fillForm(d, { ...okForm(u2), email: `${a.userName}@cds.local` });
    await setCheckbox(d, /gửi thông tin đăng nhập qua email/i, false);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/email đã được sử dụng|đã tồn tại/i);
    expect(await findApi('idm/users', u2, 'userName')).toBeNull();
  });
  test(tc('USR-C10'), async ({ page }) => {
    const d = await openAdd(page);
    for (const re of [/bắt buộc đổi mật khẩu/i, /gửi thông tin đăng nhập qua email/i])
      await expect(d.locator('label', { hasText: re }).locator('input[type=checkbox]').first()).toBeChecked();
  });
  async function captureCreate(page: Page, d: Locator, u: string) {
    const req = page.waitForRequest(r => r.method() === 'POST' && /\/idm\/users$/.test(r.url().split('?')[0]));
    await submitAdd(d);
    return JSON.parse((await req).postData() || '{}');
  }
  test(tc('USR-C11'), async ({ page }) => {
    const u = made.add('idm/users', uname(), 'userName');
    const d = await openAdd(page);
    await fillForm(d, okForm(u));
    await setCheckbox(d, /bắt buộc đổi mật khẩu/i, false);
    await setCheckbox(d, /gửi thông tin đăng nhập qua email/i, false);
    const body = await captureCreate(page, d, u);
    expect(body.isRequireChangePassword, 'request phải gửi false').toBe(false);
    await toast(page);
    const rec = await findApi('idm/users', u, 'userName');
    expect(rec?.isRequireChangePassword, 'bản ghi lưu không bắt buộc đổi mật khẩu').toBe(false);
  });
  test(tc('USR-C12'), async ({ page }) => {
    const u = made.add('idm/users', uname(), 'userName');
    const d = await openAdd(page);
    await fillForm(d, okForm(u));
    await setCheckbox(d, /gửi thông tin đăng nhập qua email/i, false);
    const body = await captureCreate(page, d, u);
    expect(body.isRequestMailInfo).toBe(false);
  });
  test(tc('USR-C13'), async ({ page }) => {
    const u = made.add('idm/users', uname(), 'userName');
    const d = await openAdd(page);
    await fillForm(d, okForm(u));
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi('idm/users', u, 'userName')).toBeNull();
  });
  test(tc('USR-C14'), async ({ page }) => {
    const d = await openAdd(page);
    const inp = d.getByPlaceholder('Ví dụ: Nguyễn Thị Lan');
    await inp.fill('a'.repeat(300));
    expect((await inp.inputValue()).length).toBeLessThanOrEqual(255);
  });
});

// ---------- API: validate phía server ----------
test.describe('Người dùng › Validate phía server (API)', () => {
  needWrite();
  test(tc('USR-C15'), async () => {
    const u = made.add('idm/users', uname(), 'userName');
    const r = await api('POST', 'idm/users', userBody(u, { email: 'abc' }));
    expect(r.status, `server nhận email "abc" (HTTP ${r.status})`).toBe(400);
  });
  test(tc('USR-C16'), async () => {
    const u = made.add('idm/users', uname(), 'userName');
    const r = await api('POST', 'idm/users', userBody(u, { password: 'Ab1!x' }));
    expect(r.status, `server nhận mật khẩu 5 ký tự (HTTP ${r.status})`).toBe(400);
  });
  test(tc('USR-C17'), async () => {
    const u = made.add('idm/users', uname(), 'userName');
    const r = await api('POST', 'idm/users', userBody(u, { name: '' }));
    expect(r.status, `HTTP ${r.status}`).toBe(400);
    expect(r.message).not.toMatch(/stacktrace|at \w+\.|Index was outside/i);
  });
});

// ---------- Chỉnh sửa ----------
test.describe('Người dùng › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openEdit(page: Page, u: string) {
    await openList(page, cfg);
    const row = await findRow(page, cfg, u);
    await rowAction(page, row, /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    return d;
  }
  const save = (d: Locator) => btnSave(d).click();
  test(tc('USR-E01'), async ({ page }) => {
    const x = await ensureUser(made); const nn = `qc.automation đã sửa ${x.userName}`;
    const d = await openEdit(page, x.userName);
    await d.getByPlaceholder('Ví dụ: Nguyễn Thị Lan').fill(nn);
    await save(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const row = await findRow(page, cfg, x.userName);
    await expect(row.first()).toContainText(nn);
  });
  test(tc('USR-E02'), async ({ page }) => {
    const x = await ensureUser(made);
    const d = await openEdit(page, x.userName);
    await d.getByPlaceholder('0912345678').fill('0987654321');
    await save(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('idm/users', x.userName, 'userName'))?.phoneNumber).toBe('0987654321');
  });
  test(tc('USR-E03'), async ({ page }) => {
    const A = await ensureRole(made), B = await ensureRole(made);
    const x = await ensureUser(made, { roleCode: A.code });
    const d = await openEdit(page, x.userName);
    await pickByLabel(page, d, /nhóm người dùng/i, B.name);
    await save(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('idm/users', x.userName, 'userName');
    expect(rec?.roleCode).toBe(B.code);
    expect(rec?.roleListCode ?? [], 'không còn thuộc nhóm cũ').not.toContain(A.code);
  });
  test(tc('USR-E04'), async ({ page }) => {
    const a = await ensureUser(made), b = await ensureUser(made);
    const d = await openEdit(page, b.userName);
    await d.getByPlaceholder('ten.dv@cds.gov.vn').fill(`${a.userName}@cds.local`);
    await save(d);
    expect(await toast(page)).toMatch(/email đã được sử dụng|đã tồn tại/i);
    expect((await findApi('idm/users', b.userName, 'userName'))?.email).toBe(`${b.userName}@cds.local`);
  });
  test(tc('USR-E05'), async ({ page }) => {
    const x = await ensureUser(made);
    const d = await openEdit(page, x.userName);
    await d.getByPlaceholder('ten.dv@cds.gov.vn').fill('abc');
    await save(d);
    await page.waitForTimeout(700);
    expect((await d.locator('.ant-form-item-explain-error').allInnerTexts()).join()).toMatch(/email không đúng định dạng/i);
    expect((await findApi('idm/users', x.userName, 'userName'))?.email).toBe(`${x.userName}@cds.local`);
  });
  test(tc('USR-E06'), async ({ page }) => {
    const x = await ensureUser(made);
    const d = await openEdit(page, x.userName);
    await d.getByPlaceholder('Ví dụ: Nguyễn Thị Lan').fill('');
    await save(d);
    await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('idm/users', x.userName, 'userName'))?.name).toBe(`qc.automation ${x.userName}`);
  });
  test(tc('USR-E07'), async ({ page }) => {
    const x = await ensureUser(made);
    const d = await openEdit(page, x.userName);
    await d.getByPlaceholder('Ví dụ: Nguyễn Thị Lan').fill('qc.automation KHÔNG LƯU');
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('idm/users', x.userName, 'userName'))?.name).toBe(`qc.automation ${x.userName}`);
  });
  test(tc('USR-E09'), async ({ page }) => {
    const x = await ensureUser(made);
    const d = await openEdit(page, x.userName);
    await expect(d.getByPlaceholder('voi.lan.nt')).toBeDisabled();
  });
});

// ---------- Khóa / Xóa (chức năng bổ sung trên UI) ----------
test.describe('Người dùng › Khóa / Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function doLock(page: Page, u: string, re: RegExp) {
    const row = await findRow(page, cfg, u);
    await rowAction(page, row, re);
    if (await page.getByRole('button', { name: /^\s*có\s*$/i }).filter({ visible: true }).count()) await confirmYes(page);
    await waitList(page);
  }
  test(tc('USR-X01'), async ({ page }) => {
    const x = await ensureUser(made);
    await openList(page, cfg);
    await doLock(page, x.userName, /^\s*kho[áạ]\s*$/i);
    await expect((await findRow(page, cfg, x.userName)).first()).toContainText(/đã khóa/i);
  });
  test(tc('USR-X02'), async ({ page }) => {
    const x = await ensureUser(made);
    await openList(page, cfg);
    await doLock(page, x.userName, /^\s*kho[áạ]\s*$/i);
    await doLock(page, x.userName, /mở kho[áạ]/i);
    await expect((await findRow(page, cfg, x.userName)).first()).toContainText(/đang hoạt động/i);
  });
  test(tc('USR-X03'), async ({ page }) => {
    const x = await ensureUser(made);
    await openList(page, cfg);
    await doLock(page, x.userName, /^\s*kho[áạ]\s*$/i);
    await pickOption(page, page.locator(FILTERS).nth(1), 'Đã khóa');
    await searchFor(page, cfg, x.userName);
    expect(await dataRows(page).count(), 'hiện khi lọc Đã khóa').toBe(1);
    await pickOption(page, page.locator(FILTERS).nth(1), 'Đang hoạt động');
    await searchFor(page, cfg, x.userName);
    expect(await dataRows(page).count(), 'ẩn khi lọc Đang hoạt động').toBe(0);
  });
  test(tc('USR-X04'), async ({ page }) => {
    const x = await ensureUser(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, x.userName), /xo[áạ]/i);
    await confirmYes(page);
    await searchFor(page, cfg, x.userName);
    expect(await dataRows(page).count()).toBe(0);
    expect(await findApi('idm/users', x.userName, 'userName')).toBeNull();
  });
  test(tc('USR-X05'), async ({ page }) => {
    const x = await ensureUser(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, x.userName), /xo[áạ]/i);
    await confirmNo(page);
    await searchFor(page, cfg, x.userName);
    expect(await dataRows(page).count()).toBe(1);
  });
});

// ---------- Bảo mật & hiệu năng ----------
test.describe('Người dùng › Bảo mật / Hiệu năng', () => {
  registerAuthTest('USR-S01', cfg);
  test.describe('chưa đăng nhập', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test(tc('USR-S02'), async ({ page }) => {
      await page.goto('/#/vi/users', { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(await page.locator('input[type=password]').count(), 'phải hiện màn đăng nhập').toBeGreaterThan(0);
      expect(await dataRows(page).count(), 'không lộ dữ liệu').toBe(0);
    });
  });
  registerMatrixTest('USR-S03', cfg);
  registerPerfTest('USR-P01', cfg);
});

registerEdgeTests({
  P: 'USR', cfg, made, openAdd, submit: submitAdd,
  fillBlank: async d => { await fillForm(d, { name: '   ', userName: '   ', email: '   ', password: '   ' }); },
  fillValid: async (_p, d, code) => { await fillForm(d, okForm(code.toLowerCase())); },
  makeNamed: async name => { const u = made.add('idm/users', uname(), 'userName'); const r = await api('POST', 'idm/users', { ...userBody(u), name }); if (r.status !== 200) throw new Error(r.message); return u; },
});

registerNotFoundTest('USR-V04', cfg, false);
test.describe('Người dùng › Bổ sung', () => {
  needWrite();
  test(tc('USR-C19'), async () => {
    const x = await ensureUser(made);
    const up = x.userName.toUpperCase();
    const r = await api('POST', 'idm/users', { ...userBody(up), email: `${up.toLowerCase()}.b@cds.local` });
    if (r.status === 200) made.add('idm/users', up, 'userName');
    expect(r.status, `tên đăng nhập chỉ khác hoa/thường phải bị coi là trùng (HTTP ${r.status}: ${r.message})`).toBeGreaterThanOrEqual(400);
  });
});
