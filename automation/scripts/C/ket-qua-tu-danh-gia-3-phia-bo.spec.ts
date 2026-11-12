// C.UC2 KẾT QUẢ TỰ ĐÁNH GIÁ (3/3) · PHÍA BỘ — script bám testcase RES-B/R/W/O/H/M/Q/K (testcases/docs/catalog-C3.mjs, catalog.json).
// Mỗi test chạy bằng tài khoản TÁC NHÂN trong catalog (fixture `page` của common); không đủ quyền theo đặc tả → test FAIL, không đổi tài khoản.
// Dữ liệu thử là "fixture" tạo MỘT LẦN (kỳ "qc.automation RES3 phía Bộ" + đơn vị QCA3RES1..4), tái sử dụng giữa các lần chạy; kỳ đã duyệt/gửi không xóa được.
// AN TOÀN: nhắc nhở / đánh giá lại / duyệt / từ chối mở khóa chỉ gọi với id kết quả của fixture (hàm mine()); nút "Gửi nhắc nhở" đầu trang chỉ dùng sau khi lọc về kỳ fixture.
// RES3_AS=<key> (chỉ dùng khi phát triển/chẩn đoán): chạy test bằng tài khoản khác tác nhân để kiểm tra phần luồng không thấy được vì thiếu quyền.
import { Page, Locator, Browser } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test as ctest, expect, tc, needWrite, api, listApi, totalOf, pickOption, apiStatus, tokenOf, code8 } from './common';
import { API_BASE } from '../api';

const RES = 'dti/assessment-results', CAMP = 'dti/self-assessment-campaigns', NOTI = 'notifications/mine';
const SCALE = '6f1c6e0e-5a56-4a0e-9a53-0d1f2b6b7c01';           // TXL-001 Thang xếp loại mặc định
const SET_BA = '5ff891ae-818e-444a-9b00-5a22da75503c';          // BA-TEST-SET: 1 chỉ số, tối đa 8, trọng số 2
const ORG_BO = '0d39632f-fa83-45d0-8a6f-aa0196fc1e96';          // QA - Đơn vị Bộ (canbo, ldd, lanhdaobo)
const ORG_DP = 'b5a3ab66-ba5c-4e8a-baf9-15aecf8358ed';          // QA - Địa phương (cbdp, ldp)
const UNIT_TYPE = '10000000-0000-0000-0000-000000000012';
const CAMP_NAME = 'qc.automation RES3 phía Bộ', KW = 'RES3 phía Bộ';
const FAKE = '00000000-0000-4000-8000-000000000000';
const F = (o: any) => encodeURIComponent(JSON.stringify(o));
const ST: Record<string, string> = {
  NotStarted: 'Chưa thực hiện', Scoring: 'Đang chấm điểm', PendingApproval: 'Chờ duyệt', Approved: 'Đã phê duyệt',
  Rejected: 'Bị từ chối', Submitted: 'Đã gửi', UnlockRequested: 'Chờ mở khóa', NotSent: 'Chưa gửi',
};
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const LONG = (n: number) => 'x'.repeat(n);

// ---------------------------------------------------------------- Tác nhân
const CAT: any[] = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8'));
const OVR = process.env.RES3_AS;
const test = OVR
  ? ctest.extend({ page: async ({ browser, baseURL }, use) => { const ctx = await browser.newContext({ storageState: `auth/${OVR}.json`, baseURL }); await use(await ctx.newPage()); await ctx.close(); } })
  : ctest;
/** Khóa tài khoản tác nhân của test đang chạy (dùng cho các bước gọi API "bằng tác nhân"). */
const actor = () => OVR || CAT.find(c => c.id === test.info().title.match(/^\[(RES-[A-Z]\d+)\]/)?.[1])?.account || 'superadmin';
const ROLE_NAME: Record<string, string> = { lanhdaobo: 'Lãnh đạo Bộ', canbo: 'Cán bộ', ldd: 'Lãnh đạo đơn vị', cbdp: 'Cán bộ địa phương', ldp: 'Lãnh đạo địa phương', xemonly: 'Tài khoản chỉ xem', admin: 'Quản trị hệ thống' };
const who = () => `${ROLE_NAME[actor()] ?? actor()} (${actor()})`;

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
async function upload(entityId: string, name = 'qca-res3.pdf', as = 'canbo') {
  const fd = new FormData();
  fd.append('file', new Blob([PDF], { type: 'application/pdf' }), name); fd.append('entityId', entityId);
  const r = await fetch(`${API_BASE}/api/v1/upload/blob/assessment_result_file`, { method: 'POST', headers: { Authorization: `Bearer ${tokenOf(as)}` }, body: fd });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, data: j?.data };
}
const histOf = async (id: string, action?: string, as = 'canbo') => (await api('GET', `${RES}/${id}/history${action ? `?action=${action}` : ''}`, undefined, as)).data as any[] ?? [];
/** Thông báo của một tài khoản gắn với kết quả `rid` (additionalData.assessmentResultId), mới nhất trước. */
async function notiOf(as: string, rid: string, type?: string): Promise<any[]> {
  const out: any[] = [];
  for (let pg = 1; pg <= 15; pg++) {   // duyệt hết các trang: thông báo mới đẩy thông báo cũ ra khỏi trang đầu
    const r = await api('GET', `${NOTI}?page=${pg}&size=100`, undefined, as);
    out.push(...(r.data?.content ?? []));
    if (pg >= (r.data?.totalPages ?? 1)) break;
  }
  return out.filter((n: any) => {
    try { return JSON.parse(n.additionalData || '{}').assessmentResultId === rid && (!type || n.type === type); } catch { return false; }
  });
}

// ---------------------------------------------------------------- Fixture (tạo một lần, tái sử dụng)
// Kỳ BA: bộ chỉ số 1 chỉ số (chấm 1 lần là đủ). Kỳ MI: bộ QCARES1S (1 chỉ số cha + 3 chỉ số con) để có "Đang chấm điểm" dở dang và cây chỉ số.
type Key = 'DP' | 'BO' | 'E1' | 'E2' | 'E3' | 'E4' | 'MD' | 'M1';
type Fx = { camp: string; campMI: string | null; org: Record<string, string>; res: Record<Key, string> };
let FX: Promise<Fx> | null = null;
const CAMP_MI = 'qc.automation RES3 MI', KW_MI = 'RES3 MI';
const ORG_NAME: Record<Key, string> = { DP: 'QA - Địa phương', BO: 'QA - Đơn vị Bộ', E1: 'qc.automation RES3 ĐV1', E2: 'qc.automation RES3 ĐV2', E3: 'qc.automation RES3 ĐV3', E4: 'qc.automation RES3 ĐV4', MD: 'QA - Địa phương', M1: 'qc.automation RES3 ĐV1' };
const inMI = (k: Key) => k === 'MD' || k === 'M1';
const must = (r: any, w: string) => { if (r.status >= 300) throw new Error(`${w}: ${r.status} ${r.message}`); return r; };
async function ensureOrg(i: number) {
  const code = `QCA3RES${i}`, name = ORG_NAME[`E${i}` as Key];
  const o = (await listApi('organizations', code)).find((x: any) => x.code === code);
  if (o) return o.id as string;
  const c = must(await api('POST', 'organizations', { code, name, unitTypeId: UNIT_TYPE, parentId: ORG_BO }), 'tạo đơn vị');
  await api('PUT', `organizations/${c.data.id}/lock`, {});
  return c.data.id as string;
}
async function ensureCamp(name: string, setId: string, orgIds: string[]) {
  let c = (await listApi(CAMP, name)).find((x: any) => x.name === name);
  if (!c) {
    c = must(await api('POST', CAMP, { type: 'AdHoc', name, indicatorSetId: setId, scaleId: SCALE, startDate: '2026-10-27T00:00:00', endDate: '2027-12-31T23:59:59', reminderDaysBeforeDue: 3 }, 'canbo'), 'tạo kỳ').data;
    must(await api('PUT', `${CAMP}/${c.id}/organizations`, orgIds, 'canbo'), 'phân công');
    must(await api('POST', `${CAMP}/${c.id}/submit`, undefined, 'canbo'), 'trình kỳ');
    must(await api('POST', `${CAMP}/${c.id}/approve`, undefined, 'lanhdaobo'), 'phê duyệt kỳ');
  }
  return (await api('GET', `${CAMP}/${c.id}`)).data;
}
async function loadFx(): Promise<Fx> {
  const org = { DP: ORG_DP, BO: ORG_BO, E1: await ensureOrg(1), E2: await ensureOrg(2), E3: await ensureOrg(3), E4: await ensureOrg(4) } as Record<string, string>;
  const d = await ensureCamp(CAMP_NAME, SET_BA, Object.values(org));
  const res = {} as Record<Key, string>;
  for (const k of ['DP', 'BO', 'E1', 'E2', 'E3', 'E4'] as Key[]) res[k] = d.organizations.find((o: any) => o.organizationId === org[k])?.assessmentResultId;
  const mi = (await listApi('dti/indicator-sets', 'QCARES1S')).find((x: any) => x.code === 'QCARES1S');
  let campMI: string | null = null;
  if (mi) {
    const m = await ensureCamp(CAMP_MI, mi.id, [org.DP, org.E1]);
    campMI = m.id;
    res.MD = m.organizations.find((o: any) => o.organizationId === org.DP)?.assessmentResultId;
    res.M1 = m.organizations.find((o: any) => o.organizationId === org.E1)?.assessmentResultId;
  }
  return { camp: d.id, campMI, org, res };
}
const fx = () => (FX ??= loadFx().catch(e => { FX = null; throw e; }));
const rid = async (k: Key) => { const id = (await fx()).res[k]; if (!id) throw new Error(`fixture ${k} chưa dựng được (thiếu bộ chỉ số QCARES1S của RES1?)`); return id; };
/** Chốt an toàn: chỉ cho phép thao tác có tác dụng lan sang người khác với kết quả fixture (hoặc id giả). */
const EXTRA_OK = new Set<string>();
async function mine(...ids: string[]) {
  const ok = new Set([...Object.values((await fx()).res), FAKE, 'abc', ...EXTRA_OK]);
  for (const i of ids) if (!ok.has(i)) throw new Error(`AN TOÀN: ${i} không phải kết quả fixture RES3`);
}
const post = async (id: string, act: string, body: any, as: string) => { await mine(id); return api('POST', `${RES}/${id}/${act}`, body, as); };
const remind = async (ids: string[], as = actor()) => { await mine(...ids); return api('POST', `${RES}/reminders`, { resultIds: ids }, as); };
/** Kết quả (QA - ...) của kỳ đã kết thúc do các agent trước dựng — dùng cho test "kỳ đã kết thúc"; không có thì null. */
async function endedQa(): Promise<string | null> {
  const x = (await lstAll({ campaignType: 'AdHoc', phase: 'closed' }, 'canbo')).find(r => /^QA - /.test(r.organizationName) && /^qc\.automation/.test(r.campaignName));
  if (x) EXTRA_OK.add(x.id);
  return x?.id ?? null;
}
const leavesOf = (d: any) => (d.indicators as any[]).filter(i => i.isLeaf && i.isScored);
const clampScore = (i: any, v = 6) => Math.min(Math.max(i.minScore ?? 0, v), i.maxScore);

