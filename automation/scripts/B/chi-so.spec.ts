// B Chỉ số (DTI) — script bám testcase IND-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, cellText, totalOf, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, FILTERS,
  ensurePillar, ensureGroup, ensureIndicator, ensureSet, registerAuthTest, registerMatrixTest, registerPerfTest, SPECIAL_NAME,
} from './common';

const cfg = PAGES.IND;
const RES = 'dti/indicators';
const made = new Made();
test.afterEach(async () => { await made.clean(); });

const PH = { code: /mã chỉ số/i, name: /tên chỉ số/i, desc: /nội dung, cách xác định/i, min: /điểm tối thiểu/i, max: /điểm tối đa/i };
const MENU = { lock: /^\s*kh(oá|óa)\s*$/i, unlock: /^\s*mở kh(oá|óa)\s*$/i, edit: /cập nhật/i, del: /xo[áạ]/i, clone: /nhân bản/i };
const ERR_500 = /error occurred|entity changes|stack ?trace|exception|at com\.|undefined|innerexception/i;

// ---------- Helper ----------
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới chỉ số/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: /^\s*Thêm mới Chỉ số\s*$/ }).last().click();
async function fillForm(d: Locator, f: { code?: string; name?: string; desc?: string; min?: string; max?: string }) {
  if (f.code !== undefined) await d.getByPlaceholder(PH.code).fill(f.code);
  if (f.name !== undefined) await d.getByPlaceholder(PH.name).fill(f.name);
  if (f.desc !== undefined) await d.getByPlaceholder(PH.desc).fill(f.desc);
  if (f.min !== undefined) await d.getByPlaceholder(PH.min).fill(f.min);
  if (f.max !== undefined) await d.getByPlaceholder(PH.max).fill(f.max);
}
/** Ô Chỉ số cha là TreeSelect: mở rồi chọn node có mã `code`. */
async function pickParent(page: Page, d: Locator, code: string) {
  await d.locator('.ant-form-item').filter({ hasText: /chỉ số cha/i }).locator('.ant-select').first().click();
  const dd = page.locator('.ant-tree-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.waitFor({ state: 'visible' });
  await dd.getByText(`${code} - `).first().click();
  await page.waitForTimeout(400);
}
async function parentOptions(page: Page, d: Locator): Promise<string> {
  await d.locator('.ant-form-item').filter({ hasText: /chỉ số cha/i }).locator('.ant-select').first().click();
  const dd = page.locator('.ant-tree-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
  const t = await dd.innerText();
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  return t;
}
async function pillarOf(g: any) { return (await api('GET', `dti/pillars/${g.pillarId}`)).data as any; }
/** Điền form thêm chỉ số hợp lệ (chọn trụ cột, nhóm bằng UI). */
async function uiFill(page: Page, d: Locator, o: { pillar: any; group: any; code: string; name?: string; min?: string; max?: string; desc?: string; parent?: string }) {
  await pickByLabel(page, d, /trụ cột/i, o.pillar.name);
  await pickByLabel(page, d, /nhóm chỉ số/i, o.group.name);
  if (o.parent) await pickParent(page, d, o.parent);
  await fillForm(d, { code: o.code, name: o.name ?? `qc.automation Chỉ số ${o.code}`, min: o.min ?? '0', max: o.max ?? '10', desc: o.desc });
}
async function ctx() { const g = await ensureGroup(made); const p = await pillarOf(g); return { g, p }; }
const rowOf = (page: Page, code: string) => dataRows(page).filter({ has: page.getByText(code, { exact: true }) });
async function findRowExact(page: Page, code: string) { await searchFor(page, cfg, code); return rowOf(page, code); }
async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  await (await findRowExact(page, code)).first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/indicators\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1500);
}
async function openEdit(page: Page, code: string) {
  await openList(page, cfg);
  await rowAction(page, await findRowExact(page, code), MENU.edit);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return d;
}
const getInd = async (id: string) => (await api('GET', `${RES}/${id}`)).data as any;
const lockApi = (id: string) => api('PUT', `${RES}/${id}/lock`, {});
const putBody = (rec: any, extra: any = {}) => ({ indicatorGroupId: rec.indicatorGroupId, pillarId: rec.pillarId, parentId: rec.parentId ?? undefined, code: rec.code, name: rec.name, minScore: rec.minScore, maxScore: rec.maxScore, ...extra });
/** Đưa chỉ số vào bộ chỉ số mới (qua API cấu trúc + nội dung bộ). */
async function putInSet(ind: any) {
  const s = await ensureSet(made);
  const a = await api('PUT', `dti/indicator-sets/${s.id}/groups`, [{ indicatorGroupId: ind.indicatorGroupId, displayOrder: 1, isScored: true }]);
  const b = await api('PUT', `dti/indicator-sets/${s.id}/indicators`, [{ indicatorId: ind.id, indicatorGroupId: ind.indicatorGroupId, weight: 1, displayOrder: 1, isScored: true }]);
  if (a.status !== 200 || b.status !== 200) throw new Error(`Gán chỉ số vào bộ lỗi: ${a.message} / ${b.message}`);
  return s;
}
/** Theo dõi các bản sao (mã bắt đầu bằng mã gốc) để dọn. */
async function trackClones(code: string) {
  const all = (await listApi(RES, code)).filter((x: any) => String(x.code).startsWith(code) && x.code !== code);
  for (const x of all) made.add(RES, x.code);
  return all;
}

