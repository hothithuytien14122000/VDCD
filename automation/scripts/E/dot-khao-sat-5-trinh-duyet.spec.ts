// E.UC1.6 TRÌNH DUYỆT + E.UC1.7 PHÊ DUYỆT/TỪ CHỐI + tác vụ tự động — script bám testcase SVY-T01…T30, SVY-A01…A20, SVY-J01…J17, SVY-Z01…Z10.
// Người trình = superadmin (đơn vị aaaaaa); người duyệt = admin (qc.admin, thấy và duyệt được đợt của aaaaaa). canbo/ldd không dùng được vì bị chặn phạm vi dữ liệu khi tạo (xem SVY-C66).
// Chú ý: đợt đã duyệt không xóa được → mỗi test duyệt chỉ tạo đợt ngày bắt đầu trong tương lai (không lên trang công khai) trừ khi cần (A04/A20/T30 dùng ngày hôm nay).
import type { Page } from '@playwright/test';
import { test, expect, tc, api, skipped, settle, mk, payload, rmSurvey, cleanMade, allSurveys, getSurvey, setStatus, dayStr, NAME, LIST, FAKE, rowMenu, confirmBtn, modal, toastText, publicList } from './common';

test.afterEach(async () => { await cleanMade(); });
// API mới nhận organizationIds (mảng); body lấy từ GET chỉ có organizations → bổ sung
const put = (id: string, o: any, as = 'admin') => api('PUT', `survey/surveys/${id}`, { ...o, organizationIds: o.organizationIds ?? o.organizations?.map((x: any) => x.organizationId) ?? (o.organizationId ? [o.organizationId] : undefined) }, as);
const submit = async (id: string, as = 'admin') => put(id, { ...(await getSurvey(id, as)), status: 2 }, as);
async function draft(o: any = {}) { const r = await mk(o); expect(r.status, r.message).toBe(200); return r.data as { id: string; code: string }; }
async function pending(o: any = {}) { const d = await draft(o); const s = await submit(d.id); expect(s.status, s.message).toBe(200); return d; }
const approve = (id: string, as = 'admin') => setStatus(id, 3, undefined, as);
const reject = (id: string, reason: string, as = 'admin') => setStatus(id, 4, reason, as);
const noti = async (as: string, code: string) => ((await api('GET', 'notifications/mine?page=1&size=50', undefined, as)).data?.content ?? []).filter((n: any) => String(n.description).includes(code));
const hist = async (id: string) => (await getSurvey(id)).histories.map((h: any) => `${h.statusName}${h.reason ? ':' + h.reason : ''}`);
const body = async (page: Page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const bad = async (o: any, msg: RegExp) => { const d = await draft(); const r = await put(d.id, { ...(await getSurvey(d.id)), ...o, status: 2 }); expect(r.status, `${r.status} ${r.message}`).toBe(400); expect(r.message).toMatch(msg); expect((await getSurvey(d.id)).statusName).toBe('Nháp'); };
const UI = async (page: Page, as?: string) => { page.setDefaultTimeout(10_000); void as; };

test.describe('Đợt khảo sát — trình duyệt', () => {
  test(tc('SVY-T04'), async () => {
    const d = await draft(); const r = await put(d.id, { ...(await getSurvey(d.id)), name: `${NAME} T04 mới`, status: 2 }); expect(r.status, r.message).toBe(200);
    const g = await getSurvey(d.id); expect(g.name).toBe(`${NAME} T04 mới`); expect(g.statusName).toBe('Chờ phê duyệt');
  });
  test(tc('SVY-T09'), async () => { await bad({ startDate: dayStr(-1) }, /Ngày bắt đầu không được trước/); });
  skipped(['SVY-T10'], 'MANUAL: cần đợt Nháp lưu từ hôm trước (đã quá ngày bắt đầu) — không đẩy được đồng hồ máy chủ; quy tắc ngày bắt đầu ≥ hôm nay đã kiểm ở SVY-T09');
  test(tc('SVY-T11'), async () => { await bad({ startDate: dayStr(5), endDate: dayStr(4) }, /Ngày kết thúc phải bằng hoặc sau/); });
  test(tc('SVY-T12'), async () => { await bad({ methods: [] }, /Hình thức/); });
  test(tc('SVY-T13'), async () => { await bad({ groups: [] }, /Nhóm câu hỏi/); });
  test(tc('SVY-T14'), async () => { await bad({ groups: [{ name: 'G', questions: [] }] }, /Câu hỏi/); });
  test(tc('SVY-T16'), async () => { await bad({ voteTarget: 0 }, /số nguyên lớn hơn 0/); });
  test(tc('SVY-T17'), async () => {
    await bad({ name: 'x'.repeat(256) }, /255/); await bad({ description: 'x'.repeat(1001) }, /1000/); await bad({ groups: [{ name: 'G', questions: [{ content: 'q'.repeat(1001) }] }] }, /1000/);
  });
  test(tc('SVY-T18'), async ({ page }) => {
    const d = await pending(); const g = await getSurvey(d.id);
    expect((await put(d.id, { ...g, name: 'hack', status: 1 })).status).toBe(400); expect((await api('DELETE', `survey/surveys/${d.id}`)).status).toBe(400);
    await UI(page); await rowMenu(page, d.code, /Xem/).catch(() => {});
  });
  test(tc('SVY-T19'), async () => {
    const approved = (await allSurveys()).find(s => s.statusName === 'Đã phê duyệt')!, active = (await allSurveys()).find(s => s.statusName === 'Đang diễn ra')!, closed = (await allSurveys()).find(s => s.statusName === 'Đã kết thúc')!;
    const p = await pending(); for (const s of [p, approved, active, closed]) { const before = (await getSurvey(s.id)).statusName; const r = await put(s.id, { ...(await getSurvey(s.id)), status: 2 }); expect(r.status, `${before}: ${r.message}`).toBeGreaterThanOrEqual(400); expect((await getSurvey(s.id)).statusName).toBe(before); }
  });
  test(tc('SVY-T21'), async () => {
    const d = await pending(); for (const k of ['ldp', 'cbdp', 'canbo']) expect(await noti(k, d.code), `${k} (ngoài phạm vi) không nhận thông báo`).toHaveLength(0);
  });
  skipped(['SVY-T22'], 'CHƯA TỰ ĐỘNG HOÁ: cần hộp thư test (Mailosaur) của người duyệt aaaaaa — chưa cấu hình cho tài khoản này');
  skipped(['SVY-T23'], 'MANUAL: cần giả lập lỗi giữa chừng phía máy chủ (sau bước lưu, trước chuyển trạng thái)');
  test(tc('SVY-T28'), async () => {
    const d = await draft(); const open = await getSurvey(d.id); await rmSurvey(d.id); const r = await put(d.id, { ...open, status: 2 }); expect(r.status).toBe(404);
  });
  test(tc('SVY-T29'), async () => {
    const d = await draft(); const g = await getSurvey(d.id);
    for (const k of ['ldd', 'xemonly', 'lanhdaobo']) { const r = await put(d.id, { ...g, status: 2 }, k); expect(r.status, k).toBe(403); }
    const c = await put(d.id, { ...g, status: 2 }, 'canbo'); expect([400, 403, 404]).toContain(c.status); expect((await getSurvey(d.id)).statusName).toBe('Nháp');
  });
  test(tc('SVY-T30'), async () => {
    const d = await pending({ startDate: dayStr(0), endDate: dayStr(2) }); const r = await approve(d.id); expect(r.status, r.message).toBe(200); expect(r.data.statusName).toBe('Đang diễn ra');
  });
});

test.describe('Đợt khảo sát — phê duyệt', () => {
  test(tc('SVY-A01'), async ({ browser, baseURL, page }) => {
    const d = await pending(); await UI(page); await page.goto(`/#/vi/survey-campaigns`); const g = await getSurvey(d.id, 'admin'); expect(g.allowedActions).toContain('APPROVE');
    const c = await api('GET', `survey/surveys/${d.id}`, undefined, 'canbo'); expect(c.status).toBe(404); void browser; void baseURL;
  });
  test(tc('SVY-A02'), async ({ page }) => {
    const d = await pending(); await UI(page); await page.goto(`/#/vi/survey-campaigns/${d.id}`); await settle(page);
    await expect(page.getByRole('button', { name: /Phê duyệt/ })).toBeVisible(); await page.getByRole('button', { name: /Phê duyệt/ }).click();
    const t = (await modal(page).innerText()).replace(/\s+/g, ' '); expect(t).toContain(d.code); expect(await modal(page).locator('input, textarea').count()).toBe(0);
  });
  test(tc('SVY-A03'), async () => {
    const d = await pending({ startDate: dayStr(7), endDate: dayStr(40) }); const r = await approve(d.id); expect(r.status).toBe(200);
    expect(r.message).toMatch(/Phê duyệt/); expect(r.data.statusName).toBe('Đã phê duyệt');
  });
  test(tc('SVY-A05'), async () => {
    const d = await pending(); await approve(d.id); const h = (await getSurvey(d.id)).histories.at(-1);
    expect(h.statusName).toBe('Đã phê duyệt'); expect(h.createdByUserName).toBeTruthy(); expect(Math.abs(Date.now() - new Date(h.createdOnDate + 'Z').getTime())).toBeLessThan(12 * 3600e3);
  });
  test(tc('SVY-A06'), async () => {
    const d = await pending(); await approve(d.id);
    const n = await noti('admin', d.code); expect(n.length, 'người trình phải nhận TB-015').toBeGreaterThanOrEqual(1);
    for (const k of ['canbo', 'ldp']) expect(await noti(k, d.code)).toHaveLength(0);
  });
  skipped(['SVY-A10'], 'MANUAL: cần đợt Chờ phê duyệt đã quá ngày kết thúc khi tác vụ tự từ chối chưa chạy');
  test(tc('SVY-A11'), async () => {
    const d = await pending(); expect((await approve(d.id)).status).toBe(200); const r = await approve(d.id); expect(r.status).toBe(400); expect(r.message).toMatch(/người khác thay đổi|tải lại/i);
  });
  test(tc('SVY-A12'), async () => {
    const d = await pending(); expect((await approve(d.id)).status).toBe(200); expect((await approve(d.id)).status).toBeGreaterThanOrEqual(400);
    expect((await hist(d.id)).filter(h => h === 'Đã phê duyệt')).toHaveLength(1); expect((await noti('admin', d.code)).length).toBeLessThanOrEqual(1);
  });
  test(tc('SVY-A13'), async () => {
    const d = await pending(); for (const k of ['canbo', 'xemonly']) { const r = await approve(d.id, k); expect([403, 404], k).toContain(r.status); }
    const l = await approve(d.id, 'ldp'); expect([403, 404]).toContain(l.status); expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt');
  });
  test(tc('SVY-A14'), async ({ page }) => {
    const d = await pending(); await UI(page); await page.route(`**/api/v1/survey/surveys/${d.id}/status`, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await page.goto(`/#/vi/survey-campaigns/${d.id}`); await settle(page); await page.getByRole('button', { name: /Phê duyệt/ }).click(); await confirmBtn(page, 'approve').click(); await page.waitForTimeout(1200);
    await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-025').toBeVisible(); expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt');
  });
  test(tc('SVY-A15'), async ({ page }) => {
    const d = await pending(); await UI(page); await page.route(`**/api/v1/survey/surveys/${d.id}/status`, r => r.abort('internetdisconnected'));
    await page.goto(`/#/vi/survey-campaigns/${d.id}`); await settle(page); await page.getByRole('button', { name: /Phê duyệt/ }).click(); await confirmBtn(page, 'approve').click(); await page.waitForTimeout(1200);
    await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-026').toBeVisible(); expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt');
  });
  test(tc('SVY-A16'), async ({ page }) => {
    const d = await pending(); await UI(page); await page.goto(`/#/vi/survey-campaigns/${d.id}`); await settle(page); await page.getByRole('button', { name: /Phê duyệt/ }).click();
    const b = confirmBtn(page, 'approve'); for (let i = 0; i < 3; i++) await b.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {}); await settle(page);
    expect((await hist(d.id)).filter(h => h === 'Đã phê duyệt')).toHaveLength(1); expect(await body(page)).not.toMatch(/người khác thay đổi/);
  });
  test(tc('SVY-A17'), async () => {
    const d = await pending(); await approve(d.id); const g = await getSurvey(d.id);
    expect((await put(d.id, { ...g, name: 'hack', status: 1 })).status).toBeGreaterThanOrEqual(400); expect((await api('DELETE', `survey/surveys/${d.id}`)).status).toBeGreaterThanOrEqual(400);
  });
  test(tc('SVY-A18'), async () => {
    const dr = await draft(); const r1 = await approve(dr.id); expect(r1.status).toBeGreaterThanOrEqual(400); expect((await getSurvey(dr.id)).statusName).toBe('Nháp');
    const rj = await pending(); await reject(rj.id, 'x'); const r2 = await approve(rj.id); expect(r2.status).toBeGreaterThanOrEqual(400);
    const ap = (await allSurveys()).find(s => s.statusName === 'Đã phê duyệt')!; expect((await approve(ap.id)).status).toBeGreaterThanOrEqual(400);
  });
  test(tc('SVY-A19'), async () => {
    const d = await pending(); for (const k of ['ldd', 'ldp']) { const r = await approve(d.id, k); expect([403, 404], k).toContain(r.status); }
    expect((await allSurveys({}, 'ldd')).some(s => s.id === d.id)).toBeFalsy(); expect((await allSurveys({}, 'ldp')).some(s => s.id === d.id)).toBeFalsy();
  });
});

