#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 8 — Generate UI Automation Test Report (.md with inline HTML).

Same 5-section HTML format as API Test Generator (consistent AzDO comment appearance):

  1. Overview      — HTML table: Feature, User Story, Page URL, Browser, Date,
                     Pass Rate, Duration, GO/NO-GO
  2. Business Impact — HTML list: UF-xxx flow acceptance bullets; critical path
                       impact; per-spec rule group
  3. Test Results  — pass/fail/skip tally; compact summary table (#, TC ID,
                     Title, Priority, Status, Duration, Spec Ref); + one rich
                     detail card per test case (Type, Priority, Preconditions,
                     Test Data, Steps, Expected, Actual). PASS → "Matched
                     expected"; FAIL → real error + Root Cause + Fix + Severity
  4. Evidence      — HTML list: paths to results.json, html-report, test-cases/,
                     scripts, screenshots/videos
  5. Notes         — Playwright execution info; recommendations; re-test command

Usage:
    python3 generate_report.py \
        --results report/ui/2026-03-10/results.json \
        --testcases test-cases/ui/create-user-test-cases.yaml \
        --page-url "http://localhost:4200/users/create" \
        --date 2026-03-10 \
        --feature create-user \
        --feature-title "Create User" \
        --work-item-id 140427 \
        --script-path script/ui/2026-03-10/create-user.spec.ts \
        --out report/ui/2026-03-10/ui-report.md
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import yaml as _yaml
    _HAS_YAML = True
except ImportError:
    _HAS_YAML = False

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

TODAY = datetime.now().strftime('%Y-%m-%d')


# ── Loaders ───────────────────────────────────────────────────────────────────

def load_results(path: str) -> dict:
    if not path or not Path(path).exists():
        return {}
    with open(path, 'r', encoding='utf-8-sig') as f:
        return json.load(f)


def parse_test_cases(path: str) -> list[dict]:
    """Parse test case YAML file into list of dicts with full step info."""
    if not path or not Path(path).exists():
        return []
    if not _HAS_YAML:
        print('\u274c pyyaml not installed. Run: pip install pyyaml')
        return []
    with open(path, 'r', encoding='utf-8') as f:
        data = _yaml.safe_load(f)
    tcs = []
    for tc in (data or {}).get('test_cases', []):
        # Keep both action and its expected_result per step for richer detail cards.
        steps = []
        for s in tc.get('test_steps', []):
            steps.append({
                'action': s.get('action', ''),
                'expected': s.get('expected_result', ''),
            })
        tcs.append({
            'id': tc.get('id', 'TC-?'),
            'title': tc.get('title', ''),
            'flow': tc.get('flow', ''),
            'priority': tc.get('priority', 'Medium'),
            'spec_ref': tc.get('spec_ref', ''),
            'expected': tc.get('expected_result', ''),
            'steps': steps,
            'type': tc.get('type', 'Positive'),
            'test_data': tc.get('test_data', {}) or {},
            'preconditions': tc.get('preconditions', []) or [],
            'covered_by': tc.get('covered_by'),
        })
    return tcs


def warn_sparse_test_cases(tcs: list[dict], path: str) -> None:
    """Loudly warn when TCs lack preconditions/steps/test_data — these render as an
    em-dash ('—') in the report detail cards, which reads as "unspecified" and is
    almost always an authoring miss (a hand-authored slim YAML), not intent.
    generate_test_cases.py always emits the three keys; a gap here means the YAML was
    edited/authored by hand and dropped them."""
    if not tcs:
        return
    missing_pre = [tc['id'] for tc in tcs if not tc.get('preconditions')]
    missing_steps = [tc['id'] for tc in tcs if not tc.get('steps')]
    missing_data = [tc['id'] for tc in tcs if not tc.get('test_data')]
    if not (missing_pre or missing_steps or missing_data):
        return
    n = len(tcs)
    print('⚠️  Sparse test cases detected in ' + (path or 'test-cases YAML') + ':')
    if missing_pre:
        print(f'   • {len(missing_pre)}/{n} missing `preconditions` (Preconditions → "—"): '
              + ', '.join(missing_pre[:8]) + (' …' if len(missing_pre) > 8 else ''))
    if missing_steps:
        print(f'   • {len(missing_steps)}/{n} missing `test_steps`   (Steps → "—"): '
              + ', '.join(missing_steps[:8]) + (' …' if len(missing_steps) > 8 else ''))
    if missing_data:
        print(f'   • {len(missing_data)}/{n} missing `test_data`    (Test Data → "None"): '
              + ', '.join(missing_data[:8]) + (' …' if len(missing_data) > 8 else ''))
    print('   Add preconditions/test_steps/test_data to those TCs so the report detail '
          'cards are complete, then regenerate.')


