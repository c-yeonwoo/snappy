// AI 보정 (현재: 클라이언트 auto-enhance = mock). 추후 서버 AI API로 교체 예정.
// 입력 이미지 URL을 받아 보정본 Blob을 반환한다.

export type EnhanceStyle = "natural" | "bright" | "film";

const PRESETS: Record<EnhanceStyle, { brightness: number; contrast: number; saturation: number; warmth: number }> = {
  // 내 스타일 학습 전 기본 프리셋. (값은 1.0 기준 배율 / warmth는 R-B 가산)
  natural: { brightness: 1.04, contrast: 1.08, saturation: 1.1, warmth: 4 },
  bright: { brightness: 1.12, contrast: 1.05, saturation: 1.14, warmth: 2 },
  film: { brightness: 1.02, contrast: 1.14, saturation: 0.96, warmth: 10 },
};

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export async function enhanceImage(srcUrl: string, style: EnhanceStyle = "natural"): Promise<Blob> {
  const res = await fetch(srcUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const maxDim = 2000;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const p = PRESETS[style];
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const cFactor = (259 * (p.contrast * 255 - 0 + 255)) / (255 * (259 - (p.contrast * 255 - 0)));
  // 단순·안정적인 톤 보정: 밝기·대비·채도·웜톤
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    // brightness
    r *= p.brightness; g *= p.brightness; b *= p.brightness;
    // contrast (간단 버전)
    r = (r - 128) * p.contrast + 128;
    g = (g - 128) * p.contrast + 128;
    b = (b - 128) * p.contrast + 128;
    // saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * p.saturation;
    g = gray + (g - gray) * p.saturation;
    b = gray + (b - gray) * p.saturation;
    // warmth (R↑ B↓)
    r += p.warmth; b -= p.warmth;
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
  void cFactor;
  ctx.putImageData(img, 0, 0);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("보정 실패"))), "image/jpeg", 0.92),
  );
}
