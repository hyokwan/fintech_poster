// AI 카페 글 초안: 올린 홍보 이미지를 보고 제목·본문을 써 준다
// AI 엔진은 최고 관리자가 등록한다. OpenAI 호환 API(/v1/chat/completions)면 무엇이든 됨:
//   OpenAI, Ollama(http://localhost:11434/v1), vLLM(http://localhost:8888/v1) 등
// 글쓰기 엔진 하나 + (선택) 이미지 글자 읽기(OCR) 엔진 하나를 골라 쓴다.
//   OCR 엔진을 고르면: 이미지마다 글자를 먼저 읽고 → 그 글자를 글쓰기 엔진에 넘겨서 정확도를 높인다.
const crypto = require('crypto');
const express = require('express');
const { needRole, needAdmin } = require('../auth');
const { settings } = require('../store');

const r = express.Router();
const TIMEOUT = 180_000;

// ---------- 엔진 목록 (시스템 설정에 JSON 으로 저장) ----------
// { id, name, baseUrl, apiKey, model, vision, json }
async function engines() {
  let list = [];
  try { list = JSON.parse(await settings.get('ai_engines', '[]')); } catch (e) { list = []; }
  // 예전 버전의 OpenAI 키 설정을 엔진 하나로 옮김
  const oldKey = await settings.get('openai_key');
  if (!list.length && oldKey) {
    list = [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: oldKey, model: await settings.get('openai_model', 'gpt-4.1-mini'), vision: true, json: true }];
    await saveEngines(list);
    await settings.set('openai_key', '');
  }
  return list;
}
const saveEngines = (list) => settings.set('ai_engines', JSON.stringify(list));
async function defaults(list) {
  const ids = new Set(list.map((e) => e.id));
  const writer = await settings.get('ai_writer');
  const ocr = await settings.get('ai_ocr');
  return { writer: ids.has(writer) ? writer : list[0]?.id || '', ocr: ids.has(ocr) ? ocr : '' };
}

const mask = (s) => (s ? s.slice(0, 4) + '••••' + s.slice(-4) : '');
const cleanUrl = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');

// ---------- OpenAI 호환 호출 ----------
async function chat(engine, messages, { json = false, maxTokens = 2000 } = {}) {
  const body = { model: engine.model, messages, max_tokens: maxTokens };
  if (json && engine.json !== false) body.response_format = { type: 'json_object' };
  const send = async (b) => {
    const resp = await fetch(engine.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(engine.apiKey ? { Authorization: `Bearer ${engine.apiKey}` } : {}) },
      body: JSON.stringify(b),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const j = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, j };
  };
  let out = await send(body);
  // JSON 모드를 모르는 서버면 빼고 한 번 더
  if (!out.ok && body.response_format && out.status === 400) { delete body.response_format; out = await send(body); }
  // 최신 OpenAI 모델은 max_tokens 대신 max_completion_tokens
  if (!out.ok && /max_tokens/.test(JSON.stringify(out.j))) { delete body.max_tokens; body.max_completion_tokens = maxTokens; out = await send(body); }
  if (!out.ok) {
    const msg = out.j.error?.message || out.j.error || out.j.message || `HTTP ${out.status}`;
    throw new Error(`${engine.name}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return String(out.j.choices?.[0]?.message?.content || '').trim();
}

const imagePart = (url) => ({ type: 'image_url', image_url: { url } });

// 동시에 n 개씩만 돌림 (로컬 GPU 서버에 한꺼번에 몰리지 않게). 결과는 원래 순서대로
async function mapLimit(list, n, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => {
    while (i < list.length) { const k = i++; out[k] = await fn(list[k]); }
  }));
  return out;
}

// ---------- 글쓰기 지시문 ----------
const TONES = {
  notice: '공식 공지처럼 정중하고 깔끔하게',
  friendly: '친근하고 따뜻한 말투로, 이모지를 적당히 섞어서',
  promo: '읽는 사람이 지원하고 싶어지도록 힘 있고 설득력 있게, 이모지를 적당히 섞어서',
};

function systemPrompt(org, tone) {
  return [
    '너는 대학 학과의 홍보 담당자다. 네이버 카페에 올릴 게시글의 제목과 본문을 한국어로 쓴다.',
    `학과 정보: ${org.school} ${org.campus || ''} ${org.name}`.replace(/\s+/g, ' '),
    org.website ? `홈페이지/원서접수: ${org.website}` : '',
    org.youtube ? `유튜브 채널: "${org.youtube}"` : '',
    org.hashtags ? `기본 해시태그: ${org.hashtags}` : '',
    '',
    '규칙:',
    '- 이미지(또는 이미지에서 읽은 글자)에 적힌 날짜, 기간, 숫자, 인원, 연락처, 주소를 그대로 옮긴다. 이미지와 메모에 없는 사실은 지어내지 않는다.',
    '- 읽기 어려운 글자가 있으면 추측하지 말고 그 항목은 빼고 쓴다.',
    '- "이미지에서 읽은 글자(OCR)"가 있으면 날짜·숫자·연락처는 그 글자를 우선한다. 학교·학과 이름의 오타는 위 학과 정보로 바로잡는다.',
    `- 말투: ${TONES[tone] || TONES.notice}.`,
    '- 제목은 40자 이내로, 핵심(무엇을, 언제까지)을 담는다.',
    '- 본문은 짧은 문단과 목록(✅, 📅, 👉 같은 기호)으로 보기 좋게 정리한다. 마크다운(**, #, -)과 HTML 태그는 쓰지 않고 줄바꿈만 쓴다.',
    '- 본문 끝에는 문의/접수 안내와 해시태그 한 줄을 넣는다.',
    '- 반드시 JSON 으로만 답한다: {"title": "...", "body": "..."}',
  ].filter(Boolean).join('\n');
}

const OCR_PROMPT = '이미지에 적힌 글자를 빠짐없이 그대로 적어 줘. 설명은 붙이지 말고 글자만, 줄 단위로.';

// 모델 답에서 {title, body} 꺼내기 (```json 감싸기, 앞뒤 설명이 붙어도)
function parseDraft(text) {
  const t = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) {
    try { const j = JSON.parse(t.slice(s, e + 1)); if (j.title || j.body) return { title: String(j.title || ''), body: String(j.body || '') }; } catch (err) { /* 아래로 */ }
  }
  // JSON 이 아니면 첫 줄 = 제목, 나머지 = 본문
  const lines = t.split('\n');
  return { title: lines[0].replace(/^(제목\s*[:：]\s*)/, ''), body: lines.slice(1).join('\n').replace(/^(본문\s*[:：]\s*)/, '').trim() };
}

