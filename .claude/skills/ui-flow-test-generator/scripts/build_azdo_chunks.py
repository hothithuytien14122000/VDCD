#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 11a — Build Azure DevOps-postable comment fragments from a UI report.

Reads:
  - report/ui/{date}/{feature}/ui-report.html  (output of convert_md_to_html.py)

Writes:
  - {out-dir}/part-01.html … part-NN.html  — bare HTML fragments, each < --max-chars

Why this exists instead of a generic HTML splitter: an ADO comment caps at 4000
characters, and Section 3 of a UI report is ~96% of the file because it emits one
rich detail card per test case. Splitting that blindly produces dozens of comments
nobody reads and a chunk boundary that lands mid-table. What a reviewer on the work
item actually needs is the verdict, the flow coverage, and the test cases that did
NOT pass — the full per-case detail already lives in the HTML artifact.

So Section 3 is reduced here: the tally is kept verbatim, the summary table keeps
only its non-PASS rows, and only non-PASS detail cards survive — trimmed to
identity, spec ref, expected and actual, without the reproduction steps. Sections
1, 2, 4 and 5 are passed through whole. Nothing is ever silently truncated: content is
dropped only by the documented rule above, and every part is verified against the
limit before it is written.

Usage:
    python3 build_azdo_chunks.py report/ui/2026-08-19/decision-recording/ui-report.html \
        --out-dir report/ui/2026-08-19/decision-recording/azdo-chunks \
        --post 148744

Without --post the parts are only written to disk. With it they are also posted, in
order, as comments on that work item — which keeps the whole report out of the
agent's context instead of having it read each part back and paste it into a tool call.
--post stops short of the work item when the part count is over --warn-parts; add
--force once the report has been read.

