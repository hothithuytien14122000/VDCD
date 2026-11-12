---
key: canbo
title: HƯỚNG DẪN SỬ DỤNG
product: HỆ THỐNG ĐÁNH GIÁ CHUYỂN ĐỔI SỐ
subtitle: Đánh giá, phê duyệt và theo dõi kết quả chuyển đổi số
role: DÀNH CHO CÁN BỘ ĐỊA PHƯƠNG
org_top: Bộ Dân tộc và Tôn giáo
author: Hồ Thị Thủy Tiên
version: 2.0
date: 29/10/2026
org: Trung tâm Chuyển đổi số – Bộ Dân tộc và Tôn giáo
header: Hướng dẫn sử dụng Hệ thống đánh giá chuyển đổi số – Dành cho Cán bộ địa phương
logo: ../out/img/chung/logo.png
---
<!-- Vai trò Cán bộ địa phương (Sở/Ban/Ngành cấp tỉnh; sao chép từ can-bo.md, dùng chung ảnh canbo). Ảnh chụp bằng tools/capture-can-bo.mjs → ../out/img/canbo/{c,e}-*.png
     Phần chung: _chung-dang-nhap.md, _chung-tai-khoan.md (ảnh ../out/img/canbo/chung-*.png) -->
@history
V1.0 | 29/10/2026 | Ban hành lần đầu tài liệu hướng dẫn sử dụng Hệ thống đánh giá chuyển đổi số dành cho Cán bộ địa phương. | Hồ Thị Thủy Tiên
V1.3 | 29/10/2026 | Tách riêng các chức năng: Xem/Cập nhật thông tin cá nhân; Chấm điểm, Đính kèm minh chứng, Xóa minh chứng. | Hồ Thị Thủy Tiên
V1.4 | 30/10/2026 | Sửa mục Xem chi tiết kết quả tự đánh giá: các bước khớp với hình (BƯỚC 1–4), bổ sung bước Trình duyệt và Xuất Excel. | Hồ Thị Thủy Tiên
V1.5 | 30/10/2026 | Sửa mục Chấm điểm: các bước 1–5 khớp với hình (tìm chỉ số, điểm tự chấm, minh chứng, giải trình, Lưu nháp). | Hồ Thị Thủy Tiên
V1.6 | 30/10/2026 | Bổ sung hình minh họa cho mục Đính kèm minh chứng và giải trình (bước 3–5 trên màn chấm điểm). | Hồ Thị Thủy Tiên
V1.7 | 30/10/2026 | Sửa mục Đính kèm minh chứng và giải trình: các bước ghi rõ Bước 3–5 để khớp với hình. | Hồ Thị Thủy Tiên
V1.8 | 30/10/2026 | Mục Đính kèm minh chứng và giải trình: đánh số lại 1–3 và thay hình bằng ảnh có nhãn BƯỚC 1–3 đúng các bước. | Hồ Thị Thủy Tiên
V1.9 | 30/10/2026 | Bổ sung hình minh họa cho mục Khi cần sửa kết quả đã gửi Bộ (dòng thông báo có thể xin mở khóa). | Hồ Thị Thủy Tiên
V2.0 | 30/10/2026 | Bổ sung bảng các loại thông báo tự đánh giá Cán bộ nhận và thời điểm nhận. | Hồ Thị Thủy Tiên


# GIỚI THIỆU CHUNG

**Hệ thống đánh giá chuyển đổi số** giúp các đơn vị tự đánh giá theo Bộ chỉ số DTI và khảo sát mức độ hài lòng của người dân.

**Cán bộ địa phương** thực hiện nghiệp vụ của đơn vị:

- **Tự đánh giá**: chấm điểm, đính kèm minh chứng, **trình duyệt** Lãnh đạo đơn vị, **gửi kết quả về Bộ**.
- **Khảo sát hài lòng**: tạo và trình phê duyệt đợt khảo sát, nhập phiếu, xem và xuất kết quả.

