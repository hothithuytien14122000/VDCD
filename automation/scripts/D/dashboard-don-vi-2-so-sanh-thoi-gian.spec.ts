// D.UC1.3–UC1.4 DASHBOARD ĐƠN VỊ — tab So sánh theo thời gian + Xuất Excel. Bám testcase DSH-T, DSH-O, DSH-G04/G06/G07, DSH-S04.
// Khảo sát 07/11 (giao diện mới):
//  - Không còn ô 'Bộ chỉ số - Thang xếp loại', 'Hình thức', 'Xem theo', khoảng ngày trên trang. Bộ chỉ số - Thang cố định theo kỳ mặc định của đơn vị
//    (lần đầu: dashboard/unit/latest; đổi Đơn vị: dashboard/trend/defaults?organizationId).
//  - "Kỳ so sánh — Đã chọn N, tối thiểu 2": mặc định chọn 6 kỳ đầu của trend/periods; chip kỳ có nút "Bỏ <tên kỳ>"; nút "Thêm kỳ" mở dialog
//    "Thêm kỳ so sánh" (tìm mã/tên, Hình thức, Từ ngày–Đến ngày, bảng có checkbox, Lưu).
//  - Chỉ còn khối "Điểm xếp hạng theo kỳ" với 3 chế độ Cột | Tròn | Số liệu; API dashboard/trend không còn groups/tree/pies.
//  - Xuất: so-sanh-theo-thoi-gian_<đv>_YYYYMMDD.xlsx, 1 sheet 'So sánh theo kỳ'.
import type { Page } from '@playwright/test';
import { test, expect, tc, U, get, allPeriods, body, clickTab, fieldValue, pick, setRange, settle, track, download, noticeText, manual, need, MSG,
  pct, levelOf, downloadApi, xlsxSheets, url, openDash, int, dialogForm, periodRows, dmy } from './common';

const DEVIATION = 'Lệch SRS (giao diện mới đã bỏ) — cần BA xác nhận';
type Ctx = { org: any; def: any; q: any; all: any[]; periods: any[]; extra?: any; trend: any };
const DEFAULT_N = 6;
/** Ngữ cảnh như giao diện: bộ chỉ số - thang theo defaults của đơn vị, chọn sẵn 6 kỳ đầu (thêm 1 kỳ có kết quả nếu cần). */
async function build(as: string, org: any, def: any, withExtra = true): Promise<Ctx> {
  const base = { organizationId: org.id, indicatorSetId: def.indicatorSetId, scaleId: def.scaleId };
  const all = (await U.tperiods(as, base)).periods ?? [];
  const periods = all.slice(0, DEFAULT_N); const extra = withExtra && !periods.some(p => p.hasResult) ? all.find(p => p.hasResult) : undefined;
  if (extra) periods.push(extra);
  const q = { ...base, campaignIds: periods.map(p => p.campaignId) };
  return { org, def, q, all, periods, extra, trend: periods.length >= 2 ? await U.trend(as, q) : null };
}
/** Ngữ cảnh mặc định khi vừa mở tab (đơn vị của tài khoản, kỳ theo unit/latest). */
async function trendCtx(as: string): Promise<Ctx> { const def = await U.defaults(as); return build(as, def.organization, def, false); }
/** Đơn vị trong phạm vi (khác đơn vị mặc định) có ≥ 2 kỳ cùng bộ chỉ số; ưu tiên đơn vị có kỳ đã có kết quả. */
async function ctx2(as: string, withExtra = true): Promise<Ctx> {
  const own = (await U.defaults(as)).organization.id; let best: any = null;
  for (const o of await U.torgs(as)) {
    if (o.id === own) continue;
    const def = await U.tdefaults(as, o.id).catch(() => null); if (!def?.indicatorSetId) continue;
    const all = (await U.tperiods(as, { organizationId: o.id, indicatorSetId: def.indicatorSetId, scaleId: def.scaleId })).periods ?? [];
    if (all.length < 2) continue; const score = (all.some((p: any) => p.hasResult) ? 100 : 0) + Math.min(all.length, DEFAULT_N);
    if (!best || score > best.score) best = { o, def, score };
  }
  need(best, 'không có đơn vị nào có ≥ 2 kỳ cùng bộ chỉ số'); return build(as, best.o, best.def, withExtra);
}
const chipBtn = (p: Page, name: string) => p.getByRole('button', { name: `Bỏ ${name}`, exact: true });
async function removeChip(p: Page, name: string) { await chipBtn(p, name).click(); await settle(p); }
const chipCount = async (p: Page) => p.getByRole('button', { name: /^Bỏ / }).count();
async function openAdd(p: Page) { await p.getByRole('button', { name: /Thêm kỳ/ }).click(); const d = p.getByRole('dialog').last(); await d.waitFor(); await settle(p, 500); return d; }
/** Thêm kỳ qua dialog "Thêm kỳ so sánh". */
async function addPeriods(p: Page, ps: any[]) {
  const d = await openAdd(p);
  for (const x of ps) { await d.getByPlaceholder(/Tìm theo mã, tên kỳ/).fill(x.code); await settle(p, 900); await periodRows(d).filter({ hasText: x.code }).first().locator('.ant-checkbox-wrapper, .ant-checkbox').first().click(); }
  await d.getByRole('button', { name: /^Lưu$/ }).click(); await settle(p, 800);
}
/** Mở tab; nếu có ngữ cảnh thì đổi Đơn vị và thêm kỳ có kết quả như ngữ cảnh. */
async function openTrend(p: Page, as: string, c?: Ctx) {
  await openDash(p, as); await clickTab(p, 'So sánh theo thời gian'); await settle(p, 800);
  if (c && !(await fieldValue(p, 'Đơn vị')).includes(c.org.name)) { await pick(p, 'Đơn vị', c.org.name); await settle(p, 1000); }
  if (c?.extra) await addPeriods(p, [c.extra]);
}
const section = (p: Page) => p.getByRole('heading', { name: 'Điểm xếp hạng theo kỳ' }).locator('xpath=ancestor::section[1]');
async function view(p: Page, v: 'Cột' | 'Tròn' | 'Số liệu') { await section(p).getByText(v, { exact: true }).first().click(); await settle(p, 500); }
const dataRows = async (p: Page) => (await section(p).locator('tbody tr.ant-table-row, tbody tr:not(.ant-table-measure-row)').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const byStart = (ps: any[]) => [...ps].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));

