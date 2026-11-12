// ATTT cấp độ 2 — PHÂN HỆ E (Khảo sát hài lòng). Testcase ATE-* (testcases/docs/catalog-ATTT.mjs, sheet "ATTT mức 2").
import { payload, publicList, postPublic } from '../E/common';
import { test, expect, at, call, rowsOf, perms, liveRoles, FAKE, registerModuleSuite } from '../attt';

const SVY = 'survey/surveys';
async function makeSurvey(o: any = {}) {
  const body = payload(o); const r = await call('POST', SVY, { body });
  if (r.status >= 300) throw new Error(`tạo đợt khảo sát lỗi ${r.status} ${r.message}`);
  const id = r.data?.id as string;
  const remove = async () => { let x = await call('DELETE', `${SVY}/${id}`); if (x.status >= 400) { await call('PUT', `${SVY}/${id}/status`, { body: { status: 4, reason: 'dọn dữ liệu ATTT' } }); x = await call('DELETE', `${SVY}/${id}`); } return x; };
  return { id, code: String(r.data?.code ?? body.name), name: body.name,
    update: async () => { const cur = (await call('GET', `${SVY}/${id}`)).data ?? body; return call('PUT', `${SVY}/${id}`, { body: { ...cur, name: `${body.name} sửa` } }); }, remove };
}

registerModuleSuite('ATE', {
  mods: [{ res: SVY, perm: 'SURVEY', route: 'survey-campaigns' }],
  make: async () => { const x = await makeSurvey(); return { ...x, code: `${x.code}|${x.name.split(' ').pop()}` }; },
  invalid: {
    res: SVY, valid: () => payload(), cleanup: async r => { if (r.status < 300 && r.data?.id) await call('DELETE', `${SVY}/${r.data.id}`); },
    bodies: { 'tên 5.000 ký tự': payload({ name: 'x'.repeat(5000) }), 'mục tiêu là chuỗi': payload({ voteTarget: 'abc' }), 'ngày sai định dạng': payload({ startDate: '31/31/2026' }), 'tên = null': payload({ name: null }) },
  },
  biz: async () => {
    const x = await makeSurvey();
    await call('PUT', `${SVY}/${x.id}/status`, { body: { status: 2 } });
    await call('PUT', `${SVY}/${x.id}/status`, { body: { status: 4, reason: 'qc.automation ATTT từ chối' } });
    return { re: new RegExp(`${x.id}|${x.name.split(' ').pop()}`, 'i'), what: `trình duyệt/từ chối đợt ${x.name}`, done: async () => { await x.remove(); } };
  },
  idor: async () => {
    for (const role of await liveRoles()) {
      if (!['unit', 'unitAndChildren'].includes((await perms(role)).get('SURVEY.VIEW') ?? '')) continue;
      const mine = new Set(rowsOf((await call('GET', `${SVY}?page=1&size=500`, { as: role })).data).map((x: any) => x.id));
      const other = rowsOf((await call('GET', `${SVY}?page=1&size=200`)).data).find((x: any) => !mine.has(x.id));
      if (other) return { role, url: `${SVY}/${other.id}` };
    }
    return 'Không có tài khoản QC nào xem đợt khảo sát theo phạm vi đơn vị';
  },
});

test.describe('ATTT ATE › API công khai', () => {
  at('ATE-X04', async () => {
    const any = rowsOf((await call('GET', `${SVY}?page=1&size=1`)).data)[0]?.id ?? FAKE;
    const bad: string[] = [];
    for (const [m, u, b] of [['GET', SVY], ['GET', `${SVY}/${any}`], ['PUT', `${SVY}/${any}/status`, { status: 2 }], ['DELETE', `${SVY}/${FAKE}`]] as [string, string, any?][]) {
      const r = await call(m, u, { as: null, body: b }); if (r.status !== 401) bad.push(`${m} ${u} → ${r.status}`);
    }
    const pub = await publicList(1, 10);
    expect(pub.status, 'public/surveys phải truy cập được không token').toBe(200);
    const leak = rowsOf(pub.data).flatMap((x: any) => Object.keys(x).filter(k => /createdBy|history|voteTarget|responseCount|userId|lastModified|reason|organizationId/i.test(k)));
    expect(bad, 'API quản trị khảo sát truy cập được không token').toEqual([]);
    expect([...new Set(leak)], 'API công khai trả trường nội bộ').toEqual([]);
  });
  at('ATE-V04', async () => {
    const open = rowsOf((await publicList(1, 10)).data)[0];
    test.skip(!open, 'Không có đợt trực tuyến đang mở');
    const d = (await call('GET', `public/surveys/${open.id}`, { as: null })).data;
    const q = (d?.groups ?? []).flatMap((g: any) => g.questions ?? []).map((x: any) => x.id).filter(Boolean);
    test.skip(!q.length, 'Không đọc được danh sách câu hỏi của đợt công khai');
    const bad: string[] = [];
    const cases: [string, string, any][] = [
      ['câu không thuộc đợt', open.id, { channel: 1, answers: q.map((_: any, i: number) => ({ questionId: i ? q[i] : FAKE, result: 1 })) }],
      ['giá trị ngoài Hài lòng/Chưa hài lòng', open.id, { channel: 1, answers: q.map((id: string) => ({ questionId: id, result: 9 })) }],
      ['góp ý 10.000 ký tự', open.id, { channel: 1, note: 'x'.repeat(10000), answers: q.map((id: string) => ({ questionId: id, result: 'abc' })) }],
      ['đợt không tồn tại', FAKE, { channel: 1, answers: q.map((id: string) => ({ questionId: id, result: 1 })) }],
    ];
    for (const [k, sid, body] of cases) { const r = await postPublic(`public/surveys/${sid}/responses`, body); if (r.status < 400 || r.status >= 500) bad.push(`${k} → ${r.status}`); }
    expect(bad, 'BE nhận phiếu sai hoặc lỗi 500').toEqual([]);
  });
});
