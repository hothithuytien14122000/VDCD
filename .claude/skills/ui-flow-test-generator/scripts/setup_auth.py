#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Setup Auth — Generate Playwright auth setup & patch config for session reuse.

Generates:
  - $TESTING_ROOT/setup/auth.setup.ts   (login once, save storageState)
  - $TESTING_ROOT/.auth/                (directory for user.json)
  - Patches playwright.config.ts        (add 'setup' project + storageState)
  - Patches .gitignore                  (add .auth/)

Usage:
    python3 setup_auth.py --testing-root apps/testing/automation-testing/fe-testing

Reads from $TESTING_ROOT/.env:
    UI_BASE_URL, UI_AUTH_USERNAME, UI_AUTH_PASSWORD, LOGIN_URL (optional)
"""

import argparse
import re
import sys
from pathlib import Path

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


# ── Templates ─────────────────────────────────────────────────────────────────

AUTH_SETUP_TS = r"""import { test as setup } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Strip trailing slashes — without this, `${BASE_URL}/auth/signin` becomes
// `https://host//auth/signin` and Next.js redirects loop on the double slash.
const BASE_URL = (process.env.UI_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const LOGIN_URL = process.env.LOGIN_URL || `${BASE_URL}/auth/signin`;
const USERNAME = process.env.UI_AUTH_USERNAME!;
const PASSWORD = process.env.UI_AUTH_PASSWORD!;

export const AUTH_FILE = path.join(__dirname, '..', '.auth', 'user.json');

const EMAIL_SELECTORS = '#email, input[name="email"], input[type="email"]';
const PASSWORD_SELECTORS = '#password, input[name="password"], input[type="password"]';

setup('authenticate', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  // Do NOT wait on `networkidle` — Next.js dev keeps HMR sockets open, so it
  // never settles. Gate hydration on the email input becoming visible instead.
  await page.locator(EMAIL_SELECTORS).first().waitFor({ state: 'visible', timeout: 60000 });

  await page.locator(EMAIL_SELECTORS).first().fill(USERNAME);
  await page.locator(PASSWORD_SELECTORS).first().fill(PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes('/auth/signin'), { timeout: 30000 });

  await page.context().storageState({ path: AUTH_FILE });
  console.log(`Auth state saved to ${AUTH_FILE}`);
});
"""

PLAYWRIGHT_CONFIG_TS = r"""import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env') });

const UI_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:3000';
const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');
const reportDate = new Date().toISOString().slice(0, 10);
// FEATURE env var (set by run_tests.py) groups results per feature so multiple
// UIs run on the same day don't overwrite each other's report folder.
const reportFeature = process.env.FEATURE || '_unknown';
const resultsJsonPath = `report/ui/${reportDate}/${reportFeature}/results.json`;

export default defineConfig({
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: resultsJsonPath }],
  ],

  projects: [
    {
      name: 'setup',
      testMatch: /.*auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: UI_BASE_URL,
      },
    },

    {
      name: 'UI Tests',
      testDir: './script/ui',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: UI_BASE_URL,
        storageState: AUTH_FILE,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
      },
    },

    {
      name: 'API Tests',
      testDir: './script/api',
      use: {
        baseURL: process.env.API_BASE_URL || UI_BASE_URL,
        extraHTTPHeaders: {
          Accept: 'application/json',
        },
      },
    },
  ],
});
"""

GITIGNORE_ENTRIES = ['.auth/', 'test-results/', 'playwright-report/']


# ── Helpers ───────────────────────────────────────────────────────────────────

def read_env(env_path: Path) -> dict:
    """Read .env file into dict (simple key=value parser)."""
    env = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def ensure_gitignore(testing_root: Path):
    """Ensure .gitignore contains required entries."""
    gi_path = testing_root / '.gitignore'
    existing = ''
    if gi_path.exists():
        existing = gi_path.read_text(encoding='utf-8')

    added = []
    for entry in GITIGNORE_ENTRIES:
        if entry not in existing:
            added.append(entry)

    if added:
        with open(gi_path, 'a', encoding='utf-8') as f:
            if existing and not existing.endswith('\n'):
                f.write('\n')
            for entry in added:
                f.write(entry + '\n')
        print(f'   .gitignore: added {added}')
    else:
        print('   .gitignore: already up-to-date')


def has_setup_project(config_path: Path) -> bool:
    """Check if playwright.config.ts already has a 'setup' project."""
    if not config_path.exists():
        return False
    content = config_path.read_text(encoding='utf-8')
    return bool(re.search(r"name:\s*['\"]setup['\"]", content))


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Setup Playwright auth for session reuse')
    parser.add_argument('--testing-root', required=True, dest='testing_root',
                        help='Path to automation-testing root (e.g. apps/testing/automation-testing/fe-testing)')
    args = parser.parse_args()

    root = Path(args.testing_root)
    if not root.exists():
        print(f'❌ Testing root not found: {root}')
        sys.exit(1)

    env = read_env(root / '.env')

    # Validate required env vars
    username = env.get('UI_AUTH_USERNAME', '')
    if not username:
        print('⏭️  UI_AUTH_USERNAME not set in .env — skipping auth setup (public page)')
        sys.exit(0)

    print(f'🔐 Setting up auth for: {env.get("UI_BASE_URL", "localhost")}')

    # 1. Create .auth/ directory
    auth_dir = root / '.auth'
    auth_dir.mkdir(parents=True, exist_ok=True)
    print('   .auth/ directory: OK')

    # 2. Create setup/auth.setup.ts (do NOT overwrite — preserves manual edits)
    setup_dir = root / 'setup'
    setup_dir.mkdir(parents=True, exist_ok=True)
    setup_file = setup_dir / 'auth.setup.ts'
    if setup_file.exists():
        print(f'   {setup_file.relative_to(root)}: already exists — skipped (preserve manual edits)')
    else:
        setup_file.write_text(AUTH_SETUP_TS.lstrip(), encoding='utf-8')
        print(f'   {setup_file.relative_to(root)}: created')

    # 3. Patch playwright.config.ts (only if setup project missing)
    config_path = root / 'playwright.config.ts'
    if has_setup_project(config_path):
        print('   playwright.config.ts: setup project already exists — skipped')
    else:
        config_path.write_text(PLAYWRIGHT_CONFIG_TS.lstrip(), encoding='utf-8')
        print('   playwright.config.ts: updated with setup project + storageState')

    # 4. Ensure .gitignore
    ensure_gitignore(root)

    # 5. Preserve existing .auth/user.json — reuse session across runs.
    # To force a fresh login, delete .auth/user.json manually before running.
    stale = auth_dir / 'user.json'
    if stale.exists():
        print('   .auth/user.json: kept (reuse existing session). Delete manually to force fresh login.')
    else:
        print('   .auth/user.json: not present — first test run will perform login and save it.')

    print('✅ Auth setup complete. Tests will login once → reuse session for all test cases.')


if __name__ == '__main__':
    main()
