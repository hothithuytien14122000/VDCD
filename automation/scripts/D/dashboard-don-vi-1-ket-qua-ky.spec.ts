// D.UC1.1–UC1.2 DASHBOARD ĐƠN VỊ — tab Kết quả kỳ + Xuất Excel. Bám testcase DSH-F (bộ lọc), DSH-V (số liệu), DSH-X (xuất), DSH-G/S/P (lỗi, quyền, hiệu năng).
// Kỳ vọng tính từ API (unit/defaults, unit/periods, unit) theo công thức SRS, rồi đối chiếu với giao diện.
import type { Locator, Page } from '@playwright/test';
import { test, expect, tc, U, unitCtx, withResult, allPeriods, get, rawGet, FAKE, open, body, clickTab, tab, field, fieldValue, pick, options, visibleLabel, setRange, settle, track,
  download, noticeText, manual, need, MSG, round, vn, pct, walk, flat, levelOf, dmy, downloadApi, xlsxSheets, api, url, pageAs , openDash, ROUTE , VIEW , int, pickPeriod, openPeriodDialog, periodRows, dialogForm } from './common';

const PT: Record<string, string> = { Month: 'Tháng', Quarter: 'Quý', Year: 'Năm' };
// Khảo sát 07/11: giao diện mới bỏ các ô 'Hình thức' / 'Xem theo' / 'Khung thời gian' / 'Kỳ' trên trang.
// Kỳ chọn qua nút "Kỳ đánh giá" → dialog "Chọn kỳ đánh giá" (tìm mã/tên, Hình thức, Từ ngày–Đến ngày, bảng kỳ có radio, Lưu).
// Tab "Kết quả kỳ" đổi tên "Kết quả". Mặc định mở theo dashboard/unit/latest.
const DEVIATION = 'Lệch SRS (giao diện mới đã bỏ) — cần BA xác nhận';
/** Mở dashboard ở đơn vị mặc định rồi chọn kỳ theo tên (qua dialog chọn kỳ). */
async function openAt(p: Page, as: string, campaignName?: string) {
  const def = await openDash(p, as);
  if (!campaignName) return;
  const x = (await allPeriods(as, def.organization.id)).find((q: any) => q.campaignName === campaignName);
  if (x && x.campaignId !== def.campaignId) await pickPeriod(p, x);
}
/** Kỳ đã có kết quả của tài khoản (ưu tiên kỳ mặc định). */
async function resultCtx(as: string) {
  const c = await unitCtx(as);
  if (c.res?.hasResult) return { org: c.def.organization.id, name: c.res.campaign.name, res: c.res, def: c.def };
  const w = await withResult(as); need(w, 'đơn vị chưa có kỳ nào đã gửi kết quả');
  return { org: w!.org, name: w!.period.campaignName, res: w!.res, def: c.def };
}
/** Tổng số bản ghi trong dialog chọn kỳ ("Hiển thị a–b trong N bản ghi"). */
const dialogTotal = async (d: Locator) => Number((await d.innerText()).match(/trong\s+(\d+)\s+bản ghi/)?.[1] ?? 0);
/** Giá trị % chấp nhận cả dạng rút gọn số 0 (UI hiện "100%" thay vì "100,0%"). */
const pctRe = (x: number, d = 2) => { const v = vn(x, d); const short = v.replace(/,?0+$/, ''); return new RegExp(`(${v.replace(',', '\\,')}|${short.replace(',', '\\,')})\\s*%`); };
/** Bảng số liệu: mặc định mở hết; đảm bảo trạng thái "mở rộng tất cả". */
/** Đơn vị ngoài phạm vi của tài khoản (nguồn: admin) có kỳ đánh giá. */
async function outside(as: string) {
  const mine = new Set((await U.orgs(as)).map((o: any) => o.id));
  for (const o of (await U.orgs('admin')).filter((x: any) => !mine.has(x.id)).slice(0, 40)) {
    const cid = (await U.defaults('admin', o.id).catch(() => ({} as any)))?.campaignId; if (cid) return { other: o, cid };
  }
  need(false, 'không có đơn vị ngoài phạm vi có kỳ'); return { other: null as any, cid: '' };
}
async function expandAll(p: Page) { const b = p.getByRole('button', { name: 'Mở rộng tất cả' }); if (await b.isVisible().catch(() => false)) { await b.click(); await settle(p, 300); } }
async function collapseAll(p: Page) { const b = p.getByRole('button', { name: /^Thu gọn$/ }); if (await b.isVisible().catch(() => false)) { await b.click(); await settle(p, 300); } }

