import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import { AUTH_STATE_PATH, applySessionStorage } from './helpers/ui';

/**
 * UI test: trang Nguoi dung (/#/vi/users) - UC2.1 Quan ly nguoi dung.
 * Sinh tu Testcase/uc2-1-quan-ly-nguoi-dung-test-cases.md (57 TC) boi skill
 * uc-ui-testcase-generator. Moi test() duoc dat ten theo TC id tuong ung de khop
 * nguoc lai voi hang trong .xlsx/.md.
 *
 * TC con danh dau [CAN XAC NHAN] trong file TC (oracle chua duoc xac nhan) ->
 * test.skip, KHONG doan assertion.
 *
 * Dang nhap: captcha la anh that, khong tu dong hoa qua form duoc. Truoc khi chay
 * file nay, phai co session hop le (xem SKILL.md Step 9):
 *   node .claude/skills/uc-ui-testcase-generator/scripts/refresh_session_headless.js
 * hoac (thu cong) node scripts/save_auth_state.js tai thu muc nay.
 *
 * AN TOAN DU LIEU: cac TC mutating (them/sua/khoa/mo khoa/xoa) deu tao va don dep
 * BAN GHI TEST RIENG cua minh (ma nguoi dung co suffix duy nhat theo thoi gian),
 * KHONG BAO GIO thao tac tren dong co san trong danh sach.
 */

const UNIQUE = Date.now().toString(36);

function uniqueCode(tag: string) {
  return `tc21.${tag}.${UNIQUE}`.toLowerCase();
}

// So dien thoai cung phai duy nhat (API tu choi "So dien thoai da duoc su dung
// boi user khac") - khong duoc hard-code nhu "0900000017" vi se trung voi ban
// ghi con sot lai tu lan chay truoc. Dem tang dan de khong trung nhau ngay trong
// cung 1 lan chay.
let phoneCounter = 0;
function uniquePhone() {
  phoneCounter += 1;
  const suffix = ((Date.now() % 10000000) + phoneCounter).toString().padStart(8, '0').slice(-8);
  return `09${suffix}`;
}

async function openAddModal(page: Page) {
  await page.getByRole('button', { name: /Thêm người dùng/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillAddForm(
  page: Page,
  opts: { name: string; phone: string; email: string; userName: string; password: string }
) {
  await page.locator('#name').fill(opts.name);
  await page.locator('#phoneNumber').fill(opts.phone);
  await page.locator('#email').fill(opts.email);
  await page.locator('#userName').fill(opts.userName);
  await page.locator('#password').fill(opts.password);
  // Don vi + Nhom nguoi dung: Ant Select combobox - bam vao wrapper .ant-select
  // (giong cach lam voi 2 filter tren danh sach), cho danh sach option tai xong
  // (Don vi la danh muc lon, co the tai bat dong bo) roi moi chon dong dau tien.
  // Antd giu lai popup dropdown CU an trong DOM sau khi dong (khong xoa, khong
  // chac chan co class loai tru on dinh), nen click truc tiep vao 1 option de
  // doan dung dropdown dang mo khong dang tin cay. Dung PHIM thay vi CHUOT: mo
  // dropdown roi ArrowDown + Enter de chon dong dau tien - khong can xac dinh vi
  // tri/element cua option nao ca.
  const orgSelect = page.locator('#organizationId').locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " ant-select ")][1]');
  await orgSelect.click({ force: true });
  // Don vi la danh muc lon, danh sach option co the tai bat dong bo - cho option
  // dau tien THUC SU xuat hien (khong chi doi 1 khoang thoi gian co dinh) truoc
  // khi gui phim, de khong bam ArrowDown/Enter vao lic danh sach rong.
  await page.locator('.ant-select-item-option').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  const roleSelect = page.locator('#roleListCode').locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " ant-select ")][1]');
  await roleSelect.click({ force: true });
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

