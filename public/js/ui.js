// Shared UI helpers: escaping, formatting, API calls, charts, tables, storage.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- formatting ----------
const nf = new Intl.NumberFormat('en-US');
export const fmt = (n, d = 0) =>
  n == null || !Number.isFinite(Number(n)) ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);
export const fmtInt = (n) => (n == null ? '—' : nf.format(Math.round(n)));
export function compact(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return fmt(n, a < 10 ? 2 : 0);
}
export function money(n, cur = 'USD', d = 2) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
  } catch {
    return `${fmt(n, d)} ${cur}`;
  }
}
export const pct = (n, d = 0) => (n == null ? '—' : `${fmt(n, d)}%`);
export function ago(days) {
  if (days == null) return '—';
  if (days < 1) return 'today';
  if (days < 31) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30.4)}mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y`;
}
export const date = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

// ---------- api ----------
export async function api(path, params) {
  let url = path;
  if (params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
    url += '?' + p.toString();
  }
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.code = body.code;
    err.status = res.status;
    throw err;
  }
  return body;
}

// ---------- storage (never throws) ----------
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

export function saveKeyword(keyword, snapshot = {}) {
  const list = store.get('saved', []);
  const k = keyword.toLowerCase().trim();
  const i = list.findIndex((x) => x.keyword === k);
  const entry = { ...(i >= 0 ? list[i] : { note: '', saved_at: new Date().toISOString() }), keyword: k, ...snapshot, updated_at: new Date().toISOString() };
  if (i >= 0) list[i] = entry;
  else list.unshift(entry);
  store.set('saved', list);
  return entry;
}
export const isSaved = (keyword) => store.get('saved', []).some((x) => x.keyword === keyword.toLowerCase().trim());
export function removeSaved(keyword) {
  store.set('saved', store.get('saved', []).filter((x) => x.keyword !== keyword));
}
export function pushHistory(keyword) {
  const k = keyword.toLowerCase().trim();
  const list = store.get('history', []).filter((x) => x !== k);
  list.unshift(k);
  store.set('history', list.slice(0, 20));
}

// ---------- feedback ----------
export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export const loading = (text = 'Loading…') => `<div class="loading"><div class="spinner"></div><span>${esc(text)}</span></div>`;

export function errorBox(err) {
  if (err?.code === 'NOT_CONFIGURED') {
    return `<div class="notice warn"><div class="icon">🔑</div><div><h3>Etsy API key is not set up yet</h3>
      <p>This tool reads live data from the official Etsy API. Add <code>ETSY_API_KEY</code> and <code>ETSY_SHARED_SECRET</code>
      in your Railway variables (or <code>.env</code> file locally). <a href="#/setup">See the setup guide →</a></p></div></div>`;
  }
  if (err?.code === 'AUTH') {
    return `<div class="notice bad"><div class="icon">⛔</div><div><h3>Etsy rejected the API key</h3>
      <p>${esc(err.message)}</p><p class="small" style="margin-top:6px">Check that both the keystring and shared secret are correct and your app is active. <a href="#/setup">Setup guide →</a></p></div></div>`;
  }
  if (err?.code === 'RATE_LIMIT') {
    return `<div class="notice warn"><div class="icon">⏳</div><div><h3>Etsy rate limit reached</h3><p>Wait a minute and try again. Results you already loaded are cached.</p></div></div>`;
  }
  return `<div class="notice bad"><div class="icon">⚠️</div><div><h3>Something went wrong</h3><p>${esc(err?.message || err)}</p></div></div>`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Copied to clipboard');
  }
}

export function downloadCSV(filename, columns, rows) {
  const cell = (v) => {
    const s = Array.isArray(v) ? v.join(', ') : String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(c.csv ? c.csv(r) : r[c.key])).join(','));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- tooltip (any element with data-tip) ----------
export function initTooltip() {
  const tip = $('#tooltip');
  let current = null;
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    current = t;
    tip.innerHTML = t.dataset.tip;
    tip.classList.add('show');
  });
  document.addEventListener('mousemove', (e) => {
    if (!current) return;
    const pad = 14;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
  document.addEventListener('mouseout', (e) => {
    if (current && !current.contains(e.relatedTarget)) {
      current = null;
      tip.classList.remove('show');
    }
  });
}
export const tipAttr = (html) => `data-tip="${esc(html)}"`;

// ---------- components ----------
export function tile(label, value, sub = '', { info, meter, meterColor } = {}) {
  return `<div class="tile">
    <div class="tile-label">${esc(label)}${info ? ` <span class="info" ${tipAttr(info)}>i</span>` : ''}</div>
    <div class="tile-value">${value}</div>
    ${sub ? `<div class="tile-sub">${sub}</div>` : ''}
    ${meter != null ? `<div class="meter"><span style="width:${Math.max(2, Math.min(100, meter))}%;background:${meterColor || 'var(--series)'}"></span></div>` : ''}
  </div>`;
}

// Score color: higher = better unless inverse
export function scoreColor(v, inverse = false) {
  if (v == null) return 'var(--muted)';
  const s = inverse ? 100 - v : v;
  return s >= 65 ? 'var(--good)' : s >= 45 ? 'var(--warn)' : s >= 25 ? 'var(--serious)' : 'var(--critical)';
}
export function scoreBadge(label, v, inverse = false) {
  if (v == null) return `<span class="badge">${esc(label)}</span>`;
  const s = inverse ? 100 - v : v;
  const cls = s >= 65 ? 'good' : s >= 45 ? 'warn' : 'bad';
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

// Horizontal bar list. items: [{label, value, tip, action}]
export function barList(items, { format = fmtInt, clickable = false, max } = {}) {
  if (!items.length) return `<p class="muted small">No data.</p>`;
  const m = max ?? Math.max(...items.map((i) => i.value || 0), 1);
  return `<div class="bars">${items
    .map(
      (i) => `<div class="bar-row" ${i.tip ? tipAttr(i.tip) : ''}>
        ${clickable ? `<button class="label" data-action="${esc(i.action || '')}" data-value="${esc(i.label)}" title="${esc(i.label)}">${esc(i.label)}</button>` : `<span class="label" title="${esc(i.label)}">${esc(i.label)}</span>`}
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(1, ((i.value || 0) / m) * 100)}%"></div></div>
        <span class="val">${format(i.value)}</span></div>`
    )
    .join('')}</div>`;
}

// Column chart. items: [{label, value, tip}]
export function columnChart(items, { height = 180, showValues = true } = {}) {
  if (!items.length) return `<p class="muted small">No data.</p>`;
  const m = Math.max(...items.map((i) => i.value || 0), 1);
  const maxIdx = items.findIndex((i) => i.value === m);
  return `<div class="cols" style="height:${height}px">${items
    .map(
      (i, idx) => `<div class="col" ${i.tip ? tipAttr(i.tip) : ''}>
        ${showValues && (idx === maxIdx || items.length <= 8) && i.value ? `<span class="col-val">${fmtInt(i.value)}</span>` : ''}
        <div class="col-fill" style="height:${((i.value || 0) / m) * (height - 22)}px"></div></div>`
    )
    .join('')}</div>
    <div class="col-labels">${items.map((i) => `<span title="${esc(i.label)}">${esc(i.label)}</span>`).join('')}</div>`;
}

// Sortable, filterable, paginated table.
// columns: [{key, label, num, sortable, render(row), sortValue(row), csv(row)}]
export function dataTable(container, { columns, rows, sortKey, sortDir = 'desc', pageSize = 25, filterKeys = [], csvName, expand, toolsExtra = '' }) {
  const state = { sortKey, sortDir, page: 0, filter: '', open: new Set() };
  container.innerHTML = `
    <div class="table-tools">
      ${filterKeys.length ? `<input class="input" type="search" placeholder="Filter rows…" data-role="filter">` : ''}
      <span class="muted small" data-role="count"></span>
      <span class="spacer"></span>
      ${toolsExtra}
      ${csvName ? `<button class="btn secondary sm" data-role="csv">Export CSV</button>` : ''}
    </div>
    <div class="table-wrap"><table class="data"><thead></thead><tbody></tbody></table></div>
    <div class="pager" data-role="pager"></div>`;
  const thead = $('thead', container);
  const tbody = $('tbody', container);
  const visible = columns.filter((c) => !c.hidden);

  const val = (c, r) => (c.sortValue ? c.sortValue(r) : r[c.key]);
  const filtered = () => {
    const f = state.filter.toLowerCase();
    let list = rows;
    if (f) list = rows.filter((r) => filterKeys.some((k) => String(Array.isArray(r[k]) ? r[k].join(' ') : r[k] ?? '').toLowerCase().includes(f)));
    const col = columns.find((c) => c.key === state.sortKey);
    if (col) {
      const dir = state.sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const va = val(col, a);
        const vb = val(col, b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * dir;
      });
    }
    return list;
  };

  function draw() {
    thead.innerHTML = `<tr>${visible
      .map((c) => {
        const sortable = c.sortable !== false && c.key;
        const sorted = state.sortKey === c.key;
        return `<th class="${c.num ? 'num' : ''} ${sortable ? 'sortable' : ''} ${sorted ? 'sorted' : ''}" data-key="${sortable ? c.key : ''}">${esc(c.label)}${sortable ? `<span class="arrow">${sorted ? (state.sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>` : ''}</th>`;
      })
      .join('')}</tr>`;
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const slice = list.slice(state.page * pageSize, (state.page + 1) * pageSize);
    tbody.innerHTML = slice.length
      ? slice
          .map((r, i) => {
            const idx = rows.indexOf(r);
            const main = `<tr data-idx="${idx}">${visible.map((c) => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key] ?? '—')}</td>`).join('')}</tr>`;
            const extra = expand && state.open.has(idx) ? `<tr class="expand"><td colspan="${visible.length}">${expand(r)}</td></tr>` : '';
            return main + extra;
          })
          .join('')
      : `<tr><td colspan="${visible.length}" class="muted" style="text-align:center;padding:24px">No rows match.</td></tr>`;
    $('[data-role=count]', container).textContent = `${list.length} of ${rows.length} rows`;
    $('[data-role=pager]', container).innerHTML =
      pages > 1
        ? `<button class="btn secondary xs" data-page="prev" ${state.page === 0 ? 'disabled' : ''}>← Prev</button>
           <span>Page ${state.page + 1} / ${pages}</span>
           <button class="btn secondary xs" data-page="next" ${state.page >= pages - 1 ? 'disabled' : ''}>Next →</button>`
        : '';
  }

  // onclick (not addEventListener) so re-creating a table in the same container never stacks handlers
  container.onclick = (e) => {
    const th = e.target.closest('th[data-key]');
    if (th && th.dataset.key) {
      const k = th.dataset.key;
      if (state.sortKey === k) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else {
        state.sortKey = k;
        const col = columns.find((c) => c.key === k);
        state.sortDir = col.num ? 'desc' : 'asc';
      }
      draw();
      return;
    }
    const pg = e.target.closest('[data-page]');
    if (pg) {
      state.page += pg.dataset.page === 'next' ? 1 : -1;
      draw();
      return;
    }
    if (e.target.closest('[data-role=csv]')) {
      downloadCSV(csvName, columns.filter((c) => c.key && c.csv !== false), filtered());
      return;
    }
    const tog = e.target.closest('[data-toggle]');
    if (tog && expand) {
      const idx = Number(tog.closest('tr').dataset.idx);
      state.open.has(idx) ? state.open.delete(idx) : state.open.add(idx);
      draw();
    }
  };
  const f = $('[data-role=filter]', container);
  if (f)
    f.addEventListener('input', () => {
      state.filter = f.value;
      state.page = 0;
      draw();
    });
  draw();
  return { redraw: draw, state };
}

