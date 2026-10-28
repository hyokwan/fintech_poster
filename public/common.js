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

  loadImageFile(file) {
    return new Promise((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = fail;
      r.readAsDataURL(file);
    });
  },
};
