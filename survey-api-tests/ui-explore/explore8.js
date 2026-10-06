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
  await login(page);
  await page.goto(BASE + TARGET_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Open "Thêm mới" modal
  await page.click('text=Thêm mới');
  await page.waitForTimeout(1200);

  // Click "Phân loại đánh giá" select to open options
  try {
    const selects = page.locator('.ant-select');
    console.log('select count:', await selects.count());
    await selects.nth(0).click();
    await page.waitForTimeout(800);
    await dumpState(page, '14-select-phanloai-options');
  } catch (e) { console.log('phanloai select err', e.message); }

  // close this dropdown, open second select "Đánh giá"
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
  try {
    const selects = page.locator('.ant-select');
    await selects.nth(1).click();
    await page.waitForTimeout(800);
    await dumpState(page, '15-select-danhgia-options');
  } catch (e) { console.log('danhgia select err', e.message); }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);

  // Try submit empty form to see validation messages
  try {
    await page.click('button:has-text("Thêm mới") >> nth=-1');
    await page.waitForTimeout(1000);
    await dumpState(page, '16-validate-empty-submit');
  } catch (e) { console.log('submit empty err', e.message); }

  // close modal
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('.ant-modal-close').click().catch(() => {});
  await page.waitForTimeout(800);

  // Open dropdown on approved row, click "Cập nhật"
  try {
    const row2 = page.locator('tr', { hasText: 'test định kỳ 9:21' });
    await row2.locator('.ant-dropdown-trigger').click();
    await page.waitForTimeout(800);
    await page.click('text=Cập nhật');
    await page.waitForTimeout(1500);
    await dumpState(page, '17-capnhat-form-approved');
  } catch (e) { console.log('capnhat err', e.message); }

  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('.ant-modal-close').click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('.ant-drawer-close').click().catch(() => {});
  await page.waitForTimeout(800);

  // Open dropdown on draft row, click "Xoá"
  try {
    const row1 = page.locator('tr', { hasText: 'Cơ cấu tổ chức' });
    await row1.locator('.ant-dropdown-trigger').click();
    await page.waitForTimeout(800);
    await page.click('text=Xoá');
    await page.waitForTimeout(1200);
    await dumpState(page, '18-xoa-confirm');
  } catch (e) { console.log('xoa err', e.message); }

  console.log('DONE');
  await browser.close();
})().catch((err) => { console.error('ERROR:', err); process.exit(1); });
