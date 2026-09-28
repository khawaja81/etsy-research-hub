import { $, esc, api, compact, fmtInt, money, date, store, removeSaved, dataTable, runPool, errorBox, copyText, scoreBadge } from '../ui.js';

export async function render(view, ctx) {
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Saved Keywords</h1>
      <p>Your keyword shortlist, stored in this browser. Add notes, refresh competition numbers, and export to CSV.</p>
    </div></div>
    <div id="sv-out"></div>`;
  const out = $('#sv-out', view);
  const list = store.get('saved', []);
  if (!list.length) {
    out.innerHTML = `<div class="card empty"><h2>No saved keywords yet</h2><p>Press “☆ Save keyword” on any Keyword Research result, or ☆ in Keyword Ideas.</p></div>`;
    return;
  }

  out.innerHTML = `<div class="card">
    <div class="row" style="margin-bottom:12px">
      <button class="btn sm" id="refresh">Refresh competition</button>
      <button class="btn secondary sm" id="copy">Copy all</button>
      <button class="btn secondary sm" id="compare">Compare first 5</button>
      <span class="spacer"></span>
      <div class="progress hidden" id="prog" style="width:160px"><span style="width:0%"></span></div>
    </div>
    <div id="err"></div>
    <div id="sv-table"></div></div>`;

  const persist = () => store.set('saved', list);
  let table;
  const columns = [
    { key: 'keyword', label: 'Keyword', render: (r) => `<a href="#/keyword?q=${encodeURIComponent(r.keyword)}"><b>${esc(r.keyword)}</b></a>` },
    { key: 'count', label: 'Etsy listings', num: true, render: (r) => compact(r.count) },
    { key: 'opportunity', label: 'Opportunity', num: true, render: (r) => (r.opportunity != null ? `${r.opportunity} ${scoreBadge(r.opportunity >= 70 ? 'Great' : r.opportunity >= 50 ? 'Good' : r.opportunity >= 30 ? 'Fair' : 'Tough', r.opportunity)}` : '—') },
    { key: 'median_price', label: 'Median price', num: true, render: (r) => (r.median_price != null ? money(r.median_price, r.currency || 'USD') : '—') },
    { key: 'median_favorites', label: 'Median favs', num: true, render: (r) => fmtInt(r.median_favorites) },
    { key: 'note', label: 'Note', sortable: false, render: (r) => `<input class="input" data-note style="min-height:30px;padding:4px 8px;min-width:160px" value="${esc(r.note || '')}" placeholder="Add a note…">` },
    { key: 'updated_at', label: 'Updated', render: (r) => `<span class="muted small">${date(r.updated_at)}</span>` },
    { key: '', label: '', sortable: false, csv: false, render: () => `<button class="btn ghost xs" data-del title="Remove">✕</button>` },
  ];
  const draw = () => {
    table = dataTable($('#sv-table', out), { columns, rows: list, sortKey: table?.state.sortKey, sortDir: table?.state.sortDir, filterKeys: ['keyword', 'note'], csvName: 'etsy-saved-keywords.csv', pageSize: 50 });
  };
  draw();

  $('#sv-table', out).addEventListener('change', (e) => {
    if (!e.target.matches('[data-note]')) return;
    const r = list[Number(e.target.closest('tr').dataset.idx)];
    r.note = e.target.value;
    persist();
  });
  $('#sv-table', out).addEventListener('click', (e) => {
    if (!e.target.closest('[data-del]')) return;
    const idx = Number(e.target.closest('tr').dataset.idx);
    removeSaved(list[idx].keyword);
    list.splice(idx, 1);
    if (!list.length) return render(view, ctx);
    draw();
  });
  $('#copy', out).addEventListener('click', () => copyText(list.map((r) => r.keyword).join('\n')));
  $('#compare', out).addEventListener('click', () => ctx.go('/compare', { k: list.slice(0, 5).map((r) => r.keyword).join('|') }));
  $('#refresh', out).addEventListener('click', async (e) => {
    e.target.disabled = true;
    const prog = $('#prog', out);
    prog.classList.remove('hidden');
    try {
      await runPool(list, 2, async (r) => {
        const c = await api('/api/count', { q: r.keyword });
        Object.assign(r, { count: c.count, median_favorites: c.median_favorites ?? r.median_favorites, updated_at: new Date().toISOString() });
      }, (done, total) => ($('span', prog).style.width = `${(done / total) * 100}%`));
    } catch (err) {
      $('#err', out).innerHTML = errorBox(err);
    }
    persist();
    if (!ctx.alive()) return;
    draw();
    e.target.disabled = false;
    prog.classList.add('hidden');
    ctx.refreshStatus();
  });
}
