// E.UC2 KHẢO SÁT CÔNG KHAI (người dân, không đăng nhập) — script bám testcase PUB-L/V/A/R.
// Chạy ẩn danh (account=null trong catalog). Chỉ gửi phiếu THẬT vào một đợt thử (TEST_DOT_05, 1 câu); các case gửi khác dùng page.route giả lập để không làm bẩn số liệu.
import { test, expect, tc, API_BASE, raw, api, allSurveys, publicList, skipped, settle, postPublic, PUBLIC, FAKE } from './common';
import type { Page } from '@playwright/test';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const body = async (p: Page) => clean(await p.locator('body').innerText());
const fmt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const today = new Date().toISOString().slice(0, 10);
const online = (s: any) => s.methodNames.includes('Trực tuyến');
const OK = '{"data":{"id":"mock"},"code":200,"isSuccess":true}';
const mockOk = (page: Page, delay = 0) => page.route('**/api/v1/public/surveys/*/responses', async r => { if (delay) await new Promise(f => setTimeout(f, delay)); await r.fulfill({ status: 200, contentType: 'application/json', body: OK }); });
let ALL: any[] = []; let PUBL: any[] = []; let BIG: any; let SMALL: any; let SMALLFULL: any;
test.beforeAll(async () => {
  ALL = await allSurveys(); PUBL = (await publicList(1, 100)).data?.content ?? [];
  BIG = [...PUBL].sort((a, b) => b.questionCount - a.questionCount)[0];
  SMALL = PUBL.find(s => /TEST_DOT_05/.test(s.name)) ?? [...PUBL].sort((a, b) => a.questionCount - b.questionCount)[0];
  SMALLFULL = (await raw('GET', `public/surveys/${SMALL.id}`)).data;
});
const openList = async (p: Page) => { await p.goto(`/${PUBLIC}`); await settle(p); };
const openForm = async (p: Page, id: string) => { await p.goto(`/${PUBLIC}/${id}`); await settle(p); await p.getByRole('button', { name: /Gửi đánh giá/ }).first().waitFor(); };
const choose = async (p: Page, i: number, v: 'Hài lòng' | 'Chưa hài lòng' = 'Hài lòng') =>
  p.getByRole('button', { name: new RegExp(`^${v}$`) }).nth(i * 1).click();
const pickIdx = (i: number, v: 'H' | 'C') => 2 * i + (v === 'H' ? 0 : 1);
const answer = async (p: Page, i: number, v: 'H' | 'C' = 'H') => p.getByRole('button', { name: /^(Hài lòng|Chưa hài lòng)$/ }).nth(pickIdx(i, v)).click();
const answerAll = async (p: Page, n: number, v: 'H' | 'C' = 'H') => { for (let i = 0; i < n; i++) await answer(p, i, v); };
const progress = async (p: Page) => (await body(p)).match(/Đã trả lời (\d+)\/(\d+)/)!.slice(1).map(Number);
const submit = (p: Page) => p.getByRole('button', { name: /Gửi đánh giá/ }).first();
const posted = (p: Page) => { const a: any[] = []; p.on('request', r => { if (r.method() === 'POST' && /responses/.test(r.url())) a.push(JSON.parse(r.postData() || '{}')); }); return a; };
const countOf = async (id: string) => (await api('GET', `survey/surveys/${id}`)).data.resultCount as number;
const adminOf = (id: string) => ALL.find(s => s.id === id);
const qids = (d: any) => d.groups.flatMap((g: any) => g.questions.map((q: any) => q.id));

