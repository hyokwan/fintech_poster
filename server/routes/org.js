// 학과 설정 (학과 관리자): 학과 정보, 카페 게시판, 멤버
const express = require('express');
const { needRole } = require('../auth');
const { orgs, members, users, publicOrg, ROLES } = require('../store');

const r = express.Router();

r.get('/api/org', needRole('manager'), async (req, res) => {
  const list = await members.ofOrg(req.org.id);
  res.json({ org: publicOrg(req.org), members: list.map((m) => ({ id: m.id, email: m.email, name: m.name, status: m.status, role: m.role })) });
});

r.post('/api/org', needRole('manager'), async (req, res) => {
  const b = req.body || {};
  if (b.name != null && !String(b.name).trim()) return res.status(400).json({ error: '학과 이름을 입력해 주세요' });
  if (b.school != null && !String(b.school).trim()) return res.status(400).json({ error: '학교 이름을 입력해 주세요' });
  const fields = {};
  for (const k of ['school', 'campus', 'name', 'name_en', 'youtube', 'website', 'slogan', 'hashtags', 'logo', 'symbol', 'symbolKnockout']) if (b[k] != null) fields[k] = b[k];
  if (b.cafe) {
    // 카페 정보: clubId(숫자), 게시판 목록 [{ name, menuId }]
    const clubId = String(b.cafe.clubId || '').replace(/\D/g, '');
    const boards = (Array.isArray(b.cafe.boards) ? b.cafe.boards : [])
      .map((x) => ({ name: String(x.name || '').trim().slice(0, 50), menuId: String(x.menuId || '').replace(/\D/g, '') }))
      .filter((x) => x.name && x.menuId).slice(0, 30);
    fields.cafe = { clubId, url: String(b.cafe.url || '').trim().slice(0, 200), boards };
  }
  await orgs.update(req.org.id, fields);
  res.json({ ok: true, org: publicOrg(await orgs.byId(req.org.id)) });
});

// 멤버 추가: 가입한 사람의 이메일로 추가 (승인 대기 중이면 바로 승인)
r.post('/api/org/members', needRole('manager'), async (req, res) => {
  const { email, role } = req.body || {};
  if (!ROLES.includes(role)) return res.status(400).json({ error: '역할을 골라 주세요' });
  const u = await users.byEmail(email || '');
  if (!u) return res.status(404).json({ error: '그 이메일로 가입한 사람이 없습니다. 먼저 회원가입을 부탁하세요.' });
  if (u.status === 'disabled') return res.status(400).json({ error: '사용이 중지된 계정입니다' });
  if (u.status === 'pending') await users.update(u.id, { status: 'active' });
  await members.set(u.id, req.org.id, role);
  res.json({ ok: true });
});

r.post('/api/org/members/:id', needRole('manager'), async (req, res) => {
  const role = req.body?.role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: '알 수 없는 역할입니다' });
  if (+req.params.id === req.user.id && role !== 'manager' && !req.user.is_admin) return res.status(400).json({ error: '내 역할은 낮출 수 없습니다' });
  if (!(await members.role(+req.params.id, req.org.id))) return res.status(404).json({ error: '이 학과 멤버가 아닙니다' });
  await members.set(+req.params.id, req.org.id, role);
  res.json({ ok: true });
});

r.delete('/api/org/members/:id', needRole('manager'), async (req, res) => {
  if (+req.params.id === req.user.id && !req.user.is_admin) return res.status(400).json({ error: '나 자신은 뺄 수 없습니다' });
  await members.remove(+req.params.id, req.org.id);
  res.json({ ok: true });
});

module.exports = r;
