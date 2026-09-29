# CLAUDE.md — 怡然心理治療所網站（靜態版）

> 給在任何一台電腦上接手這個專案的 Claude / 開發者。
> **開發過程遇到的每個問題與解法都要記在本檔「問題紀錄」**，換電腦時才查得到。

## 專案是什麼

- yiranmind.com 原本由網頁公司以 WordPress 7.1 + Elementor Pro + OceanWP + Yoast SEO 維運，
  2026-09 起改成**純靜態網站**自主維運（不再付維護費）。
- 目標：**外觀、網址、SEO 與原站完全一致**。使用者對 CSS 落差非常敏感，任何版面改動都要實測比對。
- 文章之後都由使用者自己寫（廠商不再更新）。
- GitHub：`80cofansclub/yi-ran`（Public），推到 `main` 由 GitHub Actions 部署到 GitHub Pages。
- 回覆使用者一律用**繁體中文**。

## 開始工作前：環境檢查（新電腦必做）

這個專案可能在工具不齊全的電腦上打開。**每次開新 session、或在新電腦第一次開啟時，先檢查環境再動手。**

### 規則

1. 先跑 `node --version` 與 `git --version`；兩者都有，再跑 `npm run doctor`（`tools/doctor.mjs`）看完整結果。
2. 缺少任何工具或套件時，**不要自行安裝**。先用 AskUserQuestion 詢問使用者，選項至少包含：
   - 「幫我安裝」：附上會執行的指令、用途、大約大小，以及是否需要系統管理員權限
   - 「我自己裝」：給使用者可以複製的指令或下載網址
   - 「先跳過」：說明跳過後哪些功能不能用
3. 使用者同意後才安裝，一次裝一項，裝完重跑 `npm run doctor` 確認。
4. 需要系統管理員權限、會改系統設定或 PATH 的安裝（例如 winget 安裝 Git/Node），要在詢問時特別說明；
   安裝後通常要**重開終端機/Claude**才會生效，要提醒使用者。
5. 公司電腦可能禁止安裝軟體或擋網路（見問題紀錄 #16），安裝失敗時不要反覆重試，改問使用者要不要用其他方式。

### 需要的環境

| 項目 | 必要性 | 用途 | 檢查 | Windows 安裝 | macOS 安裝 |
|---|---|---|---|---|---|
| Node.js 20 以上（建議 22 LTS） | 必要 | 建置、本機預覽、所有工具 | `node --version` | `winget install OpenJS.NodeJS.LTS` | `brew install node@22` |
| npm 套件 | 必要 | `marked`（建置）、`cheerio`（搬家/比對工具） | `npm run doctor` | `npm install` | `npm install` |
| Git | 必要 | 版控、推送部署 | `git --version` | `winget install Git.Git`（含 Git Bash 與 Credential Manager） | `brew install git` |
| Git Credential Manager | 推送時需要 | 以 HTTPS 登入 GitHub | `git config --get credential.helper` | Git for Windows 已內含 | `brew install --cask git-credential-manager` |
| 此 repo 的 git 身分 | 推送前必設 | Public repo 不可露出個人/公司信箱 | `git config user.email` | 見下方 | 見下方 |
| `_export/` 原站備份 | 選用 | `npm run check`、搬家工具 | `npm run doctor` | 從舊電腦複製 | 同左 |
| `docs/report.html` | 選用 | 分析報告（只留本機） | — | 從舊電腦複製 | 同左 |

不需要：PHP、MySQL、WordPress、Python、GitHub CLI（`gh`）。

### 新電腦第一次設定（使用者同意後依序執行）

```bash
git clone https://github.com/80cofansclub/yi-ran.git yiranmind-site
cd yiranmind-site
git config user.name "80cofansclub"
git config user.email "27292529+80cofansclub@users.noreply.github.com"
npm install
npm run doctor
npm run dev
```

> repo 層級的 `git config` **不會**跟著 clone 過來，每台新電腦都要重設（問題紀錄 #20）。

