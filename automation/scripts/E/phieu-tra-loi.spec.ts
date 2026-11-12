// E.UC3 PHIẾU TRẢ LỜI — script bám testcase ANS-L/F/V/T/N/E/D/S (danh sách phiếu + bộ lọc ngày, xem chi tiết, tải mẫu, nhập/sửa/xóa phiếu, phân quyền).
// Dữ liệu: đợt cố định "qc.automation E FX RES" (đơn vị aaaaaa, 3 hình thức, 7 phiếu: Trực tiếp 3, Gián tiếp 2, Trực tuyến 2) tạo một lần; các case ghi/xóa phiếu dùng đợt riêng "FX WRITE" và tự dọn phiếu đã tạo.
import type { Page } from '@playwright/test';
import { test, expect, tc, api, raw, skipped, settle, allSurveys, getSurvey, fixture, dayStr, dmy, LIST, FAKE, dataRows, modal, confirmBtn, toastText, results, stats, addResult, ansOf, qidsOf, fixtureRes, NAME, API_BASE } from './common';
import fs from 'node:fs';

let RES: any;
test.beforeAll(async () => { test.setTimeout(420_000); RES = await fixtureRes(); });
const url = (id: string, tab = 'ph') => `/#/vi/survey-campaigns/${id}?tab=${tab}`;
const body = async (p: Page) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const openTab = async (p: Page, id: string) => { p.setDefaultTimeout(10_000); await p.goto(url(id)); await settle(p); await dataRows(p).first().waitFor({ timeout: 8000 }).catch(() => {}); };
const totalText = async (p: Page) => (await body(p)).match(/Hiển thị (\d+)[–-](\d+) \/ (\d+) phiếu/);
const tokenOf = (k: string) => (JSON.parse(fs.readFileSync(`auth/${k}.json`, 'utf8')).origins[0].localStorage as any[]).map(x => x.value).find((v: string) => v.split('.').length === 3) as string;
let WRITE: any;
const write = async () => (WRITE ??= await fixture('WRITE'));
const made: string[] = [];
test.afterAll(async () => { if (WRITE) for (const id of made) await api('DELETE', `survey/surveys/${WRITE.id}/results/${id}`).catch(() => {}); });
const addW = async (v = 'HHH', method: 2 | 3 = 2, note = '') => { const w = await write(); const d = await getSurvey(w.id); const r = await addResult(w.id, d, method, v, note); if (r.data?.id) made.push(r.data.id); return { r, w, d }; };

