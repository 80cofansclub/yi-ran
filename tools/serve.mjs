// 本機預覽伺服器（零相依）：node tools/serve.mjs [port]
// 行為與 GitHub Pages 相同：目錄自動找 index.html、找不到回 404.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};

http.createServer((req, res) => {
  // 本機測試表單用：把 form.endpoint 暫時設成 http://localhost:8080/__form，送出的內容會印在這裡
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      console.log('[表單送出]', Object.fromEntries(new URLSearchParams(body)));
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });
    return;
  }
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/'; }
  // 模擬子路徑部署：BASE_PATH=/yi-ran 時，只有 /yi-ran/ 底下的網址有效（與 GitHub Pages 預覽網址相同）
  if (BASE) {
    if (!p.startsWith(BASE + '/')) { res.writeHead(404); return res.end('not under ' + BASE); }
    p = p.slice(BASE.length);
  }
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { location: req.url.replace(/(\?|$)/, '/$1') }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  let status = 200;
  if (!fs.existsSync(file)) {
    status = 404;
    console.warn('404', p);
    file = path.join(DIST, '404.html');
  }
  // 重新建置期間 dist/ 會短暫被清空，讀不到檔就回 503，不讓伺服器當掉
  const stream = fs.createReadStream(file);
  stream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end('rebuilding, please reload'); });
  stream.on('open', () => {
    res.writeHead(status, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    stream.pipe(res);
  });
}).listen(PORT, () => console.log(`預覽：http://localhost:${PORT}${BASE}/`));
