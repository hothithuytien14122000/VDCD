# Tài liệu yêu cầu dự án – Hệ thống Đánh giá Chuyển đổi số (CĐS)

> Nguồn: Google Sheet "Danh sách công việc_CĐS - BCT", sheet `UC_1409`.
> Nội dung ghi lại: tên Use Case, tên tác nhân chính và mô tả trường hợp sử dụng.

## Tổng quan

Tài liệu gồm **5 phân hệ**, **11 nhóm chức năng** và **49 Use Case**.

| Phân hệ | Số nhóm chức năng | Số Use Case |
|---|---|---|
| A. Phân hệ Quản trị hệ thống | 4 | 14 |
| B. Phân hệ Quản lý Bộ chỉ số DTI | 3 | 14 |
| C. Phân hệ Đánh giá CĐS | 2 | 11 |
| D. Phân hệ Dashboard & Báo cáo thống kê | 2 | 4 |
| E. Phân hệ Khảo sát mức độ hài lòng của người dân | 0 | 6 |

---

## A. Phân hệ Quản trị hệ thống

### A.I. Các chức năng dành cho người dùng có tài khoản của hệ thống

#### UC-A.I.1 – Đăng nhập hệ thống

- **Tên Use Case:** Đăng nhập hệ thống
- **Tác nhân chính:** Người dùng
- **Mô tả trường hợp sử dụng:**
  - Người dùng nhập tài khoản, mật khẩu và mã captcha để đăng nhập hệ thống. Hệ thống kiểm tra và thực hiện đăng nhập

#### UC-A.I.2 – Đổi mật khẩu

- **Tên Use Case:** Đổi mật khẩu
- **Tác nhân chính:** Người dùng
- **Mô tả trường hợp sử dụng:**
  - Người dùng có thể đổi mật khẩu khi đăng nhập hệ thống lần đầu tiên. Hệ thống kiểm tra và thực hiện đổi mật khẩu
  - Người dùng có thể đổi mật khẩu. Hệ thống kiểm tra và thực hiện đổi mật khẩu người dùng

#### UC-A.I.3 – Đăng xuất hệ thống

- **Tên Use Case:** Đăng xuất hệ thống
- **Tác nhân chính:** Người dùng
- **Mô tả trường hợp sử dụng:**
  - Người dùng có thể đăng xuất hệ thống. Hệ thống thực hiện đăng xuất

#### UC-A.I.4 – Lấy lại mật khẩu

- **Tên Use Case:** Lấy lại mật khẩu
- **Tác nhân chính:** Người dùng
- **Mô tả trường hợp sử dụng:**
  - Người dùng có thể nhập email đăng ký để lấy lại mật khẩu. Hệ thống kiểm tra và gửi xác nhận qua email đã đăng ký
  - Người dùng truy cập email để lấy thông tin thực hiện nhập mật khẩu mới. Hệ thống kiểm tra và cập nhật mật khẩu mới cho người dùng

#### UC-A.I.5 – Thay đổi thông tin cá nhân

- **Tên Use Case:** Thay đổi thông tin cá nhân
- **Tác nhân chính:** Người dùng
- **Mô tả trường hợp sử dụng:**
  - Người dùng có thể thay đổi thông tin cá nhân của mình (họ tên, email…). Hệ thống kiểm tra và cập nhật thông tin cá nhân người dùng
  - Người dùng có thể cập nhật ảnh đại diện của mình. Hệ thống kiểm tra và cập nhật ảnh đại diện của người dùng

### A.II. Các chức năng quản lý người dùng

#### UC-A.II.1 – Quản lý người dùng

- **Tên Use Case:** Quản lý người dùng
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể xem danh sách người dùng. Hệ thống tìm kiếm và trả về danh sách người dùng theo các tiêu chí tìm kiếm
  - Quản trị hệ thống có thể export danh sách người dùng ra excel. Hệ thống thực hiện export danh sách người dùng ra excel
  - Quản trị hệ thống có thể xem thông tin người dùng. Hệ thống tìm kiếm và trả về thông tin người dùng đã chọn
  - Quản trị hệ thống có thể thêm mới người dùng. Hệ thống kiểm tra và thực hiện thêm mới người dùng
  - Quản trị hệ thống có thể chỉnh sửa thông tin người dùng. Hệ thống kiểm tra và thực hiện cập nhật thông tin người dùng đã chọn
  - Quản trị hệ thống có thể xóa người dùng. Hệ thống kiểm tra và thực hiện xóa người dùng đã chọn

#### UC-A.II.2 – Quản lý nhóm người dùng

- **Tên Use Case:** Quản lý nhóm người dùng
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể xem danh sách nhóm người dùng. Hệ thống tìm kiếm và trả về danh sách nhóm người dùng theo các tiêu chí tìm kiếm
  - Quản trị hệ thống có thể export danh sách nhóm người dùng ra excel. Hệ thống thực hiện export danh sách nhóm người dùng ra excel
  - Quản trị hệ thống có thể xem thông tin nhóm người dùng. Hệ thống tìm kiếm và trả về thông tin nhóm người dùng đã chọn
  - Quản trị hệ thống có thể thêm mới nhóm người dùng. Hệ thống kiểm tra và thực hiện thêm mới nhóm người dùng
  - Quản trị hệ thống có thể chỉnh sửa thông tin nhóm người dùng. Hệ thống kiểm tra và thực hiện cập nhật thông tin nhóm người dùng đã chọn
  - Quản trị hệ thống có thể xóa nhóm người dùng. Hệ thống kiểm tra và thực hiện xóa nhóm người dùng đã chọn
  - Quản trị hệ thống có thể xem người dùng trong nhóm. Hệ thống tìm kiếm và trả về danh sách người dùng trong nhóm
  - Quản trị hệ thống có thể xóa người dùng khỏi nhóm. Hệ thống kiểm tra và thực hiện xóa người dùng khỏi nhóm
  - Quản trị hệ thống có thể thêm người dùng vào nhóm. Hệ thống kiểm tra và thực hiện thêm người dùng vào nhóm

