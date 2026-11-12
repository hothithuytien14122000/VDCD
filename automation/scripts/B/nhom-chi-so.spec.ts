// B.I.2 NHÓM CHỈ SỐ — script bám testcase IGR-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, cellText, findRow, pickOption, pickByLabel,
  dlg, btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, goto, totalOf,
  registerSearchRules, registerCodeNameRules, registerAuthTest, registerMatrixTest, registerPerfTest, registerNotFoundTest, FILTERS, SPECIAL_NAME,
  ensurePillar, ensureGroup, ensureIndicator,
} from './common';
import { DUP_CODE } from './common';

const cfg = PAGES.IGR;
const RES = cfg.res;
const made = new Made();
registerSearchRules('IGR', cfg);
let pl: Record<string, { id: string }> = {};
test.afterEach(() => { pl = {}; });
registerCodeNameRules({ P: 'IGR', cfg, made, hasParent: true, nameMax: 500,
  mk: async (code, name, parent = 'A') => { pl[parent] ??= await ensurePillar(made); made.addDti(RES, code); const r = await api('POST', RES, { pillarId: pl[parent].id, code, name, displayOrder: 0 }); return { status: r.status, message: r.message }; } });
test.afterEach(async () => { await made.clean(); });

const PH_CODE = /nhập mã nhóm chỉ số/i, PH_NAME = /nhập tên nhóm chỉ số/i;
const LOCK_RE = /^\s*kh(oá|óa)\s*$/i, UNLOCK_RE = /mở kh(oá|óa)/i, DEL_RE = /xo[áạ]/i, EDIT_RE = /cập nhật/i;
const SAVE_ADD = /^\s*Thêm mới Nhóm chỉ số\s*$/;

async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm mới nhóm chỉ số/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => d.locator('button', { hasText: SAVE_ADD }).last().click();
async function openEdit(page: Page, code: string) {
  await openList(page, cfg);
  await rowAction(page, await findRow(page, cfg, code), EDIT_RE);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
}
const detailOf = (page: Page, id: string) => goto(page, `${cfg.route}/${id}`);
/** Nhóm đã khóa có 1 chỉ số rồi mở khóa lại (chỉ tạo được chỉ số khi nhóm đã khóa). */
async function groupWithIndicator(unlock = true) {
  const g = await ensureGroup(made);
  const ind = await ensureIndicator(made, { groupId: g.id, pillarId: g.pillarId });
  if (unlock) await api('PUT', `${RES}/${g.id}/unlock`, {});
  return { g, ind };
}
const recOf = async (code: string) => findApi(RES, code);
const fillAdd = async (page: Page, d: Locator, pillarName: string, code: string, name = `qc.automation Nhóm ${code}`) => {
  await pickByLabel(page, d, /trụ cột/i, pillarName);
  await d.getByPlaceholder(PH_CODE).fill(code); await d.getByPlaceholder(PH_NAME).fill(name);
};

/** Nhóm có sẵn của hệ thống (không phải dữ liệu auto) - ổn định khi các test khác đang tạo/xóa dữ liệu song song. */
async function stableGroup() {
  const r = await api('GET', `${RES}?page=1&size=100`);
  const x = (r.data?.content ?? []).find((g: any) => !/^QCA/i.test(g.code) && !/^qc\.automation/i.test(g.name));
  if (!x) throw new Error('Không có nhóm chỉ số có sẵn của hệ thống để tìm kiếm');
  return x as { code: string; name: string };
}