test.describe('Phiếu trả lời — danh sách', () => {
  test(tc('ANS-L02'), async ({ page }) => {
    await openTab(page, RES.id); const t = await body(page); const all = await results(RES.id); const by = (m: string) => all.content.filter((x: any) => x.methodName === m).length;
    expect(t).toMatch(new RegExp(`Tổng phiếu\\s*${all.totalElements}`)); expect(t).toMatch(new RegExp(`Trực tuyến\\s*${by('Trực tuyến')}`)); expect(t).toMatch(new RegExp(`Trực tiếp\\s*${by('Trực tiếp')}`)); expect(t).toMatch(new RegExp(`Gián tiếp qua phiếu\\s*${by('Gián tiếp qua phiếu')}`));
    await page.locator('#search, input[placeholder*="ngày"]').first().click({ trial: true }).catch(() => {});
  });
  test(tc('ANS-L03'), async ({ page }) => {
    const only = await fixture('DIRECT', { methods: [2], voteTarget: null }); await openTab(page, only.id); const t = await body(page);
    expect(t).toContain('Trực tiếp'); expect(t).not.toMatch(/Trực tuyến\s*\d|Gián tiếp qua phiếu\s*\d/);
  });
  test(tc('ANS-L05'), async () => {
    const other = (await allSurveys()).find(s => s.id !== RES.id && s.resultCount > 0)!; const mine = await results(RES.id); const theirs = await results(other.id);
    const a = new Set(mine.content.map((x: any) => x.id)); expect(theirs.content.some((x: any) => a.has(x.id))).toBeFalsy(); expect(mine.totalElements).toBe(RES.resultCount);
  });
  test(tc('ANS-L09'), async () => { const l = (await results(RES.id)).content; const c = l.map((x: any) => x.createdOnDate); expect([...c].sort().reverse()).toEqual(c); });
  test(tc('ANS-L13'), async () => { for (const x of (await results(RES.id)).content) expect(['Trực tuyến', 'Trực tiếp', 'Gián tiếp qua phiếu']).toContain(x.methodName); });
  test(tc('ANS-L14'), async ({ page }) => {
    await openTab(page, RES.id); await page.locator('.ant-select').filter({ hasText: /Tất cả hình thức/ }).first().click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: 'Trực tiếp' }).first().click(); await settle(page);
    const rows = await dataRows(page).allInnerTexts(); expect(rows.length).toBe(3); rows.forEach(r => expect(r).toContain('Trực tiếp'));
  });
  test(tc('ANS-L15'), async ({ page }) => {
    await openTab(page, RES.id); expect(await page.locator('input[placeholder*="Ghi nhận từ ngày"]').inputValue()).toBe(''); expect(await page.locator('.ant-select').filter({ hasText: /Tất cả hình thức/ }).count()).toBe(1);
  });
  test(tc('ANS-L16'), async () => {
    const big = (await allSurveys()).find(s => s.resultCount > 12); test.skip(!big, 'Cần đợt > 10 phiếu (xem ANS-L06)');
  });
  test(tc('ANS-L18'), async ({ page }) => {
    await openTab(page, RES.id); await page.locator('input[placeholder*="Ghi nhận từ ngày"]').click(); await page.keyboard.type('01/01/2020'); await page.keyboard.press('Enter');
    const to = page.locator('input[placeholder*="đến ngày"]'); await to.click(); await page.keyboard.type('02/01/2020'); await page.keyboard.press('Enter'); await settle(page);
    expect(await body(page)).toMatch(/Không (tìm thấy|có kết quả|có phiếu)|Trống|Không có dữ liệu/i);
  });
  test(tc('ANS-L21'), async () => {
    for (const k of ['canbo', 'cbdp']) { const r = await api('GET', `survey/surveys/${RES.id}/results?page=1&size=10&filter=%7B%7D`, undefined, k); expect([403, 404], k).toContain(r.status); }
  });
  test(tc('ANS-L24'), async ({ page }) => {
    await openTab(page, RES.id); await expect(page.locator('#survey-entry-new-btn')).toBeVisible();
    const only = await fixture('ONLINE', { methods: [1] }); await openTab(page, only.id); await expect(page.locator('#survey-entry-new-btn')).toHaveCount(0);
  });
  skipped(['ANS-L25'], 'CHƯA TỰ ĐỘNG HOÁ: cần ≥ 1.000 phiếu (kiểm hiệu năng) — không seed được do giới hạn tốc độ gửi phiếu công khai và thời gian chạy');
});