// ---------------------------------------------------------------- Đưa kết quả fixture tới trạng thái đích
async function saveScores(id: string, only: 'first' | 'unscored' | 'all', v = 6) {
  const d = await getRes(id);
  const todo = leavesOf(d).filter((i: any) => only === 'all' || i.score == null);
  const pick = only === 'first' ? todo.slice(0, 1) : todo;
  if (!pick.length) return { status: 200, message: '' };
  return api('PUT', `${RES}/${id}/scores`, { scores: pick.map((i: any) => ({ indicatorSetIndicatorId: i.indicatorSetIndicatorId, score: clampScore(i, v), note: i.note, attachmentIds: (i.attachments ?? []).map((a: any) => a.id) })) }, 'canbo');
}
async function stepOnce(id: string, cur: string, target: string) {
  const reason = { reason: 'qc.automation' };
  switch (cur) {
    case 'NotStarted': return saveScores(id, 'first');
    case 'Scoring': case 'Rejected': { const r = await saveScores(id, 'unscored'); if (r.status !== 200) return r; return api('POST', `${RES}/${id}/submit-for-approval`, undefined, 'canbo'); }
    case 'PendingApproval': return target === 'Rejected' ? api('POST', `${RES}/${id}/reject`, reason, 'ldd') : api('POST', `${RES}/${id}/approve`, undefined, 'ldd');
    case 'Approved': return api('POST', `${RES}/${id}/send`, { attachmentId: (await upload(id)).data?.id, fileType: 'DigitalSigned' }, 'canbo');
    case 'Submitted': return ['Rejected', 'PendingApproval', 'Approved'].includes(target) ? api('POST', `${RES}/${id}/reassess`, reason, 'canbo') : api('POST', `${RES}/${id}/request-unlock`, { reason: 'qc.automation xin mở khóa' }, 'canbo');
    case 'UnlockRequested': return target === 'Scoring' ? api('POST', `${RES}/${id}/approve-unlock`, undefined, 'lanhdaobo') : api('POST', `${RES}/${id}/reject-unlock`, reason, 'lanhdaobo');
  }
  throw new Error('trạng thái lạ ' + cur);
}
/** Đưa kết quả fixture `k` tới trạng thái `target` (đi theo vòng đời hợp lệ). NotStarted chỉ giữ được cho E2 và "Scoring dở dang" cho M1 (không bao giờ đẩy tiếp). */
async function toState(k: Key, target: string) {
  const id = await rid(k); await mine(id);
  for (let i = 0; i < 10; i++) {
    const cur = (await getRes(id)).status as string;
    if (cur === target) return id;
    if (target === 'NotStarted') throw new Error(`${k} đã rời NotStarted`);
    const r = await stepOnce(id, cur, target);
    if (r.status !== 200) throw new Error(`${k}: ${cur}→${target}: ${r.status} ${r.message}`);
  }
  throw new Error(`${k}: không tới được ${target}`);
}
/** Bố cục chuẩn: mỗi trạng thái có ít nhất một kết quả fixture. */
async function layout() {
  await toState('E2', 'NotStarted'); await toState('E3', 'Approved'); await toState('E4', 'PendingApproval');
  await toState('E1', 'Scoring'); await toState('DP', 'Submitted'); await toState('BO', 'UnlockRequested');
}
/** Kết quả "Đang chấm điểm dở dang" (còn chỉ số chưa chấm) — dùng cho nhắc nhở trạng thái Đang chấm điểm. */
async function partialScoring() { const id = await rid('M1'); const d = await getRes(id); expect(d.status === 'NotStarted' || (d.status === 'Scoring' && d.scoredCount < d.indicatorCount), `M1 phải còn dở dang (đang ${d.status} ${d.scoredCount}/${d.indicatorCount})`).toBeTruthy(); if (d.status === 'NotStarted') await toState('M1', 'Scoring'); return id; }
/** Đưa kết quả về trạng thái còn nhắc được (chưa gửi): nếu đã gửi/chờ mở khóa thì cho Bộ yêu cầu đánh giá lại để về Bị từ chối. */
async function remindable(k: Key) {
  const id = await rid(k);
  if (!(await getRes(id)).allowedActions?.includes('remind')) await toState(k, 'Rejected');
  return id;
}
const bo = 'lanhdaobo';
/** Mở một phiên trình duyệt bằng tài khoản vai trò khác (chỉ để QUAN SÁT giao diện của vai trò đó). */
async function asRole(browser: Browser, key: string) {
  const ctx = await browser.newContext({ storageState: `auth/${key}.json`, baseURL: (test.info().project.use as any).baseURL });
  return { ctx, page: await ctx.newPage() };
}

// ---------------------------------------------------------------- Helper giao diện
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const ROUTE = '/#/vi/assessment-results';
type Q = { type?: 'AdHoc' | 'Periodic'; phase?: string; status?: string; kw?: string };
const qs = (o: Q) => `?${new URLSearchParams({ campaignType: o.type ?? 'AdHoc', phase: o.phase ?? 'all', ...(o.status ? { status: o.status } : {}), ...(o.kw ? { keyword: o.kw } : {}) })}`;
async function openList(page: Page, o: Q | null = {}) {
  await page.setViewportSize({ width: 1800, height: 1000 });   // đủ rộng để thanh tab không bị cuộn ẩn
  const again = page.url().includes('assessment-results');
  await page.goto(`${ROUTE}${o ? qs(o) : ''}`, { waitUntil: 'networkidle' });
  if (again) await page.reload({ waitUntil: 'networkidle' });   // đổi query trên cùng route (hash) không khởi tạo lại trạng thái trang
  await page.locator('tbody tr.ant-table-row, .ant-empty, .ant-table-placeholder').first().waitFor({ timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(400);
}
const settle = async (p: Page, ms = 700) => {
  await p.waitForTimeout(250); await p.waitForLoadState('networkidle').catch(() => {});
  await p.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(ms);
};
const rowsL = (p: Page) => p.locator('tbody tr.ant-table-row');
const PAGER_SEL = '.ant-pagination-options .ant-select';
const filterSelects = (p: Page) => p.locator(`.ant-select:not(${PAGER_SEL})`);
const searchBox = (p: Page) => p.getByPlaceholder(/tìm kiếm/i).first();
async function search(p: Page, kw: string) { await searchBox(p).fill(kw); await settle(p, 1000); }
const tabsL = (p: Page) => p.locator('[role=tab]');
const tabNames = async (p: Page) => (await tabsL(p).allInnerTexts()).map(t => norm(t).replace(/\s*\d+\+?$/, ''));
const hasTab = async (p: Page, name: string) => (await tabNames(p)).includes(name);
async function tabCount(p: Page, name: string) {
  const el = p.getByRole('tab', { name: new RegExp(`^${name}`) }).first();
  if (!(await el.count())) return -1;
  const m = norm(await el.innerText()).match(/(\d+)\+?$/); return m ? Number(m[1]) : 0;
}
async function clickTab(p: Page, name: string) {
  const el = p.getByRole('tab', { name: new RegExp(`^${name}`) }).first();
  if (!(await el.count())) throw new Error(`[${who()}] giao diện không có tab "${name}" (các tab: ${(await tabNames(p)).join(', ')})`);
  const wait = p.waitForResponse(r => /\/dti\/assessment-results\?/.test(r.url()) && r.request().method() === 'GET', { timeout: 6000 }).catch(() => null);
  await el.click(); await wait; await settle(p, 500);
}
async function rowsData(p: Page) {
  return p.locator('tbody tr.ant-table-row').evaluateAll(trs => trs.map(tr => {
    const cells = [...tr.querySelectorAll(':scope > td')].map(t => (t as HTMLElement).innerText.trim());
    return { cells, text: (tr as HTMLElement).innerText.replace(/\s+/g, ' ').trim() };
  }));
}
const nameOf = (cells: string[]) => cells[1].split('\n')[0].trim();
const statusOf = (cells: string[]) => cells[6].split('\n')[0].trim();
async function setSegment(p: Page, label: 'Định kỳ' | 'Đột xuất') { await p.locator('.ant-segmented-item', { hasText: label }).first().click(); await settle(p); }
async function setPhase(p: Page, label: RegExp | string) { await pickOption(p, filterSelects(p).first(), label); await settle(p); }
const headsOf = async (p: Page) => (await p.locator('.ant-table-thead').first().locator('th').allInnerTexts()).map(s => norm(s)).filter(Boolean);
/** Dòng danh sách của kết quả fixture `k` (danh sách đã lọc theo từ khóa kỳ fixture). */
const rowOfFx = (p: Page, k: Key) => rowsL(p).filter({ hasText: ORG_NAME[k] }).filter({ hasText: inMI(k) ? CAMP_MI : /RES3 phía Bộ/ }).first();
/** Mục menu dòng (nút mũi tên). Dòng không có menu → []. */
async function menuOf(p: Page, row: Locator): Promise<string[]> {
  const trg = row.locator('button.ant-dropdown-trigger');
  if (!(await trg.count())) return [];
  await trg.first().click();
  const dd = p.locator('.ant-dropdown:not(.ant-dropdown-hidden)').last();
  await dd.waitFor({ state: 'visible', timeout: 5000 });
  const items = (await dd.locator('.ant-dropdown-menu-item').allInnerTexts()).map(norm);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  return items;
}
/** Chọn một mục trong menu dòng; thiếu mục → FAIL kèm danh sách mục thực tế của tác nhân. */
async function rowAct(p: Page, row: Locator, re: RegExp) {
  const items = await menuOf(p, row);
  if (!items.some(i => re.test(i))) throw new Error(`[${who()}] menu dòng không có mục ${re} (menu thực tế: ${items.length ? items.join(' | ') : 'không có menu'})`);
  await row.locator('button.ant-dropdown-trigger').first().click();
  await p.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: re }).first().click();
  await p.waitForTimeout(700);
}
const modalL = (p: Page) => p.locator('.ant-modal:visible').last();
const mbtn = (p: Page, re: RegExp) => modalL(p).getByRole('button', { name: re }).last();
const msgs = async (p: Page, ms = 2500) => { await p.waitForTimeout(ms); return norm((await p.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' | ')); };
async function toastNow(p: Page) {
  const t = p.locator('.ant-message-notice, .ant-notification-notice').last();
  await t.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  return norm((await t.textContent().catch(() => '')) || '');
}
/** Nút/mục có tên khớp (tìm trong toàn trang). */
const btnL = (p: Page, re: RegExp) => p.getByRole('button', { name: re }).filter({ visible: true }).first();
async function needBtn(p: Page, re: RegExp, what: string) {
  const b = btnL(p, re);
  if (!(await b.count())) throw new Error(`[${who()}] giao diện không có nút "${what}" (nút hiện có: ${norm((await p.locator('button:visible').allInnerTexts()).filter(Boolean).join(' | ')).slice(0, 200)})`);
  return b;
}
/** Mở chi tiết kết quả fixture bằng URL. */
async function openDetail(p: Page, id: string, tab = '') {
  await p.setViewportSize({ width: 1800, height: 1000 });
  await p.goto(`${ROUTE}/${id}${tab ? `?tab=${tab}` : ''}`, { waitUntil: 'networkidle' });
  await p.locator('h1, .ant-tabs').first().waitFor({ timeout: 15_000 }).catch(() => {});
  await p.waitForTimeout(800);
}
const bodyText = async (p: Page) => norm(await p.locator('.ant-layout-content').first().innerText());
const MOCK500 = { status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) };
const date8 = (s: string) => s.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];

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
async function downloadTo(p: Page, click: () => Promise<any>) {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20_000 }), click()]);
  const file = path.join(os.tmpdir(), `qc-res3-${Date.now()}-${dl.suggestedFilename()}`);
  await dl.saveAs(file);
  return { file, name: dl.suggestedFilename() };
}

test.describe.configure({ timeout: 90_000 });

