# -*- coding: utf-8 -*-
"""
Du lieu test case UI cho man hinh "Quan ly tu danh gia"
(Bo chi so DTI > Quan ly tu danh gia) - He thong Danh gia CDS, Bo Dan toc va Ton giao.

URL: https://cds.geneat.pro/#/vi/self-assessment-campaigns
Nguon nghiep vu: UC_1409_Requirement.md - nhom B.III (UC-B.III.1, UC-B.III.2, UC-B.III.3, UC-B.III.5)
Nguon UI: khao sat truc tiep bang Playwright (qa.superadmin@cds.local) ngay 2026-10-06.

Quy uoc noi dung: khong dau (giong file mau testcases_export.xlsx) de dam bao hien thi dong nhat.
Cac gia tri chua quan sat truc tiep duoc tren UI (vi du trang thai trung gian khi trinh phe duyet)
duoc danh dau "CAN XAC NHAN" trong noi dung, giong quy uoc da dung trong testcases_export.xlsx.
"""

GROUP_TITLE = "QUAN LY TU DANH GIA - BO DAN TOC VA TON GIAO"
GROUP_SUBTITLE = (
    "Nguon: UC_1409_Requirement.md (UC-B.III.1, B.III.2, B.III.3, B.III.5) + khao sat UI thuc te "
    "qua Playwright  |  URL: https://cds.geneat.pro/#/vi/self-assessment-campaigns"
)

