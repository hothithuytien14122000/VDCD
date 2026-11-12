// Chụp ảnh HDSD vai trò Quản trị hệ thống – PHẦN B (Bộ chỉ số DTI + Quản lý tự đánh giá).
// Dùng: node hdsd/tools/capture-admin-b.mjs [pil grp ind set scl cmp]   (không truyền = chụp tất cả)
// Ảnh: hdsd/out/img/admin/b-*.png
// An toàn dữ liệu: dữ liệu minh họa (mã QCA…, tên thang/kỳ bắt đầu "QCA") tạo qua admin-b-data.mjs lúc bắt đầu
// và xóa hết trong finally (KEEP=1 để giữ lại khi đang chỉnh script). Dữ liệu có sẵn chỉ mở xem / mở hộp thoại rồi Huỷ/Không.
import fs from 'node:fs';
import { openRole, go, shot as rawShot, closeAll, dialog, wrap } from './shot.mjs';
import { setup, cleanup, api } from './admin-b-data.mjs';

const want = process.argv.slice(2);
const on = (k) => !want.length || want.includes(k);
const F = (n) => `admin/b-${n}`;
const STATE = 'hdsd/out/.admin-b-data.json';
let SFX = '';
// Bỏ tiền tố "QCA " và hậu tố mã chạy " <sfx>" khỏi tên hiển thị của dữ liệu minh họa (chỉ trên giao diện, trước khi chụp)
async function pretty(page) {
  if (!SFX) return;
  await page.evaluate((sfx) => {
    const re = new RegExp('(^|\\s)QCA |\\s' + sfx + '\\b', 'g');
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) if (re.test(n.nodeValue)) { re.lastIndex = 0; n.nodeValue = n.nodeValue.replace(re, (m, a) => (a ?? '')); }
    document.querySelectorAll('input, textarea').forEach(el => { if (el.value && new RegExp('QCA |\\s' + sfx + '\\b').test(el.value)) el.value = el.value.replace(/(^|\s)QCA /g, '$1').replace(new RegExp('\\s' + sfx + '\\b', 'g'), ''); });
  }, SFX);
}
const shot = async (page, file, opts) => { await pretty(page); return rawShot(page, file, opts); };

// ---------- helper giao diện ----------
const main = (page) => page.locator('main, .ant-layout-content').first();
const dataRows = (page) => page.locator('tbody tr.ant-table-row');
const btn = (scope, re) => scope.getByRole('button').filter({ hasText: re });
const formItem = (scope, label) => scope.locator('.ant-form-item').filter({ hasText: label }).first();
const ddMenu = (page) => page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu').last();
const menuItem = (page, re) => page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item').filter({ hasText: re }).first();
const openSelect = (page) => page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
// Chỉ giữ các dòng/nút cây của dữ liệu minh họa (ẩn dữ liệu thử nghiệm khác của môi trường test)
async function keepOnly(page, keys, sel = 'tbody tr.ant-table-row') {
  await page.evaluate(([keys, sel]) => {
    document.querySelectorAll(sel).forEach(tr => {
      if (tr.dataset.keep || keys.some(k => tr.innerText.includes(k))) { tr.dataset.keep = '1'; tr.style.display = ''; } else tr.style.display = 'none';
    });
  }, [keys, sel]);
}
const JUNK = ['<script', '!!', '@@@', 'aaaa', 'testabc', 'H? th?ng', 'test data', 'XSS', 'qc.automation', 'TEST MỚI', 'ĐƠN VỊ CON', 'adfsdf', 'efasdf'];
async function hideJunk(page, sel = 'tbody tr') {
  await page.evaluate(([junk, sel]) => {
    document.querySelectorAll(sel).forEach(tr => { if (junk.some(j => tr.innerText.includes(j)) || /^\s*\d+\s+(a|1|sd)\s/i.test(tr.innerText)) tr.style.display = 'none'; });
  }, [JUNK, sel]);
}
// Lọc danh sách theo hậu tố dữ liệu minh họa rồi xóa chữ trong ô tìm kiếm (chỉ trên giao diện) để ảnh trông tự nhiên
async function search(page, kw, ph = /tìm/i) {
  const box = page.getByPlaceholder(ph).first();
  await box.fill(kw); await page.waitForTimeout(1600);
  await box.evaluate(el => { el.style.color = 'transparent'; el.style.caretColor = 'transparent'; el.blur(); });
  await page.evaluate(() => document.querySelectorAll('.ant-input-clear-icon').forEach(x => x.style.visibility = 'hidden'));
}
const selectBox = (page, text) => page.locator('.ant-select').filter({ hasText: text }).first();
// Vùng chụp màn danh sách: từ tiêu đề trang tới hết bảng + phân trang
async function listClip(page) {
  const pg = page.locator('.ant-pagination').filter({ visible: true }).last();
  const tb = page.locator('.ant-table').filter({ visible: true }).last();
  const b = (await pg.count()) ? await pg.boundingBox() : await tb.boundingBox();
  const m = await main(page).boundingBox();
  const vp = page.viewportSize();
  return { x: m.x + 20, y: 70, width: vp.width - m.x - 20, height: Math.min(vp.height - 70, (b ? b.y + b.height : 700) + 30 - 70) };
}
// Vùng chụp danh sách + menu thao tác đang mở (menu có thể tràn xuống dưới bảng)
async function menuClip(page) {
  const c = await listClip(page);
  const mb = await ddMenu(page).boundingBox();
  if (mb) c.height = Math.max(c.height, mb.y + mb.height + 20 - c.y);
  return c;
}
// Dòng có ô mã đúng bằng code (tránh khớp nhầm bản sao có mã chứa code)
function rowByCode(page, code) {
  return dataRows(page).filter({ has: page.locator('td').filter({ hasText: new RegExp('^\\s*' + code + '\\s*$') }) }).first();
}
async function rowMenu(page, row) {
  await row.locator('button.ant-dropdown-trigger').first().click(); await page.waitForTimeout(700);
  return ddMenu(page);
}
async function closeDlg(page) {
  const d = dialog(page);
  const c = d.getByRole('button', { name: /^\s*(Huỷ|Hủy|Quay lại|Không|Đóng)\s*$/ });
  if (await c.count()) await c.last().click(); else await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
}
async function pick(page, scope, label, text) {
  await formItem(scope, label).locator('.ant-select').first().click(); await page.waitForTimeout(600);
  if (text) { await page.keyboard.type(text); await page.waitForTimeout(1200); }
  await openSelect(page).locator('.ant-select-item-option').filter({ hasText: text ?? /./ }).first().click(); await page.waitForTimeout(500);
}
const header = { x: 245, y: 60, width: 1195, height: 190 };   // vùng tiêu đề + nút của màn danh sách
const collapseMenu = async (page) => { await page.locator('header .anticon-menu-fold, header button').first().click().catch(() => {}); await page.waitForTimeout(700); };

