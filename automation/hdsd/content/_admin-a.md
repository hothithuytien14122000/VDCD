<!-- Vai trò Quản trị hệ thống – Phần A: nhóm menu "Quản trị hệ thống".
     Ảnh chụp bằng tools/capture-admin-a.mjs → ../out/img/admin/a-*.png -->
# QUẢN LÝ NGƯỜI DÙNG

Tạo và quản lý tài khoản đăng nhập của cán bộ, lãnh đạo các đơn vị.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Người dùng**

## Xem, tìm kiếm danh sách người dùng

1. Chọn **Quản trị hệ thống → Người dùng**.
2. Nhập từ khóa vào ô **Tìm kiếm theo tên, Email…**.
3. Lọc theo **nhóm người dùng**, **trạng thái** nếu cần.
4. Nhấn **Xuất Excel** để tải danh sách đang hiển thị.

![Bước 1–4 – Danh sách người dùng, tìm kiếm, lọc và xuất Excel](../out/img/admin/a-usr-ds.png)

## Thêm mới người dùng

1. Nhấn **Thêm mới người dùng**.
2. Nhập **Tên**, **Số điện thoại**, **Email**.
3. Nhập **Tên đăng nhập** và **Mật khẩu**.
4. Chọn **Đơn vị** và **Nhóm người dùng**.
5. Nhấn **Thêm mới người dùng** để lưu.

![Bước 1 – Nhấn Thêm mới người dùng](../out/img/admin/a-usr-them-nut.png)

![Bước 2–5 – Nhập thông tin người dùng rồi nhấn Thêm mới người dùng](../out/img/admin/a-usr-them-form.png){w=13}

![Thông báo lỗi khi chưa nhập đủ trường bắt buộc](../out/img/admin/a-usr-them-loi.png){w=11}

:::warn Lưu ý
- Bắt buộc: **Tên**, **Email**, **Tên đăng nhập**, **Mật khẩu**.
- Mật khẩu tối thiểu 6 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt, không chứa tên đăng nhập.
- **Tên đăng nhập** tối đa 50 ký tự; **Họ tên**, **Email** tối đa 255 ký tự.
- Không trùng **Tên đăng nhập** hoặc **Email** với tài khoản đã có.
- Mỗi người dùng chỉ thuộc **một** nhóm.
:::

## Xem chi tiết người dùng

1. Nhấn **Xem chi tiết** tại dòng người dùng.
2. Xem thông tin tài khoản, đơn vị, nhóm người dùng.

![Bước 1 – Nhấn Xem chi tiết](../out/img/admin/a-usr-xem-nut.png)

![Bước 2 – Thông tin chi tiết người dùng](../out/img/admin/a-usr-chi-tiet.png){w=8}

## Cập nhật người dùng

1. Tại màn **Xem chi tiết** người dùng, nhấn **Cập nhật**.
2. Sửa thông tin (ví dụ **Số điện thoại**).
3. Nhập **Mật khẩu mới** nếu cần cấp lại.
4. Nhấn **Lưu**.

![Bước 2–4 – Sửa thông tin rồi nhấn Lưu](../out/img/admin/a-usr-sua-form.png){w=9}

:::warn Lưu ý
- **Tên đăng nhập** không sửa được.
- Để trống **Mật khẩu mới** thì giữ mật khẩu cũ.
:::

## Khóa và mở khóa tài khoản

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Khoá** (hoặc **Mở khoá**).
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Mở menu thao tác, chọn Khoá](../out/img/admin/a-usr-menu.png){w=10}

![Bước 3 – Nhấn Có để xác nhận](../out/img/admin/a-usr-khoa-xac-nhan.png){w=10}

![Người dùng ở trạng thái Đã khóa](../out/img/admin/a-usr-da-khoa.png)

![Chọn Mở khoá với người dùng đang bị khóa](../out/img/admin/a-usr-menu-mo-khoa.png){w=10}

:::info Lưu ý
Tài khoản **Đã khóa** không đăng nhập được, dữ liệu vẫn giữ nguyên.
:::

## Xóa người dùng

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Nhấn Có để xác nhận xóa](../out/img/admin/a-usr-xoa-xac-nhan.png){w=8}

:::warn Lưu ý
Xóa không thể hoàn tác. Nếu chỉ tạm ngừng, hãy dùng **Khoá**.
:::

# QUẢN LÝ NHÓM NGƯỜI DÙNG