| Bạn muốn | Xem tại chương |
|---|---|
| Đăng nhập, làm quen giao diện | Đăng nhập hệ thống; Làm quen với giao diện |
| Chấm điểm, trình duyệt, gửi kết quả về Bộ | Tự đánh giá chuyển đổi số |
| Tạo, trình phê duyệt đợt khảo sát | Quản lý đợt khảo sát |
| Nhập, sửa, xóa phiếu khảo sát | Quản lý phiếu khảo sát |
| Xem, xuất kết quả khảo sát | Xem kết quả khảo sát |
| Đổi mật khẩu, đăng xuất | Quản lý tài khoản cá nhân |

:::info Phạm vi dữ liệu
Cán bộ địa phương là cán bộ tại Sở/Ban/Ngành (cấp tỉnh); chỉ xem và thao tác trên dữ liệu của đơn vị mình.
:::

:::info Chuẩn bị trước khi dùng
- Trình duyệt Chrome, Edge hoặc Firefox bản mới; tài khoản Cán bộ do Quản trị hệ thống cấp.
- Tệp minh chứng (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG; tối đa 20 MB/tệp) và văn bản xác nhận đã ký số hoặc bản scan có chữ ký, dấu (PDF).
- Quyền xây dựng Bộ chỉ số, mở kỳ tự đánh giá: xem tài liệu *Dành cho Quản trị hệ thống*. Quyền theo dõi kết quả các đơn vị: xem tài liệu *Dành cho Lãnh đạo Bộ*.
:::

@include _chung-dang-nhap.md

# TỰ ĐÁNH GIÁ CHUYỂN ĐỔI SỐ

Chấm điểm kết quả tự đánh giá của đơn vị, trình Lãnh đạo đơn vị duyệt rồi gửi về Bộ.

Đường dẫn truy cập: **Menu → Đánh giá CĐS → Kết quả tự đánh giá**

| Trạng thái | Bước tiếp theo |
|---|---|
| Chưa thực hiện | **Lưu nháp** → *Đang chấm điểm* |
| Đang chấm điểm | **Trình duyệt** → *Chờ duyệt* |
| Chờ duyệt | Lãnh đạo **Phê duyệt** → *Đã phê duyệt*; **Từ chối** → *Bị từ chối* |
| Bị từ chối | Sửa, **Trình duyệt** lại |
| Đã phê duyệt | **Gửi Bộ** → *Đã gửi* |
| Đã gửi | Hồ sơ bị khóa |
| Chờ mở khóa | Chờ Bộ xem xét yêu cầu mở khóa |
| Chưa gửi | Kỳ đã kết thúc, không gửi bổ sung được |

:::warn Lưu ý
Kết quả bị khóa lúc **23:59 ngày kết thúc kỳ**; sau đó chỉ xem.
:::

## Xem danh sách kết quả tự đánh giá

1. Chọn **Đánh giá CĐS → Kết quả tự đánh giá**.
2. Chọn loại kỳ **Định kỳ** hoặc **Đột xuất**.
3. Nhấn tab trạng thái.
4. Tìm kiếm hoặc lọc theo **Trạng thái tiến trình**, **Kỳ đánh giá**.
5. Nhấn **Xuất Excel** để tải danh sách.

![Bước 1–5 – Danh sách kết quả tự đánh giá, tab trạng thái, tìm kiếm, lọc và xuất Excel](../out/img/canbo/c-ds.png)

Nhấn nút mũi tên cuối dòng để mở thao tác nhanh theo trạng thái (Bắt đầu chấm, Trình duyệt, Gửi Bộ, Xuất Excel).

![Bước 1 – Nhấn nút mũi tên; Bước 2 – Chọn thao tác (ví dụ Bắt đầu chấm)](../out/img/canbo/c-ds-menu.png){w=13}

## Xem chi tiết kết quả tự đánh giá

