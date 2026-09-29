// 步驟 2：把 _export/ 的原始資料拆成「版型 + JSON 資料 + 內容片段」，並下載所有靜態素材
// 用法：node tools/2-extract.mjs            （完整：拆解 + 下載素材）
//       node tools/2-extract.mjs --no-assets （只拆解，不下載）
// 這支是「一次性搬家工具」，搬完之後日常維運只需要改 data/ 與 content/，不需要再跑。
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://yiranmind.com';
const EXP = path.resolve('_export');
const ROOT = path.resolve('.');
const DL_ASSETS = !process.argv.includes('--no-assets');

const readJson = async f => JSON.parse(await fs.readFile(f, 'utf8'));
const write = async (f, s) => { await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, s); };
const writeJson = (f, o) => write(f, JSON.stringify(o, null, 2) + '\n');

// ---------- 共用轉換 ----------
function decodeCfEmail(hex) {
  const k = parseInt(hex.slice(0, 2), 16);
  let s = '';
  for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ k);
  return s;
}

// 線上絕對網址 → 站內根目錄相對網址；順便還原 Cloudflare 的 email 混淆
function localize(html) {
  return html
    .replace(/https?:\/\/yiranmind\.com\//g, '/')
    .replace(/https?:\\\/\\\/yiranmind\.com\\\//g, '\\/')
    .replace(/(["'])https?:\/\/yiranmind\.com\1/g, '$1/$1')
    .replace(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/g, (_, h) => 'mailto:' + decodeCfEmail(h))
    // 原站信箱連結同時寄給維運廠商，解約後只保留診所信箱
    .replace(/,\s*yclin925@iwangoweb\.com/g, '')
    // 表單的 reCAPTCHA 欄位：移除原站（廠商申請）的金鑰，改由 site.js 依 data/site.json 的金鑰啟用
    .replace(/class="elementor-g-recaptcha"\s+data-sitekey="[^"]*"/g, 'class="site-recaptcha"')
    .replace(/<(a|span)([^>]*?)class="__cf_email__"[^>]*data-cfemail="([0-9a-f]+)"[^>]*>[^<]*<\/\1>/g,
      (_, t, pre, h) => decodeCfEmail(h));
}

function walk(d) {
  return fss.readdirSync(d, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
}

// 本機檔 → 網址路徑（/about/yiran/）
const fileToPath = f => '/' + path.relative(path.join(EXP, 'html'), path.dirname(f)).split(path.sep).filter(Boolean).map(s => s + '/').join('');
const load = f => cheerio.load(fss.readFileSync(f, 'utf8'), { decodeEntities: false });
const pathToHtmlFile = p => path.join(EXP, 'html', ...decodeURIComponent(p).split('/').filter(Boolean), 'index.html');

// WordPress 專屬、靜態站用不到的東西
function stripWpJunk($) {
  $('link[rel="https://api.w.org/"], link[rel=EditURI], link[rel=shortlink], link[rel=profile], link[rel=alternate], meta[name=generator], link[rel=pingback]').remove();
  $('#wp-emoji-settings, script:contains("wp-emoji-settings"), script[type=speculationrules], style#wp-emoji-styles-inline-css').remove();
  $('script[src*="cdn-cgi"], script#elementor-recaptcha_v3-api-js, script[src*="recaptcha"]').remove();
}

// ---------- SEO：從頁面 <head> 抽出 ----------
function extractSeo($) {
  const m = sel => $(sel).attr('content') || undefined;
  const schema = $('script.yoast-schema-graph').html();
  return {
    title: $('title').text().trim(),
    canonical: $('link[rel=canonical]').attr('href')?.replace(ORIGIN, '') || undefined,
    description: m('meta[name=description]'),
    robots: m('meta[name=robots]'),
    ogType: m('meta[property="og:type"]'),
    ogTitle: m('meta[property="og:title"]'),
    ogDescription: m('meta[property="og:description"]'),
    ogImage: $('meta[property="og:image"]').first().attr('content')?.replace(ORIGIN, '') || undefined,
    ogImageWidth: m('meta[property="og:image:width"]'),
    ogImageHeight: m('meta[property="og:image:height"]'),
    publishedTime: m('meta[property="article:published_time"]'),
    modifiedTime: m('meta[property="article:modified_time"]'),
    schema: schema ? JSON.parse(schema) : undefined,
  };
}

// ---------- 文章卡片樣板 ----------
// 每個列表小工具的卡片長得不一樣（側欄只有小縮圖、首頁有摘要…），
// 所以直接拿原站該小工具的第一張卡片，把文章資料換成 {{變數}}，存成 src/templates/cards/<id>.html
const cardTemplates = {};
function templatizeCard($, article) {
  // 摘要字數 = 原站該列表中最長的摘要字數（WordPress 以「字」截斷中文）
  const excerptLen = Math.max(0, ...$(article).parent().find('.elementor-post__excerpt').map((_, e) => [...$(e).text().trim()].length).get());
  const $a = $(article).clone();
  const url = $a.find('.elementor-post__title a').attr('href');
  $a.attr('class', ($a.attr('class') || '')
    .replace(/\bpost-\d+\b/, 'post-{{id}}')
    .replace(/\b(medical_information|new)\b/g, '{{type}}')
    .replace(/\s*\btag-\d+\b/g, '')
    .replace(/\bhas-post-thumbnail\b/, '{{thumbClass}}'));
  $a.find('a').each((_, el) => { if (el.attribs.href === url) el.attribs.href = '{{url}}'; });
  $a.find('.elementor-post__title a').text('{{title}}');
  $a.find('.elementor-post-date').text('{{date}}');
  $a.find('.elementor-post__excerpt').html(`<p>{{excerpt:${excerptLen}}}</p>`);
  $a.find('.elementor-post__read-more').attr('aria-label', 'Read more about {{title}}');
  const $img = $a.find('.elementor-post__thumbnail img');
  // 圖片載入屬性（loading="lazy"、fetchpriority="high"）WordPress 依「第幾張圖」決定，
  // 記下原站這個列表每個位置的屬性，建置時依位置套用（超過的沿用最後一個）
  const loadAttrs = $(article).parent().find('article .elementor-post__thumbnail img').map((_, im) =>
    Object.keys(im.attribs).filter(k => ['loading', 'fetchpriority', 'decoding'].includes(k)).map(k => `${k}="${im.attribs[k]}"`).join(' ')).get();
  if ($img.length) {
    const size = (($img.attr('class') || '').match(/\bsize-([\w-]+)/) || [])[1] || 'full';
    $img.replaceWith(`{{img:${size}:${$img.attr('srcset') ? 'srcset' : 'plain'}}}`);
    $a.find('.elementor-post__thumbnail__link').before('<!--thumb-->').after('<!--/thumb-->');
  }
  return `<!--img-load-attrs:${JSON.stringify(loadAttrs)}-->\n` + localize($.html($a));
}
// 首頁/側欄的「最新文章」小工具 → 換成建置時產生的標記 {{posts:類型:篇數:卡片樣板}}
function markPostsWidgets($, scope) {
  $(scope).find('.elementor-widget-posts').each((_, w) => {
    const $w = $(w);
    const links = $w.find('article .elementor-post__title a').map((i, a) => a.attribs.href).get();
    const type = links[0]?.includes('/medical_information/') ? 'medical_information' : 'new';
    const id = $w.attr('data-id');
    const first = $w.find('article').first();
    if (first.length) cardTemplates[id] ??= templatizeCard($, first);
    $w.find('.elementor-posts-container').html(`{{posts:${type}:${links.length || 3}:${id}}}`);
  });
}

async function main() {
  const files = walk(path.join(EXP, 'html'));
  const raw = {
    pages: await readJson(path.join(EXP, 'raw/pages.json')),
    new: await readJson(path.join(EXP, 'raw/new.json')),
    medical_information: await readJson(path.join(EXP, 'raw/medical_information.json')),
    tags: await readJson(path.join(EXP, 'raw/tags.json')),
    media: await readJson(path.join(EXP, 'raw/media.json')),
  };
  const mediaById = new Map(raw.media.map(m => [m.id, m]));
  // 原站 Yoast sitemap 每個網址的 lastmod 與圖片，原樣沿用，讓 Google 看到的 sitemap 與搬家前一致
  const liveSitemap = new Map();
  for (const g of ['page', 'new', 'medical_information']) {
    const f = path.join(EXP, `live-${g}.xml`);
    if (!fss.existsSync(f)) continue;
    for (const [, u] of fss.readFileSync(f, 'utf8').matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const loc = decodeURIComponent(new URL(u.match(/<loc>([^<]+)/)[1]).pathname);
      liveSitemap.set(loc, {
        lastmod: (u.match(/<lastmod>([^<+]+)/) || [])[1],
        images: [...u.matchAll(/<image:loc>([^<]+)/g)].map(m => m[1].replace(ORIGIN, '')),
      });
    }
  }
  const liveImages = { get: p => liveSitemap.get(p)?.images };
  const liveLastmod = (p, fallback) => liveSitemap.get(p)?.lastmod || fallback;

  // ===== 1. 共用版型 =====
  // 每頁載入的 CSS / JS「清單與順序」必須和原站一模一樣，否則 CSS 疊加結果會跑掉。
  // 做法：所有 <link>/<style>/<script> 收進 assets.json（key → HTML），
  //       相同清單的頁面共用一個「素材組合」(profile)，頁面資料只記 profile 名稱。
  const registry = {};
  const profiles = {};
  const profileByFile = new Map();
  const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
  const keyOf = ($, el) => el.attribs.id || el.attribs.href?.replace(/\?.*/, '') || el.attribs.src?.replace(/\?.*/, '') || 'inline-' + hash($(el).html());
  for (const f of files) {
    const $ = load(f);
    stripWpJunk($);
    const list = { head: [], foot: [] };
    $('head').children('link[rel=stylesheet], style, script').each((_, el) => {
      if ($(el).is('.yoast-schema-graph')) return;
      const k = keyOf($, el); registry[k] ??= localize($.html(el)); list.head.push(k);
    });
    $('body').children('script').each((_, el) => {
      const k = keyOf($, el); registry[k] ??= localize($.html(el)); list.foot.push(k);
    });
    const sig = JSON.stringify(list);
    let name = Object.keys(profiles).find(n => JSON.stringify(profiles[n]) === sig);
    if (!name) {
      const p = fileToPath(f);
      name = p === '/' ? 'home' : p.split('/').filter(Boolean).slice(0, 2).join('--');
      if (profiles[name]) name += '-' + Object.keys(profiles).length;
      profiles[name] = list;
    }
    profileByFile.set(path.resolve(f), name);
  }
  const profileOf = urlPath => profileByFile.get(path.resolve(pathToHtmlFile(urlPath)));
  const headAssets = '', footScripts = '';

  // 以「怡然簡介」頁當外框樣板
  const $s = load(pathToHtmlFile('/about/yiran/'));
  stripWpJunk($s);
  const headerPage = $s.html($s('#site-header'));
  const footer = $s.html($s('footer[data-elementor-type=footer]'));
  const bodyOpen = $s('body').children('noscript').first();
  const afterWrap = $s('body').children('#scroll-top, #sidr-close, #mobile-menu-search');
  const $art = load(pathToHtmlFile('/medical_information/insomnia/'));
  const headerPost = $art.html($art('#site-header'));
  const $home = load(pathToHtmlFile('/'));
  const popupFile = files.find(f => fss.readFileSync(f, 'utf8').includes('data-elementor-type="popup"'));
  const $pop = popupFile ? load(popupFile) : null;
  const popup = $pop ? $pop.html($pop('[data-elementor-type=popup]')) : '';

  const layout = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{{seo}}
{{headAssets}}
<link rel="stylesheet" href="/assets/site.css">
</head>
<body class="{{bodyClass}}" itemscope="itemscope" itemtype="https://schema.org/WebPage">
${$s.html(bodyOpen)}
<div id="outer-wrap" class="site clr">
<a class="skip-link screen-reader-text" href="#main">跳至主要內容</a>
<div id="wrap" class="clr">
{{header}}
<main id="main" class="site-main clr" role="main">
{{main}}
</main>
{{footer}}
</div>
</div>
${afterWrap.map((_, e) => $s.html(e)).get().join('\n')}
{{popup}}
{{footScripts}}
<script src="/assets/site.js" defer></script>
</body>
</html>
`;

  // ===== 2. 文章單篇樣板（諮商部落 / 最新消息）=====
  function singleTemplate(file) {
    const $ = load(file);
    const $t = $('[data-elementor-type=single]');
    const set = (w, v) => $t.find(`.elementor-widget-${w} > .elementor-widget-container`).html(v);
    set('theme-post-title', '<h1 class="elementor-heading-title elementor-size-default">{{title}}</h1>');
    $t.find('.elementor-widget-post-info .elementor-post-info__item--type-date time').text('{{date}}');
    $t.find('.elementor-widget-post-info .elementor-post-info__item--type-time time').text('{{time}}');
    // 日期原本連到 WordPress 日期彙整頁（線上也是 404），拿掉連結
    $t.find('.elementor-widget-post-info li[itemprop=datePublished] > a').each((_, a) => { $(a).replaceWith($(a).html()); });
    $t.find('.elementor-widget-post-info .elementor-post-info__terms-list').html('{{tagLinks}}');
    $t.find('.elementor-widget-post-info .elementor-post-info__item--type-terms').closest('li').attr('data-if-tags', '');
    set('theme-post-featured-image', '{{featuredImage}}');
    set('theme-post-content', '{{content}}');
    set('breadcrumbs', '{{breadcrumbs}}');
    set('post-navigation', '{{postNavigation}}');
    $t.find('.fb-like, .fb-comments').attr('data-href', '{{fbHref}}');
    markPostsWidgets($, $t);
    return localize($.html($t));
  }

  // ===== 3. 列表頁樣板 =====
  const $arc = load(pathToHtmlFile('/medical_information/'));
  const $a = $arc('[data-elementor-type=archive]');
  $a.find('.elementor-widget-theme-archive-title .elementor-heading-title').text('{{archiveTitle}}');
  $a.find('.elementor-widget-breadcrumbs > .elementor-widget-container').html('{{breadcrumbs}}');
  cardTemplates.archive = templatizeCard($arc, $a.find('.elementor-widget-archive-posts article').first());
  $a.find('.elementor-widget-archive-posts .elementor-posts-container').html('{{postCards}}');
  $a.find('.elementor-widget-archive-posts nav.elementor-pagination').replaceWith('{{pagination}}');
  const archiveTpl = localize($arc.html($a));

  const T = path.join(ROOT, 'src/templates');
  await write(path.join(T, 'layout.html'), localize(layout));
  await writeJson(path.join(T, 'assets.json'), registry);
  await writeJson(path.join(T, 'asset-profiles.json'), profiles);
  await write(path.join(T, 'header-page.html'), localize(headerPage));
  await write(path.join(T, 'header-post.html'), localize(headerPost));
  await write(path.join(T, 'footer.html'), localize(footer));
  await write(path.join(T, 'popup.html'), localize(popup || ''));
  await write(path.join(T, 'single-medical_information.html'), singleTemplate(pathToHtmlFile('/medical_information/insomnia/')));
  await write(path.join(T, 'single-new.html'), singleTemplate(pathToHtmlFile('/new/counseling-logo/')));
  await write(path.join(T, 'archive.html'), archiveTpl);

  // ===== 4. 一般頁面（Elementor 排版頁）=====
  const pages = [];
  for (const p of raw.pages) {
    const urlPath = new URL(p.link).pathname;
    const file = pathToHtmlFile(urlPath);
    if (!fss.existsSync(file)) { console.warn('page html missing', urlPath); continue; }
    const $ = load(file);
    stripWpJunk($);
    markPostsWidgets($, 'main#main');
    const main = localize($('main#main').html().trim());
    const id = p.slug === 'home' || urlPath === '/' ? 'home' : urlPath.split('/').filter(Boolean).join('--');
    await write(path.join(ROOT, 'content/pages', id + '.html'), main + '\n');
    pages.push({
      id,
      wpId: p.id,
      path: decodeURIComponent(urlPath),
      title: p.title.rendered,
      header: $('[data-elementor-type=header]').attr('data-elementor-id') === '1169' ? 'post' : 'page',
      // 原站「聯絡我們」頁沒有頁尾（Elementor 頁尾顯示條件排除），照原樣保留
      footer: $('[data-elementor-type=footer]').length ? undefined : false,
      popup: $('[data-elementor-type=popup]').length > 0,
      bodyClass: $('body').attr('class'),
      assets: profileOf(urlPath),
      noindex: /noindex/.test(extractSeo($).robots || ''),
      modified: p.modified,
      modifiedGmt: p.modified_gmt,
      sitemapLastmod: liveLastmod(decodeURIComponent(urlPath), p.modified_gmt) !== p.modified_gmt ? liveLastmod(decodeURIComponent(urlPath)) : undefined,
      sitemap: liveSitemap.size && !liveSitemap.has(decodeURIComponent(urlPath)) ? false : undefined,
      sitemapImages: liveImages.get(decodeURIComponent(urlPath)),
      seo: JSON.parse(localize(JSON.stringify(extractSeo($)))),
      content: `content/pages/${id}.html`,
    });
  }
  pages.sort((a, b) => a.path.localeCompare(b.path));
  await writeJson(path.join(ROOT, 'data/pages.json'), pages);

  // ===== 5. 文章（諮商部落 + 最新消息）=====
  const tagById = new Map(raw.tags.map(t => [t.id, t]));
  const posts = [];
  for (const type of ['medical_information', 'new']) {
    for (const p of raw[type]) {
      const urlPath = decodeURIComponent(new URL(p.link).pathname);
      const file = pathToHtmlFile(urlPath);
      let seo = {}, bodyClass = '', pageContent = null;
      if (fss.existsSync(file)) {
        const $ = load(file);
        seo = JSON.parse(localize(JSON.stringify(extractSeo($))));
        bodyClass = $('body').attr('class');
        // 內文以原站「頁面上實際輸出」的為準（圖片的 fetchpriority/lazy 等屬性與 API 版本不同）
        pageContent = $('.elementor-widget-theme-post-content > .elementor-widget-container').html()?.trim() || null;
      }
      const m = mediaById.get(p.featured_media);
      const $c = cheerio.load(p.content.rendered, null, false);
      $c('#ez-toc-container, script, style').remove(); // 摘要不含文章目錄
      const text = $c.root().text().replace(/\s+/g, ' ').trim();
      await write(path.join(ROOT, 'content/posts', `${p.id}.html`), localize(pageContent ?? p.content.rendered.trim()) + '\n');
      posts.push({
        id: p.id,
        type,
        slug: decodeURIComponent(p.slug),
        path: urlPath,
        title: cheerio.load(p.title.rendered, null, false).root().text(),
        date: p.date,
        modified: p.modified,
        modifiedGmt: p.modified_gmt,
        sitemapLastmod: liveLastmod(urlPath, p.modified_gmt) !== p.modified_gmt ? liveLastmod(urlPath) : undefined,
        sitemapImages: liveImages.get(urlPath),
        // 列表卡片的摘要來源；各列表再依自己的字數截斷（首頁 50 字、彙整頁 25 字）
        excerpt: [...text].slice(0, 120).join(''),
        tags: (p.tags || []).map(id => decodeURIComponent(tagById.get(id)?.slug || '')).filter(Boolean),
        featuredImage: m ? {
          id: m.id,
          src: m.source_url.replace(ORIGIN, ''),
          width: m.media_details?.width, height: m.media_details?.height,
          alt: m.alt_text || '',
          sizes: Object.fromEntries(Object.entries(m.media_details?.sizes || {}).map(([k, v]) => [k, { src: v.source_url.replace(ORIGIN, ''), width: v.width, height: v.height }])),
        } : null,
        bodyClass,
        assets: profileOf(urlPath),
        seo,
        content: `content/posts/${p.id}.html`,
      });
    }
  }
  // 原站列表上的摘要：WordPress 以原始碼截字（含換行、HTML 實體、圖說），算法無法完全重現，
  // 與我們自算結果不同的，記在 excerptOverrides[字數]，建置時優先使用
  const liveExcerpts = new Map();
  for (const f of files) {
    const $ = load(f);
    $('article.elementor-post').each((_, a) => {
      const href = $(a).find('.elementor-post__title a').attr('href');
      const $e = $(a).find('.elementor-post__excerpt');
      if (!href || !$e.length) return;
      const text = $e.text().trim();
      const p = decodeURIComponent(new URL(href).pathname);
      const len = Math.max(...$(a).parent().find('.elementor-post__excerpt').map((_, e) => [...$(e).text().trim()].length).get());
      if (!liveExcerpts.has(p)) liveExcerpts.set(p, {});
      liveExcerpts.get(p)[len] = text;
    });
  }
  for (const p of posts) {
    const o = {};
    for (const [len, text] of Object.entries(liveExcerpts.get(p.path) || {})) {
      if ([...p.excerpt].slice(0, +len).join('') !== text) o[len] = text;
    }
    if (Object.keys(o).length) p.excerptOverrides = o;
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));
  await writeJson(path.join(ROOT, 'data/posts.json'), posts);

  // ===== 6. 標籤 / 列表設定 =====
  const tags = raw.tags.map(t => {
    const p = decodeURIComponent(new URL(t.link).pathname);
    const f = pathToHtmlFile(p);
    const seo = fss.existsSync(f) ? JSON.parse(localize(JSON.stringify(extractSeo(load(f))))) : {};
    return { slug: decodeURIComponent(t.slug), name: t.name, path: p, description: t.description, seo };
  });
  await writeJson(path.join(ROOT, 'data/tags.json'), tags);

  const collections = {};
  for (const [type, p] of [['medical_information', '/medical_information/'], ['new', '/new/']]) {
    const $ = load(pathToHtmlFile(p));
    collections[type] = {
      path: p,
      archiveTitle: $('.elementor-widget-theme-archive-title .elementor-heading-title').text().trim(),
      breadcrumbName: $('#breadcrumbs .breadcrumb_last').text().trim(),
      perPage: $('.elementor-widget-archive-posts article').length,
      bodyClass: $('body').attr('class'),
      assets: profileOf(p),
      seo: JSON.parse(localize(JSON.stringify(extractSeo($)))),
    };
  }
  const $tag = load(walk(path.join(EXP, 'html', 'tag'))[0]);
  collections.tag = { bodyClass: $tag('body').attr('class'), assets: profileByFile.get(path.resolve(walk(path.join(EXP, 'html', 'tag'))[0])), perPage: collections.medical_information.perPage };
  await writeJson(path.join(ROOT, 'data/collections.json'), collections);

  // ===== 7. 網站設定 =====
  const siteFile = path.join(ROOT, 'data/site.json');
  if (!fss.existsSync(siteFile)) {
    const gtm = (JSON.stringify(registry).match(/GTM-[A-Z0-9]+/) || [])[0];
    await writeJson(siteFile, {
      siteUrl: ORIGIN,
      siteName: '怡然心理治療所',
      lang: 'zh-TW',
      phone: '0905467481',
      email: 'yiran.mind@gmail.com',
      gtmId: gtm,
      form: {
        _說明: '預約表單送出目標。填入 Google Apps Script / Formspree 等網址；留空則顯示「請來電預約」。見 docs/',
        endpoint: '',
        successMessage: '已收到您的預約資料，我們會盡快與您聯繫。',
        errorMessage: '送出失敗，請改以電話 0905467481 預約。',
      },
    });
  }

  for (const [id, html] of Object.entries(cardTemplates)) await write(path.join(ROOT, 'src/templates/cards', `${id}.html`), html + '\n');
  console.log(`pages ${pages.length}, posts ${posts.length}, tags ${tags.length}, card templates ${Object.keys(cardTemplates).length}`);

  if (DL_ASSETS) await downloadAssets(files, posts);
}

// ---------- 素材下載 ----------
async function downloadAssets(files, posts) {
  const want = new Set();
  const addUrl = u => {
    if (!u) return;
    u = u.trim().replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, '/');
    if (/\/\/u[0-9a-f]{4}/.test(u)) return; // Yoast schema 內被二次跳脫的網址，真正的檔案會由其他引用抓到
    if (u.startsWith('//yiranmind.com')) u = 'https:' + u;
    if (u.startsWith('/') && !u.startsWith('//')) u = ORIGIN + u;
    if (!/^https:\/\/yiranmind\.com\/wp-(content|includes)\//.test(u)) return;
    want.add(u.replace(/[?#].*$/, ''));
  };
  const scan = html => {
    for (const m of html.matchAll(/(?:src|href|data-src|content|poster)=["']([^"']+)["']/g)) addUrl(m[1]);
    for (const m of html.matchAll(/srcset=["']([^"']+)["']/g)) m[1].split(',').forEach(s => addUrl(s.trim().split(/\s+/)[0]));
    for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) addUrl(m[1]);
    for (const m of html.matchAll(/https?:\\?\/\\?\/yiranmind\.com(\\?\/wp-[^"'\s)]+)/g)) addUrl(m[1]);
  };
  for (const f of files) scan(await fs.readFile(f, 'utf8'));
  for (const p of posts) {
    scan(await fs.readFile(path.join(ROOT, p.content), 'utf8'));
    if (p.featuredImage) { addUrl(p.featuredImage.src); Object.values(p.featuredImage.sizes).forEach(s => addUrl(s.src)); }
  }
  ['/favicon.ico'].forEach(u => want.add(ORIGIN + u));

  const PUB = path.join(ROOT, 'public');
  const done = new Set();
  const failed = [];
  const queue = [...want];

  // Elementor 會動態載入的 JS 分塊：從 webpack runtime 找出全部檔名
  for (const [rt, dir] of [
    ['/wp-content/plugins/elementor/assets/js/webpack.runtime.min.js', '/wp-content/plugins/elementor/assets/js/'],
    ['/wp-content/plugins/elementor-pro/assets/js/webpack-pro.runtime.min.js', '/wp-content/plugins/elementor-pro/assets/js/'],
  ]) {
    const js = await (await fetch(ORIGIN + rt)).text();
    for (const [, name] of js.matchAll(/"([\w.-]+\.bundle\.min\.js)"/g)) queue.push(ORIGIN + dir + name);
    for (const [, name] of js.matchAll(/"([\w.-]+\.min\.css)"/g)) queue.push(ORIGIN + dir.replace('/js/', '/css/') + name);
  }

  async function one(u) {
    const rel = decodeURIComponent(new URL(u).pathname);
    const out = path.join(PUB, ...rel.split('/').filter(Boolean));
    if (!fss.existsSync(out)) {
      const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (site-migration-export)' } });
      if (!r.ok) { failed.push(`${r.status} ${rel}`); return; }
      await write(out, Buffer.from(await r.arrayBuffer()));
    }
    if (/\.css$/.test(rel)) {
      const css = await fs.readFile(out, 'utf8');
      for (const [, ref] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        if (ref.startsWith('data:') || ref.startsWith('#')) continue;
        const abs = new URL(ref, u).href.replace(/[?#].*$/, '');
        if (abs.startsWith(ORIGIN) && !done.has(abs)) queue.push(abs);
      }
    }
  }
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const u = queue.shift();
      if (done.has(u)) continue;
      done.add(u);
      try { await one(u); } catch (e) { failed.push(`ERR ${u} ${e.message}`); }
    }
  });
  await Promise.all(workers);
  console.log(`assets: ${done.size} checked, ${failed.length} failed`);
  if (failed.length) await write(path.join(EXP, 'asset-failures.txt'), failed.join('\n'));
}

main();