Gom người dùng cùng chức trách; quyền được cấp cho nhóm tại **Ma trận phân quyền**.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Nhóm người dùng**

## Xem danh sách nhóm người dùng

1. Chọn **Quản trị hệ thống → Nhóm người dùng**.
2. Nhập từ khóa vào ô tìm kiếm để tìm nhóm.

![Bước 1–2 – Danh sách nhóm người dùng](../out/img/admin/a-grp-ds.png)

## Thêm mới nhóm người dùng

1. Nhấn **Thêm mới nhóm người dùng**.
2. Nhập **Mã nhóm người dùng**, **Tên nhóm người dùng**, **Mô tả** (không bắt buộc).
3. Nhấn **Thêm mới**.

![Bước 1 – Nhấn Thêm mới nhóm người dùng](../out/img/admin/a-grp-them-nut.png)

![Bước 2–3 – Nhập thông tin nhóm rồi nhấn Thêm mới](../out/img/admin/a-grp-them-form.png){w=11}

:::warn Lưu ý
- Bắt buộc: **Mã nhóm**, **Tên nhóm**.
- Mã: tối đa 50 ký tự; chỉ gồm A–Z, 0–9, - _ . (không dấu, không khoảng trắng); không trùng mã đã có; không sửa được sau khi tạo.
- **Tên nhóm** tối đa 255 ký tự, không trùng nhóm khác.
:::

## Cập nhật nhóm người dùng

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Sửa **Tên nhóm**, **Mô tả**.
4. Nhấn **Lưu**.

![Bước 1–2 – Mở menu thao tác, chọn Cập nhật](../out/img/admin/a-grp-menu.png){w=10}

![Bước 3–4 – Sửa thông tin rồi nhấn Lưu](../out/img/admin/a-grp-sua-form.png){w=10}

## Xóa nhóm người dùng

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa nhóm người dùng](../out/img/admin/a-grp-xoa-xac-nhan.png){w=8}

:::warn Lưu ý
Không xóa được nhóm đang có thành viên hoặc đang được cấp quyền. Gỡ hết quyền tại **Ma trận phân quyền** và chuyển thành viên sang nhóm khác trước.
:::

## Xem chi tiết nhóm người dùng

1. Nhấn **Xem chi tiết** tại dòng nhóm.
2. Xem thông tin nhóm và danh sách thành viên.

![Bước 1 – Nhấn Xem chi tiết tại dòng nhóm](../out/img/admin/a-grp-xem-nut.png)

![Bước 2 – Màn chi tiết nhóm người dùng: thông tin nhóm và danh sách thành viên](../out/img/admin/a-grp-chi-tiet.png)

## Thêm người dùng vào nhóm

1. Tại màn **Xem chi tiết** nhóm, nhấn **Thêm người dùng vào nhóm**.
2. Tích chọn người dùng.
3. Nhấn **Lưu**.

![Bước 1 – Màn chi tiết nhóm, nhấn Thêm người dùng vào nhóm](../out/img/admin/a-grp-chi-tiet.png)

![Bước 2–3 – Tích chọn người dùng rồi nhấn Lưu](../out/img/admin/a-grp-them-tv.png){w=12}

## Xóa người dùng khỏi nhóm

1. Tại màn **Xem chi tiết** nhóm, tích chọn thành viên.
2. Nhấn **Xóa khỏi nhóm**.
3. Nhấn **Xóa khỏi nhóm** trong hộp thoại để xác nhận.

![Bước 1–2 – Chọn thành viên, nhấn Xóa khỏi nhóm](../out/img/admin/a-grp-xoa-tv.png){w=10}

![Bước 3 – Xác nhận](../out/img/admin/a-grp-xoa-tv-xac-nhan.png){w=10}

:::warn Lưu ý
- Người dùng đã thuộc nhóm không chọn lại được khi thêm.
- Xóa khỏi nhóm **không** xóa tài khoản.
:::

# MA TRẬN PHÂN QUYỀN

Cấp hoặc hủy quyền thao tác cho nhóm người dùng và chọn **phạm vi dữ liệu**.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Ma trận phân quyền**

## Bố cục màn hình

![Bố cục màn hình Ma trận phân quyền](../out/img/admin/a-prm-tong-quan.png)

