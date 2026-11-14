#!/usr/bin/env python3
"""Đọc báo cáo JSON của Playwright, ghi kết quả theo mã testcase vào <qa>/ket-qua/<trang>.yaml, in tóm tắt.
Giữ nguyên "nguyen_nhan"/"ma_loi" đã ghi tay nếu testcase vẫn Không đạt.
Cách dùng: python3 ket-qua.py <báo-cáo.json> <thư mục qa>"""
import json, re, sys
from datetime import datetime
from pathlib import Path
from _chung import doc_yaml, ghi_yaml, rut_gon

MA = re.compile(r'\b([A-Z][A-Z0-9]{1,5}-[A-Z]{1,2}\d{1,4})\b')


def duyet(suite, file=''):
    file = suite.get('file', file)
    for sp in suite.get('specs', []):
        yield sp, file
    for s in suite.get('suites', []):
        yield from duyet(s, file)


def trang_thai(test):
    res = (test.get('results') or [{}])[-1]
    st = test.get('status')
    if st == 'skipped' or res.get('status') == 'skipped':
        mo_ta = ' '.join(a.get('description', '') or '' for a in test.get('annotations', []))
        return ('Bị chặn' if 'Bị chặn' in mo_ta else 'Bỏ qua'), mo_ta.strip(), res
    if st in ('expected', 'flaky'):
        return 'Đạt', ('Chập chờn: đạt sau khi chạy lại' if st == 'flaky' else ''), res
    loi = (res.get('error') or {}).get('message', '') or res.get('status', '')
    loi = re.sub(r'\x1b\[[0-9;]*m', '', loi).strip().splitlines()
    return 'Không đạt', (loi[0][:200] if loi else ''), res


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    bc = json.loads(Path(sys.argv[1]).read_text())
    qa = Path(sys.argv[2])
    ma_trang = {}
    tu_dong = {}
    for f in (qa / 'testcase').glob('*.yaml'):
        d = doc_yaml(f) or {}
        ma_trang[d.get('ma')] = f.stem
        tu_dong[f.stem] = {t['id'] for t in d.get('testcase') or [] if t.get('tu_dong') is True}
    moi, khong_ma = {}, []
    for s in bc.get('suites', []):
        for sp, file in duyet(s):
            m = MA.search(sp.get('title', ''))
            if not m:
                khong_ma.append(f'{file}: {sp.get("title")}')
                continue
            tid = m.group(1)
            trang = ma_trang.get(tid.split('-')[0])
            if not trang:
                khong_ma.append(f'{tid}: không có trang nào mang mã "{tid.split("-")[0]}"')
                continue
            for test in sp.get('tests', []):
                tt, chi_tiet, res = trang_thai(test)
                bang_chung = [a['path'] for a in res.get('attachments', []) if a.get('path')]
                ban_ghi = {'trang_thai': tt, 'tep': file}
                if chi_tiet:
                    ban_ghi['chi_tiet'] = chi_tiet
                if bang_chung:
                    ban_ghi['bang_chung'] = bang_chung
                cu = moi.setdefault(trang, {}).get(tid)
                if not cu or cu['trang_thai'] == 'Đạt':  # nhiều trình duyệt: giữ kết quả xấu nhất
                    moi[trang][tid] = ban_ghi
    lan = datetime.now().strftime('%Y-%m-%d %H:%M')
    tong = {}
    for trang, kq in moi.items():
        p = qa / 'ket-qua' / f'{trang}.yaml'
        cu = (doc_yaml(p) or {}).get('ket_qua') or {}
        for tid, r in kq.items():
            c = cu.get(tid, {})
            if r['trang_thai'] == 'Không đạt' and c.get('trang_thai') == 'Không đạt':
                for k in ('nguyen_nhan', 'ma_loi'):
                    if c.get(k):
                        r[k] = c[k]
            elif c.get('ma_loi'):
                r['ma_loi'] = c['ma_loi']
        cu.update(kq)
        ghi_yaml(p, {'trang': trang, 'lan_chay': lan, 'ket_qua': dict(sorted(cu.items()))})
        dem = {}
        for r in kq.values():
            dem[r['trang_thai']] = dem.get(r['trang_thai'], 0) + 1
        n = len(kq)
        print(f'[{trang}] chạy {n} | Đạt {dem.get("Đạt", 0)} | Không đạt {dem.get("Không đạt", 0)} | '
              f'Bị chặn {dem.get("Bị chặn", 0)} | Bỏ qua {dem.get("Bỏ qua", 0)} | tỉ lệ đạt {100 * dem.get("Đạt", 0) // max(n, 1)}%')
        hong = [f'{t}: {r.get("chi_tiet", "")}' + (f' [{r["nguyen_nhan"]}]' if r.get('nguyen_nhan') else '')
                for t, r in sorted(kq.items()) if r['trang_thai'] == 'Không đạt']
        for d in rut_gon(hong, 40):
            print('   ✗', d)
        chua = sorted(tu_dong.get(trang, set()) - set(cu))
        if chua:
            print(f'   Testcase tự động chưa có kết quả ({len(chua)}): {", ".join(rut_gon(chua, 30))}')
        tong[trang] = n
    if khong_ma:
        print(f'Test không gắn được mã testcase ({len(khong_ma)}):')
        for d in rut_gon(khong_ma):
            print('   -', d)
    if not tong:
        sys.exit('Không có kết quả nào gắn được mã testcase.')


if __name__ == '__main__':
    main()
