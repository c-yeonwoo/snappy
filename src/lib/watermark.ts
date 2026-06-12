// Client-side watermarking using Canvas.
// Draws a tiled diagonal "SnapBuddy" text plus a corner badge on top of the image.
// Returns a JPEG Blob suitable for upload.
export async function watermarkImage(file: File, label = "SnapBuddy"): Promise<Blob> {
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

  // tiled diagonal text
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.font = `${Math.round(w * 0.06)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const step = w * 0.4;
  for (let y = -h; y < h; y += step) {
    for (let x = -w; x < w; x += step * 1.6) {
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fillText(label, x + 4, y + 4);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillText(label, x, y);
    }
  }
  ctx.restore();

  // corner badge
  const padding = Math.round(w * 0.02);
  const badgeText = `PREVIEW • ${label}`;
  ctx.font = `bold ${Math.round(w * 0.022)}px sans-serif`;
  const metrics = ctx.measureText(badgeText);
  const badgeW = metrics.width + padding * 2;
  const badgeH = Math.round(w * 0.04);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
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