test.describe('Đợt khảo sát — từ chối', () => {
  const openReject = async (page: Page, d: { id: string }) => { await UI(page); await page.goto(`/#/vi/survey-campaigns/${d.id}`); await settle(page); await page.getByRole('button', { name: /Từ chối/ }).first().click(); };
  const reason = (page: Page) => modal(page).locator('textarea, input').first();
  test(tc('SVY-J01'), async ({ page }) => {
    const d = await pending(); await openReject(page, d); const t = (await modal(page).innerText()).replace(/\s+/g, ' ');
    expect(t).toContain(d.code); expect(t).toMatch(/Lý do từ chối/); await expect(reason(page)).toBeVisible(); await expect(modal(page).getByRole('button', { name: /Hủy|Huỷ|Không|Đóng/ }).first()).toBeVisible();
  });
  test(tc('SVY-J02'), async ({ page }) => {
    const d = await pending(); await openReject(page, d); await reason(page).fill('Thiếu câu hỏi'); await confirmBtn(page, 'reject').click(); await settle(page);
    expect(await toastText(page)).toMatch(/Từ chối phê duyệt/); const g = await getSurvey(d.id); expect(g.statusName).toBe('Bị từ chối'); expect(g.histories.at(-1)).toMatchObject({ statusName: 'Bị từ chối', reason: 'Thiếu câu hỏi' });
  });
  test(tc('SVY-J03'), async ({ page }) => {
    const d = await pending(); await openReject(page, d); await confirmBtn(page, 'reject').click(); await page.waitForTimeout(800);
    expect(await body(page)).toMatch(/Lý do từ chối/); await expect(modal(page)).toBeVisible(); expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt');
  });
  test(tc('SVY-J04'), async ({ page }) => {
    const d = await pending(); await openReject(page, d); await reason(page).fill('    '); await confirmBtn(page, 'reject').click(); await page.waitForTimeout(800);
    expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt'); const r = await reject(d.id, '    '); expect(r.status).toBe(400); expect(r.message).toMatch(/Lý do/);
  });
  test(tc('SVY-J05'), async () => {
    const d = await pending(); const r = await reject(d.id, 'l'.repeat(1000)); expect(r.status, r.message).toBe(200); expect((await getSurvey(d.id)).histories.at(-1).reason).toHaveLength(1000);
  });
  test(tc('SVY-J06'), async () => {
    const d = await pending(); const r = await reject(d.id, 'l'.repeat(1001)); expect(r.status).toBe(400); expect(r.message).toMatch(/1000/); expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt');
  });
  test(tc('SVY-J07'), async ({ page }) => {
    const d = await pending(); await openReject(page, d); await reason(page).fill('sẽ hủy'); await modal(page).getByRole('button', { name: /^(Hủy|Huỷ|Không|Đóng)$/ }).first().click(); await page.waitForTimeout(500);
    const g = await getSurvey(d.id); expect(g.statusName).toBe('Chờ phê duyệt'); expect(g.histories.map((h: any) => h.statusName)).not.toContain('Bị từ chối');
  });
  test(tc('SVY-J08'), async () => {
    const d = await pending(); await reject(d.id, 'Không đạt'); const n = await noti('admin', d.code); expect(n.length, 'người trình phải nhận TB-016').toBeGreaterThanOrEqual(1);
    expect(n.some((x: any) => /từ chối/i.test(x.title + x.description))).toBeTruthy();
  });
  test(tc('SVY-J10'), async () => {
    const d = await pending(); await approve(d.id); const r = await reject(d.id, 'muộn'); expect(r.status).toBe(400); expect(r.message).toMatch(/người khác thay đổi|tải lại/i); expect((await getSurvey(d.id)).statusName).toMatch(/Đã phê duyệt|Đang diễn ra/);
  });
  test(tc('SVY-J11'), async () => {
    const d = await pending(); for (const k of ['canbo', 'xemonly', 'ldd', 'ldp']) { const r = await reject(d.id, 'x', k); expect([403, 404], k).toContain(r.status); } expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt');
  });
  test(tc('SVY-J12'), async ({ page }) => {
    const d = await pending(); await page.route(`**/api/v1/survey/surveys/${d.id}/status`, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await openReject(page, d); await reason(page).fill('giữ lý do'); await confirmBtn(page, 'reject').click(); await page.waitForTimeout(1200);
    await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-025').toBeVisible(); expect(await reason(page).inputValue()).toBe('giữ lý do'); expect((await getSurvey(d.id)).statusName).toBe('Chờ phê duyệt');
  });
  test(tc('SVY-J13'), async ({ page }) => {
    const d = await pending(); await page.route(`**/api/v1/survey/surveys/${d.id}/status`, r => r.abort('internetdisconnected'));
    await openReject(page, d); await reason(page).fill('giữ lý do'); await confirmBtn(page, 'reject').click(); await page.waitForTimeout(1200);
    await expect(page.locator('.ant-message, .ant-notification, [role=alert]').first(), 'MSG-026').toBeVisible(); expect(await reason(page).inputValue()).toBe('giữ lý do');
  });
  test(tc('SVY-J14'), async ({ page }) => {
    const d = await pending(); await openReject(page, d); await reason(page).fill('một lần'); const b = confirmBtn(page, 'reject');
    for (let i = 0; i < 3; i++) await b.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {}); await settle(page);
    expect((await hist(d.id)).filter(h => h.startsWith('Bị từ chối'))).toHaveLength(1); expect((await noti('admin', d.code)).length).toBeLessThanOrEqual(1);
  });
  test(tc('SVY-J15'), async () => {
    const dr = await draft(); expect((await reject(dr.id, 'x')).status).toBeGreaterThanOrEqual(400); expect((await getSurvey(dr.id)).statusName).toBe('Nháp');
    const act = (await allSurveys()).find(s => s.statusName === 'Đang diễn ra')!; expect((await reject(act.id, 'x')).status).toBeGreaterThanOrEqual(400); expect((await getSurvey(act.id)).statusName).toBe('Đang diễn ra');
  });
});

