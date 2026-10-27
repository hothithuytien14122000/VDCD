// B.II.1 BỘ CHỈ SỐ — script bám testcase SET-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, findRow, pickOption, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, goto,
  registerListSuite, registerAuthTest, registerPerfTest, registerNotFoundTest, FILTERS, SPECIAL_NAME, tokenOf, apiStatus,
  ensurePillar, ensureGroup, ensureIndicator,
} from './common';

import { PAGES as PagesA } from '../A/common';
const cfg = PAGES.SET;
const SETS = 'dti/indicator-sets';
const CAMPS = 'dti/self-assessment-campaigns';
const SCALE_ID = '6f1c6e0e-5a56-4a0e-9a53-0d1f2b6b7c01'; // thang xếp loại mặc định của hệ thống (chỉ đọc)
const made = new Made();
const roots: string[] = [];   // mã bộ chỉ số do test tạo (gồm cả bản nhân bản có tiền tố cùng mã)
const campIds: string[] = [];  // kỳ tự đánh giá do test tạo

/** Dọn: kỳ trước, rồi bộ chỉ số (mở khóa bằng POST /unlock) và các bản nhân bản; sau đó dữ liệu nền (chỉ số/nhóm/trụ cột). */
async function cleanSets() {
  for (const id of campIds.splice(0)) await api('DELETE', `${CAMPS}/${id}`).catch(() => {});
  for (const root of roots.splice(0)) {
    for (const s of await listApi(SETS, root).catch(() => [])) {
      if (!String(s.code).toUpperCase().startsWith(root.toUpperCase())) continue;
      if (s.status === 'Locked') await api('POST', `${SETS}/${s.id}/unlock`, {});
      await api('DELETE', `${SETS}/${s.id}`);
    }
  }
}
test.afterEach(async () => { await cleanSets(); await made.clean(); });
PagesA.SET = cfg; // registerListSuite tra cấu hình trong PAGES của A → bổ sung cấu hình SET
registerListSuite('SET');

// ---------- Dữ liệu nền qua API ----------
async function mkSet(extra: any = {}) {
  const code = code8(); roots.push(code);
  const body = { code, name: `qc.automation Bộ ${code}`, effectiveYear: 2026, ...extra };
  const r = await api('POST', SETS, body);
  if (r.status >= 300) throw new Error(`tạo bộ chỉ số lỗi ${r.status} ${r.message}`);
  return { id: r.data.id as string, code, name: body.name as string };
}
const lockSet = async (id: string) => { const r = await api('POST', `${SETS}/${id}/lock`, {}); if (r.status !== 200) throw new Error('khóa bộ lỗi: ' + r.message); };
const unlockSet = (id: string) => api('POST', `${SETS}/${id}/unlock`, {});
const getSet = async (id: string) => (await api('GET', `${SETS}/${id}`)).data;
const statusOf = async (id: string) => (await getSet(id))?.status as string;
async function mkCampaign(setId: string) {
  const r = await api('POST', CAMPS, { name: `qc.automation kỳ ${code8()}`, type: 'AdHoc', indicatorSetId: setId, scaleId: SCALE_ID, startDate: '2026-11-01T00:00:00', endDate: '2026-11-30T23:59:59', periodValue: 'Năm 2026' });
  if (r.status >= 300) throw new Error(`tạo kỳ lỗi ${r.status} ${r.message}`);
  campIds.push(r.data.id); return { id: r.data.id as string, name: r.data.name as string };
}
interface TG { g: any; par: any; c1: any; c2: any }
/** 1 trụ cột, n nhóm; mỗi nhóm có 1 chỉ số cha (10đ) và 2 chỉ số con (5đ + 5đ) — điểm bộ = tổng điểm các chỉ số con. Tất cả đã khóa. */
async function mkTree(n = 1) {
  const pillar = await ensurePillar(made);
  const groups: TG[] = [];
  for (let i = 0; i < n; i++) {
    const g = await ensureGroup(made, { pillarId: pillar.id });
    const par = await ensureIndicator(made, { groupId: g.id, pillarId: pillar.id, max: 10, lock: true });
    const c1 = await ensureIndicator(made, { groupId: g.id, pillarId: pillar.id, parentId: par.id, max: 5, lock: true });
    const c2 = await ensureIndicator(made, { groupId: g.id, pillarId: pillar.id, parentId: par.id, max: 5, lock: true });
    groups.push({ g, par, c1, c2 });
  }
  return { pillar, groups };
}
const indBody = (x: TG) => [
  { indicatorId: x.par.id, weight: 0, isScored: true, minScore: 0, maxScore: 10 },
  { indicatorId: x.c1.id, weight: 1, isScored: true, minScore: 0, maxScore: 5 },
  { indicatorId: x.c2.id, weight: 1, isScored: true, minScore: 0, maxScore: 5 },
];
/** Ghi cấu trúc bộ chỉ số bằng API: các nhóm + chỉ số của chúng. */
async function fillStruct(setId: string, groups: TG[]) {
  const a = await api('PUT', `${SETS}/${setId}/groups`, groups.map((x, i) => ({ indicatorGroupId: x.g.id, displayOrder: i + 1, isScored: true })));
  if (a.status !== 200) throw new Error('ghi nhóm lỗi: ' + a.message);
  const b = await api('PUT', `${SETS}/${setId}/indicators`, groups.flatMap(indBody).map((x, i) => ({ ...x, displayOrder: i + 1 })));
  if (b.status !== 200) throw new Error('ghi chỉ số lỗi: ' + b.message);
}
async function mkFilled(n = 1, extra: any = {}) {
  const tree = await mkTree(n); const s = await mkSet(extra);
  await fillStruct(s.id, tree.groups);
  return { ...s, ...tree };
}
const fmt = (n: number) => n.toFixed(1).replace('.', ',');
const flatInds = (d: any): any[] => (d?.groups ?? []).flatMap((g: any) => (g.indicators ?? []).flatMap((i: any) => [i, ...(i.children ?? [])]));
const totalOf2 = (d: any) => (d?.groups ?? []).filter((g: any) => g.isScored).flatMap((g: any) => g.indicators.flatMap((i: any) => i.children ?? [])).filter((c: any) => c.isScored).reduce((a: number, c: any) => a + (c.weight > 0 ? c.maxScore : 0), 0);

