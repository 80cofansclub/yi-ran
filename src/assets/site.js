// 靜態站補丁：取代原本 WordPress 後端負責的「預約表單」與「站內搜尋」
(function () {
  'use strict';
  // 舊 WordPress 搜尋網址 /?s=關鍵字（結構化資料與舊連結會用到）→ 轉到靜態站的搜尋頁
  if (location.pathname === '/' && /[?&]s=/.test(location.search)) {
    location.replace('/search/' + location.search);
    return;
  }
  var configPromise = fetch('/assets/site-config.json').then(function (r) { return r.json(); }).catch(function () { return {}; });

  // ---------- 1. 預約表單（Elementor Form）----------
  // 原本送到 wp-admin/admin-ajax.php；改送到 data/site.json 的 form.endpoint
  // 欄位名稱取自表單上的標籤，去掉「▼」「：」與括號說明；沒有標籤的欄位（例如星期二～六的時段）
  // 歸到前一個有標籤的欄位，所以所有時段會合併在「您想預約的時段」
  var lastLabel = '';
  function fieldLabel(el) {
    var group = el.closest('.elementor-field-group');
    var label = group && group.querySelector('.elementor-field-label');
    if (!label) return el.type === 'text' ? lastLabel + '（其他）' : lastLabel || el.name;
    lastLabel = label.textContent.replace(/[▼*]/g, '').split(/[（(]/)[0].replace(/[:：\s]+$/, '').trim();
    return lastLabel;
  }
  function showMsg(form, text, ok) {
    var box = form.querySelector('.site-form-msg');
    if (!box) { box = document.createElement('div'); box.className = 'site-form-msg'; form.appendChild(box); }
    box.textContent = text;
    box.className = 'site-form-msg ' + (ok ? 'is-ok' : 'is-err');
  }
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.classList || !form.classList.contains('elementor-form')) return;
    // 攔在 capture 階段，阻止 Elementor 原本的 AJAX 送出
    e.preventDefault();
    e.stopImmediatePropagation();
    var data = {};
    lastLabel = '';
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'hidden' || el.type === 'submit') return;
      var key = fieldLabel(el);
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      if (!el.value) return;
      data[key] = data[key] ? data[key] + '、' + el.value : el.value;
    });
    data['來源頁面'] = location.href;
    data['送出時間'] = new Date().toLocaleString('zh-TW');
    var btn = form.querySelector('[type=submit]');
    configPromise.then(function (cfg) {
      var f = cfg.form || {};
      if (!f.endpoint) {
        showMsg(form, '線上預約暫停中，請來電 ' + (cfg.phone || '') + ' 預約，謝謝。', false);
        return;
      }
      if (btn) btn.disabled = true;
      // no-cors：Google Apps Script / Formspree 都收得到；回應內容無法讀取，送出即視為成功
      return fetch(f.endpoint, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(data) })
        .then(function () {
          form.reset();
          showMsg(form, f.successMessage || '已送出，謝謝！', true);
          if (window.dataLayer) window.dataLayer.push({ event: 'reservation_submit' });
        })
        .catch(function () { showMsg(form, f.errorMessage || '送出失敗，請改用電話聯繫。', false); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }, true);

  // ---------- 2. 站內搜尋（讀 /search-index.json）----------
  var box = document.getElementById('site-search-results');
  if (box) {
    var q = (new URLSearchParams(location.search).get('s') || '').trim();
    var input = document.querySelector('.site-search-form input[name=s]');
    if (input) input.value = q;
    if (q) {
      box.textContent = '搜尋中…';
      fetch('/search-index.json').then(function (r) { return r.json(); }).then(function (items) {
        var words = q.toLowerCase().split(/\s+/).filter(Boolean);
        var hits = items.map(function (it) {
          var t = it.t.toLowerCase(), x = (it.e + ' ' + it.x).toLowerCase(), score = 0;
          for (var i = 0; i < words.length; i++) {
            if (t.indexOf(words[i]) >= 0) score += 10;
            else if (x.indexOf(words[i]) >= 0) score += 1;
            else return null;
          }
          return { it: it, score: score };
        }).filter(Boolean).sort(function (a, b) { return b.score - a.score || (a.it.d < b.it.d ? 1 : -1); });
        box.innerHTML = '';
        var p = document.createElement('p');
        p.textContent = '「' + q + '」共找到 ' + hits.length + ' 篇文章';
        box.appendChild(p);
        var ul = document.createElement('ul');
        hits.forEach(function (h) {
          var li = document.createElement('li');
          var a = document.createElement('a'); a.href = h.it.u; a.textContent = h.it.t;
          var small = document.createElement('small'); small.textContent = h.it.d;
          var ex = document.createElement('p'); ex.textContent = h.it.e + '…';
          li.appendChild(a); li.appendChild(small); li.appendChild(ex); ul.appendChild(li);
        });
        box.appendChild(ul);
      });
    }
  }
})();
