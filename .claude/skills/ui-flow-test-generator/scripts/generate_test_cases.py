#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 4 — Generate UI test cases from synthesized spec YAML + element map.

Reads:
  - {feature}-spec.yaml : AI-synthesized spec (output of Step 2 / spec-template.yaml)
  - element-map.json    : output of analyze_page.py

Writes:
  - test-cases/ui/{feature}-test-cases.yaml

Usage:
    python3 generate_test_cases.py \
        --spec-yaml apps/testing/automation-testing/fe-testing/spec/ui/tasks-mine-spec.yaml \
        --element-map apps/testing/automation-testing/fe-testing/element-map.json \
        --out apps/testing/automation-testing/fe-testing/test-cases/ui/tasks-mine-test-cases.yaml
"""

import argparse
import json
import re
import sys
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



def to_relative_url(u: str) -> str:
    """Convert an absolute http(s) URL to a root-relative path (path+query+fragment).

    Keeps generated test-cases.yaml (base_url, page, "Navigate to …" steps)
    environment-portable so Playwright resolves them against baseURL (UI_BASE_URL)
    rather than a hard-coded deployment host. This is the 2026-06 relative-URL
    convention (refactor #143582). Mirrors the same helper in generate_scripts.py.

      • http:// or https://  → strip scheme+host, keep '/path?query#frag'.
      • file://              → unchanged (local prototype; baseURL does not apply).
      • already relative     → ensure exactly one leading slash.
    Case is preserved so query params like ?objectiveId survive.
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


# ── Error-catalogue helpers (Fix A/B) ─────────────────────────────────────────

def _parse_error_status(entry: dict) -> int | None:
    """Infer the HTTP status code for an error-catalogue entry from its trigger/text.

    The author's own `status_code` wins, then an explicit 3-digit code in the text,
    then keyword mapping so entries authored before status codes were a convention
    still classify.

    Reading the declared field first is not a nicety. Both spec-template.yaml and
    §2c-exception instruct the author to set `status_code`, and this function used to
    ignore it and infer from prose — so a row declaring 500 whose `message` happened to
    say the fields "stay empty/read-only" was filed as a 404 (measured on VIF-GOV-003
    ER-020), and four rows whose prose named no status at all resolved to None and were
    dropped from the catalogue entirely. Inference is the fallback for un-annotated
    rows, never an override of a stated one.
    """
    declared = entry.get('status_code')
    if isinstance(declared, bool):
        declared = None
    if isinstance(declared, int):
        return declared
    if isinstance(declared, str) and declared.strip().isdigit():
        return int(declared.strip())
    blob = ' '.join(str(entry.get(k, '')) for k in ('trigger', 'message', 'id')).lower()
    m = re.search(r'\b(40[0-9]|41[0-9]|42[0-9]|45[0-9]|50[0-9])\b', blob)
    if m:
        return int(m.group(1))
    if 'not found' in blob or 'unknown' in blob or 'invalid id' in blob or 'empty' in blob:
        return 404
    if 'forbidden' in blob or 'scope mismatch' in blob or 'access denied' in blob or 'permission' in blob:
        return 403
    if 'unauthor' in blob or 'session expired' in blob or 'sign in' in blob or 'signin' in blob or 'login' in blob:
        return 401
    if 'network' in blob or 'timeout' in blob or 'server error' in blob or '5xx' in blob:
        return 500
    return None


def error_kind(status: int | None, blob: str = '') -> str:
    """Map a status code (+ optional text) to a UI exception kind."""
    if status == 404:
        return 'not_found'
    if status == 403:
        return 'forbidden'
    if status == 401:
        return 'auth'
    if status and status >= 500:
        return 'server_error'
    b = blob.lower()
    if 'not found' in b or 'empty' in b:
        return 'not_found'
    if 'forbidden' in b or 'denied' in b:
        return 'forbidden'
    if 'loading' in b or 'skeleton' in b:
        return 'loading'
    return 'server_error'


def derive_api_pattern(spec: dict, em: dict) -> str | None:
    """Derive a Playwright glob pattern for the page's primary data API.

    Priority: spec.api_contracts[].pattern → spec.api_contracts[].endpoint (path-params
    → '*') → None. Used by build_exception_test_cases to intercept the data fetch.
    """
    for c in spec.get('api_contracts', []) or []:
        if c.get('pattern'):
            return c['pattern']
        ep = c.get('endpoint')
        if ep:
            # /api/x/{id} → **/api/x/*  ;  keep query-less path, collapse path params
            path = re.sub(r'\{[^}]+\}', '*', ep).split('?')[0].strip()
            if not path.startswith('/'):
                path = '/' + path
            return f'**{path}'
    return None


def derive_api_patterns(spec: dict, em: dict) -> dict:
    """Classify the page's data APIs into a COLLECTION (list/load) endpoint and an
    ITEM (detail / drill-in) endpoint, so exception TCs can be emitted against BOTH.

    A master-detail page (table/list + detail dialog/sheet) fetches a list on load and
    a single record on drill-in. Emitting error TCs against only the first contract
    (the historical single-pattern behaviour) silently dropped detail-scoped 403/404/
    500 coverage. An endpoint is ITEM-scoped when its path ends in a path parameter
    ({id} / * / :id); otherwise it is COLLECTION-scoped.

    Returns {'collection': pattern|None, 'item': pattern|None}.
    """
    out = {'collection': None, 'item': None}
    for c in spec.get('api_contracts', []) or []:
        ep = c.get('endpoint') or c.get('pattern') or ''
        path = re.sub(r'\?.*$', '', ep).rstrip('/')
        is_item = bool(re.search(r'/(\{[^}]+\}|\*|:[A-Za-z_]+)$', path))
        pat = c.get('pattern')
        if not pat and c.get('endpoint'):
            p = re.sub(r'\{[^}]+\}', '*', c['endpoint']).split('?')[0].strip()
            if not p.startswith('/'):
                p = '/' + p
            pat = f'**{p}'
        if not pat:
            continue
        scope = 'item' if is_item else 'collection'
        if out[scope] is None:
            out[scope] = pat
    # Fallback: nothing classified → treat the legacy primary pattern as the collection.
    if not out['collection'] and not out['item']:
        out['collection'] = derive_api_pattern(spec, em)
    return out


def _contract_pattern(c: dict) -> str | None:
    """Playwright glob pattern for one api_contract entry (pattern → endpoint)."""
    pat = c.get('pattern')
    if not pat and c.get('endpoint'):
        p = re.sub(r'\{[^}]+\}', '*', c['endpoint']).split('?')[0].strip()
        if not p.startswith('/'):
            p = '/' + p
        pat = f'**{p}'
    return pat


def _derive_panel_control(trigger: str) -> str:
    """Extract the on-screen control label that reveals a secondary data surface from
    its api_contract `trigger` prose. GENERAL — works for any expander/tab/drawer, not
    one named feature. e.g. 'Expand Version History in detail sheet — GetX' → 'Version
    History'; 'Open the Activity tab — GetActivity' → 'Activity'. Returns '' when no
    label can be recovered."""
    t = (trigger or '').strip()
    if not t:
        return ''
    t = re.split(r'\s+[—–-]\s+', t)[0]                    # drop "— GetFoo" service suffix
    t = re.split(r'\s+\b(?:in|from|on)\b\s+', t)[0]        # phrase before a locative prep
    t = re.sub(r'^(?:expand|open|click|reveal|view|show|toggle|load|fetch)\s+',
               '', t, flags=re.I)                          # strip leading action verb
    t = re.sub(r'\s+(?:control|button|panel|tab|section|link)$', '', t, flags=re.I)
    return t.strip()


def _derive_panel_error_text(error: str) -> str:
    """Pull the quoted error copy a secondary surface shows on failure from its
    api_contract `error` prose, preferring the 5xx variant. Empty-state copy (e.g.
    'No prior versions') is skipped — it is not an error. Returns '' when none declared."""
    s = error or ''
    m = re.search(r"5\d\d\s*[:→\-]*\s*['\"]([^'\"]+)['\"]", s)
    if m:
        return m.group(1).strip().rstrip('.')
    for q in re.findall(r"['\"]([^'\"]+)['\"]", s):
        if not re.match(r'\s*(?:no |empty|none)', q, re.I):
            return q.strip().rstrip('.')
    return ''


def _derive_panel_empty_text(c: dict) -> str:
    """Spec-mandated EMPTY-state copy for a secondary data surface (e.g. 'No ratchet
    activity yet.'). Prefer an explicit `empty:` field on the api_contract; else scan
    the `success` prose for a quoted no-data string ('… or empty state "No … yet."').
    Returns '' when none declared.

    This is the oracle for the THIRD surface state the 2-state (load-ok / 5xx-error)
    model silently dropped: a surface with a spec'd Empty state must render Empty —
    NOT Error — when it has no data yet. REST backends surface a not-yet-created
    sub-resource as 404/204, and a UI that routes 404→Error shows a scary Retry where
    a calm 'nothing yet' belongs. Exactly the Bug #145660 class (endpoint-agnostic)."""
    ex = c.get('empty')
    if isinstance(ex, str) and ex.strip():
        return ex.strip().strip('\'"').rstrip('.')
    s = str(c.get('success', '') or '')
    for q in re.findall(r"['\"]([^'\"]+)['\"]", s):
        if re.match(r'\s*(?:no |empty|none)', q, re.I):
            return q.strip().rstrip('.')
    return ''


def _endpoint_slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')[:40] or 'panel'


# ── Spec loader ──────────────────────────────────────────────────────────────

def normalize_spec(spec: dict, spec_path: str) -> dict:
    """Normalize a {feature}-spec.yaml into the dict format expected by build_* functions.

    Handles structural differences between spec-template.yaml (v2.0) and
    the old spec_parser dict format so build_* functions need no changes.
    """
    # Inject spec_path so write_yaml can derive fallback module name if needed
    spec.setdefault('spec_path', spec_path)

    # Roles: spec-template.yaml stores as list of strings OR list of dicts
    raw_roles = spec.get('roles', [])
    if raw_roles and isinstance(raw_roles[0], dict):
        spec['roles'] = [r.get('name', '') for r in raw_roles]
    spec.setdefault('roles', [])

    # error_messages: spec-template.yaml stores as list of dicts {id, trigger, message, ...}
    # Fix A — preserve the FULL structured error catalogue (trigger/status/location/
    # recovery) in spec['error_catalogue'] so build_exception_test_cases() can emit one
    # executable unhappy-path TC per entry. The legacy flat string list is kept in
    # spec['error_messages'] (consumed by build_form_test_cases for field-level errors).
    # CRITICAL: do NOT drop entries whose message is '[MISSING …]' — the trigger/status
    # is what drives the injection; the exact copy is optional and often unknown until
    # the build is inspected. Dropping them was the root cause of missing error-state TCs.
    raw_errors = spec.get('error_messages', [])
    if raw_errors and isinstance(raw_errors[0], dict):
        catalogue = []
        for e in raw_errors:
            entry = dict(e)
            entry['status_code'] = _parse_error_status(e)
            # ui_text = the EXACT on-screen substring to assert (optional, often unknown
            # until the build is inspected). `message` is human-readable prose and is
            # NEVER asserted verbatim — that would false-fail on description text.
            entry['ui_text'] = (e.get('ui_text') or '').strip()
            catalogue.append(entry)
        spec['error_catalogue'] = catalogue
        # legacy flat list (real copy only) for the form-field error builder
        spec['error_messages'] = [e.get('message', '') for e in raw_errors
                                   if e.get('message') and '[MISSING' not in e.get('message', '')]
    else:
        spec.setdefault('error_catalogue', [])
    spec.setdefault('error_messages', [])

    # Ensure all keys expected by build_* exist
    spec.setdefault('screens', [])
    spec.setdefault('entities', [])
    spec.setdefault('state_transitions', [])
    spec.setdefault('acceptance_criteria', [])
    spec.setdefault('user_flows', [])
    spec.setdefault('validations', [])
    spec.setdefault('business_rules', [])
    spec.setdefault('boundary_constraints', {})
    spec.setdefault('nav_behaviors', [])
    spec.setdefault('enforcement_guards', [])
    # VIF grammar-0.4 section blocks (spec-template: vif_acceptance_criteria …
    # task_screen). Absent on a yaml written before the section contract — the
    # Step 4.5 dimension-8 gate is what reports that, not a crash here.
    spec.setdefault('vif_acceptance_criteria', [])
    spec.setdefault('state_defaults', [])
    spec.setdefault('responsive_rules', [])
    spec.setdefault('error_precedence', [])
    spec.setdefault('component_tree', [])
    spec.setdefault('data_binding', [])
    spec.setdefault('entry_points', [])
    spec.setdefault('task_screen', None)

    # business_rules: ensure each rule has 'description' key
    for br in spec.get('business_rules', []):
        if 'description' not in br:
            br['description'] = br.get('expected_outcome', br.get('name', ''))

    # user_flows: ensure each flow has 'description' key (spec-template uses 'name')
    for uf in spec.get('user_flows', []):
        if 'description' not in uf:
            uf['description'] = uf.get('name', uf.get('id', 'flow'))

    # Enforcement guards — domain invariants + behavior guards.
    # ROOT CAUSE this closes: the field pass emits VAL/boundary, the HTTP pass emits
    # 4xx/5xx exceptions, and the state-machine pass (build_descriptive §8) emits only
    # the SUCCESS direction of each transition. A server-side precondition such as
    # `Activate(): StartDate >= now` is the REJECTION direction and NONE of those passes
    # read it, so it produced zero negative coverage until hand-authored.
    #
    # Grammar 0.4 moved both guard sources into machine-readable DSLs, and the section
    # names changed with them:
    #   * ES `## Invariants`  — was free prose, now a 7-column table
    #     (ID | Target | Kind | Arguments | Category | Error Code | Description).
    #     `Kind` picks the violation shape, `Error Code` is the oracle key.
    #   * ES `## Behaviors`   — the 0.3 `## Domain Methods` renamed; each `### {Name}`
    #     carries a numbered `Steps:` DSL where every `if <cond>: throw '<Code>'` line
    #     is exactly one guard, error code already supplied.
    # Reading only the 0.3 name (`## Domain Methods`) finds ZERO guards on a 0.4 ES and
    # the dimension-2 gate then has nothing to block on — a silent total loss of negative
    # coverage. references/spec-synthesis.md 2c-grammar / 2c-enforcement carry the resolution rules; this
    # function only canonicalizes whatever the spec-yaml author extracted.
    #
    # Here we canonicalize explicit guards AND synthesize one from any state_transition
    # that declares a guard/precondition, so build_enforcement_test_cases() can emit a
    # rejection TC per guard. `error_code` / `wire_code` are threaded through so the
    # emitted TC asserts the SPECIFIC declared code, and so an unmapped domain error
    # (wire_code == '') stays visible instead of collapsing into a generic failure.
    canon_guards: list[dict] = []
    seen_guards: set = set()

    def _push_guard(g: dict):
        rule = str(g.get('rule', '') or g.get('precondition', '')).strip()
        target = str(g.get('target', '') or g.get('action', '')).strip()
        if not rule and not target:
            return
        dedup_key = (target.lower(), rule.lower())
        if dedup_key in seen_guards:
            return
        seen_guards.add(dedup_key)
        gid = str(g.get('id', '')).strip() or (
            f'ENF-{target.upper().replace(" ", "-")}' if target else f'ENF-{len(canon_guards) + 1:02d}')
        canon_guards.append({
            'id': gid,
            'target': target,
            'rule': rule,
            # `kind` = the ES `## Invariants` Kind cell (max-length / required-iff /
            # terminal-state / ...). Advisory: it tells the script author which violation
            # shape to seed. Absent on guards derived from a `Steps:` throw.
            'kind': str(g.get('kind', '')).strip(),
            # `error_code` = the DOMAIN code (ES Invariants `Error Code`, or the literal in
            # `throw '<code>'`). This is the oracle key for the rejection.
            'error_code': str(g.get('error_code', '') or g.get('code', '')).strip(),
            # `wire_code` = the CT `## Error Responses` code for the SAME condition, i.e. what
            # the caller can actually observe. An EMPTY value is meaningful, not missing data:
            # it means the domain can raise this error but the boundary publishes no code for
            # it, so the UI has nothing to map and shows a generic failure. That seam is
            # invisible to every VIF-derived pass (no VIF section mandates the mapping), so it
            # is preserved here and surfaced in the TC's `expected` text — see references/spec-synthesis.md
            # 2c-errormap.
            'wire_code': str(g.get('wire_code', '')).strip(),
            'violate': str(g.get('violate', '') or g.get('setup_state', '')).strip(),
            'action_ui': str(g.get('action_ui', '')).strip(),
            'reject_expected': str(g.get('reject_expected', '')).strip(),
            'source': str(g.get('source', '')).strip() or gid,
            # `reachable` = resolve_specs' verdict on whether THIS screen can provoke the
            # guard at all. False means the guard belongs to an entity another VIF owns and
            # was pulled in only because this screen writes to it indirectly; emitting a TC
            # for it yields a body with no way to reach the guarded action. It has to be
            # named here or the rebuild below drops it — which is exactly what happened.
            'reachable': g.get('reachable'),
            # `untestable: <reason>` is the spec author saying by hand what `reachable`
            # says mechanically. Only the a11y builder used to honour it, so a guard the
            # author had explicitly delegated still shipped as an assertion-free test.
            'untestable': str(g.get('untestable', '') or '').strip(),
            # Structured oracle. Named explicitly because this dict is rebuilt from a
            # fixed key list, not copied — anything unnamed here is silently dropped.
            'assert': list(g.get('assert') or []),
        })

    for g in (spec.get('enforcement_guards', []) or []):
        if isinstance(g, str):
            g = {'rule': g}
        _push_guard(g)
    for tr in spec.get('state_transitions', []):
        guard_txt = tr.get('guard') or tr.get('precondition') or tr.get('condition')
        if guard_txt and str(guard_txt).strip():
            _push_guard({
                'target': tr.get('action', '') or tr.get('next', ''),
                'rule': str(guard_txt).strip(),
                'source': 'state_transition guard',
            })
    spec['enforcement_guards'] = canon_guards

    return spec


def load_spec(spec_yaml_path: str) -> dict:
    """Load and normalize a {feature}-spec.yaml file."""
    if not _HAS_YAML:
        print('❌ pyyaml not installed. Run: pip install pyyaml', file=sys.stderr)
        sys.exit(1)
    path = Path(spec_yaml_path)
    if not path.exists():
        print(f'❌ spec-yaml not found: {spec_yaml_path}', file=sys.stderr)
        sys.exit(1)
    with open(path, 'r', encoding='utf-8') as f:
        spec = _yaml.safe_load(f) or {}
    if not spec.get('title'):
        print(f'⚠️  spec-yaml has no title: {spec_yaml_path}', file=sys.stderr)
    # Provenance gate — the spec yaml is FLAT (spec/ui/{slug}-spec.yaml) and each run
    # overwrites it, so these keys are the only in-file record of which run produced it.
    # Warn rather than exit: specs written before 2026-08-20 predate the contract.

    # ── Spec-version gate (HARD) ──────────────────────────────────────────────
    # Every test case must be attributable to ONE revision of the VIF it was derived
    # from. Without it a green suite proves nothing later: nobody can tell whether it
    # was written against the VIF that is deployed today or one six versions stale, so
    # "the tests pass" and "the spec is met" stop being the same claim. The version is
    # NOT typed by hand — resolve_specs.py reads `version:`/`grammar:` straight out of
    # the VIF frontmatter and prints the block to paste. This exits rather than warns
    # because the version has to be captured at synthesis time; reconstructing it
    # afterwards is guesswork (measured: only 7 of 41 legacy spec-yamls could be
    # resolved at all, and their in-body version hits were whole release ranges).
    vmissing = [k for k in ('vif_id', 'vif_version', 'vif_grammar') if not spec.get(k)]
    if vmissing:
        print(f'''
❌ HALT — spec-yaml is missing the mandatory spec-version block {vmissing}
   file: {spec_yaml_path}

   Add these three keys, copied VERBATIM from the block that resolve_specs.py prints
   ("spec-yaml provenance block"). Do not re-type the version from memory or from a
   test-case `spec_ref` — the only authority is `version:` in the VIF frontmatter:

     vif_id:      "VIF-KNW-001"
     vif_version: "1.6.0"
     vif_grammar: "0.3"

     python3 .claude/skills/ui-flow-test-generator/scripts/resolve_specs.py \\
       --vif <path-to-VIF.md>

   If the VIF itself has no `version:`, STOP and ask PnC to version it. An invented
   version is worse than none: it makes a stale suite look attributable.
''', file=sys.stderr)
        sys.exit(1)
    if str(spec.get('vif_grammar')) != '0.4':
        print(f'⚠️  grammar {spec.get("vif_grammar")} VIF ({spec.get("vif_id")} '
              f'v{spec.get("vif_version")}) — not yet migrated to 0.4. Allowed, but the '
              f'0.4-only columns (ES Properties constraints, CT ValidationTier/Binding, '
              f'Error Responses `Applies To`) were unavailable; the flag is carried into '
              f'the test-cases yaml, the spec.ts banner and the report verdict.',
              file=sys.stderr)

    missing = [k for k in ('date', 'work_item_id', 'run_backend_mode', 'source_specs') if not spec.get(k)]
    if missing:
        print(f'⚠️  spec-yaml missing provenance {missing}: {spec_yaml_path}\n'
              f'    Fill them per references/spec-synthesis.md 2d — without a versioned source_specs no later '
              f'run can prove a test is stale, and without run_backend_mode a mock-mode pass '
              f'can be misreported as a deployed-build GO.', file=sys.stderr)
    return normalize_spec(spec, spec_yaml_path)


# ── Test case builder ─────────────────────────────────────────────────────────

# ── Field name helpers ────────────────────────────────────────────────────────

DEFAULT_VALUES = {
    'text':     'ValidValue',
    'email':    'john.doe@company.com',
    'password': 'Str0ng!Pass',
    'tel':      '+84901234567',
    'number':   '1',
    'url':      'https://company.com',
    'textarea': 'Sample text',
    'date':           '2026-12-31',
    'datetime-local': '2026-12-31T09:00',
    'time':           '09:00',
    'month':          '2026-12',
}

# Fields whose CONTENT has a format the input type does not express. Typing the
# generic 'ValidValue' into one of these leaves the field invalid, so the message
# under test never clears and the run reports a red against a conformant build —
# the exact false failure the lifecycle family exists to avoid. Keyed on the field
# name because that is the only signal the VIF carries for them.
_FORMATTED_FIELD_SAMPLES = (
    (r'cron',                       '0 0 0 1 * *'),
    (r'email',                      'john.doe@company.com'),
    (r'url|href|link',              'https://company.com'),
    (r'phone|tel|mobile',           '+84901234567'),
    (r'(^|[^a-z])(date|completion|deadline|due)([^a-z]|$)', '2026-12-31'),
    (r'guid|uuid',                  '00000000-0000-0000-0000-000000000001'),
    (r'colou?r|hex',                '#336699'),
)


def _formatted_sample(name: str) -> str:
    """Format-aware sample for a field whose name implies a syntax, else ''."""
    n = (name or '').lower()
    for pat, val in _FORMATTED_FIELD_SAMPLES:
        if re.search(pat, n):
            return val
    return ''


def field_label(field: dict) -> str:
    """Return human-readable label: label > name > id > placeholder."""
    return (
        field.get('label')
        or field.get('aria_label')
        or field.get('name')
        or field.get('id')
        or field.get('placeholder')
        or 'field'
    )


def _humanize_lifecycle_key(key: str) -> str:
    """'rationaleText' → 'Rationale Text' — a readable label for a spec-declared
    field that element-map never captured."""
    spaced = re.sub(r'(?<!^)(?=[A-Z])', ' ', key or '').replace('_', ' ').replace('-', ' ')
    return (spaced[:1].upper() + spaced[1:]).strip() or 'field'


_SELECTISH_KEY_RE = re.compile(
    r'combobox|dropdown|select|picker|(^|[-_ ])type($|[-_ ])|status|category|priority|'
    r'objective|role|kind|option|choice', re.I)
_DATEISH_KEY_RE = re.compile(r'date|deadline|time|expires|starts|ends|when', re.I)


def _lifecycle_widget(key: str, label: str, el: dict | None) -> str:
    """How a valid value must be entered: 'input' | 'textarea' | 'select' | 'datepicker'.

    element-map tags come first, but a name that clearly reads as a picker wins over
    tag='input' — a base-ui Combobox / shadcn Select renders as an <input>/<button>
    whose required-error only clears when an OPTION is chosen, so typing text into it
    would report a false stale-validation bug.
    """
    blob = f'{key} {label}'
    tag = (el or {}).get('tag', '')
    etype = (el or {}).get('type', '')
    if _DATEISH_KEY_RE.search(blob):
        return 'datepicker'
    if _SELECTISH_KEY_RE.search(blob) or tag == 'select' or etype == 'select' \
            or (el or {}).get('role') == 'combobox':
        return 'select'
    if tag == 'textarea' or etype == 'textarea':
        return 'textarea'
    return 'input'


def field_sample_value(field: dict, valid: bool = True) -> str:
    """Return a sample value for a field."""
    ftype = field.get('type', 'text')
    if not valid:
        if ftype in ('email',):
            return 'not-an-email'
        if ftype in ('tel',):
            return '12345'
        return 'X'  # too-short invalid value
    # A <select>'s valid value is one of its own options, never a typed string.
    if str(field.get('tag') or '').lower() == 'select' or ftype == 'select':
        for opt in (field.get('options') or []):
            o = str(opt).strip()
            if o and not re.match(r'^(select|choose|pick|--|none\b)', o, re.I):
                return o
    if ftype in ('text', 'textarea', '') :
        if sample := _formatted_sample(field.get('id') or field.get('name') or ''):
            return sample
    return DEFAULT_VALUES.get(ftype, 'ValidValue')


_FIELD_LABEL_ALIASES = {
    'name': 'spec-name',
    'bounded context': 'spec-bc',
    'bc': 'spec-bc',
    'feature': 'spec-feature',
    'feature id': 'spec-feature',
    'dependson': 'depends_on',
    'depends on': 'depends_on',
    'execution mode': 'execution-modes',
    'execution modes': 'execution-modes',
    'actor': 'actors',
    'actors': 'actors',
    'trigger': 'trigger',
    'precondition': 'preconditions',
    'preconditions': 'preconditions',
    'main flow': 'main-flow',
    'main flow step': 'main-flow',
    'acceptance criterion': 'acceptance-criteria',
    'acceptance criteria': 'acceptance-criteria',
    'acceptance': 'acceptance-criteria',
}


# Canonical keys for list-repeater style fields — values must be stored as lists.
_LIST_REPEATER_KEYS = {
    'actors', 'preconditions', 'main-flow', 'acceptance-criteria',
    'alternative-flows', 'execution-modes',
}


def extract_happy_path_data(spec: dict) -> dict:
    """Parse user_flow steps for 'Enter X in Y field' / 'Select X from Y dropdown' patterns.

    Gives happy-path TCs realistic test_data pulled from the spec, without needing
    element-map to expose required=True (shadcn/radix components don't).
    Field labels are mapped to canonical keys via spec.validations[].field and
    spec.boundary_constraints keys for consistency.
    """
    # Build canonical label → key map from spec's own field definitions
    canonical_keys: set[str] = set()
    for v in spec.get('validations', []):
        if v.get('field'):
            canonical_keys.add(v['field'].lower())
    for k in (spec.get('boundary_constraints') or {}).keys():
        canonical_keys.add(str(k).lower())

    label_aliases = dict(_FIELD_LABEL_ALIASES)
    # Canonical keys map to themselves so direct matches resolve
    for k in canonical_keys:
        label_aliases.setdefault(k, k)

    data: dict = {}
    # Each entry: (regex, value_group_idx, label_group_idx) — explicit indices
    # avoid ambiguity between "Select 'X' from Y dropdown" (value in g1) and
    # "Fill Y field with 'X'" (value in g2).
    scalar_patterns = [
        (re.compile(r"""enter\s+['\"]([^'\"]+)['\"]\s+(?:in|into)\s+(?:the\s+)?([a-z][\w \-]*?)\s+(?:field|input|box)""", re.I), 1, 2),
        (re.compile(r"""select\s+['\"]([^'\"]+)['\"]\s+from\s+(?:the\s+)?([a-z][\w \-]*?)\s+(?:dropdown|select|menu)""", re.I), 1, 2),
        (re.compile(r"""type\s+['\"]([^'\"]+)['\"]\s+(?:in|into)\s+(?:the\s+)?([a-z][\w \-]*?)\s+(?:field|input)""", re.I), 1, 2),
        # Fill Y field with 'X' — label first, value second
        (re.compile(r"""fill\s+(?:the\s+)?([a-z][\w \-]*?)\s+(?:field|input)\s+with\s+['\"]([^'\"]+)['\"]""", re.I), 2, 1),
        (re.compile(r"""fill\s+['\"]([^'\"]+)['\"]\s+(?:in|into)\s+(?:the\s+)?([a-z][\w \-]*?)\s+(?:field|input)""", re.I), 1, 2),
    ]
    # List-repeater / checkbox patterns — value appended to list
    list_patterns = [
        # Add '<value>' to Y list
        re.compile(r"""add\s+(?:[\w ]*?\s+)?['\"]([^'\"]+)['\"]\s+to\s+(?:the\s+)?([a-z][\w \-]*?)\s+list""", re.I),
        # Add <kind> '<value>' to Y list  (e.g. Add actor 'User' to Actors list)
        re.compile(r"""add\s+[a-z]+\s+['\"]([^'\"]+)['\"]\s+to\s+(?:the\s+)?([a-z][\w \-]*?)\s+list""", re.I),
        # Check 'X' execution mode checkbox  OR  Check 'X' checkbox
        re.compile(r"""check\s+['\"]([^'\"]+)['\"]\s+(?:execution mode\s+)?checkbox""", re.I),
    ]

    for uf in spec.get('user_flows', []):
        for step in uf.get('steps', []):
            action = step.get('action', '') if isinstance(step, dict) else str(step)
            if not action:
                continue
            matched_scalar = False
            for pat, v_idx, l_idx in scalar_patterns:
                m = pat.search(action)
                if not m:
                    continue
                value = m.group(v_idx)
                label = m.group(l_idx).strip().lower()
                key = label_aliases.get(label, label.replace(' ', '-'))
                if key in _LIST_REPEATER_KEYS:
                    data.setdefault(key, [])
                    if isinstance(data[key], list) and value not in data[key]:
                        data[key].append(value)
                else:
                    data.setdefault(key, value)
                matched_scalar = True
                break
            if matched_scalar:
                continue
            for pat in list_patterns:
                m = pat.search(action)
                if not m:
                    continue
                if len(m.groups()) == 1:
                    # Checkbox pattern → execution-modes list
                    value = m.group(1)
                    data.setdefault('execution-modes', [])
                    if value not in data['execution-modes']:
                        data['execution-modes'].append(value)
                else:
                    value, label = m.group(1), m.group(2).strip().lower()
                    key = label_aliases.get(label, label.replace(' ', '-'))
                    data.setdefault(key, [])
                    if isinstance(data[key], list) and value not in data[key]:
                        data[key].append(value)
                break
    return data


def valid_form_data(required_fields: list, optional_fields: list | None = None) -> dict:
    """Build a dict of field_name -> sample_value for all required fields."""
    data = {}
    for f in required_fields:
        name = f.get('name') or f.get('id') or field_label(f)
        data[name] = field_sample_value(f, valid=True)
    for f in (optional_fields or []):
        name = f.get('name') or f.get('id') or field_label(f)
        data[name] = field_sample_value(f, valid=True)
    return data


# ── Descriptive spec TC builder ───────────────────────────────────────────────

def _is_filter_button(btn: dict) -> bool:
    """Heuristic: short label, no concatenated metadata → likely a filter tab."""
    text = (btn.get('text') or '').strip()
    if not text or len(text) > 40:
        return False
    # Exclude shell chrome buttons (edition/tenant/profile/search)
    lower = text.lower()
    if any(kw in lower for kw in ('edition', 'command', 'search', 'northshore', '⌘')):
        return False
    # Exclude single/two-char buttons (profile initials like 'SC')
    if len(text) <= 2:
        return False
    # Exclude Select dropdown triggers — they contain ▼ / ⌄ / ▾ indicators,
    # or end with "..." / start with "All " (typical "All <entity>" placeholder).
    if any(ch in text for ch in ('▼', '⌄', '▾', '⌃')):
        return False
    # The "All <entity>" half of the rule above was documented here from the start
    # and never implemented, so a shadcn <Select> whose trigger renders its
    # placeholder as plain text — no ▼ glyph in the accessible name — was classified
    # as a filter TAB. On VIF-ACT-008 that put 'All Channels' (the ChannelSelect
    # placeholder) into TC-001's "Verify filter tabs are visible" step, which is a
    # false statement about the screen: it is a dropdown, not a tab.
    if lower.startswith('all '):
        return False
    # Exclude buttons whose text looks like a CTA (Set/Create/Add/New/Open/Save)
    # rather than a tab label — these have their own UF coverage.
    # `refresh`/`reload` join the list for the same reason 'retry' is already here:
    # a re-fetch control is an action, not a filter tab. 'Refresh' was the second
    # thing TC-001 mislabelled on VIF-ACT-008.
    cta_starters = ('set ', 'create ', 'add ', 'new ', 'open ', 'save ', 'submit',
                    'cancel', 'close', 'delete', 'edit ', 'update ', 'view ',
                    'apply ', 'retry', 'refresh', 'reload')
    if any(lower.startswith(p) for p in cta_starters):
        return False
    return True


def _is_task_row_button(btn: dict) -> bool:
    """Heuristic: button text contains concatenated task metadata (status, priority, time)."""
    text = (btn.get('text') or '').strip()
    if len(text) < 40:
        return False
    # Task rows typically contain multiple metadata tokens
    indicators = ['Urgent', 'High', 'Normal', 'Low', 'InProgress', 'Assigned',
                  'Config Error', 'Start Work', 'FormData', 'left', 'Zeebe', 'Manual']
    hits = sum(1 for ind in indicators if ind in text)
    return hits >= 2


def _extract_task_title(btn_text: str) -> str:
    """Extract the human-readable task title from a concatenated button text."""
    # Task title is at the start, before first metadata token
    for token in ['Zeebe', 'Manual', 'System']:
        idx = btn_text.find(token)
        if idx > 0:
            return btn_text[:idx].strip()
    return btn_text[:50].strip()


_MGI_SHELL_LABELS = frozenset({
    # MGI editions surfaced by the App Switcher dropdown.
    'dental', 'mission control', 'service console', 'builder console',
    # MGI product-line / workspace names rendered in the sidebar nav. These
    # are routes, not page-level filters — TCs targeting them belong to the
    # shell layer, not any feature spec.
    'cockpit', 'foundry', 'governance', 'tasks', 'releases',
    'strategy', 'actors', 'knowledge', 'command center',
})

# Class-attribute tokens that identify a button as part of the app shell
# (sidebar menu items, app-switcher dropdown rows). Class-based detection
# survives label renames — e.g. when "Dental" becomes "Dental v2".
_SHELL_CLASS_TOKENS = (
    'peer/menu-button', 'group/menu-button', 'data-sidebar',
    'sidebar-menu', 'sidebar-link', 'sidebar-accent',
)


def _is_shell_button(btn: dict) -> bool:
    """Heuristic: button is part of the app shell chrome (sidebar / app switcher / search)."""
    text = (btn.get('text') or '').strip().lower()
    if any(kw in text for kw in ('edition', 'command', 'northshore', 'search', '⌘')):
        return True
    # Exact platform-wide shell label match (editions + product-line nav).
    if text in _MGI_SHELL_LABELS:
        return True
    # Class-based: sidebar menu items keep their shell signature even when
    # the label is a generic word that the filter heuristic would otherwise
    # accept (e.g. "Dental", "Foundry").
    cls = (btn.get('class') or '').lower()
    if any(tok in cls for tok in _SHELL_CLASS_TOKENS):
        return True
    return False


# ── Screen→UI element keyword map (for state transition filtering) ──────────────
# Maps URL path patterns → list of keywords that appear in State Machine's
# "UI Element" column for transitions that belong to each screen.
_SCREEN_UI_KEYWORDS: dict[str, list[str]] = {
    '/tasks/mine':  ['my tasks', 'task detail action', 'form submit', 'ai chat'],
    '/tasks/team':  ['team tasks', 'team task', 'task detail'],
    '/cockpit':     ['cockpit', 'decision queue', 'decision detail', 'initiative'],
    '/dental':      ['follow-up', 'follow up', 'dental', 'case'],
    '/marketing':   ['campaign', 'marketing'],
    '/foundry':     ['venture', 'module', 'foundry'],
}
_BACKEND_ONLY_PATTERNS = ['zeebe', 'sla/system', 'sla/', 'sync listener']


def _build_dynamic_keywords(screen_name: str, em: dict) -> list[str]:
    """Build keyword list dynamically from screen name + element-map.

    Used when page_url doesn't match any entry in _SCREEN_UI_KEYWORDS.
    Extracts meaningful labels from buttons and links on the actual scanned page.
    """
    keywords: list[str] = [screen_name.lower()]
    # Individual words from screen name (len > 3) — e.g. 'Patient', 'List'
    keywords += [w.lower() for w in screen_name.split() if len(w) > 3]
    # Short, meaningful button labels (exclude shell chrome and task row blobs)
    for btn in em.get('buttons', []):
        text = (btn.get('text') or '').strip().lower()
        if 3 < len(text) <= 40 and not any(kw in text for kw in ('edition', 'command', 'search', '\u2318')):
            keywords.append(text)
    # Link labels (sidebar nav items, action links)
    for lk in em.get('links', []):
        text = (lk.get('text') or '').strip().lower()
        if 3 < len(text) <= 40:
            keywords.append(text)
    return keywords


def _transition_belongs_to_screen(ui_element: str, page_url: str, screen_name: str,
                                   em: dict | None = None) -> bool:
    """Return True if a state machine transition's UI element belongs to the current screen.

    Excludes pure backend/system actions (Zeebe, SLA). For known URL patterns, uses
    the curated _SCREEN_UI_KEYWORDS list. For unknown URLs, builds keywords dynamically
    from screen_name + element-map so no manual dict update is needed.
    """
    el = ui_element.lower()
    # Exclude backend / automated actions — no UI to click
    if any(p in el for p in _BACKEND_ONLY_PATTERNS):
        return False
    url_lower = page_url.lower()
    for pattern, keywords in _SCREEN_UI_KEYWORDS.items():
        if pattern in url_lower:
            return any(kw in el for kw in keywords)
    # Unknown URL: build keywords from element-map (no manual dict update needed)
    if em is not None:
        return any(kw in el for kw in _build_dynamic_keywords(screen_name, em))
    # Last resort: match screen name words only
    name_words = [w.lower() for w in screen_name.split() if len(w) > 2]
    return any(w in el for w in name_words)


def _find_matching_criterion(title: str, flow: str, criteria: list[str]) -> str | None:
    """Find the most relevant acceptance criterion for a TC by keyword overlap.

    Returns the criterion string if >= 2 meaningful words overlap, else None.
    """
    combined = (title + ' ' + flow.replace('-', ' ')).lower()
    words = set(re.findall(r'\b\w{4,}\b', combined))
    best: str | None = None
    best_score = 0
    for crit in criteria:
        crit_words = set(re.findall(r'\b\w{4,}\b', crit.lower()))
        score = len(words & crit_words)
        if score > best_score:
            best_score, best = score, crit
    return best if best_score >= 2 else None


def _find_active_screen(spec: dict, page_url: str) -> dict | None:
    """Find the screen definition that matches the current page URL."""
    for screen in spec.get('screens', []):
        name_lower = screen['name'].lower().replace(' ', '')
        url_lower = page_url.lower().replace(' ', '')
        # Match by screen name appearing in URL path
        if name_lower.replace(' ', '-') in url_lower or name_lower.replace(' ', '') in url_lower:
            return screen
        # Match common patterns: 'My Tasks' → '/tasks/mine', 'Team Tasks' → '/tasks/team'
        if 'my' in name_lower and 'task' in name_lower and '/tasks/mine' in url_lower:
            return screen
        if 'team' in name_lower and 'task' in name_lower and '/tasks/team' in url_lower:
            return screen
        if 'cockpit' in name_lower and '/cockpit' in url_lower:
            return screen
    return None


def _derive_uf_test_data(uf: dict, uf_step_actions: list[str]) -> dict:
    """Extract test_data from a user_flow's step actions.

    Parses quoted values out of steps like:
      "Fill Title 'X'"        → {'title': 'X'}
      "Select Cadence 'Y'"    → {'cadence': 'Y'}
      "Type 'X' into Title"   → {'title': 'X'}
    Then appends expected outcome / submit verb hint from the UF.
    """
    data: dict = {}
    quote_re = re.compile(r"['\"]([^'\"]+)['\"]")
    for act in uf_step_actions:
        if not isinstance(act, str):
            continue
        m_fill = re.search(r"\bfill\s+(?:the\s+)?(.+?)\s+(?:field\s+)?(?:with\s+)?['\"]([^'\"]+)['\"]", act, re.IGNORECASE)
        m_select = re.search(r"\bselect\s+(.+?)\s+['\"]([^'\"]+)['\"]", act, re.IGNORECASE)
        m_type = re.search(r"\btype\s+['\"]([^'\"]+)['\"]\s+into\s+(?:the\s+)?(.+?)(?:\s+field)?$", act, re.IGNORECASE)
        if m_fill:
            label = m_fill.group(1).strip()
            value = m_fill.group(2).strip()
            data[label] = value
        elif m_select:
            label = m_select.group(1).strip()
            value = m_select.group(2).strip()
            data[label] = value
        elif m_type:
            value = m_type.group(1).strip()
            label = m_type.group(2).strip()
            data[label] = value
    if uf.get('expected_outcome'):
        data['expected_outcome'] = uf['expected_outcome']
    return data


def _derive_val_test_data(val: dict, val_field: str, val_kind: str,
                          err_msg: str, skip_reason: str | None) -> dict:
    """Build a structured test_data dict for a VAL-xxx negative TC.

    Captures: precondition (from cross-field "when X = Y"), the violating value,
    the expected exact error message, and any rule reference.
    """
    data: dict = {}
    desc = (val.get('description') or '')
    # Cross-field precondition: parse "when X = Y" or "when ≥1 X exists"
    if val_kind == 'cross-field':
        m_eq = re.search(r"when\s+([A-Za-z][A-Za-z0-9 ]*?)\s*[=≠]\s*([A-Za-z][A-Za-z0-9 ]*)", desc, re.IGNORECASE)
        m_ge = re.search(r"when\s+(?:≥|>=?)\s*\d+\s+(.+?)\s+(?:exists|provided|appended)", desc, re.IGNORECASE)
        if m_eq:
            data[f'precondition_{m_eq.group(1).strip()}'] = m_eq.group(2).strip()
        elif m_ge:
            data['precondition'] = f"Add at least one {m_ge.group(1).strip()}"
    # Violating value per constraint kind
    if val_kind == 'required':
        data[val_field] = '  // empty / cleared'
    elif val_kind == 'format' and re.search(
        r'(?:>\s*0\b|greater\s+than\s+0|must\s+be\s+>\s*0|positive\s+(?:number|value|integer))',
        desc.lower(),
    ):
        data[val_field] = '0'
    elif val_kind == 'format' or val_kind == 'min-max':
        # maxLength rule or out-of-bounds
        m_max = re.search(r'max(?:imum)?\s+length\s+(\d+)|maxlength\s*=\s*\{?(\d+)', desc, re.IGNORECASE)
        if m_max:
            cap = m_max.group(1) or m_max.group(2)
            data[f'{val_field}_input'] = f"X x {int(cap) + 50}  // typed beyond cap"
            data['expected_value_after_fill'] = f"X x {cap}  // HTML5 maxLength caps at {cap}"
            data['rule'] = f"maxLength={cap}"
        else:
            data[val_field] = '<invalid value per spec>'
    elif val_kind == 'cross-field':
        data[val_field] = '  // empty / cleared'
    else:
        data[val_field] = '<invalid value per spec>'
    if err_msg:
        data['expected_error'] = err_msg
    if skip_reason:
        data['skip_reason'] = skip_reason
    if val.get('id'):
        data['rule_id'] = val['id']
    return data


def build_descriptive_test_cases(spec: dict, em: dict) -> list[dict]:
    """Build test cases from a descriptive spec (no UF/VAL/BR/UI rule IDs).

    Uses element-map as primary source of truth for what's on the page,
    enriched by spec screens/states/entities for context.
    """
    tcs: list[dict] = []
    n = 1
    # Prefer the real live URL (from --page-url arg) over the local capture file path
    page_url = em.get('_real_page_url') or em.get('source_url', '')
    buttons = em.get('buttons', [])
    links = em.get('links', [])

    # Read spec.testing_scope.excluded_shell_elements and build an exclusion set
    # (case-insensitive substring + exact match). Any button/link whose label
    # matches is treated as app-shell chrome and removed from feature TC generation.
    _ts = spec.get('testing_scope') or {}
    excluded_raw = _ts.get('excluded_shell_elements') or []
    excluded_norm = {str(s).strip().lower() for s in excluded_raw
                     if isinstance(s, (str,)) and '[MISSING' not in s}
    # Always-shell labels — common across the platform
    excluded_norm.update({'home', 'toggle sidebar', 'notifications', 'app switcher',
                          'user avatar', 'search', 'command', '⌘'})

    def _is_excluded_label(text: str) -> bool:
        if not text:
            return False
        t = text.strip().lower()
        if not t:
            return False
        # Email-like user labels (e.g. "MV Minh Vo minh.vo@mgisolutions.com")
        if '@' in t and '.' in t:
            return True
        # Exact / substring match against spec exclusions
        for ex in excluded_norm:
            if ex and (ex == t or ex in t or t in ex):
                return True
        return False

    # Page-feature link hrefs come from spec.page_url — treat all other internal
    # nav links as shell (sidebar/nav router), not feature.
    _page_url_norm = (spec.get('page_url') or page_url or '').lstrip('/').lower()

    def _is_shell_nav_link(lk: dict) -> bool:
        href = (lk.get('href') or '').strip().lstrip('/').lower()
        text = (lk.get('text') or '').strip()
        if not href:
            return False
        # Same page = not a nav-away link
        if href == _page_url_norm:
            return False
        # External or anchor = not shell
        if href.startswith('http') or href.startswith('#'):
            return False
        if _is_excluded_label(text):
            return True
        # All other in-app routes are sidebar nav → shell
        return True

    # Detect row-action buttons: a label appearing >2 times across all buttons
    # is almost certainly a per-row action (View / Edit / Delete / Approve)
    # rendered once per table row, NOT a filter tab. Excluding them here
    # prevents TC-001 from emitting noisy steps like
    # "Verify filter tabs are visible: 'View', 'View', 'View', 'View', 'View'".
    from collections import Counter
    _btn_text_counts = Counter((b.get('text') or '').strip() for b in buttons)
    _row_action_labels = {t for t, c in _btn_text_counts.items() if t and c > 2}

    # Classify buttons (apply spec-driven exclusion + shell exclusion + row-action
    # exclusion). A button may pass the filter heuristic on text alone but still
    # be a shell element (App Switcher dropdown) or a row-action repeated per row.
    filter_buttons = [b for b in buttons
                      if _is_filter_button(b)
                      and not _is_excluded_label(b.get('text', ''))
                      and not _is_shell_button(b)
                      and (b.get('text') or '').strip() not in _row_action_labels]
    task_row_buttons = [b for b in buttons if _is_task_row_button(b)]
    shell_buttons = [b for b in buttons if _is_shell_button(b)
                     or _is_excluded_label(b.get('text', ''))]
    profile_buttons = [b for b in buttons if len((b.get('text') or '').strip()) <= 2
                       and (b.get('text') or '').strip().isalpha()]

    # Find matching screen in spec
    active_screen = _find_active_screen(spec, page_url)
    screen_name = active_screen['name'] if active_screen else spec['title']
    screen_ref = f'{active_screen["id"]} — {active_screen["name"]}' if active_screen else spec['title']
    screen_states = active_screen['states'] if active_screen else []

    def tc(title, flow, priority, spec_ref, precondition, steps, expected,
           test_data: dict | None = None, spec_only: bool = False,
           skip_reason: str | None = None, no_auth: bool = False,
           assertions: list | None = None, step_responses: list | None = None,
           step_assertions: list | None = None):
        nonlocal n
        rec = {
            'id': n, 'title': title, 'flow': flow,
            'page': page_url, 'priority': priority,
            'spec_ref': spec_ref, 'precondition': precondition,
            'steps': steps, 'expected': expected,
            'test_data': test_data, 'spec_only': spec_only,
            'assertions': assertions or [],
            'step_responses': step_responses or [],
            'step_assertions': step_assertions or [],
        }
        if skip_reason:
            rec['skip_reason'] = skip_reason
        if no_auth:
            rec['no_auth'] = True
        tcs.append(rec)
        n += 1

    # ── 1. Page load + layout verification ──
    verify_steps = [f'Navigate to {page_url}']
    expected_parts = [f'{screen_name} page loads']
    if task_row_buttons:
        verify_steps.append('Verify the task list section is rendered')
        expected_parts.append('task rows are visible')
    if filter_buttons:
        verify_steps.append(f'Verify filter tabs are visible: {", ".join(repr(b["text"]) for b in filter_buttons[:5])}')
        expected_parts.append('filter tabs are rendered')
    # This TC is built from the ELEMENT MAP, so unlike every other builder it has no
    # spec section to carry an `assert:` block off — and it was therefore the one TC
    # left rendering with an empty body after the oracle contract landed: its steps
    # are prose the Step 6 translator does not map, so they became bare `// Step:`
    # comments and the test reported PASS whatever the app did. It is TC-001 of every
    # suite, which is the worst possible place for a silent green.
    #
    # The oracle below is the strongest one that is genuinely SPEC-DERIVED here.
    # `page_url` is the VIF's own `**Route:**`, and asserting the browser actually
    # came to rest on it is not a formality: it fails exactly the two ways a page-load
    # TC can lie — an auth/tenant redirect landing on /auth/signin or /unauthorized
    # and reading as a product defect, and a `**Route:**` that was machine-guessed
    # wrong (~8 of 20 across the corpus, #148133) so the suite tests a different
    # screen than the one it names. The screen's own copy is NOT asserted here on
    # purpose: `screens[].name` is a label for the screen, not a promise about
    # rendered text, and asserting it would be inventing an oracle the VIF never gave.
    tc(
        title=f'{screen_name} page loads with expected layout',
        flow='main-flow', priority='High', spec_ref=screen_ref,
        precondition='User is authenticated',
        steps=verify_steps,
        expected='; '.join(expected_parts),
        test_data={'note': 'No input — page-load + layout assertion only'},
        assertions=[{'url': to_relative_url(page_url) or '/'}],
    )

    # ── 2. Task row metadata verification (if task rows exist) ──
    for btn in task_row_buttons[:2]:  # first 2 tasks for detail check
        task_title = _extract_task_title(btn['text'])
        tc(
            title=f'Task row displays metadata — {task_title}',
            flow='main-flow', priority='High', spec_ref=screen_ref,
            precondition='User is authenticated and has assigned tasks',
            steps=[
                f'Navigate to {page_url}',
                f'Locate the task row containing \'{task_title}\'',
                'Verify row shows source, status badge, priority badge, and time remaining',
            ],
            expected=f'Task row \'{task_title}\' displays all expected metadata columns',
        )

    # ── 3. Task row click → detail screen ──
    if task_row_buttons:
        first_task = _extract_task_title(task_row_buttons[0]['text'])
        tc(
            title=f'Click task row opens task detail — {first_task}',
            flow='main-flow', priority='High', spec_ref=screen_ref,
            precondition='User is authenticated',
            steps=[
                f'Navigate to {page_url}',
                f'Click the task row containing \'{first_task}\'',
                'Verify URL changes or detail view opens',
            ],
            expected=f'Task detail screen opens for \'{first_task}\'',
        )

    # ── 4. Filter / tab interaction ──
    # Skip when the button label already appears in a user_flow step — the UF
    # will produce a proper happy-path TC for that interaction; emitting a
    # generic "filter" TC just adds noise and mislabels the semantics.
    _uf_step_text_lower = ' '.join(
        (s.get('action', '') if isinstance(s, dict) else str(s)).lower()
        for uf in spec.get('user_flows', []) for s in uf.get('steps', [])
    )
    for btn in filter_buttons:
        btn_text = btn['text'].strip()
        if btn_text.lower() in _uf_step_text_lower:
            continue
        tc(
            title=f'Filter tasks by \'{btn_text}\' tab',
            flow='interaction', priority='High' if btn_text.lower() in ('due soon', 'config error', 'overdue') else 'Medium',
            spec_ref=screen_ref,
            precondition='User is authenticated',
            steps=[
                f'Navigate to {page_url}',
                f'Click the \'{btn_text}\' filter button',
                'Verify the task list updates or filter is visually active',
            ],
            expected=f'\'{btn_text}\' filter is applied; task list reflects the filter',
        )

    # ── 5. Sidebar navigation links ──
    # SKIP entirely when the spec declares excluded_shell_elements — feature TCs
    # should not validate the app shell router. If a feature genuinely needs a
    # nav-link TC, it must be added to user_flows in the spec YAML.
    nav_links = [] if excluded_raw else [
        lk for lk in links if lk.get('href')
        and lk['href'] not in (page_url, '/' + page_url.lstrip('/'))
        and not _is_shell_nav_link(lk)
    ]
    for lk in nav_links[:5]:
        link_text = lk['text']
        link_href = lk['href']
        tc(
            title=f'Navigate to \'{link_text}\' via sidebar',
            flow='navigation', priority='Medium', spec_ref='Shell — Sidebar',
            precondition='User is authenticated',
            steps=[
                f'Navigate to {page_url}',
                f'Click the sidebar link \'{link_text}\'',
                f'Verify URL contains \'{link_href}\'',
            ],
            expected=f'Browser navigates to \'{link_href}\'; \'{link_text}\' page loads',
        )

    # ── 6. Shell chrome elements ──
    # SKIP when spec declares excluded_shell_elements — shell is out of scope.
    if shell_buttons and not excluded_raw:
        edition_btn = next((b for b in shell_buttons if 'edition' in b['text'].lower()), None)
        if edition_btn:
            tc(
                title='Shell — edition switcher is visible and interactive',
                flow='shell', priority='Medium', spec_ref='Shell — Edition Switcher',
                precondition='User is authenticated',
                steps=[
                    f'Navigate to {page_url}',
                    f'Verify edition switcher button is visible with text \'{edition_btn["text"]}\'',
                    'Click the edition switcher',
                    'Verify a dropdown or popover opens',
                ],
                expected='Edition switcher is rendered and opens on click',
            )

    # Tenant button (e.g. "Northshore") — skip when excluded
    tenant_btn = None if excluded_raw else next((b for b in buttons
                       if (b.get('text') or '').strip().lower() in ('northshore',)
                       or (b.get('id') or '').endswith('_e_')), None)
    if tenant_btn and tenant_btn['text'].strip():
        tc(
            title=f'Shell — tenant indicator shows \'{tenant_btn["text"].strip()}\'',
            flow='shell', priority='Medium', spec_ref='Shell — Tenant',
            precondition='User is authenticated',
            steps=[
                f'Navigate to {page_url}',
                f'Verify top bar shows tenant name \'{tenant_btn["text"].strip()}\'',
            ],
            expected=f'Tenant \'{tenant_btn["text"].strip()}\' is displayed in the shell top bar',
        )

    # Profile button (short alpha text like 'SC') — skip when excluded
    if profile_buttons and not excluded_raw:
        pb = profile_buttons[0]
        tc(
            title=f'Shell — profile button \'{pb["text"].strip()}\' opens menu',
            flow='shell', priority='Low', spec_ref='Shell — Profile',
            precondition='User is authenticated',
            steps=[
                f'Navigate to {page_url}',
                f'Click the profile button \'{pb["text"].strip()}\'',
                'Verify a profile menu or popover opens',
            ],
            expected='Profile menu opens with account actions',
        )

    # ── 7. Screen state tests from spec (Empty, Error, Loading) ──
    for state in screen_states:
        state_lower = state.lower()
        if state_lower == 'default':
            continue  # already covered by page load TC
        if 'empty' in state_lower:
            tc(
                title=f'{screen_name} — empty state displays no-data message',
                flow='state', priority='Medium', spec_ref=f'{screen_ref} — {state}',
                precondition='User is authenticated and has no assigned tasks',
                steps=[
                    f'Navigate to {page_url} (with no data)',
                    'Verify empty state message is displayed',
                ],
                expected='Empty state shows a clear message and next-step guidance',
                spec_only=True,
            )
        elif 'error' in state_lower and 'config' not in state_lower:
            tc(
                title=f'{screen_name} — error state shows recovery actions',
                flow='state', priority='Medium', spec_ref=f'{screen_ref} — {state}',
                precondition='Backend returns error for this page',
                steps=[
                    f'Navigate to {page_url} (simulated error)',
                    'Verify error state is displayed',
                    'Verify recovery action (retry button) is visible',
                ],
                expected='Error state renders with plain-language message and retry path',
                spec_only=True,
            )
        elif 'loading' in state_lower:
            tc(
                title=f'{screen_name} — loading skeleton is shown while data loads',
                flow='state', priority='Low', spec_ref=f'{screen_ref} — {state}',
                precondition='Page is loading',
                steps=[
                    f'Navigate to {page_url} (throttled network)',
                    'Verify skeleton/loading placeholders are displayed',
                ],
                expected='Loading skeleton preserves page layout while data loads',
                spec_only=True,
            )
        elif 'config' in state_lower and 'error' in state_lower:
            tc(
                title=f'{screen_name} — config error row is visually distinct',
                flow='state', priority='Medium', spec_ref=f'{screen_ref} — {state}',
                precondition='A task has a config error (missing form definition)',
                steps=[
                    f'Navigate to {page_url}',
                    'Locate a task row with Config Error status',
                    'Verify it shows a warning indicator and disabled form area',
                ],
                expected='Config error task is distinguishable; form area is disabled with admin link',
                spec_only=True,
            )
        else:
            tc(
                title=f'{screen_name} — \'{state}\' state renders correctly',
                flow='state', priority='Medium', spec_ref=f'{screen_ref} — {state}',
                precondition='User is authenticated',
                steps=[
                    f'Navigate to {page_url}',
                    f'Trigger or navigate to \'{state}\' state',
                    'Verify layout and content match spec',
                ],
                expected=f'\'{state}\' state renders per spec description',
                spec_only=True,
            )

    # ── 8. State machine transitions for this screen ──
    for transition in spec.get('state_transitions', []):
        ui_el   = transition.get('ui_element', '')
        current = transition.get('current', '')
        action  = transition.get('action', '')
        next_st = transition.get('next', '')

        if not _transition_belongs_to_screen(ui_el, page_url, screen_name, em):
            continue

        # Parse "Entity: status" format (e.g. "UserTask: assigned" → entity="UserTask", cur_status="assigned")
        entity     = current.split(':', 1)[0].strip() if ':' in current else 'Task'
        cur_status = current.split(':', 1)[1].strip() if ':' in current else current
        nxt_status = next_st.split(':', 1)[1].strip() if ':' in next_st else next_st

        # Handle compound current statuses like "assigned / claimed / in_progress"
        if '/' in cur_status:
            status_parts = [s.strip() for s in cur_status.split('/')]
            cur_label = ' / '.join(status_parts)
        else:
            cur_label = cur_status

        # Build step list — inject the right prelude based on which container holds
        # the UI element. Most actions live inside a Sheet/Detail panel that requires
        # a row click first. Pattern-match the ui_element string for common containers.
        _transition_steps = [
            f'Navigate to {page_url}',
        ]
        ui_lower = ui_el.lower()
        # Container detection — order matters (most specific first)
        if re.search(r'detail.?sheet|inline form|update.*sheet|edit.*sheet', ui_lower):
            _transition_steps += [
                f'Locate a row representing a {entity} with status "{cur_label}"',
                'Click the row\'s "View" / "Detail" action to open the detail sheet',
                f'Inside the detail sheet, perform: {action} (via {ui_el})',
            ]
        elif re.search(r'task detail|form submit|ai.?chat', ui_lower):
            _transition_steps += [
                f'Locate a {entity} with status "{cur_label}"',
                'Click the first task row to open task detail',
                f'Perform action "{action}" via {ui_el}',
            ]
        elif re.search(r'set.*sheet|new.*sheet|create.*sheet|setgoalform|new goal|set goal', ui_lower):
            # Action is "create from form" — open the create sheet first
            _transition_steps += [
                'Click the page header create/set button to open the form sheet',
                f'Fill required fields, then perform: {action} (via {ui_el})',
            ]
        elif re.search(r'dialog|confirm', ui_lower):
            _transition_steps += [
                f'Locate a row representing a {entity} with status "{cur_label}"',
                'Open the row detail and trigger the action that opens the confirm dialog',
                f'Confirm the dialog to perform: {action} (via {ui_el})',
            ]
        else:
            _transition_steps += [
                f'Locate a {entity} with status "{cur_label}"',
                f'Perform action "{action}" via {ui_el}',
            ]
        _transition_steps.append(f'Verify the {entity} status has changed to "{nxt_status}"')

        tc(
            title=f'State transition — {action}: [{cur_label}] → [{nxt_status}]',
            flow='state-transition',
            priority='High',
            spec_ref=f'STATE-{action.upper().replace(" ", "-")}',
            precondition=f'User is authenticated; {entity} is in "{cur_label}" status',
            steps=_transition_steps,
            expected=(
                f'{entity} status changes from "{cur_label}" to "{nxt_status}"; '
                f'UI reflects the updated state without full page refresh'
            ),
        )

    # ── 9. User flows from spec.yaml — happy path per UF-xxx ──
    # spec-template.yaml defines user_flows with expected_outcome.
    # Generate one Positive TC per UF that doesn't duplicate an existing element-map TC.
    existing_titles_lower = {t['title'].lower() for t in tcs}
    for uf in spec.get('user_flows', []):
        uf_id   = uf.get('id', 'UF-?')
        uf_name = uf.get('name', '')
        uf_outcome = uf.get('expected_outcome', '') or f'{uf_name} completes successfully'
        uf_actor = uf.get('actor', default_role if (default_role := spec.get('default_role', '')) else 'authenticated_user')
        uf_preconds = uf.get('preconditions', ['User is authenticated'])
        uf_steps = uf.get('steps', [])

        # Build step list from spec flow definition, carrying the authored
        # per-step oracle (`system_response`) and any structured `assert:` block
        # alongside it. Both used to be dropped here, which is why every UF happy
        # path rendered as a body with no expect() at all.
        step_actions = []
        step_responses = []
        step_assertions = []
        for s in uf_steps:
            if isinstance(s, dict):
                step_actions.append(s.get('action', ''))
                step_responses.append(str(s.get('system_response') or ''))
                step_assertions.append(list(s.get('assert') or []))
            elif isinstance(s, str):
                step_actions.append(s)
                step_responses.append('')
                step_assertions.append([])
        # Ensure navigate step is first
        if not step_actions or not any('navigate' in a.lower() or 'go to' in a.lower() for a in step_actions):
            step_actions = [f'Navigate to {page_url}'] + step_actions
            step_responses = [''] + step_responses
            step_assertions = [[]] + step_assertions

        # Inject open-task-detail step when UF entry point is inside task detail (requires row click first)
        if re.search(r'task detail|detail screen', uf.get('entry_point', ''), re.IGNORECASE):
            nav_idx = next((i for i, a in enumerate(step_actions) if 'navigate' in a.lower()), -1)
            already_has_row_click = any('task row' in a.lower() or 'open task detail' in a.lower() for a in step_actions)
            if nav_idx >= 0 and not already_has_row_click:
                step_actions.insert(nav_idx + 1, 'Click the first task row to open task detail')

        # Skip if a very similar TC was already built from element-map
        candidate_title = f'Happy path — {uf_id}: {uf_name}'
        if any(uf_name.lower() in t for t in existing_titles_lower):
            continue

        tc(
            title=candidate_title,
            flow=uf_id,
            priority='High',
            spec_ref=uf_id,
            precondition='; '.join(uf_preconds) if uf_preconds else 'User is authenticated',
            steps=step_actions,
            expected=uf_outcome,
            spec_only=False,
            test_data=_derive_uf_test_data(uf, step_actions),
            assertions=list(uf.get('assert') or []),
            step_responses=step_responses,
            step_assertions=step_assertions,
        )

    # ── 9b. Validations from spec.yaml — one negative TC per VAL-xxx ──
    # Build a "form-opening" prelude from user_flows: find the UF whose steps
    # mention this validation's container (Set Goal / Update / Create form),
    # then borrow its open-the-form steps. Fallback: derive from button labels.
    def _val_prelude_steps(val_field: str, val_desc: str) -> list[str]:
        """Return steps that navigate to the form containing the field under test."""
        steps: list[str] = [f'Navigate to {page_url}']
        # Heuristic: look for a UF whose form contains the field name in any step
        for uf in spec.get('user_flows', []):
            uf_steps = uf.get('steps', []) or []
            uf_step_actions = []
            for s in uf_steps:
                if isinstance(s, dict):
                    uf_step_actions.append(s.get('action', ''))
                elif isinstance(s, str):
                    uf_step_actions.append(s)
            # If any UF step mentions this field, borrow the prelude (steps up to but
            # not including the one that mentions the field's positive happy-path value)
            joined = ' '.join(uf_step_actions).lower()
            if val_field.lower() in joined:
                # Borrow the click/open step(s) — heuristically the first 1-2 actions
                # before the "fill {field}" step
                for act in uf_step_actions:
                    if val_field.lower() in act.lower():
                        break
                    # Skip duplicate "Navigate to ..." since we already added it
                    if 'navigate' in act.lower():
                        continue
                    steps.append(act)
                return steps
        # Fallback: look for a "Set/Open/Create" button label in element-map.
        # Skip shell/nav labels first — a sidebar item like "New Patients" matches the
        # "new " keyword but is app-shell chrome, not the form opener (excluded_shell_elements).
        for btn in buttons:
            btn_text = (btn.get('text') or '').strip()
            if _is_excluded_label(btn_text) or _is_shell_button(btn):
                continue
            if any(kw in btn_text.lower() for kw in ('set new', 'create', 'add new', 'new ')):
                steps.append(f"Click '{btn_text}' button to open the form")
                break
        return steps

    for val in spec.get('validations', []):
        val_id    = val.get('id', 'VAL-?')
        val_desc  = val.get('description', '')
        val_field = val.get('field', 'field')
        val_kind  = (val.get('constraint') or '').strip().lower()
        err_msgs  = [m for m in val.get('error_messages', []) if '[MISSING' not in m]
        err_msg   = err_msgs[0] if err_msgs else ''
        # Concrete trigger step per constraint kind — phrased so the script
        # translator (generate_scripts.py) can parse it without extra hints.
        #
        # HTML5-aware detection: when the description text reveals the rule is
        # already enforced by a native HTML attribute (`maxLength`, `type="number"`
        # with min=N), the dumb sentinel pattern would never trip the rule. Emit
        # a more specific step so the translator can pick the right pattern,
        # or flag the TC as a known-skip when no Playwright pattern can exercise
        # the constraint via the UI.
        desc_low = (val_desc or '').lower()
        skip_reason = None
        if val_kind == 'required':
            trigger_step = f"Clear the {val_field} field"
        elif val_kind == 'min-max':
            trigger_step = f"Fill the {val_field} field with an out-of-bounds value"
        elif val_kind == 'format':
            # Sub-case A: numeric "> 0" / "greater than 0" / "positive" rule.
            # Filling with 'X' fails (number input rejects); filling with '0'
            # is what actually trips the validate() rule.
            # Match the > 0 / "greater than 0" / "positive number|value" rules
            # only — bare `>` was too loose (it matched HTML self-closing tags
            # like `<Input maxLength={100} />`, falsely tripping the zero branch
            # for VAL-002B-style maxLength rules).
            if re.search(r'(?:>\s*0\b|greater\s+than\s+0|must\s+be\s+>\s*0|positive\s+(?:number|value|integer))', desc_low):
                trigger_step = f"Fill the {val_field} field with zero"
            # Sub-case B: maxLength rule with HTML5 `maxLength` attr present.
            # The browser truncates input at the cap → rule never fires via .fill().
            # Mark the TC for skip so the report shows a typed reason instead of
            # a 30s timeout.
            elif re.search(r'maxlength\s*=\s*\{?\d', desc_low) or 'maxlength={' in desc_low:
                trigger_step = f"Attempt to fill {val_field} beyond max length"
                skip_reason = (
                    f"HTML5_MAXLENGTH: <Input maxLength=N> truncates input at N; "
                    f"the RHF maxLength rule never fires via .fill() — cannot be "
                    f"automated. Manual test only."
                )
            else:
                trigger_step = f"Fill the {val_field} field with an invalid value"
        elif val_kind == 'cross-field':
            trigger_step = f"Fill the {val_field} field violating the cross-field rule"
        else:
            trigger_step = f"Fill the {val_field} field with an invalid value"

        steps = _val_prelude_steps(val_field, val_desc)
        steps.append(trigger_step)
        # Emit a generic submit step — the script translator picks the actual
        # button via `button[type="submit"]` rather than a hardcoded label.
        # (Prior versions emitted "Click the 'Set Goal' button" which leaked into
        #  Playwright as a fake /set goal/i selector.)
        steps.append("Click the submit button")
        if err_msg:
            steps.append(f"Verify error message \"{err_msg}\" appears near '{val_field}'")
            expected = (
                f"Submit is blocked OR inline error \"{err_msg}\" is visible "
                f"under '{val_field}'."
            )
        else:
            steps.append(f"Verify the form blocks submit and indicates the error on '{val_field}'")
            expected = (
                f"Submit is blocked and the form surfaces an invalid-input indicator on '{val_field}' "
                f"per spec {val_id}."
            )
        tc_kwargs = dict(
            title=f'{val_id} — {val_desc}',
            flow='validation',
            priority='High',
            spec_ref=val_id,
            precondition='User is authenticated',
            steps=steps,
            expected=expected,
            # VAL TCs now have concrete, executable steps — they run client-side
            # against the real form, no API mock needed. Marking spec_only=False
            # so generate_scripts.py emits real Playwright code instead of test.skip().
            spec_only=False,
            test_data=_derive_val_test_data(val, val_field, val_kind, err_msg, skip_reason),
        )
        if skip_reason:
            tc_kwargs['skip_reason'] = skip_reason
        tc(**tc_kwargs)

        # Whitespace-trim sibling: when VAL has constraint='required' AND the
        # description explicitly mentions trim/trimmed, emit a boundary-case TC
        # that fills the field with whitespace-only input. This catches the
        # difference between empty-string ("") and whitespace-only ("   ") —
        # the trim rule exists precisely to reject the latter.
        if val_kind == 'required' and re.search(r'\btrim(?:med)?\b', desc_low):
            ws_steps = _val_prelude_steps(val_field, val_desc)
            ws_steps.append(f"Fill {val_field} with whitespace-only value '   ' (3 spaces)")
            ws_steps.append("Click the submit button")
            if err_msg:
                ws_steps.append(f"Verify error message \"{err_msg}\" appears near '{val_field}' (whitespace treated as empty after trim)")
                ws_expected = (
                    f"Submit is blocked OR inline error \"{err_msg}\" is visible "
                    f"under '{val_field}' — whitespace-only input fails required check after trim."
                )
            else:
                ws_steps.append(f"Verify the form blocks submit and indicates the error on '{val_field}'")
                ws_expected = (
                    f"Whitespace-only input is rejected on '{val_field}' (trim rule per spec {val_id})."
                )
            tc(
                title=f'{val_id} (whitespace) — {val_field} whitespace-only treated as empty (trim rule)',
                flow='validation',
                priority='High',
                spec_ref=val_id,
                precondition='User is authenticated',
                steps=ws_steps,
                expected=ws_expected,
                spec_only=False,
                test_data={
                    val_field: "'   '  // 3 whitespace chars, should be trimmed to empty",
                    'expected_error': err_msg or '(field-level required indicator)',
                    'rule': f'{val_id} trim then required',
                },
            )

        # JSON-array type-check sibling (G2): when a VAL rule requires a JSON
        # ARRAY, emit an extra TC that fills the field with VALID JSON that is
        # NOT an array (an object). This is distinct from "invalid JSON" — it
        # proves the rule enforces Array.isArray(...), not merely JSON.parse()
        # success. A generic invalid sentinel like "{not-array}" fails BOTH the
        # parse AND the array check at once, so it cannot tell the two rules
        # apart and a parse-only implementation would slip through untested.
        if re.search(r'json\s+array', desc_low) or ('json' in desc_low and 'array' in desc_low):
            na_steps = _val_prelude_steps(val_field, val_desc)
            na_steps.append(f"Fill {val_field} with a non-array JSON value")
            na_steps.append("Click the submit button")
            if err_msg:
                na_steps.append(f"Verify error message \"{err_msg}\" appears near '{val_field}' (valid JSON, but not an array)")
                na_expected = (
                    f"Submit is blocked OR inline error \"{err_msg}\" is visible under '{val_field}' "
                    f"— parseable JSON that is not an array is rejected (Array.isArray is enforced)."
                )
            else:
                na_steps.append(f"Verify the form blocks submit and indicates the error on '{val_field}'")
                na_expected = (
                    f"Parseable-but-non-array JSON is rejected on '{val_field}' per spec {val_id} "
                    f"(proves Array.isArray, not just JSON.parse)."
                )
            tc(
                title=f'{val_id} (not-array) — {val_field}: valid JSON that is NOT an array is rejected',
                flow='validation',
                priority='High',
                spec_ref=val_id,
                precondition='User is authenticated',
                steps=na_steps,
                expected=na_expected,
                spec_only=False,
                test_data={
                    val_field: '{"_":1}  // valid JSON object — parses, but Array.isArray is false',
                    'expected_error': err_msg or '(field-level JSON-array indicator)',
                    'rule': f'{val_id} json-array type check',
                },
            )

    # ── 9c. Permission-denied UI TC ──
    # Emit when spec.business_rules or spec.acceptance_criteria mention a
    # permission rule paired with a UI consequence (destructive Alert, submit
    # disabled, "without permission", "lacks permission").
    _all_rule_text = ' '.join([
        (br.get('description', '') if isinstance(br, dict) else str(br))
        for br in spec.get('business_rules', [])
    ] + [
        (ac if isinstance(ac, str) else ac.get('description', ''))
        for ac in spec.get('acceptance_criteria', [])
    ]).lower()
    _perm_signal = ('permission' in _all_rule_text or 'authoriz' in _all_rule_text)
    _ui_signal = ('alert' in _all_rule_text or 'disabled' in _all_rule_text or 'forbidden' in _all_rule_text)
    if _perm_signal and _ui_signal:
        # Find the BR id that mentions permission, if any, for spec_ref traceability
        perm_br_id = 'BR-permission'
        for br in spec.get('business_rules', []):
            if isinstance(br, dict) and 'permission' in (br.get('description', '') or '').lower():
                perm_br_id = br.get('id', perm_br_id)
                break
        tc(
            title='Permission denied — authenticated user without create permission sees destructive Alert and disabled submit',
            flow='permission',
            priority='High',
            spec_ref=perm_br_id,
            precondition='User authenticated but role does NOT hold the create permission for this feature',
            steps=[
                'Sign in as a user whose role lacks the create permission (e.g. Viewer / Member without grant)',
                f'Navigate to {page_url}',
                "Verify destructive Alert with text containing 'permission' or 'not authorized' is visible at top of form",
                "Verify the primary submit button is disabled (aria-disabled=true or disabled attribute)",
            ],
            expected='Destructive Alert visible AND submit disabled — user cannot complete the action without permission.',
            spec_only=False,
            test_data={
                'auth_role': 'Role without the feature-create permission',
                'expected_alert_role': 'alert (variant=destructive)',
                'expected_alert_text_contains': 'permission OR not authorized',
                'submit_button_state': 'disabled',
            },
        )

    # ── 9d. API error handling TC ──
    # Emit when spec has at least one happy-path UF that submits a mutation
    # (POST/create/update) — covers the EReF (Exception Reference Flow): on
    # 500/409/400 the user must see an error toast and the form must keep input.
    _has_submit_uf = any(
        any(
            (isinstance(s, dict) and re.search(r'\b(submit|create|save|update)\b', s.get('action', ''), re.IGNORECASE))
            or (isinstance(s, str) and re.search(r'\b(submit|create|save|update)\b', s, re.IGNORECASE))
            for s in (uf.get('steps') or [])
        )
        for uf in spec.get('user_flows', [])
    )
    if _has_submit_uf:
        # Try to derive the mutation API path from spec, fallback to /api/<feature>
        api_path = (spec.get('api_base_path') or '').strip()
        if not api_path:
            feat = re.sub(r'[^a-zA-Z]+', '-', (spec.get('title') or 'feature')).strip('-').lower()
            api_path = f'/api/{feat}'
        tc(
            title='API error — backend returns 500/409/400 → toast error visible, form data preserved, no redirect',
            flow='error-handling',
            priority='High',
            spec_ref='EReF',
            precondition='User authenticated and holds the required create permission',
            steps=[
                f"Intercept POST {api_path} and return 500 with body {{ error: {{ message: 'Internal server error' }} }}",
                f'Navigate to {page_url} and fill minimal valid happy-path data',
                'Click the submit button',
                "Verify error toast is visible (Sonner [data-sonner-toast] containing 'error' or backend message)",
                f'Verify URL still ends with the form path (no redirect after failed submit)',
                'Verify form fields still contain the previously typed values',
            ],
            expected='Error toast appears, URL unchanged, form keeps user input — user can fix and retry.',
            spec_only=False,
            test_data={
                'intercept_url': f'{api_path} (POST)',
                'intercept_status': '500',
                'intercept_body': '{ "error": { "message": "Internal server error" } }',
                'expected_toast_locator': '[data-sonner-toast]',
                'expected_toast_text_contains': 'error OR Internal server error',
                'expected_url_unchanged': 'form path unchanged after failed submit',
            },
        )

    # ── 10. Post-process: enrich TC expected with matching acceptance criterion ──
    acceptance_criteria = spec.get('acceptance_criteria', [])
    if acceptance_criteria:
        for t in tcs:
            if t.get('flow') == 'state-transition':
                continue  # already has specific Next Status expected
            matched = _find_matching_criterion(t['title'], t['flow'], acceptance_criteria)
            if not matched:
                continue
            # Convert question to assertion: strip leading verb (Does/Do/Can/Is/Are) and trailing "?"
            assertion = re.sub(
                r'^(?:Does|Do|Can|Is|Are)\s+(?:a\s+|an\s+|the\s+)?',
                '', matched.strip(), flags=re.IGNORECASE
            ).rstrip('?').strip()
            if assertion:
                assertion = assertion[0].upper() + assertion[1:]
            cur_exp = t['expected']
            # Replace only if existing expected is vague or very short
            if 'per spec description' in cur_exp.lower() or 'renders correctly' in cur_exp.lower():
                t['expected'] = assertion + '.'
            elif len(cur_exp) < 55:
                t['expected'] = f'{cur_exp.rstrip(".")}. Validates: {assertion}.'

    # ── 10. Authorization — unauthenticated redirect ──
    # Emitted as a real automated test: generate_scripts.py recognises
    # spec_ref='AUTH-unauth' and emits an HTTP-level redirect check
    # (`playwright.request.newContext({ storageState: { cookies: [], origins: [] } })`).
    # This avoids the long-standing bug where `browser.newContext()` silently
    # inherits the project-level storageState (`.auth/user.json`) and therefore
    # never sees a 302 → /auth/signin response.
    tc(
        title='Authorization — unauthenticated user redirected to login',
        flow='auth', priority='High', spec_ref='AUTH-unauth',
        precondition='Anonymous client — no auth cookies',
        steps=[
            'Create a fresh APIRequestContext with storageState: { cookies: [], origins: [] }',
            f'GET {page_url} with maxRedirects: 0',
            'Assert response status is 302 or 307 AND Location header matches /auth/(signin|login) with a callbackUrl param',
        ],
        expected='Anonymous GET returns 302/307 redirect to /auth/signin?callbackUrl=… (page content is not accessible without auth).',
        no_auth=True,
        test_data={
            'auth_context': 'Empty storageState (no cookies, no origins) — bypasses Playwright auth setup',
            'request': f'GET {page_url} with maxRedirects: 0',
            'expected_status': '302 or 307',
            'expected_location_header': 'matches /auth/(signin|login) and contains "callbackUrl="',
        },
    )

    return tcs


# ── Structured spec TC builder (original logic) ──────────────────────────────

def build_form_test_cases(spec: dict, em: dict) -> list[dict]:
    tcs = []
    n = 1
    feature = spec['title']
    # Prefer the real live URL (from --page-url arg) over the local capture file path
    page_url = em.get('_real_page_url') or em.get('source_url', '')

    # All fillable fields from element map
    all_fields = em.get('inputs', []) + em.get('textareas', []) + em.get('selects', [])
    required_fields = [f for f in all_fields if f.get('required') or f.get('aria_required')]
    optional_fields = [f for f in all_fields if not f.get('required') and not f.get('aria_required')
                       and f.get('type', 'hidden') != 'hidden' and f.get('type') != 'radio']
    submit_buttons = [b for b in em.get('buttons', []) if b.get('type') in ('submit',) or 'submit' in b.get('text', '').lower() or 'save' in b.get('text', '').lower() or 'lưu' in b.get('text', '').lower() or 'tạo' in b.get('text', '').lower()]
    cancel_buttons = [b for b in em.get('buttons', []) if 'cancel' in b.get('text', '').lower() or 'hủy' in b.get('text', '').lower() or b.get('type') == 'reset']

    submit_label = submit_buttons[0]['text'] if submit_buttons else 'Submit'
    cancel_label = cancel_buttons[0]['text'] if cancel_buttons else 'Cancel'

    # disabled_flows: list of spec_ref ids (e.g. ['UF-005', 'BR-011']) whose TCs
    # should be emitted as skipped with a FEATURE_DISABLED reason. Populated from
    # spec.disabled_flows — used when a feature is not yet implemented on dev.
    disabled_flows: set[str] = {str(x).strip() for x in (spec.get('disabled_flows') or [])}
    disabled_reason: str = str(spec.get('disabled_flows_reason') or 'Feature not yet implemented')

    # ── Read-only detection (Fix #1) ───────────────────────────────────────────
    # Detail / list / dashboard pages have NO fillable inputs and NO submit button,
    # and the spec declares no fields / validations / boundaries. For such pages the
    # "Fill ... then Click Submit" template is pure junk: it generates uncatchable
    # false-reds (no field to fill, no submit to click). When read-only we emit
    # observational TCs anchored on real page content instead.
    read_only = (
        not all_fields
        and not submit_buttons
        and not spec.get('fields')
        and not spec.get('validations')
        and not spec.get('boundary_constraints')
    )
    content_anchor = _derive_content_anchor(spec)

    # ── Action/list-page detection (Fix #4) ───────────────────────────────────
    # A page can declare validations/boundaries in its spec yet expose NO in-page
    # create/submit form — the create/action UI lives behind a sheet or dialog that
    # analyze_page.py never opened (opened by a "New" button or a row drill-in). Such
    # a page is an ACTION/LIST page, not a form page. The read_only guard above misses
    # it (it requires the spec to declare no validations), so the "open form → fill
    # field → click Submit" template still fires and:
    #   • _derive_open_form_steps borrows the WRONG opener (e.g. a Defer button from an
    #     unrelated triage UF) because the create UF has no explicit fill step;
    #   • a phantom "Click Submit" is appended against a form that isn't there;
    #   • business rules (display-only) get wrapped in "Fill the form to trigger …";
    #   • nav_behaviors (prose) get treated as redirect destinations.
    # The result reads as executable but asserts nothing real. Detect the shape via the
    # absence of BOTH a submit button and any required fillable field (a bare filter
    # Select / search box does not make it a form). When the create sheet HAPPENS to be
    # captured open, required_fields is non-empty → is_action_page is False and the form
    # machinery runs against the real captured form (self-correcting).
    is_action_page = not submit_buttons and not required_fields
    # Emitters that presuppose an in-page submit form produce junk on either shape.
    form_centric_junk = read_only or is_action_page

    def _anchor_step() -> str:
        """A real, page-content structural assertion the translator can execute.
        Prefers the spec's content_anchor; falls back to the main region so the TC
        is never vacuous (always asserts SOMETHING rendered)."""
        if content_anchor:
            return f"Verify '{content_anchor}' is visible"
        return "Verify element at selector 'main, [role=\"main\"]' is visible"

    def tc(title, flow, priority, spec_ref, precondition, steps, expected,
           test_data: dict | None = None, spec_only: bool = False,
           no_auth: bool = False, skip_reason: str = '',
           assertions: list | None = None, step_responses: list | None = None,
           step_assertions: list | None = None):
        nonlocal n
        # Auto-apply skip_reason if the TC's spec_ref matches disabled_flows
        if not skip_reason and spec_ref in disabled_flows:
            skip_reason = f'FEATURE_DISABLED: {disabled_reason}'
        # `assert:` is the ONLY channel Step 6 compiles into expect(). The structured
        # builder used to drop it on the floor — it accepted plain step strings and
        # nothing else — so a spec whose author had written every oracle still produced
        # bodies holding one comment and no assertion (98 of 162 on VIF-GOV-003). The
        # emitter below already knows how to write all three; it was simply never handed
        # them. Keep these parameters in step with the descriptive builder's tc().
        t = {
            'id': n, 'title': title, 'flow': flow,
            'page': page_url, 'priority': priority,
            'spec_ref': spec_ref, 'precondition': precondition,
            'steps': steps, 'expected': expected,
            'test_data': test_data,
            'spec_only': spec_only,
            'no_auth': no_auth,
            'skip_reason': skip_reason,
            'assertions': assertions or [],
            'step_responses': step_responses or [],
            'step_assertions': step_assertions or [],
        }
        tcs.append(t)
        n += 1

    # Pre-build valid form data once — merge element-map-derived defaults with
    # spec-derived realistic values (parsed from UF step actions).
    valid_data = valid_form_data(required_fields)
    spec_data = extract_happy_path_data(spec)
    for k, v in spec_data.items():
        valid_data.setdefault(k, v)

    # ── Happy path: one per UF-xxx ──
    # Prefer spec-defined steps (uf.steps) over generic fill-required-and-submit template,
    # so each UF gets steps that actually match its title (AI Draft, Back to Specs, etc.)
    for uf in spec['user_flows']:
        uf_steps_raw = uf.get('steps', [])
        step_actions: list[str] = []
        uf_step_resps: list[str] = []
        uf_step_asserts: list[list] = []
        for s in uf_steps_raw:
            if isinstance(s, dict):
                act = s.get('action', '').strip()
                if act:
                    step_actions.append(act)
                    uf_step_resps.append(str(s.get('system_response') or '').strip())
                    uf_step_asserts.append(list(s.get('assert') or []))
            elif isinstance(s, str) and s.strip():
                step_actions.append(s.strip())
                uf_step_resps.append('')
                uf_step_asserts.append([])

        # Ensure a navigate step is first. The oracle lists are positional, so a
        # prepended step has to shift them or every assertion lands one step early.
        if not step_actions or not any(
            'navigate' in a.lower() or 'go to' in a.lower() for a in step_actions
        ):
            step_actions = [f'Navigate to {page_url}'] + step_actions
            uf_step_resps = [''] + uf_step_resps
            uf_step_asserts = [[]] + uf_step_asserts

        # Build preconditions string from uf.preconditions if present
        uf_preconds = uf.get('preconditions') or []
        precond_str = '; '.join(uf_preconds) if uf_preconds else 'User is on the page'

        # Fallback to generic template only if spec has no steps defined for this UF.
        # On a read-only page there is nothing to fill or submit → emit an
        # observational render check instead of fill/submit junk (Fix #1).
        if not uf_steps_raw:
            if read_only:
                step_actions = [f"Navigate to {page_url}", _anchor_step()]
            else:
                step_actions = [
                    f"Navigate to {page_url}",
                    *[f'Fill **{field_label(f)}** = "{field_sample_value(f)}"' for f in required_fields],
                    f'Click "{submit_label}"',
                ]

        expected = uf.get('expected_outcome') or f"Flow completes successfully. {uf['description']}"

        tc(
            title=f"Happy path — {uf['description']}",
            flow=uf['id'],
            priority='High',
            spec_ref=uf['id'],
            precondition=precond_str,
            steps=step_actions,
            expected=expected,
            test_data=valid_data,
            assertions=list(uf.get('assert') or []),
            step_responses=uf_step_resps,
            step_assertions=uf_step_asserts,
        )

    # If no UF rules found, add generic happy path
    if not spec['user_flows']:
        if read_only:
            tc(
                title='Happy path — page renders with expected content',
                flow='main-flow',
                priority='High',
                spec_ref='UF-001',
                precondition='User is on the page',
                steps=[f"Navigate to {page_url}", _anchor_step()],
                expected='Page renders the expected content with no console error.',
            )
        else:
            tc(
                title='Happy path — complete form with valid data',
                flow='main-flow',
                priority='High',
                spec_ref='UF-001',
                precondition='User is on the page',
                steps=[
                    f"Navigate to {page_url}",
                    *[f'Fill **{field_label(f)}** = "{field_sample_value(f)}"' for f in required_fields],
                    f'Click "{submit_label}"',
                ],
                expected='Form submits successfully; success message or redirect shown',
                test_data=valid_data,
            )

    # ── Happy path variant: submit with OPTIONAL fields filled (valid) ──
    # The per-UF happy paths above fill only REQUIRED fields (valid_data), so optional
    # fields are exercised solely in their NEGATIVE branches. Emit one positive path
    # that fills every optional field with a valid value and asserts the submit
    # succeeds AND the values reach the payload — this catches mapping/serialisation
    # regressions where an optional field is dropped or mis-sent (real gap on SOP
    # Editor: Checklists/References were only ever filled with invalid data).
    #
    # Optional content fields come from TWO sources: the element-map optional_fields
    # AND spec boundary_constraints keys that are not required. The latter is essential
    # because fields inside a COLLAPSED Collapsible (checklists, references) are absent
    # from the DOM snapshot, so element-map alone would miss exactly the fields we want.
    # Optional JSON-array fields get a valid array sample, not a generic string.
    def _is_json_arr_key(key: str, label: str) -> bool:
        kl, ll = key.lower(), (label or '').lower()
        for v in spec['validations']:
            d = (v.get('description') or '').lower()
            if (kl in d or (ll and ll in d)) and 'json' in d and 'array' in d:
                return True
        return False

    _req_keys = {(f.get('name') or f.get('id') or field_label(f)).lower() for f in required_fields}
    _req_keys |= {field_label(f).lower() for f in required_fields}
    _opt_specs: list[tuple[str, str, bool]] = []  # (data_key, label, is_json_array)
    _seen_opt: set = set()
    for f in optional_fields:
        k = f.get('name') or f.get('id') or field_label(f)
        if k.lower() in _seen_opt:
            continue
        _seen_opt.add(k.lower())
        _opt_specs.append((k, field_label(f), _is_json_arr_key(k, field_label(f))))
    for k in (spec.get('boundary_constraints') or {}).keys():
        if k.lower() in _req_keys or k.lower() in _seen_opt:
            continue
        _seen_opt.add(k.lower())
        label = re.sub(r'(?<!^)(?=[A-Z])', ' ', k).replace('_', ' ').replace('-', ' ')
        label = label[:1].upper() + label[1:]
        _opt_specs.append((k, label, _is_json_arr_key(k, label)))

    if not read_only and _opt_specs and submit_buttons:
        opt_data = dict(valid_data)
        opt_steps = []
        for k, label, is_arr in _opt_specs:
            sample = '[{"item":"Sample"}]' if is_arr else 'ValidValue'
            opt_data[k] = sample
            opt_steps.append(f'Expand/locate **{label}** and fill a valid value: "{sample}"')
        tc(
            title='Happy path — submit with all optional fields filled (valid)',
            flow='main-flow',
            priority='High',
            spec_ref='UF-001',
            precondition='User is on the page',
            steps=[
                f'Navigate to {page_url}',
                *[f'Fill **{field_label(f)}** = "{field_sample_value(f)}"' for f in required_fields],
                *opt_steps,
                f'Click "{submit_label}"',
                'Assert success (created/saved) AND each optional value is carried into the submit payload',
            ],
            expected='Submit succeeds with optional fields populated; optional values appear in the submit payload (none dropped or mis-serialised).',
            test_data=opt_data,
            spec_only=False,
        )

    # Helper: fill-all-other-required-fields step
    def _fill_other_required_steps(exclude_key: str | None) -> list[str]:
        """Return steps that fill all required fields except the excluded one."""
        steps_out = []
        for f in required_fields:
            k = f.get('name') or f.get('id') or field_label(f)
            if k == exclude_key:
                continue
            steps_out.append(f'Fill {field_label(f)} with "{field_sample_value(f)}"')
        return steps_out

    def _derive_open_form_steps(context_text: str = '') -> list[str]:
        """Steps that REVEAL the form before any field can be filled — e.g.
        'Click Add Milestone' opens a sheet/dialog. Without this, a reader (and the
        report) sees Navigate → Fill with no explanation of where the field came from.

        Borrowed from the matching create/edit user_flow: the click/open actions that
        precede the flow's first fill step. Returns [] for an INLINE form (the UF fills
        right after navigate) so we never inject a phantom open-click on pages that
        render the form in place. `context_text` (a TC title/description) routes
        edit/update field TCs to the edit flow's opener instead of the create one."""
        FILL_KW = ('fill ', 'type ', 'enter ', 'choose ', 'pick ',
                   'leave ', 'change ', 'set ')
        OPEN_KW = ('click', 'open', 'press', 'tap', 'expand')

        def _prelude(uf: dict) -> list[str]:
            actions: list[str] = []
            for s in uf.get('steps', []) or []:
                a = (s.get('action') if isinstance(s, dict) else s) or ''
                a = a.strip()
                if a:
                    actions.append(a)
            fill_idx = next((i for i, a in enumerate(actions)
                             if any(k in a.lower() for k in FILL_KW)), None)
            if fill_idx is None or fill_idx == 0:
                return []  # no fill, or fills immediately → inline form, no opener
            return [a for a in actions[:fill_idx]
                    if not ('navigate' in a.lower() or 'go to' in a.lower())
                    and any(k in a.lower() for k in OPEN_KW)]

        want_edit = any(k in (context_text or '').lower()
                        for k in ('edit', 'update', 'modify'))
        want_kw = ('edit', 'update', 'modify') if want_edit else ('add', 'create', 'new')
        ufs = spec.get('user_flows', []) or []
        # Prefer a UF whose name matches the desired mode (create vs edit); the
        # stable sort keeps original order among equally-matching flows.
        ordered = sorted(
            ufs,
            key=lambda uf: 0 if any(
                k in (uf.get('name') or uf.get('title') or '').lower() for k in want_kw
            ) else 1,
        )
        for uf in ordered:
            pre = _prelude(uf)
            if pre:
                return pre
        return []

    # Helper: build expected_result with exact error message from spec if available
    def _expected_validation(val_id: str, field_name: str | None, fallback_desc: str) -> str:
        err_msgs = []
        # Look up error messages for this specific VAL rule
        for v in spec['validations']:
            if v['id'] == val_id:
                err_msgs = v.get('error_messages', [])
                break
        if not err_msgs:
            err_msgs = spec.get('error_messages', [])
        if err_msgs:
            msg_hint = f' — expected message: "{err_msgs[0]}"'
        else:
            msg_hint = ' — error message matches spec'
        target = f'**{field_name}** field' if field_name else f'{val_id}'
        return f'Validation error shown for {target}{msg_hint}.'

    # ── Validation: EVERY VAL-xxx rule gets its own TC ──
    # Track which fields already got a "required/empty" TC to avoid duplicates
    required_val_ids_covered: set = set()

    for val in spec['validations']:
        vid = val['id']
        desc = val['description']
        # Use the 'field' attribute if it was extracted from a table row
        spec_field_name = val.get('field', '').lower() if val.get('field') else None
        is_required_rule = any(kw in desc.lower() for kw in (
            'required', 'bắt buộc', 'empty', 'không được trống', 'mandatory', 'empty or null',
            'must be selected', 'must be chosen', 'must be set', 'must be filled',
            'must be provided', 'must be non-empty', 'cannot be empty', 'cannot be blank',
        ))

        # Try to detect the target field from validation description.
        # Priority: (1) spec.validations[].field exact match on name/id, (2) substring match
        # on non-empty name/id/label in desc. Guard against empty-string false positives —
        # '' in desc is always True and would match the first field with blank name.
        def _nonempty_in(val: str | None, text: str) -> bool:
            return bool(val) and val in text

        target_field = None
        if spec_field_name:
            target_field = next(
                (f for f in required_fields + optional_fields
                 if (f.get('name') or '').lower() == spec_field_name
                 or (f.get('id') or '').lower() == spec_field_name),
                None,
            )
        if target_field is None:
            target_field = next(
                (f for f in required_fields + optional_fields
                 if _nonempty_in((f.get('name') or '').lower(), desc.lower())
                 or _nonempty_in((f.get('id') or '').lower(), desc.lower())
                 or _nonempty_in(field_label(f).lower(), desc.lower())),
                None,
            )

        # Prefer spec's field name as the authoritative data key when we have it,
        # even if element-map didn't expose the field (shadcn Select, custom inputs).
        if target_field:
            fkey = target_field.get('name') or target_field.get('id') or field_label(target_field)
            fname = field_label(target_field)
        elif spec_field_name:
            fkey = spec_field_name
            fname = spec_field_name
        else:
            fkey = None
            fname = None

        if is_action_page:
            # No in-page form was captured — the create/action affordance is a sheet/
            # dialog opened by hand. Emit an honest, spec-grounded placeholder (skipped,
            # with a typed reason) instead of a phantom open→fill→submit that borrows the
            # wrong opener. The author drives the real affordance in Step 4.7 / by hand.
            tc(
                title=f'{vid} — {fname or val.get("field") or "field"} constraint '
                      f'({val.get("constraint") or "rule"})',
                flow='validation',
                priority='High',
                spec_ref=vid,
                precondition='The create/action affordance (sheet/dialog) is opened by hand',
                steps=[
                    f'Navigate to {page_url}',
                    f'Open the create/action affordance and exercise the '
                    f'{fname or "field"} constraint per {vid}',
                ],
                expected=_expected_validation(vid, fname, desc),
                spec_only=True,
                skip_reason=(
                    f'ACTION_PAGE: no in-page create/submit form was captured for this '
                    f'list/action page — the {fname or "field"} input lives behind a '
                    f'sheet/dialog not present in element-map. Author the assertion by '
                    f'hand (Step 4.7) against the deployed affordance.'
                ),
            )
            continue

        if is_required_rule:
            # Generate "empty required field" TC
            if vid in required_val_ids_covered:
                continue
            required_val_ids_covered.add(vid)
            empty_data = dict(valid_data)
            if fkey:
                empty_data[fkey] = [] if fkey in _LIST_REPEATER_KEYS else ''
            fill_steps = _fill_other_required_steps(fkey)
            tc(
                title=f'{vid} — {fname or "Required field"} is empty',
                flow='validation',
                priority='High',
                spec_ref=vid,
                precondition='User is on the page',
                steps=[
                    f'Navigate to {page_url}',
                    *_derive_open_form_steps(f'{vid} {desc}'),
                    *fill_steps,
                    f'Leave {fname or "required field"} empty',
                    f'Click "{submit_label}"',
                ],
                expected=_expected_validation(vid, fname, desc),
                test_data=empty_data,
                spec_only=False,
            )
        else:
            # Generate invalid-value TC
            invalid_value = field_sample_value(target_field, valid=False) if target_field else 'INVALID'
            invalid_data = dict(valid_data)
            if fkey:
                invalid_data[fkey] = invalid_value
            fill_steps = _fill_other_required_steps(fkey)
            if target_field:
                step_fill = f'Fill {fname} with invalid value "{invalid_value}" (violates {vid}: {desc})'
            else:
                step_fill = f'Trigger violation of {vid}: {desc}'
            tc(
                title=f'{vid} — {desc}',
                flow='validation',
                priority='High',
                spec_ref=vid,
                precondition='User is on the page',
                steps=[
                    f'Navigate to {page_url}',
                    *_derive_open_form_steps(f'{vid} {desc}'),
                    *fill_steps,
                    step_fill,
                    f'Click "{submit_label}"',
                ],
                expected=_expected_validation(vid, fname, desc),
                test_data=invalid_data,
                spec_only=False,
            )

    # ── Validation-message LIFECYCLE ──────────────────────────────────────────
    # The VAL loop above only asserts the APPEARANCE of a validation message.
    # Every spec source is silent on the disappearance direction, so a form that
    # never re-validates keeps a stale "X is required" on screen after the user
    # has fixed the field — the suite stayed green on it (reported by hand on
    # Decision Recording). These four invariants close that blind spot; they are
    # UI/UX oracles, not spec oracles (see references/validation-lifecycle.md).
    reset_buttons = [b for b in em.get('buttons', [])
                     if (b.get('text') or '').strip().lower() in
                     ('clear', 'reset', 'clear form', 'xóa', 'làm mới')]
    reset_label = reset_buttons[0]['text'].strip() if reset_buttons else ''

    def _lifecycle_fields() -> list[dict]:
        """Fields carrying a required rule, with the label + valid value + widget
        shape the lifecycle TCs need. Sourced from spec VAL rules first (they are
        authoritative and survive shadcn's missing `required` attribute), then any
        element-map field flagged required that no VAL rule named."""
        out: list[dict] = []
        seen: set[str] = set()

        def _add(key: str, label: str, val_id: str, el: dict | None) -> None:
            k = (key or '').strip()
            if not k or k.lower() in seen:
                return
            seen.add(k.lower())
            out.append({
                'key': k,
                'label': label or _humanize_lifecycle_key(k),
                'valid_value': field_sample_value(el) if el else 'ValidValue',
                'widget': _lifecycle_widget(k, label, el),
                'val_id': val_id,
            })

        for v in spec['validations']:
            d = (v.get('description') or '').lower()
            is_req = (v.get('constraint') or '').lower() == 'required' or any(
                kw in d for kw in ('required', 'bắt buộc', 'mandatory', 'cannot be empty',
                                   'cannot be blank', 'must be provided', 'must be selected',
                                   'must be set', 'must be filled', 'không được trống')
            )
            if not is_req:
                continue
            fname = (v.get('field') or '').strip()
            el = None
            if fname:
                # Search ALL captured fields, not just required+optional: a <textarea>
                # carries no `type` attribute, so the optional_fields filter drops it —
                # and Rationale (the field that surfaced this whole gap) is a textarea.
                el = next((f for f in all_fields
                           if (f.get('name') or '').lower() == fname.lower()
                           or (f.get('id') or '').lower() == fname.lower()
                           or field_label(f).lower() == fname.lower()), None)
            if el is None:
                el = next((f for f in all_fields
                           if (field_label(f).lower() in d and field_label(f).lower() != 'field')), None)
            key = fname or (el and (el.get('name') or el.get('id') or field_label(el))) or ''
            # field_label falls back to the raw id ("objective-combobox"); humanize it
            # so the TC title and the failure message read like the on-screen label.
            label = field_label(el) if el else ''
            if not label or label == (el or {}).get('id') or label == key:
                label = _humanize_lifecycle_key(key)
            _add(key, label, v['id'], el)

        for f in required_fields:
            _add(f.get('name') or f.get('id') or field_label(f), field_label(f),
                 'VAL-lifecycle', f)
        return out

    lifecycle_fields = _lifecycle_fields()

    if lifecycle_fields and is_action_page:
        # The form lives behind an un-captured sheet/dialog — same policy as the VAL
        # loop: emit one honest skipped placeholder so the gap stays visible instead
        # of scaffolding clicks against an affordance element-map never saw.
        tc(
            title='Validation lifecycle — messages clear when fixed (create/action affordance)',
            flow='validation-lifecycle',
            priority='High',
            spec_ref='VAL-lifecycle',
            precondition='The create/action affordance (sheet/dialog) is opened by hand',
            steps=[
                f'Navigate to {page_url}',
                'Open the create/action affordance, submit empty to surface the validation '
                'messages, then fix each field and confirm its message disappears',
            ],
            expected='Every field-level validation message disappears once the field holds a '
                     'valid value (on change or on blur); no stale message survives.',
            spec_only=True,
            skip_reason=(
                'ACTION_PAGE: no in-page form was captured — author the validation-lifecycle '
                'checks by hand (Step 4.7) against the deployed affordance.'
            ),
        )
    elif lifecycle_fields and not read_only:
        open_steps = _derive_open_form_steps('create new add')
        lc_base = {
            'submit_label': submit_label,
            'reset_label': reset_label,
            'open_steps': open_steps,
        }

        tc(
            title='Validation lifecycle — pristine form shows no validation message',
            flow='validation-lifecycle',
            priority='Medium',
            spec_ref='VAL-lifecycle/pristine',
            precondition='User is on the page; the form has just been opened',
            steps=[
                f'Navigate to {page_url}',
                *open_steps,
                'Without touching any field, scan the form for visible validation messages',
            ],
            expected='No field-level validation message is shown on a form the user has not '
                     'interacted with yet.',
            spec_only=False,
        )
        tcs[-1]['category'] = 'validation-lifecycle'
        tcs[-1]['validation_lifecycle'] = {**lc_base, 'kind': 'pristine',
                                          'field': '', 'label': '', 'valid_value': '',
                                          'widget': ''}

        for lf in lifecycle_fields:
            tc(
                title=f"Validation lifecycle — '{lf['label']}' error clears once a valid "
                      f"value is entered",
                flow='validation-lifecycle',
                priority='High',
                spec_ref=f"{lf['val_id']}/lifecycle-clear",
                precondition='User is on the page',
                steps=[
                    f'Navigate to {page_url}',
                    *open_steps,
                    f'Click "{submit_label}" with the form empty to surface the validation messages',
                    f"Confirm a validation message is shown for **{lf['label']}**",
                    f"Enter a valid value in **{lf['label']}** and move focus out of the field",
                    f"Observe the validation message under **{lf['label']}**",
                ],
                expected=(f"The validation message under {lf['label']} disappears once the field "
                          f"holds a valid value — on change or, at the latest, on blur. A message "
                          f"that survives both is a stale-validation DEV-BUG (UI/UX invariant; the "
                          f"spec mandates only the appearance direction)."),
                spec_only=False,
            )
            tcs[-1]['category'] = 'validation-lifecycle'
            tcs[-1]['validation_lifecycle'] = {**lc_base, 'kind': 'clear-on-valid',
                                              'field': lf['key'], 'label': lf['label'],
                                              'valid_value': lf['valid_value'],
                                              'widget': lf['widget']}

            # Re-arm check: only for typed fields — a Select/combobox cannot be
            # returned to its empty state by clearing text.
            if lf['widget'] in ('input', 'textarea'):
                tc(
                    title=f"Validation lifecycle — '{lf['label']}' error reappears when the "
                          f"field is emptied again",
                    flow='validation-lifecycle',
                    priority='Medium',
                    spec_ref=f"{lf['val_id']}/lifecycle-rearm",
                    precondition='User is on the page',
                    steps=[
                        f'Navigate to {page_url}',
                        *open_steps,
                        f'Click "{submit_label}" with the form empty to surface the validation messages',
                        f"Enter a valid value in **{lf['label']}** so the message clears",
                        f"Clear **{lf['label']}** again and move focus out of the field",
                        f"Observe the validation message under **{lf['label']}**",
                    ],
                    expected=(f"The validation message for {lf['label']} is shown again — validation "
                              f"re-arms instead of firing once and going silent."),
                    spec_only=False,
                )
                tcs[-1]['category'] = 'validation-lifecycle'
                tcs[-1]['validation_lifecycle'] = {**lc_base, 'kind': 'reappear',
                                                  'field': lf['key'], 'label': lf['label'],
                                                  'valid_value': lf['valid_value'],
                                                  'widget': lf['widget']}

        if reset_label:
            tc(
                title=f'Validation lifecycle — "{reset_label}" clears every validation message',
                flow='validation-lifecycle',
                priority='Medium',
                spec_ref='VAL-lifecycle/reset',
                precondition='User is on the page',
                steps=[
                    f'Navigate to {page_url}',
                    *open_steps,
                    f'Click "{submit_label}" with the form empty to surface the validation messages',
                    f'Click "{reset_label}"',
                    'Scan the form for visible validation messages and check the submit control',
                ],
                expected=(f'"{reset_label}" returns the form to pristine: no validation message '
                          f'survives and "{submit_label}" is not left disabled.'),
                spec_only=False,
            )
            tcs[-1]['category'] = 'validation-lifecycle'
            tcs[-1]['validation_lifecycle'] = {**lc_base, 'kind': 'reset',
                                              'field': '', 'label': '', 'valid_value': '',
                                              'widget': ''}

    # ── Boundary values for text inputs ──
    # Look up spec-defined boundary constraints; fall back to sensible defaults.
    bc = spec.get('boundary_constraints', {})
    text_inputs = [f for f in em.get('inputs', []) + em.get('textareas', [])
                   if f.get('type', 'text') in ('text', 'email', 'password', 'tel', 'url', 'search', 'textarea')]

    # Find matching VAL rule for a field (for spec_ref linkage)
    def _val_ref_for_field(fk: str, fn: str) -> str:
        for v in spec['validations']:
            if fk.lower() in v['description'].lower() or fn.lower() in v['description'].lower():
                return v['id']
        return 'VAL-boundary'

    # True when the field's VAL rule requires its content to be a JSON ARRAY
    # (e.g. Steps/Checklists/References). For these fields a raw 'A'*N string is
    # NOT a valid value — the max-length boundary must be a *valid JSON array*
    # padded to exactly N chars, or the "accepts without error" TC falsely fails
    # the array check instead of exercising the length bound. (Real miss caught
    # on SOP Editor: Steps max=8000 boundary filled 'A'*8000 → array check fired.)
    def _numeric_range_for(fk: str, fn: str, field_bc: dict):
        """A VALUE range, not a character-length range.

        `boundary_constraints` was only ever read as a length bound ('A' * min),
        which raises TypeError on a float and asserts nonsense on an int: a
        `Range(min=0.0, max=1.0)` fraction has no 0-character form. Dimension 3
        of the validation matrix covers "min/max length / VALUE / date" — this
        is the value half.

        Numeric when the spec says so (`numeric: true`), when either bound is a
        float, or when the captured control is an <input type="number">. The two
        exclusivity flags come from the CT `Range(...)` token and default to
        inclusive, matching the token's own default.
        """
        if field_bc.get('numeric') is False:
            return None
        declared = bool(field_bc.get('numeric'))
        lo, hi = field_bc.get('min'), field_bc.get('max')
        is_float = isinstance(lo, float) or isinstance(hi, float)
        resolved = _resolve_field_for_key(fk)
        is_number_input = bool(resolved) and (resolved.get('type') or '').lower() == 'number'
        if not (declared or is_float or is_number_input):
            return None
        return {
            'min': lo,
            'max': hi,
            'min_exclusive': bool(field_bc.get('min_exclusive')),
            'max_exclusive': bool(field_bc.get('max_exclusive')),
        }

    def _is_json_array_field(fk: str, fn: str) -> bool:
        for v in spec['validations']:
            d = (v.get('description') or '').lower()
            if (fk.lower() in d or fn.lower() in d) and (
                'json array' in d or ('json' in d and 'array' in d)
            ):
                return True
        return False

    # Only generate boundary TCs for fields that the spec explicitly defines
    # boundary_constraints for. Skips noisy internal/auto-id fields like
    # `base-ui-_r_ah_` (radix) or generic `field` names produced by shadcn components
    # that don't correspond to real user-visible inputs with documented limits.
    # Spec-driven: iterate the DECLARED boundary_constraints rather than only the
    # DOM-captured inputs. This is deliberate — two real misses on SOP Editor:
    #   (1) camelCase keys (taskType, boundedContextName) never matched because the
    #       old loop lowercased the captured field key before `bc.get()`, so a
    #       camelCase constraint key silently failed the lookup → no boundary TC.
    #   (2) optional fields inside a COLLAPSED Collapsible (checklists, references)
    #       are absent from the element-map snapshot, so a DOM-only loop skipped them.
    # Resolving from the spec's own keys fixes both; the captured field (matched
    # case-insensitively) is consulted only to recover a nice human label.
    def _humanize_key(k: str) -> str:
        spaced = re.sub(r'(?<!^)(?=[A-Z])', ' ', k).replace('_', ' ').replace('-', ' ')
        return spaced[:1].upper() + spaced[1:]

    def _resolve_field_for_key(key: str):
        kl = key.lower()
        return next(
            (f for f in (required_fields + optional_fields)
             if (f.get('name') or '').lower() == kl
             or (f.get('id') or '').lower() == kl
             or field_label(f).lower() == kl),
            None,
        )

    def _bc_control_selector(resolved, fkey: str) -> str:
        """The control an accept-side boundary TC asserts against."""
        if resolved:
            _id = (resolved.get('id') or '').strip()
            if _id:
                return f'#{_id}'
            _nm = (resolved.get('name') or '').strip()
            if _nm:
                return f'[name="{_nm}"]'
        return f'[name="{fkey}"]'

    for fkey, field_bc in bc.items():
        if not isinstance(field_bc, dict):
            continue  # spec did not declare bounds for this field → skip
        resolved = _resolve_field_for_key(fkey)
        fname = field_label(resolved) if resolved else _humanize_key(fkey)
        min_len = field_bc.get('min', 1)
        max_len = field_bc.get('max', 255)
        val_ref = _val_ref_for_field(fkey, fname)
        is_json_arr = _is_json_array_field(fkey, fname)

        if is_action_page:
            # No in-page form captured — _derive_open_form_steps would borrow the wrong
            # opener. Collapse the min/max/over-max boundary set into one honest, skipped
            # placeholder; the author drives the create affordance by hand (Step 4.7).
            tc(
                title=f'Boundary — {fname}: min={min_len}/max={max_len} (create/action affordance)',
                flow='validation',
                priority='Medium',
                spec_ref=val_ref,
                precondition='The create/action affordance (sheet/dialog) is opened by hand',
                steps=[
                    f'Navigate to {page_url}',
                    f'Open the create/action affordance and exercise the {fname} '
                    f'min={min_len} / max={max_len} / over-max boundary by hand',
                ],
                expected=(f'{fname} accepts exactly {min_len} and {max_len} character(s) and '
                          f'rejects {max_len + 1} (boundary inclusive per spec {val_ref}).'),
                spec_only=True,
                skip_reason=(
                    f'ACTION_PAGE: {fname} lives behind a create/action sheet not captured '
                    f'in element-map — author the min/max boundary checks by hand (Step 4.7).'
                ),
            )
            continue

        # ── VALUE range (not a character-length range) ───────────────────────
        num = _numeric_range_for(fkey, fname, field_bc)
        if num is not None:
            open_form = _derive_open_form_steps(fname)
            fill_other = _fill_other_required_steps(fkey)

            def _fmt(v):
                return ('%g' % v) if isinstance(v, float) else str(v)

            def _step(v, verdict, label):
                data = dict(valid_data); data[fkey] = v
                tc(
                    title=f'Boundary {label} — {fname}: {_fmt(v)}',
                    flow='validation',
                    priority='Medium',
                    spec_ref=val_ref,
                    precondition='User is on the page',
                    steps=[
                        f'Navigate to {page_url}',
                        *open_form,
                        *fill_other,
                        f'Fill {fname} with "{_fmt(v)}"',
                        f'Click "{submit_label}"',
                    ],
                    assertions=([{'value': _fmt(v),
                                  'of': _bc_control_selector(resolved, fkey)}]
                                if verdict == 'accept' else None),
                    expected=(
                        f'Field accepts the value {_fmt(v)} without error.'
                        if verdict == 'accept' else
                        f'Validation error shown — {fname} rejects the value {_fmt(v)} '
                        f'(allowed range per spec {val_ref}).'
                    ),
                    test_data=data,
                    spec_only=False,
                )

            lo, hi = num['min'], num['max']
            step = 0.1 if (isinstance(lo, float) or isinstance(hi, float)) else 1
            if lo is not None:
                if num['min_exclusive']:
                    _step(lo, 'reject', 'at-exclusive-min')
                    _step(round(lo + step, 6), 'accept', 'just-inside-min')
                else:
                    _step(lo, 'accept', 'exact-min')
                    _step(round(lo - step, 6), 'reject', 'below-min')
            if hi is not None:
                if num['max_exclusive']:
                    _step(hi, 'reject', 'at-exclusive-max')
                    _step(round(hi - step, 6), 'accept', 'just-inside-max')
                else:
                    _step(hi, 'accept', 'exact-max')
                    _step(round(hi + step, 6), 'reject', 'above-max')
            continue

        # Boundary TCs exercise the Add/Create form fields → open the form first so
        # the Fill step isn't orphaned (see _derive_open_form_steps). Empty for inline forms.
        open_form = _derive_open_form_steps(fname)
        fill_other = _fill_other_required_steps(fkey)

        # Min-length boundaries only make sense for plain text fields. For a
        # JSON-array field a 1-char value can never be a valid array, so the
        # exact-min / below-min TCs would assert nonsense — skip them.
        if not is_json_arr:
            # Exact-min boundary (valid)
            min_val = 'A' * min_len
            min_data = dict(valid_data); min_data[fkey] = min_val
            tc(
                assertions=[{'value': min_val, 'of': _bc_control_selector(resolved, fkey)}],
                title=f'Boundary min — {fname}: exactly {min_len} char(s)',
                flow='validation',
                priority='Medium',
                spec_ref=val_ref,
                precondition='User is on the page',
                steps=[
                    f'Navigate to {page_url}',
                    *open_form,
                    *fill_other,
                    f'Fill {fname} with {min_len} character(s): "{min_val[:20]}"',
                    f'Click "{submit_label}"',
                ],
                expected=f'Field accepts exactly {min_len} character(s) without error.',
                test_data=min_data,
                spec_only=False,
            )

            # Below-min boundary (invalid) — only if min > 1
            if min_len > 1:
                below_val = 'A' * (min_len - 1)
                below_data = dict(valid_data); below_data[fkey] = below_val
                tc(
                    title=f'Boundary below-min — {fname}: {min_len - 1} char(s) (min={min_len})',
                    flow='validation',
                    priority='Medium',
                    spec_ref=val_ref,
                    precondition='User is on the page',
                    steps=[
                        f'Navigate to {page_url}',
                        *open_form,
                        *fill_other,
                        f'Fill {fname} with {min_len - 1} character(s): "{below_val[:20]}"',
                        f'Click "{submit_label}"',
                    ],
                    expected=f'Validation error shown — {fname} requires at least {min_len} character(s).',
                    test_data=below_data,
                    spec_only=False,
                )

        # Exact-max boundary (valid) — the max constraint is inclusive, so a
        # value of EXACTLY max_len must be accepted. Testing only the over-limit
        # side (below) misses off-by-one bugs (`> max` vs `>= max`). For a
        # JSON-array field the value must be a *valid array* padded to max_len,
        # which the script translator builds from the "valid JSON array of N
        # characters" phrasing (see generate_scripts.py).
        if is_json_arr:
            max_fill_step = f'Fill {fname} with a valid JSON array of exactly {max_len} characters (max allowed)'
            max_expected = f'Field accepts a valid JSON array of exactly {max_len} characters without error.'
            max_tdata = {fkey: f'<valid JSON array padded to exactly {max_len} chars>'}
            exceed_fill_step = f'Fill {fname} with a valid JSON array of exactly {max_len + 1} characters (one over max)'
            exceed_expected = f'Validation error shown — {fname} allows at most {max_len} characters.'
            exceed_tdata = {fkey: f'<valid JSON array padded to exactly {max_len + 1} chars>'}
        else:
            max_val = 'A' * max_len
            max_fill_step = f'Fill {fname} with {max_len} character(s) (max allowed)'
            max_expected = f'Field accepts exactly {max_len} character(s) without error.'
            max_tdata = dict(valid_data); max_tdata[fkey] = max_val
            exceed_fill_step = f'Fill {fname} with {max_len + 1} character(s) (one over max)'
            exceed_expected = f'Validation error shown or input truncated — {fname} allows at most {max_len} character(s).'
            exceed_tdata = dict(valid_data); exceed_tdata[fkey] = 'A' * (max_len + 1)

        tc(
            title=f'Boundary max — {fname}: exactly {max_len} char(s)' + (' (valid JSON array)' if is_json_arr else ''),
            flow='validation',
            priority='Medium',
            spec_ref=val_ref,
            precondition='User is on the page',
            steps=[
                f'Navigate to {page_url}',
                *open_form,
                *fill_other,
                max_fill_step,
                f'Click "{submit_label}"',
            ],
            expected=max_expected,
            test_data=max_tdata,
            # Accept-side oracle: the control HOLDS the max-length value. For a JSON-array
            # field the padded array is built by the script translator, so there is no
            # literal to compare against and the prose assertion stands alone.
            assertions=(None if is_json_arr
                        else [{'value': max_val, 'of': _bc_control_selector(resolved, fkey)}]),
            spec_only=False,
        )

        # Exceed-max boundary (invalid)
        tc(
            title=f'Boundary max+1 — {fname}: {max_len + 1} char(s) (exceeds max={max_len})',
            flow='validation',
            priority='Medium',
            spec_ref=val_ref,
            precondition='User is on the page',
            steps=[
                f'Navigate to {page_url}',
                *open_form,
                *fill_other,
                exceed_fill_step,
                f'Click "{submit_label}"',
            ],
            expected=exceed_expected,
            test_data=exceed_tdata,
            spec_only=False,
        )

    # ── Special characters in free-text fields ──
    # WHY THIS EXISTS: before this pass the ONLY special-character coverage in the whole
    # corpus was a single layout-stress TC (`cjkEmojiRtl`), which asks whether the layout
    # breaks — never whether the value survives. A field that silently strips an emoji,
    # HTML-escapes an ampersand into `&amp;`, or mangles CJK is invisible to every other
    # pass here: boundary counts characters, required checks emptiness, format only fires
    # when the spec declares a pattern.
    #
    # ORACLE, and why it is not invented: a value the user typed must reach the API
    # unchanged UNLESS a spec says otherwise. Two spec signals can say otherwise, and
    # both are honoured below:
    #   * a `format` validation rule on the field — a declared character class means not
    #     every character is legal, so the field is SKIPPED rather than guessed at;
    #   * `field_normalization[<field>]` (ES 0.4 §Properties `Normalization` column) —
    #     when it declares anything other than `none`, the transform is named in the
    #     expectation instead of asserting a verbatim round-trip.
    # Whitespace is deliberately absent from the probe value: a form-level trim is a
    # widget concern, and the ES Normalization column governs the entity, so asserting
    # it either way would be an ungrounded oracle.
    _SPECIAL_CHARS = 'A"b<c>d&e\'f 予約 ✅'
    _fmt_constrained = {
        str(v.get('field', '')).strip().lower()
        for v in (spec.get('validations') or [])
        if isinstance(v, dict) and str(v.get('constraint', '')).strip().lower() == 'format'
    }
    _norm = {str(k).strip().lower(): str(v).strip().lower()
             for k, v in (spec.get('field_normalization') or {}).items()}
    # Capped: each of these submits the whole form, and the class of bug they catch is
    # per-codebase (one shared input component), not per-field — three fields prove it.
    def _control_ref(field: str) -> str:
        """Resolve a spec field name to a locator the `assert:` vocabulary accepts.

        Returns '' when the element-map holds no control for it — the caller then
        emits NO TC for that field. That is deliberate: `of: title` would compile to
        `page.locator('title')`, which matches the document's <title> element and
        yields a test that fails for a reason that has nothing to do with the field.
        A missing TC is honest; a TC bound to the wrong node is not.
        """
        want = field.strip().lower()
        for group in ('inputs', 'textareas'):
            for el in (em.get(group) or []):
                if not isinstance(el, dict):
                    continue
                for key in ('name', 'id'):
                    val = str(el.get(key) or '').strip()
                    if val and val.lower() == want:
                        return f'#{val}' if key == 'id' else f'[name="{val}"]'
                lab = str(el.get('label') or '').strip()
                if lab and lab.lower() == want and el.get('id'):
                    return f"#{el['id']}"
        return ''

    for fname in _derive_free_text_fields(spec)[:3]:
        fkey = str(fname).strip()
        if fkey.lower() in _fmt_constrained:
            continue
        _ref = _control_ref(fkey)
        if not _ref:
            continue
        rule = _norm.get(fkey.lower(), 'none')
        sc_data = dict(valid_data)
        sc_data[fkey] = _SPECIAL_CHARS
        # What the control must hold after typing: verbatim unless the ES declares a
        # transform. Only the two normalizations that are decidable without knowing the
        # locale are applied; anything else keeps the verbatim oracle and says so in
        # `expected`, because guessing a transform is how a wrong oracle ships.
        _expected_after_norm = {
            'lowercase': _SPECIAL_CHARS.lower(),
            'uppercase': _SPECIAL_CHARS.upper(),
        }.get(rule, _SPECIAL_CHARS)
        if rule in ('', 'none'):
            sc_expected = (f'{fkey} accepts the value and submits it VERBATIM — quotes, '
                           f'angle brackets, ampersand, CJK and emoji all survive unchanged '
                           f'(no character-class rule is declared for this field, and its '
                           f'declared Normalization is none).')
        else:
            sc_expected = (f'{fkey} accepts the value and submits it with exactly the '
                           f'declared `{rule}` normalization applied — no other character '
                           f'is added, dropped or escaped.')
        tc(
            title=f'Special characters — {fkey}: quotes, angle brackets, ampersand, CJK and emoji',
            flow='validation',
            priority='Medium',
            spec_ref=f'special-chars/{fkey}',
            precondition='User is on the page',
            steps=[
                f'Navigate to {page_url}',
                *_derive_open_form_steps(fkey),
                *_fill_other_required_steps(fkey),
                f'Fill {fkey} with the special-character value: "{_SPECIAL_CHARS}"',
            ],
            expected=sc_expected,
            test_data=sc_data,
            spec_only=False,
        )
        # The oracle rides on the Fill step, not the end of the body: it asserts the
        # state that step produced. Without it this TC renders as a fill with no
        # expect() — an inert test that reports as covered while proving nothing.
        _sa = [[] for _ in tcs[-1]['steps']]
        _sa[-1] = [{'value': _expected_after_norm, 'of': _ref}]
        tcs[-1]['step_assertions'] = _sa

    # ── Duplicate values ──
    # WHY THIS EXISTS: "duplicate data" was the single biggest hole in this generator —
    # the word `duplicate` appeared nine times in this file and every one of them meant
    # "do not emit the same TC twice". A distinctness rule the spec DOES state therefore
    # produced zero coverage unless the backend happened to declare a 409 the error pass
    # picked up by accident.
    #
    # SOURCES, both already carried by the spec-yaml — nothing new for the author:
    #   * `enforcement_guards[].kind` in {no-duplicates, unique, distinct} — the ES 0.4
    #     `## Invariants` DSL, extracted by resolve_specs.py --emit-guards, whose
    #     `error_code` is the oracle key;
    #   * `validations[]` with `constraint: unique` (already a documented value in
#     spec-template.yaml that had no builder behind it), or whose description
#     states distinctness in prose (a VIF
    #     §Validation row such as "distinct values when supplied").
    # Emits NOTHING when the spec states no distinctness rule. That silence is correct:
    # asserting "a duplicate must be rejected" where no spec says so would invent an
    # oracle and file a dev bug against a screen that never promised it.
    _dup_seen: set[str] = set()
    _dup_sources: list[tuple[str, str, str]] = []   # (field, rule text, error code)
    for g in (spec.get('enforcement_guards') or []):
        if not isinstance(g, dict):
            continue
        if str(g.get('kind', '')).strip().lower() not in ('no-duplicates', 'unique', 'distinct'):
            continue
        if g.get('reachable') is False:
            continue          # the guard exists but not through THIS screen
        _dup_sources.append((str(g.get('target', '')).strip(),
                             str(g.get('rule', '')).strip() or 'entries must be distinct',
                             str(g.get('error_code', '')).strip()))
    for v in (spec.get('validations') or []):
        if not isinstance(v, dict):
            continue
        _kind = str(v.get('constraint', '')).strip().lower()
        _txt = f"{v.get('description', '')} {v.get('rule', '')}".lower()
        if _kind != 'unique' and not re.search(
                r'\b(distinct|unique|no duplicates?|not duplicated)\b', _txt):
            continue
        _msgs = [m for m in (v.get('error_messages') or []) if '[MISSING' not in str(m)]
        _dup_sources.append((str(v.get('field', '')).strip(),
                             str(v.get('description', '')).strip() or 'values must be distinct',
                             str(_msgs[0]).strip() if _msgs else ''))

    for dfield, drule, dcode in _dup_sources:
        if not dfield or dfield.lower() in _dup_seen:
            continue
        _dup_seen.add(dfield.lower())
        # `dcode` carries an error CODE when the rule came from an ES guard and the
        # exact UI MESSAGE when it came from a validations row — asserted verbatim either way.
        _oracle = (f'rejected with `{dcode}`' if dcode
                   else 'rejected — the spec declares the rule but publishes no error '
                        'code, so assert the consequence (not saved, form stays open) '
                        'and report the missing code')
        # Executable only when the field is a plain input this suite can type a repeated
        # value into. A set-valued widget (multi-select, checkbox list, repeater) needs
        # widget-specific interaction the prose translator cannot express — emitting a
        # guessed body there is how inert tests are born, so the TC is emitted SKIPPED
        # with the reason, keeping the gap visible in the report instead of absent.
        _typeable = isinstance((spec.get('boundary_constraints') or {}).get(dfield), dict)
        if _typeable:
            dup_data = dict(valid_data)
            dup_data[dfield] = 'Alpha, Alpha'
            tc(
                title=f'Duplicate — {dfield}: the same value supplied twice is {"rejected" if dcode else "not accepted"}',
                flow='validation',
                priority='Medium',
                spec_ref=f'distinctness/{dfield}',
                precondition='User is on the page',
                steps=[
                    f'Navigate to {page_url}',
                    *_derive_open_form_steps(dfield),
                    *_fill_other_required_steps(dfield),
                    f'Fill {dfield} with a value that repeats one entry: "Alpha, Alpha"',
                    f'Click "{submit_label}"',
                ],
                expected=f'{drule} — the duplicate entry is {_oracle}.',
                test_data=dup_data,
                spec_only=False,
            )
            # Oracle on the submit step. With a declared message/code, assert that copy
            # verbatim. Without one, assert the CONSEQUENCE the spec does imply — the
            # submission did not go through, so the route never left the form. Never
            # leave this TC oracle-free: a duplicate that is silently accepted would
            # otherwise render as a green test.
            _sa = [[] for _ in tcs[-1]['steps']]
            _sa[-1] = [{'text': dcode}] if dcode else [{'url': page_url}]
            tcs[-1]['step_assertions'] = _sa
        else:
            tc(
                title=f'Duplicate — {dfield}: the same value cannot be supplied twice',
                flow='validation',
                priority='Medium',
                spec_ref=f'distinctness/{dfield}',
                precondition='User is on the page',
                steps=[
                    f'Navigate to {page_url}',
                    f'Supply the same {dfield} entry twice through its widget',
                    f'Click "{submit_label}"',
                ],
                expected=f'{drule} — the duplicate entry is {_oracle}.',
                spec_only=False,
                skip_reason=(
                    f'UNTESTABLE: "{dfield}" is not a typeable input in this spec\'s '
                    f'boundary_constraints, so the repeated value has to be produced through '
                    f'its own widget (multi-select / checkbox list / repeater). Author the '
                    f'interaction by hand, then delete this skip_reason — the rule itself '
                    f'({drule}) is real and currently unproven.'
                ),
            )

    # ── Select/dropdown options ──
    # Defect #13 (2026-09-11, VIF-ANA-006): this was the ONE form-centric emitter in
    # this block that never consulted `form_centric_junk`, while every neighbour does.
    # On a read-only browse screen (a filter bar over a table) it emitted 3 TCs per
    # Select whose steps are "Fill all required fields with valid data" -> "Click
    # 'Submit'" against a page that has neither, with NO assertions at all — 13 inert
    # TCs on VIF-ANA-006 alone. A Select on such a page is a FILTER, and the oracle a
    # filter needs (the result set changed) cannot be derived here: it requires a named
    # record from `seed_recipes`, which only the spec's own `user_flows` carry. So the
    # family is suppressed rather than reshaped — inventing an oracle here is what
    # produced the fake-green class this guard exists to stop. Widget coverage for the
    # dim-4 gate comes from the render-invariant exploratory TCs, which reference every
    # Select by id.
    for sel in em.get('selects', []):
        if not sel.get('options') or form_centric_junk:
            continue
        sname = field_label(sel)
        for opt in sel['options'][:3]:  # first 3 options
            sel_data = dict(valid_data)
            sel_key = sel.get('name') or sel.get('id') or sname
            sel_data[sel_key] = opt
            tc(
                title=f"Select option — **{sname}** = \"{opt}\"",
                flow='interaction',
                priority='Medium',
                spec_ref='UI-select',
                precondition='User is on the page',
                steps=[
                    f"Navigate to {page_url}",
                    f'Fill all required fields with valid data',
                    f'Select "{opt}" from **{sname}** dropdown',
                    f'Click "{submit_label}"',
                ],
                expected=f'Form submits with **{sname}** = "{opt}" correctly.',
                test_data=sel_data,
            )

    # ── Navigation: cancel/back ──
    if cancel_buttons:
        partial = {list(valid_data.keys())[0]: list(valid_data.values())[0]} if valid_data else {}
        tc(
            title=f'Navigation — click "{cancel_label}" discards changes',
            flow='navigation',
            priority='Medium',
            spec_ref='UI-nav',
            precondition='User has partially filled the form',
            steps=[
                f"Navigate to {page_url}",
                f'Fill the first required field with a value',
                f'Click "{cancel_label}" without submitting',
            ],
            expected='User is navigated back; unsaved data is discarded.',
            test_data=partial,
        )

    # Nav behaviors from spec — "redirect after submit" presumes a form submit,
    # which a read-only OR action/list page does not have (and a nav_behavior is prose,
    # not a redirect URL). Skip on both shapes (Fix #1/#4); legitimate link/button
    # navigations on such pages are already covered by their UF steps.
    if not form_centric_junk:
        for dest in spec['nav_behaviors'][:3]:
            tc(
                title=f'Navigation — redirect to "{dest}" after submit',
                flow='navigation',
                priority='Medium',
                spec_ref='UF-nav',
                precondition='Form is filled with valid data',
                steps=[
                    f"Navigate to {page_url}",
                    *[f'Fill **{field_label(f)}** = "{field_sample_value(f)}"' for f in required_fields],
                    f'Click "{submit_label}"',
                ],
                expected=f'Browser navigates to "{dest}".',
                test_data=valid_data,
            )

    # ── Modals ──
    for modal in em.get('modals', []):
        mid = modal.get('id') or modal.get('class') or 'modal'
        tc(
            title=f'Modal — open and close "{mid}"',
            flow='interaction',
            priority='Low',
            spec_ref='UI-modal',
            precondition='User is on the page',
            steps=[
                f"Navigate to {page_url}",
                f'Trigger modal "{mid}"',
                'Click close/X button',
            ],
            expected='Modal closes; page state is unchanged.',
        )

    # ── Business rules ──
    # A business rule NEVER gets the "fill the form → submit" template. The builder has no
    # idea WHICH fields or values would trigger the rule, so it emits the literal prose
    # "Fill the form to trigger: <rule text>" as a comment and then clicks a default submit
    # button. Three things go wrong at once: no precondition is established, the button is
    # often absent (a list route whose element map was captured together with the drill-in
    # form it links to reports submit buttons that PAGE_URL does not have), and the oracle
    # that follows has nothing to do with the click. VIF-GOV-002 shipped 20 such tests.
    # An observational TC carrying TODO(spec-oracle) is weaker but honest, and a rule that
    # genuinely needs a submission belongs in `user_flows`, which carry real steps.
    for br in spec['business_rules']:
        # A business rule is display-only — wrapping it in "Fill the form to trigger …
        # → Click Submit" is junk on a read-only OR action/list page. Emit an
        # observational anchored TC instead (or defer to the mutation builder).
        # Fix C already emits a deterministic mutate-mock TC for any BR carrying
        # alternate_values — re-emitting a generic one here would duplicate it.
        if br.get('alternate_values'):
            continue
        # Fix #1 + #2: read-only BR has no form to "fill & submit". Emit an
        # observational TC anchored on real content. The `expected` carries NO
        # quoted literal / translator keyword ('visible'/'shows'/'displayed') — so
        # generate_scripts.py does NOT turn the spec's `expected_outcome` (e.g.
        # "'0.03 below target'") into a brittle getByText() against whatever the
        # live record happens to hold. SPEC IS THE ORACLE: the exact-value
        # assertion is grounded from the SPEC via mutate-to-known-input (force the
        # input that makes the spec value render, then assert it) — NEVER read the
        # value back from the dev's source. Flagged with TODO(spec-oracle).
        _outcome = (br.get('expected_outcome') or '').strip()
        _grounding = (
            f"TODO(spec-oracle): mutate the API response to a known input that forces "
            f"the spec-mandated value, then assert it: {_outcome}"
            if _outcome else
            "TODO(spec-oracle): spec has no concrete expected_outcome — add one (or "
            "alternate_values) so the assertion is spec-grounded, not impl-grounded; "
            "else file COVERAGE-GAP."
        )
        tc(
            title=f"Business rule — {br['id']}: {br['description']}",
            flow='business',
            priority='High',
            spec_ref=br['id'],
            precondition='User is on the page',
            steps=[f"Navigate to {page_url}", _anchor_step()],
            expected=(f"{br['id']} — section renders on the live record. {_grounding}"),
        )
    # ── Authorization ──
    # Two distinct scenarios:
    #   AUTH-unauth  → no session cookie → server middleware redirects to /auth/signin
    #   AUTH-no-perm → valid session but user lacks the required role → page renders
    #                  a permission-denied alert in-place (form not rendered)
    if spec['roles']:
        tc(
            title='Authorization — unauthenticated user redirected to login',
            flow='auth',
            priority='High',
            spec_ref='AUTH-unauth',
            precondition='Anonymous client — no auth cookies',
            steps=[
                'Create a fresh APIRequestContext with storageState: { cookies: [], origins: [] }',
                f'GET {page_url} with maxRedirects: 0',
                'Assert response status is 302 or 307 AND Location header matches /auth/(signin|login) with a callbackUrl param',
            ],
            expected='Anonymous GET returns 302/307 redirect to /auth/signin?callbackUrl=… (form not accessible without auth).',
            no_auth=True,
        )
        for role in spec['roles'][:2]:
            tc(
                title=f'Authorization — "{role}" role sees correct elements',
                flow='auth',
                priority='Medium',
                spec_ref='AUTH-role',
                precondition=f'User is logged in with "{role}" role',
                steps=[
                    f'Log in as "{role}" user',
                    f'Navigate to {page_url}',
                    'Verify which fields, buttons, and actions are visible',
                ],
                expected=f'Visible/hidden elements match "{role}" permission spec.',
                # The suite authenticates once, as a single account (auth.setup.ts writes one
                # storageState at UI_AUTH_TENANT=root). "Log in as <role>" therefore cannot
                # happen: run as-is, this TC re-asserts what the SAME privileged user sees and
                # goes green without ever exercising the role it names — a vacuous pass that
                # reads in the report as "permission covered". Skipped with a typed reason until
                # a second, lower-privilege account exists and the suite carries a storageState
                # per role. Un-skip by giving that role its own storageState, then deleting the
                # skip_reason below.
                skip_reason=(
                    f'NEEDS_SECOND_ACCOUNT: cannot run as "{role}" — the suite has one '
                    f'storageState (the privileged setup account), so this TC would assert '
                    f'the wrong identity and pass vacuously.'
                ),
            )

    return tcs


_BAD_STRING_VARIANTS_BY_TYPE = {
    'free_text':       ['longNoSpace', 'empty'],
    'free_text_multi': ['longNoSpace', 'empty', 'longSpaced'],
    'free_text_intl':  ['longNoSpace', 'empty', 'cjkEmojiRtl'],
}


def build_layout_discovery_test_cases(spec: dict, start_id: int) -> list[dict]:
    """Emit deterministic layout-discovery TCs from spec.layout_stress.

    Each TC has category='layout-discovery' and a layout_stress sub-dict with
    the field name + bad-string variant. generate_scripts.py reads these to
    emit the correct mock fixture + invariant assertion code.
    """
    ls = spec.get('layout_stress')
    if not ls or not isinstance(ls, dict):
        return []
    stress_fields = ls.get('stress_fields') or []
    if not stress_fields:
        return []
    row_selector = ls.get('row_selector', '').strip()
    detail = ls.get('detail_surface') if isinstance(ls.get('detail_surface'), dict) else {}
    detail_container = (detail.get('container_selector') or '').strip() if detail else ''
    # Need at least one surface to stress against: a repeating list row OR a detail surface.
    if not row_selector and not detail_container:
        return []

    tcs: list[dict] = []
    tc_id = start_id

    # ── Surface 1: repeating list/table/card rows ─────────────────────────────
    if row_selector:
        for sf in stress_fields:
            field = sf.get('field', '').strip()
            ftype = sf.get('type', 'free_text')
            only_when = sf.get('only_when') or {}
            variants = _BAD_STRING_VARIANTS_BY_TYPE.get(ftype, _BAD_STRING_VARIANTS_BY_TYPE['free_text'])
            for variant in variants:
                steps = [
                    f"Mock list API with default fixtures, replace '{field}' on stressed row with LAYOUT_BAD_STRINGS.{variant}",
                    f"Goto page and wait for row_selector '{row_selector}' count >= 1",
                    f"Measure baseline row height from a normal (non-stressed) row",
                    f"Assert assertNoHorizontalPageScroll(page)",
                    f"Assert assertChildWithinParent for the '{field}' text inside the stressed row",
                    f"Assert assertMaxRowHeight on the stressed row (max = 2x baseline, fallback 200px)",
                ]
                if variant == 'empty':
                    steps.append("Assert assertNoUndefinedRender(page) — must NOT render literal 'undefined' or 'null'")

                tcs.append({
                    'id': tc_id,
                    'title': f"Layout invariants hold when list '{field}' = {variant}",
                    'priority': 'P2',
                    'spec_ref': 'layout_stress',
                    'flow': 'layout-discovery',
                    'page': spec.get('page_url', ''),
                    'category': 'layout-discovery',
                    'spec_only': False,
                    'precondition': 'User is on the page; list API is mocked',
                    'steps': steps,
                    'expected': f"Layout invariants hold when list '{field}' contains adversarial value '{variant}'",
                    'test_data': {},
                    'layout_stress': {
                        'surface': 'row',
                        'row_selector': row_selector,
                        'field': field,
                        'variant': variant,
                        'only_when': only_when,
                        'baseline_row_field': ls.get('baseline_row_field', ''),
                    },
                })
                tc_id += 1

    # ── Surface 2: single-record detail (sheet / dialog / detail panel) ───────
    # The list-row pass never touches a detail surface: a free-text field shown in
    # a Sheet/dialog (e.g. a triage-screen title + full-text box) overflows on its
    # own, independent of any row. A long UNBROKEN (no-space) value has no wrap
    # opportunity, so a container missing overflow-wrap/break-words runs off-screen.
    # This is exactly the class VIF Verification Fixtures mandate as "full text
    # visible … without overflow" on a named surface (see SKILL Step 2c-layout).
    if detail_container:
        text_selectors = [s for s in (detail.get('text_selectors') or []) if s]
        open_step = (detail.get('open_step') or '').strip()
        item_api = (detail.get('item_api_pattern') or '').strip()
        for sf in stress_fields:
            field = sf.get('field', '').strip()
            ftype = sf.get('type', 'free_text')
            variants = _BAD_STRING_VARIANTS_BY_TYPE.get(ftype, _BAD_STRING_VARIANTS_BY_TYPE['free_text'])
            for variant in variants:
                steps = [
                    f"Mock detail (item) API, set '{field}' = LAYOUT_BAD_STRINGS.{variant}",
                    open_step or f"Open the detail surface ('{detail_container}')",
                    f"Assert the surface '{detail_container}' is visible",
                    f"Assert assertNoHorizontalPageScroll(page)",
                    f"Assert every element rendering '{field}' stays within '{detail_container}' (no horizontal overflow)",
                ]
                if variant == 'empty':
                    steps.append("Assert assertNoUndefinedRender(page) — must NOT render literal 'undefined' or 'null'")

                tcs.append({
                    'id': tc_id,
                    'title': f"Layout invariants hold when detail '{field}' = {variant}",
                    'priority': 'P2',
                    'spec_ref': 'layout_stress/detail_surface',
                    'flow': 'layout-discovery',
                    'page': spec.get('page_url', ''),
                    'category': 'layout-discovery',
                    'spec_only': False,
                    'precondition': 'User opens the detail surface; item API is mocked',
                    'steps': steps,
                    'expected': f"Detail surface renders '{field}'='{variant}' without overflow",
                    'test_data': {},
                    'layout_stress': {
                        'surface': 'detail',
                        'row_selector': row_selector,
                        'field': field,
                        'variant': variant,
                        'container_selector': detail_container,
                        'text_selectors': text_selectors,
                        'open_step': open_step,
                        'item_api_pattern': item_api,
                    },
                })
                tc_id += 1

    return tcs


def build_visual_assertion_test_cases(spec: dict, next_id: int) -> list[dict]:
    """Emit one TC per business_rule that has visual_assertions[].
    Required by references/spec-synthesis.md 2c-visual + references/test-case-generation.md Step 4c: every BR with non-empty
    visual_assertions must produce both a text assertion AND a class/attribute
    assertion. Generator was previously silent (DRTP List 2026-05-28 incident).
    """
    page_url = spec.get('page_url', '')
    out: list[dict] = []
    n = next_id
    for br in spec.get('business_rules', []) or []:
        if not isinstance(br, dict):
            continue
        vas = br.get('visual_assertions') or []
        if not vas:
            continue
        steps = [f"Navigate to {page_url}", "Wait for the page to finish loading"]
        for va in vas:
            if not isinstance(va, dict):
                continue
            scope = va.get('selector_scope', '')
            value = va.get('value', '')
            vtype = va.get('type', 'has-class')
            if not scope or not value:
                continue
            if vtype == 'has-class':
                steps.append(f"Verify element at selector '{scope}' has CSS class '{value}'")
            elif vtype == 'has-attribute':
                steps.append(f"Verify element at selector '{scope}' has attribute matching '{value}'")
            elif vtype == 'has-animation':
                steps.append(f"Verify element at selector '{scope}' has animation class '{value}'")
        if len(steps) <= 2:
            continue
        # Visual variant assertions require ALL tokens to render simultaneously.
        # On real backends only the currently-present variants render, so tag
        # the assertion steps as fixture-dependent → auto-skip on real-mode.
        step_deps = ['any'] * 2 + ['fixture'] * (len(steps) - 2)
        rec = {
            'id': n,
            'title': f"Visual — {br.get('id', 'BR')}: {br.get('description', 'visual rule')}",
            'flow': 'visual',
            'page': page_url,
            'priority': 'Medium',
            'spec_ref': br.get('id', 'BR-visual'),
            'precondition': 'User is on the page; fixture renders all variant tokens',
            'steps': steps,
            'step_deps': step_deps,
            'expected': 'Each variant renders with the spec-defined CSS class/attribute token.',
            'test_data': None,
            'spec_only': False,
            'category': 'visual',
            'skip_reason_real': 'visual-variant TC: needs mock fixture rendering all variant tokens simultaneously',
        }
        out.append(rec)
        n += 1
    return out


def _derive_content_anchor(spec: dict) -> str | None:
    """Find a text string that appears ONLY on the populated/happy page, used to
    assert that error/forbidden states do NOT render real content.

    Priority: testing_scope.content_anchor → first ui_behavior expected_visual
    section name → first business_rule name. Returns None if nothing usable.
    """
    ts = spec.get('testing_scope') or {}
    if ts.get('content_anchor'):
        return str(ts['content_anchor'])
    for ui in spec.get('ui_behaviors', []) or []:
        # prefer a behavior describing required sections
        txt = (ui.get('expected_visual') or '')
        m = re.search(r"\b([A-Z][A-Za-z ]{3,40}?)\b(?: section| heading)", txt)
        if m:
            return m.group(1).strip()
    return None


def _derive_detail_anchor(spec: dict) -> str | None:
    """Text present ONLY inside a successfully-loaded DETAIL (dialog/sheet/panel),
    used to assert that detail-scoped error states (403/404/500 on drill-in) do NOT
    leak successful content. Priority: testing_scope.detail_content_anchor → None.
    """
    ts = spec.get('testing_scope') or {}
    v = ts.get('detail_content_anchor')
    return str(v) if v else None


def _path_sig(text: str) -> tuple:
    """(verb, path segments) of a trigger string or a mock pattern. A placeholder
    segment (`{id}`, `*`) is KEPT as '*' rather than dropped, so '/actors' and
    '/actors/{id}' stay distinct — collapsing them let a detail-GET TC claim the
    409-on-POST-/actors id. Verb defaults to GET, which is what every emitter here
    mocks; a PUT/POST/DELETE trigger therefore never matches a read TC, because
    mocking the same URL is not the same as driving the Save that calls it."""
    verb = 'GET'
    vm = re.match(r'\s*(GET|POST|PUT|PATCH|DELETE)\b', text or '', re.I)
    if vm:
        verb = vm.group(1).upper()
    m = re.search(r'/api/[\w{}\-*/]+', text or '')
    if not m:
        return ()
    segs = []
    for x in m.group(0).split('?')[0].split('/'):
        if not x or x == 'api':
            continue
        segs.append('*' if (x.startswith('{') or x == '*') else x.lower())
    while segs and segs[-1] == '*' and len(segs) > 1 and segs[-2] == '*':
        segs.pop()
    return (verb, tuple(segs))


def _ui_behavior_id(spec: dict, need: tuple, avoid: tuple = ()) -> str:
    """The `ui_behaviors:` id whose text carries every word in `need` and none in
    `avoid` — ONLY when exactly one row qualifies. Ambiguity returns '' and the
    caller keeps its generic ref: a WRONG id is worse than an invented one, because
    an invented ref reads as untraced while a wrong one reads as covered.
    Without this the builders stamped `UI-loading` / `UI-select` on TCs whose spec
    declared UI-001..UI-003, so every declared UI behaviour read as uncovered."""
    hits = []
    for r in (spec.get('ui_behaviors') or []):
        if not isinstance(r, dict):
            continue
        rid = str(r.get('id') or '')
        if not rid.startswith('UI-'):
            continue
        blob = ' '.join(str(r.get(k, '')) for k in ('name', 'condition', 'expected_visual')).lower()
        if all(w in blob for w in need) and not any(w in blob for w in avoid):
            hits.append(rid)
    return hits[0] if len(hits) == 1 else ''


# Words in an error-catalogue trigger that mark it as ITEM (detail drill-in) scoped.
_ITEM_TRIGGER_RE = re.compile(
    r'/\{|/\*|/[^/\s]+/\*|\bclick|\bclicked|\bdetail\b|\bdrill|\bopen(?:ed|ing)?\b|\bcard\b|\brow\b',
    re.I,
)


def build_exception_test_cases(spec: dict, em: dict, start_id: int,
                               existing_tcs: list[dict] | None = None) -> list[dict]:
    """Fix B — emit ONE executable unhappy-path TC per error-catalogue entry and per
    screen exception state, ENDPOINT-AWARE.

    A master-detail page fetches a COLLECTION on load and an ITEM on drill-in. Error
    states are emitted against BOTH endpoint classes — the historical single-pattern
    behaviour silently dropped detail-scoped 403/404/500 coverage (only the first
    api_contract was intercepted, and `wanted` deduped each kind globally). A 401
    returned by the data API *while authenticated* (session expired mid-flight) is
    emitted IN ADDITION to the unauthenticated → sign-in redirect TC.

    Each TC carries a `mock_routes` block so generate_scripts.py turns it into a real
    page.route() interception that EXECUTES and FAILS when the app mishandles the
    state. Detail-scoped TCs prepend a drill-in step so the detail fetch actually
    fires; they need testing_scope.detail_content_anchor to assert non-leakage —
    without it they are emitted as visible spec_only stubs (a reviewable gap, not a
    false-passing page-load test).
    """
    page_url = em.get('_real_page_url') or spec.get('page_url', '')
    patterns = derive_api_patterns(spec, em)
    coll = patterns.get('collection')
    item = patterns.get('item')
    anchor = _derive_content_anchor(spec)          # present only on the populated LIST
    detail_anchor = _derive_detail_anchor(spec)    # present only in a loaded DETAIL
    out: list[dict] = []
    n = start_id

    def _scope_of(e: dict, status) -> str:
        """Collection- or item-scoped, decided from the entry's OWN routing fields.

        On grammar 0.4 the CT's `Applies To` column, carried onto the entry as
        `applies_to`, is a lookup rather than a guess — prefer it. Otherwise §2c-exception
        is explicit that the `trigger` is what routes the entry, and only the trigger:
        scanning `message` too let one word of prose decide the endpoint. A collection
        row whose message read "…distinguishes this from the 403 row" matched `\brow\b`
        and was filed as item-scoped, so its id silently left the collection bucket and
        reported as an uncovered error path.
        """
        c = _contract_of_error(spec, e)
        if c:
            ep = re.sub(r'\?.*$', '', str(c.get('endpoint') or c.get('pattern') or '')).rstrip('/')
            if re.search(r'/(\{[^}]+\}|\*|:[A-Za-z_]+)$', ep):
                return 'item' if item else 'collection'
            return 'collection'
        if item and (status == 404 or _ITEM_TRIGGER_RE.search(str(e.get('trigger') or ''))):
            return 'item'
        return 'collection'

    # Collect exception kinds keyed by (scope, kind), richest entry per key.
    wanted: dict[tuple, dict] = {}
    bucket_ids: dict[tuple, list[tuple[str, tuple]]] = {}
    for e in spec.get('error_catalogue', []) or []:
        blob = ' '.join(str(e.get(k, '')) for k in ('trigger', 'message', 'id'))
        status = e.get('status_code')
        # A row declaring a 2xx is the EMPTY/DEGENERATE-PAYLOAD contract, not an error.
        # Bucketing it by kind sent it to the not-found emitter, which mocks 404 while
        # citing the row's id — so a spec row demanding "200 + zero rows renders the calm
        # empty state" was reported as covered by a test that forces the Error state
        # instead (§2c-sections: force 200 + zero rows, NEVER 404). Measured on two
        # suites: a 200 row and a 204 row, both mocked 404.
        # build_declared_error_test_cases owns these.
        if status is not None and 200 <= status < 300:
            continue
        kind = error_kind(status, blob)
        scope = _scope_of(e, status)
        if status == 401:
            # In-session API 401 (token expired) — distinct from the unauth redirect.
            kind = 'session_expired'
            # Also keep an auth marker so the unauthenticated-redirect TC still emits.
            wanted.setdefault(('collection', 'auth'), {
                'er_id': e.get('id', ''), 'status': 401, 'ui_text': '', 'recovery': ''})
        wanted.setdefault((scope, kind), {
            'er_id': e.get('id', ''),
            'status': status,
            'ui_text': (e.get('ui_text') or '').strip(),   # exact on-screen substring, if known
            'recovery': e.get('recovery_action', '') or '',
        })
        # `wanted` keeps the RICHEST entry per bucket and drops the rest — which is
        # why a spec declaring 500s on the list, on Save and on Suspend produced one
        # TC citing one id while the other two ids read as untested. Keep the full
        # roster alongside, each with its own endpoint signature, so an emitter can
        # cite every id that its mocked endpoint genuinely covers — and only those.
        bucket_ids.setdefault((scope, kind), []).append(
            (str(e.get('id') or ''), _path_sig(str(e.get('trigger') or '')), status))
    # Screen states (Empty/Loading/Error/Forbidden) imply COLLECTION (page-load) kinds.
    for screen in spec.get('screens', []) or []:
        for st in (screen.get('states') or []):
            sl = str(st).lower()
            k = ('loading' if 'loading' in sl else
                 'not_found' if 'empty' in sl or 'not' in sl else
                 'forbidden' if 'forbid' in sl else
                 'server_error' if 'error' in sl and 'config' not in sl else None)
            if k:
                wanted.setdefault(('collection', k), {'er_id': '', 'status': None, 'ui_text': '', 'recovery': ''})

    def _emit(title, spec_ref, precondition, mock_routes, steps, expected,
              priority='High', no_auth=False, spec_only=False):
        nonlocal n
        rec = {
            'id': n, 'title': title, 'flow': 'error', 'page': page_url,
            'priority': priority, 'spec_ref': spec_ref, 'precondition': precondition,
            'steps': steps, 'step_deps': ['any'] * len(steps),
            'expected': expected, 'test_data': None, 'spec_only': spec_only,
            'category': 'exception',
        }
        if mock_routes:
            rec['mock_routes'] = mock_routes
        if no_auth:
            rec['no_auth'] = True
        out.append(rec)
        n += 1

    def _get(scope, kind):
        return wanted.get((scope, kind))

    def _fb(w, mocked_status, default):
        """The bucket's representative id as a fallback — but only when its declared
        status is the one this TC mocks. `wanted` keeps the RICHEST entry per (scope,
        kind) bucket, and kind is coarser than status, so the representative can be a
        422 row sitting in the not_found bucket; handing it back unconditionally
        re-introduced through the fallback exactly the mis-citation `_refs` filters
        out."""
        st = (w or {}).get('status')
        if (w or {}).get('er_id') and (st is None or mocked_status is None or st == mocked_status):
            return w['er_id']
        return default

    def _refs(scope, kind, pattern, fallback, mocked_status=None):
        """Every declared id in this bucket that the TC genuinely covers, comma-joined.

        Two conditions, both required. The endpoint signature must match the one the TC
        mocks — an id on a different endpoint stays visible as an uncovered path instead
        of being absorbed by a TC that never exercises it. And the id's declared status
        must be the status this TC actually returns: these emitters hardcode 404 / 403 /
        500, while `kind` bucketing is coarser than the status (a 422 whose prose says
        "not found" lands in the not_found bucket), so signature alone let a row
        declaring 422 be reported as covered by a test that mocks 404. A row with no
        declared status is still claimed — it has nothing to contradict."""
        sig = _path_sig(pattern or '')
        # Both signatures must be known AND equal. An unknown one is not a licence to
        # co-cite: the whole point is that an id is only claimed by a TC that really
        # exercises its endpoint with its verb.
        ids = [i for i, s_, st_ in (bucket_ids.get((scope, kind)) or [])
               if i and sig and s_ and s_ == sig
               and (mocked_status is None or st_ is None or st_ == mocked_status)]
        return ', '.join(dict.fromkeys(ids)) or fallback

    def _hidden_step():
        return [f"Verify '{anchor}' is hidden"] if anchor else []

    # Canonical drill-in step — the translator clicks the first data row to open detail.
    DRILL = "Open the first record's detail (click the first data row)"

    # ── COLLECTION: not-found / empty ──
    if _get('collection', 'not_found') and coll:
        w = _get('collection', 'not_found')
        steps = _hidden_step()
        if w['ui_text']:
            steps.append(f"Verify '{w['ui_text']}' is visible")
        elif not anchor:
            steps.append("Verify the not-found or empty state is displayed")
        _emit(
            title=f"Exception — {w['er_id'] or 'not-found'}: list returns nothing → graceful empty/not-found state",
            spec_ref=_refs('collection', 'not_found', coll,
                           _fb(w, 404, _ui_behavior_id(spec, ('empty',), ('filter', 'sheet', 'dialog'))
                               or 'ER-not-found'), mocked_status=404),
            precondition='The list API returns 404 / an empty result',
            mock_routes=[{'pattern': coll, 'response': {'status': 404, 'body': {'error': 'not found'}}}],
            steps=steps,
            expected='A 404/empty list renders a graceful state; populated content is not shown.',
        )

    # ── COLLECTION: forbidden (403) ──
    if _get('collection', 'forbidden') and coll:
        w = _get('collection', 'forbidden')
        steps = _hidden_step()
        if w['ui_text']:
            steps.append(f"Verify '{w['ui_text']}' is visible")
        elif not anchor:
            steps.append("Verify the forbidden or access-denied state is displayed")
        _emit(
            title=f"Exception — {w['er_id'] or 'forbidden'}: list 403 renders a distinct forbidden state",
            spec_ref=_refs('collection', 'forbidden', coll, _fb(w, 403, 'ER-forbidden'), mocked_status=403),
            precondition='The list API returns 403 (insufficient scope/permission)',
            mock_routes=[{'pattern': coll, 'response': {'status': 403, 'body': {'error': 'forbidden'}}}],
            steps=steps,
            expected='A 403 on the list renders a distinct forbidden state; populated content is not shown.',
        )

    # ── COLLECTION: server error (5xx) ──
    if _get('collection', 'server_error') and coll:
        w = _get('collection', 'server_error')
        steps = _hidden_step()
        if w['ui_text']:
            steps.append(f"Verify '{w['ui_text']}' is visible")
        elif not anchor:
            steps.append("Verify the error state is displayed")
        if 'retry' in (w['recovery'] or '').lower():
            steps.append("Verify 'Retry' button is visible")
        _emit(
            title=f"Exception — {w['er_id'] or 'server-error'}: list 5xx renders an error state with recovery (no crash)",
            spec_ref=_refs('collection', 'server_error', coll, _fb(w, 500, 'ER-server-error'), mocked_status=500),
            precondition='The list API returns 500',
            mock_routes=[{'pattern': coll, 'response': {'status': 500, 'body': {'error': 'server error'}}}],
            steps=steps,
            expected='A 5xx renders a graceful error state (and a recovery action where specified); no white-screen.',
        )

    # ── COLLECTION: session expired (in-session 401) ──
    if _get('collection', 'session_expired') and coll:
        w = _get('collection', 'session_expired')
        steps = _hidden_step()
        steps.append("Verify a session-expired / sign-in prompt is shown OR the URL redirects to '/auth/signin' (no stale rows)")
        _emit(
            title=f"Exception — {w['er_id'] or 'session'}: list 401 (session expired) does not render stale rows",
            spec_ref=_refs('collection', 'session_expired', coll, _fb(w, 401, 'ER-session'), mocked_status=401),
            precondition='Authenticated context, but the list API returns 401 (token expired mid-session)',
            mock_routes=[{'pattern': coll, 'response': {'status': 401, 'body': {'error': 'unauthorized'}}}],
            steps=steps,
            expected='A 401 mid-session degrades gracefully: no stale rows; redirect or re-auth prompt, not a crash.',
        )

    # ── COLLECTION: loading (delayed response → skeleton) ──
    if _get('collection', 'loading') and coll:
        steps = ["Verify element at selector '[data-slot=\"skeleton\"], .animate-pulse' is visible"]
        if anchor:
            steps.append(f"Verify '{anchor}' is visible")
        _emit(
            title="Exception — loading skeleton shows while the list API is in-flight",
            spec_ref=_ui_behavior_id(spec, ('loading',), ('sheet', 'dialog', 'drawer', 'detail', 'panel'))
                     or _ui_behavior_id(spec, ('skeleton',), ('sheet', 'dialog', 'drawer', 'detail', 'panel'))
                     or 'UI-loading',
            precondition='The list API response is delayed',
            mock_routes=[{'pattern': coll, 'delay': 3000, 'passthrough': True}],
            steps=steps,
            expected='A loading skeleton renders during the fetch, then resolves to real content.',
            priority='Medium',
        )

    # ── ITEM (detail drill-in): 404 / 403 / 500 ──
    # The list passes through (so a row exists to click); only the detail endpoint
    # errors. Assertion needs a detail content anchor (text present only in a loaded
    # detail). Without one, emit a visible spec_only stub rather than a page-load test
    # that would pass without ever triggering the detail fetch.
    for kind, status, label, why in (
        ('not_found', 404, 'detail-not-found', 'returns 404 for the clicked record'),
        ('forbidden', 403, 'detail-forbidden', 'returns 403 for the clicked record'),
        ('server_error', 500, 'detail-server-error', 'returns 500 for the clicked record'),
    ):
        w = _get('item', kind)
        if not (w and item):
            continue
        mock = [{'pattern': item, 'response': {'status': status, 'body': {'error': label}}}]
        if detail_anchor:
            steps = [DRILL, f"Verify '{detail_anchor}' is hidden"]
            if w['ui_text']:
                steps.append(f"Verify '{w['ui_text']}' is visible")
            _emit(
                title=f"Exception — {w['er_id'] or label}: detail {status} degrades gracefully (no content leak)",
                spec_ref=_refs('item', kind, item, _fb(w, status, f'ER-{label}'), mocked_status=status),
                precondition=f'List loads OK; the detail API {why}',
                mock_routes=mock, steps=steps,
                expected=f'A {status} on the detail endpoint degrades gracefully; successful detail content is not shown.',
            )
        else:
            _emit(
                title=f"Exception — {w['er_id'] or label}: detail {status} should degrade gracefully",
                spec_ref=_refs('item', kind, item, _fb(w, status, f'ER-{label}'), mocked_status=status),
                precondition=f'List loads OK; the detail API {why}',
                mock_routes=mock,
                steps=[DRILL,
                       "# MANUAL: assert the detail panel shows an error and no successful content "
                       "— set testing_scope.detail_content_anchor to auto-assert this"],
                expected=f'A {status} on the detail endpoint degrades gracefully.',
                spec_only=True,
            )

    # ── SECONDARY data surfaces (expanders / tabs / drawers with their OWN endpoint) ──
    # GENERAL GAP this closes (not one feature): derive_api_patterns classifies only the
    # FIRST collection + FIRST item endpoint, so EVERY additional data endpoint declared
    # in api_contracts (a Version-History expander, an Activity tab, a related-items
    # drawer — anything the user opens that fires its own fetch) was silently dropped. Its
    # panel could error with ZERO test noticing: nothing ever asserted it LOADS. (Observed
    # once as Bug #145535, but the fix is endpoint-agnostic — it iterates every declared
    # secondary GET surface.) For each we emit BOTH a load-SUCCESS TC (no mock — a live
    # broken surface shows its error copy and this FAILS) and a load-ERROR TC (mock 5xx →
    # the declared error copy surfaces gracefully).
    _MUTATION_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}
    _covered_pats = {p for p in (coll, item) if p}
    for c in spec.get('api_contracts', []) or []:
        if str(c.get('method', '') or '').upper() in _MUTATION_METHODS:
            continue
        # A real data-fetch surface declares at least one of success/error/trigger.
        if not (c.get('success') or c.get('error') or c.get('trigger')):
            continue
        pat = _contract_pattern(c)
        if not pat or pat in _covered_pats:
            continue
        _covered_pats.add(pat)
        ep = c.get('endpoint', '') or pat
        trig = str(c.get('trigger', '') or '')
        control = _derive_panel_control(trig)
        err_text = _derive_panel_error_text(c.get('error', '') or '')
        # Emit only for a genuine USER-OPENABLE surface (expander / tab / drawer), not a
        # supporting background fetch (e.g. a dropdown-populating call): the click-to-open
        # step is meaningless for the latter and its failure is already exercised by the
        # flow that consumes it. Two signals, either sufficient: (a) the trigger names a
        # discrete open action, or (b) the endpoint is a nested sub-resource (…/{id}/x).
        # A clean, short control label is required so the emitted "Click '<label>'" step
        # is executable — a long prose trigger yields no usable affordance.
        nested_subresource = bool(re.search(r'/(?:\{[^}]+\}|\*|:[A-Za-z_]+)/[A-Za-z]', ep))
        discrete_open = bool(re.search(r'\b(?:expand|open|click|reveal|view|show|toggle|tab)\b',
                                       trig, re.I))
        clean_control = bool(control) and not any(ch in control for ch in '+/()') \
            and 1 <= len(control.split()) <= 5 and len(control) <= 40
        if not (clean_control and (discrete_open or nested_subresource)):
            continue
        # Surface lives inside a drilled-in record when its trigger says so, or its path
        # nests under a record id (…/{id}/…) — then open the detail first.
        in_detail = nested_subresource or bool(
            re.search(r'detail|sheet|drawer|dialog|drill|row', trig, re.I))
        prelude = [DRILL] if in_detail else []
        open_step = f'Click "{control}"'
        label = control
        slug = _endpoint_slug(control or ep)

        # Load SUCCESS — NO mock. On a live-broken surface the error copy is visible and
        # this assertion FAILS: this is the check that was missing. Assert via a page-wide
        # `text=` selector, NOT scoped getByText — the surface often renders in a dialog/
        # sheet PORTAL outside <main>, where a main-scoped text query would miss it and
        # pass vacuously (the very failure mode being fixed).
        pos_steps = prelude + [open_step]
        pos_steps.append(f"Verify element at selector 'text={err_text}' is hidden" if err_text
                         else "Verify no error/failed-to-load state is shown in the panel")
        _emit(
            title=f"{label} loads its data without error (live)",
            spec_ref=f'API-{slug}-load',
            precondition='The record detail is open; the data surface is reachable',
            mock_routes=None,
            steps=pos_steps,
            expected=(f"Opening '{label}' loads its content; no error/failed-to-load "
                      f"state ({err_text!r}) is shown." if err_text
                      else f"Opening '{label}' loads its content; no error/failed-to-load "
                           "state is shown."),
            priority='High',
        )
        # Load ERROR — mock 5xx → the declared error copy surfaces gracefully. Page-wide
        # `text=` selector for the same portal reason as the success case above.
        err_steps = prelude + [open_step]
        err_steps.append(f"Verify element at selector 'text={err_text}' is visible" if err_text
                         else "Verify an error/failed-to-load state is shown (no crash, no silent empty)")
        _emit(
            title=f"{label} 5xx degrades gracefully",
            spec_ref=f'API-{slug}-error',
            precondition='The record detail is open; the data surface endpoint returns 500',
            mock_routes=[{'pattern': pat, 'response': {'status': 500, 'body': {'error': 'panel-500'}}}],
            steps=err_steps,
            expected=(f"A 5xx on this surface shows '{err_text}'" if err_text
                      else "A 5xx on this surface shows a graceful error state")
                     + "; the app does not crash or show stale/empty content as success.",
        )

        # ── EMPTY-state oracle (Bug #145660 class) ──
        # A surface with a spec'd Empty state must render EMPTY — not the Error state —
        # when it has no data yet. Only emit when BOTH the empty copy and the error copy
        # are known, so the assertion can prove the RIGHT state is shown (empty visible)
        # AND the WRONG one is not (error hidden). Fully mockable, no seeding: mock 404
        # (the way a not-yet-created sub-resource is surfaced) and assert empty≠error.
        empty_text = _derive_panel_empty_text(c)
        if empty_text and err_text:
            empty_steps = prelude + [
                open_step,
                f"Verify element at selector 'text={empty_text}' is visible",
                f"Verify element at selector 'text={err_text}' is hidden",
            ]
            _emit(
                title=f"{label} shows the empty state (not an error) when it has no data",
                spec_ref=f'API-{slug}-empty',
                precondition='The record detail is open; the data surface has no data yet (404 / no rows)',
                mock_routes=[{'pattern': pat, 'response': {'status': 404, 'body': {'error': 'no-data'}}}],
                steps=empty_steps,
                expected=(f"With no data the surface shows the empty state '{empty_text}' and NOT "
                          f"the error state '{err_text}' (a 404/no-data must map to Empty, not Error)."),
            )

        # ── STATE-FIT layout (Bug #145661 class) ──
        # A non-default panel STATE (Error alert + Retry, Empty CTA) can overflow a
        # narrow container with NORMAL data — no long string — so the long-no-space auto
        # guard never fires it. Force the error state and assert every control inside the
        # detail-surface container stays within bounds. Rendered by _render_layout_state_test.
        # Only when the surface declares a spec'd error copy (err_text) so the forced state
        # is spec-grounded — this is also exactly what the Step 4.5 gate demands (has_error).
        if err_text:
            out.append({
                'id': n,
                'title': f"{label} error state fits the detail surface (no control overflow)",
                'flow': 'layout-discovery', 'page': page_url, 'priority': 'Medium',
                'spec_ref': f'API-{slug}-state-fit', 'category': 'layout-discovery',
                'precondition': 'The record detail is open; the data surface is in its error state',
                'steps': [
                    open_step,
                    f"Assert every interactive control inside the detail surface stays within its "
                    f"right edge (surface in the {label} error state)",
                ],
                'step_deps': ['any', 'mock-only'],
                'expected': (f"In its error state the {label} panel's controls (alert + Retry) stay within "
                             "the detail surface; no in-sheet control overflows the surface right edge."),
                'test_data': None, 'spec_only': False,
                'layout_stress': {
                    'surface': 'state', 'state': 'error', 'mock_status': 500,
                    'container_selector': '[role="dialog"]',
                    'item_api_pattern': pat,
                    'row_selector': 'tbody tr',
                    'panel_anchor': err_text,
                    'open_step': open_step,
                },
            })
            n += 1

    # ── auth (401 → redirect to sign-in) ──
    # Skip if the primary builder already emitted an auth/unauth TC (avoid duplicate).
    _has_auth_tc = any((t.get('flow') == 'auth' or t.get('no_auth'))
                       for t in (existing_tcs or []))
    w_auth = _get('collection', 'auth')
    if w_auth and not _has_auth_tc:
        _emit(
            title=f"Exception — {w_auth['er_id'] or 'auth'}: unauthenticated access redirects to sign-in",
            spec_ref=w_auth['er_id'] or 'ER-auth',
            precondition='No auth session (cookies cleared)',
            mock_routes=None,
            steps=[
                "Clear all cookies and storage",
                f"Navigate to {page_url}",
                "Verify URL contains '/auth/signin'",
            ],
            expected='Anonymous access is redirected to the sign-in page.',
            no_auth=True,
        )

    return out


