// C.UC1 KẾT QUẢ TỰ ĐÁNH GIÁ (1/3): danh sách, chi tiết, chấm điểm + minh chứng, thông báo, edge, phân quyền — script bám testcase RES-L/V/S/N/G/Z.
// Dữ liệu thử là "fixture" tạo MỘT LẦN (tên cố định qc.automation RES1 …) và tái sử dụng; kỳ đã phê duyệt không xóa được nên không tạo mỗi test một kỳ.
// Tuyệt đối không gọi nhắc nhở/yêu cầu đánh giá lại trên dữ liệu có sẵn: mọi thao tác có tác dụng lan sang người khác chỉ chạy trên kết quả fixture.
import { Page, Locator, Browser } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import {
  test, expect, tc, needWrite, api, listApi, dataRows, totalOf, pickOption, apiStatus, tokenOf, code8,
} from './common';
import { API_BASE } from '../api';

const RES = 'dti/assessment-results', CAMP = 'dti/self-assessment-campaigns', NOTI = 'notifications/mine';
const SCALE = '6f1c6e0e-5a56-4a0e-9a53-0d1f2b6b7c01';           // TXL-001 Thang xếp loại mặc định
const SET_BA = '5ff891ae-818e-444a-9b00-5a22da75503c';          // BA-TEST-SET: 1 chỉ số, tối đa 8, trọng số 2
const SET_MB = 'a0115fd6-0ac6-4c21-aed7-9db395aab0e2';          // MBCS_QC01: 100 chỉ số con (+20 chỉ số cha)
const ORG_BO = '0d39632f-fa83-45d0-8a6f-aa0196fc1e96';          // QA - Đơn vị Bộ (canbo, ldd)
const ORG_DP = 'b5a3ab66-ba5c-4e8a-baf9-15aecf8358ed';          // QA - Địa phương (cbdp, ldp)
const UNIT_TYPE = '10000000-0000-0000-0000-000000000012';
const F = (o: any) => encodeURIComponent(JSON.stringify(o));
const FAKE = '00000000-0000-4000-8000-000000000000';
const ST: Record<string, string> = {
  NotStarted: 'Chưa thực hiện', Scoring: 'Đang chấm điểm', PendingApproval: 'Chờ duyệt', Approved: 'Đã phê duyệt',
  Rejected: 'Bị từ chối', Submitted: 'Đã gửi', UnlockRequested: 'Chờ mở khóa', NotSent: 'Chưa gửi',
};
const ST_BY_NAME = Object.fromEntries(Object.entries(ST).map(([k, v]) => [v, k]));
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

// ---------------------------------------------------------------- API tiện ích
const getRes = async (id: string, as = 'canbo') => (await api('GET', `${RES}/${id}`, undefined, as)).data;
async function lst(filter: any, as = 'canbo', page = 1, size = 10) {
  const r = await api('GET', `${RES}?page=${page}&size=${size}&filter=${F(filter)}`, undefined, as);
  return r.data ?? { content: [], totalElements: 0 };
}
async function lstAll(filter: any, as = 'canbo'): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 12; p++) {
    const d = await lst(filter, as, p, 100); out.push(...(d.content ?? []));
    if (p >= (d.totalPages ?? 1)) break;
  }
  return out;
}
async function upload(docType: string, entityId: string | null, name: string, bytes: Buffer, as: string | null = 'canbo', mime = 'application/pdf') {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: mime }), name);
  if (entityId) fd.append('entityId', entityId);
  const r = await fetch(`${API_BASE}/api/v1/upload/blob/${docType}`, { method: 'POST', headers: as ? { Authorization: `Bearer ${tokenOf(as)}` } : {}, body: fd });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, message: String(j?.message ?? ''), data: j?.data, raw: j };
}
const saveScores = (id: string, scores: any[], as = 'canbo') => api('PUT', `${RES}/${id}/scores`, { scores }, as);
const sc = (ind: any, score: number, extra: any = {}) => ({ indicatorSetIndicatorId: ind.indicatorSetIndicatorId, score, ...extra });
const leaves = (d: any) => (d.indicators as any[]).filter(i => i.isLeaf && i.isScored);
const unscored = (d: any) => leaves(d).filter(i => i.score == null);
// PUT scores là LƯU TOÀN BỘ (chỉ số không có trong danh sách bị xóa điểm) → khi chỉ muốn thêm/sửa vài chỉ số phải gộp với điểm hiện có
const keep = (d: any) => leaves(d).filter(i => i.score != null).map(i => ({ indicatorSetIndicatorId: i.indicatorSetIndicatorId, score: i.score, note: i.note, attachmentIds: (i.attachments ?? []).map((a: any) => a.id) }));
async function saveMerge(id: string, extra: any[], as = 'canbo') {
  const d = await getRes(id, as); const m = new Map<string, any>(keep(d).map(x => [x.indicatorSetIndicatorId, x]));
  for (const e of extra) m.set(e.indicatorSetIndicatorId, { ...m.get(e.indicatorSetIndicatorId), ...e });
  return saveScores(id, [...m.values()], as);
}

// ---------------------------------------------------------------- Fixture (tạo một lần, tái sử dụng)
type Fx = { camp: Record<string, string>; org: Record<string, string>; res: Record<string, string> };
const CACHE = path.join(os.tmpdir(), 'qc-res1-fixture.json');
let FX: Promise<Fx> | null = null;
const exact = async (res: string, name: string) => (await listApi(res, name)).find((x: any) => x.name === name) ?? null;

async function ensureOrg(letter: string) {
  const name = `qc.automation RES1 ĐV ${letter}`;
  const o = await exact('organizations', name);
  if (o) return o.id as string;
  const c = await api('POST', 'organizations', { code: `QCARES1${letter}`, name, unitTypeId: UNIT_TYPE });
  if (c.status !== 200) throw new Error(`tạo đơn vị lỗi: ${c.message}`);
  await api('PUT', `organizations/${c.data.id}/lock`, {});
  return c.data.id as string;
}
async function ensureMiSet() {
  const find = async (res: string, code: string) => (await listApi(res, code)).find((x: any) => x.code === code);
  const must = (r: any, w: string) => { if (r.status >= 300) throw new Error(`${w}: ${r.message}`); return r; };
  let p = await find('dti/pillars', 'QCARES1P');
  if (!p) { p = must(await api('POST', 'dti/pillars', { code: 'QCARES1P', name: 'qc.automation RES1 Trụ cột', displayOrder: 0 }), 'trụ cột').data; await api('PUT', `dti/pillars/${p.id}/lock`, {}); }
  let g = await find('dti/indicator-groups', 'QCARES1G');
  if (!g) { g = must(await api('POST', 'dti/indicator-groups', { pillarId: p.id, code: 'QCARES1G', name: 'qc.automation RES1 Nhóm', displayOrder: 0 }), 'nhóm').data; await api('PUT', `dti/indicator-groups/${g.id}/lock`, {}); }
  const mkI = async (code: string, parentId: string | undefined, min: number, max: number) => {
    let i = await find('dti/indicators', code);
    if (i) return i;
    i = must(await api('POST', 'dti/indicators', { indicatorGroupId: g.id, pillarId: p.id, parentId, code, name: `qc.automation RES1 chỉ số ${code}`, minScore: min, maxScore: max }), 'chỉ số').data;
    await api('PUT', `dti/indicators/${i.id}/lock`, {});
    return i;
  };
  const P = await mkI('QCARES1I0', undefined, 0, 100);
  const C1 = await mkI('QCARES1I1', P.id, 5, 8), C2 = await mkI('QCARES1I2', P.id, 5, 10), C3 = await mkI('QCARES1I3', P.id, 0, 8);
  let s = await find('dti/indicator-sets', 'QCARES1S');
  if (!s) {
    s = must(await api('POST', 'dti/indicator-sets', { code: 'QCARES1S', name: 'qc.automation RES1 bộ chỉ số', effectiveYear: 2026 }), 'bộ chỉ số').data;
    must(await api('PUT', `dti/indicator-sets/${s.id}/groups`, [{ indicatorGroupId: g.id, displayOrder: 1, isScored: true }]), 'nhóm của bộ');
    must(await api('PUT', `dti/indicator-sets/${s.id}/indicators`, [[P, 1, 1], [C1, 1, 2], [C2, 2, 3], [C3, 1, 4]].map(([i, w, o]: any) => ({ indicatorId: i.id, indicatorGroupId: g.id, weight: w, displayOrder: o, isScored: true }))), 'chỉ số của bộ');
    const d = (await api('GET', `dti/indicator-sets/${s.id}`)).data;
    must(await api('POST', `dti/indicator-sets/${s.id}/lock?rowVersion=${d.rowVersion}`, {}), 'khóa bộ');
  }
  return s.id as string;
}
/** Kỳ fixture: tạo (Cán bộ) → phân công → trình → phê duyệt (Lãnh đạo Bộ); đã có thì dùng lại. */
async function ensureCamp(name: string, body: any, orgIds: string[]) {
  const c = await exact(CAMP, name);
  if (c) return c.id as string;
  const must = (r: any, w: string) => { if (r.status >= 300) throw new Error(`${w}: ${r.message}`); return r; };
  const cr = must(await api('POST', CAMP, { scaleId: SCALE, reminderDaysBeforeDue: 3, name, ...body }, 'canbo'), 'tạo kỳ');
  const id = cr.data.id as string;
  must(await api('PUT', `${CAMP}/${id}/organizations`, orgIds, 'canbo'), 'phân công');
  must(await api('POST', `${CAMP}/${id}/submit`, undefined, 'canbo'), 'trình kỳ');
  must(await api('POST', `${CAMP}/${id}/approve`, undefined, 'lanhdaobo'), 'phê duyệt kỳ');
  return id;
}
async function loadFx(): Promise<Fx> {
  if (fs.existsSync(CACHE)) {
    try {
      const c: Fx = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
      if (c.camp.PAST && c.res['PD.BO'] && (await api('GET', `${CAMP}/${c.camp.BA}`)).status === 200 && (await api('GET', `${RES}/${c.res.MBns}`, undefined, 'canbo')).status === 200) return c;
    } catch { /* tạo lại */ }
  }
  const org: Record<string, string> = { DP: ORG_DP, BO: ORG_BO };
  for (const l of 'ABCDEFGH') org[l] = await ensureOrg(l);
  const all = [...'ABCDEFGH'].map(l => org[l]);
  const miSet = await ensureMiSet();
  const win = { startDate: '2026-10-01T00:00:00', endDate: '2026-12-31T23:59:59' };
  const camp: Record<string, string> = {};
  camp.BA = await ensureCamp('qc.automation RES1 fixture BA', { type: 'AdHoc', indicatorSetId: SET_BA, ...win }, [...all, ORG_DP, ORG_BO]);
  camp.MI = await ensureCamp('qc.automation RES1 fixture MI', { type: 'AdHoc', indicatorSetId: miSet, ...win }, [org.A, org.B, org.C, org.D, ORG_DP, ORG_BO]);
  camp.MB = await ensureCamp('qc.automation RES1 fixture MB', { type: 'AdHoc', indicatorSetId: SET_MB, ...win }, [org.A, org.B, ORG_DP, ORG_BO]);
  camp.PD = await ensureCamp('qc.automation RES1 fixture PD Q4', { type: 'Periodic', periodType: 'Quarter', periodValue: 'Quý 4 2026', indicatorSetId: SET_BA, startDate: '2026-10-01T00:00:00', endDate: '2026-12-31T23:59:59' }, [org.A, org.B, ORG_DP, ORG_BO]);
  // Hạn nộp gửi theo đúng định dạng giao diện gửi lên (00:00 giờ VN của ngày kế tiếp = 17:00Z): người dùng chọn 31/12/2026
  camp.TZ = await ensureCamp('qc.automation RES1 fixture TZ', { type: 'AdHoc', indicatorSetId: SET_BA, startDate: '2026-11-30T17:00:00.000Z', endDate: '2026-12-30T17:00:00.000Z' }, [org.A]);
  camp.PAST = await ensureCamp('qc.automation RES1 fixture PAST', { type: 'AdHoc', indicatorSetId: SET_BA, startDate: '2026-08-01T00:00:00', endDate: '2026-09-02T23:59:59' }, [org.A, ORG_DP]);
  const res: Record<string, string> = {};
  for (const k of ['BA', 'MI', 'MB', 'PD', 'TZ', 'PAST']) {
    for (const x of await lstAll({ campaignIds: [camp[k]], phase: 'all' })) {
      const key = Object.entries(org).find(([, v]) => v === x.organizationId)?.[0];
      if (key) res[`${k}.${key}`] = x.id;
    }
  }
  res.MBns = res['MB.B'];   // MB.B: kết quả "Chưa thực hiện" giữ nguyên, chỉ để đọc
  const fx = { camp, org, res };
  fs.writeFileSync(CACHE, JSON.stringify(fx));
  return fx;
}
const fx = () => (FX ??= loadFx().catch(e => { FX = null; throw e; }));
/** id kết quả fixture theo khóa "MI.A", "BA.DP"… */
const R = async (k: string) => (await fx()).res[k];

// ---------------------------------------------------------------- Đưa kết quả fixture về trạng thái mong muốn
const NEXT: Record<string, string[]> = {
  NotStarted: ['Scoring'], Scoring: ['PendingApproval'], PendingApproval: ['Approved', 'Rejected'], Rejected: ['PendingApproval'],
  Approved: ['Submitted'], Submitted: ['UnlockRequested'], UnlockRequested: ['Scoring', 'Submitted'],
};
async function scoreAll(id: string) {
  const d = await getRes(id);
  const todo = unscored(d).map(i => sc(i, Math.min(Math.max(i.minScore ?? 0, 1), i.maxScore)));
  if (todo.length) { const r = await saveMerge(id, todo); if (r.status !== 200) throw new Error(`chấm điểm lỗi ${r.status} ${r.message}`); }
}
async function step(id: string, from: string, to: string) {
  const must = (r: any) => { if (r.status !== 200) throw new Error(`${from}→${to}: ${r.status} ${r.message}`); return r; };
  const reason = { reason: 'qc.automation' };
  if (from === 'NotStarted') { const d = await getRes(id); must(await saveMerge(id, [sc(leaves(d)[0], Math.min(Math.max(leaves(d)[0].minScore ?? 0, 1), leaves(d)[0].maxScore))])); }
  else if (from === 'Scoring' || from === 'Rejected') { await scoreAll(id); must(await api('POST', `${RES}/${id}/submit-for-approval`, undefined, 'canbo')); }
  else if (from === 'PendingApproval') must(to === 'Approved' ? await api('POST', `${RES}/${id}/approve`, undefined, 'ldd') : await api('POST', `${RES}/${id}/reject`, reason, 'ldd'));
  else if (from === 'Approved') {
    const u = await upload('assessment_result_file', id, 'qc-automation.pdf', PDF);
    must(await api('POST', `${RES}/${id}/send`, { attachmentId: u.data.id, fileType: 'DigitalSigned', documentNumber: 'QC1', documentDate: '2026-10-27T00:00:00', note: 'qc.automation' }, 'canbo'));
  }
  else if (from === 'Submitted') must(await api('POST', `${RES}/${id}/request-unlock`, reason, 'canbo'));
  else if (from === 'UnlockRequested') must(to === 'Scoring' ? await api('POST', `${RES}/${id}/approve-unlock`, undefined, 'canbo') : await api('POST', `${RES}/${id}/reject-unlock`, reason, 'canbo'));
}
/** Đưa kết quả fixture tới trạng thái đích (đi theo vòng đời hợp lệ, vai trò thực hiện đúng đặc tả). */
async function driveTo(id: string, target: string) {
  for (let guard = 0; guard < 8; guard++) {
    const cur = (await getRes(id)).status as string;
    if (cur === target) return id;
    const prev = new Map<string, string>([[cur, '']]); const q = [cur];
    while (q.length) { const s = q.shift()!; for (const n of NEXT[s] ?? []) if (!prev.has(n)) { prev.set(n, s); q.push(n); } }
    if (!prev.has(target)) throw new Error(`không thể đưa kết quả ${id} từ ${cur} về ${target}`);
    let n = target; while (prev.get(n) !== cur) n = prev.get(n)!;
    await step(id, cur, n);
  }
  return id;
}
/** Kết quả fixture "giữ trạng thái" dùng chung cho các test chỉ đọc. */
const HOLD: Record<string, string> = {
  Scoring: 'BA.B', PendingApproval: 'BA.C', Rejected: 'BA.D', Approved: 'BA.E', Submitted: 'BA.F', UnlockRequested: 'BA.G',
};
async function hold(status: string) { const id = await R(HOLD[status]); await driveTo(id, status); return id; }
/** Kết quả "Chưa thực hiện" dùng một lần: ưu tiên kết quả còn trống trong các kỳ fixture, hết thì tạo kỳ "fresh" mới (ghi rõ trong báo cáo). */
async function takeNS(): Promise<string> {
  const f = await fx();
  const reserved = new Set([f.res.MBns, f.res['BA.DP'], f.res['BA.BO'], f.res['MI.DP'], f.res['MI.BO'], f.res['MB.DP'], f.res['MB.BO'], ...Object.values(HOLD).map(k => f.res[k])]);
  const pool = async () => {
    const out: any[] = [];
    for (const c of [f.camp.BA, ...(await listApi(CAMP, 'qc.automation RES1 fresh')).map((x: any) => x.id)]) out.push(...await lstAll({ campaignIds: [c], status: 'NotStarted' }));
    return out.filter(x => !reserved.has(x.id));
  };
  let p = await pool();
  if (!p.length) {
    const name = `qc.automation RES1 fresh ${code8()}`;
    await ensureCamp(name, { type: 'AdHoc', indicatorSetId: SET_BA, startDate: '2026-10-01T00:00:00', endDate: '2026-12-31T23:59:59' }, ['A', 'B', 'C', 'D'].map(l => f.org[l]));
    p = await pool();
  }
  return p[0].id;
}

/** MB.A (100 chỉ số) ở trạng thái chấm dở: đúng 3 chỉ số có điểm, còn lại để trống (đặt qua API để các test không phụ thuộc thứ tự chạy). */
async function partialMB() {
  const id = await ensureEditable(await R('MB.A')), d = await getRes(id), lv = leaves(d);
  if (lv.filter(i => i.score != null).length !== 3 || unscored(d).length !== lv.length - 3) {
    const r = await saveScores(id, lv.slice(0, 3).map(i => sc(i, Math.min(Math.max(i.minScore ?? 0, 1), i.maxScore)))); if (r.status !== 200) throw new Error(`đặt MB.A chấm dở lỗi: ${r.message}`);
  }
  return id;
}

// ---------------------------------------------------------------- Helper giao diện
const content = (p: Page) => p.locator('.ant-layout-content').first();
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const ROUTE = '/#/vi/assessment-results';
async function openList(page: Page, qs = '') {
  await page.setViewportSize({ width: 1920, height: 1080 });   // đủ rộng để dải tab trạng thái không bị gộp vào menu "…"
  await page.goto(`${ROUTE}${qs}`, { waitUntil: 'networkidle' });
  await page.locator('tbody tr.ant-table-row, .ant-empty, .ant-table-placeholder').first().waitFor({ timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(400);
}
const settle = async (p: Page, ms = 700) => { await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(ms); };
const PAGER_SEL = '.ant-pagination-options .ant-select';
const filterSelects = (p: Page) => p.locator(`.ant-select:not(${PAGER_SEL})`);
const searchBox = (p: Page) => p.getByPlaceholder(/tìm/i).first();
async function search(p: Page, kw: string) { await searchBox(p).fill(kw); await settle(p, 900); }
const tabs = (p: Page) => p.locator('[role=tab]');
const tabNames = async (p: Page) => (await tabs(p).allInnerTexts()).map(t => norm(t).replace(/\s*\d+\+?$/, ''));
async function tabCount(p: Page, name: string) {
  const t = norm(await p.getByRole('tab', { name: new RegExp(`^${name}`) }).first().innerText());
  const m = t.match(/(\d+)\+?$/); return m ? Number(m[1]) : 0;
}
async function clickTab(p: Page, name: string) { await p.getByRole('tab', { name: new RegExp(`^${name}`) }).first().click(); await settle(p); }
async function rowsData(p: Page) {
  return p.locator('tbody tr.ant-table-row').evaluateAll(trs => trs.map(tr => {
    const td = [...tr.querySelectorAll(':scope > td')].map(t => (t as HTMLElement).innerText.trim());
    return { cells: td, text: (tr as HTMLElement).innerText.replace(/\s+/g, ' ').trim() };
  }));
}
const nameOf = (cells: string[]) => cells[1].split('\n')[0].trim();
const statusOf = (cells: string[]) => cells[6].split('\n')[0].trim();
async function setSegment(p: Page, label: 'Định kỳ' | 'Đột xuất') { await p.getByText(label, { exact: true }).first().click(); await settle(p); }
async function setPhase(p: Page, label: RegExp | string) { await pickOption(p, filterSelects(p).first(), label); await settle(p); }
async function rowMenu(p: Page, row: Locator): Promise<string[]> {
  const btns = row.locator('button');
  if ((await btns.count()) < 2) return [];   // dòng không có mũi tên menu
  await btns.last().click();
  const dd = p.locator('.ant-dropdown:not(.ant-dropdown-hidden)').last();
  if (!(await dd.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false))) return [];
  const items = (await dd.locator('.ant-dropdown-menu-item').allInnerTexts()).map(norm);
  return items;
}
/** Dòng danh sách (AdHoc) của một kết quả fixture, lọc theo tên kỳ + tên đơn vị. */
async function findRowOf(p: Page, campName: string, orgName: string) {
  await openList(p, '?campaignType=AdHoc&phase=all');
  await search(p, `${orgName}`);
  return dataRows(p).filter({ hasText: campName }).first();
}
const orgName = (l: string) => `qc.automation RES1 ĐV ${l}`;
async function openDetail(p: Page, id: string, qs = '') {
  await p.setViewportSize({ width: 1920, height: 1080 });
  await p.goto(`${ROUTE}/${id}${qs}`, { waitUntil: 'networkidle' });
  await p.getByText(/Thông tin chung/).first().waitFor({ timeout: 15_000 }).catch(() => {});
  await p.waitForTimeout(500);
}
const bodyText = async (p: Page) => norm(await content(p).innerText());
async function asRole(browser: Browser, key: string) {
  const ctx = await browser.newContext({ storageState: `auth/${key}.json`, baseURL: (test.info().project.use as any).baseURL });
  return { ctx, page: await ctx.newPage() };
}
/** Đọc file xlsx (giải nén bằng unzip hệ thống) → mảng dòng. */
function xlsxRows(file: string): string[][] {
  const z = (n: string) => { try { return execFileSync('unzip', ['-p', file, n], { maxBuffer: 64 << 20 }).toString('utf8'); } catch { return ''; } };
  const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const shared = [...z('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const sheet = z('xl/worksheets/sheet1.xml');
  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r => [...r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => {
    const t = /t="(\w+)"/.exec(c[1])?.[1], body = c[2] ?? '';
    if (t === 's') return shared[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])] ?? '';
    if (t === 'inlineStr') return dec([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
    return /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '';
  }));
}
async function downloadTo(p: Page, click: () => Promise<any>, name = 'x.xlsx') {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20_000 }), click()]);
  const file = path.join(os.tmpdir(), `qc-res1-${Date.now()}-${name}`);
  await dl.saveAs(file);
  return { file, name: dl.suggestedFilename() };
}