test.describe.configure({ mode: 'default' });
test.describe('Khảo sát công khai — danh sách', () => {
  test(tc('PUB-L01'), async ({ page }) => {
    await openList(page); expect(page.url()).toContain('/respond'); const t = await body(page);
    expect(t).toContain('Khảo sát mức độ hài lòng'); expect(t).toMatch(/Không cần đăng nhập/); expect(t).toMatch(/\d+ khảo sát đang mở/);
  });
  test(tc('PUB-L02'), async ({ page }) => {
    await openList(page); const t = await body(page);
    for (const s of PUBL) { expect(t).toContain(s.name); expect(t).toContain(s.organizationName); expect(t).toContain(`Hạn đến ${fmt(s.endDate)}`); expect(t).toContain(`${s.questionCount} câu hỏi`); }
    expect(await page.getByRole('button', { name: /Tham gia khảo sát/ }).count()).toBe(PUBL.length);
  });
  test(tc('PUB-L03'), async () => {
    for (const s of PUBL) { const d = (await api('GET', `survey/surveys/${s.id}`)).data; expect(s.questionCount, s.name).toBe(d.groups.reduce((a: number, g: any) => a + g.questions.length, 0)); }
  });
  const eligible = () => ALL.filter(s => online(s) && ['Đã phê duyệt', 'Đang diễn ra'].includes(s.statusName) && s.startDate.slice(0, 10) <= today && today <= s.endDate.slice(0, 10));
  test(tc('PUB-L05'), async () => {
    const bad = ALL.filter(s => ['Nháp', 'Chờ phê duyệt', 'Bị từ chối'].includes(s.statusName)).map(s => s.id);
    expect(PUBL.filter(s => bad.includes(s.id))).toEqual([]);
  });
  test(tc('PUB-L06'), async () => {
    const future = ALL.filter(s => s.statusName === 'Đã phê duyệt' && s.startDate.slice(0, 10) > today).map(s => s.id);
    expect(future.length).toBeGreaterThan(0); expect(PUBL.filter(s => future.includes(s.id))).toEqual([]);
  });
  skipped(['PUB-L07'], 'MANUAL: cần đợt đã quá hạn nhưng tác vụ nền chưa đổi trạng thái (không tái hiện được chủ động)');
  test(tc('PUB-L08'), async () => {
    const off = ALL.filter(s => !online(s)).map(s => s.id); expect(PUBL.filter(s => off.includes(s.id))).toEqual([]);
  });
  test(tc('PUB-L11'), async () => {
    const d = PUBL.map(s => s.endDate); expect([...d].sort()).toEqual(d);
    for (let i = 1; i < PUBL.length; i++) if (PUBL[i].endDate === PUBL[i - 1].endDate)
      expect(adminOf(PUBL[i - 1].id).code <= adminOf(PUBL[i].id).code, 'cùng ngày thì theo mã đợt tăng dần').toBeTruthy();
  });
  skipped(['PUB-L13', 'PUB-L14'], 'BLOCKED: môi trường chỉ có 7 đợt đang mở (<11) nên không có trang 2 để kiểm chuyển trang; cần ≥11 đợt đủ điều kiện (không tạo được do lỗi tạo đợt)');
  test(tc('PUB-L15'), async () => {
    const r = await publicList(999, 10);
    expect(r.status).toBeLessThan(500);
    if (r.status === 200) expect(r.data.content.length, 'page=999 phải về trang cuối hợp lệ (không rỗng)').toBeGreaterThan(0);
  });
  skipped(['PUB-L16', 'PUB-L18'], 'MANUAL: cần môi trường không có đợt mở / đợt hết hạn đúng lúc người dân bấm');
  test(tc('PUB-L17'), async ({ page }) => {
    await openList(page); const card = page.getByRole('button', { name: /Tham gia khảo sát/ }).nth(2);
    await card.click(); await settle(page);
    expect(page.url()).toContain(`/respond/${PUBL[2].id}`); expect(await body(page)).toContain(PUBL[2].name);
  });
  test(tc('PUB-L19'), async ({ page }) => {
    await openList(page);
    await expect(page.locator('input:visible')).toHaveCount(0);
    expect(await body(page)).not.toMatch(/Đăng nhập|Tìm kiếm|Quản trị/);
  });
  test(tc('PUB-L20'), async ({ page }) => {
    await openForm(page, SMALL.id); await page.getByRole('button', { name: /Các khảo sát đang mở/ }).first().click(); await settle(page);
    expect(page.url()).toMatch(/\/respond\/?$/);
  });
  test(tc('PUB-L23'), async () => {
    const ok = new Set(['id', 'name', 'organizationName', 'endDate', 'questionCount']);
    for (const s of PUBL) expect(Object.keys(s).filter(k => !ok.has(k)), 'trường nội bộ lộ ra').toEqual([]);
    expect(JSON.stringify(PUBL)).not.toMatch(/createdBy|histor|voteTarget|resultCount|rejectReason/i);
  });
});

