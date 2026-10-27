// AUTH.3 ĐỔI MẬT KHẨU — script bám testcase CPW-* (testcases/docs/catalog.json). CPW-M*, CPW-S07 là Manual → không có script.
// An toàn cho tài khoản dùng chung: chỉ dùng mật khẩu hiện tại SAI; case có thể làm đổi mật khẩu thật (khi hệ thống lỗi) tự khôi phục.
import { Page } from '@playwright/test';
import { test, expect, tc } from './common';
import { asUser, BAD, NEWPW, tokenOf, API_BASE, myInfo, putPassword, putWithRestore, openProfile, openChange, fillChange, pw, dialog, dialogText, countPut, bodyHas, toastLoc } from './acc';

const LONG129 = 'Aa1!' + 'a'.repeat(125);
let page: Page; let close: () => Promise<void>;

test.describe('Đổi mật khẩu › Mở & hiển thị', () => {
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });

  test(tc('CPW-L01'), async () => {
    await page.goto('/#/vi/');
    await page.getByRole('complementary').getByText('QC Cán bộ', { exact: true }).click();
    await page.getByText('Thông tin cá nhân', { exact: true }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByText('Mật khẩu', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/đổi mật khẩu định kỳ/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đổi mật khẩu' })).toBeVisible();
  });
  test(tc('CPW-L02'), async ({ browser }) => {
    for (const k of ['superadmin', 'ldd', 'xemonly']) {
      const s = await asUser(browser, k);
      try {
        await openProfile(s.page);
        await s.page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
        await expect(pw.old(dialog(s.page)), `vai trò ${k}`).toBeVisible();
      } finally { await s.ctx.close(); }
    }
  });
  test(tc('CPW-L03'), async () => {
    const d = await openChange(page);
    await expect(d.getByText('Đổi mật khẩu').first()).toBeVisible();
    for (const f of [pw.old, pw.neu, pw.cfm]) { await expect(f(d)).toHaveValue(''); await expect(f(d)).toHaveAttribute('type', 'password'); }
    for (const l of ['Mật khẩu hiện tại', 'Mật khẩu mới', 'Xác nhận mật khẩu mới']) await expect(d.getByText(l, { exact: true }).first()).toBeVisible();
    await expect(d.getByText('Độ mạnh mật khẩu')).toBeVisible();
    for (const c of [/tối thiểu 6 ký tự/i, /chữ hoa và chữ thường/i, /có chữ số/i, /có ký tự đặc biệt/i, /không chứa tên đăng nhập/i]) await expect(d.getByText(c)).toBeVisible();
    await expect(d.getByText('Sau khi đổi, các phiên đăng xuất trên thiết bị khác sẽ bị đăng xuất.')).toBeVisible();
    await expect(pw.cancel(d)).toBeVisible(); await expect(pw.submit(d)).toBeVisible();
    await expect(d.locator('.ant-modal-close, button[aria-label=Close]').first()).toBeVisible();
  });
  test(tc('CPW-L04'), async () => {
    const d = await openChange(page);
    await fillChange(d, 'abc', 'def', 'ghi');
    const eyes = d.locator('.ant-input-password-icon');
    await expect(eyes).toHaveCount(3);
    const fields = [pw.old(d), pw.neu(d), pw.cfm(d)];
    for (let i = 0; i < 3; i++) {
      await eyes.nth(i).click();
      for (let j = 0; j < 3; j++) await expect(fields[j]).toHaveAttribute('type', j === i ? 'text' : 'password');
      await eyes.nth(i).click();
      await expect(fields[i]).toHaveAttribute('type', 'password');
    }
  });
  test(tc('CPW-L05'), async () => {
    const n = countPut(page);
    for (const how of ['cancel', 'x', 'esc'] as const) {
      const d = await openChange(page);
      await pw.old(d).fill('abc');
      if (how === 'cancel') await pw.cancel(d).click();
      else if (how === 'x') await d.locator('.ant-modal-close, button[aria-label=Close]').first().click();
      else await page.keyboard.press('Escape');
      await expect(d, how).toBeHidden();
      await expect(page).toHaveURL(/\/profile/);
    }
    expect(n.v, 'không được gọi API').toBe(0);
  });
  test(tc('CPW-L06'), async () => {
    const d = await openChange(page);
    await pw.old(d).fill('abc'); await pw.cancel(d).click(); await expect(d).toBeHidden();
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();   // mở lại, KHÔNG tải lại trang
    const d2 = dialog(page); await expect(d2).toBeVisible();
    for (const f of [pw.old, pw.neu, pw.cfm]) await expect(f(d2), 'ô mật khẩu phải rỗng sau khi Huỷ').toHaveValue('');
  });
});

