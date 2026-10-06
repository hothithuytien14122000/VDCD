import { test, expect, getPagedItems } from './helpers/api';

/**
 * Nhom API: SurveyReport (tag Swagger "SurveyReport")
 * File test case tuong ung: testcases/04_survey_report.yaml
 *
 * Toan bo la READ-ONLY (GET), an toan de chay bat ky luc nao.
 */

test.describe('SurveyReport - GET /api/v1/survey/surveys/finished', () => {
  test('TC_SURVEYREPORT_001 - Danh sach khao sat da hoan thanh', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    // Danh sach nay chi gom khao sat da ket thuc nen khong co truong status rieng,
    // nhung phai co du so lieu thong ke: participants, satisfied, unsatisfied, satisfiedRate
    for (const item of items) {
      expect(typeof item.participants).toBe('number');
      expect(typeof item.satisfied).toBe('number');
      expect(typeof item.unsatisfied).toBe('number');
      expect(item.satisfied + item.unsatisfied).toBeLessThanOrEqual(item.participants);
    }
  });

  test('TC_SURVEYREPORT_004 - Khong co ket qua phu hop filter => danh sach rong', async ({ authedRequest }) => {
    const filter = encodeURIComponent(JSON.stringify({ keyword: 'tu-khoa-khong-ton-tai-xyz' }));
    const res = await authedRequest.get(`/api/v1/survey/surveys/finished?filter=${filter}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    expect(items.length).toBe(0);
  });

  test('TC_SURVEYREPORT_001b - satisfiedRate + unsatisfiedRate xap xi 100%', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=50');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    const withParticipants = items.filter((it) => it.participants > 0);
    test.skip(withParticipants.length === 0, 'Khong co khao sat nao co participants > 0 de kiem tra ty le');
    for (const item of withParticipants) {
      const sum = item.satisfiedRate + item.unsatisfiedRate;
      // Sai so cho phep do lam tron (+-0.5 de an toan voi nhieu kieu lam tron khac nhau)
      expect(sum).toBeGreaterThanOrEqual(99.5);
      expect(sum).toBeLessThanOrEqual(100.5);
    }
  });

  test('TC_SURVEYREPORT_002 - Loc danh sach theo keyword/year/organizationId', async ({ authedRequest }) => {
    // Dung chinh 1 ban ghi that de dam bao filter khop du lieu hien co (tranh phu thuoc du lieu gia dinh)
    const listRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=1');
    const sample = getPagedItems(await listRes.json())[0];
    test.skip(!sample, 'He thong chua co khao sat nao da hoan thanh de kiem tra filter');

    const year = new Date(sample.startDate).getFullYear();
    const filter = encodeURIComponent(
      JSON.stringify({ keyword: sample.code, year, organizationId: sample.organizationId })
    );
    const res = await authedRequest.get(`/api/v1/survey/surveys/finished?filter=${filter}`);
    expect(res.status()).toBe(200);
    const items: any[] = getPagedItems(await res.json());
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((it) => it.code === sample.code)).toBe(true);
    for (const item of items) {
      expect(item.organizationId).toBe(sample.organizationId);
      expect(new Date(item.startDate).getFullYear()).toBe(year);
    }
  });

  test('TC_SURVEYREPORT_003 - Phan trang page=1&size=5', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=5');
    expect(res.status()).toBe(200);
    const items: any[] = getPagedItems(await res.json());
    expect(items.length).toBeLessThanOrEqual(5);
  });

  test('TC_SURVEYREPORT_003b - Sap xep danh sach theo satisfiedRate desc', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished?sort=satisfiedRate desc');
    // CAN XAC NHAN: truong tinh toan (satisfiedRate) co the khong duoc he thong ho tro sort
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const items: any[] = getPagedItems(await res.json());
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].satisfiedRate).toBeGreaterThanOrEqual(items[i].satisfiedRate);
      }
    }
  });

  test('TC_SURVEYREPORT_004b - filter voi year khong hop le (chuoi / so am)', async ({ authedRequest }) => {
    const resStr = await authedRequest.get(
      `/api/v1/survey/surveys/finished?filter=${encodeURIComponent(JSON.stringify({ year: 'abc' }))}`
    );
    expect(resStr.status()).toBe(400);

    // Nam am: BUG DA XAC NHAN tren server that - tra ve 500 (System.DateTime "un-representable
    // DateTime") thay vi 400 Bad Request. Dung test.fail() de theo doi ma khong chan ca suite;
    // neu dev fix, Playwright se bao "did not fail as expected" de nhac cap nhat lai assertion.
    test.fail(
      true,
      'BUG: filter year am (vi du -1) gay loi 500 (System.DateTime un-representable DateTime) thay vi tra ve 400 - can dev fix validate dau vao'
    );
    const resNeg = await authedRequest.get(
      `/api/v1/survey/surveys/finished?filter=${encodeURIComponent(JSON.stringify({ year: -1 }))}`
    );
    expect(resNeg.status()).toBe(400);
  });

  test('TC_SURVEYREPORT_004c - filter voi JSON khong hop le', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished?filter={json-loi');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.isSuccess).toBe(false);
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });

  test('TC_SURVEYREPORT_BV_001 - page/size bat thuong (page=0, size am, size qua lon)', async ({ authedRequest }) => {
    // page=0: BUG DA XAC NHAN tren server that (giong het loi cua GET /survey/surveys) - Npgsql
    // "OFFSET must not be negative" => 500. Dung test.fail() de theo doi ma khong chan ca suite;
    // neu dev fix, test nay se bao "did not fail as expected" de nhac cap nhat lai assertion.
    test.fail(
      true,
      'BUG: page=0 gay loi 500 (Npgsql "OFFSET must not be negative") - loi dung chung voi GET /survey/surveys, can dev fix'
    );

    const resPage0 = await authedRequest.get('/api/v1/survey/surveys/finished?page=0');
    expect.soft(resPage0.status(), 'page=0 khong duoc gay loi 500').not.toBe(500);

    const resSizeNeg = await authedRequest.get('/api/v1/survey/surveys/finished?size=-5');
    expect(resSizeNeg.status()).not.toBe(500);
    expect([200, 400]).toContain(resSizeNeg.status());

    const resSizeBig = await authedRequest.get('/api/v1/survey/surveys/finished?size=100000');
    expect(resSizeBig.status()).not.toBe(500);
    expect([200, 400]).toContain(resSizeBig.status());
  });

  test('TC_SURVEYREPORT_SEC_001 - [Security] Keyword chua ky tu SQL injection', async ({ authedRequest }) => {
    const filter = encodeURIComponent(JSON.stringify({ keyword: "' OR '1'='1" }));
    const res = await authedRequest.get(`/api/v1/survey/surveys/finished?filter=${filter}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isSuccess).toBe(true);
    expect(Array.isArray(getPagedItems(body))).toBe(true);
  });

  test('TC_SURVEYREPORT_SEC_002 - [Security] Khong co token => 401 Unauthorized', async ({ playwright, baseURL }) => {
    const anonCtx = await playwright.request.newContext({ baseURL });
    const res = await anonCtx.get('/api/v1/survey/surveys/finished');
    expect(res.status()).toBe(401);
    await anonCtx.dispose();
  });

  test('TC_SURVEYREPORT_DC_001 - Doi chieu id voi GET /survey/surveys?filter={status:6}', async ({ authedRequest }) => {
    const finishedRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=200');
    const finishedIds = getPagedItems(await finishedRes.json())
      .map((it: any) => it.id)
      .sort();

    const filter = encodeURIComponent(JSON.stringify({ status: 6 }));
    const mainRes = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=200`);
    const mainIds = getPagedItems(await mainRes.json())
      .map((it: any) => it.id)
      .sort();

    expect(finishedIds).toEqual(mainIds);
  });

  test('TC_SURVEYREPORT_DC_002 - participants = totalElements cua SurveyResult', async ({ authedRequest }) => {
    const listRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=1');
    const sample = getPagedItems(await listRes.json())[0];
    test.skip(!sample, 'He thong chua co khao sat nao da hoan thanh de doi chieu participants');

    const resultsRes = await authedRequest.get(`/api/v1/survey/surveys/${sample.id}/results?page=1&size=1`);
    expect(resultsRes.status()).toBe(200);
    const resultsBody = await resultsRes.json();
    const totalElements = (resultsBody.data ?? resultsBody).totalElements;
    expect(sample.participants).toBe(totalElements);
  });

  test('TC_SURVEYREPORT_BV_002 - [BUG dung chung] Sort nhieu truong tang-roi-giam cung gay 500', async ({
    authedRequest,
  }) => {
    // Xac nhan bug TC_SURVEY_008b LAP LAI tren endpoint nay. Luu y: field "name" (chu khong phai
    // "startDate"/"participants") moi la field duoc backend nhan dien la sortable va cham duoc vao
    // code loi - da kiem chung "startDate"/"participants" bi BO QUA AM THAM (khong sap xep, khong
    // loi) nen khong du de ket luan endpoint nay an toan neu chi test voi 2 field do.
    test.fail(true, 'BUG dung chung voi TC_SURVEY_008b: sort="tang dan,-giam dan" gay loi 500');

    const res = await authedRequest.get('/api/v1/survey/surveys/finished?sort=name,-startDate');
    expect(res.status(), 'khong duoc gay loi 500').not.toBe(500);
  });
});

test.describe('SurveyReport - GET /api/v1/survey/surveys/finished/export', () => {
  test('TC_SURVEYREPORT_005 - Xuat Excel danh sach khao sat da hoan thanh', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished/export');
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toMatch(/spreadsheet|excel|octet-stream/i);
  });

  test('TC_SURVEYREPORT_005b - Noi dung cot trong file Excel xuat ra', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished/export');
    expect(res.status()).toBe(200);
    // Doi chieu tung cot/du lieu trong file voi API GET /finished can mo file thu cong (khong co
    // thu vien doc .xlsx trong du an nay, va day la viec QA thu cong theo huong dan cua nhiem vu).
    test.skip(true, 'can mo file thu cong de doi chieu noi dung chi tiet');
  });

  test('TC_SURVEYREPORT_005c - Content-Disposition (ten file xuat) hop le', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished/export');
    expect(res.status()).toBe(200);
    const disposition = res.headers()['content-disposition'] || '';
    expect(disposition).toMatch(/^attachment;/i);
    expect(disposition).toMatch(/filename=/i);
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    expect(filenameMatch).toBeTruthy();
    if (filenameMatch) {
      // Ten file khong duoc chua ky tu gay loi khi luu (backslash, dau ngoac nhon, dau nhay kep...)
      expect(filenameMatch[1]).not.toMatch(/[\\<>:"|?*]/);
    }
  });

  test('TC_SURVEYREPORT_006 - Xuat Excel khi khong co du lieu phu hop filter', async ({ authedRequest }) => {
    const filter = encodeURIComponent(JSON.stringify({ keyword: 'tu-khoa-khong-ton-tai-xyz' }));
    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/export?filter=${filter}`);
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toMatch(/spreadsheet|excel|octet-stream/i);
    const body = await res.body();
    expect(body.length).toBeGreaterThan(0); // van tra ve file hop le (it nhat co header), khong loi
  });

  test('TC_SURVEYREPORT_006b - Xuat Excel toan bo du lieu trong thoi gian hop ly', async ({ authedRequest }) => {
    const start = Date.now();
    const res = await authedRequest.get('/api/v1/survey/surveys/finished/export');
    const elapsed = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(30000);
  });

  test('TC_SURVEYREPORT_SEC_010 - [Security] Xuat Excel khong co token => 401', async ({ playwright, baseURL }) => {
    const anonCtx = await playwright.request.newContext({ baseURL });
    const res = await anonCtx.get('/api/v1/survey/surveys/finished/export');
    expect(res.status()).toBe(401);
    await anonCtx.dispose();
  });

  test('TC_SURVEYREPORT_SEC_011 - [Security] filter chua ky tu dac biet khi xuat Excel', async ({ authedRequest }) => {
    const filter = encodeURIComponent(JSON.stringify({ keyword: '=CMD(calc)' }));
    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/export?filter=${filter}`);
    expect(res.status()).not.toBe(500);
    expect([200, 400]).toContain(res.status());
    // Kiem tra keyword co duoc escape an toan de tranh CSV/Formula Injection trong file xuat ra
    // can mo file Excel thu cong de doi chieu tung o - ngoai pham vi tu dong hoa cua bo test nay.
    test.skip(true, 'can mo file thu cong de doi chieu noi dung chi tiet (formula injection escaping)');
  });

  test('TC_SURVEYREPORT_DC_010 - So dong Excel = totalElements (khong phan trang)', async ({ authedRequest }) => {
    const listRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=1');
    expect(listRes.status()).toBe(200);
    const exportRes = await authedRequest.get('/api/v1/survey/surveys/finished/export');
    expect(exportRes.status()).toBe(200);
    // Dem so dong du lieu thuc te trong file .xlsx can mo file thu cong (khong co thu vien doc
    // .xlsx trong du an nay).
    test.skip(true, 'can mo file thu cong de doi chieu noi dung chi tiet');
  });

  test('TC_SURVEYREPORT_BV_003 - [BUG dung chung] Sort nhieu truong tang-roi-giam cung gay 500', async ({
    authedRequest,
  }) => {
    test.fail(true, 'BUG dung chung voi TC_SURVEY_008b: sort="tang dan,-giam dan" gay loi 500');

    const res = await authedRequest.get('/api/v1/survey/surveys/finished/export?sort=name,-startDate');
    expect(res.status(), 'khong duoc gay loi 500').not.toBe(500);
  });
});

test.describe('SurveyReport - chi tiet / binh luan / export theo id', () => {
  async function getFirstFinishedSurvey(authedRequest: any) {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=1');
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    return items[0];
  }

  test('TC_SURVEYREPORT_007 - Chi tiet khao sat da hoan thanh', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh (status=6) de kiem tra');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body.data ?? body;
    expect(data.id ?? survey.id).toBeTruthy();
  });

  test('TC_SURVEYREPORT_008 - Chi tiet voi id khong ton tai => 404', async ({ authedRequest }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${fakeId}`);
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYREPORT_009 - Danh sach y kien gop y (phan trang)', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de kiem tra y kien gop y');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/comments?page=1&size=20`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    expect(items.length).toBeLessThanOrEqual(20);
  });

  test('TC_SURVEYREPORT_011 - Xuat Excel chi tiet khao sat da hoan thanh', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de xuat Excel chi tiet');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/export`);
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toMatch(/spreadsheet|excel|octet-stream/i);
  });

  test('TC_SURVEYREPORT_012 - Xuat Excel voi id khong ton tai => 404', async ({ authedRequest }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${fakeId}/export`);
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYREPORT_007b - Tong participants theo nguon phieu = tong quan', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de kiem tra');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}`);
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    const sumSources = (data.sources || []).reduce((sum: number, s: any) => sum + s.participants, 0);
    expect(sumSources).toBe(data.summary.participants);
  });

  test('TC_SURVEYREPORT_007c - Tong hai long/chua hai long cua cau hoi duy nhat khop tong quan', async ({ authedRequest }) => {
    const listRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=100');
    const items: any[] = getPagedItems(await listRes.json());
    let singleQuestionSurvey: any = null;
    for (const item of items) {
      const detailRes = await authedRequest.get(`/api/v1/survey/surveys/finished/${item.id}`);
      const detail = (await detailRes.json()).data;
      if (Array.isArray(detail.questions) && detail.questions.length === 1) {
        singleQuestionSurvey = detail;
        break;
      }
    }
    test.skip(!singleQuestionSurvey, 'He thong hien khong co khao sat da hoan thanh nao chi co dung 1 cau hoi');

    const q = singleQuestionSurvey.questions[0];
    expect(q.satisfied).toBe(singleQuestionSurvey.summary.satisfied);
    expect(q.unsatisfied).toBe(singleQuestionSurvey.summary.unsatisfied);
  });

  test('TC_SURVEYREPORT_007d - Khao sat Finished nhung participants = 0', async ({ authedRequest }) => {
    const listRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=100');
    const items: any[] = getPagedItems(await listRes.json());
    const zeroSurvey = items.find((it) => it.participants === 0);
    test.skip(!zeroSurvey, 'He thong hien khong co khao sat da hoan thanh nao voi participants = 0');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${zeroSurvey.id}`);
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.summary.participants).toBe(0);
    expect(data.summary.satisfied).toBe(0);
    expect(data.summary.unsatisfied).toBe(0);
    expect(Number.isNaN(data.summary.satisfiedRate)).toBe(false);
    expect(Number.isNaN(data.summary.unsatisfiedRate)).toBe(false);
  });

  test('TC_SURVEYREPORT_008b - Id sai dinh dang (khong phai uuid) => 404', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/finished/abc-khong-phai-uuid');
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYREPORT_SEC_020 - [Security] Chi tiet khao sat khong co token => 401', async ({ playwright, baseURL }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const anonCtx = await playwright.request.newContext({ baseURL });
    const res = await anonCtx.get(`/api/v1/survey/surveys/finished/${fakeId}`);
    expect(res.status()).toBe(401);
    await anonCtx.dispose();
  });

  test('TC_SURVEYREPORT_009b - Cuon trang comments khong trung/thieu', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de kiem tra y kien gop y');

    const res1 = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/comments?page=1&size=10`);
    const res2 = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/comments?page=2&size=10`);
    expect(res1.status()).toBe(200);
    expect(res2.status()).toBe(200);
    const ids1: string[] = getPagedItems(await res1.json()).map((i: any) => i.id);
    const ids2: string[] = getPagedItems(await res2.json()).map((i: any) => i.id);
    const overlap = ids1.filter((id) => ids2.includes(id));
    expect(overlap.length).toBe(0);
  });

  test('TC_SURVEYREPORT_009c - Danh sach y kien chi gom phieu co note khac rong', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de kiem tra y kien gop y');

    const resultsRes = await authedRequest.get(`/api/v1/survey/surveys/${survey.id}/results?page=1&size=500`);
    const results: any[] = getPagedItems(await resultsRes.json());
    const withNote = results.filter((r) => r.note && String(r.note).trim().length > 0);
    test.skip(withNote.length === 0, 'Khao sat nay khong co phieu nao co note de kiem tra');

    const commentsRes = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/comments?page=1&size=500`);
    const comments: any[] = getPagedItems(await commentsRes.json());
    // So luong y kien tra ve phai bang so phieu co note khac rong (he thong loc bo phieu khong gop y)
    expect(comments.length).toBe(withNote.length);
    for (const c of comments) {
      expect(c.content).toBeTruthy();
    }
  });

  test('TC_SURVEYREPORT_010 - size vuot gioi han toi da (500)', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de kiem tra y kien gop y');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/comments?size=500`);
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const items: any[] = getPagedItems(await res.json());
      expect(items.length).toBeLessThanOrEqual(100);
    }
  });

  test('TC_SURVEYREPORT_010b - size = 0 hoac size am', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de kiem tra y kien gop y');

    const resZero = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/comments?size=0`);
    expect(resZero.status()).not.toBe(500);
    expect([200, 400]).toContain(resZero.status());

    const resNeg = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/comments?size=-1`);
    expect(resNeg.status()).not.toBe(500);
    expect([200, 400]).toContain(resNeg.status());
  });

  test('TC_SURVEYREPORT_010c - Khao sat khong co y kien gop y nao', async ({ authedRequest }) => {
    const listRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=100');
    const items: any[] = getPagedItems(await listRes.json());
    let emptySurveyId: string | undefined;
    for (const item of items) {
      const commentsRes = await authedRequest.get(`/api/v1/survey/surveys/finished/${item.id}/comments?page=1&size=1`);
      const commentsBody = await commentsRes.json();
      const total = (commentsBody.data ?? commentsBody).totalElements ?? getPagedItems(commentsBody).length;
      if (total === 0) {
        emptySurveyId = item.id;
        break;
      }
    }
    test.skip(!emptySurveyId, 'He thong hien khong co khao sat da hoan thanh nao khong co y kien gop y');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${emptySurveyId}/comments`);
    expect(res.status()).toBe(200);
    const items2: any[] = getPagedItems(await res.json());
    expect(items2.length).toBe(0);
  });

  test('TC_SURVEYREPORT_010d - Id khao sat khong ton tai => 404', async ({ authedRequest }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${fakeId}/comments`);
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYREPORT_SEC_030 - [Security/Privacy] Y kien Truc tuyen khong lo thong tin ca nhan', async ({ authedRequest }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de kiem tra y kien gop y');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${survey.id}/comments?page=1&size=100`);
    expect(res.status()).toBe(200);
    const items: any[] = getPagedItems(await res.json());
    const onlineComments = items.filter((c) => c.method === 1);
    test.skip(onlineComments.length === 0, 'Khao sat nay khong co y kien tu phieu Truc tuyen de kiem tra');

    const forbiddenKeys = [
      'name', 'fullname', 'phone', 'phonenumber', 'email', 'ip', 'ipaddress',
      'userid', 'citizenid', 'identitynumber', 'address',
    ];
    for (const c of onlineComments) {
      const keys = Object.keys(c).map((k) => k.toLowerCase());
      for (const forbidden of forbiddenKeys) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  test('TC_SURVEYREPORT_SEC_031 - [Security] Y kien gop y khong co token => 401', async ({ playwright, baseURL }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const anonCtx = await playwright.request.newContext({ baseURL });
    const res = await anonCtx.get(`/api/v1/survey/surveys/finished/${fakeId}/comments`);
    expect(res.status()).toBe(401);
    await anonCtx.dispose();
  });

  test('TC_SURVEYREPORT_BV_004 - [BUG dung chung] Sort nhieu truong tang-roi-giam cung gay 500', async ({
    authedRequest,
  }) => {
    const survey = await getFirstFinishedSurvey(authedRequest);
    test.skip(!survey, 'He thong chua co khao sat nao da hoan thanh de kiem tra');

    test.fail(true, 'BUG dung chung voi TC_SURVEY_008b: sort="tang dan,-giam dan" gay loi 500');

    const res = await authedRequest.get(
      `/api/v1/survey/surveys/finished/${survey.id}/comments?sort=id,-createdOnDate`
    );
    expect(res.status(), 'khong duoc gay loi 500').not.toBe(500);
  });

  test('TC_SURVEYREPORT_011d - Xuat Excel khao sat Finished voi participants = 0', async ({ authedRequest }) => {
    const listRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=100');
    const items: any[] = getPagedItems(await listRes.json());
    const zeroSurvey = items.find((it) => it.participants === 0);
    test.skip(!zeroSurvey, 'He thong hien khong co khao sat da hoan thanh nao voi participants = 0');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${zeroSurvey.id}/export`);
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toMatch(/spreadsheet|excel|octet-stream/i);
  });

  test('TC_SURVEYREPORT_012b - Xuat Excel cho khao sat chua Finished (status=5) => 404', async ({ authedRequest }) => {
    const filter = encodeURIComponent(JSON.stringify({ status: 5 }));
    const listRes = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=1`);
    const items: any[] = getPagedItems(await listRes.json());
    test.skip(items.length === 0, 'He thong hien khong co khao sat nao dang o trang thai Dang dien ra (status=5)');

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${items[0].id}/export`);
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYREPORT_SEC_040 - [Security] Xuat Excel chi tiet khong co token => 401', async ({ playwright, baseURL }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const anonCtx = await playwright.request.newContext({ baseURL });
    const res = await anonCtx.get(`/api/v1/survey/surveys/finished/${fakeId}/export`);
    expect(res.status()).toBe(401);
    await anonCtx.dispose();
  });

  test('TC_SURVEYREPORT_SEC_041 - [Security] Noi dung gop y co ky tu cong thuc khi xuat Excel', async ({ authedRequest }) => {
    const listRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=100');
    const items: any[] = getPagedItems(await listRes.json());
    let surveyWithFormulaNote: any;
    for (const item of items) {
      const resultsRes = await authedRequest.get(`/api/v1/survey/surveys/${item.id}/results?page=1&size=500`);
      const results: any[] = getPagedItems(await resultsRes.json());
      if (results.some((r) => r.note && /^[=+\-@]/.test(String(r.note)))) {
        surveyWithFormulaNote = item;
        break;
      }
    }
    test.skip(
      !surveyWithFormulaNote,
      'He thong hien khong co phieu nao voi note bat dau bang ky tu cong thuc (=,+,-,@) de kiem tra'
    );

    const res = await authedRequest.get(`/api/v1/survey/surveys/finished/${surveyWithFormulaNote.id}/export`);
    expect(res.status()).toBe(200);
    // Doi chieu viec escape ky tu cong thuc trong file .xlsx can mo file thu cong (khong co thu
    // vien doc .xlsx trong du an nay).
    test.skip(true, 'can mo file thu cong de doi chieu noi dung chi tiet');
  });
});
