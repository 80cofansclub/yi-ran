// 建置：data/*.json + content/ + src/templates → dist/（純靜態 HTML/CSS/JS）
// 用法：node tools/build.mjs
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.resolve('.');
const DIST = path.join(ROOT, 'dist');
const readJson = f => JSON.parse(fss.readFileSync(path.join(ROOT, f), 'utf8'));
const readText = f => fss.readFileSync(path.join(ROOT, f), 'utf8');
const tpl = name => readText(`src/templates/${name}.html`);
// 文章內文：.html 直接用；.md（Markdown）轉成 HTML，並加上與舊文章相同的段落 class
const postHtml = p => p.content.endsWith('.md')
  ? marked.parse(readText(p.content)).replace(/<p>/g, '<p class="wp-block-paragraph">')
  : readText(p.content);

const site = readJson('data/site.json');
const pages = readJson('data/pages.json');
const posts = readJson('data/posts.json').filter(p => !p.draft).sort((a, b) => b.date.localeCompare(a.date));
const tags = readJson('data/tags.json');
const collections = readJson('data/collections.json');
const assetReg = readJson('src/templates/assets.json');
const assetProfiles = readJson('src/templates/asset-profiles.json');
// 依素材組合輸出 <link>/<script>，順序與原站相同
const assetsHtml = (name, part) => (assetProfiles[name] || assetProfiles.home)[part].map(k => assetReg[k] ?? '').join('\n');

