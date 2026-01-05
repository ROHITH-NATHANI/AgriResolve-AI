import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');

const OG_W = 1200;
const OG_H = 630;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function main() {
  const logoPath = path.join(PUBLIC_DIR, 'logo.svg');
  const outPngPath = path.join(PUBLIC_DIR, 'og-preview.png');

  const logoSvg = await fs.readFile(logoPath, 'utf8');
  const logoB64 = Buffer.from(logoSvg).toString('base64');

  const title = 'AgriResolve AI';
  const subtitle = 'Instant crop health diagnostics\nwith explainable multi-agent analysis';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/> <!-- slate-950 -->
      <stop offset="50%" stop-color="#1e293b"/> <!-- slate-800 -->
      <stop offset="100%" stop-color="#334155"/> <!-- slate-700 -->
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#818cf8" stop-opacity="0.05"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  <rect x="0" y="0" width="100%" height="100%" fill="url(#glow)"/>

  <!-- Decorative Orbs (Cooler tones to contrast with green logo) -->
  <g opacity="0.4">
    <circle cx="1000" cy="100" r="300" fill="#0ea5e9" opacity="0.15" filter="blur(80px)" />
    <circle cx="200" cy="500" r="250" fill="#6366f1" opacity="0.15" filter="blur(60px)" />
  </g>

  <!-- Glass Card Container -->
  <g>
    <rect x="60" y="60" width="1080" height="510" rx="32" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="2" />
    <!-- Inner highlight -->
    <rect x="62" y="62" width="1076" height="506" rx="30" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2" />
  </g>

  <!-- Logo Section (White glow behind logo to make it pop) -->
  <g transform="translate(100, 165)">
    <circle cx="150" cy="150" r="130" fill="rgba(255,255,255,0.08)" />
    <circle cx="150" cy="150" r="100" fill="rgba(255,255,255,0.05)" filter="blur(20px)" />
    <image href="data:image/svg+xml;base64,${logoB64}" x="20" y="20" width="260" height="260" />
  </g>

  <!-- Text Content -->
  <g transform="translate(460, 180)">
    <text x="0" y="60" fill="#ffffff" font-family="Inter, system-ui, sans-serif" font-size="72" font-weight="800" letter-spacing="-1">
      ${escapeHtml(title)}
    </text>
    
    <!-- Subtitle lines -->
    ${subtitle
      .split('\n')
      .map((line, i) => {
        const y = 130 + i * 50;
        return `<text x="0" y="${y}" fill="rgba(255,255,255,0.85)" font-family="Inter, system-ui, sans-serif" font-size="38" font-weight="500">${escapeHtml(line)}</text>`;
      })
      .join('\n')}

    <!-- Call to Action Badge -->
    <g transform="translate(0, 200)">
      <rect x="0" y="0" width="480" height="64" rx="32" fill="#16a34a" />
      <text x="240" y="42" text-anchor="middle" fill="#ffffff" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="700">
        Try it now: agri-resolve-ai.vercel.app
      </text>
    </g>
  </g>

  <!-- Footer Features -->
  <g transform="translate(100, 520)">
    <text x="0" y="0" fill="rgba(255,255,255,0.6)" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="600" letter-spacing="1">
      MULTILINGUAL • AI DIAGNOSTICS • INSTANT RESULTS
    </text>
  </g>
</svg>`;

  await sharp(Buffer.from(svg))
    .png({ quality: 92 })
    .toFile(outPngPath);

  // eslint-disable-next-line no-console
  console.log(`Generated ${path.relative(ROOT, outPngPath)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate og-preview.png', err);
  process.exit(1);
});
