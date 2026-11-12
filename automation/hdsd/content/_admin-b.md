<!-- Vai trò Quản trị hệ thống – Phần B: nhóm menu "Bộ chỉ số DTI" (Trụ cột, Nhóm chỉ số, Chỉ số, Bộ chỉ số,
     Thang xếp loại, Quản lý tự đánh giá). Ảnh chụp bằng tools/capture-admin-b.mjs → ../out/img/admin/b-*.png -->
# XÂY DỰNG CẤU TRÚC BỘ CHỈ SỐ

Bộ chỉ số DTI có cấu trúc nhiều tầng, khai báo lần lượt từ trên xuống dưới:

| Tầng | Ý nghĩa |
|---|---|
| Trụ cột | Lĩnh vực lớn của chuyển đổi số |
| Nhóm chỉ số | Nhóm nội dung trong một trụ cột |
| Chỉ số | Tiêu chí được chấm điểm (có thể có chỉ số con) |
| Bộ chỉ số | Tập các nhóm chỉ số áp dụng cho một năm |

| Trạng thái | Được phép |
|---|---|
| **Chưa khóa** | Cập nhật, Xoá, Khoá |
| **Đã khóa** | Mở khoá, Nhân bản (chỉ số, bộ chỉ số); được chọn ở tầng dưới |

:::info Thứ tự khai báo
**Trụ cột → Nhóm chỉ số → Chỉ số → Bộ chỉ số → Kỳ tự đánh giá.** Khóa từng danh mục trước khi dùng ở tầng dưới.
:::

## Quản lý trụ cột

Đường dẫn truy cập: **Menu → Bộ chỉ số DTI → Trụ cột**

### Xem, tìm kiếm danh sách trụ cột

1. Chọn **Bộ chỉ số DTI → Trụ cột**.
2. Nhập mã/tên vào ô tìm kiếm hoặc lọc theo trạng thái.

![Bước 1 – Chọn Bộ chỉ số DTI → Trụ cột](../out/img/admin/b-pil-menu-chon.png){w=10}

![Bước 2 – Danh sách trụ cột, tìm kiếm và lọc theo trạng thái](../out/img/admin/b-pil-ds.png){w=11.4}

### Thêm mới trụ cột

1. Nhấn **Thêm mới trụ cột**.
2. Nhập **Mã trụ cột**, **Tên trụ cột**.
3. Nhấn **Thêm mới Trụ cột**.

![Bước 1 – Nhấn Thêm mới trụ cột](../out/img/admin/b-pil-them-nut.png)

![Bước 2–3 – Nhập mã, tên rồi nhấn Thêm mới Trụ cột](../out/img/admin/b-pil-them.png){w=10}

![Thông báo lỗi khi bỏ trống trường bắt buộc](../out/img/admin/b-pil-them-loi.png){w=10}

:::warn Lưu ý
- **Mã** và **Tên** bắt buộc. Mã tối đa 50 ký tự (A–Z, 0–9, - _ .), không trùng. Tên tối đa 255 ký tự, không trùng.
- Chỉ trụ cột **Đã khóa** mới được chọn khi tạo nhóm chỉ số.
:::

### Cập nhật trụ cột

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Sửa **Tên trụ cột**.
4. Nhấn **Lưu**.

![Bước 1–2 – Menu thao tác của trụ cột chưa khóa](../out/img/admin/b-pil-menu.png)

![Bước 3–4 – Sửa tên rồi nhấn Lưu](../out/img/admin/b-pil-sua.png){w=7.4}

:::warn Lưu ý
Trụ cột **Đã khóa** không sửa được; cần **Mở khoá** trước.
:::

### Khóa, mở khóa trụ cột

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Khoá** (hoặc **Mở khoá** với trụ cột đã khóa).
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận khóa trụ cột](../out/img/admin/b-pil-khoa.png){w=6.9}

### Xóa trụ cột

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa trụ cột](../out/img/admin/b-pil-xoa.png){w=7}

:::warn Lưu ý
- Trụ cột **Đã khóa** không xóa được; cần **Mở khoá** trước.
- Không xóa được trụ cột đang có nhóm chỉ số.
:::

### Xem chi tiết trụ cột

Nhấn **Xem chi tiết** để xem thông tin và các nhóm chỉ số thuộc trụ cột; có thể **Xuất Excel**.

![Chi tiết trụ cột đã khóa](../out/img/admin/b-pil-chi-tiet.png){w=13}

