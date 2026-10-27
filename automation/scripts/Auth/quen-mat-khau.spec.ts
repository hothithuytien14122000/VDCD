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
  test(tc('RPW-L04'), async ({ page }) => {
    await openForgot(page);
    await emailIn(page).fill(NO_ACCOUNT);
    await btn(page, /lấy mã otp/i).click();
    await expectNotice(page, /chưa được đăng k[ií]/i);
    await expect(emailIn(page)).toBeVisible();
    await expect(btn(page, /^xác nhận$/i)).toHaveCount(0);
  });
  test(tc('RPW-L05'), async ({ page }) => {
    await openForgot(page);
    await btn(page, /quay lại đăng nhập/i).click();
    await expect(lgn.user(page)).toBeVisible();
    await expect(lgn.submit(page)).toBeVisible();
  });
  test(tc('RPW-L06'), async () => {
    const r = await forgot(NO_ACCOUNT);
    expect(r.status).toBe(404);
    expect(r.message, 'giữa "Email" và địa chỉ phải có khoảng trắng').toMatch(/^Email\s+khongco\.qc@cds\.local\s+chưa/);
  });
  test(tc('RPW-L07'), async () => {
    const r = await forgot('qc.locked@cds.local');
    expect(r.status).toBe(400);
    expect(r.message).toMatch(/tài khoản bị khóa/i);
  });
  test(tc('RPW-L08'), async () => {
    const r = await forgot(RESET_EMAIL.toUpperCase());
    expect(r.status, `forgot với email HOA: ${r.message}`).toBe(200);
  });
  test(tc('RPW-L09'), async () => {
    for (const s of ["' OR 1=1 --", '<script>alert(1)</script>']) {
      const r = await forgot(s);
      expect(r.status, `forgot "${s}"`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    }
  });
  test(tc('RPW-L10'), async () => {
    const known = await forgot(RESET_EMAIL), unknown = await forgot(NO_ACCOUNT);
    expect({ status: unknown.status }, `có tài khoản: ${known.status} "${known.message}"; không có: ${unknown.status} "${unknown.message}"`).toEqual({ status: known.status });
  });
  test(tc('RPW-L11'), async () => {
    const st: number[] = [];
    for (let i = 0; i < 3; i++) st.push((await forgot(RESET_EMAIL)).status);
    expect(st.slice(1).some(s => s !== 200), `mã trả về 3 lần liên tiếp: ${st}`).toBe(true);
  });
});

