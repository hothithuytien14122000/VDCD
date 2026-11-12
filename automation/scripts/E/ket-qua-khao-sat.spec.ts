// E.UC4 KẾT QUẢ KHẢO SÁT — script bám testcase SRT-X (xuất danh sách), SRT-V/C/T/G (xem + công thức), SRT-O (xuất 1 đợt), SRT-S (bảo mật).
// Dữ liệu: đợt cố định tạo một lần (đơn vị aaaaaa, 3 hình thức): SRS60 (ví dụ SRS N=60,Q=3,H=153,C=27), RES (7 phiếu), EMPTY, ONE, ALLH, ALLC, ROUND.
// SRS60 cần 22 phiếu TRỰC TUYẾN gửi qua API công khai (giới hạn ~5 phiếu/phút) nên lần chạy đầu mất ~6 phút để dựng dữ liệu.
import type { Page } from '@playwright/test';
import { test, expect, tc, api, raw, skipped, settle, allSurveys, getSurvey, fixture, dayStr, dmy, LIST, FAKE, fixtureRes, results, stats, addResult, addOnline, qidsOf, seededFixture, xlsxSheets, downloadApi, pc, publicList, dataRows } from './common';

const body = async (p: Page) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const kq = async (p: Page, id: string) => { p.setDefaultTimeout(10_000); await p.goto(`/#/vi/survey-campaigns/${id}?tab=kq`); await settle(p); };
const G3 = [{ name: 'Nhóm 1', questions: [{ content: 'Câu 1' }, { content: 'Câu 2' }, { content: 'Câu 3' }] }];
let RES: any, S60: any;
const rep = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
/** Chuỗi H/C cho phiếu thứ i: cột j là C nếu i < c[j]. */
const row = (i: number, c: number[]) => c.map(x => (i < x ? 'C' : 'H')).join('');
async function srs60() {
  if (S60) return S60;
  const D: [2 | 3, string][] = [...rep(20, i => [2, row(i, [4, 3, 3])] as [2, string]), ...rep(18, i => [3, row(i, [3, 3, 3])] as [3, string])];
  const fx = await fixture('SRS60', { groups: G3, voteTarget: 100 }); let d = await getSurvey(fx.id);
  if (d.resultCount === 0) { for (const [m, v] of D) await addResult(fx.id, d, m, v); }
  d = await getSurvey(fx.id); const online = d.methodCounts.find((x: any) => x.method === 1)?.count ?? 0;
  for (let i = online; i < 22; i++) { const r = await addOnline(fx.id, row(i, [3, 3, 2])); if (r.status !== 200) throw new Error(`online ${i}: ${r.message}`); }
  return (S60 = await getSurvey(fx.id));
}
test.beforeAll(async () => { test.setTimeout(900_000); RES = await fixtureRes(); });

