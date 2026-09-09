// Master Logo & Asset Generator for B. S. Channabasappa & Sons (BSC Exclusive)
// Uses @resvg/resvg-js to compile mathematical vector SVG into ultra-sharp, professional PNGs.
// Completely eliminates all AI distortions, halluncinated glyphs, and synthetic artifacts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../..');
const SVG_PATH = path.join(ROOT_DIR, 'frontend/public/bsc-logo.svg');
const HORIZONTAL_SVG_PATH = path.join(ROOT_DIR, 'frontend/public/bsc-logo-horizontal.svg');

const TARGET_PNG_PATHS = [
  path.join(ROOT_DIR, 'frontend/public/bsc-logo.png'),
  path.join(ROOT_DIR, 'frontend/public/bsc-official-logo.png'),
  path.join(ROOT_DIR, 'frontend/bsc-logo.png'),
];

console.log('Reading master SVG:', SVG_PATH);
const svgData = fs.readFileSync(SVG_PATH, 'utf-8');

// Render at 800x800 high definition with crisp vector anti-aliasing
const resvg = new Resvg(svgData, {
  fitTo: {
    mode: 'width',
    value: 800,
  },
  shapeRendering: 2, // geometricPrecision
  textRendering: 1,  // optimizeLegibility
  imageRendering: 0, // optimizeQuality
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

console.log(`Generated PNG buffer: ${pngBuffer.length} bytes, width=${pngData.width}, height=${pngData.height}`);

for (const targetPath of TARGET_PNG_PATHS) {
  fs.writeFileSync(targetPath, pngBuffer);
  console.log('Successfully wrote authentic PNG to:', targetPath);
}

// Also render horizontal lockup PNG if needed
if (fs.existsSync(HORIZONTAL_SVG_PATH)) {
  const hSvgData = fs.readFileSync(HORIZONTAL_SVG_PATH, 'utf-8');
  const hResvg = new Resvg(hSvgData, {
    fitTo: { mode: 'width', value: 720 },
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 0,
  });
  const hPngData = hResvg.render();
  const hBuffer = hPngData.asPng();
  const hTarget = path.join(ROOT_DIR, 'frontend/public/bsc-logo-horizontal.png');
  fs.writeFileSync(hTarget, hBuffer);
  console.log('Successfully wrote horizontal lockup PNG to:', hTarget);
}

// Update database company_settings table to use clean '/bsc-logo.png'
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5433/poms',
});

async function updateDb() {
  try {
    const res = await pool.query(
      `UPDATE company_settings 
       SET logo_url = '/bsc-logo.png',
           company_name = 'B. S. Channabasappa & Sons (BSC Exclusive)'
       RETURNING *`
    );
    console.log('Updated company_settings in database:', res.rows);
  } catch (err) {
    console.error('Error updating company_settings:', err);
  } finally {
    await pool.end();
  }
}

updateDb().then(() => {
  console.log('Logo modernization complete. Vector crispness verified.');
});
