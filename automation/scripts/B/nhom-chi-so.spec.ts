// B.I.2 NHÓM CHỈ SỐ — script bám testcase IGR-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, cellText, findRow, pickOption, pickByLabel,
  dlg, btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, goto, totalOf,
  registerSearchRules, registerCodeNameRules, registerAuthTest, registerMatrixTest, registerPerfTest, registerNotFoundTest, FILTERS, SPECIAL_NAME,
  ensurePillar, ensureGroup, ensureIndicator,
} from './common';
import { DUP_CODE } from './common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BASE } from '../helpers';
import { guardSession } from '../session-guard';

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

// ===== Case bổ sung từ bug GitLab (gộp từ nhom-chi-so-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
test.describe(() => {
test.describe.configure({ timeout: 120_000 });

// ---------------------------------------------------------------- API (luôn bằng phiên admin)
const ADM = 'admin';
const A = (m: string, r: string, b?: any, as = ADM) => api(m, r, b, as);
const F = (o: any) => encodeURIComponent(JSON.stringify(o));
const must = (r: any, w: string) => { if (r.status >= 300) throw new Error(`${w}: HTTP ${r.status} ${r.message}`); return r; };
const PIL = 'dti/pillars', IGR = 'dti/indicator-groups', IND = 'dti/indicators', SETS = 'dti/indicator-sets', SCL = 'dti/score-scales', CAMP = 'dti/self-assessment-campaigns';
const TAG = `QCB${Date.now().toString(36).slice(-5).toUpperCase()}`;   // tag của lần chạy (mỗi worker một tag)
let seq = 0;
const nm = (kind: string) => `qc.automation ${kind} ${TAG}${(++seq).toString(36).toUpperCase()}`;
const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();

async function listKw(res: string, kw: string): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 20; p++) {
    const r = await A('GET', `${res}?page=${p}&size=100&filter=${F({ keyword: kw, fullTextSearch: kw })}`);
    out.push(...(r.data?.content ?? []));
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return out.filter(x => String(x.name ?? '').includes(kw));
}
const lockPil = (id: string) => A('PUT', `${PIL}/${id}/lock`, {});
const lockGrp = (id: string) => A('PUT', `${IGR}/${id}/lock`, {});
const lockInd = (id: string) => A('PUT', `${IND}/${id}/lock`, {});
async function mkPillar(name = nm('Trụ cột')) { return must(await A('POST', PIL, { name, description: 'qc.automation mô tả trụ cột', displayOrder: 0 }), 'tạo trụ cột').data; }
async function mkGroup(pillarId: string, name = nm('Nhóm'), lock = true) {
  const g = must(await A('POST', IGR, { pillarId, name, description: 'qc.automation mô tả nhóm', displayOrder: 0 }), 'tạo nhóm').data;
  if (lock) must(await lockGrp(g.id), 'khóa nhóm'); return g;
}
async function mkInd(groupId: string, pillarId: string, o: { name?: string; parentId?: string; max?: number; lock?: boolean } = {}) {
  const r = must(await A('POST', IND, { indicatorGroupId: groupId, pillarId, parentId: o.parentId, name: o.name ?? nm('Chỉ số'), minScore: 0, maxScore: o.max ?? 5 }), 'tạo chỉ số').data;
  if (o.lock) must(await lockInd(r.id), 'khóa chỉ số'); return r;
}
async function mkSet(extra: any = {}) { return must(await A('POST', SETS, { name: nm('Bộ'), effectiveYear: 2026, ...extra }), 'tạo bộ').data; }
const putSetGroups = (id: string, gids: string[]) => A('PUT', `${SETS}/${id}/groups`, gids.map((g, i) => ({ indicatorGroupId: g, displayOrder: i + 1, isScored: true })));
const putSetInds = (id: string, xs: { id: string; max: number; w?: number }[]) =>
  A('PUT', `${SETS}/${id}/indicators`, xs.map((x, i) => ({ indicatorId: x.id, weight: x.w ?? 1, isScored: true, minScore: 0, maxScore: x.max, displayOrder: i + 1 })));
const getScale = async (id: string) => (await A('GET', `${SCL}/${id}`)).data;
const lvBody = (lv: [string, number][]) => lv.map(([name, to], i) => ({ name, fromPercent: i ? lv[i - 1][1] : 0, toPercent: to }));
async function mkScale(o: { lock?: boolean; levels?: any[] } = {}) {
  const s = must(await A('POST', SCL, { name: nm('Thang'), levels: o.levels ?? lvBody([['Kém', 50], ['Tốt', 100]]) }), 'tạo thang').data;
  if (o.lock) must(await A('POST', `${SCL}/${s.id}/lock?rowVersion=${(await getScale(s.id)).rowVersion}`, {}), 'khóa thang');
  return await getScale(s.id);
}

// ---------------------------------------------------------------- Dữ liệu nền dùng chung (lazy, mỗi worker tạo một lần)
let _fx: Promise<any> | undefined;
/** Trụ cột → nhóm (khóa) → chỉ số cha (khóa) + 2 con 5đ/3đ (khóa); thêm 1 chỉ số Chưa khóa (c3) và 1 Đã khóa (c4) chưa có trong bộ;
 *  bộ chỉ số Chưa khóa chứa nhóm + cha + 2 con. */
const fx = () => (_fx ??= (async () => {
  const p = await mkPillar(); must(await lockPil(p.id), 'khóa trụ cột');
  const g = await mkGroup(p.id);
  const par = await mkInd(g.id, p.id, { name: nm('Chỉ số cha'), max: 10 });
  const c1 = await mkInd(g.id, p.id, { name: nm('Chỉ số con 5đ'), parentId: par.id, max: 5, lock: true });
  const c2 = await mkInd(g.id, p.id, { name: nm('Chỉ số con 3đ'), parentId: par.id, max: 3, lock: true });
  must(await lockInd(par.id), 'khóa chỉ số cha');
  const c3 = await mkInd(g.id, p.id, { name: nm('Chỉ số chưa khóa'), max: 4 });
  const c4 = await mkInd(g.id, p.id, { name: nm('Chỉ số đã khóa'), max: 4, lock: true });
  const s = await mkSet({ description: 'qc.automation mô tả bộ' });
  must(await putSetGroups(s.id, [g.id]), 'ghi nhóm vào bộ');
  must(await putSetInds(s.id, [{ id: par.id, max: 8, w: 0 }, { id: c1.id, max: 5 }, { id: c2.id, max: 3 }]), 'ghi chỉ số vào bộ');
  const get = async (r: string, id: string) => (await A('GET', `${r}/${id}`)).data;
  return { p: await get(PIL, p.id), g: await get(IGR, g.id), par: await get(IND, par.id), c1, c2, c3, c4, s: await get(SETS, s.id) };
})());
let _big: Promise<any> | undefined;
/** Bộ lớn: 9 nhóm (nhóm 1 tên ~320 ký tự), 50 chỉ số (chỉ số 1 tên ~320 ký tự) → cấu trúc > 50 dòng. */
const LONG = ' Tên rất dài để kiểm tra bố cục trang cấu hình'.repeat(8);
const big = () => (_big ??= (async () => {
  const { p } = await fx();
  const groups: { g: any; inds: any[] }[] = [];
  for (let i = 0; i < 9; i++) groups.push({ g: await mkGroup(p.id, i === 0 ? (nm('Nhóm dài') + LONG).slice(0, 320) : nm(`Nhóm ${i}`)), inds: [] });
  for (let k = 0; k < 50; k++) {
    const gi = k < 42 ? 0 : k - 41;
    groups[gi].inds.push(await mkInd(groups[gi].g.id, p.id, { name: k === 0 ? (nm('Chỉ số dài') + LONG).slice(0, 320) : nm(`CS ${k}`), max: 2, lock: true }));
  }
  const s = await mkSet();
  must(await putSetGroups(s.id, groups.map(x => x.g.id)), 'ghi nhóm bộ lớn');
  must(await putSetInds(s.id, groups.flatMap(x => x.inds.map(i => ({ id: i.id, max: 2 })))), 'ghi chỉ số bộ lớn');
  return { s, groups, longGroup: (await A('GET', `${IGR}/${groups[0].g.id}`)).data.name as string, longInd: (await A('GET', `${IND}/${groups[0].inds[0].id}`)).data.name as string };
})());
let _base: Promise<any> | undefined;
/** Dữ liệu nền dùng chung có sẵn (CHỈ ĐỌC / dùng để tạo kỳ Nháp): bộ BCS-001, thang TXL-001, đơn vị QC_DP, QC_BO. */
const base = () => (_base ??= (async () => {
  const find = async (res: string, code: string) => {
    const r = await A('GET', `${res}?page=1&size=50&filter=${F({ keyword: code, fullTextSearch: code })}`);
    const x = (r.data?.content ?? []).find((y: any) => y.code === code); if (!x) throw new Error(`thiếu dữ liệu nền ${res} ${code}`); return x;
  };
  const set = await find(SETS, 'BCS-001'), scale = await find(SCL, 'TXL-001'), dp = await find('organizations', 'QC_DP'), bo = await find('organizations', 'QC_BO');
  return { set, scale, dp, bo };
})());
async function mkCamp(o: { orgs?: string[]; name?: string } = {}) {
  const b = await base();
  const c = must(await A('POST', CAMP, { name: o.name ?? nm('kỳ'), type: 'AdHoc', indicatorSetId: b.set.id, scaleId: b.scale.id, startDate: '2026-11-13T00:00:00', endDate: '2026-11-30T23:59:59' }), 'tạo kỳ').data;
  if (o.orgs?.length) must(await A('PUT', `${CAMP}/${c.id}/organizations`, o.orgs), 'phân công');
  return (await A('GET', `${CAMP}/${c.id}`)).data;
}
const getCamp = async (id: string) => (await A('GET', `${CAMP}/${id}`)).data;
const orgCount = async (id: string) => ((await getCamp(id)).organizations ?? []).length;

// ---------------------------------------------------------------- Dọn dữ liệu (quét theo TAG)
const leftovers: string[] = [];
test.afterAll(async ({}, ti) => {
  ti.setTimeout(600_000);
  for (const c of await listKw(CAMP, TAG)) { const r = await A('DELETE', `${CAMP}/${c.id}`); if (r.status >= 300) leftovers.push(`kỳ ${c.name} (${c.status})`); }
  for (const s of await listKw(SETS, TAG)) { if (s.status === 'Locked') await A('POST', `${SETS}/${s.id}/unlock`, {}); const r = await A('DELETE', `${SETS}/${s.id}`); if (r.status >= 300) leftovers.push(`bộ ${s.code} ${s.name}: ${r.message}`); }
  for (const s of await listKw(SCL, TAG)) {
    const g = await getScale(s.id); if (g?.isLocked) await A('POST', `${SCL}/${s.id}/unlock?rowVersion=${g.rowVersion}`, {});
    const r = await A('DELETE', `${SCL}/${s.id}`); if (r.status >= 300) leftovers.push(`thang ${s.code} ${s.name}: ${r.message}`);
  }
  const inds = await listKw(IND, TAG);
  inds.sort((a, b) => Number(!!b.parentId) - Number(!!a.parentId));   // con trước, cha sau
  for (const x of inds) { if (x.isLocked) await A('PUT', `${IND}/${x.id}/unlock`, {}); }
  for (const x of inds) { const r = await A('DELETE', `${IND}/${x.id}`); if (r.status >= 300) leftovers.push(`chỉ số ${x.code}: ${r.message}`); }
  for (const x of await listKw(IGR, TAG)) { if (x.isLocked) await A('PUT', `${IGR}/${x.id}/unlock`, {}); const r = await A('DELETE', `${IGR}/${x.id}`); if (r.status >= 300) leftovers.push(`nhóm ${x.code}: ${r.message}`); }
  for (const x of await listKw(PIL, TAG)) { if (x.isLocked) await A('PUT', `${PIL}/${x.id}/unlock`, {}); const r = await A('DELETE', `${PIL}/${x.id}`); if (r.status >= 300) leftovers.push(`trụ cột ${x.code}: ${r.message}`); }
  if (leftovers.length) console.log(`[bug-gitlab B] dữ liệu không xóa được (tag ${TAG}):\n  ` + leftovers.join('\n  '));
});

// ---------------------------------------------------------------- Helper UI
const C = (p: Page) => p.locator('.ant-layout-content').first();
const ctext = async (p: Page) => norm(await C(p).innerText());
async function go(page: Page, route: string) {
  await page.goto(`${BASE}/vi/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
}
async function goDetail(page: Page, route: string, ready: string | RegExp) {
  await go(page, route);
  if (!(await C(page).getByText(ready).first().isVisible().catch(() => false))) { await page.reload({ waitUntil: 'networkidle' }); }
  await C(page).getByText(ready).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
}
const btn = (scope: Page | Locator, re: RegExp) => scope.locator('button').filter({ hasText: re }).filter({ visible: true });
/** font-weight của nút văn bản đầu tiên (không rỗng) trong phần tử. */
const textWeight = (l: Locator) => l.evaluate(e => {
  const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.textContent ?? '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
  const n = w.nextNode(); return getComputedStyle((n?.parentElement ?? e) as Element).fontWeight;
});
/** innerText nếu phần tử đang có, không thì '' (tránh chờ vô hạn). */
const textIf = async (l: Locator) => ((await l.count()) ? await l.innerText({ timeout: 5000 }).catch(() => '') : '');
const modal = (p: Page) => p.locator('.ant-modal').filter({ visible: true }).last();
async function searchList(page: Page, ph: RegExp, kw: string) { await page.getByPlaceholder(ph).first().fill(kw); await page.waitForTimeout(1800); }

// ---------------------------------------------------------------- Đọc .xlsx (unzip + XML, không cần thư viện)
type Cell = { v: string; t: string; fmt: string };
function readXlsx(file: string, sheet = 1): Record<string, Cell> {
  const x = (p: string) => { try { return execFileSync('unzip', ['-p', file, p]).toString(); } catch { return ''; } };
  const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const sst = [...x('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const styles = x('xl/styles.xml');
  const fmts: Record<string, string> = { '0': 'General' };
  for (const m of styles.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)) fmts[m[1]] = dec(m[2]);
  const xfs = [...(styles.match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] ?? '').matchAll(/<xf\b([^>]*)/g)].map(m => m[1].match(/numFmtId="(\d+)"/)?.[1] ?? '0');
  const out: Record<string, Cell> = {};
  for (const m of x(`xl/worksheets/sheet${sheet}.xml`).matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[2], body = m[3] ?? '';
    const t = attrs.match(/\bt="(\w+)"/)?.[1] ?? 'n', s = attrs.match(/\bs="(\d+)"/)?.[1] ?? '0';
    let v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
    if (t === 's') v = sst[Number(v)] ?? ''; else v = dec(v);
    out[m[1]] = { v, t: body ? t : '', fmt: fmts[xfs[Number(s)] ?? '0'] ?? `#${xfs[Number(s)]}` };
  }
  return out;
}
/** Giá trị Excel HIỂN THỊ (đủ cho định dạng General / 0 / 0.0 / #,##0.0 …). */
function shown(c?: Cell): string {
  if (!c || c.v === '') return '';
  if (c.t !== 'n') return c.v;
  const dec = c.fmt.match(/0\.(0+)/)?.[1].length ?? 0;
  return dec ? Number(c.v).toFixed(dec) : String(Number(c.v));
}
const rowsOf = (cells: Record<string, Cell>) => {
  const rows: Record<number, Record<string, Cell>> = {};
  for (const [ref, c] of Object.entries(cells)) { const m = ref.match(/^([A-Z]+)(\d+)$/)!; (rows[Number(m[2])] ??= {})[m[1]] = c; }
  return rows;
};
async function download(page: Page, click: () => Promise<any>, name: string) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), click()]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcb-dl-'));
  const f = path.join(dir, name); await dl.saveAs(f); return { file: f, suggested: dl.suggestedFilename() };
}

