// PHÂN HỆ B — testcase BỔ SUNG từ bug/góp ý GitLab (testcases/docs/catalog-BUG-B.mjs + SET-V09…V14 trong catalog-BUG.mjs).
// Assert theo kỳ vọng ĐÚNG (exp): test FAIL = lỗi còn tồn tại. Case so design Figma không có giá trị cụ thể / cần BA / cần đổi quyền
// tài khoản dùng chung KHÔNG có test ở đây (xem báo cáo).
// Phiên: chỉ dùng auth/admin.json (UI + API) và lanhdaobo (API từ chối kỳ). Không đăng nhập lại, không dùng superadmin.
// Dữ liệu thử: mọi bản ghi do file này tạo đều có tên chứa tag "qc.automation … <TAG>" → afterAll quét theo TAG và xóa
// (mở khóa trước khi xóa). Kỳ đã trình/duyệt/từ chối không xóa được: CMP-T23 dùng lại kỳ cố định "qc.automation BUGB T23 fixture".
// BCS-333 (SET-V09…V14) chỉ được ĐỌC (mở chi tiết + Xuất Excel).
import { Page, Locator } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect, tc, api, dataRows, dlg, toast, pickOption, code8 } from './common';
import { BASE } from '../helpers';
import { guardSession } from '../session-guard';

test.describe.configure({ timeout: 120_000 });

// ---------------------------------------------------------------- API (luôn bằng phiên admin)
const ADM = 'admin';
const A = (m: string, r: string, b?: any, as = ADM) => api(m, r, b, as);
const F = (o: any) => encodeURIComponent(JSON.stringify(o));
const must = (r: any, w: string) => { if (r.status >= 300) throw new Error(`${w}: HTTP ${r.status} ${r.message}`); return r; };
const PIL = 'dti/pillars', IGR = 'dti/indicator-groups', IND = 'dti/indicators', SETS = 'dti/indicator-sets', SCL = 'dti/score-scales', CAMP = 'dti/self-assessment-campaigns';
const TAG = `QCB${Date.now().toString(36).slice(-5).toUpperCase()}`;   // tag của lần chạy (mỗi worker một tag)
let seq = 0;
const nm = (kind: string) => `qc.automation ${kind} ${TAG}${(++seq).toString(36).toUpperCase()}`;
const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();

async function listKw(res: string, kw: string): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 20; p++) {
    const r = await A('GET', `${res}?page=${p}&size=100&filter=${F({ keyword: kw, fullTextSearch: kw })}`);
    out.push(...(r.data?.content ?? []));
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return out.filter(x => String(x.name ?? '').includes(kw));
}
const lockPil = (id: string) => A('PUT', `${PIL}/${id}/lock`, {});
const lockGrp = (id: string) => A('PUT', `${IGR}/${id}/lock`, {});
const lockInd = (id: string) => A('PUT', `${IND}/${id}/lock`, {});
async function mkPillar(name = nm('Trụ cột')) { return must(await A('POST', PIL, { name, description: 'qc.automation mô tả trụ cột', displayOrder: 0 }), 'tạo trụ cột').data; }
async function mkGroup(pillarId: string, name = nm('Nhóm'), lock = true) {
  const g = must(await A('POST', IGR, { pillarId, name, description: 'qc.automation mô tả nhóm', displayOrder: 0 }), 'tạo nhóm').data;
  if (lock) must(await lockGrp(g.id), 'khóa nhóm'); return g;
}
async function mkInd(groupId: string, pillarId: string, o: { name?: string; parentId?: string; max?: number; lock?: boolean } = {}) {
  const r = must(await A('POST', IND, { indicatorGroupId: groupId, pillarId, parentId: o.parentId, name: o.name ?? nm('Chỉ số'), minScore: 0, maxScore: o.max ?? 5 }), 'tạo chỉ số').data;
  if (o.lock) must(await lockInd(r.id), 'khóa chỉ số'); return r;
}
async function mkSet(extra: any = {}) { return must(await A('POST', SETS, { name: nm('Bộ'), effectiveYear: 2026, ...extra }), 'tạo bộ').data; }
const putSetGroups = (id: string, gids: string[]) => A('PUT', `${SETS}/${id}/groups`, gids.map((g, i) => ({ indicatorGroupId: g, displayOrder: i + 1, isScored: true })));
const putSetInds = (id: string, xs: { id: string; max: number; w?: number }[]) =>
  A('PUT', `${SETS}/${id}/indicators`, xs.map((x, i) => ({ indicatorId: x.id, weight: x.w ?? 1, isScored: true, minScore: 0, maxScore: x.max, displayOrder: i + 1 })));
