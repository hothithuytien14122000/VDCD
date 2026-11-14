// A.IV.3 LOẠI ĐƠN VỊ — script bám testcase UTY-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, waitList, rowTexts, findRow, pickOption, pickByLabel, dlg,
  btnCancel, btnSave, toast, rowAction, rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg,
  ensureUnitType, registerListSuite, registerAuthTest, registerMatrixTest, registerPerfTest, FILTERS,
  findByName, AUTO_CODE, checkAutoCodeUI, totalOf,
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

const cfg = PAGES.UTY;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('UTY');

// Mã loại do hệ thống tự sinh (LDV-nnn): form Thêm mới không còn ô Mã
const PH_NAME = /vd: Cấp Sở/i, PH_DESC = /mô tả phạm vi/i;
const LEVEL = { 1: 'Trung ương', 2: 'Cấp tỉnh', 3: 'Cấp xã' } as const;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm (mới )?loại đơn vị/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => btnSave(d).click();
async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  await (await findRow(page, cfg, code)).first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/unit-types\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
}

test.describe('Loại đơn vị › Bộ lọc', () => {
  test(tc('UTY-L12'), async ({ page }) => {
    await openList(page, cfg);
    for (const label of ['Cấp tỉnh', 'Cấp xã', 'Trung ương']) {
      await pickOption(page, page.locator(FILTERS).first(), label); await waitList(page);
      const texts = await rowTexts(page);
      expect(texts.length, `phải có loại cấp "${label}"`).toBeGreaterThan(0);
      for (const t of texts) expect(t).toContain(label);
    }
  });
});

test.describe('Loại đơn vị › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('UTY-V01'), async ({ page }) => {
    const ut = await ensureUnitType(made, 2); const o = await ensureOrg(made, { unitTypeId: ut.id });
    await openDetail(page, ut.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [ut.name, 'Mã loại', ut.code, 'Cấp hành chính', 'Cấp tỉnh', 'Số đơn vị', 'Cập nhật lần cuối', 'Đơn vị thuộc loại', o.name]) expect(txt, `thiếu "${s}"`).toContain(s);
    expect(txt).toMatch(/mô tả/i);
    // Giao diện mới: màn chi tiết chỉ còn nút Cập nhật (+ Xoá); bỏ "Thêm mới đơn vị", "Xuất Excel"
    await expect(page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first()).toBeVisible();
  });
  test(tc('UTY-V02'), async ({ page }) => {
    const ut = await ensureUnitType(made, 2); await ensureOrg(made, { unitTypeId: ut.id }); await ensureOrg(made, { unitTypeId: ut.id });
    await openDetail(page, ut.code);
    // Giao diện mới: bỏ tiêu đề "ĐƠN VỊ THUỘC LOẠI - N" → so trường "Số đơn vị" với số bản ghi bảng "Đơn vị thuộc loại đơn vị"
    const m = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ').match(/Số đơn vị\s*(\d+)/i);
    expect(m, 'không thấy trường "Số đơn vị"').toBeTruthy();
    expect(Number(m![1])).toBe(2);
    expect(await dataRows(page).count()).toBe(2);
    expect(await totalOf(page)).toBe(2);
  });
});

