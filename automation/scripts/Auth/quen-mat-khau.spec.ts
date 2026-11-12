// AUTH.2 QUÊN / ĐẶT LẠI MẬT KHẨU — script bám testcase RPW-* (testcases/docs/catalog.json).
// Dùng user qc.resetpw (email = hộp thư Mailosaur) → các test chạy TUẦN TỰ (workers=1); test làm đổi mật khẩu tự khôi phục về PW.
// RPW-M* cần captcha thật → Manual, không có script.
import { Page } from '@playwright/test';
import { findApi } from '../A/common';
import { waitMail, latestMailId } from '../mail';
import {
  test, expect, tc, mailEnabled, PW, RESET_EMAIL, RESET_USER, forgot, verifyOtp, resetPw, authPost, authGet, requestOtp, restorePassword,
  lgn, openForgot, expectNotice, notices, btn, typeOtp, toOtpScreen, toNewPasswordScreen,
} from './common';

test.describe.configure({ timeout: 90_000 });
test.beforeAll(() => { if (!mailEnabled()) throw new Error('Thiếu MAILOSAUR_API_KEY / MAILOSAUR_SERVER_ID trong .env'); });

const NO_ACCOUNT = 'khongco.qc@cds.local';
const emailIn = (p: Page) => p.getByPlaceholder('Nhập email đăng ký');
const newPw = (p: Page) => p.getByPlaceholder('Nhập mật khẩu mới');
const newPw2 = (p: Page) => p.getByPlaceholder('Nhập lại mật khẩu mới');
const submitPw = (p: Page) => btn(p, /cập nhật mật khẩu/i);
/** Đếm request tới API có đường dẫn chứa `part`. */
const counter = (p: Page, part: string) => { const n = { v: 0 }; p.on('request', r => { if (r.url().includes(part)) n.v++; }); return n; };
/** Chạy `body`; luôn khôi phục mật khẩu nếu API đã nhận (200) mật khẩu thử nghiệm. */
async function tryPassword(password: string, confirm = password) {
  const { otp } = await requestOtp();
  const r = await resetPw(otp, password, confirm);
  if (r.status === 200) await restorePassword();
  return r;
}

test.describe('Quên mật khẩu › Bước 1: nhập email', () => {
  test(tc('RPW-L01'), async ({ page }) => {
    await openForgot(page);
    await expect(page.getByText('Quên mật khẩu', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/mã otp gồm 6 chữ số/i)).toBeVisible();
    await expect(emailIn(page)).toBeVisible();
    await expect(btn(page, /lấy mã otp/i)).toBeVisible();
    await expect(btn(page, /quay lại đăng nhập/i)).toBeVisible();
    await expect(page.getByText(/liên hệ quản trị hệ thống/i)).toBeVisible();
  });
  test(tc('RPW-L02'), async ({ page }) => {
    const n = counter(page, '/forgot-password');
    await openForgot(page);
    await btn(page, /lấy mã otp/i).click();
    await expectNotice(page, /vui lòng nhập email đăng ký/i);
    expect(n.v).toBe(0);
  });
  test(tc('RPW-L03'), async ({ page }) => {
    const n = counter(page, '/forgot-password');
    await openForgot(page);
    await emailIn(page).fill('abc');
    await btn(page, /lấy mã otp/i).click();
    await expectNotice(page, /email không đúng định dạng/i);
    expect(n.v).toBe(0);
  });
  test(tc('RPW-L05'), async ({ page }) => {
    await openForgot(page);
    await btn(page, /quay lại đăng nhập/i).click();
    await expect(lgn.user(page)).toBeVisible();
    await expect(lgn.submit(page)).toBeVisible();
  });
  test(tc('RPW-L09'), async () => {
    for (const s of ["' OR 1=1 --", '<script>alert(1)</script>']) {
      const r = await forgot(s);
      expect(r.status, `forgot "${s}"`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    }
  });
  test(tc('RPW-L11'), async () => {
    const st: number[] = [];
    for (let i = 0; i < 3; i++) st.push((await forgot(RESET_EMAIL)).status);
    expect(st.slice(1).some(s => s !== 200), `mã trả về 3 lần liên tiếp: ${st}`).toBe(true);
  });
});

test.describe('Quên mật khẩu › Bước 2: OTP', () => {
  test(tc('RPW-O05'), async ({ page }) => {
    await toOtpScreen(page);
    const n = counter(page, '/verify-forgot-password-token');
    await typeOtp(page, '123');
    await btn(page, /^xác nhận$/i).click();
    await expectNotice(page, /nhập đủ 6 chữ số otp/i);
    expect(n.v).toBe(0);
  });
  test(tc('RPW-O09'), async ({ page }) => {
    await toOtpScreen(page);
    await btn(page, /đổi email khác/i).click();
    await expect(emailIn(page)).toBeVisible();
    await expect(btn(page, /lấy mã otp/i)).toBeVisible();
  });
  test(tc('RPW-O12'), async () => {
    const { otp } = await requestOtp();
    const r = await verifyOtp(otp, 'qc.canbo@cds.local');
    expect(r.status).toBe(400);
    expect((await verifyOtp(otp)).status, 'OTP vẫn đúng với email gốc').toBe(200);
  });
  test(tc('RPW-O13'), async () => {
    const r = await authGet('verify-forgot-password-token', {});
    expect(r.status).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    expect(r.message).toBeTruthy();
  });
});

test.describe('Quên mật khẩu › Bước 3: mật khẩu mới', () => {
  test(tc('RPW-P01'), async ({ page }) => {
    await toNewPasswordScreen(page);
    await expect(newPw(page)).toHaveAttribute('type', 'password');
    await expect(newPw2(page)).toHaveAttribute('type', 'password');
    await expect(submitPw(page)).toBeVisible();
    await expect(btn(page, /quay lại đăng nhập/i)).toBeVisible();
  });
  test(tc('RPW-P03'), async ({ page }) => {
    await toNewPasswordScreen(page);
    const n = counter(page, '/reset-password');
    await newPw(page).fill(PW); await newPw2(page).fill('Test!654321');
    await expectNotice(page, /mật khẩu xác nhận không khớp/i);
    await expect(submitPw(page)).toBeDisabled();
    expect(n.v).toBe(0);
  });
  test(tc('RPW-P05'), async () => {
    const r = await tryPassword('');
    expect(r.status, `mật khẩu rỗng: ${r.message}`).toBe(400);
  });
  test(tc('RPW-P12'), async () => {
    const r = await resetPw('000000', PW);
    expect(r.status).toBe(404); expect(r.message).toMatch(/không tìm thấy người dùng hoặc mã xác thực đã hết hạn/i);
  });
  test(tc('RPW-P13'), async () => {
    const r = await authPost('reset-password', {});
    expect(r.status).toBe(400); expect(r.message).toMatch(/resetPasswordToken/);
  });
});
