// Shared Listing Builder helpers: policy-check rendering, auto-fix, AI clean-up, market data, saved listings.
import { esc, store } from '../ui.js';
import { EtsyPolicy as P } from './policy.js';
import { ListingGenerator as G } from './generator.js';
import { scoreRing } from '../seo-rules.js';

export { P, G, scoreRing };

export const ETSY_NOTICE =
  'The term “Etsy” is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.';

export const ITEM_TYPES = [
  ['handmade', 'Handmade by me'],
  ['digital', 'Digital download'],
  ['pod', 'Print-on-demand / production partner'],
  ['vintage', 'Vintage (20+ years old)'],
  ['supply-handmade', 'Craft supply (I made it)'],
  ['supply-resell', 'Craft supply (sourced)'],
];

const LEVEL = { error: 'fail', warn: 'warn', info: 'info' };
const ICON = { pass: '✓', warn: '!', fail: '✕', info: 'i' };

export function renderIssues(result) {
  if (!result.issues.length) {
    return `<div class="check-list"><div class="check"><span class="ic pass">✓</span><div><div>No problems found</div><div class="sub">This listing passes every Etsy rule this tool checks.</div></div></div></div>`;
  }
  const order = { error: 0, warn: 1, info: 2 };
  return `<div class="check-list">${result.issues
    .slice()
    .sort((a, b) => order[a.level] - order[b.level])
    .map((i) => {
      const s = LEVEL[i.level];
      return `<div class="check"><span class="ic ${s}">${ICON[s]}</span><div><div>${esc(i.message)}</div><div class="sub">${esc(i.field)}</div></div></div>`;
    })
    .join('')}</div>`;
}

export function scoreLabel(r) {
  return r.errors ? 'Fix the red items before publishing' : r.warns ? 'Almost ready — check the yellow items' : 'Ready to publish';
}

// Turns a /api/keyword response (live Etsy search) into the market data the generator uses.
export function toMarket(data) {
  const s = data?.summary;
  if (!s || !s.sample_size) return { query: data?.query || '', sample_size: 0, total_count: data?.total_count || 0 };
  const top10 = (data.listings || []).filter((l) => l.rank != null && l.rank <= 10);
  return {
    query: data.query,
    params: data.params,
    generated_at: data.generated_at,
    sample_size: s.sample_size,
    total_count: data.total_count,
    currency: s.price_currency,
    scores: data.scores,
    price: s.price,
    mix: s.mix,
    tags: s.tags.map((t) => ({ ...t, in_top10: top10.filter((l) => l.tags.includes(t.term)).length })),
    phrases2: s.phrases2,
    phrases3: s.phrases3,
    words: s.words,
    materials: s.materials,
    categories: s.categories,
    top_listings: [...(data.listings || [])].sort((a, b) => (b.favs_per_day ?? 0) - (a.favs_per_day ?? 0)).slice(0, 8),
  };
}

// Applies every automatic fix; tops tags back up to 13 from the generator when some were removed.
export function autoFix(listing, ctx, input, market) {
  listing.title = P.fixTitle(P.scrubText(listing.title, ctx));
  listing.titles = (listing.titles || []).map((t) => P.fixTitle(P.scrubText(t, ctx)));
  let tags = P.fixTags(listing.tags, ctx);
  if (tags.length < P.LIMITS.tagsMax && input?.productType) tags = P.fixTags(tags.concat(G.generate(input, [], market).listing.tags), ctx);
  listing.tags = tags;
  listing.description = P.scrubText(listing.description, ctx, { sentences: true });
  if (ctx.aiDesign && !/\bAI\b|artificial intelligence/i.test(listing.description)) {
    listing.description += `\n\n✦ ABOUT THIS DESIGN\nThis design was created by ${ctx.shopName || 'our shop'} with the help of AI tools, then edited and finished by us.`;
  }
  listing.materials = (listing.materials || []).map((m) => P.scrubText(m, ctx)).filter(Boolean);
  listing.altTexts = (listing.altTexts || []).map((a) => P.scrubText(a, ctx).slice(0, P.LIMITS.altTextMaxChars));
  return listing;
}

// Cleans an AI answer with the same rules as everything else.
export function normalizeAi(raw, ctx, input, market, history) {
  const offline = G.generate(input, history, market).listing;
  const titles = (raw.titles || []).map((t) => P.fixTitle(P.scrubText(String(t), ctx))).filter(Boolean);
  // over-long AI tags are dropped (not cut) so no half-phrases end up as tags; the generator tops up
  let tags = P.fixTags((raw.tags || []).map(String).filter((t) => t.trim().length <= P.LIMITS.tagMaxChars), ctx);
  if (tags.length < P.LIMITS.tagsMax) tags = P.fixTags(tags.concat(offline.tags), ctx);
  return {
    titles: titles.length ? titles.slice(0, 3) : offline.titles,
    title: titles[0] || offline.title,
    tags,
    description: P.scrubText(String(raw.description || offline.description), ctx, { sentences: true }),
    materials: (raw.materials || []).map((m) => String(m).slice(0, P.LIMITS.materialMaxChars)).slice(0, P.LIMITS.materialsMax),
    altTexts: (raw.alt_texts?.length ? raw.alt_texts : offline.altTexts).map(String).slice(0, 5),
    notes: String(raw.keyword_notes || ''),
    source: 'ai',
  };
}

// Words the seller typed that were left out for policy reasons.
export function droppedTerms(input, ctx) {
  const typed = [input.productType, input.keywords, input.features, input.styles, input.materials].join(', ');
  const hits = P.contentChecks(typed, 'input', ctx).filter((i) => i.level === 'error' && i.fix && i.fix.term);
  return [...new Set(hits.map((i) => i.fix.term))];
}

export const fullText = (l) =>
  `TITLE:\n${l.title}\n\nTAGS:\n${l.tags.join(', ')}\n\nMATERIALS:\n${(l.materials || []).join(', ')}\n\nDESCRIPTION:\n${l.description}`;

// ---------- saved listings (this browser only) ----------
const KEY = 'builder-saved';
export const savedListings = () => store.get(KEY, []);
export function saveListing(item) {
  const list = savedListings();
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.unshift(item);
  store.set(KEY, list.slice(0, 1000));
}
export function deleteListing(id) {
  store.set(KEY, savedListings().filter((x) => x.id !== id));
}
export const historyForUniqueness = () => savedListings().map((s) => ({ id: s.id, title: s.title, description: s.description }));

export function toSaved(id, input, market, listing, ctx) {
  return {
    id,
    date: new Date().toISOString(),
    input,
    keyword: market?.query || '',
    title: listing.title,
    titles: listing.titles,
    tags: listing.tags.slice(),
    description: listing.description,
    materials: (listing.materials || []).slice(),
    altTexts: (listing.altTexts || []).slice(),
    source: listing.source,
    score: P.checkListing(listing, ctx).score,
  };
}
