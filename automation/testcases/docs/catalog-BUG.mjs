// Testcase BỔ SUNG từ các bug/góp ý đã log trên GitLab (vdcd-cds-client #288–#298, 11–12/11/2026).
// Mỗi case ghi số issue ở cột Ghi chú để truy vết. Chưa có script automation → Manual.
// Truy vết yêu cầu: requirements-BUG.mjs.
export default function defineBUG(t) {
  // Case đã có script (scripts/C/ket-qua-tu-danh-gia-4-bug-gitlab.spec.ts) → Auto
  const AUTO = new Set(['RES-L85', 'RES-L86', 'RES-L87', 'RES-L88', 'RES-L89', 'RES-L90', 'RES-S100', 'RES-S101', 'RES-S102', 'RES-S103', 'RES-F44', 'RES-F45', 'RES-F46',
    'GRP-L13', 'GRP-V06', 'PRV-L12', 'COM-L13', 'UTY-L13', 'UTY-C06', 'UTY-C07', 'SET-V09', 'SET-V10', 'SET-V11', 'SET-V12', 'SET-V13', 'SET-V14']);
  const m = (id, uc, fn, title, type, pri, steps, exp, issue, note = '') =>
    t(id, uc, fn, title, type, pri, steps, exp, AUTO.has(id) ? 'Auto' : 'Manual — chưa có script', `GitLab #${issue}${note ? '. ' + note : ''}`);

  const GO_RES = '1. Đăng nhập Cán bộ\n2. Mở menu Đánh giá CĐS → Kết quả tự đánh giá';
  const L = 'C.UC1.1', S = 'C.UC1.2', F = 'C.UC1.5';

  // ===================== Kết quả tự đánh giá — danh sách =====================
  // #292 Bộ lọc theo hạn tự đánh giá
  m('RES-L85', L, 'Bộ lọc', 'Có bộ lọc Hạn tự đánh giá gồm Tất cả, Chưa đến hạn, Đến hạn, Quá hạn (Định kỳ và Đột xuất)', 'Chức năng', 'Cao',
    GO_RES + '\n3. Chọn Định kỳ → tab Tất cả, mở bộ lọc Hạn tự đánh giá\n4. Lặp lại với Đột xuất',
    'Cả Định kỳ và Đột xuất đều có bộ lọc Hạn tự đánh giá với 4 giá trị: Tất cả, Chưa đến hạn, Đến hạn, Quá hạn', 292,
    'TC Round1 DSYCTDGDH-1 (dòng 15, 16): "Hệ thống không có bộ lọc đến hạn"');
  m('RES-L86', L, 'Bộ lọc', 'Lọc "Chưa đến hạn" chỉ trả kỳ có ngày hiện tại < hạn nộp', 'Nghiệp vụ', 'Cao',
    GO_RES + '\n3. Chọn Hạn tự đánh giá = Chưa đến hạn', 'Mọi dòng có Hạn nộp > ngày hiện tại (vd hạn 30/12/2026, hôm nay 12/11/2026)', 292);
  m('RES-L87', L, 'Bộ lọc', 'Lọc "Đến hạn" chỉ trả kỳ có hạn nộp đúng bằng ngày hiện tại', 'Nghiệp vụ', 'Cao',
    '1. Chuẩn bị kỳ thử có hạn nộp = hôm nay và một kỳ hạn nộp = ngày mai\n2. Chọn Hạn tự đánh giá = Đến hạn',
    'Chỉ hiển thị kỳ có hạn nộp = hôm nay; kỳ hạn ngày mai không xuất hiện', 292, 'Biên: so sánh theo ngày, không theo giờ — cần BA xác nhận');
  m('RES-L88', L, 'Bộ lọc', 'Lọc "Quá hạn" chỉ trả kỳ có ngày hiện tại > hạn nộp', 'Nghiệp vụ', 'Cao',
    '1. Chuẩn bị kỳ thử có hạn nộp = hôm qua\n2. Chọn Hạn tự đánh giá = Quá hạn', 'Mọi dòng có Hạn nộp < ngày hiện tại; kỳ hạn hôm nay không xuất hiện', 292);
  m('RES-L89', L, 'Bộ lọc', 'Bộ lọc Hạn tự đánh giá kết hợp được với từ khóa, trạng thái, loại đơn vị, tỉnh/thành', 'Chức năng', 'Trung bình',
    '1. Chọn Hạn tự đánh giá = Chưa đến hạn\n2. Chọn thêm Trạng thái và nhập từ khóa', 'Kết quả thỏa đồng thời mọi điều kiện lọc', 292);
  // #288 point 1 — Xuất Excel danh sách (màn đơn vị)
  m('RES-L90', L, 'Xuất Excel', 'Màn danh sách Kết quả tự đánh giá có nút Xuất Excel và file xuất đúng các cột, đúng bộ lọc đang chọn', 'Chức năng', 'Cao',
    GO_RES + '\n3. Chọn bộ lọc trạng thái, loại đơn vị, tỉnh/thành\n4. Bấm Xuất Excel, mở file',
    'Có nút Xuất Excel; file gồm cột STT, Mã kỳ, Kỳ tự đánh giá, Đơn vị, Hạn nộp, Tiến độ chấm, Điểm, Trạng thái; số dòng = số bản ghi theo bộ lọc', 288,
    'Thực tế (bochitieucds.bdttg.gov.vn, tài khoản QC Cán bộ) chưa có nút Xuất Excel');

  // ===================== Kết quả tự đánh giá — chấm điểm =====================
  // #288 point 2 — chỉ số không tính điểm
  m('RES-S100', S, 'Chấm điểm', 'Chỉ số Không tính điểm không hiển thị trong bảng chấm điểm và kết quả đánh giá', 'Nghiệp vụ', 'Cao',
    '1. Dùng kỳ có bộ chỉ số chứa chỉ số Không tính điểm (vd TEST_N05_CS05 và chỉ số con)\n2. Mở chi tiết → tab Chấm điểm\n3. Xem tiến độ chấm, tổng điểm',
    'Chỉ số Không tính điểm không xuất hiện trong bảng; không tính vào Tiến độ chấm (x/y) và Điểm tạm tính', 288,
    'Thực tế: dòng hiển thị với Điểm tối đa, Điểm tự chấm, Minh chứng, Giải trình đều "–"');
  // #290 — F5 khi đang nhập điểm
  m('RES-S101', S, 'Chấm điểm', 'Tải lại trang (F5) ở tab Chấm điểm giữ nguyên tab và nhóm chỉ số đang chấm', 'Chức năng', 'Trung bình',
    '1. Mở chi tiết kết quả → tab Chấm điểm (URL ?tab=scoring&group=…)\n2. Chọn một nhóm chỉ số\n3. Nhấn F5',
    'Sau khi tải lại vẫn ở tab Chấm điểm và đúng nhóm chỉ số theo URL, không bị chuyển về trang Thông tin', 290);
  m('RES-S102', S, 'Chấm điểm', 'F5 / đóng tab / điều hướng khi có điểm chưa lưu thì cảnh báo người dùng', 'Chức năng', 'Cao',
    '1. Nhập điểm, giải trình cho chỉ số, chưa Lưu nháp\n2. Nhấn F5 (lặp lại với đóng tab, bấm menu khác)',
    'Hiển thị hộp xác nhận rời trang (vd "Bạn có thay đổi chưa lưu…"); chọn ở lại thì dữ liệu đang nhập còn nguyên', 290,
    'Bổ sung cho RES-S82 (nút quay lại) — trường hợp F5/đóng tab/menu');
  // #291 — mất file minh chứng sau Lưu nháp
  m('RES-S103', S, 'Minh chứng', 'Chỉ đính kèm tệp minh chứng (chưa nhập điểm) rồi Lưu nháp thì tệp vẫn được lưu', 'Nghiệp vụ', 'Cao',
    '1. Chọn chỉ số chưa có điểm (vd CS-1208 kỳ TEST 11.11.2026)\n2. Bấm Tải file, chọn tệp PDF hợp lệ\n3. Bấm Lưu nháp\n4. Tải lại trang',
    'Tệp vẫn hiển thị ở cột Minh chứng của chỉ số; thẻ Minh chứng tăng 1', 291,
    'Bổ sung cho RES-G04 (có nhập điểm). Lần sau tái hiện kiểm tra tab Network có 413 không (xem #296)');

  // ===================== Kết quả tự đánh giá — Hồ sơ gửi Bộ =====================
  // #296 — upload trả 413
  m('RES-F44', F, 'Gửi Bộ', 'Tải văn bản xác nhận PDF dung lượng trung bình (1–20 MB, vd 5 MB) thành công', 'Validate', 'Cao',
    '1. Kết quả Đã phê duyệt → tab Hồ sơ gửi Bộ\n2. Chọn tệp PDF 5 MB', 'Tải lên thành công; API /upload/blob/assessment_result_file trả 2xx, không 413', 296,
    'Thực tế 413 Request Entity Too Large từ nginx — nghi client_max_body_size < 20 MB');
  m('RES-F45', F, 'Gửi Bộ', 'Máy chủ từ chối tệp (413/500) thì hiển thị thông báo lỗi cho người dùng', 'Validate', 'Cao',
    '1. Giả lập API upload trả 413 (hoặc tải tệp làm server trả 413)\n2. Quan sát giao diện', 'Hiển thị thông báo lỗi rõ ràng; vùng upload không treo; không im lặng', 296);
  m('RES-F46', S, 'Minh chứng', 'Tải tệp minh chứng ở form chấm điểm dung lượng 5 MB thành công (không 413)', 'Validate', 'Cao',
    '1. Ở tab Chấm điểm, Tải file cho một chỉ số với tệp PDF 5 MB', 'Tải lên thành công; API /upload/blob/assessment_result_evidence trả 2xx', 296,
    'Cùng cấu hình nginx với #296');

  // ===================== Bộ chỉ số — Xuất Excel chi tiết (#289) =====================
  const GO_SET = '1. Đăng nhập Quản trị hệ thống\n2. Bộ chỉ số DTI → Bộ chỉ số → Xem chi tiết BCS-333\n3. Bấm Xuất Excel, mở file';
  m('SET-V09', 'B.II.1-UC5', 'Xuất Excel', 'File Excel chi tiết bộ chỉ số có đủ cột như màn hình: Mã, Tên, Tính điểm, Điểm tối thiểu, Điểm tối đa', 'Chức năng', 'Cao',
    GO_SET, 'Bảng cấu trúc trong file có đủ các cột như màn hình; giá trị Tính điểm, Điểm tối thiểu khớp từng dòng', 289,
    'Thực tế thiếu Tính điểm, Điểm tối thiểu; thừa Số nhóm, Số chỉ số');
  m('SET-V10', 'B.II.1-UC5', 'Xuất Excel', 'Tiêu đề cột tên trong file Excel phản ánh đúng nội dung (Trụ cột / Nhóm chỉ số / Chỉ số)', 'UI', 'Thấp',
    GO_SET, 'Tiêu đề cột tên bao quát cả trụ cột, nhóm và chỉ số', 289, 'Thực tế: "Trụ cột / Nhóm chỉ số" nhưng có dòng chỉ số');
  m('SET-V11', 'B.II.1-UC5', 'Xuất Excel', 'Điểm trong file Excel hiển thị giống màn hình', 'UI', 'Thấp',
    GO_SET, 'Điểm hiển thị 10, 5 như màn hình (không phải 10.0, 5.0)', 289);
  m('SET-V13', 'B.II.1-UC5', 'Xuất Excel', 'Cập nhật lần cuối trong file Excel có đủ ngày giờ như màn hình', 'UI', 'Trung bình',
    GO_SET, 'Ô Cập nhật lần cuối có ngày và giờ (vd 08/11/2026 07:24) kèm người cập nhật', 289, 'Thực tế thiếu giờ');
  m('SET-V14', 'B.II.1-UC5', 'Xuất Excel', 'Các ô số trong file Excel lưu kiểu Number, không phải text', 'Validate', 'Thấp',
    GO_SET, 'Phiên bản, Số trụ cột, Số nhóm chỉ số, Số chỉ số, Tổng điểm tối đa, Số kỳ sử dụng là kiểu Number (không có cảnh báo tam giác xanh)', 289);
  m('SET-V12', 'B.II.1-UC5', 'Xuất Excel', 'Số chỉ số trong file Excel đếm đúng theo quy tắc của hệ thống', 'Nghiệp vụ', 'Trung bình',
    GO_SET, 'Số chỉ số (ô thông tin và cột Số chỉ số) khớp quy tắc đếm đã thống nhất (chỉ chỉ số lá hoặc tất cả chỉ số)', 289,
    'Cần BA xác nhận: file ghi 2, cây có 3 chỉ số (CS-0750 cha + 2 con)');

  // ===================== Đơn vị hành chính — Xuất Excel (#293) =====================
  m('PRV-L12', 'A.IV.1-UC7', 'Export', 'File Excel tỉnh/thành có đủ cột như màn hình, gồm Số xã/phường', 'Chức năng', 'Trung bình',
    '1. Đăng nhập Quản trị hệ thống\n2. Mở Đơn vị hành chính cấp tỉnh → Xuất Excel\n3. Mở file',
    'File có cột Mã, Tên, Số xã/phường, Số đơn vị; giá trị khớp màn hình (vd TINH-536 có 3 xã/phường)', 293);
  m('COM-L13', 'A.IV.2-UC7', 'Export', 'Thứ tự các dòng trong file Excel xã/phường khớp thứ tự trên màn hình', 'Chức năng', 'Trung bình',
    '1. Đăng nhập Quản trị hệ thống\n2. Mở Đơn vị hành chính cấp xã → Xuất Excel\n3. So thứ tự dòng với danh sách',
    'Thứ tự dòng trong file trùng thứ tự trên màn hình (theo sắp xếp/bộ lọc hiện tại)', 293,
    'Thực tế: file bắt đầu bằng 2455, XA-0248, XA-0246, XA-0247; màn hình XA-0248, XA-0247, XA-0246');

  // ===================== Nhóm người dùng (#294, #295) =====================
  m('GRP-L13', 'A.II.2-UC1', 'Xem danh sách', 'Cột Mô tả hiển thị "–" khi nhóm không có mô tả', 'UI', 'Thấp',
    '1. Đăng nhập Quản trị hệ thống\n2. Mở Nhóm người dùng\n3. Xem dòng nhóm không có mô tả (vd QC_CAN_BO)', 'Ô Mô tả hiển thị "–", không để trống', 295);
  m('GRP-V06', 'A.II.2-UC7', 'Xem thành viên', 'Khu vực "Người dùng trong nhóm" ở chi tiết nhóm đúng design NND-02', 'UI', 'Thấp',
    '1. Mở chi tiết một nhóm người dùng\n2. So khu vực Người dùng trong nhóm và nút thao tác với design NND-02',
    'Ô tìm kiếm ngay dưới tiêu đề, rộng ~1/3, căn trái; không khoảng trống thừa; header bảng theo design; không thanh cuộn ngang; nút "Xóa nhóm"', 294,
    'Icon sắp xếp ở header: cần BA/Design xác nhận');

  // ===================== Loại đơn vị (#297, #298) =====================
  m('UTY-L13', 'A.IV.3-UC1', 'Xem danh sách', 'Sub title trang Loại đơn vị đúng design', 'UI', 'Thấp',
    '1. Đăng nhập Quản trị hệ thống\n2. Mở Loại đơn vị', 'Dưới tiêu đề hiển thị "Phân loại đơn vị tham gia tự đánh giá"', 298,
    'Thực tế: "Phân loại đơn vị theo cấp hành chính, ví dụ Cấp Sở/Ban/Ngành, Cấp Xã"');
  m('UTY-C06', 'A.IV.3-UC4', 'Thêm mới', 'Placeholder các trường popup Thêm loại đơn vị đúng design', 'UI', 'Thấp',
    '1. Mở Loại đơn vị → Thêm loại đơn vị', 'Tên loại đơn vị: "Nhập tên loại đơn vị"; Cấp hành chính: "Chọn cấp hành chính"; Mô tả: "Các đơn vị thuộc loại này"', 297);
  m('UTY-C07', 'A.IV.3-UC4', 'Thêm mới', 'Dòng mô tả dưới tiêu đề popup Thêm loại đơn vị đúng design', 'UI', 'Thấp',
    '1. Mở Loại đơn vị → Thêm loại đơn vị', 'Hiển thị "Phân loại dùng khi tạo đơn vị và giao kỳ đánh giá"', 297);
}