def extract_playwright_results(data: dict) -> list[dict]:
    """Flatten playwright JSON report into list of {test, status, duration, error, file, attachments}."""
    results = []

    def walk(suite, parent_file=''):
        file_ = suite.get('file', parent_file)
        for spec in suite.get('specs', []):
            title = spec.get('title', '')
            for tr in spec.get('tests', [{}]):
                # Skip the infrastructure projects (`setup/auth.setup.ts` → "authenticate",
                # `seed` → fixture provisioning). They are not test cases; counting them
                # inflated the Overview totals so they disagreed with the TC-id-based tally.
                if tr.get('projectName') in ('setup', 'seed'):
                    continue
                attempts = tr.get('results') or [{}]
                result = attempts[-1]  # last attempt = the retried, final outcome
                test_status = tr.get('status', 'unknown')
                # `test.fail()` pins a test to a known DEV-BUG: the test still FAILS, and
                # Playwright reports that failure as 'expected'. Counting it as a pass is
                # how a run with open defects prints "GO 100%". Bucket it separately.
                pinned = any((a or {}).get('type') == 'fail'
                             for a in (tr.get('annotations') or []))
                # Playwright's test-level status is the AGGREGATE across retries:
                # 'flaky' = failed once then passed on retry. That is a green
                # final result — count it as passed (flagged), not failed. Reading
                # results[0] instead treated every flaky test as a hard failure and
                # produced a false "Conditional GO" on a run that ultimately passed.
                # A 'skipped' test is one of TWO very different things, and reporting
                # them as one number is how a broken fixture reads as "green with a few
                # skips". `test.skip(cond, 'why')` / `test.fixme()` leave a 'skip'
                # annotation; a test ABANDONED because its beforeEach/beforeAll threw
                # leaves none — Playwright marks it skipped, junit writes <skipped>, and
                # a single dead fixture silently swallows every test in the file.
                # (Seen for real: 63 of 71 "skips" on one shard were two dead fixtures.)
                skip_annotated = any((a or {}).get('type') in ('skip', 'fixme')
                                     for a in (tr.get('annotations') or []))
                if pinned and test_status != 'skipped':
                    status = 'known_bug'
                elif test_status in ('expected', 'flaky'):
                    status = 'passed'
                elif test_status == 'skipped':
                    status = 'skipped' if skip_annotated else 'did_not_run'
                else:
                    status = result.get('status', 'failed')
                results.append({
                    'test': title,
                    'status': status,
                    'flaky': test_status == 'flaky',
                    'pinned': pinned,
                    'duration': result.get('duration', 0),
                    'error': (result.get('error') or {}).get('message', ''),
                    'attachments': result.get('attachments', []),
                    'file': file_,
                })
        for child in suite.get('suites', []):
            walk(child, file_)

    for s in data.get('suites', []):
        walk(s)
    return results


def _esc(text) -> str:
    """Escape HTML special chars so test data / errors render literally."""
    if text is None:
        return ''
    s = str(text)
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def _fmt_test_data(td) -> str:
    """Render a test_data dict as readable key: value rows (or em-dash if empty)."""
    if not td or not isinstance(td, dict):
        return '<em>None</em>'
    parts = []
    for k, v in td.items():
        val = '<em>(empty)</em>' if v == '' else f'<code>{_esc(v)}</code>'
        parts.append(f'<strong>{_esc(k)}</strong>: {val}')
    return '<br>'.join(parts)


def _fmt_steps(steps: list) -> str:
    """Render steps as an ordered list of 'action → expected'."""
    if not steps:
        return '<em>—</em>'
    items = []
    for s in steps:
        action = _esc(s.get('action', '')) if isinstance(s, dict) else _esc(s)
        exp = _esc(s.get('expected', '')) if isinstance(s, dict) else ''
        if exp:
            items.append(f'<li>{action} <span class="tc-arrow">&#8594;</span> '
                         f'<span class="tc-step-exp">{exp}</span></li>')
        else:
            items.append(f'<li>{action}</li>')
    return f'<ol class="tc-steps">{"".join(items)}</ol>'


def verdict(pass_rate: float) -> tuple[str, str]:
    if pass_rate == 100:
        return 'GO', '\u2705 GO'
    if pass_rate >= 80:
        return 'CONDITIONAL', '\u26a0 Conditional GO'
    return 'NO-GO', '\u274c NO-GO'


