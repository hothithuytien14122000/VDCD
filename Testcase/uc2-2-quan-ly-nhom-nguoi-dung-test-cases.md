# QUAN LY NHOM NGUOI DUNG (UC2.2)

> Nguon: docs/UC2.2_Quan-ly-nhom-nguoi-dung.md (cap nhat 10/10/2026) + khao sat UI thuc te qua Playwright ngay 11/10/2026 (tai khoan qa.superadmin@cds.local) tai https://cds.geneat.pro/#/vi/roles. Test case danh dau CAN XAC NHAN la diem ma UC hoac lan khao sat nay CHUA xac dinh chac chan.

**Tong so test case:** 39

| STT | Chuc nang | So luong |
|---|---|---|
| 1 | Xem danh sach nhom nguoi dung (UC2.2) | 4 |
| 2 | Tim kiem nhom nguoi dung (UC2.2) | 4 |
| 3 | Xuat Excel danh sach nhom nguoi dung (UC2.2) | 2 |
| 4 | Xem thong tin nhom nguoi dung (UC2.2) | 3 |
| 5 | Xem nguoi dung trong nhom (UC2.2) | 4 |
| 6 | Them / xoa nguoi dung khoi nhom (UC2.2) | 2 |
| 7 | Them moi nhom nguoi dung (UC2.2) | 9 |
| 8 | Chinh sua thong tin nhom nguoi dung (UC2.2) | 6 |
| 9 | Xoa nhom nguoi dung (UC2.2) | 5 |

---

## Xem danh sach nhom nguoi dung (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_001 | Hien thi danh sach nhom nguoi dung mac dinh | Da dang nhap voi tai khoan Quan tri he thong | 1. Chon menu "Nhom nguoi dung" trong phan he Quan tri he thong | - Hien thi man hinh "Nhom nguoi dung" voi mo ta "Danh sach nhom nguoi dung trong he thong"<br>- Bang gom cac cot: STT, Ma nhom nguoi dung, Ten nhom nguoi dung, Mo ta, THANH VIEN, Thao tac (xac nhan truc tiep 11/10/2026)<br>- [CAN XAC NHAN] cot "THANH VIEN" (so luong nguoi dung trong tung nhom) KHONG co trong bang Field Specification UI-2.2.1 cua UC - can xac nhan day la thay doi chu dich hay thieu sot khi viet UC<br>- 5 ban ghi hien co: CBDP, lanhdaobo, LEADER, STAFF, SUPER_ADMIN (xac nhan truc tiep 11/10/2026, dung voi 4 nhom mac dinh cua BR-3 + 1 nhom test CBDP) | Cao |
| TC_UC2.2_002 | [UI/UX] Khong co dropdown loc nao ngoai o tim kiem tren danh sach | Dang o man hinh Nhom nguoi dung | 1. Quan sat khu vuc phia tren bang danh sach | Chi co 1 o tim kiem, KHONG co dropdown loc nao khac (xac nhan truc tiep 11/10/2026) - giai dap diem CAN XAC NHAN cua BR-4 ("co bo loc nao khac khong") - khac voi man hinh Nguoi dung (UC2.1) co 2 dropdown loc | Thap |
| TC_UC2.2_003 | [Security] Truy cap man hinh Nhom nguoi dung khi chua dang nhap bi dieu huong ve login | Chua dang nhap | 1. Truy cap truc tiep URL https://cds.geneat.pro/#/vi/roles bang duong dan | Khong vao duoc man hinh Nhom nguoi dung, he thong dieu huong ve trang dang nhap | Cao |
| TC_UC2.2_003b | [Business Logic] Menu thao tac cua Nhom nguoi dung KHONG co Khoa/Mo khoa (BR-5) | Dang o danh sach Nhom nguoi dung | 1. Mo menu thao tac (icon 3 cham) cua 1 dong bat ky | Menu CHI gom dung 2 muc: "Cap nhat", "Xoa" - KHONG co muc Khoa/Mo khoa nao (BR-5, xac nhan truc tiep 11/10/2026). Khac voi man hinh Nguoi dung (UC2.1) co them Khoa/Mo khoa vi Nhom nguoi dung khong co khai niem trang thai hoat dong/khoa | Trung binh |