test.describe('UC1.1 Bộ lọc và giá trị mặc định', () => {
  test(tc('DSH-F01'), async ({ page }) => {
    await page.goto('/vi'); await settle(page);
    const menu = (t: string) => page.locator('aside, nav, .ant-menu, .ant-layout-sider').getByText(t, { exact: true }).filter({ visible: true }).first();
    if (!(await menu('Dashboard đơn vị').isVisible().catch(() => false))) await menu('Báo cáo thống kê').click().catch(() => {});
    await menu('Dashboard đơn vị').click(); await settle(page, 1200);
    expect(page.url()).toContain('dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard đơn vị' }).or(page.getByText('Dashboard đơn vị', { exact: true })).first()).toBeVisible();
    await expect(tab(page, /^Kết quả( kỳ)?$/)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'So sánh theo thời gian')).toBeVisible();
  });
  test(tc('DSH-F02'), async ({ page, as }) => {
    const c = await unitCtx(as); need(c.res, 'không có kỳ mặc định');
    await open(page, 'dashboard'); const t = await body(page);
    for (const s of [c.def.organization.name, c.res.campaign.shortName ?? c.res.campaign.name]) expect(t, `trang thiếu "${s}"`).toContain(s);
    const d = await openPeriodDialog(page); await d.getByPlaceholder(/Tìm theo mã, tên kỳ/).fill(c.res.campaign.code); await settle(page, 900); const sel = periodRows(d).filter({ has: page.locator('input[type=radio]:checked') }).first();
    const row = (await sel.innerText()).replace(/\s+/g, ' ');
    for (const s of [c.res.campaign.code, c.res.campaign.name, c.res.campaign.indicatorSetName]) expect(row, `dòng kỳ đang chọn thiếu "${s}"`).toContain(s);
    await d.getByRole('button', { name: /Hu[ỷủy]/ }).click();
    const other = c.periods.find((x: any) => x.campaignId !== c.def.campaignId && x.shortName !== c.res.campaign.shortName); need(other, 'chỉ có 1 kỳ');
    await pickPeriod(page, other); expect(await fieldValue(page, 'Kỳ')).toContain(other.shortName ?? other.campaignName);
  });
  test(tc('DSH-F03'), async ({ page, as }) => {
    const def = await U.defaults(as); const orgs = await U.orgs(as);
    await open(page, 'dashboard');
    expect(await fieldValue(page, 'Đơn vị'), 'ô Đơn vị phải là đơn vị của kỳ gần nhất (unit/latest)').toContain(def.organization.name);
    if (orgs[0]?.id !== def.organization.id) expect(await fieldValue(page, 'Đơn vị'), 'không được lấy đơn vị đầu cây').not.toBe(orgs[0].name);
  });
  test(tc('DSH-F04'), async ({ page, as }) => {
    const def = await U.defaults(as); const ps = await allPeriods(as, def.organization.id);
    const now = new Date().toISOString(); const started = ps.filter(p => String(p.startDate) <= now).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
    need(started.length, 'đơn vị chưa có kỳ đã bắt đầu');
    const cur = ps.find(p => p.campaignId === def.campaignId); expect(cur, 'kỳ mặc định thuộc danh sách kỳ của đơn vị').toBeTruthy();
    expect(String(cur.startDate).slice(0, 10), 'API latest: kỳ gần nhất = ngày bắt đầu muộn nhất').toBe(String(started[0].startDate).slice(0, 10));
    await open(page, 'dashboard'); expect(await fieldValue(page, 'Kỳ')).toContain(cur.shortName ?? cur.campaignName);
  });
  test(tc('DSH-F05'), async ({ page, as }) => {
    const def = await U.defaults(as); need(def.campaignId, 'không có kỳ mặc định');
    const cur = (await allPeriods(as, def.organization.id)).find(p => p.campaignId === def.campaignId);
    await open(page, 'dashboard'); const d = await openPeriodDialog(page); await d.getByPlaceholder(/Tìm theo mã, tên kỳ/).fill(cur.code); await settle(page, 900);
    const row = (await periodRows(d).filter({ has: page.locator('input[type=radio]:checked') }).first().innerText()).replace(/\s+/g, ' ');
    expect(row, 'kỳ đang chọn = kỳ gần nhất').toContain(cur.code);
    expect(row).toContain(dmy(cur.startDate)); expect(row).toContain(dmy(cur.endDate));
    if (def.form === 'Periodic') expect(row).toContain('Định kỳ'); else expect(row).toContain('Đột xuất');
  });
  test(tc('DSH-F06'), async ({ page, as }) => {
    await openDash(page, as); const d = await openPeriodDialog(page);
    await d.locator('.ant-select').first().click();
    const o = (await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').allInnerTexts()).map(x => x.trim());
    expect(o).toEqual(['Tất cả hình thức', 'Định kỳ', 'Đột xuất']);
  });
  test(tc('DSH-F08'), async ({ as }) => {
    const def = await U.defaults(as); const ps = (await allPeriods(as, def.organization.id)).filter(p => p.form === 'Periodic' && p.startDate);
    need(ps.length, 'không có kỳ định kỳ');
    const p = ps[0]; const start = String(p.startDate).slice(0, 10);
    const edge = (await U.periods(as, { organizationId: def.organization.id, form: 'Periodic', periodType: p.periodType, fromDate: '2000-01-01T00:00:00', toDate: `${start}T00:00:00` })).periods ?? [];
    expect(edge.map((x: any) => x.campaignId), 'khung kết thúc đúng ngày bắt đầu kỳ → kỳ giao khung').toContain(p.campaignId);
    const before = (await U.periods(as, { organizationId: def.organization.id, form: 'Periodic', periodType: p.periodType, fromDate: '2000-01-01T00:00:00', toDate: '2000-12-31T00:00:00' })).periods ?? [];
    expect(before.map((x: any) => x.campaignId)).not.toContain(p.campaignId);
  });
  test(tc('DSH-F09'), async ({ page, as }) => {
    await openDash(page, as); const d = await openPeriodDialog(page);
    await setRange(page, '30/06/2026', '01/04/2026');
    const [f, t] = await d.locator('.ant-picker-range input').evaluateAll(es => es.map(e => (e as HTMLInputElement).value));
    const iso = (s: string) => s.split('/').reverse().join('-');
    const msg = await noticeText(page) + ' ' + await d.innerText();
    expect(MSG.invalidRange.test(msg) || iso(t) >= iso(f), `không chấp nhận Đến ngày < Từ ngày (đang: ${f} – ${t})`).toBe(true);
  });
  test(tc('DSH-F10'), async ({ page, as }) => {
    await openDash(page, as); const d = await openPeriodDialog(page); const ins = d.locator('.ant-picker-range input');
    await expect(ins).toHaveCount(2);
    await expect(ins.nth(0)).toHaveAttribute('placeholder', 'Từ ngày'); await expect(ins.nth(1)).toHaveAttribute('placeholder', 'Đến ngày');
    await setRange(page, '01/01/2026', '31/12/2026');
    for (const v of await ins.evaluateAll(es => es.map(e => (e as HTMLInputElement).value))) expect(v).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    await expect(d.locator('.ant-picker-range .ant-picker-suffix, .ant-picker-range .anticon-calendar').first()).toBeVisible();
  });
  test(tc('DSH-F11'), async ({ page, as }) => {
    const c = await unitCtx(as); need(c.periods.length, 'không có kỳ');
    await openDash(page, as); const d = await openPeriodDialog(page);
    const rows = (await periodRows(d).allInnerTexts()).map(x => x.replace(/\s+/g, ' '));
    for (const r of rows) { const p = c.periods.find((x: any) => r.includes(x.code)); expect(p, `dòng "${r.slice(0, 40)}" thuộc danh sách kỳ API`).toBeTruthy(); expect(r, `dòng kỳ ${p.code} thiếu tên bộ chỉ số`).toContain(p.indicatorSetName); }
  });
  test(tc('DSH-F12'), async ({ page, as }) => {
    const def = await U.defaults(as); const child = (await U.orgs(as)).find((o: any) => o.id !== def.organization.id); need(child, 'phạm vi không có đơn vị con');
    const exp = (await U.periods(as, { organizationId: child.id })).periods ?? [];
    await openDash(page, as); await pick(page, 'Đơn vị', child.name);
    const d = await openPeriodDialog(page); expect(await dialogTotal(d), 'số kỳ của đơn vị con').toBe(exp.length);
    const rows = (await periodRows(d).allInnerTexts()).join(' | '); for (const p of exp.slice(0, 10)) expect(rows).toContain(p.code);
  });
  test(tc('DSH-F13'), async ({ page, as }) => {
    await openDash(page, as); const d = await openPeriodDialog(page); await setRange(page, '01/01/2010', '31/12/2010');
    expect(await d.innerText() + await noticeText(page)).toMatch(MSG.noPeriod);
  });
  test(tc('DSH-F14'), async ({ page, as }) => {
    const org = (await U.defaults(as)).organization.id; const adhoc = (await U.periods(as, { organizationId: org, form: 'AdHoc' })).periods ?? [];
    await openDash(page, as); const d = await openPeriodDialog(page); await dialogForm(page, d, 'Đột xuất');
    const rows = (await periodRows(d).allInnerTexts()).map(x => x.replace(/\s+/g, ' ')).filter(x => !MSG.noPeriod.test(x));
    expect(await dialogTotal(d) || 0, 'số kỳ Đột xuất').toBe(adhoc.length);
    for (const r of rows) { expect(r, 'chỉ hiện kỳ Đột xuất').toContain('Đột xuất'); expect(adhoc.some((x: any) => r.includes(x.code))).toBe(true); }
  });
  test(tc('DSH-F15'), async ({ page, as }) => {
    await openDash(page, as); const d = await openPeriodDialog(page); const t = track(page);
    for (const f of ['Đột xuất', 'Định kỳ']) { const n = t.reqs.length; await dialogForm(page, d, f); expect(t.since(n).some(u => u.includes('unit/periods')), `đổi sang ${f} phải tải lại kỳ`).toBe(true); }
  });
  test(tc('DSH-F17'), async ({ page, as }) => {
    const orgs = await U.orgs(as); need(orgs.length > 1, 'phạm vi chỉ 1 đơn vị');
    const child = orgs.find((o: any) => o.parentId); need(child, 'không có đơn vị con');
    await openDash(page, as); await field(page, 'Đơn vị').click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await expect(dd.locator('.ant-select-tree, [role=tree]').first(), 'ô Đơn vị dạng cây').toBeVisible();
    await page.keyboard.type(child.name.slice(0, 8)); await page.waitForTimeout(600);
    const shown = (await dd.innerText()).replace(/\s+/g, ' ');
    expect(shown).toContain(child.name);
    const kw = (await U.orgs(as, child.name.slice(0, 8))).map((o: any) => o.name);
    for (const n of kw) expect(orgs.map((o: any) => o.name), 'kết quả tìm phải trong phạm vi').toContain(n);
  });
  test(tc('DSH-F19'), async ({ page, as }) => {
    const def = await U.defaults(as); const child = (await U.orgs(as)).find((o: any) => o.id !== def.organization.id); need(child, 'phạm vi chỉ 1 đơn vị');
    const cdef = await U.defaults(as, child.id); need(cdef.campaignId, 'đơn vị con không có kỳ');
    await openDash(page, as); await pick(page, 'Đơn vị', child.name); await settle(page, 800);
    const c = ((await U.periods(as, { organizationId: child.id })).periods ?? []).find((x: any) => x.campaignId === cdef.campaignId);
    expect(await fieldValue(page, 'Kỳ'), 'đổi đơn vị → kỳ gần nhất của đơn vị đó').toContain(c.shortName ?? c.campaignName);
    expect(await body(page)).toContain(child.name);
  });
});

