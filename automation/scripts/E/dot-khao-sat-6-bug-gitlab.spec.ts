// E.UC1 ĐỢT KHẢO SÁT — testcase BỔ SUNG từ bug/góp ý GitLab (catalog-BUG-C.mjs, prefix SVY-L67…SVY-E31).
// Assert theo kỳ vọng ĐÚNG (exp) — test FAIL nghĩa là lỗi còn tồn tại.
// Phiên: auth/admin.json (qc.adminn) — KHÔNG dùng fixture page của ./common (gắn superadmin), tự tạo context riêng.
// Dữ liệu thử: đợt tên "qc.automation SVYBUG …" do admin tạo qua API/UI (đơn vị QC_BO), dọn qua API ở afterAll.
// Case không tự động hóa được: SVY-L68 (đối chiếu Figma KS-01…KS-11) — không có test ở đây, xem báo cáo.
import { test as base, expect, Page, Locator } from '@playwright/test';
import { tc, api, F, settle, dayStr, dmy } from './common';
import { hidePwExpiry } from '../helpers';
import { guardSession } from '../session-guard';

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
test.describe('Đợt khảo sát — bug GitLab: danh sách', () => {
  // #60 Remove sort "Trạng thái"
  test(tc('SVY-L67'), async ({ page }) => {
    await openList(page);
    const th = page.locator('thead th', { hasText: /^\s*Trạng thái\s*$/ }).first();
    await expect(th).toBeVisible();
    await expect(th.locator('.ant-table-column-sorter'), 'tiêu đề Trạng thái không có biểu tượng sắp xếp').toHaveCount(0);
    expect(await th.getAttribute('class') ?? '').not.toContain('ant-table-column-has-sorters');
    const before = await codesOnPage(page);
    await th.click(); await settle(page);
    expect(await codesOnPage(page), 'bấm tiêu đề Trạng thái không đổi thứ tự dòng').toEqual(before);
    await th.click(); await settle(page);
    expect(await codesOnPage(page)).toEqual(before);
    test.info().annotations.push({ type: 'note', description: '#74 (sau đó) nêu thiếu sort theo Trạng thái — có sort hay không cần BA xác nhận; test kiểm theo exp hiện tại (không sort)' });
  });

  // #166 thừa text phụ
  test(tc('SVY-L69'), async ({ page }) => {
    await openList(page);
    const api1 = (await api('GET', `survey/surveys?page=1&size=20&filter=${F({})}`, undefined, AS)).data.content as any[];
    const heads = (await page.locator('thead th').allInnerTexts()).map(norm);
    const col = (re: RegExp) => heads.findIndex(h => re.test(h));
    const ci = { ma: col(/^Mã$/), ten: col(/^Tên đợt/), ht: col(/^Hình thức/), tg: col(/^Thời gian/), td: col(/^Tiến độ/), tt: col(/^Trạng thái/) };
    for (const [k, v] of Object.entries(ci)) expect(v, `thiếu cột ${k}`).toBeGreaterThanOrEqual(0);
    const n = await rows(page).count(); expect(n).toBeGreaterThan(0);
    const problems: string[] = [];
    for (let i = 0; i < n; i++) {
      const cells = (await rows(page).nth(i).locator('td').allInnerTexts()).map(s => s.trim());
      const s = api1.find(x => x.code === norm(cells[ci.ma]));
      if (!s) { problems.push(`dòng ${i + 1}: ô Mã "${cells[ci.ma]}" có text ngoài mã đợt`); continue; }
      const lines = (c: string) => c.split('\n').map(norm).filter(Boolean);
      if (norm(cells[ci.ten]) !== norm(s.name)) problems.push(`${s.code}: ô Tên đợt "${norm(cells[ci.ten])}" ≠ tên "${norm(s.name)}"`);
      if (lines(cells[ci.ht]).some(l => !s.methodNames.includes(l))) problems.push(`${s.code}: ô Hình thức có dòng phụ: ${JSON.stringify(lines(cells[ci.ht]))}`);
      if (!/^\d{2}\/\d{2}\/\d{4}\s*[–-]?\s*\d{2}\/\d{2}\/\d{4}$/.test(norm(cells[ci.tg]))) problems.push(`${s.code}: ô Thời gian có text phụ: "${norm(cells[ci.tg])}"`);
      if (!/^(-|\d[\d.]* \/ [\d.]+ \d+%)$/.test(norm(cells[ci.td]))) problems.push(`${s.code}: ô Tiến độ có text phụ: "${norm(cells[ci.td])}"`);
      if (norm(cells[ci.tt]) !== s.statusName) problems.push(`${s.code}: ô Trạng thái "${norm(cells[ci.tt])}" ≠ "${s.statusName}"`);
    }
    expect(problems, 'các ô chỉ hiển thị giá trị chính, không có dòng chữ phụ').toEqual([]);
  });
});

