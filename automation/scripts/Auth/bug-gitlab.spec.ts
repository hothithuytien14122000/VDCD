// Testcase BỔ SUNG từ bug GitLab — phần Đăng nhập / Quên mật khẩu (catalog-BUG-A1.mjs, prefix LGN/RPW).
// AN TOÀN TÀI KHOẢN: chỉ dùng trang đăng nhập khi CHƯA đăng nhập và user thử riêng qc.resetpw (hộp thư Mailosaur).
// Không đăng nhập bằng bất kỳ tài khoản nào; case nào làm đổi mật khẩu qc.resetpw thì tự khôi phục về PW.
// Các case cần phiên đăng nhập (captcha thật / tài khoản dùng chung / quyền admin) hoặc so design → không có script (BLOCKED/MANUAL).
import { Page } from '@playwright/test';
import { latestMailId, waitMail, testMail } from '../mail';
import {
  test, expect, tc, mailEnabled, RESET_EMAIL, RESET_USER, resetPw, requestOtp, restorePassword,
  openLogin, openForgot, notices, btn, typeOtp, toOtpScreen, toNewPasswordScreen,
} from './common';

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

test.describe('BUG GitLab › Đăng nhập', () => {
  test(tc('LGN-L09'), async ({ page }) => {   // GitLab #13
    await openLogin(page);
    for (const id of ['login_userName', 'login_password', 'login_captcha']) {
      const label = page.locator(`label[for=${id}]`);
      await expect(label).toHaveClass(/ant-form-item-required/);
      // Dấu * hiển thị là pseudo-element đang hiện (::before hoặc ::after có content "*")
      const star = await label.evaluate(el => {
        for (const ps of ['::before', '::after']) {
          const s = getComputedStyle(el, ps);
          if (s.content.includes('*') && s.display !== 'none' && s.visibility !== 'hidden') return s.color;
        }
        return null;
      });
      expect(star, `ô ${id}: không thấy dấu * hiển thị`).not.toBeNull();
      const [r, g, b] = star!.match(/\d+/g)!.map(Number);
      expect(r > 150 && g < 90 && b < 90, `ô ${id}: dấu * màu ${star}, không phải màu đỏ`).toBe(true);
    }
  });
});

test.describe('BUG GitLab › Quên mật khẩu', () => {

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