// ================= Danh sách / Tìm kiếm / Phân trang =================
test.describe('Nhóm chỉ số › Danh sách / Tìm kiếm / Phân trang', () => {
  test(tc('IGR-L01'), async ({ page }) => {
    await openList(page, cfg);
    const heads = (await page.locator('.ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    for (const re of cfg.cols) expect(heads.some(h => re.test(h)), `thiếu cột ${re} trong [${heads.join(' | ')}]`).toBeTruthy();
    expect(await dataRows(page).count()).toBeGreaterThan(0);
  });
  test(tc('IGR-L03'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await stableGroup()).code;
    await searchFor(page, cfg, kw);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('IGR-L04'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await stableGroup()).name.slice(0, 25).trim();
    await searchFor(page, cfg, kw);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.toLowerCase(), `dòng không chứa "${kw}"`).toContain(kw.toLowerCase());
  });
  test(tc('IGR-L05'), async ({ page }) => {
    await openList(page, cfg);
    await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
    expect(await dataRows(page).count()).toBe(0);
    await expect(page.locator('.ant-empty, .ant-table-placeholder').first()).toBeVisible();
  });
  test(tc('IGR-L06'), async ({ page }) => {
    await openList(page, cfg);
    const kw = (await stableGroup()).code;
    await searchFor(page, cfg, kw.toUpperCase()); const a = await totalOf(page);
    await searchFor(page, cfg, kw.toLowerCase()); const b = await totalOf(page);
    expect(a).toBeGreaterThan(0);
    expect(b, 'HOA/thường phải cho cùng số kết quả').toBe(a);
  });
  test(tc('IGR-L07'), async ({ page }) => {
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
  test(tc('IGR-L08'), async ({ page }) => {
    await openList(page, cfg);
    test.skip((await totalOf(page)) <= 10, 'Dữ liệu chỉ có 1 trang');
    const before = (await rowTexts(page)).join('|');
    await page.locator('.ant-pagination-item-2').first().click();
    await waitList(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    expect((await rowTexts(page)).join('|')).not.toBe(before);
  });
  test(tc('IGR-L09'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page);
    test.skip(n <= 10, 'Dữ liệu chỉ có 1 trang');
    await pickOption(page, page.locator('.ant-pagination-options .ant-select').first(), '20');
    await waitList(page);
    expect(await dataRows(page).count()).toBe(Math.min(20, n));
    expect(await totalOf(page)).toBe(n);
  });
  test(tc('IGR-L10'), async ({ page }) => {
    await openList(page, cfg);
    const n = await totalOf(page);
    await searchFor(page, cfg, 'zzqcxx_khongtontai_999');
    expect(await totalOf(page)).toBe(0);
    await searchFor(page, cfg, '');
    expect(await totalOf(page)).toBe(n);
  });
});

// ================= Bộ lọc / cột Chỉ số =================
test.describe('Nhóm chỉ số › Bộ lọc', () => {
  // Giao diện chỉ có bộ lọc theo Trụ cột (không có lọc trạng thái khóa)
  test(tc('IGR-L12'), async ({ page }) => {
    await openList(page, cfg);
    const pillar = await cellText(page, 0, 3);
    await pickOption(page, page.locator(FILTERS).first(), new RegExp(`^\\s*${pillar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`));
    await waitList(page);
    const n = await dataRows(page).count();
    expect(n, `phải có nhóm thuộc trụ cột "${pillar}"`).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect(await cellText(page, i, 3)).toBe(pillar);
  });
  test(tc('IGR-L13'), async ({ page }) => {
    // nhóm có sẵn chỉ số cha + con để kiểm tra cách tính "tính cả chỉ số con"
    const g = await ensureGroup(made);
    const p = await ensureIndicator(made, { groupId: g.id, pillarId: g.pillarId });
    await ensureIndicator(made, { groupId: g.id, pillarId: g.pillarId, parentId: p.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, g.code);
    const shown = Number((await row.first().locator('td').nth(4).innerText()).trim());
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/indicator-groups\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1500);
    const rows = await dataRows(page).count();
    expect(shown, `cột Chỉ số (${shown}) phải bằng số dòng bảng chi tiết (${rows})`).toBe(rows);
  });
});

// ================= Xem chi tiết =================
test.describe('Nhóm chỉ số › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('IGR-V03'), async ({ page }) => {
    const g = await ensureGroup(made); // mặc định đã khóa
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRow(page, cfg, g.code));
    expect(items.some(i => EDIT_RE.test(i)), 'menu danh sách nhóm đã khóa không có Cập nhật').toBeFalsy();
    await detailOf(page, g.id);
    for (const [re, label] of [[/^\s*cập nhật\s*$/i, 'Cập nhật'], [/thêm chỉ số/i, 'Thêm chỉ số']] as const) {
      const b = page.locator('.ant-layout-content button', { hasText: re });
      const shown = (await b.count()) > 0 && await b.first().isVisible() && await b.first().isEnabled();
      expect(shown, `nhóm đã khóa nhưng chi tiết vẫn cho "${label}" (menu danh sách đã ẩn Cập nhật)`).toBeFalsy();
    }
  });
});
registerNotFoundTest('IGR-V02', cfg);

