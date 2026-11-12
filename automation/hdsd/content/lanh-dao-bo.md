---
key: lanhdaobo
title: HƯỚNG DẪN SỬ DỤNG
product: HỆ THỐNG ĐÁNH GIÁ CHUYỂN ĐỔI SỐ
subtitle: Đánh giá, phê duyệt và theo dõi kết quả chuyển đổi số
role: DÀNH CHO LÃNH ĐẠO BỘ
org_top: Bộ Dân tộc và Tôn giáo
author: Hồ Thị Thủy Tiên
version: 1.11
date: 29/10/2026
org: Trung tâm Chuyển đổi số – Bộ Dân tộc và Tôn giáo
header: Hướng dẫn sử dụng Hệ thống đánh giá chuyển đổi số – Dành cho Lãnh đạo Bộ
logo: ../out/img/chung/logo.png
---
<!-- Vai trò Lãnh đạo (Lãnh đạo Bộ). Ảnh chụp bằng tools/capture-lanh-dao-bo.mjs → ../out/img/lanhdaobo/*.png
     Phần chung: _chung-dang-nhap.md, _chung-tai-khoan.md (ảnh ../out/img/lanhdaobo/chung-*.png) -->
@history
V1.0 | 28/10/2026 | Ban hành lần đầu tài liệu hướng dẫn sử dụng Hệ thống đánh giá chuyển đổi số dành cho Lãnh đạo Bộ. | Hồ Thị Thủy Tiên
V1.1 | 29/10/2026 | Bổ sung quy tắc tìm kiếm, quy tắc nhập liệu chung; cập nhật giới hạn lý do 1.000 ký tự. | Hồ Thị Thủy Tiên
V1.2 | 29/10/2026 | Rà soát theo SRS v1.4: làm rõ tác nhân Phía Bộ (UC2.1–UC2.5), người xin mở khóa là Lãnh đạo đơn vị; bổ sung Xuất bảng xếp hạng (UC2.2), Xuất so sánh đơn vị (UC2.5). | Hồ Thị Thủy Tiên
V1.3 | 29/10/2026 | Tách riêng chức năng Xem thông tin cá nhân và Cập nhật thông tin cá nhân; bổ sung cách mở kỳ tự đánh giá từ thông báo Yêu cầu phê duyệt. | Hồ Thị Thủy Tiên
V1.4 | 29/10/2026 | Làm rõ 2 cách Phê duyệt và Từ chối kỳ tự đánh giá: từ màn chi tiết kỳ và từ danh sách (menu thao tác). | Hồ Thị Thủy Tiên
V1.5 | 29/10/2026 | Làm lại mục Xem chi tiết kết quả của một đơn vị: ảnh đúng từng bước, tên tab theo màn hình thực tế. | Hồ Thị Thủy Tiên
V1.6 | 29/10/2026 | Mô tả rõ hơn mục Xem chi tiết kết quả của một đơn vị: nội dung từng tab, ghi chú tên tab chuyển thành khối lưu ý. | Hồ Thị Thủy Tiên
V1.7 | 30/10/2026 | Sửa mục Xem danh sách kỳ tự đánh giá: các bước khớp với hình (4 bước, bổ sung bước tìm kiếm). | Hồ Thị Thủy Tiên
V1.8 | 30/10/2026 | Bổ sung bước 4, 5 cho mục Xem danh sách kết quả của các đơn vị để khớp với hình. | Hồ Thị Thủy Tiên
V1.9 | 30/10/2026 | Sửa mục So sánh đơn vị: tách bước chọn kỳ và chỉ tiêu, thêm bước Xuất Excel, khớp với hình. | Hồ Thị Thủy Tiên
V1.10 | 30/10/2026 | Sửa mục Bảng xếp hạng: tách từng bộ lọc thành bước riêng, khớp với hình. | Hồ Thị Thủy Tiên
V1.11 | 30/10/2026 | Bỏ bước Xuất Excel ở mục Bảng xếp hạng vì màn hình không có nút này. | Hồ Thị Thủy Tiên

# GIỚI THIỆU CHUNG

**Hệ thống đánh giá chuyển đổi số** của Bộ Dân tộc và Tôn giáo dùng để triển khai Bộ chỉ số DTI: đơn vị tự chấm điểm, Lãnh đạo đơn vị phê duyệt, gửi kết quả về Bộ.

**Lãnh đạo Bộ** có thể:

- Phê duyệt hoặc từ chối **kỳ tự đánh giá** do Cán bộ trình.
- Theo dõi kết quả tự đánh giá của các đơn vị.
- Duyệt hoặc từ chối **yêu cầu mở khóa** kết quả.
- Gửi nhắc nhở, yêu cầu đơn vị đánh giá lại (khi được phân quyền).
- Xem, xuất bảng xếp hạng và so sánh đơn vị.

| Bạn muốn | Xem chương |
|---|---|
| Đăng nhập, làm quen giao diện | Đăng nhập hệ thống; Làm quen với giao diện |
| Phê duyệt / từ chối kỳ | Phê duyệt kỳ tự đánh giá |
| Theo dõi kết quả các đơn vị | Theo dõi kết quả tự đánh giá của các đơn vị |
| Duyệt / từ chối mở khóa | Xử lý yêu cầu mở khóa kết quả |
| Nhắc nhở, yêu cầu đánh giá lại, xuất Excel | Gửi nhắc nhở và yêu cầu đánh giá lại |
| Xếp hạng, so sánh đơn vị | Báo cáo thống kê |
| Đổi mật khẩu, thông tin cá nhân | Quản lý tài khoản cá nhân |

:::info Chuẩn bị trước khi dùng
- Máy tính có Internet, trình duyệt Chrome, Edge hoặc Firefox mới.
- Tài khoản do Quản trị hệ thống cấp. Không thấy chức năng cần dùng: liên hệ Quản trị hệ thống.
- Ba chương *Theo dõi kết quả*, *Xử lý yêu cầu mở khóa*, *Gửi nhắc nhở* cũng dùng cho Lãnh đạo đơn vị/Cán bộ phía Bộ được cấp quyền; dữ liệu giới hạn theo phạm vi tài khoản.
:::

@include _chung-dang-nhap.md

# PHÊ DUYỆT KỲ TỰ ĐÁNH GIÁ

Cán bộ trình kỳ tự đánh giá (**Định kỳ** hoặc **Đột xuất**), Lãnh đạo Bộ **Phê duyệt** hoặc **Từ chối**.

Đường dẫn truy cập: **Menu → Bộ chỉ số DTI → Quản lý tự đánh giá**

| Trạng thái | Thao tác của Lãnh đạo Bộ |
|---|---|
| Nháp | Chỉ xem |
| Chờ phê duyệt | Phê duyệt, Từ chối |
| Đã phê duyệt | Chỉ xem |
| Bị từ chối | Chỉ xem |

## Xem danh sách kỳ tự đánh giá

1. Chọn menu **Bộ chỉ số DTI → Quản lý tự đánh giá**.
2. Chọn **Định kỳ** hoặc **Đột xuất** để lọc đúng loại kỳ cần xem.
3. Nếu cần tìm nhanh, nhập tên kỳ vào ô **Tìm kiếm tên đánh giá**.
4. Xem cột **Trạng thái**: kỳ **Chờ phê duyệt** cần bạn xử lý.

![Danh sách kỳ tự đánh giá](../out/img/lanhdaobo/ky-ds.png)

## Xem chi tiết kỳ trước khi phê duyệt

1. Nhấn **Xem chi tiết** ở kỳ cần xem.
2. Kiểm tra thông tin chung, bộ chỉ số, đơn vị được phân công và **Lịch sử xử lý**.

![Bước 2 – Kiểm tra thông tin kỳ, bộ chỉ số, đơn vị được phân công và Lịch sử xử lý](../out/img/lanhdaobo/ky-chi-tiet.png)

**Mở nhanh từ thông báo:**

1. Nhấn biểu tượng **chuông** góc trên bên phải.
2. Nhấn thông báo **Yêu cầu phê duyệt kỳ tự đánh giá**.

![Bước 1–2 – Nhấn chuông, chọn thông báo Yêu cầu phê duyệt kỳ tự đánh giá](../out/img/lanhdaobo/ky-thong-bao.png){w=8}

Hệ thống mở thẳng chi tiết kỳ đó, có sẵn nút **Phê duyệt** và **Từ chối**.

## Phê duyệt kỳ tự đánh giá

Chỉ phê duyệt được kỳ ở trạng thái **Chờ phê duyệt**. Có 2 cách:

**Cách 1 – Từ màn chi tiết kỳ**

1. Mở chi tiết kỳ: nhấn **Xem chi tiết** ở danh sách, hoặc mở từ thông báo như trên.
2. Kiểm tra thông tin và **Lịch sử xử lý**, rồi nhấn **Phê duyệt**.
3. Nhấn **Có** để xác nhận.

![Nút Từ chối và Phê duyệt tại màn chi tiết kỳ](../out/img/lanhdaobo/ky-chi-tiet-nut.png){w=12}

![Xác nhận phê duyệt](../out/img/lanhdaobo/ky-phe-duyet-xn.png){w=9}

**Cách 2 – Từ danh sách**

1. Nhấn mũi tên cạnh **Xem chi tiết** của kỳ **Chờ phê duyệt**.
2. Chọn **Phê duyệt**, rồi nhấn **Có** để xác nhận.

![Chọn Phê duyệt trong menu thao tác](../out/img/lanhdaobo/ky-menu.png){w=9}

:::warn Lưu ý
- Sau khi duyệt, hệ thống tạo kết quả cho từng đơn vị và gửi thông báo.
- Kỳ đã duyệt **không sửa, không xóa** được: kiểm tra kỹ trước khi duyệt.
:::

## Từ chối kỳ tự đánh giá

Từ chối cũng có 2 cách như phê duyệt, nhưng bắt buộc nhập **Lý do từ chối**.

**Cách 1 – Từ màn chi tiết kỳ**

1. Mở chi tiết kỳ, nhấn **Từ chối**.
2. Nhập **Lý do từ chối**, nhấn **Đồng ý**.

**Cách 2 – Từ danh sách**

1. Nhấn mũi tên cạnh **Xem chi tiết** của kỳ **Chờ phê duyệt**, chọn **Từ chối**.
2. Nhập **Lý do từ chối**, nhấn **Đồng ý**.

![Nhập lý do từ chối](../out/img/lanhdaobo/ky-tu-choi.png){w=10}

![Lý do hiển thị ở Lịch sử xử lý](../out/img/lanhdaobo/ky-lich-su.png){w=7}

:::warn Lưu ý
- **Lý do từ chối** bắt buộc, tối đa 1000 ký tự.
- Chỉ kỳ **Chờ phê duyệt** mới có thao tác Phê duyệt/Từ chối.
:::

# THEO DÕI KẾT QUẢ TỰ ĐÁNH GIÁ CỦA CÁC ĐƠN VỊ

Xem tình hình tự đánh giá của các đơn vị: đã gửi, chưa gửi, chờ mở khóa.

Đường dẫn truy cập: **Menu → Đánh giá CĐS → Kết quả tự đánh giá**

## Xem danh sách kết quả của các đơn vị

1. Chọn menu **Đánh giá CĐS → Kết quả tự đánh giá**.
2. Chọn **Định kỳ** hoặc **Đột xuất**.
3. Nhấn tab trạng thái cần xem (ví dụ **Đã gửi**, **Chưa gửi**).
4. Nếu cần tìm nhanh, nhập tên đơn vị hoặc tên kỳ vào ô tìm kiếm, hoặc chọn **Trạng thái tiến trình**.
5. Chọn **Kỳ đánh giá** để chỉ xem kết quả của một kỳ.

![Danh sách kết quả của các đơn vị](../out/img/lanhdaobo/kq-ds.png)

Tab **Chưa gửi** cho biết đơn vị chưa gửi kết quả về Bộ:

![Tab Chưa gửi](../out/img/lanhdaobo/kq-tab-chua-gui.png)

## Xem chi tiết kết quả của một đơn vị

1. Ở danh sách kết quả, tìm dòng của đơn vị cần xem (có thể dùng ô tìm kiếm hoặc lọc theo **Trạng thái tiến trình**, **Kỳ đánh giá**). Nhấn **Xem chi tiết** ở cột **Thao tác** của dòng đó.
2. Trang chi tiết mở ra với phần đầu trang gồm tên kỳ đánh giá, **trạng thái** (ví dụ *Đã gửi*, *Chờ mở khóa*), tên đơn vị và hạn nộp. Phía dưới là 3 tab. Nhấn lần lượt từng tab để xem:
   - **Chấm điểm**: thông tin chung (thời gian gửi Bộ, đơn vị thực hiện, phân loại, bộ chỉ số áp dụng) và điểm của từng chỉ số.
   - **Hồ sơ gửi Bộ**: hồ sơ và minh chứng đơn vị đã gửi lên Bộ.
   - **Lịch sử**: các lần xử lý của kết quả này, kèm người thực hiện và thời gian.
3. Khi xem xong, nhấn mũi tên quay lại (←) ở đầu trang để về danh sách.

:::info Tên tab có thể khác nhau
Tab **Chấm điểm** có kèm số đếm, ví dụ **Chấm điểm (13/13)**. Với kỳ đã kết thúc chưa có chỉ số, tab này hiện là **Điểm theo nhóm** và **Chi tiết chỉ số**.
:::

![Bước 1 – Nhấn Xem chi tiết ở dòng kết quả](../out/img/lanhdaobo/kq-xem-chi-tiet.png)

![Bước 2 – Tab Chấm điểm](../out/img/lanhdaobo/kq-tab-cham-diem.png)

![Bước 2 – Tab Hồ sơ gửi Bộ](../out/img/lanhdaobo/kq-tab-ho-so.png)

![Bước 2 – Tab Lịch sử](../out/img/lanhdaobo/kq-tab-lich-su.png)

![Bước 3 – Nút quay lại (←)](../out/img/lanhdaobo/kq-quay-lai.png)

:::info Chỉ để xem
Bộ không chấm hay sửa điểm của đơn vị. Nút **Duyệt mở khóa / Từ chối mở khóa**, **Gửi nhắc nhở**, **Yêu cầu đánh giá lại** chỉ hiện theo trạng thái kết quả (hai nút sau cần phân quyền).
:::

## Các thông báo Lãnh đạo Bộ nhận được

| Thông báo | Khi nào |
|---|---|
| Yêu cầu phê duyệt kỳ tự đánh giá | Kỳ tự đánh giá được trình, chờ Lãnh đạo Bộ phê duyệt |
| Đã có kết quả tự đánh giá | Đơn vị gửi kết quả về Bộ |
| Yêu cầu mở khóa | Đơn vị xin mở khóa kết quả đã gửi |
| Sắp đến hạn | Còn đơn vị chưa gửi kết quả gần đến hạn |

Nhấn vào thông báo để mở thẳng kết quả liên quan.

# XỬ LÝ YÊU CẦU MỞ KHÓA KẾT QUẢ

**Lãnh đạo đơn vị** xin mở khóa kết quả đã gửi Bộ; kết quả chuyển sang **Chờ mở khóa**.

| Quyết định | Kết quả |
|---|---|
| Duyệt mở khóa | Về **Đang chấm điểm**; đơn vị chỉnh sửa và gửi lại Bộ |
| Từ chối mở khóa | Về **Đã gửi**, giữ nguyên bản đã gửi |

## Duyệt mở khóa

1. Chọn tab **Chờ mở khóa** (hoặc nhấn thông báo *Yêu cầu mở khóa*).
2. Nhấn mũi tên cạnh **Xem chi tiết**, chọn **Duyệt mở khóa**.
3. Nhấn **Xác nhận duyệt mở khóa**.

![Tab Chờ mở khóa](../out/img/lanhdaobo/mk-ds.png)

![Chọn Duyệt mở khóa](../out/img/lanhdaobo/mk-menu.png){w=12}

![Hoặc đọc lý do ở màn chi tiết rồi nhấn Duyệt mở khóa](../out/img/lanhdaobo/mk-chi-tiet.png)

![Xác nhận duyệt mở khóa](../out/img/lanhdaobo/mk-duyet-xn.png){w=10}

## Từ chối mở khóa

1. Nhấn mũi tên cạnh **Xem chi tiết**, chọn **Từ chối mở khóa**.
2. Nhập **Lý do từ chối mở khóa**, nhấn **Xác nhận từ chối mở khóa**.

![Từ chối mở khóa](../out/img/lanhdaobo/mk-tu-choi.png){w=10}

:::warn Lưu ý
- Chỉ xử lý khi kết quả **Chờ mở khóa** và kỳ **đang diễn ra**.
- Lý do từ chối bắt buộc, tối đa 1.000 ký tự.
:::

# GỬI NHẮC NHỞ VÀ YÊU CẦU ĐÁNH GIÁ LẠI

:::warn Cần được phân quyền
Các nút **Gửi nhắc nhở**, **Nhắc nhở đơn vị**, **Yêu cầu đánh giá lại**, **Xuất Excel** chỉ hiện khi nhóm người dùng được cấp quyền. Không thấy nút: liên hệ Quản trị hệ thống.
:::

## Gửi nhắc nhở các đơn vị chưa gửi kết quả

1. Tại **Kết quả tự đánh giá**, lọc theo kỳ, nhấn **Gửi nhắc nhở**.
2. Kiểm tra danh sách, nhập **Nội dung thông báo nhắc nhở** (nếu cần).
3. Nhấn **Gửi nhắc nhở**.

![Nút Gửi nhắc nhở](../out/img/lanhdaobo/nn-nut.png)

![Hộp thoại nhắc nhở](../out/img/lanhdaobo/nn-hop-thoai.png){w=11}

Nhắc một đơn vị: nhấn mũi tên cạnh **Xem chi tiết**, chọn **Nhắc nhở đơn vị**.

![Nhắc nhở một đơn vị](../out/img/lanhdaobo/nn-dong.png){w=12}

:::warn Lưu ý
- Chỉ nhắc đơn vị **chưa gửi** trong kỳ **đang diễn ra**.
- Thông báo gửi trên phần mềm, không gửi email.
:::

## Yêu cầu đơn vị đánh giá lại

1. Ở kết quả **Đã gửi**, nhấn mũi tên cạnh **Xem chi tiết**, chọn **Yêu cầu đánh giá lại**.
2. Nhập **Lý do yêu cầu đánh giá lại**, nhấn **Gửi yêu cầu đánh giá lại**.

![Chọn Yêu cầu đánh giá lại](../out/img/lanhdaobo/dgl-menu.png){w=12}

![Nhập lý do và gửi](../out/img/lanhdaobo/dgl-hop-thoai.png){w=10}

:::warn Lưu ý
- Chỉ áp dụng cho kết quả **Đã gửi** trong kỳ **đang diễn ra**; lý do bắt buộc, tối đa 1.000 ký tự.
- Kết quả chuyển về **Bị từ chối**; đơn vị phải chỉnh sửa và gửi lại Bộ.
:::

## Xuất danh sách kết quả ra Excel

Nhấn **Xuất Excel** ở góc trên bên phải màn **Kết quả tự đánh giá** để tải danh sách theo bộ lọc hiện tại.

# BÁO CÁO THỐNG KÊ

Tổng hợp kết quả chính thức (bản gửi Bộ gần nhất) để xếp hạng và so sánh.

## Bảng xếp hạng

Đường dẫn truy cập: **Menu → Báo cáo thống kê → Bảng xếp hạng**

1. Chọn **Báo cáo thống kê → Bảng xếp hạng**.
2. Chọn **Bộ chỉ số** (ví dụ BCS.01).
3. Chọn **Hình thức** (ví dụ **Tất cả**).
4. Chọn **Tên kỳ đánh giá**.
5. Chọn **Xem số liệu** (bảng) hoặc **Xem dữ liệu cột** (biểu đồ).

![Bảng xếp hạng](../out/img/lanhdaobo/bc-xep-hang.png)

:::info Khi chưa có dữ liệu
Kỳ chưa có đơn vị nào gửi kết quả thì bảng trống và không xuất được.
:::

## So sánh đơn vị

Đường dẫn truy cập: **Menu → Báo cáo thống kê → So sánh đơn vị**

1. Chọn **Báo cáo thống kê → So sánh đơn vị**.
2. Chọn **So sánh chi tiết** hoặc **So sánh qua các kỳ**.
3. Trong dòng bộ lọc, chọn **Kỳ đánh giá** và **Chỉ tiêu so sánh** (ví dụ **Điểm xếp hạng**).
4. Nhấn **Thêm đơn vị**, tích chọn các đơn vị cần so sánh. Cần chọn ít nhất 2 đơn vị.
5. Nhấn **Xuất Excel** để tải kết quả.

![So sánh kết quả chuyển đổi số](../out/img/lanhdaobo/bc-so-sanh.png)

![Chọn đơn vị so sánh](../out/img/lanhdaobo/bc-so-sanh-them-dv.png){w=8}

:::warn Lưu ý
- Chọn **ít nhất 2 đơn vị** (so sánh qua các kỳ: từ 2 kỳ).
- Đơn vị chưa gửi kết quả không có số liệu so sánh.
:::

@include _chung-tai-khoan.md

# NHỮNG ĐIỀU CẦN GHI NHỚ

- Kiểm tra kỹ trước khi **Phê duyệt** kỳ: kỳ đã duyệt không sửa được.
- Khi từ chối, ghi rõ nội dung cần điều chỉnh.
- Thường xuyên xem tab **Chờ mở khóa** và chuông **Thông báo**.
- Kết quả chính thức của đơn vị là **bản gửi Bộ gần nhất**.
- Không thấy chức năng cần dùng: liên hệ Quản trị hệ thống để được cấp quyền.

# CÂU HỎI THƯỜNG GẶP (FAQ)

:::faq Tôi không thấy menu Phê duyệt/Từ chối ở kỳ?
Chỉ kỳ **Chờ phê duyệt** mới có thao tác này.
:::

:::faq Đã phê duyệt nhầm kỳ thì làm thế nào?
Kỳ đã duyệt không hủy hay sửa được. Liên hệ Quản trị hệ thống để được hỗ trợ.
:::

:::faq Vì sao tôi không sửa được điểm của đơn vị?
Bộ không sửa điểm. Dùng **Yêu cầu đánh giá lại** để đơn vị tự điều chỉnh.
:::

:::faq Kết quả nào là chính thức?
Bản gửi Bộ gần nhất, gắn nhãn *Bản chính thức* ở tab **Hồ sơ gửi Bộ**.
:::

:::faq Tôi không thấy nút Gửi nhắc nhở, Yêu cầu đánh giá lại, Xuất Excel?
Nhóm người dùng chưa được cấp quyền. Liên hệ Quản trị hệ thống.
:::

:::faq Tại sao không duyệt mở khóa được nữa?
Kỳ đã kết thúc hoặc yêu cầu đã được người khác xử lý.
:::

:::faq Bảng xếp hạng không có dữ liệu?
Kỳ chưa có đơn vị gửi kết quả, hoặc bộ lọc chưa đúng.
:::

-> **— HẾT —**

-> *Mọi vướng mắc trong quá trình sử dụng, vui lòng liên hệ Quản trị hệ thống hoặc Trung tâm Chuyển đổi số – Bộ Dân tộc và Tôn giáo để được hỗ trợ.*