| Khu vực | Mô tả |
|---|---|
| (1) Danh sách nhóm | Chọn nhóm cần xem/chỉnh quyền |
| (2) Nhóm đang chọn | Số quyền đã cấp, nút **Hủy thay đổi**, **Lưu** |
| (3) Tìm kiếm, lọc | Tìm quyền; lọc **Đã cấp / Chưa cấp**; **Xuất Excel** |
| (4) Cây chức năng | Cột **Cấp quyền** (ô tích) và **Phạm vi** |

## Cấp quyền cho nhóm người dùng

1. Chọn nhóm ở danh sách bên trái.
2. Mở chức năng cần cấp quyền.
3. Tích ô **Cấp quyền** của quyền cần cấp.
4. Chọn **Phạm vi**: **Đơn vị**, **Đơn vị và đơn vị con** hoặc **Toàn hệ thống**.
5. Nhấn **Lưu**.

![Bước 1, 3–5 – Chọn nhóm, tích quyền, chọn phạm vi rồi nhấn Lưu](../out/img/admin/a-prm-cap-quyen.png)

![Bước 4 – Chọn phạm vi dữ liệu (phóng to)](../out/img/admin/a-prm-cap-quyen-zoom.png){w=12}

**Phạm vi** quyết định người dùng trong nhóm được xem và thao tác dữ liệu của những đơn vị nào:

| Phạm vi | Người dùng được làm việc với dữ liệu của |
|---|---|
| **Đơn vị** | Chỉ đơn vị của mình |
| **Đơn vị và đơn vị con** | Đơn vị của mình và các đơn vị cấp dưới |
| **Toàn hệ thống** | Tất cả các đơn vị |

Khi tích một quyền, hệ thống tự chọn sẵn **Đơn vị và đơn vị con**. Nếu cần, bấm vào ô **Phạm vi** để đổi sang mức khác.

Riêng các chức năng sau dùng chung cho cả hệ thống, nên ô **Phạm vi** chỉ có một lựa chọn là **Toàn hệ thống** (không đổi được):

| Chức năng | Quyền chỉ có Toàn hệ thống |
|---|---|
| Sao lưu dữ liệu | Tất cả các quyền |
| Tham số hệ thống | Tất cả các quyền |
| Cấu hình vận hành | Tất cả các quyền |
| Thang xếp loại | Tất cả các quyền |

:::warn Lưu ý
- Thay đổi chỉ được ghi nhận khi nhấn **Lưu**, và áp dụng cho tất cả thành viên trong nhóm.
- Không chỉnh được quyền của nhóm **Quản trị hệ thống**.
:::

## Hủy quyền

1. Chọn nhóm ở danh sách bên trái.
2. Bỏ tích ô **Cấp quyền** của quyền cần hủy.
3. Nhấn **Lưu** (hoặc **Hủy thay đổi** để bỏ).

![Bước 2–3 – Bỏ tích quyền rồi nhấn Lưu (hoặc Hủy thay đổi)](../out/img/admin/a-prm-huy-quyen.png)

## Tìm chức năng hoặc quyền

1. Nhập từ khóa vào ô **Tìm chức năng hoặc quyền**.
2. Hệ thống chỉ hiển thị các chức năng, quyền có chứa từ khóa.

![Bước 1 – Tìm chức năng hoặc quyền theo từ khóa](../out/img/admin/a-prm-tim.png)

## Lọc quyền đã cấp, chưa cấp

1. Nhấn **Đã cấp** để chỉ xem các quyền nhóm đang có, hoặc **Chưa cấp** để xem các quyền nhóm chưa có.
2. Nhấn **Tất cả** để hiển thị lại toàn bộ quyền.

![Bước 1 – Lọc Đã cấp: chỉ hiển thị quyền nhóm đang có](../out/img/admin/a-prm-loc-da-cap.png){w=10}

![Bước 1 – Lọc Chưa cấp: chỉ hiển thị quyền nhóm chưa có](../out/img/admin/a-prm-loc-chua-cap.png){w=10}

## Mở rộng, thu gọn cây chức năng

1. Nhấn **Mở rộng tất cả** để hiện đầy đủ các quyền (Xem, Thêm, Sửa…) của từng chức năng.
2. Nhấn **Thu gọn tất cả** để chỉ hiện tên chức năng, giúp danh sách gọn hơn.

![Bước 1 – Nhấn Mở rộng tất cả](../out/img/admin/a-prm-mo-rong.png){w=10}

![Bước 2 – Nhấn Thu gọn tất cả](../out/img/admin/a-prm-thu-gon.png){w=10}

