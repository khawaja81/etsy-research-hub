import { $, esc, api, errorBox, compact, fmt, fmtInt, money, pct, barList, store, scoreBadge, tipAttr } from '../ui.js';
import { icons } from '../icons.js';

export async function render(view, ctx) {
  const initial = (ctx.params.k ? ctx.params.k.split('|') : store.get('compare', [])).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  let keywords = [...new Set(initial)];

  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Compare Keywords</h1>
      <p>Put up to 5 keywords side by side. Each one analyzes the top 100 Etsy listings (≈2 API calls per keyword, cached for an hour).</p>
    </div></div>
    <form class="card" id="cmp-form" autocomplete="off">
      <div class="search-bar">
        <input class="input" name="kw" placeholder="Add a keyword and press Enter">
        <button class="btn secondary" type="submit">Add</button>
        <button class="btn" type="button" id="run">${icons.compare} Compare</button>
      </div>
      <div class="chips" id="kw-chips" style="margin-top:12px"></div>
    </form>
    <div id="cmp-out" class="stack" style="margin-top:18px"></div>`;

  const form = $('#cmp-form', view);
  const chips = $('#kw-chips', view);
  const drawChips = () => {
    chips.innerHTML = keywords.length
      ? keywords.map((k, i) => `<span class="chip accent">${esc(k)} <button type="button" class="x" data-rm="${i}" aria-label="Remove">×</button></span>`).join('')
      : '<span class="muted small">No keywords yet — add 2 to 5.</span>';
    store.set('compare', keywords);
  };
  drawChips();
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    keywords.splice(Number(b.dataset.rm), 1);
    drawChips();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = form.kw.value.trim().toLowerCase();
    if (!v) return;
    if (keywords.length >= 5) return alert('Maximum 5 keywords');
    if (!keywords.includes(v)) keywords.push(v);
    form.kw.value = '';
    drawChips();
  });
  $('#run', view).addEventListener('click', () => {
    if (keywords.length < 1) return;
    ctx.go('/compare', { k: keywords.join('|') });
  });

  const out = $('#cmp-out', view);
  if (!ctx.params.k || !keywords.length) {
    out.innerHTML = `<div class="card empty"><h2>Add keywords, then press Compare</h2><p>Tip: compare a broad term with 2–3 long-tail versions, e.g. <em>mug</em> vs <em>personalized dog mom mug</em>.</p></div>`;
    return;
  }

  const results = [];
  const renderTable = () => {
    const done = results.filter((r) => r.data);
    const cell = (r, fn) => (r.data ? fn(r.data) : r.error ? '<span class="muted">error</span>' : '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>');
    const best = (fn, higher = true) => {
      const vals = done.map((r) => fn(r.data)).filter((v) => v != null);
      if (vals.length < 2) return null;
      return higher ? Math.max(...vals) : Math.min(...vals);
    };
    const mark = (v, b) => (b != null && v === b ? ' style="background:var(--good-soft);font-weight:700"' : '');
    const rows = [
      ['Active listings', (d) => d.total_count, (v) => compact(v), false, 'Fewer = less competition'],
      ['Competition', (d) => d.scores.competition, (v, d) => `${v}/100 ${scoreBadge(d.scores.competition_label, v, true)}`, false],
      ['Demand score', (d) => d.scores.demand, (v) => (v == null ? '—' : `${v}/100`), true, 'From favorites & views/day of the top 48'],
      ['Opportunity score', (d) => d.scores.opportunity, (v, d) => (v == null ? '—' : `<b>${v}</b>/100 ${scoreBadge(d.scores.opportunity_label, v)}`), true],
      ['Median price', (d) => d.summary.price.median, (v, d) => money(v, d.summary.price_currency), null],
      ['Price sweet spot', () => null, (_, d) => `${money(d.summary.price.p25, d.summary.price_currency, 0)}–${money(d.summary.price.p75, d.summary.price_currency, 0)}`, null],
      ['Median favorites', (d) => d.summary.favorites.median, (v) => fmtInt(v), true],
      ['Avg views/day', (d) => d.summary.views_per_day.avg, (v) => fmt(v, 1), true],
      ['New listings in top 48', (d) => d.scores.new_listing_share, (v) => pct(v), true, 'Higher = easier for new shops to rank'],
      ['Digital share', (d) => d.summary.mix.digital, (v) => pct(v), null],
      ['Personalizable', (d) => d.summary.mix.personalizable, (v) => pct(v), null],
      ['Top tags', () => null, (_, d) => `<div class="chips">${d.summary.tags.slice(0, 6).map((t) => `<a class="chip" href="#/keyword?q=${encodeURIComponent(t.term)}">${esc(t.term)}</a>`).join('')}</div>`, null],
    ];
    return `<div class="table-wrap"><table class="data">
      <thead><tr><th>Metric</th>${results.map((r) => `<th><a href="#/keyword?q=${encodeURIComponent(r.keyword)}">${esc(r.keyword)}</a></th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(([label, get, show, higher, hint]) => {
          const b = higher == null ? null : best(get, higher);
          return `<tr><td class="nowrap">${esc(label)}${hint ? ` <span class="info" ${tipAttr(hint)}>i</span>` : ''}</td>${results
            .map((r) => `<td${r.data ? mark(get(r.data), b) : ''}>${cell(r, (d) => show(get(d), d))}</td>`)
            .join('')}</tr>`;
        })
        .join('')}</tbody></table></div>
      <p class="muted small" style="margin-top:8px">Green = best value in the row.</p>`;
  };

  out.innerHTML = `<div class="card"><div class="card-head"><h3>Side-by-side</h3></div><div id="cmp-table"></div></div>
    <div class="card"><div class="card-head"><div><h3>Opportunity score</h3><p>Higher = better balance of demand vs. competition</p></div></div><div id="cmp-chart"></div></div>
    <div id="cmp-err"></div>`;

  keywords.forEach((k) => results.push({ keyword: k, data: null, error: null }));
  const redraw = () => {
    $('#cmp-table', out).innerHTML = renderTable();
    const done = results.filter((r) => r.data);
    $('#cmp-chart', out).innerHTML = done.length
      ? barList(
          done.map((r) => ({ label: r.keyword, value: r.data.scores.opportunity ?? 0, tip: `<b>${esc(r.keyword)}</b><br>Opportunity ${r.data.scores.opportunity}/100` })),
          { max: 100 }
        )
      : '<p class="muted small">Loading…</p>';
  };
  redraw();

  for (const r of results) {
    try {
      r.data = await api('/api/keyword', { q: r.keyword, depth: 100 });
    } catch (err) {
      r.error = err;
      if (ctx.alive() && !$('#cmp-err', out).innerHTML) $('#cmp-err', out).innerHTML = errorBox(err);
      if (err.code === 'NOT_CONFIGURED' || err.code === 'AUTH') {
        results.forEach((x) => !x.data && (x.error = err));
        redraw();
        break;
      }
    }
    if (!ctx.alive()) return;
    redraw();
  }
  ctx.refreshStatus();
}
