import { $, esc, fmt, barList, store } from '../ui.js';

const PRESETS = {
  us: { label: 'United States', pct: 3, fixed: 0.25, reg: 0 },
  ca: { label: 'Canada', pct: 3, fixed: 0.25, reg: 0 },
  uk: { label: 'United Kingdom', pct: 4, fixed: 0.2, reg: 0.32 },
  au: { label: 'Australia', pct: 3, fixed: 0.25, reg: 0 },
  de: { label: 'Germany / most EU', pct: 4, fixed: 0.3, reg: 0 },
  fr: { label: 'France', pct: 4, fixed: 0.3, reg: 0.47 },
  it: { label: 'Italy', pct: 4, fixed: 0.3, reg: 0.32 },
  es: { label: 'Spain', pct: 4, fixed: 0.3, reg: 0.72 },
  custom: { label: 'Custom', pct: null, fixed: null, reg: null },
};

const DEFAULTS = {
  price: 25, shipping: 0, discount: 0, cost: 6, packaging: 0.8, ship_cost: 4.5, labor: 0, other: 0, ads: 0,
  listing_fee: 0.2, transaction_pct: 6.5, country: 'us', proc_pct: 3, proc_fixed: 0.25, reg_pct: 0,
  offsite: '0', conversion: false, tax_pct: 0, target_margin: 30,
};

const FIELDS = [
  ['Your prices', [
    ['price', 'Item price'], ['shipping', 'Shipping charged to buyer'], ['discount', 'Sale / coupon discount %'],
  ]],
  ['Your costs per order', [
    ['cost', 'Materials / product cost'], ['packaging', 'Packaging'], ['ship_cost', 'Actual shipping cost'], ['labor', 'Labor (optional)'], ['other', 'Other costs'], ['ads', 'Etsy Ads spend per sale'],
  ]],
];

export function calc(v) {
  const n = (k) => Number(v[k]) || 0;
  const itemPrice = n('price') * (1 - n('discount') / 100);
  const subtotal = itemPrice + n('shipping');
  const tax = subtotal * (n('tax_pct') / 100);
  const fees = {
    'Listing fee': n('listing_fee'),
    'Transaction fee': subtotal * (n('transaction_pct') / 100),
    'Payment processing': subtotal > 0 ? (subtotal + tax) * (n('proc_pct') / 100) + n('proc_fixed') : 0,
    'Offsite Ads': Math.min(subtotal * (Number(v.offsite) / 100), 100),
    'Regulatory operating fee': subtotal * (n('reg_pct') / 100),
    'Currency conversion': v.conversion ? subtotal * 0.025 : 0,
  };
  const totalFees = Object.values(fees).reduce((a, b) => a + b, 0);
  const costs = n('cost') + n('packaging') + n('ship_cost') + n('labor') + n('other') + n('ads');
  const profit = subtotal - totalFees - costs;
  return { itemPrice, subtotal, fees, totalFees, costs, profit, margin: subtotal ? (profit / subtotal) * 100 : 0 };
}

// Finds the item price that reaches a target margin (binary search — fees are not all linear).
function solvePrice(v, targetMargin) {
  let lo = 0;
  let hi = 100000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const r = calc({ ...v, price: mid });
    if (r.margin >= targetMargin && r.profit >= 0) hi = mid;
    else lo = mid;
  }
  return hi >= 99999 ? null : hi;
}

