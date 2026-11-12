#!/usr/bin/env python3
"""Sinh tài liệu HDSD (.docx) từ file Markdown rút gọn, theo bố cục tài liệu mẫu
"HDSD_App My VDCD_Dành cho nhân viên_v2.3": trang bìa → Mục lục → Lịch sử cập nhật → nội dung.

Dùng:  python3 hdsd/tools/build_docx.py hdsd/content/quan-tri-he-thong.md [-o out.docx]

Cú pháp nội dung (.md):
  ---  (front matter: title, product, subtitle, role, author, version, date, org, header)  ---
  @history                     bảng lịch sử: mỗi dòng "V1.0 | 28/10/2026 | Nội dung | Người thay đổi", kết thúc bằng dòng trống
  @include duong-dan.md        chèn file khác (đường dẫn tương đối file hiện tại)
  # / ## / ### / ####          Heading 1 (sang trang mới) / 2 / 3 / tiêu đề in đậm thường — H1–H3 tự đánh số
  {key}                        thay bằng giá trị 'key' ở front matter (vd. đường dẫn ảnh theo vai trò)
  - nội dung                   gạch đầu dòng (▪)
  1. nội dung                  bước thực hiện (các dòng liền nhau → 1 bảng bước)
     ! nội dung                ghi chú ⚠ ngay dưới bước trước đó
  ![Chú thích](anh.png){w=15}  ảnh + "Hình N. Chú thích"; 2 ảnh trên cùng 1 dòng → đặt cạnh nhau
  :::warn Lưu ý  …  :::        khung lưu ý (warn | info | tip | faq)
  | a | b |                    bảng (dòng đầu là tiêu đề)
  \\pagebreak                  ngắt trang
  -> nội dung                  đoạn căn giữa (vd. "-> **— HẾT —**")
  Định dạng trong dòng: **đậm**, *nghiêng*.
"""
import argparse, os, re, sys
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, Cm, RGBColor, Emu

FONT = 'Times New Roman'
BLUE = '1F4E79'
BLUE_TXT = RGBColor(0x1F, 0x4E, 0x79)
GRAY_TXT = RGBColor(0x59, 0x59, 0x59)
STEP_BG = 'F2F4F7'
BORDER = 'C9D3E0'
BOX = {  # nền, viền, biểu tượng, màu tiêu đề
    'warn': ('FFF8E1', 'E6A700', '⚠️', RGBColor(0x8A, 0x4B, 0x00)),
    'info': ('EAF2FB', '2E75B6', 'ℹ️', BLUE_TXT),
    'tip': ('EAF7EE', '2E8B57', '💡', RGBColor(0x1E, 0x6B, 0x3C)),
    'faq': ('F7F9FC', 'C9D3E0', '❓', BLUE_TXT),
}
TEXT_W = 16.0  # cm — bề rộng vùng chữ (A4, lề trái 3, phải 2)


# ---------- tiện ích XML ----------
def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    for s in tcPr.findall(qn('w:shd')):
        tcPr.remove(s)
    s = OxmlElement('w:shd'); s.set(qn('w:val'), 'clear'); s.set(qn('w:color'), 'auto'); s.set(qn('w:fill'), fill)
    tcPr.append(s)

def cell_borders(cell, color=BORDER, sz=4, sides=('top', 'left', 'bottom', 'right'), val='single'):
    tcPr = cell._tc.get_or_add_tcPr()
    b = tcPr.find(qn('w:tcBorders'))
    if b is None:
        b = OxmlElement('w:tcBorders'); tcPr.append(b)
    for side in sides:
        e = OxmlElement(f'w:{side}'); e.set(qn('w:val'), val); e.set(qn('w:sz'), str(sz)); e.set(qn('w:color'), color)
        b.append(e)

def table_borders(tbl, color=BORDER, sz=4, val='single'):
    tblPr = tbl._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{side}'); e.set(qn('w:val'), val); e.set(qn('w:sz'), str(sz)); e.set(qn('w:color'), color)
        b.append(e)
    tblPr.append(b)

def cell_margins(tbl, top=60, bottom=60, left=110, right=110):
    tblPr = tbl._tbl.tblPr
    m = OxmlElement('w:tblCellMar')
    for k, v in (('top', top), ('left', left), ('bottom', bottom), ('right', right)):
        e = OxmlElement(f'w:{k}'); e.set(qn('w:w'), str(v)); e.set(qn('w:type'), 'dxa'); m.append(e)
    tblPr.append(m)

