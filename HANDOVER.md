# HANDOVER.md — 從維運廠商接回網站：帳號與服務清單

> 2026-09-29 從原站（WordPress）全部 160 頁原始碼與 DNS 記錄掃描整理。
> 列出所有**可能綁在廠商帳號**、或自主維運後**需要自己補上**的服務。
> 狀態：✅ 已在靜態版處理　🟡 需要你向廠商取得／確認　🔧 需要你自己建立

---

## 總覽（依重要性）

| # | 項目 | 目前狀況 | 狀態 | 你要做的事 |
|---|---|---|---|---|
| 1 | Cloudflare 帳號（網域註冊 + DNS） | 網域註冊在 Cloudflare，帳號歸屬不明 | 🟡 | **最重要**。移轉到你的帳號前不要解約（見 §1） |
| 2 | 主機商（WordPress 主機 + 郵件主機） | 主機 43.254.17.x；SPF 有 `eee.tw`；`mail.yiranmind.com` 也在這台 | 🟡 | 確認合約名義、有沒有在用 @yiranmind.com 信箱（見 §2） |
| 3 | Google Tag Manager `GTM-TBLMSTH` | 你沒開通過 → 廠商建立的容器 | 🔧 | 建立自己的 GTM，改 `data/site.json` 的 `gtmId`（見 §3） |
| 4 | Google Analytics（UA `UA-117425930-36`、GA4 `G-9BLKFV2RTK`） | UA 已停用；帳號下有 36 個以上網站 → 廠商的代管帳號 | 🟡🔧 | 向廠商要歷史資料；建立自己的 GA4（見 §4） |
| 5 | Google Search Console | DNS 沒有驗證記錄 → 若有，是廠商用其他方式驗證的 | 🔧 | 用自己的帳號以 DNS 驗證（SEO.md §3.2） |
| 6 | 預約表單通知信 | 原站寄給診所 **與廠商信箱** | ✅🔧 | 已移除；設定 Apps Script 接收（`docs/form-apps-script.gs`） |
| 7 | 網站上的 Email 連結 | `mailto:` 同時寄給診所與廠商 | ✅ | 已改為只寄 `yiran.mind@gmail.com` |
| 8 | reCAPTCHA 金鑰 `6LevG7Ie…` | 廠商的 Google 帳號申請 | ✅🔧 | 已移除；要用請自己申請（見 §6） |
| 9 | FB「發布者」`article:publisher` | 每一頁都指向**廠商的粉專** `facebook.com/iwango.taiwan` | ✅ | 已改為 `facebook.com/YiranMind`（`data/site.json` → `facebookPage`） |
| 10 | Google+ 作者／發布者連結 | 指向某個 Google+ 帳號（2019 年已關閉的服務） | ✅ | 已移除 |
| 11 | Facebook 粉專 YiranMind、Messenger 按鈕 | Messenger 連到粉專 ID `109252523794062` | 🟡 | 確認你是粉專管理員、按鈕連到怡然（見 §5） |
| 12 | Google 商家檔案 `g.page/YiranMind` | 網站頁尾連結 | 🟡 | 確認你是「主要擁有者」（見 §5） |
| 13 | WordPress 後台、Elementor Pro 授權 | 廠商管理 | 🟡 | 解約前要完整備份；授權不需要續（靜態版用不到） |
| 14 | 活動報名 Google 表單（3 篇舊公告） | `forms.gle/…`、`docs.google.com/forms/…` | 🟡 | 舊活動，確認表單是誰建的；裡面若有報名者個資請取回 |
| 15 | Facebook Pixel | 原站頁首有空的「Facebook Pixel Code」區塊，**沒有實際追蹤碼** | ✅ | 不需處理；若之後要投 FB 廣告再自己裝 |

**已確認沒有**：Google Ads 轉換追蹤、Google Maps API 金鑰（地圖是免金鑰的嵌入）、Facebook App ID、LINE、YouTube、其他客服或追蹤工具。

---

## §1 Cloudflare（網域 + DNS）— 最重要

- 網域 `yiranmind.com` 註冊在 **Cloudflare Registrar**（2020-02-21 註冊，**2027-02-21 到期**），DNS 也在 Cloudflare。
- 如果這個 Cloudflare 帳號是廠商的，網址等於在廠商手上。

要做的事：
- [ ] 請廠商**先匯出 DNS 記錄**（DNS → Records → Export）給你備份
- [ ] 把網域移轉到你自己的 Cloudflare 帳號（由 Cloudflare 帳號間移轉，依 Cloudflare 當時的官方說明）
- [ ] 確認到期日、付款方式、**自動續約**已開
- [ ] 檢查 Cloudflare 其他設定：Rules（轉址規則）、SSL/TLS、Email Routing，有沒有廠商設的東西
- 接到 GitHub Pages 的步驟見 `CLAUDE.md`「網域接到 GitHub Pages 的步驟」

## §2 主機商與郵件

從 DNS 查到的記錄：

