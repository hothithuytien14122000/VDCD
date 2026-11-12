// Testcase BỔ SUNG từ bug GitLab — Đơn vị hành chính cấp tỉnh/xã, Loại đơn vị, Đơn vị, Tham số hệ thống, Nhật ký, API/bảo mật chung phân hệ A.
// Nguồn: testcases/docs/catalog-BUG-A2.mjs (+ PRV-L12, COM-L13, UTY-L13, UTY-C06, UTY-C07 trong catalog-BUG.mjs).
// Chạy bằng session Quản trị hệ thống (auth/admin.json, --project=admin). Session superadmin không còn dùng được → mọi lệnh API
// trong file này gọi bằng token 'admin' (KHÔNG dùng api()/Made/listApi mặc định superadmin của common.ts).
// AN TOÀN: không đăng nhập/đăng xuất, không đổi mật khẩu, không lưu Tham số hệ thống (chặn mọi request ghi tới system/*),
// không sửa/xóa dữ liệu không phải QCA; dữ liệu thử có tiền tố qc.automation/QCA và được dọn qua API sau mỗi test.
import { Page, Locator } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  test, expect, tc, PAGES, dataRows, openList, searchFor, findRow, dlg, btnCancel, btnSave, toast, rowAction, rowMenuItems,
  waitList, cellText, api, code8, userBody, pickByLabel, FILTERS, tokenOf, fold,
} from './common';
import { API_BASE } from '../api';
import { guardSession } from '../session-guard';

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

