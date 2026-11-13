import {
  $, esc, api, loading, errorBox, tile, fmt, fmtInt, compact, money, pct, barList, dataTable,
  listingColumns, tagsExpand, scoreColor, scoreBadge, saveKeyword, isSaved, pushHistory, toast, copyText,
} from '../ui.js';
import { icons } from '../icons.js';
import { EtsyPolicy } from '../builder/policy.js';

// AI risk is our own editorial judgement of how exposed a niche is under Etsy's Creativity Standards
// (low = you build it yourself, high = commonly AI-generated, saturated and watched closely).
const NICHES = [
  { group: 'Planners & organizers', items: [
    ['Digital planner', 'digital planner goodnotes', 'low', 'Layouts, hyperlinks and tabs are your own work — AI is optional.'],
    ['Budget planner', 'budget planner printable', 'low', 'Structure and formulas are yours; very evergreen.'],
    ['Habit tracker', 'habit tracker printable', 'low', 'Simple designs; stand out with a clear niche (ADHD, students, fitness).'],
    ['Wedding planner', 'wedding planner printable', 'low', 'Seasonal peaks; bundle checklists and timelines.'],
  ] },
  { group: 'Templates', items: [
    ['Canva templates', 'canva template editable', 'low', 'Build in Canva yourself; link goes inside the PDF. Avoid Canva Pro-only elements unless stated.'],
    ['Resume / CV', 'resume template', 'low', 'Steady demand; write the layout and guidance yourself.'],
    ['Social media templates', 'instagram post template canva', 'low', 'Niche them (real estate, coaches, bakers).'],
    ['Notion templates', 'notion template', 'low', 'Your own system design; strong repeat-buyer niche.'],
    ['Invoice / contract', 'invoice template editable', 'medium', 'Do not copy legal wording from others; say "not legal advice".'],
  ] },
  { group: 'Spreadsheets & business', items: [
    ['Google Sheets budget', 'google sheets budget template', 'low', 'Formulas and dashboards are your IP — hardest to copy.'],
    ['Small business tracker', 'small business spreadsheet template', 'low', 'Inventory, bookkeeping, order trackers for Etsy sellers themselves.'],
  ] },
  { group: 'Wall art & printables', items: [
    ['Printable wall art', 'printable wall art', 'high', 'Saturated and often AI. Only enter with real design input and clear AI disclosure.'],
    ['Nursery art', 'nursery wall art printable', 'high', 'AI animal art is everywhere — add your own illustration or lettering.'],
    ['Quote / typography prints', 'quote print printable', 'medium', 'Never use song lyrics, film or celebrity quotes.'],
    ['Watercolor clipart', 'watercolor clipart png', 'high', 'Most scrutinised niche. AI-only bundles are the typical removal case.'],
  ] },
  { group: 'Craft files', items: [
    ['SVG cut files', 'svg cut file cricut', 'medium', 'Do not use brand/character shapes; own the vector work.'],
    ['Embroidery patterns', 'embroidery pattern pdf', 'low', 'Patterns you stitch-tested are strong and defensible.'],
    ['Knitting / crochet patterns', 'crochet pattern pdf', 'low', 'Written patterns need your own testing; add photos of the real item.'],
    ['Digital stickers', 'digital stickers goodnotes', 'medium', 'Own illustrations only; no characters or brands.'],
  ] },
  { group: 'Kids & education', items: [
    ['Worksheets', 'printable worksheets kids', 'low', 'Teaching content you write yourself; fast to bundle by topic.'],
    ['Coloring pages', 'coloring pages printable', 'high', 'AI coloring books are common — disclose, check outputs, avoid characters.'],
    ['Flashcards', 'flashcards printable', 'medium', 'Check every fact and image; unreviewed AI errors lead to refunds.'],
  ] },
  { group: 'Events & invitations', items: [
    ['Birthday invitation', 'birthday invitation template editable', 'medium', 'No licensed characters or brands. Editable-in-browser formats sell best.'],
    ['Wedding signs', 'wedding sign template editable', 'medium', 'Seasonal; pair with matching sets.'],
  ] },
];

