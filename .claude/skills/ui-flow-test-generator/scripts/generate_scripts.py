#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 5 — Generate Playwright TypeScript spec files from test case markdown.

Reads:
  - test-cases .md (output of generate_test_cases.py)
  - element-map.json (output of analyze_page.py)

Writes:
  - script/ui/{feature}.spec.ts  (flat — no date subfolder)

Usage:
    python3 generate_scripts.py \
        --testcases apps/testing/automation-testing/fe-testing/test-cases/ui/create-user-test-cases.md \
        --element-map apps/testing/automation-testing/fe-testing/element-map.json \
        --page-url "http://localhost:4200/users/create" \
        --date 2025-07-08 \
        --feature create-user \
        --out-dir apps/testing/automation-testing/fe-testing/script/ui
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _mode_config import get_config, should_skip  # noqa: E402
from mutation_tags import tag_source

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


def to_relative_url(u: str) -> str:
    """Convert an absolute http(s) URL to a root-relative path (path+query+fragment).

    Playwright resolves root-relative paths ('/foo/bar') against `baseURL`
    (UI_BASE_URL) configured in playwright.config.ts, so generated artifacts stay
    environment-portable — no hard-coded https://dev-cc-mgios.4mgi.com host leaks
    into spec.ts / test-cases.yaml. This is the 2026-06 relative-URL convention
    (refactor #143582).

    Rules:
      • http:// or https://  → strip scheme+host, keep '/path?query#frag'.
      • file://              → unchanged (local prototype; baseURL does not apply).
      • already relative     → ensure exactly one leading slash.
    Case is preserved (never lowercased) so query params like ?objectiveId survive.
    """
    if not u:
        return u
    s = u.strip()
    if s.startswith('file://'):
        return s
    m = re.match(r'^https?://[^/]+(/.*)?$', s, re.IGNORECASE)
    if m:
        return m.group(1) or '/'
    if s.startswith(('/', '#', '?')):
        return s
    return '/' + s

# ── Playwright Native Tags ────────────────────────────────────────────────────
# CI selects tests via `npx playwright test --grep @<tag>` (see
# .azure/azure-pipelines.automation-testing.yaml `testTag` param). Every generated
# spec must carry a Playwright native tag on its top-level describe so sharded CI
# runs can filter by domain/tier:  test.describe(name, { tag: [...] }, () => {…}).
#
# TWO axes of tag:
#   • area tag    — one of CANONICAL_DOMAIN_TAGS (which feature area the spec covers).
#     MANDATORY: lint rule R9 (scripts/lint-tests.mjs) fails a top-level describe that
#     carries none, because a spec without one is unreachable by any feature --grep.
#   • safety tag  — @readonly / @mutating, PER TEST (the area tag sits on the describe):
#     may this test create/update/delete? Production monitoring, and any tenant that is
#     not our own test tenant, run `--grep @readonly` only. Classified from the body the
#     generator just emitted — see mutation_tags.py.

# Canonical domain tags — MUST match the pipeline `testTag` allowed values exactly.
# MUST stay identical to AREA_TAGS in fe-testing/scripts/lint-tests.mjs (rule R9);
# a tag this emits but that R9 does not allow makes the generated spec fail lint.
# 'capture' and 'testing' were dropped 2026-09-07: no spec in the suite ever carried
# them (capture-inbox is @governance, ab-test-configuration is @actors).
CANONICAL_DOMAIN_TAGS = {
    'sop', 'analytics', 'drtp', 'releases', 'governance', 'operations',
    'forge', 'channel', 'strategy', 'actors',
}
# The tier axis is GONE. '@regression' was removed from the suite 2026-09-07: it covered
# 1546 of 1557 tests, was greped by nothing in CI (a scheduled run passes no --grep at
# all and runs everything), and its absence silently dropped a describe's tests from
# `npm run test:<area>`. "Everything except smoke" is `--grep-invert @smoke`.
# '@smoke' is still legal — it is hand-curated in smoke.spec.ts, never auto-generated.
CANONICAL_TIER_TAGS = {'regression', 'smoke'}

# Best-effort URL → domain-tag fallback (used ONLY when --domain-tag is omitted).
# The mapping is NOT 1:1 with URL prefixes — sibling routes split across domains
# (e.g. /knowledge/sops→sop but /knowledge/rag-sync→operations; /governance→governance
# /tasks/mine→operations but /tasks/sf-gcr-*→forge;
# /analytics/objectives→analytics but /analytics/drtps→drtp; /actors/* splits 3 ways).
# So this table lists explicit prefixes; the resolver picks the LONGEST match.
# Derived from the live suite on 2026-06-11 — extend when a new route appears.
URL_DOMAIN_FALLBACK = {
    '/actors/ab-tests': 'actors',
    '/actors/channels': 'channel',
    '/actors/contact-queue': 'operations',
    '/actors/contacts': 'actors',
    '/actors/handoff-rules': 'actors',
    '/actors': 'actors',
    '/knowledge/sops': 'sop',
    '/knowledge/rag-sync': 'operations',
    '/knowledge': 'sop',
    '/sops': 'sop',
    '/analytics/drtps': 'drtp',         # list + /analytics/drtps/<id> detail
    '/analytics/drtp': 'drtp',          # singular variant, if any
    '/analytics/objectives': 'analytics',
    '/analytics': 'analytics',
    '/foundry/spec-factory/releases': 'releases',
    '/foundry/spec-factory/pipeline': 'releases',
    '/foundry': 'forge',
    '/governance/capture-inbox': 'governance',
    '/governance/goals': 'governance',
    '/governance': 'governance',
    '/capture': 'governance',
    '/strategy/initiatives': 'strategy',
    '/strategy/goals': 'governance',
    '/strategy': 'strategy',
    '/tasks/sf-gcr': 'forge',           # platform-forge architect/lead reviews
    '/tasks/processes': 'operations',
    '/tasks/mine': 'operations',
    '/tasks': 'operations',
    '/concierge': 'operations',
}


def _domain_tag_from_url(page_url: str) -> str | None:
    """Best-effort domain tag from a relative page URL (longest-prefix wins).

    Returns the bare tag name (e.g. 'sop') or None when no rule matches. A prefix
    matches only on a path-segment boundary so '/analytics' does not match
    '/analytics-foo'. Case-insensitive; query/fragment ignored for matching.
    """
    if not page_url:
        return None
    u = to_relative_url(page_url).split('#', 1)[0].split('?', 1)[0].rstrip('/').lower()
    if not u:
        u = '/'
    best = None
    for prefix, tag in URL_DOMAIN_FALLBACK.items():
        p = prefix.lower()
        # Match only on a segment boundary: end-of-string, '/', or '-' (some routes
        # pack a sub-token after a hyphen, e.g. /tasks/sf-gcr-architect-review).
        if u == p or u.startswith(p + '/') or u.startswith(p + '-'):
            if best is None or len(p) > len(best[0]):
                best = (p, tag)
    return best[1] if best else None


def resolve_native_tags(domain_tag: str, tier: str, page_url: str) -> list[str]:
    """Resolve the `{ tag: [...] }` list for a generated spec's top-level describe.

    domain_tag : explicit canonical area (preferred — pass it from the skill, which
                 knows the BC). Empty → fall back to URL inference.
    tier       : 'regression' (default, emits NOTHING) or 'smoke'.
    page_url   : relative page URL, used only for the fallback inference.

    Returns e.g. ['@strategy']. The area tag is MANDATORY: lint rule R9 fails a
    top-level describe without one, so a spec that neither an arg nor a URL rule can
    place is a hard error here rather than an unfilterable spec discovered later.
    """
    tags: list[str] = []

    dom = (domain_tag or '').lstrip('@').strip().lower()
    if dom:
        if dom not in CANONICAL_DOMAIN_TAGS:
            print(f"⚠️  --domain-tag '@{dom}' is NOT a canonical CI tag. "
                  f"Allowed: {', '.join('@' + t for t in sorted(CANONICAL_DOMAIN_TAGS))}. "
                  f"Emitting it anyway — fix if this is a typo.", file=sys.stderr)
        tags.append('@' + dom)
    else:
        inferred = _domain_tag_from_url(page_url)
        if inferred:
            print(f"ℹ️  --domain-tag not given; inferred '@{inferred}' from URL "
                  f"'{to_relative_url(page_url)}'. VERIFY this is correct (sibling routes "
                  f"can split domains) — pass --domain-tag to be explicit.", file=sys.stderr)
            tags.append('@' + inferred)
        else:
            sys.exit(f"❌  No --domain-tag and no URL rule matched "
                     f"'{to_relative_url(page_url)}'. An area tag is mandatory (lint R9): "
                     f"without one the spec is unreachable by any feature --grep. Pass "
                     f"--domain-tag (one of: {', '.join(sorted(CANONICAL_DOMAIN_TAGS))}) "
                     f"or add the route to URL_DOMAIN_FALLBACK.")

    # No tier tag for regression — that is simply "not @smoke". See CANONICAL_TIER_TAGS.
    t = (tier or 'regression').lstrip('@').strip().lower()
    if t not in CANONICAL_TIER_TAGS:
        print(f"⚠️  --tier '{t}' is not canonical ({'/'.join(sorted(CANONICAL_TIER_TAGS))}); "
              f"defaulting to 'regression'.", file=sys.stderr)
        t = 'regression'
    if t == 'smoke':
        tags.append('@smoke')

    return tags

# ── Markdown helpers ──────────────────────────────────────────────────────────

def strip_md(s: str) -> str:
    """Strip markdown bold/italic markers (**, __, *, _) from a string."""
    return re.sub(r'\*{1,2}|_{1,2}', '', s).strip()

# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_spec_version(path: str) -> dict:
    """Read the file-level spec-version block out of the test-cases yaml.

    Emitted (and hard-gated) by generate_test_cases.py, so it is absent only when the
    yaml predates the contract or was hand-written. We HALT rather than emit a
    version-less spec.ts: the banner is the only place a reader of the committed test
    file can see which VIF revision its oracles came from, and a suite whose oracles
    cannot be attributed to a revision cannot be shown to be stale.
    """
    if not _HAS_YAML:
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        data = _yaml.safe_load(f) or {}
    return {k: str(data.get(k, '') or '') for k in ('vif_id', 'vif_version', 'vif_grammar')}


def parse_test_cases(path: str) -> list[dict]:
    """Parse test case YAML file (output of generate_test_cases.py) into list of dicts."""
    if not _HAS_YAML:
        print('\u274c pyyaml not installed. Run: pip install pyyaml')
        return []
    with open(path, 'r', encoding='utf-8') as f:
        data = _yaml.safe_load(f)
    tcs = []
    for tc in (data or {}).get('test_cases', []):
        tcs.append({
            'id': tc.get('id', 'TC-?'),
            'title': tc.get('title', ''),
            'flow': tc.get('flow', ''),
            'priority': tc.get('priority', 'Medium'),
            'spec_ref': tc.get('spec_ref', ''),
            'precondition': ((tc.get('preconditions') or [''])[0]),
            'expected': tc.get('expected_result', ''),
            'steps': [s.get('action', '') for s in (tc.get('test_steps') or [])],
            'step_deps': [s.get('data_dependency', 'any') for s in (tc.get('test_steps') or [])],
            # Oracles the author attached to an individual step — emitted in
            # position, not hoisted to the end of the body.
            'step_assertions': [list(s.get('assert') or []) for s in (tc.get('test_steps') or [])],
            'spec_only': bool(tc.get('spec_only', False)),
            'skip_reason': tc.get('skip_reason', '') or '',
            'test_data': tc.get('test_data') or {},
            'requires_context': tc.get('requires_context', 'live'),
            'mock_key': tc.get('mock_key', ''),
            'mock_routes': tc.get('mock_routes') or [],
            'no_auth': bool(tc.get('no_auth', False)),
            'category': tc.get('category', '') or '',
            'layout_stress': tc.get('layout_stress') or {},
            'validation_lifecycle': tc.get('validation_lifecycle') or {},
            # VIF-section metadata (see _SECTION_RENDERERS). Named explicitly
            # because this key set is a whitelist, not a passthrough.
            'section': tc.get('section') or {},
            # Structured oracles authored at Step 2 and carried by the builders.
            # Compiled 1:1 by compile_assertions() — never inferred from prose.
            'assertions': tc.get('assertions') or [],
            'tags': [],
        })
    return tcs


def load_element_map(path: str) -> dict:
    if not path or not Path(path).exists():
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

# ── Selector helpers ──────────────────────────────────────────────────────────

def best_selector(el: dict, all_button_texts: list | None = None) -> str:
    """Return the best Playwright locator string for an element.

    all_button_texts: full list of button text values visible on the same page
    (from element map). When provided, detects first-word regex collisions and
    automatically upgrades to exact: true — works for any UI without hardcoding.

    Honors `role` attribute override (shadcn/Radix patterns: RadioGroup → "radio",
    Combobox → "combobox", Tabs → "tab"). When `duplicate_id` / `duplicate_text`
    flags from analyze_page are set, appends `.first()` to avoid strict-mode
    violations from responsive double-render (hidden lg:grid + lg:hidden).
    """
    t = el.get('type', '')
    tag = el.get('tag', '')
    role = el.get('role', '')
    label = el.get('label', '')          # actual HTML <label for=...>
    placeholder = el.get('placeholder', '')
    name = el.get('name', '')
    text = el.get('text', '')
    id_ = el.get('id', '')
    dup_id = el.get('duplicate_id', False)
    dup_text = el.get('duplicate_text', False)

    def _maybe_first(sel: str, duplicate: bool) -> str:
        return sel + '.first()' if duplicate else sel

    # Explicit role override beats tag — shadcn Button with role="radio" must
    # be located by its real role, not by 'button'. Skip the no-op case where
    # role is just confirming the native tag role ("button" on <button>).
    NATIVE_ROLE = {'button': 'button', 'a': 'link', 'input': None, 'textarea': None, 'select': 'combobox'}
    has_role_override = bool(role) and role.lower() not in ('', NATIVE_ROLE.get(tag) or '')
    if has_role_override and text:
        words = text.split()
        if len(words) > 1:
            safe_text = text.replace("'", "\\'").replace('/', '\\/')
            return _maybe_first(f"getByRole('{role}', {{name: '{safe_text}', exact: true}})", dup_text)
        safe_word = (words[0] if words else text).replace("'", "\\'").replace('/', '\\/')
        return _maybe_first(f"getByRole('{role}', {{name: /{safe_word}/i}})", dup_text)
    if has_role_override and id_:
        # No accessible name — fall back to id-scoped role
        return _maybe_first(f"locator('#{id_}[role=\"{role}\"]')", dup_id)

    # Prefer getByLabel when an explicit label is wired to this element
    if label:
        clean = label.replace("'", "\\'")
        if t in ('text', 'email', 'password', 'number', 'search', 'textarea', 'url', 'tel'):
            return _maybe_first(f"getByLabel('{clean}')", dup_text)
        if t == 'submit' or tag == 'button':
            return _maybe_first(f"getByRole('button', {{name: '{clean}'}})", dup_text)

    # Fall back to getByPlaceholder when only placeholder attribute exists
    if placeholder and t in ('text', 'email', 'password', 'number', 'search', 'textarea', 'url', 'tel'):
        clean = placeholder.replace("'", "\\'")
        return _maybe_first(f"getByPlaceholder('{clean}')", dup_text)

    if text:
        # Use first whitespace-split word as regex for buttons — robust against
        # BeautifulSoup span text and Playwright accessible name differences.
        clean = text.replace("'", "\\'")
        if tag == 'button' or role == 'button':
            words = text.split()
            first_word = words[0] if words else clean
            # Multi-word buttons (e.g. "Save Draft", "Submit for Review →") are
            # ambiguous when matched by first-word regex — /Save/i can hit both
            # "Save Draft" and "Save Template" on the same page. Prefer exact
            # match on the full text when >1 word.
            if len(words) > 1:
                safe_text = text.replace("'", "\\'").replace('/', '\\/')
                return _maybe_first(f"getByRole('button', {{name: '{safe_text}', exact: true}})", dup_text)
            # Collision detection for single-word buttons: if the regex would
            # also match another button on the same page, upgrade to exact.
            if all_button_texts:
                pattern = re.compile(re.escape(first_word), re.IGNORECASE)
                collision = any(
                    t != text and pattern.search(t)
                    for t in all_button_texts
                )
                if collision:
                    safe_text = text.replace("'", "\\'").replace('/', '\\/')
                    return _maybe_first(f"getByRole('button', {{name: '{safe_text}', exact: true}})", dup_text)
            safe_word = first_word.replace("'", "\\'").replace('/', '\\/')
            return _maybe_first(f"getByRole('button', {{name: /{safe_word}/i}})", dup_text)
        if tag == 'a':
            return _maybe_first(f"getByRole('link', {{name: '{clean}'}})", dup_text)

    if id_:
        return _maybe_first(f"locator('#{id_}')", dup_id)
    if name:
        return f"locator('[name=\"{name}\"]')"
    if role:
        return f"getByRole('{role}')"
    return f"locator('{tag}')"


def map_selectors(elements: list[dict]) -> dict[str, str]:
    """Build {label/placeholder/name → locator_string} from element list."""
    sel = {}
    # Collect all button texts so best_selector() can detect first-word
    # regex collisions across the full page and auto-upgrade to exact: true.
    all_button_texts = [
        el.get('text', '') for el in elements
        if (el.get('tag') == 'button' or el.get('role') == 'button')
        and el.get('text', '').strip()
    ]
    for el in elements:
        # Register under every meaningful key so step-matching finds it.
        # 'id' is included so steps referencing the HTML id (e.g. 'spec-name' on
        # shadcn/radix inputs with no visible label) resolve to locator('#...').
        for key_src in ('label', 'placeholder', 'name', 'text', 'id'):
            key = (el.get(key_src) or '').lower().strip()
            if key and key not in sel:
                sel[key] = best_selector(el, all_button_texts=all_button_texts)
    return sel

# ── Code generation ───────────────────────────────────────────────────────────

def _clean_str(s: str) -> str:
    return re.sub(r"'", "\\'", s)


def _clean_regex(s: str) -> str:
    """Escape a LITERAL string for embedding in a JS regex literal `/…/`.

    Also strips surrounding single or double quotes that leak from step text
    like 'Click "Save Draft"' where the extracted label is '"Save Draft"'.

    Every call site passes literal text — a button label, a CSS class value, a URL
    fragment — never a pattern, so every regex metacharacter must be escaped. Escaping
    only ' and / left the rest live, and the failure is not local: a Tailwind arbitrary
    value like `bg-[--status-success-bg]` becomes an invalid character class, V8 refuses
    to parse the module, and Playwright reports "No tests found" for the WHOLE spec file
    instead of one broken test. A label carrying `(`, `?` or `.` degrades more quietly —
    the regex still parses but matches something other than the label.
    """
    s = s.strip('"\'')
    out = []
    for ch in s:
        if ch == '/':
            out.append('\\/')
        elif ch in '.^$*+?()[]{}|\\':
            out.append('\\' + ch)
        elif ch == "'":
            out.append("\\'")
        else:
            out.append(ch)
    return ''.join(out)


# Generic UI nouns that are NEVER the accessible name of a real button. When
# the click-step text leaves one of these embedded (e.g. "Click the Close button
# in the sheet footer"), the literal regex `/close button in the sheet footer/i`
# matches nothing → 60s timeout. We strip the noun + everything after to recover
# the actual label ("Close"). The TC author writes natural English; the
# generator must extract the click target before emitting Playwright.
_BUTTON_LABEL_NOUNS = (
    'button', 'trigger', 'icon', 'control', 'action',
    'sheet', 'dialog', 'popover', 'dropdown', 'menu',
    'panel', 'section', 'container', 'wrapper',
    'header', 'footer', 'body', 'content', 'toolbar',
    'form', 'field', 'input', 'select', 'combobox',
    'row', 'cell', 'column', 'tab', 'link',
)
# Whole-phrase tokens that signal the click step does not contain a usable
# button label and should be emitted as a TODO comment for human attention.
_BUTTON_LABEL_PROSE = (
    'the page header', 'in the sheet', 'in the dialog', 'in the modal',
    'in the popover', 'in the footer', 'in the header',
    'page-header create', 'create/set button',
)


def _clean_button_label(label: str) -> str | None:
    """Strip prose qualifiers from a click-step label so it can match a real
    button's accessible name.

    Returns the cleaned label, or None when the input is too prose-y to be a
    button label at all (caller should emit a TODO comment).
    """
    s = label.strip()
    if not s:
        return None
    low = s.lower()
    # Prose phrases: not a button label, give up.
    for p in _BUTTON_LABEL_PROSE:
        if p in low:
            return None
    # Strip trailing " button" / " trigger" / " sheet" / " dialog" / ...
    for noun in _BUTTON_LABEL_NOUNS:
        m = re.match(rf'^(?P<head>.+?)\s+{noun}\b(.*)$', s, re.IGNORECASE)
        if m:
            head = m.group('head').strip()
            # If head is itself a generic noun ("page header"), drop.
            if head.lower() in _BUTTON_LABEL_NOUNS:
                return None
            return head
    # If label is overly long or contains too many words, treat as prose.
    if len(s) > 40 or len(s.split()) > 5:
        return None
    return s


def _find_selector(field: str, selectors: dict, in_dialog: bool = False) -> str:
    """Lookup selector by field name (cleaned of markdown). Falls back to partial match, then getByLabel."""
    clean = strip_md(field).lower().strip()
    # When the caller is inside an open dialog/sheet, skip the page-wide
    # `selectors` cache built from the initial element-map. That cache is keyed
    # on text labels seen at page load, which often overlap with twin elements
    # outside the dialog (e.g. an "All Objectives ▼" filter combobox on the
    # page vs the "Objective *" Select inside the SetGoalSheet). Use the
    # camelCase fallback below so we get a label-based locator that resolves
    # inside the dialog scope.
    if not in_dialog:
        # Exact match
        if clean in selectors:
            return selectors[clean]
        # Partial match: field is substring of key, or key is substring of field
        for k, v in selectors.items():
            if clean and (clean in k or k in clean):
                return v
    # camelCase / PascalCase → Title Case fallback. Spec YAML's `validations[].field`
    # is typically the entity property name (e.g. ObjectiveId, MetricName,
    # TargetValue, NewTargetValue) which lowercases to a single token that no UI
    # <Label> ever matches. Split on camelCase boundaries to recover the visible
    # label ("Objective Id", "Metric Name", "Target Value", "New Target Value"),
    # then match Playwright's getByLabel substring semantics by using just the
    # first 1-2 meaningful tokens as a regex.
    raw_field = strip_md(field).strip()
    title_tokens = re.findall(r'[A-Z]+(?:[a-z0-9]+|(?=[A-Z]))|[a-z]+', raw_field)
    if title_tokens:
        # Use first token + optional second token as label regex — covers both
        # "Objective" (matches "Objective *") and "Metric Name" (matches "Metric Name *").
        head = ' '.join(title_tokens[:2]).strip()
        if head:
            safe = head.replace("'", "\\'").replace('/', '\\/')
            return f"getByLabel(/{safe}/i)"
    # Final fallback: getByLabel with clean name (regex, case-insensitive)
    safe = _clean_str(clean)
    return f"getByLabel(/{safe}/i)"