// ---------- Helper UI ----------
const PH_CODE = /vui lòng nhập mã bộ chỉ số/i, PH_NAME = /vui lòng nhập tên bộ chỉ số/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới bộ chỉ số/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: /^\s*Thêm mới Bộ chỉ số\s*$/ }).last().click();
async function pickYear(page: Page, d: Locator, year: number) {
  await d.getByPlaceholder('Chọn năm').click();
  await page.locator(`.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell[title="${year}"]`).click();
  await page.waitForTimeout(300);
}
async function openDetail(page: Page, id: string) {
  await goto(page, `indicator-sets/${id}`);
  await page.getByRole('button', { name: /cập nhật thông tin/i }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
}
async function openBuilder(page: Page, id: string) {
  await goto(page, `indicator-sets/${id}/builder`);
  await page.getByRole('button', { name: /thêm nhóm/i }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
}
async function openEdit(page: Page, id: string) {
  await openDetail(page, id);
  await page.getByRole('button', { name: /cập nhật thông tin/i }).click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(400); return d;
}
const content = (page: Page) => page.locator('.ant-layout-content').first();
const contentText = async (page: Page) => (await content(page).innerText()).replace(/[ \t]+/g, ' ');
/** Số tổng điểm tối đa hiển thị ở trang cấu hình (thẻ "Tổng điểm tối đa (tính điểm)"). */
async function builderTotal(page: Page) {
  const m = (await contentText(page)).match(/Tổng điểm tối đa \(tính điểm\)\s*([\d.,]+)/);
  return m ? m[1] : '';
}
const LOCK = /^\s*Kho[áa]\s*$/i, UNLOCK = /^\s*Mở kho[áa]\s*$/i, CLONE = /^\s*Nhân bản\s*$/i, DEL = /^\s*Xo[áa]\s*$/i;
async function saveGroups(page: Page) {
  await page.getByRole('button', { name: /lưu nhóm/i }).click();
  return await toast(page);
}
async function saveInds(page: Page) {
  await page.getByRole('button', { name: /lưu chỉ số/i }).click();
  return await toast(page);
}
/** Dòng chỉ số (có ô nhập) trong bảng chỉ số của nhóm đang chọn. */
const indRow = (page: Page, code: string) => page.locator('tr').filter({ hasText: code }).filter({ has: page.locator('input') }).last();
/** Mục nhóm trong danh sách nhóm của bộ (kéo thả được) và nút xóa của nó. */
const grpItem = (page: Page, code: string) => page.locator('div[aria-roledescription="sortable"]').filter({ hasText: code }).first();
async function dragGroupAbove(page: Page, code: string, aboveCode: string) {
  const bb = (await grpItem(page, code).locator('button').first().boundingBox())!, tb = (await grpItem(page, aboveCode).boundingBox())!;
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx, cy - ((bb.y - tb.y) + 5) * i / 10, { steps: 2 });
  await page.mouse.up(); await page.waitForTimeout(800);
}
/** Nút cây trong ô chọn chỉ số (TreeSelect) theo mã. */
const treeNode = (page: Page, code: string) => page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-tree-treenode').filter({ hasText: code }).first();
async function openGroupModal(page: Page) {
  await page.getByRole('button', { name: /thêm nhóm/i }).click();
  const m = page.locator('.ant-modal').last(); await m.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return m;
}
async function modalSearch(page: Page, m: Locator, kw: string) {
  await m.getByPlaceholder(/tìm theo mã/i).fill(kw); await page.waitForTimeout(1300);
  return m.locator('tbody tr.ant-table-row');
}

// ================= BỘ LỌC / XEM DANH SÁCH =================
test.describe('Bộ chỉ số › Bộ lọc / Trạng thái', () => {
  test(tc('SET-L12'), async ({ page }) => {
    await openList(page, cfg);
    for (const label of ['Đã khóa', 'Chưa khóa']) {
      await pickOption(page, page.locator(FILTERS).first(), label); await waitList(page);
      const texts = await rowTexts(page);
      expect(texts.length, `phải có bộ chỉ số "${label}"`).toBeGreaterThan(0);
      for (const t of texts) expect(t, `dòng không khớp bộ lọc "${label}"`).toContain(label);
    }
  });
  test(tc('SET-L13'), async ({ page }) => {
    const rec = (await listApi(SETS, 'MBCS_QC01')).find((x: any) => x.status === 'Locked') ?? (await listApi(SETS, '')).find((x: any) => x.status === 'Locked');
    test.skip(!rec, 'Không có bộ chỉ số đã khóa để so sánh');
    await openList(page, cfg);
    const row = await findRow(page, cfg, rec.code);
    const inList = (await row.first().locator('td').nth(7).innerText()).trim();
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/indicator-sets\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1500);
    const head = (await content(page).innerText()).split('Thông tin bộ chỉ số')[0];
    expect(head, `trạng thái ở danh sách "${inList}" nhưng ở chi tiết là [${head.replace(/\s+/g, ' ').trim()}]`).toContain(inList);
  });
});

