// 자유 편집 > 엠블럼: 정사각형·원형·가로형 기본 배치, 도구, 저장 옵션
// 심볼 마크는 학과 설정의 심볼(없으면 기본 학과 원본 public/images/emblem/)을 투명하게 잘라 쓰고, 글씨는 진짜 텍스트라 바로 고칠 수 있다.
const SYMBOL = 'symbol:auto';
const SYMBOL_RATIO = 1.02; // 심볼 마크 높이/너비 (원본에서 자른 크기 기준, 첫 배치에만 씀)

const emblemText = (x, y, w, html, st) => T(x, y, w, html, { color: 'var(--c1)', align: 'center', fw: 700, lh: 1.2, ls: -0.02, ...st });

function emblemEls(fmt) {
  if (fmt === 'circle') {
    return [
      IM(SYMBOL, 270, 105, 460, 460 * SYMBOL_RATIO),
      emblemText(100, 618, 800, '한국폴리텍대학 서울강서캠퍼스', { fs: 44 }),
      emblemText(100, 682, 800, 'AI핀테크융합과', { fs: 112, fw: 800, ls: -0.03 }),
    ];
  }
  if (fmt === 'wide') {
    return [
      IM(SYMBOL, 80, 75, 735, 735 * SYMBOL_RATIO),
      emblemText(890, 120, 1160, '한국폴리텍대학', { fs: 172, fw: 800, align: 'left', lh: 1.15 }),
      emblemText(890, 352, 1160, '서울강서캠퍼스', { fs: 150, fw: 700, align: 'left', lh: 1.15 }),
      emblemText(890, 560, 1160, 'AI핀테크융합과', { fs: 172, fw: 800, align: 'left', lh: 1.15 }),
    ];
  }
  return [ // square
    IM(SYMBOL, 215, 40, 570, 570 * SYMBOL_RATIO),
    emblemText(40, 668, 920, '한국폴리텍대학 서울강서캠퍼스', { fs: 56 }),
    emblemText(30, 748, 940, 'AI핀테크융합과', { fs: 142, fw: 800, ls: -0.03 }),
  ];
}

// 심볼 이미지를 실제 비율대로 넣기
async function symbolTool({ page, resolveSrc, loadImg }) {
  const img = await loadImg(resolveSrc(SYMBOL));
  const w = Math.round(Math.min(page.w, page.h) * 0.5);
  return IM(SYMBOL, 0, 0, w, Math.round(w * img.naturalHeight / img.naturalWidth));
}

Editor.start({
  project: 'emblem',
  kind: 'emblem',
  fileName: 'AI핀테크융합과_엠블럼',
  saveLabel: '💾 엠블럼 저장하기',
  resetLabel: '기본 엠블럼 배치로 되돌리기',
  formats: {
    square: { label: '정사각형', w: 1000, h: 1000, suffix: '_정사각형', info: '정사각형 · 1000 × 1000' },
    circle: { label: '원형', w: 1000, h: 1000, round: true, suffix: '_원형', info: '원형 · 1000 × 1000 (바깥은 투명)', page: { bg: '#ffffff' } },
    wide: { label: '가로형', w: 2100, h: 900, suffix: '_가로형', info: '가로형 · 2100 × 900' },
  },
  exports: {
    x1: { label: '기본 PNG', ratio: 1, type: 'png' },
    x2: { label: '고해상도 PNG', ratio: 2, type: 'png' },
    small: { label: '작게 PNG', ratio: (p) => 512 / Math.max(p.w, p.h), type: 'png' },
    jpg: { label: '흰 배경 JPG', ratio: 1, type: 'jpeg' },
  },
  accentLabel: '브랜드 색 (브랜드 색을 쓴 글씨가 모두 바뀜)',
  accents: ['#0b5796', '#0b0c14', '#ffffff', '#2a8fd6', '#d4f53c'],
  bgs: ['transparent', '#ffffff', '#0b5796', '#0b0c14', '#f3f6fa'],
  themeVars: { '--c2': '#f08a24', '--c3': '#8dc21f' },
  colors: [
    ['var(--c1)', '브랜드'], ['var(--c2)', '주황'], ['var(--c3)', '연두'], ['#2a8fd6', '하늘'],
    ['#ffffff', '흰색'], ['#6b7486', '회색'], ['#0b0c14', '검정'],
  ],
  autoImages: {
    [SYMBOL]: { label: '심볼 마크 (투명)', load: () => Studio.emblemSymbol() },
    'logo:auto': { label: '포스터 로고', load: () => Studio.posterLogo() },
  },
  defaultEls: emblemEls,
  pasteText: () => emblemText(0, 0, 600, '', { fs: 56 }),
  toolGroups: { text: '텍스트', mark: '심볼', shape: '도형' },
  tools: {
    dept: { group: 'text', label: '학과명', pv: '<b style="font-size:18px;color:#4f8fd6">학과명</b>', make: () => emblemText(0, 0, 900, 'AI핀테크융합과', { fs: 120, fw: 800, ls: -0.03 }) },
    school: { group: 'text', label: '학교명', pv: '<b style="font-size:13px;color:#4f8fd6">학교 · 캠퍼스</b>', make: () => emblemText(0, 0, 900, '한국폴리텍대학 서울강서캠퍼스', { fs: 52 }) },
    eng: { group: 'text', label: '영문', pv: '<span style="font-size:11px;letter-spacing:.12em;color:#4f8fd6">AI FINTECH</span>', make: () => emblemText(0, 0, 900, 'AI FINTECH CONVERGENCE', { fs: 44, fw: 600, ls: 0.12 }) },
    slogan: { group: 'text', label: '한 줄 문구', pv: '<span style="font-size:12px;color:#c5c8d4">한 줄 문구</span>', make: () => emblemText(0, 0, 800, '금융과 AI를 잇는 개발자', { fs: 40, fw: 500, color: '#6b7486' }) },
    symbol: { group: 'mark', label: '심볼 마크 (투명)', pv: '<span style="font-size:20px">🌀</span>', make: symbolTool },
    disc: { group: 'shape', label: '원 배경', pv: '<i class="shape-pv" style="background:#fff;border-radius:50%;width:26px"></i>', make: ({ page }) => { const d = Math.min(page.w, page.h) * 0.9; return SH('ellipse', 0, 0, d, d, { fill: '#ffffff' }); } },
    ring: { group: 'shape', label: '원형 테두리', pv: '<i class="shape-pv" style="border:2px solid #4f8fd6;border-radius:50%;width:26px"></i>', make: ({ page }) => { const d = Math.min(page.w, page.h) * 0.9; return SH('ellipse', 0, 0, d, d, { stroke: 'var(--c1)', sw: 10 }); } },
    rect: { group: 'shape', label: '둥근 사각형', pv: '<i class="shape-pv" style="background:#fff;border-radius:6px"></i>', make: ({ page }) => SH('rect', 0, 0, page.w * 0.9, page.h * 0.9, { fill: '#ffffff', radius: 60 }) },
    line: { group: 'shape', label: '구분선', pv: '<i class="shape-pv" style="height:3px;margin:12px 0;background:#4f8fd6"></i>', make: () => SH('rect', 0, 0, 600, 6, { fill: 'var(--c1)' }) },
  },
});