test.describe('UC1.3 So sánh theo thời gian', () => {
  test(tc('DSH-T01'), async ({ page, as }) => {
    const def = await U.defaults(as); const child = (await U.orgs(as)).find((o: any) => o.id !== def.organization.id);
    await openDash(page, as); if (child) await pick(page, 'Đơn vị', child.name);
    const want = child?.name ?? def.organization.name;
    await clickTab(page, 'So sánh theo thời gian');
    expect(await fieldValue(page, 'Đơn vị'), 'giữ Đơn vị của tab Kết quả').toContain(want);
  });
  test(tc('DSH-T02'), async ({ page, as }) => {
    const c = await ctx2(as, false); await openTrend(page, as, c); const d = await openAdd(page);
    expect(await d.getByText(/Bộ chỉ số - Thang/).count(), 'không có ô chọn cặp (cố định theo kỳ mặc định)').toBe(0);
    const rows = (await periodRows(d).allInnerTexts()).map(x => x.replace(/\s+/g, ' '));
    const setName = c.all[0].indicatorSetName, scaleName = c.all[0].scaleName;
    for (const r of rows) { expect(r, 'kỳ cùng bộ chỉ số').toContain(setName); expect(r, 'kỳ cùng thang').toContain(scaleName); }
    expect(Number((await d.innerText()).match(/trong\s+(\d+)\s+bản ghi/)?.[1]), 'đủ kỳ của cặp').toBe(c.all.length);
  });
  manual(['DSH-T03'], 'cần dữ liệu 1 bộ chỉ số gắn 2 thang xếp loại');
  test(tc('DSH-T04'), async ({ page, as }) => {
    const c = await ctx2(as, false); await openTrend(page, as, c); const t = await body(page);
    const n = Math.min(c.all.length, DEFAULT_N);
    for (const p of c.all.slice(0, n)) expect(t).toContain(p.campaignName);
    expect(t).toMatch(new RegExp(`Đã chọn ${n}, tối thiểu 2`)); expect(await chipCount(page)).toBe(n);
  });
  test(tc('DSH-T06'), async ({ page, as }) => {
    const c = await ctx2(as); need(c.periods.length >= 3, 'cần ≥ 3 kỳ'); await openTrend(page, as, c);
    const gone = c.periods.find(p => p !== c.extra)!; await removeChip(page, gone.campaignName);
    expect(await body(page)).toMatch(new RegExp(`Đã chọn ${c.periods.length - 1}`));
    await view(page, 'Số liệu'); expect((await dataRows(page)).join(' | '), 'dòng của kỳ bị bỏ biến mất').not.toContain(gone.code);
  });
  test(tc('DSH-T07'), async ({ page, as }) => {
    const c = await ctx2(as); need(c.periods.length >= 3, 'cần ≥ 3 kỳ'); await openTrend(page, as, c);
    const p0 = c.periods[0]; await removeChip(page, p0.campaignName);
    await addPeriods(page, [p0]);
    expect(await body(page)).toMatch(new RegExp(`Đã chọn ${c.periods.length}`)); await expect(chipBtn(page, p0.campaignName)).toBeVisible();
  });
  test(tc('DSH-T08'), async ({ page, as }) => {
    const c = await ctx2(as); await openTrend(page, as, c); const t = track(page);
    for (const p of c.periods.slice(1)) await removeChip(page, p.campaignName);
    const n = t.reqs.length; await settle(page);
    expect(await body(page) + await noticeText(page)).toMatch(MSG.min2Period);
    expect(await page.getByRole('heading', { name: 'Điểm xếp hạng theo kỳ' }).count(), 'không vẽ khối so sánh').toBe(0);
    expect(t.since(n).filter(u => /dashboard\/trend\?/.test(u)), 'không gọi API trend').toHaveLength(0);
  });
  test(tc('DSH-T09'), async ({ page, as }) => {
    const c = await ctx2(as); need(c.trend, 'dưới 2 kỳ'); const s = c.trend.periods.map((p: any) => String(p.startDate));
    // API trả giảm dần? So với SRS: tăng dần theo thời gian. Giao diện (Số liệu) phải tăng dần.
    await openTrend(page, as, c); await view(page, 'Số liệu'); const rows = await dataRows(page);
    const exp = byStart(c.trend.periods).map((p: any) => p.code);
    const got = rows.map(r => exp.find((code: string) => r.startsWith(code))).filter(Boolean);
    expect(got, `kỳ tăng dần theo ngày bắt đầu (API: ${s.join(', ')})`).toEqual(exp.filter((code: string) => got.includes(code)));
  });
  test(tc('DSH-T10'), async ({ page, as }) => {
    const c = await ctx2(as); need(c.trend?.periods.some((x: any) => x.hasResult), 'không có kỳ có kết quả'); await openTrend(page, as, c); await view(page, 'Số liệu');
    const rows = await dataRows(page);
    for (const p of c.trend.periods.filter((x: any) => x.hasResult)) {
      const r = rows.find(x => x.includes(p.code)) ?? ''; expect(r).toContain(pct(p.rankingScore)); expect(r).toContain(p.level.name);
      expect(levelOf(p.rankingScore, c.trend.scaleLevels)?.code).toBe(p.level.code);
    }
  });
  test(tc('DSH-T12'), async ({ page, as }) => {
    const c = await ctx2(as); need(c.trend?.periods.some((x: any) => x.hasResult), 'không có kỳ có kết quả');
    const res = c.trend.periods.filter((x: any) => x.hasResult);
    expect(Math.abs(res.reduce((a: number, x: any) => a + x.share, 0) - 100), 'Σ tỷ trọng = 100%').toBeLessThan(0.02);
    expect(c.trend.totalScoreSum).toBe(res.reduce((a: number, x: any) => a + x.totalScore, 0));
    await openTrend(page, as, c); await view(page, 'Tròn'); const t = (await section(page).innerText()).replace(/\s+/g, ' ');
    expect(t).toMatch(new RegExp(`${int(c.trend.totalScoreSum)}\\s*tổng điểm`));
    for (const p of res) expect(t).toMatch(new RegExp(`${int(p.totalScore)}\\s*điểm\\s*${Math.round(p.share)}`));
  });
  manual(['DSH-T13'], 'so màu cột bằng mắt');
  test(tc('DSH-T14'), async ({ page, as }) => {
    const c = await ctx2(as); need(c.trend?.periods.some((x: any) => x.hasResult), 'không có kỳ có kết quả'); await openTrend(page, as, c); await view(page, 'Số liệu');
    const head = (await section(page).locator('thead').first().innerText()).replace(/\s+/g, ' ');
    for (const h of ['Mã kỳ', 'Tên kỳ', 'Thời gian áp dụng', 'Điểm đạt', 'Điểm tối đa', 'Tỷ lệ đạt', 'Xếp loại', 'Kết quả']) expect(head).toContain(h);
    const p = c.trend.periods.find((x: any) => x.hasResult); const r = (await dataRows(page)).find(x => x.includes(p.code))!;
    expect(r).toMatch(new RegExp(`${int(p.totalScore)}\\s+${int(p.maxScore)}\\s+${pct(p.rankingScore)}`));
  });
  test(tc('DSH-T16'), async ({ page, as }) => {
    const c = await ctx2(as); const p = c.trend?.periods.find((x: any) => !x.hasResult); need(p, 'mọi kỳ đã gửi');
    await openTrend(page, as, c); await view(page, 'Số liệu'); const r = (await dataRows(page)).find(x => x.includes(p.code))!;
    expect((r.match(/—/g) ?? []).length, 'kỳ chưa gửi: 4 ô số liệu để "—", không ghi 0').toBeGreaterThanOrEqual(4);
    expect(r).not.toMatch(/\s0\s/);
    expect(c.trend.periods.filter((x: any) => x.hasResult).length, 'các kỳ khác vẫn có số liệu').toBeGreaterThan(0);
  });
  test(tc('DSH-T17'), async ({ page, as }) => {
    const c = await ctx2(as); const p = c.trend?.periods.find((x: any) => x.isProvisional); need(p, 'không có kỳ đang diễn ra');
    await openTrend(page, as, c);
    const chip = chipBtn(page, p.name ?? p.campaignName).locator('xpath=..'); expect(await chip.innerText(), 'chip kỳ có nhãn Tạm thời').toContain('Tạm thời');
    await view(page, 'Số liệu'); expect((await dataRows(page)).find(x => x.includes(p.code))).toContain('Tạm thời');
  });
  test(tc('DSH-T19'), async ({ page, as }) => {
    const c = await ctx2(as, false); await openTrend(page, as, c); const d = await openAdd(page); await dialogForm(page, d, 'Đột xuất');
    const adhoc = c.all.filter(p => p.form === 'AdHoc'); const rows = (await periodRows(d).allInnerTexts()).map(x => x.replace(/\s+/g, ' ')).filter(x => !MSG.noPeriod.test(x));
    for (const r of rows) { expect(r).toContain('Đột xuất'); expect(adhoc.some(p => r.includes(p.code))).toBe(true); }
    if (!adhoc.length) expect(await d.innerText()).toMatch(MSG.noPeriod);
  });
  test(tc('DSH-T20'), async ({ page, as }) => {
    const c = await ctx2(as, false); await openTrend(page, as, c); const d = await openAdd(page); await setRange(page, '01/01/2010', '31/12/2010');
    expect(await d.innerText() + await noticeText(page)).toMatch(MSG.noPeriod);
  });
  test(tc('DSH-T21'), async ({ page, as }) => {
    const c = await ctx2(as, false); await openTrend(page, as, c); const d = await openAdd(page); await setRange(page, '30/09/2026', '01/07/2026');
    const [f, t] = await d.locator('.ant-picker-range input').evaluateAll(es => es.map(e => (e as HTMLInputElement).value));
    const iso = (s: string) => s.split('/').reverse().join('-');
    expect(MSG.invalidRange.test(await d.innerText() + await noticeText(page)) || iso(t) >= iso(f), `không chấp nhận Đến ngày < Từ ngày (${f} – ${t})`).toBe(true);
  });
  test(tc('DSH-T22'), async ({ page, as }) => {
    const c = await ctx2(as, false); await openTrend(page, as, c); const t = await body(page);
    expect(await fieldValue(page, 'Đơn vị')).toContain(c.org.name); for (const p of c.periods) expect(t).toContain(p.campaignName);
    expect(await chipCount(page)).toBe(c.periods.length);
  });
});