## Quản lý nhóm chỉ số

Đường dẫn truy cập: **Menu → Bộ chỉ số DTI → Nhóm chỉ số**

### Xem danh sách nhóm chỉ số

1. Chọn **Bộ chỉ số DTI → Nhóm chỉ số**.
2. Tìm kiếm hoặc lọc theo **Tất cả trụ cột**.

![Bước 1 – Chọn Bộ chỉ số DTI → Nhóm chỉ số](../out/img/admin/b-grp-menu-chon.png){w=10}

![Bước 2 – Danh sách nhóm chỉ số, tìm kiếm và lọc theo trụ cột](../out/img/admin/b-grp-ds.png){w=11.4}

### Thêm mới nhóm chỉ số

1. Nhấn **Thêm mới nhóm chỉ số**.
2. Chọn **Trụ cột** (chỉ gồm trụ cột đã khóa).
3. Nhập **Mã nhóm chỉ số**, **Tên nhóm chỉ số**.
4. Nhấn **Thêm mới Nhóm chỉ số**.

![Bước 1 – Nhấn Thêm mới nhóm chỉ số](../out/img/admin/b-grp-them-nut.png)

![Bước 2–4 – Chọn trụ cột, nhập mã, tên rồi nhấn Thêm mới Nhóm chỉ số](../out/img/admin/b-grp-them.png){w=9}

:::warn Lưu ý
Mã tối đa 50 ký tự (A–Z, 0–9, - _ .), không trùng. Tên tối đa 500 ký tự, không trùng trong cùng trụ cột.
:::

### Cập nhật nhóm chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Sửa thông tin.
4. Nhấn **Lưu**.

![Bước 3–4 – Sửa thông tin rồi nhấn Lưu](../out/img/admin/b-grp-sua.png){w=9}

### Khóa, mở khóa nhóm chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Khoá** (hoặc **Mở khoá** với nhóm đã khóa).
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Nhóm chưa khóa: mở menu thao tác, chọn Khoá](../out/img/admin/b-grp-khoa-menu.png){w=10.4}

![Bước 3 – Xác nhận khóa](../out/img/admin/b-grp-khoa-xn.png){w=10}

![Bước 1–2 – Nhóm đã khóa: mở menu thao tác, chọn Mở khoá](../out/img/admin/b-grp-mo-khoa-menu.png){w=10.4}

![Bước 3 – Xác nhận mở khóa](../out/img/admin/b-grp-mo-khoa-xn.png){w=10}

:::info Lưu ý
Chỉ nhóm **Đã khóa** mới được dùng để tạo chỉ số và đưa vào bộ chỉ số.
:::

### Xóa nhóm chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Mở menu thao tác, chọn Xoá](../out/img/admin/b-grp-xoa-menu.png){w=10.4}

![Bước 3 – Xác nhận xóa](../out/img/admin/b-grp-xoa-xn.png){w=10}

:::warn Lưu ý
Nhóm đã khóa hoặc đang có chỉ số không xóa được.
:::

### Xem chi tiết nhóm chỉ số

Nhấn **Xem chi tiết** để xem thông tin và các chỉ số thuộc nhóm.

![Chi tiết nhóm chỉ số](../out/img/admin/b-grp-chi-tiet.png)

### Thêm chỉ số vào nhóm

Chuyển các chỉ số đã có (kèm chỉ số con) từ nhóm khác sang nhóm đang xem.

1. Mở **Xem chi tiết** nhóm chỉ số, nhấn **Thêm chỉ số**.
2. Nhập tên hoặc mã vào ô tìm kiếm để tìm chỉ số (nếu cần).
3. Tích chọn các chỉ số cần thêm.
4. Nhấn **Lưu**.

![Bước 1 – Tại màn chi tiết nhóm chỉ số, nhấn Thêm chỉ số](../out/img/admin/b-grp-them-cs-nut.png)

![Bước 2–4 – Tìm, tích chọn chỉ số rồi nhấn Lưu](../out/img/admin/b-grp-them-cs-chon.png){w=12}

:::warn Lưu ý
- Chỉ số được chọn sẽ **rời nhóm hiện tại** (cột **Nhóm hiện tại**) và chuyển sang nhóm này, kèm theo toàn bộ chỉ số con.
- Muốn tạo chỉ số hoàn toàn mới, dùng **Thêm mới chỉ số** tại màn **Chỉ số**.
:::

