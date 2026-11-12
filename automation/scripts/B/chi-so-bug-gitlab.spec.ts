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
test.describe('Bug GitLab B › Chỉ số', () => {
  test(tc('IND-L35'), async ({ page }) => {
    const { g, par, c1 } = await fx();
    await go(page, 'indicators');
    await page.getByText('Xem dạng cây', { exact: true }).click(); await page.waitForTimeout(2500);
    const conn = async (text: string) => {
      const row = C(page).locator('tbody tr.ant-table-row').filter({ hasText: text }).first();
      await row.waitFor({ timeout: 15_000 });
      return row.locator('td').first().evaluate(td => [...td.querySelectorAll('[aria-hidden="true"]')].filter(e => {
        const r = (e as HTMLElement).getBoundingClientRect(), s = getComputedStyle(e);
        return (r.width <= 2 && r.height > 4 || r.height <= 2 && r.width > 4) && s.backgroundColor !== 'rgba(0, 0, 0, 0)';
      }).length);
    };
    const res = { 'nhóm (cấp 2)': await conn(g.code), 'chỉ số cha (cấp 3)': await conn(par.code), 'chỉ số con (cấp 4)': await conn(c1.code) };
    for (const [k, n] of Object.entries(res)) expect.soft(n, `dòng ${k} không có đường nối tới nút cha`).toBeGreaterThan(0);
    expect(test.info().errors.length, `đường nối dạng cây: ${JSON.stringify(res)}`).toBe(0);
  });
  test(tc('IND-C15'), async ({ page }) => {
    const { p, g } = await fx();
    const par = await mkInd(g.id, p.id, { name: nm('Cha cộng dồn'), max: 10 });
    await mkInd(g.id, p.id, { name: nm('Con 5đ'), parentId: par.id, max: 5 });
    const childName = nm('Con 3đ UI');
    await go(page, 'indicators'); await searchList(page, /tìm kiếm tên\/mã chỉ số/i, par.code);
    await btn(page, /^\s*Thêm chỉ số\s*$/).first().click();
    const d = dlg(page); await d.waitFor(); await page.waitForTimeout(600);
    const sel = (re: RegExp) => d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: re }) }).locator('.ant-select').first();
    await pickOption(page, sel(/^Trụ cột$/), p.name);
    await pickOption(page, sel(/^Nhóm chỉ số$/), g.name);
    await pickOption(page, sel(/^Chỉ số cha$/), par.name);
    await d.getByPlaceholder(/nhập tên chỉ số/i).fill(childName);
    await d.getByPlaceholder(/nhập điểm tối thiểu/i).fill('0');
    await d.getByPlaceholder(/nhập điểm tối đa/i).fill('3');
    await btn(d, /^\s*Lưu\s*$/).last().click();
    const msg = await toast(page); await page.waitForTimeout(1500);
    expect(msg, 'thêm chỉ số con').toMatch(/thành công/i);
    const row = dataRows(page).filter({ hasText: par.code }).first();
    await row.waitFor({ timeout: 10_000 });
    const cells = (await row.locator('td').allInnerTexts()).map(norm);
    expect(cells[7], `Điểm tối đa chỉ số cha ở danh sách (dòng: ${cells.join(' | ')})`).toBe('8');
  });
  test(tc('IND-C16'), async ({ page }) => {
    const { p, g } = await fx();
    const par = await mkInd(g.id, p.id, { name: nm('Cha sửa'), max: 10 });
    await mkInd(g.id, p.id, { name: nm('Con 5đ'), parentId: par.id, max: 5 });
    await mkInd(g.id, p.id, { name: nm('Con 3đ'), parentId: par.id, max: 3 });
    await goDetail(page, `indicators/${par.id}`, 'Chỉ số con thuộc chỉ số');
    await btn(C(page), /^\s*Cập nhật\s*$/).first().click();
    const d = dlg(page); await d.waitFor(); await page.waitForTimeout(800);
    expect(await d.getByPlaceholder(/nhập điểm tối đa/i).inputValue(), 'ô Điểm tối đa của chỉ số cha').toBe('8');
  });
  test(tc('IND-V04'), async ({ page }) => {
    const { p, g, par, c1, c2 } = await fx();
    await go(page, 'indicators'); await searchList(page, /tìm kiếm tên\/mã chỉ số/i, par.code);
    await dataRows(page).filter({ hasText: par.code }).first().getByRole('button', { name: 'Xem chi tiết' }).click();
    await page.waitForURL(new RegExp(`/indicators/${par.id}`), { timeout: 10_000 });
    await C(page).getByText('Chỉ số con thuộc chỉ số').first().waitFor(); await page.waitForTimeout(800);
    const t = await ctext(page);
    for (const v of [par.name, 'Mã chỉ số', par.code, 'Trụ cột', p.name, 'Nhóm chỉ số', g.name, 'Chỉ số cha', 'Điểm tối thiểu', 'Điểm tối đa', 'Đã khóa', 'Mô tả', 'Cập nhật lần cuối', c1.code, c2.code])
      expect.soft(t, `chi tiết chỉ số thiếu "${v}"`).toContain(v);
    expect(test.info().errors.length).toBe(0);
  });
  test(tc('IND-V05'), async ({ page }) => {
    const { c4 } = await fx();   // chỉ số Đã khóa
    await goDetail(page, `indicators/${c4.id}`, 'Mã chỉ số');
    const t = await ctext(page);
    expect(t, 'chip trạng thái').toContain('Đã khóa');
    expect(t, 'không còn khối thông báo đã khóa').not.toMatch(/Chỉ số đang ở trạng thái Đã khóa/i);
  });
  test(tc('IND-V06'), async ({ page }) => {
    const { p, g } = await fx();
    const name = (nm('Tên 500') + ' ' + 'Chỉ số có tên rất dài dùng kiểm tra hiển thị tiêu đề. '.repeat(12)).slice(0, 499) + 'Z';
    const x = await mkInd(g.id, p.id, { name });
    await goDetail(page, `indicators/${x.id}`, 'Mã chỉ số');
    const h1 = C(page).locator('h1').first();
    expect(norm(await h1.innerText()), 'tiêu đề chứa toàn bộ tên').toContain(norm(name));
    const cut = await h1.evaluate(e => [e, ...e.querySelectorAll('*')].filter(n => {
      const s = getComputedStyle(n), el = n as HTMLElement;
      return (el.scrollWidth > el.clientWidth + 1 && s.overflowX !== 'visible') || (el.scrollHeight > el.clientHeight + 1 && s.overflowY !== 'visible') || s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth || (s.webkitLineClamp !== 'none' && s.webkitLineClamp !== '');
    }).map(n => `${n.tagName}.${(n as HTMLElement).className}`));
    expect(cut, 'phần tử tiêu đề bị cắt chữ').toEqual([]);
    const box = await h1.boundingBox(), main = await C(page).boundingBox();
    expect(box!.x + box!.width, 'tiêu đề không tràn khung').toBeLessThanOrEqual(main!.x + main!.width + 1);
  });
  test(tc('IND-N07'), async ({ page }) => {
    const { p, g } = await fx();
    const src = await mkInd(g.id, p.id, { name: nm('Nguồn nhân bản'), max: 2 });
    await go(page, 'indicators'); await searchList(page, /tìm kiếm tên\/mã chỉ số/i, src.name);
    expect(await dataRows(page).count()).toBe(1);
    await dataRows(page).first().getByRole('button', { name: 'Thao tác' }).click();
    await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: /nhân bản/i }).click();
    await btn(modal(page), /^\s*Nhân bản\s*$/).last().click();
    const msg = await toast(page);
    expect(msg, 'thông báo nhân bản').toMatch(/thành công/i);
    await page.waitForTimeout(3000);   // không tải lại trang
    const api2 = await listKw(IND, src.name);
    expect(api2.length, 'API đã có bản sao').toBe(2);
    expect(await dataRows(page).count(), 'bản sao phải xuất hiện ngay trong danh sách (không F5)').toBe(2);
  });
});

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
