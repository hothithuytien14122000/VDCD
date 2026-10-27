// BẢNG TRUY VẾT YÊU CẦU → ĐIỀU KIỆN KIỂM THỬ → TESTCASE (nguồn: UC_1409 + khảo sát UI/API thực tế).
// Mỗi dòng UC là 1 yêu cầu; mỗi yêu cầu được phân rã thành các ĐIỀU KIỆN kiểm thử cụ thể của dự án này
// (đầu vào, quy tắc nghiệp vụ, trạng thái, lỗi, quyền). Mỗi điều kiện trỏ tới ID testcase (regex, nối bằng '|').
// Điều kiện KHÔNG có testcase = lỗ hổng độ phủ (trace-check.mjs sẽ báo). Testcase không thuộc điều kiện nào = mồ côi.
const R = (page, uc, row, text, conds) => ({ page, uc, row, text, conds });
const P = k => k; // chỉ để dễ đọc
const T = [];

// ---------- chung cho mọi page danh sách ----------
const listConds = (k, extra = [], sec = `${k}-S01`, sec2 = `${k}-S02`) => [
  ['Hiển thị đủ cột, thứ tự cột, STT', `${k}-L01`],
  ['Phân trang mặc định và tổng số bản ghi', `${k}-L02`],
  ['Chuyển trang / đổi số bản ghi mỗi trang', `${k}-L08|${k}-L09`],
  ['Tìm theo các trường tìm được (mã/tên…)', `${k}-L03|${k}-L04`],
  ['Tìm không phân biệt hoa-thường', `${k}-L06`],
  ['Tìm không có kết quả → trạng thái rỗng', `${k}-L05`],
  ['Từ khóa ký tự đặc biệt / SQLi / XSS an toàn', `${k}-L07`],
  ['Xóa từ khóa trả về danh sách đầy đủ', `${k}-L10`],
  ['Tên có Unicode/HTML hiển thị nguyên văn, còn sau khi tải lại trang', `${k}-G02`],
  ['Chặn truy cập không token / token giả', sec],
  ['Quyền API đúng theo vai trò', sec2],
  ['Hiệu năng tải danh sách', `${k}-P01`],
  ...extra,
];
const exportCond = k => [['Xuất Excel tải được file', `${k}-L11`]];
const addCommon = k => [
  ['Bỏ trống trường bắt buộc → báo lỗi, không tạo', `${k}-C0[2-4]`],
  ['Chỉ nhập khoảng trắng bị chặn', `${k}-G01`],
  ['Hủy form không tạo bản ghi', `${k}-C0[3-9]|${k}-C1[0-3]`],
  ['Server lỗi 500 khi lưu: giữ form, không lộ lỗi nội bộ', `${k}-G04`],
  ['Mất mạng khi lưu: giữ form, không treo', `${k}-G05`],
];

// ================= A.II.1 NGƯỜI DÙNG =================
T.push(
  R('USR', 'A.II.1-UC1', 20, 'Xem danh sách người dùng; tìm kiếm theo các tiêu chí', listConds('USR', [
    ['Tìm theo email', 'USR-L12'], ['Lọc theo nhóm người dùng', 'USR-L13'], ['Lọc theo trạng thái Đang hoạt động/Đã khóa', 'USR-L14'],
    ['Kết hợp từ khóa + bộ lọc', 'USR-L15'], ['Chưa đăng nhập vào trang bị chuyển về đăng nhập', 'USR-S02'],
  ], 'USR-S01', 'USR-S03')),
  R('USR', 'A.II.1-UC2', 21, 'Export danh sách người dùng ra Excel', exportCond('USR')),
  R('USR', 'A.II.1-UC3', 22, 'Xem thông tin người dùng', [
    ['Hiển thị đủ thông tin tài khoản/nhóm/đơn vị/hoạt động', 'USR-V01'], ['Đóng màn chi tiết', 'USR-V02'], ['Từ chi tiết mở form cập nhật', 'USR-V03'],
    ['Mở chi tiết với id không tồn tại', 'USR-V04'],
  ]),
  R('USR', 'A.II.1-UC4', 23, 'Thêm mới người dùng (kiểm tra và thêm)', [
    ['Thêm đầy đủ thông tin thành công', 'USR-C01'], ['Chỉ trường bắt buộc', 'USR-C02'], ['Chọn đơn vị + nhóm khi tạo', 'USR-C03'],
    ['Email sai định dạng (UI + API)', 'USR-C05|USR-C15'], ['SĐT sai định dạng', 'USR-C06'], ['Mật khẩu không đạt quy tắc (UI + API)', 'USR-C07|USR-C16'],
    ['Trùng tên đăng nhập / email', 'USR-C08|USR-C09'], ['Trùng tên đăng nhập khác hoa-thường', 'USR-C19'],
    ['Checkbox đổi mật khẩu / gửi email: mặc định và hành vi', 'USR-C1[0-2]'], ['Giới hạn độ dài trường', 'USR-C14'],
    ['Tên rỗng qua API trả 4xx, không 500', 'USR-C17'], ['Tài khoản mới đăng nhập được', 'USR-C18'],
    ['Bấm Lưu 2 lần liên tiếp chỉ tạo 1 bản ghi', 'USR-G06'], ...addCommon('USR'),
  ]),
  R('USR', 'A.II.1-UC5', 24, 'Chỉnh sửa thông tin người dùng', [
    ['Sửa họ tên / SĐT thành công', 'USR-E0[12]'], ['Đổi nhóm (mỗi người chỉ 1 nhóm)', 'USR-E03'], ['Email trùng người khác / sai định dạng', 'USR-E0[45]'],
    ['Xóa trắng họ tên bị chặn', 'USR-E06'], ['Hủy sửa không đổi dữ liệu', 'USR-E07'], ['Mật khẩu trống thì không đổi mật khẩu', 'USR-E08'],
    ['Tên đăng nhập không sửa được', 'USR-E09'],
  ]),
  R('USR', 'A.II.1 (bổ sung UI)', 0, 'Khóa/Mở khóa, Xóa người dùng (thao tác có trên giao diện)', [
    ['Khóa → Đã khóa', 'USR-X01'], ['Mở khóa → Đang hoạt động', 'USR-X02'], ['Lọc theo trạng thái khóa', 'USR-X03'],
    ['Xóa thành công', 'USR-X04'], ['Chọn Không ở xác nhận xóa', 'USR-X05'],
  ]),
);

