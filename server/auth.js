// 로그인 세션 쿠키와 권한 검사 미들웨어
const { sessions, users, members, orgs, roleAtLeast } = require('./store');
const { COOKIE_SECURE } = require('./config');

const COOKIE = 'cs_sid';

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setSessionCookie(res, id) {
  res.cookie(COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: COOKIE_SECURE, maxAge: 30 * 24 * 3600 * 1000, path: '/' });
}
function clearSessionCookie(res) { res.clearCookie(COOKIE, { path: '/' }); }

// 모든 요청에 req.user / req.org / req.role 을 붙인다 (로그인 안 했으면 비어 있음)
async function loadSession(req, res, next) {
  try {
    const s = await sessions.get(readCookie(req, COOKIE));
    if (!s) return next();
    const user = await users.byId(s.user_id);
    if (!user || user.status !== 'active') return next();
    req.sid = s.id;
    req.user = user;
    // 현재 학과: 세션에 고른 학과가 있고 그 학과 멤버(또는 최고 관리자)면 그대로, 아니면 첫 소속 학과
    let orgId = s.org_id, role = orgId ? await members.role(user.id, orgId) : null;
    if (orgId && !role && user.is_admin && (await orgs.byId(orgId))) role = 'manager';
    if (!role) {
      const mine = await members.ofUser(user.id);
      if (mine.length) { orgId = mine[0].id; role = mine[0].role; }
      else if (user.is_admin) { const all = await orgs.list(); if (all.length) { orgId = all[0].id; role = 'manager'; } }
      else orgId = null;
      if (orgId !== s.org_id) await sessions.setOrg(s.id, orgId);
    }
    if (orgId) { req.org = await orgs.byId(orgId); req.role = role; }
    next();
  } catch (e) { next(e); }
}

const isApi = (req) => req.originalUrl.startsWith('/api/');

// 로그인 필요
function needLogin(req, res, next) {
  if (req.user) return next();
  if (isApi(req)) return res.status(401).json({ error: '로그인이 필요합니다' });
  res.redirect('/login.html?next=' + encodeURIComponent(req.originalUrl));
}

// 학과 소속 + 최소 역할 필요
function needRole(role) {
  return (req, res, next) => {
    if (!req.user) return needLogin(req, res, next);
    if (!req.org) {
      if (isApi(req)) return res.status(403).json({ error: '소속 학과가 없습니다. 관리자 승인을 기다려 주세요.' });
      return res.redirect('/pending.html');
    }
    if (!roleAtLeast(req.role, role)) {
      const msg = { editor: '편집 권한이 없습니다 (보기·저장 전용)', manager: '학과 관리자만 할 수 있습니다' }[role] || '권한이 없습니다';
      if (isApi(req)) return res.status(403).json({ error: msg });
      return res.redirect('/');
    }
    next();
  };
}

function needAdmin(req, res, next) {
  if (!req.user) return needLogin(req, res, next);
  if (!req.user.is_admin) return isApi(req) ? res.status(403).json({ error: '최고 관리자만 할 수 있습니다' }) : res.redirect('/');
  next();
}

// 다른 사이트에서 몰래 보내는 요청 막기 (Origin 이 있으면 같은 호스트여야 함)
function sameOrigin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'bad origin' }); }
    catch (e) { return res.status(403).json({ error: 'bad origin' }); }
  }
  next();
}

module.exports = { loadSession, needLogin, needRole, needAdmin, sameOrigin, setSessionCookie, clearSessionCookie };
