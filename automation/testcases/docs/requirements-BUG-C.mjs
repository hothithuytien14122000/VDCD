// Truy vết các bug/góp ý đã log GitLab thuộc phân hệ C (Kết quả tự đánh giá, Thông báo), D (Dashboard/Bảng xếp hạng/So sánh),
// E (Đợt khảo sát, Khảo sát trực tuyến) → testcase đã có trong catalog hoặc testcase mới ở catalog-BUG-C.mjs.
// Mỗi issue = 1 yêu cầu. (#130 "[Đợt khảo sát]" không có nội dung trong tiêu đề → không truy vết.)
export default R => [
  // ===================== C — Kết quả tự đánh giá: danh sách =====================
  R('RES', 'C.UC1.1', null, 'GitLab #189 — Danh sách thiếu cột Xếp loại (chip mức + Điểm xếp hạng %) theo SRS UC1.1 BR-10', [
    ['Cột Xếp loại: chip tên mức và dòng phụ Điểm xếp hạng %', 'RES-L03'],
    ['Chỉ có giá trị ở Đã gửi/Chờ mở khóa; % làm tròn 2 chữ số; mức theo mốc', 'RES-L79|RES-L80|RES-L81'],
  ]),
  R('RES', 'C.UC1.1', null, 'GitLab #190 — Thiếu tab "Cần xử lý" (tab mặc định) cho Cán bộ / Cán bộ địa phương', [
    ['Tab Cần xử lý được chọn mặc định', 'RES-L05'], ['Số trên tab Cần xử lý đúng', 'RES-L08'],
  ]),
  R('RES', 'C.UC1.1', null, 'GitLab #191 — Thiếu bộ lọc "Thời hạn" (Tất cả / Kỳ đang diễn ra / Kỳ đã kết thúc)', [
    ['Bộ lọc ẩn ở tab Cần xử lý, hiện ở tab khác', 'RES-L09'],
    ['Đủ 3 giá trị, mặc định Tất cả', 'RES-L95'], ['Lọc đúng theo ngày kết thúc kỳ', 'RES-L96'],
  ]),
  R('RES', 'C.UC1.1', null, 'GitLab #192 — Bổ sung bộ lọc "Đơn vị" cho phạm vi Đơn vị và đơn vị con / Toàn hệ thống', [
    ['Bộ lọc Đơn vị hiển thị theo phạm vi', 'RES-X26|RES-B42'], ['Chỉ đơn vị trong phạm vi, lọc đúng', 'RES-L97'],
  ]),
  R('RES', 'C.UC1.1', null, 'GitLab #193 — Hạn nộp lệch 1 ngày so với ngày kết thúc kỳ (múi giờ)', [['Hạn nộp = ngày kết thúc kỳ ở danh sách và chi tiết', 'RES-L92']]),
  R('RES', 'C.UC1.7', null, 'GitLab #194 — Tiến độ chấm sai: x > y (38/0, 38/19)', [
    ['Tử số không vượt mẫu số, % ≤ 100', 'RES-D30'], ['Cột Tiến độ chấm "x/y chỉ số" đúng', 'RES-L56'],
  ]),
  R('RES', 'C.UC1.1', null, 'GitLab #276 — Select "Kỳ đánh giá" thiếu "Chọn tất cả"', [['Có "Chọn tất cả" chọn/bỏ chọn mọi kỳ', 'RES-L94']]),
  R('RES', 'C.UC1.1', null, 'GitLab #162 — Review CĐS 30/10: KQTĐG danh sách thừa text phụ trong bảng', [['Ô bảng không có text phụ thừa', 'RES-L91']]),
  R('RES', 'C.UC1.1', null, 'GitLab #256 — Fix UI các màn KQ-01 đến KQ-11 theo design mới', [['Các màn KQ-01…KQ-11 khớp design', 'RES-L93']]),

  // ===================== C — Chấm điểm =====================
  R('RES', 'C.UC1.2', null, 'GitLab #150 — Không nhập được điểm số nguyên; lỗi UI cột Minh chứng', [
    ['Nhập điểm nguyên (0, = tối đa, sửa thành 5) lưu được', 'RES-S14|RES-S16|RES-G05'],
    ['Cột Minh chứng hiển thị gọn, không vỡ bố cục', 'RES-S104'],
  ]),
  R('RES', 'C.UC1.2', null, 'GitLab #195 — Lưu nháp khi chưa nhập đủ điểm báo lỗi "$.scores[0].score không hợp lệ" (sai BR-6, BR-11)', [
    ['Lưu nháp không yêu cầu đủ điểm', 'RES-S06'], ['Ô điểm trống không bị hiểu là 0', 'RES-S08'],
  ]),
  R('RES', 'C.UC1.2', null, 'GitLab #197 — Lưu nháp thành công nhưng Lịch sử xử lý không ghi "Lưu nháp"', [['Lịch sử ghi hành động Lưu nháp', 'RES-S05']]),
  R('RES', 'C.UC1.2', null, 'GitLab #164 — Review CĐS 30/10: KQTĐG chấm điểm — nút Thu gọn/Mở rộng tách rời, tổng điểm lặp', [
    ['Thu gọn/Mở rộng gom một cụm', 'RES-S105'], ['Tổng điểm không lặp', 'RES-S106'],
  ]),
  R('RES', 'C.UC1.2', null, 'GitLab #211 — Tab Chấm điểm: ô tìm kiếm quá rộng, bộ lọc Trạng thái chấm bị thu nhỏ, cắt chữ', [
    ['Ô tìm kiếm đúng độ rộng design', 'RES-S107'], ['Bộ lọc Trạng thái chấm đủ chữ', 'RES-S108'],
  ]),
  R('RES', 'C.UC1.2', null, 'GitLab #286 — Tab Chấm điểm: dòng trụ cột/nhóm/chỉ số cha in đậm cả tên, design chỉ in đậm mã', [['Chỉ in đậm mã', 'RES-S109']]),
  R('RES', 'C.UC1.2', null, 'GitLab #198 — [API] Vai trò không có quyền chấm điểm vẫn tải được minh chứng', [
    ['Vai trò không quyền chấm điểm tải minh chứng → 403', 'RES-Z35'], ['Không token → 401', 'RES-Z05'],
  ]),
  R('RES', 'C.UC1.2', null, 'GitLab #179 — [Chung] Mất mạng khi thao tác không hiển thị thông báo lỗi (phần Kết quả tự đánh giá)', [
    ['Danh sách khi mất mạng', 'RES-G08'], ['Lưu nháp khi mất mạng', 'RES-G24'],
    ['Trình duyệt khi mất mạng', 'RES-T37'], ['Phê duyệt/Từ chối khi mất mạng', 'RES-A38'], ['Gửi Bộ khi mất mạng', 'RES-F38'],
  ]),

  // ===================== C — Phê duyệt =====================
  R('RES', 'C.UC1.4a', null, 'GitLab #200 — [API] Hai yêu cầu phê duyệt đồng thời đều không đúng kỳ vọng', [
    ['Hai Phê duyệt đồng thời chỉ một thành công', 'RES-A36'], ['Phê duyệt + Từ chối đồng thời chỉ một có hiệu lực', 'RES-Y16'],
  ]),
  R('RES', 'C.UC1.4a', null, 'GitLab #210 — Lãnh đạo địa phương không phê duyệt được kết quả Chờ duyệt của đơn vị địa phương (chi tiết 404)', [
    ['LĐ địa phương mở chi tiết và phê duyệt được trong phạm vi', 'RES-A37'], ['Ngoài phạm vi vẫn bị chặn', 'RES-X12'],
  ]),

  // ===================== C — Chi tiết kết quả =====================
  R('RES', 'C.UC1.7', null, 'GitLab #196 — Chi tiết không hiển thị cây Trụ cột → Nhóm → Chỉ số thụt cấp, thiếu điểm theo cấp (UC1.7 BR-6)', [
    ['Cây thụt cấp, dòng cha có điểm/điểm tối đa', 'RES-V06'], ['Dòng Nhóm và Trụ cột có điểm/tối đa', 'RES-D19|RES-D20'],
  ]),
  R('RES', 'C.UC1.7', null, 'GitLab #163 — Review CĐS 30/10: KQTĐG chi tiết — card thông số chưa nổi, card Thông tin chung chiếm chỗ', [
    ['Thẻ thông số nổi bật', 'RES-V25'], ['Thông tin chung gọn', 'RES-V26'],
  ]),
  R('RES', 'C.UC1.7', null, 'GitLab #165 — Review CĐS 30/10: KQTĐG role Lãnh đạo dùng chung form chấm điểm của đơn vị', [
    ['Lãnh đạo dùng cùng bố cục form chấm điểm', 'RES-V27'], ['Lãnh đạo ở chế độ chỉ xem', 'RES-V14'],
  ]),
  R('RES', 'C.UC1.7', null, 'GitLab #212 — Chi tiết Bị từ chối: bỏ banner "Bị từ chối phê duyệt" lặp nội dung tab Lịch sử', [['Không có banner, lý do xem ở Lịch sử', 'RES-D52']]),

  // ===================== C — Phía Bộ =====================
  R('RES', 'C.UC2.2', null, 'GitLab #222 — Hộp thoại Gửi nhắc nhở: cột tiến độ bị bóp hẹp, chữ xuống dòng từng ký tự', [['Cột tiến độ hiển thị một dòng', 'RES-R33']]),
  R('RES', 'C.UC2.2', null, 'GitLab #223 — Nút Gửi nhắc nhở hiển thị 9 đơn vị nhưng hộp thoại chỉ có 8', [['Số trên nút = số đơn vị trong hộp thoại', 'RES-R34']]),
  R('RES', 'C.UC2.3', null, 'GitLab #287 — Popup "Yêu cầu đánh giá lại" chưa khớp design (title, sub title, label, placeholder, button)', [
    ['Tiêu đề', 'RES-W29'], ['Sub title', 'RES-W30'], ['Nhãn ô lý do', 'RES-W31'], ['Placeholder', 'RES-W32'], ['Nút', 'RES-W33'],
  ]),

  // ===================== C — Thông báo =====================
  R('RES', 'C.TB', null, 'GitLab #199 — [API] Filter thông báo không phải JSON trả 500 thay vì 400', [['filter không phải JSON → 400', 'RES-Z30']]),
  R('RES', 'C.TB', null, 'GitLab #255 — Fix UI Thông báo TB-01, TB-03 theo design mới', [['Thông báo khớp design TB-01, TB-03', 'RES-N39']]),

  // ===================== D — Dashboard đơn vị =====================
  R('DSH', 'D.UC1.1', null, 'GitLab #242 — Select "Đơn vị" hiển thị danh sách phẳng, chưa dạng cây cha – con', [['Ô Đơn vị dạng cây cha–con, có tìm kiếm, trong phạm vi', 'DSH-F17']]),

  // ===================== E — Đợt khảo sát =====================
  R('SVY', 'E.UC1.2', null, 'GitLab #59 — Field Đơn vị thực hiện hiển thị sai thông tin', [
    ['Đơn vị thực hiện ở chi tiết đúng dữ liệu đã lưu', 'SVY-V03'], ['Đơn vị thực hiện ở form tạo = đơn vị tài khoản', 'SVY-C02'],
  ]),
  R('SVY', 'E.UC1.1', null, 'GitLab #60 — Bỏ sort cột "Trạng thái"', [['Cột Trạng thái không sắp xếp', 'SVY-L67']]),
  R('SVY', 'E.UC1.1', null, 'GitLab #74 — Thiếu bộ lọc/sort theo Trạng thái ở màn danh sách', [['Lọc theo trạng thái bằng tab, mỗi tab đúng dữ liệu', 'SVY-L06']]),
  R('SVY', 'E.UC1.1', null, 'GitLab #61 — [Đợt khảo sát] Lỗi UI', [['Các màn Đợt khảo sát khớp design', 'SVY-L68']]),
  R('SVY', 'E.UC1.1', null, 'GitLab #270 — Fix UI các màn KS-01 đến KS-11 theo design mới', [['Các màn KS-01…KS-11 khớp design', 'SVY-L68']]),
  R('SVY', 'E.UC1.7a', null, 'GitLab #62 — [Khảo sát hài lòng] Nút "Phê duyệt" hiển thị cho tài khoản không có quyền duyệt', [
    ['Cán bộ không quyền duyệt không thấy nút Phê duyệt', 'SVY-A01'], ['API duyệt không quyền bị chặn', 'SVY-A13'],
  ]),
  R('SVY', 'E.UC1.2', null, 'GitLab #66 — Lý do từ chối quá dài, giới hạn 2 dòng và "..."', [['Lý do tối đa 2 dòng, "..."', 'SVY-V28']]),
  R('SVY', 'E.UC1.3', null, 'GitLab #73 — Không cho chọn Ngày bắt đầu là hôm nay (sai SRS)', [['Ngày bắt đầu = hôm nay hợp lệ', 'SVY-C18']]),
  R('SVY', 'E.UC1.3', null, 'GitLab #84 — Ngày bắt đầu cần disable các ngày trong quá khứ', [
    ['Lịch vô hiệu ngày quá khứ', 'SVY-C72'], ['Nhập tay ngày quá khứ bị MSG-096', 'SVY-C19'],
  ]),
  R('SVY', 'E.UC1.3', null, 'GitLab #100 — Thêm mới đợt khảo sát: UI nút thao tác, bỏ nút Sửa câu hỏi, ghim header, lịch sử thiếu ghi nhận sửa', [
    ['Nút thao tác đúng design', 'SVY-C73'], ['Không có nút Sửa câu hỏi', 'SVY-C74'], ['Ghim header khi cuộn', 'SVY-C75'],
    ['Lịch sử ghi sự kiện Chỉnh sửa', 'SVY-E31'],
  ]),
  R('SVY', 'E.UC1.2', null, 'GitLab #103 — Xem chi tiết khảo sát: ID không tồn tại không báo lỗi, Quay lại không giữ bộ lọc và trang', [
    ['ID không tồn tại/không được xem → MSG-044', 'SVY-V24'], ['Quay lại giữ từ khóa, bộ lọc, trang', 'SVY-V29'],
  ]),
  R('SVY', 'E.UC1.2', null, 'GitLab #166 — Review CĐS 30/10: Đợt khảo sát thừa text phụ, khối từ chối và Thông tin chung chiếm chỗ', [
    ['Không có text phụ thừa ở bảng', 'SVY-L69'], ['Khối từ chối gọn', 'SVY-V30'], ['Thông tin chung gọn', 'SVY-V31'],
  ]),

  // ===================== E — Khảo sát trực tuyến (người dân) =====================
  R('PUB', 'E.UC2.1', null, 'GitLab #99 — Mở danh sách bằng "Các khảo sát đang mở" trên header hiển thị trang trắng', [['Nút header mở lại danh sách công khai', 'PUB-L20']]),
];
