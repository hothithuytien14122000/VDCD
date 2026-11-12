<!-- Phần dùng chung cho mọi vai trò có tài khoản: Đăng nhập + Làm quen giao diện.
     Ảnh theo vai trò dùng ../out/img/{key}/chung-*.png (chụp bằng tools/capture-chung.mjs <key>) -->
# ĐĂNG NHẬP HỆ THỐNG

Tài khoản do **Quản trị hệ thống** cấp và gửi qua email.

Đường dẫn truy cập: **https://cds.geneat.pro**

## Truy cập trang đăng nhập

1. Mở trình duyệt (Chrome, Edge hoặc Firefox) và vào địa chỉ hệ thống.
2. Nhấn **Đăng nhập** hoặc **Đăng nhập hệ thống**.

![Bước 2 – Nhấn Đăng nhập hoặc Đăng nhập hệ thống tại trang giới thiệu](../out/img/chung/trang-cong-khai.png)

## Đăng nhập bằng tài khoản được cấp

1. Nhập **Tên đăng nhập**.
2. Nhập **Mật khẩu**.
3. Nhập **Mã xác nhận** (nhấn ↻ để đổi mã).
4. Nhấn **Đăng nhập**.
   ! Tích **Ghi nhớ đăng nhập** nếu dùng máy cá nhân.

![Bước 1–4 – Nhập Tên đăng nhập, Mật khẩu, Mã xác nhận rồi nhấn Đăng nhập](../out/img/chung/dang-nhap.png)

Bỏ trống thông tin, hệ thống báo lỗi dưới ô tương ứng.

![Thông báo lỗi khi chưa nhập đủ thông tin bắt buộc](../out/img/chung/dang-nhap-loi-bat-buoc.png){w=8}

:::warn Lưu ý
- Lần đầu đăng nhập phải **đổi mật khẩu ban đầu**.
- Nhập sai mật khẩu nhiều lần, tài khoản bị **tạm khóa**.
- Không chia sẻ tài khoản cho người khác.
:::

# LÀM QUEN VỚI GIAO DIỆN

Menu hiển thị theo quyền của tài khoản.

![Bố cục màn hình làm việc](../out/img/{key}/chung-bo-cuc.png)

| Khu vực | Mô tả |
|---|---|
| (1) Menu chức năng | Mở/thu gọn nhóm chức năng; nút ☰ thu gọn menu |
| (2) Thanh tiêu đề | Đường dẫn màn hình và chuông **Thông báo** |
| (3) Khu vực làm việc | Tìm kiếm, bộ lọc, nút thao tác, danh sách |
| (4) Tài khoản | Mở **Thông tin cá nhân** hoặc **Đăng xuất** |

## Thao tác chung trên màn hình danh sách

- **Tìm kiếm**: gõ từ khóa, tìm được cả **Mã** và **Tên**; không phân biệt hoa/thường và dấu.
- **Bộ lọc**: kết hợp với từ khóa theo điều kiện VÀ; đổi điều kiện thì về trang 1.
- **Tab trạng thái**: xem nhanh bản ghi theo trạng thái.
- **Phân trang**: chuyển trang, chọn số dòng mỗi trang.
- **Cột Thao tác**: Xem, Cập nhật, Xóa…
- **Xuất Excel**: tải danh sách đang lọc về máy.

## Xem thông báo

1. Nhấn biểu tượng chuông (số đỏ là thông báo chưa đọc).
2. Chọn tab **Tất cả** hoặc **Chưa đọc**.
3. Nhấn thông báo để mở màn hình liên quan, hoặc **Đánh dấu đã đọc tất cả**.

![Danh sách thông báo](../out/img/{key}/chung-thong-bao.png)

### Quy tắc nhập liệu chung

:::warn Áp dụng cho các màn hình thêm mới/cập nhật
- **Giới hạn ký tự**: Mã tối đa 50; Tên, Họ tên, Email tối đa 255 (*Tên chỉ số*, *Tên nhóm chỉ số* tối đa 500); Mô tả, Ghi chú, Lý do tối đa 1.000. Toàn khoảng trắng coi là để trống.
- **Mã**: chỉ gồm A–Z không dấu, 0–9, - _ . ; không trùng bản ghi nào đã có (kể cả đã khóa).
- **Tên**: không được trùng trong cùng nhóm cha (không phân biệt hoa/thường, có phân biệt dấu).
- **Tên đăng nhập, Email và Mật khẩu** phân biệt chữ hoa/thường.
:::
