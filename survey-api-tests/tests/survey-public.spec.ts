import { test, expect, getPagedItems } from './helpers/api';

/**
 * Nhom API: SurveyPublic (tag Swagger "SurveyPublic") - API cong khai, KHONG can token.
 * File test case tuong ung: testcases/03_survey_public.yaml
 *
 * Chi gom cac test READ-ONLY. Kich ban POST /responses can captchaToken that
 * (lay tu UI/dich vu captcha) nen khong the tu dong hoa day du - xem ghi chu trong
 * testcases/03_survey_public.yaml (TC_SURVEYPUBLIC_005..010) de thuc hien thu cong hoac
 * tich hop voi dich vu captcha test rieng.
 */

test.describe('SurveyPublic - GET /api/v1/public/surveys', () => {
  test('TC_SURVEYPUBLIC_001/002 - Danh sach khao sat dang mo cho cong dan', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL }); // khong can token
    const res = await publicCtx.get('/api/v1/public/surveys');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items: any[] = getPagedItems(body);
    expect(Array.isArray(items)).toBe(true);
    await publicCtx.dispose();
  });
});

test.describe('SurveyPublic - GET /api/v1/public/surveys/{id}', () => {
  test('TC_SURVEYPUBLIC_004 - Id khong ton tai => 404', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await publicCtx.get(`/api/v1/public/surveys/${fakeId}`);
    expect(res.status()).toBe(404);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_003 - Chi tiet 1 khao sat dang mo (neu co)', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const listRes = await publicCtx.get('/api/v1/public/surveys');
    const listBody = await listRes.json();
    const items: any[] = getPagedItems(listBody);
    test.skip(!Array.isArray(items) || items.length === 0, 'Hien khong co khao sat truc tuyen nao dang mo');

    const id = items[0].id;
    const res = await publicCtx.get(`/api/v1/public/surveys/${id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body.data ?? body;
    expect(data.id).toBe(id);
    expect(Array.isArray(data.questions)).toBe(true);
    await publicCtx.dispose();
  });
});

test.describe('SurveyPublic - POST /api/v1/public/surveys/{id}/responses', () => {
  test('TC_SURVEYPUBLIC_006 - Thieu captchaToken => 400', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const listRes = await publicCtx.get('/api/v1/public/surveys');
    const listBody = await listRes.json();
    const items: any[] = getPagedItems(listBody);
    test.skip(!Array.isArray(items) || items.length === 0, 'Hien khong co khao sat truc tuyen nao dang mo');

    const res = await publicCtx.post(`/api/v1/public/surveys/${items[0].id}/responses`, {
      data: { note: 'test', answers: [] },
    });
    expect(res.status()).toBe(400);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_007 - captchaToken khong hop le => 400', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const listRes = await publicCtx.get('/api/v1/public/surveys');
    const listBody = await listRes.json();
    const items: any[] = getPagedItems(listBody);
    test.skip(!Array.isArray(items) || items.length === 0, 'Hien khong co khao sat truc tuyen nao dang mo');

    const res = await publicCtx.post(`/api/v1/public/surveys/${items[0].id}/responses`, {
      data: { captchaToken: 'token_gia_mao_khong_hop_le', note: 'test', answers: [] },
    });
    expect([400, 422]).toContain(res.status());
    await publicCtx.dispose();
  });
});

/**
 * ====== Mo rong theo manifest_surveypublic.json (21 TC con thieu) ======
 *
 * Da thu nghiem truc tiep tren moi truong that (cds.geneat.pro) de xac dinh hanh vi thuc te
 * cua POST .../responses khi KHONG co captcha that:
 *   - Thieu captchaToken (rong/khong truyen) => LUON 400 "The CaptchaToken field is required"
 *     NGAY CA KHI id khao sat khong ton tai - tuc buoc kiem tra CaptchaToken xay ra TRUOC buoc
 *     tim khao sat.
 *   - Chi can truyen captchaToken la 1 chuoi KHONG RONG (vi du "fake_captcha_khong_hop_le") la
 *     vuot qua buoc kiem tra "field required" nay va di tiep vao cac buoc validate nghiep vu
 *     tiep theo (khao sat ton tai/dang mo, do dai note, gia tri result, du/thieu cau tra loi...)
 *     MA KHONG can captcha THAT SU hop le - vi cac buoc nay deu la buoc TU CHOI (400/404), KHONG
 *     co buoc nao trong so do thuc su ghi nhan ban ghi phan hoi, nen AN TOAN de tu dong hoa theo
 *     dung uu tien cua AGENT_GUIDELINES.md muc 3.
 *   - CHI khi TOAN BO cau tra loi hop le & day du (moi cau hoi duoc tra loi dung 1 lan, gia tri
 *     result hop le) THI he thong moi co the ghi nhan thanh cong that su (200) - truong hop nay
 *     (TC_SURVEYPUBLIC_005c, SEC_020) KHONG duoc tu dong hoa de tranh tao ban ghi phan hoi that
 *     KHONG THE XOA (endpoint nay khong co API DELETE tuong ung).
 */

const FAKE_CAPTCHA = 'fake_captcha_khong_hop_le'; // chuoi khong rong bat ky - chi de vuot qua buoc "truong bat buoc"

/** Lay 1 khao sat dang mo cong khai kem danh sach cau hoi chi tiet (hoac null neu hien khong co). */
async function getOpenPublicSurveyWithQuestions(
  publicCtx: any
): Promise<{ id: string; questions: any[] } | null> {
  const listRes = await publicCtx.get('/api/v1/public/surveys');
  if (listRes.status() !== 200) return null;
  const items: any[] = getPagedItems(await listRes.json());
  if (items.length === 0) return null;

  const detailRes = await publicCtx.get(`/api/v1/public/surveys/${items[0].id}`);
  if (detailRes.status() !== 200) return null;
  const detail = (await detailRes.json()).data;
  return { id: detail.id, questions: detail.questions || [] };
}

test.describe('SurveyPublic - GET /api/v1/public/surveys (bo sung)', () => {
  test('TC_SURVEYPUBLIC_002 - Khong co khao sat nao dang mo => tra ve mang rong []', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const res = await publicCtx.get('/api/v1/public/surveys');
    expect(res.status()).toBe(200);
    const items: any[] = getPagedItems(await res.json());
    // Khong the CHU DONG tao dieu kien "khong co khao sat nao dang mo" ma khong dung den
    // khao sat THAT cua nguoi khac (doi status/methods cua ho) - vi pham QUY TAC AN TOAN.
    // Chi kiem tra duoc khi dieu kien nay tinh co dung tren he thong that tai thoi diem chay.
    test.skip(items.length > 0, 'He thong hien dang co it nhat 1 khao sat cong khai dang mo nen khong kiem tra duoc truong hop danh sach rong');
    expect(items).toEqual([]);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_SEC_001 - [Security] Khong can token van truy cap duoc (dung thiet ke cong khai)', async ({ playwright, baseURL }) => {
    const anonCtx = await playwright.request.newContext({ baseURL }); // KHONG gan header Authorization
    const res = await anonCtx.get('/api/v1/public/surveys');
    expect(res.status()).toBe(200);
    await anonCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_SEC_002 - [Security] Khong lo du lieu noi bo (organizationId, resultCount, histories...)', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const res = await publicCtx.get('/api/v1/public/surveys');
    expect(res.status()).toBe(200);
    const items: any[] = getPagedItems(await res.json());
    test.skip(items.length === 0, 'Hien khong co khao sat truc tuyen nao dang mo de kiem tra cau truc du lieu');

    const allowedKeys = ['id', 'name', 'organizationName', 'endDate', 'questionCount', 'estimatedMinutes'];
    for (const item of items) {
      // Danh sach cong khai CHI duoc chua dung cac truong can thiet cho nguoi dan - bat ky
      // truong nao khac (organizationId, voteTarget, resultCount, histories, createdByUserId,
      // status, methods, ...) deu la lo du lieu noi bo.
      for (const key of Object.keys(item)) {
        expect(allowedKeys).toContain(key);
      }
    }
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_SEC_003 - [Security] Goi lien tiep nhieu request khong lam sap he thong', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const N = 50;
    const results = await Promise.all(Array.from({ length: N }, () => publicCtx.get('/api/v1/public/surveys')));
    for (const r of results) {
      // CAN XAC NHAN co co che rate-limit/chong scrape hay khong - chi khang dinh KHONG duoc
      // co loi 500 do qua tai, chap nhan ca 200 (khong rate-limit) lan 429 (co rate-limit).
      expect([200, 429]).toContain(r.status());
    }
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_BV_001 - Khao sat vua het han (endDate ~ hien tai) se bien mat khoi danh sach', async ({ authedRequest, playwright, baseURL }) => {
    test.setTimeout(120_000);
    const filter = encodeURIComponent(JSON.stringify({ status: 5 }));
    const listRes = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=30`);
    const items: any[] = listRes.status() === 200 ? getPagedItems(await listRes.json()) : [];
    const now = Date.now();
    // Chi chap nhan khao sat sap het han trong vong 1 phut toi, de thoi gian cho trong test la
    // ngan va hop ly - KHONG tu tao/sua endDate cua khao sat nao (vi pham QUY TAC AN TOAN).
    const nearExpiry = items.find((i) => {
      const end = new Date(i.endDate).getTime();
      return end > now && end - now <= 60 * 1000;
    });
    test.skip(
      !nearExpiry,
      'Hien khong co khao sat nao sap het han trong vong 1 phut toi tren he thong that - khong the tu tao hay dieu khien thoi gian de ep dieu kien nay'
    );

    const publicCtx = await playwright.request.newContext({ baseURL });
    const beforeRes = await publicCtx.get('/api/v1/public/surveys');
    const beforeItems: any[] = getPagedItems(await beforeRes.json());
    expect(beforeItems.some((i) => i.id === nearExpiry.id)).toBe(true);

    const waitMs = new Date(nearExpiry.endDate).getTime() - Date.now() + 3000;
    await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 0)));

    const afterRes = await publicCtx.get('/api/v1/public/surveys');
    const afterItems: any[] = getPagedItems(await afterRes.json());
    expect(afterItems.some((i) => i.id === nearExpiry.id)).toBe(false);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_DC_001 - Doi chieu questionCount voi so cau hoi thuc te', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const listRes = await publicCtx.get('/api/v1/public/surveys');
    const items: any[] = getPagedItems(await listRes.json());
    test.skip(items.length === 0, 'Hien khong co khao sat truc tuyen nao dang mo');

    for (const item of items) {
      const detailRes = await publicCtx.get(`/api/v1/public/surveys/${item.id}`);
      expect(detailRes.status()).toBe(200);
      const detail = (await detailRes.json()).data;
      expect(Array.isArray(detail.questions)).toBe(true);
      expect(detail.questions.length).toBe(item.questionCount);
    }
    await publicCtx.dispose();
  });
});

