// Đăng nhập tay 1 lần cho mỗi user (bạn tự gõ captcha), lưu session ra auth/<key>.json.
// Chạy:  node save-session.mjs            -> làm lần lượt mọi user
//        node save-session.mjs canbo ldp  -> chỉ làm user chỉ định
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import cfg from './accounts.mjs';
const pick = process.argv.slice(2);
const users = cfg.users.filter(u => pick.length === 0 || pick.includes(u.key));
const rl = readline.createInterface({ input, output });

for (const u of users) {
  console.log(`\n=== ${u.key}  (${u.email})  mật khẩu: ${cfg.password} ===`);
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(cfg.baseURL);
  console.log('Đăng nhập trong cửa sổ vừa mở (gõ captcha bằng tay). Đăng nhập xong thì quay lại đây.');
  await rl.question('>> Đã đăng nhập xong? Nhấn Enter để lưu session... ');
  await ctx.storageState({ path: `auth/${u.key}.json` });
  console.log(`Đã lưu auth/${u.key}.json`);
  await browser.close();
}
await rl.close();
console.log('\nXong. Mỗi user có 1 file trong thư mục auth/.');