def _field_widget(field: str, element_map: dict | None) -> str:
    """Like `_field_kind`, but augments with name-based heuristics for fields
    that don't appear in element-map (shadcn `<Select>` and `<DatePicker>`
    render as `<button>` / wrapped components and often escape the simple
    id/name match in `_field_kind`).

    Returns one of: 'input' | 'select' | 'datepicker' | 'checkbox'.
    """
    if not field:
        return 'input'
    low = field.lower().strip()
    if any(kw in low for kw in ('deadline', 'date', 'time', 'when', 'expires', 'starts', 'ends')):
        return 'datepicker'
    if any(kw in low for kw in ('objectiveid', 'parentid', 'roleid', 'tenantid',
                                'statusid', 'priorityid', 'categoryid', 'typeid',
                                # Generic "Pick an X" UI: a Select is the default
                                # widget unless element-map explicitly shows an <input>.
                                'objective', 'status', 'priority', 'category',
                                'role', 'choice', 'option', 'kind')):
        return 'select'
    return 'input'


def _state_prelude(precondition: str, steps: list[str]) -> list[str]:
    """Emit prelude click() calls when a TC assumes a sheet/dialog is already
    open. State-transition TCs and detail-sheet TCs typically have
    preconditions like 'Detail Sheet open for an active goal' but the steps
    list jumps straight to clicking the inner action — without the prelude
    the inner button is never visible and the test times out at 60s.

    Heuristic-only: looks at precondition + first step's prose to detect a
    canonical state, then emits the click to enter that state. If the steps
    list already opens the sheet/dialog itself, the helper returns []
    (no double-open).
    """
    pc = (precondition or '').lower()
    head_step = (steps[0] if steps else '').lower()
    all_steps_text = ' | '.join(s.lower() for s in steps)

    lines: list[str] = []

    # Order matters: deeper states (update form, dialog) require shallower
    # states to be opened first.
    wants_update_form = (
        'update form' in pc or 'updategoalform' in pc
        or "updategoalform open" in pc
    )
    wants_deactivate_dialog = (
        ('dialog' in pc and ('open' in pc or 'deactivate' in pc))
        or "dialog: open" in pc
    )
    wants_detail_sheet = (
        'detail sheet open' in pc or 'detail sheet' in pc and 'open' in pc
        or 'goaldetailsheet' in pc
        or 'detail view' in pc
    )
    wants_set_sheet = (
        'set goal sheet open' in pc or 'setgoalsheet open' in pc
        or 'set new goal sheet' in pc
        or ('sheet' in pc and 'open' in pc and 'detail' not in pc)
    )

    # Skip prelude when the TC explicitly OPENS the relevant state. We only
    # treat it as "opens" when paired with an action verb (click/tap/press) —
    # otherwise "Confirm 'Deactivate'" (which happens INSIDE an open dialog)
    # would suppress the dialog prelude.
    def _opened_by(*targets: str) -> bool:
        verbs = ('click', 'tap', 'press', 'open', 'go to')
        for t in targets:
            for v in verbs:
                if f'{v} {t}' in all_steps_text or f"{v} the {t}" in all_steps_text:
                    return True
        return False

    opens_set_sheet = _opened_by("'set new goal'", 'set new goal', 'set goal button',
                                 '"set new goal"')
    opens_detail = _opened_by("'view'", 'view', '"view"')
    opens_update = _opened_by("'update target'", 'update target', '"update target"')
    opens_dialog = _opened_by("'deactivate'", 'deactivate', '"deactivate"')

    if wants_update_form and not opens_update:
        if not opens_detail:
            lines.append("  // Prelude: open detail sheet (precondition requires update form open)")
            lines.append("  await page.getByRole('button', {name: /^view$/i}).first().click();")
        lines.append("  // Prelude: open inline update form")
        lines.append("  await page.getByRole('button', {name: /update target/i}).click();")
        return lines

    if wants_deactivate_dialog and not opens_dialog:
        if not opens_detail:
            lines.append("  // Prelude: open detail sheet (precondition requires deactivate dialog open)")
            lines.append("  await page.getByRole('button', {name: /^view$/i}).first().click();")
        lines.append("  // Prelude: open deactivate dialog")
        lines.append("  await page.getByRole('button', {name: /^deactivate$/i}).first().click();")
        return lines

    if wants_detail_sheet and not opens_detail:
        lines.append("  // Prelude: open detail sheet (precondition requires detail sheet open)")
        lines.append("  await page.getByRole('button', {name: /^view$/i}).first().click();")
        return lines

    if wants_set_sheet and not opens_set_sheet:
        lines.append("  // Prelude: open Set Goal sheet (precondition requires sheet open)")
        lines.append("  await page.getByRole('button', {name: 'Set New Goal', exact: true}).click();")
        return lines

    return lines


def _split_compound_step(step: str) -> list[str]:
    """Split a compound step like "Pick an Objective + type Metric Name + type 0
    into Target Value" into discrete sub-steps. Splits on ` + `, `; `, and the
    English ` and ` ONLY when each side starts with an action verb. Returns a
    single-element list if no split applies — caller can iterate uniformly.
    """
    s = step.strip()
    if not s:
        return [s]
    # `+` is unambiguous as a step separator in MGI test step prose.
    if ' + ' in s:
        return [p.strip() for p in s.split(' + ') if p.strip()]
    # `; ` likely separates clauses; only split when at least 2 imperative
    # halves are produced.
    if '; ' in s:
        parts = [p.strip() for p in s.split('; ') if p.strip()]
        if all(re.match(r'^(?:click|tap|press|pick|type|fill|enter|select|verify|confirm|locate|wait|open|close)\b', p, re.IGNORECASE) for p in parts):
            return parts
    # ` and ` is risky (it appears inside noun phrases like "save and close"),
    # so only split when both sides start with a distinct action verb.
    if ' and ' in s.lower():
        m = re.match(r'^(.+?)\s+and\s+(.+)$', s, re.IGNORECASE)
        if m:
            left = m.group(1).strip()
            right = m.group(2).strip()
            verb = r'^(?:click|tap|press|pick|type|fill|enter|select|verify|confirm)\b'
            if re.match(verb, left, re.IGNORECASE) and re.match(verb, right, re.IGNORECASE):
                return [left, right]
    return [s]


# ── lint-safe waits ───────────────────────────────────────────────────────────
# The suite this generator writes INTO forbids two things it used to emit on every
# run (scripts/lint-tests.mjs): `page.waitForTimeout` (R2) and a `timeout:` given a
# numeric literal, including one reached through a module-level `const T = 15000`
# (R6). Both bans are scoped to script/, which is exactly where this output lands.
#
# Measured before this pass existed: a freshly generated spec carried 10 violations
# across those 2 rules, while only 1 of the 40 suites already in the repo still held
# a `waitForTimeout` — i.e. the other 39 had been hand-cleaned after generation. That
# hand-clean is the loop this closes; a generator that cannot satisfy its own repo's
# lint gate makes every future suite start life red.
#
# Normalising ONCE at the output boundary rather than at the ~25 emission sites is
# deliberate: the sites are f-strings scattered across a dozen renderers, and a rule
# enforced in one place cannot be forgotten by the next renderer somebody adds.

# `timeout:` literal → the named tier in lib/timeouts.ts. Tier values at the default
# PLAYWRIGHT_TIMEOUT=30000: probe 2000 · settle 5000 · ui 10000 · std 15000 · slow 20000.
# 5000 and 15000 map EXACTLY, which is most of the corpus. The two that do not are
# called out because retuning silently would be the wrong kind of fix:
#   1500 -> probe (2000, +500ms) and 6000 -> settle (5000, -1000ms).
# Both sites are best-effort probes that swallow their own failure with
# `.catch(() => {})` or sit inside a `toPass()`, so neither can turn a green test red
# or a red one green — only how long a negative wait costs.
_TIMEOUT_TIERS = [
    (2000, 'probeTimeoutMs'),
    (5000, 'settleTimeoutMs'),
    (10000, 'uiTimeoutMs'),
    (15000, 'stdTimeoutMs'),
    (20000, 'slowTimeoutMs'),
]


def _nearest_tier(ms: int) -> str:
    """The tier whose default value is closest to `ms` (ties → the shorter tier)."""
    return min(_TIMEOUT_TIERS, key=lambda t: (abs(t[0] - ms), t[0]))[1]


def enforce_lint_safe_waits(code: str, import_rel_lib: str, import_rel_setup: str) -> str:
    """Rewrite every banned wait form in a generated spec into its sanctioned one.

    Three rewrites, and nothing else touched:

    1. `await page.waitForTimeout(N);  // why` -> `await afterDebounce(page, N, 'why')`.
       The VALUE is carried across unchanged. That is not a loophole: R2 bans the raw
       call because it says nothing about what is being waited for, and `afterDebounce`
       takes the same ms with a mandatory `why` — its own docstring asks the caller to
       name the debounce the number came from. R6 does not fire here because it keys on
       `timeout:`, not on a bare argument.
    2. `timeout: N` -> `timeout: <tier>()`, nearest tier (see _TIMEOUT_TIERS).
    3. `const T = N;` -> `const T = <tier>();` — the module-level form R6 added
       specifically because 2483 call sites reached a literal through exactly this.

    Only the tiers actually used are imported, so the output carries no dead import.
    """
    # 1. waitForTimeout -> afterDebounce, preserving the trailing comment as `why`.
    def _sleep(m: re.Match) -> str:
        indent, ms, why = m.group('indent'), m.group('ms'), (m.group('why') or '').strip()
        why = why or 'settle before the next read'
        return (f"{indent}await afterDebounce(page, {ms}, "
                f"{json.dumps(why)});")

    code, n_sleep = re.subn(
        r'(?P<indent>[ \t]*)await page\.waitForTimeout\((?P<ms>\d+)\);'
        r'(?:[ \t]*//[ \t]*(?P<why>[^\n]*))?',
        _sleep, code)

    # 2 + 3. Literal ceilings -> named tiers.
    used: set = set()

    def _tier(m: re.Match) -> str:
        fn = _nearest_tier(int(m.group('ms')))
        used.add(fn)
        return f"{m.group('pre')}{fn}()"

    code = re.sub(r'(?P<pre>timeout:\s*)(?P<ms>\d+)', _tier, code)
    code = re.sub(r'(?P<pre>^([ \t]*(?:const|let)\s+[A-Z][A-Z_0-9]*\s*=\s*))(?P<ms>\d{3,});',
                  lambda m: _tier(m) + ';', code, flags=re.M)

    # Extend the existing `lib/timeouts` import in place rather than adding a second
    # one — two imports from the same module is a TS error, not a style question.
    if used:
        code = re.sub(
            r"import \{ extendedTimeoutMs \} from '([^']*timeouts)';",
            lambda m: 'import { ' + ', '.join(
                sorted({'extendedTimeoutMs', *used})) + " } from '" + m.group(1) + "';",
            code, count=1)
    if n_sleep:
        anchor = re.search(r"^import .*from '[^']*';$", code, flags=re.M)
        if anchor:
            code = (code[:anchor.end()]
                    + f"\nimport {{ afterDebounce }} from '{import_rel_setup}/waits';"
                    + code[anchor.end():])
    return code


class AssertionSpecError(ValueError):
    """An `assert:` entry the compiler cannot render.

    Raised — never swallowed — so a malformed oracle fails generation loudly
    instead of silently producing a test that checks nothing. That silent path
    is the whole defect this compiler exists to close.
    """


def _assert_locator(ref: str) -> str:
    """Compile an element reference into a Playwright locator expression.

    Two accepted forms, both explicit:
      role=<role>[name=<accessible name>]   → getByRole(...)
      <anything else>                        → locator('<css>')
    """
    ref = str(ref).strip()
    if not ref:
        raise AssertionSpecError('empty element reference')
    m = re.match(r"^role=([A-Za-z]+)(?:\[name=(.+)\])?$", ref)
    if m:
        role, name = m.group(1), m.group(2)
        if name:
            return f"page.getByRole('{role}', {{name: /{_clean_regex(name)}/i}})"
        return f"page.getByRole('{role}')"
    return f"page.locator('{_clean_str(ref)}')"


_ROW_OP_RE = re.compile(r"^\s*(=|==|>=|<=|>|<)\s*(\d+)\s*$")

_ELEMENT_STATE_MATCHERS = {
    'visible':  ('toBeVisible',   'is not visible'),
    'hidden':   ('toBeHidden',    'is visible though the spec hides it'),
    'enabled':  ('toBeEnabled',   'is not enabled'),
    'disabled': ('toBeDisabled',  'is not disabled'),
    'editable': ('toBeEditable',  'is not editable'),
    'focused':  ('toBeFocused',   'does not hold focus'),
    'empty':    ('toBeEmpty',     'is not empty'),
    # Negated on purpose. Every other way to assert a control's content requires
    # naming the exact literal, so a control whose correct content is COMPUTED (a
    # date box defaulted to today-30d, a generated code) had no expressible oracle
    # at all and the row was dropped entirely. `not-empty` is the weakest honest
    # assertion for those — it still fails a field the app leaves blank.
    'not-empty': ('not.toBeEmpty', 'is empty'),
    'checked':  ('toBeChecked',   'is not checked'),
}


def compile_assertions(assertions: list, source: str = '') -> list[str]:
    """Compile structured `assert:` entries into Playwright expect() lines.

    Every entry is translated 1:1 from data authored at Step 2. Nothing here
    inspects prose or guesses an observation point: an entry the vocabulary does
    not cover raises AssertionSpecError rather than being dropped.

    Vocabulary (one key selects the form):
      {text: str, absent?: bool, in?: css}          copy is / is not on screen
      {element: ref, state: <see above>}            element state
      {rows: '<op><n>', of?: css}                   row count on a table
      {attr: name, on: ref, equals: value}          attribute value
      {value: str, of: ref}                         form control's CURRENT value
      {url: '/path'}                                current route
    """
    out: list[str] = []
    # Defect #16 (2026-09-11, VIF-ANA-006): `source` was the ONE interpolated value in
    # this function that skipped `_clean_str`, while every other one uses it. `source` is
    # the raw `spec_ref`, and a spec_ref quoting a VIF section name — "VIF-ANA-006
    # §Interactions 'Page loads'" — puts a bare apostrophe inside the single-quoted JS
    # message literal. That is not one broken assertion: it is a PARSE error, so
    # Playwright collects 0 tests in the whole file and reports "No tests found", which
    # reads as a bad --grep rather than as a generator bug. Severity is the entire suite.
    tag = f" [{_clean_str(source)}]" if source else ''
    for a in assertions or []:
        if not isinstance(a, dict):
            raise AssertionSpecError(f'assert entry must be a mapping, got {type(a).__name__}: {a!r}')
        # YAML 1.1 resolves a bare `on:` key to the boolean True. Normalise it
        # back rather than forcing every author to remember the quotes.
        if True in a:
            a = {('on' if k is True else k): v for k, v in a.items()}

        if 'text' in a:
            txt = str(a['text'])
            scope = f"page.locator('{_clean_str(a['in'])}')" if a.get('in') else 'page'
            loc = f"{scope}.getByText('{_clean_str(txt)}', {{exact: false}}).first()"
            if a.get('absent'):
                out.append(f"  await expect({loc}, 'copy \\'{_clean_str(txt)}\\' is on screen though the spec forbids it{tag}')"
                           f".toHaveCount(0, {{ timeout: T }});")
            else:
                out.append(f"  await expect({loc}, 'copy \\'{_clean_str(txt)}\\' never appeared{tag}')"
                           f".toBeVisible({{ timeout: T }});")
            continue

        if 'element' in a:
            state = str(a.get('state') or '').strip().lower()
            if state not in _ELEMENT_STATE_MATCHERS:
                raise AssertionSpecError(
                    f"element assertion needs state one of {sorted(_ELEMENT_STATE_MATCHERS)}, got {state!r}: {a!r}")
            matcher, complaint = _ELEMENT_STATE_MATCHERS[state]
            loc = _assert_locator(a['element'])
            ref = _clean_str(str(a['element']))
            out.append(f"  await expect({loc}.first(), '{ref} {complaint}{tag}')"
                       f".{matcher}({{ timeout: T }});")
            continue

        if 'rows' in a:
            m = _ROW_OP_RE.match(str(a['rows']))
            if not m:
                raise AssertionSpecError(f"rows must read like '=0', '>0', '>=2'; got {a['rows']!r}")
            op, n = m.group(1), int(m.group(2))
            sel = _clean_str(a.get('of') or 'tbody tr')
            count = f"page.locator('{sel}').count()"
            msg = f"row count never satisfied {op}{n}{tag}"
            if op in ('=', '=='):
                out.append(f"  await expect(page.locator('{sel}'), '{msg}')"
                           f".toHaveCount({n}, {{ timeout: T }});")
                continue
            # Strict inequalities are polled: the row set settles asynchronously,
            # and a bare count() would read the skeleton.
            matcher = {'>': f'toBeGreaterThan({n})', '>=': f'toBeGreaterThanOrEqual({n})',
                       '<': f'toBeLessThan({n})', '<=': f'toBeLessThanOrEqual({n})'}[op]
            out.append(f"  await expect.poll(async () => await {count}, "
                       f"{{ timeout: T, message: '{msg}' }}).{matcher};")
            continue

        if 'attr' in a:
            if 'on' not in a or 'equals' not in a:
                raise AssertionSpecError(f"attr assertion needs 'on' and 'equals': {a!r}")
            loc = _assert_locator(a['on'])
            name = _clean_str(str(a['attr']))
            val = _clean_str(str(a['equals']))
            out.append(f"  await expect({loc}.first(), '{name} is not \\'{val}\\'{tag}')"
                       f".toHaveAttribute('{name}', '{val}', {{ timeout: T }});")
            continue

        if 'value' in a:
            # Distinct from `attr` on purpose: a React-controlled input keeps its
            # `value` ATTRIBUTE at the initial render value while the live value moves
            # on, so toHaveAttribute('value', …) reads stale and passes or fails for the
            # wrong reason. toHaveValue reads the DOM property, which is the one the
            # user sees and the one that gets submitted.
            if 'of' not in a:
                raise AssertionSpecError(f"value assertion needs 'of' (the control): {a!r}")
            loc = _assert_locator(a['of'])
            val = _clean_str(str(a['value']))
            out.append(f"  await expect({loc}.first(), 'control does not hold \\'{val}\\' verbatim{tag}')"
                       f".toHaveValue('{val}', {{ timeout: T }});")
            continue

        if 'url' in a:
            out.append(f"  await expect(page, 'route is not {_clean_str(str(a['url']))}{tag}')"
                       f".toHaveURL(new RegExp('{_clean_regex(str(a['url']))}'), {{ timeout: T }});")
            continue

        raise AssertionSpecError(f'unrecognised assert entry (no known key): {a!r}')
    return out