:::info Mẹo
Có thể nhấn mũi tên **›** trước tên từng chức năng để mở hoặc thu gọn riêng chức năng đó.
:::

## Xuất Excel danh sách phân quyền

1. Chọn nhóm ở danh sách bên trái.
2. Nhấn **Xuất Excel**. Hệ thống tải về file **phan-quyen-<mã nhóm>.xlsx** gồm các quyền của nhóm.

![Bước 2 – Nhấn Xuất Excel](../out/img/admin/a-prm-xuat.png)

# ĐƠN VỊ HÀNH CHÍNH CẤP TỈNH

Danh mục tỉnh/thành phố để các đơn vị tham chiếu.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Đơn vị hành chính cấp tỉnh**

## Xem danh sách tỉnh/thành

1. Chọn **Quản trị hệ thống → Đơn vị hành chính cấp tỉnh**.
2. Nhập từ khóa vào ô tìm kiếm (và lọc nếu cần).
3. Nhấn **Xuất Excel** để tải danh sách.

![Bước 1–3 – Danh sách đơn vị hành chính cấp tỉnh](../out/img/admin/a-prv-ds.png)

## Thêm mới tỉnh/thành

1. Nhấn **Thêm mới tỉnh/thành**.
2. Nhập **Mã tỉnh/thành**, **Tên tỉnh/thành**.
3. Nhấn **Thêm mới Đơn vị hành chính cấp tỉnh**.

![Bước 1 – Nhấn Thêm mới tỉnh/thành](../out/img/admin/a-prv-them-nut.png)

![Bước 2–3 – Nhập mã, tên tỉnh/thành rồi nhấn Thêm mới](../out/img/admin/a-prv-them-form.png){w=10}

:::warn Lưu ý
- Bắt buộc: **Mã tỉnh/thành**, **Tên tỉnh/thành**.
- Mã: tối đa 50 ký tự; chỉ gồm A–Z, 0–9, - _ . (không dấu, không khoảng trắng); không trùng mã đã có; không sửa được.
- **Tên tỉnh/thành** tối đa 255 ký tự, không trùng.
:::

## Cập nhật tỉnh/thành

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Sửa **Tên tỉnh/thành**.
4. Nhấn **Lưu**.

![Bước 1–2 – Mở menu thao tác, chọn Cập nhật](../out/img/admin/a-prv-menu.png){w=10}

![Bước 3–4 – Sửa tên rồi nhấn Lưu](../out/img/admin/a-prv-sua-form.png){w=10}

## Xóa tỉnh/thành

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa tỉnh/thành](../out/img/admin/a-prv-xoa-xac-nhan.png){w=9}

:::warn Lưu ý
Chỉ xóa được tỉnh/thành **chưa có đơn vị tham chiếu**; xóa không thể hoàn tác.
:::

## Xem chi tiết tỉnh/thành

Nhấn **Xem chi tiết** tại dòng tỉnh/thành để xem thông tin và các đơn vị thuộc tỉnh/thành.

![Màn chi tiết tỉnh/thành](../out/img/admin/a-prv-chi-tiet.png)

## Gán đơn vị vào tỉnh/thành

1. Tại màn **Xem chi tiết** tỉnh/thành, nhấn **Thêm mới đơn vị vào tỉnh**.
2. Tích chọn đơn vị.
3. Nhấn **Lưu**.

![Bước 2–3 – Chọn đơn vị rồi nhấn Lưu](../out/img/admin/a-prv-gan-don-vi.png){w=12}

# ĐƠN VỊ HÀNH CHÍNH CẤP XÃ

Danh mục xã/phường thuộc các tỉnh/thành, để đơn vị cấp xã tham chiếu.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Đơn vị hành chính cấp xã**

## Xem danh sách xã/phường

1. Chọn **Quản trị hệ thống → Đơn vị hành chính cấp xã**.
2. Nhập từ khóa vào ô tìm kiếm (và lọc nếu cần).
3. Nhấn **Xuất Excel** để tải danh sách.

![Bước 1–3 – Danh sách đơn vị hành chính cấp xã](../out/img/admin/a-com-ds.png)

## Thêm mới xã/phường

1. Nhấn **Thêm mới xã/phường**.
2. Nhập **Mã xã**, **Tên xã/phường**, chọn **Tỉnh/thành trực thuộc**.
3. Nhấn **Thêm mới đơn vị hành chính cấp xã**.