// ====================================================================== TRỤ CỘT
guardSession(test);

// ====================================================================== NHÓM CHỈ SỐ
test.describe('Nhóm chỉ số', () => {
  test(tc('IGR-V05'), async ({ page }) => {
    const { g, par } = await fx();
    await goDetail(page, `indicator-groups/${g.id}`, 'Chỉ số thuộc nhóm chỉ số');
    const url = page.url();
    const name = C(page).locator('tbody tr.ant-table-row').filter({ hasText: par.name }).first().getByText(par.name, { exact: true });
    const st = await name.evaluate(e => ({ a: !!e.closest('a'), cursor: getComputedStyle(e).cursor, deco: getComputedStyle(e).textDecorationLine }));
    expect(st.a, 'tên chỉ số cha không được nằm trong thẻ link').toBe(false);
    expect(st.cursor, 'con trỏ trên tên chỉ số cha').not.toBe('pointer');
    expect(st.deco, 'gạch chân').not.toContain('underline');
    await name.click(); await page.waitForTimeout(1500);
    expect(page.url(), 'bấm tên chỉ số cha không chuyển trang').toBe(url);
  });
  test(tc('IGR-V07'), async ({ page }) => {
    const { g, c1 } = await fx();
    await goDetail(page, `indicator-groups/${g.id}`, 'Chỉ số thuộc nhóm chỉ số');
    const url = page.url();
    const name = C(page).getByText(c1.name, { exact: true }).first();
    await name.hover(); await page.waitForTimeout(300);
    const st = await name.evaluate(e => ({ a: !!e.closest('a'), cursor: getComputedStyle(e).cursor, deco: getComputedStyle(e).textDecorationLine }));
    expect.soft(st.a, 'tên chỉ số con nằm trong thẻ link').toBe(false);
    expect.soft(st.cursor, 'con trỏ trên tên chỉ số con là dạng link').not.toBe('pointer');
    await name.click(); await page.waitForTimeout(2000);
    expect(page.url(), 'bấm tên chỉ số con không được chuyển sang trang chi tiết chỉ số').toBe(url);
  });
  test(tc('IGR-V08'), async ({ page }) => {
    const { g, par, c1, c2 } = await fx();
    await goDetail(page, `indicator-groups/${g.id}`, 'Chỉ số thuộc nhóm chỉ số');
    const rows = C(page).locator('tbody tr.ant-table-row');
    const texts = (await rows.allInnerTexts()).map(norm);
    const ip = texts.findIndex(t => t.includes(par.name));
    expect(ip, 'có dòng chỉ số cha').toBeGreaterThanOrEqual(0);
    const kids = texts.slice(ip + 1, ip + 3).join(' | ');
    expect(kids, 'hai chỉ số con nằm ngay dưới chỉ số cha').toContain(c1.name); expect(kids).toContain(c2.name);
    const pad = (i: number) => rows.nth(i).locator('td').first().evaluate(td => {
      const w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.textContent ?? '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
      return (w.nextNode()?.parentElement as Element).getBoundingClientRect().left;
    });
    expect(await pad(ip + 1), 'chỉ số con thụt cấp so với chỉ số cha').toBeGreaterThan(await pad(ip) + 8);
    const toggle = rows.nth(ip).locator('button[aria-expanded]').first();
    await expect(toggle, 'nút thu gọn/mở rộng ở chỉ số cha').toBeVisible();
    await toggle.click(); await page.waitForTimeout(600);
    await expect(C(page).getByText(c1.name, { exact: true }), 'thu gọn ẩn chỉ số con').toBeHidden();
    await toggle.click(); await page.waitForTimeout(600);
    await expect(C(page).getByText(c1.name, { exact: true })).toBeVisible();
  });
});