// ================= A.II.2 NHÓM NGƯỜI DÙNG =================
T.push(
  R('GRP', 'A.II.2-UC1', 26, 'Xem danh sách nhóm người dùng; tìm kiếm', listConds('GRP', [['Cột Thành viên khớp số thành viên', 'GRP-L12']])),
  R('GRP', 'A.II.2-UC2', 27, 'Export danh sách nhóm ra Excel', [...exportCond('GRP'), ['Xuất Excel thành viên ở chi tiết', 'GRP-V03']]),
  R('GRP', 'A.II.2-UC3', 28, 'Xem thông tin nhóm người dùng', [['Chi tiết hiển thị mã, tên, mô tả, thành viên', 'GRP-V01'], ['Mở chi tiết với id không tồn tại', 'GRP-V04']]),
  R('GRP', 'A.II.2-UC4', 29, 'Thêm mới nhóm người dùng', [
    ['Thêm đầy đủ / chỉ mã+tên', 'GRP-C0[12]'], ['Trùng mã nhóm', 'GRP-C04'], ['Tên rỗng qua API', 'GRP-C06'],
    ['Mã chỉ khác hoa-thường bị coi là trùng', 'GRP-C07'], ['Bấm Lưu 2 lần chỉ tạo 1 nhóm', 'GRP-G06'], ...addCommon('GRP'),
  ]),
  R('GRP', 'A.II.2-UC5', 30, 'Chỉnh sửa nhóm', [['Sửa tên / mô tả', 'GRP-E0[12]'], ['Xóa trắng tên bị chặn', 'GRP-E03'], ['Hủy sửa', 'GRP-E04'], ['Mã nhóm không sửa được', 'GRP-E05']]),
  R('GRP', 'A.II.2-UC6', 31, 'Xóa nhóm người dùng', [['Xóa nhóm không thành viên', 'GRP-D01'], ['Chọn Không', 'GRP-D02'], ['Xóa nhóm đang có thành viên', 'GRP-D03']]),
  R('GRP', 'A.II.2-UC7', 32, 'Xem người dùng trong nhóm', [['Bảng thành viên + lọc trạng thái', 'GRP-V0[12]'], ['Tìm thành viên trong chi tiết nhóm', 'GRP-V05']]),
  R('GRP', 'A.II.2-UC8', 33, 'Xóa người dùng khỏi nhóm', [['Xóa khỏi nhóm (chọn + xác nhận)', 'GRP-M07'], ['Chọn Hủy ở xác nhận thì giữ nguyên', 'GRP-M08']]),
  R('GRP', 'A.II.2-UC9', 34, 'Thêm người dùng vào nhóm (mỗi người chỉ thuộc 1 nhóm)', [
    ['Thêm 1 / nhiều người', 'GRP-M0[15]'], ['Người dùng đã thuộc nhóm khác: chuyển, không thuộc 2 nhóm', 'GRP-M02'], ['Không chọn lại người đã trong nhóm', 'GRP-M03'],
    ['Tìm trong màn thêm', 'GRP-M04'], ['Lưu khi chưa chọn', 'GRP-M06'],
  ]),
);

// ================= A.IV.1 TỈNH =================
T.push(
  R('PRV', 'A.IV.1-UC1', 59, 'Xem danh sách đơn vị hành chính cấp tỉnh', listConds('PRV')),
  R('PRV', 'A.IV.1-UC2', 60, 'Thêm mới đơn vị hành chính cấp tỉnh', [
    ['Thêm thành công, số đơn vị = 0', 'PRV-C01'], ['Trùng mã', 'PRV-C03'], ['Trùng tên khác mã', 'PRV-C06'], ['Mã dài > 10 ký tự', 'PRV-C04'],
    ['Tên rỗng qua API', 'PRV-G03'], ['Bấm Lưu 2 lần', 'PRV-G06'], ...addCommon('PRV'),
  ]),
  R('PRV', 'A.IV.1-UC3', 61, 'Chỉnh sửa tỉnh', [['Sửa tên', 'PRV-E01'], ['Mã không đổi', 'PRV-E02'], ['Xóa trắng tên', 'PRV-E03'], ['Hủy sửa', 'PRV-E04'], ['Sửa tên trùng tỉnh khác', 'PRV-E05']]),
  R('PRV', 'A.IV.1-UC4', 62, 'Xóa tỉnh', [['Xóa tỉnh chưa có đơn vị', 'PRV-D01'], ['Tỉnh đang có đơn vị bị chặn', 'PRV-D02'], ['Chọn Không', 'PRV-D03']]),
  R('PRV', 'A.IV.1-UC5', 63, 'Xem thông tin tỉnh và danh sách đơn vị thuộc tỉnh', [['Chi tiết + danh sách đơn vị', 'PRV-V01'], ['Số đơn vị khớp', 'PRV-V02'], ['Nút Chỉnh sửa', 'PRV-V03'], ['Mở chi tiết id không tồn tại', 'PRV-V04']]),
  R('PRV', 'A.IV.1-UC6', 64, 'Tìm kiếm tỉnh trong danh sách', [['Tìm theo mã/tên, không kết quả, ký tự đặc biệt', 'PRV-L0[3-7]']]),
  R('PRV', 'A.IV.1-UC7', 65, 'Export tỉnh ra Excel', exportCond('PRV')),
);

