// ATTT cấp độ 2 — XÁC THỰC (AUTH). Testcase ATU-* (testcases/docs/catalog-ATTT.mjs, sheet "ATTT mức 2").
// Chạy trong project 'auth' (npm run test:AUTH). Đăng nhập thật cần captcha → các case đó Manual; ở đây kiểm tra API/cấu hình.
import fs from 'node:fs';
import cfg from '../../accounts.mjs';
import { Made, ensureUser, findApi, uname, userBody } from '../A/common';
import { test, expect, at, call, FAKE, sensitiveKeys, logSnapshot, newLogs, expectLogs, accessSnapshot, newAccess, httpRedirect, tlsHandshake, API_BASE, txt } from '../attt';

// FE gửi tên đăng nhập trong trường "email" (xem bundle: {email: e.username, password, captchaId, captchaCode, rememberMe})
const login = ({ username, ...b }: any) => call('POST', 'authentication/jwt/login', { as: null, body: { rememberMe: false, email: username, ...b } });
/** API tạo người dùng nay giới hạn tần suất ("Bạn thao tác quá nhanh, vui lòng thử lại sau") và dùng chung với các bộ test khác → thử lại tối đa ~60s. */
async function retryFast<T>(fn: () => Promise<T>, isFast: (x: T) => boolean = () => false): Promise<T> {
  for (let i = 0; ; i++) {
    try { const x = await fn(); if (!isFast(x) || i >= 12) return x; }
    catch (e: any) { if (!/thao tác quá nhanh/i.test(String(e?.message)) || i >= 12) throw e; }
    await new Promise(f => setTimeout(f, 5000));
  }
}
const FAST = (r: any) => /thao tác quá nhanh/i.test(r?.message ?? '');
const hasToken = (r: any) => /accessToken|"token"\s*:\s*"ey/i.test(r.text);

test.describe('ATTT ATU › Xác thực & mật khẩu', () => {
  at('ATU-X01', async () => {
    const bad: string[] = [];
    for (const [k, b] of Object.entries({ 'không captcha': { username: 'qc.canbo', password: cfg.password }, 'captchaId giả': { username: 'qc.canbo', password: cfg.password, captchaId: FAKE, captchaCode: '12345' }, 'captchaCode sai': { username: 'qc.canbo', password: cfg.password, captchaId: 'qca', captchaCode: '' } })) {
      const r = await login(b); if (r.status < 400 || hasToken(r)) bad.push(`${k} → ${r.status}${hasToken(r) ? ' (có token)' : ''}`);
    }
    expect(bad, 'Đăng nhập không có captcha hợp lệ vẫn được chấp nhận').toEqual([]);
  });
  at('ATU-P02', async () => {
    const made = new Made();
    try {
      const u = await retryFast(() => ensureUser(made));
      const row = await findApi('idm/users', u.userName, 'userName');
      const det = (await call('GET', `idm/users/${row.id}`)).data;
      for (const d of [row, det]) {
        expect(sensitiveKeys(d), 'Có trường mật khẩu/hash/token').toEqual([]);
        expect(txt(d).includes(cfg.password), 'Phản hồi chứa mật khẩu vừa đặt').toBe(false);
      }
    } finally { await made.clean(); }
  });
  at('ATU-P03', async () => {
    const pws = [cfg.password, ...cfg.users.map((u: any) => u.password)].filter(Boolean);
    const bad: string[] = [];
    for (const f of fs.readdirSync('auth').filter(f => f.endsWith('.json'))) {
      const st = JSON.parse(fs.readFileSync(`auth/${f}`, 'utf8'));
      const vals = [...(st.cookies ?? []).map((c: any) => c.value), ...(st.origins ?? []).flatMap((o: any) => (o.localStorage ?? []).map((x: any) => x.value))];
      if (vals.some(v => pws.some(p => String(v).includes(p)))) bad.push(f);
    }
    expect(bad, 'Phiên trình duyệt lưu mật khẩu dạng rõ').toEqual([]);
  });
  at('ATU-P04', async () => {
    const made = new Made();
    try {
      const u = await retryFast(() => ensureUser(made, { isRequireChangePassword: true }));
      const row = await findApi('idm/users', u.userName, 'userName');
      const det = (await call('GET', `idm/users/${row.id}`)).data ?? row;
      expect(det.isRequireChangePassword, 'Cờ bắt buộc đổi mật khẩu không được lưu').toBe(true);
    } finally { await made.clean(); }
  });
  at('ATU-P08', async () => {
    const made = new Made(); const bad: string[] = [];
    try {
      // Đối chứng: mật khẩu hợp lệ phải tạo được (nếu bị từ chối vì lý do khác — vd. thiếu nhóm/role — thì không phân biệt được kiểm tra mật khẩu)
      const u0 = uname(); const ok = await retryFast(() => call('POST', 'idm/users', { body: userBody(u0) }), FAST);
      if (ok.status < 300) made.add('idm/users', u0, 'userName');
      test.skip(ok.status >= 300, `Tạo người dùng với mật khẩu hợp lệ cũng bị từ chối (${ok.status} "${ok.message}")`);
      for (const [k, pw] of Object.entries({ 'ngắn (5 ký tự)': 'Ab!1x', 'thiếu chữ hoa': 'abcdefg!12', 'thiếu chữ thường': 'ABCDEFG!12', 'thiếu chữ số': 'Abcdefgh!x', 'thiếu ký tự đặc biệt': 'Abcdefgh12', 'chứa tên đăng nhập': '' })) {
        const u = uname(); const r = await retryFast(() => call('POST', 'idm/users', { body: userBody(u, { password: pw || `${u}A!12` }) }), FAST);
        if (FAST(r)) bad.push(`${k} → không kiểm tra được (giới hạn tần suất)`);
        else if (r.status < 300) { bad.push(`${k} → ${r.status}`); made.add('idm/users', u, 'userName'); }
      }
    } finally { await made.clean(); }
    expect(bad, 'BE nhận mật khẩu vi phạm chính sách khi QTV tạo người dùng').toEqual([]);
  });
});

