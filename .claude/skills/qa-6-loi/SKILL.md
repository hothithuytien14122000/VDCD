---
name: qa-6-loi
description: Bước 6 QA — soạn và tạo lỗi trên công cụ quản lý lỗi (GitLab/Jira) từ testcase Không đạt do lỗi ứng dụng, chỉ sau khi người dùng duyệt; kiểm thử lại khi lỗi đã sửa. Dùng khi "log bug", "tạo issue", "retest lỗi".
---
# Bước 6 – Ghi nhận lỗi và kiểm thử lại

Đọc `.claude/skills/qa-quy-trinh/QUY-UOC.md` nếu chưa đọc. Công cụ quản lý lỗi lấy từ `boi-canh.md`; tìm công cụ kết nối tương ứng (vd tìm "gitlab", "jira" bằng ToolSearch). Không có → chỉ soạn bản nháp.

## A. Ghi lỗi
1. Lấy testcase có `nguyen_nhan: Lỗi ứng dụng` trong `ket-qua/<trang>.yaml` chưa có `ma_loi`.
2. Gộp các testcase cùng một nguyên nhân gốc thành một lỗi.
3. **Tìm trùng** trên công cụ theo từ khóa chính + tên trang. Trùng → đề xuất bình luận bổ sung thay vì tạo mới.
4. Soạn vào `qa/loi/<trang>.md`, mỗi lỗi:
   - Tiêu đề: `[<Trang>] <hành vi sai> khi <thao tác>`
   - Môi trường, vai trò (tên vai trò, không ghi tài khoản), mã testcase, mã yêu cầu + nguồn tài liệu
   - Bước tái hiện (đánh số), Kết quả thực tế, Kết quả mong đợi (trích tài liệu)
   - Mức độ: Nghiêm trọng / Cao / Trung bình / Thấp; bằng chứng (đường dẫn ảnh/trace)
5. Trình người dùng **bảng tóm tắt** (tiêu đề, mức độ, tạo mới/bình luận). Chỉ tạo sau khi người dùng đồng ý, đúng các mục được đồng ý.
6. Ghi `ma_loi` vào `ket-qua/<trang>.yaml` và `qa/loi/<trang>.md`. Testcase liên quan trong kịch bản: cân nhắc `test.skip(true, 'Bị chặn: <mã lỗi>')` nếu chặn các test khác (hỏi người dùng).

## B. Kiểm thử lại (khi người dùng báo lỗi đã sửa)
1. Chạy lại testcase gắn `ma_loi` đó + các testcase cùng điều kiện/yêu cầu (hồi quy lân cận): `npx playwright test -g "<mã1>|<mã2>"`.
2. `ket-qua.py` cập nhật kết quả. Đạt → đề xuất bình luận "đã kiểm thử lại, đạt" và đóng lỗi (cần người dùng đồng ý); vẫn sai → đề xuất bình luận kèm bằng chứng mới.
3. Gỡ `test.skip` "Bị chặn" tương ứng.

## Báo cáo (ngắn)
Số lỗi soạn / đã tạo / trùng; danh sách mã lỗi; kết quả kiểm thử lại.
