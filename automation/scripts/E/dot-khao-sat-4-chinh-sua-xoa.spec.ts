// E.UC1.4 CHỈNH SỬA + E.UC1.5 XÓA ĐỢT KHẢO SÁT — script bám testcase SVY-E01…E30, SVY-D01…D15.
// Dữ liệu: mỗi test tự tạo đợt Nháp/Bị từ chối qua API (superadmin, đơn vị aaaaaa) và dọn sau; đợt đã duyệt dùng fixture cố định (không xóa được).
import type { Page } from '@playwright/test';
import { test, expect, tc, api, skipped, settle, mk, payload, rmSurvey, cleanMade, allSurveys, getSurvey, setStatus, dayStr, NAME, LIST, openList, search, total, rowMenu, confirmBtn, modal, toastText, dataRows, FAKE, fixture } from './common';
import { test as base } from '@playwright/test';
import { expect as __g_expect } from '@playwright/test';
import { Locator } from '@playwright/test';
import { F } from './common';
import { dmy } from './common';
import { hidePwExpiry } from '../helpers';
import { guardSession } from '../session-guard';

test.afterEach(async () => { await cleanMade(); });
const edit = (id: string) => `/${LIST}/${id}/edit`;
// API mới nhận organizationIds (mảng); body lấy từ GET chỉ có organizations → bổ sung
const put = (id: string, o: any, as = 'admin') => api('PUT', `survey/surveys/${id}`, { ...o, organizationIds: o.organizationIds ?? o.organizations?.map((x: any) => x.organizationId) ?? (o.organizationId ? [o.organizationId] : undefined) }, as);
const count = async () => (await allSurveys()).length;
const body = async (page: Page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
/** Dựng body PUT từ đợt hiện tại (như UI) + chỉnh sửa. */
async function putOf(id: string, mod: (o: any) => void, as = 'admin') {
  const g = await getSurvey(id); const o: any = { ...g, status: 1, groups: g.groups.map((x: any) => ({ ...x, questions: x.questions.map((q: any) => ({ ...q })) })) }; mod(o); return put(id, o, as);
}
async function draft(o: any = {}) { const r = await mk(o); expect(r.status, r.message).toBe(200); return r.data as { id: string; code: string }; }
const submit = async (id: string) => put(id, { ...(await getSurvey(id)), status: 2 });
async function rejected(o: any = {}) { const d = await draft(o); expect((await submit(d.id)).status).toBe(200); expect((await setStatus(d.id, 4, 'Lý do từ chối thử')).status).toBe(200); return d; }
const openEdit = async (page: Page, id: string) => { page.setDefaultTimeout(8000); await page.goto(edit(id)); await settle(page); };

test.describe('Đợt khảo sát — chỉnh sửa', () => {
  test(tc('SVY-E04'), async () => {
    for (const st of ['Đã phê duyệt', 'Đang diễn ra']) {
      const s = await fixture(st === 'Đã phê duyệt' ? 'APPROVED' : 'ACTIVE', {}, st as any); const before = await getSurvey(s.id);
      for (const mod of [(o: any) => { o.name = 'hack'; }, (o: any) => { o.startDate = dayStr(2); }, (o: any) => { o.groups = [{ name: 'hack', questions: [{ content: 'hack' }] }]; }]) {
        const r = await putOf(s.id, mod); expect(r.status, `${st}: ${r.message}`).toBeGreaterThanOrEqual(400);
      }
      const after = await getSurvey(s.id); expect(after.name).toBe(before.name); expect(after.groups).toEqual(before.groups);
    }
    const ended = (await allSurveys()).find(s => s.statusName === 'Đã kết thúc')!; const r = await putOf(ended.id, o => { o.name = 'hack'; }); expect(r.status).toBeGreaterThanOrEqual(400);
  });
  test(tc('SVY-E05'), async ({ page }) => {
    const d = await draft(); await openEdit(page, d.id); const nn = `${NAME} E05 đổi ${Date.now()}`; await page.locator('#survey-name').fill(nn);
    await page.locator('#survey-save-draft-btn').click(); await settle(page);
    const g = await getSurvey(d.id); expect(g.name).toBe(nn); expect(g.statusName).toBe('Nháp'); expect(g.code).toBe(d.code); expect(page.url()).toMatch(/survey-campaigns\/[0-9a-f-]{36}$/);
  });
  test(tc('SVY-E06'), async () => {
    const d = await rejected(); const r = await putOf(d.id, o => { o.name = `${NAME} E06`; });
    expect(r.status, `${r.status} ${r.message}`).toBe(200); const g = await getSurvey(d.id);
    expect(g.statusName, 'Sau lưu vẫn Bị từ chối').toBe('Bị từ chối'); expect(g.histories.some((h: any) => h.statusName === 'Bị từ chối')).toBeTruthy();
  });
  test(tc('SVY-E07'), async () => {
    const d = await draft(); const g0 = await getSurvey(d.id);
    await putOf(d.id, o => { o.code = 'KS-HACK'; o.organizationId = '0d39632f-fa83-45d0-8a6f-aa0196fc1e96'; });
    const g = await getSurvey(d.id); expect(g.code).toBe(g0.code); expect(g.organizationId).toBe(g0.organizationId);
  });
  const edit400 = async (mod: (o: any) => void, msg: RegExp) => {
    const d = await draft(); const before = await getSurvey(d.id); const r = await putOf(d.id, mod);
    expect(r.status, `${r.status} ${r.message}`).toBe(400); expect(r.message).toMatch(msg); const after = await getSurvey(d.id); expect(after.name).toBe(before.name); expect(after.startDate).toBe(before.startDate); expect(after.voteTarget).toBe(before.voteTarget);
  };
  test(tc('SVY-E09'), async () => { await edit400(o => { o.name = 'x'.repeat(256); }, /255/); });
  test(tc('SVY-E10'), async () => { await edit400(o => { o.startDate = dayStr(-1); }, /Ngày bắt đầu không được trước/); });
  test(tc('SVY-E11'), async () => { await edit400(o => { o.startDate = dayStr(5); o.endDate = dayStr(4); }, /Ngày kết thúc phải bằng hoặc sau/); });
  test(tc('SVY-E12'), async () => { await edit400(o => { o.voteTarget = 0; }, /số nguyên lớn hơn 0/); });
  test(tc('SVY-E13'), async () => { await edit400(o => { o.methods = []; }, /Hình thức/); });
  test(tc('SVY-E14'), async () => {
    await edit400(o => { o.groups[0].questions = []; }, /Câu hỏi/); await edit400(o => { o.groups = []; }, /Nhóm câu hỏi/);
  });
  test(tc('SVY-E15'), async () => {
    const d = await draft({ groups: [{ name: 'A', questions: [{ content: 'a1' }, { content: 'a2' }] }, { name: 'B', questions: [{ content: 'b1' }] }] });
    const r = await putOf(d.id, o => { o.groups = [{ ...o.groups[1] }, { ...o.groups[0], questions: [o.groups[0].questions[1]] }, { name: 'C', questions: [{ content: 'c1' }, { content: 'c2' }] }]; });
    expect(r.status, r.message).toBe(200); const g = await getSurvey(d.id);
    expect(g.groups.map((x: any) => x.name)).toEqual(['B', 'A', 'C']); expect(g.groups.map((x: any) => x.questions.map((q: any) => q.content))).toEqual([['b1'], ['a2'], ['c1', 'c2']]);
  });
  skipped(['SVY-E17', 'SVY-E18'], 'MANUAL: cần đợt bị tự động từ chối do hết hạn (tác vụ nền chạy theo thời gian)');
  test(tc('SVY-E20'), async () => {
    const d = await draft(); const base = await getSurvey(d.id); await submit(d.id);
    const r = await put(d.id, { ...base, status: 1, name: 'ghi đè' }); expect(r.status).toBe(400); expect(r.message).toMatch(/người khác thay đổi|tải lại/i);
    expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt');
  });
  skipped(['SVY-E21'], 'MANUAL: cần thu hồi quyền sửa của tài khoản giữa chừng');
  test(tc('SVY-E22'), async ({ page }) => {
    const d = await draft(); const r = await putOf(d.id, o => { o.name = 'hack'; }, 'canbo'); expect([400, 403, 404]).toContain(r.status);
    expect((await getSurvey(d.id)).name).not.toBe('hack');
    const g = await api('GET', `survey/surveys/${d.id}`, undefined, 'canbo'); expect([403, 404]).toContain(g.status);
    void page;
  });
  test(tc('SVY-E23'), async ({ page }) => {
    const d = await draft(); await rmSurvey(d.id);
    const r = await put(d.id, payload()); expect(r.status).toBe(404); await openEdit(page, d.id);
    await expect(page.locator('#survey-name')).toHaveCount(0); expect(await body(page)).toMatch(/không tồn tại|không tìm thấy|đã bị xóa/i);
  });
  test(tc('SVY-E24'), async ({ page }) => {
    const d = await draft(); await openEdit(page, d.id); await page.locator('#survey-name').fill('tên đang sửa');
    await page.route(`**/api/v1/survey/surveys/${d.id}`, r => r.request().method() === 'PUT' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }) : r.continue());
    await page.locator('#survey-save-draft-btn').click(); await page.waitForTimeout(1200);
    expect(await page.locator('#survey-name').inputValue()).toBe('tên đang sửa'); await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-025').toBeVisible();
    expect((await getSurvey(d.id)).name).not.toBe('tên đang sửa');
  });
  test(tc('SVY-E25'), async ({ page }) => {
    const d = await draft(); await openEdit(page, d.id); await page.locator('#survey-name').fill('tên đang sửa 2');
    await page.route(`**/api/v1/survey/surveys/${d.id}`, r => r.request().method() === 'PUT' ? r.abort('internetdisconnected') : r.continue());
    await page.locator('#survey-save-draft-btn').click(); await page.waitForTimeout(1200);
    expect(await page.locator('#survey-name').inputValue()).toBe('tên đang sửa 2'); await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-026').toBeVisible();
    await page.unroute(`**/api/v1/survey/surveys/${d.id}`); await page.locator('#survey-save-draft-btn').click(); await settle(page); expect((await getSurvey(d.id)).name).toBe('tên đang sửa 2');
  });
  test(tc('SVY-E27'), async () => {
    const d = await draft(); const n = await count(); const g0 = await getSurvey(d.id);
    await putOf(d.id, o => { o.name = `${NAME} E27`; }); expect(await count()).toBe(n); const g = await getSurvey(d.id); expect(g.id).toBe(g0.id); expect(g.resultCount).toBe(g0.resultCount);
  });
  test(tc('SVY-E28'), async () => {
    const d = await rejected(); const h0 = (await getSurvey(d.id)).histories.map((h: any) => h.statusName + h.reason);
    await putOf(d.id, o => { o.name = `${NAME} E28`; }); const h1 = (await getSurvey(d.id)).histories.map((h: any) => h.statusName + h.reason);
    expect(h1).toEqual(expect.arrayContaining(h0));
  });
  test(tc('SVY-E29'), async ({ page }) => {
    const d = await draft(); await openEdit(page, d.id); const nn = `${NAME} E29 ${Date.now()}`; await page.locator('#survey-name').fill(nn);
    const b = page.locator('#survey-save-draft-btn'); for (let i = 0; i < 3; i++) await b.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {}); await settle(page);
    expect((await getSurvey(d.id)).name).toBe(nn); expect(await body(page)).not.toMatch(/người khác thay đổi/);
  });
  test(tc('SVY-E30'), async () => {
    const d = await draft(); const r = await putOf(d.id, o => { o.name = 'hack'; }, 'ldd'); expect(r.status).toBe(403); expect((await getSurvey(d.id)).name).not.toBe('hack');
  });
});

