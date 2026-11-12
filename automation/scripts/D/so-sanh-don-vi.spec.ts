// D.UC2.3–UC2.5 SO SÁNH ĐƠN VỊ. Bám testcase SSD-F (menu, bộ lọc), SSD-U (đơn vị), SSD-C (chỉ tiêu), SSD-V (chi tiết), SSD-T (qua các kỳ), SSD-X (xuất), SSD-G/S/P.
// Hạng trong đơn vị đã chọn tính lại theo SRS (dòng 1691, 1696) từ API compare/detail, compare/trend.
import type { Locator, Page } from '@playwright/test';
import { test, expect, tc, C, rankAll, pageAs, compareCtx, get, rawGet, FAKE, open, body, clickTab, fieldValue, pick, options, visibleLabel, setRange, settle, track, download, noticeText, dmy,
  manual, need, MSG, round, pct, int, vn, ranks, downloadApi, xlsxSheets, url, ck, pickPeriod, openPeriodDialog, periodRows, dialogForm } from './common';

// Khảo sát 07/11 (giao diện mới): một màn duy nhất (không còn tab "So sánh qua các kỳ"). Kỳ chọn qua nút "Kỳ đánh giá" → dialog;
// "Đơn vị so sánh — Đã chọn N, tối thiểu 2" (chip "Bỏ <tên>", "Khôi phục mặc định", "Thêm đơn vị" → dialog cây có checkbox, đơn vị chưa gửi bị khoá);
// "Chỉ tiêu so sánh — Đã chọn N" ("Thêm chỉ tiêu" → dialog checkbox); khối "So sánh theo chỉ tiêu" với Cột | Tròn | Số liệu.
// API compare/detail không còn pies; xuất: so-sanh-chi-tiet_<kỳ>_YYYYMMDD.xlsx, 1 sheet 'So sánh chi tiết'. Kỳ mặc định chưa có kết quả
// → các case số liệu dùng kỳ có nhiều đơn vị đã gửi nhất.
const DEVIATION = 'Lệch SRS (giao diện mới đã bỏ) — cần BA xác nhận';
const NO_TREND = `${DEVIATION}: không còn tab "So sánh qua các kỳ" (và API/xuất tương ứng)`;
const chipBtn = (p: Page, name: string) => p.getByRole('button', { name: `Bỏ ${name}`, exact: true });
async function removeChip(p: Page, _block: string, name: string) { await chipBtn(p, name).click(); await settle(p); }
let BEST: Promise<any> | null = null;
/** Kỳ có nhiều đơn vị đã gửi nhất (≥ 2) trong phạm vi lanhdaobo. */
async function best() {
  BEST ??= (async () => {
    let b: any = null;
    for (const p of ((await C.periods('lanhdaobo', {})).periods ?? []).filter((x: any) => x.hasResult)) {
      const o = await C.orgs('lanhdaobo', { campaignIds: [p.campaignId], defaultCampaignId: p.campaignId }); const n = (o.items ?? []).filter((x: any) => x.hasResult).length;
      if (!b || n > b.n) b = { p, n };
    }
    return b && b.n >= 2 ? b.p : null;
  })();
  return BEST;
}
/** Mở trang và chọn kỳ (mặc định: kỳ giàu dữ liệu). */
async function openCmp(p: Page, _as = 'lanhdaobo', period?: any) {
  await open(p, 'compare'); const k = period ?? await best(); if (k) await pickPeriod(p, k); await settle(p, 800);
}
async function ctx(as = 'lanhdaobo') { const k = await best(); need(k, 'không có kỳ ≥ 2 đơn vị đã gửi'); const c = await compareCtx(as, k.campaignId); need(c.detail, 'kỳ có dưới 2 đơn vị có kết quả'); return { ...c, period: k }; }
const section = (p: Page) => p.getByRole('heading', { name: 'So sánh theo chỉ tiêu' }).locator('xpath=ancestor::section[1]');
async function view(p: Page, v: 'Cột' | 'Tròn' | 'Số liệu') { await section(p).getByText(v, { exact: true }).first().click(); await settle(p, 500); }
const rowsOf = async (p: Page) => (await section(p).locator('tbody tr').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
async function openDlg(p: Page, btn: RegExp) { await p.getByRole('button', { name: btn }).click(); const d = p.getByRole('dialog').last(); await d.waitFor(); await settle(p, 500); return d; }
const treeItem = (d: Locator, name: string) => d.getByRole('treeitem').filter({ hasText: name }).first();
/** % tỷ lệ: UI bỏ số 0 thừa (100%, 75%); chấp nhận 75,5% / 75,50%. */
const pctRe = (x: number) => { const alts = [vn(x, 2), vn(x, 2).replace(/,?0+$/, ''), vn(x, 1), vn(x, 1).replace(/,0$/, '')]; return new RegExp(`(${[...new Set(alts)].join('|')})%`); };

test.describe('So sánh đơn vị — menu, phạm vi, bộ lọc', () => {
  test(tc('SSD-F01'), async ({ page }) => {
    await page.goto('/vi'); await settle(page);
    const menu = (t: string) => page.locator('aside, nav, .ant-menu, .ant-layout-sider').getByText(t, { exact: true }).filter({ visible: true }).first();
    if (!(await menu('So sánh đơn vị').isVisible().catch(() => false))) await menu('Báo cáo thống kê').click().catch(() => {});
    await menu('So sánh đơn vị').click(); await settle(page, 1200);
    expect(page.url()).toContain('reports/compare');
    await expect(page.getByRole('heading', { name: 'So sánh đơn vị' }).first(), 'tiêu đề SRS "So sánh đơn vị"').toBeVisible();
    for (const s of ['Kỳ đánh giá', 'Đơn vị so sánh', 'Chỉ tiêu so sánh']) expect(await body(page)).toContain(s);
  });
  manual(['SSD-F03'], 'cần tài khoản phạm vi Đơn vị và đơn vị con mà đơn vị không có đơn vị con');
  test(tc('SSD-F06'), async ({ page }) => {
    const ps = (await C.periods('lanhdaobo', {})).periods ?? []; await open(page, 'compare'); const d = await openPeriodDialog(page);
    await expect(d.getByPlaceholder('Từ ngày')).toBeVisible(); await expect(d.getByPlaceholder('Đến ngày')).toBeVisible(); await expect(d.getByText('Tất cả hình thức')).toBeVisible();
    for (const r of (await periodRows(d).allInnerTexts()).map(x => x.replace(/\s+/g, ' '))) { const p = ps.find((x: any) => r.includes(x.code) && r.includes(String(x.campaignName).replace(/\s+/g, ' '))); expect(p, r.slice(0, 50)).toBeTruthy(); expect(r).toContain(p.indicatorSetName); }
  });
  test(tc('SSD-F07'), async ({ page }) => {
    await open(page, 'compare'); const d = await openPeriodDialog(page); await setRange(page, '30/06/2026', '01/04/2026');
    const [f, t] = await d.locator('.ant-picker-range input').evaluateAll(es => es.map(e => (e as HTMLInputElement).value)); const iso = (s: string) => s.split('/').reverse().join('-');
    expect(MSG.invalidRange.test(await d.innerText() + await noticeText(page)) || iso(t) >= iso(f), `không chấp nhận Đến ngày < Từ ngày (${f} – ${t})`).toBe(true);
    await d.getByRole('button', { name: /Hu[ỷủy]/ }).click(); const d2 = await openPeriodDialog(page);
    await setRange(page, '01/01/2010', '31/12/2010'); expect(await d2.innerText() + await noticeText(page)).toMatch(MSG.noPeriod);
  });
  test(tc('SSD-F08'), async ({ page }) => {
    await open(page, 'compare'); const d = await openPeriodDialog(page); await dialogForm(page, d, 'Đột xuất');
    for (const r of await periodRows(d).allInnerTexts()) expect(r).toContain('Đột xuất');
    const ps = (await C.periods('lanhdaobo', { form: 'AdHoc' })).periods ?? []; for (const p of ps) expect(p.form).toBe('AdHoc');
  });
});

test.describe('So sánh chi tiết — đơn vị so sánh', () => {
  test(tc('SSD-U01'), async ({ page }) => {
    const c = await ctx(); const r = await rankAll('lanhdaobo', c.cid); const inScope = new Set(c.orgs.items.filter((o: any) => o.hasResult).map((o: any) => o.id));
    const s = r.rows.filter((x: any) => !x.notSent && inScope.has(x.id)); const exp = s.length <= 6 ? s : [...s.slice(0, 3), ...s.slice(-3)];
    expect([...c.ids].sort(), '3 đầu + 3 cuối theo Điểm XH').toEqual(exp.map((x: any) => x.id).sort());
    await openCmp(page); for (const x of exp) await expect(chipBtn(page, x.name)).toBeVisible();
    expect(await body(page)).toMatch(new RegExp(`Đã chọn ${exp.length}, tối thiểu 2`));
  });
  test(tc('SSD-U03'), async ({ page }) => {
    const c = await ctx(); const parent = c.orgs.items.find((o: any) => o.hasResult && c.orgs.items.some((k: any) => k.parentId === o.id && k.hasResult)); need(parent, 'không có cặp cha–con cùng có kết quả');
    await openCmp(page); const d = await openDlg(page, /Thêm đơn vị/); await expect(d.getByRole('tree')).toBeVisible();
    await d.getByPlaceholder(/Tìm theo mã, tên đơn vị/).fill(parent.name.slice(0, 8)); await page.waitForTimeout(600); expect(await d.innerText()).toContain(parent.name);
    await d.getByPlaceholder(/Tìm theo mã, tên đơn vị/).fill(''); await page.waitForTimeout(400);
    const on = () => d.locator('[role=checkbox][aria-checked=true]').count(); const before = await on();
    const cb = treeItem(d, parent.name).getByRole('checkbox'); const wasOn = (await cb.getAttribute('aria-checked')) === 'true';
    await cb.click(); await settle(page, 300);
    expect(await on(), 'tích cha chỉ đổi 1 ô (không tự chọn con)').toBe(before + (wasOn ? -1 : 1));
  });
  test(tc('SSD-U04'), async ({ page }) => {
    const c = await ctx(); const none = c.orgs.items.filter((o: any) => !o.hasResult);
    await openCmp(page); const d = await openDlg(page, /Thêm đơn vị/);
    for (const o of none.slice(0, 5)) { const it = treeItem(d, o.name); expect(await it.innerText(), o.name).toContain('Chưa gửi kết quả'); await expect(it.getByRole('checkbox'), `${o.name} chưa có kết quả không được chọn`).toHaveAttribute('aria-disabled', 'true'); }
    const sub = await C.orgs('lanhdaobo', { campaignIds: [c.cid], submittedOnly: true }); for (const o of sub.items) expect(o.hasResult, `${o.name} (submittedOnly)`).toBe(true);
  });
  test(tc('SSD-U05'), async ({ as }) => {
    const k = await best(); need(k, 'không có kỳ có kết quả'); const c = await compareCtx(as, k.campaignId); const r = await get('dashboard/unit/organizations', {}, as); need(r.status === 200, `${as} không xem được danh sách đơn vị (dashboard ${r.status})`);
    const scope = new Set(r.data.map((o: any) => o.id)); for (const o of c.orgs.items) expect(scope.has(o.id), `${o.name} ngoài phạm vi`).toBe(true);
  });
  test(tc('SSD-U06'), async ({ page }) => {
    const c = await ctx(); need(c.ids.length >= 3, 'cần ≥ 3 đơn vị'); const gone = c.detail.units.find((u: any) => u.id === c.ids[0]);
    await openCmp(page); await removeChip(page, 'Đơn vị so sánh', gone.name); const t = await body(page);
    expect(t).toMatch(new RegExp(`Đã chọn ${c.ids.length - 1}`)); await view(page, 'Số liệu');
    expect(await section(page).locator('thead').first().innerText()).not.toContain(gone.name);
    expect(await section(page).innerText()).toMatch(new RegExp(`Hạng \\d+ / ${c.ids.length - 1}`));
  });
  test(tc('SSD-U07'), async ({ page }) => {
    const c = await ctx(); await openCmp(page); const tr = track(page);
    for (const id of c.ids.slice(1)) await removeChip(page, 'Đơn vị so sánh', c.detail.units.find((u: any) => u.id === id).name);
    const n = tr.reqs.length; await settle(page); expect(await body(page) + await noticeText(page)).toMatch(MSG.min2Unit);
    expect(await page.locator('table').count()).toBe(0); expect(tr.since(n).filter(u => /compare\/detail\?/.test(u))).toHaveLength(0);
  });
  test(tc('SSD-U09'), async ({ page }) => {
    const c = await ctx(); const ps = ((await C.periods('lanhdaobo', {})).periods ?? []).filter((p: any) => p.hasResult && p.campaignId !== c.cid); const other = ps[0]; need(other, 'chỉ có 1 kỳ có kết quả');
    const nx = await C.orgs('lanhdaobo', { campaignIds: [other.campaignId], defaultCampaignId: other.campaignId }); const ok = new Set(nx.items.filter((o: any) => o.hasResult).map((o: any) => o.id));
    const keep = c.ids.filter(id => ok.has(id)); const expIds = keep.length >= 2 ? keep : nx.defaultOrganizationIds;
    await openCmp(page); await pickPeriod(page, other); await settle(page, 800);
    for (const id of expIds) await expect(chipBtn(page, nx.items.find((o: any) => o.id === id).name), 'giữ đơn vị còn hợp lệ').toBeVisible();
    for (const id of c.ids.filter(id => !ok.has(id))) await expect(chipBtn(page, c.detail.units.find((u: any) => u.id === id).name), 'bỏ đơn vị không có kết quả ở kỳ mới').toHaveCount(0);
  });
  test(tc('SSD-U10'), async ({ page }) => {
    let p: any = null; for (const x of ((await C.periods('lanhdaobo', {})).periods ?? []).slice(0, 30)) { const o = await C.orgs('lanhdaobo', { campaignIds: [x.campaignId], defaultCampaignId: x.campaignId }); if ((o.items ?? []).filter((i: any) => i.hasResult).length < 2) { p = x; break; } }
    need(p, 'mọi kỳ đều có ≥ 2 đơn vị đã gửi');
    await openCmp(page, 'lanhdaobo', p); expect(await body(page) + await noticeText(page)).toMatch(new RegExp(`${MSG.noData.source}|${MSG.min2Unit.source}`, 'i'));
    expect(await page.locator('table').count()).toBe(0);
  });
});

test.describe('So sánh chi tiết — chỉ tiêu', () => {
  test(tc('SSD-C02'), async ({ page }) => {
    const c = await ctx(); const kinds = new Set(c.crit.criteria.map((x: any) => x.kind)); expect(kinds.size, 'có Điểm XH, Trụ cột, Nhóm').toBeGreaterThanOrEqual(3);
    for (const x of c.crit.criteria) expect(['Ranking', 'Pillar', 'Group'], `${x.name}: không tới cấp chỉ số`).toContain(x.kind);
    await openCmp(page); const d = await openDlg(page, /Thêm chỉ tiêu/); const t = (await d.innerText()).replace(/\s+/g, ' ');
    for (const x of c.crit.criteria) expect(t).toContain(x.name);
  });
  test(tc('SSD-C03'), async ({ page }) => {
    const c = await ctx(); const pil = c.crit.criteria.find((x: any) => x.kind === 'Pillar'); need(pil, 'không có chỉ tiêu trụ cột');
    const d = await C.detail('lanhdaobo', c.cid, c.ids, [...c.critDef, ck(pil)]); const row = d.rows.find((r: any) => ck(r.criterion) === ck(pil)); expect(row.values.length).toBe(c.ids.length);
    await openCmp(page); const dl = await openDlg(page, /Thêm chỉ tiêu/); await dl.locator('label', { hasText: pil.name }).first().click(); await dl.getByRole('button', { name: /^Lưu$/ }).click(); await settle(page);
    await view(page, 'Số liệu'); const r = (await rowsOf(page)).find(x => x.includes(pil.name)) ?? ''; for (const v of row.values.filter((x: any) => x.hasResult)) expect(r).toMatch(pctRe(v.ratio));
  });
  test(tc('SSD-C04'), async ({ page }) => {
    await openCmp(page); const chips = page.locator('button[aria-label^="Bỏ "]');
    const crit = (await C.criteria('lanhdaobo', (await best()).campaignId)).criteria; const names = crit.map((x: any) => x.name);
    for (const n of names) { const b = chipBtn(page, n); if (await b.count()) { await b.click(); await settle(page); } }
    const left = await page.getByText(/Chỉ tiêu so sánh\s*Đã chọn (\d+)/).first().innerText().catch(() => '');
    expect(MSG.min1Crit.test(await body(page) + await noticeText(page)) || /Đã chọn 1/.test(left), 'không thể bỏ hết chỉ tiêu (còn tối thiểu 1 hoặc báo MSG-115)').toBe(true);
    expect(await chips.count()).toBeGreaterThan(0);
  });
});

test.describe('So sánh chi tiết — biểu đồ, bảng, hạng', () => {
  test(tc('SSD-V01'), async ({ page }) => {
    const c = await ctx(); await openCmp(page); const t = (await section(page).innerText()).replace(/\s+/g, ' ');
    for (const u of c.detail.units) expect(t).toContain(u.name); expect(t).toContain('Điểm xếp hạng');
  });
  test(tc('SSD-V02'), async ({ page }) => {
    // UI mới: chế độ Tròn ghi "#hạng tỷ lệ%" từng đơn vị (không còn tooltip Hạng x/N trên cột).
    const c = await ctx(); await openCmp(page); await view(page, 'Tròn'); const t = (await section(page).innerText()).replace(/\s+/g, ' ');
    const row = c.detail.rows.find((r: any) => r.criterion.kind === 'Ranking') ?? c.detail.rows[0];
    for (const v of row.values.filter((x: any) => x.hasResult)) expect(t).toMatch(new RegExp(`#${v.rank}\\s*${pctRe(v.ratio).source}`));
    expect(t).toMatch(new RegExp(`${pctRe(row.average).source}\\s*trung bình`));
  });
  test(tc('SSD-V04'), async ({ page }) => {
    const c = await ctx(); await openCmp(page); await view(page, 'Số liệu'); const rows = await rowsOf(page);
    expect(rows[0]).toMatch(/^Tổng điểm/); expect(rows[1]).toMatch(/^Xếp loại/);
    for (const r of c.detail.rows.filter((r: any) => rows.some(x => x.startsWith(r.criterion.name)))) { const line = rows.find(x => x.startsWith(r.criterion.name))!; for (const v of r.values.filter((x: any) => x.hasResult)) { expect(line).toMatch(pctRe(v.ratio)); expect(line).toContain(`Hạng ${v.rank} / ${c.ids.length}`); } }
    const u = c.detail.units[0]; expect(rows[0]).toMatch(new RegExp(`${int(u.totalScore)}\\s*/\\s*${int(u.maxScore)}`));
  });
  test(tc('SSD-V05'), async () => {
    const c = await ctx(); for (const r of c.detail.rows) { const vs = r.values.filter((v: any) => v.hasResult); expect(vs.map((v: any) => v.rank), r.criterion.name).toEqual(ranks(vs.map((v: any) => v.ratio))); for (const v of vs) expect(v.rankedCount).toBe(vs.length); }
  });
  test(tc('SSD-V06'), async () => {
    const c = await ctx(); const r = await rankAll('lanhdaobo', c.cid); const s = r.rows.filter((x: any) => !x.notSent && c.orgs.items.some((o: any) => o.id === x.id)); need(s.length >= 6, 'cần ≥ 6 đơn vị có kết quả');
    const pickTwo = [s[2], s[s.length - 2]]; const d = await C.detail('lanhdaobo', c.cid, pickTwo.map((x: any) => x.id), c.critDef);
    const row = d.rows.find((x: any) => /Điểm xếp hạng/.test(x.criterion.name)) ?? d.rows[0];
    expect(row.values.map((v: any) => v.rank), 'hạng tính lại trong 2 đơn vị đã chọn (không lấy hạng toàn kỳ)').toEqual(ranks(row.values.map((v: any) => v.ratio)));
    expect(Math.max(...row.values.map((v: any) => v.rank)), 'hạng ≤ số đơn vị đã chọn').toBeLessThanOrEqual(2);
  });
  test(tc('SSD-V07'), async () => {
    const c = await ctx(); const r = await rankAll('lanhdaobo', c.cid); const m = new Map(r.rows.map((x: any) => [x.id, x]));
    for (const u of c.detail.units) { const x: any = m.get(u.id); expect([u.totalScore, u.maxScore, round(u.rankingScore)], u.name).toEqual([x.totalScore, x.maxScore, round(x.rankingScore)]); }
  });
  test(tc('SSD-V09'), async ({ page }) => {
    let p: any = null; for (const x of ((await C.periods('lanhdaobo', {})).periods ?? []).filter((q: any) => q.isProvisional && q.hasResult)) { const c = await compareCtx('lanhdaobo', x.campaignId); if (c.detail) { p = x; expect(c.detail.isProvisional).toBe(true); break; } }
    need(p, 'không có kỳ đang diễn ra có ≥ 2 đơn vị gửi');
    await openCmp(page, 'lanhdaobo', p); const t = await body(page); expect(t).toContain('Tạm thời'); expect(t).toMatch(/đang diễn ra|MSG-112/i);
  });
});

test.describe('So sánh qua các kỳ', () => {
  for (let i = 1; i <= 16; i++) test(tc(`SSD-T${String(i).padStart(2, '0')}`), async () => { test.skip(true, NO_TREND); });
});

test.describe('UC2.5 Xuất so sánh đơn vị', () => {
  // SRS: So_sanh_chi_tiet_<Kỳ>_YYYYMMDD_HHMMSS.xlsx (2 sheet); thực tế 07/11: so-sanh-chi-tiet_<kỳ-slug>_YYYYMMDD.xlsx, 1 sheet.
  const exp = (q: any) => downloadApi(url('compare/detail/export', q));
  test(tc('SSD-X01'), async ({ page }) => {
    await ctx(); await openCmp(page); const f = await download(page);
    expect(f.name).toMatch(/^so[-_]sanh[-_]chi[-_]tiet_.+_\d{8}(_\d{6})?\.xlsx$/i); expect(Object.keys(f.sheets)).toContain('So sánh chi tiết');
  });
  test(tc('SSD-X02'), async () => {
    const c = await ctx(); const f = await exp({ campaignId: c.cid, organizationIds: c.ids, criteria: c.critDef }); const s = xlsxSheets(f.file)['So sánh chi tiết'];
    const t = s.map(r => r.join('|')).join('\n'); for (const x of [c.detail.campaign.name, c.detail.campaign.indicatorSetName, c.detail.campaign.scaleName, 'Tổng điểm đạt', 'Điểm tối đa', 'Xếp loại']) expect(t).toContain(x);
    for (const r of c.detail.rows) expect(t).toContain(r.criterion.name); const head = s.find(r => r.includes('Hạng'))!; expect(head.filter(v => v === 'Hạng').length, 'mỗi đơn vị cột Hạng').toBe(c.ids.length);
  });
  test(tc('SSD-X05'), async () => {
    const c = await ctx(); need(c.ids.length >= 3 && c.critDef.length >= 2, 'cần ≥ 3 đơn vị, 2 chỉ tiêu');
    const dropU = c.detail.units.find((u: any) => u.id === c.ids[0]).name; const dropC = c.crit.criteria.find((x: any) => ck(x) === c.critDef.at(-1)).name;
    const f = await exp({ campaignId: c.cid, organizationIds: c.ids.slice(1), criteria: c.critDef.slice(0, -1) });
    const t = xlsxSheets(f.file)['So sánh chi tiết'].map(r => r.join('|')).join('\n'); expect(t).not.toContain(dropU); expect(t).not.toContain(dropC);
  });
  test(tc('SSD-X07'), async () => {
    const c = await ctx();
    for (const q of [{ campaignId: c.cid, organizationIds: c.ids.slice(0, 1), criteria: c.critDef }, { campaignId: c.cid, organizationIds: c.ids, criteria: [] }]) {
      const f = await exp(q); expect(f.status, JSON.stringify(q).slice(0, 80)).toBeGreaterThanOrEqual(400); expect(f.status).toBeLessThan(500);
    }
  });
  test(tc('SSD-X09'), async ({ page }) => {
    await ctx(); await openCmp(page); let n = 0; page.on('download', () => n++);
    await page.route('**/compare/detail/export**', async r => { await new Promise(f => setTimeout(f, 1500)); await r.continue(); });
    const b = page.getByRole('button', { name: /Xuất Excel/ }).first(); await b.click(); await expect(b).toBeDisabled({ timeout: 1000 }); await b.click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000); expect(n).toBe(1);
  });
  manual(['SSD-X10'], 'cần tài khoản có quyền Xem nhưng không có quyền Xuất so sánh đơn vị');
});