test.describe('UC1.1 Thẻ số liệu, biểu đồ, bảng', () => {
  test(tc('DSH-V01'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); const s = c.res.summary;
    expect(await body(page)).toMatch(new RegExp(`Điểm đạt\\s*${int(s.totalScore)}\\s*/\\s*${int(s.maxScore)}`));
  });
  test(tc('DSH-V03'), async ({ page, as }) => {
    const c = await resultCtx(as); const s = c.res.summary; const exp = (s.totalScore / s.maxScore) * 100;
    expect(round(s.rankingScore), 'API rankingScore = đạt ÷ tối đa × 100').toBe(round(exp));
    await openAt(page, as, c.name); const t = await body(page);
    expect(t, 'thẻ Tỷ lệ đạt').toMatch(new RegExp(`Tỷ lệ đạt\\s*${pctRe(exp).source}`));
  });
  test(tc('DSH-V05'), async ({ page, as }) => {
    const c = await resultCtx(as); const s = c.res.summary; await openAt(page, as, c.name); const t = await body(page);
    expect(t).toMatch(new RegExp(`Xếp loại\\s*${s.level.name}`));
    const d = await openPeriodDialog(page); await d.getByPlaceholder(/Tìm theo mã, tên kỳ/).fill(c.res.campaign.code); await settle(page, 900); expect(await periodRows(d).filter({ has: page.locator('input[type=radio]:checked') }).first().innerText(), 'thang xếp loại của kỳ').toContain(c.res.campaign.scaleName);
    expect(levelOf(s.rankingScore, s.scaleLevels)?.code, 'xếp loại theo điểm đã làm tròn, đúng mốc thuộc mức trên').toBe(s.level.code);
  });
  manual(['DSH-V06', 'DSH-V07'], 'cần dữ liệu có Điểm xếp hạng đúng mốc / sát mốc thang xếp loại');
  test(tc('DSH-V08'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name);
    const chart = page.getByRole('heading', { name: 'Kết quả theo nhóm chỉ số' }).locator('xpath=ancestor::*[.//*[contains(@class,"recharts")]][1]'); const t = (await chart.innerText()).replace(/\s+/g, ' ');
    for (const g of c.res.groups) { expect(t).toMatch(pctRe(g.ratio, 1)); expect(t).toContain(g.name); }
  });
  test(tc('DSH-V09'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); const g = c.res.groups[0];
    const bar = page.locator('.recharts-bar-rectangle, path.recharts-rectangle, rect[class*=bar]').first(); await bar.hover(); await page.waitForTimeout(500);
    const tip = (await page.locator('.recharts-tooltip-wrapper, [role=tooltip]').filter({ hasText: /\S/ }).first().innerText()).replace(/\s+/g, ' ');
    expect(tip).toContain(g.name); expect(tip).toMatch(/%/);
  });
  manual(['DSH-V10'], 'so màu nhóm chỉ số giữa các biểu đồ bằng mắt');
  test(tc('DSH-V11'), async ({ page, as }) => {
    const c = await resultCtx(as); const gs = c.res.groups; const tot = c.res.summary.totalScore;
    const sum = gs.reduce((a: number, g: any) => a + g.contribution, 0); expect(Math.abs(sum - 100)).toBeLessThan(0.02);
    for (const g of gs) expect(round(g.contribution), `tỷ trọng ${g.code}`).toBe(round((g.score / tot) * 100));
    await openAt(page, as, c.name); const t = await body(page);
    expect(t).toContain('Tỷ trọng điểm theo nhóm chỉ số');
    for (const g of gs) { expect(t).toContain(g.name); expect(t).toMatch(pctRe(g.contribution)); }
  });
  test(tc('DSH-V12'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name);
    // Biểu đồ tròn dạng vành khuyên: rê vào mép vành (tâm là lỗ trống).
    const sec = page.getByRole('heading', { name: 'Tỷ trọng điểm theo nhóm chỉ số' }).locator('xpath=ancestor::section[1]');
    await sec.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); const box = (await sec.locator('svg.recharts-surface').first().boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.06); await page.waitForTimeout(600);
    const tip = (await sec.locator('.recharts-tooltip-wrapper').filter({ hasText: /\S/ }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    expect(c.res.groups.some((g: any) => tip.includes(g.name)), 'tooltip có tên nhóm').toBe(true); expect(tip).toMatch(/%/);
  });
  test(tc('DSH-V13'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name);
    await expandAll(page);
    const rows = (await page.locator('tbody tr').allInnerTexts()).map(s => s.replace(/\s+/g, ' '));
    const codes = flat(c.res.tree).map(n => n.code); let i = 0;
    for (const code of codes) { const j = rows.findIndex((r, k) => k >= i && r.includes(code)); expect(j, `dòng ${code} đúng thứ tự cây`).toBeGreaterThanOrEqual(i); i = j; }
    for (const h of ['Điểm tối đa', 'Điểm đạt', 'Tỷ lệ đạt']) await expect(page.locator('thead').getByText(h, { exact: false }).first()).toBeVisible();
  });
  test(tc('DSH-V14'), async ({ page, as }) => {
    // UI mới mặc định mở hết cây; kiểm tra phân cấp thu gọn: Thu gọn → chỉ trụ cột; mở 1 trụ cột → hiện nhóm, chỉ số vẫn ẩn.
    const c = await resultCtx(as); await openAt(page, as, c.name); await collapseAll(page);
    for (const p of c.res.tree) await page.getByRole('button', { name: `Mở rộng ${p.code}` }).click();
    await settle(page, 300); const t = await page.locator('tbody').first().innerText();
    for (const p of c.res.tree) { expect(t).toContain(p.name); for (const g of p.children ?? []) { expect(t, 'nhóm hiện (trụ cột mở)').toContain(g.name); for (const i of g.children ?? []) expect(t, `chỉ số ${i.code} phải ẩn khi nhóm thu gọn`).not.toContain(i.name); } }
  });
  test(tc('DSH-V15'), async ({ as }) => {
    const c = await resultCtx(as);
    walk(c.res.tree, n => { const k = (n.children ?? []).filter((x: any) => x.isScored !== false); if (!k.length) return;
      expect(n.maxScore, `${n.code} điểm tối đa = Σ con`).toBe(k.reduce((a: number, x: any) => a + x.maxScore, 0));
      expect(n.score, `${n.code} điểm đạt = Σ con`).toBe(k.reduce((a: number, x: any) => a + x.score, 0)); });
    expect(c.res.total.score).toBe(c.res.tree.reduce((a: number, x: any) => a + x.score, 0)); expect(c.res.total.score).toBe(c.res.summary.totalScore);
  });
  test(tc('DSH-V16'), async ({ page, as }) => {
    const c = await resultCtx(as); walk(c.res.tree, n => { if (n.isScored !== false && n.maxScore) expect(round(n.ratio), n.code).toBe(round((n.score / n.maxScore) * 100)); });
    await openAt(page, as, c.name); await expandAll(page);
    const t = await page.locator('tbody').first().innerText(); walk(c.res.tree, n => { if (n.isScored !== false && n.maxScore) expect(t).toContain(pct((n.score / n.maxScore) * 100)); });
  });
  test(tc('DSH-V19'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name);
    const row = (await page.locator('tbody tr, tfoot tr', { hasText: 'Tổng cộng' }).last().innerText()).replace(/\s+/g, ' ');
    expect(row).toContain(int(c.res.total.maxScore)); expect(row).toContain(int(c.res.total.score)); expect(row).toContain(pct(c.res.summary.rankingScore));
  });
  test(tc('DSH-V20'), async ({ page, as }) => {
    const c = await resultCtx(as); const g = c.res.tree[0]?.children?.find((x: any) => x.children?.length); need(g, 'không có nhóm có chỉ số');
    await openAt(page, as, c.name); await expandAll(page); const leaf = g.children[0].name;
    await expect(page.locator('tbody').getByText(leaf).first()).toBeVisible();
    await page.getByRole('button', { name: `Thu gọn ${g.code}` }).click(); await settle(page, 300);
    await expect(page.locator('tbody').getByText(leaf)).toHaveCount(0);
    await page.getByRole('button', { name: `Mở rộng ${g.code}` }).click(); await settle(page, 300);
    await expect(page.locator('tbody').getByText(leaf).first()).toBeVisible();
  });
  test(tc('DSH-V21'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); const t = track(page); const n = t.reqs.length;
    await collapseAll(page);
    const col = await page.locator('tbody').first().innerText(); for (const p of c.res.tree) for (const g of p.children ?? []) expect(col, 'Thu gọn về cấp trụ cột').not.toContain(g.name);
    await page.getByRole('button', { name: 'Mở rộng tất cả' }).click(); await settle(page, 300);
    const all = await page.locator('tbody').first().innerText(); for (const x of flat(c.res.tree)) expect(all).toContain(x.name);
    expect(t.since(n).filter(u => /dashboard\/unit\?/.test(u)), 'không gọi API').toHaveLength(0);
  });
  test(tc('DSH-V22'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); const t = await body(page);
    expect(t, 'không dùng dấu chấm thập phân cho tỷ lệ').not.toMatch(/\d+\.\d{1,2}\s*%/);
    expect(t).toMatch(new RegExp(`${int(c.res.summary.totalScore)}\\s*/\\s*${int(c.res.summary.maxScore)}`));
  });
  test(tc('DSH-V23'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); await expandAll(page);
    const t = await body(page); walk(c.res.tree, n => { if (n.isScored !== false && n.maxScore) expect(t).toContain(pct((n.score / n.maxScore) * 100)); });
    for (const g of c.res.groups) expect(t).toMatch(pctRe(g.ratio, 1));
  });
  test(tc('DSH-V24'), async ({ page, as }) => {
    const w = await withResult(as, undefined, p => p.hasResult && p.isProvisional); need(w, 'không có kỳ đang diễn ra đã gửi kết quả');
    expect(w!.res.isProvisional).toBe(true);
    await openAt(page, as, w!.period.campaignName); const t = await body(page);
    expect(t, 'MSG-112 dưới tiêu đề').toMatch(/đang diễn ra|MSG-112/i); expect(t, 'nhãn Tạm thời ở thẻ Mức độ').toContain('Tạm thời');
  });
  manual(['DSH-V27'], 'cần dựng luồng gửi → mở khóa → sửa nháp ở phân hệ C');
  test(tc('DSH-V28'), async ({ page, as }) => {
    const c = await resultCtx(as);
    const before = (await api('GET', `dti/assessment-results?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ campaignId: c.res.campaign.id }))}`, undefined, as)).data?.content ?? [];
    await openAt(page, as, c.name); await downloadApi(url('dashboard/unit/export', { organizationId: c.org, campaignId: c.res.campaign.id }), as);
    const after = (await api('GET', `dti/assessment-results?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ campaignId: c.res.campaign.id }))}`, undefined, as)).data?.content ?? [];
    expect(after.map((x: any) => [x.id, x.status, x.totalScore])).toEqual(before.map((x: any) => [x.id, x.status, x.totalScore]));
    expect(await page.getByRole('button', { name: /Lưu|Sửa|Xóa|Xoá/ }).count(), 'không có thao tác ghi').toBe(0);
  });
});

