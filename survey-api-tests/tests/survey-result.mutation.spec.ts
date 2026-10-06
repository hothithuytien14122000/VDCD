import { randomUUID } from 'crypto';
import {
  test,
  expect,
  MUTATION_ENABLED,
  TEST_ORGANIZATION_ID,
  uniqueSuffix,
  safeDeleteSurvey,
} from './helpers/api';

/**
 * Nhom API: SurveyResult - cac kich ban CO THAY DOI DU LIEU THAT (ghi nhan/sua/xoa phieu).
 * File test case tuong ung: testcases/SurveyResult/02_post_results.yaml, 04_put_result_by_id.yaml,
 *                            05_delete_result_by_id.yaml
 *
 * CHI chay khi RUN_MUTATION_TESTS=true (xem .env). Chay: npm run test:mutation
 *
 * Luu y quan trong: de ghi nhan duoc ket qua khao sat, khao sat phai dang o trang thai
 * "Dang dien ra" (status=5). Trang thai nay thuong duoc he thong tu chuyen sau khi khao sat
 * duoc phe duyet VA startDate <= thoi diem hien tai <= endDate (chuyen tu dong theo thoi gian,
 * khong co API chuyen thu cong). Test duoi day tao khao sat voi startDate trong qua khu gan va
 * endDate trong tuong lai gan, phe duyet xong roi kiem tra lai trang thai; neu he thong chua
 * chuyen sang "Dang dien ra" ngay lap tuc (vi du can 1 tien trinh nen chay dinh ky) thi test se
 * tu dong bi skip kem thong bao ro rang, thay vi bao fail sai.
 */

async function createApprovedInProgressSurvey(
  authedRequest: any,
  methods: number[] = [2],
  questionContents: string[] = ['Ban co hai long voi dich vu cong truc tiep khong?']
) {
  const now = Date.now();
  const startDate = new Date(now - 60 * 60 * 1000).toISOString(); // 1 gio truoc
  const endDate = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 1 ngay sau

  const createRes = await authedRequest.post('/api/v1/survey/surveys', {
    data: {
      name: `[Auto-test] Khao sat nhap ket qua ${uniqueSuffix()}`,
      startDate,
      endDate,
      organizationId: TEST_ORGANIZATION_ID,
      voteTarget: 10,
      methods, // vd [2]=Truc tiep, [2,3]=Truc tiep + Gian tiep qua phieu
      status: 2, // Cho phe duyet
      questions: questionContents.map((content, idx) => ({ content, type: 1, order: idx + 1 })),
    },
  });
  if (createRes.status() !== 200) return { survey: null, questions: [] };
  const created = (await createRes.json()).data;

  const approveRes = await authedRequest.put(`/api/v1/survey/surveys/${created.id}/status`, {
    data: { status: 3 }, // Da phe duyet
  });
  if (approveRes.status() !== 200) return { survey: created, questions: created.questions ?? [] };

  const detailRes = await authedRequest.get(`/api/v1/survey/surveys/${created.id}`);
  const detail = (await detailRes.json()).data;
  return { survey: detail, questions: detail?.questions ?? [] };
}

/** Tao 1 khao sat toi gian (KHONG phe duyet, status mac dinh = Cho phe duyet) - dung cho cac
 *  test NEGATIVE kiem tra validate dau vao, KHONG can khao sat o trang thai "Dang dien ra". */
async function createPlainSurvey(authedRequest: any, methods: number[] = [2, 3], questionCount = 1) {
  const createRes = await authedRequest.post('/api/v1/survey/surveys', {
    data: {
      name: `[Auto-test] Khao sat validate dau vao ${uniqueSuffix()}`,
      startDate: '2026-11-01T00:00:00Z',
      endDate: '2026-11-30T00:00:00Z',
      organizationId: TEST_ORGANIZATION_ID,
      voteTarget: 10,
      methods,
      status: 2, // Cho phe duyet - KHONG phe duyet, khong can "Dang dien ra" vi day la loi validate dau vao
      questions: Array.from({ length: questionCount }, (_, idx) => ({
        content: `Cau hoi test so ${idx + 1}`,
        type: 1,
        order: idx + 1,
      })),
    },
  });
  if (createRes.status() !== 200) return { survey: null, questions: [] };
  const created = (await createRes.json()).data;
  return { survey: created, questions: created.questions ?? [] };
}

