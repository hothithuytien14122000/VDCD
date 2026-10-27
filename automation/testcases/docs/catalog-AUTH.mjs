// Testcase PHÂN HỆ XÁC THỰC — Đăng nhập (LGN) và Quên/Đặt lại mật khẩu (RPW).
// Nguồn: khảo sát UI/API thực tế trên môi trường test (chưa có UC trong UC_1409 → mã UC dạng AUTH.<n>-UC<m>).
//   AUTH.1  Đăng nhập        UC1 Form & validate · UC2 Xác thực tài khoản · UC3 Captcha · UC4 Đổi mật khẩu lần đầu · UC5 Phiên/Đăng xuất
//   AUTH.2  Quên mật khẩu    UC1 Yêu cầu OTP qua email · UC2 Xác thực OTP · UC3 Đặt mật khẩu mới
// Hành vi đã khảo sát: đăng nhập luôn kiểm captcha TRƯỚC mọi kiểm tra khác → case cần đăng nhập thật phải có captcha đúng → Manual.
// OTP quên mật khẩu: 6 chữ số, hiệu lực 1 phút, gửi qua email (script đọc bằng Mailosaur, user qc.resetpw).
export default function defineAuth(t) {
  const c = (id, uc, fn, title, type, pri, steps, exp, note = '') => t(id, uc, fn, title, type, pri, steps, exp, 'Auto', note);
  const CAP = 'Manual — cần nhập captcha thật (ảnh captcha, không tự động hóa được)';
  const m = (id, uc, fn, title, type, pri, steps, exp, note = '') => t(id, uc, fn, title, type, pri, steps, exp, CAP, note);
  const BA = 'Cần BA xác nhận quy tắc';

  // ===================== AUTH.1 ĐĂNG NHẬP =====================
  // --- UC1 Form & validate ---
  c('LGN-L01', 'AUTH.1-UC1', 'Form đăng nhập', 'Trang đăng nhập hiển thị đủ các thành phần', 'Chức năng', 'Cao',
    '1. Chưa đăng nhập, mở trang /#/vi/auth/login',
    'Có ô Tên đăng nhập, ô Mật khẩu, ô Mã xác nhận kèm ảnh captcha và nút Đổi mã, checkbox Ghi nhớ đăng nhập, nút Đăng nhập, liên kết Quên mật khẩu?');
  c('LGN-L02', 'AUTH.1-UC1', 'Form đăng nhập', 'Mật khẩu mặc định ẩn, bấm biểu tượng mắt để hiện/ẩn', 'UI', 'Thấp',
    '1. Nhập mật khẩu\n2. Bấm biểu tượng con mắt\n3. Bấm lần nữa', 'Mặc định ô là type=password; bấm mắt hiện rõ (text); bấm lại thì ẩn');
  c('LGN-L03', 'AUTH.1-UC1', 'Validate', 'Bỏ trống cả ba ô thì báo lỗi bắt buộc ở từng ô và không gọi API', 'Validate', 'Cao',
    '1. Để trống Tên đăng nhập, Mật khẩu, Mã xác nhận\n2. Bấm Đăng nhập',
    'Báo "Vui lòng nhập tên đăng nhập!", "Vui lòng nhập mật khẩu!", "Vui lòng nhập mã xác nhận!"; không có request jwt/login');
  c('LGN-L04', 'AUTH.1-UC1', 'Validate', 'Chỉ thiếu Tên đăng nhập thì báo lỗi đúng ô đó', 'Validate', 'Cao',
    '1. Nhập mật khẩu, mã xác nhận; bỏ trống tên đăng nhập\n2. Bấm Đăng nhập', 'Chỉ báo "Vui lòng nhập tên đăng nhập!"; không gọi API');
  c('LGN-L05', 'AUTH.1-UC1', 'Validate', 'Chỉ thiếu Mật khẩu thì báo lỗi đúng ô đó', 'Validate', 'Cao',
    '1. Nhập tên đăng nhập, mã xác nhận; bỏ trống mật khẩu\n2. Bấm Đăng nhập', 'Chỉ báo "Vui lòng nhập mật khẩu!"; không gọi API');
  c('LGN-L06', 'AUTH.1-UC1', 'Validate', 'Chỉ thiếu Mã xác nhận thì báo lỗi đúng ô đó', 'Validate', 'Cao',
    '1. Nhập tên đăng nhập, mật khẩu; bỏ trống mã xác nhận\n2. Bấm Đăng nhập', 'Chỉ báo "Vui lòng nhập mã xác nhận!"; không gọi API');
  c('LGN-L07', 'AUTH.1-UC1', 'Form đăng nhập', 'Nhấn Enter ở ô Mã xác nhận gửi form đăng nhập', 'Chức năng', 'Thấp',
    '1. Nhập đủ 3 ô\n2. Nhấn Enter', 'Form được gửi (có request jwt/login)');
  c('LGN-L08', 'AUTH.1-UC1', 'Form đăng nhập', 'Liên kết "Quên mật khẩu?" chuyển sang màn Quên mật khẩu', 'Chức năng', 'Trung bình',
    '1. Bấm "Quên mật khẩu?"', 'Hiển thị màn "Quên mật khẩu" có ô Email đăng ký và nút Lấy mã OTP');
  // --- UC3 Captcha ---
  c('LGN-C01', 'AUTH.1-UC3', 'Captcha', 'Nhập sai mã captcha thì báo lỗi và ở lại trang đăng nhập', 'Validate', 'Cao',
    '1. Nhập tên đăng nhập, mật khẩu đúng, mã captcha sai "zzzzz"\n2. Bấm Đăng nhập',
    'Báo "Mã captcha không hợp lệ hoặc đã hết hạn, vui lòng thử lại"; vẫn ở trang đăng nhập; không lưu token');
  c('LGN-C02', 'AUTH.1-UC3', 'Captcha', 'Nút "Đổi mã xác nhận" tải ảnh captcha mới và xóa mã đã nhập', 'Chức năng', 'Trung bình',
    '1. Nhập "abc" vào ô mã\n2. Bấm nút Đổi mã xác nhận', 'Ảnh captcha thay đổi; ô Mã xác nhận được xóa trắng');
  c('LGN-C03', 'AUTH.1-UC3', 'Captcha', 'Sau khi đăng nhập thất bại do sai captcha, ảnh captcha được làm mới', 'Nghiệp vụ', 'Trung bình',
    '1. Nhập mã captcha sai\n2. Bấm Đăng nhập\n3. So sánh ảnh captcha trước và sau', 'Ảnh captcha (và captchaId) được làm mới để lần thử sau dùng mã mới',
    'Khảo sát: ảnh captcha giữ nguyên sau lỗi, ô mã vẫn còn "zzzzz" → nghi lỗi. ' + BA + ' (captcha dùng một lần)');
  c('LGN-C10', 'AUTH.1-UC3', 'Captcha', 'Sau khi đăng nhập thất bại, nhập mã captcha mới vào ô và bấm Đăng nhập lại thì mã mới được gửi đi', 'Chức năng', 'Cao',
    '1. Nhập đủ thông tin với mã captcha sai, bấm Đăng nhập (báo lỗi captcha)\n2. Gõ mã khác vào ô Mã xác nhận\n3. Bấm Đăng nhập lần nữa', 'Request thứ hai gửi đúng mã vừa gõ (không báo "Vui lòng nhập mã xác nhận!" khi ô đang có mã)',
    'Khảo sát: ô hiện mã mới gõ nhưng bấm Đăng nhập báo "Vui lòng nhập mã xác nhận!" và không gửi request; chỉ sau khi bấm "Đổi mã xác nhận" mới đăng nhập lại được → nghi lỗi nghiêm trọng (người dùng sai mật khẩu một lần phải làm mới captcha thủ công)');
  c('LGN-C04', 'AUTH.1-UC3', 'Captcha', '[API] Lấy captcha trả captchaId và ảnh PNG, mỗi lần một mã khác nhau', 'Chức năng', 'Trung bình',
    '1. [API] GET /authentication/captcha 2 lần', 'HTTP 200; có captchaId (khác nhau giữa hai lần) và captchaImage dạng data:image/png;base64');
  c('LGN-C05', 'AUTH.1-UC3', 'Captcha', '[API] Phản hồi captcha không chứa dữ liệu cho phép suy ra đáp án', 'Bảo mật', 'Cao',
    '1. [API] GET /authentication/captcha\n2. Kiểm tra các trường trả về', 'Chỉ có captchaId và captchaImage; không có băm/đáp án của mã',
    'Khảo sát: phản hồi có thêm captchaHash (64 hex, dạng SHA-256) → mã captcha ngắn có thể bị suy ngược bằng vét cạn → nghi lỗi bảo mật. Cần dev xác nhận mục đích trường này');
  c('LGN-C06', 'AUTH.1-UC3', 'Captcha', '[API] Đăng nhập với captcha sai bị từ chối HTTP 400, không trả token', 'Bảo mật', 'Cao',
    '1. [API] POST /authentication/jwt/login với captchaCode sai', 'HTTP 400 "Mã captcha không hợp lệ hoặc đã hết hạn..."; không có tokenString');
  c('LGN-C07', 'AUTH.1-UC3', 'Captcha', '[API] Đăng nhập không gửi captcha bị từ chối', 'Bảo mật', 'Cao',
    '1. [API] POST jwt/login chỉ có email, password', 'HTTP 400 báo captcha không hợp lệ; không trả token');
  c('LGN-C08', 'AUTH.1-UC3', 'Captcha', '[API] Đăng nhập với captchaId không tồn tại bị từ chối', 'Bảo mật', 'Cao',
    '1. [API] POST jwt/login với captchaId "không-tồn-tại"', 'HTTP 400 báo captcha không hợp lệ; không trả token');
  c('LGN-C09', 'AUTH.1-UC3', 'Captcha', 'Ký tự đặc biệt / SQL / script trong tên đăng nhập không gây lỗi hệ thống', 'Bảo mật', 'Cao',
    "1. [API] POST jwt/login với email  ' OR 1=1 --  và  <script>alert(1)</script>\n2. Nhập chuỗi trên vào form đăng nhập",
    'HTTP 4xx (không 500); trang không trắng, không thực thi script, không đăng nhập được');
  // --- UC5 Phiên ---
  c('LGN-S01', 'AUTH.1-UC5', 'Phiên', 'Chưa đăng nhập vào trang quản trị thì bị chuyển về trang đăng nhập', 'Bảo mật', 'Cao',
    '1. Xóa phiên, mở trực tiếp /#/vi/users', 'Chuyển về /#/vi/auth/login; không hiển thị dữ liệu quản trị');
  c('LGN-S02', 'AUTH.1-UC5', 'Phiên', 'Token giả trong bộ nhớ trình duyệt bị đẩy về trang đăng nhập, không lặp chuyển hướng', 'Bảo mật', 'Cao',
    '1. Ghi token giả "a.b.c" vào localStorage\n2. Mở /#/vi/users\n3. Theo dõi số lần chuyển trang trong 3 giây', 'Chuyển về trang đăng nhập đúng một lần và đứng yên tại đó (không quá 5 lần chuyển trang)',
    'Khảo sát: ứng dụng chuyển qua lại /auth/login ↔ /dashboard-demo hàng trăm lần mỗi giây (vòng lặp chuyển hướng) → nghi lỗi nghiêm trọng, treo trình duyệt');
  c('LGN-S03', 'AUTH.1-UC5', 'Phiên', '[API] Gọi API nghiệp vụ với token giả bị từ chối 401', 'Bảo mật', 'Cao',
    '1. [API] GET /idm/users với Authorization: Bearer a.b.c', 'HTTP 401 (không trả dữ liệu)');

  // --- UC2/UC4/UC5 cần captcha thật → Manual ---
  m('LGN-M01', 'AUTH.1-UC2', 'Đăng nhập', 'Đăng nhập đúng tài khoản/mật khẩu/captcha vào được hệ thống', 'Chức năng', 'Cao',
    '1. Nhập qc.canbo, mật khẩu đúng, captcha đúng\n2. Bấm Đăng nhập', 'Vào Dashboard; hiển thị đúng họ tên, đơn vị; menu theo quyền của nhóm');
  m('LGN-M02', 'AUTH.1-UC2', 'Đăng nhập', 'Sai mật khẩu bị từ chối với thông báo lỗi', 'Chức năng', 'Cao',
    '1. Nhập tên đăng nhập đúng, mật khẩu sai, captcha đúng\n2. Bấm Đăng nhập', 'Báo lỗi sai thông tin đăng nhập; ở lại trang đăng nhập; không có token');
  m('LGN-M03', 'AUTH.1-UC2', 'Đăng nhập', 'Tên đăng nhập không tồn tại bị từ chối', 'Chức năng', 'Cao',
    '1. Nhập tên không tồn tại, captcha đúng\n2. Bấm Đăng nhập', 'Báo lỗi; ở lại trang đăng nhập');
  m('LGN-M04', 'AUTH.1-UC2', 'Đăng nhập', 'Thông báo lỗi không cho biết tên đăng nhập có tồn tại hay không', 'Bảo mật', 'Trung bình',
    '1. Đăng nhập với tên không tồn tại\n2. Đăng nhập với tên đúng, mật khẩu sai\n3. So sánh thông báo', 'Hai thông báo giống nhau (chống dò tài khoản)',
    'Khảo sát: thông báo "Tài khoản … không tồn tại trong hệ thống. Vui lòng đăng ký mới." → lộ tài khoản tồn tại. ' + BA);
  m('LGN-M05', 'AUTH.1-UC2', 'Đăng nhập', 'Tài khoản bị khóa không đăng nhập được', 'Nghiệp vụ', 'Cao',
    '1. Đăng nhập bằng qc.locked, mật khẩu và captcha đúng', 'Bị từ chối kèm thông báo tài khoản bị khóa; không có token');
  m('LGN-M06', 'AUTH.1-UC2', 'Đăng nhập', 'Đăng nhập bằng tên đăng nhập (không cần gõ email)', 'Chức năng', 'Trung bình',
    '1. Nhập "qc.canbo" (chỉ tên đăng nhập, không @cds.local), captcha đúng', 'Đăng nhập thành công vì nhãn ô là "Tên đăng nhập"',
    'API nhận trường "email"; cần xác nhận hệ thống có chấp nhận tên đăng nhập thuần hay chỉ email. ' + BA);
  m('LGN-M07', 'AUTH.1-UC2', 'Đăng nhập', 'Đăng nhập bằng tên đăng nhập viết HOA/thường lẫn lộn', 'Nghiệp vụ', 'Thấp',
    '1. Nhập "QC.CANBO@CDS.LOCAL", mật khẩu đúng, captcha đúng', 'Đăng nhập thành công hoặc từ chối nhất quán theo quy ước', BA + ' phân biệt hoa/thường');
  m('LGN-M08', 'AUTH.1-UC2', 'Đăng nhập', 'Tài khoản chưa gán nhóm đăng nhập được nhưng không có quyền nghiệp vụ', 'Nghiệp vụ', 'Trung bình',
    '1. Đăng nhập bằng qc.nogroup', 'Đăng nhập được; menu không có chức năng nào hoặc thông báo chưa phân quyền; không lỗi hệ thống', BA);
  m('LGN-M09', 'AUTH.1-UC4', 'Đổi mật khẩu lần đầu', 'Tài khoản bắt buộc đổi mật khẩu được chuyển sang màn đổi mật khẩu', 'Nghiệp vụ', 'Cao',
    '1. Đăng nhập bằng qc.firstlogin (cờ bắt buộc đổi mật khẩu)', 'Chuyển sang màn "Đổi mật khẩu lần đầu"; chưa vào được các trang nghiệp vụ');
  m('LGN-M10', 'AUTH.1-UC4', 'Đổi mật khẩu lần đầu', 'Đổi mật khẩu lần đầu thành công thì vào hệ thống và lần sau không bị hỏi lại', 'Nghiệp vụ', 'Cao',
    '1. Ở màn đổi mật khẩu lần đầu nhập mật khẩu mới, xác nhận khớp\n2. Đăng xuất, đăng nhập lại', 'Đổi thành công, vào hệ thống; lần sau đăng nhập thẳng',
    'Chạy trên tài khoản dùng một lần (tạo mới), không dùng qc.firstlogin vì sẽ mất mẫu');
  m('LGN-M11', 'AUTH.1-UC4', 'Đổi mật khẩu lần đầu', 'Mật khẩu xác nhận không khớp ở màn đổi mật khẩu lần đầu bị chặn', 'Validate', 'Trung bình',
    '1. Nhập mật khẩu mới và xác nhận khác nhau', 'Báo lỗi không khớp; không đổi mật khẩu');
  m('LGN-M12', 'AUTH.1-UC5', 'Đăng nhập', 'Chọn "Ghi nhớ đăng nhập" giữ phiên sau khi đóng và mở lại trình duyệt', 'Chức năng', 'Thấp',
    '1. Đăng nhập có tick Ghi nhớ\n2. Đóng, mở lại trình duyệt', 'Vẫn đăng nhập; token còn hạn theo cấu hình');
  m('LGN-M13', 'AUTH.1-UC5', 'Đăng xuất', 'Đăng xuất đưa về trang đăng nhập và nút Back không quay lại được hệ thống', 'Bảo mật', 'Cao',
    '1. Đăng nhập\n2. Đăng xuất\n3. Bấm Back trình duyệt', 'Về trang đăng nhập; Back không hiển thị lại trang nghiệp vụ; token bị xóa');
  m('LGN-M14', 'AUTH.1-UC3', 'Captcha', 'Mã captcha đã dùng một lần không dùng lại được', 'Bảo mật', 'Cao',
    '1. Đăng nhập thành công với captchaId X\n2. [API] Gọi lại jwt/login với cùng captchaId X và mã đã đúng', 'Lần hai bị từ chối "captcha không hợp lệ hoặc đã hết hạn"');
  m('LGN-M15', 'AUTH.1-UC2', 'Đăng nhập', 'Nhập sai mật khẩu nhiều lần liên tiếp bị khóa hoặc giới hạn', 'Bảo mật', 'Cao',
    '1. Đăng nhập sai mật khẩu 10 lần liên tiếp (mỗi lần captcha đúng)\n2. Đăng nhập đúng mật khẩu', 'Tài khoản bị khóa tạm hoặc bị giới hạn tần suất; ghi nhận thông báo rõ ràng', BA + ' số lần và thời gian khóa');

  // ===================== AUTH.2 QUÊN / ĐẶT LẠI MẬT KHẨU =====================
  // --- UC1 Yêu cầu OTP (bước 1: nhập email) ---
  c('RPW-L01', 'AUTH.2-UC1', 'Form quên mật khẩu', 'Màn Quên mật khẩu hiển thị đủ thành phần', 'Chức năng', 'Cao',
    '1. Ở trang đăng nhập bấm "Quên mật khẩu?"',
    'Có tiêu đề "Quên mật khẩu", hướng dẫn gửi OTP 6 chữ số, ô Email đăng ký, nút Lấy mã OTP, nút Quay lại đăng nhập, ghi chú liên hệ Quản trị hệ thống');
  c('RPW-L02', 'AUTH.2-UC1', 'Validate', 'Bỏ trống email thì báo lỗi bắt buộc', 'Validate', 'Cao',
    '1. Để trống ô email\n2. Bấm Lấy mã OTP', 'Báo "Vui lòng nhập email đăng ký!"; không gửi mail');
  c('RPW-L03', 'AUTH.2-UC1', 'Validate', 'Email sai định dạng thì báo lỗi', 'Validate', 'Cao',
    '1. Nhập "abc"\n2. Bấm Lấy mã OTP', 'Báo "Email không đúng định dạng!"; không gửi mail');
  c('RPW-L04', 'AUTH.2-UC1', 'Yêu cầu OTP', 'Email chưa đăng ký với hệ thống bị từ chối, ở lại bước nhập email', 'Nghiệp vụ', 'Cao',
    '1. Nhập email hợp lệ nhưng chưa có tài khoản\n2. Bấm Lấy mã OTP', 'Báo email chưa được đăng ký với hệ thống; vẫn ở màn nhập email; không có mail gửi đi');
  c('RPW-L05', 'AUTH.2-UC1', 'Form quên mật khẩu', 'Bấm "Quay lại đăng nhập" trở về màn đăng nhập', 'Chức năng', 'Trung bình',
    '1. Ở màn Quên mật khẩu bấm "Quay lại đăng nhập"', 'Hiển thị lại form đăng nhập');
  c('RPW-L06', 'AUTH.2-UC1', 'Yêu cầu OTP', 'Thông báo email chưa đăng ký tách rõ chữ "Email" và địa chỉ', 'UI', 'Thấp',
    '1. [API] POST forgot-password với email chưa đăng ký', 'Thông báo dạng "Email <địa chỉ> chưa được đăng kí..." có khoảng trắng giữa "Email" và địa chỉ',
    'Khảo sát: "Emailkhongco@cds.local chưa được đăng kí…" thiếu dấu cách → lỗi chính tả thông báo');
  c('RPW-L07', 'AUTH.2-UC1', 'Yêu cầu OTP', '[API] Tài khoản bị khóa không nhận được OTP', 'Nghiệp vụ', 'Cao',
    '1. [API] POST forgot-password với email của qc.locked', 'HTTP 400 "Tài khoản bị khóa không thể thực hiện chức năng này"; không gửi mail');
  c('RPW-L08', 'AUTH.2-UC1', 'Yêu cầu OTP', 'Email phân biệt hoa/thường khi quên mật khẩu', 'Nghiệp vụ', 'Trung bình',
    '1. [API] POST forgot-password với email tài khoản viết HOA toàn bộ', 'Được coi là cùng email: HTTP 200 và gửi OTP (email về nguyên tắc không phân biệt hoa/thường)',
    'Khảo sát: HTTP 404 "chưa đăng kí" → nghi lỗi. ' + BA + ' hoa/thường');
  c('RPW-L09', 'AUTH.2-UC1', 'Yêu cầu OTP', 'Ký tự đặc biệt / SQL trong email không gây lỗi hệ thống', 'Bảo mật', 'Cao',
    "1. [API] POST forgot-password với email  ' OR 1=1 --  và <script>alert(1)</script>", 'HTTP 4xx (không 500); không gửi mail');
  c('RPW-L10', 'AUTH.2-UC1', 'Yêu cầu OTP', 'Chống dò tài khoản: phản hồi giống nhau cho email có và không có tài khoản', 'Bảo mật', 'Trung bình',
    '1. [API] forgot-password với email có tài khoản\n2. [API] forgot-password với email không tồn tại\n3. So sánh phản hồi', 'Hai phản hồi cùng mã HTTP và cùng thông báo trung tính',
    'Khảo sát: 200 (đã gửi OTP) so với 404 (chưa đăng kí) → lộ email nào có tài khoản. ' + BA + ' (hệ thống nội bộ có thể chấp nhận)');
  c('RPW-L11', 'AUTH.2-UC1', 'Yêu cầu OTP', 'Giới hạn tần suất gửi OTP (chống spam mail)', 'Bảo mật', 'Cao',
    '1. [API] POST forgot-password 3 lần liên tiếp trong vài giây cho cùng một email', 'Ít nhất một yêu cầu sau lần đầu bị từ chối (HTTP 429/400) để tránh spam mail',
    'Khảo sát: cả 3 lần đều HTTP 200 (chỉ giao diện chặn bằng đếm ngược 1 phút) → nghi lỗi. ' + BA);

  // --- UC2 Xác thực OTP (bước 2) ---
  c('RPW-O01', 'AUTH.2-UC2', 'Màn OTP', 'Email hợp lệ chuyển sang màn nhập OTP với 6 ô, email được che và có đếm ngược', 'Chức năng', 'Cao',
    '1. Nhập email của qc.resetpw\n2. Bấm Lấy mã OTP',
    'Màn "Nhập mã OTP": 6 ô nhập; email hiển thị dạng q*****@<tên miền>; "Mã có hiệu lực trong mm:ss" đếm ngược; có nút Xác nhận, Đổi email khác');
  c('RPW-O02', 'AUTH.2-UC2', 'Email OTP', 'Mail OTP có tiêu đề, mã 6 số và nội dung đúng', 'Chức năng', 'Cao',
    '1. Gửi OTP cho qc.resetpw\n2. Mở mail nhận được', 'Tiêu đề dạng "[<OTP>] Mã xác thực OTP khôi phục mật khẩu - Hệ thống CDS"; nội dung có họ tên người dùng, mã 6 số trùng tiêu đề, hiệu lực 1 phút, cảnh báo không chia sẻ mã');
  c('RPW-O03', 'AUTH.2-UC2', 'Màn OTP', 'Nút gửi lại bị khóa trong thời gian đếm ngược', 'Chức năng', 'Trung bình',
    '1. Sang màn OTP\n2. Quan sát phần "Chưa nhận được mã?"', 'Hiển thị "Gửi lại sau mm:ss" (không bấm được), chưa có nút "Gửi lại ngay", trong thời gian đếm ngược');
  c('RPW-O04', 'AUTH.2-UC2', 'Màn OTP', 'Hết thời gian đếm ngược xuất hiện nút Gửi lại, gửi lại tạo OTP mới', 'Chức năng', 'Trung bình',
    '1. Sang màn OTP, chờ hết đếm ngược\n2. Bấm Gửi lại', 'Đếm ngược về 00:00 và xuất hiện nút "Gửi lại ngay"; bấm gửi mail OTP mới (khác mã cũ); đếm ngược bắt đầu lại');
  c('RPW-O05', 'AUTH.2-UC2', 'Validate', 'Nhập thiếu 6 chữ số OTP thì báo lỗi', 'Validate', 'Cao',
    '1. Ở màn OTP nhập 3 chữ số\n2. Bấm Xác nhận', 'Báo "Vui lòng nhập đủ 6 chữ số OTP!"; không gọi xác thực');
  c('RPW-O06', 'AUTH.2-UC2', 'Validate', 'OTP sai bị từ chối, ở lại màn OTP', 'Nghiệp vụ', 'Cao',
    '1. Nhập OTP "000000"\n2. Bấm Xác nhận', 'Báo "Mã xác thực không đúng hoặc đã hết hạn"; vẫn ở màn OTP');
  c('RPW-O07', 'AUTH.2-UC2', 'Validate', 'Ô OTP không nhận ký tự chữ', 'Validate', 'Trung bình',
    '1. Gõ "abcdef" vào ô OTP', 'Các ô không nhận ký tự chữ (vẫn trống) hoặc báo lỗi', BA);
  c('RPW-O08', 'AUTH.2-UC2', 'Xác thực OTP', 'OTP đúng thì xác thực thành công và sang màn mật khẩu mới', 'Chức năng', 'Cao',
    '1. Nhập OTP nhận từ mail\n2. Bấm Xác nhận', 'Báo "Xác thực thành công"; chuyển màn đặt mật khẩu mới');
  c('RPW-O09', 'AUTH.2-UC2', 'Màn OTP', 'Bấm "Đổi email khác" quay lại bước nhập email', 'Chức năng', 'Trung bình',
    '1. Ở màn OTP bấm "Đổi email khác"', 'Quay lại màn nhập email đăng ký');
  c('RPW-O10', 'AUTH.2-UC2', 'Xác thực OTP', '[API] OTP hết hạn sau 1 phút bị từ chối', 'Nghiệp vụ', 'Cao',
    '1. Lấy OTP\n2. Chờ 65 giây\n3. [API] verify-forgot-password-token', 'HTTP 400 "Mã xác thực không đúng hoặc đã hết hạn"');
  c('RPW-O11', 'AUTH.2-UC2', 'Xác thực OTP', '[API] Gửi lại OTP thì mã cũ mất hiệu lực', 'Nghiệp vụ', 'Cao',
    '1. [API] Gửi OTP lần 1 (mã A)\n2. Gửi OTP lần 2 (mã B)\n3. Xác thực mã A\n4. Xác thực mã B', 'Mã A bị từ chối (400); mã B xác thực thành công');
  c('RPW-O12', 'AUTH.2-UC2', 'Xác thực OTP', '[API] OTP của tài khoản này không dùng được cho email khác', 'Bảo mật', 'Cao',
    '1. Lấy OTP cho qc.resetpw\n2. [API] verify với email qc.canbo@cds.local và OTP đó', 'HTTP 400 từ chối');
  c('RPW-O13', 'AUTH.2-UC2', 'Xác thực OTP', '[API] Xác thực thiếu tham số bị từ chối, không lỗi 500', 'Validate', 'Trung bình',
    '1. [API] GET verify-forgot-password-token không có resetPasswordToken, email', 'HTTP 4xx kèm thông báo; không 500');
  c('RPW-O14', 'AUTH.2-UC2', 'Xác thực OTP', 'Giới hạn số lần nhập sai OTP (chống vét cạn)', 'Bảo mật', 'Cao',
    '1. Lấy OTP đúng\n2. [API] Xác thực sai 12 lần liên tiếp\n3. Xác thực bằng OTP đúng', 'Sau nhiều lần sai OTP bị vô hiệu/khóa tạm: bước 3 bị từ chối',
    'Khảo sát: 12 lần sai vẫn xác thực được OTP đúng; OTP 6 số hiệu lực 1 phút có thể bị vét cạn → nghi lỗi bảo mật. ' + BA + ' số lần tối đa');

  // --- UC3 Đặt mật khẩu mới (bước 3) ---
  c('RPW-P01', 'AUTH.2-UC3', 'Màn mật khẩu mới', 'Màn mật khẩu mới có hai ô mật khẩu ẩn và nút Cập nhật mật khẩu', 'Chức năng', 'Cao',
    '1. Xác thực OTP thành công', 'Có ô "Nhập mật khẩu mới", "Nhập lại mật khẩu mới" (type=password), nút "Cập nhật mật khẩu", "Quay lại đăng nhập"');
  c('RPW-P02', 'AUTH.2-UC3', 'Validate', 'Bỏ trống mật khẩu mới thì không cho cập nhật', 'Validate', 'Cao',
    '1. Để trống hai ô\n2. Bấm Cập nhật mật khẩu', 'Báo lỗi bắt buộc hoặc nút bị vô hiệu; không gọi reset-password');
  c('RPW-P03', 'AUTH.2-UC3', 'Validate', 'Mật khẩu xác nhận không khớp thì báo lỗi trên giao diện', 'Validate', 'Cao',
    '1. Nhập mật khẩu mới "Test!123456", nhập lại "Test!654321"', 'Báo "Mật khẩu xác nhận không khớp!" ngay dưới ô nhập lại; nút Cập nhật mật khẩu bị vô hiệu; không gọi reset-password; mật khẩu không đổi');
  c('RPW-P04', 'AUTH.2-UC3', 'Validate', '[API] Mật khẩu và xác nhận không khớp bị từ chối', 'Validate', 'Cao',
    '1. [API] reset-password với password và confirmPassword khác nhau', 'HTTP 400 "Confirm password không khớp"; OTP vẫn dùng được; mật khẩu không đổi');
  c('RPW-P05', 'AUTH.2-UC3', 'Validate', '[API] Mật khẩu rỗng bị từ chối', 'Validate', 'Cao',
    '1. [API] reset-password với password và confirmPassword rỗng', 'HTTP 400 báo bắt buộc; mật khẩu không đổi',
    'Khảo sát: HTTP 200 "Thay đổi mật khẩu thành công" và OTP bị tiêu thụ → có thể đặt mật khẩu rỗng → nghi lỗi nghiêm trọng. Test tự khôi phục mật khẩu sau khi chạy');
  c('RPW-P06', 'AUTH.2-UC3', 'Validate', '[API] Mật khẩu quá ngắn ("abc") bị từ chối', 'Validate', 'Cao',
    '1. [API] reset-password với mật khẩu "abc"', 'HTTP 400 báo mật khẩu chưa đủ độ dài tối thiểu',
    'Khảo sát: nhận "abc" (200). Form tạo người dùng ghi "Tối thiểu 6 ký tự". ' + BA + ' chính sách mật khẩu. Test tự khôi phục mật khẩu');
  c('RPW-P07', 'AUTH.2-UC3', 'Validate', '[API] Mật khẩu chỉ gồm số ("12345678") bị từ chối theo độ phức tạp', 'Validate', 'Trung bình',
    '1. [API] reset-password với mật khẩu "12345678"', 'HTTP 400 báo mật khẩu chưa đủ độ phức tạp (chữ hoa, thường, số, ký tự đặc biệt)',
    'Khảo sát: nhận (200); mật khẩu mẫu của hệ thống là dạng phức tạp "Test!123456". ' + BA + ' chính sách mật khẩu. Test tự khôi phục mật khẩu');
  c('RPW-P08', 'AUTH.2-UC3', 'Validate', '[API] Mật khẩu dài đúng 128 ký tự được chấp nhận', 'Validate', 'Trung bình',
    '1. [API] reset-password với mật khẩu 128 ký tự hợp lệ', 'HTTP 200 thay đổi thành công', 'Test tự khôi phục mật khẩu');
  c('RPW-P09', 'AUTH.2-UC3', 'Validate', '[API] Mật khẩu 129 ký tự bị từ chối', 'Validate', 'Trung bình',
    '1. [API] reset-password với mật khẩu 129 ký tự', 'HTTP 400 "Không được nhập vượt quá 128 ký tự"; mật khẩu không đổi');
  c('RPW-P10', 'AUTH.2-UC3', 'Đặt lại mật khẩu', 'Đặt lại mật khẩu thành công trọn luồng trên giao diện', 'Chức năng', 'Cao',
    '1. Quên mật khẩu → nhập email qc.resetpw → Lấy mã OTP\n2. Nhập OTP từ mail → Xác nhận\n3. Nhập mật khẩu mới hợp lệ, nhập lại → Cập nhật mật khẩu\n4. Bấm Đăng nhập ở màn thành công',
    'Hiển thị màn "Đặt lại mật khẩu thành công" (nêu các phiên đăng nhập khác đã bị đăng xuất) kèm nút Đăng nhập; bấm nút về form đăng nhập; ngày đổi mật khẩu của user (lastPasswordChangeDate) được cập nhật');
  c('RPW-P11', 'AUTH.2-UC3', 'Đặt lại mật khẩu', '[API] OTP đã dùng đặt mật khẩu không dùng lại được', 'Bảo mật', 'Cao',
    '1. Đặt lại mật khẩu thành công bằng OTP X\n2. [API] reset-password lần nữa với OTP X', 'Lần hai bị từ chối (4xx) "không tìm thấy người dùng hoặc mã xác thực đã hết hạn"');
  c('RPW-P12', 'AUTH.2-UC3', 'Đặt lại mật khẩu', '[API] Đặt lại với OTP sai bị từ chối', 'Bảo mật', 'Cao',
    '1. [API] reset-password với resetPasswordToken "000000"', 'HTTP 404 "Không tìm thấy người dùng hoặc mã xác thực đã hết hạn"; mật khẩu không đổi');
  c('RPW-P13', 'AUTH.2-UC3', 'Đặt lại mật khẩu', '[API] Đặt lại thiếu resetPasswordToken bị từ chối', 'Validate', 'Trung bình',
    '1. [API] reset-password body rỗng', 'HTTP 400 "Vui lòng nhập resetPasswordToken"');
  c('RPW-P14', 'AUTH.2-UC3', 'Màn mật khẩu mới', 'Bấm "Quay lại đăng nhập" ở màn mật khẩu mới trở về đăng nhập', 'Chức năng', 'Thấp',
    '1. Ở màn mật khẩu mới bấm "Quay lại đăng nhập"', 'Hiển thị form đăng nhập');

  // --- Cần captcha thật → Manual ---
  m('RPW-M01', 'AUTH.2-UC3', 'Đặt lại mật khẩu', 'Sau khi đặt lại, đăng nhập được bằng mật khẩu mới', 'Chức năng', 'Cao',
    '1. Đặt lại mật khẩu cho qc.resetpw thành "Test!Moi12345"\n2. Đăng nhập bằng mật khẩu mới (captcha đúng)', 'Đăng nhập thành công');
  m('RPW-M02', 'AUTH.2-UC3', 'Đặt lại mật khẩu', 'Sau khi đặt lại, mật khẩu cũ không còn đăng nhập được', 'Bảo mật', 'Cao',
    '1. Đặt lại mật khẩu cho qc.resetpw\n2. Đăng nhập bằng mật khẩu cũ (captcha đúng)', 'Bị từ chối sai mật khẩu');
  m('RPW-M03', 'AUTH.2-UC3', 'Đặt lại mật khẩu', 'Sau khi đặt lại, phiên (token) đang đăng nhập trước đó bị vô hiệu', 'Bảo mật', 'Trung bình',
    '1. Đăng nhập qc.resetpw, giữ token\n2. Đặt lại mật khẩu bằng OTP\n3. Gọi API bằng token cũ', 'Token cũ bị từ chối (401)', BA);
}
