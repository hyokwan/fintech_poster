// Creator Studio 서버
// 실행: npm start  →  http://localhost:3001
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./config');
const store = require('./store');
const { loadSession, needLogin, needRole, needAdmin, sameOrigin } = require('./auth');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '80mb' })); // A4 300dpi PNG, 카페 이미지 여러 장
app.use(loadSession);
app.use(sameOrigin);

// ---------- API ----------
app.use(require('./routes/auth'));
app.use(require('./routes/files'));
app.use(require('./routes/org'));
app.use(require('./routes/admin'));
app.use(require('./routes/naver'));
app.use(require('./routes/ai'));
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

// ---------- 페이지 (로그인·권한 확인 후 보여줌) ----------
const page = (file) => (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, file));
const PAGES = {
  '/': ['index.html', needRole('viewer')],
  '/thumbnail.html': ['thumbnail.html', needRole('viewer')],
  '/poster.html': ['poster.html', needRole('viewer')],
  '/editor.html': ['editor.html', needRole('viewer')],
  '/emblem.html': ['emblem.html', needRole('viewer')],
  '/social.html': ['social.html', needRole('viewer')],
  '/banner.html': ['banner.html', needRole('viewer')],
  '/cafe.html': ['cafe.html', needRole('editor')],
  '/settings.html': ['settings.html', needRole('manager')],
  '/admin.html': ['admin.html', needAdmin],
  '/pending.html': ['pending.html', needLogin],
};
for (const [url, [file, guard]] of Object.entries(PAGES)) app.get(url, guard, page(file));
app.get('/index.html', (req, res) => res.redirect('/'));
app.get('/login.html', (req, res, next) => (req.user ? res.redirect('/') : next()), page('login.html'));

// 예전 작업 파일에 남아 있는 주소 호환
app.use('/baseEmblem', express.static(path.join(config.IMAGES_DIR, 'emblem')));

// css / js / fonts / vendor / images
app.use(express.static(config.PUBLIC_DIR, { index: false, extensions: [] }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: '파일이 너무 큽니다' });
  res.status(500).json({ error: err.message || 'server error' });
});

// ---------- 예전 구조(projects/, uploads/, output/)에서 옮겨오기 ----------
async function migrateLegacy() {
  const org = (await store.orgs.list())[0];
  if (!org) return;
  const moveDir = (from, to) => {
    if (!fs.existsSync(from)) return 0;
    fs.mkdirSync(to, { recursive: true });
    let n = 0;
    for (const f of fs.readdirSync(from)) {
      const src = path.join(from, f), dst = path.join(to, f);
      if (fs.statSync(src).isFile() && !fs.existsSync(dst)) { fs.renameSync(src, dst); n++; }
    }
    return n;
  };
  for (const legacy of [path.join(config.DATA_DIR, 'projects-legacy'), path.join(config.ROOT, 'projects')]) {
    if (!fs.existsSync(legacy)) continue;
    for (const f of fs.readdirSync(legacy).filter((x) => x.endsWith('.json'))) {
      const name = f.replace(/\.json$/, '');
      if (!(await store.projects.get(org.id, name))) await store.projects.put(org.id, name, fs.readFileSync(path.join(legacy, f), 'utf8'), null);
      fs.unlinkSync(path.join(legacy, f));
    }
    if (!fs.readdirSync(legacy).length) fs.rmdirSync(legacy);
    console.log(`예전 작업 파일을 "${org.name}" 학과로 옮겼습니다`);
  }
  for (const legacy of [path.join(config.DATA_DIR, 'uploads-legacy'), path.join(config.ROOT, 'uploads')]) {
    if (moveDir(legacy, config.orgDir(org.id, 'uploads'))) console.log(`예전 업로드 이미지를 "${org.name}" 학과로 옮겼습니다`);
    if (fs.existsSync(legacy) && !fs.readdirSync(legacy).length) fs.rmdirSync(legacy);
  }
  const out = path.join(config.ROOT, 'output');
  if (fs.existsSync(out)) {
    for (const k of config.KINDS) moveDir(path.join(out, k), config.orgDir(org.id, 'output', k));
    // 폴더 없이 바로 있던 썸네일
    moveDir(out, config.orgDir(org.id, 'output', 'thumbnail'));
  }
}

(async () => {
  await store.init();
  await migrateLegacy();
  app.listen(config.PORT, config.HOST, () => {
    const host = config.HOST === '0.0.0.0' ? 'localhost' : config.HOST;
    console.log(`Creator Studio: http://${host}:${config.PORT}  (DB: ${store.kind})`);
    if (config.HOST === '127.0.0.1') console.log('다른 PC에서 접속하게 하려면 .env 에 HOST=0.0.0.0 을 넣으세요.');
  });
})().catch((e) => { console.error(e); process.exit(1); });
