#!/usr/bin/env node
/**
 * Đẩy các case FAIL lên GitLab sau khi chạy auto.
 *
 *   node src/cli.js excel <file.xlsx> [--env "..."] [--dry-run] [--out file.xlsx]
 *   node src/cli.js json  <failed.json> [--env "..."] [--dry-run]
 *
 * Excel: mỗi sheet một UC, dòng 1 là "Nhóm chức năng ... - UCx.y ...", dòng header có
 * ID | TITLE | STEP | KẾT QUẢ MONG ĐỢI | STATUS. Cột tùy chọn: KẾT QUẢ THỰC TẾ, GHI CHÚ,
 * ẢNH (đường dẫn file, nhiều file cách nhau ";"), ISSUE (tự thêm nếu chưa có).
 * Dòng đã có link ở cột ISSUE sẽ bỏ qua → chạy lại không bị log trùng.
 */
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createBugIssue, normalizeSteps, buildDescription } from './gitlab.js';

const args = process.argv.slice(2);
const [mode, file] = args;
const opt = (name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');
const environment = opt('--env');

const norm = (s) => String(s ?? '').normalize('NFC').trim().toUpperCase();
function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

/** "Kiểm tra tìm kiếm theo tên" → "Lỗi tìm kiếm theo tên [TC_01]" */
export function bugTitle(tcTitle, id) {
  let t = tcTitle.trim().replace(/^(kiểm tra|test|verify)\s+/i, '');
  t = t.charAt(0).toLowerCase() + t.slice(1);
  return `Lỗi ${t}${id ? ` [${id}]` : ''}`;
}

async function submit(bug) {
  if (dryRun) {
    console.log(`\n=== [DRY RUN] ${bug.title}\n${buildDescription({ ...bug, steps: normalizeSteps(bug.steps) })}`);
    return { action: 'dry-run', web_url: '' };
  }
  const r = await createBugIssue(bug);
  console.log(`${r.action === 'created' ? '✅ Tạo' : '🔁 Comment'} #${r.iid}: ${r.title}\n   ${r.web_url}${r.warning ? `\n   ⚠ ${r.warning}` : ''}`);
  return r;
}

async function fromExcel() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  let total = 0;
  for (const ws of wb.worksheets) {
    const groupLine = cellText(ws.getRow(1).getCell(1).value);
    const uc = groupLine.match(/UC\s*[\d.]+[^-–]*/i)?.[0]?.trim();

    // tìm dòng header trong 6 dòng đầu
    let headerRow, col = {};
    for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
      const map = {};
      ws.getRow(r).eachCell((c, i) => { map[norm(cellText(c.value))] = i; });
      if (map.ID && map.STATUS) { headerRow = r; col = map; break; }
    }
    if (!headerRow) continue;
    const pick = (...names) => names.map(norm).map((n) => col[n]).find(Boolean);
    const c = {
      id: col.ID, title: pick('TITLE', 'TIÊU ĐỀ'), step: pick('STEP', 'CÁC BƯỚC'),
      expected: pick('KẾT QUẢ MONG ĐỢI', 'EXPECTED'), actual: pick('KẾT QUẢ THỰC TẾ', 'ACTUAL'),
      note: pick('GHI CHÚ', 'NOTE'), img: pick('ẢNH', 'SCREENSHOT', 'ATTACHMENT'), status: col.STATUS,
      issue: pick('ISSUE'),
    };
    if (!c.issue) {
      c.issue = ws.getRow(headerRow).cellCount + 1;
      ws.getRow(headerRow).getCell(c.issue).value = 'ISSUE';
    }

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (i) => (i ? cellText(row.getCell(i).value).trim() : '');
      if (norm(get(c.status)) !== 'FAIL' || get(c.issue)) continue;
      const id = get(c.id);
      const title = get(c.title) || id;
      const imgs = get(c.img).split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
        .map((p) => ({ path: path.resolve(path.dirname(file), p) }));
      const res = await submit({
        title: bugTitle(title, id),
        steps: get(c.step),
        expected: get(c.expected),
        actual: get(c.actual) || get(c.note) || 'Không đạt kết quả mong đợi khi chạy test tự động.',
        extra: get(c.actual) && get(c.note) ? get(c.note) : undefined,
        testCaseId: [uc || ws.name, id].filter(Boolean).join(' · '),
        environment,
        attachments: imgs,
      });
      if (res.web_url) row.getCell(c.issue).value = { text: `#${res.iid}`, hyperlink: res.web_url };
      total++;
    }
  }
  if (!dryRun && total) {
    const out = opt('--out') || file;
    await wb.xlsx.writeFile(out);
    console.log(`\nĐã ghi link issue vào cột ISSUE: ${out}`);
  }
  console.log(`\nXử lý ${total} case FAIL.`);
}

async function fromJson() {
  const fs = await import('node:fs/promises');
  const items = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const it of [].concat(items)) {
    await submit({ environment, ...it, testCaseId: it.testCaseId ?? it.test_case_id });
  }
}

if (!file || !['excel', 'json'].includes(mode)) {
  console.error('Cách dùng: node src/cli.js <excel|json> <file> [--env "..."] [--dry-run] [--out file]');
  process.exit(1);
}
(mode === 'excel' ? fromExcel() : fromJson()).catch((e) => { console.error('❌', e.message); process.exit(1); });
