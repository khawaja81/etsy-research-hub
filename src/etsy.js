// Etsy Open API v3 client: auth header, throttling, retries, caching and usage tracking.
import { TTLCache, cached } from './cache.js';

const BASE = (process.env.ETSY_API_BASE || 'https://openapi.etsy.com/v3/application').replace(/\/$/, '');
const QPS = Math.max(1, Number(process.env.ETSY_QPS) || 4);
// Etsy API Terms: listing data may be shown at most 6 hours old, so the cache is capped at 360 minutes.
const DEFAULT_TTL = Math.min(360, Number(process.env.CACHE_TTL_MINUTES) || 60) * 60 * 1000;

const cache = new TTLCache({ max: 1500, ttlMs: DEFAULT_TTL });

export class EtsyError extends Error {
  constructor(message, status = 500, code = 'ETSY_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function apiKeyHeader() {
  const key = (process.env.ETSY_API_KEY || '').trim();
  const secret = (process.env.ETSY_SHARED_SECRET || '').trim();
  if (!key) return null;
  if (key.includes(':')) return key; // already "keystring:shared_secret"
  return secret ? `${key}:${secret}` : key;
}

export function isConfigured() {
  return Boolean(apiKeyHeader());
}

const today = () => new Date().toISOString().slice(0, 10);
const usage = {
  day: today(),
  calls: 0,
  cacheHits: 0,
  limitPerDay: null,
  remainingToday: null,
  limitPerSecond: null,
  lastError: null,
};

function rollDay() {
  if (usage.day !== today()) {
    usage.day = today();
    usage.calls = 0;
    usage.cacheHits = 0;
  }
}

export function getUsage() {
  rollDay();
  return { ...usage, qps: QPS, cacheEntries: cache.size };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Simple rate limiter: hands out evenly spaced time slots.
let nextSlot = 0;
async function waitTurn() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + 1000 / QPS;
  if (slot > now) await sleep(slot - now);
}

function buildUrl(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return url.toString();
}

async function rawRequest(url, attempt = 0) {
  const header = apiKeyHeader();
  if (!header) {
    throw new EtsyError(
      'Etsy API key is not configured. Set ETSY_API_KEY and ETSY_SHARED_SECRET.',
      503,
      'NOT_CONFIGURED'
    );
  }
  await waitTurn();
  rollDay();
  usage.calls += 1;

  let res;
  try {
    res = await fetch(url, {
      headers: { 'x-api-key': header, accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    if (attempt < 2) {
      await sleep(800 * (attempt + 1));
      return rawRequest(url, attempt + 1);
    }
    usage.lastError = `Network error: ${err.message}`;
    throw new EtsyError(`Could not reach Etsy API (${err.message})`, 502, 'NETWORK');
  }

  const h = res.headers;
  if (h.get('x-limit-per-day')) usage.limitPerDay = Number(h.get('x-limit-per-day'));
  if (h.get('x-remaining-today')) usage.remainingToday = Number(h.get('x-remaining-today'));
  if (h.get('x-limit-per-second')) usage.limitPerSecond = Number(h.get('x-limit-per-second'));

  if (res.status === 429 && attempt < 3) {
    const wait = Number(h.get('retry-after')) * 1000 || 1200 * (attempt + 1);
    await sleep(Math.min(wait, 10000));
    return rawRequest(url, attempt + 1);
  }
  if (res.status >= 500 && attempt < 2) {
    await sleep(1000 * (attempt + 1));
    return rawRequest(url, attempt + 1);
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text.slice(0, 300) };
  }

  if (!res.ok) {
    const msg = body?.error || body?.message || `Etsy API error ${res.status}`;
    usage.lastError = `${res.status}: ${msg}`;
    const code =
      res.status === 401 || res.status === 403
        ? 'AUTH'
        : res.status === 404
        ? 'NOT_FOUND'
        : res.status === 429
        ? 'RATE_LIMIT'
        : 'ETSY_ERROR';
    throw new EtsyError(msg, res.status, code);
  }
  usage.lastError = null;
  return body;
}

async function request(path, params, ttlMs = DEFAULT_TTL) {
  const url = buildUrl(path, params);
  if (cache.get(url) !== undefined) {
    rollDay();
    usage.cacheHits += 1;
  }
  return cached(cache, url, () => rawRequest(url), ttlMs);
}

// ---------- Endpoints ----------

export function ping() {
  return rawRequest(buildUrl('/openapi-ping'));
}

export function searchListings({
  keywords,
  limit = 100,
  offset = 0,
  sort_on = 'score',
  sort_order = 'desc',
  min_price,
  max_price,
  taxonomy_id,
  shop_location,
} = {}) {
  return request('/listings/active', {
    keywords,
    limit,
    offset,
    sort_on,
    sort_order,
    min_price,
    max_price,
    taxonomy_id,
    shop_location,
  });
}

// Fetches listings by id (max 100 per call) with images and shop attached.
export async function getListingsBatch(ids, includes = ['Images', 'Shop']) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    let body;
    try {
      body = await request('/listings/batch', { listing_ids: chunk, includes });
    } catch (err) {
      if (err.code === 'NOT_CONFIGURED' || err.code === 'AUTH' || err.code === 'RATE_LIMIT') throw err;
      body = await request('/listings/batch', { listing_ids: chunk });
    }
    out.push(...(body.results || []));
  }
  return out;
}

export function getListing(id, includes = ['Images', 'Shop']) {
  return request(`/listings/${encodeURIComponent(id)}`, { includes });
}

export function getListingReviews(id, limit = 100) {
  return request(`/listings/${encodeURIComponent(id)}/reviews`, { limit });
}

export function findShops(name, limit = 25) {
  return request('/shops', { shop_name: name, limit });
}

export function getShop(id) {
  return request(`/shops/${encodeURIComponent(id)}`);
}

export function getShopListings(shopId, { limit = 100, offset = 0, sort_on = 'created', sort_order = 'desc' } = {}) {
  return request(`/shops/${encodeURIComponent(shopId)}/listings/active`, { limit, offset, sort_on, sort_order });
}

export function getShopReviews(shopId, limit = 100) {
  return request(`/shops/${encodeURIComponent(shopId)}/reviews`, { limit });
}

export function getSellerTaxonomy() {
  return request('/seller-taxonomy/nodes', {}, 24 * 60 * 60 * 1000);
}
