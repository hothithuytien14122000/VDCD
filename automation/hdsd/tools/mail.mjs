// Đọc OTP từ hộp thư test Mailosaur (bản rút gọn của scripts/mail.ts, dùng cho script .mjs)
const env = () => { if (!process.env.MAILOSAUR_API_KEY) process.loadEnvFile('.env'); return process.env; };
const auth = () => ({ Authorization: 'Basic ' + Buffer.from(`${env().MAILOSAUR_API_KEY}:`).toString('base64'), 'Content-Type': 'application/json' });
async function latest(to) {
  const r = await fetch(`https://mailosaur.com/api/messages/search?server=${env().MAILOSAUR_SERVER_ID}&page=0&itemsPerPage=1`,
    { method: 'POST', headers: auth(), body: JSON.stringify({ sentTo: to }) });
  return (await r.json().catch(() => ({}))).items?.[0];
}
export const resetEmail = () => `qc.resetpw@${env().MAILOSAUR_SERVER_ID}.mailosaur.net`;
export const latestMailId = async (to) => (await latest(to))?.id;
export async function waitOtp(to, afterId, timeoutMs = 60000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const m = await latest(to);
    if (m && m.id !== afterId) {
      const f = await (await fetch(`https://mailosaur.com/api/messages/${m.id}?server=${env().MAILOSAUR_SERVER_ID}`, { headers: auth() })).json();
      return (f.subject + ' ' + (f.html?.body ?? '') + ' ' + (f.text?.body ?? '')).match(/\b\d{6}\b/)?.[0];
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Không nhận được mail OTP');
}