Ở danh sách kết quả, nhấn **Xem chi tiết** ở dòng cần xem.

1. Nhấn **Bắt đầu chấm** để chấm điểm (kết quả chưa chấm). Khi đã chấm xong, nhấn **Trình duyệt**.
2. Xem **Thông tin chung**: đơn vị thực hiện, phân loại, thời gian thực hiện, bộ chỉ số áp dụng.
3. Xem **Tiến độ chấm** và **Điểm tạm tính**.
4. Chọn các tab **Chấm điểm**, **Hồ sơ gửi Bộ**, **Lịch sử**. Ở tab **Chấm điểm**, nhấn **Xuất Excel** để tải danh sách chỉ số.

Nhấn nút mũi tên (←) góc trên bên trái để quay về danh sách.

![Màn chi tiết kết quả tự đánh giá – BƯỚC 1 đến BƯỚC 4 theo các bước trên](../out/img/canbo/c-ct-tong-quan.png)

## Chấm điểm

Nhấn **Bắt đầu chấm** (hoặc **Tiếp tục chấm**, **Chấm lại**) để mở bảng chấm.

1. Nếu cần, nhập mã hoặc tên chỉ số vào ô **Tìm mã hoặc tên chỉ số** để tìm nhanh.
2. Nhập điểm ở cột **Điểm tự chấm**.
3. Nếu cần, đính kèm minh chứng ở cột **Minh chứng** (xem mục bên dưới).
4. Nếu cần, nhập giải trình ở cột **Giải trình**.
5. Nhấn **Lưu nháp**.
   ! Nhấn **Hủy chỉnh sửa** sẽ **không lưu** thay đổi.

![Bước 1–4 – Tìm chỉ số, nhập điểm tự chấm, minh chứng và giải trình](../out/img/canbo/c-cham-bang.png)

![Bước 5 – Nhấn Lưu nháp; thẻ Điểm tạm tính tự cập nhật](../out/img/canbo/c-cham-dau-trang.png)

:::warn Lưu ý
- Điểm không vượt quá **điểm tối đa** của chỉ số.
- Chỉ số cha không nhập điểm trực tiếp (bằng tổng các chỉ số con).
- Điểm chỉ được lưu khi nhấn **Lưu nháp**.
- Chỉ chấm được khi *Chưa thực hiện*, *Đang chấm điểm*, *Bị từ chối* và kỳ chưa kết thúc.
:::

## Đính kèm minh chứng và giải trình

Trong màn chấm điểm (đã nhấn **Bắt đầu chấm**):

1. Nhấn **Tải file** ở cột **Minh chứng** của chỉ số, chọn tệp.
2. Nhập **Giải trình** (nếu có).
3. Nhấn **Lưu nháp**.

![Đính kèm minh chứng, nhập giải trình và Lưu nháp](../out/img/canbo/c-dinh-kem.png)

:::warn Lưu ý
- Minh chứng tối đa **20 MB/tệp**; giải trình tối đa **255 ký tự**.
- Tệp chỉ được lưu khi nhấn **Lưu nháp**.
:::

## Xóa minh chứng

1. Nhấn biểu tượng thùng rác cạnh tên tệp.
2. Nhấn **Lưu nháp**.

![Bước 1 – Xóa tệp minh chứng](../out/img/canbo/c-minh-chung-xoa.png)

## Trình duyệt kết quả tự đánh giá

1. Mở chi tiết kết quả.
2. Nhấn **Trình duyệt**.
3. Nhấn **Xác nhận trình duyệt**.

![Bước 2 – Nhấn Trình duyệt](../out/img/canbo/c-trinh-nut.png)

![Bước 3 – Nhấn Xác nhận trình duyệt](../out/img/canbo/c-trinh-xac-nhan.png){w=9}

Kết quả chuyển sang **Chờ duyệt**. Nếu còn chỉ số chưa chấm, hệ thống báo thiếu: nhấn **Quay lại bổ sung**.