// ================================================================ B — THEO DÕI / DANH SÁCH / TAB / LỌC / XUẤT (UC2.1)
const COLS = ['STT', 'Kỳ tự đánh giá', 'Đơn vị', 'Hạn nộp', 'Tiến độ chấm', 'Điểm', 'Trạng thái', 'Thao tác'];
const ACT_MENU = /bắt đầu chấm|tiếp tục chấm|trình duyệt|gửi bộ|xin mở khóa/i;
const noTabMsg = (name: string) => `[${who()}] giao diện không có tab "${name}"`;
/** Đối chiếu từng dòng giao diện (trang 1) với dòng API cùng bộ lọc (cùng thứ tự). */
async function uiVsApi(page: Page, filter: any) {
  const rows = await rowsData(page);
  const a = (await lst(filter, actor(), 1, 10)).content as any[];
  return { rows, a };
}

test.describe('Kết quả tự đánh giá › Phía Bộ › Danh sách & tab (UC2.1)', () => {
  test(tc('RES-B02'), async ({ page }) => {
    await openList(page, null);
    await expect(page.locator('.ant-segmented-item-selected')).toContainText('Định kỳ');
    const names = await tabNames(page);
    expect(names, `phải có tab "Cần xử lý" (các tab: ${names.join(', ')})`).toContain('Cần xử lý');
    await expect(page.getByRole('tab', { name: /^Cần xử lý/ })).toHaveAttribute('aria-selected', 'true');
  });
  test(tc('RES-B03'), async () => {
    for (const type of ['AdHoc', 'Periodic']) {
      const rows = await lstAll({ campaignType: type, phase: 'all', todo: true }, actor());
      const bad = rows.filter(x => x.status !== 'UnlockRequested' || x.isClosed);
      expect(bad.map(x => `${x.campaignName}/${x.organizationName}: ${x.statusName}${x.isClosed ? ' (đã kết thúc)' : ''}`), `[${who()}] todo=true (${type}) phải chỉ có Chờ mở khóa của kỳ đang diễn ra`).toEqual([]);
    }
  });
  test(tc('RES-B04'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    expect(await hasTab(page, 'Cần xử lý'), noTabMsg('Cần xử lý')).toBeTruthy();
    await layout();
    for (const kw of ['', 'zzqcxx_khongtontai_999', KW]) {
      await search(page, kw);
      const n = await tabCount(page, 'Cần xử lý');
      await clickTab(page, 'Cần xử lý');
      expect(await totalOf(page), `số trên tab Cần xử lý với từ khóa "${kw}"`).toBe(n);
      await clickTab(page, 'Tất cả');
    }
  });
  test(tc('RES-B05'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    await clickTab(page, 'Cần xử lý');
    await expect(page.getByText(/thời hạn/i), 'tab Cần xử lý không được có bộ lọc Thời hạn').toHaveCount(0);
  });
  for (const [id, type, tab, cmp] of [['B13', 'Periodic', 'Đã gửi', 'Submitted'], ['B14', 'AdHoc', 'Đã gửi', 'Submitted']] as const) {
    test(tc(`RES-${id}`), async ({ page }) => {
      if (type === 'AdHoc') await toState('DP', 'Submitted');
      await openList(page, { type });
      await clickTab(page, tab);
      const rows = await rowsData(page);
      expect(rows.length, 'tab Đã gửi phải có dữ liệu').toBeGreaterThan(0);
      for (const r of rows) {
        expect(statusOf(r.cells), `${nameOf(r.cells)}`).toBe(ST[cmp]);
        expect(r.cells[6], `${nameOf(r.cells)}: thiếu "Gửi ngày dd/mm/yyyy"`).toMatch(/Gửi ngày \d{2}\/\d{2}\/\d{4}/);
      }
      const n = await tabCount(page, tab);
      expect(await totalOf(page), 'số dòng = số trên tab').toBe(n);
      expect(n).toBe((await lst({ campaignType: type, phase: 'all', status: cmp }, actor())).totalElements);
    });
  }
  for (const [id, type] of [['B15', 'Periodic'], ['B16', 'AdHoc']] as const) {
    test(tc(`RES-${id}`), async ({ page }) => {
      if (type === 'AdHoc') await toState('BO', 'UnlockRequested');
      await openList(page, { type });
      await clickTab(page, 'Chờ mở khóa');
      const rows = await rowsData(page);
      for (const r of rows) {
        expect(statusOf(r.cells)).toBe('Chờ mở khóa');
        expect(r.cells[6], `${nameOf(r.cells)}: thiếu ghi chú "Xin dd/mm: lý do"`).toMatch(/Xin \d{2}\/\d{2}: .+/);
      }
      if (type === 'AdHoc') expect(rows.length, 'phải thấy yêu cầu mở khóa kỳ đột xuất của fixture').toBeGreaterThan(0);
      const n = await tabCount(page, 'Chờ mở khóa');
      expect(await totalOf(page)).toBe(n);
      expect(n).toBe((await lst({ campaignType: type, phase: 'all', status: 'UnlockRequested' }, actor())).totalElements);
    });
  }
  const STAB: [string, string, Key | null, string][] = [['B17', 'NotStarted', 'E2', 'Chưa thực hiện'], ['B18', 'Scoring', 'E1', 'Đang chấm điểm'], ['B19', 'PendingApproval', 'E4', 'Chờ duyệt'], ['B21', 'Approved', 'E3', 'Đã phê duyệt']];
  for (const [id, st, key, label] of STAB) test(tc(`RES-${id}`), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc' });
    await clickTab(page, label);
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(statusOf(r.cells), `${nameOf(r.cells)}/${r.cells[2]}`).toBe(label);
    if (st === 'NotStarted') for (const r of rows) expect(r.cells[4], 'tiến độ 0/n chỉ số').toMatch(/^0\/\d+ chỉ số/);
    if (st === 'Approved') for (const r of rows) expect(r.cells[6], 'chưa gửi nên không có "Gửi ngày"').not.toMatch(/Gửi ngày/);
    await search(page, KW);
    expect((await rowsData(page)).map(r => r.cells[2]), `${ORG_NAME[key!]} phải có trong tab ${label}`).toContain(ORG_NAME[key!]);
  });
  test(tc('RES-B20'), async ({ page }) => {
    await toState('DP', 'Submitted');
    const id = await rid('DP');
    const r = await post(id, 'reassess', { reason: 'qc.automation B20' }, 'canbo');
    expect(r.status, r.message).toBe(200);
    await openList(page, { type: 'AdHoc', kw: KW });
    await clickTab(page, 'Bị từ chối');
    expect((await rowsData(page)).map(x => x.cells[2]), 'phải xuất hiện ở tab Bị từ chối').toContain(ORG_NAME.DP);
    await clickTab(page, 'Đã gửi');
    expect((await rowsData(page)).map(x => x.cells[2]), 'phải biến mất khỏi tab Đã gửi').not.toContain(ORG_NAME.DP);
  });
  const MENU: [string, Key, string, RegExp[], RegExp?][] = [
    ['B31', 'E2', 'NotStarted', [/^xem$/i, /^gửi nhắc nhở$/i]], ['B32', 'E1', 'Scoring', [/^xem$/i, /^gửi nhắc nhở$/i]],
    ['B33', 'E4', 'PendingApproval', [/^xem$/i, /^gửi nhắc nhở$/i]], ['B35', 'E3', 'Approved', [/^xem$/i, /^gửi nhắc nhở$/i]],
    ['B36', 'DP', 'Submitted', [/^xem$/i, /^yêu cầu đánh giá lại$/i]], ['B37', 'BO', 'UnlockRequested', [/^xem$/i, /^duyệt mở khóa$/i, /^từ chối mở khóa$/i]],
  ];
  for (const [id, key, st, want] of MENU) test(tc(`RES-${id}`), async ({ page }) => {
    await toState(key, st);
    await openList(page, { type: 'AdHoc', kw: KW });
    const items = await menuOf(page, rowOfFx(page, key));
    for (const re of want) expect(items.some(i => re.test(i)), `[${who()}] thiếu mục ${re}; menu thực tế: ${items.join(' | ') || 'không có'}`).toBeTruthy();
    expect(items.length, `không được có mục nào khác; menu thực tế: ${items.join(' | ')}`).toBe(want.length);
  });
  for (const [id, st] of [['B38', 'Submitted'], ['B39', 'NotSent']] as const) test(tc(`RES-${id}`), async ({ page }) => {
    await openList(page, { type: 'Periodic', phase: 'closed', status: st });
    const row = rowsL(page).first();
    expect(await rowsL(page).count(), `phải có dòng ${ST[st]} của kỳ đã kết thúc`).toBeGreaterThan(0);
    const items = await menuOf(page, row);
    expect(items.length ? items.every(i => /^xem$/i.test(i)) && items.length === 1 : false, `[${who()}] menu dòng ${ST[st]} (kỳ đã kết thúc) chỉ được có "Xem"; thực tế: ${items.join(' | ') || 'không có mục nào'}`).toBeTruthy();
  });
  test(tc('RES-B41'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    const n = await rowsL(page).count();
    for (let i = 0; i < n; i++) {
      const items = await menuOf(page, rowsL(page).nth(i));
      expect(items.filter(x => ACT_MENU.test(x)), `[${who()}] dòng ${i + 1}: menu chứa thao tác của đơn vị (menu: ${items.join(' | ')})`).toEqual([]);
    }
  });
  test(tc('RES-B42'), async ({ page }) => {
    await openList(page, null);
    const sel = (await filterSelects(page).allInnerTexts()).map(norm);
    expect(sel.some(s => /đơn vị/i.test(s)), `phải có bộ lọc Đơn vị (bộ lọc thực tế: ${sel.join(' | ')})`).toBeTruthy();
  });
  test(tc('RES-B46'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc' });
    await search(page, 'RES3 phía');
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(nameOf(r.cells).toLowerCase()).toContain('res3 phía');
  });
  test(tc('RES-B48'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    await search(page, 'RES3 PHÍA BỘ'); const a = (await rowsData(page)).map(r => r.text);
    await search(page, 'res3 phía bộ'); const b = (await rowsData(page)).map(r => r.text);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });
  test(tc('RES-B49'), async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', d => { dialogSeen = true; d.dismiss().catch(() => {}); });
    await openList(page, { type: 'AdHoc' });
    for (const bad of ["' OR 1=1 --", '<script>alert(1)</script>']) {
      await search(page, bad);
      const body = (await page.locator('body').innerText()).toLowerCase();
      expect(body).not.toMatch(/internal server error|exception|stack ?trace|sqlexception/);
      expect(await page.locator('.ant-layout-content').count(), 'không được trắng trang').toBeGreaterThan(0);
      for (const r of await rowsData(page)) expect(r.text.toLowerCase(), `"${bad}" khớp dòng không chứa chuỗi`).toContain(bad.toLowerCase());
    }
    expect(dialogSeen, 'không được thực thi script').toBeFalsy();
  });
  test(tc('RES-B51'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    const n0 = await totalOf(page);
    await search(page, KW);
    const sel = filterSelects(page).filter({ hasText: /kỳ đánh giá/i }).first();
    await pickOption(page, sel, CAMP_NAME); await page.keyboard.press('Escape'); await settle(page);
    expect(await totalOf(page)).toBeLessThan(n0);
    await search(page, '');
    await page.locator('.ant-select-selection-item-remove, .ant-select-clear').first().click({ force: true }).catch(() => {});
    await settle(page);
    expect(await totalOf(page), 'xóa từ khóa và bỏ lọc phải về tổng ban đầu').toBe(n0);
  });
  test(tc('RES-B52'), async ({ page }) => {
    await toState('DP', 'Submitted');
    await openList(page, { type: 'Periodic' });
    await clickTab(page, 'Đã gửi');
    await search(page, 'qc');
    await setSegment(page, 'Đột xuất');
    await expect(page.getByRole('tab', { name: /^Đã gửi/ }), 'tab Đã gửi phải được giữ').toHaveAttribute('aria-selected', 'true');
    expect(await searchBox(page).inputValue(), 'từ khóa phải được giữ').toBe('qc');
    await setSegment(page, 'Định kỳ');
    await expect(page.getByRole('tab', { name: /^Đã gửi/ })).toHaveAttribute('aria-selected', 'true');
    expect(await searchBox(page).inputValue()).toBe('qc');
  });
  test(tc('RES-B54'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    const n = await totalOf(page);
    expect(await rowsL(page).count()).toBe(Math.min(10, n));
    expect(norm(await page.locator('.ant-pagination').first().innerText())).toMatch(/hiển thị 1-\d+ trong\s+\d+ bản ghi/i);
  });
  const EXP: [string, Q, string | null][] = [['B60', { type: 'Periodic' }, 'Đã gửi'], ['B61', { type: 'AdHoc' }, null], ['B62', { type: 'AdHoc' }, 'Đã gửi'], ['B63', { type: 'AdHoc' }, 'Chưa thực hiện']];
  for (const [id, q, tab] of EXP) test(tc(`RES-${id}`), async ({ page }) => {
    await layout();
    await openList(page, q);
    if (tab) await clickTab(page, tab);
    const n = await totalOf(page);
    const b = await needBtn(page, /xuất excel/i, 'Xuất Excel');
    const { file, name } = await downloadTo(page, () => b.click());
    expect(name).toMatch(/\.xlsx$/i);
    const rows = xlsxRows(file);
    expect(rows.length - 1, 'số dòng dữ liệu trong file = số bản ghi đang lọc').toBe(n);
    if (tab) for (const r of rows.slice(1)) expect(r.join(' | '), `dòng file: ${r.join(' | ')}`).toContain(tab);
  });
  test(tc('RES-B68'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    const { rows, a } = await uiVsApi(page, { campaignType: 'AdHoc', phase: 'all', fullTextSearch: KW });
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r, i) => {
      const x = a[i], sc = x.score == null ? '—' : String(x.score).replace('.', ',');
      expect(r.cells[5].replace(/\s+/g, ' '), `${r.cells[2]}: Điểm "điểm / tối đa"`).toBe(`${sc} / ${String(x.maxScore).replace('.', ',')}`);
    });
  });
  test(tc('RES-B72'), async ({ page }) => {
    needWrite();
    await toState('BO', 'UnlockRequested');
    await openList(page, { type: 'AdHoc', kw: KW });
    const c0 = await tabCount(page, 'Chờ mở khóa'), s0 = await tabCount(page, 'Đang chấm điểm');
    await rowAct(page, rowOfFx(page, 'BO'), /duyệt mở khóa/i);
    await mbtn(page, /^có$|xác nhận|đồng ý/i).click(); await settle(page, 1500);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page);
    expect(await tabCount(page, 'Chờ mở khóa')).toBe(c0 - 1);
    expect(await tabCount(page, 'Đang chấm điểm')).toBe(s0 + 1);
    expect((await getRes(await rid('BO'))).status).toBe('Scoring');
  });
  test(tc('RES-B73'), async ({ page }) => {
    await toState('DP', 'Submitted');
    await openList(page, { type: 'Periodic' });
    await setSegment(page, 'Đột xuất'); await clickTab(page, 'Đã gửi'); await search(page, KW);
    const url = page.url();
    expect(url).toMatch(/campaignType=AdHoc/); expect(url).toMatch(/status=Submitted/); expect(url).toContain('keyword=');
    await page.reload({ waitUntil: 'networkidle' }); await settle(page);
    await expect(page.locator('.ant-segmented-item-selected')).toContainText('Đột xuất');
    await expect(page.getByRole('tab', { name: /^Đã gửi/ })).toHaveAttribute('aria-selected', 'true');
    expect(await searchBox(page).inputValue()).toBe(KW);
  });
  test(tc('RES-B74'), async ({ page }) => {
    await page.goto(`${ROUTE}?campaignType=AdHoc&phase=all&status=zzz`, { waitUntil: 'networkidle' }); await settle(page);
    expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/internal server error|exception|undefined/);
    expect(await page.locator('.ant-layout-content').count()).toBeGreaterThan(0);
    const r = await api('GET', `${RES}?page=1&size=5&filter=${F({ campaignType: 'AdHoc', phase: 'all', status: 'zzz' })}`, undefined, actor());
    expect(r.status, `API với status="zzz" (HTTP ${r.status}: ${r.message})`).toBeLessThan(500);
  });
});

