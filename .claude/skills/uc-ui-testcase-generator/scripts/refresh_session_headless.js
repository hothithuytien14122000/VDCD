/**
 * Headless, agent-driven equivalent of workspace/survey-api-tests/scripts/save_auth_state.js.
 *
 * That script opens a VISIBLE browser so a human can type the captcha by hand. An agent
 * has no screen to type into, so this one runs headless and solves the captcha by the
 * same file-handshake pattern used elsewhere in this skill's exploration: it screenshots
 * just the captcha image, waits for a sibling file with the answer (the agent reads the
 * screenshot with its own vision and writes the answer), then continues.
 *
 * Writes the SAME two files, in the SAME format, at the SAME path convention that
 * tests/helpers/ui.ts (AUTH_STATE_PATH / SESSION_STORAGE_PATH / applySessionStorage)
 * already expects — so a session saved by this script is a drop-in replacement for one
 * saved by a human running save_auth_state.js. Necessary because this app keeps its login
 * token in sessionStorage (a per-tab, JS-only store), which Playwright's own
 * `context.storageState()` never captures — see the comment at the top of ui.ts for the
 * full story of that discovery.
 *
 * Usage:
 *   node refresh_session_headless.js --out-dir ../../workspace/survey-api-tests/.auth \
 *       --env-file ../../workspace/ui-tests-self-assessment/.env
 *
 * Flow (run by the agent, not scripted end-to-end, because reading the captcha image
 * needs a human-or-agent eye):
 *   1. Run this script in the background.
 *   2. Read the CAPTCHA_SCREENSHOT path it prints with your own image-reading tool.
 *   3. Write the characters you read into the ANSWER_FILE path it prints.
 *   4. The script resumes, logs in, and writes storageState.json + sessionStorage.json.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

function loadEnv(p) {
  const out = {};
  if (!p || !fs.existsSync(p)) return out;
  const text = fs.readFileSync(p, 'utf-8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const idx = t.indexOf('=');
    out[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  return out;
}

function parseArgs() {
  const args = { outDir: null, envFile: null, chromiumPath: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir') args.outDir = argv[++i];
    else if (argv[i] === '--env-file') args.envFile = argv[++i];
    else if (argv[i] === '--chromium-path') args.chromiumPath = argv[++i];
  }
  if (!args.outDir) {
    console.error('Usage: node refresh_session_headless.js --out-dir <path/to/.auth> [--env-file <path/to/.env>] [--chromium-path <path>]');
    process.exit(1);
  }
  return args;
}

(async () => {
  const args = parseArgs();
  const env = loadEnv(args.envFile);
  const BASE = env.BASE_URL || process.env.BASE_URL || 'https://cds.geneat.pro';
  const LOGIN_PATH = '/#/vi/login';
  const EMAIL = env.UI_AUTH_USERNAME || process.env.UI_AUTH_USERNAME;
  const PASSWORD = env.UI_AUTH_PASSWORD || process.env.UI_AUTH_PASSWORD;
  if (!EMAIL || !PASSWORD) {
    console.error('Missing UI_AUTH_USERNAME/UI_AUTH_PASSWORD (pass --env-file, or set them in the environment).');
    process.exit(1);
  }

  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const storageStatePath = path.join(outDir, 'storageState.json');
  const sessionStoragePath = path.join(outDir, 'sessionStorage.json');
  const captchaShotPath = path.join(outDir, '..', '_refresh_captcha_crop.png');
  const answerPath = path.join(outDir, '..', '_refresh_captcha_answer.txt');

  const launchOpts = { headless: true };
  if (args.chromiumPath) launchOpts.executablePath = args.chromiumPath;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3 });

  console.log('Navigating to login page:', BASE + LOGIN_PATH);
  await page.goto(BASE + LOGIN_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // /#/vi/login may land on a public homepage with a "Dang nhap" CTA instead of the
  // form directly — click through if there's no password field yet.
  if ((await page.$('input[type="password"]')) === null) {
    const cta = await page.$('a:has-text("Đăng nhập hệ thống"), button:has-text("Đăng nhập hệ thống"), a:has-text("Đăng nhập"), button:has-text("Đăng nhập")');
    if (cta) { await cta.click(); await page.waitForTimeout(1500); }
  }

  // Crop region matches this app's login card at 1600x1000/scale=3 — adjust here if the
  // layout changes (captcha-crop should show just the 5-6 colored letters, nothing else).
  await page.screenshot({ path: captchaShotPath, clip: { x: 1196, y: 558, width: 166, height: 48 } });
  console.log('CAPTCHA_SCREENSHOT:', captchaShotPath);

  try { fs.unlinkSync(answerPath); } catch (e) {}
  console.log('WAITING_FOR_CAPTCHA_ANSWER:', answerPath);
  const deadline = Date.now() + 180000;
  while (!fs.existsSync(answerPath)) {
    if (Date.now() > deadline) {
      console.error('Timed out waiting for the captcha answer file.');
      await browser.close();
      process.exit(5);
    }
    await page.waitForTimeout(1000);
  }
  const code = fs.readFileSync(answerPath, 'utf-8').trim();
  console.log('Using captcha answer:', code);

  const userInput = await page.$('input[placeholder*="tên đăng nhập" i]');
  const passInput = await page.$('input[type="password"]');
  const captchaInput = await page.$('input[placeholder*="mã bên cạnh" i], input[placeholder*="mã xác nhận" i]');
  if (userInput) await userInput.fill(EMAIL); else console.error('username input not found');
  if (passInput) await passInput.fill(PASSWORD); else console.error('password input not found');
  if (captchaInput) await captchaInput.fill(code); else console.error('captcha input not found');

  const loginBtn = await page.$('button:has-text("Đăng nhập")');
  await Promise.all([
    page.waitForURL((url) => !/login/i.test(url.toString()), { timeout: 15000 }).catch(() => {}),
    loginBtn ? loginBtn.click() : Promise.resolve(),
  ]);
  await page.waitForTimeout(2000);

  if (/login/i.test(page.url())) {
    console.error('LOGIN FAILED — still on the login page (captcha misread, or wrong credentials).');
    await browser.close();
    process.exit(4);
  }
  console.log('Login OK:', page.url());

  await page.context().storageState({ path: storageStatePath });
  const sessionStorageData = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      out[key] = window.sessionStorage.getItem(key);
    }
    return out;
  });
  fs.writeFileSync(sessionStoragePath, JSON.stringify({ origin: BASE, data: sessionStorageData }, null, 2), 'utf-8');

  console.log('Saved storageState:', storageStatePath);
  console.log('Saved sessionStorage:', sessionStoragePath, '(keys:', Object.keys(sessionStorageData).join(', ') || '(none)', ')');

  try { fs.unlinkSync(captchaShotPath); } catch (e) {}
  try { fs.unlinkSync(answerPath); } catch (e) {}

  await browser.close();
})().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