export async function render(view) {
  const v = { ...DEFAULTS, ...store.get('fees', {}) };
  const num = (k, label, step = '0.01') =>
    `<label class="field">${esc(label)}<input class="input" type="number" step="${step}" min="0" data-k="${k}" value="${esc(v[k])}"></label>`;

  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Etsy Profit Calculator</h1>
      <p>See exactly what Etsy keeps and what you earn per order. Defaults use Etsy’s standard seller fees — rates change by country and over time, so double-check them in Etsy’s Fees & Payments Policy.</p>
    </div></div>
    <div class="grid split-wide">
      <div class="card stack" id="fee-form">
        ${FIELDS.map(([title, fields]) => `<div><h3 style="margin-bottom:10px">${title}</h3><div class="field-row">${fields.map(([k, l]) => num(k, l)).join('')}</div></div>`).join('')}
        <div>
          <h3 style="margin-bottom:10px">Etsy fees</h3>
          <div class="field-row">
            <label class="field">Payment processing country
              <select class="input" data-k="country">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}" ${k === v.country ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
            </label>
            ${num('proc_pct', 'Processing %')}
            ${num('proc_fixed', 'Processing fixed fee')}
            ${num('transaction_pct', 'Transaction fee %')}
            ${num('listing_fee', 'Listing fee')}
            ${num('reg_pct', 'Regulatory fee %')}
            <label class="field">Offsite Ads
              <select class="input" data-k="offsite">
                <option value="0" ${v.offsite === '0' ? 'selected' : ''}>No offsite ad sale</option>
                <option value="15" ${v.offsite === '15' ? 'selected' : ''}>15% (under $10K/yr sales)</option>
                <option value="12" ${v.offsite === '12' ? 'selected' : ''}>12% ($10K+/yr sales)</option>
              </select>
            </label>
            ${num('tax_pct', 'Sales tax/VAT % buyer pays')}
          </div>
          <label class="row small" style="margin-top:12px;gap:8px"><input type="checkbox" data-k="conversion" ${v.conversion ? 'checked' : ''}> Listing currency differs from my bank currency (2.5% conversion fee)</label>
        </div>
      </div>
      <div class="stack">
        <div class="card fee-out" id="fee-out"></div>
        <div class="card">
          <h3 style="margin-bottom:10px">Price for a target margin</h3>
          <div class="row">${num('target_margin', 'Target profit margin %', '1')}</div>
          <div id="target-out" style="margin-top:12px"></div>
        </div>
      </div>
    </div>`;

  const form = $('#fee-form', view);

  function read() {
    view.querySelectorAll('[data-k]').forEach((el) => {
      v[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
    });
  }

  function draw() {
    read();
    store.set('fees', v);
    const r = calc(v);
    const money = (x) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
    const feeItems = Object.entries(r.fees).filter(([, x]) => x > 0);
    $('#fee-out', view).innerHTML = `
      <div class="muted small">Profit per order</div>
      <div class="big-num ${r.profit >= 0 ? 'good-text' : 'bad-text'}">${r.profit < 0 ? '−' : ''}${money(Math.abs(r.profit))}</div>
      <div class="row small" style="margin:6px 0 14px">
        <span class="badge ${r.margin >= 30 ? 'good' : r.margin >= 15 ? 'warn' : 'bad'}">${fmt(r.margin, 1)}% margin</span>
        <span class="muted">Etsy takes ${fmt(r.subtotal ? (r.totalFees / r.subtotal) * 100 : 0, 1)}% of the order</span>
      </div>
      <div class="line"><span>Buyer pays (item${Number(v.discount) ? ' after discount' : ''} + shipping)</span><b>${money(r.subtotal)}</b></div>
      ${Object.entries(r.fees).map(([k, x]) => (x > 0 ? `<div class="line"><span class="muted">− ${k}</span><span>${money(x)}</span></div>` : '')).join('')}
      <div class="line"><span>Total Etsy fees</span><b>${money(r.totalFees)}</b></div>
      <div class="line"><span class="muted">− Your costs (product, packaging, shipping, labor, ads)</span><span>${money(r.costs)}</span></div>
      <div class="line total"><span>Net profit</span><span class="${r.profit >= 0 ? 'good-text' : 'bad-text'}">${money(r.profit)}</span></div>
      <div class="divider"></div>
      <h3 style="margin-bottom:10px">Fee breakdown</h3>
      ${barList(feeItems.map(([k, x]) => ({ label: k, value: x, tip: `<b>${k}</b><br>${money(x)}` })), { format: (x) => money(x) })}`;

    const breakeven = solvePrice(v, 0);
    const target = solvePrice(v, Number(v.target_margin) || 0);
    $('#target-out', view).innerHTML = `<dl class="kv">
      <dt>Break-even item price</dt><dd><b>${breakeven != null ? money(breakeven) : '—'}</b></dd>
      <dt>Price for ${fmt(Number(v.target_margin) || 0)}% margin</dt><dd><b>${target != null ? money(target) : 'Not reachable'}</b></dd>
    </dl><p class="muted small" style="margin-top:8px">Same costs & shipping as above; solves for the item price.</p>`;
  }

  view.addEventListener('input', (e) => {
    if (e.target.dataset.k === 'country') {
      const p = PRESETS[e.target.value];
      if (p.pct != null) {
        form.querySelector('[data-k=proc_pct]').value = p.pct;
        form.querySelector('[data-k=proc_fixed]').value = p.fixed;
        form.querySelector('[data-k=reg_pct]').value = p.reg;
      }
    }
    draw();
  });
  view.addEventListener('change', draw);
  draw();
}
