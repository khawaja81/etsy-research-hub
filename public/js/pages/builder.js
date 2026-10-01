import { $, $$, esc, api, send, loading, errorBox, tile, fmtInt, compact, money, pct, barList, copyText, toast, store, tipAttr, downloadCSV, scoreColor, scoreBadge, dataTable } from '../ui.js';
import { icons } from '../icons.js';
import {
  P, G, scoreRing, ETSY_NOTICE, ITEM_TYPES, renderIssues, scoreLabel, autoFix, normalizeAi, droppedTerms, fullText, toMarket,
  savedListings, saveListing, deleteListing, historyForUniqueness, toSaved,
} from '../builder/shared.js';

const FORM_KEY = 'builder-form';
const BULK_KEY = 'builder-bulk';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const compScore = (count) => (count == null ? null : Math.max(0, Math.min(100, Math.round((Math.log10(Math.max(count, 1)) - 2) * 25))));

function builderError(err) {
  if (err?.code === 'AI_NOT_CONFIGURED') {
    return `<div class="notice warn"><div class="icon">🤖</div><div><h3>AI writer is off</h3><p>Add a free <code>GEMINI_API_KEY</code> (from aistudio.google.com) to the environment and restart, or untick “Use AI writer” to use the built-in writer.</p></div></div>`;
  }
  if (/^AI_/.test(err?.code || '')) {
    return `<div class="notice bad"><div class="icon">🤖</div><div><h3>AI writer problem</h3><p>${esc(err.message)}</p><p class="small">Untick “Use AI writer” to use the built-in writer meanwhile.</p></div></div>`;
  }
  return errorBox(err);
}

