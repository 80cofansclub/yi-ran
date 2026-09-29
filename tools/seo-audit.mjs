// 每月 SEO 健檢：掃描全站文章與頁面，列出需要優化的項目
// 用法：npm run seo-audit    （先自動建置，再輸出 docs/seo-audit.html，只留本機）
// 檢查的是「網站本身」能控制的部分；搜尋成效請看 Google Search Console
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT = path.resolve('.');
const DIST = path.join(ROOT, 'dist');
const readJson = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const site = readJson('data/site.json');
const posts = readJson('data/posts.json').filter(p => !p.draft);
const pages = readJson('data/pages.json');
const len = s => [...(s || '')].length;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const distFile = p => path.join(DIST, ...decodeURIComponent(p).split('/').filter(Boolean), 'index.html');
const today = new Date();
const monthsAgo = iso => (today - new Date(iso)) / (30.44 * 864e5);
const DEFAULT_DESC = '怡然是台中的心理治療所';

// 權重：高＝直接影響搜尋排名或點擊率；中＝影響品質評分；低＝建議改善
const W = { high: 3, mid: 2, low: 1 };
const items = [];
const descCount = new Map();
for (const x of [...posts, ...pages]) {
  const d = x.seo?.description || '';
  descCount.set(d, (descCount.get(d) || 0) + 1);
}

