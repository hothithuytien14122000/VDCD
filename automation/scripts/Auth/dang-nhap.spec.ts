// AUTH.1 ĐĂNG NHẬP — script bám testcase LGN-* (testcases/docs/catalog.json).
// LGN-M* cần captcha thật → Manual, không có script.
import crypto from 'node:crypto';
import { Page } from '@playwright/test';
import { test, expect, tc, apiStatus, AUTH_API, LOGIN_URL, API_BASE, authGet, authPost, lgn, openLogin, openForgot, expectNotice, notices, PW } from './common';

const TOKEN_KEY = 'b316682e-54f3-4ae1-89e3-bbc505e19e54';   // khóa localStorage lưu token (xem login.mjs)
const imgHash = async (p: Page) => crypto.createHash('md5').update((await lgn.captchaImg(p).getAttribute('src')) ?? '').digest('hex');
/** Đếm request jwt/login phát sinh từ trang. */
const countLogins = (p: Page) => { const n = { v: 0 }; p.on('request', r => { if (r.url().includes('/jwt/login')) n.v++; }); return n; };
async function fill(p: Page, f: { user?: string; pass?: string; code?: string }) {
  if (f.user !== undefined) await lgn.user(p).fill(f.user);
  if (f.pass !== undefined) await lgn.pass(p).fill(f.pass);
  if (f.code !== undefined) { await lgn.code(p).fill(''); await lgn.code(p).fill(f.code); }   // xóa trước: điền lại đúng giá trị cũ không phát sự kiện change (xem LGN-C10)
}
const REQ = { user: /vui lòng nhập tên đăng nhập/i, pass: /vui lòng nhập mật khẩu/i, code: /vui lòng nhập mã xác nhận/i };
const newCaptcha = async () => (await authGet('captcha', { width: '300', height: '100' })).data;
const login = (b: any) => authPost('jwt/login', { rememberMe: true, ...b });

test.describe('Đăng nhập › Form & validate', () => {
  test.beforeEach(async ({ page }) => { await openLogin(page); });

  test(tc('LGN-L01'), async ({ page }) => {
    await expect(lgn.user(page)).toBeVisible(); await expect(lgn.pass(page)).toBeVisible(); await expect(lgn.code(page)).toBeVisible();
    await expect(lgn.captchaImg(page)).toBeVisible(); await expect(lgn.refresh(page)).toBeVisible();
    await expect(page.locator('#login_remember')).toHaveCount(1);
    await expect(page.getByText(/ghi nhớ đăng nhập/i).first()).toBeVisible();
    await expect(lgn.submit(page)).toBeVisible();
    await expect(page.getByText(/quên mật khẩu\?/i).first()).toBeVisible();
  });
  test(tc('LGN-L02'), async ({ page }) => {
    await lgn.pass(page).fill('Abc!12345');
    await expect(lgn.pass(page)).toHaveAttribute('type', 'password');
    await page.locator('.ant-input-password-icon').click();
    await expect(lgn.pass(page)).toHaveAttribute('type', 'text');
    await page.locator('.ant-input-password-icon').click();
    await expect(lgn.pass(page)).toHaveAttribute('type', 'password');
  });
  test(tc('LGN-L03'), async ({ page }) => {
    const n = countLogins(page);
    await lgn.submit(page).click();
    for (const re of Object.values(REQ)) await expectNotice(page, re);
    expect(n.v, 'không được gọi API khi form trống').toBe(0);
  });
  for (const [id, miss, f] of [
    ['LGN-L04', 'user', { pass: PW, code: 'abcde' }],
    ['LGN-L05', 'pass', { user: 'qc.canbo', code: 'abcde' }],
    ['LGN-L06', 'code', { user: 'qc.canbo', pass: PW }],
  ] as const) {
    test(tc(id), async ({ page }) => {
      const n = countLogins(page);
      await fill(page, f);
      await lgn.submit(page).click();
      await expectNotice(page, REQ[miss]);
      const txt = (await notices(page).allInnerTexts()).join(' | ');
      for (const [k, re] of Object.entries(REQ)) if (k !== miss) expect(txt, `không được báo lỗi ô "${k}"`).not.toMatch(re);
      expect(n.v).toBe(0);
    });
  }
  test(tc('LGN-L07'), async ({ page }) => {
    await fill(page, { user: 'qc.canbo', pass: PW, code: 'zzzzz' });
    const req = page.waitForRequest(r => r.url().includes('/jwt/login'), { timeout: 8000 });
    await lgn.code(page).press('Enter');
    await req;
  });
  test(tc('LGN-L08'), async ({ page }) => {
    await page.getByText(/quên mật khẩu\?/i).first().click();
    await expect(page.getByText('Quên mật khẩu', { exact: true }).first()).toBeVisible();
    await expect(page.getByPlaceholder('Nhập email đăng ký')).toBeVisible();
    await expect(page.getByRole('button', { name: /lấy mã otp/i })).toBeVisible();
  });
});