## Quản lý chỉ số

Đường dẫn truy cập: **Menu → Bộ chỉ số DTI → Chỉ số**

### Xem danh sách chỉ số (dạng bảng và dạng cây)

1. Chọn **Bộ chỉ số DTI → Chỉ số**.
2. Tìm kiếm hoặc lọc theo nhóm chỉ số, trạng thái.
3. Nhấn **Xem dạng cây** để xem theo cấu trúc phân cấp.

![Bước 1 – Chọn Bộ chỉ số DTI → Chỉ số](../out/img/admin/b-ind-menu-chon.png){w=10}

![Bước 2–3 – Danh sách chỉ số, tìm kiếm, lọc, Xem dạng cây](../out/img/admin/b-ind-ds.png){w=11.4}

![Bước 3 – Xem chỉ số dạng cây](../out/img/admin/b-ind-cay.png)

### Thêm mới chỉ số

1. Nhấn **Thêm mới chỉ số**.
2. Chọn **Trụ cột**, **Nhóm chỉ số** (và **Chỉ số cha** nếu là chỉ số con).
3. Nhập **Mã chỉ số**, **Tên chỉ số**, **Mô tả**.
4. Nhập **Điểm tối thiểu**, **Điểm tối đa**.
5. Nhấn **Thêm mới Chỉ số**.

![Bước 1 – Nhấn Thêm mới chỉ số](../out/img/admin/b-ind-them-nut.png)

![Bước 2–5 – Nhập thông tin chỉ số rồi nhấn Thêm mới Chỉ số](../out/img/admin/b-ind-them.png){w=10}

:::warn Lưu ý
- Mã tối đa 50 ký tự (A–Z, 0–9, - _ .), không trùng. Tên tối đa 500 ký tự, không trùng trong cùng nhóm. Mô tả tối đa 1.000 ký tự.
- Điểm trong khoảng **0 – 1000**, **Điểm tối thiểu ≤ Điểm tối đa**.
- Điểm chỉ số cha bằng tổng điểm các chỉ số con.
:::

### Thêm chỉ số con

Gắn các chỉ số đã có vào một chỉ số khác để làm chỉ số con.

1. Mở **Xem chi tiết** chỉ số cha, nhấn **Thêm chỉ số con**.
2. Tích chọn các chỉ số cần đưa vào làm chỉ số con.
3. Nhấn **Lưu**.

![Bước 1 – Tại màn chi tiết chỉ số, nhấn Thêm chỉ số con](../out/img/admin/b-ind-con-nut.png)

![Bước 2–3 – Tích chọn chỉ số rồi nhấn Lưu](../out/img/admin/b-ind-con-chon.png){w=12}

:::warn Lưu ý
- Danh sách chỉ gồm các chỉ số **cùng nhóm chỉ số** và **chưa thuộc chỉ số cha nào**. Nếu danh sách trống, hãy tạo chỉ số mới trong nhóm trước.
- Có thể chọn **Chỉ số cha** ngay khi **Thêm mới chỉ số** thay cho cách này.
- Sau khi gắn, điểm chỉ số cha bằng tổng điểm các chỉ số con.
:::

### Cập nhật chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Chọn **Chỉ số cha** (nếu cần; không sửa được mã).
4. Sửa **Điểm tối thiểu**, **Điểm tối đa**.
5. Nhấn **Lưu**.

![Bước 1–2 – Menu thao tác chỉ số chưa khóa](../out/img/admin/b-ind-menu.png)

![Bước 3–5 – Cập nhật chỉ số rồi nhấn Lưu](../out/img/admin/b-ind-sua.png){w=10}

:::warn Lưu ý
Chỉ số đã khóa không sửa được; cần mở khóa trước.
:::

### Khóa, mở khóa chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Khoá** (hoặc **Mở khoá** với chỉ số đã khóa).
3. Nhấn **Có** để xác nhận.

Có thể khóa ngay tại màn **Xem chi tiết** chỉ số chưa khóa bằng nút **Khóa chỉ số**.

![Nút Khóa chỉ số tại màn chi tiết chỉ số chưa khóa](../out/img/admin/b-ind-chi-tiet-chua-khoa.png)

:::warn Lưu ý
Nút **Khóa chỉ số** khóa ngay, **không hỏi xác nhận**.
:::

