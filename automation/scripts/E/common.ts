// Dùng chung cho Phân hệ E (Khảo sát hài lòng). Dựng trên scripts/A/common.ts; tên test = "[ID] tiêu đề" từ catalog.json.
// Theo yêu cầu: các test cần đăng nhập chạy bằng tài khoản qa.superadmin@cds.local (auth/superadmin.json); test người dân (account=null) chạy ẩn danh.
import { test as base, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import { tc, dataRows, api } from '../A/common';
import { API_BASE } from '../api';
import { hidePwExpiry } from '../helpers';
export { tc, expect, dataRows, api, API_BASE };

type TC = { id: string; account?: string | null };
const CATALOG: TC[] = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8'));
const ACC = 'superadmin';
export const test = base.extend({
  page: async ({ browser, baseURL, context }, use, testInfo) => {
    const id = testInfo.title.match(/^\[([A-Z]{3}-[A-Z]\d+)\]/)?.[1];
    const x = CATALOG.find(c => c.id === id);
    if (!x || !x.account || !fs.existsSync(`auth/${ACC}.json`)) { await hidePwExpiry(context); await use(await context.newPage()); return; }
    const ctx = await browser.newContext({ storageState: `auth/${ACC}.json`, baseURL });
    await hidePwExpiry(ctx);
    await use(await ctx.newPage()); await ctx.close();
  },
});

export const LIST = '#/vi/survey-campaigns';
export const PUBLIC = '#/vi/survey-campaigns/respond';
export const F = (o: any) => encodeURIComponent(JSON.stringify(o));
export const FAKE = '00000000-0000-4000-8000-000000000000';

/** Gọi API không cần token (người dân) hoặc với token cho trước. */
export async function raw(method: string, resource: string, body?: any, token?: string) {
  const r = await fetch(`${API_BASE}/api/v1/${resource}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text(); let j: any = {}; try { j = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: r.status, message: String(j?.message ?? ''), data: j?.data, text };
}
export const surveys = async (filter: any = {}, as = 'superadmin', size = 100, page = 1) =>
  (await api('GET', `survey/surveys?page=${page}&size=${size}&filter=${F(filter)}`, undefined, as)).data ?? { content: [], totalElements: 0 };
export async function allSurveys(filter: any = {}, as = 'superadmin'): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 10; p++) { const d = await surveys(filter, as, 100, p); out.push(...(d.content ?? [])); if (p >= (d.totalPages ?? 1)) break; }
  return out;
}
export const publicList = async (page = 1, size = 10) => raw('GET', `public/surveys?page=${page}&size=${size}`);

// ---------- UI danh sách đợt ----------
export async function openList(page: Page) {
  await page.goto(`/${LIST}`); await page.waitForLoadState('networkidle').catch(() => {});
  await dataRows(page).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
}
export const settle = async (page: Page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(900); };
export const searchBox = (page: Page) => page.locator('[data-testid="search"], #search, input[placeholder*="Tìm"]').first();
export async function total(page: Page): Promise<number> {
  const pg = page.locator('.ant-pagination').first();
  const t = (await pg.count() ? await pg.locator('xpath=..').innerText() : '').replace(/\s+/g, ' ');
  const m = t.match(/\/\s*([\d.]+)\s*đợt/); return m ? Number(m[1].replace(/\./g, '')) : await dataRows(page).count();
}
export const rowTexts = async (page: Page) => (await dataRows(page).allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
export async function tab(page: Page, key: 'all' | 'Draft' | 'Submitted' | 'Rejected' | 'Approved' | 'Active' | 'Closed') {
  await page.locator(`[id$="-tab-${key}"]`).click(); await settle(page);
}
export async function pickSelect(page: Page, id: string, text: string) {
  await page.locator(`#${id}`).click();
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.locator('.ant-select-item-option', { hasText: text }).first().click(); await settle(page);
}
export async function search(page: Page, kw: string, enter = true) {
  const b = searchBox(page); await b.fill(kw); if (enter) { await b.press('Enter'); await settle(page); }
}
export const STATUS: Record<string, string> = { Draft: 'Nháp', Submitted: 'Chờ phê duyệt', Rejected: 'Bị từ chối', Approved: 'Đã phê duyệt', Active: 'Đang diễn ra', Closed: 'Đã kết thúc' };

/** Mọi ID chưa có script thật: vẫn đăng ký 1 test (1-1 với catalog) và skip kèm lý do rõ ràng. */
export const BLOCKED_CREATE = 'BLOCKED: API tạo đợt trả 400 "Bạn không có quyền truy cập dữ liệu của đơn vị này" ở mọi tài khoản (lỗi phạm vi dữ liệu máy chủ) → không dựng được dữ liệu thử';
export const NOT_YET = 'CHƯA TỰ ĐỘNG HOÁ: cần dữ liệu/điều kiện riêng chưa dựng được tự động trong đợt này';
export function skipped(ids: string[], reason: string) {
  for (const id of ids) test(tc(id), async () => { test.skip(true, reason); });
}

/** POST công khai có giới hạn tần suất (~5 yêu cầu/60s/IP → 429 + Retry-After). Tự chờ rồi gửi lại để kết quả không bị 429 làm sai. */
export async function postPublic(resource: string, body: any) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API_BASE}/api/v1/${resource}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status !== 429) { const j: any = await r.json().catch(() => ({})); return { status: r.status, message: String(j?.message ?? ''), data: j?.data }; }
    await new Promise(f => setTimeout(f, (Number(r.headers.get('retry-after')) || 60) * 1000 + 500));
  }
  throw new Error('Bị giới hạn tần suất (429) liên tục');
}