#### UC-A.II.3 – Phân quyền cho nhóm người dùng

- **Tên Use Case:** Phân quyền cho nhóm người dùng
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể lựa chọn nhóm người dùng để xem danh sách chức năng đã phân quyền cho nhóm người dùng. Hệ thống tìm kiếm và trả về danh sách chức năng đã phân quyền cho nhóm người dùng
  - Quản trị hệ thống có thể phân quyền chức năng cho nhóm người dùng. Hệ thống thực hiện phân quyền chức năng đã chọn cho nhóm người dùng
  - Quản trị hệ thống có thể hủy phân quyền chức năng của nhóm người dùng. Hệ thống thực hiện hủy phân quyền chức năng đã chọn của nhóm người dùng

### A.III. Các chức năng quản trị hệ thống

#### UC-A.III.1 – Quản lý sao lưu

- **Tên Use Case:** Quản lý sao lưu
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể thiết lập thông số (thời gian, ví trí lưu trữ…) để sao lưu tự động. Hệ thống thực hiện thiết lập thông số sao lưu
  - Quản trị hệ thống có thể thực hiện sao lưu ngay lập tức dữ liệu. Hệ thống thực hiện sao lưu dữ liệu
  - Quản trị hệ thống có thể xem danh sách lịch sử sao lưu dữ liệu. Hệ thống tìm kiếm và trả về danh sách lịch sử sao lưu dữ liệu
  - Quản trị hệ thống có thể xem chi tiết thông tin sao lưu dữ liệu. Hệ thống tìm kiếm và trả về thông tin chi tiết lần sao lưu dữ liệu đã chọn
  - Quản trị hệ thống có thể lựa chọn lần sao lưu dữ liệu để xóa. Hệ thống kiểm tra và thực hiện xóa dữ liệu đã chọn

#### UC-A.III.2 – Quản lý tham số hệ thống

- **Tên Use Case:** Quản lý tham số hệ thống
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể thiết lập quy tắc mật khẩu (số, ký tự, ký tự đặc biệt…). Hệ thống thiết lập tham số theo quy tắc đã chọn
  - Quản trị hệ thống có thể thiết lập số lần đăng nhập sai của tài khoản. Hệ thống thiết lập tham số theo giá trị đã chọn
  - Quản trị hệ thống có thể thiết lập thời gian chờ timeout cho phiên kết nối. Hệ thống thiết lập tham số theo giá trị đã chọn
  - Quản trị hệ thống có thể thiết lập thời gian yêu cầu đổi mật khẩu. Hệ thống thiết lập tham số theo giá trị đã chọn
  - Quản trị hệ thống thiết lập thời gian hiệu lực của mật khẩu. HT lưu cấu hình thời gian hiệu lực mật khẩu, áp dụng cho các tài khoản và thông báo cập nhật thành công.
  - Quản trị hệ thống có thể thiết lập thời gian khóa tạm thời tài khoản khi đăng nhập sai quá số lần quy định. Hệ thống thiết lập tham số theo giá trị đã chọn

#### UC-A.III.3 – Nhật ký truy cập hệ thống

- **Tên Use Case:** Nhật ký truy cập hệ thống
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể tìm kiếm nhật ký truy cập hệ thống. Hệ thống tìm kiếm và trả về nhật ký truy cập hệ thống theo các tiêu chí tìm kiếm
  - Quản trị hệ thống có thể export danh sách nhật ký truy cập ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Quản trị hệ thống có thể xem chi tiết thông tin truy cập hệ thống. Hệ thống tìm kiếm và trả về thông tin chi tiết truy cập hệ thống đã chọn

### A.IV. Các chức năng quản lý danh mục

#### UC-A.IV.1 – Quản lý đơn vị hành chính cấp tỉnh

- **Tên Use Case:** Quản lý đơn vị hành chính cấp tỉnh
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể xem danh sách đơn vị hành chính cấp tỉnh. Hệ thống tìm kiếm và trả về danh sách đơn vị hành chính cấp tỉnh
  - Quản trị hệ thống có thể thêm mới đơn vị hành chính cấp tỉnh. Hệ thống kiểm tra và thực hiện thêm mới đơn vị hành chính
  - Quản trị hệ thống có thể chỉnh sửa thông tin đơn vị cấp tỉnh. Hệ thống kiểm tra và thực hiện cập nhật thông tin đơn vị hành chính cấp tỉnh đã chọn
  - Quản trị hệ thống có thể xóa đơn vị hành chính cấp tỉnh. Hệ thống kiểm tra và thực hiện xóa đơn vị hành chính cấp tỉnh đã chọn
  - Quản trị hệ thống có thể tìm kiếm đơn vị hành chính cấp tỉnh trong danh sách. Hệ thống kiểm tra và thực hiện tìm kiếm đơn vị hành chính cấp tỉnh đã chọn và hiển thị kết quả
  - Quản trị hệ thống có thể export danh sách đơn vị hành chính cấp tỉnh ra excel. Hệ thống thực hiện export danh sách đơn vị hành chính cấp tỉnh ra excel

#### UC-A.IV.2 – Quản lý loại đơn vị

- **Tên Use Case:** Quản lý loại đơn vị
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể xem danh sách loại đơn vị. Hệ thống tìm kiếm và trả về danh sách loại đơn vị theo các tiêu chí tìm kiếm
  - Quản trị hệ thống có thể export danh sách loại đơn vị ra excel. Hệ thống thực hiện export danh sách loại đơn vị ra excel
  - Quản trị hệ thống có thể xem thông tin loại đơn vị. Hệ thống tìm kiếm và trả về thông tin loại đơn vị đã chọn
  - Quản trị hệ thống có thể thêm mới loại đơn vị (cấp Sở/Ban/Ngành, cấp Xã...). Hệ thống kiểm tra và thực hiện thêm mới loại đơn vị
  - Quản trị hệ thống có thể chỉnh sửa thông tin loại đơn vị. Hệ thống kiểm tra và thực hiện cập nhật thông tin loại đơn vị đã chọn
  - Quản trị hệ thống có thể xóa loại đơn vị. Hệ thống kiểm tra và thực hiện xóa loại đơn vị đã chọn