### Nhân bản chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết** của chỉ số **Đã khóa**.
2. Chọn **Nhân bản**.
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Menu thao tác chỉ số đã khóa](../out/img/admin/b-ind-menu-khoa.png)

![Bước 3 – Xác nhận nhân bản](../out/img/admin/b-ind-nhan-ban-xn.png){w=7}

![Kết quả – bản sao chỉ số ở trạng thái Chưa khóa](../out/img/admin/b-ind-nhan-ban-kq.png)

:::info Lưu ý
Bản sao có mã hậu tố **_COPY**, trạng thái **Chưa khóa**.
:::

### Xóa chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Mở menu thao tác, chọn Xoá](../out/img/admin/b-ind-xoa-menu.png){w=10.4}

![Bước 3 – Xác nhận xóa](../out/img/admin/b-ind-xoa-xn.png){w=10}

:::warn Lưu ý
- Chỉ số đã khóa không xóa được; cần mở khóa trước.
- Không xóa được chỉ số đang có chỉ số con hoặc đang dùng trong bộ chỉ số.
:::

### Xem chi tiết chỉ số

Nhấn **Xem chi tiết** để xem thông tin, chỉ số con và các bộ chỉ số đang dùng chỉ số này.

![Chi tiết chỉ số cha đã khóa](../out/img/admin/b-ind-chi-tiet.png)

# QUẢN LÝ BỘ CHỈ SỐ

Bộ chỉ số là tập nhóm chỉ số kèm cấu hình điểm, áp dụng cho một năm.

Đường dẫn truy cập: **Menu → Bộ chỉ số DTI → Bộ chỉ số**

## Xem danh sách bộ chỉ số

1. Chọn **Bộ chỉ số DTI → Bộ chỉ số**.
2. Tìm kiếm hoặc lọc theo trạng thái.

![Bước 1 – Chọn Bộ chỉ số DTI → Bộ chỉ số](../out/img/admin/b-set-menu-chon.png){w=10}

![Bước 2 – Danh sách bộ chỉ số, tìm kiếm và lọc theo trạng thái](../out/img/admin/b-set-ds.png){w=11.4}

## Thêm mới bộ chỉ số

1. Nhấn **Thêm mới bộ chỉ số**.
2. Nhập **Mã bộ chỉ số**, **Tên bộ chỉ số**.
3. Chọn **Năm áp dụng**, nhập **Mô tả** (nếu cần).
4. Nhấn **Thêm mới Bộ chỉ số**.

![Bước 1 – Nhấn Thêm mới bộ chỉ số](../out/img/admin/b-set-them-nut.png)

![Bước 2–4 – Nhập thông tin bộ chỉ số](../out/img/admin/b-set-them.png){w=9}

:::warn Lưu ý
Mã tối đa 50 ký tự (A–Z, 0–9, - _ .), không trùng. Tên tối đa 255 ký tự, mô tả tối đa 1.000 ký tự. Bộ mới ở trạng thái **Chưa khóa**, chưa có nhóm chỉ số.
:::

## Xem chi tiết bộ chỉ số

Nhấn **Xem chi tiết** để xem thông tin chung, cấu trúc bộ chỉ số và kỳ đang sử dụng; có thể **Xuất Excel**.

![Chi tiết bộ chỉ số đã khóa – Xuất Excel, Mở rộng tất cả](../out/img/admin/b-set-chi-tiet.png){w=13}

## Cập nhật thông tin bộ chỉ số

Áp dụng với bộ **Chưa khóa**.

1. Tại màn **Xem chi tiết** bộ chỉ số, nhấn **Cập nhật thông tin**.
2. Sửa tên, năm áp dụng, mô tả.
3. Nhấn **Lưu thay đổi**.

![Bước 1 – Nút Cập nhật thông tin và Cấu hình bộ chỉ số](../out/img/admin/b-set-chi-tiet-nut.png)

![Bước 3 – Nhấn Lưu thay đổi](../out/img/admin/b-set-sua.png){w=9}

## Cấu hình bộ chỉ số

Nhấn **Cấu hình bộ chỉ số** để đưa nhóm chỉ số, chỉ số vào bộ và thiết lập điểm.

