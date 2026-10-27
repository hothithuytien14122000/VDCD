// NGUỒN CHUẨN testcase phân hệ A (6 page). Sinh: catalog.json  (node build-docs.mjs)
// Cột: id | uc (mã UC_1409) | chức năng | tiêu đề | loại | ưu tiên | các bước | kết quả mong đợi | automation
const T = [];
const t = (id, uc, fn, title, type, pri, steps, exp, auto = 'Auto', note = '') =>
  T.push({ id, uc, fn, title, type, pri, steps, exp, auto, note });

// ---------- Template dùng chung cho trang danh sách ----------
function listSuite(P, name, o) {
  const { ucList, ucSearch, ucExport, cols, kwCode, kwName, perPageNote } = o;
  t(`${P}-L01`, ucList, 'Xem danh sách', `Danh sách ${name} hiển thị đúng các cột`, 'Chức năng', 'Cao',
    `1. Đăng nhập admin\n2. Mở trang ${name}`, `Bảng có đủ cột: ${cols.join(', ')}; có dữ liệu`);
  t(`${P}-L02`, ucList, 'Xem danh sách', `Phân trang mặc định 10 bản ghi/trang và hiển thị tổng số bản ghi`, 'Chức năng', 'Trung bình',
    `1. Mở trang ${name}`, 'Hiển thị "Hiển thị 1-10 trong N bản ghi"; tối đa 10 dòng dữ liệu; thanh phân trang xuất hiện khi N>10');
  t(`${P}-L03`, ucSearch, 'Tìm kiếm', `Tìm theo ${kwCode.label} trả về đúng bản ghi`, 'Chức năng', 'Cao',
    `1. Mở trang ${name}\n2. Nhập một ${kwCode.label} có sẵn vào ô tìm kiếm`, `Chỉ hiển thị các dòng chứa từ khóa; có ít nhất 1 dòng`);
  t(`${P}-L04`, ucSearch, 'Tìm kiếm', `Tìm theo ${kwName.label} trả về đúng bản ghi`, 'Chức năng', 'Cao',
    `1. Nhập một ${kwName.label} có sẵn vào ô tìm kiếm`, `Chỉ hiển thị các dòng chứa từ khóa`);
  t(`${P}-L05`, ucSearch, 'Tìm kiếm', 'Từ khóa không tồn tại → không có dữ liệu', 'Chức năng', 'Cao',
    `1. Nhập "zzqcxx_khongtontai_999"`, 'Bảng rỗng / hiển thị trạng thái không có dữ liệu, không lỗi');
  t(`${P}-L06`, ucSearch, 'Tìm kiếm', 'Tìm kiếm không phân biệt chữ hoa/chữ thường', 'Chức năng', 'Trung bình',
    `1. Nhập từ khóa viết HOA rồi viết thường của cùng một giá trị`, 'Hai lần tìm trả về cùng số bản ghi');
  t(`${P}-L07`, ucSearch, 'Tìm kiếm', "Ký tự đặc biệt / chuỗi SQL trong ô tìm kiếm không gây lỗi hệ thống", 'Bảo mật', 'Cao',
    `1. Nhập  ' OR 1=1 --  và  <script>alert(1)</script>`, 'Không hiện lỗi 500/trắng trang, không thực thi script, không trả về toàn bộ dữ liệu bất thường');
  t(`${P}-L08`, ucList, 'Phân trang', 'Chuyển sang trang 2 hiển thị dữ liệu khác trang 1', 'Chức năng', 'Cao',
    `1. Bấm trang 2 trên thanh phân trang`, 'Trang 2 được đánh dấu active; nội dung bảng khác trang 1', 'Auto', perPageNote || '');
  t(`${P}-L09`, ucList, 'Phân trang', 'Đổi số bản ghi/trang sang 20 thì số dòng thay đổi theo', 'Chức năng', 'Trung bình',
    `1. Chọn "20 / trang" ở thanh phân trang`, 'Số dòng tối đa mỗi trang = 20; tổng số bản ghi không đổi', 'Auto', perPageNote || '');
  t(`${P}-L10`, ucSearch, 'Tìm kiếm', 'Xóa từ khóa thì danh sách trở về đầy đủ', 'Chức năng', 'Trung bình',
    `1. Tìm một từ khóa\n2. Xóa trắng ô tìm kiếm`, 'Danh sách hiển thị lại như ban đầu (tổng số bản ghi bằng lúc đầu)');
  if (!o.noExport) t(`${P}-L11`, ucExport, 'Export', `Xuất Excel danh sách ${name}`, 'Chức năng', 'Trung bình',
    `1. Bấm "Xuất Excel" ở trang ${name}`, 'Trình duyệt tải về file .xlsx chứa dữ liệu danh sách (UC: Xuất danh sách ra Excel)',
    o.exportAuto === false ? 'Auto' : 'Auto', o.exportNote || '');
}

// =============== A.II.1 NGƯỜI DÙNG ===============
listSuite('USR', 'Người dùng', { ucList: 'A.II.1-UC1', ucSearch: 'A.II.1-UC1', ucExport: 'A.II.1-UC2',
  cols: ['STT', 'Tên đăng nhập', 'Họ tên', 'Số điện thoại', 'Email', 'Đơn vị', 'Trạng thái', 'Thao tác'],
  kwCode: { label: 'tên đăng nhập' }, kwName: { label: 'họ tên' },
  exportNote: 'UC_1409 ghi FE "Chưa làm" → có thể FAIL (chức năng chưa phát triển)' });
t('USR-L12', 'A.II.1-UC1', 'Tìm kiếm', 'Tìm theo email', 'Chức năng', 'Cao', '1. Nhập email có sẵn vào ô tìm kiếm', 'Hiển thị đúng người dùng có email đó');
t('USR-L13', 'A.II.1-UC1', 'Bộ lọc', 'Lọc theo nhóm người dùng', 'Chức năng', 'Cao', '1. Chọn một nhóm ở bộ lọc nhóm', 'Chỉ còn người dùng thuộc nhóm đã chọn (số bản ghi ≤ ban đầu)');
t('USR-L14', 'A.II.1-UC1', 'Bộ lọc', 'Lọc theo trạng thái Đang hoạt động / Đã khóa', 'Chức năng', 'Cao', '1. Chọn trạng thái "Đã khóa" rồi "Đang hoạt động"', 'Mọi dòng kết quả có cột Trạng thái khớp với bộ lọc');
t('USR-L15', 'A.II.1-UC1', 'Bộ lọc', 'Kết hợp từ khóa và bộ lọc trạng thái', 'Chức năng', 'Trung bình', '1. Nhập từ khóa\n2. Chọn trạng thái', 'Kết quả thỏa mãn đồng thời cả từ khóa và trạng thái');