// ---------- 小工具 ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 與 WordPress 相同的網址編碼（小寫 %xx），確保 canonical 與舊網址一致
const encPath = p => encodeURI(p).replace(/%[0-9A-F]{2}/g, s => s.toLowerCase());
const abs = u => (u && u.startsWith('/') && !u.startsWith('//')) ? site.siteUrl + encPath(u) : u;
// 與原站 WordPress 顯示格式相同：「11 5 月, 2023」「9:04 下午」
const fmtDate = iso => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${m} 月, ${y}`; };
const fmtTime = iso => { let [h, mi] = iso.slice(11, 16).split(':').map(Number); const ap = h < 12 ? '上午' : '下午'; h = h % 12 || 12; return `${h}:${String(mi).padStart(2, '0')} ${ap}`; };
const fill = (t, vars) => t.replace(/\{\{(>\s*)?([\w:-]+)\}\}/g, (m, partial, key) => {
  if (partial) return tpl(key);
  return key in vars ? vars[key] : m;
});
// JSON-LD 裡的相對網址還原成絕對網址
const absDeep = v => Array.isArray(v) ? v.map(absDeep)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, absDeep(x)]))
  : typeof v === 'string' && /^\/(?!\/)/.test(v) ? site.siteUrl + (v === '/' ? '/' : v.replace(/[^\x00-\x7f]+/g, s => encPath(s)))
  : v;

async function out(urlPath, html) {
  const file = path.join(DIST, ...urlPath.split('/').filter(Boolean), urlPath.endsWith('.html') ? '' : 'index.html');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

// ---------- SEO <head> ----------
function seoHead(seo = {}, urlPath, fallbackTitle) {
  const title = seo.title || `${fallbackTitle} - ${site.siteName}`;
  // canonical：沿用原站設定（例如 /about/ 指向 /about/yiran/），沒設定就指向自己
  const url = seo.canonical ? site.siteUrl + (/%[0-9a-f]{2}/i.test(seo.canonical) ? seo.canonical : encPath(seo.canonical)) : site.siteUrl + encPath(urlPath);
  const m = [];
  m.push(`<title>${esc(title)}</title>`);
  if (seo.description) m.push(`<meta name="description" content="${esc(seo.description)}">`);
  m.push(`<meta name="robots" content="${esc(seo.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')}">`);
  m.push(`<link rel="canonical" href="${url}">`);
  m.push(`<meta property="og:locale" content="zh_TW">`);
  m.push(`<meta property="og:type" content="${esc(seo.ogType || 'article')}">`);
  m.push(`<meta property="og:title" content="${esc(seo.ogTitle || title)}">`);
  if (seo.ogDescription) m.push(`<meta property="og:description" content="${esc(seo.ogDescription)}">`);
  m.push(`<meta property="og:url" content="${url}">`);
  m.push(`<meta property="og:site_name" content="${esc(site.siteName)}">`);
  if (seo.publishedTime) m.push(`<meta property="article:published_time" content="${esc(seo.publishedTime)}">`);
  if (seo.modifiedTime) m.push(`<meta property="article:modified_time" content="${esc(seo.modifiedTime)}">`);
  if (seo.ogImage) {
    m.push(`<meta property="og:image" content="${esc(abs(seo.ogImage))}">`);
    if (seo.ogImageWidth) m.push(`<meta property="og:image:width" content="${esc(seo.ogImageWidth)}">`);
    if (seo.ogImageHeight) m.push(`<meta property="og:image:height" content="${esc(seo.ogImageHeight)}">`);
  }
  m.push(`<meta name="twitter:card" content="summary_large_image">`);
  if (seo.schema) m.push(`<script type="application/ld+json" class="yoast-schema-graph">${JSON.stringify(absDeep(seo.schema)).replace(/</g, '\\u003c')}</script>`);
  return m.join('\n');
}

// 分頁的 SEO：與 Yoast 相同格式「諮商部落 彙整 - 第 2 頁，總計 5 頁 - 怡然心理治療所」
function pagedSeo(seo = {}, fallbackTitle, page, total) {
  const base = (seo.title || fallbackTitle).replace(` - ${site.siteName}`, '');
  const title = `${base} - 第 ${page} 頁，總計 ${total} 頁 - ${site.siteName}`;
  return { ...seo, title, ogTitle: title, ogDescription: undefined, schema: undefined, canonical: undefined };
}

// ---------- 版面組裝 ----------
function renderPage({ urlPath, seo, title, bodyClass, header = 'page', popup = false, main, assets = 'home' }) {
  return fill(tpl('layout'), {
    headAssets: assetsHtml(assets, 'head'),
    footScripts: assetsHtml(assets, 'foot'),
    seo: seoHead(seo, urlPath, title),
    bodyClass: esc(bodyClass || ''),
    header: tpl(header === 'post' ? 'header-post' : 'header-page'),
    popup: popup ? tpl('popup') : '',
    main: expandPostMarkers(main),
  }).replace(/(<form[^>]*class="mobile-searchform"[^>]*action=")\/(")/, '$1/search/$2');
}

// 文章卡片（沿用 Elementor 的 markup，外觀與原站相同）
function imgTag(fi, cls = 'attachment-full size-full') {
  if (!fi) return '';
  const variants = [fi.sizes?.full || { src: fi.src, width: fi.width }, ...Object.entries(fi.sizes || {}).filter(([k]) => !['full', 'thumbnail'].includes(k)).map(([, v]) => v)];
  const srcset = [...new Map(variants.filter(v => v.width).map(v => [v.src, `${encPath(v.src)} ${v.width}w`])).values()].join(', ');
  return `<img loading="lazy" decoding="async" width="${fi.width || ''}" height="${fi.height || ''}" src="${encPath(fi.src)}" class="${cls}" alt="${esc(fi.alt)}"${srcset ? ` srcset="${srcset}" sizes="(max-width: ${fi.width}px) 100vw, ${fi.width}px"` : ''}>`;
}
// 文章卡片：套用 src/templates/cards/<樣板>.html（各列表沿用原站自己的卡片長相）
function cardImg(fi, size, mode, attrs) {
  const v = fi.sizes?.[size] || fi.sizes?.full || { src: fi.src, width: fi.width, height: fi.height };
  const variants = [fi.sizes?.full || { src: fi.src, width: fi.width }, ...Object.entries(fi.sizes || {}).filter(([k]) => !['full', 'thumbnail'].includes(k)).map(([, x]) => x)];
  const srcset = mode === 'srcset'
    ? [...new Map(variants.filter(x => x.width && x.width <= v.width).map(x => [x.src, `${encPath(x.src)} ${x.width}w`])).values()].join(', ')
    : '';
  return `<img ${attrs ? attrs + ' ' : ''}width="${v.width}" height="${v.height}" src="${encPath(v.src)}" class="attachment-${size} size-${size}${fi.id ? ` wp-image-${fi.id}` : ''}" alt="${esc(fi.alt)}"${srcset ? ` srcset="${srcset}" sizes="(max-width: ${v.width}px) 100vw, ${v.width}px"` : ''}>`;
}
function card(p, tplId = 'archive') {
  let html = tpl(`cards/${tplId}`);
  if (!p.featuredImage) html = html.replace(/<!--thumb-->[\s\S]*?<!--\/thumb-->/, '');
  const vars = {
    id: p.id, type: p.type, url: encPath(p.path), title: esc(p.title), date: fmtDate(p.date), excerpt: esc(p.excerpt),
    thumbClass: p.featuredImage ? 'has-post-thumbnail' : '',
  };
  return html
    .replace(/\{\{img:([\w-]+):(\w+):([^}]*)\}\}/, (_, size, mode, attrs) => cardImg(p.featuredImage, size, mode, attrs.trim()))
    .replace(/\{\{excerpt:(\d+)\}\}/g, (_, n) => esc(p.excerptOverrides?.[n] ?? [...p.excerpt].slice(0, +n).join('')))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m)
    .replace(/<!--\/?thumb-->/g, '').trim();
}
// 內容中的站內圖片（給 sitemap 的 image:image 用）；與 Yoast 相同用原圖（去掉 -1024x576 這類縮圖尺寸）
const imagesIn = html => [...html.matchAll(/<img[^>]+src="(\/wp-content\/uploads\/[^"]+)"/g)].map(m => decodeURI(m[1]).replace(/-\d+x\d+(?=\.\w+$)/, ''));
// 最後修改時間（UTC）；新文章沒填 modifiedGmt 時由台灣時間換算
const gmt = p => p.modifiedGmt || new Date((p.modified || p.date) + '+08:00').toISOString().slice(0, 19);
const expandPostMarkers = html => html.replace(/\{\{posts:(\w+):(\d+):(\w+)\}\}/g, (_, type, n, tplId) =>
  posts.filter(p => p.type === type).slice(0, +n).map(p => card(p, tplId)).join('\n'));

function breadcrumbs(items) {
  const parts = items.map((it, i) => i === items.length - 1
    ? `<span class="breadcrumb_last" aria-current="page">${esc(it.name)}</span>`
    : `<span><a href="${encPath(it.path)}">${esc(it.name)}</a></span>`);
  return `<p id="breadcrumbs"><span>${parts.join(' » ')}</span></p>`;
}

// withPrevNext：頁面內的文章列表（/news/）原站有「« Previous / Next »」；彙整頁只有數字
function pagination(basePath, page, total, seg = 'page/', withPrevNext = false) {
  if (total <= 1) return '';
  const link = n => encPath(n === 1 ? basePath : `${basePath}${seg}${n}/`);
  const items = [];
  if (withPrevNext) items.push(page > 1 ? `<a class="page-numbers prev" href="${link(page - 1)}">« Previous</a>` : '<span class="page-numbers prev">« Previous</span>');
  for (let n = 1; n <= total; n++) {
    items.push(n === page
      ? `<span aria-current="page" class="page-numbers current"><span class="elementor-screen-only">頁面</span>${n}</span>`
      : `<a class="page-numbers" href="${link(n)}"><span class="elementor-screen-only">頁面</span>${n}</a>`);
  }
  if (withPrevNext) items.push(page < total ? `<a class="page-numbers next" href="${link(page + 1)}">Next »</a>` : '<span class="page-numbers next">Next »</span>');
  return `<nav class="elementor-pagination" aria-label="分頁">${items.join('\n')}</nav>`;
}

// ---------- 產出 ----------
async function build() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.cp(path.join(ROOT, 'public'), DIST, { recursive: true });
  await fs.cp(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'), { recursive: true });
  // sitemap 分組：與原站 Yoast 相同（page / new / medical_information / post_tag）
  const sitemap = { page: [], new: [], medical_information: [], post_tag: [] };
  const home = { name: site.siteName, path: '/' };

  // 1) 一般頁面
  const NAV_RE = /<nav class="elementor-pagination"[\s\S]*?<\/nav>/;
  for (const p of pages) {
    const content = readText(p.content);
    const marker = content.match(/\{\{posts:(\w+):(\d+):(\w+)\}\}/);
    // 含「文章列表 + 分頁」的頁面（例如 /news/、/information/）：依文章數自動產生 /news/2/、/news/3/…
    const total = marker && NAV_RE.test(content) ? Math.ceil(posts.filter(x => x.type === marker[1]).length / +marker[2]) : 1;
    for (let page = 1; page <= total; page++) {
      const urlPath = page === 1 ? p.path : `${p.path}${page}/`;
      let main = content;
      if (total > 1) {
        const n = +marker[2];
        main = main.replace(marker[0], posts.filter(x => x.type === marker[1]).slice((page - 1) * n, page * n).map(x => card(x, marker[3])).join('\n'))
          .replace(NAV_RE, pagination(p.path, page, total, '', true))
          .replace(/data-page="\d+" data-max-page="\d+" data-next-page="[^"]*"/, '');
      }
      const seo = page === 1 ? p.seo : pagedSeo(p.seo, p.title, page, total);
      await out(urlPath, renderPage({ urlPath, seo, title: p.title, bodyClass: p.bodyClass, header: p.header, popup: p.popup, assets: p.assets, main }));
    }
    if (!p.noindex && p.sitemap !== false) sitemap.page.push({ loc: p.path, lastmod: p.sitemapLastmod || gmt(p), order: p.path === '/' ? '' : gmt(p), rawImages: p.sitemapImages, images: imagesIn(content) });
  }

  // 2) 單篇文章
  for (const type of ['medical_information', 'new']) {
    const list = posts.filter(p => p.type === type);
    const coll = collections[type];
    list.forEach((p, i) => {
      const older = list[i + 1], newer = list[i - 1];
      const nav = `<div class="elementor-post-navigation" role="navigation" aria-label="文章導覽">
