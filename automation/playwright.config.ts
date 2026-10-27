import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

import cfg from './accounts.mjs';
// Mỗi user là 1 project, dùng session đã lưu trong auth/<key>.json.
// Chỉ tạo project cho user đã có file session (tránh lỗi khi chưa đăng nhập đủ).
const roleProjects = cfg.users
  .filter((u: any) => fs.existsSync(`auth/${u.key}.json`))
  .map((u: any) => ({
    name: u.key,
    use: { storageState: `auth/${u.key}.json` },
    testMatch: /.*\.spec\.ts/,
    testIgnore: /scripts\/Auth\//,   // Auth chạy ở project 'auth' riêng
  }));
// Đăng nhập / quên mật khẩu: không dùng session, chạy tuần tự (dùng chung user qc.resetpw + hộp thư Mailosaur).
roleProjects.push({ name: 'auth', use: { storageState: { cookies: [], origins: [] } }, testMatch: /scripts\/Auth\/.*\.spec\.ts/ } as any);

export default defineConfig({
  testDir: './scripts',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: cfg.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: roleProjects,
});