def set_col_widths(tbl, widths_cm):
    tbl.autofit = False
    tblPr = tbl._tbl.tblPr
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblPr.append(lay)
    grid = tbl._tbl.tblGrid
    for i, gc in enumerate(grid.findall(qn('w:gridCol'))):
        gc.set(qn('w:w'), str(int(widths_cm[i] * 567)))
    for row in tbl.rows:
        for i, c in enumerate(row.cells):
            c.width = Cm(widths_cm[i])

def repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    e = OxmlElement('w:tblHeader'); e.set(qn('w:val'), 'true'); trPr.append(e)

def no_split(row):
    trPr = row._tr.get_or_add_trPr()
    e = OxmlElement('w:cantSplit'); e.set(qn('w:val'), 'true'); trPr.append(e)

def para_border_bottom(p, color=BLUE, sz=12, space=4):
    pPr = p._p.get_or_add_pPr()
    pb = OxmlElement('w:pBdr'); b = OxmlElement('w:bottom')
    b.set(qn('w:val'), 'single'); b.set(qn('w:sz'), str(sz)); b.set(qn('w:space'), str(space)); b.set(qn('w:color'), color)
    pb.append(b); pPr.append(pb)

def keep_next(p, on=True):
    p.paragraph_format.keep_with_next = on

def add_field(p, instr, placeholder='', size=None, color=None, italic=False):
    def r():
        run = p.add_run()
        if size: run.font.size = Pt(size)
        if color: run.font.color.rgb = color
        run.italic = italic
        return run
    r1 = r(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'begin'); r1._r.append(fc)
    r2 = r(); it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = f' {instr} '; r2._r.append(it)
    r3 = r(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'separate'); r3._r.append(fc)
    r4 = r(); r4.text = placeholder
    r5 = r(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'end'); r5._r.append(fc)

def set_run_font(run, name=FONT):
    run.font.name = name
    rPr = run._r.get_or_add_rPr()
    rf = rPr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rPr.insert(0, rf)
    for k in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        rf.set(qn(k), name)

def png_size(path):
    import struct
    with open(path, 'rb') as f:
        head = f.read(24)
    return struct.unpack('>II', head[16:24])

INLINE = re.compile(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)')
def add_inline(p, text, size=None, color=None, bold=None, italic=None):
    for part in INLINE.split(text):
        if not part:
            continue
        b, i, t = bold, italic, part
        if part.startswith('**') and part.endswith('**'):
            b, t = True, part[2:-2]
        elif part.startswith('`') and part.endswith('`'):
            t = part[1:-1]
        elif part.startswith('*') and part.endswith('*') and len(part) > 2:
            i, t = True, part[1:-1]
        run = p.add_run(t)
        if b is not None: run.bold = b
        if i is not None: run.italic = i
        if size: run.font.size = Pt(size)
        if color is not None: run.font.color.rgb = color
    return p


