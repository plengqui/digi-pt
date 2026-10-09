// Generates PNG icons from an inline SVG: pink background, black flexed arm.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'icons');
mkdirSync(out, { recursive: true });

// Dumbbell silhouette, drawn in a 100x100 box.
const ARM = `
  <g fill="#111111">
    <!-- bar -->
    <rect x="22" y="45" width="56" height="10" rx="5"/>
    <!-- inner plates -->
    <rect x="22" y="26" width="12" height="48" rx="4"/>
    <rect x="66" y="26" width="12" height="48" rx="4"/>
    <!-- outer plates -->
    <rect x="10" y="33" width="10" height="34" rx="4"/>
    <rect x="80" y="33" width="10" height="34" rx="4"/>
    <!-- end caps -->
    <rect x="4" y="42" width="5" height="16" rx="2.5"/>
    <rect x="91" y="42" width="5" height="16" rx="2.5"/>
  </g>
`;

function svg(size, { maskable = false, radius = 0.22 } = {}) {
  const pad = maskable ? 0.1 : 0;
  const inner = 1 - 2 * pad;
  const r = maskable ? 0 : size * radius;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffc2e2"/>
        <stop offset="1" stop-color="#f472b6"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
    <g transform="translate(${size * pad}, ${size * pad}) scale(${(size * inner) / 100})">
      <g transform="translate(50 50) rotate(-30) scale(0.86) translate(-50 -50)">${ARM}</g>
    </g>
  </svg>`;
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#f9a8d4"/>
  <g transform="translate(50 50) rotate(-30) scale(0.86) translate(-50 -50)">${ARM}</g>
</svg>`;
writeFileSync(join(out, 'favicon.svg'), favicon);

const jobs = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-512-maskable.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { radius: 0 }],
];
for (const [name, size, opts] of jobs) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(join(out, name));
  console.log('wrote', name);
}
