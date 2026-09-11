/**
 * Fetch a brand image from Wikipedia by searching for the brand name.
 * Returns a thumbnail URL or null if not found.
 */
export async function fetchBrandImage(brandName) {
  try {
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(brandName)}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'POMS-BrandManager/1.0 (educational project)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Try search API as fallback
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(brandName)}&format=json&srlimit=1`,
        { headers: { 'User-Agent': 'POMS-BrandManager/1.0' }, signal: AbortSignal.timeout(5000) }
      );
      if (!searchRes.ok) return null;
      const searchData = await searchRes.json();
      const title = searchData.query?.search?.[0]?.title;
      if (!title) return null;
      // Get thumbnail for the found page
      const thumbRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { 'User-Agent': 'POMS-BrandManager/1.0' }, signal: AbortSignal.timeout(5000) }
      );
      if (!thumbRes.ok) return null;
      const thumbData = await thumbRes.json();
      return thumbData.thumbnail?.source || null;
    }
    const data = await res.json();
    return data.thumbnail?.source || null;
  } catch {
    return null;
  }
}
