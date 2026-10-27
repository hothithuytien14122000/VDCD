// Kiểm tra mỗi UC trong UC_1409 (6 page phân hệ A) có >=1 testcase.
import T from '../docs/catalog.mjs';
const UC = {
 'A.II.1': 5, 'A.II.2': 9, 'A.II.3': 3, 'A.IV.1': 7, 'A.IV.2': 9, 'A.IV.3': 6, 'A.IV.4': 11,
 'B.I.1': 5, 'B.I.2': 5, 'B.I.3': 6, 'B.I.4': 2, 'B.I.5': 2, 'B.II.1': 9, 'B.II.2': 5, 'B.II.3': 6, 'B.II.4': 2, 'B.II.5': 2, 'B.TXL': 7 };
let miss = 0;
for (const [m, n] of Object.entries(UC)) for (let i = 1; i <= n; i++) {
  const k = `${m}-UC${i}`; const c = T.filter(x => x.uc === k).length;
  if (!c) { console.log('THIẾU', k); miss++; }
}
console.log(miss ? `Còn ${miss} UC chưa có testcase` : 'Mọi UC trong UC_1409 của 6 page đều có testcase');
for (const [m, n] of Object.entries(UC)) console.log(m, Array.from({length:n},(_,i)=>T.filter(x=>x.uc===`${m}-UC${i+1}`).length).join(' '));
