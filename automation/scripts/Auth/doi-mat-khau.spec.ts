// AUTH.3 ĐỔI MẬT KHẨU — script bám testcase CPW-* (testcases/docs/catalog.json). CPW-M*, CPW-S07 là Manual → không có script.
// An toàn cho tài khoản dùng chung: chỉ dùng mật khẩu hiện tại SAI; case có thể làm đổi mật khẩu thật (khi hệ thống lỗi) tự khôi phục.
import { Page } from '@playwright/test';
import { test, expect, tc } from './common';
import { asUser, BAD, NEWPW, tokenOf, API_BASE, myInfo, putPassword, putWithRestore, openProfile, openChange, fillChange, pw, dialog, dialogText, countPut, bodyHas, toastLoc } from './acc';

const LONG129 = 'Aa1!' + 'a'.repeat(125);
let page: Page; let close: () => Promise<void>;

test.describe('Đổi mật khẩu › Mở & hiển thị', () => {
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });

});

test.describe('Đổi mật khẩu › Validate giao diện', () => {
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });
  const submitWith = async (o: string, n: string, c: string) => {
    const cnt = countPut(page); const d = await openChange(page);
    await fillChange(d, o, n, c); await pw.submit(d).click(); await page.waitForTimeout(700);
    return { d, cnt };
  };
  const blocked = async (o: string, n: string, c: string, re: RegExp) => {
    const { d, cnt } = await submitWith(o, n, c);
    await expect(d).toBeVisible(); expect(await dialogText(d)).toMatch(re); expect(cnt.v, 'không gọi API').toBe(0);
    return d;
  };

});

test.describe('Đổi mật khẩu › Mật khẩu hiện tại sai (UI/API)', () => {
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });

  for (const [id, pwd] of [['CPW-A07', 'abc'], ['CPW-A08', '12345678'], ['CPW-A09', 'qc.canbo!A1']] as const) {
    test(tc(id), async () => {
      const r = await putWithRestore({ passwordOld: '', passwordNew: pwd });
      expect(r.status, `server chấp nhận mật khẩu "${pwd}": ${r.message}`).toBe(400);
    });
  }
});

test.describe('Đổi mật khẩu › Bảo mật', () => {
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });

});

test.describe('Đổi mật khẩu › Luồng & lỗi', () => {
  let ctxHandle: any;
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; ctxHandle = s.ctx; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });
  const fillValid = async () => { const d = await openChange(page); await fillChange(d, BAD, NEWPW, NEWPW); return d; };

});
