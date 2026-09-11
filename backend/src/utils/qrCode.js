import QRCode from 'qrcode';

/**
 * Generate a unique QR code SVG for a brand.
 * The QR encodes the brand's unique brand_number (e.g. "BN-WFXV774").
 */
export async function generateBrandQR(brandNumber, brandName) {
  const payload = JSON.stringify({ type: 'brand', id: brandNumber, name: brandName });
  const svg = await QRCode.toString(payload, {
    type: 'svg',
    margin: 2,
    width: 200,
    color: { dark: '#1e293b', light: '#ffffff' },
  });
  return svg;
}
