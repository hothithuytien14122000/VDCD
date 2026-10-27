// Testcase PHÂN HỆ B — Quản lý Bộ chỉ số DTI (nguồn: UC_1409 dòng 95-151; SRS Nhóm 1 "Quản lý thang xếp loại" UC1.1-1.7).
// Page: PIL Trụ cột · IGR Nhóm chỉ số · IND Chỉ số · SET Bộ chỉ số · SCL Thang xếp loại.
// Quy tắc nghiệp vụ chung đã khảo sát: "Khóa = đưa vào sử dụng" → đối tượng đã khóa không sửa/xóa; chỉ chọn được trụ cột/nhóm đã khóa làm cha.
export default function defineB(t, listSuite) {
  const c = (id, uc, fn, title, type, pri, steps, exp, note = '') => t(id, uc, fn, title, type, pri, steps, exp, 'Auto', note);
  const BA = 'Cần BA xác nhận quy tắc';

  // ===================== B.I.1 TRỤ CỘT =====================
  listSuite('PIL', 'Trụ cột', { ucList: 'B.I.1-UC1', ucSearch: 'B.I.1-UC1', ucExport: 'B.I.1-UC1', noExport: true,
    cols: ['STT', 'Mã trụ cột', 'Tên trụ cột', 'Nhóm chỉ số', 'Trạng thái', 'Thao tác'],
    kwCode: { label: 'mã trụ cột' }, kwName: { label: 'tên trụ cột' } });
  c('PIL-L12', 'B.I.1-UC1', 'Bộ lọc', 'Lọc theo trạng thái khóa', 'Chức năng', 'Trung bình', '1. Chọn bộ lọc trạng thái "Đã khóa" rồi "Chưa khóa"', 'Mọi dòng có cột Trạng thái khớp bộ lọc');
  c('PIL-L13', 'B.I.1-UC1', 'Xem danh sách', 'Cột Nhóm chỉ số khớp số nhóm trong chi tiết trụ cột', 'Nghiệp vụ', 'Trung bình', '1. Ghi số "Nhóm chỉ số" của một trụ cột\n2. Mở chi tiết', 'Số nhóm ở danh sách = số dòng bảng nhóm chỉ số trong chi tiết');
  c('PIL-V01', 'B.I.1-UC1', 'Xem chi tiết', 'Chi tiết trụ cột hiển thị mã, thứ tự, số nhóm, số chỉ số, tổng điểm tối đa, lần cập nhật cuối và bảng nhóm chỉ số', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" một trụ cột', 'Hiển thị đủ các thông tin trên; bảng "Nhóm chỉ số thuộc trụ cột" có cột Mã nhóm, Tên nhóm, Số chỉ số, Tổng điểm tối đa, Thứ tự, Thao tác; có nút Xuất Excel, Cập nhật, Thêm mới nhóm chỉ số');
  c('PIL-V02', 'B.I.1-UC1', 'Xem chi tiết', 'Số liệu tổng hợp của trụ cột bằng tổng các nhóm bên dưới', 'Nghiệp vụ', 'Trung bình', '1. Mở chi tiết trụ cột có nhiều nhóm/chỉ số', 'Số chỉ số và Tổng điểm tối đa của trụ cột = tổng của các nhóm trong bảng');
  c('PIL-V03', 'B.I.1-UC1', 'Xem chi tiết', 'Xuất Excel ở chi tiết trụ cột tải được file', 'Chức năng', 'Thấp', '1. Mở chi tiết\n2. Bấm Xuất Excel', 'Tải về file .xlsx');
  c('PIL-V04', 'B.I.1-UC1', 'Xem chi tiết', 'Mở chi tiết trụ cột với id không tồn tại không gây lỗi hệ thống', 'Validate', 'Trung bình', '1. [API] GET /dti/pillars/<id lạ>\n2. Mở URL chi tiết với id lạ', 'API trả 4xx (không 500); trang không trắng, không lộ lỗi nội bộ');
  c('PIL-V05', 'B.I.1-UC5', 'Xem chi tiết', 'Trụ cột đã khóa: chi tiết không cho Cập nhật / Thêm mới nhóm', 'Nghiệp vụ', 'Trung bình', '1. Mở chi tiết trụ cột Đã khóa', 'Nút Cập nhật bị ẩn/vô hiệu (hoặc thao tác bị từ chối), nhất quán với menu danh sách chỉ còn "Mở khoá"', 'Khảo sát: chi tiết trụ cột đã khóa vẫn hiện nút Cập nhật; API từ chối "đã bị khoá" → nghi lỗi UI');
  c('PIL-C01', 'B.I.1-UC2', 'Thêm mới', 'Thêm trụ cột thành công, mặc định Chưa khóa', 'Chức năng', 'Cao', '1. Bấm "Thêm mới trụ cột"\n2. Nhập mã, tên\n3. Lưu', 'Thông báo thành công; trụ cột xuất hiện, trạng thái Chưa khóa, số nhóm = 0');
  c('PIL-C02', 'B.I.1-UC2', 'Thêm mới', 'Bỏ trống Mã/Tên thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc ở Mã và Tên; không tạo');
  c('PIL-C03', 'B.I.1-UC2', 'Thêm mới', 'Trùng mã trụ cột bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo trụ cột A\n2. Tạo trụ cột B cùng mã', 'Báo "Mã trụ cột đã tồn tại"; chỉ có 1 bản ghi');
  c('PIL-C04', 'B.I.1-UC2', 'Thêm mới', 'Mã chỉ khác hoa/thường so với trụ cột có sẵn bị coi là trùng', 'Nghiệp vụ', 'Trung bình', '1. Có trụ cột "ABC"\n2. [API] Tạo trụ cột "abc"', 'Bị từ chối (4xx)', 'Khảo sát: API hiện nhận → nghi lỗi. ' + BA + ' hoa/thường');
  c('PIL-C05', 'B.I.1-UC2', 'Thêm mới', 'Trùng tên trụ cột (khác mã)', 'Nghiệp vụ', 'Trung bình', '1. Tạo trụ cột có tên trùng trụ cột khác, mã khác', 'Bị từ chối hoặc cảnh báo trùng tên', 'Khảo sát: API hiện nhận. ' + BA + ' duy nhất của tên');
  c('PIL-C06', 'B.I.1-UC2', 'Thêm mới', 'Mã trụ cột dài đúng 50 ký tự được nhận, 51 ký tự bị chặn', 'Validate', 'Trung bình', '1. Nhập mã 50 ký tự → Lưu\n2. Nhập mã 51 ký tự → Lưu', '50 ký tự: tạo được; 51 ký tự: báo "Không được nhập vượt quá 50 ký tự"');
  c('PIL-C07', 'B.I.1-UC2', 'Thêm mới', 'Tên trụ cột rất dài (300 ký tự) bị giới hạn độ dài', 'Validate', 'Thấp', '1. Nhập tên 300 ký tự → Lưu', 'Bị chặn bởi giới hạn độ dài tên', 'Khảo sát: API nhận tên 300 ký tự (mã giới hạn 50). ' + BA + ' độ dài tên');
  c('PIL-C08', 'B.I.1-UC2', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Nhập dữ liệu\n2. Bấm Huỷ', 'Đóng form; không có trụ cột mới');
  c('PIL-C09', 'B.I.1-UC2', 'Thêm mới', '[API] Mã hoặc tên rỗng bị từ chối bằng HTTP 400', 'Validate', 'Trung bình', '1. [API] POST với name rỗng; POST với code rỗng', 'HTTP 400 kèm thông báo "không được để trống"; không tạo');
  c('PIL-E01', 'B.I.1-UC5', 'Chỉnh sửa', 'Sửa tên trụ cột chưa khóa thành công', 'Chức năng', 'Cao', '1. Menu → Cập nhật\n2. Đổi tên\n3. Lưu', 'Thông báo thành công; tên mới hiển thị ở danh sách và chi tiết');
  c('PIL-E02', 'B.I.1-UC5', 'Chỉnh sửa', 'Mã trụ cột không đổi sau khi sửa', 'Nghiệp vụ', 'Trung bình', '1. Cập nhật trụ cột, đổi tên\n2. Lưu', 'Mã và id giữ nguyên');
  c('PIL-E03', 'B.I.1-UC5', 'Chỉnh sửa', 'Xóa trắng tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc; dữ liệu giữ nguyên');
  c('PIL-E04', 'B.I.1-UC5', 'Chỉnh sửa', 'Hủy chỉnh sửa không đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Huỷ', 'Dữ liệu giữ nguyên');
  c('PIL-E05', 'B.I.1-UC5', 'Chỉnh sửa', '[API] Sửa trụ cột đã khóa bị từ chối', 'Nghiệp vụ', 'Cao', '1. Khóa trụ cột\n2. [API] PUT đổi tên', 'HTTP 400 "Trụ cột đã bị khoá, không thể chỉnh sửa"; tên giữ nguyên');
  c('PIL-E06', 'B.I.1-UC5', 'Chỉnh sửa', 'Sửa tên thành tên trùng trụ cột khác', 'Nghiệp vụ', 'Thấp', '1. Đổi tên trụ cột B thành tên trụ cột A', 'Bị từ chối hoặc cảnh báo', 'Cùng quy tắc với PIL-C05. ' + BA);
  c('PIL-K01', 'B.I.1-UC3', 'Khóa/Mở khóa', 'Khóa trụ cột → Đã khóa, menu chỉ còn "Mở khoá"', 'Chức năng', 'Cao', '1. Menu → Khoá\n2. Xác nhận', 'Trạng thái "Đã khóa"; menu thao tác chỉ còn Mở khoá (không Cập nhật/Xoá)');
  c('PIL-K02', 'B.I.1-UC3', 'Khóa/Mở khóa', 'Mở khóa trụ cột → Chưa khóa, sửa/xóa lại được', 'Chức năng', 'Cao', '1. Menu → Mở khoá', 'Trạng thái "Chưa khóa"; menu có lại Khoá, Cập nhật, Xoá');
  c('PIL-K03', 'B.I.1-UC3', 'Khóa/Mở khóa', 'Chỉ trụ cột đã khóa mới chọn được khi tạo nhóm chỉ số', 'Nghiệp vụ', 'Cao', '1. Mở form Thêm mới nhóm chỉ số\n2. Mở danh sách Trụ cột', 'Chỉ có trụ cột Đã khóa; trụ cột Chưa khóa không xuất hiện (API tạo nhóm với trụ cột chưa khóa → 400 "Chỉ có thể chọn trụ cột đã được khóa")');
  c('PIL-K04', 'B.I.1-UC3', 'Khóa/Mở khóa', 'Mở khóa trụ cột đang có nhóm chỉ số', 'Nghiệp vụ', 'Trung bình', '1. Trụ cột đã khóa có nhóm\n2. Mở khóa', 'Có chặn/cảnh báo hay cho phép theo quy tắc', 'Khảo sát: API cho mở khóa (200). ' + BA);
  c('PIL-D01', 'B.I.1-UC4', 'Xóa', 'Xóa trụ cột chưa khóa, chưa có nhóm thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Trụ cột biến mất khỏi danh sách và API');
  c('PIL-D02', 'B.I.1-UC4', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Không', 'Trụ cột vẫn còn');
  c('PIL-D03', 'B.I.1-UC4', 'Xóa', 'Trụ cột đã khóa không xóa được (UI ẩn Xoá, API 400)', 'Nghiệp vụ', 'Cao', '1. Khóa trụ cột\n2. Xem menu\n3. [API] DELETE', 'Menu không có Xoá; API 400 "Trụ cột đã bị khoá, không thể xóa"');
  c('PIL-D04', 'B.I.1-UC4', 'Xóa', 'Trụ cột đang có nhóm chỉ số không xóa được', 'Nghiệp vụ', 'Cao', '1. Trụ cột (mở khóa) có nhóm chỉ số\n2. Xóa', 'Báo "Không thể xóa: đang có nhóm chỉ số thuộc trụ cột này"; trụ cột còn nguyên');

  // ===================== B.I.2 NHÓM CHỈ SỐ =====================
  listSuite('IGR', 'Nhóm chỉ số', { ucList: 'B.I.2-UC1', ucSearch: 'B.I.2-UC1', ucExport: 'B.I.2-UC1', noExport: true,
    cols: ['STT', 'Mã nhóm chỉ số', 'Tên nhóm chỉ số', 'Trụ cột', 'Chỉ số', 'Trạng thái', 'Thao tác'],
    kwCode: { label: 'mã nhóm chỉ số' }, kwName: { label: 'tên nhóm chỉ số' } });
  c('IGR-L12', 'B.I.2-UC1', 'Bộ lọc', 'Lọc theo trạng thái khóa / trụ cột', 'Chức năng', 'Trung bình', '1. Chọn bộ lọc trên trang', 'Mọi dòng khớp bộ lọc đã chọn');
  c('IGR-L13', 'B.I.2-UC1', 'Xem danh sách', 'Cột Chỉ số khớp số chỉ số trong chi tiết nhóm', 'Nghiệp vụ', 'Trung bình', '1. Ghi số "Chỉ số" của nhóm\n2. Mở chi tiết', 'Bằng số dòng bảng chỉ số thuộc nhóm (tính cả chỉ số con theo hiển thị)');
  c('IGR-V01', 'B.I.2-UC1', 'Xem chi tiết', 'Chi tiết nhóm hiển thị mã, trụ cột, thứ tự, số chỉ số, tổng điểm tối đa và bảng chỉ số thuộc nhóm', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" một nhóm', 'Hiển thị đủ thông tin; bảng có cột Mã chỉ số, Tên, Điểm tối thiểu, Điểm tối đa, Trạng thái, Thao tác; có nút Xuất Excel, Cập nhật, Thêm chỉ số');
  c('IGR-V02', 'B.I.2-UC1', 'Xem chi tiết', 'Mở chi tiết nhóm với id không tồn tại không gây lỗi hệ thống', 'Validate', 'Trung bình', '1. [API] GET /dti/indicator-groups/<id lạ>\n2. Mở URL chi tiết id lạ', 'API 4xx (không 500); trang không trắng, không lộ lỗi');
  c('IGR-V03', 'B.I.2-UC1', 'Xem chi tiết', 'Nhóm đã khóa: chi tiết không cho Cập nhật / Thêm chỉ số', 'Nghiệp vụ', 'Trung bình', '1. Mở chi tiết nhóm Đã khóa', 'Thao tác sửa bị ẩn/vô hiệu, nhất quán với menu danh sách', 'Tương tự PIL-V05 — cần khảo sát khi viết script');
  c('IGR-C01', 'B.I.2-UC2', 'Thêm mới', 'Thêm nhóm chỉ số dưới một trụ cột đã khóa thành công', 'Chức năng', 'Cao', '1. Bấm "Thêm mới nhóm chỉ số"\n2. Chọn trụ cột, nhập mã, tên\n3. Lưu', 'Thành công; nhóm hiện ở danh sách với đúng trụ cột, trạng thái Chưa khóa');
  c('IGR-C02', 'B.I.2-UC2', 'Thêm mới', 'Bỏ trống Trụ cột/Mã/Tên thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc ở 3 trường; không tạo');
  c('IGR-C03', 'B.I.2-UC2', 'Thêm mới', 'Trùng mã nhóm chỉ số bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo nhóm A\n2. Tạo nhóm B cùng mã', 'Báo "Mã nhóm chỉ số đã tồn tại"; chỉ 1 bản ghi');
  c('IGR-C04', 'B.I.2-UC2', 'Thêm mới', '[API] Tạo nhóm với trụ cột chưa khóa / không hợp lệ bị từ chối', 'Nghiệp vụ', 'Cao', '1. [API] POST với pillarId của trụ cột Chưa khóa\n2. [API] POST không có pillarId', '400 "Chỉ có thể chọn trụ cột đã được khóa"; 400 "Trụ cột không hợp lệ"');
  c('IGR-C05', 'B.I.2-UC2', 'Thêm mới', 'Mã nhóm chỉ khác hoa/thường bị coi là trùng', 'Nghiệp vụ', 'Trung bình', '1. [API] Tạo nhóm "abc" khi đã có "ABC"', 'Bị từ chối', BA + ' hoa/thường');
  c('IGR-C06', 'B.I.2-UC2', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Nhập dữ liệu\n2. Huỷ', 'Không có nhóm mới');
  c('IGR-C07', 'B.I.2-UC2', 'Thêm mới', 'Mã nhóm 50 ký tự được nhận, 51 ký tự bị chặn', 'Validate', 'Trung bình', '1. Nhập mã 50 rồi 51 ký tự', '50: tạo được; 51: báo vượt quá 50 ký tự');
  c('IGR-C08', 'B.I.2-UC2', 'Thêm mới', '[API] Mã hoặc tên rỗng bị từ chối bằng HTTP 400', 'Validate', 'Trung bình', '1. [API] POST name rỗng / code rỗng', 'HTTP 400 có thông báo');
  c('IGR-E01', 'B.I.2-UC5', 'Chỉnh sửa', 'Sửa tên nhóm chưa khóa thành công', 'Chức năng', 'Cao', '1. Menu → Cập nhật\n2. Đổi tên\n3. Lưu', 'Tên mới hiển thị');
  c('IGR-E02', 'B.I.2-UC5', 'Chỉnh sửa', 'Xóa trắng tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc');
  c('IGR-E03', 'B.I.2-UC5', 'Chỉnh sửa', 'Hủy chỉnh sửa không đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Huỷ', 'Dữ liệu giữ nguyên');
  c('IGR-E04', 'B.I.2-UC5', 'Chỉnh sửa', '[API] Sửa nhóm đã khóa bị từ chối', 'Nghiệp vụ', 'Cao', '1. Khóa nhóm\n2. [API] PUT đổi tên', 'HTTP 400 báo đã khóa; tên giữ nguyên');
  c('IGR-E05', 'B.I.2-UC5', 'Chỉnh sửa', 'Đổi trụ cột của nhóm cập nhật số liệu trụ cột', 'Nghiệp vụ', 'Trung bình', '1. Cập nhật nhóm → chọn trụ cột khác (đã khóa)\n2. Lưu\n3. Xem 2 trụ cột', 'Nhóm chuyển sang trụ cột mới; số nhóm/điểm của 2 trụ cột đổi theo', 'Khảo sát khi viết script xem form sửa có cho đổi trụ cột không');
  c('IGR-K01', 'B.I.2-UC3', 'Khóa/Mở khóa', 'Khóa nhóm chỉ số → Đã khóa, menu chỉ còn "Mở khoá"', 'Chức năng', 'Cao', '1. Menu → Khoá\n2. Xác nhận', 'Đã khóa; không còn Cập nhật/Xoá');
  c('IGR-K02', 'B.I.2-UC3', 'Khóa/Mở khóa', 'Mở khóa nhóm chỉ số → sửa/xóa lại được', 'Chức năng', 'Cao', '1. Menu → Mở khoá', 'Chưa khóa; menu có lại Cập nhật/Xoá');
  c('IGR-K03', 'B.I.2-UC3', 'Khóa/Mở khóa', 'Chỉ nhóm đã khóa mới chọn được khi tạo chỉ số', 'Nghiệp vụ', 'Cao', '1. Mở form Thêm mới chỉ số\n2. Chọn trụ cột → mở danh sách Nhóm chỉ số', 'Chỉ liệt kê nhóm Đã khóa', 'Suy từ quy tắc "khóa = đưa vào sử dụng" — xác minh khi viết script');
  c('IGR-D01', 'B.I.2-UC4', 'Xóa', 'Xóa nhóm chưa khóa, chưa có chỉ số thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Nhóm biến mất');
  c('IGR-D02', 'B.I.2-UC4', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Không', 'Nhóm còn nguyên');
  c('IGR-D03', 'B.I.2-UC4', 'Xóa', 'Nhóm đã khóa không xóa được (UI ẩn Xoá, API 400)', 'Nghiệp vụ', 'Cao', '1. Khóa nhóm\n2. Xem menu, [API] DELETE', 'Không có Xoá; API 400');
  c('IGR-D04', 'B.I.2-UC4', 'Xóa', 'Nhóm đang có chỉ số không xóa được', 'Nghiệp vụ', 'Cao', '1. Nhóm (mở khóa) có chỉ số\n2. Xóa', 'Báo không thể xóa; nhóm và chỉ số còn nguyên');

  // ===================== B.I.3-5 CHỈ SỐ =====================
  listSuite('IND', 'Chỉ số', { ucList: 'B.I.3-UC1', ucSearch: 'B.I.3-UC1', ucExport: 'B.I.3-UC1', noExport: true,
    cols: ['STT', 'Mã chỉ số', 'Tên chỉ số', 'Trụ cột', 'Nhóm chỉ số', 'Chỉ số con', 'Điểm tối thiểu', 'Điểm tối đa', 'Trạng thái', 'Thao tác'],
    kwCode: { label: 'mã chỉ số' }, kwName: { label: 'tên chỉ số' } });
  c('IND-L12', 'B.I.3-UC1', 'Bộ lọc', 'Lọc theo trụ cột / nhóm chỉ số', 'Chức năng', 'Cao', '1. Chọn một trụ cột rồi một nhóm ở bộ lọc', 'Mọi dòng thuộc trụ cột/nhóm đã chọn');
  c('IND-L13', 'B.I.3-UC1', 'Bộ lọc', 'Lọc theo trạng thái khóa', 'Chức năng', 'Trung bình', '1. Chọn Đã khóa / Chưa khóa', 'Mọi dòng khớp trạng thái');
  c('IND-L14', 'B.I.3-UC1', 'Bộ lọc', 'Kết hợp từ khóa và bộ lọc', 'Chức năng', 'Trung bình', '1. Nhập từ khóa\n2. Chọn bộ lọc', 'Kết quả thỏa mãn đồng thời cả hai');
  c('IND-L15', 'B.I.3-UC1', 'Xem danh sách', 'Cấu trúc cha/con: cột "Chỉ số con" khớp số chỉ số con trong chi tiết', 'Nghiệp vụ', 'Trung bình', '1. Chọn chỉ số có chỉ số con\n2. Mở chi tiết', 'Số chỉ số con ở danh sách = số dòng bảng "Chỉ số con"', 'UC nêu "danh sách, dạng cây…"');
  c('IND-V01', 'B.I.3-UC1', 'Xem chi tiết', 'Chi tiết chỉ số hiển thị mã, vị trí (trụ cột>nhóm), loại, điểm tối thiểu–tối đa, thứ tự, mô tả, chỉ số con, bộ chỉ số đang sử dụng', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" một chỉ số', 'Hiển thị đủ; có nút Khóa chỉ số, Cập nhật, Thêm chỉ số con; chưa có mô tả → "Chưa có mô tả"');
  c('IND-V02', 'B.I.3-UC1', 'Xem chi tiết', 'Mở chi tiết chỉ số với id không tồn tại không gây lỗi hệ thống', 'Validate', 'Trung bình', '1. [API] GET /dti/indicators/<id lạ>\n2. Mở URL id lạ', 'API 4xx (không 500); không lộ lỗi');
  c('IND-V03', 'B.I.3-UC1', 'Xem chi tiết', 'Bảng "Bộ chỉ số đang sử dụng" liệt kê đúng bộ chỉ số chứa chỉ số', 'Nghiệp vụ', 'Trung bình', '1. Chỉ số đã đưa vào một bộ chỉ số\n2. Mở chi tiết', 'Bộ chỉ số đó xuất hiện trong bảng');
  c('IND-C01', 'B.I.3-UC2', 'Thêm mới', 'Thêm chỉ số đầy đủ (trụ cột, nhóm, mã, tên, mô tả, điểm min/max) thành công', 'Chức năng', 'Cao', '1. Bấm "Thêm mới chỉ số"\n2. Chọn trụ cột, nhóm; nhập mã, tên, mô tả, điểm\n3. Lưu', 'Thành công; chỉ số hiện ở danh sách với đúng trụ cột, nhóm, điểm; trạng thái Chưa khóa');
  c('IND-C02', 'B.I.3-UC2', 'Thêm mới', 'Bỏ trống Trụ cột/Nhóm/Mã/Tên thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc từng trường; không tạo');
  c('IND-C03', 'B.I.3-UC2', 'Thêm mới', 'Trùng mã chỉ số bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo chỉ số A\n2. Tạo chỉ số B cùng mã', 'Báo mã đã tồn tại; chỉ 1 bản ghi');
  c('IND-C04', 'B.I.3-UC2', 'Thêm mới', 'Danh sách Nhóm chỉ số phụ thuộc Trụ cột đã chọn; Chỉ số cha phụ thuộc Nhóm', 'Nghiệp vụ', 'Trung bình', '1. Chưa chọn trụ cột → mở select Nhóm\n2. Chọn trụ cột → Nhóm\n3. Mở select Chỉ số cha', 'Select Nhóm bị vô hiệu cho đến khi chọn trụ cột; Chỉ số cha hiện "Chọn nhóm chỉ số trước"; sau khi chọn chỉ liệt kê mục thuộc trụ cột/nhóm đó');
  c('IND-C05', 'B.I.3-UC2', 'Thêm mới', 'Thêm chỉ số con (chọn Chỉ số cha) thành công', 'Chức năng', 'Cao', '1. Thêm chỉ số chọn Chỉ số cha\n2. Lưu', 'Chỉ số con được tạo; cột "Chỉ số con" của cha tăng 1; chi tiết cha liệt kê con');
  c('IND-C06', 'B.I.3-UC2', 'Thêm mới', 'Điểm tối thiểu lớn hơn điểm tối đa bị chặn', 'Validate', 'Cao', '1. Nhập min=10, max=5\n2. Lưu', 'Báo "Điểm tối thiểu không được lớn hơn điểm tối đa" (UI và API 400); không tạo');
  c('IND-C07', 'B.I.3-UC2', 'Thêm mới', 'Điểm âm hoặc vượt 1000 bị chặn', 'Validate', 'Cao', '1. Nhập -5 rồi 1001', 'Báo "Điểm phải nằm trong khoảng từ 0 đến 1000"');
  c('IND-C08', 'B.I.3-UC2', 'Thêm mới', 'Biên điểm: 0 và 1000 hợp lệ; min = max hợp lệ', 'Validate', 'Trung bình', '1. Tạo chỉ số min=0,max=1000\n2. Tạo chỉ số min=max=5', 'Lưu thành công, hiển thị đúng điểm');
  c('IND-C09', 'B.I.3-UC2', 'Thêm mới', 'Điểm nhập không phải số / có phần thập phân', 'Validate', 'Trung bình', '1. Nhập "abc"; nhập 2.55; nhập 2,5', 'Chữ bị chặn; số thập phân được lưu/hiển thị đúng hoặc báo rõ ràng', BA + ' số thập phân');
  c('IND-C10', 'B.I.3-UC2', 'Thêm mới', 'Chỉ số không nhập điểm tối thiểu/tối đa', 'Nghiệp vụ', 'Trung bình', '1. Để trống 2 ô điểm\n2. Lưu', 'Theo quy tắc: bắt buộc nhập điểm hoặc mặc định 0 và hiển thị rõ', 'Khảo sát: API nhận chỉ số không có điểm. ' + BA);
  c('IND-C11', 'B.I.3-UC2', 'Thêm mới', 'Điểm tối đa của chỉ số con không được vượt điểm tối đa chỉ số cha', 'Nghiệp vụ', 'Cao', '1. Cha max=10\n2. Thêm con max=50', 'Bị chặn / điểm cha tự = tổng điểm các con (SRS BR-12)', 'Khảo sát: API nhận con max 50 dưới cha max 10 → nghi lỗi. ' + BA);
  c('IND-C12', 'B.I.3-UC2', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Nhập dữ liệu\n2. Huỷ', 'Không có chỉ số mới');
  c('IND-C13', 'B.I.3-UC2', 'Thêm mới', 'Mã chỉ số 50 ký tự được nhận, 51 ký tự bị chặn', 'Validate', 'Trung bình', '1. Nhập mã 50 rồi 51 ký tự', '51 ký tự báo vượt giới hạn');
  c('IND-C14', 'B.I.3-UC2', 'Thêm mới', '[API] Thiếu trường bắt buộc / nhóm không thuộc trụ cột bị từ chối 4xx', 'Validate', 'Trung bình', '1. [API] POST thiếu mã/tên\n2. [API] POST nhóm của trụ cột khác', 'HTTP 400 có thông báo; không 500');
  c('IND-E01', 'B.I.3-UC5', 'Chỉnh sửa', 'Sửa tên và mô tả chỉ số chưa khóa thành công', 'Chức năng', 'Cao', '1. Menu → Cập nhật\n2. Đổi tên, mô tả\n3. Lưu', 'Dữ liệu mới hiển thị ở danh sách và chi tiết');
  c('IND-E02', 'B.I.3-UC5', 'Chỉnh sửa', 'Xóa trắng tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc');
  c('IND-E03', 'B.I.3-UC5', 'Chỉnh sửa', 'Hủy chỉnh sửa không đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Huỷ', 'Dữ liệu giữ nguyên');
  c('IND-E04', 'B.I.3-UC5', 'Chỉnh sửa', '[API] Sửa chỉ số đã khóa bị từ chối', 'Nghiệp vụ', 'Cao', '1. Khóa chỉ số\n2. [API] PUT đổi tên', 'HTTP 400 "Chỉ số đã bị khoá, không thể chỉnh sửa"');
  c('IND-E05', 'B.I.3-UC6', 'Cập nhật chỉ số cha', 'Đổi chỉ số cha của một chỉ số thành công', 'Chức năng', 'Cao', '1. Cập nhật chỉ số → chọn chỉ số cha khác cùng nhóm\n2. Lưu', 'Chỉ số chuyển sang cha mới; "Chỉ số con" của cha cũ giảm 1, cha mới tăng 1');
  c('IND-E06', 'B.I.3-UC6', 'Cập nhật chỉ số cha', 'Bỏ chỉ số cha → trở thành chỉ số gốc', 'Chức năng', 'Trung bình', '1. Cập nhật chỉ số con → để trống Chỉ số cha', 'Chỉ số thành chỉ số gốc của nhóm');
  c('IND-E07', 'B.I.3-UC6', 'Cập nhật chỉ số cha', 'Không chọn chính nó hoặc chỉ số con của nó làm cha (vòng lặp)', 'Nghiệp vụ', 'Cao', '1. Cập nhật chỉ số A → chọn Cha = chính A hoặc con của A', 'Không có trong danh sách chọn / bị từ chối; không tạo vòng lặp');
  c('IND-E08', 'B.I.4-UC1', 'Cấu hình điểm', 'Sửa điểm tối đa của chỉ số', 'Chức năng', 'Cao', '1. Cập nhật → đổi điểm tối đa\n2. Lưu', 'Điểm tối đa mới ở danh sách/chi tiết; tổng điểm nhóm/trụ cột cập nhật theo');
  c('IND-E09', 'B.I.4-UC2', 'Cấu hình điểm', 'Sửa điểm tối thiểu của chỉ số', 'Chức năng', 'Cao', '1. Cập nhật → đổi điểm tối thiểu\n2. Lưu', 'Điểm tối thiểu mới được lưu');
  c('IND-E10', 'B.I.4-UC2', 'Cấu hình điểm', 'Sửa điểm làm min > max bị chặn', 'Validate', 'Cao', '1. Cập nhật → đặt min lớn hơn max', 'Báo lỗi; dữ liệu giữ nguyên');
  c('IND-E11', 'B.I.4-UC1', 'Cấu hình điểm', 'Giảm điểm tối đa của cha thấp hơn tổng điểm con', 'Nghiệp vụ', 'Trung bình', '1. Cha có con tổng max=30\n2. Sửa max cha=10', 'Bị chặn hoặc cảnh báo theo quy tắc điểm', BA);
  c('IND-K01', 'B.I.3-UC3', 'Khóa/Mở khóa', 'Khóa chỉ số (menu và nút "Khóa chỉ số" ở chi tiết)', 'Chức năng', 'Cao', '1. Menu → Khoá (hoặc nút ở chi tiết)\n2. Xác nhận', 'Đã khóa; menu còn Mở khoá, Nhân bản (không Cập nhật/Xoá)');
  c('IND-K02', 'B.I.3-UC3', 'Khóa/Mở khóa', 'Mở khóa chỉ số → sửa/xóa lại được', 'Chức năng', 'Cao', '1. Menu → Mở khoá', 'Chưa khóa; menu có Khoá, Nhân bản, Cập nhật, Xoá');
  c('IND-K03', 'B.I.3-UC3', 'Khóa/Mở khóa', 'Chỉ chỉ số đã khóa mới đưa được vào bộ chỉ số', 'Nghiệp vụ', 'Cao', '1. Mở cấu hình bộ chỉ số → chọn chỉ số', 'Chỉ liệt kê chỉ số Đã khóa', 'Suy từ quy tắc khóa — xác minh khi viết script');
  c('IND-D01', 'B.I.3-UC4', 'Xóa', 'Xóa chỉ số chưa khóa, không có con thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Chỉ số biến mất');
  c('IND-D02', 'B.I.3-UC4', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Không', 'Chỉ số còn nguyên');
  c('IND-D03', 'B.I.3-UC4', 'Xóa', 'Chỉ số đã khóa không xóa được (UI ẩn Xoá, API 400)', 'Nghiệp vụ', 'Cao', '1. Khóa chỉ số\n2. [API] DELETE', 'API 400 "Chỉ số đã bị khoá, không thể xóa"');
  c('IND-D04', 'B.I.3-UC4', 'Xóa', 'Xóa chỉ số đang có chỉ số con trả lỗi nghiệp vụ, không phải 500', 'Nghiệp vụ', 'Cao', '1. Chỉ số cha (mở khóa) có con\n2. Xóa (UI và [API])', 'Bị chặn với thông báo rõ ràng (4xx); không lộ lỗi nội bộ', 'Khảo sát: API trả HTTP 500 lộ "An error occurred while saving the entity changes…" → nghi lỗi');
  c('IND-D05', 'B.I.3-UC4', 'Xóa', 'Chỉ số đang được bộ chỉ số sử dụng không xóa được', 'Nghiệp vụ', 'Cao', '1. Chỉ số nằm trong bộ chỉ số\n2. Xóa', 'Bị chặn; chỉ số và bộ chỉ số còn nguyên', BA);
  c('IND-N01', 'B.I.5-UC1', 'Nhân bản', 'Nhân bản chỉ số tạo bản sao tên "(Bản sao)", mã mới, trạng thái Chưa khóa', 'Chức năng', 'Cao', '1. Menu → Nhân bản', 'Xuất hiện chỉ số mới có hậu tố "(Bản sao)", mã không trùng, Chưa khóa, điểm/nhóm giống bản gốc');
  c('IND-N02', 'B.I.5-UC1', 'Nhân bản', 'Nhân bản chỉ số đã khóa vẫn được và bản sao Chưa khóa', 'Nghiệp vụ', 'Trung bình', '1. Khóa chỉ số\n2. Menu → Nhân bản', 'Bản sao tạo được, Chưa khóa; bản gốc vẫn Đã khóa');
  c('IND-N03', 'B.I.5-UC1', 'Nhân bản', 'Nhân bản nhiều lần cho mã duy nhất, không trùng', 'Nghiệp vụ', 'Trung bình', '1. Nhân bản cùng một chỉ số 3 lần', '3 bản sao mã khác nhau');
  c('IND-N04', 'B.I.5-UC1', 'Nhân bản', 'Nhân bản chỉ số có chỉ số con', 'Nghiệp vụ', 'Trung bình', '1. Nhân bản chỉ số cha có con', 'Bản sao có/không có chỉ số con theo quy tắc; không làm đổi chỉ số con của bản gốc', BA + ' có nhân bản cả chỉ số con');
  c('IND-N05', 'B.I.5-UC2', 'Nhân bản', 'Xem và sửa chỉ số vừa nhân bản; sửa không ảnh hưởng bản gốc', 'Chức năng', 'Cao', '1. Nhân bản\n2. Mở bản sao, đổi tên và điểm\n3. Xem bản gốc', 'Bản sao đổi; bản gốc không đổi');
  c('IND-N06', 'B.I.5-UC1', 'Nhân bản', 'Nhân bản id không tồn tại không gây lỗi', 'Validate', 'Thấp', '1. [API] POST nhân bản id lạ', 'HTTP 4xx, không 500');

  // ===================== B.II BỘ CHỈ SỐ =====================
  listSuite('SET', 'Bộ chỉ số', { ucList: 'B.II.1-UC1', ucSearch: 'B.II.1-UC1', ucExport: 'B.II.1-UC2',
    cols: ['STT', 'Mã bộ chỉ số', 'Tên bộ chỉ số', 'Phiên bản', 'Năm áp dụng', 'Nhóm chỉ số', 'Chỉ số', 'Trạng thái', 'Thao tác'],
    kwCode: { label: 'mã bộ chỉ số' }, kwName: { label: 'tên bộ chỉ số' }, exportNote: 'UC_1409 yêu cầu export danh mục; khảo sát: trang danh sách chưa có nút Xuất Excel → nghi chưa làm' });
  c('SET-L12', 'B.II.1-UC1', 'Bộ lọc', 'Lọc theo trạng thái / năm áp dụng', 'Chức năng', 'Trung bình', '1. Chọn bộ lọc trên trang', 'Mọi dòng khớp bộ lọc');
  c('SET-L13', 'B.II.1-UC1', 'Xem danh sách', 'Trạng thái ở danh sách và ở chi tiết nhất quán', 'Nghiệp vụ', 'Trung bình', '1. Ghi trạng thái ở danh sách\n2. Mở chi tiết', 'Cùng một nhãn trạng thái', 'Khảo sát: danh sách "Đã khóa" nhưng chi tiết hiện "Đang áp dụng" → cần BA làm rõ hai trạng thái');
  c('SET-V01', 'B.II.1-UC3', 'Xem chi tiết', 'Chi tiết bộ chỉ số hiển thị mã, phiên bản, năm áp dụng, cấu trúc (trụ cột·nhóm·chỉ số), tổng điểm tối đa, mô tả', 'Chức năng', 'Cao', '1. Bấm "Xem chi tiết" một bộ chỉ số', 'Hiển thị đủ; có nút Xuất Excel, Cập nhật thông tin, Cấu hình bộ chỉ số', 'UC_1409 ghi "chưa update UI mới"');
  c('SET-V02', 'B.II.1-UC4', 'Xem chi tiết', 'Cấu trúc bộ chỉ số hiển thị trụ cột → nhóm → chỉ số với điểm tối đa, có Mở rộng tất cả / Thu gọn', 'Chức năng', 'Cao', '1. Mở chi tiết\n2. Bấm "Mở rộng tất cả" rồi "Thu gọn"', 'Cây hiển thị đủ các cấp, mở/đóng đúng; điểm tối đa từng cấp');
  c('SET-V03', 'B.II.1-UC4', 'Xem chi tiết', 'Tổng điểm tối đa bộ chỉ số bằng tổng điểm các chỉ số tính điểm', 'Nghiệp vụ', 'Cao', '1. Mở chi tiết bộ có nhiều chỉ số', 'Tổng điểm = tổng điểm tối đa của các trụ cột; số trụ cột·nhóm·chỉ số khớp danh sách');
  c('SET-V04', 'B.II.1-UC5', 'Xem chi tiết', 'Xuất Excel dữ liệu bộ chỉ số ở chi tiết tải được file', 'Chức năng', 'Trung bình', '1. Mở chi tiết\n2. Bấm Xuất Excel', 'Tải về file .xlsx chứa cấu trúc bộ chỉ số', 'UC_1409 dòng 128');
  c('SET-V05', 'B.II.1-UC3', 'Xem chi tiết', 'Mở chi tiết bộ chỉ số với id không tồn tại không gây lỗi hệ thống', 'Validate', 'Trung bình', '1. [API] GET /dti/indicator-sets/<id lạ>\n2. Mở URL id lạ', 'API 4xx; không 500');
  c('SET-V06', 'B.II.1-UC3', 'Xem chi tiết', 'Bảng kỳ tự đánh giá đang sử dụng bộ chỉ số', 'Nghiệp vụ', 'Thấp', '1. Mở chi tiết bộ chỉ số đã gán kỳ', 'Hiển thị đúng kỳ đang dùng; số kỳ khớp cột campaignCount');
  c('SET-C01', 'B.II.1-UC6', 'Thêm mới', 'Thêm bộ chỉ số (mã, tên, năm áp dụng, mô tả) thành công', 'Chức năng', 'Cao', '1. Bấm "Thêm mới bộ chỉ số"\n2. Nhập mã, tên, chọn năm, mô tả\n3. Lưu', 'Thành công; bộ chỉ số hiện, phiên bản mặc định v1, chưa có nhóm/chỉ số');
  c('SET-C02', 'B.II.1-UC6', 'Thêm mới', 'Bỏ trống Mã/Tên thì báo lỗi bắt buộc', 'Validate', 'Cao', '1. Bấm Lưu khi chưa nhập', 'Báo lỗi bắt buộc; không tạo');
  c('SET-C03', 'B.II.1-UC6', 'Thêm mới', 'Trùng mã bộ chỉ số bị từ chối', 'Nghiệp vụ', 'Cao', '1. Tạo bộ A\n2. Tạo bộ B cùng mã', 'Báo "Mã bộ chỉ số đã tồn tại"');
  c('SET-C04', 'B.II.1-UC6', 'Thêm mới', 'Năm áp dụng ngoài khoảng hợp lý hoặc để trống', 'Validate', 'Trung bình', '1. [API] Tạo bộ với năm 1999, 3000, không có năm', 'Bị chặn hoặc báo bắt buộc theo quy tắc', 'Khảo sát: API nhận cả 1999, 3000 và không năm → nghi thiếu validate. ' + BA + ' khoảng năm');
  c('SET-C05', 'B.II.1-UC6', 'Thêm mới', 'Hủy form thêm mới không tạo bản ghi', 'Chức năng', 'Trung bình', '1. Nhập dữ liệu\n2. Huỷ', 'Không có bộ mới');
  c('SET-C06', 'B.II.1-UC6', 'Thêm mới', 'Mã bộ chỉ số 50 ký tự được nhận, 51 ký tự bị chặn', 'Validate', 'Trung bình', '1. Nhập mã 50 rồi 51 ký tự', '51 ký tự báo vượt giới hạn');
  c('SET-C07', 'B.II.1-UC6', 'Thêm mới', '[API] Mã hoặc tên rỗng bị từ chối bằng HTTP 400', 'Validate', 'Trung bình', '1. [API] POST name rỗng / code rỗng', 'HTTP 400 có thông báo');
  c('SET-E01', 'B.II.1-UC9', 'Chỉnh sửa', 'Cập nhật thông tin bộ chỉ số (tên, mô tả) thành công', 'Chức năng', 'Cao', '1. Chi tiết → Cập nhật thông tin\n2. Đổi tên, mô tả\n3. Lưu', 'Dữ liệu mới hiển thị ở chi tiết và danh sách');
  c('SET-E02', 'B.II.1-UC9', 'Chỉnh sửa', 'Cập nhật thời gian sử dụng (năm áp dụng)', 'Chức năng', 'Cao', '1. Cập nhật thông tin → đổi năm áp dụng\n2. Lưu', 'Năm áp dụng mới hiển thị; cột danh sách cập nhật');
  c('SET-E03', 'B.II.1-UC9', 'Chỉnh sửa', 'Xóa trắng tên khi sửa bị chặn', 'Validate', 'Trung bình', '1. Xóa tên\n2. Lưu', 'Báo lỗi bắt buộc');
  c('SET-E04', 'B.II.1-UC9', 'Chỉnh sửa', 'Hủy chỉnh sửa không đổi dữ liệu', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Huỷ', 'Dữ liệu giữ nguyên');
  c('SET-E05', 'B.II.1-UC9', 'Chỉnh sửa', 'Bộ chỉ số đã khóa không sửa được thông tin / cấu trúc', 'Nghiệp vụ', 'Cao', '1. Khóa bộ chỉ số\n2. Thử Cập nhật thông tin, Cấu hình (UI và [API] PUT)', 'Thao tác bị ẩn/từ chối; dữ liệu giữ nguyên', 'Khảo sát: API PUT bộ chỉ số (chưa khóa trạng thái đã kiểm) — xác minh khi viết script');
  c('SET-D01', 'B.II.1-UC7', 'Xóa', 'Xóa bộ chỉ số chưa khóa, chưa dùng thành công', 'Chức năng', 'Cao', '1. Menu → Xoá\n2. Xác nhận', 'Bộ chỉ số biến mất');
  c('SET-D02', 'B.II.1-UC7', 'Xóa', 'Chọn "Không" ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xoá\n2. Không', 'Còn nguyên');
  c('SET-D03', 'B.II.1-UC7', 'Xóa', 'Bộ chỉ số đã khóa không xóa được (UI ẩn Xoá)', 'Nghiệp vụ', 'Cao', '1. Khóa bộ chỉ số\n2. Xem menu', 'Menu không có Xoá (chỉ Mở khoá, Nhân bản)');
  c('SET-D04', 'B.II.1-UC7', 'Xóa', 'Bộ chỉ số đang được kỳ tự đánh giá sử dụng không xóa được', 'Nghiệp vụ', 'Cao', '1. Bộ chỉ số có campaignCount>0\n2. Xóa', 'Bị chặn với thông báo; bộ còn nguyên', BA);
  c('SET-K01', 'B.II.1-UC8', 'Khóa/Mở khóa', 'Khóa bộ chỉ số → Đã khóa (cập nhật trạng thái)', 'Chức năng', 'Cao', '1. Menu → Khoá\n2. Xác nhận', 'Trạng thái "Đã khóa" ở danh sách và chi tiết');
  c('SET-K02', 'B.II.1-UC8', 'Khóa/Mở khóa', 'Mở khóa bộ chỉ số → Chưa khóa', 'Chức năng', 'Cao', '1. Menu → Mở khoá', 'Trạng thái Chưa khóa; cho sửa lại');
  c('SET-K03', 'B.II.4-UC1', 'Khóa/Mở khóa', 'Bộ chỉ số đã khóa mới chọn được khi tạo kỳ tự đánh giá', 'Nghiệp vụ', 'Cao', '1. Mở form tạo kỳ tự đánh giá → select Bộ chỉ số', 'Chỉ liệt kê bộ chỉ số Đã khóa (đưa vào sử dụng)');
  c('SET-K04', 'B.II.4-UC2', 'Khóa/Mở khóa', 'Mở khóa bộ chỉ số đang được kỳ sử dụng', 'Nghiệp vụ', 'Trung bình', '1. Bộ đã gán kỳ\n2. Mở khóa', 'Bị chặn hoặc cảnh báo theo quy tắc', BA);
  c('SET-S01', 'B.II.2-UC1', 'Cấu trúc', 'Xem danh sách nhóm chỉ số của bộ chỉ số', 'Chức năng', 'Cao', '1. Chi tiết bộ → Cấu hình bộ chỉ số', 'Hiển thị đúng các nhóm chỉ số của bộ, theo trụ cột');
  c('SET-S02', 'B.II.2-UC2', 'Cấu trúc', 'Thêm nhóm chỉ số vào bộ chỉ số', 'Chức năng', 'Cao', '1. Cấu hình → chọn nhóm chỉ số → Lưu', 'Nhóm xuất hiện trong cấu trúc; số nhóm bộ chỉ số tăng');
  c('SET-S03', 'B.II.2-UC2', 'Cấu trúc', 'Không thêm trùng một nhóm chỉ số hai lần vào cùng bộ', 'Nghiệp vụ', 'Trung bình', '1. Thêm nhóm đã có trong bộ', 'Nhóm đã có không chọn lại được / bị từ chối');
  c('SET-S04', 'B.II.2-UC2', 'Cấu trúc', 'Chỉ nhóm chỉ số đã khóa mới thêm vào bộ chỉ số được', 'Nghiệp vụ', 'Cao', '1. Mở danh sách chọn nhóm', 'Chỉ liệt kê nhóm Đã khóa');
  c('SET-S05', 'B.II.2-UC3', 'Cấu trúc', 'Chỉnh sửa thông tin nhóm chỉ số trong bộ chỉ số', 'Chức năng', 'Trung bình', '1. Sửa nhóm trong bộ (thứ tự/thông tin)\n2. Lưu', 'Thay đổi chỉ áp dụng trong bộ chỉ số; nhóm gốc không đổi');
  c('SET-S06', 'B.II.2-UC4', 'Cấu trúc', 'Xóa nhóm chỉ số khỏi bộ chỉ số', 'Chức năng', 'Cao', '1. Chọn xóa nhóm trong bộ\n2. Xác nhận', 'Nhóm (và chỉ số của nhóm) rời khỏi bộ; nhóm gốc còn nguyên', 'UC_1409 ghi "Chưa có thao tác xóa" → có thể FAIL');
  c('SET-S07', 'B.II.2-UC5', 'Cấu trúc', 'Thiết lập Tính điểm / Không tính điểm cho nhóm chỉ số trong bộ', 'Chức năng', 'Cao', '1. Đổi cờ tính điểm của nhóm\n2. Lưu', 'Tổng điểm bộ chỉ số tính lại: nhóm không tính điểm bị loại khỏi tổng');
  c('SET-I01', 'B.II.3-UC1', 'Nội dung', 'Xem danh sách chỉ số của bộ chỉ số', 'Chức năng', 'Cao', '1. Cấu hình bộ → xem chỉ số', 'Hiển thị đúng chỉ số theo nhóm, kèm điểm');
  c('SET-I02', 'B.II.3-UC2', 'Nội dung', 'Thêm chỉ số vào bộ chỉ số', 'Chức năng', 'Cao', '1. Chọn chỉ số (đã khóa) → Lưu', 'Chỉ số hiện trong bộ; tổng điểm cập nhật; cột "Bộ chỉ số đang sử dụng" của chỉ số có bộ này');
  c('SET-I03', 'B.II.3-UC2', 'Nội dung', 'Chỉ số phải thuộc nhóm đã có trong bộ; không thêm trùng', 'Nghiệp vụ', 'Trung bình', '1. Thêm chỉ số của nhóm chưa có trong bộ\n2. Thêm chỉ số đã có', 'Bị chặn hoặc tự thêm nhóm theo quy tắc; chỉ số đã có không chọn lại', BA);
  c('SET-I04', 'B.II.3-UC3', 'Nội dung', 'Chỉnh sửa thông tin chỉ số trong bộ chỉ số', 'Chức năng', 'Trung bình', '1. Sửa chỉ số trong bộ\n2. Lưu', 'Chỉ áp dụng trong bộ; chỉ số gốc không đổi');
  c('SET-I05', 'B.II.3-UC4', 'Nội dung', 'Xóa chỉ số khỏi bộ chỉ số', 'Chức năng', 'Cao', '1. Xóa chỉ số trong bộ\n2. Xác nhận', 'Chỉ số rời bộ; chỉ số gốc còn; tổng điểm cập nhật');
  c('SET-I06', 'B.II.3-UC5', 'Nội dung', 'Thiết lập Tính điểm / Không tính điểm cho chỉ số trong bộ', 'Chức năng', 'Cao', '1. Đổi cờ tính điểm chỉ số\n2. Lưu', 'Chỉ số không tính điểm bị loại khỏi tổng điểm tối đa');
  c('SET-I07', 'B.II.3-UC6', 'Nội dung', 'Chỉnh sửa điểm của chỉ số trong bộ chỉ số', 'Chức năng', 'Cao', '1. Sửa điểm tối đa chỉ số trong bộ\n2. Lưu', 'Điểm mới áp dụng trong bộ; tổng điểm tính lại; chỉ số gốc không đổi');
  c('SET-I08', 'B.II.3-UC6', 'Nội dung', 'Điểm chỉnh sửa trong bộ phải hợp lệ (min ≤ max, 0–1000)', 'Validate', 'Cao', '1. Nhập điểm min>max hoặc âm', 'Báo lỗi; không lưu');
  c('SET-N01', 'B.II.5-UC1', 'Nhân bản', 'Nhân bản bộ chỉ số tạo bộ mới, giữ nguyên cấu trúc', 'Chức năng', 'Cao', '1. Menu → Nhân bản', 'Bộ mới có mã mới, Chưa khóa, cùng số nhóm/chỉ số và tổng điểm với bản gốc');
  c('SET-N02', 'B.II.5-UC1', 'Nhân bản', 'Nhân bản bộ chỉ số đã khóa vẫn được, bản sao Chưa khóa', 'Nghiệp vụ', 'Trung bình', '1. Khóa bộ\n2. Nhân bản', 'Menu Nhân bản có ở bộ đã khóa; bản sao Chưa khóa');
  c('SET-N03', 'B.II.5-UC1', 'Nhân bản', 'Nhân bản nhiều lần cho mã duy nhất', 'Nghiệp vụ', 'Trung bình', '1. Nhân bản cùng bộ 3 lần', 'Mã/tên không trùng');
  c('SET-N04', 'B.II.5-UC2', 'Nhân bản', 'Xem và sửa chỉ số của bộ vừa nhân bản; không ảnh hưởng bản gốc', 'Chức năng', 'Cao', '1. Nhân bản\n2. Sửa điểm/xóa chỉ số ở bản sao\n3. Xem bản gốc', 'Bản gốc không đổi');
  c('SET-N05', 'B.II.5-UC1', 'Nhân bản', 'Nhân bản id không tồn tại không gây lỗi', 'Validate', 'Thấp', '1. [API] POST nhân bản id lạ', '4xx, không 500');

  // ===================== B.TXL THANG XẾP LOẠI (SRS Nhóm 1, UC1.1–1.7) =====================
  const SRS = 'SRS 3.1.';
  listSuite('SCL', 'Thang xếp loại', { ucList: 'B.TXL-UC1', ucSearch: 'B.TXL-UC1', ucExport: 'B.TXL-UC1', noExport: true,
    cols: ['Tên thang (mã ở dòng phụ)', 'Các mức', 'Số kỳ sử dụng', 'Trạng thái', 'Thao tác'],
    kwCode: { label: 'mã thang' }, kwName: { label: 'tên thang' }, perPageNote: 'Dữ liệu thang ít (≤ 10) nên có thể Skipped nếu không đủ trang' });
  c('SCL-L12', 'B.TXL-UC1', 'Bộ lọc', 'Bộ lọc Trạng thái gồm Tất cả/Chưa khóa/Đã khóa, mặc định Tất cả (BR-5)', 'Chức năng', 'Cao', '1. Mở trang, xem bộ lọc\n2. Chọn từng giá trị', 'Mặc định "Tất cả"; mỗi giá trị chỉ hiện thang đúng trạng thái');
  c('SCL-L13', 'B.TXL-UC1', 'Bộ lọc', 'Tìm kiếm kết hợp với bộ lọc trạng thái (BR-5)', 'Chức năng', 'Trung bình', '1. Nhập từ khóa\n2. Chọn trạng thái', 'Kết quả thỏa mãn đồng thời cả hai');
  c('SCL-L14', 'B.TXL-UC1', 'Xem danh sách', 'Mỗi dòng gồm Tên thang kèm mã ở dòng phụ, thanh các mức nhiều màu, tên mức cách nhau dấu chấm giữa (BR-2, BR-3)', 'UI', 'Trung bình', '1. Xem một dòng thang', 'Có mã dòng phụ; thanh các mức rộng theo khoảng điểm; tên mức liệt kê cách nhau "·"');
  c('SCL-L15', 'B.TXL-UC1', 'Xem danh sách', 'Số kỳ sử dụng đếm theo từng bộ chỉ số; thang chưa dùng hiển thị "Chưa dùng" (BR-4)', 'Nghiệp vụ', 'Trung bình', '1. Xem cột Số kỳ sử dụng của thang đã/chưa gán', 'Thang đã gán: số = số kỳ (mỗi bộ chỉ số tính một kỳ); chưa gán: "Chưa dùng"');
  c('SCL-L16', 'B.TXL-UC1', 'Xem danh sách', 'Menu thao tác: "Xem" luôn đứng đầu, các mục còn lại theo quyền và trạng thái (BR-6)', 'Chức năng', 'Trung bình', '1. Mở menu thao tác thang Chưa khóa / Đã khóa chưa gán / Đã gán', 'Xem đứng đầu; Chưa khóa: Sửa, Khóa, Xóa; Đã khóa chưa gán: Sửa, Mở khóa, Xóa; Đã gán: chỉ Xem');
  c('SCL-L17', 'B.TXL-UC1', 'Xem danh sách', 'Chưa có thang nào: hiển thị "Chưa có dữ liệu" kèm nút + Thêm thang xếp loại (BR-1)', 'UI', 'Thấp', '1. Hệ thống không có thang', 'Trạng thái rỗng MSG-022 kèm nút thêm', '', );
  c('SCL-V01', 'B.TXL-UC2', 'Xem chi tiết', 'Thông tin chung: Mã thang, Số mức, Số kỳ sử dụng ("Chưa dùng" nếu chưa gán), Mô tả (BR-1)', 'Chức năng', 'Cao', '1. Chọn Xem một thang', 'Hiển thị đủ 4 mục; thang chưa gán: "Chưa dùng"');
  c('SCL-V02', 'B.TXL-UC2', 'Xem chi tiết', 'Bảng các mức: STT, Tên mức, Từ(%), Đến dưới(%), Tương đương trên 1.000 điểm; mức cuối ghi "gồm 100" (BR-2)', 'Chức năng', 'Cao', '1. Mở chi tiết thang nhiều mức', 'Đủ cột; mức cuối "Đến dưới = 100 (gồm 100)"');
  c('SCL-V03', 'B.TXL-UC2', 'Xem chi tiết', 'Tương đương trên 1.000 điểm = Từ×10 đến Đến dưới×10, mức cuối đến 1.000 (BR-3)', 'Nghiệp vụ', 'Cao', '1. Thang 0–40, 40–90, 90–100', '"0 - dưới 400", "400 - dưới 900", "900 - 1.000"');
  c('SCL-V04', 'B.TXL-UC2', 'Xem chi tiết', 'Thanh các mức có mốc từ 0% đến 100% bên dưới (BR-4)', 'UI', 'Thấp', '1. Mở chi tiết', 'Thanh mức có mốc 0%…100%');
  c('SCL-V05', 'B.TXL-UC2', 'Xem chi tiết', 'Bảng Kỳ sử dụng: Tên đánh giá, Phân loại, Bộ chỉ số, Thời gian; 10 kỳ/trang; chưa gán → "Chưa có dữ liệu" (BR-5)', 'Chức năng', 'Trung bình', '1. Mở chi tiết thang đã gán / chưa gán', 'Bảng đủ cột, phân trang 10; chưa gán: MSG-022');
  c('SCL-V06', 'B.TXL-UC2', 'Xem chi tiết', 'Thang đã gán cho kỳ: cảnh báo MSG-104 và không có nút thao tác (BR-6)', 'Nghiệp vụ', 'Cao', '1. Mở chi tiết thang đã gán', 'Cảnh báo "Thang xếp loại đang được kỳ sử dụng nên không thể sửa, mở khóa hoặc xóa"; không nút Sửa/Khóa/Mở khóa/Xóa');
  c('SCL-V07', 'B.TXL-UC2', 'Xem chi tiết', 'Nút trên đầu trang hiển thị theo quyền, Sửa là nút chính (BR-7)', 'Chức năng', 'Trung bình', '1. Mở chi tiết thang chưa gán với tài khoản đủ quyền', 'Có Sửa (nút chính), Khóa/Mở khóa, Xóa theo trạng thái');
  c('SCL-V08', 'B.TXL-UC2', 'Xem chi tiết', 'Mở chi tiết thang với id không tồn tại không gây lỗi hệ thống', 'Validate', 'Trung bình', '1. [API] GET /dti/score-scales/<id lạ>\n2. Mở URL id lạ', 'API 4xx; không 500; trang không trắng');
  c('SCL-C01', 'B.TXL-UC3', 'Thêm mới', 'Thêm thang hợp lệ thành công: mã TXL-nnn tự sinh, trạng thái Chưa khóa, mở chi tiết', 'Chức năng', 'Cao', '1. + Thêm thang xếp loại\n2. Nhập tên, các mức phủ 0–100%\n3. Lưu', 'Tạo thành công; mã dạng TXL-nnn; Chưa khóa; chuyển sang màn chi tiết');
  c('SCL-C02', 'B.TXL-UC3', 'Thêm mới', 'Mã thang không nhập được, trước khi lưu hiển thị "Tự động sinh khi lưu" (BR-1)', 'UI', 'Trung bình', '1. Mở form thêm', 'Ô mã chỉ-đọc, hiển thị "Tự động sinh khi lưu"');
  c('SCL-C03', 'B.TXL-UC3', 'Thêm mới', 'Mã đã cấp không được dùng lại sau khi xóa (BR-1)', 'Nghiệp vụ', 'Trung bình', '1. Tạo thang (mã TXL-n)\n2. Xóa\n3. Tạo thang mới', 'Thang mới có mã lớn hơn, không trùng mã đã xóa');
  c('SCL-C04', 'B.TXL-UC3', 'Thêm mới', 'Tên thang rỗng báo "Vui lòng nhập Tên thang" (BR-2, MSG-010)', 'Validate', 'Cao', '1. Để trống tên\n2. Xem lỗi/nút Lưu', 'Báo lỗi bắt buộc; Lưu bị vô hiệu');
  c('SCL-C05', 'B.TXL-UC3', 'Thêm mới', 'Tên thang đúng 200 ký tự được nhận, 201 ký tự báo "Tên thang tối đa 200 ký tự" (BR-2, MSG-013)', 'Validate', 'Cao', '1. Nhập tên 200 rồi 201 ký tự', '200: hợp lệ; 201: báo MSG-013');
  c('SCL-C06', 'B.TXL-UC3', 'Thêm mới', 'Mô tả không bắt buộc, nhập nhiều dòng được lưu nguyên (BR-2)', 'Chức năng', 'Thấp', '1. Nhập mô tả nhiều dòng\n2. Lưu', 'Mô tả hiển thị đủ các dòng ở chi tiết');
  c('SCL-C07', 'B.TXL-UC3', 'Thêm mới', 'Chỉ có 1 mức báo "Thang xếp loại cần ít nhất 2 mức" (BR-3, MSG-109)', 'Validate', 'Cao', '1. Chỉ nhập 1 mức (đến dưới 100)', 'Báo MSG-109; không lưu được');
  c('SCL-C08', 'B.TXL-UC3', 'Thêm mới', 'Thang nhiều mức (≥ 10) vẫn lưu được — không giới hạn số mức (BR-3)', 'Chức năng', 'Trung bình', '1. Tạo thang 10 mức', 'Lưu thành công');
  c('SCL-C09', 'B.TXL-UC3', 'Thêm mới', 'Mức cuối chưa đến 100% hoặc chưa nhập mốc báo MSG-107 (BR-4)', 'Validate', 'Cao', '1. Nhập mức cuối đến 90', 'Báo "Thang xếp loại phải phủ đủ từ 0 đến 100%. Nhập 100 ở mức cuối"');
  c('SCL-C10', 'B.TXL-UC3', 'Thêm mới', 'Mức đầu bắt đầu từ 0; "Từ" của mức sau tự lấy bằng "Đến dưới" mức trước và không nhập được (BR-4, BR-5)', 'Nghiệp vụ', 'Cao', '1. Nhập Đến dưới mức 1 = 40\n2. Xem ô Từ mức 2', 'Từ mức 1 = 0 (chỉ-đọc); Từ mức 2 = 40 (chỉ-đọc)');
  c('SCL-C11', 'B.TXL-UC3', 'Thêm mới', 'Đến dưới để trống báo "Vui lòng nhập Đến dưới (%)" (BR-6, MSG-010)', 'Validate', 'Cao', '1. Để trống Đến dưới ở một mức', 'Báo MSG-010');
  c('SCL-C12', 'B.TXL-UC3', 'Thêm mới', 'Đến dưới quá 2 chữ số thập phân báo MSG-016; 2 chữ số hợp lệ lưu đúng (BR-6)', 'Validate', 'Trung bình', '1. Nhập 33.333\n2. Nhập 33.33', '33.333 báo "tối đa 2 chữ số thập phân"; 33.33 lưu và hiển thị đúng');
  c('SCL-C13', 'B.TXL-UC3', 'Thêm mới', 'Đến dưới không lớn hơn Từ báo "Đến dưới phải lớn hơn Từ ({Từ}%)" (BR-6, MSG-105)', 'Validate', 'Cao', '1. Mức 1 đến 40, mức 2 đến 40 hoặc 30', 'Báo MSG-105 với giá trị Từ đúng');
  c('SCL-C14', 'B.TXL-UC3', 'Thêm mới', 'Đến dưới ngoài khoảng 0–100 (âm, >100) báo MSG-015 (BR-6)', 'Validate', 'Cao', '1. Nhập -1 và 101', 'Báo ngoài khoảng cho phép');
  c('SCL-C15', 'B.TXL-UC3', 'Thêm mới', 'Mốc 100 chỉ dùng cho mức cuối, nhập 100 ở mức khác báo MSG-106 (BR-7)', 'Validate', 'Cao', '1. Có 3 mức, nhập 100 ở mức 2', 'Báo "Mốc 100 chỉ dùng cho mức cuối"');
  c('SCL-C16', 'B.TXL-UC3', 'Thêm mới', 'Tên mức bắt buộc, tối đa 50 ký tự (BR-8, MSG-010/013)', 'Validate', 'Cao', '1. Để trống tên mức\n2. Nhập 50 và 51 ký tự', 'Trống: MSG-010; 51 ký tự: MSG-013; 50 hợp lệ');
  c('SCL-C17', 'B.TXL-UC3', 'Thêm mới', 'Tên mức không trùng trong một thang, không phân biệt hoa/thường (BR-8, MSG-014)', 'Validate', 'Cao', '1. Hai mức tên "Tốt" và "tốt"', 'Báo "Tên mức đã tồn tại"');
  c('SCL-C18', 'B.TXL-UC3', 'Thêm mới', 'Nhập Đến dưới <100 ở dòng cuối thì tự thêm dòng mức tiếp theo, con trỏ vào Tên mức (BR-9)', 'Chức năng', 'Trung bình', '1. Nhập Đến dưới 50 ở dòng cuối', 'Xuất hiện dòng mới, focus ở Tên mức; dòng tự thêm chưa nhập không tính là mức');
  c('SCL-C19', 'B.TXL-UC3', 'Thêm mới', 'Xóa mức giữa: khoảng gộp vào mức sau và hiện MSG-110 (BR-10)', 'Chức năng', 'Trung bình', '1. Thang 3 mức\n2. Xóa mức 2', 'Thông báo "Đã xóa mức …. Khoảng a% đến b% gộp vào mức …"; mức 3 mở rộng');
  c('SCL-C20', 'B.TXL-UC3', 'Thêm mới', 'Xóa mức cuối: mức trước thành mức cuối đến 100% (BR-10)', 'Chức năng', 'Trung bình', '1. Thang 3 mức\n2. Xóa mức 3', 'Mức 2 thành mức cuối, đến 100%; có thông báo tương ứng');
  c('SCL-C21', 'B.TXL-UC3', 'Thêm mới', 'Xem trước: mức hợp lệ tô màu theo thứ tự, phần còn lại là vùng sọc xám "chưa có mức" (BR-11)', 'UI', 'Thấp', '1. Nhập một phần mức chưa tới 100%', 'Phần chưa phủ hiển thị sọc xám ghi "chưa có mức"');
  c('SCL-C22', 'B.TXL-UC3', 'Thêm mới', 'Thanh lưu: trạng thái "Còn n lỗi cần sửa" / "n mức, đủ 0 đến 100%, lưu được"; Lưu vô hiệu khi còn lỗi (BR-12)', 'Chức năng', 'Cao', '1. Nhập thang chưa hợp lệ\n2. Sửa cho hợp lệ', 'Nút Lưu disabled + thông điệp lỗi; hợp lệ: Lưu bật + thông điệp "lưu được"');
  c('SCL-C23', 'B.TXL-UC3', 'Thêm mới', 'Hủy/quay lại khi đã nhập hiện hộp thoại "Thoát khi chưa lưu" (BR-13, MSG-009)', 'Chức năng', 'Trung bình', '1. Nhập tên\n2. Bấm Huỷ', 'Hộp thoại "Các thay đổi chưa lưu sẽ bị mất. Bạn có muốn thoát không?"; Thoát → về danh sách, Ở lại → giữ form');
  c('SCL-C24', 'B.TXL-UC3', 'Thêm mới', 'Hủy khi chưa nhập gì thoát luôn, không tạo thang (BR-1, BR-13)', 'Chức năng', 'Trung bình', '1. Mở form thêm\n2. Bấm Huỷ ngay', 'Về danh sách, không hộp thoại, không có thang mới');
  c('SCL-C25', 'B.TXL-UC3', 'Thêm mới', '[API] Tạo thang không phủ 0–100% hoặc chỉ 1 mức bị từ chối 400', 'Validate', 'Cao', '1. [API] POST thang các mức 0–60 / 1 mức', 'HTTP 400 có thông báo; không tạo');
  c('SCL-C26', 'B.TXL-UC3', 'Thêm mới', '[API] Mức chồng lấn / không liên tục / tên rỗng bị từ chối 400', 'Validate', 'Trung bình', '1. [API] POST các mức có khoảng chồng, hở, tên mức rỗng', 'HTTP 400 có thông báo');
  c('SCL-E01', 'B.TXL-UC4', 'Chỉnh sửa', 'Sửa tên, mô tả, mức của thang Chưa khóa chưa gán thành công, giữ trạng thái (BR-2)', 'Chức năng', 'Cao', '1. Menu → Sửa\n2. Đổi tên và một mức\n3. Lưu', 'Chi tiết hiển thị dữ liệu mới; trạng thái vẫn Chưa khóa');
  c('SCL-E02', 'B.TXL-UC4', 'Chỉnh sửa', 'Thang Đã khóa chưa gán vẫn sửa được và giữ Đã khóa (BR-2)', 'Nghiệp vụ', 'Cao', '1. Khóa thang\n2. Sửa tên\n3. Lưu', 'Lưu được; vẫn Đã khóa');
  c('SCL-E03', 'B.TXL-UC4', 'Chỉnh sửa', 'Thang đã gán cho kỳ không vào được màn Sửa, báo MSG-104 (UI và API) (BR-1)', 'Nghiệp vụ', 'Cao', '1. Thang đã gán\n2. Thử Sửa (URL /edit và [API] PUT)', 'Báo "Thang xếp loại đang được kỳ sử dụng nên không thể sửa…"; dữ liệu không đổi');
  c('SCL-E04', 'B.TXL-UC4', 'Chỉnh sửa', 'Mã thang chỉ xem, không sửa được (BR-3)', 'Nghiệp vụ', 'Trung bình', '1. Mở form Sửa', 'Mã hiển thị dạng chỉ xem');
  c('SCL-E05', 'B.TXL-UC4', 'Chỉnh sửa', 'Quy tắc nhập tên/mô tả/mức giống thêm mới (BR-4)', 'Validate', 'Cao', '1. Sửa: xóa tên; xóa mức; đặt mức cuối 90', 'Cùng thông báo MSG-010/109/107; Lưu bị vô hiệu');
  c('SCL-E06', 'B.TXL-UC4', 'Chỉnh sửa', 'Dữ liệu bị người khác đổi sau khi mở form báo MSG-020 khi lưu (BR-5)', 'Nghiệp vụ', 'Trung bình', '1. Mở form sửa ở 2 phiên\n2. Lưu phiên 1 rồi phiên 2', 'Phiên 2 báo "Dữ liệu đã được người khác thay đổi. Vui lòng tải lại trang"', 'Cần 2 phiên đăng nhập — khó tự động hóa');
  c('SCL-E07', 'B.TXL-UC4', 'Chỉnh sửa', 'Hủy chỉnh sửa khi có thay đổi hỏi xác nhận thoát; Ở lại giữ form (MSG-009)', 'Chức năng', 'Trung bình', '1. Đổi tên\n2. Bấm Huỷ', 'Hộp thoại xác nhận; chọn Thoát không lưu thay đổi');
  c('SCL-D01', 'B.TXL-UC5', 'Xóa', 'Hộp thoại xóa: câu hỏi MSG-006 với tên thang, thẻ Mã thang & Số mức, ghi chú "Không hoàn tác được" (BR-2, BR-3)', 'Chức năng', 'Cao', '1. Menu → Xóa', 'Hộp thoại "Bạn có chắc chắn muốn xóa {tên thang}?" kèm thẻ số liệu và ghi chú vàng');
  c('SCL-D02', 'B.TXL-UC5', 'Xóa', 'Xóa thang Chưa khóa chưa gán thành công (BR-1)', 'Chức năng', 'Cao', '1. Menu → Xóa\n2. Xác nhận', 'Thang biến mất ở danh sách và API');
  c('SCL-D03', 'B.TXL-UC5', 'Xóa', 'Xóa thang Đã khóa chưa gán thành công (BR-1)', 'Nghiệp vụ', 'Cao', '1. Khóa thang\n2. Xóa', 'Xóa được, không phụ thuộc trạng thái khóa');
  c('SCL-D04', 'B.TXL-UC5', 'Xóa', 'Chọn Hủy/Không ở hộp xác nhận thì giữ nguyên', 'Chức năng', 'Trung bình', '1. Menu → Xóa\n2. Hủy', 'Thang còn nguyên');
  c('SCL-D05', 'B.TXL-UC5', 'Xóa', 'Thang đã gán cho kỳ không xóa được, báo MSG-104 (UI và API) (BR-1)', 'Nghiệp vụ', 'Cao', '1. Thang đã gán\n2. Thử Xóa ([API] DELETE)', 'Bị chặn với MSG-104; thang còn nguyên');
  c('SCL-K01', 'B.TXL-UC6', 'Khóa', 'Hộp thoại khóa: MSG-007 với tên thang, thẻ Mã thang & Số mức, ghi chú vàng (BR-2, BR-3)', 'Chức năng', 'Cao', '1. Menu → Khóa', 'Hộp thoại "Bạn có chắc chắn muốn khóa {tên thang}?" kèm ghi chú "Thang hiện trong danh sách chọn của kỳ…"');
  c('SCL-K02', 'B.TXL-UC6', 'Khóa', 'Khóa thang hợp lệ → Đã khóa và xuất hiện trong danh sách chọn thang của kỳ', 'Chức năng', 'Cao', '1. Khóa thang\n2. Mở form tạo kỳ tự đánh giá → select Thang xếp loại', 'Trạng thái Đã khóa; thang có trong danh sách chọn');
  c('SCL-K03', 'B.TXL-UC6', 'Khóa', 'Chỉ khóa được thang Chưa khóa, phủ đủ 0–100% và ≥ 2 mức (BR-1)', 'Nghiệp vụ', 'Cao', '1. Khóa thang đã Đã khóa\n2. [API] khóa thang không hợp lệ', 'Từ chối với thông báo; trạng thái giữ nguyên');
  c('SCL-K04', 'B.TXL-UC6', 'Khóa', 'Thang Đã khóa chưa gán vẫn sửa, mở khóa, xóa được (BR-4)', 'Nghiệp vụ', 'Trung bình', '1. Khóa thang\n2. Xem menu', 'Có Sửa, Mở khóa, Xóa');
  c('SCL-K05', 'B.TXL-UC7', 'Mở khóa', 'Hộp thoại mở khóa: MSG-008 với tên thang và ghi chú vàng (BR-2, BR-3)', 'Chức năng', 'Cao', '1. Menu → Mở khóa', 'Hộp thoại "Bạn có chắc chắn muốn mở khóa {tên thang}?" kèm ghi chú "Thang không còn hiện trong danh sách chọn…"');
  c('SCL-K06', 'B.TXL-UC7', 'Mở khóa', 'Mở khóa thang Đã khóa chưa gán → Chưa khóa, không còn trong danh sách chọn của kỳ', 'Chức năng', 'Cao', '1. Mở khóa\n2. Mở form tạo kỳ', 'Chưa khóa; thang không còn trong select Thang xếp loại');
  c('SCL-K07', 'B.TXL-UC7', 'Mở khóa', 'Thang đã gán cho kỳ không mở khóa được, báo MSG-104 (UI và API) (BR-1)', 'Nghiệp vụ', 'Cao', '1. Thang đã gán\n2. [API] PUT /unlock', 'Bị chặn MSG-104; vẫn Đã khóa');

  // ===================== DÙNG CHUNG: edge / lỗi / bảo mật / hiệu năng =====================
  const BP = [['PIL', 'B.I.1-UC2', 'trụ cột'], ['IGR', 'B.I.2-UC2', 'nhóm chỉ số'], ['IND', 'B.I.3-UC2', 'chỉ số'], ['SET', 'B.II.1-UC6', 'bộ chỉ số'], ['SCL', 'B.TXL-UC3', 'thang xếp loại']];
  for (const [P, uc, nm] of BP) {
    c(`${P}-G01`, uc, 'Thêm mới', `Trường bắt buộc chỉ nhập khoảng trắng bị chặn (${nm})`, 'Validate', 'Trung bình', '1. Mở form thêm mới\n2. Nhập chỉ dấu cách vào trường văn bản bắt buộc\n3. Lưu', 'Báo lỗi bắt buộc (chuỗi rỗng sau trim); không tạo bản ghi');
    c(`${P}-G02`, uc, 'Thêm mới', `Tên chứa tiếng Việt có dấu, HTML, dấu nháy, & được lưu và hiển thị đúng sau khi tải lại trang (${nm})`, 'Nghiệp vụ', 'Trung bình', '1. [API] Tạo bản ghi có tên chứa ký tự đặc biệt\n2. Tải lại trang (F5), tìm theo mã/tên', 'Tên hiển thị nguyên văn dạng chữ; thẻ HTML không bị render');
    c(`${P}-G03`, uc, 'Thêm mới', `Server lỗi 500 khi lưu: giữ form và dữ liệu đã nhập, không lộ lỗi nội bộ (${nm})`, 'Nghiệp vụ', 'Trung bình', '1. Điền form hợp lệ\n2. Giả lập API POST trả 500\n3. Lưu', 'Form còn mở và giữ dữ liệu; không lộ stacktrace; không tạo bản ghi');
    c(`${P}-G04`, uc, 'Thêm mới', `Mất kết nối khi lưu: không treo giao diện, giữ form (${nm})`, 'Nghiệp vụ', 'Trung bình', '1. Điền form hợp lệ\n2. Giả lập mất mạng khi POST\n3. Lưu', 'Form còn mở và giữ dữ liệu; trang không trắng; không tạo bản ghi');
    c(`${P}-G05`, uc, 'Thêm mới', `Bấm Lưu 2 lần liên tiếp chỉ tạo 1 bản ghi (${nm})`, 'Nghiệp vụ', 'Trung bình', '1. Điền form hợp lệ\n2. Bấm Lưu 2 lần rất nhanh', 'Chỉ có đúng 1 bản ghi');
    const ucS = uc.replace(/UC\d+$/, 'UC1');
    c(`${P}-A01`, ucS, 'Phân quyền', `API ${nm}: không token / token giả → 401`, 'Bảo mật', 'Cao', '1. GET danh sách không token\n2. GET với token giả', 'HTTP 401');
    c(`${P}-A02`, ucS, 'Phân quyền', `Quyền API ${nm} đúng theo ma trận quyền Cán bộ`, 'Bảo mật', 'Cao', '1. Lấy ma trận quyền canbo\n2. GET/POST/PUT/DELETE theo quyền Xem/Thêm/Sửa/Xóa/Khóa', 'Có quyền → được; không có → 403');
    c(`${P}-A03`, ucS, 'Phân quyền', `Chưa đăng nhập vào trang ${nm} bị chuyển về màn đăng nhập, không lộ dữ liệu`, 'Bảo mật', 'Cao', '1. Xóa session\n2. Mở URL trang', 'Hiện màn đăng nhập; không có dữ liệu');
    c(`${P}-P01`, ucS, 'Hiệu năng', `Danh sách ${nm} tải < 3 giây`, 'Hiệu năng', 'Trung bình', '1. Mở trang và đo', 'API < 3000ms, hiển thị < 6000ms');
  }
}
