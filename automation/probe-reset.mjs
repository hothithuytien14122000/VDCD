// Thử flow quên mật khẩu với user qc.resetpw: node probe-reset.mjs  (cần MAILOSAUR_* trong .env)
// Mail OTP có hiệu lực 1 phút nên script lấy mã ngay sau khi gửi.
import cfg from './accounts.mjs';
const A = cfg.baseURL + '/api/v1/authentication';
const K = process.env.MAILOSAUR_API_KEY, S = process.env.MAILOSAUR_SERVER_ID;
if (!K || !S) { console.error('Thiếu MAILOSAUR_API_KEY / MAILOSAUR_SERVER_ID trong .env'); process.exit(1); }
const email = `qc.resetpw@${S}.mailosaur.net`;
const MH = { Authorization: 'Basic ' + Buffer.from(`${K}:`).toString('base64'), 'Content-Type': 'application/json' };
const post = async (p, b) => { const r = await fetch(`${A}/${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const latest = async () => (await (await fetch(`https://mailosaur.com/api/messages/search?server=${S}&page=0&itemsPerPage=1`, { method: 'POST', headers: MH, body: JSON.stringify({ sentTo: email }) })).json()).items?.[0];
const latestOtp = async (prevId) => {
  for (let i = 0; i < 20; i++) {
    const m = await latest();
    if (m && m.id !== prevId) {
      const full = await (await fetch(`https://mailosaur.com/api/messages/${m.id}?server=${S}`, { headers: MH })).json();
      const otp = (full.subject + ' ' + (full.html?.body || '')).match(/\b\d{6}\b/)?.[0];
      return { otp, subject: full.subject };
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
};
const prevId = (await latest())?.id;
const f = await post('forgot-password', { email });
console.log('forgot-password', f.s, f.j.message);
const mail = await latestOtp(prevId);
console.log('mail:', mail?.subject, '| OTP:', mail?.otp);
if (!mail?.otp) { console.error('Không lấy được OTP'); process.exit(1); }
const q = new URLSearchParams({ resetPasswordToken: mail.otp, email });
const v = await (await fetch(`${A}/verify-forgot-password-token?${q}`)).json().then(j => ({ s: 'json', j }), () => ({}));
console.log('verify', JSON.stringify(v.j ?? v).slice(0, 300));
// Đặt mật khẩu mới rồi (tùy chọn) khôi phục: node probe-reset.mjs <mậtKhẩuMới>
const newPw = process.argv[2];
if (newPw) {
  const r = await post('reset-password', { resetPasswordToken: mail.otp, password: newPw, confirmPassword: newPw });
  console.log('reset-password', r.s, r.j.message ?? JSON.stringify(r.j).slice(0, 200));
}