## Tim kiem nhom nguoi dung (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_004 | Tim kiem theo Ten nhom co ket qua khop | Dang o man hinh Nhom nguoi dung, biet truoc Ten 1 nhom co san (vi du "Lanh dao") | 1. Nhap tu khoa khop voi Ten nhom vao o "Tim kiem theo ten nhom, ma..." (placeholder xac nhan truc tiep 11/10/2026) | Bang danh sach chi con hien nhom co Ten khop voi tu khoa (BR-4) | Cao |
| TC_UC2.2_005 | [Equivalence Partitioning] Tim kiem rieng theo Ma nhom | Biet truoc Ma nhom co san, vi du "STAFF" | 1. Nhap dung Ma nhom (vi du "STAFF") vao o tim kiem | Bang danh sach tra ve dung nhom co Ma trung khop - xac nhan BR-4 ("tim theo Ma nhom hoac Ten nhom") ap dung cho ca 2 truong, khong chi rieng Ten nhom | Trung binh |
| TC_UC2.2_006 | [Negative] Tim kiem khong co ket qua khop | Dang o man hinh Nhom nguoi dung | 1. Nhap tu khoa ngau nhien khong ton tai (vi du "zzz_khong_ton_tai_123") | Bang hien thi trang thai rong / khong co ban ghi nao. [CAN XAC NHAN] noi dung thong bao "khong co du lieu" chinh xac | Trung binh |
| TC_UC2.2_007 | [UI/UX] Xoa tu khoa tim kiem tra ve danh sach day du | Da nhap 1 tu khoa tim kiem lam loc danh sach | 1. Xoa trong noi dung o tim kiem | Bang tra ve hien thi day du 5 ban ghi nhu ban dau | Thap |

## Xuat Excel danh sach nhom nguoi dung (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_008 | [UI/UX] Nut Xuat Excel KHONG co tren man hinh Danh sach, CO tren man hinh Chi tiet nhom | Dang o man hinh Nhom nguoi dung (danh sach) | 1. Quan sat toan bo thanh cong cu phia tren bang danh sach (khong co filter nao khac ngoai o tim kiem va nut Them nhom)<br>2. Mo mot nhom bat ky qua "Xem chi tiet", quan sat goc tren ben phai man hinh Chi tiet | XAC NHAN TRUC TIEP 11/10/2026: man hinh Danh sach (UI-2.2.1) KHONG co nut "Xuat Excel" - khac voi suy doan cua UC tai AF5 ("nhan Xuat Excel [neu co]" gan voi buoc 2 - man hinh danh sach). Nut "Xuat Excel" thuc te nam o man hinh Chi tiet nhom (UI-2.2.3), canh nut "Them nguoi dung vao nhom". De nghi QC cap nhat lai AF5 va bang Truy vet chuc nang cho dung UI-2.2.3 thay vi UI-2.2.1. | Trung binh |
| TC_UC2.2_009 | [CAN XAC NHAN] Xuat Excel tren man hinh Chi tiet nhom xuat ra du lieu gi | Dang o man hinh Chi tiet cua 1 nhom | 1. Nhan nut "Xuat Excel" | [CAN XAC NHAN] file xuat ra la danh sach thanh vien cua nhom dang xem, hay danh sach toan bo nhom - chua thu truc tiep trong lan khao sat nay (cung ly do voi TC_UC2.1_010/011 - chua quan sat duoc download event trong moi truong tu dong hoa headless) | Thap |