test.describe('Đổi mật khẩu › Validate giao diện', () => {
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });
  const submitWith = async (o: string, n: string, c: string) => {
    const cnt = countPut(page); const d = await openChange(page);
    await fillChange(d, o, n, c); await pw.submit(d).click(); await page.waitForTimeout(700);
    return { d, cnt };
  };
  const blocked = async (o: string, n: string, c: string, re: RegExp) => {
    const { d, cnt } = await submitWith(o, n, c);
    await expect(d).toBeVisible(); expect(await dialogText(d)).toMatch(re); expect(cnt.v, 'không gọi API').toBe(0);
    return d;
  };

  test(tc('CPW-V01'), async () => {
    const { d, cnt } = await submitWith('', '', '');
    const t = await dialogText(d);
    for (const re of [/Nhập mật khẩu hiện tại\s*\|\s*Mật khẩu mới/, /Nhập mật khẩu mới\s*\|\s*Độ mạnh/, /Xác nhận mật khẩu mới\s*\|\s*Sau khi đổi/]) expect(t).toMatch(re);
    expect(cnt.v).toBe(0);
  });
  test(tc('CPW-V02'), async () => {
    const { d, cnt } = await submitWith('', NEWPW, NEWPW);
    await expect(d.locator('.ant-form-item-explain-error')).toHaveText(['Nhập mật khẩu hiện tại']);
    expect(cnt.v).toBe(0);
  });
  test(tc('CPW-V03'), async () => {
    const { d, cnt } = await submitWith(BAD, '', NEWPW);
    await expect(d.locator('.ant-form-item-explain-error').filter({ hasText: 'Nhập mật khẩu mới' })).toHaveCount(1);
    expect(cnt.v).toBe(0);
  });
  test(tc('CPW-V04'), async () => {
    const { d, cnt } = await submitWith(BAD, NEWPW, '');
    await expect(d.locator('.ant-form-item-explain-error').filter({ hasText: 'Xác nhận mật khẩu mới' })).toHaveCount(1);
    expect(cnt.v).toBe(0);
  });
  test(tc('CPW-V05'), async () => { await blocked(BAD, NEWPW, 'Moi!123456b', /Mật khẩu xác nhận không khớp!/); });
  test(tc('CPW-V06'), async () => { await blocked(BAD, 'Ab1!', 'Ab1!', /chưa đáp ứng đủ các yêu cầu bảo mật/i); });
  test(tc('CPW-V07'), async () => {
    const cnt = countPut(page); const d = await openChange(page);
    for (const v of ['abcdef1!', 'ABCDEF1!']) {
      await fillChange(d, BAD, v, v); await pw.submit(d).click(); await page.waitForTimeout(600);
      expect(await dialogText(d), v).toMatch(/chưa đáp ứng đủ/i);
    }
    expect(cnt.v, 'không gọi API').toBe(0);
  });
  test(tc('CPW-V08'), async () => { await blocked(BAD, 'Abcdef!!', 'Abcdef!!', /chưa đáp ứng đủ/i); });
  test(tc('CPW-V09'), async () => { await blocked(BAD, 'Abcdef12', 'Abcdef12', /chưa đáp ứng đủ/i); });
  test(tc('CPW-V10'), async () => { await blocked(BAD, 'qc.canbo!A1', 'qc.canbo!A1', /chưa đáp ứng đủ/i); });
  test(tc('CPW-V11'), async () => {
    const d = await openChange(page);
    const label = async (v: string) => { await pw.neu(d).fill(v); await page.waitForTimeout(250); return (await d.locator('text=/^(Yếu|Trung bình|Khá|Mạnh)$/').allInnerTexts()).join(','); };
    expect(await label('abc')).toBe('Yếu');
    expect(await label('Abcdef1')).toBe('Trung bình');
    expect(await label('Abcdef1!')).toBe('Mạnh');
    expect(await label('qc.canboA1!'), 'chứa tên đăng nhập không được xếp Mạnh').not.toBe('Mạnh');
  });
  test(tc('CPW-V12'), async () => {
    const cnt = countPut(page); const d = await openChange(page);
    await fillChange(d, BAD, LONG129, LONG129); await pw.submit(d).click(); await page.waitForTimeout(1000);
    const kept = (await pw.neu(d).inputValue()).length;
    const msg = /vượt quá 128|tối đa 128/i.test(await dialogText(d));
    expect(kept <= 128 || msg, `ô nhập nhận ${kept} ký tự, không có thông báo giới hạn 128`).toBe(true);
    expect(cnt.v, 'UI phải chặn trước khi gọi API').toBe(0);
  });
});

