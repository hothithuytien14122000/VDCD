# YAML schema `1.0`

Tách **test logic** (`test_cases`) khỏi **thông tin triển khai** (`automation_config`). Step chỉ
tham chiếu *tên logic* trong `automation_config`; bước sinh script mới resolve sang locator thật.

```yaml
schema_version: "1.0"
meta:
  uc_id: "UCx.y"
  uc_title: "..."
  source_file: "docs/..."
  generated_at: "YYYY-MM-DD"
  language: vi

automation_config:            # điền khi tài liệu/cấu hình cung cấp; thiếu -> null/missing
  framework: playwright
  base_url: ${env:BASE_URL}   # lấy từ file .env của dự án, không hard-code URL
  credentials: {}             # role -> tên biến môi trường (KHÔNG ghi mật khẩu)
  locators:                   # tên logic -> locator
    btn_add:
      strategy: null          # role | text | label | css | testid | xpath
      value: null
      status: missing         # confirmed | missing
  api_endpoints: {}           # tên logic -> {method, path, status}
  action_mapping:             # action -> hàm/helper của framework (tuỳ dự án)
    click: null

requirements:
  - id: BR-1                  # hoặc MF-1 (main flow), AF-1, EF-1, FLD-code, MSG-1, PERM-1
    type: business_rule       # main_flow | alt_flow | exception_flow | business_rule | field | message | permission | state
    text: "..."
    status: clear             # clear | needs_confirmation

open_questions:
  - id: OQ-1
    text: "UC không nêu ..."
    requirement_refs: [BR-1]

test_cases:
  - id: TC_UCx.y_001          # ổn định, duy nhất
    title: "..."
    type: positive            # positive | negative | boundary | permission | state_transition | decision_table | error_handling | ui
    techniques: [EP]          # EP | BVA | DT | ST | PERM | ERR | UC_FLOW
    priority: high            # high | medium | low
    requirement_refs: [MF-1]  # phải tồn tại trong requirements
    preconditions:
      - "Đã đăng nhập với vai trò Quản trị hệ thống"
    test_data:                # dữ liệu cụ thể, step tham chiếu bằng ${name}
      province_code: "HN"
    steps:
      - seq: 1
        action: click         # navigate | click | fill | select | check | upload | wait | press | verify | api_call
        target: btn_add       # tên logic (khớp automation_config.locators) hoặc null với navigate/verify trang
        input: null           # giá trị nhập, vd. "${province_code}"
        description: "Nhấn nút Thêm mới"
        expected:
          description: "Hiển thị form Thêm mới"
          assertions:         # có cấu trúc để sinh expect()
            - {type: visible, target: frm_add, value: null}   # visible | hidden | text_equals | text_contains | count | enabled | disabled | url_contains | row_exists | row_absent
          status: confirmed   # confirmed | needs_confirmation
    expected_result: "Kết quả cuối cùng, kiểm chứng được"
    automation:
      automatable: partial    # yes | partial | no
      blockers: ["Thiếu locator btn_add"]
    notes: null
```

Quy tắc: `steps[].seq` liên tục từ 1; mỗi step có `description` và `expected.description`
(nếu step không có kiểm chứng riêng, ghi "—" và để `assertions: []`); `expected_result` bắt buộc.
Excel: cột Step = `"<seq>. <description>"` mỗi dòng; cột Kết quả mong đợi = các `expected.description`
có nội dung theo `"<seq>. ..."` rồi dòng cuối `expected_result`.

Lưu ý: dùng khóa `seq`, **không dùng `no`** — YAML 1.1 (PyYAML) hiểu `no` là boolean `false`.
Với giá trị chuỗi `yes/no/on/off`, luôn đặt trong dấu nháy.

Tuỳ chọn trên step: `scope` — ngữ cảnh chứa `target` (vd. Mã của dòng trong bảng: `scope: "${code}"`
nghĩa là tìm `target` trong dòng có Mã đó). Dùng khi một locator logic lặp lại ở nhiều dòng.
