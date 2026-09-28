import {
  $, esc, api, loading, errorBox, tile, fmt, fmtInt, compact, money, pct, barList, columnChart, dataTable,
  listingColumns, tagsExpand, scoreColor, scoreBadge, saveKeyword, isSaved, pushHistory, toast, copyText, store, tipAttr,
} from '../ui.js';
import { icons } from '../icons.js';

let categories = null;

export async function loadCategories() {
  if (categories) return categories;
  const body = await api('/api/categories');
  categories = body.categories || [];
  return categories;
}

const SORTS = [
  ['score|desc', 'Relevancy (like Etsy search)'],
  ['created|desc', 'Newest first'],
  ['price|asc', 'Lowest price'],
  ['price|desc', 'Highest price'],
];

export async function render(view, ctx) {
  const p = ctx.params;
  const sortVal = `${p.sort || 'score'}|${p.order || (p.sort === 'price' ? 'asc' : 'desc')}`;
  const hasFilters = p.min_price || p.max_price || p.taxonomy_id || p.shop_location || (p.sort && p.sort !== 'score');
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Keyword Research</h1>
      <p>See how competitive an Etsy search is, what top sellers charge, which tags and title words they use, and how buyers engage with them.</p>
    </div></div>
    <form class="card" id="kw-form" autocomplete="off">
      <div class="search-bar">
        <input class="input" name="q" placeholder="e.g. personalized dog collar" value="${esc(p.q || '')}" required>
        <button class="btn" type="submit">${icons.search} Analyze</button>
      </div>
      <details class="advanced" ${hasFilters ? 'open' : ''}>
        <summary>Filters & options</summary>
        <div class="field-row">
          <label class="field">Sort results
            <select class="input" name="sort">${SORTS.map(([v, l]) => `<option value="${v}" ${v === sortVal ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </label>
          <label class="field">Listings to analyze
            <select class="input" name="depth">${[100, 200, 300].map((d) => `<option ${String(d) === (p.depth || '100') ? 'selected' : ''}>${d}</option>`).join('')}</select>
          </label>
          <label class="field">Min price (USD)<input class="input" type="number" min="0" step="0.01" name="min_price" value="${esc(p.min_price || '')}"></label>
          <label class="field">Max price (USD)<input class="input" type="number" min="0" step="0.01" name="max_price" value="${esc(p.max_price || '')}"></label>
          <label class="field">Category<input class="input" name="category" list="cat-list" placeholder="Any category" value="${esc(p.category || '')}"></label>
          <label class="field">Shop location<input class="input" name="shop_location" placeholder="e.g. United States" value="${esc(p.shop_location || '')}"></label>
        </div>
        <datalist id="cat-list"></datalist>
        <input type="hidden" name="taxonomy_id" value="${esc(p.taxonomy_id || '')}">
      </details>
    </form>
    <div id="kw-out" class="stack" style="margin-top:18px"></div>`;

  const form = $('#kw-form', view);
  const details = $('details', form);
  const fillCats = async () => {
    try {
      const cats = await loadCategories();
      $('#cat-list', view).innerHTML = cats.map((c) => `<option value="${esc(c.path)}"></option>`).join('');
    } catch {
      /* categories are optional */
    }
  };
  if (details.open) fillCats();
  details.addEventListener('toggle', () => details.open && fillCats());
  form.category.addEventListener('change', () => {
    const c = (categories || []).find((x) => x.path === form.category.value);
    form.taxonomy_id.value = c ? c.id : '';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const [sort, order] = form.sort.value.split('|');
    const cat = form.category.value.trim();
    ctx.go('/keyword', {
      q: form.q.value.trim(),
      sort: sort === 'score' ? '' : sort,
      order: sort === 'score' ? '' : order,
      depth: form.depth.value === '100' ? '' : form.depth.value,
      min_price: form.min_price.value,
      max_price: form.max_price.value,
      taxonomy_id: cat ? form.taxonomy_id.value : '',
      category: cat && form.taxonomy_id.value ? cat : '',
      shop_location: form.shop_location.value.trim(),
    });
  });

  const out = $('#kw-out', view);
  if (!p.q) {
    const history = store.get('history', []);
    out.innerHTML = `<div class="card empty"><h2>Type a keyword to start</h2>
      <p>Try what a buyer would type into Etsy search — e.g. <em>minimalist gold necklace</em>.</p>
      ${history.length ? `<div class="chips" style="justify-content:center;margin-top:16px">${history.slice(0, 10).map((h) => `<a class="chip" href="#/keyword?q=${encodeURIComponent(h)}">${esc(h)}</a>`).join('')}</div>` : ''}
    </div>`;
    return;
  }

  const depth = Number(p.depth) || 100;
  out.innerHTML = loading(`Analyzing the top ${depth} Etsy listings for “${p.q}”…`);
  try {
    const data = await api('/api/keyword', {
      q: p.q, sort: p.sort, order: p.order, depth, min_price: p.min_price, max_price: p.max_price,
      taxonomy_id: p.taxonomy_id, shop_location: p.shop_location,
    });
    if (!ctx.alive()) return;
    pushHistory(p.q);
    renderResults(out, data, ctx);
    ctx.refreshStatus();
  } catch (err) {
    if (ctx.alive()) out.innerHTML = errorBox(err);
  }
}

function renderResults(out, data, ctx) {
  const s = data.summary;
  const sc = data.scores;
  const cur = s.price_currency;
  const q = data.query;
  const saved = isSaved(q);
  const n = s.sample_size;

  if (!n) {
    out.innerHTML = `<div class="card empty"><h2>No active listings found for “${esc(q)}”</h2>
      <p>That usually means almost zero competition — or a typo. Try a broader phrase or check <a href="#/ideas?q=${encodeURIComponent(q)}">keyword ideas</a>.</p></div>`;
    return;
  }

  const top13 = s.tags.slice(0, 13).map((t) => t.term);
  const histItems = s.histogram.map((b, i, arr) => ({
    label: `${money(b.from, cur, 0)}${i === arr.length - 1 && b.open ? '+' : ''}`,
    value: b.count,
    tip: `<b>${money(b.from, cur)} – ${i === arr.length - 1 && b.open ? 'and above' : money(b.to, cur)}</b><br>${b.count} listings`,
  }));

  out.innerHTML = `
    <div class="card">
      <div class="row">
        <div style="min-width:0">
          <div class="muted small">Results for</div>
          <h2 style="font-size:22px">“${esc(q)}”</h2>
        </div>
        <span class="spacer"></span>
        <button class="btn secondary sm" data-act="save">${saved ? '★ Saved' : '☆ Save keyword'}</button>
        <a class="btn secondary sm" href="#/ideas?q=${encodeURIComponent(q)}">${icons.bulb} Keyword ideas</a>
        <button class="btn secondary sm" data-act="compare">${icons.compare} Add to compare</button>
        <a class="btn secondary sm" href="https://www.etsy.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">View on Etsy ↗</a>
      </div>
    </div>

    <div class="tiles">
      ${tile('Active listings', compact(data.total_count), scoreBadge(sc.competition_label + ' competition', sc.competition, true), {
        info: 'Total active Etsy listings matching this search (official Etsy API). More listings = more sellers to beat.',
      })}
      ${tile('Opportunity score', sc.opportunity != null ? `${sc.opportunity}<span class="muted" style="font-size:14px">/100</span>` : '—', esc(sc.opportunity_label), {
        meter: sc.opportunity, meterColor: scoreColor(sc.opportunity),
        info: 'Heuristic: 50% demand + 40% low competition + 10% how many top listings are new (under 6 months). Higher is better.',
      })}
      ${tile('Demand score', sc.demand != null ? `${sc.demand}<span class="muted" style="font-size:14px">/100</span>` : '—', `Top-48 median: ${fmtInt(sc.top_median_favorites)} favs · ${fmt(sc.top_median_views_per_day, 1)} views/day`, {
        meter: sc.demand, meterColor: scoreColor(sc.demand),
        info: 'Etsy does not publish search volume. Demand is estimated from how much buyers engage with the top 48 listings (favorites and views per day).',
      })}
      ${tile('Competition score', `${sc.competition}<span class="muted" style="font-size:14px">/100</span>`, 'Lower is easier', {
        meter: sc.competition, meterColor: scoreColor(sc.competition, true),
        info: 'Log scale of the number of active listings: 1K ≈ 25, 10K ≈ 50, 100K ≈ 75, 1M ≈ 100.',
      })}
      ${tile('Median price', money(s.price.median, cur), `Middle 50%: ${money(s.price.p25, cur)} – ${money(s.price.p75, cur)}`, {
        info: cur === 'USD' ? 'All prices converted to USD with daily exchange rates.' : '',
      })}
      ${tile('Median favorites', fmtInt(s.favorites.median), `Avg ${fmtInt(s.favorites.avg)} · max ${compact(s.favorites.max)}`)}
      ${tile('Median views', fmtInt(s.views.median), `Avg ${fmt(s.views_per_day.avg, 1)} views/day per listing`)}
      ${tile('New listings in top 48', pct(sc.new_listing_share), 'created in the last 6 months', {
        info: 'A high share means Etsy is ranking new listings for this search — easier for a new shop to break in.',
      })}
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><h3>Price distribution</h3><p>${n} listings · ${cur}</p></div></div>
        ${columnChart(histItems)}
        <div class="divider"></div>
        <dl class="kv">
          <dt>Sweet spot (middle 50%)</dt><dd><b>${money(s.price.p25, cur)} – ${money(s.price.p75, cur)}</b></dd>
          <dt>Average / median</dt><dd>${money(s.price.avg, cur)} / ${money(s.price.median, cur)}</dd>
          <dt>Cheapest / priciest</dt><dd>${money(s.price.min, cur)} / ${money(s.price.max, cur)}</dd>
        </dl>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Listing age</h3><p>How old are the listings that rank</p></div></div>
        ${columnChart(s.age_buckets.map((b) => ({ label: b.label, value: b.count, tip: `<b>${b.label}</b><br>${b.count} listings` })))}
        <div class="divider"></div>
        <dl class="kv">
          <dt>Digital downloads</dt><dd>${pct(s.mix.digital)}</dd>
          <dt>Personalizable</dt><dd>${pct(s.mix.personalizable)}</dd>
          <dt>Has variations</dt><dd>${pct(s.mix.variations)}</dd>
          <dt>Handmade by seller</dt><dd>${pct(s.mix.handmade)}</dd>
          <dt>Avg tags used</dt><dd>${fmt(s.mix.avg_tags, 1)} of 13 · avg title ${fmtInt(s.mix.avg_title_length)} chars</dd>
        </dl>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head">
          <div><h3>Top tags used by competitors</h3><p>Share of the ${n} listings using each tag · click to research</p></div>
          <button class="btn secondary sm" data-act="copy13">Copy top 13</button>
        </div>
        <div id="tag-bars"></div>
        <div class="row" style="margin-top:10px"><button class="link-btn small" data-act="moretags">Show all ${s.tags.length} tags</button></div>
      </div>
      <div class="card">
        <div class="card-head">
          <div><h3>Title keywords</h3><p>Words & phrases top sellers put in titles</p></div>
          <div class="tabs" id="gram-tabs"><button class="active" data-g="words">Words</button><button data-g="phrases2">2-word</button><button data-g="phrases3">3-word</button></div>
        </div>
        <div id="gram-bars"></div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><h3>Top shops in these results</h3><p>Who dominates this search</p></div></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Shop</th><th class="num">Listings</th><th class="num">Best rank</th><th class="num">Shop sales</th><th class="num">Rating</th></tr></thead>
          <tbody>${s.shops
            .slice(0, 10)
            .map(
              (sh) => `<tr><td>${sh.shop_name ? `<a href="#/shop?name=${encodeURIComponent(sh.shop_name)}">${esc(sh.shop_name)}</a>` : `Shop #${sh.shop_id}`} ${sh.country ? `<span class="muted small">${esc(sh.country)}</span>` : ''}</td>
                <td class="num">${sh.listings}</td><td class="num">#${sh.best_rank ?? '—'}</td><td class="num">${compact(sh.sales)}</td><td class="num">${sh.rating != null ? fmt(sh.rating, 2) : '—'}</td></tr>`
            )
            .join('')}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Categories</h3><p>Where these listings are placed</p></div></div>
        ${barList(s.categories.map((c) => ({ label: c.path.split(' › ').slice(-2).join(' › '), value: c.count, tip: `<b>${esc(c.path)}</b><br>${c.count} listings (${c.pct}%)` })))}
        ${s.materials.length ? `<div class="divider"></div><h3 style="margin-bottom:8px">Common materials</h3>
          <div class="chips">${s.materials.slice(0, 15).map((m) => `<span class="chip" ${tipAttr(`${m.count} listings`)}>${esc(m.term)} <span class="muted">${m.count}</span></span>`).join('')}</div>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Listings</h3><p>Ranked as returned by Etsy (${esc(sortLabel(data.params))}). Click “tags” to see each listing’s 13 tags.</p></div></div>
      <div id="kw-table"></div>
    </div>

    <p class="muted small">Data: official Etsy Open API v3 · generated ${new Date(data.generated_at).toLocaleString()} · cached for up to 1 hour.
    Scores are estimates to compare keywords — Etsy does not share search volume or per-listing sales.</p>`;

  // tags
  const tagBars = $('#tag-bars', out);
  const drawTags = (all) => {
    tagBars.innerHTML = barList(
      s.tags.slice(0, all ? 50 : 20).map((t) => ({
        label: t.term,
        value: t.count,
        action: 'research',
        tip: `<b>${esc(t.term)}</b><br>Used by ${t.count} of ${n} listings (${t.pct}%)<br>Avg ${fmtInt(t.avg_favorites)} favorites`,
      })),
      { clickable: true, format: (v) => `${Math.round((v / n) * 100)}%` }
    );
  };
  drawTags(false);

  // grams
  const gramBars = $('#gram-bars', out);
  const drawGrams = (g) => {
    gramBars.innerHTML = barList(
      s[g].slice(0, 20).map((t) => ({
        label: t.term,
        value: t.count,
        action: 'research',
        tip: `<b>${esc(t.term)}</b><br>In ${t.count} of ${n} titles (${t.pct}%)`,
      })),
      { clickable: true, format: (v) => `${Math.round((v / n) * 100)}%` }
    );
  };
  drawGrams('words');
  $('#gram-tabs', out).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-g]');
    if (!b) return;
    $('#gram-tabs', out).querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    drawGrams(b.dataset.g);
  });

  dataTable($('#kw-table', out), {
    columns: listingColumns(),
    rows: data.listings,
    sortKey: 'rank',
    sortDir: 'asc',
    filterKeys: ['title', 'shop_name', 'tags'],
    csvName: `etsy-${q.replace(/\W+/g, '-')}-listings.csv`,
    expand: tagsExpand,
  });

  out.addEventListener('click', (e) => {
    const r = e.target.closest('[data-action=research]');
    if (r) {
      ctx.go('/keyword', { q: r.dataset.value });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'save') {
      saveKeyword(q, {
        count: data.total_count,
        opportunity: sc.opportunity,
        demand: sc.demand,
        competition: sc.competition,
        median_price: s.price.median,
        currency: cur,
        median_favorites: s.favorites.median,
      });
      e.target.closest('button').textContent = '★ Saved';
      toast(`Saved “${q}”`);
    } else if (act === 'compare') {
      const list = store.get('compare', []).filter((k) => k !== q);
      list.push(q);
      store.set('compare', list.slice(-5));
      ctx.go('/compare', { k: list.slice(-5).join('|') });
    } else if (act === 'copy13') {
      copyText(top13.join(', '));
    } else if (act === 'moretags') {
      drawTags(true);
      e.target.remove();
    }
  });
}

function sortLabel(p) {
  if (p.sort_on === 'created') return 'newest first';
  if (p.sort_on === 'price') return p.sort_order === 'asc' ? 'lowest price first' : 'highest price first';
  return 'relevancy';
}
