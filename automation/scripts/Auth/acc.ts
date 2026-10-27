// Dùng chung cho Đổi mật khẩu (CPW) / Đăng xuất (LGO): phiên đã đăng nhập lấy từ auth/<user>.json (project 'auth' mặc định không có phiên).
import fs from 'node:fs';
import { Browser, BrowserContext, Page } from '@playwright/test';
import cfg from '../../accounts.mjs';
import { tokenOf, API_BASE } from '../api';
import { expect } from './common';
export { tokenOf, API_BASE };

export const BAD = 'Sai!Matkhau1';          // mật khẩu hiện tại sai cố ý
export const NEWPW = 'Moi!123456a';
export const PROFILE = '/#/vi/profile';
const API = `${API_BASE}/api/v1`;

/** Mở trang mới với phiên của user `key`. Trả cả context để đóng/giả lập mạng. */
export async function asUser(browser: Browser, key: string): Promise<{ ctx: BrowserContext; page: Page }> {
  if (!fs.existsSync(`auth/${key}.json`)) throw new Error(`Thiếu auth/${key}.json (chạy npm run auth)`);
  const ctx = await browser.newContext({ storageState: `auth/${key}.json`, baseURL: cfg.baseURL, viewport: { width: 1440, height: 900 } });
  return { ctx, page: await ctx.newPage() };
}
export const originalPassword = (key = 'canbo') => (cfg.users.find((u: any) => u.key === key)?.password || cfg.password) as string;

const H = (token?: string) => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
export async function myInfo(key = 'canbo') {
  const r = await fetch(`${API}/idm/users/info`, { headers: H(tokenOf(key)) });
  return (await r.json()).data as { id: string; userName: string; name: string };
}
export async function putPassword(id: string, body: any, token: string | null = tokenOf('canbo')) {
  const r = await fetch(`${API}/idm/users/${id}/password`, { method: 'PUT', headers: H(token ?? undefined), body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, message: String(j?.message ?? '') };
}
/** Gọi đổi mật khẩu bằng mật khẩu cũ rỗng/null; nếu hệ thống lỡ chấp nhận (200) thì khôi phục mật khẩu gốc rồi trả kết quả. */
export async function putWithRestore(body: any) {
  const me = await myInfo();
  const r = await putPassword(me.id, body);
  if (r.status === 200) {
    const back = await putPassword(me.id, { passwordOld: '', passwordNew: originalPassword() });
    if (back.status !== 200) await putPassword(me.id, { passwordOld: body.passwordNew, passwordNew: originalPassword() });
  }
  return r;
}

// ---------- UI ----------
export const toastLoc = (p: Page) => p.locator('.ant-message-notice, .ant-notification-notice');
export async function bodyHas(p: Page, re: RegExp, timeout = 8000) {
  await expect.poll(async () => (await p.locator('body').innerText()), { timeout }).toMatch(re);
}
export function countPut(p: Page) { const n = { v: 0 }; p.on('request', r => { if (r.method() === 'PUT' && /\/password$/.test(r.url())) n.v++; }); return n; }
export const dialog = (p: Page) => p.getByRole('dialog').last();
export const pw = {
  old: (d: any) => d.getByPlaceholder('Nhập mật khẩu hiện tại'),
  neu: (d: any) => d.getByPlaceholder('Nhập mật khẩu mới'),
  cfm: (d: any) => d.getByPlaceholder('Nhập lại mật khẩu mới'),
  submit: (d: any) => d.getByRole('button', { name: 'Cập nhật mật khẩu' }),
  cancel: (d: any) => d.getByRole('button', { name: 'Huỷ' }),
};
export async function openProfile(p: Page) {
  await p.goto(PROFILE, { waitUntil: 'networkidle' });
  await expect(p.getByRole('button', { name: 'Đổi mật khẩu' })).toBeVisible();
}
export async function openChange(p: Page) {
  await openProfile(p);
  await p.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  const d = dialog(p); await expect(d).toBeVisible(); await expect(pw.old(d)).toBeVisible();
  return d;
}
export async function fillChange(d: any, o: string, n: string, c: string) {
  await pw.old(d).fill(o); await pw.neu(d).fill(n); await pw.cfm(d).fill(c);
}
export const dialogText = async (d: any) => (await d.innerText()).replace(/\n+/g, ' | ');

/** Mở menu người dùng ở góc dưới sidebar (tên hiển thị = fullName của tài khoản). */
export async function openUserMenu(p: Page, fullName: string) {
  await p.getByRole('complementary').getByText(fullName, { exact: true }).click();
}
export async function askLogout(p: Page, fullName: string) {
  await openUserMenu(p, fullName);
  await p.getByText('Đăng xuất', { exact: true }).click();
  await expect(p.getByText('Đăng xuất khỏi hệ thống?')).toBeVisible();
}
export const LOGIN_RE = /#\/vi\/auth\/login/;
