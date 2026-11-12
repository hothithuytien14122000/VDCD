// Chụp ảnh cho tài liệu HDSD vai trò Lãnh đạo Bộ (key lanhdaobo) → hdsd/out/img/lanhdaobo/*.png
// Dùng: node hdsd/tools/capture-lanh-dao-bo.mjs
// AN TOÀN DỮ LIỆU: chỉ mở hộp thoại Phê duyệt/Từ chối/Nhắc nhở/Đánh giá lại/Duyệt–Từ chối mở khóa, điền mẫu, chụp rồi Huỷ/Không.
// Dữ liệu minh họa là các kỳ/kết quả "qc.automation …" do bộ test dựng sẵn (không tạo mới, không thay đổi).
// Gửi nhắc nhở, Yêu cầu đánh giá lại, Xuất Excel: tài khoản qc_lãnh đạo hiện chưa được cấp quyền → chụp cùng màn hình bằng
// tài khoản Cán bộ phía Bộ (canbo), chỉ cắt vùng nội dung và ẩn các mục menu dòng thuộc thao tác của đơn vị.
import { openRole, go, shot, closeAll, dialog } from './shot.mjs';

const K = 'lanhdaobo';
const W = { width: 1600, height: 950 };
const RES_FX = 'assessment-results?campaignType=AdHoc&phase=all&keyword=RES3';
// Đổi query trên cùng route (hash) không khởi tạo lại trang → tải lại để áp dụng bộ lọc
const goFresh = async (p, route, wait = 2500) => { await go(p, route, 300); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(wait); };
const main = (p) => p.locator('main, .ant-layout-content').first();
const rows = (p) => p.locator('tbody tr.ant-table-row');
const modal = (p) => p.locator('.ant-modal:visible').last();
const cancel = async (p) => { await modal(p).getByRole('button', { name: /^(hủy|huỷ|không)$/i }).first().click(); await p.waitForTimeout(600); };
const ddMenu = (p) => p.locator('.ant-dropdown:not(.ant-dropdown-hidden)').last();

// Ẩn dữ liệu rác của môi trường test + bỏ tiền tố "qc.automation " cho gọn ảnh
const JUNK = ['QCA', '<script', '!!', '@@@', 'aaaaaa', 'testabc', 'H? th?ng', 'test data'];
async function tidy(p) {
  await p.evaluate((junk) => {
    document.querySelectorAll('tbody tr').forEach(tr => { if (junk.some(j => tr.innerText.includes(j))) tr.style.display = 'none'; });
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) if (n.nodeValue.includes('qc.automation ')) n.nodeValue = n.nodeValue.replaceAll('qc.automation ', '');
  }, JUNK);
}
// Mở menu mũi tên của dòng; ẩn các mục không phải thao tác phía Bộ (khi chụp bằng canbo)
const NOT_BO = /^(Bắt đầu chấm|Tiếp tục chấm|Chấm lại|Trình duyệt|Gửi Bộ|Xin mở khóa)$/;
async function openRowMenu(p, row, hideUnitItems = false) {
  await row.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
  await row.locator('button.ant-dropdown-trigger').first().click(); await p.waitForTimeout(600);
  if (hideUnitItems) await ddMenu(p).locator('.ant-dropdown-menu-item').evaluateAll((els, src) => {
    const re = new RegExp(src); els.forEach(e => { if (re.test(e.innerText.trim())) e.style.display = 'none'; });
  }, NOT_BO.source);
  return ddMenu(p);
}
// Vùng cắt quanh dòng + menu thả xuống (phần bên phải bảng)
async function menuClip(p, row, dd, width = 860) {
  const r = await row.boundingBox(), d = await dd.boundingBox(), vw = p.viewportSize().width;
  const top = Math.max(0, Math.min(r.y, d.y) - 70), bottom = Math.max(r.y + r.height, d.y + d.height) + 50;
  return { x: vw - width, y: top, width: width - 20, height: Math.min(p.viewportSize().height - top, bottom - top) };
}
const rowBy = (p, status, extra) => { let r = rows(p).filter({ hasText: status }); if (extra) r = r.filter({ hasText: extra }); return r.first(); };
const clipTop = (p, h = 620) => main(p).boundingBox().then(b => ({ x: b.x, y: b.y, width: b.width, height: Math.min(h, b.height) }));

