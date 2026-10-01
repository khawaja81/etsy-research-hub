import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as etsy from './src/etsy.js';
import { EtsyError } from './src/etsy.js';
import * as ebay from './src/ebay.js';
import { EbayError } from './src/ebay.js';
import { mountAuthRoutes, requireLogin, requireAdmin } from './src/auth.js';
import { getUsdRates } from './src/fx.js';
import { suggest, MODIFIERS } from './src/suggest.js';
import { writeListing, isAiConfigured, aiModel, aiProvider, AiError } from './src/listing-ai.js';
import {
  normalizeListing,
  normalizeShop,
  summarize,
  keywordScores,
  flattenTaxonomy,
  reviewStats,
  competitionLabel,
} from './src/analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());
app.use(express.json({ limit: '200kb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Accounts: login / sign up / admin API, then everything else needs a logged-in user.
mountAuthRoutes(app);
app.use(requireLogin);

app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    setHeaders: (res, file) => {
      if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

// ---------- helpers ----------

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    let status = err instanceof EtsyError || err instanceof EbayError || err instanceof AiError ? err.status : 500;
    // An upstream 401 (rejected Etsy/eBay key) must not look like an expired login to the browser.
    if (status === 401) status = 502;
    const code = err.code || 'SERVER_ERROR';
    if (status >= 500 && !/NOT_CONFIGURED$/.test(code)) console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(status).json({ error: err.message || 'Something went wrong', code });
  });

const num = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

let taxonomyMap = null;
async function getTaxonomyMap() {
  if (taxonomyMap) return taxonomyMap;
  try {
    const body = await etsy.getSellerTaxonomy();
    const flat = flattenTaxonomy(body.results || []);
    taxonomyMap = new Map(flat.map((n) => [n.id, n]));
    return taxonomyMap;
  } catch {
    return new Map();
  }
}

function searchParams(q) {
  const sort = ['score', 'created', 'price', 'updated'].includes(q.sort) ? q.sort : 'score';
  return {
    keywords: String(q.q || q.keywords || '').trim().slice(0, 200),
    sort_on: sort,
    sort_order: q.order === 'asc' ? 'asc' : 'desc',
    min_price: num(q.min_price),
    max_price: num(q.max_price),
    taxonomy_id: num(q.taxonomy_id),
    shop_location: q.shop_location ? String(q.shop_location).slice(0, 60) : undefined,
  };
}

async function fetchSearch(params, depth) {
  const pages = Math.max(1, Math.min(3, Math.ceil(depth / 100)));
  let count = 0;
  const raw = [];
  for (let p = 0; p < pages; p++) {
    const body = await etsy.searchListings({ ...params, limit: 100, offset: p * 100 });
    count = body.count ?? count;
    raw.push(...(body.results || []));
    if ((body.results || []).length < 100) break;
  }
  return { count, raw: raw.slice(0, depth) };
}

// Adds images + shop data to search results, keeping the original ranking.
async function enrich(raw, opts = {}) {
  const ids = raw.map((l) => l.listing_id);
  const [detailed, rates, taxonomy] = await Promise.all([
    ids.length ? etsy.getListingsBatch(ids).catch(() => []) : [],
    getUsdRates(),
    getTaxonomyMap(),
  ]);
  const byId = new Map(detailed.map((l) => [l.listing_id, l]));
  return raw.map((l, i) =>
    normalizeListing({ ...l, ...(byId.get(l.listing_id) || {}) }, { rates, taxonomy, rank: i + 1, ...opts })
  );
}

function parseListingId(input) {
  const s = String(input || '').trim();
  const m = s.match(/listing\/(\d+)/) || s.match(/^(\d{5,})$/);
  return m ? m[1] : null;
}

function parseShopName(input) {
  const s = String(input || '').trim();
  const m = s.match(/etsy\.com\/(?:[a-z-]+\/)?shop\/([A-Za-z0-9_-]+)/i) || s.match(/^https?:\/\/([A-Za-z0-9-]+)\.etsy\.com/i);
  return (m ? m[1] : s).replace(/[^A-Za-z0-9_-]/g, '');
}

// ---------- API ----------

app.get(
  '/api/status',
  wrap(async (_req, res) => {
    res.json({ configured: etsy.isConfigured(), usage: etsy.getUsage(), ebay: ebay.getStatus() });
  })
);

app.get(
  '/api/ebay/test-connection',
  requireAdmin,
  wrap(async (_req, res) => {
    await ebay.ping();
    res.json({ ok: true, status: ebay.getStatus() });
  })
);

app.get(
  '/api/test-connection',
  requireAdmin,
  wrap(async (_req, res) => {
    await etsy.ping();
    res.json({ ok: true, usage: etsy.getUsage() });
  })
);

app.get(
  '/api/keyword',
  wrap(async (req, res) => {
    const params = searchParams(req.query);
    if (!params.keywords) return res.status(400).json({ error: 'Enter a keyword', code: 'BAD_REQUEST' });
    const depth = Math.max(25, Math.min(300, num(req.query.depth) || 100));
    const { count, raw } = await fetchSearch(params, depth);
    const listings = await enrich(raw);
    const summary = summarize(listings);
    res.json({
      query: params.keywords,
      params: { ...params, depth },
      total_count: count,
      scores: keywordScores(count, listings),
      summary,
      listings,
      generated_at: new Date().toISOString(),
    });
  })
);

// Lightweight: just the number of active listings for a keyword (competition).
app.get(
  '/api/count',
  wrap(async (req, res) => {
    const params = searchParams(req.query);
    if (!params.keywords) return res.status(400).json({ error: 'Enter a keyword', code: 'BAD_REQUEST' });
    // limit=100 so the call shares cache with keyword analysis / rank checks
    const body = await etsy.searchListings({ ...params, limit: 100, offset: 0 });
    const top = (body.results || []).slice(0, 48);
    const favs = top.map((l) => l.num_favorers).filter((n) => typeof n === 'number').sort((a, b) => a - b);
    res.json({
      keyword: params.keywords,
      count: body.count ?? 0,
      competition: competitionLabel(body.count),
      median_favorites: favs.length ? favs[Math.floor(favs.length / 2)] : null,
    });
  })
);

app.get(
  '/api/suggest',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q) return res.status(400).json({ error: 'Enter a seed keyword', code: 'BAD_REQUEST' });
    const expand = ['none', 'alphabet', 'modifiers', 'questions'].includes(req.query.expand) ? req.query.expand : 'none';
    const gl = /^[a-z]{2}$/i.test(req.query.country || '') ? req.query.country.toLowerCase() : 'us';
    res.json(await suggest(q, { expand, gl }));
  })
);

