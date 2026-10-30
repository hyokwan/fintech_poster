// 배너 만들기: 유튜브 채널 배너, 가로·띠 배너, 직접 입력 크기
// 기본 배치는 규격 크기(또는 안전 영역)에 맞춰 계산한다: 심볼 + 학교/학과명 + 한 줄 문구 + 유튜브 안내
const SYMBOL = 'symbol:auto';
const YT_SAFE = { x: 507, y: 508, w: 1546, h: 423 }; // 유튜브: 모든 기기에서 보이는 가운데 영역

function bannerEls(fmt, f, page) {
  const d = Studio.dept;
  const pad = Math.round(Math.min(page.w, page.h) * 0.1);
  const A = f.safe || { x: pad, y: pad, w: page.w - pad * 2, h: page.h - pad * 2 };
  const cta = d.youtube ? `▶ 유튜브에서 “${d.youtube}” 검색` : d.website || '';
  const school = `${d.school} ${d.campus || ''}`.trim();
  const R = page.h * 0.95;
  const els = [
    SH('ellipse', page.w - R * 0.62, page.h * 0.5 - R * 0.62, R, R, { stroke: 'rgba(255,255,255,0.12)', sw: Math.max(1.5, page.h / 500), name: '원형 장식 (큰 원)' }),
    SH('ellipse', page.w - R * 0.48, page.h * 0.5 - R * 0.48, R * 0.72, R * 0.72, { stroke: 'rgba(255,255,255,0.12)', sw: Math.max(1.5, page.h / 500), name: '원형 장식 (작은 원)' }),
  ];
  const T2 = (x, y, w, html, st) => T(Math.round(x), Math.round(y), Math.round(w), html, { lh: 1.15, ls: -0.03, ...st });
  const r = (v) => Math.round(v);

  if (A.w / A.h >= 2) {
    // 가로형: 왼쪽 심볼, 오른쪽 글씨
    const u = A.h, sym = r(u * 0.86);
    els.push(IM(SYMBOL, A.x, r(A.y + (u - sym) / 2), sym, sym, { fit: 'contain' }));
    const tx = A.x + sym + u * 0.12, tw = A.x + A.w - tx;
    if (u < 240) { // 낮은 띠 배너: 두 줄만
      els.push(T2(tx, A.y + u * 0.08, tw, d.name, { fs: r(u * 0.4), fw: 900, color: 'var(--c1)' }));
      els.push(T2(tx, A.y + u * 0.62, tw, school, { fs: r(u * 0.2), fw: 700, color: '#c5c8d4' }));
    } else {
      els.push(T2(tx, A.y + u * 0.06, tw, school, { fs: r(u * 0.11), fw: 700, color: '#ffffff' }));
      els.push(T2(tx, A.y + u * 0.22, tw, d.name, { fs: r(u * 0.25), fw: 900, color: 'var(--c1)' }));
      if (d.slogan) els.push(T2(tx, A.y + u * 0.55, tw, d.slogan, { fs: r(u * 0.085), fw: 600, color: '#c5c8d4' }));
      if (cta) els.push(T2(tx, A.y + u * 0.75, tw, cta, { fs: r(u * 0.07), fw: 800, color: '#0b0c14', bg: 'var(--c1)', pad: [r(u * 0.02), r(u * 0.05)], radius: r(u * 0.08), lh: 1.5, autoW: true }));
    }
  } else {
    // 세로·정사각형: 가운데 정렬로 쌓기
    const u = Math.min(A.w, A.h * 1.2), sym = r(u * 0.34);
    els.push(IM(SYMBOL, r(A.x + (A.w - sym) / 2), r(A.y + A.h * 0.04), sym, sym, { fit: 'contain' }));
    let y = A.y + A.h * 0.04 + sym + u * 0.06;
    const C = (html, fs, st) => { els.push(T2(A.x, y, A.w, html, { fs: r(fs), align: 'center', ...st })); y += fs * 1.35; };
    C(school, u * 0.055, { fw: 700 });
    C(d.name, u * 0.12, { fw: 900, color: 'var(--c1)' });
    if (d.slogan) C(d.slogan, u * 0.04, { fw: 600, color: '#c5c8d4' });
    if (cta) { y += u * 0.03; C(cta, u * 0.038, { fw: 800, color: 'var(--c1)' }); }
  }
  return els;
}

