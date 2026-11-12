// ATTT cấp độ 2 — PHÂN HỆ C (Đánh giá CĐS). Testcase ATC-* (testcases/docs/catalog-ATTT.mjs, sheet "ATTT mức 2").
// Chấm điểm/trình duyệt cần kết quả đang mở của cán bộ → các case đó Manual; ở đây kiểm tra API, phạm vi đơn vị, tệp tải lên.
import { test, expect, at, call, rowsOf, perms, liveRoles, tokenOf, API_BASE, registerModuleSuite } from '../attt';

const RES = 'dti/assessment-results';
const PDF = '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF';
const MARK = `qca-attt-noi-dung-tep-${Date.now()}`;
async function upload(name: string, content: string, type: string, entityId: string, as = 'canbo') {
  const fd = new FormData(); fd.append('file', new Blob([content], { type }), name); fd.append('entityId', entityId);
  const r = await fetch(`${API_BASE}/api/v1/upload/blob/assessment_result_file`, { method: 'POST', headers: { Authorization: `Bearer ${tokenOf(as)}` }, body: fd });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, message: String(j?.message ?? ''), data: j?.data };
}
/** Gỡ tệp chờ gửi do upload sinh ra (upload gắn tệp vào kết quả như "tệp chờ gửi"). */
async function clearPending(id: string, as = 'superadmin') {   // canbo bị 403 khi xóa tệp chờ của chính mình → dọn bằng QTV
  for (let i = 0; i < 40; i++) {
    const pf = (await call('GET', `${RES}/${id}/submissions`, { as })).data?.pendingFile; if (!pf) return;
    const d = await call('DELETE', `${RES}/${id}/pending-file/${pf.id}`, { as }); if (d.status >= 300) return;
  }
}
/** Kết quả tự đánh giá thuộc đơn vị của canbo (để upload hợp lệ về mặt phạm vi). */
async function myResult() { return rowsOf((await call('GET', `${RES}?page=1&size=20`, { as: 'canbo' })).data)[0]; }

registerModuleSuite('ATC', {
  mods: [{ res: RES, perm: 'DTI_ASSESSMENT', route: 'assessment-results', crud: false }],
  idor: async () => {
    for (const role of await liveRoles()) {
      if (!['unit', 'unitAndChildren'].includes((await perms(role)).get('DTI_ASSESSMENT.VIEW') ?? '')) continue;
      const mine = new Set(rowsOf((await call('GET', `${RES}?page=1&size=500`, { as: role })).data).map((x: any) => x.id));
      const other = rowsOf((await call('GET', `${RES}?page=1&size=200`)).data).find((x: any) => !mine.has(x.id));
      if (other) return { role, url: `${RES}/${other.id}` };
    }
    return 'Không có tài khoản QC nào có quyền xem kết quả theo phạm vi đơn vị';
  },
  sensitive: async () => { const r = await myResult(); if (r) { await upload('qca-attt-mark.pdf', `${PDF}\n${MARK}`, 'application/pdf', r.id); await clearPending(r.id); } return [MARK]; },
});

test.describe('ATTT ATC › Tệp minh chứng (KT 1.3.4)', () => {
  at('ATC-F01', async () => {
    const r = await myResult(); test.skip(!r, 'canbo chưa có kết quả tự đánh giá nào');
    const base = await upload('qca-attt-ok.pdf', PDF, 'application/pdf', r.id); await clearPending(r.id);
    test.skip(base.status >= 300, `Tải tệp PDF hợp lệ cũng bị từ chối (${base.status} "${base.message}") → không phân biệt được kiểm tra định dạng`);
    const bad: string[] = [];
    try {
      for (const [n, t] of [['qca.exe', 'application/x-msdownload'], ['qca.html', 'text/html'], ['qca.svg', 'image/svg+xml'], ['qca.js', 'text/javascript'], ['qca.php', 'application/x-php']]) {
        const x = await upload(n, 'qca attt test', t, r.id); if (x.status < 300) bad.push(`${n} → ${x.status}`);
      }
    } finally { await clearPending(r.id); }
    expect(bad, 'Tệp có đuôi nguy hiểm được chấp nhận').toEqual([]);
  });
  at('ATC-F02', async () => {
    const r = await myResult(); test.skip(!r, 'canbo chưa có kết quả tự đánh giá nào');
    const bad: string[] = [];
    try {
      const a = await upload('qca-gia.pdf', '<html><script>alert(1)</script></html>', 'application/pdf', r.id); if (a.status < 300) bad.push('đuôi .pdf nội dung HTML → chấp nhận');
      const b = await upload('qca-mime.pdf', 'MZ\x90\x00 qca', 'application/x-msdownload', r.id); if (b.status < 300) bad.push('đuôi .pdf, MIME exe → chấp nhận');
    } finally { await clearPending(r.id); }
    expect(bad, 'Chỉ kiểm tra đuôi tệp, không kiểm tra nội dung/MIME').toEqual([]);
  });
});
