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
import { testMail } from '../mail';
import { openLogin } from './common';

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

// ===== Case bổ sung từ bug GitLab (gộp từ quen-mat-khau-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
test.describe(() => {
test.describe.configure({ timeout: 180_000 });   // chạy tuần tự nhờ --workers=1 (dùng chung hộp thư qc.resetpw)

const emailIn = (p: Page) => p.getByPlaceholder('Nhập email đăng ký');
const newPw = (p: Page) => p.getByPlaceholder('Nhập mật khẩu mới');
const otpBtn = (p: Page) => btn(p, /^xác nhận$/i);
const bodyText = (p: Page) => p.locator('body').innerText();
const note = (type: string, description: string) => test.info().annotations.push({ type, description });

/** Hộp thư Mailosaur có đọc được không (API key còn hiệu lực). Không đọc được mail → không lấy được OTP → case phụ thuộc BLOCKED. */
let mailbox: string | null | undefined;
async function mailboxError() {
  if (mailbox !== undefined) return mailbox;
  if (!mailEnabled()) return (mailbox = 'Thiếu MAILOSAUR_API_KEY / MAILOSAUR_SERVER_ID trong .env');
  const r = await fetch(`https://mailosaur.com/api/messages?server=${process.env.MAILOSAUR_SERVER_ID}&page=0&itemsPerPage=1`,
    { headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.MAILOSAUR_API_KEY}:`).toString('base64') } }).catch(() => null);
  return (mailbox = r?.ok ? null : `BLOCKED: không đọc được hộp thư Mailosaur (HTTP ${r?.status ?? 'lỗi mạng'}) → không lấy được OTP`);
}
async function needMailbox() { const e = await mailboxError(); test.skip(!!e, e ?? ''); }

// Giới hạn tần suất gửi OTP (xem RPW-L11) → giãn cách các lần xin OTP cho qc.resetpw.
let lastOtpAt = 0;
async function otpGate() {
  const wait = lastOtpAt + 65_000 - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastOtpAt = Date.now();
}

test.describe('Quên mật khẩu', () => {

  test(tc('RPW-L12'), async ({ page }) => {   // GitLab #243, #128 — nội dung thông báo cần BA: chỉ kiểm có báo lỗi + không chuyển màn + không gửi mail
    const addr = testMail('norpw');   // địa chỉ Mailosaur chưa đăng ký tài khoản nào
    await openForgot(page);
    await emailIn(page).fill(addr);
    const resp = page.waitForResponse(r => r.url().includes('/forgot-password'), { timeout: 15_000 });
    await btn(page, /lấy mã otp/i).click();
    const res = await resp;
    const api = `HTTP ${res.status()} ${String((await res.json().catch(() => ({})))?.message ?? '')}`;
    // Toast antd tự ẩn sau ~3s → ghi nhận mọi thông báo xuất hiện trong 6s sau khi bấm
    let shown = '';
    for (let i = 0; i < 12 && !shown; i++) { shown = (await notices(page).allInnerTexts()).join(' | '); if (!shown) await page.waitForTimeout(500); }
    await page.waitForTimeout(2000);
    note('Quan sát', `API ${api} | thông báo: ${shown || '(không có)'} | màn OTP: ${await otpBtn(page).isVisible()}`);
    expect(await otpBtn(page).isVisible(), 'email chưa đăng ký vẫn chuyển sang màn Nhập mã OTP').toBe(false);
    await expect(emailIn(page)).toBeVisible();
    expect(shown, 'không được báo đã gửi OTP').not.toMatch(/đã gửi|gửi thành công|kiểm tra email/i);
    expect(shown, `không hiển thị thông báo lỗi nào (API trả ${api})`).not.toBe('');
    if (await mailboxError()) note('Không kiểm', 'Phần "không gửi mail": hộp thư Mailosaur không đọc được; dựa vào API forgot-password trả lỗi');
    else expect(await waitMail(addr, undefined, 10_000).catch(() => null), 'hệ thống vẫn gửi mail tới email chưa đăng ký').toBeNull();
  });

  test(tc('RPW-L13'), async ({ page }) => {   // GitLab #128
    await otpGate();
    const prev = await latestMailId(RESET_EMAIL).catch(() => undefined);
    await openForgot(page);
    await emailIn(page).fill(RESET_EMAIL.toUpperCase());
    const resp = page.waitForResponse(r => r.url().includes('/forgot-password'), { timeout: 15_000 }).catch(() => null);
    await btn(page, /lấy mã otp/i).click();
    const res = await resp;
    const api = res ? `HTTP ${res.status()} ${String((await res.json().catch(() => ({})))?.message ?? '')}` : '(không gọi API forgot-password)';
    let shown = '';
    for (let i = 0; i < 12 && !shown; i++) { shown = (await notices(page).allInnerTexts()).join(' | '); if (!shown) await page.waitForTimeout(500); }
    await page.waitForTimeout(1500);
    const moved = await otpBtn(page).isVisible();
    note('Quan sát', `API ${api} | thông báo: ${shown || '(không có)'} | màn OTP: ${moved}`);
    expect(moved, `email viết HOA không chuyển sang màn Nhập mã OTP (API ${api}; thông báo: ${shown || 'không có'})`).toBe(true);
    if (await mailboxError()) { note('Không kiểm', 'Phần "nhận mail OTP": hộp thư Mailosaur không đọc được'); return; }
    const mail = await waitMail(RESET_EMAIL, prev, 60_000);
    expect(mail.subject + mail.text).toMatch(/\b\d{6}\b/);
  });

  test(tc('RPW-P17'), async ({ page }) => {   // GitLab #217
    await needMailbox();
    await otpGate();
    await toNewPasswordScreen(page);
    const txt = await bodyText(page);
    note('Quan sát', txt.replace(/\n+/g, ' | ').slice(0, 300));
    expect(txt.toLowerCase(), 'màn Đặt lại mật khẩu không hiển thị email của tài khoản').toContain(RESET_EMAIL.toLowerCase());
    expect(txt.toLowerCase().split(RESET_EMAIL.toLowerCase()).join(''), 'màn Đặt lại mật khẩu hiển thị tên đăng nhập').not.toContain(RESET_USER);
  });

  test(tc('RPW-P19'), async ({ page }) => {   // GitLab #28 — chỉ kiểm khi OTP còn hiệu lực
    await needMailbox();
    await otpGate();
    await toNewPasswordScreen(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    note('Quan sát sau F5', `${page.url()} | ${(await bodyText(page)).replace(/\n+/g, ' | ').slice(0, 200)}`);
    await expect(newPw(page), 'sau F5 không còn ở màn nhập mật khẩu mới').toBeVisible();
    expect((await bodyText(page)).toLowerCase(), 'sau F5 không còn thông tin email đang đặt lại').toContain(RESET_EMAIL.toLowerCase());
  });

  test(tc('RPW-P16'), async () => {   // GitLab #128
    await needMailbox();
    await otpGate();
    const { otp } = await requestOtp();
    const r = await resetPw(otp, 'abc');
    note('Quan sát', `HTTP ${r.status}: ${r.message}`);
    if (r.status === 200) await restorePassword();   // hệ thống lỡ nhận → khôi phục qc.resetpw về mật khẩu chuẩn
    expect(r.status, `reset-password nhận mật khẩu "abc": ${r.message}`).toBe(400);
  });

  test(tc('RPW-O15'), async ({ page }) => {   // GitLab #23 — OTP hiệu lực 1 phút
    await needMailbox();
    await otpGate();
    const { otp } = await toOtpScreen(page);
    await page.waitForTimeout(70_000);
    await typeOtp(page, otp);
    if (await otpBtn(page).isEnabled()) await otpBtn(page).click();
    await page.waitForTimeout(3000);
    const txt = (await bodyText(page)).replace(/\n+/g, ' | ');
    note('Quan sát', `${(await notices(page).allInnerTexts()).join(' | ')} || ${txt.slice(0, 250)}`);
    await expect(newPw(page), 'OTP hết hạn vẫn chuyển sang màn nhập mật khẩu mới').toHaveCount(0);
    await expect(otpBtn(page)).toBeVisible();
    expect(txt, 'không báo OTP đã hết hạn').toMatch(/hết hạn|hết hiệu lực/i);
  });
});
});
