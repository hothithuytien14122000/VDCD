// C.UC1 KẾT QUẢ TỰ ĐÁNH GIÁ (4) — testcase BỔ SUNG từ bug/góp ý GitLab (catalog-BUG.mjs, catalog-BUG-C.mjs; prefix RES).
// Assert theo kỳ vọng ĐÚNG (exp) — test FAIL nghĩa là lỗi còn tồn tại.
// Chỉ dùng phiên canbo / cbdp / ldd / ldp / lanhdaobo (không đăng nhập lại, không cần tài khoản quản trị).
// Dữ liệu thử (tên "qc.automation BUGC …") do Cán bộ tạo + Lãnh đạo Bộ phê duyệt qua API; kỳ đã phê duyệt không xóa được nên được TÁI SỬ DỤNG
// (tìm theo tên trước khi tạo). Các thao tác ghi (Lưu nháp, tải tệp, trình/duyệt) chỉ chạy trên kết quả của kỳ thử này.
// Case không tự động hóa được (so design Figma, cần BA xác nhận) không có test ở đây — xem báo cáo.
import { Page, Browser, BrowserContext, Locator } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect, tc, api, tokenOf, code8 } from './common';
import { hidePwExpiry } from '../helpers';
import { API_BASE } from '../api';

test.describe.configure({ timeout: Number(process.env.QC_TIMEOUT ?? 120_000) });

// ---------------------------------------------------------------- Hằng số dữ liệu
const RES = 'dti/assessment-results', CAMP = 'dti/self-assessment-campaigns';
const SCALE = '6f1c6e0e-5a56-4a0e-9a53-0d1f2b6b7c01';     // TXL-001 Thang xếp loại mặc định
const SET_BA = '5ff891ae-818e-444a-9b00-5a22da75503c';    // BA-TEST: 1 chỉ số, tối đa 8
const SET_MI = 'f534a9a2-6fb6-44f3-9ac1-47195582db9b';    // QCARES1S: 1 chỉ số cha + 3 chỉ số con (5–8, 5–10, 0–8)
const ORG = { BO: 'bf944505-046b-45fb-a4d1-3082974159e7', DP: 'ef735c7e-5ef1-4e88-a037-acb4f10bbd5f' } as const;   // QA - Đơn vị Bộ / QA - Địa phương
type OrgK = keyof typeof ORG;
const ROLE = { BO: { cb: 'canbo', ld: 'ldd' }, DP: { cb: 'cbdp', ld: 'ldp' } } as const;
const FX_NAME = 'qc.automation BUGC fixture';
const F = (o: any) => encodeURIComponent(JSON.stringify(o));
const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();

// Ngày theo giờ Việt Nam (UTC+7) dạng YYYY-MM-DD
const vnDay = (offsetDays = 0) => new Date(Date.now() + 7 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
const TODAY = vnDay(0), TOMORROW = vnDay(1);
const dmy = (ymd: string) => ymd.split('-').reverse().join('/');
const ymdOf = (dmyStr: string) => { const m = dmyStr.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

// ---------------------------------------------------------------- API tiện ích
const must = (r: any, w: string) => { if (r.status >= 300) throw new Error(`${w}: HTTP ${r.status} ${r.message}`); return r; };
const getRes = async (id: string, as = 'canbo') => (await api('GET', `${RES}/${id}`, undefined, as)).data;
const histOf = async (id: string, as = 'canbo') => ((await api('GET', `${RES}/${id}/history`, undefined, as)).data ?? []) as any[];
async function lstAll(filter: any, as = 'canbo'): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 10; p++) {
    const d = (await api('GET', `${RES}?page=${p}&size=100&filter=${F(filter)}`, undefined, as)).data ?? {};
    out.push(...(d.content ?? []));
    if (p >= (d.totalPages ?? 1)) break;
  }
  return out;
}
const leaves = (d: any) => (d.indicators as any[]).filter(i => i.isLeaf && i.isScored);
const scoreOf = (i: any) => Math.min(Math.max(i.minScore ?? 0, 1), i.maxScore);
const asScore = (i: any) => ({ indicatorSetIndicatorId: i.indicatorSetIndicatorId, score: i.score, note: i.note, attachmentIds: (i.attachments ?? []).map((a: any) => a.id) });
const saveScores = (id: string, scores: any[], as: string) => api('PUT', `${RES}/${id}/scores`, { scores }, as);
async function upload(docType: string, entityId: string | null, name: string, bytes: Buffer, as = 'canbo') {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: 'application/pdf' }), name);
  if (entityId) fd.append('entityId', entityId);
  const r = await fetch(`${API_BASE}/api/v1/upload/blob/${docType}`, { method: 'POST', headers: { Authorization: `Bearer ${tokenOf(as)}` }, body: fd });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, message: String(j?.message ?? ''), data: j?.data };
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
/** PDF hợp lệ về chữ ký tệp, kích thước tùy ý (đệm bằng dòng chú thích) — ghi ra /tmp. */
function bigPdf(mb: number, name: string) {
  const file = path.join(os.tmpdir(), name);
  if (!fs.existsSync(file) || fs.statSync(file).size !== mb * 1024 * 1024) {
    const head = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%'), tail = Buffer.from('\ntrailer<<>>\n%%EOF\n');
    const pad = Buffer.alloc(mb * 1024 * 1024 - head.length - tail.length, 0x41);
    fs.writeFileSync(file, Buffer.concat([head, pad, tail]));
  }
  return file;
}