// ================= DANH SÁCH / TÌM KIẾM / PHÂN TRANG =================
test.describe('Chỉ số › Danh sách / Tìm kiếm / Phân trang', () => {
  test(tc('IND-L01'), async ({ page }) => {
    await openList(page, cfg);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    for (const re of cfg.cols) expect(heads.some(h => re.test(h)), `thiếu cột ${re} trong [${heads.join(' | ')}]`).toBeTruthy();
    expect(await dataRows(page).count()).toBeGreaterThan(0);
  });
  test(tc('IND-L02'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page), rows = await dataRows(page).count();
    expect(rows).toBe(Math.min(10, n));
    expect(await page.locator('.ant-pagination').first().innerText()).toMatch(/trong\s+\d+/i);
  });
  test(tc('IND-L03'), async ({ page }) => {
    await openList(page, cfg);
    const kw = await cellText(page, 0, cfg.codeIdx);
    await searchFor(page, cfg, kw);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('IND-L04'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await cellText(page, 0, cfg.nameIdx)).slice(0, 25).trim();
    await searchFor(page, cfg, kw);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('IND-L05'), async ({ page }) => {
    await openList(page, cfg);
    await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
    expect(await dataRows(page).count()).toBe(0);
    await expect(page.locator('.ant-empty, .ant-table-placeholder').first()).toBeVisible();
  });
  test(tc('IND-L06'), async ({ page }) => {
    await openList(page, cfg);
    const kw = await cellText(page, 0, cfg.codeIdx);
    await searchFor(page, cfg, kw.toUpperCase()); const a = await totalOf(page);
    await searchFor(page, cfg, kw.toLowerCase()); const b = await totalOf(page);
    expect(a).toBeGreaterThan(0);
    expect(b, 'HOA/thường phải cho cùng số kết quả').toBe(a);
  });
  test(tc('IND-L07'), async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', d => { dialogSeen = true; d.dismiss().catch(() => {}); });
    await openList(page, cfg);
    for (const bad of ["' OR 1=1 --", '<script>alert(1)</script>', '"; DROP TABLE users; --']) {
      await searchFor(page, cfg, bad);
      const body = (await page.locator('body').innerText()).toLowerCase();
      expect(body).not.toMatch(/internal server error|exception|stack ?trace|sqlexception|syntax error/);
      for (const t of await rowTexts(page)) expect(t.toLowerCase(), `"${bad}" khớp bản ghi không chứa chuỗi này`).toContain(bad.toLowerCase());
    }
    expect(dialogSeen, 'không được thực thi script (XSS)').toBeFalsy();
  });
  test(tc('IND-L08'), async ({ page }) => {
    await openList(page, cfg);
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    const before = (await rowTexts(page)).join('|');
    await page.locator('.ant-pagination-item-2').first().click();
    await waitList(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    expect((await rowTexts(page)).join('|')).not.toBe(before);
  });
  test(tc('IND-L09'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await pickOption(page, page.locator('.ant-pagination-options .ant-select').first(), '20');
    await waitList(page);
    expect(await dataRows(page).count()).toBe(Math.min(20, n));
    expect(await totalOf(page)).toBe(n);
  });
  test(tc('IND-L10'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page);
    await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
    expect(await totalOf(page)).toBe(0);
    await searchFor(page, cfg, '');
    expect(await totalOf(page)).toBe(n);
  });
});

test.describe('Chỉ số › Bộ lọc / Cấu trúc cha-con', () => {
  test.describe.configure({ timeout: 60_000 });
  /** Chọn option của bộ lọc thứ idx (0: nhóm chỉ số, 1: trạng thái). */
  async function pickFilter(page: Page, idx: number, text: string) {
    const s = page.locator(FILTERS).nth(idx);
    await s.click();
    if (idx === 0) await page.keyboard.type(text.slice(0, 20));
    await page.waitForTimeout(700);
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dd.locator('.ant-select-item-option', { hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first().click();
    await waitList(page);
  }
  // Giao diện chỉ có bộ lọc Nhóm chỉ số (đã gồm trụ cột cha) và Trạng thái
  test(tc('IND-L12'), async ({ page }) => {
    await openList(page, cfg);
    const group = await cellText(page, 0, 4);
    await pickFilter(page, 0, group);
    const rows = dataRows(page);
    expect(await rows.count()).toBeGreaterThan(0);
    for (let i = 0; i < await rows.count(); i++) {
      expect(await cellText(page, i, 4), `dòng ${i + 1} sai nhóm`).toBe(group);
    }
  });
  test(tc('IND-L13'), async ({ page }) => {
    await openList(page, cfg);
    for (const label of ['Đã khóa', 'Chưa khóa']) {
      await pickFilter(page, 1, label);
      const texts = await rowTexts(page);
      expect(texts.length, `phải có chỉ số "${label}"`).toBeGreaterThan(0);
      for (const t of texts) expect(t).toContain(label);
    }
  });
  test(tc('IND-L14'), async ({ page }) => {
    await openList(page, cfg);
    const kw = await cellText(page, 0, cfg.codeIdx);
    const status = (await dataRows(page).first().innerText()).includes('Đã khóa') ? 'Đã khóa' : 'Chưa khóa';
    await searchFor(page, cfg, kw);
    await pickFilter(page, 1, status);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) { expect(t.toLowerCase()).toContain(kw.toLowerCase()); expect(t).toContain(status); }
    const other = status === 'Đã khóa' ? 'Chưa khóa' : 'Đã khóa';
    await pickFilter(page, 1, other);
    for (const t of await rowTexts(page)) expect(t, 'kết hợp từ khóa + trạng thái khác phải loại dòng').not.toContain(status);
  });
  test(tc('IND-L15'), async ({ page }) => {
    let rec: any = null;
    for (let pg = 1; pg <= 10 && !rec; pg++) {
      const r = await api('GET', `${RES}?page=${pg}&size=100`);
      rec = (r.data?.content ?? []).find((x: any) => x.childrenCount > 0 && !x.parentId);
      if (pg >= (r.data?.totalPages ?? 1)) break;
    }
    test.skip(!rec, 'Hệ thống chưa có chỉ số cha có chỉ số con');
    await openList(page, cfg);
    const row = (await findRowExact(page, rec.code)).first();
    const n = Number((await row.locator('td').nth(5).innerText()).trim());
    expect(n).toBe(rec.childrenCount);
    await row.getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/indicators\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1500);
    expect(await page.locator('.ant-table').first().locator('tbody tr.ant-table-row').count(), 'số dòng bảng "Chỉ số con"').toBe(n);
  });
});

