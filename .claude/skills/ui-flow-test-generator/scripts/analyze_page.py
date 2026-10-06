#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 3 — Analyze page HTML and build element map.

Accepts a URL (http/https) or a local file path (file:// or plain path).
Outputs element-map.json used by generate_test_cases.py and generate_scripts.py.

Usage:
    python3 analyze_page.py --url https://dev.mgios.com/users/create
    python3 analyze_page.py --url file:///d:/path/to/page.html
    python3 analyze_page.py --url file.html --out element-map.json
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


# ── Tiny HTML parser (no external deps) ──────────────────────────────────────

def attr(tag_str: str, name: str) -> str:
    """Extract attribute value from a raw tag string."""
    m = re.search(rf'{name}\s*=\s*["\']([^"\']*)["\']', tag_str, re.IGNORECASE)
    return m.group(1).strip() if m else ''


def text_content(html: str) -> str:
    """Strip tags and return plain text (single line).
    Replace each tag with a space so adjacent nested spans
    (e.g. <span>4MGI Command</span><span>Dental</span>) produce
    correctly separated words instead of concatenating."""
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html)).strip()


def fetch_html(url: str) -> str:
    """Fetch HTML from URL or local file."""
    if url.startswith('file:///') or url.startswith('file://'):
        # Local file
        path = url.replace('file:///', '').replace('file://', '')
        # Windows: file:///d:/path → d:/path
        if sys.platform == 'win32' and len(path) >= 2 and path[1] == '/':
            path = path[0] + ':' + path[1:]
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    elif Path(url).exists():
        with open(url, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    else:
        req = urllib.request.Request(url, headers={'User-Agent': 'UI-Test-Generator/1.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            charset = resp.headers.get_content_charset() or 'utf-8'
            return resp.read().decode(charset, errors='replace')


def parse_inputs(html: str) -> list[dict]:
    inputs = []
    for m in re.finditer(r'<input([^>]*)>', html, re.IGNORECASE | re.DOTALL):
        raw = m.group(1)
        inp = {
            'tag': 'input',
            'type': attr(raw, 'type') or 'text',
            'name': attr(raw, 'name'),
            'id': attr(raw, 'id'),
            'placeholder': attr(raw, 'placeholder'),
            'required': bool(re.search(r'\brequired\b', raw, re.IGNORECASE)),
            'aria_required': attr(raw, 'aria-required') == 'true',
            'disabled': bool(re.search(r'\bdisabled\b', raw, re.IGNORECASE)),
            'value': attr(raw, 'value'),
        }
        inputs.append(inp)
    return inputs


def parse_textareas(html: str) -> list[dict]:
    areas = []
    for m in re.finditer(r'<textarea([^>]*)>', html, re.IGNORECASE | re.DOTALL):
        raw = m.group(1)
        areas.append({
            'tag': 'textarea',
            'name': attr(raw, 'name'),
            'id': attr(raw, 'id'),
            'placeholder': attr(raw, 'placeholder'),
            'required': bool(re.search(r'\brequired\b', raw, re.IGNORECASE)),
            'disabled': bool(re.search(r'\bdisabled\b', raw, re.IGNORECASE)),
        })
    return areas


def parse_selects(html: str) -> list[dict]:
    selects = []
    for m in re.finditer(r'<select([^>]*)>(.*?)</select>', html, re.IGNORECASE | re.DOTALL):
        raw, body = m.group(1), m.group(2)
        options = re.findall(r'<option[^>]*>(.*?)</option>', body, re.IGNORECASE | re.DOTALL)
        selects.append({
            'tag': 'select',
            'name': attr(raw, 'name'),
            'id': attr(raw, 'id'),
            'required': bool(re.search(r'\brequired\b', raw, re.IGNORECASE)),
            'options': [text_content(o) for o in options if text_content(o)],
        })
    return selects


def parse_buttons(html: str) -> list[dict]:
    """Extract <button>/<input type=submit/reset/button>.

    Captures `role` attribute so the generator can emit the correct
    getByRole() when shadcn/Radix overrides the role (e.g. RadioGroup
    children carry role="radio" on a Button component).
    Also captures `class` so responsive ancestors (hidden lg:*) can be
    flagged downstream — see post-process pass in build_element_map().
    """
    buttons = []
    for m in re.finditer(r'<button([^>]*)>(.*?)</button>', html, re.IGNORECASE | re.DOTALL):
        raw, body = m.group(1), m.group(2)
        buttons.append({
            'tag': 'button',
            'type': attr(raw, 'type') or 'button',
            'id': attr(raw, 'id'),
            'role': attr(raw, 'role'),  # shadcn/Radix override (radio, combobox, tab, …)
            'class': attr(raw, 'class'),
            'text': text_content(body),
            # Popover/menu/select trigger signals — Base UI/shadcn wrappers stamp a
            # deterministic data-slot ("select-trigger", "dropdown-menu-trigger",
            # "popover-trigger") and aria-haspopup on the trigger <button>. Capturing
            # them lets the Step 4.5 widget-coverage gate SEE a Base UI Select /
            # column-visibility popover that renders as a plain <button> (not a native
            # <select>) — the exact blind spot that let a raw-"0" Select and a detached
            # column-toggle popover ship untested on the Conversation Lifecycle run.
            'data_slot': attr(raw, 'data-slot'),
            'aria_haspopup': attr(raw, 'aria-haspopup'),
            'aria_expanded': attr(raw, 'aria-expanded'),
            'aria_label': attr(raw, 'aria-label'),  # icon-only triggers (pagination prev/next)
            'disabled': bool(re.search(r'\bdisabled\b', raw, re.IGNORECASE)),
        })
    # Also catch <input type="submit|reset|button">
    for m in re.finditer(r'<input([^>]*)>', html, re.IGNORECASE | re.DOTALL):
        raw = m.group(1)
        t = (attr(raw, 'type') or '').lower()
        if t in ('submit', 'reset', 'button'):
            buttons.append({
                'tag': 'input',
                'type': t,
                'id': attr(raw, 'id'),
                'role': attr(raw, 'role'),
                'class': attr(raw, 'class'),
                'text': attr(raw, 'value') or t,
                'data_slot': attr(raw, 'data-slot'),
                'aria_haspopup': attr(raw, 'aria-haspopup'),
                'aria_expanded': attr(raw, 'aria-expanded'),
                'aria_label': attr(raw, 'aria-label'),
                'disabled': bool(re.search(r'\bdisabled\b', raw, re.IGNORECASE)),
            })
    return buttons


def parse_links(html: str) -> list[dict]:
    links = []
    for m in re.finditer(r'<a([^>]*)>(.*?)</a>', html, re.IGNORECASE | re.DOTALL):
        raw, body = m.group(1), m.group(2)
        href = attr(raw, 'href')
        label = text_content(body)
        if href and href not in ('#', 'javascript:void(0)', '') and label:
            links.append({'href': href, 'text': label})
    return links


def parse_labels(html: str) -> list[dict]:
    labels = []
    for m in re.finditer(r'<label([^>]*)>(.*?)</label>', html, re.IGNORECASE | re.DOTALL):
        raw, body = m.group(1), m.group(2)
        labels.append({
            'for': attr(raw, 'for'),
            'text': text_content(body),
            'required_marker': '*' in body or 'required' in body.lower(),
        })
    return labels


ERROR_WORD = re.compile(r'error|invalid|danger|alert', re.IGNORECASE)


def _utility_part(token: str) -> str:
    """Drop a Tailwind token's variant prefixes, keeping the utility it applies.

    `aria-invalid:border-destructive` -> `border-destructive`. Splitting only on a
    colon at bracket depth 0 keeps arbitrary variants (`[&_svg:not([class*=x])]:h-4`)
    in one piece.
    """
    depth, cut = 0, -1
    for i, ch in enumerate(token):
        if ch in '[(':
            depth += 1
        elif ch in '])':
            depth -= 1
        elif ch == ':' and depth == 0:
            cut = i
    return token[cut + 1:]


def _is_error_class(cls: str) -> bool:
    """True only when the element is STYLED as an error surface.

    shadcn/Tailwind stamps `aria-invalid:*` and `data-[invalid]:*` on ordinary
    buttons and inputs, so a substring test over the whole class attribute matched
    almost every control on the page (48 of 51 hits on one real capture). Only the
    utility half of a token counts — the variant half describes WHEN a style applies,
    not what the element is.
    """
    return any(ERROR_WORD.search(_utility_part(tok)) for tok in cls.split())


def parse_error_containers(html: str) -> list[dict]:
    containers = []
    patterns = [
        r'role\s*=\s*["\']alert["\']',
        r'class\s*=\s*["\'][^"\']*(?:error|invalid|danger|alert)[^"\']*["\']',
        r'aria-live\s*=\s*["\'](?:polite|assertive)["\']',
    ]
    combined = '|'.join(patterns)
    for m in re.finditer(rf'<(\w+)([^>]*(?:{combined})[^>]*)>', html, re.IGNORECASE | re.DOTALL):
        tag, raw = m.group(1), m.group(2)
        cls = attr(raw, 'class')
        role_alert = (attr(raw, 'role') or '').lower() == 'alert'
        live = (attr(raw, 'aria-live') or '').lower() in ('polite', 'assertive')
        # The regex above is a cheap pre-filter; role/aria-live stand on their own,
        # but a class-only hit has to survive the variant-prefix check.
        if not (role_alert or live or _is_error_class(cls)):
            continue
        containers.append({
            'tag': tag,
            'id': attr(raw, 'id'),
            'class': cls,
        })
    return containers


def parse_modals(html: str) -> list[dict]:
    modals = []
    for m in re.finditer(
        r'<(\w+)([^>]*(?:role\s*=\s*["\']dialog["\']|class\s*=\s*["\'][^"\']*modal[^"\']*["\'])[^>]*)>',
        html, re.IGNORECASE | re.DOTALL
    ):
        tag, raw = m.group(1), m.group(2)
        modals.append({'tag': tag, 'id': attr(raw, 'id'), 'class': attr(raw, 'class')})
    return modals


def parse_forms(html: str) -> list[dict]:
    forms = []
    for m in re.finditer(r'<form([^>]*)>', html, re.IGNORECASE | re.DOTALL):
        raw = m.group(1)
        forms.append({
            'id': attr(raw, 'id'),
            'name': attr(raw, 'name'),
            'action': attr(raw, 'action'),
            'method': attr(raw, 'method') or 'get',
        })
    return forms


def page_title(html: str) -> str:
    m = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    return text_content(m.group(1)) if m else ''


STEP_LIST_BUTTON_LABELS = ('Add step', 'Add row', 'Add item')


def parse_step_lists(html: str) -> list[dict]:
    """Detect list-of-steps sections driven by an "Add step" / "Add row" button.

    For each such button (in document order) associates it with the nearest
    preceding section label — the text of the closest earlier element whose
    tag/class marks it as a section header.

    Returns: [{ "section": "Actors", "button_index": 0, "button_label": "Add step" }, ...]

    Used by generate_scripts.py to emit `getByRole('button', {name: 'Add step'}).nth(N)`
    + `locator('xpath=../../..').locator('input').last().fill(...)` for test steps like
    "Add actor 'X' to Actors list".
    """
    step_lists: list[dict] = []
    # Find each Add-* button with its position and text.
    # Match <button ...>...<content>...</button>, capturing (attrs, inner html).
    pattern = re.compile(r'<button([^>]*)>(.*?)</button>', re.IGNORECASE | re.DOTALL)
    button_indices_by_label: dict[str, int] = {}
    for m in pattern.finditer(html):
        raw_attrs, body = m.group(1), m.group(2)
        text = text_content(body).strip()
        matched_label = next((lbl for lbl in STEP_LIST_BUTTON_LABELS if lbl.lower() in text.lower()), None)
        if not matched_label:
            continue
        # Only count exact/starts-with matches (avoid "Add step Foo Bar" buttons elsewhere).
        if not text.lower().startswith(matched_label.lower()):
            continue
        button_idx = button_indices_by_label.get(matched_label, 0)
        # Find nearest preceding section label — look in the 2000 chars before the button.
        preceding = html[max(0, m.start() - 2000):m.start()]
        section = _nearest_section_label(preceding)
        step_lists.append({
            'section': section,
            'button_index': button_idx,
            'button_label': matched_label,
        })
        button_indices_by_label[matched_label] = button_idx + 1
    return step_lists


_SECTION_HEADING_RE = re.compile(
    # Match last heading-ish element in the preceding text. We look for <legend>,
    # <h2|h3|h4>, or elements with class names that typically mark section headers
    # (data-slot="card-title", class contains "section", "label", etc.).
    r'<(?:legend|h[2-4])[^>]*>(.*?)</(?:legend|h[2-4])>'
    r'|<[^>]*(?:data-slot=["\']card-title["\']|class=["\'][^"\']*(?:section-title|card-title|field-label|form-label)[^"\']*["\'])[^>]*>(.*?)<',
    re.IGNORECASE | re.DOTALL,
)


def _nearest_section_label(preceding_html: str) -> str:
    """Return text of the last section-heading element in the preceding HTML, or '' if none."""
    last = ''
    for m in _SECTION_HEADING_RE.finditer(preceding_html):
        raw = m.group(1) or m.group(2) or ''
        txt = text_content(raw).strip()
        # Drop obvious chrome labels (e.g. "*" required markers, empty strings).
        if txt and txt not in ('*', '…'):
            last = txt
    return last


def _mark_duplicate_ids(em: dict) -> None:
    """Flag elements whose id appears more than once anywhere in the map.

    Tailwind responsive double-render (`hidden lg:grid` + `lg:hidden`) causes
    the same id to render twice in DOM — strict-mode locator('#id') then
    throws. Marking these lets generate_scripts auto-append `.first()`.
    """
    counts: dict[str, int] = {}
    pools = ('inputs', 'textareas', 'selects', 'buttons')
    for pool in pools:
        for el in em.get(pool, []) or []:
            eid = (el.get('id') or '').strip()
            if eid:
                counts[eid] = counts.get(eid, 0) + 1
    em['duplicate_ids'] = sorted([i for i, n in counts.items() if n > 1])
    for pool in pools:
        for el in em.get(pool, []) or []:
            if el.get('id') in counts and counts[el['id']] > 1:
                el['duplicate_id'] = True


def _mark_duplicate_texts(em: dict) -> None:
    """Flag buttons/links whose visible text appears more than once.

    Same root cause as `_mark_duplicate_ids` — responsive double-render
    produces two copies of the same accessible name. getByRole / getByText
    fail strict-mode without `.first()`.
    """
    counts: dict[str, int] = {}
    for el in (em.get('buttons') or []) + (em.get('links') or []):
        txt = (el.get('text') or '').strip().lower()
        if txt:
            counts[txt] = counts.get(txt, 0) + 1
    for el in (em.get('buttons') or []) + (em.get('links') or []):
        txt = (el.get('text') or '').strip().lower()
        if txt and counts.get(txt, 0) > 1:
            el['duplicate_text'] = True


def build_element_map(url: str, html: str) -> dict:
    em = {
        'source_url': url,
        'page_title': page_title(html),
        'forms': parse_forms(html),
        'inputs': parse_inputs(html),
        'textareas': parse_textareas(html),
        'selects': parse_selects(html),
        'buttons': parse_buttons(html),
        'step_lists': parse_step_lists(html),
        'labels': parse_labels(html),
        'links': parse_links(html),
        'error_containers': parse_error_containers(html),
        'modals': parse_modals(html),
    }
    _mark_duplicate_ids(em)
    _mark_duplicate_texts(em)
    return em


# ── Summary printer ──────────────────────────────────────────────────────────

def print_summary(em: dict) -> None:
    print(f"✅ Page analyzed: {em['page_title'] or em['source_url']}")
    print(f"   Forms     : {len(em['forms'])}")
    fields = em['inputs'] + em['textareas'] + em['selects']
    required = [f for f in fields if f.get('required') or f.get('aria_required')]
    print(f"   Fields    : {len(fields)}  (required: {len(required)})")
    print(f"   Buttons   : {len(em['buttons'])}")
    print(f"   Links     : {len(em['links'])}")
    print(f"   Modals    : {len(em['modals'])}")
    print(f"   Error containers: {len(em['error_containers'])}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Analyze page HTML → element map')
    parser.add_argument('--url', required=True, help='Page URL or local file path')
    parser.add_argument('--out', default='element-map.json', help='Output JSON file')
    args = parser.parse_args()

    print(f"🔍 Fetching page: {args.url}")
    html = fetch_html(args.url)
    em = build_element_map(args.url, html)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(em, f, ensure_ascii=False, indent=2)

    print_summary(em)
    print(f"\n📄 Element map saved: {out}")


if __name__ == '__main__':
    main()
