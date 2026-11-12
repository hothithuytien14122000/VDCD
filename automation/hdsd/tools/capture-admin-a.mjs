// Chụp ảnh HDSD vai trò Quản trị hệ thống – PHẦN A (nhóm menu "Quản trị hệ thống").
// Dùng: node hdsd/tools/capture-admin-a.mjs [usr grp prm prv com uty org cfg]   (không truyền = chụp tất cả)
// Ảnh: hdsd/out/img/admin/a-*.png
// An toàn dữ liệu: chỉ ghi trên bản ghi minh họa tiền tố QCA / tên "qc.automation …" tạo qua API lúc bắt đầu
// và xóa hết trong finally. Dữ liệu có sẵn chỉ mở xem / mở form rồi Huỷ.
import fs from 'node:fs';
import { BASE, openRole, go, shot, closeAll, dialog, wrap } from './shot.mjs';

const want = process.argv.slice(2);
const on = (k) => !want.length || want.includes(k);
const F = (n) => `admin/a-${n}`;

// ---------- API (token superadmin) ----------
const TOKEN = (() => {
  const st = JSON.parse(fs.readFileSync('auth/superadmin.json', 'utf8'));
  return st.origins[0].localStorage.map(x => x.value).find(v => v.split('.').length === 3);
})();
async function api(method, res, body) {
  const r = await fetch(`${BASE}/api/v1/${res}`, {
    method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status >= 300) console.warn(`  ! API ${method} ${res}: ${r.status} ${j?.message ?? ''}`);
  return j?.data;
}
const rows = (d) => d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
// Một số API tạo mới (nhóm, người dùng) không trả bản ghi → tìm lại theo mã
async function findBy(res, field, val) {
  for (let p = 1; p <= 30; p++) {
    const d = await api('GET', `${res}?page=${p}&size=100`);
    const hit = rows(d).find(x => x[field] === val);
    if (hit) return hit;
    if (p >= (d?.totalPages ?? 1)) return null;
  }
}
async function create(res, body, field = 'code') {
  const x = await api('POST', res, body);
  const rec = x?.id ? x : await findBy(res, field, body[field]);
  made.push([res, rec?.id]);
  if (!rec) throw new Error(`Không tạo được ${res} ${body[field]}`);
  return rec;
}
const sfx = Date.now().toString(36).slice(-4).toUpperCase();
const code = (p) => `QCA${p}${sfx}`;        // ≤ 10 ký tự
const made = [];                             // [resource, id] — xóa theo thứ tự ngược

async function setup() {
  const prov = rows(await api('GET', 'provinces?page=1&size=100')).find(p => p.code === 'QC_01');
  const types = rows(await api('GET', 'unit-types?page=1&size=100'));
  const ut = types.find(t => t.code === 'LDV-01') ?? types[0];
  const D = {};
  D.prov = await create('provinces', { code: code('P'), name: 'qc.automation Tỉnh minh họa' });
  D.com = await create('communes', { code: code('X'), name: 'qc.automation Phường minh họa', provinceId: D.prov.id });
  D.type = await create('unit-types', { code: code('L'), name: 'qc.automation Loại đơn vị minh họa', adminLevel: 2, description: 'qc.automation' });
  D.org = await create('organizations', { code: code('D'), name: 'qc.automation Sở Thông tin minh họa', unitTypeId: ut.id, provinceId: prov?.id });
  const xaType = types.find(t => t.name === 'qc_UBND cấp xã');
  if (xaType) D.orgXa = await create('organizations', { code: code('E'), name: 'qc.automation UBND phường minh họa', unitTypeId: xaType.id, provinceId: prov?.id });
  D.role = await create('idm/roles', { code: code('N'), name: 'qc.automation Nhóm minh họa', description: 'qc.automation – nhóm dùng để minh họa tài liệu' });
  process.loadEnvFile('.env');
  const user = async (u, name, extra) => ({ ...(await create('idm/users', { name, email: `${u}@cds.local`, userName: u, password: process.env.DEFAULT_PASSWORD, isRequireChangePassword: false, isRequestMailInfo: false, organizationId: D.org.id, roleCode: D.role.code, ...extra }, 'userName')), userName: u, name });
  D.u1 = await user(`qca${sfx.toLowerCase()}a`, 'qc.automation Nguyễn Văn An', { phoneNumber: '09' + String(Date.now()).slice(-8) });
  D.u2 = await user(`qca${sfx.toLowerCase()}b`, 'qc.automation Trần Thị Bình', {});
  D.provQC01 = prov; D.ut = ut;
  console.log('  + dữ liệu minh họa:', Object.entries(D).filter(([, v]) => v?.code || v?.userName).map(([k, v]) => `${k}=${v.code ?? v.userName}`).join(' '));
  return D;
}
async function cleanup() {
  for (const [res, id] of made.reverse()) {
    if (!id) continue;
    if (res === 'idm/roles') await api('PUT', `idm/permission-matrix/roles/${id}`, { permissions: [] }).catch(() => {});
    if (res === 'organizations') await api('PUT', `organizations/${id}/unlock`, {}).catch(() => {});
    if (res === 'idm/users') await api('PUT', `idm/users/${id}/unlock`, {}).catch(() => {});
    await api('DELETE', `${res}/${id}`);
  }
  console.log('  − đã xóa dữ liệu minh họa:', made.length, 'bản ghi');
}

// ---------- helper giao diện ----------
const main = (page) => page.locator('main, .ant-layout-content').first();
const dataRows = (page) => page.locator('tbody tr.ant-table-row');
const sideItem = (page, text) => page.getByRole('complementary').locator('.ant-menu-item').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) }).first();
// Ẩn các dòng dữ liệu rác của môi trường test (chuỗi thử XSS, ký tự vô nghĩa) để ảnh tài liệu sạch
const JUNK = ['<script', '!!', '@@@', 'aaaaaa', 'testabc', 'H? th?ng', 'Nhi Nguyen', 'test data'];
async function hideJunk(page) {
  await page.evaluate((junk) => {
    document.querySelectorAll('tbody tr').forEach(tr => { if (junk.some(j => tr.innerText.includes(j))) tr.style.display = 'none'; });
  }, JUNK);
}
async function search(page, ph, kw) { await page.getByPlaceholder(ph).fill(kw); await page.waitForTimeout(1500); }
async function rowMenu(page, row) {
  await row.locator('button.ant-dropdown-trigger').first().click(); await page.waitForTimeout(600);
  return page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu').last();
}
const menuItem = (page, re) => page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item').filter({ hasText: re }).first();
const btn = (scope, re) => scope.getByRole('button').filter({ hasText: re });
const btnT = (scope, re) => scope.getByRole('button').filter({ hasText: re });   // nút có biểu tượng (tên truy cập kèm icon)
const formItem = (scope, label) => scope.locator('.ant-form-item').filter({ hasText: label }).first();
// text: chuỗi gõ để lọc; exact: chọn đúng option có nhãn trùng khớp hoàn toàn
async function pick(page, scope, label, text, exact = false) {
  await formItem(scope, label).locator('.ant-select').first().click(); await page.waitForTimeout(500);
  if (text) { await page.keyboard.type(text); await page.waitForTimeout(1200); }
  const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  const re = exact ? new RegExp(`^\\s*${text}\\s*$`) : (text ?? /./);
  await dd.locator('.ant-select-item-option').filter({ hasText: re }).first().click(); await page.waitForTimeout(400);
}
const closeDlg = async (page) => {
  const d = dialog(page);
  const c = d.getByRole('button', { name: /^\s*(Huỷ|Hủy|Quay lại|Không|Đóng)\s*$/ });
  if (await c.count()) await c.last().click(); else await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
};
const header = (page) => ({ x: 245, y: 60, width: 1195, height: 190 });   // vùng tiêu đề + nút của màn danh sách

