// Dữ liệu minh họa cho HDSD Quản trị hệ thống – PHẦN B (Bộ chỉ số DTI + Quản lý tự đánh giá).
// Tạo qua API bằng tài khoản admin (để màn chi tiết ghi đúng người tạo), mã tiền tố QCA, tên thang/kỳ bắt đầu "QCA".
// Dùng trong capture-admin-b.mjs: const D = await setup(); … finally await cleanup();
// Chạy tay:  node hdsd/tools/admin-b-data.mjs setup | cleanup   (trạng thái lưu ở hdsd/out/.admin-b-data.json)
import fs from 'node:fs';
import { BASE } from './shot.mjs';

const STATE = 'hdsd/out/.admin-b-data.json';
const tokenOf = (k) => JSON.parse(fs.readFileSync(`auth/${k}.json`, 'utf8')).origins[0].localStorage.map(x => x.value).find(v => v.split('.').length === 3);
const TOKEN = tokenOf('admin');
export async function api(method, res, body, quiet = false) {
  const r = await fetch(`${BASE}/api/v1/${res}`, {
    method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status >= 300 && !quiet) console.warn(`  ! API ${method} ${res}: ${r.status} ${j?.message ?? ''}`);
  return { status: r.status, data: j?.data, message: j?.message };
}
const rows = (d) => d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
export async function all(res) {
  const out = [];
  for (let p = 1; p <= 30; p++) {
    const r = await api('GET', `${res}${res.includes('?') ? '&' : '?'}page=${p}&size=100`);
    out.push(...rows(r.data));
    if (p >= (r.data?.totalPages ?? 1)) break;
  }
  return out;
}

export async function setup() {
  if (fs.existsSync(STATE)) await cleanup();
  const sfx = Date.now().toString(36).slice(-3).toUpperCase();
  const D = { sfx, made: [] };
  const save = () => fs.writeFileSync(STATE, JSON.stringify(D, null, 1));
  const mk = async (res, body, lock = true) => {
    const r = await api('POST', res, body);
    if (r.status >= 300 || !r.data?.id) throw new Error(`tạo ${res} lỗi: ${r.message}`);
    D.made.push([res, r.data.id]); save();
    if (lock) await api('PUT', `${res}/${r.data.id}/lock`, {});
    return { ...r.data, code: body.code ?? r.data.code, name: body.name };
  };
  const c = (x) => `QCA${x}${sfx}`;
  // Trụ cột → nhóm → chỉ số (đã khóa để dùng được trong bộ chỉ số)
  D.p1 = await mk('dti/pillars', { code: c('TC1'), name: 'Nhận thức số', displayOrder: 1, description: 'Nhận thức, tuyên truyền về chuyển đổi số' });
  D.p2 = await mk('dti/pillars', { code: c('TC2'), name: 'Hạ tầng số', displayOrder: 2, description: 'Hạ tầng kỹ thuật phục vụ chuyển đổi số' });
  D.g1 = await mk('dti/indicator-groups', { pillarId: D.p1.id, code: c('N11'), name: 'Tuyên truyền, nâng cao nhận thức', displayOrder: 1 });
  D.g2 = await mk('dti/indicator-groups', { pillarId: D.p2.id, code: c('N21'), name: 'Hạ tầng kỹ thuật', displayOrder: 1 });
  const ind = (g, p, code, name, max, parentId, description) => mk('dti/indicators', { indicatorGroupId: g.id, pillarId: p.id, parentId, code: c(code), name, minScore: 0, maxScore: max, description });
  D.i1 = await ind(D.g1, D.p1, 'C111', 'Công tác tuyên truyền về chuyển đổi số', 20, undefined, 'Đánh giá mức độ tuyên truyền, phổ biến về chuyển đổi số tại đơn vị');
  D.i1a = await ind(D.g1, D.p1, 'C112', 'Số tin, bài tuyên truyền về chuyển đổi số trong năm', 10, D.i1.id);
  D.i1b = await ind(D.g1, D.p1, 'C113', 'Tỷ lệ cán bộ được bồi dưỡng kỹ năng số', 10, D.i1.id);
  D.i2 = await ind(D.g2, D.p2, 'C211', 'Tỷ lệ máy tính được kết nối mạng nội bộ', 10, undefined, 'Tỷ lệ máy tính làm việc được kết nối mạng nội bộ của đơn vị');
  D.i3 = await ind(D.g2, D.p2, 'C212', 'Hệ thống hội nghị truyền hình trực tuyến', 10);
  // Bản ghi CHƯA khóa để minh họa Cập nhật / Khóa / Xóa
  D.p3 = await mk('dti/pillars', { code: c('TC3'), name: 'Nhân lực số', displayOrder: 3 }, false);
  D.g3 = await mk('dti/indicator-groups', { pillarId: D.p1.id, code: c('N12'), name: 'Kỹ năng số của cán bộ', displayOrder: 2 }, false);
  D.i4 = await mk('dti/indicators', { indicatorGroupId: D.g2.id, pillarId: D.p2.id, code: c('C213'), name: 'Tỷ lệ cán bộ sử dụng chữ ký số', minScore: 0, maxScore: 10, description: 'Tỷ lệ cán bộ được cấp và sử dụng chữ ký số trong xử lý văn bản' }, false);
  // Bộ chỉ số có cấu trúc, đã khóa (để chọn khi tạo kỳ)
  D.set = await mk('dti/indicator-sets', { code: c('BCS'), name: 'Bộ chỉ số đánh giá chuyển đổi số năm 2026 (minh họa)', effectiveYear: 2026, description: 'Bộ chỉ số minh họa dùng cho tài liệu hướng dẫn' }, false);
  await api('PUT', `dti/indicator-sets/${D.set.id}/groups`, [{ indicatorGroupId: D.g1.id, displayOrder: 1, isScored: true }, { indicatorGroupId: D.g2.id, displayOrder: 2, isScored: true }]);
  await api('PUT', `dti/indicator-sets/${D.set.id}/indicators`, [
    { indicatorId: D.i1.id, weight: 0, isScored: true, minScore: 0, maxScore: 20 },
    { indicatorId: D.i1a.id, weight: 1, isScored: true, minScore: 0, maxScore: 10 },
    { indicatorId: D.i1b.id, weight: 1, isScored: true, minScore: 0, maxScore: 10 },
    { indicatorId: D.i2.id, weight: 1, isScored: true, minScore: 0, maxScore: 10 },
    { indicatorId: D.i3.id, weight: 1, isScored: true, minScore: 0, maxScore: 10 },
  ].map((x, i) => ({ ...x, displayOrder: i + 1 })));
  await api('POST', `dti/indicator-sets/${D.set.id}/lock`, {});
  // Bộ chỉ số nháp (chưa khóa) để minh họa sửa/xóa/cấu hình
  D.set2 = await mk('dti/indicator-sets', { code: c('BCD'), name: 'Bộ chỉ số đánh giá chuyển đổi số năm 2027 (dự thảo)', effectiveYear: 2027, description: 'Bộ chỉ số dự thảo' }, false);
  await api('PUT', `dti/indicator-sets/${D.set2.id}/groups`, [{ indicatorGroupId: D.g1.id, displayOrder: 1, isScored: true }]);
  await api('PUT', `dti/indicator-sets/${D.set2.id}/indicators`, [
    { indicatorId: D.i1.id, weight: 0, isScored: true, minScore: 0, maxScore: 20, displayOrder: 1 },
    { indicatorId: D.i1a.id, weight: 1, isScored: true, minScore: 0, maxScore: 10, displayOrder: 2 },
    { indicatorId: D.i1b.id, weight: 1, isScored: true, minScore: 0, maxScore: 10, displayOrder: 3 },
  ]);
  // Thang xếp loại (mã TXL-nnn tự sinh) – đã khóa để chọn khi tạo kỳ
  const sc = await api('POST', 'dti/score-scales', { name: `QCA Thang xếp loại 4 mức ${sfx}`, description: 'Thang minh họa cho tài liệu hướng dẫn',
    levels: [{ name: 'Yếu', fromPercent: 0, toPercent: 50 }, { name: 'Trung bình', fromPercent: 50, toPercent: 65 }, { name: 'Khá', fromPercent: 65, toPercent: 80 }, { name: 'Tốt', fromPercent: 80, toPercent: 100 }] });
  if (sc.status >= 300) throw new Error('tạo thang lỗi: ' + sc.message);
  D.scale = sc.data; D.made.push(['dti/score-scales', sc.data.id]); save();
  const g = await api('GET', `dti/score-scales/${sc.data.id}`);
  await api('POST', `dti/score-scales/${sc.data.id}/lock?rowVersion=${g.data.rowVersion}`, {});
  // Thang chưa khóa (minh họa sửa/xóa)
  const sc2 = await api('POST', 'dti/score-scales', { name: `QCA Thang xếp loại 3 mức ${sfx}`, levels: [{ name: 'Chưa đạt', fromPercent: 0, toPercent: 50 }, { name: 'Đạt', fromPercent: 50, toPercent: 80 }, { name: 'Tốt', fromPercent: 80, toPercent: 100 }] });
  D.scale2 = sc2.data; D.made.push(['dti/score-scales', sc2.data.id]); save();
  // Kỳ tự đánh giá Nháp (định kỳ – quý) đã phân công 3 đơn vị; kỳ đột xuất Nháp
  D.camp = await mk('dti/self-assessment-campaigns', { name: `QCA Tự đánh giá chuyển đổi số Quý IV/2026 ${sfx}`, type: 'Periodic', periodType: 'Quarter', indicatorSetId: D.set.id, scaleId: D.scale.id, reminderDaysBeforeDue: 5 }, false);
  D.camp2 = await mk('dti/self-assessment-campaigns', { name: `QCA Tự đánh giá đột xuất chuyển đổi số ${sfx}`, type: 'AdHoc', indicatorSetId: D.set.id, scaleId: D.scale.id, startDate: '2026-11-02T00:00:00', endDate: '2026-11-30T23:59:59', reminderDaysBeforeDue: 3 }, false);
  const orgs = (await all('organizations')).filter(o => !o.isLocked && /^(QC_DP|QA|QC_)/i.test(o.code ?? '') && !/qc\.automation|QCA/i.test(`${o.name} ${o.code}`)).slice(0, 3);
  D.orgs = orgs.map(o => ({ id: o.id, code: o.code, name: o.name }));
  if (orgs.length) await api('PUT', `dti/self-assessment-campaigns/${D.camp.id}/organizations`, orgs.map(o => o.id));
  save();
  console.log('  + dữ liệu minh họa phần B:', sfx, `(${D.made.length} bản ghi)`, 'đơn vị:', D.orgs.map(o => o.code).join(', '));
  return D;
}

async function sweepCopies(D) {
  let left = 0;
  // bản sao do Nhân bản tạo ra (mã bắt đầu bằng mã minh họa) – dò theo hậu tố
  for (const res of ['dti/indicator-sets', 'dti/indicators']) {
    for (const x of await all(`${res}?keyword=QCA`)) {
      if (!String(x.code ?? '').toUpperCase().startsWith('QCA') || !String(x.code).toUpperCase().includes(D.sfx)) continue;
      if (res === 'dti/indicator-sets') await api('POST', `${res}/${x.id}/unlock`, {}, true); else await api('PUT', `${res}/${x.id}/unlock`, {}, true);
      const d = await api('DELETE', `${res}/${x.id}`, undefined, true);
      if (d.status >= 300) { left++; console.warn(`  ! chưa xóa được bản sao ${x.code}: ${d.message}`); }
    }
  }
  return left;
}

export async function cleanup() {
  if (!fs.existsSync(STATE)) return;
  const D = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  // Kỳ trước (xóa kèm bản sao bộ chỉ số), rồi bộ chỉ số, thang, chỉ số con → cha → nhóm → trụ cột
  const order = ['dti/self-assessment-campaigns', 'dti/indicator-sets', 'dti/score-scales', 'dti/indicators', 'dti/indicator-groups', 'dti/pillars'];
  const extra = D.extra ?? [];
  const list = [...D.made, ...extra];
  await sweepCopies(D);   // bản sao bộ chỉ số còn giữ chỉ số → xóa trước
  let left = 0;
  for (const res of order) {
    for (const [r, id] of list.filter(x => x[0] === res).reverse()) {
      if (res === 'dti/indicator-sets') await api('POST', `${r}/${id}/unlock`, {}, true);
      else if (res === 'dti/score-scales') {
        const g = await api('GET', `${r}/${id}`, undefined, true);
        if (g.status === 404) continue;
        if (g.data?.isLocked) await api('POST', `${r}/${id}/unlock?rowVersion=${g.data.rowVersion}`, {}, true);
      } else if (res !== 'dti/self-assessment-campaigns') await api('PUT', `${r}/${id}/unlock`, {}, true);
      const d = await api('DELETE', `${r}/${id}`, undefined, true);
      if (d.status >= 300 && d.status !== 404) { left++; console.warn(`  ! chưa xóa được ${r}/${id}: ${d.status} ${d.message}`); }
    }
  }
  left += await sweepCopies(D);
  if (!left) fs.rmSync(STATE);
  console.log(`  − đã dọn dữ liệu minh họa phần B (${D.sfx})${left ? `, còn ${left} bản ghi chưa xóa` : ''}`);
}

if (process.argv[1]?.endsWith('admin-b-data.mjs')) {
  if (process.argv[2] === 'setup') await setup();
  else if (process.argv[2] === 'cleanup') await cleanup();
}
