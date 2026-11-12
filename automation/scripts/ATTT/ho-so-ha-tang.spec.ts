// ATTT cấp độ 2 — CHUNG: Hồ sơ & Hạ tầng. Testcase ATG-* (testcases/docs/catalog-ATTT.mjs, sheet "ATTT mức 2").
// Phần lớn là kiểm tra hồ sơ/cấu hình hạ tầng (Manual). Script chỉ kiểm tra các điểm quan sát được từ Internet, không quét cổng.
import { test, expect, at, httpRedirect, tlsHandshake, API_BASE, tokenOf } from '../attt';

const get = (path: string, h: Record<string, string> = {}) => fetch(`${API_BASE}${path}`, { headers: h });
const SECRET = /(Host|Server)=[^;"']+;[^"']*Password=|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|client_secret["'\s:=]+[A-Za-z0-9_\-]{8,}|smtp[^"']{0,40}(pass|password)["'\s:=]+[^"'\s]{4,}|jwt[_-]?secret["'\s:=]+[^"'\s]{8,}/i;

test.describe('ATTT ATG › Kết nối an toàn', () => {
  at('ATG-H01', async () => {
    const r = await httpRedirect('/');
    expect([301, 308], `http:// → ${r.status}`).toContain(r.status);
    expect(r.location).toMatch(/^https:\/\//);
  });
  at('ATG-H02', async () => {
    expect(await tlsHandshake({ minVersion: 'TLSv1', maxVersion: 'TLSv1.1' }), 'Máy chủ còn chấp nhận TLS 1.0/1.1').toBe('FAIL');
  });
});

test.describe('ATTT ATG › Bí mật trong mã nguồn (UD 742-4.4)', () => {
  at('ATG-S01', async () => {
    const html = await (await get('/')).text();
    const js = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(m => m[1]);
    expect(js.length, 'Không tìm thấy tệp JS của ứng dụng').toBeGreaterThan(0);
    const hits: string[] = [];
    for (const f of js) { const s = await (await fetch(new URL(f, API_BASE))).text(); const m = s.match(SECRET); if (m) hits.push(`${f}: …${m[0].slice(0, 60)}…`); }
    expect(hits, 'Bundle FE chứa bí mật').toEqual([]);
  });
  at('ATG-S02', async () => {
    const index = await (await get('/')).text();
    const js = [...index.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
    const bad: string[] = [];
    for (const p of ['/.env', '/.git/config', '/.git/HEAD', '/appsettings.json', '/appsettings.Production.json', '/web.config', ...js.map(f => `${f}.map`)]) {
      const r = await get(p); const t = await r.text();
      if (r.status === 200 && t !== index && !/<!doctype html/i.test(t.slice(0, 50))) bad.push(`${p} → 200 (${t.slice(0, 40).replace(/\s+/g, ' ')})`);
    }
    expect(bad, 'Tệp cấu hình/mã nguồn truy cập được qua web').toEqual([]);
  });
});

test.describe('ATTT ATG › Lỗ hổng web (PM 3)', () => {
  at('ATG-W04', async () => {
    const r = await get('/api/v1/dti/pillars', { Origin: 'https://evil.example', Authorization: `Bearer ${tokenOf('canbo')}` });
    const acao = r.headers.get('access-control-allow-origin') ?? '';
    expect(['*', 'https://evil.example'], `Access-Control-Allow-Origin: ${acao}`).not.toContain(acao);
  });
});