// ================================================================ R — NHẮC NHỞ (UC2.2)
const kwOf = (k: Key) => (inMI(k) ? KW_MI : KW);
/** Mở hộp thoại nhắc nhở từ menu dòng của kết quả fixture. */
async function openRemind(page: Page, k: Key) {
  await openList(page, { type: 'AdHoc', kw: kwOf(k) });
  await rowAct(page, rowOfFx(page, k), /nhắc nhở/i);
  const d = modalL(page); await d.waitFor({ state: 'visible', timeout: 8000 });
  return d;
}
const sendRemind = async (page: Page) => { await mbtn(page, /gửi nhắc nhở/i).click(); return toastNow(page); };
const remNoti = (as: string, id: string) => notiOf(as, id, 'ASSESSMENT_REMINDER');
const remHist = async (id: string) => (await histOf(id)).filter(h => /nhắc nhở/i.test(h.actionName));

test.describe('Kết quả tự đánh giá › Phía Bộ › Nhắc nhở (UC2.2)', () => {
  const rem = async (k: Key, st: string) => { await toState(k, st); const id = await rid(k); return { id, r: await remind([id]) }; };
  const periodicFx = async () => {
    const c = (await listApi(CAMP, 'RES3 fixture P')).find((x: any) => x.name === 'qc.automation RES3 fixture P');
    const rows = c ? await lstAll({ campaignIds: [c.id], campaignType: 'Periodic', phase: 'all' }, 'canbo') : [];
    rows.forEach(x => EXTRA_OK.add(x.id));
    return rows;
  };
  test(tc('RES-R28'), async () => {
    await toState('E2', 'NotStarted'); const id = await rid('E2');
    for (const as of ['ldd', 'ldp']) { const r = await remind([id], as); expect(r.status, `${as}: HTTP ${r.status}: ${r.message}`).toBe(403); }
  });
  test(tc('RES-R29'), async () => {
    const r = await remind([await rid('E2')], 'xemonly');
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(403);
  });
});

// ================================================================ W — YÊU CẦU ĐÁNH GIÁ LẠI (UC2.3)
/** Đưa kết quả về Đã gửi rồi mở hộp thoại Yêu cầu đánh giá lại từ menu dòng. */
async function openReassess(page: Page, k: Key = 'DP') {
  await toState(k, 'Submitted');
  await openList(page, { type: 'AdHoc', kw: KW });
  await rowAct(page, rowOfFx(page, k), /đánh giá lại/i);
  const d = modalL(page); await d.waitFor({ state: 'visible', timeout: 8000 });
  return d;
}
const submitReassess = (page: Page) => mbtn(page, /gửi yêu cầu/i).click();
const reHist = async (id: string) => (await histOf(id)).filter(h => /đánh giá lại/i.test(h.actionName));
const reNoti = (as: string, id: string) => notiOf(as, id, 'ASSESSMENT_REASSESSMENT_REQUESTED');
const REASON_ERR = /vui lòng nhập lý do/i;

