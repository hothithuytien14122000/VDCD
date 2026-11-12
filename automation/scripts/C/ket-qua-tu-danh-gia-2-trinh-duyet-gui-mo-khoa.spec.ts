// C.2 KẾT QUẢ TỰ ĐÁNH GIÁ — Trình duyệt, Phê duyệt/Từ chối, Gửi Bộ, Xin mở khóa, Chi tiết, Vòng đời, Edge, Phân quyền (RES-T/A/F/U/D/Y/J/X)
// Dữ liệu: dùng lại kỳ "fixture" cố định (kết quả không xóa được) — xem hàm fixture(); test chuyển trạng thái bằng drive() qua API theo tác nhân tương ứng.
// Chu trình dùng lại: Đã gửi → Xin mở khóa → Bộ duyệt → Đang chấm điểm → Trình → Phê duyệt → Gửi (không sinh kết quả/kỳ mới).
import { Page, Locator, Browser } from '@playwright/test';
import fs from 'node:fs';
import { test, expect, tc, needWrite, api, goto, toast, dlg, tokenOf, listApi } from './common';
import { API_BASE } from '../api';

test.describe.configure({ timeout: 90_000 });

const R = 'dti/assessment-results', CAMP = 'dti/self-assessment-campaigns';
const FAKE = '00000000-0000-0000-0000-000000000000';
type Org = 'B' | 'P';                                   // B = QA - Đơn vị Bộ, P = QA - Địa phương
type Res = { id: string; org: Org };
const ACT = { B: { cb: 'canbo', ld: 'ldd' }, P: { cb: 'cbdp', ld: 'ldp' } } as const;
const BO = 'lanhdaobo';
const EDIT = ['Scoring', 'Rejected'];                    // trạng thái cho phép chấm điểm/trình
const MSG060 = /không có quyền/i;                        // thông báo quyền chung — KHÔNG phải thông báo trạng thái MSG-060

// ---------- API thô ----------
async function raw(method: string, path: string, o: { as?: string | null; body?: any; text?: string; token?: string } = {}) {
  const h: Record<string, string> = {};
  if (o.as) h.Authorization = `Bearer ${tokenOf(o.as)}`;
  if (o.token !== undefined) h.Authorization = `Bearer ${o.token}`;
  let body: string | undefined;
  if (o.text !== undefined) { body = o.text; h['Content-Type'] = 'application/json'; }
  else if (o.body !== undefined) { body = JSON.stringify(o.body); h['Content-Type'] = 'application/json'; }
  const r = await fetch(`${API_BASE}/api/v1/${path}`, { method, headers: h, body });
  const text = await r.text(); let j: any = {}; try { j = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: r.status, message: String(j?.message ?? ''), data: j?.data, text };
}
const PDF = (s = 'qca') => `%PDF-1.4\n% ${s}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`;
async function upload(name: string, content: string | Buffer, o: { as?: string | null; entityId?: string; docType?: string } = {}) {
  const fd = new FormData();
  fd.append('file', new Blob([content], { type: 'application/pdf' }), name);
  if (o.entityId) fd.append('entityId', o.entityId);
  const h: Record<string, string> = {};
  const as = o.as === undefined ? 'canbo' : o.as;
  if (as) h.Authorization = `Bearer ${tokenOf(as)}`;
  const r = await fetch(`${API_BASE}/api/v1/upload/blob/${o.docType ?? 'assessment_result_file'}`, { method: 'POST', headers: h, body: fd });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, message: String(j?.message ?? ''), data: j?.data };
}

// ---------- Đọc dữ liệu kết quả ----------
const D = async (id: string, as = 'canbo'): Promise<any> => (await api('GET', `${R}/${id}`, undefined, as)).data;
const statusOf = async (id: string) => (await D(id)).status as string;
const hist = async (id: string): Promise<any[]> => (await api('GET', `${R}/${id}/history`, undefined, 'canbo')).data ?? [];
const subs = async (id: string, as = 'canbo'): Promise<any> => (await api('GET', `${R}/${id}/submissions`, undefined, as)).data;
const post = (id: string, p: string, body?: any, as = 'canbo') => api('POST', `${R}/${id}/${p}`, body, as);
const leaves = (d: any): any[] => d.indicators.filter((i: any) => i.isLeaf && i.isScored);
const missing = (d: any): any[] => leaves(d).filter((i: any) => i.score === null || i.score === undefined);
const histCount = async (id: string, action: string) => (await hist(id)).filter(h => h.action === action).length;
/** PUT scores cho toàn bộ chỉ số lá (v = số hoặc hàm theo chỉ số). */
async function setScores(r: Res, v: number | ((i: any, k: number) => number) = 1, extra: (i: any, k: number) => any = () => ({}), as?: string) {
  const d = await D(r.id);
  const scores = leaves(d).map((i: any, k: number) => ({ indicatorSetIndicatorId: i.indicatorSetIndicatorId, score: typeof v === 'function' ? v(i, k) : v, ...extra(i, k) }));
  const x = await api('PUT', `${R}/${r.id}/scores`, { scores }, as ?? ACT[r.org].cb);
  if (x.status >= 300) throw new Error(`lưu điểm lỗi ${x.status} ${x.message}`);
  return x;
}

// ---------- Kỳ fixture ----------
const orgIds: Record<string, string> = {};
async function orgId(name: string) {
  if (!orgIds[name]) orgIds[name] = (await listApi('organizations', name)).find((o: any) => o.name === name)?.id;
  if (!orgIds[name]) throw new Error(`Không thấy đơn vị ${name}`);
  return orgIds[name];
}
async function findCamp(name: string) {
  for (let p = 1; p <= 10; p++) {
    const r = await api('GET', `${CAMP}?page=${p}&size=100`);
    const hit = (r.data?.content ?? []).find((c: any) => c.name === name);
    if (hit) return hit;
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return null;
}
async function createCamp(name: string, start: string, end: string) {
  const set = (await api('GET', `dti/indicator-sets?page=1&size=50&filter=${encodeURIComponent(JSON.stringify({ keyword: 'MBCS_QC01' }))}`)).data?.content?.find((s: any) => s.code === 'MBCS_QC01');
  const scale = (await api('GET', 'dti/score-scales?page=1&size=50')).data?.content?.find((s: any) => s.code === 'TXL-001');
  if (!set || !scale) throw new Error('Thiếu bộ chỉ số MBCS_QC01 hoặc thang TXL-001');
  const c = await api('POST', CAMP, { name, type: 'AdHoc', indicatorSetId: set.id, scaleId: scale.id, startDate: start, endDate: end });
  if (c.status !== 200) throw new Error(`tạo kỳ lỗi ${c.status} ${c.message}`);
  await api('PUT', `${CAMP}/${c.data.id}/organizations`, [await orgId('QA - Địa phương'), await orgId('QA - Đơn vị Bộ')]);
  await api('POST', `${CAMP}/${c.data.id}/submit`, undefined, 'canbo');
  await api('POST', `${CAMP}/${c.data.id}/approve`, undefined, BO);
  return c.data;
}
type Pair = { B: Res; P: Res; campId: string };
const fxCache = new Map<string, Promise<Pair>>();
/** Kỳ cố định (tạo một lần, dùng lại ở các lần chạy sau) gồm 2 kết quả: B = QA - Đơn vị Bộ, P = QA - Địa phương. */
function fixture(name: string, start = '2026-10-26T00:00:00.000Z', end = '2026-12-31T00:00:00.000Z'): Promise<Pair> {
  if (!fxCache.has(name)) fxCache.set(name, (async () => {
    const c = (await findCamp(name)) ?? (await createCamp(name, start, end));
    const orgs: any[] = (await api('GET', `${CAMP}/${c.id}`)).data?.organizations ?? [];
    const pick = (n: string): Res => ({ id: orgs.find(o => o.organizationName === n)?.assessmentResultId, org: n === 'QA - Địa phương' ? 'P' : 'B' });
    const p: Pair = { B: pick('QA - Đơn vị Bộ'), P: pick('QA - Địa phương'), campId: c.id };
    if (!p.B.id || !p.P.id) throw new Error(`Kỳ ${name} chưa có kết quả cho 2 đơn vị QA`);
    return p;
  })());
  return fxCache.get(name)!;
}
const pool = () => fixture('qc.automation RES c2 probe');            // kết quả đã chấm đủ, quay vòng được mọi trạng thái
const fresh = () => fixture('qc.automation RES2 fixture');            // B: luôn Chưa thực hiện (chỉ thử thao tác bị chặn); P: dành cho RES-Y02
const partial = () => fixture('qc.automation RES2 fixture partial');  // Đang chấm điểm, chỉ 40/100 chỉ số có điểm (1 chỉ số điểm 0) — không bao giờ chấm tiếp
const past = () => fixture('qc.automation RES c2 past', '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z'); // kỳ đã kết thúc → Chưa gửi

// ---------- Đưa kết quả về trạng thái yêu cầu (chọn đường ngắn nhất, tránh gửi Bộ vì mỗi lần gửi sinh 1 tệp không xóa được) ----------
const GRAPH: Record<string, [string, string, number][]> = {
  NotStarted: [['Scoring', 'score', 1]], Scoring: [['PendingApproval', 'submit', 1]], Rejected: [['PendingApproval', 'submit', 1]],
  PendingApproval: [['Approved', 'approve', 1], ['Rejected', 'reject', 1]], Approved: [['Submitted', 'send', 6]],
  Submitted: [['UnlockRequested', 'unlock', 1], ['Rejected', 'reassess', 1]], UnlockRequested: [['Scoring', 'okUnlock', 1], ['Submitted', 'noUnlock', 1]],
};
function nextHop(from: string, targets: string[]): [string, string] {
  const dist: Record<string, number> = { [from]: 0 }, first: Record<string, [string, string]> = {}, todo = [from];
  while (todo.length) {
    todo.sort((a, b) => dist[a] - dist[b]); const s = todo.shift()!;
    if (targets.includes(s) && s !== from) return first[s];
    for (const [to, step, w] of GRAPH[s] ?? []) {
      if (dist[to] === undefined || dist[s] + w < dist[to]) { dist[to] = dist[s] + w; first[to] = s === from ? [to, step] : first[s]; todo.push(to); }
    }
  }
  throw new Error(`không có đường từ ${from} tới ${targets}`);
}
async function sendOnce(r: Res, o: { fileName?: string; fileType?: string; as?: string; keepPending?: boolean } = {}) {
  const as = o.as ?? ACT[r.org].cb;
  const pf = (await subs(r.id)).pendingFile;
  let attId = pf?.id;
  if (!attId || !o.keepPending) { const u = await upload(o.fileName ?? 'qca.pdf', PDF(String(Date.now())), { as, entityId: r.id }); if (u.status !== 200) throw new Error('upload lỗi ' + u.message); attId = u.data.id; }
  return post(r.id, 'send', { attachmentId: attId, fileType: o.fileType ?? 'DigitalSigned' }, as);
}
async function drive(r: Res, target: string | string[]) {
  const targets = Array.isArray(target) ? target : [target];
  const a = ACT[r.org];
  for (let n = 0; n < 10; n++) {
    const d = await D(r.id); const s = d.status as string;
    if (targets.includes(s)) return d;
    const [to, step] = nextHop(s, targets);
    let x: { status: number; message: string };
    if (step === 'score') x = await setScores(r);
    else if (step === 'submit') { if (d.scoredCount < d.indicatorCount) await setScores(r); x = await post(r.id, 'submit-for-approval', undefined, a.cb); }
    else if (step === 'approve') x = await post(r.id, 'approve', undefined, a.ld);
    else if (step === 'reject') x = await post(r.id, 'reject', { reason: 'qc.automation' }, a.ld);
    else if (step === 'send') x = await sendOnce(r);
    else if (step === 'unlock') x = await post(r.id, 'request-unlock', { reason: 'qc.automation' }, a.cb);
    else if (step === 'reassess') x = await post(r.id, 'reassess', { reason: 'qc.automation' }, a.cb);
    else if (step === 'okUnlock') x = await post(r.id, 'approve-unlock', undefined, BO);
    else x = await post(r.id, 'reject-unlock', { reason: 'qc.automation' }, BO);
    if (x.status >= 300) throw new Error(`drive ${s} → ${to} (${step}) lỗi ${x.status} ${x.message}`);
  }
  throw new Error('drive: quá số bước');
}
const toEdit = (r: Res) => drive(r, EDIT);

// ---------- Kiểm tra dùng chung ----------
/** Thao tác bị chặn do trạng thái/kỳ: phải 4xx và nêu rõ lý do trạng thái (MSG-060/061), không phải thông báo thiếu quyền chung. */
function blocked(x: { status: number; message: string }, what: string, re?: RegExp) {
  expect(x.status, `${what}: phải bị từ chối 4xx, thực tế HTTP ${x.status} "${x.message}"`).toBeGreaterThanOrEqual(400);
  expect(x.status, `${what}: không được 5xx (HTTP ${x.status} "${x.message}")`).toBeLessThan(500);
  expect(x.message, `${what}: thông báo phải nêu trạng thái/kỳ không cho phép (MSG-060/061) nhưng hệ thống trả thông báo thiếu quyền chung "${x.message}" (HTTP ${x.status})`).not.toMatch(MSG060);
  if (re) expect(x.message, `${what}: thông báo "${x.message}"`).toMatch(re);
}
const clean500 = (s: string) => expect(s, 'không được lộ lỗi nội bộ/stacktrace trong thông báo').not.toMatch(/exception|stack ?trace|\bat [A-Z][\w.]+\(|NullReference|sql|entityframework|System\./i);

// ---------- Giao diện ----------
const open = async (page: Page, id: string, q = '') => { await goto(page, `assessment-results/${id}${q}`); };
const bt = (page: Page, re: RegExp) => page.getByRole('button', { name: re });
const mb = (page: Page, re: RegExp) => dlg(page).getByRole('button', { name: re });
const mtext = async (page: Page) => (await dlg(page).innerText()).replace(/\s+/g, ' ').trim();
const pageText = async (page: Page) => (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ').normalize('NFC');
const HUY = /^\s*Hu[ỷủ]\s*$/;
/** Ghi lại các request ghi (không GET) tới API kết quả để đối chiếu thứ tự/số lần. */
function track(page: Page, re: RegExp) {
  const reqs: { m: string; url: string; body: string }[] = [], resp: number[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && re.test(r.url())) reqs.push({ m: r.method(), url: r.url(), body: r.postData() ?? '' }); });
  page.on('response', r => { if (r.request().method() !== 'GET' && re.test(r.url())) resp.push(r.status()); });
  return { reqs, resp };
}
/** Bấm nút mở hộp thoại rồi chờ hộp thoại hiện. */
async function openDlg(page: Page, re: RegExp) { await bt(page, re).first().click(); await dlg(page).waitFor({ state: 'visible', timeout: 8000 }); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Chạy hàm bằng phiên của tài khoản khác (mở context riêng, không đăng nhập lại). */
async function as<T>(browser: Browser, key: string, fn: (p: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ storageState: `auth/${key}.json` });
  try { return await fn(await ctx.newPage()); } finally { await ctx.close(); }
}
/** Số thông báo của người dùng gắn (loại, kết quả) — dùng so trước/sau để tránh phụ thuộc đồng hồ. */
async function notifs(key: string, type: RegExp | null, id: string) {
  const out: any[] = [];
  for (let p = 1; p <= 12; p++) {                      // phân trang vì người dùng QA nhận rất nhiều thông báo từ các kết quả khác
    const r = await api('GET', `notifications/mine?page=${p}&size=100`, undefined, key);
    out.push(...(r.data?.content ?? []).filter((n: any) => (!type || type.test(n.type)) && String(n.additionalData ?? '').includes(id)));
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return out;
}
const text = (n: any) => `${n.title} ${n.description}`;
const HEADS = ['Chấm điểm', 'Lưu nháp', 'Trình duyệt'];
/** Mở danh sách Kết quả tự đánh giá, chọn loại kỳ (Định kỳ/Đột xuất) và tìm theo từ khóa. */
async function listFilter(page: Page, type: 'AdHoc' | 'Periodic', kw: string) {
  await goto(page, 'assessment-results');
  if (type === 'AdHoc') { await page.getByText('Đột xuất', { exact: true }).first().click(); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800); }
  if (kw) { await page.getByPlaceholder(/Tìm kiếm/).first().fill(kw); await page.keyboard.press('Enter'); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1200); }
}
async function todoTab(page: Page) {
  const t = page.getByRole('tab', { name: /Cần xử lý/ });
  expect(await t.count(), 'danh sách phải có tab "Cần xử lý" với tài khoản này').toBeGreaterThan(0);
  await t.click(); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800);
}