test.describe.configure({ timeout: 60_000 });

// ================================================================ L — DANH SÁCH
const COLS = ['stt', 'kỳ tự đánh giá', 'đơn vị', 'hạn nộp', 'tiến độ chấm', 'điểm', 'trạng thái', 'thao tác'];
const headsOf = async (p: Page) => (await p.locator('.ant-table-thead').first().locator('th').allInnerTexts()).map(s => norm(s).toLowerCase()).filter(Boolean);
const ACTIVE7 = ['Tất cả', 'Chưa thực hiện', 'Đang chấm điểm', 'Chờ duyệt', 'Đã phê duyệt', 'Bị từ chối', 'Đã gửi', 'Chờ mở khóa'];
const tabsOnly = (n: string[]) => n.filter(x => x !== 'Cần xử lý').sort();
const mockExport = (p: Page, status: number, body: any) => p.route(/\/api\/v1\/dti\/assessment-results\/export/, r => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));

test.describe('Kết quả tự đánh giá › Danh sách', () => {
  test(tc('RES-L01'), async ({ page }) => {
    await openList(page);
    const heads = await headsOf(page);
    expect(heads.slice(0, 8), `cột thực tế: ${heads.join(' | ')}`).toEqual(COLS);
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r, i) => expect(Number(r.cells[0]), 'STT tăng dần từ 1').toBe(i + 1));
  });
  test(tc('RES-L02'), async ({ page }) => {
    await openList(page);
    const rows = await rowsData(page), api1 = await lst({ campaignType: 'Periodic', phase: 'all' });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const a = (api1.content as any[]).find(x => x.campaignName === nameOf(r.cells) && r.cells[2].includes(x.organizationName));
      expect(a, `không tìm thấy dòng API tương ứng "${nameOf(r.cells)}"`).toBeTruthy();
      expect(r.text, `dòng "${nameOf(r.cells)}" thiếu tên bộ chỉ số`).toContain(a.indicatorSetName);
    }
  });
  test(tc('RES-L03'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    await clickTab(page, 'Đã gửi');
    expect(await headsOf(page), 'danh sách phải có cột Xếp loại').toContain('xếp loại');
    for (const r of await rowsData(page)) expect(r.text).toMatch(/\d+(,\d+)?%/);
  });
  test(tc('RES-L04'), async ({ page }) => {
    await openList(page);
    await expect(page.locator('.ant-segmented-item-selected')).toContainText('Định kỳ');
    expect(page.url()).toContain('campaignType=Periodic');
    const a = await lstAll({ campaignType: 'Periodic', phase: 'all' });
    expect(a.every(x => x.campaignType === 'Periodic')).toBeTruthy();
    expect(await totalOf(page)).toBe(a.length);
  });
  test(tc('RES-L05'), async ({ browser }) => {
    const { ctx, page } = await asRole(browser, 'ldp');
    try {
      await openList(page);
      const names = await tabNames(page);
      expect(names[0], `thứ tự tab: ${names.join(', ')}`).toBe('Cần xử lý');
      await expect(tabs(page).first()).toHaveAttribute('aria-selected', 'true');
    } finally { await ctx.close(); }
  });
  test(tc('RES-L06'), async () => {
    const out: string[] = [];
    for (const as of ['canbo', 'cbdp']) {
      const rows = await lstAll({ todo: true }, as);
      out.push(...rows.filter(x => x.isClosed || !['NotStarted', 'Scoring', 'Rejected', 'Approved'].includes(x.status)).map(x => `[${as}] ${x.campaignName}/${x.organizationName}: ${x.statusName}${x.isClosed ? ' (kỳ đã kết thúc)' : ''}`));
    }
    expect(out, 'todo=true có dòng ngoài quy tắc BR-3').toEqual([]);
  });
  test(tc('RES-L07'), async () => {
    await hold('PendingApproval');
    await driveTo(await R('MI.DP'), 'PendingApproval');
    const out: string[] = [];
    for (const as of ['ldp', 'ldd']) {
      const rows = await lstAll({ todo: true }, as);
      expect(rows.length, `[${as}] phải có kết quả cần xử lý`).toBeGreaterThan(0);
      out.push(...rows.filter(x => x.isClosed || !['PendingApproval', 'Submitted'].includes(x.status)).map(x => `[${as}] ${x.campaignName}/${x.organizationName}: ${x.statusName}`));
    }
    expect(out, 'todo=true có dòng ngoài {Chờ duyệt, Đã gửi}').toEqual([]);
  });
  test(tc('RES-L08'), async () => {
    const f = await fx();
    for (const flt of [{}, { fullTextSearch: 'RES1 fixture' }, { campaignIds: [f.camp.BA] }, { campaignType: 'AdHoc', fullTextSearch: 'qc.automation' }]) {
      const s = await api('GET', `${RES}/summary?filter=${F(flt)}`, undefined, 'canbo');
      const l = await lst({ ...flt, todo: true });
      expect(s.data.todoCount, `summary.todoCount với bộ lọc ${JSON.stringify(flt)}`).toBe(l.totalElements);
    }
  });
  test(tc('RES-L09'), async ({ browser }) => {
    const { ctx, page } = await asRole(browser, 'ldp');
    try {
      await openList(page);
      await clickTab(page, 'Cần xử lý');
      await expect(page.getByText('Trạng thái tiến trình'), 'tab Cần xử lý không được có bộ lọc Thời hạn').toHaveCount(0);
      await clickTab(page, 'Tất cả');
      await expect(filterSelects(page).first(), 'tab khác phải có bộ lọc Thời hạn').toBeVisible();
    } finally { await ctx.close(); }
  });
  test(tc('RES-L10'), async ({ page }) => {
    await openList(page);
    await filterSelects(page).first().click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dd.waitFor({ state: 'visible' });
    const opts = (await dd.locator('.ant-select-item').allInnerTexts()).map(norm);
    expect(opts).toEqual(['Tất cả', 'Kỳ đang diễn ra', 'Kỳ đã kết thúc']);
  });
  test(tc('RES-L11'), async ({ page }) => {
    await openList(page);
    await clickTab(page, 'Tất cả');
    await expect(filterSelects(page).first(), 'Thời hạn mặc định phải là "Kỳ đang diễn ra"').toContainText(/kỳ đang diễn ra/i);
    for (const r of await rowsData(page)) expect(r.cells[3], `dòng "${nameOf(r.cells)}"`).not.toContain('Đã kết thúc');
  });
  test(tc('RES-L12'), async ({ page }) => {
    await openList(page);
    await setPhase(page, /đang diễn ra/i);
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.cells[3]).toMatch(/Còn \d+ ngày/);
    expect(await totalOf(page)).toBe((await lst({ campaignType: 'Periodic', phase: 'active' })).totalElements);
  });
  test(tc('RES-L13'), async ({ page }) => {
    await openList(page);
    await setPhase(page, /đã kết thúc/i);
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) { expect(r.cells[3]).toContain('Đã kết thúc'); expect(['Đã gửi', 'Chưa gửi']).toContain(statusOf(r.cells)); }
    expect(await totalOf(page)).toBe((await lst({ campaignType: 'Periodic', phase: 'closed' })).totalElements);
  });
  test(tc('RES-L14'), async ({ page }) => {
    for (const t of ['Periodic', 'AdHoc']) {
      const [all, act, clo] = await Promise.all(['all', 'active', 'closed'].map(ph => lst({ campaignType: t, phase: ph })));
      expect(all.totalElements, `${t}: Tất cả = đang diễn ra + đã kết thúc`).toBe(act.totalElements + clo.totalElements);
    }
    await openList(page);
    const ps = await lst({ campaignType: 'Periodic', phase: 'active' }), pc = await lst({ campaignType: 'Periodic', phase: 'closed' });
    expect(ps.totalElements, 'cần có cả dòng đang diễn ra').toBeGreaterThan(0); expect(pc.totalElements).toBeGreaterThan(0);
    expect(await totalOf(page)).toBe(ps.totalElements + pc.totalElements);
  });
  test(tc('RES-L15'), async ({ page }) => {
    await openList(page); await setPhase(page, /đang diễn ra/i);
    expect(tabsOnly(await tabNames(page))).toEqual([...ACTIVE7].sort());
  });
  test(tc('RES-L16'), async ({ page }) => {
    await openList(page); await setPhase(page, /đã kết thúc/i);
    expect(tabsOnly(await tabNames(page))).toEqual(['Tất cả', 'Đã gửi', 'Chưa gửi'].sort());
  });
  test(tc('RES-L17'), async ({ page }) => {
    await openList(page);
    expect(tabsOnly(await tabNames(page))).toEqual([...ACTIVE7, 'Chưa gửi'].sort());
  });
  const TABS: [string, string][] = [['L18', 'Chưa thực hiện'], ['L19', 'Đang chấm điểm'], ['L20', 'Chờ duyệt'], ['L21', 'Bị từ chối'], ['L22', 'Đã phê duyệt'], ['L23', 'Đã gửi'], ['L24', 'Chờ mở khóa'], ['L25', 'Chưa gửi']];
  for (const [id, name] of TABS) test(tc(`RES-${id}`), async ({ page }) => {
    const key = ST_BY_NAME[name];
    if (HOLD[key]) await hold(key);
    await openList(page); await setSegment(page, 'Đột xuất');
    await clickTab(page, name);
    const rows = await rowsData(page);
    if (HOLD[key] || key === 'NotStarted') expect(rows.length, `cần có dữ liệu "${name}"`).toBeGreaterThan(0);
    for (const r of rows) expect(statusOf(r.cells), `dòng "${nameOf(r.cells)}"`).toBe(name);
    expect(await totalOf(page)).toBe((await lst({ campaignType: 'AdHoc', phase: 'all', status: key })).totalElements);
  });
  test(tc('RES-L26'), async ({ page }) => {
    await openList(page);
    const bad: string[] = [];
    for (const n of tabsOnly(await tabNames(page))) {
      await clickTab(page, n);
      const onTab = await tabCount(page, n), total = await totalOf(page);
      if (onTab !== total) bad.push(`${n}: tab=${onTab}, bảng=${total}`);
    }
    expect(bad).toEqual([]);
  });
  test(tc('RES-L27'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    const kw = 'RES1 fixture MI';
    await search(page, kw);
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(nameOf(r.cells).toLowerCase()).toContain(kw.toLowerCase());
    const total = await totalOf(page);
    expect(total).toBe((await lst({ campaignType: 'AdHoc', phase: 'all', fullTextSearch: kw })).totalElements);
    expect(await tabCount(page, 'Tất cả'), 'số trên tab Tất cả cập nhật theo từ khóa').toBe(total);
  });
  test(tc('RES-L28'), async ({ page }) => {
    await openList(page);
    await expect(searchBox(page)).toHaveAttribute('placeholder', 'Tìm theo tên kỳ');
  });
  test(tc('RES-L29'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    await search(page, 'QC.AUTOMATION'); const a = await totalOf(page);
    await search(page, 'qc.automation'); const b = await totalOf(page);
    expect(a).toBeGreaterThan(0); expect(b).toBe(a);
  });
  test(tc('RES-L30'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    await search(page, 'Ban Dân tộc'); const withAccent = await totalOf(page);
    await search(page, 'ban dan toc'); const without = await totalOf(page);
    expect(withAccent).toBeGreaterThan(0);
    expect(without, 'tìm không dấu phải cho cùng kết quả').toBe(withAccent);
  });
  test(tc('RES-L31'), async ({ page }) => {
    await openList(page);
    await search(page, 'zzqcxx_khongtontai_999');
    expect(await dataRows(page).count()).toBe(0);
    await expect(content(page)).toContainText('Không tìm thấy kết quả phù hợp');
  });
  test(tc('RES-L32'), async ({ page }) => {
    await openList(page);
    const empty = (await tabNames(page)).find(async () => false);
    let target = '';
    for (const n of tabsOnly(await tabNames(page)).filter(x => x !== 'Tất cả')) if ((await tabCount(page, n)) === 0) { target = n; break; }
    test.skip(!target, 'Không có tab trạng thái nào rỗng ở dữ liệu hiện tại');
    await clickTab(page, target);
    expect(await dataRows(page).count()).toBe(0);
    await expect(content(page), `tab rỗng "${target}"`).toContainText('Chưa có dữ liệu');
  });
  test(tc('RES-L33'), async ({ page }) => {
    await openList(page);
    await search(page, 'a'.repeat(255));
    expect((await searchBox(page).inputValue()).length).toBe(255);
    await expect(page.locator('.ant-message-notice-error')).toHaveCount(0);
    await searchBox(page).fill('b'.repeat(256)); await settle(page, 500);
    expect((await searchBox(page).inputValue()).length, 'từ khóa 256 ký tự phải bị chặn/cắt ở 255').toBeLessThanOrEqual(255);
  });
  test(tc('RES-L34'), async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', d => { dialogSeen = true; d.dismiss().catch(() => {}); });
    await openList(page); const all = await totalOf(page);
    for (const bad of ["' OR 1=1 --", '<script>alert(1)</script>']) {
      await search(page, bad);
      expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/internal server error|exception|stack ?trace|sql/);
      expect(await totalOf(page), `"${bad}" không được trả toàn bộ dữ liệu`).toBeLessThan(all);
    }
    expect(dialogSeen, 'không được thực thi script').toBeFalsy();
  });
  test(tc('RES-L35'), async ({ page }) => {
    await openList(page); const all = await totalOf(page);
    await search(page, '%');
    expect(await totalOf(page), '"%" không được khớp mọi bản ghi').toBeLessThan(all);
    await search(page, '_');
    const rows = await rowsData(page);
    for (const r of rows) expect(r.text, '"_" chỉ khớp bản ghi có dấu gạch dưới').toContain('_');
  });
  test(tc('RES-L36'), async ({ page }) => {
    await openList(page); const n0 = await totalOf(page);
    await search(page, 'RES1');
    await searchBox(page).fill(''); await settle(page, 900);
    expect(await totalOf(page)).toBe(n0);
  });
  const pickCamp = async (page: Page, re: RegExp) => {
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    if (!(await dd.count())) { await filterSelects(page).nth(1).click(); await dd.last().waitFor({ state: 'visible' }); }
    const opt = dd.last().locator('.ant-select-item-option', { hasText: re }).first();
    for (let i = 0; i < 40 && !(await opt.count()); i++) { await dd.last().locator('.rc-virtual-list-holder').evaluate(e => { e.scrollTop += 150; }).catch(() => {}); await page.waitForTimeout(150); }   // danh sách ảo: cuộn tới khi option được vẽ
    await opt.click();
    await page.waitForTimeout(500);
  };
  test(tc('RES-L37'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    await pickCamp(page, /RES1 fixture MI/); await page.keyboard.press('Escape'); await settle(page);
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(nameOf(r.cells)).toBe('qc.automation RES1 fixture MI');
  });
  test(tc('RES-L38'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    await pickCamp(page, /RES1 fixture MI/); await pickCamp(page, /RES1 fixture BA/); await page.keyboard.press('Escape'); await settle(page);
    const names = new Set((await rowsData(page)).map(r => nameOf(r.cells)));
    expect([...names].sort(), 'chọn kỳ MI rồi kỳ BA: danh sách phải gồm kết quả của cả hai kỳ').toEqual(['qc.automation RES1 fixture BA', 'qc.automation RES1 fixture MI']);
  });
  test(tc('RES-L39'), async ({ page }) => {
    for (const t of ['Periodic', 'AdHoc']) {
      const opts = ((await api('GET', `${RES}/campaign-options?campaignType=${t}`, undefined, 'cbdp')).data ?? []) as any[];
      const own = new Set((await lstAll({ campaignType: t, phase: 'all' }, 'cbdp')).map(x => x.campaignId));
      expect(opts.every(o => own.has(o.id ?? o.campaignId ?? o.value)), `[cbdp] campaign-options ${t} chỉ gồm kỳ có kết quả của đơn vị mình`).toBeTruthy();
    }
    await openList(page, '?campaignType=AdHoc&phase=all');
    await pickCamp(page, /RES1 fixture MI/); await page.keyboard.press('Escape'); await settle(page);
    await setSegment(page, 'Định kỳ');
    await expect(filterSelects(page).nth(1), 'đổi loại kỳ thì lựa chọn kỳ cũ bị xóa').not.toContainText('RES1 fixture MI');
  });
  test(tc('RES-L40'), async ({ page, browser }) => {
    await openList(page);
    const unit = (p: Page) => p.locator('.ant-select').filter({ hasText: /^\s*đơn vị/i });
    await expect(unit(page), 'Toàn hệ thống: phải có bộ lọc Đơn vị').toHaveCount(1);
    const { ctx, page: lp } = await asRole(browser, 'ldp');
    try { await openList(lp); await expect(unit(lp), 'phạm vi Đơn vị: không có bộ lọc Đơn vị').toHaveCount(0); } finally { await ctx.close(); }
  });
  test(tc('RES-L41'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    const sel = page.locator('.ant-select').filter({ hasText: /^\s*đơn vị/i });
    await expect(sel, 'cần có bộ lọc Đơn vị').toHaveCount(1);
    await pickOption(page, sel.first(), /qc.automation RES1 ĐV A/); await settle(page);
    for (const r of await rowsData(page)) expect(r.cells[2]).toContain('ĐV A');
  });
  test(tc('RES-L42'), async ({ page }) => {
    await openList(page); await setPhase(page, /đã kết thúc/i); await clickTab(page, 'Đã gửi');
    const first = (await rowsData(page))[0];
    expect(first, 'cần có dữ liệu Đã gửi/kỳ kết thúc').toBeTruthy();
    const kw = nameOf(first.cells).split(' ').slice(0, 2).join(' ');
    await search(page, kw);
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) { expect(r.text.toLowerCase()).toContain(kw.toLowerCase()); expect(statusOf(r.cells)).toBe('Đã gửi'); expect(r.cells[3]).toContain('Đã kết thúc'); }
    expect(await totalOf(page)).toBe((await lst({ campaignType: 'Periodic', phase: 'closed', status: 'Submitted', fullTextSearch: kw })).totalElements);
  });
  test(tc('RES-L43'), async ({ page }) => {
    await openList(page);
    const n = await totalOf(page);
    expect(await dataRows(page).count()).toBe(Math.min(10, n));
    await expect(page.locator('.ant-pagination').first()).toContainText(/Hiển thị 1-10 trong \d+ bản ghi/);
    if (n > 10) await expect(page.locator('.ant-pagination-item-2')).toBeVisible();
  });
  test(tc('RES-L44'), async ({ page }) => {
    await openList(page);
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    const p1 = (await rowsData(page)).map(r => r.text).join('|');
    await page.locator('.ant-pagination-item-2').click(); await settle(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    expect((await rowsData(page)).map(r => r.text).join('|')).not.toBe(p1);
    await expect(page.locator('.ant-pagination').first()).toContainText(/Hiển thị 11-/);
    await page.locator('.ant-pagination-prev').click(); await settle(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('1');
    await page.locator('.ant-pagination-next').click(); await settle(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
  });
  test(tc('RES-L45'), async ({ page }) => {
    await openList(page);
    const n = await totalOf(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await pickOption(page, page.locator(PAGER_SEL).first(), '20'); await settle(page);
    expect(await dataRows(page).count()).toBe(Math.min(20, n));
    expect(await totalOf(page)).toBe(n);
  });
  test(tc('RES-L46'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    await search(page, 'qc.automation');
    const n = await totalOf(page);
    test.skip(n <= 10, 'Từ khóa có ≤10 kết quả');
    await page.locator('.ant-pagination-item-2').click(); await settle(page);
    for (const r of await rowsData(page)) expect(r.text.toLowerCase()).toContain('qc.automation');
    expect(await totalOf(page)).toBe(n);
  });
  test(tc('RES-L47'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    await page.locator('.ant-pagination-item-2').click(); await settle(page);
    await search(page, 'qc.automation');
    expect(await dataRows(page).count(), 'không được hiển thị trang trống').toBeGreaterThan(0);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('1');
  });
  test(tc('RES-L48'), async ({ page }) => {
    await openList(page);
    await search(page, 'Tự đánh giá'); await clickTab(page, 'Đã gửi');
    await setSegment(page, 'Đột xuất');
    expect(await searchBox(page).inputValue(), 'từ khóa phải giữ').toBe('Tự đánh giá');
    await expect(page.getByRole('tab', { name: /^Đã gửi/ })).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).toContain('campaignType=AdHoc');
    for (const r of await rowsData(page)) expect(statusOf(r.cells)).toBe('Đã gửi');
  });
  test(tc('RES-L49'), async ({ page }) => {
    await openList(page);
    const seg = page.locator('.ant-segmented').first(), ex = page.getByRole('button', { name: 'Xuất Excel' });
    const sb = (await seg.boundingBox())!, eb = (await ex.boundingBox())!;
    expect(norm(await seg.innerText()), 'nút không được kèm số lượng').not.toMatch(/\d/);
    expect(sb.x + sb.width, 'Định kỳ/Đột xuất nằm bên trái Xuất Excel').toBeLessThanOrEqual(eb.x);
    expect(Math.abs(sb.y - eb.y), 'cùng hàng đầu trang').toBeLessThan(60);
  });
  test(tc('RES-L50'), async ({ page }) => {
    const per = await lstAll({ campaignType: 'Periodic', phase: 'all' }), adh = await lstAll({ campaignType: 'AdHoc', phase: 'all' });
    const ids = new Set(per.map(x => x.campaignId));
    expect(adh.filter(x => ids.has(x.campaignId)).length, 'hai tập kỳ rời nhau').toBe(0);
    expect(per.every(x => x.campaignType === 'Periodic') && adh.every(x => x.campaignType === 'AdHoc')).toBeTruthy();
    await openList(page); expect(await totalOf(page)).toBe(per.length);
    await setSegment(page, 'Đột xuất'); expect(await totalOf(page)).toBe(adh.length);
  });
  test(tc('RES-L51'), async ({ page }) => {
    await openList(page); await setPhase(page, /đang diễn ra/i);
    const rows = await rowsData(page), api1 = await lst({ campaignType: 'Periodic', phase: 'active' });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const a = (api1.content as any[]).find(x => x.campaignName === nameOf(r.cells) && r.cells[2].includes(x.organizationName))!;
      const [d, rest] = r.cells[3].split('\n').map(s => s.trim());
      expect(d).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(rest, `"${nameOf(r.cells)}"`).toBe(`Còn ${a.daysRemaining} ngày`);
    }
  });
  test(tc('RES-L52'), async ({ page }) => {
    await openList(page); await setPhase(page, /đã kết thúc/i);
    const rows = await rowsData(page); expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.cells[3].split('\n').map(s => s.trim())[1]).toBe('Đã kết thúc');
  });
  test(tc('RES-L53'), async ({ page }) => {
    const row = await findRowOf(page, 'RES1 fixture TZ', orgName('A'));
    await expect(row.locator('td').nth(3), 'Hạn nộp của kỳ chọn ngày kết thúc 31/12/2026 (gửi 2026-12-30T17:00Z) phải là 31/12/2026').toContainText('31/12/2026');
  });
  test(tc('RES-L54'), async ({ page }) => {
    await hold('Submitted');
    await openList(page, '?campaignType=AdHoc&phase=all'); await clickTab(page, 'Đã gửi');
    const rows = (await rowsData(page)).filter(r => !r.cells[5].startsWith('—') && !r.cells[5].startsWith('-'));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(norm(r.cells[5]), `"${nameOf(r.cells)}"`).toMatch(/^\d+ \/ \d+$/);
  });
  test(tc('RES-L55'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all'); await clickTab(page, 'Chưa thực hiện');
    const rows = await rowsData(page); expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(norm(r.cells[5]), `"${nameOf(r.cells)}"`).toMatch(/^[-–—]$/);
  });
  test(tc('RES-L56'), async ({ page }) => {
    await partialMB();
    const row = await findRowOf(page, 'RES1 fixture MB', orgName('A'));
    const cell = norm(await row.locator('td').nth(4).innerText());
    const m = cell.match(/^(\d+)\/(\d+) chỉ số (\d+)%/); expect(m, cell).toBeTruthy();
    expect(Number(m![3])).toBe(Math.round(Number(m![1]) * 100 / Number(m![2])));
    expect(Number(m![1])).toBeGreaterThan(0); expect(Number(m![1])).toBeLessThan(Number(m![2]));
    await expect(row.locator('td').nth(4).locator('.ant-progress, [role=progressbar], [class*=progress]').first()).toBeVisible();
  });
  test(tc('RES-L57'), async () => {
    const all = [...await lstAll({ campaignType: 'Periodic', phase: 'all' }), ...await lstAll({ campaignType: 'AdHoc', phase: 'all' })];
    const bad = all.filter(x => x.scoredCount > x.indicatorCount);
    expect(bad.map(x => `${x.campaignName}/${x.organizationName}: ${x.scoredCount}/${x.indicatorCount} chỉ số`), 'dòng có x > y').toEqual([]);
  });
  test(tc('RES-L58'), async () => { test.skip(true, 'Manual — hệ thống không có sẵn bộ chỉ số có chỉ số "Không tính điểm"; tạo mới thuộc phân hệ B và bộ đã khóa không xóa được'); });
  test(tc('RES-L59'), async ({ page }) => {
    await openList(page); await clickTab(page, 'Tất cả');
    const rows = await rowsData(page), api1 = await lst({ campaignType: 'Periodic', phase: 'all' });
    for (const r of rows) {
      expect(Object.values(ST), `chip "${statusOf(r.cells)}"`).toContain(statusOf(r.cells));
      const a = (api1.content as any[]).find(x => x.campaignName === nameOf(r.cells) && r.cells[2].includes(x.organizationName));
      if (a) expect(statusOf(r.cells)).toBe(a.statusName);
    }
  });
  test(tc('RES-L60'), async ({ page }) => {
    await openList(page);
    const bad: string[] = [];
    for (const row of await dataRows(page).all()) {
      const t = norm(await row.innerText()); const btns = await row.locator('button').count();
      if (!/Xem chi tiết/.test(t) || btns < 2) bad.push(`${t.slice(0, 50)} (nút: ${btns})`);
    }
    expect(bad, 'mọi dòng phải có "Xem chi tiết" kèm mũi tên xuống').toEqual([]);
  });
  test(tc('RES-L61'), async ({ page }) => {
    const row = await findRowOf(page, 'RES1 fixture MB', orgName('B'));
    await row.getByRole('button', { name: 'Xem chi tiết' }).click(); await settle(page, 500);
    const dd = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item');
    expect(await dd.count(), `bấm "Xem chi tiết" phải bung menu (URL hiện tại: ${page.url()})`).toBeGreaterThan(0);
    expect(norm(await dd.first().innerText())).toBe('Xem');
  });
  const menuTest = async (page: Page, org: string, camp: string, expectItems: string[]) => {
    const row = await findRowOf(page, camp, orgName(org));
    const items = await rowMenu(page, row);
    for (const w of expectItems) expect(items, `menu thực tế: ${items.join(' | ')}`).toContain(w);
  };
  test(tc('RES-L62'), async ({ page }) => { await menuTest(page, 'B', 'RES1 fixture MB', ['Xem', 'Chấm điểm', 'Trình duyệt']); });
  test(tc('RES-L63'), async ({ page }) => { await hold('Scoring'); await menuTest(page, 'B', 'RES1 fixture BA', ['Xem', 'Chấm điểm', 'Trình duyệt']); });
  test(tc('RES-L64'), async ({ page }) => { await hold('Rejected'); await menuTest(page, 'D', 'RES1 fixture BA', ['Xem', 'Chấm điểm', 'Trình duyệt']); });
  test(tc('RES-L65'), async ({ page }) => { await hold('PendingApproval'); await menuTest(page, 'C', 'RES1 fixture BA', ['Xem', 'Phê duyệt', 'Từ chối']); });
  test(tc('RES-L66'), async ({ page }) => { await hold('Approved'); await menuTest(page, 'E', 'RES1 fixture BA', ['Xem', 'Gửi Bộ']); });
  test(tc('RES-L67'), async ({ page }) => { await hold('Submitted'); await menuTest(page, 'F', 'RES1 fixture BA', ['Xem', 'Xin mở khóa']); });
  test(tc('RES-L68'), async ({ page }) => {
    const bad: string[] = [];
    for (const as of ['canbo', 'ldd', 'lanhdaobo']) {
      const rows = (await lstAll({ campaignType: 'Periodic', phase: 'closed', status: 'Submitted' }, as));
      expect(rows.length).toBeGreaterThan(0);
      for (const x of rows) for (const a of x.allowedActions as string[]) if (!['export', 'view'].includes(a)) bad.push(`[${as}] ${x.campaignName}/${x.organizationName}: ${a}`);
    }
    expect(bad, 'Đã gửi của kỳ đã kết thúc chỉ được Xem/Xuất Excel').toEqual([]);
    await openList(page); await setPhase(page, /đã kết thúc/i); await clickTab(page, 'Đã gửi');
    const items = await rowMenu(page, dataRows(page).first());
    for (const x of items) expect(x, `menu: ${items.join(' | ')}`).not.toMatch(/xin mở khóa|chấm|gửi bộ|trình duyệt/i);
  });
  test(tc('RES-L69'), async () => {
    await driveTo(await R('MI.DP'), 'UnlockRequested');
    const bad: string[] = [];
    for (const as of ['cbdp', 'ldp']) {
      const rows = (await lstAll({ phase: 'all' }, as)).filter(x => ['UnlockRequested', 'NotSent'].includes(x.status));
      expect(rows.some(x => x.status === 'UnlockRequested') && rows.some(x => x.status === 'NotSent'), `[${as}] cần dữ liệu Chờ mở khóa và Chưa gửi`).toBeTruthy();
      for (const x of rows) for (const a of x.allowedActions as string[]) if (!['export', 'view'].includes(a)) bad.push(`[${as}] ${x.statusName}: ${a}`);
    }
    expect(bad, 'Chờ mở khóa/Chưa gửi chỉ có Xem ở vai trò đơn vị').toEqual([]);
  });
  test(tc('RES-L70'), async ({ browser }) => {
    await hold('PendingApproval');
    const bad: string[] = [];
    for (const x of await lstAll({ phase: 'all' }, 'ldd')) for (const a of x.allowedActions as string[]) if (['score', 'submit', 'send'].includes(a)) bad.push(`[ldd] ${x.campaignName}/${x.organizationName}: ${a}`);
    for (const x of await lstAll({ phase: 'all' }, 'cbdp')) for (const a of x.allowedActions as string[]) if (['approve', 'reject'].includes(a)) bad.push(`[cbdp] ${x.campaignName}/${x.organizationName}: ${a}`);
    expect(bad.slice(0, 10)).toEqual([]);
    const { ctx, page } = await asRole(browser, 'ldd');
    try {
      const row = await findRowOf(page, 'RES1 fixture BA', orgName('C'));
      for (const it of await rowMenu(page, row)) expect(it).not.toMatch(/chấm|trình duyệt|gửi bộ/i);
    } finally { await ctx.close(); }
  });
  test(tc('RES-L71'), async ({ page }) => {
    const row = await findRowOf(page, 'RES1 fixture MB', orgName('B'));
    const id = await R('MB.B');
    const items = await rowMenu(page, row);
    await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: /bắt đầu chấm|tiếp tục chấm|chấm điểm/i }).first().click();
    await page.waitForURL(new RegExp(`assessment-results/${id}`), { timeout: 8000 });
    await expect(page.locator('.ant-input-number-input').first(), 'màn hình chấm điểm có ô nhập điểm').toBeVisible();
    await page.goBack(); await settle(page);
    expect(items, `mục "Xem" phải có trong menu: ${items.join(' | ')}`).toContain('Xem');
  });
  test(tc('RES-L72'), async ({ page }) => {
    await openList(page);
    const { file, name } = await downloadTo(page, () => page.getByRole('button', { name: 'Xuất Excel' }).click());
    expect(name).toBe('danh-sach-ket-qua-tu-danh-gia.xlsx');
    const rows = xlsxRows(file);
    expect(rows.length, 'file phải có dữ liệu').toBeGreaterThan(1);
  });
  test(tc('RES-L73'), async ({ page }) => {
    await hold('Submitted');
    await openList(page); await setSegment(page, 'Đột xuất'); await clickTab(page, 'Đã gửi'); await search(page, 'RES1 fixture BA');
    const total = await totalOf(page); expect(total).toBeGreaterThan(0);
    const { file } = await downloadTo(page, () => page.getByRole('button', { name: 'Xuất Excel' }).click());
    const rows = xlsxRows(file);
    const hdr = rows.findIndex(r => r.some(c => /trạng thái/i.test(c)));
    const data = rows.slice(hdr + 1).filter(r => r.some(c => c));
    expect(data.length, 'số dòng dữ liệu trong file = tổng bản ghi của bộ lọc').toBe(total);
    for (const r of data) { expect(r.join('|')).toContain('RES1 fixture BA'); expect(r.join('|')).toContain('Đã gửi'); }
  });
  test(tc('RES-L74'), async ({ page }) => {
    await openList(page);
    const { file } = await downloadTo(page, () => page.getByRole('button', { name: 'Xuất Excel' }).click());
    const head = xlsxRows(file).find(r => r.some(c => /trạng thái/i.test(c))) ?? [];
    const h = head.map(c => c.toLowerCase());
    for (const w of ['stt', 'kỳ đánh giá', 'đơn vị', 'bộ chỉ số', 'hạn nộp', 'tiến độ chấm', 'điểm', 'trạng thái']) expect(h, `tiêu đề file: ${head.join(' | ')}`).toContain(w);
  });
  test(tc('RES-L75'), async ({ page }) => {
    await hold('Submitted');
    await openList(page); await setSegment(page, 'Đột xuất'); await clickTab(page, 'Đã gửi');
    const { file } = await downloadTo(page, () => page.getByRole('button', { name: 'Xuất Excel' }).click());
    const head = (xlsxRows(file).find(r => r.some(c => /trạng thái/i.test(c))) ?? []).map(c => c.toLowerCase());
    expect(head, `tiêu đề file: ${head.join(' | ')}`).toContain('xếp loại');
    expect(head.some(c => /điểm xếp hạng/.test(c))).toBeTruthy();
  });
  test(tc('RES-L76'), async ({ page }) => {
    await openList(page); await search(page, 'zzqcxx_khongtontai_999');
    let downloaded = false; page.on('download', () => { downloaded = true; });
    await page.getByRole('button', { name: 'Xuất Excel' }).click();
    await expect(page.locator('.ant-message-notice, .ant-notification-notice').last()).toContainText('Không có dữ liệu để xuất');
    expect(downloaded).toBeFalsy();
  });
  test(tc('RES-L77'), async ({ page }) => {
    await openList(page);
    await mockExport(page, 500, { status: 500, message: 'Internal Server Error' });
    let downloaded = false; page.on('download', () => { downloaded = true; });
    await page.getByRole('button', { name: 'Xuất Excel' }).click();
    await expect(page.locator('.ant-message-notice, .ant-notification-notice').last()).toContainText('Xuất dữ liệu thất bại. Vui lòng thử lại');
    expect(downloaded).toBeFalsy();
    expect(await page.locator('body').innerText()).not.toMatch(/stack ?trace|exception/i);
    expect(page.url()).toContain('assessment-results');
  });
  test(tc('RES-L78'), async ({ page }) => {
    await openList(page);
    const { file } = await downloadTo(page, () => page.getByRole('button', { name: 'Xuất Excel' }).click());
    const rows = xlsxRows(file); const hdr = rows.findIndex(r => r.some(c => /trạng thái/i.test(c)));
    const adh = new Set((await lstAll({ campaignType: 'AdHoc', phase: 'all' })).map(x => x.campaignName));
    const per = new Set((await lstAll({ campaignType: 'Periodic', phase: 'all' })).map(x => x.campaignName));
    const onlyAdhoc = [...adh].filter(n => !per.has(n));
    const data = rows.slice(hdr + 1).filter(r => r.some(c => c));
    expect(data.length).toBeGreaterThan(0);
    for (const r of data) expect(onlyAdhoc.some(n => r.includes(n)), `dòng kỳ đột xuất trong file Định kỳ: ${r.join('|').slice(0, 80)}`).toBeFalsy();
  });
  test(tc('RES-L79'), async ({ page }) => {
    await hold('Submitted'); await driveTo(await R('MB.BO'), 'Submitted');
    const all = [...await lstAll({ campaignType: 'Periodic', phase: 'all' }), ...await lstAll({ campaignType: 'AdHoc', phase: 'all' })];
    const bad: string[] = [];
    for (const x of all) {
      const has = x.levelName != null;
      if (['Submitted', 'UnlockRequested'].includes(x.status) && x.maxScore > 0 && x.score > 0 && !has) bad.push(`${x.campaignName}/${x.organizationName}: ${x.statusName} thiếu xếp loại`);
      if (!['Submitted', 'UnlockRequested'].includes(x.status) && has) bad.push(`${x.campaignName}/${x.organizationName}: ${x.statusName} lại có xếp loại ${x.levelName}`);
    }
    expect(bad.slice(0, 8)).toEqual([]);
    await openList(page, '?campaignType=AdHoc&phase=all');
    expect(await headsOf(page), 'giao diện phải có cột Xếp loại').toContain('xếp loại');
  });
  test(tc('RES-L80'), async () => {
    const all = [...await lstAll({ campaignType: 'Periodic', phase: 'all' }), ...await lstAll({ campaignType: 'AdHoc', phase: 'all' })]
      .filter(x => ['Submitted', 'UnlockRequested'].includes(x.status) && x.score != null && x.maxScore > 0);
    expect(all.length).toBeGreaterThan(0);
    const bad = all.filter(x => Math.abs(x.rankingPercent - Math.round(x.score * 10000 / x.maxScore) / 100) > 0.005);
    expect(bad.map(x => `${x.campaignName}/${x.organizationName}: ${x.score}/${x.maxScore} → ${x.rankingPercent}`)).toEqual([]);
  });
  test(tc('RES-L81'), async () => {
    needWrite();
    test.setTimeout(150_000);
    const id = await R('MB.BO');
    const exp: [number, string][] = [[40, 'Trung bình'], [60, 'Khá'], [80, 'Tốt'], [90, 'Xuất sắc'], [100, 'Xuất sắc']];
    const bad: string[] = [];
    for (const [pct, level] of exp) {
      await driveTo(id, 'Scoring');
      const d = await getRes(id), L = leaves(d), k = Math.round(L.length * pct / 100);
      const r = await saveScores(id, L.map((i, n) => sc(i, n < k ? Math.min(2, i.maxScore) : 0)));
      expect(r.status, r.message).toBe(200);
      await driveTo(id, 'Submitted');
      const g = await getRes(id);
      if (g.rankingPercent !== pct || g.levelName !== level) bad.push(`${pct}%: rankingPercent=${g.rankingPercent}, mức=${g.levelName} (kỳ vọng ${level})`);
    }
    expect(bad).toEqual([]);
  });
  test(tc('RES-L82'), async () => {
    const f = { campaignType: 'AdHoc', phase: 'all' };
    const g = async (sort: string) => ((await api('GET', `${RES}?page=1&size=10&filter=${F(f)}&sort=${sort}`, undefined, 'canbo')).data.content as any[]).map(x => x.id);
    const a = await g('-createdOnDate'), b = await g('-createdOnDate'), asc = await g('createdOnDate');
    expect(b, 'thứ tự ổn định giữa hai lần gọi').toEqual(a);
    expect(asc, 'tham số sort=createdOnDate (tăng dần) phải khác sort=-createdOnDate').not.toEqual(a);
  });
  test(tc('RES-L83'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    await expect(page.locator('.ant-segmented-item-selected')).toContainText('Đột xuất');
    expect(await totalOf(page)).toBe((await lst({ campaignType: 'AdHoc', phase: 'all' })).totalElements);
  });
  test(tc('RES-L84'), async ({ page }) => {
    await openList(page); await setSegment(page, 'Đột xuất'); await search(page, 'RES1 fixture');
    const t = await totalOf(page);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page);
    await expect(page.locator('.ant-segmented-item-selected')).toContainText('Đột xuất');
    expect(await searchBox(page).inputValue()).toBe('RES1 fixture');
    expect(await totalOf(page)).toBe(t);
  });
});