1. Nhấn **Thêm nhóm**, tích chọn nhóm rồi nhấn **Lưu**.
2. Chọn một nhóm ở danh sách bên trái.
3. Bật/tắt **Tính điểm cho nhóm**.
4. Nhập **Trọng số**, **Điểm tối thiểu**, **Điểm tối đa** cho từng chỉ số.
5. Chọn chỉ số tại ô **Chọn chỉ số cần Thêm mới…**, nhấn **Thêm mới chỉ số**.
6. Nhấn **Lưu nhóm** và **Lưu chỉ số**.

![Bước 1–6 – Màn Cấu hình bộ chỉ số](../out/img/admin/b-set-builder.png)

![Hộp thoại Thêm nhóm – tìm kiếm, tích chọn nhóm rồi nhấn Lưu](../out/img/admin/b-set-builder-them-nhom.png){w=10}

![Bước 5 – Chọn chỉ số cần thêm vào nhóm](../out/img/admin/b-set-builder-them-chi-so.png){w=10}

:::warn Lưu ý
- Chỉ nhóm chỉ số và chỉ số **Đã khóa** mới đưa vào bộ được; mỗi nhóm chỉ xuất hiện một lần.
- Nhấn **Lưu nhóm** / **Lưu chỉ số** trước khi rời màn hình; ô **Cần kiểm tra** phải bằng 0 trước khi khóa bộ.
:::

## Khóa, mở khóa bộ chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Khoá** (hoặc **Mở khoá** với bộ đã khóa).
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Menu thao tác bộ chỉ số chưa khóa](../out/img/admin/b-set-menu.png)

![Bước 3 – Xác nhận khóa](../out/img/admin/b-set-khoa.png){w=7}

:::warn Lưu ý
- Chỉ bộ **Đã khóa** mới chọn được khi tạo kỳ tự đánh giá.
- Bộ đã khóa không sửa/xóa được; cần **Mở khoá** hoặc **Nhân bản**.
:::

## Nhân bản bộ chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết** của bộ **Đã khóa**.
2. Chọn **Nhân bản**.
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Menu thao tác bộ chỉ số đã khóa (Mở khoá, Nhân bản)](../out/img/admin/b-set-menu-khoa.png)

![Kết quả nhân bản – bản sao phiên bản 2, trạng thái Chưa khóa](../out/img/admin/b-set-nhan-ban-kq.png)

:::info Lưu ý
Bản sao có mã hậu tố phiên bản (vd **_V2**), trạng thái **Chưa khóa**.
:::

## Xóa bộ chỉ số

1. Nhấn mũi tên cạnh **Xem chi tiết** của bộ **Chưa khóa**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa](../out/img/admin/b-set-xoa.png){w=7}

# QUẢN LÝ THANG XẾP LOẠI

Thang xếp loại gồm các mức theo **Điểm xếp hạng (%)**, gắn vào kỳ tự đánh giá để xếp loại đơn vị.

Đường dẫn truy cập: **Menu → Bộ chỉ số DTI → Thang xếp loại**

## Xem danh sách thang xếp loại

1. Chọn **Bộ chỉ số DTI → Thang xếp loại**.
2. Tìm kiếm hoặc lọc theo trạng thái.
3. Nhấn **Thêm thang xếp loại** để tạo mới.

![Bước 1 – Chọn Bộ chỉ số DTI → Thang xếp loại](../out/img/admin/b-scl-menu-chon.png){w=10}

![Bước 2–3 – Danh sách thang xếp loại](../out/img/admin/b-scl-ds.png){w=11.4}

## Thêm mới thang xếp loại

1. Nhấn **Thêm thang xếp loại**.
2. Nhập **Tên thang**, **Mô tả** (mã thang tự sinh).
3. Nhập **Tên mức** cho từng mức.
4. Nhập **Đến dưới (%)** cho từng mức; mức cuối nhập **100**.
5. Kiểm tra thanh **Xem trước**.
6. Nhấn **Lưu**.

![Bước 2–6 – Nhập các mức xếp loại rồi nhấn Lưu](../out/img/admin/b-scl-them.png){w=11}

![Bước 4 – Khi chưa nhập đủ mốc, hệ thống báo mức còn thiếu](../out/img/admin/b-scl-them-dang-nhap.png){w=11}

:::warn Lưu ý
- Thang cần **ít nhất 2 mức** và phủ kín **0 – 100%**.
- Nút **Lưu** bị mờ khi còn lỗi.
:::

## Xem chi tiết thang xếp loại

Nhấn **Xem chi tiết** để xem các mức xếp loại và kỳ đang sử dụng.

