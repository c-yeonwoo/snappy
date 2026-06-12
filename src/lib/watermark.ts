// Client-side watermarking using Canvas.
// Densely tiles "Snappy" + the sender's handle across the whole image so
// screenshots remain attributable.
export async function watermarkImage(file: File, senderHandle?: string): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const tag = senderHandle ? `Snappy · @${senderHandle}` : "Snappy";

  // dense tiled diagonal text
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 7);
  const fontSize = Math.round(w * 0.038);
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepY = fontSize * 2.6;
  const stepX = Math.max(ctx.measureText(tag).width * 1.4, w * 0.32);
  for (let y = -h; y < h; y += stepY) {
    const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
    for (let x = -w + offset; x < w; x += stepX) {
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.fillText(tag, x + 2, y + 2);
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fillText(tag, x, y);
    }
  }
  ctx.restore();

  // bold corner badge
  const padding = Math.round(w * 0.02);
  const badgeText = `PREVIEW · ${tag}`;
  ctx.font = `bold ${Math.round(w * 0.024)}px sans-serif`;
  const metrics = ctx.measureText(badgeText);
  const badgeW = metrics.width + padding * 2;
  const badgeH = Math.round(w * 0.045);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(padding, h - padding - badgeH, badgeW, badgeH);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, padding * 2, h - padding - badgeH / 2);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.82);
  });
}

export async function compressOriginal(file: File, maxDim = 3000, quality = 0.92): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality);
  });
}