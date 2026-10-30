// 모든 화면이 함께 쓰는 것: 앱 화면 틀(사이드바·상단바), 학과 정보, 저장, API 호출, 알림
// 페이지에서 /api/me.js 를 먼저 불러야 window.ME(로그인 정보), window.DEPT(현재 학과)가 있다.

// 이 도구가 처음 만들어진 학과. 템플릿 기본 문구에 이 값들이 들어 있고, 다른 학과에서는 그 학과 값으로 바꿔 보여준다.
const BASE_DEPT = {
  school: '한국폴리텍대학', campus: '서울강서캠퍼스', name: 'AI핀테크융합과', name_en: 'AI FINTECH CONVERGENCE',
  youtube: 'AI핀테크융합과', website: 'www.hkcode.co.kr',
};

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  thumbnail: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  poster: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  editor: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  emblem: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  social: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  banner: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 11h8M6 14h5"/>',
  cafe: '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5v2.5M12 2.5v2.5"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  admin: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ''}</svg>`;

// 사이드바 메뉴: [주소, 아이콘, 이름, 필요한 역할]
const NAV = [
  ['/', 'home', '홈', 'viewer'],
  null,
  ['/thumbnail.html', 'thumbnail', '썸네일', 'viewer'],
  ['/poster.html', 'poster', '포스터', 'viewer'],
  ['/editor.html', 'editor', '자유 편집', 'viewer'],
  ['/banner.html', 'banner', '배너', 'viewer'],
  ['/social.html', 'social', 'SNS', 'viewer'],
  ['/emblem.html', 'emblem', '엠블럼', 'viewer'],
  null,
  ['/cafe.html', 'cafe', '카페 글쓰기', 'editor'],
];
const PAGE_TITLES = {
  '/': '홈', '/thumbnail.html': '유튜브 썸네일', '/poster.html': '학과 포스터 (빠른 편집)', '/editor.html': '자유 편집',
  '/banner.html': '배너 만들기', '/social.html': '인스타 · 페이스북', '/emblem.html': '엠블럼', '/cafe.html': '네이버 카페 글쓰기',
  '/settings.html': '학과 설정', '/admin.html': '관리자', '/pending.html': '승인 대기',
};
const ROLE_NAMES = { manager: '학과 관리자', editor: '편집자', viewer: '보기·저장' };
const ROLE_ORDER = ['viewer', 'editor', 'manager'];