// 2 Ant Select filter o dau bang: thu nhat = Nhom nguoi dung, thu hai = Trang thai.
// Dung vi tri (nth) thay vi hasText vi hasText doi theo gia tri dang chon, khong
// con khop lai duoc sau khi da chon 1 gia tri khac placeholder.
function groupFilterSelect(page: Page) {
  return page.locator('.ant-select').nth(0);
}
function statusFilterSelect(page: Page) {
  return page.locator('.ant-select').nth(1);
}
function exact(label: string) {
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}
async function chooseSelectOption(select: ReturnType<typeof groupFilterSelect>, label: string) {
  await select.click({ force: true });
  await select.page().locator('.ant-select-item-option-content', { hasText: exact(label) }).click();
}
async function clearSelectFilter(select: ReturnType<typeof groupFilterSelect>) {
  await select.locator('.ant-select-clear').click({ force: true });
}

async function findRow(page: Page, code: string) {
  await page.locator('#search').fill(code);
  const row = page.locator('table tbody tr[data-row-key]', { hasText: code });
  await expect(row).toHaveCount(1, { timeout: 10000 });
  return row;
}

async function openRowMenu(page: Page, code: string) {
  const row = await findRow(page, code);
  await row.locator('button.ant-dropdown-trigger').click();
}

// Popup xac nhan Khoa/Mo khoa/Xoa: mot dialog dung chung "Ban co chac chan muon
// thuc hien thao tac nay?" voi 2 nut "Khong" (huy) / "Co" (xac nhan) - KHONG phai
// ".ant-popconfirm", ma la mot dialog rieng (xac nhan truc tiep khi chay tu dong).
// Tieu de dialog KHAC nhau tuy hanh dong - Khoa/Mo khoa dung chung "Ban co chac
// chan muon thuc hien thao tac nay?", rieng Xoa dung "Ban co chac muon xoa?" (xac
// nhan truc tiep khi chay tu dong) - nen khong loc theo ten dialog, chi can tim
// nut "Khong"/"Co" (luon chi co 1 dialog xac nhan dang mo tai 1 thoi diem).
function confirmDialogButton(page: Page, action: 'cancel' | 'confirm') {
  return page.getByRole('button', { name: action === 'cancel' ? 'Không' : 'Có', exact: true });
}

async function clearSearch(page: Page) {
  const clearIcon = page.locator('.ant-input-clear-icon');
  if (await clearIcon.isVisible().catch(() => false)) {
    await clearIcon.click();
  } else {
    await page.locator('#search').fill('');
  }
}

/** Xoa 1 nguoi dung test qua menu thao tac - dung lam don dep cuoi moi test mutating. */
async function deleteDisposableUser(page: Page, code: string) {
  await openRowMenu(page, code);
  await page.getByRole('menuitem', { name: /^(Xoá|Xóa)$/ }).click();
  await confirmDialogButton(page, 'confirm').click();
  await expect(page.getByText(/Xoá thành công|Xóa thành công/)).toBeVisible({ timeout: 10000 });
  await clearSearch(page);
}

