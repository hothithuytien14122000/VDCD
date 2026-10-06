import { test, expect, getPagedItems } from './helpers/api';

/**
 * Nhom API: SurveyResult (tag Swagger "SurveyResult") - cac test READ-ONLY.
 * File test case tuong ung: testcases/05_survey_result.yaml
 * Cac kich ban tao/sua/xoa phieu ket qua (mutation) nam o survey-result.mutation.spec.ts
 */

test.describe('SurveyResult - GET /api/v1/survey/surveys/{surveyId}/results', () => {
  async function getFirstSurveyId(authedRequest: any): Promise<string | undefined> {
    const res = await authedRequest.get('/api/v1/survey/surveys?page=1&size=1');
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    return items[0]?.id;
  }

  test('TC_SURVEYRESULT_001 - Danh sach ket qua cua 1 khao sat', async ({ authedRequest }) => {
    const surveyId = await getFirstSurveyId(authedRequest);
    test.skip(!surveyId, 'Chua co khao sat nao trong he thong');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}/results`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(getPagedItems(body))).toBe(true);
  });

  test('TC_SURVEYRESULT_003 - surveyId khong ton tai', async ({ authedRequest }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authedRequest.get(`/api/v1/survey/surveys/${fakeId}/results`);
    // Hanh vi thuc te co the la 404 (khong tim thay khao sat) hoac 200 voi danh sach rong - CAN XAC NHAN
    expect([200, 404]).toContain(res.status());
  });
});

/**
 * Bo sung cac TC con thieu trong manifest_surveyresult_read.json (15 TC, deu READ-ONLY).
 * Du lieu test (khao sat/ket qua cu the) duoc TRUY VAN DONG tu he thong that tai thoi diem
 * chay test (khong hardcode UUID) vi khong the tu tao an toan mot khao sat o trang thai
 * "Dang dien ra" / co san ket qua thong qua API (xem AGENT_GUIDELINES.md). Neu khong tim thay
 * du lieu phu hop, test se tu `test.skip(...)` kem ly do cu the thay vi gia lap du lieu.
 */

/** Lay toan bo khao sat hien co (1 trang du lon) de do tim du lieu phu hop cho tung TC. */
async function getAllSurveys(authedRequest: any): Promise<any[]> {
  const res = await authedRequest.get('/api/v1/survey/surveys?page=1&size=200');
  const body = await res.json();
  return getPagedItems(body);
}

/**
 * Tuong duong `getFirstSurveyId` da khai bao trong describe block phia tren, nhung dinh nghia lai
 * o pham vi module de dung chung cho 2 describe block moi ben duoi (khong sua ham cu de tranh dung
 * cham voi pham vi duoc giao).
 */
async function getAnySurveyId(authedRequest: any): Promise<string | undefined> {
  const surveys = await getAllSurveys(authedRequest);
  return surveys[0]?.id;
}

/** Khao sat dau tien co it nhat 1 ket qua (resultCount > 0). */
async function findSurveyWithResults(authedRequest: any): Promise<any | undefined> {
  const surveys = await getAllSurveys(authedRequest);
  return surveys.find((s: any) => (s.resultCount ?? 0) > 0);
}

/** Khao sat chua co ket qua nao - uu tien status=3 (Da phe duyet) dung nhu precondition cua TC_BV_001. */
async function findSurveyWithoutResults(authedRequest: any): Promise<any | undefined> {
  const surveys = await getAllSurveys(authedRequest);
  return surveys.find((s: any) => (s.resultCount ?? 0) === 0 && s.status === 3)
    ?? surveys.find((s: any) => (s.resultCount ?? 0) === 0);
}

/** Tim 1 khao sat (trong so cac khao sat co ket qua) co it nhat 1 phieu voi `method` cho truoc. */
async function findSurveyWithMethodResult(
  authedRequest: any,
  method: number,
): Promise<{ survey: any; result: any } | undefined> {
  const surveys = (await getAllSurveys(authedRequest)).filter((s: any) => (s.resultCount ?? 0) > 0);
  for (const survey of surveys) {
    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey.id}/results?page=1&size=100`);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    const match = items.find((r: any) => r.method === method);
    if (match) return { survey, result: match };
  }
  return undefined;
}

