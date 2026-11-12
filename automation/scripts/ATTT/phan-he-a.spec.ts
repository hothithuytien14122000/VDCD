// ATTT cấp độ 2 — PHÂN HỆ A (Quản trị hệ thống). Testcase ATA-* (testcases/docs/catalog-ATTT.mjs, sheet "ATTT mức 2").
// Bộ chung X/Q/V/W/L/S/N/H sinh bởi registerModuleSuite; phần riêng: tham số hệ thống, nhật ký truy cập, sao lưu, IP, thông tin người dùng.
import { Made, ensureOrg, ensureRole, ensureUser, findApi, code8 } from '../A/common';
import cfg from '../../accounts.mjs';
import { test, expect, at, call, rowsOf, perms, myInfo, liveRoles, FAKE, LEAK, sensitiveKeys, logSnapshot, newLogs, expectLogs, logPage, registerModuleSuite, cleanupCreated, API_BASE, txt, authzSnapshot, newAuthz, isPrivateIp } from '../attt';

const UT = 'unit-types';
// Mã loại đơn vị do hệ thống tự sinh (LDV-nnn, API bỏ qua `code` client gửi) → body không gửi code, lấy mã thật từ response.
const utBody = (o: any = {}) => ({ name: `qc.automation ATTT ${Date.now().toString(36)}${code8().slice(3)}`, adminLevel: 2, ...o });
async function makeUnitType(o: any = {}) {
  const body = utBody(o); const r = await call('POST', UT, { body });
  if (r.status >= 300) throw new Error(`tạo loại đơn vị lỗi ${r.status} ${r.message}`);
  const id = r.data?.id as string;
  const code = String(r.data?.code ?? (await call('GET', `${UT}/${id}`)).data?.code ?? id);
  return {
    id, code,
    update: async () => { const cur = (await call('GET', `${UT}/${id}`)).data ?? body; return call('PUT', `${UT}/${id}`, { body: { ...cur, name: `${body.name} sửa` } }); },
    remove: () => call('DELETE', `${UT}/${id}`),
  };
}

registerModuleSuite('ATA', {
  mods: [
    { res: 'idm/users', perm: 'USER', route: 'users' }, { res: 'idm/roles', perm: 'ROLE', route: 'roles' },
    { res: 'provinces', perm: 'PROVINCE', route: 'provinces' }, { res: 'communes', perm: 'COMMUNE', route: 'communes' },
    { res: UT, perm: 'UNIT_TYPE', route: 'unit-types' }, { res: 'organizations', perm: 'ORGANIZATION', route: 'organizations' },
    { res: 'idm/permission-matrix/roles', perm: 'ROLE_PERMISSION', route: 'permission-matrix', crud: false },
    { res: 'system/params', perm: 'SYSTEM_PARAMETER', route: 'system-config', crud: false },
    { res: 'system/backups', perm: 'BACKUP', route: 'backup', crud: false },
    { res: 'log-audit-resource', perm: 'LOG_AUDIT_RESOURCE', route: 'audit-log', crud: false },
  ],
  make: () => makeUnitType(),
  invalid: {
    res: UT, valid: () => utBody(), cleanup: cleanupCreated(UT),
    // Mã do hệ thống tự sinh (không còn nhập) → kiểm tra các trường người dùng còn nhập: Tên (≤ 255, bắt buộc), Cấp hành chính (số, miền hợp lệ), Mô tả (≤ 1.000)
    bodies: { 'tên 5.000 ký tự': utBody({ name: 'x'.repeat(5000) }), 'adminLevel là chuỗi': utBody({ adminLevel: 'abc' }), 'tên = null': utBody({ name: null }), 'tên chỉ có khoảng trắng': utBody({ name: '   ' }), 'adminLevel ngoài miền (99)': utBody({ adminLevel: 99 }), 'mô tả 1.001 ký tự': utBody({ description: 'd'.repeat(1001) }) },
  },
  biz: async () => {
    const made = new Made(); const o = await ensureOrg(made, {}, true);
    await call('PUT', `organizations/${o.id}/unlock`, { body: {} });
    return { re: new RegExp(`${o.code}|${o.id}`, 'i'), what: `khóa/mở khóa đơn vị ${o.code}`, done: () => made.clean() };
  },
  xss: async name => {
    const body = utBody({ name }); const r = await call('POST', UT, { body });
    if (r.status >= 400 && r.status < 500) return { rejected: `${r.status} ${r.message}` };
    return { route: 'unit-types', keyword: String(r.data?.code ?? body.name), done: async () => { if (r.data?.id) await call('DELETE', `${UT}/${r.data.id}`); } };
  },
  idor: async () => {
    for (const role of await liveRoles()) {
      const pm = await perms(role); const me = await myInfo(role);
      for (const [perm, res, field] of [['USER.VIEW', 'idm/users', 'organizationId'], ['ORGANIZATION.VIEW', 'organizations', 'id']] as const) {
        if (!['unit', 'unitAndChildren'].includes(pm.get(perm) ?? '')) continue;
        const other = rowsOf((await call('GET', `${res}?page=1&size=100`)).data).find((x: any) => x[field] && x[field] !== me.organizationId);
        if (other) return { role, url: `${res}/${other.id}` };
      }
    }
    return 'Không có tài khoản QC nào có quyền Xem người dùng/đơn vị theo phạm vi đơn vị (đều "all" hoặc không có quyền)';
  },
  sensitive: async () => { const made = new Made(); await ensureUser(made); await made.clean(); return [cfg.password]; },
});