test.describe('UC1.2 Xuất Excel kết quả kỳ', () => {
  // SRS: Ket_qua_ky_<ĐV>_<Kỳ>_YYYYMMDD_HHMMSS.xlsx; thực tế 07/11: ket-qua-ky_<đv-slug>_<kỳ-slug>_YYYYMMDD.xlsx (không có giờ phút giây).
  const NAME = /^ket[-_]qua[-_]ky_[^_]+_[^_]+_\d{8}(_\d{6})?\.xlsx$/i;
  test(tc('DSH-X01'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); const f = await download(page);
    expect(f.name).toMatch(NAME); const ts = f.name.match(/_(\d{8})(?:_\d{6})?\.xlsx$/)!;
    const now = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ''); expect(ts[1], 'thời điểm xuất là hôm nay').toBe(now);
  });
  test(tc('DSH-X02'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); const f = await download(page);
    expect(Object.keys(f.sheets)).toEqual(['Tổng quan', 'Chi tiết chỉ số']);
    for (const [n, rows] of Object.entries(f.sheets)) { const head = rows.slice(0, 6).flat().join(' '); expect(head, `đầu sheet ${n}`).toContain(c.res.organization.name); }
  });
  test(tc('DSH-X03'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); const f = await download(page); const t = f.sheets['Tổng quan'].flat().join(' | ');
    for (const s of [c.res.organization.name, c.res.campaign.name, c.res.campaign.indicatorSetName, c.res.campaign.scaleName, c.res.summary.level.name]) expect(t).toContain(s);
    expect(t).toMatch(/Chính thức|Tạm thời/); for (const g of c.res.groups) { expect(t).toContain(g.code); expect(t).toContain(g.name); }
  });
  test(tc('DSH-X04'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); await page.getByRole('button', { name: /^Thu gọn$/ }).click().catch(() => {});
    const f = await download(page); const rows = f.sheets['Chi tiết chỉ số']; const t = rows.map(r => r.join(' | ')).join('\n');
    for (const n of flat(c.res.tree)) expect(t, `thiếu dòng ${n.code}`).toContain(n.name);
    expect(rows.at(-1)!.join(' ')).toContain('Tổng cộng');
    const ns = flat(c.res.tree).find(n => n.isScored === false);
    if (ns) { const r = rows.find(x => x.includes(ns.name))!; expect(r.slice(-3).every(v => v === ''), 'Không tính điểm: 3 cột để trống').toBe(true); }
  });
  test(tc('DSH-X05'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); const f = await download(page);
    const nums = f.sheets['Chi tiết chỉ số'].flat().filter(v => /^-?\d+(\.\d+)?$/.test(v));
    expect(nums.length, 'điểm/tỷ lệ là ô số').toBeGreaterThan(0);
    expect(f.sheets['Chi tiết chỉ số'].flat(), 'ô trống không ghi "-"').not.toContain('-');
    expect(nums.some(v => /\.\d{3,}/.test(v)) || flat(c.res.tree).every(n => !n.maxScore || Math.abs(round((n.score / n.maxScore) * 100) - (n.score / n.maxScore) * 100) < 1e-9), 'tỷ lệ lưu giá trị chưa làm tròn').toBe(true);
  });
  test(tc('DSH-X06'), async ({ as }) => {
    const def = await U.defaults(as); const ps = (await allPeriods(as, def.organization.id)).filter(p => p.hasResult);
    const off = ps.find(p => !p.isProvisional), pro = ps.find(p => p.isProvisional); need(off || pro, 'không có kỳ có kết quả');
    for (const [p, exp] of [[off, 'Chính thức'], [pro, 'Tạm thời']] as const) if (p) {
      const f = await downloadApi(url('dashboard/unit/export', { organizationId: def.organization.id, campaignId: p.campaignId }), as);
      expect(f.status).toBe(200); expect(xlsxSheets(f.file)['Tổng quan'].flat().join(' ')).toContain(exp);
    }
  });
  test(tc('DSH-X07'), async ({ page, as }) => {
    const def = await U.defaults(as); const p = (await allPeriods(as, def.organization.id)).find(x => !x.hasResult); need(p, 'đơn vị đã gửi mọi kỳ');
    const r = await downloadApi(url('dashboard/unit/export', { organizationId: def.organization.id, campaignId: p.campaignId }), as);
    expect(r.status, 'API không tạo tệp, lỗi nghiệp vụ').toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500); expect(r.text).toMatch(MSG.noExport);
    await openAt(page, as, p.campaignName); const btn = page.getByRole('button', { name: /Xuất Excel/ }).first();
    if (await btn.isEnabled()) { await btn.click(); await expect.poll(() => noticeText(page)).toMatch(MSG.noExport); }
  });
  test(tc('DSH-X08'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name); let n = 0; page.on('download', () => n++);
    await page.route('**/dashboard/unit/export**', async r => { await new Promise(f => setTimeout(f, 1500)); await r.continue(); });
    const b = page.getByRole('button', { name: /Xuất Excel/ }).first(); await b.click();
    await expect(b, 'nút vô hiệu khi đang tạo tệp').toBeDisabled({ timeout: 1000 }); await b.click({ force: true }).catch(() => {}); await b.click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000); expect(n).toBe(1);
  });
  test(tc('DSH-X09'), async ({ page, as }) => {
    const c = await resultCtx(as); await openAt(page, as, c.name);
    await page.route('**/dashboard/unit/export**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Xuất tệp thất bại"}' }));
    const b = page.getByRole('button', { name: /Xuất Excel/ }).first(); await b.click();
    await expect.poll(() => noticeText(page)).toMatch(/thất bại|MSG-024|lỗi/i); await expect(b).toBeEnabled();
  });
  manual(['DSH-X10'], 'cần tài khoản có quyền Xem nhưng không có quyền Xuất dashboard đơn vị');
});