| 記錄 | 內容 | 代表 |
|---|---|---|
| MX | `_dc-mx.9a62feb10d62.yiranmind.com` → 43.254.17.35 | 寄到 @yiranmind.com 的信收在主機商 |
| A `mail.yiranmind.com` | 43.254.17.35 | 郵件主機 |
| TXT（SPF） | `v=spf1 ip4:43.254.17.32 ip4:43.254.17.35 include:_spf.eee.tw include:eee.tw ip4:43.254.17.45 +a +mx ~all` | 允許主機商代寄 @yiranmind.com 的信 |
| DMARC | 無 | — |

要做的事：
- [ ] 問廠商：主機合約是誰的名義？（`eee.tw` 看起來是主機商）
- [ ] 確認診所有沒有人在用 **@yiranmind.com 的信箱**
  - **沒有**：網站切換並穩定後，可請廠商停主機；Cloudflare 的 MX、`mail`、SPF 記錄改掉或刪除
  - **有**：解約前先搬信箱。選項：Cloudflare Email Routing（免費，轉寄到 Gmail，只能收不能用該地址寄）、Google Workspace（付費，可收可寄）
- [ ] 解約前取得 WordPress **完整備份**（檔案 + 資料庫）與 Elementor 表單的歷史預約資料（含個資，妥善保管，並請廠商刪除他們的副本）

## §3 Google Tag Manager（GTM）

實際下載容器 `GTM-TBLMSTH` 的內容，裡面只有**舊版 Universal Analytics**（`UA-117425930-36`）的 5 個代碼：頁面瀏覽，以及「表單送出、Messenger、電話圖示、電話文字」點擊。**Universal Analytics 已被 Google 停用，這些點擊事件現在都沒有在記錄。**

建議**建立你自己的 GTM**，不要沿用廠商的：
1. 用診所的 Google 帳號到 https://tagmanager.google.com 建立帳戶與容器（目標平台：網頁）
2. 取得新的容器 ID（`GTM-XXXXXXX`），填到 `data/site.json` 的 `gtmId`
3. 在新容器裡設定 GA4 與轉換事件（SEO.md §3.3）
4. push 部署

網站已處理：
- GTM ID 由 `data/site.json` 控制，留空則完全不載入
- 只在正式網址 `yiranmind.com` 執行；本機測試與 GitHub 預覽網址**不會**送數據進 GA

## §4 Google Analytics

- **UA `UA-117425930-36`**：已停用，不會再收數據。編號最後的 `-36` 表示是某帳號底下第 36 個以上的網站 → 廠商代管多個客戶的帳號。
- **GA4 `G-9BLKFV2RTK`**：目前仍有收到瀏覽數據（經由舊 UA 設定連動），帳號同樣在廠商那邊。

要做的事：
- [ ] 請廠商把你的 Google 帳號加為 GA4 資源的「管理員」，至少能**匯出歷史流量**（之後比較搬家前後的成效要用）
- [ ] 建立**你自己的 GA4 資源**，在自己的 GTM 裡設定（SEO.md §3.3）。以後的數據都在你手上
- 兩邊可以短暫並行；確定自己的 GA4 有數據後，就不再需要廠商的

## §5 社群與 Google 商家檔案

- **Facebook 粉專** `facebook.com/YiranMind`：網站多處連到這裡。
  - [ ] 到 Meta Business Suite 確認你是粉專「完整管理權限」的管理員
  - [ ] 點網站右下角的 **Messenger 按鈕**（連到粉專 ID `109252523794062`），確認開啟的是和「怡然心理治療所」的對話（Facebook 需要登入，無法從外部自動確認）
  - 文章頁的 FB 留言與按讚沿用原本的文章網址，不受搬家影響
- **Google 商家檔案** `g.page/YiranMind`（網站頁尾「Google 地圖」連結）
  - [ ] 到 https://business.google.com 確認你是「主要擁有者」；若是廠商，請他轉移
  - [ ] 點網站上的連結確認能正確打開商家頁面（Google 已逐步淘汰 g.page 短網址；失效的話換成商家檔案的分享連結，改 `src/templates/footer.html`）

## §6 reCAPTCHA

原站表單的 reCAPTCHA 金鑰 `6LevG7IeAAAAAJTcMTJalq4StBggUma5uKfI0Kqo` 是廠商的 Google 帳號申請的，已從網站移除。要啟用防機器人請自己申請，步驟在 `docs/form-apps-script.gs` 註解（網站金鑰填 `data/site.json`，**密鑰只放 Apps Script**）。

---

## 解約前最後確認

- [ ] 網域已在你的 Cloudflare 帳號，DNS 已指向 GitHub Pages 並穩定運作 2 週
- [ ] 郵件已確認不需要，或已搬家
- [ ] 預約表單已改由你的 Apps Script 接收，實際測試收得到通知信
- [ ] 自己的 GTM + GA4 已有數據；舊 GA 歷史資料已匯出
- [ ] Search Console 已用你的帳號驗證並提交 sitemap
- [ ] 粉專、商家檔案確認你是擁有者
- [ ] 已取得 WordPress 完整備份與表單歷史資料
