export interface AttentionBox {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
  label?: string;
  confidence?: number;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromBoxes(boxes: AttentionBox[], w: number, h: number) {
  let seed = 2166136261;
  seed ^= w;
  seed = Math.imul(seed, 16777619);
  seed ^= h;
  seed = Math.imul(seed, 16777619);
  for (const b of boxes) {
    seed ^= Math.floor(clamp01(b.x) * 1000);
    seed = Math.imul(seed, 16777619);
    seed ^= Math.floor(clamp01(b.y) * 1000);
    seed = Math.imul(seed, 16777619);
    seed ^= Math.floor(clamp01(b.w) * 1000);
    seed = Math.imul(seed, 16777619);
    seed ^= Math.floor(clamp01(b.h) * 1000);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function drawIrregularBlotch(params: {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  r: number;
  points?: number;
  jitter?: number;
  fill: string;
  alpha: number;
  rand: () => number;
}) {
  const { ctx, cx, cy, r, fill, alpha, rand } = params;
  const points = params.points ?? 14;
  const jitter = params.jitter ?? 0.35;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const jr = r * (1 + (rand() - 0.5) * 2 * jitter);
    const x = cx + Math.cos(t) * jr;
    const y = cy + Math.sin(t) * jr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

/**
 * Generates a "future" preview image (best-effort), purely client-side.
 * This is intentionally deterministic for hackathon demos.
 */
export async function generateTimeTravelPreview(
  sourceImage: string,
  attentionBoxes?: AttentionBox[],
  opts?: {
    maxWidth?: number;
    maxHeight?: number;
    riskScore?: number; // 0..100
    wetHours?: number;
    dayAhead?: number; // 0..N
  }
): Promise<string> {
  const img = await loadImage(sourceImage);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  const maxWidth = opts?.maxWidth ?? 1400;
  const maxHeight = opts?.maxHeight ?? 1400;

  const scale = Math.min(1, maxWidth / naturalW, maxHeight / naturalH);
  const w = Math.max(1, Math.floor(naturalW * scale));
  const h = Math.max(1, Math.floor(naturalH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Base image
  ctx.drawImage(img, 0, 0, w, h);

  const boxes = (attentionBoxes ?? []).slice(0, 5);
  const seed = seedFromBoxes(boxes, w, h);
  const rand = mulberry32(seed);

  const riskScore = typeof opts?.riskScore === 'number' ? Math.max(0, Math.min(100, opts.riskScore)) : 55;
  const wetHours = typeof opts?.wetHours === 'number' ? Math.max(0, opts.wetHours) : 6;
  const dayAhead = typeof opts?.dayAhead === 'number' ? Math.max(0, opts.dayAhead) : 0;

  const riskFactor = Math.max(0.25, Math.min(1.35, riskScore / 70));
  const wetFactor = Math.max(0.4, Math.min(1.35, wetHours / 10));
  const dayFactor = Math.max(0.6, Math.min(1.6, 1 + dayAhead * 0.2));
  const intensity = Math.min(1.8, riskFactor * wetFactor * dayFactor);

  // Global "stress" tint
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.10 * intensity;
  ctx.fillStyle = 'rgba(120, 78, 30, 1)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Slight vignette / drying edges
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.10 * intensity;
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.min(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(120,80,40,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Apply localized "progression" where the model cared (attention boxes)
  for (const b of boxes) {
    const x = clamp01(b.x) * w;
    const y = clamp01(b.y) * h;
    const bw = clamp01(b.w) * w;
    const bh = clamp01(b.h) * h;

    // yellowing halo (chlorosis)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.20 * intensity;
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = 'rgba(245, 208, 93, 1)';
    ctx.fillRect(x - bw * 0.08, y - bh * 0.08, bw * 1.16, bh * 1.16);
    ctx.restore();

    // soft necrosis wash
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.25 * intensity;
    ctx.fillStyle = 'rgba(95, 52, 22, 1)';
    ctx.filter = 'blur(7px)';
    ctx.fillRect(x, y, bw, bh);
    ctx.restore();

    // lesion expansion blotches (more "future" looking)
    const blotches = Math.round((10 + rand() * 8) * intensity);
    for (let i = 0; i < blotches; i++) {
      const cx = x + rand() * bw;
      const cy = y + rand() * bh;
      const r = (Math.min(bw, bh) * (0.03 + rand() * 0.08)) * Math.min(1.6, intensity);

      // halo ring first
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'blur(4px)';
      drawIrregularBlotch({ ctx, cx, cy, r: r * 1.25, fill: 'rgba(245, 208, 93, 1)', alpha: 0.16 * intensity, rand });
      ctx.restore();

      // dark necrotic core
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.filter = 'blur(1px)';
      drawIrregularBlotch({ ctx, cx, cy, r, fill: 'rgba(35, 20, 10, 1)', alpha: 0.38 * intensity, rand });
      ctx.restore();
    }

    // speckles
    const speckles = Math.round(200 * intensity + 60);
    for (let i = 0; i < speckles; i++) {
      const px = x + rand() * bw;
      const py = y + rand() * bh;
      const r = 0.8 + rand() * 2.8;
      const alpha = (0.14 + rand() * 0.28) * Math.min(1.3, intensity);
      ctx.beginPath();
      ctx.fillStyle = `rgba(30, 18, 10, ${alpha})`;
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // edge darkening to simulate spread
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.22 * intensity;
    ctx.strokeStyle = 'rgba(70, 34, 18, 1)';
    ctx.lineWidth = Math.max(1, Math.round(Math.min(bw, bh) * 0.02));
    ctx.filter = 'blur(2px)';
    ctx.strokeRect(x + 1, y + 1, Math.max(0, bw - 2), Math.max(0, bh - 2));
    ctx.restore();
  }

  // Slight contrast shift (very subtle)
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.08 * intensity;
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.92);
}
