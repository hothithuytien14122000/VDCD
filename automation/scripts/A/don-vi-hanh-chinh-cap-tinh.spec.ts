// A.IV.1 ĐƠN VỊ HÀNH CHÍNH CẤP TỈNH — script bám testcase PRV-* (testcases/docs/catalog.json)
import { Page, Locator } from '@playwright/test';
import {
  test, expect, tc, needWrite, PAGES, dataRows, openList, searchFor, findRow, dlg, btnCancel, btnSave, toast, rowAction,
  rowMenuItems, confirmYes, confirmNo, api, listApi, findApi, Made, code8, ensureOrg, ensureProvince, registerListSuite, DUP_CODE,
  registerAuthTest, registerMatrixTest, registerPerfTest, findByName, AUTO_CODE, checkAutoCodeUI,
} from './common';
import { registerEdgeTests, registerNotFoundTest } from './common';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { waitList } from './common';
import { cellText } from './common';
import { userBody } from './common';
import { pickByLabel } from './common';
import { FILTERS } from './common';
import { tokenOf } from './common';
import { fold } from './common';
import { API_BASE } from '../api';
import { guardSession } from '../session-guard';

const cfg = PAGES.PRV;
const made = new Made();
test.afterEach(async () => { await made.clean(); });
registerListSuite('PRV');

// Giao diện mới: form không còn ô Mã (mã tự sinh TINH-nnn); nút "Thêm tỉnh/thành", nút lưu "Lưu"
const PH_NAME = /nhập tên tỉnh/i;
async function openAdd(page: Page) {
  await openList(page, cfg);
  await page.getByRole('button', { name: /thêm (mới )?tỉnh/i }).first().click();
  const d = dlg(page); await d.waitFor({ state: 'visible' }); return d;
}
const submitAdd = (d: Locator) => btnSave(d).click();
async function openDetail(page: Page, code: string) {
  await openList(page, cfg);
  await (await findRow(page, cfg, code)).first().getByRole('button', { name: /xem chi tiết/i }).click();
  await page.waitForURL(/provinces\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
}

test.describe('Tỉnh/thành › Xem chi tiết', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-V01'), async ({ page }) => {
    const p = await ensureProvince(made); const o = await ensureOrg(made, { provinceId: p.id });
    await openDetail(page, p.code);
    const txt = (await page.locator('.ant-layout-content').first().innerText()).replace(/\s+/g, ' ');
    for (const s of [p.code, p.name, 'Số xã/phường', 'Số đơn vị', 'Đơn vị thuộc tỉnh/thành', o.name]) expect(txt, `thiếu "${s}"`).toContain(s);
    // Giao diện mới: màn chi tiết chỉ còn nút Cập nhật / Xoá (bỏ "Thêm mới đơn vị vào tỉnh", "Mở module đơn vị")
    await expect(page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first()).toBeVisible();
  });
  test(tc('PRV-V02'), async ({ page }) => {
    const p = await ensureProvince(made); await ensureOrg(made, { provinceId: p.id }); await ensureOrg(made, { provinceId: p.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, p.code);
    expect((await row.first().locator('td').nth(4).innerText()).trim()).toBe('2');   // cột Số đơn vị (sau cột Số xã/phường)
    await row.first().getByRole('button', { name: /xem chi tiết/i }).click();
    await page.waitForURL(/provinces\/[0-9a-f-]{20,}/i); await page.waitForTimeout(1200);
    expect(await dataRows(page).count()).toBe(2);
  });
  test(tc('PRV-V03'), async ({ page }) => {
    const p = await ensureProvince(made);
    await openDetail(page, p.code);
    await page.locator('.ant-layout-content button', { hasText: /^\s*cập nhật\s*$/i }).first().click();
    const d = dlg(page); await d.waitFor({ state: 'visible' });
    await expect(d.getByPlaceholder(PH_NAME)).toHaveValue(p.name);
  });
});