class Builder:
    def __init__(self, meta, base_dir):
        self.meta, self.base = meta, base_dir
        self.doc = Document()
        self.fig = 0
        self._styles()
        self._section()

    # ---------- định dạng chung ----------
    def _styles(self):
        st = self.doc.styles
        n = st['Normal']
        n.font.name = FONT; n.font.size = Pt(13)
        rpr = n.element.get_or_add_rPr()
        rf = rpr.find(qn('w:rFonts'))
        if rf is None:
            rf = OxmlElement('w:rFonts'); rpr.insert(0, rf)
        for k in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
            rf.set(qn(k), FONT)
        n.paragraph_format.space_after = Pt(6); n.paragraph_format.line_spacing = 1.15
        for lvl, size, before, after in ((1, 15, 6, 10), (2, 13.5, 12, 6), (3, 13, 10, 4)):
            h = st[f'Heading {lvl}']
            h.font.name = FONT; h.font.size = Pt(size); h.font.bold = True; h.font.italic = False
            h.font.color.rgb = BLUE_TXT
            hr = h.element.get_or_add_rPr()
            rf = hr.find(qn('w:rFonts'))
            if rf is None:
                rf = OxmlElement('w:rFonts'); hr.insert(0, rf)
            for k in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
                rf.set(qn(k), FONT)
            for k in ('w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme'):
                if rf.get(qn(k)) is not None:
                    del rf.attrib[qn(k)]
            h.paragraph_format.space_before = Pt(before); h.paragraph_format.space_after = Pt(after)
            h.paragraph_format.keep_with_next = True
        for i in (1, 2, 3):
            s = st[f'TOC {i}'] if f'TOC {i}' in [x.name for x in st] else st.add_style(f'TOC {i}', 1)
            s.base_style = n; s.font.size = Pt(12)
            s.paragraph_format.left_indent = Cm(0.6 * (i - 1)); s.paragraph_format.space_after = Pt(2)
            if i == 1: s.font.bold = True
        cap = st['Caption']
        cap.font.name = FONT; cap.font.size = Pt(11); cap.font.italic = True; cap.font.bold = False
        cap.font.color.rgb = GRAY_TXT
        cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.space_before = Pt(2); cap.paragraph_format.space_after = Pt(10)
        # Word tự cập nhật Mục lục & số trang khi mở tệp
        settings = self.doc.settings.element
        uf = OxmlElement('w:updateFields'); uf.set(qn('w:val'), 'true'); settings.append(uf)

    def _section(self):
        s = self.doc.sections[0]
        s.page_height, s.page_width = Cm(29.7), Cm(21.0)
        s.top_margin, s.bottom_margin, s.left_margin, s.right_margin = Cm(2), Cm(2), Cm(3), Cm(2)
        s.header_distance = s.footer_distance = Cm(1)
        hp = s.header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        add_inline(hp, self.meta.get('header', ''), size=10, color=GRAY_TXT, italic=True)
        para_border_bottom(hp, color='BFBFBF', sz=4, space=1)
        fp = s.footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = fp.add_run('Trang '); r.font.size = Pt(10); r.font.color.rgb = GRAY_TXT
        add_field(fp, 'PAGE', '1', 10, GRAY_TXT)
        r = fp.add_run(' / '); r.font.size = Pt(10); r.font.color.rgb = GRAY_TXT
        add_field(fp, 'NUMPAGES', '1', 10, GRAY_TXT)

    def page_break(self):
        self.doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------- trang bìa / mục lục / lịch sử ----------
    def cover(self):
        m, d = self.meta, self.doc
        for _ in range(2): d.add_paragraph()
        logo = m.get('logo')
        if logo and os.path.exists(os.path.join(self.base, logo)):
            p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.add_run().add_picture(os.path.join(self.base, logo), width=Cm(3.2))
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_inline(p, m.get('org_top', '').upper(), size=13, bold=True, color=GRAY_TXT)
        d.add_paragraph()
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_inline(p, m.get('title', 'HƯỚNG DẪN SỬ DỤNG'), size=17, bold=True)
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_inline(p, m.get('product', ''), size=21, bold=True, color=BLUE_TXT)
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_inline(p, m.get('subtitle', ''), size=13, italic=True, color=GRAY_TXT)
        para_border_bottom(p, sz=18, space=14)
        d.add_paragraph()
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_inline(p, m.get('role', ''), size=15, bold=True)
        d.add_paragraph()
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(2)
        add_inline(p, f"Người biên soạn: **{m.get('author', '')}**", size=12)
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(2)
        add_inline(p, f"Phiên bản {m.get('version', '1.0')} — Ngày: {m.get('date', '')}", size=12)
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_inline(p, m.get('org', ''), size=12, italic=True, color=GRAY_TXT)
        self.page_break()

    def toc(self, headings):
        p = self.doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_inline(p, 'MỤC LỤC', size=15, bold=True, color=BLUE_TXT)
        # Trường TOC: Word sẽ điền số trang khi mở (updateFields). Nội dung tạm = danh sách đề mục.
        p = self.doc.add_paragraph(style='TOC 1')
        r = p.add_run(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'begin'); r._r.append(fc)
        r = p.add_run(); it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = ' TOC \\o "1-3" \\h \\z \\u '; r._r.append(it)
        r = p.add_run(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'separate'); r._r.append(fc)
        first = True
        for lvl, text in headings:
            q = p if first else self.doc.add_paragraph(style=f'TOC {lvl}')
            q.add_run(text); first = False
        r = q.add_run(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'end'); r._r.append(fc)
        self.page_break()

    def history(self, rows):
        p = self.doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_inline(p, 'LỊCH SỬ CẬP NHẬT', size=15, bold=True, color=BLUE_TXT)
        self.table([['Phiên bản', 'Ngày thay đổi', 'Nội dung thay đổi', 'Người thay đổi']] + rows,
                   widths=[2.2, 2.8, 7.0, 4.0], center_cols=(0, 1))
        self.page_break()

    # ---------- khối nội dung ----------
    def heading(self, lvl, text):
        if lvl == 1:
            self.page_break()
        if lvl == 4:
            p = self.doc.add_paragraph(); keep_next(p)
            p.paragraph_format.space_before = Pt(6)
            add_inline(p, text, bold=True)
            return
        self.doc.add_heading(text, lvl)

    def para(self, text):
        p = self.doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        if text.startswith('->'):   # đoạn căn giữa
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER; text = text[2:].strip()
        add_inline(p, text)
        if text.rstrip().endswith(':'):
            keep_next(p)

    def bullets(self, items):
        for lvl, t in items:
            p = self.doc.add_paragraph()
            pf = p.paragraph_format
            pf.left_indent = Cm(0.9 + 0.7 * lvl); pf.first_line_indent = Cm(-0.5); pf.space_after = Pt(3)
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            r = p.add_run(('▪' if lvl == 0 else '–') + '\t'); r.font.color.rgb = BLUE_TXT
            pf.tab_stops.add_tab_stop(Cm(0.9 + 0.7 * lvl))
            add_inline(p, t)

    def steps(self, items):
        """items: [(số, text, [ghi chú])]"""
        tbl = self.doc.add_table(rows=0, cols=2)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell_margins(tbl, 70, 70, 120, 120)
        for num, text, notes in items:
            row = tbl.add_row(); no_split(row)
            a, b = row.cells
            shade(a, BLUE); shade(b, STEP_BG)
            cell_borders(a, 'FFFFFF', 8, ('bottom',)); cell_borders(b, 'FFFFFF', 8, ('bottom',))
            a.vertical_alignment = b.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            pa = a.paragraphs[0]; pa.alignment = WD_ALIGN_PARAGRAPH.CENTER; pa.paragraph_format.space_after = Pt(0)
            r = pa.add_run(str(num)); r.bold = True; r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            pb = b.paragraphs[0]; pb.paragraph_format.space_after = Pt(0)
            add_inline(pb, text)
            for n in notes:
                q = b.add_paragraph(); q.paragraph_format.space_before = Pt(3); q.paragraph_format.space_after = Pt(0)
                r = q.add_run('⚠  '); r.font.color.rgb = RGBColor(0xC0, 0x7A, 0x00)
                add_inline(q, n, size=12, italic=True, color=RGBColor(0x6B, 0x4A, 0x00))
        set_col_widths(tbl, [1.1, TEXT_W - 1.1])
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    def image_path(self, src):
        path = os.path.normpath(os.path.join(self.base, src))
        if not os.path.exists(path):
            print(f'  ! thiếu ảnh: {src}', file=sys.stderr)
            return None
        return path

    def _caption(self, container, text):
        self.fig += 1
        p = container.add_paragraph(style='Caption')
        add_inline(p, f'Hình {self.fig}. {text}')
        return p

    def image(self, cap, src, w=None):
        path = self.image_path(src)
        if not path:
            return
        iw, ih = png_size(path)
        width = float(w) if w else TEXT_W
        # ảnh dọc/cao: giới hạn chiều cao ~ 19cm
        if ih / iw * width > 19:
            width = 19 * iw / ih
        p = self.doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; keep_next(p)
        p.paragraph_format.space_before = Pt(6); p.paragraph_format.space_after = Pt(0)
        p.add_run().add_picture(path, width=Cm(width))
        self._caption(self.doc, cap)

    def image_row(self, imgs):
        tbl = self.doc.add_table(rows=1, cols=len(imgs)); tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(tbl, 'FFFFFF', 0, 'nil')
        colw = TEXT_W / len(imgs)
        for c, (cap, src, w) in zip(tbl.rows[0].cells, imgs):
            path = self.image_path(src)
            p = c.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER; keep_next(p)
            if path:
                iw, ih = png_size(path)
                width = min(float(w), colw - 0.4) if w else colw - 0.4   # không vượt bề rộng ô (tránh bị cắt)
                if ih / iw * width > 12:
                    width = 12 * iw / ih
                p.add_run().add_picture(path, width=Cm(width))
            self._caption(c, cap)
        set_col_widths(tbl, [colw] * len(imgs))
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    def box(self, kind, title, lines):
        bg, bd, icon, tcolor = BOX.get(kind, BOX['warn'])
        tbl = self.doc.add_table(rows=1, cols=1); tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell_margins(tbl, 90, 90, 160, 160)
        c = tbl.rows[0].cells[0]; shade(c, bg)
        cell_borders(c, bd, 8, ('top', 'bottom', 'right')); cell_borders(c, bd, 24, ('left',))
        p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(3)
        if title:
            add_inline(p, f'{icon}  {title}', bold=True, color=tcolor)
        first = not title
        for ln in lines:
            q = p if first else c.add_paragraph(); first = False
            q.paragraph_format.space_after = Pt(2); q.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            m = re.match(r'^(\s*)- (.*)', ln)
            if m:
                lvl = min(len(m.group(1)) // 2, 2)   # thụt 2 dấu cách = cấp con
                q.paragraph_format.left_indent = Cm(0.5 + 0.6 * lvl); q.paragraph_format.first_line_indent = Cm(-0.4)
                add_inline(q, ('▪  ' if lvl == 0 else '–  ') + m.group(2), size=12)
            else:
                add_inline(q, ln, size=12)
        set_col_widths(tbl, [TEXT_W])
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    def table(self, rows, widths=None, center_cols=()):
        ncol = max(len(r) for r in rows)
        tbl = self.doc.add_table(rows=0, cols=ncol); tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(tbl, BORDER, 4); cell_margins(tbl)
        for i, r in enumerate(rows):
            row = tbl.add_row(); no_split(row)
            if i == 0: repeat_header(row)
            for j in range(ncol):
                c = row.cells[j]; t = r[j] if j < len(r) else ''
                c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
                p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(0)
                for k, line in enumerate(t.split('<br>')):
                    q = p if k == 0 else c.add_paragraph()
                    q.paragraph_format.space_after = Pt(0)
                    if i == 0:
                        shade(c, BLUE); q.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        add_inline(q, line, size=12, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
                    else:
                        if j in center_cols: q.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        add_inline(q, line, size=12)
        if not widths:
            lens = [max(len(re.sub(r'\*', '', r[j])) if j < len(r) else 0 for r in rows) for j in range(ncol)]
            lens = [min(max(l, 6), 60) for l in lens]
            widths = [TEXT_W * l / sum(lens) for l in lens]
        set_col_widths(tbl, widths)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)


# ---------- đọc file .md ----------
def read_lines(path, seen=None):
    seen = seen or set()
    path = os.path.abspath(path)
    if path in seen:
        return []
    seen.add(path)
    out = []
    with open(path, encoding='utf-8') as f:
        for ln in f.read().splitlines():
            m = re.match(r'^@include\s+(.+)$', ln.strip())
            if m:
                out += read_lines(os.path.join(os.path.dirname(path), m.group(1).strip()), seen)
            else:
                out.append(ln)
    return out

IMG = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)(?:\{w=([\d.]+)\})?')

