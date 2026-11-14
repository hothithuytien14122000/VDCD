// Testcase BỔ SUNG từ các bug/góp ý đã log trên GitLab — PHÂN HỆ B (Trụ cột, Nhóm chỉ số, Chỉ số, Bộ chỉ số,
// Cấu hình bộ chỉ số, Thang xếp loại, Quản lý tự đánh giá). Chỉ viết case cho hành vi chưa có trong catalog;
// issue đã có case kiểm đúng hành vi thì chỉ truy vết ở requirements-BUG-B.mjs.
// Mỗi case ghi số issue ở cột Ghi chú. Chưa có script automation → Manual.
export default function defineBUG_B(t) {
  // Case đã có script (scripts/B/<page>.spec.ts) → Auto
  const AUTO = new Set(['ATB-V06', 'ATB-V07', 'ATB-V08', 'ATB-V09', 'CMP-C43', 'CMP-C44', 'CMP-C46', 'CMP-C47', 'CMP-E23', 'CMP-L35', 'CMP-L36',
    'CMP-T21', 'CMP-T22', 'CMP-T23', 'CMP-U31', 'CMP-U32', 'CMP-U33', 'CMP-V19', 'CMP-V20', 'IGR-L37', 'IGR-V04', 'IGR-V05', 'IGR-V07', 'IGR-V08',
    'IND-C15', 'IND-C16', 'IND-E13', 'IND-L35', 'IND-N07', 'IND-V04', 'IND-V05', 'IND-V06', 'PIL-L35', 'PIL-V06', 'SCL-C27', 'SCL-C28', 'SCL-C29',
    'SCL-C30', 'SCL-D06', 'SCL-E08', 'SCL-E09', 'SCL-V09', 'SET-C12', 'SET-C13', 'SET-E07', 'SET-I10', 'SET-I11', 'SET-I12', 'SET-I13', 'SET-I14',
    'SET-I15', 'SET-I16', 'SET-I17', 'SET-I18', 'SET-V16', 'SET-V17', 'SET-V18', 'SET-V19']);
  const m = (id, uc, fn, title, type, pri, steps, exp, issue, note = '') =>
    t(id, uc, fn, title, type, pri, steps, exp, AUTO.has(id) ? 'Auto' : 'Manual — chưa có script', `GitLab #${issue}${note ? '. ' + note : ''}`);

  const GO_PIL = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Bộ chỉ số DTI → Trụ cột';
  const GO_IGR = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Bộ chỉ số DTI → Nhóm chỉ số';
  const GO_IND = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Bộ chỉ số DTI → Chỉ số';
  const GO_SET = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Bộ chỉ số DTI → Bộ chỉ số';
  const GO_SCL = '1. Đăng nhập Quản trị hệ thống\n2. Mở menu Bộ chỉ số DTI → Thang xếp loại';
  const GO_CMP = '1. Đăng nhập Cán bộ\n2. Mở menu Bộ chỉ số DTI → Quản lý tự đánh giá';

  // ===================== Trụ cột =====================
  // #201, #240, #250 — các màn TC-01…TC-05 theo design mới
  m('PIL-L34', 'B.I.1-UC1', 'Xem danh sách', 'Các màn Trụ cột (danh sách, thêm, sửa, chi tiết, hộp xác nhận) khớp design TC-01…TC-05', 'UI', 'Trung bình',
    GO_PIL + '\n3. Lần lượt mở danh sách, popup Thêm mới, popup Cập nhật, màn chi tiết, hộp xác nhận Khóa/Xóa\n4. So từng màn với design TC-01…TC-05',
    'Bố cục, tiêu đề, sub title, nút, font, màu sắc, khoảng cách của từng màn trùng design TC-01…TC-05', 240,
    'Cùng nội dung #201 "Cập nhật giao diện các màn theo UI mới" và #250 (đang mở) "Màn hình danh sách trụ cột chưa khớp design"');
  // #249 — cột Tên trụ cột
  m('PIL-L35', 'B.I.1-UC1', 'Xem danh sách', 'Cột Tên trụ cột có màu chữ và font weight đúng design', 'UI', 'Thấp',
    GO_PIL + '\n3. So màu chữ, font weight cột Tên trụ cột với design TC-01',
    'Màu chữ và font weight cột Tên trụ cột trùng design (font weight theo quy ước chung #269: cột thường 400)', 249,
    'Issue đang mở. Giá trị màu cụ thể lấy theo Figma — cần BA/Design xác nhận');
  // #271 — danh sách trụ cột (text button, header, tên cột, màu label trạng thái)
  m('PIL-L36', 'B.I.1-UC1', 'Xem danh sách', 'Text nút thêm mới, tên cột và header bảng Trụ cột đúng design', 'UI', 'Thấp',
    GO_PIL + '\n3. Đọc text nút thêm mới và tiêu đề các cột bảng',
    'Text nút thêm mới, tên từng cột và kiểu header bảng (màu nền, font) trùng design TC-01', 271);
  m('PIL-L37', 'B.I.1-UC1', 'Xem danh sách', 'Label trạng thái Đã khóa / Chưa khóa ở danh sách Trụ cột đúng màu design', 'UI', 'Thấp',
    GO_PIL + '\n3. Xem cột Trạng thái của một trụ cột Đã khóa và một trụ cột Chưa khóa',
    'Màu nền, màu chữ, viền label của từng trạng thái trùng design TC-01', 271);
  // #78, #251 — màn chi tiết trụ cột
  m('PIL-V06', 'B.I.1-UC1', 'Xem chi tiết', 'Màn xem chi tiết Trụ cột có đủ thông tin chung và bảng nhóm chỉ số theo design', 'Chức năng', 'Cao',
    GO_PIL + '\n3. Bấm vào một trụ cột có nhóm chỉ số\n4. So với design TC (màn chi tiết)',
    'Mở màn chi tiết riêng; hiển thị Mã, Tên, Trạng thái, Mô tả, Số nhóm, Số chỉ số, Cập nhật lần cuối và bảng nhóm chỉ số thuộc trụ cột; bố cục trùng design', 78,
    '#251 (đang mở): "Màn hình chi tiết trụ cột chưa khớp design"');

  // ===================== Nhóm chỉ số =====================
  // #202, #241, #272 — các màn NCS-01…NCS-04
  m('IGR-L34', 'B.I.2-UC1', 'Xem danh sách', 'Các màn Nhóm chỉ số (danh sách, thêm, sửa, chi tiết) khớp design NCS-01…NCS-04', 'UI', 'Trung bình',
    GO_IGR + '\n3. Lần lượt mở danh sách, popup Thêm mới, popup Cập nhật, màn chi tiết\n4. So với design NCS-01…NCS-04',
    'Bố cục, tiêu đề, nút, font, màu sắc của từng màn trùng design NCS-01…NCS-04', 241,
    'Cùng nội dung #202 "Cập nhật giao diện các màn theo UI mới" và #272 "Danh sách, popup và cây chỉ số ở màn chi tiết chưa khớp design"');
  // #257 — danh sách nhóm chỉ số
  m('IGR-L35', 'B.I.2-UC1', 'Xem danh sách', 'Placeholder ô tìm kiếm và text nút thêm mới ở danh sách Nhóm chỉ số đúng design', 'UI', 'Thấp',
    GO_IGR + '\n3. Đọc placeholder ô tìm kiếm và text nút thêm mới',
    'Placeholder và text nút trùng design NCS-01', 257, 'Issue đang mở');
  m('IGR-L36', 'B.I.2-UC1', 'Bộ lọc', 'Bộ lọc Trạng thái ở danh sách Nhóm chỉ số hiển thị đúng design', 'UI', 'Thấp',
    GO_IGR + '\n3. Mở bộ lọc Trạng thái',
    'Vị trí, nhãn, giá trị mặc định và các lựa chọn của bộ lọc Trạng thái trùng design NCS-01', 257);
  m('IGR-L37', 'B.I.2-UC1', 'Xem danh sách', 'Font weight các cột và footer bảng danh sách Nhóm chỉ số đúng design', 'UI', 'Thấp',
    GO_IGR + '\n3. Kiểm tra font weight các cột và phần footer (phân trang, tổng bản ghi)',
    'Mã 500, cột thường 400, Thao tác 600 (theo #269); footer bảng (chiều cao, căn lề, phân trang) trùng design NCS-01', 257);
  // #79, #114 — màn chi tiết nhóm chỉ số
  m('IGR-V04', 'B.I.2-UC1', 'Xem chi tiết', 'Màn xem chi tiết Nhóm chỉ số có đủ thông tin chung và bảng chỉ số thuộc nhóm theo design', 'Chức năng', 'Cao',
    GO_IGR + '\n3. Bấm vào một nhóm chỉ số có chỉ số\n4. So với design NCS (màn chi tiết)',
    'Mở màn chi tiết riêng; hiển thị Mã, Tên, Trụ cột, Trạng thái, Mô tả, Số chỉ số, Cập nhật lần cuối và bảng "Chỉ số thuộc nhóm chỉ số"; bố cục trùng design', 79,
    '#114 "Chi tiết nhóm chỉ số — Update UI hiển thị chi tiết" kiểm chứng cùng case');
  // #258 — chỉ số cha không click; chiều cao header/footer
  m('IGR-V05', 'B.I.2-UC1', 'Xem chi tiết', 'Tên chỉ số cha trong bảng chỉ số của chi tiết nhóm không phải link', 'UI', 'Thấp',
    GO_IGR + '\n3. Mở chi tiết nhóm có chỉ số cha/con\n4. Di chuột và bấm vào tên chỉ số cha',
    'Tên chỉ số cha không có kiểu link (con trỏ, gạch chân), bấm vào không chuyển trang', 258);
  m('IGR-V06', 'B.I.2-UC1', 'Xem chi tiết', 'Chiều cao header và footer bảng chỉ số ở chi tiết nhóm đúng design', 'UI', 'Thấp',
    GO_IGR + '\n3. Mở chi tiết nhóm\n4. Đo chiều cao header/footer bảng "Chỉ số thuộc nhóm chỉ số"', 'Chiều cao header và footer trùng design NCS', 258);
  // #281 — chỉ số con vẫn là link
  m('IGR-V07', 'B.I.2-UC1', 'Xem chi tiết', 'Dòng chỉ số con trong bảng "Chỉ số thuộc nhóm chỉ số" không phải link sang chi tiết chỉ số', 'UI', 'Thấp',
    GO_IGR + '\n3. Mở chi tiết nhóm có chỉ số con\n4. Bấm vào tên chỉ số con',
    'Tên chỉ số con hiển thị dạng text thường, bấm vào không chuyển sang trang chi tiết chỉ số', 281, 'Issue đang mở');
  // #272 — cây chỉ số ở chi tiết
  m('IGR-V08', 'B.I.2-UC1', 'Xem chi tiết', 'Bảng chỉ số ở chi tiết nhóm hiển thị dạng cây cha → con thụt cấp theo design', 'UI', 'Trung bình',
    GO_IGR + '\n3. Mở chi tiết nhóm có chỉ số cha và chỉ số con',
    'Chỉ số con nằm ngay dưới chỉ số cha, thụt cấp, có nút thu gọn/mở rộng như design NCS', 272);
  // #259 — popup thêm nhóm chỉ số
  m('IGR-C09', 'B.I.2-UC2', 'Thêm mới', 'Popup Thêm nhóm chỉ số có title, danh sách field và placeholder đúng design', 'UI', 'Thấp',
    GO_IGR + '\n3. Bấm thêm mới nhóm chỉ số\n4. So popup với design',
    'Title, các field (đúng thứ tự, không thừa/thiếu) và placeholder từng field trùng design NCS-02', 259);
  m('IGR-C10', 'B.I.2-UC2', 'Thêm mới', 'Popup Thêm nhóm chỉ số hiển thị bộ đếm ký tự và text trường bắt buộc đúng design', 'UI', 'Thấp',
    GO_IGR + '\n3. Bấm thêm mới nhóm chỉ số\n4. Nhập vào ô Tên, quan sát bộ đếm và chú thích trường bắt buộc',
    'Bộ đếm ký tự và chú thích trường bắt buộc có/không và đúng text như design NCS-02', 259,
    'Cần BA/Design xác nhận có giữ bộ đếm và "* Trường bắt buộc" không (#278 ở Bộ chỉ số yêu cầu bỏ cả hai)');
  // #260 — popup cập nhật nhóm chỉ số
  m('IGR-E06', 'B.I.2-UC5', 'Chỉnh sửa', 'Popup Cập nhật nhóm chỉ số có title, sub title và text nút footer đúng design', 'UI', 'Thấp',
    GO_IGR + '\n3. Chọn Cập nhật ở một nhóm Chưa khóa', 'Title, sub title và text các nút footer trùng design NCS-03', 260);
  m('IGR-E07', 'B.I.2-UC5', 'Chỉnh sửa', 'Popup Cập nhật nhóm chỉ số không có field thừa so với design', 'UI', 'Thấp',
    GO_IGR + '\n3. Chọn Cập nhật ở một nhóm Chưa khóa\n4. Đối chiếu danh sách field với design',
    'Chỉ có các field như design NCS-03, không có field thừa', 260);

  // ===================== Chỉ số =====================
  // #252 — các màn CS-01…CS-07b
  m('IND-L34', 'B.I.3-UC1', 'Xem danh sách', 'Các màn Chỉ số (danh sách, dạng cây, thêm, sửa, chi tiết, nhân bản) khớp design CS-01…CS-07b', 'UI', 'Trung bình',
    GO_IND + '\n3. Lần lượt mở các màn/popup của Chỉ số\n4. So với design CS-01…CS-07b',
    'Bố cục, tiêu đề, nút, font, màu sắc của từng màn trùng design CS-01…CS-07b', 252);
  // #158 — dạng cây thiếu đường nối
  m('IND-L35', 'B.I.3-UC1', 'Xem danh sách', 'Xem chỉ số dạng cây có đường nối giữa các cấp', 'UI', 'Thấp',
    GO_IND + '\n3. Chuyển sang xem dạng cây\n4. Mở rộng trụ cột → nhóm → chỉ số cha → chỉ số con',
    'Có đường nối (connector) từ nút cha xuống các nút con ở mọi cấp như design', 158, 'Review CĐS 30/10');
  // #275 — điểm tối đa cha cộng dồn
  m('IND-C15', 'B.I.3-UC2', 'Thêm mới', 'Thêm chỉ số con: Điểm tối đa của chỉ số cha ở danh sách bằng tổng điểm tối đa các chỉ số con', 'Nghiệp vụ', 'Cao',
    GO_IND + '\n3. Tạo chỉ số cha, thêm 2 chỉ số con điểm tối đa 5 và 3\n4. Xem dòng chỉ số cha ở dạng danh sách',
    'Cột Điểm tối đa của chỉ số cha = 8 (cộng dồn từ con), cập nhật ngay sau khi thêm con', 275);
  m('IND-C16', 'B.I.3-UC5', 'Chỉnh sửa', 'Popup Chỉnh sửa chỉ số cha hiển thị Điểm tối đa đã cộng dồn từ chỉ số con', 'Nghiệp vụ', 'Cao',
    GO_IND + '\n3. Với chỉ số cha có 2 con (5 và 3), mở Cập nhật chỉ số cha',
    'Ô Điểm tối đa hiển thị 8 (tổng các con)', 275);
  // #80 — màn chi tiết chỉ số
  m('IND-V04', 'B.I.3-UC1', 'Xem chi tiết', 'Màn xem chi tiết Chỉ số có đủ thông tin theo design', 'Chức năng', 'Cao',
    GO_IND + '\n3. Bấm vào một chỉ số có chỉ số con\n4. So với design CS (màn chi tiết)',
    'Mở màn chi tiết riêng; hiển thị Mã, Tên, Trụ cột, Nhóm chỉ số, Chỉ số cha, Điểm tối thiểu, Điểm tối đa, Trạng thái, Mô tả, bảng chỉ số con, Cập nhật lần cuối; bố cục trùng design', 80);
  // #220 — bỏ khối thông báo đã khóa
  m('IND-V05', 'B.I.3-UC1', 'Xem chi tiết', 'Chi tiết chỉ số Đã khóa không hiển thị khối thông báo "Chỉ số đang ở trạng thái Đã khóa…"', 'UI', 'Thấp',
    GO_IND + '\n3. Mở chi tiết một chỉ số Đã khóa', 'Không có khối thông báo "Chỉ số đang ở trạng thái Đã khóa…"; trạng thái chỉ thể hiện bằng chip', 220);
  // #221 — tên dài bị cắt
  m('IND-V06', 'B.I.3-UC1', 'Xem chi tiết', 'Tiêu đề chi tiết chỉ số hiển thị đầy đủ tên dài (500 ký tự)', 'UI', 'Trung bình',
    GO_IND + '\n3. Mở chi tiết chỉ số có tên dài 500 ký tự',
    'Tiêu đề xuống dòng hiển thị đủ toàn bộ tên, không bị cắt mất; bố cục không vỡ', 221);
  // #82, #91 — popup cập nhật chỉ số
  m('IND-E12', 'B.I.3-UC5', 'Chỉnh sửa', 'Popup Cập nhật chỉ số khớp design mới', 'UI', 'Thấp',
    GO_IND + '\n3. Chọn Cập nhật ở một chỉ số Chưa khóa\n4. So popup với design', 'Title, sub title, thứ tự field, placeholder, nút footer trùng design CS', 82);
  m('IND-E13', 'B.I.3-UC5', 'Chỉnh sửa', 'Popup Cập nhật chỉ số có field Mã chỉ số hiển thị giá trị hiện tại và bị vô hiệu', 'Chức năng', 'Trung bình',
    GO_IND + '\n3. Chọn Cập nhật ở một chỉ số Chưa khóa',
    'Có field Mã chỉ số = mã hiện tại của chỉ số; field bị disable, không sửa được', 91);
  // #90 — nhân bản không tự cập nhật danh sách
  m('IND-N07', 'B.I.5-UC1', 'Nhân bản', 'Nhân bản chỉ số thành công thì danh sách tự cập nhật, không cần F5', 'Chức năng', 'Cao',
    GO_IND + '\n3. Chọn Nhân bản ở một chỉ số\n4. Không tải lại trang, quan sát danh sách',
    'Thông báo nhân bản thành công; bản sao xuất hiện ngay trong danh sách, tổng số bản ghi tăng 1', 90);

  // ===================== Bộ chỉ số =====================
  // #253 — các màn BCS-01…BCS-08
  m('SET-L34', 'B.II.1-UC1', 'Xem danh sách', 'Các màn Bộ chỉ số (danh sách, thêm, sửa, chi tiết, cấu hình) khớp design BCS-01…BCS-08', 'UI', 'Trung bình',
    GO_SET + '\n3. Lần lượt mở các màn/popup của Bộ chỉ số\n4. So với design BCS-01…BCS-08',
    'Bố cục, tiêu đề, nút, font, màu sắc của từng màn trùng design BCS-01…BCS-08', 253);
  // #81, #159 — chi tiết bộ chỉ số
  m('SET-V15', 'B.II.1-UC3', 'Xem chi tiết', 'Màn chi tiết Bộ chỉ số khớp design mới: card thông tin, bảng cấu trúc, footer', 'UI', 'Trung bình',
    GO_SET + '\n3. Bấm vào một bộ chỉ số có cấu trúc\n4. So card thông tin, khu vực Cấu trúc bộ chỉ số và footer với design',
    'Card thông tin, bảng Cấu trúc bộ chỉ số và footer có bố cục, nội dung trùng design BCS', 81,
    '#159 (Review CĐS 30/10) "Chi tiết bộ chỉ số — Chỉnh card, cấu trúc và footer" kiểm chứng cùng case');
  // #219 — tìm kiếm trong cấu trúc
  m('SET-V16', 'B.II.1-UC4', 'Xem chi tiết', 'Tìm kiếm trong "Cấu trúc bộ chỉ số" trả về đúng trụ cột/nhóm/chỉ số khớp từ khóa', 'Chức năng', 'Cao',
    GO_SET + '\n3. Mở chi tiết bộ có cấu trúc\n4. Nhập mã hoặc tên một chỉ số có trong bộ vào ô tìm kiếm cấu trúc',
    'Cây chỉ còn các dòng khớp từ khóa (kèm trụ cột/nhóm cha của chúng); không hiện "Bộ chỉ số chưa có cấu trúc"', 219);
  m('SET-V17', 'B.II.1-UC4', 'Xem chi tiết', 'Tìm kiếm trong "Cấu trúc bộ chỉ số" không có kết quả thì báo không tìm thấy, không báo chưa có cấu trúc', 'Chức năng', 'Trung bình',
    GO_SET + '\n3. Mở chi tiết bộ có cấu trúc\n4. Nhập "zzqcxx_khongtontai_999" vào ô tìm kiếm cấu trúc',
    'Hiển thị "Không tìm thấy dữ liệu phù hợp"; không hiện "Bộ chỉ số chưa có cấu trúc"', 219);
  // #277 — bảng cấu trúc: kéo chỉnh cột, scroll dọc
  m('SET-V18', 'B.II.1-UC4', 'Xem chi tiết', 'Bảng "Cấu trúc bộ chỉ số" cho kéo chỉnh độ rộng cột', 'UI', 'Thấp',
    GO_SET + '\n3. Mở chi tiết bộ có cấu trúc\n4. Kéo mép tiêu đề cột Tên sang phải',
    'Độ rộng cột thay đổi theo thao tác kéo; các cột khác vẫn hiển thị đúng', 277, 'Issue đang mở');
  m('SET-V19', 'B.II.1-UC4', 'Xem chi tiết', 'Bảng "Cấu trúc bộ chỉ số" có scroll dọc, header bảng cố định khi cuộn', 'UI', 'Thấp',
    GO_SET + '\n3. Mở chi tiết bộ có nhiều chỉ số (> 50 dòng)\n4. Cuộn trong bảng cấu trúc',
    'Bảng có thanh cuộn dọc riêng; header cột luôn hiển thị khi cuộn', 277, 'Ghim header khi cuộn: cần BA/Design xác nhận');
  // #278 — popup thêm bộ chỉ số
  m('SET-C12', 'B.II.1-UC6', 'Thêm mới', 'Popup Thêm bộ chỉ số không hiển thị bộ đếm ký tự ở các ô nhập', 'UI', 'Thấp',
    GO_SET + '\n3. Bấm thêm mới bộ chỉ số\n4. Nhập Tên và Mô tả', 'Không có bộ đếm dạng "n / 255" dưới ô Tên và Mô tả', 278);
  m('SET-C13', 'B.II.1-UC6', 'Thêm mới', 'Popup Thêm bộ chỉ số không có dòng text "* Trường bắt buộc"', 'UI', 'Thấp',
    GO_SET + '\n3. Bấm thêm mới bộ chỉ số', 'Không có dòng "* Trường bắt buộc" trong popup; trường bắt buộc vẫn có dấu * đỏ ở label', 278);
  // #92 — popup cập nhật thiếu mã
  m('SET-E07', 'B.II.1-UC9', 'Chỉnh sửa', 'Popup Cập nhật bộ chỉ số hiển thị Mã bộ chỉ số (chỉ đọc)', 'Chức năng', 'Trung bình',
    GO_SET + '\n3. Chọn Cập nhật ở một bộ Chưa khóa', 'Có field Mã bộ chỉ số = mã BCS-nnn hiện tại, bị disable', 92);
  // #160 — cấu hình bộ chỉ số hiển thị đồng bộ với KQTĐG
  m('SET-S11', 'B.II.2-UC1', 'Cấu trúc', 'Trang Cấu hình bộ chỉ số trình bày cấu trúc đồng bộ với màn Kết quả tự đánh giá', 'UI', 'Trung bình',
    GO_SET + '\n3. Mở Cấu hình của một bộ có cấu trúc\n4. Mở tab Chấm điểm của một kết quả tự đánh giá dùng cùng bộ, so cách hiển thị',
    'Cùng kiểu trình bày cây Trụ cột → Nhóm chỉ số → Chỉ số (bố cục cột trái nhóm, bảng chỉ số, cách hiển thị điểm) như màn Kết quả tự đánh giá', 160,
    'Review CĐS 30/10. Phạm vi "đồng bộ" cụ thể cần BA xác nhận');
  // #117 — scroll, điểm xám, bỏ Xóa khỏi bộ chỉ số, thêm Xem chi tiết
  m('SET-I10', 'B.II.3-UC1', 'Nội dung', 'Trang Cấu hình bộ chỉ số có scroll khi danh sách nhóm/chỉ số dài', 'UI', 'Thấp',
    GO_SET + '\n3. Mở Cấu hình bộ có nhiều nhóm và nhiều chỉ số\n4. Cuộn cột nhóm và bảng chỉ số',
    'Cột nhóm và bảng chỉ số cuộn độc lập, xem được hết dữ liệu; nút Lưu/Huỷ luôn truy cập được', 117);
  m('SET-I11', 'B.II.3-UC1', 'Nội dung', 'Điểm không chỉnh được (chỉ số cha / tổng nhóm) ở trang Cấu hình hiển thị màu xám', 'UI', 'Thấp',
    GO_SET + '\n3. Mở Cấu hình, chọn nhóm có chỉ số cha/con',
    'Điểm của chỉ số cha và điểm tổng nhóm hiển thị màu xám (chỉ đọc), phân biệt với ô nhập điểm của chỉ số con', 117,
    'Đối tượng hiển thị xám suy từ tiêu đề "điểm xám" — cần BA xác nhận');
  m('SET-I12', 'B.II.3-UC4', 'Nội dung', 'Trang Cấu hình bộ chỉ số không còn nút "Xóa khỏi bộ chỉ số" theo design', 'UI', 'Trung bình',
    GO_SET + '\n3. Mở Cấu hình, chọn một nhóm\n4. Xem các thao tác trên dòng chỉ số',
    'Không có nút "Xóa khỏi bộ chỉ số" ở vị trí đã bỏ theo design', 117,
    'Cần BA xác nhận: còn cách nào để xóa chỉ số/nhóm khỏi bộ (SET-S06, SET-I05 đang kiểm thao tác xóa)');
  m('SET-I13', 'B.II.3-UC1', 'Nội dung', 'Trang Cấu hình có nút Xem chi tiết mở chi tiết chỉ số/nhóm tương ứng', 'Chức năng', 'Trung bình',
    GO_SET + '\n3. Mở Cấu hình, chọn một nhóm\n4. Bấm Xem chi tiết ở một chỉ số',
    'Mở thông tin chi tiết đúng chỉ số đã chọn (mã, tên khớp); đóng lại vẫn ở trang Cấu hình, không mất thay đổi chưa lưu', 117);
  // #172 — tooltip, title dài
  m('SET-I14', 'B.II.3-UC1', 'Nội dung', 'Tên nhóm/chỉ số bị rút gọn ở trang Cấu hình hiện tooltip tên đầy đủ khi di chuột', 'UI', 'Thấp',
    GO_SET + '\n3. Mở Cấu hình bộ có nhóm/chỉ số tên dài (≥ 300 ký tự)\n4. Di chuột vào tên bị rút gọn',
    'Tooltip hiển thị đầy đủ tên', 172);
  m('SET-I15', 'B.II.3-UC1', 'Nội dung', 'Tên nhóm/chỉ số dài không làm vỡ bố cục trang Cấu hình', 'UI', 'Thấp',
    GO_SET + '\n3. Mở Cấu hình bộ có nhóm/chỉ số tên dài (≥ 300 ký tự)',
    'Tên được cắt "…" hoặc xuống dòng hợp lý; cột điểm, nút thao tác vẫn thẳng hàng, không tràn khung', 172);
  // #224 — dropdown chỉ số chưa khóa
  m('SET-I16', 'B.II.3-UC2', 'Nội dung', 'Danh sách chọn chỉ số khi Thêm chỉ số vào bộ chỉ liệt kê chỉ số Đã khóa', 'Nghiệp vụ', 'Cao',
    GO_SET + '\n3. Chuẩn bị nhóm có 1 chỉ số Chưa khóa và 1 chỉ số Đã khóa chưa có trong bộ\n4. Cấu hình → Thêm chỉ số, mở danh sách chọn',
    'Chỉ có chỉ số Đã khóa; chỉ số Chưa khóa không xuất hiện nên không thể chọn rồi bị lỗi khi Lưu', 224,
    'Thực tế: chọn được chỉ số chưa khóa, bấm "Lưu chỉ số" thì báo lỗi');
  // #279 — popup thêm chỉ số dạng bảng chọn nhiều
  m('SET-I17', 'B.II.3-UC2', 'Nội dung', 'Popup Thêm chỉ số là bảng chọn nhiều chỉ số (checkbox) theo design', 'UI', 'Trung bình',
    GO_SET + '\n3. Cấu hình → Thêm chỉ số\n4. Tích chọn 2 chỉ số, bấm Thêm',
    'Popup dạng bảng có checkbox (không phải select); thêm được nhiều chỉ số trong một lần, cả 2 xuất hiện trong bảng chỉ số của nhóm', 279, 'Issue đang mở');
  m('SET-I18', 'B.II.3-UC2', 'Nội dung', 'Popup Thêm chỉ số có ô tìm kiếm và bộ lọc theo design', 'Chức năng', 'Trung bình',
    GO_SET + '\n3. Cấu hình → Thêm chỉ số\n4. Nhập mã một chỉ số vào ô tìm kiếm, sau đó dùng bộ lọc',
    'Bảng chỉ còn các chỉ số khớp từ khóa/bộ lọc; xóa từ khóa thì danh sách trở về đầy đủ', 279, 'Tiêu chí lọc cụ thể theo design — cần BA xác nhận');

  // ===================== Thang xếp loại =====================
  // #127 — bỏ "(không bắt buộc)"
  m('SCL-C27', 'B.TXL-UC3', 'Thêm mới', 'Label Mô tả ở form Thêm thang xếp loại không có text "(không bắt buộc)"', 'UI', 'Thấp',
    GO_SCL + '\n3. Bấm thêm mới thang xếp loại', 'Label hiển thị "Mô tả", không kèm "(không bắt buộc)"', 127);
  // #183 — tên mức ≤ 50
  m('SCL-C28', 'B.TXL-UC3', 'Thêm mới', 'Ô Tên mức trên UI giới hạn tối đa 50 ký tự', 'Validate', 'Trung bình',
    GO_SCL + '\n3. Bấm thêm mới\n4. Nhập Tên mức 51 ký tự',
    'Ô chỉ nhận 50 ký tự (hoặc báo lỗi vượt độ dài); không lưu được tên mức > 50 ký tự', 183);
  m('SCL-C29', 'B.TXL-UC3', 'Thêm mới', '[API] Tên mức dài 51 ký tự bị từ chối, 50 ký tự được nhận', 'Validate', 'Trung bình',
    '1. [API] POST tạo thang có một mức tên 50 ký tự\n2. [API] POST tạo thang có một mức tên 51 ký tự',
    '50 ký tự: HTTP 200; 51 ký tự: HTTP 400 có thông báo vượt độ dài, không tạo thang', 183);
  // #184 — focus sang dòng mới
  m('SCL-C30', 'B.TXL-UC3', 'Thêm mới', 'Tự thêm dòng mức tiếp theo thì con trỏ chuyển vào ô Tên mức của dòng mới', 'UI', 'Thấp',
    GO_SCL + '\n3. Bấm thêm mới\n4. Nhập Tên mức và Đến dưới của mức 1 (chưa đến 100) để hệ thống tự thêm dòng mức 2',
    'Dòng mức 2 được thêm và ô Tên mức của dòng 2 nhận focus, gõ được ngay', 184);
  // #188 — URL /edit thang đã gán
  m('SCL-E08', 'B.TXL-UC4', 'Chỉnh sửa', 'Thang đã gán kỳ: mở thẳng URL /edit không vào được màn Sửa, báo MSG-104', 'Nghiệp vụ', 'Cao',
    '1. Đăng nhập Quản trị hệ thống\n2. Lấy id một thang đã gán cho kỳ\n3. Mở trực tiếp URL …/thang-xep-loai/<id>/edit',
    'Hiển thị "Thang xếp loại đang được kỳ sử dụng nên không thể sửa, mở khóa hoặc xóa" và về chi tiết; không có form Sửa, không có nút Lưu', 188);
  // #187 — API sửa/xóa thang Đã khóa chưa gán
  m('SCL-E09', 'B.TXL-UC4', 'Chỉnh sửa', '[API] Sửa thang Đã khóa chưa gán kỳ được chấp nhận (BR-2)', 'Nghiệp vụ', 'Cao',
    '1. Khóa một thang chưa gán kỳ\n2. [API] PUT đổi tên thang',
    'HTTP 200; tên mới hiển thị ở chi tiết; nhất quán với giao diện đang cho Cập nhật', 187,
    'Thực tế API trả 400 mâu thuẫn BR-2');
  m('SCL-D06', 'B.TXL-UC5', 'Xóa', '[API] Xóa thang Đã khóa chưa gán kỳ được chấp nhận (BR-1)', 'Nghiệp vụ', 'Cao',
    '1. Khóa một thang chưa gán kỳ\n2. [API] DELETE thang',
    'HTTP 200; thang không còn ở danh sách; nhất quán với giao diện đang cho Xoá', 187,
    'Thực tế API trả 400 mâu thuẫn BR-2');
  // #182 — nút Cập nhật primary
  m('SCL-V09', 'B.TXL-UC2', 'Xem chi tiết', 'Chi tiết thang: nút "Cập nhật" là nút chính (primary) (BR-7)', 'UI', 'Thấp',
    GO_SCL + '\n3. Mở chi tiết một thang Chưa khóa chưa gán', 'Nút "Cập nhật" có kiểu primary (nền màu chủ đạo); các nút khác là secondary', 182);

  // ===================== Quản lý tự đánh giá =====================
  // #254 — QL-01…QL-06
  m('CMP-L34', 'B.III.1-UC1', 'Xem danh sách', 'Các màn Quản lý tự đánh giá khớp design QL-01…QL-06', 'UI', 'Trung bình',
    GO_CMP + '\n3. Lần lượt mở danh sách, popup Thêm/Cập nhật, chi tiết kỳ, phân công đơn vị\n4. So với design QL-01…QL-06',
    'Bố cục, tiêu đề, nút, font, màu sắc của từng màn trùng design QL-01…QL-06', 254);
  // #161 — cột Loại trùng tab
  m('CMP-L35', 'B.III.1-UC1', 'Xem danh sách', 'Danh sách tự đánh giá không có cột Loại (đã có bộ chọn Định kỳ/Đột xuất)', 'UI', 'Thấp',
    GO_CMP + '\n3. Xem tiêu đề các cột ở tab Định kỳ và Đột xuất', 'Bảng không có cột Loại', 161, 'Review CĐS 30/10');
  // #43 — màu nút Xuất Excel
  m('CMP-L36', 'B.III.1-UC1', 'Xem danh sách', 'Nút "Xuất Excel" ở Quản lý tự đánh giá cùng màu với nút Xuất Excel ở các màn khác', 'UI', 'Thấp',
    GO_CMP + '\n3. So màu nút Xuất Excel với nút Xuất Excel ở Bộ chỉ số', 'Cùng kiểu nút (màu nền, viền, chữ, icon)', 43);
  // #33 — Quay lại → Hủy
  m('CMP-C43', 'B.III.1-UC2', 'Thêm mới', 'Form Thêm mới kỳ tự đánh giá có nút "Hủy" (không phải "Quay lại")', 'UI', 'Thấp',
    GO_CMP + '\n3. Bấm thêm mới tự đánh giá\n4. Đọc text nút ở footer', 'Nút đóng form có text "Hủy"; không có nút "Quay lại"', 33);
  // #86 — tìm kiếm trong select Bộ chỉ số
  m('CMP-C44', 'B.III.1-UC2', 'Thêm mới', 'Select Bộ chỉ số ở popup Thêm mới kỳ có ô tìm kiếm', 'Chức năng', 'Trung bình',
    GO_CMP + '\n3. Bấm thêm mới\n4. Mở select Bộ chỉ số, gõ một phần tên bộ',
    'Danh sách chỉ còn các bộ khớp từ khóa; chọn được bộ từ kết quả tìm', 86);
  // #93 — UI popup thêm kỳ
  m('CMP-C45', 'B.III.1-UC2', 'Thêm mới', 'Popup Thêm mới kỳ tự đánh giá khớp design', 'UI', 'Thấp',
    GO_CMP + '\n3. Bấm thêm mới\n4. So popup với design', 'Title, thứ tự field, placeholder, nút footer trùng design QL', 93);
  // #89 — báo "Thang xếp loại không hợp lệ" với thang hợp lệ
  m('CMP-C46', 'B.III.1-UC2', 'Thêm mới', 'Thêm kỳ chọn thang xếp loại hợp lệ từ dropdown thành công, không báo "Thang xếp loại không hợp lệ"', 'Chức năng', 'Cao',
    GO_CMP + '\n3. Bấm thêm mới, nhập tên, chọn bộ chỉ số Đã khóa, chọn thang xếp loại trong dropdown, nhập thông tin kỳ\n4. Lưu',
    'Thông báo thêm thành công; kỳ mới ở trạng thái Nháp, chi tiết hiển thị đúng thang đã chọn', 89);
  // #105 — kỳ Định kỳ lỗi 400
  m('CMP-C47', 'B.III.1-UC5', 'Thêm mới', 'Thêm kỳ Định kỳ nhập đầy đủ thông tin thành công', 'Chức năng', 'Cao',
    GO_CMP + '\n3. Bấm thêm mới, chọn Phân loại Định kỳ, Kỳ - Quý, nhập đủ trường bắt buộc\n4. Lưu',
    'Thông báo thêm thành công (không lỗi 400); kỳ xuất hiện ở tab Định kỳ, Kỳ hiển thị đúng quý', 105);
  // #282 — mất đơn vị tham gia khi mở popup cập nhật
  m('CMP-E23', 'B.III.1-UC3', 'Chỉnh sửa', 'Mở popup Cập nhật kỳ ngay sau khi thêm mới không làm mất dữ liệu Đơn vị tham gia', 'Chức năng', 'Cao',
    GO_CMP + '\n3. Thêm mới kỳ và phân công 2 đơn vị\n4. Mở popup Cập nhật, bấm Lưu không đổi gì\n5. Xem tab Đơn vị tham gia',
    'Popup hiển thị đúng dữ liệu hiện tại; sau khi Lưu vẫn còn đủ 2 đơn vị tham gia', 282);
  // #283, #284 — chi tiết kỳ
  m('CMP-V19', 'B.III.1-UC1', 'Xem chi tiết', 'Nút "Trình phê duyệt" ở chi tiết kỳ có icon như design', 'UI', 'Thấp',
    GO_CMP + '\n3. Mở chi tiết một kỳ Nháp', 'Nút "Trình phê duyệt" có icon đứng trước text như design QL', 283);
  m('CMP-V20', 'B.III.1-UC1', 'Xem chi tiết', 'Tab Đơn vị tham gia: cột Điểm hiển thị dạng "điểm / điểm tối đa"', 'UI', 'Trung bình',
    GO_CMP + '\n3. Mở chi tiết kỳ đã có đơn vị chấm điểm → tab Đơn vị tham gia',
    'Cột Điểm hiển thị "điểm đạt / điểm tối đa" (vd 45 / 100); đơn vị chưa chấm hiển thị "– / 100"', 284,
    'Hiển thị khi đơn vị chưa chấm: cần BA xác nhận');
  // #104, #148, #203, #285 — phân công đơn vị
  m('CMP-U31', 'B.III.2-UC4', 'Phân công đơn vị', 'Thêm đơn vị vào kỳ Nháp thành công (không lỗi 500)', 'Chức năng', 'Cao',
    GO_CMP + '\n3. Mở chi tiết kỳ Nháp → Phân công đơn vị / Thêm đơn vị\n4. Chọn 2 đơn vị, Lưu',
    'Thông báo thành công; 2 đơn vị xuất hiện ở tab Đơn vị tham gia; API trả 2xx', 104);
  m('CMP-U32', 'B.III.2-UC5', 'Phân công đơn vị', 'Xóa một đơn vị khỏi kỳ tự đánh giá từ danh sách Đơn vị tham gia', 'Chức năng', 'Cao',
    GO_CMP + '\n3. Mở chi tiết kỳ Nháp có ≥ 2 đơn vị\n4. Chọn thao tác Xóa ở một đơn vị → xác nhận',
    'Có thao tác Xóa và hộp xác nhận; đơn vị bị xóa không còn trong danh sách, các đơn vị khác giữ nguyên', 148);
  m('CMP-U33', 'B.III.2-UC3', 'Phân công đơn vị', 'Xuất Excel danh sách đơn vị thực hiện tự đánh giá của kỳ', 'Chức năng', 'Trung bình',
    GO_CMP + '\n3. Mở chi tiết kỳ có đơn vị → tab Đơn vị tham gia\n4. Bấm Xuất Excel, mở file',
    'Tải về file .xlsx; số dòng = số đơn vị tham gia; cột khớp bảng trên màn hình', 203);
  m('CMP-U34', 'B.III.2-UC4', 'Phân công đơn vị', 'Popup "Thêm đơn vị vào kỳ tự đánh giá" khớp design QL-05', 'UI', 'Trung bình',
    GO_CMP + '\n3. Mở chi tiết kỳ Nháp → Thêm đơn vị\n4. So popup với design QL-05',
    'Title, bộ lọc, các cột bảng và phân trang trùng design QL-05', 285, 'Issue đang mở');
  // #181, #216, #131 — trình phê duyệt
  m('CMP-T21', 'B.III.3-UC1', 'Trình phê duyệt', 'Kỳ có bộ chỉ số rỗng (0 chỉ số) không trình phê duyệt được', 'Nghiệp vụ', 'Cao',
    '1. Tạo kỳ Nháp, xóa hết nhóm/chỉ số trong bộ chỉ số của kỳ, phân công đơn vị\n2. Bấm Trình phê duyệt (và [API] POST submit)',
    'Bị chặn với thông báo bộ chỉ số chưa có chỉ số; API trả 400; trạng thái vẫn Nháp', 181, 'Thực tế API trả 200');
  m('CMP-T22', 'B.III.3-UC1', 'Trình phê duyệt', 'Kỳ chưa phân công đơn vị: bấm Trình phê duyệt báo lỗi ngay, không hiện hộp xác nhận', 'Chức năng', 'Trung bình',
    GO_CMP + '\n3. Mở chi tiết kỳ Nháp chưa có đơn vị\n4. Bấm Trình phê duyệt',
    'Hiển thị ngay thông báo cần phân công đơn vị; không mở hộp thoại xác nhận trình; trạng thái vẫn Nháp', 216);
  m('CMP-T23', 'B.III.3-UC5', 'Trình lại', 'Trình lại kỳ Bị từ chối được ghi vào Lịch sử xử lý', 'Nghiệp vụ', 'Trung bình',
    '1. Lãnh đạo từ chối một kỳ Chờ phê duyệt\n2. Cán bộ cập nhật và Trình phê duyệt lại\n3. Mở chi tiết kỳ → Lịch sử xử lý',
    'Có bản ghi hành động Trình lại (người thực hiện, thời gian) sau bản ghi Từ chối', 131);
  // #273 — 403 do thiếu quyền Xem bộ chỉ số
  m('CMP-S17', 'B.III.1-UC1', 'Phân quyền', 'Có quyền Xem kỳ tự đánh giá nhưng không có quyền Xem Bộ chỉ số vẫn mở được chi tiết kỳ', 'Bảo mật', 'Cao',
    '1. Ở Ma trận phân quyền, cấp cho nhóm thử quyền Xem kỳ tự đánh giá, bỏ quyền Xem Bộ chỉ số\n2. Đăng nhập tài khoản thuộc nhóm\n3. Mở chi tiết một kỳ',
    'Chi tiết kỳ hiển thị đầy đủ (gồm cấu trúc bộ chỉ số của kỳ); không có lỗi 403', 273);

  // ===================== Phân hệ B — validate Mã ở API (#208, quy tắc chung #134/#135/#143/#144) =====================
  const MA = 'Trụ cột (dti/pillars), Nhóm chỉ số, Chỉ số';
  m('ATB-V06', 'ATTT KT 1.3.4', 'Kiểm tra đầu vào', '[API] Mã = null khi thêm mới ở các danh mục Phân hệ B bị từ chối 400', 'Validate', 'Cao',
    `1. Lần lượt gọi POST tạo mới ${MA} với code = null, các trường khác hợp lệ`,
    'HTTP 400 "Vui lòng nhập mã"; không có bản ghi nào được tạo', 208, 'Thực tế HTTP 200');
  m('ATB-V07', 'ATTT KT 1.3.4', 'Kiểm tra đầu vào', '[API] Mã dài hơn 50 ký tự ở các danh mục Phân hệ B bị từ chối (50 nhận, 51 từ chối)', 'Validate', 'Cao',
    `1. Lần lượt gọi POST tạo mới ${MA} với mã 50 ký tự\n2. Lặp lại với mã 51 ký tự và 300 ký tự`,
    '50 ký tự: HTTP 200; 51 và 300 ký tự: HTTP 400 "Mã không vượt quá 50 ký tự", không tạo bản ghi', 208,
    'Quy tắc chung Mã ≤ 50 (#134)');
  m('ATB-V08', 'ATTT KT 1.3.4', 'Kiểm tra đầu vào', '[API] Mã chứa khoảng trắng, dấu tiếng Việt hoặc ký tự đặc biệt ở các danh mục Phân hệ B bị từ chối', 'Validate', 'Cao',
    `1. Lần lượt gọi POST tạo mới ${MA} với mã "AB C", "MÃ01", "AB@#"`,
    'Cả 3: HTTP 400 báo mã chỉ gồm A–Z, 0–9, "-", "_", "."; không tạo bản ghi', 208,
    'Quy tắc chung #135/#143');
  m('ATB-V09', 'ATTT KT 1.3.4', 'Kiểm tra đầu vào', '[API] Mã chỉ khác hoa/thường với mã đã có ở Nhóm chỉ số, Chỉ số bị coi là trùng', 'Validate', 'Cao',
    '1. Tạo nhóm chỉ số / chỉ số mã "QCA_ABC"\n2. Gọi POST tạo bản ghi cùng loại mã "qca_abc"',
    'HTTP 400 "Mã [qca_abc] đã tồn tại. Vui lòng nhập mã khác."; không tạo bản ghi', 144,
    'Trụ cột đã có PIL-C04. Quy tắc chung #136/#144');
}