// ======================================================================= ĐƠN VỊ
test.describe('Bug GitLab A2 › Đơn vị — danh sách', () => {
  test.describe.configure({ timeout: 150_000 });
  test(tc('ORG-L15'), async ({ page }) => {
    const o = await mkOrg();
    await openList(page, PAGES.ORG);
    expect(await cellText(page, 0, 1), `đơn vị vừa tạo ${o.code} phải ở dòng 1 trang 1`).toBe(o.code);
  });

  /** Từ khóa + bộ lọc Loại đơn vị cho kết quả > 1 trang (lấy loại đơn vị có nhiều đơn vị nhất). */
  async function setupFiltered(page: Page) {
    const all: any[] = [];
    for (let p = 1; p <= 5; p++) { const r = await A('GET', `organizations?page=${p}&size=100`); all.push(...rowsOf(r.data)); if (p >= (r.data?.totalPages ?? 1)) break; }
    const cnt: Record<string, number> = {}; for (const o of all) cnt[o.unitTypeName] = (cnt[o.unitTypeName] ?? 0) + 1;
    const typeName = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    const of = all.filter(o => o.unitTypeName === typeName);
    const kw = ['DV', 'n', 'a'].find(k => of.filter(o => fold(`${o.code} ${o.name}`).includes(fold(k))).length > 20) ?? 'DV';
    await openList(page, PAGES.ORG);
    await page.locator(FILTERS).first().click(); await page.keyboard.type(typeName.slice(-8)); await page.waitForTimeout(1200);
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option', { hasText: typeName }).first().click();
    await waitList(page);
    await searchFor(page, PAGES.ORG, kw);
    test.skip((await page.locator('.ant-pagination-item-2').count()) === 0, `Từ khóa "${kw}" + loại "${typeName}" chỉ có 1 trang`);
    await page.locator('.ant-pagination-item-2').first().click(); await waitList(page);
    return { kw, typeName, state: await listState(page) };
  }
  async function listState(page: Page) {
    return {
      kw: await page.getByPlaceholder(PAGES.ORG.search).inputValue().catch(() => ''),
      type: (await page.locator(FILTERS).first().innerText().catch(() => '')).trim(),
      page: (await page.locator('.ant-pagination-item-active').first().innerText().catch(() => '')).trim(),
      first: await cellText(page, 0, 1).catch(() => ''),
    };
  }
  test(tc('ORG-L16'), async ({ page }) => {
    const s = await setupFiltered(page);
    expect(s.state.page).toBe('2');
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
    expect(await listState(page), `trước F5: ${JSON.stringify(s.state)}`).toEqual(s.state);
  });
  test(tc('ORG-L17'), async ({ page }) => {
    const s = await setupFiltered(page);
    const bad: string[] = [];
    for (const how of ['nút Quay lại', 'nút Back trình duyệt']) {
      await dataRows(page).nth(1).getByRole('button', { name: /xem chi tiết/i }).click();
      await page.waitForURL(/organizations\/[0-9a-f-]{20,}/); await page.waitForTimeout(1200);
      if (how === 'nút Quay lại') await page.getByRole('button', { name: 'Quay lại' }).first().click(); else await page.goBack();
      await page.waitForTimeout(2000);
      const now = await listState(page);
      if (JSON.stringify(now) !== JSON.stringify(s.state)) bad.push(`${how}: trước ${JSON.stringify(s.state)} → sau ${JSON.stringify(now)}`);
      if (now.page !== '2') { await page.goto(`${B}/vi/organizations`); break; }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

test.describe('Bug GitLab A2 › Đơn vị — chi tiết, thêm/sửa, khóa, người dùng', () => {
  test.describe.configure({ timeout: 120_000 });
  test(tc('ORG-V06'), async ({ page }) => {
    const o = await mkOrg(); await mkUser(o.id);
    await openDetailId(page, 'ORG', o.id);
    const heads = (await page.locator('.ant-layout-content .ant-table-thead th:not(.ant-table-cell-scrollbar)').allInnerTexts()).map(s => s.trim());
    expect(heads[heads.length - 1], `tiêu đề cột: ${heads.join(' | ')}`).toBe('Thao tác');
  });
  async function fillOrg(page: Page, d: Locator, tag: string, typeName: string) {
    await d.getByPlaceholder(PH_NAME.ORG).fill(`qc.automation ĐV ${tag}`);
    await pickByLabel(page, d, /^\s*loại đơn vị/i, typeName);
  }
  const phoneInput = (d: Locator) => d.getByPlaceholder(/0237 3852 412/);
  test(tc('ORG-C11'), async ({ page }) => {
    const p = await mkProvince(), x = await mkCommune(p.id); const p2 = await mkProvince(), x2 = await mkCommune(p2.id);
    const t3 = await stdType(3); const tag = made.tag('organizations', code8());
    const d = await openAddP(page, 'ORG');
    await fillOrg(page, d, tag, t3.name);
    await pickByLabel(page, d, /^\s*tỉnh\/thành/i, p.name);
    const sel = d.locator('.ant-form-item').filter({ hasText: /đơn vị hành chính cấp xã/i }).locator('.ant-select').first();
    await expect(sel, 'trường Xã/Phường hiển thị sau khi chọn tỉnh').toBeVisible();
    await sel.click(); await page.waitForTimeout(1200);
    const opts = (await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option').allInnerTexts()).map(s => s.trim());
    expect(opts, 'phải có xã thuộc tỉnh đã chọn').toContain(x.name);
    expect(opts, 'không được có xã thuộc tỉnh khác').not.toContain(x2.name);
    const ofP = new Set(rowsOf((await A('GET', `communes?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ provinceId: p.id }))}`)).data).filter(c => c.provinceId === p.id).map(c => c.name));
    ofP.add(x.name);
    expect(opts.filter(o => !ofP.has(o)), 'mọi lựa chọn phải là xã thuộc tỉnh đã chọn').toEqual([]);
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option', { hasText: x.name }).first().click();
    await btnSave(d).click(); expect(await toast(page)).toMatch(/thành công/i);
    const rec = (await findByTag('organizations', tag))[0];
    expect(rec?.communeId, 'lưu đúng xã').toBe(x.id);
    await openDetailId(page, 'ORG', rec.id);
    expect(await pageText(page)).toMatch(new RegExp(`Xã/phường\\s+${x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });
  test(tc('ORG-C12'), async ({ page }) => {
    const t = await stdType(2); const tag = made.tag('organizations', code8());
    const d = await openAddP(page, 'ORG');
    await fillOrg(page, d, tag, t.name);
    await phoneInput(d).fill('abc123');
    await btnSave(d).click(); await page.waitForTimeout(1500);
    const err = d.locator('.ant-form-item').filter({ hasText: /số điện thoại/i }).locator('.ant-form-item-explain-error');
    expect(await err.count(), 'phải báo lỗi định dạng số điện thoại dưới ô').toBeGreaterThan(0);
    expect((await findByTag('organizations', tag)).length, 'không được tạo bản ghi').toBe(0);
  });
  test(tc('ORG-C13'), async ({ page }) => {
    const t = await stdType(2); const tag = made.tag('organizations', code8());
    const d = await openAddP(page, 'ORG');
    await fillOrg(page, d, tag, t.name);
    await phoneInput(d).fill('0912345678');
    await btnSave(d).click(); expect(await toast(page)).toMatch(/thành công/i);
    const rec = (await findByTag('organizations', tag))[0]; expect(rec).toBeTruthy();
    await openDetailId(page, 'ORG', rec.id);
    expect(await pageText(page), 'chi tiết hiển thị SĐT').toMatch(/Số điện thoại\s+0912345678/);
    await content(page).locator('button', { hasText: /^\s*cập nhật\s*$/i }).first().click();
    const e = dlg(page); await e.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    await expect(phoneInput(e), 'form Cập nhật hiển thị SĐT').toHaveValue('0912345678');
  });
  test(tc('ORG-C14'), async ({ page }) => {
    const t = await stdType(2); const par = await mkOrg({}, true);   // đơn vị cha thử (đã khóa = đưa vào sử dụng), tên chứa tag QCA… viết HOA
    const d = await openAddP(page, 'ORG'); const bad: string[] = [];
    const check = async (label: RegExp, frag: string, what: string) => {
      const sel = d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: label }) }).locator('.ant-select').first();
      if (!(await sel.evaluate(e => e.classList.contains('ant-select-show-search')))) { bad.push(`${what}: không có ô tìm kiếm`); return; }
      await sel.click(); await page.keyboard.type(frag.toUpperCase()); await page.waitForTimeout(1500);
      const opts = (await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option').allInnerTexts()).map(s => s.trim());
      if (!opts.length) bad.push(`${what}: gõ "${frag.toUpperCase()}" không ra kết quả (không phân biệt hoa/thường)`);
      const wrong = opts.filter(o => !fold(o).includes(fold(frag)));   // quy tắc tìm kiếm chung: không phân biệt hoa/thường, không phân biệt dấu
      if (wrong.length) bad.push(`${what}: kết quả không chứa "${frag}": ${wrong.slice(0, 3).join(', ')}`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    };
    await check(/^\s*loại đơn vị/i, t.name.slice(0, 6), 'Loại đơn vị');
    await pickByLabel(page, d, /^\s*loại đơn vị/i, t.name);
    await check(/^\s*tỉnh\/thành/i, 'thành phố', 'Tỉnh/thành');
    // Đơn vị cha: nút mở popover có ô tìm
    await d.getByRole('button', { name: /chọn đơn vị cha/i }).click();
    const pop = page.locator('.ant-popover').filter({ visible: true }).last();
    await pop.waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    const search = pop.getByPlaceholder(/tìm/i);
    if (!(await search.count())) bad.push('Đơn vị cha: không có ô tìm kiếm');
    else {
      const kw = par.tag.toLowerCase();   // gõ chữ thường, tên chứa chữ HOA
      await search.first().fill(kw); await page.waitForTimeout(1800);
      const items = (await pop.innerText()).split('\n').map(s => s.trim()).filter(s => s && !/^không có đơn vị cha$|không tìm thấy|không có dữ liệu/i.test(s));
      if (!items.includes(par.name)) bad.push(`Đơn vị cha: gõ "${kw}" không ra "${par.name}" (không phân biệt hoa/thường)`);
      const wrong = items.filter(s => !fold(s).includes(kw)); if (wrong.length) bad.push(`Đơn vị cha: kết quả không chứa "${kw}": ${wrong.slice(0, 3).join(', ')}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('ORG-E05'), async ({ page }) => {
    const std = await stdType(2); const fresh = await mkType(2);
    const bad: string[] = [];
    for (const t of [std, fresh]) {
      const o = await mkOrg({ unitTypeId: t.id });
      const d = await openEditP(page, 'ORG', o.code);
      const shown = (await d.locator('.ant-form-item').filter({ has: page.locator('label', { hasText: /^\s*loại đơn vị/i }) }).locator('.ant-select').first().innerText()).trim();
      if (shown !== t.name) bad.push(`loại "${t.name}" (${t.code}) hiển thị "${shown}"`);
      if (/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(shown)) bad.push(`loại ${t.code} hiển thị UUID`);
      await btnCancel(d).click(); await page.waitForTimeout(300);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('ORG-M04'), async ({ page }) => {
    const o = await mkOrg(); const u = await mkUser(o.id);
    await openDetailId(page, 'ORG', o.id);
    await expect(dataRows(page).filter({ hasText: u.userName })).toHaveCount(1);
    await page.getByRole('button', { name: /thêm người dùng vào đơn vị/i }).click();
    const d = dlg(page); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(1200);
    await d.getByPlaceholder(/tìm/i).first().fill(u.userName); await page.waitForTimeout(1800);
    const names = (await d.locator('tbody tr.ant-table-row').allInnerTexts()).map(s => s.split('\t').map(x => x.trim()));
    expect(names.filter(r => r.includes(u.userName)), `người dùng ${u.userName} đã thuộc đơn vị không được có trong danh sách chọn`).toEqual([]);
  });
  test(tc('ORG-S03'), async () => {
    const perms = new Set(Object.values((await A('GET', 'idm/permission-matrix/me', undefined, 'canbo')).data ?? {}).map((x: any) => x.code));
    // GET danh sách đơn vị (tra cứu) không thuộc nhóm "API thao tác phân quyền/người dùng của đơn vị" → chỉ ghi nhận, không chấm
    console.log(`  (ghi nhận) Cán bộ GET organizations (danh sách) → HTTP ${(await A('GET', 'organizations?page=1&size=5', undefined, 'canbo')).status}`);
    const o = await mkOrg(); const u = await mkUser(null); const inOrg = await mkUser(o.id);
    const checks: [string, string, any, string][] = [
      ['GET', `organizations/${o.id}`, undefined, 'ORGANIZATION.VIEW'],
      ['PUT', `organizations/${o.id}`, { name: `${o.name} canbo`, unitTypeId: o.unitTypeId }, 'ORGANIZATION.UPDATE'],
      ['PUT', `organizations/${o.id}/lock`, {}, 'ORGANIZATION.LOCK'],
      ['POST', `organizations/${o.id}/users`, { userIds: [u.id] }, 'ORGANIZATION.UPDATE'],
      ['POST', `organizations/${o.id}/users/remove`, { userIds: [inOrg.id] }, 'ORGANIZATION.UPDATE'],
      ['DELETE', `organizations/${o.id}`, undefined, 'ORGANIZATION.DELETE'],
    ];
    const bad: string[] = [];
    for (const [m, url, body, perm] of checks) {
      const r = await A(m, url, body, 'canbo');
      if (!perms.has(perm) && r.status !== 403) bad.push(`${m} ${url.replace(o.id, '<id>')}: không có ${perm} nhưng HTTP ${r.status} (kỳ vọng 403)`);
      if (perms.has(perm) && (r.status === 401 || r.status === 403)) bad.push(`${m} ${url}: có ${perm} nhưng bị ${r.status}`);
    }
    const after = (await A('GET', `organizations/${o.id}`)).data;
    if (!after) bad.push('đơn vị bị xóa bởi Cán bộ');
    else {
      if (after.name !== o.name) bad.push(`tên đơn vị bị đổi thành "${after.name}"`);
      if (after.isLocked) bad.push('đơn vị bị khóa bởi Cán bộ');
    }
    if ((await A('GET', `idm/users/${u.id}`)).data?.organizationId === o.id) bad.push('Cán bộ thêm được người dùng vào đơn vị');
    if ((await A('GET', `idm/users/${inOrg.id}`)).data?.organizationId !== o.id) bad.push('Cán bộ gỡ được người dùng khỏi đơn vị');
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ======================================================================= THAM SỐ HỆ THỐNG / NHẬT KÝ / XÁC THỰC / API CHUNG
