// 유튜브 썸네일 에디터 서버 (의존성 없음)
// 실행: node server.js  →  http://localhost:3001
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT_DIR = path.join(__dirname, 'output');
const MAX_BODY = 60 * 1024 * 1024; // A4 300dpi 포스터 PNG도 받을 수 있게
const BASE_POSTER_DIR = path.join(__dirname, 'basePoster');
const KINDS = ['thumbnail', 'poster', 'social'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function serveStatic(res, baseDir, urlPath) {
  const filePath = path.normalize(path.join(baseDir, decodeURIComponent(urlPath)));
  if (!filePath.startsWith(baseDir)) return sendJson(res, 403, { error: 'forbidden' });
  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

function handleSave(req, res) {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) {
      sendJson(res, 413, { error: 'too large' });
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    try {
      const { dataUrl, name, kind } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl || '');
      if (!m) return sendJson(res, 400, { error: 'invalid image' });
      const ext = m[1] === 'jpeg' ? 'jpg' : 'png';
      const dir = KINDS.includes(kind) ? kind : 'thumbnail';
      const safe = String(name || dir).replace(/[^\w가-힣\-]+/g, '_').slice(0, 60) || dir;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = `${dir}/${safe}_${stamp}.${ext}`;
      fs.mkdirSync(path.join(OUTPUT_DIR, dir), { recursive: true });
      fs.writeFileSync(path.join(OUTPUT_DIR, file), Buffer.from(m[2], 'base64'));
      console.log(`저장됨: output/${file}`);
      sendJson(res, 200, { ok: true, file: `output/${file}` });
    } catch (e) {
      sendJson(res, 400, { error: e.message });
    }
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'POST' && url.pathname === '/api/save') return handleSave(req, res);
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
    if (url.pathname.startsWith('/output/')) return serveStatic(res, OUTPUT_DIR, url.pathname.slice('/output/'.length));
    if (url.pathname === '/api/latest') {
      // output/<kind>/ 에서 가장 최근에 저장한 이미지 (SNS 영상 홍보에 썸네일 불러오기용)
      const kind = KINDS.includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'thumbnail';
      const dir = path.join(OUTPUT_DIR, kind);
      const files = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f))
            .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)
        : [];
      if (!files.length) return sendJson(res, 404, { error: `output/${kind} 폴더에 저장된 이미지가 없습니다` });
      return sendJson(res, 200, { url: `/output/${kind}/${encodeURIComponent(files[0].f)}`, file: files[0].f });
    }
    if (url.pathname === '/api/base-poster') {
      // basePoster 폴더의 첫 번째 이미지 (로고 추출용)
      const file = fs.readdirSync(BASE_POSTER_DIR).find((f) => /\.(png|jpe?g)$/i.test(f));
      if (!file) return sendJson(res, 404, { error: 'basePoster 폴더에 이미지가 없습니다' });
      return serveStatic(res, BASE_POSTER_DIR, encodeURIComponent(file));
    }
    serveStatic(res, PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  })
  .listen(PORT, () => {
    console.log(`썸네일 에디터: http://localhost:${PORT}`);
  });