test.describe('Kết quả tự đánh giá › Phía Bộ › Yêu cầu đánh giá lại (UC2.3)', () => {
  test(tc('RES-W08'), async () => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    for (const n of [256, 1001]) {
      const r = await post(id, 'reassess', { reason: LONG(n) }, 'canbo');
      expect(r.status, `${n} ký tự: HTTP ${r.status}: ${r.message}`).toBe(400);
      expect(r.message).toContain('255');
    }
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-W14'), async () => {
    needWrite();
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const n0 = ((await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[]).length;
    expect((await post(id, 'reassess', { reason: 'qc.automation W14' }, 'canbo')).status).toBe(200);
    await toState('DP', 'Submitted');
    const subs = (await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[];
    expect(subs.length, 'Hồ sơ gửi Bộ có thêm lần gửi mới').toBe(n0 + 1);
    const acts = (await histOf(id)).map(h => h.actionName).join(' | ');
    for (const a of [/đánh giá lại/i, /trình duyệt/i, /phê duyệt/i, /gửi/i]) expect(acts).toMatch(a);
  });
  test(tc('RES-W17'), async () => {
    needWrite();
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const before = ((await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[]);
    expect((await post(id, 'reassess', { reason: 'qc.automation W17' }, 'canbo')).status).toBe(200);
    const after = ((await api('GET', `${RES}/${id}/submissions`, undefined, actor())).data?.submissions ?? []) as any[];
    expect(after.length, 'lần gửi cũ vẫn còn trong Hồ sơ gửi Bộ').toBe(before.length);
    expect(after[0].attachment?.fileName).toBeTruthy(); expect(after[0].sentDate).toBeTruthy();
  });
  test(tc('RES-W20'), async () => {
    await toState('E2', 'NotStarted'); await toState('E3', 'Approved'); await toState('E1', 'Scoring');
    for (const k of ['E2', 'E3', 'E1'] as Key[]) {
      const id = await rid(k), st = (await getRes(id)).status;
      const r = await post(id, 'reassess', { reason: 'qc.automation W20' }, actor());
      expect(r.status, `${ST[st]}: HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
      expect((await getRes(id)).status).toBe(st);
    }
  });
  test(tc('RES-W23'), async () => {
    await toState('BO', 'Submitted'); const id = await rid('BO');
    const r = await post(id, 'reassess', { reason: 'qc.automation W23' }, actor());
    expect([403, 404], `HTTP ${r.status}: ${r.message}`).toContain(r.status);
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-W28'), async ({ page }) => {
    needWrite();
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const s0 = (await getRes(id)).score;
    expect((await post(id, 'reassess', { reason: 'qc.automation W28' }, 'canbo')).status).toBe(200);
    expect((await getRes(id)).score, 'điểm giữ nguyên').toBe(s0);
    await openDetail(page, id);
    expect(await page.getByRole('button', { name: /lưu nháp|^lưu|chấm điểm|trình duyệt/i }).count(), `[${who()}] Bộ không có thao tác chấm điểm/lưu`).toBe(0);
  });
});

// ================================================================ O — DUYỆT / TỪ CHỐI MỞ KHÓA (UC2.4a, UC2.4b)
async function openUnlockAct(page: Page, act: RegExp, k: Key = 'BO') {
  await toState(k, 'UnlockRequested');
  await openList(page, { type: 'AdHoc', kw: KW });
  await rowAct(page, rowOfFx(page, k), act);
}
const yes = (p: Page) => mbtn(p, /^có$|duyệt mở khóa|xác nhận|đồng ý/i);
const unHist = async (id: string, re: RegExp) => (await histOf(id)).filter(h => re.test(h.actionName));
const APPROVE = /duyệt mở khóa/i, REJECT = /từ chối mở khóa/i;
const unNoti = (as: string, id: string, type: string) => notiOf(as, id, type);
async function periodicRows(): Promise<any[]> {
  const c = (await listApi(CAMP, 'RES3 fixture P')).find((x: any) => x.name === 'qc.automation RES3 fixture P');
  const rows = c ? await lstAll({ campaignIds: [c.id], campaignType: 'Periodic', phase: 'all' }, 'canbo') : [];
  rows.forEach(x => EXTRA_OK.add(x.id));
  return rows;
}
const NO_PERIODIC = 'Kỳ định kỳ fixture chưa sinh kết quả (hệ thống sinh theo job); không dựng được kết quả định kỳ để thao tác';

test.describe('Kết quả tự đánh giá › Phía Bộ › Duyệt mở khóa (UC2.4a)', () => {
  test(tc('RES-O03'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE); const id = await rid('BO'); const h0 = (await histOf(id)).length;
    await mbtn(page, /^không$|hu[ỷủ]/i).click(); await page.waitForTimeout(800);
    expect(await page.locator('.ant-modal:visible').count()).toBe(0);
    expect((await getRes(id)).status).toBe('UnlockRequested'); expect((await histOf(id)).length).toBe(h0);
  });
  test(tc('RES-O04'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE); const id = await rid('BO');
    await yes(page).click(); await toastNow(page);
    const h = (await unHist(id, /duyệt mở khóa/i))[0];
    expect(h).toBeTruthy(); expect(h.fromStatus).toBe('UnlockRequested'); expect(h.toStatus).toBe('Scoring');
    expect(h.actorName).toBeTruthy(); expect(h.at).toBeTruthy();
  });
  test(tc('RES-O06'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE, 'DP'); const id = await rid('DP');
    const subs = async () => ((await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[]).length;
    const n0 = await subs(), d0 = await getRes(id), s0 = d0.score, v = leavesOf(d0)[0].score === 3 ? 5 : 3;
    await yes(page).click(); await toastNow(page);
    expect((await saveScores(id, 'all', v)).status).toBe(200);
    await toState('DP', 'Submitted');
    expect(await subs(), 'Hồ sơ gửi Bộ có thêm lần gửi').toBe(n0 + 1);
    expect((await getRes(id)).score, 'điểm mới được áp dụng').not.toBe(s0);
  });
  test(tc('RES-O07'), async ({ page }) => {
    await toState('BO', 'UnlockRequested');
    await openList(page, { type: 'AdHoc', kw: KW });
    await clickTab(page, 'Cần xử lý');
  });
  test(tc('RES-O09'), async ({ page }) => {
    needWrite();
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    await openList(page, { type: 'AdHoc', kw: KW });
    await clickTab(page, 'Chờ mở khóa');
    await rowAct(page, rowOfFx(page, 'BO'), APPROVE); await yes(page).click(); await toastNow(page);
    expect((await getRes(id)).status).toBe('Scoring');
  });
  test(tc('RES-O10'), async ({ page }) => {
    needWrite();
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    await openDetail(page, id);
    await (await needBtn(page, /duyệt mở khóa/i, 'Duyệt mở khóa')).click(); await yes(page).click(); await toastNow(page); await page.waitForTimeout(1200);
    expect(await bodyText(page)).toContain('Đang chấm điểm');
  });
  test(tc('RES-O16'), async ({ page }) => {
    await toState('BO', 'UnlockRequested');
    await openList(page, { type: 'AdHoc', kw: KW });
    const items = await menuOf(page, rowOfFx(page, 'BO'));
    expect(items.some(i => APPROVE.test(i)) && items.some(i => REJECT.test(i)), `[${who()}] menu: ${items.join(' | ') || 'không có'}`).toBeTruthy();
  });
  test(tc('RES-O17'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE); const id = await rid('BO');
    await yes(page).click(); expect(await toastNow(page)).toMatch(/thành công/i);
    expect((await getRes(id)).status).toBe('Scoring');
  });
  test(tc('RES-O19'), async () => {
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    for (const act of ['approve-unlock', 'reject-unlock']) {
      const r = await post(id, act, { reason: 'qc.automation O19' }, 'xemonly');
      expect(r.status, `${act}: HTTP ${r.status}: ${r.message}`).toBe(403);
    }
  });
  test(tc('RES-O21'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE); await yes(page).click();
    expect(await toastNow(page)).toBe('Duyệt mở khóa thành công');
  });
  test(tc('RES-O22'), async ({ page }) => {
    needWrite();
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    const d0 = await getRes(id), subs = async () => ((await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[]).length;
    const n0 = await subs();
    await openList(page, { type: 'AdHoc', kw: KW });
    await rowAct(page, rowOfFx(page, 'BO'), APPROVE); await yes(page).click(); await toastNow(page);
    const d1 = await getRes(id);
    expect(d1.score, 'điểm giữ nguyên').toBe(d0.score); expect(await subs(), 'số bản gửi giữ nguyên').toBe(n0);
    await openDetail(page, id); expect(await bodyText(page)).toMatch(/điểm tạm tính/i);
  });
});

test.describe('Kết quả tự đánh giá › Phía Bộ › Từ chối mở khóa (UC2.4b)', () => {
  const reasonBox = (p: Page) => modalL(p).locator('textarea').first();
  const confirmReject = (p: Page) => mbtn(p, /xác nhận từ chối|^từ chối$/i);
  test(tc('RES-O26'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO');
    await reasonBox(page).fill('   '); await confirmReject(page).click(); await page.waitForTimeout(800);
    const err = norm((await modalL(page).locator('.ant-form-item-explain-error').allInnerTexts()).join(' ') + ' ' + (await msgs(page, 300)));
    expect(err).toMatch(REASON_ERR);
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-O27'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO');
    await reasonBox(page).fill(LONG(255)); await confirmReject(page).click();
    expect(await toastNow(page)).toMatch(/thành công/i);
    expect((await unHist(id, /từ chối mở khóa/i))[0].note).toHaveLength(255);
  });
  test(tc('RES-O29'), async () => {
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    for (const body of [undefined, { reason: null }, { reason: '' }, { reason: '   ' }, { reason: LONG(256) }]) {
      const r = await post(id, 'reject-unlock', body, actor());
      expect(r.status, `${JSON.stringify(body)?.slice(0, 40)}: HTTP ${r.status}: ${r.message}`).toBe(400);
    }
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-O30'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO'); const h0 = (await histOf(id)).length;
    await reasonBox(page).fill('qc.automation O30'); await mbtn(page, /^h[ủu]y$|^huỷ$/i).click(); await page.waitForTimeout(800);
    expect(await page.locator('.ant-modal:visible').count()).toBe(0);
    expect((await getRes(id)).status).toBe('UnlockRequested'); expect((await histOf(id)).length).toBe(h0);
  });
  test(tc('RES-O31'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO'); const L = 'qc.automation O31 lý do';
    await reasonBox(page).fill(L); await confirmReject(page).click(); await toastNow(page);
    const h = (await unHist(id, /từ chối mở khóa/i))[0];
    expect(h.fromStatus).toBe('UnlockRequested'); expect(h.toStatus).toBe('Submitted'); expect(h.note).toBe(L); expect(h.actorName).toBeTruthy();
  });
  test(tc('RES-O33'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO');
    await reasonBox(page).fill('qc.automation O33'); await confirmReject(page).click(); await toastNow(page);
    const n0 = (await unNoti(bo, id, 'ASSESSMENT_UNLOCK_REQUESTED')).length;
    const r = await post(id, 'request-unlock', { reason: 'qc.automation O33 xin lại' }, 'canbo');
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(200);
    expect((await getRes(id)).status).toBe('UnlockRequested');
    await page.waitForTimeout(1000);
    expect((await unNoti(bo, id, 'ASSESSMENT_UNLOCK_REQUESTED')).length, 'Bộ nhận thông báo yêu cầu mới').toBe(n0 + 1);
  });
  test(tc('RES-O35'), async ({ page }) => {
    needWrite();
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    await openDetail(page, id);
    await (await needBtn(page, /từ chối mở khóa/i, 'Từ chối mở khóa')).click();
    await reasonBox(page).fill('qc.automation O35'); await confirmReject(page).click(); await toastNow(page);
    expect((await getRes(id)).status).toBe('Submitted');
    await page.waitForTimeout(1000);
    expect(await page.getByRole('button', { name: /duyệt mở khóa|từ chối mở khóa/i }).count(), 'mất nút Duyệt/Từ chối').toBe(0);
  });
  test(tc('RES-O37'), async () => {
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    for (const as of ['ldp', 'cbdp', 'xemonly']) {
      const r = await post(id, 'reject-unlock', { reason: 'qc.automation O37' }, as);
      expect(r.status, `${as}: HTTP ${r.status}: ${r.message}`).toBe(403);
    }
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-O39'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO');
    let called = false; page.on('request', r => { if (/reject-unlock/.test(r.url())) called = true; });
    await reasonBox(page).fill('qc.automation O39'); await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    expect(await page.locator('.ant-modal:visible').count(), 'hộp thoại phải đóng').toBe(0);
    expect(called, 'không được gọi API').toBeFalsy();
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
});

// ================================================================ H — CHI TIẾT / HỒ SƠ GỬI BỘ / LỊCH SỬ (UC2.5)
const detailTab = async (p: Page, re: RegExp) => { await p.getByText(re).first().click(); await p.waitForTimeout(900); };
const secBtn = (p: Page, re: RegExp) => p.getByRole('button', { name: re });
let BIG: any = null;
/** Kết quả có nhiều chỉ số nhất trong phạm vi tác nhân (chỉ đọc). */
async function bigResult() {
  if (BIG) return BIG;
  const all = [...await lstAll({ campaignType: 'AdHoc', phase: 'all' }, 'canbo'), ...await lstAll({ campaignType: 'Periodic', phase: 'all' }, 'canbo')];
  return (BIG = all.sort((a, b) => b.indicatorCount - a.indicatorCount)[0]);
}
const fmtD = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const closedOne = async (status: string, type = 'Periodic') => (await lst({ campaignType: type, phase: 'closed', status }, 'canbo', 1, 5)).content?.[0];

test.describe('Kết quả tự đánh giá › Phía Bộ › Chi tiết kết quả (UC2.5)', () => {
  test(tc('RES-H04'), async ({ page }) => {
    await toState('E2', 'NotStarted');
    await openDetail(page, await rid('E2'));
    expect(await page.locator('.ant-table input, .ant-layout-content input[type=number], .ant-input-number-input').count(), 'ô điểm không nhập được').toBe(0);
    expect(await secBtn(page, /lưu nháp|trình duyệt|hủy chỉnh sửa|huỷ chỉnh sửa/i).count(), `[${who()}] không có nút Lưu nháp/Trình duyệt/Hủy chỉnh sửa`).toBe(0);
  });
  test(tc('RES-H09'), async ({ page }) => {
    await toState('E4', 'PendingApproval'); await openDetail(page, await rid('E4'));
    expect(await secBtn(page, /^(trình duyệt|phê duyệt|từ chối|bắt đầu chấm|tiếp tục chấm|lưu nháp)/i).count(), `[${who()}] chi tiết Phía Bộ không có nút của đơn vị`).toBe(0);
  });
  test(tc('RES-H10'), async ({ page }) => {
    await toState('E3', 'Approved'); await openDetail(page, await rid('E3'));
    expect(await secBtn(page, /gửi bộ/i).count(), `[${who()}] không được có nút Gửi Bộ`).toBe(0);
  });
  test(tc('RES-H11'), async ({ page }) => {
    await toState('DP', 'Submitted'); await openDetail(page, await rid('DP'));
    expect(await secBtn(page, /xin mở khóa/i).count(), `[${who()}] không được có nút Xin mở khóa`).toBe(0);
  });
  test(tc('RES-H12'), async ({ page }) => {
    await toState('BO', 'UnlockRequested'); await openDetail(page, await rid('BO'));
    expect(await bodyText(page)).toMatch(/Đơn vị đang yêu cầu mở khóa \(QC [^,]+, \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\): “qc\.automation xin mở khóa”/);
  });
  test(tc('RES-H13'), async ({ page }) => {
    await toState('DP', 'Submitted'); await toState('E2', 'NotStarted');
    for (const k of ['DP', 'E2'] as Key[]) { await openDetail(page, await rid(k)); expect(await bodyText(page), ORG_NAME[k]).not.toMatch(/Đơn vị đang yêu cầu mở khóa/); }
  });
  test(tc('RES-H14'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP'); const d = await getRes(id);
    await openDetail(page, id);
    const t = await bodyText(page);
    for (const x of ['TIẾN ĐỘ CHẤM', `${d.scoredCount} / ${d.indicatorCount}`, 'ĐIỂM CHÍNH THỨC', `${d.score} / ${d.maxScore}`, 'XẾP LOẠI', d.levelName, 'MINH CHỨNG']) expect(t, x).toContain(x);
  });
  test(tc('RES-H15'), async ({ page }) => {
    await toState('DP', 'Submitted'); await openDetail(page, await rid('DP'));
    expect(await bodyText(page)).toContain('ĐIỂM CHÍNH THỨC');
    await openDetail(page, await partialScoring());
    expect(await bodyText(page)).toContain('ĐIỂM TẠM TÍNH');
  });
  test(tc('RES-H17'), async ({ page }) => {
    const id = await partialScoring(); const d = await getRes(id);
    let att = leavesOf(d).flatMap((i: any) => i.attachments ?? [])[0];
    if (!att) {
      const u = await upload(id, 'qca-minhchung.pdf'); const i1 = leavesOf(d)[0];
      expect((await api('PUT', `${RES}/${id}/scores`, { scores: [{ indicatorSetIndicatorId: i1.indicatorSetIndicatorId, score: i1.score ?? 6, note: 'giải trình qca', attachmentIds: [u.data.id] }] }, 'canbo')).status).toBe(200);
      att = (await getRes(id)).indicators.flatMap((i: any) => i.attachments ?? [])[0];
    }
    await openDetail(page, id);
    const popup = page.waitForEvent('popup', { timeout: 6000 }).catch(() => null);
    const dl = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
    await page.getByText(att.fileName).first().click();
    const [pp, dd] = await Promise.all([popup, dl]);
    if (dd) expect(dd.suggestedFilename()).toContain(att.fileName.replace(/\.pdf$/, ''));
    else {
      expect(pp, 'bấm tên tệp phải tải/mở tệp').toBeTruthy();
      await pp!.waitForLoadState('load').catch(() => {});
      const u = pp!.url();
      expect(u, `liên kết tệp: ${u}`).not.toMatch(/localhost|chrome-error/);
    }
  });
  test(tc('RES-H21'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const h = await histOf(id);
    await openDetail(page, id, 'history');
    const t = await bodyText(page);
    expect(t, 'nhãn Lịch sử (n)').toContain(`Lịch sử (${h.length})`);
    for (const x of h.slice(0, 3)) { expect(t).toContain(x.actionName); expect(t).toContain(x.actorName); }
    for (let i = 1; i < h.length; i++) expect(new Date(h[i - 1].at) >= new Date(h[i].at), 'mới nhất trước').toBeTruthy();
    expect(t).toMatch(/\(.+→.+\)|từ .+ sang/i);
  });
  test(tc('RES-H23'), async () => {
    needWrite();
    await toState('DP', 'UnlockRequested'); const id = await rid('DP');
    expect((await post(id, 'reject-unlock', { reason: 'qc.automation H23' }, 'lanhdaobo')).status).toBe(200);
    await toState('DP', 'Scoring'); const all = await histOf(id);
    for (const [a, name] of [['UnlockRejected', 'UnlockRejected'], ['UnlockApproved', 'UnlockApproved']]) {
      const r = await histOf(id, a, actor());
      expect(r.length, a).toBeGreaterThan(0);
      for (const x of r) expect(x.action).toBe(name);
      expect(r.length).toBe(all.filter(x => x.action === name).length);
    }
  });
  test(tc('RES-H24'), async () => {
    const r = await api('GET', `${RES}/${await rid('DP')}/history?action=zzz`, undefined, actor());
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect(r.message).toContain('Hành động lịch sử không hợp lệ');
  });
  test(tc('RES-H25'), async ({ page }) => {
    test.setTimeout(180_000);
    needWrite();
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    expect((await post(id, 'reject-unlock', { reason: 'qc.automation H25 từ chối' }, 'lanhdaobo')).status).toBe(200);
    expect((await post(id, 'request-unlock', { reason: 'qc.automation H25 xin lại' }, 'canbo')).status).toBe(200);
    expect((await post(id, 'approve-unlock', undefined, 'lanhdaobo')).status).toBe(200);
    await openDetail(page, id, 'history');
    const t = await bodyText(page);
    for (const x of ['Xin mở khóa', 'Duyệt mở khóa', 'Từ chối mở khóa', 'qc.automation H25 từ chối']) expect(t, x).toContain(x);
  });
  for (const [id, type] of [['H26', 'Periodic'], ['H27', 'AdHoc']] as const) test(tc(`RES-${id}`), async ({ page }) => {
    await openList(page, { type, phase: 'closed' });
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.cells[3], nameOf(r.cells)).toContain('Đã kết thúc');
    await rowsL(page).first().getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(1800);
    const t = await bodyText(page);
    expect(t).toMatch(/chế độ chỉ xem/i);
    for (const x of [/Chi tiết chỉ số|Chấm điểm/, /Hồ sơ gửi Bộ/, /Lịch sử/, /Điểm|ĐIỂM/]) expect(t).toMatch(x);
  });
  test(tc('RES-H28'), async ({ page }) => {
    const id = await partialScoring(); await openDetail(page, id);
    await page.getByPlaceholder(/tìm mã hoặc tên chỉ số/i).fill('QCARES1I2'); await page.waitForTimeout(900);
    const t = await bodyText(page);
    expect(t).toContain('QCARES1I2'); expect(t).not.toContain('QCARES1I3'); expect(t).not.toContain('QCARES1I1');
  });
  test(tc('RES-H29'), async ({ page }) => {
    const id = await partialScoring(); const d = await getRes(id); await openDetail(page, id);
    await pickOption(page, page.locator('.ant-select:visible').filter({ hasText: /trạng thái chấm/i }).first(), /chưa/i); await page.waitForTimeout(900);
    const t = await bodyText(page); const miss = d.indicatorCount - d.scoredCount;
    for (const i of leavesOf(d)) { if (i.score == null) expect(t).toContain(i.indicatorCode); else expect(t).not.toContain(i.indicatorCode); }
    expect(t).toContain(`Còn thiếu ${miss} chỉ số`);
  });
  test(tc('RES-H32'), async ({ page }) => {
    await toState('DP', 'Submitted'); await openDetail(page, await rid('DP'));
    expect(await secBtn(page, /xuất excel/i).count(), `[${who()}] chi tiết không có Xuất Excel (BR-5)`).toBe(0);
  });
  test(tc('RES-H36'), async ({ page }) => {
    const id = await partialScoring(); const d = await getRes(id);
    expect(d.groups.reduce((a: number, g: any) => a + g.score, 0), 'tổng điểm = tổng điểm nhóm').toBe(d.score ?? 0);
    expect(d.groups.reduce((a: number, g: any) => a + g.maxScore, 0)).toBe(d.maxScore);
    await openDetail(page, id); expect(await bodyText(page)).toContain(`${d.score} / ${d.maxScore}`);
    const big = await getRes((await bigResult()).id, actor());
    expect(big.groups.reduce((a: number, g: any) => a + g.score, 0), `${big.campaignName}/${big.organizationName}: tổng điểm nhóm`).toBe(big.score ?? 0);
  });
  test(tc('RES-H38'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP'); const d = await getRes(id);
    const sc = (await api('GET', `dti/score-scales/${d.scaleId ?? SCALE}`)).data ?? (await api('GET', `dti/score-scales/${SCALE}`)).data;
    const pct = d.score / d.maxScore * 100;
    const lv = (sc.levels as any[]).find(l => pct >= l.fromPercent && (pct < l.toPercent || (l.toPercent >= 100 && pct <= 100)));
    expect(lv?.name, `không xác định được mức cho ${pct}%`).toBeTruthy();
    expect(d.levelName, `xếp loại API với ${pct}% theo thang`).toBe(lv.name);
    await openDetail(page, id); expect(await bodyText(page)).toContain(`XẾP LOẠI ${lv.name}`);
  });
  test(tc('RES-H39'), async ({ page }) => {
    test.setTimeout(180_000);
    needWrite();
    await toState('DP', 'Submitted'); const id = await rid('DP');
    expect((await remind([await rid('E2')], 'canbo')).status).toBe(200);
    expect((await post(id, 'request-unlock', { reason: 'qc.automation H39' }, 'canbo')).status).toBe(200);
    expect((await post(id, 'reject-unlock', { reason: 'qc.automation H39' }, 'lanhdaobo')).status).toBe(200);
    expect((await post(id, 'request-unlock', { reason: 'qc.automation H39 b' }, 'canbo')).status).toBe(200);
    expect((await post(id, 'approve-unlock', undefined, 'lanhdaobo')).status).toBe(200);
    await toState('DP', 'Submitted');
    expect((await post(id, 'reassess', { reason: 'qc.automation H39' }, 'canbo')).status).toBe(200);
    const h = await histOf(id);
    for (const re of [/đánh giá lại/i, /duyệt mở khóa/i, /từ chối mở khóa/i]) {
      const x = h.find(y => re.test(y.actionName)); expect(x, String(re)).toBeTruthy(); expect(x.actorName, `người thực hiện ${x.actionName}`).toMatch(/^QC /);
    }
    const e2 = (await histOf(await rid('E2'))).find(y => /nhắc nhở/i.test(y.actionName));
    expect(e2?.actorName).toMatch(/^QC /);
    await openDetail(page, id, 'history'); expect(await bodyText(page)).toContain('QC Cán bộ');
  });
});

// ================================================================ M — THÔNG BÁO (UC2.x, TB-004..TB-012)
const bellBtn = (p: Page) => p.locator('button[aria-label="Thông báo"]').first();
const popL = (p: Page) => p.locator('.notification-bell-popover');
const unreadOf = async (as: string) => (await api('GET', `${NOTI}/unread-count`, undefined, as)).data?.unreadCount as number;
async function openBell(p: Page, goto = true) {
  if (goto) await openList(p, { type: 'AdHoc', kw: KW });
  await bellBtn(p).click(); await popL(p).waitFor({ state: 'visible', timeout: 8000 }); await p.waitForTimeout(1000);
}
const badgeOf = async (p: Page) => { const el = bellBtn(p).locator('.ant-badge-count').first(); if (!(await el.count())) return 0; const t = norm(await el.innerText({ timeout: 3000 }).catch(() => '0')); return t === '99+' ? 99 : Number(t || 0); };
const itemsL = (p: Page) => popL(p).locator('button.group');
/** Xin mở khóa mới cho BO (Bộ nhận thông báo "Yêu cầu mở khóa" chưa đọc). */
async function freshUnlockReq(reason = 'qc.automation xin mở khóa M', k: Key = 'BO') {
  const id = await rid(k);
  if ((await getRes(id)).status === 'UnlockRequested') await post(id, 'reject-unlock', { reason: 'qc.automation' }, bo);
  await toState(k, 'Submitted');
  const r = await post(id, 'request-unlock', { reason }, k === 'DP' ? 'cbdp' : 'canbo'); expect(r.status, `${r.status} ${r.message}`).toBe(200);
  await new Promise(r => setTimeout(r, 1200));
  return id;
}
/** Gửi lại kết quả của k (đánh giá lại rồi gửi) → thông báo "Đã có kết quả tự đánh giá" mới. */
async function freshSend(k: Key) {
  const id = await rid(k);
  await toState(k, 'Submitted');
  expect((await post(id, 'reassess', { reason: 'qc.automation M' }, 'canbo')).status).toBe(200);
  await toState(k, 'Submitted'); await new Promise(r => setTimeout(r, 1200));
  return id;
}
const newest = (l: any[]) => l.sort((a, b) => +new Date(b.createdOnDate) - +new Date(a.createdOnDate))[0];

test.describe('Kết quả tự đánh giá › Phía Bộ › Thông báo', () => {
  test(tc('RES-M02'), async ({ page }) => {
    needWrite();
    const id = await rid('DP'); await toState('DP', 'Submitted'); const n0 = (await notiOf(actor(), id, 'ASSESSMENT_SENT')).length;
    await freshSend('DP');
    const n = await notiOf(actor(), id, 'ASSESSMENT_SENT');
    expect(n.length, 'Lãnh đạo Bộ nhận thông báo mới').toBe(n0 + 1);
    expect(n[0].title).toBe('Đã có kết quả tự đánh giá'); expect(n[0].description).toContain(CAMP_NAME); expect(n[0].description).toContain(ORG_NAME.DP);
    await openBell(page);
    expect(norm(await popL(page).innerText())).toContain('Đã có kết quả tự đánh giá');
  });
  for (const [t, as] of [['M03', 'canbo'], ['M04', 'ldd']] as const) test(tc(`RES-${t}`), async () => {
    needWrite();
    const id = await rid('DP'); await toState('DP', 'Submitted'); const n0 = (await notiOf(as, id, 'ASSESSMENT_SENT')).length;
    await freshSend('DP');
    const n = await notiOf(as, id, 'ASSESSMENT_SENT');
    expect(n.length, `${ROLE_NAME[as]} nhận thông báo gửi kết quả (đang có ${n0})`).toBe(n0 + 1);
    expect(n[0].description).toContain(CAMP_NAME);
  });
  test(tc('RES-M11'), async () => {
    needWrite();
    const id = await rid('BO'); await toState('BO', 'Submitted');
    const L = 'qc.automation M11 lý do'; const c0 = (await notiOf('canbo', id, 'ASSESSMENT_REASSESSMENT_REQUESTED')).length, d0 = (await notiOf(actor(), id, 'ASSESSMENT_REASSESSMENT_REQUESTED')).length;
    expect((await post(id, 'reassess', { reason: L }, 'canbo')).status).toBe(200); await new Promise(r => setTimeout(r, 1200));
    const c = await notiOf('canbo', id, 'ASSESSMENT_REASSESSMENT_REQUESTED'), d = await notiOf(actor(), id, 'ASSESSMENT_REASSESSMENT_REQUESTED');
    expect(c.length, 'CB đơn vị nhận').toBe(c0 + 1); expect(c[0].description).toContain(`Lý do: ${L}`); expect(c[0].title).toBe('Yêu cầu đánh giá lại');
    expect(d.length, `${who()} nhận`).toBe(d0 + 1); expect(d[0].description).toContain(L);
  });
  test(tc('RES-M12'), async () => {
    needWrite();
    const id = await freshUnlockReq('qc.automation M12'); const n0 = (await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_APPROVED')).length;
    expect((await post(id, 'approve-unlock', undefined, bo)).status).toBe(200); await new Promise(r => setTimeout(r, 1200));
    const n = await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_APPROVED');
    expect(n.length).toBe(n0 + 1); expect(n[0].title).toBe('Đã mở khóa kết quả'); expect(n[0].description).toContain(CAMP_NAME);
  });
  test(tc('RES-M13'), async () => {
    needWrite();
    const id = await freshUnlockReq('qc.automation M13'); const n0 = (await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_REJECTED')).length;
    expect((await post(id, 'reject-unlock', { reason: 'qc.automation M13 lý do' }, bo)).status).toBe(200); await new Promise(r => setTimeout(r, 1200));
    const n = await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_REJECTED');
    expect(n.length).toBe(n0 + 1); expect(n[0].title).toBe('Từ chối mở khóa'); expect(n[0].description).toContain('Lý do: qc.automation M13 lý do');
  });
  test(tc('RES-M16'), async () => {
    needWrite();
    const id = await freshUnlockReq('qc.automation M16'); const n0 = (await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_APPROVED')).length;
    const rs = await Promise.all([post(id, 'approve-unlock', undefined, bo), post(id, 'approve-unlock', undefined, bo)]);
    expect(rs.filter(r => r.status === 200).length).toBe(1); await new Promise(r => setTimeout(r, 1500));
    expect((await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_APPROVED')).length, 'không tạo thông báo trùng').toBe(n0 + 1);
  });
  test(tc('RES-M18'), async () => {
    for (const h of [{}, { Authorization: 'Bearer abc.def.ghi' }]) {
      const r = await fetch(`${API_BASE}/api/v1/${NOTI}?page=1&size=10`, { headers: h });
      expect(r.status, JSON.stringify(h)).toBe(401);
    }
  });
  test(tc('RES-M19'), async () => {
    needWrite();
    const idr = await rid('MD'); expect((await remind([idr], 'canbo')).status).toBe(200); await new Promise(r => setTimeout(r, 1000));
    const other = (await notiOf('cbdp', idr, 'ASSESSMENT_REMINDER')).find(n => !n.isRead);
    test.skip(!other, 'Không có thông báo chưa đọc của CB địa phương để thử');
    const r = await api('PUT', `${NOTI}/read`, { ids: [other!.id] }, actor());
    expect(r.status, `HTTP ${r.status}`).toBeLessThan(500);
    const after = (await notiOf('cbdp', idr, 'ASSESSMENT_REMINDER')).find(n => n.id === other!.id);
    expect(after.isRead, `thông báo của người khác không được đánh dấu đã đọc (HTTP ${r.status}: ${r.message})`).toBe(false);
  });
});

// ================================================================ Q — NGOẠI LỆ / LỖI / BIÊN
const NOLEAK = /Exception|StackTrace|\bat \S+\.\S+\(|\.cs:|Npgsql|SqlException|\/app\/|\/src\/|[A-Z]:\\/;
const J500 = (b = '{"message":"System.Exception: lỗi nội bộ at Foo.Bar()"}') => ({ status: 500, contentType: 'application/json', body: b });
const apiRaw = async (m: string, u: string, as: string, body?: any) => {
  const r = await fetch(`${API_BASE}/api/v1/${u}`, { method: m, headers: { Authorization: `Bearer ${tokenOf(as)}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : body });
  const t = await r.text(); return { status: r.status, text: t };
};
const RE_REM = /\/dti\/assessment-results\/reminders/, RE_REA = /\/reassess$/, RE_APP = /\/approve-unlock$/, RE_REJ = /\/reject-unlock$/;
const rBox = (p: Page) => modalL(p).locator('textarea').first();
const rConfirm = (p: Page) => mbtn(p, /xác nhận từ chối|^từ chối$/i);
const failToast = async (p: Page) => { const t = await msgs(p, 2000); return t; };
const modalBusy = (p: Page) => modalL(p).locator('.ant-btn-loading').count();
let XC: any = null;
/** Kỳ phụ có tên chứa HTML/Unicode/rất dài (dựng một lần, 1 đơn vị fixture E2; chỉ đọc). */
async function xssCamp() {
  if (XC) return XC;
  const name = `qc.automation RES3 XSS <b>x</b> & "q" ${'Dài-'.repeat(25)}`;
  const e2 = (await fx()).org.E2;
  const d = await ensureCamp(name, SET_BA, [e2]);
  const o = d.organizations.find((x: any) => x.organizationId === e2);
  EXTRA_OK.add(o.assessmentResultId);
  return (XC = { name, id: o.assessmentResultId });
}
async function staleRow(page: Page, k: Key, after: () => Promise<any>) {
  await toState(k, 'UnlockRequested');
  await openList(page, { type: 'AdHoc', kw: KW });
  expect(await rowOfFx(page, k).count()).toBeGreaterThan(0);
  await after();
}

test.describe('Kết quả tự đánh giá › Phía Bộ › Ngoại lệ & lỗi', () => {
  for (const [t, re, mode] of [['Q07', RE_APP, '500'], ['Q08', RE_APP, 'off'], ['Q09', RE_REJ, '500'], ['Q10', RE_REJ, 'off']] as const) test(tc(`RES-${t}`), async ({ page }) => {
    needWrite();
    const rej = re === RE_REJ;
    await openUnlockAct(page, rej ? REJECT : APPROVE); const id = await rid('BO');
    if (rej) await modalL(page).locator('textarea').first().fill(`qc.automation ${t} giữ lại`);
    await page.route(re, r => mode === '500' ? r.fulfill(J500()) : r.abort('internetdisconnected'));
    await (rej ? mbtn(page, /xác nhận từ chối|^từ chối$/i) : yes(page)).click();
    const m = await failToast(page);
    expect(m, 'phải báo lỗi').not.toBe(''); expect(m).not.toMatch(/thành công/i); expect(m).not.toMatch(NOLEAK);
    await expect(modalL(page), 'hộp thoại giữ nguyên').toBeVisible();
    if (rej) expect(await modalL(page).locator('textarea').first().inputValue()).toBe(`qc.automation ${t} giữ lại`);
    expect(await modalBusy(page)).toBe(0);
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-Q14'), async () => {
    for (const s of ['bogus', 'organizationName,asc', 'x;drop', '']) {
      const r = await api('GET', `${RES}?page=1&size=10&sort=${encodeURIComponent(s)}`, undefined, actor());
      expect(r.status, `sort=${s}: HTTP ${r.status} ${r.message}`).toBe(200);
    }
  });
  test(tc('RES-Q15'), async () => {
    for (const u of ['abc', 'abc/history', 'abc/submissions']) {
      const r = await api('GET', `${RES}/${u}`, undefined, actor());
      expect([400, 404], `${u}: HTTP ${r.status} ${r.message}`).toContain(r.status); expect(String(r.message)).not.toMatch(NOLEAK);
    }
  });
  test(tc('RES-Q17'), async () => {
    const r = await post(FAKE, 'reject-unlock', { reason: 'x' }, actor());
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(404);
  });
  test(tc('RES-Q18'), async () => {
    const id = await rid('DP');
    const calls = [['GET', `${RES}/abc`], ['GET', `${RES}?filter={bad`], ['POST', `${RES}/${FAKE}/approve-unlock`], ['POST', `${RES}/${FAKE}/reject-unlock`, '{"reason":'], ['POST', `${RES}/${FAKE}/reassess`, 'xx'], ['GET', `${RES}/${id}/history?action=zzz`], ['PUT', `${NOTI}/read`, '{"ids":["zz"]}']];
    for (const [m, u, b] of calls) {
      const r = await apiRaw(m, u, actor(), m === 'GET' ? undefined : (b ?? '{}'));
      expect(r.text, `${m} ${u}: HTTP ${r.status}`).not.toMatch(NOLEAK);
      expect(r.status, `${m} ${u}`).toBeLessThan(500);
      let j: any = {}; try { j = JSON.parse(r.text); } catch {}
      expect(Object.keys(j).filter(k => !['code', 'message', 'data', 'errorDetail', 'totalTime', 'isSuccess'].includes(k)), `${m} ${u}: body chỉ gồm code/message`).toEqual([]);
    }
  });
  test(tc('RES-Q20'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO');
    await modalL(page).locator('textarea').first().fill('qc.automation Q20');
    await page.route(RE_REJ, r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"code":401,"message":"Unauthorized"}' }));
    await mbtn(page, /xác nhận từ chối|^từ chối$/i).click();
    await page.waitForURL(/login|dang-nhap|sign-?in|auth/i, { timeout: 10_000 }).catch(() => {});
    expect(page.url(), 'phải chuyển về đăng nhập').toMatch(/login|dang-nhap|sign-?in|auth/i);
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
});

// ================================================================ K — PHÂN QUYỀN / BẢO MẬT / HIỆU NĂNG
const PARENT = new Map<string, string | null>();
async function underOrg(id: string, root: string): Promise<boolean> {
  for (let i = 0; i < 8 && id; i++) {
    if (id === root) return true;
    if (!PARENT.has(id)) PARENT.set(id, (await api('GET', `organizations/${id}`)).data?.parentId ?? null);
    id = PARENT.get(id) as string;
  }
  return false;
}
const ALLR = ['canbo', 'lanhdaobo', 'ldd', 'ldp', 'cbdp', 'xemonly'];
const totalAs = async (as: string, type: string) => (await lst({ campaignType: type, phase: 'all' }, as, 1, 1)).totalElements as number;
const HDR_BTN = async (p: Page) => ({ excel: await p.getByRole('button', { name: /xuất excel/i }).count() > 0, remind: await p.getByRole('button', { name: /gửi nhắc nhở/i }).count() > 0 });
const exportAs = (as: string, filter: any = {}) => apiRaw('GET', `${RES}/export?filter=${F(filter)}`, as);

test.describe('Kết quả tự đánh giá › Phía Bộ › Phân quyền & bảo mật & hiệu năng', () => {
  test(tc('RES-K01'), async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: (test.info().project.use as any).baseURL, storageState: { cookies: [], origins: [] } }); const p = await ctx.newPage();
    try {
      await p.goto(ROUTE, { waitUntil: 'networkidle' });
      await p.waitForURL(/login|dang-nhap|sign-?in|auth/i, { timeout: 10_000 }).catch(() => {});
      expect(p.url(), 'chưa đăng nhập phải về trang đăng nhập').toMatch(/login|dang-nhap|sign-?in|auth/i);
      expect(await p.locator('tbody tr.ant-table-row').count()).toBe(0);
    } finally { await ctx.close(); }
  });
  test(tc('RES-K02'), async () => {
    for (const h of [{}, { Authorization: 'Bearer abc.def.ghi' }]) {
      for (const u of [`${RES}?page=1&size=10`, `${RES}/${await rid('DP')}`]) {
        const r = await fetch(`${API_BASE}/api/v1/${u}`, { headers: h }); expect(r.status, `${u} ${JSON.stringify(h)}`).toBe(401);
      }
    }
  });
  test(tc('RES-K04'), async () => {
    for (const t of ['Periodic', 'AdHoc']) expect(await totalAs('canbo', t), `tổng ${t}`).toBe(await totalAs('superadmin', t));
  });
  for (const [t, root] of [['K06', ORG_DP], ['K07', ORG_DP]] as const) test(tc(`RES-${t}`), async ({ page }) => {
    const rows = await lstAll({ campaignType: 'AdHoc', phase: 'all' }, actor());
    expect(rows.length).toBeGreaterThan(0);
    const out = [] as string[];
    for (const r of rows) if (!(await underOrg(r.organizationId, root))) out.push(r.organizationName);
    expect(out.length, `[${who()}] thấy ${out.length}/${rows.length} dòng ngoài đơn vị mình/đơn vị con, vd: ${[...new Set(out)].slice(0, 4).join('; ')}`).toBe(0);
    await openList(page, { type: 'AdHoc' }); expect(await totalOf(page)).toBe(rows.length);
  });
  test(tc('RES-K08'), async () => {
    for (const t of ['Periodic', 'AdHoc']) expect(await totalAs(actor(), t), `Lãnh đạo đơn vị: tổng ${t} (phạm vi all)`).toBe(await totalAs('superadmin', t));
  });
  test(tc('RES-K09'), async ({ browser }) => {
    const id = await rid('BO');
    const r = await api('GET', `${RES}/${id}`, undefined, 'cbdp');
    expect(r.status, `API: HTTP ${r.status}`).toBeGreaterThanOrEqual(400);
    const { ctx, page } = await asRole(browser, 'cbdp');
    try { await openDetail(page, id); expect(await bodyText(page)).not.toContain(ORG_NAME.BO); } finally { await ctx.close(); }
  });
  test(tc('RES-K10'), async () => {
    const id = await rid('BO');
    for (const as of ['cbdp', 'ldp']) for (const s of ['history', 'submissions']) {
      const r = await api('GET', `${RES}/${id}/${s}`, undefined, as);
      expect(r.status, `${as} ${s}: HTTP ${r.status}`).toBeGreaterThanOrEqual(400); expect(r.data ?? null, `${as} ${s}: không có dữ liệu`).toBeFalsy();
    }
  });
  test(tc('RES-K11'), async ({ browser }) => {
    const want: Record<string, boolean[]> = { canbo: [true, true], lanhdaobo: [false, false], ldd: [false, false], ldp: [false, false] };
    const bad: string[] = [];
    for (const [as, [ex, rm]] of Object.entries(want)) {
      const { ctx, page } = await asRole(browser, as);
      try { await openList(page, { type: 'AdHoc', kw: KW }); const b = await HDR_BTN(page); if (b.excel !== ex) bad.push(`${as}: Xuất Excel=${b.excel} (cần ${ex})`); if (b.remind !== rm) bad.push(`${as}: Gửi nhắc nhở=${b.remind} (cần ${rm})`); } finally { await ctx.close(); }
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('RES-K12'), async ({ browser }) => {
    test.setTimeout(180_000);
    needWrite();
    await toState('BO', 'UnlockRequested'); await toState('DP', 'UnlockRequested');
    const want: Record<string, boolean> = { canbo: true, lanhdaobo: true, ldd: true, ldp: false, cbdp: false };
    const bad: string[] = [];
    for (const [as, yes_] of Object.entries(want)) {
      const k: Key = as === 'ldp' || as === 'cbdp' ? 'DP' : 'BO';
      const { ctx, page } = await asRole(browser, as);
      try {
        await openList(page, { type: 'AdHoc', kw: KW });
        const m = await menuOf(page, rowOfFx(page, k)); const has = m.some(i => APPROVE.test(i)) && m.some(i => REJECT.test(i));
        if (has !== yes_) bad.push(`${as}: Duyệt/Từ chối mở khóa=${has} (cần ${yes_}; menu: ${m.join(' | ') || 'không có'})`);
      } finally { await ctx.close(); }
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('RES-K15'), async () => {
    test.setTimeout(180_000);
    needWrite();
    await toState('DP', 'Submitted'); const id = await rid('DP'); const bad: string[] = [];
    for (const as of ['xemonly', 'ldp', 'cbdp', 'lanhdaobo', 'ldd', 'canbo']) {
      await toState('DP', 'Submitted');
      const r = await post(id, 'reassess', { reason: `qc.automation K15 ${as}` }, as); const ok = as === 'canbo';
      if (r.status !== (ok ? 200 : 403)) bad.push(`${as}: HTTP ${r.status} ${r.message} (cần ${ok ? 200 : 403})`);
      const st = (await getRes(id)).status; if (!ok && st !== 'Submitted') bad.push(`${as}: trạng thái bị đổi ${st}`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('RES-K16'), async () => {
    test.setTimeout(180_000);
    needWrite();
    const id = await rid('BO'); const bad: string[] = [];
    await toState('BO', 'UnlockRequested');
    for (const as of ['xemonly', 'ldp', 'cbdp']) for (const [a, b] of [['approve-unlock', undefined], ['reject-unlock', { reason: 'qc.automation K16' }]] as const) {
      const r = await post(id, a, b, as); if (r.status !== 403) bad.push(`${as} ${a}: HTTP ${r.status} (cần 403)`);
    }
    if ((await getRes(id)).status !== 'UnlockRequested') bad.push('trạng thái bị đổi bởi vai trò không quyền');
    for (const as of ['canbo', 'lanhdaobo']) {
      const r = await post(id, 'reject-unlock', { reason: `qc.automation K16 ${as}` }, as); if (r.status !== 200) bad.push(`${as} reject-unlock: HTTP ${r.status} ${r.message} (cần 200)`);
      await toState('BO', 'UnlockRequested');
    }
    const r = await post(id, 'approve-unlock', undefined, 'ldd'); if (r.status !== 200) bad.push(`ldd approve-unlock: HTTP ${r.status} ${r.message} (cần 200)`);
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('RES-K17'), async () => {
    const bad: string[] = [];
    for (const as of ['canbo', 'cbdp', 'lanhdaobo', 'ldd', 'ldp', 'xemonly']) {
      const r = await exportAs(as, { campaignType: 'AdHoc', phase: 'all', keyword: KW }); const ok = ['canbo', 'cbdp'].includes(as);
      if (r.status !== (ok ? 200 : 403)) bad.push(`${as}: HTTP ${r.status} (cần ${ok ? 200 : 403})`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('RES-K18'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    const f = await downloadTo(page, async () => (await needBtn(page, /xuất excel/i, 'Xuất Excel')).click());
    const rows = xlsxRows(f.file); expect(rows.length).toBeGreaterThan(1);
    const ci = rows[0].findIndex(c => /^đơn vị$/i.test(c)); expect(ci, 'file phải có cột Đơn vị').toBeGreaterThanOrEqual(0);
    const names = [...new Set(rows.slice(1).map(r => r[ci]))].filter(Boolean);
    const ours = new Set((await lstAll({ campaignType: 'AdHoc', phase: 'all' }, actor())).map(r => r.organizationName));
    const extra = names.filter(n => !ours.has(n));
    expect(extra, `file chứa đơn vị ngoài phạm vi: ${extra.slice(0, 4).join('; ')}`).toEqual([]);
    fs.rmSync(f.file, { force: true });
  });
  test(tc('RES-K20'), async ({ page }) => {
    await toState('E2', 'NotStarted');
    await openList(page, { type: 'AdHoc', kw: KW_MI });
    await (await needBtn(page, /gửi nhắc nhở/i, 'Gửi nhắc nhở')).click();
    const t = norm(await modalL(page).innerText());
    await mbtn(page, /hu[ỷủ]/i).click();
    const ours = new Set((await lstAll({ campaignType: 'AdHoc', phase: 'all' }, actor())).map(r => r.organizationName));
    const listed = [...t.matchAll(/qc\.automation RES3 ĐV\d|QA - (?:Địa phương|Đơn vị Bộ)/g)].map(m => m[0].trim());
    const extra = listed.filter(n => !ours.has(n));
    expect(extra, `hộp thoại liệt kê đơn vị ngoài phạm vi: ${extra.join('; ')}`).toEqual([]);
  });
  test(tc('RES-K21'), async () => {
    needWrite();
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    const r = await post(id, 'approve-unlock', undefined, 'cbdp');
    expect([403, 404], `HTTP ${r.status} ${r.message}`).toContain(r.status);
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-K24'), async () => {
    needWrite();
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    const r = await post(id, 'approve-unlock', undefined, 'xemonly');
    expect(r.status, `HTTP ${r.status}`).toBe(403); expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-K25'), async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    const t0 = Date.now();
    await page.goto(`${ROUTE}${qs({ type: 'AdHoc' })}`, { waitUntil: 'commit' });
    await page.locator('tbody tr.ant-table-row').first().waitFor({ timeout: 15_000 });
    const ms = Date.now() - t0; expect(ms, `tải 10 dòng ${ms}ms`).toBeLessThanOrEqual(3000);
  });
});
