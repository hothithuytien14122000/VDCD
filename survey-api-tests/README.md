# Bo test API - Phan he Khao sat muc do hai long cua nguoi dan

Bo test case (YAML, tieng Viet) va script tu dong hoa (Playwright) de kiem thu cac API
thuoc phan he **E. Khao sat muc do hai long cua nguoi dan** (UC-E.1 → UC-E.6), server:
`https://cds.geneat.pro` (Swagger: `/swagger/index.html#/Survey`).

## Cau truc thu muc

```
survey-api-tests/
├── testcases/                  # Test case design (YAML, tieng Viet) - 1 FOLDER / nhom API (tag),
│   │                           # 1 FILE / endpoint, nhu swagger hien thi
│   ├── Survey/                 # 9 endpoint quan ly khao sat (UC-E.1, UC-E.2, UC-E.3)
│   │   ├── 01_get_surveys.yaml
│   │   ├── 02_post_surveys.yaml
│   │   ├── 03_get_surveys_counts.yaml
│   │   ├── 04_get_surveys_entry.yaml
│   │   ├── 05_get_surveys_entry_count.yaml
│   │   ├── 06_get_surveys_by_id.yaml
│   │   ├── 07_put_surveys_by_id.yaml
│   │   ├── 08_delete_surveys_by_id.yaml
│   │   └── 09_put_surveys_by_id_status.yaml
│   ├── SurveyForm/              # 1 endpoint tai mau phieu (.doc)
│   │   └── 01_get_surveys_by_id_form_template.yaml
│   ├── SurveyPublic/            # 3 endpoint cong khai cho nguoi dan (UC-E.4)
│   │   ├── 01_get_public_surveys.yaml
│   │   ├── 02_get_public_surveys_by_id.yaml
│   │   └── 03_post_public_surveys_by_id_responses.yaml
│   ├── SurveyReport/            # 5 endpoint bao cao/tong ket (UC-E.5)
│   │   ├── 01_get_surveys_finished.yaml
│   │   ├── 02_get_surveys_finished_export.yaml
│   │   ├── 03_get_surveys_finished_by_id.yaml
│   │   ├── 04_get_surveys_finished_by_id_comments.yaml
│   │   └── 05_get_surveys_finished_by_id_export.yaml
│   └── SurveyResult/            # 5 endpoint ghi nhan ket qua thu cong (UC-E.6)
│       ├── 01_get_results.yaml
│       ├── 02_post_results.yaml
│       ├── 03_get_result_by_id.yaml
│       ├── 04_put_result_by_id.yaml
│       └── 05_delete_result_by_id.yaml
│
├── tests/                       # Script Playwright thuc thi mot phan cac test case tren
│   ├── helpers/api.ts            # Fixture dung chung (auth header, bien moi truong)
│   ├── survey.spec.ts            # Survey - READ-ONLY (an toan, chay bat ky luc nao)
│   ├── survey.mutation.spec.ts   # Survey - CO THAY DOI DU LIEU (gate boi RUN_MUTATION_TESTS)
│   ├── survey-form.spec.ts       # SurveyForm - READ-ONLY
│   ├── survey-public.spec.ts     # SurveyPublic - READ-ONLY
│   ├── survey-report.spec.ts     # SurveyReport - READ-ONLY
│   ├── survey-result.spec.ts     # SurveyResult - READ-ONLY
│   └── survey-result.mutation.spec.ts # SurveyResult - CO THAY DOI DU LIEU
│
├── .env                          # Cau hinh that (KHONG commit) - token, base URL, organizationId
├── .env.example                  # Mau de sao chep
├── playwright.config.ts
└── package.json
```

Moi file YAML trong `testcases/` la **tai lieu test case** (title, precondition, step, ket qua
mong doi) co the dung doc thu cong hoac doi chieu voi script tu dong. Moi test case co dinh dang:

```yaml
- id: TC_SURVEY_001
  title: Lay danh sach khao sat - khong truyen tham so (mac dinh)
  priority: Cao
  category: Happy path
  preconditions: [...]
  steps: [...]
  expected_result: [...]
```