test.describe('Đổi mật khẩu › Mật khẩu hiện tại sai (UI/API)', () => {
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });

  test(tc('CPW-A01'), async () => {
    const d = await openChange(page);
    await fillChange(d, BAD, NEWPW, NEWPW); await pw.submit(d).click();
    await bodyHas(page, /Mật khẩu cũ không chính xác/);
    await expect(d).toBeVisible();
    await expect(page.getByText(/đổi mật khẩu thành công/i)).toHaveCount(0);
  });
  test(tc('CPW-A02'), async () => {
    const me = await myInfo();
    const r = await putPassword(me.id, { passwordOld: BAD, passwordNew: NEWPW });
    expect(r.status).toBe(400); expect(r.message).toMatch(/Mật khẩu cũ không chính xác/);
  });
  test(tc('CPW-A03'), async () => {
    const r = await putWithRestore({ passwordOld: '', passwordNew: NEWPW });
    expect(r.status, `API chấp nhận mật khẩu cũ rỗng: ${r.message}`).toBe(400);
  });
  test(tc('CPW-A04'), async () => {
    const a = await putWithRestore({ passwordOld: null, passwordNew: NEWPW });
    const b = await putWithRestore({ passwordNew: NEWPW });
    expect([a.status, b.status], `passwordOld=null → ${a.message}; thiếu trường → ${b.message}`).toEqual([400, 400]);
  });
  test(tc('CPW-A05'), async () => {
    const me = await myInfo(); const r = await putPassword(me.id, { passwordOld: '   ', passwordNew: NEWPW });
    expect(r.status).toBe(400); expect(r.message).toMatch(/Mật khẩu cũ không chính xác/);
  });
  test(tc('CPW-A06'), async () => {
    const me = await myInfo();
    for (const body of [{ passwordOld: BAD, passwordNew: '' }, {}]) {
      const r = await putPassword(me.id, body);
      expect(r.status, JSON.stringify(body)).toBe(400); expect(r.message).toMatch(/Vui lòng nhập mật khẩu mới/);
    }
  });
  for (const [id, pwd] of [['CPW-A07', 'abc'], ['CPW-A08', '12345678'], ['CPW-A09', 'qc.canbo!A1']] as const) {
    test(tc(id), async () => {
      const r = await putWithRestore({ passwordOld: '', passwordNew: pwd });
      expect(r.status, `server chấp nhận mật khẩu "${pwd}": ${r.message}`).toBe(400);
    });
  }
  test(tc('CPW-A10'), async () => {
    const r = await putWithRestore({ passwordOld: '', passwordNew: LONG129 });   // mật khẩu cũ rỗng để qua bước kiểm tra mật khẩu cũ
    expect(r.status, r.message).toBe(400); expect(r.message).toMatch(/128 ký tự/);
  });
});

