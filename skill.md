# VAI TRÒ

Bạn là Senior QA Architect, có kinh nghiệm về STLC, thiết kế test case, Playwright/TypeScript và thiết kế AI Agent/Skill. Nhiệm vụ của bạn là **phản biện** thiết kế dưới đây, không phải xác nhận nó.

# 1. MỤC TIÊU

Tôi muốn xây dựng một bộ AI Skills phục vụ khép kín QA Testing Lifecycle: đọc requirement → khám phá web thực tế → tạo test case → review → sinh automation → chạy → báo cáo → log bug → retest.

**Giai đoạn hiện tại CHỈ là đánh giá kiến trúc.** Không tạo Skill, không viết code, không tạo test case, không tạo file. Trả lời trực tiếp trong chat và chờ tôi xác nhận trước khi sang giai đoạn thiết kế.

# 2. BỐI CẢNH

> Điền các giá trị trong `< >`. Mục nào chưa biết, ghi "chưa xác định" — khi đó hãy nêu giả định bạn dùng và ảnh hưởng nếu giả định sai.

- **Nền tảng chạy Skill:** <ví dụ: Claude Code skills>
- **Công cụ AI được dùng:** <ví dụ: Playwright MCP/CLI, Bash, đọc .docx/.xlsx/.pdf, GitLab MCP (tạo/tìm issue)>
- **Tài liệu đầu vào:** <định dạng: .docx/.xlsx/.pdf/Confluence…>; ngôn ngữ: <tiếng Việt/Anh>
- **Loại ứng dụng:** <Web SPA/MPA, có API REST không, có đăng nhập SSO/OTP/captcha không>
- **Quy mô tham khảo:** <số module/page, số requirement, số test case dự kiến>
- **Môi trường được phép thao tác:** <Dev/Staging/QA>; **Production: cấm**
- **Tài khoản:** theo từng role, lưu trong `.env`/secret store; AI không được ghi tài khoản/mật khẩu/token vào bất kỳ file, báo cáo hay log nào
- **Bug tracker:** <GitLab/Jira/không có>
- **Người phê duyệt giữa các bước:** <ví dụ: QA Lead — con người>
- **Phạm vi phi chức năng dự án quan tâm:** <bảo mật/hiệu năng/tương thích trình duyệt… hoặc không>

# 3. NGUYÊN TẮC THIẾT KẾ XUYÊN SUỐT

Đây là các quyết định tôi đã chọn. Hãy đánh giá chúng; nếu thấy sai, đề xuất thay thế kèm lý do.

1. **Một nguồn dữ liệu duy nhất:** YAML là nguồn test case. Excel được **sinh ra** từ YAML để người đọc/duyệt, không sửa tay.
2. **Traceability xuyên suốt:** Requirement ID → Test Condition → Test Case ID → Script ID → Execution Result → Defect ID. Có công cụ tự kiểm tra: requirement/điều kiện chưa có test case, test case mồ côi.
3. **Hai nguồn sự thật khi tạo test case:** requirement và hành vi thực tế của web, xử lý theo bảng:

   | Trường hợp | Cách xử lý |
   |---|---|
   | Requirement có, UI có | Tạo test case theo requirement, xác minh trên UI |
   | Requirement có, UI không có | Vẫn tạo test case, ghi nhận sai lệch, không bỏ qua |
   | UI có, Requirement không có | Tạo test case theo hành vi quan sát, đánh dấu "cần BA xác nhận" |
   | Requirement và UI mâu thuẫn | Test case viết theo requirement (hành vi đúng), ghi discrepancy; không tự hạ kỳ vọng theo UI |

4. **Chọn kỹ thuật thiết kế theo rủi ro, không theo checklist cố định:** với mỗi requirement, chỉ áp dụng kỹ thuật/loại kiểm thử phù hợp; loại không áp dụng ghi `N/A – lý do`. Bắt buộc có bước error guessing theo đặc thù dự án (bug đã biết, điểm dễ sai quan sát khi khám phá).
5. **Người viết và người review tách biệt:** Skill review chỉ đưa ra phát hiện và đề xuất; việc sửa test case do Skill tạo test case thực hiện lại.
6. **Approval Gate do con người duyệt** trước khi sinh automation và trước khi tạo bug trên tracker.
7. **Không tuyên bố 100% coverage** nếu không có số liệu từ công cụ truy vết chứng minh.
8. **An toàn khi thao tác web thật:** chỉ trên môi trường được phép; dữ liệu test có prefix nhận diện và được dọn sau khi chạy; thao tác phá hủy trên dữ liệu không do AI tạo phải được phép rõ ràng.