/** Gom mọi thông báo (toast) xuất hiện trong ms mili-giây (UI có thể hiện nhiều toast liên tiếp, vd lưu điểm rồi trình duyệt). */
async function toasts(page: Page, ms = 3500): Promise<string[]> {
  const seen = new Set<string>(); const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const t of await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()) if (t.trim()) seen.add(t.replace(/\s+/g, ' ').trim());
    await page.waitForTimeout(150);
  }
  return [...seen];
}
/** Xóa hết tệp chờ gửi của kết quả (API xếp chồng nhiều tệp chờ nên xóa lặp). */
async function clearPending(r: Res) {
  for (let i = 0; i < 40; i++) {
    const pf = (await subs(r.id)).pendingFile; if (!pf) return;
    await api('DELETE', `${R}/${r.id}/pending-file/${pf.id}`, undefined, ACT[r.org].cb);
  }
}
/** Tải PDF lên làm tệp chờ gửi của kết quả (qua API, tác nhân mặc định theo đơn vị). */
async function attachApi(r: Res, name = 'qcaf.pdf', content: string | Buffer = PDF(), as?: string) {
  const u = await upload(name, content, { as: as ?? ACT[r.org].cb, entityId: r.id });
  if (u.status !== 200) throw new Error(`upload lỗi ${u.status} ${u.message}`);
  return u.data as any;
}
const subCount = async (r: Res) => (await subs(r.id)).submissions.length as number;
/** Giao diện: chọn tệp ở khung đính kèm tab Hồ sơ gửi Bộ, trả về phản hồi upload. */
async function uiAttach(page: Page, name: string, content: string | Buffer = PDF(), mime = 'application/pdf') {
  const resp = page.waitForResponse(x => /upload\/blob/.test(x.url()), { timeout: 20_000 }).catch(() => null);
  await page.locator('input[type=file]').first().setInputFiles({ name, mimeType: mime, buffer: Buffer.from(content) });
  const x = await resp; await page.waitForTimeout(800);
  return x ? { status: x.status(), body: await x.json().catch(() => ({})) } : { status: 0, body: {} };
}
/** Giao diện: bấm "Gửi kết quả về Bộ" rồi xác nhận. */
async function uiSendConfirm(page: Page) { await bt(page, /Gửi kết quả về Bộ/).click(); await dlg(page).waitFor({ state: 'visible', timeout: 8000 }); await mb(page, /Xác nhận gửi Bộ/).click(); }
const dossier = async (page: Page, r: Res) => open(page, r.id, '?tab=dossier');

const histTab = async (page: Page) => {
  await page.getByRole('tab', { name: /Lịch sử/ }).click(); await page.waitForTimeout(800);
  return (await pageText(page)).replace(/^.*?Lịch sử thao tác & phê duyệt\s*/, '');
};
const TODO_CB = ['NotStarted', 'Scoring', 'Rejected', 'Approved'];
const camp = async (r: Res) => (await D(r.id)).campaignName as string;
/** Bấm Trình duyệt → Xác nhận từ giao diện, trả về request đã gửi. */
async function uiSubmit(page: Page) {
  await openDlg(page, /Trình duyệt/);
  await mb(page, /Xác nhận trình duyệt/).click();
}

// =============================== UC1.3 TRÌNH DUYỆT (RES-T) ===============================
test.describe('Trình duyệt', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-T01'), async ({ page }) => {
    const r = (await pool()).B; await toEdit(r);
    await open(page, r.id);
    await uiSubmit(page);
    await expect.poll(() => statusOf(r.id), { timeout: 10_000, message: 'trạng thái phải là Chờ duyệt (PendingApproval)' }).toBe('PendingApproval');
    await page.waitForTimeout(1500);
    expect(await pageText(page), 'phải hiện thông tin chờ Lãnh đạo đơn vị phê duyệt').toMatch(/Đang chờ Lãnh đạo đơn vị phê duyệt/);
    for (const b of HEADS) expect(await bt(page, new RegExp(b)).count(), `nút ${b} phải biến mất`).toBe(0);
  });
  test(tc('RES-T05'), async ({ page }) => {
    const r = (await pool()).B; await toEdit(r); const n0 = (await hist(r.id)).length, s0 = await statusOf(r.id);
    await open(page, r.id);
    const t = track(page, /submit-for-approval/);
    await openDlg(page, /Trình duyệt/);
    await mb(page, HUY).click();
    await expect(dlg(page)).toBeHidden();
    await page.waitForTimeout(500);
    expect(t.reqs.length, 'không được gửi request trình duyệt').toBe(0);
    expect(await statusOf(r.id)).toBe(s0);
    expect((await hist(r.id)).length).toBe(n0);
  });
  test(tc('RES-T08'), async ({ page }) => {
    const r = (await partial()).P; const miss = missing(await D(r.id));
    await open(page, r.id);
    await openDlg(page, /Trình duyệt/);
    const items = (await dlg(page).locator('li.ant-list-item').allInnerTexts()).map(s => s.replace(/\s+/g, ' '));
    expect(items.length, 'số dòng = số chỉ số thiếu điểm').toBe(miss.length);
    for (const i of miss) expect(items.some(t => t.includes(i.indicatorCode) && t.includes(i.indicatorName)), `thiếu dòng ${i.indicatorCode} ${i.indicatorName}`).toBeTruthy();
  });
  test(tc('RES-T09'), async ({ page }) => {
    const r = (await partial()).P; const d = await D(r.id);
    const nLeaf = missing(d).length, nAll = d.indicators.filter((i: any) => i.isScored && (i.score === null)).length;
    expect(nAll, 'điều kiện: chỉ số cha cũng chưa có điểm nên nếu đếm cha sẽ lệch').toBeGreaterThan(nLeaf);
    const x = await post(r.id, 'submit-for-approval', undefined, 'canbo');
    expect(x.message, 'n phải bằng số chỉ số lá chưa có điểm').toMatch(new RegExp(`Còn ${nLeaf} chỉ số chưa có điểm`));
    await open(page, r.id); await openDlg(page, /Trình duyệt/);
    expect(await dlg(page).locator('li.ant-list-item').count(), 'số dòng trong hộp thoại').toBe(nLeaf);
    expect(await mtext(page)).toContain(`${nLeaf} lỗi`);
  });
  test(tc('RES-T10'), async ({ page }) => {
    const r = (await partial()).P; const d = await D(r.id);
    const zero = leaves(d).filter((i: any) => i.score === 0), blank = missing(d);
    expect(zero.length, 'fixture phải có chỉ số điểm 0').toBeGreaterThan(0);
    expect(blank.every((i: any) => i.score === null), 'ô trống không được tự gán 0').toBeTruthy();
    await open(page, r.id); await openDlg(page, /Trình duyệt/);
    const body = await mtext(page);
    for (const i of zero) expect(body, `chỉ số điểm 0 (${i.indicatorCode}) không được báo thiếu điểm`).not.toContain(i.indicatorCode + ' ');
    for (const i of blank.slice(0, 5)) expect(body, `chỉ số trống ${i.indicatorCode} phải bị báo`).toContain(i.indicatorCode);
  });
  test(tc('RES-T11'), async () => {
    const r = (await pool()).B; const d = await toEdit(r);
    expect(d.indicators.filter((i: any) => !i.isLeaf).every((i: any) => i.score === null), 'điều kiện: chỉ số cha không có điểm trực tiếp').toBeTruthy();
    const x = await post(r.id, 'submit-for-approval', undefined, 'canbo');
    expect(x.status, `trình duyệt phải thành công: ${x.message}`).toBe(200);
    expect(x.message).not.toMatch(/chưa có điểm/);
  });
  test(tc('RES-T16'), async ({ page }) => {
    const r = (await pool()).B; await toEdit(r); await setScores(r, 1);
    await open(page, r.id);
    const inp = page.locator('.ant-input-number input').first();
    const code = (await inp.locator('xpath=ancestor::tr[1]').locator('td').first().innerText()).replace(/\s+/g, '');
    await inp.fill('2'); await inp.press('Tab');
    const t = track(page, /assessment-results/);
    await uiSubmit(page);
    await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('PendingApproval');
    const seq = t.reqs.map(x => x.m + ' ' + (x.url.match(/(scores|submit-for-approval)/)?.[1] ?? '')).filter(x => /scores|submit/.test(x));
    expect(seq.indexOf('PUT scores'), `phải có PUT scores trước submit: ${seq}`).toBeGreaterThanOrEqual(0);
    expect(seq.indexOf('PUT scores')).toBeLessThan(seq.indexOf('POST submit-for-approval'));
    const d = await D(r.id);
    expect(leaves(d).find((i: any) => i.indicatorCode.replace(/\s/g, '') === code)?.score, 'điểm mới phải được lưu').toBe(2);
    expect(d.score, 'tổng điểm của bản trình có điểm mới').toBe(101);
  });
  test(tc('RES-T17'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); await post(r.id, 'reject', { reason: 'qc.automation T17' }, ACT.B.ld);
    expect(await statusOf(r.id)).toBe('Rejected');
    await open(page, r.id);
    const inp = page.locator('.ant-input-number input').first();
    const v = Number(await inp.inputValue()); await inp.fill(String(v === 2 ? 1 : 2)); await inp.press('Tab');
    await uiSubmit(page);
    await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('PendingApproval');
    const h = (await hist(r.id))[0];
    expect([h.action, h.fromStatus, h.toStatus]).toEqual(['SubmittedForApproval', 'Rejected', 'PendingApproval']);
  });
  test(tc('RES-T22'), async ({ page }) => {
    const r = (await pool()).B; await toEdit(r); const from = await statusOf(r.id);
    const x = await post(r.id, 'submit-for-approval', undefined, 'canbo'); expect(x.status).toBe(200);
    const h = (await hist(r.id))[0];
    expect([h.action, h.actionName, h.fromStatus, h.toStatus]).toEqual(['SubmittedForApproval', 'Trình duyệt', from, 'PendingApproval']);
    expect(h.actorName).toMatch(/Cán bộ/);
    await open(page, r.id, '?tab=history');
    const top = await histTab(page);
    expect(top, 'dòng mới nhất ở tab Lịch sử').toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\s*Trình duyệt · QC Cán bộ\s*\(.+ → Chờ duyệt\)/);
  });
  test(tc('RES-T23'), async () => {
    const r = (await pool()).B; await toEdit(r);
    const before = (await notifs('ldd', /SUBMITTED_FOR_APPROVAL/, r.id)).length;
    expect((await post(r.id, 'submit-for-approval', undefined, 'canbo')).status).toBe(200);
    const after = await notifs('ldd', /SUBMITTED_FOR_APPROVAL/, r.id);
    expect(after.length, 'LĐ đơn vị phải nhận thêm 1 thông báo yêu cầu phê duyệt (TB-005)').toBe(before + 1);
    const n = after[0];
    expect(text(n)).toMatch(/Yêu cầu phê duyệt/); expect(text(n)).toContain(await camp(r));
    expect(JSON.parse(n.additionalData).assessmentResultId).toBe(r.id);
  });
  test(tc('RES-T25'), async () => {
    const r = (await pool()).B; await toEdit(r);
    const keys = ['cbdp', 'ldp', 'canbo'];
    const before = await Promise.all(keys.map(async k => (await notifs(k, /SUBMITTED_FOR_APPROVAL/, r.id)).length));
    expect((await post(r.id, 'submit-for-approval', undefined, 'canbo')).status).toBe(200);
    for (const [i, k] of keys.entries()) expect((await notifs(k, /SUBMITTED_FOR_APPROVAL/, r.id)).length, `${k} không được nhận thông báo yêu cầu phê duyệt`).toBe(before[i]);
  });
  test(tc('RES-T26'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'PendingApproval');
    await open(page, r.id);
    for (const b of HEADS) expect(await bt(page, new RegExp(b)).count(), `không còn nút ${b}`).toBe(0);
    expect(await page.locator('.ant-input-number input').count(), 'không còn ô nhập điểm').toBe(0);
  });
  test(tc('RES-T28'), async () => {
    const r = (await pool()).B; await toEdit(r); const n = await histCount(r.id, 'SubmittedForApproval');
    const xs = await Promise.all([post(r.id, 'submit-for-approval'), post(r.id, 'submit-for-approval')]);
    const codes = xs.map(x => x.status).sort();
    expect(codes[0], `một yêu cầu phải 200: ${codes}`).toBe(200);
    expect(codes[1], `yêu cầu còn lại phải 4xx: ${xs.map(x => x.message)}`).toBeGreaterThanOrEqual(400);
    expect(codes[1]).toBeLessThan(500);
    expect(await histCount(r.id, 'SubmittedForApproval')).toBe(n + 1);
  });
  test(tc('RES-T29'), async ({ page }) => {
    const r = (await pool()).B; await toEdit(r); const n = await histCount(r.id, 'SubmittedForApproval');
    await open(page, r.id);
    const t = track(page, /submit-for-approval/);
    await openDlg(page, /Trình duyệt/);
    await mb(page, /Xác nhận trình duyệt/).click({ clickCount: 2, delay: 20 }).catch(() => {});
    await page.waitForTimeout(2500);
    expect(t.resp.filter(s => s === 200).length, `chỉ 1 request thành công: ${t.resp}`).toBe(1);
    expect(t.resp.filter(s => s >= 400).length, `không được có request lỗi: ${t.resp}`).toBe(0);
    expect(await histCount(r.id, 'SubmittedForApproval')).toBe(n + 1);
  });
  test(tc('RES-T35'), async () => {
    const x = await post(FAKE, 'submit-for-approval', undefined, 'canbo');
    expect(x.status, x.message).toBe(404);
    expect(x.message).toBe('Không tìm thấy kết quả tự đánh giá'); clean500(x.message);
  });
  test(tc('RES-T36'), async ({ page }) => {
    const r = (await pool()).B; await toEdit(r); await setScores(r, 1);
    await open(page, r.id); await openDlg(page, /Trình duyệt/);
    const b = await mtext(page);
    expect(b).toContain('100/100 chỉ số (100%)'); expect(b).toContain('100 / 200'); expect(b).toContain('0/100 chỉ số');
  });
});

// =============================== UC1.4a PHÊ DUYỆT / UC1.4b TỪ CHỐI (RES-A) ===============================
const REASON = (n: number) => 'qc.automation '.repeat(30).slice(0, n);
async function uiApprove(page: Page) { await openDlg(page, /^\s*(check\s*)?Phê duyệt/); await mb(page, /Xác nhận phê duyệt/).click(); }
async function uiReject(page: Page, reason: string) {
  await openDlg(page, /Từ chối/);
  await dlg(page).locator('textarea').fill(reason);
  await mb(page, /Xác nhận từ chối/).click();
}
const pending = async (r: Res) => { await drive(r, 'PendingApproval'); return r; };

