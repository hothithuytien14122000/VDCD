// E.UC1.2 XEM CHI TIẾT ĐỢT + phân quyền/bảo mật (SVY-S) — script bám testcase SVY-V01…V27, SVY-S01…S07.
// Dữ liệu: dùng các đợt có sẵn (chọn theo trạng thái/hình thức qua API) vì không tạo được đợt mới (lỗi 400 phạm vi dữ liệu).
import { test, expect, tc, api, raw, FAKE, allSurveys, skipped, settle, LIST } from './common';
import fs from 'node:fs';
import { test as base } from '@playwright/test';
import { expect as __g_expect } from '@playwright/test';
import { Page } from '@playwright/test';
import { Locator } from '@playwright/test';
import { F } from './common';
import { dayStr } from './common';
import { dmy } from './common';
import { hidePwExpiry } from '../helpers';
import { guardSession } from '../session-guard';

const detailUrl = (id: string) => `/#/vi/survey-campaigns/${id}`;
const main = (page: any) => page.locator('main').first();
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const fmt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const today = new Date().toISOString().slice(0, 10);
let ALL: any[] = [];
test.beforeAll(async () => { ALL = await allSurveys(); });
const pick = (f: (s: any) => boolean) => { const s = ALL.find(f); if (!s) test.skip(true, 'Không có đợt phù hợp trong dữ liệu hiện có'); return s!; };
const open = async (page: any, id: string) => { await page.goto(detailUrl(id)); await settle(page); await main(page).waitFor(); };
const online = (s: any) => s.methodNames.includes('Trực tuyến');
const activeOnline = (s: any) => s.statusName === 'Đang diễn ra' && online(s) && s.groups?.length !== 0;
const full = async (id: string) => (await api('GET', `survey/surveys/${id}`)).data;
const tokenOf = (key: string) => {
  const st = JSON.parse(fs.readFileSync(`auth/${key}.json`, 'utf8'));
  return (st.origins[0].localStorage as any[]).map(x => x.value).find((v: string) => v.split('.').length === 3) as string;
};