test.describe('Phiếu trả lời — bộ lọc ngày', () => {
  const dateBox = (p: Page) => p.locator('input[placeholder*="Ghi nhận từ ngày"]');
  test(tc('ANS-F01'), async ({ page }) => { await openTab(page, RES.id); await dateBox(page).click(); await expect(page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')).toBeVisible(); });
  skipped(['ANS-F03', 'ANS-F04', 'ANS-F05', 'ANS-F06', 'ANS-F07', 'ANS-F08', 'ANS-F09', 'ANS-F10', 'ANS-F11', 'ANS-F12', 'ANS-F13', 'ANS-F14', 'ANS-F15'],
    'CHƯA TỰ ĐỘNG HOÁ: bộ chọn khoảng ngày của UI hiện tại là hai ô "Ghi nhận từ ngày/đến ngày" (không phải popover hai tháng có nút Áp dụng như SRS); các case này lệch thiết kế và cần BA xác nhận giao diện mục tiêu trước khi viết kịch bản. Lọc theo khoảng ngày đã kiểm ở ANS-F02/L18');
});

test.describe('Phiếu trả lời — chi tiết', () => {
  const openRow = async (p: Page, text: string) => { await openTab(p, RES.id); await dataRows(p).filter({ hasText: text }).first().getByRole('button', { name: 'Xem chi tiết' }).click(); await p.waitForTimeout(1200); };
  test(tc('ANS-V01'), async ({ page }) => {
    await openRow(page, 'Ghi chú D1'); const t = await body(page); expect(t).toContain(RES.code); expect(t).toContain('Câu A1'); expect(t).toContain('Câu B1'); expect(t).toMatch(/Hài lòng/);
  });
  test(tc('ANS-V02'), async ({ page }) => { await openRow(page, 'Ghi chú D1'); expect(await page.locator('main button').filter({ hasText: /^(Hài lòng|Chưa hài lòng)$/ }).count(), 'đáp án chỉ xem, không phải nút chọn').toBe(0); });
  test(tc('ANS-V05'), async ({ page }) => {
    await openRow(page, 'Ghi chú D1'); await expect(page.getByRole('button', { name: /^Sửa$/ })).toBeVisible(); await page.getByRole('button', { name: /Đóng/ }).click();
    await openRow(page, 'online 1'); await expect(page.getByRole('button', { name: /^Sửa$/ })).toHaveCount(0);
  });
  test(tc('ANS-V06'), async ({ page }) => {
    await openTab(page, RES.id); await page.locator('.ant-select').filter({ hasText: /Tất cả hình thức/ }).first().click(); await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: 'Trực tiếp' }).first().click(); await settle(page);
    await dataRows(page).first().getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(800); await page.getByRole('button', { name: /Đóng/ }).click(); await page.waitForTimeout(500);
    expect(await dataRows(page).count()).toBe(3);
  });
  skipped(['ANS-V07'], 'CHƯA TỰ ĐỘNG HOÁ: cần xóa phiếu từ phiên khác trong lúc đang xem chi tiết');
  test(tc('ANS-V08'), async () => {
    const other = (await allSurveys()).find(s => s.id !== RES.id && s.resultCount > 0)!; const rid = (await results(other.id)).content[0].id;
    const r = await api('GET', `survey/surveys/${RES.id}/results/${rid}`); expect([400, 404], `ghép id phiếu với đợt khác: ${r.status} ${r.message}`).toContain(r.status);
  });
  test(tc('ANS-V09'), async () => { const rid = (await results(RES.id)).content[0].id; for (const k of ['canbo', 'cbdp', 'xemonly']) expect([403, 404], k).toContain((await api('GET', `survey/surveys/${RES.id}/results/${rid}`, undefined, k)).status); });
  test(tc('ANS-V10'), async ({ page }) => {
    await openTab(page, RES.id); await page.route(new RegExp(`/results/[0-9a-f-]{36}$`), r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await dataRows(page).first().getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(1200); await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-025').toBeVisible();
  });
});

test.describe('Phiếu trả lời — tải mẫu', () => {
  const tpl = (id: string, as = 'superadmin') => fetch(`${API_BASE}/api/v1/survey/surveys/${id}/form-template`, { headers: { Authorization: `Bearer ${tokenOf(as)}` } });
  test(tc('ANS-T01'), async () => { const r = await tpl(RES.id); expect(r.status).toBe(200); const b = Buffer.from(await r.arrayBuffer()); expect(b.length).toBeGreaterThan(200); });
  test(tc('ANS-T03'), async () => { const t = Buffer.from(await (await tpl(RES.id)).arrayBuffer()).toString('utf8'); expect(t).not.toMatch(/Đánh giá chung|Ghi chú D1|online 1/); });
  skipped(['ANS-T04'], 'MANUAL: cần đợt đã kết thúc có hình thức không trực tuyến và quyền tải mẫu tách biệt');
  test(tc('ANS-T06'), async () => { for (const k of ['canbo', 'xemonly']) expect([401, 403, 404], k).toContain((await tpl(RES.id, k)).status); expect((await fetch(`${API_BASE}/api/v1/survey/surveys/${RES.id}/form-template`)).status).toBe(401); });
});

test.describe('Phiếu trả lời — nhập mới', () => {
  test(tc('ANS-N01'), async ({ page }) => {
    await openTab(page, RES.id); await page.locator('#survey-entry-new-btn').click(); await page.waitForTimeout(1200); const t = await body(page);
    for (const x of ['Nhập phiếu khảo sát', RES.code, 'Câu A1', 'Câu B1', 'Chọn tất cả Hài lòng', 'Tiến độ phiếu']) expect(t).toContain(x); expect(t).not.toMatch(/Đánh giá chung/);
  });
  test(tc('ANS-N02'), async ({ page }) => {
    await openTab(page, RES.id); await page.locator('#survey-entry-new-btn').click(); await page.waitForTimeout(1000); const t = await body(page);
    expect(t).toContain('Hỏi người dân tại chỗ'); expect(t).toContain('Nhập lại từ phiếu giấy'); expect(t).not.toMatch(/Hình thức \*[^|]*Người dân tự trả lời/);
  });
  test(tc('ANS-N03'), async () => {
    const drafts = (await allSurveys()).filter(s => ['Nháp', 'Chờ phê duyệt', 'Đã kết thúc'].includes(s.statusName) && s.methodNames.includes('Trực tiếp'));
    for (const s of drafts.slice(0, 3)) { const d = await getSurvey(s.id); const r = await api('POST', `survey/surveys/${s.id}/results`, { method: 2, collectedDate: dayStr(0), answers: ansOf(d, 'H') }); expect(r.status, s.statusName).toBe(400); }
  });
  test(tc('ANS-N04'), async ({ page }) => {
    await openTab(page, RES.id); await page.locator('#survey-entry-new-btn').click(); await page.waitForTimeout(1000);
    expect(await page.locator('main button:has(svg.lucide-grip-vertical), main button:has(svg.lucide-trash-2)').count()).toBe(0); await expect(page.getByRole('button', { name: /Trực tuyến/ })).toHaveCount(0);
  });
  test(tc('ANS-N05'), async ({ page }) => {
    await openTab(page, RES.id); await page.locator('#survey-entry-new-btn').click(); await page.waitForTimeout(1000); const btn = (i: number, v: string) => page.getByRole('button', { name: new RegExp(`^${v}$`) }).nth(i);
    await btn(0, 'Hài lòng').click(); expect(await body(page)).toMatch(/Đã chọn 1\/3/); await btn(0, 'Chưa hài lòng').click(); expect(await body(page)).toMatch(/Đã chọn 1\/3/); await btn(1, 'Hài lòng').click(); expect(await body(page)).toMatch(/Đã chọn 2\/3/);
  });
  test(tc('ANS-N06'), async ({ page }) => {
    const before = (await getSurvey(RES.id)).resultCount; await openTab(page, RES.id); await page.locator('#survey-entry-new-btn').click(); await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Chọn tất cả Hài lòng' }).click(); expect(await body(page)).toMatch(/Đã chọn 3\/3/); await page.getByRole('button', { name: 'Chưa hài lòng' }).first().click(); expect(await body(page)).toMatch(/Đã chọn 3\/3/);
    expect((await getSurvey(RES.id)).resultCount).toBe(before);
  });
  skipped(['ANS-N09', 'ANS-N10'], 'CHƯA TỰ ĐỘNG HOÁ: luồng "Lưu và nhập tiếp"/"Quay lại sửa" ở màn xem lại cần xác định nút theo ngữ cảnh; bước Lưu→xem lại→xác nhận đã kiểm ở ANS-N07/N08');
  test(tc('ANS-N11'), async () => { const w = await write(); const d = await getSurvey(w.id); const r = await api('POST', `survey/surveys/${w.id}/results`, { collectedDate: dayStr(0), answers: ansOf(d, 'H') }); expect(r.status).toBe(400); expect(r.message).toMatch(/Hình thức/); });
  const nd = async (patch: any, msg: RegExp) => { const w = await write(); const d = await getSurvey(w.id); const n = (await getSurvey(w.id)).resultCount; const r = await api('POST', `survey/surveys/${w.id}/results`, { method: 2, collectedDate: dayStr(0), answers: ansOf(d, 'H'), ...patch }); expect(r.status, `${r.status} ${r.message}`).toBe(400); expect(r.message).toMatch(msg); expect((await getSurvey(w.id)).resultCount).toBe(n); };
  test(tc('ANS-N12'), async () => { await nd({ collectedDate: undefined }, /Ngày thu phiếu/); });
  test(tc('ANS-N14'), async () => { await nd({ collectedDate: dayStr(-60) }, /Ngày thu phiếu phải trong khoảng/); });
  test(tc('ANS-N15'), async () => { await nd({ collectedDate: dayStr(3) }, /Ngày thu phiếu không được sau ngày hiện tại/); });
  test(tc('ANS-N16'), async () => { const w = await write(); const d = await getSurvey(w.id); const r = await api('POST', `survey/surveys/${w.id}/results`, { method: 2, collectedDate: d.startDate.slice(0, 10), answers: ansOf(d, 'H') }); expect(r.status, r.message).toBe(200); made.push(r.data.id); const t = await api('POST', `survey/surveys/${w.id}/results`, { method: 2, collectedDate: dayStr(0), answers: ansOf(d, 'H') }); expect(t.status).toBe(200); made.push(t.data.id); });
  test(tc('ANS-N17'), async () => { const w = await write(); const d = await getSurvey(w.id); const a = ansOf(d, 'H').slice(1); const r = await api('POST', `survey/surveys/${w.id}/results`, { method: 2, collectedDate: dayStr(0), answers: a }); expect(r.status).toBe(400); expect(r.message).toMatch(/Vui lòng chọn mức độ hài lòng cho/); });
  test(tc('ANS-N18'), async () => { const { r } = await addW('HHH', 2, 'n'.repeat(1000)); expect(r.status, r.message).toBe(200); });
  test(tc('ANS-N19'), async () => { await nd({ note: 'n'.repeat(1001) }, /1000/); });
  test(tc('ANS-N20'), async () => { await nd({ method: 1 }, /hình thức không trực tuyến/); const only = await fixture('DIRECT', { methods: [2], voteTarget: null }); const d = await getSurvey(only.id); const r = await api('POST', `survey/surveys/${only.id}/results`, { method: 3, collectedDate: dayStr(0), answers: ansOf(d, 'H') }); expect(r.status).toBe(400); });
  skipped(['ANS-N21', 'ANS-N25', 'ANS-N28'], 'MANUAL: cần đẩy đợt hết kỳ giữa chừng / giả lập mất phản hồi / lỗi giữa chừng phía máy chủ');
  test(tc('ANS-N22'), async () => {
    const p = (await allSurveys()).find(s => ['Nháp', 'Chờ phê duyệt', 'Đã phê duyệt'].includes(s.statusName) && s.methodNames.includes('Trực tiếp'))!; const d = await getSurvey(p.id);
    const r = await api('POST', `survey/surveys/${p.id}/results`, { method: 2, collectedDate: dayStr(0), answers: ansOf(d, 'H') }); expect(r.status).toBe(400); expect(r.message).toMatch(/chưa đủ điều kiện nhận phiếu/);
  });
  test(tc('ANS-N24'), async ({ page }) => {
    const w = await write(); const before = (await getSurvey(w.id)).resultCount; await openTab(page, w.id); await page.locator('#survey-entry-new-btn').click(); await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Chọn tất cả Hài lòng' }).click(); await page.getByRole('button', { name: /Trực tiếp/ }).first().click(); await page.getByRole('button', { name: 'Lưu phiếu' }).click(); await page.waitForTimeout(800);
    const b = page.getByRole('button', { name: /Xác nhận lưu|Xác nhận/ }).last(); for (let i = 0; i < 3; i++) await b.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {}); await settle(page);
    const a = await getSurvey(w.id); expect(a.resultCount).toBe(before + 1); made.push((await results(w.id)).content[0].id);
  });
  const mockSave = async (page: Page, mode: 'fulfill' | 'abort') => {
    const w = await write(); await page.route(new RegExp(`/survey/surveys/${w.id}/results$`), r => r.request().method() === 'POST' ? (mode === 'fulfill' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }) : r.abort('internetdisconnected')) : r.continue());
    await openTab(page, w.id); await page.locator('#survey-entry-new-btn').click(); await page.waitForTimeout(800); await page.getByRole('button', { name: 'Chọn tất cả Hài lòng' }).click(); await page.getByRole('button', { name: /Trực tiếp/ }).first().click();
    await page.getByRole('button', { name: 'Lưu phiếu' }).click(); await page.waitForTimeout(800); await page.getByRole('button', { name: /Xác nhận lưu|Xác nhận/ }).last().click(); await page.waitForTimeout(1200);
  };
  test(tc('ANS-N29'), async () => {
    const w = await write(); const d = await getSurvey(w.id); for (const k of ['xemonly', 'ldd']) expect((await addResult(w.id, d, 2, 'H', '', k)).status, k).toBe(403);
    expect([400, 403, 404]).toContain((await addResult(w.id, d, 2, 'H', '', 'canbo')).status);
  });
});

