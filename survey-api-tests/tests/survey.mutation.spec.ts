import {
  test,
  expect,
  MUTATION_ENABLED,
  TEST_ORGANIZATION_ID,
  uniqueSuffix,
  getPagedItems,
  safeDeleteSurvey,
} from './helpers/api';

/**
 * Nhom API: Survey - cac kich ban CO THAY DOI DU LIEU THAT (tao/sua/phe duyet/xoa).
 * File test case tuong ung: testcases/Survey/02_post_surveys.yaml, 07_put_surveys_by_id.yaml,
 *                            08_delete_surveys_by_id.yaml, 09_put_surveys_by_id_status.yaml
 *
 * CHI chay khi RUN_MUTATION_TESTS=true trong .env (mac dinh la false de tranh
 * vo tinh tao/sua/xoa du lieu tren moi truong that). Moi test case tu tao du lieu
 * rieng va tu don dep (xoa) sau khi chay xong de khong anh huong du lieu he thong.
 *
 * Luu y: organizationId la bat buoc ve nghiep vu (du schema Swagger khong bat buoc) -
 * xem TEST_ORGANIZATION_ID trong .env. Neu bo trong/sai, API tra ve 400
 * "Đơn vị không tồn tại hoặc không được phép sử dụng".
 *
 * Chay: npm run test:mutation
 */

