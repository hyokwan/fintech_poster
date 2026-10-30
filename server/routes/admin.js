// 최고 관리자: 가입 승인, 학과 만들기, 학과별 멤버 지정, 시스템 설정(가입, 네이버 앱)
// AI 엔진 등록은 routes/ai.js
const express = require('express');
const { needAdmin } = require('../auth');
const { users, orgs, members, settings, publicUser, ROLES } = require('../store');

const r = express.Router();
r.use('/api/admin', needAdmin);

const mask = (s) => (s ? s.slice(0, 4) + '••••' + s.slice(-4) : '');

r.get('/api/admin/overview', async (req, res) => {
  const [us, os, ms] = await Promise.all([users.list(), orgs.list(), members.all()]);
  res.json({
    users: us.map((u) => ({ ...publicUser(u), orgs: ms.filter((m) => m.user_id === u.id).map((m) => ({ orgId: m.org_id, role: m.role })) })),
    orgs: os.map((o) => ({ id: o.id, school: o.school, campus: o.campus, name: o.name, members: ms.filter((m) => m.org_id === o.id).length })),
  });
});

r.post('/api/admin/users/:id', async (req, res) => {
  const id = +req.params.id;
  const { status, isAdmin } = req.body || {};
  if (id === req.user.id && (status && status !== 'active' || isAdmin === false)) return res.status(400).json({ error: '내 계정은 중지하거나 관리자에서 뺄 수 없습니다' });
  if (status && !['active', 'pending', 'disabled'].includes(status)) return res.status(400).json({ error: 'bad status' });
  await users.update(id, { status, isAdmin });
  res.json({ ok: true });
});

r.delete('/api/admin/users/:id', async (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: '내 계정은 지울 수 없습니다' });
  await users.remove(+req.params.id);
  res.json({ ok: true });
});

// 사용자를 학과에 넣기 / 역할 바꾸기 / 빼기 (role 이 비면 빼기)
r.post('/api/admin/members', async (req, res) => {
  const { userId, orgId, role } = req.body || {};
  if (!(await users.byId(+userId)) || !(await orgs.byId(+orgId))) return res.status(404).json({ error: '사용자 또는 학과가 없습니다' });
  if (!role) await members.remove(+userId, +orgId);
  else if (!ROLES.includes(role)) return res.status(400).json({ error: '알 수 없는 역할입니다' });
  else {
    await members.set(+userId, +orgId, role);
    const u = await users.byId(+userId);
    if (u.status === 'pending') await users.update(u.id, { status: 'active' });
  }
  res.json({ ok: true });
});

r.post('/api/admin/orgs', async (req, res) => {
  const { school, campus, name } = req.body || {};
  if (!String(school || '').trim() || !String(name || '').trim()) return res.status(400).json({ error: '학교와 학과 이름을 입력해 주세요' });
  const o = await orgs.create({ school: school.trim(), campus: (campus || '').trim(), name: name.trim(), youtube: name.trim(), hashtags: `#${school.replace(/\s/g, '')} #${name.replace(/\s/g, '')}` });
  res.json({ ok: true, id: o.id });
});

r.delete('/api/admin/orgs/:id', async (req, res) => {
  await orgs.remove(+req.params.id);
  res.json({ ok: true });
});

// 시스템 설정: 비밀 값은 가려서 보여주고, 빈 값으로 보내면 그대로 둔다
r.get('/api/admin/settings', async (req, res) => {
  res.json({
    signup: await settings.get('signup', 'open'),
    naverClientId: await settings.get('naver_client_id'),
    naverClientSecret: mask(await settings.get('naver_client_secret')),
  });
});

r.post('/api/admin/settings', async (req, res) => {
  const b = req.body || {};
  if (b.signup) await settings.set('signup', b.signup === 'closed' ? 'closed' : 'open');
  if (b.naverClientId != null) await settings.set('naver_client_id', String(b.naverClientId).trim());
  if (b.naverClientSecret) await settings.set('naver_client_secret', String(b.naverClientSecret).trim());
  res.json({ ok: true });
});

module.exports = r;
