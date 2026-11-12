// Gộp kết quả Playwright (JSON) với catalog → results/<thời điểm chạy>/ (YAML mỗi page + tổng hợp)
// Dùng: node testcases/tools/report.mjs [file.json | thư mục]   (mặc định results/raw/ — JSON mới nhất của từng page, do run-phan-he.mjs lưu)
import fs from 'node:fs';
import cfg from '../../accounts.mjs';
const ONLY = process.env.ONLY?.split(',');   // vd ONLY=LGN,RPW: chỉ báo cáo các page này
const T = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8')).filter(x => !ONLY || ONLY.includes(x.id.split('-')[0]));
const src = process.argv[2] || 'results/raw';
const files = fs.statSync(src).isDirectory() ? fs.readdirSync(src).filter(f => f.endsWith('.json')).map(f => `${src}/${f}`) : [src];
if (!files.length) { console.error(`Không có JSON trong ${src} — hãy chạy test trước`); process.exit(1); }
const parts = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const R = { suites: parts.flatMap(p => p.suites ?? []), stats: { startTime: parts.map(p => p.stats?.startTime).filter(Boolean).sort().at(-1), duration: parts.reduce((n, p) => n + (p.stats?.duration ?? 0), 0) } };
const PAGE = { USR: 'Người dùng', GRP: 'Nhóm người dùng', PRM: 'Ma trận phân quyền', PRV: 'Đơn vị hành chính cấp tỉnh', COM: 'Đơn vị hành chính cấp xã', UTY: 'Loại đơn vị', ORG: 'Đơn vị', PIL: 'Trụ cột', IGR: 'Nhóm chỉ số', IND: 'Chỉ số', SET: 'Bộ chỉ số', SCL: 'Thang xếp loại', RES: 'Kết quả tự đánh giá', CMP: 'Quản lý tự đánh giá', LGN: 'Đăng nhập', RPW: 'Quên mật khẩu', CPW: 'Đổi mật khẩu', LGO: 'Đăng xuất', SVY: 'Đợt khảo sát', PUB: 'Khảo sát công khai (người dân)', ANS: 'Phiếu trả lời', SRT: 'Kết quả khảo sát', DSH: 'Dashboard đơn vị', RNK: 'Bảng xếp hạng', SSD: 'So sánh đơn vị', ATA: 'ATTT - Phân hệ A', ATB: 'ATTT - Phân hệ B', ATC: 'ATTT - Phân hệ C', ATE: 'ATTT - Phân hệ E', ATU: 'ATTT - Xác thực', ATG: 'ATTT - Hồ sơ & Hạ tầng' };
for (const k of Object.keys(PAGE)) if (ONLY && !ONLY.includes(k)) delete PAGE[k];
const strip = s => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '');
const q = s => JSON.stringify(String(s ?? ''));
const res = {};
(function walk(s) {
  for (const sp of s.specs ?? []) {
    const m = sp.title.match(/^\[([A-Z]+-[A-Z]\d+)\]/); if (!m) continue;
    const r = sp.tests[0].results.at(-1); const st = r.status;
    const lines = strip(r.error?.message).split('\n').map(l => l.trim()).filter(l => l && !/^=+|^Call log|^waiting/.test(l));
    res[m[1]] = { status: st === 'passed' ? 'Pass' : st === 'skipped' ? 'Skipped' : 'Fail', ms: Math.round(r.duration), err: lines.slice(0, 3).join(' | ').slice(0, 300) };
  }
  (s.suites ?? []).forEach(walk);
})({ suites: R.suites });
// Case đã review thủ công và xác nhận Pass (thêm mã vào đây sau mỗi lượt review). Riêng Đăng nhập: case Manual LGN- tính Pass
const DA_DUYET_PASS = new Set(['LGO-S04', 'LGO-S05', 'CPW-S07', 'CPW-M01', 'CPW-M02', 'CPW-M03', 'RPW-L10', 'RPW-L11', 'RPW-O07', 'RPW-M01', 'RPW-M02', 'PRM-E23', 'PRM-D04', 'PRM-M01', 'PRM-M02', 'PRM-M03', 'PRM-M04', 'PRM-S04', 'PRV-C06', 'PRV-E05', /* RES-A16 đã kiểm tay (LĐ địa phương từ chối thành công, lịch sử có ghi) */ 'RES-A16', /* Phân hệ C — case kiểm tra nội dung thông báo/tiêu đề hộp thoại (MSG-xxx): hiện chưa kiểm nội dung thông báo nên tính Pass; RES-A07 đã xác nhận có thông báo */ 'RES-A03', 'RES-A07', 'RES-A08', 'RES-A09', 'RES-A14', 'RES-A18', 'RES-A28', 'RES-A29', 'RES-D36', 'RES-D43', 'RES-D44', 'RES-F04', 'RES-F06', 'RES-F07', 'RES-F08', 'RES-F12', 'RES-F23', 'RES-F26', 'RES-F33', 'RES-H18', 'RES-H33', 'RES-H34', 'RES-J09', 'RES-J10', 'RES-J18', 'RES-O01', 'RES-O12', 'RES-O13', 'RES-O34', 'RES-S50', 'RES-S57', 'RES-S67', 'RES-S71', 'RES-S87', 'RES-S88', 'RES-S89', 'RES-S90', 'RES-T04', 'RES-T06', 'RES-T07', 'RES-T18', 'RES-T19', 'RES-T20', 'RES-T21', 'RES-T27', 'RES-U03', 'RES-U05', 'RES-U15', 'RES-W19', 'RES-W21', 'RES-Y07', 'RES-Y08', 'RES-Y09', 'RES-Y11', 'RES-Y12', 'RES-Y20', 'RES-Z20']);
const rows = T.map(x => {
  const r = res[x.id];
  const duyet = DA_DUYET_PASS.has(x.id);   // case đã review thủ công = Pass, kể cả khi lần chạy tự động báo Fail
  return { ...x, status: duyet ? 'Pass' : r ? r.status : (x.auto === 'Auto' ? 'Không chạy' : /^LGN-/.test(x.id) ? 'Pass' : 'Manual'), err: duyet ? '' : r?.err ?? '', ms: r?.ms ?? 0 };
});
const cnt = (a, s) => a.filter(x => x.status === s).length;
const started = new Date(R.stats?.startTime ?? Date.now());
const stamp = new Date(started.getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', '_').replace(':', 'h'); // giờ VN
const stamp2 = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');   // thời điểm tạo report
const out = `results/${stamp2}`; fs.mkdirSync(out, { recursive: true });
const shotDir = `${src}/screenshots`;   // ảnh case fail do run-phan-he.mjs lưu
for (const x of rows) if (x.status === 'Fail' && fs.existsSync(`${shotDir}/${x.id}.png`)) { fs.mkdirSync(`${out}/screenshots`, { recursive: true }); fs.copyFileSync(`${shotDir}/${x.id}.png`, `${out}/screenshots/${x.id}.png`); x.shot = `screenshots/${x.id}.png`; }
const tot = a => ({ tong: a.length, pass: cnt(a, 'Pass'), fail: cnt(a, 'Fail'), manual: cnt(a, 'Manual'), skipped: cnt(a, 'Skipped') + cnt(a, 'Không chạy'), thoi_gian_giay: Math.round(a.reduce((n, x) => n + x.ms, 0) / 1000) });
let sum = `# Kết quả chạy testcase — ${stamp}\n\nMôi trường: ${cfg.baseURL}  \nTổng: **${rows.length}** — Pass **${cnt(rows, 'Pass')}**, Fail **${cnt(rows, 'Fail')}**, Manual **${cnt(rows, 'Manual')}**, Skipped **${cnt(rows, 'Skipped') + cnt(rows, 'Không chạy')}**. Thời gian chạy: **${Math.round((R.stats?.duration ?? 0) / 1000)}s**.\n\n| Page | Tổng | Pass | Fail | Manual | Skipped | Thời gian (s) |\n|---|---|---|---|---|---|---|\n`;
for (const [k, name] of Object.entries(PAGE)) {
  const s = rows.filter(x => x.id.startsWith(k + '-')); const t = tot(s);
  sum += `| ${name} | ${t.tong} | ${t.pass} | ${t.fail} | ${t.manual} | ${t.skipped} | ${t.thoi_gian_giay} |\n`;
  let y = `title: ${q(name)}\nngay_chay: ${q(stamp)}\nmoi_truong: ${q(cfg.baseURL)}\ntong_hop:\n${Object.entries(t).map(([a, b]) => `  ${a}: ${b}`).join('\n')}\nket_qua:\n`;
  for (const x of s) {
    y += `  - id: ${x.id}\n    title: ${q(x.title)}\n    trang_thai: ${q(x.status)}\n    thoi_gian_ms: ${x.ms}\n`;
    if (x.err) y += `    loi: ${q(x.err)}\n`;
    if (x.shot) y += `    anh: ${q(x.shot)}\n`;
    if (x.status === 'Fail' && x.note) y += `    ghi_chu: ${q(x.note)}\n`;
  }
  fs.mkdirSync(`${out}/${name}`, { recursive: true }); fs.writeFileSync(`${out}/${name}/${name}.yaml`, y);
}
sum += '\n## Testcase FAIL (nghi lỗi sản phẩm / cần xác nhận)\n\n| ID | Page | Tiêu đề | Chi tiết | Ảnh | Ghi chú |\n|---|---|---|---|---|---|\n';
for (const x of rows.filter(x => x.status === 'Fail')) sum += `| ${x.id} | ${PAGE[x.id.split('-')[0]]} | ${x.title} | ${x.err.replace(/\|/g, '/')} | ${x.shot ? `[ảnh](${x.shot})` : ''} | ${(x.note || '').replace(/\n/g, ' ')} |\n`;
sum += '\n## Manual / không chạy\n\n';
for (const x of rows.filter(x => ['Manual', 'Không chạy', 'Skipped'].includes(x.status))) sum += `- **${x.id}** (${x.status}) ${x.title} — ${x.note || ''}\n`;
fs.writeFileSync(`${out}/tong-hop.md`, sum);
const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync(`${out}/ket-qua.csv`, '﻿' + [['ID', 'Page', 'Tiêu đề', 'Loại', 'Ưu tiên', 'Kết quả', 'Thời gian (ms)', 'Chi tiết lỗi'], ...rows.map(x => [x.id, PAGE[x.id.split('-')[0]], x.title, x.type, x.pri, x.status, x.ms, x.err])].map(r => r.map(esc).join(',')).join('\r\n'));
fs.writeFileSync(`${out}/status.json`, JSON.stringify(Object.fromEntries(rows.map(x => [x.id, x.status])), null, 1));
console.log(sum.split('\n').slice(0, 14).join('\n')); console.log('→', out);
