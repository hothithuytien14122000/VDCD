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
  await page.screenshot({ path: p(name, 'png'), fullPage: true }).catch(() => {});
  const html = await page.content();
  fs.writeFileSync(p(name, 'html'), html, 'utf-8');
  const text = await page.innerText('body').catch(() => '');
  fs.writeFileSync(p(name, 'txt'), text, 'utf-8');
}

(async () => {
  const chromiumPath = 'C:\\Users\\TienTien\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  console.log('Navigating to login page...');
  await page.goto(BASE + LOGIN_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);

  // Read captcha code displayed on page
  const captchaText = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const captchaInput = inputs.find((i) => i.placeholder === 'Nhập mã bên cạnh');
    if (!captchaInput) return null;
    // the captcha code is usually a sibling text node near the input
    const container = captchaInput.closest('div')?.parentElement;
    return container ? container.innerText : null;
  });
  console.log('Captcha area text:', captchaText);

  await page.fill('#login_userName', EMAIL);
  await page.fill('#login_password', PASSWORD);

  // Find displayed captcha value more precisely: look for a short span/div with 5 alnum chars near captcha input
  const codeCandidates = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div,span'));
    return all
      .map((e) => e.textContent.trim())
      .filter((t) => /^[A-Z0-9]{4,8}$/.test(t));
  });
  console.log('Code candidates:', codeCandidates);
  const captchaValue = codeCandidates[0] || '7K4MP';

  const captchaInputHandle = await page.$('input[placeholder="Nhập mã bên cạnh"]');
  await captchaInputHandle.fill(captchaValue);

  await dumpState(page, '02-login-filled');

  console.log('Submitting login with captcha:', captchaValue);
  await Promise.all([
    page.waitForTimeout(500),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(3000);
  await dumpState(page, '03-after-login');

  const currentUrl = page.url();
  console.log('URL after login:', currentUrl);

  console.log('Navigating to target page:', TARGET_PATH);
  await page.goto(BASE + TARGET_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  await dumpState(page, '04-self-assessment-campaigns');

  console.log('DONE');
  await browser.close();
})().catch(async (err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