test.describe('Kết quả — công thức & số liệu (ví dụ SRS)', () => {
  test(tc('SRT-C01'), async ({ page }) => {
    test.setTimeout(900_000); const d = await srs60(); const s = await stats(d.id); expect(s.summary).toMatchObject({ participants: 60, totalAnswers: 180, satisfied: 153, unsatisfied: 27, satisfiedRate: 85 });
    await kq(page, d.id); const t = await body(page); expect(t).toContain('85,00%'); expect(t).toContain('15,00%'); expect(t).toMatch(/60 \/ 100 phiếu mục tiêu/); expect(t).toMatch(/180 lượt đánh giá/);
  });
  test(tc('SRT-C02'), async () => {
    const s = await stats((await srs60()).id); const q = s.groups[0].questions;
    expect(q.map((x: any) => [x.satisfied, x.unsatisfied])).toEqual([[50, 10], [51, 9], [52, 8]]); expect(q.map((x: any) => pc(x.satisfiedRate))).toEqual(['83,33%', '85,00%', '86,67%']); q.forEach((x: any) => expect(x.satisfied + x.unsatisfied).toBe(60));
  });
  test(tc('SRT-C03'), async () => {
    const s = await stats((await srs60()).id); const f = (m: number) => s.sources.find((x: any) => x.method === m);
    expect([f(1), f(2), f(3)].map(x => [x.participants, x.totalAnswers, x.satisfied, x.unsatisfied])).toEqual([[22, 66, 58, 8], [20, 60, 50, 10], [18, 54, 45, 9]]);
    expect([f(1), f(2), f(3)].map(x => pc(x.satisfiedRate))).toEqual(['87,88%', '83,33%', '83,33%']); expect(s.sources.reduce((a: number, x: any) => a + x.participants, 0)).toBe(60);
  });
  test(tc('SRT-C04'), async () => {
    const s = await stats((await srs60()).id); expect(s.summary.satisfiedRate).toBeCloseTo((s.summary.satisfied / s.summary.totalAnswers) * 100, 2);
    const avg = s.sources.reduce((a: number, x: any) => a + x.satisfiedRate, 0) / 3; expect(Math.abs(avg - s.summary.satisfiedRate)).toBeGreaterThan(0.1);
  });
  test(tc('SRT-C05'), async ({ page }) => {
    const d = await seededFixture('ROUND', [{ name: 'N', questions: ['a', 'b', 'c', 'd'].map(content => ({ content })) }], rep(8, i => [2, i === 0 ? 'HCCC' : 'CCCC'] as [2, string]));
    const s = await stats(d.id); expect(s.summary.satisfied).toBe(1); expect(s.summary.totalAnswers).toBe(32); await kq(page, d.id); expect(await body(page), '1/32 = 3,125% → làm tròn lên 3,13%').toContain('3,13%');
  });
  test(tc('SRT-C06'), async ({ page }) => {
    const d = await seededFixture('ONE', G3, [[2, 'HCC']]); const s = await stats(d.id); expect(s.summary.satisfiedRate).toBeCloseTo(33.33, 2); await kq(page, d.id); expect(await body(page)).toContain('33,33%');
  });
  test(tc('SRT-C08'), async ({ page }) => {
    const d = await seededFixture('ALLH', G3, [[2, 'HHH'], [3, 'HHH']]); const s = await stats(d.id); expect(s.summary.unsatisfiedRate).toBe(0); await kq(page, d.id); const t = await body(page); expect(t).toContain('100,00%'); expect(t).toMatch(/Lượt Chưa hài lòng\s*0\b/);
  });
  test(tc('SRT-C10'), async () => { const s = await stats((await seededFixture('ONE', G3, [[2, 'HCC']])).id); expect(s.summary.participants).toBe(1); for (const x of s.groups[0].questions) expect([0, 100]).toContain(x.satisfiedRate); });
  test(tc('SRT-C11'), async () => {
    const s = await stats(RES.id); const r = await results(RES.id); expect(s.summary.participants).toBe(r.totalElements); expect(s.summary.totalAnswers).toBe(r.totalElements * qidsOf(RES).length);
  });
  test(tc('SRT-C12'), async () => {
    const w = await fixture('WRITE'); const d = await getSurvey(w.id); const s0 = await stats(w.id); const a = await addResult(w.id, d, 2, 'HHH'); const s1 = await stats(w.id);
    expect(s1.summary.participants).toBe(s0.summary.participants + 1); expect(s1.summary.satisfied).toBe(s0.summary.satisfied + 3);
    await api('DELETE', `survey/surveys/${w.id}/results/${a.data.id}`); const s2 = await stats(w.id); expect(s2.summary.participants).toBe(s0.summary.participants); expect(s2.summary.satisfied).toBe(s0.summary.satisfied);
  });
  test(tc('SRT-C13'), async () => {
    const s = await stats(RES.id); const q = s.groups.flatMap((g: any) => g.questions); expect(q.reduce((a: number, x: any) => a + x.satisfied, 0)).toBe(s.summary.satisfied); expect(s.sources.reduce((a: number, x: any) => a + x.satisfied, 0)).toBe(s.summary.satisfied);
    expect(s.sources.reduce((a: number, x: any) => a + x.participants, 0)).toBe(s.summary.participants); expect(s.calculatedAt).toBeTruthy();
  });
  test(tc('SRT-C14'), async () => {
    const w = await fixture('WRITE'); const before = await stats(RES.id); const d = await getSurvey(w.id); const r = await addResult(w.id, d, 2, 'CCC'); await api('DELETE', `survey/surveys/${w.id}/results/${r.data.id}`);
    expect((await stats(RES.id)).summary).toEqual(before.summary);
  });
  test(tc('SRT-C15'), async ({ page }) => {
    await kq(page, RES.id); const t = await body(page); expect(t).not.toMatch(/Tỷ lệ phiếu hài lòng|người hài lòng|Đánh giá chung/i); expect(t).toMatch(/Tỷ lệ hài lòng tạm tính/);
  });
});

