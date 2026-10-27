// Chạy testcase của 1 phân hệ (hoặc 1 page), lưu JSON mới nhất của từng page vào results/raw/<page>.json (+ ảnh case fail vào results/raw/screenshots/<ID>.png), rồi dọn dữ liệu thử.
// KHÔNG tạo report — khi cần chạy: npm run tc:report
// Dùng: node testcases/tools/run-phan-he.mjs <A|B|C> [số worker, mặc định 1] [slug page, vd nhom-nguoi-dung]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const PH = {
  A: { ten: 'Phân hệ A — Quản trị hệ thống', dir: 'scripts/A' },
  B: { ten: 'Phân hệ B — Bộ chỉ số DTI', dir: 'scripts/B' },
  C: { ten: 'Phân hệ C — Đánh giá CĐS', dir: 'scripts/C' },
};
const k = (process.argv[2] || '').toUpperCase(); const p = PH[k];
if (!p) { console.error('Dùng: run-phan-he.mjs <A|B|C> [workers] [slug page]'); process.exit(1); }
const workers = process.argv[3] || '1';
const target = process.argv[4] ? `${p.dir}/${process.argv[4]}.spec.ts` : p.dir;
const raw = `results/_raw-${k}.json`; const rawDir = 'results/raw'; fs.mkdirSync(`${rawDir}/screenshots`, { recursive: true });
const t0 = Date.now();
spawnSync('npx', ['playwright', 'test', '--project=superadmin', target, `--workers=${workers}`, '--reporter=list,json'], { stdio: 'inherit', env: { ...process.env, RUN_WRITE: '1', PLAYWRIGHT_JSON_OUTPUT_NAME: raw } });
const giay = Math.round((Date.now() - t0) / 1000);
if (fs.existsSync(raw)) {
  const R = JSON.parse(fs.readFileSync(raw, 'utf8'));
  for (const s of R.suites ?? []) {   // mỗi suite cấp trên cùng = 1 file spec = 1 page
    const slug = path.basename(s.file).replace(/\.spec\.ts$/, '');
    (function walk(x) {
      for (const sp of x.specs ?? []) {
        const id = sp.title.match(/^\[([A-Z]+-[A-Z]\d+)\]/)?.[1]; if (!id) continue;
        const shot = sp.tests[0].results.at(-1).attachments?.find(a => a.name === 'screenshot')?.path;
        if (shot && fs.existsSync(shot)) fs.copyFileSync(shot, `${rawDir}/screenshots/${id}.png`);
      }
      (x.suites ?? []).forEach(walk);
    })(s);
    fs.writeFileSync(`${rawDir}/${slug}.json`, JSON.stringify({ stats: { ...R.stats, wall_seconds: giay, workers: Number(workers) }, suites: [s] }));
    console.log(`→ ${rawDir}/${slug}.json`);
  }
  fs.rmSync(raw);
}
console.log(`\nTHỜI GIAN ${p.ten}: ${giay}s, ${workers} worker. Tạo report khi cần: npm run tc:report`);
spawnSync('node', ['cleanup-all.mjs'], { stdio: 'inherit' });