test.describe('UC1.1 Lỗi, quyền, hiệu năng', () => {
  test(tc('DSH-G05'), async ({ as }) => {
    for (const q of [{ organizationId: FAKE, campaignId: FAKE }, { organizationId: 'abc', campaignId: 'abc' }]) {
      const r = await get('dashboard/unit', q, as); expect(r.status, JSON.stringify(q)).toBeLessThan(500);
      expect(JSON.stringify(r.raw ?? {})).not.toMatch(/Exception|StackTrace|at [A-Z]\w+\./);
      if (r.status === 200) expect(r.data?.hasResult).toBeFalsy();
    }
  });
  test(tc('DSH-S01'), async ({ browser, baseURL }) => {
    const p = await pageAs(browser, 'canbo', baseURL);
    await p.goto('/vi'); await settle(p); expect(await p.getByText('Dashboard đơn vị', { exact: true }).count(), 'Cán bộ không thấy menu').toBe(0);
    await p.goto(ROUTE.dashboard); await settle(p, 1500);
    expect((await body(p)) + await noticeText(p)).toMatch(/không có quyền|MSG-043|403/i);
    expect((await get('dashboard/unit/latest', {}, 'canbo')).status).toBe(403);
  });
  manual(['DSH-S02'], 'cần tài khoản chỉ có 1 trong 2 quyền xem');
  test(tc('DSH-S03'), async ({ as }) => {
    const { other, cid } = await outside(as);
    const r = await get('dashboard/unit', { organizationId: other.id, campaignId: cid }, as);
    if (r.status === 200) expect(r.data?.organization?.id, 'không trả dữ liệu đơn vị ngoài phạm vi').not.toBe(other.id); else expect(r.status).toBe(403);
  });
  test(tc('DSH-S05'), async ({ as }) => {
    const { other, cid } = await outside(as);
    const f = await downloadApi(url('dashboard/unit/export', { organizationId: other.id, campaignId: cid }), as);
    expect(f.status, 'xuất đơn vị ngoài phạm vi phải bị chặn').toBe(403);
  });
  test(tc('DSH-S06'), async () => {
    for (const r of ['dti/dashboard/unit/latest', 'dti/dashboard/unit', 'dti/dashboard/unit/export', 'dti/dashboard/trend'])
      for (const tok of [undefined, 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid']) expect((await rawGet(r, tok)).status, `${r} ${tok ? 'token giả' : 'không token'}`).toBe(401);
  });
  test(tc('DSH-P01'), async ({ page, as }) => {
    const c = await resultCtx(as); const t0 = Date.now();
    const api0 = Date.now(); await U.unit(as, c.org, c.res.campaign.id); const apiMs = Date.now() - api0;
    await page.goto(ROUTE.dashboard); await page.getByText('Điểm đạt').first().waitFor({ timeout: 10_000 });
    expect(Date.now() - t0, 'mở màn ≤ 5s').toBeLessThan(5000 + apiMs); expect(apiMs, 'API unit ≤ 2s').toBeLessThan(2000);
  });
});