test.describe('So sánh đơn vị — lỗi, quyền, hiệu năng', () => {
  test(tc('SSD-G01'), async ({ page }) => {
    const c = await ctx(); need(c.ids.length >= 3, 'cần ≥ 3 đơn vị'); await openCmp(page);
    await page.route(/compare\/detail\?/, r => r.fulfill({ status: 500, body: '{}' })); await removeChip(page, 'Đơn vị so sánh', c.detail.units[0].name);
    expect(await body(page) + await noticeText(page)).toMatch(MSG.loadErr); expect(await body(page)).toMatch(new RegExp(`Đã chọn ${c.ids.length - 1}`));
  });
  test(tc('SSD-G02'), async () => {
    const c = await ctx();
    for (const q of [{ campaignId: c.cid, organizationIds: c.ids.slice(0, 1), criteria: c.critDef }, { campaignId: c.cid, organizationIds: c.ids, criteria: [] }, { campaignId: FAKE, organizationIds: c.ids, criteria: c.critDef }]) {
      const r = await get('compare/detail', q); expect(r.status, JSON.stringify(q).slice(0, 80)).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    }
  });
  test(tc('SSD-S02'), async () => {
    for (const r of ['dti/compare/defaults', 'dti/compare/detail', 'dti/compare/detail/export']) for (const tok of [undefined, 'x.y.z']) expect((await rawGet(r, tok)).status, r).toBe(401);
  });
  test(tc('SSD-S03'), async ({ browser, baseURL }) => {
    const p = await pageAs(browser, 'canbo', baseURL); await p.goto('/vi'); await settle(p); expect(await p.getByText('So sánh đơn vị', { exact: true }).filter({ visible: true }).count()).toBe(0);
    const r = await get('compare/defaults', {}, 'canbo'); expect(r.status === 403 || r.data?.available === false).toBe(true);
  });
  test(tc('SSD-P01'), async ({ page }) => {
    const c = await ctx(); const a0 = Date.now(); await C.detail('lanhdaobo', c.cid, c.ids, c.critDef); const apiMs = Date.now() - a0; const t0 = Date.now();
    await page.goto('/vi/reports/compare'); await page.getByRole('heading', { name: 'So sánh đơn vị' }).first().waitFor({ timeout: 10_000 }); await page.waitForLoadState('networkidle', { timeout: 10_000 });
    expect(Date.now() - t0).toBeLessThan(5000); expect(apiMs).toBeLessThan(2000);
  });
});
