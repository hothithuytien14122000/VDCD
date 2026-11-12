// AN TOÀN THÔNG TIN CẤP ĐỘ 2 — testcase bám sheet "ATTT mức 2" (Danh sách công việc_CĐS - BCT.xlsx).
// Căn cứ: TT 12/2022/TT-BTTTT PL II, TCVN 11930:2017 mục 6 (cấp độ 2), QĐ 742/QĐ-BTTTT (tiêu chí cấp độ 2).
// Mỗi phân hệ có 1 page ATTT riêng (kiểm tra ATTT trên chính API/màn hình của phân hệ đó):
//   ATA = Phân hệ A (Quản trị hệ thống: tham số, nhật ký, sao lưu, người dùng)   ATB = Phân hệ B (Bộ chỉ số DTI)
//   ATC = Phân hệ C (Đánh giá CĐS)   ATE = Phân hệ E (Khảo sát hài lòng)   ATU = AUTH (Xác thực, mật khẩu, phiên)
//   ATG = ATTT chung — Hồ sơ quản lý & Hạ tầng (các dòng "Hồ sơ – Quản lý", "Hạ tầng", PM, HS của sheet)
// Cột uc = "ATTT <Mã YC>[; <Mã YC>…]" đúng cột "Mã YC" của sheet → requirements-ATTT.mjs truy vết theo mã này.
// Chữ cái nhóm: X xác thực/token · Q phân quyền BE · V kiểm tra đầu vào · L lỗi không lộ thông tin · S bí mật/dữ liệu nhạy cảm
//   N nhật ký · T thời gian chờ phiên · H HTTPS · P mật khẩu · K đăng nhập sai · C tham số hệ thống · I IP quản trị
//   D dữ liệu/sao lưu · U tài khoản · F tệp tải lên · W lỗ hổng web · R hồ sơ/hạ tầng (ATG)
const MAN = why => 'Manual: ' + why;
const CAPTCHA = 'cần đăng nhập có captcha thật (không tự động hóa được)';
const PARAM = 'thay đổi Tham số hệ thống ảnh hưởng toàn môi trường (theo README: không tự động ghi Tham số hệ thống) — chạy trên môi trường riêng rồi khôi phục';
const WAIT = 'phải chờ hết thời gian cấu hình (≥ 30 phút) hoặc chỉnh tham số tạm thời';
const DB = 'cần quyền truy cập CSDL/máy chủ để lấy minh chứng';
const DOC = 'kiểm tra hồ sơ / minh chứng, không phải chức năng phần mềm';
const INFRA = 'kiểm tra cấu hình hạ tầng (đơn vị vận hành cung cấp minh chứng); quét cổng/thử xâm nhập chỉ làm khi có văn bản cho phép';

function mk(t, P) {
  const n = {};
  return (L, yc, fn, title, pri, steps, exp, auto = 'Auto', note = '', type = 'Bảo mật') => {
    n[L] = (n[L] || 0) + 1;
    const id = `${P}-${L}${String(n[L]).padStart(2, '0')}`;
    t(id, `ATTT ${yc}`, fn, title, type, pri, steps, exp, auto, note);
    return id;
  };
}

// Danh sách API của từng phân hệ (dùng trong bước kiểm thử; script đọc cùng danh sách ở scripts/attt.ts)
const API = {
  ATA: 'idm/users, idm/roles, idm/permission-matrix, provinces, communes, unit-types, organizations, system/parameters, system/configurations, system/backups, log-audit-resource',
  ATB: 'dti/pillars, dti/indicator-groups, dti/indicators, dti/indicator-sets, dti/score-scales, dti/self-assessment-campaigns',
  ATC: 'dti/assessment-results (+/{id}, /history, /submissions), dti/reports, dti/compare, upload/blob/assessment_result_file',
  ATE: 'survey/surveys (+/{id}, /status), public/surveys (API công khai cho người dân)',
};
const NAME = { ATA: 'Phân hệ A', ATB: 'Phân hệ B', ATC: 'Phân hệ C', ATE: 'Phân hệ E' };
const ACT = {
  ATA: 'Thêm/sửa/xóa loại đơn vị QCA; khóa/mở khóa đơn vị',
  ATB: 'Thêm/sửa/xóa trụ cột QCA; khóa/mở khóa (đưa vào sử dụng) trụ cột',
  ATC: 'Chấm điểm, lưu, trình duyệt, gửi Bộ, phê duyệt/trả lại, yêu cầu mở khóa kết quả tự đánh giá',
  ATE: 'Tạo/sửa/xóa đợt khảo sát nháp QCA; trình duyệt, phê duyệt/từ chối đợt',
};

// ===================== Bộ kiểm tra ATTT dùng chung cho mọi phân hệ nghiệp vụ =====================
function moduleSuite(a, P, o = {}) {
  const ph = NAME[P], apis = API[P];
  // --- KT 1.3.1a: xác thực bắt buộc + kiểm tra quyền ở BE ---
  a('X', 'KT 1.3.1a', 'Xác thực', `[API] Mọi API của ${ph} trả 401 khi không gửi token`, 'Cao',
    `1. Không gửi header Authorization\n2. Gọi GET danh sách (và GET chi tiết id bất kỳ) lần lượt các API: ${apis}`,
    `Mọi API nghiệp vụ trả HTTP 401, không trả dữ liệu${o.publicNote ? `\n${o.publicNote}` : ''}`);
  a('X', 'KT 1.3.1a', 'Xác thực', `[API] Token giả, token sửa payload, token alg=none bị API ${ph} từ chối 401`, 'Cao',
    `1. Lấy token hợp lệ của tài khoản cán bộ\n2. Tạo 3 biến thể: chuỗi ngẫu nhiên; sửa payload (đổi x-roles thành SUPER_ADMIN) giữ chữ ký cũ; header alg=none bỏ chữ ký\n3. Gọi API danh sách của ${ph} với từng token`,
    'Cả 3 trường hợp HTTP 401; không token nào được chấp nhận; không nâng quyền được');
  a('X', 'KT 1.3.1a', 'Xác thực', `Mở trực tiếp URL các màn của ${ph} khi chưa đăng nhập bị chuyển về trang đăng nhập`, 'Cao',
    `1. Trình duyệt chưa đăng nhập\n2. Mở trực tiếp URL các màn của ${ph}`,
    'Chuyển về #/vi/auth/login; không hiển thị dữ liệu, không gọi API nghiệp vụ thành công');
  a('Q', 'KT 1.3.1a', 'Phân quyền BE', `[API] Tài khoản không có quyền Xem gọi thẳng API ${ph} bị chặn 403 (BE kiểm tra quyền, không chỉ ẩn menu)`, 'Cao',
    `1. Với từng tài khoản QC (canbo, cbdp, ldd, ldp, lanhdaobo, xemonly): đọc ma trận quyền idm/permission-matrix/me\n2. Với mỗi API của ${ph} mà tài khoản KHÔNG có mã quyền .VIEW: gọi GET danh sách`,
    'HTTP 403 (hoặc 401); không trả dữ liệu. Không có trường hợp ẩn menu ở FE nhưng API vẫn trả 200');
  a('Q', 'KT 1.3.1a', 'Phân quyền BE', `[API] Tài khoản không có quyền Thêm/Sửa/Xóa gọi thẳng POST/PUT/DELETE của ${ph} bị chặn 403`, 'Cao',
    `1. Chọn tài khoản không có mã quyền .CREATE/.UPDATE/.DELETE tương ứng (theo permission-matrix/me)\n2. Gọi POST với body rỗng, PUT/DELETE với id ngẫu nhiên lên API của ${ph}`,
    'HTTP 403 — kiểm tra quyền diễn ra TRƯỚC kiểm tra dữ liệu (không trả 400/404 làm lộ thông tin); không có dữ liệu bị tạo/sửa/xóa');
  a('Q', 'KT 1.3.1a', 'Phân quyền BE', `Tài khoản không có quyền: menu/nút của ${ph} bị ẩn và mở URL trực tiếp không xem được dữ liệu`, 'Trung bình',
    `1. Đăng nhập tài khoản không có quyền Xem một màn của ${ph}\n2. Kiểm tra menu bên trái\n3. Mở trực tiếp URL màn đó`,
    'Menu không có mục đó; mở URL trực tiếp hiển thị thông báo không có quyền / bảng rỗng; API trả 403');
  if (o.idor) a('Q', 'KT 1.3.1a', 'Phân quyền BE', `[API] Đổi id trong URL sang bản ghi ngoài phạm vi đơn vị của tài khoản bị chặn (IDOR) — ${o.idor}`, 'Cao',
    `1. Bằng tài khoản QTV lấy id một bản ghi thuộc đơn vị khác với đơn vị của tài khoản địa phương\n2. Bằng tài khoản địa phương (cbdp) gọi GET/PUT bản ghi đó theo id`,
    'HTTP 403/404; không trả dữ liệu, không sửa được bản ghi của đơn vị khác');
  // --- KT 1.3.4 / PM 3: kiểm tra đầu vào ---
  a('V', 'KT 1.3.4', 'Kiểm tra đầu vào', `[API] BE từ chối dữ liệu sai kiểu, vượt độ dài, sai định dạng khi thêm mới ở ${ph}`, 'Cao',
    `1. Gọi POST tạo mới ${o.createRes || 'bản ghi'} với: tên 5.000 ký tự; trường số nhận chuỗi; trường bắt buộc = null; trường ngày sai định dạng`,
    'HTTP 400 kèm thông báo rõ ràng; không có bản ghi nào được lưu (validate phía BE, không chỉ FE)', o.v01Auto || 'Auto',
    o.v01Note || 'Nếu API trả 200 → lỗi thiếu validate phía server (TCVN 6.2.3.4 / QĐ 742 tiêu chí 4.1)');
  a('V', 'KT 1.3.4; PM 3', 'Kiểm tra đầu vào', `[API] Tham số tìm kiếm/lọc/phân trang bất thường của ${ph} không gây lỗi 500, không trả dữ liệu bất thường`, 'Cao',
    `1. Gọi API danh sách của ${ph} với: keyword = ' OR 1=1 -- ; keyword = <script>alert(1)</script>; filter = JSON hỏng; page = -1; size = 100000; id không phải GUID`,
    'Không có HTTP 5xx; SQLi không làm tăng số bản ghi trả về; size bị giới hạn ở mức hợp lý; id sai định dạng trả 400/404');
  a('V', 'KT 1.3.4', 'Kiểm tra đầu vào', `[API] Body JSON hỏng hoặc sai Content-Type gửi lên ${ph} trả 400 với thông báo chung`, 'Trung bình',
    '1. Gửi POST với body "{bad json"\n2. Gửi POST với Content-Type: text/plain',
    'HTTP 400/415 thông báo "Dữ liệu không hợp lệ"; không lộ tên lớp, stack trace');
  a('W', 'PM 3', 'Chống XSS', `Dữ liệu chứa HTML/script nhập ở ${ph} hiển thị dạng văn bản, không thực thi (XSS lưu trữ)`, 'Cao',
    `1. ${o.xssStep || 'Tạo bản ghi QCA có tên <img src=x onerror=window.__xss=1>'}\n2. Mở màn danh sách/chi tiết hiển thị dữ liệu đó`,
    'Chuỗi hiển thị nguyên văn; không phát sinh thẻ img thật; window.__xss không được gán', o.xssAuto || 'Auto', o.xssNote || '');
  // --- KT 1.3.3a-3: lỗi hệ thống không lộ thông tin ---
  a('L', 'KT 1.3.3a-3', 'Xử lý lỗi', `[API] Lỗi phát sinh ở ${ph} chỉ trả thông báo chung (kèm mã lỗi/trace id), không lộ stack trace, đường dẫn, câu SQL`, 'Cao',
    `1. Gây lỗi có chủ đích trên API của ${ph}: id sai định dạng, filter sai kiểu, body thiếu trường bắt buộc, page vượt giới hạn\n2. Đọc toàn bộ nội dung phản hồi`,
    'Phản hồi không chứa "Exception", " at ", "Npgsql", "System.", đường dẫn /opt/ hay /home/, tên bảng/câu SQL; người dùng chỉ thấy thông báo chung');
  // --- UD 742-4.4 / KT 1.3.1b: dữ liệu nhạy cảm trong phản hồi ---
  a('S', 'KT 1.3.1b; UD 742-4.4', 'Dữ liệu nhạy cảm', `[API] Phản hồi API ${ph} không chứa mật khẩu, hash, token, khóa bí mật`, 'Cao',
    `1. Gọi GET danh sách và chi tiết các API của ${ph}\n2. Quét các trường trong phản hồi`,
    'Không có trường password/passwordHash/securityStamp/resetPasswordToken/emailVerifyToken/secret/connectionString mang giá trị');
  // --- KT 1.3.3a-1 / NK: nhật ký thao tác của phân hệ ---
  a('N', 'KT 1.3.3a-1; NK-02', 'Nhật ký', `Xem danh sách/chi tiết ở ${ph} được ghi nhật ký loại "Truy cập/thao tác"`, 'Cao',
    `1. Ghi nhận thời điểm T0\n2. Bằng tài khoản QTV mở danh sách và chi tiết một bản ghi của ${ph}\n3. Mở Nhật ký truy cập (log-audit-resource), lọc từ T0`,
    'Có bản ghi: Thời gian, Người dùng, Loại = Truy cập/thao tác, Chức năng = màn của ' + ph + ', Hành động = Xem, Đối tượng, Kết quả = Thành công, Địa chỉ IP');
  a('N', 'KT 1.3.3a-1; NK-04', 'Nhật ký', `Thêm/Sửa/Xóa ở ${ph} được ghi nhật ký có đối tượng, kết quả và giá trị trước → sau`, 'Cao',
    `1. Ghi nhận T0\n2. ${o.cud || 'Thêm, sửa tên, xóa một bản ghi QCA'}\n3. Tra nhật ký từ T0, mở chi tiết bản ghi Cập nhật`,
    'Có đủ 3 bản ghi Thêm / Cập nhật / Xóa với Đối tượng = mã/tên bản ghi, Kết quả = Thành công; chi tiết bản ghi Cập nhật hiển thị giá trị trước → sau',
    o.cudAuto || 'Auto', o.cudNote || '');
  a('N', 'KT 1.3.3a-1', 'Nhật ký', `Thao tác nghiệp vụ đặc thù của ${ph} được ghi nhật ký`, 'Cao',
    `1. Ghi nhận T0\n2. Thực hiện: ${ACT[P]}\n3. Tra nhật ký từ T0`,
    'Mỗi thao tác có 1 bản ghi đúng hành động (trình duyệt, phê duyệt, khóa, mở khóa…), đúng đối tượng và kết quả',
    o.bizAuto || 'Auto', o.bizNote || '');
  if (o.export !== false) a('N', 'KT 1.3.3a-1; NK-05', 'Nhật ký', `Xuất Excel ở ${ph} được ghi nhật ký (hành động Xuất file)`, 'Trung bình',
    `1. Ghi nhận T0\n2. Bấm Xuất Excel ở màn danh sách của ${ph}\n3. Tra nhật ký từ T0`,
    'Có bản ghi Hành động = Xuất file, Chức năng đúng màn, Kết quả = Thành công', 'Manual', MAN('nút Xuất Excel tải file qua trình duyệt; kiểm tra bản ghi nhật ký sau khi xuất'));
  a('N', 'KT 1.3.3a-1; NK-02', 'Nhật ký', `Thao tác bị từ chối do không có quyền ở ${ph} được ghi nhật ký với Kết quả = Thất bại`, 'Trung bình',
    `1. Ghi nhận T0\n2. Bằng tài khoản không có quyền gọi POST/DELETE lên API của ${ph} (bị 403)\n3. Tra nhật ký từ T0`,
    'Có bản ghi của tài khoản đó, Kết quả = Thất bại; không ghi như thao tác thành công');
  a('N', 'NK-08', 'Nhật ký', `Nhật ký của ${ph} không chứa mật khẩu, token, OTP, nội dung tệp`, 'Cao',
    `1. Thực hiện các thao tác ở ${ph}${o.sensitiveStep ? ` (${o.sensitiveStep})` : ''}\n2. Xem chi tiết các bản ghi nhật ký vừa sinh (giá trị trước/sau)`,
    'Không xuất hiện chuỗi mật khẩu, Bearer token, OTP, nội dung tệp; các trường nhạy cảm được che (***)');
  // --- KT 1.3.2a/b: HTTPS + thời gian chờ ---
  a('H', 'KT 1.3.2a', 'Kết nối an toàn', `[API] API ${ph} chỉ phục vụ qua HTTPS: gọi http:// được chuyển 301/308 sang https://`, 'Cao',
    `1. Gọi http://<máy chủ>/api/v1/<API của ${ph}> (không theo chuyển hướng)`,
    'HTTP 301/308 với Location bắt đầu https://; không trả dữ liệu qua HTTP');
  a('T', 'KT 1.3.2b', 'Thời gian chờ phiên', `Không thao tác quá SESSION_TIMEOUT_MINUTES khi đang ở màn của ${ph}: thông báo hết phiên và yêu cầu đăng nhập lại`, 'Cao',
    `1. Đăng nhập, mở một màn của ${ph}\n2. Không thao tác quá thời gian chờ cấu hình (mặc định 30 phút)\n3. Bấm thao tác bất kỳ / gọi lại API bằng token cũ`,
    'Hiện "Phiên làm việc đã hết hạn", về trang đăng nhập; API trả 401 (BE kiểm tra thời điểm hoạt động cuối, không chỉ hạn JWT)', 'Manual', MAN(WAIT));
}