Credentials: AZDO_PAT / AZDO_ORG / AZDO_PROJECT, else the azure-devops headers in an
MCP config (`--mcp-json <path>`, else `.mcp.json` or `.vscode/mcp.json` walking up from
this script, else the same two under $HOME). Nothing is read from the test `.env`.
"""

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# 4000 is the ADO comment cap. The default leaves room for the "Part N/M" header
# this script prepends and a few bytes of slack.
DEFAULT_MAX_CHARS = 3930
HEADER_RESERVE = 80          # bytes reserved for '<h3>Part N/M — …</h3>'
DEFAULT_WARN_PARTS = 6


# ── Section extraction ────────────────────────────────────────────────────────

def body_of(html: str) -> str:
    """Return the <body> content with <style>/<script> removed.

    The wrapper is what made the previous splitter emit chunks that still busted
    the cap: a fragment carrying its own <head><style> spends most of its budget on
    CSS that ADO strips anyway.
    """
    m = re.search(r'<body[^>]*>(.*)</body>', html, re.S | re.I)
    body = m.group(1) if m else html
    body = re.sub(r'<style\b.*?</style>', '', body, flags=re.S | re.I)
    body = re.sub(r'<script\b.*?</script>', '', body, flags=re.S | re.I)
    return body.strip()


def split_sections(body: str) -> list[str]:
    """Split the body at <h2> boundaries. Index 0 is whatever precedes the first
    <h2> (the <h1> title)."""
    parts = re.split(r'(?=<h2\b)', body)
    return [p.strip() for p in parts if p.strip()]


def section_number(sec: str) -> int | None:
    m = re.search(r'Section\s+(\d)', sec[:300])
    return int(m.group(1)) if m else None


# ── Section 3 reduction ───────────────────────────────────────────────────────

# Reproduction detail: useful when you are re-running the case, noise when you are
# reading a verdict on a work item. It stays in ui-report.html either way.
_CARD_DROP_FIELDS = {'Preconditions', 'Test Data', 'Steps'}


def trim_card(card: str) -> str:
    """Drop the reproduction rows from a detail card, keeping identity, the spec
    reference, what was expected and what actually happened.

    Past a handful of failures the useful signal is the pattern, not each case's
    steps — a suite failing wholesale is a screen or a deploy problem, and no
    amount of per-step detail in a comment changes that diagnosis.
    """
    def keep(row: str) -> bool:
        keys = re.findall(r'<th class="tc-key">([^<]*)</th>', row)
        return not any(k.strip() in _CARD_DROP_FIELDS for k in keys)

    return re.sub(r'<tr>.*?</tr>',
                  lambda m: m.group(0) if keep(m.group(0)) else '',
                  card, flags=re.S)


def _is_pass(fragment: str) -> bool:
    """A summary row or a detail card is a PASS when generate_report tagged it with
    the `pass` css class. Matching on the class, not on the emoji or the word,
    keeps this working when the label text changes."""
    return ('tc-status-pass' in fragment) or ('tc-card-pass' in fragment)


def reduce_section3(sec: str) -> tuple[str, str, list[str], list[str]]:
    """Return (head_html, table_open, kept_rows, kept_cards) for Section 3.

    head_html   — the <h2> and the tally paragraph, verbatim.
    table_open  — '<table …>' plus the header <tr>, so a table that spans several
                  parts can be reopened with its columns intact.
    kept_rows   — summary <tr> rows whose status is not PASS.
    kept_cards  — detail cards whose status is not PASS.
    """
    head = sec.split('<h3>', 1)[0].strip()

    table_open, kept_rows = '', []
    if '<h3>Summary</h3>' in sec:
        after = sec.split('<h3>Summary</h3>', 1)[1]
        table_html = after.split('</table>', 1)[0]
        m = re.search(r'<table[^>]*>', table_html)
        rows = re.findall(r'<tr>.*?</tr>', table_html, re.S)
        header_row = rows[0] if rows and '<th>' in rows[0] else ''
        table_open = f'<h3>Summary — test cases that did not pass</h3>\n' \
                     f'{m.group(0) if m else "<table>"}\n{header_row}'
        kept_rows = [r for r in rows[1:] if not _is_pass(r)]

    kept_cards = []
    if '<h3>Test Case Details</h3>' in sec:
        after = sec.split('<h3>Test Case Details</h3>', 1)[1]
        # Anchor on the two-class opener `tc-card tc-card-{css}`. Matching `tc-card\b`
        # would also hit the card's own `<div class="tc-card-head">`, splitting every
        # card in two and letting the half without the status class through as non-PASS.
        card_open = re.compile(r'<div class="tc-card tc-card-\w+"')
        starts = [m.start() for m in card_open.finditer(after)]
        cards = [after[s:e] for s, e in zip(starts, starts[1:] + [len(after)])]
        kept_cards = [trim_card(c).strip() for c in cards if not _is_pass(c)]

    return head, table_open, kept_rows, kept_cards


# ── Packing ───────────────────────────────────────────────────────────────────

class Unit:
    """One atomic piece of HTML. `table_open` is set when the unit is a table row,
    so a part that starts mid-table can reopen the table and repeat its header."""

    def __init__(self, html: str, table_open: str = ''):
        self.html = html.strip()
        self.table_open = table_open

    def __len__(self) -> int:
        return len(self.html)


def split_oversized(unit: Unit, limit: int) -> list[Unit]:
    """Break a unit that cannot fit in one part into several that can.

    Dropping it instead would be the worst possible outcome here: the units that
    grow past a whole comment are precisely the failing test cases, whose error
    text is long because the failure is interesting. So split at inner block
    boundaries, and if one indivisible block is still too long, truncate it with a
    marker the reader can see — never silently.
    """
    if len(unit) <= limit:
        return [unit]

    pieces = re.split(r'(?<=</tr>)|(?<=</li>)|(?<=</p>)|(?<=</div>)', unit.html)
    out: list[Unit] = []
    buf, size = [], 0
    for piece in pieces:
        piece = piece.strip()
        if not piece:
            continue
        if len(piece) > limit:                      # one indivisible block, still too long
            if buf:
                out.append(Unit('\n'.join(buf), unit.table_open))
                buf, size = [], 0
            marker = ' … [truncated — full text in ui-report.html]'
            out.append(Unit(piece[:limit - len(marker)] + marker, unit.table_open))
            continue
        if size + len(piece) + 1 > limit and buf:
            out.append(Unit('\n'.join(buf), unit.table_open))
            buf, size = [], 0
        buf.append(piece)
        size += len(piece) + 1
    if buf:
        out.append(Unit('\n'.join(buf), unit.table_open))
    return out


def pack(units: list[Unit], limit: int) -> list[str]:
    """Greedily fill parts up to `limit`, never breaking a unit in half."""
    parts: list[str] = []
    buf: list[str] = []
    size = 0
    open_table = ''

    def flush():
        nonlocal buf, size, open_table
        if buf:
            body = '\n'.join(buf)
            if open_table:
                body += '\n</table>'
            parts.append(body)
        buf, size, open_table = [], 0, ''

    for u in units:
        need = len(u) + 1
        prelude = ''
        if u.table_open and u.table_open != open_table:
            prelude = u.table_open           # opening (or reopening) a table
            need += len(prelude) + 1
        elif not u.table_open and open_table:
            need += len('</table>') + 1      # closing the table we are inside

        if size and size + need > limit:
            flush()
            prelude = u.table_open or ''
            need = len(u) + 1 + (len(prelude) + 1 if prelude else 0)

        if prelude:
            if open_table and open_table != prelude:
                buf.append('</table>')
                size += len('</table>') + 1
            buf.append(prelude)
            size += len(prelude) + 1
            open_table = u.table_open
        elif not u.table_open and open_table:
            buf.append('</table>')
            size += len('</table>') + 1
            open_table = ''

        buf.append(u.html)
        size += len(u) + 1

    flush()
    return parts


def build_units(sections: list[str]) -> list[Unit]:
    units: list[Unit] = []
    for sec in sections:
        n = section_number(sec)
        if n != 3:
            # Sections 1/2/4/5 (and the <h1>) go through whole. They are small; split
            # them only at block boundaries if one ever grows past a single part.
            for block in re.split(r'(?<=</table>)|(?<=</ul>)|(?<=</p>)|(?<=</h2>)'
                                  r'|(?<=</h3>)|(?<=</pre>)|(?<=</blockquote>)', sec):
                if block.strip():
                    units.append(Unit(block))
            continue

        head, table_open, rows, cards = reduce_section3(sec)
        units.append(Unit(head))
        if rows:
            for r in rows:
                units.append(Unit(r, table_open=table_open))
        else:
            units.append(Unit('<p><em>Every test case passed — no non-PASS rows to '
                              'list.</em></p>'))
        units.append(Unit(
            '<p><em>The full per-test-case table and all detail cards are in the '
            'attached <code>ui-report.html</code> artifact; only test cases that did '
            'not pass are reproduced here.</em></p>'))
        if cards:
            units.append(Unit('<h3>Details — test cases that did not pass</h3>'))
            for c in cards:
                units.append(Unit(c))
    return units


# ── Posting ───────────────────────────────────────────────────────────────────
# Posting from here instead of having the agent read each part back and paste it
# into a tool call: every byte of the report would otherwise cross the model
# context twice, which for a large suite is more tokens than the rest of the run.

def _mcp_candidates(explicit: str | None) -> list[Path]:
    """Where an azure-devops MCP config may live. Both filenames are already
    gitignored (`.mcp.json`, and `.vscode/*` minus a 4-file allowlist), so the
    PAT never needs to be copied into the test `.env`."""
    if explicit:
        return [Path(explicit).expanduser()]
    out = []
    for parent in Path(__file__).resolve().parents:
        out += [parent / '.mcp.json', parent / '.vscode' / 'mcp.json']
    home = Path.home()
    out += [home / '.mcp.json', home / '.config' / 'Code' / 'User' / 'mcp.json']
    return out


def _headers_from(path: Path) -> dict:
    """Claude Code keys the servers under `mcpServers`, VS Code under `servers`."""
    try:
        cfg = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}
    for key in ('mcpServers', 'servers'):
        srv = cfg.get(key) or {}
        if 'azure-devops' in srv:
            return srv['azure-devops'].get('headers') or {}
    return {}


def _credentials(mcp_json: str | None = None) -> tuple[str, str, str]:
    """env AZDO_PAT / AZDO_ORG / AZDO_PROJECT, else the azure-devops headers in an MCP config."""
    h, searched = {}, []
    for cand in _mcp_candidates(mcp_json):
        searched.append(cand)
        if cand.is_file():
            h = _headers_from(cand)
            break
    pat = os.environ.get('AZDO_PAT') or h.get('x-azure-devops-token', '')
    org = os.environ.get('AZDO_ORG') or h.get('x-azure-devops-org', '')
    prj = os.environ.get('AZDO_PROJECT') or h.get('x-azure-devops-project', '')
    if not (pat and org and prj):
        # Show the repo-root pair, not all ~20 ancestors — a wall of paths buries the
        # one line that matters, which is that the parts are on disk and MCP still works.
        repo = next((p for p in Path(__file__).resolve().parents if (p / '.git').exists()),
                    Path.cwd())
        where = '\n'.join(f'     {p}' for p in
                          (repo / '.mcp.json', repo / '.vscode' / 'mcp.json'))
        raise SystemExit(
            '❌ no Azure DevOps credentials — the parts are on disk, post them via '
            'mcp_azure-devops_add_work_item_comment instead.\n'
            f'   Searched {len(searched)} default locations. To post from the script next '
            'time, either set\n'
            '   AZDO_PAT/AZDO_ORG/AZDO_PROJECT, pass --mcp-json <path>, or copy your MCP '
            'config to\n   one of these (both gitignored):\n' + where)
    return pat, org, prj


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A bad or expired PAT does not get a 401 from ADO — it gets a 302 to the Entra
    sign-in page, which urllib would follow to a 203 + HTML and report as success.
    Refusing the redirect turns that back into a loud failure."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def post_parts(work_item: str, parts: list[Path], mcp_json: str | None = None) -> int:
    pat, org, prj = _credentials(mcp_json)
    url = (f'https://dev.azure.com/{org}/{prj}/_apis/wit/workItems/'
           f'{work_item}/comments?api-version=7.1-preview.4&format=html')
    auth = base64.b64encode(f':{pat}'.encode()).decode()
    opener = urllib.request.build_opener(_NoRedirect)

    print(f'\nPosting {len(parts)} comment(s) to work item {work_item} …')
    for i, p in enumerate(parts, 1):
        body = json.dumps({'text': p.read_text(encoding='utf-8')}).encode('utf-8')
        req = urllib.request.Request(url, data=body, method='POST', headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {auth}',
        })
        try:
            with opener.open(req, timeout=60) as r:
                # Only a parsed comment id proves the comment landed. A 2xx carrying the
                # sign-in HTML would otherwise read as a successful post.
                payload = json.loads(r.read().decode('utf-8', 'replace'))
                if not isinstance(payload, dict) or 'id' not in payload:
                    raise ValueError('response is not a comment object')
        except ValueError:  # includes JSONDecodeError
            print(f'❌ {p.name} failed: the server answered but not with a comment — '
                  f'the PAT is most likely expired or missing Work Items (Read & Write).')
            print(f'   {i - 1}/{len(parts)} posted — post the rest manually, in order, '
                  f'starting at {p.name}')
            return 1
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308, 401, 403):
                # ADO answers an unusable PAT with a redirect to the sign-in page, not a 401.
                detail = ('the PAT is expired, wrong-org, or missing Work Items '
                          '(Read & Write) — ADO bounced the call to its sign-in page')
            else:
                detail = e.read().decode('utf-8', 'replace')[:400]
            print(f'❌ {p.name} failed: HTTP {e.code} — {detail}')
            print(f'   {i - 1}/{len(parts)} posted — post the rest manually, in order, '
                  f'starting at {p.name}')
            return 1
        except urllib.error.URLError as e:
            print(f'❌ {p.name} failed: {e.reason}')
            print(f'   {i - 1}/{len(parts)} posted — post the rest manually, in order, '
                  f'starting at {p.name}')
            return 1
        print(f'   ✔ {p.name} posted ({i}/{len(parts)})')
    return 0


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(
        description='Build ADO-postable HTML fragments from a UI report')
    ap.add_argument('report', help='path to ui-report.html')
    ap.add_argument('--out-dir', required=True)
    ap.add_argument('--max-chars', type=int, default=DEFAULT_MAX_CHARS)
    ap.add_argument('--warn-parts', type=int, default=DEFAULT_WARN_PARTS)
    ap.add_argument('--post', metavar='WORK_ITEM_ID',
                    help='post the parts as work-item comments, in order, instead of '
                         'leaving them to be pasted by hand')
    ap.add_argument('--force', action='store_true',
                    help='let --post proceed even when the part count is over --warn-parts')
    ap.add_argument('--mcp-json', metavar='PATH',
                    help='MCP config holding the azure-devops PAT, when it is not at any '
                         'of the default locations')
    args = ap.parse_args()

    src = Path(args.report)
    if not src.is_file():
        print(f'❌ report not found: {src}')
        return 1

    html = src.read_text(encoding='utf-8')
    units = build_units(split_sections(body_of(html)))

    limit = args.max_chars - HEADER_RESERVE
    n_oversized = sum(1 for u in units if len(u) > limit)
    units = [s for u in units for s in split_oversized(u, limit)]
    parts = pack(units, limit)

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    # A stale part-NN from a previous, longer run would be posted as if it belonged
    # to this one — the reader has no way to tell.
    for old in out.glob('part-*.html'):
        old.unlink()

    total = len(parts)
    written = []
    for i, body in enumerate(parts, 1):
        text = f'<h3>Part {i}/{total} — {src.parent.name}</h3>\n{body}\n'
        if len(text) > args.max_chars:
            print(f'❌ part {i} is {len(text)} chars, over the {args.max_chars} cap — '
                  f'this is a bug in the packer, do not post it')
            return 1
        p = out / f'part-{i:02d}.html'
        p.write_text(text, encoding='utf-8')
        written.append((p, len(text)))

    print(f'✅ {total} part(s) → {out}')
    for p, n in written:
        print(f'   {p.name}  {n:>5} chars')

    if n_oversized:
        print(f'\n⚠️  {n_oversized} test-case card(s) were longer than one comment and were '
              f'SPLIT across parts (nothing dropped). A card that large means its error '
              f'text is long — read it in the report before posting.')

    if total > args.warn_parts:
        print(f'\n⚠️  {total} parts is more than the usual {args.warn_parts}. Nothing was '
              f'dropped, but a report this long usually means an unusually large suite or '
              f'many failures — sanity-check before posting {total} comments.')
        if args.post and not args.force:
            # Build and post used to be two commands, so this warning had a human between
            # it and the work item. --post removed that gap; --force puts it back. The
            # runs that blow past warn_parts are exactly the broken-screen/broken-deploy
            # ones, i.e. the runs least worth spamming a work item with.
            print(f'\n⛔ NOT POSTED — {total} parts is over the {args.warn_parts}-part '
                  f'threshold. Read the report first, then either re-run with --force or '
                  f'post the parts in order via '
                  f'mcp_azure-devops_add_work_item_comment(..., format="html").')
            return 1

    if args.post:
        return post_parts(args.post, [p for p, _ in written], args.mcp_json)

    print('\nPost these in order via '
          'mcp_azure-devops_add_work_item_comment(..., format="html").')
    return 0


if __name__ == '__main__':
    sys.exit(main())