const getScale = async (id: string) => (await A('GET', `${SCL}/${id}`)).data;
const lvBody = (lv: [string, number][]) => lv.map(([name, to], i) => ({ name, fromPercent: i ? lv[i - 1][1] : 0, toPercent: to }));
async function mkScale(o: { lock?: boolean; levels?: any[] } = {}) {
  const s = must(await A('POST', SCL, { name: nm('Thang'), levels: o.levels ?? lvBody([['Kém', 50], ['Tốt', 100]]) }), 'tạo thang').data;
  if (o.lock) must(await A('POST', `${SCL}/${s.id}/lock?rowVersion=${(await getScale(s.id)).rowVersion}`, {}), 'khóa thang');
  return await getScale(s.id);
}

// ---------------------------------------------------------------- Dữ liệu nền dùng chung (lazy, mỗi worker tạo một lần)
let _fx: Promise<any> | undefined;
/** Trụ cột → nhóm (khóa) → chỉ số cha (khóa) + 2 con 5đ/3đ (khóa); thêm 1 chỉ số Chưa khóa (c3) và 1 Đã khóa (c4) chưa có trong bộ;
 *  bộ chỉ số Chưa khóa chứa nhóm + cha + 2 con. */
const fx = () => (_fx ??= (async () => {
  const p = await mkPillar(); must(await lockPil(p.id), 'khóa trụ cột');
  const g = await mkGroup(p.id);
  const par = await mkInd(g.id, p.id, { name: nm('Chỉ số cha'), max: 10 });
  const c1 = await mkInd(g.id, p.id, { name: nm('Chỉ số con 5đ'), parentId: par.id, max: 5, lock: true });
  const c2 = await mkInd(g.id, p.id, { name: nm('Chỉ số con 3đ'), parentId: par.id, max: 3, lock: true });
  must(await lockInd(par.id), 'khóa chỉ số cha');
  const c3 = await mkInd(g.id, p.id, { name: nm('Chỉ số chưa khóa'), max: 4 });
  const c4 = await mkInd(g.id, p.id, { name: nm('Chỉ số đã khóa'), max: 4, lock: true });
  const s = await mkSet({ description: 'qc.automation mô tả bộ' });
  must(await putSetGroups(s.id, [g.id]), 'ghi nhóm vào bộ');
  must(await putSetInds(s.id, [{ id: par.id, max: 8, w: 0 }, { id: c1.id, max: 5 }, { id: c2.id, max: 3 }]), 'ghi chỉ số vào bộ');
  const get = async (r: string, id: string) => (await A('GET', `${r}/${id}`)).data;
  return { p: await get(PIL, p.id), g: await get(IGR, g.id), par: await get(IND, par.id), c1, c2, c3, c4, s: await get(SETS, s.id) };
})());
let _big: Promise<any> | undefined;
/** Bộ lớn: 9 nhóm (nhóm 1 tên ~320 ký tự), 50 chỉ số (chỉ số 1 tên ~320 ký tự) → cấu trúc > 50 dòng. */
const LONG = ' Tên rất dài để kiểm tra bố cục trang cấu hình'.repeat(8);
const big = () => (_big ??= (async () => {
  const { p } = await fx();
  const groups: { g: any; inds: any[] }[] = [];
  for (let i = 0; i < 9; i++) groups.push({ g: await mkGroup(p.id, i === 0 ? (nm('Nhóm dài') + LONG).slice(0, 320) : nm(`Nhóm ${i}`)), inds: [] });
  for (let k = 0; k < 50; k++) {
    const gi = k < 42 ? 0 : k - 41;
    groups[gi].inds.push(await mkInd(groups[gi].g.id, p.id, { name: k === 0 ? (nm('Chỉ số dài') + LONG).slice(0, 320) : nm(`CS ${k}`), max: 2, lock: true }));
  }
  const s = await mkSet();
  must(await putSetGroups(s.id, groups.map(x => x.g.id)), 'ghi nhóm bộ lớn');
  must(await putSetInds(s.id, groups.flatMap(x => x.inds.map(i => ({ id: i.id, max: 2 })))), 'ghi chỉ số bộ lớn');
  return { s, groups, longGroup: (await A('GET', `${IGR}/${groups[0].g.id}`)).data.name as string, longInd: (await A('GET', `${IND}/${groups[0].inds[0].id}`)).data.name as string };
})());
let _base: Promise<any> | undefined;
/** Dữ liệu nền dùng chung có sẵn (CHỈ ĐỌC / dùng để tạo kỳ Nháp): bộ BCS-001, thang TXL-001, đơn vị QC_DP, QC_BO. */
const base = () => (_base ??= (async () => {
  const find = async (res: string, code: string) => {
    const r = await A('GET', `${res}?page=1&size=50&filter=${F({ keyword: code, fullTextSearch: code })}`);
    const x = (r.data?.content ?? []).find((y: any) => y.code === code); if (!x) throw new Error(`thiếu dữ liệu nền ${res} ${code}`); return x;
  };
  const set = await find(SETS, 'BCS-001'), scale = await find(SCL, 'TXL-001'), dp = await find('organizations', 'QC_DP'), bo = await find('organizations', 'QC_BO');
  return { set, scale, dp, bo };
})());
async function mkCamp(o: { orgs?: string[]; name?: string } = {}) {
  const b = await base();
  const c = must(await A('POST', CAMP, { name: o.name ?? nm('kỳ'), type: 'AdHoc', indicatorSetId: b.set.id, scaleId: b.scale.id, startDate: '2026-11-13T00:00:00', endDate: '2026-11-30T23:59:59' }), 'tạo kỳ').data;
  if (o.orgs?.length) must(await A('PUT', `${CAMP}/${c.id}/organizations`, o.orgs), 'phân công');
  return (await A('GET', `${CAMP}/${c.id}`)).data;
}
const getCamp = async (id: string) => (await A('GET', `${CAMP}/${id}`)).data;
const orgCount = async (id: string) => ((await getCamp(id)).organizations ?? []).length;

