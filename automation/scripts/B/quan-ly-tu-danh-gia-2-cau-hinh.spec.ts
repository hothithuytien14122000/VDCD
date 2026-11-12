// B.III Quản lý tự đánh giá › 2 Cấu hình, phân công, trình, duyệt — script bám testcase CMP-K / CMP-U / CMP-T / CMP-A (testcases/docs/catalog.json)
// Tác nhân chạy UI do catalog quy định (admin = Quản trị hệ thống, lanhdaobo = Lãnh đạo). API "bằng vai trò X" dùng api(..., 'X').
// Dữ liệu: kỳ Nháp tạo riêng từng test rồi xóa. Kỳ đã trình/duyệt/từ chối KHÔNG xóa được → dùng kỳ "fixture" tái sử dụng:
//   - "qc.automation CMP2 fixture A|P": xoay vòng Chờ phê duyệt ⇄ Bị từ chối (tạo 1 lần, dùng lại ở các lần chạy sau)
//   - "qc.automation CMP2 approved A|P ...": kỳ Đã phê duyệt (chỉ CMP-A01/A02 tạo mới mỗi lần chạy, các test khác dùng lại)
import { Page, Locator, Browser } from '@playwright/test';
import {
  test, expect, tc, needWrite, dataRows, waitList, dlg, btnCancel, toast, rowAction, rowMenuItems, confirmYes, confirmNo,
  api, listApi, code8, goto, pickByLabel, Made, ensurePillar, ensureGroup, ensureIndicator, tokenOf,
} from '../C/common';

const CAMP = 'dti/self-assessment-campaigns', SETS = 'dti/indicator-sets';
const FAKE = '00000000-0000-4000-8000-000000000000';
const ADM = 'admin', LDB = 'lanhdaobo';
const FORB = /không có quyền truy cập/i;
const CH1 = 'TEST_N01_CS01_1', PAR1 = 'TEST_N01_CS01';   // chỉ số con (tối đa 2) và chỉ số cha của nó trong bộ MBCS_QC01
const mk = { camps: [] as string[], sets: [] as string[] };
const made = new Made();
let seq = 0;
const nm = (s = '') => `qc.automation CMP2 ${s}${code8()}${(++seq).toString(36)}`;

test.afterEach(async () => {
  for (const id of mk.camps.splice(0).reverse()) await api('DELETE', `${CAMP}/${id}`).catch(() => {});   // chỉ kỳ Nháp xóa được
  for (const id of mk.sets.splice(0).reverse()) { await api('POST', `${SETS}/${id}/unlock`, {}).catch(() => {}); await api('DELETE', `${SETS}/${id}`).catch(() => {}); }
  await made.clean();
});

// ---------- Dữ liệu nền ----------
let _b: { setId: string; scaleId: string; dp: string; bo: string; qa: string; t3: string } | undefined;
async function base() {
  if (_b) return _b;
  const find = async (res: string, code: string) => { const x = (await listApi(res, code)).find((y: any) => y.code === code); if (!x) throw new Error(`thiếu dữ liệu nền ${res} ${code}`); return x.id as string; };
  _b = { setId: await find(SETS, 'MBCS_QC01'), scaleId: await find('dti/score-scales', 'TXL-001'), dp: await find('organizations', 'QC_DP'), bo: await find('organizations', 'QC_BO'), qa: await find('organizations', 'QA - Địa phương'), t3: await find('organizations', 'TTCDST-QA01') };
  return _b;
}
const getCamp = async (id: string, as = ADM) => (await api('GET', `${CAMP}/${id}`, undefined, as)).data;
const getSet = async (id: string, as = ADM) => (await api('GET', `${SETS}/${id}`, undefined, as)).data;
const flat = (d: any): any[] => (d?.groups ?? []).flatMap((g: any) => (g.indicators ?? []).flatMap((i: any) => [i, ...(i.children ?? [])]));
const byCode = (d: any, code: string) => flat(d).find((i: any) => i.indicatorCode === code);
const totalScore = (d: any) => (d?.groups ?? []).filter((g: any) => g.isScored).flatMap((g: any) => g.indicators.flatMap((i: any) => i.children ?? [])).filter((c: any) => c.isScored && c.weight > 0).reduce((a: number, c: any) => a + c.maxScore, 0);
const grpBody = (d: any) => d.groups.map((g: any) => ({ indicatorGroupId: g.indicatorGroupId, displayOrder: g.displayOrder, isScored: g.isScored }));
const indBody = (d: any) => flat(d).map((i: any, k: number) => ({ indicatorId: i.indicatorId, parentId: i.parentId, weight: i.weight, isScored: i.isScored, minScore: i.minScore, maxScore: i.maxScore, displayOrder: k + 1 }));
/** Sửa 1 chỉ số trong body PUT indicators của bộ `d`. */
const indPatch = (d: any, code: string, patch: any) => { const id = byCode(d, code).indicatorId; return indBody(d).map((o: any) => (o.indicatorId === id ? { ...o, ...patch } : o)); };
const putInds = (setId: string, body: any, as = ADM) => api('PUT', `${SETS}/${setId}/indicators`, body, as);
const putGrps = (setId: string, body: any, as = ADM) => api('PUT', `${SETS}/${setId}/groups`, body, as);
const putOrgs = (id: string, orgs: any, as = ADM) => api('PUT', `${CAMP}/${id}/organizations`, orgs, as);
const orgIds = (c: any) => (c?.organizations ?? []).map((o: any) => o.organizationId).sort();
const submitApi = (id: string, as = ADM) => api('POST', `${CAMP}/${id}/submit`, {}, as);
const rejectApi = (id: string, reason = 'qc.automation CMP2', as = LDB) => api('POST', `${CAMP}/${id}/reject`, { reason }, as);
const approveApi = (id: string, as = LDB) => api('POST', `${CAMP}/${id}/approve`, {}, as);
const putBody = (c: any, patch: any = {}) => ({ name: c.name, type: c.type, indicatorSetId: c.originalIndicatorSetId, startDate: c.startDate, endDate: c.endDate, scaleId: c.scaleId, periodType: c.periodType, reminderDaysBeforeDue: c.reminderDaysBeforeDue, ...patch });

