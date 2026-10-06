"""Step 8.5 — Negative control: classify which tests can actually go red.

WHY
A green run is not evidence that a test asserts anything. Every false-green class
this suite has hit passes on a healthy screen and keeps passing: a page-wide badge
locator matching some other row, a filter oracle that never asserts an exclusion
(#148643), a table shell whose role/headers render before the data. Re-running the
suite cannot find them — they are green by construction.

So run the suite twice: once normally, once with NEGATIVE_CONTROL=1 (setup/
negative-control.ts replaces every JSON value the screen reads, shape-preserving).
A test that passes BOTH times is not reading the data it claims to assert.

CREDIT IS ONLY GIVEN FOR AN ORACLE HIT
A test that fails under scramble because a fixture timed out, the worker crashed or
the page went blank proved nothing about its own assertion. Those land in
WRONG_REASON, never in PROVEN — otherwise the metric inflates itself exactly the way
the report tally used to before setup projects were excluded from it.

Usage
  python3 negative_control.py --baseline <results.json> --negative <results.json> \
      [--testcases <feature-test-cases.yaml>] [--out <report.md>]
"""
import argparse
import json
import pathlib
import re
import sys

# A red that says "your oracle caught the changed value".
ASSERTION_SIGNS = (
    'expect(', 'Expected string', 'Expected pattern', 'Expected substring',
    'toHaveText', 'toContainText', 'toHaveCount', 'toHaveClass', 'toHaveValue',
    'toHaveAttribute', 'toBeVisible', 'toBeHidden', 'Received string',
    'locator resolved to', 'strict mode violation',
)
# A red that says nothing about the oracle.
WRONG_REASON_SIGNS = (
    'while setting up', 'Target page, context or browser has been closed',
    'browserContext.close', 'Test timeout of', 'ECONNREFUSED', 'net::ERR',
    'page.goto', 'Protocol error', 'Execution context was destroyed',
)
# Kinds whose oracle is value-independent BY DESIGN, so a green under scramble is
# not a finding: a layout guard asserts geometry, a client-side validation TC asserts
# a message the FE produces from the form, a render-invariant asserts a popover is
# anchored. Inferred from the title, which the generator emits in a fixed shape, with
# the YAML `category` preferred when present.
STRUCTURAL = {'layout-discovery', 'layout', 'navigation', 'accessibility', 'a11y',
              'render-invariant', 'validation', 'boundary', 'modal'}
TITLE_KIND = [
    (re.compile(r'—\s*Layout'), 'layout'),
    (re.compile(r'—\s*Render-invariant'), 'render-invariant'),
    (re.compile(r'—\s*Modal'), 'modal'),
    (re.compile(r'—\s*Boundary'), 'boundary'),
    (re.compile(r'—\s*VAL-\d'), 'validation'),
    (re.compile(r'—\s*Navigation'), 'navigation'),
]

TC_ID = re.compile(r'\b(TC-[A-Z0-9-]*\d+)\b')


def collect(path):
    """→ {title: (status, joined_error_text)} for the UI Tests project only."""
    data = json.loads(pathlib.Path(path).read_text(encoding='utf-8'))
    out = {}

    def walk(suite):
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                if test.get('projectName') not in (None, 'UI Tests'):
                    continue
                results = test.get('results') or []
                if not results:
                    continue
                last = results[-1]
                errs = ' | '.join(
                    (e.get('message') or '') for e in (last.get('errors') or [])
                )
                ann = ' '.join(
                    a.get('description', '')
                    for a in (last.get('annotations') or []) + (test.get('annotations') or [])
                    if a.get('type') == 'negative-control'
                )
                out[spec['title']] = (last.get('status'), errs, ann)
        for child in suite.get('suites', []):
            walk(child)

    for suite in data.get('suites', []):
        walk(suite)
    return out