#### UC-A.IV.3 – Quản lý đơn vị

- **Tên Use Case:** Quản lý đơn vị
- **Tác nhân chính:** Quản trị hệ thống
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống có thể xem danh sách đơn vị. Hệ thống tìm kiếm và trả về danh sách đơn vị theo các tiêu chí tìm kiếm
  - Quản trị hệ thống có thể export danh sách đơn vị ra excel. Hệ thống thực hiện export danh sách đơn vị ra excel
  - Quản trị hệ thống có thể xem thông tin đơn vị. Hệ thống tìm kiếm và trả về thông tin đơn vị đã chọn
  - Quản trị hệ thống có thể thêm mới đơn vị. Hệ thống kiểm tra và thực hiện thêm mới đơn vị
  - Quản trị hệ thống có thể chỉnh sửa thông tin đơn vị. Hệ thống kiểm tra và thực hiện cập nhật thông tin đơn vị đã chọn
  - Quản trị hệ thống có thể xóa đơn vị. Hệ thống kiểm tra và thực hiện xóa đơn vị đã chọn
  - Quản trị hệ thống có thể khóa/mở khóa đơn vị. Hệ thống kiểm tra và thực hiện khóa/mở khóa đơn vị đã chọn
  - Quản trị hệ thống có thể tham chiếu/bỏ tham chiếu đơn vị với đơn vị hành chính cấp tỉnh. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Quản trị hệ thống có thể xem danh sách người dùng trong đơn vị. Hệ thống tìm kiếm và trả về danh sách người dùng trong đơn vị
  - Quản trị hệ thống có thể xóa người dùng khỏi đơn vị. Hệ thống thực hiện xóa người dùng khỏi đơn vị
  - Quản trị hệ thống có thể thêm người dùng vào đơn vị. Hệ thống thực hiện thêm người dùng vào đơn vị

---

## B. Phân hệ Quản lý Bộ chỉ số DTI

### B.I. Nhóm chức năng quản lý cấu trúc Bộ chỉ số

#### UC-B.I.1 – Quản lý trụ cột

- **Tên Use Case:** Quản lý trụ cột
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể xem danh sách trụ cột. Hệ thống tìm kiếm và trả về danh sách trụ cột
  - Quản trị hệ thống, Cán bộ có thể thêm mới trụ cột. Hệ thống kiểm tra và thực hiện thêm mới trụ cột
  - Quản trị hệ thống, Cán bộ có thể khóa/mở khóa trụ cột. Hệ thống kiểm tra và thực hiện khóa/mở khóa trụ cột
  - Quản trị hệ thống, Cán bộ có thể xóa trụ cột. Hệ thống kiểm tra và thực hiện xóa trụ cột
  - Quản trị hệ thống, Cán bộ có thể cập nhật thông tin trụ cột. Hệ thống kiểm tra và thực hiện cập nhật thông tin trụ cột

#### UC-B.I.2 – Quản lý nhóm chỉ số

- **Tên Use Case:** Quản lý nhóm chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể xem danh sách nhóm chỉ số. Hệ thống tìm kiếm và trả về danh sách nhóm chỉ số
  - Quản trị hệ thống, Cán bộ có thể thêm mới nhóm chỉ số. Hệ thống kiểm tra và thực hiện thêm mới nhóm chỉ số
  - Quản trị hệ thống, Cán bộ có thể khóa/mở khóa nhóm chỉ số. Hệ thống kiểm tra và thực hiện khóa/mở khóa nhóm chỉ số
  - Quản trị hệ thống, Cán bộ có thể xóa nhóm chỉ số. Hệ thống kiểm tra và thực hiện xóa nhóm chỉ số
  - Quản trị hệ thống, Cán bộ có thể cập nhật thông tin nhóm chỉ số. Hệ thống kiểm tra và thực hiện cập nhật thông tin nhóm chỉ số

#### UC-B.I.3 – Quản lý chỉ số

- **Tên Use Case:** Quản lý chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể xem danh sách chỉ số. Hệ thống tìm kiếm và trả về danh sách chỉ số (danh sách, dạng cây…)
  - Quản trị hệ thống, Cán bộ có thể thêm mới chỉ số. Hệ thống kiểm tra và thực hiện thêm mới chỉ số
  - Quản trị hệ thống, Cán bộ có thể khóa/mở khóa chỉ số. Hệ thống kiểm tra và thực hiện khóa/mở khóa chỉ số
  - Quản trị hệ thống, Cán bộ có thể xóa chỉ số. Hệ thống kiểm tra và thực hiện xóa chỉ số
  - Quản trị hệ thống, Cán bộ có thể cập nhật thông tin chỉ số. Hệ thống kiểm tra và thực hiện cập nhật thông tin chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ cập nhật chỉ số cha. Hệ thống kiểm tra và thực hiện cập nhật chỉ số cha cho chỉ số đã chọn

#### UC-B.I.4 – Quản lý cấu hình điểm của chỉ số

- **Tên Use Case:** Quản lý cấu hình điểm của chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể thiết lập điểm tối đa của chỉ số. Hệ thống thiết lập theo thông số cho chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể thiết lập điểm tối thiểu của chỉ số. Hệ thống thiết lập theo thông số cho chỉ số đã chọn

#### UC-B.I.5 – Nhân bản chỉ số

- **Tên Use Case:** Nhân bản chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể lựa chọn chỉ số để thực hiện nhân bản. Hệ thống thực hiện nhân bản chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể xem, chỉnh sửa chỉ số vừa nhân bản. Hệ thống kiểm tra và cập nhật dữ liệu

### B.II. Nhóm chức năng quản lý bộ chỉ số DTI của Bộ Dân tộc và Tôn giáo

