// 경로와 환경 설정
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch (e) { /* .env 없으면 기본값 */ }

const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

module.exports = {
  ROOT,
  DATA_DIR,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  IMAGES_DIR: path.join(ROOT, 'public', 'images'),
  PORT: +process.env.PORT || 3001,
  HOST: process.env.HOST || '127.0.0.1',
  PUBLIC_URL: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  COOKIE_SECURE: process.env.COOKIE_SECURE === '1',
  DB: process.env.DB_HOST ? {
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'creator_studio',
  } : null,
  KINDS: ['thumbnail', 'poster', 'social', 'emblem', 'banner'],
  // 학과 정보 기본값 (첫 학과를 만들 때 씀)
  DEFAULT_ORG: {
    school: '한국폴리텍대학',
    campus: '서울강서캠퍼스',
    name: 'AI핀테크융합과',
    name_en: 'AI FINTECH CONVERGENCE',
    youtube: 'AI핀테크융합과',
    website: 'www.hkcode.co.kr',
    slogan: '인공지능 · 블록체인 · 인프라 · 웹개발 실무 교육',
    hashtags: '#한국폴리텍대학 #AI핀테크융합과 #교육생모집',
  },
  // 학과별 파일 폴더 (업로드, 결과물, 로고 등)
  orgDir: (orgId, ...sub) => path.join(DATA_DIR, 'orgs', String(orgId), ...sub),
};
