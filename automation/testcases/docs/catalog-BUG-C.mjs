// Testcase BỔ SUNG từ các bug/góp ý đã log trên GitLab — phạm vi phân hệ C (Kết quả tự đánh giá, Thông báo),
// D (Dashboard đơn vị, Bảng xếp hạng, So sánh đơn vị), E (Đợt khảo sát, Khảo sát trực tuyến, Phiếu, Kết quả khảo sát).
// Chỉ viết case cho issue CHƯA có testcase kiểm đúng hành vi; issue đã có case thì chỉ truy vết ở requirements-BUG-C.mjs.
// Mỗi case ghi số issue ở cột Ghi chú. Chưa có script automation → Manual.
export default function defineBUG_C(t) {
  // note bắt đầu bằng "(đã đóng)" → "GitLab #n (đã đóng). …"; ngược lại → "GitLab #n. …"
  // Case đã có script (scripts/C/ket-qua-tu-danh-gia-*.spec.ts) → Auto
  const AUTO = new Set(['RES-L91', 'RES-L92', 'RES-L94', 'RES-L95', 'RES-L96', 'RES-L97', 'RES-S104', 'RES-S105', 'RES-S106', 'RES-S107', 'RES-S108', 'RES-S109',
    'RES-G24', 'RES-T37', 'RES-A36', 'RES-A37', 'RES-A38', 'RES-V25', 'RES-V26', 'RES-V27', 'RES-D52', 'RES-Z35', 'RES-R33', 'RES-R34', 'RES-W30', 'RES-W31',
    'SVY-L67', 'SVY-L69', 'SVY-V28', 'SVY-V29', 'SVY-V30', 'SVY-V31', 'SVY-C72', 'SVY-C73', 'SVY-C74', 'SVY-C75', 'SVY-E31']);
  const m = (id, uc, fn, title, type, pri, steps, exp, issue, note = '') => {
    const closed = note.startsWith('(đã đóng)');
    const rest = (closed ? note.slice('(đã đóng)'.length) : note).trim();
    t(id, uc, fn, title, type, pri, steps, exp, AUTO.has(id) ? 'Auto' : 'Manual — chưa có script',
      `GitLab #${issue}${closed ? ' (đã đóng)' : ''}${rest ? '. ' + rest : ''}`);
  };

  const GO_RES = '1. Đăng nhập Cán bộ\n2. Mở menu Đánh giá CĐS → Kết quả tự đánh giá';
  const GO_SVY = '1. Đăng nhập Cán bộ\n2. Mở menu Khảo sát hài lòng → Đợt khảo sát';
  const L = 'C.UC1.1', S = 'C.UC1.2', T3 = 'C.UC1.3', A4 = 'C.UC1.4a', V = 'C.UC1.7';

  // ===================== C — Kết quả tự đánh giá: danh sách (C.UC1.1) =====================
  // #162 Review CĐS 30/10 — thừa text phụ trong bảng
  m('RES-L91', L, 'Xem danh sách', 'Bảng danh sách không hiển thị dòng text phụ thừa dưới giá trị các ô (theo design KQ-01)', 'UI', 'Thấp',
    GO_RES + '\n3. Quan sát từng cột của bảng (Kỳ tự đánh giá, Đơn vị, Hạn nộp, Tiến độ chấm, Điểm, Trạng thái)',
    'Mỗi ô chỉ hiển thị giá trị chính theo design KQ-01; không có dòng chữ phụ lặp lại thông tin (vd mã kỳ, loại kỳ, tên tỉnh) dưới giá trị', 162,
    '(đã đóng) Review CĐS 30/10 "KQTĐG danh sách - Thừa text phụ trong bảng". Dòng phụ Điểm xếp hạng ở cột Xếp loại (RES-L03, SRS BR-10) có giữ hay không — cần BA xác nhận');
  // #193 Hạn nộp lệch 1 ngày
  m('RES-L92', L, 'Xem danh sách', 'Hạn nộp hiển thị đúng ngày kết thúc kỳ, không lệch múi giờ', 'Nghiệp vụ', 'Cao',
    '1. Dùng kỳ có ngày kết thúc 31/12/2026\n2. Đăng nhập Cán bộ\n3. Mở menu Đánh giá CĐS → Kết quả tự đánh giá\n4. Xem cột Hạn nộp của kết quả thuộc kỳ đó\n5. Mở chi tiết, xem Hạn nộp ở dòng phụ tiêu đề',
    'Danh sách và chi tiết đều hiển thị Hạn nộp 31/12/2026 (= ngày kết thúc kỳ ở Quản lý tự đánh giá), không hiển thị 30/12/2026', 193,
    '(đã đóng) Thực tế: 31/12 hiển thị thành 30/12 — nghi chuyển đổi UTC/múi giờ');
  // #256 Fix UI KQ-01..KQ-11
  m('RES-L93', L, 'Giao diện', 'Các màn Kết quả tự đánh giá khớp design KQ-01 đến KQ-11', 'UI', 'Trung bình',
    GO_RES + '\n3. Lần lượt mở các màn KQ-01 → KQ-11 (danh sách, chi tiết, chấm điểm, các hộp thoại)\n4. Đối chiếu với design Figma tương ứng',
    'Bố cục, tiêu đề, nhãn, màu, font, khoảng cách, nút của từng màn khớp design KQ-01…KQ-11; không có sai lệch chưa được duyệt', 256,
    '(đã đóng) "[Kết quả tự đánh giá - KQ-01 đến KQ-11] Fix UI các màn theo design mới"');
  // #276 Select Kỳ đánh giá thiếu "Chọn tất cả"
  m('RES-L94', L, 'Bộ lọc', 'Ô chọn Kỳ đánh giá có lựa chọn "Chọn tất cả" chọn/bỏ chọn toàn bộ kỳ', 'Chức năng', 'Trung bình',
    GO_RES + '\n3. Mở ô Kỳ đánh giá, bấm "Chọn tất cả"\n4. Bấm lại "Chọn tất cả"',
    'Bước 3: mọi kỳ trong danh sách được chọn, danh sách kết quả gồm kết quả của tất cả các kỳ đó; bước 4: bỏ chọn toàn bộ, danh sách trở về không giới hạn kỳ', 276,
    '(đã đóng)');
  // #191 Bộ lọc Thời hạn
  m('RES-L95', L, 'Bộ lọc', 'Bộ lọc Thời hạn có đủ 3 giá trị Tất cả, Kỳ đang diễn ra, Kỳ đã kết thúc; mặc định Tất cả', 'Chức năng', 'Cao',
    GO_RES + '\n3. Chọn tab Tất cả\n4. Mở bộ lọc Thời hạn',
    'Có bộ lọc Thời hạn với đúng 3 giá trị Tất cả / Kỳ đang diễn ra / Kỳ đã kết thúc; giá trị mặc định là Tất cả', 191,
    '(đã đóng) Bổ sung cho RES-L09 (ẩn/hiện bộ lọc theo tab)');
  m('RES-L96', L, 'Bộ lọc', 'Lọc Thời hạn "Kỳ đang diễn ra" / "Kỳ đã kết thúc" trả đúng kết quả theo ngày kết thúc kỳ', 'Nghiệp vụ', 'Cao',
    GO_RES + '\n3. Chọn Thời hạn = Kỳ đang diễn ra\n4. Chọn Thời hạn = Kỳ đã kết thúc',
    'Bước 3: mọi dòng thuộc kỳ có ngày kết thúc ≥ hôm nay; bước 4: mọi dòng thuộc kỳ có ngày kết thúc < hôm nay; tổng hai lần lọc = tổng khi chọn Tất cả', 191,
    '(đã đóng)');
  // #192 Bộ lọc Đơn vị
  m('RES-L97', L, 'Bộ lọc', 'Bộ lọc Đơn vị chỉ liệt kê đơn vị trong phạm vi và lọc đúng kết quả của đơn vị đã chọn', 'Chức năng', 'Cao',
    '1. Đăng nhập Lãnh đạo địa phương (phạm vi Đơn vị và đơn vị con)\n2. Mở Kết quả tự đánh giá, mở bộ lọc Đơn vị\n3. Chọn một đơn vị con\n4. Lặp lại bước 2–3 với Cán bộ (phạm vi Toàn hệ thống)',
    'Danh sách đơn vị chỉ gồm đơn vị thuộc phạm vi của tài khoản; sau khi chọn, mọi dòng thuộc đúng đơn vị đã chọn; tổng bản ghi ≤ ban đầu', 192,
    '(đã đóng) Bổ sung cho RES-X26 (hiển thị bộ lọc)');

  // ===================== C — Chấm điểm (C.UC1.2) =====================
  // #150 lỗi UI cột Minh chứng
  m('RES-S104', S, 'Minh chứng', 'Cột Minh chứng ở tab Chấm điểm hiển thị gọn: tên tệp dài được rút gọn "...", nút tải/xóa không vỡ bố cục', 'UI', 'Trung bình',
    GO_RES + '\n3. Mở kết quả Đang chấm điểm → tab Chấm điểm\n4. Đính kèm 2 tệp cho một chỉ số, trong đó 1 tệp có tên dài 120 ký tự',
    'Cột Minh chứng giữ đúng độ rộng theo design; tên tệp dài bị rút gọn bằng "..." (rê chuột xem đủ tên); các tệp xếp dọc, nút Tải file/Xóa thẳng hàng, không đè lên cột Giải trình', 150,
    '(đã đóng) "Không nhập được điểm số nguyên; lỗi UI cột Minh chứng" — phần nhập điểm nguyên đã có RES-S14/S16/G05');
  // #164 Review — nút Thu gọn/Mở rộng, tổng điểm lặp
  m('RES-S105', S, 'Chấm điểm', 'Nút Thu gọn tất cả / Mở rộng tất cả gom thành một cụm thao tác của bảng chấm điểm (không tách rời)', 'UI', 'Thấp',
    GO_RES + '\n3. Mở kết quả → tab Chấm điểm\n4. Quan sát vị trí nút Thu gọn / Mở rộng; bấm lần lượt từng nút',
    'Hai thao tác nằm liền nhau (hoặc 1 nút chuyển trạng thái) ở thanh công cụ của bảng theo design; bấm Thu gọn ẩn mọi cấp con, Mở rộng hiện đủ cây', 164,
    '(đã đóng) Review CĐS 30/10. Gộp 1 nút chuyển trạng thái hay giữ 2 nút liền nhau — cần BA xác nhận');
  m('RES-S106', S, 'Chấm điểm', 'Tổng điểm chỉ hiển thị một lần trên màn chấm điểm (không lặp ở thẻ và bảng)', 'UI', 'Thấp',
    GO_RES + '\n3. Mở kết quả → tab Chấm điểm\n4. Đếm số vị trí hiển thị tổng điểm tạm tính của kết quả',
    'Tổng điểm "a / b" chỉ xuất hiện ở một vị trí theo design (thẻ Điểm tạm tính); không có dòng tổng lặp lại ở đầu/cuối bảng chấm điểm', 164,
    '(đã đóng) Review CĐS 30/10 "KQTĐG chấm điểm - Nút Thu gọn/Mở rộng tách rời, tổng điểm lặp"');
  // #211 ô tìm kiếm quá rộng, bộ lọc Trạng thái chấm bị cắt chữ
  m('RES-S107', S, 'Chấm điểm', 'Ô tìm kiếm chỉ số ở tab Chấm điểm có độ rộng theo design, không chiếm hết thanh công cụ', 'UI', 'Thấp',
    GO_RES + '\n3. Mở kết quả → tab Chấm điểm (màn hình 1366px và 1920px)\n4. Quan sát thanh tìm kiếm/bộ lọc',
    'Ô tìm kiếm có độ rộng cố định theo design; còn đủ chỗ cho bộ lọc Trạng thái chấm và các nút bên cạnh', 211,
    'Đang mở. Thực tế: ô tìm kiếm quá rộng');
  m('RES-S108', S, 'Chấm điểm', 'Bộ lọc Trạng thái chấm hiển thị đủ chữ của giá trị đang chọn, không bị thu nhỏ/cắt chữ', 'UI', 'Thấp',
    GO_RES + '\n3. Mở kết quả → tab Chấm điểm\n4. Lần lượt chọn Trạng thái chấm = Tất cả, Đã chấm, Chưa chấm, Chưa có minh chứng',
    'Với mọi giá trị, nhãn trong ô hiển thị đầy đủ (vd "Chưa có minh chứng"), không bị cắt hoặc "..."; ô không bị co nhỏ hơn design', 211,
    'Đang mở. Thực tế: bộ lọc Trạng thái chấm bị thu nhỏ và cắt chữ');
  // #286 bold cả tên
  m('RES-S109', S, 'Chấm điểm', 'Dòng Trụ cột / Nhóm chỉ số / Chỉ số cha chỉ in đậm phần mã, tên hiển thị font thường', 'UI', 'Thấp',
    GO_RES + '\n3. Mở chi tiết kết quả → tab Chấm điểm\n4. Quan sát dòng trụ cột, nhóm chỉ số, chỉ số cha',
    'Phần mã (vd "1", "1.1", "CS-1208") in đậm; phần tên hiển thị font thường đúng design', 286,
    'Đang mở. Thực tế: in đậm cả tên');
  // #179 mất mạng khi Lưu nháp
  m('RES-G24', S, 'Chấm điểm', 'Mất kết nối khi Lưu nháp: hiển thị thông báo lỗi kết nối, giữ nguyên điểm/giải trình đang nhập', 'Nghiệp vụ', 'Cao',
    GO_RES + '\n3. Mở kết quả Đang chấm điểm, nhập điểm và giải trình cho 2 chỉ số\n4. Ngắt mạng (DevTools Offline), bấm Lưu nháp\n5. Bật lại mạng, bấm Lưu nháp',
    'Bước 4: có thông báo lỗi kết nối (không im lặng, không báo thành công); dữ liệu đang nhập còn nguyên; bước 5: lưu thành công, tải lại thấy đúng điểm', 179,
    '(đã đóng) "[Chung] Mất mạng / mất kết nối khi thao tác: app không hiển thị thông báo lỗi" — phần Kết quả tự đánh giá');

  // ===================== C — Trình duyệt / Phê duyệt (C.UC1.3, 1.4a) =====================
  m('RES-T37', T3, 'Trình duyệt', 'Mất kết nối khi xác nhận Trình duyệt: hiển thị thông báo lỗi, trạng thái không đổi', 'Nghiệp vụ', 'Cao',
    GO_RES + '\n3. Mở kết quả đã chấm đủ điểm, bấm Trình duyệt\n4. Ngắt mạng rồi bấm xác nhận',
    'Có thông báo lỗi kết nối; hộp thoại không tự đóng im lặng; tải lại khi có mạng thấy trạng thái vẫn Đang chấm điểm, lịch sử không có dòng Trình duyệt', 179, '(đã đóng)');
  m('RES-A36', A4, 'Phê duyệt', '[API] Hai yêu cầu Phê duyệt đồng thời cho cùng một kết quả chỉ một yêu cầu thành công', 'Nghiệp vụ', 'Trung bình',
    '1. Chuẩn bị kết quả Chờ duyệt\n2. [API] Gửi đồng thời 2 request POST approve bằng tài khoản Lãnh đạo đơn vị',
    'Một request 200, request còn lại 4xx với thông báo kết quả đã được xử lý; trạng thái Đã phê duyệt; lịch sử chỉ 1 dòng Phê duyệt; chỉ 1 thông báo gửi Cán bộ', 200,
    '(đã đóng) "Hai yêu cầu phê duyệt đồng thời: cả hai đều không đúng kỳ vọng (cần xác nhận)" — mã lỗi của request thứ hai (409/400) cần BA xác nhận. Bổ sung cho RES-Y16 (Phê duyệt + Từ chối)');
  m('RES-A37', A4, 'Phê duyệt', 'Lãnh đạo địa phương mở chi tiết và phê duyệt được kết quả Chờ duyệt của đơn vị địa phương trong phạm vi', 'Chức năng', 'Cao',
    '1. Chuẩn bị kết quả Chờ duyệt của đơn vị địa phương (Cán bộ địa phương đã Trình duyệt)\n2. Đăng nhập Lãnh đạo địa phương; mở Kết quả tự đánh giá → bấm Xem chi tiết kết quả đó\n3. Bấm Phê duyệt → xác nhận',
    'Bước 2: trang chi tiết mở bình thường (API 200, không 404) và có nút Phê duyệt/Từ chối; bước 3: kết quả chuyển Đã phê duyệt, thông báo "Phê duyệt thành công"', 210,
    '(đã đóng) Thực tế: trang chi tiết báo 404');
  m('RES-A38', A4, 'Phê duyệt', 'Mất kết nối khi Phê duyệt/Từ chối: hiển thị thông báo lỗi, trạng thái giữ Chờ duyệt', 'Nghiệp vụ', 'Cao',
    '1. Đăng nhập Lãnh đạo đơn vị, mở kết quả Chờ duyệt\n2. Ngắt mạng, bấm Phê duyệt → xác nhận\n3. Lặp lại với Từ chối (nhập lý do)',
    'Mỗi lần có thông báo lỗi kết nối, không báo thành công; tải lại khi có mạng thấy vẫn Chờ duyệt; lịch sử không thêm dòng', 179, '(đã đóng)');

  // ===================== C — Chi tiết kết quả (C.UC1.7) =====================
  // #163 Review — card thông số chưa nổi, Thông tin chung chiếm chỗ
  m('RES-V25', V, 'Xem chi tiết', 'Các thẻ thông số (Tiến độ chấm, Điểm tạm tính, Minh chứng) nổi bật theo design', 'UI', 'Thấp',
    GO_RES + '\n3. Mở chi tiết một kết quả\n4. Quan sát khối thẻ thông số đầu trang',
    'Thẻ có nền/viền/đổ bóng, số liệu cỡ chữ lớn và đậm, nhãn nhỏ phía trên theo design KQ; phân biệt rõ với nội dung còn lại', 163,
    '(đã đóng) Review CĐS 30/10 "KQTĐG chi tiết - Card thông số chưa nổi"');
  m('RES-V26', V, 'Xem chi tiết', 'Khối Thông tin chung ở chi tiết kết quả bố cục gọn, không chiếm nhiều chiều cao', 'UI', 'Thấp',
    GO_RES + '\n3. Mở chi tiết một kết quả (màn 1366×768)\n4. Quan sát khối Thông tin chung',
    'Thông tin chung trình bày dạng lưới nhiều cột theo design; bảng chấm điểm/cây chỉ số nhìn thấy ngay trong màn hình đầu tiên không cần cuộn', 163,
    '(đã đóng) Review CĐS 30/10 "card Thông tin chung chiếm chỗ"');
  // #165 Review — role Lãnh đạo dùng chung form chấm điểm
  m('RES-V27', V, 'Xem chi tiết', 'Lãnh đạo xem chi tiết dùng chung bố cục form chấm điểm của đơn vị (cùng cột, cây, thẻ) ở chế độ chỉ xem', 'UI', 'Trung bình',
    '1. Mở chi tiết cùng một kết quả bằng Cán bộ và bằng Lãnh đạo đơn vị\n2. So sánh bố cục hai màn',
    'Hai màn cùng cấu trúc: thẻ thông số, cây Trụ cột → Nhóm → Chỉ số, các cột Điểm tối đa / Điểm tự chấm / Minh chứng / Giải trình; với Lãnh đạo các ô chỉ hiển thị chữ, không có ô nhập', 165,
    '(đã đóng) Review CĐS 30/10 "KQTĐG role Lãnh đạo - Dùng chung form chấm điểm của đơn vị". Chế độ chỉ xem: RES-V14');
  // #212 bỏ banner Bị từ chối
  m('RES-D52', V, 'Chi tiết kết quả', 'Kết quả Bị từ chối không hiển thị banner "Bị từ chối phê duyệt" trùng nội dung tab Lịch sử', 'UI', 'Thấp',
    '1. Chuẩn bị kết quả bị Lãnh đạo đơn vị từ chối kèm lý do\n2. Mở chi tiết kết quả\n3. Mở tab Lịch sử',
    'Bước 2: không có banner "Bị từ chối phê duyệt" ở đầu trang (chip trạng thái vẫn là Bị từ chối); bước 3: dòng Từ chối có người, thời gian và lý do', 212,
    '(đã đóng) Mâu thuẫn với RES-D05/RES-A25 (SRS UC1.7 BR-4: thông tin bổ sung nêu người từ chối, ngày, lý do) — cần BA xác nhận và cập nhật SRS');
  // #198 [API] tải minh chứng khi không có quyền chấm điểm
  m('RES-Z35', S, 'Minh chứng', '[API] Vai trò không có quyền chấm điểm tải minh chứng lên bị 403', 'Bảo mật', 'Cao',
    '1. [API] Đăng nhập Lãnh đạo đơn vị, POST /upload/blob/assessment_result_evidence với tệp PDF hợp lệ cho kết quả Đang chấm điểm\n2. Lặp lại với Lãnh đạo Bộ và tài khoản Chỉ xem',
    'Mọi lời gọi trả 403 "Bạn không có quyền truy cập chức năng này"; không tạo tệp; minh chứng của kết quả không đổi', 198,
    '(đã đóng) Thực tế: vai trò không có quyền chấm điểm vẫn tải được minh chứng. Bổ sung cho RES-Z05 (không token)');

  // ===================== C — Phía Bộ: Gửi nhắc nhở (C.UC2.2), Yêu cầu đánh giá lại (C.UC2.3) =====================
  m('RES-R33', 'C.UC2.2', 'Nhắc nhở', 'Hộp thoại "Gửi nhắc nhở hạn nộp tự đánh giá": cột tiến độ hiển thị "0/127 chỉ số" trên một dòng', 'UI', 'Thấp',
    GO_RES + '\n3. Bấm Gửi nhắc nhở\n4. Quan sát cột tiến độ chỉ số trong hộp thoại',
    'Cột tiến độ đủ rộng, chuỗi "0/127 chỉ số" hiển thị trên một dòng, không xuống dòng từng ký tự; các cột khác không bị đè', 222,
    '(đã đóng) Thực tế: cột tiến độ bị bóp hẹp, chữ xuống dòng từng ký tự');
  m('RES-R34', 'C.UC2.2', 'Nhắc nhở', 'Số đơn vị chưa gửi trên nút "Gửi nhắc nhở" bằng số đơn vị trong hộp thoại', 'Nghiệp vụ', 'Cao',
    GO_RES + '\n3. Ghi nhận số trên nút Gửi nhắc nhở (n)\n4. Bấm nút, đếm số đơn vị trong danh sách của hộp thoại',
    'Số dòng trong hộp thoại = n; cùng điều kiện lọc (loại kỳ, kỳ) giữa nút và hộp thoại', 223,
    '(đã đóng) Thực tế: nút hiển thị 9 đơn vị chưa gửi nhưng hộp thoại chỉ có 8');
  const GO_RA = '1. Đăng nhập Lãnh đạo Bộ\n2. Mở Kết quả tự đánh giá → kết quả Đã gửi\n3. Bấm Yêu cầu đánh giá lại';
  m('RES-W29', 'C.UC2.3', 'Đánh giá lại', 'Popup "Yêu cầu đánh giá lại": tiêu đề đúng design', 'UI', 'Thấp', GO_RA + '\n4. Đối chiếu tiêu đề popup với design',
    'Tiêu đề popup đúng nội dung, cỡ chữ, độ đậm như design', 287, 'Đang mở. Nội dung chữ đối chiếu design Figma');
  m('RES-W30', 'C.UC2.3', 'Đánh giá lại', 'Popup "Yêu cầu đánh giá lại": sub title nêu đúng đơn vị và kỳ theo design', 'UI', 'Thấp', GO_RA + '\n4. Đối chiếu dòng mô tả dưới tiêu đề',
    'Có sub title đúng mẫu design, chứa tên đơn vị và tên kỳ của kết quả đang xử lý', 287, 'Đang mở');
  m('RES-W31', 'C.UC2.3', 'Đánh giá lại', 'Popup "Yêu cầu đánh giá lại": nhãn ô lý do đúng design, có dấu * bắt buộc màu đỏ', 'UI', 'Thấp', GO_RA + '\n4. Quan sát nhãn ô nhập lý do',
    'Nhãn đúng chữ như design; có dấu * màu đỏ thể hiện bắt buộc', 287, 'Đang mở');
  m('RES-W32', 'C.UC2.3', 'Đánh giá lại', 'Popup "Yêu cầu đánh giá lại": placeholder ô lý do đúng design', 'UI', 'Thấp', GO_RA + '\n4. Quan sát placeholder ô lý do khi chưa nhập',
    'Placeholder đúng nội dung như design', 287, 'Đang mở');
  m('RES-W33', 'C.UC2.3', 'Đánh giá lại', 'Popup "Yêu cầu đánh giá lại": nút Hủy và nút xác nhận đúng nhãn, màu, thứ tự theo design', 'UI', 'Thấp', GO_RA + '\n4. Quan sát chân popup',
    'Hai nút đúng nhãn, nút chính màu theo design, thứ tự và căn lề đúng design; nút xác nhận vô hiệu khi chưa nhập lý do (nếu design quy định)', 287, 'Đang mở');

  // ===================== C — Thông báo (C.TB) =====================
  m('RES-N39', 'C.TB', 'Thông báo', 'Ô/danh sách Thông báo khớp design TB-01, TB-03', 'UI', 'Trung bình',
    '1. Đăng nhập Cán bộ có thông báo chưa đọc và đã đọc\n2. Bấm biểu tượng chuông (TB-01)\n3. Mở trang danh sách thông báo (TB-03)\n4. Đối chiếu design',
    'Bố cục, biểu tượng, số chưa đọc, phân biệt đã đọc/chưa đọc, thời gian, nút "Đánh dấu tất cả đã đọc"/"Xem tất cả" khớp design TB-01, TB-03', 255,
    '(đã đóng) "[Thông báo - TB-01, TB-03] Fix UI theo design mới"');

  // ===================== E — Đợt khảo sát =====================
  // #60 Remove sort "Trạng thái"
  m('SVY-L67', 'E.UC1.1', 'Danh sách', 'Cột Trạng thái ở danh sách đợt khảo sát không có chức năng sắp xếp', 'UI', 'Thấp',
    GO_SVY + '\n3. Rê chuột/bấm vào tiêu đề cột Trạng thái',
    'Tiêu đề cột Trạng thái không có biểu tượng sắp xếp; bấm vào không đổi thứ tự dòng (lọc trạng thái bằng tab — SVY-L06)', 60,
    '(đã đóng) "Remove sort Trạng thái". #74 (sau đó) lại nêu "Thiếu bộ lọc/sort theo Trạng thái" — có sort theo Trạng thái hay không cần BA xác nhận');
  // #270 Fix UI KS-01..KS-11 (+ #61 Lỗi UI chung)
  m('SVY-L68', 'E.UC1.1', 'Giao diện', 'Các màn Đợt khảo sát khớp design KS-01 đến KS-11', 'UI', 'Trung bình',
    GO_SVY + '\n3. Lần lượt mở các màn KS-01 → KS-11 (danh sách, tạo/sửa, chi tiết, các hộp thoại trình/duyệt/từ chối/xóa)\n4. Đối chiếu design Figma tương ứng',
    'Bố cục, tiêu đề, nhãn, placeholder, màu, font, nút của từng màn khớp design KS-01…KS-11', 270,
    '(đã đóng) "[Đợt khảo sát] Fix UI các màn KS-01 đến KS-11 theo design mới"; dùng chung cho #61 "[Đợt khảo sát] Lỗi UI"');
  // #166 Review — thừa text phụ
  m('SVY-L69', 'E.UC1.1', 'Danh sách', 'Bảng danh sách đợt khảo sát không có dòng text phụ thừa dưới giá trị các ô', 'UI', 'Thấp',
    GO_SVY + '\n3. Quan sát các cột Mã, Tên đợt, Hình thức, Thời gian, Tiến độ, Trạng thái',
    'Mỗi ô chỉ hiển thị nội dung theo design KS-01 (Thời gian 2 dòng ngày bắt đầu/kết thúc là đúng design); không có dòng chữ phụ lặp thông tin', 166,
    '(đã đóng) Review CĐS 30/10 "Đợt khảo sát - Thừa text phụ"');
  // #66 lý do từ chối dài
  m('SVY-V28', 'E.UC1.2', 'Chi tiết', 'Lý do từ chối dài hiển thị tối đa 2 dòng, phần thừa thay bằng "..."', 'UI', 'Thấp',
    '1. Chuẩn bị đợt Bị từ chối với lý do 1.000 ký tự\n2. Mở chi tiết đợt\n3. Quan sát khối thông tin từ chối',
    'Lý do hiển thị tối đa 2 dòng kết thúc bằng "..."; xem đầy đủ được (tooltip/mở rộng hoặc Lịch sử xử lý); bố cục không bị đẩy dài', 66,
    '(đã đóng) Cách xem đầy đủ lý do (tooltip hay mở rộng) — cần BA xác nhận');
  // #103 Quay lại giữ bộ lọc và trang
  m('SVY-V29', 'E.UC1.2', 'Chi tiết', 'Quay lại từ chi tiết đợt về danh sách giữ nguyên từ khóa, tab/bộ lọc và trang đang xem', 'Chức năng', 'Trung bình',
    GO_SVY + '\n3. Nhập từ khóa, chọn tab Đang diễn ra, sang trang 2\n4. Mở chi tiết một đợt, bấm Quay lại',
    'Danh sách hiển thị lại đúng từ khóa, tab Đang diễn ra và trang 2 như trước khi mở chi tiết', 103,
    '(đã đóng) Thực tế: nút Quay lại không giữ bộ lọc và trang. Bổ sung cho SVY-V21');
  // #166 Review — khối từ chối, Thông tin chung
  m('SVY-V30', 'E.UC1.2', 'Chi tiết', 'Khối Bị từ chối ở chi tiết đợt nhỏ gọn theo design (không chiếm nhiều chiều cao)', 'UI', 'Thấp',
    '1. Mở chi tiết một đợt Bị từ chối (màn 1366×768)\n2. Quan sát khối từ chối',
    'Khối từ chối gồm người từ chối, thời điểm, lý do rút gọn trên một khối gọn theo design; nội dung khảo sát nhìn thấy trong màn hình đầu tiên', 166,
    '(đã đóng) Review CĐS 30/10 "khối từ chối chiếm chỗ"');
  m('SVY-V31', 'E.UC1.2', 'Chi tiết', 'Khối Thông tin chung ở chi tiết đợt bố cục gọn (lưới nhiều cột) theo design', 'UI', 'Thấp',
    '1. Mở chi tiết một đợt (màn 1366×768)\n2. Quan sát khối Thông tin chung',
    'Các trường Mã đợt, Hình thức, Đơn vị thực hiện, Thời gian, Phiếu mục tiêu, Người tạo, Mô tả trình bày dạng lưới nhiều cột; không chiếm quá nửa chiều cao màn hình', 166,
    '(đã đóng) Review CĐS 30/10 "Thông tin chung chiếm chỗ"');
  // #84 disable ngày quá khứ
  m('SVY-C72', 'E.UC1.3', 'Validate', 'Lịch chọn Ngày bắt đầu vô hiệu hóa các ngày trong quá khứ, cho chọn hôm nay', 'UI', 'Trung bình',
    '1. Đăng nhập Cán bộ\n2. Đợt khảo sát → "+ Tạo đợt khảo sát"\n3. Mở lịch ở ô Ngày bắt đầu',
    'Các ngày trước hôm nay bị mờ, không bấm chọn được; hôm nay và các ngày sau chọn được', 84,
    '(đã đóng) Bổ sung cho SVY-C19 (nhập tay ngày quá khứ → MSG-096)');
  // #100 Thêm mới đợt khảo sát
  m('SVY-C73', 'E.UC1.3', 'Giao diện', 'Thanh nút thao tác màn Thêm mới đợt khảo sát đúng design (nhãn, màu, thứ tự Hủy / Lưu nháp / Trình phê duyệt)', 'UI', 'Thấp',
    '1. Đăng nhập Cán bộ\n2. Đợt khảo sát → "+ Tạo đợt khảo sát"\n3. Quan sát cụm nút thao tác',
    'Cụm nút đúng nhãn, thứ tự, màu (nút chính nổi bật) và vị trí như design KS', 100, '(đã đóng)');
  m('SVY-C74', 'E.UC1.3', 'Soạn câu hỏi', 'Câu hỏi soạn trực tiếp trên ô nhập, không có nút "Sửa câu hỏi"', 'UI', 'Thấp',
    '1. Ở màn Thêm mới đợt khảo sát, thêm nhóm và 2 câu hỏi\n2. Bấm vào nội dung câu hỏi và sửa',
    'Không có nút "Sửa câu hỏi"; nội dung câu sửa trực tiếp trong ô và được lưu khi Lưu nháp', 100, '(đã đóng)');
  m('SVY-C75', 'E.UC1.3', 'Giao diện', 'Header màn Thêm mới đợt khảo sát (tiêu đề và nút thao tác) được ghim khi cuộn', 'UI', 'Thấp',
    '1. Ở màn Thêm mới đợt khảo sát, thêm 3 nhóm × 10 câu\n2. Cuộn xuống cuối trang',
    'Tiêu đề và cụm nút Lưu nháp/Trình phê duyệt luôn hiển thị ở đầu màn hình khi cuộn; không che nội dung câu hỏi', 100, '(đã đóng)');
  m('SVY-E31', 'E.UC1.4', 'Lịch sử', 'Lưu chỉnh sửa đợt ghi sự kiện "Chỉnh sửa" vào Lịch sử xử lý (người sửa, thời điểm)', 'Nghiệp vụ', 'Trung bình',
    '1. Mở đợt Nháp (hoặc Bị từ chối) → Chỉnh sửa\n2. Đổi tên đợt, bấm Lưu nháp\n3. Mở chi tiết → Lịch sử xử lý',
    'Có dòng mới nhất "Chỉnh sửa" với người sửa và thời điểm lưu; các sự kiện cũ còn nguyên', 100,
    '(đã đóng) "lịch sử xử lý thiếu ghi nhận sửa". SRS BR-7 có liệt kê sự kiện Chỉnh sửa hay không — cần BA xác nhận');
}