// ================================================================ 1. Phê duyệt kỳ tự đánh giá (B.III.4)
{
  const { page } = await openRole(K);
  await go(page, 'self-assessment-campaigns', 2500); await tidy(page);
  await shot(page, `${K}/ky-ds`, {
    marks: [
      { el: page.locator('.ant-menu-item').filter({ hasText: 'Quản lý tự đánh giá' }).first(), label: 1 },
      { el: page.locator('.ant-segmented').first(), label: 2 },
      { el: page.getByPlaceholder(/tìm kiếm/i).first(), label: 3 },
      { el: rows(page).filter({ hasText: 'Chờ phê duyệt' }).first().locator('td').nth(5), label: 4, align: 'left' },
    ],
  });
  // Menu thao tác của kỳ Chờ phê duyệt
  const pending = rows(page).filter({ hasText: 'Chờ phê duyệt' }).first();
  const dd = await openRowMenu(page, pending);
  await shot(page, `${K}/ky-menu`, {
    keepMouse: true, clip: await menuClip(page, pending, dd, 1040),
    marks: [{ el: dd.locator('.ant-dropdown-menu-item', { hasText: 'Phê duyệt' }).first(), label: 2 },
            { el: dd.locator('.ant-dropdown-menu-item', { hasText: 'Từ chối' }).first(), label: 'HOẶC', pos: 'bottom' }],
  });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  // Chi tiết kỳ Chờ phê duyệt
  await pending.getByText('Xem chi tiết').first().click(); await page.waitForTimeout(2500); await tidy(page);
  await shot(page, `${K}/ky-chi-tiet`, {
    marks: [{ el: page.getByRole('button', { name: 'Phê duyệt' }), label: 2 }, { el: page.getByRole('button', { name: 'Từ chối' }), label: 'HOẶC' }],
  });
  await shot(page, `${K}/ky-chi-tiet-full`, { full: true });
  // Hộp thoại Phê duyệt → Không
  await page.getByRole('button', { name: 'Phê duyệt' }).click(); await page.waitForTimeout(900);
  await shot(page, `${K}/ky-phe-duyet-xn`, { clip: modal(page), marks: [{ el: modal(page).getByRole('button', { name: 'Có', exact: true }), label: 3 }] });
  await cancel(page);
  // Hộp thoại Từ chối → Hủy
  await page.getByRole('button', { name: 'Từ chối' }).click(); await page.waitForTimeout(900);
  await modal(page).locator('textarea').fill('Đề nghị bổ sung đơn vị được phân công và điều chỉnh thời gian thực hiện cho phù hợp kế hoạch năm.');
  await shot(page, `${K}/ky-tu-choi`, {
    clip: modal(page),
    marks: [{ el: modal(page).locator('textarea'), label: 3 }, { el: modal(page).getByRole('button', { name: 'Đồng ý' }), label: 4 }],
  });
  await cancel(page);
  // Lịch sử xử lý của kỳ bị từ chối (hiển thị lý do)
  await go(page, 'self-assessment-campaigns', 2500);
  const rej = rows(page).filter({ hasText: 'Bị từ chối' }).first();
  if (await rej.count()) {
    await rej.getByText('Xem chi tiết').first().click(); await page.waitForTimeout(2500); await tidy(page);
    const hist = page.getByText('Lịch sử xử lý', { exact: true }).locator('xpath=ancestor::div[3]');
    await hist.evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
    await shot(page, `${K}/ky-lich-su`, { clip: hist });
  }
  await page.close();
}