// ================= XEM CHI TIẾT =================
test.describe('Chỉ số › Xem chi tiết (đọc)', () => {
  test.describe.configure({ timeout: 60_000 });
  test(tc('IND-V02'), async ({ page }) => { await notFoundBody(page); });
  async function notFoundBody(page: Page) {
    const fake = '00000000-0000-4000-8000-000000000000';
    const r = await api('GET', `${RES}/${fake}`);
    expect(r.status, `GET ${RES}/<id lạ> phải 4xx, không 500 (HTTP ${r.status})`).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    await page.goto(`/#/vi/${cfg.route}/${fake}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toMatch(/stack ?trace|exception|at com\.|undefined|cannot read/);
    expect((await page.locator('.ant-layout-content, #root').first().innerText()).trim().length, 'trang không được trắng').toBeGreaterThan(0);
  }
});
test.describe('Chỉ số › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('IND-V01'), async ({ page }) => {
    const parent = await ensureIndicator(made, { min: 0, max: 10 });
    const child = await ensureIndicator(made, { groupId: parent.indicatorGroupId, pillarId: parent.pillarId, parentId: parent.id, max: 5 });
    await openDetail(page, parent.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [parent.code, parent.pillarName, parent.indicatorGroupName, 'Chỉ số cha', '0,0 – 10,0', 'Chưa có mô tả', child.code, 'Bộ chỉ số đang sử dụng', 'Chưa khóa'])
      expect(txt, `thiếu "${s}"`).toContain(s);
    expect(txt).toMatch(/thứ tự/i);
    for (const b of [/khóa chỉ số/i, /^\s*cập nhật\s*$/i, /thêm chỉ số con/i]) await expect(page.locator('button', { hasText: b }).first()).toBeVisible();
  });
  test(tc('IND-V03'), async ({ page }) => {
    const ind = await ensureIndicator(made, { lock: true });
    const set = await putInSet(ind);
    await openDetail(page, ind.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    expect(txt, 'bảng "Bộ chỉ số đang sử dụng" phải chứa mã bộ chỉ số').toContain(set.code);
    expect(txt).toContain(set.name);
  });
});

// ================= THÊM MỚI =================
test.describe('Chỉ số › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('IND-C01'), async ({ page }) => {
    const { g, p } = await ctx(); const code = made.add(RES, code8());
    const d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code, name: `qc.automation Chỉ số ${code}`, desc: 'qc.automation mô tả', min: '1', max: '8' });
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi(RES, code);
    expect(rec?.name).toBe(`qc.automation Chỉ số ${code}`); expect(rec?.description).toBe('qc.automation mô tả');
    expect([rec?.minScore, rec?.maxScore]).toEqual([1, 8]); expect(rec?.indicatorGroupId).toBe(g.id); expect(rec?.pillarId).toBe(p.id); expect(rec?.isLocked).toBeFalsy();
    const row = (await findRowExact(page, code)).first();
    await expect(row).toContainText(p.name); await expect(row).toContainText(g.name); await expect(row).toContainText('Chưa khóa');
    expect((await row.locator('td').nth(6).innerText()).trim()).toBe('1'); expect((await row.locator('td').nth(7).innerText()).trim()).toBe('8');
  });
  test(tc('IND-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    const errs = (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' | ');
    for (const re of [/trụ cột/i, /nhóm chỉ số/i, /mã chỉ số/i, /tên chỉ số/i]) expect(errs, `thiếu lỗi bắt buộc ${re}`).toMatch(re);
    await expect(d).toBeVisible();
  });
  test(tc('IND-C03'), async ({ page }) => {
    const a = await ensureIndicator(made);
    const p = await pillarOf(a);
    const d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: { name: a.indicatorGroupName }, code: a.code, name: 'qc.automation Chỉ số trùng mã' });
    await submitAdd(d);
    expect(await toast(page)).toMatch(/đã tồn tại|trùng/i);
    expect((await listApi(RES, a.code)).filter((x: any) => x.code === a.code)).toHaveLength(1);
  });
  test(tc('IND-C04'), async ({ page }) => {
    const g1 = await ensureGroup(made), g2 = await ensureGroup(made);
    const i1 = await ensureIndicator(made, { groupId: g1.id, pillarId: g1.pillarId }), i2 = await ensureIndicator(made, { groupId: g2.id, pillarId: g2.pillarId });
    const p1 = await pillarOf(g1);
    const d = await openAdd(page);
    const sel = (re: RegExp) => d.locator('.ant-form-item').filter({ hasText: re }).locator('.ant-select').first();
    await expect.soft(sel(/nhóm chỉ số/i), 'Nhóm chỉ số phải bị vô hiệu khi chưa chọn trụ cột').toHaveClass(/ant-select-disabled/);
    await expect.soft(d.getByText('Chọn nhóm chỉ số trước')).toBeVisible();
    await pickByLabel(page, d, /trụ cột/i, p1.name);
    await sel(/nhóm chỉ số/i).click(); await page.waitForTimeout(800);
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    const gtxt = await dd.innerText();
    expect(gtxt).toContain(g1.name); expect(gtxt, 'chỉ liệt kê nhóm của trụ cột đã chọn').not.toContain(g2.name);
    await page.keyboard.press('Escape');
    await pickByLabel(page, d, /nhóm chỉ số/i, g1.name);
    const ptxt = await parentOptions(page, d);
    expect(ptxt).toContain(i1.code); expect(ptxt, 'Chỉ số cha chỉ gồm mục thuộc nhóm đã chọn').not.toContain(i2.code);
  });
  test(tc('IND-C05'), async ({ page }) => {
    const par = await ensureIndicator(made); const p = await pillarOf({ pillarId: par.pillarId });
    const code = made.add(RES, code8());
    const d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: { name: par.indicatorGroupName }, code, parent: par.code, max: '4' });
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi(RES, code))?.parentId).toBe(par.id);
    expect((await getInd(par.id)).childrenCount).toBe(1);
    const row = (await findRowExact(page, par.code)).first();
    expect((await row.locator('td').nth(5).innerText()).trim()).toBe('1');
    await openDetail(page, par.code);
    expect(await page.locator('.ant-layout-content').first().innerText()).toContain(code);
  });
  test(tc('IND-C06'), async ({ page }) => {
    const { g, p } = await ctx(); const code = made.add(RES, code8());
    const d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code, min: '10', max: '5' });
    await submitAdd(d);
    const msg = (await toast(page)) + (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ');
    expect(msg).toMatch(/tối thiểu không được lớn hơn điểm tối đa/i);
    expect(await findApi(RES, code)).toBeNull();
    const r = await api('POST', RES, { indicatorGroupId: g.id, pillarId: p.id, code, name: 'qc.automation x', minScore: 10, maxScore: 5 });
    expect(r.status, 'API phải 400').toBe(400); expect(r.message).toMatch(/tối thiểu không được lớn hơn/i);
  });
  test(tc('IND-C07'), async ({ page }) => {
    const { g, p } = await ctx();
    for (const [min, max] of [['-5', '5'], ['0', '1001']]) {
      const code = made.add(RES, code8());
      const d = await openAdd(page);
      await uiFill(page, d, { pillar: p, group: g, code, min: '0', max: '5' });
      await d.getByPlaceholder(PH.min).fill(''); await d.getByPlaceholder(PH.min).pressSequentially(min);
      await d.getByPlaceholder(PH.max).fill(max);
      await submitAdd(d);
      const msg = (await toast(page)) + ' ' + (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ');
      expect.soft(msg, `điểm "${min}"/"${max}" phải báo lỗi khoảng 0-1000 (hiện: "${msg.trim()}")`).toMatch(/từ 0 đến 1000/i);
      expect.soft(await findApi(RES, code), `không được tạo chỉ số với điểm ${min}/${max}`).toBeNull();
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    }
    for (const [mn, mx] of [[-5, 5], [0, 1001]]) {
      const r = await api('POST', RES, { indicatorGroupId: g.id, pillarId: p.id, code: made.add(RES, code8()), name: 'qc.automation x', minScore: mn, maxScore: mx });
      expect(r.status).toBe(400); expect(r.message).toMatch(/từ 0 đến 1000/i);
    }
  });
  test(tc('IND-C08'), async ({ page }) => {
    const { g, p } = await ctx();
    for (const [min, max] of [['0', '1000'], ['5', '5']]) {
      const code = made.add(RES, code8());
      const d = await openAdd(page);
      await uiFill(page, d, { pillar: p, group: g, code, min, max });
      await submitAdd(d);
      expect(await toast(page), `min=${min} max=${max}`).toMatch(/thành công/i);
      const rec = await findApi(RES, code);
      expect([rec?.minScore, rec?.maxScore]).toEqual([Number(min), Number(max)]);
      const row = (await findRowExact(page, code)).first();
      expect((await row.locator('td').nth(6).innerText()).trim()).toBe(min); expect((await row.locator('td').nth(7).innerText()).trim()).toBe(max);
    }
  });
  test(tc('IND-C09'), async ({ page }) => {
    const { g, p } = await ctx();
    // chữ: bị chặn (ô không giữ giá trị chữ) hoặc báo lỗi rõ ràng
    let d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code: made.add(RES, code8()), min: '0', max: '5' });
    await d.getByPlaceholder(PH.max).fill('abc'); await d.getByPlaceholder(PH.min).click(); await page.waitForTimeout(500);
    const shown = await d.getByPlaceholder(PH.max).inputValue();
    const err = (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ');
    expect(/[a-z]/i.test(shown) ? err : 'ok', `ô điểm giữ chữ "${shown}" mà không báo lỗi`).not.toBe('');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    // thập phân 2.55 và 2,5: lưu đúng giá trị hoặc báo lỗi rõ ràng
    for (const [typed, expected] of [['2.55', 2.55], ['2,5', 2.5]] as const) {
      const code = made.add(RES, code8());
      d = await openAdd(page);
      await uiFill(page, d, { pillar: p, group: g, code, min: '0', max: typed });
      await submitAdd(d);
      const msg = await toast(page); const rec = await findApi(RES, code);
      if (rec) expect(rec.maxScore, `nhập "${typed}" nhưng lưu thành ${rec.maxScore} (kỳ vọng ${expected} hoặc báo lỗi)`).toBe(expected);
      else expect(msg + (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(''), `"${typed}" bị từ chối nhưng không báo rõ`).toMatch(/\S/);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    }
  });
  test(tc('IND-C10'), async ({ page }) => {
    const { g, p } = await ctx(); const code = made.add(RES, code8());
    const d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code, min: '', max: '' });
    await submitAdd(d); await page.waitForTimeout(800);
    const errs = (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' | ');
    expect(errs).toMatch(/điểm tối thiểu/i); expect(errs).toMatch(/điểm tối đa/i);
    expect(await findApi(RES, code)).toBeNull();
  });
  test(tc('IND-C11'), async () => {
    const par = await ensureIndicator(made, { max: 10 });
    const code = made.add(RES, code8());
    const r = await api('POST', RES, { indicatorGroupId: par.indicatorGroupId, pillarId: par.pillarId, parentId: par.id, code, name: 'qc.automation Con 50', minScore: 0, maxScore: 50 });
    if (r.status < 300) {
      const p2 = await getInd(par.id);
      expect(p2.maxScore, `con max=50 được nhận dưới cha max=10 (cha ${p2.maxScore}, tổng con ${p2.childrenTotalMaxScore}); phải bị chặn hoặc điểm cha tự = tổng điểm các con`).toBe(50);
    } else expect(r.status).toBe(400);
  });
  test(tc('IND-C12'), async ({ page }) => {
    const { g, p } = await ctx(); const code = made.add(RES, code8());
    const d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code });
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findApi(RES, code)).toBeNull();
  });
  test(tc('IND-C13'), async ({ page }) => {
    const { g, p } = await ctx();
    const c50 = made.add(RES, (code8() + 'Z'.repeat(50)).slice(0, 50)), c51 = made.add(RES, (code8() + 'Y'.repeat(51)).slice(0, 51));
    let d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code: c50 });
    await submitAdd(d);
    expect(await toast(page), 'mã 50 ký tự phải được nhận').toMatch(/thành công/i);
    expect(await findApi(RES, c50)).toBeTruthy();
    d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code: c51 });
    await submitAdd(d);
    const msg = (await toast(page)) + (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ');
    expect(msg).toMatch(/50 ký tự|vượt quá/i);
    expect(await findApi(RES, c51)).toBeNull();
  });
  test(tc('IND-C14'), async () => {
    const { g, p } = await ctx(); const other = await ensurePillar(made);
    const base = { indicatorGroupId: g.id, pillarId: p.id, minScore: 0, maxScore: 5 };
    const a = await api('POST', RES, { ...base, name: 'qc.automation thiếu mã' });
    const b = await api('POST', RES, { ...base, code: made.add(RES, code8()) });
    expect(a.status, `thiếu mã (HTTP ${a.status})`).toBe(400); expect(a.message).toMatch(/\S/);
    expect(b.status, `thiếu tên (HTTP ${b.status})`).toBe(400); expect(b.message).toMatch(/\S/);
    const code = made.add(RES, code8());
    const c = await api('POST', RES, { ...base, pillarId: other.id, code, name: 'qc.automation nhóm khác trụ cột' });
    expect(c.status, `nhóm thuộc trụ cột khác được nhận (HTTP ${c.status}: ${c.message}), phải 400`).toBe(400);
  });
});

// ================= CHỈNH SỬA / CẤU HÌNH ĐIỂM =================
test.describe('Chỉ số › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('IND-E01'), async ({ page }) => {
    const i = await ensureIndicator(made); const nn = `qc.automation Đã sửa ${i.code}`;
    const d = await openEdit(page, i.code);
    await d.getByPlaceholder(PH.name).fill(nn); await d.getByPlaceholder(PH.desc).fill('qc.automation mô tả mới');
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await getInd(i.id); expect(rec.name).toBe(nn); expect(rec.description).toBe('qc.automation mô tả mới');
    await expect((await findRowExact(page, i.code)).first()).toContainText(nn);
    await openDetail(page, i.code);
    const txt = await page.locator('.ant-layout-content').first().innerText();
    expect(txt).toContain(nn); expect(txt).toContain('qc.automation mô tả mới');
  });
  test(tc('IND-E02'), async ({ page }) => {
    const i = await ensureIndicator(made);
    const d = await openEdit(page, i.code);
    await d.getByPlaceholder(PH.name).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await getInd(i.id)).name).toBe(i.name);
  });
  test(tc('IND-E03'), async ({ page }) => {
    const i = await ensureIndicator(made);
    const d = await openEdit(page, i.code);
    await d.getByPlaceholder(PH.name).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await getInd(i.id)).name).toBe(i.name);
  });
  test(tc('IND-E04'), async () => {
    const i = await ensureIndicator(made);
    expect((await lockApi(i.id)).status).toBe(200);
    const r = await api('PUT', `${RES}/${i.id}`, putBody(i, { name: 'qc.automation đổi tên khi khóa' }));
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect(r.message).toMatch(/đã bị kho[áa], không thể chỉnh sửa/i);
    expect((await getInd(i.id)).name).toBe(i.name);
  });
  test(tc('IND-E05'), async ({ page }) => {
    const p1 = await ensureIndicator(made);
    const gid = { groupId: p1.indicatorGroupId, pillarId: p1.pillarId };
    const p2 = await ensureIndicator(made, gid);
    const c = await ensureIndicator(made, { ...gid, parentId: p1.id });
    const d = await openEdit(page, c.code);
    await pickParent(page, d, p2.code); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await getInd(c.id)).parentId).toBe(p2.id);
    expect((await getInd(p1.id)).childrenCount).toBe(0); expect((await getInd(p2.id)).childrenCount).toBe(1);
    await openList(page, cfg);
    expect((await (await findRowExact(page, p2.code)).first().locator('td').nth(5).innerText()).trim()).toBe('1');
  });
  test(tc('IND-E06'), async ({ page }) => {
    const par = await ensureIndicator(made);
    const c = await ensureIndicator(made, { groupId: par.indicatorGroupId, pillarId: par.pillarId, parentId: par.id });
    const d = await openEdit(page, c.code);
    const sel = d.locator('.ant-form-item').filter({ hasText: /chỉ số cha/i }).locator('.ant-select').first();
    await sel.hover();
    const clear = sel.locator('.ant-select-clear');
    expect(await clear.count(), 'Chỉ số cha phải xóa/bỏ chọn được').toBeGreaterThan(0);
    await clear.click({ force: true }); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await getInd(c.id)).parentId ?? null).toBeNull();
    expect((await getInd(par.id)).childrenCount).toBe(0);
  });
  test(tc('IND-E07'), async ({ page }) => {
    const a = await ensureIndicator(made);
    const b = await ensureIndicator(made, { groupId: a.indicatorGroupId, pillarId: a.pillarId, parentId: a.id });
    const d = await openEdit(page, a.code);
    const txt = await parentOptions(page, d);
    expect(txt, 'không được liệt kê chính nó làm cha').not.toContain(`${a.code} - `);
    expect(txt, 'không được liệt kê chỉ số con làm cha').not.toContain(`${b.code} - `);
    const self = await api('PUT', `${RES}/${a.id}`, putBody(a, { parentId: a.id }));
    const loop = await api('PUT', `${RES}/${a.id}`, putBody(a, { parentId: b.id }));
    expect(self.status).toBe(400); expect(loop.status).toBe(400);
  });
  /** Sửa 1 trường điểm qua UI rồi kiểm tra. */
  async function editScore(page: Page, i: any, f: { min?: string; max?: string }) {
    const d = await openEdit(page, i.code);
    await fillForm(d, f); await btnSave(d).click();
    return { d, msg: await toast(page) };
  }
  test(tc('IND-E08'), async ({ page }) => {
    const i = await ensureIndicator(made, { max: 10 });
    const { msg } = await editScore(page, i, { max: '20' });
    expect(msg).toMatch(/thành công/i); expect((await getInd(i.id)).maxScore).toBe(20);
    expect((await (await findRowExact(page, i.code)).first().locator('td').nth(7).innerText()).trim()).toBe('20');
    await openDetail(page, i.code);
    expect(await page.locator('.ant-layout-content').first().innerText()).toContain('0,0 – 20,0');
  });
  test(tc('IND-E09'), async ({ page }) => {
    const i = await ensureIndicator(made, { min: 0, max: 10 });
    const { msg } = await editScore(page, i, { min: '3' });
    expect(msg).toMatch(/thành công/i); expect((await getInd(i.id)).minScore).toBe(3);
    expect((await (await findRowExact(page, i.code)).first().locator('td').nth(6).innerText()).trim()).toBe('3');
  });
  test(tc('IND-E10'), async ({ page }) => {
    const i = await ensureIndicator(made, { min: 0, max: 10 });
    const { d, msg } = await editScore(page, i, { min: '50', max: '10' });
    expect(msg + (await d.locator('.ant-form-item-explain-error').allInnerTexts()).join(' ')).toMatch(/tối thiểu không được lớn hơn điểm tối đa/i);
    const rec = await getInd(i.id); expect([rec.minScore, rec.maxScore]).toEqual([0, 10]);
  });
  test(tc('IND-E11'), async ({ page }) => {
    const par = await ensureIndicator(made, { max: 40 });
    await ensureIndicator(made, { groupId: par.indicatorGroupId, pillarId: par.pillarId, parentId: par.id, max: 30 });
    const { msg } = await editScore(page, par, { max: '10' });
    const warn = (msg + ' ' + (await page.locator('.ant-modal-confirm, .ant-popover, .ant-alert').allInnerTexts().catch(() => [])).join(' '));
    const rec = await getInd(par.id);
    if (rec.maxScore === 10) expect(warn, `giảm điểm tối đa cha (10) thấp hơn tổng con (30) được lưu "${msg}" mà không chặn/cảnh báo`).toMatch(/cảnh báo|tổng điểm|nhỏ hơn|thấp hơn|không được|vượt/i);
  });
});

// ================= KHÓA / MỞ KHÓA =================
test.describe('Chỉ số › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('IND-K01'), async ({ page }) => {
    const i = await ensureIndicator(made);
    await openList(page, cfg);
    await rowAction(page, await findRowExact(page, i.code), MENU.lock); await confirmYes(page);
    expect((await getInd(i.id)).isLocked).toBe(true);
    const row = await findRowExact(page, i.code);
    await expect(row.first()).toContainText('Đã khóa');
    const items = await rowMenuItems(page, row);
    expect(items.some(x => MENU.unlock.test(x)) && items.some(x => MENU.clone.test(x)), `menu: ${items.join(' | ')}`).toBeTruthy();
    expect(items.some(x => MENU.edit.test(x) || MENU.del.test(x)), `không được có Cập nhật/Xoá: ${items.join(' | ')}`).toBeFalsy();
    // khóa từ trang chi tiết
    const j = await ensureIndicator(made);
    await openDetail(page, j.code);
    await page.getByRole('button', { name: /^\s*khóa chỉ số\s*$/i }).click(); await page.waitForTimeout(1500);
    expect((await getInd(j.id)).isLocked).toBe(true);
    await expect(page.locator('.ant-layout-content').first()).toContainText('Đã khóa');
  });
  test(tc('IND-K02'), async ({ page }) => {
    const i = await ensureIndicator(made, { lock: true });
    await openList(page, cfg);
    await rowAction(page, await findRowExact(page, i.code), MENU.unlock); await confirmYes(page);
    expect((await getInd(i.id)).isLocked).toBe(false);
    const row = await findRowExact(page, i.code);
    await expect(row.first()).toContainText('Chưa khóa');
    const items = await rowMenuItems(page, row);
    for (const re of [MENU.lock, MENU.clone, MENU.edit, MENU.del]) expect(items.some(x => re.test(x)), `thiếu ${re} trong menu: ${items.join(' | ')}`).toBeTruthy();
  });
  test(tc('IND-K03'), async ({ page }) => {
    const locked = await ensureIndicator(made, { lock: true });
    const open = await ensureIndicator(made, { groupId: locked.indicatorGroupId, pillarId: locked.pillarId });
    const s = await ensureSet(made);
    const a = await api('PUT', `dti/indicator-sets/${s.id}/groups`, [{ indicatorGroupId: locked.indicatorGroupId, displayOrder: 1, isScored: true }]);
    expect(a.status).toBe(200);
    await page.goto(`/#/vi/indicator-sets/${s.id}/builder`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    await page.getByText(locked.indicatorGroupName).first().click(); await page.waitForTimeout(800);
    await page.locator('.ant-select').filter({ hasText: 'Chọn chỉ số cần' }).click(); await page.waitForTimeout(1000);
    const txt = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().innerText();
    expect(txt, 'phải liệt kê chỉ số đã khóa').toContain(locked.code);
    expect(txt, 'không được liệt kê chỉ số chưa khóa').not.toContain(open.code);
  });
});

