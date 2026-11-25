/**
 * Linear interpolation percentile (Hyndman-Fan type 7, the same ranking as NumPy's default).
 * p is a fraction in [0, 1]. Empty input returns null.
 */
export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!(p >= 0 && p <= 1)) throw new Error('p');
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.some((n) => !Number.isFinite(n))) throw new Error('wert');
  if (sorted.length === 1) return sorted[0];
  const rank = (sorted.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const weight = rank - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}