// ---------- Dữ liệu thử qua API (đơn vị "aaaaaa": superadmin/admin tạo được; canbo/cbdp bị 400 phạm vi dữ liệu) ----------
export const ORG = '994ce77a-0414-4506-8620-3068048525ff';
export const dayStr = (n = 0) => { const d = new Date(Date.now() + 7 * 3600e3 + n * 864e5); return d.toISOString().slice(0, 10); };
export const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
export const NAME = 'qc.automation E';
export const payload = (o: any = {}) => ({
  name: `${NAME} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, organizationId: ORG, startDate: dayStr(1), endDate: dayStr(30),
  methods: [1], voteTarget: 5, description: '', status: 1, groups: [{ name: 'Nhóm 1', questions: [{ content: 'Câu 1' }] }], ...o,
});
const MADE: string[] = [];
/** Tạo đợt qua API (mặc định bằng superadmin) và nhớ id để dọn. */
export async function mk(o: any = {}, as = 'superadmin') {
  const r = await api('POST', 'survey/surveys', payload(o), as);
  if (r.data?.id) MADE.push(r.data.id);
  return r;
}
export const setStatus = (id: string, status: number, reason?: string, as = 'superadmin') => api('PUT', `survey/surveys/${id}/status`, { status, ...(reason ? { reason } : {}) }, as);
export const getSurvey = async (id: string, as = 'superadmin') => (await api('GET', `survey/surveys/${id}`, undefined, as)).data;
/** Xóa (Nháp/Bị từ chối xóa được; Chờ phê duyệt thì từ chối rồi xóa). Đợt đã duyệt không xóa được → bỏ qua. */
export async function rmSurvey(id: string) {
  let r = await api('DELETE', `survey/surveys/${id}`);
  if (r.status >= 400) { await setStatus(id, 4, 'dọn dữ liệu test'); r = await api('DELETE', `survey/surveys/${id}`); }
  return r.status < 400;
}
export async function cleanMade() { while (MADE.length) await rmSurvey(MADE.pop()!); }
/** Xóa mọi đợt do test tạo theo tên (kể cả tạo qua UI). */
export async function cleanByName(frag: string) {
  for (const s of await allSurveys({ keyword: frag })) if (s.name.includes(frag) && ['Nháp', 'Bị từ chối', 'Chờ phê duyệt'].includes(s.statusName)) await rmSurvey(s.id);
}
/** Đợt cố định đã duyệt/đang diễn ra dùng chung (không xóa được) — tạo 1 lần theo tên, tái sử dụng. */
export async function fixture(key: string, o: any = {}, final: 'Nháp' | 'Chờ phê duyệt' | 'Đã phê duyệt' | 'Đang diễn ra' | 'Đã kết thúc' = 'Đang diễn ra') {
  const name = `${NAME} FX ${key}`;
  const found = (await allSurveys({ keyword: name })).find(s => s.name === name);
  if (found) return found;
  const start = final === 'Đã phê duyệt' ? dayStr(3) : dayStr(0);
  const r = await api('POST', 'survey/surveys', payload({ name, startDate: start, endDate: dayStr(final === 'Đã kết thúc' ? 0 : 60), status: final === 'Nháp' ? 1 : 2, methods: [1, 2, 3], voteTarget: 4, groups: [{ name: 'Nhóm A', questions: [{ content: 'Câu A1' }, { content: 'Câu A2' }] }, { name: 'Nhóm B', questions: [{ content: 'Câu B1' }] }], ...o }));
  if (!r.data?.id) throw new Error(`Không tạo được fixture ${key}: ${r.message}`);
  if (['Đã phê duyệt', 'Đang diễn ra', 'Đã kết thúc'].includes(final)) await setStatus(r.data.id, 3);
  return getSurvey(r.data.id);
}

// ---------- thao tác UI trên danh sách / hộp thoại xác nhận ----------
/** Tìm đợt theo mã trên danh sách và mở menu thao tác của dòng, chọn mục theo text. */
export async function rowMenu(page: Page, code: string, item: RegExp) {
  page.setDefaultTimeout(10_000); await openList(page); await search(page, code);
  const row = dataRows(page).filter({ hasText: code }).first(); await row.locator('button').last().click();
  await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: item }).first().click();
}
export const confirmBtn = (page: Page, kind: 'delete' | 'submit' | 'approve' | 'reject') => page.locator(`#survey-${kind}-confirm-btn`);
export const modal = (page: Page) => page.locator('.ant-modal').last();
export const toastText = async (page: Page) => { const t = page.locator('.ant-message-notice, .ant-notification-notice').last(); await t.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}); return ((await t.textContent().catch(() => '')) || '').trim(); };