test.describe('Tỉnh/thành › Thêm mới', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-C01'), async ({ page }) => {
    const tag = made.add('provinces', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${tag}`);
    await submitAdd(d);
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findByName('provinces', tag);
    expect(rec?.name).toBe(`qc.automation Tỉnh ${tag}`);
    expect(rec?.code, 'mã tự sinh').toMatch(AUTO_CODE.provinces);
    const row = await findRow(page, cfg, rec.code);
    await expect(row.first()).toBeVisible();
    expect((await row.first().locator('td').nth(4).innerText()).trim()).toBe('0');
  });
  test(tc('PRV-C02'), async ({ page }) => {
    const d = await openAdd(page);
    await submitAdd(d); await page.waitForTimeout(800);
    // form mới chỉ còn 1 trường bắt buộc: Tên tỉnh/thành (Mã tự sinh)
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThanOrEqual(1);
  });
  test(tc('PRV-C03'), async ({ page }) => {
    // Mã tự sinh: không còn nhập mã nên không thể trùng → form không có ô Mã, mã sinh đúng mẫu & không trùng
    const a = await ensureProvince(made);
    await checkAutoCodeUI(page, cfg, made, { openAdd, submit: submitAdd, existing: a,
      fillValid: async (_pg, d, tag) => { await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${tag}`); } });
  });
  test(tc('PRV-C04'), async ({ page }) => {
    // Mã tự sinh: không còn ô nhập Mã → mã dài không nhập được qua form; [API] mã 51 ký tự client gửi bị bỏ qua, mã lưu là mã tự sinh
    const d = await openAdd(page);
    expect(await d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: /^\s*Mã\b/ }) }).count(), 'form không còn ô Mã').toBe(0);
    const sent = code8() + 'A'.repeat(43); expect(sent.length).toBe(51);
    const r = await api('POST', 'provinces', { code: sent, name: `qc.automation Tỉnh mã dài ${sent.slice(0, 8)}` });
    if (r.data?.id) made.addId('provinces', r.data.id);
    expect(r.status, `HTTP ${r.status}: ${r.message}`).toBe(200);
    expect(r.data?.code, 'mã client gửi bị bỏ qua').not.toBe(sent);
    expect(r.data?.code).toMatch(AUTO_CODE.provinces);
  });
  test(tc('PRV-C05'), async ({ page }) => {
    const tag = made.add('provinces', code8(), 'nameHas');
    const d = await openAdd(page);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation hủy ${tag}`);
    await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await findByName('provinces', tag)).toBeNull();
  });
  test(tc('PRV-C06'), async () => {
    const a = await ensureProvince(made);
    const code = made.add('provinces', code8());
    const r = await api('POST', 'provinces', { code, name: a.name });
    if (r.data?.id) made.addId('provinces', r.data.id);
    expect(r.status, `tạo tỉnh trùng tên (HTTP ${r.status})`).toBe(400);
  });
});

test.describe('Tỉnh/thành › Chỉnh sửa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  async function openEdit(page: Page, code: string) {
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500); return d;
  }
  test(tc('PRV-E01'), async ({ page }) => {
    const p = await ensureProvince(made); const nn = `qc.automation Tỉnh đã sửa ${p.code}`;
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(nn); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await findApi('provinces', p.code))?.name).toBe(nn);
    await expect((await findRow(page, cfg, p.code)).first()).toContainText(nn);
  });
  test(tc('PRV-E02'), async ({ page }) => {
    const p = await ensureProvince(made);
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh sửa mã ${p.code}`); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    const rec = await findApi('provinces', p.code);
    expect(rec?.code).toBe(p.code); expect(rec?.id).toBe(p.id);
  });
  test(tc('PRV-E03'), async ({ page }) => {
    const p = await ensureProvince(made);
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill(''); await btnSave(d).click(); await page.waitForTimeout(700);
    expect(await d.locator('.ant-form-item-explain-error').count()).toBeGreaterThan(0);
    expect((await findApi('provinces', p.code))?.name).toBe(p.name);
  });
  test(tc('PRV-E04'), async ({ page }) => {
    const p = await ensureProvince(made);
    const d = await openEdit(page, p.code);
    await d.getByPlaceholder(PH_NAME).fill('qc.automation KHÔNG LƯU'); await btnCancel(d).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await findApi('provinces', p.code))?.name).toBe(p.name);
  });
});

