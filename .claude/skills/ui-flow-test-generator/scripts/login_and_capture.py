#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
login_and_capture.py — Automatically log into a web app using Playwright
and capture the HTML of a target page after authentication.

Used as a replacement for the fetch_html step in analyze_page.py when a
page requires login.

Usage:
    python3 login_and_capture.py --url http://localhost:3000/tasks/mine
    python3 login_and_capture.py --url http://localhost:3000/tasks/mine \\
        --login-url http://localhost:3000/auth/signin \\
        --username admin@example.com \\
        --password secret \\
        --out authed-page.html

Output:
    An HTML file containing the page content after login. Use this file as
    input to analyze_page.py:
        python3 analyze_page.py --url authed-page.html --out element-map.json

Environment variables (loaded from the nearest .env if CLI args are absent):
    UI_AUTH_USERNAME  - username/email for login
    UI_AUTH_PASSWORD  - password for login
    UI_BASE_URL       - base URL of the app (used to derive login URL)
    LOGIN_URL         - explicit login page URL (overrides UI_BASE_URL + /auth/signin)
    HEADLESS          - true/false (default: true)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


# ── .env loader ───────────────────────────────────────────────────────────────

def load_dotenv(env_path: Path) -> None:
    """Parse and load a .env file into os.environ (do not overwrite existing vars)."""
    if not env_path.exists():
        return
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            # Strip inline comments and quotes
            value = value.split('#')[0].strip().strip('"\'')
            os.environ.setdefault(key.strip(), value)


def find_and_load_dotenv() -> None:
    """Search for a .env file from the current directory up to the filesystem root."""
    cwd = Path.cwd()
    for directory in [cwd, *cwd.parents]:
        env_file = directory / '.env'
        if env_file.exists():
            load_dotenv(env_file)
            return


# ── Login URL helper ─────────────────────────────────────────────────────────

# Selector fallbacks for username/email field
EMAIL_SELECTORS = [
    '#email',
    'input[name="email"]',
    'input[type="email"]',
    'input[name="username"]',
    '#username',
    'input[placeholder*="email" i]',
    'input[placeholder*="username" i]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
]

# Selector fallbacks for password field
PASSWORD_SELECTORS = [
    '#password',
    'input[name="password"]',
    'input[type="password"]',
    'input[placeholder*="password" i]',
    'input[autocomplete="current-password"]',
]

# Selector fallbacks for submit button
SUBMIT_SELECTORS = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Login")',
    'button:has-text("Log in")',
    'button:has-text("Đăng nhập")',
    '[data-testid*="submit"]',
    '[data-testid*="login"]',
]