// ================================================================ V — CHI TIẾT
const idCell = (p: Page, code: string) => p.locator('tr', { hasText: code }).last();
test.describe('Kết quả tự đánh giá › Chi tiết', () => {
  test(tc('RES-V01'), async ({ page }) => {
    await hold('Scoring');
    const row = await findRowOf(page, 'RES1 fixture BA', orgName('B'));
    await row.getByRole('button', { name: 'Xem chi tiết' }).click();
    await page.waitForURL(/assessment-results\/[0-9a-f-]{36}/); await settle(page);
    const t = await bodyText(page), d = await getRes(await R('BA.B'));
    expect(t).toContain(d.campaignName); expect(t).toContain(d.statusName); expect(t).toContain(d.organizationName);
    expect(t).toMatch(/Hạn nộp: \d{2}\/\d{2}\/\d{4} \(Còn \d+ ngày\)/);
  });
  test(tc('RES-V02'), async ({ page }) => {
    const id = await R('MI.A'), d = await getRes(id);
    await openDetail(page, id);
    const t = await bodyText(page);
    expect(t).toContain(`Đơn vị thực hiện ${d.organizationName}`);
    expect(t).toContain('Phân loại Đột xuất');
    expect(t).toContain(`Bộ chỉ số áp dụng ${d.indicatorSetName}`);
    expect(t).toMatch(/Thời gian thực hiện \d{2}\/\d{2}\/\d{4} [–-] \d{2}\/\d{2}\/\d{4}/);
    const block = page.locator('.ant-card, section, div').filter({ hasText: /^Thông tin chung/ }).last();
    expect(await block.locator('input:visible').count(), 'khối Thông tin chung chỉ xem').toBe(0);
  });
  test(tc('RES-V03'), async ({ page }) => {
    const id = await R('MB.A'), d0 = await getRes(id);
    if (leaves(d0).length - unscored(d0).length < 2) await saveMerge(id, unscored(d0).slice(0, 2).map(i => sc(i, 1)));
    const d = await getRes(id);
    await openDetail(page, id);
    const t = await bodyText(page);
    expect(t).toContain(`TIẾN ĐỘ CHẤM ${d.scoredCount} / ${d.indicatorCount}`);
    expect(t).toContain(`ĐIỂM TẠM TÍNH ${d.score} / ${d.maxScore}`);
    expect(t).toContain(`Đạt ${(d.score * 100 / d.maxScore).toFixed(1)}% điểm tối đa`);
    expect(t).toContain(`MINH CHỨNG ${d.indicatorsWithAttachment} / ${d.indicatorCount} chỉ số`);
    expect(t).toContain(`${d.attachmentCount} tệp tài liệu đã đính kèm`);
  });
  test(tc('RES-V04'), async ({ page }) => {
    const id = await R('MI.A'), d = await getRes(id);
    await openDetail(page, id);
    for (const i of leaves(d)) {
      const row = norm(await idCell(page, i.indicatorCode).innerText());
      expect(row, `chỉ số ${i.indicatorCode}`).toContain(i.indicatorName);
      expect(row).toContain(`Điểm tối đa: ${i.maxScore}`);
      if (i.weight !== 1) expect(row).toContain(`Trọng số: ${i.weight}`);
    }
  });
  test(tc('RES-V05'), async ({ page }) => {
    const id = await R('MB.A'), d = await getRes(id);
    await openDetail(page, id);
    const t = await bodyText(page);
    for (const g of d.groups as any[]) {
      const seg = t.slice(t.indexOf(g.indicatorGroupName));
      expect(seg, `nhóm ${g.indicatorGroupName}`).toContain(`${g.scoredCount}/${g.indicatorCount} đã chấm`);
      expect(seg).toContain(`Điểm nhóm: ${g.score} / ${g.maxScore}`);
    }
  });
  test(tc('RES-V06'), async ({ page }) => {
    const id = await R('MI.A'), d = await getRes(id);
    await openDetail(page, id);
    const t = await bodyText(page);
    expect(t, 'phải có dòng Trụ cột').toContain(d.pillars[0].pillarName);
    const parent = (d.indicators as any[]).find(i => !i.isLeaf)!;
    expect(t, 'phải có dòng chỉ số cha').toContain(parent.indicatorCode);
    await expect(idCell(page, parent.indicatorCode).locator('.ant-table-row-expand-icon, [class*=expand], svg').first(), 'chỉ số cha có mũi tên đóng/mở').toBeVisible();
  });
  test(tc('RES-V07'), async ({ page }) => {
    const id = await R('MI.A'), d = await getRes(id);
    await openDetail(page, id);
    for (const i of leaves(d)) expect(norm(await idCell(page, i.indicatorCode).innerText()), `chỉ số ${i.indicatorCode}`).toContain(`(${i.minScore}-${i.maxScore})`);
  });
  test(tc('RES-V08'), async ({ page }) => {
    const id = await R('MI.A'); await driveTo(id, 'Scoring');
    await saveMerge(id, [sc(leaves(await getRes(id))[0], 6)]);
    await openDetail(page, id);
    const heads = (await page.locator('thead th').allInnerTexts()).map(s => norm(s).toLowerCase());
    expect(heads, `các cột: ${heads.join(' | ')}`).toContain('đánh giá');
    expect(await bodyText(page)).toMatch(/Đạt|Chưa đạt/);
  });
  test(tc('RES-V09'), async () => {
    needWrite();
    const id = await R('BA.A'); await driveTo(id, 'Scoring');
    const ind = leaves(await getRes(id))[0];
    expect((await saveMerge(id, [sc(ind, 3)])).status).toBe(200);
    expect((await getRes(id)).indicators.find((i: any) => i.indicatorSetIndicatorId === ind.indicatorSetIndicatorId).resultScore, '3 × trọng số 2').toBe(6);
    await saveMerge(id, [sc(ind, 8)]);
    expect((await getRes(id)).indicators.find((i: any) => i.indicatorSetIndicatorId === ind.indicatorSetIndicatorId).resultScore, 'bị chặn ở điểm tối đa 8').toBe(8);
    await saveMerge(id, [sc(ind, 3)]);
  });
  test(tc('RES-V10'), async () => { test.skip(true, 'Manual — hệ thống không có sẵn bộ chỉ số có chỉ số Không tính điểm để kiểm chứng; tạo mới thuộc phân hệ B và bộ đã khóa không xóa được'); });
  test(tc('RES-V11'), async () => {
    const bad: string[] = [];
    for (const k of ['MI.A', 'BA.A', 'MB.BO']) {
      const d = await getRes(await R(k)), L = leaves(d);
      for (const g of d.groups as any[]) {
        const sum = L.filter(i => i.indicatorGroupId === g.indicatorGroupId).reduce((a, i) => a + (i.resultScore ?? 0), 0);
        if (g.score !== sum) bad.push(`${k} nhóm ${g.indicatorGroupName}: score=${g.score}, Σ resultScore=${sum}`);
      }
      const tot = (d.groups as any[]).reduce((a, g) => a + g.score, 0);
      if (d.score !== tot && !(d.score == null && tot === 0)) bad.push(`${k}: score=${d.score}, Σ nhóm=${tot}`);
      const mx = L.reduce((a, i) => a + i.maxScore, 0);
      if (d.maxScore !== mx) bad.push(`${k}: maxScore=${d.maxScore}, Σ điểm tối đa chỉ số con=${mx}`);
    }
    expect(bad).toEqual([]);
  });
  test(tc('RES-V12'), async ({ page }) => {
    const id = await R('MI.A');
    const row = await findRowOf(page, 'RES1 fixture MI', orgName('A'));
    const prog = norm(await row.locator('td').nth(4).innerText()).match(/^(\d+)\/(\d+)/)!, score = norm(await row.locator('td').nth(5).innerText());
    await row.getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForURL(new RegExp(id)); await settle(page);
    const t = await bodyText(page);
    expect(t).toContain(`TIẾN ĐỘ CHẤM ${prog[1]} / ${prog[2]}`);
    expect(t).toContain(`ĐIỂM TẠM TÍNH ${score}`);
  });
  test(tc('RES-V13'), async ({ page }) => {
    const id = await R('PAST.A');
    await openDetail(page, id);
    expect(await page.locator('.ant-input-number-input:visible').count(), 'không có ô nhập điểm').toBe(0);
    for (const b of ['Chỉnh sửa', 'Lưu nháp', 'Trình duyệt']) await expect(page.getByRole('button', { name: b })).toHaveCount(0);
    expect(await bodyText(page)).toContain('Đã kết thúc');
  });
  test(tc('RES-V14'), async ({ browser }) => {
    const id = await hold('Scoring');
    const { ctx, page } = await asRole(browser, 'ldd');   // theo bước kiểm thử: đăng nhập Lãnh đạo đơn vị
    try {
      await openDetail(page, id);
      expect(await page.locator('.ant-input-number-input:visible, textarea:visible, input[type=file]').count(), 'không có ô nhập điểm/giải trình/đính kèm').toBe(0);
      for (const b of ['Lưu nháp', 'Trình duyệt', 'Tải file', 'Đính kèm']) await expect(page.getByRole('button', { name: b })).toHaveCount(0);
    } finally { await ctx.close(); }
  });
  test(tc('RES-V15'), async ({ page }) => {
    const id = await hold('Submitted');
    const h = (await api('GET', `${RES}/${id}/history`, undefined, 'canbo')).data as any[];
    await openDetail(page, id);
    const tabTxt = norm(await page.getByRole('tab', { name: /^Lịch sử/ }).innerText());
    expect(tabTxt).toContain(`(${h.length})`);
    await page.getByRole('tab', { name: /^Lịch sử/ }).click(); await settle(page, 400);
    const all = await bodyText(page), panel = all.slice(Math.max(all.indexOf('Lịch sử thao tác'), 0));
    const t = panel;
    const stamps = panel.match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/g) ?? [];
    expect(stamps.length).toBe(h.length);
    expect(h.map(x => x.at), 'mới nhất trước').toEqual([...h.map(x => x.at)].sort().reverse());
    for (const x of h.slice(0, 3)) { expect(t).toContain(x.actionName); expect(t).toContain(x.actorName); }
  });
  test(tc('RES-V16'), async ({ page }) => {
    await hold('Submitted');
    await openList(page); await setSegment(page, 'Đột xuất'); await clickTab(page, 'Đã gửi');
    await page.locator('tbody tr.ant-table-row').first().getByRole('button', { name: 'Xem chi tiết' }).click();
    await page.waitForURL(/assessment-results\/[0-9a-f-]{36}/); await settle(page);
    await content(page).locator('button').first().click(); await settle(page);
    expect(page.url()).toContain('campaignType=AdHoc');
    await expect(page.getByRole('tab', { name: /^Đã gửi/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.ant-segmented-item-selected')).toContainText('Đột xuất');
  });
  test(tc('RES-V17'), async ({ page }) => {
    const r = await api('GET', `${RES}/${FAKE}`, undefined, 'canbo');
    expect(r.status).toBe(404); expect(r.message).toContain('Không tìm thấy kết quả tự đánh giá');
    await page.goto(`${ROUTE}/${FAKE}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const t = await page.locator('body').innerText();
    expect(t).toMatch(/404/); expect(t).toContain('Không tìm thấy nội dung');
    expect(t.toLowerCase()).not.toMatch(/stack ?trace|exception|at com\./);
  });
  test(tc('RES-V18'), async () => {
    for (const x of ['abc', encodeURIComponent("1' OR '1'='1"), encodeURIComponent('<script>')]) {
      const r = await api('GET', `${RES}/${x}`, undefined, 'canbo');
      expect([400, 404], `GET ${x} → ${r.status} ${r.message}`).toContain(r.status);
      expect(JSON.stringify(r.raw).toLowerCase()).not.toMatch(/exception|stacktrace|entityframework|npgsql|sql/);
    }
  });
  test(tc('RES-V19'), async ({ page }) => {
    const id = await R('MI.A'), d = await getRes(id);
    await openDetail(page, id);
    const box = page.getByPlaceholder('Tìm mã hoặc tên chỉ số...');
    const L = leaves(d), a = L[1];
    await box.fill(a.indicatorCode.toLowerCase()); await settle(page, 500);
    expect(await idCell(page, a.indicatorCode).count()).toBeGreaterThan(0);
    for (const o of L.filter(i => i !== a)) await expect(page.locator('tbody tr', { hasText: o.indicatorCode }), `chỉ số ${o.indicatorCode} phải ẩn`).toHaveCount(0);
    await box.fill(L[2].indicatorName.slice(-10).toUpperCase()); await settle(page, 500);
    expect(await page.locator('tbody tr', { hasText: L[2].indicatorCode }).count()).toBeGreaterThan(0);
    const mb = await getRes(await R('MB.A')); await openDetail(page, await R('MB.A'));
    await box.fill(leaves(mb)[0].indicatorCode); await settle(page, 600);
    expect(await page.getByText(/^\d+\/\d+ đã chấm$/).count(), 'nhóm không còn chỉ số phải ẩn').toBe(1);
  });
  test(tc('RES-V20'), async ({ page }) => {
    const id = await R('BA.A'), d = await getRes(id);
    await openDetail(page, id);
    const { name } = await downloadTo(page, () => page.getByRole('button', { name: 'Xuất Excel' }).last().click());
    expect(name).toMatch(/^cham-diem-.+\.xlsx$/);
    expect(name.toLowerCase()).toContain('res1-fixture-ba');
  });
  test(tc('RES-V21'), async ({ page }) => {
    needWrite();
    const id = await R('BA.A'); await driveTo(id, 'Scoring');
    const ind = leaves(await getRes(id))[0];
    await saveMerge(id, [sc(ind, 3, { note: 'qc note V21' })]);
    await openDetail(page, id);
    const { file } = await downloadTo(page, () => page.getByRole('button', { name: 'Xuất Excel' }).last().click());
    const rows = xlsxRows(file), head = rows.find(r => r.includes('Mã'))!;
    const line = rows.find(r => r.includes(ind.indicatorCode))!;
    expect(line, 'file phải có dòng của chỉ số').toBeTruthy();
    for (const col of ['Mã', 'Chỉ số', 'Điểm tối đa', 'Trọng số', 'Điểm', 'Điểm kết quả', 'Giải trình']) expect(head, `tiêu đề: ${head.join(' | ')}`).toContain(col);
    expect(line.join('|')).toContain('qc note V21');
  });
  test(tc('RES-V22'), async () => {
    const r = await api('GET', `${RES}/${FAKE}/export`, undefined, 'canbo');
    expect(r.status).toBe(404); expect(r.message).toContain('Không tìm thấy kết quả tự đánh giá');
  });
  test(tc('RES-V23'), async ({ page }) => {
    const id = await R('MB.A'), d = await getRes(id);
    await openDetail(page, id);
    expect(norm(await page.getByRole('tab', { name: /^Chấm điểm/ }).innerText())).toBe(`Chấm điểm (${d.scoredCount}/${d.indicatorCount})`);
    expect(d.indicatorCount).toBe(leaves(d).length);
  });
  test(tc('RES-V24'), async ({ page }) => {
    const id = await R('MB.A'), d = await getRes(id);
    await openDetail(page, id);
    const groups = page.getByText(/^\d+\/\d+ đã chấm$/);
    const n = await groups.count(); expect(n).toBe((d.groups as any[]).length);
    const gname = (d.groups as any[])[0].indicatorGroupName;
    const gsel = page.locator('.ant-select').first();   // ô "Nhóm chỉ số" (sau khi chọn, nhãn đổi nên định vị theo vị trí)
    await pickOption(page, gsel, gname); await settle(page, 500);
    expect(await groups.count(), 'chỉ còn nhóm đã chọn').toBe(1);
    await gsel.hover(); await gsel.locator('.ant-select-clear').click(); await settle(page, 500);
    expect(await groups.count(), 'bỏ chọn thì hiện tất cả').toBe(n);
  });
});

// ================================================================ S — CHẤM ĐIỂM, MINH CHỨNG
const sIn = (p: Page, code: string) => idCell(p, code).locator('.ant-input-number-input');
const nIn = (p: Page, code: string) => idCell(p, code).locator('input[placeholder^="Nhập giải trình"]');
const fIn = (p: Page, code: string) => idCell(p, code).locator('input[type=file]');
const chipA = (p: Page, code: string, re: RegExp | string) => idCell(p, code).locator('a', { hasText: re });
const DRAFT = (p: Page) => p.getByRole('button', { name: 'Lưu nháp' });
const lastToast = async (p: Page, wait = 5000) => {
  const t = p.locator('.ant-message-notice, .ant-notification-notice').last();
  await t.waitFor({ timeout: wait }).catch(() => {});
  return norm(await t.innerText({ timeout: 1500 }).catch(() => ''));
};
async function setScore(p: Page, code: string, v: string | number) { const i = sIn(p, code); await i.click(); await i.fill(String(v)); await i.blur(); await p.waitForTimeout(250); }
async function saveDraft(p: Page) { await DRAFT(p).click(); const t = await lastToast(p); await settle(p, 500); return t; }
async function ensureEditable(id: string) {
  const st = (await getRes(id)).status;
  if (['PendingApproval', 'Approved', 'Submitted', 'UnlockRequested'].includes(st)) await driveTo(id, 'Scoring');
  return id;
}
const ind = async (id: string, code?: string) => { const d = await getRes(id); return code ? d.indicators.find((i: any) => i.indicatorCode === code) : leaves(d)[0]; };
const clearFiles = async (id: string) => { const d = await getRes(id); await saveScores(id, leaves(d).filter(i => i.score != null).map(i => ({ indicatorSetIndicatorId: i.indicatorSetIndicatorId, score: i.score, note: i.note, attachmentIds: [] }))); };
function mkZip(files: Record<string, string>) {
  const parts: Buffer[] = [], cd: Buffer[] = []; let off = 0;
  for (const [name, data] of Object.entries(files)) {
    const nb = Buffer.from(name), db = Buffer.from(data), crc = zlib.crc32(db);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(db.length, 18); lh.writeUInt32LE(db.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(db.length, 20); ch.writeUInt32LE(db.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nb, db); cd.push(ch, nb); off += 30 + nb.length + db.length;
  }
  const cdb = Buffer.concat(cd), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(cd.length / 2, 8); end.writeUInt16LE(cd.length / 2, 10); end.writeUInt32LE(cdb.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdb, end]);
}
const OLE = Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.alloc(2048)]);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const SAMPLE: Record<string, { mime: string; buffer: Buffer }> = {
  pdf: { mime: 'application/pdf', buffer: PDF }, doc: { mime: 'application/msword', buffer: OLE }, xls: { mime: 'application/vnd.ms-excel', buffer: OLE },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: mkZip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': '<w:document/>' }) },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: mkZip({ '[Content_Types].xml': '<Types/>', 'xl/workbook.xml': '<workbook/>' }) },
  jpg: { mime: 'image/jpeg', buffer: JPG }, png: { mime: 'image/png', buffer: PNG },
};
const fileOf = (name: string, ext = name.split('.').pop()!.toLowerCase()) => ({ name, mimeType: SAMPLE[ext]?.mime ?? 'application/octet-stream', buffer: SAMPLE[ext]?.buffer ?? Buffer.from('x') });
const MSG_FMT = 'Tệp không đúng định dạng. Chỉ chấp nhận PDF, DOC, DOCX, XLS, XLSX, JPG, PNG';
const MSG_060 = 'Không thể chấm điểm khi kết quả không ở trạng thái cho phép chỉnh sửa';
const uniq = () => Math.floor(Date.now() / 1000) % 1000;
/** Mở màn chấm điểm của kết quả (đảm bảo đang cho sửa) và trả về mã chỉ số đầu tiên. */
async function openScoring(page: Page, key: string) {
  const id = await ensureEditable(await R(key));
  await openDetail(page, id);
  return { id, code: (leaves(await getRes(id))[0]).indicatorCode as string };
}
const BAC = 'BA-TEST-I1';

const chip = (p: Page, code: string, re: RegExp | string) => idCell(p, code).locator('.ant-tag', { hasText: re });
const chipX = (p: Page, code: string, re: RegExp | string) => chip(p, code, re).locator('[aria-label="Đóng"], .anticon-close').first();
async function attach(p: Page, code: string, f: { name: string; mimeType: string; buffer: Buffer }, ms = 1500) { await fIn(p, code).setInputFiles(f); await settle(p, ms); }
/** Mở chấm điểm kết quả BA.A với chỉ số đã có điểm và không còn tệp, để thử đính kèm. */
async function evidenceBase(page: Page, key = 'BA.A') {
  const T0 = Date.now(), dbg = (m: string) => { if (process.env.QC_DEBUG) console.log(`[evBase +${Date.now() - T0}ms] ${m}`); };
  const id = await ensureEditable(await R(key)); dbg('ensureEditable'); await scoreAll(id); dbg('scoreAll'); await clearFiles(id); dbg('clearFiles');
  await openDetail(page, id); dbg('openDetail'); const code = leaves(await getRes(id))[0].indicatorCode as string;
  return { id, code };
}

test.describe('Kết quả tự đánh giá › Chấm điểm và minh chứng', () => {
  test(tc('RES-S01'), async ({ page }) => {
    await openDetail(page, await R('MBns'));
    const code = leaves(await getRes(await R('MBns')))[0].indicatorCode;
    await expect(sIn(page, code)).toBeVisible(); await expect(nIn(page, code)).toBeVisible(); await expect(fIn(page, code)).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Tải file' }).first()).toBeVisible();
    await expect(DRAFT(page)).toBeVisible(); await expect(page.getByRole('button', { name: 'Trình duyệt' })).toBeVisible();
  });
  test(tc('RES-S02'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A'); const v = (uniq() % 6) + 1;
    await setScore(page, BAC, v);
    expect(await saveDraft(page)).toContain('Lưu thành công');
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
    expect(Number(await sIn(page, BAC).inputValue())).toBe(v);
    expect((await ind(id, code)).score).toBe(v);
  });
  test(tc('RES-S03'), async ({ page }) => {
    needWrite();
    const id = await takeNS(); expect((await getRes(id)).status).toBe('NotStarted');
    await openDetail(page, id);
    await setScore(page, BAC, 3); await saveDraft(page);
    expect((await getRes(id)).status).toBe('Scoring');
    await page.reload({ waitUntil: 'networkidle' }); await expect(page.getByText('Đang chấm điểm').first()).toBeVisible();
  });
  test(tc('RES-S04'), async ({ page }) => {
    needWrite();
    const { id } = await openScoring(page, 'BA.A'); await driveTo(id, 'Scoring');
    await setScore(page, BAC, (uniq() % 6) + 1); await saveDraft(page);
    expect((await getRes(id)).status).toBe('Scoring');
  });
  test(tc('RES-S05'), async ({ page }) => {
    needWrite();
    const { id } = await openScoring(page, 'BA.A'); const before = ((await api('GET', `${RES}/${id}/history`, undefined, 'canbo')).data as any[]).length;
    await setScore(page, BAC, (uniq() % 3) + 1); await saveDraft(page);
    await setScore(page, BAC, (uniq() % 3) + 4); await saveDraft(page);
    const h = (await api('GET', `${RES}/${id}/history`, undefined, 'canbo')).data as any[];
    expect(h.length - before, `lịch sử phải ghi thêm 2 hành động "Lưu nháp": ${h.slice(0, 3).map(x => x.actionName).join(', ')}`).toBeGreaterThanOrEqual(2);
    expect(h.slice(0, 2).every(x => /lưu nháp/i.test(x.actionName))).toBeTruthy();
  });
  test(tc('RES-S06'), async ({ page }) => {
    needWrite();
    const id = await partialMB(), d = await getRes(id), x = unscored(d)[0];
    const c0 = d.scoredCount;
    await openDetail(page, id);
    await setScore(page, x.indicatorCode, 1);
    const t = await saveDraft(page); expect(t, 'Lưu nháp một phần (các chỉ số khác để trống) phải thành công').toMatch(/thành công/i);
    const g = await getRes(id);
    expect(g.scoredCount).toBe(c0 + 1); expect(g.scoredCount).toBeLessThan(g.indicatorCount);
  });
  test(tc('RES-S07'), async ({ page }) => {
    needWrite();
    const id = await R('MBns'); await openDetail(page, id);
    const t = await saveDraft(page);
    expect(t, `Lưu nháp khi mọi ô trống phải thành công, thực tế: "${t}"`).toMatch(/thành công/i);
  });
  test(tc('RES-S08'), async ({ page }) => {
    needWrite();
    const id = await partialMB(), d = await getRes(id), [x, y] = unscored(d);
    await openDetail(page, id); await setScore(page, x.indicatorCode, 2);
    expect(await saveDraft(page), 'Lưu nháp khi còn chỉ số để trống').toMatch(/thành công/i);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
    expect(await sIn(page, y.indicatorCode).inputValue(), 'ô để trống không được thành 0').toBe('');
    expect((await ind(id, y.indicatorCode)).score).toBeNull();
    expect((await ind(id, x.indicatorCode)).score).toBe(2);
  });
  test(tc('RES-S09'), async ({ page }) => {
    needWrite();
    const id = await partialMB(), d = await getRes(id), x = leaves(d).find(i => i.score != null);
    const c0 = d.scoredCount;
    await openDetail(page, id);
    await sIn(page, x!.indicatorCode).fill(''); await sIn(page, x!.indicatorCode).blur();
    const t = await saveDraft(page);
    expect(t, 'xóa điểm rồi Lưu nháp phải thành công').toMatch(/thành công/i);
    const g = await getRes(id);
    expect((await ind(id, x!.indicatorCode)).score, `xóa điểm rồi Lưu nháp (toast: "${t}")`).toBeNull();
    expect(g.scoredCount).toBe(c0 - 1);
  });
  test(tc('RES-S10'), async ({ page }) => {
    const { code } = await openScoring(page, 'BA.A');
    await sIn(page, code).fill('-1'); await sIn(page, code).blur(); await page.waitForTimeout(500);
    expect(await bodyText(page), 'phải báo lỗi dưới ô khi nhập số âm').toContain('Điểm phải lớn hơn hoặc bằng 0');
  });
  test(tc('RES-S11'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A'); const before = (await ind(id, code)).score;
    await sIn(page, code).fill('2.5'); await sIn(page, code).blur(); await page.waitForTimeout(500);
    const msg = await bodyText(page);
    await DRAFT(page).click({ trial: false }).catch(() => {});
    await page.waitForTimeout(1200);
    expect(msg, 'phải báo "Điểm phải là số nguyên" dưới ô').toContain('Điểm phải là số nguyên');
    expect((await ind(id, code)).score, 'không được lưu 2.5').toBe(before);
  });
  test(tc('RES-S12'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')), i = await ind(id);
    await saveMerge(id, [sc(i, 3)]);
    const r = await saveScores(id, [sc(i, -1)]);
    expect(r.status).toBe(400); expect(r.message).toMatch(new RegExp(`Điểm chỉ số ${i.indicatorCode} phải lớn hơn hoặc bằng 0`));
    expect((await ind(id)).score).toBe(3);
  });
  test(tc('RES-S13'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')), i = await ind(id);
    await saveMerge(id, [sc(i, 3)]);
    for (const v of [2.5, 2.55]) {
      const r = await saveScores(id, [sc(i, v)]);
      expect(r.status, `score ${v}`).toBe(400); expect(r.message).toMatch(/phải là số nguyên/);
    }
    expect((await ind(id)).score).toBe(3);
  });
  test(tc('RES-S14'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A');
    await setScore(page, code, 0); expect(await saveDraft(page)).toMatch(/thành công/i);
    const y = await ind(id, code), g = await getRes(id);
    expect(y.score).toBe(0); expect(y.resultScore).toBe(0);
    expect(g.scoredCount, 'điểm 0 vẫn tính là đã chấm (không phải để trống)').toBe(g.indicatorCount);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
    expect(await bodyText(page)).toContain(`TIẾN ĐỘ CHẤM ${g.indicatorCount} / ${g.indicatorCount}`);
  });
  test(tc('RES-S15'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A');
    await setScore(page, code, 9); await saveDraft(page);
    const y = await ind(id, code);
    expect(y.score, 'điểm chấm 9 > tối đa 8 vẫn phải được lưu').toBe(9); expect(y.resultScore).toBe(8);
  });
  test(tc('RES-S16'), async ({ page }) => {
    needWrite();
    const id = await ensureEditable(await R('MI.B')); await scoreAll(id); await openDetail(page, id);
    await setScore(page, 'QCARES1I1', 8); expect(await saveDraft(page)).toMatch(/thành công/i);
    const y = await ind(id, 'QCARES1I1');
    expect(y.score).toBe(8); expect(y.resultScore).toBe(8); expect(y.isPassed).toBe(true);
  });
  test(tc('RES-S17'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')), i = await ind(id);
    expect((await saveMerge(id, [sc(i, 3)])).status).toBe(200);
    expect((await ind(id)).resultScore, '3 × trọng số 2').toBe(6);
  });
  test(tc('RES-S18'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')), i = await ind(id);
    expect((await saveMerge(id, [sc(i, 5)])).status).toBe(200);
    expect((await ind(id)).resultScore, '5 × 2 = 10 bị chặn ở tối đa 8').toBe(8);
  });
  test(tc('RES-S19'), async ({ page }) => {
    const { id, code } = await openScoring(page, 'BA.A');
    const puts: string[] = []; page.on('request', r => { if (r.method() === 'PUT' && r.url().includes('/scores')) puts.push(r.url()); });
    await setScore(page, code, 2); await page.waitForTimeout(500);
    const t = await bodyText(page);
    expect(t).toContain('Điểm nhóm: 4 / 8'); expect(t).toContain('ĐIỂM TẠM TÍNH 4 / 8'); expect(t).toContain('Đạt 50.0% điểm tối đa');
    expect(puts, 'chưa được gọi API lưu').toEqual([]);
  });
  test(tc('RES-S20'), async ({ page }) => {
    const id = await partialMB(), d = await getRes(id), x = unscored(d)[0];
    await openDetail(page, id); const c0 = d.scoredCount, n = d.indicatorCount;
    await setScore(page, x.indicatorCode, 1);
    expect(await bodyText(page)).toContain(`TIẾN ĐỘ CHẤM ${c0 + 1} / ${n}`);
    await sIn(page, x.indicatorCode).fill(''); await sIn(page, x.indicatorCode).blur(); await page.waitForTimeout(300);
    const t = await bodyText(page);
    expect(t).toContain(`TIẾN ĐỘ CHẤM ${c0} / ${n}`); expect(t).toMatch(/Còn thiếu \d+ chỉ số bắt buộc|Còn \d+ chỉ số bắt buộc/);
  });
  test(tc('RES-S21'), async () => {
    needWrite();
    const id = await ensureEditable(await R('MI.B')), c1 = await ind(id, 'QCARES1I1');
    await saveMerge(id, [sc(c1, 4)]); expect((await ind(id, 'QCARES1I1')).isPassed, 'kết quả 4 < tối thiểu 5').toBe(false);
    await saveMerge(id, [sc(c1, 6)]); expect((await ind(id, 'QCARES1I1')).isPassed, 'kết quả 6 ≥ 5').toBe(true);
  });
  test(tc('RES-S22'), async () => {
    needWrite();
    const id = await ensureEditable(await R('MI.B')), c1 = await ind(id, 'QCARES1I1');
    await saveMerge(id, [sc(c1, 5)]);
    const y = await ind(id, 'QCARES1I1'); expect(y.resultScore).toBe(5); expect(y.isPassed, 'bằng điểm tối thiểu là Đạt').toBe(true);
  });
  test(tc('RES-S23'), async ({ page }) => {
    needWrite();
    const id = await ensureEditable(await R('MI.B')); await scoreAll(id); await openDetail(page, id);
    await setScore(page, 'QCARES1I1', 2);
    expect(await sIn(page, 'QCARES1I1').inputValue(), 'ô nhập không được ép lên điểm tối thiểu 5').toMatch(/^2(\.0)?$/);
    const t = await saveDraft(page); expect(t).toMatch(/thành công/i);
    const y = await ind(id, 'QCARES1I1'); expect(y.score).toBe(2); expect(y.isPassed).toBe(false);
  });
  test(tc('RES-S24'), async ({ page }) => {
    const { code } = await openScoring(page, 'BA.A');
    for (const v of ['abc', '1e3', '--5']) {
      await sIn(page, code).fill(''); await sIn(page, code).pressSequentially(v); await sIn(page, code).blur(); await page.waitForTimeout(300);
      const val = await sIn(page, code).inputValue();
      expect(val, `gõ "${v}" → "${val}"`).toMatch(/^\d*(\.\d+)?$/);
      expect(val, `"${v}" không được hiểu thành số lớn`).not.toBe('8.0');
    }
  });
  test(tc('RES-S25'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A');
    await sIn(page, code).fill(''); await sIn(page, code).pressSequentially('007'); await sIn(page, code).blur(); await saveDraft(page);
    expect((await ind(id, code)).score).toBe(7);
  });
  test(tc('RES-S26'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')), i = await ind(id);
    const r = await saveScores(id, [sc(i, 1_000_000_000)]);
    expect(r.status, `HTTP ${r.status}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    expect(JSON.stringify(r.raw)).not.toMatch(/Stacktrace|EntityFramework|Npgsql|at .*\.cs/i);
  });
  test(tc('RES-S27'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')), i = await ind(id); await saveMerge(id, [sc(i, 3)]);
    for (const v of ['abc', null]) {
      const r = await saveScores(id, [{ indicatorSetIndicatorId: i.indicatorSetIndicatorId, score: v }]);
      expect(r.status, `score=${JSON.stringify(v)} (${r.message})`).toBe(400);
    }
    expect((await ind(id)).score).toBe(3);
  });
  test(tc('RES-S28'), async ({ page }) => {
    const id = await ensureEditable(await R('MI.B')), d = await getRes(id);
    const parent = (d.indicators as any[]).find(i => !i.isLeaf)!;
    await openDetail(page, id);
    const row = idCell(page, parent.indicatorCode);
    expect(await row.count(), 'phải có dòng chỉ số cha').toBeGreaterThan(0);
    expect(await row.locator('.ant-input-number-input').count(), 'chỉ số cha không có ô nhập').toBe(0);
    expect(await sIn(page, 'QCARES1I1').count(), 'chỉ số con có ô nhập').toBe(1);
  });
  test(tc('RES-S29'), async () => {
    needWrite();
    const id = await ensureEditable(await R('MI.B')), d = await getRes(id), L = leaves(d);
    await saveMerge(id, [sc(L[0], 6), sc(L[1], 5)]);
    const g = await getRes(id), parent = (g.indicators as any[]).find(i => !i.isLeaf)!;
    const sum = leaves(g).reduce((a, i) => a + (i.resultScore ?? 0), 0);
    expect(parent.resultScore, `điểm kết quả chỉ số cha (Σ con = ${sum})`).toBe(sum);
  });
  test(tc('RES-S30'), async () => {
    const d = await getRes(await R('MI.B')), parent = (d.indicators as any[]).find(i => !i.isLeaf)!;
    expect(parent.maxScore, 'điểm tối đa chỉ số cha = Σ điểm tối đa con (8+10+8), không nhân trọng số').toBe(leaves(d).reduce((a, i) => a + i.maxScore, 0));
  });
  test(tc('RES-S31'), async () => {
    const d = await getRes(await R('MI.B')), parent = (d.indicators as any[]).find(i => !i.isLeaf)!;
    expect(parent.isPassed ?? null).toBeNull();
  });
  const MAN = 'Manual — không có sẵn bộ chỉ số có chỉ số "Không tính điểm"; tạo/khóa bộ chỉ số thuộc phân hệ B và dữ liệu khóa không xóa được';
  for (const id of ['S32', 'S33', 'S34', 'S35']) test(tc(`RES-${id}`), async () => { test.skip(true, MAN); });
  test(tc('RES-S36'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A');
    await nIn(page, code).fill(''); await setScore(page, code, 3);
    expect(await saveDraft(page)).toMatch(/thành công/i);
    expect(((await ind(id, code)).note ?? '')).toBe('');
  });
  test(tc('RES-S37'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A'); const note = 'n'.repeat(255);
    await nIn(page, code).fill(note); await setScore(page, code, 3);
    expect(await saveDraft(page)).toMatch(/thành công/i);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
    expect((await nIn(page, code).inputValue()).length).toBe(255); expect((await ind(id, code)).note.length).toBe(255);
  });
  test(tc('RES-S38'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A'); const before = (await ind(id, code)).note;
    await nIn(page, code).fill('m'.repeat(256)); await setScore(page, code, 3); await page.waitForTimeout(400);
    const body = await bodyText(page);
    await saveDraft(page);
    expect(body, 'phải báo "Giải trình tối đa 255 ký tự"').toContain('Giải trình tối đa 255 ký tự');
    expect((await ind(id, code)).note, 'không được lưu').toBe(before);
  });
  test(tc('RES-S39'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')), i = await ind(id), before = i.note;
    const r = await saveScores(id, [sc(i, 3, { note: 'x'.repeat(256) })]);
    expect(r.status).toBe(400); expect(r.message).toContain('Giải trình tối đa 255 ký tự');
    expect((await ind(id)).note).toBe(before);
  });
  test(tc('RES-S40'), async ({ page }) => {
    needWrite();
    let dialogSeen = false; page.on('dialog', d => { dialogSeen = true; d.dismiss().catch(() => {}); });
    const { id, code } = await openScoring(page, 'BA.A'); const bad = '<script>alert(1)</script>';
    await nIn(page, code).fill(bad); await setScore(page, code, 3);
    const t = await saveDraft(page);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 600);
    expect(dialogSeen, 'không được thực thi script').toBeFalsy();
    const saved = (await ind(id, code)).note;
    expect(saved === bad || /thẻ HTML hoặc script/i.test(t), `lưu nguyên văn hoặc báo lỗi; toast="${t}", đã lưu="${saved}"`).toBeTruthy();
    if (saved !== bad) { expect(saved ?? '').not.toContain('<script'); }
  });
  test(tc('RES-S41'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A'); const note = 'Đã hoàn thành 100% – tài liệu #1 (bản 2) 😀';
    await nIn(page, code).fill(note); await setScore(page, code, 3); await saveDraft(page);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
    expect(await nIn(page, code).inputValue()).toBe(note); expect((await ind(id, code)).note).toBe(note);
  });
  test(tc('RES-S42'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A');
    await nIn(page, code).fill('     '); await setScore(page, code, 3);
    expect(await saveDraft(page)).toMatch(/thành công/i);
    expect(((await ind(id, code)).note ?? '').trim()).toBe('');
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
    expect((await nIn(page, code).inputValue()).trim()).toBe('');
  });

  // ---------------------------------------------------------------- Minh chứng
  const okExt = (ext: string, n: number) => test(tc(`RES-S${n}`), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page); const name = `qcauto${uniq()}.${ext}`;
    await attach(page, code, fileOf(name));
    await expect(chip(page, code, name), 'tệp phải hiện cạnh chỉ số').toBeVisible();
    expect(await saveDraft(page)).toMatch(/thành công/i);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    await expect(chip(page, code, name)).toBeVisible();
    expect(((await ind(id, code)).attachments as any[]).length).toBe(1);
  });
  okExt('pdf', 43); okExt('doc', 44); okExt('docx', 45); okExt('xls', 46); okExt('xlsx', 47); okExt('jpg', 48); okExt('png', 49);
  const rejectExt = (n: number, names: string[], mime = 'application/octet-stream', buf = Buffer.from('MZ')) => test(tc(`RES-S${n}`), async ({ page }) => {
    needWrite();
    const { code } = await evidenceBase(page);
    for (const name of names) {
      await fIn(page, code).setInputFiles({ name, mimeType: mime, buffer: buf });
      const t = await lastToast(page); await settle(page, 500);
      expect(await idCell(page, code).locator('.ant-tag').filter({ hasText: /\.|abc/ }).count(), `"${name}" không được đính kèm`).toBe(0);
      expect(t, `"${name}" phải báo lỗi định dạng, toast="${t}"`).toMatch(/định dạng|chấp nhận|không hợp lệ/i);
    }
  });
  test(tc('RES-S50'), async ({ page }) => {
    needWrite();
    const { code } = await evidenceBase(page);
    await fIn(page, code).setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    const t = await lastToast(page);
    expect(t, `MSG-046 "${MSG_FMT}"`).toContain(MSG_FMT);
    expect(await idCell(page, code).locator('.ant-tag').count()).toBe(0);
  });
  rejectExt(51, ['a.exe']); rejectExt(52, ['a.gif', 'a.html'], 'text/html', Buffer.from('<html/>'));
  rejectExt(53, ['abc'], 'application/pdf', PDF); rejectExt(54, ['a.pdf.exe'], 'application/pdf', PDF);
  test(tc('RES-S55'), async ({ page }) => {
    needWrite();
    const { code } = await evidenceBase(page);
    await fIn(page, code).setInputFiles({ name: 'qcfake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ\x90\x00\x03\x00\x00\x00 chương trình thực thi') });
    const t = await lastToast(page); await settle(page, 500);
    expect(await chip(page, code, 'qcfake.pdf').count(), `tệp "MZ…" đặt tên .pdf phải bị từ chối do nội dung không phải PDF (toast="${t}")`).toBe(0);
  });
  test(tc('RES-S56'), async ({ page }) => {
    needWrite(); test.setTimeout(120_000);
    const { code } = await evidenceBase(page);
    const buf = Buffer.concat([PDF, Buffer.alloc(20 * 1024 * 1024 - PDF.length, 32)]); expect(buf.length).toBe(20971520);
    await attach(page, code, { name: 'qc20mb.pdf', mimeType: 'application/pdf', buffer: buf }, 6000);
    await expect(chip(page, code, 'qc20mb.pdf'), 'tệp đúng 20 MB phải được nhận').toBeVisible({ timeout: 20_000 });
  });
  test(tc('RES-S57'), async ({ page }) => {
    needWrite(); test.setTimeout(120_000);
    const { code } = await evidenceBase(page);
    const buf = Buffer.concat([PDF, Buffer.alloc(20 * 1024 * 1024 + 1 - PDF.length, 32)]);
    await fIn(page, code).setInputFiles({ name: 'qc20mb1.pdf', mimeType: 'application/pdf', buffer: buf });
    const t = await lastToast(page); await settle(page, 1500);
    expect(t, `MSG-047 "Tệp vượt quá dung lượng 20 MB"; thực tế: "${t}"`).toContain('Tệp vượt quá dung lượng 20 MB');
    expect(await chip(page, code, 'qc20mb1.pdf').count()).toBe(0);
  });
  test(tc('RES-S58'), async ({ page }) => {
    needWrite();
    const { code } = await evidenceBase(page);
    await fIn(page, code).setInputFiles({ name: 'qcempty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
    const t = await lastToast(page); await settle(page, 800);
    expect(await chip(page, code, 'qcempty.pdf').count(), `tệp 0 byte phải bị từ chối (toast="${t}")`).toBe(0);
  });
  test(tc('RES-S59'), async ({ page }) => {
    needWrite();
    const { code } = await evidenceBase(page);
    const r = await upload('assessment_result_evidence', null, 'qcbroken.png', Buffer.from('không phải ảnh'), 'canbo', 'image/png');
    expect(r.status, `API không được trả 5xx, thực tế ${r.status}: ${r.message}`).toBeLessThan(500);
    expect(r.message).not.toMatch(/decoder|Image cannot be loaded/i);
    await fIn(page, code).setInputFiles({ name: 'qcbroken.png', mimeType: 'image/png', buffer: Buffer.from('không phải ảnh') });
    const t = await lastToast(page);
    expect(t).not.toMatch(/decoder|Image cannot be loaded/i);
    expect(t, 'báo lỗi tải tệp thân thiện (MSG-048)').toMatch(/lỗi tải tệp|không hợp lệ|định dạng/i);
    expect(await chip(page, code, 'qcbroken.png').count()).toBe(0);
  });
  test(tc('RES-S60'), async ({ page }) => {
    needWrite();
    const { code } = await evidenceBase(page); const name = 'd'.repeat(296) + '.pdf';
    const r = await upload('assessment_result_evidence', null, name, PDF);
    expect(r.status, `tên tệp dài không được gây 5xx: ${r.status} ${r.message}`).toBeLessThan(500);
    await fIn(page, code).setInputFiles({ name, mimeType: 'application/pdf', buffer: PDF });
    const t = await lastToast(page); await settle(page, 1200);
    const n = await idCell(page, code).locator('.ant-tag').count();
    expect(n === 1 || /tên tệp|giới hạn|tối đa/i.test(t), `đính kèm được hoặc báo giới hạn tên; toast="${t}", số tệp=${n}`).toBeTruthy();
    if (n === 1) expect((await idCell(page, code).locator('.ant-tag').boundingBox())!.width, 'tên dài phải được cắt gọn').toBeLessThan(600);
  });
  test(tc('RES-S61'), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page); const name = 'tài liệu minh chứng #1 (bản 2).pdf';
    await attach(page, code, fileOf(name));
    await expect(chip(page, code, name)).toBeVisible();
    expect(await saveDraft(page)).toMatch(/thành công/i);
    const a = ((await ind(id, code)).attachments as any[])[0];
    expect(a.fileName ?? a.name ?? a.originalFileName).toBe(name);
  });
  test(tc('RES-S62'), async ({ page }) => {
    needWrite();
    let dlg = false; page.on('dialog', d => { dlg = true; d.dismiss().catch(() => {}); });
    const { code } = await evidenceBase(page); const name = '<img src=x onerror=alert(1)>.pdf';
    await attach(page, code, fileOf(name));
    await page.waitForTimeout(800);
    expect(dlg, 'không được thực thi script').toBeFalsy();
    expect(await idCell(page, code).locator('img[src="x"]').count()).toBe(0);
    const t = await lastToast(page);
    expect((await idCell(page, code).innerText()).includes(name) || /định dạng|không hợp lệ/i.test(t), `tên hiển thị dạng văn bản (nguyên văn) hoặc bị từ chối; toast="${t}", ô minh chứng="${norm(await idCell(page, code).locator('.ant-tag').allInnerTexts().then(x => x.join('|')))}"`).toBeTruthy();
  });
  test(tc('RES-S63'), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page); const u = uniq();
    for (const n of [1, 2, 3]) await attach(page, code, fileOf(`qcev${u}n${n}.pdf`), 1200);
    expect(await saveDraft(page)).toMatch(/thành công/i);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    expect(await idCell(page, code).locator('.ant-tag').count()).toBe(3);
    expect(((await ind(id, code)).attachments as any[]).length).toBe(3);
    { const t = await bodyText(page); expect(t, `thẻ Minh chứng: "${/MINH CHỨNG.{0,60}đính kèm/.exec(t)?.[0]}"`).toMatch(/(^|\s)3 tệp tài liệu/); }
  });
  test(tc('RES-S64'), async ({ page }) => {
    needWrite(); test.setTimeout(240_000);
    const { code } = await evidenceBase(page); const u = uniq();
    const t1 = Date.now();
    for (let n = 1; n <= 20 && Date.now() - t1 < 150_000; n++) await fIn(page, code).setInputFiles(fileOf(`qcmany${u}n${n}.pdf`)).then(() => page.waitForTimeout(300));
    await settle(page, 1500);
    const n = await idCell(page, code).locator('.ant-tag').count(), t = await lastToast(page);
    expect(n === 20 || /giới hạn|tối đa/i.test(t), `đủ 20 tệp hoặc báo giới hạn rõ; số tệp=${n}, toast="${t}"`).toBeTruthy();
    await expect(DRAFT(page)).toBeVisible();
    await clearFiles(await R('BA.A'));
  });
  test(tc('RES-S65'), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page);
    await attach(page, code, fileOf('qcdup.pdf'), 1200); await attach(page, code, fileOf('qcdup.pdf'), 1200);
    const t = await lastToast(page);
    const n = await chip(page, code, 'qcdup.pdf').count();
    expect(n === 2 || /trùng/i.test(t), `hai tệp cùng tên: giữ cả hai hoặc báo trùng; số=${n}, toast="${t}"`).toBeTruthy();
    await saveDraft(page);
    expect(((await ind(id, code)).attachments as any[]).length, 'không ghi đè nhau').toBe(n);
  });
  test(tc('RES-S66'), async ({ page }) => {
    needWrite();
    const id = await ensureEditable(await R('MI.A')); await scoreAll(id); await clearFiles(id);
    const lv = leaves(await getRes(id)); const [a, b] = lv; const u = uniq();
    await openDetail(page, id);
    await attach(page, a.indicatorCode, fileOf(`qcx${u}.pdf`)); await attach(page, b.indicatorCode, fileOf(`qcy${u}.pdf`));
    expect(await saveDraft(page)).toMatch(/thành công/i);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    await expect(chip(page, a.indicatorCode, `qcx${u}`)).toBeVisible(); await expect(chip(page, a.indicatorCode, `qcy${u}`)).toHaveCount(0);
    await expect(chip(page, b.indicatorCode, `qcy${u}`)).toBeVisible(); await expect(chip(page, b.indicatorCode, `qcx${u}`)).toHaveCount(0);
  });
  test(tc('RES-S67'), async ({ page }) => {
    needWrite();
    const { code } = await evidenceBase(page);
    await setScore(page, code, 2); await nIn(page, code).fill('giữ nguyên');
    await page.route(/\/upload\/blob\//, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' }));
    await fIn(page, code).setInputFiles(fileOf('qcerr.pdf'));
    const t = await lastToast(page); await settle(page, 600);
    expect(t, 'MSG-048 lỗi tải tệp').toMatch(/lỗi tải tệp|tải tệp|tải lên/i);
    expect(await chip(page, code, 'qcerr.pdf').count()).toBe(0);
    expect(await nIn(page, code).inputValue()).toBe('giữ nguyên'); expect(await sIn(page, code).inputValue()).toBe('2');
  });
  test(tc('RES-S68'), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page);
    await attach(page, code, fileOf('qclink.pdf')); await saveDraft(page);
    const a = ((await ind(id, code)).attachments as any[])[0];
    const href = (await chip(page, code, 'qclink.pdf').locator('a').first().getAttribute('href')) ?? a.fileUrl;
    expect(a.fileUrl, 'fileUrl phải là địa chỉ truy cập được, không phải localhost').not.toMatch(/localhost|127\.0\.0\.1/);
    const r = await fetch(new URL(href, a.fileUrl).toString()).catch(() => null);
    expect(r?.status, `tải ${href}`).toBe(200);
  });
  test(tc('RES-S69'), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page);
    await attach(page, code, fileOf('qccount.pdf')); await saveDraft(page);
    const d = await getRes(id);
    expect(d.attachmentCount).toBe(1); expect(d.indicatorsWithAttachment).toBe(1);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    const t = await bodyText(page);
    expect(t).toContain(`MINH CHỨNG 1 / ${d.indicatorCount} chỉ số`); expect(t, `thẻ Minh chứng: "${/MINH CHỨNG.{0,60}đính kèm/.exec(t)?.[0]}" (API attachmentCount=${d.attachmentCount})`).toMatch(/(^|\s)1 tệp tài liệu đã đính kèm/);
  });
  const withFile = async (page: Page) => {
    const b = await evidenceBase(page); await attach(page, b.code, fileOf('qcdel.pdf')); await saveDraft(page);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500); return b;
  };
  test(tc('RES-S70'), async ({ page }) => {
    needWrite();
    const { code } = await withFile(page);
    await chipX(page, code, 'qcdel.pdf').click(); await page.waitForTimeout(600);
    await expect(page.getByText('Bạn có chắc chắn muốn xóa tệp minh chứng?'), 'MSG-006 hộp xác nhận xóa tệp').toBeVisible({ timeout: 3000 });
  });
  const confirmOk = async (p: Page) => { const b = p.getByRole('button', { name: /Đồng ý|Xóa|OK/ }).last(); if (await b.isVisible().catch(() => false)) await b.click(); };
  test(tc('RES-S71'), async ({ page }) => {
    needWrite();
    const { id, code } = await withFile(page);
    await chipX(page, code, 'qcdel.pdf').click(); await confirmOk(page);
    const t = await lastToast(page);
    expect(t, `MSG-002 "Xóa thành công"; thực tế: "${t}"`).toContain('Xóa thành công');
    await expect(chip(page, code, 'qcdel.pdf')).toHaveCount(0);
    await saveDraft(page);
    expect(((await ind(id, code)).attachments as any[]).length).toBe(0);
  });
  test(tc('RES-S72'), async ({ page }) => {
    needWrite();
    const { id, code } = await withFile(page);
    await chipX(page, code, 'qcdel.pdf').click(); await page.waitForTimeout(500);
    const cancel = page.getByRole('button', { name: /^(Hủy|Không|Đóng)$/ }).last();
    expect(await cancel.isVisible().catch(() => false), 'phải có hộp xác nhận với nút Hủy').toBeTruthy();
    await cancel.click(); await page.waitForTimeout(400);
    await expect(chip(page, code, 'qcdel.pdf')).toBeVisible();
    expect(((await ind(id, code)).attachments as any[]).length).toBe(1);
  });
  test(tc('RES-S73'), async ({ page }) => {
    needWrite();
    const { id, code } = await withFile(page);
    await chipX(page, code, 'qcdel.pdf').click(); await confirmOk(page); await settle(page, 800);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    expect(await chip(page, code, 'qcdel.pdf').count(), 'xóa tệp phải có hiệu lực ngay sau xác nhận, không cần Lưu nháp').toBe(0);
    expect(((await ind(id, code)).attachments as any[]).length).toBe(0);
  });
  test(tc('RES-S74'), async ({ page }) => {
    needWrite();
    const { id, code } = await withFile(page);
    await chipX(page, code, 'qcdel.pdf').click(); await confirmOk(page); await saveDraft(page);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    expect(await idCell(page, code).locator('td').nth(3).innerText().catch(() => ''), 'ô Minh chứng không còn tệp').not.toContain('qcdel');
    const d = await getRes(id); expect(d.attachmentCount).toBe(0);
    expect(await bodyText(page)).toContain(`MINH CHỨNG 0 / ${d.indicatorCount} chỉ số`);
  });
  test(tc('RES-S75'), async ({ page }) => {
    needWrite();
    const id = await ensureEditable(await R('MI.A')); await scoreAll(id); await clearFiles(id);
    const [a, b] = leaves(await getRes(id)); await openDetail(page, id);
    await attach(page, a.indicatorCode, fileOf('qca.pdf')); await attach(page, b.indicatorCode, fileOf('qcb.pdf')); await saveDraft(page);
    await chipX(page, a.indicatorCode, 'qca.pdf').click(); await confirmOk(page); await saveDraft(page);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    await expect(chip(page, a.indicatorCode, 'qca.pdf')).toHaveCount(0); await expect(chip(page, b.indicatorCode, 'qcb.pdf')).toBeVisible();
  });
  test(tc('RES-S76'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')); await scoreAll(id);
    const x = leaves(await getRes(id))[0], before = await getRes(id);
    const r = await saveScores(id, [sc(x, x.score ?? 1, { attachmentIds: [FAKE] })]);
    expect(r.status).toBe(400); expect(r.message).toContain('Tệp minh chứng không hợp lệ');
    expect((await getRes(id)).attachmentCount).toBe(before.attachmentCount);
  });
  test(tc('RES-S77'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')); await scoreAll(id); await clearFiles(id);
    const x = leaves(await getRes(id))[0], u = await upload('assessment_result_evidence', id, 'qcdupid.pdf', PDF);
    expect(u.status).toBe(200);
    const r = await saveScores(id, [sc(x, x.score ?? 1, { attachmentIds: [u.data.id, u.data.id] })]);
    expect(r.status, r.message).toBe(200);
    expect(((await ind(id, x.indicatorCode)).attachments as any[]).length).toBe(1);
    await clearFiles(id);
  });

  // ---------------------------------------------------------------- Hủy chỉnh sửa / quay lại
  const cancelBtn = (p: Page) => p.getByRole('button', { name: 'Hủy chỉnh sửa' });
  const backBtn = (p: Page) => p.locator('.ant-layout-content button:has(svg.lucide-arrow-left)').first();
  const MSG_009 = 'Các thay đổi chưa lưu sẽ bị mất. Bạn có muốn thoát không?';
  test(tc('RES-S78'), async ({ page }) => {
    const { code } = await openScoring(page, 'BA.A');
    expect(await cancelBtn(page).count(), 'chưa sửa gì thì chưa có nút Hủy chỉnh sửa').toBe(0);
    await setScore(page, code, 2);
    await expect(cancelBtn(page)).toBeVisible();
  });
  test(tc('RES-S79'), async ({ page }) => {
    const { code } = await openScoring(page, 'BA.A');
    await setScore(page, code, 5); await cancelBtn(page).click(); await page.waitForTimeout(600);
    await expect(page.getByText(MSG_009), 'MSG-009 hỏi xác nhận khi có thay đổi chưa lưu').toBeVisible({ timeout: 3000 });
  });
  test(tc('RES-S80'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A'); await saveMerge(id, [sc({ indicatorSetIndicatorId: leaves(await getRes(id))[0].indicatorSetIndicatorId }, 3)]);
    await openDetail(page, id); await setScore(page, code, 5);
    await cancelBtn(page).click(); await page.waitForTimeout(500);
    const ok = page.getByRole('button', { name: /Đồng ý|Có|OK/ }).last(); if (await ok.isVisible().catch(() => false)) await ok.click();
    await settle(page, 600);
    await expect(page.getByRole('button', { name: 'Chỉnh sửa' }), 'quay về chế độ xem').toBeVisible();
    expect(await idCell(page, code).innerText(), 'điểm hiển thị là giá trị đã lưu (3)').toMatch(/(^|\s)3(\.0)?(\s|$)/);
    expect((await ind(id, code)).score).toBe(3);
  });
  test(tc('RES-S81'), async ({ page }) => {
    const { code } = await openScoring(page, 'BA.A'); await setScore(page, code, 6);
    await cancelBtn(page).click(); await page.waitForTimeout(500);
    const no = page.getByRole('button', { name: /^(Không|Hủy|Ở lại)$/ }).last();
    expect(await no.isVisible().catch(() => false), 'phải có hộp xác nhận với lựa chọn Không').toBeTruthy();
    await no.click(); await page.waitForTimeout(400);
    expect(await sIn(page, code).inputValue()).toBe('6');
  });
  test(tc('RES-S82'), async ({ page }) => {
    const { code } = await openScoring(page, 'BA.A'); await setScore(page, code, 7);
    await backBtn(page).click(); await page.waitForTimeout(600);
    await expect(page.getByText(MSG_009), 'MSG-009 khi quay lại với thay đổi chưa lưu').toBeVisible({ timeout: 3000 });
  });
  test(tc('RES-S83'), async ({ page }) => {
    await openScoring(page, 'BA.A');
    await backBtn(page).click(); await settle(page, 600);
    await expect(page).toHaveURL(/assessment-results(\?|$)/);
    await expect(page.getByText(MSG_009)).toHaveCount(0);
  });
  test(tc('RES-S84'), async ({ page }) => {
    needWrite();
    const id = await hold('Rejected'); const s0 = (await ind(id)).score; await openDetail(page, id);
    const code = (await ind(id)).indicatorCode; await setScore(page, code, s0 === 1 ? 2 : 1);
    await cancelBtn(page).click(); await page.waitForTimeout(500);
    const ok = page.getByRole('button', { name: /Đồng ý|Có|OK/ }).last(); if (await ok.isVisible().catch(() => false)) await ok.click();
    await settle(page, 600);
    expect((await getRes(id)).status).toBe('Rejected'); expect((await ind(id)).score, 'điểm không đổi').toBe(s0);
    expect(await bodyText(page)).toContain('Bị từ chối');
  });
  test(tc('RES-S85'), async ({ page }) => {
    needWrite();
    const id = await hold('Rejected'); await openDetail(page, id); const x = await ind(id);
    await setScore(page, x.indicatorCode, x.score === 1 ? 2 : 1);
    expect(await saveDraft(page)).toMatch(/thành công/i);
    expect((await getRes(id)).status).toBe('Rejected');
  });
  test(tc('RES-S86'), async ({ page }) => {
    needWrite();
    const can = ['NotStarted', 'Scoring', 'Rejected'], cannot = ['PendingApproval', 'Approved', 'Submitted'];
    const ids: Record<string, string> = { NotStarted: await R('MBns') };
    for (const st of [...can.slice(1), ...cannot]) ids[st] = await hold(st);
    for (const st of [...can, ...cannot]) {
      await openDetail(page, ids[st]);
      const n = await page.getByRole('button', { name: 'Trình duyệt' }).count();
      expect(n > 0, `trạng thái ${st}: ${can.includes(st) ? 'phải có' : 'không được có'} nút Trình duyệt`).toBe(can.includes(st));
    }
  });
  const lockedS = (n: number, st: string) => test(tc(`RES-S${n}`), async ({ page }) => {
    needWrite();
    const id = await hold(st), before = await getRes(id), x = leaves(before)[0];
    await openDetail(page, id);
    expect(await sIn(page, x.indicatorCode).count(), 'UI ẩn ô nhập điểm').toBe(0);
    expect(await DRAFT(page).count(), 'UI ẩn nút Lưu nháp').toBe(0);
    const r = await saveScores(id, [sc(x, (x.score ?? 1) === 1 ? 2 : 1)]);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.message, `phải báo MSG-060, thực tế HTTP ${r.status} "${r.message}"`).toContain(MSG_060);
    expect((await ind(id, x.indicatorCode)).score).toBe(x.score);
  });
  lockedS(87, 'PendingApproval'); lockedS(88, 'Approved'); lockedS(89, 'Submitted'); lockedS(90, 'UnlockRequested');
  test(tc('RES-S91'), async () => {
    needWrite();
    const id = (await fx()).res['PAST.A'], d = await getRes(id), x = leaves(d)[0];
    const r = await saveScores(id, [sc(x, 1)]);
    expect(r.status).toBe(400); expect(r.message).toMatch(/kết thúc/i);
    expect((await getRes(id)).scoredCount).toBe(d.scoredCount);
  });
  test.skip(tc('RES-S92'), async () => { /* Manual: cần chờ qua 23:59 ngày kết thúc kỳ thật hoặc chỉnh giờ hệ thống */ });
  test(tc('RES-S93'), async ({ page }) => {
    needWrite();
    const id = await R('BA.H'); await driveTo(id, 'Scoring'); await scoreAll(id);   // dùng kết quả riêng (BA.H) để không làm lệch trạng thái BA.A của các test khác
    await openDetail(page, id); const x = leaves(await getRes(id))[0]; const old = x.score;
    await setScore(page, x.indicatorCode, old === 1 ? 2 : 1);
    const b = await api('POST', `${RES}/${id}/submit-for-approval`, undefined, 'canbo');   // phiên B (API) trình duyệt trước
    expect(b.status, b.message).toBe(200);
    const t = await saveDraft(page);
    expect(t, `phiên A phải bị báo dữ liệu đã thay đổi/bị từ chối, thực tế: "${t}"`).toMatch(/đã được thay đổi|thay đổi bởi|không thể|không có quyền|từ chối/i);
    const g = await getRes(id);
    expect(g.status).toBe('PendingApproval'); expect((await ind(id, x.indicatorCode)).score, 'dữ liệu phiên B không bị ghi đè').toBe(old);
    expect(t).toMatch(/dữ liệu đã được thay đổi/i);
  });
  test.skip(tc('RES-S94'), async () => { /* Manual: cần thay đổi cấu hình phân quyền hệ thống đang dùng chung */ });

  // ---------------------------------------------------------------- Tìm / lọc / tóm tắt trong màn chấm điểm
  const miOpen = async (page: Page) => { const id = await ensureEditable(await R('MI.B')); await scoreAll(id); await openDetail(page, id); return { id, d: await getRes(id) }; };
  test(tc('RES-S95'), async ({ page }) => {
    const { d } = await miOpen(page); const [a, b] = leaves(d);
    const box = page.getByPlaceholder('Tìm mã hoặc tên chỉ số...');
    await setScore(page, a.indicatorCode, a.maxScore);
    await box.fill(b.indicatorCode); await settle(page, 600);
    expect(await idCell(page, b.indicatorCode).count()).toBeGreaterThan(0);
    expect(await page.locator('tr', { hasText: a.indicatorCode }).count(), 'chỉ còn chỉ số khớp').toBe(0);
    await box.fill(''); await settle(page, 600);
    expect(Number(await sIn(page, a.indicatorCode).inputValue()), 'điểm đã nhập không mất').toBe(a.maxScore);
  });
  test(tc('RES-S96'), async ({ page }) => {
    await miOpen(page);
    const box = page.getByPlaceholder('Tìm mã hoặc tên chỉ số...'); await box.fill('x'.repeat(256));
    expect((await box.inputValue()).length).toBeLessThanOrEqual(255);
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });
  test(tc('RES-S97'), async ({ page }) => {
    needWrite();
    const id = await ensureEditable(await R('MI.B')); await scoreAll(id);
    const d0 = await getRes(id), [a] = leaves(d0);
    await saveScores(id, keep(d0).filter(k => k.indicatorSetIndicatorId !== a.indicatorSetIndicatorId));   // bỏ điểm một chỉ số
    const d = await getRes(id), un = unscored(d); expect(un.length).toBe(1);
    await openDetail(page, id);
    await pickOption(page, page.locator('.ant-select').nth(1), /Chưa chấm/); await settle(page, 500);
    const rows = await page.locator('tbody tr.ant-table-row').allInnerTexts();
    expect(rows.some(r => r.includes(un[0].indicatorCode)), 'chỉ số chưa chấm phải hiện').toBeTruthy();
    for (const l of leaves(d).filter(i => i.score != null)) expect(rows.some(r => r.includes(l.indicatorCode)), `${l.indicatorCode} đã chấm không được hiện`).toBeFalsy();
    await scoreAll(id);
  });
  test(tc('RES-S98'), async ({ page }) => {
    await miOpen(page);
    expect(await page.getByRole('button', { name: /Thu gọn tất cả/ }).count(), 'phải có nút Thu gọn tất cả').toBeGreaterThan(0);
    expect(await page.getByRole('button', { name: /Mở rộng tất cả/ }).count(), 'phải có nút Mở rộng tất cả').toBeGreaterThan(0);
  });
  test(tc('RES-S99'), async ({ page }) => {
    needWrite();
    const { d } = await miOpen(page); const g = await getRes(d.id);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    expect(await bodyText(page)).toContain(`ĐIỂM TẠM TÍNH ${g.score} / ${g.maxScore}`);
    const tot = leaves(g).reduce((s, i) => s + (i.resultScore ?? 0), 0);
    expect(Math.abs(tot - g.score), 'tổng điểm = Σ điểm kết quả chỉ số con').toBeLessThan(0.01);
  });
});

