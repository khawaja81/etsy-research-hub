import {
  $, esc, api, loading, errorBox, tile, fmt, fmtInt, compact, money, pct, barList, dataTable,
  listingColumns, tagsExpand, scoreColor, scoreBadge, saveKeyword, isSaved, pushHistory, toast, copyText, store,
} from '../ui.js';
import { icons } from '../icons.js';
import { seoSection } from '../seo-tiles.js';

// Compliance risk = how much extra labeling / safety / regulation the product usually brings.
// It is our own editorial guidance — rules differ by country, so always check yours. Not legal advice.
const NICHES = [
  { group: 'Jewelry', items: [
    ['Polymer clay earrings', 'polymer clay earrings', 'low', 'Use nickel-free hooks. No “healing” or medical claims.'],
    ['Beaded bracelets', 'beaded bracelet handmade', 'low', 'Avoid claims that stones heal or cure anything.'],
    ['Personalized name necklace', 'personalized name necklace', 'medium', 'Gold/silver wording can be regulated — say exactly what metal and plating you use.'],
    ['Birth flower jewelry', 'birth flower necklace', 'low', 'Pressed or resin pieces: show the real item in photos.'],
    ['Resin jewelry', 'resin jewelry handmade', 'medium', 'Cure fully; mention any allergens; never claim “food safe”.'],
  ] },
  { group: 'Home & candles', items: [
    ['Soy candles', 'soy candle handmade', 'high', 'Safety warnings, burn instructions and fragrance labeling are expected (rules differ by country).'],
    ['Wax melts', 'soy wax melts', 'high', 'Same labeling and safety expectations as candles.'],
    ['Macramé wall hanging', 'macrame wall hanging', 'low', 'Simple to make by hand; stand out with size, color and photos.'],
    ['Ceramic mugs', 'handmade ceramic mug', 'medium', 'Only say “food safe” if your glaze and firing really are. Lead/cadmium rules apply.'],
    ['Resin coasters', 'resin coasters handmade', 'medium', 'Don’t claim heat- or food-safe unless tested.'],
    ['Wooden signs', 'custom wooden sign', 'low', 'No brands, characters or song lyrics.'],
  ] },
  { group: 'Bath & body', items: [
    ['Handmade soap', 'handmade soap', 'high', 'Ingredient labeling and cosmetic rules apply. Never claim it treats skin conditions.'],
    ['Bath bombs', 'bath bombs handmade', 'high', 'Label ingredients and fragrance allergens; no health claims.'],
    ['Lip balm', 'handmade lip balm', 'high', 'Cosmetic regulations and labeling apply in most countries.'],
    ['Body scrub', 'body scrub handmade', 'high', 'Ingredient labels; patch-test warnings; no medical claims.'],
  ] },
  { group: 'Knit, crochet & fabric', items: [
    ['Crochet amigurumi', 'crochet amigurumi', 'medium', 'If it is a toy for children, safety testing and label rules (e.g. CPSIA / EN71) can apply.'],
    ['Knit hats & beanies', 'handmade knit beanie', 'low', 'Always state fiber content.'],
    ['Embroidery hoop art', 'embroidery hoop art', 'low', 'Original patterns only; no logos or characters.'],
    ['Scrunchies', 'handmade scrunchies', 'low', 'Fast to make; very crowded — find a sub-niche.'],
    ['Baby blankets', 'handmade baby blanket', 'medium', 'Baby products can need safety labeling — check your country’s rules.'],
    ['Embroidered tote bags', 'embroidered tote bag', 'low', 'Use your own designs.'],
  ] },
  { group: 'Leather & wood', items: [
    ['Leather keychains', 'leather keychain personalized', 'low', 'State real vs. faux leather honestly.'],
    ['Leather wallets', 'handmade leather wallet', 'low', 'Show stitching and dimensions.'],
    ['Wooden cutting boards', 'wooden cutting board handmade', 'medium', 'Food-contact finishes: say exactly what finish you use.'],
    ['Engraved wood gifts', 'engraved wood gift', 'low', 'Only engrave text the customer owns the rights to.'],
    ['Wooden toys', 'handmade wooden toys', 'high', 'Children’s products carry safety testing and labeling rules.'],
  ] },
  { group: 'Pets & gifts', items: [
    ['Dog bandanas', 'dog bandana handmade', 'low', 'Show size chart; no brand fabrics.'],
    ['Personalized ornaments', 'personalized ornament', 'low', 'No licensed characters or team logos.'],
    ['Pressed flower frames', 'pressed flower frame', 'low', 'Show the real piece; flowers vary — say so.'],
    ['Candle gift sets', 'candle gift set', 'high', 'Candle labeling rules apply to every candle in the set.'],
  ] },
];

