// 데이터 다루기: 사용자, 학과(조직), 멤버, 작업 파일, 세션, 시스템 설정
// 라우트에서는 SQL 을 직접 쓰지 않고 여기 함수만 쓴다. (DB 를 바꿔도 여기만 고치면 됨)
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const { open } = require('./db');
const { DEFAULT_ORG } = require('./config');

let db;
const now = () => Date.now();
const json = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch (e) { return fb; } };

// 역할: manager(학과 관리자) > editor(편집자) > viewer(보기·이미지 저장만)
const ROLES = ['viewer', 'editor', 'manager'];
const roleAtLeast = (role, need) => ROLES.indexOf(role) >= ROLES.indexOf(need);

// ---------- 비밀번호 ----------
async function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await scrypt(pw, salt, 64)).toString('hex')}`;
}
async function checkPw(pw, stored) {
  const [, salt, hex] = String(stored).split('$');
  if (!salt || !hex) return false;
  const got = await scrypt(pw, salt, 64);
  return crypto.timingSafeEqual(got, Buffer.from(hex, 'hex'));
}

// ---------- 사용자 ----------
const publicUser = (u) => u && { id: u.id, email: u.email, name: u.name, isAdmin: !!u.is_admin, status: u.status, note: u.note, createdAt: u.created_at };

const users = {
  count: async () => (await db.get('SELECT COUNT(*) AS n FROM hkpromo_users')).n,
  byId: (id) => db.get('SELECT * FROM hkpromo_users WHERE id = ?', [id]),
  byEmail: (email) => db.get('SELECT * FROM hkpromo_users WHERE email = ?', [String(email).trim().toLowerCase()]),
  async create({ email, name, password, note, isAdmin = false, status = 'pending' }) {
    const r = await db.run('INSERT INTO hkpromo_users (email, name, pw, is_admin, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [String(email).trim().toLowerCase(), name, await hashPw(password), isAdmin ? 1 : 0, status, note || '', now()]);
    return users.byId(r.id);
  },
  list: () => db.all('SELECT * FROM hkpromo_users ORDER BY created_at DESC'),
  async update(id, { status, isAdmin, name }) {
    if (status) await db.run('UPDATE hkpromo_users SET status = ? WHERE id = ?', [status, id]);
    if (isAdmin != null) await db.run('UPDATE hkpromo_users SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, id]);
    if (name) await db.run('UPDATE hkpromo_users SET name = ? WHERE id = ?', [name, id]);
  },
  async setPassword(id, password) { await db.run('UPDATE hkpromo_users SET pw = ? WHERE id = ?', [await hashPw(password), id]); },
  async remove(id) {
    await db.run('DELETE FROM hkpromo_members WHERE user_id = ?', [id]);
    await db.run('DELETE FROM hkpromo_sessions WHERE user_id = ?', [id]);
    await db.run('DELETE FROM hkpromo_users WHERE id = ?', [id]);
  },
};

// ---------- 학과(조직) ----------
const ORG_FIELDS = ['school', 'campus', 'name', 'name_en', 'youtube', 'website', 'slogan', 'hashtags'];

// 화면에 보내는 학과 정보 (비밀 값은 빼고)
function publicOrg(o) {
  if (!o) return null;
  const secret = json(o.secret, {});
  const out = { id: o.id, logo: o.logo || '', symbol: o.symbol || '', symbolKnockout: !!o.symbol_knockout, cafe: json(o.cafe, {}) };
  for (const k of ORG_FIELDS) out[k] = o[k] || '';
  out.naver = secret.naver?.access ? { connected: true, name: secret.naver.name || '', expires: secret.naver.expires } : { connected: false };
  return out;
}

const orgs = {
  byId: (id) => db.get('SELECT * FROM hkpromo_orgs WHERE id = ?', [id]),
  list: () => db.all('SELECT * FROM hkpromo_orgs ORDER BY school, name'),
  async create(fields) {
    const f = { ...fields };
    const r = await db.run(`INSERT INTO hkpromo_orgs (${ORG_FIELDS.join(', ')}, symbol_knockout, cafe, secret, created_at) VALUES (${ORG_FIELDS.map(() => '?').join(', ')}, 1, '{}', '{}', ?)`,
      [...ORG_FIELDS.map((k) => String(f[k] || '').slice(0, 500)), now()]);
    return orgs.byId(r.id);
  },
  async update(id, fields) {
    const sets = [], vals = [];
    for (const k of ORG_FIELDS) if (fields[k] != null) { sets.push(`${k} = ?`); vals.push(String(fields[k]).slice(0, 500)); }
    for (const k of ['logo', 'symbol']) if (fields[k] != null) { sets.push(`${k} = ?`); vals.push(fields[k]); }
    if (fields.symbolKnockout != null) { sets.push('symbol_knockout = ?'); vals.push(fields.symbolKnockout ? 1 : 0); }
    if (fields.cafe != null) { sets.push('cafe = ?'); vals.push(JSON.stringify(fields.cafe)); }
    if (sets.length) await db.run(`UPDATE hkpromo_orgs SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  },
  async getSecret(id) { return json((await orgs.byId(id))?.secret, {}); },
  async setSecret(id, secret) { await db.run('UPDATE hkpromo_orgs SET secret = ? WHERE id = ?', [JSON.stringify(secret), id]); },
  async remove(id) {
    await db.run('DELETE FROM hkpromo_members WHERE org_id = ?', [id]);
    await db.run('DELETE FROM hkpromo_projects WHERE org_id = ?', [id]);
    await db.run('UPDATE hkpromo_sessions SET org_id = NULL WHERE org_id = ?', [id]);
    await db.run('DELETE FROM hkpromo_orgs WHERE id = ?', [id]);
  },
};