// ================================================================ N — THÔNG BÁO
const notiAdd = (n: any) => { try { return JSON.parse(n.additionalData || '{}'); } catch { return {}; } };
/** Thông báo của một tài khoản (mới nhất trước), lọc theo loại. */
async function notis(user: string, type?: string, max = 400): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; out.length < max; p++) {
    const r = await api('GET', `${NOTI}?page=${p}&size=100&sort=-CreatedOnDate&filter=${F(type ? { type } : {})}`, undefined, user);
    const c = r.data?.content ?? []; out.push(...c);
    if (p >= (r.data?.totalPages ?? 1) || !c.length) break;
  }
  return out;
}
const aboutRes = (list: any[], id: string) => list.filter(n => JSON.stringify(notiAdd(n)).includes(id));
const aboutCamp = (list: any[], campId: string) => list.filter(n => JSON.stringify(notiAdd(n)).includes(campId));
/** Chống gọi nhầm: chỉ thao tác có tác dụng lan sang người khác trên kết quả của kỳ fixture do script này tạo. */
async function mine(id: string) {
  const d = await getRes(id);
  if (!/^qc\.automation RES1/.test(d.campaignName)) throw new Error(`Từ chối thao tác trên dữ liệu không phải của script: ${d.campaignName}`);
  return d;
}
/** Kết quả fixture; kỳ định kỳ đã phê duyệt phải sinh kết quả cho đơn vị, nếu không có thì test thất bại (lỗi sản phẩm). */
const needRes = async (k: string) => { const id = await R(k); expect(id, `kết quả "${k}" không tồn tại: kỳ đã phê duyệt không sinh kết quả tự đánh giá cho đơn vị`).toBeTruthy(); return id; };
const N_USERS = ['canbo', 'cbdp', 'ldd', 'ldp'];
const NSIDE: Record<string, { camp: string; org: string }> = {
  canbo: { camp: 'BA', org: 'BO' }, ldd: { camp: 'BA', org: 'BO' }, cbdp: { camp: 'BA', org: 'DP' }, ldp: { camp: 'BA', org: 'DP' },
};
const countBy = async (users: string[], id: string, type: string) => Object.fromEntries(await Promise.all(users.map(async u => [u, aboutRes(await notis(u, type, 200), id).length])));
const diffOf = (a: Record<string, number>, b: Record<string, number>) => Object.fromEntries(Object.keys(a).map(k => [k, b[k] - a[k]]));
/** Kỳ fixture phê duyệt từ trước: kiểm thông báo "Yêu cầu tự đánh giá" của vai trò (đơn vị BO cho canbo/ldd, DP cho cbdp/ldp). */
const reqCreated = (n: number, who: string, campKey: 'BA' | 'PD') => test(tc(`RES-N${String(n).padStart(2, '0')}`), async () => {
  const f = await fx(), org = NSIDE[who].org, campId = f.camp[campKey];
  const mineN = aboutCamp(await notis(who, 'ASSESSMENT_REQUEST_CREATED'), campId);
  const camp = (await api('GET', `${CAMP}/${campId}`)).data;
  expect(mineN.length, `${who} (${org}) phải có thông báo "Yêu cầu tự đánh giá" cho kỳ ${camp.name}`).toBeGreaterThan(0);
  expect(mineN[0].title).toBe('Yêu cầu tự đánh giá');
  expect(mineN[0].description).toContain(camp.name); expect(mineN[0].description).toMatch(/Hạn hoàn thành \d{2}\/\d{2}\/\d{4}/);
});
describe_N();
function describe_N() {
  test.describe('Kết quả tự đánh giá › Thông báo', () => {
    reqCreated(1, 'canbo', 'PD'); reqCreated(2, 'cbdp', 'PD'); reqCreated(3, 'ldd', 'PD'); reqCreated(4, 'ldp', 'PD');
    reqCreated(5, 'canbo', 'BA'); reqCreated(6, 'cbdp', 'BA'); reqCreated(7, 'ldd', 'BA'); reqCreated(8, 'ldp', 'BA');
    test(tc('RES-N09'), async () => {
      const f = await fx(), n = aboutCamp(await notis('ldd', 'ASSESSMENT_REQUEST_CREATED'), f.camp.BA)[0];
      expect(n, 'ldd phải có thông báo của kỳ BA').toBeTruthy();
      expect(n.description).toBe('Đơn vị được phân công thực hiện qc.automation RES1 fixture BA. Hạn hoàn thành 31/12/2026');
    });
    test(tc('RES-N10'), async () => {
      const f = await fx(), a = aboutCamp(await notis('ldd', 'ASSESSMENT_REQUEST_CREATED'), f.camp.PD)[0], b = aboutCamp(await notis('ldd', 'ASSESSMENT_REQUEST_CREATED'), f.camp.BA)[0];
      expect(a && b).toBeTruthy();
      expect(`${a.title} ${a.description}`, 'thông báo kỳ định kỳ phải nêu loại kỳ').toMatch(/định kỳ/i);
      expect(`${b.title} ${b.description}`, 'thông báo kỳ đột xuất phải nêu loại kỳ').toMatch(/đột xuất/i);
    });
    test(tc('RES-N11'), async () => {
      const f = await fx();   // kỳ TZ chỉ gán đơn vị "RES1 ĐV A" (khóa, không có tài khoản)
      for (const u of N_USERS) expect(aboutCamp(await notis(u, 'ASSESSMENT_REQUEST_CREATED'), f.camp.TZ).length, `${u} thuộc đơn vị không được phân công kỳ TZ nhưng vẫn nhận thông báo`).toBe(0);
    });
    test(tc('RES-N12'), async () => {
      const f = await fx();
      for (const u of N_USERS) for (const k of ['BA', 'PD']) expect(aboutCamp(await notis(u, 'ASSESSMENT_REQUEST_CREATED'), f.camp[k]).length, `${u} kỳ ${k}`).toBe(1);
    });
    const reassessN = (n: number, resKey: string, who: string[], none: string[] = []) => test(tc(`RES-N${String(n).padStart(2, '0')}`), async () => {
      needWrite();
      const id = await needRes(resKey); await mine(id); await driveTo(id, 'Submitted');
      const before = await countBy([...who, ...none], id, 'ASSESSMENT_REASSESSMENT_REQUESTED'), reason = `qc.automation N${n}-${uniq()}`;
      const r = await api('POST', `${RES}/${id}/reassess`, { reason }, 'canbo'); expect(r.status, r.message).toBe(200);
      const d = diffOf(before, await countBy([...who, ...none], id, 'ASSESSMENT_REASSESSMENT_REQUESTED'));
      for (const u of who) expect(d[u], `${u} phải nhận thông báo yêu cầu đánh giá lại (${JSON.stringify(d)})`).toBe(1);
      for (const u of none) expect(d[u], `${u} không được nhận thông báo của đơn vị khác (${JSON.stringify(d)})`).toBe(0);
      const first = aboutRes(await notis(who[0], 'ASSESSMENT_REASSESSMENT_REQUESTED', 100), id)[0];
      expect(first.title).toBe('Yêu cầu đánh giá lại'); expect(first.description).toContain(`Lý do: ${reason}`);
      if (n === 14) expect(first.description).toMatch(/^Bộ yêu cầu đánh giá lại kết quả qc\.automation RES1 fixture BA\. Lý do: /);
    });
    reassessN(13, 'PD.BO', ['ldd']); reassessN(14, 'BA.BO', ['ldd']); reassessN(15, 'MI.DP', ['ldp']);
    reassessN(16, 'BA.DP', ['ldp'], ['ldd']); reassessN(17, 'BA.BO', ['ldd', 'canbo']);
    const unlockN = (n: number, resKey: string, who: string[], check?: (x: any, d: any) => void) => test(tc(`RES-N${String(n).padStart(2, '0')}`), async () => {
      needWrite();
      const id = await needRes(resKey); const d0 = await mine(id); await driveTo(id, 'UnlockRequested');
      const before = await countBy(who, id, 'ASSESSMENT_UNLOCK_APPROVED');
      const r = await api('POST', `${RES}/${id}/approve-unlock`, undefined, 'canbo'); expect(r.status, r.message).toBe(200);
      const d = diffOf(before, await countBy(who, id, 'ASSESSMENT_UNLOCK_APPROVED'));
      for (const u of who) expect(d[u], `${u} phải nhận thông báo "Đã mở khóa kết quả" (${JSON.stringify(d)})`).toBe(1);
      if (check) check(aboutRes(await notis(who[0], 'ASSESSMENT_UNLOCK_APPROVED', 100), id)[0], d0);
    });
    unlockN(18, 'PD.BO', ['ldd']); unlockN(19, 'BA.BO', ['ldd']); unlockN(20, 'BA.DP', ['ldp']);
    test(tc('RES-N21'), async () => {
      needWrite();
      const id = await R('BA.BO'); const d0 = await mine(id); await driveTo(id, 'UnlockRequested');
      const before = await countBy(['ldd', 'canbo'], id, 'ASSESSMENT_UNLOCK_APPROVED');
      expect((await api('POST', `${RES}/${id}/approve-unlock`, undefined, 'canbo')).status).toBe(200);
      const after = await countBy(['ldd', 'canbo'], id, 'ASSESSMENT_UNLOCK_APPROVED'), d = diffOf(before, after);
      const who = d.ldd > 0 ? 'ldd' : 'canbo'; const n = aboutRes(await notis(who, 'ASSESSMENT_UNLOCK_APPROVED', 100), id)[0];
      expect(n, `không có thông báo mở khóa (${JSON.stringify(d)})`).toBeTruthy();
      expect(n.description).toContain(d0.campaignName);
      expect(n.description, 'mô tả phải nêu tên đơn vị').toContain(d0.organizationName);
    });
    test(tc('RES-N22'), async () => {
      needWrite();
      const id = await R('BA.BO'); await mine(id); await driveTo(id, 'UnlockRequested');
      const cnt = async () => (await Promise.all(['ldd', 'canbo'].map(async u => aboutRes(await notis(u, undefined, 200), id).length))).reduce((a, b) => a + b, 0);
      const reason = `qc.automation N22-${uniq()}`, before = await cnt();
      expect((await api('POST', `${RES}/${id}/reject-unlock`, { reason }, 'canbo')).status).toBe(200);
      expect(await cnt(), 'đơn vị phải nhận thông báo từ chối mở khóa').toBeGreaterThan(before);
      const l = aboutRes(await notis('ldd', undefined, 200), id).concat(aboutRes(await notis('canbo', undefined, 200), id));
      expect(l.some(n => n.description.includes(reason)), 'thông báo nêu lý do từ chối').toBeTruthy();
    });
    /** Cán bộ trình duyệt kết quả → đo số thông báo "Yêu cầu phê duyệt" tăng ở từng tài khoản. */
    const submitDiff = async (resKey: string, users: string[]) => {
      const id = await needRes(resKey); await mine(id); await driveTo(id, 'Scoring'); await scoreAll(id);
      const before = await countBy(users, id, 'ASSESSMENT_SUBMITTED_FOR_APPROVAL');
      const r = await api('POST', `${RES}/${id}/submit-for-approval`, undefined, 'canbo'); expect(r.status, r.message).toBe(200);
      return { id, diff: diffOf(before, await countBy(users, id, 'ASSESSMENT_SUBMITTED_FOR_APPROVAL')) };
    };
    const submitN = (n: number, resKey: string, who: string) => test(tc(`RES-N${String(n).padStart(2, '0')}`), async () => {
      needWrite();
      const { id, diff } = await submitDiff(resKey, [who]);
      expect(diff[who], `${who} phải nhận thông báo yêu cầu phê duyệt`).toBe(1);
      const nn = aboutRes(await notis(who, 'ASSESSMENT_SUBMITTED_FOR_APPROVAL', 100), id)[0];
      expect(nn.title).toBe('Yêu cầu phê duyệt'); expect(nn.description).toMatch(/^.+ trình phê duyệt kết quả qc\.automation RES1 fixture /);
    });
    submitN(23, 'PD.BO', 'ldd'); submitN(24, 'PD.DP', 'ldp'); submitN(25, 'BA.BO', 'ldd'); submitN(26, 'BA.DP', 'ldp');
    test(tc('RES-N27'), async () => {
      needWrite();
      const { diff } = await submitDiff('BA.BO', ['ldd', 'canbo', 'cbdp']);
      expect(diff.ldd).toBe(1);
      expect(diff.canbo, 'Cán bộ không được nhận thông báo yêu cầu phê duyệt').toBe(0); expect(diff.cbdp).toBe(0);
    });
    test(tc('RES-N28'), async () => {
      needWrite();
      const { diff } = await submitDiff('BA.BO', ['ldd', 'lanhdaobo']);
      expect(diff.ldd).toBe(1); expect(diff.lanhdaobo, 'Lãnh đạo Bộ không nhận yêu cầu phê duyệt của đơn vị').toBe(0);
    });
    test(tc('RES-N29'), async () => {
      needWrite();
      const id = await R('BA.BO'); await mine(id); await driveTo(id, 'PendingApproval');
      expect((await api('POST', `${RES}/${id}/reject`, { reason: 'qc.automation N29' }, 'ldd')).status).toBe(200);
      const before = await countBy(['ldd'], id, 'ASSESSMENT_SUBMITTED_FOR_APPROVAL');
      expect((await api('POST', `${RES}/${id}/submit-for-approval`, undefined, 'canbo')).status).toBe(200);
      const after = await countBy(['ldd'], id, 'ASSESSMENT_SUBMITTED_FOR_APPROVAL');
      expect(after.ldd - before.ldd).toBe(1); expect(after.ldd).toBeGreaterThanOrEqual(2);
    });
    test(tc('RES-N30'), async () => {
      needWrite();
      const id = await R('MI.B'); await mine(id); await driveTo(id, 'Scoring'); await scoreAll(id);
      const d = await getRes(id); const [x] = leaves(d);
      expect((await saveScores(id, keep(d).filter(k => k.indicatorSetIndicatorId !== x.indicatorSetIndicatorId))).status).toBe(200);
      const before = await countBy(['ldd'], id, 'ASSESSMENT_SUBMITTED_FOR_APPROVAL');
      const r = await api('POST', `${RES}/${id}/submit-for-approval`, undefined, 'canbo');
      expect(r.status).toBe(400);
      expect((await countBy(['ldd'], id, 'ASSESSMENT_SUBMITTED_FOR_APPROVAL')).ldd).toBe(before.ldd);
      expect((await getRes(id)).status).toBe('Scoring'); await scoreAll(id);
    });
    // --- giao diện chuông: giữ nguyên request thật, chỉ đổi bộ lọc của yêu cầu lấy danh sách để thông báo cần thử nằm trong 20 mục đầu
    const bellBtn = (p: Page) => p.locator('button:has(svg.lucide-bell), button:has(.anticon-bell), button:has([aria-label="bell"])').or(p.locator('header button').filter({ hasText: /^\d+\+?$/ })).first();
    const popover = (p: Page) => p.locator('.ant-popover:not(.ant-popover-hidden), .ant-dropdown:not(.ant-dropdown-hidden)').last();
    async function openBell(p: Page, type?: string) {
      if (type) await p.route(/\/notifications\/mine\?/, async r => {
        const u = r.request().url();
        if (/page=1&/.test(u) && /size=20/.test(u)) { const resp = await r.fetch({ url: u.replace(/filter=[^&]*/, `filter=${F({ type })}`) }); await r.fulfill({ response: resp }); } else await r.continue();
      });
      await openList(p);
      const got = p.waitForResponse(r => /notifications\/mine\?/.test(r.url()) && /size=20/.test(r.url()) && r.request().method() === 'GET', { timeout: 10_000 }).then(async r => (await r.json()).data?.content?.[0], () => undefined);
      await bellBtn(p).click(); await p.waitForTimeout(1500);
      return (await got) as any;   // thông báo đầu tiên trong danh sách chuông
    }
    test(tc('RES-N31'), async ({ page }) => {
      needWrite();
      const id = await hold('PendingApproval'); await mine(id);
      expect((await api('POST', `${RES}/${id}/reject`, { reason: 'qc.automation N31' }, 'ldd')).status).toBe(200);
      expect((await api('POST', `${RES}/${id}/submit-for-approval`, undefined, 'canbo')).status).toBe(200);
      const top = await openBell(page, 'ASSESSMENT_SUBMITTED_FOR_APPROVAL'), target = notiAdd(top).assessmentResultId;
      expect(target, 'thông báo phải có assessmentResultId').toBeTruthy();
      await popover(page).getByText('Yêu cầu phê duyệt').first().click(); await settle(page, 800);
      expect(page.url()).toContain(`assessment-results/${target}`);
    });
    test(tc('RES-N32'), async ({ page }) => {
      const n0 = await openBell(page, 'ASSESSMENT_REQUEST_CREATED');
      expect(n0, 'danh sách chuông phải có thông báo yêu cầu tự đánh giá').toBeTruthy();
      await popover(page).getByText('Yêu cầu tự đánh giá').first().click(); await settle(page, 800);
      expect(page.url()).toMatch(/assessment-results\/?(\?.*)?$/);
      const after = (await notis('ldd', 'ASSESSMENT_REQUEST_CREATED', 100)).find(n => n.id === n0.id);
      expect(after.isRead, 'thông báo được bấm phải chuyển sang đã đọc').toBe(true);
    });
    test(tc('RES-N33'), async ({ page }) => {
      needWrite();
      await openList(page); await bellBtn(page).click(); await page.waitForTimeout(1200);
      const u0 = (await api('GET', `${NOTI}/unread-count`, undefined, 'ldd')).data.unreadCount;
      if (u0 === 0) test.skip(true, 'ldd không có thông báo chưa đọc');
      expect(norm(await bellBtn(page).innerText())).toBe(u0 > 99 ? '99+' : String(u0));
      await popover(page).getByText('Chưa đọc', { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(800);
      const items = popover(page).locator('.ant-list-item, [class*=cursor-pointer]').filter({ hasText: /Vừa xong|trước|\d{2}\/\d{2}/ });
      await items.first().click(); await settle(page, 800);
      const u1 = (await api('GET', `${NOTI}/unread-count`, undefined, 'ldd')).data.unreadCount;
      expect(u1, 'đọc một thông báo thì số chưa đọc giảm 1').toBe(u0 - 1);
      await openList(page); await bellBtn(page).click(); await page.waitForTimeout(1000);
      await page.getByText('Đánh dấu đã đọc tất cả').first().click(); await settle(page, 800);
      expect((await api('GET', `${NOTI}/unread-count`, undefined, 'ldd')).data.unreadCount).toBe(0);
    });
    test(tc('RES-N34'), async () => {
      const p1 = (await api('GET', `${NOTI}?page=1&size=5&sort=-CreatedOnDate`, undefined, 'ldd')).data, p2 = (await api('GET', `${NOTI}?page=2&size=5&sort=-CreatedOnDate`, undefined, 'ldd')).data;
      const all = [...p1.content, ...p2.content]; expect(all.length).toBe(10);
      for (let i = 1; i < all.length; i++) expect(all[i - 1].createdOnDate >= all[i].createdOnDate, 'thứ tự mới nhất trước').toBeTruthy();
      expect(new Set(all.map((x: any) => x.id)).size, 'chuyển trang không lặp').toBe(10);
      const dflt = (await api('GET', `${NOTI}?page=1&size=5`, undefined, 'ldd')).data.content;
      for (let i = 1; i < dflt.length; i++) expect(dflt[i - 1].createdOnDate >= dflt[i].createdOnDate, 'mặc định (không sort) cũng mới nhất trước').toBeTruthy();
    });
    test(tc('RES-N35'), async () => {
      const r = (await api('GET', `${NOTI}?page=1&size=50&filter=${F({ type: 'ASSESSMENT_REQUEST_CREATED' })}`, undefined, 'ldd')).data.content as any[];
      expect(r.length).toBeGreaterThan(0); for (const n of r) expect(n.type).toBe('ASSESSMENT_REQUEST_CREATED');
    });
    test(tc('RES-N36'), async ({ page }) => {
      needWrite();
      const id = await R('MI.D'); await mine(id);   // kết quả riêng (ĐV D), nhận thông báo qua tài khoản phạm vi toàn hệ thống (ldd)
      if ((await getRes(id)).status === 'PendingApproval') await api('POST', `${RES}/${id}/reject`, { reason: 'qc.automation N36' }, 'ldd');
      if ((await getRes(id)).status === 'NotStarted') await driveTo(id, 'Scoring');
      await scoreAll(id);
      await openList(page); await page.waitForTimeout(1500);
      await bellBtn(page).click(); await page.waitForTimeout(1500);
      const itemsOf = async () => (await popover(page).innerText()).split('\n').filter(x => /trình phê duyệt kết quả qc\.automation RES1 fixture MI/.test(x)).length;
      const n0 = await itemsOf(), first0 = norm((await popover(page).innerText()).slice(0, 400));
      const got = page.waitForResponse(r => /notifications\/mine/.test(r.url()) && r.request().method() === 'GET', { timeout: 12_000 }).then(() => true, () => false);
      expect((await api('POST', `${RES}/${id}/submit-for-approval`, undefined, 'canbo')).status).toBe(200);
      const refetched = await got; let changed = false;
      for (let i = 0; i < 8 && !changed; i++) { await page.waitForTimeout(1000); changed = (await itemsOf()) !== n0 || norm((await popover(page).innerText()).slice(0, 400)) !== first0; }
      expect(refetched || changed, 'giao diện phải tự cập nhật thông báo (không cần F5) trong vài giây').toBeTruthy();
    });
    test(tc('RES-N37'), async ({ page }) => {
      const name = await htmlCamp();
      await openBell(page, 'ASSESSMENT_REQUEST_CREATED');
      const pop = popover(page);
      await expect(pop).toContainText('<b>Ký tự</b>'); expect(await pop.locator('b').count(), 'không render HTML').toBe(0);
      void name;
    });
    test(tc('RES-N38'), async () => {
      const l = [...await notis('ldd', 'ASSESSMENT_SENT', 100), ...await notis('ldd', 'ASSESSMENT_UNLOCK_REQUESTED', 100), ...await notis('lanhdaobo', 'ASSESSMENT_SENT', 100), ...await notis('lanhdaobo', 'ASSESSMENT_UNLOCK_REQUESTED', 100)];
      expect(l.length).toBeGreaterThan(0);
      for (const n of l) expect(n.description, `thiếu tiền tố đơn vị: ${n.description}`).toMatch(/^\[[^\]]+\] .+/);
    });
  });
}
/** Kỳ fixture tên có HTML/ký tự đặc biệt (tạo một lần, gán đơn vị BO). */
const HTML_NAME = 'qc.automation RES1 <b>Ký tự</b> & "đặc biệt"';
const htmlCamp = async () => ensureCamp(HTML_NAME, { type: 'AdHoc', indicatorSetId: SET_BA, startDate: '2026-10-01T00:00:00', endDate: '2026-12-31T23:59:59' }, [ORG_BO]);

// ================================================================ G — EDGE / LỖI
const rawGet = async (pathq: string, token: string | null) => {
  const r = await fetch(`${API_BASE}/api/v1/${pathq}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const j: any = await r.json().catch(() => ({})); return { status: r.status, message: String(j?.message ?? ''), data: j?.data };
};
const SAVE_RE = /\/dti\/assessment-results\/[^/]+\/scores/;
const NO_LEAK = /Exception|stack ?trace|System\.|NullReference|SqlException|at [\w.]+\(/;
test.describe('Kết quả tự đánh giá › Edge và lỗi', () => {
  test(tc('RES-G01'), async ({ page }) => {
    needWrite();
    const { code } = await openScoring(page, 'BA.A');
    await setScore(page, code, 4); await nIn(page, code).fill('giữ lại G01');
    await page.route(SAVE_RE, r => r.request().method() === 'PUT' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"System.NullReferenceException at Foo.Bar()"}' }) : r.continue());
    const t = await saveDraft(page);
    expect(t, 'phải có thông báo lỗi chung').not.toBe(''); expect(t, `không được lộ lỗi nội bộ: "${t}"`).not.toMatch(NO_LEAK);
    expect(await sIn(page, code).inputValue()).toBe('4'); expect(await nIn(page, code).inputValue()).toBe('giữ lại G01');
  });
  test(tc('RES-G02'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A');
    await setScore(page, code, 3); await nIn(page, code).fill('G02');
    await page.route(SAVE_RE, r => r.request().method() === 'PUT' ? r.abort('internetdisconnected') : r.continue());
    const t = await saveDraft(page);
    expect(t, 'phải có thông báo lỗi kết nối').not.toBe('');
    await expect(DRAFT(page), 'nút Lưu nháp phải bấm lại được').toBeEnabled();
    expect(await sIn(page, code).inputValue()).toBe('3');
    await page.unroute(SAVE_RE);
    expect(await saveDraft(page)).toMatch(/thành công/i);
    expect((await ind(id, code)).score).toBe(3);
  });
  test(tc('RES-G03'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A'); await saveMerge(id, [sc({ indicatorSetIndicatorId: leaves(await getRes(id))[0].indicatorSetIndicatorId }, 1)]);
    await openDetail(page, id); await setScore(page, code, 2);
    const puts: string[] = []; page.on('request', r => { if (r.method() === 'PUT' && SAVE_RE.test(r.url())) puts.push(r.url()); });
    const h0 = ((await api('GET', `${RES}/${id}/history`, undefined, 'canbo')).data as any[]).length;
    await DRAFT(page).dblclick(); await settle(page, 1500);
    expect(puts.length, 'nhấp đúp chỉ được gửi một yêu cầu lưu').toBe(1);
    const h1 = ((await api('GET', `${RES}/${id}/history`, undefined, 'canbo')).data as any[]).length;
    expect(h1 - h0, 'chỉ ghi một dòng lịch sử').toBeLessThanOrEqual(1);
  });
  test(tc('RES-G04'), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page);
    await setScore(page, code, 5); await nIn(page, code).fill('G04 giải trình'); await attach(page, code, fileOf('qcg04.pdf'));
    expect(await saveDraft(page)).toMatch(/thành công/i);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500);
    expect(Number(await sIn(page, code).inputValue())).toBe(5); expect(await nIn(page, code).inputValue()).toBe('G04 giải trình');
    await expect(chip(page, code, 'qcg04.pdf')).toBeVisible();
    const i = await ind(id, code); expect(i.score).toBe(5); expect(i.note).toBe('G04 giải trình'); expect(i.attachments.length).toBe(1);
    await clearFiles(id);
  });
  test(tc('RES-G05'), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page);
    await setScore(page, code, 3); await saveDraft(page);
    const c0 = (await getRes(id)).scoredCount;
    await setScore(page, code, 5); expect(await saveDraft(page)).toMatch(/thành công/i);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
    const g = await getRes(id);
    expect(Number(await sIn(page, code).inputValue())).toBe(5); expect((await ind(id, code)).score).toBe(5);
    expect(g.scoredCount).toBe(c0); expect(g.score).toBeGreaterThan(0);
  });
  test(tc('RES-G06'), async ({ page }) => {
    needWrite();
    const { id, code } = await evidenceBase(page);
    await setScore(page, code, 3); await nIn(page, code).fill('A'); await saveDraft(page);
    await nIn(page, code).fill('B'); expect(await saveDraft(page)).toMatch(/thành công/i);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
    expect(await nIn(page, code).inputValue()).toBe('B'); expect((await ind(id, code)).note).toBe('B');
  });
  test(tc('RES-G07'), async ({ page }) => {
    await page.route(/\/dti\/assessment-results(\?|$)/, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"System.Exception: lỗi nội bộ at Foo()"}' }));
    await page.goto(ROUTE, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    const t = norm(await page.locator('body').innerText());
    expect(t.length, 'không được trắng trang').toBeGreaterThan(50);
    await expect(page.locator('.ant-layout-content').first()).toBeVisible();
    expect(t).not.toMatch(NO_LEAK);
    expect(t, 'phải có thông báo lỗi hệ thống').toMatch(/lỗi|thất bại|không thể|thử lại/i);
  });
  test(tc('RES-G08'), async ({ page }) => {
    await openList(page);
    await page.route(/\/dti\/assessment-results/, r => r.abort('internetdisconnected'));
    await clickTab(page, 'Chưa thực hiện').catch(() => {}); await page.waitForTimeout(800);
    const t = await lastToast(page) || (/lỗi|không thể|thất bại|kết nối|thử lại/i.exec(await bodyText(page))?.[0] ?? '');
    expect(t, 'phải báo lỗi kết nối (thông báo hoặc khung lỗi trên trang)').not.toBe('');
    await page.unroute(/\/dti\/assessment-results/);
    await clickTab(page, 'Tất cả'); await settle(page, 800);
    expect(page.url()).not.toContain('auth/login'); expect((await rowsData(page)).length).toBeGreaterThan(0);
  });
  test(tc('RES-G09'), async () => {
    const r = await api('GET', `${RES}?page=1&size=10&filter={bad`, undefined, 'canbo');
    expect(r.status).toBe(400); expect(r.message).toContain('Bộ lọc không hợp lệ');
  });
  test(tc('RES-G10'), async () => {
    for (const q of ['page=0&size=10', 'page=1&size=0', 'page=1&size=-1']) {
      const r = await api('GET', `${RES}?${q}`, undefined, 'canbo');
      expect(r.status, q).toBeLessThan(500);
      if (r.status === 200) { expect(r.data.content.length, `${q} trả quá nhiều bản ghi (${r.data.content.length})`).toBeLessThanOrEqual(100); expect(r.data.page ?? 1).toBeGreaterThanOrEqual(1); }
    }
  });
  test(tc('RES-G11'), async () => {
    const r = await api('GET', `${RES}?page=1&size=100000`, undefined, 'canbo');
    expect(r.status === 400 || r.data.content.length <= 100, `size=100000 trả ${r.data?.content?.length} bản ghi, phải bị giới hạn`).toBeTruthy();
  });
  test(tc('RES-G12'), async () => {
    const r = await api('GET', `${RES}?page=999&size=10`, undefined, 'canbo'), t = (await lst({})).totalElements;
    expect(r.status).toBe(200); expect(r.data.content).toHaveLength(0); expect(r.data.totalElements).toBe(t);
  });
  test(tc('RES-G13'), async () => {
    const all = (await lst({})).totalElements;
    for (const f of [{ status: 'Xyz' }, { phase: 'zzz' }, { campaignType: 'zzz' }]) {
      const r = await api('GET', `${RES}?page=1&size=10&filter=${F(f)}`, undefined, 'canbo');
      expect(r.status === 400 || (r.status === 200 && r.data.totalElements === 0), `${JSON.stringify(f)}: HTTP ${r.status}, ${r.data?.totalElements}/${all} bản ghi (giá trị lạ bị bỏ qua)`).toBeTruthy();
    }
  });
  test(tc('RES-G14'), async () => {
    const r = await api('GET', `${RES}?page=1&size=10&filter=${F({ campaignIds: ['abc'] })}`, undefined, 'canbo');
    expect(r.status).toBe(400); expect(r.message).toContain('Bộ lọc không hợp lệ');
  });
  test(tc('RES-G15'), async ({ page }) => {
    await htmlCamp();
    await openList(page, '?campaignType=AdHoc&phase=all'); await search(page, 'Ký tự');
    const row = dataRows(page).filter({ hasText: 'Ký tự' }).first();
    await expect(row).toContainText('<b>Ký tự</b> & "đặc biệt"'); expect(await row.locator('b').count()).toBe(0);
    await page.reload({ waitUntil: 'networkidle' }); await search(page, 'Ký tự');
    await expect(dataRows(page).filter({ hasText: 'Ký tự' }).first()).toContainText('<b>Ký tự</b> & "đặc biệt"');
  });
  test(tc('RES-G16'), async ({ page }) => {
    needWrite();
    const id = await takeNS(), nm = (await getRes(id)).campaignName;
    const read = async () => { await openList(page, '?campaignType=AdHoc&phase=all'); await search(page, nm); return [await tabCount(page, 'Tất cả'), await tabCount(page, 'Chưa thực hiện'), await tabCount(page, 'Đang chấm điểm')]; };
    const [a0, n0, s0] = await read();
    await openDetail(page, id); await setScore(page, BAC, 3); expect(await saveDraft(page)).toMatch(/thành công/i);
    const [a1, n1, s1] = await read();
    expect(n1).toBe(n0 - 1); expect(s1).toBe(s0 + 1); expect(a1).toBe(a0);
  });
  test(tc('RES-G17'), async ({ page }) => {
    await openList(page);
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) localStorage.setItem(k, (localStorage.getItem(k) ?? '').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'abc.def.ghi')); });
    await search(page, 'qc'); await page.waitForTimeout(1500);
    await expect(page, 'token hỏng phải chuyển về đăng nhập').toHaveURL(/auth\/login/);
  });
  test(tc('RES-G18'), async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: (test.info().project.use as any).baseURL, storageState: { cookies: [], origins: [] } }), p = await ctx.newPage();
    for (const u of [ROUTE, `${ROUTE}/${await R('BA.A')}`]) {
      await p.goto(u, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
      await expect(p).toHaveURL(/auth\/login/); expect(await p.locator('tbody tr.ant-table-row').count()).toBe(0);
    }
    await ctx.close();
  });
  test(tc('RES-G19'), async () => {
    const r = await saveScores(FAKE, [{ indicatorSetIndicatorId: FAKE, score: 1 }]);
    expect(r.status).toBe(404); expect(r.message).toContain('Không tìm thấy kết quả tự đánh giá');
  });
  test(tc('RES-G20'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')); await scoreAll(id); const before = await getRes(id);
    const r = await saveScores(id, [{ indicatorSetIndicatorId: FAKE, score: 1 }]);
    expect(r.status).toBe(400); expect(r.message).toContain('Có chỉ số không thuộc bộ chỉ số áp dụng cho kỳ tự đánh giá này');
    expect((await getRes(id)).scoredCount).toBe(before.scoredCount);
  });
  test(tc('RES-G21'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')); await scoreAll(id); const x = leaves(await getRes(id))[0];
    const r = await saveScores(id, [sc(x, 1), sc(x, 2)]);
    expect(r.status).toBe(400); expect(r.message).toContain('Danh sách điểm bị trùng lặp chỉ số');
  });
  test(tc('RES-G22'), async () => {
    needWrite();
    const id = await ensureEditable(await R('MI.C')); await scoreAll(id);
    const [a, b] = leaves(await getRes(id)), before = a.score, na = before === a.maxScore ? a.maxScore - 1 : a.maxScore;
    const r = await saveScores(id, [sc(a, na), sc(b, -1)]);
    expect(r.status).toBe(400);
    expect((await ind(id, a.indicatorCode)).score, 'điểm A không được lưu (giao dịch toàn bộ)').toBe(before);
  });
  test(tc('RES-G23'), async () => {
    const f = await fx(), a = await getRes(f.res['MB.A']), b = await getRes(f.res.MBns);
    expect(a.campaignId).toBe(b.campaignId); expect(a.scoredCount, 'MB.A đã chấm dở').toBeGreaterThan(0);
    expect(b.status).toBe('NotStarted'); expect(b.scoredCount).toBe(0); expect(leaves(b).every(i => i.score == null)).toBeTruthy();
  });
});

// ================================================================ Z — BẢO MẬT / PHÂN QUYỀN / HIỆU NĂNG
test.describe('Kết quả tự đánh giá › Phân quyền và hiệu năng', () => {
  test(tc('RES-Z01'), async () => { expect((await rawGet(`${RES}?page=1&size=10`, null)).status).toBe(401); });
  test(tc('RES-Z02'), async () => { expect((await rawGet(`${RES}?page=1&size=10`, 'abc.def.ghi')).status).toBe(401); });
  test(tc('RES-Z03'), async () => {
    const id = await R('BA.A');
    for (const s of ['', '/history', '/submissions', '/export']) expect((await rawGet(`${RES}/${id}${s}`, null)).status, s || 'detail').toBe(401);
  });
  test(tc('RES-Z04'), async () => {
    needWrite();
    const id = await R('BA.A'); await scoreAll(id); const before = await getRes(id);
    const r = await fetch(`${API_BASE}/api/v1/${RES}/${id}/scores`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scores: keep(before) }) });
    expect(r.status).toBe(401);
  });
  test(tc('RES-Z05'), async () => {
    needWrite();
    const r = await upload('assessment_result_evidence', await R('BA.A'), 'qcanon.pdf', PDF, null);
    expect(r.status, `tải lên không token phải 401, thực tế ${r.status} (createdByUserId=${r.data?.createdByUserId})`).toBe(401);
  });
  test(tc('RES-Z06'), async () => {
    needWrite();
    const id = await R('BA.A'), got: string[] = [];
    for (const u of ['ldd', 'lanhdaobo', 'xemonly']) { const r = await upload('assessment_result_evidence', id, `qc-z06-${u}.pdf`, PDF, u); if (r.status !== 403) got.push(`${u}=${r.status}`); }
    expect(got, `vai trò không có quyền chấm điểm vẫn tải được minh chứng: ${got.join(', ')}`).toEqual([]);
  });
  test(tc('RES-Z07'), async ({ browser }) => {
    const { ctx, page } = await asRole(browser, 'xemonly');
    await page.goto(ROUTE, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const t = norm(await page.locator('body').innerText());
    expect(t).toMatch(/403/); expect(t).toMatch(/Truy cập bị từ chối/i);
    expect(await page.getByText('Kết quả tự đánh giá', { exact: true }).count(), 'menu Kết quả tự đánh giá phải ẩn với tài khoản không có quyền xem').toBe(0);
    expect(await page.locator('tbody tr.ant-table-row').count()).toBe(0);
    await ctx.close();
  });
  test(tc('RES-Z08'), async () => {
    const id = await R('BA.A');
    for (const p of [`${RES}?page=1&size=10`, `${RES}/${id}`]) {
      const r = await api('GET', p, undefined, 'xemonly'); expect(r.status, p).toBe(403); expect(r.message).toContain('Bạn không có quyền truy cập chức năng này');
    }
  });
  test(tc('RES-Z09'), async ({ browser }) => {
    for (const u of ['canbo', 'cbdp', 'ldd', 'ldp', 'lanhdaobo']) {
      const { ctx, page } = await asRole(browser, u);
      const resp = page.waitForResponse(r => /dti\/assessment-results\?/.test(r.url()) && r.request().method() === 'GET', { timeout: 15_000 });
      await openList(page);
      expect((await resp).status(), u).toBe(200);
      await expect(page.locator('tbody tr.ant-table-row, .ant-empty, .ant-table-placeholder').first(), `${u} phải thấy danh sách (hoặc trạng thái rỗng)`).toBeVisible();
      expect(norm(await page.locator('body').innerText())).not.toMatch(/403|Truy cập bị từ chối/);
      await ctx.close();
    }
  });
  test(tc('RES-Z10'), async ({ page }) => {
    needWrite();
    const id = await takeNS(); await openDetail(page, id);
    await expect(sIn(page, BAC)).toBeVisible();
    await setScore(page, BAC, 2); expect(await saveDraft(page)).toMatch(/thành công/i);
    expect((await getRes(id)).status).toBe('Scoring');
  });
  test(tc('RES-Z11'), async ({ page }) => {
    needWrite();
    const id = await ensureEditable(await R('BA.DP')); await openDetail(page, id);
    await expect(sIn(page, BAC)).toBeVisible();
    await setScore(page, BAC, 3); expect(await saveDraft(page)).toMatch(/thành công/i);
    expect((await ind(id, BAC)).score).toBe(3);
  });
  const deny = (n: number, who: string) => test(tc(`RES-Z${String(n).padStart(2, '0')}`), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')); await scoreAll(id); const before = await getRes(id);
    const r = await saveScores(id, keep(before), who);   // cùng giá trị hiện có: nếu sản phẩm lỡ cho phép cũng không đổi dữ liệu
    expect(r.status, `${who}: ${r.message}`).toBe(403);
    expect((await getRes(id)).scoredCount).toBe(before.scoredCount);
  });
  deny(12, 'ldd'); deny(13, 'ldp'); deny(14, 'lanhdaobo'); deny(15, 'xemonly');
  test(tc('RES-Z16'), async () => {
    needWrite();
    const id = await ensureEditable(await R('BA.A')); await scoreAll(id); const before = await getRes(id);
    const r = await saveScores(id, keep(before), 'cbdp');
    expect([403, 404], `HTTP ${r.status}`).toContain(r.status); expect((await getRes(id)).scoredCount).toBe(before.scoredCount);
  });
  test(tc('RES-Z17'), async ({ page }) => {
    const a = await lstAll({ phase: 'all' }, 'cbdp'), all = await lst({ phase: 'all' }, 'canbo');
    expect(a.length).toBeGreaterThan(0); for (const x of a) expect(x.organizationName).toBe('QA - Địa phương');
    expect(a.length).toBeLessThan(all.totalElements);
    await openList(page); for (const r of await rowsData(page)) expect(r.text).toContain('QA - Địa phương');
  });
  test(tc('RES-Z18'), async ({ page }) => {
    const a = await lstAll({}, 'ldp'); expect(a.length).toBeGreaterThan(0);
    for (const x of a) expect(x.organizationName).toBe('QA - Địa phương');
    await openList(page); expect(await headsOf(page)).not.toContain('đơn vị');
  });
  test(tc('RES-Z19'), async () => {
    const t: Record<string, number> = {}, orgs: Record<string, number> = {};
    for (const u of ['canbo', 'ldd', 'lanhdaobo']) { const d = await lst({ phase: 'all' }, u, 1, 100); t[u] = d.totalElements; orgs[u] = new Set((d.content as any[]).map(x => x.organizationName)).size; }
    expect(orgs.canbo).toBeGreaterThan(1); expect(t.ldd, `ldd ${t.ldd} / canbo ${t.canbo}`).toBe(t.canbo); expect(t.lanhdaobo).toBe(t.canbo);
  });
  test(tc('RES-Z20'), async ({ page }) => {
    const id = await R('BA.A');
    await page.goto(`${ROUTE}/${id}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    expect(norm(await page.locator('body').innerText()), 'MSG-045').toContain('Bạn không có quyền truy cập dữ liệu của đơn vị này');
    const r = await api('GET', `${RES}/${id}`, undefined, 'cbdp'); expect([403, 404]).toContain(r.status);
    expect(JSON.stringify(r.data ?? '')).not.toContain('RES1');
  });
  test(tc('RES-Z21'), async () => {
    const id = await R('BA.A');
    for (const s of ['/history', '/submissions', '/export']) { const r = await api('GET', `${RES}/${id}${s}`, undefined, 'cbdp'); expect([403, 404], s).toContain(r.status); }
  });
  test(tc('RES-Z22'), async () => {
    const f = await fx(), d = await lst({ campaignIds: [f.camp.TZ] }, 'cbdp');
    expect(d.totalElements).toBe(0); expect(JSON.stringify(d)).not.toContain('RES1 ĐV');
  });
  test(tc('RES-Z23'), async ({ browser }) => {
    const bad: string[] = [];
    for (const u of ['canbo', 'cbdp', 'ldd', 'ldp', 'lanhdaobo']) {
      const { ctx, page } = await asRole(browser, u); await openList(page);
      const btn = (await page.getByRole('button', { name: 'Xuất Excel' }).count()) > 0, st = (await api('GET', `${RES}/export?filter={}`, undefined, u)).status;
      if (btn !== (st === 200)) bad.push(`${u}: nút=${btn}, API=${st}`);
      await ctx.close();
    }
    expect(bad, bad.join('; ')).toEqual([]);
    expect((await api('GET', `${RES}/export?filter={}`, undefined, 'xemonly')).status).toBe(403);
    for (const u of ['canbo', 'cbdp']) expect((await api('GET', `${RES}/export?filter={}`, undefined, u)).status, u).toBe(200);
  });
  test(tc('RES-Z24'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    const total = (await lst({ campaignType: 'AdHoc', phase: 'all' }, 'cbdp')).totalElements;
    const { file } = await downloadTo(page, () => page.getByRole('button', { name: 'Xuất Excel' }).first().click());
    const rows = xlsxRows(file), head = rows.findIndex(r => r.some(c => /Đơn vị/i.test(c)));
    expect(head, 'file phải có dòng tiêu đề').toBeGreaterThanOrEqual(0);
    const col = rows[head].findIndex(c => /Đơn vị/i.test(c)), data = rows.slice(head + 1).filter(r => r.some(c => c && c.trim()) && r[col]);
    for (const r of data) expect(r[col]).toBe('QA - Địa phương');
    expect(data.length).toBe(total);
  });
  test(tc('RES-Z25'), async () => {
    const id = await R('BA.A');
    for (const u of ['ldd', 'xemonly']) expect((await api('GET', `${RES}/${id}/export`, undefined, u)).status, u).toBe(403);
  });
  test(tc('RES-Z26'), async () => {
    needWrite();
    const x = await ensureEditable(await R('BA.A')), y = await ensureEditable(await R('BA.B'));
    await scoreAll(y); await clearFiles(y);
    const u = await upload('assessment_result_evidence', x, 'qcz26.pdf', PDF); expect(u.status).toBe(200);
    const ind1 = leaves(await getRes(y))[0], r = await saveScores(y, [sc(ind1, ind1.score ?? 1, { attachmentIds: [u.data.id] })]);
    expect(r.status, 'tệp của kết quả khác phải bị từ chối').toBe(400); expect(r.message).toContain('Tệp minh chứng không hợp lệ');
  });
  test.skip(tc('RES-Z27'), async () => { /* Manual: fileUrl là http://localhost:3001/… không truy cập được từ môi trường kiểm thử */ });
  test(tc('RES-Z28'), async () => { expect((await rawGet(`${NOTI}?page=1&size=5`, null)).status).toBe(401); });
  test(tc('RES-Z29'), async () => {
    needWrite();
    const un = (await notis('canbo', undefined, 100)).find(n => !n.isRead); test.skip(!un, 'canbo không có thông báo chưa đọc');
    const r = await api('PUT', `${NOTI}/read`, { ids: [un!.id] }, 'ldd'); expect(r.status).toBeLessThan(500);
    const after = (await notis('canbo', undefined, 100)).find(n => n.id === un!.id);
    expect(after.isRead, 'thông báo của canbo không bị ldd đánh dấu đã đọc').toBe(false);
  });
  test(tc('RES-Z30'), async () => {
    const r = await api('GET', `${NOTI}?page=1&size=5&filter={bad`, undefined, 'ldd');
    expect(r.status, `HTTP ${r.status}`).toBe(400);
  });
  test(tc('RES-Z31'), async ({ page }) => {
    const ts: number[] = [];
    for (let i = 0; i < 5; i++) { const t0 = Date.now(); const r = await api('GET', `${RES}?page=1&size=10`, undefined, 'canbo'); expect(r.status).toBe(200); ts.push(Date.now() - t0); }
    expect(ts.reduce((a, b) => a + b, 0) / 5, `thời gian API: ${ts.join(', ')} ms`).toBeLessThanOrEqual(2000);
    const t0 = Date.now(); await openList(page); expect((await rowsData(page)).length).toBeGreaterThan(0);
    expect(Date.now() - t0, 'giao diện hiển thị đầy đủ').toBeLessThanOrEqual(3000);
  });
  test(tc('RES-Z32'), async ({ page }) => {
    const id = await R('MB.A'); expect(leaves(await getRes(id)).length).toBeGreaterThanOrEqual(100);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const t0 = Date.now(); await page.goto(`${ROUTE}/${id}`, { waitUntil: 'networkidle' });
    await page.locator('tbody tr.ant-table-row').nth(20).waitFor({ timeout: 15_000 });
    expect(Date.now() - t0, 'mở chi tiết 100+ chỉ số').toBeLessThanOrEqual(3000);
  });
  test(tc('RES-Z33'), async ({ page }) => {
    needWrite();
    const id = await ensureEditable(await R('MB.A')); await scoreAll(id);
    const x = leaves(await getRes(id))[0]; await openDetail(page, id);
    await setScore(page, x.indicatorCode, x.score === x.maxScore ? x.maxScore - 1 : x.maxScore);
    const t0 = Date.now(), t = await saveDraft(page), dt = Date.now() - t0;
    expect(t).toMatch(/thành công/i); expect(dt, 'lưu nháp 100 chỉ số').toBeLessThanOrEqual(5000);
  });
  test(tc('RES-Z34'), async ({ page }) => {
    needWrite(); test.setTimeout(120_000);
    const { id, code } = await evidenceBase(page);
    const buf = Buffer.concat([PDF, Buffer.alloc(20 * 1024 * 1024 - PDF.length, 32)]);
    const t0 = Date.now(); await fIn(page, code).setInputFiles({ name: 'qcz34.pdf', mimeType: 'application/pdf', buffer: buf });
    await chip(page, code, 'qcz34.pdf').waitFor({ timeout: 30_000 });
    expect(Date.now() - t0).toBeLessThanOrEqual(30_000);
    void id;
  });
});