def _go_decision(pw_results: list[dict]) -> tuple[str, str]:
    """Return (decision, reason) matching API report.py logic."""
    total = len(pw_results)
    passed = sum(1 for r in pw_results if r['status'] == 'passed')
    skipped = sum(1 for r in pw_results if r['status'] == 'skipped')
    # A `test.fail()`-pinned test is a KNOWN FAILING test, not a pass. It stays in the
    # executed denominator and blocks a clean GO — otherwise pinning a defect is a way
    # to make the report green while the defect ships.
    pinned = sum(1 for r in pw_results if r['status'] == 'known_bug')
    # Skipped tests are NOT failures — they were intentionally not executed
    # (spec_only / role-coverage / feature-disabled). Counting them as failed
    # produced a misleading "N test(s) failed" verdict on green runs.
    #
    # did-not-run is the opposite case: nobody decided to skip these, a dead hook
    # ate them. They are UNPROVEN coverage and must not be netted out of the
    # denominator the way an intentional skip is.
    not_run = sum(1 for r in pw_results if r['status'] == 'did_not_run')
    failed = total - passed - skipped - pinned - not_run
    flaky = sum(1 for r in pw_results if r.get('flaky'))
    executed = total - skipped - not_run
    rate = round(passed / executed * 100, 1) if executed else 0
    flaky_note = f' {flaky} passed only on retry (flaky).' if flaky else ''
    not_run_note = (f' {not_run} test(s) never executed — their hook/fixture failed, so '
                    f'that coverage is UNPROVEN (not a pass and not an intentional skip).'
                    ) if not_run else ''
    pinned_note = (f' {pinned} test(s) pinned to known DEV-BUGs via test.fail() — '
                   f'counted as failing, not passing.') if pinned else ''
    if not_run:
        # Never a clean GO: the run cannot speak for coverage it did not execute.
        return 'CONDITIONAL', (f'{passed}/{executed} executed tests passed, but the run is '
                               f'INCOMPLETE.{not_run_note}{pinned_note}{flaky_note}')
    if failed == 0 and pinned == 0:
        if skipped:
            return 'GO', (f'All executed tests passed ({passed}/{executed}); '
                          f'{skipped} skipped (not executed, no failures).{flaky_note}')
        return 'GO', f'All tests passed successfully. No blocking issues detected.{flaky_note}'
    if failed == 0 and pinned:
        return 'CONDITIONAL', (f'{passed}/{executed} passed and no new failures, but the run '
                               f'carries {pinned} open DEV-BUG(s).{pinned_note}{flaky_note}')
    if rate >= 95:
        return 'CONDITIONAL', f'High pass rate ({rate}%) but {failed} test(s) failed. Review failures for business impact.{pinned_note}'
    if rate >= 80:
        return 'CONDITIONAL', f'Moderate pass rate ({rate}%). Multiple failures detected — verify critical functionality.{pinned_note}'
    return 'NO-GO', f'Low pass rate ({rate}%). Significant failures detected. Not recommended for deployment.{pinned_note}'


# ── Spec reader ──────────────────────────────────────────────────────────────

def read_spec_version(testcases_file: str) -> dict:
    """Read the spec-version block from the test-cases yaml.

    The verdict at the top of this report is only meaningful against a named spec
    revision: "49/49 GO" says nothing if the reader cannot tell which VIF version the
    oracles came from. generate_test_cases.py hard-gates the block, so an empty dict
    here means the yaml predates the contract — reported as UNATTRIBUTED rather than
    quietly omitted, because a silent omission reads as "no version issue".
    """
    if not testcases_file or not Path(testcases_file).exists():
        return {}
    try:
        import yaml as _y
        data = _y.safe_load(Path(testcases_file).read_text(encoding='utf-8')) or {}
    except Exception:
        return {}
    return {k: str(data.get(k, '') or '') for k in ('vif_id', 'vif_version', 'vif_grammar')}


def read_spec_flows(spec_file: str) -> list[str]:
    """Extract UF-xxx / SRV-xxx / VAL-xxx acceptance bullets from spec file."""
    if not spec_file or not Path(spec_file).exists():
        return []
    with open(spec_file, 'r', encoding='utf-8') as f:
        text = f.read()
    flows = []
    # Extract User Flow headings and their first description line
    for m in re.finditer(r'(UF-\d+|SRV-\d+)[^\n]*\n([^\n#|]+)', text):
        code = m.group(1).strip()
        desc = m.group(2).strip().strip('- ').strip()
        if desc:
            flows.append(f'{code} — {desc}')
    # Deduplicate while preserving order
    seen = set()
    result = []
    for f in flows:
        if f not in seen:
            seen.add(f)
            result.append(f)
    return result[:10]   # cap at 10 bullets


def read_grammar_caveats(spec_file: str) -> list[str]:
    """Return one caveat per `source_specs` entry marked as a grammar-0.3 FALLBACK.

    A fallback is not a failure — the run still happened — but it DEGRADES specific
    coverage classes, and a verdict that does not say so is overstating its own evidence:

      * a 0.3 **CT** has no `Applies To` column, so every §Error Responses row must have its
        endpoint inferred from prose. Mis-routing an error to the wrong endpoint is how a
        detail-scoped 403/500 gap ships while the collection variant reports green.
      * a 0.3 **ES** keeps §Invariants as prose and its guards in `## Domain Methods` rather
        than a `Steps:` DSL, so every enforcement guard is hand-derived. That is precisely
        the shape in which `Activate(): StartDate >= now` once shipped untested.

    Reads the marker the resolver prints and Step 2a copies verbatim, so nothing new has to
    be authored for this to appear.
    """
    if not spec_file or not Path(spec_file).exists():
        return []
    try:
        text = Path(spec_file).read_text(encoding='utf-8')
    except OSError:
        return []
    out: list[str] = []
    for line in text.splitlines():
        if 'FALLBACK' not in line.upper():
            continue
        m = re.search(r'\b([A-Z]{2,3}-[A-Z]+-\d+)\b', line)
        if not m:
            continue
        sid = m.group(1)
        kind = sid.split('-')[0]
        if kind == 'CT':
            cost = ('no <code>Applies To</code> column — each error row&rsquo;s endpoint was '
                    'inferred from prose, so endpoint-scoped error coverage is weaker than '
                    'a 0.4 run')
        elif kind == 'ES':
            cost = ('&sect;Invariants is prose and guards sit in <code>## Domain Methods</code> '
                    '— enforcement guards were hand-derived, not read off the DSL, so a missed '
                    'guard is possible')
        else:
            cost = 'read at grammar 0.3; any 0.4-only column was unavailable'
        out.append(f'<li>⚠️ <strong>{sid}</strong> — {cost}.</li>')
    return out


