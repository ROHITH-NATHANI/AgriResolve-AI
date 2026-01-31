export interface LeafCrop {
  dataUrl: string;
  bbox: { x: number; y: number; w: number; h: number };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function expandBBox(
  bbox: { x: number; y: number; w: number; h: number },
  factor: number,
  maxW: number,
  maxH: number
) {
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const w = bbox.w * factor;
  const h = bbox.h * factor;
  const x = clamp(Math.round(cx - w / 2), 0, maxW - 1);
  const y = clamp(Math.round(cy - h / 2), 0, maxH - 1);
  const x2 = clamp(Math.round(cx + w / 2), 0, maxW);
  const y2 = clamp(Math.round(cy + h / 2), 0, maxH);
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) };
}

function rgbToHsv(r: number, g: number, b: number) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function isLikelyLeafPixel(r: number, g: number, b: number): boolean {
  // Leaf pixels can be green OR yellow/brown (disease), so green-only masks fail.
  // Use HSV saturation + hue range to catch common leaf colors while rejecting grayish background.
  const { h, s, v } = rgbToHsv(r, g, b);
  if (v < 0.10) return false; // too dark
  if (s < 0.14) return false; // too gray / background

  // Hue ranges (degrees):
  // - Greens: ~70..170
  // - Yellow: ~35..70
  // - Brown/orange-ish: ~15..35 (still often leaf tissue)
  const inLeafHue = (h >= 15 && h <= 170);
  if (inLeafHue) return true;

  // Fallback: very saturated pixels with mid brightness can still be leaf even if hue drifts.
  if (s >= 0.35 && v >= 0.20) return true;

  return false;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

export async function computeLeafCrops(
  sourceDataUrl: string,
  maxLeaves: number
): Promise<LeafCrop[]> {
  const img = await loadImage(sourceDataUrl);

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) return [];

  // Downscale for segmentation.
  const targetW = Math.min(320, srcW);
  const scale = targetW / srcW;
  const targetH = Math.max(1, Math.round(srcH * scale));

  const segCanvas = document.createElement('canvas');
  segCanvas.width = targetW;
  segCanvas.height = targetH;
  const segCtx = segCanvas.getContext('2d', { willReadFrequently: true });
  if (!segCtx) return [];

  segCtx.drawImage(img, 0, 0, targetW, targetH);
  const { data } = segCtx.getImageData(0, 0, targetW, targetH);

  // Build mask
  const mask = new Uint8Array(targetW * targetH);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      mask[y * targetW + x] = isLikelyLeafPixel(r, g, b) ? 1 : 0;
    }
  }

  // Connected components (4-neighborhood)
  const visited = new Uint8Array(targetW * targetH);
  const components: Array<{ area: number; minX: number; minY: number; maxX: number; maxY: number }> = [];

  const stack: number[] = [];
  const push = (idx: number) => {
    stack.push(idx);
  };

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const idx = y * targetW + x;
      if (!mask[idx] || visited[idx]) continue;

      visited[idx] = 1;
      push(idx);

      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (stack.length) {
        const cur = stack.pop()!;
        area++;
        const cy = Math.floor(cur / targetW);
        const cx = cur - cy * targetW;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          cur - 1,
          cur + 1,
          cur - targetW,
          cur + targetW,
        ];

        for (const n of neighbors) {
          if (n < 0 || n >= targetW * targetH) continue;
          // prevent wrap-around on left/right
          const ny = Math.floor(n / targetW);
          const nx = n - ny * targetW;
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;

          if (!visited[n] && mask[n]) {
            visited[n] = 1;
            push(n);
          }
        }
      }

      // Filter tiny blobs
      const minArea = Math.max(200, Math.round((targetW * targetH) * 0.005));
      if (area >= minArea) {
        components.push({ area, minX, minY, maxX, maxY });
      }
    }
  }

  if (!components.length) return [];

  components.sort((a, b) => b.area - a.area);
  const picked = components.slice(0, Math.max(1, maxLeaves));

  // Crop from original image
  const results: LeafCrop[] = [];
  for (const c of picked) {
    const bboxSmall = {
      x: c.minX,
      y: c.minY,
      w: c.maxX - c.minX + 1,
      h: c.maxY - c.minY + 1,
    };

    const bboxSrc = {
      x: Math.round(bboxSmall.x / scale),
      y: Math.round(bboxSmall.y / scale),
      w: Math.round(bboxSmall.w / scale),
      h: Math.round(bboxSmall.h / scale),
    };

    const expanded = expandBBox(bboxSrc, 1.08, srcW, srcH);

    // Create a small thumbnail canvas (keep aspect)
    const maxThumbW = 320;
    const thumbScale = Math.min(1, maxThumbW / expanded.w);
    const outW = Math.max(1, Math.round(expanded.w * thumbScale));
    const outH = Math.max(1, Math.round(expanded.h * thumbScale));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) continue;

    outCtx.drawImage(
      img,
      expanded.x,
      expanded.y,
      expanded.w,
      expanded.h,
      0,
      0,
      outW,
      outH
    );

    results.push({
      dataUrl: outCanvas.toDataURL('image/jpeg', 0.85),
      bbox: expanded,
    });
  }

  return results;
}
