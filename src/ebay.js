// eBay Browse API client (OAuth client-credentials token, caching, usage) plus
// normalizers and research statistics for eBay search results.
import { TTLCache, cached } from './cache.js';
import { stat, priceHistogram, frequency, ngramsOf, decode } from './analyze.js';

const SANDBOX = /^sandbox$/i.test(process.env.EBAY_ENV || '');
const API = SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const DEFAULT_TTL = (Number(process.env.CACHE_TTL_MINUTES) || 60) * 60 * 1000;
const DAY = 86400000;

export const MARKETPLACES = {
  EBAY_US: { label: 'eBay.com (US)', currency: 'USD', domain: 'www.ebay.com' },
  EBAY_GB: { label: 'eBay.co.uk (UK)', currency: 'GBP', domain: 'www.ebay.co.uk' },
  EBAY_DE: { label: 'eBay.de (Germany)', currency: 'EUR', domain: 'www.ebay.de' },
  EBAY_AU: { label: 'eBay.com.au (Australia)', currency: 'AUD', domain: 'www.ebay.com.au' },
  EBAY_CA: { label: 'eBay.ca (Canada)', currency: 'CAD', domain: 'www.ebay.ca' },
  EBAY_FR: { label: 'eBay.fr (France)', currency: 'EUR', domain: 'www.ebay.fr' },
  EBAY_IT: { label: 'eBay.it (Italy)', currency: 'EUR', domain: 'www.ebay.it' },
  EBAY_ES: { label: 'eBay.es (Spain)', currency: 'EUR', domain: 'www.ebay.es' },
};
export const DEFAULT_MARKETPLACE = MARKETPLACES[process.env.EBAY_MARKETPLACE] ? process.env.EBAY_MARKETPLACE : 'EBAY_US';
export const marketplaceOf = (m) => (MARKETPLACES[m] ? m : DEFAULT_MARKETPLACE);

const cache = new TTLCache({ max: 800, ttlMs: DEFAULT_TTL });

