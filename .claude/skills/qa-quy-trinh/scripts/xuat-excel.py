#!/usr/bin/env python3
"""Sinh Excel từ YAML: trang tính Testcase (kèm kết quả chạy) và Truy vết. Không sửa tay tệp sinh ra.
Cách dùng: python3 xuat-excel.py <thư mục qa> [trang]"""
import sys
from pathlib import Path
from _chung import doc_yaml, cac_trang

try:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
except ImportError:
    sys.exit('Thiếu thư viện: pip install pyyaml openpyxl')


def ds(v):
    if isinstance(v, list):
        return '\n'.join(f'{i}. {x}' for i, x in enumerate(v, 1))
    return '' if v is None else str(v)


def to_trang(ws, cot, rong):
    ws.append(cot)
    for i, w in enumerate(rong, 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = w
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor='305496')
    ws.freeze_panes = 'A2'


def xuat(qa, trang):
    yc = doc_yaml(qa / 'yeu-cau' / f'{trang}.yaml') or {}
    tc = doc_yaml(qa / 'testcase' / f'{trang}.yaml') or {}
    kq = (doc_yaml(qa / 'ket-qua' / f'{trang}.yaml') or {}).get('ket_qua') or {}
    dk_yc = {c['id']: r['id'] for r in yc.get('yeu_cau') or [] for c in r.get('dieu_kien') or [] if c.get('id')}
    wb = Workbook()
    ws = wb.active
    ws.title = 'Testcase'
    to_trang(ws, ['Mã TC', 'Mã yêu cầu', 'Điều kiện', 'Tiêu đề', 'Loại', 'Ưu tiên', 'Nguồn', 'Vai trò', 'Tiền điều kiện',
                  'Dữ liệu', 'Các bước', 'Kết quả mong đợi', 'Tự động', 'Ghi chú', 'Trạng thái chạy', 'Nguyên nhân', 'Mã lỗi', 'Lần chạy'],
             [12, 12, 14, 40, 14, 10, 10, 12, 25, 25, 50, 50, 14, 30, 14, 16, 12, 18])
    lan = (doc_yaml(qa / 'ket-qua' / f'{trang}.yaml') or {}).get('lan_chay', '')
    for t in tc.get('testcase') or []:
        dks = t.get('dieu_kien') or []
        r = kq.get(t.get('id'), {})
        ws.append([t.get('id'), ', '.join(sorted({dk_yc.get(c, '?') for c in dks})), ', '.join(dks), t.get('tieu_de'), t.get('loai'),
                   t.get('uu_tien'), t.get('nguon'), t.get('vai_tro'), ds(t.get('tien_dieu_kien')), ds(t.get('du_lieu')),
                   ds(t.get('buoc')), ds(t.get('mong_doi')), 'Tự động' if t.get('tu_dong') is True else ds(t.get('tu_dong')),
                   ds(t.get('ghi_chu')), r.get('trang_thai', ''), r.get('nguyen_nhan', ''), r.get('ma_loi', ''), lan if r else ''])
    ws2 = wb.create_sheet('Truy vết')
    to_trang(ws2, ['Mã yêu cầu', 'Nguồn', 'Nội dung', 'Rủi ro', 'Mã điều kiện', 'Mô tả điều kiện', 'Testcase', 'Ghi chú'],
             [12, 18, 50, 10, 14, 45, 25, 30])
    phu = {}
    for t in tc.get('testcase') or []:
        for c in t.get('dieu_kien') or []:
            phu.setdefault(c, []).append(t.get('id'))
    for r in yc.get('yeu_cau') or []:
        for c in r.get('dieu_kien') or [{}]:
            ghi = f'Không áp dụng: {c["na"]}' if c.get('na') else ('' if phu.get(c.get('id')) else 'THIẾU TESTCASE')
            ws2.append([r.get('id'), r.get('nguon'), r.get('noi_dung'), r.get('rui_ro'), c.get('id'), c.get('mo_ta'),
                        ', '.join(phu.get(c.get('id'), [])), ghi])
    for w in (ws, ws2):
        for row in w.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(wrap_text=True, vertical='top')
    out = qa / 'excel' / f'{trang}.xlsx'
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    print(f'{out}  ({ws.max_row - 1} testcase, {ws2.max_row - 1} dòng truy vết)')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    qa = Path(sys.argv[1])
    for t in ([sys.argv[2]] if len(sys.argv) > 2 else cac_trang(qa)):
        xuat(qa, t)


if __name__ == '__main__':
    main()
