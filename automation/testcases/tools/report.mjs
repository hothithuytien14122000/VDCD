// Gộp kết quả Playwright (JSON) với catalog → results/<thời điểm chạy>/ (YAML mỗi page + tổng hợp)
// Dùng: node testcases/tools/report.mjs <playwright.json>   (npm run report)
import fs from 'node:fs';
import cfg from '../../accounts.mjs';
const ONLY = process.env.ONLY?.split(',');   // vd ONLY=LGN,RPW: chỉ báo cáo các page này
const T = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8')).filter(x => !ONLY || ONLY.includes(x.id.split('-')[0]));
const src = process.argv[2] || 'results/_raw.json';
const R = JSON.parse(fs.readFileSync(src, 'utf8'));
const PAGE = { USR: 'Người dùng', GRP: 'Nhóm người dùng', PRV: 'Đơn vị hành chính cấp tỉnh', COM: 'Đơn vị hành chính cấp xã', UTY: 'Loại đơn vị', ORG: 'Đơn vị', PIL: 'Trụ cột', IGR: 'Nhóm chỉ số', IND: 'Chỉ số', SET: 'Bộ chỉ số', SCL: 'Thang xếp loại', RES: 'Kết quả tự đánh giá', CMP: 'Quản lý tự đánh giá', LGN: 'Đăng nhập', RPW: 'Quên mật khẩu', CPW: 'Đổi mật khẩu', LGO: 'Đăng xuất' };
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
const rows = T.map(x => {
  const r = res[x.id];
  return { ...x, status: r ? r.status : (x.auto === 'Auto' ? 'Không chạy' : 'Manual'), err: r?.err ?? '', ms: r?.ms ?? 0 };
});
const cnt = (a, s) => a.filter(x => x.status === s).length;
const started = new Date(R.stats?.startTime ?? Date.now());
const stamp = new Date(started.getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', '_').replace(':', 'h'); // giờ VN
const out = `results/${stamp}`; fs.mkdirSync(out, { recursive: true });
const tot = a => ({ tong: a.length, pass: cnt(a, 'Pass'), fail: cnt(a, 'Fail'), manual: cnt(a, 'Manual'), skipped: cnt(a, 'Skipped') + cnt(a, 'Không chạy'), thoi_gian_giay: Math.round(a.reduce((n, x) => n + x.ms, 0) / 1000) });
let sum = `# Kết quả chạy testcase — ${stamp}\n\nMôi trường: ${cfg.baseURL}  \nTổng: **${rows.length}** — Pass **${cnt(rows, 'Pass')}**, Fail **${cnt(rows, 'Fail')}**, Manual **${cnt(rows, 'Manual')}**, Skipped **${cnt(rows, 'Skipped') + cnt(rows, 'Không chạy')}**. Thời gian chạy: **${Math.round((R.stats?.duration ?? 0) / 1000)}s**.\n\n| Page | Tổng | Pass | Fail | Manual | Skipped | Thời gian (s) |\n|---|---|---|---|---|---|---|\n`;
for (const [k, name] of Object.entries(PAGE)) {
  const s = rows.filter(x => x.id.startsWith(k + '-')); const t = tot(s);
  sum += `| ${name} | ${t.tong} | ${t.pass} | ${t.fail} | ${t.manual} | ${t.skipped} | ${t.thoi_gian_giay} |\n`;
  let y = `title: ${q(name)}\nngay_chay: ${q(stamp)}\nmoi_truong: ${q(cfg.baseURL)}\ntong_hop:\n${Object.entries(t).map(([a, b]) => `  ${a}: ${b}`).join('\n')}\nket_qua:\n`;
  for (const x of s) {
    y += `  - id: ${x.id}\n    title: ${q(x.title)}\n    trang_thai: ${q(x.status)}\n    thoi_gian_ms: ${x.ms}\n`;
    if (x.err) y += `    loi: ${q(x.err)}\n`;
    if (x.status === 'Fail' && x.note) y += `    ghi_chu: ${q(x.note)}\n`;
  }
  fs.mkdirSync(`${out}/${name}`, { recursive: true }); fs.writeFileSync(`${out}/${name}/${name}.yaml`, y);
}
sum += '\n## Testcase FAIL (nghi lỗi sản phẩm / cần xác nhận)\n\n| ID | Page | Tiêu đề | Chi tiết | Ghi chú |\n|---|---|---|---|---|\n';
for (const x of rows.filter(x => x.status === 'Fail')) sum += `| ${x.id} | ${PAGE[x.id.split('-')[0]]} | ${x.title} | ${x.err.replace(/\|/g, '/')} | ${(x.note || '').replace(/\n/g, ' ')} |\n`;
sum += '\n## Manual / không chạy\n\n';
for (const x of rows.filter(x => ['Manual', 'Không chạy', 'Skipped'].includes(x.status))) sum += `- **${x.id}** (${x.status}) ${x.title} — ${x.note || ''}\n`;
fs.writeFileSync(`${out}/tong-hop.md`, sum);
const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync(`${out}/ket-qua.csv`, '﻿' + [['ID', 'Page', 'Tiêu đề', 'Loại', 'Ưu tiên', 'Kết quả', 'Thời gian (ms)', 'Chi tiết lỗi'], ...rows.map(x => [x.id, PAGE[x.id.split('-')[0]], x.title, x.type, x.pri, x.status, x.ms, x.err])].map(r => r.map(esc).join(',')).join('\r\n'));
fs.writeFileSync(`${out}/status.json`, JSON.stringify(Object.fromEntries(rows.map(x => [x.id, x.status])), null, 1));
console.log(sum.split('\n').slice(0, 14).join('\n')); console.log('→', out);