t('USR-V01', 'A.II.1-UC3', 'Xem chi tiết', 'Xem chi tiết hiển thị đầy đủ thông tin tài khoản', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" ở một người dùng', 'Hiển thị: tên đăng nhập, họ tên, email, SĐT, đơn vị, nhóm người dùng, trạng thái, ngày tạo');
t('USR-V02', 'A.II.1-UC3', 'Xem chi tiết', 'Nút Đóng thoát màn chi tiết', 'Chức năng', 'Thấp', '1. Mở chi tiết\n2. Bấm Đóng', 'Màn chi tiết đóng, quay lại danh sách');
t('USR-V03', 'A.II.1-UC3', 'Xem chi tiết', 'Từ chi tiết bấm Cập nhật mở form sửa với dữ liệu hiện tại', 'Chức năng', 'Trung bình', '1. Mở chi tiết\n2. Bấm Cập nhật', 'Form cập nhật mở, ô Tên/Email đã điền sẵn đúng giá trị của người dùng');

t('USR-C01', 'A.II.1-UC4', 'Thêm mới', 'Thêm người dùng đầy đủ thông tin thành công', 'Chức năng', 'Cao', '1. Bấm "Thêm mới người dùng"\n2. Nhập tên, SĐT, email, tên đăng nhập, mật khẩu hợp lệ\n3. Bỏ tích gửi email\n4. Lưu', 'Thông báo thành công; người dùng xuất hiện khi tìm theo tên đăng nhập; trạng thái Đang hoạt động');
t('USR-C02', 'A.II.1-UC4', 'Thêm mới', 'Thêm người dùng chỉ với trường bắt buộc (Tên, Email, Tên đăng nhập, Mật khẩu)', 'Chức năng', 'Cao', '1. Chỉ điền 4 trường bắt buộc\n2. Lưu', 'Tạo thành công');
t('USR-C03', 'A.II.1-UC4', 'Thêm mới', 'Chọn Đơn vị và Nhóm người dùng khi tạo', 'Chức năng', 'Cao', '1. Điền hợp lệ\n2. Chọn Đơn vị và Nhóm\n3. Lưu', 'Người dùng được tạo gắn đúng đơn vị và nhóm (kiểm chứng qua API/danh sách)');
t('USR-C04', 'A.II.1-UC4', 'Thêm mới', 'Bỏ trống toàn bộ trường bắt buộc thì báo lỗi từng trường', 'Validate', 'Cao', '1. Mở form\n2. Bấm Lưu khi chưa nhập', 'Hiện lỗi bắt buộc ở Tên, Email, Tên đăng nhập, Mật khẩu; không tạo bản ghi');
t('USR-C05', 'A.II.1-UC4', 'Thêm mới', 'Email sai định dạng bị chặn', 'Validate', 'Cao', '1. Nhập email "abc"\n2. Lưu', 'Báo "Email không đúng định dạng"; không tạo');
t('USR-C06', 'A.II.1-UC4', 'Thêm mới', 'Số điện thoại sai định dạng bị chặn', 'Validate', 'Trung bình', '1. Nhập SĐT "abc"\n2. Lưu', 'Báo "Số điện thoại không đúng định dạng"; không tạo');
t('USR-C07', 'A.II.1-UC4', 'Thêm mới', 'Mật khẩu không đạt quy tắc bảo mật bị chặn', 'Validate', 'Cao', '1. Nhập mật khẩu "123"\n2. Lưu', 'Báo "Mật khẩu chưa đáp ứng đủ các yêu cầu bảo mật"; không tạo');
t('USR-C08', 'A.II.1-UC4', 'Thêm mới', 'Trùng tên đăng nhập bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo user A\n2. Tạo user B cùng tên đăng nhập, email khác', 'Báo lỗi tên đăng nhập đã được sử dụng; không tạo bản ghi thứ hai');
t('USR-C09', 'A.II.1-UC4', 'Thêm mới', 'Trùng email bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo user A\n2. Tạo user B cùng email, tên đăng nhập khác', 'Báo lỗi email đã được sử dụng; không tạo bản ghi thứ hai');
t('USR-C10', 'A.II.1-UC4', 'Thêm mới', 'Hai checkbox "Bắt buộc đổi mật khẩu" và "Gửi thông tin đăng nhập qua email" mặc định được tích', 'UI', 'Thấp', '1. Mở form thêm mới', 'Cả hai checkbox ở trạng thái đã tích');
t('USR-C11', 'A.II.1-UC4', 'Thêm mới', 'Bỏ tích "Bắt buộc đổi mật khẩu" thì không bắt buộc đổi mật khẩu (bug UC)', 'Nghiệp vụ', 'Cao', '1. Bỏ tích "Bắt buộc đổi mật khẩu"\n2. Lưu\n3. Kiểm tra dữ liệu gửi đi và bản ghi', 'Request gửi isRequireChangePassword=false; bản ghi lưu không bắt buộc đổi mật khẩu', 'Auto', 'UC_1409 ghi bug: lỗi bắt buộc đổi mật khẩu dù không tích');
t('USR-C12', 'A.II.1-UC4', 'Thêm mới', 'Bỏ tích "Gửi thông tin đăng nhập qua email" thì không gửi mail', 'Nghiệp vụ', 'Trung bình', '1. Bỏ tích gửi email\n2. Lưu', 'Request gửi isRequestMailInfo=false');
t('USR-C13', 'A.II.1-UC4', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Điền dữ liệu\n2. Bấm Hủy\n3. Tìm tên đăng nhập đã nhập', 'Form đóng; không có bản ghi mới');
t('USR-C14', 'A.II.1-UC4', 'Thêm mới', 'Giới hạn độ dài trường tối đa 255 ký tự', 'Validate', 'Thấp', '1. Nhập 300 ký tự vào ô Tên', 'Ô chỉ nhận tối đa 255 ký tự');
t('USR-C15', 'A.II.1-UC4', 'Thêm mới', '[API] Server từ chối email sai định dạng', 'Bảo mật', 'Cao', '1. Gọi POST /idm/users với email "abc"', 'HTTP 400 – không tạo user (validate phía server)', 'Auto', 'Khảo sát: API hiện trả 200 → nghi lỗi thiếu validate server');
t('USR-C16', 'A.II.1-UC4', 'Thêm mới', '[API] Server từ chối mật khẩu không đạt quy tắc', 'Bảo mật', 'Cao', '1. Gọi POST /idm/users với mật khẩu 5 ký tự', 'HTTP 400 – không tạo user', 'Auto', 'Khảo sát: API hiện trả 200 → nghi lỗi thiếu validate server');
t('USR-C17', 'A.II.1-UC4', 'Thêm mới', '[API] Tên rỗng trả lỗi 4xx có thông báo, không phải 500', 'Bảo mật', 'Trung bình', '1. Gọi POST /idm/users với name rỗng', 'HTTP 400 có thông báo rõ ràng, không lộ stacktrace', 'Auto', 'Khảo sát: API hiện trả 500 + stacktrace → nghi lỗi');
t('USR-C18', 'A.II.1-UC4', 'Thêm mới', 'Đăng nhập bằng tài khoản vừa tạo', 'Chức năng', 'Cao', '1. Tạo user\n2. Đăng nhập (captcha)', 'Đăng nhập được; nếu bắt buộc đổi mật khẩu thì yêu cầu đổi', 'Manual', 'Đăng nhập có captcha – không tự động hóa được');

t('USR-E01', 'A.II.1-UC5', 'Chỉnh sửa', 'Sửa họ tên thành công', 'Chức năng', 'Cao', '1. Chọn Cập nhật ở user\n2. Đổi họ tên\n3. Lưu', 'Thông báo thành công; danh sách hiển thị họ tên mới');
t('USR-E02', 'A.II.1-UC5', 'Chỉnh sửa', 'Sửa số điện thoại thành công', 'Chức năng', 'Trung bình', '1. Đổi SĐT hợp lệ\n2. Lưu', 'SĐT mới được lưu');
t('USR-E03', 'A.II.1-UC5', 'Chỉnh sửa', 'Đổi nhóm người dùng (mỗi người chỉ thuộc 1 nhóm)', 'Nghiệp vụ', 'Cao', '1. Gán user vào nhóm X\n2. Đổi sang nhóm Y', 'User chỉ thuộc nhóm Y; không còn ở nhóm X');
t('USR-E04', 'A.II.1-UC5', 'Chỉnh sửa', 'Sửa email thành email của người khác bị từ chối', 'Nghiệp vụ', 'Cao', '1. Đổi email sang email đã có\n2. Lưu', 'Báo lỗi email đã được sử dụng; dữ liệu không đổi');
t('USR-E05', 'A.II.1-UC5', 'Chỉnh sửa', 'Sửa email sai định dạng bị chặn', 'Validate', 'Trung bình', '1. Nhập email "abc"\n2. Lưu', 'Báo lỗi định dạng; không lưu');
t('USR-E06', 'A.II.1-UC5', 'Chỉnh sửa', 'Bỏ trống Họ tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa trắng họ tên\n2. Lưu', 'Báo lỗi bắt buộc; không lưu');
t('USR-E07', 'A.II.1-UC5', 'Chỉnh sửa', 'Hủy chỉnh sửa không thay đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi họ tên\n2. Bấm Hủy', 'Dữ liệu giữ nguyên');
t('USR-E08', 'A.II.1-UC5', 'Chỉnh sửa', 'Để trống mật khẩu mới thì không đổi mật khẩu', 'Nghiệp vụ', 'Trung bình', '1. Sửa họ tên, bỏ trống "Mật khẩu mới"\n2. Lưu', 'Lưu thành công; mật khẩu không bị thay đổi', 'Manual', 'Cần đăng nhập (captcha) để kiểm chứng mật khẩu');

t('USR-E09', 'A.II.1-UC5', 'Chỉnh sửa', 'Tên đăng nhập không được sửa (khóa chỉ-đọc) ở form cập nhật', 'Nghiệp vụ', 'Trung bình', '1. Mở form Cập nhật người dùng', 'Ô Tên đăng nhập bị vô hiệu hóa, không nhập được');
t('USR-X01', 'A.II.1 (bổ sung)', 'Khóa/Mở khóa', 'Khóa người dùng chuyển trạng thái Đã khóa', 'Chức năng', 'Cao', '1. Menu thao tác → Khoá\n2. Xác nhận', 'Trạng thái chuyển thành "Đã khóa"');
t('USR-X02', 'A.II.1 (bổ sung)', 'Khóa/Mở khóa', 'Mở khóa người dùng chuyển lại Đang hoạt động', 'Chức năng', 'Cao', '1. Với user đã khóa: Menu → Mở khoá', 'Trạng thái chuyển thành "Đang hoạt động"');
t('USR-X03', 'A.II.1 (bổ sung)', 'Khóa/Mở khóa', 'Người dùng đã khóa xuất hiện khi lọc "Đã khóa" và biến mất khi lọc "Đang hoạt động"', 'Nghiệp vụ', 'Trung bình', '1. Khóa user\n2. Lọc theo trạng thái', 'Hiển thị đúng theo bộ lọc');
t('USR-X04', 'A.II.1 (bổ sung)', 'Xóa', 'Xóa người dùng thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận "Có"', 'Người dùng không còn trong danh sách');
t('USR-X05', 'A.II.1 (bổ sung)', 'Xóa', 'Chọn "Không" ở hộp xác nhận xóa thì giữ nguyên bản ghi', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Bấm "Không"', 'Bản ghi vẫn còn');
t('USR-S01', 'A.II.1-UC1', 'Phân quyền', 'API danh sách người dùng: không token → 401, token giả → 401', 'Bảo mật', 'Cao', '1. Gọi GET /idm/users không token / token giả', 'HTTP 401');
t('USR-S02', 'A.II.1-UC1', 'Phân quyền', 'Chưa đăng nhập vào trang Người dùng bị chuyển về màn đăng nhập', 'Bảo mật', 'Cao', '1. Mở /#/vi/users khi chưa đăng nhập', 'Hiển thị màn đăng nhập, không lộ dữ liệu');
t('USR-S03', 'A.II.1-UC4', 'Phân quyền', 'Quyền thực thi API đúng theo ma trận quyền của vai trò Cán bộ', 'Bảo mật', 'Cao', '1. Lấy ma trận quyền của canbo\n2. Gọi GET/POST/DELETE /idm/users', 'Có quyền → không bị 401/403; không có quyền → 403');
t('USR-P01', 'A.II.1-UC1', 'Hiệu năng', 'Danh sách người dùng tải < 3 giây', 'Hiệu năng', 'Trung bình', '1. Mở trang và đo thời gian API & hiển thị', 'API < 3000ms, hiển thị dữ liệu < 6000ms');

// =============== A.II.2 NHÓM NGƯỜI DÙNG ===============
listSuite('GRP', 'Nhóm người dùng', { ucList: 'A.II.2-UC1', ucSearch: 'A.II.2-UC1', ucExport: 'A.II.2-UC2',
  cols: ['STT', 'Mã nhóm người dùng', 'Tên nhóm người dùng', 'Mô tả', 'Thành viên', 'Thao tác'],
  kwCode: { label: 'mã nhóm' }, kwName: { label: 'tên nhóm' },
  exportNote: 'Trang danh sách không có nút Xuất Excel (chỉ có ở màn chi tiết nhóm); UC_1409 ghi FE "Chưa làm"' });
t('GRP-L12', 'A.II.2-UC1', 'Xem danh sách', 'Cột Thành viên hiển thị số lượng khớp với danh sách thành viên trong chi tiết', 'Nghiệp vụ', 'Trung bình', '1. Ghi số thành viên của một nhóm\n2. Mở chi tiết nhóm', 'Số trên danh sách = số bản ghi ở bảng Thành viên');
t('GRP-V01', 'A.II.2-UC3', 'Xem chi tiết', 'Chi tiết nhóm hiển thị Mã, Tên, Mô tả và bảng Thành viên', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" ở một nhóm', 'Hiển thị mã, tên, mô tả; bảng thành viên có cột Tên đăng nhập, Họ tên, Email, Ngày thêm, Trạng thái');
t('GRP-V02', 'A.II.2-UC7', 'Xem thành viên', 'Lọc thành viên theo trạng thái trong chi tiết nhóm', 'Chức năng', 'Trung bình', '1. Mở chi tiết nhóm\n2. Đổi bộ lọc trạng thái', 'Bảng thành viên chỉ còn trạng thái đã chọn');
t('GRP-V03', 'A.II.2-UC2', 'Export', 'Xuất Excel thành viên ở chi tiết nhóm', 'Chức năng', 'Thấp', '1. Mở chi tiết nhóm\n2. Bấm Xuất Excel', 'Tải về file .xlsx', 'Auto', 'UC_1409 ghi FE "Chưa làm"');
t('GRP-C01', 'A.II.2-UC4', 'Thêm mới', 'Thêm nhóm đầy đủ Mã, Tên, Mô tả thành công', 'Chức năng', 'Cao', '1. Bấm "Thêm mới nhóm người dùng"\n2. Nhập mã, tên, mô tả\n3. Lưu', 'Thông báo thành công; nhóm xuất hiện trong danh sách');
t('GRP-C02', 'A.II.2-UC4', 'Thêm mới', 'Thêm nhóm chỉ với Mã và Tên', 'Chức năng', 'Trung bình', '1. Chỉ nhập mã & tên\n2. Lưu', 'Tạo thành công, mô tả để trống');
t('GRP-C03', 'A.II.2-UC4', 'Thêm mới', 'Bỏ trống Mã/Tên thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc ở Mã nhóm và Tên nhóm; không tạo');
t('GRP-C04', 'A.II.2-UC4', 'Thêm mới', 'Trùng mã nhóm bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo nhóm A\n2. Tạo nhóm B cùng mã', 'Báo "Code ... đã tồn tại"; chỉ có 1 bản ghi');
t('GRP-C05', 'A.II.2-UC4', 'Thêm mới', 'Hủy form thêm mới không tạo nhóm', 'Chức năng', 'Trung bình', '1. Nhập mã tên\n2. Hủy', 'Không có nhóm mới');
t('GRP-C06', 'A.II.2-UC4', 'Thêm mới', '[API] Server từ chối tên nhóm rỗng', 'Bảo mật', 'Trung bình', '1. POST /idm/roles với name rỗng', 'HTTP 400 – không tạo nhóm', 'Auto', 'Khảo sát: API hiện trả 200 → nghi lỗi thiếu validate server');
t('GRP-E01', 'A.II.2-UC5', 'Chỉnh sửa', 'Sửa tên nhóm thành công', 'Chức năng', 'Cao', '1. Menu → Cập nhật\n2. Đổi tên\n3. Lưu', 'Thông báo thành công; tên mới hiển thị');
t('GRP-E02', 'A.II.2-UC5', 'Chỉnh sửa', 'Sửa mô tả nhóm thành công', 'Chức năng', 'Trung bình', '1. Đổi mô tả\n2. Lưu', 'Mô tả mới được lưu và hiển thị ở chi tiết');
t('GRP-E03', 'A.II.2-UC5', 'Chỉnh sửa', 'Xóa trắng tên nhóm khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc; không lưu');
t('GRP-E04', 'A.II.2-UC5', 'Chỉnh sửa', 'Hủy chỉnh sửa không thay đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Hủy', 'Dữ liệu giữ nguyên');
t('GRP-D01', 'A.II.2-UC6', 'Xóa', 'Xóa nhóm không có thành viên thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Nhóm biến mất khỏi danh sách');
t('GRP-D02', 'A.II.2-UC6', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên nhóm', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Bấm Không', 'Nhóm vẫn còn');
t('GRP-D03', 'A.II.2-UC6', 'Xóa', 'Xóa nhóm đang có thành viên', 'Nghiệp vụ', 'Cao', '1. Gán 1 user vào nhóm\n2. Xóa nhóm', 'Hệ thống chặn xóa (hoặc cảnh báo) để không làm người dùng mất nhóm', 'Auto', 'Khảo sát: API hiện cho xóa (200) → nghi lỗi nghiệp vụ, cần BA xác nhận');
t('GRP-M01', 'A.II.2-UC9', 'Thêm thành viên', 'Thêm người dùng vào nhóm qua màn chi tiết nhóm', 'Chức năng', 'Cao', '1. Chi tiết nhóm → "Thêm người dùng vào nhóm"\n2. Tìm & tích user\n3. Lưu', 'User xuất hiện trong bảng thành viên; cột Thành viên tăng 1');
t('GRP-M02', 'A.II.2-UC9', 'Thêm thành viên', 'Mỗi người dùng chỉ thuộc 1 nhóm: chuyển user từ nhóm A sang nhóm B', 'Nghiệp vụ', 'Cao', '1. User đang ở nhóm A\n2. Thêm user vào nhóm B', 'User chỉ còn thuộc nhóm B (bị chặn hoặc chuyển nhóm), không thuộc đồng thời 2 nhóm');
t('GRP-M03', 'A.II.2-UC9', 'Thêm thành viên', 'Người dùng đã trong nhóm không thể chọn lại ở màn thêm', 'Nghiệp vụ', 'Trung bình', '1. Mở màn thêm người dùng vào nhóm có sẵn thành viên', 'User đã trong nhóm bị vô hiệu / ẩn, không tích chọn được');
t('GRP-M04', 'A.II.2-UC9', 'Thêm thành viên', 'Tìm người dùng trong màn thêm theo tên đăng nhập / họ tên', 'Chức năng', 'Trung bình', '1. Nhập từ khóa vào ô tìm ở màn thêm', 'Danh sách ứng viên lọc theo từ khóa');
t('GRP-M05', 'A.II.2-UC9', 'Thêm thành viên', 'Thêm nhiều người dùng cùng lúc', 'Chức năng', 'Trung bình', '1. Tích 2 user\n2. Lưu', 'Cả 2 user vào nhóm; số thành viên tăng 2');
t('GRP-M06', 'A.II.2-UC9', 'Thêm thành viên', 'Bấm Lưu khi chưa chọn user nào', 'Validate', 'Thấp', '1. Mở màn thêm\n2. Bấm Lưu ngay', 'Không thêm; có thông báo/nút không hoạt động, không lỗi hệ thống');
t('GRP-M07', 'A.II.2-UC8', 'Xóa thành viên', 'Xóa người dùng khỏi nhóm', 'Chức năng', 'Cao', '1. Trong chi tiết nhóm chọn thành viên\n2. Xóa khỏi nhóm', 'Thành viên biến mất; số thành viên giảm; user vẫn tồn tại ở trang Người dùng');
t('GRP-S01', 'A.II.2-UC1', 'Phân quyền', 'API nhóm người dùng: không token / token giả → 401', 'Bảo mật', 'Cao', '1. GET /idm/roles không token', 'HTTP 401');
t('GRP-S02', 'A.II.2-UC4', 'Phân quyền', 'Quyền thực thi API nhóm đúng theo ma trận quyền Cán bộ', 'Bảo mật', 'Cao', '1. Lấy ma trận quyền của canbo\n2. Gọi GET/POST /idm/roles', 'Có quyền ROLE.* → được; không có → 403');
t('GRP-P01', 'A.II.2-UC1', 'Hiệu năng', 'Danh sách nhóm tải < 3 giây', 'Hiệu năng', 'Trung bình', '1. Mở trang và đo', 'API < 3000ms, hiển thị < 6000ms');

// =============== A.IV.1 ĐƠN VỊ HÀNH CHÍNH CẤP TỈNH ===============
listSuite('PRV', 'Đơn vị hành chính cấp tỉnh', { ucList: 'A.IV.1-UC1', ucSearch: 'A.IV.1-UC6', ucExport: 'A.IV.1-UC7',
  cols: ['STT', 'Mã tỉnh/thành', 'Tên tỉnh/thành', 'Số đơn vị', 'Thao tác'],
  kwCode: { label: 'mã tỉnh/thành' }, kwName: { label: 'tên tỉnh/thành' },
  exportNote: 'UC_1409 ghi FE "Chưa làm" → có thể FAIL (chức năng chưa phát triển)' });
t('PRV-V01', 'A.IV.1-UC5', 'Xem chi tiết', 'Chi tiết tỉnh hiển thị thông tin và danh sách đơn vị thuộc tỉnh', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" ở một tỉnh có đơn vị', 'Hiển thị mã, tên tỉnh và bảng đơn vị thuộc tỉnh; có nút Chỉnh sửa, Thêm mới đơn vị vào tỉnh, Mở module Đơn vị');
t('PRV-V02', 'A.IV.1-UC5', 'Xem chi tiết', 'Cột "Số đơn vị" khớp với số đơn vị trong màn chi tiết', 'Nghiệp vụ', 'Trung bình', '1. Ghi Số đơn vị của tỉnh\n2. Mở chi tiết', 'Số bản ghi đơn vị trong chi tiết = Số đơn vị');
t('PRV-V03', 'A.IV.1-UC3', 'Xem chi tiết', 'Nút "Chỉnh sửa" ở chi tiết mở form cập nhật', 'Chức năng', 'Trung bình', '1. Mở chi tiết tỉnh\n2. Bấm Chỉnh sửa', 'Form cập nhật mở với dữ liệu hiện tại');
t('PRV-C01', 'A.IV.1-UC2', 'Thêm mới', 'Thêm tỉnh/thành thành công', 'Chức năng', 'Cao', '1. Bấm "Thêm mới tỉnh/thành"\n2. Nhập mã, tên hợp lệ\n3. Lưu', 'Thông báo thành công; tỉnh xuất hiện trong danh sách với Số đơn vị = 0');
t('PRV-C02', 'A.IV.1-UC2', 'Thêm mới', 'Bỏ trống Mã/Tên thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc; không tạo');
t('PRV-C03', 'A.IV.1-UC2', 'Thêm mới', 'Trùng mã tỉnh bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo tỉnh A\n2. Tạo tỉnh B cùng mã', 'Báo "Mã tỉnh đã tồn tại"; chỉ 1 bản ghi');
t('PRV-C04', 'A.IV.1-UC2', 'Thêm mới', 'Mã tỉnh dài hơn 10 ký tự bị chặn', 'Validate', 'Trung bình', '1. Nhập mã 11 ký tự\n2. Lưu', 'Báo "Không được nhập vượt quá 10 ký tự"; không tạo');
t('PRV-C05', 'A.IV.1-UC2', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Nhập mã tên\n2. Hủy', 'Không có tỉnh mới');
t('PRV-C06', 'A.IV.1-UC2', 'Thêm mới', 'Trùng tên tỉnh (khác mã)', 'Nghiệp vụ', 'Thấp', '1. Tạo tỉnh A\n2. Tạo tỉnh B khác mã, trùng tên', 'Hệ thống cảnh báo/từ chối tên trùng', 'Auto', 'Khảo sát: API hiện cho tạo trùng tên → cần BA xác nhận quy tắc');
t('PRV-E01', 'A.IV.1-UC3', 'Chỉnh sửa', 'Sửa tên tỉnh thành công', 'Chức năng', 'Cao', '1. Menu → Cập nhật\n2. Đổi tên\n3. Lưu', 'Thông báo thành công; tên mới hiển thị');
t('PRV-E02', 'A.IV.1-UC3', 'Chỉnh sửa', 'Mã tỉnh không đổi sau khi sửa tên', 'Nghiệp vụ', 'Trung bình', '1. Sửa tên\n2. Kiểm tra mã', 'Mã giữ nguyên');
t('PRV-E03', 'A.IV.1-UC3', 'Chỉnh sửa', 'Xóa trắng tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc; không lưu');
t('PRV-E04', 'A.IV.1-UC3', 'Chỉnh sửa', 'Hủy chỉnh sửa không đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Hủy', 'Dữ liệu giữ nguyên');
t('PRV-D01', 'A.IV.1-UC4', 'Xóa', 'Xóa tỉnh chưa có đơn vị thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Tỉnh biến mất khỏi danh sách');
t('PRV-D02', 'A.IV.1-UC4', 'Xóa', 'Xóa tỉnh đang có đơn vị tham chiếu bị chặn', 'Nghiệp vụ', 'Cao', '1. Tạo tỉnh, tạo đơn vị tham chiếu tỉnh\n2. Xóa tỉnh', 'Báo "Không thể xóa: đang có đơn vị thuộc tỉnh này"; tỉnh còn nguyên');
t('PRV-D03', 'A.IV.1-UC4', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Không', 'Tỉnh vẫn còn');
t('PRV-S01', 'A.IV.1-UC1', 'Phân quyền', 'API tỉnh: không token / token giả → 401', 'Bảo mật', 'Cao', '1. GET /provinces không token', 'HTTP 401');
t('PRV-S02', 'A.IV.1-UC2', 'Phân quyền', 'Quyền API tỉnh đúng theo ma trận quyền Cán bộ (không có PROVINCE.* → 403)', 'Bảo mật', 'Cao', '1. Lấy ma trận quyền canbo\n2. GET/POST/PUT/DELETE /provinces', 'Không có quyền → 403 cho mọi thao tác');
t('PRV-P01', 'A.IV.1-UC1', 'Hiệu năng', 'Danh sách tỉnh tải < 3 giây', 'Hiệu năng', 'Trung bình', '1. Mở trang và đo', 'API < 3000ms, hiển thị < 6000ms');

// =============== A.IV.2 ĐƠN VỊ HÀNH CHÍNH CẤP XÃ ===============
listSuite('COM', 'Đơn vị hành chính cấp xã', { ucList: 'A.IV.2-UC1', ucSearch: 'A.IV.2-UC6', ucExport: 'A.IV.2-UC7',
  cols: ['STT', 'Mã xã', 'Tên xã/phường', 'Tỉnh/thành trực thuộc', 'Số đơn vị', 'Thao tác'],
  kwCode: { label: 'mã xã' }, kwName: { label: 'tên xã/phường' },
  exportNote: 'UC_1409 ghi FE "Chưa làm" → có thể FAIL (chức năng chưa phát triển)' });
t('COM-L12', 'A.IV.2-UC1', 'Bộ lọc', 'Lọc theo tỉnh/thành trực thuộc', 'Chức năng', 'Cao', '1. Chọn một tỉnh ở bộ lọc', 'Mọi dòng kết quả có cột Tỉnh/thành trực thuộc = tỉnh đã chọn');
t('COM-V01', 'A.IV.2-UC5', 'Xem chi tiết', 'Chi tiết xã hiển thị thông tin và danh sách đơn vị thuộc xã', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" ở một xã', 'Hiển thị mã, tên, tỉnh trực thuộc và bảng đơn vị; có nút Chỉnh sửa, Thêm mới đơn vị vào xã');
t('COM-C01', 'A.IV.2-UC2', 'Thêm mới', 'Thêm xã/phường thành công (có chọn tỉnh)', 'Chức năng', 'Cao', '1. Bấm "Thêm mới xã/phường"\n2. Nhập mã, tên, chọn tỉnh\n3. Lưu', 'Thông báo thành công; xã xuất hiện trong danh sách, đúng tỉnh trực thuộc');
t('COM-C02', 'A.IV.2-UC2', 'Thêm mới', 'Bỏ trống Mã/Tên thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc; không tạo');
t('COM-C03', 'A.IV.2-UC2', 'Thêm mới', 'Trùng mã xã bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo xã A\n2. Tạo xã B cùng mã', 'Báo "Mã xã đã tồn tại"; chỉ 1 bản ghi');
t('COM-C04', 'A.IV.2-UC2', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Nhập dữ liệu\n2. Hủy', 'Không có xã mới');
t('COM-C05', 'A.IV.2-UC2', 'Thêm mới', 'Thêm xã không chọn tỉnh', 'Nghiệp vụ', 'Trung bình', '1. Nhập mã tên, bỏ trống tỉnh\n2. Lưu', 'Theo UC: Tỉnh là thuộc tính của xã – hệ thống xử lý nhất quán (bắt buộc hoặc cho phép trống) và không lỗi', 'Auto', 'UC_1409 chưa nêu rõ tỉnh có bắt buộc không – cần BA xác nhận');
t('COM-E01', 'A.IV.2-UC3', 'Chỉnh sửa', 'Sửa tên xã thành công', 'Chức năng', 'Cao', '1. Menu → Cập nhật\n2. Đổi tên\n3. Lưu', 'Thông báo thành công; tên mới hiển thị');
t('COM-E02', 'A.IV.2-UC3', 'Chỉnh sửa', 'Đổi tỉnh trực thuộc của xã', 'Chức năng', 'Trung bình', '1. Cập nhật → chọn tỉnh khác\n2. Lưu', 'Cột Tỉnh/thành trực thuộc đổi theo');
t('COM-E03', 'A.IV.2-UC3', 'Chỉnh sửa', 'Xóa trắng tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc; không lưu');
t('COM-E04', 'A.IV.2-UC3', 'Chỉnh sửa', 'Hủy chỉnh sửa không đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Hủy', 'Dữ liệu giữ nguyên');
t('COM-D01', 'A.IV.2-UC4', 'Xóa', 'Xóa xã chưa có đơn vị thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Xã biến mất khỏi danh sách');
t('COM-D02', 'A.IV.2-UC4', 'Xóa', 'Xóa xã đang có đơn vị tham chiếu bị chặn', 'Nghiệp vụ', 'Cao', '1. Tạo xã, gắn đơn vị tham chiếu xã\n2. Xóa xã', 'Báo không thể xóa vì đang có đơn vị; xã còn nguyên');
t('COM-D03', 'A.IV.2-UC4', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Không', 'Xã vẫn còn');
t('COM-R01', 'A.IV.2-UC8', 'Tham chiếu', 'Thiết lập tham chiếu đơn vị đến xã từ chi tiết xã', 'Chức năng', 'Cao', '1. Chi tiết xã → "Thêm mới đơn vị vào xã"\n2. Chọn đơn vị\n3. Lưu', 'Đơn vị xuất hiện trong bảng đơn vị của xã; Số đơn vị tăng 1');
t('COM-R02', 'A.IV.2-UC9', 'Tham chiếu', 'Hủy tham chiếu đơn vị khỏi xã', 'Chức năng', 'Cao', '1. Trong chi tiết xã, hủy tham chiếu đơn vị', 'Đơn vị biến mất khỏi bảng; Số đơn vị giảm 1', 'Auto', 'Cần xác nhận thao tác trên UI');
t('COM-S01', 'A.IV.2-UC1', 'Phân quyền', 'API xã: không token / token giả → 401', 'Bảo mật', 'Cao', '1. GET /communes không token', 'HTTP 401');
t('COM-S02', 'A.IV.2-UC2', 'Phân quyền', 'Quyền API xã đúng theo ma trận quyền Cán bộ', 'Bảo mật', 'Cao', '1. Lấy ma trận quyền canbo\n2. GET/POST /communes', 'Có quyền → được; không → 403');
t('COM-P01', 'A.IV.2-UC1', 'Hiệu năng', 'Danh sách xã tải < 3 giây', 'Hiệu năng', 'Trung bình', '1. Mở trang và đo', 'API < 3000ms, hiển thị < 6000ms');

// =============== A.IV.3 LOẠI ĐƠN VỊ ===============
listSuite('UTY', 'Loại đơn vị', { ucList: 'A.IV.3-UC1', ucSearch: 'A.IV.3-UC1', ucExport: 'A.IV.3-UC2',
  cols: ['STT', 'Mã loại đơn vị', 'Tên loại đơn vị', 'Cấp', 'Số đơn vị', 'Thao tác'],
  kwCode: { label: 'mã loại đơn vị' }, kwName: { label: 'tên loại đơn vị' } });
t('UTY-L12', 'A.IV.3-UC1', 'Bộ lọc', 'Lọc theo cấp hành chính (Trung ương / Cấp tỉnh / Cấp xã)', 'Chức năng', 'Cao', '1. Chọn cấp ở bộ lọc', 'Mọi dòng kết quả có cột Cấp = giá trị đã chọn');
t('UTY-V01', 'A.IV.3-UC3', 'Xem chi tiết', 'Chi tiết loại đơn vị hiển thị thông tin và danh sách đơn vị thuộc loại', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" một loại', 'Hiển thị Mã loại, Cấp hành chính, Mô tả, Số đơn vị, Cập nhật lần cuối và bảng đơn vị thuộc loại; có nút Cập nhật, Thêm mới đơn vị, Xuất Excel');
t('UTY-V02', 'A.IV.3-UC3', 'Xem chi tiết', 'Số đơn vị trong chi tiết khớp với số dòng ở bảng đơn vị', 'Nghiệp vụ', 'Trung bình', '1. Mở chi tiết', 'Số trong tiêu đề "ĐƠN VỊ THUỘC LOẠI - N" = số dòng bảng');
t('UTY-C01', 'A.IV.3-UC4', 'Thêm mới', 'Thêm loại đơn vị thành công (mã, tên, cấp hành chính, mô tả)', 'Chức năng', 'Cao', '1. Bấm "Thêm mới loại đơn vị"\n2. Nhập đủ\n3. Lưu', 'Thông báo thành công; xuất hiện trong danh sách với Số đơn vị = 0');
t('UTY-C02', 'A.IV.3-UC4', 'Thêm mới', 'Bỏ trống Mã/Tên/Cấp hành chính thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc ở các trường; không tạo');
t('UTY-C03', 'A.IV.3-UC4', 'Thêm mới', 'Trùng mã loại đơn vị bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo loại A\n2. Tạo loại B cùng mã', 'Báo "Mã loại đơn vị đã tồn tại"; chỉ 1 bản ghi');
t('UTY-C04', 'A.IV.3-UC4', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Nhập dữ liệu\n2. Hủy', 'Không có loại mới');
t('UTY-C05', 'A.IV.3-UC4', 'Thêm mới', 'Chọn từng cấp hành chính (Trung ương/Cấp tỉnh/Cấp xã) đều lưu đúng', 'Chức năng', 'Trung bình', '1. Tạo 3 loại với 3 cấp', 'Cột Cấp hiển thị đúng từng giá trị');
t('UTY-E01', 'A.IV.3-UC5', 'Chỉnh sửa', 'Sửa tên loại đơn vị thành công', 'Chức năng', 'Cao', '1. Menu → Cập nhật\n2. Đổi tên\n3. Lưu', 'Thông báo thành công; tên mới hiển thị');
t('UTY-E02', 'A.IV.3-UC5', 'Chỉnh sửa', 'Sửa cấp hành chính và mô tả', 'Chức năng', 'Trung bình', '1. Đổi cấp và mô tả\n2. Lưu', 'Cột Cấp đổi theo; mô tả hiển thị ở chi tiết');
t('UTY-E03', 'A.IV.3-UC5', 'Chỉnh sửa', 'Xóa trắng tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc; không lưu');
t('UTY-E04', 'A.IV.3-UC5', 'Chỉnh sửa', 'Hủy chỉnh sửa không đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Hủy', 'Dữ liệu giữ nguyên');
t('UTY-D01', 'A.IV.3-UC6', 'Xóa', 'Xóa loại đơn vị chưa có đơn vị thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Loại biến mất khỏi danh sách');
t('UTY-D02', 'A.IV.3-UC6', 'Xóa', 'Xóa loại đang có đơn vị bị chặn', 'Nghiệp vụ', 'Cao', '1. Tạo loại + đơn vị thuộc loại\n2. Xóa loại', 'Báo "Không thể xóa: đang có đơn vị thuộc loại này"; loại còn nguyên');
t('UTY-D03', 'A.IV.3-UC6', 'Xóa', 'Menu của loại đang có đơn vị không có mục Xoá', 'UI', 'Trung bình', '1. Mở menu thao tác của loại đang có đơn vị', 'Không hiển thị "Xoá" (chỉ Cập nhật)');
t('UTY-D04', 'A.IV.3-UC6', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Không', 'Loại vẫn còn');
t('UTY-S01', 'A.IV.3-UC1', 'Phân quyền', 'API loại đơn vị: không token / token giả → 401', 'Bảo mật', 'Cao', '1. GET /unit-types không token', 'HTTP 401');
t('UTY-S02', 'A.IV.3-UC4', 'Phân quyền', 'Quyền API loại đơn vị đúng theo ma trận quyền Cán bộ', 'Bảo mật', 'Cao', '1. Lấy ma trận quyền canbo\n2. GET/POST /unit-types', 'Có quyền → được; không → 403');
t('UTY-P01', 'A.IV.3-UC1', 'Hiệu năng', 'Danh sách loại đơn vị tải < 3 giây', 'Hiệu năng', 'Trung bình', '1. Mở trang và đo', 'API < 3000ms, hiển thị < 6000ms');

// =============== A.IV.4 ĐƠN VỊ ===============
listSuite('ORG', 'Đơn vị', { ucList: 'A.IV.4-UC1', ucSearch: 'A.IV.4-UC1', ucExport: 'A.IV.4-UC2',
  cols: ['STT', 'Mã đơn vị', 'Tên đơn vị', 'Loại đơn vị', 'Tỉnh/thành tham chiếu', 'Số lượng thành viên', 'Trạng thái', 'Thao tác'],
  kwCode: { label: 'mã đơn vị' }, kwName: { label: 'tên đơn vị' },
  exportNote: 'UC_1409 ghi FE "Chưa làm" → có thể FAIL (chức năng chưa phát triển)' });
t('ORG-L12', 'A.IV.4-UC1', 'Bộ lọc', 'Lọc theo loại đơn vị', 'Chức năng', 'Cao', '1. Chọn một loại đơn vị ở bộ lọc', 'Mọi dòng có cột Loại đơn vị = loại đã chọn');
t('ORG-L13', 'A.IV.4-UC1', 'Bộ lọc', 'Lọc theo tỉnh/thành tham chiếu', 'Chức năng', 'Cao', '1. Chọn một tỉnh ở bộ lọc', 'Mọi dòng có Tỉnh/thành tham chiếu = tỉnh đã chọn');
t('ORG-V01', 'A.IV.4-UC3', 'Xem chi tiết', 'Chi tiết đơn vị hiển thị loại, tỉnh tham chiếu, số người dùng, kỳ đánh giá hiện tại', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" một đơn vị', 'Hiển thị tên, mã, trạng thái, Loại đơn vị, Tham chiếu tỉnh, số Người dùng và bảng "Người dùng trong đơn vị"; có nút Thêm người dùng vào đơn vị, Đổi tỉnh, Bỏ tham chiếu');
t('ORG-V02', 'A.IV.4-UC9', 'Người dùng trong đơn vị', 'Bảng người dùng trong đơn vị có cột Tên đăng nhập, Họ tên, Vai trò, Email, Trạng thái và lọc theo vai trò', 'Chức năng', 'Trung bình', '1. Mở chi tiết đơn vị có người dùng\n2. Lọc theo vai trò', 'Bảng lọc đúng theo vai trò');
t('ORG-C01', 'A.IV.4-UC4', 'Thêm mới', 'Thêm đơn vị thành công với Mã, Tên, Loại đơn vị', 'Chức năng', 'Cao', '1. Bấm "Thêm mới đơn vị"\n2. Nhập mã, tên, chọn loại\n3. Lưu', 'Thông báo thành công; đơn vị xuất hiện, trạng thái Chưa khóa');
t('ORG-C02', 'A.IV.4-UC4', 'Thêm mới', 'Bỏ trống Mã/Tên/Loại đơn vị thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc ở 3 trường; không tạo');
t('ORG-C03', 'A.IV.4-UC4', 'Thêm mới', 'Bỏ trống riêng Loại đơn vị thì báo lỗi', 'Validate', 'Cao', '1. Nhập mã, tên, bỏ trống loại\n2. Lưu', 'Báo lỗi bắt buộc ở Loại đơn vị; không tạo');
t('ORG-C04', 'A.IV.4-UC4', 'Thêm mới', 'Trùng mã đơn vị bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo đơn vị A\n2. Tạo đơn vị B cùng mã', 'Báo mã đã tồn tại; chỉ 1 bản ghi');
t('ORG-C05', 'A.IV.4-UC4', 'Thêm mới', 'Thêm đơn vị con (chọn Đơn vị cha)', 'Chức năng', 'Cao', '1. Tạo đơn vị cha\n2. Tạo đơn vị con chọn đơn vị cha', 'Đơn vị con tạo thành công, gắn đúng đơn vị cha');
t('ORG-C06', 'A.IV.4-UC4', 'Thêm mới', 'Thêm đơn vị có tham chiếu tỉnh/thành', 'Chức năng', 'Cao', '1. Tạo đơn vị, chọn tỉnh tham chiếu', 'Cột Tỉnh/thành tham chiếu hiển thị đúng tỉnh');
t('ORG-C07', 'A.IV.4-UC4', 'Thêm mới', 'Email đơn vị sai định dạng bị chặn', 'Validate', 'Trung bình', '1. Nhập email "abc"\n2. Lưu', 'Báo lỗi định dạng email; không tạo');
t('ORG-C09', 'A.IV.4-UC4', 'Thêm mới', 'Chỉ đơn vị thuộc loại cấp xã mới được tham chiếu xã/phường', 'Nghiệp vụ', 'Trung bình', '1. [API] Tạo đơn vị loại cấp tỉnh kèm communeId', 'Bị từ chối: "Chỉ đơn vị thuộc loại cấp xã mới tham chiếu đơn vị hành chính cấp xã"');
t('ORG-C08', 'A.IV.4-UC4', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Nhập dữ liệu\n2. Hủy', 'Không có đơn vị mới');
t('ORG-E01', 'A.IV.4-UC5', 'Chỉnh sửa', 'Sửa tên đơn vị thành công', 'Chức năng', 'Cao', '1. Menu → Cập nhật\n2. Đổi tên\n3. Lưu', 'Thông báo thành công; tên mới hiển thị');
t('ORG-E02', 'A.IV.4-UC5', 'Chỉnh sửa', 'Đổi loại đơn vị', 'Chức năng', 'Trung bình', '1. Cập nhật → chọn loại khác\n2. Lưu', 'Cột Loại đơn vị đổi theo');
t('ORG-E03', 'A.IV.4-UC5', 'Chỉnh sửa', 'Xóa trắng tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc; không lưu');
t('ORG-E04', 'A.IV.4-UC5', 'Chỉnh sửa', 'Hủy chỉnh sửa không đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Hủy', 'Dữ liệu giữ nguyên');
t('ORG-D01', 'A.IV.4-UC6', 'Xóa', 'Xóa đơn vị chưa có người dùng thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Đơn vị biến mất');
t('ORG-D02', 'A.IV.4-UC6', 'Xóa', 'Xóa đơn vị đang có người dùng bị chặn', 'Nghiệp vụ', 'Cao', '1. Gán 1 user vào đơn vị\n2. Xóa đơn vị', 'Báo "Không thể xóa: đang có người dùng thuộc đơn vị này"; đơn vị còn nguyên');
t('ORG-D03', 'A.IV.4-UC6', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Không', 'Đơn vị vẫn còn');
t('ORG-K01', 'A.IV.4-UC7', 'Khóa/Mở khóa', 'Khóa đơn vị chuyển trạng thái Đã khóa', 'Chức năng', 'Cao', '1. Menu → Khoá\n2. Xác nhận', 'Trạng thái "Đã khóa"');
t('ORG-K02', 'A.IV.4-UC7', 'Khóa/Mở khóa', 'Mở khóa đơn vị chuyển lại Chưa khóa', 'Chức năng', 'Cao', '1. Menu → Mở khoá', 'Trạng thái "Chưa khóa"');
t('ORG-R01', 'A.IV.4-UC8', 'Tham chiếu tỉnh', 'Đổi tỉnh tham chiếu của đơn vị ở màn chi tiết', 'Chức năng', 'Cao', '1. Chi tiết đơn vị → Đổi tỉnh\n2. Chọn tỉnh\n3. Lưu', 'Tỉnh tham chiếu đổi; cột danh sách cập nhật');
t('ORG-R02', 'A.IV.4-UC8', 'Tham chiếu tỉnh', 'Bỏ tham chiếu tỉnh của đơn vị', 'Chức năng', 'Cao', '1. Chi tiết đơn vị → Bỏ tham chiếu\n2. Xác nhận', 'Tỉnh tham chiếu trở thành trống / "–"');
t('ORG-M01', 'A.IV.4-UC11', 'Thêm người dùng', 'Thêm người dùng vào đơn vị', 'Chức năng', 'Cao', '1. Chi tiết đơn vị → Thêm người dùng vào đơn vị\n2. Chọn user\n3. Lưu', 'User xuất hiện trong bảng người dùng; số Người dùng tăng; cột Đơn vị của user ở trang Người dùng đổi theo');
t('ORG-M02', 'A.IV.4-UC10', 'Xóa người dùng', 'Xóa người dùng khỏi đơn vị', 'Chức năng', 'Cao', '1. Trong bảng người dùng đơn vị, xóa user khỏi đơn vị', 'User biến mất khỏi bảng; số Người dùng giảm; user vẫn tồn tại');
t('ORG-S01', 'A.IV.4-UC1', 'Phân quyền', 'API đơn vị: không token / token giả → 401', 'Bảo mật', 'Cao', '1. GET /organizations không token', 'HTTP 401');
t('ORG-S02', 'A.IV.4-UC4', 'Phân quyền', 'Quyền API đơn vị đúng theo ma trận quyền Cán bộ', 'Bảo mật', 'Cao', '1. Lấy ma trận quyền canbo\n2. GET/POST /organizations', 'Có quyền → được; không → 403');
t('ORG-P01', 'A.IV.4-UC1', 'Hiệu năng', 'Danh sách đơn vị tải < 3 giây', 'Hiệu năng', 'Trung bình', '1. Mở trang và đo', 'API < 3000ms, hiển thị < 6000ms');

// ---- Edge / lỗi dùng chung cho 6 page (G01..G05) ----
const EDGE = [['USR', 'A.II.1-UC4', 'người dùng', 'Người dùng'], ['GRP', 'A.II.2-UC4', 'nhóm người dùng', 'Nhóm'], ['PRV', 'A.IV.1-UC4', 'tỉnh/thành', 'Tỉnh'], ['COM', 'A.IV.2-UC4', 'xã/phường', 'Xã'], ['UTY', 'A.IV.3-UC4', 'loại đơn vị', 'Loại đơn vị'], ['ORG', 'A.IV.4-UC4', 'đơn vị', 'Đơn vị']];
for (const [P, uc, nm] of EDGE) {
  t(`${P}-G01`, uc, 'Thêm mới', `Trường bắt buộc chỉ nhập khoảng trắng bị chặn (${nm})`, 'Validate', 'Trung bình', '1. Mở form thêm mới\n2. Nhập chỉ dấu cách vào các trường văn bản bắt buộc\n3. Lưu', 'Báo lỗi bắt buộc (chuỗi rỗng sau khi trim); form còn mở; không tạo bản ghi');
  t(`${P}-G02`, uc, 'Thêm mới', `Tên chứa tiếng Việt có dấu, HTML, dấu nháy, & được lưu và hiển thị đúng sau khi tải lại trang (${nm})`, 'Nghiệp vụ', 'Trung bình', '1. [API] Tạo bản ghi có tên chứa ký tự đặc biệt\n2. Tải lại trang (F5), tìm theo mã', 'Tên hiển thị nguyên văn dạng chữ; thẻ HTML không bị render (chống XSS)');
  if (['PRV', 'COM', 'UTY'].includes(P)) t(`${P}-G03`, uc, 'Thêm mới', `[API] Tên rỗng bị server từ chối bằng HTTP 400 (${nm})`, 'Validate', 'Trung bình', '1. [API] POST với name rỗng', 'HTTP 400 kèm thông báo; không tạo bản ghi', 'Auto', 'Nếu API trả 200/500 → lỗi thiếu validate phía server');
  t(`${P}-G04`, uc, 'Thêm mới', `Server lỗi 500 khi lưu: hiển thị lỗi, giữ form và dữ liệu đã nhập (${nm})`, 'Nghiệp vụ', 'Trung bình', '1. Điền form hợp lệ\n2. Giả lập API POST trả 500\n3. Lưu', 'Form còn mở và giữ dữ liệu; không lộ stacktrace; không tạo bản ghi');
  t(`${P}-G05`, uc, 'Thêm mới', `Mất kết nối khi lưu: không treo giao diện, giữ form (${nm})`, 'Nghiệp vụ', 'Trung bình', '1. Điền form hợp lệ\n2. Giả lập mất mạng khi POST\n3. Lưu', 'Form còn mở và giữ dữ liệu; trang không trắng/lỗi; không tạo bản ghi');
}

// ---- Bổ sung theo truy vết điều kiện (trace-check) ----
const NF = [['USR', 'V04', 'A.II.1-UC3', 'người dùng'], ['GRP', 'V04', 'A.II.2-UC3', 'nhóm'], ['PRV', 'V04', 'A.IV.1-UC5', 'tỉnh'], ['COM', 'V02', 'A.IV.2-UC5', 'xã'], ['UTY', 'V03', 'A.IV.3-UC3', 'loại đơn vị'], ['ORG', 'V03', 'A.IV.4-UC3', 'đơn vị']];
for (const [P, n, uc, nm] of NF) t(`${P}-${n}`, uc, 'Xem chi tiết', `Mở chi tiết ${nm} với id không tồn tại không gây lỗi hệ thống`, 'Validate', 'Trung bình', '1. [API] GET /<tài nguyên>/<id lạ>\n2. Mở URL chi tiết với id lạ', 'API trả 4xx (không 500); trang không trắng, không lộ lỗi nội bộ');
for (const [P, uc, nm] of EDGE) t(`${P}-G06`, uc, 'Thêm mới', `Bấm Lưu 2 lần liên tiếp chỉ tạo 1 bản ghi (${nm})`, 'Nghiệp vụ', 'Trung bình', '1. Điền form hợp lệ\n2. Bấm Lưu 2 lần liên tiếp rất nhanh', 'Chỉ có đúng 1 bản ghi theo mã; không báo lỗi trùng gây hiểu nhầm');
t('USR-C19', 'A.II.1-UC4', 'Thêm mới', 'Tên đăng nhập chỉ khác hoa/thường so với tài khoản có sẵn bị coi là trùng', 'Nghiệp vụ', 'Trung bình', '1. Có user "abc"\n2. [API] Tạo user "ABC" email khác', 'Bị từ chối (4xx)', 'Auto', 'Chưa có đặc tả rõ về phân biệt hoa/thường — cần BA xác nhận');
t('GRP-C07', 'A.II.2-UC4', 'Thêm mới', 'Mã nhóm chỉ khác hoa/thường so với nhóm có sẵn bị coi là trùng', 'Nghiệp vụ', 'Trung bình', '1. Có nhóm "ABC"\n2. [API] Tạo nhóm "abc"', 'Bị từ chối (4xx)', 'Auto', 'Cần BA xác nhận quy tắc hoa/thường');
t('GRP-E05', 'A.II.2-UC5', 'Chỉnh sửa', 'Mã nhóm không sửa được ở form cập nhật', 'Nghiệp vụ', 'Trung bình', '1. Menu → Cập nhật', 'Ô Mã nhóm ở trạng thái chỉ-đọc');
t('GRP-V05', 'A.II.2-UC7', 'Xem thành viên', 'Tìm thành viên trong chi tiết nhóm', 'Chức năng', 'Trung bình', '1. Mở chi tiết nhóm có 2 thành viên\n2. Nhập tên đăng nhập 1 thành viên', 'Chỉ còn đúng thành viên đó; từ khóa lạ → rỗng');
t('GRP-M08', 'A.II.2-UC8', 'Xóa thành viên', 'Chọn Hủy ở hộp xác nhận xóa khỏi nhóm thì giữ nguyên thành viên', 'Chức năng', 'Trung bình', '1. Chọn thành viên → Xóa khỏi nhóm\n2. Bấm Huỷ', 'Thành viên vẫn trong nhóm');
t('PRV-E05', 'A.IV.1-UC3', 'Chỉnh sửa', 'Sửa tên tỉnh thành tên trùng tỉnh khác bị từ chối', 'Nghiệp vụ', 'Trung bình', '1. Có tỉnh A, B\n2. Sửa tên B = tên A\n3. Lưu', 'Bị từ chối; tên B giữ nguyên', 'Auto', 'Tương tự PRV-C06 (thêm trùng tên) — cần BA xác nhận quy tắc duy nhất của tên');
t('ORG-V04', 'A.IV.4-UC9', 'Người dùng trong đơn vị', 'Tìm người dùng trong chi tiết đơn vị', 'Chức năng', 'Trung bình', '1. Mở chi tiết đơn vị có 2 user\n2. Nhập tên đăng nhập 1 user', 'Chỉ còn đúng user đó');
t('ORG-M03', 'A.IV.4-UC11', 'Thêm người dùng', 'Người dùng đang thuộc đơn vị khác được chuyển sang đơn vị mới', 'Nghiệp vụ', 'Trung bình', '1. User thuộc đơn vị A\n2. Chi tiết đơn vị B → Thêm người dùng → chọn user → Lưu', 'User chuyển sang B (theo thông báo của màn hình)');

import defineB from './catalog-B.mjs';
defineB(t, listSuite);
import defineB3 from './catalog-B3.mjs';
defineB3(t, listSuite);
import defineC1 from './catalog-C1.mjs';
import defineC2 from './catalog-C2.mjs';
import defineC3 from './catalog-C3.mjs';
defineC1(t); defineC2(t); defineC3(t);
import defineAuth from './catalog-AUTH.mjs';
defineAuth(t);
import defineAcc from './catalog-ACC.mjs';
defineAcc(t);
import definePrm from './catalog-PRM.mjs';
definePrm(t);

export default T;
