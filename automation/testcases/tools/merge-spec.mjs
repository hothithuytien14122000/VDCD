// Gộp test của 1 file spec (nguồn) vào file spec của page (đích) — dùng để dồn case bổ sung vào đúng page.
//  - import của nguồn được đưa lên đầu file đích (bỏ trùng; trùng tên khác nguồn → đổi alias + gán lại trong khối)
//  - phần thân nguồn được bọc trong test.describe(() => { ... }) không tên: helper/hook (beforeAll, afterEach, guardSession…)
//    của nguồn chỉ áp dụng cho test của nó, không đụng test sẵn có của page
//  - bỏ cụm "Bug GitLab" khỏi tiêu đề describe
// Dùng: node testcases/tools/merge-spec.mjs <đích> <nguồn> [--only=<regex tiêu đề describe cấp 1>] [--keep]
//   --only: chỉ lấy các describe cấp 1 khớp regex (để chia 1 nguồn vào nhiều file part của cùng page). Không --keep → xóa nguồn.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { babelParse } = require(path.resolve('node_modules/playwright/lib/transform/babelBundle.js'));

const [dst, srcFile, ...opt] = process.argv.slice(2);
const only = opt.find(o => o.startsWith('--only='))?.slice(7);
const KEEP = opt.includes('--keep');
const src = fs.readFileSync(srcFile, 'utf8'), dstCode = fs.readFileSync(dst, 'utf8');
const sAst = babelParse(src, srcFile, true), dAst = babelParse(dstCode, dst, true);
const body = n => (n.program ?? n).body;

const strArg = n => n && (n.type === 'StringLiteral' ? n.value : n.type === 'TemplateLiteral' && n.expressions.length === 0 ? n.quasis[0].value.cooked : null);
const descTitle = st => {
  const c = st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' ? st.expression : null;
  if (!c || c.callee.type !== 'MemberExpression') return null;
  const isD = (c.callee.object.name === 'test' && c.callee.property.name === 'describe') ||
    (c.callee.object.type === 'MemberExpression' && c.callee.object.object.name === 'test' && c.callee.object.property.name === 'describe' && c.callee.property.name !== 'configure');
  return isD ? strArg(c.arguments[0]) ?? '' : null;
};
const hasTest = (code) => /\btest(\.(only|skip|fixme|fail|slow))?\(\s*tc\(|\bat\(\s*['"`]/.test(code);

// ---- import của đích: tên cục bộ → khóa "nguồn|tên gốc"
const dImports = new Map();
let lastImportEnd = 0;
for (const st of body(dAst)) if (st.type === 'ImportDeclaration') {
  lastImportEnd = st.end;
  for (const sp of st.specifiers) dImports.set(sp.local.name, `${st.source.value}|${sp.type === 'ImportSpecifier' ? (sp.imported.name ?? sp.imported.value) : sp.type}`);
}
// tên khai báo cấp 1 của đích (để phát hiện import nguồn trùng tên biến của đích)
const dTop = new Set(dImports.keys());
for (const st of body(dAst)) {
  if (st.type === 'VariableDeclaration') st.declarations.forEach(d => d.id.type === 'Identifier' && dTop.add(d.id.name));
  if ((st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id) dTop.add(st.id.name);
}

// ---- import của nguồn
const addImports = [], rebinds = [];
let srcBodyStart = 0;
for (const st of body(sAst)) if (st.type === 'ImportDeclaration') {
  srcBodyStart = st.end;
  const from = st.source.value, typeOnly = st.importKind === 'type';
  for (const sp of st.specifiers) {
    const local = sp.local.name;
    const key = `${from}|${sp.type === 'ImportSpecifier' ? (sp.imported.name ?? sp.imported.value) : sp.type}`;
    if (dImports.get(local) === key) continue;                       // đã có y hệt
    const clash = dTop.has(local);
    const alias = clash ? `__g_${local}` : local;
    const isType = typeOnly || sp.importKind === 'type' || /^[A-Z]/.test(local) && from === '@playwright/test';
    if (sp.type === 'ImportDefaultSpecifier') addImports.push(`import ${alias} from '${from}';`);
    else if (sp.type === 'ImportNamespaceSpecifier') addImports.push(`import * as ${alias} from '${from}';`);
    else { const imp = sp.imported.name ?? sp.imported.value; addImports.push(`import ${typeOnly ? 'type ' : ''}{ ${imp === alias ? imp : `${imp} as ${alias}`} } from '${from}';`); }
    if (clash) rebinds.push(isType ? `type ${local} = ${alias};` : `const ${local} = ${alias};`);
    dImports.set(alias, key);
  }
}
// ---- thân nguồn: bỏ describe cấp 1 không khớp --only / không còn test
let part = '', cursor = srcBodyStart; const kept = [];
for (const st of body(sAst)) {
  if (st.type === 'ImportDeclaration') continue;
  const t = descTitle(st);
  if (t !== null) {
    const code = src.slice(st.start, st.end);
    const drop = !hasTest(code) || (only && !new RegExp(only, 'i').test(t));
    if (drop) { part += src.slice(cursor, st.start); cursor = st.end; continue; }
    kept.push(t);
  }
}
part += src.slice(cursor);
if (!kept.length) { console.error(`${srcFile}: không có describe nào khớp ${only ?? ''}`); process.exit(1); }
// bỏ "Bug GitLab" khỏi tiêu đề describe
part = part.replace(/(test\.describe(?:\.\w+)?\(\s*['"`])([^'"`]*)/g, (m, a, title) => a + title
  .replace(/^(?:BUG|Bug) GitLab(?: [A-Z0-9]+)? › /, '').replace(/ › Bug GitLab › /, ' › ').replace(/ — bug GitLab: /i, ' › '));
part = part.replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n').trimEnd();

const block = `\n\n// ===== Case bổ sung từ bug GitLab (gộp từ ${path.basename(srcFile)}) — bọc trong describe để helper/hook chỉ áp dụng cho các case này =====\n` +
  `test.describe(() => {\n${rebinds.length ? rebinds.join('\n') + '\n' : ''}${part}\n});\n`;
let out = dstCode.slice(0, lastImportEnd) + (addImports.length ? '\n' + addImports.join('\n') : '') + dstCode.slice(lastImportEnd);
out = out.trimEnd() + block;
fs.writeFileSync(dst, out);
console.log(`${dst} ← ${srcFile}: ${kept.length} describe [${kept.join(' | ')}]${rebinds.length ? `; đổi tên import: ${rebinds.join(' ')}` : ''}`);
if (!KEEP && !only) fs.rmSync(srcFile);
