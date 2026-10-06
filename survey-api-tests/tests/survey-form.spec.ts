import { test, expect, getPagedItems } from './helpers/api';

/**
 * Nhom API: SurveyForm (tag Swagger "SurveyForm")
 * File test case tuong ung: testcases/02_survey_form.yaml
 */

test.describe('SurveyForm - GET /api/v1/survey/surveys/{id}/form-template', () => {
  test('TC_SURVEYFORM_003 - Id khong ton tai => 404', async ({ authedRequest }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authedRequest.get(`/api/v1/survey/surveys/${fakeId}/form-template`);
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYFORM_004 - Khong co token => 401', async ({ playwright, baseURL }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const anonCtx = await playwright.request.newContext({ baseURL });
    const res = await anonCtx.get(`/api/v1/survey/surveys/${fakeId}/form-template`);
    expect(res.status()).toBe(401);
    await anonCtx.dispose();
  });

  test('TC_SURVEYFORM_001 / 002 - Tai mau phieu cho khao sat co that (tuy trang thai)', async ({ authedRequest }) => {
    // Lay 1 khao sat bat ky de kiem tra hanh vi thuc te theo status cua no.
    const listRes = await authedRequest.get('/api/v1/survey/surveys?page=1&size=1');
    const listBody = await listRes.json();
    const items: any[] = getPagedItems(listBody);
    test.skip(items.length === 0, 'Chua co du lieu khao sat nao de kiem tra tai mau phieu');

    const survey = items[0];
    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey.id}/form-template`);

    // status = 3 (Da phe duyet), 5 (Dang dien ra), 6 (Da ket thuc) => ky vong 200 + file binary
    // cac status con lai (1 Nhap, 2 Cho phe duyet, 4 Bi tu choi) => ky vong 400/409
    if ([3, 5, 6].includes(survey.status)) {
      expect(res.status()).toBe(200);
      const contentType = res.headers()['content-type'] || '';
      expect(contentType).toMatch(/word|octet-stream|msword/i);
    } else {
      expect([400, 409]).toContain(res.status());
    }
  });
});

/**
 * ====== Mo rong theo manifest_surveyform.json (8 TC con thieu) ======
 * Tat ca deu la GET (read-only), an toan chay truc tiep tren moi truong that,
 * khong can RUN_MUTATION_TESTS. Du lieu tien dieu kien (khao sat theo tung status/
 * so cau hoi/hinh thuc) duoc TIM trong du lieu co san qua filter, KHONG tu tao moi -
 * neu khong tim thay, test tu skip voi ly do cu the (dung QUY TAC AN TOAN trong
 * AGENT_GUIDELINES.md).
 *
 * Da xac nhan truc tiep tren moi truong that (cds.geneat.pro): file "form-template"
 * tra ve thuc chat la noi dung HTML (content-type: application/msword, Word mo duoc
 * nho co che "Word HTML"), moi cau hoi duoc sinh thanh 1 dong dang:
 *   <td style="width:60%">{order}. {noi dung cau hoi}</td>
 * Nho vay co the doi chieu noi dung ma KHONG can them thu vien doc .docx nao.
 */

/** Giai ma cac HTML numeric entity (vi du &#225;) ve ky tu Unicode that su. */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Tim 1 khao sat da phe duyet (status 3/5/6) co >= minQuestions cau hoi; tra ve id + danh sach cau hoi chi tiet. */
async function findApprovedSurveyWithQuestions(
  authedRequest: any,
  minQuestions = 1
): Promise<{ id: string; questions: any[] } | null> {
  for (const status of [3, 5, 6]) {
    const filter = encodeURIComponent(JSON.stringify({ status }));
    const listRes = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=30`);
    if (listRes.status() !== 200) continue;
    const items: any[] = getPagedItems(await listRes.json());
    for (const item of items) {
      const detailRes = await authedRequest.get(`/api/v1/survey/surveys/${item.id}`);
      if (detailRes.status() !== 200) continue;
      const detail = (await detailRes.json()).data;
      const questions = detail?.questions || [];
      if (questions.length >= minQuestions) {
        return { id: detail.id, questions };
      }
    }
  }
  return null;
}

