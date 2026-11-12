// BẢNG TRUY VẾT ATTT CẤP ĐỘ 2: Mã YC (sheet "ATTT mức 2", Danh sách công việc_CĐS - BCT.xlsx) → điều kiện theo từng phân hệ → testcase.
// Mỗi dòng sheet = 1 yêu cầu (kể cả dòng Hồ sơ/Hạ tầng). Yêu cầu áp dụng "Toàn hệ thống (BE)" phải có testcase ở MỌI phân hệ
// (ATA/ATB/ATC/ATE, thêm ATU nếu liên quan xác thực) — thiếu ở phân hệ nào trace-check báo lỗ hổng ở phân hệ đó.
// Testcase gắn Mã YC qua cột uc = "ATTT <Mã YC>[; …]" ở catalog-ATTT.mjs; kèm tham chiếu các testcase đã có (LGN/CPW/RPW/LGO/USR…).
import T from './catalog.mjs';
// [Mã YC, dòng trong sheet, Nhóm – Hạng mục, Màn hình]
const ROWS = [
  ["QL 1.1.1", 6, "Thiết lập chính sách ATTT – Chính sách an toàn thông tin", "—"],
  ["QL 1.1.2", 7, "Thiết lập chính sách ATTT – Xây dựng và công bố", "—"],
  ["QL 1.1.3", 8, "Thiết lập chính sách ATTT – Rà soát, sửa đổi", "—"],
  ["QL 1.2.1", 9, "Tổ chức bảo đảm ATTT – Đơn vị chuyên trách về ATTT", "—"],
  ["QL 1.2.2", 10, "Tổ chức bảo đảm ATTT – Phối hợp với cơ quan/tổ chức có thẩm quyền", "—"],
  ["QL 1.3.1", 11, "Bảo đảm nguồn nhân lực – Tuyển dụng", "—"],
  ["QL 1.3.2", 12, "Bảo đảm nguồn nhân lực – Trong quá trình làm việc", "—"],
  ["QL 1.3.3", 13, "Bảo đảm nguồn nhân lực – Chấm dứt hoặc thay đổi công việc", "Người dùng; Nhóm người dùng"],
  ["QL 1.4.1", 14, "Quản lý thiết kế, xây dựng hệ thống – Thiết kế an toàn HTTT", "—"],
  ["QL 1.4.2", 15, "Quản lý thiết kế, xây dựng hệ thống – Phát triển phần mềm thuê khoán", "—"],
  ["QL 1.4.3", 16, "Quản lý thiết kế, xây dựng hệ thống – Thử nghiệm và nghiệm thu hệ thống", "—"],
  ["QL 1.5.1", 17, "Quản lý vận hành hệ thống – Quản lý an toàn mạng", "—"],
  ["QL 1.5.2", 18, "Quản lý vận hành hệ thống – Quản lý an toàn máy chủ và ứng dụng", "—"],
  ["QL 1.5.3", 19, "Quản lý vận hành hệ thống – Quản lý an toàn dữ liệu", "—"],
  ["QL 1.5.4", 20, "Quản lý vận hành hệ thống – Quản lý sự cố ATTT", "—"],
  ["QL 1.5.5", 21, "Quản lý vận hành hệ thống – Quản lý an toàn người sử dụng đầu cuối", "—"],
  ["QL 1.6", 22, "Phương án quản lý rủi ro ATTT – Phương án quản lý rủi ro ATTT", "—"],
  ["QL 1.7", 23, "Phương án kết thúc vận hành – Kết thúc vận hành, khai thác, thanh lý, hủy bỏ", "—"],
  ["TK a", 25, "Thiết kế hệ thống – Phân vùng mạng", "—"],
  ["TK b.i", 26, "Thiết kế hệ thống – Quản trị từ xa an toàn", "—"],
  ["TK b.ii", 27, "Thiết kế hệ thống – Kiểm soát giữa các vùng mạng, chống xâm nhập", "—"],
  ["TK b.iii", 28, "Thiết kế hệ thống – Phòng chống mã độc", "—"],
  ["TK b.iv", 29, "Thiết kế hệ thống – Bảo vệ ứng dụng web", "—"],
  ["TK b.v", 30, "Thiết kế hệ thống – Hệ thống thư điện tử", "—"],
  ["TK b.vi", 31, "Thiết kế hệ thống – Dự phòng thiết bị mạng chính", "—"],
  ["KT 1.1.1a", 34, "Bảo đảm an toàn mạng – Kiểm soát truy cập từ bên ngoài mạng", "—"],
  ["KT 1.1.1b", 35, "Bảo đảm an toàn mạng – Kiểm soát truy cập từ bên ngoài mạng", "—"],
  ["KT 1.1.1c", 36, "Bảo đảm an toàn mạng – Kiểm soát truy cập từ bên ngoài mạng", "—"],
  ["KT 1.1.2", 37, "Bảo đảm an toàn mạng – Kiểm soát truy cập từ bên trong mạng", "—"],
  ["KT 1.1.3a", 38, "Bảo đảm an toàn mạng – Nhật ký hệ thống", "—"],
  ["KT 1.1.3b", 39, "Bảo đảm an toàn mạng – Nhật ký hệ thống", "—"],
  ["KT 1.1.4a", 40, "Bảo đảm an toàn mạng – Phòng chống xâm nhập", "—"],
  ["KT 1.1.4b", 41, "Bảo đảm an toàn mạng – Phòng chống xâm nhập", "—"],
  ["KT 1.1.5a", 42, "Bảo đảm an toàn mạng – Bảo vệ thiết bị hệ thống", "—"],
  ["KT 1.1.5b", 43, "Bảo đảm an toàn mạng – Bảo vệ thiết bị hệ thống", "—"],
  ["KT 1.1.5c", 44, "Bảo đảm an toàn mạng – Bảo vệ thiết bị hệ thống", "—"],
  ["KT 1.2.1a", 46, "Bảo đảm an toàn máy chủ – Xác thực", "—"],
  ["KT 1.2.1b", 47, "Bảo đảm an toàn máy chủ – Xác thực", "Toàn hệ thống (BE)"],
  ["KT 1.2.1c", 48, "Bảo đảm an toàn máy chủ – Xác thực", "—"],
  ["KT 1.2.2a", 49, "Bảo đảm an toàn máy chủ – Kiểm soát truy cập", "—"],
  ["KT 1.2.2b", 50, "Bảo đảm an toàn máy chủ – Kiểm soát truy cập", "—"],
  ["KT 1.2.3a", 51, "Bảo đảm an toàn máy chủ – Nhật ký hệ thống", "—"],
  ["KT 1.2.3b", 52, "Bảo đảm an toàn máy chủ – Nhật ký hệ thống", "—"],
  ["KT 1.2.3c", 53, "Bảo đảm an toàn máy chủ – Nhật ký hệ thống", "—"],
  ["KT 1.2.4a", 54, "Bảo đảm an toàn máy chủ – Phòng chống xâm nhập", "—"],
  ["KT 1.2.4b", 55, "Bảo đảm an toàn máy chủ – Phòng chống xâm nhập", "—"],
  ["KT 1.2.4c", 56, "Bảo đảm an toàn máy chủ – Phòng chống xâm nhập", "—"],
  ["KT 1.2.4d", 57, "Bảo đảm an toàn máy chủ – Phòng chống xâm nhập", "—"],
  ["KT 1.2.5a", 58, "Bảo đảm an toàn máy chủ – Phòng chống phần mềm độc hại", "—"],
  ["KT 1.2.5b", 59, "Bảo đảm an toàn máy chủ – Phòng chống phần mềm độc hại", "—"],
  ["KT 1.2.6", 60, "Bảo đảm an toàn máy chủ – Xử lý máy chủ khi chuyển giao", "—"],
  ["KT 1.3.1a", 62, "Bảo đảm an toàn ứng dụng – Xác thực", "Đăng nhập; Người dùng; Toàn hệ thống (BE)"],
  ["KT 1.3.1b", 63, "Bảo đảm an toàn ứng dụng – Xác thực", "Toàn hệ thống (BE)"],
  ["KT 1.3.1c-1", 64, "Bảo đảm an toàn ứng dụng – Xác thực – an toàn mật khẩu", "Người dùng; Đổi mật khẩu bắt buộc"],
  ["KT 1.3.1c-2", 65, "Bảo đảm an toàn ứng dụng – Xác thực – an toàn mật khẩu", "Tham số hệ thống; Đổi mật khẩu bắt buộc; Thông tin cá nhân; Quên mật khẩu; Người dùng"],
  ["KT 1.3.1c-3", 66, "Bảo đảm an toàn ứng dụng – Xác thực – an toàn mật khẩu", "Tham số hệ thống; Đổi mật khẩu bắt buộc; Thông tin cá nhân"],
  ["KT 1.3.1c-4", 67, "Bảo đảm an toàn ứng dụng – Xác thực – an toàn mật khẩu", "Tham số hệ thống; Đăng nhập; Đổi mật khẩu bắt buộc"],
  ["KT 1.3.1d", 68, "Bảo đảm an toàn ứng dụng – Xác thực", "Tham số hệ thống; Đăng nhập; Người dùng"],
  ["KT 1.3.2a", 69, "Bảo đảm an toàn ứng dụng – Kiểm soát truy cập", "Toàn hệ thống (BE)"],
  ["KT 1.3.2b", 70, "Bảo đảm an toàn ứng dụng – Kiểm soát truy cập", "Tham số hệ thống; Toàn hệ thống (BE)"],
  ["KT 1.3.2c", 71, "Bảo đảm an toàn ứng dụng – Kiểm soát truy cập", "Tham số hệ thống"],
  ["KT 1.3.3a-1", 72, "Bảo đảm an toàn ứng dụng – Nhật ký hệ thống", "Nhật ký truy cập; Toàn hệ thống (BE)"],
  ["KT 1.3.3a-2", 73, "Bảo đảm an toàn ứng dụng – Nhật ký hệ thống", "Nhật ký truy cập; Đăng nhập"],
  ["KT 1.3.3a-3", 74, "Bảo đảm an toàn ứng dụng – Nhật ký hệ thống", "Nhật ký truy cập; Toàn hệ thống (BE)"],
  ["KT 1.3.3a-4", 75, "Bảo đảm an toàn ứng dụng – Nhật ký hệ thống", "Nhật ký truy cập; Tham số hệ thống; Ma trận phân quyền; Sao lưu"],
  ["KT 1.3.3b", 76, "Bảo đảm an toàn ứng dụng – Nhật ký hệ thống", "Tham số hệ thống; Nhật ký truy cập"],
  ["NK-01", 78, "Bảo đảm an toàn ứng dụng – Nhật ký – Phân loại", "Nhật ký truy cập"],
  ["NK-02", 79, "Bảo đảm an toàn ứng dụng – Nhật ký – Cột hiển thị", "Nhật ký truy cập"],
  ["NK-03", 80, "Bảo đảm an toàn ứng dụng – Nhật ký – Tìm kiếm, lọc", "Nhật ký truy cập"],
  ["NK-04", 81, "Bảo đảm an toàn ứng dụng – Nhật ký – Xem chi tiết", "Nhật ký truy cập"],
  ["NK-05", 82, "Bảo đảm an toàn ứng dụng – Nhật ký – Xuất Excel", "Nhật ký truy cập"],
  ["NK-06", 83, "Bảo đảm an toàn ứng dụng – Nhật ký – Chỉ ghi thêm", "Nhật ký truy cập"],
  ["NK-07", 84, "Bảo đảm an toàn ứng dụng – Nhật ký – Địa chỉ IP", "Nhật ký truy cập; Toàn hệ thống (BE)"],
  ["NK-08", 85, "Bảo đảm an toàn ứng dụng – Nhật ký – Dữ liệu nhạy cảm", "Nhật ký truy cập; Toàn hệ thống (BE)"],
  ["NK-09", 86, "Bảo đảm an toàn ứng dụng – Nhật ký – Thời gian", "Nhật ký truy cập"],
  ["NK-10", 87, "Bảo đảm an toàn ứng dụng – Nhật ký – Thời gian lưu", "Nhật ký truy cập; Tham số hệ thống"],
  ["NK-11", 88, "Bảo đảm an toàn ứng dụng – Nhật ký – Phân quyền xem", "Nhật ký truy cập; Ma trận phân quyền"],
  ["NK-12", 89, "Bảo đảm an toàn ứng dụng – Nhật ký – Cấu trúc dữ liệu", "Nhật ký truy cập"],
  ["KT 1.3.4", 90, "Bảo đảm an toàn ứng dụng – An toàn ứng dụng và mã nguồn", "Toàn hệ thống (BE)"],
  ["UD 742-4.4", 91, "Bảo đảm an toàn ứng dụng – An toàn ứng dụng và mã nguồn", "Toàn hệ thống (BE)"],
  ["KT 1.4.1", 93, "Bảo đảm an toàn dữ liệu – Bảo mật dữ liệu", "Toàn hệ thống (BE); Sao lưu"],
  ["KT 1.4.2", 94, "Bảo đảm an toàn dữ liệu – Sao lưu dự phòng", "Sao lưu"],
  ["PM 1", 96, "Phần mềm nội bộ – Khung phát triển phần mềm an toàn", "—"],
  ["PM 2a", 97, "Phần mềm nội bộ – Tài liệu", "—"],
  ["PM 2b", 98, "Phần mềm nội bộ – Tài liệu", "—"],
  ["PM 2c", 99, "Phần mềm nội bộ – Tài liệu", "—"],
  ["PM 2d", 100, "Phần mềm nội bộ – Tài liệu", "—"],
  ["PM 3", 101, "Phần mềm nội bộ – Quản lý điểm yếu ATTT", "—"],
  ["HS 1", 103, "Hồ sơ cấp độ – Hồ sơ đề xuất cấp độ", "—"],
  ["HS 2", 104, "Hồ sơ cấp độ – Quy chế bảo đảm ATTT", "—"],
  ["HS 3", 105, "Hồ sơ cấp độ – Thời điểm phê duyệt hồ sơ", "—"],
  ["HS 4", 106, "Hồ sơ cấp độ – Triển khai trước khi vận hành", "—"],
  ["HS 5", 107, "Vận hành – Kiểm tra, đánh giá ATTT", "—"],
  ["HS 6", 108, "Vận hành – Chế độ báo cáo", "—"],
];
const PH = { ATA: 'Phân hệ A', ATB: 'Phân hệ B', ATC: 'Phân hệ C', ATE: 'Phân hệ E', ATU: 'AUTH', ATG: 'Hồ sơ & Hạ tầng' };
const BIZ = ['ATA', 'ATB', 'ATC', 'ATE'];
// Yêu cầu bắt buộc kiểm tra trên nhiều phân hệ (ngoài danh sách này: chỉ cần có testcase ở phân hệ đã gắn mã)
const MUST = {
  'KT 1.3.1a': [...BIZ, 'ATU'], 'KT 1.3.1b': [...BIZ, 'ATU'], 'KT 1.3.2a': [...BIZ, 'ATU'], 'KT 1.3.2b': [...BIZ, 'ATU', 'ATA'],
  'KT 1.3.3a-1': BIZ, 'KT 1.3.3a-3': BIZ, 'KT 1.3.4': BIZ, 'NK-02': BIZ, 'NK-08': [...BIZ, 'ATU'], 'PM 3': [...BIZ, 'ATG'], 'UD 742-4.4': [...BIZ, 'ATG'],
  'KT 1.4.1': ['ATA', 'ATC', 'ATE'], 'KT 1.3.1d': ['ATA', 'ATU'], 'KT 1.3.1c-2': ['ATA', 'ATU'], 'KT 1.3.1c-3': ['ATA', 'ATU'], 'KT 1.3.1c-4': ['ATA', 'ATU'],
  'KT 1.3.3a-2': ['ATU'], 'KT 1.3.3a-4': ['ATA', 'ATB'], 'QL 1.3.3': ['ATA', 'ATG'], 'KT 1.2.1b': ['ATA', 'ATG'],
};
// Testcase đã có ở các bộ chức năng, dùng làm bằng chứng bổ sung cho yêu cầu ATTT
const EXIST = {
  'KT 1.3.1a': [['Đã có: chặn không token/token giả ở trang đăng nhập, đổi mật khẩu', 'LGN-S0[123]|CPW-S0[12]']],
  'KT 1.3.1c-1': [['Đã có: đổi mật khẩu lần đầu, cờ bắt buộc đổi mật khẩu khi tạo người dùng', 'LGN-M09|LGN-M10|LGN-M11|USR-C10|USR-C11']],
  'KT 1.3.1c-2': [['Đã có: quy tắc mật khẩu ở Đổi mật khẩu (FE + BE), Quên mật khẩu, Thêm người dùng', 'CPW-V0[6-9]|CPW-V10|CPW-A0[789]|RPW-P0[6-9]|USR-C07|USR-C16']],
  'KT 1.3.1d': [['Đã có: captcha bắt buộc, dùng một lần; giới hạn sai nhiều lần', 'LGN-C0[4-8]|LGN-M14|LGN-M15|CPW-S07|RPW-O14']],
  'KT 1.3.2b': [['Đã có: tự động đăng xuất khi hết hạn / không hoạt động', 'LGO-S05']],
  'QL 1.3.3': [['Đã có: tài khoản khóa không đăng nhập / không lấy OTP; token bị thu hồi', 'LGN-M05|RPW-L07|LGO-S01']],
  'PM 3': [['Đã có: SQLi/XSS ở ô tìm kiếm và dữ liệu có HTML ở các page A', 'USR-L07|GRP-L07|PRV-L07|COM-L07|UTY-L07|ORG-L07|(USR|GRP|PRV|COM|UTY|ORG)-G02']],
};
const codesOf = x => String(x.uc || '').replace(/^ATTT /, '').split(';').map(s => s.trim());
const ids = (P, code) => T.filter(x => x.id.startsWith(P + '-') && x.uc?.startsWith('ATTT ') && codesOf(x).includes(code)).map(x => x.id);

export default (R) => ROWS.map(([code, row, text, screen]) => {
  const need = MUST[code] ?? [];
  const have = Object.keys(PH).filter(P => ids(P, code).length);
  const list = [...new Set([...need, ...have])];
  const conds = list.map(P => [`${PH[P]}: ${text}`, ids(P, code).join('|') || `${P}-KHONG-CO-TESTCASE`]);
  if (!list.length) conds.push([`${text} — chưa gắn testcase ở phân hệ nào`, 'ATTT-KHONG-CO-TESTCASE']);
  return R('ATTT', code, row, `${text}${screen && screen !== '—' ? ` (Màn hình: ${screen})` : ''}`, [...conds, ...(EXIST[code] ?? [])]);
});