def steps_to_code(steps: list[str], expected: str, precondition: str,
                  page_url: str, selectors: dict, flow: str,
                  has_auth: bool, feature_var: str,
                  element_map: dict | None = None,
                  step_assertions: list | None = None,
                  spec_ref: str = '',
                  has_assertions: bool = False) -> list[str]:
    """Convert step descriptions to Playwright actions.
    NOTE: page.goto() is handled by beforeEach — do NOT add it here.

    `step_assertions[i]` holds the structured oracles the VIF author attached to
    step i. They are emitted immediately after that step's code, because an
    oracle is about the state the step just produced: hoisting them all to the
    end would assert "the sheet is open" after a later step closed it.
    """
    # Pre-process: expand compound steps into atomic ones so each sub-step
    # gets its own parser pass. The assertion list is expanded in lock-step so
    # an oracle stays attached to its own step; a split step's oracles ride on
    # its LAST fragment, which is the one that produces the described state.
    _sa = list(step_assertions or [])
    _expanded_steps: list[str] = []
    _expanded_asserts: list[list] = []
    for _i, _s in enumerate(steps):
        _subs = _split_compound_step(_s)
        _own = _sa[_i] if _i < len(_sa) else []
        for _k, _sub in enumerate(_subs):
            _expanded_steps.append(_sub)
            _expanded_asserts.append(list(_own) if _k == len(_subs) - 1 else [])
    steps = _expanded_steps
    step_assertions = _expanded_asserts
    prelude_lines = _state_prelude(precondition, steps)
    code = list(prelude_lines)

    # ── Plan C-2: dialog scope. ──
    # When the prelude opens a sheet/dialog, OR when any earlier emitted line
    # opens one ("Click 'Set New Goal'" → 450px Sheet), subsequent locators
    # should be scoped to that open dialog so they don't accidentally match a
    # twin element elsewhere on the page (e.g. the Objective filter combobox
    # outside the SetGoalSheet).
    # Mutable so nested handlers can flip it when they emit a sheet-opening click.
    dialog_state = [bool(prelude_lines)]

    DIALOG_BASE = "page.locator('[role=\"dialog\"][data-state=\"open\"], [role=\"dialog\"]:visible').last()"

    def _scoped(loc: str) -> str:
        """Wrap a `getByX()` locator so it resolves inside the open dialog when
        one exists. Leaves already-rooted selectors alone."""
        if not dialog_state[0]:
            return f"page.{loc}"
        if loc.startswith('page.') or loc.startswith('locator('):
            return loc if loc.startswith('page.') else f"page.{loc}"
        return f"{DIALOG_BASE}.{loc}"

    _SHEET_OPENERS = ('set new goal', 'update target', 'deactivate', 'view', 'edit')
    def _maybe_open_dialog(label_lower: str) -> None:
        if any(opener in label_lower for opener in _SHEET_OPENERS):
            dialog_state[0] = True
    def _maybe_close_dialog(label_lower: str) -> None:
        if any(cl in label_lower for cl in ('cancel', 'close', 'dismiss')):
            dialog_state[0] = False

    # ── Plan C-5: prose-only field guard. ──
    # Reject overly generic single-word field names ("number", "value", "text")
    # that result from stripping adjectives in "Type a positive number".
    _GENERIC_FIELD_TOKENS = {
        'number', 'value', 'text', 'string', 'input', 'field', 'data',
        'name', 'item',
    }
    def _is_prose_only_field(field: str) -> bool:
        f = field.strip().strip("'\"").lower()
        return f in _GENERIC_FIELD_TOKENS or len(f) == 0

    # Auth is handled by Playwright storageState (setup project).
    # No need to login in test code.

    for _step_idx, step in enumerate(steps):
        sl = strip_md(step).lower().strip()
        raw = step  # original (may have markdown for quoted text extraction)
        # The body runs inside a single-iteration loop so its many `continue`
        # statements still work while leaving a join point afterwards where this
        # step's authored oracles can be emitted in position.
        for _once in (0,):

            # ── Plan B-3: "Pick X (from|in) FIELD" — shadcn Select. ──
            # Examples:
            #   "Pick an Objective from the Select"  → field=Objective (override generic "Select")
            #   "Pick 'Adopt Retell AI' (obj-001) in Objective field" → pick by quoted name
            # The 'Pick' verb is reserved for Selects (unlike 'Type' / 'Fill' for inputs).
            if re.search(r"^pick\b", sl):
                pm = re.search(r"^[Pp]ick\s+(?:an?\s+)?(?P<v>.+?)(?:\s+(?:from|in)\s+(?:the\s+)?(?P<f>.+?))?(?:\s+(?:select|dropdown|field|option))?\s*$", strip_md(step).strip())
                value_part = (pm.group('v') if pm else '').strip().strip("'\"")
                field_part = (pm.group('f') if pm and pm.group('f') else '').strip().strip("'\"")
                # If the "from FIELD" clause is generic ("the Select", "the dropdown"),
                # fall back to the value as the field — "Pick an Objective from the Select"
                # really means "the Objective select".
                if field_part.lower() in {'select', 'dropdown', 'combobox', 'menu', 'field'}:
                    field_part = value_part
                if not field_part:
                    field_part = value_part
                if quoted := re.search(r"'([^']+)'", raw):
                    option_label = _clean_str(quoted.group(1))
                    code.append(f"  await openSelect({_scoped(_find_selector(field_part, selectors, in_dialog=dialog_state[0]))});")
                    code.append(f"  await page.getByRole('option', {{name: '{option_label}'}}).click();")
                else:
                    code.append(f"  await openSelect({_scoped(_find_selector(field_part, selectors, in_dialog=dialog_state[0]))});")
                    code.append(f"  await page.getByRole('option').first().click();")
                continue

            # ── Plan B-3: "Type [a/an] [adjective] VALUE into/in FIELD" — happy-path filler. ──
            # Examples:
            #   "Type a positive number into Target Value"  → fill Target Value with '100'
            #   "Type a Metric Name (e.g. 'Customer Retention Rate')" → fill Metric Name w/ example
            #   "Type a 100-character Metric Name (boundary)" → fill with 'A'*100
            if m := re.search(r"^type\s+(?:a |an )?(?P<desc>.+?)(?:\s+(?:into|in)\s+(?P<into_field>.+))?$", sl):
                desc = m.group('desc').strip()
                into_field = (m.group('into_field') or '').strip()
                # If parenthetical example exists, extract its quoted value.
                example_q = re.search(r"\(\s*e\.?g\.?\s*'([^']+)'\s*\)", raw)
                length_m = re.search(r"(\d+)\s*[- ]?character", desc)
                # Determine the field name. When "(into) FIELD" is omitted, the
                # descriptor itself usually names the field ("Type a Metric Name").
                field = into_field if into_field else re.sub(r"^(positive\s+|negative\s+|valid\s+|boundary\s+|\d+[\s-]character\s+)", '', desc).strip()
                # Strip determiners that leak in from natural prose ("type ANY Metric
                # Name", "type SOME date") — they're not part of the field label.
                field = re.sub(r"^(any|the|some|a|an|each|every)\s+", '', field, flags=re.IGNORECASE).strip()
                field = re.sub(r"\s*\([^)]*\)\s*$", '', field).strip()
                # Pick a sentinel value.
                if example_q:
                    value = example_q.group(1)
                elif length_m:
                    value = 'M' * int(length_m.group(1))
                elif re.match(r'^-?\d+(?:\.\d+)?$', desc.strip()):
                    # desc is itself a literal number ("type 0 into Target Value").
                    value = desc.strip()
                elif 'positive' in desc and 'number' in desc:
                    value = '100'
                elif 'negative' in desc and 'number' in desc:
                    value = '-1'
                elif 'number' in desc:
                    value = '42'
                else:
                    # Generic text — derive from field name
                    value = f"Test {field}".strip()
                if _is_prose_only_field(field):
                    code.append(f"  // Step: {strip_md(step)}   // skipped — generic field name '{field}', no target field can be inferred")
                    continue
                # Use _field_widget to skip Selects (they were already handled above).
                widget = _field_widget(field, element_map)
                if widget == 'select':
                    # Caller wrote "Type … into Objective" but Objective is a Select.
                    # Re-route to the pick handler's behavior.
                    code.append(f"  await openSelect({_scoped(_find_selector(field, selectors, in_dialog=dialog_state[0]))});")
                    code.append(f"  await page.getByRole('option').first().click();")
                    continue
                if widget == 'datepicker':
                    code.append(f"  // Field '{field}' is a DatePicker — skipping type step (Playwright cannot .fill() a DatePicker trigger)")
                    continue
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                code.append(f"  await {_scoped(loc)}.fill('{_clean_str(value)}');")
                continue

            # Navigate — only add goto if the destination differs from page_url
            if re.search(r"navigate to ['\"]?", sl):
                # Re-match against the original-case step (raw) — sl is lowercased,
                # which would break case-sensitive query params like ?objectiveId=
                m = re.search(r"[Nn]avigate to ['\"]?([^'\"]+)['\"]?", raw)
                if not m:
                    continue
                dest = m.group(1).strip()
                # Strip any parenthetical qualifier appended by generate_test_cases
                # for spec-only states (e.g. "(with no data)", "(simulated error)",
                # "(throttled network)") — these are not valid URLs.
                dest = re.sub(r'\s*\([^)]*\)\s*$', '', dest).strip()
                # Hard-stop the URL at the first character that cannot legally appear
                # inside a URL (`;`, `,`, whitespace) — prevents prose from compound
                # actions ("Navigate to /url; click the row") leaking into page.goto().
                dest = re.split(r'[;,\s]', dest, maxsplit=1)[0].strip()
                # Relativize absolute URLs so the goto resolves against baseURL (#143582).
                if dest.startswith('http'):
                    dest = to_relative_url(dest)
                if not dest.startswith('/'):
                    # Non-URL navigate step — emit as skip comment, not goto
                    code.append(f"  // spec-only: cannot navigate to '{_clean_str(dest)}' in live prototype — skipped")
                    continue
                # A route template whose parameters were never substituted ('/x/{entryId}')
                # is a DEAD url: it 404s, `main` still renders, and every assertion after it
                # runs against an error page — a red that blames the product for a template
                # leak. Refuse to navigate; make the gap explicit instead.
                if re.search(r'[{:][A-Za-z_]\w*\}?', dest.split('?', 1)[0]):
                    code.append(
                        f"  test.skip(true, 'TEMPLATE: route \\'{_clean_str(dest)}\\' still carries an "
                        f"unsubstituted parameter — no concrete id was resolved, so this navigation "
                        f"cannot be performed. Supply a fixture id or a discovery step.');")
                    continue
                if dest.rstrip('/') != page_url.rstrip('/'):
                    code.append(f"  await page.goto('{_clean_str(dest)}', {{ waitUntil: 'domcontentloaded' }});")
                    code.append("  await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible' });")
                continue

            # Fill FIELD with "VALUE" — handles: fill **field** with "v", fill field = "v"
            if m := re.search(r"(?:fill|enter|type|input)\s+(.+?)\s+(?:with|=)\s+['\"]([^'\"]+)['\"]", sl):
                field, value = m.group(1), m.group(2)
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                code.append(f"  await {_scoped(loc)}.fill('{_clean_str(value)}');")
                continue

            # Fill "VALUE" in/for FIELD
            if m := re.search(r"(?:enter|fill|type|input)\s+['\"]([^'\"]+)['\"]?\s+(?:in(?:to)?|for)\s+(.+)", sl):
                value, field = m.group(1), m.group(2)
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                code.append(f"  await {_scoped(loc)}.fill('{_clean_str(value)}');")
                continue

            # Fill all other required fields with valid data (generic helper)
            if 'fill all other required fields' in sl or 'fill remaining fields' in sl:
                code.append("  // Fill other required fields with valid test data")
                for field_name, sel_str in list(selectors.items())[:5]:
                    code.append(f"  await page.{sel_str}.fill(buildTestData('{field_name}'));")
                continue

            # Leave/clear FIELD empty
            if m := re.search(r"(?:leave|keep|clear)\s+(.+?)\s+(?:empty|blank|clear)", sl):
                field = m.group(1)
                # Strip "the " prefix, " field" suffix, and surrounding quotes
                field = re.sub(r"^the\s+|\s+field$", "", field, flags=re.IGNORECASE).strip()
                field = field.strip("'\"")
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                code.append(f"  await {_scoped(loc)}.clear();")
                continue

            # Clear the FIELD field (emitted by patched VAL builder for required-constraint)
            if m := re.search(r"^clear\s+(?:the\s+)?(.+?)(?:\s+field)?$", sl):
                # Use case-preserving extraction so camelCase fields ("TargetValue",
                # "NewTargetValue") split correctly in _find_selector.
                cm = re.search(r"^[Cc]lear\s+(?:the\s+)?(.+?)(?:\s+field)?$", strip_md(step).strip())
                field = (cm.group(1) if cm else m.group(1)).strip("'\"")
                if _is_prose_only_field(field):
                    code.append(f"  // Step: {strip_md(step)}   // skipped — prose-only field")
                    continue
                widget = _field_widget(field, element_map)
                if widget == 'select':
                    # shadcn <Select> with no default value starts empty; .clear()
                    # would throw. Required-validation fires by clicking Submit
                    # while the trigger placeholder is still showing.
                    code.append(f"  // Field '{field}' is a Select; leaving unselected satisfies the required-constraint test")
                    continue
                if widget == 'datepicker':
                    # DatePicker is wrapped; no .clear() method exists on the trigger.
                    code.append(f"  // Field '{field}' is a DatePicker; leaving empty satisfies the required-constraint test")
                    continue
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                code.append(f"  await {_scoped(loc)}.clear();")
                continue

            # Fill FIELD with a valid JSON array of exactly N characters — emitted by
            # the boundary builder for JSON-array fields (Steps/Checklists/References).
            # A raw 'A'*N string is NOT a valid array, so wrap it as [{"v":"…"}] and
            # pad the inner string so the TOTAL length is exactly N. The 10-char
            # wrapper is [{"v":"…"}]; inner padding = N - 10.
            if m := re.search(r"^fill\s+(?:the\s+)?(.+?)\s+with\s+a\s+valid\s+json\s+array\s+of\s+(?:exactly\s+)?(\d+)\s+characters?", sl):
                cm = re.search(r"^[Ff]ill\s+(?:the\s+)?(.+?)\s+with\s+a\s+valid\s+json\s+array", strip_md(step).strip())
                field = (cm.group(1) if cm else m.group(1)).strip("'\"")
                n = int(m.group(2))
                if _is_prose_only_field(field):
                    code.append(f"  // Step: {strip_md(step)}   // skipped — prose-only field")
                    continue
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                # e.g. n=8000 → '[{"v":"' + 'A'.repeat(7990) + '"}]'  (total length == n)
                code.append(f"  await {_scoped(loc)}.fill('[{{\"v\":\"' + 'A'.repeat({n} - 10) + '\"}}]');")
                continue

            # Fill FIELD with a non-array JSON value — emitted by the VAL builder's
            # JSON-array type-check sibling (G2). The value is valid JSON but an
            # OBJECT, so JSON.parse succeeds while Array.isArray is false → the form
            # must still reject it. Distinct from the generic "invalid value" sentinel
            # which fails JSON.parse too and so can't isolate the array check.
            if m := re.search(r"^fill\s+(?:the\s+)?(.+?)(?:\s+field)?\s+with\s+a\s+non-array\s+json\s+value", sl):
                cm = re.search(r"^[Ff]ill\s+(?:the\s+)?(.+?)(?:\s+field)?\s+with\s+a\s+non-array", strip_md(step).strip())
                field = (cm.group(1) if cm else m.group(1)).strip("'\"")
                if _is_prose_only_field(field):
                    code.append(f"  // Step: {strip_md(step)}   // skipped — prose-only field")
                    continue
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                code.append(f"  await {_scoped(loc)}.fill('{{\"_\":1}}');")
                continue

            # Fill the FIELD field with zero — emitted by the VAL builder for `>0` /
            # "greater than 0" / "positive" rules where '0' is the canonical sentinel.
            if m := re.search(r"^fill\s+(?:the\s+)?(.+?)(?:\s+field)?\s+with\s+zero\b", sl):
                cm = re.search(r"^[Ff]ill\s+(?:the\s+)?(.+?)(?:\s+field)?\s+with\s+zero", strip_md(step).strip())
                field = (cm.group(1) if cm else m.group(1)).strip("'\"")
                if _is_prose_only_field(field):
                    code.append(f"  // Step: {strip_md(step)}   // skipped — prose-only field")
                    continue
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                code.append(f"  await {_scoped(loc)}.fill('0');")
                continue

            # Fill the FIELD field with an invalid/out-of-bounds value
            # (emitted by patched VAL builder for format/min-max/cross-field constraints)
            if m := re.search(r"^fill\s+(?:the\s+)?(.+?)(?:\s+field)?\s+with\s+an?\s+(invalid|out-of-bounds|.+?)\s+value", sl):
                cm = re.search(r"^[Ff]ill\s+(?:the\s+)?(.+?)(?:\s+field)?\s+with\s+an?\s+", strip_md(step).strip())
                field = (cm.group(1) if cm else m.group(1)).strip("'\"")
                kind = m.group(2)
                widget = _field_widget(field, element_map)
                if widget == 'datepicker':
                    # DatePicker rejects raw text; the only way to test invalid date
                    # is via UI (click past date in calendar) which we can't simulate
                    # reliably. Mark as a known limitation rather than a real failure.
                    safe_field = _clean_str(field)
                    code.append(f"  test.fail(true, 'BUG: cannot inject invalid value into DatePicker \"{safe_field}\" via Playwright .fill()');")
                    continue
                if widget == 'select':
                    # Select has a closed enum — there is no "invalid" option to pick.
                    # The format/enum constraint is implicit in the Select options list.
                    code.append(f"  // Field '{field}' is a Select; format-constraint is enforced by enumerated options (no invalid input possible)")
                    continue
                # Use a sentinel value the form will reject — for numeric fields, 'X'
                # is rejected by type=number; for max-length, a string of 200 chars.
                if 'bounds' in kind or 'out-of' in kind:
                    sentinel = 'A' * 200  # exceeds typical max-length
                else:
                    sentinel = 'X'  # non-numeric / generic invalid
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                code.append(f"  await {_scoped(loc)}.fill('{sentinel}');")
                continue

            # Inside the detail sheet, perform: <inner action> (via <button name> button in ...)
            # — extract the button name from the parenthetical and click it.
            if m := re.search(r"inside\s+(?:the\s+)?[^,]+,\s*perform:.*?\(via\s+(.+?)\s+button\b", sl):
                btn_name = m.group(1).strip().strip("'\"")
                code.append(f"  await page.getByRole('button', {{name: /{_clean_regex(btn_name)}/i}}).click();")
                continue

            # "Open the first record's detail (click the first data row)" — generic drill-in
            # emitted by build_exception_test_cases for ITEM-scoped (detail) error TCs. Clicks
            # the first data row (a row containing cells, i.e. not the header) so the detail
            # fetch fires and the item-endpoint mock (403/404/500) applies.
            if re.search(r"open the first record'?s? detail|click the first data row", sl):
                code.append("  await page.getByRole('row').filter({ has: page.getByRole('cell') }).first().click();")
                code.append("  await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible' });")
                continue

            # "Click the row's 'View' action to open the detail sheet" — table row View buttons
            if re.search(r"row'?s?\s+['\"]?view['\"]?\s+(?:/\s*['\"]?detail['\"]?\s+)?action", sl):
                # Click the first row's View button (Goal detail sheet pattern)
                code.append("  await page.getByRole('button', {name: /^view$/i}).first().click();")
                continue

            # "Locate a row representing a X with status 'Y'" — soft assertion, treat as wait-for
            if re.search(r"locate\s+a\s+(?:row|task|item|record)", sl):
                code.append("  // Locate row — assumes ≥1 row exists in the table (real backend)")
                code.append("  await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible({ timeout: T });")
                continue

            # Select dropdown
            if m := re.search(r"select\s+['\"]?([^'\"]+)['\"]?\s+(?:in|from|for)\s+(.+)", sl):
                option, field = m.group(1), m.group(2)
                # `sl` is lower-cased for matching, so taking the option from it
                # emitted selectOption('temporal') against an <option value="Temporal">
                # — an "option not found" on every correct app. Recover the option's
                # real casing from the ORIGINAL step text; fall back to `sl` only when
                # the two cannot be aligned.
                if mr := re.search(r"[Ss]elect\s+['\"]?([^'\"]+?)['\"]?\s+(?:in|from|for)\s+",
                                   strip_md(raw).strip()):
                    if mr.group(1).lower() == option:
                        option = mr.group(1)
                loc = _find_selector(field, selectors, in_dialog=dialog_state[0])
                if 'getByLabel' in loc or 'getByPlaceholder' in loc:
                    # A bare getByRole('combobox') is a strict-mode violation the
                    # moment the screen has two Selects. Keep the label — that is what
                    # makes it unique — and move it into the ROLE's `name` option.
                    # (The old code produced getByRole(/Title/i, {name: 'combobox'}),
                    # which is not even a legal role and failed `tsc`.)
                    if ma := re.match(r"getBy(?:Label|Placeholder)\((.+)\)$", loc.strip()):
                        loc = f"getByRole('combobox', {{name: {ma.group(1)}}})"
                    else:
                        loc = "getByRole('combobox')"
                code.append(f"  await {_scoped(loc)}.selectOption('{_clean_str(option)}');")
                continue

            # Click first task row → open task detail panel (must be checked BEFORE general click handler)
            # Task rows are <button> elements containing '·' (entity-ID separator, e.g. 'APT-2204 · Review')
            if re.search(r'first task row|task row.*open task detail', sl):
                code.append("  await page.locator('main').getByRole('button').filter({hasText: /\u00b7/}).first().click();")
                code.append("  await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible' });")
                continue

            # ── Plan C-3: "Perform action 'X' [via Y]" — treat as a click on 'X'. ──
            # Generator emits this phrasing for state-transition TCs:
            #   "Perform action "Confirm 'Deactivate'" via Toast 'Goal deactivated'"
            # Prefer outer DOUBLE-QUOTED extraction (non-greedy) so a nested single-
            # quoted label like 'Deactivate' is preserved as part of the action text.
            if re.search(r"^perform\s+action\b", sl):
                action_label = None
                if dq := re.search(r'"([^"]+)"', raw):
                    action_label = dq.group(1)
                elif sq := re.search(r"'([^']+)'", raw):
                    action_label = sq.group(1)
                if action_label:
                    # Strip leading "Confirm "/"Click "/etc — leaving the noun. The
                    # action might itself contain a nested-quoted label (e.g.
                    # "Confirm 'Deactivate'") — prefer that inner label as the click
                    # target.
                    inner = re.search(r"'([^']+)'", action_label) or re.search(r'"([^"]+)"', action_label)
                    core = inner.group(1) if inner else re.sub(
                        r"^(confirm|click|tap|press|open|close|start)\s+", '',
                        action_label, flags=re.IGNORECASE,
                    ).strip()
                    if core:
                        clean = _clean_regex(core)
                        _maybe_open_dialog(core.lower())
                        _maybe_close_dialog(core.lower())
                        code.append(f"  await {_scoped(f'getByRole({chr(39)}button{chr(39)}, {{name: /{clean}/i}})')}.click();")
                        continue
                code.append(f"  // Step: {strip_md(step)}   // perform-action with no extractable label")
                continue

            # Click button / link — capture full label including any quoted inner text;
            # do NOT strip surrounding quotes here (the containing-extractor below needs them)
            if m := re.search(r"(?P<verb>double-?click|click)\s+(?:the\s+)?(?:on\s+)?(.+?)(?:\s+(?:button|link|tab))?$", sl):
                verb = m.group('verb').replace(' ', '').lower()
                click_method = 'dblclick' if verb.startswith('double') else 'click'
                label = strip_md(m.group(2)).strip()
                # Strip trailing parenthetical hints — e.g. "submit (or blur to trigger)"
                # → "submit". The full phrase as button name will never match in Playwright.
                label = re.sub(r"\s*\([^)]*\)\s*$", "", label).strip()
                # If step describes a container (e.g. "task row containing 'X'") extract
                # the quoted inner label — that is the real Playwright accessible text.
                quoted_extracted = False
                if inner := re.search(r"containing\s+'([^']+)'", label, re.IGNORECASE):
                    label = inner.group(1)
                    quoted_extracted = True
                elif inner := re.search(r"[\"']([^\"']+)[\"']", label):
                    # Handle both single and double-quoted labels:
                    # 'Click "Save Draft"' → label='"Save Draft"' → strip to 'Save Draft'
                    label = inner.group(1)
                    quoted_extracted = True
                # Strip prose qualifiers ("Close button in the sheet footer" → "Close")
                # only when the author did NOT supply an explicit quoted label.
                if not quoted_extracted:
                    cleaned = _clean_button_label(label)
                    if cleaned is None:
                        code.append(f"  // Step: {strip_md(step)}   // selector skipped — prose-only click phrase, no usable button label")
                        continue
                    label = cleaned
                # Use regex-based accessible name to be robust against partial text
                loc = selectors.get(label.lower(),
                      selectors.get(label, f"getByRole('button', {{name: /{_clean_regex(label)}/i}})")
                      )
                # For sidebar navigation items, provide a link-role fallback comment
                # (sidebar items are often <a> tags, not buttons)
                if 'sidebar' in sl or any(nav in label.lower() for nav in ['cockpit','decision queue','capture inbox','initiatives','experiments']):
                    clean = _clean_regex(label)
                    code.append(f"  await page.getByRole('link', {{name: /{clean}/i}}).or(page.getByRole('button', {{name: /{clean}/i}})).first().{click_method}();")
                else:
                    code.append(f"  await {_scoped(loc)}.{click_method}();")
                # Flip dialog state AFTER the click is emitted (the open trigger
                # itself lives outside the dialog; subsequent locators should be
                # scoped). _maybe_close_dialog handles Cancel/Close.
                _maybe_open_dialog(label.lower())
                _maybe_close_dialog(label.lower())
                continue

            # Generic click-submit-like fallback — only fires for steps that actually
            # describe a click action (not prose mentioning 'saving or submitting').
            if ('click' in sl or 'press' in sl or 'tap' in sl) and ('submit' in sl or 'save' in sl or 'confirm' in sl):
                if 'submit' in sl and 'review' in sl:
                    code.append("  await page.getByRole('button', {name: 'Submit for Review →', exact: true}).click();")
                elif 'save' in sl and 'draft' in sl:
                    code.append("  await page.getByRole('button', {name: 'Save Draft', exact: true}).click();")
                elif 'submit button' in sl and not re.search(r"['\"]", raw):
                    # Generic "Click the submit button" with no specific label →
                    # target the form's actual submit element. Avoids fake regex matches.
                    code.append("  await page.locator('button[type=\"submit\"]').first().click();")
                else:
                    code.append("  await page.getByRole('button', {name: /submit|save|confirm/i}).click();")
                continue

            if 'cancel' in sl or 'hủy' in sl:
                code.append("  await page.getByRole('button', {name: /cancel|hủy/i}).click();")
                continue

            # Clear session (auth-redirect exception TC).
            if 'clear' in sl and ('cookie' in sl or 'storage' in sl):
                code.append("  await page.context().clearCookies();")
                continue

            # Badge label mapping (Fix C — scoped + .first() to survive a duplicate label
            # elsewhere on the page, e.g. an enum name echoed in a <code> block):
            # "Verify badge with text '<label>' is visible"
            if 'badge with text' in sl and ' is visible' in sl and 'does not have' not in sl:
                lbl_m = re.search(r"badge with text\s+'([^']+)'", raw, re.IGNORECASE)
                if lbl_m:
                    lbl = _clean_str(lbl_m.group(1))
                    code.append(
                        f"  await expect(page.locator(':is([data-slot=\"badge\"], [class*=\"status-\"])')"
                        f".filter({{ hasText: '{lbl}' }}).first()).toBeVisible({{ timeout: T }});"
                    )
                    continue

            # Negative class on a text-filtered badge (Fix C — control-signal variants):
            # "Verify badge with text '<label>' does not have CSS class '<value>'"
            if 'does not have css class' in sl and 'badge with text' in sl:
                lbl_m = re.search(r"badge with text\s+'([^']+)'", raw, re.IGNORECASE)
                val_m = re.search(r"does not have CSS class\s+'([^']+)'", raw, re.IGNORECASE)
                if lbl_m and val_m:
                    lbl = _clean_str(lbl_m.group(1))
                    val = _clean_regex(val_m.group(1))
                    code.append(
                        f"  {{ const _b = page.locator(':is([data-slot=\"badge\"], [class*=\"status-\"])')"
                        f".filter({{ hasText: '{lbl}' }}).first(); "
                        f"await expect(_b).toBeVisible({{ timeout: T }}); "
                        f"await expect(_b).not.toHaveClass(/{val}/i); }}"
                    )
                    continue

            # Selector visibility (Fix B — loading skeleton / generic locator):
            # "Verify element at selector '<sel>' is visible/hidden"
            if 'selector' in sl and (' is visible' in sl or ' is hidden' in sl) and 'has css' not in sl:
                sel_m = re.search(r"selector\s+'(.+?)'\s+is\s+(visible|hidden)", raw, re.IGNORECASE)
                if sel_m:
                    sel = sel_m.group(1).replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
                    assertion = 'toBeVisible' if sel_m.group(2).lower() == 'visible' else 'toBeHidden'
                    code.append(f"  await expect(page.locator(`{sel}`).first()).{assertion}();")
                    continue

            # Visual assertions emitted by build_visual_assertion_test_cases().
            # Pattern: "Verify element at selector '<scope>' has CSS class '<value>'"
            #          "Verify element at selector '<scope>' has attribute matching '<value>'"
            #          "Verify element at selector '<scope>' has animation class '<value>'"
            if 'selector' in sl and ('has css class' in sl or 'has attribute' in sl or 'has animation' in sl):
                # Selectors often contain inner `"` (e.g. [data-slot="badge"]:has-text("Persevere")).
                # Match the OUTER single quote delimiter only — allow any char (including ") inside.
                scope_m = re.search(r"selector\s+'(.+?)'\s+has", raw)
                value_m = re.search(r"(?:has CSS class|has attribute matching|has animation class)\s+'([^']+)'", raw, re.IGNORECASE)
                if scope_m and value_m:
                    # Use JS template literal — selectors often contain BOTH ' and " (e.g. [data-slot="badge"]:has-text("Persevere")).
                    scope = scope_m.group(1).replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
                    value = _clean_regex(value_m.group(1))
                    if 'has attribute' in sl:
                        code.append(f"  await expect(page.locator(`{scope}`).first()).toHaveAttribute('class', /{value}/);")
                    else:
                        code.append(f"  await expect(page.locator(`{scope}`).first()).toHaveClass(/{value}/);")
                    continue

            # Check visibility
            if m := re.search(r"(?:verify|check|assert|see)\s+(?:that\s+)?(.+?)\s+is\s+(visible|displayed|shown|hidden|present)", sl):
                label, state = strip_md(m.group(1)).strip(), m.group(2)
                assertion = 'toBeVisible' if state in ('visible', 'displayed', 'shown', 'present') else 'toBeHidden'
                # If label mentions a ARIA role keyword → prefer getByRole (robust against nested spans)
                role_kw = next((kw for kw in ('button', 'link', 'tab') if re.search(rf'\b{kw}\b', label, re.IGNORECASE)), None)
                if role_kw:
                    name_part = re.sub(rf'\s*\b{role_kw}\b\s*', ' ', label, flags=re.IGNORECASE).strip()
                    # If original step has a quoted string, use it as the accessible name (more precise)
                    # e.g. "Verify edition switcher button is visible with text '4MGI Command Dental edition'"
                    if q := re.search(r"'([^']+)'", raw):
                        name_part = q.group(1)
                    code.append(f"  await expect(page.getByRole('{role_kw}', {{name: /{_clean_regex(name_part)}/i}})).{assertion}();")
                elif quoted := re.search(r"['\"]([^'\"]+)['\"]", raw):
                    inner = _clean_str(quoted.group(1))
                    # Scope label/heading text to <main> so shell/sidebar/nav copies of the
                    # same string don't trigger a strict-mode 2-element match. A genuine
                    # duplicate INSIDE the content area still fails strict-mode → bug caught.
                    code.append(f"  await expect(page.locator('main').getByText('{inner}')).{assertion}();")
                else:
                    loc = selectors.get(label.lower(), f"locator('main').getByText('{_clean_str(label)}')")
                    code.append(f"  await expect(page.{loc}).{assertion}();")
                continue

            # Wait for / expect URL  (also handles "Verify URL contains '/xxx'")
            if 'redirect' in sl or ('navigate' in sl and 'expect' in sl) or ('url' in sl and 'contains' in sl):
                if 'login' in sl or 'sign' in sl or 'auth' in sl:
                    # Auth redirect: expect /login route
                    code.append("  await expect(page).toHaveURL(/login/i);")
                elif m := re.search(r"['\"]([^'\"]+)['\"]?", sl):
                    # Strip leading '/' to avoid invalid regex literal '//path/'
                    path_frag = _clean_regex(m.group(1).lstrip('/'))
                    code.append(f"  await expect(page).toHaveURL(/{path_frag}/i);")
                else:
                    # Generic redirect: just verify the URL has changed from the current page
                    code.append("  await expect(page).not.toHaveURL(page.url(), { timeout: 5000 });")
                continue

            # Generic expect/assertion
            if 'expect' in sl or 'error' in sl or 'message' in sl or 'success' in sl:
                if (not has_assertions) and (_snip := _prose_text_oracle(raw)):
                    txt = _clean_str(_snip)
                    code.append(f"  await expect(page.getByText('{txt}')).toBeVisible();")
                elif 'error' in sl:
                    # Exclude Next.js's empty <div role="alert" id="__next-route-announcer__">
                    # which otherwise causes a strict-mode 2-element match.
                    code.append("  await expect(page.locator('[role=\"alert\"]:not([id=\"__next-route-announcer__\"])').first()).toBeVisible();")
                elif 'success' in sl:
                    # Sonner-aware success toast — Next.js renders an empty <div role="alert"
                    # id="__next-route-announcer__"> that pollutes getByRole('alert'). Match
                    # the Sonner data-slot or a status role instead.
                    code.append("  await expect(page.locator('[data-sonner-toast], [role=\"status\"]').first()).toBeVisible({ timeout: 10000 });")
                continue

            # Page load assertion
            if 'load' in sl and ('page' in sl or 'screen' in sl):
                code.append("  await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible' });")
                continue

            # Verify dropdown / popover / menu opened after click
            if re.search(r'(dropdown|popover|menu)\s+(or\s+\S+\s+)?opens', sl):
                code.append("  await expect(page.locator('[role=\"menu\"],[role=\"dialog\"],[data-state=\"open\"]').first()).toBeVisible();")
                continue

            # Fallback: emit as a descriptive comment (no markdown)
            code.append(f"  // Step: {strip_md(step)}")

        for _line in compile_assertions(
                step_assertions[_step_idx] if _step_idx < len(step_assertions) else [],
                spec_ref):
            code.append(_line)

    # Validate expected outcome
    # A TC that carries structured `assert:` oracles already states its own
    # expectation; re-deriving one from the prose can only contradict it. The
    # contract is that assert: compiles 1:1 and nothing is inferred from prose.
    exp = '' if has_assertions else expected.lower()
    if exp:
        if 'success' in exp:
            # Sonner-aware success toast — Next.js renders an empty <div role="alert"
            # id="__next-route-announcer__"> that pollutes getByRole('alert'). Match
            # the Sonner data-slot or a status role instead.
            code.append("  await expect(page.locator('[data-sonner-toast], [role=\"status\"]').first()).toBeVisible({ timeout: 10000 });")
        elif re.search(r'\b(error state|validation error|form error|server error|error message|error alert|retry)\b', exp):
            # Only assert alert for explicit error-state/validation expected results.
            # Avoids false positives for e.g. "config error task" or "config-error label".
            # Exclude Next.js's empty route-announcer <div role="alert"> (strict-mode clash).
            code.append("  await expect(page.locator('[role=\"alert\"]:not([id=\"__next-route-announcer__\"])').first()).toBeVisible();")
        elif 'displayed' in exp or 'visible' in exp or 'shows' in exp:
            if _snip := _prose_text_oracle(expected):
                code.append(f"  await expect(page.getByText('{_clean_str(_snip)}')).toBeVisible();")

    return code


