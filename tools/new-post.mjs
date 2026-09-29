// 新增一篇文章（草稿）：建立 content/posts/<id>.md，並在 data/posts.json 加一筆資料
// 用法：
//   node tools/new-post.mjs 諮商部落 panic-attack "恐慌症發作怎麼辦？"
//   node tools/new-post.mjs 最新消息 2026-10-holiday "2026年10月公休日"
// 第 2 個參數是網址代稱（建議用英文小寫與 -，例如 panic-attack）
// 寫完後把 posts.json 裡這篇的 "draft": true 刪掉（或改 false），建置後就會上線
import fs from 'node:fs';

const TYPES = { 諮商部落: 'medical_information', 最新消息: 'new', medical_information: 'medical_information', new: 'new' };
const [typeArg, slug, title] = process.argv.slice(2);
const type = TYPES[typeArg];
if (!type || !slug || !title) {
  console.log('用法：node tools/new-post.mjs <諮商部落|最新消息> <網址代稱> "<標題>"');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) console.warn('提醒：網址代稱建議只用英文小寫、數字與 -，對 SEO 與分享較友善');

const file = 'data/posts.json';
const posts = JSON.parse(fs.readFileSync(file, 'utf8'));
const urlPath = `/${type}/${slug}/`;
if (posts.some(p => p.path === urlPath)) { console.error('已有相同網址的文章：' + urlPath); process.exit(1); }

const id = Math.max(...posts.map(p => p.id)) + 1;
const now = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 19); // 台灣時間
const content = `content/posts/${id}.md`;

fs.writeFileSync(content, `在這裡寫文章內容（Markdown 格式）。第一段會自動成為列表上的摘要，建議 2～3 句點出重點與關鍵字。

## 第一個小標題（放主要關鍵字）

內文……可以用 **粗體**、[站內連結](/counseling-reservation/reservation/)。

## 第二個小標題

- 條列項目
- 條列項目

![圖片說明（替代文字，務必填寫）](/wp-content/uploads/2026/10/your-image.jpg)
`);

posts.unshift({
  id,
  type,
  slug,
  path: urlPath,
  title,
  date: now,
  modified: now,
  draft: true,
  excerpt: '（列表摘要：寫 1～2 句，約 50 字）',
  tags: [],
  featuredImage: {
    src: '/wp-content/uploads/2026/10/your-image.jpg',
    width: 1200,
    height: 675,
    alt: '圖片替代文字（描述圖片內容，自然帶入關鍵字）',
    sizes: {},
  },
  seo: {
    title: `${title} - 怡然心理治療所`,
    description: '（搜尋結果顯示的說明：80～120 字，包含主要關鍵字與「台中」等地區詞）',
    ogType: 'article',
    ogImage: '/wp-content/uploads/2026/10/your-image.jpg',
  },
  content,
});
fs.writeFileSync(file, JSON.stringify(posts, null, 2) + '\n');
console.log(`已建立草稿：
  內文：${content}
  資料：data/posts.json 第一筆（id ${id}）
  網址：${urlPath}
寫完後刪掉 "draft": true，執行 npm run dev 預覽。`);
