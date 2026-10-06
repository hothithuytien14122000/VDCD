const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const BASE = 'https://cds.geneat.pro';
const LOGIN_PATH = '/#/vi/login';
const TARGET_PATH = '/#/vi/self-assessment-campaigns';

const EMAIL = 'qa.superadmin@cds.local';
const PASSWORD = '123456';

function screenshotPath(name) {
  return path.join(OUT_DIR, `${name}.png`);
}

async function dumpState(page, name) {
  await page.screenshot({ path: screenshotPath(name), fullPage: true });
  const html = await page.content();
  fs.writeFileSync(path.join(OUT_DIR, `${name}.html`), html, 'utf-8');
  const text = await page.innerText('body').catch(() => '');
  fs.writeFileSync(path.join(OUT_DIR, `${name}.txt`), text, 'utf-8');
}

(async () => {
  const chromiumPath = 'C:\\Users\\TienTien\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  console.log('Navigating to login page...');
  await page.goto(BASE + LOGIN_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await dumpState(page, '01-login-page');

  // Try to read captcha text displayed on page
  const bodyText = await page.innerText('body').catch(() => '');
  console.log('--- Login page text dump (first 2000 chars) ---');
  console.log(bodyText.slice(0, 2000));

  await browser.close();
})().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
