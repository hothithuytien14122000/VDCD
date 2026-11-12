// Testcase BỔ SUNG từ các bug/góp ý đã log trên GitLab (vdcd-cds-client) — nhóm Người dùng, Nhóm người dùng, Ma trận phân quyền,
// Thông tin cá nhân / Đổi mật khẩu / Đổi mật khẩu lần đầu, Đăng nhập, Đăng xuất, Quên mật khẩu, Email.
// Mỗi case ghi số issue ở cột Ghi chú để truy vết. Chưa có script automation → Manual.
// Issue đã có testcase đúng hành vi thì KHÔNG viết lại, chỉ truy vết ở requirements-BUG-A1.mjs.
export default function defineBUG_A1(t) {
  const OPEN = new Set([19, 39, 48, 245, 246, 248, 262]);
  const ref = issue => [].concat(issue).map(n => `GitLab #${n}${OPEN.has(n) ? '' : ' (đã đóng)'}`).join(', ');
  const m = (id, uc, fn, title, type, pri, steps, exp, issue, note = '') =>
    t(id, uc, fn, title, type, pri, steps, exp, 'Manual — chưa có script', `${ref(issue)}${note ? '. ' + note : ''}`);
  // Case đã có script (scripts/Auth/bug-gitlab.spec.ts)
  const a = (id, uc, fn, title, type, pri, steps, exp, issue, note = '') =>
    t(id, uc, fn, title, type, pri, steps, exp, 'Auto', `${ref(issue)}${note ? '. ' + note : ''}`);
  const BA = 'cần BA xác nhận';

  const GO_USR = '1. Đăng nhập Quản trị hệ thống\n2. Mở Quản trị hệ thống → Người dùng';
  const GO_USR_V = GO_USR + '\n3. Bấm "Xem chi tiết" ở một người dùng';
  const GO_USR_C = GO_USR + '\n3. Bấm "Thêm mới người dùng"';
  const GO_USR_E = GO_USR + '\n3. Bấm "Chỉnh sửa" ở một người dùng';
  const GO_GRP = '1. Đăng nhập Quản trị hệ thống\n2. Mở Quản trị hệ thống → Nhóm người dùng';
  const GO_GRP_V = GO_GRP + '\n3. Bấm vào một nhóm có thành viên để mở chi tiết';
  const GO_PRM = '1. Đăng nhập Quản trị hệ thống\n2. Mở Quản trị hệ thống → Ma trận phân quyền';
  const GO_PRO = '1. Đăng nhập bằng tài khoản vai trò Cán bộ\n2. Bấm thẻ người dùng ở sidebar → Thông tin cá nhân';
  const GO_CPW = GO_PRO + '\n3. Bấm "Đổi mật khẩu"';
  const GO_RPW = '1. Chưa đăng nhập, mở trang đăng nhập\n2. Bấm "Quên mật khẩu?"';
  const U = { L: 'A.II.1-UC1', V: 'A.II.1-UC3', C: 'A.II.1-UC4', E: 'A.II.1-UC5', X: 'A.II.1 (bổ sung)' };
  const G = { L: 'A.II.2-UC1', V: 'A.II.2-UC3', C: 'A.II.2-UC4', E: 'A.II.2-UC5', D: 'A.II.2-UC6', M7: 'A.II.2-UC7', M8: 'A.II.2-UC8', M9: 'A.II.2-UC9' };

  // ===================== NGƯỜI DÙNG — danh sách =====================
  a('USR-L34', U.L, 'Bộ lọc', 'Giá trị "Tất cả" ở bộ lọc Nhóm người dùng và Trạng thái hiển thị in đậm như design', 'UI', 'Thấp',
    GO_USR + '\n3. Quan sát 2 bộ lọc Nhóm người dùng và Trạng thái khi chưa chọn giá trị',
    'Text giá trị mặc định "Tất cả" ở cả 2 bộ lọc in đậm đúng design ND-01', 7);
  a('USR-L35', U.L, 'Xem danh sách', 'Bảng danh sách người dùng không còn cột Số điện thoại', 'UI', 'Trung bình',
    GO_USR + '\n3. Xem tiêu đề các cột của bảng',
    'Không có cột "Số điện thoại"; các cột còn lại hiển thị đúng thứ tự theo design', [280, 8],
    '#8 (cột SĐT trống hiển thị "-") được thay thế bởi #280. Mâu thuẫn với USR-L01 (còn cột Số điện thoại) — cần cập nhật USR-L01');
  a('USR-L36', U.L, 'Xem danh sách', 'Cột Họ tên và Đơn vị đủ rộng, dữ liệu không bị xuống dòng', 'UI', 'Thấp',
    GO_USR + '\n3. Xem dòng có Họ tên và tên Đơn vị dài (vd tên đơn vị > 30 ký tự) ở màn hình 1920px',
    'Họ tên và Đơn vị hiển thị trên 1 dòng (dài quá thì cắt "..." kèm tooltip), không xuống dòng làm cao hàng', 31);
  a('USR-L37', U.L, 'Bộ lọc', 'Bộ lọc Nhóm người dùng có lựa chọn "Tất cả nhóm người dùng"', 'Chức năng', 'Trung bình',
    GO_USR + '\n3. Mở bộ lọc Nhóm người dùng\n4. Chọn một nhóm, sau đó chọn lại "Tất cả nhóm người dùng"',
    'Danh sách lựa chọn có mục đầu tiên "Tất cả nhóm người dùng"; chọn mục này thì danh sách trở về đầy đủ (tổng số bản ghi bằng lúc chưa lọc)', 175);
  m('USR-L38', U.L, 'Xem danh sách', 'Badge trạng thái ở cột Trạng thái có border đúng design', 'UI', 'Thấp',
    GO_USR + '\n3. So badge "Đang hoạt động" và "Đã khóa" với design ND-01',
    'Màu nền, màu chữ và border của từng badge trạng thái khớp design ND-01', 214);
  m('USR-L39', U.L, 'Xem danh sách', 'Màu nền hàng tiêu đề và hàng dữ liệu của bảng đúng design ND-01', 'UI', 'Thấp',
    GO_USR + '\n3. So màu nền hàng tiêu đề và hàng dữ liệu với design ND-01',
    'Màu nền hàng tiêu đề và hàng dữ liệu đúng mã màu trong design ND-01', 215);
  m('USR-L40', U.L, 'Xem danh sách', 'Màn danh sách người dùng khớp design ND-01', 'UI', 'Trung bình',
    GO_USR + '\n3. So toàn màn (tiêu đề, mô tả, ô tìm kiếm, bộ lọc, nút, bảng, phân trang) với design ND-01',
    'Bố cục, text, font, màu, khoảng cách khớp design ND-01', 247);
  a('USR-L41', U.L, 'Phân trang', 'Tải lại trang (F5) ở trang 2 danh sách người dùng giữ nguyên trang đang xem', 'Chức năng', 'Trung bình',
    GO_USR + '\n3. Chuyển sang trang 2\n4. Nhấn F5',
    'Sau khi tải lại vẫn ở trang 2 (trang 2 được đánh dấu active, dữ liệu giống trước khi F5)', 28,
    'Phần "phân trang" của issue Toàn hệ thống áp dụng cho trang Người dùng');

  // ===================== NGƯỜI DÙNG — xem chi tiết (drawer) =====================
  a('USR-V05', U.V, 'Xem chi tiết', 'Drawer chi tiết người dùng hiển thị "Mã người dùng"', 'UI', 'Trung bình',
    GO_USR_V, 'Có trường "Mã người dùng" hiển thị đúng tên đăng nhập (userName) của người dùng', 244);
  a('USR-V06', U.V, 'Xem chi tiết', 'Drawer chi tiết không hiển thị Ngày tạo, Đổi mật khẩu, Đăng nhập gần nhất', 'UI', 'Trung bình',
    GO_USR_V, 'Không có các trường "Ngày tạo", "Đổi mật khẩu", "Đăng nhập gần nhất" (không còn ngày cứng 01/01/1901)', [244, 18, 3],
    'Mâu thuẫn với USR-V01 (còn "ngày tạo") — cần cập nhật USR-V01');
  a('USR-V07', U.V, 'Xem chi tiết', 'Người dùng không có số điện thoại thì ô SĐT ở drawer hiển thị "–"', 'UI', 'Thấp',
    GO_USR + '\n3. Xem chi tiết một người dùng chưa nhập số điện thoại', 'Ô Số điện thoại hiển thị "–", không để trống hay hiển thị giá trị sai', 244);
  a('USR-V08', U.V, 'Xem chi tiết', 'Màu label trạng thái "Đã khóa" ở drawer giống ở danh sách', 'UI', 'Thấp',
    GO_USR + '\n3. Xem chi tiết một người dùng đã khóa\n4. So label trạng thái với badge cùng người dùng ở danh sách',
    'Màu nền, màu chữ, border của label "Đã khóa" ở drawer giống badge ở danh sách', 4);
  m('USR-V09', U.V, 'Xem chi tiết', 'Font email phụ (dưới họ tên) ở drawer đồng nhất với label trong nội dung', 'UI', 'Thấp',
    GO_USR_V, 'Email phụ dưới họ tên dùng cùng font family/size/weight với label trong nội dung drawer, đúng design', 5);
  a('USR-V10', U.V, 'Xem chi tiết', 'Drawer chi tiết không có trường "Vai trò"', 'UI', 'Thấp',
    GO_USR_V, 'Không có trường "Vai trò"; thông tin phân quyền chỉ thể hiện qua "Nhóm người dùng"', 6);
  a('USR-V11', U.V, 'Xem chi tiết', 'Drawer chi tiết không có link "Xem quyền của nhóm"', 'UI', 'Thấp',
    GO_USR_V, 'Không có link "Xem quyền của nhóm" cạnh Nhóm người dùng', 17);
  a('USR-V12', U.V, 'Xem chi tiết', 'Mục "Đăng nhập gần đây" lấy dữ liệu thật từ nhật ký truy cập', 'Nghiệp vụ', 'Trung bình',
    '1. Đăng nhập bằng tài khoản người dùng A (ghi nhận thời điểm, IP)\n2. Đăng nhập Quản trị hệ thống → Người dùng → Xem chi tiết người dùng A\n3. So mục "Đăng nhập gần đây" với Nhật ký truy cập lọc theo người dùng A',
    'Mục "Đăng nhập gần đây" có lần đăng nhập ở bước 1 (thời điểm, IP/thiết bị) khớp Nhật ký truy cập, mới nhất ở trên; người dùng chưa đăng nhập lần nào thì hiển thị trạng thái trống', 213);
  m('USR-V13', U.V, 'Xem chi tiết', 'Mục "Đăng nhập gần đây" ở drawer hiển thị đúng design', 'UI', 'Thấp',
    GO_USR_V + '\n4. So mục "Đăng nhập gần đây" với design', 'Tiêu đề, số dòng, định dạng thời gian và bố cục mục "Đăng nhập gần đây" khớp design', 19);
  a('USR-V14', U.V, 'Xem chi tiết', 'Drawer chi tiết không đóng khi bấm ra ngoài, chỉ đóng bằng nút Đóng hoặc X', 'Chức năng', 'Trung bình',
    GO_USR_V + '\n4. Bấm vào vùng nền bên ngoài drawer\n5. Bấm nút X\n6. Mở lại, bấm nút Đóng',
    'Bước 4: drawer vẫn mở; bước 5 và 6: drawer đóng', 20);
  a('USR-V15', U.V, 'Xem chi tiết', 'Drawer chi tiết có nút sao chép số điện thoại', 'Chức năng', 'Thấp',
    GO_USR + '\n3. Xem chi tiết người dùng có số điện thoại\n4. Bấm biểu tượng sao chép cạnh SĐT\n5. Dán vào ô bất kỳ',
    'Có biểu tượng sao chép cạnh SĐT; bấm thì hiện thông báo đã sao chép; nội dung dán ra đúng SĐT', 156);
  a('USR-V16', U.V, 'Xem chi tiết', 'Cỡ chữ nội dung drawer chi tiết đúng design (không quá nhỏ)', 'UI', 'Thấp',
    GO_USR_V, 'Cỡ chữ label và giá trị trong drawer đúng design (giá trị không nhỏ hơn cỡ chữ nội dung chung của hệ thống)', 156);
  m('USR-V17', U.V, 'Xem chi tiết', 'Drawer Xem chi tiết người dùng khớp design', 'UI', 'Trung bình',
    GO_USR_V + '\n4. So toàn drawer với design', 'Bố cục, trường thông tin, text, font, màu, khoảng cách khớp design', [174, 248]);

  // ===================== NGƯỜI DÙNG — thêm mới =====================
  m('USR-C20', U.C, 'Thêm mới', 'Bỏ tích "Bắt buộc đổi mật khẩu lần đầu" thì lần đầu đăng nhập vào thẳng hệ thống', 'Nghiệp vụ', 'Cao',
    GO_USR_C + '\n4. Nhập thông tin hợp lệ, bỏ tích "Bắt buộc đổi mật khẩu lần đầu"\n5. Lưu\n6. Đăng xuất, đăng nhập bằng tài khoản vừa tạo',
    'Vào thẳng Dashboard, không chuyển sang màn "Đổi mật khẩu lần đầu"; API chi tiết người dùng có isRequireChangePassword = false', [48, 119]);
  a('USR-C21', U.C, 'Thêm mới', 'Danh sách chọn Đơn vị ở form thêm mới có các đơn vị đang hoạt động (chưa khóa)', 'Chức năng', 'Cao',
    GO_USR_C + '\n4. Mở ô Đơn vị, tìm một đơn vị đang hoạt động (vd đơn vị vừa tạo)',
    'Đơn vị đang hoạt động xuất hiện và chọn được', 85);
  m('USR-C22', U.C, 'Thêm mới', 'Danh sách chọn Đơn vị ở form thêm mới không có đơn vị đã khóa', 'Nghiệp vụ', 'Trung bình',
    '1. Chuẩn bị một đơn vị đã khóa\n2. Đăng nhập Quản trị hệ thống → Người dùng → Thêm mới người dùng\n3. Mở ô Đơn vị, tìm đơn vị đã khóa',
    'Đơn vị đã khóa không xuất hiện trong danh sách chọn', 85, `Quy tắc ẩn đơn vị đã khóa — ${BA}`);
  a('USR-C23', U.C, 'Thêm mới', 'Ô Tên đăng nhập giới hạn tối đa 50 ký tự trên giao diện', 'Validate', 'Trung bình',
    GO_USR_C + '\n4. Nhập 51 ký tự hợp lệ vào ô Tên đăng nhập',
    'Ô chỉ nhận 50 ký tự (hoặc báo "Tên đăng nhập không vượt quá 50 ký tự"); không gửi request gây lỗi 500', 95);
  a('USR-C24', U.C, 'Thêm mới', 'Tên đăng nhập có dấu tiếng Việt bị chặn', 'Validate', 'Cao',
    GO_USR_C + '\n4. Nhập Tên đăng nhập "nguyễnvăn", các trường khác hợp lệ\n5. Lưu',
    'Báo lỗi định dạng Tên đăng nhập tại ô; không tạo người dùng', 109);
  a('USR-C25', U.C, 'Thêm mới', 'Tên đăng nhập chứa khoảng trắng bị chặn', 'Validate', 'Cao',
    GO_USR_C + '\n4. Nhập Tên đăng nhập "nguyen van", các trường khác hợp lệ\n5. Lưu',
    'Báo lỗi định dạng Tên đăng nhập tại ô; không tạo người dùng', 109);
  a('USR-C26', U.C, 'Thêm mới', 'Tên đăng nhập chứa chữ hoa bị chặn (chỉ cho chữ thường)', 'Validate', 'Trung bình',
    GO_USR_C + '\n4. Nhập Tên đăng nhập "NguyenVan", các trường khác hợp lệ\n5. Lưu',
    'Báo lỗi định dạng Tên đăng nhập (hoặc tự chuyển về chữ thường trước khi lưu); không lưu tên đăng nhập có chữ hoa', 109,
    `Mâu thuẫn với USR-C19/LGN-M07 (tên đăng nhập phân biệt hoa/thường) — ${BA}`);
  m('USR-C27', U.C, 'Thêm mới', 'Popup Thêm người dùng khớp design ND-05', 'UI', 'Trung bình',
    GO_USR_C + '\n4. So popup (tiêu đề, mô tả, trường, placeholder, checkbox, nút) với design ND-05',
    'Bố cục, text, placeholder, font, màu, nút khớp design ND-05', [176, 245]);
  a('USR-C28', U.C, 'Thêm mới', 'Mở lại form Thêm mới người dùng sau khi đã lưu thì form trống', 'Chức năng', 'Trung bình',
    GO_USR_C + '\n4. Nhập đầy đủ thông tin hợp lệ, Lưu thành công\n5. Bấm "Thêm mới người dùng" lần nữa\n6. Nhập vài trường, Hủy, mở lại form',
    'Bước 5 và 6: mọi trường trống/về giá trị mặc định, không còn dữ liệu của lần nhập trước', 116);
  m('USR-C29', U.C, 'Email', 'Email thông tin tài khoản đăng nhập được gửi từ địa chỉ thuộc domain mail của công ty', 'Nghiệp vụ', 'Trung bình',
    GO_USR_C + '\n4. Nhập thông tin hợp lệ với email nhận kiểm tra được, tích "Gửi thông tin đăng nhập qua email"\n5. Lưu\n6. Mở email nhận được, xem địa chỉ người gửi',
    'Địa chỉ người gửi (From) thuộc domain mail của công ty/hệ thống, không phải gmail.com hay địa chỉ cá nhân', 63, `Domain gửi chính xác — ${BA}`);

  // ===================== NGƯỜI DÙNG — chỉnh sửa =====================
  a('USR-E10', U.E, 'Chỉnh sửa', 'Form Chỉnh sửa người dùng hiển thị đúng Mã người dùng (userName), không hiển thị email', 'Chức năng', 'Cao',
    GO_USR_E, 'Ô Mã người dùng/Tên đăng nhập hiển thị userName của người dùng (khớp cột Tên đăng nhập ở danh sách), không phải email', 1);
  m('USR-E11', U.E, 'Chỉnh sửa', 'Font sub title form Chỉnh sửa người dùng đồng nhất với text mô tả dưới field', 'UI', 'Thấp',
    GO_USR_E, 'Sub title dưới tiêu đề form dùng font family/size/weight theo design, đồng nhất với text mô tả dưới field', 2);
  m('USR-E12', U.E, 'Chỉnh sửa', 'Popup Chỉnh sửa người dùng khớp design ND-07', 'UI', 'Trung bình',
    GO_USR_E + '\n4. So popup với design ND-07', 'Bố cục, text, placeholder, trường chỉ-đọc, font, màu, nút khớp design ND-07', [177, 246]);
  a('USR-E13', U.E, 'Chỉnh sửa', 'Xóa Đơn vị của người dùng khi chỉnh sửa rồi Lưu thì đơn vị được gỡ', 'Chức năng', 'Cao',
    GO_USR + '\n3. Chỉnh sửa người dùng đang có Đơn vị\n4. Xóa giá trị ô Đơn vị\n5. Lưu, mở lại chi tiết',
    'Lưu thành công; chi tiết và API người dùng không còn đơn vị (organizationId rỗng)', 109);

  // ===================== NGƯỜI DÙNG — edge / API / xóa =====================
  a('USR-G12', U.C, 'Thêm mới', '[API] Họ tên 256 ký tự bị từ chối 400 có thông báo, không 500/stacktrace', 'Validate', 'Cao',
    '1. [API] POST idm/users với Họ tên 256 ký tự, các trường khác hợp lệ',
    'HTTP 400 "Tên không vượt quá 255 ký tự"; không lộ stacktrace; không tạo người dùng', [95, 142]);
  a('USR-X06', U.X, 'Xóa', 'Xóa người dùng đang thuộc nhóm thì người dùng không còn trong danh sách thành viên của nhóm', 'Nghiệp vụ', 'Cao',
    '1. Tạo người dùng A và thêm vào nhóm N\n2. Người dùng → Xóa người dùng A → Có\n3. Mở chi tiết nhóm N',
    'API xóa trả 200; A không còn trong bảng thành viên của nhóm N; cột Thành viên của nhóm N giảm 1', 56,
    'Hiểu theo tiêu đề "Xóa người dùng trong nhóm 200 nhưng không clear data"');

  // ===================== NHÓM NGƯỜI DÙNG =====================
  a('GRP-L14', G.L, 'Tìm kiếm', 'Quay lại từ chi tiết nhóm giữ nguyên từ khóa tìm kiếm và trang đang xem', 'Chức năng', 'Trung bình',
    GO_GRP + '\n3. Nhập từ khóa tìm kiếm, chuyển sang trang 2 (nếu có)\n4. Mở chi tiết một nhóm\n5. Bấm nút quay lại',
    'Danh sách giữ nguyên từ khóa, trang và kết quả như trước khi xem chi tiết', 113, 'Phần Nhóm người dùng của issue Toàn hệ thống');
  m('GRP-V07', G.V, 'Xem chi tiết', 'Nút Back ở chi tiết nhóm đúng kích thước và căn thẳng hàng với tiêu đề', 'UI', 'Thấp',
    GO_GRP_V, 'Nút Back đúng kích thước theo design, căn giữa theo chiều dọc với tiêu đề trang', 41);
  a('GRP-V08', G.V, 'Xem chi tiết', 'Badge Mã nhóm ở chi tiết nhóm có border như design', 'UI', 'Thấp',
    GO_GRP_V, 'Badge Mã nhóm có border, màu nền và màu chữ đúng design', 41);
  a('GRP-V09', G.V, 'Xem chi tiết', 'Tiêu đề trang chi tiết nhóm hiển thị đúng design', 'UI', 'Thấp',
    GO_GRP_V, 'Tiêu đề trang là tên nhóm người dùng (kèm badge Mã nhóm) theo design', 69, `Nội dung tiêu đề chính xác — ${BA}`);
  a('GRP-V10', G.V, 'Xem chi tiết', 'Nhãn Mô tả ở chi tiết nhóm không hiển thị placeholder "{{sub}}"', 'UI', 'Trung bình',
    GO_GRP_V, 'Nhãn và nội dung Mô tả hiển thị text thật; không có chuỗi "{{sub}}" hay "{{…}}" nào trên trang', 69);
  a('GRP-V11', G.V, 'Xem chi tiết', 'Hover vào mô tả dài ở chi tiết nhóm hiện tooltip đầy đủ nội dung', 'UI', 'Thấp',
    '1. Tạo nhóm có mô tả dài (> 200 ký tự)\n2. Mở chi tiết nhóm\n3. Hover vào mô tả',
    'Mô tả bị rút gọn "..." theo design NND-02b; tooltip hiện đầy đủ nội dung mô tả', 229);
  a('GRP-E06', G.E, 'Chỉnh sửa', 'Form chỉnh sửa nhóm hiển thị Mã nhóm hiện tại', 'Chức năng', 'Cao',
    GO_GRP + '\n3. Bấm Chỉnh sửa ở một nhóm', 'Ô Mã nhóm hiển thị đúng mã của nhóm (khớp cột Mã ở danh sách), ở trạng thái chỉ-đọc', 40);
  a('GRP-C08', G.C, 'Thêm mới', 'Mở lại form Thêm nhóm người dùng sau khi đã lưu thì form trống', 'Chức năng', 'Trung bình',
    GO_GRP + '\n3. Thêm nhóm với Mã, Tên, Mô tả hợp lệ, Lưu thành công\n4. Bấm Thêm mới lần nữa\n5. Nhập vài trường, Hủy, mở lại form',
    'Bước 4 và 5: mọi trường trống, không còn dữ liệu của lần nhập trước', 116);
  a('GRP-D04', G.D, 'Xóa', 'Xóa nhóm đang có thành viên bị chặn kèm cảnh báo', 'Nghiệp vụ', 'Cao',
    '1. Tạo nhóm và thêm 1 người dùng vào nhóm\n2. Ở danh sách Nhóm người dùng bấm Xóa nhóm đó → Có',
    'Hệ thống không xóa; hiển thị cảnh báo nhóm đang có thành viên, cần gỡ thành viên trước; nhóm và thành viên vẫn còn', 123,
    `Nội dung thông báo — ${BA}`);
  m('GRP-M09', G.M9, 'Thêm thành viên', 'Popup Thêm người dùng vào nhóm khớp design NND-07 (tiêu đề, thuật ngữ, cột, nút)', 'UI', 'Trung bình',
    GO_GRP_V + '\n4. Bấm "Thêm người dùng vào nhóm"\n5. So popup với design NND-07',
    'Tiêu đề, thuật ngữ ("người dùng", "nhóm người dùng"), ô tìm kiếm, cột bảng, phân trang, nút khớp design NND-07', [232, 96]);
  a('GRP-M10', G.M8, 'Xóa thành viên', 'Chọn người dùng trong bảng thành viên thì hiện nút Xóa khỏi nhóm', 'Chức năng', 'Trung bình',
    GO_GRP_V + '\n4. Tích chọn 1 người dùng\n5. Bỏ chọn',
    'Bước 4: hiện nút Xóa (kèm số lượng đã chọn) theo design NND-02c; bước 5: nút ẩn', 230);
  m('GRP-M11', G.M8, 'Xóa thành viên', 'Popup Xóa người dùng khỏi nhóm khớp design NND-06', 'UI', 'Thấp',
    GO_GRP_V + '\n4. Chọn 1 người dùng → Xóa\n5. So popup với design NND-06',
    'Tiêu đề, nội dung, nút khớp design NND-06', 231);
  m('GRP-M12', G.M9, 'Thêm thành viên', 'Khoảng cách footer bảng trong popup Thêm người dùng vào nhóm đúng design', 'UI', 'Thấp',
    GO_GRP_V + '\n4. Bấm "Thêm người dùng vào nhóm"\n5. Xem footer bảng (phân trang, tổng số)',
    'Khoảng cách (padding/margin) giữa bảng, footer và nút đúng design NND-07', 262);
  a('GRP-G13', G.C, 'Thêm mới', '[API] Mã nhóm null bị từ chối', 'Validate', 'Cao',
    '1. [API] POST idm/roles với code = null, tên hợp lệ',
    'HTTP 400 báo Mã nhóm bắt buộc; không tạo nhóm', 208, 'Phần Nhóm người dùng của issue Phân hệ A, B');

  // ===================== MA TRẬN PHÂN QUYỀN =====================
  m('PRM-L13', 'A.II.3-UC1', 'Hiển thị', 'Màn Ma trận phân quyền khớp design PQ-01, PQ-02', 'UI', 'Trung bình',
    GO_PRM + '\n3. So màn hình (danh sách nhóm, cây quyền, cột phạm vi, nút) với design PQ-01, PQ-02',
    'Bố cục, text, font, màu, khoảng cách khớp design PQ-01, PQ-02', 233);
  a('PRM-V09', 'A.II.3-UC1', 'Luồng', 'Rời trang (bấm menu khác) khi còn thay đổi chưa lưu thì có cảnh báo', 'Chức năng', 'Trung bình',
    GO_PRM + '\n3. Chọn một nhóm thử, tick 1 quyền (chưa Lưu)\n4. Bấm sang menu khác',
    'Hiện hộp thoại xác nhận bỏ thay đổi chưa lưu; chọn ở lại thì quyền vừa tick còn nguyên', 126);
  m('PRM-M05', 'A.II.3-UC2', 'Hiệu lực', 'Cấp quyền Khóa cho nhóm thì thành viên thực hiện được chức năng Khóa', 'Nghiệp vụ', 'Cao',
    '1. Tạo nhóm thử, thêm người dùng A\n2. Ma trận phân quyền: cấp quyền Xem và Khóa của Quản lý người dùng cho nhóm, Lưu\n3. Đăng nhập A → Người dùng → Khóa một người dùng',
    'A thấy nút Khóa; khóa thành công (API 200), trạng thái chuyển "Đã khóa"', 88);
  a('PRM-D08', 'A.II.3-UC3', 'Hủy quyền', 'Bỏ tick rồi tick lại quyền (chưa Lưu) thì giữ phạm vi đã chọn trước đó', 'Nghiệp vụ', 'Trung bình',
    GO_PRM + '\n3. Chọn nhóm thử có quyền Sửa của Quản lý người dùng phạm vi "Toàn hệ thống"\n4. Bỏ tick quyền Sửa rồi tick lại',
    'Phạm vi của quyền Sửa vẫn là "Toàn hệ thống"', 168, `Mâu thuẫn với PRM-D04 (về mặc định "Đơn vị và đơn vị con") — ${BA}`);

  // ===================== THÔNG TIN CÁ NHÂN / ĐỔI MẬT KHẨU =====================
  const P1 = 'AUTH.3-UC1';
  m('CPW-L07', P1, 'Thông tin cá nhân', 'Người dùng vai trò Cán bộ tải ảnh đại diện thành công, không báo thiếu quyền', 'Chức năng', 'Cao',
    GO_PRO + '\n3. Tải ảnh đại diện PNG hợp lệ (< 1 MB)',
    'Tải lên thành công (API 2xx); không hiện "Bạn không có quyền truy cập chức năng này"', 14);
  m('CPW-L08', P1, 'Thông tin cá nhân', 'Sau khi tải ảnh đại diện, ảnh mới hiển thị ở popup và thẻ người dùng sidebar, còn sau F5', 'Chức năng', 'Cao',
    GO_PRO + '\n3. Tải ảnh đại diện mới, Lưu\n4. Nhấn F5',
    'Ảnh mới hiển thị ở popup Thông tin cá nhân và thẻ người dùng ở sidebar; sau F5 vẫn là ảnh mới', 67);
  m('CPW-L09', P1, 'Hộp thoại', 'Hộp thoại Đổi mật khẩu không đóng khi bấm ra ngoài', 'Chức năng', 'Trung bình',
    GO_CPW + '\n4. Nhập mật khẩu hiện tại\n5. Bấm vào vùng nền bên ngoài hộp thoại',
    'Hộp thoại vẫn mở, dữ liệu đã nhập còn nguyên; chỉ đóng bằng Huỷ hoặc X', 15);
  m('CPW-L10', P1, 'Thông tin cá nhân', 'Label trường bắt buộc ở Thông tin cá nhân không có dấu * thừa phía trước', 'UI', 'Thấp',
    GO_PRO, 'Mỗi label trường bắt buộc chỉ có một dấu * đúng vị trí theo design; không có * thừa phía trước label', 16);
  m('CPW-L11', P1, 'Thông tin cá nhân', 'Mọi vai trò mở được Thông tin cá nhân, không bị 403', 'Bảo mật', 'Cao',
    '1. Lần lượt đăng nhập các vai trò: Quản trị hệ thống, Cán bộ, Lãnh đạo, vai trò chỉ xem\n2. Mở Thông tin cá nhân',
    'Hiển thị thông tin của chính tài khoản; API idm/users/info trả 200, không 403', 83);
  m('CPW-L12', 'AUTH.3-UC6', 'Đổi mật khẩu', 'Vai trò không có quyền quản trị người dùng (Cán bộ) đổi được mật khẩu của chính mình', 'Bảo mật', 'Cao',
    GO_CPW + '\n4. Nhập mật khẩu hiện tại đúng, mật khẩu mới hợp lệ\n5. Cập nhật mật khẩu',
    'Đổi thành công (API 200), không 403; đăng nhập lại được bằng mật khẩu mới', 107, 'Chạy trên tài khoản dùng một lần');
  m('CPW-L13', P1, 'Thông tin cá nhân', 'Popup Thông tin cá nhân (chưa có ảnh) khớp design TK-02', 'UI', 'Thấp',
    '1. Đăng nhập bằng tài khoản chưa có ảnh đại diện\n2. Bấm thẻ người dùng ở sidebar → Thông tin cá nhân\n3. So popup với design TK-02', 'Ảnh mặc định, trường, text, nút khớp design TK-02', [226, 67]);
  m('CPW-L14', P1, 'Thông tin cá nhân', 'Popup Thông tin cá nhân (đã có ảnh, có nút Gỡ ảnh) khớp design TK-03', 'UI', 'Thấp',
    '1. Đăng nhập bằng tài khoản đã có ảnh đại diện\n2. Bấm thẻ người dùng ở sidebar → Thông tin cá nhân\n3. So popup với design TK-03', 'Ảnh đại diện, nút Gỡ ảnh, trường, text khớp design TK-03', [227, 67]);
  m('CPW-L15', P1, 'Thông tin cá nhân', 'Bấm Gỡ ảnh thì ảnh đại diện trở về ảnh mặc định', 'Chức năng', 'Trung bình',
    '1. Đăng nhập bằng tài khoản đã có ảnh đại diện\n2. Bấm thẻ người dùng ở sidebar → Thông tin cá nhân\n3. Bấm Gỡ ảnh, Lưu\n4. Nhấn F5',
    'Ảnh đại diện ở popup và sidebar trở về ảnh mặc định; nút Gỡ ảnh ẩn; sau F5 vẫn là ảnh mặc định', 227);
  m('CPW-L16', P1, 'Hộp thoại', 'Hộp thoại Đổi mật khẩu khớp design TK-04', 'UI', 'Thấp',
    GO_CPW + '\n4. So hộp thoại với design TK-04', 'Tiêu đề, 3 ô mật khẩu, tiêu chí mật khẩu, ghi chú, nút khớp design TK-04', 228);
  m('CPW-L17', P1, 'Hộp thoại', 'Hai form Đổi mật khẩu (Thông tin cá nhân và Đổi mật khẩu lần đầu) đồng bộ giao diện và chức năng', 'UI', 'Trung bình',
    '1. Mở hộp thoại Đổi mật khẩu ở Thông tin cá nhân\n2. Đăng nhập tài khoản bắt buộc đổi mật khẩu để mở màn Đổi mật khẩu lần đầu\n3. So sánh 2 form',
    'Cùng các ô nhập, nhãn, thanh độ mạnh và danh sách tiêu chí mật khẩu, cùng thông báo lỗi với cùng dữ liệu nhập', 38);
  m('CPW-L18', P1, 'Thông tin cá nhân', 'Bộ đếm ký tự ở popup Thông tin cá nhân hiển thị đúng design', 'UI', 'Thấp',
    GO_PRO + '\n3. Xem các ô nhập (Họ và tên, Số điện thoại)', 'Bộ đếm ký tự chỉ xuất hiện ở các ô có trong design TK-02/TK-03', 261,
    `Ô nào có bộ đếm — ${BA}/Design`);
  m('CPW-L19', P1, 'Thông tin cá nhân', 'Label trường họ tên ở popup Thông tin cá nhân là "Họ và tên"', 'UI', 'Thấp',
    GO_PRO, 'Label hiển thị đúng "Họ và tên"', 261);
  m('CPW-L20', P1, 'Thông tin cá nhân', 'Số điện thoại ở popup Thông tin cá nhân hiển thị đúng format theo design', 'UI', 'Thấp',
    '1. Đăng nhập bằng tài khoản có số điện thoại\n2. Bấm thẻ người dùng ở sidebar → Thông tin cá nhân', 'Số điện thoại hiển thị đúng format trong design TK-02/TK-03', 261, `Format cụ thể — ${BA}/Design`);
  m('CPW-L21', P1, 'Hộp thoại', 'Mở lại hộp thoại Đổi mật khẩu sau khi Huỷ thì các ô mật khẩu trống', 'Bảo mật', 'Trung bình',
    GO_CPW + '\n4. Nhập cả 3 ô\n5. Bấm Huỷ\n6. Mở lại hộp thoại', 'Cả 3 ô mật khẩu trống; tiêu chí mật khẩu về trạng thái ban đầu', 129);
  m('CPW-V13', 'AUTH.3-UC2', 'Validate', 'Đổi mật khẩu áp dụng chính sách mật khẩu đang cấu hình ở Tham số hệ thống', 'Nghiệp vụ', 'Cao',
    '1. Quản trị hệ thống cấu hình độ dài tối thiểu mật khẩu = 10, Lưu\n2. Đăng nhập Cán bộ → Thông tin cá nhân → Đổi mật khẩu\n3. Nhập mật khẩu mới 8 ký tự đủ hoa, thường, số, ký tự đặc biệt',
    'Tiêu chí độ dài hiển thị theo 10 ký tự và không đạt; không cho cập nhật; API (nếu gọi) trả 400', 26);
  const P3 = 'AUTH.3-UC3';
  m('CPW-A11', P3, 'Mật khẩu hiện tại', '[API] Đổi mật khẩu với mật khẩu hiện tại rỗng bị từ chối', 'Bảo mật', 'Cao',
    '1. [API] PUT idm/users/{id của chính mình}/password với passwordOld = "" và passwordNew hợp lệ',
    'HTTP 400 báo bắt buộc mật khẩu hiện tại; mật khẩu không đổi', 129);
  m('CPW-A12', P3, 'Mật khẩu hiện tại', '[API] Đổi mật khẩu không gửi passwordOld (hoặc null) bị từ chối', 'Bảo mật', 'Cao',
    '1. [API] PUT idm/users/{id của chính mình}/password chỉ có passwordNew hợp lệ (bỏ passwordOld)\n2. Lặp lại với passwordOld = null',
    'Cả 2 lần HTTP 400; mật khẩu không đổi', 129);
  m('CPW-A13', P3, 'Mật khẩu mới', '[API] Mật khẩu mới ngắn hơn độ dài tối thiểu bị từ chối', 'Bảo mật', 'Cao',
    '1. [API] PUT idm/users/{id của chính mình}/password với passwordOld đúng (tài khoản dùng một lần), passwordNew = "Ab1!"',
    'HTTP 400 báo mật khẩu không đáp ứng chính sách; mật khẩu không đổi', 129);
  m('CPW-A14', P3, 'Mật khẩu mới', '[API] Mật khẩu mới chứa tên đăng nhập bị từ chối', 'Bảo mật', 'Trung bình',
    '1. [API] PUT đổi mật khẩu với passwordOld đúng, passwordNew = tên đăng nhập + "!A1"',
    'HTTP 400 báo mật khẩu không được chứa tên đăng nhập; mật khẩu không đổi', 129);
  m('CPW-A15', P3, 'Mật khẩu mới', '[API] Mật khẩu mới chỉ gồm chữ số bị từ chối theo độ phức tạp', 'Bảo mật', 'Cao',
    '1. [API] PUT đổi mật khẩu với passwordOld đúng, passwordNew = "12345678"',
    'HTTP 400 báo mật khẩu không đáp ứng chính sách; mật khẩu không đổi', 129);
  m('CPW-S08', 'AUTH.3-UC4', 'Phân quyền', '[API] Không đổi được mật khẩu của người dùng khác bằng token của mình', 'Bảo mật', 'Cao',
    '1. Đăng nhập Cán bộ A, lấy id của người dùng B\n2. [API] PUT idm/users/{id B}/password bằng token của A',
    'HTTP 403 (hoặc 400); mật khẩu của B không đổi, B vẫn đăng nhập được bằng mật khẩu cũ', 129);

  // ===================== ĐĂNG NHẬP / ĐỔI MẬT KHẨU LẦN ĐẦU =====================
  a('LGN-L09', 'AUTH.1-UC1', 'Form đăng nhập', 'Dấu * của các trường bắt buộc ở form đăng nhập có màu đỏ', 'UI', 'Thấp',
    '1. Chưa đăng nhập, mở trang đăng nhập', 'Dấu * ở Tên đăng nhập, Mật khẩu, Mã xác nhận màu đỏ đúng design', 13);
  m('LGN-M16', 'AUTH.1-UC4', 'Đổi mật khẩu lần đầu', 'Mật khẩu mới chứa tên đăng nhập thì tiêu chí "Không chứa tên đăng nhập" không đạt', 'Validate', 'Cao',
    '1. Đăng nhập tài khoản bắt buộc đổi mật khẩu → màn Đổi mật khẩu lần đầu\n2. Nhập mật khẩu mới "<tên đăng nhập>!A1"\n3. Lặp lại với tên đăng nhập viết HOA bên trong mật khẩu',
    'Tiêu chí "Không chứa tên đăng nhập" không được tích đạt; không cho Cập nhật; API (nếu gọi) trả 400', 68,
    `Không phân biệt hoa/thường khi so tên đăng nhập — ${BA}`);
  m('LGN-S04', 'AUTH.1-UC5', 'Phiên', 'Mở hệ thống ở tab mới cùng trình duyệt khi tab đầu đã đăng nhập thì không phải đăng nhập lại', 'Chức năng', 'Trung bình',
    '1. Đăng nhập ở tab 1\n2. Mở tab mới, nhập URL trang Dashboard',
    'Tab 2 vào thẳng Dashboard với cùng tài khoản, không hiển thị trang đăng nhập', 132, `Áp dụng cả khi không tích "Ghi nhớ đăng nhập" — ${BA}`);

  // ===================== ĐĂNG XUẤT / MENU TÀI KHOẢN =====================
  m('LGO-L06', 'AUTH.4-UC1', 'Menu người dùng', 'Thẻ người dùng ở sidebar và menu tài khoản khớp design TK-01', 'UI', 'Thấp',
    '1. Đăng nhập\n2. Bấm thẻ người dùng ở sidebar\n3. So thẻ và menu với design TK-01',
    'Ảnh đại diện, họ tên, tên đăng nhập, các mục menu và biểu tượng khớp design TK-01', 225);
  m('LGO-L07', 'AUTH.4-UC1', 'Hộp thoại xác nhận', 'Hộp thoại Đăng xuất không còn câu cảnh báo phiếu tự đánh giá chưa lưu', 'UI', 'Thấp',
    '1. Đăng nhập\n2. Menu người dùng → Đăng xuất',
    'Hộp thoại không chứa câu "Những thay đổi chưa lưu trên phiếu tự đánh giá..."', 34);
  m('LGO-S06', 'AUTH.4-UC3', 'Thu hồi token', '[API] Token cũ bị từ chối sau khi đăng xuất', 'Bảo mật', 'Cao',
    '1. Đăng nhập, lưu lại token\n2. Đăng xuất (Có)\n3. [API] Gọi idm/users/info bằng token đã lưu',
    'HTTP 401; không trả dữ liệu', 110);

  // ===================== QUÊN MẬT KHẨU =====================
  a('RPW-L12', 'AUTH.2-UC1', 'Yêu cầu OTP', 'Email chưa đăng ký không được báo đã gửi OTP và không chuyển sang màn Nhập mã OTP', 'Nghiệp vụ', 'Cao',
    GO_RPW + '\n3. Nhập email đúng định dạng nhưng chưa đăng ký\n4. Bấm Lấy mã OTP',
    'Ở lại màn nhập email, hiển thị thông báo lỗi đúng mẫu thông báo của hệ thống; không gửi mail', [243, 128],
    `Nội dung thông báo và xung đột với chống dò tài khoản — ${BA}`);
  a('RPW-L13', 'AUTH.2-UC1', 'Yêu cầu OTP', 'Email đăng ký nhập khác hoa/thường vẫn nhận được OTP', 'Chức năng', 'Trung bình',
    GO_RPW + '\n3. Nhập email đã đăng ký nhưng viết HOA toàn bộ\n4. Bấm Lấy mã OTP',
    'Chuyển sang màn Nhập mã OTP; email OTP gửi tới email đã đăng ký', 128);
  a('RPW-O15', 'AUTH.2-UC2', 'Xác thực OTP', 'OTP đã hết hiệu lực bị từ chối, không chuyển sang màn nhập mật khẩu mới', 'Nghiệp vụ', 'Cao',
    GO_RPW + '\n3. Nhập email đã đăng ký, Lấy mã OTP\n4. Chờ quá thời gian hiệu lực OTP (1 phút)\n5. Nhập OTP nhận được, Xác nhận',
    'Báo OTP đã hết hạn; vẫn ở màn Nhập mã OTP; không chuyển sang màn nhập mật khẩu mới', 23);
  m('RPW-O16', 'AUTH.2-UC2', 'Mail OTP', 'Popup Xem mẫu email chứa mã OTP không có nút "Sao chép mã OTP"', 'UI', 'Thấp',
    '1. Mở popup Xem mẫu email chứa mã OTP', 'Popup không có nút "Sao chép mã OTP"', 25, `Vị trí mở popup — ${BA}`);
  m('RPW-P15', 'AUTH.2-UC3', 'Validate', 'Đặt lại mật khẩu áp dụng chính sách mật khẩu đang cấu hình ở Tham số hệ thống', 'Nghiệp vụ', 'Cao',
    '1. Quản trị hệ thống cấu hình độ dài tối thiểu mật khẩu = 10, Lưu\n2. Thực hiện Quên mật khẩu đến màn nhập mật khẩu mới\n3. Nhập mật khẩu mới 8 ký tự đủ hoa, thường, số, ký tự đặc biệt',
    'Báo không đạt độ dài tối thiểu 10; không cho cập nhật; mật khẩu không đổi', 26);
  a('RPW-P16', 'AUTH.2-UC3', 'Đặt lại mật khẩu', '[API] Đặt lại mật khẩu với mật khẩu mới vi phạm chính sách bị từ chối', 'Bảo mật', 'Cao',
    '1. Lấy OTP hợp lệ cho email thử\n2. [API] POST reset-password với OTP đúng, mật khẩu mới "abc"',
    'HTTP 400 báo mật khẩu không đáp ứng chính sách; mật khẩu không đổi', 128);
  a('RPW-P17', 'AUTH.2-UC3', 'Màn mật khẩu mới', 'Màn Đặt lại mật khẩu hiển thị email của tài khoản, không hiển thị tên đăng nhập', 'UI', 'Trung bình',
    GO_RPW + '\n3. Hoàn tất bước email và OTP đến màn nhập mật khẩu mới',
    'Dòng thông tin tài khoản hiển thị email đã nhập ở bước 1, không phải tên đăng nhập', 217);
  m('RPW-P18', 'AUTH.2-UC3', 'Màn mật khẩu mới', 'Email dài ở màn Đặt lại mật khẩu không bị cắt hoặc đè chữ', 'UI', 'Thấp',
    '1. Dùng tài khoản có email dài (> 35 ký tự)\n2. Quên mật khẩu → hoàn tất email, OTP đến màn nhập mật khẩu mới',
    'Email hiển thị đầy đủ (xuống dòng hoặc rút gọn có tooltip), không đè lên text khác', 217);
  a('RPW-P19', 'AUTH.2-UC3', 'Màn mật khẩu mới', 'Tải lại trang (F5) ở màn Đặt lại mật khẩu không làm mất trạng thái', 'Chức năng', 'Trung bình',
    GO_RPW + '\n3. Hoàn tất email, OTP đến màn nhập mật khẩu mới\n4. Nhấn F5',
    'Vẫn ở màn nhập mật khẩu mới của đúng email (khi OTP còn hiệu lực); không quay về trang đăng nhập không thông báo', 28,
    `Phần "form đặt lại mật khẩu" của issue Toàn hệ thống; hành vi khi OTP đã hết hạn — ${BA}`);
}