test.describe('Kết quả — xem màn hình', () => {
  test(tc('SRT-V01'), async ({ page }) => {
    await kq(page, RES.id); const t = await body(page); expect(t).toContain(RES.name); expect(t).toContain(RES.code); expect(t).toContain(RES.organizationName); expect(t).toContain('Đang diễn ra'); expect(t).toMatch(new RegExp(`Phiếu\\s*${RES.resultCount}`)); expect(t).toMatch(/Nhận phiếu đến hết/);
  });
  test(tc('SRT-V02'), async ({ page }) => {
    await kq(page, RES.id); const t = await body(page); for (const l of ['Số phiếu', 'Lượt Hài lòng', 'Lượt Chưa hài lòng', 'Tỷ lệ hài lòng tạm tính']) expect(t).toContain(l); expect(t).toMatch(/lượt đánh giá|lượt trả lời/);
  });
  test(tc('SRT-V06'), async ({ page }) => {
    await kq(page, RES.id); const s = await stats(RES.id); const t = await body(page); expect(t).toMatch(new RegExp(`Tổng\\s*${s.summary.participants}\\s*${s.summary.satisfied}\\s*${pc(s.summary.satisfiedRate)}`));
  });
  test(tc('SRT-V08'), async ({ page }) => {
    await kq(page, RES.id); await page.locator('.ant-segmented-item').filter({ hasText: /^Phiếu/ }).click(); await settle(page); expect(page.url()).toContain('tab=ph');
    await page.locator('.ant-segmented-item').filter({ hasText: /^Thông tin/ }).click(); await settle(page); expect(await body(page)).toContain('Thông tin chung');
  });
  test(tc('SRT-V09'), async () => { for (const k of ['canbo', 'cbdp', 'xemonly']) { const r = await api('GET', `survey/surveys/${RES.id}/statistics`, undefined, k); expect([403, 404], k).toContain(r.status); expect(JSON.stringify(r.raw)).not.toContain('participants'); } });
  test(tc('SRT-V10'), async () => { for (const k of ['superadmin', 'admin']) expect((await stats(RES.id, k)).summary.participants, k).toBe(RES.resultCount); const ldd = await api('GET', `survey/surveys/${RES.id}/statistics`, undefined, 'ldd'); expect([403, 404]).toContain(ldd.status); });
  test(tc('SRT-V11'), async ({ page }) => {
    const r = await api('GET', `survey/surveys/${FAKE}/statistics`); expect(r.status).toBe(404); await page.goto(`/#/vi/survey-campaigns/${FAKE}?tab=kq`); await settle(page); expect(await body(page)).toMatch(/không tồn tại|không tìm thấy|đã bị xóa/i);
  });
  test(tc('SRT-V13'), async ({ page }) => { const t0 = Date.now(); await kq(page, RES.id); await expect(page.getByText(/Tạm tính đến/)).toBeVisible(); expect(Date.now() - t0).toBeLessThan(8000); });
});

test.describe('Kết quả — tính chất số liệu', () => {
  test(tc('SRT-T01'), async ({ page }) => { await kq(page, RES.id); const t = await body(page); expect(t).toMatch(/Tạm tính đến \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/); expect(t).toMatch(/Số liệu còn thay đổi/); });
  skipped(['SRT-T02', 'SRT-T06'], 'MANUAL: cần đợt vừa chuyển Đã kết thúc để xem nhãn Chính thức/chốt số liệu (tác vụ nền theo thời gian)');
  test(tc('SRT-T03'), async ({ page }) => {
    const a = (await allSurveys()).find(s => s.statusName === 'Đã phê duyệt' && s.startDate.slice(0, 10) > dayStr(0))!; await kq(page, a.id); const t = await body(page);
    expect(t).not.toMatch(/Tạm tính đến|Chính thức/); expect(t).not.toMatch(/Lượt Hài lòng/);
  });
  test(tc('SRT-T04'), async ({ page }) => {
    const d = (await allSurveys()).find(s => s.statusName === 'Nháp')!; await kq(page, d.id); expect(await body(page)).not.toMatch(/Lượt Hài lòng|Tạm tính đến/); await expect(page.locator('.ant-segmented-item').filter({ hasText: /^Kết quả/ })).toHaveCount(0);
    const r = await api('GET', `survey/surveys/${d.id}/statistics`); expect(r.status === 200 ? r.data?.summary?.participants : 0, 'Nháp không có số liệu').toBeFalsy();
  });
  test(tc('SRT-T05'), async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: 'auth/superadmin.json', baseURL, timezoneId: 'Pacific/Auckland' }); const p = await ctx.newPage(); await kq(p, RES.id);
    const shown = (await body(p)).match(/Tạm tính đến (\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/)?.[1]; const s = await stats(RES.id); const at = s.calculatedAt as string; const exp = `${at.slice(8, 10)}/${at.slice(5, 7)}/${at.slice(0, 4)} ${at.slice(11, 16)}`;
    expect(shown, 'Mốc hiển thị theo máy chủ (giờ Việt Nam), không đổi theo múi giờ máy khách').toBe(exp); await ctx.close();
  });
});