const Studio = {
  icon,
  ROLE_NAMES,
  get me() { return window.ME || null; },
  get dept() { return window.DEPT || BASE_DEPT; },

  // 지금 학과에서 이 역할 이상인지
  can(role) {
    const me = Studio.me;
    return !!me && !!me.role && ROLE_ORDER.indexOf(me.role) >= ROLE_ORDER.indexOf(role);
  },

  isBaseDept() {
    const d = Studio.dept;
    return d.school === BASE_DEPT.school && d.name === BASE_DEPT.name;
  },

  // 템플릿 기본 문구 속 원래 학과 정보를 지금 학과 정보로 바꿈 (기본 학과면 그대로)
  fillDept(s) {
    if (typeof s !== 'string' || Studio.isBaseDept()) return s;
    const d = Studio.dept, B = BASE_DEPT;
    const tag = (x) => '#' + String(x || '').replace(/\s+/g, '');
    const pairs = [
      [`“${B.youtube}”`, `“${d.youtube || d.name}”`], [`"${B.youtube}"`, `"${d.youtube || d.name}"`],
      [tag(B.name), tag(d.name)], [tag(B.school), tag(d.school)],
      [`${B.school} ${B.campus}`, `${d.school} ${d.campus || ''}`.trim()],
      [B.name_en, d.name_en || ''], [B.website, d.website || ''],
      [B.name, d.name], [B.school, d.school], [B.campus, d.campus || ''],
    ];
    for (const [a, b] of pairs) s = s.split(a).join(b);
    return s;
  },

  // 브라우저 저장 키를 학과별로 나눔
  storeKey(k) { return Studio.isBaseDept() ? k : `${k}@org${Studio.dept.id || 0}`; },

  // ---------- 화면 틀 ----------
  shell() {
    const me = Studio.me;
    if (!me) { location.href = '/login.html?next=' + encodeURIComponent(location.pathname); return; }
    document.body.classList.add('shell');
    const here = location.pathname;
    const link = ([href, ic, label]) => `<a href="${href}" class="${href === here ? 'on' : ''}" title="${label}">${icon(ic)}<span>${label}</span></a>`;
    const items = NAV.map((n) => (n === null ? '<i class="rail-sep"></i>' : Studio.can(n[3]) ? link(n) : '')).join('');
    const bottom = [Studio.can('manager') ? link(['/settings.html', 'settings', '학과 설정']) : '', me.isAdmin ? link(['/admin.html', 'admin', '관리자']) : ''].join('');
    const rail = document.createElement('aside');
    rail.className = 'rail';
    rail.innerHTML = `<a class="brand" href="/" title="Creator Studio"><b>C</b></a><nav class="rail-nav">${items}</nav><div class="rail-bottom">${bottom}</div>`;
    document.body.prepend(rail);

    const header = document.querySelector('body > header') || document.body.insertBefore(document.createElement('header'), rail.nextSibling);
    const sizeText = header.querySelector('#sizeInfo, .size-info')?.textContent || '';
    const d = window.DEPT;
    const orgOpts = me.orgs.map((o) => `<option value="${o.id}" ${o.id === me.orgId ? 'selected' : ''}>${Studio.esc(o.school)} · ${Studio.esc(o.name)}</option>`).join('');
    header.className = 'topbar';
    header.innerHTML = `
      <div class="tb-title"><h1>${PAGE_TITLES[here] || document.title}</h1><span class="size-info" id="sizeInfo">${Studio.esc(sizeText)}</span></div>
      <div class="tb-right">
        <button class="help-btn" id="helpBtn" title="이 메뉴 사용법">❓ 사용법</button>
        ${me.orgs.length > 1 ? `<select class="org-pick" id="orgPick" title="학과 바꾸기">${orgOpts}</select>` : d ? `<span class="org-name">${Studio.esc(d.school)} · <b>${Studio.esc(d.name)}</b></span>` : ''}
        ${me.role ? `<span class="role-chip role-${me.role}">${ROLE_NAMES[me.role]}</span>` : ''}
        <div class="user-menu">
          <button class="avatar" id="userBtn" title="${Studio.esc(me.email)}">${Studio.esc((me.name || '?').slice(0, 1))}</button>
          <div class="menu" id="userMenu">
            <div class="menu-head"><b>${Studio.esc(me.name)}</b><small>${Studio.esc(me.email)}</small></div>
            <button id="pwBtn">${icon('key')}비밀번호 바꾸기</button>
            <button id="logoutBtn">${icon('logout')}로그아웃</button>
          </div>
        </div>
      </div>`;
    const pick = header.querySelector('#orgPick');
    if (pick) pick.onchange = async () => { await Studio.api('/api/me/org', { orgId: +pick.value }); location.reload(); };
    const menu = header.querySelector('#userMenu');
    header.querySelector('#userBtn').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    header.querySelector('#logoutBtn').onclick = async () => { await Studio.api('/api/auth/logout', {}); location.href = '/login.html'; };
    header.querySelector('#pwBtn').onclick = Studio.changePassword;

    // 메뉴별 사용법 팝업 (help.js 를 따로 불러옴)
    const help = document.createElement('script');
    help.src = '/js/help.js';
    help.onload = () => { header.querySelector('#helpBtn').onclick = () => Help.open(); Help.firstVisit(); };
    document.head.append(help);
  },

  async changePassword() {
    const current = prompt('지금 비밀번호');
    if (!current) return;
    const password = prompt('새 비밀번호 (8자 이상)');
    if (!password) return;
    try { await Studio.api('/api/auth/password', { current, password }); Studio.toast('비밀번호를 바꿨습니다', 'ok'); }
    catch (e) { Studio.toast(e.message, 'err'); }
  },

  // ---------- 공통 도우미 ----------
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); },

  // JSON API 호출. body 가 있으면 POST. 실패하면 서버 메시지로 에러를 던짐
  async api(url, body, method) {
    const opt = body === undefined ? { method: method || 'GET' } : { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(url, opt);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !document.body.dataset.noShell) { location.href = '/login.html?next=' + encodeURIComponent(location.pathname); throw new Error(j.error || '로그인이 필요합니다'); }
    if (!r.ok) throw new Error(j.error || `요청 실패 (${r.status})`);
    return j;
  },

  toast(msg, type = '') {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    box.append(t);
    setTimeout(() => t.classList.add('out'), type === 'err' ? 6000 : 3200);
    setTimeout(() => t.remove(), type === 'err' ? 6500 : 3700);
  },

  // 용량 제한(bytes)을 넘으면 JPG 품질을 낮춰가며 맞춤. limit 없으면 PNG 그대로.
  canvasToDataUrl(canvas, limit) {
    let dataUrl = canvas.toDataURL('image/png');
    if (!limit || Studio.bytes(dataUrl) <= limit) return dataUrl;
    for (const q of [0.95, 0.9, 0.85, 0.8, 0.7]) {
      dataUrl = canvas.toDataURL('image/jpeg', q);
      if (Studio.bytes(dataUrl) <= limit) break;
    }
    return dataUrl;
  },

  bytes(dataUrl) {
    return Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
  },

  // 브라우저 다운로드 + 서버(학과 결과물 보관함)에 동시 저장
  async save(dataUrl, name, kind, statusEl) {
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${name || kind}.${ext}`;
    a.click();
    const kb = Math.round(Studio.bytes(dataUrl) / 1024);
    const status = (msg, cls) => { if (statusEl) { statusEl.textContent = msg; statusEl.className = 'status ' + cls; } };
    try {
      await Studio.api('/api/save', { dataUrl, name, kind });
      status(`✅ 저장 완료 (${ext.toUpperCase()} ${kb}KB) · 다운로드 폴더와 홈 > 최근 결과물에 저장됨`, 'ok');
    } catch (e) {
      status(`다운로드는 완료 (${kb}KB). 서버 저장 실패: ${e.message}`, 'err');
    }
  },

  loadImg(src) {
    return new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => fail(new Error('이미지를 읽을 수 없습니다'));
      im.src = src;
    });
  },

  // 학과 로고. 학과 설정에서 올린 로고 → 없으면 (기본 학과만) 원본 전단지에서 잘라냄
  async posterLogo() {
    if (Studio.dept.logo) return Studio.dept.logo;
    if (!Studio.isBaseDept()) throw new Error('학과 설정에서 로고를 올려 주세요');
    const img = await Studio.loadImg('/api/base-poster');
    const s = img.naturalWidth / 2480; // 원본 2480×3508 기준 좌표
    const [x, y, w, h] = [128, 88, 576, 152].map((v) => Math.round(v * s));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/png');
  },

  // 학과 심볼 마크 (투명 배경 PNG dataURL)
  // 학과 설정에서 올린 심볼 → 흰 배경 지우기를 켜 두었으면 지워서 씀. 없으면 기본 학과 엠블럼 원본 왼쪽에서 잘라냄
  emblemSymbol() {
    if (Studio._symbol) return Studio._symbol;
    Studio._symbol = (async () => {
      const d = Studio.dept;
      if (d.symbol) {
        if (!d.symbolKnockout) return d.symbol;
        const img = await Studio.loadImg(d.symbol);
        return Studio.knockoutWhite(img, img.naturalWidth);
      }
      if (!Studio.isBaseDept()) throw new Error('학과 설정에서 심볼 마크를 올려 주세요');
      const img = await Studio.loadImg('/images/emblem/' + encodeURIComponent('AI핀테크융합과.jpeg'));
      // 원본 3024×1296 기준으로 왼쪽 1160px 안에 심볼이 있고, 그 오른쪽은 글씨
      return Studio.knockoutWhite(img, Math.round(img.naturalWidth * 1160 / 3024));
    })();
    return Studio._symbol;
  },

  // 흰 배경을 투명하게 바꾸고 내용 부분만 잘라냄 (왼쪽 cut 픽셀 안쪽만 봄)
  knockoutWhite(img, cut) {
    const H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = cut; c.height = H;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, cut, H);
    const d = data.data;
    let minX = cut, minY = H, maxX = 0, maxY = 0;
    for (let i = 0; i < d.length; i += 4) {
      // 흰 배경일수록 투명하게. 진한 부분은 원래 색 그대로 불투명, 가장자리만 흰색을 걷어냄
      const ap = (1 - Math.min(d[i], d[i + 1], d[i + 2]) / 255) * (d[i + 3] / 255);
      const a = Math.min(1, Math.max(0, (ap - 0.04) * 2.4));
      if (a <= 0.02) { d[i + 3] = 0; continue; }
      if (ap < 0.45) for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (d[i + k] - 255 * (1 - ap)) / ap));
      d[i + 3] = a * 255;
      if (a > 0.3) {
        const p = i / 4, X = p % cut, Y = (p / cut) | 0;
        if (X < minX) minX = X; if (X > maxX) maxX = X;
        if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
      }
    }
    if (maxX < minX) return c.toDataURL('image/png');
    x.putImageData(data, 0, 0);
    const pad = 4;
    const out = document.createElement('canvas');
    out.width = maxX - minX + pad * 2; out.height = maxY - minY + pad * 2;
    out.getContext('2d').drawImage(c, minX - pad, minY - pad, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  },

  loadImageFile(file) {
    return new Promise((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = fail;
      r.readAsDataURL(file);
    });
  },

  // 큰 사진을 max 픽셀 이하로 줄여 dataURL 로 (PNG 는 PNG, 나머지는 JPG)
  async shrinkImage(src, max = 2400, quality = 0.9) {
    const img = await Studio.loadImg(src);
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const isPng = /^data:image\/png/.test(src);
    if (s === 1 && /^data:image\/(png|jpeg)/.test(src)) return src;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const x = c.getContext('2d');
    if (!isPng) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    x.drawImage(img, 0, 0, c.width, c.height);
    return isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality);
  },
};

// 로그인 화면이 아니면 화면 틀을 그림
if (!document.body.dataset.noShell) Studio.shell();
