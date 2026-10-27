// Tác nhân chính (cột "Tên tác nhân chính" trong UC_1409 / "Actor chính" trong SRS) → tài khoản dùng để chạy testcase.
// Quy tắc: UC có nhiều tác nhân → chạy bằng tác nhân đầu tiên (chính). Testcase nêu đích danh đúng MỘT vai trò (ldp/cbdp/ldd/lãnh đạo Bộ) trong tiêu đề → chạy bằng vai trò đó.
export const ACCOUNT = {
  'Quản trị hệ thống': 'admin', 'Cán bộ': 'canbo', 'Lãnh đạo': 'lanhdaobo', 'Lãnh đạo đơn vị': 'ldd',
  'Cán bộ địa phương': 'cbdp', 'Lãnh đạo địa phương': 'ldp', 'Người dùng': 'canbo',
};
// UC (tiền tố) → tác nhân tương ứng cột C của UC_1409 (hoặc Actor chính trong SRS)
const BY_UC = [
  [/^A\.II\./, 'Quản trị hệ thống'], [/^A\.IV\./, 'Quản trị hệ thống'],
  [/^B\.I\./, 'Quản trị hệ thống, Cán bộ'], [/^B\.II\./, 'Quản trị hệ thống, Cán bộ'], [/^B\.TXL/, 'Quản trị hệ thống, Cán bộ'],
  [/^B\.III\.[123]-/, 'Quản trị hệ thống, Cán bộ'], [/^B\.III\.4-/, 'Lãnh đạo'],
  [/^C\.UC1\.4/, 'Lãnh đạo đơn vị, Lãnh đạo địa phương'], [/^C\.UC1\./, 'Cán bộ, Cán bộ địa phương'],
  [/^C\.UC2\./, 'Lãnh đạo, Lãnh đạo đơn vị, Cán bộ'],
];
const ROLE_TXT = [['Lãnh đạo địa phương', /lãnh đạo địa phương|\bLĐ địa phương|\bldp\b/i], ['Cán bộ địa phương', /cán bộ địa phương|\bcbdp\b/i],
  ['Lãnh đạo đơn vị', /lãnh đạo đơn vị|\bLĐ đơn vị|\bldd\b/i], ['Lãnh đạo', /lãnh đạo bộ|\bLĐ Bộ|lanhdaobo/i]];
export function actorOf(x) {
  const pre = x.id.split('-')[0];
  if (['LGN', 'RPW'].includes(pre)) return { label: 'Người dùng (chưa đăng nhập)', key: null };
  if (['CPW', 'LGO'].includes(pre)) return { label: 'Người dùng (đã đăng nhập)', key: 'canbo', main: 'Người dùng' };
  let list;
  if (x.uc === 'C.TB') list = x.id.startsWith('RES-M') ? 'Lãnh đạo' : 'Lãnh đạo đơn vị, Cán bộ, Lãnh đạo địa phương, Cán bộ địa phương';
  else list = (BY_UC.find(([re]) => re.test(x.uc)) || [])[1];
  if (!list) return { label: 'Quản trị hệ thống', key: 'admin' };
  let main = list.split(',')[0].trim();
  if (/^(RES|CMP)-/.test(x.id)) {
    const hit = ROLE_TXT.filter(([, re]) => re.test(x.title));
    if (hit.length === 1 && !/chỉ xem|xemonly/i.test(x.title) && !/(^|[^a-zđ])cán bộ(?! địa phương)|\bcanbo\b/i.test(x.title)) main = hit[0][0];
  }
  return { label: list, key: ACCOUNT[main], main };
}