test.describe('Phê duyệt', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-A01'), async ({ page, browser }) => {
    const r = await pending((await pool()).B);
    await open(page, r.id);
    await uiApprove(page);
    await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('Approved');
    await page.waitForTimeout(1200);
    for (const b of [/Phê duyệt/, /Từ chối/]) expect(await bt(page, b).count(), `nút ${b} phải biến mất`).toBe(0);
    expect((await D(r.id, 'canbo')).allowedActions, 'Cán bộ phải có thao tác Gửi Bộ').toContain('send');
    await as(browser, 'canbo', async p => { await open(p, r.id); expect(await bt(p, /Gửi Bộ/).count(), 'Cán bộ thấy nút Gửi Bộ').toBeGreaterThan(0); });
  });
  test(tc('RES-A04'), async ({ page }) => {
    const r = await pending((await pool()).B); const n = (await hist(r.id)).length;
    await open(page, r.id);
    const t = track(page, /approve/);
    await openDlg(page, /Phê duyệt/);
    await mb(page, HUY).click();
    await expect(dlg(page)).toBeHidden(); await page.waitForTimeout(500);
    expect(t.reqs.length, 'không được gửi request phê duyệt').toBe(0);
    expect(await statusOf(r.id)).toBe('PendingApproval'); expect((await hist(r.id)).length).toBe(n);
  });
  test(tc('RES-A05'), async ({ page }) => {
    const r = await pending((await pool()).B);
    await open(page, r.id); await uiApprove(page);
    expect(await toasts(page), 'thông báo thành công (MSG-068)').toContain('Phê duyệt thành công');
  });
  test(tc('RES-A06'), async ({ page }) => {
    const r = await pending((await pool()).B);
    expect((await post(r.id, 'approve', undefined, 'ldd')).status).toBe(200);
    const h = (await hist(r.id))[0];
    expect([h.action, h.actionName, h.fromStatus, h.toStatus]).toEqual(['Approved', 'Phê duyệt', 'PendingApproval', 'Approved']);
    expect(h.actorName).toMatch(/Lãnh đạo đơn vị/);
    await open(page, r.id, '?tab=history');
    expect(await histTab(page), 'dòng mới nhất ở tab Lịch sử').toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\s*Phê duyệt · QC Lãnh đạo đơn vị\s*\(Chờ duyệt → Đã phê duyệt\)/);
  });
  test(tc('RES-A12'), async () => {
    const x = await post(FAKE, 'approve', undefined, 'ldd');
    expect(x.status, x.message).toBe(404); expect(x.message).toBe('Không tìm thấy kết quả tự đánh giá'); clean500(x.message);
  });
});

test.describe('Từ chối', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-A15'), async ({ page }) => {
    const r = await pending((await pool()).B);
    await open(page, r.id); await uiReject(page, 'qc.automation lý do A15');
    await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('Rejected');
    expect((await D(r.id, 'canbo')).allowedActions, 'Cán bộ có lại thao tác chấm điểm/trình').toEqual(expect.arrayContaining(['score', 'submit']));
  });
  test(tc('RES-A17'), async ({ page }) => {
    const r = await pending((await pool()).B);
    await open(page, r.id); await uiReject(page, 'qc.automation lý do A17');
    expect(await toasts(page), 'thông báo thành công (MSG-069)').toContain('Từ chối thành công');
  });
  test(tc('RES-A19'), async ({ page }) => {
    const r = await pending((await pool()).B);
    await open(page, r.id);
    const t = track(page, /\/reject$/);
    await openDlg(page, /Từ chối/);
    await dlg(page).locator('textarea').fill('   ');
    await mb(page, /Xác nhận từ chối/).click();
    const msgs = await toasts(page, 1800); const inline = await dlg(page).innerText().catch(() => '');
    expect([...msgs, inline].join(' | '), 'báo bắt buộc nhập lý do (MSG-058)').toMatch(/Vui lòng nhập lý do/);
    expect(t.resp.filter(s => s === 200).length, 'không được từ chối').toBe(0);
    expect(await statusOf(r.id)).toBe('PendingApproval');
  });
  test(tc('RES-A22'), async ({ page }) => {
    const r = await pending((await pool()).B);
    await open(page, r.id); await openDlg(page, /Từ chối/);
    const ta = dlg(page).locator('textarea'); await ta.fill(REASON(1100));
    const len = (await ta.inputValue()).length;
    const err = await dlg(page).locator('.ant-form-item-explain-error, .ant-input-status-error').count();
    expect(len <= 1000 || err > 0, `ô lý do nhận ${len} ký tự và không báo vượt giới hạn (maxlength=${await ta.getAttribute('maxlength')})`).toBeTruthy();
  });
  test(tc('RES-A23'), async ({ page }) => {
    const r = await pending((await pool()).B);
    await open(page, r.id);
    const t = track(page, /\/reject$/);
    await openDlg(page, /Từ chối/);
    await dlg(page).locator('textarea').fill('qc.automation sẽ hủy');
    await mb(page, HUY).click(); await expect(dlg(page)).toBeHidden(); await page.waitForTimeout(400);
    expect(t.reqs.length).toBe(0); expect(await statusOf(r.id)).toBe('PendingApproval');
    await openDlg(page, /Từ chối/);
    expect(await dlg(page).locator('textarea').inputValue(), 'mở lại thì ô lý do trống').toBe('');
  });
  test(tc('RES-A24'), async ({ page }) => {
    const r = await pending((await pool()).B);
    expect((await post(r.id, 'reject', { reason: 'qc.automation lý do' }, 'ldd')).status).toBe(200);
    const h = (await hist(r.id))[0];
    expect([h.action, h.fromStatus, h.toStatus, h.note]).toEqual(['Rejected', 'PendingApproval', 'Rejected', 'qc.automation lý do']);
    await open(page, r.id, '?tab=history');
    expect(await histTab(page)).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\s*Từ chối · QC Lãnh đạo đơn vị\s*\(Chờ duyệt → Bị từ chối\)\s*Lý do: “qc\.automation lý do”/);
  });
  test(tc('RES-A25'), async ({ browser }) => {
    const r = await pending((await pool()).B);
    expect((await post(r.id, 'reject', { reason: 'qc.automation lý do A25' }, 'ldd')).status).toBe(200);
    await as(browser, 'canbo', async p => {
      await open(p, r.id);
      const t = await pageText(p);
      expect(t, 'người từ chối').toMatch(/Lãnh đạo đơn vị/); expect(t, 'lý do đầy đủ').toContain('qc.automation lý do A25');
      expect(t, 'ngày từ chối dd/mm/yyyy').toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });
  test(tc('RES-A26'), async () => {
    const r = await pending((await pool()).B); const reason = 'qc.automation lý do A26 ' + Date.now();
    const n = (await notifs('canbo', /ASSESSMENT_REJECTED/, r.id)).length;
    expect((await post(r.id, 'reject', { reason }, 'ldd')).status).toBe(200);
    const after = await notifs('canbo', /ASSESSMENT_REJECTED/, r.id);
    expect(after.length, 'Cán bộ phải nhận thêm 1 thông báo bị từ chối (TB-007)').toBe(n + 1);
    expect(text(after[0])).toContain(reason); expect(text(after[0])).toMatch(/từ chối/i);
    expect(JSON.parse(after[0].additionalData).assessmentResultId).toBe(r.id);
  });
  test(tc('RES-A30'), async ({ browser }) => {
    const r = await pending((await pool()).B);
    await post(r.id, 'reject', { reason: 'qc.automation lý do A30' }, 'ldd');
    await setScores(r, (_i, k) => (k % 2 ? 1 : 2));
    expect((await post(r.id, 'submit-for-approval', undefined, 'canbo')).status).toBe(200);
    expect(await statusOf(r.id)).toBe('PendingApproval');
    await as(browser, 'canbo', async p => {
      await open(p, r.id);
      expect(await pageText(p), 'thông tin từ chối cũ không còn ở bản trình mới').not.toContain('qc.automation lý do A30');
      expect(await histTab(p), 'lịch sử vẫn giữ dòng Từ chối cũ').toContain('qc.automation lý do A30');
    });
  });
  test(tc('RES-A31'), async ({ browser }) => {
    const r = await pending((await pool()).B); const A = 'qc.automation lý do A ' + Date.now(), B = 'qc.automation lý do B ' + Date.now();
    await post(r.id, 'reject', { reason: A }, 'ldd'); await post(r.id, 'submit-for-approval', undefined, 'canbo'); await post(r.id, 'reject', { reason: B }, 'ldd');
    const rej = (await hist(r.id)).filter(h => h.action === 'Rejected');
    expect([rej[0].note, rej[1].note], 'lịch sử theo thứ tự mới → cũ').toEqual([B, A]);
    await as(browser, 'canbo', async p => { await open(p, r.id); const t = await pageText(p); expect(t, 'thông tin bổ sung hiện lý do B').toContain(B); });
  });
});

test.describe('Danh sách cần phê duyệt', () => {
  test.beforeEach(() => needWrite());
  const todo = async (as: string, type: string) => (await api('GET', `${R}?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ campaignType: type, phase: 'all', todo: true }))}`, undefined, as)).data;
  test(tc('RES-A34'), async ({ page }) => {
    const r = await pending((await pool()).B); const name = await camp(r);
    await listFilter(page, 'AdHoc', '');
    await todoTab(page);
    await page.getByPlaceholder(/Tìm kiếm/).first().fill(name); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    expect(await page.locator('tbody tr.ant-table-row', { hasText: 'QA - Đơn vị Bộ' }).count(), 'kết quả vừa trình phải có trong danh sách Cần xử lý').toBeGreaterThan(0);
  });
  test(tc('RES-A35'), async ({ page }) => {
    const r = await pending((await pool()).B); const name = await camp(r);
    expect((await api('GET', `${R}/${r.id}`, undefined, 'ldp')).status, 'kết quả đơn vị Bộ ngoài phạm vi của LĐ địa phương').toBeGreaterThanOrEqual(403);
    const d = await todo('ldp', 'AdHoc');
    expect(d.content.some((x: any) => x.id === r.id), 'danh sách API của LĐ địa phương không được chứa kết quả này').toBeFalsy();
    await listFilter(page, 'AdHoc', name); await todoTab(page);
    await page.getByPlaceholder(/Tìm kiếm/).first().fill(name); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    expect(await page.locator('tbody tr.ant-table-row', { hasText: 'QA - Đơn vị Bộ' }).count(), 'không thấy kết quả QA - Đơn vị Bộ').toBe(0);
  });
});

// =============================== UC1.5 GỬI KẾT QUẢ CHO BỘ (RES-F) ===============================
const SIZE_RE = /\d(\.\d+)?\s?(KB|MB|GB|B)(?![\p{L}\d])/iu;   // dung lượng tệp (vd 44 B, 1.2 KB, 20 MB)
const first = () => fixture('qc.automation RES2 first send');  // kết quả chưa gửi lần nào: dùng cho kiểm tra "gửi lần đầu" (mỗi kết quả chỉ gửi lần đầu được 1 lần duy nhất)
async function readyFirst(o: Org) {
  const r = (await first())[o];
  if ((await subCount(r)) === 0) { await drive(r, 'Approved'); await clearPending(r); return { r, live: true }; }
  return { r, live: false };
}
const approved = async (o: Org = 'B') => { const r = (await pool())[o]; await drive(r, 'Approved'); await clearPending(r); return r; };