app.get('/api/modifiers', (_req, res) => res.json({ modifiers: MODIFIERS }));

app.get(
  '/api/listing',
  wrap(async (req, res) => {
    const id = parseListingId(req.query.id || req.query.url);
    if (!id) return res.status(400).json({ error: 'Paste an Etsy listing URL or listing ID', code: 'BAD_REQUEST' });
    const [raw, rates, taxonomy] = await Promise.all([etsy.getListing(id), getUsdRates(), getTaxonomyMap()]);
    const listing = normalizeListing(raw, { rates, taxonomy, withDescription: true });
    let reviews = null;
    try {
      reviews = reviewStats((await etsy.getListingReviews(id)).results || []);
    } catch {
      reviews = null;
    }
    res.json({ listing, reviews });
  })
);

// Where does a listing rank for a keyword (top N results, relevance sort)?
app.get(
  '/api/rank',
  wrap(async (req, res) => {
    const id = Number(parseListingId(req.query.listing_id));
    const params = searchParams(req.query);
    if (!id || !params.keywords) return res.status(400).json({ error: 'listing_id and q are required', code: 'BAD_REQUEST' });
    const depth = Math.max(100, Math.min(300, num(req.query.depth) || 100));
    const { count, raw } = await fetchSearch({ ...params, sort_on: 'score', sort_order: 'desc' }, depth);
    const idx = raw.findIndex((l) => l.listing_id === id);
    res.json({
      keyword: params.keywords,
      count,
      checked: raw.length,
      position: idx >= 0 ? idx + 1 : null,
      page: idx >= 0 ? Math.floor(idx / 48) + 1 : null,
    });
  })
);

