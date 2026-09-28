import { $, esc, api, loading, errorBox, tile, fmt, fmtInt, compact, money, ago, date, stars, copyText, runPool, columnChart } from '../ui.js';
import { auditListing, renderChecks, scoreRing } from '../seo-rules.js';
import { icons } from '../icons.js';

export async function render(view, ctx) {
  const p = ctx.params;
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Listing Analyzer</h1>
      <p>Paste any Etsy listing link to see its tags, views, favorites, reviews, an SEO audit, and where it ranks for each of its tags.</p>
    </div></div>
    <form class="card" id="l-form" autocomplete="off">
      <div class="search-bar">
        <input class="input" name="id" placeholder="https://www.etsy.com/listing/1234567890/…  or listing ID" value="${esc(p.id || '')}" required>
        <button class="btn" type="submit">${icons.listing} Analyze</button>
      </div>
    </form>
    <div id="l-out" class="stack" style="margin-top:18px"></div>`;

  $('#l-form', view).addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.id.value.trim();
    const m = v.match(/listing\/(\d+)/) || v.match(/(\d{5,})/);
    ctx.go('/listing', { id: m ? m[1] : v });
  });

  const out = $('#l-out', view);
  if (!p.id) {
    out.innerHTML = `<div class="card empty"><h2>Paste a listing URL</h2><p>Open any product on Etsy, copy the link from the address bar and paste it above.</p></div>`;
    return;
  }
  out.innerHTML = loading('Loading listing…');
  let data;
  try {
    data = await api('/api/listing', { id: p.id });
  } catch (err) {
    if (ctx.alive()) out.innerHTML = errorBox(err);
    return;
  }
  if (!ctx.alive()) return;
  ctx.refreshStatus();

  const l = data.listing;
  const rv = data.reviews;
  const shop = l.shop;
  const audit = auditListing({ title: l.title, tags: l.tags, description: l.description });
  const images = l.images?.length ? l.images : l.image ? [l.image] : [];

  out.innerHTML = `
    <div class="grid split-media">
      <div class="card gallery">
        ${images.length ? `<img class="main-img" id="main-img" src="${esc(images[0])}" alt="">` : '<div class="main-img"></div>'}
        ${images.length > 1 ? `<div class="thumbs">${images.map((src, i) => `<img src="${esc(src)}" data-src="${esc(src)}" class="${i === 0 ? 'active' : ''}" alt="" loading="lazy">`).join('')}</div>` : ''}
      </div>
      <div class="card stack" style="gap:12px">
        <div class="row" style="gap:6px">
          ${l.is_digital ? '<span class="badge blue">Digital download</span>' : '<span class="badge">Physical</span>'}
          ${l.is_personalizable ? '<span class="badge">Personalizable</span>' : ''}
          ${l.has_variations ? '<span class="badge">Variations</span>' : ''}
          ${l.who_made ? `<span class="badge">${esc(whoMade(l.who_made))}</span>` : ''}
        </div>
        <h2 style="font-size:19px">${esc(l.title)}</h2>
        <div class="row">
          <span style="font-size:24px;font-weight:750">${money(l.price, l.currency || 'USD')}</span>
          ${l.currency && l.currency !== 'USD' && l.price_usd != null ? `<span class="muted">≈ ${money(l.price_usd)}</span>` : ''}
        </div>
        ${shop ? `<div class="row small"><span class="muted">Shop:</span> <a href="#/shop?name=${encodeURIComponent(shop.name)}"><b>${esc(shop.name)}</b></a>
          <span class="muted">· ${compact(shop.sales)} sales · ${shop.rating != null ? `${fmt(shop.rating, 2)}★ (${compact(shop.reviews)})` : 'no reviews'} · ${esc(shop.country || '')}</span></div>` : ''}
        <dl class="kv">
          <dt>Category</dt><dd>${esc(l.category || '—')}</dd>
          <dt>Created</dt><dd>${date(l.created)} (${ago(l.age_days)} ago)</dd>
          <dt>Last updated</dt><dd>${date(l.updated)}</dd>
          <dt>Quantity</dt><dd>${fmtInt(l.quantity)}</dd>
          <dt>Processing</dt><dd>${l.processing_min != null ? `${l.processing_min}–${l.processing_max} days` : '—'}</dd>
          ${l.materials.length ? `<dt>Materials</dt><dd>${esc(l.materials.join(', '))}</dd>` : ''}
          ${l.style?.length ? `<dt>Style</dt><dd>${esc(l.style.join(', '))}</dd>` : ''}
        </dl>
        <div class="row">
          <a class="btn secondary sm" href="${esc(l.url)}" target="_blank" rel="noopener">View on Etsy ↗</a>
          ${shop ? `<a class="btn secondary sm" href="#/shop?name=${encodeURIComponent(shop.name)}">${icons.shop} Analyze shop</a>` : ''}
          ${l.tags[0] ? `<a class="btn secondary sm" href="#/keyword?q=${encodeURIComponent(l.tags[0])}">${icons.search} Research “${esc(l.tags[0])}”</a>` : ''}
        </div>
      </div>
    </div>

    <div class="tiles">
      ${tile('Views', fmtInt(l.views), `${fmt(l.views_per_day, 1)} per day`)}
      ${tile('Favorites', fmtInt(l.favorites), `${fmt(l.favs_per_day, 2)} per day`)}
      ${tile('Listing age', ago(l.age_days), date(l.created))}
      ${tile('Favorite rate', l.views ? `${fmt((l.favorites / l.views) * 100, 1)}%` : '—', 'favorites ÷ views', { info: 'How many viewers favorite it. Above ~5% usually signals a very appealing listing.' })}
      ${rv ? tile('Reviews (last 90 days)', fmtInt(rv.last_90_days), `${fmtInt(rv.last_30_days)} in 30 days · ${rv.fetched} loaded`, { info: 'Reviews are left on a share of orders, so review velocity is a rough proxy for recent sales.' }) : ''}
      ${tile('SEO score', `${audit.score}<span class="muted" style="font-size:14px">/100</span>`, 'title, tags & description')}
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h3>Tags (${l.tags.length}/13)</h3><button class="btn secondary sm" data-copy="${esc(l.tags.join(', '))}">Copy tags</button></div>
        <div class="chips">${l.tags.map((t) => `<a class="chip" href="#/keyword?q=${encodeURIComponent(t)}" title="Research this tag">${esc(t)} <span class="muted small">${t.length}</span></a>`).join('') || '<span class="muted">No tags</span>'}</div>
        <div class="divider"></div>
        <div class="card-head" style="margin-bottom:8px"><div><h3>Rank checker</h3><p>Position of this listing in Etsy relevancy results for each tag (48 listings per page).</p></div></div>
        <div class="row" style="margin-bottom:10px">
          <select class="input" id="rank-depth" style="width:auto;min-height:34px;padding:4px 8px">
            <option value="100">Search top 100</option><option value="200">Search top 200</option><option value="300">Search top 300</option>
          </select>
          <button class="btn sm" id="rank-all">Check all tags</button>
          <input class="input" id="rank-custom" placeholder="or any keyword…" style="max-width:200px;min-height:34px;padding:6px 10px">
          <button class="btn secondary sm" id="rank-one">Check</button>
        </div>
        <div id="rank-out"></div>
      </div>
      <div class="card">
        <div class="card-head" style="align-items:flex-start">
          <div><h3>SEO audit</h3><p>Checked against Etsy search best practices</p></div>
          ${scoreRing(audit.score)}
        </div>
        ${renderChecks(audit.checks)}
        <div class="row" style="margin-top:14px"><a class="btn secondary sm" href="#/seo" id="to-grader">Edit in Title & Tag Grader →</a></div>
      </div>
    </div>

    ${rv ? `<div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><h3>Reviews per month</h3><p>Last ${rv.fetched} reviews · avg rating ${rv.avg_rating ?? '—'}</p></div></div>
        ${rv.by_month.length ? columnChart(rv.by_month.slice(-12).map((m) => ({ label: m.month.slice(2), value: m.count, tip: `<b>${m.month}</b><br>${m.count} reviews` }))) : '<p class="muted small">No reviews yet.</p>'}
      </div>
      <div class="card">
        <div class="card-head"><h3>Recent reviews</h3></div>
        ${rv.recent.length ? rv.recent.map((r) => `<div class="review"><div class="row small"><span class="stars">${stars(r.rating)}</span><span class="muted">${date(r.date)}</span></div>${r.text ? `<div style="margin-top:4px">${esc(r.text)}</div>` : ''}</div>`).join('') : '<p class="muted small">No reviews yet.</p>'}
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-head"><h3>Description</h3><button class="btn secondary sm" data-copy="${esc(l.description || '')}">Copy</button></div>
      <div class="desc">${esc(l.description || 'No description')}</div>
    </div>`;

  out.querySelector('.thumbs')?.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-src]');
    if (!img) return;
    $('#main-img', out).src = img.dataset.src;
    out.querySelectorAll('.thumbs img').forEach((x) => x.classList.toggle('active', x === img));
  });

  $('#to-grader', out).addEventListener('click', () => {
    try {
      sessionStorage.setItem('seo-draft', JSON.stringify({ title: l.title, tags: l.tags, description: l.description }));
    } catch {
      /* ignore */
    }
  });

  // rank checker
  const rankRows = [];
  const rankOut = $('#rank-out', out);
  const drawRanks = () => {
    rankOut.innerHTML = rankRows.length
      ? `<div class="table-wrap"><table class="data"><thead><tr><th>Keyword</th><th class="num">Etsy listings</th><th class="num">Position</th><th class="num">Page</th></tr></thead><tbody>
        ${rankRows
          .map(
            (r) => `<tr><td><a href="#/keyword?q=${encodeURIComponent(r.keyword)}">${esc(r.keyword)}</a></td>
            <td class="num">${r.count != null ? compact(r.count) : ''}</td>
            <td class="num">${r.loading ? '…' : r.error ? '<span class="muted">error</span>' : r.position ? `<b>#${r.position}</b>` : `<span class="muted">not in top ${r.checked}</span>`}</td>
            <td class="num">${r.page ? `<span class="badge ${r.page === 1 ? 'good' : r.page <= 3 ? 'warn' : ''}">p${r.page}</span>` : ''}</td></tr>`
          )
          .join('')}</tbody></table></div>`
      : '<p class="muted small">Each keyword uses 1–3 Etsy API calls depending on depth.</p>';
  };
  drawRanks();

  async function checkRanks(keywords) {
    const depth = $('#rank-depth', out).value;
    const rows = keywords.map((k) => {
      let r = rankRows.find((x) => x.keyword === k);
      if (!r) {
        r = { keyword: k };
        rankRows.push(r);
      }
      Object.assign(r, { loading: true, error: null });
      return r;
    });
    drawRanks();
    try {
      await runPool(rows, 2, async (r) => {
        try {
          Object.assign(r, await api('/api/rank', { listing_id: l.id, q: r.keyword, depth }), { loading: false });
        } catch (err) {
          Object.assign(r, { loading: false, error: err });
          throw err;
        }
        if (ctx.alive()) drawRanks();
      });
    } catch (err) {
      rows.forEach((r) => r.loading && Object.assign(r, { loading: false, error: err }));
      rankOut.insertAdjacentHTML('beforebegin', errorBox(err));
    }
    if (ctx.alive()) drawRanks();
    ctx.refreshStatus();
  }
  $('#rank-all', out).addEventListener('click', () => l.tags.length && checkRanks(l.tags));
  $('#rank-one', out).addEventListener('click', () => {
    const v = $('#rank-custom', out).value.trim().toLowerCase();
    if (v) checkRanks([v]);
  });
}

function whoMade(v) {
  return { i_did: 'Made by seller', someone_else: 'Made by someone else', collective: 'Made by a collective' }[v] || v;
}