## 其他文件

| 檔案 | 內容 | 何時讀 |
|---|---|---|
| `SEO.md` | SEO 自主維運手冊：工具、每月流程、選題、寫文章 SOP、90 天計畫 | 使用者要做 SEO、寫文章、看流量時 |
| `HANDOVER.md` | 從廠商接回的帳號與服務清單（Cloudflare、主機/郵件、GTM、GA、reCAPTCHA、粉專…） | 處理帳號、DNS、追蹤碼、解約相關事項時 |
| `README.md` | 給人看的快速說明 | — |

## 常用指令

```bash
npm install                 # 第一次
npm run dev                 # 建置 + 本機預覽 http://localhost:8080/
npm run build               # 只建置到 dist/
npm run check               # 比對 sitemap / SEO 標籤與原站（需要 _export/，見下方）
npm run doctor              # 環境檢查（只檢查不安裝）
npm run seo-audit           # 每月 SEO 健檢 → docs/seo-audit.html（只留本機）
node tools/new-post.mjs 諮商部落 <英文代稱> "<標題>"   # 新增文章草稿（Markdown）
```

在 Git Bash 模擬 GitHub 子路徑預覽（注意 `MSYS_NO_PATHCONV=1`，見問題紀錄）：

```bash
MSYS_NO_PATHCONV=1 BASE_PATH=/yi-ran node tools/build.mjs
MSYS_NO_PATHCONV=1 BASE_PATH=/yi-ran node tools/serve.mjs 8081   # http://localhost:8081/yi-ran/
node tools/build.mjs                                              # 測完記得用正式模式重建
```

## 架構

```
data/            JSON「資料庫」：site.json（電話、表單、reCAPTCHA 網站金鑰）、posts.json、pages.json、tags.json、collections.json
content/         內文：posts/<id>.html（舊文章）或 .md（新文章）、pages/<id>.html（Elementor 排版頁）
src/templates/   版型：layout、header-page/post、footer、single-*、archive、cards/<widget-id>.html
                 assets.json + asset-profiles.json：每頁載入的 CSS/JS 清單（與原站同順序）
src/assets/      site.js（表單送出、reCAPTCHA、站內搜尋）、site.css
public/          原站素材（/wp-content、/wp-includes，網址與原站相同）— 不要改
tools/build.mjs  建置（唯一在 CI 跑的程式，依賴只有 marked）
tools/serve.mjs  本機伺服器（模擬 GitHub Pages；POST 會印出表單內容）
tools/1-fetch.mjs, 2-extract.mjs   一次性搬家工具（從原站抓資料 → data/content/templates）
tools/check-*.mjs                  與原站比對的檢查工具
docs/form-apps-script.gs           預約表單接收（Google 試算表 + Email + reCAPTCHA 驗證）
```

### 不在 git 裡、換電腦要手動複製的東西

| 路徑 | 內容 | 沒有的話 |
|---|---|---|
| `_export/`（約 18 MB） | 搬家時抓下來的原站 HTML、REST 資料、原站 sitemap | `npm run check`、`2-extract.mjs` 不能跑。原站還在時可用 `node tools/1-fetch.mjs` 重抓；原站關掉後就只剩這份備份，**務必保留** |
| `docs/report.html` | 網站分析、部署與 SEO 策略報告 | 使用者規定內部分析不外流（不發 artifact、不進 Public repo） |

## 規則與慣例

- **改版型前後都要和原站逐元素比對**（位置、尺寸、字型、顏色、背景圖），不要只看截圖。
  比對方式：瀏覽器內對所有 `[data-id]` 元素取 `getBoundingClientRect` + computed style，
  原站結果存在 `window.name`，導到本機頁面後比較（`window.name` 可跨網域保留）。
- 原站已是正式內容來源；`2-extract.mjs` 重跑會**覆寫** data/ content/ src/templates/，
  搬家完成後日常維運**不要再跑**，除非確定要重新從原站匯入。
