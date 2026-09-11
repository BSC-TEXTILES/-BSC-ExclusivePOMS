// Fetch brand images from Wikipedia, Wikimedia Commons, and generate placeholders
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/poms',
  max: 5,
});

function generatePlaceholder(brandName) {
  const initials = brandName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#b98a2f', '#1e40af', '#047857', '#be123c', '#7c3aed', '#0369a1', '#c2410c'];
  const color = colors[brandName.length % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="${color}" rx="20"/>
    <text x="100" y="115" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function fetchBrandImage(brandName) {
  try {
    // Try Wikipedia
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(brandName)}`, {
      headers: { 'User-Agent': 'POMS-BrandManager/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.thumbnail?.source) return data.thumbnail.source;
    }
    // Try Wikimedia Commons
    const commonRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(brandName + ' logo')}&srnamespace=6&format=json&srlimit=1`, {
      headers: { 'User-Agent': 'POMS-BrandManager/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (commonRes.ok) {
      const commonData = await commonRes.json();
      const title = commonData.query?.search?.[0]?.title;
      if (title) {
        const thumbRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=200&format=json`, {
          headers: { 'User-Agent': 'POMS-BrandManager/1.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          const pages = thumbData.query?.pages || {};
          const page = Object.values(pages)[0];
          if (page?.imageinfo?.[0]?.thumburl) return page.imageinfo[0].thumburl;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const { rows: brands } = await pool.query(
    `SELECT id, brand_name FROM brands WHERE status = 'active' ORDER BY brand_name`
  );
  console.log(`Processing ${brands.length} brands...`);

  let fetched = 0;
  let placeholders = 0;

  for (const brand of brands) {
    // Check if already has a real URL (not data:image)
    const { rows } = await pool.query(`SELECT image_url FROM brands WHERE id = $1`, [brand.id]);
    if (rows[0]?.image_url && !rows[0].image_url.startsWith('data:')) {
      console.log(`  skip ${brand.brand_name} (already has image)`);
      continue;
    }

    const imageUrl = await fetchBrandImage(brand.brand_name);
    if (imageUrl) {
      await pool.query(`UPDATE brands SET image_url = $1 WHERE id = $2`, [imageUrl, brand.id]);
      fetched++;
      console.log(`  ✓ ${brand.brand_name} → fetched`);
    } else {
      const placeholder = generatePlaceholder(brand.brand_name);
      await pool.query(`UPDATE brands SET image_url = $1 WHERE id = $2`, [placeholder, brand.id]);
      placeholders++;
      console.log(`  ○ ${brand.brand_name} → placeholder`);
    }
  }

  console.log(`\nDone: ${fetched} fetched, ${placeholders} placeholders`);
  await pool.end();
}

main().catch(console.error);
