"""Xuất Excel bộ testcase ATTT cấp độ 2 (catalog-ATTT.mjs) + ma trận truy vết Mã YC × phân hệ + kết quả chạy (results/ATTT/raw-*.json).
Dùng (từ thư mục automation/): python3 testcases/tools/export-ATTT-xlsx.py   → Tong_hop_testcase_ATTT_muc2.xlsx"""
import json, re, glob, collections
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

PH = collections.OrderedDict([('ATA', 'Phân hệ A – Quản trị hệ thống'), ('ATB', 'Phân hệ B – Bộ chỉ số DTI'), ('ATC', 'Phân hệ C – Đánh giá CĐS'),
                              ('ATE', 'Phân hệ E – Khảo sát hài lòng'), ('ATU', 'AUTH – Xác thực'), ('ATG', 'ATTT chung – Hồ sơ & Hạ tầng')])
cat = [c for c in json.load(open('testcases/docs/catalog.json')) if c['id'][:3] in PH and c['id'][3] == '-']
codes = lambda c: [s.strip() for s in c['uc'].replace('ATTT ', '', 1).split(';')]

# Mã YC theo đúng thứ tự sheet (lấy từ requirements-ATTT.mjs)
src = open('testcases/docs/requirements-ATTT.mjs', encoding='utf8').read()
ROWS = [(m[0], int(m[1]), m[2], m[3]) for m in re.findall(r'\["([^"]+)", (\d+), "([^"]*)", "([^"]*)"\]', src)]

ANSI = re.compile(r'\x1b\[[0-9;]*m')
res = {}
def walk(s):
    for x in s.get('suites', []): yield from walk(x)
    for sp in s.get('specs', []): yield sp
for f in sorted(glob.glob('results/ATTT/raw-*.json')):
    raw = json.load(open(f))
    for s in raw.get('suites', []):
        for sp in walk(s):
            m = re.match(r'\[([A-Z]+-[A-Z]\d+)\]', sp['title'])
            if not m: continue
            t = sp['tests'][0]; r = t['results'][-1] if t['results'] else {}
            if t.get('status') == 'skipped' or r.get('status') == 'skipped':
                st, msg = 'Skip', ' '.join(a.get('description', '') for a in t.get('annotations', []) + r.get('annotations', []) if a.get('type') == 'skip')
            elif r.get('status') == 'passed': st, msg = 'Pass', ' '.join(a.get('description', '') for a in t.get('annotations', []) + r.get('annotations', []))
            else: st, msg = 'Fail', ANSI.sub('', (r.get('error') or {}).get('message', ''))
            res[m.group(1)] = (st, re.sub(r'\s+', ' ', msg)[:700])

FILL = {'Pass': 'C6EFCE', 'Fail': 'FFC7CE', 'Skip': 'D9D9D9', 'Manual': 'FFF2CC', 'Chưa chạy': 'FFFFFF'}
thin = Side(style='thin', color='BBBBBB'); bd = Border(left=thin, right=thin, top=thin, bottom=thin)
def status(c): return res.get(c['id'], ('Manual' if c['auto'] != 'Auto' else 'Chưa chạy', c['note'] if c['auto'] != 'Auto' else ''))
def style(ws, widths, head_color='1F4E78', freeze='B2'):
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows():
        for x in row: x.alignment = Alignment(wrap_text=True, vertical='top'); x.border = bd
    for x in ws[1]: x.font = Font(bold=True, color='FFFFFF'); x.fill = PatternFill('solid', fgColor=head_color)
    ws.freeze_panes = freeze; ws.auto_filter.ref = ws.dimensions

