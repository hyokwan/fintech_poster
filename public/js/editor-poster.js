// 자유 편집 > 학과 포스터: 원본 전단지 배치, 포스터 블록, 도구, 저장 옵션
const POSTER_BLOCKS = {
  stat: (label, val, accent) => `<div class="s-label" data-edit>${label}</div><div class="s-val${accent ? ' c1' : ''}" data-edit>${val}</div>`,
  prog: (badge, title, desc, items) => `<span class="badge" data-edit>${badge}</span><div class="prog-title"><span data-edit>${title}</span> <span class="en" data-edit>Program</span></div><div class="prog-desc" data-edit>${desc}</div><hr><ul data-edit>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`,
  info: (rows) => rows.map(([k, v]) => `<div class="info-row"><div class="k" data-edit>${k}</div><div class="v" data-edit>${v}</div></div>`).join(''),
  sched: (round, a, b, c, d) => `<div class="round" data-edit>${round}</div><div><small data-edit>${a}</small><b data-edit>${b}</b><small data-edit>${c}</small><b data-edit>${d}</b></div>`,
  extra: (rows) => rows.map(([k, v]) => `<div class="ex-row"><div class="k" data-edit>${k}</div><div class="v" data-edit>${v}</div></div>`).join(''),
  cta: (text) => `<svg viewBox="0 0 34 24"><rect width="34" height="24" rx="6" fill="#0b0c14"/><path d="M13.5 7v10l9-5z" fill="var(--c1)"/></svg><span data-edit>${text}</span>`,
};

// 원본 전단지(학과 포스터 탭)와 같은 배치
function posterEls() {
  const B = POSTER_BLOCKS;
  const col3 = [64, 440.5, 817], colW = 359;
  return [
    SH('ellipse', 816, 140, 600, 600, { stroke: 'rgba(255,255,255,0.13)', sw: 1.5, name: '원형 장식 (큰 원)' }),
    SH('ellipse', 896, 220, 440, 440, { stroke: 'rgba(255,255,255,0.13)', sw: 1.5, name: '원형 장식 (작은 원)' }),
    SH('ellipse', 1098, 204, 22, 22, { fill: 'var(--c1)', name: '원형 장식 (점)' }),
    IM('logo:auto', 64, 44, 288, 76, { radius: 14 }),
    T(776, 70, 400, 'ADMISSION 2027', { fs: 17, fw: 700, color: '#c9ccd8', align: 'right', ls: 0.22 }),
    T(64, 153, 150, '2027년도', { fs: 26, fw: 800, color: '#0b0c14', bg: 'var(--c1)', pad: [0, 20], radius: 24, lh: 1.846, autoW: true }),
    T(64, 227, 900, '한국폴리텍대학', { fs: 64, fw: 800, lh: 1.15 }),
    T(64, 309, 1000, 'AI핀테크융합과', { fs: 112, fw: 900, lh: 1.08, ls: -0.04, color: 'var(--c1)' }),
    T(64, 430, 1000, '교육생 모집<span style="font-size:0.357em;font-weight:700;color:var(--c2);margin-left:0.18em;letter-spacing:-0.02em">(대졸자 과정)</span>', { fs: 112, fw: 900, lh: 1.08, ls: -0.04 }),
    T(64, 573, 1000, '인공지능/블록체인/인프라/웹개발 교육', { fs: 27, fw: 600, color: '#c5c8d4', lh: 1.2 }),
    BL('stat', col3[0], 623, colW, 143, B.stat('평균 취업률', '약 90%', true)),
    BL('stat', col3[1], 623, colW, 143, B.stat('취업연봉(1년)', '3200~6500')),
    BL('stat', col3[2], 623, colW, 143, B.stat('취업알선/사후지도', '100%')),
    BL('prog', col3[0], 782, colW, 297, B.prog('인공지능', '인공지능', '업체와 협업 구성한<br>인공지능 프로그램', ['소그룹지도를 통한 실력 향상!', '업체가 원하는 기술로 구성한 커리큘럼', '수업 후 스터디로 부족한 영역 보완!']), { tone: 1 }),
    BL('prog', col3[1], 782, colW, 297, B.prog('블록체인', '블록체인/인프라', '블록체인 구현<br>인프라 구성 실습', ['프로젝트형 팀 실습', '모듈별 설명을 통한 완벽 이해', '실 서버환경에서 인프라 구축 실습']), { tone: 2 }),
    BL('prog', col3[2], 782, colW, 297, B.prog('웹개발', '웹개발', '개발부터 실제 웹상에<br>배포까지 배우는 실습', ['단계별 기본 Java 학습', '협력업체가 원하는 개발요소로만 구성', '혼자 힘으로 운영까지 전과정 실습']), { tone: 3 }),
    BL('info', 64, 1095, 1112, 261, B.info([
      ['모집인원', '20명 (1차: 7명, 2차 13명)'],
      ['교육기간', '2027년 03월 ~ 2028년 02월 (1년)'],
      ['교육장소', '한국폴리텍대학 서울강서캠퍼스 (우장산역 인근)'],
      ['원서접수', '<b>www.hkcode.co.kr</b> 접속 후 원서접수 링크 클릭!'],
    ])),
    BL('sched', 64, 1372, 547.5, 147, B.sched('1차', '접수기간', '2026년 11월 02일 (월) ~ 2026년 12월 04일 (금)', '면접', '2026년 12월 10일 (목) / 발표 12월 18일(금)'), { tone: 1 }),
    BL('sched', 628.5, 1372, 547.5, 147, B.sched('2차', '접수기간', '2026년 12월 04일 (금) ~ 2027년 01월 28일 (목)', '면접', '2027년 02월 02일 (화) / 발표 02월 15일(월)'), { tone: 2 }),
    BL('extra', 64, 1537, 539, 96, B.extra([
      ['지원자격', '만 39세 이하(87년 3월3일 이후 출생자) 및<br>초대졸 이상 또는 동등 이상 자격자 <small>(정보처리 산업기사 등 소유자)</small>'],
      ['위치', '지하철 5호선 우장산역 2번 출구 도보 10분'],
    ])),
    BL('extra', 637, 1537, 539, 96, B.extra([['입학문의', '카카오 채널 “한국폴리텍대학 스마트금융과”<br>이메일 : haiteam@kopo.ac.kr / wyhwang@kopo.ac.kr']])),
    BL('cta', 64, 1638, 1112, 76, B.cta('유튜브에서 “AI핀테크융합과”를 검색하세요.')),
  ];
}