# Moi block = 1 "Chuc nang" (tuong duong 1 Endpoint trong file mau Survey), co banner rieng.
BLOCKS = [
    {
        "function": "Danh sach & tim kiem tu danh gia (tab Dinh ky / Dot xuat, tim kiem, phan trang, xuat Excel)",
        "items": [
            dict(
                id="TC_TDG_001",
                title="Mo man hinh Quan ly tu danh gia - hien thi danh sach mac dinh",
                pre="- Da dang nhap he thong voi tai khoan co quyen Quan tri he thong / Can bo\n"
                    "- He thong da co san du lieu tu danh gia",
                steps="1. Dang nhap he thong\n"
                      "2. Vao menu Bo chi so DTI > Quan ly tu danh giá",
                expected="- Hien thi trang 'Quan ly tu danh gia' voi tieu de va mo ta 'Thiet lap ky danh gia dinh ky va dot xuat'\n"
                         "- Tab 'Dinh ky' duoc chon mac dinh\n"
                         "- Bang danh sach hien du cac cot: STT, Ten danh gia, Bo chi so, Loai, Trang thai, Thao tac\n"
                         "- Phan trang mac dinh 10/trang, hien thi dung so trang theo tong so ban ghi",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_002",
                title="Chuyen tab Dinh ky -> Dot xuat",
                pre="- Dang o man hinh Quan ly tu danh gia, tab Dinh ky",
                steps="1. Nhan tab 'Dot xuat'",
                expected="- Danh sach duoc tai lai, chi hien thi cac ban ghi tu danh gia co Loai = Dot xuat\n"
                         "- Cot 'Loai' cua tat ca ban ghi hien thi = Dot xuat\n"
                         "- Neu khong co ban ghi dot xuat nao, hien thi trang thai rong (empty state), khong bao loi",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_003",
                title="Chuyen tab Dot xuat -> Dinh ky (quay lai)",
                pre="- Dang o tab Dot xuat",
                steps="1. Nhan tab 'Dinh ky'",
                expected="- Danh sach quay lai hien thi cac ban ghi Loai = Dinh ky\n"
                         "- Vi tri trang (page) duoc reset ve trang 1",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_004",
                title="Tim kiem theo ten danh gia - tu khoa hop le, co ket qua",
                pre="- Co it nhat 1 ban ghi voi ten da biet, vi du 'Co cau to chuc'",
                steps="1. Nhap 'Co cau' vao o tim kiem 'Tim kiem ten danh gia'\n"
                      "2. Doi he thong tim kiem (debounce/enter)",
                expected="- Danh sach chi con cac ban ghi co ten chua chuoi 'Co cau' (khong phan biet hoa/thuong)\n"
                         "- So trang/phan trang duoc cap nhat lai theo ket qua loc",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_005",
                title="Tim kiem theo ten danh gia - tu khoa khong ton tai",
                pre="- Dang o man hinh danh sach",
                steps="1. Nhap tu khoa khong ton tai, vi du 'zzz_khong_ton_tai_123'\n"
                      "2. Doi he thong tim kiem",
                expected="- Danh sach hien thi rong (empty state), khong bao loi he thong\n"
                         "- Khong con phan trang hoac phan trang hien 0 ket qua",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_006",
                title="[Edge case] Tim kiem voi ky tu dac biet / script injection",
                pre="- Dang o man hinh danh sach",
                steps="1. Nhap vao o tim kiem cac chuoi: <script>alert(1)</script> ; ' OR '1'='1 ; %%%; emoji (abc)\n"
                      "2. Quan sat ket qua va giao dien",
                expected="- He thong khong thuc thi script (khong xuat hien alert), khong loi 500/crash\n"
                         "- Chuoi dac biet duoc hien thi/escape an toan neu co hien lai tren UI\n"
                         "- Ket qua tra ve danh sach rong hoac khong khop, khong lam sap giao dien",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_007",
                title="[Edge case] Tim kiem voi khoang trang / xoa tu khoa ve rong",
                pre="- Da nhap mot tu khoa tim kiem truoc do",
                steps="1. Nhap chi dau cach (space) vao o tim kiem\n"
                      "2. Xoa toan bo tu khoa, de o tim kiem rong",
                expected="- Nhap chi khoang trang: he thong tu dong trim, tra ve danh sach day du (khong loc) hoac rong tuy quy uoc - CAN XAC NHAN quy uoc thuc te\n"
                         "- Xoa het tu khoa: danh sach quay lai hien thi day du nhu ban dau (khong con loc)",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_008",
                title="Chuyen trang danh sach (phan trang)",
                pre="- Danh sach co nhieu hon 1 trang (vi du 2 trang voi 10/trang)",
                steps="1. Nhan nut chuyen trang 'Trang Ke' (hoac so trang '2')\n"
                      "2. Quan sat du lieu trang 2\n"
                      "3. Nhan 'Trang Truoc' de quay lai trang 1",
                expected="- Du lieu trang 2 khac trang 1, khong trung lap STT/ten\n"
                         "- STT duoc danh so tiep tuc hoac theo quy uoc cua he thong - CAN XAC NHAN\n"
                         "- Quay lai trang 1 hien dung du lieu ban dau",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_009",
                title="Thay doi so ban ghi tren mot trang (10/trang)",
                pre="- Danh sach co nhieu hon 10 ban ghi",
                steps="1. Mo dropdown '10 / trang'\n"
                      "2. Chon gia tri khac (vi du 20/trang hoac 50/trang neu co)",
                expected="- Danh sach hien thi lai voi so dong toi da bang gia tri da chon\n"
                         "- Tong so trang duoc tinh lai tuong ung",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_010",
                title="Xuat Excel danh sach tu danh gia - khong loc",
                pre="- Dang o tab Dinh ky, khong ap dung bo loc nao",
                steps="1. Nhan nut 'Xuat Excel'",
                expected="- He thong tra ve file Excel (.xlsx) tai ve thanh cong\n"
                         "- Noi dung file khop voi danh sach dang hien thi tren man hinh (hoac toan bo du lieu theo bo loc hien tai - CAN XAC NHAN pham vi xuat: trang hien tai hay toan bo)\n"
                         "- Khong co loi/timeout khi xuat",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_011",
                title="Xuat Excel sau khi da tim kiem/loc theo tab Dot xuat",
                pre="- Da chuyen tab Dot xuat va/hoac da nhap tu khoa tim kiem",
                steps="1. Ap dung bo loc (tab Dot xuat va/hoac tu khoa)\n"
                      "2. Nhan 'Xuat Excel'",
                expected="- File Excel xuat ra chi chua du lieu da duoc loc theo tab/tu khoa dang ap dung, khong lan du lieu cua tab khac",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_012",
                title="[Edge case] Xuat Excel khi danh sach rong",
                pre="- Dang ap dung bo loc khien danh sach khong co ban ghi nao",
                steps="1. Nhan nut 'Xuat Excel' khi bang dang rong",
                expected="- He thong khong bao loi/crash\n"
                         "- Tra ve file Excel chi co phan tieu de/header, khong co dong du lieu, hoac thong bao 'khong co du lieu de xuat' - CAN XAC NHAN hanh vi cu the",
                priority="Thap",
            ),
        ],
    },
    {
        "function": "Them moi tu danh gia (UC-B.III.1)",
        "items": [
            dict(
                id="TC_TDG_013",
                title="Mo form Them moi tu danh gia",
                pre="- Dang o man hinh danh sach Quan ly tu danh gia",
                steps="1. Nhan nut 'Them moi' (goc tren ben phai)",
                expected="- Hien thi modal 'Them moi' voi cac truong: Phan loai danh gia*, Danh gia* (chon Bo chi so),"
                         " Ten*, Ngay bat dau*, Ngay ket thuc*, Nhac truoc han (ngay) (khong bat buoc, placeholder 'VD: 7', co tooltip)\n"
                         "- 2 nut 'Huy' va 'Them moi' o cuoi modal",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_014",
                title="Them moi tu danh gia - du lieu hop le (Dinh ky)",
                pre="- Modal Them moi dang mo",
                steps="1. Chon Phan loai danh gia = 'Dinh ky'\n"
                      "2. Chon Danh gia (Bo chi so) hop le, vi du 'Bo chi so chuyen doi so cua co quan, don vi thuoc Bo'\n"
                      "3. Nhap Ten = 'TC Auto - Tu danh gia dinh ky [thoi gian hien tai]'\n"
                      "4. Chon Ngay bat dau = ngay hien tai\n"
                      "5. Chon Ngay ket thuc = ngay hien tai + 30 ngay\n"
                      "6. Nhap Nhac truoc han = 7\n"
                      "7. Nhan 'Them moi'",
                expected="- He thong tao thanh cong ban ghi tu danh gia moi, hien thong bao thanh cong\n"
                         "- Modal dong lai, danh sach duoc lam moi va hien ban ghi vua tao voi Trang thai = 'Nhap'\n"
                         "- Loai hien thi dung = Dinh ky",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_015",
                title="Them moi tu danh gia - du lieu hop le (Dot xuat)",
                pre="- Modal Them moi dang mo",
                steps="1. Chon Phan loai danh gia = 'Dot xuat'\n"
                      "2. Chon Danh gia (Bo chi so) hop le\n"
                      "3. Nhap Ten hop le\n"
                      "4. Chon Ngay bat dau, Ngay ket thuc hop le\n"
                      "5. Nhan 'Them moi'",
                expected="- Tao thanh cong, ban ghi moi xuat hien trong tab 'Dot xuat' voi Loai = Dot xuat, Trang thai = Nhap",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_016",
                title="[Validation] Bo trong tat ca truong bat buoc va nhan Them moi",
                pre="- Modal Them moi dang mo, chua nhap gi",
                steps="1. Khong nhap/chon gi\n"
                      "2. Nhan nut 'Them moi' de submit",
                expected="- He thong khong goi API tao moi, khong dong modal\n"
                         "- Hien thi thong bao loi validation duoi tung truong bat buoc: Phan loai danh gia, Danh gia, Ten, Ngay bat dau, Ngay ket thuc (dau * do)",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_017",
                title="[Validation] Chi nhap Ten, bo trong cac truong con lai",
                pre="- Modal Them moi dang mo",
                steps="1. Nhap Ten = 'Test validation'\n"
                      "2. Khong chon Phan loai danh gia, Danh gia, Ngay bat dau, Ngay ket thuc\n"
                      "3. Nhan 'Them moi'",
                expected="- Hien loi validation rieng cho tung truong con thieu (Phan loai danh gia, Danh gia, Ngay bat dau, Ngay ket thuc)\n"
                         "- Khong tao ban ghi moi",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_018",
                title="[Validation] Ngay ket thuc truoc Ngay bat dau",
                pre="- Modal Them moi dang mo, da dien cac truong khac hop le",
                steps="1. Chon Ngay bat dau = 15/10/2026\n"
                      "2. Chon Ngay ket thuc = 01/10/2026 (truoc ngay bat dau)\n"
                      "3. Nhan 'Them moi'",
                expected="- He thong tu choi, hien thong bao loi 'Ngay ket thuc phai sau Ngay bat dau' (hoac tuong duong)\n"
                         "- Khong tao ban ghi moi",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_019",
                title="[Validation] Ngay bat dau = Ngay ket thuc (trung ngay)",
                pre="- Modal Them moi dang mo",
                steps="1. Chon Ngay bat dau va Ngay ket thuc cung mot ngay\n"
                      "2. Nhan 'Them moi'",
                expected="- CAN XAC NHAN: he thong co the chap nhan (danh gia dien ra trong 1 ngay) hoac tu choi tuy quy tac nghiep vu\n"
                         "- Hanh vi phai nhat quan va co thong bao ro rang cho nguoi dung",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_020",
                title="[Validation] Ngay bat dau o qua khu",
                pre="- Modal Them moi dang mo",
                steps="1. Chon Ngay bat dau la mot ngay da qua (vi du nam truoc)\n"
                      "2. Chon Ngay ket thuc hop le (sau ngay bat dau)\n"
                      "3. Nhan 'Them moi'",
                expected="- CAN XAC NHAN: he thong co chan ngay bat dau trong qua khu hay khong; neu chan, hien thong bao ro rang; neu cho phep, ghi nhan binh thuong",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_021",
                title="[Edge case] Ten danh gia trung voi ban ghi da co",
                pre="- Da ton tai ban ghi ten 'Co cau to chuc'",
                steps="1. Mo Them moi, nhap Ten = 'Co cau to chuc' (trung ten da co)\n"
                      "2. Dien cac truong con lai hop le\n"
                      "3. Nhan 'Them moi'",
                expected="- CAN XAC NHAN quy tac unique: he thong co the (a) tu choi va bao loi 'Ten da ton tai', hoac (b) cho phep trung ten (vi du khac ky/nam).\n"
                         "- Ghi nhan hanh vi thuc te va danh gia co dung thiet ke hay khong",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_022",
                title="[Edge case] Ten danh gia qua dai (gioi han do dai)",
                pre="- Modal Them moi dang mo",
                steps="1. Nhap Ten voi chuoi rat dai (vi du 500 ky tu)\n"
                      "2. Dien cac truong con lai hop le\n"
                      "3. Nhan 'Them moi'",
                expected="- He thong gioi han do dai dau vao (maxlength) hoac hien loi validation 'Ten khong duoc vuot qua N ky tu'\n"
                         "- Khong luu du lieu bi cat xen (truncate) am tham khong canh bao",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_023",
                title="[Edge case] Ten danh gia chi gom khoang trang",
                pre="- Modal Them moi dang mo",
                steps="1. Nhap Ten = '    ' (chi chua khoang trang)\n"
                      "2. Dien cac truong con lai hop le\n"
                      "3. Nhan 'Them moi'",
                expected="- He thong tu dong trim va coi la rong, hien loi validation 'Ten la bat buoc' - khong tao ban ghi voi ten rong/toan khoang trang",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_024",
                title="[Edge case] Ten danh gia chua ky tu dac biet / HTML",
                pre="- Modal Them moi dang mo",
                steps="1. Nhap Ten = '<b>Test</b> & \"quote\" <script>alert(1)</script>'\n"
                      "2. Dien cac truong con lai hop le\n"
                      "3. Nhan 'Them moi'",
                expected="- He thong chap nhan luu nhu van ban thuan (khong thuc thi script)\n"
                         "- Khi hien thi lai trong danh sach, chuoi duoc escape an toan, khong gay loi hien thi hoac XSS",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_025",
                title="[Edge case] Nhac truoc han (ngay) nhap gia tri am hoac khong phai so",
                pre="- Modal Them moi dang mo, cac truong khac da hop le",
                steps="1. Nhap Nhac truoc han = -5\n"
                      "2. Nhan 'Them moi'\n"
                      "3. Sua lai Nhac truoc han = 'abc'\n"
                      "4. Nhan 'Them moi'",
                expected="- Voi gia tri am: he thong tu choi hoac tu dong chuyen ve gia tri hop le (vi du 0), hien thong bao neu tu choi\n"
                         "- Voi gia tri khong phai so: o nhap chi cho phep nhap so (hoac hien loi validation ro rang), khong crash giao dien",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_026",
                title="[Edge case] Nhac truoc han (ngay) = 0 hoac de trong",
                pre="- Modal Them moi dang mo, cac truong khac da hop le",
                steps="1. De trong Nhac truoc han, nhan 'Them moi'\n"
                      "2. Lap lai voi gia tri = 0",
                expected="- Truong nay khong bat buoc nen de trong van tao thanh cong (khong canh bao truoc han)\n"
                         "- Gia tri 0: CAN XAC NHAN y nghia nghiep vu (khong canh bao hay canh bao ngay trong ngay den han)",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_027",
                title="Huy tao moi - nhan nut Huy",
                pre="- Modal Them moi dang mo, da nhap mot so du lieu",
                steps="1. Nhap mot vai truong (chua submit)\n"
                      "2. Nhan nut 'Huy'",
                expected="- Modal dong lai, khong co ban ghi moi nao duoc tao\n"
                         "- Danh sach giu nguyen nhu truoc khi mo modal",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_028",
                title="Huy tao moi - nhan icon dong (X) hoac click ra ngoai modal",
                pre="- Modal Them moi dang mo, da nhap mot so du lieu",
                steps="1. Nhan icon dong (X) o goc tren phai modal\n"
                      "2. Mo lai modal, nhap du lieu, click ra vung toi ben ngoai modal",
                expected="- Ca hai cach deu dong modal ma khong luu du lieu (hoac hien xac nhan 'Ban co chac muon huy?' neu da nhap du lieu - CAN XAC NHAN hanh vi cu the)",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_029",
                title="[Edge case] Mat ket noi mang khi dang submit Them moi",
                pre="- Modal Them moi da dien day du du lieu hop le\n"
                      "- Co the gia lap mat mang qua DevTools (offline) truoc khi submit",
                steps="1. Ngat ket noi mang (offline)\n"
                      "2. Nhan 'Them moi'",
                expected="- He thong hien thong bao loi ket noi / timeout ro rang, khong treo giao dien vo thoi han\n"
                         "- Modal khong dong, du lieu da nhap khong bi mat, cho phep thu lai khi co mang",
                priority="Trung binh",
            ),
        ],
    },
    {
        "function": "Cap nhat tu danh gia (UC-B.III.1)",
        "items": [
            dict(
                id="TC_TDG_030",
                title="Cap nhat tu danh gia trang thai Nhap - sua Ten thanh cong",
                pre="- Co ban ghi Trang thai = Nhap",
                steps="1. Tai dong tuong ung, nhan icon mui ten (dropdown) canh 'Xem chi tiet'\n"
                      "2. Chon 'Cap nhat'\n"
                      "3. Sua lai Ten\n"
                      "4. Luu thay doi",
                expected="- He thong cap nhat thanh cong, hien thong bao luu thanh cong\n"
                         "- Danh sach hien ten moi vua sua",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_031",
                title="Cap nhat tu danh gia trang thai Da phe duyet - kiem tra truong duoc phep sua",
                pre="- Co ban ghi Trang thai = Da phe duyet",
                steps="1. Mo dropdown thao tac cua ban ghi Da phe duyet\n"
                      "2. Chon 'Cap nhat'\n"
                      "3. Quan sat cac truong co the chinh sua",
                expected="- Dropdown thao tac cua ban ghi Da phe duyet CHI co 'Phan cong don vi' va 'Cap nhat' (khong co Xoa, Trinh phe duyet, Cau hinh diem) - dung nhu da quan sat tren UI\n"
                         "- CAN XAC NHAN: form Cap nhat co khoa (disable) cac truong quan trong (Phan loai danh gia, Bo chi so, thoi gian) hay cho sua tu do giong trang thai Nhap",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_032",
                title="[Validation] Cap nhat - xoa trong truong Ten bat buoc roi luu",
                pre="- Dang mo form Cap nhat mot ban ghi",
                steps="1. Xoa toan bo noi dung truong Ten\n"
                      "2. Nhan nut luu/cap nhat",
                expected="- He thong tu choi luu, hien loi validation 'Ten la bat buoc'\n"
                         "- Du lieu cu khong bi mat/ghi de bang gia tri rong",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_033",
                title="[Validation] Cap nhat - doi Ngay ket thuc truoc Ngay bat dau",
                pre="- Dang mo form Cap nhat mot ban ghi hop le",
                steps="1. Sua Ngay ket thuc thanh mot ngay truoc Ngay bat dau hien tai\n"
                      "2. Nhan luu",
                expected="- He thong tu choi luu, bao loi tuong tu nhu khi Them moi",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_034",
                title="Huy cap nhat - khong luu thay doi",
                pre="- Dang mo form Cap nhat, da sua mot vai truong",
                steps="1. Sua du lieu nhung khong luu\n"
                      "2. Nhan 'Huy' / dong form",
                expected="- Du lieu khong duoc luu, khi mo lai van hien gia tri cu",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_035",
                title="[Edge case] Hai nguoi dung cung cap nhat 1 ban ghi dong thoi",
                pre="- 2 phien dang nhap cung mo form Cap nhat 1 ban ghi (vi du 'Co cau to chuc')",
                steps="1. Nguoi dung A sua Ten va luu thanh cong\n"
                      "2. Nguoi dung B (da mo form truoc do, chua tai lai) sua truong khac va luu",
                expected="- CAN XAC NHAN co che xu ly xung dot: he thong co the (a) ghi de du lieu cua A, (b) tu choi va yeu cau B tai lai du lieu moi nhat (optimistic locking / version conflict)\n"
                         "- Khong duoc de du lieu sai lech am tham khong canh bao",
                priority="Trung binh",
            ),
        ],
    },
    {
        "function": "Xoa tu danh gia (UC-B.III.1)",
        "items": [
            dict(
                id="TC_TDG_036",
                title="Xoa tu danh gia trang thai Nhap - xac nhan xoa",
                pre="- Co ban ghi Trang thai = Nhap, khong quan trong (du lieu test)",
                steps="1. Mo dropdown thao tac cua ban ghi Nhap\n"
                      "2. Chon 'Xoa' (muc mau do)\n"
                      "3. Trong hop thoai xac nhan, nhan dong y xoa",
                expected="- Hien hop thoai xac nhan xoa truoc khi thuc hien\n"
                         "- Sau khi xac nhan, ban ghi bi xoa khoi danh sach, hien thong bao thanh cong\n"
                         "- Tong so ban ghi giam 1",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_037",
                title="Xoa tu danh gia - huy trong hop thoai xac nhan",
                pre="- Co ban ghi Trang thai = Nhap",
                steps="1. Mo dropdown thao tac, chon 'Xoa'\n"
                      "2. Trong hop thoai xac nhan, nhan 'Huy' / dong hop thoai",
                expected="- Ban ghi KHONG bi xoa, danh sach giu nguyen",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_038",
                title="[Edge case] Xoa tu danh gia trang thai Da phe duyet (khong co quyen/khong co nut)",
                pre="- Co ban ghi Trang thai = Da phe duyet",
                steps="1. Mo dropdown thao tac cua ban ghi Da phe duyet\n"
                      "2. Quan sat danh sach cac thao tac kha dung",
                expected="- Khong co muc 'Xoa' trong dropdown (da xac nhan qua khao sat UI)\n"
                         "- Neu goi API xoa truc tiep (vi du qua DevTools) voi ban ghi da phe duyet, he thong phai tu choi o phia server (403/400), khong duoc xoa ngam",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_039",
                title="[Edge case] Xoa tu danh gia da duoc phan cong don vi / co du lieu lien quan",
                pre="- Co ban ghi Nhap da duoc 'Phan cong don vi' cho it nhat 1 don vi",
                steps="1. Xoa ban ghi nay (xac nhan xoa)",
                expected="- CAN XAC NHAN rang buoc nghiep vu: he thong co the (a) tu choi xoa va bao 'da co don vi duoc phan cong, khong the xoa', hoac (b) xoa kem theo du lieu phan cong lien quan\n"
                         "- Khong duoc de du lieu phan cong don vi mo coi (orphan) sau khi xoa",
                priority="Trung binh",
            ),
        ],
    },
    {
        "function": "Cau hinh diem chi so/chi tieu cua tu danh gia (UC-B.III.1)",
        "items": [
            dict(
                id="TC_TDG_040",
                title="Mo man hinh/popup Cau hinh diem cho tu danh gia trang thai Nhap",
                pre="- Co ban ghi Trang thai = Nhap",
                steps="1. Mo dropdown thao tac, chon 'Cau hinh diem'",
                expected="- He thong mo man hinh/popup hien danh sach chi so/chi tieu cua bo chi so dang ap dung, kem diem toi da/toi thieu cua tung chi so\n"
                         "- Cho phep them/sua/xoa chi so, chi tieu cua tu danh gia (theo UC-B.III.1)",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_041",
                title="Them chi so/chi tieu vao tu danh gia",
                pre="- Dang o man hinh Cau hinh diem cua mot tu danh gia Nhap",
                steps="1. Chon them 1 chi so/chi tieu moi tu danh sach bo chi so\n"
                      "2. Luu lai",
                expected="- Chi so/chi tieu moi duoc them vao danh sach cau hinh cua tu danh gia, luu thanh cong",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_042",
                title="[Validation] Nhap diem toi thieu > diem toi da cho 1 chi so",
                pre="- Dang cau hinh diem cho 1 chi so",
                steps="1. Nhap Diem toi thieu = 10, Diem toi da = 5 (toi thieu lon hon toi da)\n"
                      "2. Luu",
                expected="- He thong tu choi luu, bao loi 'Diem toi thieu khong duoc lon hon diem toi da' (hoac tuong duong)",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_043",
                title="[Edge case] Nhap diem am hoac khong phai so cho chi so",
                pre="- Dang cau hinh diem cho 1 chi so",
                steps="1. Nhap Diem toi da = -1\n"
                      "2. Luu\n"
                      "3. Thu nhap ky tu chu 'abc' vao truong diem",
                expected="- He thong tu choi gia tri am/khong hop le, hien loi validation ro rang, khong luu du lieu sai",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_044",
                title="Xoa chi so/chi tieu khoi tu danh gia",
                pre="- Tu danh gia dang co it nhat 1 chi so da cau hinh",
                steps="1. Chon xoa 1 chi so khoi danh sach cau hinh\n"
                      "2. Xac nhan xoa",
                expected="- Chi so bi loai khoi danh sach cau hinh cua tu danh gia, luu thanh cong",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_045",
                title="[Edge case] Cau hinh diem cho tu danh gia da Da phe duyet",
                pre="- Co ban ghi Trang thai = Da phe duyet",
                steps="1. Mo dropdown thao tac cua ban ghi Da phe duyet, kiem tra co muc 'Cau hinh diem' hay khong",
                expected="- Khong co muc 'Cau hinh diem' trong dropdown cua ban ghi da phe duyet (da xac nhan qua khao sat UI: chi con Phan cong don vi, Cap nhat)\n"
                         "- Dam bao khong the sua cau hinh diem cua mot bo tieu chi da duoc duyet va dang su dung",
                priority="Cao",
            ),
        ],
    },
    {
        "function": "Phan cong don vi thuc hien tu danh gia (UC-B.III.2)",
        "items": [
            dict(
                id="TC_TDG_046",
                title="Mo man hinh Phan cong don vi cho tu danh gia Nhap",
                pre="- Co ban ghi Trang thai = Nhap",
                steps="1. Mo dropdown thao tac, chon 'Phan cong don vi'",
                expected="- Hien thi danh sach don vi (truc thuoc Bo Dan toc va Ton giao; So/Ban/Nganh dia phuong) co the chon de phan cong thuc hien tu danh gia\n"
                         "- Co o tim kiem/loc don vi va nut them/xoa don vi khoi danh sach phan cong",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_047",
                title="Them don vi vao danh sach phan cong - thanh cong",
                pre="- Dang o man hinh Phan cong don vi",
                steps="1. Chon 1 hoac nhieu don vi chua duoc phan cong\n"
                      "2. Nhan nut them/luu",
                expected="- Cac don vi da chon duoc them vao danh sach 'don vi phai thuc hien tu danh gia' cua ky danh gia nay, hien thong bao thanh cong",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_048",
                title="Xoa don vi khoi danh sach phan cong",
                pre="- Da co it nhat 1 don vi trong danh sach phan cong",
                steps="1. Chon 1 don vi da phan cong, nhan xoa\n"
                      "2. Xac nhan (neu co hop thoai xac nhan)",
                expected="- Don vi bi loai khoi danh sach phan cong cua tu danh gia nay",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_049",
                title="[Edge case] Phan cong trung mot don vi 2 lan",
                pre="- Don vi X da co trong danh sach phan cong",
                steps="1. Thu chon lai don vi X de them lan nua",
                expected="- He thong khong tao ban ghi phan cong trung lap: hoac an don vi X khoi danh sach co the chon them, hoac bao loi 'don vi da duoc phan cong'",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_050",
                title="Export danh sach don vi phai thuc hien tu danh gia ra Excel",
                pre="- Dang o man hinh Phan cong don vi, da co du lieu",
                steps="1. Nhan nut Export/Xuat Excel (neu co o man hinh nay theo UC-B.III.2)",
                expected="- File Excel duoc tai ve, noi dung khop voi danh sach don vi dang hien thi",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_051",
                title="[Edge case] Phan cong don vi cho ban ghi Da phe duyet",
                pre="- Co ban ghi Trang thai = Da phe duyet",
                steps="1. Mo dropdown thao tac, chon 'Phan cong don vi' (muc nay van kha dung o trang thai Da phe duyet theo khao sat UI)\n"
                      "2. Thu them/xoa don vi",
                expected="- Chuc nang Phan cong don vi van hoat dong binh thuong voi ban ghi da phe duyet (dung nhu UI cho phep), cho phep bo sung don vi thuc hien sau khi ky danh gia da duyet",
                priority="Trung binh",
            ),
        ],
    },
    {
        "function": "Trinh phe duyet yeu cau tu danh gia (UC-B.III.3)",
        "items": [
            dict(
                id="TC_TDG_052",
                title="Trinh phe duyet tu danh gia dang Nhap - du dieu kien",
                pre="- Ban ghi Trang thai = Nhap, da duoc phan cong it nhat 1 don vi thuc hien\n"
                    "- Da cau hinh it nhat 1 chi so/chi tieu",
                steps="1. Mo dropdown thao tac, chon 'Trinh phe duyet'\n"
                      "2. Xac nhan trinh (neu co hop thoai xac nhan/chon nguoi phe duyet)",
                expected="- He thong gui yeu cau len Lanh dao, hien thong bao thanh cong\n"
                         "- Trang thai ban ghi chuyen sang trang thai cho duyet (vi du 'Cho phe duyet') - CAN XAC NHAN ten trang thai chinh xac\n"
                         "- Dropdown thao tac cua ban ghi nay sau khi trinh co the thay doi (vi du mat muc 'Xoa', 'Cau hinh diem') - CAN XAC NHAN",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_053",
                title="[Edge case] Trinh phe duyet khi chua phan cong don vi nao",
                pre="- Ban ghi Trang thai = Nhap, CHUA phan cong don vi nao",
                steps="1. Mo dropdown thao tac, chon 'Trinh phe duyet'",
                expected="- CAN XAC NHAN rang buoc: he thong co the (a) tu choi trinh va bao 'can phan cong don vi truoc khi trinh', hoac (b) van cho trinh\n"
                         "- Neu tu choi, thong bao loi phai ro rang, huong dan buoc tiep theo",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_054",
                title="[Edge case] Trinh phe duyet khi chua cau hinh chi so/chi tieu nao",
                pre="- Ban ghi Trang thai = Nhap, chua cau hinh chi so/chi tieu nao",
                steps="1. Mo dropdown thao tac, chon 'Trinh phe duyet'",
                expected="- CAN XAC NHAN: he thong nen tu choi trinh phe duyet mot bo tieu chi rong va huong dan nguoi dung cau hinh diem truoc",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_055",
                title="Xem danh sach da trinh lanh dao phe duyet",
                pre="- Da trinh phe duyet it nhat 1 tu danh gia",
                steps="1. Tim muc 'Xem danh sach da trinh' (neu co rieng theo UC-B.III.3) hoac loc theo trang thai cho duyet tren danh sach chinh",
                expected="- Hien thi dung danh sach cac tu danh gia da duoc trinh len lanh dao, cho biet trang thai cho duyet",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_056",
                title="[Edge case] Trinh phe duyet 2 lan lien tiep cho cung 1 ban ghi",
                pre="- Ban ghi vua duoc trinh phe duyet thanh cong (dang cho duyet)",
                steps="1. Mo lai dropdown thao tac cua ban ghi vua trinh\n"
                      "2. Kiem tra con muc 'Trinh phe duyet' hay khong, neu con thi nhan lai",
                expected="- Sau khi da trinh, muc 'Trinh phe duyet' khong con xuat hien trong dropdown (tranh trinh trung lap)\n"
                         "- Neu van con va nguoi dung bam lai, he thong phai tu choi/bao da trinh roi, khong tao 2 yeu cau trung",
                priority="Trung binh",
            ),
        ],
    },
    {
        "function": "Kiem soat theo trang thai, phan quyen va bo cuc giao dien (edge case chung)",
        "items": [
            dict(
                id="TC_TDG_057",
                title="[Phan quyen] Tai khoan khong co quyen Quan ly tu danh gia truy cap truc tiep bang URL",
                pre="- Co tai khoan khong duoc gan quyen voi menu 'Quan ly tu danh gia' (CAN TAI KHOAN PHU)",
                steps="1. Dang nhap bang tai khoan khong co quyen\n"
                      "2. Truy cap truc tiep URL https://cds.geneat.pro/#/vi/self-assessment-campaigns",
                expected="- He thong chan truy cap, chuyen huong ve trang khong co quyen / trang chu, hoac an menu tuong ung\n"
                         "- Khong hien thi du lieu tu danh gia cho tai khoan khong co quyen",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_058",
                title="[Phan quyen] Tai khoan chi co quyen xem, khong co quyen sua/xoa",
                pre="- Co tai khoan chi duoc gan quyen 'xem' voi man hinh nay (CAN TAI KHOAN PHU)",
                steps="1. Dang nhap bang tai khoan chi co quyen xem\n"
                      "2. Vao man hinh Quan ly tu danh gia, kiem tra cac nut/thao tac hien thi",
                expected="- Khong hien thi (hoac disable) cac nut 'Them moi', 'Cap nhat', 'Xoa', 'Trinh phe duyet', 'Cau hinh diem', 'Phan cong don vi'\n"
                         "- Chi co the xem danh sach va xem chi tiet",
                priority="Cao",
            ),
            dict(
                id="TC_TDG_059",
                title="[Session] Phien dang nhap het han khi dang thao tac tren man hinh",
                pre="- Dang dang nhap va mo man hinh Quan ly tu danh gia\n"
                    "- Co the gia lap het han bang cach xoa/lam het han token",
                steps="1. Lam token dang nhap het han (hoac doi den khi het han theo cau hinh timeout)\n"
                      "2. Thuc hien 1 thao tac bat ky (vi du Them moi, Xoa)",
                expected="- He thong phat hien phien het han, chuyen huong ve trang dang nhap hoac hien thong bao 'Phien lam viec het han, vui long dang nhap lai'\n"
                         "- Khong de loi khong ro rang hoac treo giao dien",
                priority="Trung binh",
            ),
            dict(
                id="TC_TDG_060",
                title="[Giao dien] Hien thi bang danh sach tren man hinh/viewport nho",
                pre="- Dang o man hinh danh sach Quan ly tu danh gia",
                steps="1. Thu nho chieu rong trinh duyet xuong muc di dong (vi du 375px) hoac may tinh bang (768px)\n"
                      "2. Quan sat bo cuc bang danh sach va cac nut thao tac",
                expected="- Bang co the cuon ngang (horizontal scroll) hoac tu dong responsive, khong bi vo bo cuc, khong che khuat nut thao tac\n"
                         "- Cac cot quan trong (Ten danh gia, Trang thai, Thao tac) van xem duoc",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_061",
                title="[Giao dien] Ten danh gia qua dai lam vo bo cuc cot trong bang",
                pre="- Co ban ghi voi Ten danh gia rat dai (tao tu TC_TDG_022 neu he thong cho phep, hoac du lieu co san)",
                steps="1. Quan sat dong du lieu co Ten danh gia dai trong bang danh sach",
                expected="- Ten dai duoc wrap xuong dong hoac rut gon (ellipsis) kem tooltip hien day du, khong lam vo layout bang/day cot khac ra ngoai man hinh",
                priority="Thap",
            ),
            dict(
                id="TC_TDG_062",
                title="[Bug ghi nhan] Nut 'Xem chi tiet' khong phan hoi khi click (can QA xac nhan lai thu cong)",
                pre="- Dang o man hinh danh sach, co du ban ghi Nhap va Da phe duyet",
                steps="1. Nhan nut 'Xem chi tiet' (phan chu, khong phai icon mui ten) tren mot dong bat ky\n"
                      "2. Quan sat phan hoi cua he thong (URL, modal, drawer, trang moi...)",
                expected="- Ky vong: he thong dieu huong sang trang/hien drawer chi tiet day du thong tin tu danh gia (bo chi so, danh sach chi so/chi tieu, don vi duoc phan cong, lich su...)\n"
                         "- GHI CHU KHAO SAT TU DONG: khi kiem thu tu dong bang Playwright (click thuong, click bang toa do chuot, kiem tra dieu huong/XHR/console) nut nay KHONG tao bat ky thay doi nao tren URL, DOM hay network trong 3 lan thu doc lap - can QA bam tay truc tiep tren trinh duyet that de xac nhan day co phai loi thuc su hay chi la han che cua moi truong headless",
                priority="Cao",
            ),
        ],
    },
]
