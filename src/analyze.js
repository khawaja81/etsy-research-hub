// Turns raw Etsy API objects into normalized rows and research statistics.
import { toUsd } from './fx.js';

const DAY = 86400000;

const STOPWORDS = new Set(
  `a an and or the for of to in on with by at from as is it this that your you my our its be are
   was were will can not no yes set pcs pc x w/ &amp; amp - | + etc into than then so very new`.split(/\s+/)
);

const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
export function decode(s) {
  if (!s) return '';
  return String(s)
    .replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

const round2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

function cleanUrl(u) {
  if (!u) return null;
  try {
    const url = new URL(u);
    url.search = '';
    return url.toString();
  } catch {
    return u;
  }
}

export function priceOf(l) {
  const p = l?.price;
  if (!p || p.amount == null) return null;
  return p.amount / (p.divisor || 100);
}

export function normalizeListing(l, { rates, taxonomy, rank, withDescription = false } = {}) {
  const price = priceOf(l);
  const currency = l.price?.currency_code || null;
  const ts = l.original_creation_timestamp || l.created_timestamp || l.creation_timestamp;
  const created = ts ? ts * 1000 : null;
  const ageDays = created ? Math.max(1, (Date.now() - created) / DAY) : null;
  const img = Array.isArray(l.images) ? [...l.images].sort((a, b) => (a.rank || 0) - (b.rank || 0))[0] : null;
  const shop = l.shop || null;
  const views = isNum(l.views) ? l.views : null;
  const favorites = isNum(l.num_favorers) ? l.num_favorers : null;
  const cat = taxonomy?.get(l.taxonomy_id);

  const row = {
    id: l.listing_id,
    rank: rank ?? null,
    title: decode(l.title),
    url: cleanUrl(l.url) || `https://www.etsy.com/listing/${l.listing_id}`,
    shop_id: l.shop_id,
    shop_name: shop?.shop_name || null,
    shop_sales: shop?.transaction_sold_count ?? null,
    shop_rating: shop?.review_average ?? null,
    shop_reviews: shop?.review_count ?? null,
    shop_country: shop?.shop_location_country_iso ?? null,
    price: round2(price),
    currency,
    price_usd: round2(toUsd(price, currency, rates)),
    views,
    favorites,
    created: created ? new Date(created).toISOString() : null,
    age_days: ageDays ? Math.round(ageDays) : null,
    views_per_day: views != null && ageDays ? round2(views / ageDays) : null,
    favs_per_day: favorites != null && ageDays ? Math.round((favorites / ageDays) * 1000) / 1000 : null,
    tags: (l.tags || []).map((t) => decode(t).toLowerCase().trim()).filter(Boolean),
    materials: (l.materials || []).map((t) => decode(t).toLowerCase().trim()).filter(Boolean),
    quantity: l.quantity ?? null,
    listing_type: l.listing_type || null,
    is_digital: l.listing_type === 'download',
    is_personalizable: Boolean(l.is_personalizable),
    is_customizable: Boolean(l.is_customizable),
    has_variations: Boolean(l.has_variations),
    who_made: l.who_made || null,
    when_made: l.when_made || null,
    style: l.style || [],
    taxonomy_id: l.taxonomy_id ?? null,
    category: cat?.path || null,
    processing_min: l.processing_min ?? null,
    processing_max: l.processing_max ?? null,
    featured_rank: l.featured_rank ?? null,
    image: img?.url_570xN || img?.url_fullxfull || null,
    thumb: img?.url_170x135 || img?.url_75x75 || img?.url_570xN || null,
  };
  if (withDescription) {
    row.description = decode(l.description || '');
    row.images = (l.images || []).map((i) => i.url_570xN || i.url_fullxfull).filter(Boolean);
    row.updated = l.updated_timestamp ? new Date(l.updated_timestamp * 1000).toISOString() : null;
    row.personalization_instructions = decode(l.personalization_instructions || '');
    row.shop = shop ? normalizeShop(shop) : null;
  }
  return row;
}

export function normalizeShop(s) {
  const created = s.created_timestamp ? s.created_timestamp * 1000 : s.create_date ? s.create_date * 1000 : null;
  const ageDays = created ? Math.max(1, (Date.now() - created) / DAY) : null;
  const sales = s.transaction_sold_count ?? null;
  return {
    id: s.shop_id,
    name: s.shop_name,
    title: decode(s.title || ''),
    url: cleanUrl(s.url) || `https://www.etsy.com/shop/${s.shop_name}`,
    icon: s.icon_url_fullxfull || null,
    banner: s.image_url_760x100 || null,
    announcement: decode(s.announcement || ''),
    sales,
    reviews: s.review_count ?? null,
    rating: s.review_average != null ? Math.round(s.review_average * 100) / 100 : null,
    favorites: s.num_favorers ?? null,
    active_listings: s.listing_active_count ?? null,
    digital_listings: s.digital_listing_count ?? null,
    created: created ? new Date(created).toISOString() : null,
    age_days: ageDays ? Math.round(ageDays) : null,
    sales_per_day: sales != null && ageDays ? round2(sales / ageDays) : null,
    country: s.shop_location_country_iso || s.shipping_from_country_iso || null,
    currency: s.currency_code || null,
    is_vacation: Boolean(s.is_vacation),
    accepts_custom_requests: Boolean(s.accepts_custom_requests),
    languages: s.languages || [],
  };
}

// ---------- statistics ----------

export function stat(values) {
  const v = values.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return { count: 0, min: null, max: null, avg: null, median: null, p25: null, p75: null, sum: 0 };
  const q = (p) => {
    const i = (v.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return v[lo] + (v[hi] - v[lo]) * (i - lo);
  };
  const sum = v.reduce((a, b) => a + b, 0);
  return {
    count: v.length,
    min: round2(v[0]),
    max: round2(v[v.length - 1]),
    avg: round2(sum / v.length),
    median: round2(q(0.5)),
    p25: round2(q(0.25)),
    p75: round2(q(0.75)),
    sum: round2(sum),
  };
}

function niceStep(raw) {
  if (raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * pow;
}

export function priceHistogram(prices, target = 8) {
  const v = prices.filter(isNum).sort((a, b) => a - b);
  if (v.length < 2) return [];
  const p95 = v[Math.floor((v.length - 1) * 0.95)];
  const lo = Math.floor(v[0]);
  const step = niceStep((p95 - lo) / target || 1);
  const start = Math.floor(lo / step) * step;
  const buckets = [];
  for (let from = start; from <= p95 && buckets.length < 14; from += step) {
    buckets.push({ from: round2(from), to: round2(from + step), count: 0 });
  }
  const last = buckets[buckets.length - 1];
  for (const p of v) {
    const b = buckets.find((x) => p >= x.from && p < x.to) || (p >= last.to ? last : buckets[0]);
    b.count += 1;
  }
  last.open = v[v.length - 1] >= last.to; // last bucket also holds the long tail
  return buckets;
}

function frequency(listings, pick, top = 40) {
  const map = new Map();
  for (const l of listings) {
    const seen = new Set(pick(l));
    for (const t of seen) {
      if (!t) continue;
      if (!map.has(t)) map.set(t, { term: t, count: 0, favs: 0, views: 0, n: 0 });
      const e = map.get(t);
      e.count += 1;
      if (isNum(l.favorites)) {
        e.favs += l.favorites;
        e.n += 1;
      }
      if (isNum(l.views)) e.views += l.views;
    }
  }
  const total = listings.length || 1;
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.favs - a.favs)
    .slice(0, top)
    .map((e) => ({
      term: e.term,
      count: e.count,
      pct: Math.round((e.count / total) * 1000) / 10,
      avg_favorites: e.n ? Math.round(e.favs / e.n) : null,
      avg_views: e.count ? Math.round(e.views / e.count) : null,
    }));
}

function titlePhrases(title) {
  return decode(title)
    .toLowerCase()
    .split(/[|,•·/;:()\[\]!?]+|\s[-–—]\s/)
    .map((seg) =>
      seg
        .replace(/[^a-z0-9'&\s-]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^[-']+|[-']+$/g, ''))
        .filter(Boolean)
    )
    .filter((seg) => seg.length);
}

function ngramsOf(title, n) {
  const out = [];
  for (const seg of titlePhrases(title)) {
    for (let i = 0; i + n <= seg.length; i++) {
      const gram = seg.slice(i, i + n);
      if (n === 1 && (STOPWORDS.has(gram[0]) || gram[0].length < 2 || /^\d+$/.test(gram[0]))) continue;
      if (n > 1 && (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[n - 1]))) continue;
      out.push(gram.join(' '));
    }
  }
  return out;
}

function pct(listings, fn) {
  if (!listings.length) return 0;
  return Math.round((listings.filter(fn).length / listings.length) * 1000) / 10;
}

function ageBuckets(listings) {
  const defs = [
    { label: '< 30 days', max: 30 },
    { label: '1–3 months', max: 90 },
    { label: '3–12 months', max: 365 },
    { label: '1–2 years', max: 730 },
    { label: '2+ years', max: Infinity },
  ];
  const b = defs.map((d) => ({ label: d.label, count: 0 }));
  for (const l of listings) {
    if (!isNum(l.age_days)) continue;
    const i = defs.findIndex((d) => l.age_days < d.max);
    b[i].count += 1;
  }
  return b;
}

function topShops(listings, top = 15) {
  const map = new Map();
  for (const l of listings) {
    if (!l.shop_id) continue;
    if (!map.has(l.shop_id)) {
      map.set(l.shop_id, {
        shop_id: l.shop_id,
        shop_name: l.shop_name,
        sales: l.shop_sales,
        rating: l.shop_rating,
        reviews: l.shop_reviews,
        country: l.shop_country,
        listings: 0,
        favorites: 0,
        views: 0,
        best_rank: l.rank,
      });
    }
    const s = map.get(l.shop_id);
    s.listings += 1;
    s.favorites += l.favorites || 0;
    s.views += l.views || 0;
    if (l.rank != null && (s.best_rank == null || l.rank < s.best_rank)) s.best_rank = l.rank;
  }
  return [...map.values()].sort((a, b) => b.listings - a.listings || (b.sales || 0) - (a.sales || 0)).slice(0, top);
}

function topCategories(listings, top = 8) {
  const map = new Map();
  for (const l of listings) {
    const key = l.category || (l.taxonomy_id ? `Category #${l.taxonomy_id}` : null);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const total = listings.length || 1;
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([path, count]) => ({ path, count, pct: Math.round((count / total) * 1000) / 10 }));
}

export function summarize(listings) {
  const useUsd = listings.some((l) => l.price_usd != null);
  const prices = listings.map((l) => (useUsd ? l.price_usd : l.price));
  const currencies = {};
  for (const l of listings) if (l.currency) currencies[l.currency] = (currencies[l.currency] || 0) + 1;

  return {
    sample_size: listings.length,
    price_currency: useUsd ? 'USD' : Object.keys(currencies).sort((a, b) => currencies[b] - currencies[a])[0] || 'USD',
    currencies,
    price: stat(prices),
    views: stat(listings.map((l) => l.views)),
    favorites: stat(listings.map((l) => l.favorites)),
    views_per_day: stat(listings.map((l) => l.views_per_day)),
    favs_per_day: stat(listings.map((l) => l.favs_per_day)),
    age_days: stat(listings.map((l) => l.age_days)),
    histogram: priceHistogram(prices),
    age_buckets: ageBuckets(listings),
    tags: frequency(listings, (l) => l.tags, 50),
    materials: frequency(listings, (l) => l.materials, 20),
    words: frequency(listings, (l) => ngramsOf(l.title, 1), 40),
    phrases2: frequency(listings, (l) => ngramsOf(l.title, 2), 30),
    phrases3: frequency(listings, (l) => ngramsOf(l.title, 3), 25),
    shops: topShops(listings),
    categories: topCategories(listings),
    mix: {
      digital: pct(listings, (l) => l.is_digital),
      personalizable: pct(listings, (l) => l.is_personalizable),
      customizable: pct(listings, (l) => l.is_customizable),
      variations: pct(listings, (l) => l.has_variations),
      handmade: pct(listings, (l) => l.who_made === 'i_did' || l.who_made === 'collective'),
      vintage: pct(listings, (l) => /^(before_|19|200[0-6])/.test(l.when_made || '')),
      avg_tags: listings.length ? Math.round((listings.reduce((a, l) => a + l.tags.length, 0) / listings.length) * 10) / 10 : 0,
      avg_title_length: listings.length
        ? Math.round(listings.reduce((a, l) => a + l.title.length, 0) / listings.length)
        : 0,
    },
  };
}

export function competitionLabel(count) {
  if (count == null) return 'Unknown';
  if (count < 1000) return 'Very low';
  if (count < 10000) return 'Low';
  if (count < 50000) return 'Medium';
  if (count < 200000) return 'High';
  return 'Very high';
}

// Heuristic 0–100 scores. Etsy does not publish search volume, so demand is
// inferred from engagement (favorites, views/day) of the top-ranked listings.
export function keywordScores(totalCount, listings) {
  const top = listings.slice(0, 48);
  const medFav = stat(top.map((l) => l.favorites)).median;
  const medVpd = stat(top.map((l) => l.views_per_day)).median;
  const parts = [];
  if (medFav != null) parts.push(clamp(33 * Math.log10(1 + medFav)));
  if (medVpd != null) parts.push(clamp(33 * Math.log10(1 + medVpd * 10)));
  const demand = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  const competition = Math.round(clamp((Math.log10(Math.max(totalCount || 1, 1)) - 2) * 25));
  const recent = top.filter((l) => isNum(l.age_days) && l.age_days <= 180).length;
  const newShare = top.length ? Math.round((recent / top.length) * 100) : 0;
  const opportunity =
    demand == null
      ? null
      : Math.round(clamp(0.5 * demand + 0.4 * (100 - competition) + 0.1 * Math.min(100, newShare * 2)));
  const label =
    opportunity == null ? 'Unknown' : opportunity >= 70 ? 'Great' : opportunity >= 50 ? 'Good' : opportunity >= 30 ? 'Fair' : 'Tough';
  return {
    demand,
    competition,
    competition_label: competitionLabel(totalCount),
    opportunity,
    opportunity_label: label,
    new_listing_share: newShare,
    top_median_favorites: medFav,
    top_median_views_per_day: medVpd,
  };
}

export function flattenTaxonomy(nodes) {
  const out = [];
  const walk = (list, trail) => {
    for (const n of list || []) {
      const path = [...trail, n.name];
      out.push({ id: n.id, name: n.name, level: n.level, path: path.join(' › ') });
      walk(n.children, path);
    }
  };
  walk(nodes, []);
  return out;
}

export function reviewStats(reviews) {
  const now = Date.now();
  const rows = (reviews || []).map((r) => ({
    listing_id: r.listing_id,
    rating: r.rating,
    text: decode(r.review || ''),
    date: new Date((r.created_timestamp || r.create_timestamp) * 1000).toISOString(),
    ts: (r.created_timestamp || r.create_timestamp) * 1000,
  }));
  const within = (d) => rows.filter((r) => now - r.ts <= d * DAY).length;
  const months = new Map();
  for (const r of rows) {
    const k = r.date.slice(0, 7);
    months.set(k, (months.get(k) || 0) + 1);
  }
  return {
    fetched: rows.length,
    avg_rating: rows.length ? Math.round((rows.reduce((a, r) => a + (r.rating || 0), 0) / rows.length) * 100) / 100 : null,
    last_30_days: within(30),
    last_90_days: within(90),
    last_365_days: within(365),
    by_month: [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count })),
    recent: rows.slice(0, 12).map(({ ts, ...r }) => r),
    per_listing: rows.reduce((m, r) => {
      if (r.listing_id) m[r.listing_id] = (m[r.listing_id] || 0) + 1;
      return m;
    }, {}),
  };
}