// ================= A.IV.2 XÃ =================
T.push(
  R('COM', 'A.IV.2-UC1', 67, 'Xem danh sách đơn vị hành chính cấp xã', listConds('COM', [['Lọc theo tỉnh', 'COM-L12']])),
  R('COM', 'A.IV.2-UC2', 68, 'Thêm mới xã', [
    ['Thêm có chọn tỉnh', 'COM-C01'], ['Thêm không chọn tỉnh (Chưa tham chiếu)', 'COM-C05'], ['Trùng mã', 'COM-C03'], ['Tên rỗng qua API', 'COM-G03'], ['Bấm Lưu 2 lần', 'COM-G06'], ...addCommon('COM'),
  ]),
  R('COM', 'A.IV.2-UC3', 69, 'Chỉnh sửa xã', [['Sửa tên', 'COM-E01'], ['Đổi tỉnh trực thuộc', 'COM-E02'], ['Xóa trắng tên', 'COM-E03'], ['Hủy sửa', 'COM-E04']]),
  R('COM', 'A.IV.2-UC4', 70, 'Xóa xã', [['Xóa xã chưa có đơn vị', 'COM-D01'], ['Xã đang có đơn vị bị chặn', 'COM-D02'], ['Chọn Không', 'COM-D03']]),
  R('COM', 'A.IV.2-UC5', 71, 'Xem thông tin xã và đơn vị thuộc xã', [['Chi tiết + danh sách đơn vị', 'COM-V01'], ['Mở chi tiết id không tồn tại', 'COM-V02']]),
  R('COM', 'A.IV.2-UC6', 72, 'Tìm kiếm xã', [['Tìm theo mã/tên, không kết quả', 'COM-L0[3-7]']]),
  R('COM', 'A.IV.2-UC7', 73, 'Export xã', exportCond('COM')),
  R('COM', 'A.IV.2-UC8', 74, 'Thiết lập tham chiếu đơn vị đến xã', [['Chọn đơn vị và lưu tham chiếu', 'COM-R01']]),
  R('COM', 'A.IV.2-UC9', 75, 'Hủy tham chiếu đơn vị đến xã', [['Gỡ tham chiếu', 'COM-R02']]),
);

// ================= A.IV.3 LOẠI ĐƠN VỊ =================
T.push(
  R('UTY', 'A.IV.3-UC1', 77, 'Xem danh sách loại đơn vị; tìm kiếm', listConds('UTY', [['Lọc theo cấp hành chính', 'UTY-L12']])),
  R('UTY', 'A.IV.3-UC2', 78, 'Export loại đơn vị', exportCond('UTY')),
  R('UTY', 'A.IV.3-UC3', 79, 'Xem loại đơn vị và danh sách đơn vị thuộc loại', [['Chi tiết + danh sách đơn vị', 'UTY-V01'], ['Số đơn vị khớp', 'UTY-V02'], ['Mở chi tiết id không tồn tại', 'UTY-V03']]),
  R('UTY', 'A.IV.3-UC4', 80, 'Thêm mới loại đơn vị', [
    ['Thêm đầy đủ', 'UTY-C01'], ['Trùng mã', 'UTY-C03'], ['Từng cấp hành chính lưu đúng', 'UTY-C05'], ['Tên rỗng qua API', 'UTY-G03'], ['Bấm Lưu 2 lần', 'UTY-G06'], ...addCommon('UTY'),
  ]),
  R('UTY', 'A.IV.3-UC5', 81, 'Chỉnh sửa loại đơn vị', [['Sửa tên', 'UTY-E01'], ['Sửa cấp + mô tả', 'UTY-E02'], ['Xóa trắng tên', 'UTY-E03'], ['Hủy sửa', 'UTY-E04']]),
  R('UTY', 'A.IV.3-UC6', 82, 'Xóa loại đơn vị', [['Xóa loại chưa có đơn vị', 'UTY-D01'], ['Loại đang có đơn vị bị chặn / ẩn nút Xóa', 'UTY-D0[23]'], ['Chọn Không', 'UTY-D04']]),
);

