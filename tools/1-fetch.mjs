// 步驟 1：從線上 WordPress 抓原始資料（REST API + 每頁完整 HTML）到 _export/
// 用法：node tools/1-fetch.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://yiranmind.com';
const OUT = path.resolve('_export');
const UA = { 'user-agent': 'Mozilla/5.0 (site-migration-export)' };

async function get(url, asJson = false) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return asJson ? { body: await r.json(), headers: r.headers } : await r.text();
    } catch (e) {
      if (i === 2) throw e;
      await new Promise(res => setTimeout(res, 1000 * (i + 1)));
    }
  }
}

async function restAll(type) {
  const all = [];
  for (let page = 1; ; page++) {
    const { body, headers } = await get(`${ORIGIN}/wp-json/wp/v2/${type}?per_page=100&page=${page}`, true);
    all.push(...body);
    if (page >= Number(headers.get('x-wp-totalpages') || 1)) break;
  }
  return all;
}

async function sitemapUrls() {
  const index = await get(`${ORIGIN}/sitemap_index.xml`);
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const urls = new Set();
  for (const m of maps) {
    const xml = await get(m);
    for (const [, u] of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)) urls.add(u);
  }
  return [...urls];
}

// 把網址轉成本機檔名：/about/yiran/ -> about/yiran/index.html
export function urlToFile(u) {
  const p = decodeURIComponent(new URL(u).pathname);
  return path.join(p.endsWith('/') ? p : p + '/', 'index.html');
}

async function main() {
  await fs.mkdir(path.join(OUT, 'raw'), { recursive: true });

  // REST 資料
  for (const type of ['pages', 'new', 'medical_information', 'tags', 'course-category', 'media']) {
    const data = await restAll(type);
    await fs.writeFile(path.join(OUT, 'raw', `${type}.json`), JSON.stringify(data, null, 1));
    console.log(`REST ${type}: ${data.length}`);
  }

  // 所有頁面 HTML（sitemap + 列表分頁）
  const urls = await sitemapUrls();
  const queue = [...urls];
  const seen = new Set(queue);
  let n = 0;
  while (queue.length) {
    const u = queue.shift();
    let html;
    try { html = await get(u); } catch (e) { console.warn('  skip', e.message); continue; }
    const file = path.join(OUT, 'html', urlToFile(u));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, html);
    n++;
    // 追列表分頁 /page/N/
    for (const [, href] of html.matchAll(/href="(https:\/\/yiranmind\.com\/[^"#?]*?\/page\/\d+\/)"/g)) {
      if (!seen.has(href)) { seen.add(href); queue.push(href); }
    }
  }
  await fs.writeFile(path.join(OUT, 'urls.json'), JSON.stringify([...seen], null, 1));
  console.log(`HTML pages: ${n}`);
}

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main();
