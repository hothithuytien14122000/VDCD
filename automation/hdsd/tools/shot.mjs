// Thư viện chụp ảnh cho tài liệu HDSD.
// - openRole(key): mở trình duyệt với session auth/<key>.json ('anon' = chưa đăng nhập)
// - mark(page, [{ el, label }]): vẽ khung vàng + nhãn "BƯỚC n" lên phần tử (giống tài liệu mẫu)
// - shot(page, file, { marks, clip, full }): đánh dấu → chụp → gỡ đánh dấu
// Ảnh lưu tại hdsd/out/img/<thư mục>/<file>.png (đường dẫn tương đối dùng trong file .md)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const BASE = 'https://cds.geneat.pro';
export const IMG_ROOT = path.resolve('hdsd/out/img');

let browser;
export async function openRole(key, { width = 1440, height = 900 } = {}) {
  browser ??= await chromium.launch();
  const ctx = await browser.newContext({
    storageState: key === 'anon' ? undefined : `auth/${key}.json`,
    viewport: { width, height }, deviceScaleFactor: 1.5, locale: 'vi-VN',
  });
  const page = await ctx.newPage();
  return { ctx, page };
}
export async function closeAll() { await browser?.close(); browser = undefined; }

export async function go(page, route, wait = 1500) {
  await page.goto(`${BASE}/#/vi/${route.replace(/^\/+/, '')}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(wait);
}

// Vẽ khung đánh dấu. el: Locator | {x,y,width,height}; label: '1' → 'BƯỚC 1' | chữ tùy ý | '' (không nhãn)
// pos:'inside' → nhãn nằm trong khung (dùng cho vùng lớn sát mép màn hình)
// Nhãn mặc định ở góc trên-phải khung (không che tiêu đề trường); align:'left' | pos:'bottom' để đổi vị trí.
export async function mark(page, items = []) {
  const boxes = [];
  for (const it of items) {
    const el = it.el ?? it;
    let b = null;
    if (el && typeof el.boundingBox === 'function') {
      await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      b = await el.boundingBox().catch(() => null);
    } else if (el && 'x' in el) b = el;
    if (!b) { console.warn('  ! mark: không thấy phần tử', it.label ?? ''); continue; }
    const label = it.label === undefined ? '' : (/^\d+$/.test(String(it.label)) ? `BƯỚC ${it.label}` : String(it.label));
    boxes.push({ ...b, label, pad: it.pad ?? 4, pos: it.pos ?? 'top', align: it.align ?? 'right' });
  }
  await page.evaluate((boxes) => {
    for (const b of boxes) {
      const d = document.createElement('div');
      d.className = '__hdsd_mark';
      Object.assign(d.style, {
        position: 'fixed', left: `${b.x - b.pad}px`, top: `${b.y - b.pad}px`, width: `${b.width + 2 * b.pad}px`,
        height: `${b.height + 2 * b.pad}px`, border: '3px solid #F5B800', borderRadius: '6px', zIndex: 2147483646,
        pointerEvents: 'none', boxShadow: '0 0 0 1px rgba(0,0,0,.08)',
      });
      if (b.label) {
        const t = document.createElement('div');
        t.textContent = b.label;
        Object.assign(t.style, {
          position: 'absolute', [b.align === 'left' ? 'left' : 'right']: '-3px', [b.pos === 'bottom' ? 'bottom' : 'top']: '-24px', background: '#F5B800', color: '#B00000',
          font: 'bold 12px Arial, sans-serif', padding: '3px 7px', borderRadius: '4px', whiteSpace: 'nowrap',
        });
        if (b.y - b.pad < 26 && b.pos !== 'bottom') { t.style.top = 'auto'; t.style.bottom = '-24px'; }
        if (b.align !== 'left' && b.x + b.width + b.pad < 90) { t.style.right = 'auto'; t.style.left = '-3px'; }
        if (b.pos === 'inside') { Object.assign(t.style, { top: '6px', bottom: 'auto' }); t.style[b.align === 'left' ? 'left' : 'right'] = '6px'; t.style.fontSize = '13px'; }
        d.appendChild(t);
      }
      document.body.appendChild(d);
    }
  }, boxes);
}
export const unmark = (page) => page.evaluate(() => document.querySelectorAll('.__hdsd_mark').forEach(x => x.remove()));

// Chụp ảnh. file: 'admin/nguoi-dung-01' (không đuôi). opts.clip: Locator → chụp vùng của phần tử (kèm lề 12px) | {x,y,width,height}
// Bỏ tiền tố dữ liệu kiểm thử "qc.automation " khỏi chữ hiển thị (chỉ đổi DOM trong trình duyệt, không đổi dữ liệu thật)
export const cleanTestPrefix = (page) => page.evaluate(() => {
  const re = /qc\.automation\s*/gi;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, ''); re.lastIndex = 0; }
  document.querySelectorAll('input, textarea').forEach(el => { if (re.test(el.value)) el.value = el.value.replace(re, ''); re.lastIndex = 0; });
}).catch(() => {});

export async function shot(page, file, { marks = [], clip, full = false, pad = 12, keepMouse = false, clean = true } = {}) {
  const out = path.join(IMG_ROOT, `${file}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // keepMouse: true khi chụp menu mở bằng di chuột (hover) — di chuột đi sẽ làm menu đóng
  if (!keepMouse) await page.mouse.move(0, 0).catch(() => {});
  if (clean) await cleanTestPrefix(page);
  await mark(page, marks);
  await page.waitForTimeout(250);
  let opt = { path: out, fullPage: full };
  if (clip && 'x' in clip) opt.clip = clip;  // vùng chụp cố định {x,y,width,height}
  else if (clip) {
    const b = await clip.boundingBox();
    if (b) {
      const vp = page.viewportSize();
      const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad - 26); // chừa chỗ cho nhãn BƯỚC
      opt.clip = { x, y, width: Math.min(vp.width - x, b.width + 2 * pad), height: Math.min(vp.height - y, b.height + 2 * pad + 26) };
    }
  }
  await page.screenshot(opt);
  await unmark(page);
  console.log('  ✓', file);
  return out;
}

// Dropdown/Select của Ant Design đang mở
export const openDropdown = (page) => page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-dropdown:not(.ant-dropdown-hidden)').last();
export const dialog = (page) => page.locator('.ant-modal-content, .ant-drawer-content, [role="dialog"]').filter({ visible: true }).last();
// Ô nhập mật khẩu/có biểu tượng: khung bao ngoài (để đánh dấu cả ô)
export const wrap = (loc) => loc.locator('xpath=ancestor-or-self::*[contains(@class,"ant-input-affix-wrapper") or contains(@class,"ant-select") or contains(@class,"ant-picker")][1]');
export const menu = (page, text) => page.locator('.ant-menu-item, .ant-menu-submenu-title').filter({ hasText: text }).first();