// ---------------------------------------------------------------- Dữ liệu thử (kỳ qc.automation BUGC …)
/** Tạo kỳ đột xuất (Cán bộ) → phân công → trình → Lãnh đạo Bộ phê duyệt. */
async function mkCamp(name: string, setId: string, startDate: string, endDate: string, orgs: string[], remind = 3) {
  const c = must(await api('POST', CAMP, { name, type: 'AdHoc', indicatorSetId: setId, scaleId: SCALE, reminderDaysBeforeDue: remind, organizationIds: orgs, startDate, endDate }, 'canbo'), `tạo kỳ "${name}"`);
  const id = c.data.id as string;
  try {
    await api('PUT', `${CAMP}/${id}/organizations`, orgs, 'canbo');
    must(await api('POST', `${CAMP}/${id}/submit`, undefined, 'canbo'), `trình kỳ "${name}"`);
  } catch (e) { await api('DELETE', `${CAMP}/${id}`, undefined, 'canbo'); throw e; }   // kỳ nháp lỗi → xóa, không để rác
  must(await api('POST', `${CAMP}/${id}/approve`, undefined, 'lanhdaobo'), `phê duyệt kỳ "${name}"`);
  return id;
}
const campRows = async (kw: string) => (await lstAll({ campaignType: 'AdHoc', phase: 'all', fullTextSearch: kw })).filter(x => String(x.campaignName).startsWith(kw));
/** Kỳ hạn nộp = một ngày cụ thể (theo giờ VN, bắt đầu hôm qua 00:00:00 → hạn 23:59:59; nhắc trước 1 ngày), giao cho QA - Đơn vị Bộ; mỗi ngày chạy tạo 1 lần. */
async function ensureDueCamp(day: string, tag: string) {
  const name = `qc.automation BUGC hạn ${tag} ${day}`;
  let rows = await campRows(name);
  if (!rows.length) { await mkCamp(name, SET_BA, `${vnDay(-1)}T00:00:00`, `${day}T23:59:59`, [ORG.BO], 1); rows = await campRows(name); }
  return { name, rows };
}
const DONE = ['Approved', 'Submitted', 'UnlockRequested', 'NotSent'];
/** Kết quả thử của đơn vị (BO/DP) còn trong vòng chấm/duyệt; hết thì tạo kỳ thử mới (bộ chỉ số QCARES1S). */
async function take(org: OrgK): Promise<string> {
  const pick = async () => (await campRows(FX_NAME)).filter(x => x.organizationId === ORG[org] && !DONE.includes(x.status));
  let rows = await pick();
  if (!rows.length) { await mkCamp(`${FX_NAME} ${code8()}`, SET_MI, '2026-11-01T00:00:00', '2027-12-31T23:59:59', [ORG.BO, ORG.DP]); rows = await pick(); }
  if (!rows.length) throw new Error(`không có kết quả thử của ${org}`);
  return rows[0].id;
}
async function scoreAll(id: string, as: string) {
  const d = await getRes(id, as);
  const sc = leaves(d).map(i => ({ ...asScore(i), score: i.score ?? scoreOf(i) }));
  must(await saveScores(id, sc, as), 'chấm đủ điểm');
}
/** Đưa kết quả thử về trạng thái cho phép chấm (Chưa thực hiện / Đang chấm / Bị từ chối). */
async function toEditable(id: string, org: OrgK) {
  const st = (await getRes(id)).status;
  if (st === 'PendingApproval') must(await api('POST', `${RES}/${id}/reject`, { reason: 'qc.automation BUGC đưa về chấm lại' }, ROLE[org].ld), 'từ chối');
  else if (DONE.includes(st)) throw new Error(`kết quả ${id} đang ${st}, không đưa về chấm được`);
  return id;
}
async function toPending(id: string, org: OrgK) {
  const st = (await getRes(id)).status;
  if (st === 'PendingApproval') return id;
  await scoreAll(id, ROLE[org].cb);
  must(await api('POST', `${RES}/${id}/submit-for-approval`, undefined, ROLE[org].cb), 'trình duyệt');
  return id;
}
async function editable(org: OrgK = 'BO') { const id = await take(org); return toEditable(id, org); }
async function pending(org: OrgK = 'BO') { const id = await take(org); return toPending(id, org); }
/** Kết quả thử "Đã phê duyệt" chưa gửi Bộ (để thử tải văn bản xác nhận). */
async function approvedBO() {
  const ok = (await campRows(FX_NAME)).find(x => x.organizationId === ORG.BO && x.status === 'Approved' && !(x.lastSentDate));
  if (ok) return ok.id as string;
  const id = await pending('BO');
  must(await api('POST', `${RES}/${id}/approve`, undefined, 'ldd'), 'phê duyệt');
  return id;
}

