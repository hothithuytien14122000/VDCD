---
name: qa-2-testcase
description: Bước 2 QA — khám phá web thực tế bằng Playwright rồi viết testcase YAML cho một trang, bám điều kiện ở bước 1 và hành vi thực; xuất Excel. Dùng khi "tạo/bổ sung testcase trang X", "sửa testcase theo review".
---
# Bước 2 – Khám phá web và viết testcase

Đọc `.claude/skills/qa-quy-trinh/QUY-UOC.md` nếu chưa đọc. Phạm vi: **một trang**. Cần `qa/yeu-cau/<trang>.yaml`; chưa có → làm `qa-1-yeu-cau` trước.

## A. Khám phá (bỏ qua nếu `kham-pha/<trang>.md` đã có và giao diện không đổi)
1. Đăng nhập bằng biến môi trường theo vai trò (lưu phiên một lần, dùng lại). Chỉ trên môi trường cho phép.
2. Mở trang, lấy cấu trúc bằng ariaSnapshot/snapshot công cụ trình duyệt. Ghi nhận: cột, bộ lọc, nút, menu, biểu mẫu (trường bắt buộc, định dạng, độ dài tối đa), hộp thoại, thông báo lỗi thực tế, trạng thái rỗng, phân trang.
3. Thử có kiểm soát: gửi biểu mẫu trống/sai để lấy thông báo thật; nếu có API, ghi mã phản hồi khi dữ liệu sai, mã không tồn tại, không có phiên. Dữ liệu tạo ra có tiền tố `QA_AUTO_`, dọn ngay sau khi thử.
4. Kiểm phân quyền: mở trang bằng từng vai trò liên quan, ghi thấy/không thấy nút nào.
5. Ghi `kham-pha/<trang>.md` **ngắn gọn** (gạch đầu dòng, không dán snapshot thô). Ghi rõ chỗ lệch yêu cầu.

## B. Viết testcase
1. Mỗi điều kiện (không có `na`) có ít nhất một testcase. Đối chiếu với giao diện:
   | Tình huống | Cách xử lý |
   |---|---|
   | Yêu cầu có, giao diện có | Viết theo yêu cầu, dùng tên nút/thông báo thật, `nguon: Cả hai` |
   | Yêu cầu có, giao diện không có | Vẫn viết, `ghi_chu: "Khảo sát: không có … → nghi lỗi"` |
   | Giao diện có, yêu cầu không có | Thêm điều kiện mới vào bước 1 (`van_de: "chỉ thấy trên giao diện"`), viết testcase `nguon: Giao diện`, thêm câu hỏi BA |
   | Mâu thuẫn | Viết theo yêu cầu, ghi chênh lệch vào `ghi_chu`, thêm câu hỏi BA |
2. `buoc` đánh số ngầm theo danh sách, mỗi bước một thao tác; `mong_doi` kiểm chứng được; một testcase kiểm một điều; tự tạo dữ liệu, không phụ thuộc testcase khác.
3. `tu_dong: true` mặc định; thủ công khi cần OTP/email thật/đánh giá bằng mắt → ghi lý do.
4. Sửa theo review: đọc `review/<trang>.md`, sửa từng mục, đánh dấu `[đã sửa]` cạnh mục đó. Không đổi mã cũ.

## C. Kiểm tra (tối đa 3 vòng)
`python3 $S/kiem-tra.py qa <trang>` → sửa đến khi sạch → `python3 $S/xuat-excel.py qa <trang>`.

## Tự kiểm
- Không có kỳ vọng nào bị hạ theo hành vi sai của giao diện.
- Không có tài khoản/mật khẩu trong file. Dữ liệu `QA_AUTO_` đã dọn.

## Báo cáo (ngắn)
Số testcase theo loại, số thủ công + lý do, số chỗ nghi lỗi, câu hỏi BA mới; bước tiếp: `qa-3-review`.
