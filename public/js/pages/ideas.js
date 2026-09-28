import { $, esc, api, loading, errorBox, compact, fmtInt, dataTable, runPool, copyText, saveKeyword, toast, scoreBadge } from '../ui.js';
import { icons } from '../icons.js';

const MODES = [
  ['none', 'Basic suggestions'],
  ['modifiers', 'Etsy buyer modifiers (gift, personalized…)'],
  ['alphabet', 'A–Z long-tail (more results, slower)'],
  ['questions', 'Intent words (best, cheap, for, with…)'],
];
const COUNTRIES = [
  ['us', 'United States'], ['gb', 'United Kingdom'], ['ca', 'Canada'], ['au', 'Australia'], ['de', 'Germany'], ['fr', 'France'], ['in', 'India'], ['pk', 'Pakistan'],
];
const SOURCE_LABEL = { google: 'Google', 'etsy-intent': '“etsy …”', amazon: 'Amazon' };

const clamp = (n) => Math.max(0, Math.min(100, n));
function quickScore(count, medFav) {
  if (count == null) return null;
  const comp = clamp((Math.log10(Math.max(count, 1)) - 2) * 25);
  const demand = medFav != null ? clamp(33 * Math.log10(1 + medFav)) : 0;
  return Math.round(0.55 * demand + 0.45 * (100 - comp));
}

