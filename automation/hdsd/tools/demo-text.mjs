// Thay chữ hiển thị trên trang bằng dữ liệu minh họa trước khi chụp ảnh tài liệu.
// CHỈ sửa DOM trong trình duyệt (không gọi API, không đổi dữ liệu thật) — vì môi trường test chủ yếu là dữ liệu kiểm thử
// (qc.automation …, "234", "aaaaaa"…) không phù hợp đưa vào tài liệu hướng dẫn.
// rules: [{ from: 'chuỗi' | RegExp, to: 'chuỗi' | (m, i) => chuỗi, exact?: true }]
//   exact: chỉ thay khi cả nút chữ (đã trim) đúng bằng `from`.
export async function demoText(page, rules) {
  const ser = rules.map(r => ({
    src: r.from instanceof RegExp ? r.from.source : r.from, re: r.from instanceof RegExp, flags: r.from instanceof RegExp ? r.from.flags : '',
    to: typeof r.to === 'function' ? null : r.to, list: Array.isArray(r.list) ? r.list : null, exact: !!r.exact,
  }));
  await page.evaluate((rules) => {
    const counters = rules.map(() => 0);
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
    for (const n of nodes) {
      if (n.parentElement?.closest('.__hdsd_mark')) continue;
      let t = n.nodeValue;
      rules.forEach((r, k) => {
        if (r.exact) {
          if (t.trim() === r.src) t = t.replace(r.src, r.list ? r.list[counters[k]++ % r.list.length] : r.to);
        } else if (r.re) {
          t = t.replace(new RegExp(r.src, r.flags.includes('g') ? r.flags : r.flags + 'g'), () => (r.list ? r.list[counters[k]++ % r.list.length] : r.to));
        } else if (t.includes(r.src)) t = t.split(r.src).join(r.to);
      });
      if (t !== n.nodeValue) n.nodeValue = t;
    }
    // ô nhập / placeholder có giá trị rác
    document.querySelectorAll('input, textarea').forEach(el => {
      rules.forEach(r => { if (!r.re && !r.exact && el.value && el.value.includes(r.src)) el.value = el.value.split(r.src).join(r.to); });
    });
  }, ser);
}