# ── Report sections (HTML — 5 sections per SKILL.md spec) ────────────────────

def _spec_version_cell(sv: dict | None) -> str:
    """Render the spec revision the whole verdict is relative to."""
    sv = sv or {}
    if not sv.get('vif_id') or not sv.get('vif_version'):
        return ('\u26a0\ufe0f <strong>UNATTRIBUTED</strong> \u2014 the test-cases yaml carries no '
                'spec-version block, so these results cannot be tied to a VIF revision '
                'and cannot later be shown to be stale')
    gram = sv.get('vif_grammar', '?')
    cell = f'<strong>{sv["vif_id"]} v{sv["vif_version"]}</strong> (grammar {gram})'
    if gram != '0.4':
        cell += (f'<br/>\u26a0\ufe0f grammar {gram} \u2014 the 0.4-only spec columns (ES Properties '
                 'constraints, CT ValidationTier/Binding, Error Responses <code>Applies To</code>) '
                 'were unavailable, so guard coverage is prose-derived')
    return cell


def section_overview(feature_title: str, page_url: str, date: str,
                     work_item_id: str, spec_file: str,
                     pw_results: list[dict], data: dict,
                     spec_version: dict | None = None) -> list[str]:
    """Section 1: Overview — HTML table matching API Test Generator format."""
    total = len(pw_results)
    passed = sum(1 for r in pw_results if r['status'] == 'passed')
    skipped = sum(1 for r in pw_results if r['status'] == 'skipped')
    not_run = sum(1 for r in pw_results if r['status'] == 'did_not_run')
    rate = round(passed / total * 100, 1) if total > 0 else 0
    decision, reason = _go_decision(pw_results)
    decision_emoji = {'GO': '✅', 'CONDITIONAL': '⚠️', 'NO-GO': '❌'}.get(decision, '❓')
    wi_display = f'US-{work_item_id} — {feature_title}' if work_item_id else feature_title
    stats = data.get('stats', {})
    duration_ms = stats.get('duration', 0)
    duration_s = f'{round(duration_ms / 1000, 1)}s' if duration_ms else '—'
    spec_display = Path(spec_file).name if spec_file else '—'

    lines = [
        f'# 📋 UI Automation Test Report — {feature_title}',
        '',
        '## 📋 Section 1: Overview',
        '',
        '<table>',
        '<tr><th></th><th></th></tr>',
        f'<tr><td><strong>Feature</strong></td><td>{feature_title}</td></tr>',
        f'<tr><td><strong>User Story</strong></td><td>{wi_display}</td></tr>',
        f'<tr><td><strong>Spec File</strong></td><td>{spec_display}</td></tr>',
        f'<tr><td><strong>Spec Version</strong></td><td>{_spec_version_cell(spec_version)}</td></tr>',
        f'<tr><td><strong>Page URL</strong></td><td>{page_url or "N/A"}</td></tr>',
        '<tr><td><strong>Browser</strong></td><td>Chromium</td></tr>',
        f'<tr><td><strong>Execution Date</strong></td><td>{date}</td></tr>',
        f'<tr><td><strong>Pass Rate</strong></td><td>{passed}/{total} ({rate}%)</td></tr>',
    ] + ([
        f'<tr><td><strong>⚠️ Did not run</strong></td><td>{not_run} test(s) abandoned by a '
        f'failing hook/fixture — this coverage is unproven, not passing and not skipped</td></tr>',
    ] if not_run else []) + [
        f'<tr><td><strong>Total Duration</strong></td><td>{duration_s}</td></tr>',
        f'<tr><td><strong>GO / NO-GO</strong></td><td>{decision} {decision_emoji}<br/>{reason}</td></tr>',
        '</table>',
        '',
    ]
    return lines


