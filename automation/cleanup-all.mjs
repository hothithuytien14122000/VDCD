// Xóa mọi dữ liệu auto còn sót: mã bắt đầu QCA, userName qca*, hoặc tên chứa qc.automation.
// Chạy:  node cleanup-all.mjs
import fs from 'node:fs';
import cfg from './accounts.mjs';
const BASE=cfg.baseURL;
const tok = JSON.parse(fs.readFileSync('auth/superadmin.json','utf8')).origins[0].localStorage.map(x=>x.value).find(v=>v.split('.').length===3);
const H={Authorization:`Bearer ${tok}`,'Content-Type':'application/json'};
const RES=[
  'unit-types','provinces','communes','organizations','idm/roles','idm/users',
  'dti/pillars','dti/indicator-groups','dti/indicators','dti/indicator-sets','dti/score-scales',
  'dti/self-assessment-campaigns','survey/surveys',
];
const isJunk = x =>
  (x.code||'').toUpperCase().startsWith('QCA') ||
  (x.userName||'').toLowerCase().startsWith('qca') ||
  (x.name||'').includes('qc.automation');
let total=0;
for (const r of [...RES, ...RES.filter(x => x.startsWith('dti/')).reverse()]) {  // lượt 2 cho dữ liệu còn bị ràng buộc cha–con
  const seen=new Set();
  for (const kw of ['QCA','qca','qc.automation']) {
    const res = await fetch(`${BASE}/api/v1/${r}?pageSize=500&keyword=${encodeURIComponent(kw)}`,{headers:H}).catch(()=>null);
    if (!res || !res.ok) continue;
    const j = await res.json().catch(()=>({}));
    const list = j?.data?.content ?? j?.data?.items ?? j?.data ?? [];
    for (const x of list) {
      if (!x?.id || seen.has(x.id) || !isJunk(x)) continue;
      seen.add(x.id);
      if (x.isLocked && r !== 'dti/indicator-sets') {
        const u = `${BASE}/api/v1/${r}/${x.id}/unlock`;
        await fetch(r === 'dti/score-scales' ? `${u}?rowVersion=${x.rowVersion}` : u, { method: r === 'dti/score-scales' ? 'POST' : 'PUT', headers: H, body: '{}' });
      }
      if (r === 'idm/roles') await fetch(`${BASE}/api/v1/idm/permission-matrix/roles/${x.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ permissions: [] }) });   // nhóm còn quyền thì không xóa được
      const st = (await fetch(`${BASE}/api/v1/${r}/${x.id}`,{method:'DELETE',headers:H})).status;
      console.log(`${r}  ${x.code||x.userName||x.name}  -> ${st}`); total++;
    }
  }
}
console.log(total ? `Đã dọn ${total} bản ghi auto.` : 'Không có dữ liệu auto còn sót.');