- 刻意和原站不同的地方（改動前先確認是否仍需要）：
  1. 移除廠商信箱（原站 mailto 同時寄給廠商）
  2. reCAPTCHA 改用使用者自己的金鑰（`data/site.json` → `form.recaptchaSiteKey`），未填則不顯示徽章
  3. 站內搜尋 `/?s=` → `/search/`（site.js 自動轉址）
  4. 文章日期不連到日期彙整頁（原站那是 404）
  5. 特色圖片／列表縮圖不加 `loading="lazy"` 的情況比原站多（見問題紀錄 #13）
- 這個 repo 的 git 身分：`80cofansclub <27292529+80cofansclub@users.noreply.github.com>`（repo 設定，不要用公司信箱）。
- commit 訊息用繁體中文。

---

## 問題紀錄（依發生順序；新問題請接在最後）

### #1 CSS 有落差：把所有頁面的 CSS 合成一包
- **症狀**：header 較矮、選單字距不同。本機 93 張樣式表 vs 原站 54 張。
- **原因**：一開始把所有頁面用到的 CSS 取聯集載入，CSS 疊加順序和原站不同。
- **解法**：每頁載入的 `<link>/<style>/<script>` 清單與順序完全照原站（`assets.json` 存內容、`asset-profiles.json` 存每種頁面的清單，共 23 種）。

### #2 下載來的 CSS/JS 內寫死 https://yiranmind.com
- **症狀**：字型跨網域載入失敗（CORS）。
- **解法**：`tools/fix-public-urls.mjs` 把 public/ 內 CSS/JS 的絕對網址改成站內路徑。

### #3 首頁區塊「看起來不見」
- **症狀**：在 Claude 內建瀏覽器的背景分頁量到首頁第一段是空的。
- **原因**：Elementor 進場動畫（`elementor-invisible`）只在畫面可見時觸發，背景分頁不會觸發；**原站在同樣條件下也一樣**，不是 bug。使用者實際瀏覽正常。

### #4 列表卡片長相不同（側欄高度差很多）
- **原因**：每個 Elementor「文章列表」小工具的卡片設定不同（側欄只有小縮圖、沒摘要）。
- **解法**：從原站每個小工具取第一張卡片做樣板 → `src/templates/cards/<data-id>.html`。

### #5 摘要字數不同
- **原因**：首頁/頁面列表摘要 50 字、彙整頁 25 字；WordPress 以原始碼截字（含換行、HTML 實體、圖說），無法完全重現。
- **解法**：卡片樣板記錄字數 `{{excerpt:N}}`；算不一樣的舊文章在 `posts.json` 的 `excerptOverrides` 存原站文字。原站甚至有把 `&#8230;` 切成 `&#82` 的 bug，也照原樣保留。

### #6 日期格式
- 原站顯示「11 5 月, 2023」「9:04 下午」（WordPress 中文語系的格式），照原樣輸出，不要「修正」。

### #7 canonical 不能一律指向自己
- 原站有 5 頁 canonical 指向別頁（例如 `/about/` → `/about/yiran/`、`/service/` → `/counseling/`）。extract 會保存 `seo.canonical`；分頁（`/page/2/`）則指向自己。

### #8 sitemap 要和 Yoast 一模一樣
- 索引檔 + page/new/medical_information/post_tag 四個分類檔；lastmod 用 UTC（`modifiedGmt`）；
  早期文章 WordPress 時區設定不同，差 8 小時，需用 GMT 欄位；個別 lastmod 以原站為準存在 `sitemapLastmod`。
- 圖片清單沿用原站（`sitemapImages`，原樣輸出、含重複）；新文章自動抽取（去掉 `-1024x576` 尺寸尾碼）。
- `/service/counseling/` 原站可索引但沒進 sitemap，比照設 `"sitemap": false`。
- 排序：頁面首頁優先、其餘依修改時間；文章依修改時間；標籤依 tags.json 順序。
- 驗證：`node tools/check-sitemap.mjs`。