def section_business_impact(spec_file: str, tcs: list[dict],
                             pw_results: list[dict]) -> list[str]:
    """Section 2: Business Impact — UF-xxx flow bullets + critical path assessment."""
    total = len(pw_results)
    passed = sum(1 for r in pw_results if r['status'] == 'passed')
    skipped = sum(1 for r in pw_results if r['status'] == 'skipped')
    not_run = sum(1 for r in pw_results if r['status'] == 'did_not_run')
    failed = total - passed - skipped - not_run  # skipped/did-not-run are not failures
    rate = round(passed / total * 100, 1) if total > 0 else 0

    lines = [
        '## 📊 Section 2: Business Impact',
        '',
        '<ul>',
    ]

    # UF-xxx / SRV-xxx flow bullets from spec
    flows = read_spec_flows(spec_file)
    if flows:
        for flow in flows:
            lines.append(f'<li>✅ {flow}</li>')
    else:
        lines.append('<li>UI user flows as defined in the spec file</li>')

    # Critical path impact
    if failed == 0:
        lines += [
            '<li>✅ <strong>Core functionality verified:</strong> All UI flows completed successfully</li>',
            '<li>✅ <strong>Validation rules confirmed:</strong> All form validations triggered correctly</li>',
            '<li>✅ <strong>Navigation verified:</strong> All redirects and page transitions work as expected</li>',
        ]
    else:
        lines += [
            f'<li>⚠️ <strong>Partial functionality issues:</strong> {failed} out of {total} tests failed</li>',
        ]
        # Identify which groups failed
        failed_tests = [r for r in pw_results if r['status'] in ('failed', 'timedOut', 'known_bug')]
        failed_titles = ' '.join(r.get('test', '').lower() for r in failed_tests)
        if 'required' in failed_titles or 'val-' in failed_titles:
            lines.append('<li>❌ <strong>Validation flows affected:</strong> Required field checks and VAL-xxx rules need re-testing</li>')
        if 'cancel' in failed_titles or 'navigation' in failed_titles:
            lines.append('<li>❌ <strong>Navigation flow affected:</strong> Cancel/back navigation behavior needs investigation</li>')
        if 'auth' in failed_titles:
            lines.append('<li>❌ <strong>Authorization flows affected:</strong> Role-based access control may not be functioning correctly</li>')

    # Spec-grammar caveats — state what the evidence could NOT cover, next to the verdict
    # rather than in a footnote. Silence here reads as "fully covered", which a fallback run
    # is not.
    caveats = read_grammar_caveats(spec_file)
    if caveats:
        lines.append('<li>⚠️ <strong>Spec-grammar fallback — coverage caveats:</strong>'
                     '<ul>' + ''.join(caveats) + '</ul></li>')

    lines += ['</ul>', '']
    return lines


_STATUS_META = {
    'passed':    ('✅ PASS', 'pass'),
    'failed':    ('❌ FAIL', 'fail'),
    'timedOut':  ('❌ FAIL', 'fail'),
    'known_bug': ('🐞 KNOWN BUG', 'fail'),  # test.fail()-pinned: failing, not passing
    'skipped':     ('⏭️ SKIP', 'skip'),
    'did_not_run': ('⚠️ DID NOT RUN', 'fail'),  # hook/fixture died — coverage unproven
    'not_run':     ('— N/A',  'na'),
}


