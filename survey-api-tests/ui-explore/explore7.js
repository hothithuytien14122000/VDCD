const { chromium } = require('playwright-core');
const path = require('path');

const OUT_DIR = __dirname;
const BASE = 'https://cds.geneat.pro';
const LOGIN_PATH = '/#/vi/login';
const TARGET_PATH = '/#/vi/self-assessment-campaigns';
const EMAIL = 'qa.superadmin@cds.local';
const PASSWORD = '123456';

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
  await login(page);
  await page.goto(BASE + TARGET_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const row = page.locator('tr', { hasText: 'Cơ cấu tổ chức' });
  const btn = row.locator('button:has-text("Xem chi tiết")');
  const box = await btn.boundingBox();
  console.log('button box:', box);

  const info = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return {
      tag: el?.tagName,
      cls: el?.className,
      text: el?.textContent?.slice(0, 60),
      outerHTML: el?.outerHTML?.slice(0, 300),
    };
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  console.log('elementFromPoint:', info);

  // inspect react fiber / onclick presence
  const handlerInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Xem chi tiết'));
    return buttons.map(b => ({
      text: b.textContent,
      disabled: b.disabled,
      outerHTML: b.outerHTML.slice(0, 300),
    }));
  });
  console.log('handlerInfo:', JSON.stringify(handlerInfo, null, 2));

  // Try dispatching a real click via CDP mouse click at coordinates
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(2000);
  console.log('URL after mouse.click:', page.url());

  await browser.close();
})().catch((err) => { console.error('ERROR:', err); process.exit(1); });
