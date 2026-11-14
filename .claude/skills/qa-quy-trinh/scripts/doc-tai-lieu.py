#!/usr/bin/env python3
"""Chuyển tài liệu (.docx/.xlsx/.pdf/.md/.txt) sang văn bản trong <qa>/nguon/ để tìm bằng grep.
Cách dùng: python3 doc-tai-lieu.py <thư mục qa> <tệp hoặc thư mục>..."""
import re, subprocess, sys, zipfile
from pathlib import Path

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def docx(p):
    import xml.etree.ElementTree as ET
    root = ET.fromstring(zipfile.ZipFile(p).read('word/document.xml'))
    out = []

    def para(el):
        return ''.join(t.text or '' for t in el.iter(W + 't')).strip()

    for el in root.find(W + 'body'):
        if el.tag == W + 'p':
            s = para(el)
            if s:
                st = el.find(f'{W}pPr/{W}pStyle')
                lv = re.search(r'(\d)', st.get(W + 'val', '')) if st is not None and 'eading' in st.get(W + 'val', '') else None
                out.append(('#' * int(lv.group(1)) + ' ' if lv else '') + s)
        elif el.tag == W + 'tbl':
            for tr in el.iter(W + 'tr'):
                cells = [' '.join(para(p) for p in tc.iter(W + 'p')).strip() for tc in tr.iter(W + 'tc')]
                if any(cells):
                    out.append('| ' + ' | '.join(cells) + ' |')
    return '\n'.join(out)


def xlsx(p):
    from openpyxl import load_workbook
    out = []
    for ws in load_workbook(p, read_only=True, data_only=True).worksheets:
        out.append(f'## Trang tính: {ws.title}')
        for i, row in enumerate(ws.iter_rows(values_only=True), 1):
            cells = ['' if v is None else str(v).replace('\n', ' / ') for v in row]
            while cells and not cells[-1]:
                cells.pop()
            if cells:
                out.append(f'[dòng {i}] ' + ' | '.join(cells))
    return '\n'.join(out)


def pdf(p):
    try:
        return subprocess.run(['pdftotext', '-layout', str(p), '-'], capture_output=True, text=True, check=True).stdout
    except (FileNotFoundError, subprocess.CalledProcessError):
        sys.exit(f'Không đọc được PDF {p}: cần cài pdftotext (poppler-utils).')


DOC = {'.docx': docx, '.xlsx': xlsx, '.xlsm': xlsx, '.pdf': pdf, '.md': lambda p: p.read_text(), '.txt': lambda p: p.read_text()}


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    dst = Path(sys.argv[1]) / 'nguon'
    dst.mkdir(parents=True, exist_ok=True)
    files = []
    for a in sys.argv[2:]:
        a = Path(a)
        files += sorted(f for f in a.rglob('*') if f.suffix.lower() in DOC) if a.is_dir() else [a]
    for f in files:
        if f.name.startswith('~$'):
            continue
        text = DOC[f.suffix.lower()](f)
        out = dst / (re.sub(r'[^\w.-]+', '-', f.stem).strip('-') + '.txt')
        out.write_text(text)
        print(f'{out}  ({text.count(chr(10)) + 1} dòng)')


if __name__ == '__main__':
    main()