// =====================================================================
let D;
const { page } = await openRole('admin', { width: 1440, height: 1000 });
try {
  D = await setup();

  // ---------------- NGƯỜI DÙNG ----------------
  if (on('usr')) {
    console.log('# Người dùng');
    await go(page, 'users', 2500); await hideJunk(page);
    await shot(page, F('usr-ds'), {
      marks: [{ el: sideItem(page, 'Người dùng'), label: 1 },
              { el: page.getByPlaceholder(/tìm kiếm theo tên, email/i), label: 2 },
              { el: main(page).locator('.ant-select').filter({ hasText: 'Tất cả nhóm' }).first(), label: 3 },
              { el: main(page).locator('.ant-select').filter({ hasText: 'Tất cả trạng thái' }).first(), label: 3 },
              { el: btn(page, /xuất excel/i).first(), label: 4 }],
    });
    // Thêm mới
    await shot(page, F('usr-them-nut'), { clip: header(page), marks: [{ el: btn(page, /thêm mới người dùng/i), label: 1 }] });
    await btn(page, /thêm mới người dùng/i).click(); await page.waitForTimeout(1200);
    let d = dialog(page);
    await btn(d, /thêm mới người dùng/i).last().click(); await page.waitForTimeout(700);
    await shot(page, F('usr-them-loi'), { clip: d });
    await formItem(d, /^\s*Tên\s*\*?/).locator('input').first().fill('Nguyễn Văn An');
    await formItem(d, 'Số điện thoại').locator('input').first().fill('0912345678');
    await formItem(d, 'Email').locator('input').first().fill('nguyenvanan@donvi.gov.vn');
    await formItem(d, 'Tên đăng nhập').locator('input').first().fill('nguyenvanan');
    await d.locator('input[type=password]').first().fill('DonVi@2026');
    await pick(page, d, /^\s*Đơn vị/, 'QA - Đơn vị Bộ');
    await pick(page, d, 'Nhóm người dùng', 'Cán bộ', true);
    await page.waitForTimeout(500);
    await shot(page, F('usr-them-form'), {
      clip: d,
      marks: [{ el: formItem(d, /^\s*Tên\s*\*?/), label: 2 }, { el: formItem(d, 'Số điện thoại'), label: 2 }, { el: formItem(d, 'Email'), label: 2 },
              { el: formItem(d, 'Tên đăng nhập'), label: 3 }, { el: d.locator('.ant-input-password').first(), label: 3 },
              { el: formItem(d, /^\s*Đơn vị/), label: 4 }, { el: formItem(d, 'Nhóm người dùng'), label: 4 },
              { el: btn(d, /thêm mới người dùng/i).last(), label: 5 }],
    });
    await closeDlg(page);
    // Chi tiết (user minh họa)
    await search(page, /tìm kiếm theo tên, email/i, D.u1.userName);
    let row = dataRows(page).filter({ hasText: D.u1.userName }).first();
    await shot(page, F('usr-xem-nut'), { clip: main(page).locator('.ant-table').first(), marks: [{ el: row.getByText('Xem chi tiết'), label: 1 }] });
    await row.getByText('Xem chi tiết').click(); await page.waitForTimeout(1500);
    d = dialog(page);
    await shot(page, F('usr-chi-tiet'), { clip: d, marks: [{ el: btnT(d, /Cập nhật/), label: 2 }] });
    // Cập nhật
    await btnT(d, /Cập nhật/).click(); await page.waitForTimeout(1500);
    d = dialog(page);
    await formItem(d, 'Số điện thoại').locator('input').first().fill('0987654321'); await page.waitForTimeout(300);
    await shot(page, F('usr-sua-form'), {
      clip: d,
      marks: [{ el: formItem(d, 'Số điện thoại'), label: 3 }, { el: formItem(d, 'Mật khẩu mới'), label: 4 },
              { el: btnT(d, /^\s*Lưu\s*$/).last(), label: 5 }],
    });
    await closeDlg(page); await closeDlg(page);
    // Menu thao tác + Khoá / Mở khoá / Xoá (user minh họa 2)
    await go(page, 'users', 2000);
    await search(page, /tìm kiếm theo tên, email/i, D.u2.userName);
    row = dataRows(page).filter({ hasText: D.u2.userName }).first();
    await rowMenu(page, row);
    await shot(page, F('usr-menu'), { clip: { x: 245, y: 150, width: 1195, height: 420 }, keepMouse: true,
      marks: [{ el: row.locator('button.ant-dropdown-trigger').first(), label: 1 }, { el: menuItem(page, /kho[áa]/i), label: 2 }] });
    await menuItem(page, /kho[áa]/i).click(); await page.waitForTimeout(900);
    await shot(page, F('usr-khoa-xac-nhan'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').filter({ hasText: /^\s*(Có|Khoá|Khóa|Xác nhận)\s*$/ }).last(), label: 3 }] });
    await dialog(page).getByRole('button').filter({ hasText: /^\s*(Có|Khoá|Khóa|Xác nhận)\s*$/ }).last().click(); await page.waitForTimeout(1500);
    await shot(page, F('usr-da-khoa'), { clip: { x: 245, y: 60, width: 1195, height: 420 } });
    await rowMenu(page, dataRows(page).filter({ hasText: D.u2.userName }).first());
    await shot(page, F('usr-menu-mo-khoa'), { clip: { x: 245, y: 150, width: 1195, height: 420 }, keepMouse: true, marks: [{ el: menuItem(page, /mở kho[áa]/i), label: 2 }] });
    await menuItem(page, /mở kho[áa]/i).click(); await page.waitForTimeout(900);
    const yes = dialog(page).getByRole('button').filter({ hasText: /^\s*(Có|Mở khoá|Mở khóa|Xác nhận)\s*$/ });
    if (await yes.count()) { await yes.last().click(); await page.waitForTimeout(1500); }
    await rowMenu(page, dataRows(page).filter({ hasText: D.u2.userName }).first());
    await menuItem(page, /xo[áa]/i).click(); await page.waitForTimeout(900);
    await shot(page, F('usr-xoa-xac-nhan'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').filter({ hasText: /^\s*(Có|Xoá|Xóa|Xác nhận)\s*$/ }).last(), label: 3 }] });
    await closeDlg(page);
  }

  // ---------------- NHÓM NGƯỜI DÙNG ----------------
  if (on('grp')) {
    console.log('# Nhóm người dùng');
    await go(page, 'roles', 2500); await hideJunk(page);
    await shot(page, F('grp-ds'), {
      marks: [{ el: sideItem(page, 'Nhóm người dùng'), label: 1 }, { el: page.getByPlaceholder(/tìm kiếm theo tên nhóm/i), label: 2 }],
    });
    await shot(page, F('grp-them-nut'), { clip: header(page), marks: [{ el: btn(page, /thêm mới nhóm/i), label: 1 }] });
    await btn(page, /thêm mới nhóm/i).click(); await page.waitForTimeout(1200);
    let d = dialog(page);
    await formItem(d, 'Mã nhóm').locator('input').first().fill('CAN_BO_TINH');
    await formItem(d, 'Tên nhóm').locator('input').first().fill('Cán bộ cấp tỉnh');
    await formItem(d, 'Mô tả').locator('textarea, input').first().fill('Cán bộ tại Sở/Ban/Ngành thực hiện tự đánh giá cho đơn vị');
    await shot(page, F('grp-them-form'), { clip: d, marks: [{ el: formItem(d, 'Mã nhóm'), label: 2 }, { el: formItem(d, 'Tên nhóm'), label: 2 }, { el: formItem(d, 'Mô tả'), label: 2 }, { el: btn(d, /thêm mới/i).last(), label: 3 }] });
    await closeDlg(page);
    // Chi tiết nhóm minh họa
    await search(page, /tìm kiếm theo tên nhóm/i, D.role.code);
    let row = dataRows(page).filter({ hasText: D.role.code }).first();
    await rowMenu(page, row);
    await shot(page, F('grp-menu'), { clip: { x: 245, y: 150, width: 1195, height: 380 }, keepMouse: true, marks: [{ el: menuItem(page, /cập nhật/i), label: 2 }, { el: menuItem(page, /xo[áa]/i), label: 'XOÁ' }] });
    await menuItem(page, /cập nhật/i).click(); await page.waitForTimeout(1200);
    d = dialog(page);
    await shot(page, F('grp-sua-form'), { clip: d, marks: [{ el: formItem(d, 'Tên nhóm'), label: 3 }, { el: btn(d, /^\s*(Lưu|Cập nhật)/).last(), label: 4 }] });
    await closeDlg(page);
    await rowMenu(page, dataRows(page).filter({ hasText: D.role.code }).first());
    await menuItem(page, /xo[áa]/i).click(); await page.waitForTimeout(900);
    await shot(page, F('grp-xoa-xac-nhan'), { clip: dialog(page) });
    await closeDlg(page);
    await dataRows(page).filter({ hasText: D.role.code }).first().getByText('Xem chi tiết').click(); await page.waitForTimeout(2000);
    await shot(page, F('grp-chi-tiet'), {
      marks: [{ el: btn(page, /thêm người dùng vào nhóm/i), label: 1 },
              { el: main(page).locator('.ant-select').filter({ hasText: 'Tất cả trạng thái' }).first(), label: 'Lọc' },
              { el: btn(page, /xuất excel/i).first(), label: 'Xuất Excel', align: 'left' }],
    });
    await btn(page, /thêm người dùng vào nhóm/i).click(); await page.waitForTimeout(1500);
    d = dialog(page); await hideJunk(page);
    // Tích 2 người dùng chọn được đầu tiên (chỉ để chụp, không Lưu), đánh 1 khung BƯỚC 2 bao cả 2 ô
    const cands = d.locator('tbody tr.ant-table-row').filter({ has: page.locator('input[type=checkbox]:not([disabled])') });
    for (const i of [0, 1]) { await cands.nth(i).locator('input[type=checkbox]').first().check({ force: true }).catch(() => {}); await page.waitForTimeout(400); }
    const c1 = await cands.nth(0).locator('td').first().boundingBox(), c2 = await cands.nth(1).locator('td').first().boundingBox();
    const tick = c1 && c2 ? { x: c1.x, y: c1.y, width: c1.width, height: c2.y + c2.height - c1.y } : cands.first().locator('td').first();
    await shot(page, F('grp-them-tv'), { clip: d, marks: [{ el: tick, label: 2, align: 'left' }, { el: btn(d, /^\s*Lưu\s*$/), label: 3 }] });
    await closeDlg(page);
    const mrow = dataRows(page).filter({ hasText: D.u1.userName }).first();
    await mrow.locator('label').first().click(); await page.waitForTimeout(500);
    await shot(page, F('grp-xoa-tv'), { clip: main(page), marks: [{ el: mrow.locator('td').first(), label: 1 }, { el: btn(page, /xóa khỏi nhóm|xoá khỏi nhóm/i).first(), label: 2 }] });
    await btn(page, /xóa khỏi nhóm|xoá khỏi nhóm/i).first().click(); await page.waitForTimeout(900);
    await shot(page, F('grp-xoa-tv-xac-nhan'), { clip: dialog(page), marks: [{ el: btn(dialog(page), /xóa khỏi nhóm|xoá khỏi nhóm/i).last(), label: 3 }] });
    await closeDlg(page);
  }

  // ---------------- MA TRẬN PHÂN QUYỀN ----------------
  if (on('prm')) {
    console.log('# Ma trận phân quyền');
    await page.setViewportSize({ width: 1600, height: 1000 });
    await go(page, 'permission-matrix', 3500);
    // Bố cục cố định ở cửa sổ 1600×1000 → đánh dấu theo vùng
    await shot(page, F('prm-tong-quan'), {
      marks: [{ el: { x: 286, y: 172, width: 336, height: 806 }, label: '(1) Danh sách nhóm', pos: 'inside', pad: 0 },
              { el: { x: 646, y: 172, width: 930, height: 76 }, label: '(2) Nhóm đang chọn, bộ đếm, nút Lưu', align: 'left', pad: 0 },
              { el: { x: 660, y: 252, width: 900, height: 44 }, label: '(3) Tìm kiếm, lọc, mở rộng', pos: 'bottom', pad: 0 },
              { el: { x: 646, y: 312, width: 930, height: 640 }, label: '(4) Cây chức năng / quyền / phạm vi', pos: 'bottom', pad: 0 }],
    });
    const card = page.getByRole('button', { name: /\d+\/\d+\s*$/ }).filter({ has: page.getByText(D.role.name, { exact: true }) }).first();
    await card.scrollIntoViewIfNeeded(); await card.click(); await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Mở rộng tất cả' }).click(); await page.waitForTimeout(600);
    const fnBox = (name) => page.locator(`input[aria-label="Cấp tất cả quyền của ${name}"]`).locator('xpath=..');
    const fnBlock = (name) => page.locator(`input[aria-label="Cấp tất cả quyền của ${name}"]`).locator('xpath=ancestor::div[contains(@class,"grid")][1]/..');
    const act = (f, a) => fnBlock(f).locator(`input[aria-label="${a}"]`).locator('xpath=..');
    await act('Quản lý người dùng', 'Xem').click(); await page.waitForTimeout(300);
    await act('Quản lý người dùng', 'Sửa').click(); await page.waitForTimeout(300);
    const scopeSel = fnBlock('Quản lý người dùng').locator('input[aria-label="Phạm vi · Sửa"]').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
    await scopeSel.click(); await page.waitForTimeout(600);
    await shot(page, F('prm-cap-quyen'), { keepMouse: true,
      marks: [{ el: card, label: 1 }, { el: act('Quản lý người dùng', 'Xem'), label: 3 }, { el: act('Quản lý người dùng', 'Sửa'), label: 3 },
              { el: page.locator('.ant-select-dropdown:visible').last(), label: 4 }, { el: page.getByRole('button', { name: 'Lưu', exact: true }), label: 5 }],
    });
    await page.locator('.ant-select-dropdown:visible').last().getByText('Toàn hệ thống', { exact: true }).click(); await page.waitForTimeout(400);
    await shot(page, F('prm-cap-quyen-zoom'), { clip: fnBlock('Quản lý người dùng'),
      marks: [{ el: fnBox('Quản lý người dùng'), label: 'Cấp tất cả' }, { el: scopeSel, label: 4 }] });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await page.waitForTimeout(2500);
    // Hủy quyền
    await act('Quản lý người dùng', 'Sửa').click(); await page.waitForTimeout(400);
    await shot(page, F('prm-huy-quyen'), { clip: { x: 245, y: 60, width: 1355, height: 620 },
      marks: [{ el: act('Quản lý người dùng', 'Sửa'), label: 2 }, { el: page.getByRole('button', { name: 'Lưu', exact: true }), label: 3 },
              { el: page.getByRole('button', { name: 'Hủy thay đổi' }), label: 'Bỏ thay đổi chưa lưu', align: 'left' }] });
    await page.getByRole('button', { name: 'Hủy thay đổi' }).click(); await page.waitForTimeout(800);
    // Tìm chức năng
    await page.getByPlaceholder('Tìm chức năng hoặc quyền').fill('đơn vị'); await page.waitForTimeout(800);
    await shot(page, F('prm-tim'), { clip: { x: 245, y: 60, width: 1355, height: 700 }, marks: [{ el: page.getByPlaceholder('Tìm chức năng hoặc quyền'), label: 1 }] });
    await api('PUT', `idm/permission-matrix/roles/${D.role.id}`, { permissions: [] });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  // ---------------- TỈNH / XÃ / LOẠI ĐƠN VỊ ----------------
  const catalogs = [
    { k: 'prv', route: 'provinces', menu: 'Đơn vị hành chính cấp tỉnh', ph: /tìm tỉnh\/thành/i, add: /thêm mới tỉnh/i, d: D?.prov,
      fill: async (d) => { await formItem(d, 'Mã tỉnh').locator('input').first().fill('25'); await formItem(d, 'Tên tỉnh').locator('input').first().fill('Tỉnh Phú Thọ'); },
      fields: ['Mã tỉnh', 'Tên tỉnh'], detail: 'qc_Thành phố Huế', addRef: /thêm mới đơn vị vào tỉnh/i, edit: /chỉnh sửa/i },
    { k: 'com', route: 'communes', menu: 'Đơn vị hành chính cấp xã', ph: /tìm theo mã, tên xã/i, add: /thêm mới xã/i, d: D?.com,
      fill: async (d, page) => { await formItem(d, 'Mã xã').locator('input').first().fill('00004'); await formItem(d, 'Tên xã').locator('input').first().fill('Phường Ba Đình'); await pick(page, d, 'Tỉnh/thành trực thuộc', 'qc_Thành phố Hà Nội'); },
      fields: ['Mã xã', 'Tên xã', 'Tỉnh/thành trực thuộc'], detail: 'Phường Cửa Nam', addRef: /thêm mới đơn vị vào xã/i, edit: /chỉnh sửa/i },
    { k: 'uty', route: 'unit-types', menu: 'Loại đơn vị', ph: /tìm theo mã, tên loại/i, add: /thêm mới loại/i, d: D?.type,
      fill: async (d, page) => { await formItem(d, 'Mã loại').locator('input').first().fill('UBND_XA'); await formItem(d, 'Tên loại').locator('input').first().fill('UBND cấp xã'); await pick(page, d, 'Cấp hành chính', 'Cấp xã'); await formItem(d, 'Mô tả').locator('textarea, input').first().fill('Ủy ban nhân dân xã/phường/đặc khu'); },
      fields: ['Mã loại', 'Tên loại', 'Cấp hành chính', 'Mô tả'], detail: 'Cấp Sở/Ban/Ngành', addRef: /thêm mới đơn vị/i, edit: /^\s*cập nhật\s*$/i },
  ];
  for (const c of catalogs) {
    if (!on(c.k)) continue;
    console.log('#', c.menu);
    await go(page, c.route, 2500); await hideJunk(page);
    const filt = main(page).locator('.ant-select').filter({ hasText: /^Tất cả/ });
    await shot(page, F(`${c.k}-ds`), {
      marks: [{ el: sideItem(page, c.menu), label: 1 }, { el: page.getByPlaceholder(c.ph), label: 2 },
              ...((await filt.count()) ? [{ el: filt.first(), label: 2 }] : []),
              { el: btn(page, /xuất excel/i).first(), label: 'Xuất Excel', align: 'left' }],
    });
    await shot(page, F(`${c.k}-them-nut`), { clip: header(page), marks: [{ el: btn(page, c.add), label: 1 }] });
    await btn(page, c.add).click(); await page.waitForTimeout(1200);
    let d = dialog(page);
    await c.fill(d, page); await page.waitForTimeout(400);
    await shot(page, F(`${c.k}-them-form`), { clip: d, marks: [...c.fields.map(f => ({ el: formItem(d, f), label: 2 })), { el: btn(d, /thêm/i).last(), label: 3 }] });
    await closeDlg(page);
    // Menu thao tác (bản ghi minh họa) + xác nhận xóa
    await search(page, c.ph, c.d.code);
    const row = dataRows(page).filter({ hasText: c.d.code }).first();
    await rowMenu(page, row);
    await shot(page, F(`${c.k}-menu`), { clip: { x: 245, y: 150, width: 1195, height: 380 }, keepMouse: true,
      marks: [{ el: row.locator('button.ant-dropdown-trigger').first(), label: 1 }, { el: menuItem(page, /cập nhật/i), label: 2 }] });
    await menuItem(page, /cập nhật/i).click(); await page.waitForTimeout(1200);
    d = dialog(page);
    await shot(page, F(`${c.k}-sua-form`), { clip: d, marks: [{ el: btn(d, /^\s*(Lưu|Cập nhật)/).last(), label: 4 }] });
    await closeDlg(page);
    await rowMenu(page, dataRows(page).filter({ hasText: c.d.code }).first());
    if (await menuItem(page, /xo[áa]/i).count()) {
      await menuItem(page, /xo[áa]/i).click(); await page.waitForTimeout(900);
      await shot(page, F(`${c.k}-xoa-xac-nhan`), { clip: dialog(page) });
      await closeDlg(page);
    } else await page.keyboard.press('Escape');
    // Chi tiết (bản ghi có sẵn, chỉ xem)
    await search(page, c.ph, c.detail);
    await dataRows(page).filter({ hasText: c.detail }).first().getByText('Xem chi tiết').click(); await page.waitForTimeout(2000);
    await hideJunk(page);
    await shot(page, F(`${c.k}-chi-tiet`), {
      marks: [{ el: btn(page, c.edit).first(), label: c.k === 'uty' ? 'Cập nhật' : 'Chỉnh sửa', align: 'left' }, { el: btn(page, c.addRef).first(), label: 'Gán đơn vị' }],
    });
    await btn(page, c.addRef).first().click(); await page.waitForTimeout(1500);
    d = dialog(page);
    if (await d.count() && c.k !== 'uty') {
      await hideJunk(page);
      const r1 = d.locator('tbody tr').filter({ visible: true }).filter({ hasText: /qc\.automation|QCA|qc_/ }).first();
      await r1.locator('label, input[type=checkbox]').first().click().catch(() => {}); await page.waitForTimeout(300);
      await shot(page, F(`${c.k}-gan-don-vi`), { clip: d, marks: [{ el: r1.locator('td').first(), label: 2 }, { el: btn(d, /^\s*Lưu\s*$/), label: 3 }] });
    } else if (await d.count()) {
      await shot(page, F(`${c.k}-gan-don-vi`), { clip: d });
    }
    await closeDlg(page);
  }

  // ---------------- ĐƠN VỊ ----------------
  if (on('org')) {
    console.log('# Đơn vị');
    await go(page, 'organizations', 2500); await hideJunk(page);
    await shot(page, F('org-ds'), {
      marks: [{ el: sideItem(page, 'Đơn vị'), label: 1 }, { el: page.getByPlaceholder(/tìm theo tên, mã đơn vị/i), label: 2 },
              { el: main(page).locator('.ant-select').filter({ hasText: 'Tất cả loại' }).first(), label: 2 },
              { el: main(page).locator('.ant-select').filter({ hasText: 'Tất cả tỉnh' }).first(), label: 2 },
              { el: btn(page, /xuất excel/i).first(), label: 'Xuất Excel', align: 'left' }],
    });
    await shot(page, F('org-them-nut'), { clip: header(page), marks: [{ el: btn(page, /thêm mới đơn vị/i), label: 1 }] });
    await btn(page, /thêm mới đơn vị/i).click(); await page.waitForTimeout(1200);
    let d = dialog(page);
    await formItem(d, 'Mã đơn vị').locator('input').first().fill('STTTT_HN');
    await formItem(d, 'Tên đơn vị').locator('input').first().fill('Sở Khoa học và Công nghệ Hà Nội');
    await pick(page, d, 'Loại đơn vị', 'Cấp Sở/Ban/Ngành');
    await pick(page, d, 'Đơn vị hành chính cấp tỉnh', 'qc_Thành phố Hà Nội');
    await formItem(d, 'Địa chỉ').locator('input, textarea').first().fill('Số 1 Đường A, Hà Nội');
    await formItem(d, 'Email').locator('input').first().fill('skhcn@hanoi.gov.vn');
    await page.waitForTimeout(400);
    await shot(page, F('org-them-form'), {
      clip: d,
      marks: [{ el: d.getByText('THÔNG TIN ĐƠN VỊ').locator('xpath=..'), label: 2, pos: 'inside' },
              { el: d.getByText('THAM CHIẾU HÀNH CHÍNH').locator('xpath=..'), label: 3, pos: 'inside' },
              { el: formItem(d, 'Địa chỉ'), label: 4 },
              { el: btn(d, /thêm mới đơn vị/i).last(), label: 5 }],
    });
    await closeDlg(page);
    await search(page, /tìm theo tên, mã đơn vị/i, D.org.code);
    let row = dataRows(page).filter({ hasText: D.org.code }).first();
    await rowMenu(page, row);
    await shot(page, F('org-menu'), { clip: { x: 245, y: 150, width: 1195, height: 380 }, keepMouse: true,
      marks: [{ el: row.locator('button.ant-dropdown-trigger').first(), label: 1 }, { el: menuItem(page, /^\s*kho[áa]/i), label: 2 }] });
    await menuItem(page, /cập nhật/i).click(); await page.waitForTimeout(1200);
    await shot(page, F('org-sua-form'), { clip: dialog(page), marks: [{ el: btn(dialog(page), /^\s*(Lưu|Cập nhật)/).last(), label: 4 }] });
    await closeDlg(page);
    await rowMenu(page, dataRows(page).filter({ hasText: D.org.code }).first());
    await menuItem(page, /xo[áa]/i).click(); await page.waitForTimeout(900);
    await shot(page, F('org-xoa-xac-nhan'), { clip: dialog(page) });
    await closeDlg(page);
    // Khoá thật trên đơn vị minh họa → chụp trạng thái → Mở khoá
    await rowMenu(page, dataRows(page).filter({ hasText: D.org.code }).first());
    await menuItem(page, /^\s*kho[áa]/i).click(); await page.waitForTimeout(900);
    await shot(page, F('org-khoa-xac-nhan'), { clip: dialog(page), marks: [{ el: dialog(page).getByRole('button').filter({ hasText: /^\s*(Có|Khoá|Khóa|Xác nhận)\s*$/ }).last(), label: 3 }] });
    await dialog(page).getByRole('button').filter({ hasText: /^\s*(Có|Khoá|Khóa|Xác nhận)\s*$/ }).last().click(); await page.waitForTimeout(1500);
    await rowMenu(page, dataRows(page).filter({ hasText: D.org.code }).first());
    await shot(page, F('org-da-khoa'), { clip: { x: 245, y: 60, width: 1195, height: 420 }, keepMouse: true, marks: [{ el: menuItem(page, /mở kho[áa]/i), label: 'Mở khoá' }] });
    await menuItem(page, /mở kho[áa]/i).click(); await page.waitForTimeout(900);
    const yes = dialog(page).getByRole('button').filter({ hasText: /^\s*(Có|Mở khoá|Mở khóa|Xác nhận)\s*$/ });
    if (await yes.count()) { await yes.last().click(); await page.waitForTimeout(1500); }
    // Chi tiết đơn vị minh họa
    await dataRows(page).filter({ hasText: D.org.code }).first().getByText('Xem chi tiết').click(); await page.waitForTimeout(2000);
    await shot(page, F('org-chi-tiet'), {
      marks: [{ el: btn(page, /thêm người dùng vào đơn vị/i), label: 'Thêm người dùng' }, { el: btn(page, /đổi tỉnh/i), label: 'Đổi tỉnh', align: 'left', pos: 'bottom' },
              { el: btn(page, /bỏ tham chiếu/i), label: 'Bỏ tham chiếu', pos: 'bottom' }],
    });
    await btn(page, /thêm người dùng vào đơn vị/i).click(); await page.waitForTimeout(1500);
    d = dialog(page); await hideJunk(page);
    // Tích người dùng chọn được đầu tiên (chỉ để chụp, không Lưu)
    const cand = d.locator('tbody tr.ant-table-row').filter({ has: page.locator('input[type=checkbox]:not([disabled])') }).first();
    await cand.locator('input[type=checkbox]').first().check({ force: true }).catch(() => {}); await page.waitForTimeout(300);
    await shot(page, F('org-them-nd'), { clip: d, marks: [{ el: cand.locator('td').first(), label: 2 }, { el: btn(d, /^\s*Lưu\s*$/), label: 3 }] });
    await closeDlg(page);
    await btn(page, /đổi tỉnh/i).click(); await page.waitForTimeout(1200);
    await shot(page, F('org-doi-tinh'), { clip: dialog(page), marks: [{ el: dialog(page).locator('.ant-select').first(), label: 2 }, { el: btn(dialog(page), /^\s*Lưu\s*$/), label: 3 }] });
    await closeDlg(page);
    const urow = dataRows(page).filter({ hasText: D.u1.userName }).first();
    if (await urow.count()) {
      await urow.locator('label').first().click(); await page.waitForTimeout(500);
      await shot(page, F('org-xoa-nd'), { clip: main(page), marks: [{ el: urow.locator('td').first(), label: 1 }, { el: btn(page, /xóa \d+ đã chọn|xoá \d+ đã chọn/i).first(), label: 2 }] });
      await btn(page, /xóa \d+ đã chọn|xoá \d+ đã chọn/i).first().click(); await page.waitForTimeout(900);
      if (await dialog(page).count()) { await shot(page, F('org-xoa-nd-xac-nhan'), { clip: dialog(page) }); await closeDlg(page); }
    }
    await btn(page, /bỏ tham chiếu/i).click(); await page.waitForTimeout(900);
    if (await dialog(page).count()) { await shot(page, F('org-bo-tham-chieu'), { clip: dialog(page) }); await closeDlg(page); }
  }

  // ---------------- THAM SỐ HỆ THỐNG (chỉ xem) ----------------
  if (on('cfg')) {
    console.log('# Tham số hệ thống');
    await go(page, 'system-config', 3000);
    await shot(page, F('cfg-bao-mat'), {
      marks: [{ el: sideItem(page, 'Tham số hệ thống'), label: 1 }, { el: page.getByText('Bảo mật tài khoản', { exact: true }).first(), label: 2 },
              { el: btn(page, /lưu thay đổi/i), label: 4 }],
    });
    await shot(page, F('cfg-bao-mat-full'), { full: true });
    await page.getByText('Minh chứng', { exact: true }).first().click(); await page.waitForTimeout(1500);
    await shot(page, F('cfg-minh-chung'), { marks: [{ el: page.getByText('Minh chứng', { exact: true }).first(), label: 2 }] });
  }
} catch (e) {
  console.error('LỖI:', e.message.split('\n')[0]);
  await page.screenshot({ path: 'hdsd/out/probe-a/_loi.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await cleanup();
  await closeAll();
}
