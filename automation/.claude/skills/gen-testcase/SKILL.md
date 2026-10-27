---
name: gen-testcase
description: Sinh testcase bao phủ đầy đủ yêu cầu của một page/phân hệ, bám requirement và hành vi thực của hệ thống (không dùng checklist cố định); phân rã yêu cầu thành điều kiện kiểm thử, lập bảng truy vết và tự kiểm tra lỗ hổng. Dùng khi cần "tạo/bổ sung testcase cho page X" hoặc "kiểm tra testcase đã cover requirement chưa".
---
# Sinh testcase theo requirement

Độ phủ đo trên **yêu cầu + hành vi thực của hệ thống này**, không áp checklist chung. Tự suy điều kiện cần test, rồi chứng minh mỗi điều kiện có testcase.

**File:** `testcases/docs/catalog.mjs` (+ `catalog-B.mjs`) (nguồn testcase: `t(id,uc,fn,title,type,pri,steps,exp,auto,note)`), `testcases/docs/requirements.mjs` (truy vết: yêu cầu → điều kiện → ID regex), nguồn yêu cầu: Excel `UC_1409` + SRS ở thư mục cha. Sinh ra, không sửa tay: `catalog.json`, `testcases/yaml/`.

**Quy trình**
1. **Yêu cầu:** mỗi dòng UC/SRS = 1 yêu cầu (ghi nguyên văn + số dòng). Lấy cả quy tắc ẩn và ghi chú bug trong cột ghi chú.
2. **Khảo sát thật** (Playwright + API, session `auth/`): cột, bộ lọc, nút, menu, form (bắt buộc/định dạng/độ dài), thông báo lỗi, mã API với dữ liệu sai/id lạ, ma trận quyền. Điều UC không nói mà UI/API thể hiện cũng là điều kiện; lệch UC → ghi `note`.
3. **Phân rã** từng yêu cầu thành điều kiện, chỉ giữ câu áp dụng được: đầu vào (bắt buộc, định dạng, biên, giá trị đặc biệt) · quy tắc nghiệp vụ (duy nhất, phụ thuộc, chặn theo trạng thái/tham chiếu) · trạng thái/vòng đời · quan hệ dữ liệu & số liệu tổng hợp · luồng (hủy, xác nhận, lặp thao tác, đối tượng không tồn tại) · lỗi (4xx có thông báo, lỗi server/mất mạng, không lộ nội bộ) · hiển thị/lưu/tìm/lọc/phân trang · quyền & truy cập trái phép · phi chức năng nếu dự án quan tâm. Ghi `[mô tả, 'ID-regex']` dưới yêu cầu.
4. **Error guessing theo dự án:** với mỗi yêu cầu hỏi "ở hệ thống này, gì dễ sai mà chưa có điều kiện?" (dựa khảo sát, bug đã biết). Bước này quyết định độ đầy đủ; checker không làm thay.
5. **Viết testcase** cho mọi điều kiện. ID `PREFIX-<nhóm><số>` (L list/tìm, V chi tiết, C thêm, E sửa, D xóa, K khóa, R tham chiếu, M thành viên, G edge/lỗi, S bảo mật, P hiệu năng), không đổi ID cũ. `steps` đánh số từng dòng; `exp` kiểm chứng được (thông báo, giá trị qua API, số dòng). `type`: Chức năng|Validate|Nghiệp vụ|Bảo mật|Hiệu năng|UI; `auto`: Auto hoặc lý do Manual.
6. Hành vi thực sai quy tắc → vẫn viết theo hành vi đúng, `note: "Khảo sát: … → nghi lỗi"` (Fail = defect). Quy tắc chưa rõ → "cần BA xác nhận", không hạ kỳ vọng.
7. `npm run tc:build` (build + coverage-check UC + trace-check): phải không còn điều kiện thiếu testcase và testcase mồ côi.
8. Báo cáo: số yêu cầu/điều kiện/testcase, điều kiện mới ở bước 4, Manual + lý do, điểm cần BA.

**Chất lượng:** testcase độc lập, tự tạo dữ liệu (`QCA…`/`qc.automation`) và dọn qua API; không ghi tài khoản/mật khẩu (nằm ở `.env`); không gộp nhiều validate vào một testcase.

**Sau đó:** viết script `scripts/<A|B|C|Auth>/<ten-khong-dau>.spec.ts` (tên tiếng Việt không dấu, ví dụ `nguoi-dung.spec.ts`, theo bảng SLUG trong `testcases/tools/build-yaml.mjs`; page có nhiều phần thì thêm hậu tố `-1-…`, `-2-…`) (tên test = `tc('ID')`, helper ở `scripts/A/common.ts`); chạy `npm run test:A` → `npm run test:A:report`.
