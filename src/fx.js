// Currency conversion to USD so prices from shops in different countries can be compared.
import { TTLCache, cached } from './cache.js';

const cache = new TTLCache({ max: 5, ttlMs: 12 * 60 * 60 * 1000 });

export async function getUsdRates() {
  try {
    return await cached(cache, 'usd', async () => {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(10000) });
      const body = await res.json();
      if (body.result !== 'success' || !body.rates) throw new Error('bad fx response');
      return body.rates; // 1 USD = rates[CUR]
    });
  } catch {
    return null;
  }
}

export function toUsd(amount, currency, rates) {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (!currency || currency === 'USD') return amount;
  const r = rates?.[currency];
  return r ? amount / r : null;
}