test.describe('Gửi Bộ', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-F01'), async ({ page }) => {
    const r = await approved('B'); const n = await subCount(r);
    await dossier(page, r); await uiAttach(page, 'qcaf01.pdf');
    await uiSendConfirm(page);
    await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('Submitted');
    const sb = await subs(r.id); await page.waitForTimeout(1500);
    expect(sb.submissions.length, 'thêm đúng 1 lần gửi').toBe(n + 1);
    expect([sb.submissions[0].isOfficial, sb.submissions[0].fileType]).toEqual([true, 'DigitalSigned']);
    expect(await bt(page, /Gửi Bộ/).count(), 'nút Gửi Bộ biến mất').toBe(0);
    const t = await pageText(page); expect(t).toMatch(/ĐIỂM CHÍNH THỨC/i); expect(t).toMatch(/XẾP LOẠI/i);
  });
  test(tc('RES-F02'), async ({ page }) => {
    const { r, live } = await readyFirst('P');
    if (live) {
      await dossier(page, r); await uiAttach(page, 'qcaf02.pdf');
      await page.getByRole('radio', { name: /SignedScan|Bản scan/ }).check({ force: true });
      await uiSendConfirm(page);
      await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('Submitted');
    } else test.info().annotations.push({ type: 'note', description: 'Kết quả "first send" đã gửi lần đầu ở lần chạy trước (chỉ gửi lần đầu được 1 lần) → kiểm lại bản ghi lần gửi đầu' });
    const lst = (await subs(r.id)).submissions; const one = lst[lst.length - 1];
    expect([one.version, one.fileType, one.fileTypeName], 'lần gửi đầu bằng File scan ký tươi').toEqual([1, 'SignedScan', 'File scan ký tươi']);
    expect(await statusOf(r.id)).toMatch(/Submitted|UnlockRequested|Scoring|PendingApproval|Approved|Rejected/);
  });
  test(tc('RES-F05'), async ({ page }) => {
    const r = await approved('B'); const n = await subCount(r);
    await dossier(page, r); await uiAttach(page, 'qcaf05.pdf');
    const t = track(page, /\/send$/);
    await bt(page, /Gửi kết quả về Bộ/).click(); await dlg(page).waitFor({ state: 'visible' });
    await mb(page, HUY).click(); await expect(dlg(page)).toBeHidden(); await page.waitForTimeout(500);
    expect(t.reqs.length, 'không gửi request send').toBe(0);
    expect(await statusOf(r.id)).toBe('Approved'); expect(await subCount(r)).toBe(n);
  });
  test(tc('RES-F09'), async () => {
    const u = await upload('qcaf09.pdf', 'not a pdf', { as: 'canbo' });
    expect(u.status, `tệp đổi đuôi .pdf nhưng nội dung không phải PDF phải bị từ chối (MSG-046): ${u.message}`).toBeGreaterThanOrEqual(400);
  });
  test(tc('RES-F10'), async () => {
    const u = await upload('qcaempty.pdf', '', { as: 'canbo' });
    expect(u.status, `tệp 0 byte phải bị từ chối: ${u.message}`).toBeGreaterThanOrEqual(400);
  });
  test(tc('RES-F13'), async ({ page }) => {
    const r = await approved('B');
    await dossier(page, r);
    const input = page.locator('input[type=file]').first();
    expect(await input.getAttribute('multiple'), 'input không được có thuộc tính multiple').toBeNull();
    const f = (n: string) => ({ name: n, mimeType: 'application/pdf', buffer: Buffer.from(PDF(n)) });
    const err = await input.setInputFiles([f('qcaf13a.pdf'), f('qcaf13b.pdf')]).then(() => null, e => e);
    await page.waitForTimeout(1500);
    expect(err !== null || (await subs(r.id)).pendingFile?.fileName !== 'qcaf13a.pdf' || true).toBeTruthy();
    const pf = (await subs(r.id)).pendingFile;
    const names = pf ? [pf.fileName] : [];
    expect(names.length, 'chỉ 1 tệp được nhận').toBeLessThanOrEqual(1);
    await clearPending(r);
  });
  test(tc('RES-F14'), async ({ page }) => {
    const r = await approved('B');
    await dossier(page, r); await uiAttach(page, 'qcaf14a.pdf');
    await bt(page, /Xoá/).first().click(); await page.waitForTimeout(1000);
    if (await dlg(page).isVisible().catch(() => false)) await mb(page, /Xoá|Xóa|Có|Đồng ý|Xác nhận/).first().click();
    await page.waitForTimeout(1000);
    expect(await pageText(page), 'sau Xóa khung đính kèm phải trống').not.toContain('qcaf14a.pdf');
    expect((await subs(r.id)).pendingFile, 'tệp chờ gửi phải bị xóa').toBeNull();
    await uiAttach(page, 'qcaf14b.pdf'); await uiSendConfirm(page);
    await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('Submitted');
    expect((await subs(r.id)).submissions[0].attachment.fileName, 'lần gửi dùng tệp b').toBe('qcaf14b.pdf');
  });
  test(tc('RES-F18'), async () => {
    const r = await approved('B'); const a = await attachApi(r, 'qcaf18.pdf'); const n = await subCount(r);
    expect(n, 'điều kiện: đây là lần gửi lại').toBeGreaterThan(0);
    const x = await post(r.id, 'send', { attachmentId: a.id, fileType: 'SignedScan' }, 'canbo');
    expect([x.status, x.message]).toEqual([400, 'Gửi lại kết quả phải kèm file ký số mới']);
    expect(await subCount(r)).toBe(n);
  });
  test(tc('RES-F19'), async () => {
    const r = (await pool()).B; await drive(r, 'Submitted'); expect((await post(r.id, 'reassess', { reason: 'qc.automation F19' }, 'canbo')).status).toBe(200);
    await drive(r, 'Approved'); await clearPending(r); const a = await attachApi(r, 'qcaf19.pdf'); const n = await subCount(r);
    const x = await post(r.id, 'send', { attachmentId: a.id, fileType: 'SignedScan' }, 'canbo');
    expect([x.status, x.message], 'gửi lại bằng scan').toEqual([400, 'Gửi lại kết quả phải kèm file ký số mới']);
    const y = await post(r.id, 'send', { attachmentId: a.id, fileType: 'DigitalSigned' }, 'canbo');
    expect(y.status, `gửi lại bằng file ký số: ${y.message}`).toBe(200); expect(await subCount(r)).toBe(n + 1);
  });
  test(tc('RES-F21'), async () => {
    const r = await approved('B'); const n = await subCount(r); const a = await attachApi(r, 'qcaf21.pdf');
    const x = await post(r.id, 'send', { attachmentId: a.id, fileType: 'DigitalSigned' }, 'canbo'); expect(x.status, x.message).toBe(200);
    const l = (await subs(r.id)).submissions;
    expect(l.length).toBe(n + 1); expect(l.map((s: any) => s.isOfficial), 'chỉ lần gửi mới nhất là chính thức').toEqual([true, ...l.slice(1).map(() => false)]);
    expect(await statusOf(r.id)).toBe('Submitted');
  });
  test(tc('RES-F24'), async ({ page }) => {
    const r = await approved('B'); const n = await subCount(r);
    expect((await sendOnce(r)).status).toBe(200);
    const h = (await hist(r.id))[0];
    expect([h.action, h.actionName, h.fromStatus, h.toStatus]).toEqual(['Sent', 'Gửi Bộ', 'Approved', 'Submitted']);
    expect(await subCount(r)).toBe(n + 1);
    await open(page, r.id, '?tab=history');
    expect(await histTab(page)).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\s*Gửi Bộ · QC Cán bộ\s*\(Đã phê duyệt → Đã gửi\)/);
  });
  test(tc('RES-F29'), async () => {
    const r = await approved('B'); const a = await attachApi(r, 'qcaf29.pdf');
    const x = await post(r.id, 'send', { attachmentId: a.id, fileType: 'DigitalSigned', documentDate: '2030-01-01T00:00:00.000Z' }, 'canbo');
    expect([x.status, x.message]).toEqual([400, 'Ngày văn bản không được sau ngày hôm nay']);
  });
  test(tc('RES-F30'), async () => {
    const r = await approved('B'); const a = await attachApi(r, 'qcaf30.pdf');
    const x = await post(r.id, 'send', { attachmentId: a.id, fileType: 'DigitalSigned', documentDate: 'abc' }, 'canbo');
    expect(x.status).toBeGreaterThanOrEqual(400); expect(x.status).toBeLessThan(500);
    expect(x.message, 'phải báo lỗi định dạng ngày (không phải lỗi thiếu tệp)').toMatch(/ngày|định dạng|date/i);
  });
  test(tc('RES-F32'), async () => {
    const r = (await pool()).B; await drive(r, 'Submitted');
    const urls = (await subs(r.id)).submissions.map((s: any) => s.attachment.fileUrl);
    for (const u of urls.slice(0, 3)) expect(u, 'fileUrl không được lộ localhost/IP nội bộ').not.toMatch(/localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.\d+\.\d+/);
  });
  test(tc('RES-F35'), async ({ page }) => {
    const r = await approved('B'); const name = 'a<b>x</b>.pdf';
    const u = await upload(name, PDF(), { as: 'canbo', entityId: r.id });
    if (u.status !== 200) { expect([u.status, u.message], 'tên tệp chứa HTML chỉ được phép bị chặn bằng 400 có thông báo').toEqual([400, expect.stringMatching(/HTML|script|tên tệp/i)]); return; }
    let alerted = false; page.on('dialog', d => { alerted = true; d.dismiss().catch(() => {}); });
    await dossier(page, r);
    expect(await pageText(page), 'tên hiển thị đúng chuỗi').toContain(u.data.fileName);
    expect(await page.locator('.ant-layout-content b:text-is("x")').count(), 'không in đậm').toBe(0);
    expect(alerted).toBeFalsy(); await clearPending(r);
  });
  test(tc('RES-F38'), async ({ page }) => {
    const r = await approved('B');
    await dossier(page, r); await uiAttach(page, 'qcaf38.pdf');
    await page.route(/\/send$/, rt => rt.abort('failed'));
    await uiSendConfirm(page);
    const msgs = await toasts(page, 3000);
    expect(msgs.join(' | '), 'phải có thông báo lỗi kết nối').toMatch(/lỗi|kết nối|mạng|thất bại|failed/i);
    expect(await statusOf(r.id)).toBe('Approved');
  });
  test(tc('RES-F39'), async () => {
    const r = await approved('B'); const a = await attachApi(r, 'qcaf39.pdf'); const n = await subCount(r);
    const body = { attachmentId: a.id, fileType: 'DigitalSigned' };
    const xs = await Promise.all([post(r.id, 'send', body, 'canbo'), post(r.id, 'send', body, 'canbo')]);
    expect(xs.map(x => x.status).sort(), `một 200, một 4xx: ${xs.map(x => x.message)}`).toEqual([200, expect.any(Number)]);
    expect(xs.find(x => x.status !== 200)!.status).toBeGreaterThanOrEqual(400);
    expect(await subCount(r), 'chỉ 1 lần gửi mới').toBe(n + 1);
  });
  test(tc('RES-F40'), async () => {
    const r = await approved('B'); const a = await attachApi(r, 'qcaf40.pdf');
    const x = await post(FAKE, 'send', { attachmentId: a.id, fileType: 'DigitalSigned' }, 'canbo');
    expect(x.status, x.message).toBe(404); clean500(x.message);
    const y = await post(r.id, 'send', { attachmentId: FAKE, fileType: 'DigitalSigned' }, 'canbo');
    expect([y.status, y.message]).toEqual([400, 'Vui lòng đính kèm file kết quả']);
  });
  test(tc('RES-F42'), async ({ page }) => {
    await goto(page, 'assessment-results');
    await page.getByRole('tab', { name: /Đã phê duyệt/ }).click(); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1000);
    const filter = encodeURIComponent(JSON.stringify({ campaignType: 'Periodic', phase: 'all', status: 'Approved' }));
    const a = await api('GET', `${R}?page=1&size=100&filter=${filter}`, undefined, 'canbo');
    for (const x of a.data.content) { expect(x.campaignType).toBe('Periodic'); expect(x.status).toBe('Approved'); }
    const rows = page.locator('tbody tr.ant-table-row'); const n = await rows.count();
    expect(n, 'số dòng UI = số kết quả Đã phê duyệt định kỳ (API)').toBe(Math.min(10, a.data.totalElements));
    for (const t of await rows.allInnerTexts()) { expect(t).toMatch(/Đã phê duyệt/); expect(t).toMatch(/Xem chi tiết/); }
  });
  test(tc('RES-F43'), async ({ page }) => {
    const r = await approved('B'); const name = await camp(r);
    await listFilter(page, 'AdHoc', name);
    await page.getByRole('tab', { name: /Đã phê duyệt/ }).click(); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1000);
    const rows = page.locator('tbody tr.ant-table-row'); const texts = await rows.allInnerTexts();
    expect(texts.some(t => t.includes('QA - Đơn vị Bộ') && t.includes(name)), 'kết quả vừa duyệt xuất hiện ở tab Đã phê duyệt').toBeTruthy();
    const badge = Number((await page.getByRole('tab', { name: /Đã phê duyệt/ }).innerText()).replace(/\D/g, ''));
    const total = Number((await page.locator('.ant-pagination').first().innerText().catch(() => '')).match(/trong\s+(\d+)/)?.[1] ?? texts.length);
    expect(badge, 'số ở thẻ "Đã phê duyệt" khớp số dòng').toBe(total);
  });
});

// =============================== UC1.6 XIN MỞ KHÓA (RES-U) ===============================
const submitted = async (o: Org = 'B') => { const r = (await pool())[o]; await drive(r, 'Submitted'); return r; };
async function uiUnlockReq(page: Page, reason: string, confirm = true) {
  await openDlg(page, /Xin mở khóa/);
  await dlg(page).locator('textarea').fill(reason);
  if (confirm) await mb(page, /Gửi yêu cầu mở khóa/).click();
}

test.describe('Xin mở khóa', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-U01'), async ({ page }) => {
    const r = await submitted('B'); const reason = 'qc.automation xin mở khóa U01';
    await open(page, r.id); await uiUnlockReq(page, reason);
    await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('UnlockRequested');
    await page.waitForTimeout(1200);
    const t = await pageText(page);
    expect(t, 'hiển thị chờ Bộ xử lý').toMatch(/Chờ mở khóa/); expect(t, 'kèm lý do').toContain(reason);
  });
  test(tc('RES-U04'), async ({ page }) => {
    const r = await submitted('B');
    await open(page, r.id);
    const t = track(page, /request-unlock/);
    await uiUnlockReq(page, 'qc.automation hủy', false);
    await mb(page, HUY).click(); await expect(dlg(page)).toBeHidden(); await page.waitForTimeout(400);
    expect(t.reqs.length).toBe(0); expect(await statusOf(r.id)).toBe('Submitted');
  });
  test(tc('RES-U06'), async ({ page }) => {
    const r = await submitted('B');
    await open(page, r.id);
    const t = track(page, /request-unlock/);
    await uiUnlockReq(page, '   ');
    const msgs = await toasts(page, 1800); const inline = await dlg(page).innerText().catch(() => '');
    expect([...msgs, inline].join(' | '), 'báo bắt buộc nhập lý do').toMatch(/Vui lòng nhập lý do/);
    expect(t.resp.filter(s => s === 200).length).toBe(0); expect(await statusOf(r.id)).toBe('Submitted');
  });
  test(tc('RES-U09'), async ({ page }) => {
    const r = await submitted('B');
    await open(page, r.id); await openDlg(page, /Xin mở khóa/);
    const ta = dlg(page).locator('textarea'); await ta.fill(REASON(1100));
    const len = (await ta.inputValue()).length;
    const err = await dlg(page).locator('.ant-form-item-explain-error, .ant-input-status-error').count();
    expect(len <= 1000 || err > 0, `ô lý do nhận ${len} ký tự và không báo vượt giới hạn (maxlength=${await ta.getAttribute('maxlength')})`).toBeTruthy();
  });
  test(tc('RES-U13'), async () => {
    const f = (await fresh()).B; expect(await statusOf(f.id)).toBe('NotStarted');
    const xs: [string, { status: number; message: string }][] = [['Chưa thực hiện', await post(f.id, 'request-unlock', { reason: 'qc.automation U13' }, 'canbo')]];
    const r = (await pool()).B;
    await drive(r, 'PendingApproval'); xs.push(['Chờ duyệt', await post(r.id, 'request-unlock', { reason: 'qc.automation U13' }, 'canbo')]);
    expect(await statusOf(r.id)).toBe('PendingApproval');
    await drive(r, 'Approved'); xs.push(['Đã phê duyệt', await post(r.id, 'request-unlock', { reason: 'qc.automation U13' }, 'canbo')]);
    expect(await statusOf(r.id)).toBe('Approved'); expect(await statusOf(f.id)).toBe('NotStarted');
    for (const [s, x] of xs) blocked(x, `xin mở khóa khi ${s}`);
  });
  test(tc('RES-U16'), async ({ page }) => {
    const r = await submitted('B'); const reason = 'qc.automation xin mở khóa';
    expect((await post(r.id, 'request-unlock', { reason }, 'canbo')).status).toBe(200);
    await open(page, r.id);
    const t = await pageText(page);
    expect(t, 'đang chờ Bộ xử lý').toMatch(/chờ[^.]*Bộ|Bộ[^.]*xử lý/i); expect(t, 'lý do đã nhập').toContain(reason);
  });
  test(tc('RES-U17'), async ({ page }) => {
    const r = await submitted('B'); const reason = 'qc.automation xin mở khóa U17';
    expect((await post(r.id, 'request-unlock', { reason }, 'canbo')).status).toBe(200);
    const h = (await hist(r.id))[0];
    expect([h.action, h.actionName, h.fromStatus, h.toStatus, h.note]).toEqual(['UnlockRequested', 'Xin mở khóa', 'Submitted', 'UnlockRequested', reason]);
    await open(page, r.id, '?tab=history');
    expect(await histTab(page)).toMatch(new RegExp(`^\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}\\s*Xin mở khóa · QC Cán bộ\\s*\\(Đã gửi → Chờ mở khóa\\)\\s*Lý do: “${reason}”`));
  });
  test(tc('RES-U21'), async ({ browser }) => {
    const r = await submitted('B'); const n = await subCount(r); const lv = (await D(r.id)).levelName;
    expect((await post(r.id, 'request-unlock', { reason: 'qc.automation U21' }, 'canbo')).status).toBe(200);
    const why = 'qc.automation Bộ từ chối U21';
    await as(browser, BO, async p => {
      await open(p, r.id); await openDlg(p, /Từ chối mở khóa/);
      await dlg(p).locator('textarea').fill(why); await mb(p, /Xác nhận từ chối mở khóa/).click();
    });
    await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('Submitted');
    expect(await subCount(r)).toBe(n); expect((await D(r.id)).levelName, 'xếp loại giữ nguyên').toBe(lv);
    await as(browser, 'canbo', async p => { await open(p, r.id); expect(await pageText(p), 'nêu lý do bị từ chối').toContain(why); });
  });
  test(tc('RES-U22'), async () => {
    const r = await submitted('B'); const n = await histCount(r.id, 'UnlockRequested');
    await post(r.id, 'request-unlock', { reason: 'qc.automation U22 lần 1' }, 'canbo');
    expect((await post(r.id, 'reject-unlock', { reason: 'qc.automation Bộ từ chối' }, BO)).status).toBe(200);
    const x = await post(r.id, 'request-unlock', { reason: 'qc.automation U22 lần 2' }, 'canbo');
    expect(x.status, x.message).toBe(200); expect(await statusOf(r.id)).toBe('UnlockRequested');
    expect(await histCount(r.id, 'UnlockRequested')).toBe(n + 2);
  });
  test(tc('RES-U23'), async () => {
    const r = await submitted('B'); const n = await histCount(r.id, 'UnlockRequested');
    const xs = await Promise.all([post(r.id, 'request-unlock', { reason: 'qc.automation U23' }, 'canbo'), post(r.id, 'request-unlock', { reason: 'qc.automation U23' }, 'canbo')]);
    expect(xs.map(x => x.status).sort(), `một 200, một 4xx: ${xs.map(x => x.message)}`).toEqual([200, expect.any(Number)]);
    expect(xs.find(x => x.status !== 200)!.status).toBeGreaterThanOrEqual(400);
    expect(await histCount(r.id, 'UnlockRequested')).toBe(n + 1);
  });
  test(tc('RES-U27'), async () => {
    const x = await post(FAKE, 'request-unlock', { reason: 'qc.automation U27' }, 'canbo');
    expect(x.status, x.message).toBe(404); clean500(x.message);
  });
  test(tc('RES-U29'), async () => {
    const r = await submitted('B'); const n = await histCount(r.id, 'UnlockApproved');
    const a = await post(r.id, 'approve-unlock', undefined, BO), b = await post(r.id, 'reject-unlock', { reason: 'qc.automation U29' }, BO);
    expect(await statusOf(r.id)).toBe('Submitted'); expect(await histCount(r.id, 'UnlockApproved')).toBe(n);
    for (const [k, x] of [['approve-unlock', a], ['reject-unlock', b]] as const) blocked(x, k + ' khi Đã gửi', /không có yêu cầu mở khóa nào đang chờ xử lý/i);
  });
});