app.get(
  '/api/shop',
  wrap(async (req, res) => {
    const input = String(req.query.name || '').trim();
    if (!input) return res.status(400).json({ error: 'Enter a shop name or shop URL', code: 'BAD_REQUEST' });
    let shopRaw;
    if (/^\d+$/.test(input)) {
      shopRaw = await etsy.getShop(input);
    } else {
      const name = parseShopName(input);
      const found = await etsy.findShops(name);
      const list = found.results || [];
      shopRaw = list.find((s) => s.shop_name?.toLowerCase() === name.toLowerCase()) || list[0];
      if (!shopRaw) return res.status(404).json({ error: `No shop found for "${name}"`, code: 'NOT_FOUND' });
    }
    const shop = normalizeShop(shopRaw);
    const depth = Math.max(25, Math.min(300, num(req.query.depth) || 100));
    const sort = ['created', 'price', 'updated', 'score'].includes(req.query.sort) ? req.query.sort : 'created';

    const raw = [];
    for (let offset = 0; offset < depth; offset += 100) {
      const body = await etsy.getShopListings(shop.id, { limit: 100, offset, sort_on: sort });
      raw.push(...(body.results || []));
      if ((body.results || []).length < 100) break;
    }
    const [listings, reviewsRaw] = await Promise.all([
      enrich(raw.slice(0, depth)),
      etsy.getShopReviews(shop.id).catch(() => ({ results: [] })),
    ]);
    const reviews = reviewStats(reviewsRaw.results || []);
    const summary = summarize(listings);
    const medianPrice = summary.price.median;
    shop.est_revenue =
      shop.sales != null && medianPrice != null ? Math.round(shop.sales * medianPrice) : null;
    shop.est_revenue_currency = summary.price_currency;

    const byId = new Map(listings.map((l) => [l.id, l]));
    const best_sellers = Object.entries(reviews.per_listing)
      .map(([id, count]) => ({ id: Number(id), recent_reviews: count, listing: byId.get(Number(id)) || null }))
      .sort((a, b) => b.recent_reviews - a.recent_reviews)
      .slice(0, 12);
    delete reviews.per_listing;

    res.json({ shop, summary, listings, reviews, best_sellers, generated_at: new Date().toISOString() });
  })
);

app.get(
  '/api/categories',
  wrap(async (_req, res) => {
    const map = await getTaxonomyMap();
    if (!map.size) {
      // surface the real reason (e.g. missing key) instead of an empty list
      await etsy.getSellerTaxonomy();
    }
    res.json({ categories: [...map.values()] });
  })
);

// ---------- Listing Builder ----------
// Writes Etsy listings from live Etsy search data (the same read-only analysis as Keyword Research).
// Nothing is posted to Etsy: the seller reviews the result and pastes it in.

app.get('/api/builder/status', (_req, res) => res.json({ etsy: etsy.isConfigured(), ai: isAiConfigured(), provider: aiProvider(), model: aiModel() }));

app.post(
  '/api/builder/generate',
  wrap(async (req, res) => {
    const { input, research, avoid_titles } = req.body || {};
    if (!input || typeof input !== 'object' || !String(input.productType || '').trim()) {
      return res.status(400).json({ error: 'Product type is required', code: 'BAD_REQUEST' });
    }
    if (!isAiConfigured()) {
      return res.status(503).json({ error: 'AI is not set up. Add a free GEMINI_API_KEY (or ANTHROPIC_API_KEY) to the environment.', code: 'AI_NOT_CONFIGURED' });
    }
    // Market data for the prompt: aggregates only (served from cache when the page just loaded it).
    let market = null;
    const params = searchParams(research || {});
    if (params.keywords && etsy.isConfigured()) {
      const depth = Math.max(25, Math.min(300, num(research.depth) || 100));
      const { count, raw } = await fetchSearch(params, depth);
      const listings = await enrich(raw);
      market = { query: params.keywords, total_count: count, summary: summarize(listings), scores: keywordScores(count, listings) };
    }
    const avoid = Array.isArray(avoid_titles) ? avoid_titles.filter((t) => typeof t === 'string') : [];
    const listing = await writeListing(input, market, avoid);
    res.json({ listing, used_market_data: Boolean(market?.summary?.sample_size) });
  })
);

// ---------- eBay ----------

function ebaySearchParams(q) {
  const marketplace = ebay.marketplaceOf(q.marketplace);
  const seller = q.seller ? String(q.seller).trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64) : '';
  return {
    q: String(q.q || '').trim().slice(0, 200),
    marketplace,
    sort: ['best', 'price', '-price', 'newly', 'ending'].includes(q.sort) ? q.sort : 'best',
    category_ids: /^\d+$/.test(q.category_id || '') ? q.category_id : undefined,
    filter: ebay.buildFilter({
      min_price: num(q.min_price),
      max_price: num(q.max_price),
      currency: ebay.MARKETPLACES[marketplace].currency,
      buying: q.buying,
      condition: q.condition,
      seller,
      location: /^[A-Z]{2}$/i.test(q.location || '') ? q.location.toUpperCase() : undefined,
    }),
  };
}

function parseEbayItemId(input) {
  const s = String(input || '').trim();
  const m = s.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,15})/) || s.match(/[?&]item=(\d{9,15})/) || s.match(/^(\d{9,15})$/) || s.match(/^v1\|(\d{9,15})\|/);
  return m ? m[1] : null;
}

