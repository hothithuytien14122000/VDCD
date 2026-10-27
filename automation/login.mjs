// Đăng nhập qua API (không cần trình duyệt hiện màn hình), lưu session cho Playwright.
// Cách chạy:  node login.mjs canbo
//   1) Script lấy captcha, lưu ảnh captcha.png
//   2) Bạn MỞ captcha.png, đọc mã, gõ vào Terminal
//   3) Script login, ghi auth/<key>.json để test dùng lại
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import cfg from './accounts.mjs';
const key = process.argv[2];
const u = cfg.users.find(x => x.key === key);
if (!u) { console.error('Thiếu hoặc sai key. Ví dụ: node login.mjs canbo\nCác key:', cfg.users.map(x=>x.key).join(', ')); process.exit(1); }

const API = cfg.baseURL + '/api/v1/authentication';
// Các khóa localStorage app dùng (lấy từ bundle web):
const K_TOKEN   = 'b316682e-54f3-4ae1-89e3-bbc505e19e54';
const K_PROFILE = 'f423cd47-2deb-4c81-b13b-95f2687a4cb6';

const rl = readline.createInterface({ input, output });

const cap = await (await fetch(`${API}/captcha?width=300&height=100`)).json();
if (!cap?.data?.captchaId) { console.error('Không lấy được captcha:', cap?.message); process.exit(1); }
const b64 = cap.data.captchaImage.split(',', 2)[1];
fs.writeFileSync('captcha.png', Buffer.from(b64, 'base64'));
console.log(`\n=== ${u.key}  (${u.email}) ===`);
console.log('Đã lưu ảnh: captcha.png  — mở ảnh này lên để đọc mã.');

const code = (await rl.question('Nhập mã captcha trong ảnh: ')).trim();
await rl.close();

const res = await fetch(`${API}/jwt/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: u.email, password: u.password || cfg.password, rememberMe: true,
    captchaId: cap.data.captchaId, captchaCode: code,
  }),
});
const body = await res.json();
const d = body?.data;
if (!d?.tokenString) { console.error('Đăng nhập thất bại:', body?.message || res.status); process.exit(1); }

const storage = {
  cookies: [],
  origins: [{
    origin: cfg.baseURL,
    localStorage: [
      { name: K_TOKEN,   value: d.tokenString },
      { name: K_PROFILE, value: JSON.stringify(d) },
    ],
  }],
};
fs.mkdirSync('auth', { recursive: true });
fs.writeFileSync(`auth/${u.key}.json`, JSON.stringify(storage, null, 2));
fs.rmSync('captcha.png', { force: true });
console.log(`OK. Token hết hạn: ${d.expiresAt || '(không rõ)'}`);
console.log(`Đã lưu auth/${u.key}.json — giờ chạy:  npx playwright test --project=${u.key}`);
