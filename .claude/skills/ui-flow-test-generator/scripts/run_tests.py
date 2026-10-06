#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 7 — Run Playwright UI tests and capture results.

Executes: npx playwright test <spec> --project="UI Tests" --retries 1 --reporter json

Writes:
  - report/ui/{date}/results.json (raw playwright output)

Exits with:
  0 = every test case passed, nothing pinned
  1 = some tests failed OR a test.fail()-pinned DEV-BUG is still open
      (report still generated — do not halt the workflow on this)
  2 = setup error (playwright not found, bad path etc.)

Usage:
    python3 run_tests.py \
        --date 2025-07-08 \
        --feature create-user \
        --working-dir apps/testing/automation-testing/fe-testing
"""

import argparse
import json
import os
import shutil
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

TODAY = datetime.now().strftime('%Y-%m-%d')


def find_spec_files(working_dir: str, date: str, feature: str = '') -> list[str]:
    """Find .spec.ts files — flat layout: script/ui/{feature}.spec.ts (no date subfolder)."""
    base = Path(working_dir) / 'script' / 'ui'
    if not base.exists():
        return []
    if feature:
        matches = list(base.glob(f'{feature}*.spec.ts'))
    else:
        matches = list(base.glob('*.spec.ts'))
    return [str(p) for p in matches]


def parse_json_results(json_path: str) -> dict:
    """Parse playwright JSON report into summary dict.

    Same counting semantics as generate_report.py — the two must never disagree:
      - the `setup` / `seed` projects are infrastructure, not test cases;
      - a `test.fail()`-pinned test is an OPEN DEV-BUG. Playwright marks it
        expected-failure, but it is not a pass: it gets its own `known_bug`
        bucket, stays in the denominator, and keeps the exit code non-zero.
    """
    if not Path(json_path).exists():
        return {}
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    suites = data.get('suites', [])
    total = 0
    passed = 0
    failed = 0
    skipped = 0
    did_not_run = 0
    known_bug = 0
    failures = []
    pinned_tests = []
    abandoned = []

    def walk(suite):
        nonlocal total, passed, failed, skipped, did_not_run, known_bug
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                if test.get('projectName') in ('setup', 'seed'):
                    continue
                total += 1
                results_list = test.get('results', [])
                result = results_list[0] if results_list else {}
                # Read the TEST-level status (expected|unexpected|flaky|skipped), not
                # results[0] — a skipped test carries an EMPTY results list, so keying
                # off the result would silently bucket it as a pass.
                status = test.get('status', 'unknown')
                pinned = any((a or {}).get('type') == 'fail'
                             for a in (test.get('annotations') or []))
                # Two different things wear status 'skipped'. An INTENTIONAL skip
                # (`test.skip(cond, 'why')` / `test.fixme`) leaves a skip annotation;
                # a test ABANDONED because its beforeEach/beforeAll threw leaves none.
                # Folding them together is how one dead fixture reads as "green with a
                # few skips" — keep them apart here exactly as generate_report.py does.
                skip_annotated = any((a or {}).get('type') in ('skip', 'fixme')
                                     for a in (test.get('annotations') or []))
                if status == 'skipped' and skip_annotated:
                    skipped += 1
                elif status == 'skipped':
                    did_not_run += 1
                    abandoned.append({'test': spec.get('title', '')})
                elif pinned:
                    known_bug += 1
                    pinned_tests.append({
                        'test': spec.get('title', ''),
                        'reason': next((a.get('description', '')
                                        for a in test.get('annotations') or []
                                        if (a or {}).get('type') == 'fail'), ''),
                    })
                elif status in ('expected', 'flaky'):
                    passed += 1
                else:
                    failed += 1
                    failures.append({
                        'test': spec.get('title', ''),
                        'error': result.get('error', {}).get('message', ''),
                        'duration': result.get('duration', 0),
                    })
        for child in suite.get('suites', []):
            walk(child)

    for s in suites:
        walk(s)

    # did_not_run leaves the denominator too: an unexecuted test proves nothing, so
    # counting it either way (pass or fail) would be a lie. It is surfaced separately
    # and makes the run non-clean below.
    executed = total - skipped - did_not_run
    pass_rate = round(passed / executed * 100, 1) if executed > 0 else 0
    return {
        'total': total,
        'passed': passed,
        'failed': failed,
        'skipped': skipped,
        'did_not_run': did_not_run,
        'abandoned': abandoned,
        'known_bug': known_bug,
        'executed': executed,
        'pass_rate': pass_rate,
        'failures': failures,
        'pinned_tests': pinned_tests,
        'raw': data,
    }


def verify_collection(spec_files: list[str], working_dir: str) -> None:
    """Fail fast when Playwright can't LOAD the specs.

    A pre-runtime error (missing fixture, TS error, bad config) doesn't show up as a
    failing test: Playwright aborts while collecting and then runs zero tests in every
    project — including `setup`, so `.auth/user.json` is never written. Downstream that
    reads as "auth setup failed", which is what sent us on a multi-day wild goose chase
    against the login flow. Surface it here, with the real message.
    """
    wdir = Path(working_dir).resolve()
    rel_specs = []
    for sf in spec_files:
        try:
            rel_specs.append(Path(sf).resolve().relative_to(wdir).as_posix())
        except ValueError:
            rel_specs.append(Path(sf).as_posix())

    npx_cmd = 'npx.cmd' if sys.platform == 'win32' else 'npx'
    res = subprocess.run(
        [npx_cmd, 'playwright', 'test', *rel_specs, '--project=UI Tests', '--list'],
        cwd=working_dir, capture_output=True, text=True, encoding='utf-8', errors='replace',
    )
    out = (res.stdout or '') + (res.stderr or '')
    m = re.search(r'^Total: (\d+) tests', out, re.M)
    total = int(m.group(1)) if m else 0
    if res.returncode != 0 or total == 0:
        # A PARKED spec collects 0 tests too, and it is not a load error at all —
        # playwright.config.ts `testIgnore` drops the file before it is ever parsed.
        # Saying "could not load" there sends the reader hunting a fixture or TS
        # error that does not exist, which is the same wrong trail the auth-failure
        # message above cost us. Name the real cause when we can see it.
        cfg = wdir / 'playwright.config.ts'
        parked = []
        if cfg.is_file():
            cfg_src = cfg.read_text(encoding='utf-8', errors='replace')
            parked = [Path(r).name for r in rel_specs
                      if re.search(r"^\s*'" + re.escape(Path(r).name) + r"',", cfg_src, re.M)]
        if parked:
            print('\n❌ PARKED SPEC — ' + ', '.join(parked) + ' is listed in the '
                  '`testIgnore` array of playwright.config.ts, so Playwright drops it from '
                  'collection and 0 tests run.', file=sys.stderr)
            print('   This is NOT a load error and NOT a test failure. Read the comment above '
                  'that entry for why it was parked; remove the line to re-enable the suite, '
                  'then run again.', file=sys.stderr)
            sys.exit(3)
        print('\n❌ COLLECTION ERROR — Playwright could not load the spec(s); 0 tests would run.',
              file=sys.stderr)
        print('   This is NOT a test failure and NOT an auth failure — no project runs at all,',
              file=sys.stderr)
        print('   so .auth/user.json is never created. Playwright says:\n', file=sys.stderr)
        print('\n'.join(out.strip().splitlines()[-25:]), file=sys.stderr)
        sys.exit(3)
    print(f'✓  Collection OK: {total} tests')


def run_playwright(spec_files: list[str], working_dir: str, json_out: str, no_deps: bool = False) -> tuple[int, str]:
    """Run playwright test and return (exit_code, stdout)."""
    # Convert absolute paths to relative (forward-slashes) to avoid regex issues on Windows
    wdir = Path(working_dir).resolve()
    rel_specs = []
    for s in spec_files:
        try:
            rel_specs.append(Path(s).resolve().relative_to(wdir).as_posix())
        except ValueError:
            rel_specs.append(Path(s).as_posix())

    spec_args = ' '.join(rel_specs)
    report_path = json_out

    npx_cmd = 'npx.cmd' if sys.platform == 'win32' else 'npx'
    cmd = [
        npx_cmd, 'playwright', 'test',
        *rel_specs,
        '--project=UI Tests',
        '--retries=1',
        '--reporter=json',
    ]
    if no_deps:
        cmd.append('--no-deps')
    env = {**os.environ, 'PLAYWRIGHT_JSON_OUTPUT_NAME': report_path}
    # FEATURE env var is consumed by playwright.config.ts to group results per feature.
    feature_env = os.environ.get('FEATURE') or os.environ.get('UI_FEATURE')
    if feature_env:
        env['FEATURE'] = feature_env

    print(f'▶  Running: npx playwright test {spec_args}')
    print(f'   Working dir: {working_dir}')

    result = subprocess.run(
        cmd,
        cwd=working_dir,
        env=env,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    if result.stdout:
        print(result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout)
    if result.returncode != 0 and result.stderr:
        print('STDERR:', result.stderr[-1000:], file=sys.stderr)

    return result.returncode, result.stdout


def main():
    parser = argparse.ArgumentParser(description='Run Playwright UI tests')
    parser.add_argument('--date', default=TODAY)
    parser.add_argument('--feature', default='', help='Feature slug to filter spec files')
    parser.add_argument('--working-dir', default='apps/testing/automation-testing/fe-testing', dest='working_dir')
    parser.add_argument('--spec-files', nargs='*', default=[], dest='spec_files',
                        help='Override spec files directly (absolute paths)')
    parser.add_argument('--no-deps', action='store_true', dest='no_deps',
                        help='Skip setup dependencies (--no-deps). Use when login is broken '
                             'but .auth/user.json has a valid session.')
    args = parser.parse_args()

    wdir = Path(args.working_dir).resolve()
    if not wdir.exists():
        print(f'❌ Working dir not found: {wdir}', file=sys.stderr)
        sys.exit(2)

    spec_files = args.spec_files or find_spec_files(str(wdir), args.date, args.feature)
    if not spec_files:
        print(f'❌ No spec files found under script/ui/ (feature={args.feature or "*"})', file=sys.stderr)
        sys.exit(2)

    print(f'🧪 Found {len(spec_files)} spec file(s): {", ".join(Path(s).name for s in spec_files)}')

    # Layout: report/ui/{date}/{feature}/results.json  (report/ lives INSIDE fe-testing/)
    # Falls back to "_unknown" when --feature is empty (mirrors playwright.config.ts).
    feature_slug = args.feature or '_unknown'
    os.environ['FEATURE'] = feature_slug
    report_dir = wdir / 'report' / 'ui' / args.date / feature_slug
    report_dir.mkdir(parents=True, exist_ok=True)
    json_out = str(report_dir / 'results.json')

    verify_collection(spec_files, str(wdir))
    exit_code, _ = run_playwright(spec_files, str(wdir), json_out, no_deps=args.no_deps)

    # Playwright writes JSON to PLAYWRIGHT_JSON_OUTPUT_NAME
    summary = parse_json_results(json_out)

    print()
    print('=' * 60)
    if summary:
        print(f'✅ Passed: {summary["passed"]} / {summary["executed"]} executed '
              f'({summary["pass_rate"]}%) — {summary["total"]} test case(s)')
        if summary['failed']:
            print(f'❌ Failed: {summary["failed"]}')
            for f in summary['failures'][:5]:
                print(f'  ✗ {f["test"]}')
                if f['error']:
                    print(f'    → {f["error"][:120]}')
        if summary['known_bug']:
            print(f'🐞 Known bugs (test.fail-pinned, NOT passes): {summary["known_bug"]}')
            for p in summary['pinned_tests'][:5]:
                print(f'  🐞 {p["test"]}')
                if p['reason']:
                    print(f'    → {p["reason"][:120]}')
        if summary['skipped']:
            print(f'⏭  Skipped: {summary["skipped"]}')
        if summary.get('did_not_run'):
            print(f'⚠️  Did NOT run: {summary["did_not_run"]} '
                  f'(hook/fixture died — coverage UNPROVEN, not a skip)')
            for a in summary['abandoned'][:5]:
                print(f'  ⚠️ {a["test"]}')
        print(f'📄 Results: {json_out}')
    else:
        print('⚠️  No results JSON found — check Playwright output above')
    print('=' * 60)

    # Housekeeping: remove the orphan `_unknown/` report dir left behind by ad-hoc
    # direct `npx playwright test` runs (the config json reporter falls back to
    # `_unknown` when FEATURE is unset). This run never writes there — it uses
    # `--reporter=json` + PLAYWRIGHT_JSON_OUTPUT_NAME + FEATURE — so deleting it
    # only clears orphans and never touches legitimate per-feature results.
    if feature_slug != '_unknown':
        unknown_dir = wdir / 'report' / 'ui' / args.date / '_unknown'
        if unknown_dir.exists():
            shutil.rmtree(unknown_dir, ignore_errors=True)
            print(f'🧹 Removed orphan report dir: {unknown_dir}')

    # Playwright exits 0 when every failure is `test.fail()`-pinned. That is NOT a clean
    # run — those are open DEV-BUGs, so never print "all tests passed" over them.
    # An abandoned test is unproven coverage: never let the run print "all passed".
    if summary.get('did_not_run'):
        print(f'\n⚠️  {summary["did_not_run"]} test(s) never executed — a failing '
              f'beforeEach/beforeAll abandoned them. Fix the fixture and re-run; '
              f'this run cannot speak for that coverage.')
        sys.exit(1)
    if summary.get('known_bug'):
        print(f'\n⚠️  {summary["known_bug"]} open DEV-BUG(s) still failing (pinned). '
              f'Not a clean run — report verdict will be CONDITIONAL at best.')
        sys.exit(1)
    if exit_code == 0:
        print('\n✅ All tests passed.')
        sys.exit(0)
    else:
        print(f'\n❌ Tests finished with exit code {exit_code}.')
        sys.exit(1)


if __name__ == '__main__':
    main()
