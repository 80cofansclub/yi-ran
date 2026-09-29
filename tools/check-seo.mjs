// 比對 dist/ 與線上原站（_export/html）每一頁的 SEO 標籤
// 用法：node tools/check-seo.mjs
import fs from 'node:fs';
import path from 'node:path';

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const dec = s => { try { return decodeURIComponent(s); } catch { return s; } };
const ent = s => s?.replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&hellip;/g, '…').replace(/&#8211;/g, '–').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pick = html => {
  const m = re => ent((html.match(re) || [])[1]?.trim());
  return {
    title: m(/<title>([\s\S]*?)<\/title>/),
    description: m(/<meta name="description" content="([^"]*)"/),
    robots: m(/<meta name=["']robots["'] content=["']([^"']*)["']/),
    canonical: dec(m(/<link rel="canonical" href="([^"]*)"/) || ''),
    ogTitle: m(/<meta property="og:title" content="([^"]*)"/),
    ogDescription: m(/<meta property="og:description" content="([^"]*)"/),
    ogImage: dec(m(/<meta property="og:image" content="([^"]*)"/) || ''),
    h1: (html.match(/<h1[\s>]/g) || []).length,
  };
};
const diffCount = {};
let pages = 0;
for (const f of walk('_export/html')) {
  const d = f.replace(`_export${path.sep}html`, 'dist');
  if (!fs.existsSync(d)) { console.log('缺頁', d); continue; }
  pages++;
  const a = pick(fs.readFileSync(f, 'utf8')), b = pick(fs.readFileSync(d, 'utf8'));
  for (const k of Object.keys(a)) if (String(a[k] ?? '') !== String(b[k] ?? '')) {
    diffCount[k] = (diffCount[k] || 0) + 1;
    if (diffCount[k] <= 3) console.log(`[${k}] ${dec(f)}\n   線上: ${a[k]}\n   本機: ${b[k]}`);
  }
}
console.log(`比對 ${pages} 頁，差異：`, Object.keys(diffCount).length ? diffCount : '無');