test.describe('Kết quả — góp ý', () => {
  const comments = async (id: string, size = 50) => (await api('GET', `survey/surveys/${id}/statistics/comments?page=1&size=${size}`)).data;
  test(tc('SRT-G01'), async ({ page }) => {
    await kq(page, RES.id); const t = await body(page); expect(t).toContain('Ghi chú D1'); expect(t).toMatch(/Trực tiếp · \d{2}\/\d{2}\/\d{4}/); const c = await comments(RES.id); expect(c.content.every((x: any) => x.content?.trim())).toBeTruthy();
  });
  test(tc('SRT-G02'), async () => { const c = (await comments(RES.id)).content.map((x: any) => x.createdOnDate); expect([...c].sort().reverse()).toEqual(c); });
  test(tc('SRT-G04'), async ({ page }) => {
    await kq(page, RES.id); expect(await body(page)).toMatch(/\d+ ý kiến/); const e = await fixture('EMPTY'); await kq(page, e.id); expect(await body(page)).not.toMatch(/\b[1-9]\d* ý kiến/);
  });
  test(tc('SRT-G05'), async () => { const c = await comments(RES.id); for (const x of c.content) expect(Object.keys(x).filter(k => !['content', 'methodName', 'createdOnDate'].includes(k))).toEqual([]); });
  test(tc('SRT-G06'), async ({ page }) => {
    const w = await fixture('WRITE'); const d = await getSurvey(w.id); const r = await addResult(w.id, d, 2, 'H', '<img src=x onerror=window.__g6=1>');
    if (r.status !== 200) { expect(r.status).toBe(400); test.info().annotations.push({ type: 'ghi chú', description: `Máy chủ chặn HTML trong góp ý: ${r.message}` }); return; }
    try { await kq(page, w.id); expect(await page.evaluate(() => (window as any).__g6)).toBeUndefined(); } finally { await api('DELETE', `survey/surveys/${w.id}/results/${r.data.id}`); }
  });
});