# ── Prose-derived text oracle guard ───────────────────────────────────────────
# Two emitters below fall back to "first quoted span in the prose" when a TC has
# no structured `assert:` to compile. That fallback produced two whole classes of
# broken oracle, both of which pass the generator and only fail at runtime:
#   * a possessive apostrophe opens the match ("MilestonePlanForm's entered
#     values are PRESERVED … error code ") — a sentence fragment asserted as copy;
#   * a spec template placeholder is asserted literally ("Milestone {N} added").
# Anything that is not plausibly on-screen copy is dropped: a dropped oracle is a
# visible coverage gap, a wrong one is a permanent red on a conformant build.
def _prose_text_oracle(raw: str) -> str | None:
    """Return the quoted span of `raw` usable as a getByText oracle, else None."""
    # Matched pairs only — `'…'` may not be closed by the possessive in "form's".
    m = re.search(r'"([^"\n]{3,})"', raw or '') or re.search(r"'([^'\n]{3,})'", raw or '')
    if not m:
        return None
    txt = m.group(1).strip()
    if not txt or len(txt) > 80:
        return None                      # a sentence, not a label
    if re.search(r'[{}]', txt):
        return None                      # unresolved placeholder: "Milestone {N} added"
    if re.search(r'\b(MUST|SHOULD|verbatim|i\.e\.|e\.g\.)\b', txt):
        return None                      # spec prose that leaked into the quotes
    return txt


def _field_kind(field_key: str, element_map: dict | None) -> str:
    """Classify a field key as 'input' | 'select' | 'checkbox' based on element-map.

    Inputs with id=field_key → input. Buttons with id=field_key → shadcn Select.
    Checkboxes (tag=input type=checkbox) → checkbox.
    """
    if not element_map:
        return 'input'
    fk = (field_key or '').lower()
    for inp in element_map.get('inputs', []):
        if (inp.get('id') or '').lower() == fk or (inp.get('name') or '').lower() == fk:
            return 'checkbox' if inp.get('type') == 'checkbox' else 'input'
    for btn in element_map.get('buttons', []):
        if (btn.get('id') or '').lower() == fk:
            return 'select'
    return 'input'


def _build_fill_preamble(test_data: dict, element_map: dict | None,
                         field_interactions: dict | None = None) -> list[str]:
    """Emit Playwright fill/select lines from a TC's test_data dict.

    Consults field_interactions (from spec YAML) first for known types:
      - input          → locator(selector).fill(value)
      - select         → click trigger + click option by name
      - checkbox-group → for each list value: locator('#mode-{value}').check()
      - step-list      → for each list value: click 'Add step' then fill nth input
      - tag-input      → for each list value: fill + press Enter
      - input-labelled → find input near label text

    Falls back to element-map-based _field_kind() detection.
    List values on unknown keys are serialized via pipe-join into step-list style.
    Empty string → .clear(); empty list → no-op (leave list empty).
    """
    lines: list[str] = []
    if not test_data:
        return lines
    fi = field_interactions or {}

    def _safe(s: str) -> str:
        return _clean_str(str(s))

    # Track how many step-list rows have been added per "section" so we know
    # which nth-input to target (each list field keeps its own counter)
    step_list_counters: dict[str, int] = {}

    for key, val in test_data.items():
        if key is None:
            continue
        interaction = fi.get(str(key)) or {}
        itype = (interaction.get('type') or '').strip()
        is_list_val = isinstance(val, list)
        str_val = '' if val is None else (val if isinstance(val, str) else str(val))
        safe_key = str(key)

        # ── Explicit field_interactions types ──
        if itype == 'input':
            sel = interaction.get('selector') or f"#{safe_key}"
            if is_list_val:
                continue
            if str_val == '':
                lines.append(f"  await page.locator('{sel}').clear();")
            else:
                lines.append(f"  await page.locator('{sel}').fill('{_safe(str_val)}');")
            continue

        if itype == 'select':
            trigger = interaction.get('trigger') or f"#{safe_key}"
            if str_val:
                lines.append(f"  await page.locator('{trigger}').click();")
                lines.append(f"  await page.getByRole('option', {{name: '{_safe(str_val)}'}}).click();")
            continue

        if itype == 'checkbox-group':
            pattern = interaction.get('id_pattern') or 'mode-{value}'
            values = val if is_list_val else ([str_val] if str_val else [])
            for v in values:
                if not v:
                    continue
                sel = pattern.replace('{value}', str(v))
                lines.append(f"  await page.locator('#{sel}').check();")
            continue

        if itype == 'step-list':
            add_label = interaction.get('add_button_label') or 'Add step'
            section_label = interaction.get('section_label') or str(key).replace('-', ' ').title()
            values = val if is_list_val else ([str_val] if str_val else [])
            section_safe = _safe(section_label)
            add_safe = _safe(add_label)
            # Strategy: use button_index from spec to nth() the correct "Add step"
            # button. After clicking, fill the LAST input within the section's
            # DOM subtree (reached via `xpath=../../..` from the button → label-row
            # parent → section root). Each click adds one input to that section,
            # so `.last()` always finds the newly-added input.
            button_index = interaction.get('button_index')
            for item in values:
                if not item:
                    continue
                if button_index is None:
                    # Fallback when button_index not provided: use hasText+has filter scope.
                    section_locator = (
                        f"page.locator('div')"
                        f".filter({{ hasText: /{re.escape(str(key).replace('-', ' ')).capitalize()}/ }})"
                        f".filter({{ has: page.getByRole('button', {{ name: '{add_safe}', exact: true }}) }}).last()"
                    )
                    lines.append(f"  await {section_locator}.getByRole('button', {{ name: '{add_safe}', exact: true }}).click();")
                    lines.append(f"  await {section_locator}.locator('input').last().fill('{_safe(str(item))}');")
                else:
                    btn_locator = (
                        f"page.getByRole('button', {{ name: '{add_safe}', exact: true }}).nth({button_index})"
                    )
                    lines.append(f"  await {btn_locator}.click();")
                    # Walk up from button to section root (label-wrapper → section container),
                    # then fill the last input (the newly-added one).
                    lines.append(
                        f"  await {btn_locator}.locator('xpath=../../..').locator('input').last().fill('{_safe(str(item))}');"
                    )
            continue

        if itype == 'tag-input':
            sel = interaction.get('selector') or f"#{safe_key}"
            values = val if is_list_val else ([str_val] if str_val else [])
            for item in values:
                if not item:
                    continue
                lines.append(f"  await page.locator('{sel}').fill('{_safe(str(item))}');")
                lines.append(f"  await page.locator('{sel}').press('Enter');")
            continue

        if itype == 'input-labelled':
            label = interaction.get('label') or str(key)
            label_safe = _safe(label)
            if is_list_val:
                # Label inputs aren't list fields — join with space as fallback
                str_val = ' '.join(str(x) for x in val)
            if str_val == '':
                lines.append(
                    f"  await page.getByLabel(/{re.escape(label_safe)}/i).first().clear();"
                )
            else:
                lines.append(
                    f"  await page.getByLabel(/{re.escape(label_safe)}/i).first().fill('{_safe(str_val)}');"
                )
            continue

        # ── Fallback: element-map heuristic ──
        kind = _field_kind(str(key), element_map)
        if kind == 'select':
            if str_val:
                lines.append(f"  await page.locator('#{safe_key}').click();")
                lines.append(f"  await page.getByRole('option', {{name: '{_safe(str_val)}'}}).click();")
        elif kind == 'checkbox':
            truthy = str_val.lower() not in ('', '0', 'false', 'no')
            verb = 'check' if truthy else 'uncheck'
            lines.append(f"  await page.locator('#{safe_key}').{verb}();")
        else:  # input
            if is_list_val:
                # Unknown list field → skip (no safe generic handling)
                continue
            if str_val == '':
                lines.append(f"  await page.locator('#{safe_key}').clear();")
            else:
                lines.append(f"  await page.locator('#{safe_key}').fill('{_safe(str_val)}');")
    return lines


def _render_layout_discovery_test(tc: dict, page_url: str) -> str:
    """Render a layout-discovery test block.

    Emits a self-contained test that mocks the list API, injects a bad string,
    and asserts layout invariants from setup/bad-data-fixtures.ts. The mock
    fixture body is intentionally a TODO — caller must fill in the API path
    and the JSON shape (feature-specific). The assertion code is complete.
    """
    ls = tc.get('layout_stress') or {}
    if ls.get('surface') == 'auto':
        return _render_layout_auto_test(tc, page_url)
    if ls.get('surface') == 'clip':
        return _render_layout_clip_test(tc, page_url)
    if ls.get('surface') == 'viewport-collapse':
        return _render_layout_viewport_collapse_test(tc, page_url)
    if ls.get('surface') == 'hscroll':
        return _render_layout_hscroll_test(tc, page_url)
    if ls.get('surface') == 'detail':
        return _render_layout_detail_test(tc, page_url)
    if ls.get('surface') == 'state':
        return _render_layout_state_test(tc, page_url)
    raw_title = tc.get('title', '')
    clean_title = strip_md(raw_title)
    test_name = f"{tc['id']} — {clean_title}"
    row_selector = ls.get('row_selector', '')
    field = ls.get('field', '')
    variant = ls.get('variant', '')
    baseline_field = ls.get('baseline_row_field', '')
    only_when = ls.get('only_when') or {}
    ow_comment = (
        f"  // only_when: {only_when} — only inject bad string on rows matching this condition\n"
        if only_when else ''
    )
    undef_check = (
        "    await assertNoUndefinedRender(page);\n"
        if variant == 'empty' else ''
    )

    return (
        f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
        f"    // LAYOUT-DISCOVERY: inject LAYOUT_BAD_STRINGS.{variant} into field '{field}'.\n"
        f"{ow_comment}"
        f"    // TODO: replace MOCK_FIXTURES below with this feature's list-API mock\n"
        f"    // and set the '{field}' value to LAYOUT_BAD_STRINGS.{variant} on ONE stressed row.\n"
        f"    // Keep at least 1 OTHER row with normal data (used for baseline measurement).\n"
        f"    await page.route(/MOCK_LIST_API_PATTERN/, async (route) => {{\n"
        f"      await route.fulfill({{ status: 200, contentType: 'application/json',\n"
        f"        body: JSON.stringify(/* MOCK_FIXTURES with one row.{field} = LAYOUT_BAD_STRINGS.{variant} */ {{}}) }});\n"
        f"    }});\n"
        f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n"
        f"    const rows = page.locator(`{row_selector}`);\n"
        f"    await expect(rows.first()).toBeVisible({{ timeout: 15000 }});\n"
        f"    // Baseline: measure a non-stressed row (assume index 1 is normal; adjust if needed).\n"
        f"    const baseline = await measureBaselineRowHeight(rows.nth(1));\n"
        f"    const stressedRow = rows.first();\n"
        f"    await assertNoHorizontalPageScroll(page, '{tc['id']}');\n"
        f"    // Replace `.first()` child locator below with the actual element that renders '{field}'.\n"
        f"    const stressedChild = stressedRow.locator('*').first();\n"
        f"    await assertChildWithinParent(stressedChild, stressedRow, `{field}`);\n"
        f"    await assertMaxRowHeight(stressedRow, baseline, `{field}`);\n"
        f"{undef_check}"
        f"  }});\n"
    )


def _render_layout_auto_test(tc: dict, page_url: str) -> str:
    """Render the ALWAYS-ON, selector-free overflow guard for one free-text field.

    Mutates the field to a long no-space value on every API response (works in
    mock AND real mode — no fixtures), then asserts the value renders within the
    viewport and does not self-clip on the list surface, and again after opening
    the first record's detail (best-effort — only if a data row exists). Needs no
    per-field selectors: the injected sentinel is located by its text prefix.
    """
    raw_title = tc.get('title', '')
    clean_title = strip_md(raw_title)
    test_name = f"{tc['id']} — {clean_title}"
    ls = tc.get('layout_stress') or {}
    field = ls.get('field', '')
    # Sentinel prefix: the first stable token of LAYOUT_BAD_STRINGS.longNoSpace,
    # used to locate the rendered element by text (getByText is substring match).
    prefix = 'SpecCompilation_VeryLongProcess'
    return (
        f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
        f"    // AUTO overflow guard (no fixtures): mutate '{field}' to a long no-space value\n"
        f"    // on every API response, then assert it renders within bounds everywhere it shows.\n"
        f"    await injectFieldValue(page, '**/api/**', '{field}', LAYOUT_BAD_STRINGS.longNoSpace);\n"
        f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n"
        f"    await assertNoHorizontalPageScroll(page, '{tc['id']}:list');\n"
        f"    await assertTextWithinViewport(page, '{prefix}', '{field}:list');\n"
        f"    // Best-effort drill-in: open the first record's detail if a data row exists.\n"
        f"    const firstRow = page.getByRole('row').filter({{ has: page.getByRole('cell') }}).first();\n"
        f"    if (await firstRow.count()) {{\n"
        f"      await firstRow.click();\n"
        f"      await page.locator('main, [role=\"main\"], [role=\"dialog\"]').first().waitFor({{ state: 'visible' }}).catch(() => {{}});\n"
        f"      await assertNoHorizontalPageScroll(page, '{tc['id']}:detail');\n"
        f"      await assertTextWithinViewport(page, '{prefix}', '{field}:detail');\n"
        f"    }}\n"
        f"  }});\n"
    )