// ================= Thêm mới =================
test.describe('Nhóm chỉ số › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('IGR-C04'), async () => {
    const pil = await ensurePillar(made, { lock: false });
    const code1 = made.addDti(RES, code8()), code2 = made.addDti(RES, code8());
    const r1 = await api('POST', RES, { pillarId: pil.id, code: code1, name: 'qc.automation Nhóm', displayOrder: 0 });
    expect(r1.status, `trụ cột chưa khóa (HTTP ${r1.status}: ${r1.message})`).toBe(400);
    expect(r1.message).toMatch(/chỉ có thể chọn trụ cột đã được khóa/i);
    const r2 = await api('POST', RES, { code: code2, name: 'qc.automation Nhóm', displayOrder: 0 });
    expect(r2.status, `thiếu pillarId (HTTP ${r2.status}: ${r2.message})`).toBe(400);
    expect(r2.message).toMatch(/trụ cột không hợp lệ/i);
  });
});

// ================= Chỉnh sửa =================
test.describe('Nhóm chỉ số › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
});

// ================= Khóa / Mở khóa =================
test.describe('Nhóm chỉ số › Khóa / Mở khóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
});

// ================= Xóa =================
test.describe('Nhóm chỉ số › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('IGR-D01'), async ({ page }) => {
    const g = await ensureGroup(made, { lock: false });
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, g.code), DEL_RE); await confirmYes(page);
    expect(await recOf(g.code)).toBeNull();
    await searchFor(page, cfg, g.code);
    expect(await dataRows(page).count()).toBe(0);
  });
});

// ================= Bảo mật / Hiệu năng =================
test.describe('Nhóm chỉ số › Bảo mật / Hiệu năng', () => {
  registerAuthTest('IGR-A01', cfg);
  registerMatrixTest('IGR-A02', cfg);
  test.describe('chưa đăng nhập', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test(tc('IGR-A03'), async ({ page }) => {
      await page.goto(`/#/vi/${cfg.route}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(await page.locator('input[type=password]').count(), 'phải hiện màn đăng nhập').toBeGreaterThan(0);
      expect(await dataRows(page).count(), 'không lộ dữ liệu').toBe(0);
    });
  });
  registerPerfTest('IGR-P01', cfg);
});

// ================= Edge / Lỗi =================
test.describe('Nhóm chỉ số › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  for (const [id, mode] of [['IGR-G03', 'http500'], ['IGR-G04', 'offline']] as const) {
    test(tc(id), async ({ page }) => {
      const pil = await ensurePillar(made); const code = made.addDti(RES, code8());
      const d = await openAdd(page); await fillAdd(page, d, pil.name, code);
      const re = new RegExp(`/api/v1/${RES}$`);
      await page.route(re, r => {
        if (r.request().method() !== 'POST') return r.continue();
        return mode === 'offline' ? r.abort('connectionfailed') : r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error' }) });
      });
      await submitAdd(d); await page.waitForTimeout(1500);
      await expect(d, 'form phải còn mở để người dùng thử lại').toBeVisible();
      expect((await page.locator('body').innerText()).toLowerCase()).not.toMatch(/stack ?trace|exception|at com\.|undefined/);
      expect(await d.getByPlaceholder(PH_CODE).inputValue(), 'dữ liệu đã nhập không được mất').toBe(code);
      await page.unroute(re);
      expect(await recOf(code)).toBeNull();
    });
  }
});