/** Tạo kỳ qua API. keep=true: kỳ dùng lâu dài (không xóa sau test). */
async function mkCamp(o: { type?: 'AdHoc' | 'Periodic'; name?: string; orgs?: string[]; reminder?: any; keep?: boolean; patch?: any } = {}) {
  const b = await base(); const type = o.type ?? 'AdHoc';
  const body: any = { name: o.name ?? nm(), type, indicatorSetId: b.setId, scaleId: b.scaleId, ...(type === 'AdHoc' ? { startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T00:00:00.000Z' } : { periodType: 'Month' }), ...o.patch };
  if (o.reminder !== undefined) body.reminderDaysBeforeDue = o.reminder;
  const r = await api('POST', CAMP, body, ADM);
  if (r.status !== 200) throw new Error(`tạo kỳ lỗi ${r.status} ${r.message}`);
  if (!o.keep) mk.camps.push(r.data.id);
  if (o.orgs?.length) { const a = await putOrgs(r.data.id, o.orgs); if (a.status !== 200) throw new Error('phân công lỗi ' + a.message); }
  return await getCamp(r.data.id);
}
/** Kỳ đã Chờ phê duyệt (tạo + phân công + trình), không xóa được. */
async function mkSubmitted(kind: 'A' | 'P', name: string, nOrgs = 1) {
  const b = await base();
  const c = await mkCamp({ type: kind === 'A' ? 'AdHoc' : 'Periodic', name, orgs: [b.dp, b.bo, b.qa].slice(0, nOrgs), keep: true });
  const s = await submitApi(c.id); if (s.status !== 200) throw new Error('trình lỗi ' + s.message);
  return await getCamp(c.id);
}
const fxId: Record<string, string> = {};
/** Kỳ fixture xoay vòng: đưa về trạng thái `want` (Submitted | Rejected). */
async function fx(kind: 'A' | 'P', want: 'Submitted' | 'Rejected') {
  const name = `qc.automation CMP2 fixture ${kind}`, ok = ['Submitted', 'Rejected'];
  let c = fxId[kind] ? await getCamp(fxId[kind]) : null;
  if (!c || !ok.includes(c.status)) {
    const f = (await listApi(CAMP, name)).find((x: any) => x.name === name && ok.includes(x.status));
    c = f ? await getCamp(f.id) : await mkSubmitted(kind, name);
  }
  fxId[kind] = c.id;
  if (c.status !== want) {
    const r = want === 'Submitted' ? await submitApi(c.id) : await rejectApi(c.id);
    if (r.status !== 200) throw new Error(`đưa fixture ${kind} về ${want} lỗi: ${r.status} ${r.message}`);
  }
  return await getCamp(c.id);
}
const apprId: Record<string, string> = {};
/** Kỳ Đã phê duyệt dùng lại (A: 3 đơn vị, P: 1 đơn vị); chưa có thì tạo + phê duyệt. */
async function approvedFx(kind: 'A' | 'P') {
  if (!apprId[kind]) {
    const pre = `qc.automation CMP2 approved ${kind} `;
    const f = (await listApi(CAMP, pre.trim())).find((x: any) => x.name.startsWith(pre) && x.status === 'Approved');
    if (f) apprId[kind] = f.id;
    else {
      const c = await mkSubmitted(kind, nm(`approved ${kind} `), kind === 'A' ? 3 : 1);
      const r = await approveApi(c.id); if (r.status !== 200) throw new Error('phê duyệt lỗi ' + r.message);
      apprId[kind] = c.id;
    }
  }
  return await getCamp(apprId[kind]);
}
/** Chạy bằng tài khoản `key` (ngữ cảnh trình duyệt riêng) khi test cần xem giao diện của vai trò khác tác nhân. */
async function asUser<T>(browser: Browser, key: string, fn: (p: Page) => Promise<T>) {
  const ctx = await browser.newContext({ storageState: `auth/${key}.json` });
  try { return await fn(await ctx.newPage()); } finally { await ctx.close(); }
}

// ---------- Helper UI ----------
const content = (p: Page) => p.locator('.ant-layout-content').first();
const text = async (p: Page) => (await content(p).innerText()).replace(/\s+/g, ' ');
const BTN = (p: Page, re: RegExp | string) => p.getByRole('button', { name: re }).filter({ visible: true });
const hasBtn = async (p: Page, re: RegExp | string) => (await BTN(p, re).count()) > 0;
/** Mở danh sách đúng tab và tìm theo tên kỳ → trả dòng của kỳ. */
async function listRow(page: Page, c: { type: string; name: string }, status?: string) {
  await goto(page, 'self-assessment-campaigns');
  if (c.type === 'AdHoc') { await page.getByText('Đột xuất', { exact: true }).first().click(); await page.waitForTimeout(600); }
  await page.getByPlaceholder(/tìm/i).first().fill(c.name); await waitList(page);
  let rows = dataRows(page).filter({ hasText: c.name });
  if (status) rows = rows.filter({ hasText: status });
  await rows.first().waitFor({ state: 'visible', timeout: 10_000 });
  return rows.first();
}
/** Các mục menu thao tác của kỳ (dòng không có nút menu → rỗng, chỉ còn "Xem chi tiết"). */
const menuOf = async (page: Page, c: any, status?: string) => {
  const row = await listRow(page, c, status);
  return (await row.locator('button.ant-dropdown-trigger').count()) ? await rowMenuItems(page, row) : [];
};
async function openDetail(page: Page, id: string) {
  await goto(page, `self-assessment-campaigns/${id}`);
  const ready = () => page.getByText(new RegExp(`Mã kỳ\\s*TDG-`)).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (!(await ready())) { await page.reload({ waitUntil: 'networkidle' }); await ready(); }   // đổi id chỉ đổi hash → trang đôi khi không nạp lại
  await page.getByText('Lịch sử xử lý').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
}
/** Lịch sử xử lý (mới nhất ở trên): [{title, meta, note}] */
async function history(page: Page) {
  const items = page.locator('.ant-card').filter({ hasText: 'Lịch sử xử lý' }).last().locator('li.ant-timeline-item');
  return await items.evaluateAll(els => els.map(e => ({ title: (e.querySelector('strong')?.textContent ?? '').trim(), meta: (e.querySelectorAll('span.ant-typography')[1]?.textContent ?? '').trim(), note: (e.querySelector('.ant-card-body')?.textContent ?? '').trim() })));
}
const badge = async (p: Page) => (await text(p)).match(/(Nháp|Chờ phê duyệt|Đã phê duyệt|Bị từ chối)\s*Thông tin kỳ/)?.[1] ?? '';
const STATUS_VI: Record<string, string> = { Draft: 'Nháp', Submitted: 'Chờ phê duyệt', Approved: 'Đã phê duyệt', Rejected: 'Bị từ chối' };

/** Mở form "Cập nhật" của kỳ từ menu thao tác. */
async function reminderInDialog(page: Page, c: any) {
  await rowAction(page, await listRow(page, c), /^\s*cập nhật\s*$/i);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
  return d;
}

// ---------- Helper trang cấu hình bộ chỉ số (builder) ----------
async function openBuilder(page: Page, setId: string) {
  await goto(page, `self-assessment-campaigns/builder/${setId}`);
  await page.getByText(/Tổng điểm tối đa/).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
}
const builderTotal = async (p: Page) => (await text(p)).match(/Tổng điểm tối đa \(tính điểm\)\s*([\d.,]+)/)?.[1] ?? '';
const stat = async (p: Page, label: RegExp) => (await text(p)).match(label)?.[1] ?? '';
const saveGroups = async (p: Page) => { await p.getByRole('button', { name: /lưu nhóm/i }).click(); return await toast(p); };
const saveInds = async (p: Page) => { await p.getByRole('button', { name: /lưu chỉ số/i }).click(); return await toast(p); };
const indRow = (p: Page, code: string) => p.locator('tr').filter({ hasText: code }).filter({ has: p.locator('input') }).last();
const maxInput = (p: Page, code: string) => indRow(p, code).locator('input').nth(2);
const minInput = (p: Page, code: string) => indRow(p, code).locator('input').nth(1);
const parentScore = async (p: Page, code: string) => ((await p.locator('tr').filter({ has: p.getByText(code, { exact: true }) }).first().innerText()).replace(/\s+/g, ' ').match(/([\d.]+,\d)\s*$/)?.[1] ?? '');
const grpItem = (p: Page, code: string) => p.locator('div[aria-roledescription="sortable"]').filter({ hasText: code }).first();
async function dragGroupAbove(page: Page, code: string, aboveCode: string) {
  const bb = (await grpItem(page, code).locator('button').first().boundingBox())!, tb = (await grpItem(page, aboveCode).boundingBox())!;
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx, cy - ((bb.y - tb.y) + 5) * i / 10, { steps: 2 });
  await page.mouse.up(); await page.waitForTimeout(800);
}
const treeNode = (p: Page, code: string) => p.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-tree-treenode').filter({ hasText: code }).first();
async function openGroupModal(page: Page) {
  await page.getByRole('button', { name: /thêm nhóm/i }).click();
  const m = page.locator('.ant-modal').last(); await m.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return m;
}

// ================= K. CẤU HÌNH BỘ CHỈ SỐ / ĐIỂM / CẢNH BÁO ĐẾN HẠN =================
test.describe('Quản lý tự đánh giá › Cấu hình bộ chỉ số & điểm', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();

  test(tc('CMP-K06'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    for (const patch of [{ minScore: -1 }, { maxScore: -1 }]) {
      const r = await putInds(sid, indPatch(d, CH1, patch));
      expect(r.status, `${JSON.stringify(patch)} → HTTP ${r.status}: ${r.message}`).toBe(400);
      expect(r.message).toMatch(/phải nằm trong khoảng từ 0 đến 1000/);
    }
  });
  test(tc('CMP-K07'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    const ok = await putInds(sid, indPatch(d, CH1, { maxScore: 1000 }));
    expect(ok.status, `1000 phải được nhận: ${ok.message}`).toBe(200);
    expect(byCode(await getSet(sid), CH1).maxScore).toBe(1000);
    for (const v of [1001, 1e9]) {
      const r = await putInds(sid, indPatch(d, CH1, { maxScore: v }));
      expect(r.status, `${v} → HTTP ${r.status}: ${r.message}`).toBe(400);
      expect(r.message).toMatch(/phải nằm trong khoảng từ 0 đến 1000/);
    }
  });
  test(tc('CMP-K08'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    const r = await putInds(sid, indPatch(d, CH1, { maxScore: 2.5 }));
    if (r.status === 200) { const v = byCode(await getSet(sid), CH1).maxScore; expect([2, 2.5, 3], `điểm 2.5 được lưu thành ${v}`).toContain(v); }
    else expect(r.status, `2.5 bị từ chối: ${r.message}`).toBe(400);
  });
  test(tc('CMP-K09'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    for (const v of ['abc', null]) {
      const r = await putInds(sid, indPatch(d, CH1, { maxScore: v }));
      expect(r.status, `maxScore=${JSON.stringify(v)} → HTTP ${r.status}: ${r.message}`).toBe(400);
    }
  });
  test(tc('CMP-K20'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    const g = await putGrps(sid, [...grpBody(d), grpBody(d)[0]]);
    expect([g.status, g.message], 'nhóm trùng').toEqual([400, expect.stringMatching(/Danh sách nhóm chỉ số bị trùng lặp/)]);
    const i = await putInds(sid, [...indBody(d), indBody(d)[1]]);
    expect([i.status, i.message], 'chỉ số trùng').toEqual([400, expect.stringMatching(/Danh sách chỉ số bị trùng lặp/)]);
  });
  test(tc('CMP-K21'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    const g = await putGrps(sid, [{ ...grpBody(d)[0], indicatorGroupId: FAKE }]);
    expect([g.status, g.message]).toEqual([400, expect.stringMatching(/Có nhóm chỉ số không hợp lệ trong danh sách/)]);
    const i = await putInds(sid, [{ ...indBody(d)[0], indicatorId: FAKE }]);
    expect([i.status, i.message]).toEqual([400, expect.stringMatching(/Có chỉ số không hợp lệ trong danh sách/)]);
  });
  test(tc('CMP-K22'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    const r = await putGrps(sid, []);
    const d = await getSet(sid);
    expect(r.status === 400 || d.groups.length > 0, `bộ chỉ số của kỳ bị xóa hết nhóm (HTTP ${r.status}, còn ${d.groups.length} nhóm / ${flat(d).length} chỉ số)`).toBeTruthy();
  });
  test(tc('CMP-K24'), async () => {
    const a = await mkCamp(), b = await mkCamp();
    expect(a.originalIndicatorSetId).toBe(b.originalIndicatorSetId); expect(a.indicatorSetId).not.toBe(b.indicatorSetId);
    const d = await getSet(a.indicatorSetId);
    expect((await putInds(a.indicatorSetId, indPatch(d, CH1, { maxScore: 5 }))).status).toBe(200);
    expect(byCode(await getSet(a.indicatorSetId), CH1).maxScore).toBe(5);
    expect(byCode(await getSet(b.indicatorSetId), CH1).maxScore, 'bản sao của kỳ B giữ nguyên').toBe(2);
  });
  test(tc('CMP-K27'), async () => {
    const c = await approvedFx('A'); const sid = c.indicatorSetId; const d = await getSet(sid);
    const r = await putInds(sid, indPatch(d, CH1, { maxScore: d && byCode(d, CH1).maxScore + 1 }));
    const now = await getSet(sid);
    if (r.status === 200) await putInds(sid, indBody(d));
    expect([400, 403], `bị từ chối (đặc tả 403; hệ thống có thể trả 400 báo bộ đã khóa): HTTP ${r.status} ${r.message}`).toContain(r.status);
    expect(byCode(now, CH1).maxScore, 'dữ liệu giữ nguyên').toBe(byCode(d, CH1).maxScore);
  });
  test(tc('CMP-K29'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    for (const as of ['lanhdaobo', 'xemonly', 'ldd']) {
      const i = await putInds(sid, indPatch(d, CH1, { maxScore: 9 }), as), g = await putGrps(sid, grpBody(d).slice(0, 3), as);
      expect([i.status, g.status], `${as}: ${i.message} / ${g.message}`).toEqual([403, 403]);
      expect(i.message).toMatch(FORB);
    }
    const now = await getSet(sid);
    expect([byCode(now, CH1).maxScore, now.groups.length], 'dữ liệu giữ nguyên').toEqual([2, 4]);
  });
  test(tc('CMP-K32'), async ({ page }) => {
    const r = await api('GET', `${SETS}/${FAKE}`, undefined, ADM);
    expect(r.status, `GET bộ chỉ số lạ → HTTP ${r.status}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    await goto(page, `self-assessment-campaigns/builder/${FAKE}`); await page.waitForTimeout(1500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toMatch(/stack ?trace|exception|at com\.|undefined|cannot read/);
    expect((await content(page).innerText()).trim().length, 'trang không được trắng').toBeGreaterThan(0);
    expect(await text(page) + ' ' + (await page.locator('.ant-message-notice, .ant-notification-notice, .ant-result').allInnerTexts()).join(' '), 'phải báo không tìm thấy').toMatch(/không tìm thấy|không tồn tại|not found/i);
  });

  // ----- Cảnh báo đến hạn -----
  /** Tạo kỳ Đột xuất qua form "Thêm mới tự đánh giá"; trả id (đã đăng ký dọn). */
  async function uiCreate(page: Page, name: string, reminder?: string) {
    await goto(page, 'self-assessment-campaigns');
    await page.getByRole('button', { name: /thêm mới tự đánh giá/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' });
    await d.locator('#name').fill(name);
    await pickByLabel(page, d, /phân loại đánh giá/i, 'Đột xuất');
    await pickByLabel(page, d, /bộ chỉ số/i, 'Tên Bộ Chỉ Số QC');
    await d.locator('#startDate').fill('01/11/2026'); await page.keyboard.press('Enter');
    await d.locator('#endDate').fill('30/11/2026'); await page.keyboard.press('Enter');
    if (reminder) await d.locator('#reminderDaysBeforeDue').fill(reminder);
    await pickByLabel(page, d, /thang xếp loại/i, 'Thang xếp loại mặc định');
    const [res] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/self-assessment-campaigns') && r.request().method() === 'POST'), d.locator('button', { hasText: /Thêm mới tự đánh giá/ }).last().click()]);
    const j = await res.json().catch(() => ({}));
    if (j?.data?.id) mk.camps.push(j.data.id);
    expect(res.status(), `tạo kỳ: ${j?.message}`).toBe(200);
    return j.data.id as string;
  }
  test(tc('CMP-K34'), async ({ page }) => {
    const c = await mkCamp({ reminder: 3 });
    const d = await reminderInDialog(page, c);
    expect(await d.locator('#reminderDaysBeforeDue').inputValue()).toBe('3');
    await d.locator('#reminderDaysBeforeDue').fill('5');
    await d.locator('button', { hasText: /^\s*Lưu\s*$/ }).last().click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await getCamp(c.id)).reminderDaysBeforeDue).toBe(5);
    const d2 = await reminderInDialog(page, c);
    expect(await d2.locator('#reminderDaysBeforeDue').inputValue(), 'hiển thị 5 khi tải lại').toBe('5');
  });
  test(tc('CMP-K36'), async ({ page }) => {
    const c = await mkCamp();
    const d = await reminderInDialog(page, c); const inp = d.locator('#reminderDaysBeforeDue');
    const got: Record<string, string> = {};
    for (const v of ['-1', '0', '1.5', '1000', 'abc']) { await inp.fill(''); await inp.pressSequentially(v); await d.locator('#name').click(); await page.waitForTimeout(250); got[v] = await inp.inputValue(); }
    expect([got['-1'], got['0'], got['1000'], got['abc']], JSON.stringify(got)).toEqual(['1', '1', '365', '']);
    expect(got['1.5'] === '' || (Number(got['1.5']) >= 1 && Number(got['1.5']) <= 365), `1.5 → "${got['1.5']}"`).toBeTruthy();
  });
  const badReminder = async (v: any) => {
    const b = await base();
    const r = await api('POST', CAMP, { name: nm(), type: 'AdHoc', indicatorSetId: b.setId, scaleId: b.scaleId, startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T00:00:00.000Z', reminderDaysBeforeDue: v }, ADM);
    if (r.data?.id) mk.camps.push(r.data.id);
    return r;
  };
  test(tc('CMP-K37'), async () => {
    const bad: string[] = [];
    for (const v of [-1, 0]) { const r = await badReminder(v); if (r.status !== 400) bad.push(`${v} → HTTP ${r.status}`); }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-K38'), async () => {
    const r = await badReminder(1000);
    expect(r.status, `1000 → HTTP ${r.status}: ${r.message}`).toBe(400);
  });
  test(tc('CMP-K39'), async () => {
    const bad: string[] = [];
    for (const v of [1.5, 'abc']) { const r = await badReminder(v); if (r.status !== 400 || !/không hợp lệ/i.test(r.message)) bad.push(`${JSON.stringify(v)} → HTTP ${r.status}: ${r.message}`); }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-K40'), async () => {
    const r = await badReminder(60);   // kỳ Đột xuất 01–30/11 (30 ngày)
    expect(r.status, `nhắc trước 60 ngày cho kỳ 30 ngày → HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400);
  });
});

// ================= U. PHÂN CÔNG ĐƠN VỊ =================
const UNIT_CODES = ['QC_DP', 'QC_BO', 'TTCDST-QA01'];   // đơn vị thử đã khóa (hiện trong modal)
const dRows = (d: Locator) => d.locator('tbody tr.ant-table-row');
const dFooter = async (d: Locator) => (await d.innerText()).match(/Đã chọn \d+ đơn vị|Chưa chọn đơn vị nào/)?.[0] ?? '';
const dTotal = async (d: Locator) => Number((await d.innerText()).replace(/\s+/g, ' ').match(/trong (\d+) bản ghi/)?.[1] ?? await dRows(d).count());
const dSave = (d: Locator) => d.locator('button', { hasText: /^\s*Lưu\s*$/ }).last();
async function dSearch(page: Page, d: Locator, kw: string) { await d.getByPlaceholder(/tìm theo mã/i).fill(kw); await page.waitForTimeout(1300); }
async function dTick(page: Page, d: Locator, code: string, on = true) {
  await dSearch(page, d, code);
  const cb = dRows(d).filter({ hasText: code }).first().locator('input[type=checkbox]');
  await (on ? cb.check() : cb.uncheck());
}
async function openAssign(page: Page, c: any) {
  await openDetail(page, c.id);
  await BTN(page, /^\s*Phân công đơn vị\s*$/).first().click();
  const d = dlg(page); await d.getByText(/Chọn các đơn vị/).waitFor({ timeout: 10_000 });
  await dRows(d).first().waitFor({ timeout: 10_000 }); await page.waitForTimeout(500);
  return d;
}
const unitTile = async (p: Page) => (await text(p)).match(/Số đơn vị\s*(\d+)/)?.[1] ?? '';
async function saveAssign(page: Page, d: Locator) { await dSave(d).click(); return await toast(page); }
const orgsOf = async (id: string) => orgIds(await getCamp(id));
const lockedOrgs = async (kw = '') => (await api('GET', `organizations?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ isLocked: true, permissionCode: 'DTI_CAMPAIGN.UPDATE', ...(kw ? { keyword: kw, fullTextSearch: kw } : {}) }))}`, undefined, ADM)).data;

test.describe('Quản lý tự đánh giá › Phân công đơn vị', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();

  async function checkModal(page: Page, c: any) {
    const d = await openAssign(page, c);
    const t = await d.innerText();
    expect(t).toContain(`Phân công đơn vị – ${c.name}`);
    await expect(d.getByPlaceholder(/tìm theo mã, tên đơn vị/i)).toBeVisible();
    expect(t).toMatch(/Tất cả loại đơn vị/); expect(t).toMatch(/Tất cả tỉnh\/thành/);
    const heads = (await d.locator('thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean).join('|');
    for (const re of [/STT/i, /Mã đơn vị/i, /Tên đơn vị/i, /Loại đơn vị/i, /Tỉnh\/thành tham chiếu/i]) expect(heads, `thiếu cột ${re}`).toMatch(re);
    expect(t.replace(/\s+/g, ' ')).toMatch(/Hiển thị 1-\d+ trong \d+ bản ghi/);
    await expect(d.locator('.ant-pagination')).toBeVisible();
    expect(await dFooter(d)).toBe('Chưa chọn đơn vị nào');
    expect(await dRows(d).count()).toBeGreaterThan(0);
  }
  test(tc('CMP-U17'), async () => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp, b.bo] });
    const r = await putOrgs(c.id, []); const now = await orgsOf(c.id);
    expect((r.status === 200 && now.length === 0) || (r.status === 400 && now.length === 2), `HTTP ${r.status} ${r.message}; còn ${now.length} đơn vị`).toBeTruthy();
  });
  test(tc('CMP-U18'), async () => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp] });
    const r = await putOrgs(c.id, [b.bo, b.bo]);
    expect([r.status, r.message]).toEqual([400, expect.stringMatching(/Danh sách đơn vị bị trùng lặp/)]);
    expect(await orgsOf(c.id), 'phân công cũ giữ nguyên').toEqual([b.dp]);
  });
  test(tc('CMP-U19'), async () => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp] });
    const r = await putOrgs(c.id, [FAKE]);
    expect([r.status, r.message]).toEqual([400, expect.stringMatching(/Có đơn vị không hợp lệ trong danh sách/)]);
    expect(await orgsOf(c.id)).toEqual([b.dp]);
  });
  test(tc('CMP-U20'), async () => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp, b.bo] });
    const r = await putOrgs(c.id, { a: 1 }); const now = await orgsOf(c.id);
    expect(r.status, `body {"a":1} → HTTP ${r.status} ${r.message}; còn ${now.length}/2 đơn vị`).toBe(400);
    expect(now, 'phân công cũ giữ nguyên').toHaveLength(2);
  });
  test(tc('CMP-U24'), async () => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp] });
    for (const as of ['lanhdaobo', 'xemonly', 'ldd']) {
      const r = await putOrgs(c.id, [b.bo], as);
      expect([r.status, r.message], as).toEqual([403, expect.stringMatching(FORB)]);
    }
    expect(await orgsOf(c.id), 'phân công không đổi').toEqual([b.dp]);
  });
  test(tc('CMP-U25'), async () => {
    const b = await base();
    const r = await putOrgs(FAKE, [b.dp]);
    expect(r.status).toBe(404); expect(r.message).toMatch(/Không tìm thấy kỳ tự đánh giá/);
  });

  // ----- Xuất Excel danh sách đơn vị -----
  const exportBtn = (p: Page) => BTN(p, /xuất excel/i);
});

