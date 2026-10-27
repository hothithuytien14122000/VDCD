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
  test(tc('RES-B01'), async ({ page }) => {
    await openList(page, null);
    const heads = await headsOf(page);
    for (const c of COLS) expect(heads.some(h => h.toLowerCase() === c.toLowerCase()), `thiếu cột "${c}" (cột thực tế: ${heads.join(' | ')})`).toBeTruthy();
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map(r => r.cells[2])).size, 'danh sách phải có dữ liệu của nhiều đơn vị').toBeGreaterThan(1);
  });
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
  test(tc('RES-B06'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    await clickTab(page, 'Chưa gửi');
    const got = (await rowsData(page)).map(r => `${r.cells[2]}:${statusOf(r.cells)}`);
    for (const [k, s] of [['E2', 'NotStarted'], ['E1', 'Scoring'], ['E4', 'PendingApproval'], ['E3', 'Approved']] as const)
      expect(got, `tab Chưa gửi phải có ${ORG_NAME[k]} (${ST[s]}) của kỳ đang diễn ra; thực tế: ${got.join('; ') || 'rỗng'}`).toContain(`${ORG_NAME[k]}:${ST[s]}`);
    for (const g of got) expect(g, 'không được có Đã gửi / Chờ mở khóa').not.toMatch(/Đã gửi|Chờ mở khóa/);
  });
  test(tc('RES-B07'), async ({ page }) => {
    await openList(page, { type: 'Periodic' });
    await setPhase(page, /đã kết thúc/i);
    const names = await tabNames(page);
    expect(names, `tab thực tế: ${names.join(', ')}`).not.toContain('Chưa gửi');
    expect(names).not.toContain('Sắp đến hạn');
  });
  test(tc('RES-B08'), async ({ page }) => {
    await openList(page, null);
    const el = page.getByRole('tab', { name: /^Chưa gửi/ }).first();
    expect(await el.count(), 'không có tab Chưa gửi').toBeGreaterThan(0);
    expect(norm(await el.innerText()), 'nhãn tab Chưa gửi không được kèm số').toBe('Chưa gửi');
  });
  test(tc('RES-B09'), async ({ page }) => {
    await openList(page, { type: 'AdHoc', kw: KW });
    await layout();
    expect(await hasTab(page, 'Sắp đến hạn'), noTabMsg('Sắp đến hạn')).toBeTruthy();
    await clickTab(page, 'Sắp đến hạn');
    const got = (await rowsData(page)).map(r => nameOf(r.cells));
    expect(got, 'kỳ fixture còn 430 ngày > Nhắc trước hạn 3 ngày nên không được có trong tab').not.toContain(CAMP_NAME);
  });
  test(tc('RES-B10'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    expect(await hasTab(page, 'Sắp đến hạn'), noTabMsg('Sắp đến hạn')).toBeTruthy();
    await clickTab(page, 'Sắp đến hạn');
    for (const r of await rowsData(page)) expect(r.cells[3], `${nameOf(r.cells)}: kỳ có Nhắc trước hạn trống chỉ vào tab khi còn đúng 0 ngày`).toMatch(/Còn 0 ngày|Hôm nay|Còn 1 ngày/);
  });
  test(tc('RES-B11'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    expect(await hasTab(page, 'Sắp đến hạn'), noTabMsg('Sắp đến hạn')).toBeTruthy();
    await clickTab(page, 'Sắp đến hạn');
    for (const r of await rowsData(page)) expect(r.cells[3], `${nameOf(r.cells)}: kỳ đã kết thúc không thuộc Sắp đến hạn`).not.toContain('Đã kết thúc');
  });
  test(tc('RES-B12'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    expect(await hasTab(page, 'Sắp đến hạn'), noTabMsg('Sắp đến hạn')).toBeTruthy();
    await clickTab(page, 'Sắp đến hạn');
    for (const r of await rowsData(page)) expect(['Đã gửi', 'Chờ mở khóa']).not.toContain(statusOf(r.cells));
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
  test(tc('RES-B22'), async ({ page }) => {
    for (const type of ['Periodic', 'AdHoc']) {
      const s = (await api('GET', `${RES}/summary?filter=${F({ campaignType: type, phase: 'all' })}`, undefined, actor())).data;
      const sum = (s.statuses as any[]).reduce((a, x) => a + x.count, 0);
      expect(s.statuses.length, `${type}: số nhóm trạng thái`).toBe(8);
      expect(s.total, `${type}: total phải bằng tổng các trạng thái`).toBe(sum);
    }
    await openList(page, { type: 'AdHoc' });
    const s = (await api('GET', `${RES}/summary?filter=${F({ campaignType: 'AdHoc', phase: 'all' })}`, undefined, actor())).data;
    expect(await tabCount(page, 'Tất cả')).toBe(s.total);
    for (const x of s.statuses as any[]) if (await tabCount(page, x.statusName) >= 0) expect(await tabCount(page, x.statusName), x.statusName).toBe(x.count);
  });
  test(tc('RES-B23'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc' });
    for (const name of ['Đã gửi', 'Chờ mở khóa', 'Đã phê duyệt', 'Đang chấm điểm']) {
      const n = await tabCount(page, name);
      await clickTab(page, name);
      expect(await totalOf(page), `tab ${name}`).toBe(n);
    }
  });
  test(tc('RES-B24'), async ({ page }) => {
    needWrite();
    const id = await rid('BO');
    await toState('BO', 'Submitted');
    const A = (await getRes(id)).score;
    expect((await post(id, 'reassess', { reason: 'qc.automation B24' }, 'canbo')).status).toBe(200);
    const d = await getRes(id);
    const sc2 = d.indicators.filter((i: any) => i.isLeaf && i.isScored).map((i: any) => ({ indicatorSetIndicatorId: i.indicatorSetIndicatorId, score: 4 }));
    expect((await api('PUT', `${RES}/${id}/scores`, { scores: sc2 }, 'canbo')).status).toBe(200);
    await toState('BO', 'Submitted');
    const B = (await getRes(id)).score;
    expect(B, 'điểm gửi lần 2 phải khác lần 1 để phân biệt').not.toBe(A);
    await openList(page, { type: 'AdHoc', kw: KW });
    const row = (await rowsData(page)).find(r => r.cells[2] === ORG_NAME.BO)!;
    expect(row.cells[5], `điểm ở danh sách phải là điểm bản gửi mới nhất (${B})`).toContain(String(B));
    const subs = (await api('GET', `${RES}/${id}/submissions`, undefined, actor())).data;
    const list = Array.isArray(subs) ? subs : subs?.items ?? subs?.submissions ?? [];
    expect(list.length, 'Hồ sơ gửi Bộ phải có ≥ 2 lần gửi').toBeGreaterThanOrEqual(2);
    await openDetail(page, id, 'dossier');
    expect(await bodyText(page), 'bản gần nhất phải ghi "Bản chính thức"').toMatch(/Bản chính thức/);
  });
  test(tc('RES-B25'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    await clickTab(page, 'Chưa gửi');
    expect(await page.locator('tbody input[type=checkbox]').count(), 'mỗi dòng phải có ô chọn').toBeGreaterThan(0);
    expect(await page.locator('thead input[type=checkbox]').count(), 'tiêu đề phải có ô chọn tất cả').toBeGreaterThan(0);
  });
  test(tc('RES-B26'), async ({ page }) => {
    await toState('DP', 'Submitted');
    await openList(page, { type: 'AdHoc', kw: KW });
    expect(await page.locator('tbody input[type=checkbox]').count(), 'chưa có cột ô chọn (xem RES-B25)').toBeGreaterThan(0);
    for (const k of ['DP', 'BO'] as Key[]) expect(await rowOfFx(page, k).locator('input[type=checkbox]').count(), `${ORG_NAME[k]} đã gửi: không có ô chọn`).toBe(0);
  });
  test(tc('RES-B27'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    const all = page.locator('thead input[type=checkbox]').first();
    expect(await all.count(), 'chưa có ô chọn tất cả (xem RES-B25)').toBeGreaterThan(0);
    await all.check();
    const boxes = page.locator('tbody input[type=checkbox]');
    for (let i = 0; i < await boxes.count(); i++) expect(await boxes.nth(i).isChecked()).toBeTruthy();
    expect(await rowOfFx(page, 'DP').locator('input[type=checkbox]').count()).toBe(0);
  });
  test(tc('RES-B28'), async ({ page }) => {
    await openList(page, { type: 'AdHoc', kw: KW });
    const b = await needBtn(page, /gửi nhắc nhở/i, 'Gửi nhắc nhở');
    await expect(b, 'chưa chọn dòng nào thì nút Gửi nhắc nhở phải bị vô hiệu').toBeDisabled();
  });
  test(tc('RES-B29'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    await clickTab(page, 'Chưa gửi');
    const box = page.locator('tbody input[type=checkbox]').first();
    expect(await box.count(), 'chưa có ô chọn dòng (xem RES-B25)').toBeGreaterThan(0);
    const b = await needBtn(page, /gửi nhắc nhở/i, 'Gửi nhắc nhở');
    await box.check(); await expect(b).toBeEnabled();
    await box.uncheck(); await expect(b).toBeDisabled();
  });
  test(tc('RES-B30'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    const rows = rowsL(page);
    const n = await rows.count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n; i++) {
      const r = rows.nth(i), who2 = norm(await r.locator('td').nth(2).innerText()) + '/' + statusOf((await rowsData(page))[i].cells);
      expect(await r.getByRole('button', { name: 'Xem chi tiết' }).count(), `${who2}: nút Xem chi tiết`).toBe(1);
      expect(await r.locator('button.ant-dropdown-trigger').count(), `${who2}: nút Xem chi tiết phải kèm mũi tên xuống`).toBe(1);
    }
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
  test(tc('RES-B34'), async ({ page }) => {
    await toState('E4', 'Rejected');
    await openList(page, { type: 'AdHoc', kw: KW });
    const items = await menuOf(page, rowOfFx(page, 'E4'));
    for (const re of [/^xem$/i, /^gửi nhắc nhở$/i]) expect(items.some(i => re.test(i)), `thiếu mục ${re}; menu thực tế: ${items.join(' | ') || 'không có'}`).toBeTruthy();
    expect(items.length, items.join(' | ')).toBe(2);
  });
  for (const [id, st] of [['B38', 'Submitted'], ['B39', 'NotSent']] as const) test(tc(`RES-${id}`), async ({ page }) => {
    await openList(page, { type: 'Periodic', phase: 'closed', status: st });
    const row = rowsL(page).first();
    expect(await rowsL(page).count(), `phải có dòng ${ST[st]} của kỳ đã kết thúc`).toBeGreaterThan(0);
    const items = await menuOf(page, row);
    expect(items.length ? items.every(i => /^xem$/i.test(i)) && items.length === 1 : false, `[${who()}] menu dòng ${ST[st]} (kỳ đã kết thúc) chỉ được có "Xem"; thực tế: ${items.join(' | ') || 'không có mục nào'}`).toBeTruthy();
  });
  test(tc('RES-B40'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    const row = rowOfFx(page, 'E2');
    const items = await menuOf(page, row);
    expect(items[0] ?? '', `[${who()}] mục Xem phải đứng đầu menu; menu thực tế: ${items.join(' | ') || 'không có'}`).toMatch(/^xem$/i);
    await rowAct(page, row, /^xem$/i);
    await expect(page).toHaveURL(new RegExp(await rid('E2')));
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
  test(tc('RES-B43'), async ({ page }) => {
    await openList(page, null);
    const sel = filterSelects(page).filter({ hasText: /đơn vị/i }).first();
    expect(await sel.count(), 'chưa có bộ lọc Đơn vị (xem RES-B42)').toBeGreaterThan(0);
    await sel.click();
    const opts = (await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').allInnerTexts()).map(norm);
    const allowed = new Set((await lstAll({ campaignType: 'Periodic', phase: 'all' }, actor())).map(x => x.organizationName));
    for (const o of opts) expect(allowed.has(o), `đơn vị "${o}" ngoài phạm vi tài khoản`).toBeTruthy();
  });
  test(tc('RES-B44'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    const sel = filterSelects(page).filter({ hasText: /kỳ đánh giá/i }).first();
    await sel.click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dd.waitFor({ state: 'visible' });
    const opts = dd.locator('.ant-select-item-option');
    expect(await opts.count()).toBeGreaterThan(1);
    const picked: string[] = [];
    for (const i of [0, 1]) { picked.push(norm(await opts.nth(i).innerText())); await opts.nth(i).click(); await page.waitForTimeout(500); }
    await page.keyboard.press('Escape'); await settle(page);
    for (const r of await rowsData(page)) expect(picked, `dòng "${nameOf(r.cells)}" ngoài 2 kỳ đã chọn`).toContain(nameOf(r.cells));
    expect(await tabCount(page, 'Tất cả'), 'số trên tab Tất cả cập nhật theo bộ lọc').toBe(await totalOf(page));
  });
  test(tc('RES-B45'), async ({ page }) => {
    await openList(page, null);
    const sel = (await filterSelects(page).allInnerTexts()).map(norm);
    expect(sel.some(s => /thời hạn/i.test(s)), `phải có bộ lọc Thời hạn (bộ lọc thực tế: ${sel.join(' | ')})`).toBeTruthy();
  });
  test(tc('RES-B46'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc' });
    await search(page, 'RES3 phía');
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(nameOf(r.cells).toLowerCase()).toContain('res3 phía');
  });
  test(tc('RES-B47'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    await search(page, 'RES3 ĐV3');
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.cells[2]).toContain('RES3 ĐV3');
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
  test(tc('RES-B50'), async ({ page }) => {
    await toState('DP', 'Submitted');
    await openList(page, { type: 'AdHoc' });
    await clickTab(page, 'Đã gửi');
    await search(page, KW);
    const sel = filterSelects(page).filter({ hasText: /kỳ đánh giá/i }).first();
    await pickOption(page, sel, CAMP_NAME); await page.keyboard.press('Escape'); await settle(page);
    const rows = await rowsData(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) { expect(nameOf(r.cells)).toBe(CAMP_NAME); expect(statusOf(r.cells)).toBe('Đã gửi'); expect(r.text).toContain(KW); }
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
  test(tc('RES-B53'), async ({ page }) => {
    const tot: Record<string, number> = {};
    for (const type of ['AdHoc', 'Periodic'] as const) {
      await openList(page, { type });
      tot[type] = await totalOf(page);
      expect(tot[type], `tổng bản ghi UI của ${type}`).toBe((await lst({ campaignType: type, phase: 'all' }, actor())).totalElements);
      const a = (await lst({ campaignType: type, phase: 'all' }, actor())).content as any[];
      for (const x of a.slice(0, 3)) expect(x.campaignType).toBe(type);
      await rowsL(page).first().getByRole('button', { name: 'Xem chi tiết' }).click();
      await page.waitForTimeout(1800);
      expect(await bodyText(page), `chi tiết dòng đầu của ${type}: Phân loại`).toContain(type === 'AdHoc' ? 'Đột xuất' : 'Định kỳ');
    }
    expect(tot.AdHoc).not.toBe(tot.Periodic);
  });
  test(tc('RES-B54'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    const n = await totalOf(page);
    expect(await rowsL(page).count()).toBe(Math.min(10, n));
    expect(norm(await page.locator('.ant-pagination').first().innerText())).toMatch(/hiển thị 1-\d+ trong\s+\d+ bản ghi/i);
  });
  test(tc('RES-B55'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    const before = (await rowsData(page)).map(r => r.text).join('|');
    await page.locator('.ant-pagination-item-2').first().click(); await settle(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    const rows = await rowsData(page);
    expect(rows.map(r => r.text).join('|')).not.toBe(before);
    expect(rows[0].cells[0], 'STT tiếp nối trang 1').toBe('11');
  });
  test(tc('RES-B56'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    const n = await totalOf(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await pickOption(page, page.locator(PAGER_SEL).first(), '20'); await settle(page);
    expect(await rowsL(page).count()).toBe(Math.min(20, n));
    expect(await totalOf(page)).toBe(n);
  });
  test(tc('RES-B57'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    await page.locator('.ant-pagination-item-2').first().click(); await settle(page);
    expect(norm(await page.locator('.ant-pagination').first().innerText())).toMatch(/hiển thị 11-\d+ trong\s+\d+ bản ghi/i);
  });
  test(tc('RES-B58'), async ({ page }) => {
    await page.route(/\/api\/v1\/dti\/assessment-results\?/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: '', data: { page: 1, size: 10, totalElements: 0, totalPages: 0, numberOfElements: 0, content: [], allowedActions: ['VIEW'] } }) }));
    await openList(page, { type: 'Periodic' });
    expect(await rowsL(page).count()).toBe(0);
    expect(await bodyText(page), 'danh sách rỗng phải hiển thị "Chưa có dữ liệu"').toContain('Chưa có dữ liệu');
  });
  test(tc('RES-B59'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    await search(page, 'zzqcxx_khongtontai_999');
    expect(await rowsL(page).count()).toBe(0);
    expect(await bodyText(page), 'tìm không ra phải hiển thị "Không tìm thấy kết quả phù hợp"').toContain('Không tìm thấy kết quả phù hợp');
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
  test(tc('RES-B64'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    await search(page, 'zzqcxx_khongtontai_999');
    const b = await needBtn(page, /xuất excel/i, 'Xuất Excel');
    let dl = false; page.on('download', () => { dl = true; });
    await b.click();
    expect(await toastNow(page)).toContain('Không có dữ liệu để xuất');
    expect(dl, 'không được tải file').toBeFalsy();
  });
  test(tc('RES-B65'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    const b = await needBtn(page, /xuất excel/i, 'Xuất Excel');
    await page.route(/\/dti\/assessment-results\/export/, r => r.fulfill(MOCK500));
    let dl = false; page.on('download', () => { dl = true; });
    await b.click();
    const t = await toastNow(page);
    expect(t).toContain('Xuất dữ liệu thất bại. Vui lòng thử lại');
    expect(t.toLowerCase()).not.toMatch(/exception|stack|internal server/);
    expect(dl).toBeFalsy();
  });
  test(tc('RES-B66'), async ({ page }) => {
    for (const phase of ['active', 'closed']) {
      await openList(page, { type: 'Periodic', phase });
      const { rows, a } = await uiVsApi(page, { campaignType: 'Periodic', phase });
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((r, i) => {
        if (phase === 'closed') expect(r.cells[3], 'kỳ đã kết thúc').toContain('Đã kết thúc');
        else { expect(r.cells[3]).toMatch(/\d{2}\/\d{2}\/\d{4}/); expect(r.cells[3], `${nameOf(r.cells)}: Còn n ngày khớp daysRemaining`).toContain(`Còn ${a[i].daysRemaining} ngày`); }
      });
    }
  });
  test(tc('RES-B67'), async ({ page }) => {
    await openList(page, { type: 'Periodic' });
    const { rows, a } = await uiVsApi(page, { campaignType: 'Periodic', phase: 'all' });
    rows.forEach((r, i) => {
      expect(r.cells[4], `${nameOf(r.cells)}/${r.cells[2]}`).toContain(`${a[i].scoredCount}/${a[i].indicatorCount} chỉ số`);
      if (a[i].indicatorCount > 0) expect(r.cells[4]).toContain(`${Math.round(a[i].scoredCount / a[i].indicatorCount * 100)}%`);
    });
    const d = await getRes(a[0].id, actor());
    expect(d?.scoredCount, 'khớp chi tiết').toBe(a[0].scoredCount);
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
  test(tc('RES-B69'), async ({ page }) => {
    await toState('DP', 'Submitted');
    await openList(page, { type: 'AdHoc', kw: KW });
    const x = (await lst({ campaignType: 'AdHoc', phase: 'all', status: 'Submitted', fullTextSearch: KW }, actor())).content.find((c: any) => c.levelName);
    expect(x?.levelName, 'API phải có xếp loại').toBeTruthy();
    const heads = (await headsOf(page)).join(' | ');
    const row = (await rowsData(page)).find(r => r.cells[2] === x.organizationName)!;
    expect(row.text.includes(x.levelName) || /xếp loại/i.test(heads), `danh sách phải hiển thị Xếp loại "${x.levelName}" (cột: ${heads})`).toBeTruthy();
    expect(row.text, 'dòng phải chứa xếp loại').toContain(x.levelName);
  });
  test(tc('RES-B70'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc' });
    await clickTab(page, 'Đã gửi');
    for (const r of await rowsData(page)) expect(r.cells[6]).toMatch(/Gửi ngày \d{2}\/\d{2}\/\d{4}/);
    await openList(page, { type: 'Periodic', phase: 'closed' });
    await clickTab(page, 'Chưa gửi');
    for (const r of await rowsData(page)) expect(r.cells[6]).toContain('Quá hạn, không nộp');
    await openList(page, { type: 'AdHoc' });
    await clickTab(page, 'Chờ mở khóa');
    for (const r of await rowsData(page)) expect(r.cells[6]).toMatch(/Xin \d{2}\/\d{2}: .+/);
  });
  test(tc('RES-B71'), async () => {
    const bad: string[] = [];
    for (const type of ['AdHoc', 'Periodic']) for (const x of await lstAll({ campaignType: type, phase: 'all' }, actor())) {
      if (x.scoredCount > x.indicatorCount) bad.push(`${x.campaignName}/${x.organizationName}: đã chấm ${x.scoredCount}/${x.indicatorCount} chỉ số`);
      else if (x.score != null && x.maxScore != null && x.score > x.maxScore) bad.push(`${x.campaignName}/${x.organizationName}: điểm ${x.score} > tối đa ${x.maxScore}`);
    }
    expect(bad, `${bad.length} dòng vi phạm`).toEqual([]);
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
  test(tc('RES-R01'), async ({ page }) => {
    needWrite();
    await toState('E2', 'NotStarted');
    await openRemind(page, 'E2');
    expect(await sendRemind(page)).toMatch(/thành công|đã gửi nhắc nhở/i);
    expect((await getRes(await rid('E2'))).status).toBe('NotStarted');
  });
  test(tc('RES-R02'), async ({ page }) => {
    await toState('E2', 'NotStarted');
    const d = await openRemind(page, 'E2');
    expect(norm(await d.innerText())).toContain('Gửi nhắc nhở cho 1 đơn vị?');
  });
  test(tc('RES-R03'), async ({ page }) => {
    await layout();
    const d = await openRemind(page, 'E2');
    const t = norm(await d.innerText());
    for (const x of [ORG_NAME.E2, CAMP_NAME, '0/1 chỉ số', 'Chưa thực hiện']) expect(t, `hộp thoại phải có "${x}"`).toContain(x);
    await mbtn(page, /hu[ỷủ]/i).click();
    await page.waitForTimeout(500);
    await openList(page, { type: 'AdHoc', kw: KW });
    const b = await needBtn(page, /gửi nhắc nhở/i, 'Gửi nhắc nhở');
    await b.click();
    const t2 = norm(await modalL(page).innerText());
    expect(t2, 'danh sách nhắc không được có đơn vị đã gửi').not.toContain('Đã gửi');
    expect(t2).not.toContain('Chờ mở khóa');
    await mbtn(page, /hu[ỷủ]/i).click();
  });
  test(tc('RES-R04'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    await clickTab(page, 'Chưa gửi');
    const boxes = page.locator('tbody input[type=checkbox]');
    expect(await boxes.count(), 'chưa có ô chọn dòng (xem RES-B25)').toBeGreaterThan(2);
    for (let i = 0; i < 3; i++) await boxes.nth(i).check();
    await (await needBtn(page, /gửi nhắc nhở/i, 'Gửi nhắc nhở')).click();
    expect(norm(await modalL(page).innerText())).toContain('3 đơn vị');
  });
  test(tc('RES-R05'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    const boxes = page.locator('tbody input[type=checkbox]');
    expect(await boxes.count(), 'chưa có ô chọn dòng (xem RES-B25)').toBeGreaterThan(1);
    await boxes.first().check();
    await (await needBtn(page, /gửi nhắc nhở/i, 'Gửi nhắc nhở')).click();
    expect(norm(await modalL(page).innerText()), 'chỉ nhắc đơn vị đã chọn').toContain('1 đơn vị');
  });
  test(tc('RES-R06'), async ({ page }) => {
    needWrite();
    await toState('E2', 'NotStarted');
    await openDetail(page, await rid('E2'));
    await (await needBtn(page, /nhắc nhở/i, 'Gửi nhắc nhở')).click();
    const d = modalL(page); await d.waitFor({ state: 'visible' });
    const t = norm(await d.innerText());
    expect(t.includes('1 đơn vị') || (t.includes(ORG_NAME.E2) && t.includes(CAMP_NAME)), `hộp thoại phải nêu đúng 1 đơn vị: ${t}`).toBeTruthy();
    expect(await sendRemind(page)).toMatch(/thành công|đã gửi nhắc nhở/i);
  });
  test(tc('RES-R07'), async ({ page }) => {
    await remindable('MD'); const rid2 = await rid('MD');
    const n0 = (await remNoti('cbdp', rid2)).length, h0 = (await remHist(rid2)).length;
    await openList(page, { type: 'AdHoc', kw: KW_MI });
    await rowAct(page, rowOfFx(page, 'MD'), /nhắc nhở/i);
    await modalL(page).waitFor({ state: 'visible' });
    await mbtn(page, /hu[ỷủ]/i).click(); await page.waitForTimeout(800);
    expect(await page.locator('.ant-modal:visible').count(), 'hộp thoại phải đóng').toBe(0);
    expect((await remNoti('cbdp', rid2)).length).toBe(n0);
    expect((await remHist(rid2)).length).toBe(h0);
  });
  test(tc('RES-R08'), async ({ page }) => {
    needWrite();
    await remindable('MD'); const id = await rid('MD');
    const before = { cbdp: (await remNoti('cbdp', id)).length, ldp: (await remNoti('ldp', id)).length };
    await openRemind(page, 'MD'); await sendRemind(page); await page.waitForTimeout(1500);
    for (const as of ['cbdp', 'ldp'] as const) {
      const n = await remNoti(as, id);
      expect(n.length, `${as} phải nhận thông báo Sắp đến hạn mới`).toBe(before[as] + 1);
      expect(n[0].title).toBe('Sắp đến hạn');
    }
  });
  test(tc('RES-R09'), async ({ page }) => {
    needWrite();
    await remindable('MD'); const id = await rid('MD');
    const b0 = (await remNoti('lanhdaobo', id)).length;
    await openRemind(page, 'MD'); await sendRemind(page); await page.waitForTimeout(1500);
    expect((await remNoti('lanhdaobo', id)).length, 'Lãnh đạo Bộ không nhận TB-004').toBe(b0);
    const others = await Promise.all(['canbo', 'ldd'].map(async as => [as, (await remNoti(as, id)).length] as const));
    expect(others.filter(([, n]) => n > 0).map(([as]) => as), 'Cán bộ/Lãnh đạo đơn vị ngoài đơn vị không được nhận thông báo nhắc nhở của đơn vị khác').toEqual([]);
  });
  test(tc('RES-R10'), async ({ page }) => {
    needWrite();
    await remindable('MD'); const id = await rid('MD');
    await openRemind(page, 'MD'); await sendRemind(page); await page.waitForTimeout(1500);
    const n = (await remNoti('cbdp', id))[0];
    expect(n.title).toBe('Sắp đến hạn');
    expect(n.description).toContain(CAMP_MI);
    expect(n.description).toMatch(/hết hạn vào 31\/12\/2027\. Đơn vị chưa gửi kết quả/);
    expect(n.type).toBe('ASSESSMENT_REMINDER');
  });
  test(tc('RES-R11'), async ({ page }) => {
    needWrite();
    await layout();
    const ids = [await rid('E2'), await rid('E4')];
    const h0 = await Promise.all(ids.map(async i => (await remHist(i)).length));
    await openRemind(page, 'E2'); await sendRemind(page); await page.waitForTimeout(600);
    await openRemind(page, 'E4'); await sendRemind(page); await page.waitForTimeout(1200);
    for (let i = 0; i < 2; i++) {
      const h = await remHist(ids[i]);
      expect(h.length, 'mỗi kết quả đúng 1 dòng nhắc mới').toBe(h0[i] + 1);
      expect(h[0].actorName, 'người nhắc').toBeTruthy(); expect(h[0].at).toBeTruthy();
      expect(h[0].actionName).toMatch(/Bộ gửi nhắc nhở/i);
    }
  });
  test(tc('RES-R12'), async ({ page }) => {
    needWrite();
    await toState('E4', 'PendingApproval'); const id = await rid('E4');
    const d0 = await getRes(id), h0 = (await histOf(id)).length;
    await openRemind(page, 'E4'); await sendRemind(page); await page.waitForTimeout(1200);
    const d1 = await getRes(id), h = await histOf(id);
    expect(d1.status).toBe(d0.status); expect(d1.score).toBe(d0.score);
    expect(h.length).toBe(h0 + 1); expect(h[0].isStatusUnchanged, 'lịch sử không có chuyển trạng thái').toBe(true);
  });
  test(tc('RES-R13'), async ({ page }) => {
    needWrite();
    await toState('E2', 'NotStarted'); const id = await rid('E2');
    const h0 = (await remHist(id)).length;
    for (let i = 0; i < 3; i++) { await openRemind(page, 'E2'); expect(await sendRemind(page), `lần ${i + 1}`).toMatch(/thành công|đã gửi nhắc nhở/i); await page.waitForTimeout(500); }
    expect((await remHist(id)).length).toBe(h0 + 3);
  });
  test(tc('RES-R14'), async () => { test.skip(true, 'Manual: thông báo tự động do job theo lịch chạy theo ngày hạn, không kích hoạt được theo yêu cầu'); });
  test(tc('RES-R15'), async () => { test.skip(true, 'Manual: cần kiểm tra hộp thư thực của người nhận'); });
  const rem = async (k: Key, st: string) => { await toState(k, st); const id = await rid(k); return { id, r: await remind([id]) }; };
  test(tc('RES-R16'), async () => {
    const id = await partialScoring(); const r = await remind([id]);
    expect(r.status, `[${who()}] HTTP ${r.status}: ${r.message}`).toBe(200); expect(r.data?.reminderCount).toBe(1);
  });
  test(tc('RES-R17'), async () => {
    const { r } = await rem('E4', 'PendingApproval');
    expect(r.status, `[${who()}] HTTP ${r.status}: ${r.message}`).toBe(200); expect(r.data?.reminderCount).toBe(1);
  });
  test(tc('RES-R18'), async () => {
    const { r } = await rem('E3', 'Approved');
    expect(r.status, `[${who()}] HTTP ${r.status}: ${r.message}`).toBe(200); expect(r.data?.reminderCount).toBe(1);
  });
  test(tc('RES-R19'), async () => {
    await toState('DP', 'Submitted');
    const id = await rid('DP');
    expect((await post(id, 'reassess', { reason: 'qc.automation R19' }, 'canbo')).status).toBe(200);
    const r = await remind([id]);
    expect(r.status, `[${who()}] Bị từ chối (Bộ yêu cầu đánh giá lại) vẫn nhắc được — HTTP ${r.status}: ${r.message}`).toBe(200);
    expect(r.data?.reminderCount).toBe(1);
  });
  test(tc('RES-R20'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const n0 = (await remNoti('cbdp', id)).length;
    const r = await remind([id]);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect((await remNoti('cbdp', id)).length, 'không tạo thông báo').toBe(n0);
    await openList(page, { type: 'AdHoc', kw: KW });
    expect((await menuOf(page, rowOfFx(page, 'DP'))).filter(i => /nhắc nhở/i.test(i)), 'menu dòng Đã gửi không được có mục nhắc').toEqual([]);
  });
  test(tc('RES-R21'), async () => {
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    const n0 = (await remNoti('canbo', id)).length;
    const r = await remind([id]);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect((await remNoti('canbo', id)).length).toBe(n0);
  });
  test(tc('RES-R22'), async () => {
    const id = await endedQa();
    test.skip(!id, 'Không có kết quả QA của kỳ đã kết thúc để thử (không dựng được kỳ đã kết thúc)');
    const r = await remind([id!]);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect(r.message, 'phải báo kỳ đã kết thúc (MSG-061)').toMatch(/đã kết thúc/i);
  });
  test(tc('RES-R23'), async () => {
    await toState('DP', 'Submitted'); await toState('E2', 'NotStarted');
    const a = await rid('DP'), b = await rid('E2');
    const n0 = (await remNoti('cbdp', a)).length, h0 = (await remHist(a)).length;
    const r = await remind([a, b]);
    expect(r.status, `[${who()}] HTTP ${r.status}: ${r.message}`).toBe(200);
    expect(r.data).toMatchObject({ reminderCount: 1, skippedCount: 1 });
    expect((await remNoti('cbdp', a)).length).toBe(n0); expect((await remHist(a)).length).toBe(h0);
  });
  test(tc('RES-R24'), async () => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const n0 = (await remNoti('cbdp', id)).length;
    const r = await remind([id]);
    expect(r.status).toBe(400);
    expect(r.message, 'phải báo MSG-060').toContain('Không thể thực hiện vì kết quả đang ở trạng thái');
    expect((await remNoti('cbdp', id)).length).toBe(n0);
  });
  const periodicFx = async () => {
    const c = (await listApi(CAMP, 'RES3 fixture P')).find((x: any) => x.name === 'qc.automation RES3 fixture P');
    const rows = c ? await lstAll({ campaignIds: [c.id], campaignType: 'Periodic', phase: 'all' }, 'canbo') : [];
    rows.forEach(x => EXTRA_OK.add(x.id));
    return rows;
  };
  test(tc('RES-R25'), async () => {
    const rows = await periodicFx();
    test.skip(!rows.length, 'Kỳ định kỳ fixture chưa sinh kết quả (hệ thống chỉ sinh theo job); nhắc kỳ định kỳ có sẵn sẽ ảnh hưởng đơn vị thật');
    const r = await remind([rows[0].id]);
    expect(r.status, `[${who()}] HTTP ${r.status}: ${r.message}`).toBe(200);
  });
  test(tc('RES-R26'), async () => {
    await remindable('MD'); const id = await rid('MD'); const n0 = (await remNoti('cbdp', id)).length;
    const r = await remind([id]);
    expect(r.status, `[${who()}] HTTP ${r.status}: ${r.message}`).toBe(200);
    const n = await remNoti('cbdp', id);
    expect(n.length).toBe(n0 + 1); expect(n[0].description).toContain(CAMP_MI);
  });
  test(tc('RES-R27'), async ({ page }) => {
    await toState('E2', 'NotStarted');
    await openList(page, { type: 'AdHoc', kw: KW });
    expect(await page.getByRole('button', { name: /gửi nhắc nhở/i }).count(), 'không được có nút Gửi nhắc nhở').toBe(0);
    for (const t of await menuOf(page, rowOfFx(page, 'E2'))) expect(t).not.toMatch(/nhắc nhở/i);
    const r = await remind([await rid('E2')]);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(403);
    expect(r.message).toContain('Bạn không có quyền thực hiện thao tác này');
  });
  test(tc('RES-R28'), async () => {
    await toState('E2', 'NotStarted'); const id = await rid('E2');
    for (const as of ['ldd', 'ldp']) { const r = await remind([id], as); expect(r.status, `${as}: HTTP ${r.status}: ${r.message}`).toBe(403); }
  });
  test(tc('RES-R29'), async () => {
    const r = await remind([await rid('E2')], 'xemonly');
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(403);
  });
  test(tc('RES-R30'), async () => {
    await toState('E2', 'NotStarted'); await remindable('MD');
    const inScope = await rid('MD'), out = await rid('E2');
    const h0 = (await remHist(out)).length;
    const r = await remind([inScope, out]);
    expect(r.status, `[${who()}] HTTP ${r.status}: ${r.message}`).toBe(200);
    expect(r.data).toMatchObject({ reminderCount: 1, skippedCount: 1 });
    expect((await remHist(out)).length, 'đơn vị ngoài phạm vi không có lịch sử nhắc').toBe(h0);
  });
  test(tc('RES-R31'), async ({ page }) => {
    needWrite();
    await remindable('MD'); const id = await rid('MD');
    await openRemind(page, 'MD');
    const ta = modalL(page).locator('textarea').first();
    if (await ta.count()) {
      await ta.fill('qca nhắc');
      await sendRemind(page); await page.waitForTimeout(1500);
      expect((await remNoti('cbdp', id))[0].description, 'nội dung đã nhập phải có trong thông báo').toContain('qca nhắc');
    }
  });
  test(tc('RES-R32'), async ({ page }) => {
    needWrite();
    await toState('E2', 'NotStarted');
    await openRemind(page, 'E2');
    expect(await sendRemind(page)).toContain('Gửi nhắc nhở thành công');
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
  test(tc('RES-W01'), async ({ page }) => {
    const d = await openReassess(page);
    const t = norm(await d.innerText());
    expect(t).toMatch(/đánh giá lại/i); expect(t).toMatch(/Lý do.*\*/);
    await expect(d.locator('textarea').first()).toBeVisible();
    await expect(mbtn(page, /gửi yêu cầu/i)).toBeVisible(); await expect(mbtn(page, /hu[ỷủ]/i)).toBeVisible();
  });
  test(tc('RES-W02'), async ({ page }) => {
    await toState('DP', 'Submitted');
    await openDetail(page, await rid('DP'));
    await (await needBtn(page, /yêu cầu đánh giá lại/i, 'Yêu cầu đánh giá lại')).click();
    const d = modalL(page); await d.waitFor({ state: 'visible' });
    expect(norm(await d.innerText())).toMatch(/Lý do.*\*/);
    await expect(mbtn(page, /gửi yêu cầu/i)).toBeVisible();
  });
  test(tc('RES-W03'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP');
    await d.locator('textarea').first().fill('qc.automation W03 lý do hợp lệ');
    await submitReassess(page);
    expect(await toastNow(page)).toContain('Gửi yêu cầu đánh giá lại thành công');
    expect((await getRes(id)).status).toBe('Rejected');
    await openList(page, { type: 'AdHoc', kw: KW });
    expect(statusOf((await rowsData(page)).find(r => r.cells[2] === ORG_NAME.DP)!.cells)).toBe('Bị từ chối');
    await openDetail(page, id); expect(await bodyText(page)).toContain('Bị từ chối');
  });
  test(tc('RES-W04'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP');
    await submitReassess(page); await page.waitForTimeout(800);
    expect(norm(await d.locator('.ant-form-item-explain-error').allInnerTexts().then(a => a.join(' '))), 'phải báo lỗi dưới ô nhập').toMatch(REASON_ERR);
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-W05'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP');
    await d.locator('textarea').first().fill('   '); await submitReassess(page); await page.waitForTimeout(800);
    const err = norm((await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ') + ' ' + (await msgs(page, 300)));
    expect(err).toMatch(REASON_ERR);
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-W06'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP');
    await d.locator('textarea').first().fill(LONG(255)); await submitReassess(page);
    expect(await toastNow(page)).toMatch(/thành công/i);
    expect((await reHist(id))[0].note).toHaveLength(255);
  });
  test(tc('RES-W07'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP');
    const ta = d.locator('textarea').first();
    await ta.fill(LONG(256));
    const len = (await ta.inputValue()).length;
    await submitReassess(page); await page.waitForTimeout(800);
    const err = norm((await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' '));
    expect(len <= 255 || /255/.test(err), `ô nhập nhận ${len} ký tự và không báo vượt giới hạn 255 (lỗi hiển thị: "${err}")`).toBeTruthy();
    expect((await getRes(id)).status, 'không được gửi').toBe('Submitted');
  });
  test(tc('RES-W08'), async () => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    for (const n of [256, 1001]) {
      const r = await post(id, 'reassess', { reason: LONG(n) }, 'canbo');
      expect(r.status, `${n} ký tự: HTTP ${r.status}: ${r.message}`).toBe(400);
      expect(r.message).toContain('255');
    }
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-W09'), async () => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    for (const body of [undefined, {}, { reason: null }]) {
      const r = await post(id, 'reassess', body, 'canbo');
      expect(r.status, `body ${JSON.stringify(body)}: HTTP ${r.status}: ${r.message}`).toBe(400);
      expect(r.message).toMatch(REASON_ERR);
    }
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-W10'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP');
    const h0 = (await histOf(id)).length;
    await d.locator('textarea').first().fill('qc.automation W10'); await mbtn(page, /hu[ỷủ]/i).click(); await page.waitForTimeout(800);
    expect(await page.locator('.ant-modal:visible').count()).toBe(0);
    expect((await getRes(id)).status).toBe('Submitted'); expect((await histOf(id)).length).toBe(h0);
  });
  test(tc('RES-W11'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP'); const L = 'qc.automation W11 lý do đầy đủ';
    await d.locator('textarea').first().fill(L); await submitReassess(page); await toastNow(page);
    const h = (await reHist(id))[0];
    expect(h, 'phải có dòng lịch sử Yêu cầu đánh giá lại').toBeTruthy();
    expect(h.actionName).toMatch(/Bộ yêu cầu đánh giá lại/i);
    expect(h.fromStatus).toBe('Submitted'); expect(h.toStatus).toBe('Rejected');
    expect(h.note).toBe(L); expect(h.actorName).toBeTruthy();
  });
  test(tc('RES-W12'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP'); const L = 'qc.automation W12 lý do';
    const b = { cbdp: (await reNoti('cbdp', id)).length, ldp: (await reNoti('ldp', id)).length };
    await d.locator('textarea').first().fill(L); await submitReassess(page); await toastNow(page); await page.waitForTimeout(1200);
    for (const as of ['cbdp', 'ldp'] as const) {
      const n = await reNoti(as, id);
      expect(n.length, `${as} nhận thông báo mới`).toBe(b[as] + 1);
      expect(n[0].description).toContain(CAMP_NAME); expect(n[0].description).toContain(L);
    }
  });
  test(tc('RES-W13'), async ({ page, browser }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP'); const L = 'qc.automation W13';
    await d.locator('textarea').first().fill(L); await submitReassess(page); await toastNow(page);
    const { ctx, page: p2 } = await asRole(browser, 'cbdp');
    try {
      await openDetail(p2, id);
      const t = await bodyText(p2);
      expect(t, 'cảnh báo Bộ yêu cầu đánh giá lại kèm lý do').toMatch(/Bộ yêu cầu đánh giá lại/i); expect(t).toContain(L);
      expect(await p2.getByRole('button', { name: /chấm lại|trình duyệt|lưu nháp/i }).count()).toBeGreaterThan(0);
    } finally { await ctx.close(); }
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
  test(tc('RES-W15'), async () => {
    needWrite();
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const old = ((await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[])[0].attachment.id;
    expect((await post(id, 'reassess', { reason: 'qc.automation W15' }, 'canbo')).status).toBe(200);
    await toState('DP', 'Approved');
    const r = await post(id, 'send', { attachmentId: old, fileType: 'DigitalSigned' }, 'canbo');
    expect(r.status, `gửi lại bằng file cũ phải bị từ chối, HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400);
  });
  test(tc('RES-W16'), async () => { test.skip(true, 'Manual: cần chờ hết hạn nộp của kỳ thật (không thể rút ngắn kỳ đang diễn ra)'); });
  test(tc('RES-W17'), async () => {
    needWrite();
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const before = ((await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[]);
    expect((await post(id, 'reassess', { reason: 'qc.automation W17' }, 'canbo')).status).toBe(200);
    const after = ((await api('GET', `${RES}/${id}/submissions`, undefined, actor())).data?.submissions ?? []) as any[];
    expect(after.length, 'lần gửi cũ vẫn còn trong Hồ sơ gửi Bộ').toBe(before.length);
    expect(after[0].attachment?.fileName).toBeTruthy(); expect(after[0].sentDate).toBeTruthy();
  });
  test(tc('RES-W18'), async () => {
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    const r = await post(id, 'reassess', { reason: 'qc.automation W18' }, actor());
    expect(r.status, `[${who()}] HTTP ${r.status}: ${r.message}`).toBe(400);
    expect(r.message).toMatch(/trạng thái/i);
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-W19'), async () => {
    needWrite();
    await toState('DP', 'Submitted'); const id = await rid('DP');
    expect((await post(id, 'reassess', { reason: 'qc.automation W19' }, 'canbo')).status).toBe(200);
    const n = (await reHist(id)).length;
    const r = await post(id, 'reassess', { reason: 'qc.automation W19 lần 2' }, actor());
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    expect(r.message, 'phải báo trạng thái không hợp lệ (MSG-060)').toMatch(/trạng thái/i);
    expect((await reHist(id)).length).toBe(n);
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
  test(tc('RES-W21'), async ({ page }) => {
    await openList(page, { type: 'Periodic', phase: 'closed', status: 'Submitted' });
    expect(await rowsL(page).count()).toBeGreaterThan(0);
    expect((await menuOf(page, rowsL(page).first())).filter(i => /đánh giá lại/i.test(i)), 'kỳ đã kết thúc: không có mục Yêu cầu đánh giá lại').toEqual([]);
    const id = await endedQa();
    test.skip(!id, 'Không có kết quả QA của kỳ đã kết thúc để thử API');
    const r = await post(id!, 'reassess', { reason: 'qc.automation W21' }, actor());
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400);
    expect(r.message, 'phải báo kỳ đã kết thúc (MSG-061)').toMatch(/đã kết thúc/i);
  });
  test(tc('RES-W22'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    await openList(page, { type: 'AdHoc', kw: KW });
    expect((await menuOf(page, rowOfFx(page, 'DP'))).filter(i => /đánh giá lại/i.test(i)), `[${who()}] không được có mục Yêu cầu đánh giá lại`).toEqual([]);
    for (const as of ['lanhdaobo', 'ldd', 'ldp']) {
      const r = await post(id, 'reassess', { reason: 'qc.automation W22' }, as);
      expect(r.status, `${as}: HTTP ${r.status}: ${r.message}`).toBe(403);
      expect(r.message).toContain('Bạn không có quyền thực hiện thao tác này');
    }
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-W23'), async () => {
    await toState('BO', 'Submitted'); const id = await rid('BO');
    const r = await post(id, 'reassess', { reason: 'qc.automation W23' }, actor());
    expect([403, 404], `HTTP ${r.status}: ${r.message}`).toContain(r.status);
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-W24'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP'); const L = '<b>x</b> & "q" ế';
    await d.locator('textarea').first().fill(L); await submitReassess(page); await toastNow(page); await page.waitForTimeout(800);
    expect((await reHist(id))[0].note).toBe(L);
    expect((await reNoti('cbdp', id))[0].description).toContain(L);
    await openDetail(page, id, 'history');
    expect(await bodyText(page)).toContain(L);
    expect(await page.locator('.ant-layout-content b', { hasText: /^x$/ }).count(), 'HTML không được render').toBe(0);
  });
  test(tc('RES-W25'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP');
    const n0 = (await reHist(id)).length, t0 = (await reNoti('cbdp', id)).length;
    await d.locator('textarea').first().fill('qc.automation W25');
    const b = mbtn(page, /gửi yêu cầu/i);
    await Promise.all([b.click(), b.click({ force: true, noWaitAfter: true }).catch(() => {})]);
    await page.waitForTimeout(2500);
    expect((await reHist(id)).length, 'chỉ 1 dòng lịch sử').toBe(n0 + 1);
    expect((await reNoti('cbdp', id)).length, 'chỉ 1 thông báo TB-012').toBe(t0 + 1);
  });
  test(tc('RES-W26'), async () => {
    const c = (await listApi(CAMP, 'RES3 fixture P')).find((x: any) => x.name === 'qc.automation RES3 fixture P');
    const rows = c ? await lstAll({ campaignIds: [c.id], campaignType: 'Periodic', phase: 'all' }, 'canbo') : [];
    test.skip(!rows.length, 'Kỳ định kỳ fixture chưa sinh kết quả (hệ thống sinh theo job); không thể dựng kết quả Đã gửi của kỳ định kỳ');
    EXTRA_OK.add(rows[0].id);
    const r = await post(rows[0].id, 'reassess', { reason: 'qc.automation W26' }, actor());
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(200);
  });
  test(tc('RES-W27'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); const id = await rid('DP');
    await d.locator('textarea').first().fill('qc.automation W27'); await submitReassess(page);
    expect(await toastNow(page)).toMatch(/thành công/i);
    expect((await getRes(id)).status).toBe('Rejected');
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
  test(tc('RES-O01'), async ({ page }) => {
    await openUnlockAct(page, APPROVE);
    const t = norm(await modalL(page).innerText());
    expect(t, 'MSG-008 nêu tên kỳ và đơn vị').toContain(`Bạn có chắc chắn muốn mở khóa kết quả ${CAMP_NAME} của ${ORG_NAME.BO}?`);
    await expect(mbtn(page, /^duyệt mở khóa$/i)).toBeVisible(); await expect(mbtn(page, /^h[ủu]y$|^huỷ$/i)).toBeVisible();
  });
  test(tc('RES-O02'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE); const id = await rid('BO');
    await yes(page).click();
    expect(await toastNow(page)).toContain('Duyệt mở khóa thành công');
    expect((await getRes(id)).status).toBe('Scoring');
    await page.waitForTimeout(800);
    await openList(page, { type: 'AdHoc', kw: KW });
    expect(statusOf((await rowsData(page)).find(r => r.cells[2] === ORG_NAME.BO)!.cells)).toBe('Đang chấm điểm');
    expect((await menuOf(page, rowOfFx(page, 'BO'))).filter(i => /duyệt|từ chối/i.test(i))).toEqual([]);
  });
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
  test(tc('RES-O05'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE, 'DP'); const id = await rid('DP');
    const n0 = (await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_APPROVED')).length;
    await yes(page).click(); await toastNow(page); await page.waitForTimeout(1200);
    const n = await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_APPROVED');
    expect(n.length).toBe(n0 + 1); expect(n[0].title).toBe('Đã mở khóa kết quả'); expect(n[0].description).toContain(CAMP_NAME);
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
  test(tc('RES-O08'), async () => {
    const rows = await periodicRows();
    test.skip(!rows.length, NO_PERIODIC);
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
  test(tc('RES-O11'), async () => { test.skip(true, 'Manual: cần kỳ đã kết thúc có yêu cầu mở khóa đang chờ; hệ thống không cho tạo (yêu cầu mở khóa chỉ gửi được khi kỳ đang diễn ra) và không thể rút ngắn kỳ đã duyệt'); });
  test(tc('RES-O12'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE); const id = await rid('BO');
    await mbtn(page, /^không$|hu[ỷủ]/i).click(); await page.waitForTimeout(500);
    await openList(page, { type: 'AdHoc', kw: KW });
    expect((await post(id, 'reject-unlock', { reason: 'qc.automation O12 người khác xử lý trước' }, 'lanhdaobo')).status).toBe(200);
    await rowAct(page, rowOfFx(page, 'BO'), APPROVE); await yes(page).click();
    const t = await toastNow(page);
    expect(t, 'phải báo MSG-060').toContain('Không thể thực hiện vì kết quả đang ở trạng thái');
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-O13'), async () => {
    await toState('DP', 'Submitted'); await toState('E1', 'Scoring'); await toState('E2', 'NotStarted');
    for (const k of ['DP', 'E1', 'E2'] as Key[]) {
      const id = await rid(k), st = (await getRes(id)).status;
      const r = await post(id, 'approve-unlock', undefined, actor());
      expect(r.status, `${ST[st]}: HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
      expect(r.message, `${ST[st]}: phải báo MSG-060`).toContain('Không thể thực hiện vì kết quả đang ở trạng thái');
      expect((await getRes(id)).status).toBe(st);
    }
  });
  test(tc('RES-O14'), async () => {
    needWrite();
    await toState('DP', 'UnlockRequested'); const id = await rid('DP');
    const n0 = (await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_APPROVED')).length;
    const rs = await Promise.all([post(id, 'approve-unlock', undefined, actor()), post(id, 'approve-unlock', undefined, 'ldd')]);
    expect(rs.map(r => r.status).sort(), `HTTP ${rs.map(r => `${r.status}:${r.message}`).join(' / ')}`).toEqual([200, 400]);
    expect(rs.find(r => r.status === 400)!.message).toMatch(/người khác cập nhật|tải lại/i);
    await new Promise(r => setTimeout(r, 1200));
    expect((await unHist(id, /duyệt mở khóa/i)).length).toBeGreaterThanOrEqual(1);
    expect((await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_APPROVED')).length, 'chỉ 1 thông báo TB-010').toBe(n0 + 1);
  });
  test(tc('RES-O15'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, APPROVE, 'DP'); const id = await rid('DP');
    const n0 = (await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_APPROVED')).length, h0 = (await unHist(id, /duyệt mở khóa/i)).length;
    const b = yes(page);
    await Promise.all([b.click(), b.click({ force: true, noWaitAfter: true }).catch(() => {})]);
    await page.waitForTimeout(2500);
    expect((await unHist(id, /duyệt mở khóa/i)).length, 'chỉ 1 dòng lịch sử').toBe(h0 + 1);
    expect((await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_APPROVED')).length).toBe(n0 + 1);
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
  test(tc('RES-O18'), async ({ browser }) => {
    await toState('DP', 'UnlockRequested'); const id = await rid('DP');
    for (const key of ['cbdp', 'ldp']) {
      const { ctx, page } = await asRole(browser, key);
      try {
        await openList(page, { type: 'AdHoc', kw: KW });
        const items = await menuOf(page, rowOfFx(page, 'DP'));
        expect(items.filter(i => /duyệt mở khóa|từ chối mở khóa/i.test(i)), `${key}: không được có mục duyệt/từ chối`).toEqual([]);
      } finally { await ctx.close(); }
      const r = await post(id, 'approve-unlock', undefined, key);
      expect(r.status, `${key}: HTTP ${r.status}: ${r.message}`).toBe(403);
      expect(r.message).toContain('Bạn không có quyền thực hiện thao tác này');
    }
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-O19'), async () => {
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    for (const act of ['approve-unlock', 'reject-unlock']) {
      const r = await post(id, act, { reason: 'qc.automation O19' }, 'xemonly');
      expect(r.status, `${act}: HTTP ${r.status}: ${r.message}`).toBe(403);
    }
  });
  test(tc('RES-O20'), async () => {
    for (const id of [FAKE, 'abc']) {
      const r = await post(id, 'approve-unlock', undefined, actor());
      expect(r.status, `${id}: HTTP ${r.status}: ${r.message}`).toBe(404);
      expect(r.message).toContain('Không tìm thấy kết quả tự đánh giá');
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
  test(tc('RES-O23'), async ({ page }) => {
    await openUnlockAct(page, REJECT);
    const t = norm(await modalL(page).innerText());
    expect(t).toContain('Từ chối mở khóa kết quả?'); expect(t).toMatch(/Lý do từ chối.*\*/);
    await expect(mbtn(page, /^từ chối$/i), 'nút Từ chối').toBeVisible(); await expect(mbtn(page, /^h[ủu]y$|^huỷ$/i)).toBeVisible();
  });
  test(tc('RES-O24'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO');
    const subs = async () => ((await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[]).length;
    const n0 = await subs(), s0 = (await getRes(id)).score;
    await reasonBox(page).fill('qc.automation O24'); await confirmReject(page).click();
    expect(await toastNow(page)).toContain('Từ chối mở khóa thành công');
    const d = await getRes(id); expect(d.status).toBe('Submitted'); expect(d.score).toBe(s0); expect(await subs()).toBe(n0);
  });
  test(tc('RES-O25'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO');
    await confirmReject(page).click(); await page.waitForTimeout(800);
    expect(norm((await modalL(page).locator('.ant-form-item-explain-error').allInnerTexts()).join(' ')), 'phải báo lỗi dưới ô nhập').toMatch(REASON_ERR);
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
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
  test(tc('RES-O28'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT); const id = await rid('BO');
    await reasonBox(page).fill(LONG(256));
    const len = (await reasonBox(page).inputValue()).length;
    await confirmReject(page).click(); await page.waitForTimeout(800);
    const err = norm((await modalL(page).locator('.ant-form-item-explain-error').allInnerTexts()).join(' '));
    expect(len <= 255 || /255/.test(err), `ô nhập nhận ${len} ký tự và không báo vượt giới hạn 255 (lỗi: "${err}")`).toBeTruthy();
    expect((await getRes(id)).status).toBe('UnlockRequested');
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
  test(tc('RES-O32'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT, 'DP'); const id = await rid('DP'); const L = 'qc.automation O32 lý do';
    const n0 = (await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_REJECTED')).length;
    await reasonBox(page).fill(L); await confirmReject(page).click(); await toastNow(page); await page.waitForTimeout(1200);
    const n = await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_REJECTED');
    expect(n.length).toBe(n0 + 1); expect(n[0].description).toMatch(/bị từ chối\. Lý do: qc\.automation O32 lý do/);
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
  test(tc('RES-O34'), async () => {
    needWrite();
    await toState('DP', 'UnlockRequested'); const id = await rid('DP');
    expect((await post(id, 'reject-unlock', { reason: 'qc.automation O34' }, actor())).status).toBe(200);
    const n = (await unHist(id, /từ chối mở khóa/i)).length;
    for (const _ of [1, 2]) {
      const r = await post(id, 'reject-unlock', { reason: 'qc.automation O34 lần 2' }, actor());
      expect(r.status, `HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
      expect(r.message, 'phải báo MSG-060').toContain('Không thể thực hiện vì kết quả đang ở trạng thái');
    }
    expect((await unHist(id, /từ chối mở khóa/i)).length).toBe(n);
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
  test(tc('RES-O36'), async () => {
    const rows = await periodicRows();
    test.skip(!rows.length, NO_PERIODIC);
  });
  test(tc('RES-O37'), async () => {
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    for (const as of ['ldp', 'cbdp', 'xemonly']) {
      const r = await post(id, 'reject-unlock', { reason: 'qc.automation O37' }, as);
      expect(r.status, `${as}: HTTP ${r.status}: ${r.message}`).toBe(403);
    }
    expect((await getRes(id)).status).toBe('UnlockRequested');
  });
  test(tc('RES-O38'), async ({ page }) => {
    needWrite();
    await openUnlockAct(page, REJECT, 'DP'); const id = await rid('DP'); const L = '<b>x</b> & "q" ế';
    await reasonBox(page).fill(L); await confirmReject(page).click(); await toastNow(page); await page.waitForTimeout(1200);
    expect((await unHist(id, /từ chối mở khóa/i))[0].note).toBe(L);
    expect((await unNoti('cbdp', id, 'ASSESSMENT_UNLOCK_REJECTED'))[0].description).toContain(L);
    await openDetail(page, id, 'history');
    expect(await bodyText(page)).toContain(L);
    expect(await page.locator('.ant-layout-content b', { hasText: /^x$/ }).count()).toBe(0);
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
  test(tc('RES-H01'), async ({ page }) => {
    await toState('E2', 'NotStarted'); const id = await rid('E2');
    await openList(page, { type: 'AdHoc', kw: KW });
    await rowOfFx(page, 'E2').getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(1800);
    await expect(page).toHaveURL(new RegExp(id));
    const t = await bodyText(page), d = await getRes(id);
    expect(t).toContain(CAMP_NAME); expect(t).toContain('Chưa thực hiện');
    expect(t, 'Đơn vị · Hạn nộp dd/mm/yyyy (Còn n ngày)').toContain(`${ORG_NAME.E2} · Hạn nộp: ${fmtD(d.campaignEndDate)} (Còn ${d.daysRemaining} ngày)`);
  });
  test(tc('RES-H02'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP'); const d = await getRes(id);
    await openDetail(page, id);
    const t = await bodyText(page);
    for (const x of ['Đơn vị thực hiện', 'Phân loại', 'Bộ chỉ số áp dụng', 'Thời gian thực hiện', ORG_NAME.DP, 'Đột xuất', d.indicatorSetName, `${fmtD(d.campaignStartDate)} – ${fmtD(d.campaignEndDate)}`]) expect(t, x).toContain(x);
  });
  test(tc('RES-H03'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    await openDetail(page, id);
    expect(await page.getByText(/điểm tự chấm/i).count(), 'nội dung Chấm điểm').toBeGreaterThan(0);
    await detailTab(page, /^Hồ sơ gửi Bộ/); expect(await bodyText(page)).toMatch(/Văn bản xác nhận/);
    await detailTab(page, /^Lịch sử/); expect(await bodyText(page)).toMatch(/Đã gửi|Gửi/);
    await detailTab(page, /^Chấm điểm \(/); expect(await page.getByText(/điểm tự chấm/i).count()).toBeGreaterThan(0);
  });
  test(tc('RES-H04'), async ({ page }) => {
    await toState('E2', 'NotStarted');
    await openDetail(page, await rid('E2'));
    expect(await page.locator('.ant-table input, .ant-layout-content input[type=number], .ant-input-number-input').count(), 'ô điểm không nhập được').toBe(0);
    expect(await secBtn(page, /lưu nháp|trình duyệt|hủy chỉnh sửa|huỷ chỉnh sửa/i).count(), `[${who()}] không có nút Lưu nháp/Trình duyệt/Hủy chỉnh sửa`).toBe(0);
  });
  test(tc('RES-H05'), async ({ page }) => {
    await toState('E2', 'NotStarted'); await openDetail(page, await rid('E2'));
    await expect(await needBtn(page, /nhắc nhở/i, 'Gửi nhắc nhở')).toBeVisible();
  });
  test(tc('RES-H06'), async ({ page }) => {
    await toState('DP', 'Submitted'); await openDetail(page, await rid('DP'));
    await expect(await needBtn(page, /yêu cầu đánh giá lại/i, 'Yêu cầu đánh giá lại')).toBeVisible();
    expect(await secBtn(page, /nhắc nhở|duyệt mở khóa|từ chối mở khóa|xin mở khóa|gửi bộ/i).count(), 'không có nút Phía Bộ khác').toBe(0);
  });
  test(tc('RES-H07'), async ({ page }) => {
    await toState('BO', 'UnlockRequested'); await openDetail(page, await rid('BO'));
    await expect(await needBtn(page, /^duyệt mở khóa$/i, 'Duyệt mở khóa')).toBeVisible();
    await expect(await needBtn(page, /^từ chối mở khóa$/i, 'Từ chối mở khóa')).toBeVisible();
  });
  test(tc('RES-H08'), async ({ page }) => {
    for (const st of ['Submitted', 'NotSent']) {
      const x = await closedOne(st); expect(x, `phải có kết quả ${ST[st]} của kỳ đã kết thúc`).toBeTruthy();
      await openDetail(page, x.id);
      expect(await bodyText(page), 'thông báo chế độ chỉ xem').toMatch(/chế độ chỉ xem/i);
      expect(await secBtn(page, /nhắc nhở|đánh giá lại|duyệt mở khóa|từ chối mở khóa/i).count(), `${ST[st]}: không có nút thao tác Phía Bộ`).toBe(0);
    }
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
  test(tc('RES-H16'), async ({ page }) => {
    const id = await partialScoring(); const d = await getRes(id);
    await openDetail(page, id);
    const t = await bodyText(page);
    for (const g of d.groups) { expect(t).toContain(g.indicatorGroupName); expect(t).toContain(`Điểm nhóm: ${g.score} / ${g.maxScore}`); }
    for (const i of leavesOf(d)) { expect(t).toContain(i.indicatorCode); expect(t).toContain(`Điểm tối đa: ${i.maxScore}`); }
    for (const h of ['MINH CHỨNG', 'GIẢI TRÌNH', 'ĐIỂM TỰ CHẤM']) expect(t.toUpperCase()).toContain(h);
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
  test(tc('RES-H18'), async ({ page }) => {
    const id = await partialScoring(); const d = await getRes(id);
    const att = leavesOf(d).flatMap((i: any) => i.attachments ?? [])[0];
    test.skip(!att, 'Chưa có chỉ số nào có minh chứng (chạy RES-H17 trước)');
    await page.context().route(/\/files\//, r => r.fulfill({ status: 404, body: 'not found' }));
    await openDetail(page, id);
    await page.getByText(att.fileName).first().click();
    expect(await msgs(page, 2500), 'phải báo MSG-049').toContain('Tệp không tồn tại hoặc đã bị xóa');
  });
  test(tc('RES-H19'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    const subs = (await api('GET', `${RES}/${id}/submissions`, undefined, 'canbo')).data.submissions as any[];
    await openDetail(page, id, 'dossier');
    const t = await bodyText(page);
    expect(subs.length).toBeGreaterThanOrEqual(1);
    expect(t, 'bản gần nhất ghi "Bản chính thức"').toMatch(/Bản chính thức/);
    expect(subs[0].isOfficial).toBe(true); expect(new Date(subs[0].sentDate) >= new Date(subs[subs.length - 1].sentDate)).toBeTruthy();
    expect(t).toContain(subs[0].attachment.fileName); expect(t).toContain(subs[0].sentByUserName);
  });
  test(tc('RES-H20'), async ({ page }) => {
    await toState('E2', 'NotStarted'); await openDetail(page, await rid('E2'), 'dossier');
    expect(await bodyText(page), 'Hồ sơ gửi Bộ trống phải hiển thị "Chưa có dữ liệu"').toContain('Chưa có dữ liệu');
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
  test(tc('RES-H22'), async ({ page }) => {
    await toState('DP', 'Submitted'); await openDetail(page, await rid('DP'), 'history');
    const sel = (await page.locator('.ant-select:visible').allInnerTexts()).map(norm);
    expect(sel.some(s => /hành động/i.test(s)), `Lịch sử phải có bộ lọc Hành động (bộ lọc thực tế: ${sel.join(' | ') || 'không có'})`).toBeTruthy();
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
  test(tc('RES-H30'), async ({ page }) => {
    await openDetail(page, await partialScoring());
    const exp = secBtn(page, /mở rộng tất cả/i), col = secBtn(page, /thu gọn tất cả/i);
    expect(await exp.count() + await col.count(), 'phải có nút Mở rộng tất cả / Thu gọn tất cả').toBeGreaterThan(0);
    const rows0 = await page.locator('.ant-layout-content tbody tr').count();
    await col.first().click(); await page.waitForTimeout(500);
    const rows1 = await page.locator('.ant-layout-content tbody tr').count();
    await exp.first().click(); await page.waitForTimeout(500);
    expect(rows1).toBeLessThan(rows0 + 1); expect(await page.locator('.ant-layout-content tbody tr').count()).toBeGreaterThanOrEqual(rows1);
  });
  test(tc('RES-H31'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    await clickTab(page, 'Chưa gửi'); await clickTab(page, 'Đã gửi');
    const url = page.url();
    await rowsL(page).first().getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(1500);
    await page.locator('.ant-layout-content button').first().click(); await page.waitForTimeout(1500);
    expect(page.url(), 'quay lại danh sách giữ bộ lọc').toContain('status=Submitted');
    expect(page.url()).toContain('campaignType=AdHoc');
    expect(url).toContain('status=Submitted');
  });
  test(tc('RES-H32'), async ({ page }) => {
    await toState('DP', 'Submitted'); await openDetail(page, await rid('DP'));
    expect(await secBtn(page, /xuất excel/i).count(), `[${who()}] chi tiết không có Xuất Excel (BR-5)`).toBe(0);
  });
  test(tc('RES-H33'), async ({ page }) => {
    for (const id of [FAKE, 'abc']) {
      const r = await api('GET', `${RES}/${id}`, undefined, actor());
      expect(r.status, `${id}: HTTP ${r.status}: ${r.message}`).toBe(404);
      await openDetail(page, id);
      expect(await bodyText(page), `${id}: MSG-044`).toContain('Nội dung không còn tồn tại hoặc bạn không có quyền xem');
    }
  });
  test(tc('RES-H34'), async ({ browser }) => {
    await toState('BO', 'UnlockRequested'); const id = await rid('BO');
    const { ctx, page } = await asRole(browser, 'cbdp');
    try {
      const r = await api('GET', `${RES}/${id}`, undefined, 'cbdp');
      expect(r.status, `HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400);
      await openDetail(page, id);
      const t = await bodyText(page);
      expect(t, 'không hiển thị dữ liệu của đơn vị ngoài phạm vi').not.toContain(ORG_NAME.BO);
      expect(t, 'MSG-045 hoặc MSG-044').toMatch(/Bạn không có quyền truy cập dữ liệu của đơn vị này|Nội dung không còn tồn tại hoặc bạn không có quyền xem/);
    } finally { await ctx.close(); }
  });
  test(tc('RES-H35'), async ({ page }) => {
    await toState('DP', 'Submitted'); const id = await rid('DP');
    await openList(page, { type: 'AdHoc', kw: KW });
    const row = (await rowsData(page)).find(r => r.cells[2] === ORG_NAME.DP)!;
    await rowOfFx(page, 'DP').getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(1800);
    const t = await bodyText(page), d = await getRes(id);
    expect(t).toContain(row.cells[6].split('\n')[0]);
    expect(row.cells[4]).toContain(`${d.scoredCount}/${d.indicatorCount}`); expect(t).toContain(`${d.scoredCount} / ${d.indicatorCount}`);
    expect(row.cells[5].replace(/\s/g, '')).toBe(`${d.score}/${d.maxScore}`); expect(t).toContain(`${d.score} / ${d.maxScore}`);
  });
  test(tc('RES-H36'), async ({ page }) => {
    const id = await partialScoring(); const d = await getRes(id);
    expect(d.groups.reduce((a: number, g: any) => a + g.score, 0), 'tổng điểm = tổng điểm nhóm').toBe(d.score ?? 0);
    expect(d.groups.reduce((a: number, g: any) => a + g.maxScore, 0)).toBe(d.maxScore);
    await openDetail(page, id); expect(await bodyText(page)).toContain(`${d.score} / ${d.maxScore}`);
    const big = await getRes((await bigResult()).id, actor());
    expect(big.groups.reduce((a: number, g: any) => a + g.score, 0), `${big.campaignName}/${big.organizationName}: tổng điểm nhóm`).toBe(big.score ?? 0);
  });
  test(tc('RES-H37'), async ({ page }) => {
    const x = await bigResult();
    test.skip(x.indicatorCount < 100, `Không có kết quả đủ lớn (lớn nhất ${x.indicatorCount} chỉ số)`);
    const t0 = Date.now();
    await page.goto(`${ROUTE}/${x.id}`, { waitUntil: 'commit' });
    await page.getByText(/điểm tự chấm/i).first().waitFor({ timeout: 15_000 });
    const ms = Date.now() - t0;
    expect(ms, `mở chi tiết ${x.indicatorCount} chỉ số mất ${ms}ms`).toBeLessThanOrEqual(5000);
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
  test(tc('RES-H40'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc' });
    if ((await totalOf(page)) > 10) { await page.locator('.ant-pagination-item-2').first().click(); await settle(page); }
    await search(page, 'RES3 phía');
    const row = rowsL(page).first(), name = await row.locator('td').nth(2).innerText();
    await rowAct(page, row, /^xem$/i);
    await page.waitForTimeout(1500);
    const t = await bodyText(page);
    expect(t).toContain(name.trim()); expect(t).toContain(CAMP_NAME);
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
  test(tc('RES-M01'), async ({ page }) => {
    await openList(page, { type: 'AdHoc', kw: KW });
    const api_n = await unreadOf(actor());
    expect(await badgeOf(page), 'số chưa đọc trên chuông = API').toBe(Math.min(api_n, 99));
    await openBell(page, false);
    const t = norm(await popL(page).innerText());
    expect(t).toContain('Tất cả'); expect(t).toContain('Chưa đọc');
    expect(await itemsL(page).count(), 'danh sách thông báo').toBeGreaterThan(0);
    await popL(page).getByRole('button', { name: /^Chưa đọc/ }).click(); await page.waitForTimeout(1000);
    expect(await itemsL(page).count()).toBeGreaterThan(0);
  });
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
  test(tc('RES-M05'), async ({ page }) => {
    needWrite();
    const id = await rid('DP'); await toState('DP', 'Submitted'); const n0 = (await notiOf(actor(), id, 'ASSESSMENT_UNLOCK_REQUESTED')).length;
    expect((await post(id, 'request-unlock', { reason: 'qc.automation M05 lý do' }, 'cbdp')).status).toBe(200); await page.waitForTimeout(1200);
    const n = await notiOf(actor(), id, 'ASSESSMENT_UNLOCK_REQUESTED');
    expect(n.length).toBe(n0 + 1); expect(n[0].title).toBe('Yêu cầu mở khóa'); expect(n[0].description).toContain('Lý do: qc.automation M05 lý do');
    await openBell(page); expect(norm(await popL(page).innerText())).toContain('qc.automation M05 lý do');
    await post(id, 'reject-unlock', { reason: 'qc.automation M05 dọn' }, bo);
  });
  test(tc('RES-M06'), async () => {
    needWrite();
    const id = await rid('DP'); await toState('DP', 'Submitted');
    const c0 = (await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_REQUESTED')).length, d0 = (await notiOf('ldd', id, 'ASSESSMENT_UNLOCK_REQUESTED')).length;
    expect((await post(id, 'request-unlock', { reason: 'qc.automation M06' }, 'cbdp')).status).toBe(200); await new Promise(r => setTimeout(r, 1200));
    expect((await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_REQUESTED')).length, 'Cán bộ nhận').toBe(c0 + 1);
    expect((await notiOf('ldd', id, 'ASSESSMENT_UNLOCK_REQUESTED')).length, 'Lãnh đạo đơn vị nhận').toBe(d0 + 1);
    await post(id, 'reject-unlock', { reason: 'qc.automation M06 dọn' }, bo);
  });
  test(tc('RES-M07'), async ({ page }) => {
    needWrite();
    const id = await freshUnlockReq('qc.automation M07', 'DP');
    const top = newest(await notiOf(actor(), id, 'ASSESSMENT_UNLOCK_REQUESTED')); expect(top?.isRead, 'Lãnh đạo Bộ phải nhận thông báo yêu cầu mới').toBe(false);
    await openBell(page);
    await itemsL(page).filter({ hasText: 'Yêu cầu mở khóa' }).filter({ hasText: ORG_NAME.DP }).first().click(); await page.waitForTimeout(1800);
    await expect(page).toHaveURL(new RegExp(id));
    const n = (await notiOf(actor(), id, 'ASSESSMENT_UNLOCK_REQUESTED')).find(x => x.id === top.id);
    expect(n.isRead, 'thông báo đã được đánh dấu đã đọc').toBe(true);
  });
  test(tc('RES-M08'), async ({ page }) => {
    test.setTimeout(180_000);
    needWrite();
    await freshUnlockReq('qc.automation M08', 'DP'); expect(await unreadOf(actor())).toBeGreaterThan(0);
    const unread = async () => ((await api('GET', `${NOTI}?page=1&size=100`, undefined, actor())).data?.content as any[]).filter(n => !n.isRead).map(n => n.id);
    const ids = await unread();
    await openBell(page);
    await popL(page).getByRole('button', { name: /đánh dấu tất cả|đọc tất cả/i }).click(); await page.waitForTimeout(1500);
    expect((await unread()).filter(i => ids.includes(i)), 'mọi thông báo chưa đọc trước đó phải thành đã đọc').toEqual([]);
    expect(await badgeOf(page), 'huy hiệu chuông về 0 (cho phép 1 thông báo mới đến cùng lúc)').toBeLessThanOrEqual(1);
  });
  test(tc('RES-M09'), async ({ page }) => {
    needWrite();
    await freshUnlockReq('qc.automation M09', 'DP');
    await openBell(page);
    await popL(page).getByRole('button', { name: /^Chưa đọc/ }).click(); await page.waitForTimeout(1200);
    const n = await itemsL(page).count(); expect(n).toBeGreaterThan(0);
    expect(await itemsL(page).locator('span[title="Chưa đọc"]').count(), 'mọi thông báo ở tab Chưa đọc đều chưa đọc').toBe(n);
  });
  test(tc('RES-M10'), async ({ page }) => {
    needWrite();
    const id = await rid('MD'); expect((await getRes(id)).status).toMatch(/NotStarted|Scoring/); const n0 = (await notiOf(actor(), id, 'ASSESSMENT_REMINDER')).length;
    const r = await remind([id], 'canbo'); expect(r.status, `${r.status} ${r.message}`).toBe(200); await page.waitForTimeout(1200);
    const n = await notiOf(actor(), id, 'ASSESSMENT_REMINDER');
    expect(n.length, 'CB địa phương nhận thông báo Sắp đến hạn').toBe(n0 + 1);
    expect(n[0].title).toBe('Sắp đến hạn'); expect(n[0].description).toContain(CAMP_MI);
    await openList(page, { type: 'AdHoc', kw: KW }); await bellBtn(page).click(); await page.waitForTimeout(1200);
    expect(norm(await popL(page).innerText())).toContain('Sắp đến hạn');
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
  test(tc('RES-M14'), async () => {
    needWrite();
    const id = await freshUnlockReq('qc.automation M14');
    await post(id, 'reject-unlock', { reason: 'qc.automation M14' }, bo); await new Promise(r => setTimeout(r, 1000));
    const r = await api('GET', `${NOTI}?page=1&size=100`, undefined, 'xemonly');
    const mine_ = ((r.data?.content ?? []) as any[]).filter(n => /^ASSESSMENT_/.test(n.type));
    expect(mine_.length, 'tài khoản chỉ xem không nhận thông báo ASSESSMENT_*').toBe(0);
  });
  test(tc('RES-M15'), async () => {
    needWrite();
    const id = await freshUnlockReq('qc.automation M15');
    await toState('E2', 'NotStarted'); const e2 = await rid('E2'); expect((await remind([e2], 'canbo')).status).toBe(200); await new Promise(r => setTimeout(r, 1200));
    for (const as of ['cbdp', 'ldp']) {
      expect((await notiOf(as, id)).length + (await notiOf(as, e2)).length, `${ROLE_NAME[as]} (đơn vị khác) không được nhận thông báo của đơn vị QA - Đơn vị Bộ`).toBe(0);
    }
  });
  test(tc('RES-M16'), async () => {
    needWrite();
    const id = await freshUnlockReq('qc.automation M16'); const n0 = (await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_APPROVED')).length;
    const rs = await Promise.all([post(id, 'approve-unlock', undefined, bo), post(id, 'approve-unlock', undefined, bo)]);
    expect(rs.filter(r => r.status === 200).length).toBe(1); await new Promise(r => setTimeout(r, 1500));
    expect((await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_APPROVED')).length, 'không tạo thông báo trùng').toBe(n0 + 1);
  });
  test(tc('RES-M17'), async ({ page }) => {
    needWrite();
    const id = await freshUnlockReq('qc.automation M17'); const H = '<b>x</b> & "q"';
    expect((await post(id, 'reject-unlock', { reason: H }, bo)).status).toBe(200); await new Promise(r => setTimeout(r, 1200));
    const n = newest(await notiOf('canbo', id, 'ASSESSMENT_UNLOCK_REJECTED'));
    expect(n.description, 'lưu nguyên văn').toContain(H);
    await openList(page, { type: 'AdHoc', kw: KW });
    const { ctx, page: cp } = await asRole(page.context().browser()!, 'canbo');
    try {
      await openList(cp, { type: 'AdHoc', kw: KW }); await openBell(cp, false);
      const it = itemsL(cp).filter({ hasText: 'Từ chối mở khóa' }).filter({ hasText: CAMP_NAME }).first();
      expect(await it.innerText()).toContain(H); expect(await it.locator('b').count(), 'không render thẻ HTML').toBe(0);
    } finally { await ctx.close(); }
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
  test(tc('RES-M20'), async () => {
    test.skip(true, 'Thông báo tổng hợp "Sắp đến hạn" do job theo lịch sinh khi kỳ còn n ngày; không kích hoạt được theo yêu cầu và không dựng được kỳ còn 1 ngày mà không để lại kỳ đã phê duyệt không xóa được');
  });
  test(tc('RES-M21'), async ({ page }) => {
    needWrite();
    await toState('DP', 'Submitted');
    await openList(page, { type: 'AdHoc', kw: KW });
    const b0 = await badgeOf(page), u0 = await unreadOf(actor());
    expect(b0).toBe(Math.min(u0, 99));
    const id = await rid('DP'); expect((await post(id, 'request-unlock', { reason: 'qc.automation M21' }, 'cbdp')).status).toBe(200);
    await expect.poll(async () => badgeOf(page), { timeout: 20_000, message: 'số chưa đọc phải tăng mà không cần tải lại' }).toBeGreaterThan(Math.min(b0, 98));
    await post(id, 'reject-unlock', { reason: 'qc.automation M21 dọn' }, bo);
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
  test(tc('RES-Q01'), async () => {
    needWrite();
    const probe = await api('POST', `${RES}/reminders`, { resultIds: [FAKE] }, actor());
    test.skip(probe.status !== 403, `[${who()}] có quyền nhắc nhở: không gửi body rỗng/sai lên hệ thống thật vì có thể nhắc toàn bộ đơn vị (đã từng xảy ra)`);
    for (const body of ['{}', '{"resultIds":[]}', '{"resultIds":["abc"]}', '{"resultIds":null}', undefined]) {
      const r = await apiRaw('POST', `${RES}/reminders`, actor(), body);
      expect(r.status, `body ${body}: HTTP ${r.status} ${r.text.slice(0, 120)}`).toBe(400);
    }
  });
  test(tc('RES-Q02'), async () => {
    const r = await remind([FAKE], actor());
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect(r.message).toContain('Không có đơn vị nào cần nhắc nhở'); expect(String(r.message)).not.toMatch(NOLEAK);
  });
  test(tc('RES-Q03'), async ({ page }) => {
    needWrite();
    await toState('E2', 'NotStarted');
    await openRemind(page, 'E2');
    await page.route(RE_REM, r => r.fulfill(J500()));
    await mbtn(page, /gửi nhắc nhở/i).click();
    const t = await failToast(page);
    expect(t, 'phải có thông báo lỗi').not.toBe(''); expect(t).not.toMatch(NOLEAK); expect(t).not.toMatch(/thành công|đã gửi nhắc nhở/i);
    await expect(modalL(page), 'hộp thoại giữ nguyên').toBeVisible();
  });
  test(tc('RES-Q04'), async ({ page }) => {
    needWrite();
    await toState('E2', 'NotStarted');
    await openRemind(page, 'E2');
    await page.route(RE_REM, r => r.abort('internetdisconnected'));
    await mbtn(page, /gửi nhắc nhở/i).click();
    const t = await failToast(page);
    expect(t, 'phải báo lỗi kết nối').not.toBe(''); expect(t).not.toMatch(/thành công/i);
    expect(await modalBusy(page), 'nút không treo ở trạng thái đang xử lý').toBe(0);
    await page.unroute(RE_REM); await expect(mbtn(page, /gửi nhắc nhở/i)).toBeEnabled();
  });
  test(tc('RES-Q05'), async ({ page }) => {
    needWrite();
    const d = await openReassess(page); void d; const id = await rid('DP');
    await rBox(page).fill('qc.automation Q05 giữ lại');
    await page.route(RE_REA, r => r.fulfill(J500()));
    await submitReassess(page); const t = await failToast(page);
    expect(t).not.toBe(''); expect(t).not.toMatch(NOLEAK);
    await expect(modalL(page)).toBeVisible(); expect(await rBox(page).inputValue()).toBe('qc.automation Q05 giữ lại');
    expect((await getRes(id)).status).toBe('Submitted');
  });
  test(tc('RES-Q06'), async ({ page }) => {
    needWrite();
    await openReassess(page); const id = await rid('DP'); const h0 = (await reHist(id)).length;
    await rBox(page).fill('qc.automation Q06');
    await page.route(RE_REA, r => r.abort('internetdisconnected'));
    await submitReassess(page); const t = await failToast(page);
    expect(t, 'phải báo lỗi kết nối').not.toBe(''); expect(t).not.toMatch(/thành công/i);
    expect(await modalBusy(page)).toBe(0); expect((await getRes(id)).status).toBe('Submitted'); expect((await reHist(id)).length).toBe(h0);
  });
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
  test(tc('RES-Q11'), async ({ page }) => {
    await page.route(/\/dti\/assessment-results(\?|$)/, r => r.fulfill(J500()));
    await page.goto(ROUTE, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    const t = norm(await page.locator('body').innerText());
    expect(t.length, 'không trắng trang').toBeGreaterThan(50); expect(t).not.toMatch(NOLEAK);
    expect(t, 'phải có thông báo lỗi hệ thống').toMatch(/lỗi|thất bại|không thể|thử lại/i);
  });
  test(tc('RES-Q12'), async () => {
    for (const f of ['{bad', '[1', '%7B%22a%22']) {
      const r = await api('GET', `${RES}?page=1&size=10&filter=${f}`, undefined, actor());
      expect(r.status, `filter=${f}: HTTP ${r.status} ${r.message}`).toBe(400);
      expect(r.message).toContain('Bộ lọc không hợp lệ'); expect(String(r.message)).not.toMatch(NOLEAK);
    }
  });
  test(tc('RES-Q13'), async () => {
    const total = (await lst({ campaignType: 'AdHoc', phase: 'all' }, actor(), 1, 10)).totalElements;
    for (const q of ['page=0&size=10', 'page=-1&size=10', 'page=abc&size=10', 'page=999&size=10', 'page=1&size=0', 'page=1&size=1000']) {
      const r = await api('GET', `${RES}?${q}&filter=${F({ campaignType: 'AdHoc', phase: 'all' })}`, undefined, actor());
      expect(r.status, `${q}: HTTP ${r.status} ${r.message}`).toBe(200);
      expect(r.data.content.length, `${q}: số dòng trả về không vượt 100 (tổng ${total})`).toBeLessThanOrEqual(100);
      if (q.startsWith('page=999')) expect(r.data.content.length, 'trang vượt cuối trả rỗng').toBe(0);
    }
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
  test(tc('RES-Q16'), async () => {
    const r = await post(FAKE, 'reassess', { reason: 'x' }, actor());
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(404); expect(r.message).toContain('Không tìm thấy kết quả tự đánh giá');
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
  test(tc('RES-Q19'), async ({ page }) => {
    test.setTimeout(180_000);
    needWrite();
    const id = await rid('BO');
    await staleRow(page, 'BO', async () => { expect((await post(id, 'approve-unlock', undefined, bo)).status).toBe(200); });
    await rowAct(page, rowOfFx(page, 'BO'), APPROVE);
    await yes(page).click(); const t = await toastNow(page);
    expect(t, 'báo trạng thái đã thay đổi').toContain('Không thể thực hiện vì kết quả đang ở trạng thái');
    expect((await getRes(id)).status).toBe('Scoring');
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
  test(tc('RES-Q21'), async ({ page }) => {
    needWrite();
    const x = await xssCamp(); let fired = false; page.on('dialog', d => { fired = true; d.dismiss(); });
    await openList(page, { type: 'AdHoc', kw: 'RES3 XSS' });
    const row = rowsL(page).first(); expect(await row.count(), 'kỳ tên đặc biệt phải có trong danh sách').toBeGreaterThan(0);
    const txt = norm(await row.innerText());
    expect(txt).toContain('<b>x</b> & "q"'); expect(txt).toContain('Dài-Dài-');
    expect(await row.locator('b').count(), 'không render thẻ HTML').toBe(0);
    const bb = await row.boundingBox(), tb = await page.locator('.ant-table').first().boundingBox();
    expect(bb!.width, 'dòng không vỡ bố cục').toBeLessThanOrEqual(tb!.width + 2);
    await openDetail(page, x.id); expect(await bodyText(page)).toContain('<b>x</b> & "q"');
    expect(fired, 'script không được chạy').toBe(false);
  });
  test(tc('RES-Q22'), async ({ page }) => {
    test.setTimeout(180_000);
    needWrite();
    const id = await rid('BO');
    await staleRow(page, 'BO', async () => { expect((await post(id, 'reject-unlock', { reason: 'qc.automation Q22' }, bo)).status).toBe(200); });
    await rowAct(page, rowOfFx(page, 'BO'), APPROVE);
    await yes(page).click(); const t = await toastNow(page);
    expect(t, 'chặn: báo trạng thái đã đổi').toContain('Không thể thực hiện vì kết quả đang ở trạng thái');
    expect((await getRes(id)).status, 'không chuyển Đang chấm điểm').toBe('Submitted');
  });
  test(tc('RES-Q23'), async () => {
    test.skip(true, 'Cần thu hồi/đổi quyền của tài khoản trong cấu hình phân quyền dùng chung với các agent khác; không an toàn chạy tự động trên hệ thống chung');
  });
  test(tc('RES-Q24'), async () => {
    test.skip(true, 'Cần kỳ thử có ≥ 50 đơn vị Chưa thực hiện; dựng 50 đơn vị/kỳ sẽ để lại dữ liệu rác không xóa được, và nhắc nhở thật sự bị chặn bởi quy tắc an toàn dữ liệu thật');
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
  test(tc('RES-K03'), async ({ browser }) => {
    const { ctx, page } = await asRole(browser, 'xemonly');
    try {
      await page.goto(ROUTE, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
      const t = norm(await page.locator('body').innerText());
      expect(t, 'MSG-043 / 403').toMatch(/Bạn không có quyền thực hiện thao tác này|403/);
      expect(await page.locator('tbody tr.ant-table-row').count()).toBe(0);
    } finally { await ctx.close(); }
    expect((await api('GET', `${RES}?page=1&size=10`, undefined, 'xemonly')).status).toBe(403);
    expect((await api('GET', `${RES}/${await rid('DP')}`, undefined, 'xemonly')).status).toBe(403);
  });
  test(tc('RES-K04'), async () => {
    for (const t of ['Periodic', 'AdHoc']) expect(await totalAs('canbo', t), `tổng ${t}`).toBe(await totalAs('superadmin', t));
  });
  test(tc('RES-K05'), async ({ page }) => {
    for (const t of ['Periodic', 'AdHoc']) expect(await totalAs(actor(), t), `tổng ${t}`).toBe(await totalAs('superadmin', t));
    await openList(page, { type: 'AdHoc' }); expect(await totalOf(page)).toBe(await totalAs('superadmin', 'AdHoc'));
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
  test(tc('RES-K13'), async ({ browser }) => {
    test.setTimeout(180_000);
    needWrite();
    await toState('DP', 'Submitted'); await toState('BO', 'Submitted');
    const want: Record<string, boolean> = { canbo: true, lanhdaobo: false, ldd: false, ldp: false };
    const bad: string[] = [];
    for (const [as, yes_] of Object.entries(want)) {
      const { ctx, page } = await asRole(browser, as);
      try {
        await openList(page, { type: 'AdHoc', kw: KW });
        const m = await menuOf(page, rowOfFx(page, as === 'ldp' ? 'DP' : 'BO')); const has = m.some(i => /đánh giá lại/i.test(i));
        if (has !== yes_) bad.push(`${as}: Yêu cầu đánh giá lại=${has} (cần ${yes_}; menu: ${m.join(' | ') || 'không có'})`);
      } finally { await ctx.close(); }
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('RES-K14'), async () => {
    needWrite();
    const id = await rid('MD'); expect((await getRes(id)).status).toMatch(/NotStarted|Scoring/);
    const bad: string[] = [];
    for (const as of ['xemonly', 'ldp', 'lanhdaobo', 'ldd', 'cbdp', 'canbo']) {
      const r = await remind([id], as); const ok = ['cbdp', 'canbo'].includes(as);
      if ((r.status === 200) !== ok || (!ok && r.status !== 403)) bad.push(`${as}: HTTP ${r.status} (cần ${ok ? 200 : 403})`);
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
  test(tc('RES-K19'), async () => {
    const bad: string[] = [];
    const id = await rid('MD');
    for (const as of ['canbo', 'lanhdaobo', 'ldd', 'ldp', 'cbdp']) {
      const d = (await api('GET', `${RES}/${id}`, undefined, as)).data; const allowed = (d?.allowedActions ?? []) as string[];
      const r = await remind([id], as === 'canbo' ? 'canbo' : as);
      const has = allowed.includes('remind');
      if (has && r.status === 403) bad.push(`${as}: UI cho nhắc nhở nhưng API 403`);
      if (!has && r.status !== 403 && r.status !== 404) bad.push(`${as}: UI ẩn nhắc nhở nhưng API HTTP ${r.status}`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
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
  test(tc('RES-K22'), async ({ page }) => {
    needWrite();
    const x = await xssCamp(); const id = await rid('BO');
    await toState('BO', 'Submitted');
    const bad = await post(id, 'request-unlock', { reason: '<img src=x onerror=alert(1)>' }, 'canbo');
    expect(bad.status, `lý do chứa script phải bị từ chối (HTTP ${bad.status} ${bad.message})`).toBe(400);
    let fired = false; page.on('dialog', d => { fired = true; d.dismiss(); });
    await openList(page, { type: 'AdHoc', kw: 'RES3 XSS' });
    expect(await page.locator('tbody b, tbody img').count(), 'danh sách không render HTML').toBe(0);
    await openDetail(page, x.id); expect(await page.locator('.ant-layout-content b, .ant-layout-content img').count(), 'chi tiết không render HTML').toBe(0);
    await freshUnlockReq('<b>k22</b>', 'DP');
    await openBell(page);
    const it = itemsL(page).filter({ hasText: 'Yêu cầu mở khóa' }).first();
    expect(await it.innerText()).toContain('<b>k22</b>'); expect(await it.locator('b').count()).toBe(0);
    expect(fired).toBe(false);
  });
  test(tc('RES-K23'), async () => {
    test.skip(true, 'Đăng xuất làm thu hồi token dùng chung của tài khoản thử (các agent khác đang chạy cùng tài khoản); không thử trên hệ thống chung');
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
  test(tc('RES-K26'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    await pickOption(page, page.locator(PAGER_SEL).first(), /100/);
    const t0 = Date.now();
    await expect.poll(async () => rowsL(page).count(), { timeout: 15_000 }).toBeGreaterThan(10);
    await settle(page, 0);
    const ms = Date.now() - t0; expect(ms, `tải 100 dòng/trang ${ms}ms`).toBeLessThanOrEqual(5000);
  });
  test(tc('RES-K27'), async ({ page }) => {
    await openList(page, { type: 'AdHoc' });
    const t0 = Date.now();
    const f = await downloadTo(page, async () => (await needBtn(page, /xuất excel/i, 'Xuất Excel')).click());
    const ms = Date.now() - t0; fs.rmSync(f.file, { force: true });
    expect(ms, `xuất Excel ${ms}ms`).toBeLessThanOrEqual(10_000);
  });
  test(tc('RES-K28'), async ({ page }) => {
    await layout();
    await openList(page, { type: 'AdHoc', kw: KW });
    for (const n of ['Đã gửi', 'Chờ mở khóa', 'Chưa gửi']) if (!(await hasTab(page, n))) throw new Error(noTabMsg(n));
    for (const n of ['Đã gửi', 'Chờ mở khóa', 'Chưa gửi']) await page.getByRole('tab', { name: new RegExp(`^${n}`) }).first().click({ noWaitAfter: true });
    await settle(page, 1500);
    const rows = await rowsData(page);
    for (const r of rows) expect(statusOf(r.cells), 'dữ liệu thuộc tab cuối cùng (Chưa gửi)').toBe('Chưa gửi');
    await expect(page.getByRole('tab', { name: /^Chưa gửi/ })).toHaveAttribute('aria-selected', 'true');
  });
});