// ================= A.IV.4 ĐƠN VỊ =================
T.push(
  R('ORG', 'A.IV.4-UC1', 84, 'Xem danh sách đơn vị; tìm kiếm', listConds('ORG', [['Lọc theo loại đơn vị', 'ORG-L12'], ['Lọc theo tỉnh tham chiếu', 'ORG-L13']])),
  R('ORG', 'A.IV.4-UC2', 85, 'Export đơn vị', exportCond('ORG')),
  R('ORG', 'A.IV.4-UC3', 86, 'Xem thông tin đơn vị', [['Chi tiết loại/tỉnh/số người dùng/kỳ đánh giá', 'ORG-V01'], ['Mở chi tiết id không tồn tại', 'ORG-V03']]),
  R('ORG', 'A.IV.4-UC4', 87, 'Thêm mới đơn vị', [
    ['Thêm với mã, tên, loại', 'ORG-C01'], ['Thiếu loại đơn vị', 'ORG-C03'], ['Trùng mã', 'ORG-C04'], ['Đơn vị cha', 'ORG-C05'], ['Tham chiếu tỉnh khi tạo', 'ORG-C06'],
    ['Email sai định dạng', 'ORG-C07'], ['Chỉ loại cấp xã mới tham chiếu xã', 'ORG-C09'], ['Bấm Lưu 2 lần', 'ORG-G06'], ...addCommon('ORG'),
  ]),
  R('ORG', 'A.IV.4-UC5', 88, 'Chỉnh sửa đơn vị', [['Sửa tên', 'ORG-E01'], ['Đổi loại', 'ORG-E02'], ['Xóa trắng tên', 'ORG-E03'], ['Hủy sửa', 'ORG-E04'], ['Đơn vị đã khóa không sửa được', 'ORG-K01']]),
  R('ORG', 'A.IV.4-UC6', 89, 'Xóa đơn vị', [['Xóa đơn vị chưa có người dùng', 'ORG-D01'], ['Đơn vị đang có người dùng bị chặn', 'ORG-D02'], ['Chọn Không', 'ORG-D03']]),
  R('ORG', 'A.IV.4-UC7', 90, 'Khóa/Mở khóa đơn vị', [['Khóa', 'ORG-K01'], ['Mở khóa', 'ORG-K02'], ['Đơn vị đã khóa mới chọn được ở nơi dùng (đơn vị cha, user)', 'ORG-C05']]),
  R('ORG', 'A.IV.4-UC8', 91, 'Tham chiếu/bỏ tham chiếu đơn vị với tỉnh', [['Đổi tỉnh', 'ORG-R01'], ['Bỏ tham chiếu', 'ORG-R02']]),
  R('ORG', 'A.IV.4-UC9', 92, 'Xem người dùng trong đơn vị', [['Bảng người dùng + lọc vai trò', 'ORG-V02'], ['Tìm người dùng trong đơn vị', 'ORG-V04']]),
  R('ORG', 'A.IV.4-UC10', 93, 'Xóa người dùng khỏi đơn vị', [['Xóa khỏi đơn vị', 'ORG-M02']]),
  R('ORG', 'A.IV.4-UC11', 94, 'Thêm người dùng vào đơn vị', [['Thêm người dùng', 'ORG-M01'], ['Người dùng đang ở đơn vị khác được chuyển sang', 'ORG-M03']]),
);

