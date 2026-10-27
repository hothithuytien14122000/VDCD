// Nạp cấu hình tài khoản từ .env (không lưu mật khẩu trong mã nguồn).
// Dùng:  import cfg from './accounts.mjs'  →  { baseURL, password, users:[{key,email,password,note}] }
import fs from 'node:fs';
// Luôn chạy từ thư mục automation/ nên đọc .env theo cwd (tương thích cả ESM lẫn CJS do Playwright biên dịch).
if (fs.existsSync('.env')) process.loadEnvFile('.env');
const E = process.env;
if (!E.BASE_URL) throw new Error('Thiếu BASE_URL — tạo .env từ .env.example');
const keys = (E.ACCOUNT_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
export default {
  baseURL: E.BASE_URL,
  password: E.DEFAULT_PASSWORD || '',
  users: keys.map(key => {
    const K = key.toUpperCase();
    return { key, email: E[`ACCOUNT_${K}_EMAIL`], password: E[`ACCOUNT_${K}_PASSWORD`] || undefined, note: E[`ACCOUNT_${K}_NOTE`] || '' };
  }),
};