# ── Declared-error coverage beyond the collection/item pair ──────────────────
# derive_api_patterns classifies a page's APIs into exactly TWO buckets, a
# collection and an item. Measured on VIF-GOV-003 that screen calls SEVEN
# endpoints, so every error row belonging to the create (POST), the revise (PUT),
# the revision sub-resource and the two cross-BC Analytics reads had no bucket,
# no TC and no way to be noticed — 12 of 22 declared error paths, all reported by
# the gate as UNCITED. The pair is right for the drill-in shape it was written
# for; it is not the whole surface.
#
# This builder takes the other route: walk the error catalogue the author already
# writes, resolve each row to the api_contract it names, and emit a TC for the
# rows the collection/item emitters could not reach. The endpoint is mocked with
# its own METHOD, so a create-422 does not also serve 422 to the list read that
# shares its URL.


def _norm_tok(s) -> str:
    return re.sub(r'[^a-z0-9]', '', str(s or '').lower())


def _lcs_len(a: str, b: str) -> int:
    """Longest common substring length — used only to rank candidates, never as a
    match test, so a weak overlap loses to a strong one instead of being accepted."""
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    best = 0
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best = cur[j]
        prev = cur
    return best


def _task_screen_rows(spec: dict, key: str) -> list:
    ts = spec.get('task_screen') or {}
    screens = ts.get('screens') or []
    if isinstance(screens, dict):
        screens = [screens]
    out = []
    for sc in screens:
        if isinstance(sc, dict):
            out.extend(sc.get(key) or [])
    return out


