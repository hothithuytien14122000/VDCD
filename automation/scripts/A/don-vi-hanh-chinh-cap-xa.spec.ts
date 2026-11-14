// A.IV.2 ĐƠN VỊ HÀNH CHÍNH CẤP XÃ — script bám testcase COM-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, FILTERS, dataRows, openList, searchFor, waitList, rowTexts, findRow, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg, ensureProvince,
  ensureCommune, registerListSuite, registerAuthTest, registerMatrixTest, registerPerfTest, findByName, AUTO_CODE, checkAutoCodeUI,
} from './common';
import { DUP_CODE } from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { cellText } from './common';
import { userBody } from './common';
import { tokenOf } from './common';
import { fold } from './common';
import { API_BASE } from '../api';
import { guardSession } from '../session-guard';

const cfg = PAGES.COM;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('COM');

// Giao diện mới: form không còn ô Mã (mã tự sinh XA-nnnn); Tỉnh/thành bắt buộc; nút "Thêm xã/phường", nút lưu "Lưu"
const PH_NAME = /nhập tên xã\/phường/i, PROV = /^\s*tỉnh\/thành/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm (mới )?xã\/phường/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => btnSave(d).click();
async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  await (await findRow(page, cfg, code)).first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/communes\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
}

test.describe('Xã/phường › Lọc & chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('COM-L12'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    await openList(page, cfg);
    await pickOption(page, page.locator(FILTERS).first(), p.name ?? `qc.automation Tỉnh ${p.code}`); await waitList(page);
    const texts = await rowTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(p.name);
    expect(texts.join('|')).toContain(c.code);
  });
  test(tc('COM-V01'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id, communeId: c.id });
    await openDetail(page, c.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [c.code, c.name, p.name, 'Số đơn vị', 'Đơn vị thuộc xã/phường', o.name]) expect(txt, `thiếu "${s}"`).toContain(s);
    // Giao diện mới: màn chi tiết chỉ còn nút Cập nhật / Xoá (bỏ "Thêm mới đơn vị vào xã")
    await expect(page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first()).toBeVisible();
  });
});