![Hộp thoại Chưa đủ điều kiện trình duyệt](../out/img/canbo/c-trinh-thieu.png){w=9}

## Xử lý kết quả bị từ chối

1. Mở chi tiết, xem **lý do từ chối** ở dải thông báo đỏ.
2. Nhấn **Chấm lại**, sửa theo yêu cầu, **Lưu nháp**.
3. Nhấn **Trình duyệt** để trình lại.

![Bước 1 – Lý do từ chối; Bước 3 – Trình duyệt lại](../out/img/canbo/c-bi-tu-choi.png)

## Gửi kết quả về Bộ

1. Mở kết quả **Đã phê duyệt**, chọn tab **Hồ sơ gửi Bộ**.
2. Kiểm tra **Điều kiện gửi kết quả về Bộ**.
3. Tải lên **Văn bản xác nhận** (ký số hoặc bản scan).
4. Chọn **Hình thức văn bản**, nhập **Số hiệu văn bản**, **Ngày ký ban hành**.
5. Nhấn **Gửi kết quả về Bộ**.
6. Nhấn **Xác nhận gửi Bộ**.

![Bước 1 – Kết quả đã được phê duyệt, nút Gửi Bộ](../out/img/canbo/c-gui-bo-nut.png)

![Bước 2–5 – Kiểm tra điều kiện, đính kèm văn bản xác nhận, nhập thông tin và nhấn Gửi kết quả về Bộ](../out/img/canbo/c-gui-bo-form.png)

![Bước 6 – Nhấn Xác nhận gửi Bộ](../out/img/canbo/c-gui-bo-dlg.png){w=9}

Sau khi gửi, kết quả chuyển sang **Đã gửi** và chỉ xem.

![Hồ sơ gửi Bộ của kết quả đã gửi (chỉ xem)](../out/img/canbo/c-ho-so-da-gui.png)

:::warn Lưu ý
- **Văn bản xác nhận là bắt buộc** (PDF ký số hoặc bản scan có chữ ký, dấu); mỗi lần gửi lại cần văn bản mới.
- Không gửi được khi **quá hạn nộp**.
:::

## Khi cần sửa kết quả đã gửi Bộ

Cán bộ không sửa được kết quả **Đã gửi** và **không có quyền xin mở khóa**.

1. Báo **Lãnh đạo đơn vị** xin mở khóa (khi kỳ chưa kết thúc).
2. Bộ duyệt: kết quả về **Đang chấm điểm**, chỉnh sửa và gửi lại.
3. Bộ yêu cầu đánh giá lại: xử lý như *Xử lý kết quả bị từ chối*.

![Bước 1 – Dòng thông báo Đã gửi Bộ: đơn vị có thể nhấn Xin mở khóa khi kỳ chưa kết thúc](../out/img/canbo/c-da-gui.png)

## Xem lịch sử xử lý

1. Mở chi tiết kết quả.
2. Chọn tab **Lịch sử** để xem các thao tác theo thời gian.

![Lịch sử thao tác và phê duyệt](../out/img/canbo/c-lich-su.png)

## Thông báo liên quan đến tự đánh giá

Nhấn biểu tượng chuông để xem thông báo; nhấn thông báo để mở kết quả liên quan.

| Thông báo | Nội dung | Khi nào |
|---|---|---|
| Yêu cầu tự đánh giá | Đơn vị được phân công thực hiện kỳ mới, có hạn hoàn thành | Khi kỳ được phân công cho đơn vị |
| Sắp đến hạn | Kỳ còn ít ngày hoặc đã hết hạn mà đơn vị chưa gửi kết quả | Trước hạn và khi hết hạn |
| Kỳ tự đánh giá đã được phê duyệt | Kỳ đã được Bộ phê duyệt | Khi Bộ duyệt kỳ |
| Kết quả đã được phê duyệt | Kết quả đã được duyệt, vui lòng gửi kết quả về Bộ | Khi Lãnh đạo đơn vị duyệt kết quả |
| Kết quả bị từ chối | Kết quả bị từ chối, kèm lý do | Khi Lãnh đạo đơn vị từ chối |
| Đã mở khóa kết quả | Kết quả đã được mở khóa để sửa | Khi kết quả được mở khóa |