/** Tim 1 khao sat (trong so cac khao sat co ket qua) ma danh sach ket qua co DU ca cac method yeu cau. */
async function findSurveyWithAllMethods(authedRequest: any, requiredMethods: number[]): Promise<any | undefined> {
  const surveys = (await getAllSurveys(authedRequest)).filter((s: any) => (s.resultCount ?? 0) > 0);
  for (const survey of surveys) {
    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey.id}/results?page=1&size=500`);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    const methods = new Set(items.map((r: any) => r.method));
    if (requiredMethods.every((m) => methods.has(m))) return survey;
  }
  return undefined;
}

/** Tim 2 khao sat KHAC NHAU deu co ket qua, tra ve 1 phieu cu the cua khao sat A de test IDOR. */
async function findTwoSurveysWithResults(
  authedRequest: any,
): Promise<{ surveyA: any; resultA: any; surveyB: any } | undefined> {
  const surveys = (await getAllSurveys(authedRequest)).filter((s: any) => (s.resultCount ?? 0) > 0);
  if (surveys.length < 2) return undefined;
  const [surveyA, surveyB] = surveys;
  const res = await authedRequest.get(`/api/v1/survey/surveys/${surveyA.id}/results?page=1&size=1`);
  const body = await res.json();
  const resultA = getPagedItems(body)[0];
  if (!resultA) return undefined;
  return { surveyA, resultA, surveyB };
}

/** Cac truong co the lo thong tin dinh danh ca nhan neu API vo tinh tra ve (phieu Truc tuyen la an danh). */
const PII_KEYS = [
  'fullName', 'fullname', 'name', 'citizenName', 'phone', 'phoneNumber', 'email',
  'ipAddress', 'ip', 'citizenId', 'identityNumber', 'idNumber', 'address',
];

/*
 * Ghi chu ve cach gom nhom test ben duoi: moi test() trong fixture `authedRequest` tao va huy 1
 * APIRequestContext rieng (xem tests/helpers/api.ts). Khi chay nhieu chuc test lien tiep tren may
 * Windows, playwright.config.ts dang bat `trace: 'retain-on-failure'`, va qua trinh ghi/don trace
 * cho nhieu context duoc tao/huy lien tuc thinh thoang gay loi FLAKY khong lien quan toi logic test
 * (`ENOENT ... traces\...recording*.network` ngay trong `context.dispose()`, xay ra ngau nhien tren
 * CAC TEST KHAC NHAU moi lan chay - da kiem chung bang cach chay lai nhieu lan va bang co `--trace=off`
 * thi het flaky). Day la van de moi truong/cau hinh (playwright.config.ts, helpers/api.ts) nam NGOAI
 * pham vi duoc phep sua cua file nay. De giam xac suat gap flaky nay (ti le loi ty le thuan voi so
 * luong context duoc tao), cac TC co CUNG 1 kieu du lieu tien dieu kien duoc GOM vao chung 1 test()
 * (dung nhu AGENT_GUIDELINES.md cho phep), MIEN LA moi TC van co it nhat 1 cau lenh goi API + 1
 * assertion rieng, co comment chi ro doan nao ung voi TC nao.
 */

test.describe('SurveyResult - GET /api/v1/survey/surveys/{surveyId}/results (bo sung)', () => {
  test('TC_SURVEYRESULT_002 - Loc theo method, phan trang, sap xep theo thoi gian tao giam dan', async ({ authedRequest }) => {
    const match = await findSurveyWithMethodResult(authedRequest, 2);
    test.skip(!match, 'Khong tim thay khao sat nao co ket qua voi method=2 (Truc tiep) tren he thong hien tai');

    // Ghi chu quan trong (da kiem chung thu cong bang curl): cu phap sort "createdOnDate desc" (co
    // dau cach, giong vi du trong manifest) KHONG duoc server ap dung - truyen "asc" hay "desc" déu
    // cho ra cung 1 thu tu (khong doi). Cu phap THUC SU hoat dong la "-createdOnDate" (giam dan) /
    // "createdOnDate" (tang dan). Dung dung cu phap nay de test phan anh dung kha nang that cua API,
    // thay vi fail oan vi sai cu phap (khong phai loi logic server).
    const filter = encodeURIComponent(JSON.stringify({ method: 2 }));
    const res = await authedRequest.get(
      `/api/v1/survey/surveys/${match!.survey.id}/results?page=1&size=10&filter=${filter}&sort=-createdOnDate`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    expect(items.length).toBeLessThanOrEqual(10);
    for (const item of items) {
      expect(item.method).toBe(2);
    }
    const dates = items.map((i: any) => new Date(i.createdOnDate).getTime());
    const sortedDesc = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sortedDesc);
  });

  test('TC_SURVEYRESULT_002b, DC_001 - Loc theo khoang ngay (CAN XAC NHAN ten truong) va doi chieu resultCount', async ({ authedRequest }) => {
    const survey = await findSurveyWithResults(authedRequest);
    test.skip(!survey, 'Chua co khao sat nao co ket qua tren he thong hien tai');

    // --- TC_SURVEYRESULT_002b ---
    const filter = encodeURIComponent(JSON.stringify({ fromDate: '2026-10-01', toDate: '2026-10-31' }));
    const dateFilterRes = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results?filter=${filter}`);
    // CAN XAC NHAN: Swagger khong liet ke ten truong filter ngay thang. Da kiem chung thu cong: server
    // KHONG bao loi (200) nhung tong so ban ghi tra ve KHONG doi so voi khi khong co filter nay - tuc
    // la fromDate/toDate (hoac dung ten nay) hien KHONG duoc server ap dung de loc. Vi hanh vi chua
    // duoc dev xac nhan, chi khang dinh KHONG crash va cau truc phan trang van hop le.
    expect(dateFilterRes.status()).toBe(200);
    const dateFilterBody = await dateFilterRes.json();
    expect(Array.isArray(getPagedItems(dateFilterBody))).toBe(true);

    // --- TC_SURVEYRESULT_DC_001 ---
    const detailRes = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}`);
    expect(detailRes.status()).toBe(200);
    const detailBody = await detailRes.json();
    const resultCount = (detailBody.data ?? detailBody).resultCount;
    expect(typeof resultCount).toBe('number');

    const listRes = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results?page=1&size=1`);
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.totalElements).toBe(resultCount);
  });

  test('TC_SURVEYRESULT_002c - Danh sach ket qua gom du ca 3 loai method (1,2,3)', async ({ authedRequest }) => {
    const survey = await findSurveyWithAllMethods(authedRequest, [1, 2, 3]);
    test.skip(
      !survey,
      'Khong tim thay khao sat nao tren he thong hien tai co ket qua voi du ca 3 method (1=Truc tuyen, '
      + '2=Truc tiep, 3=Gian tiep qua phieu) cung luc - khong the tu tao du lieu nay mot cach an toan',
    );
    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results?page=1&size=500`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    const methods = new Set(items.map((i: any) => i.method));
    expect(methods.has(1)).toBe(true);
    expect(methods.has(2)).toBe(true);
    expect(methods.has(3)).toBe(true);
  });

  test('TC_SURVEYRESULT_BV_001 - Khao sat chua co ket qua nao (danh sach rong)', async ({ authedRequest }) => {
    const survey = await findSurveyWithoutResults(authedRequest);
    test.skip(!survey, 'Khong tim thay khao sat nao co resultCount=0 tren he thong hien tai');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(getPagedItems(body)).toEqual([]);
    expect(body.data.totalElements).toBe(0);
  });

  test('TC_SURVEYRESULT_BV_002 - size=-1 va size qua lon: khong duoc gay loi 500', async ({ authedRequest }) => {
    const survey = await findSurveyWithResults(authedRequest);
    test.skip(!survey, 'Chua co khao sat nao co ket qua tren he thong hien tai');

    const resNeg = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results?page=1&size=-1`);
    expect(resNeg.status()).not.toBe(500);
    expect([200, 400]).toContain(resNeg.status());

    const resBig = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results?page=1&size=100000`);
    expect(resBig.status()).not.toBe(500);
    expect([200, 400]).toContain(resBig.status());
    if (resBig.status() === 200) {
      const bigBody = await resBig.json();
      // Server phai tu gioi han so ban ghi thuc te tra ve theo du lieu that co, khong duoc crash.
      expect(getPagedItems(bigBody).length).toBe(bigBody.data.totalElements);
    }
  });

  test('TC_SURVEYRESULT_BV_002 (page=0) - BUG THAT: server tra ve 500 thay vi 400/tu dieu chinh', async ({ authedRequest }) => {
    const survey = await findSurveyWithResults(authedRequest);
    test.skip(!survey, 'Chua co khao sat nao co ket qua tren he thong hien tai');

    // Da kiem chung thu cong bang curl: GET .../results?page=0&size=10 tra ve HTTP 500 kem stack trace
    // day du cua Npgsql ("22023: OFFSET must not be negative") - day la LOI THAT cua server (tra ve
    // 500 thay vi 400/tu dieu chinh nhu manifest yeu cau, dong thoi lo ca stack trace noi bo - rui ro
    // bao mat nho). Dung test.fail() de GHI NHAN bug nay (test duoc chay, duoc ky vong la FAIL) ma
    // khong lam do toan bo suite; neu sau nay server duoc fix, test nay se bao "unexpected pass" de
    // nhac cap nhat lai assertion.
    test.fail();
    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results?page=0&size=10`);
    expect(res.status()).not.toBe(500);
  });

  test('TC_SURVEYRESULT_003b - filter JSON khong hop le => 400 Bad Request', async ({ authedRequest }) => {
    const surveyId = await getAnySurveyId(authedRequest);
    test.skip(!surveyId, 'Chua co khao sat nao trong he thong');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}/results?filter=%7Bloi-json`);
    expect(res.status()).toBe(400);
  });

  test('TC_SURVEYRESULT_SEC_001 - [Security] Khong co token => 401 Unauthorized', async ({ playwright, baseURL, authedRequest }) => {
    const surveyId = await getAnySurveyId(authedRequest);
    test.skip(!surveyId, 'Chua co khao sat nao trong he thong');

    const anonCtx = await playwright.request.newContext({ baseURL });
    const res = await anonCtx.get(`/api/v1/survey/surveys/${surveyId}/results`);
    expect(res.status()).toBe(401);
    await anonCtx.dispose();
  });

  test('TC_SURVEYRESULT_SEC_002 - [Security/Privacy] Phieu Truc tuyen khong lo thong tin dinh danh nguoi gui', async ({ authedRequest }) => {
    const match = await findSurveyWithMethodResult(authedRequest, 1);
    test.skip(!match, 'Khong tim thay khao sat nao co ket qua voi method=1 (Truc tuyen) tren he thong hien tai');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${match!.survey.id}/results?page=1&size=100`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const onlineItems = getPagedItems(body).filter((i: any) => i.method === 1);
    expect(onlineItems.length).toBeGreaterThan(0);
    for (const item of onlineItems) {
      for (const key of PII_KEYS) {
        expect(item).not.toHaveProperty(key);
      }
    }
  });

  test('TC_SURVEYRESULT_BV_003 - [BUG dung chung] Sort nhieu truong tang-roi-giam cung gay 500 nhu GET /surveys', async ({
    authedRequest,
  }) => {
    const survey = await findSurveyWithResults(authedRequest);
    test.skip(!survey, 'Chua co khao sat nao co ket qua tren he thong hien tai');

    // Xac nhan bug TC_SURVEY_008b LAP LAI tren endpoint nay - cung 1 ham backend dung chung
    // (ApplySorting/GeneatThenByDescending) cho tat ca endpoint co tham so sort.
    test.fail(true, 'BUG dung chung voi TC_SURVEY_008b: sort="tang dan,-giam dan" gay loi 500');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results?sort=method,-createdOnDate`);
    expect(res.status(), 'khong duoc gay loi 500').not.toBe(500);
  });
});

test.describe('SurveyResult - GET /api/v1/survey/surveys/{surveyId}/results/{id} (bo sung)', () => {
  test('TC_SURVEYRESULT_008b, SEC_021 - Chi tiet 1 phieu Truc tuyen (method=1), khong lo thong tin dinh danh', async ({ authedRequest }) => {
    const match = await findSurveyWithMethodResult(authedRequest, 1);
    test.skip(!match, 'Khong tim thay phieu nao co method=1 (Truc tuyen) tren he thong hien tai');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${match!.survey.id}/results/${match!.result.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body.data ?? body;

    // --- TC_SURVEYRESULT_008b ---
    expect(data.id).toBe(match!.result.id);
    expect(data.method).toBe(1);

    // --- TC_SURVEYRESULT_SEC_021 ---
    for (const key of PII_KEYS) {
      expect(data).not.toHaveProperty(key);
    }
  });

  test('TC_SURVEYRESULT_009, 009c - Id ket qua khong ton tai / sai dinh dang => 404 Not Found', async ({ authedRequest }) => {
    const surveyId = await getAnySurveyId(authedRequest);
    test.skip(!surveyId, 'Chua co khao sat nao trong he thong');

    // --- TC_SURVEYRESULT_009: id dung dinh dang uuid nhung khong ton tai ---
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const resFake = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}/results/${fakeId}`);
    expect(resFake.status()).toBe(404);

    // --- TC_SURVEYRESULT_009c: id sai dinh dang (khong phai uuid) ---
    const resBadFormat = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}/results/abc-khong-phai-uuid`);
    expect(resBadFormat.status()).toBe(404);
  });

  test('TC_SURVEYRESULT_009b - Id ket qua ton tai nhung thuoc 1 khao sat KHAC (IDOR)', async ({ authedRequest }) => {
    const pair = await findTwoSurveysWithResults(authedRequest);
    test.skip(!pair, 'Khong tim thay 2 khao sat khac nhau deu co ket qua tren he thong hien tai de test IDOR');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${pair!.surveyB.id}/results/${pair!.resultA.id}`);
    // Khong duoc tra ve du lieu phieu khi surveyId trong URL khong khop voi khao sat thuc su cua phieu do.
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYRESULT_SEC_020 - [Security] Khong co token => 401 Unauthorized', async ({ playwright, baseURL, authedRequest }) => {
    const survey = await findSurveyWithResults(authedRequest);
    test.skip(!survey, 'Chua co khao sat nao co ket qua tren he thong hien tai');
    const listRes = await authedRequest.get(`/api/v1/survey/surveys/${survey!.id}/results?page=1&size=1`);
    const listBody = await listRes.json();
    const resultId = getPagedItems(listBody)[0]?.id;
    test.skip(!resultId, 'Khong lay duoc id ket qua cu the de test');

    const anonCtx = await playwright.request.newContext({ baseURL });
    const res = await anonCtx.get(`/api/v1/survey/surveys/${survey!.id}/results/${resultId}`);
    expect(res.status()).toBe(401);
    await anonCtx.dispose();
  });
});