// ================= PHÂN HỆ B (nguồn: UC_1409 mục B.I, B.II + SRS Thang xếp loại) =================
const listB = k => [
  ['Hiển thị đủ cột, STT', `${k}-L01`], ['Phân trang và tổng số bản ghi', `${k}-L02|${k}-L08|${k}-L09`],
  ['Tìm theo mã/tên, không kết quả, hoa-thường, xóa từ khóa', `${k}-L0[3-6]|${k}-L10`], ['Ký tự đặc biệt / SQLi an toàn', `${k}-L07`],
  ['Chặn truy cập không token / token giả', `${k}-A01`], ['Quyền API đúng theo vai trò', `${k}-A02`], ['Chưa đăng nhập bị chuyển về đăng nhập', `${k}-A03`], ['Hiệu năng tải danh sách', `${k}-P01`],
];
const addB = k => [['Khoảng trắng', `${k}-G01`], ['Unicode/HTML hiển thị nguyên văn', `${k}-G02`], ['Lỗi 500 khi lưu', `${k}-G03`], ['Mất kết nối khi lưu', `${k}-G04`], ['Bấm Lưu 2 lần', `${k}-G05`]];
T.push(
  // B.I.1 Trụ cột
  R('PIL', 'B.I.1-UC1', null, 'Xem danh sách, tìm kiếm, chi tiết trụ cột', [...listB('PIL'), ['Lọc trạng thái', 'PIL-L12'], ['Cột Nhóm chỉ số khớp', 'PIL-L13'], ['Chi tiết và số liệu tổng hợp', 'PIL-V0[12]'], ['Xuất Excel chi tiết', 'PIL-V03'], ['Chi tiết id không tồn tại', 'PIL-V04']]),
  R('PIL', 'B.I.1-UC2', null, 'Thêm mới trụ cột', [['Thêm thành công', 'PIL-C01'], ['Bắt buộc', 'PIL-C02|PIL-C09'], ['Trùng mã / khác hoa-thường / trùng tên', 'PIL-C0[345]'], ['Độ dài mã/tên', 'PIL-C0[67]'], ['Hủy', 'PIL-C08'], ...addB('PIL')]),
  R('PIL', 'B.I.1-UC3', null, 'Khóa/mở khóa trụ cột', [['Khóa', 'PIL-K01'], ['Mở khóa', 'PIL-K02'], ['Chỉ trụ cột đã khóa được chọn ở nhóm', 'PIL-K03'], ['Mở khóa khi đang có nhóm', 'PIL-K04']]),
  R('PIL', 'B.I.1-UC4', null, 'Xóa trụ cột', [['Xóa thành công', 'PIL-D01'], ['Chọn Không', 'PIL-D02'], ['Đã khóa', 'PIL-D03'], ['Đang có nhóm', 'PIL-D04']]),
  R('PIL', 'B.I.1-UC5', null, 'Chỉnh sửa trụ cột', [['Sửa tên', 'PIL-E01'], ['Mã không đổi', 'PIL-E02'], ['Xóa trắng tên', 'PIL-E03'], ['Hủy', 'PIL-E04'], ['Sửa đã khóa', 'PIL-E05|PIL-V05'], ['Sửa thành tên trùng', 'PIL-E06']]),
  // B.I.2 Nhóm chỉ số
  R('IGR', 'B.I.2-UC1', null, 'Xem danh sách, tìm kiếm, chi tiết nhóm chỉ số', [...listB('IGR'), ['Lọc', 'IGR-L12'], ['Cột Chỉ số khớp', 'IGR-L13'], ['Chi tiết', 'IGR-V01'], ['Chi tiết id không tồn tại', 'IGR-V02'], ['Nhóm đã khóa ẩn Cập nhật/Thêm', 'IGR-V03']]),
  R('IGR', 'B.I.2-UC2', null, 'Thêm mới nhóm chỉ số', [['Thêm thành công', 'IGR-C01'], ['Bắt buộc', 'IGR-C02|IGR-C08'], ['Trùng mã / khác hoa-thường', 'IGR-C0[35]'], ['Trụ cột chưa khóa/không hợp lệ', 'IGR-C04'], ['Hủy', 'IGR-C06'], ['Độ dài mã', 'IGR-C07'], ...addB('IGR')]),
  R('IGR', 'B.I.2-UC3', null, 'Khóa/mở khóa nhóm', [['Khóa', 'IGR-K01'], ['Mở khóa', 'IGR-K02'], ['Chỉ nhóm đã khóa được chọn ở chỉ số', 'IGR-K03']]),
  R('IGR', 'B.I.2-UC4', null, 'Xóa nhóm', [['Xóa thành công', 'IGR-D01'], ['Chọn Không', 'IGR-D02'], ['Đã khóa', 'IGR-D03'], ['Đang có chỉ số', 'IGR-D04']]),
  R('IGR', 'B.I.2-UC5', null, 'Chỉnh sửa nhóm', [['Sửa tên', 'IGR-E01'], ['Xóa trắng tên', 'IGR-E02'], ['Hủy', 'IGR-E03'], ['Sửa đã khóa', 'IGR-E04'], ['Đổi trụ cột', 'IGR-E05']]),
  // B.I.3-5 Chỉ số
  R('IND', 'B.I.3-UC1', null, 'Xem danh sách, tìm kiếm, chi tiết chỉ số', [...listB('IND'), ['Lọc trụ cột/nhóm', 'IND-L12'], ['Lọc trạng thái', 'IND-L13'], ['Từ khóa + lọc', 'IND-L14'], ['Cột chỉ số con khớp', 'IND-L15'], ['Chi tiết', 'IND-V01'], ['Chi tiết id không tồn tại', 'IND-V02'], ['Bộ chỉ số đang sử dụng', 'IND-V03']]),
  R('IND', 'B.I.3-UC2', null, 'Thêm mới chỉ số', [['Thêm đầy đủ', 'IND-C01'], ['Bắt buộc', 'IND-C02|IND-C14'], ['Trùng mã', 'IND-C03'], ['Phụ thuộc trụ cột/nhóm/cha', 'IND-C04'], ['Thêm chỉ số con', 'IND-C05'], ['Quy tắc điểm', 'IND-C0[6-9]|IND-C10'], ['Điểm con vượt cha', 'IND-C11'], ['Hủy', 'IND-C12'], ['Độ dài mã', 'IND-C13'], ...addB('IND')]),
  R('IND', 'B.I.3-UC3', null, 'Khóa/mở khóa chỉ số', [['Khóa', 'IND-K01'], ['Mở khóa', 'IND-K02'], ['Chỉ chỉ số đã khóa vào bộ', 'IND-K03']]),
  R('IND', 'B.I.3-UC4', null, 'Xóa chỉ số', [['Xóa thành công', 'IND-D01'], ['Chọn Không', 'IND-D02'], ['Đã khóa', 'IND-D03'], ['Có chỉ số con', 'IND-D04'], ['Đang dùng trong bộ', 'IND-D05']]),
  R('IND', 'B.I.3-UC5', null, 'Chỉnh sửa chỉ số', [['Sửa tên/mô tả', 'IND-E01'], ['Xóa trắng tên', 'IND-E02'], ['Hủy', 'IND-E03'], ['Sửa đã khóa', 'IND-E04']]),
  R('IND', 'B.I.3-UC6', null, 'Quản lý cấu trúc cha/con', [['Đổi cha', 'IND-E05'], ['Bỏ cha', 'IND-E06'], ['Chống vòng lặp', 'IND-E07']]),
  R('IND', 'B.I.4-UC1', null, 'Cập nhật điểm tối đa', [['Sửa điểm tối đa', 'IND-E08'], ['Giảm điểm cha dưới tổng con', 'IND-E11']]),
  R('IND', 'B.I.4-UC2', null, 'Cập nhật điểm tối thiểu', [['Sửa điểm tối thiểu', 'IND-E09'], ['min > max', 'IND-E10']]),
  R('IND', 'B.I.5-UC1', null, 'Nhân bản chỉ số', [['Nhân bản', 'IND-N01'], ['Đã khóa', 'IND-N02'], ['Mã duy nhất', 'IND-N03'], ['Có con', 'IND-N04'], ['id không tồn tại', 'IND-N06']]),
  R('IND', 'B.I.5-UC2', null, 'Xem/sửa chỉ số nhân bản', [['Sửa bản sao', 'IND-N05']]),
  // B.II Bộ chỉ số
  R('SET', 'B.II.1-UC1', null, 'Xem danh sách bộ chỉ số', [...listB('SET'), ['Lọc', 'SET-L12'], ['Trạng thái nhất quán', 'SET-L13']]),
  R('SET', 'B.II.1-UC2', null, 'Xuất Excel danh sách', [['Xuất Excel', 'SET-L11']]),
  R('SET', 'B.II.1-UC3', null, 'Xem chi tiết bộ chỉ số', [['Chi tiết', 'SET-V01'], ['id không tồn tại', 'SET-V05'], ['Kỳ đang sử dụng', 'SET-V06']]),
  R('SET', 'B.II.1-UC4', null, 'Xem cấu trúc bộ chỉ số', [['Cấu trúc', 'SET-V02'], ['Tổng điểm', 'SET-V03']]),
  R('SET', 'B.II.1-UC5', null, 'Xuất Excel bộ chỉ số', [['Xuất Excel chi tiết', 'SET-V04']]),
  R('SET', 'B.II.1-UC6', null, 'Thêm mới bộ chỉ số', [['Thêm thành công', 'SET-C01'], ['Bắt buộc', 'SET-C02|SET-C07'], ['Trùng mã', 'SET-C03'], ['Năm áp dụng', 'SET-C04'], ['Hủy', 'SET-C05'], ['Độ dài mã', 'SET-C06'], ...addB('SET')]),
  R('SET', 'B.II.1-UC7', null, 'Xóa bộ chỉ số', [['Xóa', 'SET-D01'], ['Chọn Không', 'SET-D02'], ['Đã khóa', 'SET-D03'], ['Đang được kỳ sử dụng', 'SET-D04']]),
  R('SET', 'B.II.1-UC8', null, 'Khóa/mở khóa bộ chỉ số', [['Khóa', 'SET-K01'], ['Mở khóa', 'SET-K02']]),
  R('SET', 'B.II.1-UC9', null, 'Cập nhật thông tin bộ chỉ số', [['Sửa thông tin', 'SET-E01'], ['Thời gian sử dụng', 'SET-E02'], ['Xóa trắng tên', 'SET-E03'], ['Hủy', 'SET-E04'], ['Đã khóa', 'SET-E05']]),
  R('SET', 'B.II.2-UC1', null, 'Xem nhóm chỉ số của bộ', [['Danh sách nhóm', 'SET-S01']]),
  R('SET', 'B.II.2-UC2', null, 'Thêm nhóm vào bộ', [['Thêm', 'SET-S02'], ['Không trùng', 'SET-S03'], ['Chỉ nhóm đã khóa', 'SET-S04']]),
  R('SET', 'B.II.2-UC3', null, 'Sửa nhóm trong bộ', [['Sửa', 'SET-S05']]),
  R('SET', 'B.II.2-UC4', null, 'Xóa nhóm khỏi bộ', [['Xóa', 'SET-S06']]),
  R('SET', 'B.II.2-UC5', null, 'Tính điểm nhóm', [['Tính/không tính điểm', 'SET-S07']]),
  R('SET', 'B.II.3-UC1', null, 'Xem chỉ số của bộ', [['Danh sách chỉ số', 'SET-I01']]),
  R('SET', 'B.II.3-UC2', null, 'Thêm chỉ số vào bộ', [['Thêm', 'SET-I02'], ['Thuộc nhóm có trong bộ, không trùng', 'SET-I03']]),
  R('SET', 'B.II.3-UC3', null, 'Sửa chỉ số trong bộ', [['Sửa', 'SET-I04']]),
  R('SET', 'B.II.3-UC4', null, 'Xóa chỉ số khỏi bộ', [['Xóa', 'SET-I05']]),
  R('SET', 'B.II.3-UC5', null, 'Tính điểm chỉ số', [['Tính/không tính điểm', 'SET-I06']]),
  R('SET', 'B.II.3-UC6', null, 'Sửa điểm chỉ số trong bộ', [['Sửa điểm', 'SET-I07'], ['Điểm hợp lệ', 'SET-I08']]),
  R('SET', 'B.II.4-UC1', null, 'Khóa bộ để dùng cho kỳ', [['Chỉ bộ đã khóa được chọn ở kỳ', 'SET-K03']]),
  R('SET', 'B.II.4-UC2', null, 'Mở khóa bộ đang được dùng', [['Mở khóa bộ đang dùng', 'SET-K04']]),
  R('SET', 'B.II.5-UC1', null, 'Nhân bản bộ chỉ số', [['Nhân bản', 'SET-N01'], ['Đã khóa', 'SET-N02'], ['Mã duy nhất', 'SET-N03'], ['id không tồn tại', 'SET-N05']]),
  R('SET', 'B.II.5-UC2', null, 'Sửa bộ nhân bản', [['Sửa bản sao', 'SET-N04']]),
  // Thang xếp loại (SRS)
  R('SCL', 'B.TXL-UC1', null, 'SRS UC1.1 Danh sách thang xếp loại', [...listB('SCL'), ['Bộ lọc trạng thái', 'SCL-L1[23]'], ['Hiển thị dòng, kỳ sử dụng, menu', 'SCL-L1[4-6]'], ['Trạng thái rỗng', 'SCL-L17']]),
  R('SCL', 'B.TXL-UC2', null, 'SRS UC1.2 Chi tiết thang xếp loại', [['Thông tin chung và bảng mức', 'SCL-V0[1-4]'], ['Kỳ sử dụng', 'SCL-V05'], ['Thang đã gán → MSG-104', 'SCL-V06'], ['Nút theo quyền', 'SCL-V07'], ['id không tồn tại', 'SCL-V08']]),
  R('SCL', 'B.TXL-UC3', null, 'SRS UC1.3 Thêm thang xếp loại', [['Thêm thành công, mã tự sinh', 'SCL-C0[123]'], ['Tên thang', 'SCL-C0[456]'], ['Số mức', 'SCL-C0[78]'], ['Quy tắc khoảng điểm', 'SCL-C09|SCL-C1[0-5]'], ['Tên mức', 'SCL-C1[67]'], ['Thêm/xóa dòng mức', 'SCL-C1[89]|SCL-C20'], ['Xem trước và thanh lưu', 'SCL-C2[12]'], ['Thoát khi chưa lưu', 'SCL-C2[34]'], ['Validate qua API', 'SCL-C2[56]'], ...addB('SCL')]),
  R('SCL', 'B.TXL-UC4', null, 'SRS UC1.4 Sửa thang xếp loại', [['Sửa thành công', 'SCL-E0[12]'], ['Thang đã gán', 'SCL-E03'], ['Mã chỉ xem', 'SCL-E04'], ['Validate như thêm', 'SCL-E05'], ['Xung đột dữ liệu MSG-020', 'SCL-E06'], ['Hủy', 'SCL-E07']]),
  R('SCL', 'B.TXL-UC5', null, 'SRS UC1.5 Xóa thang xếp loại', [['Hộp thoại xóa', 'SCL-D01'], ['Xóa chưa/đã khóa', 'SCL-D0[23]'], ['Hủy', 'SCL-D04'], ['Thang đã gán', 'SCL-D05']]),
  R('SCL', 'B.TXL-UC6', null, 'SRS UC1.6 Khóa thang xếp loại', [['Hộp thoại khóa', 'SCL-K01'], ['Khóa thành công', 'SCL-K02'], ['Điều kiện khóa', 'SCL-K03'], ['Thao tác khi đã khóa', 'SCL-K04']]),
  R('SCL', 'B.TXL-UC7', null, 'SRS UC1.7 Mở khóa thang xếp loại', [['Hộp thoại mở khóa', 'SCL-K05'], ['Mở khóa thành công', 'SCL-K06'], ['Thang đã gán', 'SCL-K07']]),
);