# 4. QUY TRÌNH SKILL DỰ KIẾN

## SKILL 01 – ĐÁNH GIÁ REQUIREMENT

- **Đầu vào:** SRS, BRD, Use Case, Business Rules, tài liệu yêu cầu khác.
- **Nhiệm vụ:** gán Requirement ID (ghi nguồn: tài liệu + số dòng/mục); phát hiện yêu cầu thiếu, mơ hồ, mâu thuẫn, không kiểm thử được; đánh giá functional/non-functional, business rule, validation, exception, permission, integration; đánh giá rủi ro từng requirement (dùng để ưu tiên ở các bước sau).
- **Đầu ra:** danh sách requirement có ID + mức rủi ro; danh sách vấn đề; câu hỏi cần BA/PO xác nhận.

## SKILL 02 – TẠO TEST CASE TỪ REQUIREMENT VÀ WEB THỰC TẾ

- **Đầu vào:** output Skill 01, URL ứng dụng, tài khoản theo role (qua `.env`).
- **Nhiệm vụ:**
  1. Khám phá web: page, form, field (bắt buộc/định dạng/độ dài), button, dropdown, modal, tab, navigation, thông báo lỗi, trạng thái giao diện, ma trận quyền theo role; nếu có API thì ghi nhận mã phản hồi với dữ liệu sai/ID không tồn tại.
  2. Lưu bằng chứng khám phá (screenshot, mô tả) gắn với requirement.
  3. Phân rã mỗi requirement thành **điều kiện kiểm thử** theo nguyên tắc 3.4.
  4. Viết test case cho mọi điều kiện, áp dụng bảng ở mục 3.3.
- **Đầu ra:** YAML test case (nguồn) + Excel sinh từ YAML + bảng truy vết requirement → điều kiện → test case + danh sách discrepancy.
- **Trường tối thiểu của test case:** TC ID, Requirement ID, Module, Feature, Scenario, Title, Test Type, Priority, Preconditions, Test Data, Steps (đánh số), Expected Result (kiểm chứng được: thông báo, giá trị, số bản ghi), Automation (Auto / Manual + lý do), Source (Requirement/UI/Both), Note (discrepancy, cần BA xác nhận).
- **Không có** Actual Result/Status ở bước này — đó là dữ liệu của Skill 05.

## SKILL 03 – REVIEW TEST CASE (ĐỘC LẬP)

- **Đầu vào:** output Skill 01, 02 và bằng chứng khám phá.
- **Nhiệm vụ:** review theo từng module/feature, không chỉ theo tổng số lượng:
  - Điều kiện nào của requirement chưa có test case; test case nào không truy vết được.
  - Với mỗi requirement: các khía cạnh liên quan (happy path, negative, alternative flow, boundary, validation, business logic, permission/role, state transition, integration, error handling, UI, data integrity, security…) đã được xét chưa, hoặc đã ghi `N/A – lý do` hợp lý chưa. Không đòi bổ sung loại không áp dụng.
  - Test case trùng; steps không rõ; expected result không đủ cụ thể để kết luận Pass/Fail; testcase gộp nhiều kiểm tra.
  - Error guessing độc lập: điểm dễ sai mà người viết bỏ sót.
- **Đầu ra:** báo cáo review; coverage matrix (requirement, business rule, UI element, test type); danh sách thiếu/trùng/cần sửa, mỗi mục có mức độ; rủi ro còn tồn tại. **Không tự sửa file** — chuyển về Skill 02.

## SKILL 04 – SINH AUTOMATION SCRIPT

- **Đầu vào:** YAML đã qua Approval Gate, cấu hình môi trường, test data, tài khoản theo role.
- **Nhiệm vụ:** Playwright + TypeScript; mỗi test gắn đúng TC ID; tái sử dụng thành phần chung, Page Object khi phù hợp; locator ổn định; assertion bám Expected Result; xử lý authentication/session (phát hiện session hết hạn để không ra PASS giả); test tự tạo và tự dọn dữ liệu; chạy được từng test case hoặc theo module.
- Test case thiếu thông tin để tự động hóa → không sinh script, đánh dấu và báo lại.

## SKILL 05 – THỰC THI VÀ BÁO CÁO

