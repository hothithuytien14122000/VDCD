const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const BASE = 'https://cds.geneat.pro';
const LOGIN_PATH = '/#/vi/login';
const TARGET_PATH = '/#/vi/self-assessment-campaigns';

const EMAIL = 'qa.superadmin@cds.local';
const PASSWORD = '123456';

function p(name, ext) {
  return path.join(OUT_DIR, `${name}.${ext}`);
}

async function dumpState(page, name) {
  await page.screenshot({ path: p(name, 'png'), fullPage: true }).catch((e) => console.log('screenshot err', e.message));
  const html = await page.content();
  fs.writeFileSync(p(name, 'html'), html, 'utf-8');
  const text = await page.innerText('body').catch(() => '');
  fs.writeFileSync(p(name, 'txt'), text, 'utf-8');
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

  console.log('Logging in...');
  await login(page);

  console.log('Navigating to target page...');
  await page.goto(BASE + TARGET_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // 1) Click tab "Đột xuất"
  try {
    await page.click('text=Đột xuất');
    await page.waitForTimeout(1500);
    await dumpState(page, '05-tab-dotxuat');
  } catch (e) { console.log('tab dotxuat err', e.message); }

  // back to Định kỳ
  try {
    await page.click('text=Định kỳ');
    await page.waitForTimeout(1000);
  } catch (e) {}

  // 2) Click "Thêm mới"
  try {
    await page.click('text=Thêm mới');
    await page.waitForTimeout(1500);
    await dumpState(page, '06-them-moi-form');
  } catch (e) { console.log('them moi err', e.message); }

  // Try to find and dump all form field labels/inputs in the modal/drawer
  try {
    const formInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select, button'));
      return inputs.map((el) => ({
        tag: el.tagName,
        type: el.type || null,
        placeholder: el.placeholder || null,
        id: el.id || null,
        name: el.name || null,
        text: el.tagName === 'BUTTON' ? el.textContent.trim().slice(0, 50) : null,
        required: el.getAttribute('aria-required'),
      }));
    });
    fs.writeFileSync(p('06-form-fields', 'json'), JSON.stringify(formInfo, null, 2), 'utf-8');
    console.log('form fields count:', formInfo.length);
  } catch (e) { console.log('form info err', e.message); }

  // close modal (press Escape) and go back to list
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1000);
  await page.goto(BASE + TARGET_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // 3) Click "Xem chi tiết" on first row
  try {
    const detailLinks = await page.$$('text=Xem chi tiết');
    console.log('detail links found:', detailLinks.length);
    if (detailLinks.length > 0) {
      await detailLinks[0].click();
      await page.waitForTimeout(2000);
      await dumpState(page, '07-xem-chi-tiet');
      console.log('URL on detail:', page.url());
    }
  } catch (e) { console.log('xem chi tiet err', e.message); }

  console.log('DONE');
  await browser.close();
})().catch(async (err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
