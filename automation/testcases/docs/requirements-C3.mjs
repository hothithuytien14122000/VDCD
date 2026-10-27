// BẢNG TRUY VẾT PHÂN HỆ C (phần 3/3): Quản lý kết quả của Bộ — SRS UC2.1–UC2.5 (dòng 2413–2965) + UC_1409 dòng 227–248.
// Mỗi UC SRS / dòng UC_1409 là 1 yêu cầu; mỗi yêu cầu phân rã thành điều kiện kiểm thử → regex ID testcase.
const P = 'RES';
// id('B', 1, [5,9], 12) → 'RES-B01|RES-B05|RES-B06|…|RES-B09|RES-B12'  (số lẻ hoặc cặp [từ,đến])
const id = (L, ...xs) => xs.flatMap(x => Array.isArray(x) ? Array.from({ length: x[1] - x[0] + 1 }, (_, i) => x[0] + i) : [x])
  .map(n => `RES-${L}${String(n).padStart(2, '0')}`).join('|');
const j = (...s) => s.join('|');
export default (R) => [
  // ================= SRS UC2.1 =================
  R(P, 'C.UC2.1', null, 'UC2.1 Theo dõi kết quả của các đơn vị: Phía Bộ xem, lọc kết quả tự đánh giá của nhiều đơn vị theo kỳ để biết đơn vị đã gửi, chưa gửi, sắp đến hạn, chờ mở khóa; mặc định tab Cần xử lý + Định kỳ (BR-1…BR-9, AF1–AF5, EF1–EF4)', [
    ['Hiển thị đủ cột của danh sách nhiều đơn vị', id('B', 1)],
    ['Mặc định mở tab Cần xử lý + nút Định kỳ, có số/chấm đỏ', id('B', 2)],
    ['Tab Cần xử lý: chỉ Chờ mở khóa kỳ đang diễn ra, số theo từ khóa/kỳ, không có lọc Thời hạn', id('B', [3, 5])],
    ['Tab Chưa gửi: 5 trạng thái chưa có bản gửi, chỉ kỳ đang diễn ra, không kèm số', id('B', [6, 8])],
    ['Tab Sắp đến hạn: ≤ n ngày, n=0/trống, loại kỳ đã kết thúc, chỉ Chưa gửi', id('B', [9, 12])],
    ['Các tab trạng thái Đã gửi / Chờ mở khóa / Chưa thực hiện / Đang chấm / Chờ duyệt / Bị từ chối / Đã phê duyệt đúng nội dung', id('B', [13, 21])],
    ['Số trên tab nhất quán với tổng và với số dòng; cập nhật sau thao tác', id('B', 22, 23, 72)],
    ['Bản gửi gần nhất là kết quả chính thức', id('B', 24)],
    ['Cột ô chọn (Chưa gửi/Sắp đến hạn), dòng đã gửi không có ô chọn, chọn tất cả', id('B', [25, 27])],
    ['Nút Gửi nhắc nhở disabled khi chưa chọn, bật khi chọn ≥ 1 dòng', id('B', 28, 29)],
    ['Cột Thao tác: nút Xem chi tiết + mũi tên, mọi dòng giống nhau', id('B', 30)],
    ['Menu thao tác theo từng trạng thái (Chưa thực hiện … Chờ mở khóa, kỳ đã kết thúc)', id('B', [31, 39])],
    ['Mục Xem luôn đứng đầu; không có thao tác của đơn vị trong menu Phía Bộ', id('B', 40, 41)],
    ['Bộ lọc Đơn vị luôn hiển thị, chỉ đơn vị trong phạm vi', id('B', 42, 43)],
    ['Bộ lọc Kỳ đánh giá nhiều kỳ, Thời hạn', id('B', 44, 45)],
    ['Từ khóa theo tên kỳ/đơn vị, không phân biệt hoa thường, ký tự đặc biệt an toàn', id('B', [46, 49])],
    ['Kết hợp tab + từ khóa + kỳ; xóa lọc; URL giữ trạng thái; trạng thái URL lạ', id('B', 50, 51, 73, 74)],
    ['Chuyển Định kỳ ↔ Đột xuất giữ tab/bộ lọc, đúng loại kỳ (AF2)', id('B', 52, 53)],
    ['Phân trang: mặc định, chuyển trang, đổi số dòng, dòng "Hiển thị…" (AF5)', id('B', [54, 57])],
    ['Danh sách rỗng "Chưa có dữ liệu"; tìm không ra "Không tìm thấy kết quả phù hợp" (EF1, EF2)', id('B', 58, 59)],
    ['Xuất Excel theo bộ lọc; rỗng báo MSG-023; lỗi báo MSG-024 (BR-7, AF4, EF3)', id('B', 60, 61, 64, 65)],
    ['Hiển thị Hạn nộp, Tiến độ chấm, Điểm, Xếp loại, Trạng thái theo UC1.1 (BR-8)', id('B', [66, 71])],
    ['Người dùng chỉ thấy đơn vị trong phạm vi (BR-1); MSG-043/045 khi không quyền', id('K', 1, 2, 3, [4, 8], 22, 23, 24)],
    ['Ma trận nút đầu trang và mục menu theo vai trò', id('K', [11, 14], 19)],
    ['Phân quyền xuất Excel theo vai trò và theo phạm vi', id('K', 17, 18)],
    ['Lỗi tải danh sách (500), filter/page/sort sai, không lộ lỗi nội bộ (EF4)', id('Q', [11, 14], 18, 19, 21, 23)],
    ['Hiệu năng tải danh sách, 100 dòng, xuất Excel; đổi tab nhanh', id('K', [25, 28])],
  ]),
  // ================= SRS UC2.2 =================
  R(P, 'C.UC2.2', null, 'UC2.2 Gửi nhắc nhở: Phía Bộ gửi nhắc nhở cho một hoặc nhiều đơn vị chưa gửi kết quả; tạo TB-004, ghi Lịch sử, không đổi trạng thái; không giới hạn số lần; không gửi email (BR-1…BR-4, EF1–EF3)', [
    ['Nhắc 1 đơn vị từ menu dòng; thông báo thành công (MSG-075)', id('R', 1, 32)],
    ['Hộp thoại xác nhận MSG-084: tiêu đề, danh sách đơn vị chưa gửi', id('R', 2, 3)],
    ['Nhắc nhiều đơn vị đã chọn / từ nút đầu trang / từ chi tiết', id('R', 4, 5, 6)],
    ['Hủy không gửi, không ghi lịch sử (AF1)', id('R', 7)],
    ['Tạo TB-004 đúng người nhận và đúng nội dung', id('R', 8, 9, 10, 31)],
    ['Lịch sử ghi mỗi đơn vị một dòng, trạng thái không đổi', id('R', 11, 12)],
    ['Không giới hạn số lần nhắc; không ảnh hưởng nhắc tự động; không gửi email (BR-2, BR-4)', id('R', 13, 14, 15)],
    ['Theo từng trạng thái chưa gửi: Đang chấm / Chờ duyệt / Đã phê duyệt / Bị từ chối', id('R', [16, 19])],
    ['Không nhắc được Đã gửi, Chờ mở khóa, kỳ đã kết thúc (BR-1, MSG-060/061)', id('R', [20, 22], 24)],
    ['Có đơn vị đã gửi trong lúc xác nhận thì bỏ khỏi danh sách (BR-3, EF1)', id('R', 23)],
    ['Nhắc theo loại kỳ Định kỳ / Đột xuất', id('R', 25, 26)],
    ['Không có quyền → 403 (EF3, MSG-043); ngoài phạm vi bị bỏ qua', j(id('R', [27, 30]), id('K', 14, 20))],
    ['resultIds sai/rỗng không nhắc toàn bộ; id lạ; lỗi 500; mất mạng; nhiều đơn vị', id('Q', [1, 4], 24)],
    ['Người nhận thông báo nhắc nhở (C.TB)', id('M', 10)],
  ]),
  // ================= SRS UC2.3 =================
  R(P, 'C.UC2.3', null, 'UC2.3 Yêu cầu đơn vị đánh giá lại: kết quả Đã gửi, kỳ đang diễn ra; lý do bắt buộc ≤ 255 ký tự (MSG-058); chuyển Bị từ chối, ghi Lịch sử kèm lý do, tạo TB-012; gửi lại kèm file ký số mới (BR-1…BR-3)', [
    ['Mở hộp thoại từ menu dòng và từ chi tiết, có trường Lý do', id('W', 1, 2)],
    ['Gửi hợp lệ chuyển sang Bị từ chối (MSG-074)', id('W', 3)],
    ['Lý do bắt buộc: trống, khoảng trắng, API thiếu/null (MSG-058)', id('W', 4, 5, 9)],
    ['Lý do tối đa 255: 255 chấp nhận, 256/1001 bị chặn (UI và API)', id('W', 6, 7, 8)],
    ['Hủy giữ nguyên trạng thái (AF1); gửi lặp chỉ 1 yêu cầu', id('W', 10, 25)],
    ['Lịch sử ghi hành động, người thực hiện, lý do', id('W', 11)],
    ['TB-012 kèm lý do cho người có quyền Nhập/sửa/Phê duyệt', j(id('W', 12), id('M', 11))],
    ['Đơn vị thấy cảnh báo và chỉnh sửa, trình duyệt, gửi lại (BR-2)', id('W', 13, 14)],
    ['Gửi lại phải kèm file ký số mới (BR-2)', id('W', 15)],
    ['Không gửi lại kịp trước hạn vẫn giữ bản đã gửi (BR-3); bản cũ vẫn lưu', id('W', 16, 17)],
    ['Sai trạng thái: Chờ mở khóa, Bị từ chối (lặp lần 2), chưa gửi → MSG-060; kỳ đã kết thúc → MSG-061', id('W', 18, 19, 20, 21)],
    ['Không có quyền (LĐ Bộ/LĐ đơn vị/LĐ địa phương/chỉ xem) và ngoài phạm vi → 403 (EF3)', j(id('W', 22, 23), id('K', 15))],
    ['Lý do chứa HTML/Unicode an toàn', id('W', 24)],
    ['Theo loại kỳ Định kỳ / Đột xuất; Bộ không chấm lại điểm', id('W', 26, 27, 28)],
    ['Lỗi 500, mất mạng, id lạ, hết phiên', id('Q', 5, 6, 16, 20)],
  ]),
  // ================= SRS UC2.4a =================
  R(P, 'C.UC2.4a', null, 'UC2.4a Duyệt mở khóa kết quả: kết quả Chờ mở khóa, kỳ đang diễn ra → Đang chấm điểm; xác nhận MSG-008; ghi Lịch sử; tạo TB-010; kỳ kết thúc thì yêu cầu bị bỏ (MSG-061) (BR-1, BR-2, AF1, EF1, EF2)', [
    ['Hộp thoại xác nhận có tên kỳ và đơn vị (MSG-008)', id('O', 1)],
    ['Duyệt thành công → Đang chấm điểm (MSG-072)', id('O', 2, 21)],
    ['Hủy giữ nguyên (AF1); Esc không duyệt', id('O', 3)],
    ['Lịch sử ghi Duyệt mở khóa; điểm và bản gửi không đổi', id('O', 4, 22)],
    ['TB-010 gửi người có quyền Gửi/Xin mở khóa của đơn vị', j(id('O', 5), id('M', 12))],
    ['Sau duyệt đơn vị chỉnh sửa, trình duyệt, gửi lại trước hạn (BR-2)', id('O', 6)],
    ['Duyệt từ tab Cần xử lý, tab Chờ mở khóa (Định kỳ / Đột xuất), từ chi tiết', id('O', [7, 10])],
    ['Kỳ kết thúc khi còn yêu cầu: bị khóa, MSG-061 (BR-1)', id('O', 11)],
    ['Sai trạng thái / người khác đã xử lý → MSG-060 (EF1); duyệt đồng thời; bấm lặp', id('O', [12, 15])],
    ['Quyền theo vai trò: Cán bộ, LĐ Bộ, LĐ đơn vị được; CB/LĐ địa phương, chỉ xem 403 (EF2)', id('O', [16, 19])],
    ['Id không tồn tại → 404', id('O', 20)],
    ['Lỗi 500, mất mạng, danh sách cũ khi trạng thái đã đổi', id('Q', 7, 8, 22)],
    ['Phạm vi dữ liệu: ngoài phạm vi bị từ chối; ma trận API theo vai trò', id('K', 16, 21)],
    ['Thao tác lặp không tạo thông báo trùng', id('M', 16)],
  ]),
  // ================= SRS UC2.4b =================
  R(P, 'C.UC2.4b', null, 'UC2.4b Từ chối mở khóa kết quả: lý do bắt buộc ≤ 255 (MSG-058); kết quả về Đã gửi giữ bản đã gửi; Lịch sử kèm lý do; TB-011 kèm lý do (BR-1, BR-2, AF1, EF1–EF3)', [
    ['Hộp thoại Từ chối mở khóa có trường Lý do từ chối bắt buộc', id('O', 23)],
    ['Từ chối thành công → Đã gửi, giữ bản đã gửi (MSG-073)', id('O', 24)],
    ['Lý do: trống, khoảng trắng, API thiếu/null (MSG-058)', id('O', 25, 26, 29)],
    ['Lý do ≤ 255: 255 chấp nhận, 256 chặn (UI và API)', id('O', 27, 28)],
    ['Hủy / Esc giữ nguyên trạng thái (AF1)', id('O', 30, 39)],
    ['Lịch sử ghi Từ chối mở khóa kèm lý do', id('O', 31)],
    ['TB-011 kèm lý do cho người xin mở khóa', j(id('O', 32), id('M', 13))],
    ['Sau từ chối đơn vị xin mở khóa lại được', id('O', 33)],
    ['Không còn Chờ mở khóa → MSG-060 (EF2)', id('O', 34)],
    ['Từ chối từ chi tiết; kỳ Định kỳ', id('O', 35, 36)],
    ['Không có quyền → 403 (EF3)', id('O', 37)],
    ['Lý do HTML/Unicode an toàn', j(id('O', 38), id('M', 17))],
    ['Lỗi 500, mất mạng, id lạ', id('Q', 9, 10, 17)],
  ]),
  // ================= SRS UC2.5 =================
  R(P, 'C.UC2.5', null, 'UC2.5 Xem chi tiết kết quả của đơn vị: chỉ xem; nút theo trạng thái (Gửi nhắc nhở / Yêu cầu đánh giá lại / Duyệt+Từ chối mở khóa); thông tin bổ sung Chờ mở khóa; Lịch sử lọc Duyệt/Từ chối mở khóa; chưa có Xuất Excel (BR-1…BR-5, AF1–AF3, EF1, EF2)', [
    ['Hiển thị tiêu đề, thông tin chung 4 ô, ba nội dung Chấm điểm/Hồ sơ gửi Bộ/Lịch sử', id('H', 1, 2, 3)],
    ['Màn hình chỉ xem: không sửa điểm, không có nút Chấm điểm/Trình duyệt/Phê duyệt/Từ chối/Gửi Bộ/Xin mở khóa', id('H', 4, 9, 10, 11)],
    ['Nút thao tác Phía Bộ theo trạng thái và kỳ', id('H', [5, 8])],
    ['Thông tin bổ sung ở Chờ mở khóa (người, thời gian, lý do); không có ở trạng thái khác', id('H', 12, 13)],
    ['Thanh tổng hợp, điểm chính thức/tạm tính, xếp loại, cây chỉ số', id('H', 14, 15, 16, 36, 38)],
    ['Tải minh chứng; tệp không còn (MSG-049)', id('H', 17, 18)],
    ['Hồ sơ gửi Bộ: danh sách lần gửi, bản chính thức, rỗng "Chưa có dữ liệu"', id('H', 19, 20)],
    ['Lịch sử xử lý đúng thứ tự/nội dung, lọc hành động Duyệt/Từ chối mở khóa (BR-4)', id('H', [21, 25], 39)],
    ['Tìm chỉ số, lọc chưa có điểm, mở rộng/thu gọn (AF2)', id('H', [28, 30])],
    ['Quay lại danh sách giữ bộ lọc (AF3); mở đúng bản ghi', id('H', 31, 40)],
    ['Không có Xuất Excel ở chi tiết (BR-5)', id('H', 32)],
    ['Id lạ → MSG-044; ngoài phạm vi → MSG-045 (EF1); IDOR lịch sử/hồ sơ', j(id('H', 33, 34), id('K', 9, 10), id('Q', 15))],
    ['Số liệu chi tiết khớp danh sách; hiệu năng chi tiết lớn', id('H', 35, 37)],
  ]),
  // ================= UC_1409 =================
  R(P, 'C.TB', 229, 'Thông báo: Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể nhận thông báo khi có kết quả tự đánh giá của đơn vị. Hệ thống tìm kiếm và trả về thông báo', [
    ['Chuông thông báo hiển thị số chưa đọc, danh sách Tất cả/Chưa đọc', id('M', 1, 9)],
    ['Lãnh đạo Bộ, Cán bộ, Lãnh đạo đơn vị nhận thông báo khi đơn vị gửi kết quả', id('M', 2, 3, 4)],
    ['Đánh dấu đã đọc / tất cả / cập nhật số chưa đọc', id('M', 8, 21)],
    ['Thông báo chỉ gửi đúng người có quyền và phạm vi', id('M', 14, 15, 19)],
    ['API thông báo yêu cầu đăng nhập', id('M', 18)],
  ]),
  R(P, 'C.TB', 230, 'Thông báo: có thể nhận thông báo khi có yêu cầu mở khóa kết quả tự đánh giá của đơn vị. Hệ thống tìm kiếm và trả về thông báo', [
    ['Lãnh đạo Bộ nhận thông báo yêu cầu mở khóa kèm lý do', id('M', 5)],
    ['Cán bộ và Lãnh đạo đơn vị nhận thông báo yêu cầu mở khóa', id('M', 6)],
    ['Bấm thông báo mở đúng chi tiết kết quả và đánh dấu đã đọc', id('M', 7)],
    ['Thông báo tổng hợp Sắp đến hạn cho Lãnh đạo Bộ', id('M', 20)],
  ]),
  R(P, 'C.UC2.1', 232, 'Danh sách yêu cầu tự đánh giá đến hạn: có thể xem danh sách yêu cầu tự đánh giá định kỳ đến hạn. Hệ thống tìm kiếm và trả về danh sách', [
    ['Tab Sắp đến hạn kỳ định kỳ đúng quy tắc n ngày', id('B', [9, 12])],
    ['Tìm kiếm / lọc / phân trang trong danh sách kỳ định kỳ', id('B', 46, 50, 54)],
  ]),
  R(P, 'C.UC2.1', 233, 'Danh sách yêu cầu tự đánh giá đến hạn: có thể xem danh sách yêu cầu tự đánh giá đột xuất đến hạn', [
    ['Chuyển sang Đột xuất vẫn giữ tab Sắp đến hạn, đúng loại kỳ', id('B', 52, 53)],
    ['Tab Chưa gửi / Sắp đến hạn của kỳ đột xuất', id('B', 6, 9)],
  ]),
  R(P, 'C.UC2.1', 234, 'Có thể xem các đơn vị đã thực hiện tự đánh giá. Hệ thống tìm kiếm và trả về danh sách đơn vị đã thực hiện', [
    ['Tab Đã gửi kỳ định kỳ và đột xuất', id('B', 13, 14)],
    ['Tìm theo tên đơn vị trong danh sách đã thực hiện', id('B', 47, 50)],
  ]),
  R(P, 'C.UC2.1', 235, 'Có thể export danh sách đơn vị đã thực hiện tự đánh giá ra excel', [
    ['Xuất Excel tab Đã gửi chỉ chứa dòng Đã gửi', id('B', 62)],
    ['Xuất Excel Định kỳ / Đột xuất tải được .xlsx', id('B', 60, 61)],
    ['Xuất rỗng / lỗi báo đúng thông báo', id('B', 64, 65)],
  ]),
  R(P, 'C.UC2.5', 236, 'Có thể xem chi tiết kết quả thực hiện tự đánh giá của đơn vị. Hệ thống tìm kiếm và trả về kết quả tự đánh giá của đơn vị', [
    ['Mở chi tiết từ danh sách, thông tin chung, điểm khớp danh sách', j(id('H', 1, 2, 35, 40), id('B', 40))],
    ['Cây chỉ số, tìm chỉ số', id('H', 16, 28)],
  ]),
  R(P, 'C.UC2.3', 237, 'Có thể yêu cầu đơn vị thực hiện tự đánh giá lại. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu', [
    ['Yêu cầu đánh giá lại thành công cập nhật trạng thái, lịch sử', id('W', 3, 11)],
    ['Kiểm tra trạng thái và lý do trước khi cập nhật', id('W', 4, 18)],
  ]),
  R(P, 'C.UC2.1', 238, 'Có thể xem các đơn vị chưa thực hiện tự đánh giá CĐS. Hệ thống tìm kiếm và trả về danh sách đơn vị chưa thực hiện', [
    ['Tab Chưa thực hiện / Chưa gửi', id('B', 17, 6)],
    ['Tìm kiếm trong danh sách chưa thực hiện', id('B', 46, 47)],
  ]),
  R(P, 'C.UC2.1', 239, 'Có thể export danh sách đơn vị chưa thực hiện tự đánh giá ra excel', [
    ['Xuất Excel tab Chưa thực hiện chỉ chứa dòng Chưa thực hiện', id('B', 63)],
    ['Xuất rỗng báo "Không có dữ liệu để xuất"', id('B', 64)],
  ]),
  R(P, 'C.UC2.2', 240, 'Có thể gửi yêu cầu thực hiện đánh giá CĐS đối với đơn vị chưa thực hiện. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu', [
    ['Nhắc nhở đơn vị chưa thực hiện thành công, đơn vị nhận thông báo', id('R', 1, 8)],
    ['Kiểm tra điều kiện: chỉ đơn vị chưa gửi, kỳ đang diễn ra', id('R', 20, 22)],
  ]),
  R(P, 'C.UC2.1', 242, 'Có thể xem danh sách yêu cầu mở khóa kết quả tự đánh giá định kỳ của đơn vị. Hệ thống tìm kiếm và trả về danh sách yêu cầu mở khóa', [
    ['Tab Chờ mở khóa kỳ định kỳ hiển thị đủ và đúng số', id('B', 15)],
    ['Duyệt / Từ chối yêu cầu mở khóa kỳ định kỳ', id('O', 8, 36)],
  ]),
  R(P, 'C.UC2.1', 243, 'Có thể xem danh sách yêu cầu mở khóa kết quả tự đánh giá đột xuất của đơn vị', [
    ['Tab Chờ mở khóa kỳ đột xuất', id('B', 16)],
    ['Duyệt mở khóa kỳ đột xuất', id('O', 9)],
  ]),
  R(P, 'C.UC2.4a', 244, 'Có thể mở khóa kết quả tự đánh giá. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu', [
    ['Duyệt mở khóa chuyển Đang chấm điểm, ghi lịch sử, thông báo', id('O', 2, 4)],
    ['Kiểm tra điều kiện trạng thái/kỳ trước khi mở khóa', id('O', 13)],
  ]),
  R(P, 'C.UC2.5', 246, 'Có thể xem lịch sử kết quả tự đánh giá định kỳ. Hệ thống tìm kiếm và trả về lịch sử kết quả tự đánh giá', [
    ['Xem kết quả kỳ định kỳ đã kết thúc ở chế độ chỉ xem', id('H', 26)],
    ['Lịch sử xử lý của kết quả', id('H', 21)],
  ]),
  R(P, 'C.UC2.5', 247, 'Có thể xem lịch sử kết quả tự đánh giá đột xuất. Hệ thống tìm kiếm và trả về lịch sử kết quả tự đánh giá', [
    ['Xem kết quả kỳ đột xuất đã kết thúc ở chế độ chỉ xem', id('H', 27)],
    ['Lọc lịch sử theo hành động', id('H', 22, 23)],
  ]),
  R(P, 'C.UC2.5', 248, 'Có thể xem thông tin chi tiết kết quả tự đánh giá. Hệ thống tìm kiếm và trả về thông tin chi tiết', [
    ['Thông tin chi tiết đầy đủ và đúng', id('H', 1, 3, 14)],
    ['Chi tiết với id lạ / ngoài phạm vi không lỗi', id('H', 33, 34)],
  ]),
];
