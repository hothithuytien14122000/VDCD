// Chụp ảnh phần dùng chung: trang công khai, đăng nhập, quên mật khẩu (ảnh chung)
// + bố cục giao diện, thông báo, thông tin cá nhân, đổi mật khẩu, đăng xuất (ảnh theo từng vai trò).
// Dùng: node hdsd/tools/capture-chung.mjs [anon] [admin lanhdaobo canbo ldd]
// Không ghi dữ liệu: các hộp thoại chỉ mở ra để chụp rồi đóng lại (Huỷ/Không).
import fs from 'node:fs';
import { demoText } from './demo-text.mjs';
import { BASE, openRole, go, shot, closeAll, dialog, wrap } from './shot.mjs';

const args = process.argv.slice(2);
const roles = args.filter(a => a !== 'anon');
// Trang mở đầu của từng vai trò (trang được phép truy cập)
const HOME = { admin: 'users', lanhdaobo: 'assessment-results', canbo: 'assessment-results', ldd: 'assessment-results' };
// Dữ liệu kiểm thử trên môi trường test → tên minh họa (chỉ đổi chữ trong trình duyệt)
const DEMO = [
  { from: /Lý do: qc\.automation[^\n]*/, to: 'Lý do: Đề nghị bổ sung minh chứng cho các chỉ số còn thiếu.' },
  { from: /qc\.automation[A-Za-z0-9 ]*?(?: phía Bộ)?(?= bị | đã |\. |\.$|,|$)/, list: ['Tự đánh giá CĐS Quý III/2026', 'Tự đánh giá CĐS đột xuất tháng 10/2026', 'Rà soát kết quả CĐS năm 2026'] },
  { from: /Đánh giá tháng 12\/2027/, to: 'Tự đánh giá CĐS tháng 10/2026' },
  { from: 'aaaaaa', to: 'Sở Dân tộc và Tôn giáo tỉnh Lào Cai', exact: true },
  { from: /a{6,}/, to: 'Tự đánh giá CĐS Quý IV/2026' },
  { from: /QA - Đơn vị Bộ/, to: 'Văn phòng Bộ' }, { from: /QA - Địa phương/, to: 'Ban Dân tộc tỉnh Hà Giang' },
];
// Ẩn dòng bảng chứa dữ liệu rác / tài khoản cá nhân rồi đánh lại STT
const JUNK = ['<script', '!!', '@@@', 'aaaaaa', 'testabc', 'hothithuytien', 'tien.ho', 'H? th?ng', 'test data'];
async function hideJunk(page) {
  await page.evaluate((junk) => {
    let n = 0;
    document.querySelectorAll('tbody tr').forEach(tr => {
      if (junk.some(j => tr.innerText.includes(j))) { tr.style.display = 'none'; return; }
      const c = tr.querySelector('td'); if (c && /^\d+$/.test(c.innerText.trim())) c.innerText = String(++n);
    });
  }, JUNK);
}
const NAME = { admin: 'QC Quản trị hệ thống', lanhdaobo: 'QC Lãnh đạo Bộ', canbo: 'QC Cán bộ', ldd: 'QC Lãnh đạo đơn vị' };