def section_test_results(tcs: list[dict], pw_results: list[dict]) -> list[str]:
    """Section 3: Test Results.

    Part A — compact summary table (#, TC ID, Title, Priority, Status, Duration, Spec Ref).
    Part B — one rich detail card per test case (ALL cases), showing Type/Priority,
             Preconditions, Test Data, Steps, Expected Result, Actual Result.
             PASS → 'Matched expected'. FAIL → real error + Root Cause + Fix + Severity.
    """
    def _norm_tc(s: str | None) -> str | None:
        # Normalize a TC id to its mapping key: keep an EXP segment (TC-EXP-004), but strip a
        # trailing a/b variant letter (TC-020a/TC-020b → TC-020) so a base yaml id maps to its
        # split executable tests.
        m = re.search(r'(TC-(?:EXP-)?\d+)', s or '')
        return m.group(1) if m else None

    pw_map: dict[str, dict] = {}
    for r in pw_results:
        k = _norm_tc(r['test'])
        if k:
            pw_map[k] = r

    def _resolve(tc: dict) -> tuple[dict | None, str | None]:
        """Return (result, merged_from). A TC with no direct Playwright result but a
        `covered_by: TC-xxx` ref inherits that ref's result — the assertion is executed under
        another TC id (a reconciled duplicate), so it counts as covered, not skipped/N-A."""
        r = pw_map.get(_norm_tc(tc['id']))
        if r:
            return r, None
        ref = tc.get('covered_by')
        if ref:
            return pw_map.get(_norm_tc(ref)), ref
        return None, None

    total = len(tcs)
    passed = sum(1 for tc in tcs if (_resolve(tc)[0] or {}).get('status') == 'passed')
    failed = sum(1 for tc in tcs if (_resolve(tc)[0] or {}).get('status') in ('failed', 'timedOut'))
    skipped = sum(1 for tc in tcs if (_resolve(tc)[0] or {}).get('status') == 'skipped')
    known = sum(1 for tc in tcs if (_resolve(tc)[0] or {}).get('status') == 'known_bug')
    not_run = sum(1 for tc in tcs if (_resolve(tc)[0] or {}).get('status') == 'did_not_run')
    known_pill = (f' <span class="tc-pill tc-pill-fail">🐞 {known} known bug</span>'
                  if known else '')
    # Its own pill, never folded into "skipped": these TCs were abandoned by a dead
    # hook, so their coverage is unproven rather than deliberately out of scope.
    not_run_pill = (f' <span class="tc-pill tc-pill-fail">⚠️ {not_run} did not run</span>'
                    if not_run else '')

    lines = [
        '## ✅ Section 3: Test Results',
        '',
        f'<p class="tc-tally"><strong>{total}</strong> test cases &nbsp;·&nbsp; '
        f'<span class="tc-pill tc-pill-pass">✅ {passed} passed</span> '
        f'<span class="tc-pill tc-pill-fail">❌ {failed} failed</span>{known_pill}{not_run_pill} '
        f'<span class="tc-pill tc-pill-skip">⏭️ {skipped} skipped</span></p>',
        '',
        '<h3>Summary</h3>',
        '<table class="tc-summary">',
        '<tr><th>#</th><th>TC ID</th><th>Title</th><th>Priority</th>'
        '<th>Status</th><th>Duration</th><th>Spec Ref</th></tr>',
    ]

    for i, tc in enumerate(tcs, 1):
        r, merged_from = _resolve(tc)
        status = r['status'] if r else 'not_run'
        status_label, css = _STATUS_META.get(status, _STATUS_META['not_run'])
        if merged_from and r:
            status_label = f'{status_label} <span class="tc-merged">↳ {_esc(merged_from)}</span>'
        duration_ms = r['duration'] if r else 0
        duration = f'{duration_ms}ms' if duration_ms else '—'
        lines.append(
            f'<tr><td>{i}</td><td>{_esc(tc["id"])}</td><td>{_esc(tc["title"])}</td>'
            f'<td>{_esc(tc.get("priority", "—"))}</td>'
            f'<td class="tc-status-{css}">{status_label}</td>'
            f'<td>{duration}</td><td>{_esc(tc.get("spec_ref", "—"))}</td></tr>'
        )

    lines += ['</table>', '', '<h3>Test Case Details</h3>', '']

    # Detail card per test case (all cases)
    for i, tc in enumerate(tcs, 1):
        r, merged_from = _resolve(tc)
        status = r['status'] if r else 'not_run'
        status_label, css = _STATUS_META.get(status, _STATUS_META['not_run'])
        if merged_from and r:
            status_label = f'{status_label} (↳ covered by {_esc(merged_from)})'
        duration_ms = r['duration'] if r else 0
        duration = f'{duration_ms}ms' if duration_ms else '—'

        # Actual result + (on failure) root cause / fix.
        actual_html, extra_rows = _actual_and_extras(status, r, tc)

        precond = tc.get('preconditions', [])
        precond_html = ('<ul class="tc-pre">' + ''.join(f'<li>{_esc(p)}</li>' for p in precond) + '</ul>') \
            if precond else '<em>—</em>'

        lines.append(f'<div class="tc-card tc-card-{css}">')
        lines.append(
            f'<div class="tc-card-head">'
            f'<span class="tc-badge tc-badge-{css}">{status_label}</span> '
            f'<span class="tc-id">{i}. {_esc(tc["id"])}</span> '
            f'<span class="tc-title">{_esc(tc["title"])}</span></div>'
        )
        lines.append('<table class="tc-fields">')
        lines.append(
            f'<tr><th class="tc-key">Type</th><td>{_esc(tc.get("type", "—"))}</td>'
            f'<th class="tc-key">Priority</th><td>{_esc(tc.get("priority", "—"))}</td></tr>'
        )
        lines.append(
            f'<tr><th class="tc-key">Spec Ref</th><td>{_esc(tc.get("spec_ref", "—"))}</td>'
            f'<th class="tc-key">Duration</th><td>{duration}</td></tr>'
        )
        lines.append(f'<tr><th class="tc-key">Preconditions</th><td colspan="3">{precond_html}</td></tr>')
        lines.append(f'<tr><th class="tc-key">Test Data</th><td colspan="3">{_fmt_test_data(tc.get("test_data"))}</td></tr>')
        lines.append(f'<tr><th class="tc-key">Steps</th><td colspan="3">{_fmt_steps(tc.get("steps", []))}</td></tr>')
        lines.append(f'<tr><th class="tc-key">Expected Result</th><td colspan="3">{_esc(tc.get("expected", "—")) or "—"}</td></tr>')
        lines.append(f'<tr class="tc-actual-row tc-actual-{css}"><th class="tc-key">Actual Result</th><td colspan="3">{actual_html}</td></tr>')
        for row in extra_rows:
            lines.append(row)
        lines.append('</table>')
        lines.append('</div>')
        lines.append('')

    return lines


def _actual_and_extras(status: str, r: dict | None, tc: dict) -> tuple[str, list[str]]:
    """Compute the Actual Result cell content and any extra (Root Cause / Fix / Severity) rows."""
    if status == 'passed':
        return ('<span class="tc-ok">Matched expected ✅</span>', [])

    if status == 'skipped':
        return ('<span class="tc-muted">⏭️ Skipped at runtime — see Expected Result for the skip condition '
                '(environment/data gate, not a defect).</span>', [])

    if status == 'not_run':
        return ('<span class="tc-muted">Not executed in this run.</span>', [])

    # failed / timedOut / known_bug
    err_raw = ((r or {}).get('error') or '').strip()
    err_clean = re.sub(r'\x1b\[[0-9;]*m', '', err_raw)
    err_short = err_clean.split('\n')[0][:300]
    root_cause, fix = _analyse_failure(err_raw, tc)
    if status == 'known_bug':
        return ('<span class="tc-err">🐞 Still failing — pinned to a known DEV-BUG via '
                '<code>test.fail()</code>. Playwright reports this as "expected"; it is NOT a '
                f'pass.</span><br><code class="tc-err">{_esc(err_short)}</code>',
                [f'<tr><th class="tc-key">Status</th><td colspan="3">Open defect — unpin the test '
                 f'once the fix is deployed, then re-run to confirm.</td></tr>'])
    actual = f'<code class="tc-err">{_esc(err_short) or "Test failed — see Playwright HTML report"}</code>'
    extras = [
        f'<tr><th class="tc-key">Root Cause</th><td colspan="3">{_esc(root_cause)}</td></tr>',
        f'<tr><th class="tc-key">Fix</th><td colspan="3"><code>{_esc(fix)}</code></td></tr>',
        f'<tr><th class="tc-key">Severity</th><td colspan="3">{_esc(tc.get("priority", "Medium"))}</td></tr>',
    ]
    return (actual, extras)