#### UC-B.II.1 – Danh mục bộ chỉ số

- **Tên Use Case:** Danh mục bộ chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể xem danh mục bộ chỉ số. Hệ thống tìm kiếm và trả về danh sách bộ chỉ số.
  - Quản trị hệ thống, Cán bộ có thể export danh mục bộ chỉ số ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Quản trị hệ thống, Cán bộ có thể xem chi tiết thông tin bộ chỉ số. Hệ thống tìm kiếm và trả về thông tin bộ chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể xem chi tiết cấu trúc bộ chỉ số. Hệ thống tìm kiếm và trả về cấu trúc chi tiết bộ chỉ số đã chọn (nhóm chỉ số, chỉ số, điểm…)
  - Quản trị hệ thống, Cán bộ có thể export dữ liệu bộ chỉ số ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Quản trị hệ thống, Cán bộ có thể thực hiện thêm mới bộ chỉ số. Hệ thống kiểm tra và thực hiện thêm mới dữ liệu
  - Quản trị hệ thống, Cán bộ có thể xóa bộ chỉ số. Hệ thống kiểm tra và thực hiện xóa bộ chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể cập nhật trạng thái sử dụng/không sử dụng bộ chỉ số. Hệ thống thực hiện cập nhật dữ liệu bộ chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể cập nhật thông tin, thời gian sử dụng bộ chỉ tiêu DTI. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu bộ chỉ số đã chọn

#### UC-B.II.2 – Tạo cấu trúc (nhóm chỉ số/nhóm tiêu chí) của bộ chỉ số

- **Tên Use Case:** Tạo cấu trúc (nhóm chỉ số/nhóm tiêu chí) của bộ chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể xem danh sách nhóm chỉ số của bộ chỉ số. Hệ thống tìm kiếm và trả về danh sách nhóm chỉ số của bộ chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể lựa chọn nhóm chỉ số đưa vào bộ chỉ số. Hệ thống kiểm tra và thực hiện thêm nhóm chỉ số đã chọn vào bộ chỉ số
  - Quản trị hệ thống, Cán bộ có thể chỉnh sửa thông tin nhóm chỉ số trong bộ chỉ số. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu nhóm chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể xóa nhóm chỉ số trong bộ chỉ số. Hệ thống kiểm tra và thực hiện xóa nhóm chỉ số
  - Quản trị hệ thống, Cán bộ có thể thiết lập tính điểm/không tính điểm cho nhóm chỉ số trong bộ chỉ số. Hệ thống thực hiện theo thiếp lập đã chọn

#### UC-B.II.3 – Tạo nội dung cho bộ chỉ số

- **Tên Use Case:** Tạo nội dung cho bộ chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể xem danh sách chỉ số của bộ chỉ số. Hệ thống tìm kiếm và trả về danh sách chỉ số của bộ chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể lựa chọn chỉ số đưa vào bộ chỉ số. Hệ thống kiểm tra và thực hiện thêm chỉ số đã chọn vào bộ chỉ số
  - Quản trị hệ thống, Cán bộ có thể chỉnh sửa thông tin chỉ số trong bộ chỉ số. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể xóa chỉ số trong bộ chỉ số. Hệ thống kiểm tra và thực hiện xóa chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể thiết lập tính điểm/không tính điểm cho chỉ số trong bộ chỉ số. Hệ thống thực hiện theo thiếp lập đã chọn
  - Quản trị hệ thống, Cán bộ có thể chỉnh sửa điểm đối với chỉ số trong bộ chỉ số. Hệ thống kiểm tra và cập nhật dữ liệu điểm đối với chỉ số đã chọn

#### UC-B.II.4 – Khóa/Mở khóa bộ chỉ số

- **Tên Use Case:** Khóa/Mở khóa bộ chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể khóa bộ chỉ số (để không cho/cho chỉnh sửa để đưa vào sử dụng). Hệ thống thiết lập theo thông số đã chọn
  - Quản trị hệ thống, Cán bộ có thể mở khóa bộ chỉ số (để không cho/cho chỉnh sửa để đưa vào sử dụng). Hệ thống thiết lập theo thông số đã chọn

#### UC-B.II.5 – Nhân bản bộ chỉ số

- **Tên Use Case:** Nhân bản bộ chỉ số
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể nhân bản bộ chỉ số. Hệ thống kiểm tra và thực hiện nhân bản bộ chỉ số đã chọn
  - Quản trị hệ thống, Cán bộ có thể xem, chỉnh sửa các chỉ số của bộ chỉ số vừa nhân bản. Hệ thống kiểm tra và cập nhật dữ liệu

### B.III. Nhóm chức năng quản lý tự đánh giá CĐS của Bộ Dân tộc và Tôn giáo

#### UC-B.III.1 – Danh mục tự đánh giá

- **Tên Use Case:** Danh mục tự đánh giá
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể xem danh mục tự đánh giá mà các cơ quan, đơn vị phải thực hiện. Hệ thống tìm kiếm và trả về danh sách tự đánh giá
  - Quản trị hệ thống, Cán bộ có thể lựa chọn bộ chuyển đổi số để thêm mới tự đánh giá (theo tháng/quý/năm). Hệ thống kiểm tra và thực hiện thêm mới tự đánh giá
  - Quản trị hệ thống, Cán bộ có thể chỉnh sửa tự đánh giá. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Quản trị hệ thống, Cán bộ có thể chọn loại tự đánh giá là định kỳ hoặc đột xuất. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Quản trị hệ thống, Cán bộ có thể chỉnh sửa chỉ số/chỉ tiêu của tự đánh giá. Hệ thống kiểm tra và thực hiện chỉnh sửa
  - Quản trị hệ thống, Cán bộ có thể thêm mới chỉ số/chỉ tiêu của tự đánh giá. Hệ thống kiểm tra và thực hiện thêm mới chỉ số/chỉ tiêu
  - Quản trị hệ thống, Cán bộ có thể xóa chỉ số/chỉ tiêu của tự đánh giá. Hệ thống kiểm tra và thực hiện xóa chỉ số/chỉ tiêu
  - Quản trị hệ thống, Cán bộ có thể xóa tự đánh giá. Hệ thống kiểm tra và thực hiện xóa tự đánh giá
  - Quản trị hệ thống, Cán bộ có thể thiết lập thời gian cảnh báo đến hạn tự đánh giá. Hệ thống thiết lập theo thông số đã chọn