// ===================== Thông tin người dùng =====================
test.describe('ATTT ATA › Dữ liệu nhạy cảm người dùng', () => {
  at('ATA-S02', async () => {
    const bad: string[] = [];
    const info = await call('GET', 'idm/users/info', { as: 'canbo' }); bad.push(...sensitiveKeys(info.data).map(k => `users/info: ${k}`));
    const list = await call('GET', 'idm/users?page=1&size=50'); bad.push(...sensitiveKeys(list.data).map(k => `users: ${k}`));
    const id = rowsOf(list.data)[0]?.id; if (id) bad.push(...sensitiveKeys((await call('GET', `idm/users/${id}`)).data).map(k => `users/{id}: ${k}`));
    expect([...new Set(bad)]).toEqual([]);
  });
});

// ===================== Tham số hệ thống (A.III.2) =====================
const params = async () => Object.fromEntries((((await call('GET', 'system/params')).data ?? []) as any[]).map(p => [p.key ?? p.code, p.value]));
// system/configurations không còn tồn tại (404) — nguồn cấu hình duy nhất là system/params
const configs = async (): Promise<Record<string, any>> => ({});
const hasCode = (o: Record<string, any>, re: RegExp, not?: RegExp) => Object.keys(o).filter(k => re.test(k) && !(not && not.test(k)));
test.describe('ATTT ATA › Tham số hệ thống', () => {
  at('ATA-C01', async () => {
    const p = await params(); const miss: string[] = [];
    if (!(Number(p.PASSWORD_MIN_LENGTH) > 0)) miss.push('PASSWORD_MIN_LENGTH');
    if (!('PASSWORD_REQUIRE_MIXED_CASE' in p) && !('PASSWORD_REQUIRE_UPPER_LOWER' in p) && !(hasCode(p, /UPPER/).length && hasCode(p, /LOWER/).length)) miss.push('chữ hoa / chữ thường');
    for (const k of ['PASSWORD_REQUIRE_NUMBER', 'PASSWORD_REQUIRE_SPECIAL_CHAR']) if (!(k in p)) miss.push(k);
    expect(miss, 'Thiếu tham số chính sách mật khẩu').toEqual([]);
  });
  at('ATA-C02', async () => {
    // Màn "Hiệu lực & đổi mật khẩu": "Yêu cầu đổi mật khẩu trước khi hết hạn" (PASSWORD_EXPIRY_WARN_DAYS) = thời gian yêu cầu thay đổi mật khẩu theo QĐ 742 mục 1.3 c)
    const p = await params();
    expect(Number(p.PASSWORD_EXPIRY_WARN_DAYS), 'PASSWORD_EXPIRY_WARN_DAYS (Yêu cầu đổi mật khẩu trước khi hết hạn)').toBeGreaterThan(0);
  });
  at('ATA-C05', async () => { expect(Number((await params()).SESSION_TIMEOUT_MINUTES), 'SESSION_TIMEOUT_MINUTES').toBeGreaterThan(0); });
  at('ATA-C06', async () => {
    const p = { ...(await params()), ...(await configs()) };
    expect(hasCode(p, /IP|CIDR|WHITELIST|ALLOWLIST|ALLOWED_NETWORK/), 'Chưa có cấu hình danh sách IP/CIDR được phép quản trị').not.toEqual([]);
  });
  at('ATA-C08', async () => {
    const a = await call('GET', 'system/params', { as: null });
    expect([401, 403], `Không token GET system/params → ${a.status} (lộ cấu hình bảo mật)`).toContain(a.status);
    const role = (await Promise.all((await liveRoles()).map(async r => [r, (await perms(r)).has('SYSTEM_PARAMETER.VIEW')] as const))).find(([, v]) => !v)?.[0];
    if (role) { const b = await call('GET', 'system/params', { as: role }); expect([401, 403], `${role} không có quyền SYSTEM_PARAMETER.VIEW → ${b.status}`).toContain(b.status); }
  });
  at('ATA-C09', async () => {
    const p = await params(); const c = await configs();
    const diff = Object.keys(c).filter(k => k in p && String(p[k]) !== String(c[k])).map(k => `${k}: parameters=${p[k]} ≠ configurations=${c[k]}`);
    expect(diff, 'Hai nguồn cấu hình mâu thuẫn').toEqual([]);
  });
});