test.describe('UC1.4 Xuất so sánh theo thời gian', () => {
  // SRS: So_sanh_theo_thoi_gian_<ĐV>_YYYYMMDD_HHMMSS.xlsx; thực tế 07/11: so-sanh-theo-thoi-gian_<đv-slug>_YYYYMMDD.xlsx.
  const NAME = /^so[-_]sanh[-_]theo[-_]thoi[-_]gian_[^_]+_\d{8}(_\d{6})?\.xlsx$/i;
  const SHEET = 'So sánh theo kỳ';
  const resCtx = async (as: string) => { const c = await ctx2(as); need(c.trend?.periods.some((x: any) => x.hasResult), 'không có kỳ có kết quả để xuất'); return c; };
  test(tc('DSH-O01'), async ({ page, as }) => {
    const c = await resCtx(as); await openTrend(page, as, c); const f = await download(page);
    expect(f.name).toMatch(NAME); expect(Object.keys(f.sheets)).toContain(SHEET);
  });
  test(tc('DSH-O02'), async ({ page, as }) => {
    const c = await resCtx(as); await openTrend(page, as, c); const f = await download(page); const rows = f.sheets[SHEET]; const t = rows.map(r => r.join(' | ')).join('\n');
    for (const s of [c.org.name, c.trend.indicatorSetName, c.trend.scaleName, 'Điểm đạt', 'Điểm tối đa', 'Tỷ lệ đạt', 'Xếp loại', 'Kết quả']) expect(t).toContain(s);
    const order = byStart(c.trend.periods).map((p: any) => rows.findIndex(r => r[0] === p.code));
    expect(order.every((i: number) => i > 0), 'đủ dòng mỗi kỳ').toBe(true); expect(order).toEqual([...order].sort((a: number, b: number) => a - b));
  });
  test(tc('DSH-O03'), async ({ page, as }) => {
    const c = await resCtx(as); await openTrend(page, as, c); const f = await download(page); const rows = f.sheets[SHEET];
    const h = rows.find(r => r.includes('Mã kỳ'))!; const iShare = h.findIndex(v => /Tỷ trọng/.test(v)); expect(iShare, 'cột Tỷ trọng điểm (%)').toBeGreaterThan(0);
    for (const p of c.trend.periods.filter((x: any) => x.hasResult)) expect(Number(rows.find(r => r[0] === p.code)![iShare])).toBeCloseTo(p.share, 2);
  });
  test(tc('DSH-O04'), async ({ page, as }) => {
    const c = await resCtx(as); need(c.periods.length >= 3, 'cần ≥ 3 kỳ'); await openTrend(page, as, c);
    const gone = c.periods.find(p => !p.hasResult)!; await removeChip(page, gone.campaignName);
    const f = await download(page); expect(f.sheets[SHEET].map(r => r[0])).not.toContain(gone.code);
  });
  test(tc('DSH-O05'), async ({ as }) => {
    const c = await resCtx(as); const p = c.trend.periods.find((x: any) => !x.hasResult); need(p, 'mọi kỳ đã gửi');
    const f = await downloadApi(url('dashboard/trend/export', c.q), as); expect(f.status).toBe(200);
    const s = xlsxSheets(f.file)[SHEET]; const h = s.find(r => r.includes('Mã kỳ'))!; const r = s.find(x => x[0] === p.code)!;
    const iRes = h.indexOf('Kết quả'); expect(r.filter((v, i) => i >= 3 && i !== iRes && v !== ''), 'kỳ chưa gửi: ô số liệu để trống').toHaveLength(0);
  });
  test(tc('DSH-O06'), async ({ as }) => {
    const c = await resCtx(as); const f = await downloadApi(url('dashboard/trend/export', c.q), as); const s = xlsxSheets(f.file)[SHEET];
    for (const p of c.trend.periods) expect(s.find(r => r[0] === p.code)?.join(' ')).toContain(p.isProvisional ? 'Tạm thời' : 'Chính thức');
  });
  test(tc('DSH-O07'), async ({ as }) => {
    const c = await ctx2(as, false); const none = c.all.filter(p => !p.hasResult).slice(0, 2); need(none.length === 2, 'không có 2 kỳ chưa gửi cùng cặp');
    const f = await downloadApi(url('dashboard/trend/export', { ...c.q, campaignIds: none.map(p => p.campaignId) }), as);
    expect(f.status).toBeGreaterThanOrEqual(400); expect(f.status).toBeLessThan(500); expect(f.text).toMatch(MSG.noExport);
  });
  test(tc('DSH-O08'), async ({ page, as }) => {
    const c = await resCtx(as); const f = await downloadApi(url('dashboard/trend/export', { ...c.q, campaignIds: c.q.campaignIds.slice(0, 1) }), as);
    expect(f.status, 'API export 1 kỳ bị từ chối').toBeGreaterThanOrEqual(400); expect(f.status).toBeLessThan(500);
    await openTrend(page, as, c); for (const p of c.periods.slice(1)) await removeChip(page, p.campaignName);
    const b = page.getByRole('button', { name: /Xuất Excel/ }).first();
    if (await b.isEnabled()) { let n = 0; page.on('download', () => n++); await b.click(); await page.waitForTimeout(2000); expect(n).toBe(0); expect(await noticeText(page)).toMatch(MSG.min2Period); }
  });
  test(tc('DSH-O09'), async ({ page, as }) => {
    const c = await resCtx(as); await openTrend(page, as, c); let n = 0; page.on('download', () => n++);
    await page.route('**/dashboard/trend/export**', async r => { await new Promise(f => setTimeout(f, 1500)); await r.continue(); });
    const b = page.getByRole('button', { name: /Xuất Excel/ }).first(); await b.click(); await expect(b).toBeDisabled({ timeout: 1000 });
    await b.click({ force: true }).catch(() => {}); await page.waitForTimeout(4000); expect(n).toBe(1);
    await page.unroute('**/dashboard/trend/export**'); await page.route('**/dashboard/trend/export**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Xuất tệp thất bại"}' }));
    await b.click(); await expect.poll(() => noticeText(page)).toMatch(/thất bại|MSG-024|lỗi/i); await expect(b).toBeEnabled();
  });
  manual(['DSH-O10'], 'cần tài khoản có quyền Xem so sánh nhưng không có quyền Xuất so sánh theo thời gian');
});