#### UC-B.III.2 – Phân công đơn vị thực hiện tự đánh giá

- **Tên Use Case:** Phân công đơn vị thực hiện tự đánh giá
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể xem danh sách đơn vị (trực thuộc Bộ Dân tộc và Tôn giáo; Sở/Ban/Ngành địa phương) phải thực hiện tự đánh giá định kỳ. Hệ thống tìm kiếm và trả về danh sách đơn vị
  - Quản trị hệ thống, Cán bộ có thể xem danh sách đơn vị (trực thuộc Bộ Dân tộc và Tôn giáo; Sở/Ban/Ngành địa phương) phải thực hiện tự đánh giá đột xuất. Hệ thống tìm kiếm và trả về danh sách đơn vị
  - Quản trị hệ thống, Cán bộ có thể export danh sách đơn vị phải thực hiện tự đánh giá ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Quản trị hệ thống, Cán bộ có thể thêm đơn vị cần thực hiện tự đánh giá. Hệ thống kiểm tra và thực hiện thêm mới đơn vị đã chọn
  - Quản trị hệ thống, Cán bộ có thể xóa đơn vị cần thực hiện tự đánh giá. Hệ thống kiểm tra và thực hiện xóa đơn vị đã chọn

#### UC-B.III.3 – Trình phê duyệt yêu cầu tự đánh giá

- **Tên Use Case:** Trình phê duyệt yêu cầu tự đánh giá
- **Tác nhân chính:** Quản trị hệ thống, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Quản trị hệ thống, Cán bộ có thể trình lãnh đạo yêu cầu tự đánh giá định kỳ đối với đơn vị. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Quản trị hệ thống, Cán bộ có thể trình lãnh đạo yêu cầu tự đánh giá đột xuất đối với đơn vị. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Quản trị hệ thống, Cán bộ có thể xem danh sách trình lãnh đạo yêu cầu tự đánh giá định kỳ đối với đơn vị. Hệ thống tìm kiếm và trả về danh sách
  - Quản trị hệ thống, Cán bộ có thể xem danh sách trình lãnh đạo yêu cầu tự đánh giá đột xuất đối với đơn vị. Hệ thống tìm kiếm và trả về danh sách

#### UC-B.III.5 – Phê duyệt yêu cầu tự đánh giá

- **Tên Use Case:** Phê duyệt yêu cầu tự đánh giá
- **Tác nhân chính:** Lãnh đạo
- **Mô tả trường hợp sử dụng:**
  - Quản lý tự đánh giá
  - Lãnh đạo có thể xem danh sách trình yêu cầu tự đánh giá đột xuất đối với đơn vị. Hệ thống tìm kiếm và trả về danh sách
  - Lãnh đạo có thể phê duyệt yêu cầu tự đánh giá. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu. Hệ thống tự động tạo đánh giá (đối với đánh giá định kỳ) theo định kỳ thiết lập để đơn vị thực hiện đánh giá
  - Lãnh đạo có thể từ chối phê duyệt yêu cầu tự đánh giá. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu

---

## C. Phân hệ Đánh giá CĐS

### C.I. Nhóm chức năng dành cho đơn vị thực hiện tự đánh giá

#### UC-C.I.1 – Thông báo yêu cầu tự đánh giá

- **Tên Use Case:** Thông báo yêu cầu tự đánh giá
- **Tác nhân chính:** Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương có thể nhận thông báo yêu cầu thực hiện tự đánh giá định kỳ. Hệ thống tìm kiếm và trả về thông báo
  - Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương có thể nhận thông báo yêu cầu thực hiện tự đánh giá đột xuất. Hệ thống tìm kiếm và trả về thông báo
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể nhận thông báo yêu cầu thực hiện lại tự đánh giá định kỳ của đơn vị mình. Hệ thống tìm kiếm và trả về thông báo
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể nhận thông báo yêu cầu thực hiện lại tự đánh giá đột xuất của đơn vị mình. Hệ thống tìm kiếm và trả về thông báo
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể nhận thông báo mở khóa kết quả tự đánh giá định kỳ của đơn vị mình. Hệ thống tìm kiếm và trả về thông báo
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể nhận thông báo mở khóa kết quả tự đánh giá đột xuất của đơn vị mình. Hệ thống tìm kiếm và trả về thông báo

#### UC-C.I.2 – Thông báo yêu cầu phê duyệt kết quả tự đánh giá

- **Tên Use Case:** Thông báo yêu cầu phê duyệt kết quả tự đánh giá
- **Tác nhân chính:** Lãnh đạo đơn vị, Lãnh đạo địa phương
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể nhận thông báo phê duyệt kết quả tự đánh giá định kỳ của đơn vị mình. Hệ thống tìm kiếm và trả về thông báo
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể nhận thông báo phê duyệt kết quả tự đánh giá đột xuất của đơn vị mình. Hệ thống tìm kiếm và trả về thông báo

#### UC-C.I.3 – Thực hiện tự đánh giá

