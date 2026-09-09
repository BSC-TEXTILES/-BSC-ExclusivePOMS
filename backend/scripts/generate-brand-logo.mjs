// Brand seal generator for B. S. Channabasappa & Sons (BSC Exclusive).
// Renders the master SVG (frontend/public/bsc-logo.svg) into the PNG assets
// used by the sidebar, landing page, login page and favicon.
//
//   node scripts/generate-brand-logo.mjs
//
// Requires: @resvg/resvg-js (already in package.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SVG_PATH = path.join(ROOT, 'frontend/public/bsc-logo.svg');

const TARGETS = [
  path.join(ROOT, 'frontend/public/bsc-logo.png'),
  path.join(ROOT, 'frontend/public/bsc-official-logo.png'),
];

// Master SVG is written by this script (kept in repo so the design is reviewable).
const svg = buildSvg();
fs.writeFileSync(SVG_PATH, svg);

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 800 },
  shapeRendering: 2,   // geometricPrecision
  textRendering: 1,    // optimizeLegibility
  imageRendering: 0,   // optimizeQuality
  font: {
    fontFiles: ['C:/Windows/Fonts/georgia.ttf', 'C:/Windows/Fonts/georgiab.ttf', 'C:/Windows/Fonts/georgiaz.ttf'],
    loadSystemFonts: false,
  },
});

const png = resvg.render().asPng();
for (const t of TARGETS) fs.writeFileSync(t, png);
console.log(`Logo written: ${png.length} bytes -> ${TARGETS.map(t => path.basename(t)).join(', ')}`);

function buildSvg() {
  // Palette matches app tokens: navy #0b1a2e / #12263f, gold #c89b3c / #e4c45c.
  const navy = '#0d1b2e', navyLight = '#13263d';
  const gold = '#c9a13f', goldLight = '#e7cd7a', goldDark = '#9a7a2e';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="field" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${navyLight}"/>
      <stop offset="60%" stop-color="${navy}"/>
      <stop offset="100%" stop-color="#081220"/>
    </radialGradient>
    <linearGradient id="goldStroke" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${goldLight}"/>
      <stop offset="45%" stop-color="${gold}"/>
      <stop offset="100%" stop-color="${goldDark}"/>
    </linearGradient>
  </defs>

  <!-- Seal field -->
  <circle cx="400" cy="400" r="380" fill="url(#field)"/>
  <circle cx="400" cy="400" r="380" fill="none" stroke="${goldDark}" stroke-width="4"/>

  <!-- Double keyline ring -->
  <circle cx="400" cy="400" r="364" fill="none" stroke="url(#goldStroke)" stroke-width="7"/>
  <circle cx="400" cy="400" r="344" fill="none" stroke="${gold}" stroke-width="2.5" opacity="0.9"/>

  <!-- Company name, top arc (apex baseline y≈200) -->
  <path id="arcTop" d="M 4 480 A 420 420 0 0 1 796 480" fill="none"/>
  <text font-family="Georgia, serif" font-weight="bold" font-size="44" letter-spacing="6" fill="${goldLight}">
    <textPath href="#arcTop" startOffset="50%" text-anchor="middle">B. S. CHANNABASAPPA</textPath>
  </text>

  <!-- Rule with lozenge -->
  <line x1="250" y1="248" x2="356" y2="248" stroke="${gold}" stroke-width="3"/>
  <line x1="444" y1="248" x2="550" y2="248" stroke="${gold}" stroke-width="3"/>
  <rect x="388" y="236" width="24" height="24" transform="rotate(45 400 248)" fill="none" stroke="${gold}" stroke-width="3"/>

  <!-- ESTD -->
  <text x="400" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="38"
        letter-spacing="10" fill="${goldLight}">ESTD 1938</text>

  <!-- Monogram -->
  <text x="400" y="520" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-weight="bold" font-size="200" letter-spacing="6" fill="url(#goldStroke)">BSC</text>

  <text x="400" y="590" text-anchor="middle" font-family="Georgia, serif" font-size="40"
        letter-spacing="14" fill="${goldLight}">&amp; SONS</text>

  <!-- Davanagere, bottom arc (apex baseline y≈660) -->
  <path id="arcBottom" d="M 153 580 A 420 420 0 0 0 647 580" fill="none"/>
  <text font-family="Georgia, serif" font-size="30" letter-spacing="12" fill="${gold}" opacity="0.95">
    <textPath href="#arcBottom" startOffset="50%" text-anchor="middle">DAVANAGERE</textPath>
  </text>
</svg>`;
}
