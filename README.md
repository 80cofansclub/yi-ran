# 怡然心理治療所網站（靜態版）

從原本的 WordPress + Elementor 網站搬出來的純靜態網站：**HTML + CSS + JS，資料存在 JSON 檔**，
由 GitHub Pages 免費託管。外觀、網址、SEO 設定都與原站一致。

部署步驟見 `.github/workflows/deploy.yml`；完整分析報告僅保存在本機 `docs/report.html`（不進版控）。

## 本機預覽

需要 [Node.js](https://nodejs.org/) 20 以上。

```bash
npm install          # 第一次才需要
npm run dev          # 建置並啟動 http://localhost:8080/
```

## 資料夾結構

| 位置 | 內容 | 會常改嗎 |
|---|---|---|
| `data/site.json` | 網站名稱、電話、表單送出網址 | 偶爾 |
| `data/posts.json` | 所有文章（諮商部落、最新消息）的標題、日期、摘要、標籤、SEO 設定 | **常改** |
| `content/posts/` | 文章內文（舊文章是 `.html`，新文章建議用 `.md` Markdown） | **常改** |
| `data/pages.json` + `content/pages/` | 一般頁面（首頁、心理師、收費…）的 SEO 設定與內容 | 偶爾 |
| `data/tags.json` | 標籤 | 偶爾 |
| `public/wp-content/uploads/` | 圖片（沿用舊網址，Google 圖片搜尋不會斷） | 新增圖片時 |
| `src/templates/` | 版型（頁首、頁尾、文章版型、卡片） | 很少 |
| `public/wp-content/plugins`、`themes` | 原站的 Elementor / OceanWP 樣式與程式，**不要改** | 不改 |
| `tools/` | 建置、預覽、檢查工具 | 不改 |
| `dist/` | 建置結果（自動產生，不用管） | — |

## 新增一篇文章

```bash
node tools/new-post.mjs 諮商部落 panic-attack "恐慌症發作怎麼辦？"
```

1. 打開產生的 `content/posts/<編號>.md` 寫內文（Markdown）
2. 圖片放到 `public/wp-content/uploads/年/月/`，並在 `data/posts.json` 這篇的 `featuredImage` 填路徑與尺寸
3. 在 `data/posts.json` 補上 `excerpt`（摘要）、`tags`、`seo.title`、`seo.description`
4. 刪掉 `"draft": true`，`npm run dev` 預覽
5. 確認沒問題後 commit、push 到 GitHub，約 1 分鐘後自動上線

首頁「最新文章」、列表頁、分頁、標籤頁、上一篇/下一篇、sitemap、站內搜尋都會**自動更新**。

## 最新消息（公休公告）

同上，類型改成「最新消息」：

```bash
node tools/new-post.mjs 最新消息 2026-11-holiday "2026年11月公休日"
```

## 預約表單

表單送到 `data/site.json` 的 `form.endpoint`。設定方式見 `docs/form-apps-script.gs`
（Google 試算表 + Email 通知，免費）。沒設定時，表單會顯示「請來電預約」。

## 檢查工具

```bash
npm run check    # 比對 sitemap 與 SEO 標籤是否與搬家前的原站一致
```