- **Tên Use Case:** Thực hiện tự đánh giá
- **Tác nhân chính:** Cán bộ, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Cán bộ, Cán bộ địa phương có thể xem danh sách yêu cầu tự đánh giá định kỳ. Hệ thống tìm kiếm và trả về danh sách yêu cầu tự đánh giá định kỳ của đơn vị
  - Cán bộ, Cán bộ địa phương có thể xem danh sách yêu cầu tự đánh giá đột xuất. Hệ thống tìm kiếm và trả về danh sách yêu cầu tự đánh giá đột xuất của đơn vị
  - Cán bộ, Cán bộ địa phương có thể export danh sách yêu cầu tự đánh giá ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Cán bộ, Cán bộ địa phương có thể xem thông tin chi tiết các chỉ số của yêu cầu tự đánh giá. Hệ thống tìm kiếm và trả về thông tin chi tiết
  - Cán bộ, Cán bộ địa phương có thể xem export yêu cầu tự đánh giá ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Cán bộ, Cán bộ địa phương có thể nhập thông tin, điểm cho chỉ số của yêu cầu tự đánh giá. Hệ thống kiểm tra và cập nhật dữ liệu.
  - Cán bộ, Cán bộ địa phương có thể sửa thông tin, điểm cho chỉ số của yêu cầu tự đánh giá. Hệ thống kiểm tra và cập nhật dữ liệu.
  - Cán bộ, Cán bộ địa phương có thể đính kèm file mô tả, dẫn chứng cho chỉ số của yêu cầu tự đánh giá. Hệ thống kiểm tra và cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể xóa file mô tả, dẫn chứng đính kèm cho chỉ số của yêu cầu tự đánh giá. Hệ thống kiểm tra và thực hiện xóa dữ liệu

#### UC-C.I.4 – Trình phê duyệt kết quả tự đánh giá

- **Tên Use Case:** Trình phê duyệt kết quả tự đánh giá
- **Tác nhân chính:** Cán bộ, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Cán bộ, Cán bộ địa phương có thể trình phê duyệt kết quả tự đánh giá định kỳ của đơn vị mình. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể trình phê duyệt kết quả tự đánh giá đột xuất của đơn vị mình. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương xem danh sách trình phê duyệt kết quả tự đánh giá định kỳ của đơn vị mình. Hệ thống tìm kiếm và trả về danh sách
  - Cán bộ, Cán bộ địa phương xem danh sách trình phê duyệt kết quả tự đánh giá đột xuất của đơn vị mình. Hệ thống tìm kiếm và trả về danh sách

#### UC-C.I.5 – Phê duyệt tự đánh giá

- **Tên Use Case:** Phê duyệt tự đánh giá
- **Tác nhân chính:** Lãnh đạo đơn vị, Lãnh đạo địa phương
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem danh sách cần phê duyệt kết quả tự đánh giá định kỳ của đơn vị mình. Hệ thống tìm kiếm và trả về danh sách cần phê duyệt kết quả tự đánh giá
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem danh sách cần phê duyệt kết quả tự đánh giá đột xuất của đơn vị mình. Hệ thống tìm kiếm và trả về danh sách cần phê duyệt kết quả tự đánh giá
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể phê duyệt kết quả tự đánh giá của đơn vị mình. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể từ chối phê duyệt kết quả tự đánh giá của đơn vị mình. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu

#### UC-C.I.6 – Gửi kết quả tự đánh giá

- **Tên Use Case:** Gửi kết quả tự đánh giá
- **Tác nhân chính:** Cán bộ, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Cán bộ, Cán bộ địa phương có thể xem danh sách kết quả tự đánh giá định kỳ đã được lãnh đạo phê duyệt. Hệ thống tìm kiếm và trả về danh sách
  - Cán bộ, Cán bộ địa phương có thể xem danh sách kết quả tự đánh giá đột xuất đã được lãnh đạo phê duyệt. Hệ thống tìm kiếm và trả về danh sách
  - Cán bộ, Cán bộ địa phương có thể đính kèm file kết quả tự đánh giá (file ký số, file scan ký tươi). Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể gửi kết quả tự đánh giá của đơn vị. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu

#### UC-C.I.7 – Quản lý danh sách kết quả tự đánh giá

- **Tên Use Case:** Quản lý danh sách kết quả tự đánh giá
- **Tác nhân chính:** Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương có thể tìm kiếm kết quả tự đánh giá định kỳ. Hệ thống tìm kiếm và trả về danh sách kết quả tự đánh giá theo các tiêu chí tìm kiếm
  - Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương có thể tìm kiếm kết quả tự đánh giá đột xuất. Hệ thống tìm kiếm và trả về danh sách kết quả tự đánh giá theo các tiêu chí tìm kiếm
  - Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương có thể xem kết quả tự đánh giá. Hệ thống tìm kiếm và trả về chi tiết kết quả tự đánh giá
  - Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương có thể export kết quả tự đánh giá ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể yêu cầu mở khóa kết quả tự đánh giá để cập nhật lại thông tin, điểm. Hệ thống kiểm tra và thực hiện update dữ liệu

### C.II. Nhóm chức năng quản lý kết quả tự đánh giá của đơn vị, địa phương

#### UC-C.II.1 – Thông báo

- **Tên Use Case:** Thông báo
- **Tác nhân chính:** Lãnh đạo, Lãnh đạo đơn vị, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể nhận thông báo khi có kết quả tự đánh giá của đơn vị. Hệ thống tìm kiểm và trả về thông báo
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể nhận thông báo khi có yêu cầu mở khóa kết quả tự đánh giá của đơn vị. Hệ thống tìm kiểm và trả về thông báo

#### UC-C.II.2 – Danh sách yêu cầu tự đánh giá đến hạn

- **Tên Use Case:** Danh sách yêu cầu tự đánh giá đến hạn
- **Tác nhân chính:** Lãnh đạo, Lãnh đạo đơn vị, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem danh sách yêu cầu tự đánh giá định kỳ đến hạn. Hệ thống tìm kiếm và trả về danh sách
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem danh sách yêu cầu tự đánh giá đột xuất đến hạn. Hệ thống tìm kiếm và trả về danh sách
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem các đơn vị đã thực hiện tự đánh giá. Hệ thống tìm kiếm và trả về danh sách đơn vị đã thực hiện tự đánh giá
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể export danh sách đơn vị đã thực hiện tự đánh giá ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem chi tiết kết quả thực hiện tự đánh giá của đơn vị. Hệ thống tìm kiếm và trả về kết quả tự đánh giá của đơn vị
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể yêu cầu đơn vị thực hiện tự đánh giá lại. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem các đơn vị chưa thực hiện tự đánh giá CĐS. Hệ thống tìm kiếm và trả về danh sách đơn vị chưa thực hiện tự đánh giá
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể export danh sách đơn vị chưa thực hiện tự đánh giá ra excel. Hệ thống thực hiện export dữ liệu ra excel
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể gửi yêu cầu thực hiện đánh giá CĐS đối với đơn vị chưa thực hiện. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu

