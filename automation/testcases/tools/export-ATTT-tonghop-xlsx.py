"""Xuất Excel ATTT cùng dạng Tong_hop_testcase_PhanHe_A_B_C_AUTH.xlsx (mỗi phân hệ 1 sheet; cột Kết quả mong đợi / Kết quả thực tế).
Dùng (từ automation/): python3 testcases/tools/export-ATTT-tonghop-xlsx.py → ../Tong_hop_testcase_PhanHe_ATTT.xlsx. Cần chạy export-ATTT-xlsx.py trước? Không — tự đọc results/ATTT/raw-*.json."""
import json, re, glob, collections
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

PH = collections.OrderedDict([('ATA', 'A - Quản trị hệ thống'), ('ATB', 'B - Bộ chỉ số DTI'), ('ATC', 'C - Đánh giá CĐS'),
                              ('ATE', 'E - Khảo sát hài lòng'), ('ATU', 'AUTH - Xác thực'), ('ATG', 'Chung - Hồ sơ & Hạ tầng')])
SHEET = {'ATA': 'Phân hệ A', 'ATB': 'Phân hệ B', 'ATC': 'Phân hệ C', 'ATE': 'Phân hệ E', 'ATU': 'Phân hệ AUTH', 'ATG': 'ATTT chung'}
cat = [c for c in json.load(open('testcases/docs/catalog.json')) if c['id'][:3] in PH and c['id'][3] == '-']
ANSI = re.compile(r'\x1b\[[0-9;]*m'); res = {}
def walk(s):
    for x in s.get('suites', []): yield from walk(x)
    for sp in s.get('specs', []): yield sp
for f in sorted(glob.glob('results/ATTT/raw-*.json')):
    for s in json.load(open(f)).get('suites', []):
        for sp in walk(s):
            m = re.match(r'\[([A-Z]+-[A-Z]\d+)\]', sp['title'])
            if not m: continue
            t = sp['tests'][0]; r = t['results'][-1] if t['results'] else {}
            ann = ' '.join(a.get('description', '') for a in t.get('annotations', []) + r.get('annotations', []))
            if t.get('status') == 'skipped' or r.get('status') == 'skipped': res[m.group(1)] = ('Skipped', ann)
            elif r.get('status') == 'passed': res[m.group(1)] = ('Pass', ann or 'Đúng như mong đợi')
            else:
                L = [l.strip() for l in ANSI.sub('', (r.get('error') or {}).get('message', '')).split('\n') if l.strip() and not re.match(r'^(=+|Call log|waiting)', l.strip())]
                res[m.group(1)] = ('Fail', ' | '.join(L[:3])[:400])
def status(c):
    if c['id'] in res: return res[c['id']]
    return ('Manual', c['note']) if c['auto'] != 'Auto' else ('Chưa chạy', '')
FILL = {'Pass': 'C6EFCE', 'Fail': 'FFC7CE', 'Skipped': 'D9D9D9', 'Manual': 'FFF2CC', 'Chưa chạy': 'FFFFFF'}
thin = Side(style='thin', color='BBBBBB'); bd = Border(left=thin, right=thin, top=thin, bottom=thin)
H = ['Phân hệ', 'Page', 'ID', 'UC', 'Chức năng', 'Tiêu đề', 'Loại', 'Ưu tiên', 'Automation', 'Trạng thái', 'Kết quả mong đợi', 'Kết quả thực tế']
def rows(cs):
    for c in cs:
        st, msg = status(c)
        yield [PH[c['id'][:3]], 'ATTT cấp độ 2', c['id'], c['uc'].replace('ATTT ', '', 1), c['fn'], c['title'], c['type'], c['pri'], c['auto'].split(':')[0], st, c['exp'], msg]
def sheet(ws, cs):
    ws.append(H)
    for r in rows(cs): ws.append(r); ws.cell(ws.max_row, 10).fill = PatternFill('solid', fgColor=FILL[r[9]])
    for i, w in enumerate([22, 16, 10, 16, 22, 55, 12, 11, 12, 11, 50, 55], 1): ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows():
        for x in row: x.alignment = Alignment(wrap_text=True, vertical='top'); x.border = bd
    for x in ws[1]: x.font = Font(bold=True, color='FFFFFF'); x.fill = PatternFill('solid', fgColor='1F4E78')
    ws.freeze_panes = 'D2'; ws.auto_filter.ref = ws.dimensions
wb = Workbook(); ws = wb.active; ws.title = 'Tổng hợp'
ws.append(['Phân hệ', 'Tổng', 'Pass', 'Fail', 'Manual', 'Skipped', 'Chưa chạy', 'Tỷ lệ Pass'])
for p, name in PH.items():
    k = collections.Counter(status(c)[0] for c in cat if c['id'].startswith(p + '-')); n = sum(k.values())
    ws.append([name, n, k['Pass'], k['Fail'], k['Manual'], k['Skipped'], k['Chưa chạy'], k['Pass'] / n if n else 0])
    ws.cell(ws.max_row, 8).number_format = '0.0%'
n = ws.max_row; ws.append(['TỔNG CỘNG'] + [f'=SUM({get_column_letter(i)}2:{get_column_letter(i)}{n})' for i in range(2, 8)] + [f'=IF(B{n+1}=0,0,C{n+1}/B{n+1})']); ws.cell(n + 1, 8).number_format = '0.0%'
ws.append([]); ws.append(['Ghi chú: ATTT cấp độ 2 (TT 12/2022/TT-BTTTT, TCVN 11930:2017). Fail = hệ thống chưa đáp ứng tiêu chí ATTT; Skipped = không dựng được điều kiện kiểm tra (lý do ở Kết quả thực tế); Manual = cần captcha thật, CSDL/máy chủ, hồ sơ hoặc đổi Tham số hệ thống.'])
for x in ws[1]: x.font = Font(bold=True, color='FFFFFF'); x.fill = PatternFill('solid', fgColor='1F4E78')
for x in ws[n + 1]: x.font = Font(bold=True)
ws.column_dimensions['A'].width = 30
sheet(wb.create_sheet('Tất cả'), cat)
for p in PH: sheet(wb.create_sheet(SHEET[p]), [c for c in cat if c['id'].startswith(p + '-')])
wb.save('../Tong_hop_testcase_PhanHe_ATTT.xlsx')
print({PH[p]: dict(collections.Counter(status(c)[0] for c in cat if c['id'].startswith(p + '-'))) for p in PH})