// ====================================================================== CHỈ SỐ

// ====================================================================== BỘ CHỈ SỐ
const openSetDetail = (page: Page, id: string) => goDetail(page, `indicator-sets/${id}`, 'Cấu trúc bộ chỉ số');
const openBuilder = async (page: Page, id: string) => { await goDetail(page, `indicator-sets/${id}/builder`, 'Cấu hình bộ chỉ số'); await page.waitForTimeout(800); };
const structSearch = (page: Page) => C(page).getByPlaceholder(/tìm trụ cột, nhóm chỉ số, chỉ số/i);

// ====================================================================== BỘ CHỈ SỐ — Xuất Excel chi tiết BCS-333 (catalog-BUG.mjs, #289) — CHỈ ĐỌC
const B333 = '2c5306e7-4c6c-46ed-b526-88ffbc4b3dad';
let _x333: Promise<any> | undefined;
async function x333(page: Page) {
  return (_x333 ??= (async () => {
    await openSetDetail(page, B333);
    const t = await ctext(page);
    expect(t, 'đúng bộ BCS-333').toContain('BCS-333');
    const screen = (await C(page).locator('tbody tr.ant-table-row').evaluateAll(rs => rs.map(r => [...r.querySelectorAll('td')].map(td => (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim()))));
    const updated = t.match(/Cập nhật lần cuối\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/)?.[1] ?? '';
    const { file } = await download(page, () => btn(C(page), /xuất excel/i).first().click(), 'bcs-333.xlsx');
    const cells = readXlsx(file); const rows = rowsOf(cells);
    const info: Record<string, Cell> = {};
    for (const r of Object.values(rows)) if (r.A && r.B && !r.C?.v) info[r.A.v] = r.B;
    const hr = Number(Object.entries(rows).find(([, r]) => Object.values(r).some(c => c.v === 'Điểm tối đa'))?.[0] ?? 0);
    const head = Object.fromEntries(Object.entries(rows[hr] ?? {}).map(([col, c]) => [c.v, col]));
    const data: Record<string, Cell>[] = [];
    for (let i = hr + 1; rows[i]; i++) data.push(rows[i]);
    return { screen, updated, info, head, data };
  })());
}
const NONE = (s: string) => (/^[–—-]?$/.test((s ?? '').trim()) ? '' : s.trim());

// ====================================================================== THANG XẾP LOẠI
const lvRows = (p: Page) => C(p).locator('tbody tr.ant-table-row');

// ====================================================================== QUẢN LÝ TỰ ĐÁNH GIÁ
const CR = 'self-assessment-campaigns';
const openCampDetail = (page: Page, id: string) => goDetail(page, `${CR}/${id}`, 'Mã kỳ');
async function unitsTab(page: Page, id: string) {
  await openCampDetail(page, id);
  await btn(C(page), /^\s*Đơn vị tham gia\s*$/).first().click(); await page.waitForTimeout(1800);
}
/** Tiêu đề cột của bảng Đơn vị tham gia (tab Chi tiết bị ẩn vẫn còn bảng trong DOM). */
const unitHeads = async (page: Page) => (await C(page).locator('table').filter({ has: page.locator('th', { hasText: /^Mã đơn vị$/ }) }).first().locator('thead th').allInnerTexts()).map(norm);
async function openAddCamp(page: Page) {
  await go(page, CR);
  await btn(page, /^\s*Thêm tự đánh giá\s*$/).first().click();
  const d = dlg(page); await d.waitFor(); await page.waitForTimeout(600); return d;
}
const fItem = (page: Page, d: Locator, re: RegExp) => d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: re }) });
async function selIn(page: Page, d: Locator, label: RegExp, opt: string, typed?: string) {
  await fItem(page, d, label).locator('.ant-select').first().click();
  if (typed) { await page.keyboard.type(typed); }
  await page.waitForTimeout(1000);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option', { hasText: opt }).first().click();
  await page.waitForTimeout(400);
}
async function setDate(page: Page, d: Locator, label: RegExp, v: string) {
  const i = fItem(page, d, label).locator('input').first(); await i.click(); await i.fill(v); await i.press('Enter'); await page.waitForTimeout(300);
}
async function fillCamp(page: Page, d: Locator, o: { name: string; type: 'Định kỳ' | 'Đột xuất'; period?: string; units: string[] }) {
  const b = await base();
  await d.getByPlaceholder(/nhập tên đánh giá/i).fill(o.name);
  await selIn(page, d, /^Loại kỳ$/, o.type);
  if (o.type === 'Định kỳ') await selIn(page, d, /^Kỳ$/, o.period ?? 'Quý');
  else { await setDate(page, d, /^Ngày bắt đầu$/, '13/11/2026'); await setDate(page, d, /^Ngày kết thúc$/, '30/11/2026'); }
  await selIn(page, d, /^Bộ chỉ số áp dụng$/, b.set.name, '001');
  await selIn(page, d, /^Thang xếp loại$/, 'TXL-001');
  for (const u of o.units) { await selIn(page, d, /^Đơn vị tham gia$/, u, u); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
}
async function saveCamp(page: Page, d: Locator) {
  await btn(d, /^\s*Lưu\s*$/).last().click();
  const t: string[] = [];
  for (let i = 0; i < 10; i++) { t.push(...await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts()); await page.waitForTimeout(300); }
  return norm([...new Set(t)].join(' | '));
}

// ====================================================================== ATB — validate Mã ở API (#208)
const RES3 = [PIL, IGR, IND] as const;
async function postWithCode(res: string, code: any) {
  const { p, g } = await fx();
  const body: any = res === PIL ? { code, name: nm('ATB trụ cột'), displayOrder: 0 }
    : res === IGR ? { pillarId: p.id, code, name: nm('ATB nhóm'), displayOrder: 0 }
    : { indicatorGroupId: g.id, pillarId: p.id, code, name: nm('ATB chỉ số'), minScore: 0, maxScore: 1 };
  const r = await A('POST', res, body);
  return { status: r.status, message: r.message, code: r.data?.code };
}
});