function audit(x, kind) {
  const f = distFile(x.path);
  if (!fs.existsSync(f)) return;
  const $ = cheerio.load(fs.readFileSync(f, 'utf8'));
  const robots = $('meta[name=robots]').attr('content') || '';
  if (/noindex/.test(robots)) return; // 不收錄的頁面不檢查
  const issues = [];
  const add = (level, msg, how) => issues.push({ level, msg, how });

  const title = $('title').text();
  const desc = $('meta[name=description]').attr('content') || '';
  const tl = len(title), dl = len(desc);
  if (tl > 40) add('mid', `標題太長（${tl} 字），搜尋結果會被截斷`, '控制在 25～35 字，主要關鍵字放前面');
  if (tl < 15) add('mid', `標題太短（${tl} 字），缺少關鍵字`, '加入服務/主題關鍵字與「台中」');
  if (!desc) add('high', '沒有搜尋描述', '寫 80～120 字，說明這頁能解決什麼問題');
  else if (desc.startsWith(DEFAULT_DESC) || (descCount.get(x.seo?.description || '') || 0) > 1)
    add('high', '搜尋描述與其他頁重複（預設描述）', '為這頁寫專屬描述 80～120 字，帶主要關鍵字');
  else if (dl > 160) add('low', `搜尋描述太長（${dl} 字）`, '控制在 80～120 字');
  else if (dl < 50) add('low', `搜尋描述太短（${dl} 字）`, '補到 80～120 字');

  const h1 = $('h1').length;
  if (h1 !== 1) add('mid', `H1 有 ${h1} 個（應該剛好 1 個）`, '確認頁面主標題只有一個');

  if (kind === 'post') {
    const $c = $('.elementor-widget-theme-post-content');
    $c.find('#ez-toc-container').remove();
    const text = $c.text().replace(/\s+/g, '');
    const chars = len(text);
    const h2 = $c.find('h2').length;
    const links = $c.find('a[href^="/"]').filter((_, a) => !/\/wp-content\//.test(a.attribs.href)).length;
    const noAlt = $c.find('img').filter((_, i) => !(i.attribs.alt || '').trim()).length;
    const isArticle = x.type === 'medical_information';
    if (isArticle && chars < 800) add('mid', `內容偏短（${chars} 字）`, '補充到 1,200 字以上，增加小標題與常見問題');
    if (isArticle && chars >= 800 && h2 === 0) add('mid', '沒有小標題（H2）', '依讀者會問的問題分成 3～6 段小標題');
    if (isArticle && links < 2) add('high', `站內連結只有 ${links} 個`, '連到 2～3 篇相關文章 + 服務頁或預約頁');
    if (noAlt) add('low', `${noAlt} 張圖片沒有替代文字`, '每張圖寫一句描述（自然帶入關鍵字）');
    if (isArticle && !x.tags?.length) add('low', '沒有標籤', '加 1～3 個主題標籤');
    if (!x.featuredImage) add('low', '沒有封面圖', '加一張 1200×675 的封面圖（分享到 FB/LINE 會顯示）');
    if (isArticle && monthsAgo(x.modified) > 18) add('low', `超過 ${Math.floor(monthsAgo(x.modified))} 個月沒更新`, '檢查資訊是否過時、補充新內容後更新修改日期');
    if (isArticle && !/^[\x00-\x7f]+$/.test(x.slug)) add('low', '中文網址', '新文章用英文網址；舊文章不要改網址（會失去排名）');
  }

  const score = issues.reduce((s, i) => s + W[i.level], 0);
  items.push({ kind, title: x.title, path: x.path, date: (x.modified || x.date || '').slice(0, 10), issues, score });
}

posts.forEach(p => audit(p, 'post'));
pages.forEach(p => audit(p, 'page'));
items.sort((a, b) => b.score - a.score);

// ---------- 輸出 ----------
const total = items.length;
const clean = items.filter(i => !i.issues.length).length;
const counts = { high: 0, mid: 0, low: 0 };
items.forEach(i => i.issues.forEach(x => counts[x.level]++));
const top = items.filter(i => i.issues.length).slice(0, 10);
const label = { high: '高', mid: '中', low: '低' };
const month = today.toISOString().slice(0, 7);

const rows = items.filter(i => i.issues.length).map(i => `
<tr><td class="num">${i.score}</td>
<td><a href="${site.siteUrl}${encodeURI(i.path)}" target="_blank">${esc(i.title)}</a><div class="muted">${i.kind === 'post' ? '文章' : '頁面'}｜更新 ${i.date}</div></td>
<td><ul>${i.issues.map(x => `<li><span class="tag ${x.level}">${label[x.level]}</span> ${esc(x.msg)}<div class="muted">→ ${esc(x.how)}</div></li>`).join('')}</ul></td></tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SEO 健檢 ${month}</title>
<style>
:root{--bg:#f7f6f2;--card:#fff;--ink:#1f2328;--muted:#5d646d;--line:#e3e1da;--hi:#a4302a;--hi-bg:#fbe7e5;--mid:#9a5b00;--mid-bg:#fdf1dc;--low:#2f7d78;--low-bg:#e4f1ef}
@media (prefers-color-scheme:dark){:root{--bg:#16181b;--card:#1e2125;--ink:#e8e6e1;--muted:#a2a8b0;--line:#33373d;--hi:#ec8a83;--hi-bg:#3b2220;--mid:#e6b161;--mid-bg:#3a2f1c;--low:#6cc2bb;--low-bg:#1d3432}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px 16px 60px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:28px 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin-bottom:18px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.kpi{border:1px solid var(--line);border-radius:10px;padding:12px}.kpi b{display:block;font-size:26px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:9px 8px;border-bottom:1px solid var(--line)}
th{font-size:13px;color:var(--muted)}ul{margin:0;padding-left:0;list-style:none}li{margin:3px 0 7px}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.muted{color:var(--muted);font-size:13px}
.tag{display:inline-block;font-size:12px;font-weight:700;padding:0 7px;border-radius:99px}
.tag.high{background:var(--hi-bg);color:var(--hi)}.tag.mid{background:var(--mid-bg);color:var(--mid)}.tag.low{background:var(--low-bg);color:var(--low)}
a{color:var(--low)}.tbl{overflow-x:auto}
</style></head><body><div class="wrap">
<h1>SEO 網站健檢　${month}</h1>
<p class="muted">產生時間 ${today.toLocaleString('zh-TW')}｜檢查網站本身的標題、描述、內容結構與站內連結。搜尋成效（點擊、排名）請看 Google Search Console。</p>
<div class="card"><div class="kpis">
<div class="kpi"><b>${total}</b>檢查的網頁</div>
<div class="kpi"><b>${clean}</b>沒有問題</div>
<div class="kpi"><b style="color:var(--hi)">${counts.high}</b>高優先問題</div>
<div class="kpi"><b style="color:var(--mid)">${counts.mid}</b>中優先問題</div>
<div class="kpi"><b style="color:var(--low)">${counts.low}</b>低優先建議</div>
</div></div>
<div class="card"><h2 style="margin-top:0">這個月建議先處理的 3 篇</h2>
<ol>${top.slice(0, 3).map(i => `<li><b>${esc(i.title)}</b>：${i.issues.filter(x => x.level !== 'low').map(x => esc(x.msg)).join('；') || esc(i.issues[0].msg)}</li>`).join('')}</ol>
<p class="muted">每月挑 2～3 篇改就好，不需要一次全部修完。改完下個月再跑一次，分數會下降。</p></div>
<div class="card"><h2 style="margin-top:0">全部待改項目（分數越高越優先）</h2>
<div class="tbl"><table><tr><th class="num">分數</th><th>網頁</th><th>問題與做法</th></tr>${rows}</table></div></div>
</div></body></html>`;

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'seo-audit.html'), html);
console.log(`SEO 健檢：${total} 頁，無問題 ${clean} 頁；高 ${counts.high}、中 ${counts.mid}、低 ${counts.low}`);
console.log('建議本月優先：');
top.slice(0, 3).forEach((i, n) => console.log(`  ${n + 1}. ${i.title}（分數 ${i.score}）`));
console.log('完整報告：docs/seo-audit.html');