// ================================================================ 2. Theo dõi kết quả (C.UC2.1) + Duyệt/Từ chối mở khóa + Chi tiết (UC2.4, UC2.5)
{
  const { page } = await openRole(K, W);
  await goFresh(page, 'assessment-results'); await tidy(page);
  const filt = page.locator('.ant-select:not(.ant-pagination-options .ant-select)');
  await shot(page, `${K}/kq-ds`, {
    marks: [
      { el: page.locator('.ant-menu-item').filter({ hasText: 'Kết quả tự đánh giá' }).first(), label: 1 },
      { el: page.locator('.ant-segmented').first(), label: 2 },
      { el: page.locator('[role=tablist]').first(), label: 3 },
      { el: page.getByPlaceholder(/tìm kiếm/i).first(), label: 4 },
      { el: filt.nth(1), label: 5 },
    ],
  });
  await page.getByRole('tab', { name: /^Chưa gửi/ }).click(); await page.waitForTimeout(2000); await tidy(page);
  await shot(page, `${K}/kq-tab-chua-gui`, { clip: await clipTop(page, 760), marks: [{ el: page.getByRole('tab', { name: /^Chưa gửi/ }), label: '' }] });

  // Danh sách kết quả của kỳ minh họa: dòng Chờ mở khóa
  await goFresh(page, RES_FX); await tidy(page);
  const unl = rowBy(page, 'Chờ mở khóa');
  await shot(page, `${K}/mk-ds`, {
    clip: await clipTop(page, 520),
    marks: [{ el: page.getByRole('tab', { name: /^Chờ mở khóa/ }), label: 1 },
            { el: unl.locator('td').nth(6), label: 2, align: 'left' }],
  });
  const dd = await openRowMenu(page, unl);
  await shot(page, `${K}/mk-menu`, {
    keepMouse: true, clip: await menuClip(page, unl, dd),
    marks: [{ el: dd.locator('.ant-dropdown-menu-item', { hasText: 'Duyệt mở khóa' }).first(), label: 3 },
            { el: dd.locator('.ant-dropdown-menu-item', { hasText: 'Từ chối mở khóa' }).first(), label: 'HOẶC', pos: 'bottom' }],
  });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await unl.getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(2500); await tidy(page);
  const banner = page.getByText(/Đơn vị đang yêu cầu mở khóa/).first().locator('xpath=ancestor::*[contains(@class,"alert") or contains(@class,"banner") or contains(@class,"notice")][1]');
  await shot(page, `${K}/mk-chi-tiet`, {
    clip: await clipTop(page, 560),
    marks: [{ el: banner, label: 'Lý do xin mở khóa', align: 'left' },
            { el: page.getByRole('button', { name: 'Duyệt mở khóa' }), label: 3 }, { el: page.getByRole('button', { name: 'Từ chối mở khóa' }), label: 'HOẶC' }],
  });
  await page.getByRole('button', { name: 'Duyệt mở khóa' }).click(); await page.waitForTimeout(1000);
  await shot(page, `${K}/mk-duyet-xn`, { clip: modal(page), marks: [{ el: modal(page).getByRole('button', { name: /xác nhận duyệt mở khóa/i }), label: 4 }] });
  await cancel(page);
  await page.getByRole('button', { name: 'Từ chối mở khóa' }).click(); await page.waitForTimeout(1000);
  await modal(page).locator('textarea').fill('Kết quả đã gửi phù hợp, không cần điều chỉnh. Đơn vị giữ nguyên bản đã gửi.');
  await shot(page, `${K}/mk-tu-choi`, {
    clip: modal(page),
    marks: [{ el: modal(page).locator('textarea'), label: 4 }, { el: modal(page).getByRole('button', { name: /xác nhận từ chối mở khóa/i }), label: 5 }],
  });
  await cancel(page);

  // Hồ sơ gửi Bộ + Lịch sử của kết quả đang Chờ mở khóa (lịch sử ngắn, đủ các bước)
  const tabBtn = (re) => page.getByText(re).first();
  const atTop = async (el) => { await el.evaluate(e => e.scrollIntoView({ block: 'start' })); await page.mouse.wheel(0, -90); await page.waitForTimeout(600); };
  const viewClip = async () => { const b = await main(page).boundingBox(); return { x: b.x, y: 0, width: W.width - b.x, height: W.height }; };
  await tabBtn('Hồ sơ gửi Bộ').click(); await page.waitForTimeout(1500); await tidy(page);
  await atTop(tabBtn('Hồ sơ gửi Bộ'));
  await shot(page, `${K}/ct-ho-so`, { clip: await viewClip(), marks: [{ el: tabBtn('Hồ sơ gửi Bộ'), label: 3 }] });
  await tabBtn(/^Lịch sử \(/).click(); await page.waitForTimeout(1500); await tidy(page);
  await atTop(tabBtn(/^Lịch sử \(/));
  await shot(page, `${K}/ct-lich-su`, { clip: await viewClip(), marks: [{ el: tabBtn(/^Lịch sử \(/), label: 4 }] });

  // Chi tiết kết quả đã gửi (UC2.5)
  await goFresh(page, RES_FX);
  const sent = rowBy(page, 'Đã gửi', 'QA - Đơn vị Bộ');
  await sent.getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(2500); await tidy(page);
  await shot(page, `${K}/ct-tong-quan`, {
    marks: [{ el: page.getByText('Thông tin chung', { exact: true }).locator('xpath=ancestor::div[.//*[contains(text(),"Thời gian thực hiện")]][1]'), label: 1 },
            { el: tabBtn(/^Chấm điểm \(/), label: 2 }],
  });
  await page.close();
}

// ================================================================ 3. Thao tác cần được phân quyền: Xuất Excel, Gửi nhắc nhở, Yêu cầu đánh giá lại (chụp bằng canbo, cắt vùng nội dung)
{
  const { page } = await openRole('canbo', W);
  await goFresh(page, RES_FX); await tidy(page);
  await shot(page, `${K}/nn-nut`, {
    clip: await clipTop(page, 520),
    marks: [{ el: page.getByRole('button', { name: /xuất excel/i }).first(), label: 'XUẤT EXCEL', pos: 'bottom', align: 'left' },
            { el: page.getByRole('button', { name: /gửi nhắc nhở/i }).first(), label: 1 }],
  });
  await page.getByRole('button', { name: /gửi nhắc nhở/i }).first().click(); await page.waitForTimeout(1200); await tidy(page);
  const ta = modal(page).locator('textarea');
  if (await ta.count()) await ta.first().fill('Đề nghị các đơn vị hoàn thành tự đánh giá và gửi kết quả về Bộ trước hạn nộp.');
  await shot(page, `${K}/nn-hop-thoai`, {
    clip: modal(page),
    marks: [{ el: modal(page).getByText(/Đơn vị nhận nhắc nhở/).first(), label: 2, align: 'left' },
            ...(await ta.count() ? [{ el: ta.first(), label: 3 }] : []),
            { el: modal(page).getByRole('button', { name: /gửi nhắc nhở \(/i }), label: 4 }],
  });
  await cancel(page);
  // Nhắc một đơn vị từ menu dòng
  const appr = rowBy(page, 'Đã phê duyệt');
  let dd = await openRowMenu(page, appr, true);
  await shot(page, `${K}/nn-dong`, {
    keepMouse: true, clip: await menuClip(page, appr, dd),
    marks: [{ el: dd.locator('.ant-dropdown-menu-item', { hasText: 'Nhắc nhở đơn vị' }).first(), label: 1 }],
  });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  // Yêu cầu đánh giá lại
  const sent = rowBy(page, 'Đã gửi', 'QA - Đơn vị Bộ');
  dd = await openRowMenu(page, sent, true);
  await shot(page, `${K}/dgl-menu`, {
    keepMouse: true, clip: await menuClip(page, sent, dd),
    marks: [{ el: dd.locator('.ant-dropdown-menu-item', { hasText: 'Yêu cầu đánh giá lại' }).first(), label: 1 }],
  });
  await dd.locator('.ant-dropdown-menu-item', { hasText: 'Yêu cầu đánh giá lại' }).first().click(); await page.waitForTimeout(1200);
  await modal(page).locator('textarea').first().fill('Chỉ số BA-TEST-I1 chưa có minh chứng kèm theo. Đề nghị đơn vị bổ sung minh chứng và gửi lại.');
  await shot(page, `${K}/dgl-hop-thoai`, {
    clip: modal(page),
    marks: [{ el: modal(page).locator('textarea').first(), label: 2 }, { el: modal(page).getByRole('button', { name: /gửi yêu cầu đánh giá lại/i }), label: 3 }],
  });
  await cancel(page);
  await page.close();
}

// ================================================================ 4. Báo cáo thống kê
{
  const { page } = await openRole(K, W);
  await go(page, 'reports/ranking', 2500);
  const sel = page.locator('.ant-select');
  const pick = async (i) => {
    await sel.nth(i).click(); await page.waitForTimeout(700);
    const o = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').first();
    if (await o.count()) await o.click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
  };
  await pick(0); await tidy(page);
  await shot(page, `${K}/bc-xep-hang`, {
    marks: [{ el: page.locator('.ant-menu-item').filter({ hasText: 'Bảng xếp hạng' }).first(), label: 1 },
            { el: sel.nth(0), label: 2 }, { el: sel.nth(1), label: 3 }, { el: sel.nth(2), label: 4 },
            { el: page.locator('.ant-segmented').first(), label: 5 }],
  });
  await page.locator('.ant-segmented-item').filter({ hasText: 'Xem dữ liệu cột' }).click().catch(() => {}); await page.waitForTimeout(2000);
  await shot(page, `${K}/bc-xep-hang-bieu-do`, { clip: await clipTop(page, 900) });
  await go(page, 'reports/compare', 3000); await tidy(page);
  await shot(page, `${K}/bc-so-sanh`, {
    marks: [{ el: page.locator('.ant-menu-item').filter({ hasText: 'So sánh đơn vị' }).first(), label: 1 },
            { el: page.locator('.ant-segmented').filter({ hasText: 'So sánh chi tiết' }).first(), label: 2 },
            { el: page.locator('.ant-segmented').filter({ hasText: 'Quý' }).first().locator('xpath=ancestor::div[.//*[contains(text(),"Chỉ tiêu so sánh")]][1]'), label: 3, align: 'left' },
            { el: page.getByRole('button', { name: /thêm đơn vị/i }), label: 4 },
            { el: page.getByRole('button', { name: /xuất excel/i }), label: 5 }],
  });
  await page.getByRole('button', { name: /thêm đơn vị/i }).click(); await page.waitForTimeout(1200);
  const d = page.locator('.ant-modal:visible, .ant-popover:visible, .ant-drawer-content:visible').last();
  if (await d.count()) { await tidy(page); await shot(page, `${K}/bc-so-sanh-them-dv`, { clip: d, keepMouse: true }); await page.keyboard.press('Escape'); }
  await page.close();
}
await closeAll();
