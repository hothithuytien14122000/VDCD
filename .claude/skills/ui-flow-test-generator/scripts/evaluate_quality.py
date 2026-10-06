#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 4.5 + 4.6 — Evaluate test case quality (7 UI dimensions) and auto-improve.

Reads:
  - test-cases YAML file (output of generate_test_cases.py)
  - spec file (for UF/VAL/BR coverage check)

Exits with code 0 if overall >= 4.0, code 1 if still below after improvements.

Usage:
    python3 evaluate_quality.py \
        --testcases apps/testing/automation-testing/fe-testing/test-cases/ui/create-user-test-cases.yaml \
        --spec .mgi-codex/03_Domains/user-management/create-user-plan-spec.md
"""

import argparse
import json
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

# ── Parsers ───────────────────────────────────────────────────────────────────


def _reachable_guard_floor(spec: dict) -> tuple[int, str]:
    """Recompute how many enforcement guards THIS screen can reach, straight from
    the specs, so the gate never has to trust a hand-typed count.

    Returns (0, '') whenever it cannot do so honestly — no SPEC_FILE in the
    environment, resolve_specs unavailable, or an ES still on grammar 0.3 where the
    guards are prose and any count would be a guess. A silent 0 is correct there:
    a floor invented from a partial read would fail suites that are complete.
    """
    import os
    vif = os.environ.get('SPEC_FILE', '')
    if not vif or not Path(vif).is_file():
        return 0, ''
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import resolve_specs as R
        base = Path(os.environ.get('REPO_ROOT', '.')).resolve()
        roots = [r.strip() for r in
                 os.environ.get('SPEC_ROOTS', 'specs/platform,specs/foundry,.specs-0.3').split(',') if r.strip()]
        v = R.parse_vif(Path(vif))
        idx = R.build_index(roots, base)
        needed, _ = R.decide(v)
        es, ct = [], []
        for n in needed:
            hits = idx.get(n['id']) or []
            if not hits:
                continue
            if n['id'].startswith('ES-'):
                es.append(R.parse_es(hits[0]))
            elif n['id'].startswith('CT-'):
                ct.append(R.parse_ct(hits[0]))
        if not es or any(e['from_prose'] for e in es):
            return 0, ''
        g = R.build_guards(v, es, ct)
        n = sum(1 for x in g['guards'] if x['reachable_hint'])
        return n, ', '.join(e['spec_id'] for e in es)
    except Exception:
        return 0, ''



def parse_test_cases(path: str) -> tuple[list[dict], dict]:
    """Parse test case YAML file into list of dicts + metadata."""
    if not _HAS_YAML:
        print('❌ pyyaml not installed. Run: pip install pyyaml')
        return [], {}
    with open(path, 'r', encoding='utf-8') as f:
        data = _yaml.safe_load(f)
    tcs = []
    for tc in (data or {}).get('test_cases', []):
        tcs.append({
            'id': tc.get('id', 'TC-?'),
            'title': tc.get('title', ''),
            'flow': tc.get('flow', ''),
            'priority': tc.get('priority', 'Medium'),
            'type': tc.get('type', ''),
            'spec_ref': tc.get('spec_ref', ''),
            'expected': tc.get('expected_result', ''),
            'steps': [s.get('action', '') for s in (tc.get('test_steps') or [])],
            'step_expectations': [s.get('expected_result', '') for s in (tc.get('test_steps') or [])],
            # Defect #14 (2026-09-11): `assert` was NOT on this whitelist, so the
            # structured oracle — the ONLY thing Step 6 compiles into an expect() since
            # the 2c-assert contract — was dropped before any dimension could see it.
            # Every scorer here was therefore judging the PROSE and ignoring the
            # compiled assertion, which penalises exactly the suites that did what the
            # skill mandates. Carried as both the per-step lists and a flat list.
            'step_assertions': [list(s.get('assert') or []) for s in (tc.get('test_steps') or [])],
            'assertions': list(tc.get('assertions') or []),
            'spec_only': tc.get('spec_only', False),
            'test_data': tc.get('test_data', {}),
            'preconditions': tc.get('preconditions', []),
            'category': tc.get('category', '') or '',
            'mock_routes': tc.get('mock_routes') or [],
            'layout_stress': tc.get('layout_stress') or {},
            'validation_lifecycle': tc.get('validation_lifecycle') or {},
        })
    feature = (data or {}).get('feature', '')
    module = (data or {}).get('module', '')
    return tcs, {'feature': feature, 'module': module}


# ── Widget-coverage ledger (Step 4.5 gate #1) ─────────────────────────────────
# Enumerate the page's INTERACTIVE widgets from element-map.json and check the suite
# carries render-invariant coverage for them. Motivation: spec ACs describe business
# behaviour, never UI-render correctness (a Select trigger showing the raw enum index
# "0" instead of "Inbound Voice"; a column-visibility popover mounting detached/empty).
# Those defects live BELOW the spec, so a purely spec-driven suite is structurally blind
# to them — exactly how both manual bugs on the Conversation Lifecycle run were 0/64
# covered. This ledger makes that blindness a FAIL, not luck.

def load_element_map(path: str) -> dict:
    if not path:
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


# data-slot values our Base UI / shadcn wrappers stamp on a popover/select/menu trigger
# (the trigger renders as a plain <button>, NOT a native <select>). Keyed by data-slot →
# widget kind. aria-haspopup / role are fallbacks when data-slot is absent.
_TRIGGER_SLOTS = {
    'select-trigger': 'select',
    'dropdown-menu-trigger': 'menu',
    'popover-trigger': 'popover',
    'combobox': 'combobox',
}
_TRIGGER_ROLES = {'combobox', 'listbox', 'menu', 'tab', 'switch'}
# Generic control words that are NOT a distinctive coverage token on their own — a TC
# mentioning "View Full Transcript" must not count as covering a "View" column toggle.
_GENERIC_WIDGET_TOKENS = {
    'view', 'open', 'close', 'save', 'cancel', 'submit', 'edit', 'delete', 'more',
    'add', 'ok', 'yes', 'no', 'all', 'select', 'filter', 'search', 'menu', 'button',
    'options', 'actions', 'apply', 'reset', 'next', 'prev', 'previous', 'toggle',
}


def _widget_token(raw: str) -> str:
    """Lowercased, whitespace-collapsed distinctive substring for coverage matching."""
    return re.sub(r'\s+', ' ', (raw or '')).strip().lower()


def _is_distinctive(token: str) -> bool:
    return bool(token) and len(token) >= 3 and token not in _GENERIC_WIDGET_TOKENS


def extract_interactive_widgets(em: dict) -> list[dict]:
    """Interactive widgets whose RENDER can silently break: native + Base UI selects,
    dropdown-menu / popover / combobox triggers. Plain action buttons are excluded —
    they carry no render-invariant (label-vs-raw-value / anchored-overlay) obligation."""
    widgets: list[dict] = []
    for s in em.get('selects', []) or []:
        label = s.get('name') or s.get('id') or ((s.get('options') or [''])[0])
        token = _widget_token(s.get('id') or s.get('name') or label)
        widgets.append({'kind': 'select', 'label': label or 'select',
                        'token': token, 'distinctive': _is_distinctive(token)})
    for b in em.get('buttons', []) or []:
        slot = (b.get('data_slot') or '').lower()
        role = (b.get('role') or '').lower()
        haspopup = (b.get('aria_haspopup') or '').lower()
        kind = None
        for key, k in _TRIGGER_SLOTS.items():
            if key in slot:
                kind = k
                break
        if not kind and role in _TRIGGER_ROLES:
            kind = role
        if not kind and haspopup in ('menu', 'listbox', 'dialog', 'tree', 'grid'):
            kind = 'menu' if haspopup == 'menu' else 'popover'
        if not kind:
            continue  # plain action button — no render-invariant obligation
        label = (b.get('text') or b.get('aria_label') or b.get('id') or kind).strip()
        token = _widget_token(b.get('id') or b.get('aria_label') or b.get('text') or label)
        widgets.append({'kind': kind, 'label': label or kind,
                        'token': token, 'distinctive': _is_distinctive(token)})
    return widgets


_RENDER_INV_RE = re.compile(
    r'ui-render|render[ -]invariant|raw value|enum index|human-readable|readable label|'
    r'not (its |the )?raw|trigger (text|shows|renders)|anchored|detached|non-empty (overlay|popover)',
    re.I)


def _is_render_invariant_tc(tc: dict) -> bool:
    blob = ' '.join([str(tc.get('spec_ref', '')), str(tc.get('category', '')),
                     str(tc.get('title', '')), str(tc.get('expected', ''))])
    return bool(_RENDER_INV_RE.search(blob))


def widget_coverage(tcs: list[dict], widgets: list[dict]) -> tuple[list[dict], list[dict]]:
    """Return (render_invariant_tcs, uncovered_widgets)."""
    render_inv = [tc for tc in tcs if _is_render_invariant_tc(tc)]
    blob = ' '.join(
        ' '.join([str(tc.get('title', '')), str(tc.get('spec_ref', '')),
                  str(tc.get('expected', '')), ' '.join(tc.get('steps', []) or []),
                  ' '.join(tc.get('step_expectations', []) or [])])
        for tc in tcs
    ).lower()
    uncovered = [
        w for w in widgets
        if w['distinctive'] and not re.search(r'\b' + re.escape(w['token']) + r'\b', blob)
    ]
    return render_inv, uncovered


_NUMERIC_FIELD_NAME_RE = re.compile(
    r'(amount|count|weight|qty|quantity|price|cost|value|score|percent|percentage|'
    r'rate|ratio|number|order|index|version|age|days?|hours?|minutes?|seconds?|'
    r'width|height|size|length|total|sum|min|max|threshold|priority|level)',
    re.IGNORECASE,
)


def _derive_free_text_fields(spec: dict) -> list[str]:
    """Free-text fields whose value can overflow (length-like max >= 40, non-numeric
    name) + any field declared under layout_stress. Mirrors the identically-named
    helper in generate_test_cases.py — keep the two in sync. The gate uses this to
    BLOCK when a free-text field has no overflow TC."""
    fields: list[str] = []
    seen: set[str] = set()

    def _add(fname: str) -> None:
        fname = (fname or '').strip()
        if fname and fname.lower() not in seen:
            fields.append(fname)
            seen.add(fname.lower())

    bc = spec.get('boundary_constraints') or {}
    if isinstance(bc, dict):
        for fname, cons in bc.items():
            if not isinstance(cons, dict):
                continue
            mx = cons.get('max')
            if isinstance(mx, bool) or not isinstance(mx, (int, float)):
                continue
            if mx >= 40 and not _NUMERIC_FIELD_NAME_RE.search(str(fname)):
                _add(str(fname))
    ls = spec.get('layout_stress') or {}
    if isinstance(ls, dict):
        for sf in (ls.get('stress_fields') or []):
            if isinstance(sf, dict):
                _add(sf.get('field', ''))
    return fields


def _extract_openable_data_surfaces(content: str) -> list[dict]:
    """From spec.api_contracts, return the GET data surfaces a user OPENS (expander/tab/
    drawer) that fire their own fetch — the ones generate_test_cases must cover with a
    load-success + load-error TC. Excludes mutations and supporting background fetches
    (dropdown-populating calls) using the same signals as the generator: a discrete open
    verb in the trigger, or a nested sub-resource path (…/{id}/x). Each surface carries a
    distinctive `token` (a clean control-label word or the sub-resource segment) used to
    check whether any TC references it. Endpoint-agnostic by construction."""
    if not _HAS_YAML:
        return []
    try:
        y = _yaml.safe_load(content)
    except Exception:
        return []
    if not isinstance(y, dict):
        return []
    surfaces: list[dict] = []
    for c in (y.get('api_contracts') or []):
        if not isinstance(c, dict):
            continue
        if str(c.get('method', '') or '').upper() in {'POST', 'PUT', 'PATCH', 'DELETE'}:
            continue
        if not (c.get('success') or c.get('error') or c.get('trigger')):
            continue
        ep = str(c.get('endpoint') or c.get('pattern') or '')
        trig = str(c.get('trigger') or '')
        nested = bool(re.search(r'/(?:\{[^}]+\}|\*|:[A-Za-z_]+)/[A-Za-z]', ep))
        discrete = bool(re.search(r'\b(?:expand|open|click|reveal|view|show|toggle|tab)\b',
                                  trig, re.I))
        if not (nested or discrete):
            continue
        # Distinctive token: last non-param path segment (…/revisions → "revisions"),
        # else the first meaningful word of the derived control label.
        segs = [s for s in re.sub(r'\?.*$', '', ep).split('/')
                if s and not re.fullmatch(r'\{[^}]+\}|\*+|:[A-Za-z_]+', s) and s != 'api']
        token = segs[-1] if segs else ''
        if not token:
            m = re.search(r'\b(?:expand|open|reveal|view|show|toggle)\s+([A-Za-z][A-Za-z ]{1,30})',
                          trig, re.I)
            token = (m.group(1).split()[0] if m else '').strip()
        # Per-surface state oracles (mirror generate_test_cases.py):
        #   empty_copy — spec'd Empty-state text ('No … yet.'), from an explicit `empty:`
        #                field or a quoted no-data string in `success` prose.
        #   has_error  — the surface declares an error state (a quoted string in `error`).
        # These drive the state-coverage gate: a surface with an Empty state must be
        # tested for Empty≠Error (#145660), and one with an Error state for control
        # overflow in that state (#145661).
        empty_copy = ''
        ex = c.get('empty')
        if isinstance(ex, str) and ex.strip():
            empty_copy = ex.strip().strip('\'"').rstrip('.')
        else:
            for q in re.findall(r"['\"]([^'\"]+)['\"]", str(c.get('success') or '')):
                if re.match(r'\s*(?:no |empty|none)', q, re.I):
                    empty_copy = q.strip().rstrip('.')
                    break
        has_error = bool(re.search(r"['\"][^'\"]+['\"]", str(c.get('error') or '')))
        if token:
            surfaces.append({'endpoint': ep, 'token': token.lower(),
                             'empty_copy': empty_copy, 'has_error': has_error})
    return surfaces


_REQUIRED_RULE_RE = re.compile(
    r'required|bắt\s*buộc|mandatory|cannot be (empty|blank)|must be (provided|selected|set|filled)|'
    r'không được trống', re.I)


def _derive_required_fields(spec_yaml: dict) -> list[str]:
    """Field names carrying a required rule in spec.validations. Mirrors
    `_lifecycle_fields` in generate_test_cases.py — keep the two in sync."""
    out: list[str] = []
    seen: set[str] = set()
    for v in (spec_yaml.get('validations') or []):
        if not isinstance(v, dict):
            continue
        blob = f"{v.get('constraint', '')} {v.get('description', '')}"
        if not _REQUIRED_RULE_RE.search(blob):
            continue
        fname = str(v.get('field') or '').strip()
        if fname and fname.lower() not in seen:
            seen.add(fname.lower())
            out.append(fname)
    return out


def parse_spec_details(spec_path: str) -> dict:
    """Parse spec file for rules, fields, boundaries, error messages."""
    with open(spec_path, 'r', encoding='utf-8') as f:
        content = f.read()

    uf_ids = sorted(set(re.findall(r'UF-\d+', content)))
    val_ids = sorted(set(re.findall(r'VAL-\d+', content)))
    br_ids = sorted(set(re.findall(r'BR-\d+', content)))
    srv_ids = sorted(set(re.findall(r'SRV-\d+', content)))
    roles = sorted(set(re.findall(r'\b(admin|manager|editor|viewer|operator|user|staff|owner|account-manager)\b',
                                   content, re.IGNORECASE)))

    # Extract VAL rule details (ID → condition + error message)
    val_details = {}
    val_table_pattern = r'\|\s*(VAL-\d+)\s*\|\s*`?(\w+)`?\s*\|\s*(.+?)\s*\|\s*"(.+?)"\s*\|'
    for m in re.finditer(val_table_pattern, content):
        val_details[m.group(1)] = {
            'field': m.group(2),
            'condition': m.group(3).strip(),
            'error_message': m.group(4).strip(),
        }

    # Extract SRV rule details
    srv_details = {}
    srv_pattern = r'\|\s*(SRV-\d+)\s*\|\s*(.+?)\s*\|\s*`?(\d{3}[^`]*)`?\s*\|\s*(.+?)\s*\|'
    for m in re.finditer(srv_pattern, content):
        srv_details[m.group(1)] = {
            'condition': m.group(2).strip(),
            'http_status': m.group(3).strip(),
            'ui_behavior': m.group(4).strip(),
        }

    # Extract field boundaries from spec
    fields = {}
    # Pattern: key: fieldName ... min_length: N ... max_length: M
    field_blocks = re.split(r'(?=- key:\s+\w+)', content)
    for block in field_blocks:
        key_m = re.search(r'- key:\s+(\w+)', block)
        if not key_m:
            continue
        key = key_m.group(1)
        min_m = re.search(r'min_length:\s*(\d+)', block)
        max_m = re.search(r'max_length:\s*(\d+)', block)
        type_m = re.search(r'type:\s*(\w+)', block)
        pattern_m = re.search(r'pattern:\s*"(.+?)"', block)
        required = False
        # Check required list
        req_match = re.search(r'required:\s*\[([^\]]+)\]', content)
        if req_match:
            required = key in req_match.group(1)
        fields[key] = {
            'min': int(min_m.group(1)) if min_m else None,
            'max': int(max_m.group(1)) if max_m else None,
            'type': type_m.group(1) if type_m else 'string',
            'pattern': pattern_m.group(1) if pattern_m else None,
            'required': required,
        }

    # Extract submission flows
    has_happy_path = 'Happy Path' in content or 'happy path' in content.lower()
    has_cancel_path = 'Cancel' in content

    er_ids = sorted(set(re.findall(r'ER-\d+', content)))
    # Openable secondary data surfaces (expander / tab / drawer with their OWN endpoint) —
    # each must have a load-success + load-error TC. GENERAL, not one feature: a data
    # surface a user opens that fires its own fetch and is left untested is how a broken
    # panel ships green (Bug #145535: Version History 400'd yet 38/38 passed). Mirrors the
    # openable-surface criterion in generate_test_cases.build_exception_test_cases.
    data_surfaces = _extract_openable_data_surfaces(content)
    # Enforcement guards — domain invariants / domain-method Pre: clauses the spec
    # declares (id: ENF-xxx under enforcement_guards:). Each must have >=1 negative TC.
    # Guard sources on grammar 0.4: ES `## Invariants` (one row = one guard) and
    # `## Behaviors` (one `throw` in the `Steps:` DSL = one guard). The 0.3 alias for
    # `## Behaviors` is `## Domain Methods` — extracting only the old name on a 0.4 ES
    # yields zero guards, so this gate would then pass on nothing at all.
    # Read the ids STRUCTURALLY — a bare regex over the file text also harvests ids
    # written in a COMMENT, and the one legitimate reason to name an id in a comment is
    # to say why it was pruned. That turned a documented prune into 7 phantom
    # "Missing ENFORCEMENT coverage" lines: the gate demanded TCs for the very guards
    # the comment explained the suite deliberately does not drive. Structural read
    # first, regex only when the yaml will not parse.
    enf_ids: list[str] = []
    try:
        _sy = _yaml.safe_load(content)
        if isinstance(_sy, dict):
            enf_ids = sorted({
                str(g.get('id')) for g in (_sy.get('enforcement_guards') or [])
                if isinstance(g, dict) and g.get('id')
                and not (g.get('reachable') is False or g.get('untestable'))
            })
        else:
            raise ValueError('spec yaml is not a mapping')
    except Exception:
        enf_ids = sorted(set(re.findall(r'ENF-[A-Za-z0-9_-]+', content)))
    exc_kinds_expected = classify_exception_kinds(content)
    # Read-only page: no form validations AND no editable fields. For such pages the
    # boundary/format dimension is N/A — what matters is exception-state coverage.
    is_readonly = (len(val_ids) == 0 and len(fields) == 0)

    # Free-text fields (overflow risk). Prefer a structured YAML load; fall back to
    # the regex-parsed `fields` (max_length >= 40, non-numeric name).
    free_text_fields: list[str] = []
    if _HAS_YAML:
        try:
            _y = _yaml.safe_load(content)
            if isinstance(_y, dict):
                free_text_fields = _derive_free_text_fields(_y)
        except Exception:
            free_text_fields = []
    if not free_text_fields:
        free_text_fields = [
            k for k, f in fields.items()
            if isinstance(f.get('max'), int) and f['max'] >= 40
            and not _NUMERIC_FIELD_NAME_RE.search(k)
        ]

    # Required fields (validation-lifecycle gate). Every field the spec declares
    # mandatory must have a lifecycle TC proving its message DISAPPEARS once fixed —
    # the direction no spec line mandates and the suite therefore never checked
    # (stale "Rationale is required" on Decision Recording).
    required_fields: list[str] = []
    if _HAS_YAML:
        try:
            _y2 = _yaml.safe_load(content)
            if isinstance(_y2, dict):
                required_fields = _derive_required_fields(_y2)
        except Exception:
            required_fields = []
    if not required_fields:
        required_fields = [k for k, f in fields.items() if f.get('required')]

    # UI behaviours (id: UI-xxx under `ui_behaviors:`) — conditional visibility,
    # empty states, disabled-until-valid. Read from the parsed yaml, never a regex
    # over the whole text: "UI-" occurs in prose and would manufacture ids.
    _parsed_yaml = _parse_spec_yaml(content)
    ui_ids = sorted({
        str(r.get('id')) for r in (_parsed_yaml.get('ui_behaviors') or [])
        if isinstance(r, dict) and str(r.get('id', '')).startswith('UI-')
    })

    return {
        'uf': uf_ids,
        'val': val_ids,
        'required_fields': required_fields,
        'br': br_ids,
        'srv': srv_ids,
        'er': er_ids,
        'ui': ui_ids,
        'enf': enf_ids,
        'data_surfaces': data_surfaces,
        'exc_kinds_expected': exc_kinds_expected,
        'free_text_fields': free_text_fields,
        'is_readonly': is_readonly,
        'roles': roles,
        'val_details': val_details,
        'srv_details': srv_details,
        'fields': fields,
        'has_happy_path': has_happy_path,
        'has_cancel_path': has_cancel_path,
        'raw': content,
        # The parsed yaml, for the blocks dimension 8 reads structurally. The
        # regex-over-text approach the older dimensions use cannot tell an empty
        # list from a missing key, and that distinction IS the under-declared check.
        'parsed': _parsed_yaml,
    }


def _parse_spec_yaml(content: str) -> dict:
    try:
        d = _yaml.safe_load(content)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


# Exception-state vocabulary shared by spec scan + TC classification (Fix D).
_EXC_PATTERNS = {
    'not_found':    [r'\b404\b', r'not[\s-]?found', r'unknown id', r'empty state', r'\bempty\b'],
    'forbidden':    [r'\b403\b', r'forbidden', r'access denied', r'scope mismatch', r'permission'],
    'server_error': [r'\b5\d\d\b', r'5xx', r'server error', r'network (?:error|failure)', r'\berror state\b'],
    'loading':      [r'loading', r'skeleton'],
    'auth':         [r'\b401\b', r'unauthor', r'session expired', r'sign[\s-]?in', r'signin', r'redirect.*login'],
}


def classify_exception_kinds(text: str) -> set:
    """Return the set of exception/unhappy state kinds implied by a blob of text."""
    t = (text or '').lower()
    found = set()
    for kind, pats in _EXC_PATTERNS.items():
        if any(re.search(p, t) for p in pats):
            found.add(kind)
    return found


# ── Scoring ───────────────────────────────────────────────────────────────────

# ── Dimension 8 — VIF section coverage ───────────────────────────────────────
# The other seven dimensions grade the TCs the suite HAS. This one grades the
# suite against the VIF's own section contract, which is a different question:
# whether every section the grammar declares reached the yaml at all.
#
# Why a whole dimension. The VIF grammar fixes 11 core sections for every VIF and
# 5 more for a task-screen (33 of 61 VIFs in this corpus). Only 6 of them were
# ever read, and the failure was silent in both directions: a section not carried
# into the yaml produced no finding, because a gate can only ask about what it was
# handed. The proof sat in a live suite — its VIF declared six §Accessibility
# bullets, `a11y_requirements` was absent, the run emitted 0 a11y TCs and nothing
# said so.
#
# The mechanism is the one `enf_underdeclared` already uses for domain guards:
# `resolve_specs.py --emit-vif-block` writes `vif_sections_declared:` with the
# counts read off the VIF, so an empty modelled block is UNDER-DECLARED (loud)
# rather than absent (invisible). No declared block on a grammar-0.4 run means the
# yaml predates the contract and cannot be checked — which is itself the finding.

# modelled-block key -> (declared-count key, the category a covering TC must carry,
#                        the row field whose value identifies one row)
_SECTION_SPECS = [
    ('vif_acceptance_criteria', 'acceptance_criteria', '', 'id'),
    ('a11y_requirements', 'a11y_clauses', 'a11y', ''),
    ('state_defaults', 'state_management', 'state-default', 'state_name'),
    ('responsive_rules', 'responsive', 'responsive', 'breakpoint'),
    ('error_precedence', 'error_precedence', 'error-precedence', 'id'),
    ('component_tree', 'component_tree', '', ''),   # copy handled specially, see below
    ('entry_points', 'entry_points', '', ''),
]
# task_screen.screens[*] blocks, same shape
_TS_SPECS = [
    ('columns', 'columns', 'queue-column', 'column'),
    ('query_params', 'query_params', 'boot-request', 'param'),
    ('fields_not_displayed', 'fields_not_displayed', 'negative-render', 'field'),
    ('support_panels', 'support_panels', 'support-panel', 'panel_role'),
    ('form_fields', 'form_fields', '', ''),
    ('actions', 'actions', '', ''),
]


# Kept in sync with resolve_specs.py `_NO_STATE_RE` / `_COPY_RE` by intent: both
# read the same cells, and a divergence would make the declared count and the gate
# disagree about what is even an oracle.
_NO_STATE_GATE = re.compile(r'^\s*(—|-|n/?a\b|none\b|hidden\b|not applicable|by design)', re.I)
_COPY_GATE = re.compile(r'"([^"]{6,})"')

# Loading copy is not empty copy. A few VIFs put "Loading item…" / "Skeleton fields
# while fetching" in the Empty State column — a different screen state, and asserting
# it appears when the endpoint returns no rows would FAIL a conformant screen. It is a
# spec-column mistake worth reporting, never a TC to fabricate.
_LOADING_GATE = re.compile(r'^\s*(loading|fetching|skeleton|please wait)\b|^\s*…\s*$', re.I)


def _tc_blob(tc: dict) -> str:
    return ' '.join([str(tc.get('spec_ref', '')), str(tc.get('title', '')),
                     str(tc.get('expected', '')), *[str(s) for s in tc.get('steps', [])]])


def _row_key(row, field: str) -> str:
    if isinstance(row, str):
        return row
    if not isinstance(row, dict):
        return ''
    v = row.get(field) or ''
    # Rows come from VIF cells, so a key arrives dressed: `` `disposition` ``,
    # `RawText (truncated, max 120 chars)`. Strip to the bare token that a TC
    # would actually name.
    v = re.sub(r'\(.*?\)', '', str(v)).strip().strip('*`" ')
    return v.split('—')[0].strip()


def _covered_by_tc(key: str, category: str, tcs: list[dict]) -> bool:
    """A row is covered when some TC names it. The category is required where one
    exists, so a coincidental mention of the word elsewhere in the suite does not
    count as coverage — matching on the word alone is how a section 'passes'
    without a single assertion about it."""
    if not key:
        return True
    pat = re.compile(r'(?<![A-Za-z0-9])' + re.escape(key) + r'(?![A-Za-z0-9])', re.I)
    for tc in tcs:
        if category and str(tc.get('category', '')).lower() != category:
            continue
        if pat.search(_tc_blob(tc)):
            return True
    return False


def score_section_coverage(tcs: list[dict], parsed: dict) -> tuple[int, dict]:
    """(score 1-5, findings). Findings are lists of human-readable strings; each
    names the row that has no coverage, never just a count."""
    f: dict[str, list] = {'undeclared': [], 'uncovered': [], 'notes': []}
    declared = (parsed.get('vif_sections_declared') or {}) if isinstance(parsed, dict) else {}
    grammar = str(parsed.get('vif_grammar', '') or '')

    if not declared:
        f['notes'].append(
            'no `vif_sections_declared:` block — this spec-yaml predates the VIF section '
            'contract, so section coverage CANNOT be verified. Re-run '
            '`resolve_specs.py --emit-vif-block` and merge it. On grammar 0.3 this is a '
            'recorded limitation; on 0.4 it is a blocker.')
        return (2 if grammar.startswith('0.3') else 1), f

    subtype = str(declared.get('subtype', 'generic'))
    checks = list(_SECTION_SPECS)
    ts = parsed.get('task_screen') or {}
    screens = (ts.get('screens') or []) if isinstance(ts, dict) else []

    has_boot = any(str(t.get('category', '')).lower() == 'boot-request' for t in tcs)

    def _check(block, dkey: str, category: str, field: str, label: str) -> None:
        n = int(declared.get(dkey) or 0)
        rows = block if isinstance(block, list) else []
        if n and not rows:
            f['undeclared'].append(
                f'{label}: the VIF declares {n} row(s), the yaml models NONE — nothing '
                f'downstream can ask for coverage the yaml never carried')
            return
        if not field:
            return
        for row in rows:
            key = _row_key(row, field)
            if not key:
                continue
            if isinstance(row, dict) and (row.get('untestable') or row.get('observable') == 'none'
                                          or str(row.get('required', '')).lower() == 'no'):
                continue          # explicitly excused, with a reason on the row
            # `observable: request` DELEGATES the row to the boot-request TC, which is
            # the stronger oracle for it — the request is what the server received,
            # whereas the control only shows what the client decided to display. The
            # delegation is only honoured when that TC actually exists; otherwise the
            # row would be excused into a hole, which is the failure mode this whole
            # dimension exists to prevent.
            if isinstance(row, dict) and row.get('observable') == 'request':
                if has_boot:
                    continue
                f['uncovered'].append(
                    f'{label} "{key}" — marked `observable: request`, which delegates it to '
                    f'the boot-request TC, but this suite has none. Either the '
                    f'§Task Screens Query Parameters block is missing or the param it maps '
                    f'to was never declared')
                continue
            if not _covered_by_tc(key, category, tcs):
                f['uncovered'].append(f'{label} "{key}" — no{" " + category if category else ""} TC names it')

    for mkey, dkey, cat, field in checks:
        _check(parsed.get(mkey), dkey, cat, field, f'§{mkey}')

    # §Component Tree — the oracle is the QUOTED empty copy, not a cell value, and one
    # cell can carry several strings (an empty message plus its call-to-action button).
    # Matching is on a distinctive prefix of the copy rather than the whole string:
    # a TC legitimately asserts a substring, and requiring the full sentence would
    # report a covered row as uncovered.
    declared_copy = int(declared.get('component_empty_copy') or 0)
    ct_rows = parsed.get('component_tree') or []
    found_copy = []
    for r in ct_rows:
        if not isinstance(r, dict):
            continue
        cell = str(r.get('empty_state') or '').strip()
        if not cell or _NO_STATE_GATE.match(cell):
            continue
        for c in _COPY_GATE.findall(cell):
            if _LOADING_GATE.match(c.strip()):
                continue
            found_copy.append((_row_key(r, 'component_id') or '?', c.strip()))
    if declared_copy and not found_copy:
        f['undeclared'].append(
            f'§component_tree: the VIF declares {declared_copy} quoted empty-state '
            f'string(s) and the yaml carries none — §Component Tree is the ONLY authority '
            f'for on-screen empty copy, so nothing else can supply it')
    for comp, copy in found_copy:
        probe = copy[:28]
        if not any(probe.lower() in _tc_blob(t).lower() for t in tcs):
            f['uncovered'].append(
                f'§component_tree "{comp}" empty copy "{copy[:44]}" — no TC asserts this '
                f'string. A calm-but-WRONG empty message passes every other TC')

    # §Task Journey route — a second route the VIF declares, which no other TC visits.
    tj = (ts.get('task_journey') or {}) if isinstance(ts, dict) else {}
    troute = str(tj.get('route') or '').strip().strip('`" ')
    if troute.startswith('/'):
        if not any(str(t.get('category', '')).lower() == 'task-route' for t in tcs):
            f['uncovered'].append(
                f'§task_journey route "{troute}" — no task-route TC. The landing page '
                f'passing is not evidence for it: they are different routes, and every '
                f'other TC only ever visits the landing page')

    # §Data Mapping cross-check. Costs nothing and catches a whole missed screen: a
    # screen id traced here with no entry under `screens:` means the task-screen pass
    # skipped it, and every column / param / panel it declares went with it.
    dm = (ts.get('data_mapping') or []) if isinstance(ts, dict) else []

    def _norm(x: str) -> str:
        return re.sub(r'[^a-z0-9]', '', str(x or '').lower())

    modelled = {_norm(sc.get('screen_id')) for sc in screens}
    # A §Data Mapping id can legitimately name a surface NESTED in a modelled screen
    # rather than a screen of its own — `create-item-sheet` is a Sheet whose form fields
    # live under the list screen's own subsection, and its block label carries the name.
    # Checking the labels too is what keeps this from reporting a correctly modelled
    # sheet as a missing screen.
    labels = {_norm(lbl) for sc in screens for k, v in sc.items()
              if k.startswith('block_labels_') and isinstance(v, list) for lbl in v}
    for row in dm:
        if not isinstance(row, dict):
            continue
        sid = str(row.get('screen_id') or '').strip().strip('`" ')
        n = _norm(sid)
        if not n or n in modelled or any(n in lbl or lbl in n for lbl in labels if lbl):
            continue
        f['notes'].append(
            f'§Data Mapping traces screen "{sid}" which appears in neither '
            f'§Screen Blueprints nor any task-screen block label. Either a screen was '
            f'skipped by the task-screen pass — taking its columns, query params, '
            f'not-displayed fields and support panels with it — or the VIF invented an id '
            f'§Screen Blueprints never declared, which is a spec inconsistency (PnC). '
            f'Check which before acting; the two have different owners')

    if subtype == 'task-screen':
        if int(declared.get('task_screens') or 0) and not screens:
            f['undeclared'].append(
                'task_screen.screens: the VIF is a task-screen with '
                f'{declared["task_screens"]} screen(s) and the yaml models NONE — its '
                'queue columns, outbound query-param defaults, not-displayed fields and '
                'support panels are all unfalsifiable')
        else:
            for mkey, dkey, cat, field in _TS_SPECS:
                merged = [r for sc in screens for r in (sc.get(mkey) or [])]
                _check(merged, dkey, cat, field, f'task_screen.{mkey}')
        fixtures = (ts.get('fixtures') or []) if isinstance(ts, dict) else []
        if int(declared.get('fixtures') or 0) and not fixtures:
            f['undeclared'].append(
                f'§Verification Fixtures declares {declared["fixtures"]} fixture(s), none '
                f'modelled — an Entity Snapshot is a ready-made `mutate:` payload whose '
                f'`Verifies` cell states the expected rendering, and it is the cheapest '
                f'access to a branch live data cannot produce (a null resolved name, an '
                f'already-stale item, an event-set failure flag)')
        else:
            # Entity Snapshots only. The other groups (Task Activation, Checklist, Info
            # Content, Ask AI, NBA) are scenario prose and panel content rather than
            # payloads — measured across the corpus, all 74 Entity Snapshots carry JSON
            # while the other ~320 fixtures carry none — so gating them would demand TCs
            # nothing can generate. Their count is reported at Step 2 instead.
            snaps = [x for x in fixtures if isinstance(x, dict)
                     and 'entity snapshot' in str(x.get('group', '')).lower()]
            for x in snaps:
                if str(x.get('use_as') or '').strip().lower() not in ('', 'mutate'):
                    continue          # routed elsewhere or opted out, with a value on the row
                fid = str(x.get('fixture_id') or '').strip()
                if not fid:
                    continue
                if not _covered_by_tc(fid, 'fixture-mutation', tcs):
                    f['uncovered'].append(
                        f'§verification_fixtures "{fid}" — Entity Snapshot with no '
                        f'fixture-mutation TC. Opt it out with `use_as: none` and a reason '
                        f'if it is preview-only; leaving it silent wastes an oracle that '
                        f'is already written')
    elif screens:
        f['undeclared'].append(
            f'task_screen is populated but the VIF subtype is {subtype} — a generic or '
            f'shell VIF must not carry task-screen sections (Gate G9). Check the VIF.')

    total = len(f['undeclared']) + len(f['uncovered'])
    if f['undeclared']:
        score = 1 if len(f['undeclared']) > 2 else 2
    elif not f['uncovered']:
        score = 5
    elif total <= 2:
        score = 4
    elif total <= 5:
        score = 3
    else:
        score = 2
    return score, f


# ── Inert-test detector ──────────────────────────────────────────────────────
# The seven original dimensions all ask whether a TC EXISTS for something. None of
# them asks whether the TC, once rendered, asserts anything at all. That gap is not
# theoretical: on the first end-to-end run of this gate against VIF-GOV-003, 42 of
# 100 generated tests reached the .spec.ts as an empty body holding one `// Step:`
# comment — every user-flow happy path among them — and the suite still scored
# dimension 1 (User Flow) 5/5 and dimension 7 (Clarity) 4/5. Those tests report PASS
# whatever the application does.
#
# The check imports generate_scripts' OWN translator rather than re-implementing a
# vocabulary of recognised step phrasings. A second implementation would drift from
# the first the moment either changed, and would then report a coverage number that
# no longer describes the file the run actually produces.

def _gen_scripts():
    """The generate_scripts module, imported lazily and only once.

    The renderer, not the step translator: many categories (enforcement, layout,
    boot-request, error-precedence) bypass `steps_to_code` for a dedicated renderer,
    so predicting from the translator alone both missed inert TCs and flagged sound
    ones. Calling the same function the generator calls makes the prediction exact by
    construction instead of approximately right.

    Returns None when the module cannot be loaded — the check then declines rather
    than failing the run, because an unavailable renderer is not evidence that the
    test cases are inert."""
    global _GEN_SCRIPTS
    try:
        return _GEN_SCRIPTS
    except NameError:
        pass
    _GEN_SCRIPTS = None
    try:
        import importlib.util
        _p = Path(__file__).with_name('generate_scripts.py')
        _sp = importlib.util.spec_from_file_location('_gs_for_gate', _p)
        _m = importlib.util.module_from_spec(_sp)
        _sp.loader.exec_module(_m)
        _GEN_SCRIPTS = _m
    except Exception:
        _GEN_SCRIPTS = None
    return _GEN_SCRIPTS


# A call to a shared `assert*` helper IS an assertion — the `expect()` lives inside
# the helper, not in the test body. Anchored on `await assert` + an upper-case initial
# so it matches the generator's helper calls and not a local variable named `asserted`.
_ASSERT_HELPER_CALL_RE = re.compile(r'\bawait\s+assert[A-Z]\w*\s*\(')


def find_inert_test_cases(testcases_path, spec_yaml: dict,
                          element_map: dict | None) -> list:
    """TC ids whose generated body would carry NO assertion at all.

    The seven original dimensions all ask whether a TC EXISTS for something; none
    asks whether the TC, once rendered, asserts anything. That gap is not
    theoretical: on the first end-to-end run of this gate against VIF-GOV-003, 55 of
    100 generated tests reached the .spec.ts with no `expect()` — every user-flow
    happy path among them, most as an empty body holding one `// Step:` comment —
    and the suite still scored dimension 1 (User Flow) 5/5 and dimension 7 4/5.
    Those tests report PASS whatever the application does.

    Two exclusions, both deliberate. A `spec_only` TC renders as `test.skip` and is a
    declared, visible gap rather than a false green. So is a TC the backend mode
    skips. Neither can mislead a reader of the report; an empty test that runs can.

    The test cases are re-read through generate_scripts' OWN parser rather than
    reused from this module's. Both parsers are whitelists, and this one drops the
    `section` / `step_deps` / `precondition` keys the dedicated renderers dispatch
    on — predicting from its output sent boot-request and responsive TCs down the
    prose fallback and reported two sound tests as inert.

    An `expect(` scan alone is NOT how "asserts something" is decided, because a
    whole class of generated test delegates its assertion to a shared helper and so
    holds no `expect(` of its own:

        await assertNoClippedScrollSurface(page, 'main, [role="main"]', 'TC-7:list');

    Every `assert*` helper the generator emits carries the `expect()` internally
    (9 in setup/bad-data-fixtures.ts, 4 in setup/validation-helpers.ts), so every
    layout-discovery and validation-lifecycle TC was reported inert while asserting
    correctly — the gate then exited 1 on a sound suite. Matching the call form
    rather than a hardcoded name list means a helper added later counts without
    having to be registered here too.
    """
    gs = _gen_scripts()
    if gs is None or not testcases_path:
        return []
    try:
        _parsed = gs.parse_test_cases(str(testcases_path))
        tcs = _parsed[0] if isinstance(_parsed, tuple) else _parsed
    except Exception:
        return []
    fn = gs.tc_to_test
    page_url = spec_yaml.get('page_url') or '/'
    mode = (spec_yaml.get('run_backend_mode') or 'mock').strip().lower()
    inert = []
    for tc in tcs:
        if tc.get('spec_only'):
            continue
        try:
            body = fn(tc, page_url, {}, False, 'feature',
                      False, element_map, None, mode)
        except Exception:
            continue          # a renderer crash is a different defect, not an inert TC
        if 'test.skip(' in body:
            continue
        if 'expect(' not in body and not _ASSERT_HELPER_CALL_RE.search(body):
            inert.append(tc['id'])
    return inert


def score_all(tcs: list[dict], spec: dict, element_map: dict | None = None,
              testcases_path=None) -> tuple[dict, dict]:
    """Return (scores, meta) where meta has specific data for gap reporting."""
    total = len(tcs)
    meta = {
        'val_ids': set(spec['val']),
        'val_covered': set(),
        'uf_ids': set(spec['uf']),
        'uf_covered': set(),
        'srv_ids': set(spec['srv']),
        'srv_covered': set(),
        'bad_tc_ids': [],
        'boundary_count': 0,
        'boundary_fields': {},
        'spec_ref_map': {},  # spec_ref → list of TC IDs
        'missing_error_msgs': [],
        'dirty_titles': [],
        'no_ref_tcs': [],
        'short_step_tcs': [],
        'no_spec_only_tcs': [],
        'vacuous_oracle': [],
        'filter_oracle_vacuous': [],
        'widget_inventory': [],
        'uncovered_widgets': [],
        'has_render_invariant_tc': None,
        'weak_oracle': [],
        'tuned_to_dev': [],
        'invented_field': [],
    }
    if total == 0:
        return {d: 1 for d in range(1, 9)}, meta

    # Build spec_ref → TC mapping
    for tc in tcs:
        for ref in re.findall(r'(?:UF|VAL|BR|SRV|UI|AUTH)-\S+', tc['spec_ref']):
            ref_clean = ref.rstrip(',;')
            meta['spec_ref_map'].setdefault(ref_clean, []).append(tc['id'])

    covered_spec = set(meta['spec_ref_map'].keys())

    # 1. User Flow Coverage
    uf_ids = set(spec['uf'])
    uf_covered = uf_ids & covered_spec if uf_ids else set()
    meta['uf_covered'] = uf_covered
    s1 = 5 if not uf_ids else max(1, round(5 * len(uf_covered) / len(uf_ids)))

    # 2. Validation / Error Coverage
    val_ids = set(spec['val'])
    val_covered = val_ids & covered_spec if val_ids else set()
    meta['val_covered'] = val_covered
    meta['srv_covered'] = set(spec['srv']) & covered_spec

    # Boundary analysis per field
    boundary_tcs = [tc for tc in tcs if 'boundary' in tc['title'].lower()]
    meta['boundary_count'] = len(boundary_tcs)
    for tc in boundary_tcs:
        title_lower = tc['title'].lower()
        for field_name in spec['fields']:
            if field_name.lower() in title_lower:
                meta['boundary_fields'].setdefault(field_name, {'min': False, 'below_min': False, 'max': False, 'exceed_max': False})
                if 'boundary min' in title_lower or 'exactly' in title_lower and 'min' in title_lower:
                    meta['boundary_fields'][field_name]['min'] = True
                if 'below-min' in title_lower or 'below min' in title_lower:
                    meta['boundary_fields'][field_name]['below_min'] = True
                if 'boundary max' in title_lower and 'max+1' not in title_lower:
                    meta['boundary_fields'][field_name]['max'] = True
                if 'max+1' in title_lower or 'exceed' in title_lower:
                    meta['boundary_fields'][field_name]['exceed_max'] = True

    has_boundary = len(boundary_tcs) >= 2
    has_exact_boundary = any(
        any(kw in tc['title'].lower() for kw in ('exactly', 'min=', 'max=', 'below-min', 'max+1', 'char(s)'))
        for tc in boundary_tcs
    )
    # Check error message quality
    validation_tcs = [tc for tc in tcs if tc['flow'] == 'validation']
    has_error_assert = any(
        any(kw in tc.get('expected', '').lower() for kw in ['error', 'validation', 'invalid', 'message', '—'])
        for tc in validation_tcs
    )
    has_exact_error_msg = any(
        ('"' in tc.get('expected', '') or '— expected message' in tc.get('expected', ''))
        for tc in validation_tcs
    )
    # Track which validation TCs are missing exact error messages
    for tc in validation_tcs:
        expected = tc.get('expected', '')
        if '"' not in expected and '— expected message' not in expected:
            meta['missing_error_msgs'].append(tc['id'])

    has_spec_only_flag = any(tc.get('spec_only') for tc in tcs)
    # Track validation TCs missing spec_only
    for tc in validation_tcs:
        if not tc.get('spec_only'):
            meta['no_spec_only_tcs'].append(tc['id'])

    # Exception / unhappy-path coverage (Fix D) — the dimension that actually
    # enforces edge-case bug-catching. Compare the exception kinds the spec implies
    # (error catalogue + screen states) against the kinds the TCs exercise.
    exc_expected = spec.get('exc_kinds_expected', set())
    exc_covered = set()
    for tc in tcs:
        is_exc_tc = (
            tc.get('flow') == 'error'
            or 'exception' in str(tc.get('category', '')).lower()
            or bool(re.search(r'ER-\d+', tc.get('spec_ref', '')))
            or bool(classify_exception_kinds(tc.get('title', '')))
        )
        if is_exc_tc:
            blob = ' '.join([tc.get('title', ''), tc.get('spec_ref', ''),
                             tc.get('expected', ''), ' '.join(tc.get('steps', []))])
            exc_covered |= classify_exception_kinds(blob)
    if exc_expected:
        exc_covered &= exc_expected
    missing_exc = (exc_expected - exc_covered) if exc_expected else set()
    meta['exc_expected'] = sorted(exc_expected)
    meta['exc_covered'] = sorted(exc_covered)
    meta['missing_exc'] = sorted(missing_exc)
    exc_ratio = (len(exc_covered) / len(exc_expected)) if exc_expected else None

    # Enforcement coverage — every domain invariant / domain-method guard the spec
    # declares (ENF-xxx) needs ≥1 NEGATIVE TC (category/flow 'enforcement', or a TC whose
    # spec_ref cites the guard id). This is the dimension whose absence let the server-side
    # `Activate(): StartDate ≥ now` precondition ship untested. Same shape as missing_exc.
    enf_expected = set(spec.get('enf', []) or [])
    # UNDER-DECLARATION is the failure this block exists to catch. Everything below
    # checks that each DECLARED guard has a TC — which passes happily on a yaml that
    # declared 2 of the 12 guards its ES actually states. On grammar 0.4 the guards
    # are a DSL, so the floor can be recomputed instead of trusted: re-extract from
    # the same specs and compare counts.
    enf_floor, enf_floor_src = _reachable_guard_floor(spec)
    if enf_floor and len(enf_expected) < enf_floor:
        meta['enf_underdeclared'] = (
            f'spec-yaml declares {len(enf_expected)} enforcement guard(s) but {enf_floor_src} '
            f'states {enf_floor} reachable through this screen — '
            f'{enf_floor - len(enf_expected)} guard(s) were dropped in transcription. '
            f'Re-run resolve_specs.py --emit-guards and merge.')
    enf_covered = set()
    has_enf_tc = False
    for tc in tcs:
        is_enf_tc = (
            tc.get('flow') == 'enforcement'
            or 'enforcement' in str(tc.get('category', '')).lower()
        )
        if is_enf_tc:
            has_enf_tc = True
        for gid in enf_expected:
            if gid.lower() in str(tc.get('spec_ref', '')).lower():
                enf_covered.add(gid)
    missing_enf = (enf_expected - enf_covered) if enf_expected else set()
    meta['enf_expected'] = sorted(enf_expected)
    meta['enf_covered'] = sorted(enf_covered)
    meta['missing_enf'] = sorted(missing_enf)
    meta['has_enf_tc'] = has_enf_tc
    enf_ratio = (len(enf_covered) / len(enf_expected)) if enf_expected else None

    # Error-catalogue coverage — one TC per declared ER id, NOT per exception KIND.
    # exc_kinds above collapses the whole catalogue into five buckets, so three
    # different 500s on three different endpoints all satisfy 'server_error' once.
    # Measured on actor-registry (2026-09-08): exception-KIND coverage scored 5/5
    # while ER-007 (409 duplicate on register), ER-008 (500 on Save Properties),
    # ER-009 (500 on Suspend) and ER-010 (500 on Classification) had zero TCs —
    # four unexercised error paths behind a full-marks dimension. Same shape as the
    # enforcement block: one declared id, one citing TC.
    er_expected = set(spec.get('er', []) or [])
    er_covered = {eid for eid in er_expected
                  for tc in tcs if eid.lower() in _tc_blob(tc).lower()}
    missing_er = (er_expected - er_covered) if er_expected else set()
    meta['er_expected'] = sorted(er_expected)
    meta['er_covered'] = sorted(er_covered)
    meta['missing_er'] = sorted(missing_er)
    er_ratio = (len(er_covered) / len(er_expected)) if er_expected else None

    # Overflow coverage — every free-text field (length-limited, displayed) needs at
    # least one layout-overflow TC (the always-on auto guard, or a layout_stress TC).
    # Its absence is exactly what let the Capture Inbox triage-screen overflow (Bug
    # #145274) ship uncaught. A displayed long no-space value must be proven to wrap /
    # truncate, never break layout.
    free_text_fields = spec.get('free_text_fields') or []
    has_overflow_tc = any(
        tc.get('flow') == 'layout-discovery'
        or 'overflow' in tc.get('title', '').lower()
        or 'auto-overflow' in str(tc.get('spec_ref', '')).lower()
        for tc in tcs
    )
    missing_overflow = bool(free_text_fields) and not has_overflow_tc
    meta['free_text_fields'] = free_text_fields
    meta['missing_overflow'] = missing_overflow

    if spec.get('is_readonly'):
        # Read-only page: boundary/format validations are N/A. Dimension 2 is driven
        # entirely by exception-state coverage (no false-block for "missing form
        # boundary TCs" on a page that has no form).
        s2 = 5 if exc_ratio is None else max(1, round(5 * exc_ratio))
        # A declared domain guard with no negative TC is a real bug-catching gap even on
        # a read-only page (e.g. an action exposed via a row menu) — dock a point.
        if enf_ratio is not None and enf_ratio < 1.0:
            s2 = max(1, s2 - 1)
        # NOT docked, deliberately. The finding is real and still prints, but until
        # generate_test_cases can emit a TC per declared error path, the Step 4.6
        # auto-improve loop has no move that raises this score — and a gate whose
        # findings cannot be acted on is a gate operators learn to ignore.
    else:
        val_coverage_ratio = len(val_covered) / max(len(val_ids), 1) if val_ids else 1.0
        s2_base = max(1, round(5 * val_coverage_ratio))
        penalty = 0
        if not has_boundary:
            penalty += 1
        if has_boundary and not has_exact_boundary:
            penalty += 1
        if not has_error_assert:
            penalty += 1
        if not has_spec_only_flag:
            penalty += 1
        # Missing unhappy-path coverage drags the score down so the auto-improve
        # loop (Step 4.6) regenerates with the now-available exception builder.
        if exc_ratio is not None and exc_ratio < 0.8:
            penalty += 1
        # Missing enforcement coverage (a declared invariant / behavior guard with no negative
        # TC) drags the score so the auto-improve loop regenerates with the guards covered.
        if enf_ratio is not None and enf_ratio < 1.0:
            penalty += 1
        # A dropped guard is worse than an uncovered one: an uncovered guard is at
        # least visible in the report, a dropped one reads as "nothing to test here".
        if meta.get('enf_underdeclared'):
            penalty += 2
        # NOT docked — see the read-only branch above for why. Restore the dock only
        # once the generator can cite one id per declared error path.
        s2 = max(1, s2_base - penalty)

    # A displayed free-text field with no overflow TC is a real bug-catching gap on
    # ANY page (form or read-only) — dock a point so the auto-improve loop regenerates
    # with the auto overflow guard present. Applied outside the readonly/else split.
    if missing_overflow:
        s2 = max(1, s2 - 1)

    # Presentation-invariant (clipped-scroll) coverage — ALWAYS-ON, spec-agnostic.
    # Every suite must carry the clip sweep: it renders the real data and asserts no
    # height-capped / overflow box hides content it cannot scroll to. Its absence is
    # exactly what let the Optimization Directives "Mutation Space" clipping (closing
    # brace cut off, dead scrollbar) ship green — a vertical-clipping class the
    # horizontal overflow guard structurally cannot see. Dock a point when missing so
    # the auto-improve loop regenerates with build_presentation_invariant_test_cases.
    has_clip_tc = any(
        'auto-clip' in str(tc.get('spec_ref', '')).lower()
        or (tc.get('layout_stress') or {}).get('surface') == 'clip'
        for tc in tcs
    )
    meta['missing_clip_sweep'] = not has_clip_tc
    if not has_clip_tc:
        s2 = max(1, s2 - 1)

    # Openable data-surface coverage — every expander/tab/drawer that fires its OWN fetch
    # must have a load TC that asserts it actually LOADS (not just a negative/read-only
    # check). A surface referenced by NO TC is an untested data surface: exactly how a
    # broken panel ships green (Bug #145535). HARD gate — force dim 2 < 3 so Step 4.5
    # blocks and the generator's secondary-surface pass must supply coverage. Endpoint-
    # agnostic: a surface is "covered" when its distinctive token appears in any TC.
    data_surfaces = spec.get('data_surfaces') or []
    tc_blob = ' '.join(
        ' '.join([str(tc.get('spec_ref', '')), str(tc.get('title', '')),
                  str(tc.get('expected', '')), ' '.join(tc.get('steps', []) or []),
                  str(tc.get('mock_routes', ''))])
        for tc in tcs
    ).lower()
    uncovered_surfaces = [
        s['endpoint'] for s in data_surfaces
        if s.get('token') and not re.search(r'\b' + re.escape(s['token']) + r'\b', tc_blob)
    ]
    meta['uncovered_data_surfaces'] = uncovered_surfaces
    if uncovered_surfaces:
        s2 = min(s2, 2)

    # Per-surface STATE coverage — the 2-state (load-ok / 5xx-error) model missed two
    # whole state branches, each a shipped bug:
    #   • a surface with a spec'd Empty state must assert Empty≠Error when it has no data
    #     (a 404/no-rows that renders the Error state instead is Bug #145660);
    #   • a surface with an Error state must assert its controls don't overflow the narrow
    #     container in that state (the Retry button clipped past the sheet is Bug #145661).
    # Endpoint-agnostic: bind a TC to a surface by its distinctive token. HARD gate.
    def _tc_refs_surface(tc: dict, token: str) -> bool:
        blob = ' '.join([str(tc.get('spec_ref', '')), str(tc.get('title', '')),
                         str(tc.get('mock_routes', '')), str(tc.get('layout_stress', ''))]).lower()
        return token in blob

    missing_empty_state, missing_state_fit = [], []
    for s in data_surfaces:
        tok = s.get('token', '')
        if not tok:
            continue
        if s.get('empty_copy'):
            has_empty_tc = any(
                ('empty' in str(tc.get('spec_ref', '')).lower()
                 or 'empty state' in str(tc.get('title', '')).lower())
                and _tc_refs_surface(tc, tok)
                for tc in tcs)
            if not has_empty_tc:
                missing_empty_state.append(s['endpoint'])
        if s.get('has_error'):
            has_fit_tc = any(
                (tc.get('layout_stress') or {}).get('surface') == 'state'
                and _tc_refs_surface(tc, tok)
                for tc in tcs)
            if not has_fit_tc:
                missing_state_fit.append(s['endpoint'])
    meta['missing_empty_state'] = missing_empty_state
    meta['missing_state_fit'] = missing_state_fit
    if missing_empty_state or missing_state_fit:
        s2 = min(s2, 2)

    # Validation-message LIFECYCLE coverage — the VAL tests only assert a message
    # APPEARS. Nothing asserted it DISAPPEARS once the field is fixed, so a form that
    # never re-validates kept a stale "X is required" on screen and the suite stayed
    # green (found by hand on Decision Recording). Spec sources are silent on this
    # direction by construction, so the gate — not the spec — has to demand it.
    # HARD gate, same shape as the data-surface one.
    lifecycle_tcs = [tc for tc in tcs
                     if str(tc.get('category', '')).lower() == 'validation-lifecycle'
                     or 'lifecycle' in str(tc.get('spec_ref', '')).lower()]
    lifecycle_kinds = {
        (tc.get('validation_lifecycle') or {}).get('kind', '')
        or ('pristine' if 'pristine' in tc.get('title', '').lower()
            else 'reset' if 'clear' in str(tc.get('spec_ref', '')).lower() and 'reset' in str(tc.get('spec_ref', '')).lower()
            else 'clear-on-valid')
        for tc in lifecycle_tcs
    }
    lifecycle_blob = ' '.join(
        ' '.join([str(tc.get('title', '')), str(tc.get('spec_ref', '')),
                  str(tc.get('validation_lifecycle', ''))])
        for tc in lifecycle_tcs
    ).lower()
    req_fields = spec.get('required_fields') or []
    missing_lifecycle_fields = [
        f for f in req_fields
        if not any(tok and tok in lifecycle_blob
                   for tok in [f.lower()] + re.findall(r'[A-Za-z][a-z]+', f))
    ]
    meta['required_fields'] = req_fields
    meta['has_lifecycle_tc'] = bool(lifecycle_tcs)
    meta['missing_lifecycle_fields'] = missing_lifecycle_fields
    meta['missing_lifecycle_pristine'] = bool(req_fields) and 'pristine' not in lifecycle_kinds
    if req_fields and (not lifecycle_tcs or missing_lifecycle_fields):
        s2 = min(s2, 2)
    elif meta['missing_lifecycle_pristine']:
        s2 = max(1, s2 - 1)

    # 3. Navigation Coverage
    nav_tcs = [tc for tc in tcs if tc['flow'] in ('navigation', 'nav') or 'navigation' in tc['title'].lower()]
    has_redirect = any('redirect' in tc.get('expected', '').lower() or 'navigate' in tc.get('expected', '').lower() for tc in tcs)
    has_cancel = any('cancel' in tc['title'].lower() or 'hủy' in tc['title'].lower() for tc in tcs)
    s3 = 5 if (nav_tcs and has_redirect and has_cancel) else \
         4 if (nav_tcs and (has_redirect or has_cancel)) else \
         3 if nav_tcs else \
         2 if has_redirect else 1

    # 4. State / Interaction Coverage
    modal_tcs = any('modal' in tc['title'].lower() for tc in tcs)
    dropdown_tcs = any('select' in tc['title'].lower() or 'dropdown' in tc['title'].lower() for tc in tcs)
    conditional_tcs = any('conditional' in tc['title'].lower() or 'visible' in tc.get('expected', '').lower() for tc in tcs)
    radio_tcs = any('radio' in tc['title'].lower() or 'status' in tc['title'].lower() for tc in tcs)
    s4 = sum([2, modal_tcs, dropdown_tcs, conditional_tcs]) + 1
    s4 = min(5, s4)

    # Widget-render coverage — HARD gate. Every interactive widget the page exposes
    # (Select / dropdown-menu / popover / combobox trigger) can silently render wrong
    # BELOW the spec: a Select trigger printing the raw enum index "0" instead of
    # "Inbound Voice", a column-visibility popover mounting detached/empty. A purely
    # spec-driven suite never asserts these, so both such bugs shipped 0/64 covered on
    # the Conversation Lifecycle run. Require ≥1 render-invariant TC when widgets exist,
    # and flag any widget referenced by NO TC. Skipped when no element-map is supplied.
    if element_map:
        widgets = extract_interactive_widgets(element_map)
        meta['widget_inventory'] = widgets
        if widgets:
            render_inv, uncovered = widget_coverage(tcs, widgets)
            meta['has_render_invariant_tc'] = bool(render_inv)
            meta['uncovered_widgets'] = uncovered
            # Zero render-invariant TCs while interactive widgets exist = the raw-value /
            # detached-popover class is structurally untestable (the Bug A + Bug B gap).
            if not render_inv:
                s4 = min(s4, 2)
            # A distinctive widget referenced by no TC at all is an untested widget.
            if uncovered:
                s4 = min(s4, 2)

    # UI-behaviour coverage — every `ui_behaviors:` row (id: UI-xxx) is a rendered
    # state the spec names but no other dimension asks for: submit disabled until
    # required fields are set, the unfiltered empty state, the FILTERED empty state.
    # None of them is a user flow, a validation or a widget, so all seven dimensions
    # above can be full marks while every one is untested — measured on both
    # actor-registry (0/3) and capture-inbox (1/3) on 2026-09-08. The filtered empty
    # state matters twice over: it is the oracle a filter TC needs to prove the
    # result set actually changed (Bug #148643).
    ui_expected = set(spec.get('ui', []) or [])
    ui_covered = {uid for uid in ui_expected
                  for tc in tcs if uid.lower() in _tc_blob(tc).lower()}
    meta['ui_expected'] = sorted(ui_expected)
    meta['missing_ui'] = sorted(ui_expected - ui_covered)
    # Reported, not docked — same reason as the error-path roster in dimension 2.

    # 5. Test Data Realism
    # `bar` and `baz` are only placeholders NEXT TO another placeholder token
    # (foo bar / bar baz / foobar). On their own they are ordinary English on this
    # platform — "action bar", "action-bar buttons", "toolbar", "sidebar" — and a
    # bare \bbar\b flagged two conformant TCs per suite as placeholder data.
    PLACEHOLDER_KEYWORDS = ['foo', 'test123', 'lorem']
    _placeholder_re = re.compile(
        r'\b(?:' + '|'.join(re.escape(k) for k in PLACEHOLDER_KEYWORDS) + r')\b'
        r'|\b(?:foo[\s_-]*bar|bar[\s_-]*baz)\b',
        re.IGNORECASE)
    bad_tc_ids = [
        tc['id'] for tc in tcs
        if _placeholder_re.search(' '.join(tc['steps']))
        or _placeholder_re.search(str(tc.get('test_data', {})))
    ]
    meta['bad_tc_ids'] = bad_tc_ids
    placeholder_count = len(bad_tc_ids)
    s5 = 5 if placeholder_count == 0 else \
         4 if placeholder_count <= 2 else \
         3 if placeholder_count <= 5 else 2

    # 6. Authorization Coverage
    auth_tcs = [tc for tc in tcs if tc['flow'] == 'auth' or 'auth' in tc['spec_ref'].lower()]
    has_unauth = any('unauth' in tc['title'].lower() or 'login' in tc.get('expected', '').lower() for tc in auth_tcs)
    has_role = any('role' in tc['title'].lower() for tc in auth_tcs)
    s6 = 5 if (has_unauth and has_role and len(auth_tcs) >= 2) else \
         4 if (has_unauth and has_role) else \
         3 if (has_unauth or has_role) else \
         2 if auth_tcs else 1

    # Oracle fidelity — a High-priority business/validation TC must assert a value
    # DERIVED FROM THE SPEC, not a vacuous "matches spec" and not an unresolved
    # grounding TODO. Asserting whatever the impl renders can never catch a
    # spec-vs-impl bug — the core "bám spec" requirement. Flagged TCs dock dim 7.
    # High-precision vacuous phrases: an expected that literally says "matches spec /
    # enforced correctly / behaves as expected / step completes as expected" asserts nothing
    # testable. Kept intentionally narrow — a concise real oracle ("badge turns green",
    # "created in Draft status") uses a bare enum/colour word and must NOT be flagged.
    _VACUOUS_RE = re.compile(
        r'matches spec|behaviou?r matches|behaves? as expected|enforced correctly|'
        r'enforced per spec|matches specification|works? correctly|'
        r'step completes as expected|observed state matches', re.I)
    _SPEC_VALUE_RE = re.compile(r'"[^"]{2,}"|\'[^\']{2,}\'|\d')  # a quoted literal or number = concrete
    _REF_ID_RE = re.compile(r'\b[A-Z]{2,}-[A-Za-z0-9-]+\b')      # BR-007 / VAL-003 — not a "value"
    _GROUNDING_TODO_RE = re.compile(r'TODO\((?:grounding|spec-oracle)\)', re.I)
    # Oracle-strength (Step 4.5 #2): a High TC whose EXPECTED is a vacuous placeholder is
    # flagged regardless of flow — a positive/read flow ("A new experiment … matches spec")
    # is just as hollow as a business one. This intentionally judges the TOP-LEVEL expected
    # only: the generator's step_expectations are always boilerplate ("Step completes as
    # expected"), so keying on them would false-flag every TC. Precision over recall.
    for tc in tcs:
        if tc.get('priority') != 'High':
            continue
        flow = str(tc.get('flow', '')).lower()
        typ = str(tc.get('type', '')).lower()
        is_business_val = flow in ('business', 'validation')
        is_positive_read = (typ == 'positive' or bool(re.match(r'^uf-\d+', flow))
                            or flow == 'main-flow')
        if not (is_business_val or is_positive_read):
            continue
        exp = tc.get('expected', '') or ''
        # strip ref ids first so the digits inside "BR-007" don't read as a concrete value
        has_concrete = bool(_SPEC_VALUE_RE.search(_REF_ID_RE.sub('', exp)))
        if _GROUNDING_TODO_RE.search(exp) or (_VACUOUS_RE.search(exp) and not has_concrete):
            meta['vacuous_oracle'].append(tc['id'])
            if is_positive_read and not is_business_val:
                meta['weak_oracle'].append(tc['id'])

    # Negative-only positive oracle — a POSITIVE / read flow whose expected promises the
    # content LOADS ("lists / shows / displays / appears / renders …") but whose steps
    # only assert an ABSENCE ("verify no / not / hidden … control") never proves the
    # content actually loaded: an errored panel satisfies every assertion and the test
    # passes green. GENERAL (any read/view flow, not one feature) — this is the TC-007
    # failure mode behind Bug #145535. Flag → dock dim 7 + surface for auto-improve.
    _POS_CLAIM_RE = re.compile(
        r'\b(?:list|lists|listed|show|shows|shown|display|displays|displayed|'
        r'render|renders|rendered|appear|appears|visible|loaded|populate[sd]?|'
        r'entries|content)\b', re.I)
    _POS_VERIFY_RE = re.compile(
        r'\b(?:verify|check|assert|see|confirm)\b.*\b(?:visible|shown|displayed|'
        r'present|listed|rendered|loaded|appears?)\b', re.I)
    _NEG_ONLY_RE = re.compile(r'\b(?:no|not|hidden|absent|without|zero|none)\b', re.I)
    # A TC whose TITLE/expected CLAIMS a successful load ("loads its data/content",
    # "shows its content") is a POSITIVE assertion no matter how its flow is tagged.
    _LOAD_CLAIM_RE = re.compile(
        r'\bloads?\b|\bloaded\b|(?:shows?|displays?|renders?)\s+its\s+(?:content|data)',
        re.I)
    _neg_only_positive: list = []
    for tc in tcs:
        flow = str(tc.get('flow', '')).lower()
        category = str(tc.get('category', '')).lower()
        exp = tc.get('expected', '') or ''
        makes_load_claim = bool(_LOAD_CLAIM_RE.search(f"{tc.get('title', '')} {exp}"))
        # Only genuine happy-path / read flows. Exception (flow 'error'/category
        # 'exception') and enforcement TCs are negative BY DESIGN — they SHOULD assert an
        # absence — so they must never be flagged. Keying on flow (not the unreliable
        # `type`, which the generator mislabels exception TCs as 'Positive') avoids that.
        # EXCEPTION: a TC that CLAIMS a successful load in its title/expected is a
        # mislabeled positive (e.g. a "View Full Transcript loads its data" TC tagged
        # flow=error that only asserts the error copy is hidden — TC-033). Keep judging it.
        is_positive_read = bool(re.match(r'^uf-\d+', flow)) or flow == 'main-flow'
        # a11y TCs are legitimately absence-shaped too ("Esc closes the dialog" =>
        # toBeHidden), and they are scoped to VIF §Accessibility clauses, so they must
        # not be flagged as mislabeled positives either.
        if category in ('exception', 'a11y') or flow in ('error', 'enforcement', 'a11y'):
            if not makes_load_claim:
                continue
        elif not is_positive_read:
            continue
        exp = tc.get('expected', '') or ''
        if not _POS_CLAIM_RE.search(exp):
            continue  # expected does not promise content presence → nothing to enforce
        steps = tc.get('steps', []) or []
        verify_steps = [s for s in steps
                        if re.search(r'\b(?:verify|check|assert|see|confirm)\b', s, re.I)]
        if not verify_steps:
            continue  # no explicit verify step to judge (page-load-only flows)
        has_positive_verify = any(_POS_VERIFY_RE.search(s) for s in verify_steps)
        all_negative = all(_NEG_ONLY_RE.search(s) for s in verify_steps)
        if all_negative and not has_positive_verify:
            _neg_only_positive.append(tc['id'])
            meta['vacuous_oracle'].append(tc['id'])
    meta['neg_only_positive'] = _neg_only_positive

    # Filter / search oracle — a TC that TYPES INTO or SELECTS a filter/search control must
    # prove the RESULT SET changed. Asserting that the section heading, column headers or
    # row-shape survived the keystroke (and that no error banner appeared) is satisfied by a
    # backend that IGNORES the parameter entirely — the whole point of the control. This is
    # the Bug #148643 failure mode: a filter TC typed a domain-area value and asserted
    # only 'Portfolio Learning' + 'Stated reason' visible + error hidden, so a filter that was
    # a complete no-op server-side reported GREEN through a full QC pass.
    #
    # A filter TC is DISCRIMINATING when it does at least one of:
    #   (a) asserts a row/result COUNT or the total label ("N of M", "3 rows", "totalCount"),
    #   (b) asserts a NON-MATCHING value yields the EMPTY state / zero rows / exclusion, or
    #   (c) asserts a named record is PRESENT and another named record is ABSENT.
    # (b) is the strongest and cheapest: it needs no seeded data, only a nonsense value.
    # An ACTION applied to a filter/search control. Both halves are required: the noun alone
    # matches page-load TCs ("loads with the filter bar rendered") and default-state reads
    # ("read the disposition filter control"), neither of which owes a result-set oracle.
    _FILTER_ACT_RE = re.compile(
        r'\b(?:fill|type|enter|search for)\b[^.]{0,60}?'
        r'\b(?:filter|search|query|keyword|domain area)\b'
        r'|\b(?:click|choose|select|apply|pick)\b[^.]{0,60}?\b(?:filter|search)\b',
        re.I)
    _FILTER_TITLE_RE = re.compile(r'\b(?:filter|search)\b', re.I)
    _FILTER_ACTION_VERB_RE = re.compile(r'\b(?:fill|type|enter|select|choose|click|apply|pick)\b', re.I)
    # Widget-inventory intent: the TC opens the control to enumerate its OPTIONS, never applies
    # one. Its oracle is the option list, not a result set.
    _OPTION_INVENTORY_RE = re.compile(
        r'\b(?:dropdown|listbox|select|menu)\b[^.]{0,30}\bopens?\b|\bopens? with\b[^.]{0,30}\boptions?\b'
        r'|\bexpected options?\b|\boption labels?\b', re.I)
    # A count / total / cardinality claim.
    _COUNT_ORACLE_RE = re.compile(
        r'\b\d+\s*(?:of|/)\s*\d+\b|\b\d+\s+(?:rows?|records?|items?|results?|entries)\b'
        r'|\btotal\s*count\b|\brow count\b'
        r'|\bzero rows?\b|\bno (?:rows?|records?|results?|matches)\b', re.I)
    # An empty-state / no-match / exclusion claim. Includes the "every X … and none Y" and
    # "no <Retired> badge is present" shapes — asserting the ABSENCE of a data token that the
    # filter should have excluded is a genuine oracle (unlike asserting a chrome element is
    # still there).
    _EMPTY_ORACLE_RE = re.compile(
        r'\bempty state\b|\bno (?:results?|matches|matching|records?|rows?)\b'
        r'|\bnon-?matching\b|\bnonsense\b|\bunmatched\b|\bnot found\b'
        r'|\bnone\b|\bno\s+\w+\s+(?:badge|row|card|entry|entries|item|record|option)s?\b'
        r'|\bexclud(?:e|es|ed|ing)\b|\bevery\b[^.]{0,80}\b(?:none|no)\b', re.I)
    # Presence-AND-absence of two NAMED records, judged per step. Deliberately strict: the
    # step must name two quoted literals and pair a positive with a negative visibility word.
    # A loose "…is visible … banner is hidden" across separate chrome assertions is exactly
    # the vacuous pattern this gate exists to catch, so it must not qualify — chrome/error
    # nouns disqualify the step outright.
    # Chrome and error copy. "Verify 'Unable to load … — try again' is hidden" is the single
    # most common vacuous filter assertion: the error banner is hidden whether the filter
    # worked or was dropped, so it must never read as an exclusion oracle.
    _CHROME_RE = re.compile(
        r'\b(?:error|banner|alert|toast|skeleton|spinner|loading|column|header|heading)\b'
        r'|\bunable to\b|\btry again\b|\bcould not\b|\bfailed to\b|\bretry\b', re.I)
    # Nouns that denote the DATA the filter acts on.
    _DATA_NOUN_RE = re.compile(
        r'\b(?:row|rows|card|cards|item|items|record|records|entry|entries|result|results|'
        r'badge|badges|task|tasks|option|options|initiative|initiatives|list)\b', re.I)
    _POS_VIS_RE = re.compile(r'\b(?:is visible|is present|is shown|is listed|appears)\b', re.I)
    _NEG_VIS_RE = re.compile(r'\b(?:is hidden|is absent|is not (?:visible|present|shown|listed)|does not appear)\b', re.I)
    _QUOTED_RE = re.compile(r'"[^"]{2,}"|\'[^\']{2,}\'')

    # Cardinality / narrowing claims about the filtered content.
    # "only" is a narrowing word on its own; "every"/"each"/"at least one" only count when they
    # quantify over the DATA (every row/card/record), not over boilerplate prose.
    _NARROW_CLAIM_RE = re.compile(
        r'\bonly\b'
        r'|\b(?:at least one|every|each)\b[^.]{0,40}?'
        r'\b(?:row|rows|card|cards|item|items|record|records|entry|entries|result|results|badge|badges|task|tasks)\b',
        re.I)

    def _discriminating_step(step: str) -> bool:
        """Does this assertion distinguish a working filter from one that ignores the input?

        Chrome assertions never do — a heading, column header or hidden error banner is
        identical whether the parameter was honoured or dropped."""
        if _CHROME_RE.search(step):
            return False
        if _COUNT_ORACLE_RE.search(step) or _EMPTY_ORACLE_RE.search(step):
            return True
        if _NARROW_CLAIM_RE.search(step):
            return True
        # Asserting a DATA element is absent after filtering is a real exclusion oracle — but
        # only when the absent thing is data (a row/card/named record), not arbitrary copy.
        if _NEG_VIS_RE.search(step) and (_DATA_NOUN_RE.search(step) or _QUOTED_RE.search(step)):
            return True
        return (bool(_POS_VIS_RE.search(step)) and bool(_NEG_VIS_RE.search(step))
                and len(_QUOTED_RE.findall(step)) >= 2)

    _filter_oracle_vacuous: list = []
    for tc in tcs:
        blob_steps = ' '.join([*(tc.get('steps') or []), *(tc.get('step_expectations') or [])])
        title = tc.get('title', '') or ''
        exp = tc.get('expected', '') or ''
        # A render-invariant / exploratory widget TC touches the filter control to check how it
        # RENDERS (trigger shows a label, listbox opens anchored), not what it FILTERS. Judging
        # it here would demand a result-set oracle it was never meant to carry.
        if re.search(r'render[\s-]?invariant', f"{title} {tc.get('category', '')}", re.I):
            continue
        if _OPTION_INVENTORY_RE.search(f'{title} {blob_steps}'):
            continue
        # A validation TC's oracle is the error message the spec mandates, not a result set.
        if str(tc.get('flow', '')).lower() == 'validation' or 'validation' in str(tc.get('category', '')).lower():
            continue
        # An a11y TC's oracle is the clause the VIF's §Accessibility section declares —
        # a role, an aria attribute, a non-colour indicator — never a result set. It is
        # judged here only because its TITLE is built by concatenating that clause
        # VERBATIM, so a clause that merely mentions when the behaviour applies ("focus
        # stays at the invoking control after filter change", VIF-ACT-008) reads to
        # _FILTER_TITLE_RE as a filter TC. The clause cannot be reworded around this:
        # §Accessibility rows are under a copy-verbatim contract (2c-a11y).
        if str(tc.get('flow', '')).lower() == 'a11y' or 'a11y' in str(tc.get('category', '')).lower():
            continue
        # The FILTER must be the TC's subject, not a means of reaching a record. A TC titled
        # "A Retired SOP hides the SopActionBar" legitimately clicks the Retired filter pill
        # just to reach a Retired card — its oracle is the action bar, and demanding a
        # result-set assertion from it would be wrong.
        if not _FILTER_TITLE_RE.search(title) and not re.search(r'\bnarrow', title, re.I):
            continue
        # Must actually drive the control — a TC that merely mentions the word "filter" in a
        # spec quote, or renders a filter bar on page load, is not one.
        drives_filter = bool(_FILTER_ACT_RE.search(blob_steps)) or bool(
            _FILTER_ACTION_VERB_RE.search(blob_steps))
        if not drives_filter:
            continue
        # Judged on the STEPS only, never the top-level `expected`. `expected` is where the TC
        # DECLARES its intent ("the table re-renders with the filtered result set") — the steps
        # are where it actually asserts something, and the script generator emits assertions
        # from the steps. A TC whose only mention of narrowing is in its prose claim is exactly
        # the vacuous case.
        discriminating = any(_discriminating_step(s) for s in [*(tc.get('steps') or []),
                                                              *(tc.get('step_expectations') or [])])
        # Defect #14 (2026-09-11, VIF-ANA-006): the prose steps are the WEAKER source and
        # they were the only one read. Since the 2c-assert contract, the structured
        # `assert:` block is the ONLY thing Step 6 compiles into an expect() — so a suite
        # that did exactly what the skill mandates (move the oracle out of prose and into
        # `assert:`) got flagged vacuous while being the most rigorous. Judge the compiled
        # oracle too: a present-AND-absent pair on named records, or a zero-rows count, is
        # a real exclusion oracle whatever the prose beside it says.
        if not discriminating:
            for _as in [*(tc.get('step_assertions') or []), tc.get('assertions') or []]:
                if not isinstance(_as, list):
                    continue
                _rows = [a.get('rows') for a in _as if isinstance(a, dict) and 'rows' in a]
                if any(str(r).strip() in ('=0', '0') for r in _rows):
                    discriminating = True
                    break
                _absent = [a for a in _as if isinstance(a, dict) and a.get('text')
                           and a.get('absent')]
                if _absent:
                    discriminating = True
                    break
        if not discriminating:
            _filter_oracle_vacuous.append(tc['id'])
            meta['vacuous_oracle'].append(tc['id'])
    meta['filter_oracle_vacuous'] = _filter_oracle_vacuous

    # Tuned-to-dev oracle — a quoted UI-COPY literal ASSERTED as the expected value that
    # does NOT appear anywhere in the spec (the oracle). Per "spec is the oracle", the
    # value under test must come from the spec, never copied from the deployed app / dev
    # source. A UI string in `expected` absent from spec raw is an impl-derived oracle
    # (e.g. an error copy "Unable to load conversation detail." or a title "Conversation
    # Detail" the spec never mandates). Affordance/selector literals that are merely
    # CLICKED in a step (how-to-reach-it, allowed to be impl-grounded) are excluded.
    # SOFT: docks dim 7 + lists TC ids for review — not a hard block (terse specs may
    # legitimately omit some copy).
    spec_raw_norm = re.sub(r'\s+', ' ', (spec.get('raw', '') or '')).lower()
    _UI_COPY_RE = re.compile(r'"([^"]{4,})"|‘([^’]{4,})’|\'([^\']{4,})\'')
    for tc in tcs:
        # literals used as affordances (clicked/selected in a step) are impl-grounding, skip
        affordances = set()
        for s in (tc.get('steps', []) or []):
            for m in _UI_COPY_RE.finditer(s):
                lit = next(g for g in m.groups() if g)
                affordances.add(re.sub(r'\s+', ' ', lit).strip().lower())
        hits = []
        for m in _UI_COPY_RE.finditer(tc.get('expected', '') or ''):
            lit = next(g for g in m.groups() if g)
            norm = re.sub(r'\s+', ' ', lit).strip().lower()
            if (not norm or len(norm) < 4 or not re.search(r'[a-z]', norm)
                    or norm in affordances
                    or norm.startswith(('text=', '#', '.', '/', 'http'))
                    or _REF_ID_RE.match(lit.strip())):
                continue
            if norm not in spec_raw_norm:
                hits.append(lit)
        if hits:
            meta['tuned_to_dev'].append(tc['id'])

    # Invented field — a test_data key / layout_stress field naming a field that exists in
    # NEITHER the spec (fields map OR anywhere in the spec raw text) NOR the live element-map
    # (inputs/textareas/selects/labels). Such a field is hallucinated: the assertion targets
    # nothing and passes vacuously. Grounding on the spec raw (not just the form-field map) is
    # deliberate — a table-column field like `contactName` is a real DTO field mentioned in
    # the spec but never a form input, so element-map alone would false-flag it. And a field
    # the SPEC itself declares is spec-conformant by definition: if it is wrong that is a Step-2
    # spec-synthesis bug, not a test-quality defect this linter may assert (no-spec-claim-
    # without-evidence). So we flag ONLY fields absent from both oracles. SOFT: docks dim 7.
    if element_map:
        spec_raw_norm_f = re.sub(r'\s+', ' ', (spec.get('raw', '') or '')).lower()
        known_fields = {str(f).lower() for f in (spec.get('fields', {}) or {})}
        for pool in ('inputs', 'textareas', 'selects'):
            for el in (element_map.get(pool, []) or []):
                for k in ('name', 'id'):
                    if el.get(k):
                        known_fields.add(str(el[k]).lower())
        for lb in (element_map.get('labels', []) or []):
            if lb.get('for'):
                known_fields.add(str(lb['for']).lower())
            if lb.get('text'):
                known_fields.add(re.sub(r'\s+', ' ', str(lb['text'])).strip().lower())
        _FIELD_NAMEISH_RE = re.compile(r'^[a-zA-Z][a-zA-Z0-9 _]{2,40}$')
        for tc in tcs:
            candidates = []
            td = tc.get('test_data') or {}
            if isinstance(td, dict):
                candidates += list(td.keys())
            # layout-discovery TCs name the stressed field in layout_stress.field — a
            # hallucinated DTO field (patientName) here injects into nothing (TC-047).
            ls = tc.get('layout_stress') or {}
            if isinstance(ls, dict) and ls.get('field'):
                candidates.append(ls['field'])
            unknown = [k for k in candidates
                       if _FIELD_NAMEISH_RE.match(str(k))
                       and str(k).lower() not in known_fields
                       and str(k).lower() not in spec_raw_norm_f]
            if unknown:
                meta['invented_field'].append(tc['id'])

    # Empty-state copy untested on a SUCCESSFUL (200) empty list — a spec ui_behavior
    # that declares an empty-state copy ("No goals set …" when the list returns zero)
    # must be proven on a 200-empty response, NOT only via a 4xx/error TC. A 404 test
    # (e.g. TC-020) asserts "no rows" but never that the success-empty copy renders, so
    # a blank table on a real empty list ships green. GENERAL (any data-backed page).
    raw = {}
    if _HAS_YAML:
        try:
            _parsed = _yaml.safe_load(spec.get('raw', '') or '')
            if isinstance(_parsed, dict):
                raw = _parsed
        except Exception:
            raw = {}
    meta['empty_state_untested'] = False
    _empty_copy = None
    for ub in (raw.get('ui_behaviors') or []):
        cond = str(ub.get('condition', '')).lower()
        vis = str(ub.get('expected_visual', '')).strip()
        if vis and '[MISSING' not in vis and re.search(r'\bzero\b|\bempty\b|no\s+\w+|returns?\s+0', cond):
            _empty_copy = vis
            break
    if _empty_copy:
        m = re.search(r"'([^']{3,})'|\"([^\"]{3,})\"", _empty_copy)
        phrase = (m.group(1) or m.group(2)) if m else ' '.join(_empty_copy.split()[:4])
        phrase_low = phrase.lower()
        proven_on_success = False
        for tc in tcs:
            blob = ' '.join([tc.get('expected', ''), tc.get('title', ''),
                             *tc.get('steps', []), *tc.get('step_expectations', [])]).lower()
            if phrase_low and phrase_low in blob:
                # Must be a success path — an error/4xx TC asserting the same copy doesn't count.
                if re.search(r'\b40\d\b|\b5\d\d\b|forbidden|unauthor|error state', blob):
                    continue
                proven_on_success = True
                break
        if not proven_on_success:
            meta['empty_state_untested'] = True

    # Count / aggregate business rule with no NUMERIC oracle — a BR that promises a
    # count ("N active", "number of goals …") but no TC asserts a CONCRETE number for
    # it. A presence-only check ("some `\d+ active` text is visible") passes vacuously
    # on 0/wrong counts. Flag → dock dim 7 so a mocked known-count TC gets added.
    meta['count_oracle_missing'] = []
    for br in (raw.get('business_rules') or []):
        brid = str(br.get('id', ''))
        outcome = str(br.get('expected_outcome', ''))
        if not re.search(r'\bcount\b|number of|\bN\b\s+\w+|badge.*\bN\b', outcome):
            continue
        m = re.search(r'\bN\s+([A-Za-z]{3,})', outcome) or re.search(r'number of ([A-Za-z]{3,})', outcome, re.I)
        noun = m.group(1).lower() if m else ''
        has_numeric_oracle = False
        for tc in tcs:
            blob = ' '.join([tc.get('expected', ''), tc.get('title', ''),
                             *tc.get('steps', []), *tc.get('step_expectations', [])])
            related = brid.upper() in str(tc.get('spec_ref', '')).upper() or (noun and noun in blob.lower())
            if not related:
                continue
            if (noun and re.search(rf'\b\d+\s+{re.escape(noun)}', blob, re.I)) or \
               re.search(r'\b(?:equals?|exactly|==)\b[^.]*\d', blob, re.I):
                has_numeric_oracle = True
                break
        if not has_numeric_oracle:
            meta['count_oracle_missing'].append(brid)

    # 7. Clarity & Traceability
    has_ref = sum(1 for tc in tcs if tc['spec_ref'] and tc['spec_ref'] not in ('', '-'))
    traceability_ratio = has_ref / total
    has_steps = sum(1 for tc in tcs if len(tc['steps']) >= 2)
    clarity_ratio = has_steps / total
    dirty_titles = [tc['id'] for tc in tcs if '|' in tc['title'] or tc['title'].lstrip().startswith('#')]
    meta['dirty_titles'] = dirty_titles
    dirty_ratio = len(dirty_titles) / total
    meta['no_ref_tcs'] = [tc['id'] for tc in tcs if not tc['spec_ref'] or tc['spec_ref'] in ('', '-')]
    meta['short_step_tcs'] = [tc['id'] for tc in tcs if len(tc['steps']) < 2]
    # de-dup: a TC can be flagged by more than one oracle detector (weak + neg-only)
    meta['vacuous_oracle'] = list(dict.fromkeys(meta['vacuous_oracle']))
    s7 = round(2.0 * traceability_ratio + 2.0 * clarity_ratio + 1.0 * (1 - dirty_ratio))
    if (meta['vacuous_oracle'] or meta.get('empty_state_untested') or meta.get('count_oracle_missing')
            or meta.get('tuned_to_dev') or meta.get('invented_field')):
        s7 -= 1  # spec-traceable in name only: cites a ref but asserts no spec value
    # A TC that renders with no assertion is not a weak oracle, it is no oracle: it
    # reports PASS whatever the app does. Every ratio above is satisfied by such a TC
    # — it has a spec_ref, it has two steps, its title is clean — which is how 42 of
    # 100 empty tests once scored 4/5 here. Cap the dimension into BLOCKED territory
    # so the run cannot proceed on a suite that asserts nothing.
    meta['inert_tcs'] = find_inert_test_cases(testcases_path, spec.get('parsed') or {}, element_map)
    if meta['inert_tcs']:
        s7 = min(s7, 2)
    s7 = max(1, min(5, s7))

    # 8. VIF section coverage — see score_section_coverage for why this is its own
    # dimension rather than a check folded into one of the seven above.
    s8, sec_findings = score_section_coverage(tcs, spec.get('parsed') or {})
    meta['section_findings'] = sec_findings

    scores = {1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7, 8: s8}
    return scores, meta


DIMENSION_NAMES = {
    1: 'User Flow Coverage',
    2: 'Validation / Unhappy-path & Error Coverage',
    3: 'Navigation Coverage',
    4: 'State / Interaction Coverage',
    5: 'Test Data Realism',
    6: 'Authorization Coverage',
    7: 'Clarity & Traceability',
    8: 'VIF Section Coverage (grammar 0.4 section contract)',
}

DIMENSION_FIXES = {
    1: 'Add TCs for uncovered UF-xxx flows (happy path end-to-end)',
    2: 'Cover EVERY exception state the spec implies (404/not-found, 403/forbidden, 5xx/error, loading, 401/auth) with an executable mock_routes TC — not spec_only stubs. Cover EVERY declared enforcement guard (ENF-xxx) with a NEGATIVE TC that seeds a violating state, attempts the guarded action, and asserts rejection + state unchanged. On grammar 0.4 the guards are machine-readable and there is no excuse for a gap: one per ES `## Invariants` row (the `Kind` cell picks the violating input, the `Error Code` cell is the oracle) and one per `throw` in every `## Behaviors` `Steps:` block (0.3 alias `## Domain Methods` `Pre:`). A guard whose `error_code` is set but whose `wire_code` is empty is an UNMAPPED domain error — the boundary publishes no code for a condition the domain enforces, so no VIF-derived TC can catch it; the TC must still exist and the gap must be reported. Cover EVERY openable secondary data surface (expander/tab/drawer with its OWN endpoint — e.g. a Version History panel) with BOTH a load-SUCCESS TC (asserts the content actually loads — no error/failed-to-load copy) and a load-ERROR TC (mock 5xx → graceful error); a read/view flow must assert its PRIMARY positive outcome, never only an absence check. Cover EVERY displayed free-text field with a layout-overflow TC (the auto guard: category layout-discovery, surface auto — injects a long no-space value and asserts it renders within bounds on list + detail). For form pages also add exact-min/below-min/exact-max/exceed-max boundary TCs with exact error messages, AND a validation-LIFECYCLE TC per required field (category validation-lifecycle): the message must DISAPPEAR once the field holds a valid value (on change or on blur), must not show on a pristine form, must reappear when the rule is violated again, and must be wiped by Clear/Reset. Specs only ever mandate the appearance direction — see references/validation-lifecycle.md.',
    3: 'Add TC for post-submit redirect, back/cancel, breadcrumb links',
    4: 'Add TC for each modal open/close, each dropdown option, conditional visibility. RENDER-INVARIANT (mandatory when the page has interactive widgets — see references/ui-render-invariants.md): emit one exploratory TC per Select/dropdown/combobox trigger asserting its trigger shows the human-readable LABEL (not the raw enum index "0" / underlying value), and one per popover/dropdown-menu/column-toggle overlay asserting it opens VISIBLE + non-empty + anchored near its trigger. Every interactive widget in element-map must be referenced by ≥1 TC.',
    5: 'Replace placeholder values (foo/bar/test123) with domain-realistic data; boundary values must match spec min/max',
    6: 'Add unauthenticated redirect TC + role-based visibility TC per spec actor',
    8: 'Extract every VIF section into the spec-yaml with `resolve_specs.py --emit-vif-block` and MERGE it (never retype a row), then cover each declared row with a TC in the matching category: `acceptance-criteria` per VIF AC id (an AC proven by a functional TC counts — cite the id in spec_ref), `boot-request` per §Task Screens Query Parameter default (bind to the cold-load request and read its URL; every other TC sets the control first, so a changed default is invisible to all of them), `negative-render` per "Response fields received but not displayed" field (the only NEGATIVE render contract in the grammar — TenantId leaking into a tenant-facing queue is what it catches), `responsive` per §Responsive Rules breakpoint (set the viewport, assert the named component; scope with `>> visible=true` or a mobile/desktop double-render passes toBeHidden vacuously), `error-precedence` per §Empty & Error Precedence row (the LEVEL is the oracle — a full-page 403 that renders inline over a stale list is a different defect from the same 403), `support-panel` per panel whose Required is yes (a panel marked no must NOT be asserted present — that manufactures a false bug), `state-default` per observable §State Management initial value, `queue-column` per queue column (assert the column BINDING renders a value, not just that its header string exists — a header renders during the fetch), and `a11y` per §Accessibility bullet, verbatim and nothing outside that section. A row that genuinely cannot be asserted is excused ON THE ROW with a reason (`untestable:`/`observable: none`/`required: no`), never by deletion.',
    7: 'FILTER/SEARCH ORACLE: every TC that types into or selects a filter/search control must prove the RESULT SET changed — type a value that cannot match anything and assert zero rows + the spec empty-state copy, then clear it and assert the original set returns (a row/total count assertion, or a present-AND-absent named-record pair, also qualifies). Asserting the heading/columns survived the keystroke and no error appeared is passed by a backend that ignores the parameter. Add spec rule ref (UF/VAL/BR-xxx) to each TC that is missing one; ensure titles contain no raw spec table (|) characters; add spec_only flag. ORACLE STRENGTH: every High positive TC must assert at least one CONCRETE spec-derived value (a quoted literal / number), never only generic prose ("Step completes as expected", "list updates") — a weak-oracle TC passes on any output (mutate-to-known-input if the value is not observable live). A quoted UI string asserted as the expected value must trace to a spec line (not copied from the deployed app). test_data field names must be real (present in the spec or element-map), never invented (e.g. patientName vs contactName).',
}


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Evaluate UI test case quality')
    parser.add_argument('--testcases', required=True, help='Test cases YAML file')
    parser.add_argument('--spec', required=True, help='Domain spec file')
    parser.add_argument('--page-url', default='', dest='page_url')
    parser.add_argument('--element-map', default='', dest='element_map',
                        help='element-map.json from Step 3 — enables the widget-render '
                             'coverage gate (dim 4) and the invented-field oracle check')
    parser.add_argument('--no-improve', action='store_true', dest='no_improve',
                        help='Skip auto-improve loop; just score and exit')
    args = parser.parse_args()

    print(f'📊 Evaluating: {args.testcases}')
    tcs, _ = parse_test_cases(args.testcases)
    spec = parse_spec_details(args.spec)
    print(f'   {len(tcs)} test cases loaded')
    print(f'   Spec rules: UF={len(spec["uf"])} VAL={len(spec["val"])} BR={len(spec["br"])} SRV={len(spec["srv"])} ER={len(spec.get("er", []))}')
    if spec.get('is_readonly'):
        print('   Read-only page detected → form boundary/format is N/A; exception coverage governs dimension 2.')

    element_map = load_element_map(args.element_map)
    if args.element_map and not element_map:
        print(f'   ⚠️  element-map not loaded from {args.element_map} — widget-render gate skipped')
    scores, meta = score_all(tcs, spec, element_map=element_map,
                             testcases_path=args.testcases)
    overall = sum(scores.values()) / len(scores)
    min_score = min(scores.values())
    print(f'   Overall score: {overall:.1f}/5.0  |  Min dimension: {min_score}/5')

    # Print specific issues
    missing_exc = meta.get('missing_exc', [])
    if missing_exc:
        print(f'   ⚠️  Missing UNHAPPY-PATH coverage: {", ".join(missing_exc)} — generator should emit these via build_exception_test_cases')
    missing_enf = meta.get('missing_enf', [])
    if missing_enf:
        print(f'   ⚠️  Missing ENFORCEMENT coverage: {", ".join(missing_enf)} — domain invariant/precondition with no negative TC; generator should emit these via build_enforcement_test_cases')
    # A guard that never made it into the yaml produces no `missing_enf` entry —
    # the gate cannot miss what it was never told about. This is the only line that
    # reports guards dropped BEFORE the gate could ask for them.
    if meta.get('enf_underdeclared'):
        print(f'   🚫 UNDER-DECLARED ENFORCEMENT: {meta["enf_underdeclared"]}')
    uncovered_surfaces = meta.get('uncovered_data_surfaces', [])
    if uncovered_surfaces:
        print(f'   🚫 UNTESTED data surface(s): {", ".join(uncovered_surfaces)} — an openable panel/tab/drawer that fires its own fetch with NO load TC (how Bug #145535 shipped green). generator must emit load-success + load-error TCs (build_exception_test_cases secondary-surface pass).')
    missing_empty_state = meta.get('missing_empty_state', [])
    if missing_empty_state:
        print(f'   🚫 UNTESTED EMPTY state on surface(s): {", ".join(missing_empty_state)} — the surface declares an Empty state but no TC asserts it renders Empty (not Error) with no data. A 404/no-rows routed to the Error state is Bug #145660. generator must emit the empty-state TC (build_exception_test_cases secondary-surface pass).')
    missing_state_fit = meta.get('missing_state_fit', [])
    if missing_state_fit:
        print(f'   🚫 UNTESTED STATE-FIT on surface(s): {", ".join(missing_state_fit)} — the surface has an Error state but no layout TC asserts its controls stay within the container. A Retry button clipped past the sheet edge is Bug #145661. generator must emit the state-fit layout TC (surface: state).')
    missing_lifecycle = meta.get('missing_lifecycle_fields', [])
    if missing_lifecycle:
        print(f'   🚫 MISSING validation-LIFECYCLE coverage for required field(s): {", ".join(missing_lifecycle)} — the suite asserts only that a validation message APPEARS. Nothing asserts it DISAPPEARS once the field holds a valid value, so a form that never re-validates keeps a stale "X is required" on screen and stays green. generator must emit the lifecycle TCs (build_form_test_cases validation-lifecycle pass; see references/validation-lifecycle.md).')
    elif meta.get('missing_lifecycle_pristine'):
        print('   ⚠️  No PRISTINE-form TC — nothing asserts the form opens free of validation messages (errors rendered on mount / left over from a previous open ship uncaught).')
    if meta.get('missing_clip_sweep'):
        print('   🚫 MISSING presentation-invariant sweep — no TC asserts that height-capped / overflow containers expose their content by scrolling. Content clipped in a max-h-* box with a dead scrollbar (closing brace of a JSON blob cut off, tail unreachable) ships green. generator must emit the clip sweep (build_presentation_invariant_test_cases, surface: clip).')
    neg_only = meta.get('neg_only_positive', [])
    inert = meta.get('inert_tcs') or []
    if inert:
        _shown = ", ".join(str(i) for i in inert[:20]) + (" …" if len(inert) > 20 else "")
        print(f'   🚫 INERT TEST(S) — {len(inert)} of {len(tcs)} TC(s) render with NO assertion at all: {_shown}. '
              'Every step falls through the generator\'s translator to a bare `// Step:` comment, so the test body is empty '
              'and reports PASS whatever the application does. This is not a weak oracle, it is no oracle — and it is invisible '
              'to every coverage dimension, because such a TC still has a spec_ref, still has steps and still has a clean title. '
              'Two fixes, and you must look to tell them apart: re-phrase the step in a form the translator maps '
              '("Click \'X\' button", "Verify \'Y\' is visible", "Navigate to /path") — or, when the step is genuinely '
              'undrivable through the UI, mark the TC spec_only with the reason so it renders as a visible test.skip '
              'instead of a silent green.')
    if neg_only:
        print(f'   ⚠️  Vacuous positive oracle in TC(s) {", ".join(str(i) for i in neg_only)} — a read/view flow whose expected promises content but whose steps only assert an ABSENCE (an errored panel passes). Add a positive "verify … is visible/listed/loaded" assertion.')
    inv = meta.get('widget_inventory', [])
    if inv:
        kinds = ', '.join(sorted({w['kind'] for w in inv}))
        print(f'   🧩 Interactive widgets on page: {len(inv)} ({kinds}).')
        if meta.get('has_render_invariant_tc') is False:
            print(f'   🚫 NO render-invariant TC — {len(inv)} interactive widget(s) exist but the suite never asserts a Select/dropdown trigger shows a human-readable LABEL (not the raw enum index "0") or that a popover/overlay mounts anchored + non-empty. This is the Bug A + Bug B blind spot (0/64 covered on the Conversation run). generator must emit one render-invariant exploratory TC per widget (see references/ui-render-invariants.md).')
    uncov = meta.get('uncovered_widgets', [])
    if uncov:
        uncov_str = ', '.join('{} ({})'.format(w['label'], w['kind']) for w in uncov)
        print(f'   🚫 UNTESTED widget(s): {uncov_str} — referenced by NO TC. Add a TC that exercises each (and asserts its render invariant).')
    weak = meta.get('weak_oracle', [])
    if weak:
        print(f'   ⚠️  Weak oracle in TC(s) {", ".join(str(i) for i in weak)} — a High positive TC with NO concrete assertion anywhere (only generic prose like "Step completes as expected"). Passes on any output. Assert a spec-derived value (mutate-to-known-input).')
    tuned = meta.get('tuned_to_dev', [])
    if tuned:
        print(f'   ⚠️  Tuned-to-dev oracle in TC(s) {", ".join(str(i) for i in tuned)} — asserts a quoted UI string NOT found in the spec (oracle copied from impl, not spec). Verify each literal traces to a spec line; if not, ground the oracle on the spec value.')
    filt = meta.get('filter_oracle_vacuous', [])
    if filt:
        print(f'   🚫 VACUOUS FILTER ORACLE in TC(s) {", ".join(str(i) for i in filt)} — the TC types into / selects a filter or search control but never asserts the RESULT SET changed. A backend that accepts the parameter and ignores it passes this test (Bug #148643). Required: type a value that cannot match anything and assert ZERO rows + the spec\'s empty-state copy, then clear it and assert the original set returns. A count/total assertion or a present-AND-absent pair also qualifies.')
    invented = meta.get('invented_field', [])
    if invented:
        print(f'   ⚠️  Invented field in TC(s) {", ".join(str(i) for i in invented)} — test_data names a field absent from BOTH the spec and the live element-map (e.g. patientName vs the real contactName). The assertion targets nothing. Use the real field name.')
    # Dimension 8 — printed before the generic per-dimension advice because an
    # UNDER-DECLARED section is not a "write more TCs" problem: nothing downstream
    # can act until the section reaches the yaml.
    sf = meta.get('section_findings') or {}
    for u in sf.get('undeclared', []):
        print(f'   🚫 UNDER-DECLARED SECTION — {u}')
    for u in sf.get('uncovered', []):
        print(f'   🚫 UNCOVERED SPEC ROW — {u}')
    for n in sf.get('notes', []):
        print(f'   ⚠️  {n}')

    val_missing = sorted(meta.get('val_ids', set()) - meta.get('val_covered', set()))
    if val_missing:
        print(f'   ⚠️  Missing VAL coverage: {", ".join(val_missing)}')
    if meta.get('missing_er'):
        print(f'   🚫 UNCITED ERROR PATHS: {", ".join(meta["missing_er"])} — declared in '
              f'`error_messages:`, cited by no TC. Exception-KIND coverage does NOT see this: '
              f'three 500s on three endpoints collapse into one "server_error" bucket, so two of '
              f'them ship untested at full marks. Two causes, two fixes, and you must look to '
              f'tell them apart: the path is genuinely untested (write one TC — mock THAT '
              f'endpoint with THAT status, assert the row\'s `ui_text` verbatim), or it is tested '
              f'under the wrong id (fix the `spec_ref`; do NOT write a duplicate). Judging by '
              f'status code alone is not enough — a list-500 TC and a save-500 TC look identical.')
    if meta.get('missing_ui'):
        print(f'   🚫 UNCITED UI BEHAVIOURS: {", ".join(meta["missing_ui"])} — declared in '
              f'`ui_behaviors:` with no TC citing the id. Two possible causes, two different '
              f'fixes: the state is untested (write the TC), or it is tested under an invented '
              f'ref such as `UI-loading` (correct the `spec_ref`). Check before writing. Assert '
              f'the row\'s `expected_visual` copy verbatim.')
    bad_tcs = meta.get('bad_tc_ids', [])
    if bad_tcs:
        print(f'   ⚠️  Placeholder values in: {", ".join(bad_tcs[:10])}')

    # Strict exit codes
    if min_score < 3:
        print(f'\n🚫 BLOCKED: dimension score < 3. Auto-improve required before Step 5.')
        for d, s in scores.items():
            if s < 3:
                print(f'  [{d}] {DIMENSION_NAMES[d]} ({s}/5): {DIMENSION_FIXES[d]}')
                if d == 2:
                    for v in sorted(meta.get('val_ids', set()) - meta.get('val_covered', set())):
                        print(f'       Missing: {v}')
        sys.exit(1)

    if overall >= 4.0 or args.no_improve:
        print('   Quality threshold met — proceeding.' if overall >= 4.0 else '   (--no-improve set, skipping)')
        sys.exit(0)

    print(f'\n⚠️  Score {overall:.1f} < 4.0 — auto-improve needed:')
    for d, s in scores.items():
        if s < 4:
            print(f'  [{d}] {DIMENSION_NAMES[d]} ({s}/5): {DIMENSION_FIXES[d]}')

    sys.exit(2)  # signal: needs improvement but not critical


if __name__ == '__main__':
    main()