**Tong cong 279 test case** tren 23 endpoint (trung binh ~12 test case/endpoint), duoc phan loai
qua truong `category` de de loc/thong ke theo loai kiem thu:

| category | Y nghia |
|---|---|
| Happy path | Luong hoat dong dung, du lieu hop le |
| Boundary | Gia tri bien (do dai toi da/toi thieu, so 0/am/rat lon, phan trang bat thuong...) |
| Negative | Du lieu khong hop le, thieu truong bat buoc, sai dinh dang, sai quy tac nghiep vu |
| Security | Khong token/token sai, SQL injection, XSS, IDOR, phan quyen theo role/don vi |
| Idempotency | Goi lai cung 1 request (vi du DELETE 2 lan) phai cho ket qua nhat quan |
| Concurrency | Nhieu request dong thoi tren cung 1 tai nguyen (race condition) |
| Data consistency | Doi chieu so lieu giua nhieu API (vi du counts vs danh sach, resultCount vs participants) |

Cac test case lien quan toi POST/PUT/DELETE (tao/sua/xoa du lieu that) duoc danh dau
`tags: [mutation]` va tieu de co tien to `[Mutation]`. Nhieu test case (danh dau "CAN XAC NHAN"
trong expected_result) mo ta hanh vi ky vong theo logic thong thuong nhung CHUA duoc kiem chung
tren moi truong that (vi du can tai khoan voi role khac, hoac du lieu dac thu chua co san) - nhom
QA/dev nen doi chieu lai cac muc nay khi co du dieu kien.

## Cai dat

```bash
cd survey-api-tests
npm install
cp .env.example .env     # roi dien AUTH_TOKEN va TEST_ORGANIZATION_ID that vao .env
```

`.env` da duoc tao san voi token QA Super Admin ban cung cap va 1 `TEST_ORGANIZATION_ID` mau
(lay tu du lieu that tren he thong). Token JWT co thoi han, can thay the khi het han.

## Chay test

```bash
npm run test:readonly   # Chi chay cac test KHONG doi du lieu (GET) - an toan, chay bat ky luc nao
npm run test:mutation    # Chay CA cac test co tao/sua/xoa du lieu that (RUN_MUTATION_TESTS=true)
npm test                 # Chay toan bo (mac dinh mutation se bi skip neu RUN_MUTATION_TESTS=false)
npm run report           # Mo bao cao HTML cua lan chay gan nhat
```

Moi test case mutation tu tao du lieu rieng (ten co tien to `[Auto-test]`) va tu xoa
(`afterEach`) sau khi chay xong de khong de lai rac tren he thong.

**Do phu (coverage) cua script tu dong - so lieu cuoi cung (kiem tra lai ngay 2026-10-06)**:

| | So luong |
|---|---|
| Tong so test case (YAML/Excel) | 279 |
| **Co script Playwright tu dong hoa** | **266** |
| **Khong the tu dong hoa (xem ly do ben duoi)** | **13** |

Ket qua thuc thi (chay lai toan bo tren server that ngay 2026-10-06):

| Bo test | So test() | PASS | SKIPPED | FAILED |
|---|---|---|---|---|
| Read-only (`survey.spec.ts`, `survey-form.spec.ts`, `survey-public.spec.ts`, `survey-report.spec.ts`, `survey-result.spec.ts`) | 154 | 138 | 16 | **0** |
| Mutation (`survey.mutation.spec.ts`, `survey-result.mutation.spec.ts`, can `RUN_MUTATION_TESTS=true`) | 74 | 61 | 13 | **0** |
| **Tong** | **228** | **199** | **29** | **0** |

