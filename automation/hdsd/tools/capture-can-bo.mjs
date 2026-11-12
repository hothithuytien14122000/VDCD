// Chụp ảnh tài liệu HDSD vai trò Cán bộ → hdsd/out/img/canbo/{c,e}-*.png
// Dùng: node hdsd/tools/capture-can-bo.mjs [c] [e]   (mặc định chụp cả hai phần)
//
// AN TOÀN DỮ LIỆU:
// - Phân hệ C (Kết quả tự đánh giá): chỉ mở màn hình/hộp thoại, nhập thử rồi Hủy chỉnh sửa / Huỷ — KHÔNG Lưu nháp,
//   Trình duyệt, Gửi Bộ, Xin mở khóa. Tệp minh chứng thử chỉ được tải lên kho tệp tạm (chưa gắn vào kết quả vì không lưu).
// - Phân hệ E: tài khoản qc.canbo hiện KHÔNG tạo/xem phiếu được (lỗi phạm vi dữ liệu, xem BLOCKED_CREATE trong scripts/E/common.ts),
//   nên màn chi tiết/sửa/phiếu chụp bằng session superadmin (cắt bỏ vùng tên tài khoản). Form "Tạo đợt khảo sát" chụp bằng qc.canbo
//   (chỉ điền, không lưu). Đợt nháp minh họa "… qc.automation HDSD" tạo qua API và bị xóa ngay trong finally.
import fs from 'node:fs';
import { openRole, go, shot, closeAll, dialog, wrap } from './shot.mjs';

const ARGS = process.argv.slice(2);
const RUN = (k) => !ARGS.length || ARGS.includes(k);
const DIR = 'canbo';
const PDF = 'hdsd/out/tmp-canbo/Bien-ban-danh-gia-chi-so.pdf';

// ---------- API (dọn dữ liệu minh họa) ----------
const B = 'https://cds.geneat.pro/api/v1/';
const tok = (k) => JSON.parse(fs.readFileSync(`auth/${k}.json`, 'utf8')).origins[0].localStorage.map(x => x.value).find(v => v.split('.').length === 3);
async function api(method, res, body, as = 'superadmin') {
  const r = await fetch(B + res, { method, headers: { Authorization: 'Bearer ' + tok(as), 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const t = await r.text(); try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, text: t }; }
}
const day = (n) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const ORG_TEST = '994ce77a-0414-4506-8620-3068048525ff';   // đơn vị test superadmin tạo được đợt (xem scripts/E/common.ts)

// ---------- helper giao diện ----------
const main = (page) => page.locator('main, .ant-layout-content').first();
const rows = (page) => page.locator('tbody tr.ant-table-row');
const JUNK = ['<script', '!!', '@@@', 'aaaaaa', 'testabc', 'test data', 'TEST_DOT', 'sdfdsfds', '[Auto-test]', 'probe', 'FX ', 'qc.automation E '];
async function hideJunk(page, keep = []) {
  await page.evaluate(([junk, keep]) => {
    document.querySelectorAll('tbody tr').forEach(tr => {
      const t = tr.innerText;
      if (junk.some(j => t.includes(j)) && !keep.some(k => t.includes(k))) tr.style.display = 'none';
    });
    // đánh lại số thứ tự các dòng còn hiển thị
    document.querySelectorAll('tbody').forEach(tb => { let i = 0; tb.querySelectorAll('tr.ant-table-row').forEach(tr => { if (tr.style.display === 'none') return; const td = tr.querySelector('td'); i++; if (td && /^\d+$/.test(td.innerText.trim())) td.innerText = String(i); }); });
  }, [JUNK, keep]);
}
const dd = (page) => page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu').last();
async function openResult(page, mode, tab, name) {
  await go(page, 'assessment-results', 2000);
  if (mode === 'Đột xuất') { await page.getByText('Đột xuất', { exact: true }).click(); await page.waitForTimeout(1500); }
  await page.locator('.ant-tabs-tab').filter({ hasText: tab }).first().click(); await page.waitForTimeout(1800);
  const row = rows(page).filter({ hasText: name }).first();
  await row.getByText('Xem chi tiết').first().click(); await page.waitForTimeout(2800);
}
// Khu vực làm việc (main) là vùng cuộn: đưa phần tử lên đầu, chừa khoảng off px phía trên
const scrollAt = (loc, off = 0) => loc.evaluate((e, off) => { e.scrollIntoView({ block: 'start' }); document.querySelector('main')?.scrollBy(0, -off); }, off);
const top = (page) => page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
// Ẩn các nút chức năng phía Bộ (tài khoản test qc.canbo có thêm quyền phía Bộ, Cán bộ đơn vị không có các nút này)
const BO_BTNS = ['Nhắc nhở đơn vị', 'Yêu cầu đánh giá lại', 'Gửi nhắc nhở'];
const hideBo = (page) => page.evaluate((names) => document.querySelectorAll('button').forEach(b => { if (names.some(n => b.innerText.trim().startsWith(n))) b.style.display = 'none'; }), BO_BTNS);
// Khung bao nhiều phần tử (đánh dấu cả một vùng gồm nhiều ô)
async function span(...locs) {
  const pad = 10, bs = await Promise.all(locs.map(l => l.boundingBox()));
  const l = Math.min(...bs.map(b => b.x)) - pad, t = Math.min(...bs.map(b => b.y)) - pad;
  return { x: l, y: t, width: Math.max(...bs.map(b => b.x + b.width)) + pad - l, height: Math.max(...bs.map(b => b.y + b.height)) + pad - t };
}
// Đơn vị thử nghiệm của tài khoản superadmin có tên "aaaaaa" → hiển thị tên dễ đọc trên ảnh
const renameOrg = (page) => page.evaluate(() => { const w = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.includes('aaaaaa')) n.nodeValue = n.nodeValue.replace(/(a{3,}\s*-\s*)?a{6,}/g, 'Đơn vị thử nghiệm'); });
const collapseSider = async (page) => { await page.locator('header button, .ant-layout-header button').first().click().catch(() => {}); await page.waitForTimeout(700); };