// ---------------------------------------------------------------- Dọn dữ liệu (quét theo TAG)
const leftovers: string[] = [];
test.afterAll(async ({}, ti) => {
  ti.setTimeout(600_000);
  for (const c of await listKw(CAMP, TAG)) { const r = await A('DELETE', `${CAMP}/${c.id}`); if (r.status >= 300) leftovers.push(`kỳ ${c.name} (${c.status})`); }
  for (const s of await listKw(SETS, TAG)) { if (s.status === 'Locked') await A('POST', `${SETS}/${s.id}/unlock`, {}); const r = await A('DELETE', `${SETS}/${s.id}`); if (r.status >= 300) leftovers.push(`bộ ${s.code} ${s.name}: ${r.message}`); }
  for (const s of await listKw(SCL, TAG)) {
    const g = await getScale(s.id); if (g?.isLocked) await A('POST', `${SCL}/${s.id}/unlock?rowVersion=${g.rowVersion}`, {});
    const r = await A('DELETE', `${SCL}/${s.id}`); if (r.status >= 300) leftovers.push(`thang ${s.code} ${s.name}: ${r.message}`);
  }
  const inds = await listKw(IND, TAG);
  inds.sort((a, b) => Number(!!b.parentId) - Number(!!a.parentId));   // con trước, cha sau
  for (const x of inds) { if (x.isLocked) await A('PUT', `${IND}/${x.id}/unlock`, {}); }
  for (const x of inds) { const r = await A('DELETE', `${IND}/${x.id}`); if (r.status >= 300) leftovers.push(`chỉ số ${x.code}: ${r.message}`); }
  for (const x of await listKw(IGR, TAG)) { if (x.isLocked) await A('PUT', `${IGR}/${x.id}/unlock`, {}); const r = await A('DELETE', `${IGR}/${x.id}`); if (r.status >= 300) leftovers.push(`nhóm ${x.code}: ${r.message}`); }
  for (const x of await listKw(PIL, TAG)) { if (x.isLocked) await A('PUT', `${PIL}/${x.id}/unlock`, {}); const r = await A('DELETE', `${PIL}/${x.id}`); if (r.status >= 300) leftovers.push(`trụ cột ${x.code}: ${r.message}`); }
  if (leftovers.length) console.log(`[bug-gitlab B] dữ liệu không xóa được (tag ${TAG}):\n  ` + leftovers.join('\n  '));
});