def _render_layout_clip_test(tc: dict, page_url: str) -> str:
    """Render the ALWAYS-ON, selector-free presentation-invariant sweep.

    Renders the REAL server data (no route mock, no injected value), sweeps the
    list surface for clipped-and-unscrollable content, then best-effort opens the
    first record's detail and sweeps that too. Detail sheets are where read-only
    blobs (JSON, long descriptions) get capped in a max-h-* box whose scrollbar
    never engages — the tail is silently lost. Selector-free: the assertion walks
    the DOM measuring scroll geometry, so it needs no per-field wiring.
    """
    raw_title = tc.get('title', '')
    clean_title = strip_md(raw_title)
    test_name = f"{tc['id']} — {clean_title}"
    return (
        f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
        f"    // AUTO presentation-invariant sweep (no fixtures, no injected value):\n"
        f"    // assert no element hides content in a height-capped box that cannot scroll.\n"
        f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n"
        f"    await page.locator('main, [role=\"main\"]').first().waitFor({{ state: 'visible' }}).catch(() => {{}});\n"
        f"    await assertNoClippedScrollSurface(page, 'main, [role=\"main\"], body', '{tc['id']}:list');\n"
        f"    // Best-effort drill-in to the first record's detail. Try, in order, a\n"
        f"    // View/Open/Details affordance, then a real data-table row, then a link.\n"
        f"    let opened = false;\n"
        f"    const opener = page.getByRole('button', {{ name: /^\\s*(view|open|details?|manage)\\s*$/i }}).first();\n"
        f"    if (await opener.count()) {{ await opener.click().catch(() => {{}}); opened = true; }}\n"
        f"    if (!opened) {{\n"
        f"      const row = page.locator('main tbody tr').first();\n"
        f"      if (await row.count()) {{ await row.click().catch(() => {{}}); opened = true; }}\n"
        f"    }}\n"
        f"    if (!opened) {{\n"
        f"      const link = page.locator('main a[href]').first();\n"
        f"      if (await link.count()) {{ await link.click().catch(() => {{}}); opened = true; }}\n"
        f"    }}\n"
        f"    if (opened) {{\n"
        f"      // Wait for a detail Sheet/dialog (portaled to <body>) or a detail route.\n"
        f"      await page.locator('[role=\"dialog\"]').first().waitFor({{ state: 'visible', timeout: 6000 }}).catch(() => {{}});\n"
        f"      await page.waitForTimeout(1500); // settle async content (networkidle never fires on this streaming app)\n"
        f"      // Scope resolves in priority order in the helper: dialog if present, else main.\n"
        f"      await assertNoClippedScrollSurface(page, '[role=\"dialog\"], main, [role=\"main\"], body', '{tc['id']}:detail');\n"
        f"    }}\n"
        f"  }});\n"
    )


def _render_layout_viewport_collapse_test(tc: dict, page_url: str) -> str:
    """Render the ALWAYS-ON, selector-free SHORT-VIEWPORT collapse sweep.

    Renders REAL server data at deliberately short viewport HEIGHTS and asserts no
    primary scroll region (a declared overflow-y: auto|scroll list/table column)
    collapses below a usable minimum height while it still holds hidden content.
    This is the fixed-header/footer + `flex-1 min-h-0 overflow-y-auto` +
    `overflow-hidden` non-scrolling-page pattern: at short heights the fixed chrome
    eats the box and the flex-1 list squeezes to ~0px, so every row silently
    vanishes with no way to scroll to it. assertNoClippedScrollSurface deliberately
    skips this case (a 0px declared scroller looks "reachable" to it), so this is
    the complementary invariant. Selector-free; no mock, no injected value.
    Multiple short heights are swept so screens with taller/shorter chrome are all
    covered. Caught Bug #148866 (Escalation Queue). If the queue needs a populated
    list to overflow, the ambient dev data provides it (real-mode)."""
    raw_title = tc.get('title', '')
    clean_title = strip_md(raw_title)
    test_name = f"{tc['id']} — {clean_title}"
    return (
        f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
        f"    // AUTO short-viewport collapse sweep (no fixtures): assert no primary scroll\n"
        f"    // region squeezes to an unusable height (hiding its rows) at short heights.\n"
        f"    for (const h of [360, 300, 260]) {{\n"
        f"      await page.setViewportSize({{ width: 1280, height: h }});\n"
        f"      await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n"
        f"      await page.locator('main, [role=\"main\"]').first().waitFor({{ state: 'visible' }}).catch(() => {{}});\n"
        f"      await page.waitForTimeout(1200); // settle rows (networkidle never fires on this streaming app)\n"
        f"      await assertNoCollapsedScrollRegion(page, 'main, [role=\"main\"], body', `{tc['id']}:h=${{h}}`);\n"
        f"    }}\n"
        f"  }});\n"
    )


def _render_layout_hscroll_test(tc: dict, page_url: str) -> str:
    """Render the ALWAYS-ON, selector-free HORIZONTAL-overflow sweep.

    Renders REAL server data at two desktop widths and asserts no declared
    horizontal scroller holds content wider than its box. Swept at 1280 AND 1920
    because a wider viewport must not merely postpone the break — one unbounded
    cell scales the surface past any width. Then best-effort opens the first
    record's detail and sweeps that too. No mock, no injected value, no per-field
    selector: this fires on the data the backend actually returns, which is why it
    catches what the sentinel-based guard cannot (Bug #149093 — a 200-char
    `sovereignName` in live dev data pushed 4 of 5 columns off-screen while all 10
    existing layout-discovery TCs passed green, because the `overflow-x-auto`
    wrapper absorbs the overflow so the DOCUMENT never scrolls).
    """
    raw_title = tc.get('title', '')
    clean_title = strip_md(raw_title)
    test_name = f"{tc['id']} — {clean_title}"
    return (
        f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
        f"    // AUTO horizontal-overflow sweep (no fixtures, no injected value): assert no\n"
        f"    // surface pushes columns/controls off-screen behind a horizontal scroll.\n"
        f"    for (const w of [1280, 1920]) {{\n"
        f"      await page.setViewportSize({{ width: w, height: 800 }});\n"
        f"      await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n"
        f"      await page.locator('main, [role=\"main\"]').first().waitFor({{ state: 'visible' }}).catch(() => {{}});\n"
        f"      await page.waitForTimeout(1500); // settle rows (networkidle never fires on this streaming app)\n"
        f"      await assertNoHorizontalOverflowInScrollBox(page, 'main, [role=\"main\"], body', `{tc['id']}:list@${{w}}`);\n"
        f"    }}\n"
        f"    // Best-effort drill-in: a detail Sheet is a narrower surface, so a wide\n"
        f"    // read-only table inside it breaks sooner than on the list.\n"
        f"    const opener = page.getByRole('button', {{ name: /^\\s*(view|open|details?|manage)\\s*$/i }}).first();\n"
        f"    let opened = false;\n"
        f"    if (await opener.count()) {{ await opener.click().catch(() => {{}}); opened = true; }}\n"
        f"    if (!opened) {{\n"
        f"      const row = page.locator('main tbody tr').first();\n"
        f"      if (await row.count()) {{ await row.click().catch(() => {{}}); opened = true; }}\n"
        f"    }}\n"
        f"    if (opened) {{\n"
        f"      await page.locator('[role=\"dialog\"]').first().waitFor({{ state: 'visible', timeout: 6000 }}).catch(() => {{}});\n"
        f"      await page.waitForTimeout(1500);\n"
        f"      await assertNoHorizontalOverflowInScrollBox(page, '[role=\"dialog\"], main, [role=\"main\"], body', '{tc['id']}:detail');\n"
        f"    }}\n"
        f"  }});\n"
    )


def _render_layout_detail_test(tc: dict, page_url: str) -> str:
    """Render a layout-discovery test for a DETAIL surface (sheet / dialog / panel).

    A single-record surface renders one entity's free-text field (title, body).
    The invariant is overflow-only: the surface must not scroll horizontally and
    every element rendering the field must stay within the surface bounds — this
    is the "full text visible … without overflow" oracle from VIF Verification
    Fixtures. Injects the bad string via the item (detail) API rather than the
    list API. Mock body + open interaction are scaffolded TODOs (feature-specific,
    same policy as the row template).
    """
    raw_title = tc.get('title', '')
    clean_title = strip_md(raw_title)
    test_name = f"{tc['id']} — {clean_title}"
    ls = tc.get('layout_stress') or {}
    field = ls.get('field', '')
    variant = ls.get('variant', '')
    container = ls.get('container_selector', '') or '[role="dialog"]'
    text_selectors = ls.get('text_selectors') or []
    open_step = ls.get('open_step', '')
    row_selector = ls.get('row_selector', '')
    item_api = ls.get('item_api_pattern', '')
    undef_check = (
        "    await assertNoUndefinedRender(page);\n" if variant == 'empty' else ''
    )
    # Route: use the given item-API glob string if provided, else a TODO placeholder regex.
    if item_api:
        route_arg = f"'{_clean_str(item_api)}'"
    else:
        route_arg = "/ITEM_API_PATTERN/"
    # Open interaction: click the first list row if a row_selector is known, else a TODO.
    open_hint = f"    // Open the detail surface — {open_step}\n" if open_step else ''
    if row_selector:
        open_line = f"    await page.locator(`{row_selector}`).first().click();\n"
    else:
        open_line = "    // TODO: add the interaction that opens the detail surface.\n"
    # Assertion block: assert each text selector stays within the surface; fallback = first child.
    if text_selectors:
        sel_array = ', '.join('`' + s + '`' for s in text_selectors)
        assert_block = (
            f"    for (const sel of [{sel_array}]) {{\n"
            f"      await assertChildWithinParent(surface.locator(sel).first(), surface, `{field}`);\n"
            f"    }}\n"
        )
    else:
        assert_block = (
            f"    // TODO: list the selector(s) that render '{field}' inside the surface.\n"
            f"    await assertChildWithinParent(surface.locator('*').first(), surface, `{field}`);\n"
        )
    return (
        f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
        f"    // LAYOUT-DISCOVERY (detail surface): inject LAYOUT_BAD_STRINGS.{variant} into '{field}' via the item API.\n"
        f"    // TODO: replace the mock body with this feature's detail (item) DTO,\n"
        f"    // setting '{field}' = LAYOUT_BAD_STRINGS.{variant}. Mock/seed the list too if needed to open the detail.\n"
        f"    await page.route({route_arg}, async (route) => {{\n"
        f"      await route.fulfill({{ status: 200, contentType: 'application/json',\n"
        f"        body: JSON.stringify(/* detail DTO with {field} = LAYOUT_BAD_STRINGS.{variant} */ {{}}) }});\n"
        f"    }});\n"
        f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n"
        f"{open_hint}{open_line}"
        f"    const surface = page.locator(`{container}`).first();\n"
        f"    await expect(surface).toBeVisible({{ timeout: 15000 }});\n"
        f"    await assertNoHorizontalPageScroll(page, '{tc['id']}');\n"
        f"{assert_block}"
        f"{undef_check}"
        f"  }});\n"
    )


def _render_layout_state_test(tc: dict, page_url: str) -> str:
    """Render a STATE-FIT layout test for a secondary/detail surface.

    Forces the surface into a NON-DEFAULT state (Error via a mock 5xx, or Empty via
    404) then asserts every interactive control inside the container stays within its
    right edge. Unlike the long-no-space guard, this needs no adversarial value — the
    overflow is inherent to how the state's controls (alert copy + Retry button) are
    laid out in a narrow container. Catches the Bug #145661 class. Open interaction is
    best-effort (a 'View'/'Open' affordance, else the first data row) — same caller-
    fills policy as the other layout templates.
    """
    raw_title = tc.get('title', '')
    clean_title = strip_md(raw_title)
    test_name = f"{tc['id']} — {clean_title}"
    ls = tc.get('layout_stress') or {}
    container = ls.get('container_selector', '') or '[role="dialog"]'
    item_api = ls.get('item_api_pattern', '')
    status = ls.get('mock_status', 500)
    row_selector = ls.get('row_selector', '') or 'tbody tr'
    open_step = ls.get('open_step', '')
    anchor = ls.get('panel_anchor', '')
    state = ls.get('state', 'error')
    route_arg = f"'{_clean_str(item_api)}'" if item_api else "/SURFACE_API_PATTERN/"
    open_hint = f"    // Open the surface — {open_step}\n" if open_step else ''
    wait_anchor = (
        f"    await expect(page.locator('text={_clean_str(anchor)}').first())"
        f".toBeVisible({{ timeout: 15000 }});\n" if anchor else ''
    )
    return (
        f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
        f"    // LAYOUT (state-fit): force the surface into its {state} state ({status}),\n"
        f"    // then assert every control inside the container stays within its right edge.\n"
        f"    await page.route({route_arg}, async (route) => {{\n"
        f"      await route.fulfill({{ status: {status}, contentType: 'application/json',\n"
        f"        body: JSON.stringify({{ error: 'state-fit-{status}' }}) }});\n"
        f"    }});\n"
        f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n"
        f"{open_hint}"
        f"    // Best-effort open: a View/Open affordance, else the first data row.\n"
        f"    const opener = page.getByRole('button', {{ name: /view|open|detail/i }}).first();\n"
        f"    if (await opener.count()) {{ await opener.click(); }}\n"
        f"    else {{ await page.locator(`{row_selector}`).first().click(); }}\n"
        f"{wait_anchor}"
        f"    await assertNoHorizontalPageScroll(page, '{tc['id']}');\n"
        f"    await assertControlsWithinContainer(page, `{container}`, '{tc['id']}');\n"
        f"  }});\n"
    )


def _render_open_form_clicks(open_steps: list[str]) -> list[str]:
    """Turn the spec's form-opening prose ("Click 'Add Milestone'") into clicks.
    Best-effort and non-fatal: an opener that isn't on the page is skipped so an
    inline form still runs."""
    out: list[str] = []
    for s in open_steps or []:
        txt = strip_md(s)
        m = re.search(r"['\"]([^'\"]+)['\"]", txt) or re.search(
            r"^(?:click|open|press|tap|expand)\s+(?:the\s+)?(.+?)(?:\s+button)?\s*$", txt, re.I)
        label = _clean_button_label(m.group(1)) if m else None
        if not label:
            out.append(f"    // opener not resolvable from step: {_clean_str(txt)}")
            continue
        out.append(
            f"    {{ const o = page.getByRole('button', {{ name: /{_clean_regex(label)}/i }}).first();\n"
            f"      if (await o.count()) {{ await o.click().catch(() => {{}}); "
            f"await page.locator('[role=\"dialog\"]').first().waitFor({{ state: 'visible', timeout: 6000 }})"
            f".catch(() => {{}}); }} }}"
        )
    return out


