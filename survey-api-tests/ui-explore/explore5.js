const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const BASE = 'https://cds.geneat.pro';
const LOGIN_PATH = '/#/vi/login';
const TARGET_PATH = '/#/vi/self-assessment-campaigns';
const EMAIL = 'qa.superadmin@cds.local';
const PASSWORD = '123456';

function p(name, ext) { return path.join(OUT_DIR, `${name}.${ext}`); }

async function dumpState(page, name) {
  await page.screenshot({ path: p(name, 'png'), fullPage: true }).catch((e) => console.log('ss err', e.message));
  fs.writeFileSync(p(name, 'html'), await page.content(), 'utf-8');
  fs.writeFileSync(p(name, 'txt'), await page.innerText('body').catch(() => ''), 'utf-8');
  console.log('dumped', name);
}

async function login(page) {
  await page.goto(BASE + LOGIN_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  const codeCandidates = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div,span'));
    return all.map((e) => e.textContent.trim()).filter((t) => /^[A-Z0-9]{4,8}$/.test(t));
  });
  const captchaValue = codeCandidates[0] || '7K4MP';
  await page.fill('#login_userName', EMAIL);
  await page.fill('#login_password', PASSWORD);
  await page.fill('input[placeholder="Nhập mã bên cạnh"]', captchaValue);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

(async () => {
  const chromiumPath = 'C:\\Users\\TienTien\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  context.on('page', async (newPage) => {
    console.log('NEW PAGE OPENED:', newPage.url());
  });

  await login(page);
  await page.goto(BASE + TARGET_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const row = page.locator('tr', { hasText: 'Cơ cấu tổ chức' });
  const btn = row.locator('button:has-text("Xem chi tiết")');
  console.log('button count:', await btn.count());
  await btn.scrollIntoViewIfNeeded();

  const urlBefore = page.url();
  await btn.click({ force: true });
  await page.waitForTimeout(3000);
  console.log('URL before:', urlBefore, 'URL after:', page.url());
  console.log('pages in context:', context.pages().length);
  for (const pg of context.pages()) {
    console.log(' - page url:', pg.url());
  }
  await dumpState(page, '12-after-xemchitiet-click');

  console.log('DONE');
  await browser.close();
})().catch((err) => { console.error('ERROR:', err); process.exit(1); });
