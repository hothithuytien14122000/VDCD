#!/usr/bin/env python3
"""
convert_md_to_html.py — Convert a Markdown report to a styled HTML file.
The input markdown may contain inline HTML tables (from generate_report.py),
which are preserved verbatim. Bare markdown headings, lists, bold, and
horizontal rules are also converted.

Usage:
    python3 convert_md_to_html.py <input.md> --output <output.html>
"""
import argparse
import re
import sys
from pathlib import Path

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


def _escape_non_ascii(html: str) -> str:
    """Replace non-ASCII characters (emojis, special chars) with HTML entities.

    Azure DevOps comment API strips <meta charset="UTF-8"> from HTML and
    interprets content as Latin-1, corrupting multi-byte UTF-8 sequences
    (e.g. ✅ → â\x9c\x85).  Converting to numeric HTML entities (&#x2705;)
    ensures correct rendering regardless of charset interpretation.
    """
    out = []
    for ch in html:
        cp = ord(ch)
        if cp > 127:
            out.append(f"&#{cp};")
        else:
            out.append(ch)
    return "".join(out)


def md_to_html(md: str) -> str:
    """Lightweight markdown → HTML converter for report files."""
    lines = md.split("\n")
    html_lines = []
    in_pre = False

    for line in lines:
        # Preserve raw HTML blocks (tables, ul, li already in HTML)
        stripped = line.strip()

        # Code fences
        if stripped.startswith("```"):
            if not in_pre:
                html_lines.append("<pre><code>")
                in_pre = True
            else:
                html_lines.append("</code></pre>")
                in_pre = False
            continue

        if in_pre:
            html_lines.append(line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            continue

        # Raw HTML passthrough (tables, tr, td, ul, li, etc.)
        if stripped.startswith("<") and not stripped.startswith("<br"):
            html_lines.append(line)
            continue

        # Headings
        m = re.match(r"^(#{1,6})\s+(.*)", line)
        if m:
            level = len(m.group(1))
            text = _inline(m.group(2))
            html_lines.append(f"<h{level}>{text}</h{level}>")
            continue

        # Horizontal rule
        if re.match(r"^[-*_]{3,}\s*$", stripped):
            html_lines.append("<hr>")
            continue

        # Bullet list item
        m = re.match(r"^(\s*)[-*]\s+(.*)", line)
        if m:
            html_lines.append(f"<li>{_inline(m.group(2))}</li>")
            continue

        # Numbered list item
        m = re.match(r"^\d+\.\s+(.*)", line)
        if m:
            html_lines.append(f"<li>{_inline(m.group(1))}</li>")
            continue

        # Blank line → paragraph break
        if not stripped:
            html_lines.append("<br>")
            continue

        # Plain paragraph
        html_lines.append(f"<p>{_inline(line)}</p>")

    return "\n".join(html_lines)


def _inline(text: str) -> str:
    """Convert inline markdown: bold, italic, code, links."""
    # Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"__(.+?)__", r"<strong>\1</strong>", text)
    # Italic
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    # Inline code
    text = re.sub(r"`(.+?)`", r"<code>\1</code>", text)
    # Links
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', text)
    return text


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           line-height: 1.6; color: #24292e; max-width: 1200px; margin: 0 auto; padding: 24px; }}
    h1 {{ border-bottom: 2px solid #e1e4e8; padding-bottom: 8px; }}
    h2 {{ border-bottom: 1px solid #e1e4e8; padding-bottom: 4px; margin-top: 32px; }}
    table {{ border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }}
    th, td {{ border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }}
    th {{ background: #f6f8fa; font-weight: 600; }}
    tr:nth-child(even) {{ background: #fafafa; }}
    code {{ background: #f6f8fa; padding: 2px 5px; border-radius: 3px; font-size: 13px; }}
    pre {{ background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }}
    hr {{ border: 0; border-top: 1px solid #e1e4e8; margin: 24px 0; }}
    li {{ margin: 4px 0; }}
    .pass {{ color: #1a7f37; }} .fail {{ color: #cf222e; }}

    /* ── Section 3: Test Results ───────────────────────────────────────── */
    .tc-tally {{ font-size: 15px; margin: 8px 0 16px; }}
    .tc-pill {{ display: inline-block; padding: 3px 10px; border-radius: 999px;
               font-size: 13px; font-weight: 600; margin-right: 6px; }}
    .tc-pill-pass {{ background: #dafbe1; color: #1a7f37; }}
    .tc-pill-fail {{ background: #ffebe9; color: #cf222e; }}
    .tc-pill-skip {{ background: #fff8c5; color: #9a6700; }}

    /* Summary table — colored status cells */
    table.tc-summary td.tc-status-pass {{ color: #1a7f37; font-weight: 600; }}
    table.tc-summary td.tc-status-fail {{ color: #cf222e; font-weight: 600; }}
    table.tc-summary td.tc-status-skip {{ color: #9a6700; font-weight: 600; }}
    table.tc-summary td.tc-status-na   {{ color: #6e7781; }}
    table.tc-summary tr:hover {{ background: #f0f6ff; }}

    /* Detail cards */
    .tc-card {{ border: 1px solid #d0d7de; border-radius: 8px; margin: 14px 0;
               overflow: hidden; box-shadow: 0 1px 2px rgba(27,31,36,0.06);
               border-left-width: 5px; }}
    .tc-card-pass {{ border-left-color: #2da44e; }}
    .tc-card-fail {{ border-left-color: #cf222e; }}
    .tc-card-skip {{ border-left-color: #d4a72c; }}
    .tc-card-na   {{ border-left-color: #afb8c1; }}
    .tc-card-head {{ display: flex; align-items: center; gap: 10px; padding: 10px 14px;
                    background: #f6f8fa; border-bottom: 1px solid #d0d7de; flex-wrap: wrap; }}
    .tc-badge {{ padding: 3px 10px; border-radius: 6px; font-size: 13px; font-weight: 700;
                white-space: nowrap; }}
    .tc-badge-pass {{ background: #dafbe1; color: #1a7f37; }}
    .tc-badge-fail {{ background: #ffebe9; color: #cf222e; }}
    .tc-badge-skip {{ background: #fff8c5; color: #9a6700; }}
    .tc-badge-na   {{ background: #eaeef2; color: #57606a; }}
    .tc-id {{ font-weight: 700; color: #0969da; font-family: ui-monospace, SFMono-Regular, monospace; }}
    .tc-title {{ font-weight: 600; }}
    table.tc-fields {{ margin: 0; border: 0; }}
    table.tc-fields th.tc-key {{ background: #fafbfc; width: 130px; color: #57606a;
                                font-weight: 600; vertical-align: top; text-align: left;
                                white-space: nowrap; }}
    table.tc-fields td {{ vertical-align: top; }}
    table.tc-fields tr:nth-child(even) {{ background: #fff; }}
    ol.tc-steps {{ margin: 0; padding-left: 20px; }}
    ol.tc-steps li {{ margin: 3px 0; }}
    .tc-arrow {{ color: #6e7781; }}
    .tc-step-exp {{ color: #57606a; font-style: italic; }}
    ul.tc-pre {{ margin: 0; padding-left: 18px; }}
    .tc-actual-pass td {{ background: #f0fff4 !important; }}
    .tc-actual-fail td {{ background: #fff5f5 !important; }}
    .tc-ok {{ color: #1a7f37; font-weight: 600; }}
    .tc-muted {{ color: #6e7781; }}
    .tc-err {{ background: #ffebe9; color: #cf222e; display: inline-block;
              padding: 4px 8px; border-radius: 4px; white-space: pre-wrap; }}
  </style>
</head>
<body>
{body}
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="Convert markdown report to HTML")
    parser.add_argument("input", help="Input .md file")
    parser.add_argument("--output", required=True, help="Output .html file")
    args = parser.parse_args()

    src = Path(args.input)
    if not src.exists():
        print(f"❌ Input not found: {src}", file=sys.stderr)
        sys.exit(1)

    md_content = src.read_text(encoding="utf-8")
    title = re.search(r"^#\s+(.+)", md_content, re.MULTILINE)
    title_text = title.group(1).replace("📋 ", "") if title else src.stem

    body_html = md_to_html(md_content)
    full_html = HTML_TEMPLATE.format(title=title_text, body=body_html)
    # Escape non-ASCII chars to HTML entities so Azure DevOps renders correctly
    full_html = _escape_non_ascii(full_html)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(full_html, encoding="utf-8")
    print(f"✅ HTML report saved: {out}  ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