// ---------- Phiếu (kết quả) ----------
/** answers theo thứ tự câu của đợt; v = chuỗi 'H'/'C' mỗi ký tự một câu. */
export const qidsOf = (d: any): string[] => d.groups.flatMap((g: any) => g.questions.map((q: any) => q.id));
export const ansOf = (d: any, v: string) => qidsOf(d).map((id, i) => ({ surveyQuestionId: id, result: v[i % v.length] === 'H' ? 1 : 2 }));
export const addResult = (sid: string, d: any, method: 2 | 3, v: string, note = '', as = 'superadmin') =>
  api('POST', `survey/surveys/${sid}/results`, { method, collectedDate: dayStr(0), note, answers: ansOf(d, v) }, as);
export const results = async (sid: string, filter: any = {}, page = 1, size = 100, as = 'superadmin') =>
  (await api('GET', `survey/surveys/${sid}/results?page=${page}&size=${size}&filter=${F(filter)}`, undefined, as)).data ?? { content: [], totalElements: 0 };
export const stats = async (sid: string, as = 'superadmin') => (await api('GET', `survey/surveys/${sid}/statistics`, undefined, as)).data;
/** Gửi phiếu trực tuyến (người dân) — có giới hạn tần suất nên chậm (~5/phút). */
export const addOnline = async (sid: string, v: string, note = '') => {
  const d = (await raw('GET', `public/surveys/${sid}`)).data;
  return postPublic(`public/surveys/${sid}/responses`, { channel: 1, note: note || undefined, answers: qidsOf(d).map((id, i) => ({ questionId: id, result: v[i % v.length] === 'H' ? 1 : 2 })) });
};
/** Đợt dùng chung có sẵn 7 phiếu: Trực tiếp 3, Gián tiếp 2, Trực tuyến 2 (tạo 1 lần). */
export async function fixtureRes() {
  const fx = await fixture('RES'); const d = await getSurvey(fx.id);
  const cnt = (m: number) => d.methodCounts?.find((x: any) => x.method === m)?.count ?? 0;
  if (cnt(2) === 0 && cnt(3) === 0) {
    await addResult(fx.id, d, 2, 'HHH', 'Ghi chú D1'); await addResult(fx.id, d, 2, 'HCH', ''); await addResult(fx.id, d, 2, 'HHC', 'Ghi chú D3');
    await addResult(fx.id, d, 3, 'CCC', 'Ghi chú I1'); await addResult(fx.id, d, 3, 'HHC', '');
  }
  if (cnt(1) < 2) { if (cnt(1) < 1) await addOnline(fx.id, 'HCH', 'online 1'); await addOnline(fx.id, 'CCC', ''); }
  return getSurvey(fx.id);
}

