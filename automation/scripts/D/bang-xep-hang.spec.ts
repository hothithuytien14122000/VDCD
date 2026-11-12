// D.UC2.1–UC2.2 BẢNG XẾP HẠNG. Bám testcase RNK-F (bộ lọc), RNK-V (biểu đồ, bảng, hạng), RNK-X (xuất), RNK-G/S/P.
// Hạng, điểm tỉnh, thay đổi hạng được tính lại từ dữ liệu API theo quy tắc SRS (dòng 1690–1695) rồi so với API và giao diện.
import type { Page } from '@playwright/test';
import { test, expect, tc, R, rankAll, get, rawGet, FAKE, open, body, fieldValue, pick, options, visibleLabel, setRange, settle, download, noticeText, manual, need, MSG,
  round, vn, int, pct, ranks, levelOf, downloadApi, xlsxSheets, url, pickPeriod, openPeriodDialog, periodRows, dialogForm } from './common';

// Khảo sát 07/11 (giao diện mới): nhóm xếp hạng là tab "Tất cả đơn vị | Cấp trung ương | Cấp tỉnh"; kỳ chọn qua nút "Kỳ đánh giá" → dialog
// "Chọn kỳ đánh giá" (không còn ô Hình thức / Xem theo / Khung thời gian / Kỳ trên trang). Biểu đồ "Điểm xếp hạng" + bảng "Bảng xếp hạng"
// luôn hiển thị (không còn chế độ Cột/Tròn/Số liệu, không còn biểu đồ phân bố); bảng 10 dòng/trang.
// Kỳ mặc định (ranking/defaults) hiện chưa có kết quả → các case số liệu dùng kỳ "giàu dữ liệu" nhất (nhiều đơn vị xếp hạng, có kỳ liền trước).
const DEVIATION = 'Lệch SRS (giao diện mới đã bỏ) — cần BA xác nhận';
const G: Record<string, string> = { All: 'Tất cả đơn vị', Central: 'Cấp trung ương', Province: 'Cấp tỉnh' };
const ALLP = new Map<string, Promise<any[]>>();
/** Mọi kỳ của bảng xếp hạng (gom đủ trang). */
const allRankPeriods = (as = 'lanhdaobo') => { if (!ALLP.has(as)) ALLP.set(as, R.periods(as, {}).then(r => r.periods ?? [])); return ALLP.get(as)!; };
let BEST: Promise<any> | null = null;
/** Kỳ có kết quả, nhiều đơn vị xếp hạng nhất (ưu tiên có kỳ liền trước). */
async function best() {
  BEST ??= (async () => {
    let b: any = null;
    for (const p of (await allRankPeriods()).filter(x => x.hasResult)) {
      const r = await R.get('lanhdaobo', p.campaignId, 'All', 1, 10); const sc = r.rankedCount * 10 + (r.showRankChange ? 1000 : 0) + (r.totalCount > r.rankedCount ? 5 : 0);
      if (!b || sc > b.sc) b = { p, sc };
    }
    return b?.p ?? null;
  })();
  return BEST;
}
async function ctx(as = 'lanhdaobo', group = 'All', campaignId?: string) {
  const def = await R.defaults(as); const bp = campaignId ? null : await best(); const cid = campaignId ?? bp?.campaignId ?? def.campaignId; need(cid, 'hệ thống chưa có kỳ');
  const period = bp ?? (await allRankPeriods(as)).find(x => x.campaignId === cid);
  return { def, cid, period, r: await rankAll(as, cid, group) };
}
/** Kỳ thỏa điều kiện trong mọi kỳ hệ thống. */
async function findPeriod(as: string, pred: (p: any) => boolean) { return (await allRankPeriods(as)).find(pred) ?? null; }
async function numbers(_p: Page) { /* giao diện mới: bảng luôn hiển thị */ }
const groupTab = (p: Page, g: string) => p.getByRole('tab', { name: G[g], exact: true });
/** Mở bảng xếp hạng, chọn kỳ (đối tượng kỳ từ API) và nhóm. */
async function openGroup(p: Page, group = 'All', period?: any) {
  await open(p, 'ranking'); if (period && !(await fieldValue(p, 'Kỳ')).includes(period.shortName ?? period.campaignName)) await pickPeriod(p, period);
  if (group !== 'All') { await groupTab(p, group).click(); await settle(p); }
}
const openBest = async (p: Page, group = 'All') => openGroup(p, group, await best());
const tableRows = async (p: Page) => (await p.locator('tbody tr.ant-table-row').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
const sent = (rows: any[]) => rows.filter(x => !x.notSent);
/** % chấp nhận 1 hoặc 2 chữ số thập phân (UI biểu đồ hiện 2 chữ số, SRS ghi 1). */
const pctAny = (x: number) => new RegExp(`(${vn(x, 1).replace(',', '\\,')}|${vn(x, 2).replace(',', '\\,')})%`);

test.describe('UC2.1 Bộ lọc', () => {
  test(tc('RNK-F01'), async ({ page }) => {
    const def = await R.defaults(); const k = (await allRankPeriods()).find(x => x.campaignId === def.campaignId); need(k, 'không có kỳ mặc định');
    await open(page, 'ranking'); const t = await body(page); expect(t).toContain('Bảng xếp hạng');
    const sp = (x: string) => String(x ?? '').replace(/\s+/g, ' ').trim();
    expect(await fieldValue(page, 'Kỳ')).toContain(sp(k.form === 'AdHoc' ? k.campaignName : (k.shortName ?? k.campaignName)));
    const d = await openPeriodDialog(page); await d.getByPlaceholder(/Tìm theo mã, tên kỳ/).fill(k.code); await settle(page, 900); const row = (await periodRows(d).filter({ has: page.locator('input[type=radio]:checked') }).first().innerText()).replace(/\s+/g, ' ');
    for (const s of [k.code, k.campaignName, k.indicatorSetName, k.scaleName]) expect(row).toContain(sp(s));
    expect(row).toMatch(k.form === 'AdHoc' ? /Đột xuất/ : /Định kỳ/);
  });
  test(tc('RNK-F02'), async ({ page }) => {
    const def = await R.defaults(); const all = await allRankPeriods(); const now = new Date().toISOString();
    const started = all.filter(p => String(p.startDate) <= now).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
    const cur = all.find(p => p.campaignId === def.campaignId);
    if (started[0]) expect(String(cur?.startDate).slice(0, 10), 'kỳ gần nhất của hệ thống (ngày bắt đầu muộn nhất đã bắt đầu)').toBe(String(started[0].startDate).slice(0, 10));
    await open(page, 'ranking'); await expect(groupTab(page, 'All')).toHaveAttribute('aria-selected', 'true');
  });
  test(tc('RNK-F03'), async ({ page }) => {
    const ps = await allRankPeriods(); await open(page, 'ranking'); const d = await openPeriodDialog(page);
    expect(Number((await d.innerText()).match(/trong\s+(\d+)\s+bản ghi/)?.[1]), 'dialog liệt kê mọi kỳ').toBe(ps.length);
    for (const r of (await periodRows(d).allInnerTexts()).map(x => x.replace(/\s+/g, ' '))) { const sp = (x: string) => String(x ?? '').replace(/\s+/g, ' ').trim(); const p = ps.find((x: any) => r.includes(x.code) && r.includes(sp(x.campaignName))); expect(p, r.slice(0, 50)).toBeTruthy(); expect(r, 'cột bộ chỉ số').toContain(sp(p.indicatorSetName)); }
  });
  test(tc('RNK-F05'), async ({ page }) => {
    await open(page, 'ranking'); const d = await openPeriodDialog(page); await setRange(page, '30/06/2026', '01/04/2026');
    const [f, t] = await d.locator('.ant-picker-range input').evaluateAll(es => es.map(e => (e as HTMLInputElement).value)); const iso = (s: string) => s.split('/').reverse().join('-');
    expect(MSG.invalidRange.test(await d.innerText() + await noticeText(page)) || iso(t) >= iso(f), `không chấp nhận Đến ngày < Từ ngày (${f} – ${t})`).toBe(true);
  });
  test(tc('RNK-F06'), async ({ page }) => {
    await open(page, 'ranking'); const d = await openPeriodDialog(page); await setRange(page, '01/01/2010', '31/12/2010');
    expect(await d.innerText() + await noticeText(page)).toMatch(MSG.noPeriod);
  });
  test(tc('RNK-F08'), async ({ page }) => {
    await open(page, 'ranking'); expect((await page.getByRole('tab').allInnerTexts()).map(x => x.trim())).toEqual(['Tất cả đơn vị', 'Cấp trung ương', 'Cấp tỉnh']);
  });
  test(tc('RNK-F09'), async ({ page }) => {
    const c = await ctx(); const mine = await R.get('ldd', c.cid);
    expect(mine.table.totalElements, 'Lãnh đạo đơn vị thấy mọi đơn vị').toBe(c.r.table.totalElements); expect(mine.rankedCount).toBe(c.r.rankedCount);
    await openBest(page); expect(await body(page)).toMatch(new RegExp(`${c.r.rankedCount}\\s*/\\s*${c.r.totalCount}\\s*đơn vị được xếp hạng`));
  });
});

test.describe('UC2.1 Bảng, hạng, biểu đồ', () => {
  test(tc('RNK-V01'), async ({ page }) => {
    const c = await ctx(); need(c.r.showRankChange, 'kỳ mặc định không có kỳ liền trước (cột Thay đổi hạng ẩn)');
    await openBest(page); const h = (await page.locator('thead').first().innerText()).replace(/\s+/g, ' ');
    let i = -1; for (const col of ['Hạng', 'Đơn vị', 'Cấp đơn vị', 'Tổng điểm', 'Điểm xếp hạng', 'Xếp loại', 'Thay đổi hạng']) { const j = h.indexOf(col); expect(j, `cột ${col}`).toBeGreaterThan(i); i = j; }
    expect(h).not.toMatch(/Thao tác/);
  });
  test(tc('RNK-V02'), async ({ page }) => {
    const c = await ctx(); await openBest(page); const t = await page.locator('tbody').first().innerText();
    for (const x of c.r.rows.slice(0, 20).filter((x: any) => x.adminLevel === 'Central' || x.provinceName)) { // đơn vị chưa gắn tỉnh (dữ liệu QCA) bỏ qua
      const exp = x.adminLevel === 'Central' || /trung ương/i.test(x.unitLevelText ?? '') ? 'Trung ương' : x.unitLevelText;
      expect(t).toContain(exp);
      if (/Xã/.test(x.unitLevelText ?? '')) expect(x.unitLevelText).toMatch(new RegExp(`Xã, tỉnh ${x.provinceName}`)); else if (/Tỉnh/.test(x.unitLevelText ?? '')) expect(x.unitLevelText).toMatch(new RegExp(`Tỉnh, thành phố ${x.provinceName}`));
    }
  });
  test(tc('RNK-V03'), async ({ page }) => {
    const c = await ctx(); const s = sent(c.r.rows); need(s.length, 'kỳ chưa có đơn vị gửi');
    for (const x of s) expect(round(x.rankingScore), x.name).toBe(round((x.totalScore / x.maxScore) * 100));
    await openBest(page); const row = (await page.locator('tbody tr', { hasText: s[0].name }).first().innerText()).replace(/\s+/g, ' ');
    expect(row).toMatch(new RegExp(`${int(s[0].totalScore)}\\s*/\\s*${int(s[0].maxScore)}`)); expect(row).toContain(pct(s[0].rankingScore));
  });
  test(tc('RNK-V04'), async () => {
    const s = sent((await ctx()).r.rows); for (let i = 1; i < s.length; i++) expect(round(s[i].rankingScore), `${s[i].name} sau ${s[i - 1].name}`).toBeLessThanOrEqual(round(s[i - 1].rankingScore));
    if (s.length) expect(s[0].rank).toBe(1);
  });
  test(tc('RNK-V05'), async () => {
    const s = sent((await ctx()).r.rows); const exp = ranks(s.map(x => x.rankingScore));
    expect(s.map(x => x.rank), 'đồng điểm đồng hạng, bỏ bậc').toEqual(exp);
    for (let i = 1; i < s.length; i++) if (s[i].rank === s[i - 1].rank) expect(s[i - 1].name.localeCompare(s[i].name, 'vi'), 'đồng hạng xếp tên A–Z').toBeLessThanOrEqual(0);
    need(new Set(exp).size < exp.length, 'kỳ không có đơn vị đồng hạng (đã kiểm phần còn lại)');
  });
  manual(['RNK-V06'], 'cần 2 đơn vị có điểm gốc 85,004% và 84,996%');
  test(tc('RNK-V08'), async () => {
    const c = await ctx(); for (const x of sent(c.r.rows)) expect(x.level.code, x.name).toBe(levelOf(x.rankingScore, c.r.scaleLevels)?.code);
  });
  test(tc('RNK-V11'), async ({ page }) => {
    const c = await ctx('lanhdaobo', 'Central'); const s = sent(c.r.rows); need(s.length, 'không có đơn vị Trung ương đã gửi');
    for (const x of c.r.rows) expect(x.adminLevel === 'Central' || /Trung ương/.test(x.unitLevelText ?? ''), `${x.name} không phải TW`).toBe(true);
    expect(s[0].rank).toBe(1); expect(s.map(x => x.rank)).toEqual(ranks(s.map(x => x.rankingScore)));
    await openBest(page, 'Central'); expect(await page.locator('tbody').first().innerText()).toContain(s[0].name);
  });
  test(tc('RNK-V12'), async ({ page }) => {
    const c = await ctx('lanhdaobo', 'Province'); await openBest(page, 'Province'); const h = (await page.locator('thead').first().innerText()).replace(/\s+/g, ' ');
    for (const col of ['Hạng', 'Tỉnh, thành phố', 'Số đơn vị đã gửi', 'Điểm xếp hạng', 'Xếp loại']) expect(h).toContain(col);
    const names = c.r.rows.map((x: any) => x.name); expect(new Set(names).size, 'mỗi dòng 1 tỉnh').toBe(names.length);
  });
  test(tc('RNK-V13'), async () => {
    const all = await ctx(); const prov = await rankAll('lanhdaobo', all.cid, 'Province');
    for (const p of prov.rows.filter((x: any) => !x.notSent)) {
      const us = sent(all.r.rows).filter((u: any) => u.provinceId === (p.provinceId ?? p.id));
      need(us.length, `không xác định được đơn vị của ${p.name}`);
      const avg = us.reduce((a: number, u: any) => a + u.totalScore / u.maxScore * 100, 0) / us.length;
      expect(round(p.rankingScore), `${p.name}: trung bình điểm chưa làm tròn`).toBe(round(avg));
    }
  });
  test(tc('RNK-V16'), async () => { const p = await ctx('lanhdaobo', 'Province'); for (const x of sent(p.r.rows)) expect(x.level.code, x.name).toBe(levelOf(x.rankingScore, p.r.scaleLevels)?.code); });
  test(tc('RNK-V18'), async () => {
    const c = await ctx('lanhdaobo', 'Central'); need(c.r.showRankChange, 'không có kỳ liền trước');
    const prev = await findPeriod('lanhdaobo', p => p.campaignName === c.r.previousCampaignName); need(prev, 'không tìm thấy kỳ liền trước');
    const m = new Map(sent((await rankAll('lanhdaobo', prev.campaignId, 'Central')).rows).map((x: any) => [x.id, x.rank]));
    for (const x of sent(c.r.rows)) if (m.has(x.id)) expect(x.change.delta, `${x.name} so với hạng TW kỳ trước`).toBe((m.get(x.id) as number) - x.rank);
  });
  test(tc('RNK-V20'), async ({ page }) => {
    const c = await ctx(); const n = c.r.rankedCount; const items = c.r.chart.items;
    if (n <= 6) { expect(items.length).toBe(n); expect(c.r.chart.middleCount ?? 0).toBe(0); }
    else { expect(items.length, '3 đầu + 3 cuối').toBe(6); expect(c.r.chart.middleCount).toBe(n - 6); }
    await openBest(page); const t = await body(page);
    if (n > 6) expect(t, 'dòng "{n} đơn vị ở giữa"').toMatch(new RegExp(`${n - 6} đơn vị ở giữa`));
    expect(await page.getByRole('button', { name: /Xem tất cả/ }).count()).toBe(0);
  });
  test(tc('RNK-V21'), async ({ page }) => {
    const c = await ctx(); need(c.r.chart.items.length, 'biểu đồ rỗng'); await openBest(page); const t = await body(page);
    for (const x of c.r.chart.items) { expect(t).toContain(x.name); expect(t).toMatch(pctAny(x.rankingScore)); }
    for (const l of c.r.scaleLevels) expect(t, `chú giải mức ${l.name}`).toContain(l.name);
  });
  test(tc('RNK-V22'), async ({ page }) => {
    // UI mới: biểu đồ ghi trực tiếp "#hạng Tên đơn vị điểm%" (đơn vị của tài khoản có "· Đơn vị của bạn"), không còn tooltip Hạng x/N.
    const c = await ctx(); need(c.r.chart.items.length, 'biểu đồ rỗng'); await openBest(page); const t = await body(page);
    for (const x of c.r.chart.items) expect(t).toMatch(new RegExp(`#${x.rank}\\s*${x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*${vn(x.rankingScore)}%`));
  });
  test(tc('RNK-V23'), async ({ page }) => {
    const c = await ctx(); const n = c.r.totalCount - c.r.rankedCount; need(n > 0, 'mọi đơn vị đã gửi');
    for (const x of c.r.chart.items) expect(x.notSent).toBeFalsy();
    await openBest(page); expect(await body(page)).toContain(`${n} đơn vị chưa gửi kết quả không có trong biểu đồ`);
  });
  test(tc('RNK-V24'), async () => {
    const c = await ctx(); const d = c.r.distribution; need(d, 'API không trả distribution');
    expect(d.levels.reduce((a: number, l: any) => a + l.count, 0)).toBe(d.rankedCount);
    for (const l of d.levels) if (d.rankedCount) expect(round(l.percent, 1)).toBe(round(l.count / d.rankedCount * 100, 1));
    test.info().annotations.push({ type: 'note', description: `${DEVIATION}: giao diện không còn biểu đồ 'Phân bố theo xếp loại' (chế độ Tròn); chỉ kiểm số liệu API` });
  });
  test(tc('RNK-V26'), async ({ page }) => {
    const p = await findPeriod('lanhdaobo', x => x.isProvisional); need(p, 'không có kỳ đang diễn ra');
    expect((await R.get('lanhdaobo', p.campaignId)).isProvisional).toBe(true);
    await openGroup(page, 'All', p); const t = await body(page);
    expect(t).toContain('Tạm thời'); expect(t).toMatch(/đang diễn ra|MSG-112/i);
  });
});

test.describe('UC2.2 Xuất bảng xếp hạng', () => {
  // SRS: Bang_xep_hang_<Kỳ>_<Nhóm>_YYYYMMDD_HHMMSS.xlsx; thực tế 07/11: bang-xep-hang_<kỳ-slug>_<nhóm-slug>_YYYYMMDD.xlsx.
  const NAME = /^bang[-_]xep[-_]hang_[^_]+_[^_]+_\d{8}(_\d{6})?\.xlsx$/i;
  const exp = (cid: string, group = 'All') => downloadApi(url('ranking/export', { filter: JSON.stringify({ campaignId: cid, group }) }), 'lanhdaobo');
  test(tc('RNK-X01'), async ({ page }) => { await ctx(); await openBest(page); const f = await download(page); expect(f.name).toMatch(NAME); expect(Object.keys(f.sheets)).toHaveLength(1); });
  test(tc('RNK-X02'), async () => {
    const c = await ctx(); const f = await exp(c.cid); const rows = Object.values(xlsxSheets(f.file))[0];
    for (const x of c.r.rows) expect(rows.some(r => r.includes(x.name)), `thiếu ${x.name}`).toBe(true);
  });
  test(tc('RNK-X03'), async () => {
    const c = await ctx(); const rows = Object.values(xlsxSheets((await exp(c.cid)).file))[0]; const head = rows.find(r => r.includes('Hạng') && r.includes('Đơn vị'))!.join('|');
    for (const col of ['Hạng', 'Đơn vị', 'Cấp đơn vị', 'Tỉnh, thành phố', 'Tổng điểm đạt', 'Điểm tối đa', 'Điểm xếp hạng', 'Xếp loại', 'Ghi chú']) expect(head).toContain(col);
    const ns = c.r.rows.find((x: any) => x.notSent); if (ns) { const r = rows.find(x => x.includes(ns.name))!; expect(r.join('|')).toContain('Chưa gửi kết quả'); expect(r[0], 'hạng để trống').toBe(''); }
  });
  test(tc('RNK-X04'), async () => {
    const c = await ctx(); const rows = Object.values(xlsxSheets((await exp(c.cid, 'Province')).file))[0]; const head = rows.find(r => r.includes('Hạng'))!.join('|');
    for (const col of ['Hạng', 'Tỉnh, thành phố', 'Số đơn vị đã gửi', 'Số đơn vị được giao kỳ', 'Điểm xếp hạng', 'Xếp loại']) expect(head).toContain(col);
  });
  test(tc('RNK-X05'), async () => {
    const c = await ctx(); const rows = Object.values(xlsxSheets((await exp(c.cid)).file))[0]; const head = rows.find(r => r.includes('Hạng') && r.includes('Đơn vị'))!;
    const i = head.indexOf('Thay đổi hạng');
    if (!c.r.showRankChange) expect(i, 'cột ẩn thì không xuất').toBe(-1);
    else for (const r of rows.slice(rows.indexOf(head) + 1).filter(r => r[i])) expect(r[i]).toMatch(/^(-?\d+|Mới)$/);
    const ad = await findPeriod('lanhdaobo', x => x.form === 'AdHoc' && x.hasResult);
    if (ad) expect(Object.values(xlsxSheets((await exp(ad.campaignId)).file))[0].flat()).not.toContain('Thay đổi hạng');
  });
  test(tc('RNK-X06'), async () => {
    const c = await ctx(); const t = Object.values(xlsxSheets((await exp(c.cid)).file))[0].slice(0, 10).flat().join(' ');
    for (const s of [c.r.campaign.name, c.r.campaign.indicatorSetName, c.r.campaign.scaleName, 'Tất cả đơn vị']) expect(t).toContain(s);
    expect(t).toContain(c.r.isProvisional ? 'Tạm thời' : 'Chính thức');
  });
  test(tc('RNK-X07'), async () => {
    const p = await findPeriod('lanhdaobo', x => !x.hasResult); need(p, 'không có kỳ chưa ai gửi');
    const f = await exp(p.campaignId); expect(f.status).toBeGreaterThanOrEqual(400); expect(f.status).toBeLessThan(500); expect(f.text).toMatch(MSG.noExport);
  });
  test(tc('RNK-X08'), async ({ page }) => {
    await ctx(); await openBest(page); let n = 0; page.on('download', () => n++);
    await page.route('**/ranking/export**', async r => { await new Promise(f => setTimeout(f, 1500)); await r.continue(); });
    const b = page.getByRole('button', { name: /Xuất Excel/ }).first(); await b.click(); await expect(b).toBeDisabled({ timeout: 1000 });
    await b.click({ force: true }).catch(() => {}); await page.waitForTimeout(4000); expect(n).toBe(1);
  });
  manual(['RNK-X09'], 'cần tài khoản có quyền Xem nhưng không có quyền Xuất bảng xếp hạng');
});

test.describe('UC2.1 Lỗi, quyền, hiệu năng', () => {
  test(tc('RNK-G01'), async ({ page }) => {
    await open(page, 'ranking'); await page.route(/\/dti\/ranking\?/, r => r.fulfill({ status: 500, body: '{}' })); await groupTab(page, 'Central').click(); await settle(page);
    expect(await body(page) + await noticeText(page)).toMatch(/Không thể tải|MSG-025/); await expect(groupTab(page, 'Central'), 'giữ nhóm đã chọn').toHaveAttribute('aria-selected', 'true');
  });
  test(tc('RNK-G02'), async () => {
    for (const filter of ['abc', JSON.stringify({ campaignId: FAKE }), JSON.stringify({ campaignId: FAKE, group: 'xyz' })]) {
      const r = await get('ranking', { filter }); expect(r.status, filter).toBeLessThan(500); expect(JSON.stringify(r.raw ?? {})).not.toMatch(/Exception|StackTrace/);
    }
  });
  test(tc('RNK-G03'), async () => {
    const c = await ctx(); for (const q of [{ page: 999, size: 20 }, { page: 1, size: 1000 }]) {
      const r = await get('ranking', { ...q, filter: JSON.stringify({ campaignId: c.cid, group: 'All' }) }); expect(r.status, JSON.stringify(q)).toBeLessThan(500);
    }
  });
  manual(['RNK-S01'], 'cần tài khoản không có quyền Xem bảng xếp hạng (mọi vai trò mẫu đều có quyền)');
  test(tc('RNK-S02'), async () => {
    for (const r of ['dti/ranking/defaults', 'dti/ranking', 'dti/ranking/export']) for (const tok of [undefined, 'x.y.z']) expect((await rawGet(r, tok)).status, r).toBe(401);
  });
  test(tc('RNK-P01'), async ({ page }) => {
    const c = await ctx(); const a0 = Date.now(); await R.get('lanhdaobo', c.cid); const apiMs = Date.now() - a0; const t0 = Date.now();
    await page.goto('/vi/reports/ranking'); await page.getByRole('heading', { name: 'Bảng xếp hạng' }).last().waitFor({ timeout: 10_000 }); await page.waitForLoadState('networkidle', { timeout: 10_000 });
    expect(Date.now() - t0, 'mở màn ≤ 5s').toBeLessThan(5000); expect(apiMs, 'API ≤ 2s').toBeLessThan(2000);
  });
});
