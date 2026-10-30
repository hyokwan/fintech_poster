// 네이버 카페 글쓰기: 이미지 → (AI 초안) → 다듬기 → 게시
const $ = (id) => document.getElementById(id);
const DRAFT_KEY = Studio.storeKey('cafe-draft-v1');
const MAX_IMAGES = 10;
const KIND_NAMES = { thumbnail: '썸네일', poster: '포스터', social: 'SNS', emblem: '엠블럼', banner: '배너' };

const dept = window.DEPT || {};
const cafe = dept.cafe || {};
const state = { images: [], tone: 'notice' }; // images: [{ src: dataURL }]

// ---------- 이미지 ----------
async function addSrc(src) {
  if (state.images.length >= MAX_IMAGES) { Studio.toast(`이미지는 ${MAX_IMAGES}장까지 올릴 수 있어요`, 'err'); return; }
  // 카페 업로드용으로 너무 큰 사진은 2400px 로 줄임
  state.images.push({ src: await Studio.shrinkImage(src, 2400, 0.92) });
  renderImages();
}
async function addFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    try { await addSrc(await Studio.loadImageFile(f)); } catch (e) { Studio.toast(`${f.name}: ${e.message}`, 'err'); }
  }
}

function renderImages() {
  const box = $('thumbs');
  box.innerHTML = '';
  state.images.forEach((im, i) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    d.innerHTML = `<img src="${im.src}" alt=""><span class="no">${i + 1}</span><button class="x" title="빼기">×</button>
      <div class="mv"><button title="앞으로" ${i === 0 ? 'disabled' : ''}>◀</button><button title="뒤로" ${i === state.images.length - 1 ? 'disabled' : ''}>▶</button></div>`;
    d.querySelector('.x').onclick = () => { state.images.splice(i, 1); renderImages(); };
    const [l, r] = d.querySelectorAll('.mv button');
    l.onclick = () => { [state.images[i - 1], state.images[i]] = [state.images[i], state.images[i - 1]]; renderImages(); };
    r.onclick = () => { [state.images[i + 1], state.images[i]] = [state.images[i], state.images[i + 1]]; renderImages(); };
    box.append(d);
  });
  $('imgCount').textContent = state.images.length ? `${state.images.length}장` : '';
  renderPreview();
}

const drop = $('drop');
drop.onclick = () => { $('file').value = ''; $('file').click(); };
$('file').onchange = (e) => addFiles(e.target.files);
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
document.addEventListener('paste', (e) => {
  const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); addFiles(files); }
});

// 내가 만든 결과물에서 고르기
const dlg = $('recentDlg');
$('pickRecent').onclick = async () => {
  const grid = $('recentGrid');
  grid.innerHTML = '<p class="muted">불러오는 중…</p>';
  dlg.showModal();
  try {
    const list = await Studio.api('/api/outputs?limit=60');
    grid.innerHTML = list.length ? '' : '<p class="empty" style="grid-column:1/-1">아직 저장한 결과물이 없어요. 포스터·배너·SNS에서 저장하면 여기에 나옵니다.</p>';
    for (const it of list) {
      const f = document.createElement('figure');
      f.dataset.url = it.url;
      f.innerHTML = `<img src="${it.url}" loading="lazy" alt=""><figcaption>${KIND_NAMES[it.kind] || it.kind} · ${Studio.esc(decodeURIComponent(it.name))}</figcaption>`;
      f.onclick = () => f.classList.toggle('on');
      grid.append(f);
    }
  } catch (e) { grid.innerHTML = `<p class="status err">${Studio.esc(e.message)}</p>`; }
};
$('dlgClose').onclick = () => dlg.close();
$('dlgAdd').onclick = async () => {
  const picked = [...$('recentGrid').querySelectorAll('figure.on')].map((f) => f.dataset.url);
  dlg.close();
  for (const url of picked) {
    try {
      const blob = await (await fetch(url)).blob();
      await addSrc(await Studio.loadImageFile(blob));
    } catch (e) { Studio.toast('이미지를 불러오지 못했어요: ' + e.message, 'err'); }
  }
};