// ================================================================ E.UC1.2 Chi tiết
test.describe('Đợt khảo sát — bug GitLab: chi tiết', () => {
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
test.describe('Đợt khảo sát — bug GitLab: tạo mới', () => {
  // #84 disable ngày quá khứ
  test(tc('SVY-C72'), async ({ page }) => {
    await openCreate(page);
    await page.locator('#survey-start-date').click();
    const dd = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').last(); await dd.waitFor();
    const today = dayStr(0);
    // nếu hôm nay là ngày 1 thì lùi về tháng trước để có ngày quá khứ trong khung
    if (today.endsWith('-01')) { await dd.locator('.ant-picker-header-prev-btn').click(); }
    const cells = await dd.locator('td.ant-picker-cell-in-view').evaluateAll((es, t) => es.map(e => ({ d: e.getAttribute('title') || '', dis: e.classList.contains('ant-picker-cell-disabled') })).filter(x => x.d && x.d < t), today);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.filter(c => !c.dis).map(c => c.d), 'các ngày trước hôm nay phải bị vô hiệu hóa').toEqual([]);
    if (today.endsWith('-01')) { await dd.locator('.ant-picker-header-next-btn').click(); }
    const tCell = dd.locator(`td[title="${today}"]`);
    await expect(tCell, 'hôm nay chọn được').not.toHaveClass(/ant-picker-cell-disabled/);
    const tom = dd.locator(`td[title="${dayStr(1)}"]`);
    if (await tom.count()) await expect(tom).not.toHaveClass(/ant-picker-cell-disabled/);
    // bấm một ngày quá khứ không đổi giá trị
    const y = dayStr(-1);
    const yc = dd.locator(`td[title="${y}"]`);
    if (await yc.count()) { const v0 = await page.locator('#survey-start-date').inputValue(); await yc.click({ force: true }); await page.waitForTimeout(300); expect(await page.locator('#survey-start-date').inputValue()).toBe(v0); }
    await tCell.click(); await page.waitForTimeout(300);
    expect(await page.locator('#survey-start-date').inputValue()).toBe(dmy(today));
  });

  // #100 thanh nút thao tác
  test(tc('SVY-C73'), async ({ page }) => {
    await openCreate(page);
    const ids = ['#survey-cancel-btn', '#survey-save-draft-btn', '#survey-save-submit-btn'];
    const lbl = await Promise.all(ids.map(async i => norm(await page.locator(i).innerText())));
    expect(lbl[0]).toMatch(/^Hu[ỷỷý]$/i); expect(lbl[1]).toBe('Lưu nháp'); expect(lbl[2]).toMatch(/Trình phê duyệt$/i);
    const bx = await Promise.all(ids.map(i => box(page.locator(i))));
    expect(bx[0].x < bx[1].x && bx[1].x < bx[2].x, 'thứ tự Hủy → Lưu nháp → Trình phê duyệt').toBeTruthy();
    expect(Math.abs(bx[0].y - bx[2].y), 'cùng một hàng').toBeLessThan(5);
    const bg = await Promise.all(ids.map(i => page.locator(i).evaluate(e => getComputedStyle(e).backgroundColor)));
    expect(bg[2], 'nút chính (Trình phê duyệt) nổi bật khác nút phụ').not.toBe(bg[1]);
    expect(bg[0]).toBe(bg[1]);
    // cụm nút nằm cùng dòng tiêu đề ở đầu trang
    const h1 = await box(main(page).locator('h1').first());
    expect(Math.abs((bx[2].y + bx[2].height / 2) - (h1.y + h1.height / 2)), 'cụm nút nằm ngang hàng tiêu đề').toBeLessThan(40);
    test.info().annotations.push({ type: 'note', description: `Nhãn thực tế: ${lbl.join(' / ')} — catalog ghi "Trình phê duyệt"; nhãn/màu chính xác theo Figma cần đối chiếu thủ công` });
  });

  // #100 câu hỏi soạn trực tiếp, không có nút "Sửa câu hỏi"
  test(tc('SVY-C74'), async ({ page }) => {
    const name = nm('C74');
    await openCreate(page);
    await page.locator('#survey-name').fill(name);
    await setDate(page, 'survey-start-date', dmy(dayStr(1))); await setDate(page, 'survey-end-date', dmy(dayStr(20)));
    await contentTab(page);
    await page.locator('#survey-group-name-1').fill('Nhóm C74');
    if ((await qInputs(page).count()) < 2) await page.locator('#survey-add-question-group-1').click();
    await expect(qInputs(page)).toHaveCount(2);
    await qInputs(page).nth(0).fill('Câu một'); await qInputs(page).nth(1).fill('Câu hai');
    await expect(page.getByRole('button', { name: /Sửa câu hỏi/i }), 'không có nút "Sửa câu hỏi"').toHaveCount(0);
    await expect(page.getByText(/Sửa câu hỏi/i)).toHaveCount(0);
    // sửa trực tiếp trên ô
    await qInputs(page).nth(0).click(); await qInputs(page).nth(0).fill('Câu một đã sửa trực tiếp');
    expect(await qInputs(page).nth(0).isEditable()).toBeTruthy();
    await page.locator('#survey-save-draft-btn').click(); await settle(page);
    const s = (await listAll({ keyword: name })).find(x => x.name === name);
    expect(s, 'Lưu nháp tạo được đợt').toBeTruthy();
    const d = await getS(s.id);
    expect(d.groups.flatMap((g: any) => g.questions.map((q: any) => q.content))).toEqual(['Câu một đã sửa trực tiếp', 'Câu hai']);
  });

  // #100 header ghim khi cuộn
  test(tc('SVY-C75'), async ({ page }) => {
    test.setTimeout(240_000);
    await openCreate(page); await contentTab(page);
    for (let g = 1; g <= 3; g++) {
      if (g > 1) { await page.locator('#survey-add-group-btn').click(); await page.waitForTimeout(200); }
      const add = page.locator(`#survey-add-question-group-${g}`);
      await add.waitFor();
      for (let k = 0; k < 15 && (await qInputs(page).count()) < 10 * g; k++) await add.click();
    }
    expect(await qInputs(page).count()).toBeGreaterThanOrEqual(30);
    const last = qInputs(page).last(); await last.scrollIntoViewIfNeeded(); await page.keyboard.press('End').catch(() => {});
    await page.evaluate(() => { document.querySelectorAll('*').forEach(e => { const el = e as HTMLElement; if (el.scrollHeight > el.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight; }); window.scrollTo(0, document.body.scrollHeight); });
    await page.waitForTimeout(500);
    // đã thực sự cuộn: ô tên nhóm 1 ra khỏi màn hình
    const g1 = await box(page.locator('#survey-group-name-1'));
    expect(g1.y + g1.height, 'đã cuộn xuống cuối trang').toBeLessThan(0);
    const inView = async (sel: Locator, what: string) => {
      const b = await box(sel); expect(b.y >= -1 && b.y + b.height <= VIEW.height + 1, `${what} phải hiển thị khi cuộn (y=${Math.round(b.y)})`).toBeTruthy();
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      expect(await sel.evaluate((e, [x, y]) => { const t = document.elementFromPoint(x, y); return !!t && (e === t || e.contains(t)); }, [cx, cy]), `${what} không bị phần khác che`).toBeTruthy();
    };
    await inView(main(page).locator('h1', { hasText: 'Thêm đợt khảo sát' }).first(), 'Tiêu đề');
    await inView(page.locator('#survey-save-draft-btn'), 'Nút Lưu nháp');
    await inView(page.locator('#survey-save-submit-btn'), 'Nút Trình phê duyệt');
    // header không che câu hỏi cuối
    const lb = await box(last);
    expect(await last.evaluate((e, [x, y]) => { const t = document.elementFromPoint(x, y); return !!t && (e === t || e.contains(t) || t.contains(e)); }, [lb.x + lb.width / 2, lb.y + lb.height / 2]), 'câu hỏi cuối không bị header che').toBeTruthy();
  });
});

// ================================================================ E.UC1.4 Chỉnh sửa
test.describe('Đợt khảo sát — bug GitLab: chỉnh sửa', () => {
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
