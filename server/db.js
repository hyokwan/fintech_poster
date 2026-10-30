// DB 연결: .env 에 DB_HOST 가 있으면 MariaDB/MySQL, 없으면 data/studio.db (SQLite)
// 두 DB 모두에서 돌아가도록 ? 자리표시자와 단순한 SQL 만 쓴다.
// 같은 DB 를 쓰는 다른 프로젝트와 겹치지 않게 테이블 이름은 모두 hkpromo_ 로 시작한다.
const path = require('path');
const { DB, DATA_DIR } = require('./config');

const SCHEMA = (my) => {
  const id = my ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const big = my ? 'LONGTEXT' : 'TEXT';
  const tail = my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
  return [
    `CREATE TABLE IF NOT EXISTS hkpromo_users (
      id ${id}, email VARCHAR(190) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL, pw VARCHAR(255) NOT NULL,
      is_admin INT NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'pending', note VARCHAR(500), created_at BIGINT NOT NULL)${tail}`,
    `CREATE TABLE IF NOT EXISTS hkpromo_orgs (
      id ${id}, school VARCHAR(100) NOT NULL, campus VARCHAR(100), name VARCHAR(100) NOT NULL, name_en VARCHAR(150),
      youtube VARCHAR(150), website VARCHAR(200), slogan VARCHAR(300), hashtags VARCHAR(500),
      logo VARCHAR(300), symbol VARCHAR(300), symbol_knockout INT NOT NULL DEFAULT 1,
      cafe TEXT, secret TEXT, created_at BIGINT NOT NULL)${tail}`,
    `CREATE TABLE IF NOT EXISTS hkpromo_members (
      user_id INT NOT NULL, org_id INT NOT NULL, role VARCHAR(20) NOT NULL, PRIMARY KEY (user_id, org_id))${tail}`,
    `CREATE TABLE IF NOT EXISTS hkpromo_projects (
      org_id INT NOT NULL, name VARCHAR(100) NOT NULL, doc ${big} NOT NULL, updated_at BIGINT NOT NULL, updated_by INT,
      PRIMARY KEY (org_id, name))${tail}`,
    `CREATE TABLE IF NOT EXISTS hkpromo_sessions (
      id VARCHAR(64) NOT NULL PRIMARY KEY, user_id INT NOT NULL, org_id INT, expires BIGINT NOT NULL)${tail}`,
    `CREATE TABLE IF NOT EXISTS hkpromo_settings (k VARCHAR(100) NOT NULL PRIMARY KEY, v TEXT)${tail}`,
  ];
};

async function openMysql() {
  const mysql = require('mysql2/promise');
  // FOUND_ROWS: UPDATE 결과가 '바뀐 행'이 아니라 '찾은 행' 수가 되게 (값이 같아도 1) → 없을 때만 INSERT 하는 방식이 맞게 동작
  const pool = mysql.createPool({ ...DB, charset: 'utf8mb4', connectionLimit: 10, waitForConnections: true, flags: ['+FOUND_ROWS'] });
  const db = {
    kind: 'mysql',
    async all(sql, p = []) { const [rows] = await pool.query(sql, p); return rows; },
    async get(sql, p = []) { return (await db.all(sql, p))[0]; },
    async run(sql, p = []) { const [r] = await pool.query(sql, p); return { id: r.insertId, changes: r.affectedRows }; },
  };
  for (const s of SCHEMA(true)) await pool.query(s);
  return db;
}

function openSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const file = new DatabaseSync(path.join(DATA_DIR, 'studio.db'));
  file.exec('PRAGMA journal_mode = WAL');
  for (const s of SCHEMA(false)) file.exec(s);
  // SQLite 는 동기식이지만 MySQL 쪽과 같은 모양(Promise)으로 맞춘다
  const plain = (row) => (row ? { ...row } : row);
  return {
    kind: 'sqlite',
    async all(sql, p = []) { return file.prepare(sql).all(...p).map(plain); },
    async get(sql, p = []) { return plain(file.prepare(sql).get(...p)); },
    async run(sql, p = []) { const r = file.prepare(sql).run(...p); return { id: Number(r.lastInsertRowid), changes: Number(r.changes) }; },
  };
}

let db = null;
async function open() {
  if (!db) db = DB ? await openMysql() : openSqlite();
  return db;
}

module.exports = { open, get db() { return db; } };
