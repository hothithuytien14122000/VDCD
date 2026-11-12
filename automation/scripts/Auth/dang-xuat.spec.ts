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

});

test.describe('Đăng xuất › Bảo mật & lỗi', () => {
});
