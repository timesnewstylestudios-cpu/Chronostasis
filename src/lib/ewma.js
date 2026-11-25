/**
 * Exponentially weighted moving average, oldest sample first.
 * e_0 = x_0; e_t = α x_t + (1 − α) e_{t−1}
 * Returns null for an empty series.
 */
export function ewma(values, alpha = 0.3) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!(alpha > 0 && alpha <= 1)) throw new Error('alpha');
  let estimate = values[0];
  for (let i = 1; i < values.length; i += 1) {
    const x = values[i];
    if (!Number.isFinite(x)) throw new Error('wert');
    estimate = alpha * x + (1 - alpha) * estimate;
  }
  if (!Number.isFinite(values[0])) throw new Error('wert');
  return estimate;
}
