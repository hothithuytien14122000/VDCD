import { Page, expect } from '@playwright/test';

export const BASE = 'https://cds.geneat.pro';
export const goto = (page: Page, route: string) =>
  page.goto(`${BASE}/#/vi/${route}`, { waitUntil: 'networkidle' }).then(() => page.waitForTimeout(1200));

// Mã duy nhất để chạy lại nhiều lần không trùng
// Mã ngắn cho ô Mã (<=10 ký tự). Luôn tiền tố QCA để nhận biết dữ liệu auto.
export const uid = (_prefix?: string) =>
  `QCA${Date.now().toString(36).slice(-5)}`.toUpperCase();
// Nhãn/ tên có dấu hiệu qc.automation để lọc dữ liệu auto.
export const aname = (x: string) => `qc.automation ${x}`;
export const AUTO_CODE_PREFIX = 'QCA';
export const AUTO_NAME = 'qc.automation';

// Mở form "Thêm mới ..." theo tên nút
export async function openCreate(page: Page, btnName: string) {
  await page.getByRole('button', { name: btnName }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  return page.getByRole('dialog');
}

// Chọn giá trị cho antd Select trong 1 scope (dialog): click placeholder rồi chọn option theo text
export async function selectAntd(page: Page, scope: any, placeholder: string, optionText: string) {
  const sel = scope.locator('.ant-select').filter({ hasText: placeholder }).first();
  await sel.click();
  const dd = page.locator('.ant-select-dropdown').last();
  await dd.waitFor({ state: 'visible', timeout: 6000 });
  await dd.locator('.ant-select-item', { hasText: optionText }).first().click();
  await page.waitForTimeout(300);
}

// Đọc thông báo (toast). Trả về text đầu tiên nhìn thấy.
export async function toastText(page: Page): Promise<string> {
  const t = page.locator('[class*="toast"], [class*="notification"], [role="alert"], [class*="message"]').first();
  await t.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  return (await t.textContent().catch(() => '')) || '';
}

// Tìm 1 dòng trong bảng theo text (mã/tên)
export const rowByText = (page: Page, text: string) =>
  page.locator('table tbody tr', { hasText: text });

export const RE_CANCEL = /hu[ỷủ]|đóng|cancel/i;
export const RE_SUBMIT = /lưu|thêm|tạo|cập nhật/i;

// Mở menu (chevron ant-dropdown-trigger) trên 1 dòng và chọn hành động (Cập nhật/Xoá)
export async function rowMenu(page: Page, row: any, action: RegExp) {
  await row.locator('button.ant-dropdown-trigger').first().click();
  const item = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: action }).first();
  await item.waitFor({ state: 'visible' });
  await item.click();
}
// Xác nhận hộp thoại Có/Không
export async function confirmYes(page: Page) {
  const yes = page.getByRole('button', { name: /^\s*có\s*$|xác nhận|đồng ý/i });
  // nhiều nút ẩn (template) có thể trùng -> chọn nút đang hiển thị
  await yes.filter({ visible: true }).last().click();
}
// Chọn 1 option trong ô ant-select nằm trong form-item có nhãn khớp labelRe.
// Không truyền optionText -> chọn option đầu tiên khả dụng.
export async function selectByLabel(scope: any, page: Page, labelRe: RegExp, optionText?: string | RegExp) {
  const sel = scope.locator('.ant-form-item').filter({ hasText: labelRe }).locator('.ant-select').first();
  await sel.click();
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dd.waitFor({ state: 'visible' });
  const opt = optionText
    ? dd.locator('.ant-select-item-option', { hasText: optionText }).first()
    : dd.locator('.ant-select-item-option:not(.ant-select-item-option-disabled)').first();
  await opt.click();
}
// Điền DatePicker trong form-item có nhãn khớp labelRe, định dạng dd/mm/yyyy.
export async function fillDate(scope: any, page: Page, labelRe: RegExp, value: string) {
  const inp = scope.locator('.ant-form-item').filter({ hasText: labelRe }).locator('.ant-picker input').first();
  await inp.click();
  await inp.fill(value);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
}
export const RE_EDIT = /cập nhật|chỉnh sửa/i;
export const RE_DELETE = /xo[áạ]/i;
export const RE_SAVE = /lưu thay đổi|lưu|cập nhật/i;
