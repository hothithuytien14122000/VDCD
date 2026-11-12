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
} from '../A/common';
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

// ======================================================================= THAM SỐ HỆ THỐNG / NHẬT KÝ / XÁC THỰC / API CHUNG
test.describe('Bug GitLab A2 › Tham số hệ thống, Nhật ký, phiên, tệp minh chứng', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('ATA-C12'), async ({ page }) => {
    // CHỈ kiểm phần hiển thị: KHÔNG bấm Lưu; chặn mọi request ghi tới system/* để chắc chắn không đổi tham số dùng chung.
    // Phần "Lưu → tải lại giữ đúng lựa chọn" = BLOCKED (đổi tham số ảnh hưởng toàn môi trường, các agent khác đang chạy song song).
    const writes: string[] = [];
    await page.route(/\/api\/v1\/system\//, r => { if (r.request().method() !== 'GET') { writes.push(r.request().url()); return r.abort(); } return r.continue(); });
    page.on('dialog', x => x.accept().catch(() => {}));
    await page.goto(`${B}/vi/system-config`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    await page.locator('.ant-tabs-tab', { hasText: 'Minh chứng' }).click(); await page.waitForTimeout(1200);
    const pane = page.locator('.ant-tabs-tabpane-active').first();
    await expect(pane).toContainText(/định dạng tệp cho phép/i);
    const fmt = (f: string) => pane.locator('button[aria-pressed], [role=switch], [role=checkbox], label', { hasText: new RegExp(`^\\s*\\.?${f}\\s*$`, 'i') }).first();
    for (const f of ['pdf', 'docx', 'xlsx', 'jpg', 'png']) await expect(fmt(f), `thiếu định dạng ${f.toUpperCase()} (chọn/bỏ được)`).toBeVisible();
    // chọn/bỏ được: bấm DOCX đổi trạng thái, bấm lại trở về (không lưu)
    const el = fmt('docx');
    const st = () => el.evaluate(e => [e.getAttribute('aria-pressed'), e.getAttribute('aria-checked'), getComputedStyle(e).backgroundColor].join('|'));
    const s0 = await st(); await el.click(); await page.waitForTimeout(400); const s1 = await st();
    await el.click(); await page.waitForTimeout(400); const s2 = await st();
    expect(s1, 'bấm DOCX phải đổi trạng thái chọn').not.toBe(s0);
    expect(s2, 'bấm lại phải trở về trạng thái ban đầu').toBe(s0);
    await page.reload({ waitUntil: 'networkidle' });
    expect(writes, 'không được có request ghi tham số').toEqual([]);
  });
  test(tc('ATA-N25'), async ({ page }) => {
    // Phần "không có dòng chữ phụ thừa dưới giá trị chính": design không có giá trị cụ thể → chỉ kiểm cột Thiết bị
    await page.goto(`${B}/vi/audit-log`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    const heads = (await page.locator('.ant-layout-content .ant-table-thead th').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    expect(heads.length).toBeGreaterThan(0);
    expect(heads.filter(h => /thiết bị/i.test(h)), `cột: ${heads.join(' | ')}`).toEqual([]);
  });
  test(tc('ATU-T05'), async ({ browser }) => {
    // Chỉ kiểm phần mở tab mới dùng chung phiên. KHÔNG đăng xuất (phần "đăng xuất ở một tab" sẽ hủy session admin dùng chung).
    const ctx = await browser.newContext({ storageState: 'auth/admin.json' });
    try {
      const t1 = await ctx.newPage(); await t1.goto(`${B}/vi/provinces`, { waitUntil: 'networkidle' }); await t1.waitForTimeout(1500);
      await expect(t1.locator('tbody tr.ant-table-row').first()).toBeVisible();
      const bad: string[] = [];
      for (const r of ['', 'vi/organizations']) {
        const t2 = await ctx.newPage(); await t2.goto(`${B}/${r}`, { waitUntil: 'networkidle' }); await t2.waitForTimeout(2500);
        const login = await t2.locator('input[type=password]').filter({ visible: true }).count();
        if (login || /login|dang-nhap|sign-?in/i.test(t2.url())) bad.push(`tab mới mở "/${r}" bị yêu cầu đăng nhập (${t2.url()})`);
        else if (r && !(await t2.locator('tbody tr.ant-table-row').first().isVisible().catch(() => false))) bad.push(`tab mới "/${r}" không vào thẳng màn nghiệp vụ (${t2.url()})`);
        await t2.close();
      }
      expect(bad, bad.join('\n')).toEqual([]);
    } finally { await ctx.close(); }
  });
});