test.describe('Đổi mật khẩu › Bảo mật', () => {
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });

  test(tc('CPW-S01'), async () => {
    const me = await myInfo(); expect((await putPassword(me.id, { passwordOld: BAD, passwordNew: NEWPW }, null)).status).toBe(401);
  });
  test(tc('CPW-S02'), async () => {
    const me = await myInfo(); expect((await putPassword(me.id, { passwordOld: BAD, passwordNew: NEWPW }, 'abc.def.ghi')).status).toBe(401);
  });
  test(tc('CPW-S03'), async () => {
    const me = await myInfo();
    const r = await fetch(`${API_BASE}/api/v1/idm/users?pageSize=20`, { headers: { Authorization: `Bearer ${tokenOf('superadmin')}` } });
    const list: any[] = (await r.json()).data?.content ?? [];
    const other = list.find(u => u.userName === 'qc.ldd');   // người dùng hợp lệ, cố định để kết quả lặp lại được
    expect(other, 'cần một người dùng khác').toBeTruthy();
    const res = await putPassword(other.id, { passwordOld: BAD, passwordNew: NEWPW });
    expect([403, 404], `${res.status} ${res.message}`).toContain(res.status);
  });
  test(tc('CPW-S04'), async () => {
    for (const id of ['00000000-0000-0000-0000-000000000000', 'abc']) {
      const r = await putPassword(id, { passwordOld: BAD, passwordNew: NEWPW });
      expect([400, 404], `${id}: ${r.status}`).toContain(r.status);
      expect(r.message).not.toMatch(/exception|stack|at\s+\w+\./i);
    }
  });
  test(tc('CPW-S05'), async () => {
    const d = await openChange(page);
    for (const bad of ["' OR 1=1 --", '<script>alert(1)</script>']) {
      await fillChange(d, bad, NEWPW, NEWPW); await pw.submit(d).click();
      await bodyHas(page, /Mật khẩu cũ không chính xác/);
      await page.waitForTimeout(3500);   // chờ toast cũ biến mất để lần sau không khớp nhầm
    }
    await expect(d).toBeVisible();
  });
  test(tc('CPW-S06'), async () => {
    const reqs: { method: string; url: string; body: string }[] = []; let resp = '';
    page.on('request', r => { if (/\/password$/.test(r.url())) reqs.push({ method: r.method(), url: r.url(), body: r.postData() ?? '' }); });
    page.on('response', async r => { if (/\/password$/.test(r.url())) resp = await r.text().catch(() => ''); });
    const d = await openChange(page);
    await fillChange(d, BAD, NEWPW, NEWPW); await pw.submit(d).click();
    await bodyHas(page, /Mật khẩu cũ không chính xác/);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].method).toBe('PUT');
    expect(decodeURIComponent(reqs[0].url)).not.toContain(NEWPW); expect(decodeURIComponent(reqs[0].url)).not.toContain(BAD);
    expect(reqs[0].body).toContain(NEWPW);
    expect(resp).not.toContain(NEWPW); expect(resp).not.toContain(BAD);
  });
});

test.describe('Đổi mật khẩu › Luồng & lỗi', () => {
  let ctxHandle: any;
  test.beforeEach(async ({ browser }) => { const s = await asUser(browser, 'canbo'); page = s.page; ctxHandle = s.ctx; close = () => s.ctx.close(); });
  test.afterEach(async () => { await close(); });
  const fillValid = async () => { const d = await openChange(page); await fillChange(d, BAD, NEWPW, NEWPW); return d; };

  test(tc('CPW-G01'), async () => {
    const d = await fillValid();
    await page.route(/\/password$/, r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'Internal Server Error', isSuccess: false }) }));
    await pw.submit(d).click();
    await expect(toastLoc(page).first()).toBeVisible({ timeout: 8000 });
    await expect(d).toBeVisible();
    await expect(page.getByText(/đổi mật khẩu thành công/i)).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(/stack|exception/i);
  });
  test(tc('CPW-G02'), async () => {
    const d = await fillValid(); const n = countPut(page);
    await ctxHandle.setOffline(true);
    await pw.submit(d).click(); await page.waitForTimeout(1500);
    await expect(d).toBeVisible();
    await expect(page.getByText(/đổi mật khẩu thành công/i)).toHaveCount(0);
    await expect(toastLoc(page).first(), 'phải có thông báo lỗi kết nối').toBeVisible({ timeout: 5000 });
    await ctxHandle.setOffline(false);
    n.v = 0; await pw.submit(d).click();
    await bodyHas(page, /Mật khẩu cũ không chính xác/);
    expect(n.v).toBeGreaterThanOrEqual(1);
  });
  test(tc('CPW-G03'), async () => {
    const d = await fillValid(); const n = countPut(page);
    await page.route(/\/password$/, async r => { await new Promise(res => setTimeout(res, 3000)); await r.continue(); });
    const b = pw.submit(d);
    for (let i = 0; i < 3; i++) await b.click({ noWaitAfter: true, timeout: 800 }).catch(() => {});
    await bodyHas(page, /Mật khẩu cũ không chính xác/, 10_000);
    expect(n.v, 'chỉ 1 request PUT').toBe(1);
  });
});
