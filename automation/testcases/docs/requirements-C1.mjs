// BẢNG TRUY VẾT PHÂN HỆ C (phần 1/3): Kết quả tự đánh giá — SRS UC1.1, UC1.2 (+ vòng đời) dòng 1179–1677 + UC_1409 dòng 186–205.
const P = 'RES';
const id = (L, ...xs) => xs.flatMap(x => Array.isArray(x) ? Array.from({ length: x[1] - x[0] + 1 }, (_, i) => x[0] + i) : [x])
  .map(n => `RES-${L}${String(n).padStart(2, '0')}`).join('|');
const j = (...s) => s.join('|');
export default (R) => [
  // ================= UC_1409 — thông báo =================
  R(P, 'C.TB', 187, 'C.I.1 Thông báo yêu cầu tự đánh giá định kỳ: gửi Cán bộ, Cán bộ địa phương, Lãnh đạo đơn vị, Lãnh đạo địa phương khi kỳ được phê duyệt', [
    ['Cán bộ / CB địa phương / LĐ đơn vị / LĐ địa phương nhận thông báo kỳ định kỳ', id('N', [1, 4])],
    ['Nội dung có tên kỳ, hạn hoàn thành; phân biệt loại kỳ', id('N', 9, 10)],
    ['Không gửi cho đơn vị không được phân công; không trùng; mở đúng trang', id('N', 11, 12, 32)],
  ]),
  R(P, 'C.TB', 188, 'C.I.1 Thông báo yêu cầu tự đánh giá đột xuất: gửi các vai trò thực hiện khi kỳ được phê duyệt', [
    ['Bốn vai trò nhận thông báo kỳ đột xuất', id('N', [5, 8])],
    ['Nội dung thông báo kỳ đột xuất đúng tên kỳ, hạn', id('N', 9, 10)],
  ]),
  R(P, 'C.TB', 189, 'C.I.1 Thông báo yêu cầu thực hiện lại tự đánh giá định kỳ gửi Lãnh đạo đơn vị / địa phương của đơn vị mình', [
    ['LĐ đơn vị / LĐ địa phương nhận thông báo yêu cầu đánh giá lại định kỳ', id('N', 13, 15)],
    ['Không gửi sang đơn vị khác; Cán bộ nhận để chấm lại', id('N', 16, 17)],
  ]),
  R(P, 'C.TB', 190, 'C.I.1 Thông báo yêu cầu thực hiện lại tự đánh giá đột xuất gửi Lãnh đạo của đơn vị mình', [
    ['LĐ đơn vị nhận thông báo đánh giá lại đột xuất kèm lý do', id('N', 14, 15)],
  ]),
  R(P, 'C.TB', 191, 'C.I.1 Thông báo mở khóa kết quả tự đánh giá định kỳ gửi Lãnh đạo đơn vị / địa phương', [
    ['LĐ đơn vị / địa phương nhận thông báo mở khóa định kỳ', id('N', 18, 20)],
    ['Nội dung mở khóa; thông báo từ chối mở khóa', id('N', 21, 22)],
  ]),
  R(P, 'C.TB', 192, 'C.I.1 Thông báo mở khóa kết quả tự đánh giá đột xuất gửi Lãnh đạo đơn vị / địa phương', [
    ['LĐ đơn vị / địa phương nhận thông báo mở khóa đột xuất', id('N', 19, 20)],
    ['Nội dung thông báo mở khóa', id('N', 21)],
  ]),
  R(P, 'C.TB', 194, 'C.I.2 Thông báo yêu cầu phê duyệt kết quả tự đánh giá định kỳ gửi Lãnh đạo khi Cán bộ Trình duyệt', [
    ['LĐ đơn vị / LĐ địa phương nhận thông báo yêu cầu phê duyệt định kỳ', id('N', 23, 24)],
    ['Người không liên quan không nhận; trình lại; trình bị chặn không gửi', id('N', [27, 30])],
    ['Bấm thông báo mở đúng kết quả cần phê duyệt', id('N', 31)],
  ]),
  R(P, 'C.TB', 195, 'C.I.2 Thông báo yêu cầu phê duyệt kết quả tự đánh giá đột xuất gửi Lãnh đạo khi Cán bộ Trình duyệt', [
    ['LĐ đơn vị / LĐ địa phương nhận thông báo yêu cầu phê duyệt đột xuất', id('N', 25, 26)],
    ['Bấm thông báo mở đúng kết quả', id('N', 31)],
  ]),
  R(P, 'C.TB', null, 'Chuông và danh sách thông báo: số chưa đọc, đánh dấu đã đọc, thứ tự, lọc, thời gian thực, an toàn nội dung, quyền truy cập thông báo', [
    ['Số chưa đọc, đánh dấu đã đọc, thứ tự mới nhất, lọc theo loại', id('N', [33, 35])],
    ['Thông báo thời gian thực; tên kỳ ký tự đặc biệt; nội dung thông báo gửi Bộ', id('N', [36, 38])],
    ['Thông báo: token, filter sai, đánh dấu đọc thông báo người khác', id('Z', [28, 30])],
  ]),

  // ================= UC_1409 — C.I.3 thực hiện tự đánh giá =================
  R(P, 'C.UC1.1', 197, 'C.I.3 Danh sách kết quả tự đánh giá định kỳ (Cán bộ, CB địa phương, LĐ đơn vị, LĐ địa phương, LĐ Bộ)', [
    ['Hiển thị danh sách kỳ định kỳ với đủ cột', id('L', [1, 4], 50, 59, 83, 84)],
    ['Phạm vi dữ liệu theo vai trò', id('Z', 9, 17, 18, 19, 22)],
  ]),
  R(P, 'C.UC1.1', 198, 'C.I.3 Danh sách kết quả tự đánh giá đột xuất', [
    ['Chuyển nút Đột xuất giữ bộ lọc, chỉ kỳ đột xuất', id('L', 48, 49, 50, 83)],
  ]),
  R(P, 'C.UC1.1', 199, 'C.I.3 Xuất Excel danh sách kết quả tự đánh giá', [
    ['Xuất Excel đúng bộ lọc, đủ cột, kết quả rỗng, lỗi', id('L', [72, 78])],
    ['Quyền xuất Excel theo vai trò, phạm vi dữ liệu file', id('Z', 23, 24)],
  ]),
  R(P, 'C.UC1.7', 200, 'C.I.3 Xem chi tiết kết quả tự đánh giá (trang thông tin chung, nhóm, chỉ số)', [
    ['Trang chi tiết: tiêu đề, thông tin chung, thẻ tổng hợp', id('V', [1, 3])],
    ['Cây chỉ số, điểm tối đa/tối thiểu, đánh giá Đạt/Chưa đạt, điểm nhóm/tổng', id('V', [4, 12])],
    ['Chế độ chỉ xem, lịch sử, quay lại, tìm/lọc, id không tồn tại', id('V', [13, 19], 23, 24)],
    ['Mở chi tiết ngoài phạm vi / không token', id('Z', 3, 20, 21)],
  ]),
  R(P, 'C.UC1.7', 201, 'C.I.3 Xuất Excel chi tiết kết quả tự đánh giá', [
    ['Xuất Excel chi tiết đủ chỉ số, điểm, giải trình', id('V', 20, 21)],
    ['Id không tồn tại; quyền xuất chi tiết', j(id('V', 22), id('Z', 25))],
  ]),
  R(P, 'C.UC1.2', 202, 'C.I.3 Chấm điểm: nhập điểm và lưu nháp', [
    ['Mở chấm điểm; lưu nháp; trạng thái sau lưu', id('S', [1, 9])],
    ['Biên và định dạng điểm; công thức điểm kết quả', id('S', [10, 27])],
    ['Chỉ số cha/con và Không tính điểm', id('S', [28, 35])],
    ['Cập nhật và tải lại dữ liệu đã lưu', id('G', [4, 6])],
  ]),
  R(P, 'C.UC1.2', 203, 'C.I.3 Chấm điểm: sửa điểm, giải trình đã lưu và đánh giá Đạt/Chưa đạt', [
    ['Sửa điểm / giải trình đã lưu', id('G', 5, 6)],
    ['Giải trình: bắt buộc, biên 255, HTML, Unicode', id('S', [36, 42])],
  ]),
  R(P, 'C.UC1.2', 204, 'C.I.3 Chấm điểm: đính kèm minh chứng (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG ≤ 20 MB)', [
    ['Đính kèm các định dạng hợp lệ', id('S', [43, 49])],
    ['Định dạng sai, kích thước, tệp rỗng/hỏng, tên tệp', id('S', [50, 62])],
    ['Nhiều tệp, gắn đúng chỉ số, lỗi tải, tải về', id('S', [63, 69])],
    ['Upload: token, quyền, tệp ngoài kết quả', id('Z', [5, 6], 26, 27)],
  ]),
  R(P, 'C.UC1.2', 205, 'C.I.3 Chấm điểm: xóa minh chứng, hủy chỉnh sửa, trình duyệt', [
    ['Xóa minh chứng (xác nhận / hủy / hiệu lực)', id('S', [70, 77])],
    ['Hủy chỉnh sửa / thoát khi có thay đổi chưa lưu', id('S', [78, 85])],
    ['Trạng thái cho/không cho chấm; kỳ kết thúc; xung đột; mất quyền', id('S', [86, 94])],
  ]),

  // ================= SRS UC1.1 =================
  R(P, 'C.UC1.1', null, 'UC1.1 Xem danh sách kết quả tự đánh giá: cột, loại kỳ, tab Cần xử lý, tab trạng thái, Thời hạn, tìm kiếm, bộ lọc, phân trang (BR-1…BR-10, AF1–AF5, EF1–EF3)', [
    ['Hiển thị đủ cột, Bộ chỉ số, Xếp loại', id('L', [1, 3])],
    ['Mặc định Định kỳ / Cần xử lý; nội dung tab Cần xử lý theo vai trò', id('L', [4, 9])],
    ['Bộ lọc Thời hạn: giá trị, mặc định, lọc', id('L', [10, 14])],
    ['Dải tab Trạng thái theo Thời hạn', id('L', [15, 17])],
    ['Từng tab trạng thái đúng nội dung; số trên tab', id('L', [18, 26])],
    ['Tìm kiếm từ khóa: hoa/thường, tiếng Việt, rỗng, đặc biệt, biên 255', id('L', [27, 36])],
    ['Bộ lọc Kỳ đánh giá, Đơn vị, kết hợp', id('L', [37, 42])],
    ['Phân trang và giữ bộ lọc', id('L', [43, 47])],
    ['Định kỳ / Đột xuất', id('L', [48, 50])],
    ['Cột Hạn nộp, Điểm, Tiến độ, Trạng thái', id('L', [51, 59])],
    ['Cột Thao tác và menu theo trạng thái × vai trò', id('L', [60, 71])],
    ['Xếp loại: điều kiện hiển thị, % làm tròn, mốc', id('L', [79, 82])],
    ['Lỗi giao diện và API danh sách (500, mạng, filter, size, page)', id('G', [7, 18])],
    ['Bảo mật và phân quyền danh sách', id('Z', [1, 2], [7, 8])],
    ['Hiệu năng danh sách', id('Z', 31)],
  ]),
  R(P, 'C.UC1.2', null, 'UC1.2 Chấm điểm và đính kèm minh chứng (BR-1…BR-12, EF1–EF6, AF1–AF4): điểm nguyên, tính điểm, chỉ số cha/con, giải trình, minh chứng, lưu nháp, hủy, trạng thái, quyền', [
    ['Lưu nháp và vòng đời trạng thái', id('S', [1, 9], 84, 85, 93)],
    ['Lỗi lưu (500, mạng, trùng, API tham số)', id('G', [1, 3], [19, 23])],
    ['Tìm / lọc / mở rộng trong màn chấm điểm', id('S', [95, 99])],
    ['Phân quyền chấm điểm theo vai trò và phạm vi', id('Z', [4, 5], [10, 16])],
    ['Hiệu năng chấm điểm / upload', id('Z', [32, 34])],
  ]),
];