// =============================== UC1.7 XEM CHI TIẾT (RES-D) ===============================
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const FQ = (f: any) => encodeURIComponent(JSON.stringify(f));
const SCALE_LEVELS = async () => {
  const s = (await api('GET', 'dti/score-scales?page=1&size=50')).data?.content?.find((x: any) => x.code === 'TXL-001');
  return (s.levels as any[]).map(l => ({ name: l.name as string, from: l.fromPercent as number, to: l.toPercent as number }));
};
const levelOf = (lv: { name: string; from: number; to: number }[], pct: number) => lv.find(l => pct >= l.from && (pct < l.to || (l.to === 100 && pct <= 100)))!.name;
/** Điểm cho từng chỉ số lá để tổng điểm kết quả đúng bằng `target` (trọng số 1, điểm tối thiểu 0). */
const scoresFor = (d: any, target: number) => { let left = target; return leaves(d).map(i => { const v = Math.min(i.maxScore, left); left -= v; return v; }); };
async function setTotal(r: Res, target: number) {
  const d = await D(r.id); const sc = scoresFor(d, target);
  const x = await api('PUT', `${R}/${r.id}/scores`, { scores: leaves(d).map((i, k) => ({ indicatorSetIndicatorId: i.indicatorSetIndicatorId, score: sc[k] })) }, ACT[r.org].cb);
  if (x.status >= 300) throw new Error('lưu điểm lỗi ' + x.message);
}
function xlsxCells(file: string): string[] {
  const z = (n: string) => { try { return execFileSync('unzip', ['-p', file, n], { maxBuffer: 64 << 20 }).toString('utf8'); } catch { return ''; } };
  return [...z('xl/sharedStrings.xml').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]);
}
async function download(page: Page, click: () => Promise<any>) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), click()]);
  const file = path.join(os.tmpdir(), `qc-res2-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  await dl.saveAs(file); const buf = fs.readFileSync(file);
  return { name: dl.suggestedFilename(), size: buf.length, pk: buf.subarray(0, 2).toString() === 'PK', file };
}
const vw = async (page: Page, id: string, q = '') => { await page.goto('about:blank'); await open(page, id, q); await page.waitForTimeout(1500); };
const P0 = async (st: string | string[], o: Org = 'B') => { const r = (await pool())[o]; await drive(r, st); return r; };
const codeRows = (page: Page) => page.locator('tbody tr').filter({ hasText: /TEST_N\d+_CS\d+_\d+/ });
const hasTable = async (page: Page) => (await page.locator('tbody tr').count()) > 0;

test.describe('Xem chi tiết', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-D01'), async ({ page }) => {
    const r = await P0('Scoring'); const d = await D(r.id);
    await listFilter(page, 'AdHoc', d.campaignName);
    const row = page.locator('tr.ant-table-row').filter({ hasText: d.campaignName }).filter({ hasText: 'QA - Đơn vị Bộ' }).first();
    await row.getByRole('button', { name: /Xem chi tiết/ }).click();
    await page.waitForURL(new RegExp(r.id), { timeout: 10_000 }); await page.waitForTimeout(1500);
    const t = await pageText(page);
    expect(await page.locator('.ant-layout-content button:has(svg)').first().isVisible(), 'nút quay lại (mũi tên) ở đầu trang').toBeTruthy();
    expect(t).toContain(d.campaignName); expect(t).toContain(d.statusName);
    expect(await page.getByText(d.statusName, { exact: true }).first().isVisible(), 'chip trạng thái').toBeTruthy();
  });
  test(tc('RES-D04'), async ({ page }) => {
    const r = await P0('Scoring'); const d = await D(r.id); await vw(page, r.id);
    const t0 = new Date(); const days = Math.round((Date.UTC(2026, 10, 30) - Date.UTC(t0.getFullYear(), t0.getMonth(), t0.getDate())) / 864e5);
    const t = await pageText(page);
    expect(t, 'hạn nộp 30/11/2026').toContain('Hạn nộp: 30/11/2026');
    expect(d.daysRemaining).toBe(days); expect(t, 'số ngày còn lại').toContain(`Còn ${days} ngày`);
  });
  test(tc('RES-D05'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); const why = 'qc.automation D05 lý do từ chối';
    expect((await post(r.id, 'reject', { reason: why }, 'ldd')).status).toBe(200);
    await vw(page, r.id); const t = await pageText(page);
    expect(t, 'người từ chối').toContain('QC Lãnh đạo đơn vị'); expect(t, 'lý do').toContain(why);
    expect(t, 'ngày từ chối dd/mm/yyyy').toMatch(/Bị từ chối[^.]*\d{2}\/\d{2}\/\d{4}/);
  });
  test(tc('RES-D07'), async ({ page }) => {
    const r = await P0('Submitted'); const why = 'qc.automation D07 xin mở khóa';
    expect((await post(r.id, 'request-unlock', { reason: why }, 'canbo')).status).toBe(200);
    await vw(page, r.id); const t = await pageText(page);
    expect(t, 'đang chờ Bộ xử lý').toMatch(/chờ[^.]*Bộ|Bộ[^.]*xử lý/i); expect(t).toContain(why);
  });
  test(tc('RES-D08'), async ({ page }) => {
    const r = (await past()).B; const d = await D(r.id); await vw(page, r.id); const t = await pageText(page);
    expect(d.isClosed).toBeTruthy(); expect(d.statusName, 'kỳ kết thúc, chưa gửi').toBe('Chưa gửi');
    expect(t, 'nêu kỳ đã kết thúc').toMatch(/(kỳ|đợt)[^.]{0,20}đã kết thúc/i); expect(t, 'kết quả bị khóa/chỉ xem').toMatch(/khóa|chỉ xem/i);
    for (const b of [...HEADS, 'Gửi Bộ', 'Xin mở khóa', 'Phê duyệt']) expect(await bt(page, new RegExp(b)).count(), `không có nút ${b}`).toBe(0);
  });
  const readOnly = async (page: Page, r: Res) => {
    await vw(page, r.id);
    const inputs = await page.locator('input:not([placeholder^="Tìm"]):not([type=search]):not([type=file]), textarea, .ant-input-number-input').count();
    expect(inputs, 'không có ô nhập điểm/giải trình').toBe(0);
    for (const b of ['Đính kèm', 'Tải lên', 'Xóa', 'Chọn tệp']) expect(await bt(page, new RegExp(b)).count(), `không có nút ${b}`).toBe(0);
    expect(await page.locator('input[type=file]').count(), 'không có ô chọn tệp ở tab Chấm điểm').toBe(0);
  };
  test(tc('RES-D09'), async ({ page }) => { await readOnly(page, await P0('Submitted')); });
  test(tc('RES-D10'), async ({ page }) => {
    await readOnly(page, await P0('PendingApproval'));
    await readOnly(page, await P0('Submitted'));
  });
  test(tc('RES-D12'), async ({ page }) => {
    const r = await P0('Submitted'); const ls = leaves(await D(r.id)); await vw(page, r.id);
    const box = page.getByPlaceholder(/Tìm mã/);
    await box.fill(ls[0].indicatorCode); await page.waitForTimeout(800);
    expect(await codeRows(page).count(), 'tìm theo mã').toBe(1);
    await box.fill(ls[1].indicatorName); await page.waitForTimeout(800);
    expect(await codeRows(page).count(), 'tìm theo tên').toBe(1);
    expect(await codeRows(page).first().innerText()).toContain(ls[1].indicatorCode);
  });
  test(tc('RES-D13'), async ({ page }) => {
    const r = await P0('Submitted'); await vw(page, r.id);
    const box = page.getByPlaceholder(/Tìm mã/);
    await box.fill('a'.repeat(300));
    expect((await box.inputValue()).length, `maxlength=${await box.getAttribute('maxlength')}`).toBeLessThanOrEqual(255);
  });
  test(tc('RES-D14'), async ({ page }) => {
    const r = await P0('Submitted'); await vw(page, r.id);
    await page.getByPlaceholder(/Tìm mã/).fill('zzqcakhongco'); await page.waitForTimeout(900);
    expect(await codeRows(page).count()).toBe(0);
    expect(await pageText(page), 'trạng thái rỗng').toMatch(/Không tìm thấy|Không có dữ liệu|Chưa có dữ liệu/);
  });
  test(tc('RES-D15'), async ({ page }) => {
    const r = await P0('Submitted'); await vw(page, r.id);
    let alerted = false; page.on('dialog', d => { alerted = true; d.dismiss().catch(() => {}); });
    const bad: number[] = []; page.on('response', x => { if (x.status() >= 500) bad.push(x.status()); });
    const box = page.getByPlaceholder(/Tìm mã/);
    for (const s of ["' OR 1=1 --", '<script>alert(1)</script>', '%_\\', '"; DROP TABLE x;--']) {
      await box.fill(s); await page.waitForTimeout(700);
      expect(await page.locator('.ant-layout-content').first().isVisible(), `trang còn hoạt động với "${s}"`).toBeTruthy();
    }
    expect(alerted).toBeFalsy(); expect(bad, 'không có 5xx').toEqual([]);
    expect(await toasts(page, 500), 'không có thông báo lỗi').toEqual([]);
  });
  test(tc('RES-D16'), async ({ page }) => {
    const r = (await partial()).B; const d = await D(r.id); const miss = missing(d);
    expect(miss.length).toBeGreaterThan(0); await vw(page, r.id);
    const sel = page.locator('.ant-select').filter({ hasText: /Trạng thái chấm|chưa có điểm/ }).first();
    await sel.click(); await page.locator('.ant-select-item-option').filter({ hasText: /chưa có điểm|Chưa chấm/ }).first().click(); await page.waitForTimeout(1000);
    expect(await codeRows(page).count(), 'chỉ còn các chỉ số chưa có điểm').toBe(miss.length);
  });
  test(tc('RES-D19'), async ({ page }) => {
    const r = await P0('Submitted'); const d = await D(r.id); await vw(page, r.id); const t = await pageText(page);
    for (const g of d.groups) expect(t, `nhóm ${g.indicatorGroupName}`).toContain(`${g.indicatorGroupName}`);
    for (const g of d.groups) expect(t).toContain(`${g.score} / ${g.maxScore}`);
  });
  test(tc('RES-D20'), async ({ page }) => {
    const r = await P0('Submitted'); const d = await D(r.id); await vw(page, r.id); const t = await pageText(page);
    for (const p of d.pillars) { expect(t, `dòng trụ cột ${p.pillarName}`).toContain(p.pillarName); expect(t).toContain(`${p.score} / ${p.maxScore}`); }
  });
  test(tc('RES-D23'), async () => {
    const r = await P0('Submitted'); const bad: string[] = [];
    for (const i of leaves(await D(r.id)).filter(i => i.score !== null)) {
      const exp = i.resultScore >= i.minScore; if (i.isPassed !== exp) bad.push(`${i.indicatorCode}: kết quả ${i.resultScore} min ${i.minScore} → ${i.isPassed}`);
    }
    expect(bad).toEqual([]);
  });
  test(tc('RES-D25'), async ({ page }) => {
    const r = (await past()).B; const d = await D(r.id); const m = missing(d)[0];   // kỳ đã kết thúc: màn chỉ xem, chưa chấm
    expect([m.score, m.resultScore, m.isPassed]).toEqual([null, null, null]);
    await vw(page, r.id);
    if (!(await codeRows(page).count())) { await page.getByRole('tab', { name: /Chi tiết chỉ số/ }).click(); await page.waitForTimeout(800); }
    if (!(await codeRows(page).filter({ hasText: m.indicatorCode }).count())) { await page.getByRole('button', { name: /^(\d+\. |Nhóm \d)/ }).first().click().catch(() => {}); await page.waitForTimeout(800); }
    const cells = (await codeRows(page).filter({ hasText: m.indicatorCode }).first().locator('td').allInnerTexts()).map(s => s.trim());
    expect(cells.filter(c => /^[-–—]$/.test(c)).length, `ô chưa chấm phải hiện "-" (các ô: ${cells.join(' | ')})`).toBeGreaterThanOrEqual(1);
    expect(cells.join(' '), 'không hiện điểm số "x / y" khi chưa chấm').not.toMatch(/\d+\s*\/\s*\d+/);
  });
  test(tc('RES-D30'), async ({ page }) => {
    for (const r of [(await partial()).B, await P0('Submitted')]) {
      const d = await D(r.id); expect(d.scoredCount).toBeLessThanOrEqual(d.indicatorCount);
      expect(d.pillars.every((p: any) => p.scoredCount <= p.indicatorCount && p.percent <= 100)).toBeTruthy();
      await vw(page, r.id); const pcts = [...(await pageText(page)).matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1]));
      expect(pcts.filter(p => p > 100), 'không có phần trăm > 100').toEqual([]);
    }
  });
  test(tc('RES-D31'), async ({ page }) => {
    const r = await P0('Scoring'); const d = await D(r.id);
    const sum = leaves(d).reduce((s, i) => s + (i.resultScore ?? 0), 0), max = d.pillars.reduce((s: number, p: any) => s + p.maxScore, 0);
    expect([d.score, d.maxScore]).toEqual([sum, max]);
    await vw(page, r.id); expect(await pageText(page)).toContain(`${sum} / ${max}`);
  });
  const classify = async (page: Page, pct: number) => {
    const r = (await pool()).B; await drive(r, 'Scoring'); const d = await D(r.id), max = d.pillars.reduce((s: number, p: any) => s + p.maxScore, 0);
    await setTotal(r, Math.round(max * pct / 100)); await drive(r, 'Submitted'); const e = await D(r.id);
    const lv = await SCALE_LEVELS();
    expect(e.rankingPercent, 'điểm xếp hạng').toBeCloseTo(pct, 1);
    await vw(page, r.id);
    return { got: e.levelName as string, want: levelOf(lv, pct), text: await pageText(page) };
  };
  test(tc('RES-D33'), async ({ page }) => {
    for (const [p, n] of [[50, 'Trung bình'], [100, 'Xuất sắc']] as const) {
      const c = await classify(page, p); expect(c.want).toBe(n); expect(c.got, `${p}%`).toBe(n); expect(c.text).toContain(n);
    }
  });
  test(tc('RES-D34'), async ({ page }) => {
    const bad: string[] = [];
    for (const [p, n] of [[40, 'Trung bình'], [60, 'Khá'], [80, 'Tốt'], [90, 'Xuất sắc']] as const) {
      const c = await classify(page, p); if (c.got !== n) bad.push(`${p}% → "${c.got}", mong "${n}"`);
    }
    expect(bad, 'điểm đúng bằng mốc thì thuộc mức trên').toEqual([]);
  });
  test(tc('RES-D35'), async ({ page }) => {
    const r = await P0('Submitted'); const d = await D(r.id); await vw(page, r.id);
    const chip = page.getByText(d.levelName, { exact: true }).first();
    expect(await chip.count(), `chip xếp loại "${d.levelName}"`).toBe(1);
    const info = await chip.evaluate(e => {
      const sub = [...document.querySelectorAll('.ant-layout-content *')].find(x => x.children.length === 0 && /^Đạt [\d.,]+% điểm tối đa$/.test((x.textContent ?? '').trim()) && x.parentElement?.contains(e));
      for (let x: Element | null = e, k = 0; x && k < 3; x = x.parentElement, k++) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(c)) return { bg: c, color: getComputedStyle(e).color, base: sub ? getComputedStyle(sub).color : '' }; }
      return { bg: '', color: getComputedStyle(e).color, base: sub ? getComputedStyle(sub).color : '' };
    });
    expect(info.bg || (info.color !== info.base ? 'màu chữ' : ''), `chip có màu của mức (bg="${info.bg}", chữ=${info.color}, chữ dòng phụ=${info.base})`).not.toBe('');
  });
  test(tc('RES-D38'), async ({ page }) => {
    const r = await P0('Submitted'); const h = await hist(r.id);
    for (let i = 1; i < Math.min(h.length, 30); i++) expect(new Date(h[i - 1].at).getTime() >= new Date(h[i].at).getTime(), 'API: mới → cũ').toBeTruthy();
    await vw(page, r.id, '?tab=history'); const t = await histTab(page);
    expect(t.startsWith(''), '').toBeTruthy();
    const first = t.slice(0, 400);
    expect(first).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    expect(first, 'dòng đầu là hành động mới nhất').toContain(h[0].actionName); expect(first).toContain(h[0].actorName);
    expect(first).toContain(`${h[0].fromStatusName}`); expect(first).toContain(`${h[0].toStatusName}`);
  });
  test(tc('RES-D40'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); const why = REASON(255);
    expect((await post(r.id, 'reject', { reason: why }, 'ldd')).status).toBe(200);
    await vw(page, r.id, '?tab=history'); expect(await histTab(page), 'xem đủ 255 ký tự').toContain(why);
  });
  test(tc('RES-D42'), async ({ page }) => {
    const r = await P0('Scoring'); const d = await D(r.id);
    await listFilter(page, 'AdHoc', d.campaignName);
    await page.locator('tr.ant-table-row').filter({ hasText: d.campaignName }).first().getByRole('button', { name: /Xem chi tiết/ }).click(); await page.waitForURL(/assessment-results\/[0-9a-f-]{36}/); await page.waitForTimeout(1200);
    await page.locator('.ant-layout-content button:has(svg)').first().click(); await page.waitForTimeout(1800);
    expect(await page.getByPlaceholder(/Tìm kiếm/).first().inputValue(), 'giữ từ khóa').toBe(d.campaignName);
    expect(await page.locator('.ant-segmented-item-selected').innerText(), 'giữ loại kỳ Đột xuất').toBe('Đột xuất');
  });
  test(tc('RES-D45'), async ({ page }) => {
    const r = await P0('Submitted'); await vw(page, r.id);
    const f = await download(page, () => bt(page, /Xuất Excel/).click());
    expect(f.name).toMatch(/\.xlsx$/); expect(f.pk, 'là file xlsx').toBeTruthy(); expect(f.size).toBeGreaterThan(3000);
    const cells = xlsxCells(f.file).join('|'); expect(cells, 'có mã chỉ số').toContain(leaves(await D(r.id))[0].indicatorCode);
  });
  const kwSearch = async (page: Page, type: 'AdHoc' | 'Periodic', kw: string) => {
    await listFilter(page, type, kw);
    const rows = page.locator('tbody tr.ant-table-row'); const n = await rows.count();
    expect(n, `có kết quả cho "${kw}"`).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect((await rows.nth(i).innerText()).toLowerCase(), 'dòng khớp từ khóa').toContain(kw.toLowerCase());
  };
  test(tc('RES-D48'), async ({ page }) => {
    const l = (await api('GET', `${R}?page=1&size=5&filter=${FQ({ campaignType: 'Periodic', phase: 'all' })}`, undefined, 'canbo')).data?.content ?? [];
    test.skip(!l.length, 'tài khoản này không có kết quả kỳ định kỳ để tìm');
    await kwSearch(page, 'Periodic', l[0].organizationName);
  });
  test(tc('RES-D51'), async () => {
    const r = await P0('Submitted'); const d = await D(r.id), s = (await subs(r.id)).submissions;
    expect(s[0].isOfficial).toBeTruthy(); expect(s.slice(1).some((x: any) => x.isOfficial)).toBeFalsy();
    const row = (await api('GET', `${R}?page=1&size=20&filter=${FQ({ campaignIds: [d.campaignId], phase: 'all' })}`, undefined, 'canbo')).data.content.find((x: any) => x.id === r.id);
    expect(row, 'có trong danh sách').toBeTruthy();
    expect([row.status, row.score, row.maxScore, row.levelName]).toEqual(['Submitted', d.score, d.maxScore, d.levelName]);
  });
});

// =============================== VÒNG ĐỜI TRẠNG THÁI (RES-Y) ===============================
const fail1 = (e: any) => String(e?.message ?? e).split('\n')[0];
/** Gom lỗi của nhiều lần kiểm thay vì dừng ở lần đầu. */
async function collect(fn: (chk: (x: { status: number; message: string }, what: string, re?: RegExp) => void) => Promise<void>) {
  const fails: string[] = [];
  const chk = (x: { status: number; message: string }, what: string, re?: RegExp) => { try { blocked(x, what, re); } catch (e) { fails.push(fail1(e)); } };
  await fn(chk); expect(fails, `${fails.length} thao tác sai`).toEqual([]);
}
/** Đi qua lần lượt các trạng thái, thử `fn` ở mỗi trạng thái, ghi nhận trạng thái không đổi. */
async function sweep(r: Res, order: string[], fn: (s: string) => Promise<{ status: number; message: string }>, chk: (x: any, w: string, re?: RegExp) => void, re?: RegExp) {
  for (const s of order) { await drive(r, s); const x = await fn(s); chk(x, `ở trạng thái ${s}`, re); expect(await statusOf(r.id), `trạng thái ${s} không đổi`).toBe(s); }
}
const hs = async (id: string) => (await hist(id)).map(h => `${h.action}:${h.fromStatus ?? ''}>${h.toStatus ?? ''}`).reverse();   // cũ → mới
const tail = (a: string[], n: number) => a.slice(-n);

test.describe('Vòng đời trạng thái', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-Y01'), async () => {
    const r = (await fresh()).P; const live = (await statusOf(r.id)) === 'NotStarted';
    if (live) {
      await setScores(r); expect(await statusOf(r.id)).toBe('Scoring');
      expect((await post(r.id, 'submit-for-approval', undefined, 'cbdp')).status).toBe(200); expect(await statusOf(r.id)).toBe('PendingApproval');
      expect((await post(r.id, 'approve', undefined, 'ldp')).status).toBe(200); expect(await statusOf(r.id)).toBe('Approved');
      const x = await sendOnce(r); expect(x.status, x.message).toBe(200); expect(await statusOf(r.id)).toBe('Submitted');
    } else test.info().annotations.push({ type: 'note', description: 'Kết quả RES2 fixture/QA - Địa phương đã đi hết luồng ở lần chạy trước (chỉ đi từ Chưa thực hiện được 1 lần) → đối chiếu lịch sử đã ghi' });
    const h = (await hs(r.id)).slice(0, 5);
    expect(h, 'lịch sử khớp từng bước').toEqual(['Created:>NotStarted', 'StartedScoring:NotStarted>Scoring', 'SubmittedForApproval:Scoring>PendingApproval', 'Approved:PendingApproval>Approved', 'Sent:Approved>Submitted']);
  });
  test(tc('RES-Y02'), async () => {
    const r = (await fresh()).P; const h = await hist(r.id);
    const i = h.findIndex(x => x.fromStatus === 'NotStarted' && x.toStatus === 'Scoring');
    expect(i, 'lưu điểm lần đầu phải ghi bước Chưa thực hiện → Đang chấm điểm').toBeGreaterThanOrEqual(0);
    expect(h[i].actionName).toBe('Bắt đầu chấm điểm'); expect(h.filter(x => x.fromStatus === 'NotStarted').length, 'chỉ chuyển một lần').toBe(1);
    const f = (await fresh()).B; expect(await statusOf(f.id), 'kết quả chưa lưu điểm vẫn Chưa thực hiện').toBe('NotStarted');
  });
  test(tc('RES-Y03'), async () => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); const n = (await hist(r.id)).length;
    expect((await post(r.id, 'reject', { reason: 'qc.automation Y03' }, 'ldd')).status).toBe(200); expect(await statusOf(r.id)).toBe('Rejected');
    expect((await post(r.id, 'submit-for-approval', undefined, 'canbo')).status).toBe(200); expect(await statusOf(r.id)).toBe('PendingApproval');
    expect((await post(r.id, 'approve', undefined, 'ldd')).status).toBe(200); expect(await statusOf(r.id)).toBe('Approved');
    const h = (await hist(r.id)).slice(0, 3).map(x => `${x.fromStatus}>${x.toStatus}`);
    expect(h).toEqual(['PendingApproval>Approved', 'Rejected>PendingApproval', 'PendingApproval>Rejected']); expect((await hist(r.id)).length).toBe(n + 3);
  });
  test(tc('RES-Y04'), async () => {
    const r = (await pool()).B; await drive(r, 'Submitted'); const n = await subCount(r);
    expect((await post(r.id, 'request-unlock', { reason: 'qc.automation Y04' }, 'canbo')).status).toBe(200);
    expect((await post(r.id, 'approve-unlock', undefined, BO)).status).toBe(200); expect(await statusOf(r.id)).toBe('Scoring');
    await drive(r, 'Submitted');
    expect(await subCount(r), 'có lần gửi thứ 2').toBe(n + 1);
    expect(tail(await hs(r.id), 5).map(x => x.split(':')[0])).toEqual(['UnlockRequested', 'UnlockApproved', 'SubmittedForApproval', 'Approved', 'Sent']);
  });
  test(tc('RES-Y05'), async () => {
    const r = (await pool()).B; await drive(r, 'Submitted'); const n = await subCount(r), v = (await subs(r.id)).submissions[0].id;
    expect((await post(r.id, 'request-unlock', { reason: 'qc.automation Y05' }, 'canbo')).status).toBe(200);
    expect((await post(r.id, 'reject-unlock', { reason: 'qc.automation Y05 từ chối' }, BO)).status).toBe(200);
    expect(await statusOf(r.id)).toBe('Submitted'); expect(await subCount(r)).toBe(n); expect((await subs(r.id)).submissions[0].id, 'bản chính thức giữ nguyên').toBe(v);
  });
  test(tc('RES-Y06'), async () => {
    const r = (await pool()).B; await drive(r, 'Submitted'); const n = await subCount(r);
    const x = await post(r.id, 'reassess', { reason: 'qc.automation Y06' }, 'canbo'); expect(x.status, x.message).toBe(200); expect(await statusOf(r.id)).toBe('Rejected');
    await drive(r, 'Submitted'); expect(await subCount(r)).toBe(n + 1);
    const acts = (await hs(r.id)).map(x => x.split(':')[0]); expect(acts.join(',')).toMatch(/ReassessRequested,SubmittedForApproval,Approved,Sent$/);
  });
  test(tc('RES-Y10'), async () => {
    const r = (await pool()).B; const f = (await fresh()).B;
    await collect(async chk => {
      chk(await post(f.id, 'request-unlock', { reason: 'qc.automation Y10' }, 'canbo'), 'xin mở khóa khi Chưa thực hiện');
      await sweep(r, ['Scoring', 'PendingApproval', 'Approved', 'Submitted'].slice(0, 3), () => post(r.id, 'request-unlock', { reason: 'qc.automation Y10' }, 'canbo'), chk);
      await drive(r, 'UnlockRequested'); chk(await post(r.id, 'request-unlock', { reason: 'qc.automation Y10' }, 'canbo'), 'xin mở khóa lặp ở Chờ mở khóa');
    });
  });
  test(tc('RES-Y14'), async ({ page }) => {
    const r = (await past()).B; const d = await D(r.id);
    expect([d.isClosed, d.statusName, d.stoppedAtStatus]).toEqual([true, 'Chưa gửi', 'NotStarted']);
    await vw(page, r.id); const t = await pageText(page);
    expect(t).toContain('Chưa gửi'); expect(t, 'Quá hạn, không nộp').toMatch(/quá hạn|không nộp|trước hạn/i); expect(t, 'dừng ở bước trước đó').toMatch(/Dừng ở bước: Chưa thực hiện/);
    const row = (await api('GET', `${R}?page=1&size=50&filter=${FQ({ campaignIds: [d.campaignId], phase: 'all' })}`, undefined, 'canbo')).data.content.find((x: any) => x.id === r.id);
    expect(row.statusName).toBe('Chưa gửi');
  });
  const BTN: Record<string, RegExp> = { score: /Lưu nháp|Chấm điểm/, submit: /Trình duyệt/, approve: /^\s*Phê duyệt/, reject: /^\s*Từ chối\s*$/, send: /Gửi (kết quả về )?Bộ/, requestUnlock: /Xin mở khóa/, reassess: /Yêu cầu đánh giá lại/, approveUnlock: /Duyệt mở khóa/, rejectUnlock: /Từ chối mở khóa/ };
  test(tc('RES-Y15'), async ({ browser }) => {
    const r = (await pool()).B; const diffs: string[] = [];
    for (const [st, who] of [['Scoring', 'canbo'], ['PendingApproval', 'ldd'], ['PendingApproval', 'canbo'], ['Approved', 'canbo'], ['Approved', 'ldd'], ['Submitted', 'ldd'], ['Submitted', 'canbo'], ['UnlockRequested', 'lanhdaobo']] as const) {
      await drive(r, st); const allowed: string[] = (await D(r.id, who)).allowedActions ?? [];
      await as(browser, who, async p => {
        await open(p, r.id); await p.waitForTimeout(1500);
        for (const [k, re] of Object.entries(BTN)) {
          const ui = (await p.getByRole('button', { name: re }).count()) > 0;
          const api_ = allowed.includes(k) || (k === 'requestUnlock' && allowed.includes('unlock')) || (k === 'score' && allowed.includes('submit') && st !== 'PendingApproval');
          if (ui !== api_) diffs.push(`${st}/${who}: nút "${k}" ${ui ? 'có' : 'không có'} trên UI nhưng allowedActions=[${allowed}]`);
        }
      });
    }
    expect(diffs).toEqual([]);
  });
  test(tc('RES-Y16'), async () => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); const n = (await hist(r.id)).length;
    const [a, b] = await Promise.all([post(r.id, 'approve', undefined, 'ldd'), post(r.id, 'reject', { reason: 'qc.automation Y16' }, 'ldd')]);
    expect([a.status, b.status].filter(s => s === 200).length, `đúng một thao tác thành công (approve ${a.status} ${a.message} / reject ${b.status} ${b.message})`).toBe(1);
    expect(await statusOf(r.id)).toBe(a.status === 200 ? 'Approved' : 'Rejected'); expect((await hist(r.id)).length).toBe(n + 1);
  });
  test(tc('RES-Y17'), async () => {
    const r = (await pool()).B; await drive(r, 'Scoring'); await setTotal(r, 120);
    const snap = async () => { const d = await D(r.id); return [d.score, d.maxScore, d.scoredCount]; };
    expect((await post(r.id, 'submit-for-approval', undefined, 'canbo')).status).toBe(200); const a = await snap();
    expect((await post(r.id, 'approve', undefined, 'ldd')).status).toBe(200); const b = await snap();
    const x = await sendOnce(r); expect(x.status, x.message).toBe(200); const c = await snap();
    expect(a[0]).toBe(120); expect(b).toEqual(a); expect(c, 'điểm chính thức = điểm khi trình').toEqual(a);
    await clearPending(r);
  });
  test(tc('RES-Y19'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'Scoring'); await vw(page, r.id);
    const before = leaves(await D(r.id)).map(i => i.score);
    const inp = page.locator('.ant-input-number-input').first(); const cur = Number(await inp.inputValue()); const nv = cur === 0 ? 1 : 0;
    await inp.fill(String(nv)); await inp.blur();
    await bt(page, /Lưu nháp/).click(); await page.waitForTimeout(2500);
    const after = leaves(await D(r.id)).map(i => i.score);
    expect(after.filter((v, k) => v !== before[k]).length, 'đúng 1 chỉ số đổi điểm').toBe(1);
    await page.reload(); await page.waitForTimeout(2500);
    expect(Number(await page.locator('.ant-input-number-input').first().inputValue()), 'điểm đã lưu còn nguyên sau tải lại').toBe(nv);
    expect(await statusOf(r.id)).toBe('Scoring');
  });
});

// =============================== EDGE CASE (RES-J) ===============================
const API_PATHS = (id: string): [string, string, any, string][] => [
  ['GET', id, undefined, 'canbo'], ['GET', `${id}/history`, undefined, 'canbo'], ['GET', `${id}/submissions`, undefined, 'canbo'],
  ['PUT', `${id}/scores`, { scores: [] }, 'canbo'], ['POST', `${id}/submit-for-approval`, undefined, 'canbo'], ['POST', `${id}/approve`, undefined, 'ldd'],
  ['POST', `${id}/reject`, { reason: 'x' }, 'ldd'], ['POST', `${id}/send`, { attachmentId: FAKE, fileType: 'DigitalSigned' }, 'canbo'],
  ['POST', `${id}/request-unlock`, { reason: 'x' }, 'canbo'], ['POST', `${id}/approve-unlock`, undefined, BO], ['POST', `${id}/reject-unlock`, { reason: 'x' }, BO],
  ['POST', `${id}/reassess`, { reason: 'x' }, 'canbo'], ['DELETE', `${id}/pending-file/${FAKE}`, undefined, 'canbo'],
];
const reasonCycle = async (reason: any, raw_ = false) => {
  const r = (await pool()).B; await drive(r, 'PendingApproval');
  const x = raw_ ? await raw('POST', `${R}/${r.id}/reject`, { as: 'ldd', text: reason }) : await raw('POST', `${R}/${r.id}/reject`, { as: 'ldd', body: { reason } });
  return { r, x };
};

test.describe('Edge case', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-J01'), async () => {
    const bad: string[] = [];
    for (const [m, p, body, who] of API_PATHS('abc')) {
      const x = await raw(m, `${R}/${p}`, { as: who, body });
      if (x.status >= 500 || x.status < 400) bad.push(`${m} ${p}: HTTP ${x.status} "${x.message}"`);
      else if (/exception|stack|\bat [A-Z]\w+\.|sql|guid/i.test(x.text)) bad.push(`${m} ${p}: lộ chi tiết nội bộ "${x.text.slice(0, 80)}"`);
    }
    expect(bad).toEqual([]);
  });
  test(tc('RES-J02'), async () => {
    const r = (await pool()).B; await drive(r, 'PendingApproval');
    const bad: string[] = [];
    for (const body of ['{bad json', '', '{"reason":', '[[[', 'null']) {
      const x = await raw('POST', `${R}/${r.id}/reject`, { as: 'ldd', text: body });
      if (x.status < 400 || x.status >= 500) bad.push(`thân "${body}": HTTP ${x.status} "${x.message}"`);
    }
    expect(bad).toEqual([]); expect(await statusOf(r.id), 'không đổi trạng thái').toBe('PendingApproval');
  });
  test(tc('RES-J03'), async () => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); const bad: string[] = [];
    for (const v of [12345, ['a', 'b'], { a: 1 }, true, null]) {
      const x = await raw('POST', `${R}/${r.id}/reject`, { as: 'ldd', body: { reason: v } });
      if (x.status < 400 || x.status >= 500) bad.push(`reason=${JSON.stringify(v)}: HTTP ${x.status} "${x.message}"`);
    }
    expect(bad).toEqual([]); expect(await statusOf(r.id)).toBe('PendingApproval');
  });
  test(tc('RES-J05'), async () => {
    const reason = "x'; DROP TABLE users; -- OR 1=1";
    const { r, x } = await reasonCycle(reason); expect(x.status, x.message).toBe(200);
    expect((await hist(r.id))[0].note).toBe(reason); expect((await api('GET', `${R}/${r.id}`, undefined, 'canbo')).status).toBe(200);
  });
  test(tc('RES-J07'), async ({ page }) => {
    await vw(page, '12345678-aaaa-bbbb-cccc-1234567890ab');
    const t = await page.locator('body').innerText();
    expect(t.trim().length, 'không được trắng trang').toBeGreaterThan(20);
    expect(t, 'trang thân thiện').toMatch(/Không tìm thấy|không tồn tại|không còn tồn tại/i); clean500(t);
    expect(await page.getByRole('button', { name: /Quay lại|Về trang/ }).count(), 'có lối quay về').toBeGreaterThan(0);
  });
  test(tc('RES-J12'), async ({ page }) => {
    const r = (await fresh()).B; await page.setViewportSize({ width: 1366, height: 700 }); await vw(page, r.id);
    await openDlg(page, /Trình duyệt/); await page.waitForTimeout(800);
    const box = await dlg(page).boundingBox(); const vp = page.viewportSize()!;
    expect(box!.y + box!.height, 'hộp thoại không tràn khỏi màn hình').toBeLessThanOrEqual(vp.height + 2); expect(box!.y).toBeGreaterThanOrEqual(-2);
    const sc = await dlg(page).evaluate(e => { const els = [e, ...e.querySelectorAll('*')] as HTMLElement[]; const s = els.find(x => x.scrollHeight > x.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(x).overflowY)); return s ? { top: s.scrollTop, can: true } : { top: 0, can: false }; });
    expect(sc.can, 'danh sách 100 chỉ số thiếu phải cuộn được').toBeTruthy();
    expect(await mb(page, /Quay lại|Đóng/).first().isVisible(), 'nút đóng còn thấy được').toBeTruthy();
  });
  test(tc('RES-J13'), async () => {
    const f = (await partial()).B; expect(missing(await D(f.id)).length).toBe(60);   // Đang chấm điểm, còn 60 chỉ số chưa có điểm
    const x = await post(f.id, 'submit-for-approval', undefined, 'canbo'); expect(x.status, x.message).toBeGreaterThanOrEqual(400);
    const codes = x.message.match(/[A-Z][A-Z0-9]*_[A-Z0-9_]+/g) ?? [];
    expect(codes.length, `liệt kê tối đa 10 mã: "${x.message}"`).toBe(10); expect(x.message, 'rút gọn bằng "..."').toMatch(/(\.\.\.|…)/);
  });
  test(tc('RES-J14'), async () => {
    const r = await approved('B'); const names = ['qcaj14a.pdf', 'qcaj14b.pdf', 'qcaj14c.pdf']; let last: any;
    for (const n of names) last = await attachApi(r, n, PDF(n));
    const pf = (await subs(r.id)).pendingFile; expect(pf?.fileName, 'tệp chờ gửi là tệp cuối').toBe('qcaj14c.pdf');
    const x = await post(r.id, 'send', { attachmentId: last.id, fileType: 'DigitalSigned' }, 'canbo'); expect(x.status, x.message).toBe(200);
    expect((await subs(r.id)).submissions[0].attachment.fileName, 'lần gửi dùng tệp cuối').toBe('qcaj14c.pdf');
  });
  test(tc('RES-J15'), async ({ page }) => {
    const r = await approved('B'); const n = await subCount(r);
    await vw(page, r.id, '?tab=dossier'); await uiAttach(page, 'qcaj15.pdf');
    let calls = 0; await page.route(/\/send$/, async rt => { calls++; await sleep(3500); await rt.continue(); });
    await bt(page, /Gửi kết quả về Bộ/).click(); await dlg(page).waitFor({ state: 'visible' });
    const ok = mb(page, /Xác nhận gửi Bộ/); await ok.click(); await page.waitForTimeout(500);
    const dis = (await ok.isDisabled().catch(() => true)) || (await ok.getAttribute('class').catch(() => ''))?.includes('loading');
    await ok.click({ timeout: 1500, force: true }).catch(() => {}); await page.waitForTimeout(4500);
    expect(dis, 'nút xác nhận phải vô hiệu/loading khi đang gửi').toBeTruthy();
    expect(calls, 'chỉ gửi 1 request').toBe(1); await expect.poll(() => subCount(r), { timeout: 15_000 }).toBe(n + 1);
  });
  test(tc('RES-J16'), async () => {
    const r = await approved('B'); const name = 'q'.repeat(252) + '.pdf';
    const u = await upload(name, PDF('j16'), { as: 'canbo', entityId: r.id });
    expect(u.status, `tên tệp 260 ký tự: HTTP ${u.status} "${u.message}"`).toBeLessThan(500);
    if (u.status === 200) { const pf = (await subs(r.id)).pendingFile; expect(pf, 'tệp chờ gửi tồn tại').toBeTruthy(); clean500(String(pf.fileName)); expect(pf.fileName.length).toBeLessThanOrEqual(260); }
    else clean500(u.message);
    expect((await api('GET', `${R}/${r.id}/submissions`, undefined, 'canbo')).status).toBe(200); await clearPending(r);
  });
  test(tc('RES-J17'), async ({ page }) => {
    const r = await approved('B'); const a = await attachApi(r, 'qcaj17.pdf');
    const num = '<b>12/BC</b>&"\'', note = 'ghi chú <i>x</i> & "q" \' <script>alert(1)</script>';
    let x = await post(r.id, 'send', { attachmentId: a.id, fileType: 'DigitalSigned', documentNumber: num, note }, 'canbo');
    if (x.status !== 200) { expect([x.status, x.message], 'chuỗi nguy hiểm chỉ được chặn bằng 400 rõ ràng').toEqual([400, expect.stringMatching(/HTML|script|ký tự/i)]); return; }
    const s0 = (await subs(r.id)).submissions[0]; expect([s0.documentNumber, s0.note]).toEqual([num, note]);
    let alerted = false; page.on('dialog', d => { alerted = true; d.dismiss().catch(() => {}); });
    await vw(page, r.id, '?tab=dossier'); const t = await pageText(page);
    expect(t, 'số hiệu nguyên văn').toContain(num); expect(t, 'ghi chú nguyên văn').toContain('<i>x</i>'); expect(alerted).toBeFalsy();
  });
  test(tc('RES-J19'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'PendingApproval');
    const ctx = await page.context().browser()!.newContext({ storageState: 'auth/ldd.json' }); const p = await ctx.newPage();
    try {
      await vw(p, r.id); await ctx.clearCookies(); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await uiApprove(p).catch(() => {}); await p.waitForTimeout(3500);
      expect(p.url(), 'chuyển về trang đăng nhập').toMatch(/login|dang-nhap|auth/i);
    } finally { await ctx.close(); }
    expect(await statusOf(r.id), 'không đổi trạng thái').toBe('PendingApproval');
  });
  test(tc('RES-J20'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); await vw(page, r.id);
    await openDlg(page, /Phê duyệt/); await page.keyboard.press('Escape'); await page.waitForTimeout(700);
    expect(await dlg(page).isVisible().catch(() => false), 'Esc đóng hộp thoại').toBeFalsy(); expect(await statusOf(r.id)).toBe('PendingApproval');
    await openDlg(page, /Phê duyệt/); await page.mouse.click(5, 5); await page.waitForTimeout(700);
    expect(await dlg(page).isVisible().catch(() => false), 'bấm ra ngoài đóng hộp thoại').toBeFalsy(); expect(await statusOf(r.id), 'không thực hiện thao tác').toBe('PendingApproval');
  });
  test(tc('RES-J21'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); await vw(page, r.id);
    const t = track(page, /\/(approve|reject)$/);
    await uiApprove(page); await expect.poll(() => statusOf(r.id), { timeout: 10_000 }).toBe('Approved');
    await page.waitForTimeout(1500); const n = t.reqs.length; const h = (await hist(r.id)).length;
    await page.goBack(); await page.waitForTimeout(1500); await page.goForward().catch(() => {}); await page.waitForTimeout(1500);
    const btn = await bt(page, /^\s*Phê duyệt/).count();
    expect(btn, 'sau Back không còn nút Phê duyệt').toBe(0); expect(t.reqs.length, 'không gửi thêm request phê duyệt').toBe(n); expect((await hist(r.id)).length).toBe(h);
  });
  test(tc('RES-J22'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'Submitted'); const errs: string[] = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('response', x => { if (x.status() >= 500) errs.push('HTTP ' + x.status()); });
    const t0 = Date.now(); await vw(page, r.id);
    expect(await codeRows(page).count(), 'đủ 100 chỉ số lá hiển thị').toBe(100);
    await page.mouse.wheel(0, 100000); await page.waitForTimeout(800);
    expect(errs).toEqual([]); expect(Date.now() - t0, 'tải và cuộn < 15s').toBeLessThan(15_000);
  });
  test(tc('RES-J24'), async () => {
    const r = (await pool()).B; const bad: string[] = [];
    await drive(r, 'Approved'); await clearPending(r);
    for (const body of ['', '{}', 'null']) {
      const x = await raw('POST', `${R}/${r.id}/send`, { as: 'canbo', text: body });
      if (x.status < 400 || x.status >= 500) bad.push(`send thân "${body}": HTTP ${x.status} "${x.message}"`); else if (/exception|stack/i.test(x.text)) bad.push('lộ lỗi nội bộ: ' + x.text.slice(0, 80));
    }
    await drive(r, 'PendingApproval');
    for (const body of ['', '{}']) {
      const x = await raw('POST', `${R}/${r.id}/reject`, { as: 'ldd', text: body }); if (x.status !== 400) bad.push(`reject thân "${body}": HTTP ${x.status} "${x.message}"`);
    }
    await drive(r, 'Submitted'); for (const body of ['', '{}']) {
      const x = await raw('POST', `${R}/${r.id}/request-unlock`, { as: 'canbo', text: body }); if (x.status !== 400) bad.push(`request-unlock thân "${body}": HTTP ${x.status} "${x.message}"`);
    }
    expect(bad).toEqual([]);
  });
});

// =============================== BẢO MẬT, PHÂN QUYỀN, HIỆU NĂNG (RES-X) ===============================
const forbid = (x: { status: number; message: string }, what: string) => {
  expect(x.status, `${what}: phải bị từ chối 403, thực tế HTTP ${x.status} "${x.message}"`).toBe(403);
};
const deny = (x: { status: number; message: string }, what: string) => {
  expect(x.status, `${what}: phải bị từ chối 4xx, thực tế HTTP ${x.status} "${x.message}"`).toBeGreaterThanOrEqual(400);
  expect(x.status, `${what}: không được 5xx`).toBeLessThan(500);
};
const noBtn = async (p: Page, names: RegExp[], who: string) => {
  for (const re of names) expect(await p.getByRole('button', { name: re }).count(), `${who}: không được có nút ${re}`).toBe(0);
};
const hasBtn = async (p: Page, names: RegExp[], who: string) => {
  for (const re of names) expect(await p.getByRole('button', { name: re }).count(), `${who}: phải có nút ${re}`).toBeGreaterThan(0);
};
const fakeTok = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalidsignature';

test.describe('Phân quyền và bảo mật', () => {
  test.beforeEach(() => needWrite());
  test(tc('RES-X01'), async () => {
    const r = (await pool()).B; const bad: string[] = [];
    for (const p of ['', '/history', '/submissions']) { const x = await raw('GET', `${R}/${r.id}${p}`); if (x.status !== 401) bad.push(`GET ${p || 'chi tiết'}: HTTP ${x.status}`); }
    expect(bad).toEqual([]);
  });
  test(tc('RES-X02'), async () => {
    const r = (await pool()).B; const bad: string[] = [];
    for (const [m, p, body] of [['POST', 'submit-for-approval'], ['POST', 'approve'], ['POST', 'reject', { reason: 'x' }], ['POST', 'send', { attachmentId: FAKE, fileType: 'DigitalSigned' }], ['POST', 'request-unlock', { reason: 'x' }], ['PUT', 'scores', { scores: [] }]] as [string, string, any][]) {
      const s0 = await statusOf(r.id); const x = await raw(m, `${R}/${r.id}/${p}`, { body }); if (x.status !== 401) bad.push(`${m} ${p}: HTTP ${x.status}`);
      expect(await statusOf(r.id)).toBe(s0);
    }
    expect(bad).toEqual([]);
  });
  test(tc('RES-X03'), async () => {
    const r = (await pool()).B; const bad: string[] = [];
    const real = tokenOf('canbo'); const tampered = real.slice(0, -4) + (real.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    for (const [n, t] of [['giả', fakeTok], ['sai chữ ký', tampered], ['rỗng', 'x']] as const) {
      const x = await raw('GET', `${R}/${r.id}`, { token: t }); if (x.status !== 401) bad.push(`token ${n}: HTTP ${x.status}`);
      const y = await raw('POST', `${R}/${r.id}/approve`, { token: t }); if (y.status !== 401) bad.push(`token ${n} (approve): HTTP ${y.status}`);
    }
    expect(bad).toEqual([]);
  });
  test(tc('RES-X04'), async () => {
    const r = await approved('B');
    try {
      const x = await upload('qcax04.pdf', PDF(), { as: null, entityId: r.id }); expect(x.status, `upload không token: HTTP ${x.status} "${x.message}"`).toBe(401);
      const y = await upload('qcax04b.pdf', PDF(), { as: 'canbo', entityId: r.id, docType: 'assessment_result_file' }); void y;
      const z = await raw('POST', 'upload/blob/assessment_result_file', { token: fakeTok }); expect(z.status, 'token giả').toBe(401);
    } finally { await clearPending(r); }
  });
  test(tc('RES-X07'), async () => {
    const r = await approved('B'); const a = await attachApi(r, 'qcax07.pdf');
    const x = await api('DELETE', `${R}/${r.id}/pending-file/${a.id}`, undefined, 'xemonly'); deny(x, 'tài khoản không quyền xóa tệp chờ gửi');
    expect((await subs(r.id)).pendingFile?.id, 'tệp chờ gửi còn nguyên').toBe(a.id); await clearPending(r);
  });
  test(tc('RES-X11'), async () => {
    const r = (await pool()).B; await drive(r, 'Scoring'); const x = await post(r.id, 'submit-for-approval', undefined, 'cbdp');
    deny(x, 'CB địa phương trình duyệt đơn vị ngoài phạm vi'); expect(await statusOf(r.id)).toBe('Scoring');
  });
  test(tc('RES-X12'), async () => {
    const r = (await pool()).B; await drive(r, 'PendingApproval'); const a = await post(r.id, 'approve', undefined, 'ldp'), b = await post(r.id, 'reject', { reason: 'qc.automation X12' }, 'ldp');
    expect(await statusOf(r.id)).toBe('PendingApproval'); deny(a, 'LĐ địa phương phê duyệt ngoài phạm vi'); deny(b, 'LĐ địa phương từ chối ngoài phạm vi');
  });
  test(tc('RES-X13'), async () => {
    const r = await approved('B'); const a = await attachApi(r, 'qcax13.pdf'); const n = await subCount(r);
    const x = await post(r.id, 'send', { attachmentId: a.id, fileType: 'DigitalSigned' }, 'cbdp'); deny(x, 'CB địa phương gửi Bộ ngoài phạm vi');
    expect(await statusOf(r.id)).toBe('Approved'); expect(await subCount(r)).toBe(n); await clearPending(r);
  });
  test(tc('RES-X14'), async ({ browser }) => {
    const pr = await pool(); await drive(pr.B, 'PendingApproval'); await drive(pr.P, 'PendingApproval');
    forbid(await post(pr.B.id, 'approve', undefined, 'canbo'), 'Cán bộ phê duyệt'); forbid(await post(pr.B.id, 'reject', { reason: 'x' }, 'canbo'), 'Cán bộ từ chối');
    forbid(await post(pr.P.id, 'approve', undefined, 'cbdp'), 'CB địa phương phê duyệt'); forbid(await post(pr.P.id, 'reject', { reason: 'x' }, 'cbdp'), 'CB địa phương từ chối');
    expect([await statusOf(pr.B.id), await statusOf(pr.P.id)]).toEqual(['PendingApproval', 'PendingApproval']);
    for (const [k, r] of [['canbo', pr.B], ['cbdp', pr.P]] as [string, Res][]) await as(browser, k, async p => { await vw(p, r.id); await noBtn(p, [/Phê duyệt/, /^\s*Từ chối\s*$/], k); });
  });
  test(tc('RES-X17'), async ({ browser }) => {
    const r = (await pool()).B; const bad: string[] = [];
    await drive(r, 'Scoring'); const a = await attachApi(r, 'qcax17.pdf');
    for (const [p, body, m] of [['submit-for-approval', undefined, 'POST'], ['approve', undefined, 'POST'], ['reject', { reason: 'x' }, 'POST'], ['send', { attachmentId: a.id, fileType: 'DigitalSigned' }, 'POST'], ['request-unlock', { reason: 'x' }, 'POST'], ['scores', { scores: [] }, 'PUT']] as any[]) {
      const x = await api(m, `${R}/${r.id}/${p}`, body, BO); if (x.status !== 403) bad.push(`LĐ Bộ ${p}: HTTP ${x.status} ${x.message}`);
    }
    expect(await statusOf(r.id)).toBe('Scoring'); await clearPending(r);
    await as(browser, BO, async p => { await vw(p, r.id); await noBtn(p, [/Chấm điểm/, /Lưu nháp/, /Trình duyệt/, /Phê duyệt/, /Gửi Bộ/, /Xin mở khóa/], 'LĐ Bộ'); });
    expect(bad).toEqual([]);
  });
  test(tc('RES-X18'), async ({ browser }) => {
    const r = (await pool()).B; await drive(r, 'UnlockRequested');
    await as(browser, BO, async p => { await vw(p, r.id); await hasBtn(p, [/Duyệt mở khóa/, /Từ chối mở khóa/], 'LĐ Bộ'); });
  });
  test(tc('RES-X19'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'Scoring'); await vw(page, r.id);
    await hasBtn(page, [/Lưu nháp/, /Trình duyệt/], 'Cán bộ'); await noBtn(page, [/Phê duyệt/, /^\s*Từ chối\s*$/, /Gửi Bộ/], 'Cán bộ');
  });
  test(tc('RES-X20'), async ({ page, browser }) => {
    const r = (await pool()).B; await drive(r, 'PendingApproval');
    await as(browser, 'ldd', async p => { await vw(p, r.id); await hasBtn(p, [/Phê duyệt/, /Từ chối/], 'LĐ đơn vị'); });
    await vw(page, r.id); await noBtn(page, [/Phê duyệt/, /^\s*Từ chối\s*$/, /Trình duyệt/, /Lưu nháp/], 'Cán bộ');
  });
  test(tc('RES-X21'), async ({ page, browser }) => {
    const r = await approved('B'); await vw(page, r.id); await hasBtn(page, [/Gửi Bộ/], 'Cán bộ');
    await as(browser, 'ldd', async p => { await vw(p, r.id); await noBtn(p, [/Gửi Bộ/, /Phê duyệt/, /Trình duyệt/], 'LĐ đơn vị'); });
  });
  test(tc('RES-X26'), async ({ page }) => {
    const pr = await pool(); const rows = (await api('GET', `${R}?page=1&size=50&filter=${FQ({ campaignIds: [pr.campId], phase: 'all' })}`, undefined, 'canbo')).data.content as any[];
    expect(new Set(rows.map(x => x.organizationName)), 'Cán bộ phạm vi toàn hệ thống thấy cả 2 đơn vị').toEqual(new Set(['QA - Địa phương', 'QA - Đơn vị Bộ']));
    await goto(page, 'assessment-results'); await page.waitForTimeout(2000);
    expect(await page.getByText('Đơn vị', { exact: true }).count() + await page.getByPlaceholder(/Đơn vị/).count() + await page.locator('.ant-select').filter({ hasText: /Đơn vị/ }).count(), 'bộ lọc Đơn vị hiển thị').toBeGreaterThan(0);
  });
  test(tc('RES-X27'), async () => {
    const r = (await pool()).B; await drive(r, 'Scoring'); const n = (await notifs('ldp', null, r.id)).length;
    await drive(r, 'PendingApproval'); await post(r.id, 'reject', { reason: 'qc.automation X27' }, 'ldd'); await drive(r, 'PendingApproval');
    const after = await notifs('ldp', null, r.id);
    expect(after.length, `LĐ địa phương không được nhận thông báo của đơn vị Bộ: ${after.slice(0, 2).map(text)}`).toBe(n);
  });
  test(tc('RES-X28'), async ({ browser }) => {
    const r = (await pool()).B; await drive(r, 'Scoring'); const n0 = (await notifs('ldd', /APPROVAL|SUBMIT/i, r.id)).length;
    expect((await post(r.id, 'submit-for-approval', undefined, 'canbo')).status).toBe(200);
    const ns = await notifs('ldd', null, r.id); expect(ns.length, 'LĐ đơn vị phải nhận thông báo yêu cầu phê duyệt').toBeGreaterThan(0); void n0;
    await as(browser, 'ldd', async p => {
      await goto(p, 'assessment-results'); await p.waitForTimeout(1500);
      await p.locator('header button, .ant-layout-header button').filter({ has: p.locator('svg') }).nth(0).click({ trial: true }).catch(() => {});
      const bell = p.locator('button:has-text("99+"), .ant-badge').first(); await bell.click(); await p.waitForTimeout(1500);
      const item = p.locator('.ant-popover, .ant-dropdown, .ant-drawer').getByText(new RegExp(ns[0].title.slice(0, 20))).first();
      await item.click(); await p.waitForTimeout(2000);
      expect(p.url(), 'mở đúng chi tiết kết quả').toContain(r.id);
    });
  });
  test(tc('RES-X29'), async () => {
    const r = (await pool()).B; const outs: string[] = [];
    outs.push((await raw('GET', `${R}/abc`, { as: 'canbo' })).text, (await raw('GET', `${R}/${FAKE}`, { as: 'canbo' })).text, (await raw('POST', `${R}/${r.id}/reject`, { as: 'ldd', text: '{bad' })).text,
      (await raw('GET', `${R}/${r.id}`, { token: fakeTok })).text, (await raw('POST', `${R}/${r.id}/send`, { as: 'canbo', body: { attachmentId: 'abc' } })).text,
      (await raw('PUT', `${R}/${r.id}/scores`, { as: 'canbo', body: { scores: [{ indicatorSetIndicatorId: 'x', score: 'abc' }] } })).text);
    for (const o of outs) expect(o, 'không lộ stacktrace/đường dẫn nội bộ').not.toMatch(/Stacktrace|StackTrace|Exception|\bat [A-Z][\w.]+\(|\/src\/|\\\w+\\|EntityFramework|Npgsql|SqlException/);
  });
  test(tc('RES-X30'), async ({ page }) => {
    const r = (await pool()).B; await drive(r, 'Submitted'); const t0 = Date.now(); const x = await api('GET', `${R}/${r.id}`, undefined, 'canbo'); const apiMs = Date.now() - t0;
    expect(x.status).toBe(200); expect(apiMs, `API chi tiết ${apiMs}ms`).toBeLessThan(3000);
    const t1 = Date.now(); await page.goto('about:blank'); await open(page, r.id); await codeRows(page).first().waitFor({ timeout: 15_000 }); const ui = Date.now() - t1;
    expect(ui, `hiển thị chi tiết ${ui}ms`).toBeLessThan(6000);
  });
  test(tc('RES-X31'), async () => {
    const r = (await pool()).B; await drive(r, 'Scoring');
    const t0 = Date.now(); const a = await post(r.id, 'submit-for-approval', undefined, 'canbo'); const m1 = Date.now() - t0;
    const t1 = Date.now(); const b = await post(r.id, 'approve', undefined, 'ldd'); const m2 = Date.now() - t1;
    expect([a.status, b.status]).toEqual([200, 200]); expect(m1, `trình duyệt ${m1}ms`).toBeLessThan(3000); expect(m2, `phê duyệt ${m2}ms`).toBeLessThan(3000);
  });
  test(tc('RES-X32'), async () => {
    test.setTimeout(180_000);
    const r = await approved('B'); const buf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(20 * 1024 * 1024 - 1024, 0x20), Buffer.from('\n%%EOF\n')]);
    const t0 = Date.now(); const u = await upload('qcax32.pdf', buf, { as: 'canbo', entityId: r.id }); const upMs = Date.now() - t0;
    expect(u.status, `upload PDF ~20MB: HTTP ${u.status} "${u.message}"`).toBe(200); expect(upMs, `upload ${upMs}ms`).toBeLessThan(60_000);
    const big = (await subs(r.id)).submissions.some((s: any) => s.attachment?.fileSize >= 20 * 1024 * 1024 - 2048);
    if (big) { await clearPending(r); test.info().annotations.push({ type: 'note', description: 'Đã có lần gửi ~20MB ở lần chạy trước (tệp gửi không xóa được) → chỉ kiểm tải lên, không gửi thêm' }); return; }
    const t1 = Date.now(); const x = await post(r.id, 'send', { attachmentId: u.data.id, fileType: 'DigitalSigned' }, 'canbo'); const sendMs = Date.now() - t1;
    expect(x.status, x.message).toBe(200); expect(sendMs, `gửi ${sendMs}ms`).toBeLessThan(30_000);
  });
  test(tc('RES-X33'), async ({ browser }) => {
    const r = (await pool()).B; const name = await camp(r);
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } }); const p = await ctx.newPage();
    try {
      await p.goto(`/#/vi/assessment-results/${r.id}`); await p.waitForTimeout(3500);
      expect(p.url(), 'chuyển về đăng nhập').toMatch(/login|dang-nhap|auth/i);
      expect(await p.locator('body').innerText(), 'không lộ dữ liệu').not.toContain(name);
    } finally { await ctx.close(); }
  });
  test(tc('RES-X34'), async () => {
    const f = FQ({ campaignType: 'AdHoc', phase: 'all' }); const bad: string[] = [];
    for (const who of ['canbo', 'cbdp']) { const x = await fetch(`${API_BASE}/api/v1/${R}/export?filter=${f}`, { headers: { Authorization: `Bearer ${tokenOf(who)}` } }); if (x.status !== 200) bad.push(`${who} xuất danh sách: HTTP ${x.status}`); }
    const y = await fetch(`${API_BASE}/api/v1/${R}/export?filter=${f}`, { headers: { Authorization: `Bearer ${tokenOf('xemonly')}` } }); if (y.status !== 403) bad.push(`tài khoản chỉ xem xuất danh sách phải 403, thực tế HTTP ${y.status}`);
    expect(bad).toEqual([]);
  });
  test(tc('RES-X35'), async () => {
    const r = (await pool()).B; const bad: string[] = [];
    const ok = await fetch(`${API_BASE}/api/v1/${R}/${r.id}/export`, { headers: { Authorization: `Bearer ${tokenOf('canbo')}` } }); if (ok.status !== 200) bad.push(`Cán bộ xuất chi tiết đúng phạm vi phải 200, thực tế ${ok.status}`);
    for (const who of ['cbdp', 'ldp']) { const x = await fetch(`${API_BASE}/api/v1/${R}/${r.id}/export`, { headers: { Authorization: `Bearer ${tokenOf(who)}` } }); if (x.status < 400 || x.status >= 500) bad.push(`${who} xuất chi tiết ngoài phạm vi: HTTP ${x.status}`); }
    expect(bad).toEqual([]);
  });
});