def _contract_of_error(spec: dict, e: dict):
    """The api_contract an error_messages row belongs to, or None.

    Two evidence-based joins, in order. §2c-exception tells the author to carry the
    CT `Applies To` column onto the entry, so `applies_to` naming the contract is the
    primary key; a verb+path signature match between the row's trigger and the
    contract's endpoint is the fallback. An unmatched row returns None and stays
    visible as an uncovered path — guessing which endpoint a row meant is how a
    detail-scoped gap gets absorbed by a list TC that never exercises it.
    """
    contracts = spec.get('api_contracts') or []
    ap = _norm_tok(e.get('applies_to'))
    if ap:
        named = [c for c in contracts
                 if _norm_tok(c.get('name')) and _norm_tok(c.get('name')) in ap]
        if named:
            # Longest name wins: 'GetObjectiveList' over 'GetObjective'.
            return max(named, key=lambda c: len(_norm_tok(c.get('name'))))
    sig = _path_sig(str(e.get('trigger') or ''))
    if sig:
        for c in contracts:
            ep = c.get('endpoint') or c.get('pattern') or ''
            if _path_sig(f"{c.get('method', 'GET')} {ep}") == sig:
                return c
    return None


def _drive_chain(spec: dict, contract: dict) -> tuple:
    """UI steps that make this contract's endpoint fire, derived from the VIF's own
    §Task Screens action table. Returns [] when it cannot be derived.

    The join is the VIF's declaration order, which the grammar fixes: toolbar actions
    first, then one block per surface. A submit action is matched to the contract by
    its `action_key`/`label` appearing in the contract's own `trigger` prose; the
    surface it belongs to is the opening action BEFORE it that opens the surface whose
    name overlaps the trigger most; anything declared between them that reveals an
    inline form (Update Target) is part of the path. Nothing here is invented — every
    label is copied from a declared row.
    """
    trig = _norm_tok(contract.get('trigger'))
    acts = _task_screen_rows(spec, 'actions')
    if not trig or not acts:
        return (), None

    def beh(a):
        return str(a.get('behavior') or '').strip().lower()

    submits = [(i, a) for i, a in enumerate(acts) if beh(a).startswith('submit')]
    hit = ([ia for ia in submits if _norm_tok(ia[1].get('action_key')) and _norm_tok(ia[1]['action_key']) in trig]
           or [ia for ia in submits if _norm_tok(ia[1].get('label')) and _norm_tok(ia[1]['label']) in trig])
    if not hit:
        return (), None
    si, sub = hit[0]

    def opened_surface(a):
        m = re.search(r'opens\s+([A-Za-z]+)', str(a.get('behavior') or ''))
        return _norm_tok(m.group(1)) if m else ''

    openers = [(i, a) for i, a in enumerate(acts) if i < si and opened_surface(a)]
    if not openers:
        # An INLINE task screen needs no opener, and demanding one made every
        # mutation-error TC on such a screen a spec_only stub. On a
        # `task-screen-standard` blueprint the form IS the page: the suite's own
        # beforeEach navigation has already reached it, so the drive chain is
        # legitimately empty. Distinguish that from "cannot derive" by returning the
        # matched submit action — an empty chain WITH a submit is drivable, an empty
        # chain with no submit is not. (Measured on VIF-KNW-005 and VIF-STR-003: 8-11
        # TCs per suite, each already carrying its mock and its verbatim CT oracle.)
        if not any(opened_surface(a) for a in acts) and any(
            str(sc.get('blueprint') or '').strip().lower() == 'task-screen-standard'
            for sc in ((spec.get('task_screen') or {}).get('screens') or [])
        ):
            return [], sub
        return (), None
    best_i, best_a = max(openers, key=lambda ia: (_lcs_len(opened_surface(ia[1]), trig), ia[0]))

    chain = [f"Click '{best_a.get('label')}' button"]
    for i in range(best_i + 1, si):
        if 'inline-form' in beh(acts[i]):
            chain.append(f"Click '{acts[i].get('label')}' button")
    return chain, sub