/** Tim 1 khao sat bat ky dang co status cho truoc (lay phan tu dau tien trong danh sach, hoac null). */
async function findSurveyByStatus(authedRequest: any, status: number): Promise<any | null> {
  const filter = encodeURIComponent(JSON.stringify({ status }));
  const res = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=5`);
  if (res.status() !== 200) return null;
  const items: any[] = getPagedItems(await res.json());
  return items[0] || null;
}

test.describe('SurveyForm - bo sung theo manifest_surveyform.json', () => {
  test('TC_SURVEYFORM_001b - Header Content-Disposition co ten file hop le', async ({ authedRequest }) => {
    const found = await findApprovedSurveyWithQuestions(authedRequest, 1);
    test.skip(!found, 'Khong tim thay khao sat da phe duyet nao de kiem tra tai mau phieu');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${found!.id}/form-template`);
    expect(res.status()).toBe(200);

    const disposition = res.headers()['content-disposition'] || '';
    expect(disposition).toMatch(/^attachment;\s*filename=/i);

    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    expect(filenameMatch).toBeTruthy();
    const filename = filenameMatch ? filenameMatch[1] : '';
    expect(filename.length).toBeGreaterThan(0);
    // Khong chua ky tu gay loi khi luu file tren he dieu hanh (/ \ : * ? " < > |)
    expect(filename).not.toMatch(/[\\/:*?"<>|]/);
  });

  test('TC_SURVEYFORM_001c - Noi dung mau phieu dung voi danh sach cau hoi cua khao sat', async ({ authedRequest }) => {
    const found = await findApprovedSurveyWithQuestions(authedRequest, 2);
    test.skip(!found, 'Khong tim thay khao sat da phe duyet co >= 2 cau hoi de kiem tra thu tu/noi dung');
    const { id, questions } = found!;

    const res = await authedRequest.get(`/api/v1/survey/surveys/${id}/form-template`);
    expect(res.status()).toBe(200);
    const html = (await res.body()).toString('utf8');

    // Moi cau hoi duoc sinh thanh 1 dong dang: <td style="width:60%">{order}. {noi dung}</td>
    const rows = [...html.matchAll(/<td style="width:60%">(\d+)\.\s*(.*?)<\/td>/g)];
    expect(rows.length).toBe(questions.length);

    const sortedQuestions = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    rows.forEach((row, idx) => {
      const rowOrder = Number(row[1]);
      const rowContent = decodeHtmlEntities(row[2]).trim();
      const expectedQuestion = sortedQuestions[idx];
      expect(rowOrder).toBe(expectedQuestion.order);
      expect(rowContent).toBe(String(expectedQuestion.content).trim());
    });
  });

  test('TC_SURVEYFORM_002 - Khao sat dang Nhap (status=1) => 400/409', async ({ authedRequest }) => {
    const survey = await findSurveyByStatus(authedRequest, 1);
    test.skip(!survey, 'Hien khong co khao sat nao o trang thai Nhap (status=1) de kiem tra');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey.id}/form-template`);
    expect([400, 409]).toContain(res.status());
  });

  test('TC_SURVEYFORM_002b - Khao sat dang Cho phe duyet (status=2) => 400/409', async ({ authedRequest }) => {
    const survey = await findSurveyByStatus(authedRequest, 2);
    test.skip(!survey, 'Hien khong co khao sat nao o trang thai Cho phe duyet (status=2) de kiem tra');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey.id}/form-template`);
    expect([400, 409]).toContain(res.status());
  });

  test('TC_SURVEYFORM_002c - Khao sat Bi tu choi (status=4) => 400/409', async ({ authedRequest }) => {
    const survey = await findSurveyByStatus(authedRequest, 4);
    test.skip(!survey, 'Hien khong co khao sat nao o trang thai Bi tu choi (status=4) de kiem tra');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${survey.id}/form-template`);
    expect([400, 409]).toContain(res.status());
  });

  test('TC_SURVEYFORM_002d - Khao sat da phe duyet chi co hinh thuc Truc tuyen (methods=[1])', async ({ authedRequest }) => {
    let found: any = null;
    for (const status of [3, 5, 6]) {
      const filter = encodeURIComponent(JSON.stringify({ status }));
      const listRes = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=50`);
      if (listRes.status() !== 200) continue;
      const items: any[] = getPagedItems(await listRes.json());
      found = items.find((i) => Array.isArray(i.methods) && i.methods.length === 1 && i.methods[0] === 1) || found;
      if (found) break;
    }
    test.skip(!found, 'Khong tim thay khao sat da phe duyet nao chi co hinh thuc Truc tuyen (methods=[1])');

    const res = await authedRequest.get(`/api/v1/survey/surveys/${found.id}/form-template`);
    // Da xac nhan tren moi truong that: he thong VAN cho tai mau phieu du khao sat chi co
    // hinh thuc Truc tuyen (status 200). Van chap nhan them 400 de phong truong hop logic
    // nghiep vu khac nhau giua cac khao sat (CAN XAC NHAN tuyet doi voi dev).
    expect([200, 400]).toContain(res.status());
  });

  test('TC_SURVEYFORM_002e - Khao sat da phe duyet nhung khong co cau hoi nao (neu co the xay ra)', async ({ authedRequest }) => {
    let found: any = null;
    for (const status of [3, 5, 6]) {
      const filter = encodeURIComponent(JSON.stringify({ status }));
      const listRes = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=50`);
      if (listRes.status() !== 200) continue;
      const items: any[] = getPagedItems(await listRes.json());
      for (const item of items) {
        const detailRes = await authedRequest.get(`/api/v1/survey/surveys/${item.id}`);
        if (detailRes.status() !== 200) continue;
        const detail = (await detailRes.json()).data;
        if ((detail?.questions || []).length === 0) {
          found = detail;
          break;
        }
      }
      if (found) break;
    }
    // Ghi nhan: TC_SURVEY_015 (survey.mutation.spec.ts) da xac nhan he thong TU CHOI (400)
    // gui duyet mot khao sat khong co cau hoi nao => ve nguyen tac se khong ton tai khao sat
    // DA PHE DUYET ma khong co cau hoi, nen truong hop nay du kien se luon bi skip tren moi
    // truong that hien tai - KHONG tu tao du lieu gia de ep dieu kien nay (vi pham QUY TAC AN TOAN).
    test.skip(
      !found,
      'He thong khong cho phep phe duyet khao sat khong co cau hoi (da xac nhan qua TC_SURVEY_015) nen khong co du lieu nay tren he thong that va khong the tu tao an toan'
    );
    const res = await authedRequest.get(`/api/v1/survey/surveys/${found.id}/form-template`);
    expect([200, 400]).toContain(res.status());
  });

  test('TC_SURVEYFORM_003b - Id sai dinh dang (khong phai uuid) => 404', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/v1/survey/surveys/abc-khong-phai-uuid/form-template');
    expect(res.status()).toBe(404);
  });
});
