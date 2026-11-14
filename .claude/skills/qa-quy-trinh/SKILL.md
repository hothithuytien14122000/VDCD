---
name: qa-quy-trinh
description: Điều phối quy trình QA khép kín (yêu cầu → testcase → review → kịch bản tự động → chạy → lỗi). Dùng khi bắt đầu dự án QA mới, hỏi "đang ở bước nào", "làm tiếp", hoặc muốn chạy cả luồng cho một trang.
---
# Điều phối quy trình QA

Đọc `.claude/skills/qa-quy-trinh/QUY-UOC.md` (quy ước chung) rồi làm theo các bước sau.

## Các bước
| Bước | Skill | Đầu vào | Đầu ra | Cổng chuyển bước |
|---|---|---|---|---|
| 1 | `qa-1-yeu-cau` | tài liệu | `yeu-cau/<trang>.yaml` | mọi yêu cầu có điều kiện hoặc `na` |
| 2 | `qa-2-testcase` | bước 1 + web | `testcase/<trang>.yaml`, `kham-pha/` | `kiem-tra.py` sạch |
| 3 | `qa-3-review` | bước 1, 2 | `review/<trang>.md` | không còn mục Nghiêm trọng/Lớn → **người dùng duyệt** |
| 4 | `qa-4-kich-ban` | testcase đã duyệt | kịch bản Playwright | mọi testcase tự động có kịch bản chạy được |
| 5 | `qa-5-chay` | kịch bản | `ket-qua/`, Excel | mọi lỗi được phân loại |
| 6 | `qa-6-loi` | lỗi ứng dụng | lỗi trên công cụ, kiểm thử lại | **người dùng duyệt** trước khi tạo |

## Cách làm
1. Chưa có `qa/boi-canh.md` → tạo từ mẫu dưới, hỏi người dùng các mục còn trống (một lần, gộp câu hỏi). Chưa có `qa/trang-thai.md` → tạo bảng: `| Trang | Mã | 1 | 2 | 3 | Duyệt | 4 | 5 | 6 |`.
2. Đọc `trang-thai.md`, chọn trang người dùng yêu cầu (hoặc trang dở dang đầu tiên); xác định bước tiếp theo theo cột trống đầu tiên.
3. Gọi skill của bước đó qua công cụ Skill. Chạy tiếp bước sau khi cổng đạt, **dừng ở cổng cần người dùng duyệt**.
4. Mỗi lần chỉ xử lý một trang. Hết trang, báo ngắn: đã xong bước nào, số liệu, việc cần người dùng làm.

## Mẫu `qa/boi-canh.md`
```markdown
- Ứng dụng: <tên>, URL: <url môi trường kiểm thử>
- Môi trường được phép: <dev/staging>; cấm production
- Tài liệu: <đường dẫn SRS/UC>
- Vai trò → biến môi trường: QUAN_TRI → QA_ADMIN_USER/QA_ADMIN_PASS; …
- Đăng nhập: <form thường / SSO / OTP>; lưu phiên: <đường dẫn storageState>
- Thư mục kịch bản: <tests/>; lệnh chạy: <npx playwright test>
- API: <url gốc API nếu có>
- Công cụ quản lý lỗi: <GitLab dự án X / Jira / không>
- Người duyệt: <tên vai trò>
- Phi chức năng quan tâm: <bảo mật, hiệu năng… / không>
```