(1 test() co the cover nhieu TC ID gan giong nhau gop chung - vi vay 228 test() the hien duoc
266 TC ID). Tat ca cac truong hop SKIPPED deu co ly do cu the ghi trong code (vi du: khao sat
khong tu chuyen sang "Dang dien ra" - xem phat hien #4 ben duoi), **khong phai test loi**.

**13 test case khong the tu dong hoa duoc voi 1 token SUPER_ADMIN hien co**:
- **7 test case** can tai khoan voi role/quyen han KHAC de kiem tra phan quyen (vi du "tai khoan
  Can bo khong duoc phe duyet", "tai khoan bi gioi han theo don vi khac"): `TC_SURVEY_SEC_012,
  DC_030, SEC_031, SEC_041, SEC_051, SEC_052, TC_SURVEYFORM_004b`.
- **3 test case** can `captchaToken` THAT SU hop le (lay tu dich vu captcha phia giao dien, khong
  the gia lap bang API request thuan): `TC_SURVEYPUBLIC_005b, 005d, 007b`.
- **1 test case** co chu dich khong tu dong hoa vi can gui spam hang loat request toi server that
  de kiem tra rate-limit (`TC_SURVEYPUBLIC_SEC_021`) - khong nen lam dieu nay tren moi truong
  dang co nguoi khac su dung.
- **2 test case** can mo file Excel xuat ra bang tay de doi chieu tung dong/cot chi tiet
  (`TC_SURVEYREPORT_011b, 011c`) - script moi kiem tra duoc status code/Content-Type, chua parse
  noi dung file (can them thu vien doc .xlsx, ngoai pham vi hien tai).

## Cac phat hien quan trong khi kiem thu tren moi truong that (cds.geneat.pro)

### Bug that su (server tra ve loi 500 / hanh vi sai) - CAN BAO CHO DEV BACKEND

1. 🔴 **`GET /api/v1/survey/surveys?page=0`** (va `page=-1`) **tra ve HTTP 500**
   (`Npgsql.PostgresException: 22023: OFFSET must not be negative`) thay vi tu dong coi
   nhu page=1 hoac tra ve 400 Bad Request nhu thong le. Loi nay LAP LAI giong het tren
   **`GET /survey/surveys/{surveyId}/results?page=0`** va **`GET /survey/surveys/finished?page=0`**
   → la loi dung chung trong 1 lop phan trang (pagination) duoc tai su dung o nhieu endpoint,
   nen sua 1 cho co the het loi o ca 3 noi. Response con lo nguyen stack trace Postgres (ro ri
   thong tin ha tang - van de bao mat nho).
2. 🔴 **`GET /api/v1/survey/surveys?sort=status,-startDate`** (sap xep nhieu truong cung luc)
   **tra ve HTTP 500** (`System.InvalidOperationException` tu LINQ `ThenByDescending` - khong
   tim thay overload phu hop trong helper sap xep phia backend).
3. 🔴 **`GET /api/v1/survey/surveys/finished?filter={"year":-1}`** (hoac cac gia tri nam cuc
   tri khac) **tra ve HTTP 500** (`System.ArgumentOutOfRangeException` khi dung the hien
   `DateTime` khong hop le), trong khi `filter={"year":"abc"}` (sai kieu du lieu) van tra ve
   400 Bad Request dung nhu ky vong - cho thay thieu validate rieng cho gia tri nam qua lon/am.
4. 🟡 **Filter `{"submitted":true}` tren `GET /api/v1/survey/surveys` KHONG co tac dung loc** -
   danh sach tra ve (va `totalElements`) giong het khi khong loc, van lan ca khao sat status=1
   (Nhap). Trong khi do `GET /survey/surveys/counts` lai tu tinh rieng ra 1 gia tri `submitted`
   khac (va DUNG - khop voi dinh nghia "khac Nhap"). Hai endpoint dang KHONG NHAT QUAN voi nhau
   cho cung 1 khai niem nghiep vu.
5. 🟡 **Cu phap tham so `sort` khac voi tai lieu/truc giac**: cu phap "ten_truong desc"/"ten_truong asc"
   (co khoang trang, giong SQL) bi **am tham bo qua** (van tra ve 200 nhung khong sap xep gi ca,
   khong bao loi). Cu phap THUC SU hoat dong (xac nhan qua thuc nghiem): tien to `-` = giam dan,
   khong tien to (hoac `+`) = tang dan - vi du `sort=-startDate`. Nen cap nhat lai tai lieu API
   cho dung voi thuc te, hoac sua backend de bao loi 400 khi cu phap khong nhan dang duoc thay vi
   im lang bo qua.

### Hanh vi da xac nhan (khac hoac chi tiet hon mo ta trong Swagger)

6. **organizationId thuc te la bat buoc** khi tao khao sat (POST `/api/v1/survey/surveys`),
   du trong schema Swagger truong nay khong nam trong danh sach `required`. Neu bo trong hoac
   truyen uuid khong hop le, API tra ve `400` voi message
   `"Đơn vị không tồn tại hoặc không được phép sử dụng"`.
7. **Enum da duoc xac nhan chinh xac** tu du lieu that (truoc day chi suy luan tu tai lieu UC-E):
   - `SurveyStatus`: 1 = Nháp, 2 = Chờ phê duyệt, 3 = Đã phê duyệt, 4 = Bị từ chối,
     5 = Đang diễn ra, 6 = Đã kết thúc
   - `SurveyMethod`: 1 = Trực tuyến, 2 = Trực tiếp, 3 = Gián tiếp qua phiếu
8. **Dinh dang response phan trang thuc te**:
   `{ data: { page, size, totalPages, totalElements, numberOfElements, content: [...] }, code, message, isSuccess }`
   (khong phai `items` nhu suy doan ban dau tu ten truong thong thuong).
9. **Khao sat KHONG tu dong chuyen sang "Dang dien ra" (status=5) ngay lap tuc** sau khi duoc
   phe duyet, du `startDate` da o trong qua khu. Da kiem chung: tao + phe duyet 1 khao sat voi
   `startDate` = 1 gio truoc, GET lai ngay sau do van thay `status=3` (Da phe duyet). Vi vay phan
   lon test case mutation cua nhom **SurveyResult** (ghi nhan/sua/xoa ket qua) tu dong bi **skip**
   tren moi truong hien tai kem thong bao ro rang, thay vi bao fail sai - can hoi dev nhom
   backend co co che/tien trinh nen nao chuyen trang thai theo thoi gian hay khong, va chu ky
   chay cua no la bao lau, de co the cho hoac kich hoat thu cong khi kiem thu. **Day co the la
   mot bug thuc su** (neu khong co co che nao ca, khao sat se khong bao gio vao duoc trang thai
   "Dang dien ra" de nguoi dan thuc hien khao sat) chu khong chi la han che moi truong test.
10. **File "form-template"** (`GET /survey/surveys/{id}/form-template`) thuc chat la file HTML
    duoc danh lua voi `Content-Type: application/msword` (ky thuat "Word HTML") - Word van mo
    duoc binh thuong nhung day khong phai file .docx that.

## Gioi han da biet

- 13 test case khong tu dong hoa duoc - xem danh sach chi tiet va ly do o muc "Do phu cua script
  tu dong" ben tren (can tai khoan role khac, can captcha that, hoac can mo file thu cong).
- Mot vai ky vong ve ma loi (400 vs 404 vs 409) cho cac rang buoc nghiep vu chua duoc Swagger
  mo ta ro (vi du: xoa khao sat dang co ket qua, sua ket qua khi khao sat da ket thuc...) duoc
  ghi chu `CAN XAC NHAN` trong file YAML tuong ung, va trong code bang assertion chap nhan nhieu
  ma loi hop le (vi du `expect([400, 409]).toContain(...)`) - can doi chieu lai voi nhom phat trien
  de chot 1 gia tri chinh xac.
- File `testcases_export.xlsx` (Excel tong hop 279 test case theo nhom API) duoc sinh tu cac file
  YAML goc bang 2 script trong `scripts/` (`export_json.js` + `build_xlsx.py`) - chay lai ca 2 khi
  sua YAML de dong bo lai file Excel. File nay la **tai lieu test case**, khong phan anh ket qua
  automation (cot "STATUS KHI RUN TEST" trong Excel de trong cho QA dien thu cong).