export class EbayError extends Error {
  constructor(message, status = 500, code = 'EBAY_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function credentials() {
  const id = (process.env.EBAY_CLIENT_ID || '').trim();
  const secret = (process.env.EBAY_CLIENT_SECRET || '').trim();
  return id && secret ? { id, secret } : null;
}

export function isConfigured() {
  return Boolean(credentials());
}

const today = () => new Date().toISOString().slice(0, 10);
const usage = { day: today(), calls: 0, cacheHits: 0, lastError: null };
function rollDay() {
  if (usage.day !== today()) {
    usage.day = today();
    usage.calls = 0;
    usage.cacheHits = 0;
  }
}

export function getStatus() {
  rollDay();
  return {
    configured: isConfigured(),
    environment: SANDBOX ? 'sandbox' : 'production',
    marketplace: DEFAULT_MARKETPLACE,
    calls: usage.calls,
    cacheHits: usage.cacheHits,
    lastError: usage.lastError,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- auth ----------

let token = null; // { value, expires }
let tokenPending = null;

async function getToken(force = false) {
  const creds = credentials();
  if (!creds) {
    throw new EbayError('eBay API keys are not configured. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.', 503, 'EBAY_NOT_CONFIGURED');
  }
  if (!force && token && token.expires > Date.now()) return token.value;
  if (tokenPending) return tokenPending;
  tokenPending = (async () => {
    try {
      const res = await fetch(`${API}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          authorization: 'Basic ' + Buffer.from(`${creds.id}:${creds.secret}`).toString('base64'),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
        signal: AbortSignal.timeout(20000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.access_token) {
        const msg = body.error_description || body.error || `eBay auth failed (${res.status})`;
        usage.lastError = `${res.status}: ${msg}`;
        throw new EbayError(`eBay rejected the API keys: ${msg}`, res.status >= 500 ? 502 : 401, 'EBAY_AUTH');
      }
      token = { value: body.access_token, expires: Date.now() + (Number(body.expires_in) || 7200) * 1000 - 120000 };
      return token.value;
    } catch (err) {
      if (err instanceof EbayError) throw err;
      throw new EbayError(`Could not reach eBay (${err.message})`, 502, 'NETWORK');
    } finally {
      tokenPending = null;
    }
  })();
  return tokenPending;
}

// ---------- requests ----------

function buildUrl(path, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function rawRequest(url, marketplace, attempt = 0) {
  const bearer = await getToken();
  rollDay();
  usage.calls += 1;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        authorization: `Bearer ${bearer}`,
        accept: 'application/json',
        'x-ebay-c-marketplace-id': marketplace,
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    if (attempt < 2) {
      await sleep(800 * (attempt + 1));
      return rawRequest(url, marketplace, attempt + 1);
    }
    usage.lastError = `Network error: ${err.message}`;
    throw new EbayError(`Could not reach eBay API (${err.message})`, 502, 'NETWORK');
  }

  // expired/revoked token: fetch a fresh one once
  if (res.status === 401 && attempt === 0) {
    token = null;
    return rawRequest(url, marketplace, attempt + 1);
  }
  if (res.status === 429 && attempt < 3) {
    await sleep(1500 * (attempt + 1));
    return rawRequest(url, marketplace, attempt + 1);
  }
  if (res.status >= 500 && attempt < 2) {
    await sleep(1000 * (attempt + 1));
    return rawRequest(url, marketplace, attempt + 1);
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { errors: [{ message: text.slice(0, 300) }] };
  }

  if (!res.ok) {
    const first = body?.errors?.[0] || {};
    const msg = first.longMessage || first.message || `eBay API error ${res.status}`;
    usage.lastError = `${res.status}: ${msg}`;
    const code =
      res.status === 401 || res.status === 403
        ? 'EBAY_AUTH'
        : res.status === 404
        ? 'NOT_FOUND'
        : res.status === 429
        ? 'RATE_LIMIT'
        : 'EBAY_ERROR';
    const err = new EbayError(msg, res.status, code);
    err.ebayErrorId = first.errorId;
    throw err;
  }
  usage.lastError = null;
  return body;
}

async function request(path, params, marketplace = DEFAULT_MARKETPLACE, ttlMs = DEFAULT_TTL) {
  const url = buildUrl(path, params);
  const key = `${marketplace} ${url}`;
  if (cache.get(key) !== undefined) {
    rollDay();
    usage.cacheHits += 1;
  }
  return cached(cache, key, () => rawRequest(url, marketplace), ttlMs);
}

// ---------- endpoints ----------

export function ping() {
  return getToken(true);
}

const SORTS = { best: undefined, price: 'price', '-price': '-price', newly: 'newlyListed', ending: 'endingSoonest' };

export function buildFilter({ min_price, max_price, currency, buying, condition, seller, location } = {}) {
  const f = [];
  if (min_price != null || max_price != null) {
    f.push(`price:[${min_price ?? ''}..${max_price ?? ''}]`, `priceCurrency:${currency}`);
  }
  if (buying === 'FIXED_PRICE' || buying === 'AUCTION' || buying === 'BEST_OFFER') f.push(`buyingOptions:{${buying}}`);
  if (condition === 'NEW' || condition === 'USED') f.push(`conditions:{${condition}}`);
  if (seller) f.push(`sellers:{${seller}}`);
  if (location) f.push(`itemLocationCountry:${location}`);
  return f.join(',') || undefined;
}

export function searchItems({ q, limit = 200, offset = 0, sort = 'best', filter, category_ids, marketplace = DEFAULT_MARKETPLACE }) {
  return request(
    '/buy/browse/v1/item_summary/search',
    {
      q,
      limit,
      offset,
      sort: SORTS[sort],
      filter,
      category_ids,
      fieldgroups: 'MATCHING_ITEMS,CATEGORY_REFINEMENTS,CONDITION_REFINEMENTS,BUYING_OPTION_REFINEMENTS',
    },
    marketplace
  );
}

// Full item records (up to 20 per call) — used for estimated sold quantities.
export async function getItemsBatch(itemIds, marketplace = DEFAULT_MARKETPLACE) {
  const out = [];
  for (let i = 0; i < itemIds.length; i += 20) {
    const chunk = itemIds.slice(i, i + 20);
    const body = await request('/buy/browse/v1/item/', { item_ids: chunk.join(',') }, marketplace);
    out.push(...(body.items || []));
  }
  return out;
}

export async function getItemByLegacyId(legacyId, marketplace = DEFAULT_MARKETPLACE) {
  try {
    return await request('/buy/browse/v1/item/get_item_by_legacy_id', { legacy_item_id: legacyId }, marketplace);
  } catch (err) {
    // Multi-variation listings must be fetched as an item group.
    if (err.status === 400 || err.ebayErrorId === 11006) {
      const group = await request('/buy/browse/v1/item/get_items_by_item_group', { item_group_id: legacyId }, marketplace);
      const items = group.items || [];
      if (!items.length) throw err;
      return { ...items[0], variation_count: items.length, variations: items };
    }
    throw err;
  }
}

// ---------- normalize & analyze ----------

const round2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const numOf = (m) => (m && m.value != null && Number.isFinite(Number(m.value)) ? Number(m.value) : null);

function shippingOf(it) {
  const opts = it.shippingOptions || [];
  if (!opts.length) return { cost: null, free: null };
  const costs = opts.map((o) => numOf(o.shippingCost)).filter((n) => n != null);
  const cost = costs.length ? Math.min(...costs) : null;
  return { cost, free: cost === 0 || opts.some((o) => o.shippingCostType === 'FREE') };
}

function soldOf(it) {
  const a = (it.estimatedAvailabilities || [])[0];
  return {
    sold: a?.estimatedSoldQuantity ?? null,
    available: a?.estimatedAvailableQuantity ?? a?.estimatedRemainingQuantity ?? null,
  };
}

export function normalizeItem(it, { rank } = {}) {
  const created = it.itemCreationDate ? Date.parse(it.itemCreationDate) : null;
  const ageDays = created ? Math.max(1, (Date.now() - created) / DAY) : null;
  const price = numOf(it.price) ?? numOf(it.currentBidPrice);
  const ship = shippingOf(it);
  const { sold, available } = soldOf(it);
  const opts = it.buyingOptions || [];
  return {
    id: it.itemId,
    legacy_id: it.legacyItemId || (String(it.itemId || '').split('|')[1] ?? null),
    rank: rank ?? null,
    title: decode(it.title || ''),
    url: it.itemWebUrl ? it.itemWebUrl.split('?')[0] : null,
    price: round2(price),
    currency: it.price?.currency || it.currentBidPrice?.currency || null,
    original_price: round2(numOf(it.marketingPrice?.originalPrice)),
    discount_pct: it.marketingPrice?.discountPercentage != null ? Number(it.marketingPrice.discountPercentage) : null,
    shipping: round2(ship.cost),
    free_shipping: ship.free,
    total_price: price != null && ship.cost != null ? round2(price + ship.cost) : round2(price),
    condition: it.condition || null,
    condition_id: it.conditionId || null,
    is_new: it.conditionId ? Number(it.conditionId) < 2000 : null, // 1000–1750 are the "new" condition ids
    buying_options: opts,
    format: opts.includes('AUCTION') ? 'Auction' : 'Buy It Now',
    best_offer: opts.includes('BEST_OFFER'),
    bids: it.bidCount ?? null,
    end_date: it.itemEndDate || null,
    seller: it.seller?.username || null,
    seller_feedback: it.seller?.feedbackScore ?? null,
    seller_positive: it.seller?.feedbackPercentage != null ? Number(it.seller.feedbackPercentage) : null,
    top_rated: Boolean(it.topRatedBuyingExperience),
    location: it.itemLocation?.country || null,
    category: it.categories?.[0]?.categoryName || null,
    category_id: it.categories?.[0]?.categoryId || it.categoryId || null,
    created: created ? new Date(created).toISOString() : null,
    age_days: ageDays ? Math.round(ageDays) : null,
    sold,
    available,
    sold_per_day: sold != null && ageDays ? round2(sold / ageDays) : null,
    image: it.image?.imageUrl || it.thumbnailImages?.[0]?.imageUrl || null,
    thumb: it.thumbnailImages?.[0]?.imageUrl || it.image?.imageUrl || null,
  };
}

function share(rows, fn) {
  if (!rows.length) return 0;
  return Math.round((rows.filter(fn).length / rows.length) * 1000) / 10;
}

function topSellers(rows, top = 15) {
  const map = new Map();
  for (const r of rows) {
    if (!r.seller) continue;
    if (!map.has(r.seller)) {
      map.set(r.seller, { seller: r.seller, feedback: r.seller_feedback, positive: r.seller_positive, listings: 0, sold: 0, best_rank: r.rank });
    }
    const s = map.get(r.seller);
    s.listings += 1;
    s.sold += r.sold || 0;
    if (r.rank != null && (s.best_rank == null || r.rank < s.best_rank)) s.best_rank = r.rank;
  }
  return [...map.values()].sort((a, b) => b.listings - a.listings || b.sold - a.sold).slice(0, top);
}

function countBy(rows, pick, top = 10) {
  const map = new Map();
  for (const r of rows) {
    const k = pick(r);
    if (k) map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([label, count]) => ({ label, count }));
}

export function summarizeItems(rows, refinement = {}) {
  const currencies = {};
  for (const r of rows) if (r.currency) currencies[r.currency] = (currencies[r.currency] || 0) + 1;
  const currency = Object.keys(currencies).sort((a, b) => currencies[b] - currencies[a])[0] || 'USD';
  const same = rows.filter((r) => r.currency === currency);
  const prices = same.map((r) => r.price);
  const withSold = rows.filter((r) => r.sold != null);
  return {
    sample_size: rows.length,
    price_currency: currency,
    price: stat(prices),
    total_price: stat(same.map((r) => r.total_price)),
    histogram: priceHistogram(prices),
    sold: {
      checked: withSold.length,
      total: withSold.reduce((a, r) => a + r.sold, 0),
      median: stat(withSold.map((r) => r.sold)).median,
      selling_share: share(withSold, (r) => r.sold > 0),
      per_day: stat(withSold.map((r) => r.sold_per_day)),
    },
    words: frequency(rows, (r) => ngramsOf(r.title, 1), 40),
    phrases2: frequency(rows, (r) => ngramsOf(r.title, 2), 30),
    phrases3: frequency(rows, (r) => ngramsOf(r.title, 3), 20),
    sellers: topSellers(rows),
    locations: countBy(rows, (r) => r.location),
    conditions: (refinement.conditionDistributions || []).length
      ? refinement.conditionDistributions.map((c) => ({ label: c.condition, count: c.matchCount })).slice(0, 8)
      : countBy(rows, (r) => r.condition, 8),
    categories: (refinement.categoryDistributions || []).length
      ? refinement.categoryDistributions.map((c) => ({ label: c.categoryName, id: c.categoryId, count: c.matchCount })).slice(0, 10)
      : countBy(rows, (r) => r.category, 10),
    buying_options: (refinement.buyingOptionDistributions || []).map((b) => ({ label: b.buyingOption, count: b.matchCount })),
    mix: {
      free_shipping: share(rows, (r) => r.free_shipping),
      auction: share(rows, (r) => r.format === 'Auction'),
      best_offer: share(rows, (r) => r.best_offer),
      top_rated: share(rows, (r) => r.top_rated),
      discounted: share(rows, (r) => r.discount_pct != null),
      avg_title_length: rows.length ? Math.round(rows.reduce((a, r) => a + r.title.length, 0) / rows.length) : 0,
    },
  };
}

const clamp = (n) => Math.max(0, Math.min(100, n));

export function competitionLabel(count) {
  if (count == null) return 'Unknown';
  if (count < 500) return 'Very low';
  if (count < 5000) return 'Low';
  if (count < 25000) return 'Medium';
  if (count < 100000) return 'High';
  return 'Very high';
}

// Heuristic 0–100 scores. Demand comes from eBay's estimated sold quantities
// of the top-ranked items (sell-through), competition from the result count.
export function itemScores(total, rows) {
  const top = rows.slice(0, 60).filter((r) => r.sold != null);
  const medPerDay = stat(top.map((r) => r.sold_per_day)).median;
  const sellShare = top.length ? top.filter((r) => r.sold > 0).length / top.length : null;
  const demand =
    sellShare == null ? null : Math.round(clamp(0.6 * (sellShare * 100) + 0.4 * clamp(40 * Math.log10(1 + (medPerDay || 0) * 20))));
  const competition = Math.round(clamp((Math.log10(Math.max(total || 1, 1)) - 1.5) * 25));
  const opportunity = demand == null ? null : Math.round(clamp(0.6 * demand + 0.4 * (100 - competition)));
  return {
    demand,
    competition,
    competition_label: competitionLabel(total),
    opportunity,
    opportunity_label:
      opportunity == null ? 'Unknown' : opportunity >= 70 ? 'Great' : opportunity >= 50 ? 'Good' : opportunity >= 30 ? 'Fair' : 'Tough',
    sell_through: sellShare == null ? null : Math.round(sellShare * 100),
  };
}

// Plain-text description, aspects and a simple title audit for the item analyzer.
export function itemDetail(it) {
  const row = normalizeItem(it);
  const text = decode(String(it.description || it.shortDescription || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  const aspects = (it.localizedAspects || []).map((a) => ({ name: a.name, value: a.value }));
  const titleLower = row.title.toLowerCase();
  const important = aspects.filter((a) => /^(brand|model|type|size|color|colour|material|style|mpn|department|size type)$/i.test(a.name));
  return {
    ...row,
    subtitle: it.subtitle || null,
    category_path: it.categoryPath || row.category,
    condition_description: it.conditionDescription || null,
    brand: it.brand || null,
    aspects,
    images: [it.image?.imageUrl, ...(it.additionalImages || []).map((i) => i.imageUrl)].filter(Boolean),
    description: text.slice(0, 5000),
    description_length: text.length,
    returns: it.returnTerms
      ? {
          accepted: Boolean(it.returnTerms.returnsAccepted),
          period: it.returnTerms.returnPeriod ? `${it.returnTerms.returnPeriod.value} ${String(it.returnTerms.returnPeriod.unit || '').toLowerCase()}` : null,
          payer: it.returnTerms.returnShippingCostPayer || null,
        }
      : null,
    ship_to: (it.shipToLocations?.regionIncluded || []).map((r) => r.regionName).slice(0, 8),
    handling_days: it.shippingOptions?.[0]?.maxEstimatedDeliveryDate
      ? Math.max(0, Math.round((Date.parse(it.shippingOptions[0].maxEstimatedDeliveryDate) - Date.now()) / DAY))
      : null,
    seller_type: it.seller?.sellerAccountType || null,
    variation_count: it.variation_count || null,
    title_audit: {
      length: row.title.length,
      max: 80,
      missing_aspects: important.filter((a) => a.value && !titleLower.includes(String(a.value).toLowerCase())).map((a) => `${a.name}: ${a.value}`),
      all_caps_words: (row.title.match(/\b[A-Z]{4,}\b/g) || []).length,
    },
  };
}