test.describe('Survey - vong doi tao/sua/phe duyet/xoa khao sat (mutation)', () => {
  test.skip(!MUTATION_ENABLED, 'RUN_MUTATION_TESTS=false - bo qua cac test case thay doi du lieu that');
  test.skip(!TEST_ORGANIZATION_ID, 'Chua cau hinh TEST_ORGANIZATION_ID trong .env');

  let createdId: string | undefined;

  // Mang bo sung (cho cac test moi ben duoi co the tao nhieu hon 1 khao sat trong 1 test).
  // Dung chung co che don dep voi `createdId` o tren - khong thay doi hanh vi cu, chi mo rong.
  let createdIds: string[] = [];

  test.afterEach(async ({ authedRequest }) => {
    // Don dep: xoa khao sat test da tao (neu con ton tai) de khong de lai rac tren he thong.
    // Dung safeDeleteSurvey: tu dong tu choi (Cho phe duyet -> Bi tu choi) TRUOC khi xoa, vi
    // server chi cho xoa khao sat o status Nhap/Bi tu choi (xem helpers/api.ts).
    if (createdId) {
      await safeDeleteSurvey(authedRequest, createdId);
      createdId = undefined;
    }
    for (const id of createdIds) {
      await safeDeleteSurvey(authedRequest, id);
    }
    createdIds = [];
  });

  /** Body mac dinh hop le de tao 1 khao sat test, co the ghi de tung truong qua `overrides`. */
  function surveyPayload(overrides: Record<string, any> = {}) {
    return {
      name: `[Auto-test] Khao sat ${uniqueSuffix()}`,
      startDate: '2026-11-01T00:00:00Z',
      endDate: '2026-11-30T00:00:00Z',
      organizationId: TEST_ORGANIZATION_ID,
      voteTarget: 10,
      methods: [1],
      ...overrides,
    };
  }

  test('TC_SURVEY_012 - Tao moi khao sat hop le, luu nhap', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/v1/survey/surveys', {
      data: {
        name: `[Auto-test] Khao sat nhap ${uniqueSuffix()}`,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: TEST_ORGANIZATION_ID,
        voteTarget: 100,
        methods: [1],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body.data ?? body;
    expect(data.id).toBeTruthy();
    expect(data.code).toMatch(/KS-\d{4}-/);
    expect(data.status).toBe(1); // Nhap
    createdId = data.id;
  });

  test('TC_SURVEY_014 - Thieu truong name => 400', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/v1/survey/surveys', {
      data: {
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: TEST_ORGANIZATION_ID,
        methods: [1],
      },
    });
    expect(res.status()).toBe(400);
  });

  test('TC_SURVEY_015 - Gui duyet (status=2) nhung khong co cau hoi => 400', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/v1/survey/surveys', {
      data: {
        name: `[Auto-test] Khao sat thieu cau hoi ${uniqueSuffix()}`,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: TEST_ORGANIZATION_ID,
        methods: [1],
        status: 2,
        questions: [],
      },
    });
    expect(res.status()).toBe(400);
  });

  test('TC_SURVEY_036 - organizationId khong ton tai => 400', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/v1/survey/surveys', {
      data: {
        name: `[Auto-test] Khao sat sai don vi ${uniqueSuffix()}`,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: '00000000-0000-0000-0000-000000000000',
        methods: [1],
      },
    });
    expect(res.status()).toBe(400);
  });

  test('TC_SURVEY_026, 030 - Sua khao sat dang Nhap roi xoa', async ({ authedRequest }) => {
    // Tao truoc 1 khao sat nhap de sua/xoa
    const createRes = await authedRequest.post('/api/v1/survey/surveys', {
      data: {
        name: `[Auto-test] Khao sat de sua ${uniqueSuffix()}`,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: TEST_ORGANIZATION_ID,
        voteTarget: 10,
        methods: [1],
      },
    });
    expect(createRes.status()).toBe(200);
    const created = (await createRes.json()).data;
    createdId = created.id;

    // TC_SURVEY_026: sua thong tin
    const newName = `[Auto-test] Khao sat da sua ${uniqueSuffix()}`;
    const updateRes = await authedRequest.put(`/api/v1/survey/surveys/${createdId}`, {
      data: {
        name: newName,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: TEST_ORGANIZATION_ID,
        voteTarget: 20,
        methods: [1, 2],
      },
    });
    expect(updateRes.status()).toBe(200);
    const updated = (await updateRes.json()).data;
    expect(updated.name).toBe(newName);
    expect(updated.voteTarget).toBe(20);

    // TC_SURVEY_030: xoa va xac nhan da xoa
    const deleteRes = await authedRequest.delete(`/api/v1/survey/surveys/${createdId}`);
    expect(deleteRes.status()).toBe(200);

    const getAfterDelete = await authedRequest.get(`/api/v1/survey/surveys/${createdId}`);
    expect(getAfterDelete.status()).toBe(404);

    createdId = undefined; // da xoa roi, khong can afterEach xoa lai
  });

  test('TC_SURVEY_029 - Sua khao sat voi id khong ton tai => 404', async ({ authedRequest }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authedRequest.put(`/api/v1/survey/surveys/${fakeId}`, {
      data: { name: 'x', organizationId: TEST_ORGANIZATION_ID, methods: [1] },
    });
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEY_031 - Xoa khao sat voi id khong ton tai => 404', async ({ authedRequest }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authedRequest.delete(`/api/v1/survey/surveys/${fakeId}`);
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEY_013, 032 - Tao khao sat kem cau hoi, gui duyet roi phe duyet', async ({ authedRequest }) => {
    const createRes = await authedRequest.post('/api/v1/survey/surveys', {
      data: {
        name: `[Auto-test] Khao sat gui duyet ${uniqueSuffix()}`,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: TEST_ORGANIZATION_ID,
        voteTarget: 30,
        methods: [1],
        status: 2, // Cho phe duyet
        questions: [{ content: 'Ban co hai long voi dich vu cong truc tuyen khong?', type: 1, order: 1 }],
      },
    });
    expect(createRes.status()).toBe(200);
    const created = (await createRes.json()).data;
    createdId = created.id;
    expect(created.status).toBe(2);

    const approveRes = await authedRequest.put(`/api/v1/survey/surveys/${createdId}/status`, {
      data: { status: 3 }, // Da phe duyet
    });
    expect(approveRes.status()).toBe(200);
    const approved = (await approveRes.json()).data;
    expect(approved.status).toBe(3);
  });

  test('TC_SURVEY_033 - Tu choi phe duyet khao sat', async ({ authedRequest }) => {
    const createRes = await authedRequest.post('/api/v1/survey/surveys', {
      data: {
        name: `[Auto-test] Khao sat tu choi ${uniqueSuffix()}`,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: TEST_ORGANIZATION_ID,
        methods: [1],
        status: 2,
        questions: [{ content: 'Cau hoi test', type: 1, order: 1 }],
      },
    });
    expect(createRes.status()).toBe(200);
    const created = (await createRes.json()).data;
    createdId = created.id;

    const rejectRes = await authedRequest.put(`/api/v1/survey/surveys/${createdId}/status`, {
      data: { status: 4 }, // Bi tu choi
    });
    expect(rejectRes.status()).toBe(200);
    const rejected = (await rejectRes.json()).data;
    expect(rejected.status).toBe(4);
  });

  // =====================================================================================
  // Bo sung tu manifest_survey_mutation.json (61 TC) - xem AGENT_GUIDELINES.md.
  // Cac TC voi expected_result ghi "CAN XAC NHAN" dung assertion chap nhan nhieu gia tri hop le.
  // =====================================================================================

  test.describe('POST /api/v1/survey/surveys - bo sung tu manifest', () => {
    test('TC_SURVEY_013b - Tao khao sat nhieu hinh thuc, nhieu cau hoi, du truong tuy chon', async ({ authedRequest }) => {
      const questions = Array.from({ length: 5 }, (_, i) => ({
        content: `Cau hoi so ${i + 1}`,
        type: 1,
        order: i + 1,
      }));
      const res = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({
          description: `[Auto-test] Mo ta ${uniqueSuffix()}`,
          methods: [1, 2, 3],
          questions,
        }),
      });
      expect(res.status()).toBe(200);
      const data = (await res.json()).data;
      createdIds.push(data.id);
      expect([...data.methods].sort()).toEqual([1, 2, 3]);
      if (Array.isArray(data.methodNames)) {
        expect(data.methodNames.length).toBe(3);
      }
      expect(data.questions).toHaveLength(5);
      const orders = data.questions.map((q: any) => q.order);
      expect(orders).toEqual([1, 2, 3, 4, 5]);
    });

    test('TC_SURVEY_BV_010, BV_011, 018 - bien do dai truong name (1, 300, 301 ky tu)', async ({ authedRequest }) => {
      // BV_010: 300 ky tu - bien toi da hop le
      const name300 = 'A'.repeat(300);
      const res300 = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ name: name300 }) });
      expect(res300.status()).toBe(200);
      const data300 = (await res300.json()).data;
      createdIds.push(data300.id);
      expect(data300.name.length).toBe(300);

      // BV_011: 1 ky tu - bien toi thieu hop le
      const resA = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ name: 'A' }) });
      expect(resA.status()).toBe(200);
      const dataA = (await resA.json()).data;
      createdIds.push(dataA.id);
      expect(dataA.name).toBe('A');

      // TC_SURVEY_018: 301 ky tu - vuot qua gioi han, tu choi
      const name301 = 'A'.repeat(301);
      const res301 = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ name: name301 }) });
      expect(res301.status()).toBe(400);
    });

    test('TC_SURVEY_BV_012, BV_013, BV_014, BV_015 - cac bien cua voteTarget', async ({ authedRequest }) => {
      // BV_012: voteTarget = 0 -> 200
      const res0 = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ voteTarget: 0 }) });
      expect(res0.status()).toBe(200);
      const data0 = (await res0.json()).data;
      createdIds.push(data0.id);
      expect(data0.voteTarget).toBe(0);

      // BV_013: voteTarget = -1 -> CAN XAC NHAN (schema hien khong rang buoc) - chap nhan 200 hoac 400
      const resNeg = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ voteTarget: -1 }) });
      expect([200, 400]).toContain(resNeg.status());
      if (resNeg.status() === 200) {
        createdIds.push((await resNeg.json()).data.id);
      }

      // BV_014: voteTarget = Int32.MaxValue -> 200, luu dung gia tri
      const resMax = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ voteTarget: 2147483647 }) });
      expect(resMax.status()).toBe(200);
      const dataMax = (await resMax.json()).data;
      createdIds.push(dataMax.id);
      expect(dataMax.voteTarget).toBe(2147483647);

      // BV_015: voteTarget vuot Int32.MaxValue -> 400 (loi parse/overflow)
      const resOverflow = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ voteTarget: 99999999999 }),
      });
      expect(resOverflow.status()).toBe(400);
    });

    test('TC_SURVEY_BV_016, 017, BV_017, BV_018, BV_019 - cac bien startDate/endDate', async ({ authedRequest }) => {
      // BV_016: startDate = endDate -> CAN XAC NHAN - chap nhan 200 hoac 400
      const sameDate = '2026-11-15T00:00:00Z';
      const resSame = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ startDate: sameDate, endDate: sameDate }),
      });
      expect([200, 400]).toContain(resSame.status());
      if (resSame.status() === 200) {
        createdIds.push((await resSame.json()).data.id);
      }

      // TC_SURVEY_017: endDate truoc startDate -> 400
      const resReversed = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ startDate: '2026-11-30T00:00:00Z', endDate: '2026-11-01T00:00:00Z' }),
      });
      expect(resReversed.status()).toBe(400);

      // BV_017: startDate rat xa trong qua khu (nam 2000) -> CAN XAC NHAN - chap nhan 200 hoac 400
      const resPast = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ startDate: '2000-01-01T00:00:00Z', endDate: '2000-02-01T00:00:00Z' }),
      });
      expect([200, 400]).toContain(resPast.status());
      if (resPast.status() === 200) {
        createdIds.push((await resPast.json()).data.id);
      }

      // BV_018: startDate/endDate rat xa trong tuong lai (nam 2100) -> CAN XAC NHAN - chap nhan 200 hoac 400
      const resFuture = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ startDate: '2100-01-01T00:00:00Z', endDate: '2100-02-01T00:00:00Z' }),
      });
      expect([200, 400]).toContain(resFuture.status());
      if (resFuture.status() === 200) {
        createdIds.push((await resFuture.json()).data.id);
      }

      // BV_019: khong truyen startDate/endDate -> CAN XAC NHAN - chap nhan 200 hoac 400
      const payloadNoDates: any = surveyPayload();
      delete payloadNoDates.startDate;
      delete payloadNoDates.endDate;
      const resNoDates = await authedRequest.post('/api/v1/survey/surveys', { data: payloadNoDates });
      expect([200, 400]).toContain(resNoDates.status());
      if (resNoDates.status() === 200) {
        createdIds.push((await resNoDates.json()).data.id);
      }
    });

    test('TC_SURVEY_014b, 014c, 014d - name rong / toan khoang trang / null', async ({ authedRequest }) => {
      // 014b: name = "" -> 400
      const resEmpty = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ name: '' }) });
      expect(resEmpty.status()).toBe(400);

      // 014c: name = "     " -> CAN XAC NHAN (400 neu co trim+validate rong, 200 neu khong trim)
      const resSpaces = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ name: '     ' }) });
      expect([200, 400]).toContain(resSpaces.status());
      if (resSpaces.status() === 200) {
        createdIds.push((await resSpaces.json()).data.id);
      }

      // 014d: name = null (gui tuong minh) -> 400
      const resNull = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ name: null }) });
      expect(resNull.status()).toBe(400);
    });

    test('TC_SURVEY_016, NEG_001 - methods rong / khong truyen truong methods', async ({ authedRequest }) => {
      // TC_SURVEY_016: methods = []
      const resEmpty = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ methods: [] }) });
      expect(resEmpty.status()).toBe(400);

      // NEG_001: khong truyen truong methods
      const payloadNoMethods: any = surveyPayload();
      delete payloadNoMethods.methods;
      const resMissing = await authedRequest.post('/api/v1/survey/surveys', { data: payloadNoMethods });
      expect(resMissing.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_002 - methods chua gia tri enum khong hop le (4, 0, -1)', async ({ authedRequest }) => {
      for (const m of [4, 0, -1]) {
        const res = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ methods: [m] }) });
        expect(res.status()).toBe(400);
      }
    });

    test('TC_SURVEY_NEG_003 - methods chua gia tri trung lap [1,1,2]', async ({ authedRequest }) => {
      const res = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ methods: [1, 1, 2] }) });
      // CAN XAC NHAN: 200 (he thong tu loai trung) hoac 400 (validate khong cho trung)
      expect([200, 400]).toContain(res.status());
      if (res.status() === 200) {
        createdIds.push((await res.json()).data.id);
      }
    });

    test('TC_SURVEY_NEG_004 - cau hoi co content rong khi gui duyet (status=2)', async ({ authedRequest }) => {
      const res = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: '', type: 1, order: 1 }] }),
      });
      expect(res.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_005 - cau hoi co type khong hop le (99)', async ({ authedRequest }) => {
      const res = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ questions: [{ content: 'Cau hoi test', type: 99, order: 1 }] }),
      });
      expect(res.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_006 - 2 cau hoi co cung gia tri order', async ({ authedRequest }) => {
      const res = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({
          questions: [
            { content: 'Cau hoi A', type: 1, order: 1 },
            { content: 'Cau hoi B', type: 1, order: 1 },
          ],
        }),
      });
      // CAN XAC NHAN: 200 (order khong bat buoc duy nhat) hoac 400 (co rang buoc duy nhat)
      expect([200, 400]).toContain(res.status());
      if (res.status() === 200) {
        createdIds.push((await res.json()).data.id);
      }
    });

    test('TC_SURVEY_NEG_007 - organizationId sai dinh dang (khong phai uuid)', async ({ authedRequest }) => {
      const res = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ organizationId: 'khong-phai-uuid' }),
      });
      expect(res.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_008 - Body rong {}', async ({ authedRequest }) => {
      const res = await authedRequest.post('/api/v1/survey/surveys', { data: {} });
      expect(res.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_009 - Khong gui body hop le / sai Content-Type', async ({ authedRequest }) => {
      const res = await authedRequest.post('/api/v1/survey/surveys', {
        headers: { 'Content-Type': 'text/plain' },
        data: '',
      });
      expect([400, 415]).toContain(res.status());
    });

    test('TC_SURVEY_NEG_010 - Gui kem truong khong duoc dinh nghia (extra field)', async ({ authedRequest }) => {
      const res = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ hackerField: 'xyz' }),
      });
      expect(res.status()).toBe(200);
      const data = (await res.json()).data;
      createdIds.push(data.id);
      expect(data.hackerField).toBeUndefined();
    });

    test('TC_SURVEY_NEG_011 - status = 3 hoac 5 khi tao moi (bo qua quy trinh duyet)', async ({ authedRequest }) => {
      for (const status of [3, 5]) {
        const res = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload({ status }) });
        // CAN XAC NHAN quy tac nghiep vu: 400 (phai di qua quy trinh) hoac 200 (he thong tu gan)
        expect([200, 400]).toContain(res.status());
        if (res.status() === 200) {
          createdIds.push((await res.json()).data.id);
        }
      }
    });

    test('TC_SURVEY_SEC_010 - [Security] name/description chua script, luu nguyen ban', async ({ authedRequest }) => {
      const xssName = '<script>alert(1)</script>';
      const xssDesc = '<img src=x onerror=alert(1)>';
      const res = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ name: xssName, description: xssDesc }),
      });
      expect(res.status()).toBe(200);
      const data = (await res.json()).data;
      createdIds.push(data.id);

      const getRes = await authedRequest.get(`/api/v1/survey/surveys/${data.id}`);
      expect(getRes.status()).toBe(200);
      const getData = (await getRes.json()).data;
      expect(getData.name).toBe(xssName);
      if (getData.description !== undefined && getData.description !== null) {
        expect(getData.description).toBe(xssDesc);
      }
    });

    test('TC_SURVEY_SEC_011 - [Security] Tao khao sat khi khong co token => 401', async ({
      authedRequest,
      playwright,
      baseURL,
    }) => {
      const countsBefore = (await (await authedRequest.get('/api/v1/survey/surveys/counts')).json()).data;

      const anonCtx = await playwright.request.newContext({ baseURL });
      const res = await anonCtx.post('/api/v1/survey/surveys', { data: surveyPayload() });
      expect(res.status()).toBe(401);
      await anonCtx.dispose();

      if (typeof countsBefore?.total === 'number') {
        const countsAfter = (await (await authedRequest.get('/api/v1/survey/surveys/counts')).json()).data;
        expect(countsAfter.total).toBe(countsBefore.total);
      }
    });

    test('TC_SURVEY_DC_010 - Ma code tu sinh khong trung lap khi tao lien tiep cung nam', async ({ authedRequest }) => {
      const codes: string[] = [];
      for (let i = 0; i < 3; i++) {
        const res = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
        expect(res.status()).toBe(200);
        const data = (await res.json()).data;
        createdIds.push(data.id);
        codes.push(data.code);
      }
      expect(new Set(codes).size).toBe(codes.length);
    });
  });

  test.describe('PUT /api/v1/survey/surveys/{id} - bo sung tu manifest', () => {
    test('TC_SURVEY_027 - Sua khao sat va gui duyet (status=2) kem cau hoi', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      expect(createRes.status()).toBe(200);
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi gui duyet', type: 1, order: 1 }] }),
      });
      expect(putRes.status()).toBe(200);
      expect((await putRes.json()).data.status).toBe(2);
    });

    test('TC_SURVEY_027b - Sua khao sat dang Bi tu choi (status=4) - sua lai va gui duyet', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      expect(createRes.status()).toBe(200);
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const rejectRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 4 } });
      expect(rejectRes.status()).toBe(200);
      expect((await rejectRes.json()).data.status).toBe(4);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi sua lai', type: 1, order: 1 }] }),
      });
      expect(putRes.status()).toBe(200);
      expect((await putRes.json()).data.status).toBe(2);
    });

    test('TC_SURVEY_027c - PUT questions thay the toan bo cau hoi cu (khong phai THEM vao)', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({
          questions: [
            { content: 'Cau hoi cu 1', type: 1, order: 1 },
            { content: 'Cau hoi cu 2', type: 1, order: 2 },
            { content: 'Cau hoi cu 3', type: 1, order: 3 },
          ],
        }),
      });
      expect(createRes.status()).toBe(200);
      const created = (await createRes.json()).data;
      createdIds.push(created.id);
      expect(created.questions).toHaveLength(3);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ questions: [{ content: 'Cau hoi moi duy nhat', type: 1, order: 1 }] }),
      });
      expect(putRes.status()).toBe(200);
      const updated = (await putRes.json()).data;
      expect(updated.questions).toHaveLength(1);
      expect(updated.questions[0].content).toBe('Cau hoi moi duy nhat');
    });

    test('TC_SURVEY_027d - PUT questions=[] trong khi status=1 (Nhap)', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ questions: [{ content: 'Cau hoi se bi xoa', type: 1, order: 1 }] }),
      });
      expect(createRes.status()).toBe(200);
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ status: 1, questions: [] }),
      });
      expect(putRes.status()).toBe(200);
      expect((await putRes.json()).data.questions).toEqual([]);
    });

    test('TC_SURVEY_027e - Cap nhat organizationId sang 1 don vi khac hop le', async ({ authedRequest }) => {
      const listRes = await authedRequest.get('/api/v1/survey/surveys?page=1&size=50');
      const items = getPagedItems(await listRes.json());
      const altOrgId = items.map((it: any) => it.organizationId).find((id: string) => id && id !== TEST_ORGANIZATION_ID);
      test.skip(
        !altOrgId,
        'Khong tim thay organizationId hop le thu 2 nao (khac TEST_ORGANIZATION_ID) dang duoc dung boi ' +
          'khao sat co san tren he thong, nen khong co gia tri an toan de kiem tra chuyen doi don vi.'
      );

      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      expect(createRes.status()).toBe(200);
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ organizationId: altOrgId }),
      });
      expect(putRes.status()).toBe(200);
      expect((await putRes.json()).data.organizationId).toBe(altOrgId);
    });

    test('TC_SURVEY_028 - Sua khao sat dang Da phe duyet (status=3) - khong duoc phep sua', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      expect(createRes.status()).toBe(200);
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const approveRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 3 } });
      expect(approveRes.status()).toBe(200);
      expect((await approveRes.json()).data.status).toBe(3);

      const before = (await (await authedRequest.get(`/api/v1/survey/surveys/${created.id}`)).json()).data;

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ name: `[Auto-test] Khong duoc sua ${uniqueSuffix()}` }),
      });
      // CAN XAC NHAN ma HTTP status chinh xac (400 vs 409) - chi quan tam day la loi, khong phai 200
      expect([400, 409]).toContain(putRes.status());

      const after = (await (await authedRequest.get(`/api/v1/survey/surveys/${created.id}`)).json()).data;
      expect(after.name).toBe(before.name);
    });

    test('TC_SURVEY_028b - Sua khao sat dang Cho phe duyet (status=2) - khong duoc phep sua', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      expect(createRes.status()).toBe(200);
      const created = (await createRes.json()).data;
      createdIds.push(created.id);
      expect(created.status).toBe(2);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ name: `[Auto-test] Khong duoc sua ${uniqueSuffix()}` }),
      });
      expect([400, 409]).toContain(putRes.status());
    });

    test('TC_SURVEY_028c - Sua khao sat da Da ket thuc (status=6)', async () => {
      test.skip(
        true,
        'Khong co cach nao tu tao an toan 1 khao sat moi o trang thai Da ket thuc (status=6) qua API ' +
          '(README.md xac nhan he thong khong tu dong chuyen trang thai theo thoi gian va khong co endpoint ' +
          'chuyen thang sang status=6). Theo QUY TAC AN TOAN trong AGENT_GUIDELINES.md, TUYET DOI khong duoc ' +
          'dung 1 khao sat co san tren he thong (khong phai do test tu tao) de goi PUT len no.'
      );
    });

    test('TC_SURVEY_NEG_020 - PUT thieu truong bat buoc name', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const payload: any = surveyPayload();
      delete payload.name;
      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, { data: payload });
      expect(putRes.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_021 - PUT voi organizationId khong ton tai', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ organizationId: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(putRes.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_022 - PUT voi methods rong', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ methods: [] }),
      });
      expect(putRes.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_023 - PUT voi endDate truoc startDate', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const putRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ startDate: '2026-11-30T00:00:00Z', endDate: '2026-11-01T00:00:00Z' }),
      });
      expect(putRes.status()).toBe(400);
    });

    test('TC_SURVEY_NEG_024 - PUT voi id sai dinh dang (khong phai uuid)', async ({ authedRequest }) => {
      const res = await authedRequest.put('/api/v1/survey/surveys/abc-khong-phai-uuid', { data: surveyPayload() });
      expect(res.status()).toBe(404);
    });

    test('TC_SURVEY_SEC_030 - [Security] Sua khao sat khi khong co token => 401', async ({
      authedRequest,
      playwright,
      baseURL,
    }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const anonCtx = await playwright.request.newContext({ baseURL });
      const putRes = await anonCtx.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ name: `[Auto-test] Khong duoc sua ${uniqueSuffix()}` }),
      });
      expect(putRes.status()).toBe(401);
      await anonCtx.dispose();

      const getData = (await (await authedRequest.get(`/api/v1/survey/surveys/${created.id}`)).json()).data;
      expect(getData.name).toBe(created.name);
    });

    test('TC_SURVEY_IDEM_001 - Goi PUT 2 lan voi cung 1 body (idempotency)', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const bodyA = surveyPayload({ name: `[Auto-test] Idempotent ${uniqueSuffix()}` });
      const res1 = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, { data: bodyA });
      expect(res1.status()).toBe(200);
      const data1 = (await res1.json()).data;

      const res2 = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, { data: bodyA });
      expect(res2.status()).toBe(200);
      const data2 = (await res2.json()).data;

      expect(data2.name).toBe(data1.name);
      expect(data2.id).toBe(data1.id);
    });

    test('TC_SURVEY_RACE_001 - 2 request PUT dong thoi tren cung 1 khao sat', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const nameA = `[Auto-test] Race A ${uniqueSuffix()}`;
      const nameB = `[Auto-test] Race B ${uniqueSuffix()}`;
      const [resA, resB] = await Promise.all([
        authedRequest.put(`/api/v1/survey/surveys/${created.id}`, { data: surveyPayload({ name: nameA }) }),
        authedRequest.put(`/api/v1/survey/surveys/${created.id}`, { data: surveyPayload({ name: nameB }) }),
      ]);
      expect(resA.status()).not.toBe(500);
      expect(resB.status()).not.toBe(500);

      const finalData = (await (await authedRequest.get(`/api/v1/survey/surveys/${created.id}`)).json()).data;
      expect([nameA, nameB]).toContain(finalData.name);
    });
  });

  test.describe('DELETE /api/v1/survey/surveys/{id} - bo sung tu manifest', () => {
    test('TC_SURVEY_030b - Xoa khao sat roi kiem tra khong con trong danh sach/counts', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;

      const countsBefore = (await (await authedRequest.get('/api/v1/survey/surveys/counts')).json()).data;

      const deleteRes = await authedRequest.delete(`/api/v1/survey/surveys/${created.id}`);
      expect(deleteRes.status()).toBe(200);

      if (typeof countsBefore?.total === 'number') {
        const countsAfter = (await (await authedRequest.get('/api/v1/survey/surveys/counts')).json()).data;
        expect(countsAfter.total).toBe(countsBefore.total - 1);
      }

      const filter = encodeURIComponent(JSON.stringify({ keyword: created.code }));
      const items = getPagedItems(await (await authedRequest.get(`/api/v1/survey/surveys?filter=${filter}`)).json());
      expect(items.length).toBe(0);
    });

    test('TC_SURVEY_031b - Xoa khao sat dang Dang dien ra / da co ket qua', async () => {
      test.skip(
        true,
        'Khong the tu tao an toan 1 khao sat moi o trang thai Dang dien ra (status=5) qua API (khong co ' +
          'co che/endpoint chuyen trang thai theo thoi gian - xem README.md). Cung khong the tao resultCount > 0 ' +
          'ma khong dua khao sat qua status=5 truoc do (nop phieu cong khai yeu cau khao sat dang dien ra). ' +
          'Theo QUY TAC AN TOAN, khong duoc dung khao sat co san tren he thong de goi DELETE len no.'
      );
    });

    test('TC_SURVEY_031c - Xoa voi id sai dinh dang (khong phai uuid)', async ({ authedRequest }) => {
      const res = await authedRequest.delete('/api/v1/survey/surveys/abc-khong-phai-uuid');
      expect(res.status()).toBe(404);
    });

    test('TC_SURVEY_IDEM_002 - Goi DELETE 2 lan lien tiep tren cung 1 id', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;

      const res1 = await authedRequest.delete(`/api/v1/survey/surveys/${created.id}`);
      expect(res1.status()).toBe(200);

      const res2 = await authedRequest.delete(`/api/v1/survey/surveys/${created.id}`);
      expect(res2.status()).toBe(404);
    });

    test('TC_SURVEY_SEC_040 - [Security] Xoa khao sat khi khong co token => 401', async ({
      authedRequest,
      playwright,
      baseURL,
    }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const anonCtx = await playwright.request.newContext({ baseURL });
      const res = await anonCtx.delete(`/api/v1/survey/surveys/${created.id}`);
      expect(res.status()).toBe(401);
      await anonCtx.dispose();

      const getRes = await authedRequest.get(`/api/v1/survey/surveys/${created.id}`);
      expect(getRes.status()).toBe(200);
    });
  });

  test.describe('PUT /api/v1/survey/surveys/{id}/status - bo sung tu manifest', () => {
    test('TC_SURVEY_033b - Sau khi tu choi, sua lai va gui duyet lai thanh cong', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const rejectRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 4 } });
      expect(rejectRes.status()).toBe(200);

      const resubmitRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}`, {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      expect(resubmitRes.status()).toBe(200);
      expect((await resubmitRes.json()).data.status).toBe(2);

      const approveRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 3 } });
      expect(approveRes.status()).toBe(200);
      const finalData = (await approveRes.json()).data;
      expect(finalData.status).toBe(3);
      if (Array.isArray(finalData.histories)) {
        const statuses = finalData.histories.map((h: any) => h.status);
        expect(statuses).toEqual(expect.arrayContaining([1, 2, 4, 3]));
      }
    });

    test('TC_SURVEY_034 - Phe duyet khao sat dang Nhap (status=1) => 400/409', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', { data: surveyPayload() });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);
      expect(created.status).toBe(1);

      const res = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 3 } });
      expect([400, 409]).toContain(res.status());
    });

    test('TC_SURVEY_034b - Phe duyet khao sat da Da phe duyet (phe duyet 2 lan)', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const approveRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 3 } });
      expect(approveRes.status()).toBe(200);

      const res = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 3 } });
      expect([400, 409]).toContain(res.status());
    });

    test('TC_SURVEY_034c - Gui status = 1/5/6 qua API phe duyet (chi cho phep 3/4)', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      for (const status of [1, 5, 6]) {
        const res = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status } });
        expect(res.status()).toBe(400);
      }
    });

    test('TC_SURVEY_035 - Cap nhat status voi gia tri khong hop le (99)', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const res = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 99 } });
      expect(res.status()).toBe(400);
    });

    test('TC_SURVEY_035b - Phe duyet/tu choi voi id khong ton tai => 404', async ({ authedRequest }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await authedRequest.put(`/api/v1/survey/surveys/${fakeId}/status`, { data: { status: 3 } });
      expect(res.status()).toBe(404);
    });

    test('TC_SURVEY_NEG_030 - Khong truyen status trong body ({})', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const res = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: {} });
      expect(res.status()).toBe(400);
    });

    test('TC_SURVEY_SEC_050 - [Security] Phe duyet khi khong co token => 401', async ({
      authedRequest,
      playwright,
      baseURL,
    }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);

      const anonCtx = await playwright.request.newContext({ baseURL });
      const res = await anonCtx.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 3 } });
      expect(res.status()).toBe(401);
      await anonCtx.dispose();
    });

    test('TC_SURVEY_DC_040 - Sau khi tu choi, resultCount khong bi anh huong', async ({ authedRequest }) => {
      const createRes = await authedRequest.post('/api/v1/survey/surveys', {
        data: surveyPayload({ status: 2, questions: [{ content: 'Cau hoi', type: 1, order: 1 }] }),
      });
      const created = (await createRes.json()).data;
      createdIds.push(created.id);
      const resultCountBefore = created.resultCount;

      const res = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, { data: { status: 4 } });
      expect(res.status()).toBe(200);
      const data = (await res.json()).data;

      if (typeof resultCountBefore === 'number') {
        expect(data.resultCount).toBe(resultCountBefore);
      }
    });
  });
});