![Bước 1 – Nhấn Thêm mới xã/phường](../out/img/admin/a-com-them-nut.png)

![Bước 2–3 – Nhập thông tin xã/phường rồi nhấn Thêm mới](../out/img/admin/a-com-them-form.png){w=11}

:::warn Lưu ý
- Bắt buộc: **Mã xã**, **Tên xã/phường**.
- Mã: tối đa 50 ký tự; chỉ gồm A–Z, 0–9, - _ . (không dấu, không khoảng trắng); không trùng mã đã có.
- **Tên xã/phường** tối đa 255 ký tự, không trùng trong cùng tỉnh/thành.
:::

## Cập nhật xã/phường

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Sửa thông tin.
4. Nhấn **Lưu**.

![Bước 1–2 – Mở menu thao tác, chọn Cập nhật](../out/img/admin/a-com-menu.png){w=10}

![Bước 3–4 – Sửa thông tin rồi nhấn Lưu](../out/img/admin/a-com-sua-form.png){w=10}

## Xóa xã/phường

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa xã/phường](../out/img/admin/a-com-xoa-xac-nhan.png){w=9}

:::warn Lưu ý
Không xóa được xã/phường đang có đơn vị tham chiếu.
:::

## Xem chi tiết xã/phường

Nhấn **Xem chi tiết** tại dòng xã/phường để xem thông tin và các đơn vị thuộc xã/phường.

![Màn chi tiết xã/phường](../out/img/admin/a-com-chi-tiet.png)

## Gán đơn vị vào xã/phường

1. Tại màn **Xem chi tiết** xã/phường, nhấn **Thêm mới đơn vị vào xã**.
2. Tích chọn đơn vị.
3. Nhấn **Lưu**.

![Bước 1 – Nhấn Thêm mới đơn vị vào xã](../out/img/admin/a-com-gan-nut.png)

![Bước 2–3 – Tích chọn đơn vị rồi nhấn Lưu](../out/img/admin/a-com-gan-don-vi.png){w=12}

:::warn Lưu ý
Chỉ đơn vị **loại cấp xã** mới tham chiếu được tới xã/phường.
:::

# LOẠI ĐƠN VỊ

Phân loại đơn vị theo cấp hành chính; mỗi đơn vị thuộc một loại.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Loại đơn vị**

## Xem danh sách loại đơn vị

1. Chọn **Quản trị hệ thống → Loại đơn vị**.
2. Nhập từ khóa vào ô tìm kiếm, hoặc lọc theo cấp.
3. Nhấn **Xuất Excel** để tải danh sách.

![Bước 1–3 – Danh sách loại đơn vị](../out/img/admin/a-uty-ds.png)

## Thêm mới loại đơn vị

1. Nhấn **Thêm mới loại đơn vị**.
2. Nhập **Mã loại**, **Tên loại đơn vị**, chọn **Cấp hành chính**, nhập **Mô tả** nếu cần.
3. Nhấn **Thêm loại đơn vị**.

![Bước 1 – Nhấn Thêm mới loại đơn vị](../out/img/admin/a-uty-them-nut.png)

![Bước 2–3 – Nhập thông tin loại đơn vị rồi nhấn Thêm loại đơn vị](../out/img/admin/a-uty-them-form.png){w=11}

:::warn Lưu ý
- Bắt buộc: **Mã loại**, **Tên loại đơn vị**, **Cấp hành chính**.
- Mã: tối đa 50 ký tự; chỉ gồm A–Z, 0–9, - _ . (không dấu, không khoảng trắng); không trùng mã đã có.
- **Tên loại đơn vị** tối đa 255 ký tự, không trùng.
:::

## Cập nhật loại đơn vị

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Sửa thông tin.
4. Nhấn **Lưu thay đổi**.

![Bước 1–2 – Mở menu thao tác, chọn Cập nhật](../out/img/admin/a-uty-menu.png){w=10}

![Bước 3–4 – Sửa thông tin rồi nhấn Lưu thay đổi](../out/img/admin/a-uty-sua-form.png){w=10}

## Xóa loại đơn vị

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa loại đơn vị](../out/img/admin/a-uty-xoa-xac-nhan.png){w=8}

:::warn Lưu ý
Loại đang có đơn vị thì không có mục **Xoá**.
:::

## Xem chi tiết loại đơn vị

Nhấn **Xem chi tiết** tại dòng loại đơn vị để xem thông tin và các đơn vị thuộc loại.