## Xem thong tin nhom nguoi dung (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_010 | Xem chi tiet nhom hien dung thong tin (kiem tra hoi quy) | Dang o danh sach Nhom nguoi dung | 1. Nhan "Xem chi tiet" tren 1 dong bat ky (vi du nhom CBDP) | Chuyen sang man hinh Chi tiet nhom (UI-2.2.3), hien: tieu de la Ten nhom + badge Ma nhom, nut quay lai (mui ten trai), nut "Xuat Excel", nut "Them nguoi dung vao nhom"; khoi thong tin chung (Ma nhom nguoi dung, Ten nhom nguoi dung, Mo ta, so Thanh vien); bang danh sach thanh vien voi o tim kiem va dropdown "Tat ca trang thai".<br>XAC NHAN TRUC TIEP 11/10/2026: man hinh nay hien HOAT DONG BINH THUONG. Dieu nay KHAC voi Ghi nhan QC 10/10/2026 trong UC2.2.md ("Nut Xem chi tiet hien khong mo duoc" / "chua the kiem chung truc tiep"). De nghi QC kiem tra lai va cap nhat UC - toan bo noi dung UI-2.2.3 (truoc day ghi [Can xac nhan] toan bo) nay da quan sat duoc day du, xem chi tiet trong reference/testcase-format cua lan khao sat nay. | Cao |
| TC_UC2.2_011 | [UI/UX] Nut quay lai tren man hinh Chi tiet nhom hoat dong dung | Dang o man hinh Chi tiet cua 1 nhom | 1. Nhan nut mui ten quay lai (goc tren ben trai) | Quay ve man hinh Danh sach Nhom nguoi dung | Thap |
| TC_UC2.2_012 | [UI/UX] Trang thai rong khi nhom chua co thanh vien | Mo Chi tiet 1 nhom co 0 thanh vien (vi du CBDP) | 1. Quan sat bang danh sach thanh vien | Hien trang thai rong voi chu "Trong" va icon minh hoa, so Thanh vien hien thi "0" (xac nhan truc tiep 11/10/2026) | Thap |

## Xem nguoi dung trong nhom (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_013 | Bang danh sach thanh vien hien dung cot | Mo Chi tiet 1 nhom co it nhat 1 thanh vien (vi du STAFF, 10 thanh vien) | 1. Mo Chi tiet nhom STAFF<br>2. Quan sat tieu de cac cot trong bang thanh vien | Bang danh sach thanh vien gom cac cot: TEN DANG NHAP, HO TEN, EMAIL, NGAY THEM, TRANG THAI, THAO TAC (xac nhan truc tiep 11/10/2026) - giai dap toan bo diem CAN XAC NHAN "bo cuc thuc te" cua UI-2.2.3 trong UC goc | Trung binh |
| TC_UC2.2_014 | Loc thanh vien theo Trang thai = "Dang hoat dong" | Mo Chi tiet nhom STAFF (10 thanh vien, xac nhan truc tiep co it nhat 1 thanh vien "Da khoa") | 1. Mo dropdown "Tat ca trang thai" trong bang thanh vien<br>2. Chon "Dang hoat dong" | So dong trong bang giam tu 10 xuong 9 (xac nhan truc tiep 11/10/2026 - filter hoat dong dung, khong phai control chi de trang trí). Dropdown co dung 2 gia tri: "Dang hoat dong", "Da khoa" - giai dap diem CAN XAC NHAN ve danh sach gia tri | Trung binh |
| TC_UC2.2_014b | Loc thanh vien theo Trang thai = "Da khoa" | Mo Chi tiet nhom STAFF | 1. Mo dropdown "Tat ca trang thai" trong bang thanh vien<br>2. Chon "Da khoa" | Bang chi con hien cac thanh vien dang bi khoa (xac nhan truc tiep 11/10/2026: 1 thanh vien trong nhom STAFF dang o trang thai nay) | Thap |
| TC_UC2.2_014c | [UI/UX] O tim kiem thanh vien hoat dong | Mo Chi tiet 1 nhom co nhieu thanh vien | 1. Nhap tu khoa khop voi 1 thanh vien vao o "Tim kiem theo ten, Email..." trong bang thanh vien | [CAN XAC NHAN] bang chi con hien thanh vien khop tu khoa - chua thu truc tiep voi tu khoa that trong lan khao sat nay (chi xac nhan rieng dropdown Trang thai o TC_UC2.2_014/014b) | Thap |

