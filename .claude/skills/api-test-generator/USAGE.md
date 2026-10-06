# Hướng dẫn sử dụng API Test Generator Skill

## Mục đích

Skill này sinh ra bộ test API (file test-case `.yaml` + file test thực thi `.spec.ts` bằng
Playwright) từ spec nghiệp vụ (UC/ES/CT/PM/EN/VO) và Swagger sống, rồi chạy test và báo kết quả
ngay trong chat.

---

## Cách sử dụng nhanh

### 1. Chuẩn bị

- **`.env`** đã có sẵn tại `apps/testing/automation-testing/be-testing/.env` với `SWAGGER_URL`,
  `API_BASE_URL`, `TEST_USERNAME`, `TEST_PASSWORD` — không cần tạo lại trừ khi thiếu.
- **Target**: 1 UC/ES/CT id cụ thể (ví dụ `UC-KNW-001`), hoặc mô tả entity/endpoint cần test nếu
  không có UC tương ứng.

### 2. Gõ lệnh vào chat

```
/api-test-generator UC-KNW-001
```

hoặc

```
Tạo test case API cho UC-GOV-025 (Route DRTP to Decision Queue)
```

### 3. Skill sẽ tự động:

- Quét `specs/**/*.md` và `.specs-0.3/**/*.md` tìm đúng spec đang dẫn (driving spec) — luôn quét
  lại mỗi lần, không dùng path nhớ sẵn
- Gọi Swagger endpoint thật để lấy đúng tên field/tham số (nguồn sự thật cho tên field, ngay cả
  khi spec đã đổi tên nhưng backend chưa deploy theo)
- Sinh `test-cases/api/{folder}/{name}-test-cases.yaml` (tài liệu test case)
- Sinh `script/api/{folder}/{name}.spec.ts` (Playwright, raw fetch, hard assertion)
- Chạy `npx playwright test`, báo pass/fail trực tiếp trong chat

**Không có bước tự động đăng lên Azure DevOps** — nếu muốn đăng kết quả lên work item, nói rõ yêu
cầu, Claude sẽ dùng `mgi-devops` MCP server để đăng (ví dụ `mcp__mgi-devops__add_work_item_comment`).
Có thể chạy trước
`python3 scripts/execute_and_report.py` để có sẵn 1 bản tóm tắt GO/NO-GO định dạng chuẩn
(`report/test-report.md`) cho Claude đọc rồi đăng — script này **không** tự đăng lên ADO.

---

## Lưu ý

- Đầu ra nằm ở `apps/testing/automation-testing/be-testing/` (`test-cases/api/…`, `script/api/…`,
  `report/junit-{timestamp}.xml`, `report/html-{timestamp}/` — mỗi lần chạy ra 1 bản riêng, không
  đè lần trước; chạy kèm `--reporter=list` sẽ không sinh 2 file report này)
- Nếu 1 UC không có endpoint public (job nội bộ, scheduled) thì sẽ không sinh test — skill sẽ nói
  rõ lý do thay vì tạo test giả
- Drift giữa spec và runtime thật (ví dụ tên param đã đổi trong spec nhưng API chưa deploy) được
  ghi lại thành 1 test case riêng (`bug_notes`/Known Gaps), không tự sửa assertion để khớp 1 bên
- Nếu đã có file test cũ cho cùng UC (`.ps1`, `.md`, hoặc `.spec.ts` cũ), skill sẽ nêu rõ trong bước
  xác nhận spec — không coi kết quả xanh của suite cũ là bằng chứng phản bác nếu nó trích dẫn version
  spec khác với bản hiện tại

---

## Kết quả bạn nhận được

- File test case `.yaml` (test-cases/api/…)
- File test tự động `.spec.ts` (script/api/…)
- Kết quả chạy test: `report/junit-{timestamp}.xml` + `report/html-{timestamp}/`
- Tóm tắt pass/fail ngay trong chat

---

## Chi tiết đầy đủ

Xem **[SKILL.md](./SKILL.md)** để biết toàn bộ quy trình 6 bước (bước 5 là tự soát lại coverage —
đọc lại UC/CT theo từng câu để bắt các clause bị gộp/bỏ sót trước khi viết spec chạy thật), format
test-case yaml, quy tắc viết Playwright spec, và cách đọc CT spec grammar 0.4.