const RISK = { low: ['Low AI risk', 'good'], medium: ['Medium AI risk', 'warn'], high: ['High AI risk', 'bad'] };
const riskBadge = (r) => `<span class="badge ${RISK[r][1]}">${RISK[r][0]}</span>`;

export async function render(view, ctx) {
  const p = ctx.params;
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Digital Products</h1>
      <p>Research digital-download niches on Etsy: how crowded they are, what digital listings charge, which tags win — plus how exposed the niche is to Etsy’s AI and Creativity rules.</p>
    </div></div>
    <form class="card" id="dg-form" autocomplete="off">
      <div class="search-bar">
        <input class="input" name="q" placeholder="e.g. budget planner, wedding timeline, svg cut file" value="${esc(p.q || '')}" required>
        <button class="btn" type="submit">${icons.search} Analyze digital niche</button>
      </div>
      <p class="muted small" style="margin-top:8px">Only listings that are real digital downloads are counted. “digital download” is added to your search when you don’t include a format word.</p>
    </form>
    <div id="dg-out" class="stack" style="margin-top:18px"></div>`;

  $('#dg-form', view).addEventListener('submit', (e) => {
    e.preventDefault();
    ctx.go('/digital', { q: e.target.q.value.trim() });
  });

  const out = $('#dg-out', view);
  if (!p.q) {
    out.innerHTML = nichePicker() + aiPolicyCard();
    return;
  }

  out.innerHTML = loading(`Analyzing digital downloads for “${p.q}”…`);
  try {
    const data = await api('/api/digital', { q: p.q });
    if (!ctx.alive()) return;
    pushHistory(p.q);
    renderResults(out, data, ctx);
    ctx.refreshStatus();
  } catch (err) {
    if (ctx.alive()) out.innerHTML = errorBox(err);
  }
}

function nichePicker() {
  return `<div class="section-title"><h2>Pick a niche to analyze</h2></div>
    ${NICHES.map(
      (g) => `<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>${esc(g.group)}</h3></div>
        <div class="stack" style="gap:10px">${g.items
          .map(
            ([name, seed, risk, note]) => `<div class="row" style="gap:12px;align-items:flex-start">
              <div style="min-width:0;flex:1"><a href="#/digital?q=${encodeURIComponent(seed)}"><b>${esc(name)}</b></a>
              <div class="muted small">${esc(note)}</div></div>${riskBadge(risk)}</div>`
          )
          .join('')}</div></div>`
    ).join('')}
    <p class="muted small">AI-risk labels are our own judgement, not an Etsy rating. Low = you build the product yourself; High = commonly AI-generated, crowded and closely watched.</p>`;
}

function aiPolicyCard(extra = '') {
  return `<div class="card" style="margin-top:6px">
    <div class="card-head"><div><h3>${icons.shield} Etsy AI &amp; Creativity rules to follow</h3>
    <p>Applies to every digital product you list. Re-check <a href="https://www.etsy.com/legal/creativity-standards" target="_blank" rel="noopener">Etsy’s Creativity Standards ↗</a> — rules change.</p></div></div>
    ${extra}
    <ol class="stack" style="gap:10px;padding-left:20px;margin:0">${EtsyPolicy.AI_RULES.map(
      ([t, d]) => `<li><b>${esc(t)}.</b> <span class="muted">${esc(d)}</span></li>`
    ).join('')}</ol>
    <div class="row" style="margin-top:14px"><a class="btn secondary sm" href="#/policy">Check a listing</a><a class="btn secondary sm" href="#/builder">Open Listing Builder</a></div>
  </div>`;
}

// Plain-language go / caution / skip call, with the reasons shown.
function verdict(data) {
  const { scores: sc, summary: s, digital_share: share, listings } = data;
  const reasons = [];
  let points = 0;
  if (sc.opportunity == null || !s.sample_size) return { label: 'Not enough data', cls: 'warn', reasons: ['Too few digital listings found to judge this niche.'] };
  if (sc.opportunity >= 60) { points += 2; reasons.push(`Opportunity score ${sc.opportunity}/100 is strong.`); }
  else if (sc.opportunity >= 40) { points += 1; reasons.push(`Opportunity score ${sc.opportunity}/100 is average.`); }
  else reasons.push(`Opportunity score ${sc.opportunity}/100 is low.`);
  if (sc.competition >= 75) reasons.push(`Very crowded (${compact(data.total_count)} listings) — you need a clear sub-niche.`);
  else if (sc.competition <= 50) { points += 1; reasons.push(`Manageable competition (${compact(data.total_count)} listings).`); }
  const med = s.price.median;
  if (med != null && med < 3) reasons.push(`Median price is only ${money(med, s.price_currency)} — thin margin after Etsy fees; bundle to raise basket size.`);
  else if (med != null && med >= 5) { points += 1; reasons.push(`Healthy median price (${money(med, s.price_currency)}).`); }
  if (share < 40) reasons.push(`Only ${pct(share)} of results are digital downloads — buyers here may prefer physical items.`);
  const newer = listings.filter((l) => l.age_days != null && l.age_days <= 180).length;
  if (listings.length && newer / listings.length >= 0.25) { points += 1; reasons.push('New listings are ranking — a new shop can break in.'); }
  const label = points >= 4 ? 'Promising' : points >= 2 ? 'Worth testing' : 'Tough — find a sub-niche';
  return { label, cls: points >= 4 ? 'good' : points >= 2 ? 'warn' : 'bad', reasons };
}

function aiRiskForQuery(q) {
  const lower = q.toLowerCase();
  for (const g of NICHES) for (const [name, seed, risk, note] of g.items) {
    const key = seed.split(' ').filter((w) => w.length > 4);
    if (key.length && key.filter((w) => lower.includes(w)).length >= Math.min(2, key.length)) return { name, risk, note };
  }
  if (/\b(ai|midjourney|prompt|clipart|clip art|wall art|watercolor|nursery|coloring)\b/.test(lower)) return { name: q, risk: 'high', note: 'This kind of product is commonly AI-generated, crowded and closely watched.' };
  return null;
}

function renderResults(out, data, ctx) {
  const s = data.summary;
  const sc = data.scores;
  const cur = s.price_currency;
  const q = data.query;
  const n = s.sample_size;

  if (!n) {
    out.innerHTML = `<div class="card empty"><h2>No digital downloads found for “${esc(q)}”</h2>
      <p>Either almost no competition, or this niche is mostly physical items. Try a broader phrase or <a href="#/ideas?q=${encodeURIComponent(q)}">keyword ideas</a>.</p>
      <p style="margin-top:10px"><a href="#/digital">← Back to niches</a></p></div>`;
    return;
  }

  const v = verdict(data);
  const risk = aiRiskForQuery(q);
  const saved = isSaved(q);
  const top13 = s.tags.slice(0, 13).map((t) => t.term);
  const bestSellers = [...data.listings].sort((a, b) => (b.favs_per_day ?? 0) - (a.favs_per_day ?? 0)).slice(0, 8);

  out.innerHTML = `
    <div class="card">
      <div class="row">
        <div style="min-width:0"><div class="muted small">Digital niche</div><h2 style="font-size:22px">“${esc(q)}”</h2></div>
        <span class="spacer"></span>
        <button class="btn secondary sm" data-act="save">${saved ? '★ Saved' : '☆ Save keyword'}</button>
        <a class="btn secondary sm" href="#/ideas?q=${encodeURIComponent(q)}">${icons.bulb} Keyword ideas</a>
        <a class="btn secondary sm" href="#/builder">${icons.sparkle} Build listing</a>
        <a class="btn secondary sm" href="https://www.etsy.com/search?q=${encodeURIComponent(data.query_used)}" target="_blank" rel="noopener">View on Etsy ↗</a>
      </div>
    </div>

    <div class="notice ${v.cls}"><div class="icon">${v.cls === 'good' ? '✅' : v.cls === 'warn' ? '⚠️' : '🛑'}</div><div>
      <h3>${esc(v.label)}</h3>
      <ul style="margin:6px 0 0;padding-left:18px">${v.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="muted small" style="margin-top:8px">A heuristic from public Etsy data — Etsy does not share search volume or sales per listing.</p>
    </div></div>

    <div class="tiles">
      ${tile('Active listings', compact(data.total_count), scoreBadge(sc.competition_label + ' competition', sc.competition, true), {
        info: `Active Etsy listings for “${data.query_used}” (includes some physical items).`,
      })}
      ${tile('Opportunity', sc.opportunity != null ? `${sc.opportunity}<span class="muted" style="font-size:14px">/100</span>` : '—', esc(sc.opportunity_label), {
        meter: sc.opportunity, meterColor: scoreColor(sc.opportunity),
        info: 'Calculated on the digital listings only: demand, competition and how many top listings are new.',
      })}
      ${tile('Digital share', pct(data.digital_share), `${n} of ${data.sample_size} top results`, { info: 'Share of top search results that are digital downloads.' })}
      ${tile('Median price', money(s.price.median, cur), `Middle 50%: ${money(s.price.p25, cur)} – ${money(s.price.p75, cur)}`)}
      ${tile('Median favorites', fmtInt(s.favorites.median), `Avg ${fmtInt(s.favorites.avg)} · max ${compact(s.favorites.max)}`)}
      ${tile('Top-seller shops', String(s.shops.length), `Top shop has ${s.shops[0]?.listings ?? 0} of the ${n} listings`, {
        info: 'If a few shops own most listings, the niche is dominated by bundles from big shops.',
      })}
    </div>

    ${risk ? aiPolicyCard(`<div class="notice ${RISK[risk.risk][1]}" style="margin-bottom:12px"><div class="icon">🤖</div><div>
      <h3>${esc(risk.name)}: ${RISK[risk.risk][0].toLowerCase()}</h3><p>${esc(risk.note)}</p></div></div>`) : aiPolicyCard()}

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><h3>Tags winning in this niche</h3><p>Share of the ${n} digital listings using each tag</p></div>
          <button class="btn secondary sm" data-act="copy13">Copy top 13</button></div>
        ${barList(s.tags.slice(0, 20).map((t) => ({ label: t.term, value: t.count, tip: `<b>${esc(t.term)}</b><br>${t.count} of ${n} listings · avg ${fmtInt(t.avg_favorites)} favs` })), { format: (x) => `${Math.round((x / n) * 100)}%` })}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Title phrases</h3><p>2-word phrases in top digital titles</p></div></div>
        ${barList(s.phrases2.slice(0, 20).map((t) => ({ label: t.term, value: t.count, tip: `In ${t.count} of ${n} titles` })), { format: (x) => `${Math.round((x / n) * 100)}%` })}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Fastest-rising digital listings</h3><p>Most favorites per day since publishing — what buyers are responding to now</p></div></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Listing</th><th class="num">Price</th><th class="num">Favs</th><th class="num">Age</th><th class="num">Favs/day</th></tr></thead>
      <tbody>${bestSellers.map((l) => `<tr><td><a href="#/listing?id=${l.id}">${esc(l.title.slice(0, 80))}</a> <span class="muted small">${esc(l.shop_name || '')}</span></td>
        <td class="num">${money(l.price_usd ?? l.price, l.price_usd != null ? 'USD' : l.currency)}</td><td class="num">${fmtInt(l.favorites)}</td>
        <td class="num">${l.age_days != null ? `${fmtInt(l.age_days)}d` : '—'}</td><td class="num">${l.favs_per_day != null ? fmt(l.favs_per_day, 2) : '—'}</td></tr>`).join('')}</tbody></table></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>All digital listings</h3><p>Click “tags” to see each listing’s 13 tags</p></div></div>
      <div id="dg-table"></div>
    </div>
    <p class="muted small">Data: official Etsy Open API v3 · generated ${new Date(data.generated_at).toLocaleString()} · cached for up to 1 hour.</p>`;

  dataTable($('#dg-table', out), {
    columns: listingColumns(),
    rows: data.listings,
    sortKey: 'rank',
    sortDir: 'asc',
    filterKeys: ['title', 'shop_name', 'tags'],
    csvName: `etsy-digital-${q.replace(/\W+/g, '-')}.csv`,
    expand: tagsExpand,
  });

  out.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'save') {
      saveKeyword(q, { count: data.total_count, opportunity: sc.opportunity, demand: sc.demand, competition: sc.competition, median_price: s.price.median, currency: cur, median_favorites: s.favorites.median });
      e.target.closest('button').textContent = '★ Saved';
      toast(`Saved “${q}”`);
    } else if (act === 'copy13') {
      copyText(top13.join(', '));
    }
  });
}