## Them / xoa nguoi dung khoi nhom (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_015 | [CAN XAC NHAN] Nut "Them nguoi dung vao nhom" mo dung luong them thanh vien | Mo Chi tiet 1 nhom bat ky | 1. Nhan nut "Them nguoi dung vao nhom" (goc tren ben phai) | [CAN XAC NHAN] nut nay ton tai va co nhan ro rang (xac nhan truc tiep 11/10/2026), nhung CHUA bam thu de xem mo ra luong gi (modal chon nguoi dung, hay dieu huong trang khac) - tranh thay doi that danh sach thanh vien cac nhom dang co du lieu that (lanhdaobo/LEADER/STAFF/SUPER_ADMIN) | Trung binh |
| TC_UC2.2_016 | [CAN XAC NHAN] Xoa 1 nguoi dung khoi nhom qua cot Thao tac trong bang thanh vien | Mo Chi tiet 1 nhom co thanh vien | 1. Quan sat cot THAO TAC tren 1 dong thanh vien bat ky | [CAN XAC NHAN] hanh dong xoa khoi nhom co ton tai trong cot Thao tac va hanh vi cua no (co popup xac nhan khong, co xoa luon tai khoan nguoi dung hay chi go khoi nhom) - chua thu truc tiep de tranh anh huong du lieu nguoi dung that gan nhom | Trung binh |

## Them moi nhom nguoi dung (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_017 | Them moi nhom nguoi dung thanh cong voi du lieu hop le | Dang o danh sach Nhom nguoi dung. Dung MA NHOM TEST RIENG cho TC nay, KHONG trung voi 5 nhom dang co san | 1. Nhan "Them nhom"<br>2. Nhap Ma nhom hop le chua ton tai (vi du "TC22TEST")<br>3. Nhap Ten nhom<br>4. (Khong bat buoc) nhap Mo ta<br>5. Nhan "Them nhom" | Dong modal, hien thong bao "Them moi thanh cong" (buoc 7 Basic Flow), ban ghi moi xuat hien trong danh sach voi 0 thanh vien. Cau truc modal (tieu de "Them nhom", phu de "Tao nhom quyen moi de gan cho nguoi dung", 2 truong bat buoc + 1 truong tuy chon) xac nhan truc tiep 11/10/2026 | Cao |
| TC_UC2.2_018 | [Required Field] Bo trong tat ca truong bat buoc khi them moi | Dang o man hinh Nhom nguoi dung | 1. Nhan "Them nhom"<br>2. Khong nhap gi, nhan "Them nhom" ngay | Hien du 2 loi duoi tung truong (EF1, xac nhan truc tiep 10/10/2026): "Vui long nhap ma nhom", "Vui long nhap ten nhom". Modal khong dong, khong luu ban ghi | Cao |
| TC_UC2.2_019 | [Data Validation] Ma nhom chua ky tu khong hop le (dau cach / dau tieng Viet) | Dang o modal Them nhom | 1. Nhap Ma nhom chua khoang trang hoac dau tieng Viet (vi du "Nhom Test")<br>2. Nhap Ten nhom hop le<br>3. Nhan "Them nhom" | [CAN XAC NHAN] he thong tu choi va bao loi dinh dang - suy tu ghi chu tren form "Chu khong dau, so, dau _ - : khong khoang trang" (BR-1), chua thu truc tiep gia tri sai de xac nhan thong bao loi chinh xac | Trung binh |
| TC_UC2.2_020 | [Decision Table] Ma nhom trung nhung con thieu Ten nhom: bao thieu truong truoc | Biet truoc 1 Ma nhom da ton tai (vi du "STAFF") | 1. Nhap Ma nhom trung voi nhom co san ("STAFF")<br>2. De trong Ten nhom<br>3. Nhan "Them nhom"<br>4. Nhap tiep Ten nhom bat ky roi nhan lai "Them nhom" | O buoc 3, he thong bao loi THIEU TRUONG BAT BUOC truoc (EF1 - "Vui long nhap ten nhom"), CHUA kiem tra trung Ma nhom - dung voi so do luong nghiep vu trong UC (buoc F "Du truong bat buoc?" xay ra TRUOC buoc H "Ma nhom bi trung?"). O buoc 4 (sau khi du truong), moi hien loi trung Ma nhom (EF2) | Trung binh |
| TC_UC2.2_021 | [Data Validation][CAN XAC NHAN] Thong bao loi khi Ma nhom trung (EF2) | Da dien Ten nhom hop le, Ma nhom trung voi nhom co san | 1. Nhap Ma nhom trung (vi du "STAFF")<br>2. Nhap Ten nhom bat ky<br>3. Nhan "Them nhom" | He thong tra ve loi "Code {gia tri} da ton tai" (EF2, xac nhan qua API ngay 10/10/2026). [CAN XAC NHAN] vi tri hien thi cu the tren giao dien (toast khong bat duoc trong lan thu truoc) - khong tao ban ghi moi | Cao |
| TC_UC2.2_022 | [UI/UX] Mo ta la truong tuy chon, khong nhap van luu duoc | Dang o modal Them nhom, da nhap du Ma nhom va Ten nhom hop le | 1. Khong nhap gi vao truong Mo ta (khong bat buoc)<br>2. Nhan "Them nhom" | He thong luu thanh cong, khong bao loi thieu Mo ta (BR-2: "Mo ta la tuy chon") | Thap |
| TC_UC2.2_023 | [UI/UX] Huy them moi khong luu du lieu (AF6) | Dang o modal Them nhom | 1. Nhap mot so truong<br>2. Nhan "Huy" hoac icon dong (X) | Modal dong lai, KHONG tao ban ghi moi, quay ve danh sach Nhom nguoi dung khong doi | Trung binh |
| TC_UC2.2_024 | [Data Persistence] Nhom moi them con nguyen sau khi tai lai trang | Da them thanh cong 1 nhom test (TC_UC2.2_017) | 1. Tai lai (F5) man hinh Nhom nguoi dung<br>2. Tim kiem nhom vua them | Nhom moi them van con nguyen voi day du thong tin da nhap, khong bi mat sau khi tai lai trang | Trung binh |
| TC_UC2.2_024b | [Error Handling][can mock][CAN XAC NHAN] Loi he thong khi luu hoac xoa (EF3) | Dang o modal Them nhom (hoac Chinh sua/Xoa) voi du lieu hop le | 1. Gia lap loi backend / mat ket noi (vi du chan API tra ve loi 500 hoac timeout)<br>2. Thuc hien thao tac luu/xoa | [CAN XAC NHAN] he thong hien thong bao loi chung va giu nguyen du lieu truoc thao tac (EF3), khong mat du lieu - chua kiem chung noi dung thong bao cu the. TC nay can gia lap (mock) loi backend, khong the kich hoat an toan tren moi truong that | Trung binh |