test.describe('Xã/phường › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('COM-C01'), async ({ page }) => {
    const p = await ensureProvince(made); const tag = made.add('communes', code8(), 'nameHas');
    const d = await openAdd(page);
    await pickByLabel(page, d, PROV, p.name);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${tag}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findByName('communes', tag);
    expect(rec?.provinceId).toBe(p.id);
    expect(rec?.code, 'mã tự sinh').toMatch(AUTO_CODE.communes);
    await expect((await findRow(page, cfg, rec.code)).first()).toContainText(p.name);
  });
  test(tc('COM-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(2);
  });
  test(tc('COM-C03'), async ({ page }) => {
    // Mã tự sinh: không còn nhập mã nên không thể trùng → form không có ô Mã, mã sinh đúng mẫu & không trùng
    const p = await ensureProvince(made); const a = await ensureCommune(made, p.id);
    await checkAutoCodeUI(page, cfg, made, { openAdd, submit: submitAdd, existing: a,
      fillValid: async (pg, d, tag) => { await pickByLabel(pg, d, PROV, p.name); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${tag}`); } });
  });
  test(tc('COM-C04'), async ({ page }) => {
    const tag = made.add('communes', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation hủy ${tag}`);
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findByName('communes', tag)).toBeNull();
  });
  test(tc('COM-C05'), async ({ page }) => {
    // Giao diện mới: Tỉnh/thành là trường bắt buộc → không chọn tỉnh thì báo lỗi, không tạo xã
    const tag = made.add('communes', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${tag}`);
    await submitAdd(d); await page.waitForTimeout(800);
    await expect(d).toBeVisible();
    await expect(d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: PROV }) }).locator('.ant-form-item-explain-error')).toHaveCount(1);
    expect(await findByName('communes', tag), 'không chọn tỉnh thì không được tạo').toBeNull();
  });
});

test.describe('Xã/phường › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openEdit(page: Page, code: string) {
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
  }
  test(tc('COM-E02'), async ({ page }) => {
    const p1 = await ensureProvince(made), p2 = await ensureProvince(made);
    const c = await ensureCommune(made, p1.id);
    const d = await openEdit(page, c.code);
    await pickByLabel(page, d, PROV, p2.name); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('communes', c.code))?.provinceId).toBe(p2.id);
  });
  test(tc('COM-E03'), async ({ page }) => {
    const c = await ensureCommune(made, null);
    const d = await openEdit(page, c.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('communes', c.code))?.name).toBe(c.name);
  });
  test(tc('COM-E04'), async ({ page }) => {
    const c = await ensureCommune(made, null);
    const d = await openEdit(page, c.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('communes', c.code))?.name).toBe(c.name);
  });
});

test.describe('Xã/phường › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('COM-D01'), async ({ page }) => {
    const c = await ensureCommune(made, null);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, c.code), /xo[áạ]/i); await confirmYes(page);
    expect(await findApi('communes', c.code)).toBeNull();
  });
  test(tc('COM-D02'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    await ensureOrg(made, { __level: 3, provinceId: p.id, communeId: c.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, c.code);
    const items = await rowMenuItems(page, row);
    if (items.some(i => /xo[áạ]/i.test(i))) { await rowAction(page, row, /xo[áạ]/i); await confirmYes(page); expect(await toast(page)).toMatch(/không thể xóa|đang được|tham chiếu/i); }
    expect(await findApi('communes', c.code), 'xã đang có đơn vị tham chiếu không được xóa').toBeTruthy();
    expect((await api('DELETE', `communes/${c.id}`)).status, 'API xóa xã đang được tham chiếu').toBeGreaterThanOrEqual(400);
  });
  test(tc('COM-D03'), async ({ page }) => {
    const c = await ensureCommune(made, null);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, c.code), /xo[áạ]/i); await confirmNo(page);
    expect(await findApi('communes', c.code)).toBeTruthy();
  });
});

test.describe('Xã/phường › Tham chiếu đơn vị', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('COM-R01'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    // Giao diện mới: màn chi tiết xã không còn nút "Thêm mới đơn vị vào xã"; tham chiếu xã được chọn ở form Đơn vị (ô "Đơn vị hành chính cấp xã")
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id });
    const cur = (await api('GET', `organizations/${o.id}`)).data;
    const u = await api('PUT', `organizations/${o.id}`, { ...cur, provinceId: p.id, communeId: c.id });
    expect(u.status, `gán xã cho đơn vị (HTTP ${u.status}: ${u.message})`).toBe(200);
    expect((await findApi('organizations', o.code))?.communeId).toBe(c.id);
    await openDetail(page, c.code);
    await expect(dataRows(page).filter({ hasText: o.code })).toHaveCount(1);
    expect((await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ')).toMatch(/Số đơn vị\s*1\b/);
  });
  test(tc('COM-R02'), async ({ page }) => {
    const p = await ensureProvince(made); const c = await ensureCommune(made, p.id);
    const o = await ensureOrg(made, { __level: 3, provinceId: p.id, communeId: c.id });
    // Giao diện mới: bỏ tham chiếu xã bằng cách sửa đơn vị (xóa ô xã) → đơn vị không còn trong danh sách đơn vị của xã
    await openDetail(page, c.code);
    await expect(dataRows(page).filter({ hasText: o.code })).toHaveCount(1);
    const cur = (await api('GET', `organizations/${o.id}`)).data;
    const u = await api('PUT', `organizations/${o.id}`, { ...cur, communeId: null });
    expect(u.status, `bỏ tham chiếu xã (HTTP ${u.status}: ${u.message})`).toBe(200);
    expect((await findApi('organizations', o.code))?.communeId ?? null).toBeNull();
    await page.reload(); await page.waitForTimeout(1500);
    await expect(dataRows(page).filter({ hasText: o.code })).toHaveCount(0);
  });
});

test.describe('Xã/phường › Bảo mật / Hiệu năng', () => {
  registerAuthTest('COM-S01', cfg);
  registerMatrixTest('COM-S02', cfg);
  registerPerfTest('COM-P01', cfg);
});

let pv: Record<string, { id: string; name?: string }> = {};
test.afterEach(() => { pv = {}; });
registerEdgeTests({
  P: 'COM', cfg, made, openAdd, submit: submitAdd, autoCode: AUTO_CODE.communes,
  fillBlank: async d => { await d.getByPlaceholder(PH_NAME).fill('   '); },
  // danh sách tỉnh trong form được nạp khi mở trang → tỉnh tạo sau đó chưa có; chọn tỉnh đầu tiên sẵn có
  fillValid: async (pg, d, tag) => { await pickByLabel(pg, d, PROV); await d.getByPlaceholder(PH_NAME).fill(`qc.automation Xã ${tag}`); },
  hasParent: true,
  mk: async (code, name, parent = 'A') => { pv[parent] ??= await ensureProvince(made); const r = await api('POST', 'communes', { code, name, provinceId: pv[parent].id }); return { status: r.status, message: r.message, data: r.data }; },
  makeNamed: async name => { const r = await api('POST', 'communes', { name }); if (r.status !== 200) throw new Error(r.message); made.addId('communes', r.data.id); return r.data.code; },
  apiEmpty: async () => { const r = await api('POST', 'communes', { name: '' }); if (r.data?.id) made.addId('communes', r.data.id); return { status: r.status, message: r.message }; },
});

registerNotFoundTest('COM-V02', cfg);

// ===== Case bổ sung từ bug GitLab (gộp từ don-vi-hanh-chinh-cap-xa-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
test.describe(() => {
const ADM = 'admin';
const A = (m: string, r: string, b?: any, as = ADM) => api(m, r, b, as);
const rowsOf = (d: any): any[] => d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
const B = API_BASE;
const ROUTE: Record<string, string> = { PRV: 'provinces', COM: 'communes', UTY: 'unit-types', ORG: 'organizations' };
const P4 = ['PRV', 'COM', 'UTY', 'ORG'] as const;
const ADD_BTN: Record<string, RegExp> = { PRV: /thêm (mới )?tỉnh/i, COM: /thêm (mới )?xã/i, UTY: /thêm (mới )?loại đơn vị/i, ORG: /thêm (mới )?đơn vị/i };
const PH_NAME: Record<string, RegExp> = { PRV: /nhập tên tỉnh/i, COM: /nhập tên xã/i, UTY: /vd: Cấp Sở|nhập tên loại/i, ORG: /nhập tên đơn vị/i };
const ADMIN_NAME = () => JSON.parse(Buffer.from(tokenOf(ADM).split('.')[1], 'base64url').toString())['x-fullName'] as string;

// ---------------------------------------------------------------- dữ liệu thử (token admin) + dọn
async function findByTag(res: string, tag: string): Promise<any[]> {
  const hit = (x: any) => [x.name, x.userName, x.code].some((v: any) => String(v ?? '').includes(tag));
  const q = await A('GET', `${res}?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ keyword: tag, fullTextSearch: tag }))}`);
  const first = rowsOf(q.data).filter(hit); if (first.length) return first;
  const out: any[] = [];
  for (let p = 1; p <= 6; p++) { const r = await A('GET', `${res}?page=${p}&size=100`); out.push(...rowsOf(r.data).filter(hit)); if (p >= (r.data?.totalPages ?? 1)) break; }
  return out;
}
class Track {
  private items: { res: string; key: string; byTag: boolean }[] = [];
  id(res: string, id: string) { if (id) this.items.push({ res, key: id, byTag: false }); return id; }
  tag(res: string, tag: string) { this.items.push({ res, key: tag, byTag: true }); return tag; }
  async clean() {
    // thứ tự dọn: người dùng → đơn vị → xã → loại → tỉnh (con trước cha)
    const order = ['idm/users', 'organizations', 'communes', 'unit-types', 'provinces'];
    const its = this.items.reverse().sort((a, b) => order.indexOf(a.res) - order.indexOf(b.res)); this.items = [];
    for (const it of its) {
      try {
        const xs = it.byTag ? await findByTag(it.res, it.key) : [{ id: it.key }];
        for (const x of xs) {
          if (it.res === 'idm/users') {
            const u = (await A('GET', `idm/users/${x.id}`)).data;
            // người dùng bị xóa mềm vẫn chặn xóa đơn vị → gỡ khỏi đơn vị trước khi xóa
            if (u?.organizationId) await A('POST', `organizations/${u.organizationId}/users/remove`, { userIds: [x.id] });
          }
          if (it.res === 'organizations') { const o = (await A('GET', `organizations/${x.id}`)).data; if (o?.isLocked) await A('PUT', `organizations/${x.id}/unlock`, {}); }
          await A('DELETE', `${it.res}/${x.id}`);
        }
      } catch { /* bỏ qua */ }
    }
  }
}
const made = new Track();
test.afterEach(async () => { await made.clean(); });

const nm = (kind: string, tag = code8()) => ({ tag, name: `qc.automation ${kind} ${tag}` });
async function mkProvince() { const { tag, name } = nm('Tỉnh'); const r = await A('POST', 'provinces', { name }); if (r.status !== 200) throw new Error('Tạo tỉnh lỗi: ' + r.message); made.id('provinces', r.data.id); return { ...r.data, name, tag }; }
async function mkCommune(provinceId: string) { const { tag, name } = nm('Xã'); const r = await A('POST', 'communes', { name, provinceId }); if (r.status !== 200) throw new Error('Tạo xã lỗi: ' + r.message); made.id('communes', r.data.id); return { ...r.data, name, tag }; }
async function mkType(adminLevel = 2, extra: any = {}) { const { tag, name } = nm('Loại'); const r = await A('POST', 'unit-types', { name, adminLevel, ...extra }); if (r.status !== 200) throw new Error('Tạo loại lỗi: ' + r.message); made.id('unit-types', r.data.id); return { ...r.data, name, tag }; }
async function mkOrg(extra: any = {}, lock = false) {
  const unitTypeId = extra.unitTypeId ?? (await mkType(2)).id;
  const { tag, name } = nm('ĐV'); const r = await A('POST', 'organizations', { name, ...extra, unitTypeId });
  if (r.status !== 200) throw new Error('Tạo đơn vị lỗi: ' + r.message); made.id('organizations', r.data.id);
  if (lock) { const l = await A('PUT', `organizations/${r.data.id}/lock`, {}); if (l.status !== 200) throw new Error('Khóa lỗi ' + l.message); }
  return { ...r.data, name, tag };
}
async function mkUser(organizationId: string | null) {
  const u = code8().toLowerCase(); made.tag('idm/users', u);
  const r = await A('POST', 'idm/users', userBody(u, { organizationId }));
  if (r.status !== 200) throw new Error('Tạo user lỗi: ' + r.message);
  const rec = (await findByTag('idm/users', u)).find(x => x.userName === u);
  return { userName: u, id: rec?.id as string };
}
/** Loại đơn vị chuẩn trong 200 loại đầu (ô chọn Loại đơn vị của form Đơn vị chỉ nạp 200 loại đầu theo mã). */
async function stdType(level: number) {
  const xs = rowsOf((await A('GET', 'unit-types?page=1&size=200&sort=%2Bcode')).data);
  const t = xs.find(x => x.adminLevel === level && !/qc\.automation|qc_/i.test(x.name) && xs.filter(y => y.name === x.name).length === 1 && x.name.length > 4);
  if (!t) throw new Error(`Không có loại đơn vị cấp ${level} trong 200 loại đầu`);
  return t as { id: string; name: string; code: string };
}

// ---------------------------------------------------------------- UI tiện ích
const content = (page: Page) => page.locator('.ant-layout-content').first();
const pageText = async (page: Page) => (await content(page).innerText()).replace(/\s+/g, ' ');
async function openAddP(page: Page, P: string) {
  await openList(page, PAGES[P]);
  await page.locator('.ant-layout-content button', { hasText: ADD_BTN[P] }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return d;
}
async function openEditP(page: Page, P: string, code: string) {
  await openList(page, PAGES[P]);
  await rowAction(page, await findRow(page, PAGES[P], code), /cập nhật/i);
  const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600); return d;
}
async function openDetailId(page: Page, P: string, id: string) {
  await page.goto(`${B}/vi/${ROUTE[P]}/${id}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
}
const crumbs = (page: Page) => page.locator('header .text-ink-breadcrumb > span');
const dlgTitle = (d: Locator) => d.locator('h3').first();
const CONFIRM = '.ant-modal-confirm, .ant-popconfirm, .ant-modal-wrap:not([style*="display: none"]) .ant-modal';
const confirmBox = (page: Page) => page.locator(CONFIRM).filter({ visible: true }).last();
const css = (l: Locator, props: string[]) => l.evaluate((e, ps) => { const s = getComputedStyle(e); return Object.fromEntries(ps.map(p => [p, s.getPropertyValue(p)])); }, props);
const primaryBg = async (page: Page) => (await css(page.locator('.ant-layout-content button', { hasText: /^\s*Thêm/ }).first(), ['background-color']))['background-color'];
/** Đọc file xlsx (giải nén bằng unzip hệ thống) → mảng dòng. */
function xlsxRows(file: string): string[][] {
  const z = (n: string) => { try { return execFileSync('unzip', ['-p', file, n], { maxBuffer: 64 << 20 }).toString('utf8'); } catch { return ''; } };
  const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const shared = [...z('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const sheet = z('xl/worksheets/sheet1.xml');
  const colIdx = (ref: string) => { const L = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A'; let n = 0; for (const ch of L) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r => {
    const out: string[] = [];
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = /t="(\w+)"/.exec(c[1])?.[1], body = c[2] ?? '', ref = /r="([A-Z]+\d+)"/.exec(c[1])?.[1];
      const v = t === 's' ? shared[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])] ?? '' : t === 'inlineStr' ? dec([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')) : dec(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
      out[ref ? colIdx(ref) : out.length] = v.trim();
    }
    return Array.from(out, x => x ?? '');
  });
}
async function exportXlsx(page: Page, name: string) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByRole('button', { name: /xuất excel/i }).first().click()]);
  const f = `/tmp/qca-a2-${name}-${Date.now()}.xlsx`; await dl.saveAs(f); return f;
}
/** Thông tin cột của bảng chính: tiêu đề, căn lề th/td, font của th, font-weight phần chữ trong td (dòng 1). */
async function tableInfo(page: Page) {
  return page.evaluate(() => {
    const ths = [...document.querySelectorAll('.ant-layout-content .ant-table-thead')].find(h => (h as HTMLElement).offsetParent)!
      .querySelectorAll('th:not(.ant-table-cell-scrollbar)');
    const tr = document.querySelector('.ant-layout-content tbody tr.ant-table-row')!;
    const tds = [...tr.querySelectorAll(':scope > td')];
    const txtWeight = (el: Element) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n: Node | null; while ((n = w.nextNode())) if ((n.textContent || '').trim()) return getComputedStyle(n.parentElement!).fontWeight; return ''; };
    return [...ths].map((th, i) => ({
      head: (th as HTMLElement).innerText.trim(), thAlign: getComputedStyle(th).textAlign, thSize: getComputedStyle(th).fontSize,
      tdAlign: tds[i] ? getComputedStyle(tds[i]).textAlign : '', weight: tds[i] ? txtWeight(tds[i]) : '', text: tds[i] ? (tds[i] as HTMLElement).innerText.trim() : '',
    }));
  });
}
const side = (a: string) => /right|end/.test(a) ? 'right' : /center/.test(a) ? 'center' : 'left';

