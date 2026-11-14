---
name: qa-1-yeu-cau
description: Bước 1 QA — đọc tài liệu yêu cầu (SRS/UC/BRD), gán mã, phát hiện chỗ thiếu/mơ hồ/mâu thuẫn, phân rã thành điều kiện kiểm thử cho một trang. Dùng khi "phân tích yêu cầu trang X", "đánh giá tài liệu".
---
# Bước 1 – Phân tích yêu cầu

Đọc `.claude/skills/qa-quy-trinh/QUY-UOC.md` nếu chưa đọc trong phiên. Phạm vi: **một trang**.

## Đầu vào
`qa/boi-canh.md`, tài liệu yêu cầu. Chưa có `qa/nguon/` → chạy `doc-tai-lieu.py` một lần.

## Các bước
1. `grep -n` tên trang/chức năng/mã UC trong `qa/nguon/`; đọc đúng các đoạn liên quan, kể cả cột ghi chú, quy tắc nghiệp vụ, thông báo lỗi, phân quyền ở mục khác.
2. Mỗi dòng UC / câu yêu cầu = một yêu cầu: ghi `id`, `nguon` (tệp + dòng/mục), `noi_dung` nguyên văn ngắn, `rui_ro` (Cao: tiền/quyền/dữ liệu/luồng chính; Thấp: hiển thị).
3. Ghi `van_de` khi: thiếu thông tin, mơ hồ (nhiều cách hiểu), mâu thuẫn với mục khác, không kiểm thử được. Câu cần BA trả lời → `cau_hoi_ba`.
4. Phân rã mỗi yêu cầu thành điều kiện kiểm thử. Chỉ xét các khía cạnh **áp dụng được**:
   - đầu vào: bắt buộc, định dạng, độ dài/biên, giá trị đặc biệt, trùng;
   - nghiệp vụ: phụ thuộc, tính toán, chặn theo trạng thái/tham chiếu;
   - trạng thái và luồng: chuyển trạng thái, hủy, xác nhận, thao tác lặp, đối tượng không tồn tại;
   - phân quyền theo vai trò, truy cập trái phép;
   - lỗi: thông báo đúng, lỗi máy chủ, mất mạng, không lộ thông tin nội bộ;
   - hiển thị, tìm, lọc, sắp xếp, phân trang, xuất tệp;
   - phi chức năng chỉ khi `boi-canh.md` có ghi.
   Khía cạnh liên quan nhưng không áp dụng → điều kiện có `na: "<lý do>"`.
5. Đoán lỗi theo dự án: với mỗi yêu cầu rủi ro Cao, hỏi "ở hệ thống này điều gì dễ sai mà chưa có điều kiện?" → thêm điều kiện.
6. Ghi `qa/yeu-cau/<trang>.yaml` theo mẫu quy ước, chạy `kiem-tra.py qa <trang>` để kiểm cấu trúc (lúc này báo "thiếu testcase" là bình thường).

## Tự kiểm trước khi kết thúc
- Mọi yêu cầu có ít nhất một điều kiện (hoặc `na`), có `nguon` truy lại được.
- Mỗi điều kiện kiểm một điều, mô tả đủ để viết kết quả mong đợi.
- Không bịa quy tắc không có trong tài liệu; chỗ chưa rõ nằm ở `cau_hoi_ba`.

## Báo cáo (ngắn)
Số yêu cầu / điều kiện / `na`; số vấn đề theo loại; danh sách câu hỏi BA; bước tiếp: `qa-2-testcase`.