test.describe('Đợt khảo sát — xóa', () => {
  const confirmDelete = async (page: Page) => { await expect(modal(page)).toBeVisible(); await confirmBtn(page, 'delete').click(); await settle(page); };
  test(tc('SVY-D01'), async ({ page }) => {
    const d = await draft(); const n = await count(); await rowMenu(page, d.code, /Xóa/); await confirmDelete(page);
    expect(await toastText(page)).toMatch(/Xóa thành công/); expect(await count()).toBe(n - 1); expect((await api('GET', `survey/surveys/${d.id}`)).status).toBe(404);
  });
  test(tc('SVY-D02'), async ({ page }) => {
    const d = await rejected(); await rowMenu(page, d.code, /Xóa/); await confirmDelete(page); expect((await api('GET', `survey/surveys/${d.id}`)).status).toBe(404);
  });
  test(tc('SVY-D05'), async ({ page }) => {
    const d = await draft(); await submit(d.id); const r = await api('DELETE', `survey/surveys/${d.id}`); expect(r.status).toBeGreaterThanOrEqual(400);
    await openList(page); await search(page, d.code); await dataRows(page).first().locator('button').last().click();
    await expect(page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: /Xóa/ })).toHaveCount(0);
  });
  test(tc('SVY-D06'), async () => {
    for (const s of [await fixture('ACTIVE', {}, 'Đang diễn ra'), (await allSurveys()).find(x => x.statusName === 'Đã kết thúc')!, (await allSurveys()).find(x => x.statusName === 'Đã phê duyệt')!]) {
      const r = await api('DELETE', `survey/surveys/${s.id}`); expect(r.status, s.statusName).toBeGreaterThanOrEqual(400); expect((await api('GET', `survey/surveys/${s.id}`)).status).toBe(200);
    }
  });
  test(tc('SVY-D07'), async () => {
    const d = await draft(); await submit(d.id); const r = await api('DELETE', `survey/surveys/${d.id}`);
    expect(r.status).toBe(400); expect(r.message).toMatch(/người khác thay đổi|tải lại/i);
  });
  test(tc('SVY-D08'), async () => {
    const d = await draft(); await rmSurvey(d.id); const r = await api('DELETE', `survey/surveys/${d.id}`);
    expect(r.status).toBe(404); expect(r.message).toMatch(/không tồn tại|đã bị xóa/i);
  });
  test(tc('SVY-D09'), async () => {
    const d = await draft(); for (const k of ['ldd', 'xemonly']) { const r = await api('DELETE', `survey/surveys/${d.id}`, undefined, k); expect(r.status, k).toBe(403); }
    const c = await api('DELETE', `survey/surveys/${d.id}`, undefined, 'canbo'); expect([400, 403, 404]).toContain(c.status); expect((await api('GET', `survey/surveys/${d.id}`)).status).toBe(200);
  });
  test(tc('SVY-D10'), async ({ page }) => {
    const d = await draft(); await page.route(`**/api/v1/survey/surveys/${d.id}`, r => r.request().method() === 'DELETE' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }) : r.continue());
    await rowMenu(page, d.code, /Xóa/); await confirmBtn(page, 'delete').click(); await page.waitForTimeout(1200);
    await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-025').toBeVisible(); expect((await api('GET', `survey/surveys/${d.id}`)).status).toBe(200);
  });
  test(tc('SVY-D11'), async ({ page }) => {
    const d = await draft(); await page.route(`**/api/v1/survey/surveys/${d.id}`, r => r.request().method() === 'DELETE' ? r.abort('internetdisconnected') : r.continue());
    await rowMenu(page, d.code, /Xóa/); await confirmBtn(page, 'delete').click(); await page.waitForTimeout(1200);
    expect(await toastText(page)).not.toMatch(/Xóa thành công/); await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-026').toBeVisible();
  });
  test(tc('SVY-D12'), async ({ page }) => {
    const a = await draft(), b = await draft(); const nb = await count(); void nb;
    await rowMenu(page, a.code, /Xóa/); const btn = confirmBtn(page, 'delete'); for (let i = 0; i < 3; i++) await btn.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {}); await settle(page);
    expect((await api('GET', `survey/surveys/${a.id}`)).status).toBe(404); expect((await api('GET', `survey/surveys/${b.id}`)).status).toBe(200);
  });
  test(tc('SVY-D13'), async ({ page }) => {
    const d = await draft(); await openList(page); await page.locator('[id$="-tab-Draft"]').click(); await settle(page); await search(page, 'qc.automation');
    const row = dataRows(page).filter({ hasText: d.code }).first(); await row.locator('button').last().click();
    await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: /Xóa/ }).first().click(); await confirmDelete(page);
    await expect(page.locator('[id$="-tab-Draft"]')).toHaveAttribute('aria-selected', 'true'); expect(await page.locator('#search').inputValue()).toBe('qc.automation');
  });
  test(tc('SVY-D14'), async ({ page }) => {
    const d = await draft(); await rmSurvey(d.id); await page.goto(`/${LIST}/${d.id}`); await settle(page);
    expect(await body(page)).toMatch(/không tồn tại|không tìm thấy|đã bị xóa/i); expect(await body(page)).not.toContain('Thông tin chung');
  });
  test(tc('SVY-D15'), async () => {
    const d = await rejected(); const other = await draft(); expect((await getSurvey(d.id)).histories.length).toBeGreaterThan(1);
    expect(await rmSurvey(d.id)).toBeTruthy(); expect((await api('GET', `survey/surveys/${other.id}`)).status).toBe(200);
  });
});
void FAKE; void total;

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

