// Khung dùng chung cho Đăng nhập (LGN) / Quên mật khẩu (RPW). Tên test = tc('ID') lấy từ testcases/docs/catalog.json.
import { test, expect, Page } from '@playwright/test';
import { tc } from '../A/common';
import { latestMailId, waitMail, otpOf, mailEnabled } from '../mail';
import { API_BASE, apiStatus } from '../api';
import cfg from '../../accounts.mjs';
export { test, expect, tc, mailEnabled, apiStatus, API_BASE };

export const AUTH_API = `${API_BASE}/api/v1/authentication`;
export const LOGIN_URL = `${API_BASE}/#/vi/auth/login`;
// Mật khẩu chuẩn của mọi tài khoản QC — đọc từ DEFAULT_PASSWORD trong .env, không ghi trong code
if (!cfg.password) throw new Error('Thiếu DEFAULT_PASSWORD trong .env (xem .env.example)');
export const PW: string = cfg.password;
export const RESET_USER = 'qc.resetpw';
const SERVER = process.env.MAILOSAUR_SERVER_ID;
export const RESET_EMAIL = `${RESET_USER}@${SERVER}.mailosaur.net`;

export interface Res { status: number; message: string; data: any }
async function call(method: string, url: string, body?: any): Promise<Res> {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, message: String(j?.message ?? ''), data: j?.data };
}
export const authPost = (path: string, body: any) => call('POST', `${AUTH_API}/${path}`, body);
export const authGet = (path: string, query: Record<string, string> = {}) => call('GET', `${AUTH_API}/${path}?${new URLSearchParams(query)}`);
export const forgot = (email: string) => authPost('forgot-password', { email });
export const verifyOtp = (otp: string, email = RESET_EMAIL) => authGet('verify-forgot-password-token', { resetPasswordToken: otp, email });
export const resetPw = (otp: string, password: string, confirmPassword = password) =>
  authPost('reset-password', { resetPasswordToken: otp, password, confirmPassword });

/** Gửi OTP tới qc.resetpw rồi đọc OTP từ mail mới nhất. */
export async function requestOtp(email = RESET_EMAIL) {
  const prev = await latestMailId(email);
  const r = await forgot(email);
  expect(r.status, `forgot-password: ${r.message}`).toBe(200);
  const mail = await waitMail(email, prev);
  const otp = otpOf(mail);
  expect(otp, 'mail không có OTP 6 số').toBeTruthy();
  return { otp: otp!, mail };
}
/** Đặt lại mật khẩu qc.resetpw về mật khẩu chuẩn (dùng sau test làm đổi mật khẩu). */
export async function restorePassword() {
  const { otp } = await requestOtp();
  const r = await resetPw(otp, PW);
  expect(r.status, `khôi phục mật khẩu: ${r.message}`).toBe(200);
}

// ---------- UI ----------
export const lgn = {
  user: (p: Page) => p.getByPlaceholder('Nhập tên đăng nhập'),
  pass: (p: Page) => p.getByPlaceholder('Nhập mật khẩu'),
  code: (p: Page) => p.getByPlaceholder('Nhập mã bên cạnh'),
  submit: (p: Page) => p.getByRole('button', { name: /^đăng nhập$/i }),
  captchaImg: (p: Page) => p.locator('img[alt=Captcha]'),
  refresh: (p: Page) => p.getByTitle('Đổi mã xác nhận'),
};
export async function openLogin(page: Page) {
  const same = page.url() === LOGIN_URL;
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
  if (same) await page.reload({ waitUntil: 'networkidle' });   // goto cùng URL (chỉ hash) không tải lại → trạng thái form cũ còn nguyên
  await expect(lgn.user(page)).toBeVisible();
  await lgn.captchaImg(page).waitFor({ state: 'visible' });
}
export async function openForgot(page: Page) {
  await openLogin(page);
  await page.getByText(/quên mật khẩu/i).first().click();
  await expect(page.getByPlaceholder('Nhập email đăng ký')).toBeVisible();
}
/** Mọi thông báo đang hiển thị (toast antd + lỗi dưới ô nhập). */
export const notices = (page: Page) => page.locator('.ant-message-notice, .ant-notification-notice, .ant-form-item-explain-error, [role=alert]');
export async function expectNotice(page: Page, re: RegExp) {
  await expect.poll(async () => (await notices(page).allInnerTexts()).join(' | '), { timeout: 8000 }).toMatch(re);
}
/** Gõ OTP vào 6 ô (ô tự nhảy). */
export async function typeOtp(page: Page, otp: string) {
  const cells = page.locator('input');
  await cells.first().click();
  await page.keyboard.type(otp);
}
export const btn = (page: Page, re: RegExp) => page.getByRole('button', { name: re });
/** Từ trang đăng nhập → nhập email → sang màn OTP. Trả OTP lấy từ mail. */
export async function toOtpScreen(page: Page, email = RESET_EMAIL) {
  const prev = await latestMailId(email);
  await openForgot(page);
  await page.getByPlaceholder('Nhập email đăng ký').fill(email);
  await btn(page, /lấy mã otp/i).click();
  await expect(btn(page, /^xác nhận$/i)).toBeVisible({ timeout: 15_000 });
  const mail = await waitMail(email, prev);
  return { otp: otpOf(mail)!, mail };
}
export async function toNewPasswordScreen(page: Page) {
  const { otp } = await toOtpScreen(page);
  await typeOtp(page, otp);
  await btn(page, /^xác nhận$/i).click();
  await expect(page.getByPlaceholder('Nhập mật khẩu mới')).toBeVisible({ timeout: 10_000 });
  return otp;
}