def _form_field_candidates(form_field: str) -> list:
    """Control-id candidates for a VIF §Task Screens form-field path.

    The VIF names fields by their DTO path (`milestones[].title`,
    `outcomeMetricTargets[].cadenceCronExpression`); the rendered control carries a
    flat id. Try the leaf alone, then the de-pluralised parent prefixed onto it,
    then the whole path camel-joined — the first that exists in the element map wins.
    """
    segs = [x for x in re.split(r'[.\[\]]+', form_field or '') if x]
    if not segs:
        return []
    leaf = segs[-1]
    out = [leaf]
    if len(segs) > 1:
        parent = re.sub(r'(ie)?s$', lambda m: 'y' if m.group(1) else '', segs[-2])
        out.append(parent + leaf[:1].upper() + leaf[1:])
        out.append(segs[-2] + leaf[:1].upper() + leaf[1:])
    camel = segs[0] + ''.join(x[:1].upper() + x[1:] for x in segs[1:])
    out.append(camel)
    return list(dict.fromkeys(out))


def _em_control(em: dict, form_field: str) -> dict:
    """The element-map control a VIF form-field path refers to, or {}."""
    if not em:
        return {}
    index = {}
    for group, tag in (('inputs', 'input'), ('textareas', 'textarea'), ('selects', 'select')):
        for el in (em.get(group) or []):
            for key in (el.get('id'), el.get('name')):
                if key:
                    index.setdefault(str(key).lower(), dict(el, tag=el.get('tag') or tag))
    for cand in _form_field_candidates(form_field):
        hit = index.get(cand.lower())
        if hit:
            return hit
    return {}


