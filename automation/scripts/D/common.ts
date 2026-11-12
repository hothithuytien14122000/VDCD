// Dùng chung cho Phân hệ D (Dashboard đơn vị, Bảng xếp hạng, So sánh đơn vị). Tên test = "[ID] tiêu đề" từ catalog.json.
// Mỗi test chạy bằng tài khoản của testcase trong catalog (cột tai_khoan_chay: ldd / ldp / lanhdaobo), không dùng superadmin,
// vì phạm vi dữ liệu là điều kiện chính của phân hệ này. Dữ liệu được dò qua API; thiếu dữ liệu cần thiết thì test.skip kèm lý do.
// Khảo sát 03/11/2026: route #/vi/reports/{dashboard|ranking|compare}; enum group All|Central|Province, form Periodic|AdHoc,
// periodType Month|Quarter|Year; mảng query gửi dạng "a,b" (theo bundle giao diện).
import { test as base, expect, Page, Browser, Locator } from '@playwright/test';
import fs from 'node:fs';
import { tc, api } from '../A/common';
import { API_BASE, tokenOf } from '../api';
import { hidePwExpiry } from '../helpers';
import { xlsxSheets, downloadApi as dlApi } from '../E/common';
export { tc, expect, api, xlsxSheets, API_BASE };
/** Tải tệp qua API bằng tài khoản của testcase (mặc định lanhdaobo, theo D_AS). */
export const downloadApi = (resource: string, as = 'lanhdaobo') => dlApi(resource, acc(as));

type TC = { id: string; account?: string | null };
const CATALOG: TC[] = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8'));
/** D_AS=admin: chạy thay tài khoản lanhdaobo (phạm vi toàn quốc) khi chưa có session lanhdaobo; ldd/ldp giữ nguyên vì là case phạm vi. */
export const acc = (k: string) => (k === 'lanhdaobo' && process.env.D_AS) || k;
export const accountOf = (title: string) => acc(CATALOG.find(c => c.id === title.match(/^\[([A-Z]{3}-[A-Z]\d+)\]/)?.[1])?.account ?? 'lanhdaobo');
const hasAuth = (k: string) => fs.existsSync(`auth/${k}.json`);
const ALIVE = new Map<string, Promise<boolean>>();
/** Session còn hiệu lực phía máy chủ (token lưu trong auth/<key>.json có thể bị thu hồi trước hạn exp). */
const alive = (k: string) => {
  if (!ALIVE.has(k)) ALIVE.set(k, fetch(`${API_BASE}/api/v1/dti/ranking/defaults`, { headers: { Authorization: `Bearer ${tokenOf(k)}` } }).then(r => r.status !== 401).catch(() => true));
  return ALIVE.get(k)!;
};
/** Skip có lý do khi thiếu hoặc hết hạn session của tài khoản. */
async function requireSession(k: string) {
  test.skip(!hasAuth(k), `Thiếu session auth/${k}.json — chạy: node save-session.mjs ${k}`);
  test.skip(!(await alive(k)), `Session auth/${k}.json hết hạn (401) — đăng nhập lại: node save-session.mjs ${k}`);
}

export const test = base.extend<{ as: string }>({
  as: async ({}, use, ti) => { await use(accountOf(ti.title)); },
  page: async ({ browser, baseURL, as }, use) => {
    await requireSession(as);
    const ctx = await browser.newContext({ storageState: `auth/${as}.json`, baseURL, acceptDownloads: true });
    await hidePwExpiry(ctx);
    const p = await ctx.newPage(); p.setDefaultTimeout(15_000);
    await use(p); await ctx.close();
  },
});
/** Mở thêm một trang bằng tài khoản khác (so sánh phạm vi giữa các vai trò). */
export async function pageAs(browser: Browser, key: string, baseURL?: string) {
  key = acc(key);
  await requireSession(key);
  const ctx = await browser.newContext({ storageState: `auth/${key}.json`, baseURL, acceptDownloads: true });
  await hidePwExpiry(ctx);
  return ctx.newPage();
}