// ---------------------------------------------------------------- Helper UI
const C = (p: Page) => p.locator('.ant-layout-content').first();
const ctext = async (p: Page) => norm(await C(p).innerText());
async function go(page: Page, route: string) {
  await page.goto(`${BASE}/vi/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
}
async function goDetail(page: Page, route: string, ready: string | RegExp) {
  await go(page, route);
  if (!(await C(page).getByText(ready).first().isVisible().catch(() => false))) { await page.reload({ waitUntil: 'networkidle' }); }
  await C(page).getByText(ready).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
}
const btn = (scope: Page | Locator, re: RegExp) => scope.locator('button').filter({ hasText: re }).filter({ visible: true });
/** font-weight của nút văn bản đầu tiên (không rỗng) trong phần tử. */
const textWeight = (l: Locator) => l.evaluate(e => {
  const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.textContent ?? '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
  const n = w.nextNode(); return getComputedStyle((n?.parentElement ?? e) as Element).fontWeight;
});
/** innerText nếu phần tử đang có, không thì '' (tránh chờ vô hạn). */
const textIf = async (l: Locator) => ((await l.count()) ? await l.innerText({ timeout: 5000 }).catch(() => '') : '');
const modal = (p: Page) => p.locator('.ant-modal').filter({ visible: true }).last();
async function searchList(page: Page, ph: RegExp, kw: string) { await page.getByPlaceholder(ph).first().fill(kw); await page.waitForTimeout(1800); }

// ---------------------------------------------------------------- Đọc .xlsx (unzip + XML, không cần thư viện)
type Cell = { v: string; t: string; fmt: string };
function readXlsx(file: string, sheet = 1): Record<string, Cell> {
  const x = (p: string) => { try { return execFileSync('unzip', ['-p', file, p]).toString(); } catch { return ''; } };
  const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const sst = [...x('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const styles = x('xl/styles.xml');
  const fmts: Record<string, string> = { '0': 'General' };
  for (const m of styles.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)) fmts[m[1]] = dec(m[2]);
  const xfs = [...(styles.match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] ?? '').matchAll(/<xf\b([^>]*)/g)].map(m => m[1].match(/numFmtId="(\d+)"/)?.[1] ?? '0');
  const out: Record<string, Cell> = {};
  for (const m of x(`xl/worksheets/sheet${sheet}.xml`).matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[2], body = m[3] ?? '';
    const t = attrs.match(/\bt="(\w+)"/)?.[1] ?? 'n', s = attrs.match(/\bs="(\d+)"/)?.[1] ?? '0';
    let v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
    if (t === 's') v = sst[Number(v)] ?? ''; else v = dec(v);
    out[m[1]] = { v, t: body ? t : '', fmt: fmts[xfs[Number(s)] ?? '0'] ?? `#${xfs[Number(s)]}` };
  }
  return out;
}
/** Giá trị Excel HIỂN THỊ (đủ cho định dạng General / 0 / 0.0 / #,##0.0 …). */
function shown(c?: Cell): string {
  if (!c || c.v === '') return '';
  if (c.t !== 'n') return c.v;
  const dec = c.fmt.match(/0\.(0+)/)?.[1].length ?? 0;
  return dec ? Number(c.v).toFixed(dec) : String(Number(c.v));
}
const rowsOf = (cells: Record<string, Cell>) => {
  const rows: Record<number, Record<string, Cell>> = {};
  for (const [ref, c] of Object.entries(cells)) { const m = ref.match(/^([A-Z]+)(\d+)$/)!; (rows[Number(m[2])] ??= {})[m[1]] = c; }
  return rows;
};
async function download(page: Page, click: () => Promise<any>, name: string) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), click()]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcb-dl-'));
  const f = path.join(dir, name); await dl.saveAs(f); return { file: f, suggested: dl.suggestedFilename() };
}

// ====================================================================== TRỤ CỘT
guardSession(test);

// ====================================================================== NHÓM CHỈ SỐ

// ====================================================================== CHỈ SỐ

// ====================================================================== BỘ CHỈ SỐ
const openSetDetail = (page: Page, id: string) => goDetail(page, `indicator-sets/${id}`, 'Cấu trúc bộ chỉ số');
const openBuilder = async (page: Page, id: string) => { await goDetail(page, `indicator-sets/${id}/builder`, 'Cấu hình bộ chỉ số'); await page.waitForTimeout(800); };
const structSearch = (page: Page) => C(page).getByPlaceholder(/tìm trụ cột, nhóm chỉ số, chỉ số/i);