test.describe('ATTT ATU › Kết nối an toàn (KT 1.3.2a)', () => {
  at('ATU-H01', async () => {
    const bad: string[] = [];
    for (const p of ['/', '/api/v1/authentication/captcha']) { const r = await httpRedirect(p); if (![301, 308].includes(r.status) || !r.location.startsWith('https://')) bad.push(`${p} → ${r.status} ${r.location}`); }
    expect(bad).toEqual([]);
  });
  at('ATU-H03', async () => {
    expect(await tlsHandshake({ minVersion: 'TLSv1', maxVersion: 'TLSv1.1' }), 'Máy chủ còn chấp nhận TLS 1.0/1.1').toBe('FAIL');
    expect(await tlsHandshake({ minVersion: 'TLSv1.2' }), 'Không bắt tay được TLS ≥ 1.2').not.toBe('FAIL');
  });
});

test.describe('ATTT ATU › Nhật ký đăng nhập (KT 1.3.3a-2, NK-08)', () => {
  // Nhật ký đăng nhập/đăng xuất/phiên nay lưu riêng ở system/access-logs (màn "Nhật ký truy cập"), không ở log-audit-resource
  const USER = 'qca.attt.fail'; const PW = 'Qca!LogPw123';
  let logs: any[] | null = null;
  const failedLogin = async () => {
    if (logs) return logs;
    const a = await accessSnapshot(); const snap = await logSnapshot();
    await login({ username: USER, password: PW, captchaId: FAKE, captchaCode: '00000' });
    return (logs = [...await newAccess(a), ...await newLogs(snap)]);
  };
  at('ATU-N02', async () => {
    const l = await failedLogin();
    const hit = expectLogs(l, new RegExp(USER.replace(/\./g, '\\.'), 'i'), `đăng nhập thất bại bằng "${USER}" (system/access-logs + log-audit-resource)`);
    test.info().annotations.push({ type: 'Bằng chứng', description: txt(hit[0]).slice(0, 300) });
    expect(hit.some(h => /AUTH\.LOGIN|đăng nhập/i.test(txt(h))), 'Bản ghi không thuộc loại "Đăng nhập"').toBe(true);
    expect(hit.some(h => /"result":"Failed"|thất bại|fail/i.test(txt(h))), 'Bản ghi không thể hiện Kết quả = Thất bại').toBe(true);
    expect(hit.some(h => h.ipAddress), 'Bản ghi không có địa chỉ IP').toBe(true);
  });
  at('ATU-N04', async () => {
    const l = await failedLogin();
    test.skip(!l.length, 'Chưa có bản ghi nhật ký đăng nhập để kiểm tra (xem ATU-N02)');
    expect(l.filter(x => txt(x).includes(PW)).map(x => txt(x).slice(0, 200)), 'Nhật ký chứa mật khẩu đã nhập').toEqual([]);
  });
});