def _fill_steps(spec: dict, em: dict | None = None) -> tuple:
    """One fill step per REQUIRED form field the VIF declares.

    The VIF's §Task Screens table only carries a widget kind when the author wrote
    one in parentheses. Grammar 0.4 rows usually do not, so every required field
    landed in `unfilled` and the TC clicked Submit on an EMPTY form: the write never
    fired, the mocked error response never arrived, and the TC failed for a reason
    that had nothing to do with the rule under test. When the cell is silent, ask the
    element map what the control actually is — a <select> is answered by picking one
    of its own options, an <input type=date> IS .fill()able, and only a control the
    map does not know stays in `unfilled` for the caller to flag.
    """
    out, unfilled = [], []
    for f in _task_screen_rows(spec, 'form_fields'):
        req = str(f.get('required') or '').strip().lower()
        if not req.startswith('yes'):
            continue
        raw = str(f.get('form_field') or '')
        label = re.sub(r'\s*\(.*$', '', raw).strip()
        kind = (re.search(r'\(([^)]*)\)', raw) or [None, ''])[1].lower()
        if 'input' in kind and ('number' in kind or 'numeric' in kind):
            out.append(f"Enter '1' in {label}")
            continue
        if 'input' in kind or 'text' in kind:
            out.append(f"Enter 'AUTO check' in {label}")
            continue
        if kind:                      # an explicitly declared combobox/date popover
            unfilled.append(label)
            continue
        el = _em_control(em or {}, label)
        if not el:
            unfilled.append(label)
            continue
        val = field_sample_value(el)
        # Name the CONTROL, not the DTO path: the translator resolves a step's field
        # against the element map, and `milestones[].title` is not an id it can find.
        target = el.get('id') or el.get('name') or label
        if str(el.get('tag') or '').lower() == 'select':
            out.append(f"Select '{val}' from {target}")
        elif el.get('readonly') or el.get('disabled'):
            unfilled.append(label)    # derived/read-only: typing into it is a no-op
        else:
            out.append(f"Enter '{val}' in {target}")
    return out, unfilled