<div class="elementor-post-navigation__prev elementor-post-navigation__link">${older ? `<a href="${encPath(older.path)}" rel="prev"><span class="post-navigation__arrow-wrapper post-navigation__arrow-prev"><i aria-hidden="true" class="fas fa-angle-left"></i><span class="elementor-screen-only">上一頁</span></span><span class="elementor-post-navigation__link__prev"><span class="post-navigation__prev--label">上一篇</span><span class="post-navigation__prev--title">${esc(older.title)}</span></span></a>` : ''}</div>
<div class="elementor-post-navigation__next elementor-post-navigation__link">${newer ? `<a href="${encPath(newer.path)}" rel="next"><span class="elementor-post-navigation__link__next"><span class="post-navigation__next--label">下一篇</span><span class="post-navigation__next--title">${esc(newer.title)}</span></span><span class="post-navigation__arrow-wrapper post-navigation__arrow-next"><i aria-hidden="true" class="fas fa-angle-right"></i><span class="elementor-screen-only">下一篇</span></span></a>` : ''}</div>
</div>`;
      const tagObjs = p.tags.map(s => tags.find(t => t.slug === s)).filter(Boolean);
      let body = fill(tpl(`single-${type}`), {
        title: esc(p.title),
        date: fmtDate(p.date),
        time: fmtTime(p.date),
        tagLinks: tagObjs.map(t => `<a href="${encPath(t.path)}" class="elementor-post-info__terms-list-item">${esc(t.name)}</a>`).join(', '),
        featuredImage: imgTag(p.featuredImage, 'attachment-large size-large'),
        content: postHtml(p),
        breadcrumbs: breadcrumbs([home, { name: coll.breadcrumbName, path: coll.path }, { name: p.title }]),
        postNavigation: nav,
        fbHref: `${site.siteUrl}?p=${p.id}`,
      });
      if (!tagObjs.length) body = body.replace(/<li[^>]*data-if-tags=""[\s\S]*?<\/li>/, '');
      const seo = { ...p.seo };
      if (!seo.title) Object.assign(seo, { title: `${p.title} - ${site.siteName}`, description: [...p.excerpt].slice(0, 80).join(''), ogImage: p.featuredImage?.src, publishedTime: p.date + '+08:00', modifiedTime: p.modified + '+08:00' });
      pendingSingles.push(out(p.path, renderPage({ urlPath: p.path, seo, title: p.title, bodyClass: p.bodyClass, header: 'post', assets: p.assets, main: body })));
      if (!/noindex/.test(p.seo?.robots || '')) sitemap[type].push({ loc: p.path, lastmod: p.sitemapLastmod || gmt(p), order: gmt(p), rawImages: p.sitemapImages, images: [p.featuredImage?.src, ...imagesIn(postHtml(p))] });
    });
  }
  await Promise.all(pendingSingles);

  // 3) 列表頁（含分頁）與標籤頁
  async function archive({ basePath, list, title, crumbName, perPage, bodyClass, seo, assets, group }) {
    const total = Math.max(1, Math.ceil(list.length / perPage));
    for (let page = 1; page <= total; page++) {
      const urlPath = page === 1 ? basePath : `${basePath}page/${page}/`;
      const crumbs = page === 1 ? [home, { name: crumbName }] : [home, { name: crumbName, path: basePath }, { name: `第 ${page} 頁` }];
      const main = fill(tpl('archive'), {
        archiveTitle: esc(title),
        breadcrumbs: breadcrumbs(crumbs),
        postCards: list.slice((page - 1) * perPage, page * perPage).map(p => card(p, 'archive')).join('\n'),
        pagination: pagination(basePath, page, total),
      });
      const pSeo = page === 1 ? seo : pagedSeo(seo, title, page, total);
      await out(urlPath, renderPage({ urlPath, seo: pSeo, title, bodyClass, header: 'page', assets, main }));
    }
    const lastmod = list.map(gmt).sort().pop();
    sitemap[group].push({ loc: basePath, lastmod, order: group === 'post_tag' ? String(tags.findIndex(t => t.path === basePath)).padStart(4, '0') : '' });
  }
  for (const type of ['medical_information', 'new']) {
    const c = collections[type];
    await archive({ basePath: c.path, list: posts.filter(p => p.type === type), title: c.archiveTitle, crumbName: c.breadcrumbName, perPage: c.perPage, bodyClass: c.bodyClass, seo: c.seo, assets: c.assets, group: type });
  }
  for (const t of tags) {
    const list = posts.filter(p => p.tags.includes(t.slug));
    if (!list.length) continue;
    await archive({ basePath: t.path, list, title: `標籤：${t.name}`, crumbName: t.name, perPage: collections.tag.perPage, bodyClass: collections.tag.bodyClass, seo: t.seo, assets: collections.tag.assets, group: 'post_tag' });
  }

  // 4) 站內搜尋頁 + 搜尋索引（JSON）
  await fs.writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(posts.map(p => ({
    t: p.title, u: encPath(p.path), d: p.date.slice(0, 10), e: [...p.excerpt].slice(0, 60).join(''),
    x: postHtml(p).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500),
  }))));
  const simpleMain = inner => `<div class="site-simple-page">${inner}</div>`;
  await out('/search/', renderPage({ urlPath: '/search/', seo: { title: `站內搜尋 - ${site.siteName}`, robots: 'noindex, follow' }, title: '站內搜尋', bodyClass: 'search', main: simpleMain(`
