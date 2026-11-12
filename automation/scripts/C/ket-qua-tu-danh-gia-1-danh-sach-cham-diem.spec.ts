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
  test(tc('RES-L03'), async ({ page }) => {
    await openList(page, '?campaignType=AdHoc&phase=all');
    await clickTab(page, 'Đã gửi');
    expect(await headsOf(page), 'danh sách phải có cột Xếp loại').toContain('xếp loại');
    for (const r of await rowsData(page)) expect(r.text).toMatch(/\d+(,\d+)?%/);
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
  test(tc('RES-L28'), async ({ page }) => {
    await openList(page);
    await expect(searchBox(page)).toHaveAttribute('placeholder', /^Tìm kiếm đơn vị, kỳ tự đánh giá/);   // QA chấp nhận gợi ý thực tế của app
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
    await expect(content(page)).toContainText('Không tìm thấy dữ liệu phù hợp');   // QA chấp nhận thông báo thực tế của app
  });
  test(tc('RES-L32'), async ({ page }) => {
    await openList(page);
    const empty = (await tabNames(page)).find(async () => false);
    let target = '';
    for (const n of tabsOnly(await tabNames(page)).filter(x => x !== 'Tất cả')) if ((await tabCount(page, n)) === 0) { target = n; break; }
    test.skip(!target, 'Không có tab trạng thái nào rỗng ở dữ liệu hiện tại');
    await clickTab(page, target);
    expect(await dataRows(page).count()).toBe(0);
    await expect(content(page), `tab rỗng "${target}"`).toContainText(/Chưa có dữ liệu|Không tìm thấy dữ liệu phù hợp|Không có dữ liệu/);   // QA chấp nhận thông báo trống của app
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
    for (let i = 0; i < 10; i++) {   // kết quả nhiều trang: duyệt hết các trang để thấy đủ các kỳ
      const next = page.locator('.ant-pagination-next:not(.ant-pagination-disabled)');
      if (!(await next.count())) break;
      await next.click(); await settle(page);
      (await rowsData(page)).forEach(r => names.add(nameOf(r.cells)));
    }
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
  test(tc('RES-L45'), async ({ page }) => {
    await openList(page);
    const n = await totalOf(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await pickOption(page, page.locator(PAGER_SEL).first(), '20'); await settle(page);
    expect(await dataRows(page).count()).toBe(Math.min(20, n));
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
  test(tc('RES-L49'), async ({ page }) => {
    await openList(page);
    const seg = page.locator('.ant-segmented').first(), ex = page.getByRole('button', { name: 'Xuất Excel' });
    const sb = (await seg.boundingBox())!, eb = (await ex.boundingBox())!;
    expect(norm(await seg.innerText()), 'nút không được kèm số lượng').not.toMatch(/\d/);
    expect(sb.x + sb.width, 'Định kỳ/Đột xuất nằm bên trái Xuất Excel').toBeLessThanOrEqual(eb.x);
    expect(Math.abs(sb.y - eb.y), 'cùng hàng đầu trang').toBeLessThan(60);
  });
  test(tc('RES-L54'), async ({ page }) => {
    await hold('Submitted');
    await openList(page, '?campaignType=AdHoc&phase=all'); await clickTab(page, 'Đã gửi');
    const rows = (await rowsData(page)).filter(r => !r.cells[5].startsWith('—') && !r.cells[5].startsWith('-'));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(norm(r.cells[5]), `"${nameOf(r.cells)}"`).toMatch(/^\d+ \/ \d+$/);
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
    // QA chấp nhận hành vi thực tế: nút "Xem chi tiết" mở thẳng chi tiết; mũi tên cạnh nút bung menu các thao tác khác (không có mục "Xem")
    const row = await findRowOf(page, 'RES1 fixture MB', orgName('B'));
    await row.locator('button').last().click(); await settle(page, 500);
    const dd = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item');
    const items = (await dd.allInnerTexts()).map(norm);
    expect(items.length, `bấm mũi tên cạnh "Xem chi tiết" phải bung menu thao tác (URL: ${page.url()})`).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await row.getByRole('button', { name: 'Xem chi tiết' }).first().click(); await settle(page, 500);
    expect(page.url(), 'bấm "Xem chi tiết" mở màn chi tiết').toMatch(/assessment-results\/[0-9a-f-]{36}/);
  });
  const menuTest = async (page: Page, org: string, camp: string, expectItems: string[]) => {
    const row = await findRowOf(page, camp, orgName(org));
    const items = await rowMenu(page, row);
    for (const w of expectItems) expect(items, `menu thực tế: ${items.join(' | ')}`).toContain(w);
  };
  test(tc('RES-L62'), async ({ page }) => { await menuTest(page, 'B', 'RES1 fixture MB', ['Bắt đầu chấm']); });   // QA chấp nhận: dòng Chưa thực hiện có "Bắt đầu chấm" (mở chi tiết bằng nút Xem chi tiết)
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
  test(tc('RES-V06'), async ({ page }) => {
    const id = await R('MI.A'), d = await getRes(id);
    await openDetail(page, id);
    const t = await bodyText(page);
    expect(t, 'phải có dòng Trụ cột').toContain(d.pillars[0].pillarName);
    const parent = (d.indicators as any[]).find(i => !i.isLeaf)!;
    expect(t, 'phải có dòng chỉ số cha').toContain(parent.indicatorCode);
    await expect(idCell(page, parent.indicatorCode).locator('.ant-table-row-expand-icon, [class*=expand], svg').first(), 'chỉ số cha có mũi tên đóng/mở').toBeVisible();
  });
  test(tc('RES-V08'), async ({ page }) => {
    const id = await R('MI.A'); await driveTo(id, 'Scoring');
    await saveMerge(id, [sc(leaves(await getRes(id))[0], 6)]);
    await openDetail(page, id);
    const heads = (await page.locator('thead th').allInnerTexts()).map(s => norm(s).toLowerCase());
    expect(heads, `các cột: ${heads.join(' | ')}`).toContain('đánh giá');
    expect(await bodyText(page)).toMatch(/Đạt|Chưa đạt/);
  });
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
    // QA chấp nhận: app tự đưa số âm về 0 (không hiện thông báo MSG-057) - miễn là ô không giữ giá trị âm
    const t = await bodyText(page), v = await sIn(page, code).inputValue();
    expect(t.includes('Điểm phải lớn hơn hoặc bằng 0') || v === '0', `nhập -1: phải báo lỗi hoặc tự về 0 (giá trị ô: "${v}")`).toBeTruthy();
  });
  test(tc('RES-S11'), async ({ page }) => {
    needWrite();
    const { id, code } = await openScoring(page, 'BA.A'); const before = (await ind(id, code)).score;
    await sIn(page, code).fill('2.5'); await sIn(page, code).blur(); await page.waitForTimeout(500);
    const msg = await bodyText(page), v = await sIn(page, code).inputValue();
    await DRAFT(page).click({ trial: false }).catch(() => {});
    await page.waitForTimeout(1200);
    // QA chấp nhận: app tự làm tròn về số nguyên (không hiện MSG-083) - miễn là không lưu số thập phân
    expect(msg.includes('Điểm phải là số nguyên') || Number.isInteger(Number(v)), `nhập 2.5: phải báo lỗi hoặc tự về số nguyên (giá trị ô: "${v}")`).toBeTruthy();
    const saved = (await ind(id, code)).score;
    expect(saved === before || Number.isInteger(saved), `không được lưu số thập phân (đã lưu: ${saved})`).toBeTruthy();
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
    // QA chấp nhận: app tự đưa điểm nhập 9 về điểm tối đa 8 (không lưu 9) - miễn là điểm kết quả không vượt tối đa
    expect(y.score, 'điểm chấm 9 > tối đa 8: lưu 9 hoặc tự về 8').toBeGreaterThanOrEqual(8); expect(y.resultScore).toBe(8);
  });
  test(tc('RES-S16'), async ({ page }) => {
    needWrite();
    const id = await ensureEditable(await R('MI.B')); await scoreAll(id); await openDetail(page, id);
    await setScore(page, 'QCARES1I1', 8); expect(await saveDraft(page)).toMatch(/thành công/i);
    const y = await ind(id, 'QCARES1I1');
    expect(y.score).toBe(8); expect(y.resultScore).toBe(8); expect(y.isPassed).toBe(true);
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
  const withFile = async (page: Page) => {
    const b = await evidenceBase(page); await attach(page, b.code, fileOf('qcdel.pdf')); await saveDraft(page);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 500); return b;
  };
  const confirmOk = async (p: Page) => { const b = p.getByRole('button', { name: /Đồng ý|Xóa|OK/ }).last(); if (await b.isVisible().catch(() => false)) await b.click(); };
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
  test(tc('RES-G12'), async () => {
    const r = await api('GET', `${RES}?page=999&size=10`, undefined, 'canbo'), t = (await lst({})).totalElements;
    expect(r.status).toBe(200); expect(r.data.content).toHaveLength(0); expect(r.data.totalElements).toBe(t);
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
  test(tc('RES-Z19'), async () => {
    const t: Record<string, number> = {}, orgs: Record<string, number> = {};
    for (const u of ['canbo', 'ldd', 'lanhdaobo']) { const d = await lst({ phase: 'all' }, u, 1, 100); t[u] = d.totalElements; orgs[u] = new Set((d.content as any[]).map(x => x.organizationName)).size; }
    expect(orgs.canbo).toBeGreaterThan(1); expect(t.ldd, `ldd ${t.ldd} / canbo ${t.canbo}`).toBe(t.canbo); expect(t.lanhdaobo).toBe(t.canbo);
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