#### UC-C.II.3 – Mở khóa kết quả tự đánh giá

- **Tên Use Case:** Mở khóa kết quả tự đánh giá
- **Tác nhân chính:** Lãnh đạo, Lãnh đạo đơn vị, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem danh sách yêu cầu mở khóa kết quả tự đánh giá định kỳ của đơn vị. Hệ thống tìm kiếm và trả về danh sách yêu cầu mở khóa
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem danh sách yêu cầu mở khóa kết quả tự đánh giá đột xuất của đơn vị. Hệ thống tìm kiếm và trả về danh sách yêu cầu mở khóa
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể mở khóa kết quả tự đánh giá. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu

#### UC-C.II.4 – Quản lý kết quả tự đánh giá

- **Tên Use Case:** Quản lý kết quả tự đánh giá
- **Tác nhân chính:** Lãnh đạo, Lãnh đạo đơn vị, Cán bộ
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem lịch sử kết quả tự đánh giá định kỳ. Hệ thống tìm kiếm và trả về lịch sử kết quả tự đánh giá
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem lịch sử kết quả tự đánh giá đột xuất. Hệ thống tìm kiếm và trả về lịch sử kết quả tự đánh giá
  - Lãnh đạo, Lãnh đạo đơn vị, Cán bộ có thể xem thông tin chi tiết kết quả tự đánh giá. Hệ thống tìm kiếm và trả về thông tin chi tiết

---

## D. Phân hệ Dashboard & Báo cáo thống kê

### D.I. Nhóm chức năng dành cho đơn vị, địa phương

#### UC-D.I.1 – Dashboard dành cho đơn vị, địa phương

- **Tên Use Case:** Dashboard dành cho đơn vị, địa phương
- **Tác nhân chính:** Lãnh đạo đơn vị, Lãnh đạo địa phương
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem kết quả chuyển đổi số theo tháng/quý/năm của đơn vị mình, địa phương mình. Hệ thống tìm kiếm và trả về kết quả
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem biểu đồ kết quả chuyển đổi số theo dạng cột. Hệ thống tìm kiếm và trả về kết quả
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem biểu đồ kết quả chuyển đổi số theo dạng hình tròn. Hệ thống tìm kiếm và trả về kết quả
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem kết quả chuyển đổi số (dạng số liệu). Hệ thống tìm kiếm và trả về kết quả
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem export kết quả chuyển đổi số ra excel. Hệ thống thực hiện export dữ liệu ra excel

#### UC-D.I.2 – So sánh kết quả chuyển đổi số của đơn vị, địa phương

- **Tên Use Case:** So sánh kết quả chuyển đổi số của đơn vị, địa phương
- **Tác nhân chính:** Lãnh đạo đơn vị, Lãnh đạo địa phương
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể lựa chọn thời gian để so sánh kết quả chuyển đổi số của địa phương mình, đơn vị mình. Hệ thống tìm kếm và trả về kết quả theo thời gian đã chọn
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem so sánh kết quả chuyển đổi số dạng cột. Hệ thống tìm kiếm và trả về kết quả
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem so sánh kết quả chuyển đổi số dạng hình tròn. Hệ thống tìm kiếm và trả về kết quả
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể export so sánh kết quả chuyển đổi số ra excel. Hệ thống thực hiện export dữ liệu ra excel

### D.II. Nhóm chức năng cung cấp kết quả chuyển đổi số của Bộ Dân tộc và Tôn giáo

#### UC-D.II.1 – Bảng xếp hạng CĐS của Bộ Dân tộc và Tôn giáo

- **Tên Use Case:** Bảng xếp hạng CĐS của Bộ Dân tộc và Tôn giáo
- **Tác nhân chính:** Người dùng
- **Mô tả trường hợp sử dụng:**
  - Người dùng có thể xem bảng xếp hạng CĐS các đơn vị, địa phương của Bộ Dân tộc và Tôn giáo. Hệ thống tìm kiếm và trả về kết quả
  - Người dùng có thể export bảng xếp hạng CĐS các đơn vị, địa phương của Bộ Dân tộc và Tôn giáo ra excel. Hệ thống thực hiện export dữ liệu ra excel

#### UC-D.II.2 – So sánh kết quả chuyển đổi số các địa phương với nhau

- **Tên Use Case:** So sánh kết quả chuyển đổi số các địa phương với nhau
- **Tác nhân chính:** Lãnh đạo
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo có thể lựa chọn đơn vị để so sánh kết quả chuyển đổi số. Hệ thống tìm kếm và trả về kết quả theo thời gian đã chọn
  - Lãnh đạo có thể lựa chọn thời gian để so sánh kết quả chuyển đổi số. Hệ thống tìm kếm và trả về kết quả theo thời gian đã chọn
  - Lãnh đạo có thể xem so sánh kết quả chuyển đổi số dạng cột. Hệ thống tìm kiếm và trả về kết quả
  - Lãnh đạo có thể xem so sánh kết quả chuyển đổi số dạng hình tròn. Hệ thống tìm kiếm và trả về kết quả
  - Lãnh đạo có thể export so sánh kết quả chuyển đổi số ra excel. Hệ thống thực hiện export dữ liệu ra excel

---

## E. Phân hệ Khảo sát mức độ hài lòng của người dân

#### UC-E.1 – Quản lý đợt khảo sát

