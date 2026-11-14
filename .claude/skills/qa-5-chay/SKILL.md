---
name: qa-5-chay
description: Bước 5 QA — chạy kịch bản tự động theo trang/nhóm, ghi kết quả theo mã testcase, phân loại nguyên nhân thất bại, xuất Excel và báo cáo. Dùng khi "chạy test trang X", "báo cáo kết quả".
---
# Bước 5 – Chạy và báo cáo

Đọc `.claude/skills/qa-quy-trinh/QUY-UOC.md` nếu chưa đọc.

## Các bước
1. **Kiểm tra môi trường** trước: URL mở được, đăng nhập được bằng từng vai trò cần dùng. Không đạt → dừng, báo "Lỗi môi trường", không chạy cả bộ.
2. Chạy, ghi báo cáo JSON ra file (không đọc nhật ký đầy đủ):
   `PLAYWRIGHT_JSON_OUTPUT_NAME=qa/ket-qua/_raw.json npx playwright test <phạm vi> --reporter=line,json --trace=retain-on-failure --screenshot=only-on-failure`
3. `python3 $S/ket-qua.py qa/ket-qua/_raw.json qa` → ghi `ket-qua/<trang>.yaml`, in tóm tắt và danh sách thất bại.
4. Phân loại **từng** testcase Không đạt (đọc thông báo lỗi; cần thì xem ảnh/trace của riêng test đó), ghi `nguyen_nhan` trong `ket-qua/<trang>.yaml`:
   | Nguyên nhân | Dấu hiệu |
   |---|---|
   | Lỗi ứng dụng | ứng dụng làm sai yêu cầu, lặp lại được |
   | Lỗi kịch bản | không tìm thấy phần tử do định vị/chờ sai, kỳ vọng viết sai |
   | Lỗi môi trường | hết phiên, máy chủ không phản hồi, 5xx hàng loạt, mạng |
   | Lỗi dữ liệu | dữ liệu tiền đề thiếu/bị test khác sửa |
   Nghi ngờ chập chờn → chạy lại riêng test đó **một lần**. Không chắc → ghi `nguyen_nhan: "Cần người xác nhận"`.
5. `python3 $S/xuat-excel.py qa <trang>`; xóa `_raw.json`.
6. Lỗi kịch bản → chuyển `qa-4-kich-ban`; lỗi ứng dụng → `qa-6-loi`.

## Báo cáo (ngắn)
| Tổng | Đạt | Không đạt | Bị chặn | Bỏ qua | Tỉ lệ đạt |
Danh sách Không đạt: mã – nguyên nhân – một dòng mô tả; đường dẫn Excel; testcase tự động chưa có kết quả.