// ---------- AI 초안 ----------
// 관리자가 등록한 AI 엔진 목록. 글 쓰는 AI + (선택) 이미지 글자 읽기(OCR) AI
async function loadEngines() {
  try {
    const j = await Studio.api('/api/ai/engines');
    const opt = (e, sel) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${Studio.esc(e.name)}${e.vision ? '' : ' (이미지 못 읽음)'}</option>`;
    const d = draft();
    const writer = j.engines.some((e) => e.id === d.writer) ? d.writer : j.writer;
    const ocr = d.ocr !== undefined && (d.ocr === '' || j.engines.some((e) => e.id === d.ocr)) ? d.ocr : j.ocr;
    $('writer').innerHTML = j.engines.length ? j.engines.map((e) => opt(e, writer)).join('') : '<option value="">등록된 AI가 없어요 (관리자 › AI 엔진)</option>';
    $('ocr').innerHTML = `<option value="">쓰지 않음 (글 쓰는 AI가 직접 봄)</option>${j.engines.map((e) => opt(e, ocr)).join('')}`;
  } catch (e) { $('writer').innerHTML = `<option value="">${Studio.esc(e.message)}</option>`; }
}
for (const id of ['writer', 'ocr']) $(id).addEventListener('change', () => saveDraft());

function setTone(v) {
  state.tone = v;
  $('tones').querySelectorAll('button').forEach((b) => b.classList.toggle('primary', b.dataset.v === v));
  saveDraft();
}
$('tones').querySelectorAll('button').forEach((b) => { b.onclick = () => setTone(b.dataset.v); });

$('aiBtn').onclick = async () => {
  const btn = $('aiBtn'), st = $('aiStatus');
  if (!state.images.length && !$('memo').value.trim()) { st.textContent = '이미지를 올리거나 메모를 적어 주세요.'; st.className = 'status err'; return; }
  if (($('title').value || $('body').value.trim()) && !confirm('지금 쓴 제목·본문을 AI 초안으로 바꿀까요?')) return;
  btn.disabled = true; btn.textContent = '✨ 이미지 읽고 쓰는 중… (10초~1분)';
  st.textContent = ''; st.className = 'status';
  try {
    // AI 에는 1280px 로 줄여서 보냄 (글자는 읽히고 전송은 빠르게)
    const picked = state.images.slice(0, 6);
    const images = await Promise.all(picked.map((im) => Studio.shrinkImage(im.src, 1280, 0.85)));
    // OCR 은 글자가 커야 잘 읽으므로 긴 이미지(포스터 등)를 가로 띠로 잘라서 보냄
    const ocrImages = $('ocr').value ? await Promise.all(picked.map((im) => ocrTiles(im.src))) : undefined;
    const j = await Studio.api('/api/ai/draft', { images, ocrImages, memo: $('memo').value, tone: state.tone, writer: $('writer').value, ocr: $('ocr').value });
    $('title').value = j.title;
    $('body').value = j.body;
    $('aiModel').textContent = j.engine;
    $('ocrBox').hidden = !j.ocrText;
    $('ocrText').textContent = j.ocrText || '';
    st.textContent = '✅ 초안을 만들었어요. 날짜·숫자가 맞는지 꼭 확인하세요.'; st.className = 'status ok';
    renderPreview(); saveDraft();
  } catch (e) {
    st.textContent = e.message; st.className = 'status err';
  } finally {
    btn.disabled = false; btn.textContent = '✨ 이미지 보고 글 쓰기';
  }
};

// 이미지를 폭 1280px, 높이 폭×0.6 의 가로 띠로 자름 (위아래로 12% 겹치게 해서 줄이 잘리지 않게)
async function ocrTiles(src) {
  const img = await Studio.loadImg(src);
  const W = img.naturalWidth, H = img.naturalHeight;
  const stripH = Math.round(W * 0.6), step = Math.round(stripH * 0.88);
  const scale = Math.min(1, 1280 / W);
  const tiles = [];
  for (let y = 0; y < H && tiles.length < 8; y += step) {
    const h = Math.min(stripH, H - y);
    const c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(h * scale);
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, y, W, h, 0, 0, c.width, c.height);
    tiles.push(c.toDataURL('image/jpeg', 0.9));
    if (y + h >= H) break;
  }
  return tiles;
}

// ---------- 본문 → 카페 HTML ----------
function bodyHtml(text) {
  return Studio.esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>')
    .replace(/(^|[\s(])(www\.[^\s<]+)/g, '$1<a href="http://$2" target="_blank">$2</a>')
    .replace(/\n/g, '<br>');
}

function renderPreview() {
  const title = $('title').value.trim(), body = $('body').value;
  const board = $('board').selectedOptions[0]?.textContent || '게시판';
  $('preview').innerHTML = `
    <div class="board">${Studio.esc(board)} ›</div>
    <h4>${title ? Studio.esc(title) : '<span class="empty-p">제목</span>'}</h4>
    <div class="meta">${Studio.esc(window.ME?.name || '')} · ${new Date().toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</div>
    <div class="imgs">${state.images.map((im) => `<img src="${im.src}" alt="">`).join('')}</div>
    <div class="txt">${body.trim() ? bodyHtml(body) : '<span class="empty-p">본문</span>'}</div>`;
  $('count').textContent = `${body.length.toLocaleString()}자`;
}

// ---------- 연결 상태 / 게시판 ----------
function renderConn() {
  const conn = $('conn'), mgr = Studio.can('manager');
  const settingsLink = mgr ? ' <a href="/settings.html#cafe">학과 설정에서 연결</a>' : ' 학과 관리자에게 연결을 부탁하세요.';
  if (!cafe.clubId) conn.innerHTML = `<span class="dot"></span><span>카페가 아직 등록되지 않았어요.${settingsLink}</span>`;
  else if (!dept.naver?.connected) conn.innerHTML = `<span class="dot"></span><span>네이버 계정이 연결되지 않았어요.${settingsLink}</span>`;
  else conn.innerHTML = `<span class="dot on"></span><span>${cafe.url ? Studio.esc(cafe.url.replace(/^https?:\/\//, '')) : '카페 ' + cafe.clubId} · <b>${Studio.esc(dept.naver.name || '네이버 계정')}</b>(으)로 올립니다</span>`;

  const sel = $('board');
  const boards = cafe.boards || [];
  sel.innerHTML = boards.length ? boards.map((b) => `<option value="${b.menuId}">${Studio.esc(b.name)}</option>`).join('') : '<option value="">게시판이 없어요 (학과 설정에서 추가)</option>';
  sel.onchange = () => { renderPreview(); saveDraft(); };
}

// ---------- 게시 ----------
$('postBtn').onclick = async () => {
  const st = $('postStatus'), btn = $('postBtn');
  const title = $('title').value.trim(), body = $('body').value.trim(), menuId = $('board').value;
  const fail = (m) => { st.textContent = m; st.className = 'status err'; };
  if (!cafe.clubId || !dept.naver?.connected) return fail('먼저 학과 설정에서 카페와 네이버 계정을 연결해 주세요.');
  if (!menuId) return fail('게시판을 골라 주세요.');
  if (!title) return fail('제목을 입력해 주세요.');
  if (!body) return fail('본문을 입력해 주세요.');
  const board = $('board').selectedOptions[0].textContent;
  if (!confirm(`"${board}" 게시판에 이 글을 올릴까요?\n\n${title}\n(이미지 ${state.images.length}장)`)) return;

  btn.disabled = true; btn.textContent = '올리는 중…';
  st.textContent = ''; $('result').style.display = 'none';
  try {
    const j = await Studio.api('/api/cafe/post', {
      menuId, subject: title, content: bodyHtml(body), images: state.images.map((im) => im.src),
      openyn: $('openyn').checked, searchopen: $('searchopen').checked, replyyn: $('replyyn').checked,
    });
    $('result').innerHTML = `✅ 카페에 올렸어요! <a href="${Studio.esc(j.url)}" target="_blank" rel="noopener">${Studio.esc(j.url)}</a>
      <div class="inline" style="margin-top:10px"><button class="btn sm" id="newPost">새 글 쓰기</button></div>`;
    $('result').style.display = 'block';
    $('newPost').onclick = () => {
      state.images = []; $('title').value = ''; $('body').value = ''; $('memo').value = '';
      $('result').style.display = 'none'; renderImages(); saveDraft();
    };
    Studio.toast('카페에 올렸어요', 'ok');
  } catch (e) {
    fail(e.message);
  } finally {
    btn.disabled = false; btn.textContent = '📮 카페에 올리기';
  }
};

// ---------- 임시 저장 (이 브라우저, 글만) ----------
function draft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch (e) { return {}; }
}
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: $('title').value, body: $('body').value, memo: $('memo').value, tone: state.tone, menuId: $('board').value,
      // 엔진 목록을 불러오기 전에는 예전에 고른 값을 그대로 둠
      ...($('writer').options.length ? { writer: $('writer').value, ocr: $('ocr').value } : { writer: draft().writer, ocr: draft().ocr }),
      openyn: $('openyn').checked, searchopen: $('searchopen').checked, replyyn: $('replyyn').checked,
    }));
  } catch (e) { /* 저장 공간이 막혀 있어도 글쓰기는 됨 */ }
}
function loadDraft() {
  const d = draft();
  $('title').value = d.title || '';
  $('body').value = d.body || '';
  $('memo').value = d.memo || '';
  if (d.menuId && [...$('board').options].some((o) => o.value === d.menuId)) $('board').value = d.menuId;
  for (const k of ['openyn', 'searchopen', 'replyyn']) if (d[k] != null) $(k).checked = d[k];
  setTone(d.tone || 'notice');
}
for (const id of ['title', 'body', 'memo']) $(id).addEventListener('input', () => { renderPreview(); saveDraft(); });
for (const id of ['openyn', 'searchopen', 'replyyn']) $(id).addEventListener('change', saveDraft);

renderConn();
loadDraft();
renderImages();
loadEngines();
