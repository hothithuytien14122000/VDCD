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

test.describe('Bug GitLab A2 › Tỉnh/thành — danh sách & giao diện chung', () => {
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

test.describe('Bug GitLab A2 › Tỉnh/thành — chi tiết', () => {
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

test.describe('Bug GitLab A2 › Tỉnh/thành — Thêm / Sửa / Xoá & popup chung', () => {
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
test.describe('Bug GitLab A2 › Xã/phường', () => {
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
test.describe('Bug GitLab A2 › Loại đơn vị', () => {
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