def _analyse_failure(error: str, tc: dict) -> tuple[str, str]:
    """Return (root_cause, fix) based on error message and test case context."""
    err_lower = error.lower()
    title_lower = tc.get('title', '').lower()

    lbl_match = re.search(r"getbylabel\('(\*\*[^']+\*\*[^']*)'", err_lower)
    if lbl_match:
        raw_label = lbl_match.group(1)
        field = re.sub(r'\*{1,2}', '', raw_label).replace(' field', '').strip()
        field_id = field.replace(' ', '')
        return (
            f"Script uses markdown-formatted label '{raw_label}' which does not match the actual HTML label.",
            f"page.locator('#{field_id}') or page.getByLabel('{field.title()}')"
        )

    if '/submit|save|confirm/i' in err_lower or ('button' in err_lower and 'timeout' in err_lower):
        if 'cancel' in title_lower or 'navigation' in title_lower:
            return (
                "Script uses regex /submit|save|confirm/i for the Cancel button — no match found.",
                "page.getByRole('button', { name: 'Cancel' })"
            )
        return (
            "Submit button selector regex /submit|save|confirm/i did not match the actual button label.",
            "page.getByRole('button', { name: 'Create User' })"
        )

    if 'tocontaintext' in err_lower and 'alert' in err_lower:
        return (
            "Success toast/alert element not found — prototype has no backend response.",
            "Use test.fail() annotation for prototype environments or mock the API response."
        )

    if 'timeout' in err_lower and 'locator' in err_lower:
        loc_match = re.search(r"locator\(([^)]+)\)", err_lower)
        loc = loc_match.group(1) if loc_match else 'element'
        return (
            f"Element {loc} was not found within the timeout. Selector may be incorrect or element not rendered.",
            "Inspect the page DOM and update the selector to match actual element attributes."
        )

    return (
        "Test failed — see Actual Result for details.",
        "Investigate error, fix selector or assertion, then re-run."
    )


def section_evidence(results_path: str, testcases_path: str, script_path: str,
                     pw_results: list[dict]) -> list[str]:
    """Section 4: Evidence — HTML list of artifact paths."""
    report_dir = str(Path(results_path).parent) if results_path else '—'
    playwright_html = f'{report_dir}/html-report/index.html'

    screenshots: list[str] = []
    videos: list[str] = []
    for r in pw_results:
        for att in r.get('attachments', []):
            p = att.get('path', '')
            if not p:
                continue
            name = att.get('name', '')
            if not screenshots and ('screenshot' in name.lower() or p.endswith('.png')):
                screenshots.append(p)
            elif not videos and ('video' in name.lower() or p.endswith('.webm')):
                videos.append(p)

    lines = [
        '## 📎 Section 4: Evidence',
        '',
        '<p>Test execution artifacts are available:</p>',
        '<ul>',
        f'<li>📄 Test Cases: <code>{testcases_path or "—"}</code></li>',
        f'<li>📝 Test Scripts: <code>{script_path or "—"}</code></li>',
        f'<li>📊 Playwright HTML Report: <code>{playwright_html}</code></li>',
        f'<li>📋 JSON Results: <code>{results_path or "—"}</code></li>',
    ]
    if screenshots:
        lines.append(f'<li>📸 Screenshot: <code>{screenshots[0]}</code></li>')
    if videos:
        lines.append(f'<li>🎥 Video: <code>{videos[0]}</code></li>')
    lines += [
        '</ul>',
        '<p><em>Note: Upload test-results.zip to work item attachments for complete evidence package</em></p>',
        '',
    ]
    return lines