// 카페 글에 안 맞는 마크다운 정리
function tidy(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- 편집자용 ----------
r.get('/api/ai/engines', needRole('editor'), async (req, res) => {
  const list = await engines();
  res.json({ engines: list.map((e) => ({ id: e.id, name: e.name, vision: e.vision !== false })), ...(await defaults(list)) });
});

r.post('/api/ai/draft', needRole('editor'), async (req, res) => {
  const { images = [], memo = '', tone = 'notice' } = req.body || {};
  const list = await engines();
  if (!list.length) return res.status(400).json({ error: '최고 관리자가 아직 AI 엔진을 등록하지 않았습니다 (관리자 › AI 엔진)' });
  const def = await defaults(list);
  const writer = list.find((e) => e.id === (req.body.writer || def.writer));
  const ocr = req.body.ocr === undefined ? list.find((e) => e.id === def.ocr) : list.find((e) => e.id === req.body.ocr);
  if (!writer) return res.status(400).json({ error: '글쓰기 AI를 골라 주세요' });
  const imgs = images.filter((d) => /^data:image\/(png|jpeg|webp|gif);base64,/.test(d)).slice(0, 6);
  if (!imgs.length && !String(memo).trim()) return res.status(400).json({ error: '이미지를 올리거나 메모를 적어 주세요' });

  try {
    // 1) (선택) 이미지마다 글자 읽기
    // 화면에서 긴 이미지를 띠로 잘라 보내면(ocrImages: 이미지마다 조각 목록) 조각별로 읽고 이어 붙임
    let ocrText = '';
    if (ocr && imgs.length) {
      const sets = Array.isArray(req.body.ocrImages) && req.body.ocrImages.length
        ? req.body.ocrImages.slice(0, 6).map((tiles) => (Array.isArray(tiles) ? tiles : []).filter((d) => /^data:image\/(png|jpeg);base64,/.test(d)).slice(0, 8))
        : imgs.map((u) => [u]);
      const readOne = (url) => chat(ocr, [{ role: 'user', content: [{ type: 'text', text: OCR_PROMPT }, imagePart(url)] }], { maxTokens: 1500 });
      const texts = [];
      for (const tiles of sets) texts.push((await mapLimit(tiles, 4, readOne)).join('\n'));
      ocrText = texts.map((t, i) => `[이미지 ${i + 1}]\n${t}`).join('\n\n');
    }
    // 2) 글쓰기 (이미지를 볼 수 있는 엔진이면 이미지도 같이)
    const sendImages = writer.vision !== false && imgs.length;
    if (!sendImages && imgs.length && !ocrText) return res.status(400).json({ error: `${writer.name}은(는) 이미지를 못 읽어요. 이미지 글자 읽기(OCR) 엔진을 같이 골라 주세요.` });
    const userText = [
      memo.trim() ? `추가 메모(반드시 반영): ${memo.trim()}` : '',
      ocrText ? `이미지에서 읽은 글자(OCR):\n${ocrText}` : '',
      imgs.length ? `홍보 이미지 ${imgs.length}장을 바탕으로 카페 글을 써 줘.` : '메모를 바탕으로 카페 글을 써 줘.',
    ].filter(Boolean).join('\n\n');
    const content = [{ type: 'text', text: userText }, ...(sendImages ? imgs.map(imagePart) : [])];
    const raw = await chat(writer, [{ role: 'system', content: systemPrompt(req.org, tone) }, { role: 'user', content }], { json: true, maxTokens: 2500 });
    const out = parseDraft(raw);
    if (!out.title && !out.body) return res.status(502).json({ error: 'AI 답변을 읽지 못했습니다. 다시 시도해 주세요.' });
    res.json({ title: tidy(out.title).replace(/\n/g, ' ').slice(0, 100), body: tidy(out.body), engine: writer.name + (ocr && imgs.length ? ` + ${ocr.name}(OCR)` : ''), ocrText });
  } catch (e) {
    const msg = e.name === 'TimeoutError' ? 'AI 응답이 너무 오래 걸립니다 (3분 초과)' : e.message;
    res.status(502).json({ error: 'AI 오류: ' + msg });
  }
});

// ---------- 최고 관리자: 엔진 등록 ----------
r.get('/api/admin/ai', needAdmin, async (req, res) => {
  const list = await engines();
  res.json({ engines: list.map((e) => ({ ...e, apiKey: mask(e.apiKey) })), ...(await defaults(list)) });
});

// engines 전체를 받아 저장. apiKey 가 가려진 값(••••)이면 예전 값 유지
r.post('/api/admin/ai', needAdmin, async (req, res) => {
  const old = await engines();
  const list = (Array.isArray(req.body?.engines) ? req.body.engines : []).slice(0, 20).map((e) => {
    const id = /^[\w-]{1,40}$/.test(e.id || '') ? e.id : crypto.randomBytes(4).toString('hex');
    const prev = old.find((o) => o.id === id);
    const apiKey = String(e.apiKey || '').includes('••••') ? prev?.apiKey || '' : String(e.apiKey || '').trim();
    return { id, name: String(e.name || '').trim().slice(0, 50) || 'AI', baseUrl: cleanUrl(e.baseUrl), apiKey, model: String(e.model || '').trim(), vision: e.vision !== false, json: e.json !== false };
  });
  const bad = list.find((e) => !/^https?:\/\//.test(e.baseUrl) || !e.model);
  if (bad) return res.status(400).json({ error: `"${bad.name}": 주소(http://…)와 모델을 입력해 주세요` });
  await saveEngines(list);
  const ids = new Set(list.map((e) => e.id));
  await settings.set('ai_writer', ids.has(req.body.writer) ? req.body.writer : list[0]?.id || '');
  await settings.set('ai_ocr', ids.has(req.body.ocr) ? req.body.ocr : '');
  res.json({ ok: true });
});

// 주소로 모델 목록 불러오기 (연결 확인 겸)
r.post('/api/admin/ai/models', needAdmin, async (req, res) => {
  const { baseUrl, apiKey, id } = req.body || {};
  let key = String(apiKey || '');
  if (key.includes('••••')) key = (await engines()).find((e) => e.id === id)?.apiKey || '';
  try {
    const resp = await fetch(cleanUrl(baseUrl) + '/models', { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(10_000) });
    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(502).json({ error: j.error?.message || `HTTP ${resp.status}` });
    res.json({ models: (j.data || j.models || []).map((m) => m.id || m.name).filter(Boolean) });
  } catch (e) {
    res.status(502).json({ error: '연결 실패: ' + (e.cause?.code || e.message) });
  }
});

// 엔진 하나 시험 (짧은 질문)
r.post('/api/admin/ai/test', needAdmin, async (req, res) => {
  const e = (await engines()).find((x) => x.id === req.body?.id);
  if (!e) return res.status(404).json({ error: '먼저 저장해 주세요' });
  const t = Date.now();
  try {
    const out = await chat(e, [{ role: 'user', content: '한 문장으로 자기소개를 해 줘.' }], { maxTokens: 300 });
    res.json({ ok: true, ms: Date.now() - t, reply: out.slice(0, 200) });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

module.exports = r;