test.describe('Tỉnh/thành › Xóa', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-D01'), async ({ page }) => {
    const p = await ensureProvince(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /xo[áạ]/i); await confirmYes(page);
    expect(await findApi('provinces', p.code)).toBeNull();
    await searchFor(page, cfg, p.code);
    expect(await dataRows(page).count()).toBe(0);
  });
  test(tc('PRV-D02'), async ({ page }) => {
    const p = await ensureProvince(made); await ensureOrg(made, { provinceId: p.id });
    await openList(page, cfg);
    const row = await findRow(page, cfg, p.code);
    const items = await rowMenuItems(page, row);
    if (items.some(i => /xo[áạ]/i.test(i))) { await rowAction(page, row, /xo[áạ]/i); await confirmYes(page); expect(await toast(page)).toMatch(/không thể xóa/i); }
    expect(await findApi('provinces', p.code), 'tỉnh đang có đơn vị không được xóa').toBeTruthy();
    expect((await api('DELETE', `provinces/${p.id}`)).message).toMatch(/không thể xóa/i);
  });
  test(tc('PRV-D03'), async ({ page }) => {
    const p = await ensureProvince(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, p.code), /xo[áạ]/i); await confirmNo(page);
    expect(await findApi('provinces', p.code)).toBeTruthy();
  });
});

test.describe('Tỉnh/thành › Bảo mật / Hiệu năng', () => {
  registerAuthTest('PRV-S01', cfg);
  registerMatrixTest('PRV-S02', cfg);
  registerPerfTest('PRV-P01', cfg);
});

registerEdgeTests({
  P: 'PRV', cfg, made, openAdd, submit: submitAdd, autoCode: AUTO_CODE.provinces,
  fillBlank: async d => { await d.getByPlaceholder(PH_NAME).fill('   '); },
  fillValid: async (_p, d, tag) => { await d.getByPlaceholder(PH_NAME).fill(`qc.automation Tỉnh ${tag}`); },
  mk: async (code, name) => { const r = await api('POST', 'provinces', { code, name }); return { status: r.status, message: r.message }; },
  makeNamed: async name => { const r = await api('POST', 'provinces', { name }); if (r.status !== 200) throw new Error(r.message); made.addId('provinces', r.data.id); return r.data.code; },
  apiEmpty: async () => { const r = await api('POST', 'provinces', { name: '' }); if (r.data?.id) made.addId('provinces', r.data.id); return { status: r.status, message: r.message }; },
});

registerNotFoundTest('PRV-V04', cfg);
test.describe('Tỉnh/thành › Bổ sung', () => {
  test.describe.configure({ timeout: 60_000 });
  needWrite();
  test(tc('PRV-E05'), async ({ page }) => {
    const a = await ensureProvince(made), b = await ensureProvince(made);
    await openList(page, cfg);
    await rowAction(page, await findRow(page, cfg, b.code), /cập nhật/i);
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
    await d.getByPlaceholder(PH_NAME).fill(a.name); await btnSave(d).click(); await page.waitForTimeout(1500);
    expect((await findApi('provinces', b.code))?.name, 'sửa tên trùng tỉnh khác phải bị từ chối').toBe(b.name);
  });
});

// ===== Case bổ sung từ bug GitLab (gộp từ don-vi-hanh-chinh-cap-tinh-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
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