![Chi tiết thang đang được kỳ sử dụng](../out/img/admin/b-scl-chi-tiet.png){w=12}

:::info Lưu ý
Thang đang được kỳ sử dụng thì không sửa, mở khóa hoặc xóa được.
:::

## Cập nhật thang xếp loại

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Sửa thông tin.
4. Nhấn **Lưu**.

![Bước 1–2 – Menu thang chưa khóa](../out/img/admin/b-scl-menu.png){w=7.4}

![Bước 3–4 – Sửa thang xếp loại rồi nhấn Lưu](../out/img/admin/b-scl-sua.png){w=11}

## Khóa, mở khóa thang xếp loại

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Khoá** (hoặc **Mở khoá** với thang đã khóa).
3. Nhấn **Có** để xác nhận.

![Bước 2 – Menu thang đã khóa](../out/img/admin/b-scl-menu-khoa.png){w=7.4}

![Bước 3 – Xác nhận khóa](../out/img/admin/b-scl-khoa.png){w=10}

![Bước 3 – Xác nhận mở khóa](../out/img/admin/b-scl-mo-khoa.png){w=10}

## Xóa thang xếp loại

1. Nhấn mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa](../out/img/admin/b-scl-xoa.png){w=6}

# QUẢN LÝ TỰ ĐÁNH GIÁ

Kỳ tự đánh giá là đợt các đơn vị tự chấm điểm theo một bộ chỉ số. Tạo kỳ, cấu hình điểm, phân công đơn vị rồi **trình phê duyệt** lên Lãnh đạo Bộ.

Đường dẫn truy cập: **Menu → Bộ chỉ số DTI → Quản lý tự đánh giá**

| Trạng thái | Thao tác được phép |
|---|---|
| **Nháp** | Cập nhật, Cấu hình, Phân công, Trình phê duyệt, Xoá |
| **Chờ phê duyệt** | Chỉ xem |
| **Đã phê duyệt** | Chỉ xem, theo dõi tiến độ |
| **Bị từ chối** | Cập nhật, Cấu hình, Phân công, Trình phê duyệt lại |

## Xem danh sách kỳ tự đánh giá

1. Chọn **Bộ chỉ số DTI → Quản lý tự đánh giá**.
2. Chọn tab **Định kỳ** (theo Tháng/Quý/Năm) hoặc **Đột xuất** (theo khoảng ngày).
3. Tìm kiếm tên kỳ.
4. Nhấn **Xuất Excel** nếu cần.
5. Nhấn **Thêm mới tự đánh giá** để tạo kỳ.

![Bước 1 – Chọn Bộ chỉ số DTI → Quản lý tự đánh giá](../out/img/admin/b-cmp-menu-chon.png){w=10}

![Bước 2–5 – Danh sách kỳ tự đánh giá (tab Định kỳ)](../out/img/admin/b-cmp-ds.png){w=11.4}

![Tab Đột xuất – hiển thị thêm Ngày bắt đầu, Ngày kết thúc](../out/img/admin/b-cmp-ds-dot-xuat.png)

## Thêm mới kỳ tự đánh giá

1. Nhấn **Thêm mới tự đánh giá**.
2. Nhập **Tên đánh giá**.
3. Chọn **Phân loại đánh giá**.
4. Chọn **Kỳ**:
   - Với **Định kỳ**: chọn **Kỳ - Tháng**, **Kỳ - Quý** hoặc **Kỳ - Năm**.
   - Với **Đột xuất**: nhập **Ngày bắt đầu**, **Ngày kết thúc**.
5. Chọn **Bộ chỉ số**.
6. Nhập **Nhắc trước hạn (ngày)**.
7. Chọn **Thang xếp loại**.
8. Nhấn **Thêm mới tự đánh giá**.

![Bước 4 – Định kỳ: chọn Kỳ - Tháng, Kỳ - Quý hoặc Kỳ - Năm](../out/img/admin/b-cmp-ky-chon.png){w=10}

![Bước 2–8 – Kỳ Định kỳ: nhập thông tin rồi nhấn Thêm mới tự đánh giá](../out/img/admin/b-cmp-them-dinh-ky.png){w=10}

![Bước 3–4 – Kỳ Đột xuất: chọn Ngày bắt đầu, Ngày kết thúc](../out/img/admin/b-cmp-them-dot-xuat.png){w=7.4}