## Chinh sua thong tin nhom nguoi dung (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_025 | Chinh sua Ten nhom / Mo ta thanh cong | Co 1 nhom test rieng (vi du nhom tao o TC_UC2.2_017), KHONG dung 4 nhom mac dinh (SUPER_ADMIN/lanhdaobo/LEADER/STAFF) dang co du lieu that | 1. Mo menu thao tac cua dong can sua, chon "Cap nhat"<br>2. Sua Ten nhom va/hoac Mo ta<br>3. Nhan "Luu thay doi" | Dong modal, hien thong bao "Chinh sua thanh cong" (AF2), danh sach cap nhat dung gia tri moi | Cao |
| TC_UC2.2_026 | Ma nhom chi doc khi Chinh sua (BR-1) | Co 1 ban ghi bat ky | 1. Mo modal Chinh sua cua ban ghi do<br>2. Quan sat truong Ma nhom | Truong Ma nhom hien o che do CHI DOC (khoa, icon o khoa), co chu thich "Ma nhom khong the thay doi sau khi tao" - XAC NHAN TRUC TIEP 11/10/2026 qua anh chup man hinh Chinh sua (giai dap diem CAN XAC NHAN cua BR-1 - truoc day chi la suy luan theo mau chung, chua co anh chup truc tiep). Tieu de modal la "Chinh sua nhom nguoi dung", chan modal hien "Chua co thay doi" thay vi "* Truong bat buoc" cho den khi co thay doi | Cao |
| TC_UC2.2_027 | [Required Field] Bo trong Ten nhom khi Chinh sua | Dang o modal Chinh sua cua 1 nhom test rieng | 1. Xoa trong noi dung truong Ten nhom<br>2. Nhan "Luu thay doi" | Hien loi "Vui long nhap ten nhom" duoi truong, khong luu thay doi | Trung binh |
| TC_UC2.2_028 | [UI/UX] Huy chinh sua khong luu thay doi (AF6) | Dang o modal Chinh sua cua 1 nhom test rieng | 1. Sua Ten nhom<br>2. Nhan "Huy" | Modal dong, du lieu KHONG duoc luu, danh sach van hien gia tri cu truoc khi sua | Trung binh |
| TC_UC2.2_029 | [Data Persistence] Thay doi duoc giu nguyen sau khi tai lai trang | Da chinh sua thanh cong 1 nhom test (TC_UC2.2_025) | 1. Tai lai (F5) man hinh Nhom nguoi dung | Gia tri moi van hien thi dung, khong bi hoan tac ve gia tri cu | Trung binh |
| TC_UC2.2_030 | [Business Logic][CAN XAC NHAN] Nhom mac dinh co bi chan sua hay khong | Chon 1 trong 4 nhom mac dinh (SUPER_ADMIN/lanhdaobo/LEADER/STAFF) | 1. Mo modal Chinh sua cua nhom mac dinh<br>2. Quan sat cac truong co bi khoa/chan sua ngoai Ma nhom hay khong | [CAN XAC NHAN] BR-3 chua xac dinh ro cac nhom mac dinh co duoc bao ve khoi sua hay khong (ngoai quy tac chung Ma nhom chi doc o moi nhom) - chua thu luu thay doi that de tranh anh huong du lieu he thong dang dung | Thap |

