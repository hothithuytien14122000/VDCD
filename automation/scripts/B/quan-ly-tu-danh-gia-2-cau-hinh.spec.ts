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

  test(tc('CMP-K01'), async ({ page }) => {
    const c = await mkCamp();
    await rowAction(page, await listRow(page, c), /cấu hình bộ chỉ số/i);
    await page.getByText(/Tổng điểm tối đa/).first().waitFor({ timeout: 15_000 }); await page.waitForTimeout(800);
    expect(page.url()).toContain(`builder/${c.indicatorSetId}`);
    const t = await text(page);
    for (const s of ['Nhóm chỉ số', 'Chỉ số', 'Tổng điểm tối đa (tính điểm)', 'Cần kiểm tra', 'Nhóm chỉ số trong bộ']) expect(t, `thiếu "${s}"`).toContain(s);
    for (const g of ['TEST_N01', 'TEST_N02', 'TEST_N03', 'TEST_N04']) await expect(grpItem(page, g)).toBeVisible();
    expect(await indRow(page, CH1).count(), 'bảng chỉ số của nhóm đang chọn').toBeGreaterThan(0);
  });
  test(tc('CMP-K02'), async ({ page }) => {
    const c = await mkCamp();
    await openDetail(page, c.id);
    await BTN(page, /^\s*Xem cấu hình điểm\s*$/).first().click();
    await page.getByText(/Tổng điểm tối đa/).first().waitFor({ timeout: 15_000 });
    expect(page.url()).toContain(`builder/${c.indicatorSetId}`);
    expect(c.indicatorSetCode).toMatch(/^MBCS_QC01_[0-9a-f]{8}$/);
    await expect(content(page), 'trang cấu hình hiển thị mã bản sao của kỳ').toContainText(c.indicatorSetCode, { timeout: 10_000 });
    expect(c.indicatorSetId, 'bản sao khác bộ gốc').not.toBe(c.originalIndicatorSetId);
  });
  test(tc('CMP-K03'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    expect(await maxInput(page, CH1).inputValue()).toBe('2');
    expect(await builderTotal(page)).toBe('200,0'); expect(await parentScore(page, PAR1)).toBe('10,0');
    await maxInput(page, CH1).fill('3');
    expect(await saveInds(page)).toMatch(/Cập nhật nội dung bộ chỉ số thành công/);
    expect(byCode(await getSet(sid), CH1).maxScore).toBe(3);
    await page.reload(); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1000);
    expect(await maxInput(page, CH1).inputValue(), 'tải lại vẫn 3').toBe('3');
    expect(await parentScore(page, PAR1), 'điểm chỉ số cha tăng 1').toBe('11,0');
    expect(await builderTotal(page), 'tổng điểm tối đa tăng 1').toBe('201,0');
  });
  test(tc('CMP-K04'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await minInput(page, CH1).fill('1');
    expect(await saveInds(page)).toMatch(/thành công/i);
    expect(byCode(await getSet(sid), CH1).minScore).toBe(1);
    await page.reload(); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1000);
    expect(await minInput(page, CH1).inputValue()).toBe('1');
  });
  test(tc('CMP-K05'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    const r = await putInds(sid, indPatch(d, CH1, { minScore: 5, maxScore: 3 }));
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect(r.message).toMatch(/Điểm tối thiểu không được lớn hơn điểm tối đa \(chỉ số/);
    const after = byCode(await getSet(sid), CH1);
    expect([after.minScore, after.maxScore], 'dữ liệu giữ nguyên').toEqual([0, 2]);
    await openBuilder(page, sid);
    expect(await stat(page, /Cần kiểm tra\s*(\d+)/)).toBe('0');
  });
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
  test(tc('CMP-K10'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    const r = await putInds(sid, indPatch(d, CH1, { weight: -1 }));
    expect(r.status, `weight=-1 → HTTP ${r.status}: ${r.message}`).toBe(400);
  });
  test(tc('CMP-K11'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await indRow(page, CH1).locator('[role=switch]').click(); await page.waitForTimeout(400);
    expect(await saveInds(page)).toMatch(/thành công/i);
    expect(byCode(await getSet(sid), CH1).isScored).toBe(false);
    await page.reload(); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1000);
    expect(await builderTotal(page), 'tổng điểm tối đa giảm 2').toBe('198,0');
    expect(await stat(page, /(\d+) chỉ số không tính điểm/), '"chỉ số không tính điểm" tăng 1').toBe('1');
    expect(await parentScore(page, PAR1), 'chỉ số cha cộng lại theo con còn tính').toBe('8,0');
  });
  test(tc('CMP-K12'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await grpItem(page, 'TEST_N01').click(); await page.waitForTimeout(500);
    await page.locator('[role=switch]').first().click(); await page.waitForTimeout(400);
    expect(await saveGroups(page)).toMatch(/thành công/i);
    expect((await getSet(sid)).groups.find((g: any) => g.indicatorGroupCode === 'TEST_N01').isScored).toBe(false);
    await page.reload(); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1000);
    expect(await builderTotal(page), 'giảm bằng điểm của nhóm (50)').toBe('150,0');
    expect(await stat(page, /(\d+) nhóm không tính điểm/)).toBe('1');
    await grpItem(page, 'TEST_N01').click(); await page.waitForTimeout(400);
    expect(await page.locator('[role=switch]').first().getAttribute('aria-checked'), 'tải lại vẫn tắt').toBe('false');
  });
  test(tc('CMP-K13'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await maxInput(page, CH1).fill('3');
    expect(await parentScore(page, PAR1), 'chỉ số cha tự cộng ngay trên giao diện').toBe('11,0');
    expect(await saveInds(page)).toMatch(/thành công/i);
    await page.reload(); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1000);
    expect(await parentScore(page, PAR1)).toBe('11,0');
    expect(await grpItem(page, 'TEST_N01').innerText()).toMatch(/51,0 điểm/);
    expect(await builderTotal(page)).toBe('201,0');
  });
  test(tc('CMP-K14'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await minInput(page, CH1).fill('5'); await maxInput(page, CH1).fill('3'); await page.waitForTimeout(500);
    expect(await stat(page, /Cần kiểm tra\s*(\d+)/), 'ô "Cần kiểm tra" đếm chỉ số min > max').toBe('1');
    const msg = await saveInds(page);
    const after = byCode(await getSet(sid), CH1);
    expect(/thành công/i.test(msg) && after.minScore === 5, `không được lưu chỉ số min > max (thông báo "${msg}", dữ liệu ${after.minScore}-${after.maxScore})`).toBeFalsy();
    expect(msg, 'phải báo lỗi rõ ràng').toMatch(/lỗi|không|tối thiểu|tối đa|kiểm tra/i);
  });
  test(tc('CMP-K15'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await dragGroupAbove(page, 'TEST_N04', 'TEST_N01');
    expect(await saveGroups(page)).toMatch(/Cập nhật cấu trúc bộ chỉ số thành công/);
    const order = (d: any) => d.groups.slice().sort((a: any, b: any) => a.displayOrder - b.displayOrder).map((g: any) => g.indicatorGroupCode);
    expect(order(await getSet(sid))).toEqual(['TEST_N04', 'TEST_N01', 'TEST_N02', 'TEST_N03']);
    await page.reload(); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1000);
    const codes = await page.locator('div[aria-roledescription="sortable"]').evaluateAll(els => els.map(e => (e.textContent ?? '').match(/TEST_N0\d/)?.[0]));
    expect(codes).toEqual(['TEST_N04', 'TEST_N01', 'TEST_N02', 'TEST_N03']);
  });
  test(tc('CMP-K16'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await grpItem(page, 'TEST_N04').locator('button[title*="Xóa"]').click(); await confirmYes(page);
    expect(await saveGroups(page)).toMatch(/thành công/i);
    expect((await getSet(sid)).groups).toHaveLength(3);
    const m = await openGroupModal(page);
    await m.getByPlaceholder(/tìm theo mã/i).fill('TEST_N04'); await page.waitForTimeout(1300);
    const rows = m.locator('tbody tr.ant-table-row');
    await expect(rows, 'nhóm đã xóa phải chọn lại được').toHaveCount(1);
    await rows.first().locator('input[type=checkbox]').check();
    await m.getByRole('button', { name: /^\s*Lưu\s*$/ }).click(); await page.waitForTimeout(800);
    expect(await saveGroups(page)).toMatch(/thành công/i);
    const d = await getSet(sid);
    expect(d.groups.map((g: any) => g.indicatorGroupCode)).toContain('TEST_N04');
    expect(await stat(page, /Nhóm chỉ số\s*(\d+)/), 'số nhóm cập nhật').toBe('4');
    expect(await builderTotal(page), 'tổng điểm cập nhật').toBe(`${totalScore(d).toFixed(1).replace('.', ',')}`);
  });
  test(tc('CMP-K17'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await grpItem(page, 'TEST_N04').locator('button[title*="Xóa"]').click(); await confirmYes(page);
    expect(await saveGroups(page)).toMatch(/thành công/i);
    await page.reload(); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1000);
    expect(await stat(page, /Nhóm chỉ số\s*(\d+)/)).toBe('3');
    expect(await stat(page, /Chỉ số\s*(\d+)\s*\d+ chỉ số không tính điểm/), 'số chỉ số 120 → 90').toBe('90');
    expect(await builderTotal(page), 'tổng điểm giảm 50').toBe('150,0');
    const orig = await getSet(c.originalIndicatorSetId);
    expect([orig.groups.length, flat(orig).length], 'bộ gốc giữ nguyên').toEqual([4, 120]);
  });
  test(tc('CMP-K18'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const d = await getSet(sid);
    const gone = byCode(d, CH1).indicatorId;
    expect((await putInds(sid, indBody(d).filter((o: any) => o.indicatorId !== gone))).status).toBe(200);
    await openBuilder(page, sid);
    expect(await indRow(page, CH1).count()).toBe(0);
    await page.locator('.ant-select').filter({ hasText: /chọn chỉ số/i }).first().click(); await page.waitForTimeout(600);
    await treeNode(page, CH1).locator('.ant-select-tree-checkbox').click();
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.getByRole('button', { name: /thêm mới chỉ số/i }).click(); await page.waitForTimeout(500);
    await expect(indRow(page, CH1), 'chỉ số xuất hiện lại trong bảng').toHaveCount(1);
    await indRow(page, CH1).locator('input').nth(0).fill('1');   // chỉ số thêm mới có trọng số mặc định 0 → đặt lại 1 để tính điểm
    expect(await saveInds(page)).toMatch(/thành công/i);
    expect(flat(await getSet(sid)).map((i: any) => i.indicatorCode)).toContain(CH1);
    expect(await builderTotal(page), 'tổng điểm cập nhật').toBe('200,0');
  });
  test(tc('CMP-K19'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await indRow(page, CH1).locator('.anticon-delete').first().click(); await page.waitForTimeout(500);
    if (await page.locator('.ant-modal-confirm, .ant-popover').count()) await confirmYes(page);
    expect(await saveInds(page)).toMatch(/thành công/i);
    const d = await getSet(sid);
    expect(flat(d)).toHaveLength(119); expect(byCode(d, CH1)).toBeUndefined();
    await page.reload(); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1000);
    expect(await builderTotal(page), 'tổng điểm giảm đúng điểm chỉ số').toBe('198,0');
    const orig = await getSet(c.originalIndicatorSetId);
    expect([flat(orig).length, totalScore(orig)], 'bộ gốc không đổi').toEqual([120, 200]);
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
  test(tc('CMP-K23'), async () => {
    const c = await mkCamp(); const sid = c.indicatorSetId; const o = c.originalIndicatorSetId;
    const snap = async () => { const d = await getSet(o); return [d.status, d.groups.length, flat(d).length, totalScore(d), flat(d).map((i: any) => `${i.indicatorCode}:${i.minScore}-${i.maxScore}`).join()]; };
    const before = await snap(); expect(before.slice(0, 4)).toEqual(['Locked', 4, 120, 200]);
    const d = await getSet(sid);
    expect((await putInds(sid, indPatch(d, CH1, { minScore: 1, maxScore: 5 }))).status).toBe(200);
    const d2 = await getSet(sid);
    expect((await putGrps(sid, grpBody(d2).slice(0, 3))).status).toBe(200);
    expect(await getSet(sid).then(x => x.groups.length), 'bản sao đã đổi').toBe(3);
    expect(await snap(), 'bộ gốc giữ nguyên').toEqual(before);
  });
  test(tc('CMP-K24'), async () => {
    const a = await mkCamp(), b = await mkCamp();
    expect(a.originalIndicatorSetId).toBe(b.originalIndicatorSetId); expect(a.indicatorSetId).not.toBe(b.indicatorSetId);
    const d = await getSet(a.indicatorSetId);
    expect((await putInds(a.indicatorSetId, indPatch(d, CH1, { maxScore: 5 }))).status).toBe(200);
    expect(byCode(await getSet(a.indicatorSetId), CH1).maxScore).toBe(5);
    expect(byCode(await getSet(b.indicatorSetId), CH1).maxScore, 'bản sao của kỳ B giữ nguyên').toBe(2);
  });
  test(tc('CMP-K25'), async () => {
    // bộ chỉ số riêng (không đụng bộ MBCS_QC01 dùng chung): A tạo trước, mở khóa và sửa bộ gốc, B tạo sau
    const pillar = await ensurePillar(made);
    const g = await ensureGroup(made, { pillarId: pillar.id });
    const par = await ensureIndicator(made, { groupId: g.id, pillarId: pillar.id, max: 10, lock: true });
    const child = await ensureIndicator(made, { groupId: g.id, pillarId: pillar.id, parentId: par.id, max: 5, lock: true });
    const code = code8();
    const s = await api('POST', SETS, { code, name: `qc.automation Bộ ${code}`, effectiveYear: 2026 }); expect(s.status).toBe(200);
    mk.sets.push(s.data.id);
    const ib = (max: number) => [{ indicatorId: par.id, weight: 0, isScored: true, minScore: 0, maxScore: 10, displayOrder: 1 }, { indicatorId: child.id, weight: 1, isScored: true, minScore: 0, maxScore: max, displayOrder: 2 }];
    expect((await putGrps(s.data.id, [{ indicatorGroupId: g.id, displayOrder: 1, isScored: true }])).status).toBe(200);
    expect((await putInds(s.data.id, ib(5))).status).toBe(200);
    expect((await api('POST', `${SETS}/${s.data.id}/lock`, {})).status).toBe(200);
    const b = await base();
    const mkC = async () => { const r = await api('POST', CAMP, { name: nm(), type: 'AdHoc', indicatorSetId: s.data.id, scaleId: b.scaleId, startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T00:00:00.000Z' }, ADM); expect(r.status, r.message).toBe(200); mk.camps.push(r.data.id); return r.data; };
    const A = await mkC();
    const un = await api('POST', `${SETS}/${s.data.id}/unlock`, {}); expect(un.status, `mở khóa bộ gốc: ${un.message}`).toBe(200);
    expect((await putInds(s.data.id, ib(8))).status).toBe(200);
    expect((await api('POST', `${SETS}/${s.data.id}/lock`, {})).status).toBe(200);
    const B = await mkC();
    const val = async (c: any) => byCode(await getSet(c.indicatorSetId), child.code)?.maxScore;
    expect(await val(A), 'bản sao cũ (A) giữ nội dung lúc tạo').toBe(5);
    expect(await val(B), 'bản sao mới (B) theo bộ gốc đã sửa').toBe(8);
  });
  test(tc('CMP-K26'), async ({ page }) => {
    const c = await fx('A', 'Submitted'); const sid = c.indicatorSetId; const d = await getSet(sid);
    const orig = [byCode(d, CH1).maxScore, d.groups.length];
    const pi = await putInds(sid, indPatch(d, CH1, { maxScore: 7 }), 'canbo');
    const pg = await putGrps(sid, grpBody(d).slice(0, 3), 'canbo');
    const now = await getSet(sid);
    if (pi.status === 200 || pg.status === 200) { await putInds(sid, indBody(d)); await putGrps(sid, grpBody(d)); }   // hoàn tác nếu hệ thống cho sửa
    expect([pi.status, pg.status], `PUT indicators: ${pi.message}; PUT groups: ${pg.message}`).toEqual([403, 403]);
    expect([byCode(now, CH1).maxScore, now.groups.length], 'dữ liệu giữ nguyên').toEqual(orig);
    await openBuilder(page, sid);
    const editable = (await hasBtn(page, /lưu chỉ số|lưu nhóm/i)) && (await maxInput(page, CH1).isEnabled().catch(() => false));
    expect(editable, 'kỳ Chờ phê duyệt: trang cấu hình chỉ được xem (không có nút Lưu / ô nhập khóa)').toBeFalsy();
  });
  test(tc('CMP-K27'), async () => {
    const c = await approvedFx('A'); const sid = c.indicatorSetId; const d = await getSet(sid);
    const r = await putInds(sid, indPatch(d, CH1, { maxScore: d && byCode(d, CH1).maxScore + 1 }));
    const now = await getSet(sid);
    if (r.status === 200) await putInds(sid, indBody(d));
    expect([400, 403], `bị từ chối (đặc tả 403; hệ thống có thể trả 400 báo bộ đã khóa): HTTP ${r.status} ${r.message}`).toContain(r.status);
    expect(byCode(now, CH1).maxScore, 'dữ liệu giữ nguyên').toBe(byCode(d, CH1).maxScore);
  });
  test(tc('CMP-K28'), async ({ page }) => {
    const c = await fx('A', 'Rejected'); const sid = c.indicatorSetId; const d = await getSet(sid);
    const v0 = byCode(d, CH1).maxScore;
    try {
      await rowAction(page, await listRow(page, c, 'Bị từ chối'), /cấu hình bộ chỉ số/i);
      await page.getByText(/Tổng điểm tối đa/).first().waitFor({ timeout: 15_000 }); await page.waitForTimeout(800);
      await maxInput(page, CH1).fill(String(v0 + 1));
      expect(await saveInds(page)).toMatch(/thành công/i);
      expect(byCode(await getSet(sid), CH1).maxScore).toBe(v0 + 1);
    } finally { await putInds(sid, indBody(d)); }
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
  test(tc('CMP-K30'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await maxInput(page, CH1).fill('4');
    await page.getByRole('button', { name: /lưu chỉ số/i }).dblclick(); await page.waitForTimeout(1800);
    const msgs = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' | ');
    expect(msgs, 'phải báo thành công').toMatch(/thành công/i);
    expect(msgs, 'không được báo lỗi').not.toMatch(/lỗi|thất bại|không thể/i);
    expect(byCode(await getSet(sid), CH1).maxScore).toBe(4);
    expect(await builderTotal(page)).toBe('202,0');
  });
  test(tc('CMP-K31'), async ({ page }) => {
    const c = await mkCamp(); const sid = c.indicatorSetId;
    await openBuilder(page, sid);
    await maxInput(page, CH1).fill('3'); await minInput(page, CH1).fill('1');
    expect(await saveInds(page)).toMatch(/thành công/i);
    await page.keyboard.press('F5'); await page.getByText(/Tổng điểm tối đa/).first().waitFor(); await page.waitForTimeout(1200);
    expect([await maxInput(page, CH1).inputValue(), await minInput(page, CH1).inputValue()]).toEqual(['3', '1']);
    expect(await builderTotal(page)).toBe('201,0'); expect(await stat(page, /Chỉ số\s*(\d+)\s*\d+ chỉ số không tính điểm/)).toBe('120');
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
  test(tc('CMP-K33'), async ({ page }) => {
    const name = nm('K33 ');
    const id = await uiCreate(page, name, '3');
    const c = await getCamp(id);
    expect(c.reminderDaysBeforeDue).toBe(3);
    const d = await reminderInDialog(page, c);
    expect(await d.locator('#reminderDaysBeforeDue').inputValue(), 'form Cập nhật hiển thị lại 3').toBe('3');
  });
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
  test(tc('CMP-K35'), async ({ page }) => {
    const id = await uiCreate(page, nm('K35 '));
    expect((await getCamp(id)).reminderDaysBeforeDue, 'không nhập thì null (không nhắc)').toBeNull();
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
  test(tc('CMP-K41'), async () => {
    const bad: string[] = [];
    for (const c of [await fx('A', 'Submitted'), await approvedFx('A')]) {
      const r = await api('PUT', `${CAMP}/${c.id}`, putBody(c, { reminderDaysBeforeDue: 9 }), ADM);
      const now = await getCamp(c.id);
      if (r.status === 200) await api('PUT', `${CAMP}/${c.id}`, putBody(c), ADM);
      if (![400, 403].includes(r.status)) bad.push(`${STATUS_VI[c.status]}: HTTP ${r.status} ${r.message}`);   // đặc tả 403; hệ thống trả 400 "chỉ sửa khi Nháp/Bị từ chối" vẫn là từ chối
      if (now.reminderDaysBeforeDue !== c.reminderDaysBeforeDue) bad.push(`${STATUS_VI[c.status]}: giá trị bị đổi thành ${now.reminderDaysBeforeDue}`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-K42'), async () => { test.skip(true, 'Manual: tiến trình nền theo thời gian thực (nhắc trước N ngày), không điều khiển được trong test tự động'); });
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
  test(tc('CMP-U01'), async ({ page }) => { await checkModal(page, await mkCamp({ type: 'Periodic' })); });
  test(tc('CMP-U02'), async ({ page }) => { await checkModal(page, await mkCamp({ type: 'AdHoc' })); });
  test(tc('CMP-U03'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    const api_ = await lockedOrgs(); const n = await dTotal(d);
    expect(n, 'tổng trong modal khớp danh sách đơn vị đã khóa').toBe(api_.totalElements);
    await d.locator('.ant-pagination-options .ant-select').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').last().click(); await page.waitForTimeout(1200);
    const types = new Set((await dRows(d).allInnerTexts()).map(t => t.replace(/\s+/g, ' ')));
    const joined = [...types].join(' | ');
    expect(joined, 'có đơn vị thuộc Bộ').toContain('Đơn vị thuộc Bộ'); expect(joined, 'có Sở/Ban/Ngành').toContain('Cấp Sở/Ban/Ngành');
  });
  test(tc('CMP-U04'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    await dSearch(page, d, 'QA');
    const rows = (await dRows(d).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').toLowerCase());
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r, 'dòng không chứa "qa"').toContain('qa');
    expect(await dTotal(d)).toBe((await lockedOrgs('QA')).totalElements);
  });
  test(tc('CMP-U05'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    await dSearch(page, d, 'zzzz');
    expect(await dRows(d).count()).toBe(0);
    await expect(d.locator('.ant-empty, .ant-table-placeholder').first()).toContainText(/trống/i);
  });
  test(tc('CMP-U06'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    await d.locator('.ant-select').filter({ hasText: /tất cả loại đơn vị/i }).click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dd.waitFor({ state: 'visible' });
    await dd.locator('.ant-select-item-option').first().waitFor({ timeout: 8000 }).catch(() => {});
    const opts = await dd.locator('.ant-select-item-option').allInnerTexts();
    expect(opts.length, 'bộ lọc loại đơn vị phải có lựa chọn').toBeGreaterThan(0);
    const label = opts.find(o => /thuộc Bộ/.test(o)) ?? opts[0];
    await dd.locator('.ant-select-item-option', { hasText: label }).first().click(); await page.waitForTimeout(1200);
    const rows = (await dRows(d).allInnerTexts()).map(t => t.replace(/\s+/g, ' '));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r).toContain(label.trim());
    expect(await dTotal(d)).toBe((await lockedOrgs()).content.filter((o: any) => o.unitTypeName === label.trim()).length);
  });
  test(tc('CMP-U07'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    const total0 = await dTotal(d);
    // tỉnh có đơn vị: lấy từ cột "Tỉnh/thành tham chiếu" của các dòng đang hiển thị (đơn vị đã tham chiếu)
    await d.locator('.ant-pagination-options .ant-select').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').last().click(); await page.waitForTimeout(1200);
    const prov = (await dRows(d).evaluateAll(rs => rs.map(r => (r.querySelectorAll('td')[5]?.textContent ?? '').trim()))).find(t => t && !/chưa tham chiếu/i.test(t));
    await d.locator('.ant-select').filter({ hasText: /tất cả tỉnh\/thành/i }).click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dd.waitFor({ state: 'visible' });
    await dd.locator('.ant-select-item-option').first().waitFor({ timeout: 8000 }).catch(() => {});
    const opts = (await dd.locator('.ant-select-item-option').allInnerTexts()).map(s => s.trim());
    expect(opts.length, 'bộ lọc tỉnh/thành phải có lựa chọn').toBeGreaterThan(0);
    const pick = prov && opts.includes(prov) ? prov : opts[0];
    await dd.locator('.ant-select-item-option', { hasText: pick }).first().click(); await page.waitForTimeout(1200);
    const rows = (await dRows(d).allInnerTexts()).map(t => t.replace(/\s+/g, ' '));
    for (const r of rows) expect(r, `dòng không thuộc tỉnh "${pick}"`).toContain(pick);
    if (prov) { expect(rows.length).toBeGreaterThan(0); expect(await dTotal(d), 'lọc phải loại bớt đơn vị tỉnh khác').toBeLessThan(total0); }
  });
  test(tc('CMP-U08'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    await dTick(page, d, 'QC_DP');
    expect(await dFooter(d)).toBe('Đã chọn 1 đơn vị');
    expect(await saveAssign(page, d)).toMatch(/Cập nhật phân công đơn vị thành công/);
    expect(await orgsOf(c.id)).toEqual([(await base()).dp]);
    await openDetail(page, c.id);
    expect(await unitTile(page)).toBe('1');
    expect(await dataRows(page).filter({ hasText: 'QC_DP' }).count()).toBe(1);
  });
  test(tc('CMP-U09'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    for (const u of UNIT_CODES) await dTick(page, d, u);
    expect(await dFooter(d)).toBe('Đã chọn 3 đơn vị');
    expect(await saveAssign(page, d)).toMatch(/thành công/i);
    expect(await orgsOf(c.id)).toHaveLength(3);
    await openDetail(page, c.id); expect(await unitTile(page)).toBe('3');
  });
  test(tc('CMP-U10'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    const n = await dTotal(d);
    await d.locator('thead input[type=checkbox]').check(); await page.waitForTimeout(500);
    expect(await dFooter(d), 'chọn tất cả = tổng đơn vị').toBe(`Đã chọn ${n} đơn vị`);
    expect(await saveAssign(page, d)).toMatch(/thành công/i);
    expect(await orgsOf(c.id)).toHaveLength(n);
    await openDetail(page, c.id); expect(await unitTile(page)).toBe(String(n));
    expect(await text(page)).toMatch(new RegExp(`trong ${n} bản ghi`));
  });
  test(tc('CMP-U11'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    const n = await dTotal(d);
    await d.locator('thead input[type=checkbox]').check(); await page.waitForTimeout(500);
    const row = dRows(d).first(); const code = (await row.locator('td').nth(2).innerText()).trim();
    await row.locator('input[type=checkbox]').uncheck(); await page.waitForTimeout(400);
    expect(await dFooter(d)).toBe(`Đã chọn ${n - 1} đơn vị`);
    expect(await saveAssign(page, d)).toMatch(/thành công/i);
    const ids = await orgsOf(c.id); expect(ids).toHaveLength(n - 1);
    const un = (await lockedOrgs()).content.find((o: any) => o.code === code);
    expect(ids, `đơn vị bỏ chọn ${code} không được phân công`).not.toContain(un.id);
  });
  test(tc('CMP-U12'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    await dSearch(page, d, 'QA');
    const n = await dTotal(d); expect(n).toBeGreaterThan(0); expect(n).toBeLessThan((await lockedOrgs()).totalElements);
    await d.locator('thead input[type=checkbox]').check(); await page.waitForTimeout(500);
    expect(await saveAssign(page, d)).toMatch(/thành công/i);
    const ids = await orgsOf(c.id);
    expect(ids, `chỉ ${n} đơn vị khớp "QA" được phân công`).toHaveLength(n);
    const qa = (await lockedOrgs('QA')).content.map((o: any) => o.id).sort();
    expect(ids).toEqual(qa);
  });
  test(tc('CMP-U13'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    expect(await dFooter(d)).toBe('Chưa chọn đơn vị nào');
    await expect(dSave(d)).toBeDisabled();
  });
  test(tc('CMP-U14'), async ({ page }) => {
    const c = await mkCamp(); const d = await openAssign(page, c);
    await dTick(page, d, 'QC_DP'); await dTick(page, d, 'QC_BO');
    expect(await dFooter(d)).toBe('Đã chọn 2 đơn vị');
    await btnCancel(d).click(); await page.waitForTimeout(600);
    await expect(d).toBeHidden();
    expect(await orgsOf(c.id)).toEqual([]);
    await openDetail(page, c.id); expect(await unitTile(page)).toBe('0');
  });
  test(tc('CMP-U15'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp, b.bo, b.t3] });
    const d = await openAssign(page, c);
    expect(await dFooter(d)).toBe('Đã chọn 3 đơn vị');
    for (const u of UNIT_CODES) { await dSearch(page, d, u); expect(await dRows(d).filter({ hasText: u }).first().locator('input[type=checkbox]').isChecked(), `${u} phải được tích sẵn`).toBeTruthy(); }
  });
  test(tc('CMP-U16'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp, b.bo, b.t3] });
    const d = await openAssign(page, c);
    await dTick(page, d, 'QC_BO', false);
    expect(await dFooter(d)).toBe('Đã chọn 2 đơn vị');
    expect(await saveAssign(page, d)).toMatch(/thành công/i);
    expect(await orgsOf(c.id)).toEqual([b.dp, b.t3].sort());
    await openDetail(page, c.id);
    expect(await unitTile(page)).toBe('2'); expect(await dataRows(page).filter({ hasText: 'QC_BO' }).count()).toBe(0);
  });
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
  test(tc('CMP-U21'), async ({ page }) => {
    const c = await mkCamp();
    for (let i = 0; i < 2; i++) {
      const d = await openAssign(page, c);
      if (i === 0) await dTick(page, d, 'QC_DP'); else expect(await dFooter(d)).toBe('Đã chọn 1 đơn vị');
      expect(await saveAssign(page, d)).toMatch(/thành công/i);
    }
    expect(await orgsOf(c.id)).toHaveLength(1);
    await openDetail(page, c.id); expect(await unitTile(page)).toBe('1'); expect(await dataRows(page).count()).toBe(1);
  });
  test(tc('CMP-U22'), async ({ page }) => {
    const bad: string[] = []; const b = await base();
    for (const c of [await fx('A', 'Submitted'), await approvedFx('A')]) {
      const st = STATUS_VI[c.status]; const before = await orgsOf(c.id);
      await openDetail(page, c.id);
      if (await hasBtn(page, /^\s*Phân công đơn vị\s*$/)) bad.push(`${st}: còn nút Phân công đơn vị`);
      if ((await menuOf(page, c, st)).some(i => /phân công/i.test(i))) bad.push(`${st}: menu còn Phân công đơn vị`);
      const r = await putOrgs(c.id, [b.dp]); const now = await orgsOf(c.id);
      if (r.status === 200 && before.join() !== now.join()) await putOrgs(c.id, before);
      if (![400, 403].includes(r.status)) bad.push(`${st}: API HTTP ${r.status} ${r.message}`);   // đặc tả 403; chấp nhận 400 báo sai trạng thái
      if (before.join() !== now.join()) bad.push(`${st}: danh sách đơn vị bị đổi`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });
  test(tc('CMP-U23'), async ({ page }) => {
    const c = await fx('A', 'Rejected'); const before = await orgsOf(c.id); const b = await base();
    try {
      const d = await openAssign(page, c);
      await dTick(page, d, 'QC_BO');
      expect(await saveAssign(page, d)).toMatch(/thành công/i);
      expect((await orgsOf(c.id)).sort()).toEqual([...before, b.bo].sort());
      await openDetail(page, c.id); expect(await dataRows(page).filter({ hasText: 'QC_BO' }).count()).toBe(1);
    } finally { await putOrgs(c.id, before); }
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
  test(tc('CMP-U26'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp, b.bo] });
    await openDetail(page, c.id);
    expect(await exportBtn(page).count(), 'chi tiết kỳ phải có nút Xuất Excel cho bảng Đơn vị được phân công').toBeGreaterThan(0);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), exportBtn(page).first().click()]);
    expect(dl.suggestedFilename()).toMatch(/\.xlsx$/i);
  });
  test(tc('CMP-U27'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp, b.bo] });
    await openDetail(page, c.id);
    expect(await exportBtn(page).count(), 'chưa có chức năng Xuất Excel đơn vị được phân công').toBeGreaterThan(0);
    await page.getByPlaceholder(/tìm đơn vị/i).first().fill('QC_DP'); await waitList(page);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), exportBtn(page).first().click()]);
    expect(dl.suggestedFilename()).toMatch(/\.xlsx$/i);
    const buf = Buffer.concat(await (async () => { const chunks: Buffer[] = []; for await (const ch of (await dl.createReadStream())!) chunks.push(ch as Buffer); return chunks; })());
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.toString('latin1'), 'file không được chứa đơn vị ngoài bộ lọc').not.toContain('QC_BO');
  });
  test(tc('CMP-U28'), async ({ page }) => {
    const c = await mkCamp(); await openDetail(page, c.id);
    expect(await exportBtn(page).count(), 'chưa có chức năng Xuất Excel đơn vị được phân công').toBeGreaterThan(0);
    const dl = page.waitForEvent('download', { timeout: 4000 }).then(() => true, () => false);
    await exportBtn(page).first().click();
    expect(await toast(page)).toMatch(/không có dữ liệu/i);
    expect(await dl, 'không tải file rỗng').toBeFalsy();
  });
  test(tc('CMP-U29'), async ({ page }) => {
    const c = await mkCamp();
    const count = async () => {
      const row = await listRow(page, c); const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim());
      const idx = heads.findIndex(h => /số đơn vị/i.test(h));
      return (await row.locator('td').nth(idx).innerText()).trim();
    };
    expect(await count()).toBe('0');
    let d = await openAssign(page, c); await dTick(page, d, 'QC_DP'); await dTick(page, d, 'QC_BO');
    expect(await saveAssign(page, d)).toMatch(/thành công/i);
    expect(await count(), 'sau khi phân công 2 đơn vị').toBe('2');
    d = await openAssign(page, c); await dTick(page, d, 'QC_BO', false);
    expect(await saveAssign(page, d)).toMatch(/thành công/i);
    expect(await count(), 'sau khi bỏ 1 đơn vị').toBe('1');
  });
  test(tc('CMP-U30'), async ({ page }) => {
    const b = await base();
    for (const [type, code, id] of [['Periodic', 'QC_DP', b.dp], ['AdHoc', 'QC_BO', b.bo]] as const) {
      const c = await mkCamp({ type });
      const d = await openAssign(page, c); await dTick(page, d, code);
      expect(await saveAssign(page, d), type).toMatch(/thành công/i);
      expect(await orgsOf(c.id), `kỳ ${type}`).toEqual([id]);
      await openDetail(page, c.id); expect(await dataRows(page).filter({ hasText: code }).count()).toBe(1);
    }
  });
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
  test(tc('CMP-T01'), async ({ page }) => {
    const c = await fx('P', 'Rejected');
    expect(await uiSubmit(page, c)).toMatch(/Trình phê duyệt thành công/);
    const n = await getCamp(c.id);
    expect(n.status).toBe('Submitted'); expect(n.submittedByUserName).toBe('QC Quản trị hệ thống'); expect(n.submittedDate).toBeTruthy();
    expect(await badge(page)).toBe('Chờ phê duyệt');
  });
  test(tc('CMP-T02'), async ({ page }) => {
    const c = await fx('A', 'Rejected');
    expect(await uiSubmit(page, c)).toMatch(/Trình phê duyệt thành công/);
    expect(await statusOf(c.id)).toBe('Submitted');
    expect(await badge(page)).toBe('Chờ phê duyệt');
  });
  test(tc('CMP-T03'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp] });
    await uiSubmit(page, c, 'Không');
    expect(await statusOf(c.id)).toBe('Draft');
    await openDetail(page, c.id);
    expect((await history(page)).filter(h => h.title === TRINH), 'không có mốc trình trong lịch sử').toHaveLength(0);
  });
  test(tc('CMP-T04'), async ({ page }) => {
    const c = await mkCamp();
    const msg = await uiSubmit(page, c);
    expect(msg).toMatch(/Cần phân công ít nhất 1 đơn vị trước khi trình phê duyệt/);
    expect(await statusOf(c.id)).toBe('Draft');
  });
  test(tc('CMP-T05'), async () => {
    const c = await fx('A', 'Rejected'); const sid = c.indicatorSetId; const d = await getSet(sid);
    let r: any;
    try {
      expect((await putGrps(sid, [])).status).toBe(200);
      r = await submitApi(c.id);
      if (r.status === 200) await rejectApi(c.id);   // hệ thống cho trình → trả fixture về Bị từ chối
    } finally { await putGrps(sid, grpBody(d)); await putInds(sid, indBody(d)); }
    expect(r.status, `trình kỳ có bộ chỉ số rỗng (0 nhóm) → HTTP ${r.status} ${r.message}`).toBeGreaterThanOrEqual(400);
  });
  test(tc('CMP-T06'), async ({ page }) => {
    const c = await fx('A', 'Submitted'); const bad: string[] = [];
    const items = await menuOf(page, c, 'Chờ phê duyệt');
    for (const re of [/cập nhật/i, /^xo[áa]$/i, /phân công/i, /trình phê duyệt/i, /cấu hình bộ chỉ số/i]) if (items.some(i => re.test(i))) bad.push(`menu còn "${items.find(i => re.test(i))}"`);
    await openDetail(page, c.id);
    for (const re of [/^\s*Trình phê duyệt\s*$/, /^\s*Phân công đơn vị\s*$/]) if (await hasBtn(page, re)) bad.push(`chi tiết còn nút ${re}`);
    expect(bad, `menu: [${items.join(', ')}]; ${bad.join('; ')}`).toEqual([]);
  });
  test(tc('CMP-T07'), async ({ page }) => {
    const c = await fx('A', 'Rejected');
    expect((await submitApi(c.id)).status).toBe(200);
    const n = await getCamp(c.id);
    await openDetail(page, c.id);
    const h = (await history(page)).find(x => x.title === TRINH);
    expect(h, 'mốc "Trình phê duyệt"').toBeTruthy();
    expect(h!.meta).toContain(n.submittedByUserName); expect(h!.meta).toContain(today());
  });
  test(tc('CMP-T08'), async () => {
    const c = await fx('A', 'Submitted');
    const r = await submitApi(c.id); const n = await getCamp(c.id);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    expect([n.status, n.submittedDate], 'trạng thái/mốc trình không đổi').toEqual(['Submitted', c.submittedDate]);
  });
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
  test(tc('CMP-T11'), async () => {
    const c = await fx('A', 'Rejected'); const bad: string[] = [];
    for (const as of ['lanhdaobo', 'xemonly', 'ldd', 'cbdp', 'ldp']) {
      const r = await submitApi(c.id, as);
      if (r.status !== 403 || !FORB.test(r.message)) bad.push(`${as}: HTTP ${r.status} ${r.message}`);
    }
    expect(bad, bad.join('; ')).toEqual([]);
    expect(await statusOf(c.id), 'kỳ giữ nguyên trạng thái').toBe('Rejected');
  });
  test(tc('CMP-T12'), async ({ page }) => {
    const b = await base(); const c = await mkCamp({ orgs: [b.dp] }); const bad: string[] = [];
    await openDetail(page, c.id);
    for (const re of [/^\s*Trình phê duyệt\s*$/, /^\s*Phân công đơn vị\s*$/]) if (await hasBtn(page, re)) bad.push(`còn nút ${re}`);
    const items = await menuOf(page, c, 'Nháp');
    for (const re of [/cập nhật/i, /^xo[áa]$/i, /phân công/i, /trình phê duyệt/i, /cấu hình bộ chỉ số/i]) if (items.some(i => re.test(i))) bad.push(`menu còn "${items.find(i => re.test(i))}"`);
    expect(bad, `menu: [${items.join(', ')}]; ${bad.join('; ')}`).toEqual([]);
  });
  test(tc('CMP-T13'), async ({ page }) => {
    const c = await fx('A', 'Rejected');
    const d = await reminderInDialog(page, c);   // Cán bộ cập nhật kỳ trước khi trình lại
    await d.locator('#reminderDaysBeforeDue').fill('7');
    await d.locator('button', { hasText: /^\s*Lưu\s*$/ }).last().click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await getCamp(c.id)).reminderDaysBeforeDue).toBe(7);
    expect(await uiSubmit(page, c)).toMatch(/Trình phê duyệt thành công/);
    expect(await statusOf(c.id)).toBe('Submitted');
  });
  test(tc('CMP-T14'), async ({ page }) => {
    const c = await fx('A', 'Submitted'); const L = `qc.automation lý do ${code8()}`;
    expect((await rejectApi(c.id, L)).status).toBe(200);
    expect((await getCamp(c.id)).rejectReason).toBe(L);
    expect((await submitApi(c.id)).status).toBe(200);
    expect((await getCamp(c.id)).rejectReason, 'rejectReason = null sau khi trình lại').toBeNull();
    await openDetail(page, c.id);
    const h = await history(page);
    expect(h.some(x => /từ chối/i.test(x.title) && x.note.includes(L)), `lịch sử vẫn ghi lần từ chối kèm lý do "${L}": ${JSON.stringify(h)}`).toBeTruthy();
  });
  test(tc('CMP-T15'), async ({ page }) => {
    const c = await fx('A', 'Rejected'); const L = `qc.automation T15 ${code8()}`;
    expect((await submitApi(c.id)).status).toBe(200); expect((await rejectApi(c.id, L)).status).toBe(200); expect((await submitApi(c.id)).status).toBe(200);
    await openDetail(page, c.id);
    const h = await history(page);
    expect(h.slice(0, 3).map(x => x.title.replace(/ kỳ$/, '')), JSON.stringify(h)).toEqual([TRINH, 'Từ chối phê duyệt', TRINH]);
    expect(h[1].note).toContain(L);
    expect(h[h.length - 1].title, 'mốc đầu tiên').toMatch(/^Tạo kỳ/);
    expect(h.length, 'đủ ≥ 4 mốc: Tạo kỳ, Trình, Từ chối, Trình lại').toBeGreaterThanOrEqual(4);
  });
  test(tc('CMP-T16'), async ({ page }) => {
    const c = await fx('A', 'Rejected');
    expect((await menuOf(page, c, 'Bị từ chối')).some(i => /trình phê duyệt/i.test(i)), 'menu có Trình phê duyệt').toBeTruthy();
    await openDetail(page, c.id);
    expect(await hasBtn(page, /^\s*Trình phê duyệt\s*$/), 'chi tiết có nút Trình phê duyệt').toBeTruthy();
  });
  test(tc('CMP-T17'), async ({ page }) => {
    const c = await fx('A', 'Rejected'); const before = orgIds(c);
    try {
      expect((await putOrgs(c.id, [])).status).toBe(200);
      expect(await uiSubmit(page, c)).toMatch(/Cần phân công ít nhất 1 đơn vị trước khi trình phê duyệt/);
      expect(await statusOf(c.id)).toBe('Rejected');
    } finally { await putOrgs(c.id, before); if ((await statusOf(c.id)) === 'Submitted') await rejectApi(c.id); }
  });
  test(tc('CMP-T18'), async () => {
    const c = await fx('A', 'Rejected');
    const r = await submitApi(c.id); const n = await getCamp(c.id);
    expect((r.status === 200 && n.status === 'Submitted') || (r.status === 400 && n.status === 'Rejected'), `HTTP ${r.status} ${r.message}; trạng thái ${n.status}`).toBeTruthy();
  });
  test(tc('CMP-T19'), async ({ page }) => {
    const c = await fx('A', 'Rejected');
    expect(await uiSubmit(page, c)).toMatch(/Trình phê duyệt thành công/);
    await openDetail(page, c.id);
    const h = (await history(page)).find(x => x.title === TRINH);
    expect(h?.meta, 'mốc lịch sử ghi tên quản trị').toContain('QC Quản trị hệ thống');
    expect((await getCamp(c.id)).submittedByUserName).toBe('QC Quản trị hệ thống');
  });
  test(tc('CMP-T20'), async ({ page }) => {
    const c = await fx('A', 'Rejected');
    await openDetail(page, c.id);
    const reqs: string[] = []; page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/submit')) reqs.push(r.url()); });
    await BTN(page, /^\s*Trình phê duyệt\s*$/).first().click();
    await page.locator('.ant-modal-confirm-title').filter({ hasText: /muốn trình phê duyệt/ }).waitFor();
    await page.getByRole('button', { name: /^\s*có\s*$/i }).filter({ visible: true }).last().dblclick();
    await page.waitForTimeout(2500);
    const msgs = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' | ');
    expect(await statusOf(c.id)).toBe('Submitted');
    expect(msgs, 'không được báo lỗi').not.toMatch(/lỗi|không có quyền|thất bại/i);
    expect(reqs.length, 'chỉ gửi 1 lần').toBe(1);
    await openDetail(page, c.id);
    expect((await history(page)).filter(h => h.title === TRINH), 'chỉ 1 mốc Trình phê duyệt mới').toHaveLength(1);
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
  test(tc('CMP-A03'), async ({ page }) => {
    const c = await approvedFx('A');
    expect(c.organizations).toHaveLength(3);
    expect(c.organizations.map((o: any) => o.assessmentStatus), 'mỗi đơn vị có 1 kết quả "Chưa thực hiện"').toEqual(['NotStarted', 'NotStarted', 'NotStarted']);
    const rs = await resultsOf(c);
    expect(rs, 'kết quả đánh giá của kỳ').toHaveLength(3);
    for (const r of rs) expect(r.status).toBe('NotStarted');
    await openDetail(page, c.id);
    expect(await text(page)).toMatch(/Chưa bắt đầu\s*3/);
  });
  test(tc('CMP-A04'), async ({ page }) => {
    const c = await approvedFx('P');
    const st = c.organizations.map((o: any) => o.assessmentStatus), rs = await resultsOf(c);
    expect(st, `trạng thái đánh giá của đơn vị sau khi duyệt kỳ Định kỳ; số kết quả = ${rs.length}`).toEqual(c.organizations.map(() => 'NotStarted'));
    expect(rs.length).toBe(c.organizations.length);
    await openDetail(page, c.id);
    expect(await text(page)).toMatch(/Chưa bắt đầu\s*1/);
  });
  test(tc('CMP-A05'), async () => { test.skip(true, 'Manual: phụ thuộc tiến trình nền theo lịch (sang tháng/quý/năm), không điều khiển được trong test tự động'); });
  test(tc('CMP-A06'), async ({ page }) => {
    const c = await fx('A', 'Submitted');
    await rowAction(page, await listRow(page, c, 'Chờ phê duyệt'), PHE_DUYET);
    await page.locator('.ant-modal-confirm-title').first().waitFor();
    await confirmNo(page);
    expect((await getCamp(c.id)).status).toBe('Submitted');
  });
  test(tc('CMP-A07'), async ({ page }) => {
    const c = await approvedFx('A');
    await openDetail(page, c.id);
    const h = (await history(page)).find(x => /^phê duyệt/i.test(x.title));
    expect(h, `mốc "Phê duyệt" trong lịch sử: ${JSON.stringify(await history(page))}`).toBeTruthy();
    expect(h!.meta).toContain('QC Lãnh đạo Bộ');
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
  test(tc('CMP-A11'), async ({ browser }) => {
    const c = await fx('A', 'Submitted');
    const items = await asUser(browser, 'canbo', p => menuOf(p, c, 'Chờ phê duyệt'));
    expect(items.filter(i => /phê duyệt|từ chối/i.test(i)), `menu của Cán bộ: [${items.join(', ')}]`).toEqual([]);
    const r = await approveApi(c.id, 'canbo');
    expect([r.status, r.message]).toEqual([403, expect.stringMatching(FORB)]);
    expect((await getCamp(c.id)).status).toBe('Submitted');
  });
  test(tc('CMP-A12'), async () => {
    const c = await fx('A', 'Submitted'); const bad: string[] = [];
    for (const as of ['xemonly', 'ldd', 'cbdp', 'ldp']) { const r = await approveApi(c.id, as); if (r.status !== 403 || !FORB.test(r.message)) bad.push(`${as}: HTTP ${r.status} ${r.message}`); }
    expect(bad, bad.join('; ')).toEqual([]);
    expect((await getCamp(c.id)).status, 'kỳ vẫn Chờ phê duyệt').toBe('Submitted');
  });
  test(tc('CMP-A13'), async ({ browser }) => {
    const c = await fx('A', 'Submitted');
    const items = await asUser(browser, ADM, p => menuOf(p, c, 'Chờ phê duyệt'));
    const act = (await getCamp(c.id, ADM)).allowedActions as string[];
    expect([items.filter(i => /phê duyệt|từ chối/i.test(i)), act.filter(a => a === 'APPROVE')], `theo UC chỉ Lãnh đạo phê duyệt; Quản trị hệ thống thấy menu [${items.join(', ')}], allowedActions [${act.join(', ')}]`).toEqual([[], []]);
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
  test(tc('CMP-A15'), async () => { test.skip(true, 'Manual: không xác minh được kênh email/thông báo đẩy tự động; cần kiểm tra thủ công'); });
  test(tc('CMP-A16'), async ({ page }) => {
    const c = await fx('A', 'Submitted'); const L = `qc.automation lý do ${code8()}`;
    const d = await openReject(page, c);
    await d.locator('textarea').fill(L); await doReject(page, d);
    expect(await toast(page)).toMatch(/Từ chối thành công/);
    const n = await getCamp(c.id, LDB);
    expect(n.status).toBe('Rejected'); expect(n.rejectReason).toBe(L);
    await openDetail(page, c.id);
    expect(await badge(page)).toBe('Bị từ chối'); expect((await history(page)).some(h => h.note.includes(L)), 'lịch sử hiển thị lý do').toBeTruthy();
  });
  test(tc('CMP-A17'), async ({ page }) => {
    const c = await fx('A', 'Submitted');
    const d = await openReject(page, c);
    await doReject(page, d); await page.waitForTimeout(800);
    await expect(d.locator('.ant-form-item-explain-error'), 'UI báo "Lý do từ chối" bắt buộc').toContainText(/lý do từ chối/i);
    const r = await rejectApi(c.id, '');
    expect([r.status, r.message]).toEqual([400, expect.stringMatching(/Vui lòng nhập lý do từ chối/)]);
    expect((await getCamp(c.id)).status).toBe('Submitted');
  });
  test(tc('CMP-A18'), async () => {
    const c = await fx('A', 'Submitted');
    const r = await rejectApi(c.id, '   ');
    expect([r.status, r.message]).toEqual([400, expect.stringMatching(/Vui lòng nhập lý do từ chối/)]);
    expect((await getCamp(c.id)).status).toBe('Submitted');
  });
  test(tc('CMP-A19'), async () => {
    const c = await fx('A', 'Submitted');
    const over = await rejectApi(c.id, 'x'.repeat(1001));
    expect([over.status, over.message], '1001 ký tự').toEqual([400, expect.stringMatching(/Không được nhập vượt quá 1000 ký tự/)]);
    expect((await getCamp(c.id)).status).toBe('Submitted');
    const ok = await rejectApi(c.id, 'y'.repeat(1000));
    expect(ok.status, `1000 ký tự: ${ok.message}`).toBe(200);
    expect((await getCamp(c.id)).rejectReason, 'lưu đủ 1000 ký tự').toHaveLength(1000);
  });
  test(tc('CMP-A20'), async ({ page }) => {
    const c = await fx('A', 'Submitted'); const X = '<img src=x onerror=alert(1)>';
    let alerted = false; page.on('dialog', dg => { alerted = true; dg.dismiss().catch(() => {}); });
    const d = await openReject(page, c);
    await d.locator('textarea').fill(X); await doReject(page, d);
    const msg = await toast(page);
    const n = await getCamp(c.id, LDB);
    if (n.status === 'Rejected') {   // không bị chặn khi nhập → phải hiển thị dạng văn bản
      await openDetail(page, c.id);
      expect(await page.locator('img[src="x"]').count(), 'thẻ <img> không được render').toBe(0);
      expect(await text(page), 'lý do hiển thị nguyên văn dạng chữ').toContain(X);
    } else expect(msg, 'bị chặn khi nhập').toMatch(/không hợp lệ|thẻ HTML|script/i);
    await page.waitForTimeout(500); expect(alerted, 'script không được thực thi').toBeFalsy();
  });
  test(tc('CMP-A21'), async ({ page }) => {
    const c = await fx('A', 'Submitted');
    const d = await openReject(page, c);
    await d.locator('textarea').fill('qc.automation hủy'); await d.locator('button', { hasText: /^\s*H[uủ]y\s*$/ }).last().click(); await page.waitForTimeout(600);
    expect((await getCamp(c.id)).status).toBe('Submitted');
    await openDetail(page, c.id);
    expect((await history(page)).some(h => /từ chối/i.test(h.title)), 'không có mốc từ chối').toBeFalsy();
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
  test(tc('CMP-A24'), async () => {
    const c = await fx('A', 'Submitted'); const bad: string[] = [];
    for (const as of ['canbo', 'xemonly', 'ldd', 'cbdp', 'ldp']) { const r = await rejectApi(c.id, 'qc.automation', as); if (r.status !== 403 || !FORB.test(r.message)) bad.push(`${as}: HTTP ${r.status} ${r.message}`); }
    expect(bad, bad.join('; ')).toEqual([]);
    expect((await getCamp(c.id)).status).toBe('Submitted');
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
  test(tc('CMP-A27'), async () => { test.skip(true, 'Manual: kênh thông báo đẩy không kiểm chứng được tự động; cần BA xác nhận có gửi thông báo cho Cán bộ'); });
  test(tc('CMP-A28'), async () => {
    // kỳ riêng (không dùng fixture xoay vòng vì bên thắng thường là "Phê duyệt" → kỳ không còn dùng lại được); tên theo mẫu "approved A" để tái dùng nếu được duyệt
    const c = await mkSubmitted('A', nm('approved A '), 3);
    const [a, r] = await Promise.all([approveApi(c.id), rejectApi(c.id, 'qc.automation CMP2 A28')]);
    const n = await getCamp(c.id, LDB);
    expect([a.status, r.status].filter(s => s === 200), `approve ${a.status} ${a.message}; reject ${r.status} ${r.message}`).toHaveLength(1);
    expect(n.status, 'trạng thái cuối khớp request thắng').toBe(a.status === 200 ? 'Approved' : 'Rejected');
  });
});
