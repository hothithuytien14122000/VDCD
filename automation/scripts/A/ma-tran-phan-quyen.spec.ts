// A.II.3 MA TRẬN PHÂN QUYỀN (phân quyền cho nhóm người dùng) — script bám testcase PRM-* (testcases/docs/catalog.json)
// Mọi thao tác ghi chỉ làm trên nhóm QCA… tự tạo; sau mỗi test gỡ hết quyền rồi xóa nhóm (nhóm còn quyền thì API không cho xóa).
import { Page, Locator } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test, expect, tc, api, code8, goto, toast, tokenOf, apiStatus, Made, ensureUser, findApi } from './common';
import { API_BASE } from '../api';

const ROUTE = 'permission-matrix';
const TOTAL = 104;
const made = new Made();
const roleIds: string[] = [];

type Perm = [string, string];   // [mã quyền, phạm vi]
const P = (...codes: string[]): Perm[] => codes.map(c => [c, 'all']);

// ---------- Dữ liệu ----------
/** Tạo nhóm QCA… (có thể cấp sẵn quyền qua API). Trả id, code, name. */
async function newRole(perms: Perm[] = [], extra: any = {}) {
  const code = code8(); const name = extra.name ?? `qc.automation PRM ${code}`;
  const r = await api('POST', 'idm/roles', { code, name, description: 'qc.automation', ...extra });
  if (r.status !== 200) throw new Error('Tạo nhóm lỗi: ' + r.message);
  const list = await api('GET', 'idm/permission-matrix/roles');
  const id = (list.data as any[]).find(x => x.code === code)?.id as string;
  if (!id) throw new Error('Không tìm thấy nhóm vừa tạo trong ma trận');
  roleIds.push(id);
  if (perms.length) await putPerms(id, perms);
  return { id, code, name };
}
const putPerms = async (id: string, perms: Perm[]) => {
  const r = await api('PUT', `idm/permission-matrix/roles/${id}`, { permissions: perms.map(([code, scope]) => ({ code, scope })) });
  if (r.status !== 200) throw new Error('Cấp quyền qua API lỗi: ' + r.message);
  return r;
};
/** Quyền hiện có của nhóm: { mã: phạm vi }. */
async function permsOf(id: string): Promise<Record<string, string>> {
  const r = await api('GET', `idm/permission-matrix/roles/${id}`);
  return Object.fromEntries(((r.data?.permissions ?? []) as any[]).map(p => [p.code, p.scope]));
}
const catalog = async () => (await api('GET', 'idm/permission-matrix')).data as { scopes: any[]; modules: any[] };
const allRoles = async () => (await api('GET', 'idm/permission-matrix/roles')).data as any[];
const SCOPE_TXT: Record<string, string> = { unit: 'Đơn vị', unitAndChildren: 'Đơn vị và đơn vị con', all: 'Toàn hệ thống' };

test.afterEach(async () => {
  await made.clean();                                   // người dùng QCA… trước
  for (const id of roleIds.splice(0)) {
    await api('PUT', `idm/permission-matrix/roles/${id}`, { permissions: [] }).catch(() => {});
    await api('DELETE', `idm/roles/${id}`).catch(() => {});
  }
});

// ---------- Helper giao diện ----------
const saveBtn = (page: Page) => page.getByRole('button', { name: 'Lưu', exact: true });
const cancelBtn = (page: Page) => page.getByRole('button', { name: 'Hủy thay đổi' });
const search = (page: Page) => page.getByPlaceholder('Tìm chức năng hoặc quyền');
const waitTree = (page: Page) => page.locator('button[aria-expanded]').first().waitFor({ state: 'visible', timeout: 15_000 });
const expandAll = async (page: Page) => { await page.getByRole('button', { name: 'Mở rộng tất cả' }).click(); await page.waitForTimeout(500); };
async function openMatrix(page: Page, roleName?: string, expand = true) {
  await page.setViewportSize({ width: 1600, height: 1100 });   // cửa sổ rộng để thấy đủ cột Phạm vi
  await goto(page, ROUTE);
  await page.getByText('NHÓM NGƯỜI DÙNG').first().waitFor({ state: 'visible', timeout: 15_000 });
  await waitTree(page);
  if (roleName) await pickRole(page, roleName, expand);
}
/** Thẻ nhóm ở danh sách bên trái, khớp đúng tên nhóm (không khớp nhầm phần mô tả của nhóm khác). */
const cardOf = (page: Page, name: string) => rolesCards(page).filter({ has: page.getByText(name, { exact: true }) }).first();
async function pickRole(page: Page, name: string, expand = true) {
  await cardOf(page, name).click();
  await page.waitForTimeout(1200);
  if (expand) await expandAll(page);
}
const rolesCards = (page: Page) => page.getByRole('button', { name: /\d+\/104\s*$/ });
/** Số "n" trong "n / 104 quyền đã cấp". */
async function granted(page: Page): Promise<number> {
  const t = (await page.locator('text=quyền đã cấp').first().locator('xpath=..').innerText()).replace(/\s+/g, ' ');
  const m = t.match(/(\d+)\s*\/\s*104/); if (!m) throw new Error('Không đọc được bộ đếm: ' + t);
  return Number(m[1]);
}
/** Khung bên phải (tên nhóm, mô tả, bộ đếm, cây quyền). */
const panelHeader = (page: Page) => page.locator('div').filter({ has: cancelBtn(page) }).filter({ hasText: 'CHỨC NĂNG / QUYỀN' }).last();
/** Khối chức năng (hoặc module) theo tên: chứa dòng tiêu đề và các dòng quyền con. */
const fn = (page: Page, name: string): Locator =>
  page.locator(`input[aria-label="Cấp tất cả quyền của ${name}"]`).locator('xpath=ancestor::div[contains(@class,"grid")][1]/..');