test.describe('SurveyResult - vong doi ghi nhan/sua/xoa ket qua (mutation)', () => {
  test.skip(!MUTATION_ENABLED, 'RUN_MUTATION_TESTS=false - bo qua cac test case thay doi du lieu that');
  test.skip(!TEST_ORGANIZATION_ID, 'Chua cau hinh TEST_ORGANIZATION_ID trong .env');

  let surveyId: string | undefined;
  // Danh sach phu de don dep khi 1 test can tao NHIEU khao sat/ket qua (vd: kiem tra IDOR giua
  // 2 khao sat, hoac nhieu bien the trong cung 1 test). Xoa ket qua TRUOC, khao sat SAU (nguoc
  // thu tu tao) - xoa khao sat se tu xoa luon ket qua con nhung van xoa ket qua truoc cho chac.
  let surveyIdsToCleanup: string[] = [];
  let resultIdsToCleanup: { surveyId: string; resultId: string }[] = [];

  test.afterEach(async ({ authedRequest }) => {
    // CANH BAO: nhieu test trong file nay PHE DUYET khao sat (status=3) de kiem tra ghi nhan ket
    // qua - mot khi da Da phe duyet, server KHONG CON API nao de dua ve trang thai xoa duoc nua
    // (da xac nhan thuc nghiem, xem helpers/api.ts safeDeleteSurvey). safeDeleteSurvey chi cuu
    // duoc cac khao sat con dang Cho phe duyet (status=2); khao sat da Da phe duyet se de lai
    // canh bao trong log thay vi am tham tao rac vinh vien khong ai biet.
    for (const { surveyId: sId, resultId } of resultIdsToCleanup) {
      await authedRequest.delete(`/api/v1/survey/surveys/${sId}/results/${resultId}`).catch(() => {});
    }
    resultIdsToCleanup = [];
    for (const sId of surveyIdsToCleanup) {
      await safeDeleteSurvey(authedRequest, sId);
    }
    surveyIdsToCleanup = [];
    if (surveyId) {
      await safeDeleteSurvey(authedRequest, surveyId);
      surveyId = undefined;
    }
  });

  test('TC_SURVEYRESULT_004, 008, 010, 014 - Ghi nhan, xem, sua, xoa 1 phieu ket qua', async ({ authedRequest }) => {
    const { survey, questions } = await createApprovedInProgressSurvey(authedRequest);
    test.skip(!survey, 'Khong tao/phe duyet duoc khao sat test');
    surveyId = survey.id;
    test.skip(
      survey.status !== 5,
      `Khao sat dang o status=${survey.status}, chua tu dong chuyen sang "Dang dien ra" (5) - ` +
        'co the he thong can tien trinh nen de cap nhat trang thai theo thoi gian. Bo qua test nay.'
    );
    test.skip(!questions?.length, 'Khao sat khong co cau hoi nao de tra loi');

    // TC_SURVEYRESULT_004: ghi nhan ket qua
    const createResultRes = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: {
        method: 2,
        note: 'Phieu test tu dong',
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
      },
    });
    expect([200, 201]).toContain(createResultRes.status());
    const createdResult = (await createResultRes.json()).data;
    expect(createdResult.id).toBeTruthy();

    // TC_SURVEYRESULT_008: xem chi tiet
    const getResultRes = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}/results/${createdResult.id}`);
    expect(getResultRes.status()).toBe(200);

    // TC_SURVEYRESULT_010: sua
    const updateResultRes = await authedRequest.put(`/api/v1/survey/surveys/${surveyId}/results/${createdResult.id}`, {
      data: {
        method: 2,
        note: 'Phieu test da sua',
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 2 })),
      },
    });
    expect(updateResultRes.status()).toBe(200);

    // TC_SURVEYRESULT_014: xoa va xac nhan
    const deleteResultRes = await authedRequest.delete(`/api/v1/survey/surveys/${surveyId}/results/${createdResult.id}`);
    expect(deleteResultRes.status()).toBe(200);

    const getAfterDelete = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}/results/${createdResult.id}`);
    expect(getAfterDelete.status()).toBe(404);
  });

  test('TC_SURVEYRESULT_005 - Hinh thuc khong thuoc dot khao sat => 400', async ({ authedRequest }) => {
    const { survey, questions } = await createApprovedInProgressSurvey(authedRequest);
    test.skip(!survey, 'Khong tao/phe duyet duoc khao sat test');
    surveyId = survey.id;
    test.skip(survey.status !== 5, `Khao sat dang o status=${survey.status}, chua "Dang dien ra"`);

    // Khao sat chi co method=2 (Truc tiep), thu gui method=3 (Gian tiep qua phieu)
    const res = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: {
        method: 3,
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
      },
    });
    expect(res.status()).toBe(400);
  });

  test('TC_SURVEYRESULT_006 - Thieu cau tra loi => 400', async ({ authedRequest }) => {
    const { survey, questions } = await createApprovedInProgressSurvey(authedRequest);
    test.skip(!survey, 'Khong tao/phe duyet duoc khao sat test');
    surveyId = survey.id;
    test.skip(survey.status !== 5, `Khao sat dang o status=${survey.status}, chua "Dang dien ra"`);
    test.skip(!questions?.length, 'Khao sat khong co cau hoi nao');

    const res = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: { method: 2, answers: [] }, // khong tra loi cau nao
    });
    expect(res.status()).toBe(400);
  });

  test('TC_SURVEYRESULT_007 - Khao sat chua "Dang dien ra" (van con Cho phe duyet) => 400', async ({ authedRequest }) => {
    const createRes = await authedRequest.post('/api/v1/survey/surveys', {
      data: {
        name: `[Auto-test] Khao sat chua duyet ${uniqueSuffix()}`,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
        organizationId: TEST_ORGANIZATION_ID,
        methods: [2],
        status: 2,
        questions: [{ content: 'Cau hoi test', type: 1, order: 1 }],
      },
    });
    const created = (await createRes.json()).data;
    surveyId = created.id;

    const res = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: { method: 2, answers: [{ surveyQuestionId: created.questions?.[0]?.id, result: 1 }] },
    });
    expect([400, 404, 409]).toContain(res.status());
  });

  // =====================================================================================
  // Mo rong tu manifest_surveyresult_mutation.json (28 TC). Xem AGENT_GUIDELINES.md va
  // comment dau file: he thong KHONG tu chuyen khao sat sang status=5 "Dang dien ra" qua API,
  // nen cac TC phu thuoc precondition nay se tu dong SKIP kem ly do ro rang (test.skip), giong
  // cac test hien co ben tren. Cac TC NEGATIVE thuan validate dau vao (khong phu thuoc status=5)
  // duoc chay THAT tren khao sat tu tao (chua phe duyet) de khong dung du lieu that cua he thong.
  // =====================================================================================

  test('TC_SURVEYRESULT_004b, 004c, 004d - POST bien the hop le: method Gian tiep, note optional, nhieu phieu lien tiep', async ({
    authedRequest,
  }) => {
    const { survey, questions } = await createApprovedInProgressSurvey(authedRequest, [2, 3]);
    test.skip(!survey, 'Khong tao/phe duyet duoc khao sat test');
    surveyId = survey.id;
    test.skip(
      survey.status !== 5,
      `Khao sat dang o status=${survey.status}, chua tu dong chuyen sang "Dang dien ra" (5) - ` +
        'khong the tao/sua/xoa ket qua that su. Bo qua test nay.'
    );
    test.skip(!questions?.length, 'Khao sat khong co cau hoi nao de tra loi');

    // TC_SURVEYRESULT_004b: method = 3 (Gian tiep qua phieu)
    const res004b = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: {
        method: 3,
        note: 'Phieu Gian tiep qua phieu - tu dong',
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
      },
    });
    expect(res004b.status()).toBe(200);
    const result004b = (await res004b.json()).data;
    expect(result004b.method).toBe(3);
    resultIdsToCleanup.push({ surveyId, resultId: result004b.id });

    // TC_SURVEYRESULT_004c: khong kem truong note (note la optional)
    const res004c = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: {
        method: 2,
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
      },
    });
    expect(res004c.status()).toBe(200);
    const result004c = (await res004c.json()).data;
    resultIdsToCleanup.push({ surveyId, resultId: result004c.id });

    // TC_SURVEYRESULT_004d: gui lien tiep 3 request hop le - code phai duy nhat, resultCount +3
    const beforeDetail = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}`);
    const resultCountBefore = (await beforeDetail.json()).data?.resultCount ?? 0;

    const codes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
        data: {
          method: 2,
          note: `Phieu lien tiep #${i + 1}`,
          answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
        },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()).data;
      expect(body.code).toBeTruthy();
      codes.push(body.code);
      resultIdsToCleanup.push({ surveyId, resultId: body.id });
    }
    expect(new Set(codes).size).toBe(3); // 3 ma phieu duy nhat, khong trung

    const afterDetail = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}`);
    const resultCountAfter = (await afterDetail.json()).data?.resultCount ?? 0;
    expect(resultCountAfter - resultCountBefore).toBe(3);
  });

  test('TC_SURVEYRESULT_NEG_001, SEC_011 - POST note dai / note chua script (XSS)', async ({ authedRequest }) => {
    const { survey, questions } = await createApprovedInProgressSurvey(authedRequest);
    test.skip(!survey, 'Khong tao/phe duyet duoc khao sat test');
    surveyId = survey.id;
    test.skip(
      survey.status !== 5,
      `Khao sat dang o status=${survey.status}, chua "Dang dien ra" - khong the ghi nhan ket qua that su.`
    );
    test.skip(!questions?.length, 'Khao sat khong co cau hoi nao de tra loi');

    // TC_SURVEYRESULT_NEG_001: note qua dai (10000 ky tu) - CAN XAC NHAN co gioi han do dai hay khong
    const longNote = 'a'.repeat(10000);
    const resLong = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: {
        method: 2,
        note: longNote,
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
      },
    });
    expect([200, 201, 400]).toContain(resLong.status());
    if ([200, 201].includes(resLong.status())) {
      const body = (await resLong.json()).data;
      resultIdsToCleanup.push({ surveyId, resultId: body.id });
    }

    // TC_SURVEYRESULT_SEC_011: note chua ma script (XSS) - phai luu duoc, khong crash
    const xssPayload = '<script>alert(1)</script>';
    const resXss = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: {
        method: 2,
        note: xssPayload,
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
      },
    });
    expect(resXss.status()).toBe(200);
    const xssResult = (await resXss.json()).data;
    resultIdsToCleanup.push({ surveyId, resultId: xssResult.id });
    // Du lieu duoc luu nguyen van (hoac encode an toan) - it nhat phai co mat, khong bi loai bo am tham
    expect(String(xssResult.note ?? '')).toContain('alert(1)');
  });

  test('TC_SURVEYRESULT_010b, 010c, 012, 012b - PUT bien the: doi method, doi toan bo cau tra loi, thieu cau tra loi, method khong hop le voi khao sat', async ({
    authedRequest,
  }) => {
    const { survey, questions } = await createApprovedInProgressSurvey(authedRequest, [2, 3], [
      'Cau hoi 1 - test PUT',
      'Cau hoi 2 - test PUT',
    ]);
    test.skip(!survey, 'Khong tao/phe duyet duoc khao sat test');
    surveyId = survey.id;
    test.skip(
      survey.status !== 5,
      `Khao sat dang o status=${survey.status}, chua "Dang dien ra" - khong the tao ket qua goc de sua.`
    );
    test.skip((questions?.length ?? 0) < 2, 'Khao sat khong co du 2 cau hoi de test PUT thieu cau tra loi');

    // Tao 1 ket qua goc (method = 2) de lam co so cho cac thao tac PUT ben duoi
    const createRes = await authedRequest.post(`/api/v1/survey/surveys/${surveyId}/results`, {
      data: {
        method: 2,
        note: 'Phieu goc - truoc khi sua',
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
      },
    });
    expect(createRes.status()).toBe(200);
    const created = (await createRes.json()).data;
    resultIdsToCleanup.push({ surveyId, resultId: created.id });

    // TC_SURVEYRESULT_010b: doi hinh thuc tu Truc tiep (2) sang Gian tiep qua phieu (3)
    const res010b = await authedRequest.put(`/api/v1/survey/surveys/${surveyId}/results/${created.id}`, {
      data: {
        method: 3,
        note: 'Da doi sang Gian tiep qua phieu',
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
      },
    });
    expect(res010b.status()).toBe(200);
    const updated010b = (await res010b.json()).data;
    expect(updated010b.method).toBe(3);

    // TC_SURVEYRESULT_010c: cap nhat lai toan bo cau tra loi (1 => 2)
    const res010c = await authedRequest.put(`/api/v1/survey/surveys/${surveyId}/results/${created.id}`, {
      data: {
        method: 3,
        note: 'Da doi toan bo sang Chua hai long',
        answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 2 })),
      },
    });
    expect(res010c.status()).toBe(200);
    const getAfter010c = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}/results/${created.id}`);
    expect(getAfter010c.status()).toBe(200);
    const detail010c = (await getAfter010c.json()).data;
    expect((detail010c.answers ?? []).every((a: any) => a.result === 2)).toBe(true);

    // TC_SURVEYRESULT_012: thieu cau tra loi (chi gui 1/2 cau hoi)
    const res012 = await authedRequest.put(`/api/v1/survey/surveys/${surveyId}/results/${created.id}`, {
      data: {
        method: 3,
        answers: [{ surveyQuestionId: questions[0].id, result: 1 }], // thieu cau hoi thu 2
      },
    });
    expect(res012.status()).toBe(400);

    // TC_SURVEYRESULT_012b: method hop le ve enum nhung KHONG thuoc danh sach hinh thuc cua khao sat
    // Dung 1 khao sat rieng chi co methods=[2] de dam bao method=3 chac chan khong thuoc danh sach
    const { survey: surveySingleMethod, questions: questionsSingleMethod } = await createApprovedInProgressSurvey(
      authedRequest,
      [2]
    );
    if (surveySingleMethod && surveySingleMethod.status === 5 && questionsSingleMethod?.length) {
      surveyIdsToCleanup.push(surveySingleMethod.id);
      const createRes2 = await authedRequest.post(`/api/v1/survey/surveys/${surveySingleMethod.id}/results`, {
        data: {
          method: 2,
          answers: questionsSingleMethod.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
        },
      });
      if (createRes2.status() === 200) {
        const created2 = (await createRes2.json()).data;
        resultIdsToCleanup.push({ surveyId: surveySingleMethod.id, resultId: created2.id });

        const res012b = await authedRequest.put(
          `/api/v1/survey/surveys/${surveySingleMethod.id}/results/${created2.id}`,
          {
            data: {
              method: 3, // khao sat chi co methods=[2]
              answers: questionsSingleMethod.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })),
            },
          }
        );
        expect(res012b.status()).toBe(400);
      }
    } else {
      // Cung bi chan boi gioi han "khong tu chuyen status=5" - ghi nhan rieng, khong lam fail ca test
      // eslint-disable-next-line no-console
      console.warn(
        'TC_SURVEYRESULT_012b: khong tao duoc khao sat rieng (methods=[2]) o status=5 de kiem tra method khong hop le - bo qua phan nay.'
      );
    }
  });

  test('TC_SURVEYRESULT_011 - PUT ket qua khi khao sat da "Da ket thuc" (status=6)', async () => {
    test.skip(
      true,
      'Khong co co che nao de chu dong chuyen khao sat sang "Da ket thuc" (status=6) qua API test tu dong, ' +
        'va cung khong the tao truoc 1 ket qua that de sua vi viec tao ket qua (POST) doi hoi khao sat phai o ' +
        'status=5 "Dang dien ra" - trang thai nay khong tu chuyen duoc qua API (xem ghi chu dau file). ' +
        'KHONG dung khao sat/ket qua co san cua he thong de tranh vi pham QUY TAC AN TOAN.'
    );
  });

  test('TC_SURVEYRESULT_011b - PUT phieu Truc tuyen (method=1, do cong dan gui) - khong duoc phep sua', async () => {
    test.skip(
      true,
      'Phieu Truc tuyen (method=1) chi duoc tao qua SurveyPublic khi khao sat dang "Dang dien ra" (status=5). ' +
        'Vi khong the tu dong chuyen khao sat sang status=5 qua API, khong co cach nao tu tao an toan 1 phieu ' +
        'Truc tuyen de test sua no. KHONG dung phieu Truc tuyen co san cua nguoi dan that de tranh vi pham QUY TAC AN TOAN.'
    );
  });

  test('TC_SURVEYRESULT_013 - PUT ket qua voi id khong ton tai => 404', async ({ authedRequest }) => {
    const { survey } = await createPlainSurvey(authedRequest);
    test.skip(!survey, 'Khong tao duoc khao sat test');
    surveyIdsToCleanup.push(survey.id);

    const fakeResultId = randomUUID();
    const res = await authedRequest.put(`/api/v1/survey/surveys/${survey.id}/results/${fakeResultId}`, {
      data: { method: 2, answers: [] },
    });
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYRESULT_005b, 005c, 006b, 006c, 006d, 006e - POST du lieu khong hop le (loi validate dau vao, khong can khao sat "Dang dien ra")', async ({
    authedRequest,
  }) => {
    // Day la cac TC validate dau vao thuan tuy (method/answers sai dinh dang) - theo
    // AGENT_GUIDELINES.md, co the chay that tren 1 khao sat BAT KY (tu test tu tao, CHUA phe
    // duyet) ma khong can dua no ve status=5, vi muc tieu la kiem tra he thong tu choi dau vao
    // sai (400), khong phai kiem tra logic rieng cua trang thai "Dang dien ra".
    const { survey, questions } = await createPlainSurvey(authedRequest, [2, 3], 1);
    test.skip(!survey, 'Khong tao duoc khao sat test');
    surveyIdsToCleanup.push(survey.id);
    const questionId = questions?.[0]?.id;

    // TC_SURVEYRESULT_005b: method = 1 (Truc tuyen) - khong duoc tao qua API quan tri
    const res005b = await authedRequest.post(`/api/v1/survey/surveys/${survey.id}/results`, {
      data: { method: 1, answers: questionId ? [{ surveyQuestionId: questionId, result: 1 }] : [] },
    });
    expect(res005b.status()).toBe(400);

    // TC_SURVEYRESULT_005c: method ngoai enum (99)
    const res005c = await authedRequest.post(`/api/v1/survey/surveys/${survey.id}/results`, {
      data: { method: 99, answers: questionId ? [{ surveyQuestionId: questionId, result: 1 }] : [] },
    });
    expect(res005c.status()).toBe(400);

    // TC_SURVEYRESULT_006b: answers = []
    const res006b = await authedRequest.post(`/api/v1/survey/surveys/${survey.id}/results`, {
      data: { method: 2, answers: [] },
    });
    expect(res006b.status()).toBe(400);

    // TC_SURVEYRESULT_006c: answers co surveyQuestionId khong thuoc khao sat
    const res006c = await authedRequest.post(`/api/v1/survey/surveys/${survey.id}/results`, {
      data: { method: 2, answers: [{ surveyQuestionId: randomUUID(), result: 1 }] },
    });
    expect(res006c.status()).toBe(400);

    // TC_SURVEYRESULT_006d: answers co result ngoai enum (3)
    const res006d = await authedRequest.post(`/api/v1/survey/surveys/${survey.id}/results`, {
      data: { method: 2, answers: questionId ? [{ surveyQuestionId: questionId, result: 3 }] : [] },
    });
    expect(res006d.status()).toBe(400);

    // TC_SURVEYRESULT_006e: answers co 1 cau hoi bi tra loi lap (duplicate surveyQuestionId) - CAN XAC NHAN
    if (questionId) {
      const res006e = await authedRequest.post(`/api/v1/survey/surveys/${survey.id}/results`, {
        data: {
          method: 2,
          answers: [
            { surveyQuestionId: questionId, result: 1 },
            { surveyQuestionId: questionId, result: 2 },
          ],
        },
      });
      expect([200, 201, 400]).toContain(res006e.status());
      if ([200, 201].includes(res006e.status())) {
        const body = (await res006e.json()).data;
        resultIdsToCleanup.push({ surveyId: survey.id, resultId: body.id });
      }
    }
  });

  test('TC_SURVEYRESULT_007b - POST voi surveyId khong ton tai => 404', async ({ authedRequest }) => {
    const fakeSurveyId = randomUUID();
    const res = await authedRequest.post(`/api/v1/survey/surveys/${fakeSurveyId}/results`, {
      data: { method: 2, answers: [{ surveyQuestionId: randomUUID(), result: 1 }] },
    });
    expect(res.status()).toBe(404);
  });

  test('TC_SURVEYRESULT_017, 017b, IDEM_001, DC_010 - DELETE: id khong ton tai, surveyId khong khop (IDOR), goi lap (idempotency), resultCount giam dung', async ({
    authedRequest,
  }) => {
    // TC_SURVEYRESULT_017: id khong ton tai (dung 1 khao sat rieng, khong can status=5)
    const { survey: plainSurvey } = await createPlainSurvey(authedRequest);
    test.skip(!plainSurvey, 'Khong tao duoc khao sat test cho TC_017');
    surveyIdsToCleanup.push(plainSurvey.id);
    const fakeResultId = randomUUID();
    const res017 = await authedRequest.delete(`/api/v1/survey/surveys/${plainSurvey.id}/results/${fakeResultId}`);
    expect(res017.status()).toBe(404);

    // Cac TC con lai can 1 ket qua that su ton tai => can khao sat A o status=5 "Dang dien ra"
    const { survey: surveyA, questions } = await createApprovedInProgressSurvey(authedRequest);
    test.skip(!surveyA, 'Khong tao/phe duyet duoc khao sat A');
    surveyId = surveyA.id;
    test.skip(
      surveyA.status !== 5,
      `Khao sat A dang o status=${surveyA.status}, chua "Dang dien ra" - khong the tao ket qua that de test DELETE.`
    );
    test.skip(!questions?.length, 'Khao sat A khong co cau hoi nao');

    const createRes = await authedRequest.post(`/api/v1/survey/surveys/${surveyA.id}/results`, {
      data: { method: 2, answers: questions.map((q: any) => ({ surveyQuestionId: q.id, result: 1 })) },
    });
    expect(createRes.status()).toBe(200);
    const createdResult = (await createRes.json()).data;
    resultIdsToCleanup.push({ surveyId: surveyA.id, resultId: createdResult.id });

    // TC_SURVEYRESULT_017b: khao sat B (bat ky trang thai) - DELETE id cua A qua duong dan cua B
    const { survey: surveyB } = await createPlainSurvey(authedRequest);
    if (surveyB) {
      surveyIdsToCleanup.push(surveyB.id);
      const res017b = await authedRequest.delete(`/api/v1/survey/surveys/${surveyB.id}/results/${createdResult.id}`);
      expect(res017b.status()).toBe(404);
      // Phieu thuoc khao sat A van con nguyen ven
      const getStillThere = await authedRequest.get(`/api/v1/survey/surveys/${surveyA.id}/results/${createdResult.id}`);
      expect(getStillThere.status()).toBe(200);
    }

    // TC_SURVEYRESULT_DC_010: ghi nhan resultCount truoc khi xoa that
    const beforeDetail = await authedRequest.get(`/api/v1/survey/surveys/${surveyA.id}`);
    const resultCountBefore = (await beforeDetail.json()).data?.resultCount ?? 0;

    const deleteRes = await authedRequest.delete(`/api/v1/survey/surveys/${surveyA.id}/results/${createdResult.id}`);
    expect(deleteRes.status()).toBe(200);

    const afterDetail = await authedRequest.get(`/api/v1/survey/surveys/${surveyA.id}`);
    const resultCountAfter = (await afterDetail.json()).data?.resultCount ?? 0;
    expect(resultCountBefore - resultCountAfter).toBe(1);

    // TC_SURVEYRESULT_IDEM_001: goi lai DELETE lan 2 tren cung id vua xoa => 404
    const deleteAgainRes = await authedRequest.delete(`/api/v1/survey/surveys/${surveyA.id}/results/${createdResult.id}`);
    expect(deleteAgainRes.status()).toBe(404);
  });

  test('TC_SURVEYRESULT_015 - DELETE phieu Truc tuyen (method=1, do cong dan gui) - phai bi tu choi', async () => {
    test.skip(
      true,
      'Phieu Truc tuyen (method=1) chi duoc tao qua SurveyPublic khi khao sat dang "Dang dien ra" (status=5). ' +
        'Vi khong the tu dong chuyen khao sat sang status=5 qua API, khong co cach nao tu tao an toan 1 phieu ' +
        'Truc tuyen de test xoa no. KHONG dung phieu Truc tuyen co san cua nguoi dan that de tranh vi pham QUY TAC AN TOAN.'
    );
  });

  test('TC_SURVEYRESULT_016 - DELETE phieu khi khao sat khong con "Dang dien ra" (da "Da ket thuc")', async () => {
    test.skip(
      true,
      'Khong co co che nao de chu dong chuyen khao sat sang "Da ket thuc" (status=6) qua API test tu dong, ' +
        'va cung khong the tao truoc 1 ket qua that de xoa vi viec tao ket qua (POST) doi hoi khao sat phai o ' +
        'status=5 "Dang dien ra" - trang thai nay khong tu chuyen duoc qua API (xem ghi chu dau file). ' +
        'KHONG dung khao sat/ket qua co san cua he thong de tranh vi pham QUY TAC AN TOAN.'
    );
  });

  test('TC_SURVEYRESULT_SEC_010, SEC_030, SEC_040 - Khong co token (Authorization) => 401 cho POST/PUT/DELETE results', async ({
    playwright,
    baseURL,
  }) => {
    const anonCtx = await playwright.request.newContext({ baseURL });
    const fakeSurveyId = randomUUID();
    const fakeResultId = randomUUID();
    try {
      // TC_SURVEYRESULT_SEC_010
      const resPost = await anonCtx.post(`/api/v1/survey/surveys/${fakeSurveyId}/results`, {
        data: { method: 2, answers: [] },
      });
      expect(resPost.status()).toBe(401);

      // TC_SURVEYRESULT_SEC_030
      const resPut = await anonCtx.put(`/api/v1/survey/surveys/${fakeSurveyId}/results/${fakeResultId}`, {
        data: { method: 2, answers: [] },
      });
      expect(resPut.status()).toBe(401);

      // TC_SURVEYRESULT_SEC_040
      const resDelete = await anonCtx.delete(`/api/v1/survey/surveys/${fakeSurveyId}/results/${fakeResultId}`);
      expect(resDelete.status()).toBe(401);
    } finally {
      await anonCtx.dispose();
    }
  });
});
