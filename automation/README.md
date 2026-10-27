# CĐS-BCT — Automation test (Playwright + TypeScript)

## Cấu trúc
```
.env / .env.example     URL + tài khoản (.env bí mật, đã .gitignore); accounts.mjs nạp cấu hình
auth/<user>.json        Session đăng nhập (bí mật)   login.mjs / save-session.mjs tạo session (captcha tay)
testcases/              docs/ (catalog.mjs, catalog-B.mjs = NGUỒN testcase · requirements.mjs (truy vết yêu cầu→điều kiện→testcase)) · TestCase/ · tools/
                        TestCase/<A|B|C|Auth>/<ten-khong-dau>.yaml · tools/ (build, coverage-check, trace-check, report)
scripts/<A|B|C|Auth>/<ten-khong-dau>.spec.ts  Script tương ứng testcase từng page (+ common.ts)
scripts/helpers.ts, api.ts  Hàm dùng chung (đăng nhập, gọi API)
results/<ngày_giờ>/     tong-hop.md · ket-qua.csv · <Page>/<Page>.yaml · status.json
cleanup-all.mjs         Dọn dữ liệu auto sót (QCA*, qca*, qc.automation)
.claude/skills/gen-testcase/   Skill sinh testcase
```

## Thiết lập & chạy
```bash
cp .env.example .env && npm install && npx playwright install chromium
npm run auth             # đăng nhập tay (captcha) → auth/*.json (token hiện sống tới ~01/2027)
npm run test:A           # 6 page phân hệ A, có ghi dữ liệu (RUN_WRITE=1), ~21 phút
npm run test:A:report    # lưu kết quả vào results/, cập nhật YAML, dọn dữ liệu (bắt buộc chạy sau test:A)
npm run test:B           # 5 page phân hệ B (Trụ cột, Nhóm chỉ số, Chỉ số, Bộ chỉ số, Thang xếp loại)
npm run test:B:report    # lưu kết quả B, cập nhật YAML, dọn dữ liệu
npm run tc:build         # sau khi sửa catalog/requirements: build + kiểm tra độ phủ & truy vết
RUN_WRITE=1 npx playwright test --project=superadmin "scripts/A/nguoi-dung.spec.ts"   # chạy 1 page
npx playwright test --project=superadmin                                       # test chỉ đọc (B/C/D, bảo mật, hiệu năng)
```
Thời gian 1 worker: Người dùng ~4m30 · Nhóm ~4m · Tỉnh ~2m40 · Xã ~2m50 · Loại ĐV ~2m50 · Đơn vị ~4m30.

## Phạm vi
- A (6 page, 269 testcase): `scripts/A`. Script B/C/D sẽ thêm theo từng page khi có testcase.
- Bỏ qua theo yêu cầu: Ma trận phân quyền, Tham số hệ thống. Thang xếp loại (B.5) chỉ phủ cấu trúc; kỳ tự đánh giá (C.1) xác minh bằng API.
- Test ghi dữ liệu dùng tiền tố `QCA`/`qc.automation` và tự dọn qua API.
