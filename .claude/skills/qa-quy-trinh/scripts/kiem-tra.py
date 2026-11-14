#!/usr/bin/env python3
"""Kiểm cấu trúc + truy vết yêu cầu → điều kiện → testcase. In tóm tắt ngắn; mã thoát 1 nếu còn lỗi/thiếu.
Cách dùng: python3 kiem-tra.py <thư mục qa> [trang]"""
import sys
from pathlib import Path
from _chung import doc_yaml, cac_trang, rut_gon

TC_BAT_BUOC = ['id', 'dieu_kien', 'tieu_de', 'loai', 'uu_tien', 'buoc', 'mong_doi', 'tu_dong']
LOAI = {'Chức năng', 'Kiểm tra nhập', 'Nghiệp vụ', 'Phân quyền', 'Bảo mật', 'Giao diện', 'Hiệu năng'}
UU_TIEN = {'Cao', 'Trung bình', 'Thấp'}


def kiem_trang(qa, trang):
    loi, thieu, mo_coi = [], [], []
    yc = doc_yaml(qa / 'yeu-cau' / f'{trang}.yaml') or {}
    tc = doc_yaml(qa / 'testcase' / f'{trang}.yaml') or {}
    ma = yc.get('ma') or tc.get('ma') or '?'
    dk, na, so_yc = {}, 0, 0
    thay = set()
    for r in yc.get('yeu_cau') or []:
        so_yc += 1
        rid = r.get('id')
        if not rid or rid in thay:
            loi.append(f'Yêu cầu thiếu mã hoặc trùng mã: {rid}')
        thay.add(rid)
        if not r.get('nguon'):
            loi.append(f'{rid}: thiếu "nguon"')
        conds = r.get('dieu_kien') or []
        if not conds:
            thieu.append(f'{rid}: chưa phân rã điều kiện — {str(r.get("noi_dung", ""))[:60]}')
        for c in conds:
            cid = c.get('id')
            if not cid or cid in dk or cid in thay:
                loi.append(f'Điều kiện thiếu mã hoặc trùng mã: {cid}')
            thay.add(cid)
            if c.get('na'):
                na += 1
            else:
                dk[cid] = c.get('mo_ta', '')
    da_phu, ids, so_tc, tu_dong = set(), set(), 0, 0
    for t in tc.get('testcase') or []:
        so_tc += 1
        tid = t.get('id', '?')
        if tid in ids:
            loi.append(f'Testcase trùng mã: {tid}')
        ids.add(tid)
        if not str(tid).startswith(ma + '-'):
            loi.append(f'{tid}: mã không bắt đầu bằng "{ma}-"')
        for k in TC_BAT_BUOC:
            if t.get(k) in (None, '', []):
                loi.append(f'{tid}: thiếu "{k}"')
        if t.get('loai') and t['loai'] not in LOAI:
            loi.append(f'{tid}: loai "{t["loai"]}" không hợp lệ')
        if t.get('uu_tien') and t['uu_tien'] not in UU_TIEN:
            loi.append(f'{tid}: uu_tien "{t["uu_tien"]}" không hợp lệ')
        if t.get('tu_dong') is True:
            tu_dong += 1
        elif t.get('tu_dong') and not str(t['tu_dong']).startswith('Thủ công:'):
            loi.append(f'{tid}: tu_dong phải là true hoặc "Thủ công: <lý do>"')
        refs = t.get('dieu_kien') or []
        if not refs:
            mo_coi.append(f'{tid}: không gắn điều kiện nào')
        for c in refs:
            if c in dk:
                da_phu.add(c)
            else:
                mo_coi.append(f'{tid}: gắn điều kiện lạ hoặc đã đánh na "{c}"')
    thieu += [f'{c}: {m}' for c, m in dk.items() if c not in da_phu]
    phu = f'{len(da_phu)}/{len(dk)}' + (f' ({100 * len(da_phu) // len(dk)}%)' if dk else '')
    print(f'[{trang}] yêu cầu {so_yc} | điều kiện {len(dk)} (+{na} na) | testcase {so_tc} (tự động {tu_dong}) | độ phủ điều kiện {phu}')
    for ten, ds in (('LỖI CẤU TRÚC', loi), ('THIẾU TESTCASE', thieu), ('MỒ CÔI / THAM CHIẾU SAI', mo_coi)):
        if ds:
            print(f'  {ten} ({len(ds)}):')
            for d in rut_gon(ds):
                print('   -', d)
    return not (loi or thieu or mo_coi)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    qa = Path(sys.argv[1])
    ds = [sys.argv[2]] if len(sys.argv) > 2 else cac_trang(qa)
    if not ds:
        sys.exit('Chưa có trang nào trong yeu-cau/ hoặc testcase/.')
    ok = all([kiem_trang(qa, t) for t in ds])
    print('KẾT LUẬN:', 'SẠCH' if ok else 'CÒN VẤN ĐỀ')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
