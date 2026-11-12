---
key: ldd
title: HƯỚNG DẪN SỬ DỤNG
product: HỆ THỐNG ĐÁNH GIÁ CHUYỂN ĐỔI SỐ
subtitle: Đánh giá, phê duyệt và theo dõi kết quả chuyển đổi số
role: DÀNH CHO LÃNH ĐẠO ĐỊA PHƯƠNG
org_top: Bộ Dân tộc và Tôn giáo
author: Hồ Thị Thủy Tiên
version: 2.1
date: 29/10/2026
org: Trung tâm Chuyển đổi số – Bộ Dân tộc và Tôn giáo
header: Hướng dẫn sử dụng Hệ thống đánh giá chuyển đổi số – Dành cho Lãnh đạo địa phương
logo: ../out/img/chung/logo.png
---
<!-- Vai trò Lãnh đạo địa phương (Sở/Ban/Ngành cấp tỉnh; sao chép từ lanh-dao-don-vi.md, dùng chung ảnh ldd). Ảnh chụp bằng tools/capture-lanh-dao-don-vi.mjs → ../out/img/ldd/*.png
     Phần chung: _chung-dang-nhap.md, _chung-tai-khoan.md (ảnh ../out/img/ldd/chung-*.png) -->
@history
V1.0 | 29/10/2026 | Ban hành lần đầu tài liệu hướng dẫn sử dụng Hệ thống đánh giá chuyển đổi số dành cho Lãnh đạo địa phương. | Hồ Thị Thủy Tiên
V1.3 | 29/10/2026 | Tách riêng chức năng Xem thông tin cá nhân và Cập nhật thông tin cá nhân; chuẩn hóa tên mục Xem danh sách đợt khảo sát, Xem kết quả kỳ. | Hồ Thị Thủy Tiên
V1.4 | 30/10/2026 | Sửa mục Xem chi tiết kết quả tự đánh giá: 5 bước khớp với hình (banner, thông tin chung, tab, nút Phê duyệt/Từ chối). | Hồ Thị Thủy Tiên
V1.5 | 30/10/2026 | Bổ sung nội dung hộp thoại Xác nhận phê duyệt (kỳ, đơn vị, tổng điểm) và nút Huỷ; khớp với hình. | Hồ Thị Thủy Tiên
V1.6 | 30/10/2026 | Bổ sung hình minh họa bước 1 (nút Phê duyệt) cho mục Phê duyệt kết quả tự đánh giá. | Hồ Thị Thủy Tiên
V1.7 | 30/10/2026 | Sửa mục Xem hồ sơ đã gửi Bộ: bước 2 có hình minh họa nút Tải xuống; đưa thao tác mở danh sách lên câu dẫn. | Hồ Thị Thủy Tiên
V1.8 | 30/10/2026 | Sửa mục Xem kết quả kỳ (Dashboard đơn vị): bước 2 mô tả đúng các bộ lọc trên màn hình; hình có nhãn BƯỚC 1–3 khớp các bước. | Hồ Thị Thủy Tiên
V1.9 | 30/10/2026 | Gộp mục So sánh kết quả của đơn vị theo thời gian vào mục So sánh đơn vị (chế độ So sánh qua các kỳ); bỏ mô tả tab không có trên hệ thống. | Hồ Thị Thủy Tiên
V2.1 | 30/10/2026 | Xóa bước 4 bị lặp ở mục Xem danh sách kết quả tự đánh giá (đã có bước Xem chi tiết là bước 5). | Hồ Thị Thủy Tiên
V2.0 | 30/10/2026 | Mục Xem danh sách kết quả tự đánh giá: tách bước tìm kiếm, lọc và Xem chi tiết để khớp với hình (BƯỚC 1–5). | Hồ Thị Thủy Tiên

# GIỚI THIỆU CHUNG

**Hệ thống đánh giá chuyển đổi số** của Bộ Dân tộc và Tôn giáo dùng để triển khai Bộ chỉ số DTI và khảo sát mức độ hài lòng của người dân.

**Lãnh đạo địa phương** có thể:

- **Phê duyệt** hoặc **từ chối** kết quả tự đánh giá do Cán bộ trình.
- Xem hồ sơ đã gửi Bộ; **xin mở khóa** kết quả đã gửi khi cần chỉnh sửa.
- **Phê duyệt** hoặc **từ chối** đợt khảo sát hài lòng; xem, xuất kết quả khảo sát.
- Xem, xuất báo cáo: Dashboard đơn vị, Bảng xếp hạng, So sánh đơn vị.

:::info Phạm vi dữ liệu
Lãnh đạo địa phương là lãnh đạo tại Sở/Ban/Ngành (cấp tỉnh); dữ liệu hiển thị là của đơn vị mình.
:::

| Bạn muốn | Xem chương |
|---|---|
| Đăng nhập, làm quen giao diện | Đăng nhập hệ thống; Làm quen với giao diện |
| Phê duyệt / từ chối kết quả; xin mở khóa | Phê duyệt kết quả tự đánh giá |
| Phê duyệt / từ chối đợt khảo sát | Phê duyệt đợt khảo sát |
| Xem, xuất kết quả khảo sát | Xem kết quả khảo sát |
| Dashboard, xếp hạng, so sánh | Báo cáo thống kê |
| Đổi mật khẩu, thông tin cá nhân | Quản lý tài khoản cá nhân |

:::info Chuẩn bị trước khi dùng
- Máy tính có Internet, trình duyệt Chrome, Edge hoặc Firefox mới.
- Tài khoản do Quản trị hệ thống cấp (gửi qua email).
- Có việc chờ duyệt, hệ thống báo ở biểu tượng chuông; nhấn vào để mở thẳng màn hình cần xử lý.
- Phạm vi *Đơn vị và đơn vị con* được theo dõi đơn vị con: xem tài liệu dành cho Lãnh đạo Bộ.
:::

@include _chung-dang-nhap.md

# PHÊ DUYỆT KẾT QUẢ TỰ ĐÁNH GIÁ

Cán bộ chấm điểm và nhấn **Trình duyệt**, kết quả sang **Chờ duyệt**. Lãnh đạo đơn vị **Phê duyệt** hoặc **Từ chối**.

Đường dẫn truy cập: **Menu → Đánh giá CĐS → Kết quả tự đánh giá**

| Bước | Người thực hiện | Trạng thái |
|---|---|---|
| Chấm điểm, trình duyệt | Cán bộ | Chờ duyệt |
| Phê duyệt | Lãnh đạo đơn vị | Đã phê duyệt |
| Từ chối | Lãnh đạo đơn vị | Bị từ chối |
| Gửi Bộ | Cán bộ | Đã gửi |
| Xin mở khóa | Lãnh đạo đơn vị | Chờ mở khóa |

## Xem danh sách kết quả tự đánh giá

1. Chọn menu **Đánh giá CĐS → Kết quả tự đánh giá**.
2. Chọn **Định kỳ** hoặc **Đột xuất**.
3. Nhấn tab **Chờ duyệt** để xem kết quả cần xử lý.
4. Nếu cần, tìm kiếm ở ô **Tìm kiếm đơn vị, kỳ tự đánh giá** hoặc lọc theo **Trạng thái tiến trình**, **Kỳ đánh giá**.
5. Nhấn **Xem chi tiết** ở dòng cần xem.

![Danh sách kết quả, tab Chờ duyệt](../out/img/ldd/kq-danh-sach.png)

## Xem chi tiết kết quả tự đánh giá

1. Nhấn **Xem chi tiết** ở dòng kết quả cần xử lý.
2. Đọc dòng thông báo màu vàng ở đầu trang: kết quả đang chờ bạn phê duyệt và thời gian cán bộ trình.
3. Kiểm tra khối **Thông tin chung**: đơn vị thực hiện, phân loại, thời gian thực hiện, bộ chỉ số áp dụng.
4. Xem các tab **Chấm điểm**, **Hồ sơ gửi Bộ**, **Lịch sử** (xem mẹo bên dưới).
5. Nhấn **Phê duyệt** hoặc **Từ chối** ở góc trên bên phải.

![Chi tiết kết quả đang chờ duyệt](../out/img/ldd/kq-chi-tiet.png)

![Tab Lịch sử](../out/img/ldd/kq-lich-su.png){w=14}

:::tip Mẹo
Xem tab **Lịch sử** trước khi duyệt để biết kết quả từng bị từ chối chưa, rồi kiểm tra tab **Chấm điểm**.
:::

## Phê duyệt kết quả tự đánh giá

1. Tại chi tiết kết quả **Chờ duyệt**, nhấn **Phê duyệt**. Hộp thoại **Xác nhận phê duyệt kết quả tự đánh giá** hiện ra, ghi rõ kỳ tự đánh giá, đơn vị và tổng điểm phê duyệt. Kiểm tra lại các thông tin này.
2. Nhấn **Xác nhận phê duyệt** để phê duyệt. Nếu chưa muốn phê duyệt, nhấn **Huỷ** để đóng hộp thoại.

![Bước 1 – Nhấn Phê duyệt ở trang chi tiết kết quả](../out/img/ldd/kq-nut-phe-duyet.png)

![Xác nhận phê duyệt](../out/img/ldd/kq-phe-duyet.png){w=9}

:::warn Lưu ý
- Nút **Phê duyệt**, **Từ chối** chỉ hiện khi kết quả **Chờ duyệt**.
- Phê duyệt chưa phải gửi Bộ: Cán bộ còn phải đính kèm văn bản ký số và gửi Bộ.
- Không tự huỷ phê duyệt được; nếu sai sót sau khi gửi Bộ, dùng **Xin mở khóa**.
:::

## Từ chối kết quả tự đánh giá

1. Tại chi tiết kết quả **Chờ duyệt**, nhấn **Từ chối**.
2. Nhập **Lý do từ chối**, nhấn **Xác nhận từ chối**.

![Nhập lý do từ chối](../out/img/ldd/kq-tu-choi.png){w=9}

:::warn Lưu ý
**Lý do từ chối** bắt buộc; ghi rõ chỉ số cần sửa để Cán bộ khắc phục.
:::

## Xem hồ sơ đã gửi Bộ

Ở danh sách kết quả, chọn tab **Đã gửi**, nhấn **Xem chi tiết** ở dòng cần xem.

1. Chọn tab **Hồ sơ gửi Bộ**.
2. Nhấn **Tải xuống** để tải văn bản xác nhận về máy.

![Kết quả đã gửi Bộ](../out/img/ldd/kq-da-gui.png)

![Bước 2 – Nhấn Tải xuống để tải văn bản xác nhận](../out/img/ldd/kq-ho-so-gui-bo.png){w=14}

:::info Thông tin
Kết quả đã gửi chỉ xem được. Bản gắn nhãn **Bản chính thức** là bản có hiệu lực.
:::

## Các thông báo Lãnh đạo đơn vị nhận được

| Thông báo | Khi nào |
|---|---|
| Yêu cầu tự đánh giá | Kỳ được phê duyệt, giao cho đơn vị |
| Yêu cầu phê duyệt kết quả | Cán bộ trình kết quả |
| Yêu cầu thực hiện lại | Bộ yêu cầu đánh giá lại |
| Mở khóa kết quả | Bộ duyệt/từ chối yêu cầu mở khóa |
| Đợt khảo sát chờ phê duyệt | Cán bộ trình đợt khảo sát |

## Xin mở khóa kết quả đã gửi Bộ

1. Mở kết quả **Đã gửi**, nhấn **Xin mở khóa**.
2. Nhập **Lý do xin mở khóa**, nhấn **Gửi yêu cầu mở khóa**.

![Nhấn Xin mở khóa](../out/img/canbo/c-mo-khoa-nut.png)

![Nhập lý do và gửi](../out/img/canbo/c-mo-khoa-dlg.png){w=9}

| Phía Bộ quyết định | Kết quả |
|---|---|
| Duyệt mở khóa | Về **Đang chấm điểm**; Cán bộ chỉnh sửa, gửi lại Bộ |
| Từ chối mở khóa | Về **Đã gửi**, giữ nguyên |

:::warn Lưu ý
- Chỉ Lãnh đạo đơn vị được xin mở khóa; Cán bộ không có quyền này.
- Chỉ xin được khi kết quả **Đã gửi** và kỳ **đang diễn ra**; lý do bắt buộc, tối đa 255 ký tự.
- Không gửi lại kịp hạn thì bản đã gửi trước đó vẫn là kết quả chính thức.
:::

# PHÊ DUYỆT ĐỢT KHẢO SÁT

Cán bộ tạo và trình đợt khảo sát hài lòng. Đợt chỉ nhận phiếu của người dân sau khi được phê duyệt.

Đường dẫn truy cập: **Menu → Khảo sát hài lòng → Đợt khảo sát**

## Xem danh sách đợt khảo sát

1. Chọn **Khảo sát hài lòng → Đợt khảo sát**.
2. Nhấn tab trạng thái; tìm kiếm hoặc lọc nếu cần.
3. Nhấn **Xuất Excel** để tải danh sách đang hiển thị.
4. Nhấn **Xem chi tiết** ở dòng cần xem.

![Danh sách đợt khảo sát](../out/img/ldd/ks-danh-sach.png)

## Phê duyệt đợt khảo sát

1. Chọn tab **Chờ phê duyệt**.
2. Nhấn tên đợt (hoặc **Xem chi tiết**) để đọc nội dung.
3. Nhấn **Phê duyệt**.
4. Nhấn **Có** để xác nhận.

![Tab Chờ phê duyệt](../out/img/ldd/ks-cho-phe-duyet.png)

![Chi tiết đợt khảo sát chờ phê duyệt](../out/img/ldd/ks-chi-tiet.png)

![Xác nhận phê duyệt](../out/img/ldd/ks-phe-duyet.png){w=8}

:::warn Lưu ý
- Xử lý trước **Hạn duyệt**; quá hạn, đợt tự chuyển sang **Bị từ chối**.
- Người trình không tự duyệt hoặc từ chối đợt của mình.
- Đợt được duyệt tự mở nhận phiếu vào ngày bắt đầu: kiểm tra kỹ câu hỏi, thời gian, số phiếu mục tiêu.
:::

## Từ chối đợt khảo sát

1. Tại chi tiết đợt **Chờ phê duyệt**, nhấn **Từ chối**.
2. Nhập **Lý do từ chối** (bắt buộc, tối đa 1.000 ký tự), nhấn **Có**.

![Nhập lý do từ chối](../out/img/ldd/ks-tu-choi.png){w=9}

# XEM KẾT QUẢ KHẢO SÁT

Xem số phiếu, tỷ lệ hài lòng, kết quả theo câu hỏi và góp ý của người dân.

Đường dẫn truy cập: **Menu → Khảo sát hài lòng → Đợt khảo sát → Xem chi tiết → Kết quả**

1. Chọn tab **Đang diễn ra** hoặc **Đã kết thúc**, nhấn **Xem chi tiết**.
2. Chọn mục **Kết quả**.
3. Nhấn **Xuất Excel** để tải kết quả.

![Kết quả khảo sát](../out/img/ldd/ks-ket-qua.png){w=14}

:::info Thông tin
- Số liệu **Tạm tính** còn thay đổi đến khi đợt kết thúc.
- Tỷ lệ hài lòng = Lượt Hài lòng ÷ Tổng lượt đánh giá × 100%.
- Đợt **Chờ phê duyệt** hoặc **Bị từ chối** chưa có kết quả.
:::

# BÁO CÁO THỐNG KÊ

Các màn hình chỉ dùng để xem và xuất dữ liệu.

## Dashboard đơn vị

Đường dẫn truy cập: **Menu → Báo cáo thống kê → Dashboard đơn vị**

Gồm hai tab: **Kết quả kỳ** và **So sánh theo thời gian**.

### Xem kết quả kỳ

1. Chọn **Báo cáo thống kê → Dashboard đơn vị**.
2. Trong dòng bộ lọc, chọn **Xem theo** (Tháng, Quý hoặc Năm), **Loại** (ví dụ Định kỳ), **Kỳ** và **Bộ chỉ số**. Nếu bạn được xem đơn vị con, dòng bộ lọc có thêm **Đơn vị**.
3. Nhấn **Xuất Excel** để tải kết quả.

![Dashboard đơn vị – Bước 1 chọn menu, Bước 2 dòng bộ lọc, Bước 3 Xuất Excel](../out/img/ldd/bc-dashboard.png)

## Bảng xếp hạng

Đường dẫn truy cập: **Menu → Báo cáo thống kê → Bảng xếp hạng**

1. Chọn **Báo cáo thống kê → Bảng xếp hạng**.
2. Chọn **Bộ chỉ số**, **Hình thức**, **Tên kỳ đánh giá**.
3. Chọn **Xem số liệu** (bảng) hoặc **Xem dữ liệu cột** (biểu đồ).
4. Nhấn **Xuất Excel** để tải bảng xếp hạng.

![Bảng xếp hạng](../out/img/ldd/bc-xep-hang.png)

## So sánh đơn vị

Đường dẫn truy cập: **Menu → Báo cáo thống kê → So sánh đơn vị**

1. Chọn **Báo cáo thống kê → So sánh đơn vị**.
2. Chọn **Xem theo**, **Loại**, **Khoảng thời gian**, **Kỳ đánh giá**, **Chỉ tiêu so sánh**.
3. Nhấn **Thêm đơn vị** (tối thiểu 2 đơn vị).
4. Chọn **So sánh chi tiết** để so các đơn vị trong một kỳ, hoặc **So sánh qua các kỳ** để so kết quả theo thời gian.
5. Nhấn **Xuất Excel** để tải kết quả.

![So sánh đơn vị](../out/img/ldd/bc-so-sanh.png)

:::info Thông tin
- Chỉ đơn vị đã gửi kết quả trong kỳ mới có số liệu so sánh.
- Kỳ đang diễn ra có nhãn **Tạm thời**; kỳ chưa gửi hiển thị *Chưa có dữ liệu*.
- Mục **So sánh đơn vị** chỉ hiện khi tài khoản có quyền và phạm vi từ 2 đơn vị trở lên.
:::

@include _chung-tai-khoan.md

# NHỮNG ĐIỀU CẦN GHI NHỚ

- Thường xuyên xem chuông **thông báo** và tab **Chờ duyệt** / **Chờ phê duyệt** để xử lý kịp hạn.
- Xem tab **Chấm điểm** và **Lịch sử** trước khi phê duyệt.
- Khi từ chối, ghi lý do cụ thể.
- Phê duyệt không đồng nghĩa với gửi Bộ.
- Sửa kết quả đã gửi Bộ: **Xin mở khóa** khi kỳ còn diễn ra.
- Không chia sẻ tài khoản; đăng xuất khi dùng máy dùng chung.

# CÂU HỎI THƯỜNG GẶP (FAQ)

:::faq Tôi không thấy nút Phê duyệt / Từ chối?
Nút chỉ hiện khi kết quả **Chờ duyệt**.
:::

:::faq Đã phê duyệt nhầm thì làm sao?
Không tự huỷ được. Sau khi gửi Bộ, nhấn **Xin mở khóa** (khi kỳ chưa kết thúc).
:::

:::faq Kết quả bị từ chối thì tiếp theo thế nào?
Cán bộ chỉnh sửa và trình lại; kết quả xuất hiện lại ở tab **Chờ duyệt**.
:::

:::faq Vì sao danh sách Chờ duyệt trống dù có thông báo?
Kiểm tra loại kỳ (**Định kỳ** / **Đột xuất**) và các bộ lọc đang chọn.
:::

:::faq Vì sao đợt khảo sát chưa có kết quả?
Đợt chưa được duyệt, chưa đến ngày nhận phiếu, hoặc chưa có phiếu nào.
:::

:::faq Người dân tham gia khảo sát bằng cách nào?
Mở đường dẫn công khai hoặc quét mã QR của đợt khảo sát, không cần tài khoản.
:::

:::faq Bảng xếp hạng không có dữ liệu?
Kỳ chưa có đơn vị gửi kết quả, hoặc bộ lọc chưa đúng.
:::

-> **— HẾT —**

-> *Mọi vướng mắc trong quá trình sử dụng, vui lòng liên hệ Quản trị hệ thống hoặc Trung tâm Chuyển đổi số – Bộ Dân tộc và Tôn giáo để được hỗ trợ.*