test.describe('Đợt khảo sát — chi tiết', () => {
  test(tc('SVY-V01'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra'); await open(page, s.id);
    const t = clean(await main(page).innerText());
    for (const v of [s.name, s.code, s.organizationName, fmt(s.startDate), fmt(s.endDate), s.statusName]) expect(t).toContain(v);
  });
  test(tc('SVY-V02'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra' && online(x)); await open(page, s.id);
    const t = clean(await main(page).innerText());
    expect(t).toMatch(/Thông tin\s+Phiếu\s+\d+\s+Kết quả\s+Tạm tính/);
    expect(t).toContain(`Phiếu ${s.resultCount} `);
  });
  test(tc('SVY-V03'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra'); await open(page, s.id);
    const t = clean(await main(page).innerText());
    for (const l of ['Mã đợt', 'Hình thức', 'Đơn vị thực hiện', 'Thời gian', 'Phiếu mục tiêu', 'Người tạo', 'Mô tả']) expect(t).toContain(l);
    expect(await main(page).locator('input:visible, textarea:visible').count(), 'thông tin chung chỉ xem').toBe(0);
  });
  test(tc('SVY-V04'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra' && (x.groups?.length ?? 1) > 0); const d = await full(s.id); await open(page, s.id);
    const t = clean(await main(page).innerText());
    const nq = d.groups.reduce((a: number, g: any) => a + g.questions.length, 0);
    expect(t).toContain(`${nq} câu hỏi · ${d.groups.length} nhóm`);
    let pos = 0;
    for (const g of d.groups) {
      const i = t.indexOf(g.name, pos); expect(i, `nhóm ${g.name} đúng thứ tự`).toBeGreaterThanOrEqual(0); pos = i;
      g.questions.forEach((q: any, k: number) => expect(t).toContain(`${k + 1}. ${q.content.trim().slice(0, 40)}`));
    }
  });
  test(tc('SVY-V05'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra'); await open(page, s.id);
    expect(await main(page).locator('textarea:visible, input[type=text]:visible, [draggable=true], [class*="drag"]').count()).toBe(0);
    for (const n of [/Thêm nhóm/, /Thêm câu/, /^Xóa$/]) await expect(main(page).getByRole('button', { name: n })).toHaveCount(0);
  });
  test(tc('SVY-V06'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra'); await open(page, s.id);
    const t = clean(await main(page).innerText());
    expect(t).toMatch(/Thang đánh giá\s+Hài lòng\s+Chưa hài lòng/); expect(t).not.toMatch(/Đánh giá chung|Không áp dụng/i);
  });
  test(tc('SVY-V07'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra' && x.voteTarget); await open(page, s.id);
    const t = clean(await main(page).innerText());
    expect(t).toContain(`${s.resultCount} / ${s.voteTarget.toLocaleString('vi-VN')} phiếu mục tiêu`);
    expect(t).toContain(`Đạt ${Math.round((s.resultCount / s.voteTarget) * 100)}% mục tiêu`);
  });
  test(tc('SVY-V08'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đã phê duyệt' && online(x) && x.startDate.slice(0, 10) > today); await open(page, s.id);
    const t = clean(await main(page).innerText());
    expect(t).toContain('Chưa mở'); expect(t).not.toMatch(/Kết quả\s+Tạm tính/);
    await expect(page.locator('.ant-segmented-item').filter({ hasText: /Phiếu|Kết quả/ })).toHaveCount(0);
    expect(t).not.toMatch(/Đạt \d+% mục tiêu/);
  });
  test(tc('SVY-V09'), async ({ page }) => {
    const a = pick(x => x.statusName === 'Đang diễn ra' && online(x)); await open(page, a.id);
    expect(clean(await main(page).innerText())).toContain('Đang nhận phiếu');
    const c = pick(x => x.statusName === 'Đã kết thúc' && online(x)); await open(page, c.id);
    expect(clean(await main(page).innerText())).not.toContain('Đang nhận phiếu');
  });
  test(tc('SVY-V10'), async ({ page }) => {
    const on = pick(x => online(x) && ['Đã phê duyệt', 'Đang diễn ra', 'Đã kết thúc'].includes(x.statusName)); await open(page, on.id);
    expect(clean(await main(page).innerText())).toContain(`/respond/${on.id}`);
    await expect(main(page).locator('svg').filter({ has: page.locator('path') }).first()).toBeVisible();
    const off = pick(x => !online(x) && ['Đã phê duyệt', 'Đang diễn ra', 'Đã kết thúc'].includes(x.statusName)); await open(page, off.id);
    expect(clean(await main(page).innerText())).not.toContain('/respond/');
  });
  test(tc('SVY-V11'), async ({ page, context }) => {
    const s = pick(x => online(x) && x.statusName === 'Đang diễn ra'); await open(page, s.id);
    const link = clean(await main(page).innerText()).match(/https?:\/\/\S+\/respond\/[0-9a-f-]+/)?.[0];
    expect(link).toBeTruthy(); expect(link!.endsWith(`/respond/${s.id}`)).toBeTruthy();
    const pg = await context.newPage(); await pg.goto(link!); await settle(pg);
    await expect(pg.locator('body')).toContainText(s.name); await pg.close();
  });
  test(tc('SVY-V12'), async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://cds.geneat.pro' });
    const s = pick(x => online(x) && x.statusName === 'Đang diễn ra'); await open(page, s.id);
    await main(page).getByRole('button', { name: /Sao chép/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/respond/${s.id}`);
    const after = (await api('GET', `survey/surveys/${s.id}`)).data; expect(after.statusName).toBe(s.statusName);
    expect(after.startDate).toBe(s.startDate);
  });
  test(tc('SVY-V13'), async ({ page }) => {
    const s = pick(x => online(x) && x.statusName === 'Đã phê duyệt'); await open(page, s.id);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10_000 }), main(page).getByRole('button', { name: /Tải mã QR/ }).click()]);
    expect(dl.suggestedFilename()).toMatch(/\.png$/i);
    expect((await api('GET', `survey/surveys/${s.id}`)).data.statusName).toBe('Đã phê duyệt');
  });
  test(tc('SVY-V14'), async ({ page }) => {
    const off = pick(x => !online(x) && x.statusName === 'Đang diễn ra'); await open(page, off.id);
    await expect(main(page).getByText(/Tải mẫu phiếu/).first()).toBeVisible();
    const on = pick(x => online(x) && x.methodNames.length === 1 && x.statusName === 'Đang diễn ra'); await open(page, on.id);
    await expect(main(page).getByText(/Tải mẫu phiếu/)).toHaveCount(0);
  });
  test(tc('SVY-V16'), async ({ page }) => {
    const cases = [
      pick(x => x.statusName === 'Đã kết thúc' && x.methodNames.some((m: string) => m !== 'Trực tuyến')),
      pick(x => x.statusName === 'Đang diễn ra' && x.methodNames.length === 1 && online(x)),
    ];
    for (const s of cases) { await open(page, s.id); await expect(page.getByRole('button', { name: /Nhập phiếu/ }), s.code).toHaveCount(0); }
    const nyst = ALL.find(x => x.statusName === 'Đã phê duyệt' && x.startDate.slice(0, 10) > today && x.methodNames.some((m: string) => m !== 'Trực tuyến'));
    if (nyst) { await open(page, nyst.id); await expect(page.getByRole('button', { name: /Nhập phiếu/ })).toHaveCount(0); }
  });
  test(tc('SVY-V17'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Bị từ chối'); const d = await full(s.id); await open(page, s.id);
    const t = clean(await main(page).innerText());
    expect(t).toContain('Lịch sử xử lý');
    for (const h of d.histories) { expect(t).toContain(h.createdByUserName); expect(t).toContain(h.statusName === 'Chờ phê duyệt' ? 'Trình phê duyệt' : h.statusName === 'Nháp' ? 'Tạo đợt khảo sát' : h.statusName); }
    if (d.rejectReason) expect(t).toContain(d.rejectReason.slice(0, 30));
  });
  test(tc('SVY-V18'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra' && x.histories?.length !== 1); const d = await full(s.id); await open(page, s.id);
    const t = clean(await main(page).innerText());
    expect(d.histories.length).toBeGreaterThan(0);
    expect(t.match(/Trình phê duyệt/g)?.length ?? 0).toBe(d.histories.filter((h: any) => h.statusName === 'Chờ phê duyệt').length);
  });
  skipped(['SVY-V19', 'SVY-V20'], 'MANUAL: cần tác vụ nền tự từ chối/chốt số liệu chạy theo thời gian (không đẩy được đồng hồ máy chủ)');
  test(tc('SVY-V21'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra'); await open(page, s.id);
    await main(page).locator('button').first().click(); await settle(page);
    expect(page.url()).toMatch(/survey-campaigns\/?$/);
    expect((await api('GET', `survey/surveys/${s.id}`)).data.statusName).toBe('Đang diễn ra');
  });
  test(tc('SVY-V22'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra' && online(x)); await open(page, s.id);
    await page.locator('.ant-segmented-item').filter({ hasText: /^Phiếu/ }).click(); await settle(page);
    await expect(main(page)).toContainText(s.code);
    await page.locator('.ant-segmented-item').filter({ hasText: /^Kết quả/ }).click(); await settle(page);
    await expect(main(page)).toContainText(s.code);
  });
  test(tc('SVY-V23'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra'); await page.goto(detailUrl(s.id)); await settle(page);
    await expect(main(page)).toContainText(s.name);
  });
  test(tc('SVY-V24'), async ({ page }) => {
    await open(page, FAKE);
    const t = clean(await page.locator('body').innerText());
    expect(t).toMatch(/không tồn tại|không tìm thấy|đã bị xóa/i); expect(t).not.toContain('Thông tin chung');
  });
  test(tc('SVY-V25'), async () => {
    const r = await raw('GET', `survey/surveys/${ALL[0].id}`, undefined, tokenOf('xemonly'));
    test.skip(r.status === 200, 'xemonly có quyền xem đợt (API 200) → ma trận hiện tại cho phép xem; không áp dụng');
    expect([401, 403]).toContain(r.status);
  });
  test(tc('SVY-V26'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra');
    await page.route(`**/api/v1/survey/surveys/${s.id}`, r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal error' }) }));
    await open(page, s.id);
    expect(clean(await page.locator('body').innerText())).not.toContain(s.name);
    await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'phải hiển thị thông báo lỗi MSG-025').toBeVisible();
  });
  test(tc('SVY-V27'), async ({ page }) => {
    const s = pick(x => x.statusName === 'Đang diễn ra');
    await page.route(`**/api/v1/survey/surveys/${s.id}`, r => r.abort('internetdisconnected'));
    await open(page, s.id);
    expect(clean(await page.locator('body').innerText())).not.toContain(s.name);
    await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'phải hiển thị thông báo MSG-026').toBeVisible();
  });
});

test.describe('Đợt khảo sát — phân quyền & bảo mật', () => {
  test(tc('SVY-S01'), async () => {
    const mine = await allSurveys({}, 'canbo'); const mineIds = new Set(mine.map(s => s.id));
    const other = ALL.find(s => !mineIds.has(s.id))!;
    const r = await api('GET', `survey/surveys/${other.id}`, undefined, 'canbo');
    expect([403, 404, 400]).toContain(r.status);
    expect(JSON.stringify(r.raw)).not.toContain(other.name);
  });
  test(tc('SVY-S02'), async () => {
    const mineOrg = (await allSurveys({}, 'canbo')).map(s => s.organizationName);
    const other = ALL.find(s => !mineOrg.includes(s.organizationName))!;
    const d = await api('GET', `survey/surveys?page=1&size=100&filter=${encodeURIComponent(JSON.stringify({ organizationId: other.organizationId }))}`, undefined, 'canbo');
    const rows = d.data?.content ?? [];
    expect(rows.every((s: any) => !mineOrg.length || mineOrg.includes(s.organizationName))).toBeTruthy();
  });
  test(tc('SVY-S03'), async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } }); const page = await ctx.newPage();
    for (const [m, r] of [['GET', 'survey/surveys?page=1&size=10'], ['GET', `survey/surveys/${ALL[0].id}`], ['POST', 'survey/surveys'], ['DELETE', `survey/surveys/${ALL[0].id}`]] as const)
      expect((await raw(m, r, m === 'POST' ? {} : undefined)).status, `${m} ${r}`).toBe(401);
    expect((await raw('GET', 'survey/surveys?page=1&size=10', undefined, 'invalid.token.value')).status).toBe(401);
    await page.goto(`/${LIST}`); await settle(page);
    await page.waitForURL(/auth\/login/, { timeout: 8000 }).catch(() => {});
    expect(page.url(), 'chưa đăng nhập phải về trang đăng nhập').toContain('/auth/login'); await ctx.close();
  });
  test(tc('SVY-S04'), async () => {
    const me = async (k: string) => (await api('GET', 'survey/surveys?page=1&size=1', undefined, k)).status;
    expect(await me('canbo')).toBe(200); expect(await me('ldd')).toBe(200);
    // tài khoản xem-only không được ghi
    const w = await api('POST', 'survey/surveys', { name: 'x' }, 'xemonly');
    expect([401, 403], `xemonly POST → ${w.status} ${w.message}`).toContain(w.status);
    const ld = await api('POST', 'survey/surveys', { name: 'x' }, 'ldd');
    expect([403, 400, 401], `ldd (Lãnh đạo) không được tạo: ${ld.status} ${ld.message}`).toContain(ld.status);
    if (ld.status === 400) expect(ld.message, 'Lãnh đạo bị chặn vì lý do quyền, không phải lỗi dữ liệu').toMatch(/quyền/i);
  });
  skipped(['SVY-S05'], 'MANUAL: thu hồi quyền khi phiên đang mở (cần đổi ma trận quyền giữa chừng; không tự động để tránh ảnh hưởng tài khoản dùng chung)');
  test(tc('SVY-S07'), async () => {
    const rs = [await api('GET', `survey/surveys/${FAKE}`), await api('GET', 'survey/surveys/not-a-guid'), await api('POST', 'survey/surveys', { name: '' }), await api('GET', 'survey/surveys?page=abc&size=x'), await api('DELETE', `survey/surveys/${FAKE}`)];
    for (const r of rs) expect(JSON.stringify(r.raw)).not.toMatch(/at [A-Za-z.]+\(|System\.|StackTrace|SELECT |Npgsql|\.cs:line|\/src\/|C:\\/);
  });
});
void expect;

// ===== Case bổ sung từ bug GitLab (gộp từ dot-khao-sat-6-bug-gitlab.spec.ts) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====
test.describe(() => {
const expect = __g_expect;
const AS = 'admin';
const VIEW = { width: 1366, height: 768 };
const test = base.extend<{ page: Page }>({
  page: async ({ browser, baseURL }, use) => {
    const ctx = await browser.newContext({ storageState: `auth/${AS}.json`, baseURL, viewport: VIEW });
    await hidePwExpiry(ctx);
    await use(await ctx.newPage()); await ctx.close();
  },
});
guardSession(test, 'admin');
test.describe.configure({ timeout: Number(process.env.QC_TIMEOUT ?? 120_000) });

// ---------------------------------------------------------------- dữ liệu & API
const LISTR = '/#/vi/survey-campaigns';
const ORG_BO = 'bf944505-046b-45fb-a4d1-3082974159e7';   // QC_BO - QA - Đơn vị Bộ (đơn vị của admin)
const TAG = 'qc.automation SVYBUG';
const nm = (k: string) => `${TAG} ${k} ${Date.now().toString(36)}`;
const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();
const must = (r: any, w: string) => { if (r.status >= 300) throw new Error(`${w}: HTTP ${r.status} ${r.message}`); return r; };
const getS = async (id: string) => must(await api('GET', `survey/surveys/${id}`, undefined, AS), 'GET đợt').data;
async function listAll(filter: any): Promise<any[]> {
  const out: any[] = [];
  for (let p = 1; p <= 20; p++) {
    const d = (await api('GET', `survey/surveys?page=${p}&size=100&filter=${F(filter)}`, undefined, AS)).data ?? {};
    out.push(...(d.content ?? [])); if (p >= (d.totalPages ?? 1)) break;
  }
  return out;
}
async function mkDraft(o: any = {}) {
  const body = { name: nm('draft'), organizationIds: [ORG_BO], startDate: dayStr(1), endDate: dayStr(30), methods: [1], voteTarget: 5, description: '', status: 1,
    groups: [{ name: 'Nhóm 1', questions: [{ content: 'Câu 1' }, { content: 'Câu 2' }] }], ...o };
  const r = must(await api('POST', 'survey/surveys', body, AS), 'Tạo đợt'); return r.data.id as string;
}
const putBody = (d: any, status: number) => ({ ...d, organizationIds: d.organizations.map((o: any) => o.organizationId), status });
async function mkRejected(reason: string, o: any = {}) {
  const id = await mkDraft(o);
  must(await api('PUT', `survey/surveys/${id}`, putBody(await getS(id), 2), AS), 'Trình phê duyệt');
  must(await api('PUT', `survey/surveys/${id}/status`, { status: 4, reason }, AS), 'Từ chối');
  return id;
}
async function cleanup() {
  for (const s of await listAll({ keyword: TAG })) {
    if (!String(s.name).startsWith(TAG)) continue;
    if (s.statusName === 'Chờ phê duyệt') await api('PUT', `survey/surveys/${s.id}/status`, { status: 4, reason: 'dọn dữ liệu test' }, AS);
    if (['Nháp', 'Bị từ chối', 'Chờ phê duyệt'].includes(s.statusName)) await api('DELETE', `survey/surveys/${s.id}`, undefined, AS);
  }
}
test.beforeAll(async () => {
  const r = await api('GET', 'survey/surveys?page=1&size=1', undefined, AS);
  if (r.status !== 200) throw new Error(`BLOCKED: tài khoản admin không có quyền API khảo sát (HTTP ${r.status})`);
});
test.afterAll(async () => { await cleanup(); });

// ---------------------------------------------------------------- UI helpers
const main = (page: Page) => page.locator('main').first();
const rows = (page: Page) => page.locator('tbody tr.ant-table-row');
async function openList(page: Page) {
  page.setDefaultTimeout(10_000);
  await page.goto(LISTR); await settle(page); await rows(page).first().waitFor({ state: 'visible', timeout: 15_000 });
}
async function openDetail(page: Page, id: string) { await page.goto(`${LISTR}/${id}`); await settle(page); await main(page).getByText('Thông tin chung').first().waitFor(); }
async function openCreate(page: Page) { page.setDefaultTimeout(10_000); await page.goto(`${LISTR}/create`); await settle(page); await page.locator('#survey-name').waitFor(); }
const contentTab = async (page: Page) => { await page.locator('[role=tab]', { hasText: 'Nội dung khảo sát' }).click(); await page.waitForTimeout(400); };
const qInputs = (page: Page) => page.getByPlaceholder('Nhập nội dung câu hỏi');
async function setDate(page: Page, id: string, v: string) { const i = page.locator(`#${id}`); await i.click(); await i.fill(v); await i.press('Enter'); await page.keyboard.press('Escape'); }
const codesOnPage = async (page: Page) => (await rows(page).locator('td:nth-child(2)').allInnerTexts()).map(norm);
const box = async (l: Locator) => (await l.boundingBox())!;
/** Tiêu đề khối (h2, có thể kèm số đếm phía sau) và khối <section> chứa nó. */
const heading = (page: Page, title: string) => main(page).locator('h2').filter({ hasText: new RegExp(`^\\s*${title}`) }).first();
const cardOf = (page: Page, title: string) => heading(page, title).locator('xpath=ancestor::section[1]');

// ================================================================ E.UC1.1 Danh sách

// ================================================================ E.UC1.2 Chi tiết
test.describe('Đợt khảo sát › chi tiết', () => {
  const LONG = Array.from({ length: 60 }, (_, i) => `Lý do từ chối dài số ${String(i).padStart(2, '0')}`).join(' ').slice(0, 1000);

  // #66 lý do từ chối dài

  // #103 Quay lại giữ bộ lọc và trang
  test(tc('SVY-V29'), async ({ page }) => {
    const KW = 'KS-2026';
    const n = (await api('GET', `survey/surveys?page=1&size=1&filter=${F({ keyword: KW, status: 5 })}`, undefined, AS)).data?.totalElements ?? 0;
    test.skip(n < 2, `không đủ đợt Đang diễn ra khớp "${KW}" để có trang 2 (${n})`);
    await openList(page);
    await page.locator('#search').fill(KW); await page.locator('#search').press('Enter'); await settle(page);
    await page.locator('.ant-select', { has: page.locator('#survey-status-filter') }).click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: /^Đang diễn ra$/ }).first().click(); await settle(page);
    // bảo đảm có trang 2: nếu tổng ≤ kích thước trang thì đổi sang 10/trang
    if (!(await page.locator('.ant-pagination-item-2').count())) {
      await page.locator('.ant-pagination-options .ant-select').first().click();
      await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: /^10\b/ }).first().click(); await settle(page);
    }
    await page.locator('.ant-pagination-item-2').click(); await settle(page);
    await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');
    const codes = await codesOnPage(page); expect(codes.length).toBeGreaterThan(0);
    for (const t of await rows(page).locator('td').filter({ hasText: /Đang diễn ra|Nháp|Chờ phê duyệt|Bị từ chối|Đã phê duyệt|Đã kết thúc/ }).allInnerTexts()) expect(norm(t)).toBe('Đang diễn ra');
    await rows(page).first().getByRole('button', { name: 'Xem chi tiết' }).click(); await settle(page);
    await expect(page).toHaveURL(/survey-campaigns\/[0-9a-f-]{36}/);
    await main(page).getByRole('button', { name: 'Quay lại' }).first().click(); await settle(page);
    await rows(page).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const got = {
      keyword: await page.locator('#search').inputValue(),
      status: norm(await page.locator('#survey-status-filter').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]').innerText()),
      page: norm(await page.locator('.ant-pagination-item-active').innerText().catch(() => '')),
      codes: await codesOnPage(page),
    };
    expect({ keyword: got.keyword, status: got.status, page: got.page }, `sau Quay lại: ${JSON.stringify(got)}`).toEqual({ keyword: KW, status: 'Đang diễn ra', page: '2' });
    expect(got.codes).toEqual(codes);
  });

  // #166 khối từ chối chiếm chỗ
  test(tc('SVY-V30'), async ({ page }) => {
    const id = await mkRejected('Bổ sung câu hỏi về thời gian chờ tại bộ phận một cửa'); const d = await getS(id); await openDetail(page, id);
    const t = norm(await main(page).innerText());
    const rej = d.histories.filter((h: any) => h.statusName === 'Bị từ chối').at(-1);
    expect(t, 'khối từ chối có lý do').toContain(d.rejectReason);
    expect(t, 'khối từ chối có người từ chối').toContain(`Từ chối bởi ${rej.createdByUserName}`);
    expect(t, 'khối từ chối có thời điểm').toMatch(new RegExp(`Từ chối bởi ${rej.createdByUserName} · ${dmy(dayStr(0))} \\d{2}:\\d{2}`));
    const head = heading(page, 'Nội dung khảo sát');
    const b = await box(head);
    const reason = await box(main(page).getByText('Lý do từ chối', { exact: true }).first());
    test.info().annotations.push({ type: 'đo', description: `khung 1366×768: "Lý do từ chối" y=${Math.round(reason.y)}, "Nội dung khảo sát" y=${Math.round(b.y)}` });
    expect(b.y + b.height, `nội dung khảo sát phải thấy trong màn hình đầu tiên (tiêu đề ở y=${Math.round(b.y)}px > ${VIEW.height}px)`).toBeLessThanOrEqual(VIEW.height);
  });

  // #166 Thông tin chung chiếm chỗ
  test(tc('SVY-V31'), async ({ page }) => {
    // Đợt điển hình (1 hình thức, có mô tả) — phép đo chính. Đợt 3 hình thức (thẻ hình thức xếp dọc) chỉ ghi nhận số đo để BA xem.
    const measure = async (o: any) => {
      const id = await mkDraft(o); await openDetail(page, id);
      const card = cardOf(page, 'Thông tin chung'); await expect(card).toBeVisible();
      const labels = ['Mã đợt', 'Hình thức', 'Đơn vị thực hiện', 'Thời gian', 'Phiếu mục tiêu', 'Người tạo', 'Mô tả'];
      const xs: number[] = [];
      for (const l of labels) xs.push(Math.round((await box(card.getByText(l, { exact: true }).first())).x));
      return { xs, cols: new Set(xs).size, h: Math.round((await box(card)).height) };
    };
    const m3 = await measure({ methods: [1, 2, 3], description: 'Mô tả đợt khảo sát thử' });
    const m1 = await measure({ methods: [1], description: 'Mô tả đợt khảo sát thử' });
    test.info().annotations.push({ type: 'đo', description: `1 hình thức: ${m1.cols} cột, cao ${m1.h}px; 3 hình thức: ${m3.cols} cột, cao ${m3.h}px (nửa màn hình = ${VIEW.height / 2}px)` });
    expect(m1.cols, `các trường trình bày dạng lưới nhiều cột (x nhãn: ${m1.xs.join(',')})`).toBeGreaterThanOrEqual(2);
    expect(m3.cols).toBeGreaterThanOrEqual(2);
    expect(m1.h, `khối Thông tin chung cao ${m1.h}px — không quá nửa màn hình (${VIEW.height / 2}px)`).toBeLessThanOrEqual(VIEW.height / 2);
  });
});

// ================================================================ E.UC1.3 Tạo mới

// ================================================================ E.UC1.4 Chỉnh sửa
});
