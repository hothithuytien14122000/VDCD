#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Preflight gate — two phases.

  --phase env  (Step 0b, after config is resolved at Step 0a)  deps + file/env + credential
  --phase api  (Step 5.5, real mode)    feature endpoint reachable + has data

Both fail fast with a typed diagnostic so downstream failures aren't misread as
test bugs. The MCP check is NOT here (a script cannot see MCP tools) — Step 0c in
SKILL.md covers it with a real get_work_items call.

Exit codes:
  0  ok (warnings may still be printed)
  1  failure — stderr says which precondition broke and how to fix it

Usage:
    python3 preflight.py --phase env --testing-root apps/testing/automation-testing/fe-testing
    python3 preflight.py --phase api --spec-yaml spec/ui/{feature}-spec.yaml \
                        --base-url https://dev.mgios.com \
                        [--auth-state .auth/user.json] [--timeout 5]
"""
import argparse
import json
import subprocess
import sys
from http.cookiejar import CookieJar, Cookie
from pathlib import Path
from urllib import request, error

try:
    import yaml
except ImportError:
    print('preflight: pyyaml not installed — run: pip install pyyaml', file=sys.stderr)
    sys.exit(1)

APP_CONFIG_PATH = '/api/abp/application-configuration'


def fail(msg: str) -> int:
    print(f'preflight: {msg}', file=sys.stderr)
    return 1


def read_env_file(testing_root: Path) -> dict:
    env = {}
    path = testing_root / '.env'
    if not path.exists():
        return env
    lines, buf = [], ''
    for raw in path.read_text(encoding='utf-8').splitlines():
        buf += raw.strip()
        if buf.endswith('\\'):        # multi-line value (SPEC_FILES=\ …)
            buf = buf[:-1]
            continue
        lines.append(buf)
        buf = ''
    for line in lines:
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def cookie_jar(auth_state: str | None) -> CookieJar:
    jar = CookieJar()
    if auth_state and Path(auth_state).exists():
        with open(auth_state, 'r', encoding='utf-8') as f:
            state = json.load(f)
        for c in (state.get('cookies') or []):
            jar.set_cookie(Cookie(
                version=0, name=c.get('name', ''), value=c.get('value', ''),
                port=None, port_specified=False,
                domain=c.get('domain', ''), domain_specified=True, domain_initial_dot=False,
                path=c.get('path', '/'), path_specified=True,
                secure=c.get('secure', False), expires=None, discard=True,
                comment=None, comment_url=None, rest={}, rfc2109=False,
            ))
    return jar


def get_json(url: str, auth_state: str | None, timeout: float):
    """Returns (status, parsed_body_or_None). Raises on transport errors."""
    opener = request.build_opener(request.HTTPCookieProcessor(cookie_jar(auth_state)))
    with opener.open(url, timeout=timeout) as resp:
        raw = resp.read()
        try:
            return resp.status, json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            return resp.status, None


# ── phase: env ──────────────────────────────────────────────────────────────

def phase_env(args) -> int:
    root = Path(args.testing_root)
    if not root.is_dir():
        return fail(f'TESTING_ROOT not a directory: {root}')

    env = read_env_file(root)
    spec_files = args.spec_files or env.get('SPEC_FILES') or env.get('SPEC_FILE') or ''
    page_url = args.page_url or env.get('PAGE_URL') or ''
    base_url = args.base_url or env.get('UI_BASE_URL') or ''

    # 1. file / env
    if not spec_files:
        return fail('SPEC_FILE / SPEC_FILES not set (.env or --spec-files)')
    for p in [s.strip() for s in spec_files.split(',') if s.strip()]:
        if not Path(p).is_file():
            return fail(f'spec source not found: {p}')
    if not page_url:
        return fail('PAGE_URL not set')
    if page_url.startswith(('http://', 'https://')):
        return fail(f'PAGE_URL must be root-relative, host comes from UI_BASE_URL: {page_url}')
    if not page_url.startswith('file://') and not base_url:
        return fail('UI_BASE_URL required when PAGE_URL is not file://')
    if not (root / 'playwright.config.ts').is_file():
        return fail(f'playwright.config.ts missing in {root}')
    # Generated specs import extendedTimeoutMs from here (every test/describe ceiling
    # reads PLAYWRIGHT_EXTENDED_TIMEOUT through it). A missing file makes every emitted
    # spec fail at COLLECTION, which Playwright reports as an auth failure, not an
    # unresolved import — catch it here instead.
    if not (root / 'lib' / 'timeouts.ts').is_file():
        return fail(f'lib/timeouts.ts missing in {root} (generated specs import extendedTimeoutMs from it)')

    # 2. deps
    if not (root / 'node_modules').is_dir():
        return fail(f'node_modules missing — run: cd {root} && npm install')
    # `npx playwright --version` only proves the npm package resolves — it says nothing
    # about the browser binary, which is what Step 8 actually launches.
    probe = ("const {chromium} = require('@playwright/test');"
             "process.stdout.write(chromium.executablePath())")
    try:
        out = subprocess.run(['node', '-e', probe], cwd=root, timeout=120,
                             capture_output=True, check=True, text=True).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return fail(f'@playwright/test not resolvable — run: cd {root} && npm install')
    if not out or not Path(out).exists():
        return fail(f'chromium binary missing ({out or "no path"}) — '
                    f'run: cd {root} && npx playwright install')

    # 3. credential
    auth_state = root / (args.auth_state or '.auth/user.json')
    if not auth_state.exists():
        # Fresh-login path: Step 5 will log in, so the full credential set must be present.
        # UI_AUTH_TENANT is the easy one to forget and it lands the whole run on /unauthorized.
        missing = [k for k in ('UI_AUTH_USERNAME', 'UI_AUTH_PASSWORD', 'UI_AUTH_TENANT')
                   if not env.get(k)]
        if missing:
            return fail(f'no {auth_state} and .env is missing {", ".join(missing)} — '
                        f'Step 5 cannot log in (a missing tenant lands on /unauthorized, '
                        f'which reads like an RBAC defect but is not one)')
        print(f'preflight[env]: no {auth_state} yet — Step 5 will log in as {env["UI_AUTH_USERNAME"]}')
    elif not base_url:
        print('preflight[env]: auth state present but no UI_BASE_URL — skipping session probe')
    else:
        url = base_url.rstrip('/') + APP_CONFIG_PATH
        # Probed twice: this endpoint has been observed returning an unauthenticated payload
        # on one call and a fully-granted one seconds later on the same cookies. One sample
        # is not enough to condemn a session — a false halt here blocks a valid run.
        for attempt in (1, 2):
            try:
                status, body = get_json(url, str(auth_state), args.timeout)
            except error.HTTPError as e:
                return fail(f'{e.code} on {url} — session expired; delete {auth_state} and re-run')
            except (error.URLError, TimeoutError) as e:
                return fail(f'cannot reach {url} ({e}) — backend down / wrong UI_BASE_URL')
            body = body or {}
            granted = (body.get('auth') or {}).get('grantedPolicies') or {}
            authed = (body.get('currentUser') or {}).get('isAuthenticated')
            if status == 200 and granted:
                break
            if attempt == 1:
                print(f'preflight[env]: app-config returned no policies — retrying once')
        if status != 200 or not granted:
            cause = ('session expired (currentUser.isAuthenticated=false)' if authed is False
                     else 'authenticated but zero grantedPolicies — app-config failure (#147541)')
            return fail(
                f'{cause}. Delete {auth_state} and re-run so Step 5 logs in fresh; '
                f'do NOT report the resulting 403 / "no access" screens as defects.')
        print(f'preflight[env]: session OK ({len(granted)} granted policies)')

    # 4. the route under test actually serves the page it claims to
    if base_url and not page_url.startswith('file://'):
        rc = probe_route(base_url, page_url, str(auth_state) if auth_state.exists() else None,
                         args.timeout)
        if rc:
            return rc

    print('preflight[env]: OK')
    return 0


def probe_route(base_url: str, page_url: str, auth_state: str | None, timeout: float) -> int:
    """A VIF `**Route:**` is often machine-guessed, and a live route can 30x elsewhere
    (#148133). Generating 40 TCs against a URL that serves a different screen is the
    most expensive failure this gate can prevent."""
    want = '/' + page_url.lstrip('/')
    url = base_url.rstrip('/') + want

    # Inspect the FIRST hop only. A next.config rewrite (308) fires ahead of the auth
    # middleware (307 → /auth/signin), so this catches a mis-pointed route even before
    # Step 5 has a session — following redirects would just show sign-in for everything.
    class _NoRedirect(request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None

    # Build the opener from scratch: reusing a pre-built one keeps urllib's default
    # HTTPRedirectHandler in the chain, it wins over _NoRedirect, and the 308 this check
    # exists to catch gets silently followed into a 200 "route OK".
    opener = request.build_opener(request.HTTPCookieProcessor(cookie_jar(auth_state)),
                                  _NoRedirect())
    try:
        with opener.open(url, timeout=timeout) as resp:
            print(f'preflight[env]: route OK ({resp.status}) {want}')
            return 0
    except error.HTTPError as e:
        code, loc = e.code, (e.headers.get('Location') or '')
    except (error.URLError, TimeoutError) as e:
        return fail(f'cannot reach {url} ({e}) — frontend down / wrong UI_BASE_URL')

    if code >= 400:
        return fail(f'{code} on {url} — PAGE_URL does not serve a page; the spec\'s '
                    f'**Route:** may be wrong (it is often machine-guessed)')
    dest = loc.split('?')[0].replace(base_url.rstrip('/'), '') or '/'
    if '/auth/signin' in dest or '/login' in dest:
        if auth_state:
            return fail(f'{want} bounces to {dest} with a session present — session not accepted')
        print(f'preflight[env]: {want} hits the auth gate ({code} → {dest}) — no config-level '
              f'rewrite, but route existence is unproven until Step 5 has a session')
        return 0
    return fail(f'{want} {code}-redirects to {loc} — the page under test is NOT the one PAGE_URL '
                f'names (#148133 class). Confirm the real route before generating TCs, and do NOT '
                f'silently repoint PAGE_URL: a redirect away from the spec route is itself a '
                f'reportable finding.')


# ── phase: api ──────────────────────────────────────────────────────────────

def first_get_endpoint(spec_path: str) -> str | None:
    with open(spec_path, 'r', encoding='utf-8') as f:
        spec = yaml.safe_load(f) or {}
    for c in (spec.get('api_contracts') or []):
        ep = (c.get('endpoint') or '').strip()
        if ep and (c.get('method') or 'GET').upper() == 'GET':
            return ep
    return None


def row_count(body) -> int | None:
    """Best-effort row count for the common list DTO shapes."""
    if isinstance(body, list):
        return len(body)
    if isinstance(body, dict):
        for key in ('items', 'data', 'results'):
            v = body.get(key)
            if isinstance(v, list):
                return len(v)
            if isinstance(v, dict) and isinstance(v.get('items'), list):
                return len(v['items'])
    return None


def phase_api(args) -> int:
    if not args.spec_yaml or not args.base_url:
        return fail('--phase api requires --spec-yaml and --base-url')

    endpoint = first_get_endpoint(args.spec_yaml)
    if not endpoint:
        print('preflight[api]: no GET endpoint in spec.api_contracts — skipping (soft pass)')
        return 0

    url = args.base_url.rstrip('/') + '/' + endpoint.lstrip('/')
    try:
        status, body = get_json(url, args.auth_state, args.timeout)
    except error.HTTPError as e:
        if e.code == 400:
            try:
                errs = json.loads(e.read()).get('error', {}).get('validationErrors') or []
                fields = ', '.join(m for v in errs for m in (v.get('members') or []))
            except (ValueError, UnicodeDecodeError):
                fields = ''
            return fail(f'400 on {url} — required query param(s) missing'
                        + (f': {fields}. ' if fields else '. ')
                        + 'Append them to the endpoint in spec.api_contracts '
                          '(e.g. "/api/knowledge/sops?BoundedContextName=KNW") so the '
                          'preflight — and the TCs derived from it — hit a callable URL.')
        hint = {401: 'auth expired — delete .auth/user.json',
                403: 'RBAC — current user lacks permission for this endpoint',
                404: 'endpoint not found — check spec.api_contracts path'}
        return fail(f'{e.code} on {url} — {hint.get(e.code, f"HTTP {e.code}")}')
    except (error.URLError, TimeoutError) as e:
        return fail(f'cannot reach {url} ({e}) — backend down / wrong UI_BASE_URL / CORS')

    if not 200 <= status < 300:
        return fail(f'HTTP {status} on {url}')

    n = row_count(body)
    if n == 0 and not args.allow_empty:
        return fail(f'reachable but 0 rows at {url} — every data-dependent assertion would pass '
                    f'vacuously against an empty list and the run would report a false GO. '
                    f'Seed first (Step 5.6), or pass --allow-empty if this feature is genuinely '
                    f'being tested in its empty state.')
    print(f'preflight[api]: OK ({status}) {url}' + (f' — {n} rows' if n is not None else ''))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--phase', choices=['env', 'api'], required=True)
    ap.add_argument('--testing-root', default='apps/testing/automation-testing/fe-testing')
    ap.add_argument('--spec-files')
    ap.add_argument('--page-url')
    ap.add_argument('--spec-yaml')
    ap.add_argument('--base-url')
    ap.add_argument('--auth-state', default='.auth/user.json')
    ap.add_argument('--allow-empty', action='store_true',
                    help='phase api: accept a 0-row list (feature tested in its empty state)')
    ap.add_argument('--timeout', type=float, default=5.0)
    args = ap.parse_args()
    return phase_env(args) if args.phase == 'env' else phase_api(args)


if __name__ == '__main__':
    sys.exit(main())
