// 학과별 파일: 결과물 저장, 이미지 업로드, 작업 파일, 학과 로고·자료 이미지
// 파일은 data/orgs/<학과 id>/ 아래에 두고, 주소는 학과와 상관없이 /uploads/…, /output/…, /assets/… 로 같다.
// (현재 로그인한 학과의 폴더에서 찾으므로 다른 학과 파일은 볼 수 없음)
const fs = require('fs');
const path = require('path');
const express = require('express');
const { needRole } = require('../auth');
const { projects, orgs } = require('../store');
const { KINDS, IMAGES_DIR, orgDir, DEFAULT_ORG } = require('../config');

const r = express.Router();
const IMAGE_RE = /\.(png|jpe?g|webp|gif|svg)$/i;
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const safeName = (s, fb) => String(s || '').replace(/[^\w가-힣\-]+/g, '_').slice(0, 60) || fb;

// data:image/...;base64,... → { buf, ext }
function decodeImage(dataUrl, types = 'png|jpeg|webp|gif') {
  const m = new RegExp(`^data:image/(${types});base64,(.+)$`).exec(dataUrl || '');
  if (!m) return null;
  return { buf: Buffer.from(m[2], 'base64'), ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
}

function listImages(dir, urlPrefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => IMAGE_RE.test(f))
    .map((f) => ({ name: f, url: `${urlPrefix}/${encodeURIComponent(f)}`, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
}

// 기본 학과(AI핀테크융합과)만 public/images 의 원본 전단지·엠블럼을 씀
const isDefaultOrg = (o) => o && o.school === DEFAULT_ORG.school && o.name === DEFAULT_ORG.name;

function sendFrom(dir) {
  return (req, res) => {
    const file = path.join(dir(req), path.basename(req.params.file));
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
    res.sendFile(file);
  };
}

// ---------- 결과물 (이미지로 저장) ----------
r.post('/api/save', needRole('viewer'), (req, res) => {
  const { dataUrl, name, kind } = req.body || {};
  const img = decodeImage(dataUrl, 'png|jpeg');
  if (!img) return res.status(400).json({ error: 'invalid image' });
  const k = KINDS.includes(kind) ? kind : 'thumbnail';
  const dir = orgDir(req.org.id, 'output', k);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${safeName(name, k)}_${stamp()}.${img.ext}`;
  fs.writeFileSync(path.join(dir, file), img.buf);
  res.json({ ok: true, file: `${k}/${file}`, url: `/output/${k}/${encodeURIComponent(file)}` });
});

// 가장 최근 결과물 (kind 를 비우면 전체에서)
function outputs(orgId, kinds) {
  const list = [];
  for (const k of kinds) {
    for (const it of listImages(orgDir(orgId, 'output', k), `/output/${k}`)) list.push({ ...it, kind: k });
  }
  return list.sort((a, b) => b.t - a.t);
}

r.get('/api/latest', needRole('viewer'), (req, res) => {
  const k = KINDS.includes(req.query.kind) ? req.query.kind : 'thumbnail';
  const [f] = outputs(req.org.id, [k]);
  if (!f) return res.status(404).json({ error: `아직 저장한 ${k} 이미지가 없습니다` });
  res.json({ url: f.url, file: f.name });
});

r.get('/api/outputs', needRole('viewer'), (req, res) => {
  const kinds = KINDS.includes(req.query.kind) ? [req.query.kind] : KINDS;
  res.json(outputs(req.org.id, kinds).slice(0, Math.min(200, +req.query.limit || 24)));
});

r.delete('/api/outputs/:kind/:file', needRole('editor'), (req, res) => {
  if (!KINDS.includes(req.params.kind)) return res.status(400).json({ error: 'bad kind' });
  const file = path.join(orgDir(req.org.id, 'output', req.params.kind), path.basename(req.params.file));
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

r.get('/output/:kind/:file', needRole('viewer'), (req, res, next) => {
  if (!KINDS.includes(req.params.kind)) return res.status(404).end();
  sendFrom((q) => orgDir(q.org.id, 'output', q.params.kind))(req, res, next);
});

// ---------- 편집기에 올린 이미지 ----------
r.post('/api/upload', needRole('editor'), (req, res) => {
  const img = decodeImage(req.body?.dataUrl);
  if (!img) return res.status(400).json({ error: 'invalid image' });
  const dir = orgDir(req.org.id, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const file = `${stamp()}_${Math.random().toString(36).slice(2, 7)}.${img.ext}`;
  fs.writeFileSync(path.join(dir, file), img.buf);
  res.json({ url: `/uploads/${file}` });
});
r.get('/uploads/:file', needRole('viewer'), sendFrom((q) => orgDir(q.org.id, 'uploads')));

// ---------- 학과 자료 (로고·심볼·엠블럼 이미지) ----------
r.get('/assets/:file', needRole('viewer'), sendFrom((q) => orgDir(q.org.id, 'assets')));

// slot: logo(학과 로고) | symbol(심볼 마크) | library(자료 이미지)
r.post('/api/org/asset', needRole('manager'), async (req, res) => {
  const { dataUrl, slot } = req.body || {};
  const img = decodeImage(dataUrl, 'png|jpeg|webp|gif|svg\\+xml');
  if (!img) return res.status(400).json({ error: 'invalid image' });
  if (img.ext === 'svg+xml') img.ext = 'svg';
  const dir = orgDir(req.org.id, 'assets');
  fs.mkdirSync(dir, { recursive: true });
  const file = `${slot === 'logo' || slot === 'symbol' ? slot : 'img'}_${stamp()}.${img.ext}`;
  fs.writeFileSync(path.join(dir, file), img.buf);
  const url = `/assets/${file}`;
  if (slot === 'logo' || slot === 'symbol') await orgs.update(req.org.id, { [slot]: url });
  res.json({ ok: true, url });
});

r.delete('/api/org/asset/:file', needRole('manager'), async (req, res) => {
  const name = path.basename(req.params.file);
  const file = path.join(orgDir(req.org.id, 'assets'), name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const url = `/assets/${name}`;
  if (req.org.logo === url) await orgs.update(req.org.id, { logo: '' });
  if (req.org.symbol === url) await orgs.update(req.org.id, { symbol: '' });
  res.json({ ok: true });
});

// 편집기 이미지 탭: 학과 자료 + 올린 이미지
r.get('/api/images', needRole('viewer'), (req, res) => {
  const assets = listImages(orgDir(req.org.id, 'assets'), '/assets');
  const builtin = isDefaultOrg(req.org) ? listImages(path.join(IMAGES_DIR, 'emblem'), '/images/emblem') : [];
  res.json({ uploads: listImages(orgDir(req.org.id, 'uploads'), '/uploads'), emblems: assets.concat(builtin) });
});

// 기본 학과의 원본 전단지 (로고를 잘라 쓰는 용도)
r.get('/api/base-poster', needRole('viewer'), (req, res) => {
  const dir = path.join(IMAGES_DIR, 'poster');
  const file = isDefaultOrg(req.org) && fs.existsSync(dir) && fs.readdirSync(dir).find((f) => /\.(png|jpe?g)$/i.test(f));
  if (!file) return res.status(404).json({ error: '원본 전단지가 없습니다' });
  res.sendFile(path.join(dir, file));
});

// ---------- 작업 파일 ----------
const projectName = (q) => safeName(q.query.name, 'poster');
r.get('/api/project', needRole('viewer'), async (req, res) => {
  const doc = await projects.get(req.org.id, projectName(req));
  if (!doc) return res.status(404).json({ error: 'no project' });
  res.type('application/json').send(doc);
});
r.post('/api/project', needRole('editor'), async (req, res) => {
  const doc = req.body;
  if (!doc || !Array.isArray(doc.els)) return res.status(400).json({ error: 'invalid project' });
  await projects.put(req.org.id, projectName(req), JSON.stringify(doc), req.user.id);
  res.json({ ok: true });
});

module.exports = r;
module.exports.isDefaultOrg = isDefaultOrg;
module.exports.decodeImage = decodeImage;
