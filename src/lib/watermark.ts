// Client-side watermarking using Canvas.
// Densely tiles "Snappy" + the sender's handle across the whole image so
// screenshots remain attributable.

// 브라우저가 디코드할 수 있는 이미지 형식 (HEIC/HEIF 등 미지원 형식은 여기서 걸러 한글 안내)
const SUPPORTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];

async function decodeImage(file: File): Promise<ImageBitmap> {
  if (file.type && !SUPPORTED.includes(file.type)) {
    throw new Error("지원하지 않는 이미지 형식이에요. JPG·PNG·WebP 사진을 올려주세요. (아이폰 HEIC는 '가장 호환성 높게' 설정으로 찍거나 JPG로 변환해 주세요)");
  }
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("이미지를 읽을 수 없어요. JPG·PNG·WebP 형식의 사진인지 확인해 주세요.");
  }
}

export async function watermarkImage(file: File, senderHandle?: string): Promise<Blob> {
  const bitmap = await decodeImage(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const senderTag = senderHandle ? `@${senderHandle}` : "Snappy";
  const tag = `${senderTag} · Snappy`;

  // tiled diagonal text (연하게)
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 7);
  const fontSize = Math.round(w * 0.032);
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepY = fontSize * 3.6;
  const stepX = Math.max(ctx.measureText(tag).width * 1.8, w * 0.42);
  for (let y = -h; y < h; y += stepY) {
    const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
    for (let x = -w + offset; x < w; x += stepX) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillText(tag, x + 1, y + 1);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillText(tag, x, y);
    }
  }
  ctx.restore();

  // corner badge (연하게)
  const padding = Math.round(w * 0.02);
  const badgeText = senderTag;
  ctx.font = `bold ${Math.round(w * 0.022)}px sans-serif`;
  const metrics = ctx.measureText(badgeText);
  const badgeW = metrics.width + padding * 2;
  const badgeH = Math.round(w * 0.04);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(padding, h - padding - badgeH, badgeW, badgeH);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, padding * 2, h - padding - badgeH / 2);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환에 실패했어요"))), "image/jpeg", 0.82);
  });
}

export async function compressOriginal(file: File, maxDim = 3000, quality = 0.92): Promise<Blob> {
  const bitmap = await decodeImage(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환에 실패했어요"))), "image/jpeg", quality);
  });
}