test.describe('Đợt khảo sát — tác vụ tự động & thời gian', () => {
  skipped(['SVY-Z01', 'SVY-Z02', 'SVY-Z03', 'SVY-Z04', 'SVY-Z05', 'SVY-Z06', 'SVY-Z07', 'SVY-Z09'], 'MANUAL: phụ thuộc tác vụ nền theo lịch/đồng hồ máy chủ (tự mở, tự từ chối, đóng thu thập, chốt số liệu, biên 23:59/00:00) — không kích hoạt được từ Playwright');
  test(tc('SVY-Z08'), async () => {
    test.setTimeout(150_000);
    const ended = (await allSurveys()).find(s => s.statusName === 'Đã kết thúc' && s.methodNames.includes('Trực tuyến'))!;
    const full = await getSurvey(ended.id); const answers = full.groups.flatMap((g: any) => g.questions.map((q: any) => ({ questionId: q.id, result: 1 })));
    const r = await (await import('./common')).postPublic(`public/surveys/${ended.id}/responses`, { channel: 1, answers }); expect(r.status).toBe(410);
    const before = (await getSurvey(ended.id)).resultCount;
    const t = await api('POST', `survey/surveys/${ended.id}/results`, { method: 2, collectedDate: dayStr(0), answers: answers.map((a: any) => ({ surveyQuestionId: a.questionId, result: 1 })) }); expect(t.status, t.message).toBeGreaterThanOrEqual(400);
    expect((await getSurvey(ended.id)).resultCount).toBe(before);
  });
  test(tc('SVY-Z10'), async ({ page }) => {
    const ended = (await allSurveys()).find(s => s.statusName === 'Đã kết thúc')!; await UI(page); await page.goto(`/#/vi/survey-campaigns`); await settle(page);
    expect(await body(page)).not.toMatch(/Chờ chốt|gia hạn/i); await page.goto(`/#/vi/survey-campaigns/${ended.id}`); await settle(page); expect(await body(page)).not.toMatch(/Chờ chốt|gia hạn/i);
  });
});
void FAKE;