<h1>站內搜尋</h1>
<form class="site-search-form" action="/search/" method="get" role="search">
<input type="search" name="s" placeholder="輸入關鍵字，例如：失眠、伴侶諮商" aria-label="搜尋關鍵字">
<button type="submit">搜尋</button>
</form>
<div id="site-search-results" aria-live="polite"></div>`) }));

  // 5) 404
  await out('/404.html', renderPage({ urlPath: '/404.html', seo: { title: `找不到頁面 - ${site.siteName}`, robots: 'noindex, follow' }, title: '找不到頁面', bodyClass: 'error404', main: simpleMain(`
<h1>找不到這個頁面</h1>
<p>網址可能已變更。您可以回到 <a href="/">首頁</a>、瀏覽 <a href="/medical_information/">諮商部落</a>，或來電 <a href="tel:${site.phone}">${site.phone}</a> 預約。</p>`) }));

  // 6) sitemap（Yoast 格式：sitemap_index.xml + 分類 sitemap，含圖片）/ robots.txt
  const utc = t => t ? t + '+00:00' : '';
  const index = [];
  for (const [group, list] of Object.entries(sitemap)) {
    list.sort((a, b) => String(a.order).localeCompare(String(b.order), 'en', { numeric: true }));
    const urls = list.map(u => {
      // sitemapImages（從原站沿用）已是編碼好的網址，原樣輸出；自動抽取的才去重、編碼
      const imgs = u.rawImages ? u.rawImages.map(i => site.siteUrl + i) : [...new Set(u.images?.filter(Boolean) || [])].map(abs);
      return '\t<url>\n'
        + '\t\t<loc>' + site.siteUrl + encPath(u.loc) + '</loc>\n'
        + '\t\t<lastmod>' + utc(u.lastmod) + '</lastmod>\n'
        + imgs.map(i => '\t\t<image:image>\n\t\t\t<image:loc>' + esc(abs(i)) + '</image:loc>\n\t\t</image:image>\n').join('')
        + '\t</url>';
    });
    await fs.writeFile(path.join(DIST, group + '-sitemap.xml'),
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls.join('\n') + '\n</urlset>\n');
    index.push({ loc: '/' + group + '-sitemap.xml', lastmod: list.map(u => u.lastmod).sort().pop() });
  }
  const indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + index.map(x => '\t<sitemap>\n\t\t<loc>' + site.siteUrl + x.loc + '</loc>\n\t\t<lastmod>' + utc(x.lastmod) + '</lastmod>\n\t</sitemap>').join('\n')
    + '\n</sitemapindex>\n';
  await fs.writeFile(path.join(DIST, 'sitemap_index.xml'), indexXml);
  await fs.writeFile(path.join(DIST, 'sitemap.xml'), indexXml); // 常見預設網址也給索引檔
  await fs.writeFile(path.join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /search/\n\nSitemap: ' + site.siteUrl + '/sitemap_index.xml\n');
  await fs.writeFile(path.join(DIST, 'CNAME'), new URL(site.siteUrl).host + '\n');
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');
  await fs.writeFile(path.join(DIST, 'assets', 'site-config.json'), JSON.stringify({ form: site.form, phone: site.phone }));

  console.log(`built: ${pages.length} pages, ${posts.length} posts, ${Object.values(sitemap).flat().length} sitemap urls → dist/`);
}
const pendingSingles = [];
build();
