import {
  $, esc, api, loading, errorBox, tile, fmt, fmtInt, compact, money, ago, date, stars, barList, columnChart, dataTable,
  listingColumns, tagsExpand,
} from '../ui.js';
import { icons } from '../icons.js';

export async function render(view, ctx) {
  const p = ctx.params;
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Shop Analyzer</h1>
      <p>Study any competitor: total sales, estimated revenue, best sellers (from recent reviews), pricing, and the tags they use across their shop.</p>
    </div></div>
    <form class="card" id="s-form" autocomplete="off">
      <div class="search-bar">
        <input class="input" name="name" placeholder="Shop name or URL, e.g. CaitlynMinimalist" value="${esc(p.name || '')}" required>
        <select class="input" name="depth" style="max-width:190px">
          ${[100, 200, 300].map((d) => `<option value="${d}" ${String(d) === (p.depth || '100') ? 'selected' : ''}>Analyze ${d} listings</option>`).join('')}
        </select>
        <button class="btn" type="submit">${icons.shop} Analyze</button>
      </div>
    </form>
    <div id="s-out" class="stack" style="margin-top:18px"></div>`;

  $('#s-form', view).addEventListener('submit', (e) => {
    e.preventDefault();
    ctx.go('/shop', { name: e.target.name.value.trim(), depth: e.target.depth.value === '100' ? '' : e.target.depth.value });
  });

  const out = $('#s-out', view);
  if (!p.name) {
    out.innerHTML = `<div class="card empty"><h2>Enter a shop name</h2><p>Find it in the shop URL: etsy.com/shop/<b>ShopName</b>. Tip: open a top shop from any Keyword Research result.</p></div>`;
    return;
  }
  out.innerHTML = loading('Loading shop, listings and reviews…');
  let data;
  try {
    data = await api('/api/shop', { name: p.name, depth: p.depth });
  } catch (err) {
    if (ctx.alive()) out.innerHTML = errorBox(err);
    return;
  }
  if (!ctx.alive()) return;
  ctx.refreshStatus();

  const s = data.shop;
  const sum = data.summary;
  const rv = data.reviews;
  const cur = sum.price_currency;
  const n = sum.sample_size;

  out.innerHTML = `
    <div class="card">
      <div class="shop-head">
        ${s.icon ? `<img src="${esc(s.icon)}" alt="">` : `<div class="brand-mark" style="width:64px;height:64px;font-size:28px">${esc((s.name || '?')[0])}</div>`}
        <div style="min-width:0;flex:1">
          <h2 style="font-size:22px">${esc(s.name)}</h2>
          ${s.title ? `<div class="muted">${esc(s.title)}</div>` : ''}
          <div class="row small muted" style="margin-top:4px;gap:12px">
            ${s.country ? `<span>📍 ${esc(s.country)}</span>` : ''}
            <span>Opened ${date(s.created)} (${ago(s.age_days)})</span>
            ${s.is_vacation ? '<span class="badge warn">On vacation</span>' : ''}
            ${s.accepts_custom_requests ? '<span class="badge">Accepts custom orders</span>' : ''}
          </div>
        </div>
        <a class="btn secondary sm" href="${esc(s.url)}" target="_blank" rel="noopener">View on Etsy ↗</a>
      </div>
      ${s.announcement ? `<div class="desc" style="margin-top:14px;max-height:120px">${esc(s.announcement)}</div>` : ''}
    </div>

    <div class="tiles">
      ${tile('Total sales', fmtInt(s.sales), `${fmt(s.sales_per_day, 1)} sales/day on average`)}
      ${tile('Est. revenue (lifetime)', s.est_revenue != null ? compact(s.est_revenue) + ' ' + esc(s.est_revenue_currency) : '—', 'sales × median listing price', {
        info: 'Rough estimate only: total sales multiplied by the median price of current listings. Real revenue differs (bundles, discounts, shipping).',
      })}
      ${tile('Reviews', fmtInt(s.reviews), s.rating != null ? `<span class="stars">${stars(s.rating)}</span> ${fmt(s.rating, 2)}` : 'No rating yet')}
      ${tile('Shop favorites', fmtInt(s.favorites), '')}
      ${tile('Active listings', fmtInt(s.active_listings), s.digital_listings ? `${fmtInt(s.digital_listings)} digital` : '')}
      ${tile('Recent review pace', fmtInt(rv.last_30_days), `reviews in last 30 days · ${fmtInt(rv.last_90_days)} in 90`, {
        info: 'Buyers review a fraction of orders, so this is a proxy for current sales momentum.',
      })}
      ${tile('Median price', money(sum.price.median, cur), `Range ${money(sum.price.min, cur, 0)} – ${money(sum.price.max, cur, 0)}`)}
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><h3>Reviews per month</h3><p>Last ${rv.fetched} reviews — momentum over time</p></div></div>
        ${rv.by_month.length ? columnChart(rv.by_month.slice(-12).map((m) => ({ label: m.month.slice(2), value: m.count, tip: `<b>${m.month}</b><br>${m.count} reviews` }))) : '<p class="muted small">No reviews.</p>'}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Best sellers (by recent reviews)</h3><p>Listings with the most reviews among the last ${rv.fetched}</p></div></div>
        ${data.best_sellers.length ? `<div class="stack" style="gap:10px">${data.best_sellers
          .slice(0, 8)
          .map((b) =>
            b.listing
              ? `<div class="row" style="flex-wrap:nowrap"><img class="thumb" src="${esc(b.listing.thumb || '')}" alt="" loading="lazy">
                <div style="min-width:0;flex:1"><a href="#/listing?id=${b.id}" style="color:var(--text);font-weight:560;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.listing.title)}</a>
                <span class="muted small">${money(b.listing.price_usd ?? b.listing.price, b.listing.price_usd != null ? 'USD' : b.listing.currency)} · ${fmtInt(b.listing.favorites)} favs</span></div>
                <span class="badge good">${b.recent_reviews} reviews</span></div>`
              : `<div class="row"><a href="#/listing?id=${b.id}">Listing #${b.id}</a><span class="muted small">(not in analyzed listings / sold out)</span><span class="spacer"></span><span class="badge good">${b.recent_reviews} reviews</span></div>`
          )
          .join('')}</div>` : '<p class="muted small">No reviews to infer best sellers.</p>'}
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><h3>Tags this shop uses most</h3><p>Across ${n} listings · click to research</p></div>
        <button class="btn secondary sm" data-copy="${esc(sum.tags.slice(0, 13).map((t) => t.term).join(', '))}">Copy top 13</button></div>
        ${barList(sum.tags.slice(0, 20).map((t) => ({ label: t.term, value: t.count, action: 'research', tip: `<b>${esc(t.term)}</b><br>${t.count} of ${n} listings` })), { clickable: true })}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Price distribution</h3><p>${n} listings · ${cur}</p></div></div>
        ${columnChart(sum.histogram.map((b, i, arr) => ({ label: `${money(b.from, cur, 0)}${i === arr.length - 1 && b.open ? '+' : ''}`, value: b.count, tip: `<b>${money(b.from, cur)} – ${money(b.to, cur)}</b><br>${b.count} listings` })))}
        <div class="divider"></div>
        <h3 style="margin-bottom:8px">Title words they repeat</h3>
        <div class="chips">${sum.words.slice(0, 18).map((w) => `<button class="chip" data-action="research" data-value="${esc(w.term)}">${esc(w.term)} <span class="muted">${w.count}</span></button>`).join('')}</div>
      </div>
    </div>

    ${rv.recent.length ? `<div class="card"><div class="card-head"><h3>Latest reviews</h3></div>
      <div class="grid grid-2" style="gap:0 24px">${rv.recent.slice(0, 8).map((r) => `<div class="review"><div class="row small"><span class="stars">${stars(r.rating)}</span><span class="muted">${date(r.date)}</span>${r.listing_id ? `<a class="small" href="#/listing?id=${r.listing_id}">listing</a>` : ''}</div>${r.text ? `<div style="margin-top:4px">${esc(r.text)}</div>` : ''}</div>`).join('')}</div></div>` : ''}

    <div class="card">
      <div class="card-head"><div><h3>Listings</h3><p>${n} active listings analyzed · sort by any column</p></div></div>
      <div id="s-table"></div>
    </div>`;

  dataTable($('#s-table', out), {
    columns: listingColumns({ showRank: false, showShop: false }).filter((c) => c.key !== 'shop_sales'),
    rows: data.listings,
    sortKey: 'favorites',
    sortDir: 'desc',
    filterKeys: ['title', 'tags'],
    csvName: `etsy-shop-${s.name}-listings.csv`,
    expand: tagsExpand,
  });

  out.addEventListener('click', (e) => {
    const r = e.target.closest('[data-action=research]');
    if (r) ctx.go('/keyword', { q: r.dataset.value });
  });
}
