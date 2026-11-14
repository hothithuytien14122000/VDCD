---
name: qa-3-review
description: Bước 3 QA — review độc lập testcase của một trang: tìm thiếu, trùng, mơ hồ, kỳ vọng không kiểm chứng được; ghi phát hiện có mức độ, không tự sửa. Dùng khi "review testcase trang X", "testcase đã đủ chưa".
---
# Bước 3 – Review testcase độc lập

Đọc `.claude/skills/qa-quy-trinh/QUY-UOC.md` nếu chưa đọc. Phạm vi: **một trang**.

## Cách chạy để đảm bảo độc lập
Giao việc review cho **một tác tử con mới** (công cụ Agent) với lời giao việc gồm: đường dẫn `qa/yeu-cau/<trang>.yaml`, `qa/testcase/<trang>.yaml`, `qa/kham-pha/<trang>.md`, đoạn tài liệu gốc liên quan trong `qa/nguon/`, và nguyên văn mục "Tiêu chí" + "Định dạng" bên dưới. **Không** đưa nhận xét hay kết luận của bước 2. Không có công cụ Agent → tự review, chỉ dựa trên các file trên.

## Tiêu chí
1. Chạy `kiem-tra.py qa <trang>`: điều kiện thiếu testcase, testcase mồ côi, mã trùng.
2. Đối chiếu tài liệu gốc với `yeu-cau`: yêu cầu bị bỏ sót, điều kiện bị bỏ sót, `na` không hợp lý.
3. Với từng yêu cầu rủi ro Cao: đường chính, đường thay thế, dữ liệu sai, biên, phân quyền, trạng thái, lỗi đã được xét chưa. **Không** đòi thêm loại không áp dụng.
4. Từng testcase: bước rõ, làm lại được; kết quả mong đợi đủ cụ thể để kết luận đạt/không đạt; kiểm một điều; dữ liệu tự tạo; trùng với testcase khác.
5. Kỳ vọng có bị hạ theo giao diện sai không (so với tài liệu).
6. Đoán lỗi độc lập: 3–5 tình huống dễ sai nhất ở trang này chưa có testcase.

## Định dạng `qa/review/<trang>.md`
```markdown
# Review <trang> – <ngày>
Tổng: <n> phát hiện (Nghiêm trọng a, Lớn b, Nhỏ c)
| # | Mức | Loại | Mã liên quan | Vấn đề | Đề xuất |
```
Mức: **Nghiêm trọng** (bỏ sót yêu cầu rủi ro cao, kỳ vọng sai), **Lớn** (thiếu điều kiện, kỳ vọng không kiểm chứng được), **Nhỏ** (diễn đạt, trùng nhẹ). Loại: Thiếu | Trùng | Mơ hồ | Sai kỳ vọng | Truy vết.

## Sau review
- Không sửa `testcase/` hay `yeu-cau/`. Còn Nghiêm trọng/Lớn → quay lại `qa-2-testcase` (tối đa 2 vòng review, sau đó báo người dùng).
- Không còn → ghi `trang-thai.md` cột 3, xin **người dùng duyệt**; khi người dùng đồng ý, ghi cột Duyệt (ngày + người duyệt).

## Báo cáo (ngắn)
Số phát hiện theo mức, 3 vấn đề quan trọng nhất, đề nghị duyệt hay sửa tiếp.