- **Đầu vào:** script, môi trường (Dev/Staging/QA), phạm vi chạy.
- **Nhiệm vụ:** kiểm tra môi trường sẵn sàng (smoke, đăng nhập được) trước khi chạy; thu log, screenshot khi lỗi, trace/video nếu bật; map kết quả về TC ID; trạng thái Passed/Failed/Blocked/Skipped; phân loại nguyên nhân lỗi: Application Defect / Automation Defect / Environment Issue / Test Data Issue, kèm bằng chứng.
- **Đầu ra:** tổng số, số theo trạng thái, pass rate, chi tiết lỗi, bằng chứng, kết quả ghi ngược vào YAML/Excel.

## SKILL 06 – LOG DEFECT VÀ RETEST (đề xuất bổ sung — hãy đánh giá có cần không)

- **Đầu vào:** các lỗi đã phân loại là Application Defect ở Skill 05.
- **Nhiệm vụ:** tìm bug trùng trên tracker trước khi tạo; soạn bug (tiêu đề, bước tái hiện, expected/actual, bằng chứng, TC ID, môi trường); **chỉ tạo sau khi con người duyệt**; khi bug được sửa, chạy lại test case liên quan và test hồi quy lân cận; cập nhật trạng thái truy vết.

# 5. CÂU HỎI CẦN ĐÁNH GIÁ

Mỗi câu hỏi dưới đây là **một phần** trong báo cáo, theo đúng thứ tự:

1. **Tính khả thi tổng thể** với bối cảnh ở mục 2: phần nào AI làm tốt, phần nào chỉ làm được một phần, phần nào cần con người.
2. **Ranh giới và trình tự các Skill:** thứ tự đã hợp lý chưa; trách nhiệm có trùng/hở không; có nên gộp/tách Skill nào; Skill 06 có cần không.
3. **Bước còn thiếu trong QA lifecycle** (ví dụ: test plan/phạm vi, chuẩn bị môi trường và dữ liệu, xử lý thay đổi requirement, regression).
4. **Khám phá web bằng AI:** giới hạn thực tế (SSO/OTP/captcha, SPA, dữ liệu động, phân quyền), cách lưu và dùng bằng chứng, rủi ro làm hỏng dữ liệu.
5. **Kết hợp requirement và UI:** bảng ở mục 3.3 có đủ và đúng không; cách tránh AI "hợp thức hóa" lỗi của UI thành expected result.
6. **Mô hình coverage và truy vết:** phân rã requirement → điều kiện → test case có phù hợp không; đo coverage thế nào cho đáng tin; công cụ kiểm tra tự động cần có.
7. **Schema YAML và Excel:** trường còn thiếu/thừa cho automation; quy ước ID; quản lý phiên bản và ổn định ID khi test case thay đổi. Đề xuất schema ở mức mô tả trường (không viết code).
8. **Input/Output contract và điều kiện bàn giao** của từng Skill, gồm kiểm tra đầu vào, xử lý lỗi, Quality Gate và Approval Gate (ai duyệt, tiêu chí đạt).
9. **Công nghệ và dependencies** cần thiết.
10. **Rủi ro bảo mật, tài khoản, dữ liệu, môi trường** và biện pháp giảm thiểu.
11. **Khả năng tái sử dụng cho nhiều dự án** và mở rộng sang API, Mobile, Database, CI/CD.
12. **Lộ trình triển khai theo giai đoạn:** giai đoạn nào làm trước để có giá trị sớm nhất, tiêu chí hoàn thành từng giai đoạn.

# 6. ĐỊNH DẠNG KẾT QUẢ

- Mở đầu bằng **tóm tắt tối đa 10 dòng**: kết luận khả thi và 3–5 vấn đề lớn nhất.
- Mỗi phần ưu tiên dùng bảng; mỗi vấn đề gắn mức **Critical / Major / Minor**, sắp xếp theo mức độ.
- Với mỗi đề xuất thay đổi: vấn đề hiện tại → đề xuất → lợi ích → ảnh hưởng tới Skill khác.
- Ghi rõ đâu là **giả định** của bạn khi bối cảnh chưa xác định.
- Không lặp lại nội dung prompt; không liệt kê lý thuyết chung không gắn với thiết kế này.
- Kết thúc bằng **danh sách quyết định tôi cần chốt** trước khi sang giai đoạn thiết kế, mỗi quyết định có phương án khuyến nghị.

# 7. RÀNG BUỘC

- Không tạo Skill, code, script, test case hay file; chỉ đánh giá và đề xuất.
- Phải chỉ ra điểm chưa hợp lý, kể cả trong các nguyên tắc ở mục 3; không đồng ý chỉ để chiều theo ý tôi.
- Mọi thay đổi kiến trúc phải có lý do.
- Ưu tiên giải pháp thực tế, triển khai được và mở rộng được.
