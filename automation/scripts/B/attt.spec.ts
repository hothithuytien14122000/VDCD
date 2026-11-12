// ATTT cấp độ 2 — PHÂN HỆ B (Bộ chỉ số DTI). Testcase ATB-* (testcases/docs/catalog-ATTT.mjs, sheet "ATTT mức 2").
import { Made, code8, ensureGroup } from './common';
import { test, expect, at, call, logSnapshot, newLogs, expectLogs, registerModuleSuite, cleanupCreated } from '../attt';

const PIL = 'dti/pillars';
// Mã trụ cột do hệ thống tự sinh (TC-nnn, API bỏ qua `code` client gửi) → body không gửi code, lấy mã thật từ response.
const pilBody = (o: any = {}) => ({ name: `qc.automation ATTT ${Date.now().toString(36)}${code8().slice(3)}`, displayOrder: 0, ...o });
async function makePillar(o: any = {}) {
  const body = pilBody(o); const r = await call('POST', PIL, { body });
  if (r.status >= 300) throw new Error(`tạo trụ cột lỗi ${r.status} ${r.message}`);
  const id = r.data?.id as string;
  const code = String(r.data?.code ?? (await call('GET', `${PIL}/${id}`)).data?.code ?? id);
  return {
    id, code,
    update: async () => { const cur = (await call('GET', `${PIL}/${id}`)).data ?? body; return call('PUT', `${PIL}/${id}`, { body: { ...cur, name: `${body.name} sửa` } }); },
    remove: async () => { await call('PUT', `${PIL}/${id}/unlock`, { body: {} }); return call('DELETE', `${PIL}/${id}`); },
  };
}

registerModuleSuite('ATB', {
  mods: [
    { res: PIL, perm: 'DTI_PILLAR', route: 'pillars' }, { res: 'dti/indicator-groups', perm: 'DTI_INDICATOR_GROUP', route: 'indicator-groups' },
    { res: 'dti/indicators', perm: 'DTI_INDICATOR', route: 'indicators' }, { res: 'dti/indicator-sets', perm: 'DTI_INDICATOR_SET', route: 'indicator-sets' },
    { res: 'dti/score-scales', perm: 'DTI_SCORE_SCALE', route: 'score-scales' }, { res: 'dti/self-assessment-campaigns', perm: 'DTI_CAMPAIGN', route: 'self-assessment-campaigns' },
  ],
  make: () => makePillar(),
  invalid: {
    res: PIL, valid: () => pilBody(), cleanup: cleanupCreated(PIL),
    // Mã do hệ thống tự sinh (không còn nhập) → kiểm tra các trường người dùng còn nhập: Tên (≤ 255, bắt buộc), Thứ tự hiển thị (số nguyên)
    bodies: { 'tên 5.000 ký tự': pilBody({ name: 'x'.repeat(5000) }), 'displayOrder là chuỗi': pilBody({ displayOrder: 'abc' }), 'displayOrder vượt int (1e12)': pilBody({ displayOrder: 1e12 }), 'tên = null': pilBody({ name: null }), 'tên chỉ có khoảng trắng': pilBody({ name: '   ' }) },
  },
  biz: async () => {
    const x = await makePillar();
    await call('PUT', `${PIL}/${x.id}/lock`, { body: {} }); await call('PUT', `${PIL}/${x.id}/unlock`, { body: {} });
    return { re: new RegExp(`${x.code}|${x.id}`, 'i'), what: `khóa/mở khóa trụ cột ${x.code}`, done: async () => { await x.remove(); } };
  },
  xss: async name => {
    const r = await call('POST', PIL, { body: pilBody({ name }) });
    if (r.status >= 400 && r.status < 500) return { rejected: `${r.status} ${r.message}` };
    const id = r.data?.id; const code = (await call('GET', `${PIL}/${id}`)).data?.code ?? '';
    return { route: 'pillars', keyword: code, done: async () => { await call('DELETE', `${PIL}/${id}`); } };
  },
});

test.describe('ATTT ATB › Cấu hình & miền giá trị', () => {
  at('ATB-N07', async () => {
    const code = code8(); const r = await call('POST', 'dti/indicator-sets', { body: { code, name: `qc.automation ATTT Bộ ${code}`, effectiveYear: 2026 } });
    const id = r.data?.id;
    try {
      expect(r.status, `tạo bộ chỉ số: ${r.message}`).toBeLessThan(300);
      const snap = await logSnapshot();
      const cur = (await call('GET', `dti/indicator-sets/${id}`)).data;
      await call('PUT', `dti/indicator-sets/${id}`, { body: { ...cur, name: `${cur.name} sửa` } });
      const hit = expectLogs(await newLogs(snap), new RegExp(`${code}|${id}`, 'i'), `sửa cấu hình bộ chỉ số ${code}`);
      expect(hit.some(h => /old|new|before|after|truoc|sau|cu|moi/i.test(Object.keys(h).join(' '))), 'Bản ghi không có giá trị trước → sau').toBe(true);
    } finally { if (id) await call('DELETE', `dti/indicator-sets/${id}`); }
  });
  at('ATB-V05', async () => {
    const made = new Made(); const bad: string[] = [];
    try {
      const g = await ensureGroup(made);
      const ind = (o: any) => ({ indicatorGroupId: g.id, pillarId: g.pillarId, code: code8(), name: 'qc.automation ATTT chỉ số', minScore: 0, maxScore: 10, ...o });
      for (const [k, body] of Object.entries({ 'min > max': ind({ minScore: 10, maxScore: 1 }), 'điểm âm': ind({ minScore: -5 }), 'điểm là chuỗi': ind({ maxScore: 'abc' }) })) {
        const r = await call('POST', 'dti/indicators', { body }); if (r.status < 300 || r.status >= 500) bad.push(`chỉ số ${k} → ${r.status}`);
        if (r.status < 300) { if (r.data?.id) made.addId('dti/indicators', r.data.id); else made.addDti('dti/indicators', (body as any).name, 'nameHas'); }   // mã tự sinh → dọn theo id
      }
      for (const [k, levels] of Object.entries({ 'ngưỡng chồng lấn': [{ name: 'A', fromPercent: 0, toPercent: 60 }, { name: 'B', fromPercent: 50, toPercent: 100 }], 'ngưỡng > 100%': [{ name: 'A', fromPercent: 0, toPercent: 150 }] })) {
        const r = await call('POST', 'dti/score-scales', { body: { name: `qc.automation ATTT thang ${code8()}`, levels } });
        if (r.status < 300 || r.status >= 500) bad.push(`thang xếp loại ${k} → ${r.status}`);
        if (r.status < 300 && r.data?.id) made.addDti('dti/score-scales', r.data.id, 'id');
      }
    } finally { await made.clean(); }
    expect(bad, 'BE nhận giá trị ngoài miền hợp lệ').toEqual([]);
  });
});