async function symbolTool({ page, resolveSrc, loadImg }) {
  const img = await loadImg(resolveSrc(SYMBOL));
  const w = Math.round(Math.min(page.w, page.h) * 0.4);
  return IM(SYMBOL, 0, 0, w, Math.round(w * img.naturalHeight / img.naturalWidth), { fit: 'contain' });
}

// 글씨 크기를 페이지 크기에 맞춰서 (배너 크기가 제각각이라)
const fsOf = (page, k) => Math.round(Math.min(page.w, page.h) * k);

Editor.start({
  project: 'banner',
  kind: 'banner',
  fileName: 'AI핀테크융합과_배너',
  saveLabel: '💾 배너 저장하기',
  resetLabel: '기본 배치로 되돌리기',
  formats: {
    yt: {
      label: '유튜브 채널 배너', w: 2560, h: 1440, suffix: '_유튜브배너', safe: YT_SAFE,
      info: '유튜브 채널 배너 · 2560 × 1440 · 6MB 이하',
      zones: [
        { x: 0, y: 508, w: 2560, h: 423, label: 'PC 화면에 보이는 영역 (2560 × 423)' },
        { ...YT_SAFE, label: '모든 기기에 보이는 영역 (1546 × 423) · 글씨와 로고는 이 안에', main: true },
      ],
    },
    wide: { label: '가로 배너', w: 1200, h: 400, suffix: '_가로배너', info: '카페 대문 · 블로그 상단 · 1200 × 400' },
    strip: { label: '띠 배너', w: 1200, h: 200, suffix: '_띠배너', info: '게시글 위·아래 띠 · 1200 × 200' },
    custom: {
      label: '직접 입력', w: 1600, h: 500, custom: true, suffix: '_배너',
      presets: [[1200, 400, '가로형'], [860, 300, '좁은 가로형'], [1920, 600, '와이드'], [1080, 1080, '정사각형'], [800, 100, '얇은 띠'], [728, 90, '웹 배너']],
    },
  },
  exports: {
    png: { label: 'PNG', ratio: 1, type: 'png' },
    jpg: { label: 'JPG (용량 작게)', ratio: 1, type: 'jpeg' },
    x2: { label: '2배 선명하게', ratio: (p) => (Math.max(p.w, p.h) > 2600 ? 1 : 2), type: 'png' },
  },
  accentLabel: '포인트 색 (포인트 색을 쓴 글씨·도형이 모두 바뀜)',
  accents: ['#d4f53c', '#3cf5c4', '#4fc3ff', '#ffc53c', '#ff7ab6'],
  bgs: ['#0b0c14', '#0a1230', '#14102a', '#0b5796', '#ffffff'],
  themeVars: { '--c2': '#a99bff', '--c3': '#ff8a65' },
  colors: [
    ['var(--c1)', '포인트'], ['var(--c2)', '보라'], ['var(--c3)', '주황'], ['#ffffff', '흰색'],
    ['#c5c8d4', '회색'], ['#141624', '카드'], ['#0b0c14', '검정'],
  ],
  autoImages: {
    [SYMBOL]: { label: '심볼 마크 (투명)', load: () => Studio.emblemSymbol() },
    'logo:auto': { label: '학과 로고', load: () => Studio.posterLogo() },
  },
  defaultEls: bannerEls,
  pasteText: () => T(0, 0, 900, '', { fs: 48, fw: 600, lh: 1.3 }),
  toolGroups: { text: '텍스트', mark: '학과', shape: '도형' },
  tools: {
    title: { group: 'text', label: '큰 제목', pv: '<b style="font-size:20px;font-weight:900">제목</b>', make: ({ page }) => T(0, 0, page.w * 0.6, '제목을 입력하세요', { fs: fsOf(page, 0.16), fw: 900, lh: 1.12, ls: -0.04 }) },
    sub: { group: 'text', label: '부제목', pv: '<b style="font-size:15px">부제목</b>', make: ({ page }) => T(0, 0, page.w * 0.5, '부제목을 입력하세요', { fs: fsOf(page, 0.08), fw: 700, lh: 1.2 }) },
    accent: { group: 'text', label: '강조 문구', pv: '<b style="font-size:18px;color:var(--c1)">NEW</b>', make: ({ page }) => T(0, 0, page.w * 0.4, '강조 문구', { fs: fsOf(page, 0.12), fw: 800, color: 'var(--c1)', lh: 1.15 }) },
    pill: { group: 'text', label: '라벨', pv: '<b style="font-size:12px;background:var(--c1);color:#0b0c14;padding:2px 9px;border-radius:10px">라벨</b>', make: ({ page }) => { const s = fsOf(page, 0.06); return T(0, 0, 200, '라벨', { fs: s, fw: 800, color: '#0b0c14', bg: 'var(--c1)', pad: [Math.round(s * 0.25), Math.round(s * 0.75)], radius: s, lh: 1.5, autoW: true }); } },
    dept: { group: 'mark', label: '학과명', pv: '<b style="font-size:14px;color:var(--c1)">학과명</b>', make: ({ page }) => T(0, 0, page.w * 0.6, Studio.dept.name, { fs: fsOf(page, 0.14), fw: 900, color: 'var(--c1)', lh: 1.15, ls: -0.03 }) },
    school: { group: 'mark', label: '학교·캠퍼스', pv: '<b style="font-size:12px">학교 · 캠퍼스</b>', make: ({ page }) => T(0, 0, page.w * 0.6, `${Studio.dept.school} ${Studio.dept.campus || ''}`.trim(), { fs: fsOf(page, 0.07), fw: 700, lh: 1.2 }) },
    symbol: { group: 'mark', label: '심볼 마크', pv: '<span style="font-size:20px">🌀</span>', make: symbolTool },
    youtube: { group: 'mark', label: '유튜브 안내', pv: '<b style="font-size:11px;background:var(--c1);color:#0b0c14;padding:3px 8px;border-radius:6px">▶ 유튜브</b>', make: ({ page }) => { const s = fsOf(page, 0.055); return T(0, 0, 300, `▶ 유튜브에서 “${Studio.dept.youtube || Studio.dept.name}” 검색`, { fs: s, fw: 800, color: '#0b0c14', bg: 'var(--c1)', pad: [Math.round(s * 0.3), Math.round(s * 0.8)], radius: s, lh: 1.5, autoW: true }); } },
    rect: { group: 'shape', label: '색 사각형', pv: '<i class="shape-pv" style="background:var(--c1);border-radius:6px"></i>', make: ({ page }) => SH('rect', 0, 0, page.w * 0.3, page.h * 0.3, { fill: 'var(--c1)', radius: fsOf(page, 0.04) }) },
    card: { group: 'shape', label: '카드', pv: '<i class="shape-pv" style="background:#141624;border:1px solid #262a3c;border-radius:6px"></i>', make: ({ page }) => SH('rect', 0, 0, page.w * 0.35, page.h * 0.5, { fill: '#141624', stroke: '#262a3c', sw: 1, radius: fsOf(page, 0.05) }) },
    circle: { group: 'shape', label: '원', pv: '<i class="shape-pv" style="background:var(--c1);border-radius:50%;width:26px"></i>', make: ({ page }) => { const s = fsOf(page, 0.3); return SH('ellipse', 0, 0, s, s, { fill: 'var(--c1)' }); } },
    ring: { group: 'shape', label: '원형 테두리', pv: '<i class="shape-pv" style="border:2px solid rgba(255,255,255,.4);border-radius:50%;width:26px"></i>', make: ({ page }) => { const s = fsOf(page, 0.8); return SH('ellipse', 0, 0, s, s, { stroke: 'rgba(255,255,255,0.13)', sw: 2 }); } },
    line: { group: 'shape', label: '구분선', pv: '<i class="shape-pv" style="height:3px;margin:12px 0;background:var(--c1)"></i>', make: ({ page }) => SH('rect', 0, 0, page.w * 0.3, Math.max(2, fsOf(page, 0.008)), { fill: 'var(--c1)' }) },
  },
});