test.describe('Khảo sát công khai — xem nội dung', () => {
  test(tc('PUB-V01'), async ({ page }) => {
    const d = (await raw('GET', `public/surveys/${BIG.id}`)).data; await openForm(page, BIG.id); const t = await body(page);
    expect(t).toContain(d.name); expect(t).toContain(d.organizationName); expect(t).toContain(`Hạn đến ${fmt(d.endDate)}`); expect(t).toContain(`${BIG.questionCount} câu hỏi`);
    let pos = 0; for (const g of d.groups) { const i = t.toUpperCase().indexOf(g.name.toUpperCase(), pos); expect(i).toBeGreaterThanOrEqual(0); pos = i; }
    expect(t).toMatch(/Góp ý thêm/);
  });
  test(tc('PUB-V03'), async ({ page }) => {
    await openForm(page, BIG.id);
    expect(await page.getByRole('button', { name: /^Hài lòng$/ }).count()).toBe(BIG.questionCount);
    expect(await page.getByRole('button', { name: /^Chưa hài lòng$/ }).count()).toBe(BIG.questionCount);
    expect(await body(page)).not.toMatch(/Không áp dụng|Đánh giá chung|Chọn tất cả/i);
  });
  test(tc('PUB-V04'), async ({ page }) => {
    await openForm(page, BIG.id); expect(await body(page)).not.toMatch(/Lịch sử|Kết quả tổng hợp|Chỉnh sửa|Thêm nhóm|Thêm câu/);
  });
  test(tc('PUB-V05'), async ({ page }) => { await openForm(page, SMALL.id); expect(await body(page)).toContain(SMALL.name); });
  skipped(['PUB-V06'], 'CHƯA TỰ ĐỘNG HOÁ: cần giải mã ảnh QR (chưa có thư viện); liên kết dưới QR đã được kiểm ở SVY-V11');
  test(tc('PUB-V07'), async ({ page, browser }) => {
    for (let i = 0; i < 2; i++) { await openForm(page, SMALL.id); expect(await body(page)).toContain(SMALL.name); }
    const c2 = await browser.newContext({ storageState: { cookies: [], origins: [] } }); const p2 = await c2.newPage(); await openForm(p2, SMALL.id); expect(await body(p2)).toContain(SMALL.name); await c2.close();
  });
  test(tc('PUB-V08'), async ({ page }) => {
    await page.goto(`/${PUBLIC}/${FAKE}`); await settle(page); const t = await body(page);
    expect(t).toMatch(/Khảo sát không tồn tại/); expect(t).toMatch(/không hợp lệ hoặc đã hết hạn/); await expect(submit(page)).toHaveCount(0);
  });
  test(tc('PUB-V09'), async ({ page }) => {
    const s = ALL.find(x => x.statusName === 'Đang diễn ra' && !online(x))!;
    expect((await raw('GET', `public/surveys/${s.id}`)).status).toBe(404);
    await page.goto(`/${PUBLIC}/${s.id}`); await settle(page); expect(await body(page)).toMatch(/Khảo sát không tồn tại/); await expect(submit(page)).toHaveCount(0);
  });
  test(tc('PUB-V10'), async ({ page }) => {
    for (const st of ['Nháp', 'Chờ phê duyệt', 'Bị từ chối']) {
      const s = ALL.find(x => x.statusName === st && online(x)); if (!s) continue;
      const r = await raw('GET', `public/surveys/${s.id}`); expect(r.status, st).toBe(404);
      await page.goto(`/${PUBLIC}/${s.id}`); await settle(page); const t = await body(page);
      expect(t).toMatch(/Khảo sát không tồn tại/); if (s.rejectReason) expect(t).not.toContain(s.rejectReason.slice(0, 20)); await expect(submit(page)).toHaveCount(0);
    }
  });
  test(tc('PUB-V11'), async ({ page }) => {
    const s = ALL.find(x => x.statusName === 'Đã phê duyệt' && online(x) && x.startDate.slice(0, 10) > today)!;
    expect((await raw('GET', `public/surveys/${s.id}`)).status).toBe(409);
    await page.goto(`/${PUBLIC}/${s.id}`); await settle(page); expect(await body(page)).toMatch(/chưa bắt đầu/); await expect(submit(page)).toHaveCount(0);
  });
  skipped(['PUB-V12', 'PUB-V13'], 'MANUAL: cần đúng thời điểm biên 23:59/00:00 hoặc đợt hết hạn nhưng trạng thái chưa cập nhật (đợt đã Kết thúc trả 410 "Đợt khảo sát đã kết thúc" — đã quan sát)');
  test(tc('PUB-V14'), async ({ page }) => {
    await page.goto(`/${PUBLIC}/${FAKE}`); await settle(page);
    await page.getByRole('button', { name: /khảo sát đang mở/i }).first().click(); await settle(page);
    expect(page.url()).toMatch(/\/respond\/?$/); expect(page.url()).not.toContain('login');
  });
  test(tc('PUB-V15'), async ({ page }) => {
    const reqs = posted(page); await openForm(page, SMALL.id); const before = await countOf(SMALL.id);
    await page.getByRole('button', { name: /Các khảo sát đang mở/ }).first().click(); await settle(page);
    expect(page.url()).toMatch(/\/respond\/?$/); expect(reqs).toHaveLength(0); expect(await countOf(SMALL.id)).toBe(before);
  });
  test(tc('PUB-V18'), async () => {
    const d = (await raw('GET', `public/surveys/${BIG.id}`)).data; const ok = new Set(['id', 'name', 'organizationName', 'endDate', 'groups']);
    expect(Object.keys(d).filter(k => !ok.has(k))).toEqual([]);
    expect(JSON.stringify(d)).not.toMatch(/createdBy|histor|voteTarget|resultCount|rejectReason|publicLink/i);
  });
});