def build_declared_error_test_cases(spec: dict, em: dict, start_id: int,
                                    existing_tcs: list) -> list:
    """One TC per declared error row that the collection/item emitters could not reach."""
    page_url = em.get('_real_page_url') or spec.get('page_url', '')
    patterns = derive_api_patterns(spec, em)
    covered_pats = {patterns.get('collection'), patterns.get('item')} - {None}

    # (pattern, status) pairs an existing TC already mocks — never emit a duplicate.
    already = set()
    for tc in existing_tcs or []:
        for r in (tc.get('mock_routes') or []):
            st = (r.get('response') or {}).get('status')
            if st is not None:
                already.add((r.get('pattern'), int(st), str(r.get('method') or 'GET').upper()))

    out, n = [], start_id
    for e in spec.get('error_catalogue', []) or spec.get('error_messages', []) or []:
        c = _contract_of_error(spec, e)
        if not c:
            continue
        pat = _contract_pattern(c)
        status = e.get('status_code')
        if not pat or status is None:
            continue
        method = str(c.get('method') or 'GET').upper()
        status = int(status)
        if (pat, status, method) in already:
            continue
        if pat in covered_pats and method == 'GET' and not (200 <= status < 300):
            continue        # the collection/item emitters own the error statuses

        er_id = e.get('id') or ''
        ui_text = (e.get('ui_text') or '').strip()
        steps, spec_only, why = [], False, ''
        if method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            open_steps, submit = _drive_chain(spec, c)
            if submit is None:
                spec_only = True
                why = ('the VIF declares no submit action whose key or label appears in this '
                       "contract's trigger, so the path that fires the endpoint cannot be derived")
            else:
                fills, unfilled = _fill_steps(spec, em)
                steps = open_steps + fills + [f"Click '{submit.get('label')}' button"]
                if unfilled:
                    why = ('required field(s) ' + ', '.join(unfilled) +
                           ' are a combobox/date popover — pick their value by hand before this runs')
        if ui_text:
            steps.append(f"Verify '{ui_text}' is visible")
        elif not spec_only:
            steps.append(f"Verify the declared {status} state surfaces without a crash")

        rec = {
            'id': n,
            'title': (f"Exception — {er_id or status}: {method} {c.get('name') or pat} returns "
                      f"{status}{' with an empty payload' if 200 <= status < 300 else ''}"),
            'flow': 'error', 'page': page_url, 'priority': 'High',
            'spec_ref': er_id or f'ER-{status}',
            'precondition': f"{method} {c.get('endpoint') or pat} returns {status}",
            'steps': steps, 'step_deps': ['any'] * len(steps),
            'expected': (ui_text and f"The screen surfaces \"{ui_text}\" and does not crash.")
                        or f"A {status} on {c.get('name') or pat} degrades gracefully.",
            'test_data': None, 'spec_only': spec_only, 'category': 'exception',
            # A declared 2xx row is not an error status — it is the DEGENERATE PAYLOAD
            # case (an empty catalogue, a record whose field was never populated, a 204
            # with nothing in it). Its oracle is the same: the screen must show the
            # declared copy. Serving the declared status with an empty body reproduces
            # every shape — a list resolves to zero items, an item resolves with the
            # field absent, a 204 carries nothing at all.
            'mock_routes': [{'pattern': pat, 'method': method,
                             'response': {'status': status,
                                          'body': ({} if status == 204
                                                   else {'items': [], 'totalCount': 0} if 200 <= status < 300
                                                   else {'error': er_id or 'error'})}}],
        }
        if why:
            rec['notes'] = why
        out.append(rec)
        n += 1
    return out


def backfill_error_citations(spec: dict, tcs: list) -> int:
    """Name every declared error id on the TC that actually exercises its endpoint.

    A builder that emits one TC per exception KIND cites the one id it happened to
    pick from the bucket, so a sibling row on the SAME endpoint and status reads as
    untested even though the TC covers it exactly (the revision-panel 500 rows,
    measured on VIF-GOV-003). The match requires pattern AND status AND method to be
    equal — never status alone, because a list-500 TC and a save-500 TC are
    indistinguishable by status and co-citing them would hide a real gap behind a
    test that never touches it.
    """
    added = 0
    cited = set()
    for tc in tcs:
        for r in re.findall(r'ER-[\w-]+', str(tc.get('spec_ref') or '')):
            cited.add(r)
    for e in spec.get('error_catalogue', []) or []:
        eid = str(e.get('id') or '')
        if not eid or eid in cited:
            continue
        c = _contract_of_error(spec, e)
        if not c:
            continue
        pat, status = _contract_pattern(c), e.get('status_code')
        method = str(c.get('method') or 'GET').upper()
        if not pat or status is None:
            continue
        for tc in tcs:
            for r in (tc.get('mock_routes') or []):
                if (r.get('pattern') == pat
                        and str(r.get('method') or 'GET').upper() == method
                        and (r.get('response') or {}).get('status') == status):
                    tc['spec_ref'] = f"{tc.get('spec_ref', '')}, {eid}".lstrip(', ')
                    cited.add(eid)
                    added += 1
                    break
            else:
                continue
            break
    return added


def build_business_rule_mutation_test_cases(spec: dict, em: dict, start_id: int) -> list[dict]:
    """Fix C — emit a data-mutation TC for each business_rule alternate_value.

    Many BRs describe enum/threshold variants (ControlSignal Adjust/Pivot/Investigate,
    TQI Low/Medium band) that the single live record cannot render. Each alternate_value
    carries the JSON field+value to inject; the resulting TC mutates the real API
    response via mock_routes `mutate`, then asserts the variant's label maps correctly
    and (optionally) that its badge does not reuse the happy-path colour token.
    """
    page_url = em.get('_real_page_url') or spec.get('page_url', '')
    pattern = derive_api_pattern(spec, em)
    if not pattern:
        return []
    out: list[dict] = []
    n = start_id
    for br in spec.get('business_rules', []) or []:
        if not isinstance(br, dict):
            continue
        for alt in br.get('alternate_values', []) or []:
            if not isinstance(alt, dict) or not alt.get('field'):
                continue
            mutate = {alt['field']: alt.get('value')}
            for k, v in (alt.get('also_set') or {}).items():
                mutate[k] = v
            label = alt.get('label', '')
            steps = []
            if label:
                # Scoped to the badge (+ .first()) so a duplicate label elsewhere on the
                # page (e.g. an enum echoed in a <code> block) does not cause a strict-mode clash.
                steps.append(f"Verify badge with text '{label}' is visible")
                if alt.get('not_class'):
                    steps.append(f"Verify badge with text '{label}' does not have CSS class '{alt['not_class']}'")
            if not steps:
                continue
            out.append({
                'id': n,
                'title': f"Visual — {br.get('id', 'BR')}: {label or alt['field']} variant maps + renders distinctly",
                'flow': 'visual', 'page': page_url, 'priority': 'Medium',
                'spec_ref': br.get('id', 'BR-variant'),
                'precondition': f"API response mutated: {alt['field']}={alt.get('value')!r}",
                'steps': steps, 'step_deps': ['any'] * len(steps),
                'expected': f"The {label or alt['field']} variant maps to the correct label and a distinct style.",
                'test_data': None, 'spec_only': False, 'category': 'visual',
                'mock_routes': [{'pattern': pattern, 'mutate': mutate}],
            })
            n += 1
    return out


_A11Y_GROUPS = {
    'aria roles': 'aria',
    'keyboard shortcuts': 'keyboard',
    'focus management': 'focus',
    'screen reader announcements': 'screenreader',
    'non-color indicators': 'noncolor',
}



def build_nav_entry_test_case(spec: dict, start_id: int) -> list[dict]:
    """One TC proving the screen is REACHABLE the way its VIF says it is.

    Every other TC in a suite navigates by `page.goto(route)`, which is exactly
    why a screen can ship with no menu entry at all and still report 100% GO —
    the suite walks in through a door no user can find. This closes that.

    Emitted only when the VIF declares `**Nav:**`. A VIF without it is an embedded
    panel or a drill-in reached from a list row, and demanding a menu entry for
    those would fail correct screens. Route alone is NOT the trigger: every VIF
    declares a route, including the panels.
    """
    nav = spec.get('nav_entry') or {}
    leaf = (nav.get('leaf') or '').strip()
    if not leaf:
        return []
    parent = (nav.get('parent') or '').strip()
    route = spec.get('page_url') or spec.get('route') or ''
    parent_step = (f'If a "{parent}" group is collapsed, expand it first.'
                   if parent else '')
    return [{
        'id': start_id,
        'title': f'Nav entry "{leaf}" reaches the screen',
        'category': 'nav-entry',
        'flow': 'nav',
        'page': route or '/',
        'priority': 'High',
        'spec_only': False,
        'test_data': None,
        'precondition': 'Authenticated as a user holding the read permission this VIF requires.',
        'step_deps': ['any'] * 3,
        'steps': [
            'Navigate to the application root (do NOT go straight to the route).',
            f'Locate "{leaf}" in the primary nav or the sidebar. {parent_step}'.strip(),
            f'Click "{leaf}".',
        ],
        'expected': (
            f'The label "{leaf}" exists in the nav or the sidebar (either is acceptable — '
            f'apps place entries in both) and clicking it lands on {route or "the VIF route"}, '
            f'with the screen\'s own heading visible. Absent from BOTH places = the screen is '
            f'deployed but unreachable, which is a real defect no goto()-based TC can see. '
            f'⚠️ CALIBRATION: before filing, confirm the label by hand. The VIF `**Nav:**` field '
            f'is the same machine-generated family as `**Route:**`, which was measured wrong on '
            f'8 of ~20 VIFs — a stale label here is a spec defect, not a missing menu entry, and '
            f'the two get filed against different owners.'
        ),
        'spec_ref': f'VIF **Nav:** "{leaf}"' + (f' under "{parent}"' if parent else ''),
    }]


def build_a11y_test_cases(spec: dict, em: dict, start_id: int) -> list[dict]:
    """Emit one TC per clause the VIF's `## Accessibility` section declares — no more.

    `## Accessibility` is a VIF requirement, not an optional extra: 33 of 36 VIFs in this
    corpus fill all five bullet groups, and the clauses are concrete enough to assert
    verbatim (role="dialog", aria-live="polite", "auto-focus RawText on open", "StaleBadge
    uses clock icon + 'Stale' text label, not color alone").

    The scope is exactly that section. Unscoped a11y probing is deliberately NOT done here
    (and is removed from the Step 4.3 exploratory gap categories): it is what invented the
    focus-trap check behind the FALSE bug #147402. A probe family that manufactures
    findings is worse than no probe.

    Input is `spec['a11y_requirements']` — the clauses copied verbatim from the VIF, either
    as {group, clause, component} dicts or as bare strings. Emitting nothing when the key is
    absent is correct: a VIF stating "No non-standard interactions — browser defaults apply"
    must produce zero a11y TCs.

    See references/a11y-scoped.md for how to assert each group without tripping the three
    traps that have each already cost a false finding here (immediate activeElement read,
    once-sampled toast, hidden 1x1 Base UI Switch input).
    """
    page_url = em.get('_real_page_url') or spec.get('page_url', '')
    out: list[dict] = []
    n = start_id
    for req in (spec.get('a11y_requirements', []) or []):
        if isinstance(req, str):
            req = {'clause': req}
        clause = str(req.get('clause', '')).strip()
        if not clause:
            continue
        group_raw = str(req.get('group', '')).strip()
        group = _A11Y_GROUPS.get(group_raw.lower(), group_raw.lower() or 'aria')
        component = str(req.get('component', '')).strip()
        ref = str(req.get('spec_ref', '')).strip() or (
            f'VIF §Accessibility {group_raw}' if group_raw else 'VIF §Accessibility')
        # Group-specific reminder of the trap that makes THIS group's assertion lie.
        trap = {
            'focus': 'Poll the SETTLED activeElement (never read it immediately after Tab) '
                     'and keep the trap sentinel INSIDE the dialog — the inverse produced '
                     'the false bug #147402.',
            'screenreader': 'POLL the live region (expect(...) retries); a single delayed '
                            'read produced the withdrawn bug #148977 — toasts auto-dismiss '
                            'in ~4s. A {placeholder} in the quoted string makes it a '
                            'substring assertion, never exact.',
            'noncolor': 'Scope the locator to its ROW — a page-wide badge locator passes off '
                        'an unrelated row. Assert BOTH the text label and the icon; colour '
                        'alone is the defect.',
            'aria': 'Assert the attribute on the named component, not a guessed ancestor. An '
                    'aria-live region is empty until something happens — assert it RECEIVES '
                    'the text, not that it is non-empty on load.',
            'keyboard': 'Esc/Enter are safe to assert directly. Assert Tab ORDER only when '
                        'the VIF states an order, and compare the sequence — never an '
                        'absolute index (a spec delta adding a field would break every '
                        'later assertion).',
        }.get(group, '')
        target = f' on {component}' if component else ''
        out.append({
            'id': n,
            'title': f'A11y ({group}) — {clause[:110]}',
            'flow': 'a11y',
            'page': page_url,
            'priority': 'Medium',
            'spec_ref': ref,
            'precondition': 'Authenticated; the screen is loaded',
            'steps': [
                f'Navigate to {page_url}',
                f'Reach the state the clause applies to{target}',
                f'Assert the declared behaviour: {clause}',
            ],
            'step_deps': ['any'] * 3,
            'expected': (f'{clause}'
                         + (f' {trap}' if trap else '')
                         + ' If the VIF is silent on a nearby behaviour that still looks '
                           'wrong, report it as an observation — do NOT assert it and do '
                           'NOT file it as a bug.'),
            'test_data': None,
            'spec_only': False,
            'category': 'a11y',
            'a11y': {'group': group, 'clause': clause, 'component': component,
                     'source': ref},
                    # Structured oracle authored at Step 2 (spec `assert:`), carried verbatim.
            'assertions': list(req.get('assert') or []),
        })
        n += 1
    return out


def build_enforcement_test_cases(spec: dict, em: dict, start_id: int) -> list[dict]:
    """Emit one NEGATIVE enforcement TC per domain invariant / behavior guard.

    The happy-path state-machine pass (build_descriptive_test_cases §8) emits only the
    SUCCESS direction of a transition (current -> action -> next). Domain guards are the
    REJECTION direction: "performing <action> while <rule> is violated MUST be refused
    and leave state unchanged". The field / HTTP / state-machine passes never read them,
    so a server-side invariant like `Activate(): StartDate >= now` produced ZERO coverage
    until hand-authored.

    Guard sources, by ES grammar:
      * 0.4 — `## Invariants` (7-column DSL: one row = one guard, `Kind` picks the
        violation shape, `Error Code` is the oracle key) and `## Behaviors` (each
        `### {Name}` has a numbered `Steps:` DSL where every `if <cond>: throw '<Code>'`
        is one guard).
      * 0.3 — `## Invariants` free prose and `## Domain Methods` `Pre:` clauses.
    The rename `## Domain Methods` -> `## Behaviors` is load-bearing: extracting only the
    0.3 name from a 0.4 ES yields zero guards, and the dimension-2 gate then reports full
    coverage of nothing.

    For every guard in spec['enforcement_guards'] this pass emits an executable skeleton
    that seeds a VIOLATING state, attempts the guarded action, and asserts the operation
    is rejected + state unchanged. generate_scripts.py reads the `enforcement` sub-dict
    (target / rule / kind / error_code / wire_code / violate) to scaffold the API seed +
    reject assertion, mirroring how exception TCs carry `mock_routes` and layout TCs carry
    `layout_stress`.

    Two oracles come out of this, not one:
      1. the guard fired at all (state unchanged) — always assertable through the UI;
      2. it surfaced the DECLARED code. When `wire_code` is set, that string is observable
         on the mutation response and is asserted. When `wire_code` is empty while
         `error_code` is set, the domain raises an error the boundary publishes no code
         for: the UI has nothing to map and degrades to a generic failure. No VIF section
         mandates that mapping, so no VIF-derived TC can catch it — the gap is written into
         `expected` here so it reaches the report instead of dying in the seam.
    """
    page_url = em.get('_real_page_url') or spec.get('page_url', '')
    out: list[dict] = []
    n = start_id
    for g in (spec.get('enforcement_guards', []) or []):
        # `reachable: false` is the resolver saying this guard cannot be provoked through
        # THIS screen — it belongs to an entity another VIF owns, pulled in only because
        # this screen writes to it indirectly. Emitting a TC for it produces a body with
        # no way to reach the guarded action, and the guard's own screen tests it properly.
        # VIF-GOV-003 resolved 74 guards of which 65 were unreachable and 68 came from
        # ES-ANA-001, an entity this screen does not administer.
        if g.get('reachable') is False or g.get('untestable'):
            continue
        gid     = g.get('id', '')
        target  = g.get('target', '')
        rule    = g.get('rule', '')
        setup   = g.get('violate', '') or (f'a state that VIOLATES the rule "{rule}"' if rule
                                           else 'a state that violates the guard')
        action_ui = g.get('action_ui', '') or (
            f'Attempt "{target}"' if target else 'Attempt the guarded action')
        err_code  = g.get('error_code', '')
        wire_code = g.get('wire_code', '')
        kind      = g.get('kind', '')
        # Code-aware oracle. `wire_code` set -> assert that exact code on the mutation
        # response. `error_code` set with NO `wire_code` -> the boundary publishes nothing
        # for a condition the domain enforces; assert only the observable consequence and
        # carry the unmapped-code gap into the expectation so it is reported rather than
        # silently absorbed by a generic toast (references/spec-synthesis.md 2c-errormap).
        if wire_code:
            code_clause = (f' The response MUST carry error code "{wire_code}" '
                           f'(domain: "{err_code or "—"}"); a rejection under any other code '
                           f'is still a divergence to report — the guard fired, the contract '
                           f'did not.')
        elif err_code:
            code_clause = (f' The domain raises "{err_code}" but the bound CT declares NO wire '
                           f'code for this condition, so do NOT assert a code — assert the '
                           f'observable consequence only, and REPORT the unmapped domain error '
                           f'(spec gap when the CT is silent; dev bug when the CT declares it '
                           f'and the API does not return it).')
        else:
            code_clause = ''
        reject = g.get('reject_expected', '') or (
            f'Operation is REJECTED (guard "{rule or target}" enforced): nothing transitions, '
            f'state is unchanged, and an error/validation message is surfaced.'
            f'{code_clause} '
            f'If the operation SUCCEEDS, the guard is unenforced -> flag as a DEV-BUG '
            f'(test.fail) citing {g.get("source", gid) or "the source spec"}.')
        if g.get('reject_expected', '') and code_clause:
            reject = f'{reject}{code_clause}'
        steps = [
            f'Navigate to {page_url}',
            f'Set up {setup} — seed via API (page.request.post) or fill the form to reach the violating state',
            action_ui if action_ui.endswith(('.', ')')) else action_ui,
        ]
        out.append({
            'id': n,
            'title': f'Enforcement — {target or "guard"} rejected when violated: {rule or "(see source)"}',
            'flow': 'enforcement',
            'page': page_url,
            'priority': 'High',
            'spec_ref': gid or (f'ENF-{target}' if target else 'ENF'),
            'precondition': f'Authenticated; {setup}',
            'steps': steps,
            'step_deps': ['any'] * len(steps),
            'expected': reject,
            'test_data': None,
            'spec_only': False,
            'category': 'enforcement',
            # Structured oracle authored at Step 2 (spec `assert:`), carried verbatim.
            'assertions': list(g.get('assert') or []),
            'enforcement': {
                'target': target,
                'rule': rule,
                'kind': kind,
                'error_code': err_code,
                'wire_code': wire_code,
                # True when the domain enforces a condition the boundary cannot express.
                # generate_scripts.py must NOT emit a code assertion in that case.
                'unmapped_domain_error': bool(err_code and not wire_code),
                'violate': setup,
                'source': g.get('source', gid),
            },
        })
        n += 1
    return out


_NUMERIC_FIELD_NAME_RE = re.compile(
    r'(amount|count|weight|qty|quantity|price|cost|value|score|percent|percentage|'
    r'rate|ratio|number|order|index|version|age|days?|hours?|minutes?|seconds?|'
    r'width|height|size|length|total|sum|min|max|threshold|priority|level)',
    re.IGNORECASE,
)


def _derive_free_text_fields(spec: dict) -> list[str]:
    """Auto-derive the free-text fields whose value can hold a long unbroken
    (no-space) token and therefore overflow its display container.

    Signal (from data the spec ALREADY has — no new author config):
      1. `boundary_constraints.<field>.max` that is length-like (>= 40) and whose
         name is not numeric-looking (excludes value bounds like weight 0-100).
      2. Any field explicitly listed under `layout_stress.stress_fields`.

    Liberal on purpose: a derived field that isn't actually rendered is a no-op at
    runtime (the sentinel simply isn't found), so over-inclusion costs nothing —
    but under-inclusion means a real overflow bug ships untested.
    """
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


def build_auto_overflow_test_cases(spec: dict, start_id: int) -> list[dict]:
    """ALWAYS-ON overflow guard: one executable, selector-free, fixture-free TC per
    free-text field (see _derive_free_text_fields). Each TC mutates the field to a
    long no-space value on every API response, then asserts the value renders within
    bounds on BOTH the list and the first opened detail — catching the "long unbroken
    string breaks layout" class (missing overflow-wrap/break-words/min-w-0) on ANY
    surface without the author declaring selectors. This is the reliability backstop
    that made the Capture Inbox triage-screen overflow (Bug #145274) catchable by
    default rather than only via manual testing.
    """
    free_text = _derive_free_text_fields(spec)
    if not free_text:
        return []
    page_url = spec.get('page_url', '')
    tcs: list[dict] = []
    tc_id = start_id
    for field in free_text:
        steps = [
            f"Mutate '{field}' to a long no-space value on every API response (injectFieldValue, no fixtures)",
            f"Navigate to {page_url} and wait for load",
            f"Assert no horizontal page scroll and the injected '{field}' value renders within the viewport (list surface)",
            "Open the first record's detail (click the first data row) if a list is present",
            f"Assert no horizontal page scroll and the injected '{field}' value renders within bounds (detail surface)",
        ]
        tcs.append({
            'id': tc_id,
            'title': f"Layout — '{field}' renders without overflow on a long no-space value",
            'priority': 'P2',
            'spec_ref': 'auto-overflow',
            'flow': 'layout-discovery',
            'page': page_url,
            'category': 'layout-discovery',
            'spec_only': False,
            'precondition': 'User is on the page; field value is mutated via route interception',
            'steps': steps,
            'expected': f"'{field}' with a long no-space value stays within its container on every surface (no overflow / clipping / horizontal scroll)",
            'test_data': {},
            'layout_stress': {
                'surface': 'auto',
                'field': field,
                'variant': 'longNoSpace',
            },
        })
        tc_id += 1
    return tcs


def build_presentation_invariant_test_cases(spec: dict, start_id: int) -> list[dict]:
    """ALWAYS-ON presentation-invariant sweep — one executable, selector-free,
    fixture-free TC that renders the REAL server data and asserts no content is
    clipped inside a height-capped box that cannot scroll.

    Unlike the overflow guard (which mutates a free-text field to a long no-space
    value and checks HORIZONTAL overflow), this needs no adversarial value: it
    fires on the data as the backend actually returns it and checks VERTICAL
    clipping + dead scrollbars — a class the spec never describes (presentation,
    not behaviour) and the horizontal guard structurally cannot see. It sweeps the
    list surface, then best-effort opens the first record's detail and sweeps that
    (detail sheets are where read-only blobs — JSON, long descriptions — get
    capped and clipped). This is the backstop that makes the Optimization
    Directives "Mutation Space" clipping (Bug: closing brace cut off, scroll dead)
    catchable by default rather than only via manual testing.
    """
    page_url = spec.get('page_url', '')
    return [{
        'id': start_id,
        'title': "Layout — no content is clipped inside a height-capped box that cannot scroll",
        'priority': 'P2',
        'spec_ref': 'auto-clip',
        'flow': 'layout-discovery',
        'page': page_url,
        'category': 'layout-discovery',
        'spec_only': False,
        'precondition': 'User is on the page; real server data is rendered (no fixtures)',
        'steps': [
            f"Navigate to {page_url} and wait for load",
            "Sweep the list surface: assert no element hides content in a max-height/overflow box that cannot scroll",
            "Open the first record's detail (click the first data row) if a list is present",
            "Sweep the detail surface: assert no read-only panel (JSON blob, long text) is vertically clipped with a dead scrollbar",
        ],
        'expected': "Every height-capped / overflow container either fits its content or scrolls to reveal it — no tail of content is silently unreachable on any surface",
        'test_data': {},
        'layout_stress': {
            'surface': 'clip',
        },
    }]


def build_horizontal_overflow_test_cases(spec: dict, start_id: int) -> list[dict]:
    """ALWAYS-ON horizontal-overflow sweep — the horizontal twin of
    build_presentation_invariant_test_cases, and the check that was missing.

    Renders the REAL server data at desktop widths and asserts no declared
    horizontal scroller (shadcn's `<Table>` wrapper is `relative w-full
    overflow-x-auto`) holds content wider than its box. One unbounded cell — a long
    name, an unresolved GUID, a pasted blob — widens its column and pushes the
    trailing columns, including any row-action button, off-screen.

    Needs NO field list, NO injected value and NO selector, which is precisely why
    it closes the gap: the auto-overflow guard only fires on a sentinel injected
    into a field the author remembered to declare in `layout_stress.stress_fields`,
    and every page-level horizontal check (`assertNoHorizontalPageScroll`) is
    vacuous here because the scroll box absorbs the overflow so the document never
    scrolls. Caught Bug #149093 (BC Sovereignty Assignment: a 200-char
    `sovereignName` in real dev data pushed 4 of 5 columns out of view, while all
    10 existing layout-discovery TCs passed green).
    """
    page_url = spec.get('page_url', '')
    return [{
        'id': start_id,
        'title': "Layout — no surface pushes content off-screen horizontally at desktop widths",
        'priority': 'P2',
        'spec_ref': 'auto-hscroll',
        'flow': 'layout-discovery',
        'page': page_url,
        'category': 'layout-discovery',
        'spec_only': False,
        'precondition': 'User is on the page; real server data is rendered (no fixtures, no injected value)',
        'steps': [
            f"Navigate to {page_url} at desktop viewport 1280x720 and wait for load",
            "Sweep the list surface: assert no declared horizontal scroller holds content wider than its box",
            "Repeat at 1920x1080 (a wider viewport must not merely postpone the overflow)",
            "Open the first record's detail if a list is present, then sweep that surface too",
        ],
        'expected': "Every wide surface fits its scroll box at desktop widths — no column or control is pushed off-screen behind a horizontal scroll the user has no reason to look for",
        'test_data': {},
        'layout_stress': {
            'surface': 'hscroll',
        },
    }]