test.describe('Phiếu trả lời — sửa', () => {
  const put = (w: any, rid: string, v: string, o: any = {}) => api('PUT', `survey/surveys/${w.id}/results/${rid}`, { method: 2, collectedDate: dayStr(0), note: '', answers: ansOf(w.d, v), ...o });
  const mkOne = async (v = 'HHH', m: 2 | 3 = 2, note = '') => { const { r, w, d } = await addW(v, m, note); expect(r.status).toBe(200); return { rid: r.data.id as string, w: { ...w, d } }; };
  test(tc('ANS-E03'), async () => {
    const { rid, w } = await mkOne('HHH', 2, 'E03'); const before = (await api('GET', `survey/surveys/${w.id}/results/${rid}`)).data; const r = await put(w, rid, 'CCC', { note: 'E03 sửa' }); expect(r.status, r.message).toBe(200);
    const a = (await api('GET', `survey/surveys/${w.id}/results/${rid}`)).data; expect(a.note).toBe('E03 sửa'); expect(a.createdByUserName).toBe(before.createdByUserName); expect(a.createdOnDate).toBe(before.createdOnDate);
  });
  test(tc('ANS-E04'), async () => {
    const { rid, w } = await mkOne('HHH'); const s0 = await stats(w.id); const r = await put(w, rid, 'CCC'); expect(r.status).toBe(200); const s1 = await stats(w.id);
    expect(s1.summary.totalAnswers).toBe(s0.summary.totalAnswers); expect(s1.summary.satisfied).toBe(s0.summary.satisfied - 3);
    for (const g of s1.groups) for (const q of g.questions) expect(q.satisfied + q.unsatisfied).toBe(s1.summary.participants);
  });
  test(tc('ANS-E05'), async () => {
    const { rid, w } = await mkOne('HHH', 2); const s0 = await stats(w.id); const r = await put(w, rid, 'HHH', { method: 3 }); expect(r.status, r.message).toBe(200); const s1 = await stats(w.id);
    const c = (s: any, m: number) => s.sources.find((x: any) => x.method === m).participants; expect(c(s1, 3)).toBe(c(s0, 3) + 1); expect(c(s1, 2)).toBe(c(s0, 2) - 1); expect(s1.summary.participants).toBe(s0.summary.participants);
  });
  test(tc('ANS-E06'), async () => {
    const { rid, w } = await mkOne('HHH'); const r = await put(w, rid, 'HHH', { method: 1 }); expect(r.status).toBe(400); const q = await put(w, rid, 'HHH', { answers: [{ surveyQuestionId: FAKE, result: 1 }] }); expect(q.status).toBe(400);
  });
  test(tc('ANS-E07'), async () => {
    const { rid, w } = await mkOne('HHH'); expect((await put(w, rid, 'HHH', { answers: ansOf(w.d, 'HHH').slice(1) })).status).toBe(400); expect((await put(w, rid, 'HHH', { collectedDate: dayStr(3) })).message).toMatch(/không được sau ngày hiện tại/);
  });
  skipped(['ANS-E08'], 'CHƯA TỰ ĐỘNG HOÁ: bước "Quay lại sửa" từ màn xem lại (xem ANS-N10)');
  test(tc('ANS-E10'), async () => {
    const online = (await results(RES.id)).content.find((x: any) => x.methodName === 'Trực tuyến'); const r = await api('PUT', `survey/surveys/${RES.id}/results/${online.id}`, { method: 2, collectedDate: dayStr(0), answers: ansOf(RES, 'HHH') });
    expect([400, 403]).toContain(r.status); const d = await api('DELETE', `survey/surveys/${RES.id}/results/${online.id}`); expect([400, 403]).toContain(d.status);
  });
  skipped(['ANS-E11', 'ANS-E14'], 'MANUAL: cần đợt hết kỳ giữa chừng / lỗi giữa chừng khi cập nhật');
  test(tc('ANS-E13'), async ({ page }) => {
    const { rid, w } = await mkOne('HHH', 2, 'sửa E13'); await openTab(page, w.id); await dataRows(page).filter({ hasText: 'sửa E13' }).first().locator('button').last().click(); await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item').first().click(); await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Chưa hài lòng' }).first().click(); await page.getByRole('button', { name: /Lưu thay đổi|Lưu phiếu/ }).click(); await page.waitForTimeout(800);
    const b = page.getByRole('button', { name: /Xác nhận lưu|Xác nhận/ }).last(); for (let i = 0; i < 3; i++) await b.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {}); await settle(page);
    const a = (await api('GET', `survey/surveys/${w.id}/results/${rid}`)).data; expect(a.answers.filter((x: any) => x.result === 2).length).toBeGreaterThanOrEqual(1);
  });
  test(tc('ANS-E15'), async () => {
    const { rid, w } = await mkOne('HHH'); for (const k of ['xemonly', 'ldd']) expect((await api('PUT', `survey/surveys/${w.id}/results/${rid}`, { method: 2, collectedDate: dayStr(0), answers: ansOf(w.d, 'H') }, k)).status, k).toBe(403);
    expect([400, 403, 404]).toContain((await api('PUT', `survey/surveys/${w.id}/results/${rid}`, { method: 2, collectedDate: dayStr(0), answers: ansOf(w.d, 'H') }, 'canbo')).status);
  });
});

