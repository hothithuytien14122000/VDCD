// B Chỉ số (DTI) — script bám testcase IND-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, cellText, totalOf, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, FILTERS,
  ensurePillar, ensureGroup, ensureIndicator, ensureSet, registerSearchRules, registerCodeNameRules, registerAuthTest, registerMatrixTest, registerPerfTest, SPECIAL_NAME,
} from './common';
import { DUP_CODE } from './common';

const cfg = PAGES.IND;
const RES = 'dti/indicators';
const made = new Made();
registerSearchRules('IND', cfg);
let gp: Record<string, { id: string; pillarId: string }> = {};
test.afterEach(() => { gp = {}; });
registerCodeNameRules({ P: 'IND', cfg, made, hasParent: true, nameMax: 500,
  mk: async (code, name, parent = 'A') => { gp[parent] ??= await ensureGroup(made); made.add(RES, code); const r = await api('POST', RES, { indicatorGroupId: gp[parent].id, pillarId: gp[parent].pillarId, code, name, minScore: 0, maxScore: 10 }); return { status: r.status, message: r.message }; } });
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
});

// ================= THÊM MỚI =================
test.describe('Chỉ số › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
});

// ================= CHỈNH SỬA / CẤU HÌNH ĐIỂM =================
test.describe('Chỉ số › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('IND-E04'), async () => {
    const i = await ensureIndicator(made);
    expect((await lockApi(i.id)).status).toBe(200);
    const r = await api('PUT', `${RES}/${i.id}`, putBody(i, { name: 'qc.automation đổi tên khi khóa' }));
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(400);
    expect(r.message).toMatch(/đã bị kho[áa], không thể chỉnh sửa/i);
    expect((await getInd(i.id)).name).toBe(i.name);
  });
  /** Sửa 1 trường điểm qua UI rồi kiểm tra. */
  async function editScore(page: Page, i: any, f: { min?: string; max?: string }) {
    const d = await openEdit(page, i.code);
    await fillForm(d, f); await btnSave(d).click();
    return { d, msg: await toast(page) };
  }
});

// ================= KHÓA / MỞ KHÓA =================
test.describe('Chỉ số › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
});

// ================= XÓA =================
test.describe('Chỉ số › Xóa', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
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
