// AUTH.4 ĐĂNG XUẤT — script bám testcase LGO-* (testcases/docs/catalog.json). LGO-S03/S04/S05 là Manual → không có script.
// Đăng xuất của hệ thống chỉ xóa phiên phía trình duyệt (không gọi API) nên dùng session đã lưu không làm hỏng token.
import { Page } from '@playwright/test';
import { test, expect, tc, lgn } from './common';
import { asUser, tokenOf, API_BASE, myInfo, askLogout, openUserMenu, LOGIN_RE, PROFILE, bodyHas } from './acc';

let page: Page; let ctxH: any; let name = '';
const lsKeys = () => page.evaluate(() => Object.keys(localStorage));
const confirmYes = () => page.getByRole('button', { name: 'Có', exact: true }).click();
const confirmDlg = () => page.getByText('Đăng xuất khỏi hệ thống?');
async function start(browser: any, key = 'canbo') {
  const s = await asUser(browser, key); page = s.page; ctxH = s.ctx;
  name = (await myInfo(key)).name;
  await page.goto(PROFILE, { waitUntil: 'networkidle' });
}
test.beforeEach(async ({ browser }) => { await start(browser); });
test.afterEach(async () => { await ctxH.close(); });

test.describe('Đăng xuất › Menu & xác nhận', () => {
  test(tc('LGO-L01'), async () => {
    await openUserMenu(page, name);
    const menu = page.getByRole('menu').last();
    await expect(menu.getByText('Thông tin cá nhân', { exact: true })).toBeVisible();
    await expect(menu.getByText('Đăng xuất', { exact: true })).toBeVisible();
    await expect(page.getByRole('complementary').getByText(name, { exact: true })).toBeVisible();
  });
  test(tc('LGO-L02'), async () => {
    await askLogout(page, name);
    await expect(page.getByText('Phiên làm việc của bạn sẽ kết thúc.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Không', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Có', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/profile/);
    expect((await lsKeys()).length).toBeGreaterThan(1);
  });
  test(tc('LGO-L03'), async () => {
    await askLogout(page, name);
    await page.getByRole('button', { name: 'Không', exact: true }).click();
    await expect(confirmDlg()).toBeHidden();
    await expect(page).toHaveURL(/\/profile/);
    expect((await lsKeys()).length).toBeGreaterThan(1);
    await page.goto('/#/vi/', { waitUntil: 'networkidle' });
    await expect(page).not.toHaveURL(LOGIN_RE);
    await expect(page.getByRole('complementary').getByText(name, { exact: true })).toBeVisible();
  });
  test(tc('LGO-L04'), async () => {
    await askLogout(page, name);
    await page.keyboard.press('Escape');
    await expect(confirmDlg()).toBeHidden();
    await expect(page).toHaveURL(/\/profile/); expect((await lsKeys()).length).toBeGreaterThan(1);
  });
  test(tc('LGO-L05'), async () => {
    const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
    for (let i = 0; i < 3; i++) {
      await askLogout(page, name);
      await expect(page.getByText('Đăng xuất khỏi hệ thống?')).toHaveCount(1);
      await page.getByRole('button', { name: 'Không', exact: true }).click();
      await expect(confirmDlg()).toBeHidden();
    }
    expect(errs).toEqual([]);
  });
});

test.describe('Đăng xuất › Kết thúc phiên', () => {
  // settle 1,5s như người dùng thật: điều hướng ngay lập tức sau khi đăng xuất làm trang trắng (xem note LGO-D03)
  const logout = async () => { await askLogout(page, name); await confirmYes(); await expect(page).toHaveURL(LOGIN_RE); await page.waitForTimeout(1500); };

  test(tc('LGO-D01'), async () => {
    await logout();
    await expect(lgn.user(page)).toBeVisible();
    expect(await lsKeys()).toEqual(['i18nextLng']);
  });
  test(tc('LGO-D02'), async () => {
    await logout();
    await page.goBack().catch(() => {}); await page.waitForTimeout(1200);
    expect(page.url()).not.toMatch(/\/profile|dashboard/);
    await expect(page.getByRole('complementary')).toHaveCount(0);
  });
  test(tc('LGO-D03'), async () => {
    await logout();
    for (const u of ['/#/vi/profile', '/#/vi/dashboard-demo']) {
      await page.goto(u, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
      await expect(page, u).toHaveURL(LOGIN_RE);
    }
  });
  test(tc('LGO-D04'), async () => {
    await logout(); await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(LOGIN_RE); await expect(lgn.user(page)).toBeVisible();
  });
  test(tc('LGO-D05'), async ({ browser }) => {
    await ctxH.close(); await start(browser, 'admin');
    await page.getByRole('complementary').getByText('Người dùng', { exact: true }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(LOGIN_RE);
    await logout(); expect(await lsKeys()).toEqual(['i18nextLng']);
  });
  test(tc('LGO-D06'), async () => {
    await logout();
    await lgn.captchaImg(page).waitFor({ state: 'visible' });
    for (const f of [lgn.user, lgn.pass, lgn.code]) await expect(f(page)).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(name);
  });
  test(tc('LGO-D07'), async ({ browser }) => {
    await ctxH.close();
    for (const k of ['superadmin', 'ldd', 'xemonly']) {
      await start(browser, k);
      try { await logout(); expect(await lsKeys(), k).toEqual(['i18nextLng']); } finally { await ctxH.close(); }
    }
    await start(browser);   // afterEach cần context mở
  });
});

test.describe('Đăng xuất › Bảo mật & lỗi', () => {
  test(tc('LGO-S01'), async () => {
    const token = tokenOf('canbo');
    await askLogout(page, name); await confirmYes(); await expect(page).toHaveURL(LOGIN_RE);
    const r = await fetch(`${API_BASE}/api/v1/idm/users/info`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status, 'token cũ vẫn dùng được sau đăng xuất').toBe(401);
  });
  test(tc('LGO-S02'), async () => {
    await askLogout(page, name); await confirmYes(); await expect(page).toHaveURL(LOGIN_RE);
    expect(await lsKeys()).toEqual(['i18nextLng']);
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
    const ck = (await ctxH.cookies()).filter((c: any) => /token|session|auth|jwt/i.test(c.name));
    expect(ck).toEqual([]);
  });
  test(tc('LGO-G01'), async () => {
    await askLogout(page, name);
    await ctxH.setOffline(true);
    await confirmYes();
    await expect(page).toHaveURL(LOGIN_RE);
    expect(await lsKeys()).toEqual(['i18nextLng']);
    await ctxH.setOffline(false);
  });
  test(tc('LGO-G02'), async () => {
    const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
    const navs: string[] = []; page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
    await askLogout(page, name);
    const yes = page.getByRole('button', { name: 'Có', exact: true });
    for (let i = 0; i < 3; i++) await yes.click({ noWaitAfter: true, timeout: 500 }).catch(() => {});
    await expect(page).toHaveURL(LOGIN_RE);
    await page.waitForTimeout(1000);
    expect(errs).toEqual([]);
    expect(navs.filter(u => LOGIN_RE.test(u)).length, 'không lặp chuyển hướng').toBeLessThanOrEqual(2);
  });
});
