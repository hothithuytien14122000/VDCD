// Tạo bộ tài khoản QC qua API (bỏ qua user đã tồn tại). Chạy từ thư mục automation/: node create-qc-users.mjs
import fs from 'node:fs';
import cfg from './accounts.mjs';   // đọc DEFAULT_PASSWORD từ .env
const st = JSON.parse(fs.readFileSync('auth/superadmin.json', 'utf8'));
const tok = st.origins[0].localStorage.map(x => x.value).find(v => v.split('.').length === 3);
const B = 'https://cds.geneat.pro/api/v1/';
const call = async (m, p, body) => {
  const r = await fetch(B + p, { method: m, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
};
const BO = '0d39632f-fa83-45d0-8a6f-aa0196fc1e96';   // QA - Đơn vị Bộ
const DP = 'b5a3ab66-ba5c-4e8a-baf9-15aecf8358ed';   // QA - Địa phương
if (!cfg.password) throw new Error('Thiếu DEFAULT_PASSWORD trong .env (xem .env.example)');
const PW = cfg.password;
const USERS = [
  ['qc.canbo', 'QC Cán bộ', BO, 'QC_CAN_BO'],
  ['qc.ldd', 'QC Lãnh đạo đơn vị', BO, 'QC_LANH_DAO_DON_VI'],
  ['qc.cbdp', 'QC Cán bộ địa phương', DP, 'QC_CAN_BO_DIA_PHUONG'],
  ['qc.ldp', 'QC Lãnh đạo địa phương', DP, 'QC_LANH_DAO_DIA_PHUONG'],
  ['qc.nogroup', 'QC Không nhóm', DP, ''],
  ['qc.locked', 'QC Bị khóa', DP, 'QC_CAN_BO_DIA_PHUONG', { lock: true }],
  ['qc.firstlogin', 'QC Đăng nhập lần đầu', DP, 'QC_CAN_BO_DIA_PHUONG', { firstLogin: true }],
  ['qc.xemonly', 'QC Chỉ xem', BO, 'QC_TMP_CHI_XEM'],
];
const find = async u => ((await call('GET', `idm/users?pageSize=50&keyword=${encodeURIComponent(u)}`)).j?.data?.content ?? []).find(x => x.userName === u);
for (const [userName, name, organizationId, roleCode, o = {}] of USERS) {
  let x = await find(userName);
  if (x) { console.log('ĐÃ CÓ ', userName); }
  else {
    const r = await call('POST', 'idm/users', { name, email: `${userName}@cds.local`, userName, password: PW,
      isRequireChangePassword: !!o.firstLogin, isRequestMailInfo: false, organizationId, roleCode });
    console.log(r.status === 200 ? 'TẠO OK' : 'LỖI   ', userName, r.status === 200 ? '' : r.j?.message);
    x = await find(userName);
  }
  if (o.lock && x) {
    for (const p of [`idm/users/${x.id}/lock`, `idm/users/${x.id}/lockout`]) {
      const r = await call('PUT', p, {});
      console.log('  khóa', p, r.status, r.j?.message ?? '');
      if (r.status === 200) break;
    }
  }
}
for (const u of USERS) { const x = await find(u[0]); console.log(u[0], '|', x?.roleCode, '|', x?.organizationName, '| lockedOut:', x?.isLockedOut, '| active:', x?.isActive, '| reqChangePw:', x?.isRequireChangePassword); }