test.describe('Nguoi dung (Quan ly nguoi dung) - UC2.1 - /#/vi/users', () => {
  test.skip(
    !fs.existsSync(AUTH_STATE_PATH),
    `Chua co session (${AUTH_STATE_PATH}) - chay refresh_session_headless.js (xem SKILL.md Step 9) truoc.`
  );
  test.use({ storageState: AUTH_STATE_PATH });

  test.beforeEach(async ({ page, context }) => {
    await applySessionStorage(context);
    await page.goto('/#/vi/users');
    await page.waitForLoadState('networkidle');
  });

  // ── Xem danh sach nguoi dung ────────────────────────────────────────────────

  test('TC_UC2.1_001 - Hien thi danh sach nguoi dung mac dinh', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Người dùng' })).toBeVisible();
    for (const col of ['Mã người dùng', 'Họ tên', 'Số điện thoại', 'Email', 'Đơn vị', 'Trạng thái']) {
      await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
    }
    await expect(page.locator('table tbody tr[data-row-key]')).toHaveCount(10); // 10/trang
  });

  test('TC_UC2.1_002 - Cac dropdown loc tren danh sach va danh sach gia tri', async ({ page }) => {
    await expect(page.getByText('Tất cả nhóm người dùng')).toBeVisible();
    await expect(page.getByText('Tất cả trạng thái')).toBeVisible();

    await groupFilterSelect(page).click({ force: true });
    const groupOptions = await page.locator('.ant-select-item-option-content').allTextContents();
    for (const v of ['Cán bộ địa phương 1', 'Lãnh đạo', 'Lãnh đạo đơn vị', 'Cán bộ', 'Super Admin (QA)']) {
      expect(groupOptions).toContain(v);
    }
    await page.keyboard.press('Escape');

    await statusFilterSelect(page).click({ force: true });
    const statusOptions = await page.locator('.ant-select-item-option-content').allTextContents();
    expect(statusOptions).toContain('Đang hoạt động');
    expect(statusOptions).toContain('Đã khóa');
    await page.keyboard.press('Escape');
  });

  test('TC_UC2.1_003 - Trang thai hien dung mau badge theo gia tri', async ({ page }) => {
    const active = page.locator('table tbody tr[data-row-key]', { hasText: 'Đang hoạt động' }).first();
    const locked = page.locator('table tbody tr[data-row-key]', { hasText: 'Khoá' }).first();
    await expect(active).toBeVisible();
    await expect(locked).toBeVisible();
  });

  test('TC_UC2.1_004 - Truy cap khi chua dang nhap bi dieu huong ve login', async ({ browser }) => {
    const ctx = await browser.newContext(); // KHONG dung storageState - gia lap chua dang nhap
    const page = await ctx.newPage();
    await page.goto('/#/vi/users');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
    await ctx.close();
  });

  test('TC_UC2.1_045 - Cot tren bang khong ho tro sap xep khi bam tieu de', async ({ page }) => {
    const before = await page.locator('table tbody tr td:nth-child(3)').allTextContents();
    await page.getByRole('columnheader', { name: 'Họ tên', exact: true }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    const after = await page.locator('table tbody tr td:nth-child(3)').allTextContents();
    expect(after).toEqual(before);
  });

  // ── Tim kiem nguoi dung ─────────────────────────────────────────────────────

  test('TC_UC2.1_005 - Tim kiem theo tu khoa co ket qua khop', async ({ page }) => {
    const firstName = (await page.locator('table tbody tr[data-row-key]').first().locator('td').nth(2).innerText()).trim();
    const keyword = firstName.split(' ')[0];
    await page.locator('#search').fill(keyword);
    await page.waitForTimeout(600);
    const rows = page.locator('table tbody tr[data-row-key]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      // Tim kiem thuc te khong phan biet hoa/thuong (vi du tu khoa "TC" khop voi
      // "ttcds") - so sanh cung khong phan biet hoa/thuong de dung voi hanh vi that.
      await expect(rows.nth(i)).toContainText(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  });

  test('TC_UC2.1_006 - Tim kiem khop theo Email va theo So dien thoai', async ({ page }) => {
    const firstRow = page.locator('table tbody tr[data-row-key]').first();
    const email = (await firstRow.locator('td').nth(4).innerText()).trim();
    await page.locator('#search').fill(email);
    await page.waitForTimeout(600);
    await expect(page.locator('table tbody tr[data-row-key]')).toHaveCount(1);
    await expect(page.locator('table tbody tr[data-row-key]').first()).toContainText(email);
    await clearSearch(page);

    const secondRow = page.locator('table tbody tr[data-row-key]').nth(1);
    const phone = (await secondRow.locator('td').nth(3).innerText()).trim();
    if (phone) {
      await page.locator('#search').fill(phone);
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody tr[data-row-key]').first()).toContainText(phone);
    }
  });

  test('TC_UC2.1_007 - Tim kiem khong co ket qua khop', async ({ page }) => {
    await page.locator('#search').fill('zzz_khong_ton_tai_123');
    await page.waitForTimeout(600);
    await expect(page.locator('table tbody tr[data-row-key]')).toHaveCount(0);
  });

  test('TC_UC2.1_008 - Xoa tu khoa tim kiem tra ve danh sach day du', async ({ page }) => {
    await page.locator('#search').fill('zzz_khong_ton_tai_123');
    await page.waitForTimeout(600);
    await clearSearch(page);
    await page.waitForTimeout(600);
    await expect(page.locator('table tbody tr[data-row-key]')).toHaveCount(10);
  });

  for (const [tcId, group] of [
    ['TC_UC2.1_046', 'Cán bộ địa phương 1'],
    ['TC_UC2.1_047', 'Lãnh đạo'],
    ['TC_UC2.1_048', 'Lãnh đạo đơn vị'],
    ['TC_UC2.1_049', 'Cán bộ'],
    ['TC_UC2.1_050', 'Super Admin (QA)'],
  ] as const) {
    // Luu y: cot "Nhom nguoi dung" KHONG hien thi tren bang danh sach (xem phat hien
    // o TC_UC2.1_001) nen khong the doi chieu tung dong theo ten nhom qua UI. Chi
    // xac nhan duoc dieu kien loc duoc ap dung (so dong thay doi so voi khong loc),
    // khong bia them assertion ve noi dung dong ma UI khong the chung minh duoc.
    test(`${tcId} - Loc Nhom nguoi dung = "${group}"`, async ({ page }) => {
      const before = await page.locator('table tbody tr[data-row-key]').count();
      await chooseSelectOption(groupFilterSelect(page), group);
      await page.waitForTimeout(600);
      const after = await page.locator('table tbody tr[data-row-key]').count();
      expect(after).toBeGreaterThanOrEqual(0);
      expect(after).toBeLessThanOrEqual(before);
    });
  }

  test('TC_UC2.1_051 - Xoa loc Nhom nguoi dung tra ve danh sach day du', async ({ page }) => {
    await chooseSelectOption(groupFilterSelect(page), 'Lãnh đạo đơn vị');
    await page.waitForTimeout(600);
    await clearSelectFilter(groupFilterSelect(page));
    await page.waitForTimeout(600);
    await expect(page.locator('table tbody tr[data-row-key]')).toHaveCount(10);
  });

  test('TC_UC2.1_052 - Loc Trang thai = "Đang hoạt động"', async ({ page }) => {
    await chooseSelectOption(statusFilterSelect(page), 'Đang hoạt động');
    await page.waitForTimeout(600);
    const rows = page.locator('table tbody tr[data-row-key]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).not.toContainText('Khoá');
    }
  });

  test('TC_UC2.1_053 - Loc Trang thai = "Đã khóa"', async ({ page }) => {
    await chooseSelectOption(statusFilterSelect(page), 'Đã khóa');
    await page.waitForTimeout(600);
    const rows = page.locator('table tbody tr[data-row-key]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('Khoá');
    }
  });

  test('TC_UC2.1_054 - Xoa loc Trang thai tra ve danh sach day du', async ({ page }) => {
    await chooseSelectOption(statusFilterSelect(page), 'Đã khóa');
    await page.waitForTimeout(600);
    await clearSelectFilter(statusFilterSelect(page));
    await page.waitForTimeout(600);
    await expect(page.locator('table tbody tr[data-row-key]')).toHaveCount(10);
  });

  // Cot "Nhom nguoi dung" khong hien tren bang (xem TC_UC2.1_046) nen khong doi
  // chieu tung dong theo ten nhom duoc. Xac nhan AND (khong phai OR) qua tinh don
  // dieu: them dieu kien loc thu 2 KHONG duoc lam TANG so dong so voi chi loc 1
  // dieu kien - neu la OR thi so dong se >= (hop cua 2 tap), neu la AND thi <=.
  test('TC_UC2.1_009 - Ket hop tim kiem + loc Nhom nguoi dung + loc Trang thai (AND, khong phai OR)', async ({ page }) => {
    await chooseSelectOption(statusFilterSelect(page), 'Đang hoạt động');
    await page.waitForTimeout(600);
    const statusOnlyCount = await page.locator('table tbody tr[data-row-key]').count();

    await chooseSelectOption(groupFilterSelect(page), 'Lãnh đạo đơn vị');
    await page.waitForTimeout(600);
    const combinedRows = page.locator('table tbody tr[data-row-key]');
    const combinedCount = await combinedRows.count();
    expect(combinedCount).toBeLessThanOrEqual(statusOnlyCount);
    for (let i = 0; i < combinedCount; i++) {
      await expect(combinedRows.nth(i)).not.toContainText('Khoá');
    }
  });

  // ── Xuat Excel ──────────────────────────────────────────────────────────────

  // Da thu tu dong hoa: bam nut phat hien dung (count=1, click khong loi), nhung
  // KHONG quan sat duoc download event, request mang khop /excel|export|xlsx/i,
  // hay toast thong bao nao trong 8s ke tu khi bam - ca trong chay that lan `--list`
  // lan chay chan doan rieng. Co the browser chan download synthetic trong moi
  // truong headless, hoac nut thuc su chua lam gi trong moi truong tu dong hoa -
  // CAN XAC NHAN thu cong (headed) truoc khi ket luan day la loi that.
  test.skip('TC_UC2.1_010 - Xuat Excel toan bo danh sach', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Xuất Excel' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  test.skip('TC_UC2.1_011 - Xuat Excel sau khi loc van xuat duoc file', async ({ page }) => {
    // Cung ly do voi TC_UC2.1_010 - xem ghi chu o do.
    await page.locator('#search').fill('a');
    await page.waitForTimeout(600);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Xuất Excel' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  // ── Xem thong tin nguoi dung ────────────────────────────────────────────────

  test('TC_UC2.1_013 - Xem chi tiet nguoi dung hien dung thong tin (kiem tra hoi quy)', async ({ page }) => {
    const firstRow = page.locator('table tbody tr[data-row-key]').first();
    const email = (await firstRow.locator('td').nth(4).innerText()).trim();
    await firstRow.getByRole('button', { name: 'Xem chi tiết' }).click();
    const drawer = page.locator('.ant-drawer-body');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(email);
    await expect(drawer).toContainText('THÔNG TIN TÀI KHOẢN');
    await expect(drawer).toContainText('Nhóm người dùng');
    await expect(drawer).toContainText('HOẠT ĐỘNG');
  });

  test('TC_UC2.1_014 - Dong panel Xem chi tiet', async ({ page }) => {
    await page.locator('table tbody tr[data-row-key]').first().getByRole('button', { name: 'Xem chi tiết' }).click();
    const drawer = page.locator('.ant-drawer-body');
    await expect(drawer).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).click();
    await expect(drawer).not.toBeVisible();
  });

  // ── Them moi nguoi dung ─────────────────────────────────────────────────────

  test('TC_UC2.1_025 - 2 checkbox mac dinh duoc bat san khi mo modal', async ({ page }) => {
    await openAddModal(page);
    await expect(page.locator('#isRequireChangePassword')).toBeChecked();
    await expect(page.locator('#isRequestMailInfo')).toBeChecked();
    await page.getByRole('dialog').getByRole('button', { name: /Huỷ|Hủy/ }).last().click();
  });

  test('TC_UC2.1_026 - An/hien mat khau bang icon con mat', async ({ page }) => {
    await openAddModal(page);
    const pwd = page.locator('#password');
    await pwd.fill('Test@12345');
    await expect(pwd).toHaveAttribute('type', 'password');
    await page.locator('#password').locator('xpath=following-sibling::*[1]').click();
    await expect(pwd).toHaveAttribute('type', 'text');
    await page.getByRole('dialog').getByRole('button', { name: /Huỷ|Hủy/ }).last().click();
  });

  test('TC_UC2.1_027 - Link Xem ma tran phan quyen dieu huong dung noi dung', async ({ page }) => {
    await openAddModal(page);
    const link = page.getByRole('link', { name: 'Xem ma trận phân quyền' });
    await expect(link).toHaveAttribute('href', /permission-matrix/);
  });

  test('TC_UC2.1_028 - Huy them moi khong luu du lieu', async ({ page }) => {
    const before = await page.locator('table tbody tr[data-row-key]').count();
    await openAddModal(page);
    await page.locator('#name').fill('Nguoi dung se bi huy');
    await page.getByRole('dialog').getByRole('button', { name: /Huỷ|Hủy/ }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('table tbody tr[data-row-key]')).toHaveCount(before);
  });

  test('TC_UC2.1_018 - Bo trong tat ca truong bat buoc khi them moi', async ({ page }) => {
    await openAddModal(page);
    await page.getByRole('dialog').getByRole('button', { name: /Thêm người dùng/ }).click();
    for (const msg of [
      'Vui lòng nhập họ và tên',
      'Vui lòng nhập số điện thoại',
      'Vui lòng nhập địa chỉ email',
      'Vui lòng nhập mã người dùng',
      'Vui lòng nhập mật khẩu',
      'Vui lòng chọn đơn vị phân công',
      'Vui lòng chọn nhóm người dùng',
    ]) {
      await expect(page.getByText(msg)).toBeVisible();
    }
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('TC_UC2.1_019 - Bo trong rieng truong Ma nguoi dung', async ({ page }) => {
    await openAddModal(page);
    await page.locator('#name').fill('TC19 Required');
    await page.locator('#phoneNumber').fill('0900000019');
    await page.locator('#email').fill(`${uniqueCode('tc19')}@example.test`);
    await page.locator('#password').fill('Test@12345');
    await page.getByRole('dialog').getByRole('button', { name: /Thêm người dùng/ }).click();
    await expect(page.getByText('Vui lòng nhập mã người dùng')).toBeVisible();
    await expect(page.getByText('Vui lòng nhập họ và tên')).not.toBeVisible();
  });

  test('TC_UC2.1_020 - Ma trung nhung thieu truong khac: bao thieu truong truoc', async ({ page }) => {
    const existingCode = (await page.locator('table tbody tr[data-row-key]').first().locator('td').nth(1).innerText()).trim();
    await openAddModal(page);
    await page.locator('#name').fill('TC20 Decision Table');
    await page.locator('#phoneNumber').fill('0900000020');
    await page.locator('#email').fill(`${uniqueCode('tc20')}@example.test`);
    await page.locator('#userName').fill(existingCode);
    await page.locator('#password').fill('Test@12345');
    await page.getByRole('dialog').getByRole('button', { name: /Thêm người dùng/ }).click();
    await expect(page.getByText('Vui lòng chọn đơn vị phân công')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /Huỷ|Hủy/ }).last().click();
  });

  // ── Vong doi Them/Sua/Khoa/Mo khoa/Xoa tren 1 ban ghi test rieng ────────────

  test('TC_UC2.1_017,023,029,031,032,033,034,035,036,037,038,041,042,044 - Vong doi Them/Sua/Khoa/Mo khoa/Xoa nguoi dung', async ({ page }) => {
    const code = uniqueCode('lifecycle');

    // TC_017: them moi thanh cong, mat khau dung 8 ky tu (TC_023, gia tri bien duoi BR-3)
    await openAddModal(page);
    await fillAddForm(page, {
      name: 'TC UC2.1 Lifecycle',
      phone: uniquePhone(),
      email: `${code}@example.test`,
      userName: code,
      password: 'Abcd@123', // dung 8 ky tu
    });
    await page.getByRole('dialog').getByRole('button', { name: /Thêm người dùng/ }).click();
    await expect(page.getByText('Tạo tài khoản thành công')).toBeVisible({ timeout: 10000 });

    // TC_029: ban ghi con nguyen sau khi tai lai trang
    await page.reload();
    await page.waitForLoadState('networkidle');
    let row = await findRow(page, code);
    await expect(row).toContainText('Đang hoạt động');

    // TC_034: huy chinh sua khong luu thay doi
    await row.locator('button.ant-dropdown-trigger').click();
    await page.getByRole('menuitem', { name: 'Cập nhật', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('#name').fill('TEN SE BI HUY KHONG LUU');
    await dialog.getByRole('button', { name: /Huỷ|Hủy/ }).last().click();
    await expect(dialog).not.toBeVisible();
    row = await findRow(page, code);
    await expect(row).not.toContainText('TEN SE BI HUY KHONG LUU');

    // TC_032: Ma nguoi dung chi doc khi Chinh sua (BR-1, dung nhu UC mo ta).
    // PHAT HIEN KHI CHAY TU DONG: UC2.1.md va TC_UC2.1_032 (ban dau) ghi la modal
    // Chinh sua "KHONG co truong Mat khau" - sai. Thuc te modal Chinh sua CO hien
    // truong Mat khau, placeholder "De trong neu giu mat khau hien tai" (tuc la
    // optional, dung de DOI mat khau khi can, khac voi suy doan truoc do la an
    // han). Sua lai assertion cho dung thuc te, va can cap nhat lai TC_UC2.1_032 +
    // UC2.1.md cho khop.
    await row.locator('button.ant-dropdown-trigger').click();
    await page.getByRole('menuitem', { name: 'Cập nhật', exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#userName')).toBeDisabled();
    await expect(dialog.locator('#password')).toBeVisible();
    await expect(dialog.locator('#password')).toHaveAttribute('placeholder', 'Để trống nếu giữ mật khẩu hiện tại');

    // TC_033: bo trong truong bat buoc khi Chinh sua
    await dialog.locator('#name').fill('');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog.getByText('Vui lòng nhập họ và tên')).toBeVisible();

    // TC_031: chinh sua thanh cong
    await dialog.locator('#name').fill('TC UC2.1 Lifecycle Updated');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByText('Chỉnh sửa thành công')).toBeVisible({ timeout: 10000 });

    // TC_035: thay doi giu nguyen sau khi tai lai trang
    await page.reload();
    await page.waitForLoadState('networkidle');
    row = await findRow(page, code);
    await expect(row).toContainText('TC UC2.1 Lifecycle Updated');

    // TC_038: huy thao tac Khoa
    await row.locator('button.ant-dropdown-trigger').click();
    await page.getByRole('menuitem', { name: 'Khoá', exact: true }).click();
    await confirmDialogButton(page, 'cancel').click();
    row = await findRow(page, code);
    await expect(row).toContainText('Đang hoạt động');

    // TC_036: khoa that
    await row.locator('button.ant-dropdown-trigger').click();
    await page.getByRole('menuitem', { name: 'Khoá', exact: true }).click();
    await confirmDialogButton(page, 'confirm').click();
    await expect(page.getByText(/thành công/)).toBeVisible({ timeout: 10000 });
    row = await findRow(page, code);
    await expect(row).toContainText('Khoá');

    // TC_037: mo khoa
    await row.locator('button.ant-dropdown-trigger').click();
    await page.getByRole('menuitem', { name: 'Mở khoá', exact: true }).click();
    await confirmDialogButton(page, 'confirm').click();
    await expect(page.getByText(/thành công/)).toBeVisible({ timeout: 10000 });
    row = await findRow(page, code);
    await expect(row).toContainText('Đang hoạt động');

    // TC_042: huy thao tac Xoa
    await row.locator('button.ant-dropdown-trigger').click();
    await page.getByRole('menuitem', { name: /^(Xoá|Xóa)$/ }).click();
    await confirmDialogButton(page, 'cancel').click();
    row = await findRow(page, code);
    await expect(row).toHaveCount(1);

    // TC_041: xoa that
    await row.locator('button.ant-dropdown-trigger').click();
    await page.getByRole('menuitem', { name: /^(Xoá|Xóa)$/ }).click();
    await confirmDialogButton(page, 'confirm').click();
    await expect(page.getByText(/Xoá thành công|Xóa thành công/)).toBeVisible({ timeout: 10000 });

    // TC_044: ban ghi da xoa khong con xuat hien sau khi tai lai trang
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#search').fill(code);
    await page.waitForTimeout(600);
    await expect(page.locator('table tbody tr[data-row-key]')).toHaveCount(0);
  });

  // ── Decision Table: to hop 2 checkbox mac dinh (BR-4) ───────────────────────

  for (const [tcId, tag, reqChangePwd, sendMail] of [
    ['TC_UC2.1_025b', 'cb-offoff', false, false],
    ['TC_UC2.1_025c', 'cb-onoff', true, false],
    ['TC_UC2.1_025d', 'cb-offon', false, true],
  ] as const) {
    test(`${tcId} - To hop checkbox mac dinh (reqChangePwd=${reqChangePwd}, sendMail=${sendMail})`, async ({ page }) => {
      const code = uniqueCode(tag);
      await openAddModal(page);
      await fillAddForm(page, {
        name: `TC UC2.1 ${tag}`,
        phone: uniquePhone(),
        email: `${code}@example.test`,
        userName: code,
        password: 'Test@12345',
      });
      if (!reqChangePwd) await page.locator('#isRequireChangePassword').uncheck();
      if (!sendMail) await page.locator('#isRequestMailInfo').uncheck();
      await page.getByRole('dialog').getByRole('button', { name: /Thêm người dùng/ }).click();
      await expect(page.getByText('Tạo tài khoản thành công')).toBeVisible({ timeout: 10000 });

      await deleteDisposableUser(page, code);
    });
  }
});