// ---------- XÁC THỰC: Đăng nhập (LGN) / Quên mật khẩu (RPW) — nguồn: khảo sát UI/API (không có UC trong UC_1409) ----------
T.push(
  R('LGN', 'AUTH.1-UC1', null, 'Form đăng nhập và validate', [['Hiển thị đủ thành phần', 'LGN-L01'], ['Ẩn/hiện mật khẩu', 'LGN-L02'], ['Bắt buộc từng ô', 'LGN-L0[3-6]'], ['Enter gửi form', 'LGN-L07'], ['Liên kết Quên mật khẩu', 'LGN-L08']]),
  R('LGN', 'AUTH.1-UC2', null, 'Xác thực tài khoản (cần captcha thật)', [['Đăng nhập đúng', 'LGN-M01'], ['Sai mật khẩu / tên không tồn tại', 'LGN-M0[23]'], ['Chống dò tài khoản', 'LGN-M04'], ['Tài khoản bị khóa', 'LGN-M05'], ['Tên đăng nhập/email, hoa-thường', 'LGN-M0[67]'], ['Tài khoản không nhóm', 'LGN-M08'], ['Giới hạn sai mật khẩu', 'LGN-M15']]),
  R('LGN', 'AUTH.1-UC3', null, 'Captcha', [['Captcha sai và làm mới', 'LGN-C0[123]|LGN-C10'], ['API captcha', 'LGN-C0[45]'], ['API từ chối captcha sai/thiếu/lạ', 'LGN-C0[678]'], ['Ký tự đặc biệt/SQLi/XSS', 'LGN-C09'], ['Captcha dùng một lần', 'LGN-M14']]),
  R('LGN', 'AUTH.1-UC4', null, 'Đổi mật khẩu lần đầu', [['Chuyển màn đổi mật khẩu', 'LGN-M09'], ['Đổi thành công', 'LGN-M10'], ['Không khớp', 'LGN-M11']]),
  R('LGN', 'AUTH.1-UC5', null, 'Phiên / đăng xuất', [['Chặn khi chưa đăng nhập, token giả', 'LGN-S0[123]'], ['Ghi nhớ đăng nhập', 'LGN-M12'], ['Đăng xuất', 'LGN-M13']]),
  R('RPW', 'AUTH.2-UC1', null, 'Yêu cầu OTP qua email', [['Hiển thị màn', 'RPW-L01'], ['Bắt buộc/định dạng email', 'RPW-L0[23]'], ['Email chưa đăng ký', 'RPW-L04|RPW-L06'], ['Quay lại đăng nhập', 'RPW-L05'], ['Tài khoản khóa', 'RPW-L07'], ['Hoa/thường email', 'RPW-L08'], ['SQLi/XSS', 'RPW-L09'], ['Chống dò tài khoản', 'RPW-L10'], ['Giới hạn tần suất gửi OTP', 'RPW-L11']]),
  R('RPW', 'AUTH.2-UC2', null, 'Xác thực OTP', [['Màn OTP', 'RPW-O01|RPW-O03|RPW-O09'], ['Mail OTP', 'RPW-O02'], ['Gửi lại sau đếm ngược', 'RPW-O04'], ['Validate OTP', 'RPW-O0[567]'], ['OTP đúng', 'RPW-O08'], ['Hết hạn', 'RPW-O10'], ['Gửi lại làm mất OTP cũ', 'RPW-O11'], ['OTP khác email', 'RPW-O12'], ['Thiếu tham số', 'RPW-O13'], ['Giới hạn nhập sai', 'RPW-O14']]),
  R('RPW', 'AUTH.2-UC3', null, 'Đặt mật khẩu mới', [['Màn mật khẩu mới', 'RPW-P01|RPW-P14'], ['Bắt buộc/không khớp', 'RPW-P0[2-5]'], ['Chính sách mật khẩu', 'RPW-P0[6-9]'], ['Luồng thành công', 'RPW-P10'], ['OTP dùng lại/sai/thiếu', 'RPW-P1[123]'], ['Sau đặt lại (đăng nhập, phiên)', 'RPW-M0[123]']]),
);