test.describe('Quên mật khẩu › Bước 2: OTP', () => {
  test(tc('RPW-O01'), async ({ page }) => {
    await toOtpScreen(page);
    await expect(page.getByText('Nhập mã OTP', { exact: true }).first()).toBeVisible();
    await expect(page.locator('input')).toHaveCount(6);
    await expect(page.getByText(/q\*+@/)).toBeVisible();
    await expect(page.locator('body')).toContainText(/mã có hiệu lực trong\s*\d\d:\d\d/i);
    await expect(btn(page, /^xác nhận$/i)).toBeVisible();
    await expect(btn(page, /đổi email khác/i)).toBeVisible();
  });
  test(tc('RPW-O02'), async () => {
    const { otp, mail } = await requestOtp();
    expect(otp).toMatch(/^\d{6}$/);
    expect(mail.subject).toBe(`[${otp}] Mã xác thực OTP khôi phục mật khẩu - Hệ thống CDS`);
    const body = mail.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(body).toContain(otp);
    expect(body).toContain('QC Reset mật khẩu');
    expect(body).toMatch(/hiệu lực trong 1 phút/i);
    expect(body).toMatch(/không chia sẻ/i);
  });
  test(tc('RPW-O03'), async ({ page }) => {
    await toOtpScreen(page);
    await expect(page.getByText(/gửi lại sau \d\d:\d\d/i)).toBeVisible();
    await expect(page.getByText(/gửi lại ngay/i)).toHaveCount(0);
  });
  test(tc('RPW-O04'), async ({ page }) => {
    test.setTimeout(150_000);
    const { otp: old } = await toOtpScreen(page);
    const resend = page.getByText(/gửi lại ngay/i);
    await expect(resend).toBeVisible({ timeout: 75_000 });
    const prev = await latestMailId(RESET_EMAIL);
    await resend.click();
    const mail = await waitMail(RESET_EMAIL, prev);
    const fresh = mail.subject.match(/\d{6}/)![0];
    expect(fresh).not.toBe(old);
    await expect(page.getByText(/gửi lại sau \d\d:\d\d/i)).toBeVisible();
  });
  test(tc('RPW-O05'), async ({ page }) => {
    await toOtpScreen(page);
    const n = counter(page, '/verify-forgot-password-token');
    await typeOtp(page, '123');
    await btn(page, /^xác nhận$/i).click();
    await expectNotice(page, /nhập đủ 6 chữ số otp/i);
    expect(n.v).toBe(0);
  });
  test(tc('RPW-O06'), async ({ page }) => {
    await toOtpScreen(page);
    await typeOtp(page, '000000');
    await btn(page, /^xác nhận$/i).click();
    await expectNotice(page, /mã xác thực không đúng hoặc đã hết hạn/i);
    await expect(btn(page, /^xác nhận$/i)).toBeVisible();
    await expect(newPw(page)).toHaveCount(0);
  });
  test(tc('RPW-O07'), async ({ page }) => {
    await toOtpScreen(page);
    await typeOtp(page, 'abcdef');
    const vals = await page.locator('input').evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
    expect(vals.join(''), 'các ô OTP không được nhận chữ cái').not.toMatch(/[a-z]/i);
  });
  test(tc('RPW-O08'), async ({ page }) => {
    await toNewPasswordScreen(page);
    await expect(newPw(page)).toBeVisible();
  });
  test(tc('RPW-O09'), async ({ page }) => {
    await toOtpScreen(page);
    await btn(page, /đổi email khác/i).click();
    await expect(emailIn(page)).toBeVisible();
    await expect(btn(page, /lấy mã otp/i)).toBeVisible();
  });
  test(tc('RPW-O10'), async () => {
    test.setTimeout(120_000);
    const { otp } = await requestOtp();
    expect((await verifyOtp(otp)).status, 'OTP phải hợp lệ khi vừa gửi').toBe(200);
    await new Promise(r => setTimeout(r, 65_000));
    const r = await verifyOtp(otp);
    expect(r.status).toBe(400); expect(r.message).toMatch(/không đúng hoặc đã hết hạn/i);
  });
  test(tc('RPW-O11'), async () => {
    const a = (await requestOtp()).otp, b = (await requestOtp()).otp;
    expect(a).not.toBe(b);
    expect((await verifyOtp(a)).status, 'OTP cũ sau khi gửi lại').toBe(400);
    expect((await verifyOtp(b)).status).toBe(200);
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
  test(tc('RPW-O14'), async () => {
    const { otp } = await requestOtp();
    for (let i = 0; i < 12; i++) {
      const wrong = String(100000 + i * 7919); if (wrong === otp) continue;
      expect((await verifyOtp(wrong)).status).toBe(400);
    }
    const r = await verifyOtp(otp);
    expect(r.status, 'OTP đúng sau 12 lần nhập sai liên tiếp').not.toBe(200);
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
  test(tc('RPW-P02'), async ({ page }) => {
    await toNewPasswordScreen(page);
    const n = counter(page, '/reset-password');
    if (!(await submitPw(page).isDisabled())) {
      await submitPw(page).click();
      await expectNotice(page, /vui lòng nhập|không được để trống|bắt buộc/i);
    }
    expect(n.v).toBe(0);
  });
  test(tc('RPW-P03'), async ({ page }) => {
    await toNewPasswordScreen(page);
    const n = counter(page, '/reset-password');
    await newPw(page).fill(PW); await newPw2(page).fill('Test!654321');
    await expectNotice(page, /mật khẩu xác nhận không khớp/i);
    await expect(submitPw(page)).toBeDisabled();
    expect(n.v).toBe(0);
  });
  test(tc('RPW-P04'), async () => {
    const { otp } = await requestOtp();
    const r = await resetPw(otp, PW, 'Test!654321');
    expect(r.status).toBe(400); expect(r.message).toMatch(/không khớp/i);
    expect((await verifyOtp(otp)).status, 'OTP vẫn dùng được sau khi nhập không khớp').toBe(200);
  });
  test(tc('RPW-P05'), async () => {
    const r = await tryPassword('');
    expect(r.status, `mật khẩu rỗng: ${r.message}`).toBe(400);
  });
  test(tc('RPW-P06'), async () => {
    const r = await tryPassword('abc');
    expect(r.status, `mật khẩu "abc": ${r.message}`).toBe(400);
  });
  test(tc('RPW-P07'), async () => {
    const r = await tryPassword('12345678');
    expect(r.status, `mật khẩu "12345678": ${r.message}`).toBe(400);
  });
  test(tc('RPW-P08'), async () => {
    const r = await tryPassword('Aa1!' + 'x'.repeat(124));
    expect(r.status, r.message).toBe(200);
  });
  test(tc('RPW-P09'), async () => {
    const r = await tryPassword('Aa1!' + 'x'.repeat(125));
    expect(r.status).toBe(400); expect(r.message).toMatch(/vượt quá 128 ký tự/i);
  });
  test(tc('RPW-P10'), async ({ page }) => {
    const before = (await findApi('idm/users', RESET_USER, 'userName'))?.lastPasswordChangeDate;
    await toNewPasswordScreen(page);
    await newPw(page).fill(PW); await newPw2(page).fill(PW);
    await submitPw(page).click();
    await expect(page.getByText(/đặt lại mật khẩu thành công/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/phiên đăng nhập khác.*đăng xuất/i)).toBeVisible();
    await btn(page, /^đăng nhập$/i).click();
    await expect(lgn.user(page)).toBeVisible({ timeout: 10_000 });
    const after = (await findApi('idm/users', RESET_USER, 'userName'))?.lastPasswordChangeDate;
    expect(new Date(after).getTime(), `lastPasswordChangeDate: ${before} → ${after}`).toBeGreaterThan(new Date(before ?? 0).getTime());
  });
  test(tc('RPW-P11'), async () => {
    const { otp } = await requestOtp();
    expect((await resetPw(otp, PW)).status).toBe(200);
    const r = await resetPw(otp, PW);
    expect(r.status).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    expect(r.message).toMatch(/không tìm thấy người dùng hoặc mã xác thực đã hết hạn/i);
  });
  test(tc('RPW-P12'), async () => {
    const r = await resetPw('000000', PW);
    expect(r.status).toBe(404); expect(r.message).toMatch(/không tìm thấy người dùng hoặc mã xác thực đã hết hạn/i);
  });
  test(tc('RPW-P13'), async () => {
    const r = await authPost('reset-password', {});
    expect(r.status).toBe(400); expect(r.message).toMatch(/resetPasswordToken/);
  });
  test(tc('RPW-P14'), async ({ page }) => {
    await toNewPasswordScreen(page);
    await btn(page, /quay lại đăng nhập/i).click();
    await expect(lgn.user(page)).toBeVisible();
  });
});
