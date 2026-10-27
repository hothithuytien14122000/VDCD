// Khung dùng chung cho 5 page phân hệ B (dựng trên scripts/A/common.ts). Tên test = "[ID] tiêu đề" từ catalog.json.
import { Page } from '@playwright/test';
import { PAGES as PA, PageCfg, api, Made, code8, findApi } from '../A/common';
export * from '../A/common';

export const PAGES: Record<string, PageCfg> = {
  ...PA,
  PIL: { P: 'PIL', name: 'Trụ cột', route: 'pillars', res: 'dti/pillars', search: /tìm kiếm tên\/mã trụ cột/i, perm: 'DTI_PILLAR',
    cols: [/stt/i, /mã trụ cột/i, /tên trụ cột/i, /nhóm chỉ số/i, /trạng thái/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  IGR: { P: 'IGR', name: 'Nhóm chỉ số', route: 'indicator-groups', res: 'dti/indicator-groups', search: /tìm/i, perm: 'DTI_INDICATOR_GROUP',
    cols: [/stt/i, /mã nhóm chỉ số/i, /tên nhóm chỉ số/i, /trụ cột/i, /^chỉ số$/i, /trạng thái/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  IND: { P: 'IND', name: 'Chỉ số', route: 'indicators', res: 'dti/indicators', search: /tìm kiếm tên\/mã chỉ số/i, perm: 'DTI_INDICATOR',
    cols: [/stt/i, /mã chỉ số/i, /tên chỉ số/i, /trụ cột/i, /nhóm chỉ số/i, /chỉ số con/i, /điểm tối thiểu/i, /điểm tối đa/i, /trạng thái/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  SET: { P: 'SET', name: 'Bộ chỉ số', route: 'indicator-sets', res: 'dti/indicator-sets', search: /tìm kiếm tên\/mã bộ chỉ số/i, perm: 'DTI_INDICATOR_SET',
    cols: [/stt/i, /mã bộ chỉ số/i, /tên bộ chỉ số/i, /phiên bản/i, /năm áp dụng/i, /nhóm chỉ số/i, /^chỉ số$/i, /trạng thái/i, /thao tác/i], codeIdx: 1, nameIdx: 2 },
  SCL: { P: 'SCL', name: 'Thang xếp loại', route: 'score-scales', res: 'dti/score-scales', search: /tìm theo mã hoặc tên thang/i, perm: 'DTI_SCORE_SCALE',
    cols: [/tên thang/i, /các mức/i, /số kỳ sử dụng/i, /trạng thái/i, /thao tác/i], codeIdx: 0, nameIdx: 0 },
};
// ⚠ cols/search/perm/route/codeIdx của B là giá trị khởi tạo: mỗi spec phải đối chiếu với giao diện thật và chỉnh lại trong PAGES nếu sai.

/** Tạo dữ liệu nền qua API; `made` tự dọn (xóa ngược: con trước cha sau, tự mở khóa trước khi xóa). */
export async function ensurePillar(made: Made, o: { lock?: boolean; code?: string } = {}) {
  const code = o.code ?? code8();
  const r = await api('POST', 'dti/pillars', { code, name: `qc.automation Trụ cột ${code}`, displayOrder: 0 });
  if (r.status >= 300) throw new Error(`tạo trụ cột lỗi ${r.status} ${r.message}`);
  made.addDti('dti/pillars', code);
  if (o.lock !== false) await api('PUT', `dti/pillars/${r.data.id}/lock`, {});
  return { ...r.data, code } as any;
}
export async function ensureGroup(made: Made, o: { pillarId?: string; lock?: boolean } = {}) {
  const pillarId = o.pillarId ?? (await ensurePillar(made)).id;
  const code = code8();
  const r = await api('POST', 'dti/indicator-groups', { pillarId, code, name: `qc.automation Nhóm ${code}`, displayOrder: 0 });
  if (r.status >= 300) throw new Error(`tạo nhóm lỗi ${r.status} ${r.message}`);
  made.addDti('dti/indicator-groups', code);
  if (o.lock !== false) await api('PUT', `dti/indicator-groups/${r.data.id}/lock`, {});
  return { ...r.data, code } as any;
}
export async function ensureIndicator(made: Made, o: { groupId?: string; pillarId?: string; parentId?: string; min?: number; max?: number; lock?: boolean } = {}) {
  let { groupId, pillarId } = o;
  if (!groupId) { const g = await ensureGroup(made); groupId = g.id; pillarId = g.pillarId; }
  else if (!pillarId) pillarId = (await api('GET', `dti/indicator-groups/${groupId}`)).data?.pillarId;
  const code = code8();
  const r = await api('POST', 'dti/indicators', { indicatorGroupId: groupId, pillarId, parentId: o.parentId, code, name: `qc.automation Chỉ số ${code}`, minScore: o.min ?? 0, maxScore: o.max ?? 10 });
  if (r.status >= 300) throw new Error(`tạo chỉ số lỗi ${r.status} ${r.message}`);
  made.addDti('dti/indicators', code);
  if (o.lock) await api('PUT', `dti/indicators/${r.data.id}/lock`, {});
  return { ...r.data, code } as any;
}
export async function ensureSet(made: Made, o: { year?: number } = {}) {
  const code = code8();
  const r = await api('POST', 'dti/indicator-sets', { code, name: `qc.automation Bộ ${code}`, effectiveYear: o.year ?? 2026 });
  if (r.status >= 300) throw new Error(`tạo bộ chỉ số lỗi ${r.status} ${r.message}`);
  made.addDti('dti/indicator-sets', code);
  return { ...r.data, code } as any;
}
/** Thang xếp loại: mã TXL-nnn tự sinh nên xóa theo id (đặt tên bắt đầu "qc.automation"). */
export async function ensureScale(made: Made, o: { name?: string; levels?: any[] } = {}) {
  const name = o.name ?? `qc.automation Thang ${code8()}`;
  const r = await api('POST', 'dti/score-scales', { name, levels: o.levels ?? [{ name: 'Kém', fromPercent: 0, toPercent: 50 }, { name: 'Tốt', fromPercent: 50, toPercent: 100 }] });
  if (r.status >= 300) throw new Error(`tạo thang lỗi ${r.status} ${r.message}`);
  made.addDti('dti/score-scales', r.data.id, 'id');
  return r.data as any;
}
