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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  await login(page);
  await page.goto(BASE + TARGET_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Row 1 "Cơ cấu tổ chức" status Nháp - click dropdown trigger
  try {
    const row = page.locator('tr', { hasText: 'Cơ cấu tổ chức' });
    await row.locator('.ant-dropdown-trigger').click();
    await page.waitForTimeout(1000);
    await dumpState(page, '09-dropdown-nhap');
  } catch (e) { console.log('dropdown nhap err', e.message); }

  // close dropdown
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  // Row 2 "test định kỳ" status "Đã phê duyệt" - click dropdown trigger
  try {
    const row2 = page.locator('tr', { hasText: 'test định kỳ 9:21' });
    await row2.locator('.ant-dropdown-trigger').click();
    await page.waitForTimeout(1000);
    await dumpState(page, '10-dropdown-daphduyet');
  } catch (e) { console.log('dropdown approved err', e.message); }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  // Now click "Xem chi tiết" (the link button, not chevron) on row 1 to open detail
  try {
    const row = page.locator('tr', { hasText: 'Cơ cấu tổ chức' });
    await row.getByText('Xem chi tiết', { exact: true }).click();
    await page.waitForTimeout(2500);
    await dumpState(page, '11-detail-page');
    console.log('URL:', page.url());
  } catch (e) { console.log('xem chi tiet click err', e.message); }

  console.log('DONE');
  await browser.close();
})().catch((err) => { console.error('ERROR:', err); process.exit(1); });
