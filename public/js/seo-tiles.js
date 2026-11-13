import { esc, tile, fmt, fmtInt, compact, pct, scoreColor, tipAttr } from './ui.js';

const KIND_CLS = { 'Must-use': 'good', Strong: 'good', 'Long-tail gem': 'warn', Optional: '' };

// "SEO & traffic estimates" block shared by Keyword Research and Digital Products.
export function seoSection(seo, n) {
  if (!seo) return '';
  return `
    <div class="section-title"><h2>SEO &amp; traffic estimates</h2></div>
    <div class="tiles">
      ${tile('SEO ease', `${seo.ease}<span class="muted" style="font-size:14px">/100</span>`, `${esc(seo.difficulty_label)} to rank (difficulty ${seo.difficulty})`, {
        meter: seo.ease, meterColor: scoreColor(seo.ease),
        info: 'Estimated keyword difficulty: 35% number of competing listings, 25% strength (favorites) of top listings, 20% how many already target this exact phrase, 20% size of the shops ranking. Higher ease = easier to rank.',
      })}
      ${tile('Search interest', esc(seo.search_interest), 'estimated, not a search count', {
        info: 'Etsy does not publish search volume. This is derived from how many favorites and views the top listings get per day.',
      })}
      ${tile('Avg views / day', fmt(seo.avg_views_per_day, 1), `Top-48 combined ≈ ${compact(seo.monthly_views_top)} views/month`, {
        info: 'Etsy listing views = clicks from search or browse to the listing page. Computed from each top listing’s total views ÷ its age. Etsy does not publish true search click-through rate.',
      })}
      ${tile('Buyer interest (CTR proxy)', seo.fav_rate != null ? `${fmt(seo.fav_rate, 1)}%` : '—', 'favorites ÷ views, median', {
        info: 'Real CTR is private to each shop. The share of viewers who favorite a listing is the best public signal of how well the listing converts attention into interest.',
      })}
      ${tile('Exact title match', pct(seo.exact_title_match), `${pct(seo.tag_match)} also use it in a tag`, {
        info: 'Share of the top 48 listings whose title contains your exact phrase. High = everyone already targets it.',
      })}
      ${tile('Big-shop share', pct(seo.big_shop_share), `Median shop: ${compact(seo.median_shop_sales)} sales`, {
        info: 'Share of top listings from shops with 10,000+ sales. High = established shops dominate.',
      })}
    </div>
    <div class="notice ${seo.ease >= 50 ? 'good' : seo.ease >= 30 ? 'warn' : 'bad'}" style="margin-top:12px"><div class="icon">🎯</div><div>
      <h3>How to rank: ${esc(seo.difficulty_label.toLowerCase())}</h3><p>${esc(seo.tip)}</p></div></div>
    <div class="card" style="margin-top:12px">
      <div class="card-head"><div><h3>Tag picks</h3><p>Which tags to use, based on the ${n} listings analyzed</p></div></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Tag</th><th>Verdict</th><th class="num">Used by</th><th class="num">Avg favorites</th></tr></thead>
      <tbody>${seo.tags
        .map((t) => `<tr><td>${esc(t.term)}</td><td><span class="badge ${KIND_CLS[t.kind] || ''}" ${tipAttr(t.kind === 'Long-tail gem' ? 'Used by fewer listings, but those listings get above-median favorites — less competition for the same buyers.' : t.kind === 'Must-use' ? 'Used by 40%+ of top listings.' : t.kind === 'Strong' ? 'Used by 15%+ of top listings.' : 'Low overlap with winners.')}>${esc(t.kind)}</span></td>
          <td class="num">${t.pct}%</td><td class="num">${fmtInt(t.avg_favorites)}</td></tr>`)
        .join('')}</tbody></table></div>
    </div>
    <p class="muted small">Etsy does not publish search volume, click-through rate or per-listing sales. These figures are estimates built from public listing data — use them to compare keywords against each other, not as exact numbers.</p>`;
}
