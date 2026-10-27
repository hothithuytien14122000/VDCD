import fs from 'node:fs';
import T from '../docs/catalog.mjs';
import { actorOf } from '../docs/actors.mjs';
const ids = new Set(); for (const x of T) { if (ids.has(x.id)) throw new Error('Trùng ID ' + x.id); ids.add(x.id); }
for (const x of T) { const a = actorOf(x); x.actor = a.label; x.account = a.key; }
fs.writeFileSync('testcases/docs/catalog.json', JSON.stringify(T, null, 1));
const PAGE = { USR: 'Người dùng', GRP: 'Nhóm người dùng', PRV: 'Đơn vị hành chính cấp tỉnh', COM: 'Đơn vị hành chính cấp xã', UTY: 'Loại đơn vị', ORG: 'Đơn vị', PIL: 'Trụ cột', IGR: 'Nhóm chỉ số', IND: 'Chỉ số', SET: 'Bộ chỉ số', SCL: 'Thang xếp loại', RES: 'Kết quả tự đánh giá', CMP: 'Quản lý tự đánh giá', LGN: 'Đăng nhập', RPW: 'Quên mật khẩu', CPW: 'Đổi mật khẩu', LGO: 'Đăng xuất' };
const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
const head = ['ID', 'Page', 'UC (UC_1409)', 'Chức năng', 'Tiêu đề testcase', 'Loại', 'Ưu tiên', 'Các bước', 'Kết quả mong đợi', 'Automation', 'Ghi chú'];
const rows = T.map(x => [x.id, PAGE[x.id.split('-')[0]], x.uc, x.fn, x.title, x.type, x.pri, x.steps, x.exp, x.auto, x.note]);
let md = `# Bộ testcase Phân hệ A — 6 page quản trị\n\nTổng: **${T.length}** testcase.\n\n`;
md += '| Page | Tổng | Chức năng | Validate | Nghiệp vụ | Bảo mật | Hiệu năng | UI | Auto | Manual |\n|---|---|---|---|---|---|---|---|---|---|\n';
for (const [k, v] of Object.entries(PAGE)) {
  const s = T.filter(x => x.id.startsWith(k + '-')); const c = ty => s.filter(x => x.type === ty).length;
  md += `| ${v} | ${s.length} | ${c('Chức năng')} | ${c('Validate')} | ${c('Nghiệp vụ')} | ${c('Bảo mật')} | ${c('Hiệu năng')} | ${c('UI')} | ${s.filter(x => x.auto === 'Auto').length} | ${s.filter(x => x.auto !== 'Auto').length} |\n`;
}
for (const [k, v] of Object.entries(PAGE)) {
  md += `\n## ${v}\n\n| ID | UC | Tiêu đề | Loại | Ưu tiên | Kết quả mong đợi |\n|---|---|---|---|---|---|\n`;
  for (const x of T.filter(x => x.id.startsWith(k + '-'))) md += `| ${x.id} | ${x.uc} | ${x.title} | ${x.type} | ${x.pri} | ${x.exp.replace(/\n/g, ' ')} |\n`;
}

console.log('OK', T.length, 'testcase');
for (const k of Object.keys(PAGE)) console.log(' ', k, T.filter(x => x.id.startsWith(k + '-')).length);
