// 자유 편집 엔진: 페이지 위 요소(텍스트/이미지/도형/블록)를 끌어서 옮기고, 크기를 바꾸고, 추가/삭제한다.
// 작업 내용은 doc(JSON) 하나에 담기고, 화면은 doc 을 그대로 그린 결과다.
// 탭마다 다른 부분(규격, 기본 배치, 도구, 저장 옵션)은 editor-poster.js / editor-emblem.js 에서 Editor.start(설정)으로 넘긴다.
const $ = (id) => document.getElementById(id);

// ---------- 요소 만들기 도우미 (탭 설정 파일에서도 씀) ----------
const T = (x, y, w, html, st) => ({ type: 'text', x, y, w, html, fs: 24, fw: 600, color: '#ffffff', align: 'left', lh: 1.3, ls: -0.02, ...st });
const SH = (shape, x, y, w, h, st) => ({ type: 'shape', shape, x, y, w, h, fill: '', stroke: '', sw: 0, radius: 0, ...st });
const BL = (block, x, y, w, h, html, st) => ({ type: 'block', block, x, y, w, h, html, ...st });
const IM = (src, x, y, w, h, st) => ({ type: 'image', src, x, y, w, h, radius: 0, fit: 'contain', ...st });

const Editor = (() => {
  let CFG = null;
  let PAGE = { w: 1000, h: 1000 };
  let fmt = null;        // 지금 규격 키
  let doc = null;
  let sel = [];          // 선택한 요소 id 목록
  let editing = null;    // 글씨 편집 중인 요소 id
  let hoverId = null;
  let drag = null;       // 이동/크기조절/범위선택 중인 상태
  let guides = [];       // 정렬 가이드 선 [{x}|{y}]
  let marquee = null;
  let scale = 1, zoom = null; // zoom=null 이면 화면에 맞춤
  const nodes = new Map();
  const autoSrc = {};    // 'logo:auto' 같은 자동 이미지 → 실제 주소

  // 템플릿 문구 속 학과 정보를 지금 학과 것으로
  const fillDept = (e) => { if (e.html) e.html = Studio.fillDept(e.html); return e; };
  // 보기·저장 권한: 화면에서 고쳐볼 수는 있지만 작업 파일은 저장하지 않음 (이미지 저장은 됨)
  const readOnly = !Studio.can('editor');
  const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const byId = (id) => doc.els.find((e) => e.id === id);
  const selected = () => sel.map(byId).filter(Boolean);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- 화면 뼈대 ----------
  function mount() {
    const ed = document.createElement('div');
    ed.className = 'ed';
    ed.innerHTML = `
  <div class="pane left">
    <div class="tabs" id="tabs">
      <button data-t="add" class="on">요소</button><button data-t="img">이미지</button><button data-t="layer">레이어</button>
    </div>
    <div class="tab on" data-t="add">
      <div id="toolGroups"></div>
      <p class="muted" style="margin-top:12px">클릭하면 화면 가운데에, 끌어다 놓으면 놓은 자리에 들어갑니다.</p>
    </div>
    <div class="tab" data-t="img">
      <button class="btn primary upl" id="uploadBtn">⬆ 이미지 올리기</button>
      <input type="file" id="uploadFile" accept="image/*" multiple hidden>
      <p class="muted">이미지 파일을 페이지 위로 바로 끌어다 놓거나, 복사한 이미지를 Ctrl+V로 붙여넣어도 됩니다.</p>
      <h3>학과 로고 · 엠블럼</h3><div class="lib" id="libEmblems"></div>
      <h3>올린 이미지</h3><div class="lib" id="libUploads"></div>
    </div>
    <div class="tab" data-t="layer">
      <p class="muted" style="margin-top:0">위에 있을수록 앞에 보입니다. 👁 숨기기 · 🔒 잠금</p>
      <div class="layers" id="layers"></div>
    </div>
  </div>
  <div class="center">
    <div class="bar">
      <button id="undo" title="되돌리기 (Ctrl+Z)">↶</button><button id="redo" title="다시 실행 (Ctrl+Shift+Z)">↷</button>
      <span class="sep"></span>
      <button id="zoomOut" title="축소">−</button><span id="zoomLabel">100%</span><button id="zoomIn" title="확대">+</button><button id="zoomFit" title="화면에 맞추기">맞춤</button>
      <span class="sep" id="fmtSep"></span><div class="fmt" id="formats"></div>
      <span class="sp"></span><span id="saveState"></span>
    </div>
    <div class="viewport" id="viewport">
      <div class="sizer" id="sizer"><div class="scaler" id="scaler"><div class="cv" id="cv"></div><div class="overlay" id="overlay"></div></div></div>
    </div>
  </div>
  <div class="pane right props">
    <div id="props"></div>
    <div class="g save-g">
      <h3>이미지로 저장</h3>
      <div class="seg" id="quality"></div>
      <label>파일 이름</label><input type="text" id="fileName">
      <div class="btns" style="margin-top:10px"><button class="btn primary" id="save"></button></div>
      <div class="status" id="status"></div>
    </div>
  </div>
  <input type="file" id="replaceFile" accept="image/*" hidden>`;
    document.querySelector('header').after(ed);
  }
  mount();
  const vp = $('viewport'), sizer = $('sizer'), scaler = $('scaler'), cv = $('cv'), ov = $('overlay');

  // ---------- 그리기 ----------
  const resolveSrc = (src) => (CFG && CFG.autoImages[src] ? autoSrc[src] || '' : src);

  function applyTheme() {
    for (const t of [cv, document.documentElement]) {
      t.style.setProperty('--c1', doc.page.accent);
      t.style.setProperty('--p-bg', doc.page.bg);
    }
    // 테마 색 견본(var(--c2) 등)이 오른쪽 패널에서도 보이도록 문서에도 지정
    for (const [k, v] of Object.entries(CFG.themeVars || {})) document.documentElement.style.setProperty(k, v);
    sizer.classList.toggle('checker', doc.page.bg === 'transparent');
    sizer.classList.toggle('round', !!doc.page.round);
  }

  function setHTML(n, e) {
    if (editing === e.id) return; // 편집 중에는 덮어쓰지 않음
    if (n._html !== e.html) { n.innerHTML = e.html; n._html = e.html; }
  }

  function paint(n, e) {
    const s = n.style;
    const cls = { text: 't', image: 'im', shape: 'sh', block: `blk b-${e.block}${CFG.cardBlocks?.includes(e.block) ? ' card' : ''}` }[e.type];
    n.className = 'el ' + cls;
    s.left = e.x + 'px'; s.top = e.y + 'px';
    s.opacity = e.opacity ?? 1;
    s.display = e.hidden ? 'none' : '';
    if (e.type === 'text') {
      s.width = e.autoW ? 'max-content' : e.w + 'px';
      s.height = '';
      s.whiteSpace = e.autoW ? 'nowrap' : '';
      Object.assign(s, {
        fontSize: e.fs + 'px', fontWeight: e.fw, color: e.color, textAlign: e.align, lineHeight: e.lh, letterSpacing: e.ls + 'em',
        background: e.bg || '', padding: e.pad ? `${e.pad[0]}px ${e.pad[1]}px` : '', borderRadius: e.radius ? e.radius + 'px' : '',
      });
      setHTML(n, e);
    } else {
      s.width = e.w + 'px'; s.height = e.h + 'px';
    }
    if (e.type === 'image') {
      let img = n.firstChild;
      if (!img) { img = document.createElement('img'); img.draggable = false; n.appendChild(img); }
      const src = resolveSrc(e.src);
      if (img.getAttribute('src') !== src) src ? img.setAttribute('src', src) : img.removeAttribute('src');
      img.style.objectFit = e.fit || 'cover';
      s.borderRadius = (e.radius || 0) + 'px';
    }
    if (e.type === 'shape') {
      s.background = e.fill || 'transparent';
      s.border = e.sw ? `${e.sw}px solid ${e.stroke || '#ffffff'}` : 'none';
      s.borderRadius = e.shape === 'ellipse' ? '50%' : (e.radius || 0) + 'px';
    }
    if (e.type === 'block') {
      if (e.tone) n.dataset.tone = e.tone; else delete n.dataset.tone;
      setHTML(n, e);
    }
  }

  // 글씨 상자는 높이가 내용에 따라 정해지므로, 그린 뒤 실제 크기를 재서 기록한다
  function measure() {
    for (const e of doc.els) {
      if (e.type !== 'text' || e.hidden) continue;
      const n = nodes.get(e.id);
      e.h = n.offsetHeight;
      if (e.autoW) e.w = n.offsetWidth;
    }
  }

  // 직접 입력 규격은 페이지 크기가 doc 에 들어 있으므로 (되돌리기 포함) 늘 doc 을 따른다
  function syncPageSize() {
    if (doc.page.w === PAGE.w && doc.page.h === PAGE.h) return;
    PAGE = { w: doc.page.w, h: doc.page.h };
    $('sizeInfo').textContent = sizeText();
    layout();
    buildQuality();
  }
  function sizeText() {
    const f = CFG.formats[fmt];
    return f.custom ? `${f.label} · ${PAGE.w} × ${PAGE.h}` : f.info || `${f.w} × ${f.h}`;
  }

  function render() {
    if (!doc) return;
    syncPageSize();
    applyTheme();
    const ids = new Set(doc.els.map((e) => e.id));
    for (const [id, n] of nodes) if (!ids.has(id)) { n.remove(); nodes.delete(id); }
    doc.els.forEach((e, i) => {
      let n = nodes.get(e.id);
      if (!n || n._type !== e.type) {
        n?.remove();
        n = document.createElement('div');
        n.dataset.id = e.id;
        n._type = e.type;
        nodes.set(e.id, n);
      }
      if (cv.children[i] !== n) cv.insertBefore(n, cv.children[i] || null);
      paint(n, e);
    });
    measure();
    drawOverlay();
    renderLayers();
  }

  // ---------- 선택 표시 ----------
  function box(cls, x, y, w, h) {
    const d = document.createElement('div');
    d.className = cls;
    Object.assign(d.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    ov.appendChild(d);
    return d;
  }

  function drawOverlay() {
    if (!doc) return;
    ov.innerHTML = '';
    ov.style.setProperty('--k', 1 / scale);
    // 안전 영역 안내선 (예: 유튜브 배너에서 모든 기기에 보이는 부분). 저장 이미지에는 안 들어감
    for (const z of CFG.formats[fmt].zones || []) {
      const d = box('zone' + (z.main ? ' main' : ''), z.x, z.y, z.w, z.h);
      d.dataset.label = z.label;
    }
    const hv = hoverId && !sel.includes(hoverId) && byId(hoverId);
    if (hv && !hv.hidden && !drag) box('box hov', hv.x, hv.y, hv.w, hv.h);
    for (const e of selected()) {
      if (e.hidden) continue;
      box('box' + (e.lock ? ' locked' : '') + (editing === e.id ? ' editing' : ''), e.x, e.y, e.w, e.h);
    }
    const one = sel.length === 1 && byId(sel[0]);
    if (one && !one.lock && !one.hidden && editing !== one.id) {
      const hs = one.type === 'text' ? ['nw', 'ne', 'se', 'sw', 'e', 'w'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
      for (const h of hs) {
        const d = document.createElement('div');
        d.className = 'hdl';
        d.dataset.h = h;
        d.style.left = one.x + (h.includes('w') ? 0 : h.includes('e') ? one.w : one.w / 2) + 'px';
        d.style.top = one.y + (h.includes('n') ? 0 : h.includes('s') ? one.h : one.h / 2) + 'px';
        ov.appendChild(d);
      }
      if (drag && drag.mode === 'resize') {
        const t = box('tag', one.x + one.w / 2, one.y + one.h + 8 / scale, 0, 0);
        t.style.width = t.style.height = '';
        t.textContent = one.type === 'text' ? `${Math.round(one.w)} · 글씨 ${Math.round(one.fs)}px` : `${Math.round(one.w)} × ${Math.round(one.h)}`;
      }
    }
    const k = 1 / scale;
    for (const g of guides) {
      if (g.x != null) box('guide', g.x - 0.5 * k, 0, k, PAGE.h);
      else box('guide', 0, g.y - 0.5 * k, PAGE.w, k);
    }
    if (marquee) box('marquee', marquee.x, marquee.y, marquee.w, marquee.h);
  }

  // ---------- 확대/축소 ----------
  function fitScale() {
    return Math.max(0.05, Math.min((vp.clientWidth - 48) / PAGE.w, (vp.clientHeight - 48) / PAGE.h));
  }
  function layout() {
    scale = zoom ?? fitScale();
    scaler.style.width = PAGE.w + 'px';
    scaler.style.height = PAGE.h + 'px';
    sizer.style.width = PAGE.w * scale + 'px';
    sizer.style.height = PAGE.h * scale + 'px';
    scaler.style.transform = `scale(${scale})`;
    $('zoomLabel').textContent = Math.round(scale * 100) + '%';
    drawOverlay();
  }
  function setZoom(z) { zoom = z == null ? null : Math.min(4, Math.max(0.05, z)); layout(); }
  new ResizeObserver(layout).observe(vp);
  $('zoomIn').onclick = () => setZoom(scale * 1.2);
  $('zoomOut').onclick = () => setZoom(scale / 1.2);
  $('zoomFit').onclick = () => setZoom(null);
  vp.addEventListener('wheel', (ev) => {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    setZoom(scale * (ev.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });

  function toCanvas(ev) {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale };
  }
  // 지금 화면에 보이는 영역의 가운데 (클릭으로 추가할 때 위치)
  function viewCenter() {
    const v = vp.getBoundingClientRect();
    const p = toCanvas({ clientX: v.left + v.width / 2, clientY: v.top + v.height / 2 });
    const m = Math.min(100, PAGE.w / 4, PAGE.h / 4);
    return { x: Math.min(PAGE.w - m, Math.max(m, p.x)), y: Math.min(PAGE.h - m, Math.max(m, p.y)) };
  }

  // ---------- 되돌리기 / 자동 저장 ----------
  const hist = { stack: [], i: -1 };
  let saveTimer = null;
  function commit() {
    const s = JSON.stringify(doc);
    if (hist.stack[hist.i] === s) return;
    hist.stack = hist.stack.slice(0, hist.i + 1);
    hist.stack.push(s);
    if (hist.stack.length > 100) hist.stack.shift();
    hist.i = hist.stack.length - 1;
    updateUndo();
    scheduleSave();
  }
  function restore(i) {
    if (i < 0 || i >= hist.stack.length) return;
    endEdit(false);
    hist.i = i;
    doc = JSON.parse(hist.stack[i]);
    sel = sel.filter(byId);
    render(); buildProps(); updateUndo(); scheduleSave();
  }
  function updateUndo() {
    $('undo').disabled = hist.i <= 0;
    $('redo').disabled = hist.i >= hist.stack.length - 1;
  }
  $('undo').onclick = () => restore(hist.i - 1);
  $('redo').onclick = () => restore(hist.i + 1);

  const projectName = () => CFG.formats[fmt].project || `${CFG.project}-${fmt}`;
  function scheduleSave() {
    if (readOnly) { $('saveState').textContent = '보기 전용 · 바뀐 내용은 저장되지 않아요 (이미지 저장은 가능)'; return; }
    $('saveState').textContent = '저장 중…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
  }
  async function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      const r = await fetch(`/api/project?name=${encodeURIComponent(projectName())}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
      if (!r.ok) throw new Error((await r.json()).error);
      $('saveState').textContent = '✓ 작업 내용 저장됨';
    } catch (e) {
      $('saveState').textContent = '⚠ 작업 저장 실패: ' + e.message;
    }
  }

  // ---------- 정렬 가이드 (자석처럼 붙기) ----------
  function snapTargets(ignore) {
    const xs = [0, PAGE.w / 2, PAGE.w], ys = [0, PAGE.h / 2, PAGE.h];
    for (const e of doc.els) {
      if (ignore.has(e.id) || e.hidden) continue;
      xs.push(e.x, e.x + e.w / 2, e.x + e.w);
      ys.push(e.y, e.y + e.h / 2, e.y + e.h);
    }
    return { xs, ys };
  }
  // vals 중 하나가 cands 중 하나와 가까우면 그만큼 옮길 거리(d)와 가이드 위치(at)를 돌려줌
  function nearest(vals, cands) {
    const T = 6 / scale;
    let best = null;
    for (const v of vals) for (const c of cands) {
      const d = c - v;
      if (Math.abs(d) <= T && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c };
    }
    return best;
  }

  function bbox(els) {
    const x = Math.min(...els.map((e) => e.x)), y = Math.min(...els.map((e) => e.y));
    const r = Math.max(...els.map((e) => e.x + e.w)), b = Math.max(...els.map((e) => e.y + e.h));
    return { x, y, w: r - x, h: b - y };
  }

  // ---------- 마우스: 선택 / 이동 / 크기 조절 / 범위 선택 ----------
  vp.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || !doc) return;
    const hdl = ev.target.closest('.hdl');
    const node = ev.target.closest('.cv .el');
    if (editing && node && node.dataset.id === editing) return; // 편집 중인 글씨 안에서 커서 이동
    if (document.activeElement && document.activeElement.matches('input, textarea, select')) document.activeElement.blur();
    if (editing) endEdit();
    ev.preventDefault();
    const p = toCanvas(ev);

    if (hdl) {
      const e = byId(sel[0]);
      drag = { mode: 'resize', h: hdl.dataset.h, sx: p.x, sy: p.y, o: clone(e), moved: false };
    } else if (node) {
      const id = node.dataset.id;
      let collapse = null;
      if (ev.shiftKey) sel = sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id];
      else if (!sel.includes(id)) sel = [id];
      else if (sel.length > 1) collapse = id; // 여러 개 선택 중에 하나를 클릭만 하면 그것만 선택
      const movable = selected().filter((e) => !e.lock);
      drag = { mode: 'move', sx: p.x, sy: p.y, start: movable.map((e) => ({ id: e.id, x: e.x, y: e.y })), box: movable.length ? bbox(movable) : null, moved: false, collapse };
      buildProps();
    } else {
      if (!ev.shiftKey) sel = [];
      drag = { mode: 'marquee', sx: p.x, sy: p.y, base: [...sel], moved: false };
      buildProps();
    }
    vp.setPointerCapture(ev.pointerId);
    drawOverlay();
    renderLayers();
  });

  vp.addEventListener('pointermove', (ev) => {
    if (!doc) return;
    if (!drag) {
      const node = ev.target.closest('.cv .el');
      const id = node ? node.dataset.id : null;
      if (id !== hoverId) { hoverId = id; drawOverlay(); }
      return;
    }
    const p = toCanvas(ev);
    const dx = p.x - drag.sx, dy = p.y - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) * scale < 3) return;
    drag.moved = true;
    if (drag.mode === 'move') onMove(dx, dy, ev);
    else if (drag.mode === 'resize') onResize(dx, dy, ev);
    else onMarquee(p);
  });

  function onMove(dx, dy, ev) {
    if (!drag.box) return;
    guides = [];
    if (!ev.altKey) { // Alt 를 누르고 있으면 가이드에 붙지 않음
      const { xs, ys } = snapTargets(new Set(sel));
      const b = drag.box;
      const sx = nearest([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], xs);
      const sy = nearest([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], ys);
      if (sx) { dx += sx.d; guides.push({ x: sx.at }); }
      if (sy) { dy += sy.d; guides.push({ y: sy.at }); }
    }
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } // Shift: 가로/세로로만
    for (const s of drag.start) { const e = byId(s.id); e.x = Math.round((s.x + dx) * 2) / 2; e.y = Math.round((s.y + dy) * 2) / 2; }
    render();
    syncGeom();
  }

  function onResize(dx, dy, ev) {
    const o = drag.o, h = drag.h, e = byId(o.id);
    const corner = h.length === 2;
    guides = [];
    let x = o.x, y = o.y, w = o.w, hh = o.h;
    if (h.includes('e')) w = o.w + dx;
    if (h.includes('w')) w = o.w - dx;
    if (h.includes('s')) hh = o.h + dy;
    if (h.includes('n')) hh = o.h - dy;
    // 글씨 모서리 = 글씨 크기까지 비율대로, 이미지 모서리 = 비율 유지 (Shift 누르면 반대)
    const keepRatio = corner && (o.type === 'text' || (o.type === 'image') !== ev.shiftKey);
    if (keepRatio) {
      const f = Math.max(0.05, Math.max(w / o.w, hh / o.h));
      w = o.w * f; hh = o.h * f;
    } else if (!ev.altKey) {
      const { xs, ys } = snapTargets(new Set([o.id]));
      if (h.includes('e')) { const s = nearest([o.x + w], xs); if (s) { w += s.d; guides.push({ x: s.at }); } }
      if (h.includes('w')) { const s = nearest([o.x + o.w - w], xs); if (s) { w -= s.d; guides.push({ x: s.at }); } }
      if (h.includes('s')) { const s = nearest([o.y + hh], ys); if (s) { hh += s.d; guides.push({ y: s.at }); } }
      if (h.includes('n')) { const s = nearest([o.y + o.h - hh], ys); if (s) { hh -= s.d; guides.push({ y: s.at }); } }
    }
    w = Math.max(8, w); hh = Math.max(o.type === 'shape' ? 1 : 8, hh);
    if (h.includes('w')) x = o.x + o.w - w;
    if (h.includes('n')) y = o.y + o.h - hh;
    if (o.type === 'text') {
      if (corner) {
        const f = w / o.w;
        e.fs = Math.round(o.fs * f * 10) / 10;
        if (o.pad) e.pad = o.pad.map((v) => Math.round(v * f));
        if (o.radius) e.radius = Math.round(o.radius * f);
        if (h.includes('n')) y = o.y + o.h - o.h * f;
        if (h.includes('w')) x = o.x + o.w - w;
      } else {
        e.autoW = false;
      }
      e.x = x; e.y = y; e.w = w;
    } else {
      Object.assign(e, { x, y, w, h: hh });
    }
    render();
    syncGeom();
  }

  function onMarquee(p) {
    const x = Math.min(p.x, drag.sx), y = Math.min(p.y, drag.sy);
    marquee = { x, y, w: Math.abs(p.x - drag.sx), h: Math.abs(p.y - drag.sy) };
    const hit = doc.els.filter((e) => !e.hidden && !e.lock && e.x < x + marquee.w && e.x + e.w > x && e.y < y + marquee.h && e.y + e.h > y).map((e) => e.id);
    sel = [...new Set([...drag.base, ...hit])];
    drawOverlay();
  }

  vp.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag;
    drag = null; guides = []; marquee = null;
    if (d.moved && d.mode !== 'marquee') commit();
    if (!d.moved && d.collapse) sel = [d.collapse];
    buildProps();
    drawOverlay();
    renderLayers();
  });

  // 더블클릭: 글씨 편집 / 이미지 바꾸기
  vp.addEventListener('dblclick', (ev) => {
    // 드래그용 pointer capture 때문에 ev.target 이 viewport 가 되므로 좌표로 다시 찾음
    const node = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.cv .el');
    if (!node) return;
    const e = byId(node.dataset.id);
    if (e.lock) return;
    if (e.type === 'image') return pickReplace(e.id);
    if (e.type === 'text' || e.type === 'block') startEdit(e.id, ev);
  });

  // ---------- 글씨 편집 ----------
  function startEdit(id, ev) {
    const e = byId(id), n = nodes.get(id);
    if (!e || !n || (e.type !== 'text' && e.type !== 'block')) return;
    editing = id;
    sel = [id];
    const hosts = e.type === 'text' ? [n] : [...n.querySelectorAll('[data-edit]')];
    if (!hosts.length) { editing = null; return; }
    hosts.forEach((h) => { h.contentEditable = 'true'; h.spellcheck = false; });
    // 더블클릭한 위치에 커서를 놓고, 없으면 전체 선택
    const range = ev && document.caretRangeFromPoint ? document.caretRangeFromPoint(ev.clientX, ev.clientY) : null;
    const host = (range && hosts.find((h) => h.contains(range.startContainer))) || hosts[0];
    host.focus();
    const s = getSelection();
    s.removeAllRanges();
    if (range && host.contains(range.startContainer)) {
      s.addRange(range);
    } else {
      const r = document.createRange();
      r.selectNodeContents(host);
      s.addRange(r);
    }
    buildProps();
    drawOverlay();
  }

  function cleanHTML(n) {
    const c = n.cloneNode(true);
    c.querySelectorAll('[contenteditable]').forEach((x) => { x.removeAttribute('contenteditable'); x.removeAttribute('spellcheck'); });
    return c.innerHTML;
  }

  function endEdit(save = true) {
    if (!editing) return;
    const id = editing, e = byId(id), n = nodes.get(id);
    editing = null;
    if (n) {
      n.removeAttribute('contenteditable');
      n.removeAttribute('spellcheck');
      n.querySelectorAll('[contenteditable]').forEach((x) => { x.removeAttribute('contenteditable'); x.removeAttribute('spellcheck'); });
      if (e && save) { e.html = n.innerHTML; n._html = e.html; }
    }
    getSelection().removeAllRanges();
    if (save) { render(); commit(); }
    buildProps();
  }

  cv.addEventListener('input', () => {
    if (!editing) return;
    const e = byId(editing), n = nodes.get(editing);
    e.html = cleanHTML(n);
    n._html = n.innerHTML;
    measure();
    drawOverlay();
  });

  cv.addEventListener('keydown', (ev) => {
    if (!editing) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); endEdit(); return; }
    // Enter = 줄바꿈 (목록 안에서는 새 항목)
    const at = getSelection().anchorNode;
    const inList = at && (at.nodeType === 1 ? at : at.parentElement).closest('ul');
    if (ev.key === 'Enter' && !ev.isComposing && !inList) {
      ev.preventDefault();
      document.execCommand('insertLineBreak');
    }
  });

  cv.addEventListener('paste', (ev) => {
    if (!editing) return;
    ev.preventDefault();
    ev.stopPropagation();
    document.execCommand('insertText', false, ev.clipboardData.getData('text/plain'));
  });

  // 편집 중 드래그로 고른 글자에만 색/굵기 적용
  function styleSelection(css) {
    const s = getSelection();
    if (!editing || !s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0);
    const span = document.createElement('span');
    span.style.cssText = css;
    span.appendChild(r.extractContents());
    r.insertNode(span);
    s.removeAllRanges();
    const nr = document.createRange();
    nr.selectNodeContents(span);
    s.addRange(nr);
    cv.dispatchEvent(new Event('input'));
  }

  // ---------- 추가 / 삭제 / 복제 / 순서 ----------
  function addEl(e, at) {
    e.id = uid();
    const p = at || viewCenter();
    const h = e.type === 'text' ? e.fs * e.lh + (e.pad ? e.pad[0] * 2 : 0) : e.h;
    e.x = Math.round(p.x - e.w / 2);
    e.y = Math.round(p.y - h / 2);
    doc.els.push(e);
    sel = [e.id];
    render(); buildProps(); commit();
    return e;
  }

  function removeSel() {
    const ids = new Set(selected().filter((e) => !e.lock).map((e) => e.id));
    if (!ids.size) return;
    doc.els = doc.els.filter((e) => !ids.has(e.id));
    sel = sel.filter((id) => !ids.has(id));
    render(); buildProps(); commit();
  }

  function pasteEls(list, offset = 24) {
    const ids = [];
    for (const src of list) {
      const e = clone(src);
      e.id = uid(); e.x += offset; e.y += offset; e.lock = false;
      doc.els.push(e);
      ids.push(e.id);
    }
    sel = ids;
    render(); buildProps(); commit();
  }

  function arrange(dir) {
    const ids = new Set(sel);
    const picked = doc.els.filter((e) => ids.has(e.id));
    const rest = doc.els.filter((e) => !ids.has(e.id));
    if (dir === 'front') doc.els = [...rest, ...picked];
    else if (dir === 'back') doc.els = [...picked, ...rest];
    else {
      const els = doc.els;
      const order = dir === 'up' ? [...els.keys()].reverse() : [...els.keys()];
      for (const i of order) {
        const j = dir === 'up' ? i + 1 : i - 1;
        if (ids.has(els[i].id) && els[j] && !ids.has(els[j].id)) [els[i], els[j]] = [els[j], els[i]];
      }
    }
    render(); commit();
  }

  // 페이지(여러 개면 선택 범위) 기준 정렬
  function align(how) {
    const els = selected().filter((e) => !e.lock);
    if (!els.length) return;
    const ref = els.length > 1 ? bbox(els) : { x: 0, y: 0, w: PAGE.w, h: PAGE.h };
    for (const e of els) {
      if (how === 'l') e.x = ref.x;
      if (how === 'c') e.x = ref.x + (ref.w - e.w) / 2;
      if (how === 'r') e.x = ref.x + ref.w - e.w;
      if (how === 't') e.y = ref.y;
      if (how === 'm') e.y = ref.y + (ref.h - e.h) / 2;
      if (how === 'b') e.y = ref.y + ref.h - e.h;
    }
    render(); syncGeom(); commit();
  }

  // ---------- 키보드 ----------
  const inField = (t) => t.matches('input, textarea, select') || t.isContentEditable;
  let nudgeTimer = null;
  document.addEventListener('keydown', (ev) => {
    if (!doc || editing || inField(ev.target)) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key.toLowerCase();
    if (mod && k === 'z') { ev.preventDefault(); restore(ev.shiftKey ? hist.i + 1 : hist.i - 1); return; }
    if (mod && k === 'y') { ev.preventDefault(); restore(hist.i + 1); return; }
    if (mod && k === 'd') { ev.preventDefault(); if (sel.length) pasteEls(selected()); return; }
    if (mod && k === 'a') { ev.preventDefault(); sel = doc.els.filter((e) => !e.hidden && !e.lock).map((e) => e.id); buildProps(); drawOverlay(); renderLayers(); return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeSel(); return; }
    if (ev.key === 'Escape') { sel = []; buildProps(); drawOverlay(); renderLayers(); return; }
    if (ev.key === 'Enter' && sel.length === 1) { ev.preventDefault(); startEdit(sel[0]); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[ev.key] && sel.length) {
      ev.preventDefault();
      const step = ev.shiftKey ? 10 : 1;
      for (const e of selected()) if (!e.lock) { e.x += arrows[ev.key][0] * step; e.y += arrows[ev.key][1] * step; }
      render(); syncGeom();
      clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(commit, 400);
    }
  });

  // 복사/붙여넣기: 우리 요소는 표시를 붙여 클립보드에 넣고, 이미지·글씨는 새 요소로 붙여넣는다
  const CLIP_MARK = '__creator_studio__';
  document.addEventListener('copy', (ev) => {
    if (!doc || editing || inField(ev.target) || !sel.length) return;
    ev.preventDefault();
    ev.clipboardData.setData('text/plain', CLIP_MARK + JSON.stringify(selected()));
  });
  document.addEventListener('cut', (ev) => {
    if (!doc || editing || inField(ev.target) || !sel.length) return;
    ev.preventDefault();
    ev.clipboardData.setData('text/plain', CLIP_MARK + JSON.stringify(selected()));
    removeSel();
  });
  document.addEventListener('paste', async (ev) => {
    if (!doc || editing || inField(ev.target)) return;
    const files = [...ev.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    ev.preventDefault();
    if (files.length) { for (const f of files) await addImageFile(f); return; }
    const text = ev.clipboardData.getData('text/plain');
    if (text.startsWith(CLIP_MARK)) {
      try { pasteEls(JSON.parse(text.slice(CLIP_MARK.length))); } catch (e) {}
    } else if (text.trim()) {
      const esc = text.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      addEl({ ...CFG.pasteText(), html: esc });
    }
  });

  // ---------- 이미지 ----------
  const status = (msg, cls = '') => { $('status').textContent = msg; $('status').className = 'status ' + cls; };
  const loadImg = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('이미지를 읽을 수 없습니다')); i.src = src; });

  // 너무 큰 사진은 2400px 로 줄여서 올림 (인쇄에도 충분한 크기)
  async function prepareImage(file) {
    const dataUrl = await Studio.loadImageFile(file);
    const img = await loadImg(dataUrl);
    const s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    if (s === 1 && file.size < 6 * 1024 * 1024 && /^data:image\/(png|jpeg|webp|gif)/.test(dataUrl)) return dataUrl;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
  }

  async function uploadFile(file) {
    status('이미지 올리는 중…');
    const dataUrl = await prepareImage(file);
    const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    status('');
    loadLibrary();
    return j.url;
  }

  async function addImage(src, at) {
    const img = await loadImg(resolveSrc(src));
    const ratio = img.naturalHeight / img.naturalWidth;
    const w = Math.min(PAGE.w * 0.4, img.naturalWidth);
    return addEl({ type: 'image', src, w, h: Math.round(w * ratio), radius: 0, fit: 'cover' }, at);
  }

  async function addImageFile(file, at) {
    try { await addImage(await uploadFile(file), at); } catch (e) { status('이미지 추가 실패: ' + e.message, 'err'); }
  }

  let replaceTarget = null;
  function pickReplace(id) { replaceTarget = id; $('replaceFile').value = ''; $('replaceFile').click(); }
  $('replaceFile').onchange = async (ev) => {
    const f = ev.target.files[0], e = byId(replaceTarget);
    if (!f || !e) return;
    try {
      e.src = await uploadFile(f);
      render(); commit();
    } catch (err) { status('이미지 바꾸기 실패: ' + err.message, 'err'); }
  };

  $('uploadBtn').onclick = () => { $('uploadFile').value = ''; $('uploadFile').click(); };
  $('uploadFile').onchange = async (ev) => { for (const f of ev.target.files) await addImageFile(f); };

  async function loadLibrary() {
    try {
      const j = await (await fetch('/api/images')).json();
      const fill = (box, list, empty) => {
        box.innerHTML = list.length ? '' : `<p class="muted" style="grid-column:1/-1">${empty}</p>`;
        for (const it of list) {
          const im = document.createElement('img');
          im.src = it.preview || it.url; im.title = decodeURIComponent(it.name); im.loading = 'lazy';
          im.onclick = () => addImage(it.url);
          im.draggable = true;
          im.ondragstart = (ev) => ev.dataTransfer.setData('application/x-img', it.url);
          box.appendChild(im);
        }
      };
      const autos = Object.entries(CFG.autoImages).filter(([k]) => autoSrc[k]).map(([k, a]) => ({ name: a.label, url: k, preview: autoSrc[k] }));
      fill($('libEmblems'), autos.concat(j.emblems), Studio.can('manager') ? '학과 설정에서 로고·엠블럼 이미지를 올려 주세요' : '학과 자료 이미지가 없습니다');
      fill($('libUploads'), j.uploads, '아직 올린 이미지가 없습니다');
    } catch (e) {}
  }

  // 끌어다 놓기: 도구, 라이브러리 이미지, 컴퓨터의 이미지 파일
  vp.addEventListener('dragover', (ev) => { ev.preventDefault(); vp.classList.add('drop'); });
  vp.addEventListener('dragleave', (ev) => { if (!vp.contains(ev.relatedTarget)) vp.classList.remove('drop'); });
  vp.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    vp.classList.remove('drop');
    if (!doc) return;
    const at = toCanvas(ev);
    const tool = ev.dataTransfer.getData('application/x-tool');
    const img = ev.dataTransfer.getData('application/x-img');
    if (tool && CFG.tools[tool]) return addTool(tool, at);
    if (img) return addImage(img, at);
    for (const f of ev.dataTransfer.files) if (f.type.startsWith('image/')) await addImageFile(f, at);
  });

  // ---------- 왼쪽 도구상자 ----------
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('#tabs button, .tab').forEach((x) => x.classList.toggle('on', x.dataset.t === b.dataset.t));
    };
  });

  // 도구의 make() 는 요소 하나를 돌려준다 (이미지처럼 크기를 재야 하면 Promise)
  async function addTool(key, at) {
    const e = await CFG.tools[key].make({ page: PAGE, resolveSrc, loadImg });
    if (e) addEl(fillDept(e), at);
  }

  function buildTools() {
    const root = $('toolGroups');
    root.innerHTML = '';
    for (const [g, title] of Object.entries(CFG.toolGroups)) {
      root.append(Object.assign(document.createElement('h3'), { textContent: title }));
      const tiles = document.createElement('div');
      tiles.className = 'tiles';
      for (const [key, t] of Object.entries(CFG.tools)) {
        if (t.group !== g) continue;
        const el = document.createElement('div');
        el.className = 'tile';
        el.innerHTML = `<span class="pv">${t.pv}</span><small>${t.label}</small>`;
        el.draggable = true;
        el.ondragstart = (ev) => ev.dataTransfer.setData('application/x-tool', key);
        el.onclick = () => addTool(key);
        tiles.appendChild(el);
      }
      root.append(tiles);
    }
  }

  function elName(e) {
    if (e.name) return e.name;
    if (e.type === 'text') return '“' + (e.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().slice(0, 22) || '빈 글씨') + '”';
    if (e.type === 'image') return '🖼 ' + (CFG.autoImages[e.src]?.label || '이미지');
    if (e.type === 'shape') return e.shape === 'ellipse' ? '● 원' : '■ 사각형';
    return '▦ ' + (CFG.blockNames?.[e.block] || '블록');
  }

  function renderLayers() {
    const box = $('layers');
    box.innerHTML = '';
    for (const e of [...doc.els].reverse()) {
      const row = document.createElement('div');
      row.className = 'layer' + (sel.includes(e.id) ? ' on' : '');
      row.innerHTML = `<span class="nm${e.hidden ? ' off' : ''}"></span><button title="숨기기">${e.hidden ? '◌' : '👁'}</button><button title="잠금">${e.lock ? '🔒' : '🔓'}</button>`;
      row.querySelector('.nm').textContent = elName(e);
      const [eye, lock] = row.querySelectorAll('button');
      eye.onclick = (ev) => { ev.stopPropagation(); e.hidden = !e.hidden; render(); commit(); };
      lock.onclick = (ev) => { ev.stopPropagation(); e.lock = !e.lock; render(); buildProps(); commit(); };
      row.onclick = (ev) => {
        endEdit();
        sel = ev.shiftKey ? (sel.includes(e.id) ? sel.filter((s) => s !== e.id) : [...sel, e.id]) : [e.id];
        buildProps(); drawOverlay(); renderLayers();
      };
      box.appendChild(row);
    }
  }

  // ---------- 오른쪽 속성 패널 ----------
  const P = $('props');
  function h(tag, props = {}, ...kids) {
    const el = Object.assign(document.createElement(tag), props);
    for (const k of kids) if (k != null) el.append(k);
    return el;
  }
  const group = (title, ...kids) => h('div', { className: 'g' }, h('h3', { textContent: title }), ...kids);
  const label = (t) => h('label', { textContent: t });
  const fmtNum = (v) => (v == null ? '' : Math.round(v * 100) / 100);

  // 값 바꾸기: 입력 중에는 화면만 갱신, 입력이 끝나면(change) 되돌리기 기록
  function numInput(get, set, opt = {}) {
    const inp = h('input', { type: 'number', step: opt.step ?? 1, value: fmtNum(get()) });
    if (opt.min != null) inp.min = opt.min;
    inp.oninput = () => { if (inp.value === '') return; set(+inp.value); render(); };
    inp.onchange = () => commit();
    inp._sync = () => { if (document.activeElement !== inp) inp.value = fmtNum(get()); };
    if (opt.prefix) return h('div', { className: 'nf' }, h('span', { textContent: opt.prefix }), inp);
    return inp;
  }

  function colorRow(get, set, { none = false } = {}) {
    const row = h('div', { className: 'colors' });
    const draw = () => {
      row.innerHTML = '';
      const cur = get() || '';
      if (none) {
        const b = h('button', { className: 'none' + (!cur ? ' on' : ''), title: '없음' });
        b.onclick = () => { set(''); render(); commit(); draw(); };
        row.append(b);
      }
      for (const [c, name] of CFG.colors) {
        const b = h('button', { className: cur === c ? 'on' : '', title: name });
        b.style.background = c;
        b.onclick = () => { set(c); render(); commit(); draw(); };
        row.append(b);
      }
      const pick = h('input', { type: 'color', title: '직접 고르기', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff' });
      pick.oninput = () => { set(pick.value); render(); };
      pick.onchange = () => { commit(); draw(); };
      row.append(pick);
    };
    draw();
    return row;
  }

  function segButtons(items, get, set) {
    const row = h('div', { className: 'r4' });
    const draw = () => {
      row.innerHTML = '';
      for (const [v, text, title] of items) {
        const b = h('button', { className: 'ib' + (get() === v ? ' on' : ''), textContent: text, title: title || '' });
        b.onclick = () => { set(v); render(); commit(); draw(); };
        row.append(b);
      }
    };
    draw();
    return row;
  }

  function actionButtons(items) {
    const row = h('div', { className: 'r4' });
    for (const [text, title, fn, cls] of items) {
      const b = h('button', { className: 'ib' + (cls ? ' ' + cls : ''), textContent: text, title });
      b.onmousedown = (ev) => ev.preventDefault(); // 편집 중 글자 선택이 풀리지 않게
      b.onclick = fn;
      row.append(b);
    }
    return row;
  }

  let geomInputs = [];
  function syncGeom() { geomInputs.forEach((d) => d.querySelector('input')._sync()); }

  function buildProps() {
    P.innerHTML = '';
    geomInputs = [];
    if (!doc) return;
    const els = selected();
    if (!els.length) return buildPageProps();
    const e = els[0];
    const one = els.length === 1;

    if (one && e.type === 'text') {
      if (editing === e.id) {
        P.append(group('선택한 글자만 바꾸기',
          h('div', { className: 'tip', innerHTML: '글자를 <b>드래그로 선택</b>한 다음 아래 버튼을 누르세요.' }),
          h('div', { style: 'height:8px' }),
          actionButtons([
            ...CFG.colors.slice(0, 3).map(([c, name]) => [name, name, () => styleSelection(`color:${c}`)]),
            ['굵게', '굵게', () => styleSelection('font-weight:900')],
          ])));
      }
      P.append(group('글씨',
        h('div', { className: 'r2' },
          numInput(() => e.fs, (v) => { e.fs = Math.max(4, v); }, { prefix: '크', min: 4 }),
          (() => {
            const s = h('select');
            for (const [v, t] of [[300, '얇게'], [500, '보통'], [600, '중간'], [700, '굵게'], [800, '더 굵게'], [900, '가장 굵게']]) s.append(h('option', { value: v, textContent: t, selected: +e.fw === v }));
            s.onchange = () => { e.fw = +s.value; render(); commit(); };
            return s;
          })()),
        label('정렬'),
        segButtons([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], () => e.align, (v) => { e.align = v; }),
        h('div', { className: 'r2' },
          h('div', {}, label('줄 간격'), numInput(() => e.lh, (v) => { e.lh = v; }, { step: 0.05 })),
          h('div', {}, label('자간 (em)'), numInput(() => e.ls, (v) => { e.ls = v; }, { step: 0.01 }))),
        label('글씨 색'),
        colorRow(() => e.color, (v) => { e.color = v || '#ffffff'; })));
      P.append(group('배경 (라벨처럼 쓰기)',
        colorRow(() => e.bg, (v) => {
          e.bg = v;
          if (v && !e.pad) { e.pad = [Math.round(e.fs * 0.3), Math.round(e.fs * 0.7)]; e.radius = Math.round(e.fs * 0.5); }
        }, { none: true }),
        e.bg ? h('div', { className: 'r2' },
          h('div', {}, label('안쪽 여백'), numInput(() => e.pad?.[1], (v) => { e.pad = [e.pad?.[0] ?? 0, v]; }, { min: 0 })),
          h('div', {}, label('모서리 둥글기'), numInput(() => e.radius, (v) => { e.radius = v; }, { min: 0 }))) : null));
    }

    if (one && e.type === 'image') {
      P.append(group('이미지',
        segButtons([['cover', '꽉 채우기', '잘라서 꽉 채움'], ['contain', '전체 보이기', '잘리지 않게']], () => e.fit || 'cover', (v) => { e.fit = v; }),
        h('div', { className: 'r2' },
          h('div', {}, label('모서리 둥글기'), numInput(() => e.radius, (v) => { e.radius = Math.max(0, v); }, { min: 0 })),
          h('div', {}, label(' '), h('button', { className: 'ib', style: 'width:100%;height:34px', textContent: '원래 비율로', onclick: async () => {
            const img = await loadImg(resolveSrc(e.src));
            e.h = Math.round(e.w * img.naturalHeight / img.naturalWidth);
            render(); syncGeom(); commit();
          } }))),
        h('button', { className: 'btn ghost', style: 'width:100%;margin-top:10px', textContent: '🔄 다른 이미지로 바꾸기', onclick: () => pickReplace(e.id) })));
    }

    if (one && e.type === 'shape') {
      P.append(group('도형',
        label('채우기'), colorRow(() => e.fill, (v) => { e.fill = v; }, { none: true }),
        label('테두리'), colorRow(() => e.stroke, (v) => { e.stroke = v; if (v && !e.sw) e.sw = 2; }, { none: true }),
        h('div', { className: 'r2' },
          h('div', {}, label('테두리 두께'), numInput(() => e.sw, (v) => { e.sw = Math.max(0, v); }, { min: 0, step: 0.5 })),
          e.shape === 'rect' ? h('div', {}, label('모서리 둥글기'), numInput(() => e.radius, (v) => { e.radius = Math.max(0, v); }, { min: 0 })) : null)));
    }

    if (one && e.type === 'block' && CFG.blockProps) P.append(CFG.blockProps(e, { group, label, segButtons, h }));

    // 위치·크기
    const geo = [
      numInput(() => e.x, (v) => { e.x = v; }, { prefix: 'X' }),
      numInput(() => e.y, (v) => { e.y = v; }, { prefix: 'Y' }),
      numInput(() => e.w, (v) => { e.w = Math.max(8, v); if (e.type === 'text') e.autoW = false; }, { prefix: 'W' }),
    ];
    if (e.type !== 'text') geo.push(numInput(() => e.h, (v) => { e.h = Math.max(1, v); }, { prefix: 'H' }));
    if (one) geomInputs = geo;
    P.append(group(one ? '위치 · 크기' : `${els.length}개 선택됨`,
      one ? h('div', { className: 'r2' }, ...geo) : null,
      label(one ? '페이지 기준 정렬' : '선택한 것끼리 정렬'),
      actionButtons([['⇤', '왼쪽 맞춤', () => align('l')], ['↔', '가운데 맞춤', () => align('c')], ['⇥', '오른쪽 맞춤', () => align('r')], ['⤒', '위쪽 맞춤', () => align('t')]]),
      h('div', { style: 'height:6px' }),
      actionButtons([['↕', '세로 가운데 맞춤', () => align('m')], ['⤓', '아래쪽 맞춤', () => align('b')]]),
      one ? h('div', {}, label('투명도'), (() => {
        const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: e.opacity ?? 1 });
        r.oninput = () => { e.opacity = +r.value; render(); };
        r.onchange = () => commit();
        return r;
      })()) : null));

    P.append(group('정리',
      actionButtons([['맨 앞', '맨 앞으로', () => arrange('front')], ['앞으로', '한 칸 앞으로', () => arrange('up')], ['뒤로', '한 칸 뒤로', () => arrange('down')], ['맨 뒤', '맨 뒤로', () => arrange('back')]]),
      h('div', { style: 'height:6px' }),
      actionButtons([
        ['복제', '복제 (Ctrl+D)', () => pasteEls(selected())],
        [e.lock ? '잠금 해제' : '잠금', '잠그면 실수로 움직이지 않아요', () => { const v = !els.every((x) => x.lock); els.forEach((x) => { x.lock = v; }); render(); buildProps(); commit(); }],
        ['삭제', '삭제 (Delete)', removeSel, 'danger'],
      ])));
  }

  function buildPageProps() {
    const swatch = (list, key) => {
      const row = h('div', { className: 'swatches' });
      for (const c of list) {
        const b = h('button', { className: (doc.page[key] === c ? 'on' : '') + (c === 'transparent' ? ' clear' : ''), title: c === 'transparent' ? '투명' : c });
        if (c !== 'transparent') b.style.background = c;
        b.style.borderColor = doc.page[key] === c ? '#fff' : '#333a50';
        b.onclick = () => { doc.page[key] = c; render(); commit(); buildProps(); };
        row.append(b);
      }
      const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(doc.page[key]) ? doc.page[key] : '#ffffff' });
      pick.style.cssText = 'width:34px;height:34px;border:0;background:none;padding:0;cursor:pointer';
      pick.oninput = () => { doc.page[key] = pick.value; render(); };
      pick.onchange = () => { commit(); buildProps(); };
      row.append(pick);
      return row;
    };
    const f = CFG.formats[fmt];
    if (f.custom) {
      const resize = (key, v) => { doc.page[key] = Math.round(Math.min(8000, Math.max(50, v))); };
      const presets = h('div', { className: 'size-presets' });
      for (const [w, hh, name] of f.presets || []) {
        const b = h('button', { className: 'ib', innerHTML: `${name ? `<b>${name}</b>` : ''}${w}×${hh}` });
        b.onclick = () => { doc.page.w = w; doc.page.h = hh; render(); buildProps(); commit(); };
        presets.append(b);
      }
      P.append(group('페이지 크기 (px)',
        h('div', { className: 'r2' },
          numInput(() => doc.page.w, (v) => resize('w', v), { prefix: 'W', min: 50 }),
          numInput(() => doc.page.h, (v) => resize('h', v), { prefix: 'H', min: 50 })),
        f.presets ? label('자주 쓰는 크기') : null,
        f.presets ? presets : null));
    }
    P.append(group('페이지',
      label(CFG.accentLabel), swatch(CFG.accents, 'accent'),
      label('배경 색' + (CFG.bgs.includes('transparent') ? ' (체크무늬 = 투명)' : '')), swatch(CFG.bgs, 'bg')));
    P.append(group('사용법', h('div', { className: 'tip', innerHTML: [
      '<b>클릭</b> 선택 · <b>Shift+클릭</b> 여러 개 선택 · 빈 곳 드래그로 범위 선택',
      '<b>더블클릭</b> 글씨 고치기 (Esc로 끝내기)',
      '모서리를 끌면 글씨 크기, 양옆을 끌면 글 상자 폭이 바뀝니다',
      '<b>Shift</b> 누르고 이동하면 가로·세로로만, <b>Alt</b> 누르면 자석 끄기',
      '<b>Ctrl+Z</b> 되돌리기 · <b>Ctrl+D</b> 복제 · <b>Ctrl+C/V</b> 복사 · 방향키로 1px(Shift 10px)',
      '<b>Ctrl+휠</b> 확대/축소',
    ].join('<br>') })));
    P.append(group('처음부터',
      h('div', { className: 'btns' },
        h('button', { className: 'btn ghost', textContent: CFG.resetLabel, onclick: () => {
          if (!confirm(`${CFG.resetLabel}? (Ctrl+Z로 다시 돌아올 수 있어요)`)) return;
          doc = newDoc(); sel = []; render(); buildProps(); commit();
        } }),
        h('button', { className: 'btn ghost', textContent: '빈 페이지로 시작하기', onclick: () => {
          if (!confirm('모든 요소를 지우고 빈 페이지로 시작할까요? (Ctrl+Z로 다시 돌아올 수 있어요)')) return;
          doc.els = []; sel = []; render(); buildProps(); commit();
        } }))));
  }

  // ---------- 이미지로 저장 ----------
  let uiKey = '';
  let ui = {};
  const persistUi = () => { try { localStorage.setItem(uiKey, JSON.stringify(ui)); } catch (e) {} };
  const ratioOf = (q) => (typeof q.ratio === 'function' ? q.ratio(PAGE) : q.ratio);

  function buildQuality() {
    const box = $('quality');
    box.innerHTML = '';
    for (const [v, q] of Object.entries(CFG.exports)) {
      const b = document.createElement('button');
      const r = ratioOf(q);
      b.innerHTML = `${q.label}<small>${Math.round(PAGE.w * r)}×${Math.round(PAGE.h * r)}</small>`;
      b.className = ui.quality === v ? 'on' : '';
      b.onclick = () => { ui.quality = v; persistUi(); buildQuality(); };
      box.append(b);
    }
  }

  $('save').onclick = async () => {
    const btn = $('save');
    endEdit();
    btn.disabled = true; btn.textContent = '이미지 만드는 중…';
    try {
      await document.fonts.ready;
      const q = CFG.exports[ui.quality];
      const opts = { width: PAGE.w, height: PAGE.h, pixelRatio: ratioOf(q) };
      // JPG 는 투명을 담지 못하므로 투명 배경이면 흰색으로 채움
      if (q.type === 'jpeg' && doc.page.bg === 'transparent') opts.backgroundColor = '#ffffff';
      const canvas = await htmlToImage.toCanvas(cv, opts);
      const dataUrl = q.type === 'jpeg' ? canvas.toDataURL('image/jpeg', 0.92) : canvas.toDataURL('image/png');
      const name = ($('fileName').value || CFG.fileName) + (CFG.formats[fmt].suffix || '');
      await Studio.save(dataUrl, name, CFG.kind, $('status'));
    } catch (e) {
      status('저장 실패: ' + e.message, 'err');
    } finally {
      btn.disabled = false; btn.textContent = CFG.saveLabel;
    }
  };

  // ---------- 규격 / 작업 불러오기 ----------
  function newDoc() {
    const els = CFG.defaultEls(fmt, CFG.formats[fmt], PAGE);
    els.forEach((e) => { e.id = uid(); fillDept(e); });
    return { version: 1, page: pageFor({}), els };
  }
  // 크기와 모양은 늘 규격 정의를 따르고, 색만 저장된 값을 씀
  function pageFor(saved) {
    const f = CFG.formats[fmt];
    const size = f.custom && saved.w && saved.h ? { w: saved.w, h: saved.h } : { w: f.w, h: f.h };
    return { bg: CFG.bgs[0], accent: CFG.accents[0], ...f.page, ...saved, ...size, round: !!f.round };
  }

  function buildFormats() {
    const keys = Object.keys(CFG.formats);
    $('fmtSep').style.display = $('formats').style.display = keys.length > 1 ? '' : 'none';
    $('formats').innerHTML = '';
    for (const k of keys) {
      const b = document.createElement('button');
      b.textContent = CFG.formats[k].label;
      b.title = `${CFG.formats[k].w} × ${CFG.formats[k].h}`;
      b.className = k === fmt ? 'on' : '';
      b.onclick = () => { if (k !== fmt) loadFormat(k); };
      $('formats').append(b);
    }
  }

  async function loadFormat(k) {
    if (doc) { endEdit(); if (saveTimer && !readOnly) await saveNow(); }
    fmt = k;
    ui.fmt = k; persistUi();
    const f = CFG.formats[k];
    PAGE = { w: f.w, h: f.h };
    try {
      const r = await fetch(`/api/project?name=${encodeURIComponent(projectName())}`);
      doc = r.ok ? await r.json() : newDoc();
    } catch (e) {
      doc = newDoc();
    }
    doc.page = pageFor(doc.page);
    PAGE = { w: doc.page.w, h: doc.page.h };
    sel = []; editing = null; hoverId = null;
    $('sizeInfo').textContent = sizeText();
    buildFormats();
    buildQuality();
    render();
    layout();
    buildProps();
    hist.stack = [JSON.stringify(doc)]; hist.i = 0;
    updateUndo();
    $('saveState').textContent = '';
  }

  async function start(cfg) {
    CFG = { autoImages: {}, ...cfg };
    uiKey = Studio.storeKey(`${CFG.project}-ui`);
    CFG.fileName = Studio.fillDept(CFG.fileName);
    try { ui = JSON.parse(localStorage.getItem(uiKey)) || {}; } catch (e) { ui = {}; }
    if (!CFG.exports[ui.quality]) ui.quality = Object.keys(CFG.exports)[0];
    $('fileName').value = ui.fileName || CFG.fileName;
    $('fileName').onchange = () => { ui.fileName = $('fileName').value; persistUi(); };
    $('save').textContent = CFG.saveLabel;
    if (readOnly) $('uploadBtn').style.display = 'none';
    buildTools();
    // 자동 이미지(원본에서 잘라낸 로고 등)는 준비되는 대로 다시 그림
    const autoReady = Object.entries(CFG.autoImages).map(([k, a]) => a.load().then((u) => { autoSrc[k] = u; render(); }).catch(() => {}));
    await document.fonts.ready;
    await loadFormat(CFG.formats[ui.fmt] ? ui.fmt : Object.keys(CFG.formats)[0]);
    await Promise.all(autoReady);
    loadLibrary();
  }

  // 테스트·디버깅용으로 상태를 볼 수 있게 열어둠
  return {
    start, loadFormat, nodes,
    get doc() { return doc; }, get sel() { return sel; }, get editing() { return editing; }, get scale() { return scale; }, get fmt() { return fmt; },
  };
})();
