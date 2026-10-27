// Testcase PHÂN HỆ C (phần 2/3) — Đánh giá CĐS / "Kết quả tự đánh giá": luồng xử lý kết quả
// Nguồn: SRS UC1.3 Trình duyệt, UC1.4a Phê duyệt, UC1.4b Từ chối, UC1.5 Gửi Bộ, UC1.6 Xin mở khóa, UC1.7 Chi tiết kết quả;
//        UC_1409 dòng 206-226 (C.I.4 Trình phê duyệt, C.I.5 Phê duyệt, C.I.6 Gửi kết quả, C.I.7 Quản lý danh sách kết quả).
// Page prefix: RES. Nhóm ID của file này: T trình duyệt · A phê duyệt/từ chối · F gửi Bộ · U xin mở khóa · D chi tiết · Y vòng đời · J edge/lỗi · X phân quyền/bảo mật/hiệu năng.
// Quy ước dữ liệu: kỳ đột xuất "qc.automation …" phân công 2 đơn vị (QA - Đơn vị Bộ cho Cán bộ/LĐ đơn vị; QA - Địa phương cho CB/LĐ địa phương), LĐ Bộ duyệt kỳ → sinh kết quả "Chưa thực hiện".
// Kỳ định kỳ: kỳ vừa duyệt chưa sinh kết quả cho đơn vị nên các luồng ghi dữ liệu trên kỳ định kỳ để Manual.
export default function defineC2(t) {
  const c = (id, uc, fn, title, type, pri, steps, exp, note = '') => t(id, uc, fn, title, type, pri, steps, exp, 'Auto', note);
  const BA = 'Cần BA xác nhận quy tắc';
  const S403 = 'Khảo sát: sai trạng thái/không đủ điều kiện API trả 403 "Bạn không có quyền truy cập chức năng này" (không phải MSG-060/061) → nghi lệch SRS. ';
  const PRE_CHO = 'Chuẩn bị: kết quả đã chấm đủ 100/100 chỉ số và đã Trình duyệt (Chờ duyệt). ';

  // =============================== UC1.3 TRÌNH DUYỆT (RES-T) ===============================
  c('RES-T01', 'C.UC1.3', 'Trình duyệt', 'Cán bộ trình duyệt kết quả kỳ đột xuất đã chấm đủ điểm thành công', 'Chức năng', 'Cao',
    '1. Đăng nhập Cán bộ; mở chi tiết kết quả Đang chấm điểm đã chấm đủ mọi chỉ số\n2. Bấm Trình duyệt\n3. Chọn xác nhận trình duyệt',
    'Kết quả chuyển Chờ duyệt (API status=PendingApproval); nút Chấm điểm/Lưu nháp/Trình duyệt biến mất; hiển thị thông tin "Đang chờ Lãnh đạo đơn vị phê duyệt"');
  c('RES-T02', 'C.UC1.3', 'Trình duyệt', 'Cán bộ địa phương trình duyệt kết quả của đơn vị địa phương thành công', 'Chức năng', 'Cao',
    '1. Đăng nhập CB địa phương; mở kết quả của QA - Địa phương đã chấm đủ điểm\n2. Bấm Trình duyệt → xác nhận',
    'Kết quả chuyển Chờ duyệt; lịch sử có dòng Trình duyệt do CB địa phương');
  t('RES-T03', 'C.UC1.3', 'Trình duyệt', 'Cán bộ trình duyệt kết quả kỳ định kỳ đã chấm đủ điểm thành công (UC_1409 dòng 207)', 'Chức năng', 'Cao',
    '1. Có kỳ định kỳ đang diễn ra đã sinh kết quả cho đơn vị, chấm đủ điểm\n2. Cán bộ bấm Trình duyệt → xác nhận',
    'Kết quả chuyển Chờ duyệt như kỳ đột xuất', 'Manual: kỳ định kỳ tạo qua trang Quản lý tự đánh giá chưa sinh kết quả cho đơn vị (assessmentResultId=null) nên chưa dựng được dữ liệu; cần kỳ định kỳ đã sinh kết quả',
    'Khảo sát: tạo + duyệt kỳ định kỳ nhưng danh sách đơn vị chưa có kết quả (job sinh kết quả). ' + BA + ' thời điểm sinh kết quả kỳ định kỳ');
  c('RES-T04', 'C.UC1.3', 'Trình duyệt', 'Hộp thoại xác nhận có tiêu đề "Trình kết quả cho Lãnh đạo đơn vị?" và nội dung MSG-064 kèm tên kỳ', 'UI', 'Cao',
    '1. Mở chi tiết kết quả đủ điểm (Cán bộ)\n2. Bấm Trình duyệt',
    'Hộp thoại tiêu đề "Trình kết quả cho Lãnh đạo đơn vị?", nội dung "Bạn có chắc chắn muốn trình duyệt kết quả {tên kỳ}?" với đúng tên kỳ; có nút Trình duyệt và Hủy',
    'Khảo sát: tiêu đề thực tế "Trình Lãnh đạo đơn vị phê duyệt", có khối kiểm tra hợp lệ + tiến độ/điểm tạm tính/minh chứng, nút "Xác nhận trình duyệt" và "Huỷ" → lệch SRS (MSG-064, tên nút)');
  c('RES-T05', 'C.UC1.3', 'Trình duyệt', 'Chọn Hủy ở hộp thoại xác nhận thì đóng hộp thoại và giữ nguyên trạng thái', 'Chức năng', 'Trung bình',
    '1. Bấm Trình duyệt\n2. Bấm Hủy',
    'Hộp thoại đóng; không có request submit-for-approval; trạng thái vẫn Đang chấm điểm; lịch sử không thêm dòng');
  c('RES-T06', 'C.UC1.3', 'Trình duyệt', 'Thông báo thành công đúng MSG-067 "Trình duyệt thành công"', 'UI', 'Trung bình',
    '1. Trình duyệt kết quả đủ điểm\n2. Đọc thông báo hiện ra',
    'Thông báo "Trình duyệt thành công"', 'Khảo sát: thực tế "Trình phê duyệt thành công" (API message) → lệch MSG-067');
  c('RES-T07', 'C.UC1.3', 'Trình duyệt', 'Còn chỉ số chưa có điểm: hộp thoại "Chưa trình được" với nội dung MSG-059 và không đổi trạng thái', 'Nghiệp vụ', 'Cao',
    '1. Mở kết quả còn chỉ số để trống (CB địa phương)\n2. Bấm Trình duyệt',
    'Hộp thoại tiêu đề "Chưa trình được", nội dung "Còn {n} chỉ số chưa có điểm. Vui lòng nhập đủ trước khi trình duyệt"; trạng thái không đổi; API submit không thành công',
    'Khảo sát: tiêu đề thực tế "Chưa đủ điều kiện trình duyệt", nội dung "Vui lòng khắc phục {n} lỗi dưới đây…", nút "Quay lại bổ sung"; API trả 400 "Còn n chỉ số chưa có điểm: <mã…>" → lệch MSG-059');
  c('RES-T08', 'C.UC1.3', 'Trình duyệt', 'Danh sách chỉ số thiếu điểm hiển thị mã và tên từng chỉ số', 'Chức năng', 'Cao',
    '1. Mở kết quả còn thiếu điểm; bấm Trình duyệt',
    'Mỗi dòng trong danh sách có mã và tên chỉ số thiếu điểm; số dòng = n trong thông báo');
  c('RES-T09', 'C.UC1.3', 'Trình duyệt', 'Số n trong thông báo bằng đúng số chỉ số lá chưa có điểm (không đếm chỉ số cha)', 'Nghiệp vụ', 'Cao',
    '1. Kết quả 100 chỉ số lá (120 gồm chỉ số cha), chấm 99 chỉ số\n2. Gọi Trình duyệt',
    'Thông báo "Còn 1 chỉ số chưa có điểm" và chỉ ra đúng mã chỉ số thiếu');
  c('RES-T10', 'C.UC1.3', 'Trình duyệt', 'Điểm 0 là điểm hợp lệ, ô để trống không được hiểu là 0 (BR-1)', 'Nghiệp vụ', 'Cao',
    '1. Chấm một chỉ số bằng 0, để trống một chỉ số khác, còn lại đã chấm\n2. Trình duyệt',
    'Chỉ chỉ số để trống bị báo thiếu điểm; chỉ số điểm 0 không bị báo; không có chỉ số trống nào được tự gán 0');
  c('RES-T11', 'C.UC1.3', 'Trình duyệt', 'Chỉ số cha (điểm tự cộng từ chỉ số con) không bị yêu cầu nhập điểm khi trình duyệt', 'Nghiệp vụ', 'Trung bình',
    '1. Chấm đủ mọi chỉ số lá, không có điểm trực tiếp ở chỉ số cha\n2. Trình duyệt',
    'Trình duyệt thành công, không báo thiếu điểm ở chỉ số cha');
  t('RES-T12', 'C.UC1.3', 'Trình duyệt', 'Chỉ số Không tính điểm được bỏ qua khi kiểm tra đủ điểm và không tính vào n (BR-1)', 'Nghiệp vụ', 'Trung bình',
    '1. Dùng bộ chỉ số có chỉ số Không tính điểm; chấm đủ các chỉ số tính điểm\n2. Trình duyệt',
    'Trình duyệt thành công; chỉ số Không tính điểm không xuất hiện trong danh sách thiếu điểm',
    'Manual: bộ chỉ số QC dùng thử chỉ có chỉ số tính điểm, chưa có dữ liệu chỉ số Không tính điểm trong kỳ đang diễn ra');
  c('RES-T13', 'C.UC1.3', 'Trình duyệt', 'Trình duyệt từ màn Chấm điểm: ô Điểm chấm còn trống viền đỏ kèm "Vui lòng nhập điểm chấm" (MSG-010)', 'UI', 'Trung bình',
    '1. Mở màn Chấm điểm, để trống một số ô\n2. Bấm Trình duyệt',
    'Các ô trống viền đỏ, hiện "Vui lòng nhập điểm chấm" dưới ô', 'Khảo sát: hộp thoại liệt kê "Chưa nhập điểm tự chấm"; chưa xác nhận viền đỏ + MSG-010 trên ô → kiểm khi viết script (nghi lệch)');
  c('RES-T14', 'C.UC1.3', 'Trình duyệt', 'Chọn một chỉ số trong danh sách thiếu điểm thì mở màn Chấm điểm tại chỉ số đó (EF1)', 'Chức năng', 'Trung bình',
    '1. Mở hộp thoại thiếu điểm\n2. Bấm vào một dòng chỉ số',
    'Hộp thoại đóng; màn Chấm điểm cuộn/đặt tiêu điểm tại đúng chỉ số được chọn');
  c('RES-T15', 'C.UC1.3', 'Trình duyệt', 'Nút Đóng của hộp thoại Chưa trình được đóng hộp thoại, không đổi trạng thái', 'Chức năng', 'Trung bình',
    '1. Mở hộp thoại thiếu điểm\n2. Bấm Đóng',
    'Hộp thoại đóng, use case kết thúc, trạng thái vẫn Đang chấm điểm', 'Khảo sát: nút tên "Quay lại bổ sung" thay vì "Đóng" → lệch SRS');
  c('RES-T16', 'C.UC1.3', 'Trình duyệt', 'Trình duyệt từ màn Chấm điểm có thay đổi chưa lưu: hệ thống lưu thay đổi trước rồi mới kiểm tra điểm (BR-3)', 'Nghiệp vụ', 'Cao',
    '1. Mở màn Chấm điểm, sửa điểm một chỉ số nhưng không bấm Lưu nháp\n2. Bấm Trình duyệt → xác nhận\n3. Mở lại kết quả',
    'Có request lưu điểm (PUT scores) trước request submit-for-approval; điểm mới được lưu và tính vào tổng điểm của bản trình');
  c('RES-T17', 'C.UC1.3', 'Trình duyệt', 'Kết quả Bị từ chối được chỉnh sửa và trình lại bằng chính thao tác Trình duyệt (BR-4)', 'Nghiệp vụ', 'Cao',
    '1. LĐ từ chối kết quả đã trình\n2. Cán bộ sửa điểm một chỉ số, bấm Trình duyệt → xác nhận',
    'Kết quả về Chờ duyệt; lịch sử có Trình duyệt (Bị từ chối → Chờ duyệt)');
  c('RES-T18', 'C.UC1.3', 'Trình duyệt', 'Không trình duyệt được kết quả Chưa thực hiện (chưa chấm điểm nào)', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Chưa thực hiện\n2. [API] POST submit-for-approval bằng Cán bộ',
    'Bị từ chối (4xx) với thông báo trạng thái không cho phép (MSG-060); trạng thái không đổi', S403 + 'UI không hiện nút Trình duyệt ở trạng thái này');
  c('RES-T19', 'C.UC1.3', 'Trình duyệt', 'Không trình duyệt lại kết quả đang Chờ duyệt', 'Nghiệp vụ', 'Trung bình',
    '1. ' + PRE_CHO + '\n2. [API] POST submit-for-approval lần nữa',
    'Bị từ chối (MSG-060); trạng thái vẫn Chờ duyệt; lịch sử chỉ có 1 dòng Trình duyệt', S403);
  c('RES-T20', 'C.UC1.3', 'Trình duyệt', 'Không nhảy bước: kết quả Đã phê duyệt/Đã gửi không trình duyệt được (BR-2)', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Đã phê duyệt; [API] submit-for-approval\n2. Kết quả Đã gửi; [API] submit-for-approval',
    'Cả hai bị từ chối (MSG-060); trạng thái không đổi', S403);
  c('RES-T21', 'C.UC1.3', 'Trình duyệt', 'Kỳ đã kết thúc: không trình duyệt được và báo MSG-061', 'Nghiệp vụ', 'Cao',
    '1. Mở kết quả của kỳ đã kết thúc (Chưa gửi)\n2. Xem nút; [API] POST submit-for-approval',
    'Không có nút Trình duyệt; API bị từ chối kèm MSG-061 "kỳ đã kết thúc"; trạng thái không đổi', S403);
  c('RES-T22', 'C.UC1.3', 'Trình duyệt', 'Trình duyệt ghi Lịch sử xử lý hành động Trình duyệt (người, thời gian, trạng thái chuyển)', 'Nghiệp vụ', 'Cao',
    '1. Trình duyệt thành công\n2. Mở tab Lịch sử',
    'Dòng mới nhất: "Trình duyệt", người trình, thời gian dd/mm/yyyy hh:mm, (Đang chấm điểm → Chờ duyệt)');
  c('RES-T23', 'C.TB', 'Thông báo', 'TB-005: LĐ đơn vị có quyền Phê duyệt nhận thông báo khi Cán bộ trình duyệt', 'Nghiệp vụ', 'Cao',
    '1. Cán bộ trình duyệt kết quả của QA - Đơn vị Bộ\n2. Đăng nhập LĐ đơn vị; GET notifications/mine',
    'Có thông báo "Yêu cầu phê duyệt" nêu người trình và tên kỳ, additionalData chứa assessmentResultId của kết quả');
  c('RES-T24', 'C.TB', 'Thông báo', 'TB-005: LĐ địa phương nhận thông báo khi CB địa phương trình duyệt', 'Nghiệp vụ', 'Cao',
    '1. CB địa phương trình duyệt kết quả QA - Địa phương\n2. Đăng nhập LĐ địa phương; GET notifications/mine',
    'Có thông báo yêu cầu phê duyệt tương ứng; bấm vào mở đúng kết quả');
  c('RES-T25', 'C.TB', 'Thông báo', 'TB-005 không gửi cho người không có quyền Phê duyệt hoặc ngoài phạm vi đơn vị', 'Bảo mật', 'Trung bình',
    '1. Cán bộ trình duyệt kết quả QA - Đơn vị Bộ\n2. Kiểm thông báo của CB địa phương, LĐ địa phương, Cán bộ',
    'Không ai trong các tài khoản đó có thông báo yêu cầu phê duyệt cho kết quả này');
  c('RES-T26', 'C.UC1.3', 'Trình duyệt', 'Sau khi trình duyệt, Cán bộ không còn nút Chấm điểm/Lưu nháp/Trình duyệt (tạm khóa chỉnh sửa)', 'Nghiệp vụ', 'Cao',
    '1. Trình duyệt thành công\n2. Xem nút ở đầu trang bằng Cán bộ',
    'Không còn nút Chấm điểm, Lưu nháp, Trình duyệt; không có ô nhập điểm');
  c('RES-T27', 'C.UC1.3', 'Trình duyệt', '[API] Kết quả Chờ duyệt không nhận lưu điểm từ Cán bộ', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Chờ duyệt\n2. [API] PUT scores bằng Cán bộ',
    'Bị từ chối (4xx); điểm không đổi', S403);
  c('RES-T28', 'C.UC1.3', 'Trình duyệt', '[API] Hai yêu cầu trình duyệt đồng thời chỉ một yêu cầu thành công', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả đủ điểm\n2. [API] Gửi song song 2 POST submit-for-approval',
    'Một yêu cầu 200, yêu cầu còn lại 4xx; lịch sử chỉ có 1 dòng Trình duyệt');
  c('RES-T29', 'C.UC1.3', 'Trình duyệt', 'Bấm xác nhận Trình duyệt hai lần liên tiếp chỉ trình một lần', 'Nghiệp vụ', 'Trung bình',
    '1. Mở hộp thoại Trình duyệt\n2. Bấm nút xác nhận 2 lần rất nhanh',
    'Chỉ 1 request submit-for-approval thành công; không có thông báo lỗi lạ; lịch sử 1 dòng');
  c('RES-T30', 'C.UC1.3', 'Trình duyệt', 'Server lỗi 500 khi trình duyệt: giữ trạng thái, không lộ lỗi nội bộ', 'Nghiệp vụ', 'Trung bình',
    '1. Mở hộp thoại Trình duyệt\n2. Giả lập POST submit-for-approval trả 500 (thân có chuỗi stacktrace)\n3. Xác nhận',
    'Thông báo lỗi chung dễ hiểu, không hiển thị chuỗi lỗi/stacktrace của server; trạng thái vẫn Đang chấm điểm',
    'Khảo sát: UI hiển thị nguyên chuỗi message server trả về trong toast (đã thử với thân giả lập) → nghi lỗi lộ thông tin nội bộ');
  c('RES-T31', 'C.UC1.3', 'Trình duyệt', 'Mất kết nối khi trình duyệt: có thông báo lỗi, không treo, giữ trạng thái', 'Nghiệp vụ', 'Trung bình',
    '1. Mở hộp thoại Trình duyệt\n2. Chặn mạng với request submit-for-approval\n3. Xác nhận',
    'Hiển thị thông báo lỗi kết nối; nút xác nhận dùng lại được; trạng thái không đổi');
  c('RES-T32', 'C.UC1.3', 'Trình duyệt', 'Trình duyệt thực hiện được từ menu/liên kết Xem chi tiết ở danh sách (Trigger của UC)', 'Chức năng', 'Trung bình',
    '1. Ở danh sách Kết quả tự đánh giá, mở menu thao tác của dòng Đang chấm điểm',
    'Có lựa chọn Trình duyệt cho Cán bộ', 'Khảo sát: danh sách chỉ có liên kết "Xem chi tiết", không có menu Trình duyệt; phải vào chi tiết → lệch Trigger SRS');
  c('RES-T33', 'C.UC1.3', 'Danh sách cần xử lý', 'Cán bộ xem danh sách "Cần xử lý" kỳ đột xuất: có kết quả Đang chấm điểm/Bị từ chối của đơn vị mình (UC_1409 dòng 210)', 'Chức năng', 'Trung bình',
    '1. Cán bộ mở Kết quả tự đánh giá → Đột xuất, bật Cần xử lý',
    'Danh sách chứa kết quả cần chấm/trình của đơn vị trong phạm vi; số lượng khớp huy hiệu cần xử lý');
  c('RES-T34', 'C.UC1.3', 'Danh sách cần xử lý', 'Cán bộ xem danh sách "Cần xử lý" kỳ định kỳ (UC_1409 dòng 209)', 'Chức năng', 'Trung bình',
    '1. Cán bộ mở Kết quả tự đánh giá → Định kỳ, bật Cần xử lý',
    'Danh sách chỉ gồm kết quả kỳ định kỳ cần Cán bộ xử lý; không lẫn kỳ đột xuất', 'Khảo sát: bộ lọc Cần xử lý của Cán bộ còn gồm cả kết quả Đã gửi (có thao tác Xin mở khóa/Đánh giá lại) → ' + BA);
  c('RES-T35', 'C.UC1.3', 'Trình duyệt', 'Trình duyệt kết quả có id không tồn tại không gây lỗi hệ thống', 'Validate', 'Trung bình',
    '1. [API] POST submit-for-approval với id 00000000-0000-0000-0000-000000000000',
    '404 "Không tìm thấy kết quả tự đánh giá"; không 500, không lộ lỗi nội bộ');
  c('RES-T36', 'C.UC1.3', 'Trình duyệt', 'Hộp thoại xác nhận Trình duyệt hiển thị tiến độ chấm, điểm tạm tính, số minh chứng đúng với dữ liệu', 'UI', 'Thấp',
    '1. Mở hộp thoại Trình duyệt của kết quả 100/100 chỉ số, điểm 100/200',
    'Hiển thị 100/100 chỉ số (100%), điểm tạm tính 100 / 200, minh chứng 0/100 chỉ số', 'Khảo sát: nội dung ngoài SRS (SRS chỉ có tiêu đề + MSG-064)');

  // =============================== UC1.4a PHÊ DUYỆT / UC1.4b TỪ CHỐI (RES-A) ===============================
  c('RES-A01', 'C.UC1.4a', 'Phê duyệt', 'LĐ đơn vị phê duyệt kết quả Chờ duyệt thành công', 'Chức năng', 'Cao',
    '1. ' + PRE_CHO + '\n2. Đăng nhập LĐ đơn vị; mở chi tiết; bấm Phê duyệt → xác nhận',
    'Kết quả chuyển Đã phê duyệt; nút Phê duyệt/Từ chối biến mất; Cán bộ thấy nút Gửi Bộ');
  c('RES-A02', 'C.UC1.4a', 'Phê duyệt', 'LĐ địa phương phê duyệt kết quả của đơn vị địa phương thành công', 'Chức năng', 'Cao',
    '1. CB địa phương trình duyệt kết quả QA - Địa phương\n2. LĐ địa phương bấm Phê duyệt → xác nhận',
    'Kết quả Đã phê duyệt; lịch sử có Phê duyệt do LĐ địa phương');
  c('RES-A03', 'C.UC1.4a', 'Phê duyệt', 'Hộp thoại phê duyệt có tiêu đề "Phê duyệt kết quả tự đánh giá?" và nội dung MSG-065 (tên kỳ và đơn vị)', 'UI', 'Cao',
    '1. LĐ đơn vị mở kết quả Chờ duyệt; bấm Phê duyệt',
    'Tiêu đề "Phê duyệt kết quả tự đánh giá?"; nội dung "Bạn có chắc chắn muốn phê duyệt kết quả {tên kỳ} của {đơn vị}?" đúng tên kỳ và đơn vị; nút Phê duyệt, Hủy',
    'Khảo sát: tiêu đề thực tế "Xác nhận phê duyệt kết quả tự đánh giá", hiển thị bảng Kỳ/Đơn vị/Tổng điểm phê duyệt, nút "Xác nhận phê duyệt", "Huỷ" → lệch MSG-065');
  c('RES-A04', 'C.UC1.4a', 'Phê duyệt', 'Chọn Hủy ở hộp thoại phê duyệt thì giữ nguyên trạng thái', 'Chức năng', 'Trung bình',
    '1. Bấm Phê duyệt\n2. Bấm Hủy', 'Hộp thoại đóng; không có request approve; trạng thái vẫn Chờ duyệt');
  c('RES-A05', 'C.UC1.4a', 'Phê duyệt', 'Thông báo thành công đúng MSG-068 "Phê duyệt thành công"', 'UI', 'Thấp',
    '1. Phê duyệt kết quả Chờ duyệt', 'Thông báo "Phê duyệt thành công"');
  c('RES-A06', 'C.UC1.4a', 'Phê duyệt', 'Phê duyệt ghi Lịch sử xử lý hành động Phê duyệt', 'Nghiệp vụ', 'Cao',
    '1. Phê duyệt thành công\n2. Mở tab Lịch sử',
    'Dòng "Phê duyệt" với người phê duyệt, thời gian, (Chờ duyệt → Đã phê duyệt)');
  c('RES-A07', 'C.TB', 'Thông báo', 'TB-006: Cán bộ có quyền Gửi kết quả nhận thông báo khi kết quả được phê duyệt', 'Nghiệp vụ', 'Cao',
    '1. LĐ đơn vị phê duyệt kết quả\n2. Đăng nhập Cán bộ; GET notifications/mine',
    'Có thông báo "Kết quả đã được phê duyệt, vui lòng gửi kết quả" gắn assessmentResultId; LĐ phê duyệt không nhận thông báo này');
  c('RES-A08', 'C.UC1.4a', 'Phê duyệt', 'Không phê duyệt được kết quả chưa ở trạng thái Chờ duyệt (Đang chấm điểm)', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Đang chấm điểm\n2. [API] POST approve bằng LĐ đơn vị',
    'Bị từ chối (MSG-060); trạng thái không đổi', S403);
  c('RES-A09', 'C.UC1.4a', 'Phê duyệt', 'Không phê duyệt lại kết quả đã Đã phê duyệt/Đã gửi', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Đã phê duyệt rồi Đã gửi\n2. [API] POST approve',
    'Bị từ chối; lịch sử không thêm dòng Phê duyệt', S403);
  c('RES-A10', 'C.UC1.4a', 'Phê duyệt', '[API] Hai yêu cầu phê duyệt đồng thời chỉ một yêu cầu thành công', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Chờ duyệt\n2. [API] Gửi song song 2 POST approve',
    'Một 200; một 4xx báo "Kết quả vừa được người khác cập nhật, vui lòng tải lại trang"; 1 dòng Phê duyệt trong lịch sử');
  t('RES-A11', 'C.UC1.4a', 'Phê duyệt', 'Kỳ kết thúc khi kết quả còn Chờ duyệt: không phê duyệt được và báo MSG-061', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Chờ duyệt, chờ qua hạn 23:59 ngày kết thúc kỳ\n2. LĐ bấm/gọi Phê duyệt',
    'Bị từ chối kèm MSG-061; kết quả bị khóa theo kỳ đã kết thúc',
    'Manual: cần chờ kỳ hết hạn hoặc chỉnh giờ hệ thống; không thể tạo kỳ đã kết thúc mà kết quả đang Chờ duyệt');
  c('RES-A12', 'C.UC1.4a', 'Phê duyệt', 'Phê duyệt kết quả có id không tồn tại không gây lỗi hệ thống', 'Validate', 'Trung bình',
    '1. [API] POST approve với id 00000000-0000-0000-0000-000000000000', '404 "Không tìm thấy kết quả tự đánh giá"; không 500');
  c('RES-A13', 'C.UC1.4a', 'Phê duyệt', 'Server lỗi 500 khi phê duyệt: giữ trạng thái, không lộ lỗi nội bộ', 'Nghiệp vụ', 'Trung bình',
    '1. Mở hộp thoại Phê duyệt\n2. Giả lập POST approve trả 500\n3. Xác nhận',
    'Thông báo lỗi chung; không lộ stacktrace; kết quả vẫn Chờ duyệt', 'Khảo sát: UI echo nguyên message của server (xem RES-T30) → nghi lỗi');
  c('RES-A14', 'C.UC1.4b', 'Từ chối', 'Hộp thoại từ chối có tiêu đề "Từ chối kết quả tự đánh giá?" và trường Lý do từ chối', 'UI', 'Cao',
    '1. LĐ đơn vị mở kết quả Chờ duyệt; bấm Từ chối',
    'Tiêu đề "Từ chối kết quả tự đánh giá?"; có ô Lý do từ chối bắt buộc; nút Từ chối, Hủy',
    'Khảo sát: tiêu đề thực tế "Từ chối phê duyệt kết quả tự đánh giá", nút "Xác nhận từ chối", "Huỷ" → lệch SRS');
  c('RES-A15', 'C.UC1.4b', 'Từ chối', 'LĐ đơn vị từ chối kết quả Chờ duyệt kèm lý do hợp lệ thành công', 'Chức năng', 'Cao',
    '1. ' + PRE_CHO + '\n2. LĐ đơn vị bấm Từ chối, nhập lý do, xác nhận',
    'Kết quả chuyển Bị từ chối; Cán bộ có lại nút Chấm điểm/Trình duyệt');
  c('RES-A16', 'C.UC1.4b', 'Từ chối', 'LĐ địa phương từ chối kết quả của đơn vị địa phương thành công', 'Chức năng', 'Cao',
    '1. CB địa phương trình duyệt\n2. LĐ địa phương Từ chối với lý do hợp lệ', 'Kết quả Bị từ chối; lịch sử có Từ chối do LĐ địa phương');
  c('RES-A17', 'C.UC1.4b', 'Từ chối', 'Thông báo thành công đúng MSG-069 "Từ chối thành công"', 'UI', 'Thấp',
    '1. Từ chối kết quả với lý do hợp lệ', 'Thông báo "Từ chối thành công"');
  c('RES-A18', 'C.UC1.4b', 'Từ chối', 'Để trống lý do báo "Vui lòng nhập lý do" (MSG-058) dưới ô nhập và không từ chối', 'Validate', 'Cao',
    '1. Bấm Từ chối\n2. Để trống lý do, xác nhận',
    'Hiện "Vui lòng nhập lý do" ngay dưới ô nhập; hộp thoại còn mở; trạng thái không đổi; (API 400)',
    'Khảo sát: thông báo hiện dạng toast "Vui lòng nhập lý do từ chối" (không inline dưới ô) → lệch MSG-058');
  c('RES-A19', 'C.UC1.4b', 'Từ chối', 'Lý do chỉ gồm khoảng trắng bị chặn như để trống', 'Validate', 'Trung bình',
    '1. Nhập 3 dấu cách vào lý do; xác nhận', 'Báo lỗi bắt buộc (MSG-058); không từ chối');
  c('RES-A20', 'C.UC1.4b', 'Từ chối', 'Lý do đúng 255 ký tự được chấp nhận', 'Validate', 'Trung bình',
    '1. Nhập lý do 255 ký tự; xác nhận', 'Từ chối thành công; lý do lưu đủ 255 ký tự (qua API lịch sử)');
  c('RES-A21', 'C.UC1.4b', 'Từ chối', '[API] Lý do 256 ký tự bị từ chối', 'Validate', 'Cao',
    '1. [API] POST reject với reason 256 ký tự', '400 "Lý do từ chối tối đa 255 ký tự"; trạng thái vẫn Chờ duyệt');
  c('RES-A22', 'C.UC1.4b', 'Từ chối', 'Ô nhập lý do trên giao diện giới hạn tối đa 255 ký tự', 'UI', 'Trung bình',
    '1. Mở hộp thoại Từ chối\n2. Dán chuỗi 300 ký tự vào ô lý do',
    'Ô chỉ nhận 255 ký tự hoặc báo vượt giới hạn ngay tại ô', 'Khảo sát: ô có maxlength=1000, người dùng nhập 256+ ký tự mới bị API chặn bằng toast → lệch BR-1');
  c('RES-A23', 'C.UC1.4b', 'Từ chối', 'Chọn Hủy sau khi đã nhập lý do thì không từ chối và giữ nguyên trạng thái', 'Chức năng', 'Trung bình',
    '1. Bấm Từ chối, nhập lý do\n2. Bấm Hủy', 'Hộp thoại đóng; không có request reject; trạng thái vẫn Chờ duyệt; mở lại hộp thoại thì ô lý do trống');
  c('RES-A24', 'C.UC1.4b', 'Từ chối', 'Từ chối ghi Lịch sử xử lý kèm lý do', 'Nghiệp vụ', 'Cao',
    '1. Từ chối với lý do "qc.automation lý do"\n2. Mở tab Lịch sử',
    'Dòng "Từ chối" (Chờ duyệt → Bị từ chối) có "Lý do: qc.automation lý do"');
  c('RES-A25', 'C.UC1.4b', 'Từ chối', 'Lý do từ chối hiển thị ở thông tin bổ sung màn chi tiết (người từ chối, ngày, lý do)', 'Chức năng', 'Cao',
    '1. Từ chối kết quả\n2. Mở chi tiết bằng Cán bộ',
    'Khối thông tin bổ sung nêu người từ chối (LĐ đơn vị), ngày từ chối và lý do đầy đủ');
  c('RES-A26', 'C.TB', 'Thông báo', 'TB-007: Cán bộ nhận thông báo kèm lý do khi kết quả bị từ chối', 'Nghiệp vụ', 'Cao',
    '1. LĐ đơn vị từ chối với lý do cụ thể\n2. Cán bộ GET notifications/mine', 'Có thông báo "Kết quả bị từ chối" chứa đúng lý do và assessmentResultId');
  c('RES-A27', 'C.UC1.4b', 'Từ chối', 'Lý do chứa HTML và ký tự đặc biệt hiển thị nguyên văn, không thực thi', 'Bảo mật', 'Trung bình',
    '1. Từ chối với lý do `<b>x</b> & "q" <img src=x onerror=alert(1)>`\n2. Xem thông tin bổ sung, lịch sử, thông báo',
    'Hiển thị đúng chuỗi gốc ở mọi nơi; không in đậm, không chạy script');
  c('RES-A28', 'C.UC1.4b', 'Từ chối', 'Không từ chối được kết quả không ở trạng thái Chờ duyệt', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Đã phê duyệt\n2. [API] POST reject với lý do hợp lệ', 'Bị từ chối (MSG-060); trạng thái vẫn Đã phê duyệt', S403);
  c('RES-A29', 'C.UC1.4b', 'Từ chối', 'Không từ chối lặp kết quả đã Bị từ chối', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Bị từ chối\n2. [API] POST reject lần nữa', 'Bị từ chối; lịch sử không thêm dòng Từ chối', S403);
  c('RES-A30', 'C.UC1.4b', 'Từ chối', 'Sau khi bị từ chối Cán bộ sửa điểm và trình lại; thông tin từ chối cũ không còn ở bản trình mới (BR-2)', 'Nghiệp vụ', 'Trung bình',
    '1. Từ chối kết quả\n2. Cán bộ sửa 1 điểm, trình lại\n3. Xem chi tiết ở Chờ duyệt',
    'Trạng thái Chờ duyệt; khối bị từ chối không còn hiển thị; lịch sử vẫn giữ dòng Từ chối cũ');
  c('RES-A31', 'C.UC1.4b', 'Từ chối', 'Từ chối nhiều lần: lịch sử giữ đủ lý do của từng lần theo thứ tự mới → cũ', 'Nghiệp vụ', 'Trung bình',
    '1. Từ chối lần 1 (lý do A), Cán bộ trình lại\n2. Từ chối lần 2 (lý do B)\n3. Mở Lịch sử',
    'Hai dòng Từ chối với lý do A và B đúng thứ tự; thông tin bổ sung hiện lý do B');
  c('RES-A32', 'C.UC1.4b', 'Từ chối', 'Server lỗi 500 khi từ chối: giữ hộp thoại và lý do đã nhập, không lộ lỗi nội bộ', 'Nghiệp vụ', 'Trung bình',
    '1. Nhập lý do hợp lệ\n2. Giả lập POST reject trả 500\n3. Xác nhận', 'Thông báo lỗi chung; hộp thoại còn mở giữ lý do; trạng thái vẫn Chờ duyệt');
  c('RES-A33', 'C.UC1.4a', 'Danh sách cần phê duyệt', 'LĐ xem danh sách cần phê duyệt kỳ định kỳ của đơn vị mình (UC_1409 dòng 212)', 'Chức năng', 'Trung bình',
    '1. LĐ đơn vị mở Kết quả tự đánh giá → Định kỳ, bật Cần xử lý', 'Danh sách gồm các kết quả Chờ duyệt kỳ định kỳ thuộc phạm vi; không có kỳ đột xuất');
  c('RES-A34', 'C.UC1.4a', 'Danh sách cần phê duyệt', 'LĐ xem danh sách cần phê duyệt kỳ đột xuất của đơn vị mình (UC_1409 dòng 213)', 'Chức năng', 'Trung bình',
    '1. Cán bộ trình duyệt 1 kết quả đột xuất\n2. LĐ đơn vị mở Đột xuất, bật Cần xử lý', 'Kết quả vừa trình có trong danh sách; huy hiệu cần xử lý tăng 1');
  c('RES-A35', 'C.UC1.4a', 'Danh sách cần phê duyệt', 'Danh sách cần phê duyệt của LĐ địa phương không chứa kết quả đơn vị Bộ (ngoài phạm vi)', 'Bảo mật', 'Cao',
    '1. Cán bộ trình kết quả QA - Đơn vị Bộ\n2. LĐ địa phương mở danh sách Cần xử lý', 'Không thấy kết quả của QA - Đơn vị Bộ; tổng số bản ghi không tính kết quả này');

  // =============================== UC1.5 GỬI KẾT QUẢ CHO BỘ (RES-F) ===============================
  const PRE_PD = 'Chuẩn bị: kết quả đã Đã phê duyệt (Cán bộ trình, LĐ phê duyệt), kỳ còn hạn. ';
  c('RES-F01', 'C.UC1.5', 'Gửi Bộ', 'Cán bộ gửi kết quả cho Bộ với File ký số (PDF) thành công', 'Chức năng', 'Cao',
    '1. ' + PRE_PD + '\n2. Cán bộ mở chi tiết, đính kèm file PDF, chọn loại File ký số\n3. Bấm Gửi và xác nhận',
    'Kết quả chuyển Đã gửi; có 1 lần gửi trong Hồ sơ gửi Bộ; nút Gửi Bộ biến mất; hiển thị điểm chính thức và xếp loại');
  c('RES-F02', 'C.UC1.5', 'Gửi Bộ', 'CB địa phương gửi kết quả bằng File scan ký tươi thành công', 'Chức năng', 'Cao',
    '1. Kết quả QA - Địa phương Đã phê duyệt\n2. CB địa phương đính kèm PDF, chọn loại File scan ký tươi, gửi', 'Đã gửi; Hồ sơ gửi Bộ ghi loại "File scan ký tươi"');
  t('RES-F03', 'C.UC1.5', 'Gửi Bộ', 'Cán bộ gửi kết quả kỳ định kỳ đã phê duyệt cho Bộ (UC_1409 dòng 219/220)', 'Chức năng', 'Cao',
    '1. Có kết quả kỳ định kỳ Đã phê duyệt còn hạn\n2. Đính kèm PDF ký số; gửi', 'Kết quả chuyển Đã gửi như kỳ đột xuất',
    'Manual: chưa dựng được kết quả kỳ định kỳ (kỳ định kỳ mới tạo chưa sinh kết quả cho đơn vị)', 'Ghi chú UC_1409 dòng 219/220: "Đang lỗi tạo tự đánh giá nên chưa test được thông báo gửi đến đúng theo từng role"');
  c('RES-F04', 'C.UC1.5', 'Gửi Bộ', 'Hộp thoại gửi có tiêu đề "Gửi kết quả cho Bộ?", nội dung MSG-066, trường Loại file và File kết quả', 'UI', 'Cao',
    '1. Cán bộ mở kết quả Đã phê duyệt; bấm Gửi Bộ', 'Hộp thoại "Gửi kết quả cho Bộ?" nội dung "Bạn có chắc chắn muốn gửi kết quả {tên kỳ} cho Bộ? Sau khi gửi chỉ chỉnh sửa được khi được mở khóa" kèm Loại file, File kết quả, nút Gửi kết quả/Hủy',
    'Khảo sát: nút Gửi Bộ chỉ cuộn tới tab Hồ sơ gửi Bộ (khung đính kèm + Hình thức văn bản + Số hiệu + Ngày ký + Ghi chú); hộp xác nhận mới hiện sau khi bấm "Gửi kết quả về Bộ", tiêu đề "Xác nhận gửi kết quả tự đánh giá về Bộ" → lệch UI-1.5.1');
  c('RES-F05', 'C.UC1.5', 'Gửi Bộ', 'Chọn Hủy ở hộp thoại gửi thì giữ nguyên trạng thái và không tạo lần gửi', 'Chức năng', 'Trung bình',
    '1. Đính kèm PDF; bấm gửi\n2. Bấm Hủy ở hộp xác nhận', 'Hộp thoại đóng; không có request send; vẫn Đã phê duyệt; Hồ sơ gửi Bộ chưa có lần gửi');
  c('RES-F06', 'C.UC1.5', 'Gửi Bộ', 'Thông báo thành công đúng MSG-070 "Gửi kết quả thành công"', 'UI', 'Thấp',
    '1. Gửi kết quả hợp lệ', 'Thông báo "Gửi kết quả thành công"', 'Khảo sát: thực tế "Gửi kết quả tự đánh giá thành công" → lệch MSG-070');
  c('RES-F07', 'C.UC1.5', 'Gửi Bộ', 'Chưa đính kèm file kết quả báo MSG-050 "Vui lòng đính kèm file kết quả"', 'Validate', 'Cao',
    '1. Mở kết quả Đã phê duyệt, chưa chọn file\n2. Bấm gửi ([API] POST send không attachmentId)', 'Báo "Vui lòng đính kèm file kết quả"; không gửi; trạng thái vẫn Đã phê duyệt',
    'Khảo sát: API đúng MSG-050; UI hiện toast "Vui lòng kiểm tra và tải lên văn bản xác nhận (PDF) trước khi gửi Bộ" → lệch MSG-050 ở UI');
  c('RES-F08', 'C.UC1.5', 'Gửi Bộ', 'Tệp không phải PDF (txt/docx/exe) bị từ chối với MSG-046', 'Validate', 'Cao',
    '1. Chọn tệp .txt\n2. Chọn tệp .exe\n3. [API] upload docType assessment_result_file với từng tệp', 'Mỗi lần báo "Tệp không đúng định dạng. Chỉ chấp nhận PDF"; tệp không được nhận',
    'Khảo sát: thông báo thực tế "Chỉ chấp nhận tệp PDF" → lệch MSG-046');
  c('RES-F09', 'C.UC1.5', 'Gửi Bộ', 'Tệp đổi đuôi .pdf nhưng nội dung không phải PDF bị từ chối', 'Validate', 'Trung bình',
    '1. Tạo tệp văn bản "not a pdf" đặt tên a.pdf\n2. Tải lên', 'Bị từ chối (MSG-046) vì nội dung không phải PDF', 'Khảo sát: API nhận tệp (chỉ kiểm đuôi) → nghi lỗi. ' + BA + ' việc kiểm nội dung');
  c('RES-F10', 'C.UC1.5', 'Gửi Bộ', 'Tệp PDF 0 byte bị từ chối', 'Validate', 'Trung bình',
    '1. Tải lên tệp rỗng empty.pdf', 'Bị từ chối với thông báo tệp không hợp lệ', 'Khảo sát: API nhận tệp 0 byte → nghi lỗi. ' + BA);
  c('RES-F11', 'C.UC1.5', 'Gửi Bộ', 'Tệp PDF đúng 20 MB được chấp nhận', 'Validate', 'Cao',
    '1. Tải lên PDF có dung lượng đúng 20 MB (20*1024*1024 byte)', 'Tải lên thành công, hiển thị tên và dung lượng');
  c('RES-F12', 'C.UC1.5', 'Gửi Bộ', 'Tệp PDF vượt 20 MB (21 MB) bị từ chối với MSG-047', 'Validate', 'Cao',
    '1. Tải lên PDF 21 MB', 'Báo "Tệp vượt quá dung lượng 20 MB"; tệp không được nhận', 'Khảo sát: thông báo thực tế "Tệp tối đa 20 MB" → lệch MSG-047');
  c('RES-F13', 'C.UC1.5', 'Gửi Bộ', 'Chỉ nhận đúng một tệp: không chọn được nhiều tệp cùng lúc', 'Validate', 'Trung bình',
    '1. Kiểm thuộc tính input file\n2. Thử chọn 2 tệp PDF cùng lúc', 'Chỉ 1 tệp được nhận (input không multiple); tệp thứ hai bị bỏ hoặc có thông báo');
  c('RES-F14', 'C.UC1.5', 'Gửi Bộ', 'Xóa tệp đã chọn rồi chọn tệp khác (AF1)', 'Chức năng', 'Trung bình',
    '1. Chọn a.pdf\n2. Bấm Xóa ở tệp\n3. Chọn b.pdf\n4. Gửi', 'Sau Xóa khung đính kèm trống; gửi dùng b.pdf; Hồ sơ gửi Bộ ghi tên b.pdf');
  c('RES-F15', 'C.UC1.5', 'Gửi Bộ', 'Tệp đã chọn hiển thị tên và dung lượng', 'UI', 'Thấp',
    '1. Chọn PDF 1 KB', 'Hiển thị đúng tên và dung lượng tệp', 'Khảo sát: khung chỉ hiện tên tệp, chưa thấy dung lượng trước khi gửi → ' + BA);
  c('RES-F16', 'C.UC1.5', 'Gửi Bộ', '[API] Thiếu hoặc sai Loại file bị từ chối', 'Validate', 'Cao',
    '1. [API] POST send với attachmentId hợp lệ và fileType rỗng\n2. fileType="Foo"', '400 "Vui lòng chọn loại file: File ký số hoặc File scan ký tươi"; không gửi');
  c('RES-F17', 'C.UC1.5', 'Gửi Bộ', 'Loại file File scan ký tươi được lưu đúng trong Hồ sơ gửi Bộ', 'Chức năng', 'Trung bình',
    '1. Gửi lần đầu với loại File scan ký tươi\n2. Xem Hồ sơ gửi Bộ', 'Dòng lần gửi hiển thị "File scan ký tươi"');
  c('RES-F18', 'C.UC1.5', 'Gửi Bộ', 'Gửi lại sau khi được mở khóa mà chọn File scan ký tươi báo MSG-063', 'Nghiệp vụ', 'Cao',
    '1. Gửi lần 1; xin mở khóa; Bộ duyệt; chấm lại, trình, phê duyệt\n2. Gửi lần 2 với loại File scan ký tươi', '400 "Gửi lại kết quả phải kèm file ký số mới"; không tạo lần gửi mới');
  c('RES-F19', 'C.UC1.5', 'Gửi Bộ', 'Gửi lại sau khi Bộ yêu cầu đánh giá lại (bị trả lại) phải kèm file ký số mới', 'Nghiệp vụ', 'Cao',
    '1. Gửi lần 1; Bộ chọn Yêu cầu đánh giá lại; Cán bộ chỉnh sửa, trình, phê duyệt\n2. Gửi với File scan ký tươi', '400 MSG-063; gửi với File ký số thành công');
  c('RES-F20', 'C.UC1.5', 'Gửi Bộ', 'Gửi lại không được dùng chính tệp đã gửi ở lần trước làm "file ký số mới"', 'Nghiệp vụ', 'Cao',
    '1. Gửi lần 1 với tệp A\n2. Mở khóa, chấm lại, trình, phê duyệt\n3. [API] POST send với attachmentId của tệp A, loại File ký số', 'Bị từ chối vì không phải tệp mới', 'Khảo sát: API nhận lại attachmentId của lần gửi trước và tạo lần gửi mới → nghi lỗi lệch BR-3. ' + BA);
  c('RES-F21', 'C.UC1.5', 'Gửi Bộ', 'Gửi lại kèm file ký số mới thành công: lần gửi 2 là bản chính thức, lần 1 bỏ nhãn', 'Nghiệp vụ', 'Cao',
    '1. Gửi lần 1; mở khóa; hoàn tất trình/phê duyệt\n2. Gửi lần 2 với tệp mới File ký số\n3. Xem Hồ sơ gửi Bộ', 'Có 2 lần gửi; lần 2 gắn "Kết quả chính thức", lần 1 không gắn; kết quả Đã gửi');
  t('RES-F22', 'C.UC1.5', 'Gửi Bộ', 'Quá hạn nộp (sau 23:59 ngày kết thúc kỳ) không gửi bù, báo MSG-062', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Đã phê duyệt nhưng kỳ đã quá 23:59 ngày kết thúc\n2. Cán bộ gửi', 'Báo "Đã quá hạn nộp. Không thể gửi bù"; kết quả bị khóa',
    'Manual: cần kỳ hết hạn khi kết quả đang Đã phê duyệt (không thể sinh bằng dữ liệu thử vì không thể lùi ngày kết thúc kỳ)');
  c('RES-F23', 'C.UC1.5', 'Gửi Bộ', 'Không gửi được kết quả chưa ở trạng thái Đã phê duyệt (Chờ duyệt/Đang chấm điểm)', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Chờ duyệt\n2. [API] POST send hợp lệ', 'Bị từ chối (MSG-060); trạng thái không đổi; không tạo lần gửi', S403);
  c('RES-F24', 'C.UC1.5', 'Gửi Bộ', 'Gửi ghi Lịch sử Gửi Bộ và lưu một lần gửi mới vào Hồ sơ gửi Bộ', 'Nghiệp vụ', 'Cao',
    '1. Gửi thành công\n2. Mở tab Lịch sử và Hồ sơ gửi Bộ', 'Lịch sử có "Gửi Bộ" (Đã phê duyệt → Đã gửi); Hồ sơ gửi Bộ có đúng 1 lần gửi');
  c('RES-F25', 'C.UC1.5', 'Gửi Bộ', 'Hồ sơ gửi Bộ liệt kê lần gửi, loại file, tên file, dung lượng, người gửi, thời gian dd/mm/yyyy hh:mm', 'Chức năng', 'Trung bình',
    '1. Sau khi gửi, mở tab Hồ sơ gửi Bộ', 'Mỗi lần gửi hiển thị đủ các thông tin trên, thời gian đúng định dạng', 'Khảo sát: hiển thị dạng thẻ "Lần gửi #n", chưa thấy cột Dung lượng → ' + BA);
  c('RES-F26', 'C.UC1.5', 'Gửi Bộ', 'Sau khi gửi, kết quả chỉ xem: Cán bộ không còn Chấm điểm/Lưu nháp/Trình duyệt và API lưu điểm bị chặn (BR-5)', 'Nghiệp vụ', 'Cao',
    '1. Gửi thành công\n2. Xem nút; [API] PUT scores bằng Cán bộ', 'Không có nút sửa; API bị từ chối; điểm không đổi', S403);
  c('RES-F27', 'C.UC1.5', 'Gửi Bộ', 'Số hiệu văn bản quá 50 ký tự bị từ chối', 'Validate', 'Thấp',
    '1. [API] POST send với documentNumber 300 ký tự', '400 "Số văn bản tối đa 50 ký tự"', 'Khảo sát: trường ngoài SRS (Số hiệu văn bản)');
  c('RES-F28', 'C.UC1.5', 'Gửi Bộ', 'Ghi chú gửi Bộ quá 500 ký tự bị từ chối', 'Validate', 'Thấp',
    '1. [API] POST send với note 5000 ký tự', '400 "Ghi chú gửi Bộ tối đa 500 ký tự"', 'Khảo sát: trường ngoài SRS (Ghi chú gửi Bộ)');
  c('RES-F29', 'C.UC1.5', 'Gửi Bộ', 'Ngày ký ban hành ở tương lai bị từ chối', 'Validate', 'Thấp',
    '1. [API] POST send với documentDate 2030-01-01', '400 "Ngày văn bản không được sau ngày hôm nay"');
  c('RES-F30', 'C.UC1.5', 'Gửi Bộ', 'Ngày ký ban hành sai định dạng báo lỗi đúng nguyên nhân', 'Validate', 'Thấp',
    '1. [API] POST send với documentDate="abc" và tệp hợp lệ', 'Báo lỗi định dạng ngày', 'Khảo sát: API trả "Vui lòng đính kèm file kết quả" (sai nguyên nhân) → nghi lỗi');
  c('RES-F31', 'C.UC1.5', 'Gửi Bộ', 'Tải về tệp của lần gửi trong Hồ sơ gửi Bộ tải được', 'Chức năng', 'Cao',
    '1. Sau khi gửi, tại Hồ sơ gửi Bộ bấm Tải về tệp', 'Tải về được đúng tệp PDF đã gửi (tên và dung lượng khớp)', 'Khảo sát: liên kết trỏ tới http://localhost:3001/files/... → trang chrome-error, không tải được → nghi lỗi');
  c('RES-F32', 'C.UC1.5', 'Gửi Bộ', 'Đường dẫn tệp (fileUrl) trong API không lộ địa chỉ máy chủ nội bộ', 'Bảo mật', 'Cao',
    '1. [API] GET submissions của kết quả đã gửi\n2. Đọc fileUrl', 'fileUrl dùng tên miền công khai của hệ thống, không chứa localhost/IP nội bộ', 'Khảo sát: fileUrl = http://localhost:3001/files/... → nghi lỗi lộ cấu hình nội bộ');
  c('RES-F33', 'C.UC1.5', 'Gửi Bộ', 'Tải về tệp đã gửi nhưng tệp không còn báo MSG-049', 'Validate', 'Thấp',
    '1. Xóa tệp vật lý của lần gửi\n2. Bấm Tải về', 'Báo "Tệp không tồn tại hoặc đã bị xóa"');
  c('RES-F34', 'C.UC1.5', 'Gửi Bộ', 'Tên tệp tiếng Việt có dấu và dấu gạch ngang được giữ nguyên khi hiển thị', 'Validate', 'Thấp',
    '1. Tải lên tệp "Báo-cáo CĐS-2026.pdf"\n2. Xem tên tệp trong khung đính kèm và Hồ sơ gửi Bộ', 'Hiển thị đúng tên gốc', 'Khảo sát: dấu gạch ngang bị loại ("qca-test.pdf" → "qcatest.pdf") → nghi lỗi chuẩn hóa tên');
  c('RES-F35', 'C.UC1.5', 'Gửi Bộ', 'Tên tệp chứa ký tự HTML hiển thị nguyên văn', 'Bảo mật', 'Thấp',
    '1. Tải lên tệp tên `a<b>x</b>.pdf`', 'Tên hiển thị đúng chuỗi, không in đậm/không chạy script');
  c('RES-F36', 'C.UC1.5', 'Gửi Bộ', 'Sau khi gửi, tệp đính kèm chưa dùng không còn nằm lại ở khung đính kèm của lần gửi sau', 'Nghiệp vụ', 'Thấp',
    '1. Tải lên tệp A rồi tải lên tệp B (thay thế); gửi với B\n2. Xem khung đính kèm sau khi gửi', 'Khung đính kèm không còn tệp cũ chưa dùng', 'Khảo sát: sau khi gửi khung vẫn hiện tệp tải lên trước (qcaok.pdf) → ' + BA);
  c('RES-F37', 'C.UC1.5', 'Gửi Bộ', 'Server lỗi 500 khi gửi: giữ hộp thoại và tệp, không lộ lỗi nội bộ', 'Nghiệp vụ', 'Trung bình',
    '1. Đính kèm PDF, mở hộp xác nhận\n2. Giả lập POST send trả 500\n3. Xác nhận', 'Thông báo lỗi chung; hộp thoại giữ nguyên; trạng thái vẫn Đã phê duyệt', 'Khảo sát: toast hiển thị nguyên message server (xem RES-T30) → nghi lỗi');
  c('RES-F38', 'C.UC1.5', 'Gửi Bộ', 'Mất kết nối khi gửi: có thông báo lỗi, không đóng im lặng', 'Nghiệp vụ', 'Trung bình',
    '1. Đính kèm PDF, mở hộp xác nhận\n2. Chặn mạng với POST send\n3. Xác nhận', 'Có thông báo lỗi kết nối; trạng thái không đổi; người dùng gửi lại được', 'Khảo sát: hộp thoại tự đóng, không có thông báo → người dùng tưởng đã gửi → nghi lỗi');
  c('RES-F39', 'C.UC1.5', 'Gửi Bộ', '[API] Gửi đồng thời 2 yêu cầu chỉ tạo một lần gửi', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Đã phê duyệt có tệp hợp lệ\n2. [API] Gửi song song 2 POST send', 'Một 200, một 4xx; Hồ sơ gửi Bộ có đúng 1 lần gửi');
  c('RES-F40', 'C.UC1.5', 'Gửi Bộ', 'Gửi kết quả có id không tồn tại hoặc attachmentId lạ không gây lỗi hệ thống', 'Validate', 'Trung bình',
    '1. [API] POST send id lạ\n2. [API] POST send với attachmentId 00000000-0000-0000-0000-000000000000', '404 cho id lạ; 400 "Vui lòng đính kèm file kết quả" cho attachmentId lạ; không 500');
  c('RES-F41', 'C.TB', 'Thông báo', 'TB-008: người có quyền Quản lý kết quả (Xem chi tiết) của đơn vị cấp trên nhận thông báo khi đơn vị gửi kết quả', 'Nghiệp vụ', 'Cao',
    '1. CB địa phương (QA - Địa phương, trực thuộc QA - Đơn vị Bộ) gửi kết quả\n2. Đăng nhập LĐ Bộ; GET notifications/mine', 'Có thông báo "Đã có kết quả tự đánh giá" nêu đơn vị và tên kỳ',
    'Khảo sát: với kết quả của QA - Đơn vị Bộ (không có đơn vị cha) LĐ Bộ/LĐ đơn vị không nhận TB-008 → ' + BA + ' người nhận TB-008');
  c('RES-F42', 'C.UC1.5', 'Danh sách đã phê duyệt', 'Cán bộ xem danh sách kết quả kỳ định kỳ đã được phê duyệt chờ gửi (UC_1409 dòng 217)', 'Chức năng', 'Trung bình',
    '1. Cán bộ mở Kết quả tự đánh giá → Định kỳ, lọc trạng thái Đã phê duyệt', 'Chỉ liệt kê kết quả định kỳ Đã phê duyệt trong phạm vi; mỗi dòng có chi tiết để Gửi Bộ');
  c('RES-F43', 'C.UC1.5', 'Danh sách đã phê duyệt', 'Cán bộ xem danh sách kết quả kỳ đột xuất đã được phê duyệt chờ gửi (UC_1409 dòng 218)', 'Chức năng', 'Trung bình',
    '1. LĐ phê duyệt 1 kết quả đột xuất\n2. Cán bộ lọc trạng thái Đã phê duyệt ở tab Đột xuất', 'Kết quả vừa duyệt xuất hiện; số lượng ở thẻ "Đã phê duyệt" khớp số dòng');

  // =============================== UC1.6 XIN MỞ KHÓA (RES-U) ===============================
  const PRE_G = 'Chuẩn bị: kết quả đã Đã gửi, kỳ còn hạn. ';
  c('RES-U01', 'C.UC1.6', 'Xin mở khóa', 'Người dùng có quyền Yêu cầu mở khóa xin mở khóa kết quả Đã gửi thành công (UC_1409 dòng 226)', 'Chức năng', 'Cao',
    '1. ' + PRE_G + '\n2. Mở chi tiết; bấm Xin mở khóa; nhập lý do; bấm Gửi yêu cầu', 'Kết quả chuyển Chờ mở khóa; hiển thị thông tin chờ Bộ xử lý kèm lý do', 'Khảo sát: nút có với Cán bộ (role có DTI_ASSESSMENT.REQUEST_UNLOCK)');
  c('RES-U02', 'C.UC1.6', 'Xin mở khóa', 'Hộp thoại có tiêu đề "Xin mở khóa kết quả?", giải thích và trường Lý do xin mở khóa', 'UI', 'Cao',
    '1. Bấm Xin mở khóa', 'Tiêu đề "Xin mở khóa kết quả?"; giải thích "Sau khi Bộ duyệt, kết quả quay về Đang chấm điểm để đơn vị chỉnh sửa và gửi lại trước hạn"; ô Lý do; nút Gửi yêu cầu, Hủy',
    'Khảo sát: tiêu đề thực tế "Xin mở khóa kết quả tự đánh giá đã gửi", giải thích khác chữ, nút "Gửi yêu cầu mở khóa"/"Huỷ" → lệch UI-1.6.1');
  c('RES-U03', 'C.UC1.6', 'Xin mở khóa', 'Thông báo thành công đúng MSG-071 "Gửi yêu cầu mở khóa thành công"', 'UI', 'Thấp',
    '1. Xin mở khóa với lý do hợp lệ', 'Thông báo "Gửi yêu cầu mở khóa thành công"', 'Khảo sát: thực tế "Đã gửi yêu cầu mở khóa thành công" → lệch MSG-071');
  c('RES-U04', 'C.UC1.6', 'Xin mở khóa', 'Chọn Hủy thì đóng hộp thoại, giữ nguyên Đã gửi', 'Chức năng', 'Trung bình',
    '1. Bấm Xin mở khóa, nhập lý do\n2. Bấm Hủy', 'Không có request request-unlock; vẫn Đã gửi');
  c('RES-U05', 'C.UC1.6', 'Xin mở khóa', 'Để trống lý do báo "Vui lòng nhập lý do" (MSG-058) dưới ô nhập', 'Validate', 'Cao',
    '1. Bấm Xin mở khóa; để trống lý do; gửi', 'Báo MSG-058 dưới ô nhập; không gửi; (API 400)', 'Khảo sát: toast "Vui lòng nhập lý do xin mở khóa" (không inline) → lệch MSG-058');
  c('RES-U06', 'C.UC1.6', 'Xin mở khóa', 'Lý do chỉ khoảng trắng bị chặn', 'Validate', 'Trung bình',
    '1. Nhập 3 dấu cách; gửi', 'Báo lỗi bắt buộc; không đổi trạng thái');
  c('RES-U07', 'C.UC1.6', 'Xin mở khóa', 'Lý do đúng 255 ký tự được chấp nhận', 'Validate', 'Trung bình',
    '1. Nhập lý do 255 ký tự; gửi', 'Gửi yêu cầu thành công; lý do lưu đủ');
  c('RES-U08', 'C.UC1.6', 'Xin mở khóa', '[API] Lý do 256 ký tự bị từ chối', 'Validate', 'Cao',
    '1. [API] POST request-unlock với reason 256 ký tự', '400 "Lý do xin mở khóa tối đa 255 ký tự"; vẫn Đã gửi');
  c('RES-U09', 'C.UC1.6', 'Xin mở khóa', 'Ô nhập lý do trên giao diện giới hạn 255 ký tự', 'UI', 'Trung bình',
    '1. Dán 300 ký tự vào ô lý do', 'Ô chỉ nhận 255 ký tự hoặc báo vượt giới hạn tại ô', 'Khảo sát: ô có maxlength=1000, chỉ bị API chặn bằng toast → lệch BR-2');
  c('RES-U10', 'C.UC1.6', 'Xin mở khóa', 'LĐ đơn vị có nút Xin mở khóa khi kết quả Đã gửi và kỳ đang diễn ra (BR-5 UC1.7)', 'Nghiệp vụ', 'Cao',
    '1. Đăng nhập LĐ đơn vị; mở kết quả Đã gửi', 'Có nút Xin mở khóa; xin được thành công', 'Khảo sát: LĐ đơn vị (role có APPROVE/LOCK/VIEW) không có DTI_ASSESSMENT.REQUEST_UNLOCK nên không thấy nút → nghi lỗi cấu hình quyền');
  c('RES-U11', 'C.UC1.6', 'Xin mở khóa', 'LĐ địa phương có nút Xin mở khóa khi kết quả đơn vị địa phương Đã gửi', 'Nghiệp vụ', 'Cao',
    '1. Đăng nhập LĐ địa phương; mở kết quả QA - Địa phương Đã gửi', 'Có nút Xin mở khóa; xin được thành công', 'Khảo sát: LĐ địa phương không có quyền REQUEST_UNLOCK → không thấy nút → nghi lỗi cấu hình quyền');
  c('RES-U12', 'C.UC1.6', 'Xin mở khóa', 'Cán bộ không có quyền xin mở khóa (BR-1): không thấy nút và API bị từ chối', 'Nghiệp vụ', 'Cao',
    '1. Đăng nhập Cán bộ; mở kết quả Đã gửi\n2. [API] POST request-unlock', 'Không có nút Xin mở khóa; API 403', 'Khảo sát: Cán bộ và CB địa phương có nút và gọi API thành công (role có REQUEST_UNLOCK) → nghi lỗi lệch BR-1. ' + BA);
  c('RES-U13', 'C.UC1.6', 'Xin mở khóa', 'Chỉ xin được khi kết quả ở trạng thái Đã gửi (Đang chấm điểm/Chờ duyệt/Đã phê duyệt bị chặn)', 'Nghiệp vụ', 'Cao',
    '1. [API] POST request-unlock lần lượt trên kết quả Chưa thực hiện, Chờ duyệt, Đã phê duyệt', 'Mỗi lần bị từ chối (MSG-060); trạng thái không đổi', 'Khảo sát: API trả 400 "Chỉ có thể xin mở khóa khi đang ở trạng thái Đã gửi" hoặc 403 tùy trạng thái → thông báo không thống nhất MSG-060');
  t('RES-U14', 'C.UC1.6', 'Xin mở khóa', 'Kỳ đã kết thúc: không xin mở khóa được và báo MSG-061', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Đã gửi của kỳ đã kết thúc\n2. Bấm/gọi Xin mở khóa', 'Không có nút; API bị từ chối kèm MSG-061',
    'Manual: kết quả Đã gửi của kỳ đã kết thúc chỉ có trong dữ liệu có sẵn của hệ thống (không được thao tác); không tạo được bằng dữ liệu thử');
  c('RES-U15', 'C.UC1.6', 'Xin mở khóa', 'Sau khi xin, các thao tác đổi trạng thái của đơn vị không còn khả dụng', 'Nghiệp vụ', 'Cao',
    '1. Xin mở khóa thành công\n2. [API] Cán bộ gọi PUT scores, submit-for-approval, send', 'Cả ba bị từ chối; không còn nút Chấm điểm/Trình duyệt/Gửi Bộ', S403);
  c('RES-U16', 'C.UC1.6', 'Xin mở khóa', 'Thông tin bổ sung trạng thái Chờ mở khóa nêu đang chờ Bộ xử lý kèm lý do đã nhập', 'Chức năng', 'Trung bình',
    '1. Xin mở khóa với lý do "qc.automation xin mở khóa"\n2. Mở chi tiết', 'Khối thông tin bổ sung hiển thị đang chờ Bộ xử lý và lý do đã nhập');
  c('RES-U17', 'C.UC1.6', 'Xin mở khóa', 'Xin mở khóa ghi Lịch sử xử lý kèm lý do', 'Nghiệp vụ', 'Cao',
    '1. Xin mở khóa\n2. Mở tab Lịch sử', 'Dòng "Xin mở khóa" (Đã gửi → Chờ mở khóa) kèm lý do');
  c('RES-U18', 'C.TB', 'Thông báo', 'TB-009: người có quyền Duyệt mở khóa nhận thông báo kèm lý do', 'Nghiệp vụ', 'Cao',
    '1. CB địa phương (QA - Địa phương) xin mở khóa với lý do cụ thể\n2. LĐ Bộ GET notifications/mine', 'Có thông báo "Yêu cầu mở khóa" chứa lý do và assessmentResultId', 'Khảo sát: với kết quả QA - Đơn vị Bộ LĐ Bộ không nhận thông báo → ' + BA + ' người nhận TB-009');
  c('RES-U19', 'C.UC1.6', 'Xin mở khóa', 'Ở Chờ mở khóa, người của đơn vị yêu cầu không có nút Duyệt/Từ chối mở khóa (chỉ Bộ xử lý)', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Chờ mở khóa\n2. Mở chi tiết bằng Cán bộ và LĐ đơn vị của đơn vị đó', 'Chỉ có chế độ xem; không có Duyệt mở khóa/Từ chối mở khóa', 'Khảo sát: Cán bộ và LĐ đơn vị đều thấy nút Duyệt mở khóa/Từ chối mở khóa (role có LOCK), người xin có thể tự duyệt → nghi lỗi. ' + BA);
  c('RES-U20', 'C.UC1.6', 'Xin mở khóa', 'Bộ duyệt mở khóa: kết quả về Đang chấm điểm, xếp loại hiển thị "-", bản đã gửi vẫn giữ trong Hồ sơ gửi Bộ (BR-4)', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Chờ mở khóa\n2. LĐ Bộ bấm Duyệt mở khóa → xác nhận', 'Kết quả Đang chấm điểm; nút Chấm điểm/Trình duyệt có lại; Xếp loại "-"; Hồ sơ gửi Bộ vẫn có lần gửi cũ; lịch sử có Duyệt mở khóa');
  c('RES-U21', 'C.UC1.6', 'Xin mở khóa', 'Bộ từ chối mở khóa: kết quả về Đã gửi, giữ bản đã gửi và hiển thị lý do từ chối', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Chờ mở khóa\n2. LĐ Bộ bấm Từ chối mở khóa, nhập lý do', 'Kết quả về Đã gửi; bản đã gửi và xếp loại giữ nguyên; thông tin bổ sung nêu lý do bị từ chối');
  c('RES-U22', 'C.UC1.6', 'Xin mở khóa', 'Sau khi Bộ từ chối, đơn vị xin mở khóa lại được', 'Nghiệp vụ', 'Trung bình',
    '1. Bộ từ chối mở khóa\n2. Xin mở khóa lần 2 với lý do khác', 'Thành công; Chờ mở khóa; lịch sử có 2 dòng Xin mở khóa');
  c('RES-U23', 'C.UC1.6', 'Xin mở khóa', 'Không xin mở khóa lặp khi đang Chờ mở khóa; hai yêu cầu đồng thời chỉ một thành công', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Đã gửi\n2. [API] Gửi song song 2 POST request-unlock', 'Một 200, một 4xx; lịch sử có 1 dòng Xin mở khóa');
  c('RES-U24', 'C.UC1.6', 'Xin mở khóa', 'Lý do xin mở khóa chứa HTML hiển thị nguyên văn', 'Bảo mật', 'Trung bình',
    '1. Xin mở khóa với lý do `<i>x</i> <script>alert(1)</script>`\n2. Xem thông tin bổ sung, lịch sử, thông báo', 'Hiển thị đúng chuỗi gốc, không chạy script');
  c('RES-U25', 'C.UC1.6', 'Xin mở khóa', 'Server lỗi 500 khi xin mở khóa: giữ hộp thoại và lý do, không lộ lỗi nội bộ', 'Nghiệp vụ', 'Trung bình',
    '1. Nhập lý do\n2. Giả lập POST request-unlock trả 500\n3. Gửi yêu cầu', 'Thông báo lỗi chung; hộp thoại giữ lý do; vẫn Đã gửi');
  c('RES-U26', 'C.UC1.6', 'Xin mở khóa', 'Mất kết nối khi xin mở khóa: có thông báo lỗi và không treo', 'Nghiệp vụ', 'Trung bình',
    '1. Nhập lý do\n2. Chặn mạng với request-unlock\n3. Gửi yêu cầu', 'Có thông báo lỗi kết nối; hộp thoại không đóng im lặng; vẫn Đã gửi');
  c('RES-U27', 'C.UC1.6', 'Xin mở khóa', 'Xin mở khóa kết quả có id không tồn tại không gây lỗi hệ thống', 'Validate', 'Trung bình',
    '1. [API] POST request-unlock id lạ', '404 không 500');
  t('RES-U28', 'C.UC1.6', 'Xin mở khóa', 'Kỳ kết thúc khi đang Chờ mở khóa: yêu cầu chờ bị bỏ và kết quả bị khóa (BR-3)', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Chờ mở khóa; chờ kỳ qua hạn\n2. Xem trạng thái', 'Yêu cầu chờ bị bỏ; kết quả bị khóa, hiển thị kỳ đã kết thúc; Bộ không duyệt được',
    'Manual: cần chờ kỳ kết thúc thật hoặc chỉnh giờ hệ thống', BA + ' trạng thái hiển thị sau khi kỳ kết thúc (Đã gửi hay Chưa gửi)');
  c('RES-U29', 'C.UC1.6', 'Xin mở khóa', 'Bộ từ chối mở khóa và Duyệt mở khóa chỉ thực hiện được khi kết quả đang Chờ mở khóa', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Đã gửi\n2. [API] POST approve-unlock và reject-unlock bằng LĐ Bộ', 'Cả hai bị từ chối ("Không có yêu cầu mở khóa nào đang chờ xử lý"); trạng thái giữ Đã gửi');
  c('RES-U30', 'C.UC1.6', 'Xin mở khóa', 'Từ chối mở khóa bắt buộc nhập lý do', 'Validate', 'Trung bình',
    '1. Kết quả Chờ mở khóa\n2. LĐ Bộ Từ chối mở khóa với lý do rỗng', '400 "Vui lòng nhập lý do"; trạng thái giữ Chờ mở khóa');

  // =============================== UC1.7 CHI TIẾT KẾT QUẢ (RES-D) ===============================
  c('RES-D01', 'C.UC1.7', 'Chi tiết kết quả', 'Mở chi tiết từ danh sách hiển thị tiêu đề: nút quay lại, tên kỳ và chip trạng thái', 'Chức năng', 'Cao',
    '1. Ở danh sách bấm "Xem chi tiết" một kết quả', 'Trang chi tiết có nút quay lại, tên kỳ, chip trạng thái đúng với danh sách');
  c('RES-D02', 'C.UC1.7', 'Chi tiết kết quả', 'Dòng phụ dưới tiêu đề là câu giải thích cố định, không lấy từ dữ liệu (BR-2)', 'UI', 'Trung bình',
    '1. Mở chi tiết hai kết quả của hai đơn vị khác nhau', 'Cả hai đều có dòng "Xem chi tiết kết quả tự đánh giá của đơn vị trong kỳ"', 'Khảo sát: dòng phụ hiển thị "{Đơn vị} · Hạn nộp: dd/mm/yyyy (Còn n ngày)" lấy từ dữ liệu → lệch BR-2');
  c('RES-D03', 'C.UC1.7', 'Chi tiết kết quả', 'Thông tin chung gồm 4 ô: Đơn vị, Phân loại, Bộ chỉ số, Thời gian thực hiện', 'Chức năng', 'Cao',
    '1. Mở chi tiết kết quả đột xuất', 'Có 4 ô với giá trị đúng: đơn vị, "Đột xuất", tên bộ chỉ số (n chỉ số), từ ngày – đến ngày của kỳ');
  c('RES-D04', 'C.UC1.7', 'Chi tiết kết quả', 'Ô Thời gian thực hiện có số ngày còn lại tới hạn nộp 23:59 ngày kết thúc', 'Nghiệp vụ', 'Trung bình',
    '1. Mở chi tiết kết quả kỳ kết thúc 30/11/2026', 'Số ngày còn lại = số ngày từ hôm nay đến 30/11/2026 23:59 (khớp daysRemaining của API)', 'Khảo sát: số ngày còn lại hiển thị ở dòng phụ tiêu đề, không nằm dưới ô Thời gian thực hiện');
  c('RES-D05', 'C.UC1.7', 'Chi tiết kết quả', 'Trạng thái Bị từ chối: thông tin bổ sung nêu người từ chối, ngày từ chối và lý do (BR-4)', 'Chức năng', 'Cao',
    '1. Kết quả bị LĐ đơn vị từ chối với lý do cụ thể\n2. Mở chi tiết', 'Khối thông tin hiển thị người từ chối (LĐ đơn vị hoặc Phía Bộ), ngày và lý do');
  c('RES-D06', 'C.UC1.7', 'Chi tiết kết quả', 'Bị từ chối do Bộ yêu cầu đánh giá lại: thông tin bổ sung ghi người từ chối là Phía Bộ', 'Chức năng', 'Trung bình',
    '1. Kết quả Đã gửi; Bộ chọn Yêu cầu đánh giá lại với lý do\n2. Mở chi tiết', 'Người từ chối hiển thị "Phía Bộ" kèm lý do', 'Khảo sát: hành động Bộ yêu cầu đánh giá lại hiện thực hiện được bởi tài khoản Cán bộ địa phương và lịch sử ghi tên người dùng → ' + BA);
  c('RES-D07', 'C.UC1.7', 'Chi tiết kết quả', 'Trạng thái Chờ mở khóa: thông tin bổ sung nêu đang chờ Bộ xử lý kèm lý do đã nhập (BR-4)', 'Chức năng', 'Trung bình',
    '1. Kết quả Chờ mở khóa\n2. Mở chi tiết', 'Hiển thị đang chờ Bộ xử lý và lý do');
  c('RES-D08', 'C.UC1.7', 'Chi tiết kết quả', 'Kỳ đã kết thúc: chi tiết nêu kỳ đã kết thúc và kết quả bị khóa, chỉ xem', 'Chức năng', 'Trung bình',
    '1. Mở kết quả của kỳ đã kết thúc (Chưa gửi)', 'Thông tin bổ sung nêu kỳ đã kết thúc ngày…, kết quả bị khóa; chỉ có nút Xuất Excel');
  c('RES-D09', 'C.UC1.7', 'Chi tiết kết quả', 'Màn chi tiết chỉ xem: điểm, giải trình, minh chứng là chữ, không có ô nhập hay nút đính kèm/xóa (BR-1)', 'Nghiệp vụ', 'Cao',
    '1. Mở chi tiết kết quả Đang chấm điểm bằng Cán bộ\n2. Đếm ô nhập và nút Lưu nháp/Hủy chỉnh sửa/Tải file', 'Không có ô nhập; muốn nhập điểm phải bấm nút Chấm điểm', 'Khảo sát: URL chi tiết cũng là màn Chấm điểm (có Hủy chỉnh sửa, Lưu nháp) ở Đang chấm điểm/Bị từ chối → lệch SRS (UC1.7 tách khỏi UC1.2). ' + BA);
  c('RES-D10', 'C.UC1.7', 'Chi tiết kết quả', 'Màn chi tiết ở Chờ duyệt/Đã gửi: điểm hiển thị dạng chữ, không có ô nhập', 'Nghiệp vụ', 'Trung bình',
    '1. Mở chi tiết kết quả Chờ duyệt bằng LĐ đơn vị', 'Không có ô nhập điểm/giải trình; không nút đính kèm/xóa minh chứng');
  c('RES-D11', 'C.UC1.7', 'Chi tiết kết quả', 'Ba tab Chấm điểm, Hồ sơ gửi Bộ, Lịch sử xử lý; mặc định Chấm điểm', 'Chức năng', 'Trung bình',
    '1. Mở chi tiết\n2. Chuyển lần lượt 3 tab', 'Mặc định tab Chấm điểm; mỗi tab hiện đúng nội dung; số lượng ở tab Lịch sử khớp số dòng');
  c('RES-D12', 'C.UC1.7', 'Chi tiết kết quả', 'Tìm chỉ số theo mã hoặc tên', 'Chức năng', 'Trung bình',
    '1. Nhập mã chỉ số "4.5.1"\n2. Nhập một phần tên chỉ số', 'Cây/danh sách chỉ lọc ra chỉ số khớp theo mã và theo tên');
  c('RES-D13', 'C.UC1.7', 'Chi tiết kết quả', 'Ô tìm chỉ số giới hạn 255 ký tự', 'Validate', 'Thấp',
    '1. Dán chuỗi 300 ký tự vào ô tìm', 'Ô nhận tối đa 255 ký tự; không lỗi');
  c('RES-D14', 'C.UC1.7', 'Chi tiết kết quả', 'Tìm không có kết quả hiển thị trạng thái rỗng', 'Chức năng', 'Thấp',
    '1. Nhập "zzzz"', 'Hiển thị "Không tìm thấy chỉ số nào khớp bộ lọc"; không lỗi');
  c('RES-D15', 'C.UC1.7', 'Chi tiết kết quả', 'Tìm với ký tự đặc biệt / SQLi / XSS an toàn', 'Bảo mật', 'Thấp',
    '1. Nhập `\' OR 1=1 --` và `<script>alert(1)</script>`', 'Không lỗi, không chạy script; trạng thái rỗng');
  c('RES-D16', 'C.UC1.7', 'Chi tiết kết quả', 'Lọc "Chỉ số chưa có điểm" chỉ hiện các chỉ số cần chấm mà chưa có điểm', 'Chức năng', 'Trung bình',
    '1. Kết quả chấm 99/100\n2. Chọn lọc chỉ số chưa chấm', 'Chỉ hiện 1 chỉ số chưa có điểm; chỉ số Không tính điểm không xuất hiện', 'Khảo sát: bộ lọc tên "Trạng thái chấm" với tùy chọn Đã chấm/Chưa chấm/Chưa có minh chứng');
  c('RES-D17', 'C.UC1.7', 'Chi tiết kết quả', 'Có nút Mở rộng tất cả / Thu gọn tất cả cho trụ cột và nhóm', 'Chức năng', 'Trung bình',
    '1. Bấm Thu gọn tất cả\n2. Bấm Mở rộng tất cả', 'Thu gọn: chỉ còn dòng trụ cột/nhóm; Mở rộng: hiện hết chỉ số', 'Khảo sát: không có hai nút này; chỉ có lọc nhóm → nghi lệch SRS');
  c('RES-D18', 'C.UC1.7', 'Chi tiết kết quả', 'Cấu trúc Trụ cột → Nhóm chỉ số → Chỉ số trong một bảng, thụt lề theo cấp, đóng/mở được', 'UI', 'Cao',
    '1. Mở chi tiết kết quả\n2. Bấm mũi tên đóng/mở ở trụ cột và nhóm', 'Có dòng Trụ cột, Nhóm, Chỉ số thụt lề; đóng/mở được', 'Khảo sát: chỉ có khối "Nhóm n" chứa bảng chỉ số, không có dòng Trụ cột và không đóng/mở bằng mũi tên → nghi lệch SRS');
  c('RES-D19', 'C.UC1.7', 'Chi tiết kết quả', 'Dòng Nhóm hiển thị điểm kết quả / điểm tối đa của nhóm', 'Nghiệp vụ', 'Cao',
    '1. Kết quả điểm 25 trên nhóm có tối đa 50', 'Dòng nhóm hiển thị "25 / 50"; bằng tổng điểm kết quả các chỉ số trong nhóm (khớp API groups[].score/maxScore)');
  c('RES-D20', 'C.UC1.7', 'Chi tiết kết quả', 'Dòng Trụ cột hiển thị điểm kết quả / điểm tối đa của trụ cột', 'Nghiệp vụ', 'Cao',
    '1. Mở chi tiết kết quả có điểm', 'Dòng trụ cột hiển thị "điểm / tối đa" bằng tổng các nhóm (khớp API pillars[])', 'Khảo sát: UI không có dòng Trụ cột; API có pillars[] → nghi thiếu hiển thị');
  c('RES-D21', 'C.UC1.7', 'Chi tiết kết quả', 'Mỗi chỉ số hiển thị mã, tên, Điểm (min-max), Trọng số, Tính điểm, Điểm chấm, Điểm kết quả, Đánh giá', 'UI', 'Cao',
    '1. Mở chi tiết, xem tiêu đề cột bảng chỉ số', 'Có đủ các cột trên', 'Khảo sát: bảng chỉ có Mã, Chỉ số & Yêu cầu (kèm Điểm tối đa), Điểm tự chấm, Minh chứng, Giải trình → thiếu Trọng số, Tính điểm, Điểm kết quả, Đánh giá, điểm tối thiểu → nghi lệch SRS');
  c('RES-D22', 'C.UC1.7', 'Chi tiết kết quả', 'Điểm kết quả = min(Điểm chấm × Trọng số, Điểm tối đa)', 'Nghiệp vụ', 'Cao',
    '1. [API] Lưu điểm 99 cho chỉ số tối đa 2 (trọng số 1) và điểm 1 cho chỉ số khác\n2. GET chi tiết', 'resultScore chỉ số điểm 99 = 2; chỉ số điểm 1 = 1; tổng điểm khớp tổng resultScore');
  c('RES-D23', 'C.UC1.7', 'Chi tiết kết quả', 'Cột Đánh giá: Đạt khi Điểm kết quả ≥ điểm tối thiểu, ngược lại Chưa đạt', 'Nghiệp vụ', 'Trung bình',
    '1. Chấm một chỉ số có điểm tối thiểu > 0 với điểm thấp hơn và cao hơn ngưỡng', 'isPassed false/true tương ứng; UI chip Chưa đạt/Đạt', 'Khảo sát: bộ chỉ số QC có điểm tối thiểu = 0 nên mọi chỉ số đã chấm đều Đạt; cần bộ có ngưỡng > 0; UI chưa có cột Đánh giá');
  c('RES-D24', 'C.UC1.7', 'Chi tiết kết quả', 'Chỉ số cha không chấm; điểm cha tự cộng từ chỉ số con và cột Đánh giá hiện "-"', 'Nghiệp vụ', 'Cao',
    '1. Chấm mọi chỉ số con của một chỉ số cha (mỗi con 1 điểm, 5 con)\n2. GET chi tiết, xem dòng chỉ số cha', 'Điểm cha = tổng điểm kết quả các con (5); Đánh giá "-"; không có ô nhập điểm ở cha', 'Khảo sát: API trả resultScore/score của chỉ số cha = null sau khi chấm đủ con; UI không hiện dòng cha → nghi lỗi');
  c('RES-D25', 'C.UC1.7', 'Chi tiết kết quả', 'Chỉ số chưa chấm hiển thị "-" ở Điểm chấm, Điểm kết quả, Đánh giá', 'UI', 'Trung bình',
    '1. Mở kết quả chưa chấm chỉ số nào', 'Các ô hiển thị "-" (không hiển thị 0)', 'Khảo sát: cột Điểm tự chấm hiển thị "/ 2" (trống phần điểm) thay vì "-" → nghi lệch');
  c('RES-D26', 'C.UC1.7', 'Chi tiết kết quả', 'Giải trình hiển thị dạng chữ, chưa có hiển thị "-"; ký tự HTML hiển thị nguyên văn', 'Chức năng', 'Trung bình',
    '1. [API] Lưu điểm kèm giải trình `<b>x</b> qc.automation`\n2. Mở chi tiết ở Chờ duyệt', 'Giải trình hiển thị đúng chuỗi gốc; chỉ số không có giải trình hiển thị "—"');
  t('RES-D27', 'C.UC1.7', 'Chi tiết kết quả', 'Minh chứng hiển thị tên, dung lượng và liên kết Tải về; chưa có hiển thị "-"; tải về được', 'Chức năng', 'Trung bình',
    '1. Kết quả có chỉ số đã đính kèm minh chứng (UC1.2)\n2. Mở chi tiết; bấm Tải về', 'Mỗi tệp có tên, dung lượng, Tải về hoạt động; chỉ số không có minh chứng hiển thị "-"',
    'Manual: phụ thuộc đính kèm minh chứng ở UC1.2 và kho tệp; kiểm thủ công cùng dữ liệu minh chứng thật', 'Khảo sát: chỉ số chưa có minh chứng hiển thị "Không có" thay vì "-"');
  t('RES-D28', 'C.UC1.7', 'Chi tiết kết quả', 'Tệp minh chứng không còn: Tải về báo MSG-049 và màn hình tiếp tục dùng được', 'Validate', 'Thấp',
    '1. Xóa tệp minh chứng vật lý\n2. Bấm Tải về', 'Báo "Tệp không tồn tại hoặc đã bị xóa"; trang không lỗi',
    'Manual: cần xóa tệp vật lý trên kho lưu trữ (không có quyền)');
  c('RES-D29', 'C.UC1.7', 'Chi tiết kết quả', 'Thanh tổng hợp Tiến độ chấm "x/y chỉ số" với thanh và phần trăm, chỉ đếm chỉ số lá', 'Nghiệp vụ', 'Cao',
    '1. Kết quả chấm 40/100 chỉ số lá (120 gồm cha)', 'Hiển thị 40/100 chỉ số (40%); không đếm chỉ số cha vào mẫu số');
  c('RES-D30', 'C.UC1.7', 'Chi tiết kết quả', 'Tử số tiến độ không vượt mẫu số và phần trăm ≤ 100%', 'Nghiệp vụ', 'Cao',
    '1. Mở danh sách và chi tiết của các kết quả có sẵn, đọc "x/y chỉ số" và %', 'Luôn có x ≤ y và % ≤ 100', 'Khảo sát: danh sách có dòng "38/0 chỉ số 0%" và "38/19 chỉ số 200%" (dữ liệu có sẵn) → nghi lỗi tính tiến độ khi bộ chỉ số bị sửa/đổi');
  c('RES-D31', 'C.UC1.7', 'Chi tiết kết quả', 'Tổng điểm tạm tính = tổng điểm kết quả / tổng điểm tối đa của đơn vị', 'Nghiệp vụ', 'Cao',
    '1. Chấm 100 chỉ số mỗi chỉ số 1 điểm (tối đa 200)', 'Hiển thị "100 / 200" và "Đạt 50.0% điểm tối đa"; khớp score/maxScore từ API');
  c('RES-D32', 'C.UC1.7', 'Chi tiết kết quả', 'Xếp loại chỉ hiện khi Đã gửi hoặc Chờ mở khóa; trạng thái khác hiển thị "-"', 'Nghiệp vụ', 'Cao',
    '1. Mở thanh tổng hợp ở Đang chấm điểm, Chờ duyệt, Đã phê duyệt, Đã gửi, Chờ mở khóa', 'Đã gửi/Chờ mở khóa: chip tên mức + Điểm xếp hạng (%); các trạng thái khác "-"');
  c('RES-D33', 'C.UC1.7', 'Chi tiết kết quả', 'Xếp loại đúng theo thang: 50% → Trung bình, 100% → Xuất sắc (thang mặc định TXL-001)', 'Nghiệp vụ', 'Cao',
    '1. Gửi kết quả đạt 50% và kết quả đạt 100% cùng thang TXL-001\n2. Xem chip xếp loại', '50% → "Trung bình" (Đạt 50% điểm tối đa); 100% → "Xuất sắc"');
  c('RES-D34', 'C.UC1.7', 'Chi tiết kết quả', 'Xếp loại tại mốc biên giữa hai mức (40%, 60%, 80%, 90%) theo quy tắc "Từ ≤ x < Đến dưới"', 'Nghiệp vụ', 'Cao',
    '1. Gửi lần lượt các kết quả đạt đúng 40%, 60%, 80%, 90% (điểm/200 = 80, 120, 160, 180)', '40% → Trung bình; 60% → Khá; 80% → Tốt; 90% → Xuất sắc (mốc thuộc mức trên)', BA + ' mốc biên thuộc mức trên (theo định nghĩa Từ–Đến dưới ở thang)');
  c('RES-D35', 'C.UC1.7', 'Chi tiết kết quả', 'Chip xếp loại mang màu của mức trong thang', 'UI', 'Thấp',
    '1. Mở chi tiết kết quả Đã gửi', 'Chip có màu tương ứng màu cấu hình của mức');
  c('RES-D36', 'C.UC1.7', 'Chi tiết kết quả', 'Hồ sơ gửi Bộ chưa có lần gửi nào hiển thị "Chưa có dữ liệu" (MSG-022)', 'Chức năng', 'Trung bình',
    '1. Mở tab Hồ sơ gửi Bộ của kết quả chưa gửi lần nào', 'Danh sách các lần gửi hiển thị "Chưa có dữ liệu"', 'Khảo sát: tab chỉ có khung đính kèm và điều kiện gửi; chưa thấy dòng "Chưa có dữ liệu" → kiểm khi viết script');
  c('RES-D37', 'C.UC1.7', 'Chi tiết kết quả', 'Hồ sơ gửi Bộ đánh dấu "Kết quả chính thức" cho lần gửi gần nhất', 'Chức năng', 'Cao',
    '1. Kết quả đã gửi 2 lần\n2. Mở Hồ sơ gửi Bộ', 'Chỉ lần gửi gần nhất có nhãn "Kết quả chính thức"');
  c('RES-D38', 'C.UC1.7', 'Chi tiết kết quả', 'Lịch sử xử lý sắp xếp từ mới tới cũ với thời gian, người thực hiện, hành động, trạng thái chuyển và lý do', 'Chức năng', 'Cao',
    '1. Thực hiện Lưu điểm → Trình → Từ chối → Trình → Phê duyệt → Gửi\n2. Mở tab Lịch sử', 'Dòng mới nhất ở trên cùng; mỗi dòng đủ thông tin; lý do hiển thị ở Từ chối/Xin mở khóa/Yêu cầu đánh giá lại/Từ chối mở khóa; thời gian dd/mm/yyyy hh:mm');
  c('RES-D39', 'C.UC1.7', 'Chi tiết kết quả', 'Lịch sử xử lý lọc được theo Hành động', 'Chức năng', 'Trung bình',
    '1. Mở tab Lịch sử\n2. Chọn lọc Hành động = Từ chối', 'Chỉ hiện các dòng Từ chối', 'Khảo sát: giao diện không có bộ lọc Hành động (API có tham số action nhưng 400 "Hành động lịch sử không hợp lệ" với giá trị lạ) → nghi thiếu chức năng');
  c('RES-D40', 'C.UC1.7', 'Chi tiết kết quả', 'Lý do dài (255 ký tự) xem được đầy đủ trong Lịch sử', 'Chức năng', 'Thấp',
    '1. Từ chối với lý do 255 ký tự\n2. Mở Lịch sử và xem lý do', 'Hiển thị đủ 255 ký tự (xuống dòng/mở rộng), không bị cắt cụt không xem được');
  c('RES-D41', 'C.UC1.7', 'Chi tiết kết quả', 'Nhắc nhở (Phía Bộ/Hệ thống) ghi thành dòng riêng, trạng thái "Không đổi", không làm đổi trạng thái kết quả (BR-8)', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Đã phê duyệt; gửi nhắc nhở đơn vị 2 lần\n2. Xem Lịch sử và trạng thái', 'Mỗi lần nhắc là 1 dòng "Gửi nhắc nhở", cột trạng thái "Không đổi", trạng thái kết quả vẫn Đã phê duyệt',
    'Khảo sát: dòng "Bộ gửi nhắc nhở" ghi người thực hiện là tên tài khoản (QC Cán bộ) thay vì "Phía Bộ"; không hiển thị "Không đổi" → nghi lệch');
  c('RES-D42', 'C.UC1.7', 'Chi tiết kết quả', 'Nút quay lại về danh sách giữ bộ lọc trước đó (AF4)', 'Chức năng', 'Trung bình',
    '1. Ở danh sách lọc trạng thái "Đã gửi" và tìm từ khóa\n2. Vào chi tiết, bấm nút quay lại', 'Danh sách hiển thị với đúng bộ lọc và từ khóa trước đó');
  c('RES-D43', 'C.UC1.7', 'Chi tiết kết quả', 'Mở chi tiết kết quả không tồn tại báo không còn tồn tại (MSG-044), không lỗi hệ thống', 'Validate', 'Cao',
    '1. Mở URL chi tiết với id lạ\n2. [API] GET /dti/assessment-results/<id lạ>', 'Trang hiển thị thông báo không tồn tại hoặc không có quyền xem (MSG-044), có nút quay lại; API 404; không trắng trang', 'Khảo sát: trang "404 NOT FOUND - Không tìm thấy kết quả tự đánh giá"; chưa đúng nội dung MSG-044');
  c('RES-D44', 'C.UC1.7', 'Chi tiết kết quả', 'Mở chi tiết kết quả của đơn vị ngoài phạm vi báo MSG-045', 'Bảo mật', 'Cao',
    '1. CB địa phương mở URL chi tiết kết quả của QA - Đơn vị Bộ\n2. [API] GET cùng id', 'Hiển thị "Bạn không có quyền truy cập dữ liệu của đơn vị này"; không lộ dữ liệu', 'Khảo sát: API trả 404 "Không tìm thấy kết quả tự đánh giá" (không phân biệt MSG-044/MSG-045); dữ liệu không bị lộ');
  c('RES-D45', 'C.UC1.7', 'Chi tiết kết quả', 'Xuất Excel ở chi tiết tải được file .xlsx có dữ liệu kết quả', 'Chức năng', 'Trung bình',
    '1. Mở chi tiết; bấm Xuất Excel', 'Tải về .xlsx, mở được, có dòng chỉ số của kết quả');
  c('RES-D46', 'C.UC1.7', 'Quản lý danh sách', 'Cán bộ xuất Excel danh sách kết quả tự đánh giá (UC_1409 dòng 225)', 'Chức năng', 'Trung bình',
    '1. Cán bộ mở danh sách Kết quả tự đánh giá; bấm Xuất Excel', 'Tải về .xlsx hợp lệ (API export trả content-type xlsx)');
  c('RES-D47', 'C.UC1.7', 'Quản lý danh sách', 'LĐ đơn vị và LĐ địa phương xuất Excel danh sách kết quả (UC_1409 dòng 225)', 'Chức năng', 'Trung bình',
    '1. LĐ đơn vị / LĐ địa phương mở danh sách\n2. Bấm Xuất Excel', 'Tải về .xlsx hợp lệ', 'Khảo sát: LĐ đơn vị và LĐ địa phương gọi export danh sách bị 403 (role không có DTI_ASSESSMENT.EXPORT) trong khi UC_1409 dòng 225 cho phép → nghi lỗi cấu hình quyền');
  c('RES-D48', 'C.UC1.7', 'Quản lý danh sách', 'Tìm kiếm kết quả tự đánh giá kỳ định kỳ theo từ khóa đơn vị/kỳ (UC_1409 dòng 222)', 'Chức năng', 'Trung bình',
    '1. Tab Định kỳ; nhập tên kỳ hoặc tên đơn vị; Enter', 'Danh sách chỉ gồm kết quả định kỳ khớp từ khóa; thẻ tổng hợp cập nhật theo bộ lọc');
  c('RES-D49', 'C.UC1.7', 'Quản lý danh sách', 'Tìm kiếm kết quả tự đánh giá kỳ đột xuất theo từ khóa (UC_1409 dòng 223)', 'Chức năng', 'Trung bình',
    '1. Tab Đột xuất; nhập "qc.automation"; Enter', 'Chỉ gồm kết quả đột xuất khớp; không lẫn định kỳ');
  c('RES-D50', 'C.UC1.7', 'Quản lý danh sách', 'Xem kết quả: mỗi vai trò (Cán bộ, LĐ đơn vị, CB địa phương, LĐ địa phương) mở được chi tiết kết quả trong phạm vi (UC_1409 dòng 224)', 'Chức năng', 'Cao',
    '1. Từng vai trò mở chi tiết một kết quả trong phạm vi', 'Mở được, hiển thị đủ thông tin; không báo lỗi quyền');
  c('RES-D51', 'C.UC1.7', 'Chi tiết kết quả', 'Kết quả Đã gửi cho Phân hệ D: lần gửi gần nhất là điểm chính thức và khớp danh sách', 'Nghiệp vụ', 'Cao',
    '1. Gửi lần 1 (điểm A); mở khóa, đổi điểm, gửi lần 2 (điểm B)\n2. Xem danh sách và chi tiết', 'Điểm chính thức ở danh sách và chi tiết = B (lần gửi gần nhất)');

  // =============================== VÒNG ĐỜI TRẠNG THÁI (RES-Y) ===============================
  c('RES-Y01', 'C.UC1.7', 'Vòng đời', 'Luồng đầy đủ: Chưa thực hiện → Đang chấm điểm → Chờ duyệt → Đã phê duyệt → Đã gửi, lịch sử khớp từng bước', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Chưa thực hiện\n2. Lưu điểm đủ → Trình duyệt → Phê duyệt → Gửi Bộ\n3. Đọc lịch sử', 'Trạng thái đi đúng chuỗi; lịch sử có Tạo kết quả, Bắt đầu chấm điểm, Trình duyệt, Phê duyệt, Gửi Bộ đúng người và từ/đến');
  c('RES-Y02', 'C.UC1.7', 'Vòng đời', 'Lưu điểm lần đầu tự chuyển Chưa thực hiện → Đang chấm điểm', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Chưa thực hiện\n2. Lưu điểm 1 chỉ số', 'Trạng thái Đang chấm điểm; lịch sử "Bắt đầu chấm điểm"');
  c('RES-Y03', 'C.UC1.4b', 'Vòng đời', 'Chu trình Chờ duyệt → Bị từ chối → Chờ duyệt → Đã phê duyệt', 'Nghiệp vụ', 'Cao',
    '1. Trình duyệt; LĐ từ chối; Cán bộ sửa, trình lại; LĐ phê duyệt', 'Mỗi bước đúng trạng thái; điểm mới sau chỉnh sửa được giữ ở bản phê duyệt');
  c('RES-Y04', 'C.UC1.6', 'Vòng đời', 'Chu trình Đã gửi → Chờ mở khóa → Đang chấm điểm → … → Đã gửi (lần 2)', 'Nghiệp vụ', 'Cao',
    '1. Gửi lần 1; xin mở khóa; Bộ duyệt; chấm, trình, phê duyệt, gửi lần 2 với file ký số mới', 'Trạng thái đi đúng chuỗi; Hồ sơ gửi Bộ có 2 lần gửi; lần 2 chính thức');
  c('RES-Y05', 'C.UC1.6', 'Vòng đời', 'Chu trình Đã gửi → Chờ mở khóa → Đã gửi khi Bộ từ chối', 'Nghiệp vụ', 'Cao',
    '1. Gửi; xin mở khóa; Bộ từ chối mở khóa', 'Trở về Đã gửi; điểm và hồ sơ gửi giữ nguyên');
  c('RES-Y06', 'C.UC1.5', 'Vòng đời', 'Chu trình Đã gửi → Bị từ chối (Bộ yêu cầu đánh giá lại) → … → Đã gửi', 'Nghiệp vụ', 'Trung bình',
    '1. Gửi; Bộ chọn Yêu cầu đánh giá lại; Cán bộ sửa, trình; LĐ phê duyệt; gửi lại với file ký số', 'Trạng thái đi đúng chuỗi; lịch sử có "Bộ yêu cầu đánh giá lại"');
  c('RES-Y07', 'C.UC1.3', 'Vòng đời', '[API] submit-for-approval chỉ hợp lệ ở Đang chấm điểm/Bị từ chối; các trạng thái khác bị chặn', 'Nghiệp vụ', 'Cao',
    '1. Với từng trạng thái Chưa thực hiện, Chờ duyệt, Đã phê duyệt, Đã gửi, Chờ mở khóa gọi submit-for-approval', 'Tất cả bị từ chối, trạng thái không đổi', S403);
  c('RES-Y08', 'C.UC1.4a', 'Vòng đời', '[API] approve và reject chỉ hợp lệ ở Chờ duyệt', 'Nghiệp vụ', 'Cao',
    '1. Với Chưa thực hiện, Đang chấm điểm, Bị từ chối, Đã phê duyệt, Đã gửi, Chờ mở khóa gọi approve và reject bằng LĐ', 'Tất cả bị từ chối, trạng thái không đổi', S403);
  c('RES-Y09', 'C.UC1.5', 'Vòng đời', '[API] send chỉ hợp lệ ở Đã phê duyệt', 'Nghiệp vụ', 'Cao',
    '1. Với Đang chấm điểm, Chờ duyệt, Bị từ chối, Đã gửi, Chờ mở khóa gọi send hợp lệ', 'Tất cả bị từ chối; không tạo lần gửi', S403);
  c('RES-Y10', 'C.UC1.6', 'Vòng đời', '[API] request-unlock chỉ hợp lệ ở Đã gửi', 'Nghiệp vụ', 'Cao',
    '1. Với Đang chấm điểm, Chờ duyệt, Đã phê duyệt, Chờ mở khóa gọi request-unlock', 'Tất cả bị từ chối (400/403) và trạng thái không đổi');
  c('RES-Y11', 'C.UC1.3', 'Vòng đời', '[API] Lưu điểm chỉ hợp lệ ở Chưa thực hiện/Đang chấm điểm/Bị từ chối; bị khóa ở Chờ duyệt, Đã phê duyệt, Đã gửi, Chờ mở khóa', 'Nghiệp vụ', 'Cao',
    '1. Gọi PUT scores ở từng trạng thái khóa', 'Bị từ chối, điểm không đổi', S403);
  c('RES-Y12', 'C.UC1.3', 'Vòng đời', 'Không nhảy bước: Đang chấm điểm không thể phê duyệt hoặc gửi trực tiếp (BR-2)', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Đang chấm điểm đủ điểm\n2. [API] approve rồi send', 'Cả hai bị từ chối; vẫn Đang chấm điểm', S403);
  c('RES-Y13', 'C.UC1.3', 'Vòng đời', 'Kết quả của kỳ đã kết thúc không chuyển trạng thái được bằng bất kỳ thao tác nào', 'Nghiệp vụ', 'Cao',
    '1. Kết quả Chưa gửi của kỳ đã kết thúc\n2. [API] submit-for-approval, approve, reject, send, request-unlock, PUT scores', 'Tất cả bị từ chối; allowedActions chỉ còn export', S403);
  c('RES-Y14', 'C.UC1.7', 'Vòng đời', 'Kết quả kỳ đã kết thúc hiển thị "Chưa gửi" (Quá hạn, không nộp) và dừng ở bước trước đó', 'Chức năng', 'Trung bình',
    '1. Mở kết quả kỳ đã kết thúc không gửi', 'Trạng thái "Chưa gửi", ghi dừng ở bước nào; không tính vào xếp hạng');
  c('RES-Y15', 'C.UC1.7', 'Vòng đời', 'allowedActions của API khớp với nút hiển thị trên giao diện ở từng trạng thái', 'Nghiệp vụ', 'Trung bình',
    '1. Với mỗi trạng thái và vai trò, so sánh allowedActions của GET chi tiết với nút trên trang', 'Nút Chấm điểm/Trình duyệt/Phê duyệt/Từ chối/Gửi Bộ/Xin mở khóa chỉ hiện khi tương ứng có trong allowedActions');
  c('RES-Y16', 'C.UC1.4a', 'Vòng đời', 'Hai LĐ cùng lúc: một Phê duyệt, một Từ chối, chỉ một thao tác có hiệu lực', 'Nghiệp vụ', 'Trung bình',
    '1. Kết quả Chờ duyệt\n2. [API] Gửi song song approve và reject', 'Đúng một thao tác thành công, thao tác kia 4xx; trạng thái cuối khớp thao tác thành công; 1 dòng lịch sử');
  c('RES-Y17', 'C.UC1.3', 'Vòng đời', 'Điểm giữ nguyên qua Trình duyệt → Phê duyệt → Gửi (điểm chính thức = điểm khi trình)', 'Nghiệp vụ', 'Cao',
    '1. Ghi điểm tổng khi Chờ duyệt\n2. Phê duyệt, gửi\n3. So sánh điểm tổng', 'Điểm tổng không đổi qua các bước');
  t('RES-Y18', 'C.UC1.3', 'Vòng đời', 'Vòng đời kỳ định kỳ: Chưa thực hiện → … → Đã gửi trên kết quả kỳ định kỳ', 'Nghiệp vụ', 'Cao',
    '1. Kết quả kỳ định kỳ của đơn vị\n2. Thực hiện luồng đầy đủ', 'Giống kỳ đột xuất', 'Manual: chưa dựng được kết quả kỳ định kỳ mới (kỳ định kỳ vừa duyệt không sinh kết quả)', 'Khảo sát: kỳ định kỳ Đã phê duyệt có assessmentResultId=null cho đơn vị');
  c('RES-Y19', 'C.UC1.3', 'Vòng đời', 'Lưu nháp rồi tải lại trang: điểm đã lưu còn nguyên, trạng thái Đang chấm điểm', 'Chức năng', 'Trung bình',
    '1. Nhập điểm 3 chỉ số, bấm Lưu nháp\n2. F5', 'Điểm 3 chỉ số còn; trạng thái Đang chấm điểm; lịch sử "Lưu nháp"/"Bắt đầu chấm điểm"');
  c('RES-Y20', 'C.UC1.6', 'Vòng đời', 'Sau khi Bộ duyệt mở khóa, đơn vị phải qua lại đủ Trình duyệt → Phê duyệt → Gửi', 'Nghiệp vụ', 'Trung bình',
    '1. Sau Duyệt mở khóa, [API] Cán bộ gọi send ngay', 'Bị từ chối; chỉ gửi được sau khi Trình duyệt và Phê duyệt lại', S403);

  // =============================== EDGE / LỖI (RES-J) ===============================
  c('RES-J01', 'C.UC1.3', 'Edge/Lỗi', 'Id sai định dạng (abc) trên các API xử lý kết quả không gây 500', 'Validate', 'Trung bình',
    '1. [API] POST /dti/assessment-results/abc/submit-for-approval', '4xx (404/400); không 500; không lộ lỗi nội bộ');
  c('RES-J02', 'C.UC1.4b', 'Edge/Lỗi', 'Thân yêu cầu từ chối không phải JSON hợp lệ không gây 500', 'Validate', 'Trung bình',
    '1. [API] POST reject với thân `{"reason":` (JSON hỏng)', '400; không 500');
  c('RES-J03', 'C.UC1.4b', 'Edge/Lỗi', 'Lý do sai kiểu dữ liệu (số, mảng, đối tượng) không gây 500', 'Validate', 'Trung bình',
    '1. [API] POST reject với reason=123; reason=["a"]; reason={"a":1}', '400 có thông báo; không 500');
  c('RES-J04', 'C.UC1.4b', 'Edge/Lỗi', 'Lý do chứa Unicode, emoji và ký tự điều khiển được lưu/hiển thị an toàn', 'Validate', 'Thấp',
    '1. Từ chối với lý do "Lý do 😀 tiếng Việt có dấu \\u0000"', 'Lưu thành công hoặc báo ký tự không hợp lệ; không 500; hiển thị đúng sau khi tải lại');
  c('RES-J05', 'C.UC1.4b', 'Edge/Lỗi', 'Lý do chứa chuỗi SQL injection được lưu nguyên văn', 'Bảo mật', 'Trung bình',
    '1. Từ chối với lý do `\'; DROP TABLE x; --`', 'Từ chối thành công; hiển thị nguyên văn; hệ thống hoạt động bình thường');
  c('RES-J06', 'C.UC1.4b', 'Edge/Lỗi', 'Lý do nhiều dòng giữ xuống dòng khi hiển thị', 'Chức năng', 'Thấp',
    '1. Từ chối với lý do hai dòng\n2. Xem lịch sử', 'Hiển thị đủ hai dòng (hoặc giữ ngắt dòng), không dính liền');
  c('RES-J07', 'C.UC1.7', 'Edge/Lỗi', 'Mở URL chi tiết kết quả với id lạ hiển thị trang thân thiện, không trắng trang', 'Validate', 'Trung bình',
    '1. Mở /#/vi/assessment-results/<id lạ>', 'Trang "Không tìm thấy" với nút quay lại; không trắng, không lộ lỗi');
  c('RES-J08', 'C.UC1.7', 'Edge/Lỗi', 'Tải lại trang (F5) ở tab Hồ sơ gửi Bộ/Lịch sử giữ nguyên tab', 'Chức năng', 'Thấp',
    '1. Mở tab Lịch sử\n2. F5', 'Vẫn ở tab Lịch sử (tham số tab trên URL) và dữ liệu hiển thị đủ');
  c('RES-J09', 'C.UC1.4a', 'Edge/Lỗi', 'Dữ liệu cũ: trang mở sẵn ở Chờ duyệt nhưng LĐ khác đã phê duyệt, bấm Từ chối báo lỗi và làm mới', 'Nghiệp vụ', 'Trung bình',
    '1. Mở chi tiết ở hai phiên LĐ\n2. Phiên 1 Phê duyệt\n3. Phiên 2 (trang cũ) Từ chối', 'Phiên 2 nhận thông báo kết quả đã thay đổi/không còn Chờ duyệt; trạng thái vẫn Đã phê duyệt');
  c('RES-J10', 'C.UC1.3', 'Edge/Lỗi', 'Dữ liệu cũ: Cán bộ trang cũ bấm Trình duyệt sau khi đã trình ở phiên khác', 'Nghiệp vụ', 'Trung bình',
    '1. Mở chi tiết ở hai phiên Cán bộ\n2. Phiên 1 Trình duyệt\n3. Phiên 2 Trình duyệt', 'Phiên 2 nhận lỗi không còn trạng thái cho phép; không tạo bản trình thứ hai');
  c('RES-J11', 'C.UC1.3', 'Edge/Lỗi', 'Trình duyệt từ màn Chấm điểm khi lưu điểm lỗi 500: không gọi tiếp submit và giữ điểm đang nhập', 'Nghiệp vụ', 'Trung bình',
    '1. Sửa điểm, giả lập PUT scores trả 500\n2. Bấm Trình duyệt → xác nhận', 'Báo lỗi lưu; không có request submit-for-approval; trạng thái vẫn Đang chấm điểm; điểm nhập còn trên màn hình');
  c('RES-J12', 'C.UC1.3', 'Edge/Lỗi', 'Hộp thoại thiếu điểm với 100 chỉ số thiếu vẫn cuộn được, không vỡ bố cục', 'UI', 'Thấp',
    '1. Kết quả chưa chấm chỉ số nào\n2. Bấm Trình duyệt', 'Danh sách 100 dòng cuộn được trong hộp thoại; nút đóng luôn thấy được');
  c('RES-J13', 'C.UC1.3', 'Edge/Lỗi', '[API] Thông báo thiếu điểm liệt kê tối đa 10 mã chỉ số và rút gọn bằng "..."', 'Nghiệp vụ', 'Thấp',
    '1. Kết quả 99 chỉ số thiếu\n2. [API] POST submit-for-approval', '400 "Còn 99 chỉ số chưa có điểm: <10 mã>, ..." không phình dài', 'Khảo sát: API chỉ trả mã (không có tên) và rút gọn; UI hiển thị đủ mã+tên');
  c('RES-J14', 'C.UC1.5', 'Edge/Lỗi', 'Tải lên nhiều tệp liên tiếp cho cùng kết quả: lần gửi dùng đúng tệp cuối', 'Nghiệp vụ', 'Trung bình',
    '1. Tải lên a.pdf rồi b.pdf\n2. Gửi', 'Hồ sơ gửi Bộ ghi tệp b.pdf (tệp cuối)');
  c('RES-J15', 'C.UC1.5', 'Edge/Lỗi', 'Phản hồi gửi chậm: nút xác nhận vô hiệu/loading, không gửi hai lần', 'Nghiệp vụ', 'Trung bình',
    '1. Làm chậm POST send 5 giây\n2. Bấm xác nhận gửi 2 lần', 'Nút bị vô hiệu khi đang xử lý; chỉ 1 lần gửi');
  c('RES-J16', 'C.UC1.5', 'Edge/Lỗi', 'Tên tệp rất dài (260 ký tự) được xử lý an toàn', 'Validate', 'Thấp',
    '1. Tải lên PDF có tên 260 ký tự', 'Nhận hoặc báo lỗi rõ ràng; không 500; tên hiển thị không phá bố cục');
  c('RES-J17', 'C.UC1.5', 'Edge/Lỗi', 'Số hiệu văn bản và ghi chú chứa ký tự đặc biệt hiển thị nguyên văn ở Hồ sơ gửi Bộ', 'Bảo mật', 'Thấp',
    '1. Gửi với số hiệu `<b>1/BC</b>` và ghi chú `"q" & <i>`', 'Hiển thị đúng chuỗi, không thực thi HTML');
  c('RES-J18', 'C.UC1.5', 'Edge/Lỗi', 'Bấm Gửi Bộ khi chưa có tệp nhưng đã nhập số hiệu: báo thiếu tệp và giữ số hiệu', 'Chức năng', 'Thấp',
    '1. Nhập số hiệu, ghi chú, chưa chọn tệp\n2. Gửi', 'Báo thiếu tệp; số hiệu và ghi chú vẫn còn trong form');
  c('RES-J19', 'C.UC1.7', 'Edge/Lỗi', 'Phiên hết hạn khi đang ở chi tiết rồi bấm Phê duyệt: chuyển đăng nhập, không đổi trạng thái', 'Bảo mật', 'Trung bình',
    '1. Mở chi tiết Chờ duyệt bằng LĐ\n2. Xóa token\n3. Bấm Phê duyệt → xác nhận', 'Chuyển về đăng nhập hoặc báo hết phiên; trạng thái không đổi');
  c('RES-J20', 'C.UC1.4a', 'Edge/Lỗi', 'Đóng hộp thoại bằng phím Esc hoặc bấm ra ngoài không thực hiện thao tác', 'Chức năng', 'Thấp',
    '1. Mở hộp thoại Phê duyệt\n2. Nhấn Esc; mở lại, bấm vùng ngoài hộp thoại', 'Hộp thoại đóng; không có request; trạng thái không đổi');
  c('RES-J21', 'C.UC1.4a', 'Edge/Lỗi', 'Nút Back của trình duyệt sau khi phê duyệt không cho phê duyệt lại', 'Nghiệp vụ', 'Thấp',
    '1. Phê duyệt thành công\n2. Bấm Back rồi Forward', 'Trang tải lại đúng trạng thái Đã phê duyệt; không còn nút Phê duyệt');
  c('RES-J22', 'C.UC1.7', 'Edge/Lỗi', 'Chi tiết kết quả có nhiều chỉ số (100 chỉ số lá) tải và cuộn không lỗi', 'Hiệu năng', 'Thấp',
    '1. Mở chi tiết kết quả 100 chỉ số\n2. Cuộn hết trang', 'Hiển thị đủ 4 nhóm × 25 chỉ số; không lỗi/đơ');
  c('RES-J23', 'C.UC1.6', 'Edge/Lỗi', 'Lý do xin mở khóa nhiều dòng, Unicode lưu và hiển thị đúng', 'Validate', 'Thấp',
    '1. Xin mở khóa với lý do hai dòng có dấu và emoji', 'Lưu và hiển thị đúng ở thông tin bổ sung và lịch sử');
  c('RES-J24', 'C.UC1.5', 'Edge/Lỗi', 'Gửi khi thân yêu cầu rỗng không gây 500', 'Validate', 'Trung bình',
    '1. [API] POST send không thân', '400 "Vui lòng đính kèm file kết quả" hoặc tương đương; không 500');

  // =============================== BẢO MẬT / PHÂN QUYỀN / HIỆU NĂNG (RES-X) ===============================
  c('RES-X01', 'C.UC1.7', 'Phân quyền', 'API đọc kết quả (chi tiết, lịch sử, hồ sơ gửi) không token trả 401', 'Bảo mật', 'Cao',
    '1. GET /dti/assessment-results/<id>, /history, /submissions không Authorization', 'HTTP 401 cho cả ba');
  c('RES-X02', 'C.UC1.3', 'Phân quyền', 'API thao tác (submit/approve/reject/send/request-unlock/scores) không token trả 401', 'Bảo mật', 'Cao',
    '1. Gọi từng API không Authorization', 'HTTP 401; trạng thái không đổi');
  c('RES-X03', 'C.UC1.3', 'Phân quyền', 'Token giả hoặc sai chữ ký trả 401', 'Bảo mật', 'Cao',
    '1. Gọi GET chi tiết và POST approve với Bearer token giả', 'HTTP 401');
  c('RES-X04', 'C.UC1.5', 'Phân quyền', 'Tải tệp lên (upload docType assessment_result_file) không token bị từ chối 401', 'Bảo mật', 'Cao',
    '1. POST /upload/blob/assessment_result_file không Authorization, kèm PDF hợp lệ', 'HTTP 401', 'Khảo sát: API nhận tệp (200) khi không đăng nhập → nghi lỗi nghiêm trọng');
  c('RES-X05', 'C.UC1.5', 'Phân quyền', 'Tài khoản chỉ có quyền xem không upload được tệp gửi Bộ cho kết quả đơn vị', 'Bảo mật', 'Cao',
    '1. Đăng nhập tài khoản chỉ xem\n2. POST upload assessment_result_file với entityId = id kết quả', 'HTTP 403; tệp không trở thành tệp chờ gửi của kết quả', 'Khảo sát: tài khoản chỉ xem upload 200 và tệp thành "tệp chờ gửi" của kết quả (pendingFile) → nghi lỗi');
  c('RES-X06', 'C.UC1.5', 'Phân quyền', 'CB địa phương không upload tệp gửi Bộ vào kết quả của đơn vị ngoài phạm vi', 'Bảo mật', 'Cao',
    '1. CB địa phương upload với entityId = id kết quả QA - Đơn vị Bộ', 'HTTP 403/404; pendingFile của kết quả đó không thay đổi', 'Khảo sát: upload không kiểm quyền theo entityId → nghi lỗi');
  c('RES-X07', 'C.UC1.5', 'Phân quyền', 'Tài khoản không quyền không xóa được tệp chờ gửi của kết quả', 'Bảo mật', 'Trung bình',
    '1. Tài khoản chỉ xem / LĐ đơn vị gọi DELETE /{id}/pending-file/{attId}', 'HTTP 403; tệp còn');
  c('RES-X08', 'C.UC1.7', 'Phân quyền', 'Tài khoản chỉ xem không mở được chi tiết, lịch sử, hồ sơ gửi', 'Bảo mật', 'Cao',
    '1. Tài khoản chỉ xem mở URL chi tiết\n2. [API] GET chi tiết, history, submissions, list', 'Trang chặn truy cập; API 403');
  c('RES-X09', 'C.UC1.7', 'Phân quyền', 'CB địa phương không xem được kết quả của đơn vị ngoài phạm vi (API và danh sách)', 'Bảo mật', 'Cao',
    '1. CB địa phương GET chi tiết/history/submissions của kết quả QA - Đơn vị Bộ\n2. Tìm trong danh sách', 'API 404/403, không có dữ liệu; danh sách không chứa kết quả đó');
  c('RES-X10', 'C.UC1.7', 'Phân quyền', 'LĐ địa phương không xem được kết quả của đơn vị ngoài phạm vi', 'Bảo mật', 'Cao',
    '1. LĐ địa phương GET chi tiết kết quả QA - Đơn vị Bộ', 'API 404/403; trang báo MSG-045 hoặc không tồn tại');
  c('RES-X11', 'C.UC1.3', 'Phân quyền', 'CB địa phương không trình duyệt được kết quả đơn vị ngoài phạm vi', 'Bảo mật', 'Cao',
    '1. [API] CB địa phương POST submit-for-approval cho kết quả QA - Đơn vị Bộ đủ điểm', '403/404; trạng thái không đổi');
  c('RES-X12', 'C.UC1.4a', 'Phân quyền', 'LĐ địa phương không phê duyệt/từ chối kết quả đơn vị ngoài phạm vi', 'Bảo mật', 'Cao',
    '1. Kết quả QA - Đơn vị Bộ ở Chờ duyệt\n2. [API] LĐ địa phương POST approve và reject', '403/404; trạng thái không đổi');
  c('RES-X13', 'C.UC1.5', 'Phân quyền', 'CB địa phương không gửi Bộ cho kết quả đơn vị ngoài phạm vi', 'Bảo mật', 'Cao',
    '1. Kết quả QA - Đơn vị Bộ Đã phê duyệt\n2. [API] CB địa phương POST send', '403/404; không tạo lần gửi');
  c('RES-X14', 'C.UC1.4a', 'Phân quyền', 'Cán bộ và CB địa phương không có nút và API Phê duyệt/Từ chối', 'Bảo mật', 'Cao',
    '1. Kết quả Chờ duyệt; Cán bộ và CB địa phương mở chi tiết\n2. [API] POST approve, reject', 'Không có nút Phê duyệt/Từ chối; API 403');
  c('RES-X15', 'C.UC1.3', 'Phân quyền', 'LĐ đơn vị không có nút và API Trình duyệt/Chấm điểm', 'Bảo mật', 'Cao',
    '1. Kết quả Đang chấm điểm; LĐ đơn vị mở chi tiết\n2. [API] POST submit-for-approval, PUT scores', 'Không có nút Chấm điểm/Trình duyệt; API 403');
  c('RES-X16', 'C.UC1.5', 'Phân quyền', 'LĐ đơn vị và LĐ địa phương không có nút và API Gửi Bộ', 'Bảo mật', 'Cao',
    '1. Kết quả Đã phê duyệt; LĐ mở chi tiết\n2. [API] POST send', 'Không có nút Gửi Bộ; API 403');
  c('RES-X17', 'C.UC1.3', 'Phân quyền', 'LĐ Bộ chỉ xem và xử lý mở khóa: không có nút Chấm điểm/Trình/Phê duyệt/Gửi/Xin mở khóa', 'Bảo mật', 'Cao',
    '1. LĐ Bộ mở chi tiết ở Đang chấm điểm, Chờ duyệt, Đã phê duyệt, Đã gửi\n2. [API] POST các thao tác', 'Không có nút thao tác của đơn vị; API 403');
  c('RES-X18', 'C.UC1.6', 'Phân quyền', 'LĐ Bộ thấy nút Duyệt mở khóa/Từ chối mở khóa ở Chờ mở khóa', 'Chức năng', 'Cao',
    '1. Kết quả Chờ mở khóa; LĐ Bộ mở chi tiết', 'Có nút Duyệt mở khóa và Từ chối mở khóa');
  c('RES-X19', 'C.UC1.7', 'Phân quyền', 'Nút thao tác ở Đang chấm điểm với Cán bộ: Chấm điểm/Trình duyệt, không có Phê duyệt/Từ chối/Gửi Bộ', 'Bảo mật', 'Cao',
    '1. Cán bộ mở chi tiết Đang chấm điểm', 'Đúng tập nút theo BR-5 (Chấm điểm, Trình duyệt; không Lưu nháp ở màn chỉ xem)', 'Khảo sát: thực tế có Hủy chỉnh sửa, Lưu nháp, Trình duyệt, Nhắc nhở đơn vị, Xuất Excel → lệch BR-5');
  c('RES-X20', 'C.UC1.7', 'Phân quyền', 'Nút thao tác ở Chờ duyệt: LĐ đơn vị có Phê duyệt, Từ chối; Cán bộ chỉ xem', 'Bảo mật', 'Cao',
    '1. Kết quả Chờ duyệt; mở chi tiết bằng LĐ đơn vị và bằng Cán bộ', 'LĐ đơn vị: Phê duyệt, Từ chối; Cán bộ: chỉ xem', 'Khảo sát: Cán bộ thấy thêm nút "Nhắc nhở đơn vị" và Xuất Excel');
  c('RES-X21', 'C.UC1.7', 'Phân quyền', 'Nút thao tác ở Đã phê duyệt: Cán bộ có Gửi Bộ; LĐ chỉ xem', 'Bảo mật', 'Cao',
    '1. Kết quả Đã phê duyệt; mở chi tiết bằng Cán bộ và LĐ đơn vị', 'Cán bộ có Gửi Bộ; LĐ đơn vị không có nút thao tác');
  c('RES-X22', 'C.UC1.7', 'Phân quyền', 'Nút thao tác ở Đã gửi: chỉ LĐ có Xin mở khóa; Cán bộ chỉ xem (kỳ đang diễn ra)', 'Bảo mật', 'Cao',
    '1. Kết quả Đã gửi, kỳ còn hạn; mở chi tiết bằng Cán bộ và LĐ đơn vị', 'LĐ đơn vị có Xin mở khóa; Cán bộ không có', 'Khảo sát: ngược lại — Cán bộ có Xin mở khóa + Yêu cầu đánh giá lại, LĐ đơn vị không có nút → nghi lỗi cấu hình quyền (xem RES-U10, RES-U12)');
  c('RES-X23', 'C.UC1.7', 'Phân quyền', 'Hành động "Yêu cầu đánh giá lại" (của Bộ) không dành cho người của đơn vị được đánh giá', 'Bảo mật', 'Trung bình',
    '1. Kết quả Đã gửi; CB địa phương [API] POST reassess', '403; kết quả vẫn Đã gửi', 'Khảo sát: CB địa phương/Cán bộ có quyền REASSESS và gọi thành công, chuyển kết quả của chính đơn vị về Bị từ chối → nghi lỗi. ' + BA);
  c('RES-X24', 'C.UC1.7', 'Phân quyền', 'Superadmin xem và thao tác đủ trên mọi kết quả', 'Chức năng', 'Thấp',
    '1. Superadmin mở danh sách và chi tiết các trạng thái', 'Mở được mọi kết quả; có nút theo allowedActions');
  c('RES-X25', 'C.UC1.7', 'Phân quyền', 'Phạm vi dữ liệu danh sách: CB địa phương chỉ thấy kết quả của đơn vị địa phương', 'Bảo mật', 'Cao',
    '1. CB địa phương mở danh sách (Đột xuất, Tất cả)\n2. [API] list với filter organizationId đơn vị khác', 'Mọi dòng thuộc QA - Địa phương; filter đơn vị khác trả rỗng/403 (MSG-045)');
  c('RES-X26', 'C.UC1.7', 'Phân quyền', 'Phạm vi dữ liệu danh sách: Cán bộ (phạm vi toàn hệ thống) thấy nhiều đơn vị; bộ lọc Đơn vị hiển thị', 'Chức năng', 'Trung bình',
    '1. Cán bộ mở danh sách; xem bộ lọc Đơn vị', 'Thấy kết quả nhiều đơn vị; bộ lọc Đơn vị hiển thị khi phạm vi cho phép xem đơn vị con');
  c('RES-X27', 'C.TB', 'Thông báo', 'Thông báo không gửi nhầm: LĐ địa phương không nhận TB-005/TB-006 của đơn vị Bộ', 'Bảo mật', 'Trung bình',
    '1. Trình duyệt và phê duyệt kết quả QA - Đơn vị Bộ\n2. LĐ địa phương, CB địa phương GET notifications/mine', 'Không có thông báo nào gắn assessmentResultId của kết quả QA - Đơn vị Bộ');
  c('RES-X28', 'C.TB', 'Thông báo', 'Bấm thông báo yêu cầu phê duyệt mở đúng chi tiết kết quả', 'Chức năng', 'Trung bình',
    '1. Cán bộ trình duyệt\n2. LĐ đơn vị mở thông báo "Yêu cầu phê duyệt" và bấm', 'Mở trang chi tiết đúng kết quả đang Chờ duyệt, có nút Phê duyệt/Từ chối');
  c('RES-X29', 'C.UC1.7', 'Phân quyền', 'Lỗi 4xx/5xx không lộ stacktrace hoặc đường dẫn nội bộ', 'Bảo mật', 'Cao',
    '1. Gửi các yêu cầu sai: id lạ, JSON hỏng, loại file sai, thiếu quyền\n2. Quét thân phản hồi', 'Thân phản hồi chỉ có code/message thân thiện; không có "at System", đường dẫn tệp, tên máy chủ nội bộ');
  c('RES-X30', 'C.UC1.7', 'Hiệu năng', 'Tải chi tiết kết quả 100 chỉ số < 3 giây (API) và hiển thị < 6 giây', 'Hiệu năng', 'Trung bình',
    '1. Đo GET chi tiết và thời gian hiển thị trang', 'API < 3000 ms; trang hiển thị < 6000 ms');
  c('RES-X31', 'C.UC1.3', 'Hiệu năng', 'Thao tác Trình duyệt/Phê duyệt hoàn tất < 3 giây', 'Hiệu năng', 'Trung bình',
    '1. Đo thời gian POST submit-for-approval và approve', 'Mỗi API < 3000 ms');
  c('RES-X32', 'C.UC1.5', 'Hiệu năng', 'Tải lên PDF 20 MB và gửi Bộ hoàn tất trong thời gian chấp nhận được', 'Hiệu năng', 'Thấp',
    '1. Tải lên PDF 20 MB và gửi', 'Upload < 30 giây trên mạng thường; giao diện hiện tiến trình, không treo');
  c('RES-X33', 'C.UC1.7', 'Phân quyền', 'Đăng xuất rồi mở lại URL chi tiết chuyển về đăng nhập, không lộ dữ liệu', 'Bảo mật', 'Cao',
    '1. Đăng xuất\n2. Mở URL chi tiết kết quả', 'Hiện màn đăng nhập; sau đăng nhập quay lại đúng trang nếu có quyền');
  c('RES-X34', 'C.UC1.7', 'Phân quyền', 'Xuất Excel danh sách theo vai trò: Cán bộ/CB địa phương được; tài khoản chỉ xem bị chặn', 'Bảo mật', 'Trung bình',
    '1. [API] GET /dti/assessment-results/export bằng Cán bộ, CB địa phương, tài khoản chỉ xem', 'Cán bộ/CB địa phương 200 xlsx; chỉ xem 403');
  c('RES-X35', 'C.UC1.7', 'Phân quyền', 'Xuất Excel chi tiết kết quả đơn vị ngoài phạm vi bị chặn', 'Bảo mật', 'Trung bình',
    '1. CB địa phương [API] GET /dti/assessment-results/<id QA - Đơn vị Bộ>/export', '404/403; không tải file');
}