test.describe('Tỉnh/thành — danh sách & giao diện chung', () => {
  test.describe.configure({ timeout: 120_000 });

  test(tc('PRV-L13'), async ({ page }) => {
    const p = await mkProvince();
    await openList(page, PAGES.PRV);
    expect(await cellText(page, 0, 1), `tỉnh vừa tạo ${p.code} phải ở dòng 1 trang 1`).toBe(p.code);
    expect((await cellText(page, 0, 0)).trim()).toBe('1');
  });

  test(tc('PRV-L15'), async ({ page }) => {
    const bad: string[] = [];
    for (const P of P4) {
      await openList(page, PAGES[P]);
      for (const c of await tableInfo(page)) {
        if (!c.head || /^(stt|thao tác|trạng thái)$/i.test(c.head)) continue;   // STT: cần BA xác nhận; Thao tác/Trạng thái không thuộc quy ước chữ/số
        const want = /^số /i.test(c.head) ? 'right' : 'left';
        if (side(c.tdAlign) !== want) bad.push(`${P} cột "${c.head}": dữ liệu căn ${side(c.tdAlign)} (kỳ vọng ${want})`);
        if (side(c.thAlign) !== want) bad.push(`${P} cột "${c.head}": tiêu đề căn ${side(c.thAlign)} (kỳ vọng ${want})`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test(tc('PRV-L16'), async ({ page }) => {
    const bad: string[] = [];
    for (const P of P4) {
      await openList(page, PAGES[P]);
      const m = await page.evaluate(() => {
        const wrap = document.querySelector('.ant-layout-content .ant-table-wrapper') as HTMLElement;
        const card = (wrap.closest('.rounded-xl') as HTMLElement) ?? wrap.parentElement!;
        const cs = getComputedStyle(card);
        const inner = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const table = wrap.querySelector('table') as HTMLElement;
        return { inner: Math.round(inner), wrap: Math.round(wrap.getBoundingClientRect().width), table: Math.round(table.getBoundingClientRect().width) };
      });
      if (m.table < m.inner - 2) bad.push(`${P}: bảng rộng ${m.table}px < vùng nội dung ${m.inner}px`);
      for (const c of await tableInfo(page)) if (c.head && c.thSize !== '14px') bad.push(`${P} tiêu đề "${c.head}": font-size ${c.thSize}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test(tc('PRV-L18'), async ({ page }) => {
    // Cỡ chữ cụ thể theo design: cần BA/Design xác nhận → chỉ kiểm phần chắc chắn: dòng mô tả có hiển thị và đồng nhất (cỡ chữ, màu) giữa các trang
    const seen: Record<string, string> = {};
    for (const P of P4) {
      await openList(page, PAGES[P]);
      const sub = content(page).locator('h1 + p').first();
      await expect(sub, `${P}: phải có dòng mô tả dưới tiêu đề`).toBeVisible();
      const s = await css(sub, ['font-size', 'color', 'line-height']);
      seen[P] = `${s['font-size']} ${s['color']} ${s['line-height']}`;
    }
    console.log('  mô tả dưới tiêu đề:', JSON.stringify(seen));
    expect(new Set(Object.values(seen)).size, `dòng mô tả không đồng nhất: ${JSON.stringify(seen)}`).toBe(1);
  });

  test(tc('PRV-L19'), async ({ page }) => {
    const bad: string[] = [];
    for (const P of P4) {
      await openList(page, PAGES[P]);
      const sel = page.locator('.ant-pagination-options .ant-select').first();
      if (await sel.evaluate(e => e.classList.contains('ant-select-show-search'))) bad.push(`${P}: ô chọn số bản ghi/trang có tìm kiếm`);
      await sel.click();
      const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last(); await dd.waitFor({ state: 'visible' });
      const n0 = await dd.locator('.ant-select-item-option').count();
      await page.keyboard.type('50'); await page.waitForTimeout(400);
      if (await sel.locator('input').inputValue().catch(() => '') !== '') bad.push(`${P}: gõ được chữ vào ô chọn số bản ghi/trang`);
      if ((await dd.locator('.ant-select-item-option').count()) !== n0) bad.push(`${P}: danh sách lựa chọn bị lọc khi gõ`);
      if (P === 'PRV') {
        await dd.locator('.ant-select-item-option', { hasText: /^\s*10\b/ }).first().click(); await waitList(page);
        if ((await dataRows(page).count()) !== 10) bad.push(`${P}: chọn 10/trang bằng click không áp dụng`);
      } else await page.keyboard.press('Escape');
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test(tc('PRV-L20'), async ({ page }) => {
    await openList(page, PAGES.PRV);
    const sider = page.locator('aside.ant-layout-sider').first();
    const w0 = (await sider.boundingBox())!.width, c0 = (await content(page).boundingBox())!.width;
    await page.locator('header button').first().click(); await page.waitForTimeout(1000);
    const w1 = (await sider.boundingBox())!.width, c1 = (await content(page).boundingBox())!.width;
    expect(w1, `menu phải thu gọn (rộng ${w0} → ${w1})`).toBeLessThan(w0 / 2);
    expect(c1, 'vùng nội dung phải giãn ra').toBeGreaterThan(c0 + 50);
    expect(await sider.locator('.ant-menu svg, .ant-menu .anticon').filter({ visible: true }).count(), 'menu thu gọn vẫn còn icon').toBeGreaterThan(0);
    // khi thu gọn: bấm icon nhóm → chọn mục → chuyển trang
    const sub = sider.locator('.ant-menu-submenu-title, .ant-menu-item').filter({ visible: true });
    let moved = false;
    for (let i = 0; i < (await sub.count()) && !moved; i++) {
      await sub.nth(i).hover(); await sub.nth(i).click().catch(() => {}); await page.waitForTimeout(700);
      const it = page.locator('.ant-menu-submenu-popup:not(.ant-menu-submenu-hidden) .ant-menu-item', { hasText: /^\s*Loại đơn vị\s*$/ }).filter({ visible: true }).first();
      if (await it.count()) { await it.click(); await page.waitForTimeout(1500); moved = /unit-types/.test(page.url()); }
    }
    expect(moved, 'khi menu thu gọn phải bấm icon chuyển trang được (Loại đơn vị)').toBeTruthy();
    await page.locator('header button').first().click(); await page.waitForTimeout(1000);
    expect((await sider.boundingBox())!.width, 'mở rộng lại menu').toBeGreaterThan(w0 - 2);
    await expect(sider.getByText('Đơn vị hành chính cấp tỉnh', { exact: true }).first(), 'mở rộng hiện đủ tên mục').toBeVisible();
  });

  test(tc('PRV-L21'), async ({ page }) => {
    const bad: string[] = [];
    for (const P of P4) {
      await openList(page, PAGES[P]);
      await dataRows(page).first().getByRole('button', { name: /xem chi tiết/i }).click();
      await page.waitForURL(new RegExp(`${ROUTE[P]}/[0-9a-f-]{20,}`)); await page.waitForTimeout(1200);
      const n = await crumbs(page).count();
      const last = crumbs(page).nth(n - 1);
      if (await last.locator('.cursor-pointer, a').count()) bad.push(`${P}: mục cuối breadcrumb là link`);
      const url = page.url(); await last.click(); await page.waitForTimeout(800);
      if (page.url() !== url) bad.push(`${P}: bấm mục cuối breadcrumb lại chuyển trang`);
      await crumbs(page).nth(n - 2).click(); await page.waitForTimeout(1500);
      if (!new RegExp(`/vi/${ROUTE[P]}/?(\\?.*)?$`).test(page.url())) bad.push(`${P}: bấm breadcrumb cấp trên không về danh sách (URL ${page.url()})`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test(tc('PRV-L22'), async ({ page }) => {
    const sig: Record<string, string> = {};
    for (const r of ['provinces', 'unit-types', 'organizations', 'self-assessment-campaigns']) {
      await page.goto(`${B}/vi/${r}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
      const b = page.getByRole('button', { name: /xuất excel/i }).first();
      await expect(b, `${r}: phải có nút Xuất Excel`).toBeVisible();
      const s = await css(b, ['background-color', 'color', 'border-top-color', 'border-top-width', 'height', 'border-top-left-radius', 'font-size', 'font-weight']);
      sig[r] = JSON.stringify({ ...s, icon: await b.locator('svg, .anticon').count() > 0 });
    }
    expect(new Set(Object.values(sig)).size, `nút Xuất Excel khác kiểu giữa các màn: ${JSON.stringify(sig, null, 1)}`).toBe(1);
  });
});

test.describe('Tỉnh/thành — chi tiết', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('PRV-V05'), async ({ page }) => {
    const hn = (await findByTag('provinces', 'Hà Nội'))[0];
    expect(hn, 'cần có tỉnh "Hà Nội" trong dữ liệu').toBeTruthy();
    await openDetailId(page, 'PRV', hn.id);
    const last = (await crumbs(page).last().innerText()).trim();
    expect(last).not.toMatch(/^chi tiết$/i);
    expect(last).toBe(hn.name);
  });
  test(tc('PRV-V06'), async ({ page }) => {
    const p = await mkProvince();
    const r = await A('PUT', `provinces/${p.id}`, { ...(await A('GET', `provinces/${p.id}`)).data, name: `${p.name} sửa` });
    expect(r.status, r.message).toBe(200);
    const now = Date.now();
    await openDetailId(page, 'PRV', p.id);
    const m = (await pageText(page)).match(/Cập nhật lần cuối\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s+(.+?)\s+Đơn vị thuộc/);
    expect(m, 'ô Cập nhật lần cuối phải có ngày giờ (dd/mm/yyyy HH:mm) và tên người cập nhật').toBeTruthy();
    const [, dd, mm, yy, hh, mi, who] = m!;
    const shown = Date.UTC(+yy, +mm - 1, +dd, +hh - 7, +mi);   // giờ hiển thị theo GMT+7
    expect(Math.abs(shown - now), `thời gian hiển thị ${dd}/${mm}/${yy} ${hh}:${mi} phải là lúc vừa sửa`).toBeLessThan(5 * 60_000);
    expect(who.trim(), 'tên người cập nhật').toBe(ADMIN_NAME());
  });
});

test.describe('Tỉnh/thành — Thêm / Sửa / Xoá & popup chung', () => {
  test.describe.configure({ timeout: 150_000 });
  test(tc('PRV-C07'), async ({ page }) => {
    const tag = made.tag('provinces', code8());
    const d = await openAddP(page, 'PRV');
    const inp = d.getByPlaceholder(PH_NAME.PRV);
    expect(await d.locator('.ant-input-show-count-suffix, .ant-input-data-count').count(), 'không có bộ đếm ký tự').toBe(0);
    expect(await d.innerText(), 'không có bộ đếm "0 / 255"').not.toMatch(/\d+\s*\/\s*255/);
    const long = `qc.automation Tỉnh ${tag} ` + 'a'.repeat(300);
    await inp.fill(long);
    const len = (await inp.inputValue()).length;
    if (len > 255) { await btnSave(d).click(); await page.waitForTimeout(1500); }
    expect(len <= 255 || (await d.locator('.ant-form-item-explain-error').count()) > 0, `nhập ${len} ký tự mà không bị chặn`).toBeTruthy();
    expect((await findByTag('provinces', tag)).length, 'không được lưu tên > 255 ký tự').toBe(0);
  });
  test(tc('PRV-C09'), async ({ page }) => {
    const d = await openAddP(page, 'PRV');
    const labels = (await d.locator('.ant-form-item-label label').allInnerTexts()).map(s => s.trim());
    expect(labels).toContain('Tên tỉnh/thành');
    expect(labels.join('|')).not.toMatch(/tỉnh\/thành phố/i);
  });
  test(tc('PRV-C11'), async ({ page }) => {
    // Câu chữ cụ thể: cần BA → kiểm phần chắc chắn: mọi trang cùng quy ước (nút mở/tiêu đề Thêm cùng tiền tố "Thêm", tiêu đề sửa "Cập nhật <đối tượng>", nút lưu "Lưu")
    const p = await mkProvince(); const c = await mkCommune(p.id); const t = await mkType(2); const o = await mkOrg({ unitTypeId: t.id });
    const codes: Record<string, string> = { PRV: p.code, COM: c.code, UTY: t.code, ORG: o.code };
    const rows: string[] = []; const bad: string[] = [];
    for (const P of P4) {
      const d = await openAddP(page, P);
      const btn = (await page.locator('.ant-layout-content button', { hasText: ADD_BTN[P] }).first().innerText()).trim();
      const at = (await dlgTitle(d).innerText()).trim(); const as = (await btnSave(d).innerText()).trim();
      await btnCancel(d).click(); await page.waitForTimeout(400);
      const e = await openEditP(page, P, codes[P]);
      const et = (await dlgTitle(e).innerText()).trim(); const es = (await btnSave(e).innerText()).trim();
      await btnCancel(e).click(); await page.waitForTimeout(400);
      rows.push(`${P}: nút "${btn}" · tiêu đề thêm "${at}" · lưu "${as}" · tiêu đề sửa "${et}" · lưu "${es}"`);
      if (!/^Thêm /.test(btn) || !/^Thêm /.test(at)) bad.push(`${P}: nút/tiêu đề thêm không theo quy ước "Thêm …" (${btn} / ${at})`);
      if (!/^Cập nhật /.test(et)) bad.push(`${P}: tiêu đề sửa "${et}"`);
      if (as !== 'Lưu' || es !== 'Lưu') bad.push(`${P}: nút lưu "${as}" / "${es}"`);
      if (at.replace(/^Thêm (mới )?/, '').toLowerCase() !== et.replace(/^Cập nhật /, '').toLowerCase()) bad.push(`${P}: đối tượng ở tiêu đề thêm/sửa khác nhau (${at} / ${et})`);
    }
    console.log('  ' + rows.join('\n  '));
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('PRV-C13'), async ({ page }) => {
    const bad: string[] = [];
    // PRV: thêm thành công rồi mở lại
    const tag = made.tag('provinces', code8());
    let d = await openAddP(page, 'PRV');
    await d.getByPlaceholder(PH_NAME.PRV).fill(`qc.automation Tỉnh ${tag}`); await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i); await page.waitForTimeout(800);
    await page.locator('.ant-layout-content button', { hasText: ADD_BTN.PRV }).first().click();
    d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
    if (await d.getByPlaceholder(PH_NAME.PRV).inputValue()) bad.push('PRV: sau khi thêm, mở lại form còn dữ liệu cũ');
    await btnCancel(d).click(); await page.waitForTimeout(400);
    // mọi trang: nhập dở + lỗi validate → Hủy → mở lại phải trống, không còn lỗi
    for (const P of P4) {
      d = await openAddP(page, P);
      await btnSave(d).click(); await page.waitForTimeout(600);   // tạo thông báo lỗi
      await d.getByPlaceholder(PH_NAME[P]).fill('qc.automation dở dang');
      await btnCancel(d).click(); await page.waitForTimeout(500);
      await page.locator('.ant-layout-content button', { hasText: ADD_BTN[P] }).first().click();
      d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(500);
      const v = await d.getByPlaceholder(PH_NAME[P]).inputValue();
      const err = await d.locator('.ant-form-item-explain-error').filter({ visible: true }).count();
      if (v) bad.push(`${P}: mở lại sau Hủy còn giá trị "${v}"`);
      if (err) bad.push(`${P}: mở lại sau Hủy còn ${err} thông báo lỗi cũ`);
      await btnCancel(d).click(); await page.waitForTimeout(400);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('PRV-C14'), async ({ page }) => {
    const p = await mkProvince(); const c = await mkCommune(p.id); const t = await mkType(2); const o = await mkOrg({ unitTypeId: t.id });
    const p2 = await mkProvince();
    const codes: Record<string, string> = { PRV: p.code, COM: c.code, UTY: t.code, ORG: o.code };
    const vw = page.viewportSize()!.width; const bad: string[] = [];
    const geo = async (box: Locator, what: string) => {
      const r = (await box.boundingBox())!;
      if (Math.abs(r.x + r.width / 2 - vw / 2) > 2) bad.push(`${what}: không căn giữa (x=${r.x}, w=${r.width})`);
      const btns = box.locator('button').filter({ hasText: /^\s*(Huỷ|Hủy|Lưu|Xoá|Xóa|Khoá|Khóa|Có|Không)\s*$/ });   // chỉ nút ở chân popup
      const names = (await btns.allInnerTexts()).map(s => s.trim());
      const hs = await btns.evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().height)));
      const xs = await btns.evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().x)));
      if (names[0] !== 'Huỷ' || xs[0] > xs[1]) bad.push(`${what}: thứ tự nút ${names.join(', ')} (Huỷ phải đứng trước nút chính)`);
      if (new Set(hs).size !== 1) bad.push(`${what}: chiều cao nút khác nhau ${hs.join('/')}`);
      if (!(await box.locator('h3').count())) bad.push(`${what}: thiếu tiêu đề`);
      return { w: Math.round(r.width), h: hs[0] };
    };
    const hAll: number[] = [];
    for (const P of P4) {
      let d = await openAddP(page, P); const a = await geo(d, `${P} Thêm mới`); await btnCancel(d).click(); await page.waitForTimeout(400);
      d = await openEditP(page, P, codes[P]); const e = await geo(d, `${P} Cập nhật`); await btnCancel(d).click(); await page.waitForTimeout(400);
      if (a.w !== e.w) bad.push(`${P}: popup Thêm (${a.w}px) và Cập nhật (${e.w}px) khác chiều rộng`);
      hAll.push(a.h, e.h);
    }
    await openList(page, PAGES.PRV);
    await rowAction(page, await findRow(page, PAGES.PRV, p2.code), /xo[áạ]/i); await page.waitForTimeout(600);
    const cf = await geo(confirmBox(page), 'PRV xác nhận Xoá'); hAll.push(cf.h);
    await confirmBox(page).getByRole('button', { name: /^\s*Huỷ\s*$/ }).click();
    if (new Set(hAll).size !== 1) bad.push(`chiều cao nút giữa các popup khác nhau: ${hAll.join('/')}`);
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('PRV-E06'), async ({ page }) => {
    const p = await mkProvince();
    const d = await openEditP(page, 'PRV', p.code);
    const r = (await d.boundingBox())!; const vw = page.viewportSize()!;
    expect(Math.abs(r.x + r.width / 2 - vw.width / 2), 'popup căn giữa theo chiều ngang').toBeLessThanOrEqual(2);
    expect(r.y, 'popup không dính mép trên').toBeGreaterThan(20);
    expect(await d.locator('.ant-input-show-count-suffix, .ant-input-data-count').count(), 'không có bộ đếm ký tự').toBe(0);
    expect(await d.innerText()).not.toMatch(/\d+\s*\/\s*255/);
    await btnCancel(d).click();
    const a = await openAddP(page, 'PRV');
    expect((await a.boundingBox())!.width, 'cùng chiều rộng popup Thêm mới').toBe(r.width);
  });
  test(tc('PRV-E07'), async ({ page }) => {
    const p = await mkProvince(); const nn = `${p.name} đã sửa`;
    const d = await openEditP(page, 'PRV', p.code);
    await d.getByPlaceholder(PH_NAME.PRV).fill(nn);
    await expect(btnSave(d), 'nút Lưu phải bấm được').toBeEnabled();
    await btnSave(d).click();
    expect(await toast(page)).toMatch(/thành công/i);
    expect((await A('GET', `provinces/${p.id}`)).data?.name).toBe(nn);
    await expect((await findRow(page, PAGES.PRV, p.code)).first()).toContainText(nn);
  });
  test(tc('PRV-L12'), async ({ page }) => {
    await openList(page, PAGES.PRV);
    const screen = (await rowTexts4(page)).map(t => ({ code: t[1], xa: t[3], dv: t[4] }));
    const rows = xlsxRows(await exportXlsx(page, 'prv'));
    const hi = rows.findIndex(r => r.some(c => /^mã/i.test(c)) && r.some(c => /^tên/i.test(c)));
    expect(hi, 'file phải có dòng tiêu đề').toBeGreaterThanOrEqual(0);
    const head = rows[hi]; const col = (re: RegExp) => head.findIndex(h => re.test(h));
    const iCode = col(/^mã/i), iXa = col(/^số xã/i), iDv = col(/^số đơn vị/i);
    expect({ ma: iCode >= 0, ten: col(/^tên/i) >= 0, soXa: iXa >= 0, soDv: iDv >= 0 }, `cột trong file: ${head.join(' | ')}`).toEqual({ ma: true, ten: true, soXa: true, soDv: true });
    const bad: string[] = [];
    for (const s of screen) {
      const f = rows.slice(hi + 1).find(r => r[iCode] === s.code);
      if (!f) { bad.push(`${s.code}: không có trong file`); continue; }
      if (String(Number(f[iXa])) !== s.xa || String(Number(f[iDv])) !== s.dv) bad.push(`${s.code}: màn hình ${s.xa} xã/${s.dv} ĐV, file ${f[iXa]}/${f[iDv]}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
async function rowTexts4(page: Page) {
  return dataRows(page).evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll(':scope > td')].map(td => ((td as HTMLElement).innerText || '').split('\n')[0].trim())));
}

// ======================================================================= ĐƠN VỊ HÀNH CHÍNH CẤP XÃ

// ======================================================================= LOẠI ĐƠN VỊ

// ======================================================================= ĐƠN VỊ

// ======================================================================= THAM SỐ HỆ THỐNG / NHẬT KÝ / XÁC THỰC / API CHUNG
});
