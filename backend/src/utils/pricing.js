// Server-authoritative commercial engine — FRS §13.1/§13.2, RB-017 (SYS-01).
// The UI may preview results, but every monetary value persisted here is recomputed.

export const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export function computeLineTotals({ purchasePrice, marginPercent, discountType, discountValue, totalQuantity }) {
  const price = round2(purchasePrice);
  if (!(price >= 0)) throw new Error('RB-008: purchase price cannot be negative');

  const marginPercentSafe = Number(marginPercent) || 0;
  const marginAmount = round2(price * (marginPercentSafe / 100));
  const netValuePerUnit = round2(price + marginAmount);            // Net Value = PP + (PP × Margin %)

  let discountAmount = 0;
  if (discountType === 'percent') discountAmount = round2(netValuePerUnit * ((Number(discountValue) || 0) / 100));
  else if (discountType === 'flat') discountAmount = round2(Number(discountValue) || 0);
  if (discountAmount < 0) discountAmount = 0;

  const finalValuePerUnit = round2(netValuePerUnit - discountAmount); // Final = Net − Discount
  const lineTotal = round2(finalValuePerUnit * totalQuantity);        // Line Total = Final × Qty

  return { marginAmount, netValuePerUnit, discountAmount, finalValuePerUnit, lineTotal };
}

// Worked example (§13.3): 650, 40%, 10% disc, 80 qty => 910 / 91 / 819 / 65,520
export function selfTest() {
  const t = computeLineTotals({ purchasePrice: 650, marginPercent: 40, discountType: 'percent', discountValue: 10, totalQuantity: 80 });
  if (t.netValuePerUnit !== 910 || t.discountAmount !== 91 || t.finalValuePerUnit !== 819 || t.lineTotal !== 65520) {
    throw new Error('Pricing engine self-test failed against FRS §13.3 worked example');
  }
  return true;
}
