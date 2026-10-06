import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false, // cac test co the dung chung du lieu (vi du: ID khao sat vua tao) nen chay tuan tu
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://cds.geneat.pro',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
    trace: 'retain-on-failure',
  },
});