# ── VIF section builders (grammar 0.4 §5.2 core + §5.3 task-screen) ──────────
# Each builder consumes one block that `resolve_specs.py --emit-vif-block` writes
# and the author merges. Nothing here reads the VIF directly: the yaml is the
# oracle of record, which is what makes a run auditable after the spec moves on.
#
# Why these exist at all: ten of the sixteen sections the VIF grammar declares fed
# no builder, so their mandates could only be tested by whoever happened to read
# the file. That produced a specific, repeatable blind spot — a suite green at 92
# TCs with 0 accessibility TCs, no assertion on any outbound default, and no
# assertion that a field the VIF forbids displaying stays off screen.

def _bare(v: str) -> str:
    """VIF cells arrive dressed in backticks, quotes and parenthesised asides."""
    return re.sub(r'\(.*?\)', '', str(v or '')).strip().strip('*`" ').split('—')[0].strip()


def _screens_of(spec: dict) -> list[dict]:
    ts = spec.get('task_screen') or {}
    return (ts.get('screens') or []) if isinstance(ts, dict) else []


_COPY_IN_CELL = re.compile(r'"([^"]{6,})"')
# Same vocabulary the resolver uses: a cell reading "—" / "N/A — static control" /
# "Hidden — rendered only when …" declares that the component HAS no such state.
_NO_STATE = re.compile(r'^\s*(—|-|n/?a\b|none\b|hidden\b|not applicable|by design)', re.I)

# Loading copy is not empty copy. A few VIFs put "Loading item…" / "Skeleton fields
# while fetching" in the Empty State column — a different screen state, and asserting
# it appears when the endpoint returns no rows would FAIL a conformant screen. It is a
# spec-column mistake worth reporting, never a TC to fabricate.
_LOADING_COPY = re.compile(r'^\s*(loading|fetching|skeleton|please wait)\b|^\s*…\s*$', re.I)


def _endpoint_for_component(spec: dict, component: str) -> str:
    """Component -> its Source Endpoint, from §Data Binding.

    Names do not match exactly across the two sections: §Component Tree writes
    `TriageSheet` while §Data Binding writes `TriageSheet (read)` and
    `TriageSheet (submit)`. A prefix match on the bare token is what joins them, and
    a GET is preferred — forcing an empty state means emptying a READ.
    """
    rows = [r for r in (spec.get('data_binding') or []) if isinstance(r, dict)]
    cand = []
    for r in rows:
        comp = _bare(r.get('component'))
        if not comp:
            continue
        if comp == component or comp.startswith(component) or component.startswith(comp):
            cand.append(str(r.get('source_endpoint') or ''))
    gets = [c for c in cand if 'GET' in c.upper()]
    pick = (gets or cand or [''])[0]
    m = re.search(r'(/[\w/{}.\-]+)', pick)
    return m.group(1) if m else ''


def build_empty_copy_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per quoted empty-state string in §Component Tree.

    §Component Tree is the ONLY authority for on-screen empty copy — CT
    §Error Responses `Message` covers errors, and nothing covers this. Until now the
    copy had to be hand-carried into `api_contracts[].empty`, so a component whose
    row was skipped simply had no oracle and nothing reported the omission.

    Only the QUOTED text is asserted. Two thirds of the corpus's real empty-state
    cells are descriptions rather than copy ("see MetricsKpiGrid Empty State",
    "Skeleton fields while fetching"), and demanding an assertion on those would
    manufacture findings against conformant screens.

    The distinct value over the exception pass's empty-state TC: that one asks
    whether an empty result renders the Empty state instead of the Error state. This
    asks whether the string on screen is the string the spec wrote — a UI showing a
    calm but WRONG empty message passes the former and fails this.
    """
    out = []
    for row in (spec.get('component_tree') or []):
        if not isinstance(row, dict):
            continue
        cell = str(row.get('empty_state') or '').strip()
        if not cell or _NO_STATE.match(cell):
            continue
        copies = [c.strip() for c in _COPY_IN_CELL.findall(cell)
                  if not _LOADING_COPY.match(c.strip())]
        if not copies:
            continue
        comp = _bare(row.get('component_id'))
        ep = _endpoint_for_component(spec, comp)
        primary = str(row.get('region', '')).lower() == 'dominant'
        steps = []
        if ep:
            steps.append(f'Mock {ep} to return an EMPTY result (200 with zero rows — not '
                         f'a 404: a 404 routed into the Error state is a different defect, '
                         f'and the exception pass owns it).')
        else:
            steps.append(f'§Data Binding names no endpoint for {comp} — drive it to its '
                         f'empty state by hand and say how in the step.')
        if not primary:
            steps.append(f'Open the surface {comp} lives on (it is a supporting region, so '
                         f'it is not on screen until opened).')
        steps.append(f'Navigate to the page and settle (skeleton count 0).')
        for c in copies:
            steps.append(f'Assert the exact spec copy is visible: "{c}"')
        steps.append('Assert no error copy and no Retry control is on the surface — the '
                     'empty state must not read as a failure.')
        out.append({
            'id': start_id + len(out),
            'title': f'{comp} empty state shows the spec copy '
                     f'("{copies[0][:44]}{"…" if len(copies[0]) > 44 else ""}")',
            'category': 'empty-copy',
            'flow': 'render',
            'page': spec.get('page_url') or '/',
            'priority': 'Medium' if not primary else 'High',
            'spec_only': False,
            'test_data': None,
            'precondition': f'{comp} forced to no data.',
            'step_deps': ['mock-only' if ep else 'any'] * len(steps),
            'steps': steps,
            'expected': (
                f'{comp} renders its spec-declared empty copy verbatim: '
                + ' / '.join(f'"{c}"' for c in copies)
                + f'. §Component Tree is the only authority for this string, so a '
                  f'different message is a divergence even when it reads better — and a '
                  f'calm-but-wrong empty message passes every other TC in the suite.'
            ),
            'spec_ref': f'{spec.get("vif_id", "VIF")} §Component Tree — {comp} Empty State',
            'section': {'kind': 'empty-copy', 'component': comp, 'endpoint': ep,
                        'copies': copies, 'region': row.get('region', '')},
        })
    return out


_GUIDISH = re.compile(r'^[0-9a-f]{8}-|^[a-z]{2,6}-\d+$', re.I)
_ISO_DATE = re.compile(r'^\d{4}-\d{2}-\d{2}')


def _fixture_payload(fx: dict) -> tuple[dict | None, str]:
    """The JSON out of an Entity Snapshot row. Returns (parsed, raw)."""
    for k, v in fx.items():
        if k in ('fixture_id', 'group', 'use_as', 'verifies', 'entity', 'note'):
            continue
        raw = str(v or '').strip().strip('`').strip()
        if raw.startswith('{'):
            try:
                return json.loads(raw), raw
            except Exception:
                return None, raw
    return None, ''


def _assertable_from_payload(payload: dict) -> list[tuple[str, str]]:
    """(field, value) pairs from the payload that are worth asserting on screen.

    The injected payload is itself an oracle — stronger than the prose in `Verifies`,
    because the test controls the input. Ids, GUIDs, timestamps and booleans are
    excluded: they are either not rendered, rendered reformatted (a date), or not
    distinctive enough to prove anything.
    """
    out = []
    for k, v in (payload or {}).items():
        if not isinstance(v, str) or len(v) < 8:
            continue
        if k.lower().endswith(('id', 'ids')) or _GUIDISH.match(v) or _ISO_DATE.match(v):
            continue
        out.append((k, v))
    # Longest first, then drop anything contained in a value already kept: an enum
    # value that happens to prefix a free-text field ("Investigating" vs
    # "Investigating a stale metric definition") adds no evidence and dresses a weak
    # oracle up as a second assertion.
    out.sort(key=lambda kv: -len(kv[1]))
    kept: list[tuple[str, str]] = []
    for k, v in out:
        if any(v in prev for _, prev in kept):
            continue
        kept.append((k, v))
    return kept


def build_fixture_mutation_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per §Verification Fixtures Entity Snapshot.

    These were authored for the preview emitter, but an Entity Snapshot is exactly
    what a `mutate:` TC needs and already carries its own oracle: a concrete
    single-entity payload plus a `Verifies` cell stating how it must render.
    Measured across the 28 grammar-0.4 VIFs: 74 Entity Snapshots, all 74 with a JSON
    payload, 28 of them with quoted copy in `Verifies`. Before this they were read by
    nothing, so every branch live data cannot show — a null resolved name, a stale
    item, a failure flag, a terminal state — had to be hand-authored as a mutation.

    Only Entity Snapshots. The other fixture groups (Task Activation 195, Checklist
    72, Info Content 32, …) are scenario prose or panel content, not payloads;
    emitting stubs for them would add unusable TCs, so their count is reported at
    Step 2 instead and they stay a manual decision.

    `use_as` defaults to `mutate` for this group because that is what the row IS —
    an explicit `use_as: none` (with a reason) is how you opt one out.
    """
    ts = spec.get('task_screen') or {}
    fixtures = (ts.get('fixtures') or []) if isinstance(ts, dict) else []
    # The endpoints to inject into: the item read renders a single entity, the list
    # read renders it as a one-row collection. A snapshot's `Verifies` cell routinely
    # talks about both ("renders in default filter" / "info panel renders"), so both
    # are mocked and the assertions decide which surface matters.
    eps = []
    for r in (spec.get('data_binding') or []):
        if not isinstance(r, dict):
            continue
        cell = str(r.get('source_endpoint') or '')
        if 'GET' not in cell.upper():
            continue
        m = re.search(r'(/[\w/{}.\-]+)', cell)
        if m and m.group(1) not in eps:
            eps.append(m.group(1))
    out = []
    for fx in fixtures:
        if not isinstance(fx, dict):
            continue
        if 'entity snapshot' not in str(fx.get('group', '')).lower():
            continue
        use = str(fx.get('use_as') or '').strip().lower()
        if use and use != 'mutate':
            continue          # explicitly routed elsewhere, or opted out with a reason
        fid = str(fx.get('fixture_id') or '').strip()
        payload, raw = _fixture_payload(fx)
        verifies = str(fx.get('verifies') or '').strip()
        if not raw or not verifies:
            continue
        quoted = [c.strip() for c in _COPY_IN_CELL.findall(verifies)]
        from_payload = _assertable_from_payload(payload or {})
        if not quoted and not from_payload:
            continue          # nothing concrete to assert; a prose-only TC is vacuous
        steps = [
            f'Mock {" and ".join(eps) or "the bound GET endpoint(s)"} to return this '
            f'fixture payload (the list as a one-row collection, the item read as the '
            f'entity itself): {raw[:180]}{"…" if len(raw) > 180 else ""}',
            'Navigate to the page and settle (skeleton count 0).',
        ]
        for k, v in from_payload[:2]:
            steps.append(f'Assert the injected `{k}` renders on screen: "{v[:70]}"')
        for q in quoted[:3]:
            steps.append(f'Assert the spec-stated rendering is present: "{q[:70]}"')
        if not payload and raw:
            steps.append('⚠️ the fixture JSON did not parse — fix the spec cell or the '
                         'mock will inject nothing. Reported, not silently skipped.')
        out.append({
            'id': start_id + len(out),
            'title': f'{fid} — fixture renders as the spec states',
            'category': 'fixture-mutation',
            'flow': 'render',
            'page': spec.get('page_url') or '/',
            'priority': 'Medium',
            'spec_only': False,
            'test_data': None,
            'precondition': f'Fixture {fid} injected via mock. No seeding — the payload IS '
                            f'the data, which is why a branch live data cannot show is '
                            f'reachable here at all.',
            'step_deps': ['mock-only'] * len(steps),
            'steps': steps,
            'expected': (
                f'{verifies} '
                f'[fixture {fid}, §Verification Fixtures Entity Snapshots] '
                + (f'Concrete oracles asserted: '
                   + '; '.join([f'{k}="{v[:40]}"' for k, v in from_payload[:2]]
                               + [f'"{q[:40]}"' for q in quoted[:3]]) + '.')
            ),
            'spec_ref': f'{spec.get("vif_id", "VIF")} §Verification Fixtures {fid}',
            'section': {'kind': 'fixture-mutation', 'fixture_id': fid,
                        'payload': raw, 'endpoints': eps,
                        'parsed_ok': bool(payload)},
        })
    return out


