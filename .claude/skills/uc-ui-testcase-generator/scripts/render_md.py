#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
render_md.py — Render a test-case JSON file (see reference/testcase-format.md, the
same input render_xlsx.py takes) into a readable Markdown file, grouped by function
with one table per "Chuc nang". This is the human-readable twin of the .xlsx: the
.xlsx is the QA execution tracker (STATUS dropdown, conditional formatting), the .md
is a plain-text copy meant for reading/reviewing/diffing in git and the IDE — it has
no STATUS column since it is not meant to record run results.

Usage:
    python3 render_md.py --in blocks.json --out Testcase/uc1-1-dang-nhap-he-thong-test-cases.md

Input JSON shape — identical to render_xlsx.py's --in:
    {
      "group_title": "...",
      "group_subtitle": "...",
      "blocks": [{"function": "...", "items": [{"id","title","pre","steps","expected","priority"}, ...]}]
    }
"""
import argparse
import json
import os
import re
import sys

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


def id_sort_key(tc):
    """Same ordering as render_xlsx.py's id_sort_key — keep the two in sync so the
    .xlsx and .md always list test cases in the same order."""
    m = re.search(r"(\d+)([a-zA-Z]*)$", str(tc.get("id", "")))
    if not m:
        return (1, str(tc.get("id", "")), "")
    return (0, int(m.group(1)), m.group(2))


def md_cell(text):
    """Escape a field for use inside a Markdown table cell: pipes and newlines
    would otherwise break the table grid."""
    if text is None:
        text = ""
    text = str(text).replace("|", "\\|")
    return text.replace("\r\n", "\n").replace("\n", "<br>")


def render(data):
    lines = []
    group_title = data.get("group_title", "")
    group_subtitle = data.get("group_subtitle", "")
    blocks = data.get("blocks", [])

    lines.append(f"# {group_title}")
    lines.append("")
    if group_subtitle:
        lines.append(f"> {group_subtitle}")
        lines.append("")

    total = sum(len(b.get("items", [])) for b in blocks)
    lines.append(f"**Tong so test case:** {total}")
    lines.append("")
    lines.append("| STT | Chuc nang | So luong |")
    lines.append("|---|---|---|")
    for i, b in enumerate(blocks, start=1):
        lines.append(f"| {i} | {b['function']} | {len(b.get('items', []))} |")
    lines.append("")
    lines.append("---")
    lines.append("")

    for b in blocks:
        lines.append(f"## {b['function']}")
        lines.append("")
        lines.append("| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |")
        lines.append("|---|---|---|---|---|---|")
        for tc in sorted(b.get("items", []), key=id_sort_key):
            lines.append(
                "| " + " | ".join([
                    md_cell(tc.get("id", "")),
                    md_cell(tc.get("title", "")),
                    md_cell(tc.get("pre", "")),
                    md_cell(tc.get("steps", "")),
                    md_cell(tc.get("expected", "")),
                    md_cell(tc.get("priority", "")),
                ]) + " |"
            )
        lines.append("")

    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="input", required=True, help="Path to a test-case JSON file")
    ap.add_argument("--out", required=True, help="Output .md path")
    args = ap.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    content = render(data)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(content)

    total = sum(len(b.get("items", [])) for b in data.get("blocks", []))
    msg = f"Da tao {args.out} ({total} test case, {len(data.get('blocks', []))} chuc nang)"
    print(msg.encode("ascii", "backslashreplace").decode("ascii"))


if __name__ == "__main__":
    main()