def section_notes(feature: str, date: str, data: dict, pw_results: list[dict]) -> list[str]:
    """Section 5: Notes — Playwright execution info + recommendations + re-test command."""
    config = data.get('config', {})
    workers = config.get('metadata', {}).get('actualWorkers') or config.get('workers', '—')
    retries_val = None
    for proj in config.get('projects', []):
        if 'ui' in (proj.get('name', '') or '').lower():
            retries_val = proj.get('retries')
            break
    if retries_val is None:
        retries_val = config.get('retries', '—')

    stats = data.get('stats', {})
    duration_ms = stats.get('duration', 0)
    duration_s = f'{round(duration_ms / 1000, 1)}s' if duration_ms else '—'

    script_name = f'{feature}.spec.ts' if feature else 'spec'
    retest_cmd = f'npx playwright test script/ui/{script_name} --project="UI Tests"'

    total = len(pw_results)
    passed = sum(1 for r in pw_results if r['status'] == 'passed')
    skipped = sum(1 for r in pw_results if r['status'] == 'skipped')
    failed = total - passed - skipped  # skipped tests are not failures

    lines = [
        '## 📝 Section 5: Notes',
        '',
        '<p><strong>Playwright Execution Info:</strong></p>',
        '<ul>',
        f'<li>Command: <code>{retest_cmd}</code></li>',
        f'<li>Duration: {duration_s}</li>',
        f'<li>Workers: {workers}</li>',
        f'<li>Retries: {retries_val}</li>',
        '</ul>',
        '',
    ]

    if failed == 0:
        lines += [
            '<p>✅ All tests executed successfully. No issues found.</p>',
            '<p><strong>Next Steps:</strong></p>',
            '<ul>',
            '<li>Review test coverage against the full spec</li>',
            '<li>Consider adding additional edge case tests</li>',
            '<li>Proceed with deployment if all acceptance criteria are met</li>',
            '</ul>',
        ]
    else:
        lines += [
            '<p>⚠️ Some tests failed. Action required before deployment.</p>',
            '<p><strong>Recommended Actions:</strong></p>',
            '<ol>',
            '<li>Review failed test details in Section 3</li>',
            '<li>Fix selector issues in the generated <code>.spec.ts</code> file</li>',
            '<li>Re-run the test suite to verify fixes</li>',
            f'<li>Re-run command: <code>{retest_cmd}</code></li>',
            '</ol>',
        ]

    lines += [
        '',
        '---',
        '*🤖 Generated by UI Flow Test Generator Skill*',
    ]
    return lines


# ── Writer ────────────────────────────────────────────────────────────────────

def write_report(out_path: str, sections: list[str], append: bool) -> None:
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    mode = 'a' if append and Path(out_path).exists() else 'w'
    with open(out_path, mode, encoding='utf-8') as f:
        if mode == 'a':
            f.write('\n---\n\n')
        f.write('\n'.join(sections))


def _full_url(page_url: str, base_url: str) -> str:
    """Join base_url + relative page_url into a clickable full URL — DISPLAY ONLY
    (report). Test artifacts stay relative (#143582); this only restores the host
    in the report's "Page URL" row so it's clickable to the live deployment.

      • page_url already absolute (http/file) → unchanged.
      • relative page_url + base_url → '<base>/<path>' (single slash).
      • no base_url → page_url unchanged.
    """
    if not page_url:
        return page_url
    if page_url.startswith(('http://', 'https://', 'file://')):
        return page_url
    if not base_url:
        return page_url
    return base_url.rstrip('/') + '/' + page_url.lstrip('/')


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Generate UI Automation Test Report')
    parser.add_argument('--results', required=True, help='Playwright results.json')
    parser.add_argument('--testcases', default='', help='Test cases .yaml')
    parser.add_argument('--page-url', default='', dest='page_url')
    parser.add_argument('--base-url', default=os.environ.get('UI_BASE_URL', ''), dest='base_url',
                        help='Deployment host (UI_BASE_URL). Joined with relative --page-url to show a full, clickable URL in the report. Display-only — does not affect tests.')
    parser.add_argument('--spec-file', default='', dest='spec_file')
    parser.add_argument('--date', default=TODAY)
    parser.add_argument('--feature', default='', help='Feature slug (e.g. create-user)')
    parser.add_argument('--feature-title', default='', dest='feature_title',
                        help='Display title (e.g. "Create User")')
    parser.add_argument('--work-item-id', default='', dest='work_item_id')
    parser.add_argument('--script-path', default='', dest='script_path',
                        help='Path to .spec.ts file')
    parser.add_argument('--out', required=True)
    parser.add_argument('--append', action='store_true')
    args = parser.parse_args()

    feature_title = args.feature_title or args.feature.replace('-', ' ').title()

    print(f'\U0001f4dd Generating report from: {args.results}')
    raw = load_results(args.results)
    tcs = parse_test_cases(args.testcases)
    warn_sparse_test_cases(tcs, args.testcases)
    pw_results = extract_playwright_results(raw)
    print(f'   {len(pw_results)} test results | {len(tcs)} test cases loaded')

    all_lines: list[str] = []
    all_lines += section_overview(
        feature_title, _full_url(args.page_url, args.base_url), args.date,
        args.work_item_id, args.spec_file, pw_results, raw,
        read_spec_version(args.testcases),
    )
    all_lines += section_business_impact(args.spec_file, tcs, pw_results)
    all_lines += section_test_results(tcs, pw_results)
    all_lines += section_evidence(args.results, args.testcases, args.script_path, pw_results)
    all_lines += section_notes(args.feature, args.date, raw, pw_results)

    write_report(args.out, all_lines, args.append)
    print(f'\u2705 Report saved: {args.out}')

    total = len(pw_results)
    passed = sum(1 for r in pw_results if r['status'] == 'passed')
    rate = round(passed / total * 100, 1) if total > 0 else 0
    _, vsym = verdict(rate)
    print(f'   Verdict: {vsym} ({rate}% pass rate, {passed}/{total})')


if __name__ == '__main__':
    main()