export async function render(view, ctx) {
  let status = { etsy: false, ai: false };
  try {
    status = await api('/api/builder/status');
  } catch {
    /* page still works */
  }
  if (!ctx.alive()) return;

  const f0 = store.get(FORM_KEY, {});
  const v = (k, d = '') => esc(f0[k] ?? d);
  const sel = (k, val, d) => ((f0[k] ?? d) === val ? 'selected' : '');
  const chk = (k) => (f0[k] ? 'checked' : '');
  const mode = ctx.params.mode === 'bulk' ? 'bulk' : 'single';

  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Listing Builder</h1>
      <p>Reads <b>live Etsy search data</b> for your keyword and writes a unique, policy-checked listing — 3 titles, 13 tags, description, materials and photo alt text. Bulk mode does many products in one go. Nothing is posted to Etsy: you review and paste it in yourself.</p>
    </div></div>

    <div class="row" style="gap:8px;margin-bottom:14px">
      <div class="tabs" id="mode-tabs"><button data-mode="single" class="${mode === 'single' ? 'active' : ''}">One listing</button><button data-mode="bulk" class="${mode === 'bulk' ? 'active' : ''}">Bulk — many products</button></div>
      <span class="spacer"></span>
      <span class="badge ${status.etsy ? 'good' : 'warn'}">${status.etsy ? '● Live Etsy data on' : '○ Live Etsy data off'}</span>
      <span class="badge ${status.ai ? 'good' : ''}" ${status.ai ? tipAttr(esc(status.model || '')) : ''}>${status.ai ? `● AI writer on${status.provider === 'gemini' ? ' (Gemini free)' : ''}` : '○ AI writer off — built-in writer'}</span>
      <span class="badge blue" ${tipAttr('Read-only official Etsy API: this tool never logs in to your shop, never scrapes Etsy and never posts or edits listings.')}>🔒 Account-safe</span>
    </div>

    <form class="card stack" id="b-form" autocomplete="off">
      <div class="card-head" style="margin-bottom:0">
        <div><h3 id="form-title">${mode === 'bulk' ? 'Shop settings for every product' : 'Your product'}</h3><p id="form-sub">${mode === 'bulk' ? 'These apply to all products in the list below.' : 'Only “Product type” is required. The more you fill in, the better the listing.'}</p></div>
        <div class="row single-only"><button class="btn ghost sm" type="button" id="sample">Fill example</button><button class="btn ghost sm" type="button" id="reset">Clear</button></div>
      </div>
      <div class="field-row single-only">
        <label class="field" style="grid-column:1/-1">Product type *<input class="input" name="productType" maxlength="80" placeholder="e.g. Personalized Ceramic Coffee Mug" value="${v('productType')}"></label>
        <label class="field">Etsy search keyword <span class="muted">(what buyers type)</span><input class="input" name="searchKeyword" maxlength="120" placeholder="defaults to the product type" value="${v('searchKeyword')}"></label>
        <label class="field">Main keywords <span class="muted">(comma separated)</span><input class="input" name="keywords" placeholder="name mug, custom coffee mug" value="${v('keywords')}"></label>
      </div>
      <div class="field-row">
        <label class="field">Item type<select class="input" name="itemType">${ITEM_TYPES.map(([k, l]) => `<option value="${k}" ${sel('itemType', k, 'handmade')}>${l}</option>`).join('')}</select></label>
        <label class="field single-only">Category<select class="input" name="category">${Object.entries(G.CATEGORY).map(([k, c]) => `<option value="${k}" ${sel('category', k, 'other')}>${esc(c.label)}</option>`).join('')}</select></label>
        <label class="field single-only">Materials<input class="input" name="materials" placeholder="stoneware, glaze" value="${v('materials')}"></label>
        <label class="field single-only">Colors<input class="input" name="colors" placeholder="white, sage green" value="${v('colors')}"></label>
        <label class="field single-only">Size / file format<input class="input" name="size" placeholder="12 oz, 4 in tall" value="${v('size')}"></label>
        <label class="field single-only">Style<input class="input" name="styles" placeholder="minimalist, boho" value="${v('styles')}"></label>
        <label class="field single-only">Occasions<input class="input" name="occasions" placeholder="Mother's Day, birthday" value="${v('occasions')}"></label>
        <label class="field single-only">Recipients<input class="input" name="recipients" placeholder="mom, coffee lover" value="${v('recipients')}"></label>
        <label class="field single-only">Extra features<input class="input" name="features" placeholder="dishwasher safe, gift box" value="${v('features')}"></label>
        <label class="field">Processing time<input class="input" name="processing" placeholder="1–3 business days" value="${v('processing')}"></label>
        <label class="field">Shop name<input class="input" name="shopName" value="${v('shopName')}"></label>
        <label class="field">Tone<select class="input" name="tone">${['friendly', 'elegant', 'playful', 'professional'].map((t) => `<option value="${t}" ${sel('tone', t, 'friendly')}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label>
        <label class="field">Title length<select class="input" name="titleLength"><option value="short" ${sel('titleLength', 'short', 'short')}>Short (Etsy recommended)</option><option value="detailed" ${sel('titleLength', 'detailed', 'short')}>Detailed (up to 140)</option></select></label>
        <label class="field">Listings to analyze<select class="input" name="depth">${[100, 200, 300].map((d) => `<option ${String(d) === String(f0.depth || 100) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      </div>
      <div class="row" style="gap:18px">
        <label class="row small single-only" style="gap:6px"><input type="checkbox" name="personalized" ${chk('personalized')}> Personalized / custom</label>
        <label class="row small" style="gap:6px"><input type="checkbox" name="productionPartner" ${chk('productionPartner')}> Uses a production partner</label>
        <label class="row small" style="gap:6px"><input type="checkbox" name="aiDesign" ${chk('aiDesign')}> AI tools used in the design</label>
        ${status.ai ? `<label class="row small" style="gap:6px"><input type="checkbox" name="useAi" ${f0.useAi === false ? '' : 'checked'}> <b>Use AI writer</b></label>` : ''}
      </div>
      <label class="field single-only ${f0.personalized ? '' : 'hidden'}" id="pers-wrap">Personalization instructions<input class="input" name="personalizationDetails" placeholder="name up to 12 characters, pick font 1–5" value="${v('personalizationDetails')}"></label>
      ${status.ai ? `<label class="field single-only">Notes for the AI <span class="muted">(optional)</span><textarea class="input" name="extraNotes" rows="2" maxlength="1500">${v('extraNotes')}</textarea></label>` : ''}
      <details class="advanced single-only">
        <summary>Price filter for the market research</summary>
        <div class="field-row">
          <label class="field">Min price (USD)<input class="input" type="number" min="0" step="0.01" name="min_price" value="${v('min_price')}"></label>
          <label class="field">Max price (USD)<input class="input" type="number" min="0" step="0.01" name="max_price" value="${v('max_price')}"></label>
        </div>
      </details>
      <div class="row single-only">
        <button class="btn" type="submit" id="go">${icons.search} ${status.etsy ? 'Research Etsy & write listing' : 'Write listing'}</button>
        <span class="muted small" id="form-msg"></span>
      </div>
    </form>

    <div id="single-area" class="${mode === 'single' ? '' : 'hidden'}">
      <div id="b-out" class="stack" style="margin-top:18px"></div>
      <div id="b-market" class="stack" style="margin-top:18px"></div>
      <div class="card" style="margin-top:18px">
        <div class="card-head"><div><h3>Keyword ideas</h3><p>Buyer searches from Google & “etsy …” autocomplete, with a live Etsy competition check. + adds one as a tag.</p></div>
          <button class="btn secondary sm" id="ideas-btn">${icons.bulb} Find ideas</button></div>
        <div id="ideas-out"><p class="muted small">Uses your Etsy search keyword (or product type).</p></div>
      </div>
    </div>

    <div id="bulk-area" class="${mode === 'bulk' ? '' : 'hidden'}" style="margin-top:18px">
      <div class="card stack">
        <div class="card-head" style="margin-bottom:0"><div><h3>Products — one per line</h3>
          <p><code>product type | search keyword | main keywords | recipients | occasions | colors | materials | style</code> — only the product type is required; leave a part empty with <code>| |</code>. Category and “personalized” are detected automatically.</p></div></div>
        <textarea class="input" id="bulk-input" rows="8" placeholder="Personalized Ceramic Coffee Mug | personalized mug | name mug, custom mug | mom, grandma | Mother's Day | white | stoneware | minimalist
Wooden Baby Name Sign | baby name sign | nursery sign, name sign | new parents | baby shower | white | birch wood | rustic
Minimalist Line Art Print | line art print | abstract wall art | | housewarming | black | | minimalist">${esc(store.get(BULK_KEY, ''))}</textarea>
        <div class="row">
          <button class="btn" id="bulk-go">${icons.search} Research & write all</button>
          <button class="btn secondary hidden" id="bulk-stop">Stop</button>
          <button class="btn secondary" id="bulk-save" disabled>☆ Save all</button>
          <button class="btn secondary" id="bulk-csv" disabled>Export CSV</button>
          <span class="muted small" id="bulk-msg">${status.etsy ? 'About 2 Etsy API calls per product (cached for an hour).' : 'Live Etsy data is off — listings use your details only.'}</span>
        </div>
        <div class="progress hidden" id="bulk-prog"><span style="width:0%"></span></div>
      </div>
      <div id="bulk-out" class="stack" style="margin-top:18px"></div>
    </div>

    <div class="card" id="saved-card" style="margin-top:18px"></div>
    <p class="muted small" style="margin-top:18px">${esc(ETSY_NOTICE)}</p>`;

  const form = $('#b-form', view);
  const out = $('#b-out', view);
  const marketBox = $('#b-market', view);
  let market = null;
  let current = null; // { id, input, ctx, listing, market }
  let categoryTouched = Boolean(f0.category && f0.category !== 'other');

  // ---------- mode tabs ----------
  function setMode(m) {
    $$('#mode-tabs button', view).forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
    $$('.single-only', view).forEach((el) => el.classList.toggle('hidden', m === 'bulk' || (el.id === 'pers-wrap' && !form.personalized.checked)));
    $('#single-area', view).classList.toggle('hidden', m !== 'single');
    $('#bulk-area', view).classList.toggle('hidden', m !== 'bulk');
    $('#form-title', view).textContent = m === 'bulk' ? 'Shop settings for every product' : 'Your product';
    $('#form-sub', view).textContent = m === 'bulk' ? 'These apply to all products in the list below.' : 'Only “Product type” is required. The more you fill in, the better the listing.';
    history.replaceState(null, '', m === 'bulk' ? '#/builder?mode=bulk' : '#/builder');
  }
  $('#mode-tabs', view).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  setMode(mode);

  // ---------- form ----------
  function readForm() {
    const input = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      input[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
    }
    input.itemTypeLabel = form.itemType.selectedOptions[0].textContent;
    input.categoryLabel = form.category.selectedOptions[0].textContent;
    if (!status.ai) input.useAi = false;
    return input;
  }
  const persist = () => store.set(FORM_KEY, readForm());
  form.addEventListener('input', persist);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'personalized') $('#pers-wrap', view).classList.toggle('hidden', !e.target.checked);
    if (e.target.name === 'category') categoryTouched = true;
    if ((e.target.name === 'productType' || e.target.name === 'itemType') && !categoryTouched) {
      const cat = G.detectCategory(form.productType.value, form.itemType.value);
      if (cat) form.category.value = cat;
    }
    persist();
  });
  $('#reset', view).addEventListener('click', () => {
    for (const el of form.elements) {
      if (!el.name || ['itemType', 'tone', 'titleLength', 'depth', 'useAi', 'shopName', 'processing'].includes(el.name)) continue;
      if (el.type === 'checkbox') el.checked = false;
      else if (el.tagName === 'SELECT') el.value = 'other';
      else el.value = '';
    }
    $('#pers-wrap', view).classList.add('hidden');
    categoryTouched = false;
    persist();
  });
  $('#sample', view).addEventListener('click', () => {
    const sample = {
      productType: 'Personalized Ceramic Coffee Mug', searchKeyword: 'personalized mug', keywords: 'name mug, custom coffee mug',
      itemType: 'handmade', category: 'kitchen', materials: 'stoneware, food-safe glaze', colors: 'white, sage green', size: '12 oz, 4 in tall',
      styles: 'minimalist', occasions: "Mother's Day, birthday", recipients: 'mom, grandma, coffee lover', features: 'dishwasher safe, microwave safe',
      processing: '3–5 business days', personalized: true, personalizationDetails: 'name up to 12 characters',
    };
    for (const el of form.elements) {
      if (!el.name || !(el.name in sample)) continue;
      if (el.type === 'checkbox') el.checked = sample[el.name];
      else el.value = sample[el.name];
    }
    $('#pers-wrap', view).classList.remove('hidden');
    categoryTouched = true;
    persist();
  });

  const searchKeyword = (input) => input.searchKeyword || (input.keywords || '').split(',')[0]?.trim() || input.productType;

  // ---------- core: research + write one listing ----------
  async function research(input) {
    if (!status.etsy) return null;
    const data = await api('/api/keyword', { q: searchKeyword(input), depth: input.depth || 100, min_price: input.min_price, max_price: input.max_price });
    return toMarket(data);
  }

  async function write(input, mkt, history) {
    const lctx = G.buildContext(input, mkt);
    let listing;
    if (input.useAi && status.ai) {
      const res = await send('POST', '/api/builder/generate', {
        input,
        research: mkt?.sample_size ? { q: mkt.query, depth: mkt.params?.depth, min_price: input.min_price, max_price: input.max_price } : null,
        avoid_titles: history.slice(0, 25).map((s) => s.title),
      });
      listing = normalizeAi(res.listing, lctx, input, mkt, history);
    } else {
      listing = { ...G.generate(input, history, mkt).listing, source: 'builtin' };
    }
    return { ctx: lctx, listing };
  }

  // ---------- single listing ----------
  async function runSingle({ fresh = true } = {}) {
    const input = readForm();
    const msg = $('#form-msg', view);
    if (!input.productType) {
      msg.textContent = 'Enter the product type first.';
      form.productType.focus();
      return;
    }
    const btn = $('#go', view);
    btn.disabled = true;
    msg.textContent = '';
    if (status.etsy && (fresh || !market)) {
      marketBox.innerHTML = loading(`Reading the top ${input.depth || 100} Etsy listings for “${searchKeyword(input)}”…`);
      try {
        market = await research(input);
        if (!ctx.alive()) return;
        renderMarket();
      } catch (err) {
        market = null;
        if (!ctx.alive()) return;
        marketBox.innerHTML = errorBox(err);
      }
    }
    out.innerHTML = loading(input.useAi ? 'AI is writing your listing from the live market data…' : 'Writing your listing…');
    try {
      const { ctx: lctx, listing } = await write(input, market, historyForUniqueness());
      if (!ctx.alive()) return;
      current = { id: uid(), input, ctx: lctx, listing, market };
      drawListing();
      const dropped = droppedTerms(input, lctx);
      if (dropped.length) msg.innerHTML = `<span class="bad-text">Left out for Etsy policy reasons: ${esc(dropped.join(', '))}</span>`;
    } catch (err) {
      if (ctx.alive()) out.innerHTML = builderError(err);
    }
    btn.disabled = false;
    ctx.refreshStatus();
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    runSingle({ fresh: true });
  });

  // ---------- listing editor ----------
  const marketTagInfo = () => new Map((current?.market?.tags || []).map((t) => [t.term, t]));

  function drawListing() {
    const l = current.listing;
    out.innerHTML = `
      <div class="grid split-wide">
        <div class="stack">
          <div class="card">
            <div class="card-head"><h3>Title <span class="counter" id="c-title"></span></h3><button class="btn secondary sm" data-copyf="title">Copy</button></div>
            <textarea class="input" id="l-title" rows="2" maxlength="200"></textarea>
            <div class="stack" id="title-opts" style="gap:6px;margin-top:10px"></div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Tags <span class="counter" id="c-tags"></span></h3><button class="btn secondary sm" data-copyf="tags">Copy all</button></div>
            <div class="tag-input" id="tag-box"></div>
            <p class="muted small" style="margin-top:8px"><span class="chip accent" style="padding:1px 8px">blue</span> = used by top Etsy listings for your keyword (hover for %). Paste the copied tags into Etsy’s tag box — Etsy splits them at the commas.</p>
          </div>
          <div class="card">
            <div class="card-head"><h3>Description <span class="counter" id="c-desc"></span></h3><button class="btn secondary sm" data-copyf="description">Copy</button></div>
            <textarea class="input" id="l-desc" rows="16"></textarea>
          </div>
          <div class="grid grid-2">
            <div class="card">
              <div class="card-head"><h3>Materials</h3><button class="btn secondary sm" data-copyf="materials">Copy</button></div>
              <div class="chips" id="l-mats"></div>
            </div>
            <div class="card">
              <div class="card-head"><h3>Photo alt text</h3></div>
              <ol class="small" id="l-alts" style="margin:0;padding-left:18px;display:grid;gap:8px"></ol>
            </div>
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head" style="align-items:center"><div><h3 id="score-label"></h3><p id="score-sub"></p></div><div id="ring"></div></div>
            <div class="row" style="margin-bottom:12px">
              <button class="btn sm" id="fix">🛠 Auto-fix</button>
              <button class="btn secondary sm" id="again">🔄 New version</button>
              <button class="btn secondary sm" id="save">☆ Save</button>
              <button class="btn secondary sm" id="copy-all">Copy all</button>
            </div>
            <p class="small" id="uniq" style="margin-bottom:10px"></p>
            ${l.notes ? `<div class="notice accent" style="margin-bottom:12px"><div class="icon">💡</div><div class="small">${esc(l.notes)}</div></div>` : ''}
            <div id="checks"></div>
          </div>
          ${priceCard()}
          ${fitCard()}
        </div>
      </div>`;
    $('#l-title', out).value = l.title;
    $('#l-desc', out).value = l.description;
    drawTitleOptions();
    drawTags();
    $('#l-mats', out).innerHTML = l.materials.length ? l.materials.map((m) => `<span class="chip">${esc(m)}</span>`).join('') : '<span class="muted small">Add materials in the form.</span>';
    $('#l-alts', out).innerHTML = l.altTexts.map((a, i) => `<li>${esc(a)} <button class="link-btn small" data-alt="${i}">copy</button></li>`).join('');
    drawChecks();
  }

  function priceCard() {
    const m = current.market;
    const p = m?.price;
    if (!p || p.median == null) return '';
    const cur = m.currency || 'USD';
    return `<div class="card">
      <div class="card-head"><div><h3>Price check</h3><p>From ${fmtInt(p.count)} live listings for “${esc(m.query)}”</p></div></div>
      <dl class="kv">
        <dt>Sweet spot (middle 50%)</dt><dd><b>${money(p.p25, cur)} – ${money(p.p75, cur)}</b></dd>
        <dt>Median</dt><dd>${money(p.median, cur)}</dd>
        <dt>Range</dt><dd>${money(p.min, cur)} – ${money(p.max, cur)}</dd>
      </dl>
      <p class="muted small" style="margin-top:8px">Check your real profit in the <a href="#/fees">Profit Calculator</a>.</p>
    </div>`;
  }

  function fitCard() {
    const m = current.market;
    if (!m?.sample_size) return '';
    const fit = G.fitMarket(current.input, m);
    // skip tags already used, including plural/singular twins (Etsy matches those anyway)
    const singular = (s) => s.split(' ').map((w) => (w.length > 3 ? w.replace(/s$/, '') : w)).join(' ');
    const have = new Set(current.listing.tags.map(singular));
    const list = fit.tags.filter((t) => !have.has(singular(t.term))).slice(0, 18);
    return `<div class="card">
      <div class="card-head"><div><h3>More tags from live Etsy data</h3><p>% of top listings using it · <b>blue</b> = matches your details, grey = only add if it truly describes your item</p></div></div>
      ${list.length ? `<div class="chips">${list.map((t) => `<button class="chip ${t.strict ? 'accent' : ''}" data-addtag="${esc(t.term)}" ${tipAttr(`Used by ${t.pct}% of the top ${m.sample_size} listings${t.avg_favorites != null ? ` · avg ${t.avg_favorites} favorites` : ''}${t.strict ? '' : '<br>Contains words not in your product details — make sure it fits.'}`)}>+ ${esc(t.term)} <span class="small">${Math.round(t.pct)}%</span></button>`).join('')}</div>`
        : '<p class="muted small">Your tags already include the best-fitting market tags.</p>'}
    </div>`;
  }

  function drawTitleOptions() {
    const l = current.listing;
    $('#title-opts', out).innerHTML = (l.titles || [])
      .map((t) => `<button class="btn ${t === l.title ? '' : 'secondary'} sm" style="justify-content:flex-start;text-align:left;white-space:normal;height:auto" data-title="${esc(t)}">${esc(t)} <span class="small" style="opacity:.7">· ${t.length}</span></button>`)
      .join('');
  }

  function drawTags() {
    const info = marketTagInfo();
    const l = current.listing;
    $('#tag-box', out).innerHTML =
      l.tags
        .map((t, i) => {
          const bad = t.length > P.LIMITS.tagMaxChars || !/^[\p{L}\p{N} \-'™©®]+$/u.test(t);
          const m = info.get(t);
          const tip = m ? tipAttr(`Used by ${m.pct}% of top listings${m.avg_favorites != null ? ` · avg ${m.avg_favorites} favorites` : ''}`) : '';
          return `<span class="chip ${bad ? 'bad' : m ? 'accent' : ''}" ${tip}>${esc(t)} <span class="small muted">${t.length}</span><button class="x" data-deltag="${i}" aria-label="Remove ${esc(t)}">×</button></span>`;
        })
        .join('') + `<input id="tag-add" placeholder="${l.tags.length >= 13 ? '13/13 tags' : 'add tag + Enter'}" maxlength="40">`;
  }

  function drawChecks() {
    const l = current.listing;
    const r = P.checkListing(l, current.ctx);
    $('#ring', out).innerHTML = scoreRing(r.score);
    $('#score-label', out).textContent = scoreLabel(r);
    $('#score-sub', out).textContent = `${r.errors} to fix · ${r.warns} to check · ${r.infos} tips · ${l.source === 'ai' ? 'written by AI' : 'built-in writer'}${current.market?.sample_size ? ' · live Etsy data' : ''}`;
    $('#checks', out).innerHTML = renderIssues(r);
    const ct = $('#c-title', out);
    ct.textContent = `${l.title.length}/140`;
    ct.classList.toggle('over', l.title.length > 140);
    const cg = $('#c-tags', out);
    cg.textContent = `${l.tags.length}/13`;
    cg.classList.toggle('over', l.tags.length > 13);
    $('#c-desc', out).textContent = `${P.words(l.description).length} words`;
    const sim = P.similarityToHistory({ id: current.id, title: l.title, description: l.description }, historyForUniqueness());
    const p = Math.round(sim.score * 100);
    $('#uniq', out).innerHTML = !sim.item
      ? '<span class="muted">Uniqueness: nothing saved yet to compare with.</span>'
      : p >= 60
        ? `<span class="bad-text">⚠ ${p}% similar to your saved listing “${esc(sim.item.title)}”. Press New version — near-duplicate listings can look like spam to Etsy.</span>`
        : `<span class="good-text">✓ Unique</span> <span class="muted">— closest saved listing is ${p}% similar.</span>`;
  }

  out.addEventListener('input', (e) => {
    if (!current) return;
    if (e.target.id === 'l-title') {
      current.listing.title = e.target.value.replace(/\n/g, ' ');
      drawTitleOptions();
      drawChecks();
    } else if (e.target.id === 'l-desc') {
      current.listing.description = e.target.value;
      drawChecks();
    }
  });
  out.addEventListener('keydown', (e) => {
    if (e.target.id !== 'tag-add' || e.key !== 'Enter') return;
    e.preventDefault();
    for (const t of e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) if (!current.listing.tags.includes(t)) current.listing.tags.push(t);
    drawTags();
    drawChecks();
    $('#tag-add', out).focus();
  });
  out.addEventListener('click', (e) => {
    if (!current) return;
    const l = current.listing;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.title) {
      l.title = t.dataset.title;
      $('#l-title', out).value = l.title;
      drawTitleOptions();
      drawChecks();
    } else if (t.dataset.deltag != null) {
      l.tags.splice(Number(t.dataset.deltag), 1);
      drawTags();
      drawChecks();
    } else if (t.dataset.addtag) {
      if (l.tags.length >= 13) return toast('Already 13 tags — remove one first');
      l.tags.push(t.dataset.addtag);
      t.remove();
      drawTags();
      drawChecks();
    } else if (t.dataset.copyf) {
      const map = { title: l.title, tags: l.tags.join(', '), description: l.description, materials: l.materials.join(', ') };
      copyText(map[t.dataset.copyf]);
    } else if (t.dataset.alt != null) {
      copyText(l.altTexts[Number(t.dataset.alt)]);
    } else if (t.id === 'fix') {
      autoFix(l, current.ctx, current.input, current.market);
      drawListing();
      toast('Fixed what could be fixed automatically');
    } else if (t.id === 'again') {
      againSingle();
    } else if (t.id === 'save') {
      saveListing(toSaved(current.id, current.input, current.market, l, current.ctx));
      drawSaved();
      drawChecks();
      toast('Saved');
    } else if (t.id === 'copy-all') {
      copyText(fullText(l));
    }
  });

  // "New version": same market data, new wording (no extra Etsy calls)
  async function againSingle() {
    const { input, market: mkt } = current;
    out.insertAdjacentHTML('afterbegin', `<div id="again-load">${loading('Writing a new version…')}</div>`);
    try {
      const { ctx: lctx, listing } = await write(input, mkt, historyForUniqueness());
      if (!ctx.alive()) return;
      current = { id: uid(), input, ctx: lctx, listing, market: mkt };
      drawListing();
    } catch (err) {
      $('#again-load', out)?.remove();
      out.insertAdjacentHTML('afterbegin', builderError(err));
    }
  }

  // ---------- live market panel ----------
  function renderMarket() {
    const m = market;
    if (!m?.sample_size) {
      marketBox.innerHTML = `<div class="card empty"><h2>No active Etsy listings for “${esc(m?.query || '')}”</h2><p>Try a shorter or more common search keyword. The listing was written from your details only.</p></div>`;
      return;
    }
    const sc = m.scores;
    const cur = m.currency || 'USD';
    marketBox.innerHTML = `
      <div class="card"><div class="row">
        <div><div class="muted small">Live Etsy market for</div><h2 style="font-size:22px">“${esc(m.query)}”</h2></div>
        <span class="spacer"></span>
        <span class="muted small">Top ${m.sample_size} listings by Etsy relevancy · ${new Date(m.generated_at).toLocaleTimeString()}</span>
        <a class="btn secondary sm" href="#/keyword?q=${encodeURIComponent(m.query)}">Full keyword report</a>
      </div></div>
      <div class="tiles">
        ${tile('Active listings', compact(m.total_count), scoreBadge(sc.competition_label + ' competition', sc.competition, true), { info: 'Total active Etsy listings for this search (official Etsy API).' })}
        ${tile('Opportunity', sc.opportunity != null ? `${sc.opportunity}<span class="muted" style="font-size:14px">/100</span>` : '—', esc(sc.opportunity_label), { meter: sc.opportunity, meterColor: scoreColor(sc.opportunity) })}
        ${tile('Demand', sc.demand != null ? `${sc.demand}<span class="muted" style="font-size:14px">/100</span>` : '—', `Top median: ${fmtInt(sc.top_median_favorites)} favorites`, { meter: sc.demand, meterColor: scoreColor(sc.demand), info: 'Etsy doesn’t publish search volume. Demand is estimated from favorites and views of the top 48 listings.' })}
        ${tile('Median price', money(m.price.median, cur), `Middle 50%: ${money(m.price.p25, cur)} – ${money(m.price.p75, cur)}`)}
        ${tile('Personalizable', pct(m.mix.personalizable), `${pct(m.mix.digital)} digital · ${pct(sc.new_listing_share)} new in top 48`)}
        ${tile('Tags used', `${m.mix.avg_tags}<span class="muted" style="font-size:14px">/13</span>`, `avg title ${fmtInt(m.mix.avg_title_length)} characters`)}
      </div>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><div><h3>Most used tags</h3><p>% of the top ${m.sample_size} listings</p></div></div>
          ${barList(m.tags.slice(0, 20).map((t) => ({ label: t.term, value: t.pct, tip: `<b>${esc(t.term)}</b><br>${t.count} listings (${t.pct}%)${t.avg_favorites != null ? ` · avg ${t.avg_favorites} favorites` : ''} · ${t.in_top10} in top 10` })), { format: (x) => `${Math.round(x)}%` })}
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Title phrases</h3><p>What top titles say most</p></div>
            <div class="tabs" id="m-tabs"><button class="active" data-g="phrases2">2-word</button><button data-g="phrases3">3-word</button><button data-g="words">Words</button></div></div>
          <div id="m-grams"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Fastest-growing listings</h3><p>Most favorites per day — study their photos & pricing, don’t copy their text</p></div></div>
        <div class="stack" style="gap:10px">${m.top_listings.map((it) => `
          <div class="row" style="flex-wrap:nowrap">
            ${it.thumb ? `<img class="thumb" src="${esc(it.thumb)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}
            <div style="min-width:0;flex:1"><a href="${esc(it.url)}" target="_blank" rel="noopener" style="color:var(--text);font-weight:560;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.title)}</a>
            <span class="muted small">${money(it.price, it.currency || cur)} · #${it.rank} in search · ${it.age_days != null ? fmtInt(it.age_days) + 'd old' : ''}</span></div>
            <span class="badge good nowrap">♥ ${compact(it.favorites)}</span></div>`).join('')}</div>
      </div>`;
    const drawGrams = (g) => {
      $('#m-grams', marketBox).innerHTML = barList(
        (m[g] || []).slice(0, 15).map((x) => ({ label: x.term, value: x.pct, tip: `${x.count} titles (${x.pct}%)` })),
        { format: (x) => `${Math.round(x)}%` }
      );
    };
    drawGrams('phrases2');
    $('#m-tabs', marketBox).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-g]');
      if (!b) return;
      $$('#m-tabs button', marketBox).forEach((x) => x.classList.toggle('active', x === b));
      drawGrams(b.dataset.g);
    });
  }

  // ---------- keyword ideas ----------
  let ideaRows = [];
  let ideaTable = null;
  $('#ideas-btn', view).addEventListener('click', async (e) => {
    const q = searchKeyword(readForm());
    const box = $('#ideas-out', view);
    if (!q) return (box.innerHTML = '<p class="muted small">Enter a product type or search keyword first.</p>');
    e.target.disabled = true;
    box.innerHTML = loading(`Collecting ideas for “${q}”…`);
    try {
      const data = await api('/api/suggest', { q, expand: 'modifiers' });
      if (!ctx.alive()) return;
      const relevant = data.results.filter((r) => r.relevant);
      ideaRows = (relevant.length >= 5 ? relevant : data.results).map((r) => ({ ...r, fits_tag: r.keyword.length <= 20, count: null, competition: null, competition_score: null, status: '' }));
      drawIdeas(box);
    } catch (err) {
      box.innerHTML = errorBox(err);
    }
    e.target.disabled = false;
  });

  function drawIdeas(box) {
    if (!ideaRows.length) {
      box.innerHTML = '<p class="muted small">No ideas found — try a shorter keyword.</p>';
      return;
    }
    box.innerHTML = `<div class="row" style="margin-bottom:10px">
        ${status.etsy ? '<button class="btn sm" id="check-all">Check Etsy competition (first 20)</button>' : '<span class="muted small">Add the Etsy API key to check competition.</span>'}
        <button class="btn secondary sm" id="copy-ideas">Copy keywords</button></div>
      <div id="ideas-table"></div>`;
    ideaTable = dataTable($('#ideas-table', box), {
      columns: [
        { key: 'keyword', label: 'Keyword', render: (r) => `<b>${esc(r.keyword)}</b> ${r.fits_tag ? '<span class="badge good">fits a tag</span>' : '<span class="badge">over 20 chars</span>'}` },
        { key: 'sources', label: 'Source', sortValue: (r) => r.sources.length * 10 + r.hits, render: (r) => r.sources.map((s) => `<span class="badge ${s === 'etsy-intent' ? 'accent' : 'blue'}">${s === 'etsy-intent' ? '“etsy …” search' : s === 'amazon' ? 'Amazon' : 'Google'}</span>`).join(' '), csv: (r) => r.sources.join(' ') },
        { key: 'count', label: 'Etsy listings', num: true, render: (r) => (r.count != null ? compact(r.count) : r.status === 'error' ? '<span class="muted">error</span>' : status.etsy ? `<button class="btn secondary xs" data-check>${r.status === 'loading' ? '…' : 'Check'}</button>` : '—') },
        { key: 'competition_score', label: 'Competition', num: true, render: (r) => (r.competition ? scoreBadge(r.competition, r.competition_score, true) : '') },
        { key: '', label: '', sortable: false, csv: false, render: (r) => `${r.fits_tag ? '<button class="btn ghost xs" data-addidea title="Add as tag">+ tag</button>' : ''} <button class="btn ghost xs" data-useidea title="Use as the Etsy search keyword">use</button>` },
      ],
      rows: ideaRows,
      sortKey: 'sources',
      pageSize: 20,
      filterKeys: ['keyword'],
      csvName: 'listing-keyword-ideas.csv',
    });
    $('#copy-ideas', box).addEventListener('click', () => copyText(ideaRows.map((r) => r.keyword).join('\n')));
    $('#check-all', box)?.addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      await checkIdeas(ideaRows.filter((r) => r.count == null).slice(0, 20));
      ev.target.disabled = false;
    });
  }

  async function checkIdeas(list) {
    for (const r of list) {
      r.status = 'loading';
      ideaTable?.redraw();
      try {
        const c = await api('/api/count', { q: r.keyword });
        Object.assign(r, { count: c.count, competition: c.competition, competition_score: compScore(c.count), status: 'done' });
      } catch (err) {
        r.status = 'error';
        if (['NOT_CONFIGURED', 'AUTH', 'RATE_LIMIT'].includes(err.code)) {
          list.forEach((x) => x.status === 'loading' && (x.status = ''));
          $('#ideas-out', view).insertAdjacentHTML('afterbegin', errorBox(err));
          break;
        }
      }
      if (!ctx.alive()) return;
      ideaTable?.redraw();
    }
    ctx.refreshStatus();
  }

  $('#ideas-out', view).addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const r = ideaRows[Number(tr.dataset.idx)];
    if (e.target.closest('[data-check]')) checkIdeas([r]);
    if (e.target.closest('[data-useidea]')) {
      form.searchKeyword.value = r.keyword;
      persist();
      form.scrollIntoView({ behavior: 'smooth' });
      toast(`Search keyword set to “${r.keyword}”`);
    }
    if (e.target.closest('[data-addidea]')) {
      if (!current) return toast('Write a listing first, then add tags');
      if (current.listing.tags.length >= 13) return toast('Already 13 tags — remove one first');
      if (!current.listing.tags.includes(r.keyword)) current.listing.tags.push(r.keyword);
      drawTags();
      drawChecks();
      toast(`Added “${r.keyword}”`);
    }
  });

  // ---------- bulk ----------
  let bulkItems = [];
  let stopBulk = false;
  const PRONOUN_PERSONAL = /personali[sz]ed|custom|name|monogram|initial|engraved/i;

  function parseLine(line, base) {
    const [productType, searchKw, keywords, recipients, occasions, colors, materials, styles] = line.split('|').map((x) => (x || '').trim());
    const input = {
      ...base,
      productType, searchKeyword: searchKw, keywords, recipients, occasions, colors, materials, styles,
      features: '', size: '', extraNotes: '', personalizationDetails: '', min_price: '', max_price: '',
      personalized: PRONOUN_PERSONAL.test(`${productType} ${searchKw} ${keywords}`),
    };
    input.category = G.detectCategory(productType, base.itemType) || 'other';
    input.categoryLabel = G.CATEGORY[input.category].label;
    return input;
  }

  function drawBulk() {
    $('#bulk-out', view).innerHTML = bulkItems
      .map((b, i) => {
        if (b.error) return `<div class="card"><b>${esc(b.input.productType)}</b><div style="margin-top:8px">${builderError(b.error)}</div></div>`;
        const r = P.checkListing(b.listing, b.ctx);
        const dropped = droppedTerms(b.input, b.ctx);
        const m = b.market;
        return `<div class="card">
          <div class="row" style="flex-wrap:nowrap;align-items:flex-start">
            <div style="min-width:0;flex:1">
              <h3 style="font-size:15px">${esc(b.listing.title)}</h3>
              <div class="muted small" style="margin-top:4px">${esc(b.ctx.cat.label)} · ${b.listing.title.length}/140 · ${b.listing.tags.length} tags · ${r.errors} to fix · ${r.warns} to check · ${b.listing.source === 'ai' ? 'AI' : 'built-in'}
                ${m?.sample_size ? ` · live: ${compact(m.total_count)} listings, ${esc(m.scores.competition_label)} competition, median ${money(m.price.median, m.currency || 'USD')}` : ' · no live data'}</div>
              <div class="chips" style="margin-top:8px">${b.listing.tags.map((t) => `<span class="chip ${(m?.tags || []).some((x) => x.term === t) ? 'accent' : ''}">${esc(t)}</span>`).join('')}</div>
              ${dropped.length ? `<p class="small bad-text" style="margin-top:6px">Left out for Etsy policy reasons: ${esc(dropped.join(', '))}</p>` : ''}
              ${b.saved ? '<p class="small good-text" style="margin-top:6px">✓ Saved</p>' : ''}
            </div>
            <div class="stack" style="gap:6px;align-items:flex-end">
              <span class="badge ${r.score >= 85 ? 'good' : r.score >= 60 ? 'warn' : 'bad'}">${r.score}/100</span>
              <button class="btn sm" data-bedit="${i}">Edit</button>
              <button class="btn secondary sm" data-bcopy="${i}">Copy all</button>
              <button class="btn ghost sm" data-bagain="${i}">🔄 New</button>
            </div>
          </div></div>`;
      })
      .join('');
  }

  $('#bulk-input', view).addEventListener('input', (e) => store.set(BULK_KEY, e.target.value));

  $('#bulk-go', view).addEventListener('click', async () => {
    const lines = $('#bulk-input', view).value.split('\n').map((l) => l.trim()).filter((l) => l && l.split('|')[0].trim());
    const msg = $('#bulk-msg', view);
    if (!lines.length) return (msg.textContent = 'Add at least one product line.');
    if (lines.length > 50) return (msg.textContent = 'Please do 50 products or fewer at a time (saves your Etsy API quota).');
    const base = readForm();
    const goBtn = $('#bulk-go', view);
    const stopBtn = $('#bulk-stop', view);
    const prog = $('#bulk-prog', view);
    goBtn.disabled = true;
    stopBtn.classList.remove('hidden');
    prog.classList.remove('hidden');
    stopBulk = false;
    bulkItems = [];
    drawBulk();
    // earlier items in this batch count for uniqueness too
    const history = historyForUniqueness();
    for (let i = 0; i < lines.length && !stopBulk; i++) {
      const input = parseLine(lines[i], base);
      msg.textContent = `${i + 1} of ${lines.length}: ${input.productType}…`;
      let mkt = null;
      try {
        mkt = await research(input);
      } catch (err) {
        if (['NOT_CONFIGURED', 'AUTH', 'RATE_LIMIT'].includes(err.code)) {
          bulkItems.push({ input, error: err });
          drawBulk();
          break;
        }
        mkt = null; // keep going without live data for this product
      }
      try {
        const { ctx: lctx, listing } = await write(input, mkt, history);
        const id = uid();
        bulkItems.push({ id, input, ctx: lctx, listing, market: mkt });
        history.unshift({ id, title: listing.title, description: listing.description });
      } catch (err) {
        bulkItems.push({ input, error: err });
      }
      if (!ctx.alive()) return;
      $('span', prog).style.width = `${((i + 1) / lines.length) * 100}%`;
      drawBulk();
    }
    goBtn.disabled = false;
    stopBtn.classList.add('hidden');
    setTimeout(() => prog.classList.add('hidden'), 800);
    const ok = bulkItems.filter((b) => !b.error).length;
    msg.textContent = `${stopBulk ? 'Stopped' : 'Done'} — ${ok} listing${ok === 1 ? '' : 's'} written. Review each one, then Save all or Export CSV.`;
    $('#bulk-save', view).disabled = $('#bulk-csv', view).disabled = !ok;
    ctx.refreshStatus();
  });
  $('#bulk-stop', view).addEventListener('click', () => {
    stopBulk = true;
    $('#bulk-msg', view).textContent = 'Stopping after the current product…';
  });
  $('#bulk-out', view).addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const idx = Number(t.dataset.bedit ?? t.dataset.bcopy ?? t.dataset.bagain);
    const b = bulkItems[idx];
    if (!b || b.error) return;
    if (t.dataset.bcopy != null) copyText(fullText(b.listing));
    if (t.dataset.bedit != null) {
      current = { id: b.id, input: b.input, ctx: b.ctx, listing: b.listing, market: b.market };
      market = b.market;
      setMode('single');
      if (market) renderMarket();
      else marketBox.innerHTML = '';
      drawListing();
      out.scrollIntoView({ behavior: 'smooth' });
    }
    if (t.dataset.bagain != null) {
      t.disabled = true;
      try {
        const { ctx: lctx, listing } = await write(b.input, b.market, historyForUniqueness());
        Object.assign(b, { ctx: lctx, listing, saved: false });
      } catch (err) {
        toast(err.message);
      }
      drawBulk();
    }
  });
  $('#bulk-save', view).addEventListener('click', () => {
    const ok = bulkItems.filter((b) => !b.error);
    for (const b of ok) {
      saveListing(toSaved(b.id, b.input, b.market, b.listing, b.ctx));
      b.saved = true;
    }
    drawBulk();
    drawSaved();
    toast(`Saved ${ok.length} listings`);
  });
  const CSV_COLS = [
    { key: 'title', label: 'Title' },
    { key: 'tags', label: 'Tags', csv: (r) => r.tags.join(', ') },
    { key: 'materials', label: 'Materials', csv: (r) => (r.materials || []).join(', ') },
    { key: 'description', label: 'Description' },
    { key: 'altTexts', label: 'Alt text', csv: (r) => (r.altTexts || []).join(' | ') },
    { key: 'keyword', label: 'Search keyword' },
    { key: 'score', label: 'Score' },
    { key: 'date', label: 'Created' },
  ];
  $('#bulk-csv', view).addEventListener('click', () => {
    const rows = bulkItems.filter((b) => !b.error).map((b) => toSaved(b.id, b.input, b.market, b.listing, b.ctx));
    downloadCSV(`etsy-bulk-listings-${new Date().toISOString().slice(0, 10)}.csv`, CSV_COLS, rows);
  });

  // ---------- saved listings ----------
  function drawSaved() {
    const box = $('#saved-card', view);
    const list = savedListings();
    box.innerHTML = `<div class="card-head"><div><h3>Saved listings (${list.length})</h3><p>Saved in this browser. New listings are compared against these so each one stays unique.</p></div>
      ${list.length ? '<button class="btn secondary sm" id="saved-csv">Export CSV</button>' : ''}</div>
      ${list.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Title</th><th class="num">Tags</th><th class="num">Score</th><th>Saved</th><th></th></tr></thead><tbody>
        ${list.map((s) => `<tr data-id="${esc(s.id)}"><td class="title-cell">${esc(s.title)}</td><td class="num">${s.tags.length}</td>
          <td class="num"><span class="badge ${s.score >= 85 ? 'good' : s.score >= 60 ? 'warn' : 'bad'}">${s.score}</span></td>
          <td class="nowrap muted small">${new Date(s.date).toLocaleDateString()}</td>
          <td class="nowrap"><button class="btn secondary xs" data-open>Open</button> <button class="btn secondary xs" data-copyall>Copy</button> <button class="btn ghost xs" data-del aria-label="Delete">✕</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted small">Nothing saved yet.</p>'}`;
  }
  $('#saved-card', view).addEventListener('click', (e) => {
    if (e.target.closest('#saved-csv')) return downloadCSV('etsy-listings.csv', CSV_COLS, savedListings());
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const s = savedListings().find((x) => x.id === tr.dataset.id);
    if (!s) return;
    if (e.target.closest('[data-copyall]')) copyText(fullText(s));
    if (e.target.closest('[data-del]') && confirm('Delete this saved listing?')) {
      deleteListing(s.id);
      drawSaved();
    }
    if (e.target.closest('[data-open]')) {
      const input = s.input || { productType: s.title };
      for (const el of form.elements) {
        if (!el.name || !(el.name in input) || el.name === 'useAi') continue;
        if (el.type === 'checkbox') el.checked = !!input[el.name];
        else el.value = input[el.name] ?? '';
      }
      persist();
      setMode('single');
      current = {
        id: s.id, input, ctx: G.buildContext(input, null), market: null,
        listing: { title: s.title, titles: s.titles || [s.title], tags: s.tags.slice(), description: s.description, materials: (s.materials || []).slice(), altTexts: (s.altTexts || []).slice(), source: s.source || 'builtin' },
      };
      marketBox.innerHTML = '';
      drawListing();
      out.scrollIntoView({ behavior: 'smooth' });
    }
  });
  drawSaved();
}