def parse(lines):
    meta, blocks, i = {}, [], 0
    first_in_section, shift = [None], [0]
    if lines and lines[0].strip() == '---':
        i = 1
        while i < len(lines) and lines[i].strip() != '---':
            k, _, v = lines[i].partition(':'); meta[k.strip()] = v.strip(); i += 1
        i += 1
    while i < len(lines):
        ln = lines[i]; s = ln.strip()
        if not s or s.startswith('<!--'):
            if s.startswith('<!--'):
                while i < len(lines) and '-->' not in lines[i]: i += 1
            i += 1; continue
        if s == '@history':
            rows = []; i += 1
            while i < len(lines) and lines[i].strip():
                rows.append([x.strip() for x in lines[i].split('|')]); i += 1
            blocks.append(('history', rows)); continue
        if s in ('\\pagebreak', '@pagebreak'):
            blocks.append(('pagebreak',)); i += 1; continue
        m = re.match(r'^(#{1,4})\s+(.*)', s)
        if m:
            first_in_section[0] = None; shift[0] = 0
            blocks.append(('h', len(m.group(1)), m.group(2).strip())); i += 1; continue
        m = re.match(r'^:::(\w+)\s*(.*)', s)
        if m:
            kind, title, body = m.group(1), m.group(2).strip(), []; i += 1
            while i < len(lines) and lines[i].strip() != ':::':
                if lines[i].strip(): body.append(lines[i].rstrip())
                i += 1
            blocks.append(('box', kind, title, body)); i += 1; continue
        if IMG.match(s):
            imgs = IMG.findall(s)
            blocks.append(('img', [(c, p, w) for c, p, w in imgs])); i += 1; continue
        if s.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                r = lines[i].strip().strip('|')
                if not re.match(r'^[\s:|-]+$', r):
                    rows.append([x.strip() for x in r.split('|')])
                i += 1
            blocks.append(('table', rows)); continue
        if re.match(r'^\d+[.)]\s', s):
            items = []
            while i < len(lines):
                t = lines[i]
                m = re.match(r'^\s*(\d+)[.)]\s+(.*)', t)
                if m:
                    items.append([m.group(1), m.group(2).strip(), []]); i += 1; continue
                m = re.match(r'^\s+!\s*(.*)', t)
                if m and items:
                    items[-1][2].append(m.group(1).strip()); i += 1; continue
                break
            # Mỗi chương/mục đánh số bước từ 1: nếu mục chưa có bước nào mà danh sách mở đầu bằng số > 1 thì dịch số xuống (và áp dụng cho các danh sách tiếp theo trong mục)
            if first_in_section[0] is None:
                first_in_section[0] = int(items[0][0])
                shift[0] = first_in_section[0] - 1
            if shift[0]:
                for it in items: it[0] = str(max(1, int(it[0]) - shift[0]))
            blocks.append(('steps', items)); continue
        if re.match(r'^\s*[-*]\s', ln):
            items = []
            while i < len(lines) and re.match(r'^\s*[-*]\s', lines[i]):
                lvl = (len(lines[i]) - len(lines[i].lstrip())) // 2
                items.append((min(lvl, 2), lines[i].strip()[2:].strip())); i += 1
            blocks.append(('bullets', items)); continue
        if s.startswith('->'):   # đoạn căn giữa: luôn đứng riêng 1 dòng
            blocks.append(('p', s)); i += 1; continue
        # đoạn văn: gộp các dòng liền nhau
        buf = [s]; i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#|:::|!\[|\||\d+[.)]\s|[-*]\s|@|\\pagebreak|->)', lines[i].strip()):
            buf.append(lines[i].strip()); i += 1
        blocks.append(('p', ' '.join(buf)))
    return meta, blocks


