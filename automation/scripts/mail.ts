// Đọc mail test qua Mailosaur (https://mailosaur.com). Cấu hình trong .env: MAILOSAUR_API_KEY, MAILOSAUR_SERVER_ID.
// Mỗi test dùng 1 địa chỉ riêng: testMail('resetpw') -> resetpw.<ts>@<serverId>.mailosaur.net
const KEY = process.env.MAILOSAUR_API_KEY, SERVER = process.env.MAILOSAUR_SERVER_ID;
const auth = () => ({ Authorization: 'Basic ' + Buffer.from(`${KEY}:`).toString('base64') });
export const mailEnabled = () => !!(KEY && SERVER);
export const testMail = (tag = 'qc') => `${tag}.${Date.now().toString(36)}@${SERVER}.mailosaur.net`;

export interface Mail { subject: string; text: string; html: string; links: string[]; codes: string[] }
const JSON_H = () => ({ ...auth(), 'Content-Type': 'application/json' });
/** Chờ mail mới gửi tới `to` (poll mỗi 2s, mặc định tối đa 60s). `afterId`: bỏ qua mail đã có trước khi gửi. */
export async function waitMail(to: string, afterId?: string, timeoutMs = 60_000): Promise<Mail> {
  if (!mailEnabled()) throw new Error('Thiếu MAILOSAUR_API_KEY / MAILOSAUR_SERVER_ID trong .env');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`https://mailosaur.com/api/messages/search?server=${SERVER}&page=0&itemsPerPage=1`,
      { method: 'POST', headers: JSON_H(), body: JSON.stringify({ sentTo: to }) });
    const m = (await r.json().catch(() => ({})) as any).items?.[0];
    if (m && m.id !== afterId) {
      const f: any = await (await fetch(`https://mailosaur.com/api/messages/${m.id}?server=${SERVER}`, { headers: auth() })).json();
      return {
        subject: f.subject ?? '', text: f.text?.body ?? '', html: f.html?.body ?? '',
        links: (f.html?.links ?? f.text?.links ?? []).map((l: any) => l.href),
        codes: (f.html?.codes ?? f.text?.codes ?? []).map((c: any) => c.value),
      };
    }
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error(`Không nhận được mail tới ${to} sau ${timeoutMs / 1000}s`);
}
/** ID mail mới nhất của địa chỉ `to` (trước khi gửi, để waitMail chỉ nhận mail mới hơn). */
export async function latestMailId(to: string): Promise<string | undefined> {
  const r = await fetch(`https://mailosaur.com/api/messages/search?server=${SERVER}&page=0&itemsPerPage=1`,
    { method: 'POST', headers: JSON_H(), body: JSON.stringify({ sentTo: to }) });
  return ((await r.json().catch(() => ({}))) as any).items?.[0]?.id;
}
/** Mã OTP 6 số trong mail (subject hoặc nội dung). */
export const otpOf = (m: Mail) => (m.subject + ' ' + m.html + ' ' + m.text).match(/\b\d{6}\b/)?.[0];
export async function clearMails() {
  await fetch(`https://mailosaur.com/api/messages?server=${SERVER}`, { method: 'DELETE', headers: auth() });
}