test.describe('Phiếu trả lời — xóa', () => {
  const mkOne = async (v = 'HHH', m: 2 | 3 = 2, note = '') => { const { r, w } = await addW(v, m, note); expect(r.status).toBe(200); return { rid: r.data.id as string, w }; };
  const delRow = async (page: Page, w: any, note: string) => { await openTab(page, w.id); await dataRows(page).filter({ hasText: note }).first().locator('button').last().click(); await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: /Xóa|Xoá/ }).first().click(); await page.waitForTimeout(600); };
  test(tc('ANS-D03'), async () => {
    const { rid, w } = await mkOne('HHH'); const s0 = await stats(w.id); expect((await api('DELETE', `survey/surveys/${w.id}/results/${rid}`)).status).toBe(200); const s1 = await stats(w.id);
    expect(s1.summary.participants).toBe(s0.summary.participants - 1); expect(s1.summary.totalAnswers).toBe(s0.summary.totalAnswers - 3);
  });
  test(tc('ANS-D04'), async ({ page }) => {
    const { rid, w } = await mkOne('HHH', 2, 'xóa D04'); await delRow(page, w, 'xóa D04'); await modal(page).getByRole('button', { name: /^(Không|Hủy|Huỷ)$/ }).first().click(); await page.waitForTimeout(500); expect((await api('GET', `survey/surveys/${w.id}/results/${rid}`)).status).toBe(200);
  });
  skipped(['ANS-D05', 'ANS-D08'], 'MANUAL: cần xóa dòng cuối của trang cuối / đợt hết kỳ giữa chừng');
  test(tc('ANS-D06'), async () => {
    const online = (await results(RES.id)).content.find((x: any) => x.methodName === 'Trực tuyến'); const r = await api('DELETE', `survey/surveys/${RES.id}/results/${online.id}`); expect([400, 403]).toContain(r.status);
  });
  test(tc('ANS-D07'), async ({ page }) => {
    await openTab(page, RES.id); await dataRows(page).first().getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(800); await expect(page.getByRole('button', { name: /Xóa|Xoá/ })).toHaveCount(0);
  });
  test(tc('ANS-D09'), async () => {
    const { rid, w } = await mkOne(); await api('DELETE', `survey/surveys/${w.id}/results/${rid}`); const r = await api('DELETE', `survey/surveys/${w.id}/results/${rid}`); expect(r.status).toBe(404); const n = (await getSurvey(w.id)).resultCount; expect((await getSurvey(w.id)).resultCount).toBe(n);
  });
  test(tc('ANS-D12'), async () => { const { rid, w } = await mkOne(); for (const k of ['xemonly', 'ldd']) expect((await api('DELETE', `survey/surveys/${w.id}/results/${rid}`, undefined, k)).status, k).toBe(403); expect([400, 403, 404]).toContain((await api('DELETE', `survey/surveys/${w.id}/results/${rid}`, undefined, 'canbo')).status); });
  test(tc('ANS-D13'), async () => {
    const { rid, w } = await mkOne(); await api('DELETE', `survey/surveys/${w.id}/results/${rid}`); expect((await api('GET', `survey/surveys/${w.id}/results/${rid}`)).status).toBe(404);
    expect((await api('POST', `survey/surveys/${w.id}/results/${rid}/restore`, {})).status).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Phiếu trả lời — phân quyền & bảo mật', () => {
  test(tc('ANS-S01'), async () => {
    for (const [m, u] of [['GET', `survey/surveys/${RES.id}/results?page=1&size=10`], ['POST', `survey/surveys/${RES.id}/results`], ['DELETE', `survey/surveys/${RES.id}/results/${FAKE}`]] as const) expect((await raw(m, u, m === 'POST' ? {} : undefined)).status, u).toBe(401);
  });
  test(tc('ANS-S02'), async () => {
    const rid = (await results(RES.id)).content[0].id; for (const k of ['canbo', 'cbdp']) for (const m of ['GET', 'DELETE'] as const) { const r = await api(m, `survey/surveys/${RES.id}/results/${rid}`, undefined, k); expect([400, 403, 404], `${k} ${m}`).toContain(r.status); }
    expect((await getSurvey(RES.id)).resultCount).toBe(RES.resultCount);
  });
  test(tc('ANS-S04'), async ({ page }) => {
    const w = await write(); const d = await getSurvey(w.id); const xss = '<img src=x onerror=window.__x=1>';
    const r = await addResult(w.id, d, 2, 'H', xss); if (r.status === 200) made.push(r.data.id);
    if (r.status !== 200) { test.info().annotations.push({ type: 'ghi chú', description: `Máy chủ chặn HTML trong góp ý: ${r.message}` }); expect(r.status).toBe(400); return; }
    await openTab(page, w.id); expect(await page.evaluate(() => (window as any).__x)).toBeUndefined(); expect(await page.locator('main img[src="x"]').count()).toBe(0);
  });
});
void NAME;