const RISK = { low: ['Low compliance risk', 'good'], medium: ['Medium compliance risk', 'warn'], high: ['High compliance risk', 'bad'] };
const riskBadge = (r) => `<span class="badge ${RISK[r][1]}">${RISK[r][0]}</span>`;

const RULES = [
  ['You (or your shop) must make it', 'Etsy’s Creativity Standards: “Made by” means you or a member of your shop made it by hand or with tools you control. Items from a supplier, dropshipping or mass-produced stock don’t qualify as handmade.'],
  ['Disclose production partners', 'If another business helps produce your design, you must add them as a production partner on the listing.'],
  ['Say what it is made of', 'List real materials and sizes. Don’t call something “solid silver”, “leather”, “organic” or “food safe” unless it is.'],
  ['No health or safety claims', 'No “cures”, “heals”, “anti-anxiety”, “antibacterial” or “non-toxic certified” unless you can prove it.'],
  ['Photos must show your actual item', 'Use photos of the real piece. AI or stock images that make the product look different from what ships are against the rules and cause disputes.'],
  ['AI use must be disclosed', 'If AI helped with a design or text, disclose it in the listing and never call AI-assisted work hand-drawn or handmade.'],
  ['Set honest processing times', 'Processing and shipping times in the listing must match what you really do (made-to-order is fine if you say so).'],
];

