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

function doPost(e) {
  const data = e.parameter || {};

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