// ================= XEM CHI TIẾT =================
test.describe('Bộ chỉ số › Xem chi tiết', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SET-V01'), async ({ page }) => {
    const s = await mkFilled(1, { description: 'qc.automation mô tả chi tiết' });
    await openDetail(page, s.id);
    const txt = await contentText(page);
    for (const x of [s.code, s.name, 'v1', '2026', 'Cấu trúc', 'trụ cột', 'nhóm chỉ số', 'chỉ số', 'Tổng điểm tối đa', 'Mô tả', 'qc.automation mô tả chi tiết']) expect(txt, `thiếu "${x}"`).toContain(x);
    for (const b of [/xuất excel/i, /cập nhật thông tin/i, /cấu hình bộ chỉ số/i]) await expect(page.getByRole('button', { name: b }).first()).toBeVisible();
  });
  test(tc('SET-V02'), async ({ page }) => {
    const s = await mkFilled(2);
    await openDetail(page, s.id);
    const rows = page.locator('tr.ant-table-row').filter({ hasText: /QCA/ });
    await expect(rows.filter({ hasText: s.pillar.code })).toHaveCount(1);
    await page.getByRole('button', { name: /mở rộng tất cả/i }).click(); await page.waitForTimeout(600);
    for (const x of s.groups) {
      const r = rows.filter({ hasText: x.g.code });
      await expect(r, `nhóm ${x.g.code} phải hiện sau khi mở rộng`).toHaveCount(1);
      expect(await r.innerText(), 'nhóm phải có số chỉ số và điểm tối đa').toMatch(/3 chỉ số|chỉ số/);
      expect(await r.innerText()).toContain('10,0');
    }
    expect(await rows.filter({ hasText: s.pillar.code }).innerText()).toContain('20,0');
    await page.getByRole('button', { name: /thu gọn/i }).click(); await page.waitForTimeout(600);
    await expect(rows.filter({ hasText: s.groups[0].g.code }), 'sau Thu gọn không còn dòng nhóm').toHaveCount(0);
    await expect(rows.filter({ hasText: s.pillar.code })).toHaveCount(1);
  });
  test(tc('SET-V03'), async ({ page }) => {
    const s = await mkFilled(2);
    const expected = totalOf2(await getSet(s.id));
    expect(expected).toBe(20);
    await openDetail(page, s.id);
    const txt = await contentText(page);
    expect(txt, 'tổng điểm tối đa ở thẻ thông tin').toMatch(new RegExp(`Tổng điểm tối đa\\s*${fmt(expected)}`));
    expect(txt, 'dòng tổng kết cấu trúc').toMatch(new RegExp(`1 trụ cột\\s*·\\s*2 nhóm chỉ số\\s*·\\s*4 chỉ số\\s*·\\s*tổng ${fmt(expected)} điểm`));
    expect(txt, 'thẻ Cấu trúc').toMatch(/1\s*·\s*2\s*·\s*4\s*trụ cột/);
    // số nhóm khớp cột "Nhóm chỉ số" của danh sách
    const rec = await findApi(SETS, s.code);
    expect(rec?.indicatorGroupCount).toBe(2);
  });
  test(tc('SET-V04'), async ({ page }) => {
    const s = await mkFilled(1);
    await openDetail(page, s.id);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), page.getByRole('button', { name: /xuất excel/i }).click()]);
    expect(dl.suggestedFilename()).toMatch(/\.xlsx?$/i);
    const p = await dl.path(); expect(p).toBeTruthy();
    expect((await import('node:fs')).statSync(p!).size, 'file xlsx không rỗng').toBeGreaterThan(1000);
  });
  test(tc('SET-V06'), async ({ page }) => {
    const s = await mkFilled(1); await lockSet(s.id);
    const k = await mkCampaign(s.id);
    await openDetail(page, s.id);
    const listRec = await findApi(SETS, s.code);
    const txt = await contentText(page);
    expect(txt).toContain('Kỳ tự đánh giá sử dụng bộ chỉ số');
    expect(txt, 'kỳ đang dùng phải hiển thị').toContain(k.name);
    expect(txt).toMatch(/trong\s+1\s+bản ghi/i);
    expect(listRec?.campaignCount, 'cột campaignCount ở danh sách').toBe(1);
  });
});
registerNotFoundTest('SET-V05', cfg);

