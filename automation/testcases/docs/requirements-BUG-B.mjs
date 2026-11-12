// Truy vết bug/góp ý GitLab của PHÂN HỆ B → testcase (case mới ở catalog-BUG-B.mjs hoặc case đã có trong catalog).
export default R => [
  // ---------- Trụ cột ----------
  R('PIL', 'B.I.1-UC1', null, 'GitLab #78 — Bổ sung màn xem chi tiết Trụ cột theo design', [['Màn chi tiết đủ thông tin, đúng design', 'PIL-V06'], ['Số liệu tổng hợp đúng', 'PIL-V02']]),
  R('PIL', 'B.I.1-UC1', null, 'GitLab #201 — Cập nhật giao diện các màn Trụ cột theo UI mới', [['Các màn khớp design', 'PIL-L34']]),
  R('PIL', 'B.I.1-UC1', null, 'GitLab #240 — Fix UI các màn TC-01 đến TC-05', [['Các màn khớp design TC-01…TC-05', 'PIL-L34']]),
  R('PIL', 'B.I.1-UC1', null, 'GitLab #249 — Màu sắc, font weight cột Tên trụ cột', [['Cột Tên trụ cột đúng design', 'PIL-L35']]),
  R('PIL', 'B.I.1-UC1', null, 'GitLab #250 — Màn danh sách trụ cột chưa khớp design', [['Danh sách khớp design', 'PIL-L34'], ['Text nút, header, tên cột', 'PIL-L36'], ['Màu label trạng thái', 'PIL-L37']]),
  R('PIL', 'B.I.1-UC1', null, 'GitLab #251 — Màn chi tiết trụ cột chưa khớp design', [['Màn chi tiết đúng design', 'PIL-V06']]),
  R('PIL', 'B.I.1-UC1', null, 'GitLab #271 — Danh sách trụ cột: text button, header table, tên cột, màu label trạng thái', [['Text nút, header, tên cột', 'PIL-L36'], ['Màu label trạng thái', 'PIL-L37']]),

  // ---------- Nhóm chỉ số ----------
  R('IGR', 'B.I.2-UC1', null, 'GitLab #79 — Bổ sung màn xem chi tiết Nhóm chỉ số theo design', [['Màn chi tiết đủ thông tin, đúng design', 'IGR-V04']]),
  R('IGR', 'B.I.2-UC1', null, 'GitLab #114 — Chi tiết nhóm chỉ số: update UI hiển thị chi tiết', [['Màn chi tiết đúng design', 'IGR-V04']]),
  R('IGR', 'B.I.2-UC1', null, 'GitLab #202 — Cập nhật giao diện các màn Nhóm chỉ số theo UI mới', [['Các màn khớp design', 'IGR-L34']]),
  R('IGR', 'B.I.2-UC1', null, 'GitLab #241 — Fix UI các màn NCS-01 đến NCS-04', [['Các màn khớp design NCS-01…NCS-04', 'IGR-L34']]),
  R('IGR', 'B.I.2-UC1', null, 'GitLab #257 — Danh sách nhóm chỉ số: placeholder, text button, font weight, filter Trạng thái, footer table', [
    ['Placeholder và text nút', 'IGR-L35'], ['Bộ lọc Trạng thái', 'IGR-L36'], ['Font weight cột và footer bảng', 'IGR-L37'],
  ]),
  R('IGR', 'B.I.2-UC1', null, 'GitLab #258 — Chi tiết nhóm: tên chỉ số cha vẫn click được, chiều cao header/footer bảng', [['Tên chỉ số cha không là link', 'IGR-V05'], ['Chiều cao header/footer', 'IGR-V06']]),
  R('IGR', 'B.I.2-UC2', null, 'GitLab #259 — Popup thêm nhóm chỉ số: title, field, placeholder, bộ đếm ký tự, text trường bắt buộc', [['Title, field, placeholder', 'IGR-C09'], ['Bộ đếm ký tự, text trường bắt buộc', 'IGR-C10']]),
  R('IGR', 'B.I.2-UC5', null, 'GitLab #260 — Popup cập nhật nhóm chỉ số: title, sub title, field thừa, text footer', [['Title, sub title, text footer', 'IGR-E06'], ['Không có field thừa', 'IGR-E07']]),
  R('IGR', 'B.I.2-UC1', null, 'GitLab #272 — Danh sách, popup và cây chỉ số ở màn chi tiết chưa khớp design', [['Danh sách và các màn', 'IGR-L34'], ['Popup thêm', 'IGR-C09'], ['Cây chỉ số ở chi tiết', 'IGR-V08']]),
  R('IGR', 'B.I.2-UC1', null, 'GitLab #281 — Chỉ số con trong bảng chi tiết nhóm vẫn là link', [['Chỉ số con không là link', 'IGR-V07']]),

  // ---------- Chỉ số ----------
  R('IND', 'B.I.3-UC1', null, 'GitLab #52 — Bổ sung filter Nhóm chỉ số và Trạng thái', [['Lọc theo trụ cột / nhóm chỉ số', 'IND-L12'], ['Lọc theo trạng thái', 'IND-L13'], ['Kết hợp bộ lọc', 'IND-L14']]),
  R('IND', 'B.I.3-UC1', null, 'GitLab #80 — Bổ sung màn xem chi tiết Chỉ số theo design', [['Màn chi tiết đủ thông tin, đúng design', 'IND-V04']]),
  R('IND', 'B.I.3-UC5', null, 'GitLab #82 — Popup Cập nhật Chỉ số theo design mới', [['Popup khớp design', 'IND-E12']]),
  R('IND', 'B.I.5-UC1', null, 'GitLab #90 — Nhân bản chỉ số thành công nhưng danh sách không tự cập nhật', [['Danh sách tự cập nhật sau nhân bản', 'IND-N07']]),
  R('IND', 'B.I.3-UC5', null, 'GitLab #91 — Popup Cập nhật Chỉ số thiếu field Mã chỉ số (disable)', [['Có Mã chỉ số, bị vô hiệu', 'IND-E13']]),
  R('IND', 'B.I.3-UC1', null, 'GitLab #158 — Review CĐS 30/10: Chỉ số dạng cây thiếu đường nối giữa các cấp', [['Có đường nối giữa các cấp', 'IND-L35']]),
  R('IND', 'B.I.3-UC1', null, 'GitLab #220 — Chi tiết chỉ số đã khóa: bỏ khối thông báo trạng thái Đã khóa', [['Không có khối thông báo', 'IND-V05']]),
  R('IND', 'B.I.3-UC1', null, 'GitLab #221 — Chi tiết chỉ số: tiêu đề dài bị cắt', [['Tên dài hiển thị đầy đủ', 'IND-V06']]),
  R('IND', 'B.I.3-UC1', null, 'GitLab #252 — Fix UI các màn CS-01 đến CS-07b', [['Các màn khớp design CS-01…CS-07b', 'IND-L34']]),
  R('IND', 'B.I.3-UC2', null, 'GitLab #275 — Thêm chỉ số con: điểm tối đa của chỉ số cha không cộng dồn', [['Cộng dồn ở dạng danh sách', 'IND-C15'], ['Cộng dồn ở popup Chỉnh sửa', 'IND-C16']]),

  // ---------- Bộ chỉ số ----------
  R('SET', 'B.II.1-UC3', null, 'GitLab #81 — Làm lại UI xem chi tiết Bộ chỉ số theo design mới', [['Chi tiết đủ thông tin', 'SET-V01'], ['Bố cục khớp design', 'SET-V15']]),
  R('SET', 'B.II.1-UC9', null, 'GitLab #92 — Popup Cập nhật Bộ chỉ số không hiển thị Mã bộ chỉ số', [['Có Mã bộ chỉ số chỉ đọc', 'SET-E07']]),
  R('SET', 'B.II.1-UC3', null, 'GitLab #159 — Review CĐS 30/10: Chi tiết bộ chỉ số — chỉnh card, cấu trúc và footer', [['Card, cấu trúc, footer đúng design', 'SET-V15']]),
  R('SET', 'B.II.1-UC1', null, 'GitLab #169 — Trạng thái danh sách "Đã khóa" nhưng chi tiết "Đang áp dụng"', [['Trạng thái nhất quán danh sách và chi tiết', 'SET-L13']]),
  R('SET', 'B.II.1-UC6', null, 'GitLab #170 — Năm áp dụng: API không chặn năm quá khứ', [['Năm quá khứ bị chặn ở UI và API', 'SET-C04'], ['Khi sửa', 'SET-E06']]),
  R('SET', 'B.II.1-UC4', null, 'GitLab #219 — Tìm kiếm trong Cấu trúc bộ chỉ số không ra kết quả, báo sai "chưa có cấu trúc"', [['Tìm ra đúng kết quả', 'SET-V16'], ['Không có kết quả báo không tìm thấy', 'SET-V17']]),
  R('SET', 'B.II.1-UC1', null, 'GitLab #253 — Fix UI các màn BCS-01 đến BCS-08', [['Các màn khớp design BCS-01…BCS-08', 'SET-L34']]),
  R('SET', 'B.II.1-UC4', null, 'GitLab #277 — Cấu trúc bộ chỉ số: kéo chỉnh kích thước cột và scroll dọc', [['Kéo chỉnh độ rộng cột', 'SET-V18'], ['Scroll dọc', 'SET-V19']]),
  R('SET', 'B.II.1-UC6', null, 'GitLab #278 — Popup Thêm bộ chỉ số: bỏ bộ đếm ký tự và text "* Trường bắt buộc"', [['Không có bộ đếm ký tự', 'SET-C12'], ['Không có "* Trường bắt buộc"', 'SET-C13']]),

  // ---------- Cấu hình bộ chỉ số ----------
  R('SET', 'B.II.3-UC1', null, 'GitLab #117 — Cấu hình bộ chỉ số: scroll, điểm xám, bỏ nút Xóa khỏi bộ chỉ số, thêm nút Xem chi tiết', [
    ['Có scroll', 'SET-I10'], ['Điểm chỉ đọc hiển thị xám', 'SET-I11'], ['Bỏ nút Xóa khỏi bộ chỉ số', 'SET-I12'], ['Nút Xem chi tiết', 'SET-I13'],
  ]),
  R('SET', 'B.II.2-UC1', null, 'GitLab #160 — Review CĐS 30/10: Cấu hình bộ chỉ số hiển thị khác phần kết quả tự đánh giá', [['Trình bày đồng bộ với KQTĐG', 'SET-S11']]),
  R('SET', 'B.II.1-UC9', null, 'GitLab #171 — API PUT cho phép sửa thông tin bộ chỉ số đã khóa', [['Bộ đã khóa không sửa được (UI + API)', 'SET-E05'], ['Không sửa cấu trúc/nội dung', 'SET-S09']]),
  R('SET', 'B.II.3-UC1', null, 'GitLab #172 — Cấu hình bộ chỉ số: tooltip, không hiển thị cấu hình điểm, UI xấu khi title dài', [
    ['Tooltip tên đầy đủ', 'SET-I14'], ['Hiển thị cấu hình điểm (tối thiểu/tối đa, tính điểm)', 'SET-I01'], ['Tên dài không vỡ bố cục', 'SET-I15'],
  ]),
  R('SET', 'B.II.3-UC2', null, 'GitLab #224 — Dropdown chọn chỉ số vẫn cho chọn chỉ số chưa khóa, Lưu thì báo lỗi', [['Chỉ liệt kê chỉ số đã khóa', 'SET-I16'], ['API chặn chỉ số chưa khóa', 'SET-I03']]),
  R('SET', 'B.II.3-UC2', null, 'GitLab #279 — Popup Thêm chỉ số: bảng chọn nhiều có tìm kiếm/lọc thay vì select', [['Bảng chọn nhiều', 'SET-I17'], ['Tìm kiếm/lọc trong popup', 'SET-I18']]),

  // ---------- Thang xếp loại ----------
  R('SCL', 'B.TXL-UC3', null, 'GitLab #127 — Bỏ "(không bắt buộc)" ở Mô tả; lỗi nút Quay lại', [['Label Mô tả không có "(không bắt buộc)"', 'SCL-C27'], ['Quay lại/Hủy xử lý đúng khi có/không có dữ liệu', 'SCL-C2[34]|SCL-E07']]),
  R('SCL', 'B.TXL-UC2', null, 'GitLab #182 — Chi tiết thang: nút "Cập nhật" phải là primary (BR-7)', [['Nút Cập nhật primary', 'SCL-V09']]),
  R('SCL', 'B.TXL-UC3', null, 'GitLab #183 — Tên mức không giới hạn 50 ký tự (UI và API)', [['UI giới hạn 50', 'SCL-C28'], ['API chặn 51', 'SCL-C29']]),
  R('SCL', 'B.TXL-UC3', null, 'GitLab #184 — Tự thêm dòng mức nhưng con trỏ không chuyển sang Tên mức dòng mới', [['Focus vào Tên mức dòng mới', 'SCL-C30']]),
  R('SCL', 'B.TXL-UC3', null, 'GitLab #185 — Hủy khi đã nhập không hiện hộp thoại "Thoát khi chưa lưu"', [['Hiện hộp thoại MSG-009', 'SCL-C23']]),
  R('SCL', 'B.TXL-UC3', null, 'GitLab #186 — API tạo thang nhận mức chồng lấn / không liên tục', [['API trả 400', 'SCL-C26']]),
  R('SCL', 'B.TXL-UC4', null, 'GitLab #187 — API sửa/xóa thang Đã khóa chưa gán trả 400, mâu thuẫn BR-2', [['UI cho Sửa/Mở khóa/Xóa', 'SCL-K04'], ['API sửa được', 'SCL-E09'], ['API xóa được', 'SCL-D06']]),
  R('SCL', 'B.TXL-UC4', null, 'GitLab #188 — Thang đã gán kỳ: vào thẳng URL /edit vẫn mở màn Sửa', [['URL /edit bị chặn, báo MSG-104', 'SCL-E08']]),

  // ---------- Quản lý tự đánh giá ----------
  R('CMP', 'B.III.4-UC3', null, 'GitLab #30 — Kỳ đã phê duyệt vẫn hiện Cập nhật và Phân công đơn vị', [['Không còn thao tác sửa/phân công', 'CMP-A14'], ['Ẩn Cập nhật, API chặn', 'CMP-E17']]),
  R('CMP', 'B.III.1-UC2', null, 'GitLab #33 — Kỳ tự đánh giá: đổi nút Quay lại thành Hủy', [['Nút Hủy', 'CMP-C43']]),
  R('CMP', 'B.III.1-UC1', null, 'GitLab #43 — Màu nút Xuất Excel không đồng nhất', [['Nút Xuất Excel cùng kiểu', 'CMP-L36']]),
  R('CMP', 'B.III.1-UC2', null, 'GitLab #86 — Ô tìm kiếm trong select Bộ chỉ số ở popup Thêm mới kỳ', [['Select có tìm kiếm', 'CMP-C44']]),
  R('CMP', 'B.III.1-UC2', null, 'GitLab #89 — Không thêm được kỳ, báo "Thang xếp loại không hợp lệ"', [['Thêm kỳ với thang hợp lệ thành công', 'CMP-C46'], ['Thang không tồn tại mới bị từ chối', 'CMP-C31']]),
  R('CMP', 'B.III.1-UC2', null, 'GitLab #93 — UI popup Thêm mới Kỳ tự đánh giá giống design', [['Popup khớp design', 'CMP-C45']]),
  R('CMP', 'B.III.2-UC4', null, 'GitLab #104 — Thêm đơn vị vào kỳ đánh giá lỗi 500', [['Thêm đơn vị thành công', 'CMP-U31']]),
  R('CMP', 'B.III.1-UC5', null, 'GitLab #105 — Thêm mới kỳ Định kỳ lỗi 400', [['Thêm kỳ Định kỳ thành công', 'CMP-C47']]),
  R('CMP', 'B.III.1-UC10', null, 'GitLab #106 — Cấu hình điểm kỳ: nhập điểm 5555555555 lưu nhóm lỗi 500', [['Điểm vượt biên bị từ chối 400', 'CMP-K07']]),
  R('CMP', 'B.III.1-UC1', null, 'GitLab #131 — Thiếu validate tạo/sửa kỳ, cấu hình, cảnh báo đến hạn, phân trang, lịch sử trình lại', [
    ['Validate tạo kỳ', 'CMP-C1[6-9]'], ['Validate sửa kỳ', 'CMP-E0[4-6]|CMP-E1[2-5]'], ['Validate cấu hình điểm', 'CMP-K0[6-9]'],
    ['Validate cảnh báo đến hạn', 'CMP-K3[6-9]'], ['Phân trang danh sách', 'CMP-L0[89]|CMP-L21'], ['Ghi lịch sử trình lại', 'CMP-T23'],
  ]),
  R('CMP', 'B.III.2-UC5', null, 'GitLab #148 — Phân công đơn vị: bổ sung thao tác xóa đơn vị khỏi đánh giá', [['Xóa đơn vị khỏi kỳ', 'CMP-U32']]),
  R('CMP', 'B.III.4-UC3', null, 'GitLab #149 — QC Lãnh đạo bị 403 khi duyệt', [['Lãnh đạo phê duyệt được', 'CMP-A0[12]'], ['Menu Phê duyệt/Từ chối', 'CMP-S11']]),
  R('CMP', 'B.III.1-UC1', null, 'GitLab #161 — Review CĐS 30/10: cột Loại trùng bộ chọn Định kỳ/Đột xuất', [['Không có cột Loại', 'CMP-L35']]),
  R('CMP', 'B.III.1-UC5', null, 'GitLab #178 — Sửa kỳ Định kỳ Nháp từ Quý sang Tháng nhưng Kỳ vẫn là Quý', [['Kỳ được tính lại theo Tháng', 'CMP-E10']]),
  R('CMP', 'B.III.1-UC3', null, 'GitLab #179 — Mất kết nối khi thao tác không hiển thị thông báo lỗi (phần Quản lý tự đánh giá)', [['Cập nhật / xóa / phân công khi mất mạng', 'CMP-G0[345]'], ['Tải danh sách lỗi', 'CMP-G09']]),
  R('CMP', 'B.III.1-UC10', null, 'GitLab #180 — API cấu hình điểm chấp nhận maxScore = null', [['Điểm null/sai kiểu bị từ chối 400', 'CMP-K09']]),
  R('CMP', 'B.III.3-UC1', null, 'GitLab #181 — Kỳ có bộ chỉ số rỗng vẫn Trình phê duyệt được', [['Chặn trình kỳ 0 chỉ số', 'CMP-T21']]),
  R('CMP', 'B.III.4-UC3', null, 'GitLab #200 — Hai yêu cầu phê duyệt đồng thời (cần xác nhận)', [['Phê duyệt đồng thời chỉ một thao tác thắng', 'CMP-A28']]),
  R('CMP', 'B.III.2-UC3', null, 'GitLab #203 — Phân công đơn vị: thiếu Xuất Excel danh sách đơn vị', [['Xuất Excel danh sách đơn vị', 'CMP-U33']]),
  R('CMP', 'B.III.3-UC1', null, 'GitLab #216 — Trình phê duyệt khi chưa phân công vẫn hiện hộp xác nhận rồi mới báo lỗi', [['Báo lỗi ngay, không hộp xác nhận', 'CMP-T22']]),
  R('CMP', 'B.III.1-UC1', null, 'GitLab #254 — Fix UI các màn QL-01 đến QL-06', [['Các màn khớp design QL-01…QL-06', 'CMP-L34']]),
  R('CMP', 'B.III.1-UC1', null, 'GitLab #273 — Có quyền Xem kỳ nhưng 403 do thiếu quyền Xem Bộ chỉ số', [['Xem được chi tiết kỳ', 'CMP-S17']]),
  R('CMP', 'B.III.1-UC3', null, 'GitLab #282 — Mất dữ liệu Đơn vị tham gia khi mở popup Cập nhật sau thêm mới', [['Giữ Đơn vị tham gia', 'CMP-E23']]),
  R('CMP', 'B.III.1-UC1', null, 'GitLab #283 — Nút Trình phê duyệt thiếu icon', [['Có icon', 'CMP-V19']]),
  R('CMP', 'B.III.1-UC1', null, 'GitLab #284 — Tab Đơn vị tham gia: cột Điểm dạng "điểm / điểm tối đa"', [['Hiển thị điểm / điểm tối đa', 'CMP-V20']]),
  R('CMP', 'B.III.2-UC4', null, 'GitLab #285 — Popup Thêm đơn vị vào kỳ chưa khớp design QL-05', [['Popup khớp QL-05', 'CMP-U34']]),

  // ---------- Quy tắc chung Mã/Tên/Tìm kiếm — phần Phân hệ B ----------
  R('ATTT', 'KT 1.3.4', null, 'GitLab #208 — Phân hệ A, B (phần B): backend không validate mã (null, 300 ký tự đặc biệt)', [
    ['Mã null bị từ chối', 'ATB-V06'], ['Mã vượt 50 ký tự bị từ chối', 'ATB-V07'], ['Mã chứa ký tự không hợp lệ bị từ chối', 'ATB-V08'],
  ]),
  R('PIL', 'B.I.1-UC2', null, 'GitLab #134 (phần B) — Giới hạn độ dài Mã ≤ 50', [['Mã > 50 bị từ chối', 'ATB-V07']]),
  R('PIL', 'B.I.1-UC2', null, 'GitLab #135/#143 (phần B) — Mã chỉ gồm A–Z, 0–9, - _ .', [['Mã ký tự không hợp lệ bị từ chối', 'ATB-V08']]),
  R('PIL', 'B.I.1-UC2', null, 'GitLab #136/#144 (phần B) — Mã trùng không phân biệt hoa/thường', [['Trụ cột', 'PIL-C04'], ['Nhóm chỉ số, Chỉ số', 'ATB-V09']]),
  R('PIL', 'B.I.1-UC2', null, 'GitLab #137/#145 (phần B) — Tên trùng trong cùng nhóm cha (không phân biệt hoa/thường)', [
    ['Trụ cột', 'PIL-C05|PIL-G11|PIL-E06'], ['Nhóm chỉ số', 'IGR-G11|IGR-G13'], ['Chỉ số', 'IND-G11|IND-G13'], ['Bộ chỉ số', 'SET-G11|SET-C03'],
  ]),
  R('PIL', 'B.I.1-UC2', null, 'GitLab #134/#142 (phần B) — Tên ≤ 255; Tên chỉ số/nhóm chỉ số ≤ 500', [['Trụ cột 255', 'PIL-G10'], ['Bộ chỉ số 255', 'SET-G10'], ['Nhóm chỉ số 500', 'IGR-G10'], ['Chỉ số 500', 'IND-G10']]),
  R('PIL', 'B.I.1-UC1', null, 'GitLab #138/#146 (phần B) — Tìm kiếm không phân biệt dấu tiếng Việt', [['Trụ cột, Nhóm chỉ số, Chỉ số, Bộ chỉ số', '(PIL|IGR|IND|SET)-L31'], ['Quản lý tự đánh giá', 'CMP-L14']]),
];