// ---------- xlsx (giải nén bằng unzip hệ thống) ----------
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
export type Sheets = Record<string, string[][]>;
export function xlsxSheets(file: string): Sheets {
  const z = (n: string) => { try { return execFileSync('unzip', ['-p', file, n], { maxBuffer: 64 << 20 }).toString('utf8'); } catch { return ''; } };
  const shared = [...z('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const names = [...z('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]*)"/g)].map(m => dec(m[1]));
  const out: Sheets = {};
  names.forEach((n, i) => {
    out[n] = [...z(`xl/worksheets/sheet${i + 1}.xml`).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r => [...r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => {
      const t = /t="(\w+)"/.exec(c[1])?.[1], b = c[2] ?? '';
      if (t === 's') return shared[Number(/<v>(\d+)<\/v>/.exec(b)?.[1])] ?? '';
      if (t === 'inlineStr') return dec([...b.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
      return /<v>([\s\S]*?)<\/v>/.exec(b)?.[1] ?? '';
    }));
  });
  return out;
}
/** Tải tệp từ API bằng token (trả tên tệp theo Content-Disposition). */
export async function downloadApi(resource: string, as = 'superadmin') {
  const r = await fetch(`${API_BASE}/api/v1/${resource}`, { headers: { Authorization: `Bearer ${(await import('../api')).tokenOf(as)}` } });
  const cd = r.headers.get('content-disposition') ?? ''; const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(cd)?.[1] ?? /filename=([^;]+)/.exec(cd)?.[1] ?? '');
  const file = path.join(os.tmpdir(), `qc-e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${name || 'x.bin'}`); const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(file, buf);
  return { status: r.status, name, file, size: buf.length, text: r.status >= 400 ? buf.toString('utf8') : '' };
}
export const pc = (n: number) => n.toFixed(2).replace('.', ',') + '%';
/** Dựng đợt Đang diễn ra có sẵn phiếu: rows = [method, 'HCH', note][] (chỉ hình thức 2/3). */
export async function seededFixture(key: string, groups: any[], rows: [2 | 3, string, string?][], o: any = {}) {
  const fx = await fixture(key, { groups, ...o }); let d = await getSurvey(fx.id);
  if (d.resultCount === 0) { for (const [m, v, n] of rows) { const r = await addResult(fx.id, d, m, v, n ?? ''); if (r.status !== 200) throw new Error(`seed ${key}: ${r.message}`); } d = await getSurvey(fx.id); }
  return d;
}