test.describe('Loại đơn vị › Thêm mới', () => {
  test.describe.configure({ timeout: 90_000 });
  needWrite();
  test(tc('UTY-C01'), async ({ page }) => {
    const tag = made.add('unit-types', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Loại ${tag}`);
    await pickByLabel(page, d, /cấp hành chính/i, 'Cấp tỉnh');
    await d.getByPlaceholder(PH_DESC).fill('qc.automation mô tả');
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findByName('unit-types', tag);
    expect(rec?.name).toBe(`qc.automation Loại ${tag}`); expect(rec?.description).toBe('qc.automation mô tả'); expect(rec?.adminLevel).toBe(2);
    expect(rec?.code, 'mã tự sinh').toMatch(AUTO_CODE['unit-types']);
    const row = await findRow(page, cfg, rec.code);
    await expect(row.first()).toContainText('Cấp tỉnh');
    expect((await row.first().locator('td').nth(4).innerText()).trim()).toBe('0');
  });
  test(tc('UTY-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    // form mới chỉ còn 2 trường bắt buộc: Tên loại đơn vị, Cấp hành chính (Mã tự sinh)
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(2);
  });
  test(tc('UTY-C03'), async ({ page }) => {
    // Mã tự sinh: không còn nhập mã nên không thể trùng → kiểm tra form không có ô Mã, mã sinh đúng mẫu & không trùng, ô Mã ở form sửa bị khóa
    const a = await ensureUnitType(made);
    await checkAutoCodeUI(page, cfg, made, { openAdd, submit: submitAdd, existing: a,
      fillValid: async (pg, d, tag) => { await d.getByPlaceholder(PH_NAME).fill(`qc.automation Loại ${tag}`); await pickByLabel(pg, d, /cấp hành chính/i, 'Cấp tỉnh'); } });
  });
  test(tc('UTY-C04'), async ({ page }) => {
    const tag = made.add('unit-types', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation hủy ${tag}`);
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findByName('unit-types', tag)).toBeNull();
  });
  test(tc('UTY-C05'), async ({ page }) => {
    for (const [lvl, label] of [[1, 'Trung ương'], [2, 'Cấp tỉnh'], [3, 'Cấp xã']] as const) {
      const tag = made.add('unit-types', code8(), 'nameHas');
      const d = await openAdd(page);
      await d.getByPlaceholder(PH_NAME).fill(`qc.automation Loại ${label} ${tag}`);
      await pickByLabel(page, d, /cấp hành chính/i, label);
      await submitAdd(d);
      expect(await toast(page)).toMatch(/thành công/i);
      const rec = await findByName('unit-types', tag);
      expect(rec?.adminLevel, `cấp "${label}"`).toBe(lvl);
      await expect((await findRow(page, cfg, rec.code)).first()).toContainText(label);
    }
  });
});

test.describe('Loại đơn vị › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openEdit(page: Page, code: string) {
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
  }
  test(tc('UTY-E01'), async ({ page }) => {
    const ut = await ensureUnitType(made); const nn = `qc.automation Loại đã sửa ${ut.tag}`;
    const d = await openEdit(page, ut.code);
    await d.getByPlaceholder(PH_NAME).fill(nn); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('unit-types', ut.code))?.name).toBe(nn);
    await expect((await findRow(page, cfg, ut.code)).first()).toContainText(nn);
  });
  test(tc('UTY-E02'), async ({ page }) => {
    const ut = await ensureUnitType(made, 2);
    const d = await openEdit(page, ut.code);
    await pickByLabel(page, d, /cấp hành chính/i, 'Cấp xã');
    await d.getByPlaceholder(PH_DESC).fill('qc.automation mô tả đã sửa'); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('unit-types', ut.code);
    expect(rec?.adminLevel).toBe(3); expect(rec?.description).toBe('qc.automation mô tả đã sửa');
    await expect((await findRow(page, cfg, ut.code)).first()).toContainText('Cấp xã');
  });
  test(tc('UTY-E03'), async ({ page }) => {
    const ut = await ensureUnitType(made);
    const d = await openEdit(page, ut.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('unit-types', ut.code))?.name).toBe(ut.name);
  });
  test(tc('UTY-E04'), async ({ page }) => {
    const ut = await ensureUnitType(made);
    const d = await openEdit(page, ut.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('unit-types', ut.code))?.name).toBe(ut.name);
  });
});

test.describe('Loại đơn vị › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('UTY-D01'), async ({ page }) => {
    const ut = await ensureUnitType(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, ut.code), /xo[áạ]/i); await confirmYes(page);
    expect(await findApi('unit-types', ut.code)).toBeNull();
    await searchFor(page, cfg, ut.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('UTY-D02'), async () => {
    const ut = await ensureUnitType(made); await ensureOrg(made, { unitTypeId: ut.id });
    const r = await api('DELETE', `unit-types/${ut.id}`);
    expect(r.status).toBe(400); expect(r.message).toMatch(/không thể xóa/i);
    expect(await findApi('unit-types', ut.code)).toBeTruthy();
  });
  test(tc('UTY-D03'), async ({ page }) => {
    const ut = await ensureUnitType(made); await ensureOrg(made, { unitTypeId: ut.id });
    await openList(page, cfg);
    const items = await rowMenuItems(page, await findRow(page, cfg, ut.code));
    expect(items.some(i => /cập nhật/i.test(i))).toBeTruthy();
    expect(items.some(i => /xo[áạ]/i.test(i)), `menu: ${items.join(' | ')}`).toBeFalsy();
  });
  test(tc('UTY-D04'), async ({ page }) => {
    const ut = await ensureUnitType(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, ut.code), /xo[áạ]/i); await confirmNo(page);
    expect(await findApi('unit-types', ut.code)).toBeTruthy();
  });
});

