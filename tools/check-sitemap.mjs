// 比對 dist/ 的 sitemap 與線上原站（_export/live-*.xml）：網址、lastmod、圖片、排序
// 用法：node tools/check-sitemap.mjs
import fs from 'node:fs';

const parse = x => new Map([...x.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => [
  m[1].match(/<loc>([^<]+)/)[1],
  { lm: (m[1].match(/<lastmod>([^<]+)/) || [])[1], imgs: [...m[1].matchAll(/<image:loc>([^<]+)/g)].map(i => decodeURIComponent(i[1])) },
]));
let bad = 0;
for (const g of ['page', 'new', 'medical_information', 'post_tag']) {
  const L = parse(fs.readFileSync(`_export/live-${g}.xml`, 'utf8'));
  const O = parse(fs.readFileSync(`dist/${g}-sitemap.xml`, 'utf8'));
  let lm = 0, img = 0;
  for (const [k, v] of L) {
    const o = O.get(k);
    if (!o) { console.log('  缺少', decodeURIComponent(k)); bad++; continue; }
    if (o.lm !== v.lm) { lm++; console.log('  lastmod', decodeURIComponent(k), v.lm, '→', o.lm); }
    if (v.imgs.join() !== o.imgs.join()) { img++; console.log('  圖片', decodeURIComponent(k), v.imgs.length, '→', o.imgs.length); }
  }
  for (const k of O.keys()) if (!L.has(k)) { console.log('  多出', decodeURIComponent(k)); bad++; }
  const a = [...L.keys()], b = [...O.keys()];
  const i = a.findIndex((x, j) => x !== b[j]);
  console.log(`== ${g}: 線上 ${L.size} / 本機 ${O.size}，lastmod 差異 ${lm}，圖片差異 ${img}，排序${i < 0 ? '一致' : `第 ${i} 筆起不同：${decodeURIComponent(a[i])} | ${decodeURIComponent(b[i] || '')}`}`);
  bad += lm + img + (i < 0 ? 0 : 1);
}
const idx = f => fs.readFileSync(f, 'utf8').replace(/<\?xml-stylesheet[^>]*\?>|<!--.*?-->/g, '').replace(/\s+/g, '');
console.log('== sitemap_index:', idx('_export/live-sitemap_index.xml') === idx('dist/sitemap_index.xml') ? '一致' : '不同');
process.exitCode = bad ? 1 : 0;