![Danh sách thông báo](../out/img/canbo/chung-thong-bao.png){w=9}

# QUẢN LÝ ĐỢT KHẢO SÁT

Tạo đợt khảo sát mức độ hài lòng của người dân và trình Lãnh đạo đơn vị phê duyệt.

Đường dẫn truy cập: **Menu → Khảo sát hài lòng → Đợt khảo sát**

| Trạng thái | Bước tiếp theo |
|---|---|
| Nháp | **Trình phê duyệt** → *Chờ phê duyệt* |
| Chờ phê duyệt | Lãnh đạo **Phê duyệt** hoặc **Từ chối** |
| Bị từ chối | Sửa, trình phê duyệt lại |
| Đã phê duyệt | Đến ngày bắt đầu tự chuyển *Đang diễn ra* |
| Đang diễn ra | Hết ngày kết thúc tự chuyển *Đã kết thúc* |
| Đã kết thúc | Kết quả chính thức |

## Xem danh sách đợt khảo sát

1. Chọn **Khảo sát hài lòng → Đợt khảo sát**.
2. Nhập từ khóa tìm kiếm.
3. Chọn **hình thức**, **năm** để lọc.
4. Nhấn **Xuất Excel** để tải danh sách.

![Bước 1–4 – Tab trạng thái, tìm kiếm, lọc và xuất Excel](../out/img/canbo/e-ds.png)

Nhấn nút mũi tên cuối dòng để **Sửa đợt khảo sát**, **Trình phê duyệt**, **Xóa đợt khảo sát** (đợt Nháp/Bị từ chối).

![Bước 1 – Nhấn nút mũi tên; Bước 2 – Menu thao tác của đợt Nháp](../out/img/canbo/e-ds-menu.png){w=13}

## Tạo đợt khảo sát

Nhấn **Tạo đợt khảo sát** tại màn **Đợt khảo sát**.

![Mở menu Đợt khảo sát, nhấn Tạo đợt khảo sát](../out/img/canbo/e-ds-canbo.png){w=13}

1. Nhập **Tên đợt khảo sát**.
2. Nhập **Mô tả, mục đích**.
3. Chọn **Ngày bắt đầu** và **Ngày kết thúc**.
4. Nhập **Số phiếu mục tiêu**.
5. Nhập tên **Nhóm 1**.
6. Nhấn **Thêm câu hỏi** và nhập nội dung câu hỏi.
7. Nhấn **Thêm nhóm câu hỏi** nếu cần.
8. Tích chọn **Hình thức khảo sát**: **Trực tuyến**, **Trực tiếp**, **Gián tiếp qua phiếu**.
9. Nhấn **Lưu nháp**.
10. Hoặc nhấn **Lưu và trình phê duyệt**.

![Bước 1–4, 8 – Nhập thông tin chung và chọn hình thức khảo sát](../out/img/canbo/e-tao-thong-tin.png)

![Bước 5–7 – Nhập nhóm câu hỏi và câu hỏi](../out/img/canbo/e-tao-noi-dung.png){w=12}

![Bước 9–10 – Lưu nháp hoặc Lưu và trình phê duyệt](../out/img/canbo/e-tao-luu.png)

Nếu bỏ trống trường bắt buộc, hệ thống báo lỗi dưới ô tương ứng.

![Thông báo lỗi khi chưa nhập tên đợt khảo sát](../out/img/canbo/e-tao-loi.png){w=10}