def build_task_route_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC proving the §Task Journey route actually serves the task screen.

    The landing page passing is not evidence for it. A task route is a SECOND route
    the VIF declares (`/…/{id}/triage` alongside the list at `/…`), every other TC in
    the suite arrives at the list, and a task route the build never implemented
    therefore reports green — the same shape as a screen shipped with no nav entry,
    which has happened on this platform.

    `route_reachable: no` on the yaml row means the divergence is already known: the
    TC is still emitted and pinned red, so it flips loud when the route lands.
    """
    ts = spec.get('task_screen') or {}
    tj = (ts.get('task_journey') or {}) if isinstance(ts, dict) else {}
    route = _bare(tj.get('route'))
    if not route or not route.startswith('/'):
        return []
    known = str(tj.get('route_reachable', 'unknown')).lower()
    ident = _bare(tj.get('primary_identifier')) or 'the record id'
    landing = _bare(tj.get('landing_page')) or (spec.get('page_url') or '/')
    return [{
        'id': start_id,
        'title': f'Task route {route} serves the task screen',
        'category': 'task-route',
        'flow': 'nav',
        'page': landing,
        'priority': 'High',
        'spec_only': False,
        'test_data': None,
        'precondition': f'A record exists whose {ident} can fill the route parameter — '
                        f'seed it or take it from the landing page, do not hard-code an id.',
        'step_deps': ['any'] * 4,
        'steps': [
            f'Open the landing page {landing} and settle.',
            f'Take a real {ident} from the first row (a hard-coded id makes this TC fail '
            f'on a reset database rather than on the defect it is looking for).',
            f'Navigate to {route} with that id substituted.',
            'Assert the task screen itself renders — its own heading and at least one of '
            'its declared form fields or action-bar buttons. A redirect back to the '
            'landing page, a 404, or an empty shell all mean the route does not serve '
            'this screen.',
        ],
        'expected': (
            f'{route} serves the task screen for a real {ident}. '
            + ('⚠️ The yaml records `route_reachable: no` — the divergence is already '
               'known; keep this red so it flips when the route lands. '
               if known == 'no' else '')
            + 'The landing page working is not evidence for this route: they are two '
              'different routes and every other TC in the suite only ever visits the first.'
        ),
        'spec_ref': f'{spec.get("vif_id", "VIF")} §Task Journey Route',
        'section': {'kind': 'task-route', 'route': route, 'landing': landing,
                    'reachable': known},
    }]


def _screen_read_endpoint(sc: dict, spec: dict) -> str:
    """The path of the screen's list read, from the columns' Contract binding.

    §Task Screens states it per column ("`GET /api/governance/capture-inbox` via
    GetCaptureInboxList"); §Data Binding is the fallback. Returns '' when neither
    names one, and the caller then falls back to the first /api/ request.
    """
    cands = []
    for c in (sc.get('columns') or []):
        if isinstance(c, dict):
            cands.append(str(c.get('contract_binding') or ''))
    for r in (spec.get('data_binding') or []):
        if isinstance(r, dict):
            cands.append(str(r.get('endpoint') or r.get('contract_binding') or ''))
    for blob in cands:
        m = re.search(r'(/api/[A-Za-z0-9/_\-{}]+)', blob)
        if m:
            path = m.group(1).rstrip('`')
            # A collection read, never an item read: the boot request is the list.
            if '{' not in path:
                return path
    return ''


def build_boot_request_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per task screen asserting the COLD-LOAD request carries every
    §Task Screens query parameter at its declared default.

    This is the only oracle on the screen's boot contract, and it is unreachable
    from the DOM. Every other TC in a suite sets a filter, a page or a sort before
    it asserts anything, so an app that changed its default disposition filter,
    page size or sort order passes all of them — the suite simply never observes
    the untouched state. Reading the request URL is also immune to the two-reads
    race: the assertion is made against the very request the render came from, not
    against a second fetch of a collection something else may be writing.

    `sent_when: when-true` / `when-set` params are asserted ABSENT on a cold load —
    a conformant app omits `isStale` until the user turns the switch on, so
    demanding it would fail correct code.
    """
    out = []
    for sc in _screens_of(spec):
        params = [p for p in (sc.get('query_params') or []) if isinstance(p, dict)]
        if not params:
            continue
        # A param is CONDITIONAL when the author says so, or when the VIF's own cells
        # say it — a `Default` of "— (omitted)" and a `Maps to` reading "sent only
        # when `true`" are both that statement. Deriving it matters because the first
        # version keyed only on an explicit `sent_when`, so a conditional param whose
        # default cell was a dash fell out of BOTH lists and was asserted nowhere:
        # exactly the silent hole this whole pass exists to close.
        def _conditional(p: dict) -> bool:
            if str(p.get('sent_when', '')).lower() in ('when-true', 'when-set'):
                return True
            if str(p.get('sent_when', '')).lower() == 'always':
                return False
            blob = f'{p.get("default", "")} {p.get("maps_to", "")}'.lower()
            return bool(re.search(r'omitted|sent only when|only when', blob)) or \
                _bare(p.get('default')) in ('', '-')

        always = [p for p in params if not _conditional(p)
                  and _bare(p.get('default')) not in ('', '-')]
        omitted = [p for p in params if _conditional(p)]
        if not always and not omitted:
            continue
        names = ', '.join(_bare(p.get('param')) for p in always) or '—'
        pairs = '; '.join(f'{_bare(p.get("param"))}={_bare(p.get("default"))}' for p in always)
        out.append({
            'id': start_id + len(out),
            'title': f'Boot request on {sc.get("screen_id", "the screen")} carries the '
                     f'spec defaults ({names})',
            'category': 'boot-request',
            'flow': 'boot',
            'page': spec.get('page_url') or '/',
            'priority': 'High',
            'spec_only': False,
            'test_data': None,
            'precondition': 'Authenticated, holding the read permission. No filter, page or '
                            'sort touched — the whole point is the UNTOUCHED state.',
            'step_deps': ['any'] * 3,
            'steps': [
                'Start capturing requests, THEN navigate to the page (a capture started '
                'after navigation misses the boot request entirely).',
                'Take the FIRST request to the list endpoint — not the last: a later '
                'request may already carry a value the app defaulted the control to '
                'after mount, which is a different question.',
                f'Read its query string and compare against the spec defaults: {pairs}.',
            ],
            'expected': (
                f'The cold-load request carries {pairs}. '
                + (f'It does NOT carry {", ".join(_bare(p.get("param")) for p in omitted)} — '
                   f'the spec sends those only once set, so their presence on boot is the '
                   f'defect, not their absence. ' if omitted else '')
                + 'A different value here is a spec divergence even when the screen looks '
                  'correct: the user is being shown a slice the spec did not ask for.'
            ),
            'spec_ref': f'{spec.get("vif_id", "VIF")} §Task Screens "Query Parameters" '
                        f'({sc.get("screen_id", "")})',
            # The screen's OWN list endpoint. Without it the renderer took the first
            # /api/ request it saw, which on a real screen is often an unrelated
            # lookup (an actor resolve, a summary count) — and then reported the
            # spec's query params 'absent' from a request that never carried them.
            'section': {'kind': 'boot-request', 'screen_id': sc.get('screen_id', ''),
                        'endpoint': _screen_read_endpoint(sc, spec),
                        'params': always, 'omitted': omitted},
        })
    return out


def build_negative_render_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per §Task Screens "Response fields received but not displayed" field.

    The only NEGATIVE render contract anywhere in the VIF grammar: the response
    carries the field, and the screen must not show it. Nothing else in the run
    models a forbidden render — every other builder asks whether something appears.
    `TenantId` reaching a tenant-facing queue is the concrete case, and no
    positive-coverage suite can fail on it however complete it is.

    The oracle is the VALUE, not the label. Asserting the string "TenantId" is
    absent proves nothing: a UI that never labels its columns passes while
    displaying the value anyway. So the TC reads the field's value out of the list
    response and asserts THAT value is not rendered on the list surface.
    """
    out = []
    for sc in _screens_of(spec):
        for f in (sc.get('fields_not_displayed') or []):
            if not isinstance(f, dict):
                continue
            field = _bare(f.get('field'))
            if not field:
                continue
            surface = str(f.get('surface') or 'list').lower()
            out.append({
                'id': start_id + len(out),
                'title': f'{field} is NOT displayed on the {surface} surface',
                'category': 'negative-render',
                'flow': 'render',
                'page': spec.get('page_url') or '/',
                'priority': 'Medium',
                'spec_only': False,
                'test_data': None,
                'precondition': 'At least one row is present — an empty list passes this '
                                'vacuously, so settle on real row data first.',
                'step_deps': ['any'] * 4,
                'steps': [
                    'Navigate to the page and wait until the skeleton count is 0 and real '
                    'row data is on screen.',
                    f'Capture the list response and read `{field}` from the first row. '
                    f'Skip with a stated reason if the response does not carry it — the '
                    f'contract says it is received, so an absent field is itself a finding.',
                    f'Assert that value does not appear anywhere on the {surface} surface.',
                    f'Assert no column header or field label reads "{field}".',
                ],
                'expected': (
                    f'`{field}` is received in the payload and rendered nowhere on the '
                    f'{surface} surface — neither its value nor a label for it. '
                    f'Spec reason: {f.get("reason") or "declared not-displayed"}. '
                    f'A visible value here is a real defect that no amount of positive '
                    f'coverage can surface.'
                ),
                'spec_ref': f'{spec.get("vif_id", "VIF")} §Task Screens "Response fields '
                            f'received but not displayed" — {field}',
                'section': {'kind': 'negative-render', 'field': field, 'surface': surface,
                            'reason': f.get('reason', ''),
                            'screen_id': sc.get('screen_id', '')},
            })
    return out


_BP_VIEWPORTS = {'mobile': (375, 812), 'tablet': (834, 1112), 'desktop': (1440, 900)}


def _derive_responsive_changes(row: dict, spec: dict) -> list[dict]:
    """Turn a §Responsive Rules prose cell into per-component expectations.

    The cells are behavioural prose by grammar mandate ("CaptureInboxTable → card
    stack; CreatedAt column hidden"), so the components have to be recovered by
    name. They are recoverable mechanically because §Component Tree and the queue
    columns already enumerate every legal name — this matches against that
    inventory rather than guessing, and records what it matched so a reader can
    check the derivation instead of trusting it.
    """
    blob = ' '.join(str(v) for v in row.values())
    names = [_bare(c.get('component_id')) for c in (spec.get('component_tree') or [])
             if isinstance(c, dict) and _bare(c.get('component_id'))]
    names += [_bare(c.get('column')) for sc in _screens_of(spec)
              for c in (sc.get('columns') or [])
              if isinstance(c, dict) and _bare(c.get('column'))]
    # CLAUSE-scoped, not window-scoped. A cell packs several independent mandates
    # into one sentence ("toolbar collapses to icon bar | CaptureInboxTable -> card
    # stack | CreateItemSheet and TriageSheet take full screen"), so a +/-70-char
    # window around a component name reaches into its NEIGHBOUR's mandate: the
    # first version of this read "collapses" from the toolbar clause and concluded
    # CaptureInboxTable must be hidden, which is the opposite of what the row says.
    # Splitting on the separators the cells actually use keeps each mandate to
    # itself, and 'full screen' is tested before 'card' because a clause naming
    # both belongs to the more specific one.
    clauses = [c.strip().lower() for c in re.split(r'[;.|]|\s—\s', blob) if c.strip()]
    out = []
    for n in dict.fromkeys(names):
        pat = re.compile(r'(?<![A-Za-z0-9])' + re.escape(n) + r'(?![A-Za-z0-9])', re.I)
        cl = next((c for c in clauses if pat.search(c)), '')
        if not cl:
            continue
        if 'full screen' in cl or 'full-screen' in cl:
            expect = 'full-screen'
        elif 'hidden' in cl or 'not shown' in cl or 'removed' in cl:
            expect = 'hidden'
        elif 'card' in cl or 'stack' in cl:
            expect = 'card-stack'
        elif 'collapse' in cl:
            expect = 'hidden'
        else:
            expect = 'visible'
        out.append({'component': n, 'expect': expect, 'derived_from': cl})
    return out


def build_responsive_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per §Responsive Rules breakpoint. All three are mandatory in the
    grammar, and a layout mandate is as much a spec requirement as a validation
    rule — a column the spec hides at tablet but the build still renders is a
    divergence, not a cosmetic difference.

    ⚠️ The scoping trap this must not walk into: a Tailwind responsive
    double-render mounts BOTH trees, so `.first()` lands on a `display:none` node
    and `toBeHidden()` passes whatever the UI does. Every assertion here is scoped
    to the visible node.
    """
    out = []
    for row in (spec.get('responsive_rules') or []):
        if not isinstance(row, dict):
            continue
        bp = _bare(row.get('breakpoint')).lower()
        vp = row.get('viewport') or ''
        if not vp:
            w, h = _BP_VIEWPORTS.get(bp, (1440, 900))
            vp = f'{w}x{h}'
        changes = [c for c in (row.get('changes') or []) if isinstance(c, dict)] \
            or _derive_responsive_changes(row, spec)
        steps = [f'Set the viewport to {vp} BEFORE navigating (a resize after render can '
                 f'leave the desktop tree mounted).',
                 'Navigate to the page and settle on real data (skeleton count 0).']
        for c in changes:
            steps.append(f'Assert {c["component"]} is {c["expect"]} — scope the locator with '
                         f'`>> visible=true` so a double-rendered twin cannot satisfy it.')
        if not changes:
            steps.append('No component name in the spec cell matched §Component Tree or the '
                         'queue columns — assert the page has no horizontal scroll, then '
                         'name the components by hand in `responsive_rules[].changes`.')
        out.append({
            'id': start_id + len(out),
            'title': f'Responsive mandate holds at {bp} ({vp})',
            'category': 'responsive',
            'flow': 'responsive',
            'page': spec.get('page_url') or '/',
            'priority': 'Medium',
            'spec_only': False,
            'test_data': None,
            'precondition': f'Real row data present. Viewport {vp}.',
            'step_deps': ['any'] * len(steps),
            'steps': steps,
            'expected': (
                f'At {bp}: {row.get("layout_behavior") or "—"} '
                f'Navigation: {row.get("navigation_pattern") or "—"} '
                f'Components: {row.get("changes") or row.get("notable_component_changes") or "—"} '
                + ('Derived expectations: '
                   + '; '.join(f'{c["component"]}={c["expect"]}' for c in changes)
                   + '. The derivation matched §Component Tree names against the spec cell — '
                     'check it rather than trusting it.' if changes else '')
            ),
            'spec_ref': f'{spec.get("vif_id", "VIF")} §Responsive Rules — {bp}',
            'section': {'kind': 'responsive', 'breakpoint': bp, 'viewport': vp,
                        'changes': changes},
        })
    return out


def _derive_precedence(row: dict) -> dict:
    """Recover the machine-readable half of an §Empty & Error Precedence row.

    `level` is the oracle: the same 403 rendered full-page (list gone, no retry) and
    rendered inline over a stale list are two different defects, and only the level
    distinguishes them. The `Display` cell states it in prose by grammar mandate, so
    it is derived here and recorded on the TC — conservatively, and every derived
    value is printed in `expected` for a human to check.
    """
    cond = str(row.get('condition') or '')
    disp = str(row.get('display') or '')
    d = (disp + ' ' + cond).lower()
    level = row.get('level') or ('full-page' if re.search(r'full[-\s]?page|full[-\s]?screen', d)
                                 else 'inline' if 'inline' in d
                                 else 'component' if re.search(r'error state|panel|sheet', d)
                                 else '')
    m = re.search(r'\b([45]\d\d)\b', cond)
    ep = re.search(r'`?((?:GET|POST|PUT|PATCH|DELETE)?\s*/[\w/{}.\-]+)', cond)
    retry = row.get('retry')
    if retry is None:
        retry = False if re.search(r'no retry', d) else (True if 'retry' in d else None)
    return {
        'level': level,
        # Defect #15 (2026-09-11, VIF-ANA-006): `status` was the ONE field in this dict
        # that ignored the author, while the comment on `endpoint` below claims
        # "an author-supplied value wins, exactly as `level`/`retry`/`disables` already
        # do". A §Empty & Error Precedence Condition cell routinely names the failure in
        # prose ("fetch fails (non-permission, e.g. 5xx)", "Permission probe fails
        # entirely (network error)") with no bare status token for the regex to find, so
        # all 4 of this VIF's rows recovered None and every one became a `spec_only`
        # stub — the LEVEL oracle, which is the whole point of this builder, never ran.
        'status': (int(row.get('status')) if str(row.get('status', '')).strip().isdigit()
                   else (int(m.group(1)) if m else None)),
        # An author-supplied `endpoint:` wins, exactly as `level`/`retry`/`disables`
        # already do. The regex only reads the `Condition` cell, and a submit-rejection
        # row states its error CODE there, never a path ("Submit rejected — 422
        # Strategy:Initiative:HypothesisIncomplete") — so 9 of this VIF's 10 rows
        # recovered nothing and Step 6 skipped every one of them as UNTESTABLE, with no
        # way for the author to supply the missing half.
        'endpoint': (str(row.get('endpoint')).strip() if row.get('endpoint')
                     else (ep.group(1).strip() if ep else '')),
        'retry': retry,
        # NEGATION GUARD. A Display cell states the negative case too — "no action
        # buttons are disabled by this condition alone" — and the bare
        # `buttons.*disabled` match read that as a mandate to assert them DISABLED,
        # i.e. exactly the opposite of the spec. A TC derived that way fails a
        # conformant screen and would have been filed as a defect.
        'disables': row.get('disables') or (
            ['all action buttons']
            if re.search(r'buttons? (?:are )?disabled', d)
            and not re.search(r'\bno\b[^.;]{0,40}buttons?[^.;]{0,20}disabled', d)
            else []),
        'suppresses': row.get('suppresses') or ([] if level != 'full-page' else ['the list']),
        'hides': bool(re.search(r'buttons? hidden|action buttons hidden', d)),
    }


def build_error_precedence_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per §Empty & Error Precedence row, asserting the LEVEL.

    Not a duplicate of the exception pass. That pass asks whether an error surfaces
    and reads correctly; this asks whether it surfaces at the level the spec
    mandates — whether the list is gone or still on screen behind it, whether a
    Retry exists or must not, which controls end up disabled. A run can be fully
    green on error copy while every one of those is wrong.
    """
    out = []
    for row in (spec.get('error_precedence') or []):
        if not isinstance(row, dict):
            continue
        rid = row.get('id') or f'EP-{len(out) + 1}'
        d = _derive_precedence(row)
        if d['status'] is None and not re.search(r'empty|resolved|timeout|non-null|deferred',
                                                 str(row.get('condition', '')), re.I):
            # No status and no recognisable state condition: nothing to force.
            out.append({
                'id': start_id + len(out), 'title': f'{rid} — precedence (needs a trigger)',
                'category': 'error-precedence', 'flow': 'error',
                # Structured oracle authored at Step 2 (spec `assert:`).
                'assertions': list(row.get('assert') or []),
                'page': spec.get('page_url') or '/', 'priority': 'Medium',
                'spec_only': True, 'test_data': None,
                'precondition': '—', 'step_deps': ['any'],
                'steps': [f'Condition: {row.get("condition")}'],
                'expected': f'{row.get("display")} — no status code or forcible state in the '
                            f'condition cell, so the trigger has to be supplied by hand. '
                            f'Visible as a stub rather than dropped.',
                'spec_ref': f'{spec.get("vif_id", "VIF")} §Empty & Error Precedence {rid}',
                'section': {'kind': 'error-precedence', 'id': rid, **d},
            })
            continue
        steps = []
        if d['status']:
            steps.append(f'Mock {d["endpoint"] or "the bound endpoint"} to return '
                         f'{d["status"]}.')
        steps.append('Navigate to the page (or perform the action in the condition) and '
                     'wait for the failure surface to settle.')
        if d['level'] == 'full-page':
            steps.append('Assert the error takes the WHOLE page: the list / primary content '
                         'is not rendered at all, not merely covered.')
        elif d['level'] == 'inline':
            steps.append('Assert the error is inline within its own surface AND that the '
                         'rest of the screen stays functional (the list is still rendered).')
        elif d['level'] == 'component':
            steps.append('Assert the error is confined to its component and the page around '
                         'it still renders.')
        if d['retry'] is True:
            steps.append('Assert a Retry control is present.')
        elif d['retry'] is False:
            steps.append('Assert NO Retry control is offered — the spec forbids one here, so '
                         'a helpful extra Retry is still a divergence.')
        if d['disables']:
            steps.append(f'Assert these are disabled but present: {", ".join(d["disables"])} '
                         f'(disabled ≠ hidden — asserting absence would pass on the wrong UI).')
        if d['hides']:
            steps.append('Assert the action buttons are absent, not merely disabled.')
        out.append({
            'id': start_id + len(out),
            'title': f'{rid} — {row.get("condition", "")[:70]} renders at '
                     f'{d["level"] or "the declared"} level',
            'category': 'error-precedence',
            'flow': 'error',
            # Structured oracle authored at Step 2 (spec `assert:`).
            'assertions': list(row.get('assert') or []),
            'page': spec.get('page_url') or '/',
            'priority': 'High',
            'spec_only': False,
            'test_data': None,
            'precondition': f'Condition: {row.get("condition")}',
            'step_deps': ['mock-only' if d['status'] else 'any'] * len(steps),
            'steps': steps,
            'expected': (
                f'{row.get("display")} '
                f'[derived: level={d["level"] or "?"} retry={d["retry"]} '
                f'disables={d["disables"] or "none"} suppresses={d["suppresses"] or "none"}] '
                f'— the derivation came from the Display cell\'s own prose; check it.'
            ),
            'spec_ref': f'{spec.get("vif_id", "VIF")} §Empty & Error Precedence {rid}',
            'section': {'kind': 'error-precedence', 'id': rid, **d},
        })
    return out


def build_queue_column_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per task screen asserting every declared queue column is present AND
    renders its binding.

    Header presence alone is not the oracle. A table's `role`, `aria-label` and
    header row all render during the fetch and while the body is empty, so a
    header-only assertion goes green on a screen with no data at all — that is the
    table-shell false pass. This settles on skeleton count 0 and then asserts the
    first row carries a value in each declared column.
    """
    out = []
    for sc in _screens_of(spec):
        cols = [c for c in (sc.get('columns') or []) if isinstance(c, dict)]
        if not cols:
            continue
        names = [_bare(c.get('column')) for c in cols if _bare(c.get('column'))]
        cond = [c for c in cols if c.get('conditional')]
        steps = ['Navigate to the page and settle: skeleton count 0 AND at least one row '
                 'with real data (a header renders during the fetch, so an early read '
                 'passes on an empty table).']
        for c in cols:
            n = _bare(c.get('column'))
            if c.get('conditional'):
                steps.append(f'Column "{n}" is conditional ({c["conditional"]}) — assert it '
                             f'only on a row meeting that condition, and assert it is ABSENT '
                             f'on a row that does not.')
            else:
                steps.append(f'Assert column "{n}" is present and the first row renders a '
                             f'non-empty value for it (binding {c.get("entity_binding") or "—"}).')
        out.append({
            'id': start_id + len(out),
            'title': f'{sc.get("screen_id", "queue")} renders all {len(names)} declared columns',
            'category': 'queue-column',
            'flow': 'render',
            'page': spec.get('page_url') or '/',
            'priority': 'High',
            'spec_only': False,
            'test_data': None,
            'precondition': 'At least one row present.',
            'step_deps': ['any'] * len(steps),
            'steps': steps,
            'expected': (
                f'Every column §Task Screens declares is present and bound: '
                f'{", ".join(names)}. '
                + (f'Conditional columns ({", ".join(_bare(c.get("column")) for c in cond)}) '
                   f'appear only on rows meeting their stated condition. ' if cond else '')
                + 'A missing column is a dropped requirement even when the screen is usable.'
            ),
            'spec_ref': f'{spec.get("vif_id", "VIF")} §Task Screens "Queue Columns" '
                        f'({sc.get("screen_id", "")})',
            'section': {'kind': 'queue-column', 'screen_id': sc.get('screen_id', ''),
                        'columns': cols},
        })
    return out


def build_support_panel_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per support panel whose `Required` is yes.

    A `no` panel is deliberately skipped. Half the corpus's panel rows are
    `nba | no | Not wired in F1`, and asserting those present would manufacture a
    false bug against a conformant screen — the grammar's `Required` cell is the
    whole discriminator.
    """
    out = []
    for sc in _screens_of(spec):
        for p in (sc.get('support_panels') or []):
            if not isinstance(p, dict):
                continue
            role = _bare(p.get('panel_role'))
            req = str(p.get('required', '')).strip().lower()
            if not role or req != 'yes':
                continue
            anchor = p.get('anchor') or ''
            out.append({
                'id': start_id + len(out),
                'title': f'Required support panel "{role}" renders on '
                         f'{sc.get("screen_id", "the screen")}',
                'category': 'support-panel',
                'flow': 'render',
                'page': spec.get('page_url') or '/',
                'priority': 'Medium',
                'spec_only': False,
                'test_data': None,
                'precondition': 'The screen is open with real data.',
                'step_deps': ['any'] * 3,
                'steps': [
                    'Open the screen (and the task surface, when the panel lives inside one).',
                    f'Assert the "{role}" panel is present.',
                    (f'Assert its content actually LOADED: {anchor}' if anchor else
                     'Assert its content actually LOADED — a mounted container with an '
                     'errored or empty body satisfies a presence-only check. Use content '
                     f'from the spec\'s Content Source: {p.get("content_source") or "—"}'),
                ],
                'expected': (
                    f'The "{role}" panel is required by the spec and renders with real '
                    f'content from: {p.get("content_source") or "—"}. Presence alone is not '
                    f'the oracle — an errored panel mounts too.'
                ),
                'spec_ref': f'{spec.get("vif_id", "VIF")} §Task Screens "Support Panels" '
                            f'— {role} (Required: yes)',
                # `anchor` rides on the section so generate_scripts can tell a panel whose
                # loaded-content proof was authored from one identified only by its role
                # key, and lands in `assertions` so an expect() is emitted whichever
                # renderer takes the TC. A selector-looking anchor is a selector; anything
                # else is literal on-screen copy.
                'assertions': ([{'element': anchor, 'state': 'visible'}]
                               if anchor.strip()[:1] in ('#', '[', '.')
                               else [{'text': anchor}]) if anchor.strip() else [],
                'section': {'kind': 'support-panel', 'panel_role': role,
                            'screen_id': sc.get('screen_id', ''),
                            'anchor': anchor,
                            'content_source': p.get('content_source') or ''},
            })
    return out


def build_state_default_test_cases(spec: dict, start_id: int) -> list[dict]:
    """One TC per §State Management row the author marked `observable: control`.

    `observable: request` rows are covered by the boot-request TC, which is the
    stronger oracle for them — the request is what the server actually received.
    `none` rows produce nothing by design: an internal `selectedItemId` has no
    render, and inventing an assertion for it would be noise. The decision has to
    be recorded on the row, which is why the emitted draft leaves the slot empty.
    """
    out = []
    for row in (spec.get('state_defaults') or []):
        if not isinstance(row, dict):
            continue
        if str(row.get('observable', '')).strip().lower() != 'control':
            continue
        name = _bare(row.get('state_name'))
        init = _bare(row.get('initial_value'))
        out.append({
            'id': start_id + len(out),
            'title': f'Default state {name} = {init} on first load',
            'category': 'state-default',
            'flow': 'boot',
            'page': spec.get('page_url') or '/',
            'priority': 'Medium',
            'spec_only': False,
            'test_data': None,
            'precondition': 'First load in a fresh context. Do NOT touch the control — the '
                            'untouched value IS the requirement.',
            'step_deps': ['any'] * 2,
            'steps': [
                'Navigate to the page in a fresh context and settle.',
                f'Assert the control bound to {name} displays {init} without any interaction.',
            ],
            'expected': f'{name} boots at {init} per §State Management (set by: '
                        f'{row.get("set_by") or "—"}). Every other TC sets this control '
                        f'first, so nothing else can observe a changed default.',
            'spec_ref': f'{spec.get("vif_id", "VIF")} §State Management — {name}',
            'section': {'kind': 'state-default', 'state_name': name, 'initial': init},
            # Structured oracle authored at Step 2 (spec `assert:`), carried verbatim.
            'assertions': list(row.get('assert') or []),
        })
    return out


def build_acceptance_criteria_test_cases(spec: dict, existing: list[dict],
                                         start_id: int) -> list[dict]:
    """A TC only for the VIF ACs no existing TC already cites.

    An AC is normally proven by a functional TC, so emitting one per AC would
    duplicate the suite. Runs LAST for that reason: it fills the gap the other
    builders left rather than competing with them. An AC with a stated `untestable`
    reason is left alone — the reason, not the omission, is the record.
    """
    acs = [a for a in (spec.get('vif_acceptance_criteria') or []) if isinstance(a, dict)]
    if not acs:
        return []
    blob = ' '.join(str(tc.get('spec_ref', '')) + ' ' + str(tc.get('title', ''))
                    for tc in existing)
    out = []
    for ac in acs:
        acid = _bare(ac.get('id'))
        if not acid:
            continue
        if re.search(r'(?<![A-Za-z0-9])' + re.escape(acid) + r'(?![A-Za-z0-9])', blob):
            continue
        reason = str(ac.get('untestable') or '').strip()
        out.append({
            'id': start_id + len(out),
            'title': f'{acid} — {str(ac.get("text", ""))[:80]}',
            'category': 'acceptance-criteria',
            'flow': 'acceptance',
            # Structured oracle authored at Step 2 (spec `assert:`), carried verbatim.
            'assertions': list(ac.get('assert') or []),
            'page': spec.get('page_url') or '/',
            'priority': 'High',
            'spec_only': bool(reason),
            'test_data': None,
            'precondition': 'Authenticated with the permissions this VIF requires.',
            'step_deps': ['any'],
            'steps': ([f'Not assertable through the UI: {reason}'] if reason else
                      ['Drive the screen to the state this AC describes, then assert the '
                       'outcome it states — verbatim, including any quoted copy, route or '
                       'query parameter it names.']),
            'expected': (str(ac.get('text', '')) +
                         (f' [declared untestable: {reason}]' if reason else
                          ' — no other TC in this suite cites this AC, so it was the '
                          'screen\'s own definition of done with nothing proving it.')),
            'spec_ref': f'{spec.get("vif_id", "VIF")} §Acceptance Criteria {acid}',
            'section': {'kind': 'acceptance-criteria', 'id': acid},
        })
    return out


def build_test_cases(spec: dict, em: dict) -> list[dict]:
    """Dispatch to the appropriate TC builder based on spec format,
    then append deterministic visual-assertion + layout-discovery TCs.
    """
    if spec.get('spec_format') == 'descriptive':
        tcs = build_descriptive_test_cases(spec, em)
    else:
        tcs = build_form_test_cases(spec, em)
    next_id = (max((tc['id'] for tc in tcs), default=0) + 1) if tcs else 1
    visual_tcs = build_visual_assertion_test_cases(spec, next_id)
    tcs.extend(visual_tcs)
    next_id += len(visual_tcs)
    # Fix B — exception / unhappy-path TCs (executable, for BOTH spec formats).
    exc_tcs = build_exception_test_cases(spec, em, next_id, existing_tcs=tcs)
    tcs.extend(exc_tcs)
    next_id += len(exc_tcs)
    # Declared error rows the collection/item pair cannot reach — write endpoints,
    # sub-resources and cross-BC reads (see build_declared_error_test_cases).
    dec_tcs = build_declared_error_test_cases(spec, em, next_id, tcs)
    tcs.extend(dec_tcs)
    next_id += len(dec_tcs)
    # Fix C — business-rule alternate-value TCs (mutate the API response to render
    # enum/threshold variants the live record cannot show).
    mut_tcs = build_business_rule_mutation_test_cases(spec, em, next_id)
    tcs.extend(mut_tcs)
    next_id += len(mut_tcs)
    # Enforcement — negative tests for domain invariants / domain-method preconditions
    # (the rejection direction the state-machine pass never emits). Closes the gap that
    # let `Activate(): StartDate ≥ now` ship without coverage.
    enf_tcs = build_enforcement_test_cases(spec, em, next_id)
    tcs.extend(enf_tcs)
    next_id += len(enf_tcs)
    layout_tcs = build_layout_discovery_test_cases(spec, next_id)
    tcs.extend(layout_tcs)
    next_id += len(layout_tcs)
    # Always-on overflow guard — derived from free-text fields (maxLength), needs no
    # author config or fixtures. Skip fields already covered by an explicit
    # layout_stress surface so we don't double-emit for the same field.
    _explicit_fields = {
        (sf.get('field') or '').strip().lower()
        for sf in ((spec.get('layout_stress') or {}).get('stress_fields') or [])
        if isinstance(sf, dict)
    }
    auto_tcs = [
        tc for tc in build_auto_overflow_test_cases(spec, next_id)
        if tc['layout_stress']['field'].strip().lower() not in _explicit_fields
    ]
    # Renumber after filtering so ids stay contiguous.
    for tc in auto_tcs:
        tc['id'] = next_id
        next_id += 1
    tcs.extend(auto_tcs)
    # Always-on presentation-invariant sweep — clipped content in a height-capped
    # box that cannot scroll. Needs no field, no value, no selector; fires on the
    # real render. Catches the vertical-clipping / dead-scrollbar class (Mutation
    # Space) the horizontal overflow guard structurally cannot see.
    clip_tcs = build_presentation_invariant_test_cases(spec, next_id)
    tcs.extend(clip_tcs)
    next_id += len(clip_tcs)
    # Always-on HORIZONTAL sweep — the twin of the clip sweep. Real data, no field,
    # no sentinel: catches an unbounded cell widening a table past its scroll box so
    # the trailing columns fall off-screen (Bug #149093), which every page-level
    # horizontal check misses because the scroll box absorbs the overflow.
    hscroll_tcs = build_horizontal_overflow_test_cases(spec, next_id)
    tcs.extend(hscroll_tcs)
    next_id += len(hscroll_tcs)
    # VIF-scoped accessibility — one TC per `## Accessibility` clause the spec-yaml
    # captured, and nothing beyond it. Emits nothing when the VIF declares no
    # non-standard interactions, which is the correct outcome for such a screen.
    a11y_tcs = build_a11y_test_cases(spec, em, next_id)
    tcs.extend(a11y_tcs)
    next_id += len(a11y_tcs)
    # Reachability: only when the VIF declares `**Nav:**`.
    nav_tcs = build_nav_entry_test_case(spec, next_id)
    tcs.extend(nav_tcs)
    next_id += len(nav_tcs)
    # ── VIF section builders — the ten sections that fed no builder until now.
    # Order matters only for the last one: the AC pass must see every other TC so
    # it emits for the ACs nothing else already covers.
    for builder in (build_boot_request_test_cases,
                    build_empty_copy_test_cases,
                    build_task_route_test_cases,
                    build_fixture_mutation_test_cases,
                    build_state_default_test_cases,
                    build_queue_column_test_cases,
                    build_negative_render_test_cases,
                    build_support_panel_test_cases,
                    build_responsive_test_cases,
                    build_error_precedence_test_cases):
        new_tcs = builder(spec, next_id)
        tcs.extend(new_tcs)
        next_id += len(new_tcs)
    backfill_error_citations(spec, tcs)
    ac_tcs = build_acceptance_criteria_test_cases(spec, tcs, next_id)
    tcs.extend(ac_tcs)
    next_id += len(ac_tcs)
    return tcs


# ── YAML helpers ─────────────────────────────────────────────────────────────

def _yaml_str(s) -> str:
    """Return a double-quoted YAML string with special chars escaped."""
    if not isinstance(s, str):
        s = str(s) if s is not None else ''
    escaped = s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
    return f'"{escaped}"'


_STEP_EXPECTATIONS = [
    (['navigate'],                                              'Page loads without error; expected content is visible'),
    (['go to'],                                                 'Page loads without error; expected content is visible'),
    (['fill'],                                                  'Input is accepted; no validation error shown'),
    (['enter'],                                                 'Input is accepted; no validation error shown'),
    (['type'],                                                  'Input is accepted; no validation error shown'),
    (['select', 'option'],                                      'Option is selected; dropdown closes and value is reflected'),
    (['leave'],                                                 'Field remains empty; no auto-fill applied'),
    (['click', 'submit'],                                       'Form submits; success response or confirmation is received'),
    (['click', 'save'],                                         'Form submits; success response or confirmation is received'),
    (['click', 'create'],                                       'Form submits; success response or confirmation is received'),
    (['click', 'cancel'],                                       'Form closes without saving; user returns to previous state'),
    (['click', 'back'],                                         'Form closes without saving; user returns to previous state'),
    # Form-opening triggers (sheet/dialog). Placed AFTER submit/save/create/cancel so a
    # "Click 'Add X' submit button" still matches the submit rule, not these.
    (['open', 'menu'],                                          'The row action menu opens; the Edit/Delete options become visible'),
    (['click', 'edit'],                                         "The Edit form/sheet opens, pre-filled with the row's current values"),
    (['click', 'add'],                                          'The Add form/sheet opens with its input fields ready for entry'),
    (['click', 'new'],                                          'The form/sheet opens with its input fields ready for entry'),
    (['click', 'filter'],                                       'Filter is applied; list updates to reflect the selection'),
    (['click', 'tab'],                                          'Filter is applied; list updates to reflect the selection'),
    (['click', 'sidebar'],                                      'Page navigates to expected destination'),
    (['click', 'nav'],                                          'Page navigates to expected destination'),
    (['click', 'link'],                                         'Page navigates to expected destination'),
    (['click', 'expand'],                                       'Element expands or opens the expected panel/dropdown'),
    (['click', 'toggle'],                                       'Element expands or opens the expected panel/dropdown'),
    (['click', 'switcher'],                                     'Element expands or opens the expected panel/dropdown'),
    (['click', 'complete'],                                     'Action completes; status or UI updates to reflect the change'),
    (['click', 'claim'],                                        'Action completes; status or UI updates to reflect the change'),
    (['click'],                                                 'Element responds to click; UI changes as expected'),
    (['verify', 'visible'],                                     'Element is visible and rendered correctly'),
    (['verify', 'render'],                                      'Element is visible and rendered correctly'),
    (['verify', 'display'],                                     'Element is visible and rendered correctly'),
    (['verify', 'url'],                                         'URL matches the expected path'),
    (['verify', 'redirect'],                                    'URL matches the expected path'),
    (['verify', 'status'],                                      'Status value matches the expected state'),
    (['verify', 'badge'],                                       'Text or badge content matches expected value'),
    (['verify', 'text'],                                        'Text or badge content matches expected value'),
    (['verify', 'layout'],                                      'Layout structure is intact and matches spec'),
    (['verify'],                                                'Observed state matches specification'),
    (['observe'],                                               'Observed state matches specification'),
    (['log in'],                                                'User is authenticated; session is established'),
    (['login'],                                                 'User is authenticated; session is established'),
    (['clear', 'cookie'],                                       'Session is cleared; user is no longer authenticated'),
    (['clear', 'storage'],                                      'Session is cleared; user is no longer authenticated'),
    (['locate'],                                                'Element is found and visible on the page'),
    (['find'],                                                  'Element is found and visible on the page'),
    (['trigger'],                                               'Action is triggered; expected state change occurs'),
    (['perform', 'action'],                                     'Action completes; status update is reflected in the UI'),
]


def _infer_step_expected(step: str, step_num: int, total_steps: int) -> str:
    """Infer per-step expected_result from step action text."""
    sl = step.lower()
    for keywords, result in _STEP_EXPECTATIONS:
        if all(k in sl for k in keywords):
            return result
    return 'Step completes as expected'


def _determine_type(tc: dict) -> str:
    """Classify a test case as Positive, Negative, or Edge."""
    flow = (tc.get('flow') or '').lower()
    title = (tc.get('title') or '').lower()
    spec_ref = (tc.get('spec_ref') or '').lower()
    if 'boundary' in spec_ref or 'boundary' in title:
        return 'Edge'
    # Happy-path UF-xxx flows are always Positive, even if title mentions "required"/"empty" etc.
    if re.match(r'^uf-\d+', flow) or re.match(r'^uf-\d+', spec_ref):
        return 'Positive'
    # Enforcement TCs assert an operation is REJECTED when an invariant is violated.
    if flow == 'enforcement' or (tc.get('category') or '').lower() == 'enforcement':
        return 'Negative'
    if flow == 'validation' or any(k in title for k in ('required', 'invalid', 'error', 'empty')):
        return 'Negative'
    if flow == 'auth' and any(k in spec_ref + title for k in ('unauth', 'redirect', 'login')):
        return 'Negative'
    return 'Positive'


# ── YAML writer ───────────────────────────────────────────────────────────────

def write_yaml(tcs: list[dict], spec: dict, em: dict, out_path: str) -> None:
    # Prefer explicit 'module' field from spec-template.yaml; fall back to path parent
    module_name = spec.get('module') or Path(spec.get('spec_path', 'unknown/spec.yaml')).parent.name
    base_url = em.get('_real_page_url') or em.get('source_url', '')

    # Spec version, first thing in the file so it is the first thing a reviewer sees.
    # Gated in load_spec(), so these keys are always present by the time we get here.
    grammar = str(spec.get('vif_grammar', ''))
    lines = [
        f'feature: {_yaml_str(spec["title"])}',
        f'module: {_yaml_str(module_name)}',
        f'base_url: {_yaml_str(base_url)}',
        '',
        '# Spec version under test — every TC below was derived from THIS revision.',
        f'vif_id: {_yaml_str(spec["vif_id"])}',
        f'vif_version: {_yaml_str(spec["vif_version"])}',
        f'vif_grammar: {_yaml_str(grammar)}',
    ] + ([
        'grammar_fallback: true  # VIF not yet on grammar 0.4 — the 0.4-only spec '
        'columns were unavailable to these oracles',
    ] if grammar != '0.4' else []) + [
        '',
        'test_cases:',
        '',
    ]

    for tc in tcs:
        tc_type = _determine_type(tc)
        spec_only_flag = 'true' if tc.get('spec_only') else 'false'
        lines += [
            f'  - id: TC-{tc["id"]:03d}',
            f'    title: {_yaml_str(tc["title"])}',
            f'    priority: {tc["priority"]}',
            f'    type: {tc_type}',
            f'    spec_ref: {_yaml_str(tc["spec_ref"])}',
            f'    flow: {_yaml_str(tc["flow"])}',
            f'    page: {_yaml_str(tc["page"])}',
            f'    spec_only: {spec_only_flag}',
        ]
        # Optional flags — emit only when set to keep YAML clean
        if tc.get('no_auth'):
            lines.append('    no_auth: true')
        if tc.get('skip_reason'):
            lines.append(f'    skip_reason: {_yaml_str(tc["skip_reason"])}')
        if tc.get('category'):
            lines.append(f'    category: {_yaml_str(tc["category"])}')
        if tc.get('mock_routes'):
            # Serialize the mock_routes block via the YAML library (nested response/
            # mutate dicts), then indent under the TC. Consumed by generate_scripts.py
            # parse_test_cases() → page.route() interception (Fix B/C).
            if _HAS_YAML:
                dumped = _yaml.safe_dump({'mock_routes': tc['mock_routes']},
                                         default_flow_style=False, sort_keys=False).rstrip('\n')
                for ln in dumped.split('\n'):
                    lines.append('    ' + ln)
        if tc.get('layout_stress'):
            ls = tc['layout_stress']
            lines.append('    layout_stress:')
            lines.append(f'      surface: {_yaml_str(ls.get("surface", "row"))}')
            lines.append(f'      row_selector: {_yaml_str(ls.get("row_selector", ""))}')
            lines.append(f'      field: {_yaml_str(ls.get("field", ""))}')
            lines.append(f'      variant: {_yaml_str(ls.get("variant", ""))}')
            if ls.get('surface') == 'auto':
                pass  # auto surface needs only surface/field/variant (no selectors)
            elif ls.get('surface') == 'detail':
                lines.append(f'      container_selector: {_yaml_str(ls.get("container_selector", ""))}')
                lines.append(f'      open_step: {_yaml_str(ls.get("open_step", ""))}')
                lines.append(f'      item_api_pattern: {_yaml_str(ls.get("item_api_pattern", ""))}')
                text_selectors = ls.get('text_selectors') or []
                if text_selectors:
                    lines.append('      text_selectors:')
                    for sel in text_selectors:
                        lines.append(f'        - {_yaml_str(sel)}')
                else:
                    lines.append('      text_selectors: []')
            elif ls.get('surface') == 'state':
                lines.append(f'      state: {_yaml_str(ls.get("state", "error"))}')
                lines.append(f'      mock_status: {int(ls.get("mock_status", 500))}')
                lines.append(f'      container_selector: {_yaml_str(ls.get("container_selector", ""))}')
                lines.append(f'      item_api_pattern: {_yaml_str(ls.get("item_api_pattern", ""))}')
                lines.append(f'      panel_anchor: {_yaml_str(ls.get("panel_anchor", ""))}')
                lines.append(f'      open_step: {_yaml_str(ls.get("open_step", ""))}')
            else:
                lines.append(f'      baseline_row_field: {_yaml_str(ls.get("baseline_row_field", ""))}')
                ow = ls.get('only_when') or {}
                if ow:
                    lines.append('      only_when:')
                    for k, v in ow.items():
                        lines.append(f'        {k}: {_yaml_str(str(v))}')
                else:
                    lines.append('      only_when: {}')
        if tc.get('validation_lifecycle'):
            # Lifecycle metadata for generate_scripts.py → _render_validation_lifecycle_test
            # (provoke the message, fix the field, assert it disappears / re-arms / resets).
            vl = tc['validation_lifecycle']
            lines.append('    validation_lifecycle:')
            for k in ('kind', 'field', 'label', 'valid_value', 'widget',
                      'submit_label', 'reset_label'):
                lines.append(f'      {k}: {_yaml_str(vl.get(k, ""))}')
            open_steps = vl.get('open_steps') or []
            if open_steps:
                lines.append('      open_steps:')
                for s in open_steps:
                    lines.append(f'        - {_yaml_str(s)}')
            else:
                lines.append('      open_steps: []')
        if tc.get('enforcement'):
            # Domain-guard metadata for generate_scripts.py → seed-violating-state +
            # assert-rejected scaffold. `source` cites the ES `## Invariants` row or the
            # `## Behaviors` `Steps:` throw (0.3: a `## Domain Methods` `Pre:` clause).
            # `error_code`/`wire_code` are emitted only when present so an unmapped domain
            # error (wire_code == '' with error_code set) is visible in the artifact and
            # `unmapped_domain_error: true` tells generate_scripts.py NOT to assert a code.
            enf = tc['enforcement']
            lines.append('    enforcement:')
            lines.append(f'      target: {_yaml_str(enf.get("target", ""))}')
            lines.append(f'      rule: {_yaml_str(enf.get("rule", ""))}')
            if enf.get('kind'):
                lines.append(f'      kind: {_yaml_str(enf["kind"])}')
            if enf.get('error_code'):
                lines.append(f'      error_code: {_yaml_str(enf["error_code"])}')
            if enf.get('wire_code'):
                lines.append(f'      wire_code: {_yaml_str(enf["wire_code"])}')
            if enf.get('unmapped_domain_error'):
                lines.append('      unmapped_domain_error: true')
            lines.append(f'      violate: {_yaml_str(enf.get("violate", ""))}')
            lines.append(f'      source: {_yaml_str(enf.get("source", ""))}')
        if tc.get('section'):
            # VIF-section metadata for generate_scripts.py. One block for all eight
            # section categories rather than eight near-identical ones: they differ
            # only in which fields the renderer reads, and `kind` says which.
            sec = tc['section']
            lines.append('    section:')
            for k, v in sec.items():
                if isinstance(v, list):
                    if not v:
                        lines.append(f'      {k}: []')
                        continue
                    lines.append(f'      {k}:')
                    for item in v:
                        if isinstance(item, dict):
                            first = True
                            for ik, iv in item.items():
                                lead = '        - ' if first else '          '
                                lines.append(f'{lead}{ik}: {_yaml_str(str(iv))}')
                                first = False
                        else:
                            lines.append(f'        - {_yaml_str(str(item))}')
                elif isinstance(v, bool) or v is None:
                    lines.append(f'      {k}: {"true" if v is True else "false" if v is False else "null"}')
                elif isinstance(v, int):
                    lines.append(f'      {k}: {v}')
                else:
                    lines.append(f'      {k}: {_yaml_str(str(v))}')
        if tc.get('a11y'):
            # VIF §Accessibility clause metadata — kept verbatim so the assertion can be
            # traced back to the exact bullet group it came from.
            a = tc['a11y']
            lines.append('    a11y:')
            lines.append(f'      group: {_yaml_str(a.get("group", ""))}')
            lines.append(f'      clause: {_yaml_str(a.get("clause", ""))}')
            if a.get('component'):
                lines.append(f'      component: {_yaml_str(a["component"])}')
            lines.append(f'      source: {_yaml_str(a.get("source", ""))}')
        lines.append('    preconditions:')
        precondition = tc.get('precondition') or 'User is on the page'
        lines.append(f'      - {_yaml_str(precondition)}')

        lines.append('    test_steps:')
        step_deps = tc.get('step_deps') or []
        # Oracles the VIF author wrote per step (spec `system_response`). When one
        # exists it is the expected_result verbatim — inventing "Step completes as
        # expected" over the top of an authored oracle is how they used to be lost.
        step_resps = tc.get('step_responses') or []
        for i, step in enumerate(tc['steps'], 1):
            authored = step_resps[i - 1] if i - 1 < len(step_resps) else ''
            step_exp = authored or _infer_step_expected(step, i, len(tc['steps']))
            lines += [
                f'      - step: {i}',
                f'        action: {_yaml_str(step)}',
                f'        expected_result: {_yaml_str(step_exp)}',
            ]
            if i - 1 < len(step_deps) and step_deps[i - 1] != 'any':
                lines.append(f'        data_dependency: {step_deps[i - 1]}')
            step_asserts = tc.get('step_assertions') or []
            if i - 1 < len(step_asserts) and step_asserts[i - 1]:
                lines.append('        assert:')
                for a in step_asserts[i - 1]:
                    first = True
                    for ak, av in a.items():
                        lead = '          - ' if first else '            '
                        # Quote `on` — YAML 1.1 would otherwise read it as a boolean.
                        _k = f'"{ak}"' if ak in ('on', 'off', 'yes', 'no') else ak
                        if isinstance(av, bool):
                            lines.append(f'{lead}{_k}: {"true" if av else "false"}')
                        else:
                            lines.append(f'{lead}{_k}: {_yaml_str(str(av))}')
                        first = False

        lines.append('    test_data:')
        if tc.get('test_data'):
            for k, v in tc['test_data'].items():
                if isinstance(v, list):
                    if not v:
                        lines.append(f'      {k}: []')
                    else:
                        items_yaml = ', '.join(_yaml_str(str(x)) for x in v)
                        lines.append(f'      {k}: [{items_yaml}]')
                else:
                    lines.append(f'      {k}: {_yaml_str(str(v))}')
        else:
            lines.append('      {}')

        if tc.get('assertions'):
            # Machine-readable oracles compiled 1:1 by generate_scripts.compile_assertions().
            lines.append('    assertions:')
            for a in tc['assertions']:
                first = True
                for ak, av in a.items():
                    lead = '      - ' if first else '        '
                    if isinstance(av, bool):
                        lines.append(f'{lead}{ak}: {"true" if av else "false"}')
                    else:
                        # Quote `on` — YAML 1.1 would otherwise read it as a boolean.
                        _k = f'"{ak}"' if ak in ('on', 'off', 'yes', 'no') else ak
                        lines.append(f'{lead}{_k}: {_yaml_str(str(av))}')
                    first = False

        lines += [
            f'    expected_result: {_yaml_str(tc["expected"])}',
            '',
        ]

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Generate UI test cases from synthesized spec YAML + element map')
    parser.add_argument('--spec-yaml', required=True, dest='spec_yaml',
                        help='Path to {feature}-spec.yaml (AI-synthesized spec, output of Step 2)')
    parser.add_argument('--element-map', required=True, dest='element_map', help='Path to element-map.json')
    parser.add_argument('--out', required=True, help='Output test-cases .yaml file')
    parser.add_argument('--page-url', dest='page_url', default=None,
                        help='Real page URL (used for screen matching when element-map source_url is a local file)')
    parser.add_argument('--force', action='store_true',
                        help='Overwrite existing YAML (default: abort if file already exists)')
    args = parser.parse_args()

    # ── Guard: do NOT overwrite existing test-cases unless --force is given ──
    out_path = Path(args.out)
    if out_path.exists() and not args.force:
        print(f"""\n⚠️  EXISTING TEST CASES DETECTED — aborting overwrite.

   File : {out_path}
   Size : {out_path.stat().st_size:,} bytes

   The target YAML already contains hand-crafted or previously approved test cases.
   Running generate_test_cases.py without --force will NEVER overwrite them.

   Options:
     • Re-run with --force to regenerate from scratch (existing TCs will be LOST)
     • Edit the YAML directly to add / update test cases
     • Delete the file first, then re-run without --force
""", file=sys.stderr)
        sys.exit(1)

    print(f"📖 Loading synthesized spec: {args.spec_yaml}")
    spec = load_spec(args.spec_yaml)
    fmt = spec.get('spec_format', 'structured')
    print(f"   Spec format  : {fmt}")
    print(f"   Feature      : {spec.get('title', '—')}")
    print(f"   Module       : {spec.get('module', '—')}")
    if fmt == 'structured':
        bc = spec.get('boundary_constraints', {})
        print(f"   UF-xxx: {len(spec['user_flows'])}  VAL-xxx: {len(spec['validations'])}  BR-xxx: {len(spec['business_rules'])}")
        if bc:
            print(f"   Boundary constraints: {', '.join(f'{k}({v})' for k, v in list(bc.items())[:8])}")
    else:
        print(f"   Screens: {len(spec.get('screens', []))}  Transitions: {len(spec.get('state_transitions', []))}  Criteria: {len(spec.get('acceptance_criteria', []))}")

    print(f"🗺  Loading element map: {args.element_map}")
    with open(args.element_map, 'r', encoding='utf-8') as f:
        em = json.load(f)

    # If --page-url provided, inject it so screen matching and TC output use the real URL.
    # Relativize first so base_url / page / "Navigate to" steps resolve against baseURL
    # (UI_BASE_URL) instead of hard-coding the deployment host (#143582).
    if args.page_url:
        em['_real_page_url'] = to_relative_url(args.page_url)

    print('⚙️  Building test cases…')
    tcs = build_test_cases(spec, em)

    write_yaml(tcs, spec, em, args.out)
    # ── Off-route form warning ────────────────────────────────────────────────
    # The form emitters assume the fields they found in the element map live on PAGE_URL.
    # When the map was captured across more than one screen — a list route plus the
    # drill-in form it links to — that assumption is silently wrong: every VAL / boundary
    # TC opens PAGE_URL, finds no field, and either fails on a missing locator or skips.
    # The generator cannot resolve the real route on its own (it needs a concrete record
    # id), so make the gap LOUD instead of shipping tests that quietly cannot run.
    _ts = (spec.get('task_screen') or {})
    _tsroute = str(
        _ts.get('route')
        or ((_ts.get('task_journey') or {}) if isinstance(_ts.get('task_journey'), dict) else {}).get('route')
        or ''
    ).strip().strip('`')
    _formish = sum(
        1 for _t in tcs
        if any('fill ' in str(_s).lower() or 'click "' in str(_s).lower() for _s in (_t.get('steps') or []))
    )
    # A PARAMETERISED task-screen route needs a concrete record id, so PAGE_URL — which
    # carries none — cannot be the screen that hosts the form, whether the route sits
    # beside PAGE_URL or one level below it.
    if _formish and _tsroute and ('{' in _tsroute or ':' in _tsroute) \
            and _tsroute.rstrip('/') != str(args.page_url or '').rstrip('/'):
        print(
            f"\n⚠️  OFF-ROUTE FORMS — {_formish} test case(s) fill a form, but the spec puts the\n"
            f"    task screen on `{_tsroute}` while PAGE_URL is `{args.page_url}`.\n"
            f"    If the element map was captured across BOTH screens, those TCs will open the\n"
            f"    list route, find no field, and cannot run. Add a navigation step that reaches\n"
            f"    the record route (discover the id at runtime — never hard-code a GUID), or\n"
            f"    re-capture the element map from PAGE_URL alone.\n"
        )

    print(f"✅ {len(tcs)} test cases written → {args.out}")
    print("   Tip: commit this YAML to git — it is the source of truth for test cases.")


if __name__ == '__main__':
    main()