export default function defineATTT(t) {
  // ============================== PHÂN HỆ A ==============================
  const A = mk(t, 'ATA');
  moduleSuite(A, 'ATA', { idor: 'người dùng/đơn vị', createRes: 'loại đơn vị (unit-types)', cud: 'Thêm, sửa tên, xóa một loại đơn vị QCA', sensitiveStep: 'tạo người dùng có mật khẩu, đổi mật khẩu người dùng' });
  // QL 1.3.3 — chấm dứt/thay đổi công việc: khóa, gỡ quyền, thu hồi phiên
  A('U', 'QL 1.3.3', 'Tài khoản thôi việc', 'QTV khóa người dùng: trạng thái "Đã khóa" và không đăng nhập được', 'Cao',
    '1. QTV tạo người dùng QCA\n2. Màn Người dùng → Khóa → Xác nhận\n3. Đăng nhập bằng tài khoản đó', 'Trạng thái "Đã khóa"; đăng nhập bị từ chối với thông báo tài khoản bị khóa', 'Manual', MAN(CAPTCHA));
  A('U', 'QL 1.3.3', 'Tài khoản thôi việc', 'Tài khoản bị khóa thì mọi token đang dùng hết hiệu lực ngay', 'Cao',
    '1. Người dùng QCA đăng nhập ở trình duyệt X (giữ phiên)\n2. QTV khóa tài khoản\n3. Ở trình duyệt X thao tác / gọi API bằng token cũ', 'API trả 401 ngay lập tức; trình duyệt X bị đưa về trang đăng nhập', 'Manual', MAN(CAPTCHA));
  A('U', 'QL 1.3.3', 'Tài khoản thôi việc', 'QTV gỡ người dùng khỏi nhóm quyền và đơn vị khi thôi việc / chuyển công tác', 'Cao',
    '1. Người dùng QCA đang thuộc nhóm X và đơn vị Y\n2. QTV cập nhật: bỏ nhóm, bỏ đơn vị (hoặc chuyển đơn vị)\n3. Kiểm tra lại người dùng, nhóm X, đơn vị Y', 'Người dùng không còn trong nhóm X và đơn vị Y; quyền cũ không còn hiệu lực ở lần gọi API kế tiếp', 'Manual', MAN('UC_1409 (29/09): Người dùng – thêm/sửa/xóa đang lỗi; chạy khi chức năng ổn định'));
  A('U', 'QL 1.3.3', 'Tài khoản thôi việc', 'Mở khóa người dùng khôi phục đăng nhập; thao tác khóa/mở khóa được ghi nhật ký', 'Trung bình',
    '1. Khóa rồi mở khóa người dùng QCA\n2. Đăng nhập bằng tài khoản đó\n3. Tra nhật ký', 'Đăng nhập lại được; có 2 bản ghi Khóa / Mở khóa đúng đối tượng', 'Manual', MAN(CAPTCHA));
  A('U', 'KT 1.2.1b', 'Tài khoản mặc định', 'Tài khoản seed/mặc định của ứng dụng (qa.superadmin, admin…) đã đổi mật khẩu hoặc bị khóa trước go-live', 'Cao',
    '1. Lấy danh sách tài khoản được tạo sẵn khi triển khai (seed)\n2. Thử đăng nhập bằng mật khẩu mặc định trong tài liệu/mã nguồn', 'Không tài khoản nào đăng nhập được bằng mật khẩu mặc định; tài khoản QC/test bị khóa hoặc xóa trên môi trường chính thức', 'Manual', MAN(CAPTCHA + '; thực hiện trước go-live'));
  A('S', 'KT 1.3.1b; UD 742-4.4', 'Dữ liệu nhạy cảm', '[API] Thông tin người dùng (idm/users/info, idm/users, idm/users/{id}) không trả giá trị resetPasswordToken, emailVerifyToken, mật khẩu', 'Cao',
    '1. Gọi idm/users/info bằng token cán bộ\n2. Gọi idm/users và idm/users/{id} bằng token QTV', 'Không có trường mật khẩu/hash; resetPasswordToken và emailVerifyToken không có hoặc luôn rỗng (không lộ token đặt lại mật khẩu)');
  // A.III.2 — Tham số hệ thống
  A('C', 'KT 1.3.1c-2', 'Tham số hệ thống', '[API] Tham số "Chính sách mật khẩu" có đủ: độ dài tối thiểu, chữ hoa, chữ thường, chữ số, ký tự đặc biệt', 'Cao',
    '1. Gọi GET system/parameters bằng token QTV\n2. Tìm các tham số nhóm SECURITY', 'Có PASSWORD_MIN_LENGTH, PASSWORD_REQUIRE_UPPER_LOWER (hoặc tách hoa/thường), PASSWORD_REQUIRE_NUMBER, PASSWORD_REQUIRE_SPECIAL_CHAR với giá trị hợp lệ');
  A('C', 'KT 1.3.1c-3', 'Tham số hệ thống', '[API] Có tham số "Thời gian yêu cầu thay đổi mật khẩu" (số ngày tối thiểu giữa 2 lần đổi)', 'Cao',
    '1. Gọi GET system/parameters', 'Có tham số số ngày tối thiểu giữa hai lần đổi mật khẩu (cách hiểu thống nhất với dự án GIS đã nghiệm thu)', 'Auto', 'Khảo sát 28/10: chưa thấy tham số này (chỉ có PASSWORD_EXPIRY_DAYS, PASSWORD_CHANGE_WARNING_DAYS)');
  A('C', 'KT 1.3.1c-4', 'Tham số hệ thống', '[API] Có tham số "Thời gian mật khẩu hợp lệ" và hành động khi hết hạn', 'Cao',
    '1. Gọi GET system/parameters', 'Có PASSWORD_EXPIRY_DAYS (> 0) và PASSWORD_ON_EXPIRE_ACTION = FORCE_CHANGE (khóa + bắt buộc đổi)');
  A('C', 'KT 1.3.1d', 'Tham số hệ thống', '[API] Có tham số giới hạn đăng nhập sai: số lần sai tối đa, khung thời gian tính, thời gian khóa tạm', 'Cao',
    '1. Gọi GET system/parameters', 'Có MAX_LOGIN_FAIL_COUNT, tham số khung thời gian (phút) và LOGIN_LOCK_DURATION_MINUTES', 'Auto', 'Khảo sát 28/10: chưa thấy tham số "khung thời gian" đếm số lần sai');
  A('C', 'KT 1.3.2b', 'Tham số hệ thống', '[API] Có tham số thời gian chờ phiên (SESSION_TIMEOUT_MINUTES) giá trị > 0', 'Cao',
    '1. Gọi GET system/parameters', 'Có SESSION_TIMEOUT_MINUTES là số nguyên dương');
  A('C', 'KT 1.3.2c', 'Tham số hệ thống', '[API] Có tab/tham số "Truy cập quản trị": danh sách IP/dải IP (CIDR) được phép quản trị', 'Cao',
    '1. Gọi GET system/parameters và system/configurations\n2. Mở màn Tham số hệ thống', 'Có cấu hình danh sách IP/CIDR được phép dùng chức năng quản trị', 'Auto', 'Chức năng mới, chưa có trong UC_1409 → dự kiến FAIL đến khi phát triển');
  A('C', 'KT 1.3.3b; NK-10', 'Tham số hệ thống', '[API] Có tham số thời gian lưu nhật ký (ngày)', 'Cao',
    '1. Gọi GET system/parameters', 'Có tham số thời gian lưu nhật ký, giá trị ≥ 30');
  A('C', 'KT 1.3.1a', 'Tham số hệ thống', '[API] Đọc tham số hệ thống phải có token và quyền SYSTEM_PARAMETER.VIEW', 'Cao',
    '1. Gọi GET system/parameters không token\n2. Gọi bằng token cán bộ không có quyền SYSTEM_PARAMETER.VIEW', 'Cả hai trả 401/403; không lộ cấu hình bảo mật (độ dài mật khẩu, số lần sai…) cho người ngoài', 'Auto', 'Khảo sát 28/10: không token vẫn trả 200 kèm toàn bộ chính sách bảo mật');
  A('C', 'KT 1.3.1c-2; KT 1.3.1d', 'Tham số hệ thống', '[API] Chỉ có một nguồn cấu hình chính sách: giá trị ở system/parameters và system/configurations khớp nhau', 'Cao',
    '1. Gọi GET system/parameters và GET system/configurations\n2. So sánh PASSWORD_MIN_LENGTH, MAX_LOGIN_FAIL_COUNT, LOGIN_LOCK_DURATION_MINUTES, SESSION_TIMEOUT_MINUTES, PASSWORD_EXPIRY_DAYS', 'Mọi tham số trùng mã có cùng giá trị (không có 2 cấu hình mâu thuẫn, không rõ cấu hình nào được thực thi)', 'Auto', 'Khảo sát 28/10: PASSWORD_MIN_LENGTH 6 ≠ 8; MAX_LOGIN_FAIL_COUNT 2 ≠ 5');
  A('C', 'KT 1.3.1c-2', 'Tham số hệ thống', 'Màn Tham số hệ thống – tab "Chính sách mật khẩu": sửa độ dài tối thiểu/loại ký tự và lưu; áp dụng ngay ở mọi nơi đặt mật khẩu', 'Cao',
    '1. Đổi độ dài tối thiểu 8 → 10, bật đủ loại ký tự, Lưu\n2. Thử đặt mật khẩu 9 ký tự ở: Thêm người dùng, Đổi mật khẩu, Quên mật khẩu, Đổi mật khẩu bắt buộc\n3. Khôi phục tham số', 'Cả 4 nơi đều chặn (FE và BE) với thông báo theo tham số mới', 'Manual', MAN(PARAM));
  A('C', 'KT 1.3.4', 'Tham số hệ thống', 'Validate giá trị tham số: độ dài < 1, chữ thay số, thời gian chờ ≤ 0, thời gian lưu nhật ký < 30 ngày bị từ chối', 'Trung bình',
    '1. Lần lượt nhập giá trị không hợp lệ vào các tham số\n2. Lưu', 'Báo lỗi, không lưu; thời gian lưu nhật ký không cho đặt < 30 ngày (NK-10)', 'Manual', MAN(PARAM));
  A('N', 'KT 1.3.3a-4', 'Nhật ký', 'Lưu tham số hệ thống được ghi nhật ký loại "Thay đổi cấu hình" với giá trị trước → sau', 'Cao',
    '1. Sửa 1 tham số và Lưu\n2. Tra nhật ký, mở chi tiết', 'Có bản ghi Loại = Thay đổi cấu hình, Đối tượng = mã tham số, giá trị trước → sau', 'Manual', MAN(PARAM));
  A('N', 'KT 1.3.3a-4', 'Nhật ký', 'Sửa ma trận phân quyền được ghi nhật ký loại "Thay đổi cấu hình" với quyền trước → sau', 'Cao',
    '1. Ghi nhận T0; tạo nhóm QCA\n2. Gán quyền USER.VIEW cho nhóm qua Ma trận phân quyền, rồi gỡ\n3. Tra nhật ký từ T0', 'Có bản ghi Thay đổi cấu hình cho nhóm QCA, chi tiết thể hiện danh sách quyền trước → sau');
  // KT 1.3.2c — IP quản trị
  A('I', 'KT 1.3.2c', 'IP quản trị', 'Gọi chức năng quản trị từ IP ngoài danh sách cho phép bị BE chặn 403 và ghi nhật ký', 'Cao',
    '1. Cấu hình danh sách IP chỉ gồm IP văn phòng\n2. Từ IP khác gọi API quản trị (idm/users, system/parameters…)\n3. Tra nhật ký', 'HTTP 403; chức năng nghiệp vụ thông thường vẫn dùng được; nhật ký ghi Thất bại kèm IP thật', 'Manual', MAN(PARAM + '; cần 2 IP nguồn'));
  A('I', 'KT 1.3.2c', 'IP quản trị', 'IP đơn lẻ và dải CIDR trong danh sách được phép quản trị bình thường', 'Trung bình',
    '1. Thêm 1 IP đơn lẻ và 1 dải CIDR\n2. Truy cập quản trị từ IP thuộc từng loại', 'Truy cập được; nhập IP/CIDR sai định dạng bị từ chối khi lưu', 'Manual', MAN(PARAM));
  A('I', 'NK-07; KT 1.3.2c', 'IP quản trị', '[API] Hệ thống không tin X-Forwarded-For do client tự gửi: nhật ký ghi IP thật, không ghi IP giả mạo', 'Cao',
    '1. Gọi API (thao tác có ghi nhật ký) kèm header X-Forwarded-For: 10.6.6.6\n2. Tra bản ghi nhật ký vừa sinh', 'Địa chỉ IP trong nhật ký là IP thật của máy gọi, không phải 10.6.6.6 và không phải IP của reverse proxy');
  // Màn Nhật ký truy cập (A.III.3) — NK-01..NK-12, KT 1.3.3
  A('N', 'KT 1.3.3a-1', 'Nhật ký', '[API] Hệ thống thực sự ghi nhật ký: sau khi có thao tác, log-audit-resource có bản ghi mới', 'Cao',
    '1. Ghi nhận tổng số bản ghi nhật ký\n2. Thực hiện một thao tác thêm và xóa dữ liệu QCA\n3. Gọi lại log-audit-resource', 'Tổng số bản ghi tăng; bản ghi mới có thời gian ≥ T0', 'Auto', 'Khảo sát 28/10: log-audit-resource trả totalElements = 0');
  A('N', 'NK-01', 'Nhật ký', 'Màn Nhật ký truy cập có bộ lọc/tab "Loại nhật ký" gồm 4 loại: Truy cập/thao tác, Đăng nhập, Lỗi hệ thống, Thay đổi cấu hình', 'Cao',
    '1. Đăng nhập QTV, mở màn Nhật ký truy cập (#/vi/audit-log)\n2. Mở bộ lọc Loại nhật ký', 'Có đủ 4 loại; chọn từng loại chỉ hiển thị bản ghi đúng loại', 'Auto', 'Thiết kế hiện tại chưa có');
  A('N', 'NK-02', 'Nhật ký', 'Danh sách nhật ký hiển thị đủ cột: Thời gian, Người dùng, Loại nhật ký, Chức năng/Module, Hành động, Đối tượng, Kết quả, Địa chỉ IP', 'Cao',
    '1. Mở màn Nhật ký truy cập', 'Bảng có đủ 8 cột; cột Kết quả hiển thị Thành công/Thất bại', 'Auto', 'Thiết kế hiện tại thiếu Loại, Chức năng, Kết quả');
  A('N', 'NK-03', 'Nhật ký', 'Tra cứu nhật ký: lọc Từ ngày – Đến ngày, người dùng, loại, hành động, kết quả, IP, từ khóa; phân trang, tổng số, mới nhất trước', 'Cao',
    '1. Mở màn Nhật ký truy cập\n2. Kiểm tra các bộ lọc và phân trang\n3. Lọc theo khoảng ngày hôm nay', 'Có đủ bộ lọc; có phân trang và tổng số bản ghi; bản ghi đầu tiên là mới nhất; lọc ngày chỉ trả bản ghi trong khoảng', 'Auto', 'Thiết kế hiện tại chưa có lọc thời gian, phân trang');
  A('N', 'NK-04; KT 1.3.3a-3', 'Nhật ký', 'Xem chi tiết bản ghi nhật ký: đủ trường, user agent, đơn vị, giá trị trước → sau; bản ghi Lỗi có mã lỗi, trace id, stack trace (chỉ QTV thấy)', 'Cao',
    '1. Mở chi tiết 1 bản ghi Cập nhật, 1 bản ghi Lỗi hệ thống', 'Popup/drawer hiển thị đủ thông tin; stack trace chỉ có ở màn này, không bao giờ trả về người dùng cuối', 'Manual', MAN('cần có sẵn bản ghi Cập nhật và Lỗi hệ thống; UC_1409 ghi "xem chi tiết" Hỏi thêm'));
  A('N', 'NK-05', 'Nhật ký', 'Xuất Excel nhật ký theo đúng bộ lọc đang chọn, có giới hạn số dòng/xuất nền; hành động xuất được ghi nhật ký', 'Trung bình',
    '1. Lọc nhật ký theo loại + khoảng ngày\n2. Bấm Xuất Excel\n3. Mở file; tra nhật ký', 'File chỉ chứa bản ghi đúng bộ lọc; có bản ghi "Xuất nhật ký"', 'Manual', MAN('tải file qua trình duyệt, đối chiếu nội dung'), 'Chức năng');
  A('N', 'NK-06', 'Nhật ký', '[API] Nhật ký chỉ ghi thêm: không sửa/xóa được bản ghi nhật ký qua API (kể cả QTV)', 'Cao',
    '1. Bằng token QTV gọi PUT, PATCH, DELETE log-audit-resource/{id}\n2. Gọi POST log-audit-resource với dữ liệu giả', 'HTTP 403/404/405; không bản ghi nào bị sửa/xóa/chèn giả');
  A('N', 'NK-06', 'Nhật ký', 'Tài khoản CSDL của ứng dụng chỉ có quyền INSERT/SELECT trên bảng nhật ký; chỉ job dọn quá hạn được xóa', 'Trung bình',
    '1. Kiểm tra GRANT của tài khoản DB ứng dụng trên bảng nhật ký', 'Không có quyền UPDATE/DELETE (trừ tài khoản job dọn dữ liệu)', 'Manual', MAN(DB));
  A('N', 'NK-07', 'Nhật ký', 'Địa chỉ IP trong nhật ký là IP thật của người dùng (đi qua reverse proxy)', 'Cao',
    '1. Từ máy có IP công khai đã biết, thao tác trên hệ thống\n2. Tra nhật ký', 'Cột Địa chỉ IP = IP công khai của máy, không phải IP nội bộ của nginx/LB', 'Manual', MAN('cần đối chiếu IP công khai của máy kiểm thử'));
  A('N', 'NK-09', 'Nhật ký', 'Thời gian nhật ký lưu UTC, hiển thị theo giờ Việt Nam (UTC+7); máy chủ ứng dụng và DB đồng bộ NTP', 'Trung bình',
    '1. Thao tác lúc HH:mm giờ VN\n2. Xem bản ghi trên màn và trong phản hồi API', 'Màn hiển thị HH:mm (UTC+7); API/DB lưu UTC (HH-7); lệch đồng hồ máy chủ so với NTP < 1 giây', 'Manual', MAN('cần đối chiếu đồng hồ và cấu hình NTP máy chủ'));
  A('N', 'NK-10', 'Nhật ký', 'Màn Nhật ký hiển thị "Nhật ký được lưu trong X ngày" theo tham số; job hằng ngày xóa bản ghi quá hạn và tự ghi 1 bản ghi số lượng đã dọn', 'Trung bình',
    '1. Mở màn Nhật ký truy cập\n2. Sau khi job dọn chạy, tra nhật ký loại Thay đổi cấu hình/Hệ thống', 'Có dòng thông tin thời gian lưu = giá trị tham số; có bản ghi của job dọn kèm số bản ghi đã xóa', 'Manual', MAN('phụ thuộc lịch chạy job hằng ngày'));
  A('N', 'NK-11', 'Nhật ký', '[API] Chỉ nhóm Quản trị hệ thống xem/xuất được nhật ký; "Xem nhật ký" và "Xuất nhật ký" là 2 quyền riêng', 'Cao',
    '1. Gọi log-audit-resource bằng token các tài khoản không phải QTV\n2. Kiểm tra danh mục quyền (idm/rights / permission-matrix) nhóm LOG_AUDIT_RESOURCE', 'Tài khoản không phải QTV nhận 403; tồn tại 2 mã quyền LOG_AUDIT_RESOURCE.VIEW và LOG_AUDIT_RESOURCE.EXPORT');
  A('N', 'NK-12', 'Nhật ký', 'Bảng nhật ký có đủ trường tối thiểu, index theo thời gian/loại/người dùng; lưu bản chụp Họ tên để tra được người dùng đã bị xóa', 'Trung bình',
    '1. Xem cấu trúc bảng nhật ký trong CSDL\n2. Xóa 1 người dùng QCA đã có nhật ký, tra lại nhật ký của người đó', 'Đủ trường Id, ThoiGian(UTC), LoaiNhatKy, MucDo, UserId, TenDangNhap, HoTen, DonVi, IP, UserAgent, ChucNang, HanhDong, LoaiDoiTuong, DoiTuongId, TenDoiTuong, KetQua, MoTa, DuLieuCu, DuLieuMoi, MaLoi, TraceId; có 3 index; vẫn thấy họ tên người đã xóa', 'Manual', MAN(DB));
  A('N', 'KT 1.3.3b', 'Nhật ký', 'Nhật ký được lưu tối thiểu 01 tháng: bản ghi 30 ngày trước vẫn tra cứu được', 'Cao',
    '1. Lọc nhật ký Từ ngày = hôm nay − 31 ngày, Đến ngày = hôm nay − 29 ngày', 'Có bản ghi của khoảng thời gian đó (khi hệ thống đã vận hành ≥ 1 tháng)', 'Manual', MAN('cần hệ thống đã ghi nhật ký liên tục ≥ 1 tháng'));
  A('N', 'KT 1.3.3a-3', 'Nhật ký', 'Lỗi hệ thống được ghi nhật ký loại "Lỗi hệ thống" kèm mã lỗi, trace id; người dùng chỉ thấy thông báo chung kèm mã lỗi', 'Cao',
    '1. Gây lỗi có chủ đích (VD tham số sai kiểu làm BE ném exception)\n2. Ghi lại mã lỗi hiển thị cho người dùng\n3. Tra nhật ký loại Lỗi hệ thống theo mã lỗi/trace id', 'Có bản ghi lỗi trùng trace id; chi tiết có stack trace; thông báo cho người dùng không có stack trace');
  // KT 1.4.2 / KT 1.4.1 — sao lưu
  A('D', 'KT 1.4.2', 'Sao lưu', '[API] Lịch sử sao lưu có bản sao lưu gần nhất ở trạng thái Thành công (có tệp, dung lượng)', 'Cao',
    '1. Gọi GET system/backups bằng token QTV\n2. Xem bản ghi mới nhất', 'Bản mới nhất Thành công, có filePath và fileSizeBytes > 0', 'Auto', 'Khảo sát 28/10: 2 bản đều Failed — pg_dump không có trên máy chủ');
  A('D', 'KT 1.4.2', 'Sao lưu', 'Sao lưu ngay: tạo bản sao lưu CSDL + tệp nghiệp vụ; lịch sử hiển thị thời điểm, người thực hiện, trạng thái, dung lượng', 'Cao',
    '1. Màn Sao lưu (#/vi/backup) → Sao lưu ngay\n2. Chờ hoàn tất, xem lịch sử', 'Bản sao lưu mới Thành công; tải/kiểm tra được tệp; có cả CSDL và tệp minh chứng', 'Manual', MAN('tạo bản sao lưu thật trên máy chủ (tốn dung lượng)'), 'Chức năng');
  A('D', 'KT 1.4.2; QL 1.5.3', 'Sao lưu', 'Bản sao lưu lưu ở nơi tách biệt máy chủ chính và khôi phục thử thành công', 'Cao',
    '1. Xác định nơi lưu bản sao lưu\n2. Khôi phục bản sao lưu lên môi trường thử\n3. Đối chiếu dữ liệu', 'Nơi lưu khác máy chủ chính; khôi phục thành công, dữ liệu đầy đủ; có biên bản thử khôi phục định kỳ', 'Manual', MAN(INFRA));
  A('D', 'KT 1.4.1', 'Mã hóa dữ liệu', 'Dữ liệu không công khai (thông tin cá nhân cán bộ, kết quả tự đánh giá chưa công bố, tệp minh chứng) và tệp sao lưu được lưu có mã hóa', 'Cao',
    '1. Xác định danh mục dữ liệu không công khai\n2. Kiểm tra mã hóa ổ đĩa/volume DB và thư mục tệp, hoặc mã hóa cột (AES-256)\n3. Mở thử tệp sao lưu bằng công cụ thông thường', 'Dữ liệu và tệp sao lưu không đọc được khi không có khóa; khóa lưu tách biệt', 'Manual', MAN(DB));
  A('D', 'KT 1.3.3a-3; PM 3', 'Sao lưu', '[API] Lỗi sao lưu không lộ thông tin nội bộ máy chủ (đường dẫn, tên tiến trình) trong phản hồi API', 'Trung bình',
    '1. Gọi GET system/backups\n2. Đọc trường errorMessage của các bản lỗi', 'Thông báo lỗi chung kèm mã lỗi; chi tiết kỹ thuật chỉ ghi vào nhật ký Lỗi hệ thống', 'Auto', 'Khảo sát 28/10: errorMessage chứa "/opt/cds/app/api" và tên tiến trình pg_dump');
  A('D', 'KT 1.3.1a', 'Sao lưu', '[API] Chỉ tài khoản có quyền BACKUP.* xem/tạo/xóa được sao lưu', 'Cao',
    '1. Gọi GET/POST/DELETE system/backups bằng token các tài khoản không có quyền BACKUP', 'HTTP 403; không tạo/xóa được bản sao lưu');
  A('D', 'KT 1.3.3a-4', 'Sao lưu', 'Sao lưu ngay, xóa bản sao lưu, đổi cấu hình sao lưu được ghi nhật ký', 'Trung bình',
    '1. Thực hiện sao lưu ngay, xóa 1 bản, đổi lịch sao lưu\n2. Tra nhật ký', 'Mỗi thao tác 1 bản ghi; đổi cấu hình có giá trị trước → sau', 'Manual', MAN('tạo/xóa bản sao lưu thật'));

  // ============================== PHÂN HỆ B ==============================
  const B = mk(t, 'ATB');
  moduleSuite(B, 'ATB', { createRes: 'trụ cột (dti/pillars)', cud: 'Thêm, sửa tên, xóa một trụ cột QCA' });
  B('N', 'KT 1.3.3a-4', 'Nhật ký', 'Thay đổi cấu hình bộ chỉ số (gán chỉ số, trọng số, thang xếp loại, kỳ tự đánh giá) được ghi nhật ký loại "Thay đổi cấu hình" trước → sau', 'Cao',
    '1. Ghi nhận T0\n2. Tạo bộ chỉ số QCA, gán/bỏ chỉ số, đổi tên\n3. Tra nhật ký từ T0', 'Có bản ghi Thay đổi cấu hình cho bộ chỉ số QCA; chi tiết thể hiện giá trị trước → sau');
  B('V', 'KT 1.3.4', 'Kiểm tra đầu vào', 'Công thức tính điểm (NCalc) chỉ chấp nhận hàm/biến trong danh sách trắng', 'Cao',
    '1. Ở nơi cấu hình công thức tính điểm nhập: tên hàm lạ, biểu thức gọi hệ thống, biến không tồn tại, biểu thức rất dài/lồng sâu\n2. Lưu và tính điểm thử', 'Bị từ chối khi lưu với thông báo rõ; không thực thi biểu thức ngoài danh sách trắng; không treo máy chủ', 'Manual', MAN('xác định màn cấu hình công thức với BA/Dev; nếu hệ thống không cho nhập công thức thì ghi Không áp dụng'));
  B('V', 'KT 1.3.4', 'Kiểm tra đầu vào', '[API] Điểm tối thiểu/tối đa, trọng số, ngưỡng thang xếp loại ngoài miền hợp lệ bị BE từ chối', 'Cao',
    '1. POST chỉ số với minScore > maxScore, điểm âm, chuỗi thay số\n2. POST thang xếp loại với ngưỡng chồng lấn / > 100%', 'HTTP 400; không lưu dữ liệu sai miền');

  // ============================== PHÂN HỆ C ==============================
  const C = mk(t, 'ATC');
  const OPEN = MAN('cần kết quả tự đánh giá đang mở chấm điểm của tài khoản cán bộ (dữ liệu nghiệp vụ C không tạo được bằng API thuần)');
  moduleSuite(C, 'ATC', { v01Auto: 'Manual', v01Note: OPEN, cudAuto: 'Manual', cudNote: OPEN, bizAuto: 'Manual', bizNote: OPEN, idor: 'kết quả tự đánh giá của đơn vị khác', createRes: 'điểm chấm/ghi chú (PUT kết quả tự đánh giá)', cud: 'Chấm điểm, sửa điểm, xóa tệp minh chứng của một kết quả QCA',
    xssStep: 'Nhập ghi chú/ý kiến chứa <img src=x onerror=window.__xss=1> khi chấm điểm hoặc trả lại', xssAuto: 'Manual', xssNote: OPEN,
    sensitiveStep: 'tải lên tệp minh chứng' });
  C('F', 'KT 1.3.4', 'Tệp tải lên', '[API] Tải lên minh chứng chặn đuôi tệp nguy hiểm (.exe, .html, .svg, .js, .php)', 'Cao',
    '1. Bằng token cán bộ gọi POST upload/blob/assessment_result_file với tệp nội dung văn bản nhưng tên .exe, .html, .svg, .js, .php', 'HTTP 400 với thông báo định dạng không cho phép; tệp không được lưu');
  C('F', 'KT 1.3.4', 'Tệp tải lên', '[API] Tải lên minh chứng kiểm tra nội dung/MIME thật, không chỉ đuôi tệp', 'Cao',
    '1. Tải lên tệp tên "qca.pdf" nhưng nội dung là HTML có <script>\n2. Tải lên tệp .pdf khai báo Content-Type application/x-msdownload', 'Bị từ chối (400); không lưu tệp giả mạo', 'Auto', 'Nếu hệ thống chỉ kiểm tra đuôi → FAIL (TCVN 6.2.3.4)');
  C('F', 'KT 1.3.4', 'Tệp tải lên', 'Tải lên minh chứng vượt dung lượng tối đa bị từ chối', 'Trung bình',
    '1. Tải lên tệp PDF lớn hơn giới hạn cấu hình (VD 25 MB)', 'Báo lỗi vượt dung lượng; không lưu; máy chủ không treo', 'Manual', MAN('cần tệp dung lượng lớn và giới hạn được BA xác nhận'));
  C('F', 'KT 1.3.1a; KT 1.4.1', 'Tệp tải lên', 'Tệp minh chứng chỉ tải được khi đăng nhập và thuộc phạm vi đơn vị; không truy cập trực tiếp bằng URL công khai', 'Cao',
    '1. Lấy đường dẫn tải tệp minh chứng của 1 kết quả\n2. Mở đường dẫn ở trình duyệt chưa đăng nhập\n3. Mở bằng tài khoản đơn vị khác', 'Bước 2, 3 bị từ chối (401/403); không tải được nội dung tệp', 'Manual', MAN('cần kết quả có tệp minh chứng và tài khoản 2 đơn vị'));
  C('Q', 'KT 1.3.1a', 'Phân quyền BE', '[API] Kết quả đã gửi Bộ/đã khóa không sửa được điểm qua API kể cả khi gọi thẳng', 'Cao',
    '1. Lấy 1 kết quả đã gửi Bộ\n2. Bằng token cán bộ đơn vị đó gọi PUT điểm', 'HTTP 4xx; điểm không đổi', 'Manual', MAN('đã có testcase nghiệp vụ tương ứng ở RES-*; kiểm lại trong đợt rà soát ATTT'));
  C('D', 'KT 1.4.1', 'Mã hóa dữ liệu', 'Kết quả tự đánh giá chưa công bố và tệp minh chứng được xếp loại dữ liệu không công khai và lưu có mã hóa', 'Cao',
    '1. Đối chiếu danh mục dữ liệu không công khai\n2. Kiểm tra mã hóa nơi lưu bảng kết quả và thư mục tệp minh chứng', 'Có trong danh mục; nơi lưu được mã hóa', 'Manual', MAN(DB));

  // ============================== PHÂN HỆ E ==============================
  const E = mk(t, 'ATE');
  moduleSuite(E, 'ATE', { idor: 'đợt khảo sát của đơn vị khác', createRes: 'đợt khảo sát (survey/surveys)', cud: 'Tạo, sửa tên, xóa một đợt khảo sát nháp QCA',
    publicNote: 'Ngoại lệ: public/surveys (API công khai cho người dân) được phép không token nhưng chỉ trả dữ liệu công khai',
    xssStep: 'Người dân gửi phiếu có Góp ý chứa <img src=x onerror=window.__xss=1>', xssAuto: 'Manual', xssNote: MAN('API công khai giới hạn ~5 phiếu/phút và cần đợt trực tuyến đang mở; xem góp ý ở màn Phiếu trả lời/Kết quả'),
    bizAuto: 'Auto', export: true });
  E('X', 'KT 1.3.1a', 'API công khai', '[API] API công khai chỉ gồm danh sách đợt đang mở, nội dung đợt và gửi phiếu; mọi API quản trị khảo sát bắt buộc token', 'Cao',
    '1. Không token gọi: survey/surveys, survey/surveys/{id}, survey/surveys/{id}/status, các API thống kê/kết quả\n2. Không token gọi public/surveys', 'Bước 1 trả 401; bước 2 trả 200 chỉ với trường công khai (không người tạo, lịch sử, số phiếu, mục tiêu)');
  E('V', 'KT 1.3.4', 'API công khai', '[API] Gửi phiếu công khai với dữ liệu sai (câu không thuộc đợt, giá trị ngoài Hài lòng/Chưa hài lòng, góp ý quá dài, đợt không tồn tại) bị BE từ chối', 'Cao',
    '1. Không token POST phiếu tới đợt trực tuyến đang mở với từng loại dữ liệu sai', 'HTTP 400/404; không ghi nhận phiếu; không lỗi 500', 'Auto', 'Chỉ gửi dữ liệu sai — không tạo phiếu hợp lệ');
  E('W', 'PM 3', 'API công khai', 'Gửi phiếu công khai có cơ chế chống gửi tự động hàng loạt (giới hạn tần suất / captcha)', 'Cao',
    '1. Gửi liên tiếp nhiều phiếu hợp lệ từ cùng IP trong 1 phút', 'Sau ngưỡng bị từ chối (429 hoặc thông báo); số phiếu ghi nhận không vượt ngưỡng', 'Manual', MAN('tạo phiếu thật trên đợt đang mở; đã có PUB-S* tương ứng'));
  E('S', 'KT 1.4.1', 'Dữ liệu nhạy cảm', 'Phiếu người dân không lưu/không hiển thị thông tin định danh (IP, thiết bị) ở màn Phiếu trả lời và tệp xuất', 'Trung bình',
    '1. Mở chi tiết phiếu trực tuyến ở màn Phiếu trả lời\n2. Xuất Excel kết quả', 'Không hiển thị IP/thiết bị/định danh người trả lời', 'Manual', MAN('đã có ANS/SRT tương ứng; kiểm lại trong đợt rà soát ATTT'));

  // ============================== AUTH (Xác thực) ==============================
  const U = mk(t, 'ATU');
  U('X', 'KT 1.3.1a', 'Xác thực', '[API] Đăng nhập thiếu/sai captcha không cấp token kể cả khi tên đăng nhập và mật khẩu đúng định dạng', 'Cao',
    '1. POST authentication/jwt/login: không captcha; captchaId giả; captchaCode sai', 'HTTP 400; không có accessToken trong phản hồi');
  U('X', 'KT 1.3.1d; PM 3', 'Xác thực', 'Thông báo đăng nhập sai không tiết lộ tài khoản có tồn tại hay không', 'Cao',
    '1. Đăng nhập tài khoản không tồn tại + mật khẩu bất kỳ\n2. Đăng nhập tài khoản có thật + sai mật khẩu', 'Hai thông báo giống nhau (VD "Tên đăng nhập hoặc mật khẩu không đúng")', 'Manual', MAN(CAPTCHA));
  U('P', 'KT 1.3.1b', 'Mật khẩu', 'Mật khẩu lưu dạng hash có salt (PBKDF2-HMAC-SHA256/512 hoặc tương đương), không lưu rõ hay mã hóa 2 chiều', 'Cao',
    '1. Truy vấn bảng người dùng trong CSDL\n2. Tạo 2 người dùng cùng mật khẩu, so sánh giá trị lưu', 'Cột mật khẩu là chuỗi hash (VD tiền tố AQAAAA… của ASP.NET Identity v3); 2 người cùng mật khẩu có hash khác nhau; chụp ảnh làm minh chứng', 'Manual', MAN(DB));
  U('P', 'KT 1.3.1b', 'Mật khẩu', '[API] Tạo người dùng rồi đọc lại: không API nào trả mật khẩu hay hash', 'Cao',
    '1. QTV tạo người dùng QCA có mật khẩu\n2. Đọc lại bằng idm/users, idm/users/{id}', 'Phản hồi không có trường password/passwordHash hoặc chuỗi mật khẩu vừa đặt');
  U('P', 'KT 1.3.1b', 'Mật khẩu', 'Phiên đăng nhập lưu ở trình duyệt không chứa mật khẩu dạng rõ (localStorage/sessionStorage/cookie)', 'Cao',
    '1. Đăng nhập\n2. Kiểm tra localStorage, sessionStorage, cookie của trang', 'Không có mật khẩu dạng rõ; chỉ có token');
  U('P', 'KT 1.3.1c-1', 'Mật khẩu', '[API] Tạo người dùng có tích "Bắt buộc đổi mật khẩu" → lưu cờ isRequireChangePassword = true', 'Cao',
    '1. POST idm/users với isRequireChangePassword = true\n2. Đọc lại người dùng', 'isRequireChangePassword = true');
  U('P', 'KT 1.3.1c-1', 'Mật khẩu', 'Đăng nhập lần đầu bằng mật khẩu mặc định chuyển thẳng màn Đổi mật khẩu bắt buộc, không đóng/bỏ qua được', 'Cao',
    '1. QTV tạo người dùng (bắt buộc đổi mật khẩu)\n2. Đăng nhập lần đầu\n3. Thử đóng màn, bấm Back, mở URL trang chủ', 'Luôn ở màn Đổi mật khẩu bắt buộc đến khi đổi xong', 'Manual', MAN(CAPTCHA + '; UC_1409: Figma màn Đổi mật khẩu bắt buộc chưa làm'));
  U('P', 'KT 1.3.1c-1', 'Mật khẩu', 'Khi chưa đổi mật khẩu bắt buộc, BE chặn mọi API nghiệp vụ khác', 'Cao',
    '1. Người dùng bị gắn cờ bắt buộc đổi mật khẩu đăng nhập\n2. Dùng token đó gọi API nghiệp vụ (dti/pillars, survey/surveys…)', 'HTTP 403 với thông báo cần đổi mật khẩu; chỉ API đổi mật khẩu/đăng xuất được phép', 'Manual', MAN(CAPTCHA));
  U('P', 'KT 1.3.1c-1', 'Mật khẩu', 'QTV đặt lại mật khẩu cho người dùng → người dùng bị bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp', 'Cao',
    '1. QTV sửa người dùng, nhập mật khẩu mới\n2. Người dùng đăng nhập bằng mật khẩu đó', 'Chuyển màn Đổi mật khẩu bắt buộc', 'Manual', MAN(CAPTCHA));
  U('P', 'KT 1.3.1c-2', 'Mật khẩu', '[API] QTV tạo người dùng: BE từ chối mật khẩu vi phạm chính sách (ngắn hơn tối thiểu, thiếu hoa/thường, thiếu số, thiếu ký tự đặc biệt, chứa tên đăng nhập)', 'Cao',
    '1. POST idm/users lần lượt với 5 mật khẩu vi phạm từng quy tắc', 'Cả 5 trường hợp HTTP 400; không tạo người dùng', 'Auto', 'Khảo sát trước: API tạo người dùng nhận mật khẩu 5 ký tự (USR-C16)');
  U('P', 'KT 1.3.1c-2', 'Mật khẩu', 'Màn Đổi mật khẩu bắt buộc (lần đầu / hết hạn) áp dụng đủ quy tắc mật khẩu ở FE và BE', 'Cao',
    '1. Ở màn Đổi mật khẩu bắt buộc nhập lần lượt mật khẩu vi phạm từng quy tắc', 'Bị chặn với thông báo đúng quy tắc vi phạm', 'Manual', MAN(CAPTCHA));
  U('P', 'KT 1.3.1c-2', 'Mật khẩu', 'Gợi ý quy tắc mật khẩu trên giao diện hiển thị theo tham số hệ thống hiện hành', 'Trung bình',
    '1. So sánh nội dung gợi ý ở form Thêm người dùng / Đổi mật khẩu với system/parameters', 'Độ dài và loại ký tự hiển thị đúng giá trị tham số (không cố định trong mã nguồn)', 'Manual', MAN('đối chiếu giao diện với tham số'));
  U('P', 'KT 1.3.1c-3', 'Mật khẩu', 'Không cho đổi mật khẩu mới khi chưa đủ số ngày tối thiểu kể từ lần đổi trước', 'Cao',
    '1. Đặt tham số số ngày tối thiểu = 1\n2. Đổi mật khẩu thành công\n3. Đổi tiếp ngay trong ngày', 'Lần 2 bị từ chối với thông báo còn bao nhiêu ngày mới được đổi', 'Manual', MAN(PARAM));
  U('P', 'KT 1.3.1c-4', 'Mật khẩu', 'Mật khẩu hết hạn: đăng nhập bị khóa và chuyển màn Đổi mật khẩu bắt buộc; thoát/quay lại vẫn phải đổi', 'Cao',
    '1. Đặt lastPasswordChangeDate của người dùng QCA quá PASSWORD_EXPIRY_DAYS (hoặc đặt tham số = 1 ngày và chờ)\n2. Đăng nhập\n3. Thử thoát/quay lại', 'Không vào được hệ thống; luôn bị yêu cầu đổi mật khẩu; isPasswordExpired = true', 'Manual', MAN(PARAM + '; ' + CAPTCHA));
  U('P', 'KT 1.3.1c-4', 'Mật khẩu', 'Đổi mật khẩu thành công khi hết hạn thì mở lại tài khoản và đăng nhập bình thường', 'Cao',
    '1. Từ trạng thái hết hạn, đổi mật khẩu hợp lệ\n2. Đăng nhập lại', 'Đăng nhập được; isPasswordExpired = false; lastPasswordChangeDate cập nhật', 'Manual', MAN(CAPTCHA));
  U('P', 'KT 1.3.1c-4', 'Mật khẩu', 'Cảnh báo trước khi mật khẩu hết hạn theo PASSWORD_CHANGE_WARNING_DAYS', 'Trung bình',
    '1. Người dùng còn ≤ 7 ngày đến hạn mật khẩu đăng nhập', 'Hiện cảnh báo số ngày còn lại kèm liên kết đổi mật khẩu', 'Manual', MAN(PARAM));
  U('K', 'KT 1.3.1d', 'Đăng nhập sai', 'Màn đăng nhập cảnh báo số lần còn lại khi nhập sai mật khẩu', 'Cao',
    '1. Đăng nhập tài khoản QCA với mật khẩu sai 1 lần', 'Thông báo sai mật khẩu kèm "còn N lần" (N = MAX_LOGIN_FAIL_COUNT − 1)', 'Manual', MAN(CAPTCHA));
  U('K', 'KT 1.3.1d', 'Đăng nhập sai', 'Sai vượt ngưỡng trong khung thời gian → khóa tạm theo LOGIN_LOCK_DURATION_MINUTES; mật khẩu đúng trong thời gian khóa vẫn bị chặn', 'Cao',
    '1. Nhập sai mật khẩu MAX_LOGIN_FAIL_COUNT lần liên tiếp\n2. Nhập đúng mật khẩu ngay sau đó', 'Bước 1: thông báo tài khoản bị khóa tạm X phút; bước 2: vẫn bị từ chối', 'Manual', MAN(CAPTCHA + '; dùng tài khoản QCA dùng một lần'));
  U('K', 'KT 1.3.1d', 'Đăng nhập sai', 'Hết thời gian khóa tạm thì đăng nhập lại được; lần sai rải rác ngoài khung thời gian không cộng dồn', 'Trung bình',
    '1. Chờ hết thời gian khóa, đăng nhập đúng\n2. Sai 1 lần, chờ quá khung thời gian, sai tiếp', 'Bước 1 đăng nhập được; bước 2 không bị khóa', 'Manual', MAN(WAIT + '; ' + CAPTCHA));
  U('K', 'KT 1.3.1d', 'Đăng nhập sai', 'Vi phạm chính sách thì ngăn đăng nhập tự động: bắt buộc captcha mới mỗi lần, captcha dùng một lần', 'Cao',
    '1. Sau khi bị khóa/vi phạm, thử gửi lại request đăng nhập cũ (cùng captchaId, captchaCode)', 'Bị từ chối do captcha đã dùng/hết hạn; không thể vét cạn mật khẩu bằng script', 'Manual', MAN(CAPTCHA + '; liên quan LGN-C07, LGN-M14'));
  U('K', 'KT 1.3.1d', 'Đăng nhập sai', 'Khóa theo từng tài khoản: sai với tài khoản A không ảnh hưởng tài khoản B cùng máy/IP', 'Trung bình',
    '1. Làm khóa tài khoản A\n2. Đăng nhập tài khoản B đúng mật khẩu', 'B đăng nhập bình thường', 'Manual', MAN(CAPTCHA));
  U('K', 'KT 1.3.1d', 'Đăng nhập sai', 'Màn Người dùng hiển thị trạng thái bị khóa do đăng nhập sai và QTV mở khóa được ngay', 'Cao',
    '1. Làm khóa tài khoản QCA do đăng nhập sai\n2. QTV mở màn Người dùng, lọc trạng thái, bấm Mở khóa\n3. Đăng nhập lại', 'Hiển thị trạng thái bị khóa (isLockedOut); mở khóa xong đăng nhập được ngay', 'Manual', MAN(CAPTCHA));
  U('T', 'KT 1.3.2b', 'Thời gian chờ phiên', 'Không thao tác quá SESSION_TIMEOUT_MINUTES: thông báo "Phiên làm việc đã hết hạn" và về trang đăng nhập', 'Cao',
    '1. Đăng nhập, để yên quá thời gian chờ\n2. Bấm thao tác bất kỳ', 'Hiện thông báo hết phiên; về trang đăng nhập; dữ liệu phiên bị xóa', 'Manual', MAN(WAIT));
  U('T', 'KT 1.3.2b', 'Thời gian chờ phiên', 'BE kiểm tra thời điểm hoạt động cuối: token JWT còn hạn nhưng quá thời gian chờ vẫn bị từ chối 401', 'Cao',
    '1. Đăng nhập, lấy token\n2. Không gọi API quá thời gian chờ\n3. Gọi API bằng token đó', 'HTTP 401 dù token chưa hết hạn exp', 'Manual', MAN(WAIT));
  U('T', 'KT 1.3.2b', 'Thời gian chờ phiên', 'Có thao tác trong thời gian chờ thì phiên được gia hạn, không bị đăng xuất khi đang làm việc', 'Trung bình',
    '1. Thao tác đều đặn mỗi 10 phút trong 1 giờ', 'Không bị đăng xuất', 'Manual', MAN(WAIT));
  U('T', 'KT 1.3.2b', 'Thời gian chờ phiên', 'Cảnh báo trước khi hết phiên (SESSION_WARN_BEFORE_EXPIRY) cho phép tiếp tục phiên', 'Thấp',
    '1. Để yên đến gần hết thời gian chờ', 'Hiện cảnh báo sắp hết phiên; bấm Tiếp tục thì phiên được gia hạn', 'Manual', MAN(WAIT));
  U('H', 'KT 1.3.2a', 'Kết nối an toàn', '[API] Trang đăng nhập và API xác thực qua HTTP được chuyển hướng 301/308 sang HTTPS', 'Cao',
    '1. Gọi http://<máy chủ>/ và http://<máy chủ>/api/v1/authentication/captcha (không theo chuyển hướng)', 'HTTP 301/308, Location bắt đầu https://');
  U('H', 'KT 1.3.2a', 'Kết nối an toàn', '[API] Máy chủ bật HSTS (Strict-Transport-Security, max-age ≥ 1 năm)', 'Cao',
    '1. GET https://<máy chủ>/ và một API, đọc header', 'Có Strict-Transport-Security với max-age ≥ 31536000', 'Auto', 'Khảo sát 28/10: không có header HSTS');
  U('H', 'KT 1.3.2a', 'Kết nối an toàn', 'Máy chủ từ chối TLS 1.0/1.1, chấp nhận TLS ≥ 1.2', 'Cao',
    '1. Bắt tay TLS với maxVersion = TLSv1.1\n2. Bắt tay TLS với minVersion = TLSv1.2', 'Bước 1 thất bại; bước 2 thành công');
  U('N', 'KT 1.3.3a-2', 'Nhật ký', 'Đăng nhập thành công và đăng xuất được ghi nhật ký loại "Đăng nhập", Kết quả = Thành công, có IP', 'Cao',
    '1. Đăng nhập rồi đăng xuất\n2. QTV tra nhật ký loại Đăng nhập', 'Có 2 bản ghi Đăng nhập / Đăng xuất của đúng tài khoản, Kết quả Thành công, IP thật', 'Manual', MAN(CAPTCHA));
  U('N', 'KT 1.3.3a-2', 'Nhật ký', '[API] Đăng nhập thất bại (sai captcha/sai mật khẩu) được ghi nhật ký loại "Đăng nhập", Kết quả = Thất bại', 'Cao',
    '1. Ghi nhận T0\n2. POST jwt/login với tên đăng nhập "qca.attt.fail" và captcha sai\n3. QTV tra nhật ký từ T0', 'Có bản ghi đăng nhập thất bại của "qca.attt.fail" kèm lý do (sai captcha), Kết quả = Thất bại, IP');
  U('N', 'KT 1.3.3a-2', 'Nhật ký', 'Bị khóa do sai nhiều lần và hết phiên được ghi nhật ký loại "Đăng nhập"', 'Cao',
    '1. Làm khóa tài khoản QCA\n2. Để 1 phiên hết thời gian chờ\n3. Tra nhật ký', 'Có bản ghi "Bị khóa" và "Hết phiên"', 'Manual', MAN(CAPTCHA + '; ' + WAIT));
  U('N', 'NK-08', 'Nhật ký', '[API] Nhật ký đăng nhập không chứa mật khẩu đã nhập (kể cả khi đăng nhập sai)', 'Cao',
    '1. POST jwt/login với mật khẩu dễ nhận biết "Qca!LogPw123" và captcha sai\n2. Tra toàn bộ nội dung bản ghi nhật ký từ T0', 'Không bản ghi nào chứa "Qca!LogPw123"');
  U('N', 'NK-08; KT 1.3.3a-2', 'Nhật ký', 'Quên mật khẩu/đặt lại/đổi mật khẩu được ghi nhật ký nhưng không ghi OTP, mật khẩu mới', 'Trung bình',
    '1. Thực hiện quên mật khẩu → OTP → đặt lại; đổi mật khẩu ở Thông tin cá nhân\n2. Tra nhật ký', 'Có bản ghi cho từng thao tác; không chứa OTP, mật khẩu cũ/mới', 'Manual', MAN('cần hộp thư nhận OTP (Mailosaur) và tra nhật ký sau đó'));

  // ============================== ATTT CHUNG — HỒ SƠ & HẠ TẦNG ==============================
  const G = mk(t, 'ATG');
  const doc = (yc, title, steps, exp, pri = 'Cao') => G('R', yc, 'Hồ sơ quản lý', title, pri, steps, exp, 'Manual', MAN(DOC), 'Hồ sơ');
  const inf = (yc, title, steps, exp, pri = 'Cao') => G('R', yc, 'Hạ tầng', title, pri, steps, exp, 'Manual', MAN(INFRA), 'Bảo mật');
  // A. Yêu cầu quản lý
  doc('QL 1.1.1', 'Quy chế bảo đảm ATTT có đủ 4 nội dung: an toàn mạng, máy chủ & ứng dụng, dữ liệu, người sử dụng đầu cuối', '1. Thu thập Quy chế bảo đảm ATTT hệ thống CĐS (HS 2)\n2. Đối chiếu mục lục', 'Có đủ 4 nội dung quản lý an toàn');
  doc('QL 1.1.2', 'Quy chế được chủ quản hệ thống phê duyệt trước khi công bố áp dụng', '1. Kiểm tra Quyết định ban hành Quy chế', 'Có quyết định ban hành do chủ quản ký, ngày ban hành trước ngày áp dụng');
  doc('QL 1.1.3', 'Quy chế ghi chu kỳ rà soát 03 năm hoặc khi có thay đổi', '1. Tìm điều khoản rà soát trong Quy chế', 'Có quy định rà soát, cập nhật định kỳ 03 năm hoặc khi thay đổi');
  doc('QL 1.2.1', 'Có đơn vị chuyên trách ATTT của chủ quản và đầu mối kỹ thuật phía đơn vị vận hành', '1. Kiểm tra hồ sơ phân công', 'Có văn bản nêu rõ đơn vị chuyên trách và đầu mối');
  doc('QL 1.2.2', 'Có danh sách đầu mối phối hợp với cơ quan có thẩm quyền và điều phối xử lý sự cố', '1. Kiểm tra danh sách đầu mối', 'Danh sách có họ tên, chức vụ, SĐT, email; có cam kết tham gia khi có yêu cầu');
  doc('QL 1.3.1', 'Cán bộ vị trí ATTT có trình độ, chuyên ngành phù hợp', '1. Kiểm tra hồ sơ tuyển dụng/phân công cán bộ ATTT', 'Trình độ, chuyên ngành phù hợp vị trí', 'Trung bình');
  doc('QL 1.3.2', 'Có quy định thực hiện nội quy ATTT và kế hoạch tuyên truyền nâng cao nhận thức hằng năm', '1. Kiểm tra quy định và kế hoạch tuyên truyền năm hiện hành', 'Có quy định áp dụng cho người dùng, cán bộ quản lý, vận hành; có kế hoạch hằng năm', 'Trung bình');
  doc('QL 1.3.3', 'Có quy trình thu hồi tài sản và vô hiệu hóa quyền truy cập khi cán bộ thôi việc/chuyển công tác', '1. Kiểm tra quy trình\n2. Đối chiếu với chức năng khóa/gỡ quyền ở ATA-U*', 'Quy trình có bước khóa tài khoản phần mềm, gỡ nhóm quyền, thu hồi thiết bị');
  doc('QL 1.4.1', 'Có tài liệu quy mô, phạm vi, thiết kế, thành phần HTTT và phương án ATTT theo cấp độ', '1. Kiểm tra tài liệu kiến trúc (FE React – BE ASP.NET Core – PostgreSQL), mô hình logic/vật lý, danh mục ứng dụng/dịch vụ, phương án ATTT', 'Đủ 5 nội dung a–đ; có đánh giá lại khi thay đổi thiết kế');
  doc('QL 1.4.2', 'Có hợp đồng/cam kết với bên phát triển và bộ mã nguồn bàn giao', '1. Kiểm tra hợp đồng, cam kết\n2. Kiểm tra bộ mã nguồn bàn giao (đã loại bỏ secret)', 'Có cam kết; mã nguồn bàn giao đầy đủ, không chứa secret');
  doc('QL 1.4.3', 'Có kế hoạch, quy trình kiểm thử – nghiệm thu, bộ testcase ATTT và bộ phận chịu trách nhiệm', '1. Kiểm tra kế hoạch test, bộ testcase (gồm bộ ATA/ATB/ATC/ATE/ATU/ATG này), biên bản nghiệm thu', 'Có đủ; kết quả kiểm thử ATTT được lưu trước khi vận hành');
  doc('QL 1.5.1', 'Có quy trình quản lý an toàn mạng: vận hành, cập nhật, sao lưu cấu hình, khôi phục, truy cập cấu hình', '1. Kiểm tra quy trình', 'Có đủ nội dung a–c');
  doc('QL 1.5.2', 'Có quy trình quản lý an toàn máy chủ và ứng dụng, gồm cập nhật phiên bản (deploy/rollback) và khôi phục ứng dụng', '1. Kiểm tra quy trình deploy/rollback, khôi phục', 'Có đủ nội dung a–d');
  doc('QL 1.5.3', 'Có quy trình sao lưu – khôi phục dữ liệu (tần suất, nơi lưu, người thực hiện) và biên bản thử khôi phục', '1. Kiểm tra quy trình và biên bản thử khôi phục', 'Có quy trình; có biên bản thử khôi phục định kỳ');
  doc('QL 1.5.4', 'Có phương án, kế hoạch, quy trình ứng cứu sự cố ATTT (thông thường và nghiêm trọng) và cơ chế phối hợp', '1. Kiểm tra hồ sơ quản lý sự cố', 'Đủ nội dung a–g');
  doc('QL 1.5.5', 'Có quy định quản lý truy cập tài nguyên nội bộ và Internet cho người sử dụng đầu cuối', '1. Kiểm tra quy định', 'Có đủ nội dung a–b', 'Trung bình');
  doc('QL 1.6', 'Có Phương án quản lý rủi ro ATTT (tài sản – mối đe dọa – điểm yếu – mức rủi ro – biện pháp) và rà soát định kỳ', '1. Kiểm tra phương án', 'Có đủ các thành phần; có kế hoạch rà soát');
  doc('QL 1.7', 'Có Phương án kết thúc vận hành, thanh lý, hủy bỏ hệ thống', '1. Kiểm tra phương án', 'Có nội dung xuất/lưu dữ liệu, thu hồi tài khoản, xóa sạch dữ liệu và bản sao lưu, hủy khóa mã hóa, chứng thư', 'Trung bình');
  // B. Thiết kế hệ thống
  inf('TK a', 'Phân vùng mạng: web/reverse proxy ở DMZ; API và PostgreSQL ở vùng máy chủ nội bộ; DB không public', '1. Kiểm tra sơ đồ logic/vật lý, quy hoạch IP\n2. Từ Internet thử kết nối cổng PostgreSQL (khi được phép)', 'Đủ các vùng mạng tối thiểu; DB không truy cập được từ Internet');
  inf('TK b.i', 'Quản trị máy chủ/ứng dụng từ xa qua VPN; không mở SSH/RDP/DB ra Internet', '1. Kiểm tra cấu hình VPN\n2. Kiểm tra các cổng quản trị từ Internet (khi được phép)', 'Chỉ quản trị qua VPN; cổng quản trị đóng với Internet');
  inf('TK b.ii', 'Có tường lửa tích hợp phòng chống xâm nhập kiểm soát truy cập giữa các vùng mạng', '1. Kiểm tra thiết bị/giải pháp và chính sách giữa các vùng', 'Có sản phẩm tường lửa + IPS hoặc tương đương');
  inf('TK b.iii', 'Có phương án phòng chống mã độc cho máy chủ và máy trạm', '1. Kiểm tra sản phẩm/giải pháp phòng chống mã độc', 'Có giải pháp đang hoạt động');
  G('W', 'TK b.iv', 'Hạ tầng', 'Có phương án chống tấn công ứng dụng web; có WAF nếu CĐS thuộc hệ thống tại khoản 2 Điều 8 NĐ 85/2016', 'Cao', '1. Xác nhận loại hệ thống trong thuyết minh\n2. Kiểm tra WAF/phương án tương đương\n3. Gửi request chứa mẫu tấn công phổ biến (khi được phép)', 'Có phương án; request tấn công bị chặn/ghi nhận', 'Manual', MAN(INFRA + '; cần xác nhận loại hệ thống'));
  inf('TK b.v', 'Thư điện tử: CĐS không phải hệ thống thư (Không áp dụng); chức năng gửi mail dùng SMTP có TLS, tài khoản SMTP riêng', '1. Kiểm tra cấu hình SMTP của ứng dụng', 'SMTP dùng TLS (465/587 STARTTLS); tài khoản SMTP riêng cho CĐS', 'Trung bình');
  inf('TK b.vi', 'Có phương án dự phòng thiết bị chuyển mạch trung tâm và tường lửa trung tâm', '1. Kiểm tra sơ đồ dự phòng', 'Có thiết bị/đường dự phòng', 'Trung bình');
  // C.1 An toàn mạng
  G('H', 'KT 1.1.1a', 'Hạ tầng', '[API] Truy cập ứng dụng từ Internet chỉ qua kết nối an toàn: HTTP chuyển hướng sang HTTPS', 'Cao', '1. Gọi http://<máy chủ>/ không theo chuyển hướng', 'HTTP 301/308 sang https://');
  inf('KT 1.1.1b', 'Tường lửa chỉ mở 443 (80 chỉ để chuyển hướng) cho CĐS; chặn các cổng khác', '1. Kiểm tra chính sách tường lửa\n2. Quét cổng địa chỉ public (khi có văn bản cho phép)', 'Chỉ 80/443 mở');
  inf('KT 1.1.1c', 'Thiết bị mạng/proxy có thời gian chờ đóng phiên kết nối không hoạt động', '1. Kiểm tra cấu hình timeout (keepalive_timeout, client_body_timeout của nginx; timeout phiên firewall)', 'Có giá trị timeout hợp lý', 'Trung bình');
  inf('KT 1.1.2', 'Máy chủ CĐS chỉ được kết nối ra ngoài tới đích cần thiết (SMTP, NTP, kho cập nhật…)', '1. Kiểm tra chính sách outbound', 'Mặc định chặn; chỉ mở các đích cần thiết', 'Trung bình');
  inf('KT 1.1.3a', 'Thiết bị hệ thống có ghi và lưu trữ nhật ký', '1. Kiểm tra cấu hình log của firewall, switch, proxy', 'Có ghi log và lưu trữ');
  inf('KT 1.1.3b', 'Thiết bị mạng, máy chủ đồng bộ thời gian với máy chủ thời gian (NTP)', '1. Kiểm tra cấu hình NTP và độ lệch', 'Có NTP; lệch < 1 giây');
  inf('KT 1.1.4a', 'Có phương án phòng chống xâm nhập bảo vệ vùng DMZ và vùng máy chủ nội bộ', '1. Kiểm tra IPS/IDS cho 2 vùng', 'Có giải pháp đang hoạt động');
  inf('KT 1.1.4b', 'Cơ sở dữ liệu dấu hiệu tấn công (signature) được cập nhật định kỳ', '1. Kiểm tra ngày cập nhật signature gần nhất', 'Cập nhật trong chu kỳ quy định', 'Trung bình');
  inf('KT 1.1.5a', 'Thiết bị hệ thống bật xác thực khi quản trị trực tiếp/từ xa', '1. Kiểm tra cấu hình xác thực thiết bị', 'Có xác thực; không dùng mật khẩu mặc định');
  inf('KT 1.1.5b', 'Quản trị thiết bị từ xa chỉ qua kết nối an toàn (SSH/HTTPS), tắt Telnet/HTTP', '1. Kiểm tra giao thức quản trị', 'Chỉ giao thức an toàn');
  inf('KT 1.1.5c', 'Giới hạn địa chỉ được phép quản trị thiết bị từ xa', '1. Kiểm tra ACL quản trị thiết bị', 'Chỉ dải IP quản trị được phép', 'Trung bình');
  // C.2 An toàn máy chủ
  inf('KT 1.2.1a', 'Máy chủ có chính sách xác thực khi truy cập, quản lý, sử dụng', '1. Kiểm tra cấu hình xác thực SSH/OS', 'Có xác thực; ưu tiên khóa SSH, tắt đăng nhập root trực tiếp');
  G('U', 'KT 1.2.1b', 'Hạ tầng', 'Tài khoản mặc định của hệ điều hành, PostgreSQL, web server đã đổi mật khẩu hoặc vô hiệu hóa', 'Cao', '1. Kiểm tra tài khoản postgres, root, tài khoản mặc định web server', 'Không còn mật khẩu mặc định; tài khoản không dùng bị vô hiệu hóa', 'Manual', MAN(INFRA));
  inf('KT 1.2.1c', 'Cấu hình máy chủ bảo đảm an toàn mật khẩu (độ phức tạp, thời hạn đổi) cho tài khoản hệ điều hành', '1. Kiểm tra PAM/chính sách mật khẩu OS', 'Có quy tắc độ dài, loại ký tự, thời hạn');
  inf('KT 1.2.2a', 'Quản trị máy chủ từ xa chỉ qua kết nối an toàn', '1. Kiểm tra dịch vụ quản trị đang mở', 'Chỉ SSH (qua VPN); không Telnet/FTP');
  inf('KT 1.2.2b', 'Máy chủ có timeout đóng phiên quản trị không hoạt động', '1. Kiểm tra ClientAliveInterval / TMOUT', 'Có giá trị timeout', 'Trung bình');
  inf('KT 1.2.3a', 'Máy chủ ghi nhật ký: kết nối mạng, đăng nhập, lỗi, thay đổi cấu hình, truy cập dữ liệu quan trọng', '1. Kiểm tra auth.log, syslog, log firewall, log PostgreSQL', 'Có đủ 5 loại thông tin');
  inf('KT 1.2.3b', 'Máy chủ đồng bộ thời gian với máy chủ thời gian', '1. Kiểm tra timedatectl / chrony', 'Đồng bộ NTP đang bật');
  inf('KT 1.2.3c', 'Nhật ký máy chủ lưu tối thiểu 01 tháng', '1. Kiểm tra logrotate/nơi lưu log', 'Lưu ≥ 30 ngày');
  inf('KT 1.2.4a', 'Loại bỏ tài khoản không dùng/không hợp lệ trên máy chủ', '1. Rà soát /etc/passwd, tài khoản DB', 'Không còn tài khoản thừa', 'Trung bình');
  inf('KT 1.2.4b', 'Bật tường lửa hệ điều hành chặn truy cập trái phép', '1. Kiểm tra ufw/iptables', 'Tường lửa bật, chỉ mở cổng cần thiết');
  G('H', 'KT 1.2.4c', 'Hạ tầng', 'Máy chủ web tắt giao thức không an toàn: từ chối bắt tay TLS 1.0/1.1', 'Cao', '1. Bắt tay TLS tới máy chủ với maxVersion = TLSv1.1', 'Bắt tay thất bại');
  inf('KT 1.2.4c', 'Vô hiệu hóa dịch vụ hệ thống không sử dụng trên máy chủ', '1. Liệt kê dịch vụ đang chạy/cổng đang nghe', 'Không có dịch vụ thừa', 'Trung bình');
  inf('KT 1.2.4d', 'Có phương án cập nhật bản vá hệ điều hành và dịch vụ (nginx, PostgreSQL, .NET runtime)', '1. Kiểm tra phương án và phiên bản hiện tại', 'Có phương án; phiên bản còn được hỗ trợ, không có lỗ hổng nghiêm trọng đã biết');
  inf('KT 1.2.5a', 'Máy chủ có phần mềm phòng chống mã độc (hoặc tương đương) tự động cập nhật', '1. Kiểm tra phần mềm và cấu hình cập nhật', 'Có và đang tự động cập nhật');
  inf('KT 1.2.5b', 'Có phương án dò quét mã độc cho phần mềm trước khi cài đặt', '1. Kiểm tra quy trình', 'Có quy trình quét trước khi cài', 'Trung bình');
  inf('KT 1.2.6', 'Có phương án xóa sạch dữ liệu máy chủ khi chuyển giao/đổi mục đích', '1. Kiểm tra phương án', 'Có phương án xóa an toàn', 'Trung bình');
  // UD 742-4.4 — bí mật trong mã nguồn
  G('S', 'UD 742-4.4', 'Bí mật trong mã nguồn', '[API] Mã JavaScript phát hành cho trình duyệt không chứa khóa bí mật, chuỗi kết nối, mật khẩu', 'Cao',
    '1. Tải trang chủ và các tệp /assets/*.js\n2. Quét chuỗi: connection string (Host=…;Password=), "BEGIN PRIVATE KEY", AWS key (AKIA…), "client_secret", "smtp" kèm mật khẩu', 'Không phát hiện bí mật');
  G('S', 'UD 742-4.4', 'Bí mật trong mã nguồn', '[API] Không lộ tệp cấu hình/mã nguồn qua web: /.env, /.git/config, /appsettings.json, source map', 'Cao',
    '1. GET lần lượt các đường dẫn trên', 'Không trả nội dung tệp thật (chỉ 404 hoặc trang SPA mặc định); không có nội dung chứa khóa/chuỗi kết nối');
  G('S', 'UD 742-4.4', 'Bí mật trong mã nguồn', 'Kho mã nguồn không chứa secret (quét gitleaks); secret đặt ở biến môi trường/secret store', 'Cao',
    '1. Chạy gitleaks trên toàn bộ lịch sử repo BE/FE\n2. Kiểm tra appsettings.*.json đã commit', 'Không phát hiện secret; connection string, JWT secret, mật khẩu SMTP, API key lấy từ biến môi trường', 'Manual', MAN('cần quyền truy cập repo mã nguồn của đội Dev'));
  // D. Phần mềm nội bộ
  doc('PM 1', 'Quy trình phát triển tuân thủ Khung phát triển phần mềm an toàn (CV 166/CATTT-ATHTTT): review code, quản lý thư viện bên thứ ba, kiểm thử bảo mật', '1. Kiểm tra minh chứng review code, danh mục thư viện & kết quả quét phụ thuộc (npm audit / dotnet list package --vulnerable)', 'Có minh chứng cho từng hoạt động');
  doc('PM 2a', 'Có tài liệu Hướng dẫn triển khai và thiết lập cấu hình', '1. Kiểm tra tài liệu', 'Có tài liệu, khớp phiên bản triển khai', 'Trung bình');
  doc('PM 2b', 'Có tài liệu Hướng dẫn sử dụng và quản trị', '1. Kiểm tra tài liệu', 'Có tài liệu, gồm phần quản trị tham số, nhật ký, sao lưu', 'Trung bình');
  doc('PM 2c', 'Có Tài liệu thiết kế', '1. Kiểm tra tài liệu', 'Có tài liệu thiết kế cập nhật', 'Trung bình');
  doc('PM 2d', 'Có Mã nguồn sản phẩm (theo yêu cầu bên đề nghị đánh giá)', '1. Kiểm tra bộ mã nguồn bàn giao', 'Đầy đủ, build được', 'Trung bình');
  G('W', 'PM 3', 'Lỗ hổng web', '[API] Máy chủ trả các header bảo mật: X-Content-Type-Options, X-Frame-Options/CSP frame-ancestors, Content-Security-Policy', 'Trung bình',
    '1. GET trang chủ và 1 API, đọc header', 'Có X-Content-Type-Options: nosniff; có X-Frame-Options hoặc CSP frame-ancestors (chống clickjacking)', 'Auto', 'Khảo sát 28/10: không có header bảo mật nào');
  G('W', 'PM 3', 'Lỗ hổng web', '[API] Header phản hồi không lộ phiên bản máy chủ (Server, X-Powered-By)', 'Thấp',
    '1. Đọc header Server, X-Powered-By của trang chủ và API', 'Không có số phiên bản (VD "nginx/1.18.0 (Ubuntu)")', 'Auto', 'Khảo sát 28/10: Server: nginx/1.18.0 (Ubuntu)');
  G('W', 'PM 3', 'Lỗ hổng web', '[API] CORS không cho phép nguồn tùy ý gọi API có xác thực', 'Trung bình',
    '1. Gọi API kèm header Origin: https://evil.example', 'Access-Control-Allow-Origin không phải "*" và không phản chiếu nguồn lạ', 'Auto', 'Khảo sát 28/10: Access-Control-Allow-Origin: *');
  G('W', 'PM 3', 'Lỗ hổng web', '[API] Tài liệu API (Swagger) không công khai trên môi trường chính thức', 'Trung bình',
    '1. GET /swagger/index.html, /swagger/v1/swagger.json', 'HTTP 401/403/404 trên môi trường chính thức', 'Auto', 'Khảo sát 28/10: /swagger/index.html trả 200 công khai');
  G('W', 'PM 3', 'Lỗ hổng web', 'Tự rà soát OWASP Top 10 (SQLi, XSS, CSRF, IDOR, upload) bằng SAST/DAST, xử lý hết trước khi gửi đơn vị đánh giá', 'Cao',
    '1. Chạy SAST (SonarQube/Semgrep) và DAST (OWASP ZAP) trên môi trường test\n2. Lập danh sách và xử lý lỗ hổng', 'Không còn lỗ hổng mức Cao/Nghiêm trọng; có báo cáo trước/sau xử lý', 'Manual', MAN('chạy công cụ quét chuyên dụng, cần văn bản cho phép'));
  doc('PM 3', 'Có kết quả đánh giá lỗ hổng của tổ chức chuyên môn được cấp phép trước nghiệm thu', '1. Kiểm tra báo cáo đánh giá và biên bản xác nhận', 'Báo cáo xác nhận không còn lỗ hổng/điểm yếu');
  // E. Hồ sơ cấp độ
  doc('HS 1', 'Thuyết minh Hồ sơ đề xuất cấp độ đủ: tổng quan HTTT, đề xuất cấp độ, phương án bảo đảm ATTT (lấy từ mục A–D sheet)', '1. Kiểm tra hồ sơ', 'Đủ các phần a–c theo Điều 8 TT 12/2022');
  doc('HS 2', 'Quy chế bảo đảm ATTT được phê duyệt trước khi Hồ sơ đề xuất cấp độ được phê duyệt', '1. So sánh ngày phê duyệt Quy chế và Hồ sơ', 'Quy chế phê duyệt trước');
  doc('HS 3', 'Hồ sơ đề xuất cấp độ được phê duyệt trước Báo cáo KT-KT/Thiết kế cơ sở/Kế hoạch thuê dịch vụ', '1. So sánh ngày phê duyệt', 'Đúng thứ tự khuyến khích', 'Thấp');
  doc('HS 4', 'Mọi yêu cầu A–D ở trạng thái Hoàn thành/Không áp dụng trước go-live (bộ testcase ATTT Pass hoặc có lý do Không áp dụng)', '1. Tổng hợp kết quả chạy toàn bộ testcase ATA/ATB/ATC/ATE/ATU/ATG', 'Không còn testcase ATTT Fail chưa có phương án xử lý');
  doc('HS 5', 'Có kế hoạch kiểm tra, đánh giá ATTT định kỳ/đột xuất (dò quét, thử nghiệm xâm nhập, đánh giá mã nguồn) và phương án xử lý nội dung chưa đạt', '1. Kiểm tra kế hoạch và báo cáo kỳ gần nhất', 'Có kế hoạch, báo cáo và phương án xử lý', 'Trung bình');
  doc('HS 6', 'Thực hiện báo cáo ATTT định kỳ hằng năm đúng mốc (15/12–14/12; gửi chủ quản trước 20/12, cơ quan quản lý trước 25/12)', '1. Kiểm tra báo cáo năm gần nhất', 'Báo cáo đúng nội dung Điều 14 và đúng hạn', 'Trung bình');
}
