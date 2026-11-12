import { openRole, go, shot, closeAll, menu } from './shot.mjs';
const FULL = { x: 0, y: 0, width: 1440, height: 900 };
const { page } = await openRole('admin', { width: 1440, height: 900 });
const fresh = async (route) => { await go(page, route, 2500); await page.reload({ waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(1500); };
const btn = (name) => page.getByRole('button', { name }).first();
try {
  // Cấu hình sao lưu tự động (trang backup/settings)
  await fresh('backup/settings');
  console.log('settings text ok:', (await page.locator('main').innerText()).includes('Lưu cấu hình'));
  await shot(page, 'admin/a-bak-cau-hinh', { clip: FULL, marks: [
    { el: page.getByText('Lịch sao lưu tự động', { exact: true }).first(), label: 2 },
    { el: page.getByText('Vị trí lưu trữ', { exact: true }).first(), label: 3 },
    { el: page.getByText('Chính sách lưu giữ', { exact: true }).first(), label: 4 },
    { el: btn('Lưu cấu hình'), label: 5 },
  ] });
  // Tạo sao lưu ngay (hộp thoại, không bấm Bắt đầu)
  await fresh('backup');
  await btn('Tạo sao lưu ngay').click(); await page.waitForTimeout(1500);
  const wrap = page.locator('.ant-modal-wrap').filter({ visible: true }).first();
  await shot(page, 'admin/a-bak-tao-ngay', { clip: FULL, marks: [
    { el: wrap.getByText('Phạm vi dữ liệu', { exact: true }).first(), label: 2 },
    { el: wrap.getByText('Ghi chú', { exact: true }).first(), label: 3 },
    { el: wrap.getByRole('button', { name: 'Bắt đầu sao lưu' }), label: 4 },
  ] });
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  // Chi tiết bản sao (chỉ xem; không bấm Khóa bảo vệ/Xóa)
  await fresh('backup');
  await page.locator('tbody tr.ant-table-row').first().getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(2000);
  await shot(page, 'admin/a-bak-chi-tiet', { clip: FULL, marks: [
    { el: page.getByText('Thông tin chung', { exact: true }).first(), label: 2 },
    { el: page.getByText('Nhật ký thực hiện', { exact: true }).first(), label: 3 },
    { el: btn('Khóa bảo vệ'), label: 4 },
    { el: btn('Xóa bản sao'), label: 4 },
  ] });
  // Xóa bản sao: chỉ tích chọn, không bấm Xóa bản sao
  await fresh('backup');
  const cb = page.locator('tbody tr.ant-table-row').first().locator('input[type=checkbox]');
  await cb.check({ force: true }); await page.waitForTimeout(800);
  await shot(page, 'admin/a-bak-xoa', { clip: FULL, marks: [
    { el: page.locator('tbody tr.ant-table-row').first().locator('label, .ant-checkbox-wrapper').first(), label: 1, pad: 6 },
    { el: btn('Xóa bản sao'), label: 2 },
  ] });
  await cb.uncheck({ force: true }).catch(() => {});
} finally { await closeAll(); }
