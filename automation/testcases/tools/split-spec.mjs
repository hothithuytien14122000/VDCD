// Tách 1 file spec gộp nhiều page thành nhiều file theo tiền tố mã testcase (USR, GRP, ATA…).
// Mỗi file đích = bản sao file gốc, chỉ giữ test(tc('ID')) có tiền tố thuộc nhóm; describe rỗng bị bỏ. Helper/import giữ nguyên.
// Dùng: node testcases/tools/split-spec.mjs <file gốc> <đích1>=<P1,P2> [<đích2>=<P3>] ... [--keep]
//   (mặc định xóa file gốc sau khi tách; báo lỗi nếu có test có ID không thuộc nhóm nào)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { babelParse } = require(path.resolve('node_modules/playwright/lib/transform/babelBundle.js'));

const [src, ...rest] = process.argv.slice(2);
const KEEP = rest.includes('--keep');
const groups = rest.filter(a => a.includes('=')).map(a => { const [out, ps] = a.split('='); return { out, ps: new Set(ps.split(',')) }; });
const code = fs.readFileSync(src, 'utf8');
const ast = babelParse(code, src, true);

const strArg = n => n && (n.type === 'StringLiteral' ? n.value : n.type === 'TemplateLiteral' && n.expressions.length === 0 ? n.quasis[0].value.cooked : null);
const isTestCallee = c => (c.type === 'Identifier' && c.name === 'test') ||
  (c.type === 'MemberExpression' && c.object.type === 'Identifier' && c.object.name === 'test' && ['only', 'skip', 'fixme', 'fail', 'slow'].includes(c.property.name));
// test.describe(...) / test.describe.serial(...) / test.describe.parallel(...)
const isDescribe = c => c?.type === 'CallExpression' && c.callee.type === 'MemberExpression' && (
  (c.callee.object.type === 'Identifier' && c.callee.object.name === 'test' && c.callee.property.name === 'describe') ||
  (c.callee.object.type === 'MemberExpression' && c.callee.object.object.name === 'test' && c.callee.object.property.name === 'describe' && c.callee.property.name !== 'configure'));
function idOf(call) {
  if (call?.type !== 'CallExpression') return null;
  if (isTestCallee(call.callee)) { const a = call.arguments[0]; if (a?.type === 'CallExpression' && a.callee.name === 'tc') return strArg(a.arguments[0]); }
  if (call.callee.type === 'Identifier' && call.callee.name === 'at') return strArg(call.arguments[0]);
  return null;
}
const tests = [], describes = [];
(function visit(n) {
  if (!n || typeof n.type !== 'string') return;
  if (n.type === 'ExpressionStatement') {
    const id = idOf(n.expression); if (id) { tests.push({ s: n.start, e: n.end, id, p: id.split('-')[0] }); return; }
    if (isDescribe(n.expression)) describes.push({ s: n.start, e: n.end });
  }
  for (const k of Object.keys(n)) { if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue; const v = n[k];
    if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v); }
})(ast.program ?? ast);

const orphan = tests.filter(t => !groups.some(g => g.ps.has(t.p)));
if (orphan.length) { console.error('ID không thuộc nhóm nào:', orphan.map(t => t.id).join(', ')); process.exit(1); }

function cut(out, s, e) {
  let s2 = s; while (s2 > 0 && (out[s2 - 1] === ' ' || out[s2 - 1] === '\t')) s2--;
  let e2 = e; while (out[e2] === ' ' || out[e2] === '\t') e2++;
  if ((s2 === 0 || out[s2 - 1] === '\n') && out[e2] === '\n') { let e3 = e2 + 1; if (out[e3] === '\n' && (s2 < 2 || out[s2 - 2] === '\n')) e3++; return out.slice(0, s2) + out.slice(e3); }
  return out.slice(0, s) + out.slice(e);
}
for (const g of groups) {
  const keep = tests.filter(t => g.ps.has(t.p));
  const drop = tests.filter(t => !g.ps.has(t.p));
  // describe chứa test nhưng không còn test nào được giữ → bỏ cả khối
  const dropD = describes.filter(d => tests.some(t => t.s >= d.s && t.e <= d.e) && !keep.some(t => t.s >= d.s && t.e <= d.e));
  let cuts = [...dropD, ...drop].sort((a, b) => a.s - b.s);
  cuts = cuts.filter(c => !cuts.some(o => o !== c && o.s <= c.s && o.e >= c.e && !(o.s === c.s && o.e === c.e)));   // bỏ khối nằm trong khối đã cắt
  let out = code;
  for (const c of cuts.sort((a, b) => b.s - a.s)) out = cut(out, c.s, c.e);
  out = out.replace(/\n{3,}/g, '\n\n');
  fs.mkdirSync(path.dirname(g.out), { recursive: true });
  fs.writeFileSync(g.out, out);
  console.log(`${g.out}: ${keep.length} test (${[...g.ps].join(',')})`);
}
if (!KEEP && !groups.some(g => path.resolve(g.out) === path.resolve(src))) fs.rmSync(src);