### #9 分頁標題格式
- Yoast 格式：「諮商部落 彙整 - 第 2 頁，總計 5 頁 - 怡然心理治療所」，且分頁沒有 og:description、schema。

### #10 `.gitignore` 的 `dist/` 排除了 `public/wp-includes/js/dist/`
- **症狀**：本機正常，GitHub Pages 上 `hooks.min.js`、`i18n.min.js`、`block-library/style.min.css` 404。
- **解法**：改成 `/dist/`、`/node_modules/`（只排除根目錄）。**新增忽略規則時一律加開頭的 `/`**。
- 教訓：部署後要在**線上**再比對一次，本機通過不代表線上完整。

### #11 GitHub Pages 子路徑 `/yi-ran/`
- 還沒綁自訂網址時網址是 `80cofansclub.github.io/yi-ran/`，站內 `/` 開頭的連結全部失效。
- **解法**：workflow 用 `actions/configure-pages` 取得 `base_path` 傳給 `BASE_PATH`；
  build 在子路徑模式替 HTML/CSS 的站內網址（含 Elementor JSON 裡的 `\/wp-content`）加前綴，並設 noindex。
  綁定 yiranmind.com 後 base_path 為空，輸出與原站相同。
- Pages 要先到 repo **Settings → Pages → Source 選 GitHub Actions**，否則 configure-pages 會失敗（Not Found）。

### #12 文章內文與原站不同（圖片屬性）
- **原因**：一開始從 WordPress REST API 取內文，API 版本的圖片是 `loading="lazy"`，頁面實際輸出是 `fetchpriority="high"`。
- **解法**：extract 改取原站頁面 `.elementor-widget-theme-post-content` 的實際 HTML（API 只作備援）。86 篇已驗證一致。

### #13 特色圖片尺寸與 lazy 屬性
- 特色圖片要用 **large** 尺寸（直式圖差最明顯：720×1043 vs 707×1024 高度差 19px）。
- srcset 規則同 WordPress：選用尺寸排第一，其餘同比例尺寸依序；後台裁切過的圖（`-e1583621915814` 尾碼）不輸出 srcset。
- 列表縮圖的 `loading`/`fetchpriority` 依「第幾張」照原站套用（卡片樣板開頭 `<!--img-load-attrs:[...]-->`）。
- **已知且接受的差異**：34 頁共 65 張圖原站是 lazy、我們是立即載入（WordPress 依文章內圖片數動態決定，重現成本高）。版面完全相同，且特色圖片立即載入對 LCP 較好。

### #14 表單與 reCAPTCHA
- 原站 Elementor 表單送到 `admin-ajax.php`，靜態站改由 `site.js` 在 capture 階段攔截 submit（阻止 Elementor 原本的送出），送到 `form.endpoint`（Google Apps Script，`mode: 'no-cors'`）。
- 欄位名稱取自標籤（去掉「▼」「：」與括號）；星期二～六的時段沒有標籤，歸入「您想預約的時段」。
- reCAPTCHA v3：`site.js` 以 explicit render 把徽章渲染在表單內（inline，高度 60px 與原站同）；
  token 以 `recaptchaToken` 送出，Apps Script 用指令碼屬性 `RECAPTCHA_SECRET` 向 Google 驗證（分數 ≥ 0.5）。
  **密鑰絕不能進 repo**（Public）。原站 `data-sitekey` 是廠商申請的，extract 已改成 `class="site-recaptcha"`。
- 本機測試表單：暫時把 `dist/assets/site-config.json` 的 endpoint 設成 `http://localhost:8080/__form`，serve.mjs 會印出送出內容。

### #15 本機預覽伺服器在重新建置時當掉
- build 會先刪除 dist/，此時有請求進來會 ENOENT 崩潰。serve.mjs 已改成讀檔失敗回 503。

