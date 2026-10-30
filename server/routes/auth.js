// 회원가입 / 로그인 / 로그아웃 / 내 정보 / 학과 전환
const express = require('express');
const { users, members, orgs, sessions, settings, publicOrg, checkPw } = require('../store');
const { needLogin, setSessionCookie, clearSessionCookie } = require('../auth');

const r = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

r.post('/api/auth/signup', async (req, res) => {
  const { email, name, password, note } = req.body || {};
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: '이메일 형식을 확인해 주세요' });
  if (!name || !String(name).trim()) return res.status(400).json({ error: '이름을 입력해 주세요' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상으로 정해 주세요' });
  if (await users.byEmail(email)) return res.status(409).json({ error: '이미 가입된 이메일입니다' });

  // 맨 처음 가입한 사람은 최고 관리자 + 첫 학과의 학과 관리자
  const first = (await users.count()) === 0;
  if (!first && (await settings.get('signup', 'open')) === 'closed') return res.status(403).json({ error: '지금은 가입을 받지 않습니다' });
  const u = await users.create({ email, name: String(name).trim().slice(0, 100), password, note: String(note || '').slice(0, 500), isAdmin: first, status: first ? 'active' : 'pending' });
  if (first) {
    const org = (await orgs.list())[0];
    if (org) await members.set(u.id, org.id, 'manager');
    setSessionCookie(res, await sessions.create(u.id, org?.id));
    return res.json({ ok: true, active: true });
  }
  res.json({ ok: true, active: false });
});

r.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const u = email && (await users.byEmail(email));
  if (!u || !(await checkPw(String(password || ''), u.pw))) return res.status(401).json({ error: '이메일 또는 비밀번호가 맞지 않습니다' });
  if (u.status === 'pending') return res.status(403).json({ error: '가입 승인을 기다리는 중입니다. 관리자에게 문의해 주세요.' });
  if (u.status !== 'active') return res.status(403).json({ error: '사용이 중지된 계정입니다' });
  setSessionCookie(res, await sessions.create(u.id, null));
  res.json({ ok: true });
});

r.post('/api/auth/logout', async (req, res) => {
  if (req.sid) await sessions.remove(req.sid);
  clearSessionCookie(res);
  res.json({ ok: true });
});

r.post('/api/auth/password', needLogin, async (req, res) => {
  const { current, password } = req.body || {};
  if (!(await checkPw(String(current || ''), req.user.pw))) return res.status(400).json({ error: '지금 비밀번호가 맞지 않습니다' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: '새 비밀번호는 8자 이상으로 정해 주세요' });
  await users.setPassword(req.user.id, password);
  res.json({ ok: true });
});

// 페이지에서 <script src="/api/me.js"> 로 불러 쓰는 내 정보 + 현재 학과 정보
r.get('/api/me.js', async (req, res) => {
  let me = null, dept = null;
  if (req.user) {
    const list = req.user.is_admin ? await orgs.list() : await members.ofUser(req.user.id);
    me = {
      id: req.user.id, name: req.user.name, email: req.user.email, isAdmin: !!req.user.is_admin,
      role: req.role || null, orgId: req.org?.id || null,
      orgs: list.map((o) => ({ id: o.id, school: o.school, name: o.name, role: o.role || 'manager' })),
    };
    dept = publicOrg(req.org);
  }
  res.type('application/javascript').set('Cache-Control', 'no-store')
    .send(`window.ME = ${JSON.stringify(me)};\nwindow.DEPT = ${JSON.stringify(dept)};\n`);
});

r.post('/api/me/org', needLogin, async (req, res) => {
  const id = +req.body?.orgId;
  const ok = req.user.is_admin ? await orgs.byId(id) : await members.role(req.user.id, id);
  if (!ok) return res.status(403).json({ error: '그 학과의 멤버가 아닙니다' });
  await sessions.setOrg(req.sid, id);
  res.json({ ok: true });
});

module.exports = r;