// Shared listing columns (keyword + shop pages)
export function listingColumns({ showRank = true, showShop = true } = {}) {
  const cols = [];
  if (showRank) cols.push({ key: 'rank', label: '#', num: true, render: (r) => `<span class="muted">${r.rank ?? ''}</span>` });
  cols.push(
    {
      key: 'thumb',
      label: '',
      sortable: false,
      csv: false,
      render: (r) => (r.thumb ? `<img class="thumb" loading="lazy" src="${esc(r.thumb)}" alt="">` : `<div class="thumb"></div>`),
    },
    {
      key: 'title',
      label: 'Listing',
      cls: 'title-cell',
      render: (r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
        <div class="row small muted" style="gap:8px;margin-top:3px">
          ${showShop && r.shop_name ? `<a class="muted" href="#/shop?name=${encodeURIComponent(r.shop_name)}">${esc(r.shop_name)}</a>` : ''}
          ${r.is_digital ? '<span class="badge blue">Digital</span>' : ''}
          ${r.is_personalizable ? '<span class="badge">Personalizable</span>' : ''}
          <button class="link-btn small" data-toggle>${r.tags.length} tags ▾</button>
          <a class="small" href="#/listing?id=${r.id}">Analyze</a>
        </div>`,
    },
    { key: 'price_usd', label: 'Price', num: true, sortValue: (r) => r.price_usd ?? r.price, render: (r) => priceCell(r), csv: (r) => r.price_usd ?? r.price },
    { key: 'views', label: 'Views', num: true, render: (r) => fmtInt(r.views) },
    { key: 'favorites', label: 'Favorites', num: true, render: (r) => fmtInt(r.favorites) },
    { key: 'favs_per_day', label: 'Favs/day', num: true, render: (r) => fmt(r.favs_per_day, 2) },
    { key: 'views_per_day', label: 'Views/day', num: true, render: (r) => fmt(r.views_per_day, 1) },
    { key: 'age_days', label: 'Age', num: true, render: (r) => `<span ${tipAttr('Created ' + date(r.created))}>${ago(r.age_days)}</span>` },
    { key: 'shop_sales', label: 'Shop sales', num: true, render: (r) => compact(r.shop_sales) }
  );
  cols.push({ key: 'tags', label: 'Tags', sortable: false, render: () => '', csv: (r) => r.tags.join(', '), hidden: true });
  cols.push({ key: 'url', label: 'URL', sortable: false, render: () => '', hidden: true });
  return cols;
}

export function priceCell(r) {
  if (r.price_usd != null && r.currency && r.currency !== 'USD')
    return `<span ${tipAttr(`${money(r.price, r.currency)} (converted)`)}>${money(r.price_usd)}</span>`;
  return money(r.price, r.currency || 'USD');
}

export function tagsExpand(r) {
  return `<div class="stack" style="gap:8px">
    <div class="chips">${r.tags.map((t) => `<a class="chip" href="#/keyword?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('') || '<span class="muted small">No tags</span>'}</div>
    ${r.materials?.length ? `<div class="small muted">Materials: ${esc(r.materials.join(', '))}</div>` : ''}
    ${r.category ? `<div class="small muted">Category: ${esc(r.category)}</div>` : ''}
    <div class="row"><button class="btn secondary xs" data-copy-tags="${esc(r.tags.join(', '))}">Copy tags</button></div>
  </div>`;
}

export const stars = (n) => (n == null ? '' : '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)));

// Runs async tasks with limited concurrency, reporting progress.
export async function runPool(items, size, fn, onProgress) {
  let i = 0;
  let done = 0;
  let stop = false;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length && !stop) {
      const idx = i++;
      try {
        await fn(items[idx], idx);
      } catch (err) {
        if (err?.code === 'NOT_CONFIGURED' || err?.code === 'AUTH') {
          stop = true;
          throw err;
        }
      }
      done++;
      onProgress?.(done, items.length);
    }
  });
  await Promise.all(workers);
}