- **Tên Use Case:** Quản lý đợt khảo sát
- **Tác nhân chính:** Cán bộ, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Cán bộ, Cán bộ địa phương có thể xem danh sách đợt khảo sát mức độ hài lòng của người dân. Hệ thống tìm kiếm và hiển thị danh sách
  - Cán bộ, Cán bộ địa phương có thể xem chi tiết đợt khảo sát mức độ hài lòng của người dân. Hệ thống tìm kiếm và hiển thị thông tin đợt khảo sát đã chọn
  - Cán bộ, Cán bộ địa phương có thể khởi tạo đợt khảo sát mức độ hài lòng của người dân. Hệ thống kiểm tra và thực hiện tạo mới đợt khảo sát
  - Cán bộ, Cán bộ địa phương có thể chỉnh sửa thông tin đợt khảo sát mức độ hài lòng của người dân. Hệ thống kiểm tra và cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể lựa chọn loại đợt khảo sát (trực tuyến/trực tiếp/gián tiếp thông qua phiếu khảo sát…). Hệ thống kiểm tra và cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể thêm nội dung khảo sát. Hệ thống kiểm tra và thực hiện thêm mới nội dung
  - Cán bộ, Cán bộ địa phương có thể chỉnh sửa nội dung khảo sát. Hệ thống kiểm tra và thực hiện chỉnh sửa nội dung
  - Cán bộ, Cán bộ địa phương có thể xóa nội dung khảo sát. Hệ thống kiểm tra và thực hiện xóa nội dung
  - Cán bộ, Cán bộ địa phương có thể lựa chọn các kết quả nội dung khảo sát (Hài lòng/Chưa hài lòng…). Hệ thống kiểm tra và cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể xóa đợt khảo sát mức độ hài lòng của người dân. Hệ thống kiểm tra và xóa dữ liệu

#### UC-E.2 – Trình phê duyệt đợt khảo sát

- **Tên Use Case:** Trình phê duyệt đợt khảo sát
- **Tác nhân chính:** Cán bộ, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Cán bộ, Cán bộ địa phương có thể trình lãnh đạo phê duyệt đợt khảo sát. Hệ thống kiểm tra và thực hiện cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể xem danh sách đợt khảo sát trình lãnh đạo phê duyệt. Hệ thống tìm kiếm và hiển thị danh sách

#### UC-E.3 – Phê duyệt đợt khảo sát

- **Tên Use Case:** Phê duyệt đợt khảo sát
- **Tác nhân chính:** Lãnh đạo đơn vị, Lãnh đạo địa phương
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể xem danh sách đợt khảo sát trình phê duyệt. Hệ thống tìm kiếm và hiển thị danh sách
  - Lãnh đạo đơn vị, Lãnh đạo địa phương có thể phê duyệt đợt khảo sát. Hệ thống kiểm tra và cập nhật dữ liệu
  - Lãnh đạo đơn vị, Lãnh đạo địa phương từ chối phê duyệt đợt khảo sát. Hệ thống kiểm tra và cập nhật dữ liệu

#### UC-E.4 – Thực hiện khảo sát trực tuyến

- **Tên Use Case:** Thực hiện khảo sát trực tuyến
- **Tác nhân chính:** Người dân
- **Mô tả trường hợp sử dụng:**
  - Người dân có thể xem chi tiết nội dung khảo sát mức độ hài lòng về kết quả xử lý PAKN, DVC trực tuyến và hoạt động CĐS. Hệ thống tìm kiếm và hiển thị dữ liệu
  - Người dân có thể lựa chọn đánh giá mức độ hài lòng về kết quả xử lý PAKN, DVC trực tuyến và hoạt động CĐS. Hệ thống kiểm tra và cập nhật dữ liệu

#### UC-E.5 – Tổng kết kết quả khảo sát trực tuyến

- **Tên Use Case:** Tổng kết kết quả khảo sát trực tuyến
- **Tác nhân chính:** Lãnh đạo đơn vị, Lãnh đạo địa phương, Cán bộ, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Lãnh đạo đơn vị, Lãnh đạo địa phương, Cán bộ, Cán bộ địa phương có thể xem danh sách kết quả các đợt khảo sát đã kết thúc. Hệ thống tìm kiếm và hiển thị danh sách
  - Lãnh đạo đơn vị, Lãnh đạo địa phương, Cán bộ, Cán bộ địa phương có thể export danh sách kết quả các đợt khảo sát đã kết thúc. Hệ thống thực hiện export dữ liệu ra excel
  - Lãnh đạo đơn vị, Lãnh đạo địa phương, Cán bộ, Cán bộ địa phương có thể xem chi tiết kết quả khảo sát (số người tham gia, số người hài lòng, số người không hài lòng). Hệ thống tìm kiếm và hiển thị kết quả
  - Lãnh đạo đơn vị, Lãnh đạo địa phương, Cán bộ, Cán bộ địa phương có thể export thông tin kết quả khảo sát ra excel. Hệ thống thực hiện export dữ liệu ra excel

#### UC-E.6 – Cập nhật kết quả khảo sát (không phải khảo sát trực tuyến)

- **Tên Use Case:** Cập nhật kết quả khảo sát (không phải khảo sát trực tuyến)
- **Tác nhân chính:** Cán bộ, Cán bộ địa phương
- **Mô tả trường hợp sử dụng:**
  - Cán bộ, Cán bộ địa phương có thể xem danh sách đợt khảo sát (trực tiếp/gián tiếp thông qua phiếu khảo sát…) đang diễn ra. Hệ thống tìm kiếm và hiển thị danh sách
  - Cán bộ, Cán bộ địa phương có thể lựa chọn đợt khảo sát để thêm mới kết quả khảo sát. Hệ thống kiểm tra và cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể lựa chọn đợt khảo sát để chỉnh sửa kết quả khảo sát. Hệ thống kiểm tra và cập nhật dữ liệu
  - Cán bộ, Cán bộ địa phương có thể lựa chọn đợt khảo sát để xóa kết quả khảo sát. Hệ thống kiểm tra và thực hiện xóa dữ liệu