// ================================================================ E.UC1.3 Tạo mới

// ================================================================ E.UC1.4 Chỉnh sửa
test.describe('Đợt khảo sát › chỉnh sửa', () => {
  // #100 lịch sử xử lý thiếu ghi nhận sửa
  test(tc('SVY-E31'), async ({ page }) => {
    const id = await mkDraft(); const before = await getS(id);
    page.setDefaultTimeout(10_000);
    await page.goto(`${LISTR}/${id}/edit`); await settle(page); await page.locator('#survey-name').waitFor();
    const nn = nm('E31 sửa'); await page.locator('#survey-name').fill(nn);
    await page.locator('#survey-save-draft-btn').click(); await settle(page);
    const after = await getS(id);
    expect(after.name, 'đã lưu chỉnh sửa').toBe(nn);
    expect(after.histories.length, 'Lịch sử xử lý có thêm sự kiện mới').toBe(before.histories.length + 1);
    const newest = after.histories.at(-1);
    expect(after.histories.slice(0, before.histories.length).map((h: any) => h.createdOnDate), 'các sự kiện cũ còn nguyên').toEqual(before.histories.map((h: any) => h.createdOnDate));
    await openDetail(page, id);
    const hist = cardOf(page, 'Lịch sử xử lý'); await expect(hist).toBeVisible();
    const lines = (await hist.innerText()).split('\n').map(norm).filter(Boolean);
    const i = lines.findIndex(l => l.includes(' · '));
    const first = `${lines[i]} | ${lines[i + 1] ?? ''}`;
    test.info().annotations.push({ type: 'đo', description: `Dòng lịch sử mới nhất: "${first}"` });
    expect(lines[i], 'dòng mới nhất là sự kiện chỉnh sửa, có người sửa').toMatch(new RegExp(`^${newest.createdByUserName} · (Chỉnh sửa|Cập nhật)$`));
    expect(lines[i + 1], 'có thời điểm lưu').toMatch(new RegExp(`^${dmy(dayStr(0))} \\d{2}:\\d{2}$`));
    if (!/Chỉnh sửa/.test(lines[i])) test.info().annotations.push({ type: 'lệch nhãn', description: `Sự kiện ghi là "Cập nhật" (exp: "Chỉnh sửa") — nhãn theo SRS BR-7 cần BA xác nhận` });
  });
});
});
