// Testcase nhóm "Các chức năng dành cho người dùng có tài khoản của hệ thống" — phần sau khi đã đăng nhập:
//   AUTH.3  Đổi mật khẩu (CPW)   UC1 Mở & hiển thị · UC2 Validate giao diện · UC3 Kiểm tra phía API · UC4 Bảo mật · UC5 Luồng & lỗi · UC6 Sau khi đổi (Manual)
//   AUTH.4  Đăng xuất (LGO)      UC1 Menu & hộp thoại xác nhận · UC2 Kết thúc phiên · UC3 Bảo mật · UC4 Lỗi
// (Đăng nhập = LGN, Lấy lại mật khẩu = RPW → catalog-AUTH.mjs)
// Nguồn: khảo sát UI/API thực tế (không có UC trong UC_1409 → mã UC dạng AUTH.<n>-UC<m>).
// Hành vi đã khảo sát:
//   Đổi mật khẩu: Thông tin cá nhân → khối "Mật khẩu" → nút "Đổi mật khẩu" → hộp thoại 3 ô (Mật khẩu hiện tại / mới / xác nhận, maxlength 255),
//     thanh độ mạnh + 5 tiêu chí (≥6 ký tự · hoa+thường · chữ số · ký tự đặc biệt · không chứa tên đăng nhập). UI chặn mật khẩu yếu/không khớp trước khi gọi API.
//     API: PUT /api/v1/idm/users/{id}/password {passwordOld, passwordNew}; sai mật khẩu cũ → 400 "Mật khẩu cũ không chính xác"; >128 ký tự → 400.
//     LỆCH QUY TẮC: API chấp nhận passwordOld rỗng/null (đổi được mà không cần mật khẩu cũ) và KHÔNG kiểm chính sách mật khẩu ("abc", "12345678", chứa tên đăng nhập đều 200);
//     hộp thoại giữ nguyên giá trị đã nhập sau khi Huỷ.
//   Đăng xuất: menu người dùng góc dưới sidebar → "Đăng xuất" → hộp thoại "Đăng xuất khỏi hệ thống?" (Không / Có). Chỉ xóa phiên phía trình duyệt, KHÔNG gọi API thu hồi token.
// Quy ước Auto an toàn: mọi case chạy trên tài khoản dùng chung (canbo) chỉ dùng mật khẩu hiện tại SAI hoặc mật khẩu hợp lệ nhưng bị chặn → không đổi mật khẩu thật.
//   Case có thể làm đổi mật khẩu (khi hệ thống lỗi) phải tự khôi phục mật khẩu ở bước dọn. Case cần mật khẩu cũ ĐÚNG hoặc đăng nhập (captcha) → Manual.
export default function defineAcc(t) {
  const c = (id, uc, fn, title, type, pri, steps, exp, note = '') => t(id, uc, fn, title, type, pri, steps, exp, 'Auto', note);
  const CAP = 'Manual — cần nhập captcha thật khi đăng nhập';
  const NOW = 'Manual — cần mật khẩu hiện tại ĐÚNG nên làm đổi mật khẩu thật của tài khoản; chạy trên tài khoản dùng một lần';
  const m = (id, uc, fn, title, type, pri, steps, exp, note = '', why = NOW) => t(id, uc, fn, title, type, pri, steps, exp, why, note);
  const BA = 'Cần BA xác nhận quy tắc';
  const OPEN = '1. Đăng nhập (canbo)\n2. Mở menu người dùng → Thông tin cá nhân\n3. Bấm "Đổi mật khẩu"';
  const BAD = 'Sai!Matkhau1';   // mật khẩu hiện tại sai cố ý → không bao giờ đổi được mật khẩu thật

  // ===================== AUTH.3 ĐỔI MẬT KHẨU =====================
  // --- UC1 Mở & hiển thị ---
  c('CPW-L01', 'AUTH.3-UC1', 'Truy cập', 'Trang Thông tin cá nhân có khối "Mật khẩu" và nút "Đổi mật khẩu"', 'Chức năng', 'Cao',
    '1. Đăng nhập (canbo)\n2. Mở menu người dùng (góc dưới sidebar) → Thông tin cá nhân', 'Mở trang /profile; có khối "Mật khẩu" kèm mô tả "Đổi mật khẩu định kỳ…" và nút "Đổi mật khẩu"');
  c('CPW-L02', 'AUTH.3-UC1', 'Truy cập', 'Mọi vai trò đăng nhập đều có nút "Đổi mật khẩu" (kể cả vai trò chỉ xem)', 'Nghiệp vụ', 'Trung bình',
    '1. Lần lượt đăng nhập superadmin, ldd, xemonly\n2. Mở Thông tin cá nhân', 'Cả ba vai trò đều thấy nút "Đổi mật khẩu" và mở được hộp thoại');
  c('CPW-L03', 'AUTH.3-UC1', 'Hộp thoại', 'Hộp thoại Đổi mật khẩu hiển thị đủ thành phần', 'Chức năng', 'Cao',
    OPEN, 'Tiêu đề "Đổi mật khẩu"; ba ô có dấu * (Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới) đều rỗng; khối "Độ mạnh mật khẩu" với 5 tiêu chí; ghi chú "Sau khi đổi, các phiên đăng xuất trên thiết bị khác sẽ bị đăng xuất."; nút Huỷ, Cập nhật mật khẩu, nút đóng (X)');
  c('CPW-L04', 'AUTH.3-UC1', 'Hộp thoại', 'Ba ô mật khẩu mặc định ẩn, bấm biểu tượng mắt hiện/ẩn từng ô', 'UI', 'Thấp',
    OPEN + '\n4. Nhập giá trị vào từng ô\n5. Bấm biểu tượng mắt của từng ô, rồi bấm lại', 'Mặc định type=password; bấm mắt ô nào thì chỉ ô đó hiện rõ (type=text); bấm lại thì ẩn');
  c('CPW-L05', 'AUTH.3-UC1', 'Hộp thoại', 'Đóng hộp thoại bằng Huỷ, nút X hoặc phím Esc không gọi API', 'Chức năng', 'Trung bình',
    OPEN + '\n4. Nhập vài ký tự vào ô đầu\n5. Đóng lần lượt bằng Huỷ, X, Esc (mở lại hộp thoại giữa các lần)', 'Mỗi lần hộp thoại đóng, vẫn ở trang Thông tin cá nhân, không có request PUT …/password nào được gửi');
  c('CPW-L06', 'AUTH.3-UC1', 'Hộp thoại', 'Mở lại hộp thoại sau khi Huỷ thì các ô mật khẩu đã nhập được xóa sạch', 'Bảo mật', 'Trung bình',
    OPEN + '\n4. Nhập "abc" vào ô Mật khẩu hiện tại\n5. Bấm Huỷ\n6. Bấm lại "Đổi mật khẩu"', 'Cả ba ô đều rỗng (không lưu mật khẩu đã gõ)',
    'Khảo sát: sau Huỷ mở lại, ô Mật khẩu hiện tại vẫn còn "abc" → nghi lỗi (mật khẩu còn lưu trên form)');

  // --- UC2 Validate giao diện (chặn trước khi gọi API) ---
  c('CPW-V01', 'AUTH.3-UC2', 'Validate', 'Bỏ trống cả ba ô thì báo lỗi bắt buộc ở từng ô và không gọi API', 'Validate', 'Cao',
    OPEN + '\n4. Để trống cả ba ô, bấm "Cập nhật mật khẩu"', 'Hiện "Nhập mật khẩu hiện tại", "Nhập mật khẩu mới", "Xác nhận mật khẩu mới" dưới đúng từng ô; hộp thoại vẫn mở; không có request PUT');
  c('CPW-V02', 'AUTH.3-UC2', 'Validate', 'Chỉ thiếu Mật khẩu hiện tại thì báo lỗi đúng ô đó', 'Validate', 'Cao',
    OPEN + '\n4. Bỏ trống Mật khẩu hiện tại; nhập mật khẩu mới hợp lệ "Moi!123456a" và xác nhận khớp\n5. Bấm "Cập nhật mật khẩu"', 'Chỉ ô Mật khẩu hiện tại báo "Nhập mật khẩu hiện tại"; không có request PUT');
  c('CPW-V03', 'AUTH.3-UC2', 'Validate', 'Chỉ thiếu Mật khẩu mới thì báo lỗi đúng ô đó', 'Validate', 'Cao',
    OPEN + '\n4. Nhập mật khẩu hiện tại; bỏ trống mật khẩu mới; nhập xác nhận "Moi!123456a"\n5. Bấm "Cập nhật mật khẩu"', 'Ô Mật khẩu mới báo "Nhập mật khẩu mới"; không có request PUT');
  c('CPW-V04', 'AUTH.3-UC2', 'Validate', 'Chỉ thiếu Xác nhận mật khẩu mới thì báo lỗi đúng ô đó', 'Validate', 'Cao',
    OPEN + '\n4. Nhập mật khẩu hiện tại và mật khẩu mới hợp lệ; bỏ trống ô xác nhận\n5. Bấm "Cập nhật mật khẩu"', 'Ô xác nhận báo "Xác nhận mật khẩu mới"; không có request PUT');
  c('CPW-V05', 'AUTH.3-UC2', 'Validate', 'Mật khẩu xác nhận không khớp thì báo lỗi và không gọi API', 'Validate', 'Cao',
    OPEN + '\n4. Nhập mật khẩu hiện tại; mật khẩu mới "Moi!123456a"; xác nhận "Moi!123456b"\n5. Bấm "Cập nhật mật khẩu"', 'Dưới ô xác nhận hiện "Mật khẩu xác nhận không khớp!"; không có request PUT');
  c('CPW-V06', 'AUTH.3-UC2', 'Validate', 'Mật khẩu mới dưới 6 ký tự ("Ab1!") bị chặn', 'Validate', 'Cao',
    OPEN + '\n4. Nhập mật khẩu hiện tại; mật khẩu mới và xác nhận "Ab1!"\n5. Bấm "Cập nhật mật khẩu"', 'Báo "Mật khẩu chưa đáp ứng đủ các yêu cầu bảo mật!"; tiêu chí "Tối thiểu 6 ký tự" không đạt; không có request PUT');
  c('CPW-V07', 'AUTH.3-UC2', 'Validate', 'Mật khẩu mới thiếu chữ hoa hoặc chữ thường ("abcdef1!") bị chặn', 'Validate', 'Cao',
    OPEN + '\n4. Nhập mật khẩu mới và xác nhận "abcdef1!" rồi "ABCDEF1!"\n5. Bấm "Cập nhật mật khẩu" sau mỗi lần', 'Cả hai lần đều báo chưa đáp ứng yêu cầu; tiêu chí "Chữ hoa và chữ thường" không đạt; không có request PUT');
  c('CPW-V08', 'AUTH.3-UC2', 'Validate', 'Mật khẩu mới không có chữ số ("Abcdef!!") bị chặn', 'Validate', 'Cao',
    OPEN + '\n4. Nhập mật khẩu mới và xác nhận "Abcdef!!"\n5. Bấm "Cập nhật mật khẩu"', 'Báo chưa đáp ứng yêu cầu; tiêu chí "Có chữ số" không đạt; không có request PUT');
  c('CPW-V09', 'AUTH.3-UC2', 'Validate', 'Mật khẩu mới không có ký tự đặc biệt ("Abcdef12") bị chặn', 'Validate', 'Cao',
    OPEN + '\n4. Nhập mật khẩu mới và xác nhận "Abcdef12"\n5. Bấm "Cập nhật mật khẩu"', 'Báo chưa đáp ứng yêu cầu; tiêu chí "Có ký tự đặc biệt" không đạt; không có request PUT');
  c('CPW-V10', 'AUTH.3-UC2', 'Validate', 'Mật khẩu mới chứa tên đăng nhập ("qc.canbo!A1") bị chặn', 'Validate', 'Cao',
    OPEN + '\n4. Nhập mật khẩu mới và xác nhận "qc.canbo!A1"\n5. Bấm "Cập nhật mật khẩu"', 'Báo chưa đáp ứng yêu cầu; tiêu chí "Không chứa tên đăng nhập" không đạt; không có request PUT');
  c('CPW-V11', 'AUTH.3-UC2', 'Thanh độ mạnh', 'Thanh độ mạnh và 5 tiêu chí cập nhật theo giá trị đang gõ', 'UI', 'Trung bình',
    OPEN + '\n4. Lần lượt gõ vào ô Mật khẩu mới: "abc", "Abcdef1", "Abcdef1!", "qc.canboA1!"', 'Nhãn độ mạnh lần lượt: Yếu · Trung bình · Mạnh · Trung bình (chứa tên đăng nhập thì tiêu chí cuối không đạt); các tiêu chí đạt/không đạt đổi ngay khi gõ');
  c('CPW-V12', 'AUTH.3-UC2', 'Validate', 'Mật khẩu mới quá 128 ký tự bị giao diện chặn trước khi gọi API', 'Validate', 'Trung bình',
    OPEN + '\n4. Nhập mật khẩu hiện tại SAI, mật khẩu mới và xác nhận gồm 129 ký tự hợp lệ ("Aa1!" + 125 chữ "a")\n5. Bấm "Cập nhật mật khẩu"', 'Giao diện giới hạn ô nhập tối đa 128 ký tự hoặc báo "vượt quá 128 ký tự" và không gửi request PUT (nhất quán với giới hạn của server)',
    'Khảo sát: ô nhập cho gõ tới 255 ký tự, UI không chặn và vẫn gửi request; server mới trả 400 "Không được nhập vượt quá 128 ký tự" (chỉ khi mật khẩu cũ qua kiểm tra) → UI lệch quy tắc server');

  // --- UC3 Kiểm tra phía API ---
  c('CPW-A01', 'AUTH.3-UC3', 'Mật khẩu hiện tại', 'Mật khẩu hiện tại sai bị từ chối ngay trên giao diện, hộp thoại vẫn mở', 'Nghiệp vụ', 'Cao',
    OPEN + `\n4. Nhập mật khẩu hiện tại SAI "${BAD}"; mật khẩu mới "Moi!123456a", xác nhận khớp\n5. Bấm "Cập nhật mật khẩu"`, 'Hiện thông báo "Mật khẩu cũ không chính xác"; hộp thoại vẫn mở, không đóng; không báo thành công');
  c('CPW-A02', 'AUTH.3-UC3', 'Mật khẩu hiện tại', '[API] Mật khẩu hiện tại sai trả HTTP 400 và không đổi mật khẩu', 'Nghiệp vụ', 'Cao',
    `1. Lấy id người dùng qua GET /idm/users/info (token canbo)\n2. PUT /idm/users/{id}/password với passwordOld="${BAD}", passwordNew="Moi!123456a"`, 'HTTP 400, message "Mật khẩu cũ không chính xác", isSuccess=false');
  c('CPW-A03', 'AUTH.3-UC3', 'Mật khẩu hiện tại', '[API] Mật khẩu hiện tại để trống bị từ chối', 'Bảo mật', 'Cao',
    '1. PUT /idm/users/{id}/password với passwordOld="" và passwordNew hợp lệ (token canbo)\n2. Nếu hệ thống trả 200: khôi phục mật khẩu gốc ở bước dọn', 'HTTP 400, báo thiếu/sai mật khẩu hiện tại; mật khẩu không bị đổi',
    'Khảo sát: HTTP 200 "Đổi mật khẩu thành công" → nghi lỗi nghiêm trọng (đổi được mật khẩu mà không cần biết mật khẩu cũ; kẻ giữ token có thể chiếm tài khoản). Case tự khôi phục mật khẩu');
  c('CPW-A04', 'AUTH.3-UC3', 'Mật khẩu hiện tại', '[API] Mật khẩu hiện tại là null / không gửi trường passwordOld bị từ chối', 'Bảo mật', 'Cao',
    '1. PUT với passwordOld=null, passwordNew hợp lệ\n2. PUT với body chỉ có passwordNew\n3. Nếu trả 200: khôi phục mật khẩu gốc', 'Cả hai lần HTTP 400; mật khẩu không bị đổi',
    'Khảo sát: passwordOld=null → HTTP 200 đã đổi mật khẩu → nghi lỗi. Case tự khôi phục mật khẩu');
  c('CPW-A05', 'AUTH.3-UC3', 'Mật khẩu hiện tại', '[API] Mật khẩu hiện tại chỉ gồm khoảng trắng bị từ chối', 'Validate', 'Trung bình',
    '1. PUT với passwordOld="   ", passwordNew hợp lệ', 'HTTP 400 "Mật khẩu cũ không chính xác"; mật khẩu không đổi');
  c('CPW-A06', 'AUTH.3-UC3', 'Mật khẩu mới', '[API] Mật khẩu mới rỗng hoặc thiếu bị từ chối', 'Validate', 'Cao',
    `1. PUT với passwordNew="" (passwordOld="${BAD}")\n2. PUT với body rỗng {}`, 'Cả hai lần HTTP 400 "Vui lòng nhập mật khẩu mới"; không lỗi 500');
  c('CPW-A07', 'AUTH.3-UC3', 'Mật khẩu mới', '[API] Mật khẩu mới quá ngắn ("abc") bị từ chối', 'Bảo mật', 'Cao',
    '1. PUT với passwordOld="" và passwordNew="abc" (token canbo)\n2. Nếu trả 200: khôi phục mật khẩu gốc', 'HTTP 400, báo mật khẩu chưa đáp ứng yêu cầu; mật khẩu không đổi',
    'Khảo sát: HTTP 200 → server KHÔNG kiểm chính sách mật khẩu, chỉ UI chặn → nghi lỗi (gọi API trực tiếp qua mặt được chính sách). Case tự khôi phục mật khẩu');
  c('CPW-A08', 'AUTH.3-UC3', 'Mật khẩu mới', '[API] Mật khẩu mới chỉ gồm số ("12345678") bị từ chối theo độ phức tạp', 'Bảo mật', 'Cao',
    '1. PUT với passwordOld="" và passwordNew="12345678"\n2. Nếu trả 200: khôi phục mật khẩu gốc', 'HTTP 400, báo mật khẩu chưa đáp ứng yêu cầu; mật khẩu không đổi',
    'Khảo sát: HTTP 200 → nghi lỗi (cùng nguyên nhân CPW-A07). Case tự khôi phục mật khẩu');
  c('CPW-A09', 'AUTH.3-UC3', 'Mật khẩu mới', '[API] Mật khẩu mới chứa tên đăng nhập bị từ chối', 'Bảo mật', 'Trung bình',
    '1. PUT với passwordOld="" và passwordNew="qc.canbo!A1"\n2. Nếu trả 200: khôi phục mật khẩu gốc', 'HTTP 400, báo mật khẩu chưa đáp ứng yêu cầu; mật khẩu không đổi',
    'Khảo sát: HTTP 200 → nghi lỗi (cùng nguyên nhân CPW-A07). Case tự khôi phục mật khẩu');
  c('CPW-A10', 'AUTH.3-UC3', 'Mật khẩu mới', '[API] Mật khẩu mới 129 ký tự bị từ chối', 'Validate', 'Trung bình',
    '1. PUT với passwordOld="" (để qua bước kiểm tra mật khẩu cũ) và passwordNew = "Aa1!" + 125 chữ "a" (129 ký tự)\n2. Nếu trả 200: khôi phục mật khẩu gốc', 'HTTP 400 "Không được nhập vượt quá 128 ký tự"; mật khẩu không đổi', 'Khảo sát: server kiểm tra mật khẩu cũ TRƯỚC độ dài mật khẩu mới; với mật khẩu cũ sai chỉ thấy lỗi mật khẩu cũ. Case tự khôi phục mật khẩu');

  // --- UC4 Bảo mật ---
  c('CPW-S01', 'AUTH.3-UC4', 'Phân quyền', '[API] Đổi mật khẩu không có token bị từ chối 401', 'Bảo mật', 'Cao',
    `1. PUT /idm/users/{id}/password không gửi header Authorization (body passwordOld="${BAD}")`, 'HTTP 401; không đổi mật khẩu');
  c('CPW-S02', 'AUTH.3-UC4', 'Phân quyền', '[API] Đổi mật khẩu với token giả bị từ chối 401', 'Bảo mật', 'Cao',
    '1. PUT với Authorization: Bearer abc.def.ghi', 'HTTP 401; không đổi mật khẩu');
  c('CPW-S03', 'AUTH.3-UC4', 'Phân quyền', '[API] Không đổi được mật khẩu của người dùng khác bằng token của mình', 'Bảo mật', 'Cao',
    `1. Dùng token canbo, PUT /idm/users/{id của một người dùng KHÁC}/password với passwordOld="${BAD}"`, 'Bị từ chối 403/404 (không phải 400 "Mật khẩu cũ không chính xác"); mật khẩu người khác không đổi',
    'Khảo sát: với id người dùng KHÁC đang tồn tại (qc.ldd) API trả 400 "Mật khẩu cũ không chính xác" — tức không chặn quyền, chỉ kiểm mật khẩu cũ của chính người đó → nghi lỗi nghiêm trọng (IDOR); kết hợp lỗi CPW-A03 (mật khẩu cũ rỗng được chấp nhận) có thể đổi mật khẩu của bất kỳ ai. Chỉ dùng mật khẩu cũ sai, KHÔNG khai thác thật; id đã xóa/không tồn tại thì 404');
  c('CPW-S04', 'AUTH.3-UC4', 'Phân quyền', '[API] Id người dùng không tồn tại hoặc sai định dạng trả lỗi có kiểm soát', 'Bảo mật', 'Trung bình',
    `1. PUT /idm/users/00000000-0000-0000-0000-000000000000/password\n2. PUT /idm/users/abc/password (passwordOld="${BAD}")`, 'HTTP 404 "Không tìm thấy người dùng" hoặc 400; không lỗi 500, không lộ stack trace');
  c('CPW-S05', 'AUTH.3-UC4', 'Chống tấn công', 'Ký tự đặc biệt / SQL / script trong mật khẩu hiện tại không gây lỗi hệ thống', 'Bảo mật', 'Cao',
    "1. Nhập mật khẩu hiện tại \"' OR 1=1 --\" rồi \"<script>alert(1)</script>\"; mật khẩu mới hợp lệ, xác nhận khớp\n2. Bấm \"Cập nhật mật khẩu\" sau mỗi lần", 'Cả hai lần báo "Mật khẩu cũ không chính xác"; không lỗi 500, không thực thi script, không đổi mật khẩu');
  c('CPW-S06', 'AUTH.3-UC4', 'Chống tấn công', 'Mật khẩu chỉ gửi trong body, không nằm trên URL và không xuất hiện trong phản hồi', 'Bảo mật', 'Trung bình',
    `${OPEN}\n4. Nhập mật khẩu hiện tại sai "${BAD}", mới "Moi!123456a", xác nhận khớp; bấm "Cập nhật mật khẩu"\n5. Quan sát request/response`, 'Request là PUT, URL không chứa mật khẩu, mật khẩu nằm trong body; phản hồi không chứa mật khẩu hay hash');
  m('CPW-S07', 'AUTH.3-UC4', 'Chống tấn công', 'Nhập sai mật khẩu hiện tại nhiều lần liên tiếp bị giới hạn', 'Bảo mật', 'Cao',
    `1. Đổi mật khẩu với mật khẩu hiện tại sai 10 lần liên tiếp\n2. Đổi mật khẩu với mật khẩu hiện tại đúng`, 'Bị khóa tạm hoặc giới hạn tần suất; có thông báo rõ ràng', BA + ' số lần và thời gian khóa',
    'Manual — dễ làm khóa tài khoản dùng chung; chạy trên tài khoản dùng một lần');

  // --- UC5 Luồng & lỗi ---
  c('CPW-G01', 'AUTH.3-UC5', 'Lỗi hệ thống', 'Lỗi máy chủ (500) khi cập nhật: hiển thị lỗi, hộp thoại vẫn mở, không báo thành công', 'Nghiệp vụ', 'Trung bình',
    `${OPEN}\n4. Giả lập API PUT …/password trả HTTP 500\n5. Nhập mật khẩu hiện tại sai, mới và xác nhận hợp lệ; bấm "Cập nhật mật khẩu"`, 'Có thông báo lỗi; hộp thoại không đóng; không hiện "Đổi mật khẩu thành công"; không lộ chi tiết nội bộ');
  c('CPW-G02', 'AUTH.3-UC5', 'Lỗi hệ thống', 'Mất kết nối mạng khi cập nhật: hiển thị lỗi, người dùng thao tác lại được', 'Nghiệp vụ', 'Trung bình',
    `${OPEN}\n4. Nhập dữ liệu hợp lệ (mật khẩu hiện tại sai)\n5. Ngắt mạng rồi bấm "Cập nhật mật khẩu"\n6. Bật mạng, bấm lại`, 'Có thông báo lỗi kết nối, hộp thoại không treo; sau khi có mạng bấm lại gửi được request',
    'Khảo sát: mất mạng thì bấm Cập nhật không có thông báo nào (im lặng), hộp thoại vẫn mở → nghi lỗi (người dùng không biết thao tác thất bại)');
  c('CPW-G03', 'AUTH.3-UC5', 'Thao tác lặp', 'Bấm "Cập nhật mật khẩu" nhiều lần liên tiếp chỉ gửi một request', 'Nghiệp vụ', 'Trung bình',
    `${OPEN}\n4. Nhập dữ liệu hợp lệ (mật khẩu hiện tại sai); làm chậm API 3 giây\n5. Bấm "Cập nhật mật khẩu" 3 lần liên tiếp`, 'Chỉ có 1 request PUT được gửi; nút bị khóa/hiện trạng thái đang xử lý trong lúc chờ');

  // --- UC6 Sau khi đổi mật khẩu (cần mật khẩu cũ đúng → Manual) ---
  m('CPW-M01', 'AUTH.3-UC6', 'Đổi mật khẩu', 'Đổi mật khẩu thành công trọn luồng trên giao diện', 'Chức năng', 'Cao',
    '1. Đăng nhập bằng tài khoản dùng một lần\n2. Thông tin cá nhân → Đổi mật khẩu\n3. Nhập mật khẩu hiện tại đúng, mật khẩu mới "Moi!123456a" hợp lệ, xác nhận khớp\n4. Bấm "Cập nhật mật khẩu"', 'Hiện thông báo "Đổi mật khẩu thành công"; hộp thoại đóng; vẫn ở trang Thông tin cá nhân');
  m('CPW-M02', 'AUTH.3-UC6', 'Sau khi đổi', 'Sau khi đổi, đăng nhập được bằng mật khẩu mới', 'Chức năng', 'Cao',
    '1. Sau CPW-M01, đăng xuất\n2. Đăng nhập bằng mật khẩu mới (captcha đúng)', 'Đăng nhập thành công', '', CAP);
  m('CPW-M03', 'AUTH.3-UC6', 'Sau khi đổi', 'Sau khi đổi, mật khẩu cũ không còn đăng nhập được', 'Bảo mật', 'Cao',
    '1. Sau CPW-M01, đăng xuất\n2. Đăng nhập bằng mật khẩu cũ (captcha đúng)', 'Bị từ chối sai mật khẩu', '', CAP);
  m('CPW-M04', 'AUTH.3-UC6', 'Sau khi đổi', 'Sau khi đổi, phiên hiện tại vẫn dùng được, phiên trên thiết bị khác bị đăng xuất', 'Bảo mật', 'Cao',
    '1. Đăng nhập cùng tài khoản trên 2 trình duyệt A và B\n2. Ở A đổi mật khẩu thành công\n3. Ở A thao tác tiếp\n4. Ở B thao tác tiếp (đổi trang/gọi API)', 'A vẫn dùng bình thường; B bị đưa về trang đăng nhập / API trả 401 (đúng như ghi chú trên hộp thoại)',
    'Khảo sát: sau khi đổi, token đang dùng vẫn hợp lệ; chưa xác minh được phiên khác bị thu hồi (không có token thứ hai) → nghi lỗi nếu B vẫn dùng được', CAP);
  m('CPW-M05', 'AUTH.3-UC6', 'Đổi mật khẩu', 'Mật khẩu mới trùng mật khẩu hiện tại bị từ chối', 'Nghiệp vụ', 'Trung bình',
    '1. Mở Đổi mật khẩu\n2. Nhập mật khẩu hiện tại đúng và dùng đúng giá trị đó làm mật khẩu mới + xác nhận\n3. Bấm "Cập nhật mật khẩu"', 'Bị từ chối với thông báo mật khẩu mới phải khác mật khẩu hiện tại', BA + ' có cấm trùng mật khẩu cũ hay không');
  m('CPW-M06', 'AUTH.3-UC6', 'Đổi mật khẩu', 'Mật khẩu mới đúng 128 ký tự được chấp nhận', 'Validate', 'Trung bình',
    '1. Mở Đổi mật khẩu\n2. Nhập mật khẩu hiện tại đúng; mật khẩu mới 128 ký tự hợp lệ ("Aa1!" + 124 chữ "a"), xác nhận khớp\n3. Bấm "Cập nhật mật khẩu"\n4. Đăng xuất, đăng nhập lại bằng mật khẩu 128 ký tự', 'Đổi thành công và đăng nhập lại được');
  m('CPW-M07', 'AUTH.3-UC6', 'Đổi mật khẩu', 'Không cho dùng lại các mật khẩu gần đây', 'Nghiệp vụ', 'Thấp',
    '1. Đổi mật khẩu từ A sang B\n2. Đổi tiếp từ B về A', 'Bị từ chối nếu hệ thống có chính sách lịch sử mật khẩu', BA + ' có chính sách lịch sử mật khẩu hay không');

  // ===================== AUTH.4 ĐĂNG XUẤT =====================
  const MENU = '1. Đăng nhập (canbo)\n2. Bấm vào tên người dùng ở góc dưới sidebar';
  const ASK = `${MENU}\n3. Chọn "Đăng xuất"`;
  const KEYS = 'localStorage chỉ còn khóa ngôn ngữ (i18nextLng), mọi khóa phiên/token bị xóa';
  // --- UC1 Menu & hộp thoại xác nhận ---
  c('LGO-L01', 'AUTH.4-UC1', 'Menu người dùng', 'Menu người dùng có "Thông tin cá nhân" và "Đăng xuất"', 'Chức năng', 'Cao',
    MENU, 'Menu bật lên có hai mục: "Thông tin cá nhân" và "Đăng xuất" (màu đỏ, có biểu tượng); sidebar hiển thị tên và tên đăng nhập của người đang dùng');
  c('LGO-L02', 'AUTH.4-UC1', 'Hộp thoại xác nhận', 'Chọn "Đăng xuất" hiện hộp thoại xác nhận, chưa đăng xuất ngay', 'Chức năng', 'Cao',
    ASK, 'Hiện hộp thoại "Đăng xuất khỏi hệ thống?" – "Phiên làm việc của bạn sẽ kết thúc." với hai nút Không và Có; vẫn ở trang hiện tại, phiên còn nguyên');
  c('LGO-L03', 'AUTH.4-UC1', 'Hộp thoại xác nhận', 'Bấm "Không" đóng hộp thoại và giữ nguyên phiên làm việc', 'Chức năng', 'Cao',
    ASK + '\n4. Bấm "Không"\n5. Thao tác tiếp (mở một trang khác)', 'Hộp thoại đóng; không chuyển trang; token vẫn còn trong localStorage; vẫn dùng được hệ thống');
  c('LGO-L04', 'AUTH.4-UC1', 'Hộp thoại xác nhận', 'Nhấn Esc đóng hộp thoại và không đăng xuất', 'Chức năng', 'Trung bình',
    ASK + '\n4. Nhấn phím Esc', 'Hộp thoại đóng; phiên còn nguyên; không chuyển trang');
  c('LGO-L05', 'AUTH.4-UC1', 'Hộp thoại xác nhận', 'Mở hộp thoại đăng xuất nhiều lần liên tiếp không lỗi', 'Chức năng', 'Thấp',
    `${MENU}\n3. Chọn "Đăng xuất" → "Không"; lặp lại 3 lần`, 'Mỗi lần hộp thoại mở/đóng đúng; không xuất hiện nhiều hộp thoại chồng nhau; không lỗi console');

  // --- UC2 Kết thúc phiên ---
  c('LGO-D01', 'AUTH.4-UC2', 'Đăng xuất', 'Bấm "Có" đưa về trang đăng nhập và xóa phiên', 'Chức năng', 'Cao',
    ASK + '\n4. Bấm "Có"', `Chuyển sang /#/vi/auth/login hiển thị form đăng nhập; ${KEYS}`);
  c('LGO-D02', 'AUTH.4-UC2', 'Đăng xuất', 'Sau khi đăng xuất, nút Back không quay lại được trang nghiệp vụ', 'Bảo mật', 'Cao',
    ASK + '\n4. Bấm "Có"\n5. Bấm nút Back của trình duyệt', 'Vẫn ở trang đăng nhập; không hiển thị lại dữ liệu trang nghiệp vụ', 'Bản Auto của LGN-M13 (không cần captcha vì dùng session đã lưu)');
  c('LGO-D03', 'AUTH.4-UC2', 'Đăng xuất', 'Sau khi đăng xuất, mở thẳng URL trang nghiệp vụ bị chuyển về đăng nhập', 'Bảo mật', 'Cao',
    ASK + '\n4. Bấm "Có"\n5. Gõ trực tiếp URL /#/vi/profile và /#/vi/dashboard-demo', 'Cả hai URL đều chuyển về trang đăng nhập; không thấy dữ liệu',
    'Khảo sát: nếu điều hướng NGAY (<1 giây) sau khi đăng xuất thì trang trắng và URL kẹt ở /profile (không về đăng nhập); chờ ~1,5 giây thì chuyển đúng → nghi lỗi nhẹ (race). Script chờ 1,5 giây như người dùng thật');
  c('LGO-D04', 'AUTH.4-UC2', 'Đăng xuất', 'Sau khi đăng xuất, tải lại trang (F5) vẫn ở trang đăng nhập', 'Bảo mật', 'Trung bình',
    ASK + '\n4. Bấm "Có"\n5. Tải lại trang', 'Vẫn ở trang đăng nhập; không tự đăng nhập lại');
  c('LGO-D05', 'AUTH.4-UC2', 'Đăng xuất', 'Có thể đăng xuất từ trang chức năng bất kỳ, không chỉ từ trang chủ', 'Chức năng', 'Trung bình',
    '1. Đăng nhập (admin)\n2. Mở trang Người dùng\n3. Đăng xuất qua menu người dùng → "Có"', 'Về trang đăng nhập, phiên bị xóa như LGO-D01');
  c('LGO-D06', 'AUTH.4-UC2', 'Đăng xuất', 'Form đăng nhập sau đăng xuất sạch dữ liệu của phiên trước', 'Bảo mật', 'Trung bình',
    ASK + '\n4. Bấm "Có"\n5. Quan sát form đăng nhập', 'Ô Tên đăng nhập, Mật khẩu, Mã xác nhận đều rỗng; ảnh captcha mới được tải; không hiện tên người dùng cũ');
  c('LGO-D07', 'AUTH.4-UC2', 'Đăng xuất', 'Đăng xuất được với mọi vai trò (kể cả vai trò chỉ xem)', 'Nghiệp vụ', 'Thấp',
    '1. Lần lượt đăng nhập superadmin, ldd, xemonly\n2. Đăng xuất qua menu người dùng → "Có"', 'Cả ba vai trò đều về trang đăng nhập và xóa phiên');

  // --- UC3 Bảo mật ---
  c('LGO-S01', 'AUTH.4-UC3', 'Thu hồi token', '[API] Token cũ bị vô hiệu sau khi đăng xuất', 'Bảo mật', 'Cao',
    ASK + '\n4. Ghi lại token trước khi đăng xuất, bấm "Có"\n5. Gọi GET /idm/users/info bằng token đã ghi', 'HTTP 401 (token đã bị thu hồi phía máy chủ)',
    'Khảo sát: UI chỉ xóa localStorage, không gọi API thu hồi → token cũ vẫn dùng được (HTTP 200) tới khi hết hạn → nghi lỗi (token bị lộ vẫn dùng được sau khi người dùng đăng xuất)');
  c('LGO-S02', 'AUTH.4-UC3', 'Thu hồi token', 'Đăng xuất không để lại token trong sessionStorage / cookie', 'Bảo mật', 'Trung bình',
    ASK + '\n4. Bấm "Có"\n5. Kiểm tra localStorage, sessionStorage, cookie', `${KEYS}; sessionStorage rỗng; không còn cookie phiên`);
  m('LGO-S03', 'AUTH.4-UC3', 'Nhiều tab', 'Đăng xuất ở một tab thì tab khác đang mở bị đưa về đăng nhập khi thao tác', 'Bảo mật', 'Trung bình',
    '1. Đăng nhập, mở hệ thống ở hai tab A và B\n2. Ở tab A đăng xuất\n3. Ở tab B bấm đổi trang / thao tác', 'Tab B bị chuyển về trang đăng nhập, không hiển thị dữ liệu nghiệp vụ mới', BA + ' cách đồng bộ giữa các tab',
    'Manual — cần quan sát tương tác hai tab thật; chưa khảo sát hành vi');
  m('LGO-S04', 'AUTH.4-UC3', 'Phiên', 'Đăng xuất rồi đăng nhập bằng tài khoản khác thì không lẫn quyền/dữ liệu của tài khoản trước', 'Bảo mật', 'Cao',
    '1. Đăng nhập admin, mở vài trang\n2. Đăng xuất\n3. Đăng nhập bằng tài khoản vai trò thấp hơn (captcha đúng)', 'Menu và quyền hiển thị đúng theo tài khoản mới; không còn dữ liệu/menu của admin', '', CAP);
  m('LGO-S05', 'AUTH.4-UC3', 'Phiên', 'Tự động đăng xuất khi token hết hạn hoặc không hoạt động quá lâu', 'Bảo mật', 'Trung bình',
    '1. Đăng nhập\n2. Chờ tới khi token hết hạn / hết thời gian không hoạt động\n3. Thao tác tiếp', 'Được đưa về trang đăng nhập với thông báo phù hợp; không lỗi trắng trang', BA + ' thời hạn phiên',
    'Manual — phải chờ hết hạn token (thời hạn dài)');

  // --- UC4 Lỗi ---
  c('LGO-G01', 'AUTH.4-UC4', 'Lỗi hệ thống', 'Mất kết nối mạng vẫn đăng xuất được ở phía trình duyệt', 'Nghiệp vụ', 'Trung bình',
    ASK + '\n4. Ngắt mạng\n5. Bấm "Có"', 'Về trang đăng nhập và xóa phiên; không treo, không lỗi trắng trang',
    'Khảo sát: đăng xuất không gọi API nên không phụ thuộc mạng; nếu sau này gọi API thu hồi token (xem LGO-S01) vẫn phải đăng xuất được khi API lỗi');
  c('LGO-G02', 'AUTH.4-UC4', 'Thao tác lặp', 'Bấm "Có" nhiều lần liên tiếp không gây lỗi', 'Chức năng', 'Thấp',
    ASK + '\n4. Bấm "Có" liên tiếp 3 lần thật nhanh', 'Chỉ đăng xuất một lần, về trang đăng nhập; không lỗi console, không lặp chuyển hướng');
}