// ======================================================================= ĐƠN VỊ HÀNH CHÍNH CẤP TỈNH
guardSession(test);

async function rowTexts4(page: Page) {
  return dataRows(page).evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll(':scope > td')].map(td => ((td as HTMLElement).innerText || '').split('\n')[0].trim())));
}

// ======================================================================= ĐƠN VỊ HÀNH CHÍNH CẤP XÃ
test.describe('Xã/phường', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('COM-V03'), async ({ page }) => {
    const c = await mkCommune((await mkProvince()).id);
    await openDetailId(page, 'COM', c.id);
    await expect(content(page)).toContainText(c.name);
    expect(await pageText(page)).not.toMatch(/mở module đơn vị/i);
  });
  test(tc('COM-V04'), async ({ page }) => {
    const c = await mkCommune((await mkProvince()).id);
    await openDetailId(page, 'COM', c.id);
    const last = (await crumbs(page).last().innerText()).trim();
    expect(last).not.toMatch(/^chi tiết$/i);
    expect(last).toBe(c.name);
  });
  test(tc('COM-L13'), async ({ page }) => {
    await openList(page, PAGES.COM);
    const screen = (await rowTexts4(page)).map(t => t[1]);
    const rows = xlsxRows(await exportXlsx(page, 'com'));
    const hi = rows.findIndex(r => r.some(c => /^mã/i.test(c)));
    const iCode = rows[hi].findIndex(h => /^mã/i.test(h));
    const file = rows.slice(hi + 1).map(r => r[iCode]).filter(Boolean).slice(0, screen.length);
    expect(file, `màn hình: ${screen.slice(0, 5).join(', ')}… / file: ${file.slice(0, 5).join(', ')}…`).toEqual(screen);
  });
});

// ======================================================================= LOẠI ĐƠN VỊ

// ======================================================================= ĐƠN VỊ

// ======================================================================= THAM SỐ HỆ THỐNG / NHẬT KÝ / XÁC THỰC / API CHUNG
});