if (args.includes('anon')) {
  const { page } = await openRole('anon');
  // Trang công khai
  await go(page, '', 2500);
  await shot(page, 'chung/trang-cong-khai', {
    marks: [{ el: page.getByRole('link', { name: /^Đăng nhập$/ }).first(), label: 2 },
            { el: page.getByRole('link', { name: /Đăng nhập hệ thống/ }).first(), label: 'HOẶC' }],
  });
  // Logo (trang bìa tài liệu)
  fs.mkdirSync('hdsd/out/img/chung', { recursive: true });
  { // logo SVG → PNG 520px nền trong suốt
    const lp = await page.context().newPage();
    await lp.setViewportSize({ width: 520, height: 530 });
    await lp.setContent(`<body style="margin:0;background:transparent"><img src="${BASE}/images/logo_quochuy.svg" style="width:519px;height:529px"></body>`);
    await lp.waitForTimeout(800);
    await lp.locator('img').screenshot({ path: 'hdsd/out/img/chung/logo.png', omitBackground: true });
    await lp.close();
  }
  // Đăng nhập
  await go(page, 'auth/login', 2000);
  const card = page.locator('form').first();
  await page.getByPlaceholder('Nhập tên đăng nhập').fill('nguyenvana');
  await page.getByPlaceholder('Nhập mật khẩu').fill('MatKhau@123');
  await page.getByPlaceholder('Nhập mã bên cạnh').fill('uneh');
  await shot(page, 'chung/dang-nhap', {
    marks: [
      { el: page.getByPlaceholder('Nhập tên đăng nhập'), label: 1 },
      { el: wrap(page.getByPlaceholder('Nhập mật khẩu')), label: 2 },
      { el: page.locator('.ant-form-item').filter({ hasText: 'Mã xác nhận' }).first(), label: 3 },
      { el: page.getByRole('button', { name: /^đăng nhập$/i }), label: 4 },
    ],
  });
  await page.getByPlaceholder('Nhập tên đăng nhập').fill('');
  await page.getByPlaceholder('Nhập mật khẩu').fill('');
  await page.getByPlaceholder('Nhập mã bên cạnh').fill('');
  await page.getByRole('button', { name: /^đăng nhập$/i }).click(); await page.waitForTimeout(700);
  await shot(page, 'chung/dang-nhap-loi-bat-buoc', { clip: card });
  // Quên mật khẩu (chỉ mở màn hình, không gửi OTP)
  await go(page, 'auth/login', 1500);
  await shot(page, 'chung/quen-mat-khau-link', { clip: card, marks: [{ el: page.getByText(/quên mật khẩu/i).first(), label: 1 }] });
  await page.getByText(/quên mật khẩu/i).first().click(); await page.waitForTimeout(1200);
  await page.getByPlaceholder('Nhập email đăng ký').fill('nguyenvana@donvi.gov.vn');
  const card2 = page.locator('form').first();
  await shot(page, 'chung/quen-mat-khau-email', {
    clip: card2,
    marks: [{ el: page.getByPlaceholder('Nhập email đăng ký'), label: 2 }, { el: page.getByRole('button', { name: /lấy mã otp/i }), label: 3 }],
  });
  // Màn OTP + mật khẩu mới: dùng tài khoản test qc.resetpw (hộp thư Mailosaur), KHÔNG bấm đặt lại mật khẩu
  const { latestMailId, waitOtp, resetEmail } = await import('./mail.mjs');
  const email = resetEmail();
  const prev = await latestMailId(email);
  await page.getByPlaceholder('Nhập email đăng ký').fill(email);
  await page.getByRole('button', { name: /lấy mã otp/i }).click(); await page.waitForTimeout(2500);
  const otp = await waitOtp(email, prev);
  const card3 = { x: 900, y: 50, width: 500, height: 800 };  // nửa phải màn hình (khung OTP)
  await page.locator('input').first().click(); await page.keyboard.type(otp.slice(0, 6)); await page.waitForTimeout(400);
  await shot(page, 'chung/quen-mat-khau-otp', {
    clip: card3,
    marks: [{ el: page.locator('input').first().locator('xpath=ancestor::div[count(.//input)>=6][1]'), label: 4 }, { el: page.getByRole('button', { name: 'Xác nhận' }), label: 5 }],
  });
  await page.getByRole('button', { name: /xác (nhận|thực)|tiếp tục/i }).first().click(); await page.waitForTimeout(2000);
  await page.getByPlaceholder('Nhập mật khẩu mới').fill('MatKhauMoi@2026');
  await page.getByPlaceholder('Nhập lại mật khẩu mới').fill('MatKhauMoi@2026'); await page.waitForTimeout(400);
  await shot(page, 'chung/quen-mat-khau-mat-khau-moi', {
    clip: card3,
    marks: [{ el: wrap(page.getByPlaceholder('Nhập mật khẩu mới')), label: 6 }, { el: wrap(page.getByPlaceholder('Nhập lại mật khẩu mới')), label: 7 },
            { el: page.getByRole('button', { name: /cập nhật mật khẩu/i }), label: 8 }],
  });
  await page.close();
}