:::warn Lưu ý
- **Tên đợt** tối đa 255 ký tự; **Mô tả** tối đa 1.000 ký tự; **Số phiếu mục tiêu** là số nguyên dương.
- **Ngày bắt đầu** từ hôm nay; **Ngày kết thúc** không trước ngày bắt đầu.
- Chọn ít nhất một hình thức; mỗi nhóm có tên và ít nhất một câu hỏi.
:::

## Xem chi tiết đợt khảo sát

1. Nhấn **Xem chi tiết** ở dòng đợt khảo sát.
2. Xem các tab **Thông tin**, **Phiếu**, **Kết quả**.
3. Ở mục **Hình thức thực hiện**: **Sao chép** đường dẫn, **Tải mã QR** (trực tuyến); **Tải mẫu phiếu (.doc)**, **Nhập phiếu** (trực tiếp, gián tiếp).

![Bước 3 – Tab Thông tin của đợt khảo sát đang diễn ra](../out/img/canbo/e-ct-thong-tin.png)

![Hình thức thực hiện: sao chép đường dẫn, mã QR, tải mẫu phiếu, nhập phiếu](../out/img/canbo/e-ct-hinh-thuc.png)

![Lịch sử xử lý đợt khảo sát](../out/img/canbo/e-ct-lich-su.png){w=7}

Đợt **Nháp** hoặc **Bị từ chối** có thêm nút **Xoá**, **Sửa**, **Trình phê duyệt**; đợt bị từ chối hiển thị lý do.

![Chi tiết đợt khảo sát Nháp: các nút Xoá, Sửa, Trình phê duyệt](../out/img/canbo/e-ct-nhap.png)

![Đợt khảo sát bị từ chối và lý do từ chối](../out/img/canbo/e-ct-tu-choi.png)

## Sửa đợt khảo sát

1. Mở chi tiết đợt **Nháp** hoặc **Bị từ chối**, nhấn **Sửa**.
2. Cập nhật thông tin cần thiết.
3. Nhấn **Lưu nháp** hoặc **Lưu và trình phê duyệt**.

![Bước 2–3 – Cập nhật thông tin rồi nhấn Lưu nháp hoặc Lưu và trình phê duyệt](../out/img/canbo/e-sua.png)

:::warn Lưu ý
- Đợt **Chờ phê duyệt** bị khóa chỉnh sửa.
- **Mã đợt** không sửa được.
:::

## Trình phê duyệt đợt khảo sát

1. Mở chi tiết đợt **Nháp** hoặc **Bị từ chối**, nhấn **Trình phê duyệt**.
2. Nhấn **Có** để xác nhận.

![Bước 2 – Nhấn Có để trình phê duyệt](../out/img/canbo/e-trinh-dlg.png){w=8}

:::warn Lưu ý
Đợt phải được duyệt **trước ngày kết thúc**, nếu không hệ thống tự chuyển sang **Bị từ chối**.
:::

## Xóa đợt khảo sát

1. Mở chi tiết đợt **Nháp** hoặc **Bị từ chối**, nhấn **Xoá**.
2. Nhấn **Có** để xóa.

![Bước 2 – Nhấn Có để xóa đợt khảo sát](../out/img/canbo/e-xoa-dlg.png){w=8}

:::warn Lưu ý
Đợt bị xóa cùng toàn bộ câu hỏi, **không thể hoàn tác**.
:::

## Xử lý tự động của hệ thống

| Thời điểm | Hệ thống tự động |
|---|---|
| Đầu ngày bắt đầu | Đợt đã phê duyệt chuyển **Đang diễn ra** |
| Sau 23:59 ngày kết thúc | Đợt *Chờ phê duyệt* chuyển **Bị từ chối**; đợt *Đang diễn ra* chuyển **Đã kết thúc**, khóa thêm, sửa, xóa phiếu |

# QUẢN LÝ PHIẾU KHẢO SÁT

Phiếu **Trực tuyến** do người dân gửi; phiếu **Trực tiếp** và **Gián tiếp qua phiếu** do Cán bộ nhập.

