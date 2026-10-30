// 네이버 로그인 연결 + 카페 글쓰기
// 네이버 앱(Client ID/Secret)은 최고 관리자가 한 번 등록하고, 학과마다 카페에 글을 쓸 네이버 계정을 연결한다.
// API 명세: https://developers.naver.com/docs/login/cafe-api/cafe-api.md
const crypto = require('crypto');
const express = require('express');
const { needRole } = require('../auth');
const { orgs, settings } = require('../store');
const { PUBLIC_URL } = require('../config');
const { decodeImage } = require('./files');

const r = express.Router();
const pendingStates = new Map(); // state → { orgId, exp }

const callbackUrl = (req) => `${PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/api/naver/callback`;

async function app() {
  const id = await settings.get('naver_client_id'), secret = await settings.get('naver_client_secret');
  if (!id || !secret) throw Object.assign(new Error('최고 관리자가 아직 네이버 앱(Client ID/Secret)을 등록하지 않았습니다'), { status: 400 });
  return { id, secret };
}

async function tokenRequest(params) {
  const res = await fetch('https://nid.naver.com/oauth2.0/token?' + new URLSearchParams(params));
  const j = await res.json().catch(() => ({}));
  if (!j.access_token) throw new Error(j.error_description || j.error || `토큰 발급 실패 (HTTP ${res.status})`);
  return { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (+j.expires_in || 3600) * 1000 };
}

// 학과의 접근 토큰 (만료 1분 전이면 새로 받음)
async function accessToken(orgId, force = false) {
  const secret = await orgs.getSecret(orgId);
  const nv = secret.naver;
  if (!nv?.access) throw Object.assign(new Error('네이버 계정이 연결되지 않았습니다. 학과 설정에서 연결해 주세요.'), { status: 400 });
  if (!force && nv.expires > Date.now() + 60_000) return nv.access;
  if (!nv.refresh) throw Object.assign(new Error('네이버 연결이 만료되었습니다. 학과 설정에서 다시 연결해 주세요.'), { status: 401 });
  const a = await app();
  const t = await tokenRequest({ grant_type: 'refresh_token', client_id: a.id, client_secret: a.secret, refresh_token: nv.refresh });
  secret.naver = { ...nv, access: t.access, expires: t.expires, refresh: t.refresh || nv.refresh };
  await orgs.setSecret(orgId, secret);
  return t.access;
}

r.get('/api/naver/callback-url', needRole('manager'), (req, res) => res.json({ url: callbackUrl(req) }));

r.get('/api/naver/login', needRole('manager'), async (req, res) => {
  try {
    const a = await app();
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, { orgId: req.org.id, exp: Date.now() + 10 * 60_000 });
    res.redirect('https://nid.naver.com/oauth2.0/authorize?' + new URLSearchParams({ response_type: 'code', client_id: a.id, redirect_uri: callbackUrl(req), state }));
  } catch (e) {
    res.redirect('/settings.html?naver=' + encodeURIComponent(e.message) + '#cafe');
  }
});

