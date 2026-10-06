// Doc toan bo testcases/**/*.yaml, GOM THEO NHOM API (api_group = ten thu muc: Survey,
// SurveyForm, SurveyPublic, SurveyReport, SurveyResult) va xuat ra 1 file JSON trung gian
// de script Python (build_xlsx.py) dung tao file Excel - moi NHOM la 1 sheet.
// KHONG thay doi file YAML goc. Chay: node scripts/export_json.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', 'testcases');
const OUT = path.join(__dirname, '..', 'testcases_export.json');

// Thu tu nhom va mo ta ngan gon, dung de sap xep sheet cho dung thu tu nhu swagger.
const GROUP_ORDER = ['Survey', 'SurveyForm', 'SurveyPublic', 'SurveyReport', 'SurveyResult'];

function walk(dir) {
  let out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (f.endsWith('.yaml')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const groupsMap = new Map();

for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  const groupFolder = rel.split('/')[0];
  const doc = yaml.load(fs.readFileSync(f, 'utf8'));
  const apiGroup = doc.api_group || groupFolder;
  const endpoint = doc.endpoint || '';
  const module = doc.module || '';

  if (!groupsMap.has(groupFolder)) {
    groupsMap.set(groupFolder, { group: apiGroup, module, test_cases: [] });
  }
  const g = groupsMap.get(groupFolder);

  for (const tc of doc.test_cases || []) {
    g.test_cases.push({
      endpoint,
      sourceFile: rel,
      id: tc.id || '',
      title: tc.title || '',
      priority: tc.priority || '',
      category: tc.category || '',
      tags: Array.isArray(tc.tags) ? tc.tags.join(', ') : (tc.tags || ''),
      preconditions: Array.isArray(tc.preconditions)
        ? tc.preconditions.map((s) => `- ${s}`).join('\n')
        : (tc.preconditions || ''),
      steps: Array.isArray(tc.steps)
        ? tc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
        : (tc.steps || ''),
      expected_result: Array.isArray(tc.expected_result)
        ? tc.expected_result.map((s) => `- ${s}`).join('\n')
        : (tc.expected_result || ''),
    });
  }
}

const groups = GROUP_ORDER.filter((g) => groupsMap.has(g)).map((g) => groupsMap.get(g));
// phong truong hop co thu muc moi khong nam trong GROUP_ORDER
for (const [folder, g] of groupsMap) {
  if (!GROUP_ORDER.includes(folder)) groups.push(g);
}

fs.writeFileSync(OUT, JSON.stringify({ groups }, null, 2), 'utf8');
const total = groups.reduce((s, g) => s + g.test_cases.length, 0);
console.log(`Da gom ${groups.length} nhom API, tong ${total} test case -> ${OUT}`);
groups.forEach((g) => console.log(`  - ${g.group}: ${g.test_cases.length} test case`));
