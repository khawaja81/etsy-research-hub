// Keyword idea sources. Etsy's own autocomplete is bot-protected, so we combine
// Google (plain + "etsy ..." buyer-intent) and Amazon marketplace autocomplete.
import { TTLCache, cached } from './cache.js';

const cache = new TTLCache({ max: 3000, ttlMs: 24 * 60 * 60 * 1000 });
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/json,text/javascript,*/*' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Google sometimes answers in latin1 for the firefox client
  let text = buf.toString('utf8');
  if (text.includes('�')) text = buf.toString('latin1');
  return JSON.parse(text);
}

async function google(q, gl = 'us') {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=${gl}&q=${encodeURIComponent(q)}`;
  return cached(cache, 'g:' + gl + ':' + q, async () => {
    try {
      const body = await getJson(url);
      return Array.isArray(body?.[1]) ? body[1].map(String) : [];
    } catch {
      return [];
    }
  });
}

async function amazon(q) {
  const url = `https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&alias=aps&prefix=${encodeURIComponent(q)}`;
  return cached(cache, 'a:' + q, async () => {
    try {
      const body = await getJson(url);
      return (body?.suggestions || []).map((s) => String(s.value || '')).filter(Boolean);
    } catch {
      return [];
    }
  });
}

async function googleEtsy(q, gl) {
  const list = await google(`etsy ${q}`, gl);
  return list
    .map((s) => s.replace(/^etsy\s+/i, '').trim())
    .filter((s) => s && !/^etsy\b/i.test(s));
}

export const MODIFIERS = [
  'personalized', 'custom', 'handmade', 'gift', 'gift for her', 'gift for him', 'for mom', 'for dad',
  'for women', 'for men', 'for kids', 'for baby', 'wedding', 'birthday', 'christmas', 'vintage',
  'minimalist', 'boho', 'aesthetic', 'set', 'digital', 'printable', 'svg', 'large', 'small', 'cute',
  'funny', 'unique', 'gold', 'silver',
];

// Runs async tasks with limited concurrency.
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export async function suggest(seed, { expand = 'none', gl = 'us' } = {}) {
  seed = norm(seed);
  if (!seed) return { seed, results: [] };

  const map = new Map();
  const add = (kw, source) => {
    const k = norm(kw);
    if (!k || k.length > 80) return;
    if (!map.has(k)) map.set(k, { keyword: k, sources: new Set(), hits: 0 });
    const e = map.get(k);
    e.sources.add(source);
    e.hits += 1;
  };

  const queries = [seed];
  if (expand === 'alphabet') {
    for (const c of 'abcdefghijklmnopqrstuvwxyz') queries.push(`${seed} ${c}`);
  } else if (expand === 'modifiers') {
    for (const m of MODIFIERS) queries.push(`${seed} ${m}`);
  } else if (expand === 'questions') {
    for (const m of ['best', 'cheap', 'unique', 'how to', 'ideas', 'for', 'with', 'without', 'vs']) {
      queries.push(m === 'for' || m === 'with' || m === 'without' || m === 'vs' ? `${seed} ${m}` : `${m} ${seed}`);
    }
  }

  await pool(queries, 6, async (q, idx) => {
    const tasks = [google(q, gl), googleEtsy(q, gl)];
    // Amazon for the seed and modifier queries only (keeps it fast)
    if (idx === 0 || expand !== 'alphabet') tasks.push(amazon(q));
    const [g, ge, a = []] = await Promise.all(tasks);
    g.forEach((s) => add(s, 'google'));
    ge.forEach((s) => add(s, 'etsy-intent'));
    a.forEach((s) => add(s, 'amazon'));
  });

  const seedWords = seed.split(' ').filter((w) => w.length > 2);
  const results = [...map.values()]
    .map((e) => ({
      keyword: e.keyword,
      sources: [...e.sources],
      hits: e.hits,
      words: e.keyword.split(' ').length,
      relevant: seedWords.every((w) => e.keyword.includes(w.replace(/s$/, ''))),
    }))
    .sort((a, b) => b.sources.length - a.sources.length || b.hits - a.hits || a.keyword.localeCompare(b.keyword));

  return { seed, expand, results };
}