export async function render(view, ctx) {
  const p = ctx.params;
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Handmade Products</h1>
      <p>Research physical, handmade niches on Etsy: competition, what makers charge, how long they take to ship, winning tags and keyword difficulty — plus the rules and compliance risks of each niche.</p>
    </div></div>
    <form class="card" id="hm-form" autocomplete="off">
      <div class="search-bar">
        <input class="input" name="q" placeholder="e.g. soy candle, crochet bear, leather keychain" value="${esc(p.q || '')}" required>
        <button class="btn" type="submit">${icons.search} Analyze handmade niche</button>
      </div>
      <p class="muted small" style="margin-top:8px">Only listings made by the seller or a shop member (“Made by: I did / collective”) and not digital are counted.</p>
    </form>
    <div id="hm-out" class="stack" style="margin-top:18px"></div>`;

  $('#hm-form', view).addEventListener('submit', (e) => {
    e.preventDefault();
    ctx.go('/handmade', { q: e.target.q.value.trim() });
  });

  const out = $('#hm-out', view);
  if (!p.q) {
    out.innerHTML = nichePicker() + rulesCard();
    return;
  }
  out.innerHTML = loading(`Analyzing handmade listings for “${p.q}”…`);
  try {
    const data = await api('/api/handmade', { q: p.q });
    if (!ctx.alive()) return;
    pushHistory(p.q);
    renderResults(out, data, ctx);
    ctx.refreshStatus();
  } catch (err) {
    if (ctx.alive()) out.innerHTML = errorBox(err);
  }
}

function nichePicker() {
  return `<div class="section-title"><h2>Pick a handmade niche to analyze</h2></div>
    ${NICHES.map((g) => `<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>${esc(g.group)}</h3></div>
      <div class="stack" style="gap:10px">${g.items.map(([name, seed, risk, note]) => `<div class="row" style="gap:12px;align-items:flex-start">
        <div style="min-width:0;flex:1"><a href="#/handmade?q=${encodeURIComponent(seed)}"><b>${esc(name)}</b></a><div class="muted small">${esc(note)}</div></div>${riskBadge(risk)}</div>`).join('')}</div></div>`).join('')}
    <p class="muted small">Compliance labels are our own guidance, not an Etsy rating or legal advice. Rules differ by country — check labeling and safety requirements where you sell.</p>`;
}

function rulesCard(extra = '') {
  return `<div class="card" style="margin-top:6px">
    <div class="card-head"><div><h3>${icons.shield} Etsy rules for handmade items</h3>
    <p>Re-check <a href="https://www.etsy.com/legal/creativity-standards" target="_blank" rel="noopener">Etsy’s Creativity Standards ↗</a> — rules change.</p></div></div>
    ${extra}
    <ol class="stack" style="gap:10px;padding-left:20px;margin:0">${RULES.map(([t, d]) => `<li><b>${esc(t)}.</b> <span class="muted">${esc(d)}</span></li>`).join('')}</ol>
    <div class="row" style="margin-top:14px"><a class="btn secondary sm" href="#/pricing">Price my product</a><a class="btn secondary sm" href="#/policy">Check a listing</a><a class="btn secondary sm" href="#/studio?p=hangtag">Packaging &amp; labels</a></div></div>`;
}

function nicheFor(q) {
  const s = q.toLowerCase();
  for (const g of NICHES) for (const [name, seed, risk, note] of g.items) {
    const words = seed.split(' ').filter((w) => w.length > 3 && w !== 'handmade');
    if (words.length && words.filter((w) => s.includes(w)).length >= Math.min(2, words.length)) return { name, risk, note };
  }
  return null;
}

function verdict(data) {
  const { scores: sc, summary: s, seo, mix } = data;
  if (sc.opportunity == null || !s.sample_size) return { label: 'Not enough data', cls: 'warn', reasons: ['Too few handmade listings found to judge this niche.'] };
  const reasons = [];
  let pts = 0;
  if (sc.opportunity >= 60) { pts += 2; reasons.push(`Opportunity score ${sc.opportunity}/100 is strong.`); }
  else if (sc.opportunity >= 40) { pts += 1; reasons.push(`Opportunity score ${sc.opportunity}/100 is average.`); }
  else reasons.push(`Opportunity score ${sc.opportunity}/100 is low.`);
  if (seo.ease >= 50) { pts += 1; reasons.push(`Ranking is fairly easy (SEO ease ${seo.ease}/100).`); }
  else if (seo.ease < 30) reasons.push(`Hard to rank (SEO ease ${seo.ease}/100) — narrow the keyword.`);
  const med = s.price.median;
  if (med != null && med < 12) reasons.push(`Median price is only ${money(med, s.price_currency)} — handmade time rarely pays at that level. Check it in the pricing tool.`);
  else if (med != null && med >= 25) { pts += 1; reasons.push(`Healthy median price (${money(med, s.price_currency)}) for handmade work.`); }
  if (mix.personalizable >= 40) reasons.push(`${pct(mix.personalizable)} of handmade listings are personalized — customization is expected here.`);
  if (data.handmade_share < 40) {
    reasons.push(mix.digital >= 30
      ? `${pct(mix.digital)} of top results are digital downloads (patterns/files), so only ${pct(data.handmade_share)} are finished handmade items. Search for the finished product (add “handmade” or “ready to ship”) for a clearer picture.`
      : `Only ${pct(data.handmade_share)} of top results are truly handmade — many are resold or mass-produced, which can be an opening for real makers.`);
  }
  const newer = data.listings.filter((l) => l.age_days != null && l.age_days <= 180).length;
  if (data.listings.length && newer / data.listings.length >= 0.25) { pts += 1; reasons.push('New listings are ranking — a new shop can break in.'); }
  const label = pts >= 4 ? 'Promising' : pts >= 2 ? 'Worth testing' : 'Tough — find a sub-niche';
  return { label, cls: pts >= 4 ? 'good' : pts >= 2 ? 'warn' : 'bad', reasons };
}

function renderResults(out, data, ctx) {
  const s = data.summary;
  const sc = data.scores;
  const cur = s.price_currency;
  const q = data.query;
  const n = s.sample_size;
  if (!n) {
    out.innerHTML = `<div class="card empty"><h2>No handmade listings found for “${esc(q)}”</h2>
      <p>Either very little competition, or this search is mostly resold items. Try a broader phrase.</p><p style="margin-top:10px"><a href="#/handmade">← Back to niches</a></p></div>`;
    return;
  }
  const v = verdict(data);
  const niche = nicheFor(q);
  const saved = isSaved(q);
  const top13 = s.tags.slice(0, 13).map((t) => t.term);
  const m = data.mix;

  out.innerHTML = `
    <div class="card">
      <div class="row">
        <div style="min-width:0"><div class="muted small">Handmade niche</div><h2 style="font-size:22px">“${esc(q)}”</h2></div><span class="spacer"></span>
        <button class="btn secondary sm" data-act="save">${saved ? '★ Saved' : '☆ Save keyword'}</button>
        <a class="btn sm" href="#/pricing" data-act="price">Price this product</a>
        <a class="btn secondary sm" href="#/studio?p=hangtag">${icons.brush} Packaging &amp; labels</a>
        <a class="btn secondary sm" href="#/builder">${icons.sparkle} Build listing</a>
        <a class="btn secondary sm" href="https://www.etsy.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">View on Etsy ↗</a>
      </div></div>

    <div class="notice ${v.cls}"><div class="icon">${v.cls === 'good' ? '✅' : v.cls === 'warn' ? '⚠️' : '🛑'}</div><div><h3>${esc(v.label)}</h3>
      <ul style="margin:6px 0 0;padding-left:18px">${v.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="muted small" style="margin-top:8px">A heuristic from public Etsy data — Etsy does not share search volume or sales per listing.</p></div></div>

    <div class="tiles">
      ${tile('Active listings', compact(data.total_count), scoreBadge(sc.competition_label + ' competition', sc.competition, true), { info: `All active Etsy listings for “${q}” (includes resold and digital items).` })}
      ${tile('Opportunity', sc.opportunity != null ? `${sc.opportunity}<span class="muted" style="font-size:14px">/100</span>` : '—', esc(sc.opportunity_label), { meter: sc.opportunity, meterColor: scoreColor(sc.opportunity), info: 'Calculated on the handmade listings only.' })}
      ${tile('Truly handmade', pct(data.handmade_share), `${s.sample_size} handmade of ${data.sample_size} top results`, { info: 'Share of top results made by the seller or a shop member.' })}
      ${tile('Median price', money(s.price.median, cur), `Middle 50%: ${money(s.price.p25, cur)} – ${money(s.price.p75, cur)}`)}
      ${tile('Median processing', data.processing_median_days != null ? `${fmt(data.processing_median_days)} days` : '—', 'time to make before shipping', { info: 'Average of the min and max processing days listed by sellers.' })}
      ${tile('Personalized', pct(m.personalizable), 'of handmade listings', { info: 'Share offering personalization.' })}
    </div>

    ${seoSection(data.seo, n)}

    ${niche ? rulesCard(`<div class="notice ${RISK[niche.risk][1]}" style="margin-bottom:12px"><div class="icon">🧾</div><div><h3>${esc(niche.name)}: ${RISK[niche.risk][0].toLowerCase()}</h3><p>${esc(niche.note)}</p></div></div>`) : rulesCard()}

    <div class="grid grid-2">
      <div class="card"><div class="card-head"><div><h3>Common materials</h3><p>What top handmade sellers list</p></div></div>
        ${barList(s.materials.slice(0, 12).map((t) => ({ label: t.term, value: t.count, tip: `${t.count} of ${n} listings` })), { format: (x) => `${Math.round((x / n) * 100)}%` })}</div>
      <div class="card"><div class="card-head"><div><h3>Title phrases</h3><p>2-word phrases in top handmade titles</p></div></div>
        ${barList(s.phrases2.slice(0, 12).map((t) => ({ label: t.term, value: t.count, tip: `In ${t.count} of ${n} titles` })), { format: (x) => `${Math.round((x / n) * 100)}%` })}</div>
    </div>

    <div class="card"><div class="card-head"><div><h3>Handmade listings</h3><p>Click “tags” to see each listing’s 13 tags</p></div><button class="btn secondary sm" data-act="copy13">Copy top 13 tags</button></div><div id="hm-table"></div></div>
    <p class="muted small">Data: official Etsy Open API v3 · generated ${new Date(data.generated_at).toLocaleString()} · cached for up to 1 hour.</p>`;

  dataTable($('#hm-table', out), { columns: listingColumns(), rows: data.listings, sortKey: 'rank', sortDir: 'asc', filterKeys: ['title', 'shop_name', 'tags'], csvName: `etsy-handmade-${q.replace(/\W+/g, '-')}.csv`, expand: tagsExpand });

  out.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'save') {
      saveKeyword(q, { count: data.total_count, opportunity: sc.opportunity, demand: sc.demand, competition: sc.competition, median_price: s.price.median, currency: cur, median_favorites: s.favorites.median });
      e.target.closest('button').textContent = '★ Saved';
      toast(`Saved “${q}”`);
    } else if (act === 'copy13') copyText(top13.join(', '));
    else if (act === 'price') store.set('maker-pricing', { ...store.get('maker-pricing', {}), name: q, market: s.price.median != null ? String(s.price.median) : '' });
  });
}