Đường dẫn truy cập: **Menu → Khảo sát hài lòng → Đợt khảo sát → Xem chi tiết → tab Phiếu**

## Xem danh sách phiếu

1. Mở chi tiết đợt khảo sát, chọn tab **Phiếu**.
2. Lọc theo khoảng ngày hoặc hình thức.
3. Nhấn **Xem chi tiết** ở dòng phiếu.

![Bước 1–3 – Tab Phiếu, thẻ tổng hợp, bộ lọc và danh sách phiếu](../out/img/canbo/e-ph-ds.png)

## Xem chi tiết phiếu

Xem câu trả lời, góp ý và thông tin phiếu. Nhấn **Sửa** hoặc **Đóng**.

![Xem chi tiết phiếu khảo sát](../out/img/canbo/e-ph-chi-tiet.png)

## Tải mẫu phiếu

1. Mở chi tiết đợt, tab **Thông tin**, mục **Hình thức thực hiện**.
2. Nhấn **Tải mẫu phiếu (.doc)**.

Xem hình *Hình thức thực hiện* ở mục **Xem chi tiết đợt khảo sát**.

## Nhập phiếu khảo sát

1. Nhấn **Nhập phiếu** (tab **Phiếu** hoặc mục **Hình thức thực hiện**).
2. Nhấn **Chọn tất cả Hài lòng** (nếu cần).
3. Chọn **Hài lòng** hoặc **Chưa hài lòng** cho từng câu.
4. Nhập **Góp ý của người dân** (không bắt buộc).
5. Chọn **Hình thức**.
6. Nhấn **Lưu phiếu** hoặc **Lưu và nhập tiếp**.

![Bước 2–6 – Chọn câu trả lời, nhập góp ý, chọn hình thức rồi lưu phiếu](../out/img/canbo/e-ph-nhap.png)

:::warn Lưu ý
- Chỉ nhập được khi đợt **Đang diễn ra** và có hình thức *Trực tiếp* hoặc *Gián tiếp qua phiếu*.
- Phải trả lời **đủ tất cả** câu hỏi; góp ý tối đa 1.000 ký tự.
:::

## Sửa phiếu khảo sát

1. Tại tab **Phiếu**, nhấn nút mũi tên cuối dòng.
2. Chọn **Sửa phiếu**.
3. Cập nhật câu trả lời, góp ý, hình thức.
4. Nhấn **Lưu thay đổi**.

![Bước 1–2 – Mở menu thao tác của phiếu](../out/img/canbo/e-ph-menu.png){w=12}

![Bước 3–4 – Sửa câu trả lời rồi nhấn Lưu thay đổi](../out/img/canbo/e-ph-sua.png)

:::warn Lưu ý
Chỉ sửa được phiếu nhập tại hệ thống khi đợt chưa kết thúc; phiếu Trực tuyến không sửa, xóa được.
:::

## Xóa phiếu khảo sát

1. Tại tab **Phiếu**, nhấn nút mũi tên cuối dòng, chọn **Xóa phiếu**.
2. Nhấn **Có** để xóa.

![Bước 2 – Xác nhận xóa phiếu](../out/img/canbo/e-ph-xoa-dlg.png){w=8}

:::warn Lưu ý
Thao tác **không thể hoàn tác**; không xóa được phiếu sau khi đợt đã kết thúc.
:::

# XEM KẾT QUẢ KHẢO SÁT

Xem và xuất kết quả tổng hợp của đợt đang diễn ra hoặc đã kết thúc.

Đường dẫn truy cập: **Menu → Khảo sát hài lòng → Đợt khảo sát → Xem chi tiết → tab Kết quả**

1. Chọn tab **Đang diễn ra** hoặc **Đã kết thúc**, nhấn **Xem chi tiết**.
2. Chọn tab **Kết quả** (nhãn **Tạm tính** hoặc **Chính thức**).
3. Xem tổng hợp theo câu hỏi và hình thức.
4. Nhấn **Xuất Excel** để tải kết quả.