def number_headings(blocks):
    """Tự đánh số H1–H3 (1. / 1.1. / 1.1.1.) — trong .md viết đề mục KHÔNG kèm số."""
    cnt = [0, 0, 0]
    out = []
    for blk in blocks:
        if blk[0] == 'h' and blk[1] <= 3:
            lvl = blk[1]
            cnt[lvl - 1] += 1
            for k in range(lvl, 3): cnt[k] = 0
            text = re.sub(r'^\d+(\.\d+)*\.?\s+', '', blk[2])
            blk = ('h', lvl, '.'.join(str(c) for c in cnt[:lvl]) + '. ' + text)
        out.append(blk)
    return out


def build(src, out):
    lines = read_lines(src)
    meta, _ = parse(lines)
    key = meta.get('key', '')
    lines = [ln.replace('{key}', key) for ln in lines]   # ảnh theo vai trò: img/{key}/...
    meta, blocks = parse(lines)
    blocks = number_headings(blocks)
    b = Builder(meta, os.path.dirname(os.path.abspath(src)))
    b.cover()
    b.toc([(blk[1], blk[2]) for blk in blocks if blk[0] == 'h' and blk[1] <= 3])
    for blk in blocks:
        if blk[0] == 'history':
            b.history(blk[1])
    first_h1 = True
    for blk in blocks:
        k = blk[0]
        if k == 'h':
            if blk[1] == 1 and first_h1:
                first_h1 = False
                b.doc.add_heading(blk[2], 1)  # trang đầu nội dung: không ngắt trang thêm
            else:
                b.heading(blk[1], blk[2])
        elif k == 'p': b.para(blk[1])
        elif k == 'bullets': b.bullets(blk[1])
        elif k == 'steps': b.steps(blk[1])
        elif k == 'box': b.box(blk[1], blk[2], blk[3])
        elif k == 'table': b.table(blk[1])
        elif k == 'pagebreak': b.page_break()
        elif k == 'img':
            imgs = blk[1]
            if len(imgs) == 1: b.image(*imgs[0])
            else: b.image_row(imgs)
    b.doc.core_properties.title = f"{meta.get('title', '')} {meta.get('product', '')} – {meta.get('role', '')}".strip()
    b.doc.core_properties.author = meta.get('author', '')
    b.doc.save(out)
    print(f'✓ {out}  ({b.fig} hình)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='+')
    ap.add_argument('-o', '--out')
    a = ap.parse_args()
    for s in a.src:
        out = a.out if a.out and len(a.src) == 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(s))), 'out',
                                                                  os.path.splitext(os.path.basename(s))[0] + '.docx')
        build(s, out)