// ---------------------------------------------------------------- Giao diện
/** Request ghi (PUT/POST) tới kết quả bị lỗi mạng — dùng để chứng minh thao tác đã thực sự gửi đi khi mất kết nối. */
const FAILED: string[] = [];
const failedNote = () => (FAILED.length ? ` [request lỗi mạng: ${FAILED.splice(0).join('; ')}]` : ' [không ghi nhận request ghi nào]');
const BASE_URL = () => (test.info().project.use as any).baseURL as string;
const ROUTE = '/vi/assessment-results';
/** Mở một phiên trình duyệt theo tài khoản (múi giờ VN như người dùng thật); lỗi → chụp ảnh đính kèm vào kết quả test. */
async function withRole(browser: Browser, key: string, fn: (p: Page, ctx: BrowserContext) => Promise<void>, vp = { width: 1920, height: 1080 }) {
  const ctx = await browser.newContext({ storageState: `auth/${key}.json`, baseURL: BASE_URL(), timezoneId: 'Asia/Ho_Chi_Minh', locale: 'vi-VN', viewport: vp });
  await hidePwExpiry(ctx);
  const page = await ctx.newPage();
  page.on('requestfailed', r => { if (/\/api\/v1\/dti\/assessment-results\//.test(r.url()) && r.method() !== 'GET') FAILED.push(`${r.method()} ${r.url().replace(/^.*\/api\/v1\//, '')} → ${r.failure()?.errorText}`); });
  try { await fn(page, ctx); }
  catch (e) {
    const file = test.info().outputPath(`loi-${key}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    await test.info().attach(`ảnh lỗi (${key})`, { path: file, contentType: 'image/png' }).catch(() => {});
    throw e;
  } finally { await ctx.close(); }
}
const settle = async (p: Page, ms = 700) => { await p.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(ms); };
const content = (p: Page) => p.locator('.ant-layout-content').first();
const bodyText = async (p: Page) => norm(await content(p).innerText());
async function openList(p: Page, qs = '') {
  await p.goto(`${ROUTE}${qs}`, { waitUntil: 'networkidle' });
  await p.locator('tbody tr.ant-table-row, .ant-empty, .ant-table-placeholder').first().waitFor({ timeout: 15_000 }).catch(() => {});
  await settle(p, 400);
}
async function tabAll(p: Page) { await p.getByRole('tab', { name: /^Tất cả/ }).first().click(); await settle(p); }
async function segment(p: Page, s: 'Định kỳ' | 'Đột xuất') { await content(p).getByText(s, { exact: true }).first().click(); await settle(p); }
const filterSels = (p: Page) => content(p).locator('.ant-select:not(.ant-pagination-options .ant-select)');
const statusSel = (p: Page) => filterSels(p).nth(0);
const deadlineSel = (p: Page) => filterSels(p).nth(1);
const openDD = (p: Page) => p.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
async function optionsOf(p: Page, sel: Locator) {
  await sel.click(); await openDD(p).waitFor({ state: 'visible', timeout: 6000 });
  const o = (await openDD(p).locator('.ant-select-item-option').allInnerTexts()).map(norm);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  return o;
}
async function choose(p: Page, sel: Locator, label: string) {
  await sel.click(); await openDD(p).waitFor({ state: 'visible', timeout: 6000 });
  await openDD(p).locator('.ant-select-item-option', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().click();
  await settle(p);
}
async function search(p: Page, kw: string) { await content(p).getByPlaceholder(/tìm theo kỳ/i).fill(kw); await settle(p, 1000); }
async function totalOf(p: Page) {
  const t = norm(await p.locator('.ant-pagination').first().innerText().catch(() => ''));
  const m = t.match(/trong\s+(\d+)/i); return m ? Number(m[1]) : await p.locator('tbody tr.ant-table-row').count();
}
type Row = { cells: string[]; text: string };
const rowsData = (p: Page): Promise<Row[]> => p.locator('tbody tr.ant-table-row').evaluateAll(trs => trs.map(tr => ({
  cells: [...tr.querySelectorAll(':scope > td')].map(t => (t as HTMLElement).innerText.trim()),
  text: (tr as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
})));
/** Mọi dòng của bộ lọc hiện tại (duyệt hết các trang). Cột: 0 STT, 1 Mã kỳ, 2 Kỳ, 3 Đơn vị, 4 Hạn nộp, 5 Tiến độ, 6 Điểm, 7 Trạng thái. */
async function allRows(p: Page): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < 30; i++) {
    out.push(...await rowsData(p));
    const next = p.locator('.ant-pagination-next').first();
    if (!(await next.count()) || (await next.getAttribute('aria-disabled')) === 'true' || /disabled/.test((await next.getAttribute('class')) ?? '')) break;
    await next.click(); await settle(p, 500);
  }
  return out;
}
const dueOf = (r: Row) => ymdOf(r.cells[4] ?? '');
const statusOf = (r: Row) => norm((r.cells[7] ?? '').split('\n')[0]);
/** Thông báo nổi (message/notification) + lỗi trong hộp thoại đang mở — không lấy banner trạng thái cố định của trang. */
const toasts = async (p: Page) => norm((await p.locator('.ant-message-notice, .ant-notification-notice, .ant-modal:visible .ant-alert, .ant-modal:visible .ant-form-item-explain-error').allInnerTexts()).join(' | '));
const modal = (p: Page) => p.locator('.ant-modal:visible').last();
async function openDetail(p: Page, id: string) {
  await p.goto(`${ROUTE}/${id}`, { waitUntil: 'networkidle' });
  await p.getByText(/Hạn nộp:/).first().waitFor({ timeout: 15_000 }).catch(() => {});
  await settle(p, 500);
}
const EDIT_BTN = /^\s*(Chấm điểm|Bắt đầu chấm|Tiếp tục chấm|Chấm lại)\s*$/;
/** Mở chi tiết rồi bấm nút vào chế độ chấm điểm (form có Lưu nháp / Trình duyệt). */
async function openScoring(p: Page, id: string) {
  await openDetail(p, id);
  await content(p).locator('button', { hasText: EDIT_BTN }).first().click();
  await p.getByRole('button', { name: 'Lưu nháp' }).waitFor({ timeout: 10_000 });
  await settle(p, 500);
}
const rowOf = (p: Page, text: string) => content(p).locator('tbody tr', { hasText: text }).last();
const DRAFT = (p: Page) => p.getByRole('button', { name: 'Lưu nháp' });
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
    return dec(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
  }));
}

// ================================================================ L — DANH SÁCH: bộ lọc Hạn tự đánh giá (#292), Xuất Excel (#288)
test.describe('Kết quả tự đánh giá › Bug GitLab › Danh sách', () => {
  test(tc('RES-L85'), async ({ browser }) => {
    await withRole(browser, 'canbo', async p => {
      const bad: string[] = [];
      for (const s of ['Định kỳ', 'Đột xuất'] as const) {
        await openList(p); await segment(p, s); await tabAll(p);
        const all: string[][] = [];
        for (let i = 0; i < await filterSels(p).count(); i++) all.push(await optionsOf(p, filterSels(p).nth(i)));
        const o = all.find(x => x.some(v => /đến hạn|quá hạn/i.test(v)));
        if (!o) { bad.push(`${s}: không có bộ lọc Hạn tự đánh giá (các ô lọc: ${all.map(x => x.join('/')).join(' ; ')})`); continue; }
        const ok = o.length === 4 && /^Tất cả/.test(o[0]) && ['Chưa đến hạn', 'Đến hạn', 'Quá hạn'].every(v => o.includes(v));
        if (!ok) bad.push(`${s}: giá trị bộ lọc = ${o.join(' | ')}`);
      }
      expect(bad, bad.join('; ')).toEqual([]);
    });
  });

  for (const [id, label, cmp, why] of [
    ['RES-L86', 'Chưa đến hạn', (d: string) => d > TODAY, `Hạn nộp phải > hôm nay (${dmy(TODAY)})`],
    ['RES-L88', 'Quá hạn', (d: string) => d < TODAY, `Hạn nộp phải < hôm nay (${dmy(TODAY)})`],
  ] as const) test(tc(id), async ({ browser }) => {
    const due = id === 'RES-L88' ? await ensureDueCamp(TODAY, 'hôm nay') : null;   // kỳ hạn = hôm nay không được lọt vào Quá hạn
    await withRole(browser, 'canbo', async p => {
      const bad: string[] = []; let n = 0;
      for (const s of ['Định kỳ', 'Đột xuất'] as const) {
        await openList(p); await segment(p, s); await tabAll(p);
        await choose(p, deadlineSel(p), label);
        const rows = await allRows(p); n += rows.length;
        for (const r of rows) if (!cmp(dueOf(r))) bad.push(`${s}: ${r.cells[2]} / ${r.cells[3]} hạn ${r.cells[4]}`);
        if (due && s === 'Đột xuất' && rows.some(r => r.text.includes(due.name))) bad.push(`kỳ hạn hôm nay "${due.name}" xuất hiện trong Quá hạn`);
      }
      expect(n, `lọc "${label}" phải có dữ liệu`).toBeGreaterThan(0);
      expect(bad.slice(0, 10), `${why}: ${bad.length} dòng sai`).toEqual([]);
    });
  });

  test(tc('RES-L87'), async ({ browser }) => {
    const today = await ensureDueCamp(TODAY, 'hôm nay'), tomorrow = await ensureDueCamp(TOMORROW, 'ngày mai');
    await withRole(browser, 'canbo', async p => {
      await openList(p); await segment(p, 'Đột xuất'); await tabAll(p);
      await choose(p, deadlineSel(p), 'Đến hạn');
      const rows = await allRows(p);
      const wrong = rows.filter(r => dueOf(r) !== TODAY).map(r => `${r.cells[2]} hạn ${r.cells[4]}`);
      expect(rows.some(r => r.text.includes(today.name)), `kỳ hạn hôm nay "${today.name}" phải có trong Đến hạn (số dòng: ${rows.length})`).toBeTruthy();
      expect(rows.some(r => r.text.includes(tomorrow.name)), `kỳ hạn ngày mai "${tomorrow.name}" không được có trong Đến hạn`).toBeFalsy();
      expect(wrong.slice(0, 10), `mọi dòng phải có Hạn nộp = ${dmy(TODAY)}`).toEqual([]);
    });
  });

  test(tc('RES-L89'), async ({ browser }) => {
    await withRole(browser, 'canbo', async p => {
      await openList(p); await segment(p, 'Đột xuất'); await tabAll(p);
      await choose(p, deadlineSel(p), 'Chưa đến hạn');
      await choose(p, statusSel(p), 'Đang chấm điểm');
      await search(p, 'qc.automation');
      const rows = await allRows(p);
      expect(rows.length, 'kết hợp Chưa đến hạn + Đang chấm điểm + từ khóa "qc.automation" phải có dữ liệu').toBeGreaterThan(0);
      const bad = rows.filter(r => !(dueOf(r) > TODAY && statusOf(r) === 'Đang chấm điểm' && /qc\.automation/i.test(r.text)))
        .map(r => `${r.cells[2]} / ${r.cells[3]} hạn ${r.cells[4]} ${statusOf(r)}`);
      expect(bad.slice(0, 10), 'mọi dòng phải thỏa đồng thời 3 điều kiện').toEqual([]);
      // Kiểm chéo với API cùng bộ lọc
      const api3 = (await lstAll({ campaignType: 'AdHoc', phase: 'all', deadlineStatus: 'NotDue', status: 'Scoring', fullTextSearch: 'qc.automation' })).length;
      expect(rows.length, 'số dòng giao diện = số bản ghi API cùng bộ lọc').toBe(api3);
    });
  });

  test(tc('RES-L90'), async ({ browser }) => {
    await withRole(browser, 'canbo', async p => {
      await openList(p); await segment(p, 'Đột xuất'); await tabAll(p);
      await choose(p, statusSel(p), 'Đang chấm điểm');
      await choose(p, deadlineSel(p), 'Chưa đến hạn');
      const btn = content(p).getByRole('button', { name: /Xuất Excel/ });
      await expect(btn, 'màn danh sách phải có nút Xuất Excel').toBeVisible();
      const total = await totalOf(p); expect(total).toBeGreaterThan(0);
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30_000 }), btn.click()]);
      const file = path.join(os.tmpdir(), `qc-bugc-l90-${Date.now()}.xlsx`); await dl.saveAs(file);
      const rows = xlsxRows(file); fs.rmSync(file, { force: true });
      const hi = rows.findIndex(r => r.some(c => /trạng thái/i.test(c)));
      const head = (rows[hi] ?? []).map(norm);
      const need = ['STT', 'Mã kỳ', 'Kỳ tự đánh giá', 'Đơn vị', 'Hạn nộp', 'Tiến độ chấm', 'Điểm', 'Trạng thái'];
      const miss = need.filter(c => !head.some(h => h.toLowerCase() === c.toLowerCase()));
      expect(miss, `file thiếu cột (tiêu đề thực tế: ${head.join(' | ')})`).toEqual([]);
      const data = rows.slice(hi + 1).filter(r => r.some(c => norm(c)));
      expect(data.length, 'số dòng trong file = số bản ghi theo bộ lọc').toBe(total);
      const si = head.findIndex(h => /^trạng thái$/i.test(h));
      const off = data.filter(r => norm(r[si]) !== 'Đang chấm điểm').map(r => r.join('|').slice(0, 80));
      expect(off.slice(0, 5), 'file chỉ gồm bản ghi đúng bộ lọc Trạng thái').toEqual([]);
    });
  });

  test(tc('RES-L91'), async ({ browser }) => {
    // Phần kiểm được chắc chắn: các ô Mã kỳ, Kỳ, Đơn vị, Hạn nộp, Điểm, Trạng thái chỉ có 1 dòng giá trị.
    // Ô Tiến độ chấm (x/y + thanh % ) là thành phần thiết kế, không coi là text phụ.
    await withRole(browser, 'canbo', async p => {
      const bad: string[] = [];
      for (const s of ['Định kỳ', 'Đột xuất'] as const) {
        await openList(p); await segment(p, s); await tabAll(p);
        for (const r of await rowsData(p)) for (const [i, col] of [[1, 'Mã kỳ'], [2, 'Kỳ'], [3, 'Đơn vị'], [4, 'Hạn nộp'], [6, 'Điểm'], [7, 'Trạng thái']] as const) {
          const lines = (r.cells[i] ?? '').split('\n').map(x => x.trim()).filter(Boolean);
          if (lines.length > 1) bad.push(`${s} – ${col}: "${lines.join(' ⏎ ')}"`);
        }
      }
      expect(bad.slice(0, 8), `${bad.length} ô có dòng text phụ`).toEqual([]);
    });
  });



  const THOIHAN = async (p: Page) => {
    for (let i = 0; i < await filterSels(p).count(); i++) {
      const o = await optionsOf(p, filterSels(p).nth(i));
      if (o.some(v => /kỳ đang diễn ra|kỳ đã kết thúc/i.test(v))) return { i, o };
    }
    return null;
  };


});

// ================================================================ S — CHẤM ĐIỂM (#288, #290, #291, #150, #164, #211, #286, #179)
test.describe('Kết quả tự đánh giá › Bug GitLab › Chấm điểm', () => {
  test(tc('RES-S100'), async ({ browser }) => {
    // Kỳ "Hồ Thị Thủy Tiên - 11/2" dùng bộ chỉ số có TEST_N05_CS05… "Không tính điểm" (chỉ đọc, không ghi)
    const cand = (await lstAll({ campaignType: 'AdHoc', phase: 'all', fullTextSearch: 'Hồ Thị Thủy Tiên - 11/2' })).concat(await lstAll({ campaignType: 'Periodic', phase: 'all', fullTextSearch: 'Hồ Thị Thủy Tiên - 11/2' }));
    let d: any = null;
    for (const x of cand) { const g = await getRes(x.id); if (g.indicators.some((i: any) => i.isScored === false)) { d = g; break; } }
    expect(d, 'cần kết quả có chỉ số Không tính điểm (TEST_N05_CS05…)').toBeTruthy();
    const off = (d.indicators as any[]).filter(i => i.isScored === false), on = leaves(d);
    await withRole(browser, 'canbo', async p => {
      await openDetail(p, d.id);
      const t = await bodyText(p);
      const shown = off.filter(i => t.includes(norm(i.indicatorName).slice(0, 40))).map(i => i.indicatorCode);
      expect(shown, `chỉ số Không tính điểm vẫn hiển thị trong bảng (${shown.length}/${off.length})`).toEqual([]);
      expect(t, 'Tiến độ chấm chỉ đếm chỉ số tính điểm').toContain(`Tiến độ chấm ${d.scoredCount} / ${on.length} chỉ số`);
      expect(t, 'Điểm tối đa chỉ cộng chỉ số tính điểm').toMatch(new RegExp(`Điểm (tự đánh giá|tạm tính) ${d.score ?? 0} / ${on.reduce((a, i) => a + i.maxScore, 0)}`));
    });
  });



  test(tc('RES-S103'), async ({ browser }) => {
    const id = await editable('BO');
    let d = await getRes(id);
    const before = d.indicators.map(asScore).filter((x: any) => leaves(d).some(l => l.indicatorSetIndicatorId === x.indicatorSetIndicatorId && (l.score != null || x.attachmentIds.length)));
    // chỉ số chưa có điểm, chưa có tệp
    let x = leaves(d).find(i => i.score == null && !(i.attachments ?? []).length);
    if (!x) { x = leaves(d)[0]; must(await saveScores(id, leaves(d).filter(i => i !== x).map(asScore), 'canbo'), 'xóa điểm 1 chỉ số'); d = await getRes(id); }
    // hệ thống chuẩn hóa tên tệp (bỏ '-', viết thường) → chỉ dùng chữ thường/số
    const name = `qcbugcs103n${Date.now() % 100000}.pdf`, c0 = d.indicatorsWithAttachment;
    try {
      await withRole(browser, 'canbo', async p => {
        await openScoring(p, id);
        const row = rowOf(p, x!.indicatorName);
        const up = p.waitForResponse(r => /upload\/blob\/assessment_result_evidence/.test(r.url()), { timeout: 20_000 });
        await row.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/pdf', buffer: PDF });
        const ur = await up; expect(ur.status(), 'tải tệp lên').toBeLessThan(300);
        await expect(row, 'tệp hiện ở cột Minh chứng trước khi lưu').toContainText(name);
        await DRAFT(p).click(); await p.waitForTimeout(2500);
        const msg = await toasts(p);
        await p.reload({ waitUntil: 'networkidle' }); await settle(p, 1000);
        await expect(rowOf(p, x!.indicatorName), `sau Lưu nháp + tải lại, tệp phải còn ở cột Minh chứng (thông báo khi lưu: "${msg}")`).toContainText(name, { timeout: 5000 });
        const g = await getRes(id);
        expect(JSON.stringify(g.indicators.find((i: any) => i.indicatorSetIndicatorId === x!.indicatorSetIndicatorId).attachments ?? []), 'API: chỉ số có tệp').toContain(name.replace('.pdf', ''));
        expect(g.indicatorsWithAttachment, 'thẻ Minh chứng tăng 1').toBe(c0 + 1);
        expect(await bodyText(p)).toContain(`Minh chứng ${c0 + 1} /`);
      });
    } finally { await saveScores(id, before, 'canbo'); }   // dọn: trả lại điểm/tệp như trước
  });

  test(tc('RES-S104'), async ({ browser }) => {
    const id = await editable('BO');
    const d = await getRes(id), x = leaves(d).find(i => !(i.attachments ?? []).length) ?? leaves(d)[0];
    const long = `qcbugcs104${'x'.repeat(120 - 'qcbugcs104'.length - 4)}.pdf`;   // tên 120 ký tự
    await withRole(browser, 'canbo', async p => {
      await openScoring(p, id);
      const row = rowOf(p, x.indicatorName);
      const inp = row.locator('input[type=file]');
      const multiple = await inp.evaluate(e => (e as HTMLInputElement).multiple);
      let stored = long;   // tên tệp hệ thống lưu (máy chủ có thể chuẩn hóa/rút ngắn tên)
      p.on('response', async r => { if (/upload\/blob\/assessment_result_evidence/.test(r.url())) { const n = (await r.json().catch(() => ({})))?.data?.fileName; if (/^qcbugcs104x/.test(n ?? '')) stored = n; } });
      if (multiple) await inp.setInputFiles([{ name: long, mimeType: 'application/pdf', buffer: PDF }, { name: 'qcbugcs104b.pdf', mimeType: 'application/pdf', buffer: PDF }]);
      else {
        await inp.setInputFiles({ name: long, mimeType: 'application/pdf', buffer: PDF }); await settle(p, 1500);
        if (await row.locator('input[type=file]').count()) await row.locator('input[type=file]').setInputFiles({ name: 'qcbugcs104b.pdf', mimeType: 'application/pdf', buffer: PDF });
        else test.info().annotations.push({ type: 'ghi chú', description: 'Sau khi có 1 tệp, ô chấm điểm không còn nút Tải file → chỉ kiểm được 1 tệp tên dài' });
      }
      await settle(p, 2000);
      const heads = content(p).locator('thead th');
      const hTexts = (await heads.allInnerTexts()).map(norm);
      const mi = hTexts.findIndex(h => /^Minh chứng/.test(h)), gi = hTexts.findIndex(h => /^Giải trình/.test(h));
      const mBox = (await heads.nth(mi).boundingBox())!, gBox = (await heads.nth(gi).boundingBox())!;
      const fileEl = row.getByText(/qcbugcs104x/).first();
      await expect(fileEl, 'tệp tên dài hiển thị trong cột Minh chứng').toBeVisible();
      const info = await fileEl.evaluate(e => {
        const el = e as HTMLElement, cs = getComputedStyle(el), r = el.getBoundingClientRect();
        let anc: HTMLElement | null = el, title = '';
        for (let k = 0; k < 4 && anc; k++, anc = anc.parentElement) title = title || anc.getAttribute('title') || '';
        return { txt: el.innerText, clipped: el.scrollWidth > el.clientWidth + 1, ell: cs.textOverflow, left: r.left, right: r.right, title };
      });
      const bad: string[] = [];
      if (!(info.clipped && info.ell === 'ellipsis') && !/\.\.\.|…/.test(info.txt)) bad.push(`tên dài không rút gọn "..." (hiển thị: "${info.txt.slice(0, 40)}…", text-overflow=${info.ell})`);
      if (info.right > gBox.x + 1) bad.push(`tên tệp tràn sang cột Giải trình (mép phải ${Math.round(info.right)} > ${Math.round(gBox.x)})`);
      if (info.left < mBox.x - 1) bad.push('tên tệp lệch khỏi cột Minh chứng');
      let full = info.title;
      if (stored !== long) test.info().annotations.push({ type: 'ghi chú', description: `máy chủ rút tên tệp 120 ký tự còn "${stored}" (${stored.length} ký tự) — tên đầy đủ để đối chiếu khi rê chuột là tên hệ thống lưu` });
      if (!full.includes(stored)) { await fileEl.hover(); await p.waitForTimeout(800); full = norm(await p.locator('.ant-tooltip:visible, [role=tooltip]:visible').allInnerTexts().then(a => a.join(' '))); }
      if (!full.includes(stored)) bad.push(`rê chuột không xem được đủ tên tệp (title="${info.title.slice(0, 50)}…", tooltip="${full.slice(0, 50)}…", hiển thị "${info.txt.slice(0, 50)}…")`);
      const items = row.getByText(/qcbugcs104/);
      if ((await items.count()) >= 2) {
        const [a, b] = [(await items.nth(0).boundingBox())!, (await items.nth(1).boundingBox())!];
        if (!(b.y >= a.y + a.height - 2)) bad.push('các tệp không xếp dọc');
      }
      expect(bad, bad.join('; ')).toEqual([]);
    });
  });

  test(tc('RES-S105'), async ({ browser }) => {
    const id = await take('BO');
    await withRole(browser, 'canbo', async p => {
      await openDetail(p, id);
      const rows = () => content(p).locator('tbody tr.ant-table-row:visible').count();
      const tg = content(p).locator('button', { hasText: /Thu gọn|Mở rộng/ });
      const n = await tg.count();
      if (n === 2) {
        const [a, b] = [(await tg.nth(0).boundingBox())!, (await tg.nth(1).boundingBox())!];
        expect(Math.abs(a.y - b.y) < 8 && Math.min(Math.abs(b.x - (a.x + a.width)), Math.abs(a.x - (b.x + b.width))) < 24, 'hai nút Thu gọn/Mở rộng phải nằm liền nhau').toBeTruthy();
      } else expect(n, 'một nút chuyển trạng thái Thu gọn/Mở rộng').toBe(1);
      const full = await rows();
      await content(p).locator('button', { hasText: /Thu gọn/ }).first().click(); await p.waitForTimeout(700);
      const pillars = (await getRes(id)).pillars.length;
      expect(await rows(), 'Thu gọn: chỉ còn dòng Trụ cột').toBe(pillars);
      await content(p).locator('button', { hasText: /Mở rộng/ }).first().click(); await p.waitForTimeout(700);
      expect(await rows(), 'Mở rộng: hiện đủ cây').toBe(full);
    });
  });


  test(tc('RES-S107'), async ({ browser }) => {
    // Phần kiểm được: ô tìm kiếm không chiếm quá nửa vùng bảng, không đè lên bộ lọc Trạng thái chấm (độ rộng px chính xác theo design: kiểm tay).
    const id = await editable('BO');
    for (const w of [1366, 1920]) await withRole(browser, 'canbo', async p => {
      await openScoring(p, id);
      const s = content(p).getByPlaceholder(/Tìm mã hoặc tên chỉ số/).first();
      const st = content(p).locator('.ant-select', { hasText: /Trạng thái chấm/ }).first();
      const table = content(p).locator('.ant-table').last();
      const [sb, fb, tb] = [(await s.boundingBox())!, (await st.boundingBox())!, (await table.boundingBox())!];
      expect(sb.width / tb.width, `[${w}px] ô tìm kiếm rộng ${Math.round(sb.width)}px / bảng ${Math.round(tb.width)}px`).toBeLessThanOrEqual(0.5);
      expect(sb.x + sb.width <= fb.x || fb.y >= sb.y + sb.height, `[${w}px] ô tìm kiếm đè lên bộ lọc Trạng thái chấm`).toBeTruthy();
      expect(fb.x + fb.width, `[${w}px] bộ lọc Trạng thái chấm nằm trong vùng bảng`).toBeLessThanOrEqual(tb.x + tb.width + 1);
    }, { width: w, height: 900 });
  });



});

// ================================================================ T/A — TRÌNH DUYỆT / PHÊ DUYỆT (#179, #200, #210)
test.describe('Kết quả tự đánh giá › Bug GitLab › Trình duyệt / Phê duyệt', () => {


  test(tc('RES-A36'), async () => {
    const id = await pending('BO'); const h0 = (await histOf(id)).filter(h => h.action === 'Approved' || /phê duyệt/i.test(h.actionName)).length;
    const rs = await Promise.all([1, 2].map(() => api('POST', `${RES}/${id}/approve`, undefined, 'ldd')));
    const codes = rs.map(r => r.status).sort();
    const h = (await histOf(id)).filter(x => x.action === 'Approved' || /phê duyệt/i.test(x.actionName));
    const g = await getRes(id);
    expect({ codes: codes.map(c => (c === 200 ? 200 : c >= 400 && c < 500 ? '4xx' : c)), status: g.status, approveRows: h.length - h0 },
      `2 request đồng thời: ${rs.map(r => `${r.status} "${r.message}"`).join(' ; ')}`).toEqual({ codes: [200, '4xx'], status: 'Approved', approveRows: 1 });
  });

  test(tc('RES-A37'), async ({ browser }) => {
    const id = await pending('DP'); const d = await getRes(id, 'cbdp');
    await withRole(browser, 'ldp', async p => {
      await openList(p, `?campaignType=AdHoc&phase=all&keyword=${encodeURIComponent(d.campaignName)}`);
      if (!(await p.locator('tbody tr.ant-table-row', { hasText: d.organizationName }).count())) await tabAll(p);
      const row = p.locator('tbody tr.ant-table-row', { hasText: d.campaignName }).filter({ hasText: d.organizationName }).first();
      const det = p.waitForResponse(r => new RegExp(`${RES}/${id}(\\?|$)`).test(r.url()) && r.request().method() === 'GET', { timeout: 15_000 });
      await row.getByRole('button', { name: 'Xem chi tiết' }).click();
      const dr = await det;
      expect(dr.status(), 'API chi tiết').toBe(200);
      await settle(p);
      expect(await bodyText(p)).not.toMatch(/404|Không tìm thấy/);
      await expect(content(p).locator('button', { hasText: /^\s*Phê duyệt\s*$/ })).toBeVisible();
      await expect(content(p).locator('button', { hasText: /^\s*Từ chối\s*$/ })).toBeVisible();
      await content(p).locator('button', { hasText: /^\s*Phê duyệt\s*$/ }).click();
      await modal(p).getByRole('button', { name: /Xác nhận phê duyệt/ }).click(); await p.waitForTimeout(2000);
      expect(await toasts(p)).toMatch(/Phê duyệt thành công/i);
      expect((await getRes(id, 'cbdp')).status).toBe('Approved');
    });
  });
});

/** Mở tab Hồ sơ gửi Bộ của kết quả thử; nếu còn văn bản đã tải lần trước (chưa gửi) thì Xoá để hiện lại ô tải tệp. */
async function openDossier(p: Page, id: string) {
  await openDetail(p, id); await p.getByRole('tab', { name: /Hồ sơ gửi Bộ/ }).click(); await settle(p);
  const sec = content(p).getByText('Văn bản xác nhận kết quả tự đánh giá').first().locator('xpath=..');
  const del = sec.locator('button', { hasText: /^\s*Xo[áa]\s*$/ });
  if (await del.count()) {
    await del.first().click(); await p.waitForTimeout(600);
    const m = p.locator('.ant-modal-confirm:visible, .ant-popconfirm:visible, .ant-modal:visible').last();
    if (await m.count()) await m.getByRole('button', { name: /^\s*(Xo[áa]|Xác nhận|Đồng ý|OK|Có)\s*$/i }).last().click().catch(() => {});
    await settle(p);
  }
}

// ================================================================ F — HỒ SƠ GỬI BỘ / MINH CHỨNG: dung lượng tệp (#296)
test.describe('Kết quả tự đánh giá › Bug GitLab › Tải tệp', () => {
  test(tc('RES-F44'), async ({ browser }) => {
    const id = await approvedBO(); const file = bigPdf(5, 'qcbugc5mb.pdf');
    await withRole(browser, 'canbo', async p => {
      await openDossier(p, id);
      const inp = content(p).locator('input[type=file]');
      expect(await inp.count(), 'tab Hồ sơ gửi Bộ phải có ô tải văn bản xác nhận').toBeGreaterThan(0);
      const up = p.waitForResponse(r => /upload\/blob\/assessment_result_file/.test(r.url()), { timeout: 60_000 });
      await inp.first().setInputFiles(file);
      const r = await up;
      expect(r.status(), `tải PDF 5 MB: HTTP ${r.status()}`).toBeLessThan(300);
      await expect(content(p)).toContainText('qcbugc5mb.pdf');
    });
  });

  test(tc('RES-F45'), async ({ browser }) => {
    const id = await approvedBO();
    await withRole(browser, 'canbo', async p => {
      await p.route(/upload\/blob\/assessment_result_file/, r => r.fulfill({ status: 413, contentType: 'text/html', body: '<html><head><title>413 Request Entity Too Large</title></head><body><center><h1>413 Request Entity Too Large</h1></center><hr><center>nginx</center></body></html>' }));
      await openDossier(p, id);
      const inp = content(p).locator('input[type=file]');
      expect(await inp.count(), 'tab Hồ sơ gửi Bộ phải có ô tải văn bản xác nhận').toBeGreaterThan(0);
      await inp.first().setInputFiles({ name: 'qcbugc-f45.pdf', mimeType: 'application/pdf', buffer: PDF });
      await p.waitForTimeout(3000);
      const msg = await toasts(p);
      const err = norm(await content(p).locator('.ant-form-item-explain-error, .ant-upload-list-item-error, [class*=error]').allInnerTexts().then(a => a.join(' | ')));
      expect(`${msg} ${err}`.trim(), 'máy chủ trả 413 → phải hiển thị thông báo lỗi').toMatch(/lỗi|không thể|quá lớn|dung lượng|thất bại|413|không phản hồi|thử lại/i);
      expect(await content(p).locator('.ant-upload .ant-spin-spinning, .ant-upload-list-item-uploading').count(), 'vùng tải không bị treo').toBe(0);
    });
  });

  test(tc('RES-F46'), async ({ browser }) => {
    const id = await editable('BO'); const file = bigPdf(5, 'qcbugc5mb.pdf');
    const d = await getRes(id), x = leaves(d).find(i => !(i.attachments ?? []).length) ?? leaves(d)[0];
    await withRole(browser, 'canbo', async p => {
      await openScoring(p, id);
      const up = p.waitForResponse(r => /upload\/blob\/assessment_result_evidence/.test(r.url()), { timeout: 60_000 });
      await rowOf(p, x.indicatorName).locator('input[type=file]').setInputFiles(file);
      const r = await up;
      expect(r.status(), `tải minh chứng PDF 5 MB: HTTP ${r.status()}`).toBeLessThan(300);
      await expect(rowOf(p, x.indicatorName)).toContainText('qcbugc5mb.pdf');
      // không Lưu nháp → điểm/tệp của kết quả không đổi
    });
  });

});

// ================================================================ V/D — CHI TIẾT (#163, #165, #212)
test.describe('Kết quả tự đánh giá › Bug GitLab › Chi tiết', () => {
  test(tc('RES-V25'), async ({ browser }) => {
    // Phần kiểm được: thẻ có nền/viền/đổ bóng; số liệu chữ lớn hơn nhãn và đậm (màu/kích thước chính xác theo design: kiểm tay)
    const id = await take('BO');
    await withRole(browser, 'canbo', async p => {
      await openDetail(p, id);
      const bad: string[] = [];
      for (const lb of ['Tiến độ chấm', /Điểm (tự đánh giá|tạm tính)/, 'Minh chứng']) {
        const label = content(p).getByText(lb as any, { exact: true }).first();
        const m = await label.evaluate(el => {
          const lab = el as HTMLElement, ls = getComputedStyle(lab);
          let card: HTMLElement | null = lab, deco = '';
          for (let k = 0; k < 5 && card; k++, card = card.parentElement) {
            const s = getComputedStyle(card);
            if (parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== 'none' || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== getComputedStyle(document.body).backgroundColor)) { deco = `${s.borderTopWidth} ${s.boxShadow.slice(0, 20)} ${s.backgroundColor}`; break; }
          }
          // số liệu chính = phần tử ngay sau nhãn (text node số đầu tiên, vd "3" trong "3 / 3 chỉ số")
          const num = lab.nextElementSibling as HTMLElement | null;
          const ns = num ? getComputedStyle(num) : null;
          return { lf: parseFloat(ls.fontSize), nf: ns ? parseFloat(ns.fontSize) : 0, nw: ns ? Number(ns.fontWeight) : 0, deco };
        });
        const name = String(lb);
        if (!m.deco) bad.push(`${name}: thẻ không có nền/viền/đổ bóng`);
        if (!(m.nf >= m.lf * 1.3)) bad.push(`${name}: số liệu ${m.nf}px không lớn hơn rõ nhãn ${m.lf}px`);
        if (m.nw < 600) bad.push(`${name}: số liệu không đậm (font-weight ${m.nw})`);
      }
      expect(bad, bad.join('; ')).toEqual([]);
    });
  });

  test(tc('RES-V26'), async ({ browser }) => {
    const id = await take('BO');
    await withRole(browser, 'canbo', async p => {
      await openDetail(p, id);
      const info = content(p).getByText('Thông tin chung', { exact: true });
      if (await info.count()) {
        const box = (await info.first().locator('xpath=ancestor::div[2]').boundingBox())!;
        expect(box.height, 'khối Thông tin chung không chiếm quá nửa màn hình').toBeLessThanOrEqual(768 / 2);
      }
      const first = content(p).locator('tbody tr.ant-table-row').first();
      await first.waitFor();
      const b = (await first.boundingBox())!;
      expect(b.y + b.height, 'dòng đầu của bảng chấm điểm nằm trong màn hình đầu tiên (1366×768)').toBeLessThanOrEqual(768);
    }, { width: 1366, height: 768 });
  });

  test(tc('RES-V27'), async ({ browser }) => {
    const id = await take('BO');
    const shot = async (who: string) => {
      let r: any = {};
      await withRole(browser, who, async p => {
        await openDetail(p, id);
        r = {
          cardTxt: (await bodyText(p)).match(/Tiến độ chấm|Điểm (tự đánh giá|tạm tính)|Minh chứng/g)?.slice(0, 3) ?? [],
          heads: (await content(p).locator('.ant-table-thead th').allInnerTexts()).map(norm).filter(Boolean),
          rows: (await content(p).locator('tbody tr.ant-table-row').allInnerTexts()).map(t => norm(t.split('\t')[0] ?? t).slice(0, 40)),
          inputs: await content(p).locator('.ant-input-number-input:visible, textarea:visible, input[type=file]').count(),
        };
      });
      return r;
    };
    const cb = await shot('canbo'), ld = await shot('ldd');
    expect(ld.cardTxt, 'Lãnh đạo: cùng các thẻ thông số').toEqual(cb.cardTxt);
    expect(ld.heads, 'Lãnh đạo: cùng các cột').toEqual(cb.heads);
    expect(ld.rows, 'Lãnh đạo: cùng cây Trụ cột → Nhóm → Chỉ số').toEqual(cb.rows);
    expect(ld.inputs, 'Lãnh đạo: chỉ xem, không có ô nhập').toBe(0);
  });

});

// ================================================================ R/W — NHẮC NHỞ (#222, #223), YÊU CẦU ĐÁNH GIÁ LẠI (#287)
test.describe('Kết quả tự đánh giá › Bug GitLab › Nhắc nhở / Đánh giá lại', () => {
  /** Mở hộp thoại "Gửi nhắc nhở hạn nộp tự đánh giá" (menu dòng "Nhắc nhở đơn vị") của một kết quả qc.automation — chỉ mở, không gửi.
   *  Hệ thống hiện chỉ cấp quyền nhắc nhở (allowedActions 'remind') cho Cán bộ địa phương (cbdp); Lãnh đạo Bộ không có quyền này. */
  async function openRemind(p: Page) {
    await openList(p, '?campaignType=AdHoc&phase=all&keyword=qc.automation'); await tabAll(p);
    for (const row of (await p.locator('tbody tr.ant-table-row').all()).slice(0, 20)) {
      await row.locator('button').last().click();
      const it = p.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: /nhắc nhở/i });
      if (await it.first().isVisible({ timeout: 1500 }).catch(() => false)) { await it.first().click(); await modal(p).waitFor(); await p.waitForTimeout(600); return modal(p); }
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    }
    throw new Error('không tìm thấy dòng có thao tác "Nhắc nhở đơn vị"');
  }
  test(tc('RES-R33'), async ({ browser }) => {
    await withRole(browser, 'cbdp', async p => {
      const m = await openRemind(p);
      const prog = m.getByText(/^\s*\d+\/\d+ chỉ số\s*$/);
      expect(await prog.count(), 'hộp thoại có cột tiến độ "x/y chỉ số"').toBeGreaterThan(0);
      const bad: string[] = [];
      for (const e of await prog.all()) {
        const r = await e.evaluate(el => { const s = getComputedStyle(el); const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.5; return { h: el.getBoundingClientRect().height, lh, t: (el as HTMLElement).innerText }; });
        if (r.h > r.lh * 1.5 || r.t.includes('\n')) bad.push(`"${norm(r.t)}" xuống dòng (cao ${Math.round(r.h)}px, 1 dòng ≈ ${Math.round(r.lh)}px)`);
      }
      await m.getByRole('button', { name: /Hu[ỷy]/ }).last().click();
      expect(bad, bad.join('; ')).toEqual([]);
    });
  });
  test(tc('RES-R34'), async ({ browser }) => {
    // Hệ thống hiện không còn nút "Gửi nhắc nhở" tổng ở đầu danh sách; so số đơn vị trên nút gửi trong hộp thoại với danh sách đơn vị của hộp thoại.
    await withRole(browser, 'cbdp', async p => {
      const m = await openRemind(p);
      const t = norm(await m.innerText());
      const hdr = Number(t.match(/\((\d+) đơn vị chưa gửi/)?.[1] ?? NaN);
      const btn = Number(norm(await m.getByRole('button', { name: /Gửi nhắc nhở/ }).last().innerText()).match(/\((\d+) đơn vị\)/)?.[1] ?? NaN);
      const listed = await m.getByText(/^\s*\d+\/\d+ chỉ số\s*$/).count();
      await m.getByRole('button', { name: /Hu[ỷy]/ }).last().click();
      expect({ nut: btn, tieuDe: hdr, soDong: listed }).toEqual({ nut: listed, tieuDe: listed, soDong: listed });
    });
  });

  async function openReassess(p: Page) {
    const r = (await lstAll({ campaignType: 'AdHoc', phase: 'all', fullTextSearch: 'qc.automation' })).find(x => x.allowedActions.includes('reassess'));
    if (!r) throw new Error('không có kết quả qc.automation "Đã gửi" cho phép Yêu cầu đánh giá lại');
    await openDetail(p, r.id);
    await content(p).getByRole('button', { name: 'Yêu cầu đánh giá lại' }).click();
    await modal(p).waitFor(); await p.waitForTimeout(500);
    return { m: modal(p), r };
  }
  test(tc('RES-W31'), async ({ browser }) => {
    await withRole(browser, 'canbo', async p => {
      const { m } = await openReassess(p);
      const lab = m.locator('.ant-form-item-label label').first();
      const s = await lab.evaluate(el => {
        const pick = (pe: string) => { const c = getComputedStyle(el, pe); return { content: c.content, color: c.color, display: c.display }; };
        const child = [...el.querySelectorAll<HTMLElement>('*')].find(x => x.innerText?.trim() === '*');
        return { text: (el as HTMLElement).innerText.trim(), before: pick('::before'), after: pick('::after'), child: child ? getComputedStyle(child).color : '' };
      });
      await m.getByRole('button', { name: /Hu[ỷy]/ }).last().click();
      const red = (c: string) => { const v = c.match(/\d+/g)?.map(Number) ?? []; return v.length >= 3 && v[0] >= 150 && v[1] < 110 && v[2] < 110; };
      const star = [s.before, s.after].find(x => /\*/.test(x.content) && x.display !== 'none');
      expect(s.text, 'nhãn ô lý do').toMatch(/^Lý do/);
      expect(!!(star && red(star.color)) || (!!s.child && red(s.child)), `nhãn phải có dấu * màu đỏ (::before ${s.before.content} ${s.before.color}; ::after ${s.after.content} ${s.after.color})`).toBeTruthy();
    });
  });
});