### #16 公司網路環境限制
- SSH 22 port 被擋 → git remote 用 **HTTPS**（Git Credential Manager 會跳登入）。
- GitHub API 未登入限流（共用對外 IP，很快就 60 次/小時用完）→ 改用瀏覽器看 Actions 頁面。
- DNS 查詢 8.8.8.8 / DoH 被擋 → 用 PowerShell `Resolve-DnsName`（走系統 DNS）。

### #17 Git Bash 會把 `/yi-ran` 轉成 Windows 路徑
- `BASE_PATH=/yi-ran` 變成 `C:/Program Files/Git/yi-ran`。環境變數含 `/` 開頭時要加 `MSYS_NO_PATHCONV=1`。

### #18 在 Bash heredoc 裡用 node 改程式碼很容易出錯
- `\\`、`\/`、正規表示式、`\n` 經過 shell + JS 字串兩層跳脫後常被吃掉（曾造成 build.mjs 語法錯誤）。
- 改程式碼一律用編輯工具直接改檔，不要用 heredoc 包 JS 做字串取代。

### #19 Windows 換行
- 全域 `core.autocrlf=true`，commit 時會出現大量 “LF will be replaced by CRLF” 警告，屬正常，不影響 CI（Linux 取出為 LF）。

### #20 新電腦 clone 後 git 身分會跑掉
- repo 層級的 `git config user.email` 存在 `.git/config`，不會被 clone；新電腦會沿用全域設定（可能是公司信箱），推到 Public repo 會公開。
- **解法**：`npm run doctor` 會檢查並提示；新電腦第一次設定時照「新電腦第一次設定」重設。

### #21 新電腦可能缺工具
- 使用者之後會在工具不齊全的電腦上開發。新增 `tools/doctor.mjs`（`npm run doctor`）只檢查、不安裝，列出缺少項目與建議指令；
  依「開始工作前：環境檢查」的規則，**安裝前一定先問使用者**。

### #22 綁定自訂網域後必須重新部署
- `BASE_PATH` 是在**建置當下**由 configure-pages 決定的。在 GitHub 設好 Custom domain 之後，線上仍是舊的子路徑版本（帶 `/yi-ran` 前綴、noindex），
  **一定要再觸發一次部署**（Actions → Deploy to GitHub Pages → Run workflow，或推空 commit）。
- 部署後確認：`curl -s https://yiranmind.com/ | grep -o '<meta name="robots"[^>]*>'` 不能是 noindex。
- Cloudflare 上指向 GitHub Pages 的記錄保持 **DNS only（灰色雲）**：開 Proxy 可能讓 GitHub 每 90 天續發 HTTPS 憑證失敗。

### #23 GTM／GA 是廠商帳號，且本機測試會把數據送進去
- 下載 `https://www.googletagmanager.com/gtm.js?id=GTM-TBLMSTH` 分析：容器只有已停用的 UA（`UA-117425930-36`）代碼；`-36` 表示是廠商代管多客戶的帳號。GA4 `G-9BLKFV2RTK` 經 UA 連動收數據。
- 本機與 GitHub 預覽網址原本也會載入 GTM，送出 `dl=http://localhost/` 的瀏覽紀錄到廠商 GA。
- **解法**：GTM ID 改由 `data/site.json` 的 `gtmId` 決定（留空＝不載入）；build 把 GTM 片段包成 `if(location.hostname==="yiranmind.com")`，預覽建置直接移除。
  site.js 的事件改用 `(window.dataLayer = window.dataLayer || []).push(...)`，GTM 沒載入時也不會出錯。
- 使用者要換成自己的 GTM 容器與 GA4（HANDOVER.md §3、§4）。

### #24 掃描原站找出所有綁在廠商的東西
- 做法：對 `_export/html` 全部頁面用正規表示式找 GTM/GA/AW/驗證 meta/FB app id/pixel/粉專/Messenger/地圖/API key/reCAPTCHA/Email/外部網域，
  再用 PowerShell `Resolve-DnsName` 查 TXT（SPF）、MX、`mail.` 記錄。