r.get('/api/naver/callback', needRole('manager'), async (req, res) => {
  const back = (msg) => res.redirect('/settings.html?naver=' + encodeURIComponent(msg) + '#cafe');
  const st = pendingStates.get(String(req.query.state));
  pendingStates.delete(String(req.query.state));
  if (!st || st.exp < Date.now() || st.orgId !== req.org.id) return back('연결 요청이 만료되었습니다. 다시 시도해 주세요.');
  if (req.query.error) return back(req.query.error_description || '네이버 로그인을 취소했습니다');
  try {
    const a = await app();
    const t = await tokenRequest({ grant_type: 'authorization_code', client_id: a.id, client_secret: a.secret, code: req.query.code, state: req.query.state });
    let name = '';
    try {
      const me = await (await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${t.access}` } })).json();
      name = me.response?.nickname || me.response?.name || me.response?.email || '';
    } catch (e) { /* 프로필 권한이 없어도 글쓰기는 됨 */ }
    const secret = await orgs.getSecret(req.org.id);
    secret.naver = { ...t, name };
    await orgs.setSecret(req.org.id, secret);
    back('ok');
  } catch (e) {
    back(e.message);
  }
});

r.post('/api/naver/disconnect', needRole('manager'), async (req, res) => {
  const secret = await orgs.getSecret(req.org.id);
  const nv = secret.naver;
  delete secret.naver;
  await orgs.setSecret(req.org.id, secret);
  // 네이버 쪽 토큰도 지움 (실패해도 연결 해제는 완료)
  try {
    const a = await app();
    if (nv?.access) await fetch('https://nid.naver.com/oauth2.0/token?' + new URLSearchParams({ grant_type: 'delete', client_id: a.id, client_secret: a.secret, access_token: nv.access, service_provider: 'NAVER' }));
  } catch (e) { /* 무시 */ }
  res.json({ ok: true });
});

// 네이버 응답에서 결과/오류 꺼내기
function parseCafe(j, status) {
  const m = j?.message;
  if (m?.result?.articleUrl || m?.status === '200') return { ok: true, url: m.result?.articleUrl, articleId: m.result?.articleId };
  const code = m?.error?.code || j?.errorCode || status;
  let msg = m?.error?.msg || j?.errorMessage || `카페 글쓰기 실패 (HTTP ${status})`;
  if (status === 403 && !m?.error) msg = '네이버 앱에 "카페" API 권한이 없습니다. 네이버 개발자센터 > 내 애플리케이션 > API 권한관리에서 카페를 추가하세요.';
  if (status === 401) msg = '네이버 인증이 만료되었습니다. 학과 설정에서 다시 연결해 주세요.';
  return { ok: false, code, msg };
}

const bool = (v) => (v ? 'true' : 'false');

r.post('/api/cafe/post', needRole('editor'), async (req, res) => {
  const { menuId, subject, content, images = [], openyn = false, searchopen = true, replyyn = true } = req.body || {};
  const cafe = JSON.parse(req.org.cafe || '{}');
  if (!cafe.clubId) return res.status(400).json({ error: '학과 설정에서 카페 ID(clubid)를 먼저 입력해 주세요' });
  if (!/^\d+$/.test(String(menuId || ''))) return res.status(400).json({ error: '게시판을 골라 주세요' });
  if (!String(subject || '').trim()) return res.status(400).json({ error: '제목을 입력해 주세요' });
  if (!String(content || '').trim()) return res.status(400).json({ error: '본문을 입력해 주세요' });
  if (images.length > 10) return res.status(400).json({ error: '이미지는 10장까지 올릴 수 있습니다' });

  const files = [];
  for (const d of images) {
    const img = decodeImage(d, 'png|jpeg|gif');
    if (!img) return res.status(400).json({ error: '이미지 형식은 PNG, JPG, GIF만 됩니다' });
    files.push(img);
  }

  const send = async (token) => {
    const form = new FormData();
    // 명세: subject/content 는 URL 인코딩한 값 (multipart 예제는 UTF-8 인코딩 한 번)
    form.append('subject', encodeURIComponent(String(subject).trim().slice(0, 200)));
    form.append('content', encodeURIComponent(String(content)));
    form.append('openyn', bool(openyn));
    form.append('searchopen', bool(openyn || searchopen));
    form.append('replyyn', bool(replyyn));
    files.forEach((f, i) => form.append('image', new Blob([f.buf], { type: f.ext === 'jpg' ? 'image/jpeg' : `image/${f.ext}` }), `image${i + 1}.${f.ext}`));
    const resp = await fetch(`https://openapi.naver.com/v1/cafe/${cafe.clubId}/menu/${menuId}/articles`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    return { status: resp.status, j: await resp.json().catch(() => null) };
  };

  try {
    let out = await send(await accessToken(req.org.id));
    if (out.status === 401) out = await send(await accessToken(req.org.id, true)); // 토큰이 막 만료된 경우 한 번 더
    const result = parseCafe(out.j, out.status);
    if (!result.ok) return res.status(502).json({ error: `${result.msg}${result.code ? ` [${result.code}]` : ''}` });
    console.log(`[카페] ${req.org.name} / ${req.user.email} → ${result.url}`);
    res.json({ ok: true, url: result.url });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

module.exports = r;