// ---------- XÁC THỰC (sau đăng nhập): Đổi mật khẩu (CPW) / Đăng xuất (LGO) — nguồn: khảo sát UI/API ----------
T.push(
  R('CPW', 'AUTH.3-UC1', null, 'Mở & hiển thị hộp thoại Đổi mật khẩu', [['Có nút ở Thông tin cá nhân, mọi vai trò', 'CPW-L0[12]'], ['Hộp thoại đủ thành phần', 'CPW-L03'], ['Ẩn/hiện mật khẩu', 'CPW-L04'], ['Đóng hộp thoại không gọi API', 'CPW-L05'], ['Xóa dữ liệu nhập sau Huỷ', 'CPW-L06']]),
  R('CPW', 'AUTH.3-UC2', null, 'Validate giao diện', [['Bắt buộc từng ô', 'CPW-V0[1-4]'], ['Xác nhận không khớp', 'CPW-V05'], ['Chính sách: ngắn/hoa-thường/số/đặc biệt/tên đăng nhập', 'CPW-V0[6-9]|CPW-V10'], ['Thanh độ mạnh', 'CPW-V11'], ['Quá 128 ký tự', 'CPW-V12']]),
  R('CPW', 'AUTH.3-UC3', null, 'Kiểm tra phía API', [['Mật khẩu hiện tại sai (UI + API)', 'CPW-A0[12]'], ['Mật khẩu hiện tại rỗng/null/khoảng trắng', 'CPW-A0[345]'], ['Mật khẩu mới rỗng/thiếu', 'CPW-A06'], ['Chính sách phía server', 'CPW-A0[789]'], ['Độ dài tối đa', 'CPW-A10']]),
  R('CPW', 'AUTH.3-UC4', null, 'Bảo mật đổi mật khẩu', [['Không token / token giả', 'CPW-S0[12]'], ['Người dùng khác / id lạ', 'CPW-S0[34]'], ['SQLi/XSS', 'CPW-S05'], ['Mật khẩu không lộ qua URL/phản hồi', 'CPW-S06'], ['Giới hạn sai nhiều lần', 'CPW-S07']]),
  R('CPW', 'AUTH.3-UC5', null, 'Luồng & lỗi', [['Lỗi 500', 'CPW-G01'], ['Mất mạng', 'CPW-G02'], ['Bấm lặp', 'CPW-G03']]),
  R('CPW', 'AUTH.3-UC6', null, 'Sau khi đổi mật khẩu (cần mật khẩu cũ đúng)', [['Đổi thành công trên UI', 'CPW-M01'], ['Đăng nhập bằng mật khẩu mới / cũ bị từ chối', 'CPW-M0[23]'], ['Phiên hiện tại giữ, phiên khác bị thu hồi', 'CPW-M04'], ['Trùng mật khẩu cũ / lịch sử', 'CPW-M05|CPW-M07'], ['Biên 128 ký tự', 'CPW-M06']]),
  R('LGO', 'AUTH.4-UC1', null, 'Menu & hộp thoại xác nhận đăng xuất', [['Menu người dùng', 'LGO-L01'], ['Hộp thoại xác nhận', 'LGO-L02'], ['Không / Esc giữ phiên', 'LGO-L0[34]'], ['Mở lặp', 'LGO-L05']]),
  R('LGO', 'AUTH.4-UC2', null, 'Kết thúc phiên', [['Có → về đăng nhập, xóa phiên', 'LGO-D01'], ['Back / URL trực tiếp / F5', 'LGO-D0[234]'], ['Từ trang bất kỳ, mọi vai trò', 'LGO-D0[57]'], ['Form đăng nhập sạch', 'LGO-D06']]),
  R('LGO', 'AUTH.4-UC3', null, 'Bảo mật đăng xuất', [['Thu hồi token phía server', 'LGO-S01'], ['Không còn token ở storage/cookie', 'LGO-S02'], ['Nhiều tab', 'LGO-S03'], ['Đổi tài khoản không lẫn quyền', 'LGO-S04'], ['Hết hạn phiên', 'LGO-S05']]),
  R('LGO', 'AUTH.4-UC4', null, 'Lỗi & thao tác lặp', [['Mất mạng', 'LGO-G01'], ['Bấm Có lặp', 'LGO-G02']]),
);

import reqB3 from './requirements-B3.mjs';
import reqC1 from './requirements-C1.mjs';
import reqC2 from './requirements-C2.mjs';
import reqC3 from './requirements-C3.mjs';
import reqPRM from './requirements-PRM.mjs';
T.push(...reqB3(R), ...reqC1(R), ...reqC2(R), ...reqC3(R), ...reqPRM(R));

export default T;
