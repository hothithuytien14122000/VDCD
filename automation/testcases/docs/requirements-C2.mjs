// TRUY VẾT PHÂN HỆ C (phần 2/3): yêu cầu → điều kiện kiểm thử → testcase RES-T/A/F/U/D/Y/J/X.
// Nguồn: SRS UC1.3-UC1.7 (+ khảo sát UI/API) và UC_1409 dòng 206-226 (C.I.4-C.I.7).
export default (R) => [
  // ================= UC_1409: C.I.4 Trình phê duyệt (dòng 207-210) =================
  R('RES', 'C.UC1.3', 207, 'Cán bộ, CB địa phương có thể trình phê duyệt kết quả tự đánh giá định kỳ của đơn vị mình', [
    ['Trình duyệt kỳ định kỳ', 'RES-T03'], ['Vòng đời đầy đủ kỳ định kỳ', 'RES-Y18'],
  ]),
  R('RES', 'C.UC1.3', 208, 'Cán bộ, CB địa phương có thể trình phê duyệt kết quả tự đánh giá đột xuất của đơn vị mình', [
    ['Cán bộ trình thành công', 'RES-T01'], ['CB địa phương trình thành công', 'RES-T02'], ['Vòng đời đầy đủ kỳ đột xuất', 'RES-Y01'],
  ]),
  R('RES', 'C.UC1.3', 209, 'Cán bộ, CB địa phương xem danh sách trình phê duyệt kết quả định kỳ của đơn vị mình', [
    ['Danh sách cần xử lý kỳ định kỳ', 'RES-T34'],
  ]),
  R('RES', 'C.UC1.3', 210, 'Cán bộ, CB địa phương xem danh sách trình phê duyệt kết quả đột xuất của đơn vị mình', [
    ['Danh sách cần xử lý kỳ đột xuất', 'RES-T33'],
  ]),
  // ================= C.I.5 Phê duyệt (dòng 212-215) =================
  R('RES', 'C.UC1.4a', 212, 'LĐ đơn vị, LĐ địa phương xem danh sách cần phê duyệt kết quả định kỳ của đơn vị mình', [
    ['Danh sách cần phê duyệt kỳ định kỳ', 'RES-A33'],
  ]),
  R('RES', 'C.UC1.4a', 213, 'LĐ đơn vị, LĐ địa phương xem danh sách cần phê duyệt kết quả đột xuất của đơn vị mình', [
    ['Danh sách cần phê duyệt kỳ đột xuất', 'RES-A34'], ['Không lẫn kết quả ngoài phạm vi', 'RES-A35'],
  ]),
  R('RES', 'C.UC1.4a', 214, 'LĐ đơn vị, LĐ địa phương có thể phê duyệt kết quả tự đánh giá của đơn vị mình', [
    ['LĐ đơn vị phê duyệt', 'RES-A01'], ['LĐ địa phương phê duyệt', 'RES-A02'], ['Phê duyệt ngoài phạm vi bị chặn', 'RES-X12'],
    ['Cán bộ không có quyền phê duyệt', 'RES-X14'],
  ]),
  R('RES', 'C.UC1.4b', 215, 'LĐ đơn vị, LĐ địa phương có thể từ chối phê duyệt kết quả tự đánh giá của đơn vị mình', [
    ['LĐ đơn vị từ chối', 'RES-A15'], ['LĐ địa phương từ chối', 'RES-A16'],
  ]),
  // ================= C.I.6 Gửi kết quả (dòng 217-220) =================
  R('RES', 'C.UC1.5', 217, 'Cán bộ, CB địa phương xem danh sách kết quả định kỳ đã được LĐ phê duyệt', [
    ['Danh sách Đã phê duyệt kỳ định kỳ', 'RES-F42'],
  ]),
  R('RES', 'C.UC1.5', 218, 'Cán bộ, CB địa phương xem danh sách kết quả đột xuất đã được LĐ phê duyệt', [
    ['Danh sách Đã phê duyệt kỳ đột xuất', 'RES-F43'],
  ]),
  R('RES', 'C.UC1.5', 219, 'Cán bộ, CB địa phương có thể đính kèm file kết quả tự đánh giá (file ký số, file scan ký tươi) [Q: lỗi tạo tự đánh giá nên chưa test thông báo theo role]', [
    ['Đính kèm PDF ký số và gửi', 'RES-F01'], ['File scan ký tươi', 'RES-F02|RES-F17'], ['Kỳ định kỳ', 'RES-F03'],
    ['Loại tệp không phải PDF', 'RES-F08|RES-F09'], ['Dung lượng 0 byte / 20 MB / vượt 20 MB', 'RES-F10|RES-F11|RES-F12'],
    ['Chỉ một tệp, xóa và chọn lại', 'RES-F13|RES-F14|RES-F15'], ['Thiếu/sai loại file', 'RES-F16'],
    ['Tên tệp đặc biệt', 'RES-F34|RES-F35|RES-J16'], ['Thông báo theo role (TB-008)', 'RES-F41'],
    ['Chặn upload không token / không quyền / ngoài phạm vi', 'RES-X04|RES-X05|RES-X06|RES-X07'],
    ['Tải lên nhiều tệp, tệp cuối được dùng', 'RES-J14'], ['Tệp chờ còn sót sau khi gửi', 'RES-F36'], ['Hiệu năng tải 20 MB', 'RES-X32'],
  ]),
  R('RES', 'C.UC1.5', 220, 'Cán bộ, CB địa phương có thể gửi kết quả tự đánh giá của đơn vị [Q: lỗi tạo tự đánh giá nên chưa test thông báo theo role]', [
    ['Gửi thành công (Cán bộ / CB địa phương)', 'RES-F01|RES-F02'], ['Kỳ định kỳ', 'RES-F03'],
    ['Không gửi khi sai trạng thái', 'RES-F23|RES-Y09'], ['Không gửi ngoài phạm vi / không có quyền', 'RES-X13|RES-X16'],
    ['Thông báo TB-008', 'RES-F41'],
  ]),
  // ================= C.I.7 Quản lý danh sách kết quả (dòng 222-226) =================
  R('RES', 'C.UC1.7', 222, 'LĐ đơn vị, Cán bộ, LĐ địa phương, CB địa phương tìm kiếm kết quả tự đánh giá định kỳ', [
    ['Tìm kiếm kỳ định kỳ', 'RES-D48'],
  ]),
  R('RES', 'C.UC1.7', 223, 'LĐ đơn vị, Cán bộ, LĐ địa phương, CB địa phương tìm kiếm kết quả tự đánh giá đột xuất', [
    ['Tìm kiếm kỳ đột xuất', 'RES-D49'], ['Phạm vi dữ liệu danh sách', 'RES-X25|RES-X26'],
  ]),
  R('RES', 'C.UC1.7', 224, 'LĐ đơn vị, Cán bộ, LĐ địa phương, CB địa phương xem kết quả tự đánh giá [O: Đang Test]', [
    ['Mỗi vai trò mở được chi tiết trong phạm vi', 'RES-D50'], ['Xem chi tiết từ danh sách', 'RES-D01'],
    ['Xem ngoài phạm vi / không quyền', 'RES-D44|RES-X08|RES-X09|RES-X10'], ['Không đăng nhập', 'RES-X01|RES-X33'],
  ]),
  R('RES', 'C.UC1.7', 225, 'LĐ đơn vị, Cán bộ, LĐ địa phương, CB địa phương export kết quả tự đánh giá ra excel [O: Đang Test]', [
    ['Xuất Excel danh sách của Cán bộ', 'RES-D46'], ['Xuất Excel danh sách của LĐ đơn vị / LĐ địa phương', 'RES-D47'],
    ['Xuất Excel chi tiết', 'RES-D45'], ['Quyền export theo vai trò', 'RES-X34'], ['Export ngoài phạm vi', 'RES-X35'],
  ]),
  R('RES', 'C.UC1.6', 226, 'LĐ đơn vị, LĐ địa phương có thể yêu cầu mở khóa kết quả tự đánh giá để cập nhật lại thông tin, điểm [O: Đang Test]', [
    ['Xin mở khóa thành công', 'RES-U01'], ['LĐ đơn vị có nút / xin được', 'RES-U10'], ['LĐ địa phương có nút / xin được', 'RES-U11'],
    ['Cán bộ không có quyền', 'RES-U12'], ['Phân quyền nút theo trạng thái Đã gửi', 'RES-X22'],
  ]),

  // ================= SRS UC1.3 Trình duyệt =================
  R('RES', 'C.UC1.3', null, 'UC1.3 Trình duyệt kết quả: Đang chấm điểm/Bị từ chối → Chờ duyệt, Lịch sử, TB-005 (BR-1..4)', [
    ['Hộp thoại xác nhận (tiêu đề, MSG-064)', 'RES-T04|RES-T36'], ['Hủy giữ nguyên trạng thái', 'RES-T05'], ['Thông báo thành công MSG-067', 'RES-T06'],
    ['BR-1 Còn chỉ số trống → Chưa trình được / MSG-059', 'RES-T07|RES-T08|RES-T09|RES-T12|RES-J12|RES-J13'],
    ['BR-1 Điểm 0 khác ô trống; chỉ số cha không bắt buộc', 'RES-T10|RES-T11'],
    ['EF1 viền đỏ + MSG-010; chọn chỉ số mở Chấm điểm; nút Đóng', 'RES-T13|RES-T14|RES-T15'],
    ['BR-3 Lưu thay đổi chưa lưu trước khi kiểm tra', 'RES-T16|RES-J11'], ['BR-4 Trình lại kết quả Bị từ chối', 'RES-T17|RES-A30|RES-Y03'],
    ['BR-2 Chặn trình sai trạng thái / không nhảy bước', 'RES-T18|RES-T19|RES-T20|RES-Y07|RES-Y12|RES-Y20'],
    ['EF2 Kỳ đã kết thúc (MSG-061)', 'RES-T21|RES-Y13'], ['Ghi Lịch sử xử lý', 'RES-T22'],
    ['TB-005 gửi đúng người có quyền Phê duyệt', 'RES-T23|RES-T24|RES-T25|RES-X27|RES-X28'],
    ['Khóa chỉnh sửa sau trình', 'RES-T26|RES-T27|RES-Y11'], ['Lặp thao tác / đồng thời', 'RES-T28|RES-T29|RES-J10'],
    ['Lỗi 500 / mất mạng', 'RES-T30|RES-T31'], ['Trigger từ menu danh sách', 'RES-T32'], ['Id không tồn tại / sai định dạng', 'RES-T35|RES-J01'],
    ['Quyền: LĐ đơn vị không trình; ngoài phạm vi', 'RES-X11|RES-X15'], ['Phiên hết hạn', 'RES-J19'], ['Hiệu năng', 'RES-X31'],
    ['Lưu nháp giữ điểm sau F5', 'RES-Y19'], ['Điểm giữ nguyên qua các bước', 'RES-Y17'],
  ]),
  // ================= SRS UC1.4a Phê duyệt =================
  R('RES', 'C.UC1.4a', null, 'UC1.4a Phê duyệt: Chờ duyệt → Đã phê duyệt, Lịch sử, TB-006 (BR-1)', [
    ['Phê duyệt thành công (LĐ đơn vị / LĐ địa phương)', 'RES-A01|RES-A02'], ['Hộp thoại MSG-065', 'RES-A03'], ['Hủy giữ nguyên', 'RES-A04'],
    ['Thông báo MSG-068', 'RES-A05'], ['Ghi Lịch sử', 'RES-A06'], ['TB-006 tới người có quyền Gửi', 'RES-A07'],
    ['BR-1 Chỉ phê duyệt ở Chờ duyệt', 'RES-A08|RES-A09|RES-Y08'], ['Đồng thời / lặp', 'RES-A10|RES-Y16'], ['EF1 Kỳ kết thúc', 'RES-A11'],
    ['Id lạ', 'RES-A12'], ['Lỗi 500', 'RES-A13'], ['Cán bộ/CB địa phương không có quyền; ngoài phạm vi', 'RES-X14|RES-X12'],
    ['Tab cũ, Esc, Back, đồng thời hai LĐ', 'RES-J09|RES-J20|RES-J21'], ['Danh sách cần phê duyệt', 'RES-A33|RES-A34|RES-A35'],
  ]),
  // ================= SRS UC1.4b Từ chối =================
  R('RES', 'C.UC1.4b', null, 'UC1.4b Từ chối: Chờ duyệt → Bị từ chối, lý do bắt buộc ≤255 ký tự, TB-007 (BR-1..2)', [
    ['Hộp thoại Từ chối', 'RES-A14'], ['Từ chối thành công', 'RES-A15|RES-A16'], ['Thông báo MSG-069', 'RES-A17'],
    ['Lý do trống MSG-058', 'RES-A18'], ['Lý do khoảng trắng', 'RES-A19'], ['Biên 255 / 256', 'RES-A20|RES-A21|RES-A22'],
    ['Hủy sau khi nhập lý do', 'RES-A23'], ['Ghi Lịch sử kèm lý do', 'RES-A24'], ['Lý do ở thông tin bổ sung', 'RES-A25|RES-D05'],
    ['TB-007 kèm lý do', 'RES-A26'], ['HTML / ký tự đặc biệt / SQLi / Unicode / nhiều dòng', 'RES-A27|RES-J04|RES-J05|RES-J06'],
    ['Chặn sai trạng thái / lặp', 'RES-A28|RES-A29'], ['Từ chối nhiều lần', 'RES-A31'], ['Lỗi 500', 'RES-A32'],
    ['Dữ liệu sai kiểu / JSON hỏng', 'RES-J02|RES-J03'], ['Lý do dài xem đầy đủ', 'RES-D40'],
  ]),
  // ================= SRS UC1.5 Gửi Bộ =================
  R('RES', 'C.UC1.5', null, 'UC1.5 Gửi kết quả cho Bộ: Đã phê duyệt → Đã gửi, file PDF ≤20MB, Hồ sơ gửi Bộ, TB-008 (BR-1..5)', [
    ['Gửi thành công (ký số / scan)', 'RES-F01|RES-F02|RES-F17'], ['Hộp thoại MSG-066', 'RES-F04'], ['Hủy giữ nguyên', 'RES-F05'], ['Thông báo MSG-070', 'RES-F06'],
    ['BR-1 Thiếu file MSG-050', 'RES-F07|RES-J18|RES-J24'], ['BR-1 Định dạng MSG-046', 'RES-F08|RES-F09'], ['BR-1 Dung lượng MSG-047', 'RES-F10|RES-F11|RES-F12'],
    ['AF1 Xóa tệp chọn lại / một tệp', 'RES-F13|RES-F14|RES-F15'], ['BR-2 Loại file', 'RES-F16|RES-F17'],
    ['BR-3 Gửi lại phải kèm file ký số mới (MSG-063)', 'RES-F18|RES-F19|RES-F20|RES-F21'], ['BR-4 Quá hạn MSG-062', 'RES-F22'],
    ['EF4 Sai trạng thái MSG-060', 'RES-F23|RES-Y09|RES-Y12'], ['Ghi Lịch sử + Hồ sơ gửi Bộ', 'RES-F24|RES-F25|RES-D37'],
    ['BR-5 Khóa sau khi gửi', 'RES-F26'], ['Trường ngoài SRS (số hiệu, ghi chú, ngày ký)', 'RES-F27|RES-F28|RES-F29|RES-F30|RES-J17'],
    ['Tải về tệp đã gửi / URL tệp', 'RES-F31|RES-F32|RES-F33'], ['Lỗi 500 / mất mạng', 'RES-F37|RES-F38'], ['Đồng thời / chậm', 'RES-F39|RES-J15'],
    ['Id / attachmentId lạ', 'RES-F40'], ['Chu trình đánh giá lại và gửi lại', 'RES-Y06|RES-Y04'],
    ['Quyền gửi: LĐ không gửi, ngoài phạm vi', 'RES-X13|RES-X16'], ['Quyền Yêu cầu đánh giá lại', 'RES-X23'],
  ]),
  // ================= SRS UC1.6 Xin mở khóa =================
  R('RES', 'C.UC1.6', null, 'UC1.6 Xin mở khóa: Đã gửi → Chờ mở khóa, lý do bắt buộc ≤255 ký tự, TB-009 (BR-1..4)', [
    ['Xin thành công', 'RES-U01'], ['Hộp thoại', 'RES-U02'], ['Thông báo MSG-071', 'RES-U03'], ['Hủy', 'RES-U04'],
    ['Lý do trống / khoảng trắng', 'RES-U05|RES-U06'], ['Biên 255 / 256', 'RES-U07|RES-U08|RES-U09'],
    ['BR-1 Ai được xin (LĐ đơn vị, LĐ địa phương, Cán bộ không)', 'RES-U10|RES-U11|RES-U12'],
    ['Chỉ xin ở trạng thái Đã gửi', 'RES-U13|RES-Y10'], ['BR-3 Kỳ kết thúc', 'RES-U14|RES-U28'], ['Khóa thao tác sau khi xin', 'RES-U15'],
    ['Thông tin bổ sung Chờ mở khóa', 'RES-U16|RES-D07'], ['Ghi Lịch sử kèm lý do', 'RES-U17'], ['TB-009 kèm lý do', 'RES-U18'],
    ['Người xin không tự xử lý yêu cầu', 'RES-U19'], ['BR-4 Bộ duyệt / từ chối', 'RES-U20|RES-U21|RES-U22|RES-U29|RES-U30|RES-X18|RES-Y05|RES-Y20'],
    ['Lặp / đồng thời', 'RES-U23'], ['HTML / Unicode', 'RES-U24|RES-J23'], ['Lỗi 500 / mất mạng', 'RES-U25|RES-U26'], ['Id lạ', 'RES-U27'],
  ]),
  // ================= SRS UC1.7 Chi tiết kết quả =================
  R('RES', 'C.UC1.7', null, 'UC1.7 Xem chi tiết kết quả: tiêu đề, thông tin chung, thông tin bổ sung, nút theo trạng thái/vai trò, cây chỉ số, thanh tổng hợp, Hồ sơ gửi Bộ, Lịch sử (BR-1..9)', [
    ['BR-2 Tiêu đề, dòng phụ cố định', 'RES-D01|RES-D02'], ['BR-3 Thông tin chung 4 ô, số ngày còn lại', 'RES-D03|RES-D04'],
    ['BR-4 Thông tin bổ sung theo trạng thái', 'RES-D05|RES-D06|RES-D07|RES-D08'], ['BR-1 Chỉ xem, không ô nhập', 'RES-D09|RES-D10'],
    ['BR-5 Nút theo trạng thái × vai trò', 'RES-X19|RES-X20|RES-X21|RES-X22|RES-Y15|RES-X17'], ['Ba tab, F5 giữ tab', 'RES-D11|RES-J08'],
    ['Tìm chỉ số', 'RES-D12|RES-D13|RES-D14|RES-D15'], ['Lọc chỉ số chưa có điểm; mở rộng/thu gọn', 'RES-D16|RES-D17'],
    ['BR-6 Cây Trụ cột/Nhóm/Chỉ số, cột điểm, điểm nhóm/trụ cột', 'RES-D18|RES-D19|RES-D20|RES-D21'],
    ['BR-6 Công thức Điểm kết quả, Đánh giá, chỉ số cha, chưa chấm', 'RES-D22|RES-D23|RES-D24|RES-D25'],
    ['Giải trình, minh chứng (Tải về, MSG-049)', 'RES-D26|RES-D27|RES-D28'],
    ['Thanh tổng hợp: tiến độ, điểm tạm tính', 'RES-D29|RES-D30|RES-D31'], ['BR-9 Xếp loại theo trạng thái / thang / biên / màu', 'RES-D32|RES-D33|RES-D34|RES-D35'],
    ['BR-7 Hồ sơ gửi Bộ, MSG-022', 'RES-D36|RES-D37'], ['BR-8 Lịch sử: thứ tự, lọc, nhắc nhở', 'RES-D38|RES-D39|RES-D41'],
    ['AF4 Quay lại giữ bộ lọc', 'RES-D42'], ['EF1 Không tồn tại / ngoài phạm vi (MSG-044, MSG-045)', 'RES-D43|RES-D44|RES-J07'],
    ['Bộ Yêu cầu đánh giá lại hiển thị Phía Bộ', 'RES-D06'], ['Điểm chính thức lần gửi gần nhất', 'RES-D51'],
    ['Đọc API không token / token giả', 'RES-X01|RES-X02|RES-X03'], ['Không lộ lỗi nội bộ', 'RES-X29'], ['Hiệu năng chi tiết', 'RES-X30|RES-J22'],
    ['Admin đủ quyền', 'RES-X24'],
  ]),
  // ================= Vòng đời trạng thái =================
  R('RES', 'C.UC1.7', null, 'Vòng đời trạng thái kết quả: Chưa thực hiện → Đang chấm điểm → Chờ duyệt → Đã phê duyệt → Đã gửi → Chờ mở khóa / Bị từ chối', [
    ['Luồng đầy đủ', 'RES-Y01'], ['Lưu điểm đầu tiên chuyển Đang chấm điểm', 'RES-Y02'], ['Chu trình từ chối', 'RES-Y03'],
    ['Chu trình mở khóa', 'RES-Y04|RES-Y05'], ['Chu trình đánh giá lại', 'RES-Y06'], ['Ma trận chuyển trạng thái không hợp lệ', 'RES-Y07|RES-Y08|RES-Y09|RES-Y10|RES-Y11|RES-Y12'],
    ['Kỳ đã kết thúc', 'RES-Y13|RES-Y14'], ['Đồng thời', 'RES-Y16'],
  ]),
  // ================= Thông báo =================
  R('RES', 'C.TB', null, 'Thông báo TB-005..TB-009 đúng người nhận, đúng nội dung', [
    ['TB-005 trình duyệt', 'RES-T23|RES-T24|RES-T25'], ['TB-006 phê duyệt', 'RES-A07'], ['TB-007 từ chối kèm lý do', 'RES-A26'],
    ['TB-008 gửi kết quả', 'RES-F41'], ['TB-009 xin mở khóa kèm lý do', 'RES-U18'], ['Không gửi nhầm / mở đúng kết quả', 'RES-X27|RES-X28'],
  ]),
];
