// Kiểm tra truy vết: yêu cầu → điều kiện → testcase.  node testcases/tools/trace-check.mjs
import fs from 'node:fs';
import REQ from '../docs/requirements.mjs';
const T = JSON.parse(fs.readFileSync('testcases/docs/catalog.json', 'utf8'));
const ids = T.map(x => x.id); const used = new Set(); const gaps = [];
let nCond = 0;
for (const r of REQ) for (const [cond, pat] of r.conds) {
  nCond++;
  const re = new RegExp(`^(${pat})$`); const hit = ids.filter(i => re.test(i));
  hit.forEach(i => used.add(i));
  if (!hit.length) gaps.push(`${r.page} ${r.uc} (dòng ${r.row}) — ${cond}   [mong đợi ${pat}]`);
}
const orphan = ids.filter(i => !used.has(i));
console.log(`Yêu cầu: ${REQ.length} | điều kiện: ${nCond} | testcase: ${ids.length}`);
console.log(gaps.length ? `\nĐIỀU KIỆN CHƯA CÓ TESTCASE (${gaps.length}):\n - ` + gaps.join('\n - ') : '\nMọi điều kiện đều có testcase');
console.log(orphan.length ? `\nTESTCASE KHÔNG THUỘC ĐIỀU KIỆN NÀO (${orphan.length}): ${orphan.join(', ')}` : '\nKhông có testcase mồ côi');
process.exitCode = gaps.length || orphan.length ? 1 : 0;
