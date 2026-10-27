// Testcase A.II.3 "Phân quyền cho nhóm người dùng" — màn hình "Ma trận phân quyền" (PRM).
// UC_1409 dòng 37–39:  UC1 xem danh sách chức năng đã phân quyền của nhóm · UC2 phân quyền · UC3 hủy phân quyền.
// Nguồn thêm: SRS §2.1 (quyền kèm phạm vi 3 mức), ATTT (KT 1.3.3a-4, NK-11: sửa ma trận phải ghi nhật ký).
// Hành vi đã khảo sát (UI + API, tài khoản admin; dữ liệu ghi chỉ trên nhóm QCA… tự tạo rồi dọn):
//   Menu Quản trị hệ thống → "Ma trận phân quyền" (#/vi/permission-matrix[?roleId=…]). Trái: danh sách nhóm kèm "n/104"; phải: cây Module A–E → Chức năng → Quyền con
//   (checkbox + ô Phạm vi), ô tìm, tab Tất cả/Đã cấp/Chưa cấp, Mở rộng/Thu gọn tất cả, Xuất Excel (phan-quyen-<mã nhóm>.xlsx), nút Hủy thay đổi, Lưu (khóa khi chưa có thay đổi).
//   Danh mục: 5 module · 23 chức năng · 104 quyền (A 46 · B 32 · C 8 · D 8 · E 10); phạm vi unit / unitAndChildren / all; quyền chỉ cho "all" (vd Sao lưu, Thêm tỉnh) chỉ có 1 lựa chọn.
//   API: GET idm/permission-matrix (danh mục) · GET …/roles (nhóm + grantedCount + memberCount) · GET/PUT …/roles/{id} {permissions:[{code,scope}]}; PUT = thay thế toàn bộ.
//     Quyền: chỉ admin/superadmin (200); 6 vai trò còn lại 403 (trừ GET …/me = 200); không token 401. Nhóm hệ thống (SUPER_ADMIN) PUT → 400 "Không thể thay đổi quyền của nhóm người dùng hệ thống".
//     Mã quyền lạ / trùng / body sai → 400; scope sai / ngoài tập / thiếu → 200 kèm data.ignored[{code,reason}] (INVALID_SCOPE · SCOPE_NOT_ALLOWED · MISSING_SCOPE); id nhóm lạ → 404.
//     Xóa nhóm còn quyền → 400 "Không thể xóa: nhóm quyền đang gán N quyền…" (phải gỡ hết quyền trước).
//   LỆCH / NGHI LỖI đã thấy: (1) PUT body {} (thiếu "permissions") xóa sạch quyền, trong khi null → 400; (2) Lưu thành công không hiện thông báo; (3) chuyển nhóm khi có thay đổi chưa lưu → mất thay đổi, không cảnh báo;
//   (4) UI cho tick/bỏ quyền của nhóm hệ thống dù server từ chối; (5) cho cấp Sửa/Xóa mà không có Xem;
//   (6) thông báo lỗi 4xx/5xx hiển thị nguyên văn message của server; (7) tick lại từng quyền giữ phạm vi cũ, tick lại cả chức năng về mặc định.
export default function definePrm(t) {
  const c = (id, uc, fn, title, type, pri, steps, exp, note = '') => t(id, uc, fn, title, type, pri, steps, exp, 'Auto', note);
  const BA = 'Cần BA xác nhận quy tắc';
  const CAP = 'Manual — cần đăng nhập bằng tài khoản thuộc nhóm đang sửa (captcha), không tự động được';
  const m = (id, uc, fn, title, type, pri, steps, exp, note = '', why = CAP) => t(id, uc, fn, title, type, pri, steps, exp, why, note);
  const U1 = 'A.II.3-UC1', U2 = 'A.II.3-UC2', U3 = 'A.II.3-UC3';
  const OPEN = '1. Đăng nhập admin\n2. Menu Quản trị hệ thống → Ma trận phân quyền';
  const NEWGRP = '[API] Tạo nhóm QCA… (chưa có quyền)';

  // ===================== UC1 Xem danh sách chức năng đã phân quyền của nhóm =====================
  c('PRM-L01', U1, 'Truy cập', 'Admin thấy mục "Ma trận phân quyền" trong menu Quản trị hệ thống và mở được trang', 'Chức năng', 'Cao',
    OPEN, 'Menu có mục "Ma trận phân quyền"; mở trang với tiêu đề "Ma trận phân quyền" và mô tả "Chọn nhóm người dùng, cấp hoặc hủy từng quyền và chọn phạm vi dữ liệu của quyền đó."');
  c('PRM-L02', U1, 'Danh sách nhóm', 'Danh sách nhóm bên trái đủ nhóm như API, mỗi nhóm có tên, mô tả (nếu có) và số quyền "n/104"', 'Chức năng', 'Cao',
    OPEN + '\n3. [API] GET idm/permission-matrix/roles', 'Số nhóm hiển thị = số nhóm của API; tên và "grantedCount/104" của từng nhóm khớp API; nhóm hệ thống có biểu tượng khóa');
  c('PRM-L03', U1, 'Danh sách nhóm', 'Mở trang không kèm roleId thì tự chọn nhóm đầu tiên và hiển thị quyền của nhóm đó', 'Chức năng', 'Trung bình',
    OPEN, 'Một nhóm được đánh dấu đang chọn; panel bên phải hiển thị tên nhóm, số quyền đã cấp và cây quyền');
  c('PRM-L04', U1, 'Tìm kiếm', 'Tìm theo tên chức năng chỉ giữ các chức năng khớp', 'Chức năng', 'Cao',
    OPEN + '\n3. Nhập "nhật ký" vào ô "Tìm chức năng hoặc quyền"', 'Chỉ còn module chứa chức năng "Nhật ký truy cập" và chức năng đó; các chức năng khác bị ẩn');
  c('PRM-L05', U1, 'Tìm kiếm', 'Tìm không phân biệt chữ hoa/chữ thường', 'Chức năng', 'Trung bình',
    OPEN + '\n3. Nhập "NHẬT KÝ", sau đó "nhật ký"', 'Hai lần tìm trả về cùng danh sách chức năng');
  c('PRM-L06', U1, 'Tìm kiếm', 'Tìm theo tên quyền con (vd "Xuất Excel") hiện mọi chức năng có quyền đó', 'Chức năng', 'Trung bình',
    OPEN + '\n3. Nhập "xuất excel"', 'Hiện các chức năng có quyền con "Xuất Excel" (vd Quản lý người dùng, Quản lý nhóm người dùng, Phân quyền cho nhóm người dùng…); không hiện chức năng không có quyền đó (vd Sao lưu dữ liệu)');
  c('PRM-L07', U1, 'Tìm kiếm', 'Từ khóa không tồn tại hiện thông báo không tìm thấy', 'Chức năng', 'Cao',
    OPEN + '\n3. Nhập "zzqcxx_khongtontai_999"', 'Hiện "Không tìm thấy chức năng hoặc quyền phù hợp"; không lỗi');
  c('PRM-L08', U1, 'Tìm kiếm', 'Ký tự đặc biệt / chuỗi SQL / HTML trong ô tìm kiếm không gây lỗi', 'Bảo mật', 'Cao',
    OPEN + `\n3. Nhập  ' OR 1=1 --  và  <script>alert(1)</script>`, 'Không thực thi script, không trắng trang; hiện trạng thái không tìm thấy; xóa từ khóa thì cây trở lại đầy đủ');
  c('PRM-L09', U1, 'Bộ lọc', 'Tab "Đã cấp" chỉ hiện chức năng/quyền đã cấp, tab "Chưa cấp" chỉ hiện quyền chưa cấp', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + ' rồi [API] cấp USER.VIEW, USER.CREATE, BACKUP.VIEW\n2. Mở Ma trận phân quyền, chọn nhóm vừa tạo\n3. Bấm tab "Đã cấp"\n4. Bấm tab "Chưa cấp"',
    'Tab "Đã cấp": chỉ có chức năng Quản lý người dùng (Xem, Thêm) và Sao lưu dữ liệu (Xem); tab "Chưa cấp": không còn quyền Xem/Thêm của Quản lý người dùng và Xem của Sao lưu, các quyền còn lại vẫn hiện');
  c('PRM-L10', U1, 'Bộ lọc', 'Tab "Tất cả" trả lại đầy đủ sau khi lọc; tab kết hợp với ô tìm kiếm', 'Chức năng', 'Trung bình',
    OPEN + '\n3. Bấm tab "Đã cấp", nhập "người dùng"\n4. Bấm tab "Tất cả", xóa từ khóa', 'Bước 3: chỉ các chức năng đã cấp có chữ "người dùng"; bước 4: hiển thị đủ 23 chức năng như ban đầu');
  c('PRM-L11', U1, 'Hiển thị', 'Nút "Mở rộng tất cả" / "Thu gọn tất cả" mở và đóng toàn bộ chức năng', 'UI', 'Thấp',
    OPEN + '\n3. Bấm "Thu gọn tất cả"\n4. Bấm "Mở rộng tất cả"', 'Sau Thu gọn: không còn dòng quyền con nào; sau Mở rộng: mọi chức năng đều mở và thấy các quyền con');
  c('PRM-L12', U1, 'Xuất Excel', 'Xuất Excel tải về file .xlsx đúng tên và có nội dung phân quyền của nhóm đang chọn', 'Chức năng', 'Trung bình',
    '1. ' + NEWGRP + ' rồi [API] cấp USER.VIEW\n2. Mở Ma trận phân quyền, chọn nhóm vừa tạo\n3. Bấm "Xuất Excel"', 'Tải về file phan-quyen-<mã nhóm>.xlsx, dung lượng > 0, là file xlsx hợp lệ và có tên chức năng "Quản lý người dùng"');

  c('PRM-V01', U1, 'Xem quyền của nhóm', 'Chọn nhóm hiển thị đúng tên, mô tả, số quyền và từng quyền/phạm vi theo API', 'Chức năng', 'Cao',
    '1. [API] Tạo nhóm QCA… có mô tả, cấp USER.VIEW=unit, ROLE.VIEW=all, BACKUP.VIEW=all\n2. Mở Ma trận phân quyền\n3. Chọn nhóm vừa tạo',
    'Tiêu đề = tên nhóm, mô tả hiển thị; "3 / 104 quyền đã cấp"; đúng 3 quyền được tick với phạm vi "Đơn vị", "Toàn hệ thống", "Toàn hệ thống"; các quyền khác không tick');
  c('PRM-V02', U1, 'Cấu trúc ma trận', 'Cấu trúc ma trận gồm 5 module, 23 chức năng, 104 quyền với bộ đếm đúng', 'Chức năng', 'Cao',
    OPEN + '\n3. Bấm "Mở rộng tất cả", đếm module/chức năng/quyền con\n4. [API] GET idm/permission-matrix', 'Có module A (46), B (32), C (8), D (8), E (10); tổng 23 chức năng, 104 quyền con; ba cột "CHỨC NĂNG / QUYỀN", "CẤP QUYỀN", "PHẠM VI"; khớp danh mục API');
  c('PRM-V03', U1, 'Cấu trúc ma trận', 'Tên và mô tả quyền con khớp danh mục của API', 'Chức năng', 'Trung bình',
    OPEN + '\n3. Mở rộng tất cả\n4. So tên quyền con và tooltip (title) với API danh mục', 'Mọi quyền con có tên đúng "name" của API (Xem, Thêm, Sửa, Xóa, Khóa, Xuất Excel, Phê duyệt…) và tooltip đúng "description"');
  c('PRM-V04', U1, 'Xem quyền của nhóm', 'Nhóm chưa có quyền hiển thị 0/104, không tick quyền nào và phạm vi hiển thị "–"', 'Chức năng', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Mở Ma trận phân quyền, chọn nhóm vừa tạo, Mở rộng tất cả', '"0 / 104 quyền đã cấp"; mọi checkbox bỏ trống; cột Phạm vi hiển thị "–"; nút Lưu bị khóa');
  c('PRM-V05', U1, 'Xem quyền của nhóm', 'Nhóm hệ thống "Quản trị hệ thống" hiển thị 104/104 quyền, phạm vi Toàn hệ thống', 'Chức năng', 'Trung bình',
    OPEN + '\n3. Chọn nhóm "Quản trị hệ thống" (biểu tượng khóa)', '"104 / 104 quyền đã cấp"; mọi quyền được tick; phạm vi "Toàn hệ thống"');
  c('PRM-V06', U1, 'Xem quyền của nhóm', 'Mở URL với roleId không tồn tại không gây lỗi trắng trang', 'Validate', 'Trung bình',
    '1. Đăng nhập admin\n2. Mở #/vi/permission-matrix?roleId=00000000-0000-0000-0000-000000000000\n3. [API] GET idm/permission-matrix/roles/<id lạ>',
    'API trả 404 "Nhóm người dùng không tồn tại"; trang vẫn hiển thị khung ma trận và danh sách nhóm, không lộ lỗi nội bộ');
  c('PRM-V07', U1, 'Luồng', 'Chuyển sang nhóm khác khi còn thay đổi chưa lưu thì có cảnh báo hoặc giữ nguyên thay đổi', 'Nghiệp vụ', 'Cao',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick quyền "Xem" của Quản lý người dùng (chưa Lưu)\n3. Chọn nhóm khác\n4. Chọn lại nhóm ban đầu',
    'Có hộp thoại xác nhận bỏ thay đổi chưa lưu (hoặc thay đổi được giữ khi quay lại); không âm thầm mất thay đổi',
    'Khảo sát: không cảnh báo, thay đổi chưa lưu bị bỏ âm thầm → nghi lỗi. ' + BA);
  c('PRM-V08', U1, 'Luồng', 'Tải lại trang khi chưa lưu thì quyền của nhóm không bị thay đổi', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + ' rồi cấp USER.VIEW\n2. Chọn nhóm, tick thêm quyền chưa Lưu\n3. Tải lại trang (F5), chọn lại nhóm\n4. [API] GET idm/permission-matrix/roles/<id>', 'Chỉ còn quyền USER.VIEW đã lưu; API không có quyền vừa tick');

  // --- Tham chiếu: quan hệ với trang Nhóm người dùng ---
  c('PRM-R01', U1, 'Tham chiếu nhóm', 'Nhóm vừa tạo ở trang Nhóm người dùng xuất hiện trong ma trận với 0/104', 'Nghiệp vụ', 'Cao',
    '1. [API] Tạo nhóm QCA… (tên có "qc.automation")\n2. Mở Ma trận phân quyền', 'Nhóm xuất hiện trong danh sách bên trái, hiển thị "0/104"');
  c('PRM-R02', U1, 'Tham chiếu nhóm', 'Đổi tên nhóm ở Nhóm người dùng thì ma trận hiển thị tên mới, quyền đã cấp giữ nguyên', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + ' và cấp USER.VIEW\n2. [API] Đổi tên nhóm\n3. Mở Ma trận phân quyền', 'Danh sách hiển thị tên mới; số quyền vẫn "1/104" và quyền USER.VIEW còn nguyên');
  c('PRM-R03', U1, 'Tham chiếu nhóm', 'Nhóm bị xóa không còn trong ma trận và API chi tiết trả 404', 'Nghiệp vụ', 'Cao',
    '1. ' + NEWGRP + '\n2. [API] Xóa nhóm\n3. Mở Ma trận phân quyền\n4. [API] GET idm/permission-matrix/roles/<id>', 'Nhóm không còn trong danh sách; API trả 404 "Nhóm người dùng không tồn tại"');
  c('PRM-R04', U1, 'Tham chiếu nhóm', 'Xóa nhóm đang được gán quyền bị chặn kèm hướng dẫn gỡ quyền trước', 'Nghiệp vụ', 'Cao',
    '1. ' + NEWGRP + ' và cấp USER.VIEW\n2. [API] DELETE idm/roles/<id>', 'API trả 400 "Không thể xóa: nhóm quyền đang gán 1 quyền. Vui lòng gỡ hết quyền khỏi nhóm này trước khi xóa."; nhóm vẫn còn');
  c('PRM-R05', U1, 'Tham chiếu nhóm', 'Số thành viên của nhóm (memberCount) khớp số người dùng thực tế', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + ' và tạo 2 người dùng QCA… thuộc nhóm\n2. [API] GET idm/permission-matrix/roles', 'memberCount của nhóm = 2; xóa 1 người dùng thì còn 1');

  // ===================== UC2 Phân quyền chức năng cho nhóm =====================
  c('PRM-E01', U2, 'Cấp quyền', 'Tick 1 quyền con: số đã cấp tăng, nút Lưu mở khóa, phạm vi mặc định "Đơn vị và đơn vị con"', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + '\n2. Mở Ma trận phân quyền, chọn nhóm, mở "Quản lý người dùng"\n3. Tick quyền "Xem"', '"1 / 104 quyền đã cấp"; chức năng hiển thị 1/6; phạm vi của quyền Xem = "Đơn vị và đơn vị con"; nút Lưu bấm được');
  c('PRM-E02', U2, 'Cấp quyền', 'Bấm Lưu gửi đúng danh sách quyền, dữ liệu lưu đúng và còn nguyên sau khi tải lại', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick Xem + Thêm của Quản lý người dùng\n3. Bấm Lưu\n4. Tải lại trang, chọn lại nhóm\n5. [API] GET idm/permission-matrix/roles/<id>',
    'Request PUT chứa USER.VIEW và USER.CREATE kèm phạm vi; API trả 200 "Lưu phân quyền thành công"; GET trả đúng 2 quyền; sau tải lại vẫn "2 / 104"; nút Lưu bị khóa sau khi lưu');
  c('PRM-E03', U2, 'Cấp quyền', 'Lưu thành công hiển thị thông báo cho người dùng', 'Chức năng', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick 1 quyền\n3. Bấm Lưu', 'Hiển thị thông báo thành công (vd "Lưu phân quyền thành công")',
    'Khảo sát: API trả "Lưu phân quyền thành công" nhưng giao diện không hiện thông báo nào, chỉ khóa nút Lưu → nghi lỗi UX');
  c('PRM-E04', U2, 'Phạm vi', 'Chọn phạm vi riêng cho từng quyền (Đơn vị / Đơn vị và đơn vị con / Toàn hệ thống) và lưu đúng', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick Xem, Thêm, Sửa của Quản lý người dùng\n3. Đặt phạm vi: Xem = Đơn vị, Thêm = Đơn vị và đơn vị con, Sửa = Toàn hệ thống\n4. Lưu, tải lại', 'API trả USER.VIEW=unit, USER.CREATE=unitAndChildren, USER.UPDATE=all; giao diện sau tải lại hiển thị đúng 3 phạm vi');
  c('PRM-E05', U2, 'Phạm vi', 'Đổi phạm vi của quyền đã cấp rồi Lưu thì phạm vi mới được áp dụng', 'Chức năng', 'Trung bình',
    '1. ' + NEWGRP + ' và cấp USER.VIEW=unit\n2. Chọn nhóm, đổi phạm vi quyền Xem sang "Toàn hệ thống"\n3. Lưu', 'API trả USER.VIEW=all; số quyền vẫn 1');
  c('PRM-E06', U2, 'Phạm vi', 'Quyền chỉ cho phép "Toàn hệ thống" (Sao lưu dữ liệu, Thêm Đơn vị hành chính cấp tỉnh) chỉ có 1 lựa chọn', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick cả chức năng "Sao lưu dữ liệu" và quyền "Thêm" của "Đơn vị hành chính cấp tỉnh"\n3. Mở ô phạm vi của từng quyền',
    'Phạm vi mặc định "Toàn hệ thống" và danh sách chọn chỉ có "Toàn hệ thống"; quyền "Xem" của Đơn vị hành chính cấp tỉnh có đủ 3 lựa chọn');
  c('PRM-E07', U2, 'Phạm vi', 'Tập phạm vi trên giao diện khớp danh mục API', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick cả chức năng Quản lý người dùng, Sao lưu dữ liệu, Đơn vị hành chính cấp tỉnh\n3. Mở ô phạm vi của từng quyền con\n4. [API] GET idm/permission-matrix', 'Danh sách lựa chọn của mỗi quyền = "scopes" của quyền đó trong API');
  c('PRM-E08', U2, 'Cấp quyền', 'Tick checkbox chức năng cấp tất cả quyền con, tick checkbox module cấp tất cả chức năng', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick checkbox chức năng "Quản lý nhóm người dùng"\n3. Tick checkbox module "A"', 'Bước 2: 5/5 quyền, "5 / 104"; bước 3: module A "46/46 quyền", "46 / 104"; mọi quyền con của A được tick');
  c('PRM-E09', U2, 'Cấp quyền', 'Bỏ 1 quyền con của chức năng đã cấp đủ thì chức năng chuyển sang trạng thái một phần', 'Chức năng', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick chức năng "Quản lý nhóm người dùng" (5/5)\n3. Bỏ tick quyền "Xóa"', 'Chức năng hiển thị 4/5; checkbox chức năng không còn trạng thái tick đủ (một phần); tổng "4 / 104"');
  c('PRM-E10', U2, 'Cấp quyền', 'Cấp đủ 104/104 quyền cho một nhóm', 'Chức năng', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick lần lượt 5 module A–E\n3. Lưu\n4. [API] GET idm/permission-matrix/roles/<id>', '"104 / 104"; API trả đủ 104 quyền, mỗi quyền có phạm vi hợp lệ');
  c('PRM-E11', U2, 'Hủy thay đổi', 'Bấm "Hủy thay đổi" khôi phục trạng thái đã lưu và khóa nút Lưu', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + ' và cấp USER.VIEW\n2. Chọn nhóm, tick thêm 3 quyền và đổi phạm vi quyền Xem\n3. Bấm "Hủy thay đổi"', 'Trở về đúng "1 / 104" với USER.VIEW và phạm vi cũ; nút Lưu bị khóa; không gửi request PUT');
  c('PRM-E12', U2, 'Cấp quyền', 'Lưu chỉ thay đổi nhóm đang chọn, các nhóm khác giữ nguyên', 'Nghiệp vụ', 'Cao',
    '1. Tạo 2 nhóm QCA… A và B, cấp USER.VIEW cho B\n2. Chọn nhóm A, tick 3 quyền, Lưu\n3. [API] GET quyền của A, B và grantedCount các nhóm', 'A có 3 quyền; B vẫn chỉ USER.VIEW; grantedCount của các nhóm còn lại không đổi');
  c('PRM-E13', U2, 'Cấp quyền', 'PUT thay thế toàn bộ danh sách quyền (không cộng dồn)', 'Nghiệp vụ', 'Cao',
    '1. ' + NEWGRP + '\n2. [API] PUT danh sách {USER.VIEW, ROLE.VIEW}\n3. [API] PUT danh sách {BACKUP.VIEW}\n4. [API] GET', 'Sau bước 3 chỉ còn BACKUP.VIEW; USER.VIEW và ROLE.VIEW đã bị gỡ');
  c('PRM-E14', U2, 'Kiểm tra API', 'Mã quyền không tồn tại bị từ chối, dữ liệu không đổi', 'Validate', 'Cao',
    '1. ' + NEWGRP + ' và cấp USER.VIEW\n2. [API] PUT {FOO.BAR, all}\n3. [API] PUT {user.view, all} (chữ thường)', 'Cả hai trả 400 "Quyền … không tồn tại"; quyền của nhóm vẫn chỉ USER.VIEW');
  c('PRM-E15', U2, 'Kiểm tra API', 'Phạm vi không hợp lệ không được cấp (INVALID_SCOPE)', 'Validate', 'Cao',
    '1. ' + NEWGRP + '\n2. [API] PUT {USER.VIEW, scope "xyz"}', 'Không trả 500; quyền USER.VIEW không được cấp; phản hồi có data.ignored chứa USER.VIEW lý do INVALID_SCOPE');
  c('PRM-E16', U2, 'Kiểm tra API', 'Phạm vi nằm ngoài tập cho phép của quyền không được cấp (SCOPE_NOT_ALLOWED)', 'Validate', 'Cao',
    '1. ' + NEWGRP + '\n2. [API] PUT {BACKUP.VIEW, scope "unit"} (Sao lưu chỉ cho "all")', 'Quyền không được cấp; data.ignored chứa BACKUP.VIEW lý do SCOPE_NOT_ALLOWED');
  c('PRM-E17', U2, 'Kiểm tra API', 'Quyền thiếu phạm vi không được cấp (MISSING_SCOPE)', 'Validate', 'Trung bình',
    '1. ' + NEWGRP + '\n2. [API] PUT {USER.VIEW} không có scope', 'Quyền không được cấp; data.ignored chứa USER.VIEW lý do MISSING_SCOPE');
  c('PRM-E18', U2, 'Kiểm tra API', 'Mã quyền trùng trong cùng yêu cầu bị từ chối', 'Validate', 'Trung bình',
    '1. ' + NEWGRP + '\n2. [API] PUT {USER.VIEW all} + {USER.VIEW unit}', '400 "Quyền USER.VIEW bị trùng"; không quyền nào được lưu');
  c('PRM-E19', U2, 'Kiểm tra API', 'Body sai định dạng (permissions=null, mảng thô, JSON hỏng) trả 400, không 500', 'Validate', 'Trung bình',
    '1. ' + NEWGRP + ' và cấp USER.VIEW\n2. [API] PUT {permissions:null}; PUT mảng [...]; PUT chuỗi "{bad"', 'Cả ba trả 400 "Dữ liệu không hợp lệ"; quyền của nhóm vẫn là USER.VIEW');
  c('PRM-E20', U2, 'Kiểm tra API', 'Thiếu trường permissions không được xóa sạch quyền hiện có', 'Nghiệp vụ', 'Cao',
    '1. ' + NEWGRP + ' và cấp USER.VIEW, ROLE.VIEW\n2. [API] PUT {} (không có "permissions")\n3. [API] GET', 'Trả 400 (giống permissions=null) hoặc giữ nguyên quyền; không được xóa sạch quyền của nhóm',
    'Khảo sát: PUT {} trả 200 "Lưu phân quyền thành công" và xóa sạch quyền, trong khi permissions=null trả 400 → nghi lỗi (xóa quyền ngoài ý muốn)');
  c('PRM-E21', U2, 'Kiểm tra API', 'Mã quyền quá dài hoặc chứa HTML bị từ chối an toàn, không lộ lỗi nội bộ', 'Bảo mật', 'Trung bình',
    '1. ' + NEWGRP + '\n2. [API] PUT mã quyền 5000 ký tự\n3. [API] PUT mã quyền "<script>alert(1)</script>"', 'Cả hai trả 400; không 500; không lộ stack trace; quyền của nhóm không đổi',
    'Khảo sát: thông báo lỗi phản chiếu nguyên văn mã quyền (kể cả chuỗi 5000 ký tự) — cần rút gọn/escape khi hiển thị');
  c('PRM-E22', U2, 'Nghiệp vụ', 'Quyền Sửa/Xóa/Thêm không được cấp riêng khi chưa có quyền Xem', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, chỉ tick quyền "Sửa" của Quản lý người dùng\n3. Lưu', 'Hệ thống tự bật kèm quyền Xem hoặc chặn và báo cần cấp quyền Xem',
    'Khảo sát: giao diện và API cho phép cấp Sửa/Xóa mà không có Xem. ' + BA);
  c('PRM-E23', U2, 'Nhóm hệ thống', 'Không thay đổi được quyền của nhóm hệ thống "Quản trị hệ thống"', 'Nghiệp vụ', 'Cao',
    '1. Chọn nhóm "Quản trị hệ thống" (khóa)\n2. Thử tick/bỏ quyền trên giao diện\n3. [API] PUT quyền của nhóm này (gửi đúng danh sách hiện tại, không đổi gì)',
    'Giao diện không cho thay đổi quyền của nhóm hệ thống (checkbox khóa, Lưu khóa); API trả 400 "Không thể thay đổi quyền của nhóm người dùng hệ thống"; quyền vẫn 104/104',
    'Khảo sát: API đúng (400) nhưng giao diện vẫn cho bỏ tick (104 → 98) và mở khóa nút Lưu → nghi lỗi UI. Test KHÔNG bấm Lưu trên nhóm hệ thống');
  c('PRM-E24', U2, 'Kiểm tra API', 'Id nhóm không tồn tại hoặc sai định dạng không gây 500', 'Validate', 'Trung bình',
    '1. [API] GET và PUT idm/permission-matrix/roles/00000000-0000-0000-0000-000000000000\n2. [API] GET idm/permission-matrix/roles/abc', 'Id lạ trả 404 "Nhóm người dùng không tồn tại"; id sai định dạng trả 4xx; không 500');
  m('PRM-M01', U2, 'Hiệu lực', 'Quyền vừa cấp có hiệu lực với người dùng thuộc nhóm (menu, API) và quyền bị hủy thì mất hiệu lực', 'Nghiệp vụ', 'Cao',
    '1. Tạo nhóm QCA…, người dùng QCA… thuộc nhóm\n2. Admin cấp quyền "Xem" Trụ cột cho nhóm → người dùng đăng nhập\n3. Admin hủy quyền đó, người dùng tải lại', 'Bước 2: người dùng thấy menu Trụ cột và gọi được API (không 403); bước 3: menu biến mất, API trả 403; GET idm/permission-matrix/me phản ánh đúng',
    'Chưa rõ quyền có hiệu lực ngay hay chỉ sau khi đăng nhập lại. ' + BA);
  m('PRM-M02', U2, 'Hiệu lực', 'Phạm vi dữ liệu của quyền (Đơn vị / Đơn vị và đơn vị con / Toàn hệ thống) giới hạn đúng dữ liệu thấy được', 'Nghiệp vụ', 'Cao',
    '1. Có đơn vị cha và đơn vị con, dữ liệu ở cả hai\n2. Cấp quyền Xem cho nhóm lần lượt với 3 phạm vi\n3. Người dùng thuộc đơn vị cha đăng nhập, xem danh sách', 'Đơn vị: chỉ dữ liệu của đơn vị cha; Đơn vị và đơn vị con: cả cha và con; Toàn hệ thống: mọi đơn vị',
    'SRS §2.1 ghi phạm vi "được cấu hình cho tài khoản, độc lập với nhóm quyền" nhưng màn hình đặt phạm vi theo từng quyền của nhóm; UC không quy định ý nghĩa 3 mức. ' + BA,
    'Manual — cần nhiều đơn vị, nhiều tài khoản đăng nhập (captcha) và quy tắc phạm vi do BA xác nhận');
  m('PRM-M03', U2, 'Nhật ký', 'Thay đổi ma trận phân quyền được ghi nhật ký với giá trị trước → sau', 'Bảo mật', 'Trung bình',
    '1. Admin đổi quyền của một nhóm và Lưu\n2. Mở Nhật ký truy cập (A.III.3) / nhật ký hệ thống', 'Có bản ghi loại "Thay đổi cấu hình" gồm người thực hiện, thời gian, nhóm, quyền trước và sau khi đổi',
    'ATTT KT 1.3.3a-4, NK-11. Khảo sát: menu chưa có màn hình Nhật ký truy cập và không tìm thấy API nhật ký → chưa kiểm tra được; cần Dev/BA xác nhận',
    'Manual — chưa có màn hình/API nhật ký để kiểm tra tự động');

  // ===================== UC3 Hủy phân quyền =====================
  c('PRM-D01', U3, 'Hủy quyền', 'Bỏ tick 1 quyền đã cấp rồi Lưu thì quyền bị gỡ và phạm vi về "–"', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + ' và cấp USER.VIEW, USER.CREATE\n2. Chọn nhóm, bỏ tick quyền "Thêm" của Quản lý người dùng\n3. Lưu, tải lại', 'Còn "1 / 104" (USER.VIEW); API không còn USER.CREATE; ô phạm vi của "Thêm" hiển thị "–"');
  c('PRM-D02', U3, 'Hủy quyền', 'Bỏ tick checkbox chức năng hủy toàn bộ quyền con của chức năng', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + ' và cấp cả 6 quyền của USER + ROLE.VIEW\n2. Chọn nhóm, bỏ tick checkbox chức năng "Quản lý người dùng"\n3. Lưu', 'Chức năng hiển thị 0/6; API không còn quyền USER.*; ROLE.VIEW giữ nguyên');
  c('PRM-D03', U3, 'Hủy quyền', 'Hủy toàn bộ quyền của nhóm (bỏ tick từng chức năng đã cấp) rồi Lưu', 'Chức năng', 'Cao',
    '1. ' + NEWGRP + ' và cấp đủ quyền của 4 chức năng: Quản lý người dùng, Sao lưu dữ liệu, Trụ cột, Kết quả tự đánh giá\n2. Chọn nhóm, bỏ tick checkbox của từng chức năng đó\n3. Lưu', '"0 / 104"; API trả permissions rỗng; số quyền của nhóm trong danh sách bên trái về "0/104"');
  c('PRM-D04', U3, 'Hủy quyền', 'Hủy rồi cấp lại quyền thì phạm vi quay về mặc định "Đơn vị và đơn vị con"', 'Nghiệp vụ', 'Thấp',
    '1. ' + NEWGRP + ' và cấp USER.UPDATE=all\n2. Chọn nhóm, bỏ tick rồi tick lại "Sửa" của Quản lý người dùng', 'Phạm vi của quyền Sửa = "Đơn vị và đơn vị con" (không giữ lại "Toàn hệ thống" cũ)',
    'Khảo sát: tick lại từng quyền con giữ phạm vi cũ, còn tick lại cả chức năng thì về mặc định → không nhất quán. ' + BA);
  c('PRM-D05', U3, 'Hủy quyền', 'Bỏ tick chưa Lưu rồi "Hủy thay đổi" thì quyền đã cấp vẫn còn', 'Chức năng', 'Trung bình',
    '1. ' + NEWGRP + ' và cấp USER.VIEW\n2. Chọn nhóm, bỏ tick quyền Xem\n3. Bấm "Hủy thay đổi"', 'Quyền Xem được tick lại với phạm vi cũ; "1 / 104"; API vẫn có USER.VIEW');
  c('PRM-D06', U3, 'Kiểm tra API', 'PUT danh sách quyền rỗng gỡ toàn bộ quyền của nhóm', 'Chức năng', 'Trung bình',
    '1. ' + NEWGRP + ' và cấp USER.VIEW, ROLE.VIEW\n2. [API] PUT {permissions: []}\n3. [API] GET', '200; GET trả permissions rỗng; grantedCount của nhóm = 0');
  c('PRM-D07', U3, 'Nghiệp vụ', 'Sau khi gỡ hết quyền, xóa nhóm thành công', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + ' và cấp USER.VIEW\n2. [API] Xóa nhóm → bị chặn\n3. [API] PUT {permissions: []}\n4. [API] Xóa nhóm', 'Bước 2: 400 (còn quyền); bước 4: 200 "Xóa thành công"; nhóm biến mất khỏi ma trận');
  m('PRM-M04', U3, 'Hiệu lực', 'Hủy quyền Xem/Sửa "Phân quyền cho nhóm người dùng" của nhóm thì thành viên mất khả năng vào/sửa ma trận', 'Bảo mật', 'Cao',
    '1. Nhóm QCA… được cấp quyền Xem + Sửa Phân quyền cho nhóm người dùng; người dùng thuộc nhóm đăng nhập vào được ma trận\n2. Admin hủy quyền Sửa → người dùng sửa thử\n3. Admin hủy quyền Xem → người dùng mở ma trận', 'Bước 2: PUT trả 403, nút Lưu không dùng được; bước 3: menu biến mất, truy cập trực tiếp bị 403 "Truy cập bị từ chối"',
    'Hiện không có tài khoản thử nghiệm nào có quyền Phân quyền riêng lẻ (xemonly chỉ có Nhóm người dùng) nên cần tạo tài khoản mới');

  // ===================== Bảo mật =====================
  c('PRM-S01', U1, 'Bảo mật', 'API ma trận từ chối khi không token hoặc token giả (401)', 'Bảo mật', 'Cao',
    '1. [API] GET danh mục, GET danh sách nhóm, GET chi tiết nhóm, PUT quyền nhóm, GET …/me\n2. Gọi không token và token "abc.def.ghi"', 'Mọi lời gọi trả 401; dữ liệu nhóm không thay đổi');
  c('PRM-S02', U1, 'Bảo mật', 'Chỉ Quản trị hệ thống truy cập được API ma trận; canbo, lãnh đạo Bộ, lãnh đạo đơn vị, CB/LĐ địa phương, xemonly bị 403', 'Bảo mật', 'Cao',
    '1. ' + NEWGRP + ' và cấp USER.VIEW\n2. Lần lượt dùng token canbo, lanhdaobo, ldd, cbdp, ldp, xemonly gọi GET danh mục, GET nhóm, GET chi tiết, PUT quyền\n3. Dùng token admin và superadmin gọi lại',
    'Sáu vai trò kia nhận 403 "Bạn không có quyền truy cập chức năng này" ở cả 4 lời gọi và quyền nhóm không đổi; GET …/me vẫn 200; admin và superadmin nhận 200');
  c('PRM-S03', U1, 'Bảo mật', 'Người dùng không có quyền không thấy mục menu và bị chặn khi gõ URL trực tiếp', 'Bảo mật', 'Cao',
    '1. Lần lượt đăng nhập canbo, lanhdaobo, xemonly\n2. Quan sát menu\n3. Mở #/vi/permission-matrix', 'Menu không có "Ma trận phân quyền"; mở URL trực tiếp không hiển thị danh sách nhóm/cây quyền (hiện trang 403 hoặc chuyển đi), không lộ dữ liệu');
  m('PRM-S04', U1, 'Bảo mật', 'Quyền Xem / Sửa / Xuất Excel của "Phân quyền cho nhóm người dùng" tách bạch', 'Bảo mật', 'Trung bình',
    '1. Tạo 3 nhóm: chỉ Xem; Xem + Xuất Excel; Xem + Sửa\n2. Người dùng thuộc từng nhóm gọi GET, PUT và xuất Excel', 'Chỉ Xem: GET 200, PUT 403, không xuất được; Xem + Xuất: xuất được, PUT 403; Xem + Sửa: PUT 200 nhưng không xuất được',
    'Hiện chưa có tài khoản thử nghiệm nào có quyền Phân quyền riêng lẻ');

  // ===================== Hiệu năng =====================
  c('PRM-P01', U1, 'Hiệu năng', 'Mở trang Ma trận phân quyền hiển thị đủ cây quyền trong 3 giây', 'Hiệu năng', 'Trung bình',
    OPEN + '\n3. Đo từ lúc mở trang đến khi thấy cây quyền và danh sách nhóm', 'Dưới 3 giây (mạng bình thường)');
  c('PRM-P02', U2, 'Hiệu năng', 'Lưu đủ 104 quyền phản hồi trong 3 giây', 'Hiệu năng', 'Thấp',
    '1. ' + NEWGRP + '\n2. [API] PUT 104 quyền, đo thời gian', 'Phản hồi 200 dưới 3 giây');

  // ===================== Edge / Lỗi =====================
  c('PRM-G01', U1, 'Lỗi', 'Tải danh mục quyền bị lỗi 500 thì hiển thị thông báo lỗi, không để cây trống im lặng', 'Validate', 'Trung bình',
    '1. Đăng nhập admin\n2. Chặn GET idm/permission-matrix trả 500\n3. Mở Ma trận phân quyền', 'Hiển thị "Không tải được danh mục quyền. Vui lòng thử lại."; không lộ lỗi nội bộ; không hiển thị như thể nhóm không có quyền nào');
  c('PRM-G02', U1, 'Lỗi', 'Tải danh sách nhóm bị lỗi mạng thì báo lỗi và có nút "Thử lại" hoạt động', 'Validate', 'Trung bình',
    '1. Đăng nhập admin\n2. Chặn GET …/permission-matrix/roles (mất kết nối)\n3. Mở Ma trận phân quyền\n4. Bỏ chặn, bấm "Thử lại"', 'Hiển thị "Không tải được danh sách nhóm người dùng. Vui lòng thử lại." và nút "Thử lại"; sau khi bỏ chặn bấm Thử lại thì hiện đủ danh sách nhóm');
  c('PRM-G03', U2, 'Lỗi', 'Lưu bị lỗi 500 thì báo lỗi, giữ thay đổi đã chọn và vẫn bấm Lưu lại được', 'Validate', 'Cao',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick 2 quyền\n3. Chặn PUT trả 500 rồi bấm Lưu', 'Hiển thị thông báo lỗi; hai quyền vẫn được tick (số "2 / 104"); nút Lưu vẫn bấm được để thử lại; dữ liệu của nhóm trên server không đổi',
    'Khảo sát: thông báo lỗi hiển thị nguyên văn message của server');
  c('PRM-G04', U2, 'Lỗi', 'Lưu khi mất kết nối thì báo lỗi, không treo và giữ thay đổi', 'Validate', 'Cao',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick 2 quyền\n3. Chặn PUT (mất kết nối) rồi bấm Lưu', 'Hiển thị "Không lưu được quyền. Các thay đổi vẫn được giữ, vui lòng thử lại."; hai quyền vẫn tick; Lưu bấm lại được; không treo');
  c('PRM-G05', U2, 'Lỗi', 'Bấm Lưu 2 lần liên tiếp không làm dữ liệu sai hoặc báo lỗi', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick 3 quyền\n3. Bấm Lưu 2 lần rất nhanh\n4. [API] GET', 'Chỉ 1 request PUT được gửi hoặc cả hai cho cùng kết quả; API có đúng 3 quyền; không báo lỗi');
  c('PRM-G06', U1, 'Hiển thị', 'Tên nhóm chứa HTML/dấu nháy/& hiển thị nguyên văn trong ma trận, không thực thi', 'Bảo mật', 'Trung bình',
    '1. [API] Tạo nhóm có tên  qc.automation <b>"x"</b> & \'y\'  \n2. Mở Ma trận phân quyền, chọn nhóm đó', 'Tên hiển thị nguyên văn (thấy cả ký tự < > & " \'); không có thẻ in đậm được render; không chạy script');
  c('PRM-G07', U2, 'Lỗi', 'Lưu khi nhóm đã bị người khác xóa thì báo lỗi rõ ràng, không treo', 'Nghiệp vụ', 'Trung bình',
    '1. ' + NEWGRP + '\n2. Chọn nhóm, tick 1 quyền (chưa Lưu)\n3. [API] Xóa nhóm đó\n4. Bấm Lưu', 'API trả 404 "Nhóm người dùng không tồn tại"; giao diện hiển thị thông báo lỗi, không treo, không báo thành công');
}