// ================= T. TRÌNH PHÊ DUYỆT =================
const TRINH = 'Trình phê duyệt';
const today = () => { const d = new Date(Date.now() + 7 * 3600_000); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
/** Bấm "Trình phê duyệt" ở chi tiết rồi trả lời hộp xác nhận. */
async function uiSubmit(page: Page, c: any, answer: 'Có' | 'Không' = 'Có') {
  await openDetail(page, c.id);
  await BTN(page, /^\s*Trình phê duyệt\s*$/).first().click();
  await page.locator('.ant-modal-confirm-title').filter({ hasText: /muốn trình phê duyệt/ }).waitFor({ timeout: 8000 });
  if (answer === 'Không') { await confirmNo(page); return ''; }
  await confirmYes(page);
  return await toast(page);
}
const statusOf = async (id: string) => (await getCamp(id)).status as string;

test.describe('Quản lý tự đánh giá › Trình phê duyệt', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();

  // Kỳ đã trình không xóa được → T01/T02/T19/T20... dùng kỳ fixture đang Bị từ chối (trình lại), không sinh thêm kỳ rác
  test(tc('CMP-T09'), async () => {
    const c = await approvedFx('A');
    const r = await submitApi(c.id); const n = await getCamp(c.id);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    expect(n.status).toBe('Approved'); expect(n.submittedDate).toBe(c.submittedDate);
  });
  test(tc('CMP-T10'), async () => {
    const r = await submitApi(FAKE);
    expect(r.status).toBe(404); expect(r.message).toMatch(/Không tìm thấy kỳ tự đánh giá/);
  });
  test(tc('CMP-T18'), async () => {
    const c = await fx('A', 'Rejected');
    const r = await submitApi(c.id); const n = await getCamp(c.id);
    expect((r.status === 200 && n.status === 'Submitted') || (r.status === 400 && n.status === 'Rejected'), `HTTP ${r.status} ${r.message}; trạng thái ${n.status}`).toBeTruthy();
  });
});