// ===================== Nhật ký truy cập (A.III.3) =====================
test.describe('ATTT ATA › Nhật ký truy cập', () => {
  at('ATA-N08', async () => {
    const made = new Made();
    try {
      const r = await ensureRole(made); const role = ((await call('GET', 'idm/permission-matrix/roles')).data as any[]).find(x => x.name === r.name);
      const snap = await logSnapshot();
      await call('PUT', `idm/permission-matrix/roles/${role.id}`, { body: { permissions: [{ code: 'USER.VIEW', scope: 'all' }] } });
      await call('PUT', `idm/permission-matrix/roles/${role.id}`, { body: { permissions: [] } });
      expectLogs(await newLogs(snap), new RegExp(`${r.code}|${role.id}|USER\\.VIEW`, 'i'), `gán/gỡ quyền USER.VIEW cho nhóm ${r.code}`, 2);
    } finally { await made.clean(); }
  });
  at('ATA-I03', async () => {
    // log-audit-resource không có trường IP; IP được ghi ở authorization/audits (mỗi quyết định phân quyền) → tra bản ghi theo id loại đơn vị vừa xóa
    const snap = await logSnapshot(); const az = await authzSnapshot();
    const XFF = { 'X-Forwarded-For': '10.6.6.6', 'X-Real-IP': '10.6.6.6' };
    const r = await call('POST', UT, { body: utBody(), headers: XFF }); const id = r.data?.id;
    expect(r.status, `tạo loại đơn vị: ${r.message}`).toBeLessThan(300);
    await call('DELETE', `${UT}/${id}`, { headers: XFF });
    expectLogs(await newLogs(snap), new RegExp(id, 'i'), `thêm/xóa loại đơn vị ${r.data?.code} kèm X-Forwarded-For giả`);
    const hit = (await newAuthz(az)).filter(x => x.resourceId === id);   // bản ghi DELETE mang resourceId = id
    expect(hit.length, `authorization/audits không có bản ghi cho thao tác trên loại đơn vị ${id}`).toBeGreaterThan(0);
    const ips = [...new Set(hit.map(h => String(h.ipAddress ?? '')))];
    test.info().annotations.push({ type: 'Bằng chứng', description: `IP ghi nhận: ${ips.join(', ')}` });
    expect(ips.filter(ip => !ip), 'Bản ghi không có địa chỉ IP').toEqual([]);
    expect(ips.filter(ip => ip.includes('10.6.6.6')), 'Nhật ký ghi IP giả mạo do client tự gửi (X-Forwarded-For)').toEqual([]);
    expect(ips.filter(isPrivateIp), 'Nhật ký ghi IP nội bộ (reverse proxy) thay vì IP thật').toEqual([]);
  });
  at('ATA-N09', async () => {
    const before = (await logPage(1)).total;
    const x = await makeUnitType(); await x.remove(); await new Promise(f => setTimeout(f, 1500));
    const after = (await logPage(1)).total;
    expect(after, `Tổng bản ghi nhật ký trước ${before}, sau ${after} — hệ thống không ghi nhật ký thao tác`).toBeGreaterThan(before);
  });
  const openLog = async (page: any) => { await page.goto(`${API_BASE}/#/vi/audit-log`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); };
  /** Màn thật: ô tìm kiếm + nút "Bộ lọc" mở ngăn kéo "Bộ lọc nâng cao" (Sự kiện, Đơn vị, Kết quả, Khoảng thời gian). */
  const openFilter = async (page: any) => { await page.getByRole('button', { name: /Bộ lọc/ }).click(); await page.waitForTimeout(800); return page.locator('.ant-drawer-content, .ant-drawer').first().innerText(); };
  at('ATA-N12', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'auth/admin.json' }); const page = await ctx.newPage();
    try {
      await openLog(page);
      const miss: string[] = [];
      const ph = (await page.locator('input[placeholder*="Tìm"], input[placeholder*="tìm"]').first().getAttribute('placeholder').catch(() => '')) ?? '';
      if (!ph) miss.push('ô từ khóa');
      for (const [k, re] of [['tìm theo người dùng', /người dùng|tên đăng nhập/i], ['tìm theo IP', /\bIP\b/i]] as const) if (!re.test(ph)) miss.push(k);
      const d = await openFilter(page);
      if (!await page.locator('.ant-drawer input[placeholder*="Từ ngày"]').count()) miss.push('lọc Từ ngày – Đến ngày');
      for (const [k, re] of [['lọc sự kiện/hành động', /sự kiện|hành động/i], ['lọc kết quả', /kết quả/i]] as const) if (!re.test(d)) miss.push(k);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      const t = await page.locator('body').innerText();
      if (await page.locator('tbody tr.ant-table-row').count() && !/hiển thị|tổng|bản ghi/i.test(t)) miss.push('phân trang / tổng số bản ghi');
      expect(miss, 'Màn Nhật ký thiếu chức năng tra cứu').toEqual([]);
    } finally { await ctx.close(); }
  });
  at('ATA-N15', async () => {
    const id = (await logPage(1)).list[0]?.id ?? FAKE;
    const bad: string[] = [];
    for (const [m, u, b] of [['PUT', `log-audit-resource/${id}`, { description: 'qca' }], ['PATCH', `log-audit-resource/${id}`, { description: 'qca' }], ['DELETE', `log-audit-resource/${id}`], ['POST', 'log-audit-resource', { action: 'qca', description: 'giả' }]] as [string, string, any?][]) {
      const r = await call(m, u, { body: b }); if (![403, 404, 405].includes(r.status)) bad.push(`${m} ${u} → ${r.status}`);
    }
    expect(bad, 'Nhật ký sửa/xóa/chèn được qua API').toEqual([]);
  });
  at('ATA-N20', async () => {
    const bad: string[] = [];
    for (const role of await liveRoles()) { const r = await call('GET', 'log-audit-resource', { as: role }); if (![401, 403].includes(r.status)) bad.push(`${role} → ${r.status}`); }
    const pm = await perms('admin');
    for (const c of ['LOG_AUDIT_RESOURCE.VIEW', 'LOG_AUDIT_RESOURCE.EXPORT']) if (!pm.has(c)) bad.push(`thiếu mã quyền ${c}`);
    expect(bad).toEqual([]);
  });
});