export async function render(view, ctx) {
  const p = ctx.params;
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Keyword Ideas</h1>
      <p>Find long-tail keywords real buyers type. Ideas come from Google autocomplete, “etsy …” searches on Google, and Amazon marketplace autocomplete. Then check Etsy competition for each one.</p>
    </div></div>
    <form class="card" id="idea-form" autocomplete="off">
      <div class="search-bar">
        <input class="input" name="q" placeholder="Seed keyword, e.g. candle" value="${esc(p.q || '')}" required>
        <button class="btn" type="submit">${icons.bulb} Find ideas</button>
      </div>
      <div class="field-row" style="margin-top:12px">
        <label class="field">Expansion
          <select class="input" name="expand">${MODES.map(([v, l]) => `<option value="${v}" ${v === (p.expand || 'modifiers') ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </label>
        <label class="field">Buyer country
          <select class="input" name="country">${COUNTRIES.map(([v, l]) => `<option value="${v}" ${v === (p.country || 'us') ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </label>
      </div>
    </form>
    <div id="idea-out" class="stack" style="margin-top:18px"></div>`;

  const form = $('#idea-form', view);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ctx.go('/ideas', { q: form.q.value.trim(), expand: form.expand.value, country: form.country.value });
  });

  const out = $('#idea-out', view);
  if (!p.q) {
    out.innerHTML = `<div class="card empty"><h2>Enter a seed keyword</h2><p>Use a short product word like <em>necklace</em>, <em>wall art</em> or <em>dog bandana</em>.</p></div>`;
    return;
  }

  const expand = p.expand || 'modifiers';
  out.innerHTML = loading(expand === 'alphabet' ? 'Collecting A–Z suggestions (takes ~10 seconds)…' : 'Collecting keyword ideas…');
  let data;
  try {
    data = await api('/api/suggest', { q: p.q, expand, country: p.country || 'us' });
  } catch (err) {
    if (ctx.alive()) out.innerHTML = errorBox(err);
    return;
  }
  if (!ctx.alive()) return;

  const all = data.results.map((r) => ({ ...r, count: null, competition: null, median_favorites: null, score: null, status: '' }));
  if (!all.length) {
    out.innerHTML = `<div class="card empty"><h2>No suggestions found</h2><p>Try a shorter or more common seed keyword.</p></div>`;
    return;
  }

  out.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div><h3>${all.length} keyword ideas for “${esc(data.seed)}”</h3><p>Ideas found by several sources are usually searched more often.</p></div>
        <div class="row">
          <label class="row small" style="gap:6px"><input type="checkbox" id="only-rel" checked> Must contain seed words</label>
          <select class="input" id="min-words" style="width:auto;min-height:34px;padding:4px 8px">
            <option value="1">Any length</option><option value="2">2+ words</option><option value="3">3+ words (long-tail)</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-bottom:12px">
        <button class="btn sm" id="check-btn">Check Etsy competition</button>
        <button class="btn secondary sm" id="copy-btn">Copy keywords</button>
        <span class="muted small" id="check-note">Uses 1 Etsy API call per keyword (first 40 shown).</span>
      </div>
      <div class="progress hidden" id="prog"><span style="width:0%"></span></div>
      <div id="ideas-table" style="margin-top:12px"></div>
    </div>`;

  let rows = all;
  let table;
  const columns = [
    { key: 'keyword', label: 'Keyword', render: (r) => `<a href="#/keyword?q=${encodeURIComponent(r.keyword)}"><b>${esc(r.keyword)}</b></a>` },
    {
      key: 'sources',
      label: 'Found in',
      sortValue: (r) => r.sources.length * 100 + r.hits,
      render: (r) => r.sources.map((s) => `<span class="badge ${s === 'etsy-intent' ? 'accent' : 'blue'}">${SOURCE_LABEL[s] || s}</span>`).join(' '),
      csv: (r) => r.sources.join(' '),
    },
    { key: 'words', label: 'Words', num: true },
    {
      key: 'count',
      label: 'Etsy listings',
      num: true,
      render: (r) => (r.count != null ? compact(r.count) : r.status === 'error' ? '<span class="muted">error</span>' : `<button class="btn secondary xs" data-check>${r.status === 'loading' ? '…' : 'Check'}</button>`),
    },
    { key: 'competition', label: 'Competition', render: (r) => (r.competition ? scoreBadge(r.competition, r.count != null ? Math.max(0, Math.min(100, (Math.log10(Math.max(r.count, 1)) - 2) * 25)) : null, true) : '') },
    { key: 'median_favorites', label: 'Top favs', num: true, render: (r) => fmtInt(r.median_favorites) },
    { key: 'score', label: 'Quick score', num: true, render: (r) => (r.score != null ? `<b>${r.score}</b>` : '') },
    { key: '', label: '', sortable: false, csv: false, render: () => `<button class="btn ghost xs" data-save title="Save keyword">☆</button>` },
  ];

  const draw = () => {
    const onlyRel = $('#only-rel', out).checked;
    const minWords = Number($('#min-words', out).value);
    rows = all.filter((r) => (!onlyRel || r.relevant) && r.words >= minWords);
    table = dataTable($('#ideas-table', out), {
      columns,
      rows,
      sortKey: table?.state.sortKey || 'sources',
      sortDir: table?.state.sortDir || 'desc',
      pageSize: 40,
      filterKeys: ['keyword'],
      csvName: `etsy-keyword-ideas-${data.seed.replace(/\W+/g, '-')}.csv`,
    });
  };
  draw();
  $('#only-rel', out).addEventListener('change', draw);
  $('#min-words', out).addEventListener('change', draw);

  async function check(list) {
    const prog = $('#prog', out);
    prog.classList.remove('hidden');
    list.forEach((r) => (r.status = 'loading'));
    table.redraw();
    try {
      await runPool(
        list,
        2,
        async (r) => {
          try {
            const c = await api('/api/count', { q: r.keyword });
            Object.assign(r, { count: c.count, competition: c.competition, median_favorites: c.median_favorites, status: 'done' });
            r.score = quickScore(c.count, c.median_favorites);
          } catch (err) {
            r.status = 'error';
            throw err;
          }
          if (ctx.alive()) table.redraw();
        },
        (done, total) => ($('span', prog).style.width = `${(done / total) * 100}%`)
      );
    } catch (err) {
      list.forEach((r) => r.status === 'loading' && (r.status = ''));
      $('#check-note', out).innerHTML = '';
      out.insertAdjacentHTML('afterbegin', errorBox(err));
    }
    if (!ctx.alive()) return;
    table.redraw();
    ctx.refreshStatus();
    setTimeout(() => prog.classList.add('hidden'), 600);
  }

  $('#check-btn', out).addEventListener('click', async (e) => {
    e.target.disabled = true;
    await check(rows.filter((r) => r.count == null).slice(0, 40));
    e.target.disabled = false;
  });
  $('#copy-btn', out).addEventListener('click', () => copyText(rows.map((r) => r.keyword).join('\n')));
  $('#ideas-table', out).addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const r = rows[Number(tr.dataset.idx)];
    if (e.target.closest('[data-check]')) check([r]);
    if (e.target.closest('[data-save]')) {
      saveKeyword(r.keyword, r.count != null ? { count: r.count, median_favorites: r.median_favorites } : {});
      toast(`Saved “${r.keyword}”`);
    }
  });
}