test.describe('Loại đơn vị › Bảo mật / Hiệu năng', () => {
  registerAuthTest('UTY-S01', cfg);
  registerMatrixTest('UTY-S02', cfg);
  registerPerfTest('UTY-P01', cfg);
});

registerEdgeTests({
  P: 'UTY', cfg, made, openAdd, submit: submitAdd,
  autoCode: AUTO_CODE['unit-types'],
  fillBlank: async d => { await d.getByPlaceholder(PH_NAME).fill('   '); },
  fillValid: async (page, d, tag) => { await d.getByPlaceholder(PH_NAME).fill(`qc.automation Loại ${tag}`); await pickByLabel(page, d, /cấp hành chính/i, 'Cấp tỉnh'); },
  mk: async (code, name) => { const r = await api('POST', 'unit-types', { code, name, adminLevel: 2 }); return { status: r.status, message: r.message, data: r.data }; },
  makeNamed: async name => { const r = await api('POST', 'unit-types', { name, adminLevel: 2 }); if (r.status !== 200) throw new Error(r.message); made.addId('unit-types', r.data.id); return r.data.code; },
  apiEmpty: async () => { const r = await api('POST', 'unit-types', { name: '', adminLevel: 2 }); if (r.data?.id) made.addId('unit-types', r.data.id); return { status: r.status, message: r.message }; },
});

registerNotFoundTest('UTY-V03', cfg);

// ===== Case bổ sung từ bug GitLab (gộp từ loai-don-vi-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
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

// ======================================================================= LOẠI ĐƠN VỊ
test.describe('Loại đơn vị', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('UTY-E05'), async ({ page }) => {
    const t = await mkType(2, { description: 'qc.automation mô tả E05' });
    const d = await openEditP(page, 'UTY', t.code);
    await expect(d).toBeVisible();
    await expect(d.getByPlaceholder(PH_NAME.UTY)).toHaveValue(t.name);
    await expect(d.locator('.ant-form-item').filter({ hasText: /cấp hành chính/i }).locator('.ant-select').first()).toContainText('Cấp tỉnh');
    await expect(d.locator('textarea').first()).toHaveValue('qc.automation mô tả E05');
    const code = d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: /^\s*Mã/ }) }).locator('input').first();
    if (await code.count()) { await expect(code).toHaveValue(t.code); await expect(code).toBeDisabled(); }   // giao diện mới không còn ô Mã (mã tự sinh)
  });
  test(tc('UTY-E06'), async ({ page }) => {
    const t = await mkType(2, { description: 'qc.automation mô tả cũ' });
    const add = await openAddP(page, 'UTY');
    const addLabels = (await add.locator('.ant-form-item-label label').allInnerTexts()).map(s => s.trim());
    await btnCancel(add).click();
    await openDetailId(page, 'UTY', t.id); const url = page.url();
    await content(page).locator('button', { hasText: /^\s*cập nhật\s*$/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(600);
    expect(page.url(), 'mở popup, không chuyển trang').toBe(url);
    expect((await d.locator('.ant-form-item-label label').allInnerTexts()).map(s => s.trim()), 'cùng bố cục form Thêm mới').toEqual(addLabels);
    await expect(d.getByPlaceholder(PH_NAME.UTY)).toHaveValue(t.name);
    await d.locator('textarea').first().fill('qc.automation mô tả mới');
    await btnSave(d).click(); expect(await toast(page)).toMatch(/thành công/i);
    await page.waitForTimeout(1200);
    expect(await pageText(page), 'chi tiết cập nhật ngay').toContain('qc.automation mô tả mới');
  });
});

// ======================================================================= ĐƠN VỊ

// ======================================================================= THAM SỐ HỆ THỐNG / NHẬT KÝ / XÁC THỰC / API CHUNG
});