![Màn chi tiết loại đơn vị](../out/img/admin/a-uty-chi-tiet.png)

## Thêm đơn vị vào loại đơn vị

1. Tại màn **Xem chi tiết** loại đơn vị, nhấn **Thêm mới đơn vị**.
2. Tích chọn đơn vị.
3. Nhấn **Lưu**.

![Bước 1 – Nhấn Thêm mới đơn vị](../out/img/admin/a-uty-gan-nut.png)

![Bước 2–3 – Tích chọn đơn vị rồi nhấn Lưu](../out/img/admin/a-uty-gan-don-vi.png){w=12}

:::warn Lưu ý
Đơn vị được chọn sẽ **chuyển** sang loại này (rời loại cũ).
:::

# QUẢN LÝ ĐƠN VỊ

Quản lý các đơn vị tham gia đánh giá chuyển đổi số: thông tin, tham chiếu hành chính, người dùng và trạng thái khóa.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Đơn vị**

## Xem danh sách đơn vị

1. Chọn **Quản trị hệ thống → Đơn vị**.
2. Nhập từ khóa vào ô tìm kiếm, hoặc lọc theo tỉnh.
3. Nhấn **Xuất Excel** để tải danh sách.

![Bước 1–3 – Danh sách đơn vị](../out/img/admin/a-org-ds.png)

## Thêm mới đơn vị

1. Nhấn **Thêm mới đơn vị**.
2. Nhập **Mã đơn vị**, **Tên đơn vị**, chọn **Loại đơn vị**, **Đơn vị cha** (nếu có).
3. Chọn **Đơn vị hành chính cấp tỉnh** (và **cấp xã** nếu là đơn vị cấp xã).
4. Nhập **Địa chỉ**, **Số điện thoại**, **Email**.
5. Nhấn **Thêm mới Đơn vị**.

![Bước 1 – Nhấn Thêm mới đơn vị](../out/img/admin/a-org-them-nut.png)

![Bước 2–5 – Nhập thông tin đơn vị rồi nhấn Thêm mới Đơn vị](../out/img/admin/a-org-them-form.png){w=12}

:::warn Lưu ý
- Bắt buộc: **Mã đơn vị**, **Tên đơn vị**, **Loại đơn vị**; Email đúng định dạng.
- Mã: tối đa 50 ký tự; chỉ gồm A–Z, 0–9, - _ . (không dấu, không khoảng trắng); không trùng mã đã có.
- **Tên đơn vị** tối đa 255 ký tự, không trùng trong cùng **Đơn vị cha**.
- Ô cấp xã chỉ chọn được với loại đơn vị cấp xã.
:::

## Cập nhật đơn vị

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Cập nhật**.
3. Sửa thông tin.
4. Nhấn **Lưu**.

![Bước 3–4 – Sửa thông tin đơn vị rồi nhấn Lưu](../out/img/admin/a-org-sua-form.png){w=12}

:::warn Lưu ý
**Mã đơn vị** không sửa được.
:::

## Xóa đơn vị

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Xoá**.
3. Nhấn **Có** để xác nhận.

![Bước 3 – Xác nhận xóa đơn vị](../out/img/admin/a-org-xoa-xac-nhan.png){w=8}

:::warn Lưu ý
Không xóa được đơn vị đang có người dùng.
:::

## Khóa và mở khóa đơn vị

1. Nhấn nút mũi tên cạnh **Xem chi tiết**.
2. Chọn **Khoá** (hoặc **Mở khoá**).
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Mở menu thao tác, chọn Khoá](../out/img/admin/a-org-menu.png){w=10}

![Bước 3 – Nhấn Có](../out/img/admin/a-org-khoa-xac-nhan.png){w=10}

![Đơn vị ở trạng thái Đã khóa – menu chỉ còn Mở khoá](../out/img/admin/a-org-da-khoa.png)

:::warn Lưu ý
Đơn vị **Đã khóa** chỉ còn thao tác **Mở khoá**, không cập nhật hay xóa được.
:::

## Xem chi tiết đơn vị

Nhấn **Xem chi tiết** tại dòng đơn vị.

![Màn chi tiết đơn vị](../out/img/admin/a-org-chi-tiet.png)

## Thêm người dùng vào đơn vị

1. Tại màn **Xem chi tiết** đơn vị, nhấn **Thêm người dùng vào đơn vị**.
2. Tích chọn người dùng.
3. Nhấn **Lưu**.