// ---------- 멤버 ----------
const members = {
  ofUser: (userId) => db.all('SELECT m.role, o.* FROM hkpromo_members m JOIN hkpromo_orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.school, o.name', [userId]),
  ofOrg: (orgId) => db.all('SELECT m.role, u.id, u.email, u.name, u.status FROM hkpromo_members m JOIN hkpromo_users u ON u.id = m.user_id WHERE m.org_id = ? ORDER BY u.name', [orgId]),
  all: () => db.all('SELECT user_id, org_id, role FROM hkpromo_members'),
  async role(userId, orgId) { return (await db.get('SELECT role FROM hkpromo_members WHERE user_id = ? AND org_id = ?', [userId, orgId]))?.role || null; },
  async set(userId, orgId, role) {
    if (!ROLES.includes(role)) throw new Error('알 수 없는 역할입니다');
    const r = await db.run('UPDATE hkpromo_members SET role = ? WHERE user_id = ? AND org_id = ?', [role, userId, orgId]);
    if (!r.changes) await db.run('INSERT INTO hkpromo_members (user_id, org_id, role) VALUES (?, ?, ?)', [userId, orgId, role]);
  },
  remove: (userId, orgId) => db.run('DELETE FROM hkpromo_members WHERE user_id = ? AND org_id = ?', [userId, orgId]),
};

// ---------- 작업 파일 (자유 편집·엠블럼·배너) ----------
const projects = {
  async get(orgId, name) { const r = await db.get('SELECT doc FROM hkpromo_projects WHERE org_id = ? AND name = ?', [orgId, name]); return r ? r.doc : null; },
  async put(orgId, name, doc, userId) {
    const r = await db.run('UPDATE hkpromo_projects SET doc = ?, updated_at = ?, updated_by = ? WHERE org_id = ? AND name = ?', [doc, now(), userId, orgId, name]);
    if (!r.changes) await db.run('INSERT INTO hkpromo_projects (org_id, name, doc, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)', [orgId, name, doc, now(), userId]);
  },
};

// ---------- 세션 ----------
const SESSION_MS = 30 * 24 * 3600 * 1000;
const sessions = {
  async create(userId, orgId) {
    const id = crypto.randomBytes(32).toString('hex');
    await db.run('INSERT INTO hkpromo_sessions (id, user_id, org_id, expires) VALUES (?, ?, ?, ?)', [id, userId, orgId || null, now() + SESSION_MS]);
    return id;
  },
  async get(id) {
    if (!id || !/^[0-9a-f]{64}$/.test(id)) return null;
    const s = await db.get('SELECT * FROM hkpromo_sessions WHERE id = ?', [id]);
    if (!s || s.expires < now()) return null;
    return s;
  },
  setOrg: (id, orgId) => db.run('UPDATE hkpromo_sessions SET org_id = ? WHERE id = ?', [orgId, id]),
  remove: (id) => db.run('DELETE FROM hkpromo_sessions WHERE id = ?', [id]),
  purge: () => db.run('DELETE FROM hkpromo_sessions WHERE expires < ?', [now()]),
};

// ---------- 시스템 설정 (네이버 앱, OpenAI 키 등) ----------
const settings = {
  async get(k, fb = '') { const r = await db.get('SELECT v FROM hkpromo_settings WHERE k = ?', [k]); return r ? r.v : fb; },
  async set(k, v) {
    const r = await db.run('UPDATE hkpromo_settings SET v = ? WHERE k = ?', [v, k]);
    if (!r.changes) await db.run('INSERT INTO hkpromo_settings (k, v) VALUES (?, ?)', [k, v]);
  },
};

async function init() {
  db = await open();
  await sessions.purge();
  // 학과가 하나도 없으면 기본 학과를 만든다
  if (!(await db.get('SELECT id FROM hkpromo_orgs LIMIT 1'))) await orgs.create(DEFAULT_ORG);
  return db;
}

module.exports = { init, users, orgs, members, projects, sessions, settings, publicUser, publicOrg, ROLES, roleAtLeast, checkPw, get kind() { return db?.kind; } };