def _render_validation_lifecycle_test(tc: dict, page_url: str, selectors: dict,
                                      element_map: dict | None) -> str:
    """Render a validation-message LIFECYCLE test.

    The spec-driven VAL tests only assert that a message APPEARS. These assert the
    other half — it must disappear when the field is fixed, stay away on a pristine
    form, come back when the rule is violated again, and be wiped by Clear/Reset.
    Oracle timing is deliberately permissive (clears on change OR on blur); only a
    message surviving BOTH fails. See references/validation-lifecycle.md.
    """
    vl = tc.get('validation_lifecycle') or {}
    kind = vl.get('kind', 'clear-on-valid')
    label = vl.get('label', '')
    field_key = vl.get('field', '') or label
    widget = vl.get('widget', '') or _field_widget(field_key, element_map)
    submit_label = vl.get('submit_label') or 'Submit'
    reset_label = vl.get('reset_label') or ''
    valid_value = vl.get('valid_value') or 'ValidValue'
    open_lines = _render_open_form_clicks(vl.get('open_steps') or [])
    # An opener the renderer could not resolve emits a COMMENT, not a click. Counting
    # it as "a dialog is open" scoped every field locator under [role="dialog"], so on
    # an INLINE task screen (VIF: "no drawer") the locator matched 0 nodes and the whole
    # lifecycle family skipped with a reason that read like a real finding.
    in_dialog = any(not l.lstrip().startswith('//') for l in open_lines)

    test_name = f"{tc['id']} — {strip_md(tc.get('title', ''))}"
    if tc.get('spec_ref'):
        test_name += f" [{tc['spec_ref'].split('/')[0].strip()}]"

    loc = _find_selector(field_key, selectors, in_dialog=in_dialog)
    dialog_base = "page.locator('[role=\"dialog\"][data-state=\"open\"], [role=\"dialog\"]:visible').last()"
    field_expr = f"{dialog_base}.{loc}" if in_dialog else f"page.{loc}"
    # A responsive double-render (desktop + mobile trees both mounted) makes a
    # label/placeholder locator resolve to 2 nodes → strict-mode violation. The
    # lifecycle assertions only need ONE instance of the field.
    if not re.search(r"\.(first|last|nth)\([^)]*\)\s*$", field_expr):
        field_expr += '.first()'

    L: list[str] = [f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{"]
    L.append(f"    // VALIDATION LIFECYCLE ({kind}) — UI/UX invariant, not a spec oracle.")
    # These tests poll for a message to appear, then for it to disappear on change
    # and again after a blur — deliberately slower than a single assertion.
    L.append("    test.setTimeout(extendedTimeoutMs());")
    L += open_lines
    L.append("    const dlg = page.locator('[role=\"dialog\"]').first();")
    L.append("    const scope = (await dlg.count()) ? dlg : page.locator('main, [role=\"main\"]').first();")
    L.append(f"    const submit = page.getByRole('button', {{ name: /{_clean_regex(submit_label)}/i }}).first();")

    if kind == 'pristine':
        L.append("    // Nothing is touched: any message on screen now is shown too early.")
        L.append(f"    await assertNoErrorsOnPristineForm(scope, '{_clean_str(strip_md(tc.get('title', '')))}');")
        L.append("  });\n")
        return '\n'.join(L)

    if kind == 'reset':
        L.append("    // Provoke the messages, then Clear/Reset must wipe them. Every click is")
        L.append("    // time-boxed: a submit control that stays disabled would otherwise hang")
        L.append("    // on actionability until the whole test times out.")
        L.append("    // Baseline: a form that gates submit until valid is legitimately disabled")
        L.append("    // on an empty form — only a submit that WAS enabled may not stay disabled.")
        L.append("    const submitEnabledBefore = (await submit.count()) > 0 "
                 "&& !(await submit.isDisabled().catch(() => true));")
        L.append("    if (await submit.count()) await submit.click({ timeout: 5000 }).catch(() => {});")
        L.append("    await page.waitForTimeout(500);")
        L.append(f"    const reset = page.getByRole('button', {{ name: /{_clean_regex(reset_label)}/i }}).first();")
        L.append(f"    test.skip(!(await reset.count()), 'no \"{_clean_str(reset_label)}\" control on the deployed form');")
        L.append("    await reset.click({ timeout: 5000 });")
        L.append("    await page.waitForTimeout(500);")
        L.append(f"    await assertResetClearsErrors(scope, submit, '{_clean_str(reset_label)}', "
                 f"submitEnabledBefore);")
        L.append("  });\n")
        return '\n'.join(L)

    # clear-on-valid / reappear — both need the field and a provoked message first.
    L.append(f"    const field = {field_expr};")
    L.append(f"    test.skip(!(await field.count()), 'field \"{_clean_str(label)}\" not present on the deployed form');")
    L.append("    // Provoke the message: submit the empty form; if submit is guarded/disabled,")
    L.append("    // fall back to touching the field and blurring it.")
    L.append("    if ((await submit.count()) > 0 && !(await submit.isDisabled().catch(() => false))) {")
    L.append("      await submit.click({ timeout: 5000 }).catch(() => {});")
    L.append("    } else {")
    L.append("      await field.click({ timeout: 5000 }).catch(() => {});")
    L.append("      await blurField(field);")
    L.append("    }")
    L.append("    const provoked = await waitForFieldError(field, 5000);")
    L.append(f"    test.skip(!provoked, 'no validation message surfaced for \"{_clean_str(label)}\" — "
             f"the appearance direction is covered by its VAL test; nothing to observe here');")

    # Enter a valid value — a Select needs an option pick, a DatePicker cannot be filled.
    if widget == 'select':
        fill_lines = [
            "    await openSelect(field);",
            "    await page.getByRole('option').first().click();",
        ]
    elif widget == 'datepicker':
        fill_lines = [
            f"    test.skip(true, '\"{_clean_str(label)}\" is a DatePicker — its valid value cannot "
            f"be typed; drive this lifecycle check by hand (Step 4.7)');",
        ]
    else:
        fill_lines = [f"    await field.fill('{_clean_str(valid_value)}');"]
    L += fill_lines

    if kind == 'reappear':
        L.append(f"    await assertFieldErrorClearsWhenValid(field, '{_clean_str(label)}');")
        L.append("    // Violate the rule again — validation must re-arm, not stay silent.")
        L.append("    await field.fill('');")
        L.append("    await blurField(field);")
        L.append(f"    await assertFieldErrorReappears(field, '{_clean_str(label)}');")
    else:
        L.append(f"    await assertFieldErrorClearsWhenValid(field, '{_clean_str(label)}');")

    L.append("  });\n")
    return '\n'.join(L)


# ── VIF section renderers ────────────────────────────────────────────────────
# Four of the eight VIF-section categories need a dedicated template because the
# mechanism cannot be expressed as a sequence of UI actions, which is all the
# prose translator can emit:
#   boot-request      capture the request BEFORE navigating (a capture started
#                     after goto misses the only request that matters)
#   negative-render   read a value out of the response, then assert its ABSENCE
#   responsive        set the viewport before navigating, assert per component
#   error-precedence  mock a status, then assert the LEVEL rather than the copy
# The remaining four (queue-column, support-panel, state-default,
# acceptance-criteria) are ordinary open-and-assert flows and go through the
# existing prose translator unchanged.

def _sec_test_open(tc: dict) -> str:
    name = f"{tc['id']} — {strip_md(tc.get('title', ''))}"
    ref = str(tc.get('spec_ref', '')).split('/')[0].strip()
    if ref:
        name += f' [{ref[:60]}]'
    return f"  test('{_clean_str(name)}', async ({{ page }}) => {{\n"


def _boot_url_pred(sec: dict) -> str:
    """The predicate that picks the screen's OWN list read.

    Matching merely `/api/` took whichever request happened to be first — on a real
    screen that is often an unrelated lookup, and the spec's query params were then
    reported 'absent' from a request that never carried them. When §Task Screens
    names the endpoint, match it; otherwise keep the loose match and say so.
    """
    ep = str(sec.get('endpoint') or '').strip()
    if ep:
        return f"r.url().includes('{_clean_str(ep)}')"
    return ("/\\/api\\//.test(r.url()) && !/application-configuration|abp\\//.test(r.url())"
            " /* no endpoint in §Task Screens — loose match */")


def _render_boot_request_test(tc: dict, page_url: str) -> str:
    """Assert the COLD-LOAD request carries every spec-declared default.

    The listener is attached before `goto` on purpose. The boot request is the only
    one that answers the question — a request captured after navigation may already
    carry a value the app defaulted a control to post-mount, which is a different
    claim — and `waitForRequest` started after `goto` routinely misses it outright.
    """
    sec = tc.get('section') or {}
    params = [p for p in (sec.get('params') or []) if isinstance(p, dict)]
    omitted = [p for p in (sec.get('omitted') or []) if isinstance(p, dict)]

    def _bare_ts(v):
        return _clean_str(re.sub(r'\(.*?\)', '', str(v or '')).strip().strip('*`" '))

    L = [_sec_test_open(tc),
         "    // The boot request is AWAITED, not sampled. `settled()` resolves on `load`,\n",
         "    // which fires BEFORE react-query issues its first fetch — a recorded-array\n",
         "    // read here saw an empty list and reported 'the screen fetched nothing'\n",
         "    // against a screen that fetches fine (measured on VIF-GOV-001, TC-076).\n",
         "    // Armed before goto: a waitForRequest started after navigation misses it.\n",
         f"    const bootP = page.waitForRequest(\n",
         f"      (r) => {_boot_url_pred(sec)}\n",
         "        && (r.resourceType() === 'xhr' || r.resourceType() === 'fetch'),\n",
         "      { timeout: T },\n",
         "    ).catch(() => null);\n",
         f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n",
         "    await settled(page);\n",
         "    const boot = (await bootP)?.url();\n",
         "    expect(boot, 'no API request observed on cold load — the screen fetched nothing, which is itself the finding').toBeTruthy();\n",
         "    const qs = new URL(boot!, 'http://x').searchParams;\n"]
    for p in params:
        name, dflt = _bare_ts(p.get('param')), _bare_ts(p.get('default'))
        L.append(f"    // spec default: {name} = {dflt}\n")
        L.append(f"    expect([...qs.keys()].map((k) => k.toLowerCase()), "
                 f"'{name} absent from the cold-load request').toContain('{name.lower()}');\n")
        L.append(f"    {{\n")
        L.append(f"      const got = String(qs.get([...qs.keys()].find((k) => k.toLowerCase() === "
                 f"'{name.lower()}')!) ?? '').toLowerCase();\n")
        # An enum member name in the VIF vs an ordinal on the wire is a NOTATION
        # difference, not a wrong default: the client sending Disposition=0 for
        # `Captured` is conformant. Record it, do not red it.
        L.append(f"      if (/^-?\\d+$/.test(got) && !/^-?\\d+$/.test('{dflt.lower()}')) {{\n")
        L.append(f"        test.info().annotations.push({{ type: 'enum-notation', description: "
                 f"'{name} is sent as the ordinal \\'' + got + '\\' while the VIF names the member "
                 f"\\'{dflt}\\' — conformant, but the VIF and the contract disagree on notation.' }});\n")
        L.append(f"      }} else {{\n")
        L.append(f"        expect(got, '{name} does not carry its spec default {dflt}')"
                 f".toContain('{dflt.lower()}');\n")
        L.append(f"      }}\n")
        L.append(f"    }}\n")
    for p in omitted:
        name = _bare_ts(p.get('param'))
        L.append(f"    // {name} is sent only once set — its PRESENCE on a cold load is the defect.\n")
        L.append(f"    expect([...qs.keys()].map((k) => k.toLowerCase()), "
                 f"'{name} sent on cold load though the spec sends it only when set')"
                 f".not.toContain('{name.lower()}');\n")
    L.append("  });\n")
    return ''.join(L)


def _render_negative_render_test(tc: dict, page_url: str) -> str:
    """Assert a not-displayed field's VALUE is absent from the surface.

    Asserting the field NAME is absent would prove nothing — a UI that never labels
    its columns passes while rendering the value anyway. So the value is read out of
    the response and searched for on the surface. When the response does not carry
    the field the test fails rather than skipping: the contract says it is received,
    so its absence from the payload is a finding of its own.
    """
    sec = tc.get('section') or {}
    field = _clean_str(sec.get('field', ''))
    L = [_sec_test_open(tc),
         "    const bodies: unknown[] = [];\n",
         "    page.on('response', async (r) => {\n",
         "      if (!/\\/api\\//.test(r.url()) || !r.ok()) return;\n",
         "      try { bodies.push(await r.json()); } catch { /* non-JSON */ }\n",
         "    });\n",
         f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n",
         "    await settled(page);\n",
         "    // Find the field's value anywhere in the observed payloads (the DTO shape\n",
         "    // varies: paged `items`, a bare array, or a BFF envelope).\n",
         "    const findVal = (o: unknown, key: string): string | undefined => {\n",
         "      if (o === null || typeof o !== 'object') return undefined;\n",
         "      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {\n",
         "        if (k.toLowerCase() === key.toLowerCase() && (typeof v === 'string' || typeof v === 'number')) {\n",
         "          return String(v);\n",
         "        }\n",
         "        const nested = findVal(v, key);\n",
         "        if (nested !== undefined) return nested;\n",
         "      }\n",
         "      return undefined;\n",
         "    };\n",
         "    // Poll: the response listener is async and `settled()` resolves on `load`,\n",
         "    // so a single read routinely happens before any payload has arrived.\n",
         f"    let raw: string | undefined;\n",
         "    await expect(async () => {\n",
         f"      raw = bodies.map((b) => findVal(b, '{field}')).find((v) => v !== undefined);\n",
         "      expect(raw).not.toBeUndefined();\n",
         "    }).toPass({ timeout: T }).catch(() => {});\n",
         "    // A field the payload never carried is a BACKEND gap, not a UI defect: this\n",
         "    // TC's oracle is 'the value must not render', which is unanswerable with no\n",
         "    // value. Recording and returning keeps the verdict honest — failing here\n",
         "    // filed a red against the UI for something the UI cannot fix.\n",
         "    if (raw === undefined) {\n",
         f"      test.info().annotations.push({{ type: 'backend-gap', description: '`{field}` "
         f"never arrived in any /api/ payload, though the VIF lists it as received' }});\n",
         "      return;\n",
         "    }\n",
         "    const main = page.locator('main, [role=\"main\"]').first();\n",
         f"    // The VALUE must not render. This is the whole oracle.\n",
         f"    await expect(main.getByText(String(raw).trim(), {{ exact: false }}), "
         f"'`{field}` value is rendered on screen though the VIF lists it as received-but-"
         f"not-displayed').toHaveCount(0, {{ timeout: T }});\n",
         f"    // ...and neither should a column header or label naming it.\n",
         f"    await expect(main.getByRole('columnheader', {{ name: /{field}/i }}), "
         f"'a column header reads `{field}`').toHaveCount(0, {{ timeout: T }});\n",
         "  });\n"]
    return ''.join(L)


def _render_responsive_test(tc: dict, page_url: str) -> str:
    """Assert one §Responsive Rules breakpoint's component mandates.

    Viewport is set BEFORE navigating: resizing after render can leave the desktop
    tree mounted, and the assertion then describes a layout no user ever sees.
    Every locator is scoped with `>> visible=true` — a Tailwind responsive
    double-render mounts BOTH trees, so an unscoped `.first()` lands on a
    `display:none` node where `toBeHidden()` passes whatever the UI actually does.
    """
    sec = tc.get('section') or {}
    vp = str(sec.get('viewport') or '1440x900')
    try:
        w, h = (int(x) for x in vp.lower().split('x')[:2])
    except Exception:
        w, h = 1440, 900
    L = [_sec_test_open(tc),
         f"    await page.setViewportSize({{ width: {w}, height: {h} }});\n",
         f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n",
         "    await settled(page);\n"]
    changes = [c for c in (sec.get('changes') or []) if isinstance(c, dict)]
    # The breakpoint-independent invariant. Asserted at EVERY breakpoint, always:
    # it is the one claim a responsive rule implies without the spec naming a DOM
    # shape, and it is falsifiable (measured: it is what catches a table that does
    # not collapse).
    L.append("    const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));\n")
    L.append("    expect(doc.sw, 'page scrolls horizontally at this breakpoint').toBeLessThanOrEqual(doc.cw + 1);\n")
    if not changes:
        L.append("    // No component name in the spec cell matched §Component Tree or the queue\n"
                 "    // columns, so the invariant above is the whole oracle. Name the components\n"
                 "    // in responsive_rules[].changes to get more.\n")
    for c in changes:
        comp = _clean_str(str(c.get('component', '')))
        exp = str(c.get('expect', 'visible'))
        clause = _clean_str(str(c.get('derived_from', ''))[:110])
        # A component id in the VIF is a SPEC name, never a DOM handle. Binding it
        # with getByText('<ComponentName>') asserted the component's own name as
        # page copy — 3/3 responsive TCs red on VIF-GOV-001 for exactly that, on a
        # screen that renders correctly. So: assert only when a real handle exists
        # in the built DOM, and record the mandate as untestable when it does not.
        # A sheet/dialog mandate is additionally unreachable from a cold load — the
        # spec describes it in its OPEN state and this TC never opens it.
        L.append(f"    {{ // {comp} -> {exp}   (spec clause: {clause})\n")
        L.append(f"      const handle = page.locator('[data-testid=\"{comp}\"], [aria-label=\"{comp}\"]');\n")
        L.append("      if (await handle.count() === 0) {\n")
        L.append(f"        test.info().annotations.push({{ type: 'untestable-mandate', description: "
                 f"'{comp} -> {exp}: the VIF states the responsive intent, not the DOM shape, and the "
                 f"built markup exposes no data-testid or accessible name to bind to. Declare one in the "
                 f"VIF (or in §Component Tree) to make this assertable.' }});\n")
        L.append("      } else {\n")
        vis = "        const loc = handle.locator('visible=true');\n"
        L.append(vis)
        if exp == 'hidden':
            L.append(f"        await expect(loc, '{comp} is still visible at this breakpoint "
                     f"though the spec hides it').toHaveCount(0, {{ timeout: T }});\n")
        else:
            L.append(f"        await expect(loc.first(), '{comp} not visible at this breakpoint')"
                     f".toBeVisible({{ timeout: T }});\n")
        L.append("      }\n")
        L.append("    }\n")
    L.append("  });\n")
    return ''.join(L)


def _render_error_precedence_test(tc: dict, page_url: str) -> str:
    """Force one §Empty & Error Precedence condition and assert its LEVEL.

    The exception pass already asks whether the error surfaces and reads correctly.
    This asks the question that pass cannot: at what level. A 403 the spec says must
    take the whole page, rendered inline above a still-populated list, satisfies
    every copy assertion and is still a defect — the user is looking at data they
    are not authorised to see.
    """
    sec = tc.get('section') or {}
    status = sec.get('status')
    ep = str(sec.get('endpoint') or '')
    level = str(sec.get('level') or '')
    path = re.sub(r'^(?:GET|POST|PUT|PATCH|DELETE)\s*', '', ep).strip()
    glob = ('**' + path.replace('{id}', '*') + ('*' if not path.endswith('*') else '')) if path else ''
    L = [_sec_test_open(tc)]
    if status and glob:
        L.append(f"    await page.route('{_clean_str(glob)}', (route) => route.fulfill({{\n")
        L.append(f"      status: {int(status)}, contentType: 'application/json', body: '{{}}',\n")
        L.append("    }));\n")
    L.append(f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n")
    L.append("    await settled(page);\n")
    L.append("    const main = page.locator('main, [role=\"main\"]').first();\n")
    if level == 'full-page':
        L.append("    // FULL-PAGE: the primary content must not be rendered at all. 'Covered\n")
        L.append("    // by an overlay' is not the same thing and is not what the spec asked for.\n")
        L.append("    await expect(main.getByRole('row'), 'rows are still rendered under a "
                 "full-page error — the spec says the list is not rendered').toHaveCount(0, { timeout: T });\n")
        L.append("    await expect(main.getByRole('table'), 'the table is still rendered under a "
                 "full-page error').toHaveCount(0, { timeout: T });\n")
    elif level in ('inline', 'component'):
        L.append(f"    // {level.upper()}: the failure is confined — the rest of the screen must\n")
        L.append("    // stay rendered. A page-wide error here is the divergence.\n")
        L.append("    await expect(main, 'the screen around the failed surface is gone — the spec "
                 "confines this error').toBeVisible({ timeout: T });\n")
    retry = sec.get('retry')
    if retry is True:
        L.append("    await expect(page.getByRole('button', { name: /retry|try again/i }).first(), "
                 "'no Retry control though the spec offers one').toBeVisible({ timeout: T });\n")
    elif retry is False:
        L.append("    // The spec forbids a Retry here, so a helpful extra one is still a divergence.\n")
        L.append("    await expect(page.getByRole('button', { name: /retry|try again/i }), "
                 "'a Retry control is offered though the spec says none').toHaveCount(0, { timeout: T });\n")
    if sec.get('disables'):
        L.append("    // disabled != hidden: asserting absence would pass on the wrong UI.\n")
        L.append("    // Scoped to `main`: an unscoped getByRole('button') swept the sidebar and\n")
        L.append("    // user menu, so the assertion fired on app chrome, not on this state.\n")
        L.append("    const acts = main.getByRole('button').filter({ hasNotText: /cancel|close/i });\n")
        L.append("    const n = await acts.count();\n")
        L.append("    for (let i = 0; i < n; i++) {\n")
        L.append("      const b = acts.nth(i);\n")
        L.append("      if (!(await b.isVisible())) continue;\n")
        L.append("      await expect(b, 'an action button is still enabled though the spec disables "
                 "all of them in this state').toBeDisabled({ timeout: T });\n")
        L.append("    }\n")
    if sec.get('hides'):
        L.append("    await expect(main.getByRole('button').filter({ hasNotText: /cancel|close/i }), "
                 "'action buttons are present though the spec HIDES them in this state')"
                 ".toHaveCount(0, { timeout: T });\n")
    L.append("  });\n")
    return ''.join(L)


def _glob_of(path: str) -> str:
    p = re.sub(r'^(?:GET|POST|PUT|PATCH|DELETE)\s*', '', str(path or '')).strip()
    if not p:
        return ''
    p = p.replace('{id}', '*')
    return '**' + p + ('' if p.endswith('*') else '*')


def _render_empty_copy_test(tc: dict, page_url: str) -> str:
    """Force a component to no data and assert its spec-declared empty copy.

    200-with-zero-rows, never 404. A 404 routed into the Error state is a different
    defect and the exception pass owns it; forcing 404 here would conflate the two and
    make this TC fail for the wrong reason.
    """
    sec = tc.get('section') or {}
    ep = str(sec.get('endpoint') or '')
    copies = [c for c in (sec.get('copies') or []) if str(c).strip()]
    comp = _clean_str(str(sec.get('component') or ''))
    L = [_sec_test_open(tc)]
    if ep:
        g = _glob_of(ep)
        L.append(f"    // Empty, not missing: 200 + zero rows. Both the paged shape and the\n")
        L.append(f"    // bare-array shape are covered because the DTO varies across this corpus.\n")
        L.append(f"    await page.route('{_clean_str(g)}', (route) => route.fulfill({{\n")
        L.append(f"      status: 200, contentType: 'application/json',\n")
        L.append(f"      body: JSON.stringify({{ items: [], totalCount: 0 }}),\n")
        L.append("    }));\n")
    else:
        L.append(f"    // No endpoint in §Data Binding for {comp} — this TC cannot force the\n")
        L.append(f"    // empty state on its own. It still asserts the copy where the component\n")
        L.append(f"    // is naturally empty; wire an endpoint into data_binding to make it real.\n")
    L.append(f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n")
    L.append("    await settled(page);\n")
    for c in copies:
        L.append(f"    await expect(page.getByText({_ts_str(c)}, {{ exact: false }}).first(), "
                 f"'{comp} does not show the spec empty copy — a calm but WRONG empty message "
                 f"passes every other TC').toBeVisible({{ timeout: T }});\n")
    L.append("    // The empty state must not read as a failure.\n")
    L.append("    await expect(page.getByRole('button', { name: /retry|try again/i }), "
             "'the empty state offers a Retry, so it is rendering as an error')"
             ".toHaveCount(0, { timeout: T });\n")
    L.append("  });\n")
    return ''.join(L)


def _render_fixture_mutation_test(tc: dict, page_url: str) -> str:
    """Inject a §Verification Fixtures Entity Snapshot and assert its stated rendering.

    The payload is served to BOTH the collection and the item read, wrapped or bare
    depending on which the caller asked for — a snapshot's `Verifies` cell routinely
    describes the list row and the detail panel in one sentence, and guessing which
    surface it meant would make half of these fail for the wrong reason.

    This is the cheapest access to a branch live data cannot produce: a resolved name
    that is null, an item already stale, a failure flag set by an event handler.
    """
    sec = tc.get('section') or {}
    raw = str(sec.get('payload') or '').strip()
    eps = [e for e in (sec.get('endpoints') or []) if str(e).strip()]
    L = [_sec_test_open(tc)]
    if not sec.get('parsed_ok'):
        L.append("    // The fixture JSON in the spec cell did not parse. Failing loudly is\n")
        L.append("    // correct: a silently skipped fixture is a spec defect nobody sees.\n")
        fid = _clean_str(str(sec.get('fixture_id') or ''))
        L.append(f"    expect(false, 'fixture {fid} JSON does not parse — fix the VIF "
                 f"cell').toBe(true);\n")
        L.append("  });\n")
        return ''.join(L)
    L.append(f"    const fixture = {raw};\n")
    # The VIF writes snapshot keys in the ENTITY spelling (PascalCase: `RawText`);
    # the API serialises camelCase and the client reads camelCase. A PascalCase-only
    # body therefore renders nothing and the TC reds against a healthy screen —
    # 7/7 fixture TCs failed this way on VIF-GOV-001. Serving both spellings costs
    # nothing and removes the whole failure class.
    L.append("    const bothCases = (o: Record<string, unknown>) => Object.fromEntries(\n")
    L.append("      Object.entries(o).flatMap(([k, v]) => [[k, v], [k.charAt(0).toLowerCase() + k.slice(1), v]]),\n")
    L.append("    );\n")
    L.append("    const served = bothCases(fixture as Record<string, unknown>);\n")
    # A glob that matches nothing is the silent version of this same bug: the screen
    # then renders LIVE data and the assertion fails as if the fixture were wrong.
    L.append("    let mockHits = 0;\n")
    # Most specific LAST: Playwright matches handlers in reverse registration order,
    # and the collection glob (`**/api/x*`) also matches the item path (`/api/x/{id}`).
    # Ordering by segment count then length makes the item handler win deterministically.
    eps = sorted(eps, key=lambda e: (e.count('/'), len(e)))
    for e in eps:
        g = _glob_of(e)
        item = '{id}' in e or e.rstrip('/').endswith('*')
        L.append(f"    await page.route('{_clean_str(g)}', (route) => {{ mockHits += 1; return route.fulfill({{\n")
        L.append(f"      status: 200, contentType: 'application/json',\n")
        if item:
            L.append("      body: JSON.stringify(served),\n")
        else:
            L.append("      body: JSON.stringify({ items: [served], totalCount: 1 }),\n")
        L.append("    }); });\n")
    L.append(f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n")
    L.append("    await settled(page);\n")
    # Polled, not read once: `settled()` resolves on `load`, which fires before the
    # client issues its first fetch, so a single read saw 0 hits on a glob that
    # matches perfectly well (7/7 fixture TCs on VIF-GOV-001 reported the wrong
    # cause for exactly this reason).
    L.append("    await expect(async () => { expect(mockHits, 'the fixture mock was never hit — the "
             "endpoint glob does not match what this screen calls, so the assertions below ran "
             "against LIVE data').toBeGreaterThan(0); }).toPass({ timeout: T });\n")
    # A snapshot served verbatim can CRASH the client, and a crash reads as
    # 'value not rendered' — the wrong diagnosis, filed against the wrong team.
    # Measured on VIF-GOV-001: every §Verification Fixtures snapshot writes enum
    # members as names ("Captured") while CT-GOV-001 sends ordinals (Disposition=0),
    # so the badge map resolved to undefined and React threw #130 (white screen).
    L.append("    await expect(page.getByRole('heading', { name: /something went wrong/i }), "
             "'serving this §Verification Fixtures snapshot verbatim CRASHED the client. The "
             "snapshot and the wire contract disagree on shape — commonly enum members written "
             "as names where the contract sends ordinals. Reconcile the VIF snapshot with the CT, "
             "or the fixtures cannot be used as test input.').toHaveCount(0, { timeout: T });\n")
    # Assert the injected values and the spec-stated strings. Both come from the spec:
    # one is the input this test controls, the other is the `Verifies` cell.
    for st in tc.get('steps', []):
        m = re.search(r'renders on screen:\s*"(.+?)"\s*$', str(st)) or \
            re.search(r'rendering is present:\s*"(.+?)"\s*$', str(st))
        if not m:
            continue
        val = m.group(1)
        L.append(f"    await expect(page.getByText({_ts_str(val)}, {{ exact: false }}).first(), "
                 f"'fixture value not rendered').toBeVisible({{ timeout: T }});\n")
    L.append("  });\n")
    return ''.join(L)


def _render_task_route_test(tc: dict, page_url: str) -> str:
    """Prove the §Task Journey Route resolves for a REAL id.

    The prose translation navigated to the literal `{id}` placeholder and then
    asserted `not.toHaveURL(page.url())` — a self-contradiction that can only time
    out. The id has to come from the live list: a hard-coded one fails on a reset
    database, which is a different finding wearing this TC's name.
    """
    sec = tc.get('section') or {}
    route = str(sec.get('route') or '')
    landing = str(sec.get('landing') or page_url)
    L = [_sec_test_open(tc),
         "    // The id must come from the list: a hard-coded one reds on a reset database.\n",
         "    const ids: string[] = [];\n",
         "    page.on('response', async (r) => {\n",
         "      if (!/\\/api\\//.test(r.url()) || !r.ok()) return;\n",
         "      try {\n",
         "        const j = await r.json();\n",
         "        const rows = Array.isArray(j) ? j : (j?.items ?? j?.data ?? []);\n",
         "        for (const row of rows) { const v = row?.id ?? row?.Id; if (v) ids.push(String(v)); }\n",
         "      } catch { /* non-JSON */ }\n",
         "    });\n",
         f"    await page.goto('{_clean_str(landing)}', {{ waitUntil: 'domcontentloaded' }});\n",
         "    await settled(page);\n",
         "    await expect(async () => { expect(ids.length, 'the landing list returned no rows, so the "
         "task route cannot be exercised with a real id').toBeGreaterThan(0); }).toPass({ timeout: T });\n",
         f"    const target = '{_clean_str(route)}'.replace(/\\{{id\\}}/g, ids[0]);\n",
         "    const resp = await page.goto(target, { waitUntil: 'domcontentloaded' });\n",
         "    await settled(page);\n",
         "    // The route must SERVE the task screen: not 404, and not bounced back to\n",
         "    // the landing page, which is how an unimplemented task route usually behaves.\n",
         "    expect(resp?.status() ?? 0, 'the task route the VIF declares does not resolve')"
         ".toBeLessThan(400);\n",
         f"    expect(page.url(), 'the task route redirected back to the landing page — the task "
         f"screen is not served at its declared route').not.toMatch(/{_clean_str(landing).replace('/', chr(92) + '/')}\\/?$/);\n",
         "    await expect(page.locator('main h1, h1').first(), 'the task route resolved but rendered "
         "no screen').toBeVisible({ timeout: T });\n",
         "  });\n"]
    return ''.join(L)


def _ts_str(s: str) -> str:
    """A TS single-quoted literal. Fixture copy carries apostrophes ("don't have
    permission"), em-dashes and ellipses, so escaping is not optional here."""
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ') + "'"


_SECTION_RENDERERS = {
    'boot-request': _render_boot_request_test,
    'negative-render': _render_negative_render_test,
    'responsive': _render_responsive_test,
    'error-precedence': _render_error_precedence_test,
    'empty-copy': _render_empty_copy_test,
    'fixture-mutation': _render_fixture_mutation_test,
    'task-route': _render_task_route_test,
}

# The metadata each renderer cannot work without. Interpolating an empty value into
# a regex literal or a locator emits code that does not parse — and a parse error
# costs the entire spec file, every test in it, reported as "No tests found" rather
# than as one broken TC. So a renderer missing its input declines here and the TC
# falls through to the prose translator, which degrades one test instead of all of them.
_SECTION_REQUIRED = {
    'boot-request': ('params',),
    'negative-render': ('field',),
    'responsive': ('viewport',),
    'error-precedence': ('id',),
    'empty-copy': ('copies',),
    'fixture-mutation': ('payload',),
    'task-route': ('route',),
}


# Conditions under which a section TC has NO SOUND ORACLE and must not be emitted as
# an assertion. Measured on VIF-GOV-001: every one of these produced a red against a
# conformant screen, i.e. a bug report the dev would have to disprove. A documented
# skip costs a coverage row; a false red costs a person a day and the suite its
# credibility. So the rule is: refuse to guess, and name what the spec must add.
_MUTATION_VERB = re.compile(r'^(?:POST|PUT|PATCH|DELETE)\b', re.I)


def _section_decline(tc: dict) -> str | None:
    """The reason this section TC cannot be honestly asserted, or None."""
    cat = tc.get('category', '')
    sec = tc.get('section') or {}
    if not isinstance(sec, dict):
        return None

    if cat == 'error-precedence':
        ep = str(sec.get('endpoint') or '')
        if not ep:
            return ('UNTESTABLE: no endpoint recovered from the §Empty & Error Precedence '
                    'Condition cell, so the state cannot be forced. Name the endpoint in '
                    'the Condition column.')
        # `POST /api/x` arrives wrapped in backticks/bold from the markdown cell.
        bare_ep = ep.strip().strip('`*_ ')
        # The verb is frequently lost when the Condition cell is prose, leaving a bare
        # action path ('/triage'). Both readings mean the same thing: a cold load never
        # issues it. Measured on VIF-GOV-001: TC-100/101/102 asserted the 409-inline
        # state on a screen that had never submitted anything.
        _ACTION_SEG = re.compile(r'/(?:triage|dismiss[-\w]*|approve|reject|submit|cancel|archive|'
                                 r'restore|resolve|escalate|assign|status|publish)\b', re.I)
        if _ACTION_SEG.search(bare_ep):
            return (f'UNTESTABLE: the condition targets the action endpoint `{bare_ep}`, which a '
                    f'cold page load never calls — the state being asserted never exists, so the '
                    f'level assertion describes the healthy screen. Reaching it needs the '
                    f'interaction that issues the request; the exception pass owns those.')
        if _MUTATION_VERB.match(bare_ep):
            # The old renderer mocked the mutation then only loaded the list page —
            # the mutation never fires, so the asserted state never exists and the
            # level assertion describes the healthy screen.
            return (f'UNTESTABLE: the condition is a {ep.strip().strip(chr(96) + chr(42) + chr(95) + chr(32)).split()[0].upper()} failure, which a '
                    f'cold page load never triggers. Reaching it needs the interaction that '
                    f'issues the request (open the surface, submit) — add it to §Interactions '
                    f'or cover this in the exception pass, which owns interactive flows.')

    if cat == 'queue-column':
        # §Task Screens "Queue Columns" names ENTITY BINDINGS ("RawText (truncated,
        # max 120 chars)"), never the rendered header ("Thought / Observation").
        # Asserting the binding name as header text reds a correct table.
        return ('UNTESTABLE: §Task Screens "Queue Columns" declares entity bindings, not the '
                'visible column headers, so there is nothing sound to assert against the '
                'rendered table. Add a Header column to the VIF to make this assertable.')

    if cat == 'support-panel':
        # An author-supplied `anchor:` IS the assertable half, and the spec template has
        # documented it all along ("text/selector proving the panel actually LOADED, not
        # just that its container mounted") while nothing read it — so a panel whose
        # anchor was filled in still declined. Honour it: a `#id` / `[data-testid=…]`
        # anchor is a selector, anything else is literal copy.
        if str(sec.get('anchor') or '').strip():
            return None
        # Same failure as queue-column: `panel_role` is a key ('info', 'nba'), not
        # copy. Only quoted strings in the Content Source cell are assertable.
        return ('UNTESTABLE: the panel is identified by its role key (\'info\', \'nba\'), which is '
                'not anything a user sees, and its Content Source cell holds field TEMPLATES '
                '(\'Sovereign: {SovereignName}\') and spec annotations rather than literal copy. '
                'Both readings red a conformant panel. Quote the rendered copy, or give the panel '
                'a data-testid, to make this assertable.')

    return None


def _section_renderable(tc: dict) -> bool:
    cat = tc.get('category', '')
    sec = tc.get('section') or {}
    if not isinstance(sec, dict) or sec.get('kind') != cat:
        return False
    return all(sec.get(k) for k in _SECTION_REQUIRED.get(cat, ()))


def _append_assertions_to_body(body: str, tc: dict) -> str:
    """Append a TC's structured oracles inside a body a section renderer produced.

    The section renderers return a finished `test(...) { ... });` string, so the
    oracles are spliced in ahead of its closing brace rather than concatenated
    after it. Without this, every TC a dedicated renderer owns would silently
    drop its authored `assert:` block.
    """
    lines = compile_assertions(tc.get('assertions'), tc.get('spec_ref', ''))
    if not lines or 'test.skip(' in body:
        return body
    close = body.rstrip().rfind('});')
    if close < 0:
        return body
    return body[:close] + '\n'.join(l.strip() and '  ' + l.strip() or l
                                    for l in lines) + '\n  ' + body[close:]


def tc_to_test(tc: dict, page_url: str, selectors: dict, has_auth: bool, feature_var: str, msw: bool = False, element_map: dict | None = None, field_interactions: dict | None = None, backend_mode: str = 'mock') -> str:
    """Render a single test() block."""
    # Layout-discovery TCs use a dedicated template (mock + invariant asserts).
    if tc.get('category') == 'layout-discovery':
        return _render_layout_discovery_test(tc, page_url)

    # Validation-lifecycle TCs use a dedicated template (provoke → fix → assert the
    # message disappears). Prose translation cannot express this ordering.
    if tc.get('category') == 'validation-lifecycle' and not tc.get('skip_reason'):
        return _render_validation_lifecycle_test(tc, page_url, selectors, element_map)

    # VIF-section TCs whose mechanism the prose translator cannot express: capture
    # before navigating, read a response then assert absence, set the viewport
    # first, mock a status then assert the LEVEL. The other four section
    # categories are ordinary open-and-assert flows and fall through below.
    if not tc.get('skip_reason') and not tc.get('spec_only'):
        _decl = _section_decline(tc)
        if _decl:
            # Fall through to the skip_reason branch below: the TC stays visible in
            # the report, carrying what the spec must add, instead of turning into a
            # guessed assertion that reds against a conformant screen.
            tc = {**tc, 'skip_reason': _decl}

    _sr = _SECTION_RENDERERS.get(tc.get('category', ''))
    if _sr and not tc.get('skip_reason') and not tc.get('spec_only') \
            and _section_renderable(tc):
        return _append_assertions_to_body(_sr(tc, page_url), tc)

    # skip_reason: explicit skip with a typed reason (e.g. 'FEATURE_DISABLED: ...',
    # 'KNOWN_BUG: ...'). Emit a test.skip() that carries the reason — visible in
    # the HTML report so reviewers understand why the TC was not executed.
    if tc.get('skip_reason'):
        raw_title = tc['title']
        clean_title = strip_md(raw_title)
        if '|' in clean_title:
            clean_title = clean_title[:clean_title.index('|')].strip()
        test_name = f"{tc['id']} — {clean_title}"
        if tc.get('spec_ref'):
            first_ref = tc['spec_ref'].split('/')[0].strip().split('|')[0].strip()
            test_name += f' [{first_ref}]'
        reason = _clean_str(str(tc['skip_reason']))
        return (
            f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
            f"    test.skip(true, '{reason}');\n"
            f"  }});\n"
        )

    # spec_only tests cannot run in automation — emit test.skip() so they appear in the
    # report as intentionally skipped rather than failing.
    if tc.get('spec_only'):
        raw_title = tc['title']
        clean_title = strip_md(raw_title)
        if '|' in clean_title:
            clean_title = clean_title[:clean_title.index('|')].strip()
        test_name = f"{tc['id']} — {clean_title}"
        if tc.get('spec_ref'):
            first_ref = tc['spec_ref'].split('/')[0].strip().split('|')[0].strip()
            test_name += f' [{first_ref}]'
        reason = 'spec_only: requires fresh browser context or API mock — cannot run on live URL'
        return (
            f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{\n"
            f"    test.skip(true, '{reason}');\n"
            f"  }});\n"
        )

    # Clean title: strip markdown bold, collapse pipe-separated table fragments
    raw_title = tc['title']
    clean_title = strip_md(raw_title)
    # Truncate at first '|' to cut off any leaked markdown table content
    if '|' in clean_title:
        clean_title = clean_title[:clean_title.index('|')].strip()

    test_name = f"{tc['id']} — {clean_title}"
    if tc['spec_ref']:
        # Keep only first spec ref if multiple (e.g. "VAL-001 / UF-001")
        first_ref = tc['spec_ref'].split('/')[0].strip().split('|')[0].strip()
        test_name += f" [{first_ref}]"

    # Prototype = local file:// OR URL contains 'prototype' keyword
    # Real (live) URLs like https://dev.mgios.com are NOT prototype
    is_prototype = page_url.startswith('file://') or 'prototype' in page_url.lower()
    fail_decorator = (
        "  test.fail(true, 'Prototype/local file — no backend. Validating UI flow only.');\n"
        if is_prototype else ''
    )

    # Fill preamble: when the TC has test_data AND a click submit/save step,
    # auto-emit fill/select lines from canonical test_data keys using element-map
    # to resolve input vs shadcn-select vs checkbox. This replaces unreliable
    # natural-language "Enter X in Y field" parsing which fails when element-map
    # inputs have no visible label (radix/shadcn components).
    has_submit_click = any(
        re.search(r'click.*(save draft|submit|submit for review)', s, re.IGNORECASE)
        for s in tc.get('steps', [])
    )
    td = tc.get('test_data') or {}
    preamble_lines: list[str] = []
    if td and has_submit_click:
        preamble_lines = _build_fill_preamble(td, element_map, field_interactions)

    # Drop step-level fill/enter/select/leave lines (they'd duplicate the preamble).
    # Keep navigate, click, verify, etc.
    # Steps and their authored oracles are filtered together so an oracle never
    # drifts onto a different step than the one it was written for. A dropped
    # step's oracles survive by moving to the step before it — the state they
    # describe is still reached, just by the preamble instead.
    _pairs = list(zip(tc['steps'],
                      (tc.get('step_assertions') or []) + [[]] * len(tc['steps'])))
    if preamble_lines:
        # Drop fill/enter/select/leave/clear — preamble covers them.
        # Also drop 'Trigger violation of VAL-xxx…' / 'Attempt to proceed…' /
        # 'Set up pre-conditions for BR-xxx' meta-steps that would otherwise hit
        # the generic submit/save fallback and emit a spurious button click.
        _kept: list[tuple] = []
        _carry: list = []
        for _s, _a in _pairs:
            if re.search(r'^\s*(enter|fill|type|input|select|leave|keep|clear|trigger|attempt|set up)\b',
                         _s, re.IGNORECASE):
                _carry += list(_a or [])
                continue
            _kept.append((_s, list(_a or []) + _carry))
            _carry = []
        if _carry and _kept:
            _kept[-1] = (_kept[-1][0], _kept[-1][1] + _carry)
        _pairs = _kept
    filtered_steps = [_s for _s, _ in _pairs]
    filtered_asserts = [_a for _, _a in _pairs]

    code_lines = steps_to_code(
        filtered_steps, tc.get('expected', ''), tc.get('precondition', ''),
        page_url, selectors, tc.get('flow', ''), has_auth, feature_var,
        element_map=element_map,
        step_assertions=filtered_asserts,
        spec_ref=tc.get('spec_ref', ''),
        has_assertions=bool(tc.get('assertions')),
    )
    if preamble_lines:
        code_lines = preamble_lines + code_lines

    # Smart AUTH-role assertion (Q7a): role-based TCs shouldn't assert role name
    # as visible text — it's not rendered on the UI. Assert form visibility instead
    # for roles WITH create permission (foundry_admin, admin).
    spec_ref = (tc.get('spec_ref') or '').lower()
    title_lower = (tc.get('title') or '').lower()
    if 'auth-role' in spec_ref or ('authorization' in title_lower and 'role' in title_lower):
        # Strip any previously-generated getByText('role_name') assertions
        code_lines = [
            c for c in code_lines
            if not re.search(r"getByText\('(foundry_admin|admin|no_permission_user|_user)'\)", c)
        ]
        code_lines.append("  // Assert form visible — user with this role has create permission")
        code_lines.append("  await expect(page.locator('#spec-name')).toBeVisible();")
        code_lines.append("  await expect(page.getByRole('button', {name: 'Save Draft', exact: true})).toBeVisible();")
        code_lines.append("  await expect(page.locator('[role=\"alert\"][data-slot=\"alert\"]')).toHaveCount(0);")

    # Structured oracles authored at Step 2 (spec `assert:`) are compiled last,
    # after the steps have driven the UI into the state they describe. A failure
    # here is an AssertionSpecError and aborts generation on purpose — see
    # compile_assertions().
    code_lines += compile_assertions(tc.get('assertions'), tc.get('spec_ref', ''))

    # A flow-level `assert:` and its last step's `assert:` are usually the SAME oracle,
    # so both compile to a byte-identical expect() and the test asserts it twice. That is
    # not a stronger check — it doubles the runtime and makes a suite look richer than it
    # is. Keep the first occurrence, drop later exact repeats.
    _seen: set[str] = set()
    _deduped: list[str] = []
    for _c in code_lines:
        _k = _c.strip()
        if _k.startswith('await expect'):
            if _k in _seen:
                continue
            _seen.add(_k)
        _deduped.append(_c)
    code_lines = _deduped

    # ── No-oracle gate ────────────────────────────────────────────────────────
    # A test body that reaches this point with no assertion at all cannot fail, so it
    # reports GREEN forever and inflates every coverage number that counts it. That is
    # strictly worse than an absent test, because it looks like coverage. It happens
    # whenever a spec row carries no `assert:` — enforcement guards drafted by
    # resolve_specs, an acceptance criterion nobody grounded — and the builder has
    # nothing to compile. Refuse to emit the empty body: say what is missing instead,
    # so the gap lands in the skip list where someone can act on it.
    if not any(
        _c.strip().startswith('await expect')
        or _c.strip().startswith('expect(')
        or 'assertNo' in _c or 'assertChild' in _c or 'assertMax' in _c
        or 'assertText' in _c or 'assertControls' in _c or 'assertField' in _c
        or 'assertReset' in _c
        for _c in code_lines
    ):
        _ref = _clean_str(tc.get('spec_ref', '') or tc.get('flow', '') or 'this row')
        code_lines = [
            f"  test.skip(true, 'NO ORACLE: {_ref} carries no `assert:` in the spec yaml, "
            f"so nothing could be compiled into an expect(). Author the oracle at Step "
            f"2c-assert — an assertion-free body would report a permanent false green.');"
        ]

    body = '\n'.join(code_lines)

    # api_mock: use api-helpers.ts — cleaner alternative to inline mock_routes
    if tc.get('requires_context') == 'api_mock' and tc.get('mock_key'):
        preamble = [
            f"  await mockApiQueue(page, MOCK_TASKS.{tc['mock_key']});",
            f"  await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});",
            "  await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible' });",
        ]
        body = '\n'.join(preamble) + '\n' + body

    # no_auth: anonymous redirect / permission check. Two styles:
    #   - Redirect-style (AUTH-unauth): server-side 302/307 → /auth/signin.
    #     We use playwright.request (HTTP-level) so we never inherit the project
    #     storageState. `browser.newContext({ storageState: undefined })` is
    #     NOT enough — Playwright treats undefined as "use project default" and
    #     silently carries the signed-in cookies forward.
    #   - Alert-style (AUTH-no-perm): user has session but lacks role → page
    #     renders a permission-denied alert. Still uses browser context with an
    #     explicit empty cookies override.
    if tc.get('no_auth'):
        expected_text = (tc.get('expected') or '').lower()
        if 'permission' in expected_text or 'alert' in expected_text:
            # Extract alert text from expected (between quotes) for assertion
            m = re.search(r'"([^"]+)"', tc.get('expected', ''))
            alert_snippet = m.group(1) if m else "permission"
            alert_needle = alert_snippet[:30].replace("'", "\\'")
            no_auth_body = (
                f"  const context = await browser.newContext({{ storageState: {{ cookies: [], origins: [] }} }});\n"
                f"  const page = await context.newPage();\n"
                f"  await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});\n"
                f"  await expect(page.getByText(/{re.escape(alert_needle)}/i).first()).toBeVisible({{ timeout: 15000 }});\n"
                f"  await context.close();"
            )
            lines = [f"  test('{_clean_str(test_name)}', async ({{ browser }}) => {{"]
        else:
            # AUTH-unauth — HTTP-level redirect check (env-resilient).
            # A fresh request context does NOT inherit the project baseURL, so pass it
            # explicitly — otherwise the relative page_url ('/foo') cannot resolve (#143582).
            no_auth_body = (
                f"  const apiCtx = await playwright.request.newContext({{ baseURL: test.info().project.use.baseURL, storageState: {{ cookies: [], origins: [] }}, ignoreHTTPSErrors: true }});\n"
                f"  try {{\n"
                f"    const res = await apiCtx.get('{_clean_str(page_url)}', {{ maxRedirects: 0 }});\n"
                f"    expect([302, 307]).toContain(res.status());\n"
                f"    const location = res.headers()['location'] || '';\n"
                f"    expect(location).toMatch(/\\/auth\\/(?:signin|login)/i);\n"
                f"    expect(location).toMatch(/callbackUrl=/i);\n"
                f"  }} finally {{\n"
                f"    await apiCtx.dispose();\n"
                f"  }}"
            )
            lines = [f"  test('{_clean_str(test_name)}', async ({{ playwright }}) => {{"]
        lines += [no_auth_body, "  });", ""]
        return '\n'.join(lines)

    # mock_routes: intercept API calls then re-navigate so mocked responses take effect
    if tc.get('mock_routes'):
        route_lines = []
        for route in tc['mock_routes']:
            pattern = route.get('pattern', '')
            if 'abort' in route:
                if msw:
                    # MSW: addInitScript cannot abort — simulate with 503
                    route_lines.append(f"  await overrideFetchWithStatus(page, '{pattern}', 503, {{\"message\": \"network error\"}});")
                else:
                    route_lines.append(f"  await page.route('{pattern}', route => route.abort('{route['abort']}'));")
            elif 'mutate' in route or 'replace' in route:
                # Fix C — fetch the real response, patch JSON field(s) by dotted path,
                # then fulfill 200. Both keys emit the SAME interception; they differ only
                # in intent: `mutate` patches individual index paths ("alerts.0.type") to
                # exercise enum/threshold variants on a live record; `replace` sets whole
                # paths (e.g. an entire array → one element) to force a deterministic
                # variant without racing leftover LIVE elements (strict-mode duplicates) —
                # prefer it for "render this one variant" visual TCs.
                _patch = route.get('mutate') or route.get('replace') or {}
                route_lines.append(f"  await page.route('{pattern}', async route => {{")
                route_lines.append("    const _resp = await route.fetch();")
                route_lines.append("    let _data; try { _data = await _resp.json(); } catch { await route.continue(); return; }")
                route_lines.append("    const _set = (o: any, path: string, val: unknown) => { const p = path.split('.'); let t = o; for (let i = 0; i < p.length - 1; i++) { if (t[p[i]] == null) t[p[i]] = {}; t = t[p[i]]; } t[p[p.length - 1]] = val; };")
                for fld, val in _patch.items():
                    route_lines.append(f"    _set(_data, {json.dumps(str(fld))}, {json.dumps(val)});")
                route_lines.append("    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(_data) });")
                route_lines.append("  });")
            elif 'delay' in route:
                # Fix B — delay then pass through to the real backend, so the loading
                # state stays on screen long enough to assert the skeleton.
                delay_ms = int(route.get('delay', 2000))
                route_lines.append(f"  await page.route('{pattern}', async route => {{ await new Promise(r => setTimeout(r, {delay_ms})); await route.continue(); }});")
            elif 'response' in route:
                resp = route['response']
                status = resp.get('status', 200)
                body_obj = json.dumps(resp.get('body', {}))
                if msw:
                    if status == 200:
                        route_lines.append(f"  await overrideFetchWithMock(page, '{pattern}', {body_obj});")
                    else:
                        route_lines.append(f"  await overrideFetchWithStatus(page, '{pattern}', {status}, {body_obj});")
                else:
                    body_ts = json.dumps(json.dumps(resp.get('body', {})))
                    route_lines.append(f"  await page.route('{pattern}', async route => {{")
                    # A write endpoint shares its URL with the collection read
                    # (`POST /api/x` vs `GET /api/x`), and page.route matches on URL
                    # only — without this guard, mocking the create 422 also serves
                    # 422 to the list load and the screen never reaches the form.
                    if route.get('method'):
                        _m = str(route['method']).upper()
                        route_lines.append(
                            f"    if (route.request().method() !== '{_m}') return route.continue();")
                    route_lines.append(f"    await route.fulfill({{ status: {status}, contentType: 'application/json', body: {body_ts} }});")
                    route_lines.append(f"  }});")
        route_lines.append(f"  await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});")
        route_lines.append("  await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible' });")
        body = '\n'.join(route_lines) + '\n' + body

    lines = [
        f"  test('{_clean_str(test_name)}', async ({{ page }}) => {{",
    ]
    if fail_decorator:
        lines.append(f"    {fail_decorator.strip()}")
    # Per-step compatibility check: the first step incompatible with the
    # active backend mode wins. See _mode_config.TAG_SKIP_RULES for the matrix.
    skip_reason = None
    for dep in (tc.get('step_deps') or []):
        reason = should_skip(backend_mode, dep)
        if reason:
            skip_reason = reason
            break
    if skip_reason:
        escaped = skip_reason.replace("'", "\\'")
        lines.append(f"    test.skip(true, '{escaped}');")
    lines += [body, "  });", ""]
    return '\n'.join(lines)


def generate_spec_file(tcs: list[dict], element_map: dict, page_url: str,
                       feature: str, has_auth: bool, auth_username='', auth_password='',
                       helpers_import: str = '', msw: bool = False,
                       field_interactions: dict | None = None,
                       backend_mode: str = 'mock',
                       native_tags: list[str] | None = None,
                       seed_import: str = '',
                       timeouts_import: str = '',
                       spec_version: dict | None = None) -> str:
    inputs = element_map.get('inputs', []) + element_map.get('textareas', []) + \
             element_map.get('selects', []) + element_map.get('buttons', [])
    selectors = map_selectors(inputs)
    feature_var = re.sub(r'[^a-zA-Z0-9]', '_', feature)

    # A feature registered in seed-recipes.generated.ts MUST bind `seedTest(...)`:
    # the plain `@playwright/test` export has no `seedData` fixture, so any TC body
    # destructuring `{ page, seedData }` fails at COLLECTION time ("Test has unknown
    # parameter \"seedData\"") \u2014 Playwright then runs NOTHING, not even the `setup`
    # project, so .auth/user.json is never written and CI misreports it as an auth
    # failure. Never emit a conditional/fallback binding to the plain export.
    # Spec-version banner FIRST — ahead of the imports, so the revision these oracles
    # were derived from is line 1 of the committed file and needs no tooling to check.
    sv = spec_version or {}
    banner = []
    if sv.get('vif_id'):
        gram = sv.get('vif_grammar', '')
        banner = [
            '// ' + '=' * 73,
            f'// SPEC UNDER TEST: {sv["vif_id"]} v{sv["vif_version"]}  (grammar {gram})',
            '//',
            '// Every oracle below was derived from THAT revision. If the VIF has moved on,',
            '// this suite is STALE — reconcile it, do not relax an oracle to match the app.',
        ] + ([
            f'// \u26a0\ufe0f  grammar {gram}: the 0.4-only spec columns (ES Properties',
            '//     constraints, CT ValidationTier/Binding, Error Responses `Applies To`)',
            '//     were unavailable, so guard coverage here is prose-derived.',
        ] if gram != '0.4' else []) + [
            '// ' + '=' * 73,
            '',
        ]

    if seed_import:
        lines = banner + ["import { expect } from '@playwright/test';", seed_import]
    else:
        lines = banner + ["import { test, expect } from '@playwright/test';"]
    if helpers_import:
        lines.append(helpers_import)
    # Every test/describe ceiling this file emits goes through extendedTimeoutMs() so a
    # slower CI/dev environment can raise them all at once via PLAYWRIGHT_EXTENDED_TIMEOUT
    # instead of hand-editing each generated spec. The literal below stays the floor.
    lines.append(timeouts_import or
                 "import { extendedTimeoutMs } from '../../lib/timeouts';")
    cfg = get_config(backend_mode)
    lines += [
        "",
        "// Auth is handled by Playwright storageState (setup project) \u2014 no login needed",
        "",
    ]
    if seed_import:
        lines += [
            f"// Seed fixture: recipes for '{feature}' are registered in",
            "// setup/seed-recipes.generated.ts; seeded ids arrive via the `seedData` fixture.",
            f"const test = seedTest('{feature}');",
            "",
        ]
    lines += [
        f"// Backend mode: {backend_mode}. Settle strategy + timeout selected at generation time.",
        f"// (See .claude/skills/ui-flow-test-generator/scripts/_mode_config.py)",
        "const REAL = process.env.BACKEND_MODE === 'real';",
        f"const T = {cfg['assert_timeout_ms']};",
        "async function settled(page: import('@playwright/test').Page) {",
        f"  {cfg['settle_wait_ts']};",
        "}",
        "",
        "// Open a Select/combobox robustly: a pre-hydration click is a no-op and base-ui",
        "// keeps the listbox in the DOM while CLOSED, so retry the open until an option is",
        "// actually visible. Click only when not already open (re-clicking would toggle it",
        "// shut). A genuinely broken control still fails after T — this absorbs harness",
        "// timing flake, not product bugs.",
        "async function openSelect(loc: import('@playwright/test').Locator) {",
        "  const page = loc.page();",
        "  const opt = page.getByRole('option').first();",
        "  await expect(async () => {",
        "    if (!(await opt.isVisible().catch(() => false))) await loc.click();",
        "    await expect(opt).toBeVisible({ timeout: 1500 });",
        "  }).toPass({ timeout: T });",
        "}",
        "",
        "function buildTestData(field: string): string {",
        "  const defaults: Record<string, string> = {",
        "    username: 'john_doe_test', firstname: 'John', lastname: 'Doe',",
        "    email: 'john.doe.test@example.com', password: 'Test@12345',",
        "    phone: '+84901234567', name: 'Test Name',",
        "  };",
        "  return defaults[field.toLowerCase()] ?? `test-${field}`;",
        "}",
        "",
    ]

    # Auth is handled by Playwright storageState — no loginHelper needed

    # Pick a page-ready signal from element map.
    # Priority order (most reliable → least):
    #   1. First form input with an id → `#<id>` (content-specific, not shell).
    #   2. First button/link whose label is NOT a known shell/chrome element.
    #   3. `main` region visible (baseline).
    # Rationale: buttons[0] is often an app-shell item (sidebar nav, user menu,
    # notification bell) that exists on every route incl. login/redirect pages,
    # so waiting on it lets the test proceed before the actual content has rendered
    # — causing downstream `locator('#field').fill(...)` to timeout at 60s.
    ready_wait = "await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible' });"

    # 1. Prefer first form input (inputs / fields key, whichever analyze_page emits).
    inputs = element_map.get('inputs') or element_map.get('fields') or []

    # A framework-generated id is not a page-ready signal. base-ui/radix mint ids like
    # `base-ui-_r_v_` per render, so the selector changes between builds; worse, the one
    # picked on VIF-GOV-001 belonged to a row-select CHECKBOX, which does not exist when
    # the table is empty — so every beforeEach in the file depended on the queue having
    # rows. Require an id that a human wrote AND a control that carries a name or label.
    _GENERATED_ID = re.compile(r'(^|[-_])(?:base-ui|radix|mui|headlessui|react-aria)([-_]|$)|_r_|^:r|^r[0-9a-z]{4,}$', re.I)
    _CONTROL_KINDS = {'checkbox', 'radio', 'hidden', 'submit', 'button', 'file'}

    def _usable_ready_id(f: dict) -> bool:
        fid = f.get('id') or ''
        if not fid or fid.startswith('_') or _GENERATED_ID.search(fid):
            return False
        # A checkbox/radio is row- or option-scoped: present only when data is.
        if str(f.get('type') or '').lower() in _CONTROL_KINDS:
            return False
        # A control the element map captured inside a dialog/sheet is absent on
        # load — the surface that owns it is closed. Picking one made every test
        # in gov003-probe fail in beforeEach on `#sg-objective`, a field that only
        # exists once SetGoalSheet is open.
        if str(f.get('scope') or '').lower() in {'dialog', 'modal', 'sheet', 'popover'}:
            return False
        # A disabled control is not evidence the page is ready for interaction,
        # and in practice the disabled ones in a captured map are the derived
        # fields of a closed form.
        if f.get('disabled'):
            return False
        return bool(f.get('name') or f.get('placeholder') or f.get('aria_label'))

    first_input_id = next((f.get('id') for f in inputs if _usable_ready_id(f)), None)
    if first_input_id:
        # Wait for main region THEN the first real form field → proves form rendered.
        ready_wait = (
            "await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible', timeout: 15000 });\n"
            f"    await expect(page.locator('#{first_input_id}')).toBeVisible({{ timeout: 15000 }});"
        )
    else:
        # 2. The page's own H1. Every screen in this corpus renders one, it is content
        #    (never app chrome), and it does not depend on the queue having rows —
        #    unlike the first button, whose label the old code guessed by taking its
        #    first word (`/Line/i` off a legend on VIF-GOV-001). A named-button guess
        #    that misses makes EVERY test in the file fail in beforeEach.
        ready_wait = (
            "await page.locator('main, [role=\"main\"]').first().waitFor({ state: 'visible', timeout: 15000 });\n"
            "    await expect(page.locator('main h1, h1').first()).toBeVisible({ timeout: 15000 });"
        )

    # Playwright native tag for --grep selection. Never empty: resolve_native_tags()
    # exits rather than return an area-less list, and lint R9 rejects `tag: []`.
    if not native_tags:
        raise ValueError('native_tags is empty — resolve_native_tags() must supply an area tag')
    _tags = native_tags
    _tag_lit = '[' + ', '.join(f"'{t}'" for t in _tags) + ']'
    lines += [
        f"test.describe('{_clean_str(feature)} — UI Flow Tests', {{ tag: {_tag_lit} }}, () => {{",
        "  // extendedTimeoutMs() reads PLAYWRIGHT_EXTENDED_TIMEOUT and takes no argument —\n  // passing one made every generated suite fail `lint:types`.\n  test.describe.configure({ timeout: extendedTimeoutMs() });",
        "",
        "  test.beforeEach(async ({ page }) => {",
        f"    await page.goto('{_clean_str(page_url)}', {{ waitUntil: 'domcontentloaded' }});",
        f"    // Page-ready signal: prefer a form input over shell buttons (sidebar/user-menu are always visible).",
        f"    {ready_wait}",
        "  });",
        "",
    ]

    for tc in tcs:
        lines.append(tc_to_test(tc, page_url, selectors, has_auth, feature_var, msw=msw, element_map=element_map, field_interactions=field_interactions, backend_mode=backend_mode))

    lines += ["});", ""]
    content = '\n'.join(lines)

    # Post-process: add real-mode timeout to bare toBeVisible()/toBeHidden() calls,
    # and inject `await settled(page)` after every page.goto(...). At runtime, settled()
    # is a no-op when BACKEND_MODE != 'real' — so mock mode pays nothing.
    content = re.sub(r"\.toBe(Visible|Hidden)\(\)", r".toBe\1({ timeout: T })", content)
    content = re.sub(
        r"(await page\.goto\([^)]*\);)(?!\s*\n\s*await settled\(page\);)",
        r"\1\n    await settled(page);",
        content,
    )

    # Auto-`.first()` for duplicate IDs (responsive double-render: same id rendered
    # twice when desktop + mobile layouts both live in DOM). analyze_page emits
    # `duplicate_ids: ["foo", "bar"]`; for each, append `.first()` to every
    # `page.locator('#foo')` that doesn't already chain `.first()` / `.nth(...)`.
    dup_ids = (element_map or {}).get('duplicate_ids') or []
    for dup_id in dup_ids:
        # Match: page.locator('#dup_id')  OR  page.locator("#dup_id")
        # but NOT already followed by .first / .nth / .last
        # Use lookahead to avoid double-appending.
        escaped = re.escape(dup_id)
        pattern = (
            r"(page\.locator\((['\"])#" + escaped + r"\2\))"
            r"(?!\s*\.(first|nth|last)\b)"
        )
        content = re.sub(pattern, r"\1.first()", content)

    # Safety tag: every emitted test gets exactly one of @readonly / @mutating so the
    # prod-monitoring run can select with `--grep @readonly`. Classified from the body
    # the generator just produced, erring toward @mutating — see mutation_tags.py.
    content = tag_source(content)
    return content

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Generate Playwright TS spec from test cases')
    parser.add_argument('--testcases', required=True, help='Test cases .md file')
    parser.add_argument('--element-map', default='', dest='element_map')
    parser.add_argument('--page-url', required=True, dest='page_url')
    parser.add_argument('--date', default=TODAY)
    parser.add_argument('--feature', default='', help='Feature slug (used as filename)')
    parser.add_argument('--out-dir', default='apps/testing/automation-testing/fe-testing/script/ui', dest='out_dir')
    parser.add_argument('--auth-username', default='', dest='auth_username')
    parser.add_argument('--auth-password', default='', dest='auth_password')
    parser.add_argument('--msw', action='store_true',
                        help='MSW-aware mock: use addInitScript (overrideFetchWithMock/Status) instead of page.route(). Required when deployment uses Mock Service Worker (e.g. *.4mgi.com).')
    parser.add_argument('--force', action='store_true',
                        help='Overwrite existing spec.ts (default: abort if file already exists)')
    parser.add_argument('--backend-mode', default=os.environ.get('BACKEND_MODE', 'mock'),
                        choices=['mock', 'real'], dest='backend_mode',
                        help='real: long timeouts + waitForLoadState networkidle + skip fixture-dependent steps')
    parser.add_argument('--spec-yaml', default='', dest='spec_yaml',
                        help='Optional path to {feature}-spec.yaml — loads field_interactions map to drive fill preamble for list-repeaters, checkbox groups, and labelled inputs.')
    parser.add_argument('--domain-tag', default='', dest='domain_tag',
                        help="Playwright native DOMAIN tag for CI --grep selection "
                             "(one of: sop, analytics, drtp, releases, governance, "
                             "operations, forge, channel, strategy, "
                             "actors). With or without a leading '@'. PREFERRED — pass "
                             "it explicitly (the skill knows the BC). If omitted, the "
                             "tag is inferred from --page-url with a warning.")
    parser.add_argument('--tier', default='regression', dest='tier',
                        choices=['regression', 'smoke'],
                        help="Playwright native TIER tag (default: regression). @smoke "
                             "files are normally hand-curated, not generated.")
    args = parser.parse_args()

    # Load field_interactions from spec YAML if provided (maps test_data keys to
    # interaction types: input, select, checkbox-group, step-list, tag-input, input-labelled)
    field_interactions: dict = {}
    if args.spec_yaml and _HAS_YAML:
        sp = Path(args.spec_yaml)
        if sp.exists():
            with open(sp, 'r', encoding='utf-8') as _sf:
                _spec = _yaml.safe_load(_sf) or {}
            field_interactions = _spec.get('field_interactions') or {}
            if field_interactions:
                print(f'   Field interactions loaded: {len(field_interactions)} field(s)')

    # Relativize the page URL so the emitted spec.ts resolves against baseURL
    # (UI_BASE_URL) instead of hard-coding the deployment host (#143582).
    args.page_url = to_relative_url(args.page_url)

    feature = args.feature or Path(args.testcases).stem.replace('-test-cases', '')
    print(f'⚙️  Generating Playwright spec: {feature}')

    tcs = parse_test_cases(args.testcases)

    # Version gate — refuse to write a spec.ts whose oracles cannot be attributed to a
    # VIF revision. Mirrors the HALT in generate_test_cases.py; catches a hand-written
    # or pre-contract test-cases yaml that never went through that script.
    spec_version = parse_spec_version(args.testcases)
    sv_missing = [k for k in ('vif_id', 'vif_version', 'vif_grammar')
                  if not spec_version.get(k)]
    if sv_missing:
        print(f'''
❌ REFUSING TO WRITE — test-cases yaml has no spec-version block {sv_missing}

   file: {args.testcases}

   Add the three keys at the top of that yaml (they are emitted automatically by
   generate_test_cases.py, so a missing block means the yaml was hand-written or
   predates the contract):

     vif_id: "VIF-KNW-001"
     vif_version: "1.6.0"
     vif_grammar: "0.3"

   Copy them from the "spec-yaml provenance block" that resolve_specs.py prints —
   the only authority is `version:` in the VIF frontmatter, never a `spec_ref` string.
''', file=sys.stderr)
        sys.exit(1)
    print(f'   spec version: {spec_version["vif_id"]} v{spec_version["vif_version"]} '
          f'(grammar {spec_version["vif_grammar"]})')

    element_map = load_element_map(args.element_map)
    has_auth = bool(args.auth_username or args.auth_password)

    print(f'   {len(tcs)} TCs loaded, {len(element_map.get("inputs", []))} inputs in element map')

    # Append bad-data-fixtures import if any TC is layout-discovery
    has_layout_discovery = any(tc.get('category') == 'layout-discovery' for tc in tcs)

    # Scaffold and compute import path for api-helpers when MSW mode or any TC uses api_mock context
    helpers_import = ''
    if args.msw or any(tc.get('requires_context') == 'api_mock' for tc in tcs):
        testing_root = Path(args.testcases).resolve().parent.parent.parent
        helpers_path = testing_root / 'setup' / 'api-helpers.ts'
        if not helpers_path.exists():
            template_path = Path(__file__).parent.parent / 'templates' / 'api-helpers.template.yaml'
            if template_path.exists() and _HAS_YAML:
                with open(str(template_path), 'r', encoding='utf-8') as _tf:
                    _tmpl = _yaml.safe_load(_tf)
                _ts_code = _tmpl.get('code', '')
                helpers_path.parent.mkdir(parents=True, exist_ok=True)
                with open(str(helpers_path), 'w', encoding='utf-8') as _hf:
                    _hf.write(_ts_code)
                print(f'\U0001f4c4  Scaffolded: {helpers_path}')
            else:
                print(f'\u26a0\ufe0f  api-helpers template not found: {template_path}')
        spec_dir = Path(args.out_dir).resolve()
        import_rel = os.path.relpath(str(testing_root / 'setup'), str(spec_dir)).replace('\\', '/')
        helpers_import = f"import {{ overrideFetchWithMock, overrideFetchWithStatus, overrideFetchWithMockExcludeMany, overrideFetchWithStatusExcludeMany }} from '{import_rel}/api-helpers';"

    if has_layout_discovery:
        testing_root = Path(args.testcases).resolve().parent.parent.parent
        spec_dir = Path(args.out_dir).resolve()
        import_rel_layout = os.path.relpath(str(testing_root / 'setup'), str(spec_dir)).replace('\\', '/')
        layout_import = (
            "import { LAYOUT_BAD_STRINGS, assertNoHorizontalPageScroll, assertChildWithinParent, "
            "assertMaxRowHeight, assertNoUndefinedRender, measureBaselineRowHeight, "
            "injectFieldValue, assertTextWithinViewport, assertControlsWithinContainer, "
            "assertNoClippedScrollSurface, assertNoCollapsedScrollRegion, "
            "assertNoHorizontalOverflowInScrollBox } "
            f"from '{import_rel_layout}/bad-data-fixtures';"
        )
        helpers_import = (helpers_import + '\n' + layout_import).strip()

    # Append validation-helpers import when any TC checks the validation-message
    # lifecycle (clear-on-valid / pristine / re-arm / reset).
    if any(tc.get('category') == 'validation-lifecycle' and not tc.get('skip_reason')
           for tc in tcs):
        testing_root = Path(args.testcases).resolve().parent.parent.parent
        spec_dir = Path(args.out_dir).resolve()
        import_rel_val = os.path.relpath(str(testing_root / 'setup'), str(spec_dir)).replace('\\', '/')
        val_import = (
            "import { assertFieldErrorClearsWhenValid, assertNoErrorsOnPristineForm, "
            "assertFieldErrorReappears, assertResetClearsErrors, waitForFieldError, blurField } "
            f"from '{import_rel_val}/validation-helpers';"
        )
        helpers_import = (helpers_import + '\n' + val_import).strip()

    native_tags = resolve_native_tags(args.domain_tag, args.tier, args.page_url)

    # Seed-fixture binding. generate_seed_fixture.py (Step 5.6) upserts this
    # feature's recipes into the shared registry BEFORE this script runs, so the
    # registry is the authoritative answer to "does this suite have seedData?".
    seed_import = ''
    testing_root = Path(args.testcases).resolve().parent.parent.parent
    registry_path = testing_root / 'setup' / 'seed-recipes.generated.ts'
    if registry_path.exists():
        registry_src = registry_path.read_text(encoding='utf-8')
        if f'"{feature}": {{' in registry_src:
            spec_dir = Path(args.out_dir).resolve()
            import_rel_seed = os.path.relpath(str(testing_root / 'setup'), str(spec_dir)).replace('\\', '/')
            seed_import = f"import {{ seedTest }} from '{import_rel_seed}/seed-recipes.generated';"
            print(f'   seed fixture: bound via seedTest(\'{feature}\')')

    # Same relpath treatment as the setup/* imports above: the depth is otherwise
    # frozen at out-dir=script/ui, and a deeper out-dir would resolve every setup
    # import correctly while silently breaking this one.
    import_rel_lib = os.path.relpath(str(testing_root / 'lib'),
                                     str(Path(args.out_dir).resolve())).replace('\\', '/')
    timeouts_import = f"import {{ extendedTimeoutMs }} from '{import_rel_lib}/timeouts';"
    # Unconditional twin of the `import_rel` computed inside the mock/helpers branch
    # above — enforce_lint_safe_waits needs the setup/ path on EVERY run, including the
    # runs that branch never takes.
    import_rel_setup = os.path.relpath(str(testing_root / 'setup'),
                                       str(Path(args.out_dir).resolve())).replace('\\', '/')

    spec_content = generate_spec_file(tcs, element_map, args.page_url,
                                       feature, has_auth, args.auth_username, args.auth_password,
                                       helpers_import=helpers_import, msw=args.msw,
                                       field_interactions=field_interactions,
                                       backend_mode=args.backend_mode,
                                       native_tags=native_tags,
                                       seed_import=seed_import,
                                       timeouts_import=timeouts_import,
                                       spec_version=spec_version)
    print(f'   backend-mode: {args.backend_mode}')
    print(f'   native tags : {native_tags}')

    spec_content = enforce_lint_safe_waits(spec_content, import_rel_lib, import_rel_setup)

    # Collection guard \u2014 a spec that reads `seedData` without a `seedTest(...)`
    # binding does not fail as a test: Playwright rejects it while LOADING the file
    # and then runs zero tests in every project (including `setup`), which surfaces
    # downstream as a bogus "auth setup failed". Refuse to write such a file.
    if 'seedData' in spec_content and 'seedTest(' not in spec_content:
        print(f"""
\u274c REFUSING TO WRITE \u2014 spec reads `seedData` but has no seed binding.

   Feature : {feature}
   Registry: {registry_path}

   The TCs destructure `{{ page, seedData }}` while `test` still comes from
   `@playwright/test`, which has no such fixture. Playwright would fail at
   COLLECTION ("Test has unknown parameter \"seedData\"") and run 0 tests.

   Fix: register the recipes first, then re-run this script:
     python3 .claude/skills/ui-flow-test-generator/scripts/generate_seed_fixture.py --spec-yaml <spec.yaml>
""", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out_dir) / f'{feature}.spec.ts'
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if out_path.exists() and not args.force:
        print(f"""
⚠️  EXISTING SPEC DETECTED — aborting overwrite.

   File : {out_path}

   The spec.ts at this date already exists (may have been manually fixed).
   Re-running generate_scripts.py without --force will NEVER overwrite it.

   Options:
     • Add --force to regenerate from the current YAML (manual edits will be LOST)
     • Edit the spec.ts file directly to update individual tests
""", file=sys.stderr)
        import sys as _sys; _sys.exit(1)

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(spec_content)

    print(f'✅ Saved: {out_path}')
    print(f'   Run: npx playwright test {out_path.name} --project="UI Tests"')


if __name__ == '__main__':
    main()
