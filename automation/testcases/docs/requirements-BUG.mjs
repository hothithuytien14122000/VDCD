// Truy vết các testcase bổ sung từ bug/góp ý đã log GitLab (#288–#298) → catalog-BUG.mjs.
export default R => [
  R('RES', 'C.UC1.1', null, 'GitLab #292 — Bộ lọc Hạn tự đánh giá (Chưa đến hạn/Đến hạn/Quá hạn)', [
    ['Có bộ lọc với đủ 4 giá trị ở Định kỳ và Đột xuất', 'RES-L85'],
    ['Chưa đến hạn / Đến hạn / Quá hạn lọc đúng theo hạn nộp', 'RES-L8[6-8]'],
    ['Kết hợp với các bộ lọc khác', 'RES-L89'],
  ]),
  R('RES', 'C.UC1.1', null, 'GitLab #288 — Xuất Excel danh sách Kết quả tự đánh giá', [['Có nút Xuất Excel, file đúng cột và bộ lọc', 'RES-L90']]),
  R('RES', 'C.UC1.2', null, 'GitLab #288/#290/#291 — Chấm điểm', [
    ['Chỉ số Không tính điểm không hiển thị, không tính tiến độ/điểm (#288)', 'RES-S100'],
    ['F5 giữ tab Chấm điểm; cảnh báo khi rời trang có dữ liệu chưa lưu (#290)', 'RES-S10[12]'],
    ['Chỉ đính kèm tệp rồi Lưu nháp vẫn giữ tệp (#291)', 'RES-S103'],
  ]),
  R('RES', 'C.UC1.5', null, 'GitLab #296 — Upload tệp bị 413', [
    ['Tệp hợp lệ dưới 20 MB tải được (văn bản xác nhận, minh chứng)', 'RES-F44|RES-F46'],
    ['Máy chủ từ chối tệp thì báo lỗi cho người dùng', 'RES-F45'],
  ]),
  R('SET', 'B.II.1-UC5', null, 'GitLab #289 — File Excel chi tiết bộ chỉ số khớp màn hình', [
    ['Đủ cột như màn hình', 'SET-V09'], ['Tiêu đề cột tên đúng nội dung', 'SET-V10'],
    ['Điểm hiển thị như màn hình', 'SET-V11'], ['Ngày giờ cập nhật đủ', 'SET-V13'], ['Ô số lưu kiểu Number', 'SET-V14'], ['Số chỉ số đếm đúng quy tắc', 'SET-V12'],
  ]),
  R('PRV', 'A.IV.1-UC7', null, 'GitLab #293 — File Excel tỉnh có cột Số xã/phường', [['Đủ cột như màn hình', 'PRV-L12']]),
  R('COM', 'A.IV.2-UC7', null, 'GitLab #293 — File Excel xã đúng thứ tự', [['Thứ tự dòng khớp màn hình', 'COM-L13']]),
  R('GRP', 'A.II.2-UC1', null, 'GitLab #295 — Mô tả trống hiển thị "–"', [['Ô Mô tả trống hiển thị "–"', 'GRP-L13']]),
  R('GRP', 'A.II.2-UC7', null, 'GitLab #294 — Người dùng trong nhóm đúng design', [['Bố cục đúng design NND-02', 'GRP-V06']]),
  R('UTY', 'A.IV.3-UC1', null, 'GitLab #298 — Sub title đúng design', [['Sub title đúng design', 'UTY-L13']]),
  R('UTY', 'A.IV.3-UC4', null, 'GitLab #297 — Popup Thêm loại đơn vị đúng design', [['Placeholder đúng design', 'UTY-C06'], ['Mô tả popup đúng design', 'UTY-C07']]),
];
