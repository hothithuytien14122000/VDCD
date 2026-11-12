// Chụp ảnh tài liệu HDSD – Người dân (không đăng nhập). Ảnh: hdsd/out/img/nguoidan/*.png
// Dùng: node hdsd/tools/capture-nguoi-dan.mjs
// KHÔNG ghi phiếu thật: khi bấm "Gửi đánh giá", API gửi phiếu được giả lập (page.route trả 200) nên không tạo dữ liệu.
// Dữ liệu trên môi trường test là dữ liệu kiểm thử → đổi chữ hiển thị sang dữ liệu minh họa (demoText, chỉ trong DOM).
import fs from 'node:fs';
import { openRole, go, shot, closeAll } from './shot.mjs';
import { demoText } from './demo-text.mjs';

const API = 'https://cds.geneat.pro/api/v1';
const tokenOf = (k) => JSON.parse(fs.readFileSync(`auth/${k}.json`, 'utf8')).origins[0].localStorage.map(x => x.value).find(v => v.split('.').length === 3);
const get = async (path) => (await (await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${tokenOf('superadmin')}` } })).json()).data;

const NAMES = [
  'Khảo sát mức độ hài lòng về dịch vụ công trực tuyến năm 2026',
  'Khảo sát sự hài lòng về giải quyết phản ánh, kiến nghị Quý IV/2026',
  'Đánh giá chất lượng phục vụ của Bộ phận một cửa',
  'Khảo sát hiệu quả chính sách hỗ trợ đồng bào dân tộc thiểu số',
  'Lấy ý kiến người dân về hoạt động chuyển đổi số năm 2026',
];
const UNITS = ['Văn phòng Bộ', 'Sở Dân tộc và Tôn giáo tỉnh Lào Cai', 'Ban Dân tộc tỉnh Hà Giang', 'Vụ Chính sách dân tộc', 'Ban Dân tộc tỉnh Sơn La'];
const RULES = [
  { from: 'qc.automation E FX ACTIVE', to: NAMES[0] },
  { from: /qc\.automation E [\w ]+/, list: NAMES },
  { from: 'aaaaaa', list: UNITS, exact: true },
  { from: /\baaaaaa\b/, to: UNITS[0] },
  { from: 'Nhóm A', to: 'Kết quả xử lý phản ánh, kiến nghị', exact: true },
  { from: 'Nhóm B', to: 'Dịch vụ công trực tuyến', exact: true },
  { from: 'Câu A1', to: 'Cán bộ tiếp nhận phản ánh, kiến nghị có thái độ lịch sự, tận tình', exact: true },
  { from: 'Câu A2', to: 'Phản ánh, kiến nghị được giải quyết đúng thời hạn', exact: true },
  { from: 'Câu B1', to: 'Thao tác nộp hồ sơ trực tuyến đơn giản, dễ thực hiện', exact: true },
];
const D = 'nguoidan/';
const LIST = 'survey-campaigns/respond';
const OK = '{"data":{"id":"mock"},"code":200,"isSuccess":true}';
const choice = (page, i, v = 'Hài lòng') => page.getByRole('button', { name: new RegExp(`^${v}$`) }).nth(i);

// Đợt mẫu có 2 nhóm, 3 câu (fixture của bộ test E)
const fx = ((await get(`survey/surveys?page=1&size=50&filter=${encodeURIComponent(JSON.stringify({ keyword: 'FX ACTIVE' }))}`))?.content ?? [])
  .find(x => x.name === 'qc.automation E FX ACTIVE');
if (!fx) throw new Error('Không thấy đợt qc.automation E FX ACTIVE');
const FORM = `${LIST}/${fx.id}`;

async function run(size, sfx) {
  const { page } = await openRole('anon', size);
  const mobile = size.width < 500;
  // Máy tính: cắt bỏ khoảng trống hai bên, chỉ giữ cột nội dung (rộng ~1260px, giữa màn hình)
  const col = (h) => (mobile ? {} : { clip: { x: 230, y: 0, width: 980, height: h } });
  await page.route('**/api/v1/public/surveys/*/responses', r => r.fulfill({ status: 200, contentType: 'application/json', body: OK }));
  // 1. Danh sách khảo sát đang mở
  await go(page, LIST, 3000); await demoText(page, RULES);
  const join = page.getByRole('button', { name: /Tham gia khảo sát/ }).first();
  const card = join.locator('xpath=ancestor::div[contains(., "Hạn đến")][1]');   // thẻ khảo sát chứa nút
  await shot(page, D + 'danh-sach' + sfx, {
    ...col(900),
    marks: [{ el: card, label: 1 }, { el: page.getByRole('button', { name: /Tham gia khảo sát/ }).first(), label: 2 }],
  });
  // 2. Phiếu khảo sát (chưa trả lời)
  await go(page, FORM, 3000); await demoText(page, RULES);
  await shot(page, D + 'phieu' + sfx, mobile ? {} : { full: true, ...col(await page.evaluate(() => document.documentElement.scrollHeight)) });
  // 3. Bấm Gửi khi chưa trả lời đủ → báo lỗi
  const submit = page.getByRole('button', { name: /Gửi đánh giá/ }).first();
  if (!mobile) {
    await submit.click(); await page.waitForTimeout(1000); await demoText(page, RULES);
    await shot(page, D + 'phieu-loi' + sfx, col(760));
    await go(page, FORM, 3000);
  }
  // 4. Trả lời các câu + góp ý
  await choice(page, 0).click(); await choice(page, 1).click(); await choice(page, 2, 'Chưa hài lòng').click();
  await page.locator('textarea').first().fill('Đề nghị bổ sung hướng dẫn nộp hồ sơ trực tuyến bằng tiếng dân tộc.');
  await page.waitForTimeout(500); await demoText(page, RULES);
  await shot(page, D + 'phieu-tra-loi' + sfx, {
    ...col(620),
    marks: [
      { el: choice(page, 0).locator('xpath=..'), label: 1 },
      { el: page.locator('textarea').first(), label: 2 },
      { el: submit, label: 3, pos: mobile ? 'top' : 'bottom', align: mobile ? 'left' : 'right' },
    ],
  });
  // 5. Gửi (API được giả lập) → màn cảm ơn
  await submit.click(); await page.waitForTimeout(1500);
  await page.getByText(/Cảm ơn/).first().waitFor({ timeout: 8000 }).catch(() => console.warn('  ! không thấy màn Cảm ơn'));
  await demoText(page, RULES);
  await shot(page, D + 'cam-on' + sfx, col(560));
  // 6. Đường link không hợp lệ
  if (!mobile) {
    await go(page, `${LIST}/00000000-0000-4000-8000-000000000000`, 2500);
    await shot(page, D + 'khong-ton-tai' + sfx, col(500));
  }
  await page.close();
}
await run({ width: 1440, height: 900 }, '');
await run({ width: 390, height: 844 }, '-dt');
await closeAll();
