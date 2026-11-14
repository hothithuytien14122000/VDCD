---
name: qa-4-kich-ban
description: Bước 4 QA — sinh kịch bản tự động Playwright + TypeScript từ testcase YAML đã duyệt của một trang, mỗi test gắn mã testcase, chạy thử đến khi ổn định. Dùng khi "viết kịch bản tự động trang X", "sinh automation".
---
# Bước 4 – Sinh kịch bản tự động

Đọc `.claude/skills/qa-quy-trinh/QUY-UOC.md` nếu chưa đọc. Phạm vi: **một trang**.

## Cổng vào
`trang-thai.md` có cột Duyệt cho trang này. Chưa duyệt → dừng, báo người dùng.

## Chuẩn bị (một lần mỗi dự án)
- Đọc cấu trúc kịch bản sẵn có (thư mục, cấu hình Playwright, hàm dùng chung) và **tái sử dụng**; chỉ tạo mới khi chưa có:
  - cấu hình đọc URL/tài khoản từ biến môi trường; lưu phiên đăng nhập theo vai trò (storageState);
  - **chốt phiên**: trước mỗi test kiểm tra vẫn đăng nhập, hết phiên thì test thất bại rõ ràng, không được đạt giả;
  - hàm tạo/dọn dữ liệu `QA_AUTO_` qua API nếu có (nhanh và ổn định hơn qua giao diện);
  - Page Object cho trang có nhiều testcase.

## Viết kịch bản
1. Lấy testcase `tu_dong: true` của trang. Testcase thiếu thông tin để tự động → không viết, ghi `ghi_chu` lý do và liệt kê trong báo cáo.
2. Một `test()` cho một testcase, tên bắt đầu bằng mã: `test('USR-C03 <tiêu đề>', …)`. Gom theo `test.describe('<trang>')`.
3. Định vị theo vai trò/nhãn/văn bản thấy được (`getByRole`, `getByLabel`, `getByText`), tránh CSS/XPath theo vị trí.
4. Mỗi mục `mong_doi` có một khẳng định tương ứng; kiểm dữ liệu qua API khi kỳ vọng là "lưu/không lưu".
5. Mỗi test độc lập: tự tạo dữ liệu, dọn trong `afterEach`/`afterAll`, chạy riêng lẻ được.
6. Testcase bị chặn bởi lỗi đã biết → `test.skip(true, 'Bị chặn: <mã lỗi>')`.

## Chạy thử (tiết kiệm token)
`npx playwright test <tệp> --reporter=line` ; chỉ đọc lỗi của test thất bại. Mỗi test sửa **tối đa 3 lần**:
- lỗi do kịch bản (định vị, chờ, dữ liệu) → sửa;
- ứng dụng chạy sai yêu cầu → **không** sửa kỳ vọng cho khớp; để thất bại, ghi chú để bước 5 phân loại;
- quá 3 lần → `test.fixme`, ghi lý do.

## Báo cáo (ngắn)
Số testcase tự động có kịch bản / không viết được (lý do) / fixme; tệp đã tạo; bước tiếp: `qa-5-chay`.