// =====================================================================================================
// PHẦN C — KẾT QUẢ TỰ ĐÁNH GIÁ (tài khoản qc.canbo)
// =====================================================================================================
async function partC() {
  const shotC = async (page, file, opts) => { await hideBo(page); return shot(page, file, opts); };
  fs.mkdirSync('hdsd/out/tmp-canbo', { recursive: true });
  fs.writeFileSync(PDF, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const { page } = await openRole('canbo');

  // 1. Danh sách
  await go(page, 'assessment-results', 2500);
  await page.getByText('Đột xuất', { exact: true }).click(); await page.waitForTimeout(2000);
  await hideJunk(page);
  const side = page.getByRole('complementary');
  await shotC(page, `${DIR}/c-ds`, {
    marks: [
      { el: side.locator('.ant-menu-item').filter({ hasText: 'Kết quả tự đánh giá' }).first(), label: 1 },
      { el: page.locator('.ant-segmented').first(), label: 2, pos: 'bottom' },
      { el: page.locator('.ant-tabs-nav').first(), label: 3 },
      { el: page.locator('input[placeholder*="Tìm"]').first().locator('xpath=ancestor::*[contains(@class,"ant-input-affix-wrapper")][1]'), label: 4 },
      { el: main(page).locator('.ant-select').filter({ hasText: 'Trạng thái tiến trình' }).first(), label: 4 },
      { el: main(page).locator('.ant-select').filter({ hasText: 'Kỳ đánh giá' }).first(), label: 4 },
      { el: page.getByRole('button', { name: 'Xuất Excel' }).first(), label: 5, pos: 'bottom' },
    ],
  });
  // Menu thao tác trên dòng
  const row = rows(page).filter({ hasText: 'Kỳ tự đánh giá Đột xuất QC Q4/2026' }).first();
  await row.locator('button').last().click(); await page.waitForTimeout(700);
  const rb = await row.boundingBox();
  await shotC(page, `${DIR}/c-ds-menu`, {
    keepMouse: true, clip: { x: 380, y: Math.max(0, rb.y - 40), width: 1060, height: Math.min(330, 900 - Math.max(0, rb.y - 40)) },
    marks: [{ el: row.locator('button').last(), label: 1 }, { el: dd(page).getByText('Bắt đầu chấm'), label: 2 }],
  });
  await page.keyboard.press('Escape');

  // 2. Chi tiết (chế độ xem) — kết quả Chưa thực hiện của đơn vị
  await openResult(page, 'Đột xuất', 'Chưa thực hiện', 'Kỳ tự đánh giá Đột xuất QC Q4/2026');
  if (await page.getByRole('button', { name: 'Hủy chỉnh sửa' }).count()) { await page.getByRole('button', { name: 'Hủy chỉnh sửa' }).click(); await page.waitForTimeout(1500); }
  await shotC(page, `${DIR}/c-ct-tong-quan`, {
    clip: { x: 260, y: 64, width: 1180, height: 836 },
    marks: [
      { el: page.getByRole('button', { name: 'Bắt đầu chấm' }), label: '(1)', pos: 'bottom' },
      { el: await span(page.getByText('Thông tin chung', { exact: true }), page.getByText(/Tên Bộ Chỉ Số QC/).first().locator('xpath=ancestor::div[1]'), page.getByText('Thời gian thực hiện').first()), label: '(2)', pos: 'inside' },
      { el: page.getByText('TIẾN ĐỘ CHẤM').locator('xpath=ancestor::div[3]'), label: '(3)', pos: 'inside' },
      { el: page.locator('.ant-tabs-nav').first(), label: '(4)' },
    ],
  });

  // 3. Chấm điểm — nhập thử trên 2 dòng đầu, tải 1 tệp minh chứng rồi Hủy chỉnh sửa (không lưu)
  await page.getByRole('button', { name: 'Bắt đầu chấm' }).click(); await page.waitForTimeout(1500);
  const r1 = main(page).locator('tr').filter({ hasText: 'TEST_N03_CS02_1' }).last();
  const r2 = main(page).locator('tr').filter({ hasText: 'TEST_N03_CS05_1' }).last();
  await r1.locator('input').first().fill('2'); await r2.locator('input').first().fill('1');
  const note1 = r1.locator('input, textarea').last();
  await note1.fill('Đã triển khai đầy đủ, xem biên bản kèm theo');
  const fc = page.waitForEvent('filechooser');
  await r1.getByRole('button', { name: 'Tải file' }).click();
  await (await fc).setFiles(PDF); await page.waitForTimeout(2500);
  await top(page); await page.waitForTimeout(300);
  await shotC(page, `${DIR}/c-cham-dau-trang`, {
    clip: { x: 260, y: 64, width: 1180, height: 400 },
    marks: [
      { el: page.getByRole('button', { name: 'Lưu nháp' }), label: 5, pos: 'bottom' },
      { el: page.getByRole('button', { name: 'Hủy chỉnh sửa' }), label: 'Thoát, không lưu', pos: 'bottom', align: 'left' },
      { el: page.getByText('ĐIỂM TẠM TÍNH').locator('xpath=ancestor::div[2]'), label: 'Tự cập nhật', pos: 'inside' },
    ],
  });
  const search = page.locator('input[placeholder*="Tìm mã hoặc tên chỉ số"]').locator('xpath=ancestor::*[contains(@class,"ant-input-affix-wrapper")][1]');
  await scrollAt(search, 190); await page.waitForTimeout(400);
  await shotC(page, `${DIR}/c-cham-bang`, {
    clip: { x: 260, y: 64, width: 1180, height: 560 },
    marks: [
      { el: search, label: 1 },
      { el: r1.locator('td').nth(2), label: 2 },
      { el: r1.locator('td').nth(3), label: 3 },
      { el: note1, label: 4 },
    ],
  });
  console.log('  [ô minh chứng]', (await r1.locator('td').nth(3).innerHTML()).replace(/<path[^>]*>/g, '').slice(0, 1200));
  // Xóa minh chứng: biểu tượng xóa cạnh tên tệp
  await shotC(page, `${DIR}/c-minh-chung-xoa`, {
    clip: await r1.boundingBox().then(b => ({ x: 260, y: b.y - 30, width: 1180, height: b.height + 60 })),
    marks: [{ el: r1.locator('td').nth(3).locator('.anticon-delete, [aria-label=delete]').first(), label: 'Xóa tệp', pad: 2 }],
  });
  // Hủy chỉnh sửa (không lưu)
  await page.getByRole('button', { name: 'Hủy chỉnh sửa' }).click(); await page.waitForTimeout(800);
  const yes = page.getByRole('button', { name: /^(Đồng ý|Có|OK|Thoát)$/ }).filter({ visible: true });
  if (await yes.count()) { await yes.last().click(); await page.waitForTimeout(800); }

  // 4. Trình duyệt khi chưa đủ điểm
  await page.getByRole('button', { name: 'Trình duyệt' }).first().click(); await page.waitForTimeout(1200);
  await shotC(page, `${DIR}/c-trinh-thieu`, { clip: dialog(page) });
  await page.getByRole('button', { name: 'Quay lại bổ sung' }).click().catch(() => page.keyboard.press('Escape')); await page.waitForTimeout(600);

  // 5. Trình duyệt khi đủ điểm (chỉ mở hộp thoại rồi Huỷ)
  await openResult(page, 'Đột xuất', 'Đang chấm điểm', 'qc.automation RES c3 probe');
  await page.getByRole('button', { name: 'Trình duyệt' }).first().click(); await page.waitForTimeout(1200);
  await shotC(page, `${DIR}/c-trinh-xac-nhan`, { clip: dialog(page), marks: [{ el: page.getByRole('button', { name: 'Xác nhận trình duyệt' }), label: 3 }] });
  await page.getByRole('button', { name: /^Huỷ$/ }).last().click(); await page.waitForTimeout(500);
  await shotC(page, `${DIR}/c-trinh-nut`, {
    clip: { x: 260, y: 64, width: 1180, height: 260 },
    marks: [{ el: page.getByRole('button', { name: 'Trình duyệt' }).first(), label: 2, pos: 'bottom' }],
  });

  // 6. Kết quả bị từ chối
  await openResult(page, 'Đột xuất', 'Bị từ chối', 'qc.automation RES khảo sát 1');
  await shotC(page, `${DIR}/c-bi-tu-choi`, {
    clip: { x: 260, y: 64, width: 1180, height: 330 },
    marks: [{ el: page.getByText(/Bị từ chối phê duyệt/).locator('xpath=ancestor::div[1]'), label: 1, pos: 'bottom' },
            { el: page.getByRole('button', { name: 'Trình duyệt' }).first(), label: 3, pos: 'bottom' }],
  });
  // Lịch sử
  await page.getByRole('tab', { name: /Lịch sử/ }).click(); await page.waitForTimeout(1500);
  const hist = page.getByText('Lịch sử thao tác', { exact: false }).first();
  await scrollAt(hist, 120); await page.waitForTimeout(300);
  await shotC(page, `${DIR}/c-lich-su`, { clip: { x: 260, y: 64, width: 1180, height: 700 } });

  // 7. Gửi Bộ (kết quả Đã phê duyệt) — chỉ xem form, không gửi
  await openResult(page, 'Đột xuất', 'Đã phê duyệt', 'qc.automation RES c2 DP only');
  await shotC(page, `${DIR}/c-gui-bo-nut`, {
    clip: { x: 260, y: 64, width: 1180, height: 330 },
    marks: [{ el: page.getByRole('button', { name: 'Gửi Bộ' }), label: 1, pos: 'bottom' }],
  });
  // Hộp thoại xác nhận gửi Bộ → chỉ chụp rồi Huỷ
  await page.getByRole('button', { name: 'Gửi Bộ' }).click(); await page.waitForTimeout(1500);
  await shotC(page, `${DIR}/c-gui-bo-dlg`, { clip: dialog(page), marks: [{ el: page.getByRole('button', { name: 'Xác nhận gửi Bộ' }), label: 6 }] });
  await dialog(page).getByRole('button', { name: /^Hu[ỷủ]$/ }).click(); await page.waitForTimeout(800);
  await page.getByRole('tab', { name: /Hồ sơ gửi Bộ/ }).click(); await page.waitForTimeout(1800);
  const cond = page.getByText('Điều kiện gửi kết quả về Bộ').first();
  await scrollAt(cond, 70); await page.waitForTimeout(400);
  const sendBtn = page.getByRole('button', { name: 'Gửi kết quả về Bộ' });
  await sendBtn.evaluate(e => e.scrollIntoView({ block: 'end' })); await page.evaluate(() => document.querySelector('main')?.scrollBy(0, 120)); await page.waitForTimeout(400);
  await shotC(page, `${DIR}/c-gui-bo-form`, { clip: { x: 260, y: 64, width: 1180, height: 836 }, marks: [
    { el: await span(cond, page.getByText(/chưa có minh chứng/).first().locator('xpath=ancestor::div[1]')), label: 2, pos: 'inside', pad: 0 },
    { el: page.getByRole('button', { name: /Thay file khác|Tải lên/ }).first(), label: 3, pos: 'bottom' },
    { el: await span(page.getByText('Hình thức văn bản', { exact: true }), page.locator('main textarea').last()), label: 4, pos: 'inside', pad: 0 },
    { el: sendBtn, label: 5 },
  ] });
  console.log('  [hồ sơ gửi Bộ]', (await main(page).innerText()).replace(/\s+/g, ' ').match(/Điều kiện gửi.*$/)?.[0].slice(0, 900));

  // 8. Xin mở khóa (kết quả Đã gửi, kỳ đang diễn ra) — điền lý do rồi Huỷ
  await openResult(page, 'Đột xuất', 'Đã gửi', 'TEST_KY_01');
  await shotC(page, `${DIR}/c-mo-khoa-nut`, {
    clip: { x: 260, y: 64, width: 1180, height: 330 },
    marks: [{ el: page.getByRole('button', { name: 'Xin mở khóa' }), label: 1, pos: 'bottom' }],
  });
  await page.getByRole('button', { name: 'Xin mở khóa' }).click(); await page.waitForTimeout(1000);
  await dialog(page).locator('textarea').fill('Phát hiện nhập sai điểm chỉ số 1.2.1, đề nghị mở khóa để cập nhật lại minh chứng và điểm.');
  await shotC(page, `${DIR}/c-mo-khoa-dlg`, {
    clip: dialog(page),
    marks: [{ el: dialog(page).locator('textarea'), label: 2 }, { el: page.getByRole('button', { name: 'Gửi yêu cầu mở khóa' }), label: 3 }],
  });
  await page.getByRole('button', { name: /^Huỷ$/ }).last().click(); await page.waitForTimeout(500);
  // Hồ sơ đã gửi
  await page.getByRole('tab', { name: /Hồ sơ gửi Bộ/ }).click(); await page.waitForTimeout(1500);
  const sent = page.getByText(/Lịch sử các bản đã gửi Bộ/).first();
  if (await sent.count()) { await scrollAt(sent, 200); await page.waitForTimeout(300); }
  await shotC(page, `${DIR}/c-ho-so-da-gui`, { clip: { x: 260, y: 64, width: 1180, height: 700 } });
  await page.close();
}

// =====================================================================================================
// PHẦN E — ĐỢT KHẢO SÁT & PHIẾU TRẢ LỜI
// =====================================================================================================
const SV202 = '43d23490-44f2-467c-b25b-571573e6d687';   // KS-2026-202 Đang diễn ra (3 hình thức)
const SV206_CODE = 'KS-2026-206';                        // Bị từ chối
const SVRES = '7d951a4a-4085-4cb5-9182-45ef2c2efcc4';   // KS-2026-425 fixture có phiếu Trực tiếp/Gián tiếp
const DRAFT_NAME = 'Khảo sát mức độ hài lòng về dịch vụ công trực tuyến năm 2026 (qc.automation HDSD)';

async function partE() {
  // Tạo đợt khảo sát — form của Cán bộ (không lưu)
  {
    const { page } = await openRole('canbo');
    await go(page, 'survey-campaigns', 2500);
    await renameOrg(page); await shot(page, `${DIR}/e-ds-canbo`, {
      marks: [
        { el: page.getByRole('complementary').locator('.ant-menu-item').filter({ hasText: 'Đợt khảo sát' }).first(), label: 'Mở menu' },
        { el: page.getByText('Tạo đợt khảo sát').first(), label: 'Nhấn Tạo đợt khảo sát', pos: 'bottom' },
      ],
    });
    await page.getByText('Tạo đợt khảo sát').first().click(); await page.waitForTimeout(2500);
    await collapseSider(page);
    await page.locator('#survey-name').fill('Khảo sát mức độ hài lòng về dịch vụ công trực tuyến năm 2026');
    await page.locator('textarea').first().fill('Đánh giá mức độ hài lòng của người dân khi sử dụng dịch vụ công trực tuyến của đơn vị.');
    const setDate = async (id, v) => { const i = page.locator(`#${id}`); await i.click(); await i.fill(v); await page.keyboard.press('Enter'); await page.waitForTimeout(300); };
    const dmy = (iso) => iso.split('-').reverse().join('/');
    await setDate('survey-start-date', dmy(day(3))); await setDate('survey-end-date', dmy(day(33)));
    await page.locator('#survey-target').fill('500');
    await page.locator('#survey-group-name-1').fill('Dịch vụ công trực tuyến');
    await page.getByPlaceholder('Nhập nội dung câu hỏi').first().fill('Cổng dịch vụ công dễ truy cập, giao diện thân thiện, dễ sử dụng');
    await page.locator('#survey-add-question-group-1').click(); await page.waitForTimeout(300);
    await page.getByPlaceholder('Nhập nội dung câu hỏi').nth(1).fill('Các bước thực hiện thủ tục trực tuyến rõ ràng, dễ hiểu');
    for (const t of ['Direct']) { const b = page.locator(`#survey-type-${t}`); await b.click(); await page.waitForTimeout(200); }
    await top(page); await page.waitForTimeout(300);
    await renameOrg(page); await shot(page, `${DIR}/e-tao-thong-tin`, {
      clip: { x: 80, y: 64, width: 1360, height: 836 },
      marks: [
        { el: page.locator('#survey-name'), label: 1 },
        { el: page.locator('textarea').first(), label: 2 },
        { el: page.locator('#survey-start-date').locator('xpath=ancestor::*[contains(@class,"ant-picker")][1]'), label: 3 },
        { el: page.locator('#survey-end-date').locator('xpath=ancestor::*[contains(@class,"ant-picker")][1]'), label: 3 },
        { el: page.locator('#survey-target'), label: 4 },
        { el: page.locator('#survey-type-Online').locator('xpath=..'), label: 8 },
      ],
    });
    const nd = await page.locator('#survey-add-group-btn').boundingBox();
    await renameOrg(page); await shot(page, `${DIR}/e-tao-noi-dung`, {
      clip: { x: 80, y: nd.y - 40, width: 960, height: 900 - (nd.y - 40) },
      marks: [
        { el: page.locator('#survey-group-name-1'), label: 5 },
        { el: page.locator('#survey-add-question-group-1'), label: 6 },
        { el: page.locator('#survey-add-group-btn'), label: 7 },
      ],
    });
    await top(page); await page.waitForTimeout(300);
    await renameOrg(page); await shot(page, `${DIR}/e-tao-luu`, {
      clip: { x: 80, y: 64, width: 1360, height: 160 },
      marks: [{ el: page.locator('#survey-save-draft-btn'), label: 9, pos: 'bottom' }, { el: page.locator('#survey-save-submit-btn'), label: 10, pos: 'bottom' }],
    });
    // Báo lỗi khi bỏ trống tên
    await page.locator('#survey-name').fill('');
    await page.locator('#survey-save-submit-btn').click(); await page.waitForTimeout(1000);
    await top(page); await page.waitForTimeout(300);
    await page.waitForTimeout(800);
    const fi = await page.locator('#survey-name').locator('xpath=ancestor::*[contains(@class,"ant-form-item")][1]').boundingBox();
    await renameOrg(page); await shot(page, `${DIR}/e-tao-loi`, { clip: { x: fi.x - 12, y: fi.y - 10, width: fi.width + 24, height: fi.height + 40 } });
    await page.close();
  }

  // Đợt nháp minh họa (superadmin) — xóa trong finally
  const r = await api('POST', 'survey/surveys', {
    name: DRAFT_NAME, organizationId: ORG_TEST, startDate: day(3), endDate: day(33), methods: [1, 2, 3], voteTarget: 500,
    description: 'Đánh giá mức độ hài lòng của người dân khi sử dụng dịch vụ công trực tuyến của đơn vị.', status: 1,
    groups: [
      { name: 'Dịch vụ công trực tuyến', questions: [{ content: 'Cổng dịch vụ công dễ truy cập, giao diện thân thiện, dễ sử dụng' }, { content: 'Các bước thực hiện thủ tục trực tuyến rõ ràng, dễ hiểu' }] },
      { name: 'Tiếp nhận, xử lý phản ánh kiến nghị', questions: [{ content: 'Phản ánh, kiến nghị được phản hồi trong thời gian quy định' }] },
    ],
  });
  const draftId = r.data?.id;
  if (!draftId) throw new Error('Không tạo được đợt nháp minh họa: ' + r.message);
  console.log('  + tạo đợt nháp minh họa', r.data.code ?? draftId);
  try {
    const { page } = await openRole('superadmin', { width: 1600, height: 900 });
    // Danh sách
    await go(page, 'survey-campaigns', 2500);
    await collapseSider(page);
    await page.locator('input[placeholder*="Tìm"]').first().fill('Khảo sát'); await page.keyboard.press('Enter'); await page.waitForTimeout(2200);
    await hideJunk(page, ['HDSD']);
    await renameOrg(page); await shot(page, `${DIR}/e-ds`, {
      clip: { x: 80, y: 64, width: 1520, height: 836 },
      marks: [
        { el: page.locator('.ant-tabs-nav').first(), label: 1 },
        { el: page.locator('input[placeholder*="Tìm"]').first().locator('xpath=ancestor::*[contains(@class,"ant-input-affix-wrapper")][1]'), label: 2 },
        { el: main(page).locator('.ant-select').filter({ hasText: 'hình thức' }).first(), label: 3 },
        { el: main(page).locator('.ant-select').filter({ hasText: 'năm' }).first(), label: 3 },
        { el: page.getByRole('button', { name: 'Xuất Excel' }).first(), label: 4, pos: 'bottom' },
      ],
    });
    const drow = rows(page).filter({ hasText: 'HDSD' }).first();
    await drow.locator('button').last().click(); await page.waitForTimeout(700);
    const db = await drow.boundingBox();
    await renameOrg(page); await shot(page, `${DIR}/e-ds-menu`, {
      keepMouse: true, clip: { x: 500, y: Math.max(0, db.y - 30), width: 1100, height: Math.min(300, 900 - Math.max(0, db.y - 30)) },
      marks: [{ el: drow.locator('button').last(), label: 1 }, { el: dd(page), label: 2, pos: 'bottom' }],
    });
    await page.keyboard.press('Escape');

    // Chi tiết đợt nháp
    await go(page, `survey-campaigns/${draftId}`, 2800);
    await renameOrg(page); await shot(page, `${DIR}/e-ct-nhap`, {
      clip: { x: 80, y: 64, width: 1520, height: 836 },
      marks: [
        { el: main(page).getByRole('button', { name: 'Sửa' }), label: 'Sửa', pos: 'bottom' },
        { el: main(page).getByRole('button', { name: 'Trình phê duyệt' }), label: 'Trình phê duyệt', pos: 'bottom' },
        { el: main(page).getByRole('button', { name: 'Xoá' }), label: 'Xóa', pos: 'bottom', align: 'left' },
      ],
    });
    // Trình phê duyệt (hộp thoại → Không)
    await main(page).getByRole('button', { name: 'Trình phê duyệt' }).click(); await page.waitForTimeout(1000);
    await renameOrg(page); await shot(page, `${DIR}/e-trinh-dlg`, { clip: dialog(page), marks: [{ el: page.getByRole('button', { name: 'Có', exact: true }).last(), label: 2 }] });
    await page.getByRole('button', { name: 'Không', exact: true }).last().click(); await page.waitForTimeout(500);
    // Xóa (hộp thoại → Không)
    await main(page).getByRole('button', { name: 'Xoá' }).click(); await page.waitForTimeout(1000);
    await renameOrg(page); await shot(page, `${DIR}/e-xoa-dlg`, { clip: dialog(page), marks: [{ el: page.getByRole('button', { name: 'Có', exact: true }).last(), label: 2 }] });
    await page.getByRole('button', { name: 'Không', exact: true }).last().click(); await page.waitForTimeout(500);
    // Sửa
    await main(page).getByRole('button', { name: 'Sửa' }).click(); await page.waitForTimeout(2200);
    await page.locator('#survey-target').fill('600'); await page.waitForTimeout(300);
    await renameOrg(page); await shot(page, `${DIR}/e-sua`, {
      clip: { x: 80, y: 64, width: 1520, height: 836 },
      marks: [{ el: page.locator('#survey-target'), label: 2 }, { el: page.locator('#survey-save-draft-btn'), label: 3, pos: 'bottom' },
              { el: page.locator('#survey-save-submit-btn'), label: 3, pos: 'bottom' }],
    });
    await page.locator('#survey-cancel-btn').click(); await page.waitForTimeout(800);
    const leave = page.getByRole('button', { name: /^(Đồng ý|Có|OK|Thoát|Rời đi)$/ }).filter({ visible: true });
    if (await leave.count()) { await leave.last().click(); await page.waitForTimeout(600); }

    // Bị từ chối
    await go(page, 'survey-campaigns', 2200);
    await page.locator('input[placeholder*="Tìm"]').first().fill(SV206_CODE); await page.keyboard.press('Enter'); await page.waitForTimeout(2000);
    await rows(page).first().getByText('Xem chi tiết').first().click(); await page.waitForTimeout(2800);
    await renameOrg(page); await shot(page, `${DIR}/e-ct-tu-choi`, { clip: { x: 80, y: 64, width: 1520, height: 420 } });

    // Chi tiết đợt đang diễn ra + hình thức thực hiện + lịch sử
    await go(page, `survey-campaigns/${SV202}`, 3000);
    await renameOrg(page); await shot(page, `${DIR}/e-ct-thong-tin`, {
      clip: { x: 80, y: 64, width: 1520, height: 836 },
      marks: [{ el: page.getByText('Thông tin', { exact: true }).first().locator('xpath=ancestor::*[contains(@class,"ant-segmented") or contains(@class,"ant-tabs-nav")][1]'), label: '' }],
    });
    const ht = page.getByText('Hình thức thực hiện', { exact: true }).first();
    await scrollAt(ht, 80); await page.waitForTimeout(400);
    await renameOrg(page); await shot(page, `${DIR}/e-ct-hinh-thuc`, {
      clip: { x: 80, y: 64, width: 1520, height: 836 },
      marks: [
        { el: page.getByRole('button', { name: 'Sao chép' }), label: 'Sao chép link', align: 'left' },
        { el: page.getByRole('button', { name: 'Tải mã QR' }), label: 'Mã QR' },
        { el: page.getByRole('button', { name: /Tải mẫu phiếu/ }).first(), label: 'Tải mẫu', pos: 'bottom' },
        { el: page.getByRole('button', { name: /Nhập phiếu/ }).first(), label: 'Nhập phiếu', pos: 'bottom' },
      ],
    });
    const ls = page.getByText('Lịch sử xử lý', { exact: true }).first();
    await scrollAt(ls, 80); await page.waitForTimeout(400);
    await renameOrg(page); await shot(page, `${DIR}/e-ct-lich-su`, { clip: await ls.locator('xpath=ancestor::div[2]').boundingBox().then(b => ({ x: Math.max(0, b.x - 12), y: Math.max(64, b.y - 12), width: Math.min(1600 - b.x + 12, b.width + 24), height: Math.min(836, b.height + 24) })) });

    // Phiếu trả lời (đợt fixture có phiếu Trực tiếp/Gián tiếp)
    await go(page, `survey-campaigns/${SVRES}?tab=ph`, 3000);
    await renameOrg(page); await shot(page, `${DIR}/e-ph-ds`, {
      clip: { x: 80, y: 64, width: 1520, height: 836 },
      marks: [
        { el: main(page).getByText(/^Phiếu/).first(), label: 1 },
        { el: main(page).locator('.ant-select').filter({ hasText: 'hình thức' }).first(), label: 2 },
        { el: rows(page).filter({ hasText: 'Ghi chú D3' }).first().getByRole('button', { name: 'Xem chi tiết' }), label: 3, pos: 'bottom' },
        { el: page.getByRole('button', { name: /Nhập phiếu/ }).first(), label: 'Nhập phiếu', pos: 'bottom' },
      ],
    });
    const prow = rows(page).filter({ hasText: 'Ghi chú D3' }).first();
    await prow.getByRole('button', { name: 'Xem chi tiết' }).click(); await page.waitForTimeout(1500);
    await renameOrg(page); await shot(page, `${DIR}/e-ph-chi-tiet`, {
      clip: { x: 80, y: 64, width: 1520, height: 600 },
      marks: [{ el: page.getByRole('button', { name: 'Sửa', exact: true }).last(), label: 'Sửa', pos: 'bottom' }],
    });
    await page.getByRole('button', { name: 'Đóng' }).last().click(); await page.waitForTimeout(800);
    await prow.locator('button').last().click(); await page.waitForTimeout(700);
    const pb = await prow.boundingBox();
    await renameOrg(page); await shot(page, `${DIR}/e-ph-menu`, {
      keepMouse: true, clip: { x: 600, y: Math.max(0, pb.y - 40), width: 1000, height: Math.min(260, 900 - Math.max(0, pb.y - 40)) },
      marks: [{ el: prow.locator('button').last(), label: 1 }, { el: dd(page), label: 2, pos: 'bottom' }],
    });
    // Xóa phiếu: hộp thoại → Huỷ/Không
    await dd(page).getByText('Xóa phiếu').click(); await page.waitForTimeout(1000);
    await renameOrg(page); await shot(page, `${DIR}/e-ph-xoa-dlg`, { clip: dialog(page) });
    await page.getByRole('button', { name: /^(Không|Huỷ|Hủy)$/ }).filter({ visible: true }).last().click(); await page.waitForTimeout(600);
    // Sửa phiếu: mở form rồi Huỷ
    await prow.locator('button').last().click(); await page.waitForTimeout(600);
    await dd(page).getByText('Sửa phiếu').click(); await page.waitForTimeout(1500);
    await renameOrg(page); await shot(page, `${DIR}/e-ph-sua`, { clip: { x: 80, y: 64, width: 1520, height: 740 } });
    await page.getByRole('button', { name: /^Huỷ$/ }).first().click(); await page.waitForTimeout(800);
    if (await leave.count()) { await leave.last().click(); await page.waitForTimeout(600); }
    // Nhập phiếu mới: điền rồi Huỷ
    await go(page, `survey-campaigns/${SVRES}?tab=ph`, 2500);
    await page.getByRole('button', { name: /Nhập phiếu/ }).first().click(); await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Chọn tất cả Hài lòng' }).click(); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Chưa hài lòng', exact: true }).nth(1).click(); await page.waitForTimeout(300);
    await page.locator('textarea').first().fill('Đề nghị bổ sung hướng dẫn sử dụng cho người cao tuổi.');
    await page.getByRole('button', { name: /Trực tiếp/ }).first().click(); await page.waitForTimeout(400);
    await renameOrg(page); await shot(page, `${DIR}/e-ph-nhap`, {
      clip: { x: 80, y: 64, width: 1520, height: 740 },
      marks: [
        { el: page.getByRole('button', { name: 'Chọn tất cả Hài lòng' }), label: 2 },
        { el: page.getByRole('button', { name: 'Chưa hài lòng', exact: true }).nth(1), label: 3 },
        { el: page.locator('textarea').first(), label: 4 },
        { el: page.getByRole('button', { name: /Trực tiếp/ }).first().locator('xpath=..'), label: 5 },
        { el: page.getByRole('button', { name: 'Lưu phiếu' }), label: 6, pos: 'bottom' },
        { el: page.getByRole('button', { name: 'Lưu và nhập tiếp' }), label: 6, pos: 'bottom' },
      ],
    });
    await page.getByRole('button', { name: /^Huỷ$/ }).first().click(); await page.waitForTimeout(800);
    if (await leave.count()) { await leave.last().click(); await page.waitForTimeout(600); }
    await page.close();
  } finally {
    const del = await api('DELETE', `survey/surveys/${draftId}`);
    console.log('  − xóa đợt nháp minh họa:', del.status);
  }
}

try {
  if (RUN('c')) await partC();
  if (RUN('e')) await partE();
} finally {
  await closeAll();
  fs.rmSync('hdsd/out/tmp-canbo', { recursive: true, force: true });
}