![Bước 1 – Nhấn Thêm người dùng vào đơn vị](../out/img/admin/a-org-them-nd-nut.png)

![Bước 2–3 – Tích chọn người dùng rồi nhấn Lưu](../out/img/admin/a-org-them-nd.png){w=12}

:::info Lưu ý
Người dùng đang thuộc đơn vị khác sẽ tự động chuyển sang đơn vị này.
:::

## Xóa người dùng khỏi đơn vị

1. Tại màn **Xem chi tiết** đơn vị, tích chọn người dùng trong bảng **Người dùng trong đơn vị**.
2. Nhấn **Xóa … đã chọn**.
3. Nhấn **Có** để xác nhận.

![Bước 1–2 – Chọn người dùng, nhấn Xóa đã chọn](../out/img/admin/a-org-xoa-nd.png){w=10}

![Xác nhận xóa](../out/img/admin/a-org-xoa-nd-xac-nhan.png){w=10}

## Đổi tỉnh của đơn vị

1. Tại màn **Xem chi tiết** đơn vị, nhấn **Đổi tỉnh**.
2. Chọn tỉnh/thành mới.
3. Nhấn **Lưu**.

![Bước 2–3 – Chọn tỉnh/thành mới rồi nhấn Lưu](../out/img/admin/a-org-doi-tinh.png){w=10}

## Bỏ tham chiếu tỉnh của đơn vị

1. Tại màn **Xem chi tiết** đơn vị, nhấn **Bỏ tham chiếu**.
2. Nhấn **Có** để xác nhận.

![Bước 2 – Xác nhận bỏ tham chiếu tỉnh](../out/img/admin/a-org-bo-tham-chieu.png){w=9}

# THAM SỐ HỆ THỐNG

Cấu hình quy định an toàn tài khoản và minh chứng cho toàn hệ thống.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Tham số hệ thống**

1. Chọn **Quản trị hệ thống → Tham số hệ thống**.
2. Chọn tab **Bảo mật tài khoản** hoặc **Minh chứng**.
3. Điều chỉnh tham số.
4. Nhấn **Lưu thay đổi**.

![Bước 1, 2, 4 – Tab Bảo mật tài khoản](../out/img/admin/a-cfg-bao-mat.png)

## Tab Bảo mật tài khoản

| Nhóm tham số | Nội dung |
|---|---|
| Quy tắc mật khẩu | Độ dài tối thiểu, yêu cầu ký tự, số mật khẩu cũ không dùng lại |
| Hiệu lực & đổi mật khẩu | Thời hạn, nhắc hết hạn, xử lý khi hết hạn |
| Đăng nhập & phiên làm việc | Số lần sai tối đa, thời gian khóa, thời gian hết phiên |

![Toàn bộ tab Bảo mật tài khoản](../out/img/admin/a-cfg-bao-mat-full.png){w=12}

## Tab Minh chứng

| Tham số | Nội dung |
|---|---|
| Dung lượng file tối đa | Dung lượng tối đa (MB) mỗi file |
| Bắt buộc ký số file minh chứng | Bật để yêu cầu ký số |

![Tab Minh chứng](../out/img/admin/a-cfg-minh-chung.png)

:::warn Lưu ý
Tham số ảnh hưởng **toàn bộ** người dùng; chỉ thay đổi khi có quyết định của cấp có thẩm quyền.
:::

# SAO LƯU DỮ LIỆU

Sao lưu và xóa bản sao dữ liệu hệ thống.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Sao lưu**

## Xem lịch sử sao lưu

1. Chọn menu **Quản trị hệ thống → Sao lưu**.
2. Lọc theo **Loại** hoặc **Trạng thái**; tìm theo mã bản sao, ghi chú hoặc khoảng **Từ ngày – Đến ngày**.
3. Nhấn **Xem chi tiết** ở dòng cần xem.

![Lịch sử sao lưu – Bước 1 chọn menu, Bước 2 bộ lọc, Bước 3 Xem chi tiết](../out/img/admin/a-bak-ds.png)

## Cấu hình sao lưu tự động

1. Nhấn **Cấu hình sao lưu** ở trang Sao lưu.

![Bước 1 – Nhấn Cấu hình sao lưu](../out/img/admin/a-bak-cau-hinh-nut.png)