// How many top results get a full item lookup (for eBay's estimated sold quantity).
const EBAY_DETAIL_TOP = 60;

app.get(
  '/api/ebay/search',
  wrap(async (req, res) => {
    const params = ebaySearchParams(req.query);
    if (!params.q) return res.status(400).json({ error: 'Enter a keyword', code: 'BAD_REQUEST' });
    const depth = Math.max(50, Math.min(400, num(req.query.depth) || 100));

    let total = 0;
    let refinement = {};
    const raw = [];
    for (let offset = 0; offset < depth; offset += 200) {
      const limit = Math.min(200, depth - offset);
      const body = await ebay.searchItems({ ...params, limit, offset });
      if (offset === 0) {
        total = body.total ?? 0;
        refinement = body.refinement || {};
      }
      raw.push(...(body.itemSummaries || []));
      if ((body.itemSummaries || []).length < limit) break;
    }

    const rows = raw.map((it, i) => ebay.normalizeItem(it, { rank: i + 1 }));
    const detailed = await ebay
      .getItemsBatch(rows.slice(0, EBAY_DETAIL_TOP).map((r) => r.id), params.marketplace)
      .catch(() => []);
    const byId = new Map(detailed.map((it) => [it.itemId, ebay.normalizeItem(it)]));
    for (const r of rows) {
      const d = byId.get(r.id);
      if (d) Object.assign(r, { sold: d.sold, available: d.available, sold_per_day: d.sold_per_day, created: r.created || d.created, age_days: r.age_days ?? d.age_days });
    }

    res.json({
      query: params.q,
      marketplace: params.marketplace,
      marketplace_label: ebay.MARKETPLACES[params.marketplace].label,
      params: { ...req.query, depth },
      total_count: total,
      detail_checked: Math.min(EBAY_DETAIL_TOP, rows.length),
      scores: ebay.itemScores(total, rows),
      summary: ebay.summarizeItems(rows, refinement),
      items: rows,
      generated_at: new Date().toISOString(),
    });
  })
);

app.get(
  '/api/ebay/item',
  wrap(async (req, res) => {
    const id = parseEbayItemId(req.query.id || req.query.url);
    if (!id) return res.status(400).json({ error: 'Paste an eBay item URL or item number', code: 'BAD_REQUEST' });
    const marketplace = ebay.marketplaceOf(req.query.marketplace);
    const raw = await ebay.getItemByLegacyId(id, marketplace);
    const item = ebay.itemDetail(raw);

    // Rough market check: search the item's leading title words and compare prices.
    let market = null;
    try {
      const q = item.title.split(/\s+/).slice(0, 6).join(' ');
      const body = await ebay.searchItems({ q, limit: 100, marketplace });
      const peers = (body.itemSummaries || []).map((it) => ebay.normalizeItem(it)).filter((r) => r.currency === item.currency && r.id !== item.id);
      const prices = peers.map((r) => r.price).filter((n) => n != null).sort((a, b) => a - b);
      const cheaper = item.price != null ? prices.filter((p) => p < item.price).length : null;
      market = {
        query: q,
        total: body.total ?? null,
        compared: prices.length,
        median: prices.length ? prices[Math.floor(prices.length / 2)] : null,
        min: prices[0] ?? null,
        max: prices[prices.length - 1] ?? null,
        percentile: cheaper != null && prices.length ? Math.round((cheaper / prices.length) * 100) : null,
      };
    } catch {
      market = null;
    }
    res.json({ item, market, marketplace, generated_at: new Date().toISOString() });
  })
);

app.get('/api/ebay/marketplaces', (_req, res) =>
  res.json({ default: ebay.DEFAULT_MARKETPLACE, marketplaces: Object.entries(ebay.MARKETPLACES).map(([id, m]) => ({ id, ...m })) })
);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route', code: 'NOT_FOUND' }));

// SPA fallback
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Etsy Research Hub running on http://localhost:${PORT}`);
  if (!etsy.isConfigured()) console.warn('WARNING: ETSY_API_KEY / ETSY_SHARED_SECRET not set — Etsy data features are disabled.');
  if (!ebay.isConfigured()) console.warn('WARNING: EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set — eBay data features are disabled.');
  if (isAiConfigured()) console.log(`Listing Builder AI writer: ${aiModel()}`);
  else console.warn('NOTE: no GEMINI_API_KEY / ANTHROPIC_API_KEY — Listing Builder uses its built-in writer (AI writer off).');
});
