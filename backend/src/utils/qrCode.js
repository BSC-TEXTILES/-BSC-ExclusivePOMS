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

/**
 * QR payload for a purchase order. Deliberately compact and non-sensitive:
 * it only carries the PO type + the public PO number + a deep link into the
 * application (never prices, supplier data or internal UUIDs).
 */
export function poQRPayload(poNumber, origin = '') {
  const url = origin
    ? `${origin}/purchase-orders/${poNumber}`
    : `/purchase-orders/${poNumber}`;
  return JSON.stringify({ type: 'po', id: poNumber, url });
}

/**
 * SVG QR code for a purchase order — generated AFTER the PO row is safely
 * saved, so the number it encodes always resolves to a real record. The SVG
 * is stored on the purchase order row (same pattern as brands.qr_code).
 */
export async function generatePOQR(poNumber, origin = '') {
  const svg = await QRCode.toString(poQRPayload(poNumber, origin), {
    type: 'svg',
    margin: 2,
    width: 240,
    color: { dark: '#1e293b', light: '#ffffff' },
  });
  return svg;
}

/**
 * Printable PNG render of the same PO QR code (used by the download action).
 */
export async function generatePOQRPNG(poNumber, origin = '') {
  const buf = await QRCode.toBuffer(poQRPayload(poNumber, origin), {
    type: 'png',
    margin: 2,
    width: 480,
    color: { dark: '#1e293b', light: '#ffffff' },
  });
  return buf;
}