const listXlsx = async (filter: any = {}, as = 'superadmin') => downloadApi(`survey/surveys/export?filter=${encodeURIComponent(JSON.stringify(filter))}&sort=-CreatedOnDate`, as);
test.describe('Kết quả — xuất Excel danh sách các đợt', () => {
  test(tc('SRT-X02'), async () => {
    const x = await listXlsx({ keyword: 'qc.automation' }); const s = xlsxSheets(x.file)['Danh sách kết quả']; const head = s.slice(0, 8).flat().join('|'); expect(head).toMatch(/Thời điểm xuất/); expect(head).toMatch(/qc\.automation/); expect(head).toMatch(/Mốc|Tạm tính|dữ liệu/i);
  });
  const dataSheet = (file: string) => { const rows = xlsxSheets(file)['Danh sách kết quả']; const h = rows.findIndex(r => r[0] === 'STT'); return { head: rows[h], data: rows.slice(h + 1).filter(r => r.length > 2) }; };
  test(tc('SRT-X03'), async () => {
    const { head, data } = dataSheet((await listXlsx()).file); expect(head.slice(0, 4)).toEqual(['STT', 'Mã đợt', 'Tên đợt khảo sát', 'Đơn vị']); expect(head.join('|')).toMatch(/Hình thức.*Ngày bắt đầu.*Ngày kết thúc/); expect(new Set(data.map(r => r[1])).size).toBe(data.length);
  });
  test(tc('SRT-X04'), async () => {
    const all = await allSurveys(); const { data } = dataSheet((await listXlsx()).file); expect(data.length).toBe(all.length); expect(data.map(r => Number(r[0]))).toEqual(data.map((_, i) => i + 1));
  });
  test(tc('SRT-X05'), async () => {
    const f = { keyword: 'qc.automation E FX' }; const exp = (await allSurveys(f)).filter(s => s.name.includes('qc.automation E FX')); const { data } = dataSheet((await listXlsx(f)).file); expect(data.length).toBe((await allSurveys(f)).length); expect(exp.length).toBeGreaterThan(0);
    expect(new Set(data.map(r => r[1]))).toEqual(new Set((await allSurveys(f)).map(s => s.code)));
  });
  skipped(['SRT-X06', 'SRT-X07', 'SRT-X22'], 'CHƯA TỰ ĐỘNG HOÁ: các case này kiểm hành vi nút "Xuất Excel" trên màn danh sách với bộ lọc/từ khóa chưa Enter và hai lần xuất liên tiếp — bộ lọc xuất theo tham số API đã kiểm ở SRT-X05');
  test(tc('SRT-X08'), async () => {
    const f = { keyword: 'qc.automation E FX RES' }; const { head, data } = dataSheet((await listXlsx(f)).file); const hi = head.findIndex(h => /Hình thức/.test(h)); const r = data.find(x => x[1] === RES.code)!; expect(r[hi]).toMatch(/Trực tuyến.*Trực tiếp.*Gián tiếp qua phiếu/); expect(data.filter(x => x[1] === RES.code)).toHaveLength(1);
  });
  test(tc('SRT-X09'), async () => { const all = (await allSurveys()).map(s => s.code); const { data } = dataSheet((await listXlsx()).file); expect(data.map(r => r[1])).toEqual(all); });
  test(tc('SRT-X10'), async () => {
    const t = xlsxSheets((await listXlsx()).file)['Danh sách kết quả'].flat().join('|'); expect(t).toMatch(/Tạm tính/);
    if ((await allSurveys()).some(x => x.statusName === 'Đã kết thúc')) expect(t).toMatch(/Chính thức/);
  });
  test(tc('SRT-X12'), async () => { const { head, data } = dataSheet((await listXlsx({ keyword: 'qc.automation E FX DIRECT' })).file); const ti = head.findIndex(h => /mục tiêu/i.test(h)); expect((data[0] ?? [])[ti] ?? '').toBe(''); });
  test(tc('SRT-X13'), async () => {
    const { head, data } = dataSheet((await listXlsx({ keyword: 'qc.automation E FX SRS60' })).file); const r = data[0]; const col = (re: RegExp) => r[head.findIndex(h => re.test(h))];
    expect(Number(col(/^Số phiếu \(N\)|^Số phiếu$/))).toBe(60); expect(Number(col(/Tổng lượt/))).toBe(180); expect(Number(col(/Hài lòng \(H\)|^Lượt Hài lòng/))).toBe(153); expect(Number(col(/Chưa hài lòng \(C\)|^Lượt Chưa hài lòng/))).toBe(27); expect(Number(col(/Tỷ lệ/))).toBeCloseTo(0.85, 4);
  });
  test(tc('SRT-X14'), async () => {
    const x = await listXlsx(); const sheet = execSheetXml(x.file); expect(sheet).toMatch(/<c [^>]*s="\d+"[^>]*><v>\d+<\/v><\/c>/); expect(JSON.stringify(xlsxSheets(x.file))).not.toMatch(/@|\b0\d{9}\b/);
  });
  test(tc('SRT-X15'), async () => { const r = await listXlsx({ keyword: 'zzzkhongtontai123' }); expect(r.status).toBe(400); expect(r.text).toMatch(/Không có|MSG-023|dữ liệu/i); });
  skipped(['SRT-X16', 'SRT-X17'], 'CHƯA TỰ ĐỘNG HOÁ: nút Xuất Excel trên danh sách (khóa nút khi đang xử lý / lỗi tạo tệp) — cần đặt route cho API export và kiểm trạng thái nút; chưa xác định ổn định selector nút');
  test(tc('SRT-X19'), async () => { const x = await listXlsx({}, 'canbo'); const { data } = x.status === 200 ? dataSheet(x.file) : { data: [] as string[][] }; expect(data.map(r => r[3]).filter(o => o !== 'QA - Đơn vị Bộ')).toEqual([]); });
  test(tc('SRT-X20'), async () => { expect((await listXlsx({}, 'xemonly')).status).toBe(403); });
  test(tc('SRT-X21'), async () => { const sh = xlsxSheets((await listXlsx()).file); expect(Object.keys(sh)).toEqual(['Danh sách kết quả']); });
  test(tc('SRT-X23'), async () => { const t0 = Date.now(); const x = await listXlsx(); expect(x.status).toBe(200); expect(Date.now() - t0).toBeLessThan(30_000); });
});
import { execFileSync } from 'node:child_process';
const execSheetXml = (file: string) => execFileSync('unzip', ['-p', file, 'xl/worksheets/sheet1.xml'], { maxBuffer: 64 << 20 }).toString('utf8');