test.describe('Đăng nhập › Captcha', () => {
  test(tc('LGN-C01'), async ({ page }) => {
    await openLogin(page);
    await fill(page, { user: 'qc.canbo', pass: PW, code: 'zzzzz' });
    await lgn.submit(page).click();
    await expectNotice(page, /mã captcha không hợp lệ hoặc đã hết hạn/i);
    await expect(page).toHaveURL(/auth\/login/);
    expect(await page.evaluate(k => localStorage.getItem(k), TOKEN_KEY)).toBeNull();
  });
  test(tc('LGN-C02'), async ({ page }) => {
    await openLogin(page);
    const before = await imgHash(page);
    await lgn.code(page).fill('abc');
    await lgn.refresh(page).click();
    await expect.poll(() => imgHash(page), { timeout: 8000 }).not.toBe(before);
    await expect(lgn.code(page)).toHaveValue('');
  });
  test(tc('LGN-C03'), async ({ page }) => {
    await openLogin(page);
    const before = await imgHash(page);
    await fill(page, { user: 'qc.canbo', pass: PW, code: 'zzzzz' });
    await lgn.submit(page).click();
    await expectNotice(page, /mã captcha không hợp lệ/i);
    await page.waitForTimeout(1500);
    expect(await imgHash(page), 'ảnh captcha phải được làm mới sau khi đăng nhập thất bại').not.toBe(before);
  });
  test(tc('LGN-C10'), async ({ page }) => {
    await openLogin(page);
    const codes: string[] = [];
    page.on('request', r => { if (r.url().includes('/jwt/login')) codes.push(JSON.parse(r.postData() ?? '{}').captchaCode); });
    await fill(page, { user: 'qc.canbo', pass: PW, code: 'zzzzz' });
    await lgn.submit(page).click();
    await expectNotice(page, /mã captcha không hợp lệ/i);
    await lgn.code(page).click(); await page.keyboard.press('Control+A'); await page.keyboard.type('yyyyy');
    await page.waitForTimeout(3500);           // chờ toast cũ biến mất để không đọc nhầm
    await lgn.submit(page).click();
    await page.waitForTimeout(1500);
    expect(codes, 'request đã gửi (mã captcha)').toEqual(['zzzzz', 'yyyyy']);
  });
  test(tc('LGN-C04'), async () => {
    const a = await authGet('captcha', { width: '300', height: '100' }), b = await authGet('captcha', { width: '300', height: '100' });
    expect(a.status).toBe(200);
    expect(a.data.captchaId).toBeTruthy(); expect(b.data.captchaId).toBeTruthy();
    expect(a.data.captchaId).not.toBe(b.data.captchaId);
    expect(a.data.captchaImage).toMatch(/^data:image\/png;base64,/);
  });
  test(tc('LGN-C05'), async () => {
    const d = (await authGet('captcha', { width: '300', height: '100' })).data;
    expect(Object.keys(d).sort(), 'phản hồi captcha chỉ nên có captchaId và captchaImage').toEqual(['captchaId', 'captchaImage']);
  });
  test(tc('LGN-C06'), async () => {
    const cap = await newCaptcha();
    const r = await login({ email: 'qc.canbo@cds.local', password: PW, captchaId: cap.captchaId, captchaCode: 'zzzzz' });
    expect(r.status).toBe(400); expect(r.message).toMatch(/captcha không hợp lệ/i);
    expect(r.data?.tokenString).toBeUndefined();
  });
  test(tc('LGN-C07'), async () => {
    const r = await login({ email: 'qc.canbo@cds.local', password: PW });
    expect(r.status).toBe(400); expect(r.message).toMatch(/captcha không hợp lệ/i);
    expect(r.data?.tokenString).toBeUndefined();
  });
  test(tc('LGN-C08'), async () => {
    const r = await login({ email: 'qc.canbo@cds.local', password: PW, captchaId: 'khong-ton-tai', captchaCode: '12345' });
    expect(r.status).toBe(400); expect(r.message).toMatch(/captcha không hợp lệ/i);
    expect(r.data?.tokenString).toBeUndefined();
  });
  test(tc('LGN-C09'), async ({ page }) => {
    const bad = ["' OR 1=1 --", '<script>alert(1)</script>'];
    const cap = await newCaptcha();
    for (const s of bad) {
      const r = await login({ email: s, password: s, captchaId: cap.captchaId, captchaCode: 'zzzzz' });
      expect(r.status, `API với "${s}"`).toBeLessThan(500); expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.data?.tokenString).toBeUndefined();
    }
    let dialog = false; page.on('dialog', d => { dialog = true; d.dismiss(); });
    for (const s of bad) {
      await openLogin(page);
      await fill(page, { user: s, pass: s, code: 'zzzzz' });
      await lgn.submit(page).click();
      await expectNotice(page, /captcha|không hợp lệ|lỗi/i);
      await expect(page).toHaveURL(/auth\/login/);
    }
    expect(dialog, 'script trong tên đăng nhập không được thực thi').toBe(false);
  });
});

test.describe('Đăng nhập › Phiên', () => {
  test(tc('LGN-S01'), async ({ page }) => {
    await page.goto(`${API_BASE}/#/vi/users`, { waitUntil: 'networkidle' });
    await expect.poll(() => page.url(), { timeout: 8000 }).toMatch(/auth\/login/);
    await expect(lgn.user(page)).toBeVisible();
  });
  test(tc('LGN-S02'), async ({ page }) => {
    await openLogin(page);
    await page.evaluate(k => localStorage.setItem(k, 'a.b.c'), TOKEN_KEY);
    let navs = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navs++; });
    await page.goto(`${API_BASE}/#/vi/users`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    expect(navs, 'số lần chuyển trang trong 3s (vòng lặp chuyển hướng?)').toBeLessThanOrEqual(5);
    expect(page.url(), 'token giả phải bị đẩy về trang đăng nhập').toMatch(/auth\/login/);
  });
  test(tc('LGN-S03'), async () => {
    expect(await apiStatus({ resource: 'idm/users', rawToken: 'a.b.c' })).toBe(401);
  });
});
