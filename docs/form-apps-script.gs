/**
 * 預約表單接收程式（Google Apps Script）
 * 功能：把網站預約表單的資料寫進 Google 試算表，並寄通知信給診所。
 *
 * 設定步驟（約 10 分鐘，免費）：
 *  1. 用診所的 Google 帳號（yiran.mind@gmail.com）建立一個 Google 試算表，命名「網站預約表單」
 *  2. 試算表選單「擴充功能 → Apps Script」，把這整份程式貼上、儲存
 *  3. 右上角「部署 → 新增部署作業」→ 類型選「網頁應用程式」
 *       執行身分：我　／　誰可以存取：所有人
 *  4. 按「部署」，第一次會要求授權，照畫面允許
 *  5. 複製產生的「網頁應用程式網址」（https://script.google.com/macros/s/.../exec）
 *  6. 貼到專案的 data/site.json → form.endpoint，重新建置/推送即可
 */

const NOTIFY_EMAIL = 'yiran.mind@gmail.com';   // 收通知的信箱
const SHEET_NAME = '預約';
const RECAPTCHA_MIN_SCORE = 0.5;               // 0～1，越高越嚴格；誤擋真人時可調低到 0.3

/**
 * （選用）啟用 reCAPTCHA 防機器人：
 *  1. 到 https://www.google.com/recaptcha/admin/create 建立：類型選「以分數為準 (v3)」，
 *     網域填 yiranmind.com、80cofansclub.github.io、localhost
 *  2. 「網站金鑰」填到網站 data/site.json → form.recaptchaSiteKey（這組是公開的）
 *  3. 「密鑰」填到這裡：Apps Script 左側「專案設定」⚙️ →「指令碼屬性」→ 新增
 *       屬性：RECAPTCHA_SECRET　值：<密鑰>
 *     密鑰千萬不要寫進網站程式碼或 GitHub
 *  4. 設定好屬性後，沒有通過驗證的送出會被直接丟棄
 */
function verifyRecaptcha(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('RECAPTCHA_SECRET');
  if (!secret) return true; // 沒設定密鑰＝不檢查
  if (!token) return false;
  const res = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post', payload: { secret: secret, response: token }, muteHttpExceptions: true,
  });
  const r = JSON.parse(res.getContentText());
  return r.success && r.action === 'reservation' && r.score >= RECAPTCHA_MIN_SCORE;
}

function doPost(e) {
  const data = Object.assign({}, e.parameter || {});

  const token = data.recaptchaToken;
  delete data.recaptchaToken; // 驗證用，不存進試算表
  if (!verifyRecaptcha(token)) return ok();

  // 防垃圾：沒有電話或內容過長一律丟棄
  const phone = Object.keys(data).find(k => /電話|手機/.test(k));
  if (!phone || !data[phone] || JSON.stringify(data).length > 5000) return ok();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // 第一次收到時自動建立欄位標題；之後新增的欄位會自動補在最後面
  let headers = sheet.getLastRow() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  Object.keys(data).forEach(k => { if (!headers.includes(k)) headers.push(k); });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.appendRow(headers.map(h => data[h] || ''));

  const body = Object.keys(data).map(k => `${k}：${data[k]}`).join('\n');
  const nameKey = Object.keys(data).find(k => /姓名|名字/.test(k));
  MailApp.sendEmail(NOTIFY_EMAIL, '【網站預約】' + (nameKey ? data[nameKey] : '新預約'), body);

  return ok();
}

function ok() {
  return ContentService.createTextOutput('ok');
}