test.describe('SurveyPublic - GET /api/v1/public/surveys/{id} (bo sung)', () => {
  test('TC_SURVEYPUBLIC_004b - Khao sat Da ket thuc (status=6) => 404 qua API cong khai', async ({ authedRequest, playwright, baseURL }) => {
    const filter = encodeURIComponent(JSON.stringify({ status: 6 }));
    const listRes = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=5`);
    const items: any[] = listRes.status() === 200 ? getPagedItems(await listRes.json()) : [];
    test.skip(items.length === 0, 'Hien khong co khao sat nao o trang thai Da ket thuc (status=6)');

    const publicCtx = await playwright.request.newContext({ baseURL });
    const res = await publicCtx.get(`/api/v1/public/surveys/${items[0].id}`);
    expect(res.status()).toBe(404);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_004c - Khao sat dang Nhap/Cho phe duyet/Bi tu choi => 404 qua API cong khai', async ({
    authedRequest,
    playwright,
    baseURL,
  }) => {
    const foundIds: string[] = [];
    for (const status of [1, 2, 4]) {
      const filter = encodeURIComponent(JSON.stringify({ status }));
      const res = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=5`);
      if (res.status() !== 200) continue;
      const items: any[] = getPagedItems(await res.json());
      if (items[0]) foundIds.push(items[0].id);
    }
    test.skip(foundIds.length === 0, 'Hien khong co khao sat nao o status 1 (Nhap)/2 (Cho phe duyet)/4 (Bi tu choi)');

    const publicCtx = await playwright.request.newContext({ baseURL });
    for (const id of foundIds) {
      const res = await publicCtx.get(`/api/v1/public/surveys/${id}`);
      expect(res.status()).toBe(404);
    }
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_004d - Khao sat dang dien ra nhung khong co hinh thuc Truc tuyen => 404', async ({
    authedRequest,
    playwright,
    baseURL,
  }) => {
    const filter = encodeURIComponent(JSON.stringify({ status: 5 }));
    const listRes = await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}&page=1&size=30`);
    const items: any[] = listRes.status() === 200 ? getPagedItems(await listRes.json()) : [];
    const found = items.find((i) => Array.isArray(i.methods) && !i.methods.includes(1));
    test.skip(!found, 'Hien khong co khao sat dang dien ra nao thieu hinh thuc Truc tuyen (method=1) de kiem tra');

    const publicCtx = await playwright.request.newContext({ baseURL });
    const res = await publicCtx.get(`/api/v1/public/surveys/${found.id}`);
    expect(res.status()).toBe(404);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_004e - Id sai dinh dang (khong phai uuid) => 404', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const res = await publicCtx.get('/api/v1/public/surveys/abc-khong-phai-uuid');
    expect(res.status()).toBe(404);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_SEC_010 - [Security] Chi tiet cong khai khong lo resultCount/histories', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const listRes = await publicCtx.get('/api/v1/public/surveys');
    const items: any[] = getPagedItems(await listRes.json());
    test.skip(items.length === 0, 'Hien khong co khao sat truc tuyen nao dang mo');

    const res = await publicCtx.get(`/api/v1/public/surveys/${items[0].id}`);
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    for (const forbidden of ['resultCount', 'histories', 'organizationId', 'voteTarget', 'createdByUserId']) {
      expect(data).not.toHaveProperty(forbidden);
    }
    await publicCtx.dispose();
  });

  test("TC_SURVEYPUBLIC_SEC_011 - [Security] Id chua ky tu dac biet / SQL injection => khong 500", async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const res = await publicCtx.get(`/api/v1/public/surveys/${encodeURIComponent("' OR '1'='1")}`);
    expect([400, 404]).toContain(res.status());
    await publicCtx.dispose();
  });
});

test.describe('SurveyPublic - POST /api/v1/public/surveys/{id}/responses (bo sung - validate-only)', () => {
  test('TC_SURVEYPUBLIC_005c - [Mutation] Gui danh gia hop le voi toan bo cau tra loi Hai long', async () => {
    test.skip(
      true,
      'Can captcha THAT SU hop le de gui thanh cong (happy path) - endpoint nay KHONG CO API xoa ' +
        'nen neu vo tinh gui thanh cong se tao 1 ban ghi phan hoi that KHONG THE don dep; theo ' +
        'AGENT_GUIDELINES.md khong tu gia lap captcha de tao du lieu that trong truong hop nay'
    );
  });

  test('TC_SURVEYPUBLIC_006b - [Mutation] captchaToken la chuoi rong "" => 400', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const found = await getOpenPublicSurveyWithQuestions(publicCtx);
    test.skip(!found, 'Hien khong co khao sat truc tuyen nao dang mo');

    const res = await publicCtx.post(`/api/v1/public/surveys/${found!.id}/responses`, {
      data: { captchaToken: '', note: 'test', answers: [] },
    });
    // captchaToken rong tuong duong khong truyen - bi TU CHOI truoc khi cham den validate khac,
    // KHONG tao ban ghi that.
    expect(res.status()).toBe(400);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_008b - [Mutation] answers la mang rong [] => 400', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const found = await getOpenPublicSurveyWithQuestions(publicCtx);
    test.skip(!found, 'Hien khong co khao sat truc tuyen nao dang mo');

    const res = await publicCtx.post(`/api/v1/public/surveys/${found!.id}/responses`, {
      data: { captchaToken: FAKE_CAPTCHA, note: 'test', answers: [] },
    });
    // Bi TU CHOI o buoc validate (answers rong) - KHONG tao ban ghi that.
    expect(res.status()).toBe(400);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_008 - [Mutation] answers chi gom mot phan cau hoi (thieu it nhat 1 cau) => 400', async ({
    playwright,
    baseURL,
  }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const found = await getOpenPublicSurveyWithQuestions(publicCtx);
    test.skip(!found || found.questions.length < 2, 'Can khao sat dang mo co >= 2 cau hoi de bo sot 1 cau');

    const partialAnswers = found!.questions.slice(0, found!.questions.length - 1).map((q: any) => ({
      questionId: q.id,
      result: 1,
    }));
    const res = await publicCtx.post(`/api/v1/public/surveys/${found!.id}/responses`, {
      data: { captchaToken: FAKE_CAPTCHA, note: 'test', answers: partialAnswers },
    });
    // Thieu cau tra loi cho it nhat 1 cau hoi - bi TU CHOI o buoc validate, KHONG tao ban ghi that.
    expect(res.status()).toBe(400);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_008c - [Mutation] 1 cau hoi bi tra loi 2 lan (duplicate questionId) => 400', async ({
    playwright,
    baseURL,
  }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const found = await getOpenPublicSurveyWithQuestions(publicCtx);
    test.skip(!found || found.questions.length === 0, 'Hien khong co khao sat truc tuyen nao dang mo co cau hoi');

    const qId = found!.questions[0].id;
    const res = await publicCtx.post(`/api/v1/public/surveys/${found!.id}/responses`, {
      data: {
        captchaToken: FAKE_CAPTCHA,
        note: 'test',
        answers: [
          { questionId: qId, result: 1 },
          { questionId: qId, result: 2 },
        ],
      },
    });
    // Du lieu khong nhat quan (trung lap questionId nen van thieu cac cau hoi khac) - bi TU CHOI
    // o buoc validate, KHONG tao ban ghi that.
    expect(res.status()).toBe(400);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_008d - [Mutation] result ngoai enum SurveyAnswerResult (vi du 3) => 400', async ({
    playwright,
    baseURL,
  }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const found = await getOpenPublicSurveyWithQuestions(publicCtx);
    test.skip(!found || found.questions.length === 0, 'Hien khong co khao sat truc tuyen nao dang mo co cau hoi');

    const res = await publicCtx.post(`/api/v1/public/surveys/${found!.id}/responses`, {
      data: {
        captchaToken: FAKE_CAPTCHA,
        note: 'test',
        answers: [{ questionId: found!.questions[0].id, result: 3 }],
      },
    });
    // Bi TU CHOI o buoc validate (gia tri result khong hop le) - KHONG tao ban ghi that.
    expect(res.status()).toBe(400);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_009b - [Mutation] Id khao sat khong ton tai => 404', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await publicCtx.post(`/api/v1/public/surveys/${fakeId}/responses`, {
      data: { captchaToken: FAKE_CAPTCHA, note: 'test', answers: [] },
    });
    // Da xac nhan tren moi truong that: he thong kiem tra khao sat co ton tai/dang mo TRUOC khi
    // xet noi dung answers, nen id khong ton tai luon tra ve 404 - KHONG tao ban ghi that.
    expect(res.status()).toBe(404);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_009 - [Mutation] Gui danh gia cho khao sat da ket thuc => 400/404', async ({
    playwright,
    baseURL,
    authedRequest,
  }) => {
    const finishedRes = await authedRequest.get('/api/v1/survey/surveys/finished?page=1&size=1');
    const finishedItems = getPagedItems(await finishedRes.json());
    test.skip(finishedItems.length === 0, 'He thong chua co khao sat nao da hoan thanh de kiem tra');

    const publicCtx = await playwright.request.newContext({ baseURL });
    const res = await publicCtx.post(`/api/v1/public/surveys/${finishedItems[0].id}/responses`, {
      data: { captchaToken: FAKE_CAPTCHA, note: 'test', answers: [] },
    });
    // Khao sat da ket thuc khong con mo cho danh gia - bi TU CHOI (400 hoac 404 vi API cong khai
    // "an" khao sat khong con hop le), KHONG tao ban ghi that.
    expect([400, 404]).toContain(res.status());
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_010 - [Mutation] questionId khong thuoc khao sat => 400', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const found = await getOpenPublicSurveyWithQuestions(publicCtx);
    test.skip(!found, 'Hien khong co khao sat truc tuyen nao dang mo');

    const randomQuestionId = '00000000-0000-0000-0000-000000000001';
    const res = await publicCtx.post(`/api/v1/public/surveys/${found!.id}/responses`, {
      data: { captchaToken: FAKE_CAPTCHA, note: 'test', answers: [{ questionId: randomQuestionId, result: 1 }] },
    });
    // Bi TU CHOI o buoc validate (questionId khong thuoc khao sat nen van thieu cau tra loi hop
    // le) - KHONG tao ban ghi that.
    expect(res.status()).toBe(400);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_NEG_001 - [Mutation] note qua dai (10000 ky tu) => 400', async ({ playwright, baseURL }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const found = await getOpenPublicSurveyWithQuestions(publicCtx);
    test.skip(!found, 'Hien khong co khao sat truc tuyen nao dang mo');

    const res = await publicCtx.post(`/api/v1/public/surveys/${found!.id}/responses`, {
      data: { captchaToken: FAKE_CAPTCHA, note: 'a'.repeat(10000), answers: [] },
    });
    // Da xac nhan tren moi truong that: gioi han "Y kien gop y toi da 1000 ky tu" => 400.
    // KHONG tao ban ghi that (bi tu choi truoc khi xet toi answers).
    expect(res.status()).toBe(400);
    await publicCtx.dispose();
  });

  test('TC_SURVEYPUBLIC_SEC_020 - [Mutation][Security] note chua script (XSS) duoc luu tru an toan', async () => {
    test.skip(
      true,
      'De kiem tra dung hanh vi can GUI THANH CONG that su (captcha hop le + tra loi day du moi cau ' +
        'hoi) moi co ban ghi de doi chieu noi dung luu tru - endpoint nay KHONG CO API xoa nen khong ' +
        'the don dep neu tao that; khong tu dong hoa de tranh de lai du lieu rac vinh vien tren moi truong that'
    );
  });

  test('TC_SURVEYPUBLIC_SEC_022 - [Mutation][Security] Token dang nhap cua admin bi bo qua (van la API cong khai)', async ({
    playwright,
    baseURL,
  }) => {
    const publicCtx = await playwright.request.newContext({ baseURL });
    const found = await getOpenPublicSurveyWithQuestions(publicCtx);
    test.skip(!found, 'Hien khong co khao sat truc tuyen nao dang mo');

    // Gui kem 1 Bearer token hop le cua tai khoan SUPER_ADMIN (tu .env) nhung CO CHU Y de
    // answers rong (invalid) de request chac chan bi TU CHOI o buoc validate - KHONG tao ban
    // ghi that du co the "thanh cong" neu answers day du.
    const adminToken = process.env.AUTH_TOKEN || '';
    const adminCtx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
    });
    const res = await adminCtx.post(`/api/v1/public/surveys/${found!.id}/responses`, {
      data: { captchaToken: FAKE_CAPTCHA, note: 'test', answers: [] },
    });
    // Diem mau chot: token admin KHONG duoc dung de "mo khoa" hay thay doi cach xu ly - phai bi
    // tu choi VI LY DO DU LIEU (400, giong het khi khong co token), TUYET DOI KHONG duoc tra ve
    // 401/403 (nghia la endpoint vo tinh doi hoi xac thuc, sai thiet ke "cong khai").
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
    expect(res.status()).toBe(400);
    await adminCtx.dispose();
    await publicCtx.dispose();
  });
});