def derive_login_url(target_url: str) -> str:
    """
    Derive the login URL from the target URL.
    Priority: LOGIN_URL env var → UI_BASE_URL env var → try common login paths.
    """
    env_login = os.environ.get('LOGIN_URL', '').strip()
    if env_login:
        return env_login

    base = os.environ.get('UI_BASE_URL', '').strip()
    if base:
        return urljoin(base.rstrip('/') + '/', 'auth/signin')

    # Use the origin of the target URL
    parsed = urlparse(target_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return urljoin(origin + '/', 'auth/signin')


# ── Playwright login core ─────────────────────────────────────────────────────

def find_selector(page, selectors: list[str], timeout_ms: int = 3000) -> str | None:
    """Return the first selector found on the page, or None."""
    for sel in selectors:
        try:
            page.wait_for_selector(sel, timeout=timeout_ms, state='visible')
            return sel
        except Exception:
            continue
    return None


def is_login_page(page, login_url: str) -> bool:
    """Check whether the current page appears to be the login page."""
    current = page.url.lower()
    parsed_login = urlparse(login_url.lower())
    # If the current URL contains the login path → still on the login page
    return parsed_login.path in current


def do_login(page, login_url: str, username: str, password: str) -> bool:
    """Perform the login flow. Returns True if login succeeds."""
    print(f"🔐 Navigating to login page: {login_url}")
    page.goto(login_url, wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(1500)  # Wait for JS hydration

    # Find email/username field
    email_sel = find_selector(page, EMAIL_SELECTORS)
    if not email_sel:
        print("❌ Email/username field not found. Check the login URL or selectors.")
        return False

    # Find password field
    pass_sel = find_selector(page, PASSWORD_SELECTORS)
    if not pass_sel:
        print("❌ Password field not found.")
        return False

    print(f"   Email selector   : {email_sel}")
    print(f"   Password selector: {pass_sel}")

    page.fill(email_sel, username)
    page.fill(pass_sel, password)
    print(f"   Filled credentials for: {username}")

    # Find and click the submit button
    submit_sel = find_selector(page, SUBMIT_SELECTORS)
    if submit_sel:
        print(f"   Submit selector  : {submit_sel}")
        page.click(submit_sel)
    else:
        # Fallback: press Enter on the password field
        print("   ⚠️  Submit button not found. Trying Enter key...")
        page.press(pass_sel, 'Enter')

    # Wait for navigation after submit
    # Prefer waiting for the URL to leave the login page (works well with SPA/NextAuth/Vercel)
    login_path = urlparse(login_url).path.lower()
    try:
        # Wait for URL to change away from the login page (25s timeout for remote/Vercel)
        page.wait_for_url(
            lambda url: login_path not in url.lower(),
            timeout=25000
        )
        print(f"   URL changed → {page.url}")
    except Exception:
        # Fallback: wait for networkidle then check
        try:
            page.wait_for_load_state('networkidle', timeout=10000)
        except Exception:
            pass
        page.wait_for_timeout(2000)

    # Verify login success (URL no longer contains the login path)
    current_url = page.url
    if is_login_page(page, login_url):
        # Try to fetch any error message
        error_text = None
        for err_sel in ['[class*="error"]', '[class*="alert"]', '[role="alert"]', '[class*="invalid"]']:
            try:
                el = page.locator(err_sel).first
                if el.is_visible():
                    error_text = el.inner_text()
                    break
            except Exception:
                continue
        if error_text:
            print(f"   ❌ Login failed. Error: {error_text.strip()[:200]}")
        else:
            print(f"   ❌ Login failed. Still on login page: {current_url}")
        return False

    print(f"   ✅ Login successful. Redirected to: {current_url}")
    return True


def capture_page(page, target_url: str, out_path: Path, wait_ms: int = 2000) -> str:
    """
    Navigate to the target URL after authentication and save the HTML.
    """
    print(f"📄 Loading target page: {target_url}")
    try:
        page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
    except Exception as e:
        # If domcontentloaded times out, try to capture the current state anyway
        print(f"   ⚠️  domcontentloaded timeout, capturing current state: {e}")
    page.wait_for_timeout(wait_ms)  # Add extra time for JS rendering

    final_url = page.url
    if final_url != target_url:
        print(f"   ℹ️  Final URL (after redirects): {final_url}")

    html = page.content()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"   ✅ Saved HTML: {out_path} ({len(html):,} bytes)")
    return html


def resolve_auth_file() -> Path | None:
    """Resolve the .auth/user.json path. Checks cwd first, then TESTING_ROOT."""
    # Check cwd/.auth/user.json first (most common — cwd is already the testing root)
    cwd_auth = Path.cwd() / '.auth' / 'user.json'
    if cwd_auth.exists():
        return cwd_auth
    # Fallback: TESTING_ROOT env var (may be relative to repo root)
    testing_root = os.environ.get('TESTING_ROOT', '').strip()
    if testing_root:
        auth_path = Path(testing_root) / '.auth' / 'user.json'
        if auth_path.exists():
            return auth_path
    return None


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    find_and_load_dotenv()

    parser = argparse.ArgumentParser(
        description='Login via Playwright and capture authenticated page HTML.'
    )
    parser.add_argument('--url', required=True,
                        help='Target page URL to capture after login')
    parser.add_argument('--login-url', default=None,
                        help='Login page URL (default: derived from UI_BASE_URL or target URL)')
    parser.add_argument('--username', default=None,
                        help='Username/email (default: UI_AUTH_USERNAME env var)')
    parser.add_argument('--password', default=None,
                        help='Password (default: UI_AUTH_PASSWORD env var)')
    parser.add_argument('--out', default='authed-page.html',
                        help='Output HTML file path (default: authed-page.html)')
    parser.add_argument('--wait-ms', type=int, default=2000,
                        help='Extra wait (ms) after page load for JS rendering (default: 2000)')
    parser.add_argument('--headless', action='store_true', default=None,
                        help='Run browser in headless mode (default: true)')
    parser.add_argument('--no-headless', dest='headless', action='store_false',
                        help='Run browser in visible (headed) mode for debugging')
    parser.add_argument('--skip-login', action='store_true',
                        help='Skip login step (capture page without authentication)')
    parser.add_argument('--storage-state', default=None, dest='storage_state',
                        help='Path to Playwright storage-state JSON (e.g. .auth/user.json). '
                             'Loads saved cookies/session instead of logging in. '
                             'Use when login is broken but a valid session exists.')
    args = parser.parse_args()

    # Resolve credentials
    username = args.username or os.environ.get('UI_AUTH_USERNAME', '')
    password = args.password or os.environ.get('UI_AUTH_PASSWORD', '')
    login_url = args.login_url or derive_login_url(args.url)

    # Headless mode
    env_headless = os.environ.get('HEADLESS', 'true').lower()
    headless = args.headless if args.headless is not None else (env_headless != 'false')

    # Resolve storage-state: check CLI flag → env var → auto-detect .auth/user.json
    storage_state = args.storage_state or os.environ.get('AUTH_STORAGE_STATE', '').strip() or None
    
    # Auto-detect .auth/user.json if no explicit storage-state provided
    if not storage_state:
        detected = resolve_auth_file()
        if detected:
            storage_state = str(detected)
            print(f"🔄 Auto-detected saved session: {detected}")
    
    if storage_state:
        storage_state_path = Path(storage_state)
        if not storage_state_path.exists():
            # Auto-fall back to fresh login when the referenced session file is missing.
            # Typical cause: user deleted .auth/user.json to force a re-login but kept
            # AUTH_STORAGE_STATE in .env for the next successful session.
            print(f"⚠️  Storage state file not found: {storage_state} → falling back to fresh login")
            storage_state_path = None
            storage_state = None
    else:
        storage_state_path = None

    # Validate credentials (only needed when no storage-state and no skip-login)
    if not args.skip_login and not storage_state:
        if not username:
            print("❌ Username cannot be empty. Pass --username or set UI_AUTH_USERNAME in .env")
            sys.exit(1)
        if not password:
            print("❌ Password cannot be empty. Pass --password or set UI_AUTH_PASSWORD in .env")
            sys.exit(1)

    out_path = Path(args.out)

    # Import playwright
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("❌ Playwright is not installed. On Debian/Ubuntu: sudo apt install python3-playwright (or `python3 -m pip install --user playwright` outside a PEP 668 system Python), then: python3 -m playwright install chromium")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"🌐 UI Flow Test Generator — Login & Capture")
    print(f"{'='*60}")
    print(f"   Target URL : {args.url}")
    if storage_state:
        print(f"   Auth mode  : storage-state ({storage_state})")
    elif not args.skip_login:
        print(f"   Login URL  : {login_url}")
        print(f"   Username   : {username}")
        print(f"   Headless   : {headless}")
    else:
        print(f"   Auth mode  : skip-login (no auth)")
    print(f"   Output     : {out_path}")
    print(f"{'='*60}\n")

    start = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)

        def make_context(with_storage_state: str | None = None):
            ctx_kwargs = {'viewport': {'width': 1280, 'height': 800}}
            if with_storage_state:
                ctx_kwargs['storage_state'] = with_storage_state
            ctx = browser.new_context(**ctx_kwargs)
            pg = ctx.new_page()
            pg.on('console', lambda msg: (
                print(f"   [BROWSER {msg.type.upper()}] {msg.text[:200]}")
                if msg.type in ('error', 'warning') else None
            ))
            return ctx, pg

        try:
            if storage_state:
                # Explicit --storage-state flag: use directly, no fallback
                print(f"🔑 Using saved session from: {storage_state}")
                context, page = make_context(str(storage_state_path))
                html = capture_page(page, args.url, out_path, args.wait_ms)

            elif args.skip_login:
                print("⏭️  Skipping login (--skip-login flag set)")
                context, page = make_context()
                html = capture_page(page, args.url, out_path, args.wait_ms)

            else:
                # Default: fresh login → save session for future reuse
                print(f"🔐 Performing fresh login...")
                context, page = make_context()
                success = do_login(page, login_url, username, password)
                if not success:
                    print("\n❌ Login failed. See error above.")
                    debug_path = out_path.parent / f"login-failed-{out_path.stem}.html"
                    with open(debug_path, 'w', encoding='utf-8') as f:
                        f.write(page.content())
                    print(f"   Debug HTML saved: {debug_path}")
                    sys.exit(2)
                # Save session for future reuse
                save_path = resolve_auth_file() or (Path.cwd() / '.auth' / 'user.json')
                save_path.parent.mkdir(parents=True, exist_ok=True)
                context.storage_state(path=str(save_path))
                print(f"   💾 Session saved: {save_path}")
                html = capture_page(page, args.url, out_path, args.wait_ms)

        finally:
            context.close()
            browser.close()

    elapsed = time.time() - start
    print(f"\n✅ Done in {elapsed:.1f}s — HTML saved to: {out_path}")
    print(f"\n💡 Next, run analyze_page.py:")
    print(f"   python3 analyze_page.py --url {out_path} --out element-map.json")


if __name__ == '__main__':
    main()
