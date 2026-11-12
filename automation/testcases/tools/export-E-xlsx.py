"""Xuất Excel review phân hệ E: catalog testcase + kết quả chạy (results/E/raw.json)."""
import json, re, sys, collections
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
cat = [c for c in json.load(open('testcases/docs/catalog.json')) if re.match(r'^(SVY|PUB|ANS|SRT)-', c['id'])]
raw = json.load(open('results/E/raw.json'))
ANSI = re.compile(r'\x1b\[[0-9;]*m')
res = {}
def walk(s):
    for x in s.get('suites', []): yield from walk(x)
    for sp in s.get('specs', []): yield sp
for s in raw['suites']:
    for sp in walk(s):
        m = re.match(r'\[([A-Z]+-[A-Z]\d+)\]', sp['title'])
        if not m: continue
        t = sp['tests'][0]; r = t['results'][-1] if t['results'] else {}
        if t['status'] == 'skipped': st, msg = 'Skip', ' '.join(a.get('description', '') for a in t.get('annotations', []) if a.get('type') == 'skip')
        elif r.get('status') == 'passed': st, msg = 'Pass', ''
        elif r.get('status') == 'timedOut': st, msg = 'Timeout', ANSI.sub('', (r.get('error') or {}).get('message', ''))
        else: st, msg = 'Fail', ANSI.sub('', (r.get('error') or {}).get('message', ''))
        res[m.group(1)] = (st, re.sub(r'\s+', ' ', msg)[:600], sp['file'].split('/')[-1])
GRP = {'SVY-L': 'Đợt – Danh sách', 'SVY-V': 'Đợt – Chi tiết', 'SVY-S': 'Đợt – Chi tiết', 'SVY-C': 'Đợt – Tạo mới', 'SVY-E': 'Đợt – Sửa/Xóa', 'SVY-D': 'Đợt – Sửa/Xóa',
       'SVY-T': 'Đợt – Trình duyệt', 'SVY-A': 'Đợt – Trình duyệt', 'SVY-J': 'Đợt – Trình duyệt', 'SVY-Z': 'Đợt – Trình duyệt', 'PUB': 'Khảo sát công khai', 'ANS': 'Phiếu trả lời', 'SRT': 'Kết quả khảo sát'}
grp = lambda i: GRP.get(i[:5]) or GRP.get(i.split('-')[0], '')
FILL = {'Pass': 'C6EFCE', 'Fail': 'FFC7CE', 'Timeout': 'FFEB9C', 'Skip': 'D9D9D9', 'Chưa chạy': 'FFFFFF'}
thin = Side(style='thin', color='BBBBBB'); bd = Border(left=thin, right=thin, top=thin, bottom=thin)
wb = Workbook(); ws = wb.active; ws.title = 'Tổng hợp'
cnt = collections.Counter(res.get(c['id'], ('Chưa chạy',))[0] for c in cat)
ws.append(['Phân hệ E – Khảo sát mức độ hài lòng: kết quả chạy tự động (tài khoản qa.superadmin)']); ws['A1'].font = Font(bold=True, size=14)
ws.append([]); ws.append(['Tổng testcase', len(cat)])
for k in ['Pass', 'Fail', 'Timeout', 'Skip', 'Chưa chạy']: ws.append([k, cnt.get(k, 0)]); ws.cell(ws.max_row, 1).fill = PatternFill('solid', fgColor=FILL[k])
ws.append([]); ws.append(['Nhóm', 'Tổng', 'Pass', 'Fail', 'Timeout', 'Skip'])
for c in ws[ws.max_row]: c.font = Font(bold=True)
g = collections.defaultdict(collections.Counter)
for c in cat: g[grp(c['id'])][res.get(c['id'], ('Chưa chạy',))[0]] += 1
for k, v in g.items(): ws.append([k, sum(v.values()), v['Pass'], v['Fail'], v['Timeout'], v['Skip']])
ws.append([]); ws.append(['Ghi chú: Fail = lệch giữa hệ thống và SRS/testcase (cần review: lỗi hệ thống hay SRS cần cập nhật); Timeout = vướng giới hạn ~5 phiếu/phút của API công khai; Skip = lý do ghi ở cột Ghi chú/Lỗi.'])
ws.column_dimensions['A'].width = 34
d = wb.create_sheet('Chi tiết testcase')
H = ['ID', 'Nhóm', 'UC', 'Loại', 'Ưu tiên', 'Tiêu đề', 'Các bước', 'Kết quả mong đợi', 'Tác nhân', 'Tài khoản', 'Kết quả chạy', 'Lỗi thực tế / Lý do skip', 'File script', 'Ghi chú review']
d.append(H)
for c in cat:
    st, msg, f = res.get(c['id'], ('Chưa chạy', '', ''))
    d.append([c['id'], grp(c['id']), c.get('uc'), c.get('type'), c.get('pri'), c['title'], c.get('steps'), c.get('exp'), c.get('actor'), c.get('account'), st, msg, f, ''])
    d.cell(d.max_row, 11).fill = PatternFill('solid', fgColor=FILL[st])
for i, w in enumerate([11, 18, 14, 12, 10, 45, 55, 55, 18, 12, 12, 60, 28, 30], 1): d.column_dimensions[get_column_letter(i)].width = w
for row in d.iter_rows():
    for x in row: x.alignment = Alignment(wrap_text=True, vertical='top'); x.border = bd
for x in d[1]: x.font = Font(bold=True, color='FFFFFF'); x.fill = PatternFill('solid', fgColor='1F4E78')
d.freeze_panes = 'C2'; d.auto_filter.ref = d.dimensions
f = wb.create_sheet('Fail & Timeout'); f.append(['ID', 'Nhóm', 'Tiêu đề', 'Kết quả mong đợi', 'Kết quả', 'Lỗi thực tế', 'Phân loại (điền khi review)'])
for c in cat:
    st, msg, _ = res.get(c['id'], ('Chưa chạy', '', ''))
    if st in ('Fail', 'Timeout'): f.append([c['id'], grp(c['id']), c['title'], c.get('exp'), st, msg, ''])
for i, w in enumerate([11, 18, 45, 55, 10, 70, 28], 1): f.column_dimensions[get_column_letter(i)].width = w
for row in f.iter_rows():
    for x in row: x.alignment = Alignment(wrap_text=True, vertical='top'); x.border = bd
for x in f[1]: x.font = Font(bold=True, color='FFFFFF'); x.fill = PatternFill('solid', fgColor='C00000')
f.freeze_panes = 'B2'; f.auto_filter.ref = f.dimensions
out = 'Tong_hop_testcase_PhanHe_E.xlsx'; wb.save(out); print(out, dict(cnt))
