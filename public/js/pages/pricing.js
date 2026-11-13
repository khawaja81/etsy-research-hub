import { $, esc, fmt, store, barList } from '../ui.js';
import { calc, solvePrice, PRESETS } from './fees.js';

/*
 * Handmade pricing: turns materials, time and overhead into a price that still pays you after
 * Etsy fees. Uses the same fee model as the Profit Calculator.
 */

const DEFAULTS = {
  name: 'Soy candle (8 oz)',
  mats: [['Soy wax', 1.4], ['Fragrance oil', 0.7], ['Jar + lid', 1.6], ['Wick + sticker', 0.45]],
  minutes: 25, rate: 12, overhead: 10, packaging: 0.9, ship_cost: 5.2, shipping: 0, margin: 25, country: 'us', offsite: '0', market: '', current: '',
};

const money = (x) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);

export async function render(view) {
  const v = { ...DEFAULTS, ...store.get('maker-pricing', {}) };
  if (!Array.isArray(v.mats) || !v.mats.length) v.mats = DEFAULTS.mats;

  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Handmade Pricing</h1>
      <p>Price a handmade product so it still pays <b>you</b> after materials, your time, packaging, shipping and Etsy’s fees. Compare it with the market before you list.</p>
    </div></div>
    <div class="grid split-wide">
      <div class="card stack" id="pr-form">
        <label class="field">Product name<input class="input" data-k="name" value="${esc(v.name)}"></label>
        <div><h3 style="margin-bottom:8px">Materials per item</h3><div id="mat-rows" class="stack" style="gap:6px"></div>
          <button class="btn secondary sm" id="mat-add" style="margin-top:8px">＋ Add material</button></div>
        <div class="field-row">
          <label class="field">Minutes to make one item<input class="input" type="number" min="0" step="1" data-k="minutes" value="${esc(v.minutes)}"></label>
          <label class="field">Your hourly pay<input class="input" type="number" min="0" step="0.5" data-k="rate" value="${esc(v.rate)}"></label>
          <label class="field">Overhead % (waste, tools, workspace)<input class="input" type="number" min="0" step="1" data-k="overhead" value="${esc(v.overhead)}"></label>
          <label class="field">Packaging per order<input class="input" type="number" min="0" step="0.05" data-k="packaging" value="${esc(v.packaging)}"></label>
          <label class="field">Actual shipping cost<input class="input" type="number" min="0" step="0.05" data-k="ship_cost" value="${esc(v.ship_cost)}"></label>
          <label class="field">Shipping you charge buyer<input class="input" type="number" min="0" step="0.05" data-k="shipping" value="${esc(v.shipping)}"></label>
          <label class="field">Profit margin on top of your pay %<input class="input" type="number" min="0" step="1" data-k="margin" value="${esc(v.margin)}"></label>
          <label class="field">Fees country<select class="input" data-k="country">${Object.entries(PRESETS).filter(([k]) => k !== 'custom').map(([k, p]) => `<option value="${k}" ${k === v.country ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>
          <label class="field">Offsite Ads<select class="input" data-k="offsite"><option value="0" ${v.offsite === '0' ? 'selected' : ''}>No offsite ad sale</option><option value="15" ${v.offsite === '15' ? 'selected' : ''}>15%</option><option value="12" ${v.offsite === '12' ? 'selected' : ''}>12%</option></select></label>
        </div>
        <div class="field-row">
          <label class="field">Market median price (optional)<input class="input" type="number" min="0" step="0.01" data-k="market" value="${esc(v.market)}" placeholder="from Handmade Products research"></label>
          <label class="field">My current price (optional)<input class="input" type="number" min="0" step="0.01" data-k="current" value="${esc(v.current)}"></label>
        </div>
        <p class="muted small">Tip: find the market median in <a href="#/handmade">Handmade Products</a> research, then paste it here.</p>
      </div>
      <div class="stack"><div class="card" id="pr-out"></div><div class="card" id="pr-break"></div></div>
    </div>`;

  const drawMats = () => {
    $('#mat-rows', view).innerHTML = v.mats.map((m, i) => `<div class="row" style="gap:6px"><input class="input" data-mn="${i}" value="${esc(m[0])}" placeholder="Material" style="flex:2"><input class="input" data-mc="${i}" type="number" min="0" step="0.01" value="${esc(m[1])}" style="flex:1" placeholder="Cost"><button class="btn secondary sm" data-md="${i}" title="Remove">✕</button></div>`).join('');
  };

  function inputs() {
    const materials = v.mats.reduce((a, m) => a + (Number(m[1]) || 0), 0);
    const overhead = materials * (Number(v.overhead) || 0) / 100;
    const labor = ((Number(v.minutes) || 0) / 60) * (Number(v.rate) || 0);
    const preset = PRESETS[v.country] || PRESETS.us;
    return {
      materials, overhead, labor,
      fee: { price: 0, shipping: Number(v.shipping) || 0, discount: 0, cost: materials + overhead, packaging: Number(v.packaging) || 0, ship_cost: Number(v.ship_cost) || 0, labor, other: 0, ads: 0,
        listing_fee: 0.2, transaction_pct: 6.5, proc_pct: preset.pct, proc_fixed: preset.fixed, reg_pct: preset.reg, offsite: v.offsite, conversion: false, tax_pct: 0 },
    };
  }

  function draw() {
    store.set('maker-pricing', v);
    const { materials, overhead, labor, fee } = inputs();
    const be = solvePrice(fee, 0);
    const rec = solvePrice(fee, Number(v.margin) || 0);
    const priceAt = (p) => calc({ ...fee, price: p });
    const recR = rec != null ? priceAt(rec) : null;
    const cur = Number(v.current) > 0 ? priceAt(Number(v.current)) : null;
    const hours = (Number(v.minutes) || 0) / 60;
    const mk = Number(v.market) || 0;
    let cmp = '';
    if (mk && rec != null) {
      const diff = ((rec - mk) / mk) * 100;
      cmp = diff > 15
        ? `<div class="notice warn"><div class="icon">⚠️</div><div><h3>Above the market by ${fmt(diff)}%</h3><p>Your price needs ${money(rec)} but buyers pay about ${money(mk)}. Cut cost or time, or stand out with better photos, personalization or a bundle.</p></div></div>`
        : diff < -15
        ? `<div class="notice accent"><div class="icon">💡</div><div><h3>${fmt(-diff)}% below the market</h3><p>You could charge up to about ${money(mk)} and keep a higher margin. Don’t underprice handmade work.</p></div></div>`
        : `<div class="notice good"><div class="icon">✅</div><div><h3>In line with the market</h3><p>Your target price (${money(rec)}) is close to the market median (${money(mk)}).</p></div></div>`;
    }
    $('#pr-out', view).innerHTML = rec == null
      ? '<h3>Price not reachable</h3><p class="muted">Your costs are too high for this margin. Lower the cost or margin.</p>'
      : `<div class="muted small">Recommended item price</div><div class="big-num good-text">${money(rec)}</div>
        <div class="row small" style="margin:6px 0 12px"><span class="badge good">${fmt(Number(v.margin))}% margin + your pay</span><span class="muted">Break-even: <b>${be != null ? money(be) : '—'}</b></span></div>
        <dl class="kv">
          <dt>Materials</dt><dd>${money(materials)}</dd><dt>Overhead (${fmt(Number(v.overhead))}%)</dt><dd>${money(overhead)}</dd>
          <dt>Your time (${fmt(hours * 60)} min)</dt><dd>${money(labor)}</dd><dt>Packaging + shipping you pay</dt><dd>${money((Number(v.packaging) || 0) + (Number(v.ship_cost) || 0))}</dd>
          <dt>Etsy fees at this price</dt><dd>${money(recR.totalFees)}</dd><dt>Profit after paying yourself</dt><dd><b>${money(recR.profit)}</b></dd>
          <dt>Effective hourly earnings</dt><dd><b>${hours ? money((recR.profit + labor) / hours) : '—'}</b> per hour</dd>
        </dl>${cmp ? `<div style="margin-top:12px">${cmp}</div>` : ''}
        ${cur ? `<div class="divider"></div><h3>At your current price (${money(Number(v.current))})</h3><dl class="kv"><dt>Profit after paying yourself</dt><dd><b class="${cur.profit >= 0 ? 'good-text' : 'bad-text'}">${money(cur.profit)}</b></dd><dt>Margin</dt><dd>${fmt(cur.margin, 1)}%</dd><dt>Effective hourly earnings</dt><dd>${hours ? money((cur.profit + labor) / hours) : '—'} per hour</dd></dl>` : ''}`;
    $('#pr-break', view).innerHTML = rec == null ? '' : `<h3 style="margin-bottom:8px">Where the buyer’s money goes</h3>${barList([
      ['Materials + overhead', materials + overhead], ['Your time', labor], ['Packaging + shipping', (Number(v.packaging) || 0) + (Number(v.ship_cost) || 0)], ['Etsy fees', recR.totalFees], ['Profit', Math.max(0, recR.profit)],
    ].map(([label, value]) => ({ label, value, tip: `<b>${label}</b><br>${money(value)}` })), { format: money })}
      <p class="muted small" style="margin-top:8px">Fee rates change by country and over time — check Etsy’s Fees &amp; Payments Policy. This is an estimate, not accounting advice.</p>`;
  }

  view.oninput = (e) => {
    const t = e.target;
    if (t.dataset.k) v[t.dataset.k] = t.type === 'number' ? t.value : t.value;
    else if (t.dataset.mn !== undefined) v.mats[Number(t.dataset.mn)][0] = t.value;
    else if (t.dataset.mc !== undefined) v.mats[Number(t.dataset.mc)][1] = t.value;
    draw();
  };
  view.onclick = (e) => {
    if (e.target.closest('#mat-add')) { v.mats.push(['', 0]); drawMats(); draw(); }
    const d = e.target.closest('[data-md]');
    if (d) { v.mats.splice(Number(d.dataset.md), 1); if (!v.mats.length) v.mats.push(['', 0]); drawMats(); draw(); }
  };
  drawMats();
  draw();
}
