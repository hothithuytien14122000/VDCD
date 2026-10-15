# Chọn kỹ thuật thiết kế TC

Mục lục: Technique · Khi nào dùng · Cách sinh TC

| Technique (`techniques`) | Khi nào dùng | Cách sinh TC |
|---|---|---|
| `UC_FLOW` | Mọi UC | 1 TC cho Main flow; mỗi Alternative/Exception flow ít nhất 1 TC |
| `EP` | Field có kiểu/định dạng/tập giá trị | 1 TC cho mỗi lớp hợp lệ và mỗi lớp không hợp lệ (rỗng, sai định dạng, ký tự đặc biệt, khoảng trắng đầu/cuối nếu UC đề cập) |
| `BVA` | UC nêu độ dài/khoảng giá trị | min-1, min, min+1, max-1, max, max+1. Không có giới hạn trong UC → không đoán, ghi `open_questions` |
| `DT` | Kết quả phụ thuộc nhiều điều kiện (vd. xóa khi đang được tham chiếu × trạng thái) | Lập bảng điều kiện → mỗi tổ hợp có kết quả khác nhau là 1 TC |
| `ST` | Có trường trạng thái | TC cho mỗi chuyển đổi UC cho phép, và chuyển đổi bị cấm nếu UC nêu |
| `PERM` | UC có actor/quyền | Có quyền, không có quyền, chưa đăng nhập/hết phiên (nếu UC mô tả) |
| `ERR` | UC mô tả lỗi hệ thống, hủy thao tác, trùng dữ liệu | TC kích hoạt từng tình huống, kiểm message theo UC |

Bao gồm khi phù hợp: dữ liệu thiếu (bắt buộc bỏ trống), sai định dạng, trùng (không phân biệt hoa thường nếu BR nói vậy), tìm kiếm không có kết quả, phân trang, xuất file.

`type` của TC: positive | negative | boundary | permission | state_transition | decision_table | error_handling | ui.

Kiểm tra trùng: hai TC cùng mục tiêu và cùng dữ liệu là trùng — gộp lại. Script cảnh báo trùng chính xác theo title + steps; phần trùng về ý nghĩa cần tự rà.