wb = Workbook(); ws = wb.active; ws.title = 'Tổng hợp'
ws.append(['BỘ TESTCASE AN TOÀN THÔNG TIN CẤP ĐỘ 2 – HỆ THỐNG CĐS']); ws['A1'].font = Font(bold=True, size=14)
ws.append(['Nguồn: sheet "ATTT mức 2" (Danh sách công việc_CĐS - BCT.xlsx) — TT 12/2022/TT-BTTTT PL II; TCVN 11930:2017 mục 6; QĐ 742/QĐ-BTTTT (cấp độ 2).'])
ws.append([f'Số Mã YC: {len(ROWS)} — Mã YC có testcase: {sum(1 for r in ROWS if any(r[0] in codes(c) for c in cat))} — Tổng testcase: {len(cat)}'])
ws.append([])
ws.append(['Phân hệ', 'Tổng', 'Auto', 'Manual', 'Pass', 'Fail', 'Skip', 'Chưa chạy'])
for x in ws[ws.max_row]: x.font = Font(bold=True)
for p, name in PH.items():
    s = [c for c in cat if c['id'].startswith(p + '-')]; k = collections.Counter(status(c)[0] for c in s)
    ws.append([name, len(s), sum(c['auto'] == 'Auto' for c in s), sum(c['auto'] != 'Auto' for c in s), k['Pass'], k['Fail'], k['Skip'], k['Chưa chạy']])
ws.append([])
ws.append(['Ghi chú: Fail = hệ thống chưa đáp ứng tiêu chí ATTT (đã đối chiếu thủ công từng lỗi, không phải lỗi script); Skip = không dựng được điều kiện kiểm tra (lý do ở cột Lỗi/Lý do); Manual = cần captcha thật, CSDL/máy chủ, hồ sơ, hoặc thay đổi Tham số hệ thống.'])
for i, w in enumerate([40, 10, 10, 10, 10, 10, 10, 12], 1): ws.column_dimensions[get_column_letter(i)].width = w

# Ma trận truy vết
m = wb.create_sheet('Ma trận truy vết')
m.append(['Mã YC', 'Dòng sheet', 'Nhóm – Hạng mục', 'Màn hình (sheet)'] + list(PH.values()) + ['Số testcase', 'Fail'])
for code, row, text, screen in ROWS:
    hits = [c for c in cat if code in codes(c)]
    m.append([code, row, text, screen] + [', '.join(c['id'] for c in hits if c['id'].startswith(p + '-')) for p in PH] + [len(hits), ', '.join(c['id'] for c in hits if status(c)[0] == 'Fail')])
    if any(status(c)[0] == 'Fail' for c in hits): m.cell(m.max_row, 4 + len(PH) + 2).fill = PatternFill('solid', fgColor=FILL['Fail'])
style(m, [13, 8, 40, 26] + [22] * len(PH) + [10, 24], freeze='C2')

# Chi tiết
d = wb.create_sheet('Chi tiết testcase')
H = ['ID', 'Phân hệ', 'Mã YC', 'Chức năng', 'Loại', 'Ưu tiên', 'Tiêu đề', 'Các bước', 'Kết quả mong đợi', 'Automation', 'Kết quả chạy', 'Lỗi thực tế / Lý do', 'Ghi chú']
d.append(H)
for c in cat:
    st, msg = status(c)
    d.append([c['id'], PH[c['id'][:3]], c['uc'].replace('ATTT ', '', 1), c['fn'], c['type'], c['pri'], c['title'], c['steps'], c['exp'], c['auto'].split(':')[0], st, msg, c['note']])
    d.cell(d.max_row, 11).fill = PatternFill('solid', fgColor=FILL[st])
style(d, [10, 22, 16, 18, 10, 9, 50, 50, 50, 10, 11, 60, 40], freeze='C2')

f = wb.create_sheet('Fail – cần xử lý')
f.append(['ID', 'Phân hệ', 'Mã YC', 'Tiêu đề', 'Kết quả mong đợi', 'Lỗi thực tế', 'Phân loại / phụ trách (điền khi review)'])
for c in cat:
    st, msg = status(c)
    if st == 'Fail': f.append([c['id'], PH[c['id'][:3]], c['uc'].replace('ATTT ', '', 1), c['title'], c['exp'], msg, ''])
style(f, [10, 22, 16, 50, 50, 70, 28], head_color='C00000')

out = 'Tong_hop_testcase_ATTT_muc2.xlsx'; wb.save(out)
print(out, len(cat), 'testcase;', dict(collections.Counter(status(c)[0] for c in cat)))