// ===================== Sao lưu (A.III.1) =====================
test.describe('ATTT ATA › Sao lưu', () => {
  const backups = async () => rowsOf((await call('GET', 'system/backups?page=1&size=20')).data);
  at('ATA-D01', async () => {
    const b = await backups();
    expect(b.length, 'Chưa có bản sao lưu nào').toBeGreaterThan(0);
    const last = b[0];
    expect(last.status, `Bản sao lưu mới nhất (${last.startedDate}) lỗi: ${last.errorMessage ?? ''}`).toMatch(/success|thành công|completed/i);
    expect(Number(last.fileSizeBytes), 'Bản sao lưu không có dung lượng').toBeGreaterThan(0);
  });
  at('ATA-D06', async () => {
    const bad: string[] = [];
    for (const role of await liveRoles()) {
      const pm = await perms(role);
      if (!pm.has('BACKUP.VIEW')) { const r = await call('GET', 'system/backups', { as: role }); if (![401, 403].includes(r.status)) bad.push(`${role} GET → ${r.status}`); }
      if (!pm.has('BACKUP.DELETE')) { const r = await call('DELETE', `system/backups/${FAKE}`, { as: role }); if (r.status < 300) bad.push(`${role} DELETE → ${r.status}`); }
    }
    expect(bad).toEqual([]);
  });
});
