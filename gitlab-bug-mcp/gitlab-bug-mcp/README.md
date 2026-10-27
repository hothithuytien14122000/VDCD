# gitlab-bug-mcp

Log bug lên GitLab khi test FAIL, theo quy ước: assignee `gnt.manhtv`, label `New`,
tiêu đề tiếng Việt, description gồm Các bước tái hiện / Kết quả mong đợi / Kết quả thực tế,
ảnh đính kèm, Start date = hôm nay, Due date = ngày mai.
FAIL lặp lại cùng lỗi (issue đang mở trùng tiêu đề) → thêm comment "tái hiện lại", không tạo issue mới.

Yêu cầu: Node ≥ 20.12. Token GitLab (Personal/Project Access Token) scope `api`,
user của token có quyền Reporter trở lên trong project.

```bash
npm install
cp .env.example .env   # điền GITLAB_URL, GITLAB_TOKEN, GITLAB_PROJECT_ID
```

## 1. MCP server (Claude gọi khi chạy test)

Tools: `create_bug_issue`, `search_issues`, `add_issue_comment`.

Claude Code:
```bash
claude mcp add gitlab-bug -s user \
  -e GITLAB_URL=https://gitlab.your-company.vn -e GITLAB_TOKEN=glpat-xxx -e GITLAB_PROJECT_ID=group/project \
  -- node /duong-dan/gitlab-bug-mcp/src/server.js
```

Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "gitlab-bug": {
      "command": "node",
      "args": ["C:/duong-dan/gitlab-bug-mcp/src/server.js"],
      "env": {
        "GITLAB_URL": "https://gitlab.your-company.vn",
        "GITLAB_TOKEN": "glpat-xxx",
        "GITLAB_PROJECT_ID": "group/project"
      }
    }
  }
}
```

Câu lệnh mẫu cho Claude: *"Chạy test case trang Người dùng, case nào Fail thì gọi
create_bug_issue, đính kèm ảnh chụp màn hình đã lưu."*

## 2. CLI — đẩy case FAIL từ file Excel test case

```bash
node src/cli.js excel testcases.xlsx --env "Staging - Chrome" --dry-run   # xem trước
node src/cli.js excel testcases.xlsx --env "Staging - Chrome"             # tạo thật
```
- Đọc mọi sheet, tìm header `ID | TITLE | STEP | KẾT QUẢ MONG ĐỢI | STATUS`.
- Cột tùy chọn: `KẾT QUẢ THỰC TẾ`, `GHI CHÚ`, `ẢNH` (đường dẫn, nhiều file cách nhau `;`).
- Tiêu đề: "Kiểm tra phân trang" + TC_02 → `Lỗi phân trang [TC_02]`.
- Link issue ghi ngược vào cột `ISSUE`; chạy lại sẽ bỏ qua dòng đã có link.

Từ JSON (cho framework khác: Selenium, Cypress, k6...):
```bash
node src/cli.js json failed.json
```
```json
[{ "title": "Lỗi ...", "steps": ["...", "..."], "expected": "...", "actual": "...",
   "test_case_id": "TC_01", "attachments": [{ "path": "shots/tc01.png" }] }]
```

## 3. Playwright reporter — CI hoặc chạy auto

```ts
// playwright.config.ts
reporter: [['list'], ['./gitlab-bug-mcp/reporters/playwright-gitlab-reporter.js', { environment: 'Staging - Chrome' }]],
use: { screenshot: 'only-on-failure' },
```
```bash
GITLAB_REPORT=1 npx playwright test
```
Chỉ log khi `GITLAB_REPORT=1`, và chỉ sau lần retry cuối (test flaky pass lại thì không log).
`test.step(...)` thành các bước tái hiện; annotation `tc` / `expected` thành mã test case / kết quả mong đợi.

## Ghi chú
- Start date đặt qua GraphQL (widget Dates). Nếu GitLab của bạn chưa hỗ trợ, issue vẫn được
  tạo với Due date và kết quả trả về có `warning`.
- Đổi mặc định bằng biến môi trường: `GITLAB_DEFAULT_ASSIGNEE`, `GITLAB_DEFAULT_LABELS`, `GITLAB_DUE_DAYS`.