// ================= XÓA =================
test.describe('Chỉ số › Xóa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('IND-D01'), async ({ page }) => {
    const i = await ensureIndicator(made);
    await openList(page, cfg);
    await rowAction(page, await findRowExact(page, i.code), MENU.del); await confirmYes(page);
    expect(await findApi(RES, i.code)).toBeNull();
    await searchFor(page, cfg, i.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('IND-D02'), async ({ page }) => {
    const i = await ensureIndicator(made);
    await openList(page, cfg);
    await rowAction(page, await findRowExact(page, i.code), MENU.del); await confirmNo(page);
    expect(await findApi(RES, i.code)).toBeTruthy();
    expect(await rowOf(page, i.code).count()).toBe(1);
  });
  test(tc('IND-D03'), async ({ page }) => {
    const i = await ensureIndicator(made, { lock: true });
    const r = await api('DELETE', `${RES}/${i.id}`);
    expect(r.status).toBe(400); expect(r.message).toMatch(/đã bị kho[áa], không thể xóa/i);
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRowExact(page, i.code));
    expect(items.some(x => MENU.del.test(x)), `menu: ${items.join(' | ')}`).toBeFalsy();
    expect(await findApi(RES, i.code)).toBeTruthy();
  });
  test(tc('IND-D04'), async ({ page }) => {
    const par = await ensureIndicator(made);
    await ensureIndicator(made, { groupId: par.indicatorGroupId, pillarId: par.pillarId, parentId: par.id });
    await openList(page, cfg);
    await rowAction(page, await findRowExact(page, par.code), MENU.del); await confirmYes(page);
    const msg = await toast(page);
    expect(msg + (await page.locator('body').innerText()), 'UI lộ lỗi nội bộ khi xóa chỉ số có con').not.toMatch(ERR_500);
    expect(await findApi(RES, par.code)).toBeTruthy();
    const r = await api('DELETE', `${RES}/${par.id}`);
    expect(r.status, `API xóa chỉ số có con trả HTTP ${r.status}: ${r.message.slice(0, 80)} (phải 4xx với thông báo rõ ràng)`).toBeLessThan(500);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.message).not.toMatch(ERR_500);
  });
  test(tc('IND-D05'), async ({ page }) => {
    const i = await ensureIndicator(made, { lock: true });
    const s = await putInSet(i);
    await api('PUT', `${RES}/${i.id}/unlock`, {});
    await openList(page, cfg);
    await rowAction(page, await findRowExact(page, i.code), MENU.del); await confirmYes(page);
    const msg = await toast(page);
    expect(msg, 'phải báo bị chặn').not.toMatch(/xóa.*thành công/i);
    expect(await findApi(RES, i.code), 'chỉ số phải còn nguyên').toBeTruthy();
    const set = (await api('GET', `dti/indicator-sets/${s.id}`)).data;
    expect(JSON.stringify(set.groups)).toContain(i.code);
    const r = await api('DELETE', `${RES}/${i.id}`);
    expect(r.status).toBe(400);
  });
});