![Bước 2–4 – Kết quả khảo sát của một đợt đang diễn ra](../out/img/ldd/ks-ket-qua.png){w=14}

:::info Thông tin
- **Tỷ lệ hài lòng** = Lượt Hài lòng ÷ Tổng lượt đánh giá × 100%.
- Đợt chưa đến ngày bắt đầu hoặc chưa có phiếu thì chưa có kết quả để xuất.
:::

@include _chung-tai-khoan.md

# NHỮNG ĐIỀU CẦN GHI NHỚ

- **Lưu nháp thường xuyên** khi chấm điểm; điểm, minh chứng chưa lưu sẽ mất.
- Chỉ **trình duyệt** khi đã chấm **tất cả** chỉ số tính điểm.
- Chỉ **gửi Bộ** kết quả **Đã phê duyệt**, kèm văn bản xác nhận, trước hạn nộp.
- Kết quả bị khóa lúc **23:59 ngày kết thúc kỳ**.
- Đợt khảo sát chỉ sửa, xóa khi **Nháp** hoặc **Bị từ chối**; phải được duyệt trước ngày kết thúc.
- Chỉ nhập, sửa, xóa phiếu khi đợt **Đang diễn ra**.
- Theo dõi **thông báo** (biểu tượng chuông).

# CÂU HỎI THƯỜNG GẶP (FAQ)

:::faq Không thấy nút Bắt đầu chấm / Lưu nháp?
Kết quả đang *Chờ duyệt*, *Đã phê duyệt*, *Đã gửi*, *Chờ mở khóa* hoặc kỳ đã kết thúc. Chỉ chấm được khi *Chưa thực hiện*, *Đang chấm điểm*, *Bị từ chối*.
:::

:::faq Báo "Chưa đủ điều kiện trình duyệt"?
Còn chỉ số chưa nhập điểm. Nhấn **Quay lại bổ sung**, nhập điểm, **Lưu nháp** rồi trình lại.
:::

:::faq Tệp minh chứng đã tải lên bị mất?
Tệp chỉ được gắn khi nhấn **Lưu nháp** hoặc **Trình duyệt**. Hãy tải lại tệp rồi **Lưu nháp**.
:::

:::faq Kết quả bị từ chối thì làm gì?
Xem lý do ở dải thông báo đỏ, nhấn **Chấm lại**, sửa, **Lưu nháp** rồi **Trình duyệt** lại.
:::

:::faq Đã gửi Bộ nhưng phát hiện sai sót?
Báo Lãnh đạo đơn vị **Xin mở khóa** (Cán bộ không có quyền này). Khi Bộ duyệt, sửa và gửi lại kèm văn bản xác nhận mới.
:::

:::faq Vì sao không thấy nút Gửi Bộ?
Kết quả chưa được phê duyệt, đã gửi hoặc quá hạn nộp. Kiểm tra mục **Điều kiện gửi kết quả về Bộ** ở tab **Hồ sơ gửi Bộ**.
:::

:::faq Không sửa / xóa được đợt khảo sát?
Chỉ sửa, xóa được đợt *Nháp* hoặc *Bị từ chối*.
:::

:::faq Đợt khảo sát tự chuyển sang Bị từ chối?
Đợt chưa được duyệt trước khi hết ngày kết thúc nên hệ thống tự hủy. Sửa thời gian rồi trình phê duyệt lại.
:::

:::faq Người dân khảo sát trực tuyến bằng cách nào?
Phổ biến đường dẫn hoặc mã QR ở mục **Hình thức thực hiện**. Người dân không cần tài khoản.
:::

-> **— HẾT —**

-> *Mọi vướng mắc trong quá trình sử dụng, vui lòng liên hệ Quản trị hệ thống hoặc Trung tâm Chuyển đổi số – Bộ Dân tộc và Tôn giáo để được hỗ trợ.*