// ================= A. PHÊ DUYỆT / TỪ CHỐI (tác nhân: Lãnh đạo Bộ) =================
const PHE_DUYET = /^\s*phê duyệt\s*$/i, TU_CHOI = /^\s*từ chối\s*$/i;
const resultsOf = async (c: any, as = LDB) => ((await api('GET', `dti/assessment-results?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ keyword: c.name }))}`, undefined, as)).data?.content ?? []).filter((x: any) => x.campaignId === c.id);
/** Mở hộp "Từ chối" của kỳ ở danh sách (Lãnh đạo). */
async function openReject(page: Page, c: any) {
  await rowAction(page, await listRow(page, c, 'Chờ phê duyệt'), TU_CHOI);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(400); return d;
}
const doReject = async (page: Page, d: Locator) => { await d.locator('button', { hasText: /đồng ý/i }).last().click(); };
const MENU_EDIT = [/cập nhật/i, /^xo[áa]$/i, /phân công/i, /trình phê duyệt/i, /cấu hình bộ chỉ số/i];

test.describe('Quản lý tự đánh giá › Phê duyệt / Từ chối', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();

  // Mỗi lần chạy CMP-A01/A02 phê duyệt 1 kỳ mới (không xóa được); các test khác dùng lại kỳ Đã phê duyệt có sẵn
  test(tc('CMP-A01'), async ({ page }) => {
    const c = await mkSubmitted('A', nm('approved A '), 3);
    await rowAction(page, await listRow(page, c, 'Chờ phê duyệt'), PHE_DUYET); await confirmYes(page);
    expect(await toast(page)).toMatch(/Phê duyệt thành công/);
    const n = await getCamp(c.id, LDB);
    expect(n.status).toBe('Approved'); expect(n.approvedByUserName).toBe('QC Lãnh đạo Bộ'); expect(n.approvedDate).toBeTruthy();
    apprId.A = c.id;
    expect(await menuOf(page, c, 'Đã phê duyệt'), 'menu thao tác biến mất').toEqual([]);
  });
  test(tc('CMP-A02'), async ({ page }) => {
    const c = await mkSubmitted('P', nm('approved P '), 1);
    await rowAction(page, await listRow(page, c, 'Chờ phê duyệt'), PHE_DUYET); await confirmYes(page);
    expect(await toast(page)).toMatch(/Phê duyệt thành công/);
    const n = await getCamp(c.id, LDB);
    expect(n.status).toBe('Approved'); expect(n.approvedDate, 'ngày duyệt được ghi').toBeTruthy();
    apprId.P = c.id;
  });
  test(tc('CMP-A08'), async () => {
    const c = await approvedFx('A'); const n0 = (await resultsOf(c)).length;
    const r = await approveApi(c.id); const n = await getCamp(c.id, LDB);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    expect([n.status, n.approvedDate, (await resultsOf(c)).length], 'không đổi / không tạo thêm kết quả').toEqual(['Approved', c.approvedDate, n0]);
  });
  test(tc('CMP-A09'), async () => {
    const b = await base(); const draft = await mkCamp({ orgs: [b.dp] }); const rej = await fx('A', 'Rejected'); const bad: string[] = [];
    for (const [name, c] of [['Nháp', draft], ['Bị từ chối', rej]] as const) {
      const r = await approveApi(c.id);
      if (r.status < 400 || r.status >= 500) bad.push(`${name}: HTTP ${r.status} ${r.message}`);
      const now = (await getCamp(c.id, LDB)).status; if (now !== c.status) bad.push(`${name}: trạng thái đổi ${c.status} → ${now}`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-A10'), async () => {
    const r = await approveApi(FAKE);
    expect(r.status).toBe(404); expect(r.message).toMatch(/Không tìm thấy kỳ tự đánh giá/);
  });
  test(tc('CMP-A14'), async ({ browser }) => {
    const c = await approvedFx('A'); const bad: string[] = [];
    for (const k of ['canbo', LDB, ADM]) {
      const items = await asUser(browser, k, p => menuOf(p, c, 'Đã phê duyệt'));
      if (items.length) bad.push(`${k}: menu [${items.join(', ')}]`);
      const act = ((await getCamp(c.id, k)).allowedActions as string[]).filter(a => ['UPDATE', 'DELETE', 'APPROVE'].includes(a));
      if (act.length) bad.push(`${k}: allowedActions có ${act.join(',')}`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-A22'), async () => {
    const b = await base(); const bad: string[] = [];
    const cs = [['Đã phê duyệt', await approvedFx('A')], ['Bị từ chối', await fx('A', 'Rejected')], ['Nháp', await mkCamp({ orgs: [b.dp] })]] as const;
    for (const [name, c] of cs) {
      const r = await rejectApi(c.id, 'qc.automation CMP2 A22');
      if (r.status < 400 || r.status >= 500) bad.push(`${name}: HTTP ${r.status} ${r.message}`);
      const now = (await getCamp(c.id, LDB)).status; if (now !== c.status) bad.push(`${name}: trạng thái đổi ${c.status} → ${now}`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-A23'), async () => {
    const r = await rejectApi(FAKE, 'x');
    expect(r.status).toBe(404); expect(r.message).toMatch(/Không tìm thấy kỳ tự đánh giá/);
  });
  test(tc('CMP-A25'), async ({ page, browser }) => {
    const c = await fx('A', 'Rejected'); const bad: string[] = [];
    const ld = await menuOf(page, c, 'Bị từ chối');
    if (ld.length) bad.push(`Lãnh đạo còn thao tác [${ld.join(', ')}]`);
    const cb = await asUser(browser, 'canbo', p => menuOf(p, c, 'Bị từ chối'));
    for (const re of [/cấu hình bộ chỉ số/i, /phân công đơn vị/i, /trình phê duyệt/i, /cập nhật/i]) if (!cb.some(i => re.test(i))) bad.push(`Cán bộ thiếu ${re} (có [${cb.join(', ')}])`);
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-A26'), async () => {
    const c = await fx('A', 'Rejected'); const bad: string[] = [];
    for (const as of ['cbdp', 'ldp', 'ldd']) { const rs = await resultsOf(c, as); if (rs.length) bad.push(`${as} thấy ${rs.length} kết quả của kỳ bị từ chối`); }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-A28'), async () => {
    // kỳ riêng (không dùng fixture xoay vòng vì bên thắng thường là "Phê duyệt" → kỳ không còn dùng lại được); tên theo mẫu "approved A" để tái dùng nếu được duyệt
    const c = await mkSubmitted('A', nm('approved A '), 3);
    const [a, r] = await Promise.all([approveApi(c.id), rejectApi(c.id, 'qc.automation CMP2 A28')]);
    const n = await getCamp(c.id, LDB);
    expect([a.status, r.status].filter(s => s === 200), `approve ${a.status} ${a.message}; reject ${r.status} ${r.message}`).toHaveLength(1);
    expect(n.status, 'trạng thái cuối khớp request thắng').toBe(a.status === 200 ? 'Approved' : 'Rejected');
  });
});