2. Bật **Lịch sao lưu tự động**, chọn **Tần suất** và **Giờ chạy**.
3. Chọn **Phạm vi dữ liệu** và **Vị trí lưu trữ**, nhấn **Kiểm tra kết nối** nếu cần.
4. Nhập **Chính sách lưu giữ**.
5. Nhấn **Lưu cấu hình**.

![Cấu hình sao lưu – Bước 2 lịch tự động, Bước 3 vị trí lưu trữ, Bước 4 chính sách lưu giữ, Bước 5 Lưu cấu hình](../out/img/admin/a-bak-cau-hinh.png)

## Tạo sao lưu ngay

1. Nhấn **Tạo sao lưu ngay** ở trang Sao lưu.

![Bước 1 – Nhấn Tạo sao lưu ngay](../out/img/admin/a-bak-tao-nut.png)

2. Chọn **Phạm vi dữ liệu**.
3. Nhập **Ghi chú** (nếu cần). Tích **Khóa bảo vệ bản sao này** nếu muốn bản sao không bị xóa tự động.
4. Nhấn **Bắt đầu sao lưu**.

![Tạo sao lưu ngay – Bước 2 phạm vi, Bước 3 ghi chú, Bước 4 Bắt đầu sao lưu](../out/img/admin/a-bak-tao-ngay.png)

## Xem chi tiết bản sao lưu

1. Nhấn **Xem chi tiết** ở dòng bản sao cần xem (xem hình ở mục Xem lịch sử sao lưu).
2. Xem **Thông tin chung**: loại, người thực hiện, thời gian, dung lượng, chính sách lưu giữ, vị trí lưu trữ.
3. Xem **Nhật ký thực hiện** để biết các bước đã chạy và kết quả.
4. Nhấn **Khóa bảo vệ** để giữ bản sao, hoặc **Xóa bản sao** để xóa (xem mục Xóa bản sao lưu).

![Chi tiết bản sao lưu – Bước 2 Thông tin chung, Bước 3 Nhật ký thực hiện, Bước 4 Khóa bảo vệ và Xóa bản sao](../out/img/admin/a-bak-chi-tiet.png)

## Xóa bản sao lưu

1. Tích chọn bản sao cần xóa.
2. Nhấn **Xóa bản sao**.
3. Tích **Tôi hiểu thao tác này không thể hoàn tác**.
4. Nhấn **Xóa vĩnh viễn**.

![Xóa bản sao – Bước 1 tích chọn bản sao, Bước 2 Xóa bản sao](../out/img/admin/a-bak-xoa.png)

:::warn Lưu ý
Bản sao bị xóa vĩnh viễn, không khôi phục được. Bản đang **khóa bảo vệ** sẽ không bị xóa.
:::

# NHẬT KÝ TRUY CẬP

Xem lịch sử đăng nhập, đăng xuất và phiên làm việc của người dùng.

Đường dẫn truy cập: **Menu → Quản trị hệ thống → Nhật ký truy cập**

## Xem danh sách nhật ký

1. Chọn menu **Quản trị hệ thống → Nhật ký truy cập**.
2. Nhấn **Bộ lọc** hoặc nhập từ khóa vào ô tìm kiếm (người dùng, tên đăng nhập, mô tả, IP).
3. Chọn **Khoảng thời gian**, **Sự kiện**, **Đơn vị**, **Kết quả**.
4. Nhấn **Xem chi tiết** ở dòng cần xem.

![Nhật ký truy cập – Bước 1 chọn menu, Bước 2 Bộ lọc, Bước 4 Xem chi tiết](../out/img/admin/a-log-ds.png)

![Bộ lọc – Bước 3 chọn khoảng thời gian, sự kiện, đơn vị, kết quả](../out/img/admin/a-log-loc.png)

## Xem chi tiết một sự kiện

Mở **Xem chi tiết** ở dòng cần xem để biết ai thực hiện, từ đâu và sự kiện xảy ra trong phiên làm việc nào.

- **Bước 5:** xem phần **Người dùng** (họ tên, tên đăng nhập, đơn vị), địa chỉ IP, trình duyệt và thiết bị.
- **Bước 6:** xem **Sự kiện cùng phiên** để biết các thao tác trước và sau sự kiện.
- **Bước 7:** nhấn **Đóng**.

![Chi tiết sự kiện – Bước 5 Người dùng, Bước 6 Sự kiện cùng phiên, Bước 7 Đóng](../out/img/admin/a-log-chi-tiet.png)
