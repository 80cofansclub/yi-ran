// 環境檢查：新電腦 clone 下來後先跑一次
// 用法：node tools/doctor.mjs（或 npm run doctor）
// 只做檢查、不安裝任何東西；缺少的項目會列出建議的安裝指令，由使用者決定要不要裝
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve('.');
const isWin = process.platform === 'win32';
const run = cmd => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
const results = [];
const add = (level, name, detail, fix) => results.push({ level, name, detail, fix });

// 1. Node.js（必要）
const major = Number(process.versions.node.split('.')[0]);
if (major >= 20) add('ok', 'Node.js', `v${process.versions.node}`);
else add('fail', 'Node.js', `v${process.versions.node}，需要 20 以上（GitHub Actions 用 22）`,
  isWin ? 'winget install OpenJS.NodeJS.LTS' : 'brew install node@22  （或到 https://nodejs.org 下載 LTS）');

// 2. npm 套件（必要）
const hasDep = n => fs.existsSync(path.join(ROOT, 'node_modules', n, 'package.json'));
if (hasDep('marked')) add('ok', '建置套件 marked', '已安裝');
else add('fail', '建置套件 marked', '未安裝，無法建置網站', 'npm install');
if (hasDep('cheerio')) add('ok', '工具套件 cheerio', '已安裝');
else add('warn', '工具套件 cheerio', '未安裝（只有搬家工具與比對工具需要）', 'npm install');

// 3. Git（必要）
const gitVer = run('git --version');
if (gitVer) add('ok', 'Git', gitVer);
else add('fail', 'Git', '找不到 git', isWin ? 'winget install Git.Git' : 'brew install git');

if (gitVer) {
  // 4. repo 的 git 身分：repo 層級設定不會跟著 clone，新電腦要重設
  const email = run('git config user.email');
  const want = '27292529+80cofansclub@users.noreply.github.com';
  if (email === want) add('ok', 'Git 身分', `80cofansclub <${email}>`);
  else add('warn', 'Git 身分', `目前是 ${email || '（未設定）'}；此 repo 是 Public，commit 應使用 GitHub 匿名信箱`,
    `git config user.name "80cofansclub" && git config user.email "${want}"`);

  // 5. 遠端
  const remote = run('git remote get-url origin');
  if (remote && remote.includes('80cofansclub/yi-ran')) add('ok', 'Git 遠端', remote);
  else add('warn', 'Git 遠端', remote || '（未設定）', 'git remote add origin https://github.com/80cofansclub/yi-ran.git');
  if (remote && remote.startsWith('git@')) add('warn', 'Git 遠端協定', '使用 SSH；公司網路會擋 22 port', 'git remote set-url origin https://github.com/80cofansclub/yi-ran.git');

  // 6. 推送用的登入（HTTPS 需要 Git Credential Manager）
  const helper = run('git config --get credential.helper');
  if (helper) add('ok', 'Git 登入工具', helper);
  else add('warn', 'Git 登入工具', '未設定 credential.helper，push 時可能無法登入 GitHub',
    isWin ? '重新安裝 Git for Windows（內含 Git Credential Manager）' : 'brew install --cask git-credential-manager');
}

// 7. 只存在本機的檔案（不在 git 裡）
if (fs.existsSync(path.join(ROOT, '_export', 'html'))) add('ok', '原站備份 _export/', '存在');
else add('warn', '原站備份 _export/', '不存在：npm run check 與搬家工具無法使用（日常建置不受影響）', '從舊電腦複製 _export/ 資料夾過來');
if (fs.existsSync(path.join(ROOT, 'docs', 'report.html'))) add('ok', '分析報告 docs/report.html', '存在');
else add('warn', '分析報告 docs/report.html', '不存在（只留本機、不進 git）', '需要時從舊電腦複製');

// 輸出
const icon = { ok: '✅', warn: '⚠️ ', fail: '❌' };
console.log('\n環境檢查結果\n');
for (const r of results) {
  console.log(`${icon[r.level]} ${r.name}：${r.detail}`);
  if (r.fix && r.level !== 'ok') console.log(`     建議：${r.fix}`);
}
const fails = results.filter(r => r.level === 'fail').length;
const warns = results.filter(r => r.level === 'warn').length;
console.log(`\n必要項目缺少 ${fails} 項、提醒 ${warns} 項。${fails ? '請先補齊必要項目再建置。' : '可以建置。'}`);
process.exitCode = fails ? 1 : 0;
