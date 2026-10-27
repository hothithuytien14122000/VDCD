// Chạy toàn bộ testcase của 1 phân hệ, đo thời gian thực thi (wall-clock), ghi kết quả vào results/<thời điểm>/ rồi dọn dữ liệu thử.
// Dùng: node testcases/tools/run-phan-he.mjs <A|B|C> [số worker, mặc định 1]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const PH = {
  A: { ten: 'Phân hệ A — Quản trị hệ thống', dir: 'scripts/A', only: 'USR,GRP,PRV,COM,UTY,ORG' },
  B: { ten: 'Phân hệ B — Bộ chỉ số DTI', dir: 'scripts/B', only: 'PIL,IGR,IND,SET,SCL,CMP' },
  C: { ten: 'Phân hệ C — Đánh giá CĐS', dir: 'scripts/C', only: 'RES' },
};
const k = (process.argv[2] || '').toUpperCase(); const p = PH[k];
if (!p) { console.error('Dùng: run-phan-he.mjs <A|B|C> [workers]'); process.exit(1); }
const workers = process.argv[3] || '1';
const raw = `results/_raw-${k}.json`; fs.mkdirSync('results', { recursive: true });
const t0 = Date.now();
spawnSync('npx', ['playwright', 'test', '--project=superadmin', p.dir, `--workers=${workers}`, '--reporter=list,json'], { stdio: 'inherit', env: { ...process.env, RUN_WRITE: '1', PLAYWRIGHT_JSON_OUTPUT_NAME: raw } });
const giay = Math.round((Date.now() - t0) / 1000);
const rep = spawnSync('node', ['testcases/tools/report.mjs', raw], { encoding: 'utf8', env: { ...process.env, ONLY: p.only } });
process.stdout.write(rep.stdout);
const out = rep.stdout.match(/→ (results\/\S+)/)?.[1];
const hms = s => `${Math.floor(s / 3600)} giờ ${Math.floor(s % 3600 / 60)} phút ${s % 60} giây`;
if (out) {
  fs.appendFileSync(`${out}/tong-hop.md`, `\n## Thời gian thực thi\n\n- ${p.ten}: **${hms(giay)}** (${giay}s), ${workers} worker\n`);
  fs.writeFileSync(`${out}/thoi-gian.json`, JSON.stringify({ phan_he: k, ten: p.ten, giay, workers: Number(workers) }, null, 1));
  fs.renameSync(raw, `${out}/raw-playwright.json`);
}
console.log(`\nTHỜI GIAN ${p.ten}: ${hms(giay)} (${giay}s)`);
spawnSync('node', ['cleanup-all.mjs'], { stdio: 'inherit' });
spawnSync('node', ['testcases/tools/build-yaml.mjs'], { stdio: 'ignore' });