- 發現並已處理：`article:publisher` 指向廠商粉專 `facebook.com/iwango.taiwan`（改成 `data/site.json` 的 `facebookPage`）、Google+ `rel=author/publisher`（移除）、reCAPTCHA 金鑰、mailto 廠商信箱。
- 需使用者處理的清單寫在 **HANDOVER.md**；之後發現新的廠商綁定也要補進去。

### #25 Google Trends 在公司網路回 429
- 共用對外 IP 被限流（同 #16）。不要重試，請使用者換網路查或提供截圖/CSV。

### #26 ⚠️ reCAPTCHA 密鑰被 commit 進 Public repo（2026-09-29）
- **經過**：使用者把金鑰存成 `docs/recaptcha.txt`，Claude 用 `git add -A` 沒逐一檢查新檔案就 commit 並 push。
- **處理**：`git rm --cached` + 加進 .gitignore；經使用者同意後 `git reset --soft` 合併 commit 並 `git push --force-with-lease` 改寫歷史。
  但 GitHub 仍可用舊 commit 編號（b2b978b）直接存取，**舊金鑰必須作廢重建**；要徹底移除需向 GitHub Support 申請 Remove sensitive data。
- **規則（之後一律遵守）**：
  1. commit 前先看 `git status --short`，**出現不是自己建立的新檔案要先問使用者**，不可直接 `git add -A`。
  2. 密鑰、密碼、token 只能放 .gitignore 內的位置（`/secrets/`、`*.secret`），或 Apps Script 指令碼屬性，絕不寫進程式碼與 data/。
  3. reCAPTCHA「網站金鑰」可以公開（放 `data/site.json`）；「密鑰」只能放 Apps Script 的 `RECAPTCHA_SECRET`。
  4. 改寫已推送的歷史（force push）一定要先取得使用者同意。

---

## 網域接到 GitHub Pages 的步驟

1. 網域移到使用者自己的 Cloudflare 帳號前，先請廠商 **Export DNS 記錄**（BIND 檔）備份；移轉後確認記錄還在、續約付款人正確。
2. GitHub 帳號 Settings → Pages → Add a domain → 在 Cloudflare 加 TXT `_github-pages-challenge-80cofansclub` → Verify。
3. 測試：Cloudflare 加 CNAME `new` → `80cofansclub.github.io`（DNS only）→ repo Settings → Pages → Custom domain 填 `new.yiranmind.com` → **重新部署** → 實測。
4. 正式：@ 的 A 記錄改成 185.199.108.153／109／110／111，AAAA 改成 2606:50c0:8000::153／8001／8002／8003，
   www 設 CNAME → `80cofansclub.github.io`（全部 DNS only）；Custom domain 改 `yiranmind.com` → **重新部署** → 憑證發好後勾 Enforce HTTPS。
5. MX／SPF 等郵件記錄不要動。
6. Search Console 重新提交 `sitemap_index.xml`；舊主機保留 2 週再解約。

---

## 上線前待辦（2026-09-29 狀態）

- [ ] 確認網域所在 Cloudflare 帳號歸使用者所有（網域 2027-02-21 到期）
- [ ] 確認是否使用 @yiranmind.com 信箱（MX 指向廠商主機）
- [ ] 建立 Google Apps Script 表單接收，填 `data/site.json` → `form.endpoint`
- [ ] （選用）申請 reCAPTCHA v3，網站金鑰填 `form.recaptchaSiteKey`、密鑰填 Apps Script 屬性
- [ ] 先用 `new.yiranmind.com` 測試，再把 DNS 切到 GitHub Pages（A 185.199.108-111.153、www CNAME `80cofansclub.github.io`，DNS only）
- [ ] 切換後 Search Console 重新提交 `sitemap_index.xml`；舊主機保留 2 週再解約

