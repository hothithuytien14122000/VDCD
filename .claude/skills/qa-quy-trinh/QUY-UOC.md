# Quy ước chung cho bộ skill QA

`$S` = `<gốc dự án>/.claude/skills/qa-quy-trinh/scripts` (trong lệnh shell: đặt `S="$(git rev-parse --show-toplevel)/.claude/skills/qa-quy-trinh/scripts";` ở đầu). Mọi đường dẫn `.claude/…`, `qa/…` tính từ gốc dự án. Mọi skill qa-* đọc file này trước, chỉ một lần mỗi phiên.

## 1. Thư mục làm việc trong dự án
```
qa/
  boi-canh.md          # URL, môi trường, vai trò → tên biến .env, công cụ quản lý lỗi, người duyệt
  trang-thai.md        # bảng tiến độ từng trang qua các bước
  nguon/*.txt          # tài liệu đã chuyển sang văn bản (sinh bởi doc-tai-lieu.py)
  yeu-cau/<trang>.yaml # yêu cầu + điều kiện kiểm thử (skill 1)
  kham-pha/<trang>.md  # ghi chép khám phá giao diện (skill 2)
  testcase/<trang>.yaml# NGUỒN testcase duy nhất (skill 2)
  review/<trang>.md    # phát hiện khi review (skill 3)
  ket-qua/<trang>.yaml # kết quả chạy (sinh bởi ket-qua.py)
  excel/<trang>.xlsx   # sinh bởi xuat-excel.py — không sửa tay
  loi/<trang>.md       # bản nháp lỗi và mã lỗi đã tạo (skill 6)
```
`<trang>`: tên không dấu, nối gạch (vd `nguoi-dung`). Mỗi trang có **mã** 2–4 chữ in hoa (vd `USR`).

## 2. Mã định danh (không bao giờ đổi mã cũ, không dùng lại mã đã xóa)
- Yêu cầu: `USR-R01`; điều kiện: `USR-R01.1`.
- Testcase: `USR-<nhóm><số>`; nhóm: L xem/tìm/lọc, V chi tiết, C thêm, E sửa, D xóa, T trạng thái/luồng, Q phân quyền, B bảo mật, G biên/lỗi, H hiệu năng. Vd `USR-C03`.
- Kịch bản tự động: tên test bắt đầu bằng mã testcase: `test('USR-C03 Bỏ trống email', …)`.

## 3. Cấu trúc YAML
`yeu-cau/<trang>.yaml`
```yaml
trang: nguoi-dung
ma: USR
yeu_cau:
  - id: USR-R01
    nguon: "UC.xlsx dòng 20"          # để truy lại nguyên văn
    noi_dung: "Thêm mới người dùng…"  # nguyên văn, ngắn gọn
    rui_ro: Cao                       # Cao | Trung bình | Thấp
    van_de: ["Mơ hồ: …"]              # tùy chọn
    dieu_kien:
      - {id: USR-R01.1, mo_ta: "Bỏ trống email bị chặn"}
      - {id: USR-R01.2, mo_ta: "Hiệu năng", na: "Dự án không yêu cầu"}  # na = không áp dụng
cau_hoi_ba: ["…"]
```
`testcase/<trang>.yaml`
```yaml
trang: nguoi-dung
ma: USR
testcase:
  - id: USR-C03
    dieu_kien: [USR-R01.1]
    tieu_de: "Bỏ trống email khi thêm người dùng"
    loai: Kiểm tra nhập   # Chức năng | Kiểm tra nhập | Nghiệp vụ | Phân quyền | Bảo mật | Giao diện | Hiệu năng
    uu_tien: Cao          # Cao | Trung bình | Thấp
    nguon: Cả hai         # Yêu cầu | Giao diện | Cả hai
    vai_tro: QUAN_TRI     # tên vai trò trong boi-canh.md, không ghi tài khoản
    tien_dieu_kien: "…"
    du_lieu: "…"
    buoc: ["Mở trang Người dùng", "Bấm Thêm mới", "…"]
    mong_doi: ["Hiện thông báo \"Email là bắt buộc\"", "Không tạo bản ghi (kiểm qua API)"]
    tu_dong: true         # hoặc "Thủ công: <lý do>"
    ghi_chu: "Khảo sát: … → nghi lỗi"   # tùy chọn
```

## 4. Kiểm tra bằng công cụ (thay cho tự đọc, tiết kiệm token)
- `python3 $S/doc-tai-lieu.py qa <tệp…>` — chuyển .docx/.xlsx/.pdf/.md sang `qa/nguon/*.txt`, **một lần**.
- `python3 $S/kiem-tra.py qa [trang]` — kiểm cấu trúc, mã trùng, điều kiện thiếu testcase, testcase mồ côi.
- `python3 $S/xuat-excel.py qa [trang]` — sinh Excel testcase + truy vết + kết quả.
- `python3 $S/ket-qua.py <báo-cáo-playwright.json> qa` — ghi kết quả chạy theo mã testcase, in tóm tắt.
- Cần `pip install pyyaml openpyxl`. Thiếu thì báo người dùng, không tự cài toàn hệ thống.

## 5. Tiết kiệm token
1. **Một lần chạy = một trang.** Chỉ đọc `trang-thai.md` và file của trang đó.
2. Tài liệu: tìm bằng `grep -n` trong `qa/nguon/`, đọc đúng đoạn cần (`Read` có offset/limit); không đọc cả tài liệu.
3. Giao diện: dùng ảnh chụp cấu trúc trợ năng (`page.locator('body').ariaSnapshot()` hoặc snapshot của công cụ trình duyệt), không dán HTML, chỉ chụp ảnh khi cần làm bằng chứng.
4. Việc xác định được (kiểm tra, đếm, xuất Excel, tổng hợp) → dùng công cụ ở mục 4, chỉ đọc phần tóm tắt.
5. Sửa file bằng `Edit` từng đoạn; không ghi lại cả file lớn; không đọc lại file vừa ghi.
6. Không lặp lại nội dung tài liệu trong câu trả lời; báo cáo cho người dùng chỉ gồm số liệu, vấn đề, việc cần duyệt.
7. Vòng lặp sửa có giới hạn (mỗi skill ghi rõ); vượt giới hạn thì dừng và báo.

## 6. An toàn
- Chỉ thao tác trên môi trường ghi trong `boi-canh.md`; **cấm môi trường thật (production)**.
- Tài khoản/mật khẩu/token chỉ đọc từ biến môi trường; không ghi vào file, testcase, báo cáo, nhật ký, câu trả lời.
- Dữ liệu do AI tạo có tiền tố `QA_AUTO_` và phải được dọn; không xóa/sửa dữ liệu không do AI tạo.
- Tạo lỗi trên công cụ quản lý lỗi và mọi thao tác ra bên ngoài: **chỉ sau khi người dùng duyệt**.

## 7. Chất lượng
- Hệ thống chạy sai yêu cầu → testcase vẫn viết theo hành vi đúng, ghi `ghi_chu: "Khảo sát: … → nghi lỗi"`. Không hạ kỳ vọng theo giao diện.
- Quy tắc chưa rõ → ghi "cần BA xác nhận" vào `cau_hoi_ba`, không tự đoán.
- Kết quả mong đợi phải kiểm chứng được (thông báo cụ thể, giá trị, số bản ghi). Một testcase kiểm một điều.
- Không tuyên bố "đủ độ phủ" khi `kiem-tra.py` còn báo thiếu.
- Cuối mỗi skill: cập nhật `trang-thai.md` (ô của bước + ngày) và báo bước tiếp theo.
