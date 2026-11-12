---
key: admin
title: HƯỚNG DẪN SỬ DỤNG
product: HỆ THỐNG ĐÁNH GIÁ CHUYỂN ĐỔI SỐ
subtitle: Đánh giá, phê duyệt và theo dõi kết quả chuyển đổi số
role: DÀNH CHO QUẢN TRỊ HỆ THỐNG
org_top: Bộ Dân tộc và Tôn giáo
author: Hồ Thị Thủy Tiên
version: 1.4
date: 29/10/2026
org: Trung tâm Chuyển đổi số – Bộ Dân tộc và Tôn giáo
header: Hướng dẫn sử dụng Hệ thống đánh giá chuyển đổi số – Dành cho Quản trị hệ thống
logo: ../out/img/chung/logo.png
---
<!-- Vai trò Quản trị hệ thống. Phần A (menu Quản trị hệ thống): _admin-a.md; Phần B (menu Bộ chỉ số DTI): _admin-b.md.
     Phần chung: _chung-dang-nhap.md, _chung-tai-khoan.md (ảnh ../out/img/admin/chung-*.png) -->
@history
V1.0 | 28/10/2026 | Ban hành lần đầu tài liệu hướng dẫn sử dụng Hệ thống đánh giá chuyển đổi số dành cho Quản trị hệ thống. | Hồ Thị Thủy Tiên
V1.1 | 29/10/2026 | Bổ sung quy tắc tìm kiếm, giới hạn ký tự, trùng Mã/Tên ở các màn hình Quản trị hệ thống và Bộ chỉ số DTI. | Hồ Thị Thủy Tiên
V1.2 | 29/10/2026 | Bổ sung chương Sao lưu dữ liệu (lịch sử, cấu hình tự động, tạo sao lưu ngay, chi tiết, xóa bản sao). | Hồ Thị Thủy Tiên
V1.3 | 29/10/2026 | Tách riêng từng chức năng Xem chi tiết, Thêm mới, Cập nhật, Xóa, Nhân bản (gồm cả Thông tin cá nhân); Khóa/Mở khóa trình bày chung một mục. | Hồ Thị Thủy Tiên
V1.4 | 30/10/2026 | Rà soát Sao lưu dữ liệu theo màn hình thực tế (cấu hình là trang riêng, hộp thoại tạo bản sao, chi tiết và xóa); bổ sung chương Nhật ký truy cập. | Hồ Thị Thủy Tiên

# GIỚI THIỆU CHUNG

**Hệ thống đánh giá chuyển đổi số** giúp các đơn vị tự chấm điểm theo Bộ chỉ số DTI, Lãnh đạo phê duyệt và Bộ tổng hợp kết quả.

**Quản trị hệ thống** cấu hình hệ thống, người dùng, danh mục đơn vị, cấu trúc bộ chỉ số, thang xếp loại và kỳ tự đánh giá.

| Bạn có thể làm gì trên hệ thống | Xem tại chương |
|---|---|
| Đăng nhập, làm quen giao diện, xem thông báo | Đăng nhập hệ thống; Làm quen với giao diện |
| Tạo, cập nhật, khóa/mở khóa, xóa tài khoản người dùng | Quản lý người dùng |
| Tạo nhóm người dùng, quản lý thành viên nhóm | Quản lý nhóm người dùng |
| Cấp và hủy quyền chức năng cho nhóm người dùng | Ma trận phân quyền |
| Quản lý danh mục tỉnh/thành, xã/phường, loại đơn vị, đơn vị | Đơn vị hành chính cấp tỉnh; Đơn vị hành chính cấp xã; Loại đơn vị; Quản lý đơn vị |
| Thiết lập tham số bảo mật tài khoản, minh chứng | Tham số hệ thống |
| Xem lịch sử, cấu hình sao lưu tự động, tạo và xóa bản sao lưu | Sao lưu dữ liệu |
| Xem nhật ký đăng nhập, đăng xuất và phiên làm việc của người dùng | Nhật ký truy cập |
| Khai báo trụ cột, nhóm chỉ số, chỉ số | Xây dựng cấu trúc bộ chỉ số |
| Lập bộ chỉ số, cấu hình trọng số và điểm, nhân bản phiên bản mới | Quản lý bộ chỉ số |
| Xem, thêm, sửa, xóa, khóa/mở khóa thang xếp loại | Quản lý thang xếp loại |
| Tạo kỳ tự đánh giá định kỳ/đột xuất, phân công đơn vị, trình phê duyệt, trình lại | Quản lý tự đánh giá |
| Cập nhật thông tin cá nhân, đổi mật khẩu, lấy lại mật khẩu, đăng xuất | Quản lý tài khoản cá nhân |