// ---------------------------------------------------------------- API ----------------------------------------------------------------
const qs = (o: Record<string, any>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
  // Khảo sát 07/11: giao diện mới gửi mảng dạng lặp khoá (campaignIds=a&campaignIds=b).
  .flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map(x => `${k}=${encodeURIComponent(String(x))}`)).join('&');
export const url = (res: string, q: Record<string, any> = {}) => `dti/${res}${Object.keys(q).length ? '?' + qs(q) : ''}`;
export const get = (res: string, q: Record<string, any> = {}, as = 'lanhdaobo') => api('GET', url(res, q), undefined, acc(as));
/** Lấy data; lỗi HTTP thì ném lỗi rõ ràng (để test fail đúng chỗ, không fail mơ hồ ở bước sau). */
export async function data(res: string, q: Record<string, any> = {}, as = 'lanhdaobo') {
  as = acc(as);
  const r = await get(res, q, as);
  test.skip(r.status === 401, `Session auth/${as}.json hết hạn (401) — đăng nhập lại: node save-session.mjs ${as}`);
  if (r.status !== 200) throw new Error(`GET ${url(res, q)} (${as}) → ${r.status} ${r.message}`);
  return r.data;
}
/** Gọi không token hoặc token tùy ý. */
export async function rawGet(res: string, token?: string) {
  const r = await fetch(`${API_BASE}/api/v1/${res}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: r.status, text: await r.text() };
}
export const FAKE = '00000000-0000-4000-8000-000000000000';
export const WIDE = { fromDate: '2020-01-01T00:00:00', toDate: '2030-12-31T23:59:59' };
export const TYPES = ['Month', 'Quarter', 'Year'] as const;

// Dashboard đơn vị
/** Khảo sát 07/11: API danh sách kỳ (unit/trend/ranking/compare periods) trả phân trang {periods:{content,totalPages}}
 *  → gom đủ mọi trang, trả về dạng cũ {..., periods: []} để các case không phải đổi. */
export async function periodsAll(res: string, q: Record<string, any>, as: string) {
  const first = await data(res, { ...q, page: 1, size: 100 }, as); const pg = first?.periods;
  if (Array.isArray(pg) || !pg) return { ...first, periods: pg ?? [] };
  const out = [...(pg.content ?? [])];
  for (let i = 2; i <= (pg.totalPages ?? 1); i++) out.push(...((await data(res, { ...q, page: i, size: 100 }, as)).periods?.content ?? []));
  return { ...first, periods: out, total: pg.totalElements ?? out.length };
}
/** API trend/pairs, compare/pairs đã bị gỡ (404). Tự suy cặp Bộ chỉ số - Thang từ danh sách kỳ (giao diện mới cũng lọc kỳ theo cặp của kỳ mặc định). */
export function pairsOf(periods: any[], def?: { indicatorSetId?: string; scaleId?: string }) {
  const m = new Map<string, any>();
  for (const p of periods) { const k = `${p.indicatorSetId}|${p.scaleId}`; if (p.indicatorSetId && !m.has(k)) m.set(k, { indicatorSetId: p.indicatorSetId, indicatorSetName: p.indicatorSetName, scaleId: p.scaleId, scaleName: p.scaleName }); }
  const pairs = [...m.values()]; const d = pairs.find(x => x.indicatorSetId === def?.indicatorSetId && x.scaleId === def?.scaleId) ?? pairs[0];
  return { pairs, defaultIndicatorSetId: d?.indicatorSetId, defaultScaleId: d?.scaleId };
}
export const U = {
  /** Giao diện mới mở theo dashboard/unit/latest (kỳ gần nhất của đơn vị); unit/defaults cũ vẫn tồn tại nhưng UI không dùng. */
  /** unit/latest bỏ qua organizationId → khi chỉ định đơn vị thì dùng unit/defaults?organizationId (kỳ gần nhất của đơn vị đó). */
  defaults: (as: string, organizationId?: string) => organizationId ? data('dashboard/unit/defaults', { organizationId }, as) : data('dashboard/unit/latest', {}, as),
  olddefaults: (as: string, organizationId?: string) => data('dashboard/unit/defaults', { organizationId }, as),
  orgs: (as: string, keyword?: string) => data('dashboard/unit/organizations', { keyword }, as),
  periods: (as: string, q: Record<string, any>) => periodsAll('dashboard/unit/periods', q, as),
  unit: (as: string, organizationId: string, campaignId: string) => data('dashboard/unit', { organizationId, campaignId }, as),
  tdefaults: (as: string, organizationId?: string) => data('dashboard/trend/defaults', { organizationId }, as),
  torgs: (as: string) => data('dashboard/trend/organizations', {}, as),
  pairs: async (as: string, q: Record<string, any>) => pairsOf((await periodsAll('dashboard/unit/periods', { ...q, indicatorSetId: undefined, scaleId: undefined }, as)).periods, await data('dashboard/trend/defaults', { organizationId: q.organizationId }, as).catch(() => undefined)),
  tperiods: (as: string, q: Record<string, any>) => periodsAll('dashboard/trend/periods', { ...q, campaignIds: undefined }, as),
  trend: (as: string, q: Record<string, any>) => data('dashboard/trend', q, as),
};
/** Mọi kỳ được giao cho đơn vị (quét rộng mọi chu kỳ + Đột xuất). */
export async function allPeriods(as: string, organizationId: string) {
  const out: any[] = []; const seen = new Set<string>();
  for (const periodType of TYPES) for (const p of (await U.periods(as, { organizationId, form: 'Periodic', periodType, ...WIDE })).periods ?? [])
    if (!seen.has(p.campaignId)) { seen.add(p.campaignId); out.push(p); }
  for (const p of (await U.periods(as, { organizationId, form: 'AdHoc' })).periods ?? []) if (!seen.has(p.campaignId)) { seen.add(p.campaignId); out.push(p); }
  return out;
}
/** Ngữ cảnh mặc định tab Kết quả kỳ của tài khoản: defaults + danh sách kỳ + kết quả kỳ mặc định. */
export async function unitCtx(as: string, organizationId?: string) {
  const def = await U.defaults(as, organizationId);
  // Dialog chọn kỳ mới liệt kê mọi kỳ của đơn vị (không còn khung Xem theo/Từ–Đến mặc định).
  const q = { organizationId: def.organization?.id };
  const periods = (await U.periods(as, q)).periods ?? [];
  const res = def.campaignId ? await U.unit(as, def.organization.id, def.campaignId) : null;
  return { def, q, periods, res };
}
/** Kỳ có kết quả gần nhất của đơn vị (để test số liệu khi kỳ mặc định chưa gửi). */
export async function withResult(as: string, organizationId?: string, pred: (p: any) => boolean = p => p.hasResult) {
  const def = await U.defaults(as, organizationId); const org = def.organization.id;
  const p = (await allPeriods(as, org)).filter(pred).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0];
  return p ? { org, period: p, res: await U.unit(as, org, p.campaignId) } : null;
}
// Bảng xếp hạng
export const R = {
  defaults: (as = 'lanhdaobo') => data('ranking/defaults', {}, as),
  periods: (as: string, q: Record<string, any>) => periodsAll('ranking/periods', q, as),
  get: (as: string, campaignId: string, group = 'All', page = 1, size = 20) => data('ranking', { page, size, filter: JSON.stringify({ campaignId, group }) }, as),
};
export async function rankAll(as: string, campaignId: string, group = 'All') {
  const first = await R.get(as, campaignId, group, 1, 100); const rows = [...(first.table?.content ?? [])];
  for (let p = 2; p <= (first.table?.totalPages ?? 1); p++) rows.push(...((await R.get(as, campaignId, group, p, 100)).table?.content ?? []));
  return { ...first, rows };
}
// So sánh đơn vị
export const C = {
  defaults: (as = 'lanhdaobo') => data('compare/defaults', {}, as),
  periods: (as: string, q: Record<string, any>) => periodsAll('compare/periods', q, as),
  pairs: async (as: string, q: Record<string, any>) => pairsOf((await periodsAll('compare/periods', { ...q, indicatorSetId: undefined, scaleId: undefined }, as)).periods, await data('compare/defaults', {}, as).catch(() => undefined)),
  orgs: (as: string, q: Record<string, any>) => data('compare/organizations', q, as),
  criteria: (as: string, campaignId: string) => data('compare/criteria', { campaignId }, as),
  detail: (as: string, campaignId: string, organizationIds: string[], criteria: string[]) => data('compare/detail', { campaignId, organizationIds, criteria }, as),
  trend: (as: string, q: Record<string, any>) => data('compare/trend', q, as),
};
/** Khoá chỉ tiêu gửi API: 'Điểm xếp hạng' có key=null, dùng code 'ranking'. */
export const ck = (c: any) => c?.key ?? c?.code;
/** Ngữ cảnh mặc định tab So sánh chi tiết: kỳ, đơn vị mặc định, chỉ tiêu mặc định, dữ liệu detail. */
export async function compareCtx(as = 'lanhdaobo', campaignId?: string) {
  const def = await C.defaults(as); const cid = campaignId ?? def.campaignId;
  const orgs = await C.orgs(as, { campaignIds: [cid], submittedOnly: true, defaultCampaignId: cid });
  const crit = await C.criteria(as, cid); const critDef = (crit.criteria ?? []).filter((c: any) => c.isDefault).map(ck);
  const ids = orgs.defaultOrganizationIds ?? [];
  const detail = ids.length >= 2 && critDef.length ? await C.detail(as, cid, ids, critDef) : null;
  return { def, cid, orgs, crit, critDef, ids, detail };
}

// ---------------------------------------------------------------- tính toán ----------------------------------------------------------------
/** Làm tròn half-up d chữ số, định dạng kiểu Việt Nam (dấu phẩy). */
export const round = (x: number, d = 2) => { const f = 10 ** d; return Math.round((x + Number.EPSILON) * f) / f; };
/** Số nguyên định dạng vi-VN (1.000). */
export const int = (x: number) => Number(x).toLocaleString('vi-VN');
export const vn = (x: number, d = 2) => round(x, d).toFixed(d).replace('.', ',');
export const pct = (x: number, d = 2) => `${vn(x, d)}%`;
export const walk = (nodes: any[], f: (n: any, depth: number) => void, depth = 0) => { for (const n of nodes ?? []) { f(n, depth); walk(n.children, f, depth + 1); } };
export const flat = (nodes: any[]) => { const o: any[] = []; walk(nodes, n => o.push(n)); return o; };
/** Hạng chuẩn SRS: giảm dần trên giá trị làm tròn 2 chữ số, đồng giá trị đồng hạng, bỏ bậc. */
export const ranks = (vals: number[]) => vals.map(v => 1 + vals.filter(w => round(w) > round(v)).length);
export const levelOf = (score: number, levels: any[]) => levels.filter(l => round(score) >= l.fromPercent).sort((a, b) => b.fromPercent - a.fromPercent)[0];

// ---------------------------------------------------------------- UI ----------------------------------------------------------------
// Khảo sát 07/11: URL bỏ hash; Dashboard đơn vị chuyển về /vi/dashboard (/vi/dashboard-demo giờ là trang 404).
export const ROUTE = { dashboard: '/vi/dashboard', ranking: '/vi/reports/ranking', compare: '/vi/reports/compare' };
export const settle = async (p: Page, ms = 800) => { await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(ms); };
export async function open(p: Page, r: keyof typeof ROUTE) { await p.goto(ROUTE[r]); await settle(p, 1200); }
export const body = async (p: Page) => (await p.locator('main, body').first().innerText()).replace(/\s+/g, ' ');
/** Tab antd hoặc Segmented (So sánh đơn vị dùng Segmented: So sánh chi tiết | So sánh qua các kỳ). */
export const tab = (p: Page, name: RegExp | string) => p.getByRole('tab', { name }).or(p.locator('.ant-segmented-item', { hasText: name })).first();
export async function clickTab(p: Page, name: RegExp | string) { await tab(p, name).click(); await settle(p); }
/** Ô chọn (antd Select) theo nhãn: ưu tiên aria-label, sau đó ô gần nhãn chữ. */
export function field(p: Page, label: string) {
  // antd v6: input combobox nằm dưới lớp hiển thị giá trị → click vào khung .ant-select bao ngoài.
  const byAria = p.getByRole('combobox', { name: label }).locator('xpath=ancestor::*[contains(concat(" ",@class," ")," ant-select ")][1]');
  const near = p.getByText(label, { exact: true }).first().locator('xpath=ancestor::*[.//*[contains(@class,"ant-select")]][1]').locator('.ant-select').first();
  return byAria.or(near).first();
}
/** Nút chọn kỳ mới (mở dialog "Chọn kỳ đánh giá"), thay cho Select 'Kỳ' + 'Hình thức' + 'Xem theo' + khoảng ngày. */
export const periodBtn = (p: Page) => p.locator('button[aria-haspopup="dialog"]').filter({ hasText: /Kỳ đánh giá/ }).first();
const PERIOD_LABELS = /^(Kỳ|Kỳ đánh giá)$/;
export const fieldValue = async (p: Page, label: string) => {
  if (PERIOD_LABELS.test(label)) return ((await periodBtn(p).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').replace(/^Kỳ đánh giá\s*/, '').trim();
  return ((await field(p, label).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
};
/** Mở dialog chọn kỳ; trả về locator dialog. */
export async function openPeriodDialog(p: Page) { await periodBtn(p).click(); const d = p.getByRole('dialog').last(); await d.waitFor(); await settle(p, 500); return d; }
/** Dòng kỳ (bỏ dòng đo antd) trong dialog. */
export const periodRows = (d: Locator) => d.locator('tbody tr.ant-table-row');
/** Chọn kỳ qua dialog: tìm theo mã/tên rồi tick radio dòng khớp, bấm Lưu. */
export async function pickPeriod(p: Page, period: { code?: string; campaignName?: string; name?: string }) {
  const d = await openPeriodDialog(p); const key = period.code ?? period.campaignName ?? period.name ?? '';
  await d.getByPlaceholder(/Tìm theo mã, tên kỳ/).fill(key); await settle(p, 900);
  let row = periodRows(d).filter({ hasText: key }); if (period.code && (period.campaignName ?? period.name)) row = row.filter({ hasText: (period.campaignName ?? period.name)! }); row = row.first(); await row.locator('.ant-radio-wrapper, .ant-radio, input[type=radio]').first().click();
  const save = d.getByRole('button', { name: /^Lưu$/ }); if (await save.isEnabled()) await save.click(); else await d.getByRole('button', { name: /Hu[ỷủy]/ }).click();
  await settle(p);
}
/** Lọc trong dialog chọn kỳ: Hình thức (Tất cả hình thức | Định kỳ | Đột xuất). */
export async function dialogForm(p: Page, d: Locator, text: string) {
  await d.locator('.ant-select').first().click();
  await p.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: text }).first().click(); await settle(p, 800);
}
/** Mục chọn của Select thường và TreeSelect (ô Đơn vị của Dashboard là cây đơn vị). */
const OPT = '.ant-select-item-option, .ant-select-tree-node-content-wrapper';
export async function pick(p: Page, label: string, option: string | RegExp) {
  await field(p, label).click();
  const dd = p.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.locator(OPT, { hasText: option }).first().click(); await settle(p);
}
export async function options(p: Page, label: string) {
  await field(p, label).click();
  const dd = p.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last(); await dd.waitFor();
  const t = (await dd.locator(OPT).allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
  await p.keyboard.press('Escape'); return t;
}
export const visibleLabel = async (p: Page, label: string) => (await p.getByText(label, { exact: true }).filter({ visible: true }).count()) > 0;
/** Nhập khoảng ngày (antd RangePicker) dạng dd/mm/yyyy. */
export async function setRange(p: Page, from: string, to: string) {
  const ins = p.locator('.ant-picker-range input');
  await ins.nth(0).click(); await ins.nth(0).fill(from); await ins.nth(0).press('Enter');
  await ins.nth(1).fill(to); await ins.nth(1).press('Enter'); await settle(p);
}
export const dmy = (iso: string) => String(iso).slice(0, 10).split('-').reverse().join('/');
/** Ghi lại các request API dti/... phát sinh sau thời điểm gọi. */
export function track(p: Page) {
  const reqs: string[] = []; p.on('request', r => { if (r.url().includes('/api/v1/dti/')) reqs.push(r.url()); });
  return { reqs, since: (n: number) => reqs.slice(n) };
}
export async function download(p: Page, btn = /Xuất Excel/) {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30_000 }), p.getByRole('button', { name: btn }).first().click()]);
  const file = await dl.path(); return { name: dl.suggestedFilename(), file: file!, sheets: xlsxSheets(file!) };
}
export const notices = (p: Page) => p.locator('.ant-message-notice, .ant-notification-notice, .ant-alert, .ant-empty, .ant-form-item-explain-error, [role=alert], [role=status], [data-sonner-toast]');
export const noticeText = async (p: Page) => (await notices(p).allInnerTexts()).join(' | ');

/** Đăng ký test Manual (giữ 1-1 với catalog) và skip kèm lý do. */
export function manual(ids: string[], why: string) { for (const id of ids) test(tc(id), async () => { test.skip(true, `Manual: ${why}`); }); }
/** Bỏ qua khi thiếu dữ liệu điều kiện (không phải lỗi sản phẩm). */
export const need = (ok: any, what: string) => test.skip(!ok, `Thiếu dữ liệu: ${what}`);
export const MSG = {
  noPeriod: /Không có kỳ phù hợp|MSG-021/i, noData: /Chưa có dữ liệu|chưa có kết quả|MSG-022/i, invalidRange: /ngày kết thúc|trước ngày bắt đầu|MSG-017/i,
  min2Period: /tối thiểu 2 kỳ|ít nhất 2 kỳ|MSG-113/i, min2Unit: /ít nhất 2 đơn vị|tối thiểu 2 đơn vị|MSG-114/i, min1Crit: /ít nhất 1 chỉ tiêu|MSG-115/i,
  many: /MSG-116|10 đơn vị|nhiều đơn vị/i, provisional: /Tạm thời|tạm tính|MSG-112|đang diễn ra/i, loadErr: /Không thể tải|MSG-025|lỗi|không phản hồi/i, noExport: /Không có dữ liệu để xuất|MSG-023/i,
};

export const VIEW: Record<string, string> = { Month: 'Tháng', Quarter: 'Quý', Year: 'Năm' };
/** Mở Dashboard đơn vị ở đơn vị + kỳ mặc định theo dashboard/unit/defaults. Khảo sát 03/11: giao diện bỏ qua defaults
 *  (chọn đơn vị đầu danh sách, Xem theo Quý, không có kỳ) → DSH-F02..F05 bắt lỗi này; các case khác chọn lại bộ lọc theo defaults. */
export async function openDash(p: Page, as = 'lanhdaobo', organizationId?: string, campaignId?: string) {
  await open(p, 'dashboard'); const def = await U.defaults(as, organizationId); need(def?.organization, 'tài khoản không có đơn vị mặc định');
  const cid = campaignId ?? def.campaignId; need(cid, 'đơn vị chưa có kỳ');
  if (!(await fieldValue(p, 'Đơn vị')).includes(def.organization.name)) await pick(p, 'Đơn vị', def.organization.name).catch(() => {});
  if (cid === def.campaignId && !campaignId) return def;
  const per = ((await U.periods(as, { organizationId: def.organization.id })).periods ?? []).find((x: any) => x.campaignId === cid);
  if (per) await pickPeriod(p, per); return def;
}
