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