:::info Chuẩn bị trước khi dùng
- Trình duyệt Chrome, Edge hoặc Firefox mới; màn hình rộng từ 1440 điểm ảnh.
- Tài khoản thuộc nhóm **Quản trị hệ thống**.
:::

@include _chung-dang-nhap.md

@include _admin-a.md

@include _admin-b.md

@include _chung-tai-khoan.md

# NHỮNG ĐIỀU CẦN GHI NHỚ

- Khai báo theo thứ tự **Trụ cột → Nhóm chỉ số → Chỉ số → Bộ chỉ số**; **khóa** từng tầng thì tầng sau mới chọn được.
- Bản ghi đã khóa hoặc đang có dữ liệu con không sửa, không xóa được.
- Muốn đổi bộ chỉ số đã dùng, **Nhân bản** thành phiên bản mới.
- Thang xếp loại cần tối thiểu 2 mức, phủ kín 0 – 100%; thang đã gắn vào kỳ không sửa được.
- Mỗi kỳ dùng bản sao riêng của bộ chỉ số; chỉnh điểm tại **Xem cấu hình điểm**.
- Phân công ít nhất 1 đơn vị trước khi **Trình phê duyệt**; chỉ xóa được kỳ **Nháp**.
- Cấp quyền theo **nhóm người dùng** tại Ma trận phân quyền.

# CÂU HỎI THƯỜNG GẶP (FAQ)

## Người dùng và phân quyền

:::faq Người dùng không thấy một chức năng trên menu?
Kiểm tra nhóm của tài khoản tại **Người dùng**, rồi quyền Xem của nhóm tại **Ma trận phân quyền**.
:::

:::faq Người dùng quên mật khẩu và không truy cập được email?
Mở **Cập nhật** người dùng, nhập **Mật khẩu mới**, nhấn **Lưu** và gửi lại cho người dùng.
:::

## Bộ chỉ số

:::faq Không chọn được trụ cột/nhóm khi tạo nhóm chỉ số/chỉ số?
Chỉ hiển thị bản ghi **Đã khóa**. Hãy khóa trước rồi tạo lại.
:::

:::faq Không sửa hoặc xóa được chỉ số, nhóm, trụ cột?
Bản ghi đã khóa, đang có dữ liệu con hoặc đang được dùng. Mở khóa hoặc xóa dữ liệu con trước.
:::

:::faq Không thấy bộ chỉ số khi tạo kỳ tự đánh giá?
Bộ chưa khóa. Đưa ô **Cần kiểm tra** về 0 rồi **Khoá** bộ chỉ số.
:::

:::faq Muốn chỉnh điểm riêng cho một kỳ?
Nhấn **Xem cấu hình điểm** khi kỳ ở trạng thái Nháp hoặc Bị từ chối; bộ gốc không đổi.
:::

## Thang xếp loại

:::faq Nút Lưu thang xếp loại bị mờ?
Các mức chưa phủ kín 0 – 100%; nhập **100** cho mức cuối.
:::

:::faq Không sửa hoặc mở khóa được thang xếp loại?
Thang đang được kỳ sử dụng. Tạo thang mới nếu cần đổi.
:::

## Kỳ tự đánh giá

:::faq Không trình phê duyệt được kỳ?
Chưa phân công đơn vị. Nhấn **Phân công đơn vị**, chọn ít nhất 1 đơn vị, **Lưu** rồi trình lại.
:::

:::faq Kỳ bị từ chối thì xem lý do ở đâu?
Ở khung **Lịch sử xử lý**; điều chỉnh rồi nhấn **Trình phê duyệt**.
:::

:::faq Không xóa được kỳ tự đánh giá?
Chỉ xóa được kỳ **Nháp**.
:::

-> **— HẾT —**

-> *Mọi vướng mắc trong quá trình sử dụng, vui lòng liên hệ Trung tâm Chuyển đổi số – Bộ Dân tộc và Tôn giáo để được hỗ trợ.*
