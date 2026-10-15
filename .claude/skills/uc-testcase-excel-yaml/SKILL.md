---
name: uc-testcase-excel-yaml
description: Sinh bộ Test Case từ tài liệu UC/SRS và xuất 2 file nhất quán — YAML có cấu trúc (đầu vào cho sinh/chạy automation Playwright) và Excel 5 cột (ID, Title, Điều kiện tiên quyết, Step, Kết quả mong đợi). Dùng bất cứ khi nào người dùng yêu cầu tạo/viết/sinh test case, "tạo TC", xuất TC ra Excel hoặc YAML, hay kiểm tra độ bao phủ requirement cho một UC/SRS, kể cả khi chỉ nêu tên UC hoặc tên chức năng.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, AskUserQuestion
argument-hint: "<đường dẫn UC/SRS>"
---

# UC/SRS → Test Case (YAML + Excel)

YAML là nguồn sự thật duy nhất; Excel luôn được script render từ YAML. Nhờ vậy ID và nội dung hai file không thể lệch nhau, và khi sửa TC chỉ sửa một chỗ.

## Đầu ra

| File | Thư mục | Ghi chú |
|---|---|---|
| `<slug>-test-cases.yaml` | `Testcase/` | schema: `references/yaml-schema.md` |
| `<slug>-test-cases.xlsx` | `TC-xlsx/` | đúng 5 cột, không thêm cột |

`<slug>` lấy từ tên UC, vd. `uc4-1-quan-ly-don-vi-hanh-chinh-cap-tinh`. Tạo thư mục nếu chưa có.

## Quy trình

1. **Đọc toàn bộ UC/SRS** trước khi viết TC: actor, pre/post-condition, các flow, bảng field, business rule, message, phân quyền, trạng thái. Đọc thiếu thì TC thiếu và expected bị đoán.
2. **Lập `requirements`** (mỗi BR, flow, field ràng buộc, message, quyền). Chỗ UC ghi "[Cần xác nhận]" hoặc mơ hồ → `status: needs_confirmation` và thêm `open_questions`, không tự chốt.
3. **Chọn kỹ thuật theo từng chức năng** — đọc `references/techniques.md`. Chỉ áp kỹ thuật khi UC có căn cứ (vd. BVA chỉ khi UC nêu giới hạn).
4. **Viết TC**: một mục tiêu mỗi TC; dữ liệu nhập cụ thể; expected kiểm chứng được và lấy từ UC. Không có căn cứ → `expected.status: needs_confirmation` + `open_questions`.
5. **Ánh xạ automation**: URL (`base_url`) và credential lấy từ file `.env` của dự án, ghi trong YAML dạng `${env:TÊN_BIẾN}`, không hard-code; thiếu `.env` thì ghi vào blockers. `target` là tên logic (`btn_add`). Chỉ điền locator/endpoint khi tài liệu hoặc cấu hình dự án cung cấp; không thì `value: null, status: missing`, và ghi `automation.blockers`. Tham khảo `assets/example.yaml`.
6. **Chạy script** (validate + coverage + render Excel), sửa YAML tới khi không còn lỗi:
   ```bash
   python3 -I .claude/skills/uc-testcase-excel-yaml/scripts/build_outputs.py Testcase/<slug>-test-cases.yaml --xlsx TC-xlsx/<slug>-test-cases.xlsx
   ```
   Thiếu thư viện: `pip install openpyxl pyyaml`.
7. **Rà cảnh báo**: requirement chưa có TC, TC trùng, expected chưa chắc chắn.
8. **Báo cáo cho người dùng**: số TC theo loại, requirement chưa bao phủ và lý do, `open_questions`, thông tin còn thiếu để sinh automation (base URL, locator, tài khoản test, endpoint, dữ liệu seed).

## Nguyên tắc

- **Không bịa** BR, message, locator, endpoint hay hành vi hệ thống — TC dựa trên thứ không có thật sẽ làm automation sai và che mất lỗ hổng của tài liệu. Thiếu căn cứ thì đánh dấu.
- **ID ổn định** `TC_<UCID>_<NNN>`; cập nhật không đánh lại số, TC mới nối tiếp số lớn nhất, để lịch sử và script automation không vỡ.
- **Không sửa tay Excel**; sửa YAML rồi render lại.
- Tối thiểu có: Main flow (positive), mỗi Alternative/Exception flow, và mỗi BR có ≥1 TC hoặc nằm trong `open_questions`.
- Nội dung theo ngôn ngữ UC (tiếng Việt có dấu).

## Chế độ tiết kiệm token (mặc định nên dùng)

Chi phí chính là phần chữ phải viết cho từng TC, không phải skill hay script. Vì vậy:

1. **Không viết YAML tay.** Viết 1 generator Python ngắn ở ngoài repo (vd. `/tmp/gen/<uc>.py`) dùng `scripts/tcgen.py`
   (`req`, `oq`, `s`, `tc`, `tc_table`, `dump`), rồi chạy `PYTHONPATH=.claude/skills/uc-testcase-excel-yaml/scripts python3 /tmp/gen/<uc>.py`.
   Locator, ID, anchor YAML do thư viện lo.
2. **Nhân bảng, đừng nhân tay.** Các TC chỉ khác dữ liệu (trạng thái x vai trò, biên độ dài, từng message lỗi, hộp thoại
   Hủy/Xác nhận) → 1 mẫu + `tc_table(uc, tmpl, rows)`. Số TC không đổi, token giảm nhiều nhất.
3. **Dùng lại bước chung.** Khai báo 1 lần các list bước lặp (mở menu, mở hộp thoại, xác nhận) rồi nối `OPEN + [...]`.
4. **Độ sâu theo rủi ro.** Luôn đủ: luồng chính, mỗi AF/EF, phân quyền, chuyển trạng thái, từng message lỗi, biên có số trong UC.
   Giảm: hộp thoại xác nhận đơn giản (1 chính + 1 lỗi + 1 quyền), kiểm tra giao diện tĩnh (gộp 1 TC), cặp biên gần giống (1 TC nhiều bước).
   Không gộp: nhiều lỗi vào 1 TC, positive với negative, các tổ hợp bảng quyết định.
5. **Đọc SRS theo đoạn**: chỉ đọc UC cần làm; trích sang text 1 lần, dùng offset/limit; mỗi lượt chạy 1 UC.
6. **Báo cáo ngắn**: chỉ số TC theo loại, requirement chưa bao phủ, open_questions, thông tin thiếu cho automation.
7. Sau khi gộp/giảm, **luôn chạy lại `build_outputs.py`**: danh sách "Requirement chưa có TC" phải rỗng (trừ mục nằm trong open_questions).