const fnBox = (page: Page, name: string) => page.locator(`input[aria-label="Cấp tất cả quyền của ${name}"]`).locator('xpath=..');
const actBox = (page: Page, f: string, a: string) => fn(page, f).locator(`input[aria-label="${a}"]`).locator('xpath=..');
const clickBox = async (l: Locator, page: Page) => { await l.click(); await page.waitForTimeout(350); };
const tickFn = (page: Page, name: string) => clickBox(fnBox(page, name), page);
const tickAct = (page: Page, f: string, a: string) => clickBox(actBox(page, f, a), page);
/** Checkbox đang tick (đủ/một phần)? */
const isOn = (box: Locator) => box.locator('span[aria-hidden]').evaluate(e => e.className.includes('bg-primary'));
const isPartial = (box: Locator) => box.locator('svg.lucide-minus').count().then(n => n > 0);
/** Dòng quyền con: chữ trong ô Phạm vi (đã tick) hoặc "–" (chưa tick). */
async function scopeText(page: Page, f: string, a: string): Promise<string> {
  const grid = fn(page, f).locator(`input[aria-label="${a}"]`).locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  const sel = grid.locator('.ant-select-content-value');
  if (await sel.count()) return ((await sel.first().getAttribute('title')) ?? (await sel.first().innerText())).trim();
  return (await grid.innerText()).replace(a, '').trim();
}
/** Mở ô Phạm vi của quyền (cuộn tới trước vì cửa sổ test hẹp). */
async function openScope(page: Page, f: string, a: string) {
  const sel = fn(page, f).locator(`input[aria-label="Phạm vi · ${a}"]`).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
  await sel.scrollIntoViewIfNeeded();
  await sel.click();
  await page.locator('.ant-select-dropdown:visible').last().waitFor({ state: 'visible', timeout: 5000 });
}
async function setScope(page: Page, f: string, a: string, scope: string) {
  await openScope(page, f, a);
  const dd = page.locator('.ant-select-dropdown:visible').last();
  await dd.getByText(scope, { exact: true }).click();
  await page.waitForTimeout(300);
}
async function scopeOptions(page: Page, f: string, a: string): Promise<string[]> {
  await openScope(page, f, a);
  const dd = page.locator('.ant-select-dropdown:visible').last();
  await dd.waitFor({ state: 'visible' });
  await dd.locator('.ant-select-item').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  const t = await dd.locator('.ant-select-item').allInnerTexts();
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  return t.map(s => s.trim());
}
const fnTitles = async (page: Page) => (await page.locator('button[aria-expanded]').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
const onlyFns = (t: string[]) => t.filter(s => /\d+\/\d+$/.test(s)).map(s => s.replace(/\s*\d+\/\d+$/, ''));
const actionInputs = (page: Page) => page.locator('input[type=radio][aria-label]:not([aria-label^="Cấp tất cả"])');
const checkedActions = (page: Page): Promise<number> => page.evaluate(() =>
  [...document.querySelectorAll('input[type=radio][aria-label]')].filter(i => !(i.getAttribute('aria-label') ?? '').startsWith('Cấp tất cả') && (i.nextElementSibling?.className ?? '').includes('bg-primary')).length);
/** Bấm Lưu và chờ phản hồi PUT. */
async function save(page: Page) {
  const [res] = await Promise.all([
    page.waitForResponse(r => /permission-matrix\/roles\//.test(r.url()) && r.request().method() === 'PUT', { timeout: 15_000 }),
    saveBtn(page).click(),
  ]);
  await page.waitForTimeout(600);
  return res;
}
/** Chọn nhóm trên giao diện: tick danh sách quyền [chức năng, quyền] rồi trả lại. */
async function tickMany(page: Page, items: [string, string][]) { for (const [f, a] of items) await tickAct(page, f, a); }
const FN = { USER: 'Quản lý người dùng', ROLE: 'Quản lý nhóm người dùng', BACKUP: 'Sao lưu dữ liệu', PROV: 'Đơn vị hành chính cấp tỉnh', LOG: 'Nhật ký truy cập' };

// ================= UC1 — XEM =================
test.describe('Ma trận phân quyền › Xem', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('PRM-L01'), async ({ page }) => {
    await page.goto('/'); await page.waitForTimeout(2500);
    await page.getByText('Ma trận phân quyền').first().click();
    await expect(page.getByRole('heading', { name: 'Ma trận phân quyền' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Chọn nhóm người dùng, cấp hoặc hủy từng quyền và chọn phạm vi dữ liệu của quyền đó.')).toBeVisible();
    expect(page.url()).toContain('permission-matrix');
  });
  test(tc('PRM-L02'), async ({ page }) => {
    const before = await allRoles();
    await openMatrix(page);
    const after = await allRoles();
    // môi trường dùng chung: nhóm có thể được tạo/xóa đồng thời bởi người khác → chỉ so các nhóm tồn tại cả trước và sau khi mở trang
    const stable = before.filter(r => after.some(x => x.id === r.id));
    const n = await rolesCards(page).count();
    expect(n).toBeGreaterThanOrEqual(stable.length);
    expect(n).toBeLessThanOrEqual(new Set([...before, ...after].map(r => r.id)).size);
    const bad: string[] = [];
    for (const r of stable.filter(x => !/^QCA/i.test(x.code))) {
      const card = cardOf(page, r.name);
      const txt = (await card.innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (!txt.includes(`${r.grantedCount}/${TOTAL}`)) bad.push(`${r.name}: "${txt}" ≠ ${r.grantedCount}/${TOTAL}`);
      if (r.isSystem && !(await card.locator('svg').count())) bad.push(`${r.name}: nhóm hệ thống thiếu biểu tượng khóa`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('PRM-L03'), async ({ page }) => {
    await openMatrix(page);
    await expect(page.locator('text=quyền đã cấp').first()).toBeVisible();
    const id = page.url().match(/roleId=([0-9a-f-]{36})/i)?.[1];
    expect(id, 'URL phải có roleId của nhóm đang chọn').toBeTruthy();
    const role = (await allRoles()).find(r => r.id === id)!;
    expect(role, 'roleId phải thuộc nhóm có thật').toBeTruthy();
    const head = (await panelHeader(page).innerText()).replace(/\s+/g, ' ');
    expect(head).toContain(role.name);
    expect(await granted(page)).toBe(role.grantedCount);
  });
  test(tc('PRM-L04'), async ({ page }) => {
    await openMatrix(page);
    await search(page).fill('nhật ký'); await page.waitForTimeout(600);
    const f = onlyFns(await fnTitles(page));
    expect(f).toEqual(['Nhật ký truy cập']);
  });
  test(tc('PRM-L05'), async ({ page }) => {
    await openMatrix(page);
    await search(page).fill('NHẬT KÝ'); await page.waitForTimeout(600);
    const a = onlyFns(await fnTitles(page));
    await search(page).fill('nhật ký'); await page.waitForTimeout(600);
    const b = onlyFns(await fnTitles(page));
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });
  test(tc('PRM-L06'), async ({ page }) => {
    await openMatrix(page);
    await search(page).fill('xuất excel'); await page.waitForTimeout(600);
    const f = onlyFns(await fnTitles(page));
    for (const n of ['Quản lý người dùng', 'Quản lý nhóm người dùng', 'Phân quyền cho nhóm người dùng']) expect(f, `thiếu ${n}`).toContain(n);
    expect(f).not.toContain('Sao lưu dữ liệu');
  });
  test(tc('PRM-L07'), async ({ page }) => {
    await openMatrix(page);
    await search(page).fill('zzqcxx_khongtontai_999'); await page.waitForTimeout(600);
    await expect(page.getByText('Không tìm thấy chức năng hoặc quyền phù hợp')).toBeVisible();
  });
  test(tc('PRM-L08'), async ({ page }) => {
    let dialog = '';
    page.on('dialog', d => { dialog = d.message(); d.dismiss().catch(() => {}); });
    await openMatrix(page);
    for (const kw of [`' OR 1=1 --`, '<script>alert(1)</script>']) {
      await search(page).fill(kw); await page.waitForTimeout(600);
      await expect(page.getByText('Không tìm thấy chức năng hoặc quyền phù hợp')).toBeVisible();
    }
    expect(dialog, 'script không được thực thi').toBe('');
    await search(page).fill(''); await page.waitForTimeout(500);
    expect(onlyFns(await fnTitles(page)).length).toBe(23);
  });
  test(tc('PRM-L09'), async ({ page }) => {
    const r = await newRole([['USER.VIEW', 'all'], ['USER.CREATE', 'all'], ['BACKUP.VIEW', 'all']]);
    await openMatrix(page, r.name);
    await page.getByRole('button', { name: 'Đã cấp', exact: true }).click(); await page.waitForTimeout(600); await expandAll(page);
    expect(onlyFns(await fnTitles(page)).sort()).toEqual([FN.BACKUP, FN.USER].sort());
    expect(await actionInputs(page).count()).toBe(3);   // Xem, Thêm (USER) + Xem (BACKUP)
    await expect(fn(page, FN.USER).locator('input[aria-label="Sửa"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Chưa cấp', exact: true }).click(); await page.waitForTimeout(600); await expandAll(page);
    await expect(fn(page, FN.USER).locator('input[aria-label="Xem"]')).toHaveCount(0);
    await expect(fn(page, FN.USER).locator('input[aria-label="Thêm"]')).toHaveCount(0);
    await expect(fn(page, FN.USER).locator('input[aria-label="Sửa"]')).toHaveCount(1);
    await expect(fn(page, FN.BACKUP).locator('input[aria-label="Xem"]')).toHaveCount(0);
    await expect(fn(page, FN.BACKUP).locator('input[aria-label="Thêm"]')).toHaveCount(1);
  });
  test(tc('PRM-L10'), async ({ page }) => {
    const r = await newRole([['USER.VIEW', 'all'], ['BACKUP.VIEW', 'all']]);
    await openMatrix(page, r.name);
    await page.getByRole('button', { name: 'Đã cấp', exact: true }).click(); await page.waitForTimeout(500);
    await search(page).fill('người dùng'); await page.waitForTimeout(600);
    expect(onlyFns(await fnTitles(page))).toEqual([FN.USER]);
    await page.getByRole('button', { name: 'Tất cả', exact: true }).click(); await search(page).fill(''); await page.waitForTimeout(600);
    expect(onlyFns(await fnTitles(page)).length).toBe(23);
  });
  test(tc('PRM-L11'), async ({ page }) => {
    await openMatrix(page, undefined, false);
    await page.getByRole('button', { name: 'Thu gọn tất cả' }).click(); await page.waitForTimeout(500);
    await expect(actionInputs(page)).toHaveCount(0);
    await expandAll(page);
    await expect(actionInputs(page)).toHaveCount(TOTAL);
    expect(await page.locator('button[aria-expanded="false"]').count()).toBe(0);
  });
  test(tc('PRM-L12'), async ({ page }) => {
    const r = await newRole([['USER.VIEW', 'all']]);
    await openMatrix(page, r.name);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), page.getByRole('button', { name: 'Xuất Excel' }).click()]);
    expect(dl.suggestedFilename()).toBe(`phan-quyen-${r.code}.xlsx`);
    const f = `/tmp/${dl.suggestedFilename()}`; await dl.saveAs(f);
    expect(fs.statSync(f).size).toBeGreaterThan(0);
    const xml = execFileSync('unzip', ['-p', f], { maxBuffer: 20_000_000 }).toString('utf8');
    expect(xml, 'file xlsx phải chứa tên chức năng').toContain('Quản lý người dùng');
    fs.rmSync(f, { force: true });
  });

  test(tc('PRM-V01'), async ({ page }) => {
    const r = await newRole([['USER.VIEW', 'unit'], ['ROLE.VIEW', 'all'], ['BACKUP.VIEW', 'all']], { description: 'qc.automation mô tả PRM' });
    await openMatrix(page, r.name);
    expect((await panelHeader(page).innerText()).replace(/\s+/g, ' ')).toContain('qc.automation mô tả PRM');
    expect(await granted(page)).toBe(3);
    expect(await checkedActions(page)).toBe(3);
    expect(await scopeText(page, FN.USER, 'Xem')).toBe('Đơn vị');
    expect(await scopeText(page, FN.ROLE, 'Xem')).toBe('Toàn hệ thống');
    expect(await scopeText(page, FN.BACKUP, 'Xem')).toBe('Toàn hệ thống');
    expect(await isOn(actBox(page, FN.USER, 'Xem'))).toBe(true);
    expect(await isOn(actBox(page, FN.USER, 'Thêm'))).toBe(false);
  });
  test(tc('PRM-V02'), async ({ page }) => {
    const cat = await catalog();
    await openMatrix(page); await expandAll(page);
    const titles = await fnTitles(page);
    const mods = titles.filter(s => /quyền$/.test(s));
    expect(mods.length).toBe(cat.modules.length);
    for (const m of cat.modules) {
      const n = m.functions.reduce((s: number, f: any) => s + f.actions.length, 0);
      expect(mods.some(t => t.startsWith(m.code) && t.includes(m.name) && t.endsWith(`/${n} quyền`)), `module ${m.code} phải có ${n} quyền`).toBe(true);
    }
    const apiFns = cat.modules.flatMap((m: any) => m.functions.map((f: any) => f.name));
    expect(onlyFns(titles)).toEqual(apiFns);
    expect(apiFns.length).toBe(23);
    expect(await actionInputs(page).count()).toBe(TOTAL);
    const body = await page.locator('body').innerText();
    for (const h of ['CHỨC NĂNG / QUYỀN', 'CẤP QUYỀN', 'PHẠM VI']) expect(body).toContain(h);
  });
  test(tc('PRM-V03'), async ({ page }) => {
    const cat = await catalog();
    await openMatrix(page); await expandAll(page);
    const ui = await page.evaluate(() => [...document.querySelectorAll('span[title][class*="pl-["]')].map(e => [e.textContent?.trim(), e.getAttribute('title')]));
    const api_ = cat.modules.flatMap((m: any) => m.functions.flatMap((f: any) => f.actions.map((a: any) => [a.name, a.description])));
    expect(ui.length).toBe(TOTAL);
    expect(ui).toEqual(api_);
  });
  test(tc('PRM-V04'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    expect(await granted(page)).toBe(0);
    expect(await checkedActions(page)).toBe(0);
    await expect(page.locator('input[aria-label^="Phạm vi"]')).toHaveCount(0);
    expect(await scopeText(page, FN.USER, 'Xem')).toBe('–');
    await expect(saveBtn(page)).toBeDisabled();
  });
  test(tc('PRM-V05'), async ({ page }) => {
    const sys = (await allRoles()).find(r => r.isSystem)!;
    const cat = await catalog(); void cat;
    const perms = await permsOf(sys.id);
    await openMatrix(page, sys.name);
    expect(await granted(page)).toBe(TOTAL);
    expect(await checkedActions(page)).toBe(TOTAL);
    const vals = await page.evaluate(() => [...document.querySelectorAll('.ant-select-content-value')].map(e => e.getAttribute('title')));
    const want = Object.values(perms).map(s => SCOPE_TXT[s]);
    expect(vals.sort()).toEqual(want.sort());
  });
  test(tc('PRM-V06'), async ({ page }) => {
    const ZERO = '00000000-0000-0000-0000-000000000000';
    const r = await api('GET', `idm/permission-matrix/roles/${ZERO}`);
    expect(r.status).toBe(404); expect(r.message).toMatch(/không tồn tại/i);
    await goto(page, `${ROUTE}?roleId=${ZERO}`);
    await page.getByText('NHÓM NGƯỜI DÙNG').first().waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByText('CHỨC NĂNG / QUYỀN')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Exception|Unexpected|stack|undefined|NaN/i);
  });
  test(tc('PRM-V07'), async ({ page }) => {
    const a = await newRole(); const b = await newRole();
    await openMatrix(page, a.name);
    await tickAct(page, FN.USER, 'Xem');
    expect(await granted(page)).toBe(1);
    await pickRole(page, b.name);
    const dialog = await page.getByRole('dialog').isVisible().catch(() => false);
    if (!dialog) {
      await pickRole(page, a.name);
      const kept = (await granted(page)) === 1 && await isOn(actBox(page, FN.USER, 'Xem'));
      expect(kept, 'chuyển nhóm khi còn thay đổi chưa lưu phải có cảnh báo hoặc giữ nguyên thay đổi').toBe(true);
    }
  });
  test(tc('PRM-V08'), async ({ page }) => {
    const r = await newRole(P('USER.VIEW'));
    await openMatrix(page, r.name);
    await tickAct(page, FN.USER, 'Sửa');
    expect(await granted(page)).toBe(2);
    await page.reload(); await page.waitForTimeout(2500);
    await pickRole(page, r.name);
    expect(await granted(page)).toBe(1);
    expect(Object.keys(await permsOf(r.id))).toEqual(['USER.VIEW']);
  });

  test(tc('PRM-R01'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page);
    const card = cardOf(page, r.name);
    await expect(card).toBeVisible();
    expect((await card.innerText()).replace(/\s+/g, ' ')).toContain('0/104');
  });
  test(tc('PRM-R02'), async ({ page }) => {
    const r = await newRole(P('USER.VIEW'));
    const cur = await api('GET', `idm/roles/${r.id}`);
    const nn = `qc.automation Đổi ${r.code}`;
    const u = await api('PUT', `idm/roles/${r.id}`, { ...cur.data, name: nn });
    expect(u.status, u.message).toBe(200);
    await openMatrix(page);
    const card = cardOf(page, nn);
    await expect(card).toBeVisible();
    expect((await card.innerText()).replace(/\s+/g, ' ')).toContain('1/104');
    expect(Object.keys(await permsOf(r.id))).toEqual(['USER.VIEW']);
  });
  test(tc('PRM-R03'), async ({ page }) => {
    const r = await newRole();
    expect((await api('DELETE', `idm/roles/${r.id}`)).status).toBe(200);
    await openMatrix(page);
    await expect(rolesCards(page).filter({ has: page.getByText(r.name, { exact: true }) })).toHaveCount(0);
    const g = await api('GET', `idm/permission-matrix/roles/${r.id}`);
    expect(g.status).toBe(404); expect(g.message).toMatch(/không tồn tại/i);
  });
  test(tc('PRM-R04'), async () => {
    const r = await newRole(P('USER.VIEW'));
    const d = await api('DELETE', `idm/roles/${r.id}`);
    expect(d.status).toBe(400);
    expect(d.message).toMatch(/đang gán 1 quyền.*gỡ hết quyền/i);
    expect((await api('GET', `idm/permission-matrix/roles/${r.id}`)).status).toBe(200);
  });
  test(tc('PRM-R05'), async () => {
    const r = await newRole();
    const u1 = await ensureUser(made, { roleCode: r.code }); await ensureUser(made, { roleCode: r.code });
    const u1id = (await findApi('idm/users', u1.userName, 'userName'))?.id;
    const mc = async () => (await allRoles()).find(x => x.id === r.id)?.memberCount;
    expect(await mc()).toBe(2);
    expect((await api('DELETE', `idm/users/${u1id}`)).status).toBe(200);
    expect(await mc()).toBe(1);
  });
});

// ================= UC2 — PHÂN QUYỀN =================
test.describe('Ma trận phân quyền › Phân quyền', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('PRM-E01'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await expect(saveBtn(page)).toBeDisabled();
    await tickAct(page, FN.USER, 'Xem');
    expect(await granted(page)).toBe(1);
    expect((await fn(page, FN.USER).locator('button[aria-expanded]').innerText()).replace(/\s+/g, ' ')).toContain('1/6');
    expect(await scopeText(page, FN.USER, 'Xem')).toBe('Đơn vị và đơn vị con');
    await expect(saveBtn(page)).toBeEnabled();
  });
  test(tc('PRM-E02'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickMany(page, [[FN.USER, 'Xem'], [FN.USER, 'Thêm']]);
    const putReq = page.waitForRequest(q => /permission-matrix\/roles\//.test(q.url()) && q.method() === 'PUT');
    const res = await save(page);
    const body = JSON.parse((await putReq).postData() ?? '{}');
    expect(body.permissions.map((p: any) => p.code).sort()).toEqual(['USER.CREATE', 'USER.VIEW']);
    expect(body.permissions.every((p: any) => p.scope === 'unitAndChildren')).toBe(true);
    expect(res.status()).toBe(200);
    expect((await res.json()).message).toMatch(/Lưu phân quyền thành công/);
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'unitAndChildren', 'USER.CREATE': 'unitAndChildren' });
    await expect(saveBtn(page)).toBeDisabled();
    await page.reload(); await page.waitForTimeout(2500); await pickRole(page, r.name);
    expect(await granted(page)).toBe(2);
  });
  test(tc('PRM-E03'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickAct(page, FN.USER, 'Xem');
    await saveBtn(page).click();
    const msg = await toast(page);
    expect(msg, 'phải có thông báo thành công sau khi Lưu').toMatch(/thành công/i);
  });
  test(tc('PRM-E04'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickMany(page, [[FN.USER, 'Xem'], [FN.USER, 'Thêm'], [FN.USER, 'Sửa']]);
    await setScope(page, FN.USER, 'Xem', 'Đơn vị');
    await setScope(page, FN.USER, 'Thêm', 'Đơn vị và đơn vị con');
    await setScope(page, FN.USER, 'Sửa', 'Toàn hệ thống');
    expect((await save(page)).status()).toBe(200);
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'unit', 'USER.CREATE': 'unitAndChildren', 'USER.UPDATE': 'all' });
    await page.reload(); await page.waitForTimeout(2500); await pickRole(page, r.name);
    expect(await scopeText(page, FN.USER, 'Xem')).toBe('Đơn vị');
    expect(await scopeText(page, FN.USER, 'Thêm')).toBe('Đơn vị và đơn vị con');
    expect(await scopeText(page, FN.USER, 'Sửa')).toBe('Toàn hệ thống');
  });
  test(tc('PRM-E05'), async ({ page }) => {
    const r = await newRole([['USER.VIEW', 'unit']]);
    await openMatrix(page, r.name);
    await setScope(page, FN.USER, 'Xem', 'Toàn hệ thống');
    expect((await save(page)).status()).toBe(200);
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'all' });
  });
  test(tc('PRM-E06'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickFn(page, FN.BACKUP); await tickAct(page, FN.PROV, 'Thêm'); await tickAct(page, FN.PROV, 'Xem');
    expect(await scopeText(page, FN.BACKUP, 'Xem')).toBe('Toàn hệ thống');
    expect(await scopeOptions(page, FN.BACKUP, 'Xem')).toEqual(['Toàn hệ thống']);
    expect(await scopeText(page, FN.PROV, 'Thêm')).toBe('Toàn hệ thống');
    expect(await scopeOptions(page, FN.PROV, 'Thêm')).toEqual(['Toàn hệ thống']);
    expect(await scopeOptions(page, FN.PROV, 'Xem')).toEqual(['Đơn vị', 'Đơn vị và đơn vị con', 'Toàn hệ thống']);
  });
  test(tc('PRM-E07'), async ({ page }) => {
    const cat = await catalog();
    const r = await newRole();
    await openMatrix(page, r.name);
    const bad: string[] = [];
    for (const [code, name] of [['USER', FN.USER], ['BACKUP', FN.BACKUP], ['PROVINCE', FN.PROV]]) {
      await tickFn(page, name);
      const f = cat.modules.flatMap((m: any) => m.functions).find((x: any) => x.code === code);
      for (const a of f.actions) {
        const label = a.name as string;
        const ui = await scopeOptions(page, name, label);
        const want = a.scopes.map((s: string) => SCOPE_TXT[s]);
        if (JSON.stringify(ui) !== JSON.stringify(want)) bad.push(`${a.code}: UI ${ui.join('/')} ≠ API ${want.join('/')}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('PRM-E08'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickFn(page, FN.ROLE);
    expect(await granted(page)).toBe(5);
    expect((await fn(page, FN.ROLE).locator('button[aria-expanded]').innerText()).replace(/\s+/g, ' ')).toContain('5/5');
    await fnBox(page, 'Quản trị hệ thống').scrollIntoViewIfNeeded();
    await clickBox(fnBox(page, 'Quản trị hệ thống'), page);
    expect(await granted(page)).toBe(46);
    expect((await panelHeader(page).innerText()).replace(/\s+/g, ' ')).toContain('46');
    expect(await checkedActions(page)).toBe(46);
  });
  test(tc('PRM-E09'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickFn(page, FN.ROLE);
    await tickAct(page, FN.ROLE, 'Xóa');
    expect(await granted(page)).toBe(4);
    expect((await fn(page, FN.ROLE).locator('button[aria-expanded]').innerText()).replace(/\s+/g, ' ')).toContain('4/5');
    expect(await isPartial(fnBox(page, FN.ROLE)), 'checkbox chức năng phải ở trạng thái một phần').toBe(true);
    expect(await isOn(actBox(page, FN.ROLE, 'Xóa'))).toBe(false);
  });
  test(tc('PRM-E10'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    for (const m of ['Quản trị hệ thống', 'Quản lý Bộ chỉ số DTI', 'Đánh giá CĐS', 'Báo cáo thống kê', 'Khảo sát hài lòng']) {
      await fnBox(page, m).scrollIntoViewIfNeeded(); await clickBox(fnBox(page, m), page);
    }
    expect(await granted(page)).toBe(TOTAL);
    expect((await save(page)).status()).toBe(200);
    const p = await permsOf(r.id);
    expect(Object.keys(p).length).toBe(TOTAL);
    expect(Object.values(p).every(s => ['unit', 'unitAndChildren', 'all'].includes(s))).toBe(true);
  });
  test(tc('PRM-E11'), async ({ page }) => {
    const r = await newRole([['USER.VIEW', 'unit']]);
    await openMatrix(page, r.name);
    await tickMany(page, [[FN.USER, 'Thêm'], [FN.USER, 'Sửa'], [FN.USER, 'Xóa']]);
    await setScope(page, FN.USER, 'Xem', 'Toàn hệ thống');
    expect(await granted(page)).toBe(4);
    let put = 0; page.on('request', q => { if (q.method() === 'PUT' && /permission-matrix/.test(q.url())) put++; });
    await cancelBtn(page).click(); await page.waitForTimeout(600);
    expect(await granted(page)).toBe(1);
    expect(await scopeText(page, FN.USER, 'Xem')).toBe('Đơn vị');
    await expect(saveBtn(page)).toBeDisabled();
    expect(put).toBe(0);
  });
  test(tc('PRM-E12'), async ({ page }) => {
    const a = await newRole(); const b = await newRole([['USER.VIEW', 'all']]);
    const isMine = (x: any) => /^QCA/i.test(x.code);   // nhóm QCA… của người khác có thể đổi đồng thời → chỉ so các nhóm thật
    const before = Object.fromEntries((await allRoles()).filter(x => !isMine(x)).map(x => [x.id, x.grantedCount]));
    await openMatrix(page, a.name);
    await tickMany(page, [[FN.USER, 'Xem'], [FN.USER, 'Thêm'], [FN.USER, 'Sửa']]);
    expect((await save(page)).status()).toBe(200);
    expect(Object.keys(await permsOf(a.id)).length).toBe(3);
    expect(await permsOf(b.id)).toEqual({ 'USER.VIEW': 'all' });
    const after = await allRoles();
    for (const x of after) if (!isMine(x) && x.id in before) expect(x.grantedCount, `nhóm ${x.name} bị đổi`).toBe(before[x.id]);
  });
  test(tc('PRM-E13'), async () => {
    const r = await newRole();
    await putPerms(r.id, [['USER.VIEW', 'all'], ['ROLE.VIEW', 'all']]);
    await putPerms(r.id, [['BACKUP.VIEW', 'all']]);
    expect(await permsOf(r.id)).toEqual({ 'BACKUP.VIEW': 'all' });
  });
  test(tc('PRM-E14'), async () => {
    const r = await newRole([['USER.VIEW', 'all']]);
    for (const code of ['FOO.BAR', 'user.view']) {
      const x = await api('PUT', `idm/permission-matrix/roles/${r.id}`, { permissions: [{ code, scope: 'all' }] });
      expect(x.status, code).toBe(400); expect(x.message).toMatch(/không tồn tại/i);
    }
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'all' });
  });
  const ignoredCase = (id: string, perm: any, reason: string, code: string) => test(tc(id), async () => {
    const r = await newRole();
    const x = await api('PUT', `idm/permission-matrix/roles/${r.id}`, { permissions: [perm] });
    expect(x.status, x.message).toBeLessThan(500);
    expect(x.status).toBe(200);
    expect(x.data?.ignored).toEqual([{ code, reason }]);
    expect(await permsOf(r.id)).toEqual({});
  });
  ignoredCase('PRM-E15', { code: 'USER.VIEW', scope: 'xyz' }, 'INVALID_SCOPE', 'USER.VIEW');
  ignoredCase('PRM-E16', { code: 'BACKUP.VIEW', scope: 'unit' }, 'SCOPE_NOT_ALLOWED', 'BACKUP.VIEW');
  ignoredCase('PRM-E17', { code: 'USER.VIEW' }, 'MISSING_SCOPE', 'USER.VIEW');
  test(tc('PRM-E18'), async () => {
    const r = await newRole();
    const x = await api('PUT', `idm/permission-matrix/roles/${r.id}`, { permissions: [{ code: 'USER.VIEW', scope: 'all' }, { code: 'USER.VIEW', scope: 'unit' }] });
    expect(x.status).toBe(400); expect(x.message).toMatch(/USER\.VIEW bị trùng/);
    expect(await permsOf(r.id)).toEqual({});
  });
  test(tc('PRM-E19'), async () => {
    const r = await newRole([['USER.VIEW', 'all']]);
    const url = `${API_BASE}/api/v1/idm/permission-matrix/roles/${r.id}`;
    const H = { Authorization: `Bearer ${tokenOf('superadmin')}`, 'Content-Type': 'application/json' };
    for (const body of [JSON.stringify({ permissions: null }), JSON.stringify([{ code: 'USER.VIEW', scope: 'all' }]), '{bad']) {
      const res = await fetch(url, { method: 'PUT', headers: H, body });
      const j: any = await res.json().catch(() => ({}));
      expect(res.status, body).toBe(400); expect(String(j.message)).toMatch(/Dữ liệu không hợp lệ/);
    }
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'all' });
  });
  test(tc('PRM-E20'), async () => {
    const r = await newRole(P('USER.VIEW', 'ROLE.VIEW'));
    const x = await api('PUT', `idm/permission-matrix/roles/${r.id}`, {});
    const left = Object.keys(await permsOf(r.id)).length;
    expect(left, `PUT {} trả ${x.status} "${x.message}" nhưng làm mất quyền (còn ${left}/2)`).toBe(2);
  });
  test(tc('PRM-E21'), async () => {
    const r = await newRole();
    const bad: string[] = [];
    for (const code of ['A'.repeat(5000), '<script>alert(1)</script>']) {
      const x = await api('PUT', `idm/permission-matrix/roles/${r.id}`, { permissions: [{ code, scope: 'all' }] });
      if (x.status !== 400) bad.push(`mã "${code.slice(0, 12)}…" → ${x.status} (kỳ vọng 400)`);
      if (/Exception|StackTrace|at .*\.cs|SqlException/i.test(JSON.stringify(x.raw))) bad.push('lộ lỗi nội bộ');
      if (x.message.length > 300) bad.push(`thông báo lỗi dài ${x.message.length} ký tự — phản chiếu nguyên mã quyền đã gửi`);
    }
    expect(await permsOf(r.id)).toEqual({});
    expect(bad, bad.join('\n')).toEqual([]);
  });
  test(tc('PRM-E22'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickAct(page, FN.USER, 'Sửa');
    const dialog = await page.getByRole('dialog').isVisible().catch(() => false);
    const viewOn = await isOn(actBox(page, FN.USER, 'Xem'));
    if (!dialog && !viewOn) {
      const res = await save(page);
      const p = await permsOf(r.id);
      expect(res.status() >= 400 || 'USER.VIEW' in p, `Chỉ cấp "Sửa" mà không có "Xem" vẫn được lưu (${JSON.stringify(p)})`).toBe(true);
    }
  });
  test(tc('PRM-E23'), async ({ page }) => {
    const sys = (await allRoles()).find(r => r.isSystem)!;
    const cur = await permsOf(sys.id);
    const put = await api('PUT', `idm/permission-matrix/roles/${sys.id}`, { permissions: Object.entries(cur).map(([code, scope]) => ({ code, scope })) });
    expect(put.status).toBe(400); expect(put.message).toMatch(/Không thể thay đổi quyền của nhóm người dùng hệ thống/);
    expect(Object.keys(await permsOf(sys.id)).length).toBe(TOTAL);
    await openMatrix(page, sys.name);
    await tickFn(page, FN.USER);                // chỉ thử trên giao diện, KHÔNG bấm Lưu
    expect(await granted(page), 'giao diện không được cho thay đổi quyền của nhóm hệ thống').toBe(TOTAL);
    await expect(saveBtn(page)).toBeDisabled();
  });
  test(tc('PRM-E24'), async () => {
    const ZERO = '00000000-0000-0000-0000-000000000000';
    const g = await api('GET', `idm/permission-matrix/roles/${ZERO}`);
    const p = await api('PUT', `idm/permission-matrix/roles/${ZERO}`, { permissions: [] });
    expect(g.status).toBe(404); expect(p.status).toBe(404);
    expect(p.message).toMatch(/Nhóm người dùng không tồn tại/);
    const bad = await fetch(`${API_BASE}/api/v1/idm/permission-matrix/roles/abc`, { headers: { Authorization: `Bearer ${tokenOf('superadmin')}` } });
    expect(bad.status).toBeGreaterThanOrEqual(400); expect(bad.status).toBeLessThan(500);
  });
});

// ================= UC3 — HỦY PHÂN QUYỀN =================
test.describe('Ma trận phân quyền › Hủy phân quyền', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('PRM-D01'), async ({ page }) => {
    const r = await newRole([['USER.VIEW', 'all'], ['USER.CREATE', 'all']]);
    await openMatrix(page, r.name);
    await tickAct(page, FN.USER, 'Thêm');
    expect((await save(page)).status()).toBe(200);
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'all' });
    await page.reload(); await page.waitForTimeout(2500); await pickRole(page, r.name);
    expect(await granted(page)).toBe(1);
    expect(await scopeText(page, FN.USER, 'Thêm')).toBe('–');
  });
  test(tc('PRM-D02'), async ({ page }) => {
    const six = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'LOCK', 'EXPORT'].map(a => `USER.${a}`);
    const r = await newRole(P(...six, 'ROLE.VIEW'));
    await openMatrix(page, r.name);
    await tickFn(page, FN.USER);
    expect((await fn(page, FN.USER).locator('button[aria-expanded]').innerText()).replace(/\s+/g, ' ')).toContain('0/6');
    expect((await save(page)).status()).toBe(200);
    expect(await permsOf(r.id)).toEqual({ 'ROLE.VIEW': 'all' });
  });
  test(tc('PRM-D03'), async ({ page }) => {
    const cat = await catalog();
    const full = (c: string) => cat.modules.flatMap((m: any) => m.functions).find((f: any) => f.code === c).actions.map((a: any) => a.code);
    const r = await newRole(P(...full('USER'), ...full('BACKUP'), ...full('DTI_PILLAR'), ...full('DTI_ASSESSMENT')));
    await openMatrix(page, r.name);
    expect(await granted(page)).toBe(22);
    for (const f of [FN.USER, FN.BACKUP, 'Trụ cột', 'Kết quả tự đánh giá']) { await fnBox(page, f).scrollIntoViewIfNeeded(); await tickFn(page, f); }
    expect(await granted(page)).toBe(0);
    expect((await save(page)).status()).toBe(200);
    expect(await permsOf(r.id)).toEqual({});
    await page.reload(); await page.waitForTimeout(2500);
    expect((await page.getByRole('button', { name: new RegExp(r.name) }).first().innerText()).replace(/\s+/g, ' ')).toContain('0/104');
  });
  test(tc('PRM-D04'), async ({ page }) => {
    const r = await newRole([['USER.UPDATE', 'all']]);
    await openMatrix(page, r.name);
    expect(await scopeText(page, FN.USER, 'Sửa')).toBe('Toàn hệ thống');
    await tickAct(page, FN.USER, 'Sửa'); await tickAct(page, FN.USER, 'Sửa');
    expect(await scopeText(page, FN.USER, 'Sửa')).toBe('Đơn vị và đơn vị con');
  });
  test(tc('PRM-D05'), async ({ page }) => {
    const r = await newRole([['USER.VIEW', 'unit']]);
    await openMatrix(page, r.name);
    await tickAct(page, FN.USER, 'Xem');
    expect(await granted(page)).toBe(0);
    await cancelBtn(page).click(); await page.waitForTimeout(600);
    expect(await granted(page)).toBe(1);
    expect(await isOn(actBox(page, FN.USER, 'Xem'))).toBe(true);
    expect(await scopeText(page, FN.USER, 'Xem')).toBe('Đơn vị');
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'unit' });
  });
  test(tc('PRM-D06'), async () => {
    const r = await newRole(P('USER.VIEW', 'ROLE.VIEW'));
    const x = await api('PUT', `idm/permission-matrix/roles/${r.id}`, { permissions: [] });
    expect(x.status).toBe(200);
    expect(await permsOf(r.id)).toEqual({});
    expect((await allRoles()).find(y => y.id === r.id)?.grantedCount).toBe(0);
  });
  test(tc('PRM-D07'), async ({ page }) => {
    const r = await newRole(P('USER.VIEW'));
    expect((await api('DELETE', `idm/roles/${r.id}`)).status).toBe(400);
    expect((await api('PUT', `idm/permission-matrix/roles/${r.id}`, { permissions: [] })).status).toBe(200);
    const d = await api('DELETE', `idm/roles/${r.id}`);
    expect(d.status).toBe(200); expect(d.message).toMatch(/Xóa thành công/);
    await openMatrix(page);
    await expect(rolesCards(page).filter({ has: page.getByText(r.name, { exact: true }) })).toHaveCount(0);
  });
});

// ================= BẢO MẬT =================
test.describe('Ma trận phân quyền › Bảo mật', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('PRM-S01'), async () => {
    const r = await newRole([['USER.VIEW', 'all']]);
    const calls: [string, string, any][] = [
      ['GET', 'idm/permission-matrix', undefined], ['GET', 'idm/permission-matrix/roles', undefined],
      ['GET', `idm/permission-matrix/roles/${r.id}`, undefined], ['PUT', `idm/permission-matrix/roles/${r.id}`, { permissions: [] }],
      ['GET', 'idm/permission-matrix/me', undefined],
    ];
    const bad: string[] = [];
    for (const [method, resource, body] of calls) for (const rawToken of ['', 'abc.def.ghi']) {
      const s = await apiStatus({ method, resource, body, rawToken });
      if (s !== 401) bad.push(`${method} ${resource} token="${rawToken}" → ${s}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'all' });
  });
  test(tc('PRM-S02'), async () => {
    const r = await newRole([['USER.VIEW', 'all']]);
    const res = ['idm/permission-matrix', 'idm/permission-matrix/roles', `idm/permission-matrix/roles/${r.id}`];
    const bad: string[] = [];
    for (const as of ['canbo', 'lanhdaobo', 'ldd', 'cbdp', 'ldp', 'xemonly']) {
      if (!fs.existsSync(`auth/${as}.json`)) { bad.push(`thiếu session ${as}`); continue; }
      for (const resource of res) { const s = await apiStatus({ resource, as }); if (s !== 403) bad.push(`${as} GET ${resource} → ${s} (kỳ vọng 403)`); }
      const s = await apiStatus({ method: 'PUT', resource: res[2], body: { permissions: [] }, as }); if (s !== 403) bad.push(`${as} PUT → ${s} (kỳ vọng 403)`);
      const me = await apiStatus({ resource: 'idm/permission-matrix/me', as }); if (me !== 200) bad.push(`${as} GET me → ${me} (kỳ vọng 200)`);
    }
    for (const as of ['admin', 'superadmin']) for (const resource of res) { const s = await apiStatus({ resource, as }); if (s !== 200) bad.push(`${as} GET ${resource} → ${s} (kỳ vọng 200)`); }
    expect(bad, bad.join('\n')).toEqual([]);
    expect(await permsOf(r.id)).toEqual({ 'USER.VIEW': 'all' });
  });
  test(tc('PRM-S03'), async ({ browser, baseURL }) => {
    const bad: string[] = [];
    for (const as of ['canbo', 'lanhdaobo', 'xemonly']) {
      const ctx = await browser.newContext({ storageState: `auth/${as}.json`, baseURL });
      const p = await ctx.newPage();
      await p.goto('/'); await p.waitForTimeout(2500);
      const menu = await p.locator('body').innerText();
      if (/Ma trận phân quyền/.test(menu)) bad.push(`${as}: menu vẫn có "Ma trận phân quyền"`);
      await goto(p, ROUTE); await p.waitForTimeout(1500);
      const body = await p.locator('body').innerText();
      if (/NHÓM NGƯỜI DÙNG|CHỨC NĂNG \/ QUYỀN/.test(body)) bad.push(`${as}: URL trực tiếp vẫn hiển thị ma trận`);
      await ctx.close();
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ================= HIỆU NĂNG =================
test.describe('Ma trận phân quyền › Hiệu năng', () => {
  test(tc('PRM-P01'), async ({ page }) => {
    const t0 = Date.now();
    await page.goto(`/#/vi/${ROUTE}`);
    await page.locator('input[type=radio][aria-label^="Cấp tất cả quyền của"]').first().waitFor({ state: 'attached', timeout: 15_000 });
    await rolesCards(page).first().waitFor({ state: 'visible', timeout: 15_000 });
    const ms = Date.now() - t0;
    expect(ms, `mở trang mất ${ms} ms`).toBeLessThan(3000);
  });
  test(tc('PRM-P02'), async () => {
    const r = await newRole();
    const cat = await catalog();
    const perms: Perm[] = cat.modules.flatMap((m: any) => m.functions.flatMap((f: any) => f.actions.map((a: any) => [a.code, a.scopes.at(-1)] as Perm)));
    expect(perms.length).toBe(TOTAL);
    const t0 = Date.now();
    const x = await api('PUT', `idm/permission-matrix/roles/${r.id}`, { permissions: perms.map(([code, scope]) => ({ code, scope })) });
    const ms = Date.now() - t0;
    expect(x.status).toBe(200);
    expect(ms, `lưu 104 quyền mất ${ms} ms`).toBeLessThan(3000);
  });
});

// ================= EDGE / LỖI =================
test.describe('Ma trận phân quyền › Edge / Lỗi', () => {
  test.describe.configure({ timeout: 90_000 });
  test(tc('PRM-G01'), async ({ page }) => {
    await page.route('**/idm/permission-matrix', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await goto(page, ROUTE);
    await page.getByText('NHÓM NGƯỜI DÙNG').first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1500);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(body, 'phải có thông báo lỗi tải danh mục').toContain('Không tải được danh mục quyền. Vui lòng thử lại.');
    expect(body).not.toMatch(/Exception|StackTrace/i);
  });
  test(tc('PRM-G02'), async ({ page }) => {
    const before = (await allRoles()).length;
    await page.route('**/permission-matrix/roles', r => r.abort('internetdisconnected'));
    await goto(page, ROUTE);
    await expect(page.getByText('Không tải được danh sách nhóm người dùng. Vui lòng thử lại.')).toBeVisible({ timeout: 15_000 });
    await page.unroute('**/permission-matrix/roles');
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(rolesCards(page).first()).toBeVisible({ timeout: 15_000 });
    expect(await rolesCards(page).count()).toBeGreaterThanOrEqual(before);
  });
  test(tc('PRM-G03'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickMany(page, [[FN.USER, 'Xem'], [FN.USER, 'Thêm']]);
    await page.route('**/permission-matrix/roles/*', rt => rt.request().method() === 'PUT' ? rt.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Internal error stack at x.y"}' }) : rt.continue());
    await saveBtn(page).click(); await page.waitForTimeout(1500);
    const notice = (await page.locator('.ant-message-notice, .ant-notification-notice, [role=alert]').allInnerTexts()).join(' ').trim();
    expect(notice, 'phải có thông báo lỗi sau khi Lưu thất bại').not.toBe('');
    expect(await granted(page), 'thay đổi đã chọn phải được giữ').toBe(2);
    await expect(saveBtn(page), 'phải bấm Lưu lại được để thử lại').toBeEnabled();
    expect(await permsOf(r.id)).toEqual({});
  });
  test(tc('PRM-G04'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickMany(page, [[FN.USER, 'Xem'], [FN.USER, 'Thêm']]);
    await page.route('**/permission-matrix/roles/*', rt => rt.request().method() === 'PUT' ? rt.abort('internetdisconnected') : rt.continue());
    await saveBtn(page).click();
    await expect(page.getByText('Không lưu được quyền. Các thay đổi vẫn được giữ, vui lòng thử lại.').first()).toBeVisible({ timeout: 10_000 });
    expect(await granted(page)).toBe(2);
    await expect(saveBtn(page)).toBeEnabled();
    expect(await permsOf(r.id)).toEqual({});
  });
  test(tc('PRM-G05'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickMany(page, [[FN.USER, 'Xem'], [FN.USER, 'Thêm'], [FN.USER, 'Sửa']]);
    let puts = 0; page.on('request', q => { if (q.method() === 'PUT' && /permission-matrix\/roles\//.test(q.url())) puts++; });
    await saveBtn(page).dblclick({ delay: 20 }).catch(() => {});
    await page.waitForTimeout(2500);
    expect(puts).toBeGreaterThanOrEqual(1);
    expect(Object.keys(await permsOf(r.id)).sort()).toEqual(['USER.CREATE', 'USER.UPDATE', 'USER.VIEW']);
    const body = (await page.locator('.ant-message-notice, .ant-notification-notice, [role=alert]').allInnerTexts()).join(' ');
    expect(body).not.toMatch(/lỗi|không lưu được/i);
  });
  test(tc('PRM-G06'), async ({ page }) => {
    const name = `qc.automation <b>"x"</b> & 'y' ${code8()}`;
    const r = await newRole([], { name });
    let dialog = '';
    page.on('dialog', d => { dialog = d.message(); d.dismiss().catch(() => {}); });
    await openMatrix(page);
    const card = rolesCards(page).filter({ hasText: r.code }).first();
    await expect(card).toBeVisible();
    expect(await card.innerText()).toContain(`<b>"x"</b> & 'y'`);
    expect(await card.locator('b').count(), 'không được render thẻ <b>').toBe(0);
    await card.click(); await page.waitForTimeout(1000);
    expect((await panelHeader(page).innerText())).toContain(`<b>"x"</b>`);
    expect(dialog).toBe('');
  });
  test(tc('PRM-G07'), async ({ page }) => {
    const r = await newRole();
    await openMatrix(page, r.name);
    await tickAct(page, FN.USER, 'Xem');
    expect((await api('DELETE', `idm/roles/${r.id}`)).status).toBe(200);
    const res = await save(page);
    expect(res.status()).toBe(404);
    await page.waitForTimeout(800);
    const msg = (await page.locator('.ant-message-notice, .ant-notification-notice, [role=alert]').allInnerTexts()).join(' ') + ' ' + (await page.locator('body').innerText());
    expect(msg).toMatch(/không tồn tại|không lưu được|lỗi/i);
    expect(msg).not.toMatch(/thành công/i);
  });
});