test.describe('Khảo sát công khai — trả lời & gửi phiếu', () => {
  test(tc('PUB-A01'), async ({ page }) => {
    await openForm(page, BIG.id); expect(await progress(page)).toEqual([0, BIG.questionCount]);
    expect(await page.locator('[role=progressbar]').first().getAttribute('aria-valuenow')).toMatch(/^0/);
  });
  test(tc('PUB-A04'), async ({ page }) => {
    await openForm(page, BIG.id); const n = BIG.questionCount; const k = Math.round(n * 0.4);
    await answerAll(page, k); expect(await progress(page)).toEqual([k, n]);
    const v = Number(await page.locator('[role=progressbar]').first().getAttribute('aria-valuenow'));
    expect(Math.abs(v - (k / n) * 100)).toBeLessThan(1);
    await page.reload(); await settle(page); await answerAll(page, n);
    expect(await progress(page)).toEqual([n, n]); expect(Number(await page.locator('[role=progressbar]').first().getAttribute('aria-valuenow'))).toBe(100);
  });
  test(tc('PUB-A05'), async ({ page }) => { await openForm(page, BIG.id); await answer(page, 0); await page.locator('textarea').fill('góp ý thử'); expect(await progress(page)).toEqual([1, BIG.questionCount]); });
  test(tc('PUB-A06'), async ({ page }) => { test.setTimeout(300_000);
    await openForm(page, SMALL.id); const before = await countOf(SMALL.id); const reqs = posted(page);
    await answerAll(page, SMALL.questionCount); await submit(page).click(); await settle(page);
    expect(reqs).toHaveLength(1); expect(await body(page)).toMatch(/Cảm ơn/); expect(await body(page)).toContain(SMALL.name);
    expect(await countOf(SMALL.id)).toBe(before + 1);
  });
  test(tc('PUB-A07'), async ({ page }) => {
    await mockOk(page); const reqs = posted(page); await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount);
    await submit(page).click(); await settle(page); expect(reqs).toHaveLength(1); expect(reqs[0].note ?? '').toBe(''); expect(await body(page)).toMatch(/Cảm ơn/);
  });
  const partial = async (page: Page, answered: number) => {
    await mockOk(page); const reqs = posted(page); await openForm(page, BIG.id); await answerAll(page, answered);
    await submit(page).click(); await page.waitForTimeout(600); return reqs;
  };
  test(tc('PUB-A08'), async ({ page }) => {
    const reqs = await partial(page, BIG.questionCount - 1); expect(reqs).toHaveLength(0);
    expect(await page.locator('[data-missing-public="true"]').count()).toBe(1); expect(await body(page)).toMatch(/Chọn mức đánh giá/);
  });
  test(tc('PUB-A10'), async ({ page }) => {
    const reqs = await partial(page, 0); expect(reqs).toHaveLength(0); expect(await page.locator('[data-missing-public="true"]').count()).toBe(BIG.questionCount);
  });
  test(tc('PUB-A11'), async ({ page }) => {
    await mockOk(page); const reqs = posted(page); await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount);
    await page.locator('textarea').fill('a'.repeat(1000)); await submit(page).click(); await settle(page);
    expect(reqs).toHaveLength(1); expect(reqs[0].note).toHaveLength(1000);
  });
  test(tc('PUB-A13'), async () => { test.setTimeout(300_000);
    const before = await countOf(SMALL.id);
    const r = await postPublic(`public/surveys/${SMALL.id}/responses`, { channel: 1, note: 'a'.repeat(1001), answers: qids(SMALLFULL).map((id: string) => ({ questionId: id, result: 1 })) });
    expect(r.status, `${r.status} ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    expect(await countOf(SMALL.id), 'không được tạo phiếu').toBe(before);
  });
  skipped(['PUB-A14'], 'CHƯA TỰ ĐỘNG HOÁ: cần gửi phiếu thật rồi đọc lại góp ý ở trang cán bộ (UC3.1/4.2) — phụ thuộc API phiếu/kết quả');
  test(tc('PUB-A15'), async ({ page }) => { await openForm(page, BIG.id); expect(await body(page)).not.toMatch(/Chọn tất cả|Không áp dụng|Đánh giá chung/i); });
  skipped(['PUB-A16', 'PUB-A18'], 'CHƯA TỰ ĐỘNG HOÁ: cần đọc đáp án từng câu / số phiếu theo đợt qua API kết quả (UC4.2) sau khi gửi phiếu thật');
  test(tc('PUB-A17'), async ({ page }) => {
    await mockOk(page); const reqs = posted(page); await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount); await submit(page).click(); await settle(page);
    expect(reqs).toHaveLength(1); expect(Object.keys(reqs[0]).filter(k => !['channel', 'note', 'answers'].includes(k))).toEqual([]);
    expect(await body(page)).not.toMatch(/Ngày thu phiếu|Người nhập/);
  });
  test(tc('PUB-A19'), async () => { test.setTimeout(300_000);
    const before = await countOf(SMALL.id);
    const r = await postPublic(`public/surveys/${SMALL.id}/responses`, { channel: 1, answers: qids(SMALLFULL).map((id: string) => ({ questionId: id, result: 2 })) });
    expect(r.status, r.message).toBeLessThan(300); expect(await countOf(SMALL.id)).toBe(before + 1);
  });
  skipped(['PUB-A20', 'PUB-A22', 'PUB-A26', 'PUB-A27', 'PUB-A30'], 'MANUAL: cần đẩy thời gian / giả lập mất phản hồi / lỗi giữa chừng phía máy chủ');
  test(tc('PUB-A21'), async () => { test.setTimeout(300_000);
    const answers = qids(SMALLFULL).map((id: string) => ({ questionId: id, result: 1 }));
    const cases: [string, number][] = [[FAKE, 404], [ALL.find(s => s.statusName === 'Đã kết thúc' && online(s))!.id, 410], [ALL.find(s => s.statusName === 'Đã phê duyệt' && online(s) && s.startDate.slice(0, 10) > today)!.id, 409], [ALL.find(s => s.statusName === 'Nháp' && online(s))!.id, 404]];
    for (const [id, st] of cases) { const r = await postPublic(`public/surveys/${id}/responses`, { channel: 1, answers }); expect(r.status, `${id} → ${r.status} ${r.message}`).toBe(st); }
  });
  test(tc('PUB-A23'), async ({ page }) => {
    await mockOk(page, 2500); await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount);
    await submit(page).click(); await page.waitForTimeout(500); await expect(submit(page)).toBeDisabled();
    await expect(page.getByText(/Cảm ơn/).first()).toBeVisible({ timeout: 10_000 });
  });
  test(tc('PUB-A24'), async ({ page }) => {
    await mockOk(page, 1500); const reqs = posted(page); await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount);
    const b = submit(page); await b.click(); await b.click({ force: true, timeout: 1500 }).catch(() => {}); await page.waitForTimeout(2500);
    expect(reqs).toHaveLength(1);
  });
  skipped(['PUB-A25'], 'CHƯA TỰ ĐỘNG HOÁ: SRS chưa nêu khóa chống gửi trùng (idempotent key) ở API công khai → cần BA/Dev xác nhận tên header/trường');
  test(tc('PUB-A28'), async ({ page }) => {
    await page.route('**/api/v1/public/surveys/*/responses', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount); await page.locator('textarea').fill('giữ lại'); await submit(page).click(); await page.waitForTimeout(1000);
    expect(await body(page)).not.toMatch(/Cảm ơn/); expect(await page.locator('textarea').inputValue()).toBe('giữ lại'); expect((await progress(page))[0]).toBe(SMALL.questionCount);
    await expect(submit(page)).toBeEnabled(); await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-025').toBeVisible();
  });
  test(tc('PUB-A29'), async ({ page }) => {
    await page.route('**/api/v1/public/surveys/*/responses', r => r.abort('internetdisconnected'));
    await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount); await page.locator('textarea').fill('giữ lại'); await submit(page).click(); await page.waitForTimeout(1000);
    expect(await body(page)).not.toMatch(/Cảm ơn/); expect(await page.locator('textarea').inputValue()).toBe('giữ lại');
    await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-026').toBeVisible();
    await page.unroute('**/api/v1/public/surveys/*/responses'); await mockOk(page); const reqs = posted(page); await submit(page).click(); await settle(page);
    expect(reqs).toHaveLength(1); expect(await body(page)).toMatch(/Cảm ơn/);
  });
  test(tc('PUB-A31'), async () => { test.setTimeout(300_000);
    const before = await countOf(BIG.id); const full = (await raw('GET', `public/surveys/${BIG.id}`)).data; const ids = qids(full);
    const send = (answers: any[]) => postPublic(`public/surveys/${BIG.id}/responses`, { channel: 1, answers });
    const all = ids.map((id: string) => ({ questionId: id, result: 1 }));
    for (const [name, a] of [['thiếu 1 câu', all.slice(1)], ['đáp án = 3', all.map((x: any, i: number) => (i ? x : { ...x, result: 3 }))], ['đáp án = 0', all.map((x: any, i: number) => (i ? x : { ...x, result: 0 }))], ['câu không thuộc đợt', all.map((x: any, i: number) => (i ? x : { ...x, questionId: FAKE }))], ['rỗng', []]] as [string, any[]][]) {
      const r = await send(a); expect(r.status, `${name} → ${r.status} ${r.message}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    }
    expect(await countOf(BIG.id), 'không tạo phiếu sai').toBe(before);
  });
  test(tc('PUB-A32'), async () => { test.setTimeout(300_000);
    const before = await countOf(BIG.id); const ids = qids((await raw('GET', `public/surveys/${BIG.id}`)).data);
    const all = ids.map((id: string) => ({ questionId: id, result: 1 }));
    for (const [name, a] of [['trùng 1 câu', [...all, all[0]]], ['thừa câu ngoài đợt', [...all, { questionId: FAKE, result: 1 }]]] as [string, any[]][]) {
      const r = await postPublic(`public/surveys/${BIG.id}/responses`, { channel: 1, answers: a }); expect(r.status, `${name} → ${r.status}`).toBeGreaterThanOrEqual(400);
    }
    expect(await countOf(BIG.id)).toBe(before);
  });
  test(tc('PUB-A34'), async ({ page }) => {
    test.setTimeout(75_000);
    await mockOk(page); const reqs = posted(page);
    for (let i = 0; i < 2; i++) { await openForm(page, SMALL.id); expect(page.url()).not.toContain('login'); await answerAll(page, SMALL.questionCount); await submit(page).click(); await settle(page); }
    expect(reqs).toHaveLength(2);
  });
  test(tc('PUB-A35'), async ({ page }) => {
    await mockOk(page); await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount); await submit(page).click(); await settle(page);
    await expect(page.getByRole('button', { name: /khảo sát đang mở|Xem khảo sát khác/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /khảo sát đang mở|Xem khảo sát khác/i }).first().click(); await settle(page);
    expect(page.url()).toMatch(/\/respond\/?$/);
  });
  test(tc('PUB-A36'), async ({ page }) => {
    const reqs = posted(page); await page.route('**/api/v1/public/surveys/*/responses', async r => { await new Promise(f => setTimeout(f, 1200)); await r.fulfill({ status: 200, contentType: 'application/json', body: OK }); });
    await openForm(page, SMALL.id); await answerAll(page, SMALL.questionCount); await submit(page).click(); await page.waitForTimeout(400);
    expect(await body(page), 'chưa xác nhận lưu thì chưa hiện màn thành công').not.toMatch(/Cảm ơn/);
    await expect(page.getByText(/Cảm ơn/).first()).toBeVisible({ timeout: 8000 }); expect(await body(page)).toContain(SMALL.name); expect(reqs).toHaveLength(1);
  });
  test(tc('PUB-A37'), async () => {
    // Gửi nhanh các yêu cầu KHÔNG hợp lệ (answers rỗng) nên không tạo phiếu; kiểm máy chủ có giới hạn tần suất (429 + Retry-After)
    let limited: any = null;
    for (let i = 0; i < 12 && !limited; i++) {
      const r = await fetch(`${API_BASE}/api/v1/public/surveys/${SMALL.id}/responses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 1, answers: [] }) });
      if (r.status === 429) limited = r.headers.get('retry-after');
    }
    expect(limited, 'phải có biện pháp hạn chế gửi hàng loạt (429)').toBeTruthy();
  });
});

test.describe('Khảo sát công khai — responsive', () => {
  test(tc('PUB-R01'), async ({ browser }) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 800 }, storageState: { cookies: [], origins: [] } }); const p = await c.newPage();
    await openList(p); const w = await p.evaluate(() => document.documentElement.scrollWidth); expect(w).toBeLessThanOrEqual(392);
    expect(await p.getByRole('button', { name: /Tham gia khảo sát/ }).count()).toBe(PUBL.length);
    expect(await p.getByRole('button', { name: /Các khảo sát đang mở/ }).count(), 'mobile bỏ nút trùng ở góc phải').toBeLessThanOrEqual(1); await c.close();
  });
  test(tc('PUB-R02'), async ({ browser }) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 800 }, storageState: { cookies: [], origins: [] } }); const p = await c.newPage();
    await openForm(p, BIG.id); const sub = p.getByRole('button', { name: /Gửi đánh giá/ }).last(); await expect(sub).toBeVisible();
    const box = await sub.boundingBox(); expect(box!.y + box!.height).toBeGreaterThan(700);
    const prog = await p.getByText(/Đã trả lời/).first().boundingBox(); const q1 = await p.getByText(/^1\./).first().boundingBox(); expect(prog!.y, 'tiến độ nằm trước các câu hỏi trên mobile').toBeLessThan(q1!.y); await c.close();
  });
  test(tc('PUB-R03'), async ({ browser }) => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } }); const p = await c.newPage();
    await openForm(p, BIG.id); const sub = await p.getByRole('button', { name: /Gửi đánh giá/ }).first().boundingBox(); const q = await p.getByText(/^1\./).first().boundingBox();
    expect(sub!.x, 'khối Gửi đánh giá ở cột phải').toBeGreaterThan(q!.x + 300); expect(await body(p)).toMatch(/Trả lời đủ \d+ câu/); await c.close();
  });
  test(tc('PUB-R04'), async ({ browser }) => {
    for (const vp of [{ width: 390, height: 800 }, { width: 1280, height: 900 }]) {
      const c = await browser.newContext({ viewport: vp, storageState: { cookies: [], origins: [] } }); const p = await c.newPage(); await mockOk(p);
      await openForm(p, SMALL.id); await answerAll(p, SMALL.questionCount); await p.getByRole('button', { name: /Gửi đánh giá/ }).last().click(); await settle(p);
      await expect(p.getByText(/Cảm ơn/).first()).toBeVisible(); expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width + 2); await c.close();
    }
  });
  skipped(['PUB-R05'], 'CHƯA TỰ ĐỘNG HOÁ: kiểm tải nhiều người dùng đồng thời cần công cụ tải chuyên dụng (k6/JMeter), không thuộc Playwright');
});
void choose;