// ================= NHÂN BẢN =================
test.describe('Chỉ số › Nhân bản', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  async function uiClone(page: Page, code: string) {
    await openList(page, cfg);
    await rowAction(page, await findRowExact(page, code), MENU.clone); await confirmYes(page);
    expect(await toast(page)).toMatch(/thành công/i);
    const clones = await trackClones(code);
    expect(clones.length, 'phải có bản sao').toBeGreaterThan(0);
    return clones;
  }
  test(tc('IND-N01'), async ({ page }) => {
    const i = await ensureIndicator(made, { min: 2, max: 9 });
    const [c] = await uiClone(page, i.code);
    expect(c.code).not.toBe(i.code); expect(c.name).toBe(`${i.name} (Bản sao)`); expect(c.isLocked).toBeFalsy();
    expect([c.minScore, c.maxScore, c.indicatorGroupId]).toEqual([2, 9, i.indicatorGroupId]);
    await expect((await findRowExact(page, c.code)).first()).toContainText('Chưa khóa');
  });
  test(tc('IND-N02'), async ({ page }) => {
    const i = await ensureIndicator(made, { lock: true });
    const [c] = await uiClone(page, i.code);
    expect(c.isLocked).toBeFalsy(); expect((await getInd(i.id)).isLocked).toBe(true);
  });
  test(tc('IND-N03'), async () => {
    const i = await ensureIndicator(made);
    const codes: string[] = [];
    for (let k = 0; k < 3; k++) {
      const r = await api('POST', `${RES}/${i.id}/clone`, {});
      expect(r.status, r.message).toBe(200); codes.push(r.data.code); made.add(RES, r.data.code);
    }
    expect(new Set(codes).size, `mã bản sao: ${codes.join(', ')}`).toBe(3);
    expect(codes).not.toContain(i.code);
  });
  test(tc('IND-N04'), async () => {
    const par = await ensureIndicator(made);
    const child = await ensureIndicator(made, { groupId: par.indicatorGroupId, pillarId: par.pillarId, parentId: par.id });
    const r = await api('POST', `${RES}/${par.id}/clone`, {});
    expect(r.status, r.message).toBe(200); made.add(RES, r.data.code);
    await trackClones(par.code);
    expect((await getInd(par.id)).childrenCount, 'bản gốc không đổi số con').toBe(1);
    expect((await getInd(child.id)).parentId, 'chỉ số con gốc vẫn thuộc cha gốc').toBe(par.id);
    expect((await getInd(r.data.id)).childrenCount).toBeLessThanOrEqual(1);
  });
  test(tc('IND-N05'), async ({ page }) => {
    const i = await ensureIndicator(made, { max: 10 });
    const r = await api('POST', `${RES}/${i.id}/clone`, {}); made.add(RES, r.data.code);
    const nn = `qc.automation Bản sao đã sửa ${r.data.code}`;
    const d = await openEdit(page, r.data.code);
    await d.getByPlaceholder(PH.name).fill(nn); await d.getByPlaceholder(PH.max).fill('33'); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const c = await getInd(r.data.id), o = await getInd(i.id);
    expect([c.name, c.maxScore]).toEqual([nn, 33]); expect([o.name, o.maxScore]).toEqual([i.name, 10]);
    await openDetail(page, r.data.code);
    expect(await page.locator('.ant-layout-content').first().innerText()).toContain(nn);
  });
  test(tc('IND-N06'), async () => {
    const r = await api('POST', `${RES}/00000000-0000-4000-8000-000000000000/clone`, {});
    expect(r.status, `HTTP ${r.status}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
  });
});

// ================= EDGE / LỖI =================
test.describe('Chỉ số › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('IND-G01'), async ({ page }) => {
    const { g, p } = await ctx(); const code = made.add(RES, code8());
    const d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code: '   ', name: '   ' });
    await submitAdd(d); await page.waitForTimeout(900);
    const msg = (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()).join(' ');
    const inline = await d.locator('.ant-form-item-explain-error').count();
    expect(inline > 0 || /không được để trống|bắt buộc|không hợp lệ/i.test(msg), `chuỗi chỉ có khoảng trắng phải bị báo lỗi (inline=${inline}, toast="${msg}")`).toBeTruthy();
    expect(msg).not.toMatch(/thành công/i);
    await expect(d).toBeVisible();
    expect((await listApi(RES, 'qc.automation Chỉ số')).filter((x: any) => x.code?.trim() === '' || x.name?.trim() === '')).toHaveLength(0);
    void code;
  });
  test(tc('IND-G02'), async ({ page }) => {
    const { g, p } = await ctx(); const code = made.add(RES, code8());
    const r = await api('POST', RES, { indicatorGroupId: g.id, pillarId: p.id, code, name: SPECIAL_NAME, minScore: 0, maxScore: 5 });
    expect(r.status, r.message).toBe(200);
    await openList(page, cfg); await page.reload(); await waitList(page);
    const row = await findRowExact(page, code);
    expect((await row.first().innerText()).replace(/\s+/g, ' ')).toContain(SPECIAL_NAME);
    expect(await row.first().locator('b').count(), 'HTML trong tên phải hiển thị dạng chữ, không được render').toBe(0);
  });
  for (const [id, mode] of [['IND-G03', 'http500'], ['IND-G04', 'offline']] as const) {
    test(tc(id), async ({ page }) => {
      const { g, p } = await ctx(); const code = made.add(RES, code8());
      const d = await openAdd(page);
      await uiFill(page, d, { pillar: p, group: g, code });
      const re = new RegExp(`/api/v1/${RES}$`);
      await page.route(re, r => {
        if (r.request().method() !== 'POST') return r.continue();
        return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
      });
      await submitAdd(d); await page.waitForTimeout(1500);
      await expect(d, 'form phải còn mở để người dùng thử lại').toBeVisible();
      expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
      expect(await d.getByPlaceholder(PH.code).inputValue(), 'dữ liệu đã nhập không được mất').toBe(code);
      await page.unroute(re);
      expect(await findApi(RES, code)).toBeNull();
    });
  }
  test(tc('IND-G05'), async ({ page }) => {
    const { g, p } = await ctx(); const code = made.add(RES, code8());
    const d = await openAdd(page);
    await uiFill(page, d, { pillar: p, group: g, code });
    await Promise.all([submitAdd(d), Promise.race([submitAdd(d).catch(() => {}), page.waitForTimeout(3000)])]);
    await page.waitForTimeout(2500);
    expect((await listApi(RES, code)).filter((x: any) => x.code === code), 'bấm Lưu 2 lần chỉ được tạo đúng 1 bản ghi').toHaveLength(1);
  });
});

// ================= BẢO MẬT / HIỆU NĂNG =================
test.describe('Chỉ số › Bảo mật / Hiệu năng', () => {
  registerAuthTest('IND-A01', cfg);
  registerMatrixTest('IND-A02', cfg);
  test.describe('chưa đăng nhập', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test(tc('IND-A03'), async ({ page }) => {
      await page.goto(`/#/vi/${cfg.route}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(await page.locator('input[type=password]').count(), 'phải hiện màn đăng nhập').toBeGreaterThan(0);
      expect(await dataRows(page).count(), 'không lộ dữ liệu').toBe(0);
    });
  });
  registerPerfTest('IND-P01', cfg);
});