const POSTER_BLOCK_NAMES = { stat: '숫자 카드', prog: '프로그램 카드', info: '모집 안내 표', sched: '일정 카드', extra: '안내 문구', cta: '하단 버튼' };
const posterBody = () => T(0, 0, 560, '본문 내용을 입력하세요.<br>Enter로 줄을 바꿀 수 있어요.', { fs: 24, fw: 500, color: '#c5c8d4', lh: 1.6 });

Editor.start({
  project: 'poster',
  kind: 'poster',
  fileName: 'AI핀테크융합과_포스터',
  saveLabel: '💾 포스터 저장하기',
  resetLabel: '원본 전단지 배치로 되돌리기',
  formats: { a4: { label: 'A4', w: 1240, h: 1754, project: 'poster', info: 'A4 · 2480 × 3508 (300dpi)' } },
  exports: {
    print: { label: '인쇄용 PNG', ratio: 2, type: 'png' },
    web: { label: '웹/SNS용 JPG', ratio: 1, type: 'jpeg' },
  },
  accentLabel: '포인트 색 (포인트 색을 쓴 글씨·도형이 모두 바뀜)',
  accents: ['#d4f53c', '#3cf5c4', '#4fc3ff', '#ffc53c', '#ff7ab6'],
  bgs: ['#0b0c14', '#0a1230', '#14102a', '#000000', '#ffffff'],
  themeVars: { '--c2': '#a99bff', '--c3': '#ff8a65' },
  // 글자/도형 색: var(--c1) 처럼 테마 색을 쓰면 포인트 색을 바꿀 때 같이 바뀐다
  colors: [
    ['var(--c1)', '포인트'], ['var(--c2)', '보라'], ['var(--c3)', '주황'], ['#ffffff', '흰색'],
    ['#c5c8d4', '회색'], ['#8f9bff', '라벨'], ['#141624', '카드'], ['#0b0c14', '검정'],
  ],
  autoImages: {
    'logo:auto': { label: '포스터 로고', load: () => Studio.posterLogo() },
    'symbol:auto': { label: '심볼 마크 (투명)', load: () => Studio.emblemSymbol() },
  },
  defaultEls: posterEls,
  pasteText: posterBody,
  cardBlocks: ['stat', 'prog', 'sched'],
  blockNames: POSTER_BLOCK_NAMES,
  blockProps: (e, { group, label, segButtons, h }) => group('블록',
    h('div', { className: 'tip', innerHTML: `<b>${POSTER_BLOCK_NAMES[e.block]}</b> · 더블클릭하면 안의 글씨를 고칠 수 있어요.` + (e.block === 'prog' ? '<br>목록에서 Enter를 누르면 항목이 하나 추가됩니다.' : '') }),
    ...(e.block === 'prog' || e.block === 'sched' ? [label('색상'), segButtons([[1, '포인트'], [2, '보라'], [3, '주황']], () => e.tone, (v) => { e.tone = v; })] : [])),
  toolGroups: { text: '텍스트', shape: '도형', block: '포스터 블록' },
  tools: {
    title: { group: 'text', label: '제목', pv: '<b style="font-size:20px;font-weight:900">제목</b>', make: () => T(0, 0, 700, '제목을 입력하세요', { fs: 80, fw: 900, lh: 1.12, ls: -0.04 }) },
    sub: { group: 'text', label: '부제목', pv: '<b style="font-size:16px">부제목</b>', make: () => T(0, 0, 640, '부제목을 입력하세요', { fs: 44, fw: 700, lh: 1.2 }) },
    body: { group: 'text', label: '본문', pv: '<span style="font-size:12px;color:#c5c8d4">본문 글씨<br>여러 줄 설명</span>', make: posterBody },
    accent: { group: 'text', label: '강조 문구', pv: '<b style="font-size:18px;color:var(--c1)">90%</b>', make: () => T(0, 0, 400, '강조 문구', { fs: 64, fw: 800, color: 'var(--c1)', lh: 1.15, ls: -0.03 }) },
    pill: { group: 'text', label: '라벨', pv: '<b style="font-size:12px;background:var(--c1);color:#0b0c14;padding:2px 9px;border-radius:10px">라벨</b>', make: () => T(0, 0, 150, '라벨', { fs: 26, fw: 800, color: '#0b0c14', bg: 'var(--c1)', pad: [0, 20], radius: 24, lh: 1.846, autoW: true }) },
    badge: { group: 'text', label: '마감 임박 배지', pv: '<b style="font-size:12px;background:#ff5a5a;color:#fff;padding:2px 9px;border-radius:6px">마감 임박</b>', make: () => T(0, 0, 200, '마감 임박!', { fs: 32, fw: 900, color: '#ffffff', bg: '#ff5a5a', pad: [10, 22], radius: 12, lh: 1.2, autoW: true }) },
    rect: { group: 'shape', label: '카드 사각형', pv: '<i class="shape-pv" style="background:#141624;border:1px solid #262a3c;border-radius:6px"></i>', make: () => SH('rect', 0, 0, 420, 260, { fill: '#141624', stroke: '#262a3c', sw: 1, radius: 22 }) },
    box: { group: 'shape', label: '색 사각형', pv: '<i class="shape-pv" style="background:var(--c1);border-radius:6px"></i>', make: () => SH('rect', 0, 0, 420, 120, { fill: 'var(--c1)', radius: 20 }) },
    circle: { group: 'shape', label: '원', pv: '<i class="shape-pv" style="background:var(--c1);border-radius:50%;width:26px"></i>', make: () => SH('ellipse', 0, 0, 160, 160, { fill: 'var(--c1)' }) },
    ring: { group: 'shape', label: '원형 테두리', pv: '<i class="shape-pv" style="border:2px solid rgba(255,255,255,.4);border-radius:50%;width:26px"></i>', make: () => SH('ellipse', 0, 0, 400, 400, { stroke: 'rgba(255,255,255,0.13)', sw: 1.5 }) },
    line: { group: 'shape', label: '구분선', pv: '<i class="shape-pv" style="height:2px;margin:12px 0;background:#3a3f55"></i>', make: () => SH('rect', 0, 0, 600, 2, { fill: '#262a3c' }) },
    stat: { group: 'block', label: '숫자 카드', pv: '<b style="font-size:16px;color:var(--c1)">90%</b>', make: () => BL('stat', 0, 0, 359, 143, POSTER_BLOCKS.stat('라벨', '100%', true)) },
    prog: { group: 'block', label: '프로그램 카드', pv: '<b style="font-size:12px">✔ 목록 카드</b>', make: () => BL('prog', 0, 0, 359, 297, POSTER_BLOCKS.prog('과목', '과목명', '과목 설명을<br>입력하세요', ['특징 하나', '특징 둘', '특징 셋']), { tone: 1 }) },
    sched: { group: 'block', label: '일정 카드', pv: '<b style="font-size:12px">① 접수 일정</b>', make: () => BL('sched', 0, 0, 547.5, 147, POSTER_BLOCKS.sched('3차', '접수기간', '0000년 00월 00일 ~ 00월 00일', '면접', '0000년 00월 00일 / 발표 00월 00일'), { tone: 1 }) },
    info: { group: 'block', label: '안내 표', pv: '<b style="font-size:12px">항목 | 내용</b>', make: () => BL('info', 0, 0, 1112, 130, POSTER_BLOCKS.info([['항목', '내용을 입력하세요'], ['항목', '내용을 입력하세요']])) },
    cta: { group: 'block', label: '하단 버튼', pv: '<b style="font-size:11px;background:var(--c1);color:#0b0c14;padding:3px 8px;border-radius:6px">▶ 버튼</b>', make: () => BL('cta', 0, 0, 1112, 76, POSTER_BLOCKS.cta('버튼 문구를 입력하세요')) },
  },
});
