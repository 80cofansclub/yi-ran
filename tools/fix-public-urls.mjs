// 下載來的 CSS / JS 內若寫死 https://yiranmind.com，改成站內路徑（搬家時跑一次即可）
import fs from 'node:fs';
import path from 'node:path';

const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
let n = 0;
for (const f of walk(path.resolve('public')).filter(f => /\.(css|js)$/.test(f))) {
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes('yiranmind.com')) continue;
  fs.writeFileSync(f, s
    .replace(/https?:\/\/yiranmind\.com\//g, '/')
    .replace(/https?:\\\/\\\/yiranmind\.com\\\//g, '\\/'));
  n++;
}
console.log('rewrote', n, 'files');