def categories(path):
    """→ {TC-id: category} from the test-cases YAML, without a yaml dependency."""
    if not path:
        return {}
    cats, current = {}, None
    for line in pathlib.Path(path).read_text(encoding='utf-8').splitlines():
        m = re.match(r'\s*-?\s*id:\s*(TC-[A-Za-z0-9-]+)', line)
        if m:
            current = m.group(1)
            continue
        m = re.match(r'\s*category:\s*"?([\w-]+)"?', line)
        if m and current:
            cats[current] = m.group(1)
            current = None
    return cats


NC_ANN = re.compile(r'seen=(\d+) scrambled=(\d+) selfMocked=(\w+)')

# ── Static filter: separate "cannot fail, and that is correct" from "cannot fail,
# and it claims to test data". Both look identical in the run — only the CLAIM differs,
# so the claim has to be read from the test itself.
#
# Signal 1 — the claim. A [UF-xxx] flow or a [BR-xxx] business rule asserts something
# ABOUT DATA. A [VAL-]/[ER-]/[AUTH-]/layout/render-invariant TC asserts a surface the FE
# renders from its own code, so a green under scramble is the correct result for it.
CLAIMS_DATA = re.compile(r'\[(?:UF|BR)-')

# Signal 2 — an absence claim is value-independent BY CONSTRUCTION and legitimately so:
# "ActorType is immutable — no edit control", "Properties has no Execution Mode control".
# No data value can make a control that must not exist appear, so scrambling proves nothing.
# Read from the TITLE, never from the body. A body matcher cannot tell the two apart:
# TC-008 asserts `toBeDisabled` on one control while its title still claims to EVOLVE the
# classification — keying on the body classified that real finding as by-design and dropped it.
ABSENCE_TITLE = re.compile(r'\b(no|not|never|without|excludes?|immutable|hidden|disabled)\b', re.I)

# A content matcher — the test does look at a value, so a green means the oracle is too
# permissive rather than absent (the 4-way-disjunction shape).
DATA_ORACLE = re.compile(
    r'toHaveText|toContainText|toHaveValue|toHaveClass|toHaveAttribute'
    r'|textContent\(|innerText\(|inputValue\(|toBeGreaterThan|toEqual|toBe\(')


def test_bodies(script_path):
    """→ {TC-id: body} from the generated spec.ts, so the claim can be read."""
    if not script_path:
        return {}
    src = pathlib.Path(script_path).read_text(encoding='utf-8')
    decl = list(re.finditer(r"\n[ \t]*test(?:\.\w+)?\(\s*['\"](TC-[A-Za-z0-9-]+)", src))
    out = {}
    for i, m in enumerate(decl):
        end = decl[i + 1].start() if i + 1 < len(decl) else len(src)
        out[m.group(1)] = src[m.start():end]
    return out


