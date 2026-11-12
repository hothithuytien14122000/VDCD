// Loại bỏ testcase theo danh sách testcases/docs/removed.json ({ "<ID>": "FAIL" | "SKIP", ... }).
//  1) Xóa hẳn khối test viết tường minh trong scripts/**/*.spec.ts:  test(tc('ID'), ...)  /  test.xxx(tc('ID'), ...)  /  at('ID', ...)
//  2) Test sinh tự động (tc(`${P}-L02`), tc(id) trong vòng lặp/hàm register*) không xóa được dòng code dùng chung:
//     tc() trả tiêu đề có nhãn [ĐÃ LOẠI] và playwright.config.ts bỏ qua (grepInvert) → không còn chạy/không còn trong danh sách.
//  3) catalog.mjs lọc bỏ ID trong removed.json → catalog.json, YAML, báo cáo không còn các ID này (chạy npm run tc:build).
// Dùng: node testcases/tools/remove-cases.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { babelParse } = require(path.resolve('node_modules/playwright/lib/transform/babelBundle.js'));

const DRY = process.argv.includes('--dry');
const REMOVED = JSON.parse(fs.readFileSync('testcases/docs/removed.json', 'utf8'));
const ids = new Set(Object.keys(REMOVED));

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.spec.ts')) files.push(p); } })('scripts');

const strArg = n => n && (n.type === 'StringLiteral' ? n.value : n.type === 'TemplateLiteral' && n.expressions.length === 0 ? n.quasis[0].value.cooked : null);
const isTestCallee = c => (c.type === 'Identifier' && c.name === 'test') ||
  (c.type === 'MemberExpression' && c.object.type === 'Identifier' && c.object.name === 'test' && ['only', 'skip', 'fixme', 'fail', 'slow'].includes(c.property.name));
/** ID của 1 lời gọi đăng ký test tường minh, hoặc null. */
function idOf(call) {
  if (call?.type !== 'CallExpression') return null;
  if (isTestCallee(call.callee)) { const a = call.arguments[0]; if (a?.type === 'CallExpression' && a.callee.name === 'tc') return strArg(a.arguments[0]); }
  if (call.callee.type === 'Identifier' && call.callee.name === 'at') return strArg(call.arguments[0]);
  return null;
}

let total = 0; const removedIds = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const ast = babelParse(src, f, true);
  const cuts = [];
  (function visit(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'ExpressionStatement') { const id = idOf(n.expression); if (id && ids.has(id)) { cuts.push([n.start, n.end, id]); return; } }
    for (const k of Object.keys(n)) { if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue; const v = n[k];
      if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v); }
  })(ast.program ?? ast);
  if (!cuts.length) continue;
  let out = src;
  for (const [s, e] of cuts.sort((a, b) => b[0] - a[0])) {
    // xóa cả phần thụt lề đầu dòng và xuống dòng ngay sau khối nếu khối chiếm trọn dòng
    let s2 = s; while (s2 > 0 && (out[s2 - 1] === ' ' || out[s2 - 1] === '\t')) s2--;
    let e2 = e; while (out[e2] === ' ' || out[e2] === '\t') e2++;
    if ((s2 === 0 || out[s2 - 1] === '\n') && out[e2] === '\n') { out = out.slice(0, s2) + out.slice(e2 + 1); }
    else out = out.slice(0, s) + out.slice(e);
  }
  cuts.forEach(c => removedIds.add(c[2])); total += cuts.length;
  console.log(`${DRY ? '[dry] ' : ''}${f}: xóa ${cuts.length} test`);
  if (!DRY) fs.writeFileSync(f, out);
}
console.log(`\nXóa tường minh ${total} khối test; ${ids.size - removedIds.size} ID còn lại là test sinh tự động → bỏ qua qua tc()/grepInvert.`);
