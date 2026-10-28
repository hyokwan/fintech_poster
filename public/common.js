// 세 편집기(썸네일/포스터/SNS)가 함께 쓰는 저장 로직
const Studio = {
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

  // 브라우저 다운로드 + 서버 output/<kind>/ 폴더에 동시 저장
  async save(dataUrl, name, kind, statusEl) {
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${name || kind}.${ext}`;
    a.click();
    const kb = Math.round(Studio.bytes(dataUrl) / 1024);
    const status = (msg, cls) => { if (statusEl) { statusEl.textContent = msg; statusEl.className = 'status ' + cls; } };
    try {
      const r = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl, name, kind }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      status(`✅ 저장 완료 (${ext.toUpperCase()} ${kb}KB) → 다운로드 폴더 + ${j.file}`, 'ok');
    } catch (e) {
      status(`다운로드는 완료 (${kb}KB). 서버 저장 실패: ${e.message}`, 'err');
    }
  },

  // 학과 전단지 원본에서 로고 영역을 잘라 dataURL로 반환 (로고 파일이 따로 없어서)
  async posterLogo() {
    const img = await new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = fail;
      im.src = '/api/base-poster';
    });
    const s = img.naturalWidth / 2480; // 원본 2480×3508 기준 좌표
    const [x, y, w, h] = [128, 88, 576, 152].map((v) => Math.round(v * s));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/png');
  },

  // 학과 엠블럼 원본(가로형 JPG)에서 심볼 마크만 투명 배경 PNG로 잘라 dataURL로 반환
  // 원본 3024×1296 기준으로 왼쪽 1160px 안에 심볼이 있고, 그 오른쪽은 글씨
  emblemSymbol() {
    if (Studio._symbol) return Studio._symbol;
    Studio._symbol = (async () => {
      const img = await new Promise((ok, fail) => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = fail;
        im.src = '/baseEmblem/' + encodeURIComponent('AI핀테크융합과.jpeg');
      });
      const cut = Math.round(img.naturalWidth * 1160 / 3024), H = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = cut; c.height = H;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const data = x.getImageData(0, 0, cut, H);
      const d = data.data;
      let minX = cut, minY = H, maxX = 0, maxY = 0;
      for (let i = 0; i < d.length; i += 4) {
        // 흰 배경일수록 투명하게. 진한 부분은 원래 색 그대로 불투명, 가장자리만 흰색을 걷어냄
        const ap = 1 - Math.min(d[i], d[i + 1], d[i + 2]) / 255;
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
      x.putImageData(data, 0, 0);
      const pad = 4;
      const out = document.createElement('canvas');
      out.width = maxX - minX + pad * 2; out.height = maxY - minY + pad * 2;
      out.getContext('2d').drawImage(c, minX - pad, minY - pad, out.width, out.height, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    })();
    return Studio._symbol;
  },

  loadImageFile(file) {
    return new Promise((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = fail;
      r.readAsDataURL(file);
    });
  },
};
