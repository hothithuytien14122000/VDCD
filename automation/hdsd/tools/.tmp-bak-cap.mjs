import { openRole, go, shot, closeAll, menu } from './shot.mjs';
const FULL = { x: 0, y: 0, width: 1440, height: 900 };
const { page } = await openRole('admin', { width: 1440, height: 900 });
const fresh = async (route) => { await go(page, route, 2500); await page.reload({ waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(1500); };
const btn = (name) => page.getByRole('button', { name }).first();
try {
  await fresh('backup');
  await shot(page, 'admin/a-bak-ds', { clip: FULL, marks: [
    { el: menu(page, 'Sao lưu'), label: 1, pad: 4 },
    { el: page.locator('.ant-select').filter({ hasText: 'Tất cả loại' }).first(), label: 2 },
    { el: page.locator('.ant-select').filter({ hasText: 'Tất cả trạng thái' }).first(), label: 2 },
    { el: page.locator('tbody tr.ant-table-row').first().getByRole('button', { name: 'Xem chi tiết' }), label: 3 },
  ] });
  await shot(page, 'admin/a-bak-cau-hinh-nut', { clip: FULL, marks: [{ el: btn('Cấu hình sao lưu'), label: 1 }] });
  await shot(page, 'admin/a-bak-tao-nut', { clip: FULL, marks: [{ el: btn('Tạo sao lưu ngay'), label: 1 }] });
  await shot(page, 'admin/a-bak-xoa', { clip: FULL, marks: [] });
} finally { await closeAll(); }