// ================= THÊM MỚI =================
test.describe('Bộ chỉ số › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SET-C01'), async ({ page }) => {
    const code = code8(); roots.push(code);
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Bộ ${code}`);
    await pickYear(page, d, 2026); await d.locator('textarea').fill('qc.automation mô tả');
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi(SETS, code);
    expect(rec?.name).toBe(`qc.automation Bộ ${code}`); expect(rec?.effectiveYear).toBe(2026); expect(rec?.description).toBe('qc.automation mô tả');
    expect(rec?.version).toBe(1); expect(rec?.indicatorGroupCount).toBe(0);
    const row = await findRow(page, cfg, code);
    const tx = (await row.first().innerText()).replace(/\s+/g, ' ');
    expect(tx).toMatch(/ 1 2026 0 0 Chưa khóa/);
  });
  test(tc('SET-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(2);
    await expect(d).toBeVisible();
  });
  test(tc('SET-C03'), async ({ page }) => {
    const a = await mkSet();
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(a.code); await d.getByPlaceholder(PH_NAME).fill('qc.automation Bộ trùng mã');
    await pickYear(page, d, 2026); await submitAdd(d);
    expect(await toast(page)).toMatch(/đã tồn tại/i);
    expect((await listApi(SETS, a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('SET-C04'), async () => {
    const bad: string[] = [];
    for (const [label, year] of [['năm 1999', 1999], ['năm 3000', 3000], ['không có năm', undefined]] as const) {
      const code = code8(); roots.push(code);
      const r = await api('POST', SETS, { code, name: `qc.automation Bộ ${code}`, ...(year ? { effectiveYear: year } : {}) });
      if (r.status < 400) bad.push(`${label}: API nhận (HTTP ${r.status}) nhưng phải bị chặn/báo bắt buộc`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('SET-C05'), async ({ page }) => {
    const code = code8(); roots.push(code);
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill('qc.automation hủy');
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi(SETS, code)).toBeNull();
  });
  test(tc('SET-C06'), async ({ page }) => {
    const code50 = code8() + 'X'.repeat(42); roots.push(code50);
    expect(code50).toHaveLength(50);
    let d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code50); await d.getByPlaceholder(PH_NAME).fill('qc.automation mã 50');
    await pickYear(page, d, 2026); await submitAdd(d);
    expect(await toast(page), 'mã 50 ký tự phải được nhận').toMatch(/thành công/i);
    expect(await findApi(SETS, code50)).toBeTruthy();
    const code51 = code8() + 'Y'.repeat(43); roots.push(code51);
    d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill(code51); await d.getByPlaceholder(PH_NAME).fill('qc.automation mã 51');
    await pickYear(page, d, 2026); await submitAdd(d); await page.waitForTimeout(800);
    const msg = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' ') + ' ' + (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ');
    expect(msg, '51 ký tự phải báo vượt giới hạn').toMatch(/vượt quá|tối đa|giới hạn/i);
    expect(await findApi(SETS, code51), 'mã 51 ký tự không được tạo').toBeNull();
  });
  test(tc('SET-C07'), async () => {
    const code = code8(); roots.push(code);
    const a = await api('POST', SETS, { code, name: '', effectiveYear: 2026 });
    expect(a.status, `tên rỗng (HTTP ${a.status}: ${a.message})`).toBe(400); expect(a.message).not.toBe('');
    const b = await api('POST', SETS, { code: '', name: 'qc.automation code rỗng', effectiveYear: 2026 });
    expect(b.status, `mã rỗng (HTTP ${b.status}: ${b.message})`).toBe(400); expect(b.message).not.toBe('');
  });
});

// ================= CHỈNH SỬA =================
test.describe('Bộ chỉ số › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SET-E01'), async ({ page }) => {
    const s = await mkSet(); const nn = `qc.automation Bộ đã sửa ${s.code}`;
    const d = await openEdit(page, s.id);
    await d.getByPlaceholder(PH_NAME).fill(nn); await d.locator('textarea').fill('qc.automation mô tả mới');
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await getSet(s.id); expect(rec.name).toBe(nn); expect(rec.description).toBe('qc.automation mô tả mới');
    await page.waitForTimeout(800);
    const txt = await contentText(page); expect(txt).toContain(nn); expect(txt).toContain('qc.automation mô tả mới');
    await openList(page, cfg);
    await expect((await findRow(page, cfg, s.code)).first()).toContainText(nn);
  });
  test(tc('SET-E02'), async ({ page }) => {
    const s = await mkSet({ effectiveYear: 2026 });
    const d = await openEdit(page, s.id);
    await pickYear(page, d, 2027); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await getSet(s.id)).effectiveYear).toBe(2027);
    await page.waitForTimeout(800);
    expect(await contentText(page)).toMatch(/Năm áp dụng\s*2027/);
    await openList(page, cfg);
    expect(await (await findRow(page, cfg, s.code)).first().locator('td').nth(4).innerText()).toContain('2027');
  });
  test(tc('SET-E03'), async ({ page }) => {
    const s = await mkSet();
    const d = await openEdit(page, s.id);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await getSet(s.id)).name).toBe(s.name);
  });
  test(tc('SET-E04'), async ({ page }) => {
    const s = await mkSet();
    const d = await openEdit(page, s.id);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await getSet(s.id)).name).toBe(s.name);
  });
  test(tc('SET-E05'), async ({ page }) => {
    const s = await mkFilled(1); await lockSet(s.id);
    const bad: string[] = [];
    await openDetail(page, s.id);
    const upd = page.getByRole('button', { name: /cập nhật thông tin/i });
    if (await upd.count() && await upd.first().isEnabled()) bad.push('UI: nút "Cập nhật thông tin" vẫn bấm được ở bộ đã khóa');
    const cfgBtn = page.getByRole('button', { name: /cấu hình bộ chỉ số/i });
    if (await cfgBtn.count() && await cfgBtn.first().isEnabled()) {
      // vào được trang cấu hình thì thao tác lưu phải bị từ chối
      await goto(page, `indicator-sets/${s.id}/builder`); await page.waitForTimeout(1500);
      const save = page.getByRole('button', { name: /lưu nhóm/i });
      if (await save.count() && await save.first().isEnabled()) { const msg = await saveGroups(page); if (/thành công/i.test(msg)) bad.push(`UI: lưu cấu trúc bộ đã khóa báo thành công ("${msg}")`); }
    }
    const before = await getSet(s.id);
    const put = await api('PUT', `${SETS}/${s.id}`, { code: s.code, name: 'qc.automation SỬA KHI KHÓA', effectiveYear: 2026 });
    if (put.status < 400) bad.push(`API PUT thông tin bộ đã khóa được chấp nhận (HTTP ${put.status})`);
    const pg = await api('PUT', `${SETS}/${s.id}/groups`, []);
    if (pg.status < 400) bad.push(`API PUT nhóm bộ đã khóa được chấp nhận (HTTP ${pg.status})`);
    const pi = await api('PUT', `${SETS}/${s.id}/indicators`, []);
    if (pi.status < 400) bad.push(`API PUT chỉ số bộ đã khóa được chấp nhận (HTTP ${pi.status})`);
    const after = await getSet(s.id);
    if (after.name !== before.name) bad.push(`dữ liệu bị thay đổi: tên "${before.name}" → "${after.name}"`);
    if ((after.groups ?? []).length !== (before.groups ?? []).length) bad.push('cấu trúc nhóm bị thay đổi');
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ================= XÓA =================
test.describe('Bộ chỉ số › Xóa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SET-D01'), async ({ page }) => {
    const s = await mkSet();
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, s.code), DEL); await confirmYes(page);
    expect(await findApi(SETS, s.code)).toBeNull();
    await searchFor(page, cfg, s.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('SET-D02'), async ({ page }) => {
    const s = await mkSet();
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, s.code), DEL); await confirmNo(page);
    expect(await findApi(SETS, s.code)).toBeTruthy();
    await expect((await findRow(page, cfg, s.code)).first()).toBeVisible();
  });
  test(tc('SET-D03'), async ({ page }) => {
    const s = await mkSet(); await lockSet(s.id);
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRow(page, cfg, s.code));
    expect(items.some(i => UNLOCK.test(i)), `menu: ${items.join(' | ')}`).toBeTruthy();
    expect(items.some(i => CLONE.test(i)), `menu: ${items.join(' | ')}`).toBeTruthy();
    expect(items.some(i => DEL.test(i)), `menu: ${items.join(' | ')}`).toBeFalsy();
    const r = await api('DELETE', `${SETS}/${s.id}`);
    expect(r.status).toBeGreaterThanOrEqual(400); expect(await findApi(SETS, s.code)).toBeTruthy();
  });
  test(tc('SET-D04'), async ({ page }) => {
    const s = await mkFilled(1); await lockSet(s.id); await mkCampaign(s.id); await unlockSet(s.id);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, s.code), DEL); await confirmYes(page);
    const msg = await toast(page);
    expect(msg, 'phải báo bị chặn').toMatch(/không thể|đang được dùng|đang sử dụng|không được/i);
    expect(await findApi(SETS, s.code), 'bộ chỉ số phải còn nguyên').toBeTruthy();
  });
});

// ================= KHÓA / MỞ KHÓA =================
test.describe('Bộ chỉ số › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SET-K01'), async ({ page }) => {
    const s = await mkSet();
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, s.code), LOCK); await confirmYes(page);
    expect(await statusOf(s.id)).toBe('Locked');
    await searchFor(page, cfg, s.code);
    const row = dataRows(page).filter({ hasText: s.code });
    await expect(row.first()).toContainText('Đã khóa');
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/indicator-sets\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1500);
    const head = (await content(page).innerText()).split('Thông tin bộ chỉ số')[0];
    expect(head, `chi tiết phải hiện "Đã khóa" nhưng hiện [${head.replace(/\s+/g, ' ').trim()}]`).toMatch(/đã khóa/i);
  });
  test(tc('SET-K02'), async ({ page }) => {
    const s = await mkSet(); await lockSet(s.id);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, s.code), UNLOCK); await confirmYes(page);
    expect(await statusOf(s.id)).toBe('Draft');
    await searchFor(page, cfg, s.code);
    await expect(dataRows(page).filter({ hasText: s.code }).first()).toContainText('Chưa khóa');
    const items = await rowMenuItems(page, dataRows(page).filter({ hasText: s.code }));
    expect(items.some(i => /cập nhật/i.test(i)), `sau mở khóa phải sửa lại được: ${items.join(' | ')}`).toBeTruthy();
  });
  test(tc('SET-K03'), async ({ page }) => {
    const a = await mkSet(); await lockSet(a.id);   // đã khóa
    const b = await mkSet();                        // chưa khóa
    await goto(page, 'self-assessment-campaigns');
    await page.getByRole('button', { name: /thêm mới tự đánh giá/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    const sel = d.locator('.ant-form-item').filter({ hasText: /bộ chỉ số/i }).locator('.ant-select').first();
    const optsFor = async (kw: string) => {
      await sel.click(); await page.keyboard.press('Control+A'); await page.keyboard.type(kw); await page.waitForTimeout(1200);
      const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
      const t = await dd.locator('.ant-select-item-option').allInnerTexts();
      await page.keyboard.press('Escape'); return t;
    };
    expect((await optsFor(a.code)).join('|'), 'bộ đã khóa phải được liệt kê').toContain(a.name);
    expect((await optsFor(b.code)).join('|'), 'bộ chưa khóa không được liệt kê').not.toContain(b.name);
  });
  test(tc('SET-K04'), async ({ page }) => {
    const s = await mkFilled(1); await lockSet(s.id); await mkCampaign(s.id);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, s.code), UNLOCK);
    await page.waitForTimeout(600);
    const confirmTxt = (await page.locator('.ant-modal-confirm, .ant-modal, .ant-popover').last().innerText().catch(() => '')).replace(/\s+/g, ' ');
    await confirmYes(page);
    const msg = await toast(page);
    const status = await statusOf(s.id);
    const warned = /kỳ|đang được sử dụng|đang sử dụng|cảnh báo/i.test(confirmTxt + ' ' + msg);
    expect(status === 'Locked' || warned, `mở khóa bộ đang được kỳ sử dụng: trạng thái → ${status}, hộp thoại="${confirmTxt}", thông báo="${msg}" (không chặn, không cảnh báo)`).toBeTruthy();
  });
});

// ================= CẤU TRÚC: NHÓM CHỈ SỐ =================
test.describe('Bộ chỉ số › Cấu trúc (nhóm chỉ số)', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SET-S01'), async ({ page }) => {
    const s = await mkFilled(2);
    await openBuilder(page, s.id);
    const txt = await contentText(page);
    for (const x of s.groups) { expect(txt).toContain(x.g.code); expect(txt).toContain(x.g.name); }
    expect(txt.toLowerCase(), 'nhóm hiển thị theo trụ cột').toContain(s.pillar.name.toLowerCase());
    expect(txt).toMatch(/Nhóm chỉ số\s*2/);
  });
  test(tc('SET-S02'), async ({ page }) => {
    const t = await mkTree(1); const s = await mkSet();
    await openBuilder(page, s.id);
    const m = await openGroupModal(page);
    const rows = await modalSearch(page, m, t.groups[0].g.code);
    await expect(rows).toHaveCount(1);
    await rows.first().locator('input[type=checkbox]').check();
    await m.getByRole('button', { name: /^\s*Lưu\s*$/ }).click(); await page.waitForTimeout(800);
    expect(await saveGroups(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(d.groups.map((g: any) => g.indicatorGroupId)).toEqual([t.groups[0].g.id]);
    expect((await findApi(SETS, s.code))?.indicatorGroupCount).toBe(1);
    expect(await contentText(page)).toContain(t.groups[0].g.code);
  });
  test(tc('SET-S03'), async ({ page }) => {
    const s = await mkFilled(1);
    await openBuilder(page, s.id);
    const m = await openGroupModal(page);
    const rows = await modalSearch(page, m, s.groups[0].g.code);
    const selectable = (await rows.count()) > 0 && await rows.first().locator('input[type=checkbox]').isEnabled() && /có thể chọn/i.test(await rows.first().innerText());
    expect(selectable, 'nhóm đã có trong bộ không được chọn lại').toBeFalsy();
    const r = await api('PUT', `${SETS}/${s.id}/groups`, [1, 2].map(o => ({ indicatorGroupId: s.groups[0].g.id, displayOrder: o, isScored: true })));
    expect(r.status, `API thêm trùng nhóm (HTTP ${r.status}: ${r.message})`).toBe(400);
  });
  test(tc('SET-S04'), async ({ page }) => {
    const t = await mkTree(1); const s = await mkSet();
    const open = await ensureGroup(made, { pillarId: t.pillar.id, lock: false });
    await openBuilder(page, s.id);
    const m = await openGroupModal(page);
    const r1 = await modalSearch(page, m, t.groups[0].g.code);
    await expect(r1, 'nhóm đã khóa phải được liệt kê').toHaveCount(1);
    expect(await r1.first().innerText()).toMatch(/có thể chọn/i);
    const r2 = await modalSearch(page, m, open.code);
    expect(await r2.count(), `nhóm chưa khóa ${open.code} không được liệt kê`).toBe(0);
  });
  test(tc('SET-S05'), async ({ page }) => {
    const s = await mkFilled(2);
    const g0 = (await api('GET', `dti/indicator-groups/${s.groups[0].g.id}`)).data;
    await openBuilder(page, s.id);
    // đổi thứ tự hiển thị: kéo nhóm 2 lên trước nhóm 1 rồi lưu
    await dragGroupAbove(page, s.groups[1].g.code, s.groups[0].g.code);
    expect(await saveGroups(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(d.groups.map((g: any) => g.indicatorGroupCode)).toEqual([s.groups[1].g.code, s.groups[0].g.code]);
    const g1 = (await api('GET', `dti/indicator-groups/${s.groups[0].g.id}`)).data;
    expect([g1.displayOrder, g1.name, g1.isLocked], 'nhóm gốc không đổi').toEqual([g0.displayOrder, g0.name, g0.isLocked]);
  });
  test(tc('SET-S06'), async ({ page }) => {
    const s = await mkFilled(2);
    await openBuilder(page, s.id);
    await grpItem(page, s.groups[1].g.code).locator('button[title*="Xóa"]').click(); await confirmYes(page);
    expect(await saveGroups(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(d.groups.map((g: any) => g.indicatorGroupCode)).toEqual([s.groups[0].g.code]);
    expect(flatInds(d).map((i: any) => i.indicatorCode), 'chỉ số của nhóm bị xóa phải rời bộ').not.toContain(s.groups[1].c1.code);
    expect((await api('GET', `dti/indicator-groups/${s.groups[1].g.id}`)).status, 'nhóm gốc còn nguyên').toBe(200);
  });
  test(tc('SET-S07'), async ({ page }) => {
    const s = await mkFilled(2);
    await openBuilder(page, s.id);
    expect(await builderTotal(page)).toBe('20,0');
    // chọn nhóm 2 rồi tắt cờ "Tính điểm cho nhóm"
    await grpItem(page, s.groups[1].g.code).click(); await page.waitForTimeout(500);
    await page.locator('[role=switch]').first().click(); await page.waitForTimeout(500);
    expect(await saveGroups(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(d.groups.find((g: any) => g.indicatorGroupCode === s.groups[1].g.code).isScored).toBe(false);
    await openDetail(page, s.id);
    expect(await contentText(page), 'tổng điểm phải loại nhóm không tính điểm').toMatch(/Tổng điểm tối đa\s*10,0/);
  });
});

// ================= NỘI DUNG: CHỈ SỐ =================
test.describe('Bộ chỉ số › Nội dung (chỉ số)', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('SET-I01'), async ({ page }) => {
    const s = await mkFilled(1);
    await openBuilder(page, s.id);
    const txt = await contentText(page);
    for (const c of [s.groups[0].par, s.groups[0].c1, s.groups[0].c2]) expect(txt, `thiếu chỉ số ${c.code}`).toContain(c.code);
    expect(await indRow(page, s.groups[0].c1.code).locator('input').nth(2).inputValue()).toBe('5');
    expect(await builderTotal(page)).toBe('10,0');
  });
  test(tc('SET-I02'), async ({ page }) => {
    const t = await mkTree(1);
    const x = await ensureIndicator(made, { groupId: t.groups[0].g.id, pillarId: t.pillar.id, parentId: t.groups[0].par.id, max: 5, lock: true });
    const s = await mkSet(); await fillStruct(s.id, t.groups);
    await openBuilder(page, s.id);
    await page.locator('.ant-select').filter({ hasText: /chọn chỉ số/i }).first().click(); await page.waitForTimeout(500);
    await treeNode(page, x.code).locator('.ant-select-tree-checkbox').click();
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.getByRole('button', { name: /thêm mới chỉ số/i }).click(); await page.waitForTimeout(500);
    expect(await saveInds(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(flatInds(d).map((i: any) => i.indicatorCode)).toContain(x.code);
    const ind = await api('GET', `dti/indicators/${x.id}`);
    expect((ind.data.usedIndicatorSets ?? []).map((u: any) => u.code), 'cột "Bộ chỉ số đang sử dụng" của chỉ số').toContain(s.code);
  });
  test(tc('SET-I03'), async ({ page }) => {
    const t = await mkTree(2); const s = await mkSet(); await fillStruct(s.id, [t.groups[0]]);
    const bad: string[] = [];
    const r = await api('PUT', `${SETS}/${s.id}/indicators`, [...indBody(t.groups[0]), ...indBody(t.groups[1])].map((x, i) => ({ ...x, displayOrder: i + 1 })));
    if (r.status < 400) bad.push(`chỉ số của nhóm chưa có trong bộ được chấp nhận (HTTP ${r.status})`);
    const dup = await api('PUT', `${SETS}/${s.id}/indicators`, [...indBody(t.groups[0]), indBody(t.groups[0])[1]].map((x, i) => ({ ...x, displayOrder: i + 1 })));
    if (dup.status < 400) bad.push(`chỉ số trùng được chấp nhận (HTTP ${dup.status})`);
    await openBuilder(page, s.id);
    await page.locator('.ant-select').filter({ hasText: /chọn chỉ số/i }).first().click(); await page.waitForTimeout(600);
    await expect(treeNode(page, t.groups[0].par.code), 'ô chọn phải liệt kê cây chỉ số của nhóm trong bộ').toHaveCount(1);
    for (const c of [t.groups[0].par, t.groups[0].c1, t.groups[0].c2]) {
      const n = treeNode(page, c.code);
      const off = (await n.getAttribute('class'))?.includes('disabled') || await n.locator('.ant-select-tree-checkbox-disabled').count();
      if (!off) bad.push(`ô chọn cho chọn lại chỉ số đã có ${c.code}`);
    }
    if (await treeNode(page, t.groups[1].c1.code).count()) bad.push(`ô chọn liệt kê chỉ số của nhóm chưa có trong bộ (${t.groups[1].c1.code})`);
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('SET-I04'), async ({ page }) => {
    const s = await mkFilled(1); const g = s.groups[0];
    const before = (await api('GET', `dti/indicators/${g.c1.id}`)).data;
    await openBuilder(page, s.id);
    await indRow(page, g.c1.code).locator('input').nth(0).fill('2');
    expect(await saveInds(page)).toMatch(/thành công/i);
    const c1 = flatInds(await getSet(s.id)).find((i: any) => i.indicatorCode === g.c1.code);
    expect(c1.weight).toBe(2);
    const after = (await api('GET', `dti/indicators/${g.c1.id}`)).data;
    expect([after.name, after.minScore, after.maxScore]).toEqual([before.name, before.minScore, before.maxScore]);
  });
  test(tc('SET-I05'), async ({ page }) => {
    const s = await mkFilled(1); const g = s.groups[0];
    await openBuilder(page, s.id);
    await indRow(page, g.c2.code).locator('.anticon-delete').first().click();
    await page.waitForTimeout(500);
    if (await page.locator('.ant-modal-confirm, .ant-popover').count()) await confirmYes(page);
    expect(await saveInds(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(flatInds(d).map((i: any) => i.indicatorCode)).not.toContain(g.c2.code);
    expect((await api('GET', `dti/indicators/${g.c2.id}`)).status, 'chỉ số gốc còn nguyên').toBe(200);
    expect(totalOf2(d)).toBe(5);
    await page.reload(); await page.waitForTimeout(1500);
    expect(await builderTotal(page)).toBe('5,0');
  });
  test(tc('SET-I06'), async ({ page }) => {
    const s = await mkFilled(1); const g = s.groups[0];
    await openBuilder(page, s.id);
    await indRow(page, g.c2.code).locator('[role=switch]').click(); await page.waitForTimeout(400);
    expect(await saveInds(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(flatInds(d).find((i: any) => i.indicatorCode === g.c2.code).isScored).toBe(false);
    await openDetail(page, s.id);
    expect(await contentText(page), 'chỉ số không tính điểm bị loại khỏi tổng điểm tối đa').toMatch(/Tổng điểm tối đa\s*5,0/);
  });
  test(tc('SET-I07'), async ({ page }) => {
    const s = await mkFilled(1); const g = s.groups[0];
    await openBuilder(page, s.id);
    await indRow(page, g.c1.code).locator('input').nth(2).fill('4');
    expect(await saveInds(page)).toMatch(/thành công/i);
    const d = await getSet(s.id);
    expect(flatInds(d).find((i: any) => i.indicatorCode === g.c1.code).maxScore).toBe(4);
    expect((await api('GET', `dti/indicators/${g.c1.id}`)).data.maxScore, 'chỉ số gốc không đổi').toBe(5);
    await page.reload(); await page.waitForTimeout(1500);
    expect(await builderTotal(page), 'tổng điểm tính lại').toBe('9,0');
  });
  test(tc('SET-I08'), async ({ page }) => {
    const s = await mkFilled(1); const g = s.groups[0];
    const bad: string[] = [];
    await openBuilder(page, s.id);
    for (const [min, max, label] of [['8', '3', 'min > max'], ['-1', '3', 'điểm âm']] as const) {
      const r = indRow(page, g.c1.code).locator('input');
      await r.nth(1).fill(min); await r.nth(2).fill(max);
      // ô nhập không cho gõ dấu trừ → giá trị bị chặn ngay ở ô nhập (không cần lưu)
      if (!(await r.nth(1).inputValue()).startsWith(min.charAt(0) === '-' ? '-' : min)) { await page.reload(); await page.waitForTimeout(1500); continue; }
      const msg = await saveInds(page);
      if (/thành công/i.test(msg)) bad.push(`${label}: UI báo lưu thành công`);
      const c1 = flatInds(await getSet(s.id)).find((i: any) => i.indicatorCode === g.c1.code);
      if (c1.minScore !== 0 || c1.maxScore !== 5) bad.push(`${label}: dữ liệu bị lưu (${c1.minScore}-${c1.maxScore})`);
      await page.reload(); await page.waitForTimeout(1500);
    }
    const api1 = await api('PUT', `${SETS}/${s.id}/indicators`, indBody(g).map((x, i) => ({ ...x, displayOrder: i + 1, maxScore: x.maxScore, minScore: i === 1 ? 8 : 0 })));
    if (api1.status !== 400) bad.push(`API min>max trả HTTP ${api1.status}`);
    const api2 = await api('PUT', `${SETS}/${s.id}/indicators`, indBody(g).map((x, i) => ({ ...x, displayOrder: i + 1, maxScore: i === 1 ? 1001 : x.maxScore })));
    if (api2.status !== 400) bad.push(`API điểm > 1000 trả HTTP ${api2.status}`);
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ================= NHÂN BẢN =================
test.describe('Bộ chỉ số › Nhân bản', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  const cloneApi = async (id: string) => { const r = await api('POST', `${SETS}/${id}/clone`, {}); if (r.status !== 200) throw new Error('nhân bản lỗi: ' + r.message); return r.data; };
  test(tc('SET-N01'), async ({ page }) => {
    const s = await mkFilled(2);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, s.code), CLONE); await confirmYes(page);
    expect(await toast(page)).toMatch(/thành công/i);
    const copies = (await listApi(SETS, s.code)).filter((x: any) => x.code !== s.code && String(x.code).startsWith(s.code));
    expect(copies, 'phải có 1 bản sao').toHaveLength(1);
    const c = copies[0]; const o = await findApi(SETS, s.code);
    expect(c.code).not.toBe(s.code); expect(c.status).toBe('Draft');
    expect(c.indicatorGroupCount).toBe(o.indicatorGroupCount); expect(c.childrenCount).toBe(o.childrenCount);
    expect(totalOf2(await getSet(c.id))).toBe(totalOf2(await getSet(s.id)));
    expect(flatInds(await getSet(c.id)).length).toBe(flatInds(await getSet(s.id)).length);
  });
  test(tc('SET-N02'), async ({ page }) => {
    const s = await mkFilled(1); await lockSet(s.id);
    await openList(page, cfg);
    const row = await findRow(page, cfg, s.code);
    expect((await rowMenuItems(page, row)).some(i => CLONE.test(i))).toBeTruthy();
    await rowAction(page, row, CLONE); await confirmYes(page);
    expect(await toast(page)).toMatch(/thành công/i);
    const copies = (await listApi(SETS, s.code)).filter((x: any) => x.code !== s.code && String(x.code).startsWith(s.code));
    expect(copies).toHaveLength(1); expect(copies[0].status).toBe('Draft');
    expect((await getSet(s.id)).status, 'bản gốc vẫn khóa').toBe('Locked');
  });
  test(tc('SET-N03'), async () => {
    const s = await mkFilled(1);
    const cs = [await cloneApi(s.id), await cloneApi(s.id), await cloneApi(s.id)];
    const codes = [s.code, ...cs.map(c => c.code)];
    expect(new Set(codes.map(c => c.toUpperCase())).size, `mã trùng: ${codes.join(', ')}`).toBe(4);
    const keys = [[s.name, 1], ...cs.map(c => [c.name, c.version])].map(x => x.join('@'));
    expect(new Set(keys).size, `tên/phiên bản trùng giữa các bản: ${keys.join(' | ')}`).toBe(4);
  });
  test(tc('SET-N04'), async ({ page }) => {
    const s = await mkFilled(1); const g = s.groups[0];
    const c = await cloneApi(s.id);
    await openBuilder(page, c.id);
    await indRow(page, g.c1.code).locator('input').nth(2).fill('3');
    expect(await saveInds(page)).toMatch(/thành công/i);
    await openBuilder(page, c.id);
    await indRow(page, g.c2.code).locator('.anticon-delete').first().click(); await page.waitForTimeout(400);
    if (await page.locator('.ant-modal-confirm, .ant-popover').count()) await confirmYes(page);
    await expect(indRow(page, g.c2.code), 'dòng chỉ số đã bị xóa khỏi giao diện').toHaveCount(0);
    expect(await saveInds(page)).toMatch(/thành công/i);
    const cc = flatInds(await getSet(c.id));
    expect(cc.find((i: any) => i.indicatorCode === g.c1.code).maxScore).toBe(3);
    expect(cc.map((i: any) => i.indicatorCode)).not.toContain(g.c2.code);
    const o = await getSet(s.id);
    expect(flatInds(o).find((i: any) => i.indicatorCode === g.c1.code).maxScore, 'bản gốc không đổi').toBe(5);
    expect(flatInds(o).map((i: any) => i.indicatorCode)).toContain(g.c2.code);
  });
  test(tc('SET-N05'), async () => {
    const r = await api('POST', `${SETS}/00000000-0000-4000-8000-000000000000/clone`, {});
    expect(r.status, `nhân bản id lạ (HTTP ${r.status}: ${r.message})`).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });
});

// ================= EDGE / LỖI (G01..G05 của SET) =================
test.describe('Bộ chỉ số › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  const fillValid = async (page: Page, d: Locator, code: string) => {
    await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Bộ ${code}`); await pickYear(page, d, 2026);
  };
  test(tc('SET-G01'), async ({ page }) => {
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_CODE).fill('   '); await d.getByPlaceholder(PH_NAME).fill('   '); await submitAdd(d);
    await page.waitForTimeout(900);
    const msg = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' ');
    const inline = await d.locator('.ant-form-item-explain-error').count();
    expect(inline > 0 || /không được để trống|bắt buộc|không hợp lệ/i.test(msg), `chuỗi chỉ có khoảng trắng phải bị báo lỗi (inline=${inline}, toast="${msg}")`).toBeTruthy();
    expect(msg).not.toMatch(/thành công/i);
    await expect(d).toBeVisible();
  });
  test(tc('SET-G02'), async ({ page }) => {
    const s = await mkSet({ name: SPECIAL_NAME });
    await openList(page, cfg); await page.reload(); await waitList(page);
    const row = await findRow(page, cfg, s.code);
    expect((await row.first().innerText()).replace(/\s+/g, ' ')).toContain(SPECIAL_NAME);
    expect(await row.first().locator('b').count(), 'HTML trong tên phải hiển thị dạng chữ').toBe(0);
  });
  for (const [id, mode] of [['SET-G03', 'http500'], ['SET-G04', 'offline']] as const) {
    test(tc(id), async ({ page }) => {
      const code = code8(); roots.push(code);
      const d = await openAdd(page); await fillValid(page, d, code);
      const re = /\/api\/v1\/dti\/indicator-sets$/;
      await page.route(re, r => {
        if (r.request().method() !== 'POST') return r.continue();
        return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
      });
      await submitAdd(d); await page.waitForTimeout(1500);
      await expect(d, 'form phải còn mở để người dùng thử lại').toBeVisible();
      expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
      expect(await d.locator('input').first().inputValue(), 'dữ liệu đã nhập không được mất').not.toBe('');
      await page.unroute(re);
      expect(await findApi(SETS, code)).toBeNull();
    });
  }
  test(tc('SET-G05'), async ({ page }) => {
    const code = code8(); roots.push(code);
    const d = await openAdd(page); await fillValid(page, d, code);
    await Promise.all([submitAdd(d), Promise.race([submitAdd(d).catch(() => {}), page.waitForTimeout(3000)])]);
    await page.waitForTimeout(2500);
    expect((await listApi(SETS, code)).filter((x: any) => x.code === code).length, 'bấm Lưu 2 lần chỉ được tạo đúng 1 bản ghi').toBe(1);
  });
});