// =====================================================================
const fresh = !fs.existsSync(STATE);
const D = fresh ? await setup() : JSON.parse(fs.readFileSync(STATE, 'utf8'));
const S = D.sfx; SFX = S;
const { page } = await openRole('admin', { width: 1440, height: 1000 });
try {
  // ------------------------------------------------------------ TRỤ CỘT
  if (on('pil')) {
    await go(page, 'pillars', 2000);
    await search(page, S); await keepOnly(page, [S]);
    await shot(page, F('pil-ds'), {
      clip: await listClip(page),
      marks: [{ el: page.getByPlaceholder(/tìm/i).first(), label: 2 }, { el: selectBox(page, 'Tất cả trạng thái'), label: 2 }],
    });
    await shot(page, F('pil-them-nut'), { clip: header, marks: [{ el: btn(page, /thêm mới trụ cột/i).first(), label: 1 }] });
    // Thêm mới
    await btn(page, /thêm mới trụ cột/i).first().click(); await page.waitForTimeout(800);
    let d = dialog(page);
    await btn(d, /^\s*Thêm mới Trụ cột\s*$/).last().click(); await page.waitForTimeout(600);
    await shot(page, F('pil-them-loi'), { clip: d });
    await d.getByPlaceholder(/mã trụ cột/i).fill('TC04');
    await d.getByPlaceholder(/tên trụ cột/i).fill('Chuyển đổi số trong hoạt động quản lý');
    await page.waitForTimeout(300);
    await shot(page, F('pil-them'), {
      clip: d,
      marks: [{ el: d.getByPlaceholder(/mã trụ cột/i), label: 2 }, { el: d.getByPlaceholder(/tên trụ cột/i), label: 2 }, { el: btn(d, /Thêm mới Trụ cột/).last(), label: 3 }],
    });
    await closeDlg(page);
    // Menu thao tác của trụ cột chưa khóa / đã khóa
    await search(page, S); await keepOnly(page, [S]);
    const rUn = dataRows(page).filter({ hasText: D.p3.code }).first();
    await rowMenu(page, rUn);
    await shot(page, F('pil-menu'), { keepMouse: true, clip: { x: 245, y: 230, width: 1195, height: 420 },
      marks: [{ el: rUn.locator('button.ant-dropdown-trigger').first(), label: 1 }, { el: ddMenu(page), label: '' }] });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    // Cập nhật
    await rowMenu(page, rUn); await menuItem(page, /Cập nhật/).click(); await page.waitForTimeout(900);
    d = dialog(page);
    await d.locator('input').nth(1).fill('Nhân lực số và kỹ năng số'); await page.waitForTimeout(300);
    await shot(page, F('pil-sua'), { clip: d, marks: [{ el: d.locator('input').nth(1), label: 3 }, { el: btn(d, /cập nhật|lưu/i).last(), label: 4 }] });
    await closeDlg(page);
    // Khóa
    await rowMenu(page, rUn); await menuItem(page, /^\s*Khoá|^\s*Khóa/).click(); await page.waitForTimeout(900);
    await shot(page, F('pil-khoa'), { clip: dialog(page), marks: [{ el: btn(dialog(page), /^\s*(Có|Khoá|Khóa|Xác nhận)\s*$/).last(), label: 2 }] });
    await closeDlg(page);
    // Xóa
    await rowMenu(page, rUn); await menuItem(page, /Xoá|Xóa/).click(); await page.waitForTimeout(900);
    await shot(page, F('pil-xoa'), { clip: dialog(page), marks: [{ el: btn(dialog(page), /^\s*(Có|Xoá|Xóa|Xác nhận)\s*$/).last(), label: 2 }] });
    await closeDlg(page);
    // Chi tiết trụ cột đã khóa
    await go(page, `pillars/${D.p1.id}`, 2000);
    await shot(page, F('pil-chi-tiet'), { clip: main(page) });
  }
  // ------------------------------------------------------------ NHÓM CHỈ SỐ
  if (on('grp')) {
    await go(page, 'indicator-groups', 2000);
    await search(page, S); await keepOnly(page, [S]);
    await shot(page, F('grp-ds'), {
      clip: await listClip(page),
      marks: [{ el: page.getByPlaceholder(/tìm/i).first(), label: 2 }, { el: selectBox(page, 'Tất cả trụ cột'), label: 2 }],
    });
    await shot(page, F('grp-them-nut'), { clip: header, marks: [{ el: btn(page, /thêm mới nhóm/i).first(), label: 1 }] });
    await btn(page, /thêm mới nhóm/i).first().click(); await page.waitForTimeout(800);
    let d = dialog(page);
    await pick(page, d, 'Trụ cột', 'Nhận thức số');
    await d.getByPlaceholder(/mã nhóm/i).fill('N13');
    await d.getByPlaceholder(/tên nhóm/i).fill('Ứng dụng công nghệ số trong chỉ đạo, điều hành');
    await shot(page, F('grp-them'), {
      clip: d,
      marks: [{ el: formItem(d, 'Trụ cột').locator('.ant-select').first(), label: 2 }, { el: d.getByPlaceholder(/mã nhóm/i), label: 3 },
              { el: d.getByPlaceholder(/tên nhóm/i), label: 3 }, { el: btn(d, /Thêm mới Nhóm chỉ số/).last(), label: 4 }],
    });
    // danh sách trụ cột để chọn (chỉ trụ cột đã khóa)
    await closeDlg(page);
    await search(page, S); await keepOnly(page, [S]);
    const rUn = dataRows(page).filter({ hasText: D.g3.code }).first();
    await rowMenu(page, rUn); await menuItem(page, /Cập nhật/).click(); await page.waitForTimeout(900);
    d = dialog(page);
    await shot(page, F('grp-sua'), { clip: d, marks: [{ el: btn(d, /cập nhật|lưu/i).last(), label: 4 }] });
    await closeDlg(page);
    await go(page, `indicator-groups/${D.g1.id}`, 2000);
    await shot(page, F('grp-chi-tiet'), { clip: await listClip(page),
      marks: [{ el: btn(page, /xuất excel/i).first(), label: '' }, { el: btn(page, /thêm chỉ số/i).first(), label: '' }] });
  }

  // ------------------------------------------------------------ CHỈ SỐ
  if (on('ind')) {
    await page.setViewportSize({ width: 1700, height: 1000 });   // bảng chỉ số nhiều cột
    await go(page, 'indicators', 2000);
    await search(page, S); await keepOnly(page, [S]);
    await shot(page, F('ind-ds'), {
      clip: await listClip(page),
      marks: [{ el: page.getByPlaceholder(/tìm/i).first(), label: 2 }, { el: selectBox(page, 'Tất cả nhóm chỉ số'), label: 2 },
              { el: selectBox(page, 'Tất cả trạng thái'), label: 2 }, { el: page.getByText('Xem dạng cây').first(), label: 3 }],
    });
    // Dạng cây
    await page.getByText('Xem dạng cây').first().click(); await page.waitForTimeout(2000);
    await keepOnly(page, [S], '.ant-tree-treenode');
    await shot(page, F('ind-cay'), { clip: { x: 280, y: 95, width: 1420, height: 560 }, marks: [{ el: page.getByText('Xem dạng cây').first(), label: 3 }] });
    await page.getByText('Xem dạng danh sách').first().click(); await page.waitForTimeout(1500);
    // Thêm mới
    await shot(page, F('ind-them-nut'), { clip: header, marks: [{ el: btn(page, /thêm mới chỉ số/i).first(), label: 1 }] });
    await btn(page, /thêm mới chỉ số/i).first().click(); await page.waitForTimeout(900);
    let d = dialog(page);
    await pick(page, d, 'Trụ cột', 'Hạ tầng số');
    await pick(page, d, 'Nhóm chỉ số', 'Hạ tầng kỹ thuật');
    await d.getByPlaceholder(/mã chỉ số/i).fill('C214');
    await d.getByPlaceholder(/tên chỉ số/i).fill('Tỷ lệ đơn vị có kết nối Internet tốc độ cao');
    await d.locator('textarea').fill('Tỷ lệ đơn vị trực thuộc có đường truyền Internet tốc độ cao. Minh chứng: hợp đồng dịch vụ, báo cáo hạ tầng.');
    await d.getByPlaceholder(/điểm tối thiểu/i).fill('0'); await d.getByPlaceholder(/điểm tối đa/i).fill('10');
    await page.waitForTimeout(300);
    await shot(page, F('ind-them'), {
      clip: d,
      marks: [{ el: formItem(d, 'Trụ cột').locator('.ant-select').first(), label: 2 }, { el: formItem(d, 'Nhóm chỉ số').locator('.ant-select').first(), label: 2 },
              { el: formItem(d, 'Chỉ số cha').locator('.ant-select').first(), label: 2 },
              { el: d.getByPlaceholder(/mã chỉ số/i), label: 3 }, { el: d.getByPlaceholder(/tên chỉ số/i), label: 3 }, { el: d.locator('textarea'), label: 3 },
              { el: d.getByPlaceholder(/điểm tối thiểu/i), label: 4 }, { el: d.getByPlaceholder(/điểm tối đa/i), label: 4 },
              { el: btn(d, /Thêm mới Chỉ số/).last(), label: 5 }],
    });
    // chọn chỉ số cha
    await formItem(d, 'Chỉ số cha').locator('.ant-select').first().click(); await page.waitForTimeout(800);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    if (await dialog(page).count()) await closeDlg(page);
    // Menu: chỉ số chưa khóa / đã khóa
    await go(page, 'indicators', 1500);
    await search(page, S); await keepOnly(page, [S]);
    const rUn = dataRows(page).filter({ hasText: D.i4.code }).first();
    await rowMenu(page, rUn);
    await shot(page, F('ind-menu'), { keepMouse: true, clip: await menuClip(page), marks: [{ el: ddMenu(page), label: '' }] });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    // Cập nhật: đổi chỉ số cha + điểm
    await rowMenu(page, rUn); await menuItem(page, /Cập nhật/).click(); await page.waitForTimeout(1000);
    d = dialog(page);
    await d.getByPlaceholder(/điểm tối đa/i).fill('15'); await page.waitForTimeout(300);
    await shot(page, F('ind-sua'), { clip: d,
      marks: [{ el: formItem(d, 'Chỉ số cha').locator('.ant-select').first(), label: 3 }, { el: d.getByPlaceholder(/điểm tối thiểu/i), label: 4 },
              { el: d.getByPlaceholder(/điểm tối đa/i), label: 4 }, { el: btn(d, /cập nhật|lưu/i).last(), label: 5 }] });
    await closeDlg(page); if (await dialog(page).count()) await closeDlg(page);
    // Nhân bản chỉ số đã khóa (tạo bản sao của dữ liệu minh họa)
    await search(page, S); await keepOnly(page, [S]);
    const rLk = dataRows(page).filter({ hasText: D.i2.code }).first();
    await rowMenu(page, rLk);
    await shot(page, F('ind-menu-khoa'), { keepMouse: true, clip: await menuClip(page), marks: [{ el: ddMenu(page), label: '' }] });
    await menuItem(page, /Nhân bản/).click(); await page.waitForTimeout(900);
    if (await dialog(page).count()) {
      await shot(page, F('ind-nhan-ban-xn'), { clip: dialog(page), marks: [{ el: btn(dialog(page), /^\s*(Có|Nhân bản|Xác nhận)\s*$/).last(), label: 2 }] });
      await btn(dialog(page), /^\s*(Có|Nhân bản|Xác nhận)\s*$/).last().click(); await page.waitForTimeout(1800);
    }
    await go(page, 'indicators', 1500);
    await search(page, S); await keepOnly(page, [S]);
    await shot(page, F('ind-nhan-ban-kq'), { clip: await listClip(page), marks: [{ el: dataRows(page).filter({ hasText: /Bản sao/ }).first(), label: '' }] });
    // Chi tiết chỉ số cha (đã khóa) + chi tiết chỉ số chưa khóa (nút Khóa chỉ số)
    await go(page, `indicators/${D.i1.id}`, 2000);
    await shot(page, F('ind-chi-tiet'), { clip: { x: 280, y: 85, width: 1420, height: 915 } });
    await go(page, `indicators/${D.i4.id}`, 2000);
    const lockBtn = btn(page, /khóa chỉ số|khoá chỉ số/i).first();
    await shot(page, F('ind-chi-tiet-chua-khoa'), { clip: { x: 280, y: 85, width: 1420, height: 360 }, marks: [{ el: lockBtn, label: 1 }] });
    // (Nút Khóa chỉ số ở màn chi tiết khóa ngay, không hỏi xác nhận → không bấm)
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  // ------------------------------------------------------------ BỘ CHỈ SỐ
  if (on('set')) {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await go(page, 'indicator-sets', 2000);
    await search(page, S); await keepOnly(page, [S]);
    await shot(page, F('set-ds'), {
      clip: await listClip(page),
      marks: [{ el: page.getByPlaceholder(/tìm/i).first(), label: 2 }, { el: selectBox(page, 'Tất cả trạng thái'), label: 2 }],
    });
    await shot(page, F('set-them-nut'), { clip: header, marks: [{ el: btn(page, /thêm mới bộ chỉ số/i).first(), label: 1 }] });
    // Thêm mới
    await btn(page, /thêm mới bộ chỉ số/i).first().click(); await page.waitForTimeout(900);
    let d = dialog(page);
    await d.getByPlaceholder(/mã bộ chỉ số/i).fill('BCS-2027');
    await d.getByPlaceholder(/tên bộ chỉ số/i).fill('Bộ chỉ số đánh giá chuyển đổi số năm 2027');
    await d.getByPlaceholder('Chọn năm').click(); await page.waitForTimeout(500);
    await page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell[title="2027"]').click(); await page.waitForTimeout(400);
    await d.locator('textarea').fill('Áp dụng cho kỳ tự đánh giá năm 2027 của các cơ quan, đơn vị thuộc Bộ và địa phương');
    await shot(page, F('set-them'), {
      clip: d,
      marks: [{ el: d.getByPlaceholder(/mã bộ chỉ số/i), label: 2 }, { el: d.getByPlaceholder(/tên bộ chỉ số/i), label: 2 },
              { el: wrap(d.getByPlaceholder('Chọn năm')), label: 3 }, { el: d.locator('textarea'), label: 3 }, { el: btn(d, /Thêm mới Bộ chỉ số/).last(), label: 4 }],
    });
    await closeDlg(page);
    // Menu bộ chưa khóa
    await go(page, 'indicator-sets', 2000);
    await search(page, S); await keepOnly(page, [S]);
    const rUn = rowByCode(page, D.set2.code);
    await rowMenu(page, rUn);
    await shot(page, F('set-menu'), { keepMouse: true, clip: await menuClip(page), marks: [{ el: ddMenu(page), label: '' }] });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    // Khóa / Xóa (hộp xác nhận → Không)
    await rowMenu(page, rUn); await menuItem(page, /^\s*Kho[áa]/).click(); await page.waitForTimeout(900);
    await shot(page, F('set-khoa'), { clip: dialog(page), marks: [{ el: btn(dialog(page), /^\s*Có\s*$/).last(), label: 2 }] });
    await closeDlg(page);
    await rowMenu(page, rUn); await menuItem(page, /Xo[áa]/).click(); await page.waitForTimeout(900);
    await shot(page, F('set-xoa'), { clip: dialog(page), marks: [{ el: btn(dialog(page), /^\s*Có\s*$/).last(), label: 2 }] });
    await closeDlg(page);
    // Nhân bản bộ đã khóa (tạo bản sao của dữ liệu minh họa)
    const rLk = rowByCode(page, D.set.code);
    await rowMenu(page, rLk);
    await shot(page, F('set-menu-khoa'), { keepMouse: true, clip: await menuClip(page), marks: [{ el: ddMenu(page), label: '' }] });
    await menuItem(page, /Nhân bản/).click(); await page.waitForTimeout(900);
    if (await dialog(page).count()) { await btn(dialog(page), /^\s*Có\s*$/).last().click(); await page.waitForTimeout(2000); }
    await go(page, 'indicator-sets', 1500);
    await search(page, S); await keepOnly(page, [S]);
    await shot(page, F('set-nhan-ban-kq'), { clip: await listClip(page), marks: [{ el: dataRows(page).first(), label: '' }] });
    // Chi tiết
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go(page, `indicator-sets/${D.set.id}`, 2000);
    await btn(page, /mở rộng tất cả/i).first().click().catch(() => {}); await page.waitForTimeout(800);
    await shot(page, F('set-chi-tiet'), { clip: { x: 280, y: 85, width: 1160, height: 915 },
      marks: [{ el: btn(page, /xuất excel/i).first(), label: '' }, { el: btn(page, /mở rộng tất cả/i).first(), label: '' }] });
    await go(page, `indicator-sets/${D.set2.id}`, 2000);
    await shot(page, F('set-chi-tiet-nut'), { clip: { x: 280, y: 85, width: 1160, height: 330 },
      marks: [{ el: btn(page, /cập nhật thông tin/i).first(), label: 1 }, { el: btn(page, /cấu hình bộ chỉ số/i).first(), label: '' }] });
    await btn(page, /cập nhật thông tin/i).first().click(); await page.waitForTimeout(900);
    d = dialog(page);
    await shot(page, F('set-sua'), { clip: d, marks: [{ el: btn(d, /lưu|cập nhật/i).last(), label: 3 }] });
    await closeDlg(page);
    // Cấu hình bộ chỉ số (builder) – màn rộng
    await page.setViewportSize({ width: 1900, height: 1000 });
    await go(page, `indicator-sets/${D.set2.id}/builder`, 2500);
    await shot(page, F('set-builder'), {
      clip: { x: 280, y: 85, width: 1610, height: 760 },
      marks: [{ el: btn(page, /thêm nhóm/i).first(), label: 1 }, { el: page.locator('div[aria-roledescription="sortable"]').first(), label: 2 },
              { el: page.locator('[role=switch]').first(), label: 3 }, { el: page.locator('tr').filter({ has: page.locator('input') }).filter({ hasText: D.i1a.code }).last(), label: 4, pos: 'inside', align: 'left' },
              { el: page.locator('.ant-select').filter({ hasText: /chọn chỉ số/i }).first(), label: 5 }, { el: btn(page, /lưu chỉ số/i).first(), label: 6 }, { el: btn(page, /lưu nhóm/i).first(), label: 6 }],
    });
    await page.getByRole('button', { name: /thêm nhóm/i }).first().click(); await page.waitForTimeout(1500);
    const sb = page.getByPlaceholder(/tìm theo mã, tên nhóm/i).last();
    const m = dialog(page);
    await sb.fill(S); await page.waitForTimeout(1500);
    await sb.evaluate(el => { el.style.color = 'transparent'; el.blur(); });
    await page.evaluate(() => document.querySelectorAll('.ant-modal .ant-input-clear-icon').forEach(x => x.style.visibility = 'hidden'));
    await m.locator('tbody tr').filter({ hasText: D.g2.code }).locator('input[type=checkbox]').check().catch(() => {}); await page.waitForTimeout(500);
    await shot(page, F('set-builder-them-nhom'), { clip: m,
      marks: [{ el: m.getByPlaceholder(/tìm/i).first(), label: 1 }, { el: m.locator('tbody tr').filter({ hasText: D.g2.code }).first(), label: 2 }, { el: btn(m, /^\s*Lưu\s*$/).last(), label: 3 }] });
    await closeDlg(page);
    const pickInd = page.locator('.ant-select').filter({ hasText: /chọn chỉ số/i }).first();
    await pickInd.click(); await page.waitForTimeout(900);
    {
      const a = await pickInd.boundingBox(), b = await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().boundingBox();
      const x = Math.min(a.x, b.x) - 30, y = Math.min(a.y, b.y) - 30;
      await shot(page, F('set-builder-them-chi-so'), { keepMouse: true, clip: { x, y, width: Math.max(a.x + a.width, b.x + b.width) + 330 - x, height: Math.max(a.y + a.height, b.y + b.height) + 30 - y },
        marks: [{ el: pickInd, label: 5 }, { el: btn(page, /thêm mới chỉ số/i).first(), label: 5 }] });
    }
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  // ------------------------------------------------------------ THANG XẾP LOẠI
  if (on('scl')) {
    await go(page, 'score-scales', 2000);
    await keepOnly(page, [S, 'TXL-001']);
    await shot(page, F('scl-ds'), {
      clip: await listClip(page),
      marks: [{ el: page.getByPlaceholder(/tìm/i).first(), label: 2 }, { el: selectBox(page, 'Tất cả trạng thái'), label: 2 }, { el: btn(page, /thêm thang/i).first(), label: 3 }],
    });
    // Thêm mới (màn riêng)
    await page.setViewportSize({ width: 1440, height: 1500 });
    await btn(page, /thêm thang/i).first().click(); await page.waitForTimeout(1500);
    await page.getByPlaceholder('Vui lòng nhập tên thang').fill('Thang xếp loại mức độ chuyển đổi số 2027');
    await page.locator('main textarea').first().fill('Áp dụng cho các kỳ tự đánh giá năm 2027');
    const lv = (i) => page.getByPlaceholder('Vui lòng nhập tên mức').nth(i);
    const to = (i) => lv(i).locator('xpath=following::input[1]');
    await lv(0).fill('Yếu'); await to(0).fill('50'); await page.waitForTimeout(500);
    await lv(1).fill('Trung bình'); await to(1).fill('65'); await page.waitForTimeout(500);
    await lv(2).fill('Khá');
    const top0 = async () => { await main(page).evaluate(el => el.scrollTo(0, 0)); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); };
    await top0();
    await shot(page, F('scl-them-dang-nhap'), { clip: { x: 280, y: 70, width: 1160, height: 1050 },
      marks: [{ el: to(2), label: 4 }, { el: page.getByText(/chưa nhập mốc|lỗi cần sửa/i).first(), label: '' }] });
    await to(2).fill('80'); await page.waitForTimeout(500);
    await lv(3).fill('Tốt'); await to(3).fill('100'); await page.waitForTimeout(700);
    await top0();
    await shot(page, F('scl-them'), { clip: { x: 280, y: 70, width: 1160, height: 1050 },
      marks: [{ el: page.getByPlaceholder('Vui lòng nhập tên thang'), label: 2 }, { el: lv(0), label: 3 }, { el: to(3), label: 4 },
              { el: page.getByText('Xem trước').first().locator('xpath=..'), label: 5 }, { el: btn(page, /^\s*Lưu\s*$/).last(), label: 6 }] });
    await btn(page, /^\s*Hu[ỷy]\s*$/).last().click(); await page.waitForTimeout(900);
    if (await dialog(page).count()) {
      await shot(page, F('scl-thoat'), { clip: dialog(page) });
      await btn(dialog(page), /thoát/i).last().click().catch(() => closeDlg(page)); await page.waitForTimeout(900);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Chi tiết thang đang được kỳ sử dụng
    await go(page, `score-scales/${D.scale.id}`, 2000);
    await shot(page, F('scl-chi-tiet'), { clip: { x: 280, y: 85, width: 1160, height: 915 } });
    // Menu thang chưa khóa, sửa
    await go(page, 'score-scales', 2000); await keepOnly(page, [S, 'TXL-001']);
    const rUn = dataRows(page).filter({ hasText: D.scale2.code }).first();
    await rowMenu(page, rUn);
    await shot(page, F('scl-menu'), { keepMouse: true, clip: await menuClip(page), marks: [{ el: ddMenu(page), label: '' }] });
    await page.setViewportSize({ width: 1440, height: 1500 });
    await menuItem(page, /Cập nhật/).click(); await page.waitForTimeout(1500);
    await main(page).evaluate(el => el.scrollTo(0, 0)); await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, F('scl-sua'), { clip: { x: 280, y: 70, width: 1160, height: 1050 }, marks: [{ el: btn(page, /^\s*Lưu\s*$/).last(), label: 3 }] });
    await btn(page, /^\s*Hu[ỷy]\s*$/).last().click(); await page.waitForTimeout(900);
    if (await dialog(page).count()) await btn(dialog(page), /thoát/i).last().click().catch(() => closeDlg(page));
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Khóa (thực hiện trên thang minh họa) → Mở khóa (hộp thoại, Không) → Xóa (hộp thoại, Không)
    await go(page, 'score-scales', 2000); await keepOnly(page, [S, 'TXL-001']);
    await rowMenu(page, dataRows(page).filter({ hasText: D.scale2.code }).first());
    if (!(await menuItem(page, /^\s*Kho[áa]/).count())) {   // thang minh họa còn khóa từ lần chạy trước → mở khóa lại
      await menuItem(page, /Mở kho[áa]/).click(); await page.waitForTimeout(800); await dialog(page).getByRole('button').last().click(); await page.waitForTimeout(1500);
      await go(page, 'score-scales', 2000); await keepOnly(page, [S, 'TXL-001']);
      await rowMenu(page, dataRows(page).filter({ hasText: D.scale2.code }).first());
    }
    await menuItem(page, /^\s*Kho[áa]/).click(); await page.waitForTimeout(900);
    await shot(page, F('scl-khoa'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').last(), label: 2 }] });
    await dialog(page).getByRole('button').last().click(); await page.waitForTimeout(1500);
    await go(page, 'score-scales', 2000); await keepOnly(page, [S, 'TXL-001']);
    await rowMenu(page, dataRows(page).filter({ hasText: D.scale2.code }).first());
    await shot(page, F('scl-menu-khoa'), { keepMouse: true, clip: await menuClip(page), marks: [{ el: ddMenu(page), label: '' }] });
    await menuItem(page, /Mở kho[áa]/).click(); await page.waitForTimeout(900);
    await shot(page, F('scl-mo-khoa'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').last(), label: 2 }] });
    await closeDlg(page);
    await rowMenu(page, dataRows(page).filter({ hasText: D.scale2.code }).first()); await menuItem(page, /Xo[áa]/).click(); await page.waitForTimeout(900);
    await shot(page, F('scl-xoa'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').last(), label: 2 }] });
    await closeDlg(page);
  }

  // ------------------------------------------------------------ QUẢN LÝ TỰ ĐÁNH GIÁ
  if (on('cmp')) {
    const REJ = '7c9821ab-baea-42d7-a81d-07ee88935c8e';   // kỳ có sẵn bị từ chối – chỉ mở xem
    const cmpList = async () => { await go(page, 'self-assessment-campaigns', 2000); await search(page, S); await keepOnly(page, [S]); };
    await cmpList();
    await shot(page, F('cmp-ds'), {
      clip: await listClip(page),
      marks: [{ el: page.locator('.ant-segmented').first(), label: 2 },   // Bước 1 = chọn menu (ảnh b-cmp-menu-chon)
              { el: page.getByPlaceholder(/tìm/i).first(), label: 3 }, { el: btn(page, /xuất excel/i).first(), label: 4 }, { el: btn(page, /thêm mới tự đánh giá/i).first(), label: 5 }],
    });
    // Thêm mới – Định kỳ
    await page.getByRole('button', { name: /thêm mới tự đánh giá/i }).click(); await page.waitForTimeout(1000);
    let d = dialog(page);
    await d.locator('#name').fill('Tự đánh giá chuyển đổi số năm 2027');
    await pick(page, d, 'Phân loại', 'Định kỳ');
    await pick(page, d, /^\s*Kỳ/, 'Năm').catch(() => {});
    await d.locator('#indicatorSetId').click({ force: true }); await page.waitForTimeout(800);
    await openSelect(page).locator('.ant-select-item-option').filter({ hasText: D.set.code }).first().click().catch(async () =>
      openSelect(page).locator('.ant-select-item-option').filter({ hasText: 'năm 2026' }).first().click());
    await page.waitForTimeout(500);
    await d.locator('#reminderDaysBeforeDue').fill('5');
    await d.locator('#scaleId').click({ force: true }); await page.waitForTimeout(800);
    await openSelect(page).locator('.ant-select-item-option').filter({ hasText: 'QCA Thang xếp loại 4 mức' }).first().click(); await page.waitForTimeout(500);
    await page.evaluate((sfx) => document.querySelectorAll('.ant-modal .ant-select-selection-item').forEach(e => { e.textContent = e.textContent.replace(' ' + sfx, '').replace('QCA ', ''); }), S);
    await shot(page, F('cmp-them-dinh-ky'), { clip: d,
      marks: [{ el: d.locator('#name'), label: 2 }, { el: wrap(d.locator('#type')), label: 3 }, { el: formItem(d, /^\s*Kỳ/).locator('.ant-select'), label: 4 },
              { el: wrap(d.locator('#indicatorSetId')), label: 5 }, { el: d.locator('#reminderDaysBeforeDue'), label: 6 }, { el: wrap(d.locator('#scaleId')), label: 7 },
              { el: d.getByRole('button').last(), label: 8 }] });
    // chuyển Đột xuất để thấy ô ngày
    await pick(page, d, 'Phân loại', 'Đột xuất'); await page.waitForTimeout(600);
    for (const [id, v] of [['startDate', '01/12/2026'], ['endDate', '31/12/2026']]) {
      await d.locator('#' + id).click(); await page.keyboard.type(v); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    }
    await d.locator('.ant-modal-header, .ant-modal-title').first().click().catch(() => {}); await page.waitForTimeout(400);
    await shot(page, F('cmp-them-dot-xuat'), { clip: d,
      marks: [{ el: wrap(d.locator('#type')), label: 3 }, { el: wrap(d.locator('#startDate')), label: 4 }, { el: wrap(d.locator('#endDate')), label: 4 }] });
    await closeDlg(page);
    // Menu dòng + Cập nhật
    await cmpList();
    let row = dataRows(page).filter({ hasText: 'Quý IV/2026' }).first();
    await rowMenu(page, row);
    await shot(page, F('cmp-menu'), { keepMouse: true, clip: await menuClip(page), marks: [{ el: ddMenu(page), label: '' }] });
    await menuItem(page, /Cập nhật/).click(); await page.waitForTimeout(1200);
    d = dialog(page);
    await shot(page, F('cmp-sua'), { clip: d, marks: [{ el: d.getByRole('button').last(), label: 3 }] });
    await closeDlg(page);
    // Trình phê duyệt / Xóa từ menu → Không
    await cmpList(); row = dataRows(page).filter({ hasText: 'Quý IV/2026' }).first();
    await rowMenu(page, row); await menuItem(page, /Xo[áa]/).click(); await page.waitForTimeout(900);
    await shot(page, F('cmp-xoa'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').last(), label: 2 }] });
    await closeDlg(page);
    // Chi tiết
    await go(page, `self-assessment-campaigns/${D.camp.id}`, 2500);
    await shot(page, F('cmp-chi-tiet'), { clip: { x: 280, y: 85, width: 1160, height: 915 },
      marks: [{ el: page.getByRole('button', { name: /trình phê duyệt/i }).first(), label: '' }, { el: page.getByRole('button', { name: /xem cấu hình điểm/i }).first(), label: '' },
              { el: page.getByRole('button', { name: /phân công đơn vị/i }).first(), label: '' }] });
    // Phân công đơn vị
    await page.getByRole('button', { name: /phân công đơn vị/i }).first().click(); await page.waitForTimeout(1500);
    d = dialog(page);
    await hideJunk(page, '.ant-modal tbody tr');
    // tích chọn minh họa trên giao diện (không lưu – nhấn Huỷ sau khi chụp)
    for (const c of ['UBNDX-QA03', 'BDT-QA01']) await d.locator('tbody tr').filter({ hasText: c }).locator('.ant-checkbox-input').check().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, F('cmp-phan-cong'), { clip: d,
      marks: [{ el: d.getByPlaceholder(/tìm/i).first(), label: 2 }, { el: d.locator('.ant-select').first(), label: 2 }, { el: d.locator('.ant-select').nth(1), label: 2 },
              { el: d.locator('tbody tr').filter({ has: page.locator('.ant-checkbox-checked') }).first().locator('.ant-checkbox').first(), label: 3 }, { el: d.getByRole('button').last(), label: 4 }] });
    await closeDlg(page);
    // Trình phê duyệt → Không
    await page.getByRole('button', { name: /trình phê duyệt/i }).first().click(); await page.waitForTimeout(900);
    await shot(page, F('cmp-trinh'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').last(), label: 2 }] });
    await closeDlg(page);
    // Xem cấu hình điểm của kỳ
    await page.setViewportSize({ width: 1900, height: 1000 });
    await page.getByRole('button', { name: /xem cấu hình điểm/i }).first().click(); await page.waitForTimeout(2500);
    await shot(page, F('cmp-cau-hinh'), { clip: { x: 280, y: 85, width: 1610, height: 760 } });
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Kỳ đột xuất trong tab Đột xuất
    await go(page, 'self-assessment-campaigns', 2000);
    await page.getByRole('tab', { name: /Đột xuất/ }).first().click().catch(() => page.locator('label').filter({ hasText: /^\s*Đột xuất\s*$/ }).first().click());
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.waitForTimeout(1500); await search(page, S);
    await shot(page, F('cmp-ds-dot-xuat'), { clip: await listClip(page), marks: [{ el: page.locator('.ant-segmented').first(), label: '' }] });
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Kỳ có sẵn bị từ chối: chỉ xem, mở hộp thoại Trình phê duyệt rồi Không
    await page.setViewportSize({ width: 1440, height: 1500 });
    await go(page, `self-assessment-campaigns/${REJ}`, 2500);
    await shot(page, F('cmp-tu-choi'), { clip: { x: 280, y: 70, width: 1160, height: 1035 },
      marks: [{ el: page.getByText(/Bị từ chối/).first(), label: '' }, { el: page.getByRole('button', { name: /trình phê duyệt|trình lại/i }).first(), label: 4 }] });
    await page.getByRole('button', { name: /trình phê duyệt|trình lại/i }).first().click(); await page.waitForTimeout(900);
    await shot(page, F('cmp-trinh-lai'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').last(), label: 5 }] });
    await closeDlg(page);   // Không – không trình kỳ có sẵn
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
} finally {
  await closeAll();
  if (!process.env.KEEP) await cleanup();
}
