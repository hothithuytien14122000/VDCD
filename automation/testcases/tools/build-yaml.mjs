// Sinh testcases/TestCase/<Phân hệ>/<slug>.yaml từ catalog.json (+ kết quả chạy nếu có). Phân hệ = thư mục của scripts/ (A, B, C, Auth)
import fs from 'node:fs';
const T = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8'));
const runs = fs.existsSync('results') ? fs.readdirSync('results').filter(d => /^\d{4}-/.test(d)).sort() : [];   // lần chạy mới nhất
const status = runs.length ? JSON.parse(fs.readFileSync(`results/${runs.at(-1)}/status.json`, 'utf8')) : {};
const PAGE = { USR: 'Người dùng', GRP: 'Nhóm người dùng', PRM: 'Ma trận phân quyền', PRV: 'Đơn vị hành chính cấp tỉnh', COM: 'Đơn vị hành chính cấp xã', UTY: 'Loại đơn vị', ORG: 'Đơn vị', PIL: 'Trụ cột', IGR: 'Nhóm chỉ số', IND: 'Chỉ số', SET: 'Bộ chỉ số', SCL: 'Thang xếp loại', RES: 'Kết quả tự đánh giá', CMP: 'Quản lý tự đánh giá', LGN: 'Đăng nhập', RPW: 'Quên mật khẩu', CPW: 'Đổi mật khẩu', LGO: 'Đăng xuất' };
const q = s => JSON.stringify(String(s ?? ''));
const lines = s => String(s ?? '').split('\n').map(x => x.trim()).filter(Boolean);
// Tên file theo tiếng Việt không dấu, khớp tên file script trong scripts/<Phân hệ>/
const SLUG = { USR: 'nguoi-dung', GRP: 'nhom-nguoi-dung', PRM: 'ma-tran-phan-quyen', PRV: 'don-vi-hanh-chinh-cap-tinh', COM: 'don-vi-hanh-chinh-cap-xa', UTY: 'loai-don-vi', ORG: 'don-vi', PIL: 'tru-cot', IGR: 'nhom-chi-so', IND: 'chi-so', SET: 'bo-chi-so', SCL: 'thang-xep-loai', CMP: 'quan-ly-tu-danh-gia', RES: 'ket-qua-tu-danh-gia', LGN: 'dang-nhap', RPW: 'quen-mat-khau', CPW: 'doi-mat-khau', LGO: 'dang-xuat' };
const GROUP = k => (['LGN', 'RPW', 'CPW', 'LGO'].includes(k) ? 'Auth' : ['RES'].includes(k) ? 'C' : ['PIL', 'IGR', 'IND', 'SET', 'SCL', 'CMP'].includes(k) ? 'B' : 'A');
const PHAN_HE = { Auth: 'AUTH - Xác thực', C: 'C - Đánh giá CĐS', B: 'B - Bộ chỉ số DTI', A: 'A - Quản trị hệ thống' };
for (const [k, name] of Object.entries(PAGE)) {
  const dir = `testcases/TestCase/${GROUP(k)}`; fs.mkdirSync(dir, { recursive: true });
  const s = T.filter(x => x.id.startsWith(k + '-'));
  let y = `title: ${q(name)}\nphan_he: ${q(PHAN_HE[GROUP(k)])}\ntong_so: ${s.length}\ntestcases:\n`;
  for (const x of s) {
    y += `  - id: ${x.id}\n    title: ${q(x.title)}\n    uc: ${q(x.uc)}\n    tac_nhan: ${q(x.actor)}\n    tai_khoan_chay: ${q(x.account ?? 'không đăng nhập')}\n    chuc_nang: ${q(x.fn)}\n    loai: ${q(x.type)}\n    uu_tien: ${q(x.pri)}\n    automation: ${q(x.auto)}\n`;
    y += `    cac_buoc:\n${lines(x.steps).map(l => `      - ${q(l)}`).join('\n')}\n`;
    y += `    ket_qua_mong_doi:\n${lines(x.exp).map(l => `      - ${q(l)}`).join('\n')}\n`;
    if (x.note) y += `    ghi_chu: ${q(x.note)}\n`;
    if (status[x.id]) y += `    ket_qua_chay: ${q(status[x.id])}\n`;
  }
  fs.writeFileSync(`${dir}/${SLUG[k]}.yaml`, y);
  console.log(`${dir}/${SLUG[k]}.yaml`, s.length);
}
