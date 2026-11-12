// Truy vết các issue GitLab (phạm vi: ĐVHC cấp tỉnh/xã, Loại đơn vị, Đơn vị, Tham số hệ thống, Nhật ký, issue xuyên suốt A/API/Mã-Tên-Tìm kiếm)
// → testcase MỚI (catalog-BUG-A2.mjs) hoặc testcase ĐÃ CÓ kiểm đúng hành vi. Mỗi issue = 1 dòng.
const A6 = '(USR|GRP|PRV|COM|UTY|ORG)';
const ALL = '(USR|GRP|PRV|COM|UTY|ORG|PIL|IGR|IND|SET)';
export default R => [
  // ===================== Đơn vị hành chính cấp tỉnh =====================
  R('PRV', 'A.IV.1-UC2', null, 'GitLab #10 — Sub title form Thêm tỉnh/thành đúng design', [['Sub title popup Thêm mới đúng design', 'PRV-C08']]),
  R('PRV', 'A.IV.1-UC2', null, 'GitLab #12 — Nhãn "Tên tỉnh/thành" ở form Thêm tỉnh/thành', [['Nhãn trường tên đúng', 'PRV-C09']]),
  R('PRV', 'A.IV.1-UC4', null, 'GitLab #46 — Ẩn Xoá khi tỉnh/thành đã có đơn vị tham chiếu', [['Menu không có Xoá', 'PRV-D04'], ['Gọi xóa vẫn bị chặn', 'PRV-D02']]),
  R('PRV', 'A.IV.1-UC4', null, 'GitLab #57 — Bỏ thao tác xóa với tỉnh có cấu hình đơn vị', [['Menu không có Xoá', 'PRV-D04'], ['Gọi xóa vẫn bị chặn', 'PRV-D02']]),
  R('PRV', 'A.IV.1-UC5', null, 'GitLab #70 — Ô "Cập nhật lần cuối" có tên người cập nhật', [['Có thời gian và tên người cập nhật', 'PRV-V06']]),
  R('PRV', 'A.IV.1-UC5', null, 'GitLab #71 — Chi tiết tỉnh/xã: bỏ link "Mở module Đơn vị" ở cấp xã, breadcrumb hiển thị tên', [
    ['Breadcrumb chi tiết tỉnh hiển thị tên tỉnh', 'PRV-V05'], ['Breadcrumb chi tiết xã hiển thị tên xã', 'COM-V04'],
    ['Chi tiết xã không có link Mở module Đơn vị', 'COM-V03'], ['Chi tiết tỉnh vẫn có Mở module Đơn vị', 'PRV-V01'],
  ]),
  R('PRV', 'A.IV.1-UC1', null, 'GitLab #111 — Bản ghi mới tạo nằm đầu danh sách tỉnh/thành', [['Bản ghi mới ở dòng đầu', 'PRV-L13']]),
  R('PRV', 'A.IV.1-UC5', null, 'GitLab #167 — Chi tiết tỉnh có nút "Chỉnh sửa" và "Mở module Đơn vị"', [['Có nút Chỉnh sửa, Mở module Đơn vị', 'PRV-V01'], ['Chỉnh sửa mở form cập nhật', 'PRV-V03']]),
  R('PRV', 'A.IV.1-UC1', null, 'GitLab #234 — Các màn DVT-01 đến DVT-05 theo design mới', [['Các màn khớp design', 'PRV-L14']]),
  R('PRV', 'A.IV.1-UC2', null, 'GitLab #263 — Popup Thêm tỉnh/thành không hiển thị bộ đếm "0 / 255"', [['Không có bộ đếm ký tự ở ô Tên', 'PRV-C07']]),
  R('PRV', 'A.IV.1-UC3', null, 'GitLab #264 — Popup Cập nhật tỉnh/thành: căn giữa, bộ đếm ký tự, nút Lưu bị disable', [
    ['Căn giữa, không bộ đếm', 'PRV-E06'], ['Nút Lưu bấm được và lưu thành công', 'PRV-E07'],
  ]),
  R('PRV', 'A.IV.1-UC5', null, 'GitLab #265 — Đường kẻ dưới "Đơn vị thuộc tỉnh/thành" full chiều rộng', [['Đường kẻ liền, full chiều rộng', 'PRV-V07']]),

  // ===================== Đơn vị hành chính cấp xã =====================
  R('COM', 'A.IV.2-UC5', null, 'GitLab #72 — Trường "Loại" của xã mặc định "Xã"', [['Loại mặc định Xã', 'COM-V05']]),
  R('COM', 'A.IV.2-UC1', null, 'GitLab #235 — Các màn DVX-01 đến DVX-05 theo design mới', [['Các màn khớp design', 'COM-L14']]),
  R('COM', 'A.IV.2-UC2', null, 'GitLab #266 — Lỗi UI form Thêm/Chỉnh sửa xã và trang chi tiết xã', [['Popup Thêm/Chỉnh sửa đúng design', 'COM-C07'], ['Trang chi tiết đúng design', 'COM-V06']]),

  // ===================== Popup Đổi tỉnh tham chiếu =====================
  R('ORG', 'A.IV.4-UC8', null, 'GitLab #75 — Popup Đổi tỉnh tham chiếu: UI 2 nút Huỷ và Lưu', [['Nút Huỷ/Lưu đúng design', 'ORG-R03'], ['Đổi tỉnh vẫn hoạt động', 'ORG-R01']]),

  // ===================== Loại đơn vị =====================
  R('UTY', 'A.IV.3-UC3', null, 'GitLab #44 — Làm lại UI màn chi tiết Loại đơn vị theo Figma', [['Chi tiết khớp design', 'UTY-V04']]),
  R('UTY', 'A.IV.3-UC5', null, 'GitLab #49 — Form Chỉnh sửa (Loại đơn vị) không hiển thị popup', [['Chỉnh sửa từ danh sách mở popup có dữ liệu', 'UTY-E05']]),
  R('UTY', 'A.IV.3-UC5', null, 'GitLab #65 — Nút Cập nhật ở màn thông tin hiển thị popup giống form Thêm mới', [['Cập nhật ở chi tiết mở popup như Thêm mới', 'UTY-E06']]),
  R('UTY', 'A.IV.3-UC3', null, 'GitLab #101 — Loại Trung ương: popup Thêm đơn vị chỉ hiển thị đơn vị không tham chiếu tỉnh', [['Lọc đúng đơn vị không tham chiếu tỉnh', 'UTY-M01']]),
  R('UTY', 'A.IV.3-UC1', null, 'GitLab #237 — Các màn LDV-01 đến LDV-05c theo design mới', [['Các màn khớp design', 'UTY-L14']]),
  R('UTY', 'A.IV.3-UC4', null, 'GitLab #267 — Danh sách và popup Thêm/Cập nhật loại đơn vị chưa đúng thiết kế', [['Danh sách đúng design', 'UTY-L14'], ['Popup Thêm/Cập nhật đúng design', 'UTY-C08']]),

  // ===================== Đơn vị =====================
  R('ORG', 'A.IV.4-UC7', null, 'GitLab #29 — Khoá đơn vị thành công nhưng trạng thái trên giao diện không đổi', [['Khoá → trạng thái Đã khóa', 'ORG-K01'], ['Mở khoá → Chưa khóa', 'ORG-K02']]),
  R('ORG', 'A.IV.4-UC7', null, 'GitLab #50 — Chức năng Khóa/Mở khóa đơn vị không thực hiện được', [['Khoá', 'ORG-K01'], ['Mở khoá', 'ORG-K02']]),
  R('ORG', 'A.IV.4-UC11', null, 'GitLab #45 — Popup Thêm người dùng vào đơn vị còn hiển thị người dùng đã thuộc đơn vị', [['Không liệt kê người đã thuộc đơn vị', 'ORG-M04']]),
  R('ORG', 'A.IV.4-UC4', null, 'GitLab #47 — Popup Thêm đơn vị chưa giống design Figma', [['Popup đúng design', 'ORG-C10']]),
  R('ORG', 'A.IV.4-UC1', null, 'GitLab #76 — Đơn vị mới tạo không nằm đầu danh sách', [['Bản ghi mới ở dòng đầu', 'ORG-L15']]),
  R('ORG', 'A.IV.4-UC4', null, 'GitLab #77 — Thêm mới đơn vị thiếu trường chọn Xã/Phường khi chọn tỉnh có xã', [['Hiện trường Xã/Phường lọc theo tỉnh', 'ORG-C11'], ['Chỉ loại cấp xã được tham chiếu xã', 'ORG-C09']]),
  R('ORG', 'A.IV.4-UC9', null, 'GitLab #87 — UI bộ lọc bảng Người dùng trong đơn vị giống design', [['Bộ lọc đúng design', 'ORG-V05'], ['Lọc theo vai trò hoạt động', 'ORG-V02']]),
  R('ORG', 'A.IV.4-UC4', null, 'GitLab #102 — Validate SĐT/Mã/Tên; Đơn vị cha và SĐT không lưu', [
    ['SĐT sai định dạng bị chặn', 'ORG-C12'], ['SĐT hợp lệ được lưu, hiển thị lại', 'ORG-C13'], ['Đơn vị cha được lưu đúng', 'ORG-C05'],
    ['Mã: độ dài, ký tự cho phép, trùng', 'ORG-G0[789]'], ['Tên: độ dài, trùng', 'ORG-G1[01]'],
  ]),
  R('ORG', 'A.IV.4-UC1', null, 'GitLab #133 — API phân quyền đơn vị không kiểm tra quyền theo ma trận Cán bộ', [['API ngoài quyền trả 403', 'ORG-S03'], ['POST/PUT/DELETE không có quyền bị 403', 'ATA-Q02']]),
  R('ORG', 'A.IV.4-UC9', null, 'GitLab #218 — Bảng "Người dùng trong đơn vị" thiếu tiêu đề cột "Thao tác"', [['Cột cuối có tiêu đề Thao tác', 'ORG-V06']]),
  R('ORG', 'A.IV.4-UC1', null, 'GitLab #238 — Các màn DV-01 đến DV-07 theo design mới', [['Các màn khớp design', 'ORG-L14']]),
  R('ORG', 'A.IV.4-UC4', null, 'GitLab #268 — Danh sách và popup Thêm/Cập nhật đơn vị chưa đúng thiết kế', [['Danh sách đúng design', 'ORG-L14'], ['Popup Thêm/Cập nhật đúng design', 'ORG-C10']]),
  R('ORG', 'A.IV.4-UC5', null, 'GitLab #274 — Cập nhật đơn vị: "Loại đơn vị" hiển thị UUID thay vì tên', [['Hiển thị tên loại đơn vị', 'ORG-E05']]),

  // ===================== Tham số hệ thống =====================
  R('ATA', 'ATTT KT 1.3.4', null, 'GitLab #22 — Tab Minh chứng thiếu phần chọn định dạng tệp cho phép', [['Có phần chọn định dạng, lưu được', 'ATA-C12'], ['Định dạng bị bỏ chọn không tải lên được', 'ATA-C13']]),
  R('ATA', 'ATTT KT 1.3.1c-2', null, 'GitLab #26 — Quy tắc mật khẩu đã cấu hình chưa áp dụng khi đặt lại/đổi mật khẩu', [['Đổi tham số chính sách mật khẩu áp dụng ở mọi nơi đặt mật khẩu', 'ATA-C10'], ['Gợi ý quy tắc theo tham số hiện hành', 'ATU-P10']]),
  R('ATA', 'ATTT KT 1.3.1c-2', null, 'GitLab #64 — Cấu hình "Không dùng lại N mật khẩu cũ" không có hiệu lực', [['Tham số N có hiệu lực khi đổi mật khẩu', 'ATA-C14'], ['Không dùng lại mật khẩu gần đây', 'CPW-M07']]),
  R('ATA', 'ATTT KT 1.3.1c-2', null, 'GitLab #236 — Các màn TS-01 đến TS-04 theo design mới', [['Các màn khớp design', 'ATA-C15']]),

  // ===================== Nhật ký truy cập =====================
  R('ATA', 'ATTT NK-02', null, 'GitLab #157 — Nhật ký truy cập thừa text phụ và cột Thiết bị (Review CĐS 30/10)', [['Không text phụ, không cột Thiết bị', 'ATA-N25']]),
  R('ATA', 'ATTT NK-02', null, 'GitLab #239 — Các màn NK-01 đến NK-05 theo design mới', [['Các màn khớp design', 'ATA-N26']]),

  // ===================== Phân hệ A / API =====================
  R('ATA', 'ATTT KT 1.3.1a', null, 'GitLab #204 — Không có quyền .VIEW vẫn gọi được GET provinces/communes/organizations; Cán bộ xem được idm/roles', [
    ['Không có quyền Xem: URL/API Phân hệ A trả 403', 'ATA-Q03'], ['GET idm/roles theo ma trận quyền Cán bộ', 'GRP-S02'],
  ]),
  R('ATA', 'ATTT KT 1.3.4', null, 'GitLab #205 — Tham số filter JSON hỏng gây 500 ở 6 endpoint', [['filter JSON hỏng không gây 5xx', 'ATA-V02']]),
  R('ATA', 'ATTT KT 1.3.3a-1', null, 'GitLab #206 — Nhật ký Thêm/Sửa/Xóa thiếu đối tượng và giá trị trước → sau', [['Ghi đối tượng, trước → sau', 'ATA-N02']]),
  R('ATA', 'ATTT KT 1.3.3a-1', null, 'GitLab #207 — Thao tác bị từ chối 403 không được ghi nhật ký Thất bại', [['Ghi nhật ký Kết quả = Thất bại', 'ATA-N05']]),
  R('ATA', 'ATTT KT 1.3.4', null, 'GitLab #208 — Backend không validate mã: code = null, mã 300 ký tự đặc biệt vẫn lưu (phần A; phần B tham chiếu ATB)', [
    ['Trường bắt buộc = null, sai kiểu bị 400', 'ATA-V01|ATB-V01'], ['Mã > 50 ký tự bị từ chối', '(GRP|PRV|COM|UTY|ORG)-G07'],
    ['Mã có ký tự đặc biệt bị từ chối', '(GRP|PRV|COM|UTY|ORG)-G08'],
  ]),
  R('ATA', 'ATTT KT 1.3.3a-3', null, 'GitLab #209 — Lỗi hệ thống (HTTP 500) không được ghi nhật ký "Lỗi hệ thống"', [['500 được ghi nhật ký Lỗi hệ thống', 'ATA-N24'], ['Chi tiết bản ghi Lỗi có mã lỗi, trace id', 'ATA-N13']]),
  R('ATG', 'ATTT KT 1.3.1a', null, 'GitLab #198 — Vai trò không có quyền chấm điểm vẫn tải được minh chứng KQTĐG', [['Không có quyền → 403 khi tải tệp minh chứng', 'ATG-S04']]),
  R('RES', 'C.TB', null, 'GitLab #199 — Filter thông báo không phải JSON trả 500 thay vì 400', [['filter hỏng trả 400', 'RES-Z30']]),
  R('RES', 'C.UC1.4a', null, 'GitLab #200 — Hai yêu cầu phê duyệt đồng thời (kỳ vọng cần BA xác nhận)', [['Thao tác đồng thời chỉ một có hiệu lực (kết quả tự đánh giá)', 'RES-Y16'], ['Thao tác đồng thời chỉ một có hiệu lực (kỳ tự đánh giá)', 'CMP-A28']]),

  // ===================== Toàn hệ thống / UI chung / Chung =====================
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #9 — Thống nhất title button, title form và nút Lưu cho Thêm mới/Chỉnh sửa', [['Quy ước thống nhất mọi trang', 'PRV-C11']]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #11 — Text "(không bắt buộc)" ở label dùng font thường', [['Font thường', 'PRV-C12']]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #24 — Căn lề trong bảng: text trái, số phải', [['Căn lề đúng quy ước', 'PRV-L15']]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #28 — F5 làm mất trạng thái màn hình (phân trang, form chỉnh sửa, form đặt lại mật khẩu)', [
    ['F5 giữ trang/bộ lọc ở Phân hệ A', 'ORG-L16'], ['F5 khi đang mở form chỉnh sửa', 'PRV-E08'],
    ['F5 giữ trạng thái ở Phân hệ C (đã có)', 'RES-L84|RES-B73|RES-S101'],
  ]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #32 — Bổ sung cột STT cho tất cả các table', [['Danh sách có cột STT', `${ALL}-L01`]]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #35 — Popup xác nhận: nội dung theo thao tác, nút Có màu đỏ theo logo', [['Xác nhận Xoá', 'PRV-D05'], ['Xác nhận Khoá/Mở khoá', 'ORG-K03']]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #113 — Quay lại từ chi tiết giữ filter/search', [['Phân hệ A', 'ORG-L17'], ['Phân hệ C/E (đã có)', 'RES-V16|RES-D42|ANS-V06']]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #116 — Form Thêm mới còn lưu dữ liệu cũ', [['Mở lại Thêm mới thì form trống', 'PRV-C13']]),
  R('CHUNG', 'UI chung', null, 'GitLab #97 — Bỏ search ở select phân trang; menu thu gọn, breadcrumb không click được; bổ sung search cho select', [
    ['Select số bản ghi/trang không có tìm kiếm', 'PRV-L19'], ['Thu gọn menu hoạt động', 'PRV-L20'], ['Breadcrumb bấm được', 'PRV-L21'], ['Select có tìm kiếm', 'ORG-C14'],
  ]),
  R('CHUNG', 'UI', null, 'GitLab #269 — Font-weight cột table: Mã 500, còn lại 400, Thao tác 600', [['Font-weight đúng quy ước', 'PRV-L17']]),
  R('CHUNG', 'Chung', null, 'GitLab #179 — Mất mạng khi thao tác không hiển thị thông báo lỗi (Quản lý tự đánh giá, Kết quả tự đánh giá)', [
    ['Kết quả tự đánh giá: danh sách và gửi khi mất mạng', 'RES-G08|RES-F38'], ['Quản lý tự đánh giá: lưu/xóa/phân công khi mất mạng', 'CMP-G0[345]'],
  ]),
  R('CHUNG', 'Review CĐS 30/10', null, 'GitLab #152 — Bảng dữ liệu cần chỉnh định dạng', [['Căn lề', 'PRV-L15'], ['Full chiều rộng, cỡ chữ tiêu đề', 'PRV-L16'], ['Font-weight', 'PRV-L17']]),
  R('CHUNG', 'Review CĐS 30/10', null, 'GitLab #153 — Dòng mô tả dưới tiêu đề trang quá nhỏ', [['Cỡ chữ dòng mô tả đúng design', 'PRV-L18']]),
  R('CHUNG', 'Review CĐS 30/10', null, 'GitLab #154 — Popup chưa đồng bộ button, layout, kích thước', [['Popup đồng bộ', 'PRV-C14']]),
  R('CHUNG', 'Review CĐS 30/10', null, 'GitLab #155 — Quay lại từ chi tiết không highlight bản ghi vừa xem', [['Highlight bản ghi vừa xem', 'ORG-L18']]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #43 — Màu nút "Xuất Excel" (Quản lý tự đánh giá) không đồng nhất với các nút khác', [['Nút Xuất Excel đồng nhất', 'PRV-L22']]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #132 — Mở tab mới khi tab đầu đã đăng nhập bị yêu cầu đăng nhập lại', [['Tab mới dùng chung phiên', 'ATU-T05'], ['Đăng xuất đồng bộ giữa các tab', 'LGO-S03']]),
  R('CHUNG', 'Toàn hệ thống', null, 'GitLab #173 — Bảng chưa full chiều rộng; tiêu đề cột 12px cần 14px', [['Full chiều rộng, tiêu đề 14px', 'PRV-L16']]),
  R('USR', 'A.II.1-UC4', null, 'GitLab #119 — Người dùng: 4 testcase FAIL (validate API, bắt buộc đổi mật khẩu)', [
    ['API từ chối mật khẩu không đạt quy tắc', 'USR-C16|ATU-P08'], ['Cờ bắt buộc đổi mật khẩu được lưu', 'ATU-P04'], ['Đăng nhập lần đầu bị bắt đổi mật khẩu', 'LGN-M09|USR-C18'],
  ]),

  // ===================== Quy tắc chung Mã / Tên / Tìm kiếm =====================
  R('CHUNG', 'Mã', null, 'GitLab #112 — Mã cho nhập khoảng trắng và có dấu', [['Mã chỉ gồm A–Z, 0–9, - _ .', '(GRP|PRV|COM|UTY|ORG)-G08']]),
  R('CHUNG', 'Mã/Tên', null, 'GitLab #134 — Giới hạn độ dài Mã ≤ 50, Tên ≤ 255, Tên chỉ số/nhóm chỉ số ≤ 500', [
    ['Mã > 50 bị từ chối', `${A6}-G07`], ['Tên 255/256', '(GRP|PRV|COM|UTY|ORG|PIL|SET)-G10|USR-C14'], ['Tên chỉ số/nhóm chỉ số 500/501', '(IGR|IND)-G10'],
  ]),
  R('CHUNG', 'Mã/Tên', null, 'GitLab #135 — Mã chấp nhận khoảng trắng, dấu tiếng Việt, ký tự đặc biệt', [['Mã chỉ gồm A–Z, 0–9, - _ .', '(GRP|PRV|COM|UTY|ORG)-G08']]),
  R('CHUNG', 'Mã/Tên', null, 'GitLab #136 — Trùng mã không phân biệt hoa/thường; thông báo trùng đúng mẫu', [['Trùng mã khác hoa/thường bị chặn, đúng thông báo', '(GRP|PRV|COM|UTY|ORG)-G09|GRP-C07|PIL-C04']]),
  R('CHUNG', 'Mã/Tên', null, 'GitLab #137 — Tên trùng trong cùng nhóm cha (không phân biệt hoa/thường) không bị chặn', [['Tên trùng cùng nhóm cha bị chặn', '(GRP|PRV|COM|UTY|ORG|PIL|IGR|IND|SET)-G11']]),
  R('CHUNG', 'Tìm kiếm', null, 'GitLab #138 — Tìm không phân biệt dấu tiếng Việt không hoạt động', [['Tìm không dấu ra kết quả có dấu', `${ALL}-L31`]]),
  R('CHUNG', 'Tìm kiếm', null, 'GitLab #139 — Không bỏ khoảng trắng đầu/cuối từ khóa (Nhóm người dùng); thông báo rỗng sai', [['Bỏ khoảng trắng đầu/cuối', 'GRP-L32'], ['Không có dữ liệu → "Không tìm thấy dữ liệu phù hợp"', 'GRP-L05']]),
  R('CHUNG', 'Mã', null, 'GitLab #140 — Tỉnh/thành và Xã/phường chỉ cho nhập mã 10 ký tự (quy tắc 50)', [['Form nhận mã 50 ký tự', 'PRV-C10|COM-C06'], ['Mã > 50 bị từ chối', '(PRV|COM)-G07|PRV-C04']]),
  R('CHUNG', 'Mã', null, 'GitLab #141 — Nhóm người dùng và Người dùng nhận mã/tên đăng nhập > 50 ký tự', [['Server chặn > 50 ký tự', '(USR|GRP)-G07']]),
  R('CHUNG', 'Tên', null, 'GitLab #142 — Giới hạn độ dài Tên sai ở nhiều trang (cần 255/500)', [
    ['Tên 255/256', '(GRP|PRV|COM|UTY|ORG|PIL|SET)-G10|USR-C14'], ['Tên chỉ số/nhóm chỉ số 500/501', '(IGR|IND)-G10'],
  ]),
  R('CHUNG', 'Mã', null, 'GitLab #143 — Mã nhận khoảng trắng, dấu, ký tự đặc biệt; chỉ được A–Z, 0–9, - _ .', [['Mã sai ký tự bị từ chối', '(GRP|PRV|COM|UTY|ORG)-G08']]),
  R('CHUNG', 'Mã', null, 'GitLab #144 — Mã chỉ khác hoa/thường vẫn tạo được; thông báo "Mã [ABC] đã tồn tại. Vui lòng nhập mã khác."', [['Trùng mã khác hoa/thường bị chặn, đúng thông báo', '(GRP|PRV|COM|UTY|ORG)-G09|GRP-C07|PIL-C04']]),
  R('CHUNG', 'Tên', null, 'GitLab #145 — Tên trùng trong cùng nhóm cha vẫn tạo/sửa được ở 9 trang danh mục', [
    ['Thêm: tên trùng cùng nhóm cha bị chặn', '(GRP|PRV|COM|UTY|ORG|PIL|IGR|IND|SET)-G11'], ['Sửa: tên trùng bị chặn', 'PRV-E05'],
  ]),
  R('CHUNG', 'Tìm kiếm', null, 'GitLab #146 — Gõ không dấu không ra kết quả ở 10 trang danh sách', [['Tìm không phân biệt dấu', `${ALL}-L31`]]),
  R('CHUNG', 'Tìm kiếm', null, 'GitLab #147 — Từ khóa có khoảng trắng đầu/cuối cho 0 kết quả; không có dữ liệu hiện "Trống"', [
    ['Bỏ khoảng trắng đầu/cuối', '(USR|GRP|PRV|ORG|PIL|IGR|IND|SET)-L32'], ['Thông báo "Không tìm thấy dữ liệu phù hợp"', `${ALL}-L05`],
  ]),
];