// ====================================================================== BỘ CHỈ SỐ — Xuất Excel chi tiết BCS-333 (catalog-BUG.mjs, #289) — CHỈ ĐỌC
const B333 = '2c5306e7-4c6c-46ed-b526-88ffbc4b3dad';
let _x333: Promise<any> | undefined;
async function x333(page: Page) {
  return (_x333 ??= (async () => {
    await openSetDetail(page, B333);
    const t = await ctext(page);
    expect(t, 'đúng bộ BCS-333').toContain('BCS-333');
    const screen = (await C(page).locator('tbody tr.ant-table-row').evaluateAll(rs => rs.map(r => [...r.querySelectorAll('td')].map(td => (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim()))));
    const updated = t.match(/Cập nhật lần cuối\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/)?.[1] ?? '';
    const { file } = await download(page, () => btn(C(page), /xuất excel/i).first().click(), 'bcs-333.xlsx');
    const cells = readXlsx(file); const rows = rowsOf(cells);
    const info: Record<string, Cell> = {};
    for (const r of Object.values(rows)) if (r.A && r.B && !r.C?.v) info[r.A.v] = r.B;
    const hr = Number(Object.entries(rows).find(([, r]) => Object.values(r).some(c => c.v === 'Điểm tối đa'))?.[0] ?? 0);
    const head = Object.fromEntries(Object.entries(rows[hr] ?? {}).map(([col, c]) => [c.v, col]));
    const data: Record<string, Cell>[] = [];
    for (let i = hr + 1; rows[i]; i++) data.push(rows[i]);
    return { screen, updated, info, head, data };
  })());
}
const NONE = (s: string) => (/^[–—-]?$/.test((s ?? '').trim()) ? '' : s.trim());

// ====================================================================== THANG XẾP LOẠI
const lvRows = (p: Page) => C(p).locator('tbody tr.ant-table-row');

// ====================================================================== QUẢN LÝ TỰ ĐÁNH GIÁ
const CR = 'self-assessment-campaigns';
const openCampDetail = (page: Page, id: string) => goDetail(page, `${CR}/${id}`, 'Mã kỳ');
async function unitsTab(page: Page, id: string) {
  await openCampDetail(page, id);
  await btn(C(page), /^\s*Đơn vị tham gia\s*$/).first().click(); await page.waitForTimeout(1800);
}
/** Tiêu đề cột của bảng Đơn vị tham gia (tab Chi tiết bị ẩn vẫn còn bảng trong DOM). */
const unitHeads = async (page: Page) => (await C(page).locator('table').filter({ has: page.locator('th', { hasText: /^Mã đơn vị$/ }) }).first().locator('thead th').allInnerTexts()).map(norm);
async function openAddCamp(page: Page) {
  await go(page, CR);
  await btn(page, /^\s*Thêm tự đánh giá\s*$/).first().click();
  const d = dlg(page); await d.waitFor(); await page.waitForTimeout(600); return d;
}
const fItem = (page: Page, d: Locator, re: RegExp) => d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: re }) });
async function selIn(page: Page, d: Locator, label: RegExp, opt: string, typed?: string) {
  await fItem(page, d, label).locator('.ant-select').first().click();
  if (typed) { await page.keyboard.type(typed); }
  await page.waitForTimeout(1000);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option', { hasText: opt }).first().click();
  await page.waitForTimeout(400);
}
async function setDate(page: Page, d: Locator, label: RegExp, v: string) {
  const i = fItem(page, d, label).locator('input').first(); await i.click(); await i.fill(v); await i.press('Enter'); await page.waitForTimeout(300);
}
async function fillCamp(page: Page, d: Locator, o: { name: string; type: 'Định kỳ' | 'Đột xuất'; period?: string; units: string[] }) {
  const b = await base();
  await d.getByPlaceholder(/nhập tên đánh giá/i).fill(o.name);
  await selIn(page, d, /^Loại kỳ$/, o.type);
  if (o.type === 'Định kỳ') await selIn(page, d, /^Kỳ$/, o.period ?? 'Quý');
  else { await setDate(page, d, /^Ngày bắt đầu$/, '13/11/2026'); await setDate(page, d, /^Ngày kết thúc$/, '30/11/2026'); }
  await selIn(page, d, /^Bộ chỉ số áp dụng$/, b.set.name, '001');
  await selIn(page, d, /^Thang xếp loại$/, 'TXL-001');
  for (const u of o.units) { await selIn(page, d, /^Đơn vị tham gia$/, u, u); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
}
async function saveCamp(page: Page, d: Locator) {
  await btn(d, /^\s*Lưu\s*$/).last().click();
  const t: string[] = [];
  for (let i = 0; i < 10; i++) { t.push(...await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()); await page.waitForTimeout(300); }
  return norm([...new Set(t)].join(' | '));
}

test.describe('Bug GitLab B › Quản lý tự đánh giá', () => {
  test(tc('CMP-L35'), async ({ page }) => {
    await go(page, CR);
    for (const tab of ['Định kỳ', 'Đột xuất']) {
      await page.getByRole('tab', { name: tab }).first().click(); await page.waitForTimeout(1500);
      const heads = (await C(page).locator('thead th').allInnerTexts()).map(norm).filter(Boolean);
      expect.soft(heads, `tab ${tab}: còn cột Loại`).not.toContain('Loại');
    }
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('CMP-L36'), async ({ page }) => {
    const style = (l: Locator) => l.evaluate(b => { const s = getComputedStyle(b); return { bg: s.backgroundColor, border: s.borderColor, color: s.color, icon: b.querySelector('[data-icon], svg')?.getAttribute('data-icon') ?? (b.querySelector('svg') ? 'svg' : '') }; });
    await go(page, CR);
    const cmp = await style(btn(C(page), /xuất excel/i).first());
    const { s } = await fx(); await openSetDetail(page, s.id);
    const set = await style(btn(C(page), /xuất excel/i).first());
    expect(cmp, 'nút Xuất Excel Quản lý tự đánh giá vs Bộ chỉ số').toEqual(set);
  });
  test(tc('CMP-C43'), async ({ page }) => {
    const d = await openAddCamp(page);
    const labels = (await d.locator('button').allInnerTexts()).map(norm).filter(Boolean);
    expect(labels.some(t => /^Hu[ỷủy]$/i.test(t)), `có nút Hủy (${labels})`).toBe(true);
    expect(labels.some(t => /quay lại/i.test(t)), 'không có nút Quay lại').toBe(false);
  });
  test(tc('CMP-C44'), async ({ page }) => {
    const b = await base();
    const d = await openAddCamp(page);
    await fItem(page, d, /^Bộ chỉ số áp dụng$/).locator('.ant-select').first().click(); await page.waitForTimeout(1200);
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    const before = await dd.locator('.ant-select-item-option').count();
    await page.keyboard.type('BỘ CHỈ SỐ 0'); await page.waitForTimeout(1200);
    const after = (await dd.locator('.ant-select-item-option').allInnerTexts()).map(norm);
    expect(after.length, 'có kết quả tìm').toBeGreaterThan(0);
    for (const o of after) expect.soft(o.toLowerCase(), 'kết quả khớp từ khóa').toContain('bộ chỉ số 0');
    expect.soft(after.length, `danh sách được lọc (trước ${before})`).toBeLessThanOrEqual(before);
    await dd.locator('.ant-select-item-option', { hasText: b.set.name }).first().click(); await page.waitForTimeout(400);
    expect(norm(await fItem(page, d, /^Bộ chỉ số áp dụng$/).innerText())).toContain(b.set.name);
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('CMP-C46'), async ({ page }) => {
    const b = await base(); const name = nm('kỳ UI thang');
    const d = await openAddCamp(page);
    await fillCamp(page, d, { name, type: 'Đột xuất', units: [b.dp.name] });
    const msg = await saveCamp(page, d);
    expect(msg, 'không báo "Thang xếp loại không hợp lệ"').not.toMatch(/thang xếp loại không hợp lệ/i);
    expect(msg, 'thông báo thêm thành công').toMatch(/thành công/i);
    const c = (await listKw(CAMP, name))[0];
    expect(c, 'kỳ đã được tạo').toBeTruthy();
    const g = await getCamp(c.id);
    expect([g.status, g.scaleId]).toEqual(['Draft', b.scale.id]);
    await openCampDetail(page, c.id);
    expect(await ctext(page)).toContain(b.scale.name);
  });
  test(tc('CMP-C47'), async ({ page }) => {
    const b = await base(); const name = nm('kỳ UI định kỳ quý');
    const d = await openAddCamp(page);
    await fillCamp(page, d, { name, type: 'Định kỳ', period: 'Quý', units: [b.dp.name] });
    const msg = await saveCamp(page, d);
    expect(msg, 'thêm kỳ Định kỳ').toMatch(/thành công/i);
    expect(msg).not.toMatch(/400|lỗi/i);
    const c = (await listKw(CAMP, name))[0];
    expect(c, 'kỳ đã được tạo').toBeTruthy();
    const g = await getCamp(c.id);
    expect([g.type, g.periodType]).toEqual(['Periodic', 'Quarter']);
    await go(page, CR); await page.getByRole('tab', { name: 'Định kỳ' }).first().click(); await page.waitForTimeout(1200);
    await searchList(page, /tìm theo mã, tên đánh giá/i, name);
    const row = norm(await dataRows(page).filter({ hasText: name }).first().innerText());
    expect(row, 'kỳ ở tab Định kỳ, hiển thị quý').toMatch(/quý|Q[1-4]/i);
  });
  test(tc('CMP-E23'), async ({ page }) => {
    const b = await base(); const name = nm('kỳ UI 2 đơn vị');
    const d = await openAddCamp(page);
    await fillCamp(page, d, { name, type: 'Đột xuất', units: [b.dp.name, b.bo.name] });
    expect(await saveCamp(page, d)).toMatch(/thành công/i);
    const c = (await listKw(CAMP, name))[0]; expect(c).toBeTruthy();
    expect(await orgCount(c.id), 'sau khi thêm có 2 đơn vị').toBe(2);
    await openCampDetail(page, c.id);
    await btn(C(page), /^\s*Cập nhật\s*$/).first().click();
    const e = dlg(page); await e.waitFor(); await page.waitForTimeout(1200);
    const unitsShown = norm(await fItem(page, e, /^Đơn vị tham gia$/).innerText());
    expect.soft(unitsShown, 'popup hiển thị đơn vị hiện tại').toContain(b.dp.name);
    expect.soft(unitsShown).toContain(b.bo.name);
    const msg = await saveCamp(page, e);
    expect.soft(msg, 'lưu không đổi gì').toMatch(/thành công/i);
    expect.soft(await orgCount(c.id), 'sau khi Lưu vẫn còn 2 đơn vị tham gia').toBe(2);
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('CMP-V19'), async ({ page }) => {
    const c = await mkCamp();
    await openCampDetail(page, c.id);
    const first = await btn(C(page), /^\s*Trình phê duyệt\s*$/).first().evaluate(b => { const n = [...b.childNodes].find(x => x.nodeType === 1 || (x.textContent ?? '').trim()); return n?.nodeType === 1 ? ((n as Element).tagName.toLowerCase() === 'svg' || !!(n as Element).querySelector('svg') ? 'icon' : (n as Element).tagName) : 'text'; });
    expect(first, 'icon đứng trước text "Trình phê duyệt"').toBe('icon');
  });
  test(tc('CMP-V20'), async ({ page }) => {
    // Phần chắc chắn: đơn vị đã chấm hiển thị "điểm / điểm tối đa". Hiển thị khi chưa chấm — cần BA (không kiểm). Kỳ có sẵn — chỉ đọc.
    const r = await A('GET', 'dti/assessment-results?page=1&size=200');
    const x = (r.data?.content ?? []).find((y: any) => y.score != null && y.maxScore);
    expect(x, 'cần một kết quả đã có điểm').toBeTruthy();
    await unitsTab(page, x.campaignId);
    const row = dataRows(page).filter({ hasText: x.organizationName }).first();
    await row.waitFor({ timeout: 10_000 });
    const heads = await unitHeads(page);
    const cells = (await row.locator('td').allInnerTexts()).map(norm);
    const v = cells[heads.findIndex(h => h === 'Điểm')] ?? '';
    expect(v, `cột Điểm của ${x.organizationName} (điểm ${x.score}/${x.maxScore})`).toMatch(/^\d+([.,]\d+)?\s*\/\s*\d+([.,]\d+)?$/);
  });
  test(tc('CMP-U31'), async ({ page }) => {
    const b = await base(); const c = await mkCamp();
    await unitsTab(page, c.id);
    await btn(C(page), /^\s*Thêm đơn vị\s*$/).first().click();
    const d = dlg(page); await d.waitFor(); await d.locator('tbody tr.ant-table-row').first().waitFor({ timeout: 15_000 }); await page.waitForTimeout(600);
    let status = 0;
    page.on('response', r => { if (r.url().includes(`${CAMP}/${c.id}/organizations`) && r.request().method() !== 'GET') status = r.status(); });
    for (const u of [b.dp, b.bo]) {
      await d.getByPlaceholder(/tìm/i).first().fill(u.code); await page.waitForTimeout(1500);
      await d.locator('tbody tr.ant-table-row').filter({ hasText: u.code }).first().locator('input[type=checkbox]').check();
    }
    await btn(d, /^\s*(Lưu|Thêm)\s*$/).last().click();
    const msg = await toast(page); await page.waitForTimeout(1500);
    expect.soft(msg, 'thông báo thành công').toMatch(/thành công/i);
    expect.soft(status === 0 || status < 300, `API phân công HTTP ${status}`).toBe(true);
    expect.soft(await orgCount(c.id), 'kỳ có 2 đơn vị').toBe(2);
    const t = await ctext(page);
    expect.soft(t).toContain(b.dp.code); expect.soft(t).toContain(b.bo.code);
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('CMP-U32'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp.id, b.bo.id] });
    await unitsTab(page, c.id);
    await dataRows(page).filter({ hasText: b.bo.code }).first().getByRole('button', { name: /^\s*Xo[áa]\s*$/ }).click();
    const box = modal(page); await box.waitFor({ timeout: 5000 });
    await btn(box, /^\s*(Xo[áa]|Có|Xác nhận|Đồng ý)\s*$/).last().click(); await page.waitForTimeout(2000);
    expect(norm(await C(page).locator('tbody').last().innerText()), 'đơn vị bị xóa không còn').not.toContain(b.bo.code);
    expect(await ctext(page), 'đơn vị khác giữ nguyên').toContain(b.dp.code);
    const now = ((await getCamp(c.id)).organizations ?? []).map((o: any) => o.organizationId);
    expect(now).toEqual([b.dp.id]);
  });
  test(tc('CMP-U33'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp.id, b.bo.id] });
    await unitsTab(page, c.id);
    const heads = (await unitHeads(page)).filter(h => h && h !== 'Thao tác');
    const { file, suggested } = await download(page, () => btn(C(page), /xuất excel/i).last().click(), 'units.xlsx');
    expect(suggested).toMatch(/\.xlsx$/i);
    const rows = rowsOf(readXlsx(file));
    const hr = Number(Object.entries(rows).find(([, r]) => Object.values(r).some(x => x.v === 'Mã đơn vị'))?.[0] ?? 0);
    expect(hr, 'file có dòng tiêu đề "Mã đơn vị"').toBeGreaterThan(0);
    const fileHeads = Object.values(rows[hr]).map(x => norm(x.v)).filter(Boolean);
    const data = Object.entries(rows).filter(([i, r]) => Number(i) > hr && Object.values(r).some(x => x.v)).map(([, r]) => Object.values(r).map(x => x.v).join(' | '));
    expect.soft(data.length, `số dòng = số đơn vị tham gia (file: ${data.join(' // ')})`).toBe(2);
    // STT (số thứ tự) và Thao tác không phải cột dữ liệu; tên cột trong file có thể đầy đủ hơn (vd "Trạng thái thực hiện")
    const miss = heads.filter(h => !/^STT$/i.test(h)).filter(h => !fileHeads.some(f => f === h || f.startsWith(h)));
    expect.soft(miss, `cột màn hình không có trong file (file: ${fileHeads.join(', ')})`).toEqual([]);
    expect.soft(fileHeads.length, `file thừa cột (màn hình: ${heads.join(', ')})`).toBe(heads.filter(h => !/^STT$/i.test(h)).length);
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('CMP-T21'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp.id] });
    // bộ chỉ số của kỳ (bản sao riêng của kỳ) → xóa hết nhóm/chỉ số
    must(await A('PUT', `${SETS}/${c.indicatorSetId}/indicators`, []), 'xóa chỉ số khỏi bộ của kỳ');
    // (API không cho xóa hết nhóm: "Bộ chỉ số phải có ít nhất 1 nhóm chỉ số" → giữ nhóm, bộ còn 0 chỉ số)
    const left = (await A('GET', `${SETS}/${c.indicatorSetId}`)).data;
    expect((left.groups ?? []).flatMap((g: any) => g.indicators ?? []).length, 'bộ chỉ số của kỳ còn 0 chỉ số').toBe(0);
    await openCampDetail(page, c.id);
    await btn(C(page), /^\s*Trình phê duyệt\s*$/).first().click(); await page.waitForTimeout(800);
    const confirm = page.locator('.ant-modal-confirm, .ant-modal').filter({ visible: true }).filter({ hasText: /trình phê duyệt/i });
    if (await confirm.count()) await btn(confirm.last(), /^\s*(Có|Trình phê duyệt|Xác nhận|Đồng ý|Trình)\s*$/).last().click();
    const msg = await toast(page); await page.waitForTimeout(1200);
    let st = (await getCamp(c.id)).status; let apiR: any = null;
    if (st === 'Draft') { apiR = await A('POST', `${CAMP}/${c.id}/submit`, {}); st = (await getCamp(c.id)).status; }
    expect.soft(st, `trạng thái sau khi trình (UI: "${msg}")`).toBe('Draft');
    if (apiR) expect.soft(apiR.status, `[API] submit: ${apiR.message}`).toBe(400);
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('CMP-T22'), async ({ page }) => {
    const c = await mkCamp();   // chưa phân công đơn vị
    await openCampDetail(page, c.id);
    const b = btn(C(page), /^\s*Trình phê duyệt\s*$/).first();
    const seen: string[] = []; let confirmShown = false;
    if (await b.isDisabled()) {
      // nút bị vô hiệu → lý do hiện ngay ở tooltip khi di chuột
      await b.hover({ force: true }); await page.waitForTimeout(1200);
      seen.push(...await page.locator('.ant-tooltip, .ant-popover').filter({ visible: true }).allInnerTexts());
    } else {
      await b.click();
      for (let i = 0; i < 8; i++) {
        seen.push(...await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts());
        if (await page.locator('.ant-modal-confirm, .ant-modal').filter({ visible: true }).filter({ hasText: /muốn trình|xác nhận/i }).count()) confirmShown = true;
        await page.waitForTimeout(300);
      }
      if (confirmShown) await page.keyboard.press('Escape');
    }
    expect.soft(confirmShown, 'không được mở hộp xác nhận trình').toBe(false);
    expect.soft(norm(seen.join(' | ')), 'báo ngay cần phân công đơn vị').toMatch(/phân công.*đơn vị|đơn vị/i);
    expect.soft((await getCamp(c.id)).status).toBe('Draft');
    expect(test.info().errors.length).toBe(0);
  });
});

// ====================================================================== ATB — validate Mã ở API (#208)
const RES3 = [PIL, IGR, IND] as const;
async function postWithCode(res: string, code: any) {
  const { p, g } = await fx();
  const body: any = res === PIL ? { code, name: nm('ATB trụ cột'), displayOrder: 0 }
    : res === IGR ? { pillarId: p.id, code, name: nm('ATB nhóm'), displayOrder: 0 }
    : { indicatorGroupId: g.id, pillarId: p.id, code, name: nm('ATB chỉ số'), minScore: 0, maxScore: 1 };
  const r = await A('POST', res, body);
  return { status: r.status, message: r.message, code: r.data?.code };
}
test.describe('Bug GitLab B › ATB validate Mã (API)', () => {
});