// ================= PHÂN QUYỀN / HIỆU NĂNG =================
test.describe('Bộ chỉ số › Bảo mật / Hiệu năng', () => {
  registerAuthTest('SET-A01', cfg);
  // quyền Xem/Thêm/Sửa/Xóa/Khóa của tài khoản canbo theo ma trận quyền
  test(tc('SET-A02'), async () => {
    const m = await api('GET', 'idm/permission-matrix/me', undefined, 'canbo');
    const perms = new Set(Object.values(m.data ?? {}).map((x: any) => x.code));
    const fake = '00000000-0000-0000-0000-000000000000';
    const checks: [string, string, any, string][] = [
      ['GET', `${SETS}?page=1&size=1`, undefined, 'VIEW'],
      ['POST', SETS, {}, 'CREATE'],
      ['PUT', `${SETS}/${fake}`, { code: 'X', name: 'X' }, 'UPDATE'],
      ['DELETE', `${SETS}/${fake}`, undefined, 'DELETE'],
      ['POST', `${SETS}/${fake}/lock`, {}, 'LOCK'],
    ];
    const bad: string[] = [];
    for (const [meth, url, body, act] of checks) {
      const s = (await api(meth, url, body, 'canbo')).status, has = perms.has(`${cfg.perm}.${act}`);
      if (has && (s === 401 || s === 403)) bad.push(`${meth} ${url}: có ${cfg.perm}.${act} nhưng bị ${s}`);
      if (!has && s !== 403) bad.push(`${meth} ${url}: KHÔNG có ${cfg.perm}.${act} nhưng trả ${s} (kỳ vọng 403)`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('SET-A03'), async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`/#/vi/${cfg.route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(page.url() + ' ' + body, 'phải chuyển về màn đăng nhập').toMatch(/login|đăng nhập/);
    expect(await dataRows(page).count(), 'không được lộ dữ liệu').toBe(0);
    await ctx.close();
  });
  registerPerfTest('SET-P01', cfg);
});
void [tokenOf, apiStatus, confirmNo, pickOption, btnSave];