def classify(base_status, nc_status, nc_err, nc_ann, title, body):
    if base_status != 'passed':
        return 'INCONCLUSIVE', f'baseline was {base_status}'
    if nc_status == 'passed':
        m = NC_ANN.search(nc_ann or '')
        if not m:
            return 'NOT_MEASURED', 'no negative-control annotation — was NEGATIVE_CONTROL=1 set?'
        scrambled, self_mocked = int(m.group(2)), m.group(3) == 'true'
        # A test that supplies its own data through page.route reads its own mock, not
        # the scramble. Scoring it SUSPECT would be the same self-inflating metric this
        # step exists to remove — its oracle has to be judged some other way.
        if self_mocked:
            return 'NOT_MEASURABLE', 'installs its own route mock — scramble never reaches its oracle'
        if scrambled == 0:
            return 'NOT_REACHED', 'the scramble touched no response this test read'
        if not CLAIMS_DATA.search(title):
            return 'STRUCTURAL', 'claims a surface the FE renders itself, not a data outcome'
        if ABSENCE_TITLE.search(title):
            return 'STRUCTURAL', 'absence claim — no data value can satisfy or break it'
        if DATA_ORACLE.search(body):
            return 'SUSPECT', 'reads a value but the oracle is too permissive to notice a wrong one'
        return 'SUSPECT', 'claims a data flow with no assertion that can tell right data from wrong'
    if any(s in nc_err for s in WRONG_REASON_SIGNS) and not any(
        s in nc_err for s in ASSERTION_SIGNS
    ):
        return 'WRONG_REASON', 'red, but not from its own assertion'
    if any(s in nc_err for s in ASSERTION_SIGNS):
        return 'PROVEN', 'assertion caught the scrambled value'
    return 'WRONG_REASON', f'red with an unrecognised error ({nc_err[:60]})'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--baseline', required=True)
    ap.add_argument('--negative', required=True)
    ap.add_argument('--testcases')
    ap.add_argument('--script', help='the generated spec.ts — enables the static claim filter')
    ap.add_argument('--out')
    a = ap.parse_args()

    base, neg, cats = collect(a.baseline), collect(a.negative), categories(a.testcases)
    bodies = test_bodies(a.script)

    rows = []
    for title, (bstat, _, _) in sorted(base.items()):
        nstat, nerr, nann = neg.get(title, ('missing', '', ''))
        m = TC_ID.search(title)
        body = bodies.get(m.group(1), '') if m else ''
        verdict, why = classify(bstat, nstat, nerr, nann, title, body)
        cat = cats.get(m.group(1), '') if m else ''
        if not cat:
            cat = next((k for rx, k in TITLE_KIND if rx.search(title)), '')
        if verdict == 'SUSPECT' and cat in STRUCTURAL:
            verdict, why = 'STRUCTURAL', f'{cat} TC — value-independent by design'
        rows.append((verdict, title, cat, why))

    order = ['SUSPECT', 'WRONG_REASON', 'NOT_MEASURED', 'PROVEN', 'STRUCTURAL',
             'NOT_MEASURABLE', 'NOT_REACHED', 'INCONCLUSIVE']
    counts = {k: sum(1 for r in rows if r[0] == k) for k in order}
    judged = counts['PROVEN'] + counts['SUSPECT']
    pct = (counts['PROVEN'] / judged * 100) if judged else 0.0

    lines = [
        '# Negative control',
        '',
        f'Baseline: `{a.baseline}`',
        f'Negative: `{a.negative}`',
        '',
        f'**Proven able to fail: {counts["PROVEN"]}/{judged} judged ({pct:.0f}%)**',
        '',
        '| Verdict | Count | Meaning |',
        '| --- | --- | --- |',
        f'| SUSPECT | {counts["SUSPECT"]} | green even with every value scrambled — **false green** |',
        f'| PROVEN | {counts["PROVEN"]} | its own assertion caught the change |',
        f'| STRUCTURAL | {counts["STRUCTURAL"]} | value-independent by design, not a finding |',
        f'| WRONG_REASON | {counts["WRONG_REASON"]} | red, but not from its assertion — no credit |',
        f'| NOT_MEASURABLE | {counts["NOT_MEASURABLE"]} | mocks its own data — this technique cannot judge it |',
        f'| NOT_REACHED | {counts["NOT_REACHED"]} | scramble touched nothing it read |',
        f'| NOT_MEASURED | {counts["NOT_MEASURED"]} | no annotation — run not instrumented |',
        f'| INCONCLUSIVE | {counts["INCONCLUSIVE"]} | baseline was not green |',
        '',
    ]
    for k in order:
        picked = [r for r in rows if r[0] == k]
        if not picked or k in ('PROVEN', 'STRUCTURAL'):
            continue
        lines += [f'## {k} ({len(picked)})', '']
        lines += [f'- `{t}` — {w}' for _, t, _, w in picked]
        lines.append('')

    text = '\n'.join(lines)
    print(text)
    if a.out:
        pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        pathlib.Path(a.out).write_text(text, encoding='utf-8')
        print(f'→ {a.out}')
    # Exit 1 on any false green so the caller cannot report GO past it.
    sys.exit(1 if counts['SUSPECT'] else 0)


if __name__ == '__main__':
    main()
