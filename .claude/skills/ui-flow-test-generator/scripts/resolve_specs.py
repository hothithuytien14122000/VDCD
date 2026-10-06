#!/usr/bin/env python3
"""Resolve the spec files a VIF-driven test run actually needs — and nothing more.

WHY THIS EXISTS
---------------
`.env` used to carry a hand-maintained `SPEC_FILES` list per feature. It was large (a
typical feature named ~12 files), most of it was never actually needed, and every path was
literal — so the whole file broke at once when the spec tree moved. A VIF already declares
its own dependencies in `depends_on` / `use_cases_served`, and those ids resolve from a
filename index over the spec roots, so the list is derivable. The VIF becomes the ONLY
declared input and there is no second place to keep in sync.

Verify genericity after any change with the sweep in references/spec-synthesis.md 2a-audit: run this script over
every VIF in every BC, at both grammars, including a `shell` subtype. It must exit without
crashing on all of them; a VIF with no resolvable dependency is a reported gap, not an error.

WHAT IT DECIDES
---------------
1. WHICH file each spec id maps to, preferring the FIRST root (grammar 0.4) and falling back
   to a later one with an explicit flag. Neither tree is a superset of the other: some specs
   exist only at 0.3 (not migrated yet) and some only at 0.4 (authored after the split), so
   "read only 0.4" and "read only 0.3" are BOTH wrong. The correct rule is priority order
   plus a recorded fallback — and that rule holds regardless of how far migration has got.

   Deliberately NOT hardcoded here: how many specs are on each side. Those counts move (the
   tree gained ~180 files in a single day mid-2026-08), so any number written into this file
   would be stale within days. Re-measure when you need one; never cite a remembered figure.
2. WHICH of those files may be opened at all. The VIF is the oracle; upstream specs supply
   a handful of cells. Three rules (references/spec-synthesis.md, "the 3 open rules"):
     - CT  → open when a verbatim user-facing error string is needed.
     - ES  → open when the VIF's own `## Validation Rules` carries no boundary number,
             or when the VIF has a write interaction (a guard can then be violated
             through the UI).
     - EN  → open only when the VIF references an enum without listing its values.
     - PM / UC / PS / IS / VO / DS → never opened. Not "usually not": never. Permissions
       live in `Gated By`; UC only ever cross-checks something the ES already stated.
   Opening less is not a quality trade. An ES routinely declares guards for behaviors the
   screen under test cannot reach — behaviors driven by an event handler, a scheduler, or
   another screen entirely. On the feature this script was first measured against, the ES
   declared 22 guards while the VIF reached only 2 of its 8 behaviors; deriving the other 13
   yields skips and unseedable tests, not coverage. Scope ES reads to the operations the VIF
   actually calls, whatever the ratio happens to be on your feature.

Usage:
    python3 resolve_specs.py --vif <path/to/VIF-{BC}-{NNN}_{Name}.md>
    python3 resolve_specs.py --vif <path> --json /tmp/plan.json --grammar 0.4-strict
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml as _yaml
except ImportError:
    print('❌ pyyaml not installed. Run: pip install pyyaml', file=sys.stderr)
    sys.exit(1)

# Roots in PRIORITY order: grammar 0.4 first, 0.3 as a recorded fallback.
DEFAULT_ROOTS = ['specs/platform', 'specs/foundry', '.specs-0.3']

# Spec types this pass is allowed to open, and why. Anything absent from this map is
# never opened — see the module docstring.
OPENABLE = {'CT', 'ES', 'EN'}
NEVER_OPEN = {
    'PM': 'permission keys already in VIF §Data Binding `Gated By`',
    'UC': 'only cross-checks what ES/CT already state; §Extensions read at Tier 2 only',
    'PS': 'process/BPMN internals are not observable from the UI',
    'IS': 'metric computation is not a UI oracle',
    'VO': 'structural detail already surfaced through ES §Properties',
    'DS': 'decision logic is referenced by VIF §Validation Rules, not duplicated',
}

_ID_RE = re.compile(r'^([A-Z]{2,3}-[A-Z]+-\d+)')
_SPECID_RE = re.compile(r'\b([A-Z]{2,3}-[A-Z]+-\d+)\b')
# `## Data Binding` Source Endpoint cells read `{VERB} {path}` — the verb is what tells us
# whether the screen can mutate anything, which is rule 2's write-interaction trigger.
_WRITE_VERB_RE = re.compile(r'\b(POST|PUT|PATCH|DELETE)\b')
_OPID_RE = re.compile(r'via\s+`?([a-z][A-Za-z0-9]{3,})`?')


def build_index(roots: list[str], base: Path) -> dict[str, list[Path]]:
    """Map spec_id -> candidate paths, ordered by root priority."""
    idx: dict[str, list[Path]] = {}
    for root in roots:
        rdir = base / root
        if not rdir.is_dir():
            continue
        for f in sorted(rdir.glob('*/*.md')):
            m = _ID_RE.match(f.name)
            if m:
                idx.setdefault(m.group(1), []).append(f)
    return idx


def grammar_of(path: Path) -> str:
    """Read the `grammar:` frontmatter value without parsing the whole file."""
    try:
        head = path.read_text(encoding='utf-8', errors='replace')[:2048]
    except OSError:
        return '?'
    m = re.search(r'^grammar:\s*"?([0-9.]+)"?', head, re.M)
    return m.group(1) if m else '?'


def section(body: str, name: str) -> str:
    """Return the text of one `## {name}` section (empty string when absent)."""
    m = re.search(rf'^##\s+{re.escape(name)}\s*$(.*?)(?=^##\s|\Z)', body, re.S | re.M)
    return m.group(1) if m else ''


def parse_vif(path: Path) -> dict:
    raw = path.read_text(encoding='utf-8')
    parts = raw.split('---')
    fm_text = parts[1] if len(parts) > 2 else ''
    try:
        fm = _yaml.safe_load(fm_text) or {}
    except Exception:
        fm = {}
    body = raw[raw.index('\n#', len(fm_text)) if '\n#' in raw else 0:]

    dep_ids: list[str] = []
    for d in (fm.get('depends_on') or []):
        if isinstance(d, dict) and d.get('spec_id'):
            dep_ids.append(str(d['spec_id']))
        elif isinstance(d, str):
            dep_ids.append(d)
    for k in ('use_cases_served', 'impl_depends_on'):
        for d in (fm.get(k) or []):
            if isinstance(d, str):
                dep_ids.append(d.split()[0].strip())
    # Body references catch a CT/ES the frontmatter forgot to list — a real occurrence,
    # and a silently-missing CT means every error TC loses its verbatim copy.
    body_ids = set(_SPECID_RE.findall(body))

    binding = section(body, 'Data Binding')
    interactions = section(body, 'Interactions')
    val_rules = section(body, 'Validation Rules')
    a11y = section(body, 'Accessibility')

    has_write = bool(_WRITE_VERB_RE.search(binding + interactions))
    # Rule 2's other trigger: does the VIF already state its own boundary numbers? A
    # multi-digit literal in a Validation Rules row (maxLength: 2000) means it does — and
    # ~93% of rows across the corpus do, which is why ES is often not needed at all.
    has_bounds = bool(re.search(r'\d{2,}', val_rules))
    # An enum is only worth an EN lookup when the VIF names the type but not the values.
    enum_refs = sorted(set(re.findall(r'\b(EN-[A-Z]+-\d+)\b', binding + val_rules)))
    lists_values = bool(re.search(r'one of|/\s*\w+\s*/', val_rules))

    # `**Nav:** "Capture Inbox" under "Governance" (...)` — the leaf label is the
    # one a user must be able to click. 22 of 23 VIFs declare it; a VIF that does
    # not is an embedded panel or a drill-in, and has no nav entry to demand.
    # Trigger + API-call columns of §Interactions, comments stripped: what a user
    # can actually set in motion from this screen.
    action_cells = []
    for line in re.sub(r'<!--.*?-->', '', interactions, flags=re.S).splitlines():
        line = line.strip()
        if not line.startswith('|') or set(line) <= set('|-: '):
            continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        action_cells += cells[0:1] + cells[2:3]
    action_hay = ' '.join(action_cells)

    nav_m = re.search(r'\*\*Nav:\*\*\s*(.+)', body)
    nav = {}
    if nav_m:
        labels = re.findall(r'"([^"]+)"', nav_m.group(1))
        nav = {'raw': nav_m.group(1).strip(),
               'leaf': labels[0] if labels else '',
               'parent': labels[1] if len(labels) > 1 else ''}

    return {
        'path': str(path),
        'spec_id': fm.get('spec_id', ''),
        'title': fm.get('title', ''),
        'grammar': str(fm.get('grammar', '?')),
        # The VIF's own `version:` is the ONE authoritative version of the oracle this
        # run tests against. It is carried VIF frontmatter -> spec/ui yaml -> test-cases
        # yaml -> spec.ts banner + report, so a later reader can prove which spec
        # revision a green suite actually proved. Never re-typed by hand at any hop.
        'version': str(fm.get('version', '')),
        'tags': fm.get('tags') or [],
        'dep_ids': sorted(set(dep_ids)),
        'body_ids': body_ids,
        'operation_ids': sorted(set(_OPID_RE.findall(binding + interactions))),
        'has_write': has_write,
        'has_bounds': has_bounds,
        'enum_refs': enum_refs,
        'lists_enum_values': lists_values,
        'nav': nav,
        'has_a11y': bool(a11y.strip()),
        'a11y_clauses': [l.strip() for l in a11y.splitlines() if l.strip().startswith('- **')],
        'haystack': binding + interactions + val_rules,
        'action_haystack': action_hay,
        # Every section the grammar declares — see the VIF body extraction block
        # below for why the other ten matter and what each omission cost.
        'sections': parse_vif_sections(body, fm, fm.get('tags') or []),
    }


# ---------------------------------------------------------------------------
# VIF body extraction — the WHOLE section contract, not the 6 sections a
# VIF-driven run used to read.
#
# The grammar fixes the section set (author-vif `references/section-rules.md`,
# VIF KB §5.2 core / §5.3 task-screen / §5.4 optional / §5.5 shell): 11 core
# sections in EVERY VIF, +5 more when `task_journey_id` is present (task-screen),
# +1 when the subtype is shell. Measured over this corpus: 61 VIF files across
# both roots, all 61 carry all 11 core sections, and 33 are task-screens —
# `task_journey_id` and `## Task Screens` co-occur exactly, so the frontmatter
# key is a safe subtype discriminator.
#
# Only 6 of those sections were ever read here (the Routing header lines, Data
# Binding, Interactions, Validation Rules, Accessibility). The other ten carry
# oracles nothing else in the run can supply, and each omission has its own
# silent failure mode:
#
#   §Acceptance Criteria      the screen's own AC1..ACn — its definition of done.
#                             Un-extracted, the spec-yaml carried the template's
#                             generic boilerplate ("All UF flows pass") instead and
#                             AC coverage depended on whoever read the VIF by hand.
#   §State Management         `Initial Value` per state = the boot contract. A
#                             deployed app that changes the default filter or page
#                             size has nothing asserting otherwise.
#   §Responsive Rules         all 3 breakpoints are mandatory in the grammar; "the
#                             CreatedAt column is hidden at tablet" is a mandate.
#   §Empty & Error Precedence which surface wins and at which LEVEL (full-page vs
#                             component vs inline, retry vs no retry) — distinct
#                             from the error catalogue, which only says an error
#                             exists somewhere.
#   §Component Tree           per-component Empty/Error copy + Region. That copy
#                             was hand-carried into `api_contracts.empty`, so a
#                             skipped row was invisible.
#   §Routing & Entry Points   one boot state per distinct arrival, not just a route.
#   §Task Journey             the task route and its primary identifier.
#   §Screen Blueprints        the archetype (`task-list` vs `task-screen-standard`).
#   §Task Screens             queue columns, form fields WITH `Required`, action
#                             keys, support panels, the outbound query params WITH
#                             their defaults, and the fields the screen must NOT
#                             display.
#   §Verification Fixtures    ready-made oracles: Entity Snapshots are `mutate:`
#                             payloads with their expected rendering stated.
#
# Extraction is deliberately shallow — rows in, rows out, verbatim. Nothing here
# decides what to assert; that is the synthesis step's job. What it removes is the
# transcription hop, which is where a whole section silently went missing.
# ---------------------------------------------------------------------------

VIF_CORE_SECTIONS = [
    'Routing & Entry Points', 'Component Tree', 'Data Binding', 'State Management',
    'Interactions', 'Validation Rules', 'Responsive Rules', 'Accessibility',
    'Empty & Error Precedence', 'Acceptance Criteria', 'Related',
]
VIF_TASK_SECTIONS = ['Task Journey', 'Screen Blueprints', 'Task Screens',
                     'Data Mapping', 'Verification Fixtures']
VIF_SHELL_SECTION = 'Navigation Taxonomy'
# §5.4 whitelist, plus the four headings the corpus actually carries outside it.
# Listed so they are reported as *informational*, never as a missing-section
# finding: an unrecognised heading may hold an oracle, but it is the VIF author's
# grammar problem, not this run's.
VIF_OPTIONAL_SECTIONS = [
    'Variants', 'Reusable Components', 'Task-Journey Column Registration',
    'Change Log', 'Design Resolution', 'Gaps / Open Questions (ELICIT)',
    'Deferred Panels',
]

_BOLD_LABEL_RE = re.compile(r'^\*\*(?P<label>[^*]+?):\*\*', re.M)


def _strip_comments(t: str) -> str:
    """VIF bodies interleave `<!-- COVERAGE: … -->` annotations BETWEEN table rows
    (§Interactions, §Empty & Error Precedence). Stripping them first is what keeps
    a table from appearing to end halfway down."""
    return re.sub(r'<!--.*?-->', '', t, flags=re.S)


def _table(text: str) -> tuple[list[str], list[list[str]]]:
    """(header cells, body rows) of the first pipe table in `text`.

    Blank lines do not end a table (they occur inside none of the corpus's tables,
    and tolerating them costs nothing); the first non-pipe content line does.

    Cells split on UNESCAPED pipes only. A union type is written `Guid \\| null` in
    §State Management and a disposition type as `CaptureInboxDisposition \\| "all"`;
    splitting those naively adds a phantom cell and shifts every column after it —
    which silently moved `Initial Value` into `Set By` on the first VIF tried.
    """
    hdr: list[str] = []
    rows: list[list[str]] = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if not s.startswith('|'):
            if hdr:
                break
            continue
        if set(s) <= set('|-: '):
            continue
        cells = [c.strip().replace('\\|', '|')
                 for c in re.split(r'(?<!\\)\|', s.strip('|'))]
        if not hdr:
            hdr = cells
        else:
            rows.append(cells)
    return hdr, rows


def _norm_key(cell: str) -> str:
    """`Source Endpoint (CT operationId)` -> `source_endpoint`. Parenthesised
    qualifiers are dropped so the same logical column keys the same whichever
    VIF wrote it — the corpus varies them freely."""
    c = re.sub(r'\(.*?\)', '', cell)
    return re.sub(r'[^a-z0-9]+', '_', c.strip().strip('*` ').lower()).strip('_')


def _dicts(hdr: list[str], rows: list[list[str]]) -> list[dict]:
    keys = [_norm_key(h) for h in hdr]
    out = []
    for r in rows:
        d = {}
        for i, c in enumerate(r):
            d[keys[i] if i < len(keys) and keys[i] else f'col{i}'] = c
        if any(v for v in d.values()):
            out.append(d)
    return out


def _rows_of(body: str, name: str) -> list[dict]:
    hdr, rows = _table(_strip_comments(section(body, name)))
    return _dicts(hdr, rows)


def _acceptance(body: str) -> list[dict]:
    """AC1..ACn, verbatim. Table form first (`| AC | Description |`), then the
    bullet form — both occur, and an AC list recovered as one blob is useless
    because coverage is asked per AC id."""
    out = []
    for d in _rows_of(body, 'Acceptance Criteria'):
        vals = [v for v in d.values()]
        if not vals:
            continue
        first = vals[0].strip('*` ')
        rest = ' '.join(v for v in vals[1:] if v).strip()
        if rest and re.match(r'^AC\s?\d+$', first, re.I):
            out.append({'id': first.replace(' ', ''), 'text': rest})
        elif rest:
            out.append({'id': first or f'AC{len(out) + 1}', 'text': rest})
        else:
            out.append({'id': f'AC{len(out) + 1}', 'text': first})
    if out:
        return out
    sec = _strip_comments(section(body, 'Acceptance Criteria'))
    for m in re.finditer(r'^[-*]\s+(?:\*\*)?(AC\s?\d+)(?:\*\*)?\s*[:.—-]*\s*(.+)$',
                         sec, re.M | re.I):
        out.append({'id': m.group(1).replace(' ', '').upper(), 'text': m.group(2).strip()})
    if not out:
        for i, m in enumerate(re.finditer(r'^[-*]\s+(.+)$', sec, re.M), 1):
            out.append({'id': f'AC{i}', 'text': m.group(1).strip()})
    return out


# An Empty/Error State cell saying "—", "N/A — static control", "Hidden — rendered only
# when ..." is a declaration that the component HAS no such state, not copy to assert.
# Roughly a third of the corpus's 626 component rows carry real empty copy; demanding a
# TC for the rest would manufacture findings against conformant screens.
_NO_STATE_RE = re.compile(r'^\s*(—|-|n/?a\b|none\b|hidden\b|not applicable|by design)', re.I)


# On-screen copy is the QUOTED text inside the cell, wherever it sits — the corpus's
# quoting convention is inconsistent but its quoting is not. Measured over the 28
# grammar-0.4 VIFs: 235 cells declare a real empty state, and 90 of them carry 100
# quoted strings between them; the other 145 are descriptions ("see MetricsKpiGrid
# Empty State", "Skeleton fields while fetching"). Gating on the cell would demand
# assertions on prose; gating on the quoted strings gives ~3.6 real oracles per VIF.
# The 6-character floor drops value literals like "0" and "0.0%" that are data, not
# messages.
_COPY_RE = re.compile(r'"([^"]{6,})"')


# Loading copy is not empty copy. A few VIFs put "Loading item…" / "Skeleton fields
# while fetching" in the Empty State column — a different screen state, and asserting
# it appears when the endpoint returns no rows would FAIL a conformant screen. It is a
# spec-column mistake worth reporting, never a TC to fabricate.
_LOADING_COPY = re.compile(r'^\s*(loading|fetching|skeleton|please wait)\b|^\s*…\s*$', re.I)


def _empty_copy(cell) -> list[str]:
    c = str(cell or '').strip()
    if not c or _NO_STATE_RE.match(c):
        return []
    return [m.strip() for m in _COPY_RE.findall(c) if not _LOADING_COPY.match(m.strip())]


def _loading_in_empty(rows: list[dict]) -> list[tuple[str, str]]:
    out = []
    for r in rows:
        cell = str(r.get('empty_state') or '').strip()
        if not cell or _NO_STATE_RE.match(cell):
            continue
        for m in _COPY_RE.findall(cell):
            if _LOADING_COPY.match(m.strip()):
                out.append((str(r.get('component_id', '?')), m.strip()))
    return out


def _count_real_empty(rows: list[dict]) -> int:
    return sum(len(_empty_copy(r.get('empty_state'))) for r in rows)


def _classify_table(hdr: list[str]) -> tuple[str, bool]:
    """(kind, header_is_nonstandard) for one task-screen table, decided on its
    HEADER and never on its bold label. The labels vary wildly across the corpus
    (`Left Column — Form Fields`, `Register Sheet — RegisterActorSheet`, `Main
    Table — ActorTable`, `Form Fields`), while the canonical header cell sets are
    stable: measured across every 0.4 task-screen VIF, `Action Key|Label|UC
    Step|Behavior` 29x, `Form Field|Entity Binding|Contract Binding|Required` 26x,
    `Panel Role|Required|Content Source` 22x, `Param|Maps to|Default` 3x,
    `Column|Entity Binding|…` 2x.

    A handful of VIFs write a form-field table with a non-canonical first column
    (`Field / Component`, `Field`). Those are still form-field tables by the
    grammar's own definition — `Entity Binding` appears in no other shape — so
    they are classified rather than dropped, and the second return value says the
    header deviated so the run can report it. Silently accepting the deviation
    would hide a spec-grammar defect; dropping the table would hide the fields.
    """
    h = [_norm_key(c) for c in hdr]
    if 'form_field' in h:
        return 'form_fields', False
    if 'action_key' in h or ('action' in h and 'behavior' in h):
        return 'actions', False
    if any(k.endswith('panel_role') for k in h):
        return 'support_panels', False
    if 'param' in h:
        return 'query_params', False
    if 'column' in h:
        return 'columns', False
    if 'field' in h and 'reason' in h:
        return 'fields_not_displayed', False
    if 'entity_binding' in h:
        return 'form_fields', True
    return '', False


def _subsections(sec: str) -> list[tuple[str, str]]:
    """[(### heading, its text)] — used by both §Task Screens and §Verification
    Fixtures, the two sections the grammar builds out of `###` subsections."""
    marks = [(m.start(), m.group(1).strip()) for m in re.finditer(r'^###\s+(.+)$', sec, re.M)]
    if not marks:
        return []
    bounds = [p for p, _ in marks] + [len(sec)]
    return [(name, sec[bounds[i]:bounds[i + 1]]) for i, (_, name) in enumerate(marks)]


def _task_screens(body: str) -> list[dict]:
    """One entry per `### {screen-id} ({blueprint})`, its tables grouped by kind.

    A table whose header matches no known kind lands in `unclassified` WITH its
    header — never dropped. That is the whole point: a task-screen block shape
    this parser has not seen must show up as something to look at, not as absence.
    """
    screens = []
    for head, chunk in _subsections(_strip_comments(section(body, 'Task Screens'))):
        m = re.match(r'`?([^\s(`]+)`?\s*(?:\((?P<bp>[a-z][a-z-]*)\))?', head)
        blocks: dict[str, list] = {}
        unclassified = []
        marks = [(mm.start(), mm.group('label').strip()) for mm in _BOLD_LABEL_RE.finditer(chunk)]
        bounds = [p for p, _ in marks] + [len(chunk)]
        for j, (_, label) in enumerate(marks):
            btext = chunk[bounds[j]:bounds[j + 1]]
            hdr, rows = _table(btext)
            if not rows:
                continue
            kind, nonstd = _classify_table(hdr)
            entry = {'label': label, 'rows': _dicts(hdr, rows)}
            if nonstd:
                entry['header'] = hdr
                entry['header_nonstandard'] = True
            if kind:
                blocks.setdefault(kind, []).append(entry)
            else:
                unclassified.append({**entry, 'header': hdr})
        screens.append({'screen_id': (m.group(1) if m else head),
                        'blueprint': (m.group('bp') or '') if m else '',
                        'heading': head, 'blocks': blocks, 'unclassified': unclassified})
    return screens


def _fixtures(body: str) -> list[dict]:
    out = []
    for name, chunk in _subsections(_strip_comments(section(body, 'Verification Fixtures'))):
        hdr, rows = _table(chunk)
        out.append({'group': name, 'rows': _dicts(hdr, rows)})
    return out


def _routing(body: str) -> dict:
    sec = _strip_comments(section(body, 'Routing & Entry Points'))
    rm = re.search(r'\*\*Route:\*\*\s*`?([^`\n]+)`?', sec)
    return {'route': rm.group(1).strip() if rm else '',
            'entry_points': _rows_of(body, 'Routing & Entry Points')}


def _task_journey(body: str) -> dict:
    """`| Field | Value |` -> a flat dict, so `Route` / `Primary Identifier`
    are addressable by name rather than by row index."""
    d = {}
    for r in _rows_of(body, 'Task Journey'):
        vals = list(r.values())
        if len(vals) >= 2:
            d[_norm_key(vals[0])] = vals[1]
    # A path cell is markdown: the value is the FIRST backticked token and the rest
    # of the cell is prose. Taking the cell verbatim left a trailing backtick on the
    # value ("/tasks`"), which then reached generate_scripts as a page.goto target.
    for k in ('route', 'landing_page'):
        v = d.get(k)
        if isinstance(v, str) and '`' in v:
            m = re.search(r'`([^`]+)`', v)
            d[k] = m.group(1).strip() if m else v.replace('`', '').strip()
    return d


def _section_audit(body: str, is_task: bool, is_shell: bool) -> dict:
    """The grammar's own section contract, checked. A missing REQUIRED section is
    a spec finding to report (PnC), not something for this run to fill in; a
    forbidden one (a task-screen section on a generic VIF) is Gate G9's job."""
    present = [m.group(1).strip() for m in re.finditer(r'^##\s+(.+)$', body, re.M)]
    required = list(VIF_CORE_SECTIONS)
    if is_task:
        required += VIF_TASK_SECTIONS
    if is_shell:
        required += [VIF_SHELL_SECTION]
    known = set(required) | set(VIF_OPTIONAL_SECTIONS) | set(VIF_CORE_SECTIONS) \
        | set(VIF_TASK_SECTIONS) | {VIF_SHELL_SECTION}
    forbidden = [] if is_task else [s for s in VIF_TASK_SECTIONS if s in present]
    if not is_shell and VIF_SHELL_SECTION in present:
        forbidden.append(VIF_SHELL_SECTION)
    return {'present': present,
            'missing': [s for s in required if s not in present],
            'forbidden': forbidden,
            'unrecognised': [s for s in present if s not in known]}


def parse_vif_sections(body: str, fm: dict, tags: list) -> dict:
    """Every section the grammar declares, extracted verbatim. Called from
    `parse_vif`; the result is what `--emit-vif-block` writes and what the
    spec-yaml's new blocks are filled from."""
    is_task = bool(fm.get('task_journey_id'))
    is_shell = 'shell' in [str(t).lower() for t in (tags or [])] \
        or str(fm.get('spec_id', '')).lower().startswith('vif-shell')
    return {
        'subtype': 'shell' if is_shell else ('task-screen' if is_task else 'generic'),
        'audit': _section_audit(body, is_task, is_shell),
        'routing': _routing(body),
        'component_tree': _rows_of(body, 'Component Tree'),
        'data_binding': _rows_of(body, 'Data Binding'),
        'state_management': _rows_of(body, 'State Management'),
        'responsive': _rows_of(body, 'Responsive Rules'),
        'error_precedence': _rows_of(body, 'Empty & Error Precedence'),
        'acceptance_criteria': _acceptance(body),
        'task_journey': _task_journey(body) if is_task else {},
        'screen_blueprints': _rows_of(body, 'Screen Blueprints') if is_task else [],
        'task_screens': _task_screens(body) if is_task else [],
        'data_mapping': _rows_of(body, 'Data Mapping') if is_task else [],
        'fixtures': _fixtures(body) if is_task else [],
        'nav_taxonomy': _rows_of(body, VIF_SHELL_SECTION) if is_shell else [],
    }


# ---------------------------------------------------------------------------
# Guard extraction (grammar 0.4)
#
# Why this lives here and not in the author's head: on 0.4 the guards are a DSL,
# so transcribing them by hand is pure copy work with a silent failure mode — a
# guard left out of `enforcement_guards:` is a guard the dim-2 gate never asks
# about, because the gate can only check the guards it was handed. Extracting
# them makes the count verifiable: ES declares N, the yaml must carry N.
#
# On 0.3 the same rules are prose. What comes back then is best-effort and
# marked `from_prose`, never presented as complete.
# ---------------------------------------------------------------------------

# `1. if `<cond>`: throw `'<Code>'``  — one guard per throw in a Steps: block.
_THROW_RE = re.compile(
    r'^\s*(\d+)\.\s*if\s+`(?P<cond>.+?)`\s*:\s*throw\s+`\'(?P<code>[^\']+)\'`',
    re.M)
# 0.3 prose: `... guard: `Disposition = Captured`` inside a Domain Methods row.
_PROSE_GUARD_RE = re.compile(r'guard:\s*`(?P<cond>[^`]+)`')


def _table_rows(text: str) -> list[list[str]]:
    """Pipe-table body rows, header and separator dropped, cells stripped."""
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith('|') or set(line) <= set('|-: '):
            continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        rows.append(cells)
    return rows[1:] if rows else []


def _words(s: str) -> str:
    """camelCase / kebab / snake -> space-separated words, so a behavior name can
    be matched as a PHRASE. Stripping separators outright (the obvious shortcut)
    makes `Resolve` match the state word "Resolved" and invents a test for an
    action no user can take; keeping word edges is what stops that."""
    s = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', ' ', s)
    return ' ' + re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip() + ' '


def parse_es(path: Path) -> dict:
    """Extract §Invariants rows and every §Behaviors `throw` as guards."""
    raw = path.read_text(encoding='utf-8', errors='replace')
    g = grammar_of(path)
    out = {'spec_id': _spec_id_of(path), 'grammar': g, 'path': str(path),
           'invariants': [], 'behaviors': [], 'from_prose': False}

    for cells in _table_rows(section(raw, 'Invariants')):
        # ID | Target | Kind | Arguments | Category | Error Code | Description
        if len(cells) < 7:
            continue
        out['invariants'].append({
            'id': cells[0], 'target': cells[1].strip('`'), 'kind': cells[2],
            'arguments': cells[3].strip('`'), 'category': cells[4],
            'error_code': cells[5].strip('`'), 'description': cells[6],
        })

    beh = section(raw, 'Behaviors')
    if not beh.strip():
        beh = section(raw, 'Domain Methods')      # 0.3 alias
        out['from_prose'] = bool(beh.strip())

    if out['from_prose']:
        # No Steps: DSL and no codes to read — recover the `guard:` phrases only,
        # so the author sees what exists without being handed a false oracle.
        for cells in _table_rows(beh):
            if len(cells) < 2:
                continue
            name = re.sub(r'\(.*', '', cells[0].strip('`')).strip()
            guards = [{'step': None, 'cond': m.group('cond'), 'code': ''}
                      for m in _PROSE_GUARD_RE.finditer(cells[1])]
            if name:
                out['behaviors'].append({'name': name, 'guards': guards})
    else:
        # One entry per `### <Behavior>`; its Steps: block owns the throws.
        for m in re.finditer(r'^###\s+(?P<name>.+?)\s*$(?P<body>.*?)(?=^###\s|\Z)',
                             beh, re.S | re.M):
            guards = [{'step': int(t.group(1)), 'cond': t.group('cond'),
                       'code': t.group('code')}
                      for t in _THROW_RE.finditer(m.group('body'))]
            out['behaviors'].append({'name': m.group('name').strip(), 'guards': guards})
    return out


def parse_ct(path: Path) -> dict:
    """Extract §Error Responses rows, keyed for the domain→wire join."""
    raw = path.read_text(encoding='utf-8', errors='replace')
    out = {'spec_id': _spec_id_of(path), 'grammar': grammar_of(path),
           'path': str(path), 'errors': [], 'has_applies_to': False}
    sec = section(raw, 'Error Responses')
    hdr = [l for l in sec.splitlines() if l.strip().startswith('| HTTP')]
    out['has_applies_to'] = bool(hdr and 'Applies To' in hdr[0])
    for cells in _table_rows(sec):
        if len(cells) < 5:
            continue
        code = cells[1].strip('`')
        out['errors'].append({
            'status': cells[0], 'code': '' if code.startswith('—') else code,
            'trigger': cells[2], 'message': cells[4].strip('"'),
            'applies_to': [a.strip().strip('`') for a in cells[5].split(',')]
                          if len(cells) > 5 and out['has_applies_to'] else [],
        })
    return out


def _rule(code: str) -> str:
    """Last segment of a `{Bc}:{Entity|Resource}:{Rule}` code."""
    return code.rsplit(':', 1)[-1] if code else ''


def _match_wire(domain_code: str, ct_errors: list[dict]) -> tuple[dict | None, str]:
    """Join a domain code to a wire row. Codes differ in their middle segment
    (Entity vs Resource namespace), so the rule name is the join key. A loose
    match is returned labelled, never silently accepted."""
    dr = _rule(domain_code)
    if not dr:
        return None, ''
    for e in ct_errors:
        if e['code'] and _rule(e['code']) == dr:
            return e, 'exact'
    for e in ct_errors:
        er = _rule(e['code'])
        if er and (er.startswith(dr) or dr.startswith(er)):
            return e, 'loose'
    return None, ''


_FILE_SPECID_RE = re.compile(r'^([A-Z]{2,3}-[A-Z]+-\d+)')


def _spec_id_of(path: Path) -> str:
    m = _FILE_SPECID_RE.match(path.name)
    return m.group(1) if m else path.stem


def build_guards(vif: dict, es_specs: list[dict], ct_specs: list[dict]) -> dict:
    """Join every ES guard to its CT wire row and classify the result.

    The classification is the point. A guard the domain enforces and the
    boundary publishes is testable through the UI by its code. A guard the
    boundary publishes NO code for is still testable — by its consequence —
    but the missing code is itself a finding, and it is the one defect class
    a VIF-only read can never surface.
    """
    ct_errors = [e for c in ct_specs for e in c['errors']]
    hay = vif.get('haystack', '').lower()
    opids = ' '.join(vif.get('operation_ids') or []).lower()
    act = _words(vif.get('action_haystack', '') + ' ' + opids)

    guards, findings = [], []
    matched_wire: set[str] = set()

    for es in es_specs:
        n = 0
        for beh in es['behaviors']:
            bname = beh['name']
            bl = bname.lower()
            # Reachability is a hint, never a claim: a behavior no interaction on
            # THIS screen can invoke has no UI-observable guard, and pruning it is
            # what keeps the suite from testing what the screen cannot reach.
            # keep _words' padding: it IS the word boundary. Stripping it turns the
            # phrase test back into a substring test, and `Resolve` matches "Resolved".
            reachable = _words(bname) in act
            for gd in beh['guards']:
                n += 1
                wire, mode = _match_wire(gd['code'], ct_errors)
                collapsed = ''
                if not wire:
                    # No code match — but the boundary may still answer this
                    # condition through an undifferentiated row scoped to the
                    # same operation (a deliberate cause-collapse).
                    for e in ct_errors:
                        if e['status'] not in ('404', '409'):
                            continue
                        if 'collapse' not in e['trigger'].lower():
                            continue
                        if any(bl in a.lower() for a in e['applies_to']):
                            collapsed = f"{e['status']} ({e['message'][:60]})"
                            break
                if wire:
                    matched_wire.add(wire['code'])
                guards.append({
                    'id': f"ENF-{es['spec_id'].split('-', 1)[1]}-{n:02d}",
                    'target': bname,
                    'rule': gd['cond'],
                    'kind': 'behavior-precondition',
                    'category': 'behavior',
                    'error_code': gd['code'],
                    'wire_code': wire['code'] if wire else '',
                    'wire_status': wire['status'] if wire else '',
                    'wire_message': wire['message'] if wire else '',
                    'match': mode,
                    'collapsed_into': collapsed,
                    'reachable_hint': reachable,
                    'source': (f"{es['spec_id']} §Behaviors {bname} Steps {gd['step']}"
                               if gd['step'] else
                               f"{es['spec_id']} §Domain Methods {bname} (prose guard)"),
                })
        for inv in es['invariants']:
            n += 1
            wire, mode = _match_wire(inv['error_code'], ct_errors)
            if wire:
                matched_wire.add(wire['code'])
            guards.append({
                'id': f"ENF-{es['spec_id'].split('-', 1)[1]}-{n:02d}",
                'target': inv['target'],
                'rule': f"{inv['kind']} {inv['arguments']}".strip(),
                'kind': inv['kind'],
                'category': inv['category'],
                'error_code': inv['error_code'],
                'wire_code': wire['code'] if wire else '',
                'wire_status': wire['status'] if wire else '',
                'wire_message': wire['message'] if wire else '',
                'match': mode,
                'collapsed_into': '',
                # An `argument`-category invariant guards a value the form submits,
                # so it is reachable whenever the VIF binds that field.
                'reachable_hint': (inv['category'] == 'argument'
                                   and inv['target'].lower() in hay),
                'source': f"{es['spec_id']} §Invariants {inv['id']}",
            })

    for g in guards:
        if g['error_code'] or g['wire_code']:
            pass
        if not g['wire_code'] and not g['collapsed_into'] and g['target']:
            tgt = g['target'].lower()
            for e in ct_errors:
                if (e['code'] and tgt != '$object' and g.get('category') == 'argument'
                    and tgt in e['trigger'].lower()):
                    g['collapsed_into'] = f"{e['status']} {e['code']}"
                    matched_wire.add(e['code'])
                    break

    for g in guards:
        # A guard this screen cannot invoke has no UI-observable oracle, so its
        # wire-code gap is a backend finding, not one this run can act on. Counted
        # below, not listed — 18 unactionable lines is how a real finding gets lost.
        if not g['reachable_hint']:
            continue
        if g['error_code'] and not g['wire_code'] and not g['collapsed_into']:
            findings.append(f"UNMAPPED domain error `{g['error_code']}` "
                            f"({g['source']}) — no CT wire code declares this condition")
        elif g['match'] == 'loose':
            findings.append(f"LOOSE code join `{g['error_code']}` -> `{g['wire_code']}` "
                            f"({g['source']}) — rule names differ, confirm they are the same rule")
    unreach = sum(1 for g in guards
                  if not g['reachable_hint'] and not g['wire_code'] and not g['collapsed_into'])
    if unreach:
        findings.append(f"{unreach} further guard(s) have no wire code but sit on behaviors "
                        f"this screen cannot invoke — out of scope for a UI suite, worth a "
                        f"backend note only")
    for e in ct_errors:
        if e['code'] and e['code'] not in matched_wire:
            findings.append(f"ORPHAN wire code `{e['code']}` ({e['status']}) — no ES guard "
                            f"raises it; either the boundary validates it alone or the "
                            f"domain rule was retired and this row is stale")
    return {'guards': guards, 'findings': findings,
            'from_prose': any(e['from_prose'] for e in es_specs)}



def _q(s: str) -> str:
    return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'


def _write_guard_yaml(out: Path, gres: dict, vif: dict) -> None:
    """Emit a DRAFT `enforcement_guards:` block. Draft, not final: `violate` and
    `action_ui` describe how THIS screen reaches the rule, which no spec states —
    that is the author's job. What the draft removes is the transcription step,
    where a guard silently goes missing and the gate never notices."""
    L = ['# DRAFT — extracted by resolve_specs.py --emit-guards. Review before use:',
         '#   1. delete every guard whose `reachable: false` — this screen cannot invoke it',
         '#   2. fill `violate` and `action_ui` (how the user breaks the rule HERE)',
         '#   3. keep `wire_code: ""` as-is where it is empty — that is the finding',
         f'# VIF: {vif["spec_id"]}   guards: {len(gres["guards"])}',
         'enforcement_guards:']
    for g in gres['guards']:
        L.append(f'  - id: {g["id"]}')
        L.append(f'    target: {_q(g["target"])}')
        L.append(f'    rule: {_q(g["rule"])}')
        L.append(f'    kind: {_q(g["kind"])}')
        L.append(f'    error_code: {_q(g["error_code"])}')
        L.append(f'    wire_code: {_q(g["wire_code"])}'
                 + ('' if g['wire_code'] else '   # UNMAPPED — assert consequence, report the gap'))
        if g['wire_message']:
            L.append(f'    expected_message: {_q(g["wire_message"])}')
        if g['collapsed_into']:
            L.append(f'    collapsed_into: {_q(g["collapsed_into"])}'
                     + '   # boundary answers this via an undifferentiated row')
        if g['match'] == 'loose':
            L.append('    review: "loose code join — confirm domain and wire name the same rule"')
        L.append(f'    reachable: {str(g["reachable_hint"]).lower()}')
        L.append('    violate: ""      # TODO the state/input that breaks the rule')
        L.append('    action_ui: ""    # TODO how the user attempts it through THIS screen')
        L.append(f'    source: {_q(g["source"])}')
    if gres['findings']:
        L.append('')
        L.append('# contract findings to report alongside the run:')
        L += [f'#   - {f}' for f in gres['findings']]
    out.write_text('\n'.join(L) + '\n', encoding='utf-8')


# ── VIF section block writer ──────────────────────────────────────────────────
# Same contract as `--emit-guards`: a DRAFT the author merges, never retypes.
# Hand-transcription is the failure mode being removed — a section left out of the
# spec-yaml is a section no gate can ask about, because a gate can only check what
# it was handed. That is exactly how `a11y_requirements` stayed empty on a live
# suite whose VIF declared six §Accessibility bullets: 0 a11y TCs, no complaint.

def _yl(val) -> str:
    """One scalar, YAML-safe. Everything from a VIF is a string; quoting all of it
    avoids `disposition: Captured` vs `on: true` style coercion surprises."""
    return _q('' if val is None else str(val))


def _emit_rows(L: list, key: str, rows: list[dict], indent: str = '  ') -> None:
    if not rows:
        L.append(f'{indent}{key}: []')
        return
    L.append(f'{indent}{key}:')
    for r in rows:
        first = True
        for k, v in r.items():
            lead = f'{indent}  - ' if first else f'{indent}    '
            L.append(f'{lead}{k}: {_yl(v)}')
            first = False


def _write_vif_block(out: Path, vif: dict) -> None:
    s = vif['sections']
    a11y_clauses = vif.get('a11y_clauses') or []
    L = [
        '# DRAFT — extracted by resolve_specs.py --emit-vif-block.',
        '# Merge into spec/ui/{feature}-spec.yaml. Rows are VERBATIM from the VIF;',
        '# what you add is the assertion intent, never a re-typed row.',
        f'# VIF: {vif["spec_id"]} v{vif.get("version", "?")} '
        f'(grammar {vif["grammar"]}, subtype {s["subtype"]})',
        '',
        '# §Acceptance Criteria — the screen\'s definition of done, one entry per AC.',
        '# The Step 4.5 AC-coverage gate asks for >=1 TC per id, so an id dropped here',
        '# is an AC that silently stops being tested.',
    ]
    if s['acceptance_criteria']:
        L.append('vif_acceptance_criteria:')
        for ac in s['acceptance_criteria']:
            L.append(f'  - id: {_yl(ac["id"])}')
            L.append(f'    text: {_yl(ac["text"])}')
            L.append('    untestable: ""   # a REASON here excuses the id from the gate '
                     '(e.g. a preview-emitter AC); empty = must be covered')
    else:
        L.append('vif_acceptance_criteria: []   # ⚠️ none found — the VIF grammar requires >=5')

    L += ['',
          '# §Accessibility — one entry per bullet, VERBATIM. The scope is the section:',
          '# no WCAG sweep, no landmark audit, no keyboard contract the VIF is silent about.',
          '# Read references/a11y-scoped.md BEFORE asserting any of these — three traps in it',
          '# have each already cost a false finding (settled-activeElement, toast sampling,',
          '# the hidden 1x1 Switch input).']
    if a11y_clauses:
        L.append('a11y_requirements:')
        for c in a11y_clauses:
            body = re.sub(r'^-\s*', '', c).strip()
            gm = re.match(r'\*\*(?P<g>[^*]+?)\*\*\s*:?\s*(?P<rest>.*)$', body, re.S)
            L.append(f'  - group: {_yl((gm.group("g") if gm else "ARIA roles").strip())}')
            L.append(f'    clause: {_yl((gm.group("rest") if gm else body).strip())}')
    else:
        L.append('a11y_requirements: []   # VIF §Accessibility is empty or absent — correct '
                 'outcome is ZERO a11y TCs')

    L += ['',
          '# §State Management — `Initial Value` is the BOOT contract: what the screen',
          '# must request and show before the user touches anything.']
    sd = [{**r, 'observable': ''} for r in s['state_management']]
    _emit_rows(L, 'state_defaults', sd, indent='')
    L.append('# ^ fill `observable:` per row — control | request | none.')
    L.append('#   control = the widget shows this value on load · request = the COLD-LOAD')
    L.append('#   request carries it (the stronger oracle; pair with query_params) ·')
    L.append('#   none = internal only, no TC — and then say why in a `note:`.')

    L += ['',
          '# §Responsive Rules — all 3 breakpoints are mandatory in the grammar.',
          '# Behavioural mandates only ("CreatedAt column hidden at tablet"), never CSS.']
    _emit_rows(L, 'responsive_rules', s['responsive'], indent='')

    L += ['',
          '# §Empty & Error Precedence — WHICH surface wins and at WHAT level',
          '# (full-page / component / inline, retry vs none, which controls disable).',
          '# Distinct from `error_messages`, which only says the error exists.']
    ep = [{'id': f'EP-{i}', **r} for i, r in enumerate(s['error_precedence'], 1)]
    _emit_rows(L, 'error_precedence', ep, indent='')
    L.append('# ^ `id` is positional and pinned to this VIF revision — the `Condition` '
             'cell is a prose')
    L.append('#   sentence, so it cannot be matched against a TC. Cite EP-n in the TC '
             'spec_ref. Add')
    L.append('#   `level`/`suppresses`/`retry`/`disables` per row: the LEVEL is the '
             'oracle, not the copy.')

    L += ['',
          '# §Component Tree — Empty/Error copy per component, verbatim. This is the',
          '# ONLY authority for on-screen empty copy (with CT `Message` for errors).',
          '# A row whose Empty State is real copy (not "—" / "N/A") is a gated oracle:',
          '# some TC must force that component to no-data and assert this exact string.']
    _emit_rows(L, 'component_tree', s['component_tree'], indent='')

    L += ['',
          '# §Data Binding — Component -> Source Endpoint. Needed to make the Component',
          '# Tree assertable: forcing a component to its Empty state means mocking ITS',
          '# endpoint, and this is the only place that mapping is written down.']
    _emit_rows(L, 'data_binding', s['data_binding'], indent='')

    L += ['',
          '# §Routing & Entry Points — one boot state per distinct arrival.',
          f'route: {_yl(s["routing"]["route"])}']
    _emit_rows(L, 'entry_points', s['routing']['entry_points'], indent='')

    if s['subtype'] == 'task-screen':
        L += ['', '# ── task-screen sections (§5.3) ──────────────────────────────',
              '# Present because this VIF declares `task_journey_id`. A generic VIF',
              '# must NOT carry these (Gate G9).']
        L.append('task_screen:')
        L.append('  task_journey:')
        for k, v in (s['task_journey'] or {}).items():
            L.append(f'    {k}: {_yl(v)}')
        L.append('    route_reachable: "unknown"   # yes | no | unknown — a task route the '
                 'deployed app never implemented is a real finding, and the landing page '
                 'passing is NOT evidence for it')
        _emit_rows(L, 'screen_blueprints', s['screen_blueprints'], indent='  ')
        L.append('  screens:')
        for sc in s['task_screens']:
            L.append(f'    - screen_id: {_yl(sc["screen_id"])}')
            L.append(f'      blueprint: {_yl(sc["blueprint"])}')
            for kind, entries in sc['blocks'].items():
                # Rows of the same kind are merged across the screen's bold blocks:
                # the labels are provenance for a reader, but every gate and builder
                # asks per ROW, and a per-block nesting would only be flattened again.
                L.append(f'      block_labels_{kind}: '
                         f'[{", ".join(_yl(e["label"]) for e in entries)}]')
                _emit_rows(L, kind, [r for e in entries for r in e['rows']], indent='      ')
            for u in sc['unclassified']:
                L.append(f'      # ⚠️ UNCLASSIFIED block "{u["label"]}" — header '
                         f'{u["header"]}. Read it by hand and derive its TCs manually; it '
                         f'was NOT dropped, but no known task-screen table shape matched it.')
        _emit_rows(L, 'data_mapping', s['data_mapping'], indent='  ')
        L += ['',
              '# §Verification Fixtures — ready-made oracles. Entity Snapshots are',
              '# `mutate:` payloads whose expected rendering the `Verifies` cell states;',
              '# a fixture demanding text render "without overflow" on a NAMED surface is',
              '# a layout_stress mandate (detail_surface when that surface is a sheet).']
        L.append('  fixtures:')
        for g in s['fixtures']:
            for r in g['rows']:
                fid = (r.get('fixture_id') or '').strip()
                L.append(f'    - fixture_id: {_yl(fid)}')
                L.append(f'      group: {_yl(g["group"])}')
                for k, v in r.items():
                    if k != 'fixture_id':
                        L.append(f'      {k}: {_yl(v)}')
                L.append('      use_as: ""   # mutate | seed | assertion | none (+ a reason)')

    # The counts the Step 4.5 dimension-8 gate compares the spec-yaml against.
    # This block is the whole anti-silent-drop mechanism: a gate can only ask about
    # what it was handed, so `a11y_requirements` sat empty on a live suite whose VIF
    # declared six §Accessibility bullets and nothing complained. With the declared
    # counts in the yaml, an empty modelled block becomes UNDER-DECLARED instead of
    # invisible — the same trick `enf_underdeclared` already plays for guards.
    kindcount: dict[str, int] = {}
    for sc in s['task_screens']:
        for k, entries in sc['blocks'].items():
            kindcount[k] = kindcount.get(k, 0) + sum(len(e['rows']) for e in entries)
    L += ['',
          '# ⛔ DO NOT EDIT — counts read off the VIF. The Step 4.5 dimension-8 gate',
          '# compares each against what the yaml actually models; a non-zero count here',
          '# with an empty block above is reported as UNDER-DECLARED, not as absence.',
          'vif_sections_declared:',
          f'  subtype: {_yl(s["subtype"])}',
          f'  acceptance_criteria: {len(s["acceptance_criteria"])}',
          f'  a11y_clauses: {len(a11y_clauses)}',
          f'  state_management: {len(s["state_management"])}',
          f'  responsive: {len(s["responsive"])}',
          f'  error_precedence: {len(s["error_precedence"])}',
          f'  component_tree: {len(s["component_tree"])}',
          f'  component_empty_copy: {_count_real_empty(s["component_tree"])}',
          f'  data_binding: {len(s["data_binding"])}',
          f'  entry_points: {len(s["routing"]["entry_points"])}']
    if s['subtype'] == 'task-screen':
        L.append(f'  task_screens: {len(s["task_screens"])}')
        L.append(f'  fixtures: {sum(len(g["rows"]) for g in s["fixtures"])}')
        for k in ('columns', 'query_params', 'fields_not_displayed',
                  'support_panels', 'form_fields', 'actions'):
            L.append(f'  {k}: {kindcount.get(k, 0)}')

    a = s['audit']
    if a['missing'] or a['forbidden'] or a['unrecognised']:
        L.append('')
        L.append('# grammar section contract — report these with the run:')
        for m in a['missing']:
            L.append(f'#   MISSING required section "## {m}" — a spec (PnC) finding, '
                     f'not something this run fills in')
        for f in a['forbidden']:
            L.append(f'#   FORBIDDEN section "## {f}" for subtype {s["subtype"]} (Gate G9)')
        for u in a['unrecognised']:
            L.append(f'#   outside the §5.4 whitelist: "## {u}" — may hold an oracle, '
                     f'read it by hand')
    out.write_text('\n'.join(L) + '\n', encoding='utf-8')


# ── CT slicing ────────────────────────────────────────────────────────────────
# A CT is opened for its endpoint, request-DTO and error tables. The rest of the
# file — `Response DTOs` and `Change Log` alone are 38% of the CT corpus — is never
# named by any step of the synthesis, and on a cross-BC CT it describes an API
# surface this screen does not test. Slicing is a read-volume cut only: whatever is
# kept is kept byte-for-byte, and the dropped section names are always printed.

CT_SLICE_KEEP = ['Endpoints', 'Request DTOs', 'Error Responses',
                 'Auth & Security', 'Rate Limiting', 'Pagination']


def _split_sections(raw: str) -> tuple[str, list[tuple[str, str]]]:
    """(preamble, [(heading name, full text incl. its `## ` heading), …])."""
    marks = [(m.group(1).strip(), m.start()) for m in re.finditer(r'^## (.+)$', raw, re.M)]
    if not marks:
        return raw, []
    bounds = [p for _, p in marks] + [len(raw)]
    return raw[:marks[0][1]], [(n, raw[bounds[i]:bounds[i + 1]])
                               for i, (n, _) in enumerate(marks)]


def slice_ct(src: Path, out_dir: Path) -> dict:
    """Write the kept sections of one CT verbatim. Returns a per-file report."""
    raw = src.read_text(encoding='utf-8')
    preamble, sections = _split_sections(raw)
    kept = [(n, body) for n, body in sections if n in CT_SLICE_KEEP]
    dropped = [n for n, _ in sections if n not in CT_SLICE_KEEP]

    header = (f'<!-- SLICE of {src} — sections kept verbatim: '
              f'{", ".join(n for n, _ in kept) or "none"}.\n'
              f'     Dropped (read the source file if you need one): '
              f'{", ".join(dropped) or "none"}. -->\n')
    out = out_dir / f'{_spec_id_of(src)}.slice.md'
    out.write_text(header + preamble + ''.join(b for _, b in kept), encoding='utf-8')
    return {'id': _spec_id_of(src), 'src': src, 'out': out,
            'before': len(raw), 'after': out.stat().st_size, 'dropped': dropped}


def decide(vif: dict) -> tuple[list[dict], list[dict]]:
    """Apply the 3 open rules. Returns (needed, skipped)."""
    needed, skipped = [], []
    all_ids = sorted(set(vif['dep_ids']) | vif['body_ids'])
    for sid in all_ids:
        t = sid.split('-')[0]
        if sid == vif['spec_id'] or t == 'VIF':
            continue
        if t in NEVER_OPEN:
            skipped.append({'id': sid, 'reason': NEVER_OPEN[t]})
            continue
        if t == 'CT':
            needed.append({'id': sid, 'rule': 1,
                           'why': 'verbatim error copy — §Error Responses `Message` + `Applies To`'})
        elif t == 'ES':
            if not vif['has_bounds'] and vif['has_write']:
                why = 'VIF §Validation Rules states no boundary number, and the screen writes'
            elif not vif['has_bounds']:
                why = 'VIF §Validation Rules states no boundary number'
            elif vif['has_write']:
                why = 'screen has a write interaction — guards are reachable through the UI'
            else:
                skipped.append({'id': sid,
                                'reason': 'read-only screen and VIF already states its boundaries'})
                continue
            needed.append({'id': sid, 'rule': 2, 'why': why})
        elif t == 'EN':
            if vif['lists_enum_values']:
                skipped.append({'id': sid, 'reason': 'VIF §Validation Rules already lists the values'})
            else:
                needed.append({'id': sid, 'rule': 3, 'why': 'enum referenced but values not listed in VIF'})
        else:
            skipped.append({'id': sid, 'reason': f'{t} is not in the openable set'})
    return needed, skipped


def audit_all(base: Path, roots: list[str]) -> int:
    """Sweep every VIF in every root and report the two things that need periodic re-checking.

    (a) DANGLING references — a `depends_on` id with no file in any root. During an active
        grammar migration these appear and disappear, so a single sighting is not a defect
        report; a reference that survives several days is one to raise with the spec owners.
    (b) The 0.3-FALLBACK BACKLOG — which specs still have no 0.4 version, ranked by how many
        VIFs they hold back. This is the migration ask, generated rather than remembered:
        counts move (the corpus gained ~180 files in one day mid-2026-08), so re-run this
        instead of citing a number from a previous run.

    Also doubles as the genericity check for this script: it must complete over every VIF in
    every BC, at both grammars, including a `shell` subtype, without crashing.
    """
    import collections
    vifs: dict[str, Path] = {}
    for root in reversed(roots):          # earlier root wins
        for f in sorted((base / root).glob('*/VIF-*.md')) if (base / root).is_dir() else []:
            m = _ID_RE.match(f.name)
            if m:
                vifs[m.group(1)] = f
    idx = build_index(roots, base)
    dangling: dict[str, list[str]] = collections.defaultdict(list)
    fallback: dict[str, list[str]] = collections.defaultdict(list)
    crashed: list[str] = []
    for key, f in sorted(vifs.items()):
        try:
            vif = parse_vif(f)
            needed, _ = decide(vif)
        except Exception as exc:                      # noqa: BLE001 — a crash IS the finding
            crashed.append(f'{key}: {type(exc).__name__} {exc}')
            continue
        for n in needed:
            cands = idx.get(n['id'], [])
            if not cands:
                dangling[n['id']].append(key)
            elif not str(cands[0]).startswith(str(base / roots[0])):
                fallback[n['id']].append(key)

    print(f'🔍 swept {len(vifs)} VIF over roots {roots}')
    if crashed:
        print(f'\n💥 CRASHED ({len(crashed)}) — a parse failure here is a script bug, not a spec gap:')
        for c in crashed:
            print(f'   {c}')
    print(f'\n🚫 DANGLING references ({len(dangling)}) — no file in any root:')
    for sid, vs in sorted(dangling.items(), key=lambda x: (-len(x[1]), x[0])):
        print(f'   {sid:14s} referenced by {len(vs)}: {", ".join(vs)}')
    if not dangling:
        print('   (none)')
    print(f'\n⚠️  0.3-FALLBACK BACKLOG ({len(fallback)} specs) — ranked by VIFs held back:')
    for sid, vs in sorted(fallback.items(), key=lambda x: (-len(x[1]), x[0])):
        cost = ('§Error Responses `Applies To` absent -> every error row must have its endpoint '
                'inferred from prose' if sid.startswith('CT')
                else '§Invariants is prose and guards live in `## Domain Methods` -> every guard '
                     'must be hand-derived instead of read off the DSL')
        print(f'   {sid:14s} blocks {len(vs):2d} VIF: {", ".join(vs)}')
        print(f'                  cost: {cost}')
    if not fallback:
        print('   (none — every needed spec has a 0.4 version)')
    return 1 if (dangling or crashed) else 0


def main() -> int:
    ap = argparse.ArgumentParser(description='Resolve the specs a VIF-driven run needs')
    ap.add_argument('--vif', help='path to the VIF markdown (the ONLY declared input)')
    ap.add_argument('--audit-all', action='store_true',
                    help='sweep every VIF: dangling refs + the 0.3-fallback backlog, and '
                         'prove this script still handles every VIF shape')
    ap.add_argument('--roots', default=','.join(DEFAULT_ROOTS),
                    help='comma-separated spec roots in PRIORITY order (default: specs/platform,specs/foundry,.specs-0.3)')
    ap.add_argument('--repo-root', default='.', help='repo root the roots are relative to')
    ap.add_argument('--grammar', default='prefer-0.4', choices=['prefer-0.4', '0.4-strict'],
                    help='0.4-strict halts instead of falling back to a 0.3 file')
    ap.add_argument('--json', help='write the resolution plan here')
    ap.add_argument('--emit-ct-slice', metavar='DIR',
                    help='write each opened CT down to the sections the synthesis reads '
                         '(Endpoints / Request DTOs / Error Responses / Auth / Rate Limiting '
                         '/ Pagination), kept verbatim; OPEN then points at the slice')
    ap.add_argument('--emit-guards',
                    help='write a DRAFT enforcement_guards: yaml block here, extracted from '
                         'the resolved ES + joined to the CT wire codes')
    ap.add_argument('--append-to', metavar='SPEC_YAML',
                    help='append the --emit-vif-block draft straight onto an existing '
                         'spec/ui/{feature}-spec.yaml. This is the intended merge path: the '
                         'block is ~42KB, and reading it in only to type it back out again '
                         'costs ~24k tokens a run and reintroduces the transcription hop the '
                         'draft exists to remove. REFUSES when the file already carries one '
                         'of the block keys — appending then makes a duplicate key that '
                         'yaml.safe_load resolves silently to the last one')
    ap.add_argument('--emit-vif-block',
                    help='write a DRAFT yaml block for every VIF section the synthesis '
                         'reads — acceptance criteria, state defaults, responsive rules, '
                         'error precedence, component tree, entry points, and (task-screen '
                         'only) task journey / blueprints / task screens / data mapping / '
                         'verification fixtures. Merge it; never retype a row')
    args = ap.parse_args()

    base = Path(args.repo_root).resolve()
    roots_arg = [r.strip() for r in args.roots.split(',') if r.strip()]
    if args.audit_all:
        return audit_all(base, roots_arg)
    if not args.vif:
        print('❌ pass --vif <path>, or --audit-all to sweep every VIF', file=sys.stderr)
        return 2
    vif_path = Path(args.vif)
    if not vif_path.is_absolute():
        vif_path = base / vif_path
    if not vif_path.exists():
        print(f'❌ VIF not found: {vif_path}', file=sys.stderr)
        return 2

    roots = [r.strip() for r in args.roots.split(',') if r.strip()]
    idx = build_index(roots, base)
    vif = parse_vif(vif_path)
    needed, skipped = decide(vif)

    resolved, fallbacks, unresolved = [], [], []
    for n in needed:
        cands = idx.get(n['id'], [])
        if not cands:
            unresolved.append(n)
            continue
        pick = cands[0]
        g = grammar_of(pick)
        is_fb = not str(pick).startswith(str(base / roots[0]))
        if is_fb and args.grammar == '0.4-strict':
            unresolved.append({**n, 'note': f'only available at {roots[-1]} (grammar {g})'})
            continue
        entry = {**n, 'path': str(pick.relative_to(base)), 'grammar': g, 'fallback': is_fb}
        resolved.append(entry)
        if is_fb:
            fallbacks.append(entry)

    vif_ver = vif.get('version') or ''
    print(f'📐 VIF: {vif["spec_id"]} v{vif_ver or "?"} — {vif["title"]}  '
          f'(grammar {vif["grammar"]})')
    if not vif_ver:
        print(f'   ⚠️  this VIF has NO `version:` in its frontmatter — Step 4 will HALT. '
              f'Ask PnC to version it; do not invent one.')
    print(f'   tags={",".join(vif["tags"])}  write-interaction={vif["has_write"]}  '
          f'own-boundaries={vif["has_bounds"]}  a11y-clauses={len(vif["a11y_clauses"])}')
    if vif['operation_ids']:
        print(f'   operationId candidates: {", ".join(vif["operation_ids"])}')
    # --- CT slicing (before OPEN, so the paths printed there are the ones to read) --
    slices = {}
    if args.emit_ct_slice:
        sdir = Path(args.emit_ct_slice)
        sdir.mkdir(parents=True, exist_ok=True)
        for r in resolved:
            if r['id'].startswith('CT-'):
                slices[r['id']] = slice_ct(base / r['path'], sdir)

    print(f'\n📂 OPEN ({len(resolved)}):')
    for r in resolved:
        flag = '  ⚠️ 0.3 FALLBACK' if r['fallback'] else ''
        sl = slices.get(r['id'])
        path = sl['out'] if sl else r['path']
        print(f'   [rule {r["rule"]}] {r["id"]:14s} g{r["grammar"]:4s} {path}{flag}')
        print(f'                  why: {r["why"]}')
        if sl:
            print(f'                  slice: {sl["before"] / 1024:.0f}KB → '
                  f'{sl["after"] / 1024:.0f}KB  (dropped: {", ".join(sl["dropped"]) or "none"})')

    if slices:
        b = sum(s['before'] for s in slices.values())
        a = sum(s['after'] for s in slices.values())
        print(f'\n✂️  {len(slices)} CT sliced: {b / 1024:.0f}KB → {a / 1024:.0f}KB '
              f'(-{100 * (b - a) // b}%). Read the slice, not the source — every kept '
              f'section is byte-for-byte. Need a dropped section? The source path is in '
              f'each slice header.')
    if unresolved:
        print(f'\n🚫 UNRESOLVED ({len(unresolved)}) — state these as gaps, never silently skip:')
        for u in unresolved:
            print(f'   {u["id"]:14s} {u.get("note", "no file for this id in any root")}')
    print(f'\n🙈 NOT OPENED ({len(skipped)}):')
    for s in skipped:
        print(f'   {s["id"]:14s} {s["reason"]}')
    if fallbacks:
        print(f'\n⚠️  {len(fallbacks)} file(s) fell back to grammar 0.3 — record each in '
              f'`source_specs` as "(grammar 0.3 FALLBACK)" and report the list: these are '
              f'the specs PnC has not migrated yet.')

    # The version block is MANDATORY in the spec-yaml (generate_test_cases.py exits
    # without it). Printed as copy-paste lines so the version is never re-typed from
    # memory — the only authority is the `version:` in the VIF frontmatter above.
    print('\n📋 spec-yaml provenance block — REQUIRED, paste verbatim:')
    print(f'   vif_id: "{vif["spec_id"]}"')
    print(f'   vif_version: "{vif_ver}"')
    print(f'   vif_grammar: "{vif["grammar"]}"')

    print('\n📋 source_specs lines to paste into the spec-yaml:')
    print(f'   - "{vif["spec_id"]} v{vif_ver} {vif.get("title", "")} '
          f'(grammar {vif["grammar"]})"')
    for r in resolved:
        fb = ' FALLBACK' if r['fallback'] else ''
        print(f'   - "{r["id"]} (grammar {r["grammar"]}{fb})"')

    # --- guard extraction -------------------------------------------------
    es_specs = [parse_es(base / r['path']) for r in resolved if r['id'].startswith('ES-')]
    ct_specs = [parse_ct(base / r['path']) for r in resolved if r['id'].startswith('CT-')]
    gres = build_guards(vif, es_specs, ct_specs) if es_specs else \
        {'guards': [], 'findings': [], 'from_prose': False}

    if es_specs:
        reach = [g for g in gres['guards'] if g['reachable_hint']]
        print(f'\n🛡  GUARDS extracted: {len(gres["guards"])} '
              f'({len(reach)} reachable through THIS screen)')
        if gres['from_prose']:
            print('   ⚠️  at least one ES is grammar 0.3 — guards recovered from prose, '
                  'treat the list as INCOMPLETE and derive the rest by hand')
        for g in gres['guards']:
            mark = '→' if g['reachable_hint'] else ' '
            wire = g['wire_code'] or (f"collapsed:{g['collapsed_into']}"
                                      if g['collapsed_into'] else 'NO WIRE CODE')
            print(f'   {mark} {g["id"]}  {g["target"]:34s} {g["error_code"] or "—"}')
            print(f'        wire: {wire}')
        if gres['findings']:
            print(f'\n🔎 CONTRACT FINDINGS ({len(gres["findings"])}) — report these, '
                  f'they are defects a VIF-only read cannot see:')
            for f in gres['findings']:
                print(f'   • {f}')

    if vif.get('nav'):
        print(f'\n🧭 NAV entry declared: leaf="{vif["nav"]["leaf"]}" '
              f'parent="{vif["nav"]["parent"]}" — the suite MUST prove this label is '
              f'clickable in the nav or sidebar and lands on the route. Absent in BOTH '
              f'places = the screen ships unreachable.')
    else:
        print('\n🧭 no `**Nav:**` declared — embedded panel or drill-in, no nav TC required.')

    # --- VIF section inventory -------------------------------------------
    # Printed for every run, not only when --emit-vif-block is passed: the counts
    # are what make a dropped section noticeable. A zero beside a section the
    # grammar requires is the signal.
    S = vif['sections']
    ts = S['task_screens']
    print(f'\n📑 VIF SECTIONS (subtype {S["subtype"]}) — oracles available to this run:')
    print(f'   acceptance criteria {len(S["acceptance_criteria"]):3d}   '
          f'({", ".join(a["id"] for a in S["acceptance_criteria"]) or "NONE"})')
    print(f'   component tree rows {len(S["component_tree"]):3d}   '
          f'state defaults {len(S["state_management"]):3d}   '
          f'responsive rows {len(S["responsive"]):3d}')
    print(f'   error precedence    {len(S["error_precedence"]):3d}   '
          f'entry points   {len(S["routing"]["entry_points"]):3d}   '
          f'a11y clauses    {len(vif["a11y_clauses"]):3d}')
    if S['subtype'] == 'task-screen':
        kinds: dict[str, int] = {}
        unc = 0
        nonstd = []
        for sc in ts:
            for k, entries in sc['blocks'].items():
                kinds[k] = kinds.get(k, 0) + sum(len(e['rows']) for e in entries)
                nonstd += [(sc['screen_id'], k, e['label'], e['header'])
                           for e in entries if e.get('header_nonstandard')]
            unc += len(sc['unclassified'])
        print(f'   task screens        {len(ts):3d}   '
              f'blueprints {len(S["screen_blueprints"]):3d}   '
              f'data mapping {len(S["data_mapping"]):3d}   '
              f'fixture groups {len(S["fixtures"]):3d}')
        print('   task-screen rows: ' + ('  '.join(f'{k}={v}' for k, v in sorted(kinds.items()))
                                         or ('NONE classified' if unc else
                                             'NONE — check the parse, this VIF declares screens')))
        if unc:
            print(f'   ⚠️  {unc} task-screen table(s) matched no known shape — they are in '
                  f'`unclassified` WITH their header, not dropped. Read them by hand and '
                  f'derive their TCs manually.')
        for sid, k, label, hdr in nonstd:
            print(f'   ⚠️  non-canonical header on {sid} "{label}" → read as {k}: '
                  f'{hdr}. Grammar says `Form Field | Entity Binding | Contract Binding | '
                  f'Required` — report the deviation as a spec finding.')
        if not kinds.get('query_params'):
            print('   ℹ️  no Query Parameters table — the outbound default-request oracle '
                  '(filter / page size / sorting) cannot be derived for this screen.')
    A = S['audit']
    if A['missing']:
        print(f'\n🚨 GRAMMAR CONTRACT — {len(A["missing"])} REQUIRED section(s) absent: '
              f'{", ".join(A["missing"])}')
        print('   This is a spec finding (PnC), not something the run fills in. Report it '
              'and name the coverage class that is therefore thin.')
    if A['forbidden']:
        print(f'\n🚨 GRAMMAR CONTRACT — section(s) forbidden for subtype '
              f'{S["subtype"]} (Gate G9): {", ".join(A["forbidden"])}')
    for comp, txt in _loading_in_empty(S['component_tree']):
        print(f'\nℹ️  §Component Tree "{comp}" puts LOADING copy in the Empty State '
              f'column: "{txt}". Not gated as empty copy — asserting it on a no-rows '
              f'response would fail a conformant screen. Report it as a spec-column '
              f'mistake (PnC).')
    if A['unrecognised']:
        print(f'\nℹ️  sections outside the §5.4 whitelist: {", ".join(A["unrecognised"])} '
              f'— may carry an oracle; read by hand, do not assume they are noise.')

    if args.emit_guards:
        _write_guard_yaml(Path(args.emit_guards), gres, vif)
        print(f'\n✅ draft guards → {args.emit_guards}  '
              f'(REVIEW: prune the non-reachable ones, fill violate/action_ui)')

    if args.emit_vif_block:
        _write_vif_block(Path(args.emit_vif_block), vif)
        print(f'✅ draft VIF section block → {args.emit_vif_block}  '
              f'(MERGE into the spec-yaml; the rows are verbatim — never retype one)')

    if args.append_to:
        target = Path(args.append_to)
        if not target.exists():
            print(f'❌ --append-to: no such file {target}', file=sys.stderr)
            return 2
        tmp = target.with_suffix(target.suffix + '.vifblock')
        _write_vif_block(tmp, vif)
        block = tmp.read_text(encoding='utf-8')
        tmp.unlink()
        existing = target.read_text(encoding='utf-8')
        # The spec-version block is the ONE thing that must never be hand-typed — it is
        # the whole attributability contract, and Step 4 HALTS without it — yet it was
        # the one thing this flag still left to the author. Three scalars, so they are
        # substituted in place (or added) rather than appended: a template-written yaml
        # already carries them as empty placeholders, and appending would duplicate.
        prov = {'vif_id': vif['spec_id'], 'vif_version': vif_ver,
                'vif_grammar': vif['grammar']}
        for k, v in prov.items():
            line = f'{k}: "{v}"'
            if re.search(rf'^{k}:', existing, re.M):
                existing = re.sub(rf'^{k}:.*$', line, existing, count=1, flags=re.M)
            else:
                existing += ('' if existing.endswith('\n') else '\n') + line + '\n'
        target.write_text(existing, encoding='utf-8')
        # A key already present means a previous merge is still in the file. Appending
        # would leave BOTH copies, and yaml.safe_load takes the last silently — so a
        # stale row could survive a re-test and be read as current. Refuse and say
        # which keys to delete first.
        block_keys = [ln.split(':', 1)[0] for ln in block.splitlines()
                      if re.match(r'^[a-z_][a-z0-9_]*:', ln)]
        dupes = [k for k in block_keys
                 if re.search(rf'^{re.escape(k)}:', existing, re.M)]
        if dupes:
            print(f'⛔ NOT APPENDED — {target} already carries: {", ".join(sorted(set(dupes)))}',
                  file=sys.stderr)
            print('   A second copy would shadow the first silently (safe_load keeps the '
                  'LAST), so a stale row could outlive a re-test. Delete the old block '
                  '(everything from the "# DRAFT — extracted by resolve_specs.py" marker '
                  'down) and re-run, or write the yaml fresh per 2d.', file=sys.stderr)
            return 2
        with target.open('a', encoding='utf-8') as fh:
            fh.write('\n' + block)
        print(f'✅ VIF section block appended → {target}  '
              f'({len(block)} bytes, {len(block_keys)} top-level keys, 0 through context)')
        print(f'   spec-version block set in place: vif_id="{prov["vif_id"]}" '
              f'vif_version="{prov["vif_version"]}" vif_grammar="{prov["vif_grammar"]}"'
              + ('   ⚠️ the VIF has NO version: — Step 4 will still HALT, ask PnC'
                 if not vif_ver else ''))

    plan = {'vif': {k: v for k, v in vif.items() if k not in ('body_ids', 'haystack')},
            'roots': roots, 'grammar_mode': args.grammar,
            'open': resolved, 'unresolved': unresolved,
            'not_opened': skipped, 'fallbacks': [f['id'] for f in fallbacks],
            'guards': gres['guards'], 'contract_findings': gres['findings']}
    if args.json:
        Path(args.json).write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding='utf-8')
        print(f'\n✅ plan → {args.json}')
    return 1 if unresolved else 0


if __name__ == '__main__':
    sys.exit(main())