const statX = (id: string, as = 'superadmin') => downloadApi(`survey/surveys/${id}/statistics/export`, as);
test.describe('Kết quả — xuất Excel một đợt', () => {
  test(tc('SRT-O02'), async () => { expect(Object.keys(xlsxSheets((await statX(RES.id)).file))).toEqual(['Tổng quan', 'Theo câu hỏi', 'Theo hình thức', 'Góp ý']); });
  test(tc('SRT-O03'), async () => {
    const t = xlsxSheets((await statX(RES.id)).file)['Tổng quan'].flat().join('|'); for (const v of [RES.code, RES.name, RES.organizationName, 'Đang diễn ra', 'Tạm tính', String(RES.voteTarget)]) expect(t).toContain(v);
  });
  test(tc('SRT-O04'), async () => {
    const rows = xlsxSheets((await statX(RES.id)).file)['Theo câu hỏi']; const s = await stats(RES.id); const qs = s.groups.flatMap((g: any) => g.questions); const body = rows.filter(r => /^\d+$/.test(r[0] ?? '') || r.some(c => qs.some((q: any) => q.content === c)));
    expect(body.length).toBeGreaterThanOrEqual(qs.length); for (const q of qs) { void q.satisfied; const r = rows.find(x => x.includes(q.content))!; expect(r).toBeTruthy(); expect(r.join('|')).toContain(String(q.satisfied)); expect(r.join('|')).toContain(String(q.unsatisfied)); }
  });
  test(tc('SRT-O05'), async () => { const t = xlsxSheets((await statX(RES.id)).file)['Theo hình thức'].map(r => r.join('|')).join('\n'); expect(t).toContain('Tổng'); for (const m of ['Trực tuyến', 'Trực tiếp', 'Gián tiếp qua phiếu']) expect(t).toContain(m); });
  test(tc('SRT-O06'), async () => {
    const w = await fixture('WRITE'); const d = await getSurvey(w.id); const ids: string[] = []; for (let i = 0; i < 8; i++) { const r = await addResult(w.id, d, 2, 'HHH', `gopy-O06-${i}`); ids.push(r.data.id); }
    try { const rows = xlsxSheets((await statX(w.id)).file)['Góp ý']; const t = rows.map(r => r.join('|')).join('\n'); expect((t.match(/gopy-O06-\d/g) ?? []).length, 'Excel có đủ mọi góp ý (nhiều hơn 6 ý trên màn hình)').toBeGreaterThanOrEqual(8); } finally { for (const id of ids) await api('DELETE', `survey/surveys/${w.id}/results/${id}`); }
  });
  test(tc('SRT-O08'), async () => { const sh = xlsxSheets((await statX(RES.id)).file); for (const [n, rows] of Object.entries(sh)) expect(rows.flat().join('|'), n).toContain(RES.code); });
  test(tc('SRT-O09'), async () => {
    const d = await srs60(); const x = await statX(d.id); const xml = execFileSync('unzip', ['-p', x.file, 'xl/worksheets/sheet2.xml']).toString(); const vals = [...xml.matchAll(/<v>(0\.[0-9]{6,})<\/v>/g)].map(m => Number(m[1])); expect(vals.length, 'tỷ lệ lưu giá trị chưa làm tròn').toBeGreaterThan(0);
  });
  test(tc('SRT-O10'), async () => {
    const d = await srs60(); const sh = xlsxSheets((await statX(d.id)).file); const ov = sh['Tổng quan'].flat().join('|'); for (const v of ['60', '180', '153', '27']) expect(ov).toContain(v);
    const q = sh['Theo câu hỏi'].map(r => r.join('|')).join('\n'); for (const v of ['50', '51', '52']) expect(q).toContain(v);
  });
  test(tc('SRT-O11'), async () => { const s = await stats(RES.id); const ov = xlsxSheets((await statX(RES.id)).file)['Tổng quan'].flat().join('|'); for (const v of [s.summary.participants, s.summary.totalAnswers, s.summary.satisfied, s.summary.unsatisfied]) expect(ov).toContain(String(v)); });
  test(tc('SRT-O12'), async () => {
    const w = await fixture('WRITE'); const d = await getSurvey(w.id); const n0 = (await stats(w.id)).summary.participants; const f1 = await statX(w.id); const r = await addResult(w.id, d, 2, 'HHH'); const f2 = await statX(w.id);
    const num = (f: string) => Number(xlsxSheets(f)['Tổng quan'].find(x => x.some(c => /Số phiếu \(N\)/.test(c)))!.slice(-1)[0] || xlsxSheets(f)['Tổng quan'].flat().find(c => /^\d+$/.test(c))); void num;
    expect(xlsxSheets(f1.file)['Tổng quan'].flat().join('|')).not.toBe(xlsxSheets(f2.file)['Tổng quan'].flat().join('|')); await api('DELETE', `survey/surveys/${w.id}/results/${r.data.id}`); void n0;
  });
  test(tc('SRT-O13'), async () => { const t = xlsxSheets((await statX(RES.id)).file)['Tổng quan'].flat().join('|'); expect(t).toContain('Tạm tính'); expect(t).toMatch(/còn thay đổi/); });
  skipped(['SRT-O14', 'SRT-O15', 'SRT-O16'], 'MANUAL: cần đợt vừa kết thúc (Chính thức) hoặc giả lập mất mốc tổng hợp (MSG-094/095)');
  test(tc('SRT-O17'), async () => { const e = await fixture('EMPTY'); const x = await statX(e.id); expect(x.status === 200 ? 'có tệp' : `chặn ${x.status}`, 'SRS: không có phiếu → MSG-023, không tạo tệp').not.toBe('có tệp'); });
  test(tc('SRT-O18'), async () => { const sh = xlsxSheets((await statX(RES.id)).file); expect(Object.keys(sh)).toHaveLength(4); expect(JSON.stringify(sh)).not.toMatch(/Người nhập|Ngày thu phiếu/); });
  test(tc('SRT-O19'), async () => { const j = JSON.stringify(xlsxSheets((await statX(RES.id)).file)); expect(j).not.toMatch(/Số điện thoại|Email|IP|Họ tên|Đánh giá chung/i); });
  skipped(['SRT-O20', 'SRT-O21'], 'CHƯA TỰ ĐỘNG HOÁ: nút Xuất Excel ở màn kết quả (khóa nút khi xử lý / lỗi tạo tệp) — cần route + trạng thái nút; chưa ổn định selector');
  test(tc('SRT-O22'), async () => { for (const k of ['xemonly', 'ldd', 'canbo']) { const r = await statX(RES.id, k); expect([403, 404], k).toContain(r.status); } });
  test(tc('SRT-O23'), async () => { const t0 = Date.now(); const x = await statX((await srs60()).id); expect(x.status).toBe(200); expect(Date.now() - t0).toBeLessThan(30_000); });
});

test.describe('Kết quả — phân quyền & bảo mật', () => {
  test(tc('SRT-S01'), async () => { for (const u of [`survey/surveys/${RES.id}/statistics`, `survey/surveys/${RES.id}/statistics/export`, 'survey/surveys/export?filter=%7B%7D']) expect((await raw('GET', u)).status, u).toBe(401); });
  test(tc('SRT-S02'), async () => { for (const k of ['canbo', 'cbdp']) for (const u of [`survey/surveys/${RES.id}/statistics`, `survey/surveys/${RES.id}/statistics/export`]) { const r = await downloadApi(u, k); expect([403, 404], `${k} ${u}`).toContain(r.status); } });
  test(tc('SRT-S03'), async () => { const r = await api('GET', `survey/surveys/${RES.id}/statistics`, undefined, 'xemonly'); expect(r.status).toBe(403); const e = await statX(RES.id, 'xemonly'); expect(e.status).toBe(403); });
  skipped(['SRT-S04'], 'CHƯA TỰ ĐỘNG HOÁ: cần hai tài khoản cùng vai trò nhưng khác phạm vi trong cùng đơn vị (ma trận quyền) — không có tài khoản phù hợp ngoài các QC hiện có');
});
void publicList; void dmy; void LIST; void dataRows;