:::warn Lưu ý
- Tên, phân loại, bộ chỉ số, thang xếp loại, thời gian là bắt buộc; bộ chỉ số và thang phải **Đã khóa**.
- Khi tạo kỳ, hệ thống **sao chép** bộ chỉ số thành một bộ riêng cho kỳ đó. Nếu cần đổi điểm, hãy làm ở **Xem cấu hình điểm** của kỳ; thay đổi chỉ áp dụng cho kỳ này, **bộ chỉ số gốc không đổi**.
- Thang đã gắn vào kỳ không sửa, mở khóa, xóa được.
:::

## Cập nhật kỳ tự đánh giá

1. Nhấn mũi tên cạnh **Xem chi tiết** của kỳ **Nháp** (hoặc **Bị từ chối**).
2. Chọn **Cập nhật**.
3. Sửa thông tin.
4. Nhấn **Lưu**.

![Bước 1–2 – Menu thao tác kỳ Nháp](../out/img/admin/b-cmp-menu.png)

![Bước 3–4 – Sửa thông tin rồi nhấn Lưu](../out/img/admin/b-cmp-sua.png){w=7.4}

:::warn Lưu ý
**Bộ chỉ số** không đổi được sau khi tạo kỳ.
:::

## Xóa kỳ tự đánh giá

1. Nhấn mũi tên cạnh **Xem chi tiết** của kỳ **Nháp**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa kỳ](../out/img/admin/b-cmp-xoa.png){w=6.9}

:::warn Lưu ý
Chỉ xóa được kỳ **Nháp**.
:::

## Xem chi tiết kỳ tự đánh giá

Nhấn **Xem chi tiết** để xem thông tin kỳ, tiến độ thực hiện, đơn vị được phân công và lịch sử xử lý.

![Chi tiết kỳ tự đánh giá trạng thái Nháp](../out/img/admin/b-cmp-chi-tiet.png){w=13}

## Cấu hình điểm của kỳ

Nhấn **Xem cấu hình điểm**, chỉnh nhóm, trọng số, điểm như mục *Cấu hình bộ chỉ số* rồi nhấn **Lưu nhóm** / **Lưu chỉ số**.

![Cấu hình điểm của kỳ (bản sao riêng của bộ chỉ số)](../out/img/admin/b-cmp-cau-hinh.png)

:::warn Lưu ý
- Chỉ chỉnh được khi kỳ ở trạng thái **Nháp** hoặc **Bị từ chối**.
- Kỳ **Chờ phê duyệt** hoặc **Đã phê duyệt**: nút **Xem cấu hình điểm** chỉ để xem, không sửa được điểm, trọng số hay nhóm.
:::

## Phân công đơn vị

1. Nhấn **Phân công đơn vị**.
2. Tìm kiếm hoặc lọc theo loại đơn vị, tỉnh/thành.
3. Tích chọn các đơn vị cần tự đánh giá.
4. Nhấn **Lưu**.

![Bước 2–4 – Chọn đơn vị rồi nhấn Lưu](../out/img/admin/b-cmp-phan-cong.png){w=12}

:::warn Lưu ý
- Phải phân công **ít nhất 1 đơn vị** trước khi trình phê duyệt.
- Chỉ phân công được khi kỳ **Nháp** hoặc **Bị từ chối**.
:::

## Trình phê duyệt kỳ tự đánh giá

1. Kiểm tra thông tin kỳ, cấu hình điểm, danh sách đơn vị.
2. Nhấn **Trình phê duyệt**, rồi nhấn **Có**. Kỳ chuyển sang **Chờ phê duyệt**.

![Bước 2 – Xác nhận trình phê duyệt](../out/img/admin/b-cmp-trinh.png){w=7}

## Trình lại kỳ bị từ chối

1. Mở chi tiết kỳ **Bị từ chối**, đọc lý do tại **Lịch sử xử lý**.
2. Điều chỉnh kỳ theo yêu cầu (**Cập nhật**, **Xem cấu hình điểm**, **Phân công đơn vị**).
3. Kiểm tra lại thông tin kỳ.
4. Nhấn **Trình phê duyệt**.
5. Nhấn **Có** để xác nhận.

![Bước 4 – Nhấn Trình phê duyệt (kỳ Bị từ chối, lý do ở Lịch sử xử lý)](../out/img/admin/b-cmp-tu-choi.png){w=15}

![Bước 5 – Xác nhận trình lại](../out/img/admin/b-cmp-trinh-lai.png){w=7}