for (const key of roles) {
  const { page } = await openRole(key);
  const dir = `${key}/chung`;
  await go(page, HOME[key], 2500);
  const side = page.getByRole('complementary');
  await hideJunk(page); await demoText(page, DEMO);
  // Bố cục giao diện
  await shot(page, `${dir}-bo-cuc`, {
    marks: [
      { el: side.locator('.ant-menu').first(), label: '(1) Menu chức năng', pos: 'inside', pad: -3 },
      { el: page.locator('header, .ant-layout-header').first(), label: '(2) Thanh tiêu đề', pad: -3, pos: 'inside', align: 'left' },
      { el: page.locator('main, .ant-layout-content').first(), label: '(3) Khu vực làm việc', pad: -6, pos: 'inside' },
      { el: side.getByText(NAME[key], { exact: true }).locator('xpath=ancestor::*[self::div][2]'), label: '(4) Tài khoản', pad: -3, pos: 'inside' },
    ],
  });
  // Thông báo
  const bell = page.locator('.ant-badge').last();
  await bell.click().catch(() => {}); await page.waitForTimeout(1500);
  await page.locator('.notification-bell-popover button.group').first().waitFor({ timeout: 8000 }).catch(() => {});
  await demoText(page, DEMO);
  // ẩn thông báo còn sót tên dữ liệu kiểm thử (aaaa…, qc.automation, QCA…) để ảnh tài liệu sạch
  await page.evaluate(() => document.querySelectorAll('.notification-bell-popover button.group').forEach(el => {
    if (/a{5,}|qc\.automation|QCA|testabc|<script|xss/i.test(el.textContent || '')) el.style.display = 'none';
  }));
  await shot(page, `${dir}-thong-bao`, { clip: { x: 900, y: 0, width: 540, height: 620 }, marks: [{ el: bell, label: 1 }] });
  await page.keyboard.press('Escape'); await page.mouse.click(700, 500).catch(() => {}); await page.waitForTimeout(500);
  await go(page, HOME[key], 2000); await hideJunk(page); await demoText(page, DEMO);
  // Menu tài khoản
  await side.getByText(NAME[key], { exact: true }).click(); await page.waitForTimeout(700);
  const corner = { x: 0, y: 480, width: 760, height: 420 };  // góc dưới-trái: menu tài khoản
  await shot(page, `${dir}-menu-tai-khoan`, { clip: corner, keepMouse: true,
    marks: [{ el: side.getByText(NAME[key], { exact: true }), label: 1 },
            { el: page.getByRole('menu').last().getByText('Thông tin cá nhân', { exact: true }), label: 2 }],
  });
  // Thông tin cá nhân
  await go(page, 'profile', 2000);
  await shot(page, `${dir}-thong-tin-ca-nhan`, { clip: page.locator('main, .ant-layout-content').first(),
    marks: [{ el: page.getByText('Thông tin cơ bản', { exact: true }).locator('xpath=ancestor::div[3]'), label: 3 },
            { el: page.getByRole('button', { name: /lưu thay đổi/i }), label: 4 }],
  });
  await shot(page, `${dir}-thong-tin-ca-nhan-full`, { full: true });
  // Đổi mật khẩu
  await shot(page, `${dir}-doi-mat-khau-nut`, { clip: page.getByRole('button', { name: 'Đổi mật khẩu' }).locator('xpath=ancestor::div[.//*[contains(text(),"định kỳ")]][1]'), marks: [{ el: page.getByRole('button', { name: 'Đổi mật khẩu' }), label: 1 }] });
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click(); await page.waitForTimeout(900);
  const d = dialog(page);
  const pws = d.locator('input[type=password]');
  await pws.nth(0).fill('MatKhauCu@123'); await pws.nth(1).fill('MatKhauMoi@2026'); await pws.nth(2).fill('MatKhauMoi@2026');
  await page.waitForTimeout(400);
  await shot(page, `${dir}-doi-mat-khau-form`, {
    clip: d,
    marks: [{ el: wrap(pws.nth(0)), label: 2 }, { el: wrap(pws.nth(1)), label: 3 }, { el: wrap(pws.nth(2)), label: 4 },
            { el: d.getByRole('button', { name: /đổi mật khẩu|cập nhật|lưu/i }).last(), label: 5 }],
  });
  await d.getByRole('button', { name: /hu[ỷủ]/i }).first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(600);
  // Đăng xuất (bấm Không để giữ phiên)
  await side.getByText(NAME[key], { exact: true }).click(); await page.waitForTimeout(600);
  await shot(page, `${dir}-dang-xuat-menu`, { clip: corner, keepMouse: true, marks: [{ el: page.getByRole('menu').last().getByText('Đăng xuất', { exact: true }), label: 1 }] });
  await side.getByText(NAME[key], { exact: true }).click(); await page.waitForTimeout(600);
  await page.getByRole('menu').last().getByText('Đăng xuất', { exact: true }).click(); await page.waitForTimeout(700);
  await shot(page, `${dir}-dang-xuat-xac-nhan`, { clip: dialog(page), marks: [{ el: page.getByRole('button', { name: 'Có', exact: true }), label: 2 }] });
  await page.getByRole('button', { name: 'Không', exact: true }).click();
  await page.close();
}
await closeAll();