## Xoa nhom nguoi dung (UC2.2)

| ID | TITLE | DIEU KIEN TIEN QUYET | STEP | KET QUA MONG DOI | DO UU TIEN |
|---|---|---|---|---|---|
| TC_UC2.2_031 | Xoa 1 nhom test rieng khong co thanh vien | Co 1 nhom test rieng, 0 thanh vien (vi du nhom tao o TC_UC2.2_017) | 1. Mo menu thao tac cua dong, chon "Xoa"<br>2. Xac nhan trong popup | Ban ghi bi xoa khoi danh sach, hien thong bao xoa thanh cong (AF4) | Cao |
| TC_UC2.2_032 | [UI/UX] Huy thao tac Xoa (AF6) | Dang mo popup xac nhan Xoa cua 1 nhom test rieng | 1. Nhan "Huy" | Popup dong, nhom KHONG bi xoa | Trung binh |
| TC_UC2.2_033 | [Negative][CAN XAC NHAN] Xoa nhom dang co nguoi dung gan vao (BR-6) | Chon 1 nhom dang co thanh vien (vi du lanhdaobo, 2 thanh vien) | 1. Mo menu thao tac, chon "Xoa"<br>2. Quan sat he thong co cho xac nhan xoa hay khong | [CAN XAC NHAN] BR-6 chua xac dinh co chan xoa nhom dang co nguoi dung gan hay khong (an nut Xoa nhu UC4.2 lam voi Loai don vi, hay van cho xoa roi chan sau khi xac nhan nhu UC4.3) - CHUA thu xoa that de tranh anh huong du lieu nguoi dung that dang gan nhom nay | Cao |
| TC_UC2.2_034 | [Business Logic][CAN XAC NHAN] Nhom mac dinh co bi chan xoa hay khong | Chon 1 trong 4 nhom mac dinh (SUPER_ADMIN/lanhdaobo/LEADER/STAFF) | 1. Quan sat menu thao tac cua nhom mac dinh co hien nut "Xoa" hay khong | [CAN XAC NHAN] BR-3 chua xac dinh cac nhom mac dinh co duoc he thong bao ve khoi xoa hay khong - CHUA thu xoa that vi day la du lieu he thong dang su dung | Cao |
| TC_UC2.2_035 | [Data Persistence] Nhom da xoa khong con xuat hien sau khi tai lai trang | Da xoa thanh cong 1 nhom test (TC_UC2.2_031) | 1. Tai lai (F5) man hinh Nhom nguoi dung<br>2. Tim theo ten/ma nhom vua xoa | Khong tim thay nhom da xoa trong danh sach, tong so ban ghi giam di 1 | Trung binh |

