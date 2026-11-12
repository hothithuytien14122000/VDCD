// Chụp ảnh tài liệu HDSD – vai trò Lãnh đạo đơn vị (key ldd). Ảnh: hdsd/out/img/ldd/*.png
// Dùng: node hdsd/tools/capture-lanh-dao-don-vi.mjs
// KHÔNG ghi dữ liệu: hộp thoại Phê duyệt/Từ chối chỉ mở ra, điền mẫu, chụp rồi Huỷ/Không.
// Dữ liệu trên môi trường test là dữ liệu kiểm thử → đổi chữ hiển thị sang dữ liệu minh họa (demoText, chỉ trong DOM).
// Màn Kết quả khảo sát chụp bằng tài khoản superadmin (đợt "qc.automation E FX SRS60" có 60 phiếu), chỉ cắt vùng nội dung
// — giao diện giống hệt LĐĐV; tài khoản LĐĐV hiện không có đợt khảo sát nào đã có phiếu.
import fs from 'node:fs';
import { openRole, go, shot, closeAll, dialog, menu } from './shot.mjs';
import { demoText } from './demo-text.mjs';

const API = 'https://cds.geneat.pro/api/v1';
const tokenOf = (k) => JSON.parse(fs.readFileSync(`auth/${k}.json`, 'utf8')).origins[0].localStorage.map(x => x.value).find(v => v.split('.').length === 3);
const get = async (path, as = 'superadmin') => (await (await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${tokenOf(as)}` } })).json()).data;

// ---------- dữ liệu minh họa ----------
const RES_RULES = [
  { from: 'qc.automation RES1 chỉ số QCARES1I1', to: 'Tỷ lệ cán bộ, công chức được bồi dưỡng kỹ năng số' },
  { from: 'qc.automation RES1 chỉ số QCARES1I2', to: 'Tỷ lệ hồ sơ công việc được xử lý trên môi trường mạng' },
  { from: 'qc.automation RES1 chỉ số QCARES1I3', to: 'Tỷ lệ văn bản đi được ký số' },
  { from: /QCARES1I(\d)/, list: ['NT.01', 'NT.02', 'NT.03'] },
  { from: 'qc.automation RES1 Nhóm', to: 'Nhận thức số' },
  { from: 'qc.automation RES1 fixture BA', to: 'Tự đánh giá CĐS đột xuất Quý IV/2026' },
  { from: 'qc.automation RES1 fixture MI', to: 'Tự đánh giá CĐS đột xuất tháng 10/2026' },
  { from: 'qc.automation RES3 phía Bộ', to: 'Rà soát kết quả CĐS năm 2026' },
  { from: 'qc.automation RES3 fixture', to: 'Rà soát kết quả CĐS năm 2026' },
  { from: 'qc.automation RES c2 probe', to: 'Tự đánh giá CĐS đột xuất Quý III/2026' },
  { from: 'Tên Bộ Chỉ Số QC', to: 'Bộ chỉ số CĐS của cơ quan, đơn vị thuộc Bộ' },
  { from: 'qc.automation RES1 bộ chỉ số', to: 'Bộ chỉ số CĐS của cơ quan, đơn vị thuộc Bộ' },
  { from: 'BA-TEST Bo chi so kiem thu', to: 'Bộ chỉ số CĐS của cơ quan, đơn vị thuộc Bộ' },
  { from: 'BA-TEST Nhom chi so 1', to: 'Nhận thức số' },
  { from: 'BA-TEST Chi so 1', to: 'Tỷ lệ cán bộ, công chức được tập huấn kỹ năng số' },
  { from: 'BA-TEST-I1', to: 'NT.01' },
  { from: 'qc.automation RES1 ĐV C', to: 'Vụ Tổng hợp' },
  { from: 'qc.automation RES1 ĐV H', to: 'Vụ Kế hoạch – Tài chính' },
  { from: 'qc.automation RES1 ĐV D', to: 'Vụ Pháp chế' },
  { from: 'qc.automation RES3 ĐV1', to: 'Vụ Tổ chức cán bộ' },
  { from: 'qc.automation RES3 ĐV4', to: 'Thanh tra Bộ' },
  { from: 'QA - Địa phương', to: 'Ban Dân tộc tỉnh Lào Cai' },
  { from: 'QA - Đơn vị Bộ', to: 'Văn phòng Bộ' },
  { from: 'qca.pdf', to: 'BC-tu-danh-gia-CDS-QIII-2026.pdf' },
  { from: 'J18/BC', to: '125/BC-VP' },
  { from: /qc\.automation N\d+/, to: 'Đề nghị bổ sung minh chứng cho chỉ số NT.01' },
  { from: /qc\.automation[^"”\n]*/, to: 'Đề nghị rà soát lại điểm tự chấm' },  // còn sót: lý do từ chối mẫu
];
const SURVEY_NAME = 'Khảo sát mức độ hài lòng về dịch vụ công trực tuyến năm 2026';
const KS_RULES = [
  { from: '234', to: SURVEY_NAME, exact: true },
  { from: 'QA - Đơn vị Bộ', to: 'Văn phòng Bộ' },
];
const KQ_RULES = [
  { from: 'qc.automation E FX SRS60', to: 'Khảo sát mức độ hài lòng về dịch vụ công trực tuyến Quý IV/2026' },
  { from: 'aaaaaa', to: 'Văn phòng Bộ', exact: true },
  { from: /\baaaaaa\b/, to: 'Văn phòng Bộ' },
  { from: 'Nhóm 1', to: 'Dịch vụ công trực tuyến', exact: true },
  { from: 'Câu 1', to: 'Thông tin về thủ tục hành chính được công khai đầy đủ, dễ tìm', exact: true },
  { from: 'Câu 2', to: 'Thao tác nộp hồ sơ trực tuyến đơn giản, dễ thực hiện', exact: true },
  { from: 'Câu 3', to: 'Hồ sơ được giải quyết đúng thời hạn', exact: true },
];
// Ẩn dòng dữ liệu rác (chuỗi thử XSS, ký tự vô nghĩa) trên danh sách
const JUNK = ['<script', '!!', '@@@', 'aaaaaa', 'testabc', 'H? th?ng', 'test data', '11111111111', 'TEST', 'test ', 'cds\n', 'Nhật ký hệ thống', 'manh test'];
const hideJunk = (page) => page.evaluate((junk) => document.querySelectorAll('tbody tr').forEach(tr => {
  if (junk.some(j => tr.innerText.includes(j))) tr.style.display = 'none';
}), JUNK);
// Cuộn để thanh tab nằm đầu vùng nhìn (chụp nội dung tab)
const tabsTop = async (page) => { await page.locator('.ant-tabs-nav').first().evaluate(e => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -170); document.querySelectorAll('*').forEach(x => { if (x.scrollHeight > x.clientHeight + 50 && getComputedStyle(x).overflowY === 'auto') x.scrollTop -= 170; }); }); await page.waitForTimeout(400); };
const main = (page) => page.locator('main, .ant-layout-content').first();

const { page } = await openRole('ldd', { width: 1600, height: 1000 });
const D = 'ldd/';

// ===== 1. Kết quả tự đánh giá: danh sách (Đột xuất → tab Chờ duyệt) =====
await go(page, 'assessment-results', 2500);
await page.getByText('Đột xuất', { exact: true }).first().click(); await page.waitForTimeout(1800);
await page.locator('.ant-tabs-tab').filter({ hasText: 'Chờ duyệt' }).first().click(); await page.waitForTimeout(2000);
await demoText(page, RES_RULES);
const firstRow = page.locator('tbody tr:visible').filter({ hasText: 'Chờ duyệt' }).first();
await shot(page, D + 'kq-danh-sach', {
  marks: [
    { el: menu(page, 'Kết quả tự đánh giá'), label: 1 },
    { el: page.locator('.ant-segmented, [class*=segmented]').filter({ hasText: 'Đột xuất' }).first(), label: 2 },
    { el: page.locator('.ant-tabs-tab').filter({ hasText: 'Chờ duyệt' }).first(), label: 3 },
    { el: page.locator('input[placeholder*="Tìm kiếm"]').first().locator('xpath=ancestor::div[contains(@class,"ant-row") or contains(@class,"flex")][1]'), label: 4 },
    { el: firstRow.getByText('Xem chi tiết').first(), label: 5 },
  ],
});

// ===== 2. Chi tiết kết quả chờ duyệt =====
await firstRow.getByText('Xem chi tiết').first().click(); await page.waitForTimeout(3000);
const pendingUrl = page.url();
await demoText(page, RES_RULES);
await shot(page, D + 'kq-chi-tiet', {
  clip: main(page),
  marks: [
    { el: page.locator('[class*=alert], .ant-alert').filter({ hasText: 'Đang chờ' }).first(), label: 3, pad: 2 },
    { el: page.getByText('Thông tin chung', { exact: true }).locator('xpath=ancestor::div[.//*[contains(text(),"Thời gian thực hiện")]][1]'), label: 4, pad: 2 },
    { el: page.locator('.ant-tabs-nav').first(), label: 5, pad: 2 },
    { el: page.getByRole('button', { name: /Phê duyệt/ }).first(), label: 'Phê duyệt' },
    { el: page.getByRole('button', { name: /Từ chối/ }).first(), label: 'Từ chối', align: 'left' },
  ],
});
// Tab Lịch sử
await page.locator('.ant-tabs-tab').filter({ hasText: 'Lịch sử' }).first().click(); await page.waitForTimeout(1500);
await demoText(page, RES_RULES); await tabsTop(page);
{ const b = await main(page).boundingBox(); await shot(page, D + 'kq-lich-su', { clip: { x: b.x, y: 0, width: b.width, height: 900 } }); }
await page.locator('.ant-tabs-tab').filter({ hasText: 'Chấm điểm' }).first().click(); await page.waitForTimeout(1200);
await demoText(page, RES_RULES); await tabsTop(page);
await shot(page, D + 'kq-cham-diem', { clip: main(page) });

// ===== 3. Phê duyệt (chỉ mở hộp thoại rồi Huỷ) =====
await page.getByRole('button', { name: /Phê duyệt/ }).first().click(); await page.waitForTimeout(1200);
let d = dialog(page); await demoText(page, RES_RULES);
await shot(page, D + 'kq-phe-duyet', { clip: d, marks: [{ el: d.getByRole('button', { name: 'Xác nhận phê duyệt' }), label: 2 }] });
await d.getByRole('button', { name: /Hu[ỷủ]/ }).click(); await page.waitForTimeout(700);

// ===== 4. Từ chối (điền lý do mẫu, chụp, Huỷ) =====
await page.getByRole('button', { name: /Từ chối/ }).first().click(); await page.waitForTimeout(1200);
d = dialog(page);
await d.locator('textarea').first().fill('Chỉ số NT.01 chưa có minh chứng. Đề nghị bổ sung văn bản, danh sách cán bộ đã tham gia tập huấn rồi trình lại.');
await demoText(page, RES_RULES);
await shot(page, D + 'kq-tu-choi', { clip: d, marks: [{ el: d.locator('textarea').first(), label: 2 }, { el: d.getByRole('button', { name: 'Xác nhận từ chối' }), label: 3 }] });
await d.locator('textarea').first().fill('');
await d.getByRole('button', { name: /Hu[ỷủ]/ }).click(); await page.waitForTimeout(700);

// ===== 5. Kết quả đã gửi Bộ: tab Hồ sơ gửi Bộ (chỉ xem) =====
{
  const list = await get('dti/assessment-results?page=1&size=200', 'ldd');
  const sent = (list?.content ?? []).find(x => x.status === 'Submitted' && x.organizationName === 'QA - Đơn vị Bộ');
  if (sent) {
    await go(page, `assessment-results/${sent.id}`, 3000);
    await demoText(page, RES_RULES);
    const mb2 = await main(page).boundingBox(), tb = await page.locator('.ant-tabs-nav').first().boundingBox();
    await shot(page, D + 'kq-da-gui', { clip: { x: mb2.x, y: mb2.y, width: mb2.width, height: tb.y + tb.height + 16 - mb2.y }, marks: [{ el: page.locator('.ant-tabs-tab').filter({ hasText: 'Hồ sơ gửi Bộ' }).first(), label: 1 }] });
    await page.locator('.ant-tabs-tab').filter({ hasText: 'Hồ sơ gửi Bộ' }).first().click(); await page.waitForTimeout(2500);
    await demoText(page, RES_RULES);
    console.log('   [Hồ sơ gửi Bộ]', (await main(page).innerText()).split('Hồ sơ gửi Bộ').pop().replace(/\s+/g, ' ').slice(0, 600));
    await tabsTop(page);
    await shot(page, D + 'kq-ho-so-gui-bo', { clip: main(page) });
  } else console.warn('  ! không có kết quả Đã gửi của QA - Đơn vị Bộ');
}

// ===== 6. Đợt khảo sát: danh sách, chi tiết, phê duyệt/từ chối =====
await go(page, 'survey-campaigns', 2500);
await demoText(page, KS_RULES);
await shot(page, D + 'ks-danh-sach', {
  marks: [
    { el: menu(page, 'Đợt khảo sát'), label: 1 },
    { el: page.locator('.ant-tabs-nav').first(), label: 2, pad: 2 },
    { el: page.getByRole('button', { name: /Xuất Excel/ }).first(), label: 3 },
    { el: page.locator('tbody tr.ant-table-row').first(), label: 4, pad: 2 },
  ],
});
await page.locator('.ant-tabs-tab').filter({ hasText: 'Chờ phê duyệt' }).first().click(); await page.waitForTimeout(1500);
const ksRow = page.locator('tbody tr').filter({ hasText: 'Chờ phê duyệt' }).first();
if (await ksRow.count()) {
  await demoText(page, KS_RULES);
  await shot(page, D + 'ks-cho-phe-duyet', { clip: main(page), marks: [{ el: page.locator('.ant-tabs-tab').filter({ hasText: 'Chờ phê duyệt' }).first(), label: 1 }, { el: ksRow.locator('td').nth(2), label: 2 }] });
  await ksRow.locator('td').nth(2).click(); await page.waitForTimeout(2500);
  if (!/survey-campaigns\/[0-9a-f-]{36}/.test(page.url())) { await ksRow.locator('button, a').last().click(); await page.waitForTimeout(2500); }
  await demoText(page, KS_RULES);
  await page.evaluate(([name, q]) => { // câu hỏi "234" (đã đổi thành tên đợt) → câu hỏi minh họa
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const ns = [];
    while (w.nextNode()) ns.push(w.currentNode);
    const head = ns.find(n => n.nodeValue.trim() === 'Nội dung khảo sát');
    if (!head) return;
    const top = head.parentElement.getBoundingClientRect().top;
    ns.filter(n => n.nodeValue.trim() === name && n.parentElement.getBoundingClientRect().top > top).forEach(n => { n.nodeValue = q; });
  }, [SURVEY_NAME, 'Ông/Bà có hài lòng với kết quả xử lý phản ánh, kiến nghị không?']);
  await page.evaluate(() => { // Mô tả
    const lab = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Mô tả');
    const v = lab?.nextElementSibling ?? lab?.parentElement?.nextElementSibling;
    if (v && v.children.length === 0) v.textContent = 'Lấy ý kiến người dân về chất lượng xử lý phản ánh, kiến nghị và dịch vụ công trực tuyến của đơn vị.';
  });
  await shot(page, D + 'ks-chi-tiet', {
    clip: main(page),
    marks: [{ el: page.getByRole('button', { name: /Phê duyệt/ }).first(), label: 3 }, { el: page.getByRole('button', { name: /Từ chối/ }).first(), label: 'Từ chối', align: 'left' }],
  });
  // Phê duyệt → Không
  await page.getByRole('button', { name: /Phê duyệt/ }).first().click(); await page.waitForTimeout(1000);
  d = dialog(page); await demoText(page, KS_RULES);
  await shot(page, D + 'ks-phe-duyet', { clip: d, marks: [{ el: d.getByRole('button', { name: 'Có', exact: true }), label: 4 }] });
  await d.getByRole('button', { name: 'Không', exact: true }).click(); await page.waitForTimeout(700);
  // Từ chối → điền lý do mẫu → Không
  await page.getByRole('button', { name: /Từ chối/ }).first().click(); await page.waitForTimeout(1000);
  d = dialog(page);
  await d.locator('textarea').first().fill('Bộ câu hỏi chưa có nhóm về dịch vụ công trực tuyến; đề nghị bổ sung và điều chỉnh số phiếu mục tiêu phù hợp.');
  await demoText(page, KS_RULES);
  await shot(page, D + 'ks-tu-choi', { clip: d, marks: [{ el: d.locator('textarea').first(), label: 2 }, { el: d.getByRole('button', { name: 'Có', exact: true }), label: 3 }] });
  await d.locator('textarea').first().fill('');
  await d.getByRole('button', { name: 'Không', exact: true }).click(); await page.waitForTimeout(700);
} else console.warn('  ! LĐĐV không có đợt khảo sát Chờ phê duyệt');

// ===== 7. Báo cáo thống kê =====
await go(page, 'dashboard-demo', 3000);
await shot(page, D + 'bc-dashboard', { marks: [{ el: menu(page, 'Dashboard đơn vị'), label: 1 }, { el: page.locator('main').getByText('Xem theo').locator('xpath=ancestor::div[3]').first(), label: 2 }, { el: page.getByRole('button', { name: /Xuất Excel/ }).first(), label: 3 }] });
await go(page, 'reports/ranking', 3000);
await hideJunk(page); await demoText(page, RES_RULES);
const mb = await main(page).boundingBox();
await shot(page, D + 'bc-xep-hang', { clip: { x: mb.x, y: mb.y, width: mb.width, height: 640 }, marks: [{ el: main(page).locator('.ant-select').first(), label: 2 }, { el: page.getByText('Xem dữ liệu cột').first(), label: 3 }] });
await go(page, 'reports/compare', 3000);
await shot(page, D + 'bc-so-sanh', { clip: { x: mb.x, y: mb.y, width: mb.width, height: 560 }, marks: [{ el: page.getByText('Xem theo').first().locator('xpath=ancestor::div[.//*[contains(text(),"Chỉ tiêu so sánh")]][1]'), label: 2 }, { el: page.getByRole('button', { name: /Thêm đơn vị/ }).first(), label: 3 }, { el: page.getByText('So sánh qua các kỳ').first(), label: 4 }] });

// ===== 8. Kết quả khảo sát (tài khoản superadmin, cắt vùng nội dung) =====
{
  const r = await get(`survey/surveys?page=1&size=50&filter=${encodeURIComponent(JSON.stringify({ keyword: 'FX SRS60' }))}`);
  const s = (r?.content ?? []).find(x => x.name === 'qc.automation E FX SRS60');
  if (s) {
    const sp = (await openRole('superadmin', { width: 1440, height: 2200 })).page;
    await go(sp, `survey-campaigns/${s.id}?tab=kq`, 3500);
    await demoText(sp, KQ_RULES);
    const pane = sp.locator('.ant-tabs-tabpane-active').first();
    await shot(sp, D + 'ks-ket-qua', {
      clip: { x: 260, y: 64, width: 1180, height: 1050 },
      marks: [{ el: sp.locator('.ant-segmented, [class*=segmented]').filter({ hasText: 'Kết quả' }).first(), label: 2 },
              { el: sp.getByRole('button', { name: /Xuất Excel/ }).first(), label: 4 }],
    });
    await sp.close();
  } else console.warn('  ! không thấy đợt qc.automation E FX SRS60');
}
await closeAll();
