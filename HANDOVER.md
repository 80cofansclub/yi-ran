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

### 已付的年限會不會浪費？

不會。網域的到期日記錄在 .com 的註冊局，**跟著網域走，不跟著帳號走**，移到你的帳號後到期日仍是 2027-02-21。
另外注意：註冊局顯示網域只付到 2027-02-21；廠商收的「網域費用 NT$26,000／3 年」是他們的收費方式（可能含主機），實際網域成本約每年 US$10～11。
若合約期間未滿就解約，可以和廠商討論未使用期間的費用。

### 方法一（建議）：Cloudflare 帳號間移轉

網域本來就在 Cloudflare，最簡單的方式是由廠商把它「移」到你的 Cloudflare 帳號。依 Cloudflare 官方文件（2026-09 查閱），流程如下：

**你先準備（廠商動作之前）**
1. 用診所的 Email 註冊 Cloudflare 帳號，開啟兩步驟驗證。
2. 在你的帳號「Add a domain」加入 `yiranmind.com`，選 **Free 方案**（官方前提：網域要先加到目標帳號並選方案）。此時顯示 Pending 是正常的。
3. 用廠商給的 DNS 匯出檔 **Import** DNS 記錄，逐筆核對（特別是 MX、SPF 等郵件記錄）。
4. 把你的 **Cloudflare 帳號 Email** 或 **Account ID** 給廠商。

**請廠商做**
5. **匯出 DNS 記錄**（DNS → Records → Export）給你，移轉會清掉舊帳號的所有設定。
6. **關閉 DNSSEC**、移除這個網域的付費加購與訂閱（官方前提）。
7. 確認網域的「註冊人 Email」已驗證、沒有進行中的其他變更。
8. 在「Registrar → Manage Domain → **Configuration**」送出移轉到你帳號的請求。

**你再做**
9. 收到通知信後，到你帳號的「Manage Domains」**接受**移轉。**必須在 5 天內**，否則請求自動取消。
10. 確認網域狀態變成 **Active**、nameserver 是你帳號分配的那組；打開網站、寄一封信到 @yiranmind.com（如果有在用）確認正常。
11. 開啟**自動續約**、設定付款方式；需要的話重新開啟 DNSSEC。
12. 檢查 **WHOIS 註冊人資料**（會原樣移過來）：如果是廠商的名字或信箱，改成診所的資料。

**要知道的事**
- 移轉完成後網域會**鎖定 30 天**，期間不能再移出（不影響網站運作）。
- 移轉會清除舊帳號的 SSL 憑證與所有設定，所以一定要先匯入 DNS 記錄。新帳號從 Pending 變成 Active 之前，Cloudflare 的代理功能不會生效。本網站的 GitHub Pages 記錄本來就設成 DNS only（灰色雲），受影響不大，但建議挑**網站流量低的時段**進行。
- 舊帳號的網域會顯示「Moved Away」，7 天後從廠商帳號刪除。

### 方法二（備用）：移到其他註冊商

如果廠商不願意操作方法一，可以請廠商**解除移轉鎖定、提供移轉授權碼（auth code / EPP code）**，由你在其他註冊商發起移轉（通常要付一年費用，**到期日會再往後延一年**，不會浪費）。移轉完成 60 天後，想移回自己的 Cloudflare 帳號也可以。缺點是步驟多，且過程中 DNS 要另外安排，容易影響網站與信箱。

### 如果廠商不配合

- 先確認 **WHOIS 註冊人**是誰：網域的法律所有人是註冊人。如果登記的是診所或你們的名字，所有權就在你們手上，可以把相關文件提供給 Cloudflare 客服說明。
- 若註冊人登記成廠商，需要回到合約討論；必要時尋求法律協助。
- 建議在合約到期前就開始處理，不要拖到網域到期。

### 給廠商的訊息範本

> 您好，我們規劃之後由診所自行維護網站。麻煩協助將 yiranmind.com 從貴公司的 Cloudflare 帳號移轉到診所的 Cloudflare 帳號：
> 1. 先匯出目前的 DNS 記錄（BIND 檔）給我們；
> 2. 關閉 DNSSEC、移除這個網域的加購項目；
> 3. 在 Registrar 的 Manage Domain → Configuration 送出移轉，目標帳號：（填你的 Cloudflare 帳號 Email 或 Account ID）。
> 另外也請提供 WordPress 網站完整備份與表單的歷史資料。移轉完成前，現有網站與主機請先維持運作，謝謝。

官方文件：[Move a Cloudflare Registrar domain registration between accounts](https://developers.cloudflare.com/registrar/account-options/inter-account-transfer/)、[Move a domain between Cloudflare accounts](https://developers.cloudflare.com/fundamentals/manage-domains/move-domain/)、[Transfer domain from Cloudflare to another registrar](https://developers.cloudflare.com/registrar/account-options/transfer-out-from-cloudflare/)

### 移轉完成後

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

> ⚠️ 2026-09-29 使用者新申請的金鑰（網站金鑰開頭 `6Ld6DdUt`）曾被誤提交到 Public repo，**已作廢，請刪除該組金鑰並重新申請**。
> 新金鑰：網站金鑰填 `data/site.json` 的 `form.recaptchaSiteKey`；密鑰**只**放 Apps Script 指令碼屬性，不要存成專案內的檔案。

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
