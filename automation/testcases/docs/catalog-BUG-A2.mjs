// Testcase BỔ SUNG từ các bug/góp ý đã log trên GitLab (vdcd-cds-client) — phạm vi: Đơn vị hành chính cấp tỉnh/xã,
// Loại đơn vị, Đơn vị, Tham số hệ thống, Nhật ký truy cập và các issue xuyên suốt (Toàn hệ thống, UI chung, API, Mã/Tên/Tìm kiếm).
// Issue đã có testcase kiểm đúng hành vi thì chỉ truy vết (không viết lại) — xem requirements-BUG-A2.mjs.
// Mỗi case ghi số issue ở cột Ghi chú. Chưa có script automation → Manual.
// Các case "giao diện chung" (căn lề, font, popup, breadcrumb…) đặt ở prefix PRV/ORG, bước cuối lặp lại ở các trang danh mục khác.
export default function defineBUG_A2(t) {
  // Issue còn mở tại thời điểm truy vết (12/11/2026); còn lại đã đóng
  const OPEN = new Set([22, 239, 268]);
  // Case đã có script (scripts/A/<page>-bug-gitlab.spec.ts, ATTT: scripts/ATTT/phan-he-a-bug-gitlab.spec.ts) → Auto
  const AUTO = new Set(['PRV-L13', 'PRV-L15', 'PRV-L16', 'PRV-L17', 'PRV-L18', 'PRV-L19', 'PRV-L20', 'PRV-L21', 'PRV-L22', 'PRV-V05', 'PRV-V06', 'PRV-V07',
    'PRV-C07', 'PRV-C09', 'PRV-C11', 'PRV-C13', 'PRV-C14', 'PRV-E06', 'PRV-E07', 'PRV-E08', 'PRV-D04', 'PRV-D05', 'COM-V03', 'COM-V04', 'COM-V05',
    'UTY-E05', 'UTY-E06', 'ORG-L15', 'ORG-L16', 'ORG-L17', 'ORG-L18', 'ORG-V06', 'ORG-C11', 'ORG-C12', 'ORG-C13', 'ORG-C14', 'ORG-E05', 'ORG-K03',
    'ORG-M04', 'ORG-S03', 'ATA-C12', 'ATA-N25', 'ATU-T05', 'ATG-S04']);
  const m = (id, uc, fn, title, type, pri, steps, exp, issue, note = '') =>
    t(id, uc, fn, title, type, pri, steps, exp, AUTO.has(id) ? 'Auto' : 'Manual — chưa có script',
      `GitLab #${issue}${OPEN.has(issue) ? '' : ' (đã đóng)'}${note ? '. ' + note : ''}`);

  const GO_PRV = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Đơn vị hành chính cấp tỉnh';
  const GO_COM = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Đơn vị hành chính cấp xã';
  const GO_UTY = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Loại đơn vị';
  const GO_ORG = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Đơn vị';
  const GO_PAR = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Tham số hệ thống';
  const GO_LOG = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Nhật ký truy cập';
  const OTHERS = 'Lặp lại ở các trang Đơn vị hành chính cấp xã, Loại đơn vị, Đơn vị';
  const DSG = 'Đối chiếu Figma; issue không ghi giá trị cụ thể — cần BA/Design xác nhận nếu Figma chưa chốt';

  // ===================== Đơn vị hành chính cấp tỉnh =====================
  const L = 'A.IV.1-UC1', C = 'A.IV.1-UC2', E = 'A.IV.1-UC3', D = 'A.IV.1-UC4', V = 'A.IV.1-UC5', X = 'A.IV.1-UC7';
  m('PRV-L13', L, 'Xem danh sách', 'Tỉnh/thành vừa thêm mới hiển thị ở đầu danh sách', 'Chức năng', 'Trung bình',
    GO_PRV + '\n3. Thêm tỉnh/thành mới (mã QCA…) và Lưu\n4. Xem trang 1 của danh sách (không tìm kiếm, không lọc)',
    'Bản ghi vừa tạo nằm ở dòng đầu tiên (STT 1) của trang 1', 111, 'Thực tế: bản ghi mới không nằm đầu danh sách');
  m('PRV-L14', L, 'Giao diện', 'Các màn Đơn vị hành chính cấp tỉnh khớp design DVT-01 đến DVT-05', 'UI', 'Trung bình',
    GO_PRV + '\n3. Lần lượt mở: danh sách, popup Thêm mới, popup Cập nhật, chi tiết tỉnh/thành, hộp xác nhận Xoá\n4. Đối chiếu từng màn với Figma DVT-01…DVT-05',
    'Bố cục, tiêu đề, sub title, nhãn, placeholder, nút, màu và cỡ chữ của cả 5 màn khớp design', 234, DSG);
  m('PRV-L15', L, 'Giao diện chung', 'Căn lề trong bảng: cột chữ căn trái, cột số căn phải', 'UI', 'Thấp',
    GO_PRV + '\n3. Quan sát căn lề tiêu đề và dữ liệu các cột Mã, Tên, Số đơn vị\n4. ' + OTHERS,
    'Cột chữ (Mã, Tên…) căn trái; cột số (STT, Số đơn vị, Số lượng thành viên…) căn phải; tiêu đề cột căn theo dữ liệu', 24,
    'Quy ước áp dụng toàn hệ thống. Cột STT căn phải hay giữa: cần BA xác nhận');
  m('PRV-L16', L, 'Giao diện chung', 'Bảng dữ liệu hiển thị full chiều rộng vùng nội dung, tiêu đề cột cỡ chữ 14px', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở DevTools, kiểm tra chiều rộng bảng và font-size tiêu đề cột\n4. ' + OTHERS,
    'Bảng rộng bằng vùng nội dung (không chừa khoảng trống bên phải); tiêu đề cột font-size = 14px', 173,
    'Thực tế: bảng không full chiều rộng, tiêu đề cột 12px');
  m('PRV-L17', L, 'Giao diện chung', 'Font-weight các cột trong bảng: Mã = 500, cột Thao tác = 600, các cột còn lại = 400', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở DevTools, kiểm tra font-weight ô dữ liệu từng cột\n4. ' + OTHERS,
    'Ô cột Mã font-weight 500; cột Thao tác 600; các cột dữ liệu khác 400', 269, 'Áp dụng mọi table của hệ thống');
  m('PRV-L18', L, 'Giao diện chung', 'Dòng mô tả dưới tiêu đề trang hiển thị đúng cỡ chữ theo design (không quá nhỏ)', 'UI', 'Thấp',
    GO_PRV + '\n3. Kiểm tra font-size dòng mô tả ngay dưới tiêu đề trang\n4. ' + OTHERS,
    'Dòng mô tả có cỡ chữ và màu đúng design, đọc rõ, đồng nhất giữa các trang', 153,
    'Review CĐS 30/10. Cỡ chữ cụ thể: cần BA/Design xác nhận');
  m('PRV-L19', L, 'Giao diện chung', 'Ô chọn số bản ghi/trang ở thanh phân trang không có ô tìm kiếm', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở ô chọn số bản ghi/trang (10/20/50…)\n4. ' + OTHERS,
    'Danh sách lựa chọn mở ra, không có ô nhập tìm kiếm; chọn được giá trị bằng click', 97);
  m('PRV-L20', L, 'Giao diện chung', 'Thu gọn/mở rộng menu bên trái hoạt động', 'Chức năng', 'Trung bình',
    GO_PRV + '\n3. Bấm nút thu gọn menu\n4. Bấm lại để mở rộng; bấm một mục menu khi đang thu gọn',
    'Menu thu gọn còn icon, vùng nội dung giãn ra; mở rộng lại hiện đủ tên mục; khi thu gọn vẫn bấm icon chuyển trang được', 97,
    'Thực tế: menu thu gọn không hoạt động');
  m('PRV-L21', V, 'Giao diện chung', 'Breadcrumb bấm được để quay về trang cấp trên', 'Chức năng', 'Trung bình',
    GO_PRV + '\n3. Mở chi tiết một tỉnh/thành\n4. Bấm mục "Đơn vị hành chính cấp tỉnh" trên breadcrumb\n5. ' + OTHERS + ' (từ màn chi tiết)',
    'Bấm mục breadcrumb cấp trên chuyển về đúng trang danh sách; mục cuối (trang hiện tại) không phải link', 97,
    'Thực tế: breadcrumb không click được');
  m('PRV-L22', X, 'Giao diện chung', 'Nút Xuất Excel đồng nhất màu/kiểu với các nút cùng cấp trên mọi màn danh sách', 'UI', 'Thấp',
    GO_PRV + '\n3. Quan sát nút Xuất Excel cạnh nút Thêm mới\n4. Lặp lại ở Loại đơn vị, Đơn vị, Quản lý tự đánh giá',
    'Nút Xuất Excel cùng kiểu (màu, viền, icon, chiều cao) ở mọi màn theo design', 43,
    'Issue gốc ở màn Quản lý tự đánh giá (màu nút Xuất Excel khác các nút khác)');
  m('PRV-V05', V, 'Xem chi tiết', 'Breadcrumb màn chi tiết tỉnh/thành hiển thị tên tỉnh/thành thay vì "Chi tiết"', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở chi tiết tỉnh "Hà Nội"', 'Mục cuối breadcrumb là "Hà Nội" (tên tỉnh/thành đang xem), không phải "Chi tiết"', 71);
  m('PRV-V06', V, 'Xem chi tiết', 'Ô "Cập nhật lần cuối" ở chi tiết tỉnh/thành có thời gian và tên người cập nhật', 'Chức năng', 'Trung bình',
    GO_PRV + '\n3. Sửa tên một tỉnh/thành QCA và Lưu\n4. Mở chi tiết tỉnh/thành đó',
    'Ô Cập nhật lần cuối hiển thị ngày giờ vừa sửa và họ tên tài khoản đã sửa', 70, 'Thực tế: thiếu tên người cập nhật');
  m('PRV-V07', V, 'Xem chi tiết', 'Đường kẻ dưới tiêu đề "Đơn vị thuộc tỉnh/thành" liền, full chiều rộng khối', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở chi tiết một tỉnh/thành có đơn vị', 'Đường kẻ dưới tiêu đề khối liền mạch, dài bằng chiều rộng khối/bảng', 265,
    'Thực tế: đường kẻ bị đứt, không full chiều rộng');
  m('PRV-C07', C, 'Thêm mới', 'Ô Tên tỉnh/thành ở popup Thêm mới không hiển thị bộ đếm ký tự', 'UI', 'Thấp',
    GO_PRV + '\n3. Bấm Thêm mới\n4. Quan sát và nhập vào ô Tên tỉnh/thành', 'Không có bộ đếm "0 / 255" dưới ô Tên; vẫn chặn nhập quá 255 ký tự', 263);
  m('PRV-C08', C, 'Thêm mới', 'Sub title popup Thêm tỉnh/thành đúng design', 'UI', 'Thấp',
    GO_PRV + '\n3. Bấm Thêm mới', 'Dòng mô tả dưới tiêu đề popup đúng nội dung, cỡ chữ, màu theo design DVT', 10, DSG);
  m('PRV-C09', C, 'Thêm mới', 'Nhãn trường tên ở popup Thêm mới là "Tên tỉnh/thành"', 'UI', 'Thấp',
    GO_PRV + '\n3. Bấm Thêm mới', 'Nhãn trường là "Tên tỉnh/thành" (không phải "Tên tỉnh/thành phố")', 12);
  m('PRV-C10', C, 'Thêm mới', 'Nhập Mã tỉnh/thành đúng 50 ký tự trên form được nhận và lưu thành công', 'Validate', 'Cao',
    GO_PRV + '\n3. Bấm Thêm mới, nhập Mã 50 ký tự hợp lệ (A–Z, 0–9), Tên QCA\n4. Lưu',
    'Ô Mã nhận đủ 50 ký tự (không cắt ở 10); lưu thành công; mã hiển thị đủ 50 ký tự ở danh sách', 140,
    'Thực tế: ô Mã chỉ cho nhập 10 ký tự; quy tắc chung Mã tối đa 50');
  m('PRV-C11', C, 'Giao diện chung', 'Tiêu đề nút, tiêu đề form và nút Lưu thống nhất cho Thêm mới/Chỉnh sửa', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở popup Thêm mới, ghi lại tên nút mở, tiêu đề form, nút lưu\n4. Mở popup Chỉnh sửa, ghi lại tương tự\n5. ' + OTHERS,
    'Mọi trang cùng một quy ước: nút mở "Thêm mới", tiêu đề "Thêm mới <đối tượng>" / "Cập nhật <đối tượng>", nút lưu "Lưu"', 9,
    'Câu chữ cụ thể của quy ước: cần BA xác nhận');
  m('PRV-C12', C, 'Giao diện chung', 'Chữ "(không bắt buộc)" trong nhãn trường hiển thị font thường', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở popup có trường không bắt buộc (vd Mô tả)\n4. ' + OTHERS,
    'Phần nhãn chính đậm theo design; phần "(không bắt buộc)" font-weight thường (400)', 11);
  m('PRV-C13', C, 'Thêm mới', 'Mở lại popup Thêm mới sau khi đã thêm hoặc Hủy thì form trống', 'Chức năng', 'Cao',
    GO_PRV + '\n3. Thêm mới một tỉnh/thành QCA và Lưu thành công\n4. Bấm Thêm mới lần nữa\n5. Nhập dở rồi Hủy, bấm Thêm mới lần nữa\n6. ' + OTHERS,
    'Mỗi lần mở popup Thêm mới các trường đều trống/mặc định, không còn dữ liệu cũ, không còn thông báo lỗi cũ', 116,
    'Thực tế: form Thêm mới còn giữ dữ liệu lần trước');
  m('PRV-C14', C, 'Giao diện chung', 'Các popup đồng bộ vị trí/thứ tự nút, bố cục và kích thước', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở lần lượt popup Thêm mới, Cập nhật, xác nhận Xoá\n4. ' + OTHERS,
    'Popup cùng loại có cùng chiều rộng, căn giữa màn hình, cùng bố cục tiêu đề/mô tả/nội dung; nút Hủy và nút chính cùng vị trí, thứ tự, kích thước', 154,
    'Review CĐS 30/10');
  m('PRV-E06', E, 'Chỉnh sửa', 'Popup Cập nhật tỉnh/thành căn giữa và không hiển thị bộ đếm ký tự', 'UI', 'Thấp',
    GO_PRV + '\n3. Mở menu thao tác của một tỉnh → Cập nhật', 'Popup căn giữa màn hình, bố cục giống popup Thêm mới; ô Tên không có bộ đếm ký tự', 264);
  m('PRV-E07', E, 'Chỉnh sửa', 'Popup Cập nhật tỉnh/thành: nút Lưu bấm được khi dữ liệu hợp lệ và lưu thành công', 'Chức năng', 'Cao',
    GO_PRV + '\n3. Mở Cập nhật một tỉnh QCA\n4. Sửa Tên hợp lệ\n5. Bấm Lưu',
    'Nút Lưu không bị disable sau khi sửa; bấm Lưu thành công, tên mới hiển thị ở danh sách', 264,
    'Thực tế: nút Lưu bị disable. Lưu bật ngay khi mở popup hay chỉ khi có thay đổi: cần BA xác nhận');
  m('PRV-E08', E, 'Chỉnh sửa', 'Tải lại trang (F5) khi đang mở popup Chỉnh sửa không làm mất vị trí đang làm việc', 'Chức năng', 'Trung bình',
    GO_PRV + '\n3. Chuyển sang trang 2 của danh sách\n4. Mở Cập nhật một tỉnh, sửa Tên (chưa Lưu)\n5. Nhấn F5',
    'Có cảnh báo rời trang khi có dữ liệu chưa lưu; sau tải lại vẫn ở trang 2 của danh sách (không về trang 1), dữ liệu tỉnh không bị đổi', 28,
    'Issue gộp nhiều màn (phân trang, form chỉnh sửa, form đặt lại mật khẩu). Popup có phải mở lại sau F5 hay không: cần BA xác nhận');
  m('PRV-D04', D, 'Xóa', 'Menu thao tác của tỉnh/thành đã có đơn vị tham chiếu không có mục Xoá', 'Nghiệp vụ', 'Cao',
    GO_PRV + '\n3. Tạo tỉnh QCA và một đơn vị tham chiếu tỉnh đó\n4. Mở menu thao tác của tỉnh QCA trên danh sách và ở màn chi tiết',
    'Không có mục/nút Xoá; tỉnh chưa có đơn vị tham chiếu vẫn có Xoá', 46, 'Trùng nội dung #57. Bổ sung cho PRV-D02 (chặn khi gọi xóa)');
  m('PRV-D05', D, 'Giao diện chung', 'Hộp xác nhận Xoá có nội dung theo thao tác và nút "Có" màu đỏ theo logo', 'UI', 'Thấp',
    GO_PRV + '\n3. Chọn Xoá một tỉnh chưa có đơn vị\n4. ' + OTHERS,
    'Tiêu đề/nội dung nêu rõ thao tác và đối tượng (vd "Xoá tỉnh/thành <tên>?"); nút Có màu đỏ theo logo, nút Không màu phụ', 35,
    'Áp dụng mọi popup xác nhận của hệ thống');

  // ===================== Đơn vị hành chính cấp xã =====================
  m('COM-L14', 'A.IV.2-UC1', 'Giao diện', 'Các màn Đơn vị hành chính cấp xã khớp design DVX-01 đến DVX-05', 'UI', 'Trung bình',
    GO_COM + '\n3. Lần lượt mở: danh sách, popup Thêm mới, popup Cập nhật, chi tiết xã/phường, hộp xác nhận Xoá\n4. Đối chiếu với Figma DVX-01…DVX-05',
    'Bố cục, tiêu đề, sub title, nhãn, placeholder, nút, màu và cỡ chữ của cả 5 màn khớp design', 235, DSG);
  m('COM-V03', 'A.IV.2-UC5', 'Xem chi tiết', 'Chi tiết xã/phường không có link "Mở module Đơn vị"', 'UI', 'Thấp',
    GO_COM + '\n3. Mở chi tiết một xã/phường', 'Không có link/nút "Mở module Đơn vị" (chỉ có ở chi tiết tỉnh/thành)', 71);
  m('COM-V04', 'A.IV.2-UC5', 'Xem chi tiết', 'Breadcrumb màn chi tiết xã/phường hiển thị tên xã/phường thay vì "Chi tiết"', 'UI', 'Thấp',
    GO_COM + '\n3. Mở chi tiết một xã/phường', 'Mục cuối breadcrumb là tên xã/phường đang xem, không phải "Chi tiết"', 71);
  m('COM-V05', 'A.IV.2-UC5', 'Xem chi tiết', 'Trường "Loại" của xã/phường có giá trị mặc định là "Xã"', 'Chức năng', 'Trung bình',
    GO_COM + '\n3. Thêm xã/phường QCA không chọn Loại, Lưu\n4. Mở chi tiết xã/phường vừa tạo',
    'Trường Loại hiển thị "Xã" (ở form Thêm mới được chọn sẵn "Xã")', 72,
    'Danh sách giá trị Loại và việc chọn sẵn ở form Thêm mới: cần BA xác nhận');
  m('COM-V06', 'A.IV.2-UC5', 'Giao diện', 'Trang chi tiết xã/phường khớp design', 'UI', 'Thấp',
    GO_COM + '\n3. Mở chi tiết một xã/phường có đơn vị\n4. Đối chiếu Figma DVX', 'Khối thông tin, bảng đơn vị thuộc xã, nút thao tác đúng bố cục và kiểu chữ theo design', 266, DSG);
  m('COM-C06', 'A.IV.2-UC2', 'Thêm mới', 'Nhập Mã xã/phường đúng 50 ký tự trên form được nhận và lưu thành công', 'Validate', 'Cao',
    GO_COM + '\n3. Bấm Thêm mới, nhập Mã 50 ký tự hợp lệ, Tên QCA, chọn tỉnh\n4. Lưu',
    'Ô Mã nhận đủ 50 ký tự (không cắt ở 10); lưu thành công; mã hiển thị đủ ở danh sách', 140,
    'Thực tế: ô Mã chỉ cho nhập 10 ký tự; quy tắc chung Mã tối đa 50');
  m('COM-C07', 'A.IV.2-UC2', 'Giao diện', 'Popup Thêm mới/Chỉnh sửa xã/phường khớp design', 'UI', 'Thấp',
    GO_COM + '\n3. Mở popup Thêm mới\n4. Mở popup Chỉnh sửa một xã/phường\n5. Đối chiếu Figma DVX',
    'Tiêu đề, sub title, nhãn, placeholder, bộ đếm ký tự, nút của 2 popup đúng design', 266, DSG);

  // ===================== Loại đơn vị =====================
  m('UTY-L14', 'A.IV.3-UC1', 'Giao diện', 'Các màn Loại đơn vị khớp design LDV-01 đến LDV-05c', 'UI', 'Trung bình',
    GO_UTY + '\n3. Lần lượt mở: danh sách, popup Thêm mới, popup Cập nhật, chi tiết, hộp xác nhận Xoá\n4. Đối chiếu Figma LDV-01…LDV-05c',
    'Bố cục, tiêu đề, nhãn, nút, màu và cỡ chữ của các màn khớp design; header bảng và label trạng thái đúng design', 237, DSG + '. #267: danh sách chưa đúng thiết kế');
  m('UTY-V04', 'A.IV.3-UC3', 'Giao diện', 'Màn chi tiết Loại đơn vị khớp design Figma', 'UI', 'Thấp',
    GO_UTY + '\n3. Mở chi tiết một loại đơn vị có đơn vị\n4. Đối chiếu Figma',
    'Khối thông tin (Mã loại, Cấp hành chính, Mô tả, Số đơn vị, Cập nhật lần cuối), bảng đơn vị và nút thao tác đúng design', 44, DSG);
  m('UTY-C08', 'A.IV.3-UC4', 'Giao diện', 'Popup Thêm mới/Cập nhật loại đơn vị khớp design', 'UI', 'Thấp',
    GO_UTY + '\n3. Mở popup Thêm mới\n4. Mở popup Cập nhật một loại\n5. Đối chiếu Figma LDV',
    'Tiêu đề, mô tả, nhãn, placeholder, nút của 2 popup đúng design; popup Cập nhật cùng bố cục popup Thêm mới', 267, DSG);
  m('UTY-E05', 'A.IV.3-UC5', 'Chỉnh sửa', 'Chọn Chỉnh sửa ở danh sách Loại đơn vị mở popup với dữ liệu hiện tại', 'Chức năng', 'Cao',
    GO_UTY + '\n3. Mở menu thao tác của một loại → Chỉnh sửa/Cập nhật',
    'Popup Cập nhật hiển thị, điền sẵn Mã (khóa), Tên, Cấp hành chính, Mô tả hiện tại', 49,
    'Tiêu đề issue ghi "Form Chỉnh sửa nhóm người dùng" nhưng gắn [Loại đơn vị]: thực tế không hiển thị popup');
  m('UTY-E06', 'A.IV.3-UC5', 'Chỉnh sửa', 'Nút Cập nhật ở màn chi tiết Loại đơn vị mở popup giống form Thêm mới', 'Chức năng', 'Trung bình',
    GO_UTY + '\n3. Mở chi tiết một loại\n4. Bấm Cập nhật\n5. Sửa Mô tả và Lưu',
    'Mở popup (không chuyển trang) cùng bố cục popup Thêm mới, dữ liệu điền sẵn; Lưu thành công, chi tiết cập nhật ngay', 65);
  m('UTY-M01', 'A.IV.3-UC3', 'Thêm đơn vị vào loại', 'Loại cấp Trung ương: popup Thêm đơn vị chỉ liệt kê đơn vị không tham chiếu tỉnh/thành', 'Nghiệp vụ', 'Cao',
    GO_UTY + '\n3. Chuẩn bị 1 đơn vị QCA có tỉnh tham chiếu và 1 đơn vị QCA không có\n4. Mở chi tiết một loại cấp Trung ương → Thêm đơn vị',
    'Danh sách chọn có đơn vị không tham chiếu tỉnh, không có đơn vị đang tham chiếu tỉnh', 101,
    'Quy tắc tương ứng cho loại cấp tỉnh/cấp xã: cần BA xác nhận');

  // ===================== Đơn vị =====================
  m('ORG-L14', 'A.IV.4-UC1', 'Giao diện', 'Các màn Đơn vị khớp design DV-01 đến DV-07', 'UI', 'Trung bình',
    GO_ORG + '\n3. Lần lượt mở: danh sách, popup Thêm mới, popup Cập nhật, chi tiết, các popup thao tác\n4. Đối chiếu Figma DV-01…DV-07',
    'Bố cục, tiêu đề, nhãn, nút, màu và cỡ chữ của các màn khớp design', 238, DSG + '. #268 (đang mở): danh sách chưa đúng thiết kế');
  m('ORG-L15', 'A.IV.4-UC1', 'Xem danh sách', 'Đơn vị vừa thêm mới hiển thị ở đầu danh sách', 'Chức năng', 'Trung bình',
    GO_ORG + '\n3. Thêm đơn vị QCA và Lưu\n4. Xem trang 1 (không tìm kiếm, không lọc)', 'Đơn vị vừa tạo nằm ở dòng đầu tiên của trang 1', 76);
  m('ORG-L16', 'A.IV.4-UC1', 'Xem danh sách', 'Tải lại trang (F5) giữ nguyên trang, từ khóa và bộ lọc đang chọn', 'Chức năng', 'Trung bình',
    GO_ORG + '\n3. Nhập từ khóa, chọn bộ lọc Loại đơn vị, chuyển sang trang 2\n4. Nhấn F5',
    'Sau tải lại vẫn ở trang 2 với đúng từ khóa và bộ lọc, cùng kết quả như trước F5', 28,
    'Đã có ở C: RES-L84, RES-B73; case này kiểm ở Phân hệ A');
  m('ORG-L17', 'A.IV.4-UC3', 'Xem chi tiết', 'Quay lại từ màn chi tiết đơn vị giữ nguyên từ khóa, bộ lọc và trang', 'Chức năng', 'Cao',
    GO_ORG + '\n3. Nhập từ khóa, chọn bộ lọc, chuyển sang trang 2\n4. Mở chi tiết một đơn vị\n5. Bấm nút Quay lại (lặp lại với nút Back trình duyệt)',
    'Về danh sách với đúng từ khóa, bộ lọc và trang 2 như trước khi xem chi tiết', 113, 'Đã có ở C/E: RES-V16, RES-D42, ANS-V06; case này kiểm ở Phân hệ A');
  m('ORG-L18', 'A.IV.4-UC3', 'Xem chi tiết', 'Quay lại từ chi tiết thì dòng đơn vị vừa xem được làm nổi (highlight) trong danh sách', 'UI', 'Thấp',
    GO_ORG + '\n3. Mở chi tiết đơn vị ở dòng thứ 5\n4. Bấm Quay lại',
    'Dòng đơn vị vừa xem được tô nền/nổi bật theo design và nằm trong vùng nhìn thấy', 155, 'Review CĐS 30/10 — áp dụng chung các danh sách có màn chi tiết');
  m('ORG-V05', 'A.IV.4-UC9', 'Giao diện', 'Bộ lọc bảng "Người dùng trong đơn vị" (ô tìm kiếm, select vai trò) khớp design', 'UI', 'Thấp',
    GO_ORG + '\n3. Mở chi tiết một đơn vị có người dùng\n4. Đối chiếu ô tìm kiếm và select Vai trò với Figma',
    'Ô tìm kiếm và select Vai trò đúng vị trí, kích thước, placeholder, giá trị mặc định theo design', 87, DSG);
  m('ORG-V06', 'A.IV.4-UC9', 'Người dùng trong đơn vị', 'Cột thao tác của bảng "Người dùng trong đơn vị" có tiêu đề "Thao tác"', 'UI', 'Thấp',
    GO_ORG + '\n3. Mở chi tiết một đơn vị có người dùng', 'Cột cuối (icon thao tác) có tiêu đề "Thao tác"', 218);
  m('ORG-C10', 'A.IV.4-UC4', 'Giao diện', 'Popup Thêm mới/Cập nhật đơn vị khớp design', 'UI', 'Trung bình',
    GO_ORG + '\n3. Mở popup Thêm mới\n4. Mở popup Cập nhật một đơn vị\n5. Đối chiếu Figma DV',
    'Tiêu đề, mô tả, thứ tự trường, nhãn, placeholder, nút của 2 popup đúng design', 47, DSG + '. #268 (đang mở): popup Thêm/Cập nhật chưa đúng thiết kế');
  m('ORG-C11', 'A.IV.4-UC4', 'Thêm mới', 'Chọn tỉnh/thành có xã trực thuộc thì hiện trường chọn Xã/Phường, chỉ liệt kê xã thuộc tỉnh đó', 'Chức năng', 'Cao',
    GO_ORG + '\n3. Bấm Thêm mới, chọn Loại đơn vị cấp xã\n4. Chọn tỉnh/thành có xã trực thuộc\n5. Mở trường Xã/Phường, chọn một xã, Lưu',
    'Trường Xã/Phường hiển thị sau khi chọn tỉnh; chỉ có xã thuộc tỉnh đã chọn; lưu thành công, chi tiết đơn vị hiển thị đúng xã', 77,
    'Liên quan ORG-C09 (chỉ đơn vị loại cấp xã được tham chiếu xã). Trường hiện với mọi loại hay chỉ loại cấp xã: cần BA xác nhận');
  m('ORG-C12', 'A.IV.4-UC4', 'Thêm mới', 'Số điện thoại đơn vị sai định dạng bị chặn', 'Validate', 'Trung bình',
    GO_ORG + '\n3. Bấm Thêm mới, nhập đủ trường bắt buộc\n4. Nhập Số điện thoại "abc123"\n5. Lưu',
    'Báo lỗi định dạng số điện thoại dưới ô; không tạo bản ghi', 102, 'Quy tắc định dạng SĐT (độ dài, đầu số, cho phép +84): cần BA xác nhận');
  m('ORG-C13', 'A.IV.4-UC4', 'Thêm mới', 'Số điện thoại hợp lệ được lưu và hiển thị lại ở chi tiết và form Cập nhật', 'Chức năng', 'Trung bình',
    GO_ORG + '\n3. Thêm đơn vị QCA với Số điện thoại 0912345678, Lưu\n4. Mở chi tiết, rồi mở Cập nhật',
    'Chi tiết và form Cập nhật hiển thị đúng 0912345678', 102, 'Thực tế: Đơn vị cha và SĐT không lưu (Đơn vị cha xem ORG-C05)');
  m('ORG-C14', 'A.IV.4-UC4', 'Giao diện chung', 'Các ô chọn (Loại đơn vị, Tỉnh/thành, Đơn vị cha) có ô tìm kiếm', 'Chức năng', 'Trung bình',
    GO_ORG + '\n3. Bấm Thêm mới\n4. Mở từng ô chọn, gõ một phần tên',
    'Mỗi ô chọn có tìm kiếm; danh sách lọc theo chuỗi đã gõ (không phân biệt hoa/thường)', 97, 'Áp dụng chung các select dài trong hệ thống');
  m('ORG-E05', 'A.IV.4-UC5', 'Chỉnh sửa', 'Form Cập nhật đơn vị hiển thị tên Loại đơn vị, không hiển thị ID (UUID)', 'Chức năng', 'Cao',
    GO_ORG + '\n3. Mở Cập nhật một đơn vị đã có Loại đơn vị', 'Trường Loại đơn vị hiển thị tên loại đang gán (vd "Sở"), không phải chuỗi UUID', 274);
  m('ORG-K03', 'A.IV.4-UC7', 'Giao diện chung', 'Hộp xác nhận Khoá/Mở khoá đơn vị có nội dung theo thao tác và nút "Có" màu đỏ', 'UI', 'Thấp',
    GO_ORG + '\n3. Chọn Khoá một đơn vị\n4. Chọn Mở khoá một đơn vị đã khóa',
    'Mỗi hộp xác nhận nêu đúng thao tác và tên đơn vị; nút Có màu đỏ theo logo', 35);
  m('ORG-M04', 'A.IV.4-UC11', 'Thêm người dùng', 'Popup Thêm người dùng vào đơn vị không liệt kê người dùng đã thuộc đơn vị đó', 'Nghiệp vụ', 'Cao',
    GO_ORG + '\n3. Mở chi tiết một đơn vị đang có người dùng A\n4. Bấm Thêm người dùng vào đơn vị, tìm A',
    'Người dùng A không có trong danh sách chọn', 45);
  m('ORG-R03', 'A.IV.4-UC8', 'Tham chiếu tỉnh', 'Popup Đổi tỉnh tham chiếu hiển thị 2 nút Huỷ và Lưu đúng design', 'UI', 'Thấp',
    GO_ORG + '\n3. Mở chi tiết một đơn vị → Đổi tỉnh tham chiếu', 'Nút Huỷ (phụ) và Lưu (chính) đúng màu, kích thước, thứ tự, căn lề theo design', 75);
  m('ORG-S03', 'A.IV.4-UC1', 'Phân quyền', '[API] API phân quyền đơn vị kiểm tra quyền theo ma trận quyền của Cán bộ', 'Bảo mật', 'Cao',
    '1. Lấy ma trận quyền của tài khoản Cán bộ (permission-matrix/me)\n2. Bằng token Cán bộ gọi các API thao tác phân quyền/người dùng của đơn vị mà ma trận không cấp',
    'API không được cấp quyền trả 403, không thay đổi dữ liệu; API được cấp vẫn hoạt động', 133, 'Thực tế: trả 200 thay vì 403');

  // ===================== Tham số hệ thống =====================
  m('ATA-C12', 'ATTT KT 1.3.4', 'Tham số hệ thống', 'Tab Minh chứng có phần chọn định dạng tệp cho phép và lưu được', 'Chức năng', 'Trung bình',
    GO_PAR + '\n3. Mở tab Minh chứng\n4. Bỏ chọn một định dạng (vd .docx), Lưu\n5. Tải lại trang\n6. Khôi phục cấu hình',
    'Tab Minh chứng có danh sách định dạng tệp (pdf, docx, xlsx, jpg, png…) chọn/bỏ được; sau tải lại giữ đúng lựa chọn đã lưu', 22,
    'Danh sách định dạng theo design TS: cần BA xác nhận. Manual: thay đổi tham số ảnh hưởng toàn môi trường');
  m('ATA-C13', 'ATTT KT 1.3.4', 'Tham số hệ thống', 'Định dạng tệp bị bỏ chọn ở tab Minh chứng không tải lên được làm minh chứng', 'Nghiệp vụ', 'Trung bình',
    '1. Ở Tham số hệ thống → Minh chứng bỏ chọn .docx, Lưu\n2. Đăng nhập Cán bộ, tải tệp .docx làm minh chứng ở màn chấm điểm\n3. Khôi phục cấu hình',
    'Tệp .docx bị từ chối với thông báo định dạng không cho phép (FE và API); tệp .pdf vẫn tải được', 22,
    'Manual: thay đổi tham số ảnh hưởng toàn môi trường — chạy trên môi trường riêng');
  m('ATA-C14', 'ATTT KT 1.3.1c-2', 'Tham số hệ thống', 'Cấu hình "Không dùng lại N mật khẩu cũ" có hiệu lực khi đổi/đặt lại mật khẩu', 'Bảo mật', 'Cao',
    '1. Ở Tham số hệ thống đặt "Không dùng lại N mật khẩu cũ" = 3, Lưu\n2. Bằng tài khoản QCA đổi mật khẩu A → B → C\n3. Đổi tiếp về A, rồi về B\n4. Đổi sang mật khẩu D chưa từng dùng\n5. Khôi phục tham số',
    'Bước 3 bị từ chối với thông báo không được dùng lại 3 mật khẩu gần nhất (FE và API); bước 4 thành công', 64,
    'Thực tế: đổi nhiều lần vẫn dùng lại được cùng một mật khẩu. Manual: thay đổi tham số ảnh hưởng toàn môi trường');
  m('ATA-C15', 'ATTT KT 1.3.1c-2', 'Tham số hệ thống', 'Các màn Tham số hệ thống khớp design TS-01 đến TS-04', 'UI', 'Thấp',
    GO_PAR + '\n3. Mở lần lượt các tab/màn TS-01…TS-04\n4. Đối chiếu Figma', 'Bố cục, tab, nhãn, ô nhập, nút Lưu/Hủy, thông báo đúng design', 236, DSG);

  // ===================== Nhật ký truy cập =====================
  m('ATA-N24', 'ATTT KT 1.3.3a-3', 'Nhật ký', 'Lỗi hệ thống (HTTP 500) ở Phân hệ A được ghi nhật ký loại "Lỗi hệ thống"', 'Bảo mật', 'Cao',
    '1. Ghi nhận T0\n2. Gây một lỗi 500 ở API Phân hệ A (dùng request đã biết gây 500 trên môi trường thử)\n3. Đăng nhập Quản trị hệ thống, tra Nhật ký truy cập từ T0, lọc Loại = Lỗi hệ thống',
    'Có bản ghi Loại = Lỗi hệ thống, đúng chức năng/API, Kết quả = Thất bại, có mã lỗi/trace id; người dùng cuối chỉ nhận thông báo chung', 209,
    'Cách gây 500 ổn định phụ thuộc môi trường — Manual');
  m('ATA-N25', 'ATTT NK-02', 'Nhật ký', 'Màn Nhật ký truy cập không có text phụ thừa và không có cột Thiết bị', 'UI', 'Thấp',
    GO_LOG, 'Bảng không có cột Thiết bị; các ô không có dòng chữ phụ thừa dưới giá trị chính (theo design)', 157,
    'Review CĐS 30/10. Thông tin thiết bị/user agent xem ở chi tiết bản ghi (ATA-N13)');
  m('ATA-N26', 'ATTT NK-02', 'Nhật ký', 'Các màn Nhật ký truy cập khớp design NK-01 đến NK-05', 'UI', 'Thấp',
    GO_LOG + '\n3. Mở lần lượt danh sách, bộ lọc, chi tiết bản ghi, xuất Excel (NK-01…NK-05)\n4. Đối chiếu Figma',
    'Bố cục, cột, bộ lọc, chi tiết, nút đúng design', 239, DSG);

  // ===================== Xác thực / API chung =====================
  m('ATU-T05', 'ATTT KT 1.3.2b', 'Phiên đăng nhập', 'Mở hệ thống ở tab mới cùng trình duyệt khi tab đầu đã đăng nhập thì dùng chung phiên', 'Chức năng', 'Cao',
    '1. Đăng nhập ở tab 1\n2. Mở tab mới cùng trình duyệt, truy cập URL trang chủ và URL một màn nghiệp vụ',
    'Tab 2 vào thẳng màn đã mở, không bị yêu cầu đăng nhập lại; đăng xuất ở một tab thì tab kia cũng hết phiên (LGO-S03)', 132,
    'Thực tế: tab mới bị yêu cầu đăng nhập lại');
  m('ATG-S04', 'ATTT KT 1.3.1a', 'Phân quyền BE', '[API] Vai trò không có quyền chấm điểm/xem kết quả không tải được tệp minh chứng kết quả tự đánh giá', 'Bảo mật', 'Cao',
    '1. Lấy URL/id tệp minh chứng của một kết quả tự đánh giá\n2. Bằng token tài khoản không có quyền chấm điểm/xem kết quả đó gọi API tải tệp\n3. Lặp lại với token hợp lệ có quyền',
    'Bước 2 trả 403, không trả nội dung tệp; bước 3 tải được tệp', 198,
    'Thực tế: vai trò không có quyền chấm điểm vẫn tải được minh chứng. Những vai trò được xem minh chứng (Lãnh đạo, Phía Bộ): cần BA xác nhận');
}