test.describe('UC1.3 Lỗi, API, phạm vi', () => {
  test(tc('DSH-G06'), async ({ as }) => {
    const c = await ctx2(as); const r = await get('dashboard/trend', { ...c.q, campaignIds: c.q.campaignIds.slice(0, 1) }, as);
    expect(r.status).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
  });
  test(tc('DSH-G07'), async ({ as }) => {
    const c = await ctx2(as); const all = await allPeriods(as, c.org.id);
    const other = all.find(p => p.indicatorSetId !== c.q.indicatorSetId); need(other, 'đơn vị chỉ có 1 bộ chỉ số');
    const r = await get('dashboard/trend', { ...c.q, campaignIds: [...c.q.campaignIds, other.campaignId] }, as);
    if (r.status === 200) expect(r.data.periods.map((p: any) => p.campaignId), 'không trộn bộ chỉ số').not.toContain(other.campaignId); else expect(r.status).toBeLessThan(500);
  });
  test(tc('DSH-S04'), async ({ as }) => {
    const mine = new Set((await U.torgs(as)).map((o: any) => o.id)); let c: Ctx | null = null;
    for (const o of (await U.torgs('admin')).filter((x: any) => !mine.has(x.id)).slice(0, 40)) {
      const def = await U.tdefaults('admin', o.id).catch(() => null); if (!def?.indicatorSetId) continue;
      const x = await build('admin', o, def, false); if (x.q.campaignIds.length >= 2) { c = x; break; }
    }
    need(c, 'không có đơn vị ngoài phạm vi đủ 2 kỳ'); const other = c!.org;
    const r = await get('dashboard/trend', c!.q, as);
    if (r.status === 200) expect(r.data.organization.id, 'không trả dữ liệu ngoài phạm vi').not.toBe(other.id); else expect(r.status).toBe(403);
    expect((await downloadApi(url('dashboard/trend/export', c!.q), as)).status).toBe(403);
  });
});
