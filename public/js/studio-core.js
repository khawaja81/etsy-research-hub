import { esc } from './ui.js';

export const PALETTES = {
  sage: { name: 'Sage & Cream', bg: '#fbf9f4', ink: '#2f3a33', accent: '#5f7d68', soft: '#e8efe9' },
  blush: { name: 'Blush & Plum', bg: '#fff8f7', ink: '#4a2f3a', accent: '#b4566f', soft: '#fbe6ea' },
  navy: { name: 'Navy & Gold', bg: '#fffdf8', ink: '#1f2a44', accent: '#b8903a', soft: '#f3ecd9' },
  terracotta: { name: 'Terracotta', bg: '#fff9f4', ink: '#4b2e24', accent: '#c0603c', soft: '#f9e5da' },
  emerald: { name: 'Emerald & Gold', bg: '#fbfaf3', ink: '#123c33', accent: '#1b7a62', soft: '#e1f0e9' },
  holiday: { name: 'Holiday Red & Green', bg: '#fffefb', ink: '#2c3b2e', accent: '#b22f3a', soft: '#f6e3e3' },
  dustyblue: { name: 'Dusty Blue', bg: '#fbfcfd', ink: '#27384a', accent: '#5b7f9e', soft: '#e4edf4' },
  burgundy: { name: 'Burgundy & Gold', bg: '#fffcf7', ink: '#3a1d27', accent: '#8a2f45', soft: '#f5e4e8' },
  lavender: { name: 'Lavender', bg: '#fcfaff', ink: '#35294a', accent: '#7a5fa8', soft: '#ece6f6' },
  mono: { name: 'Black & White', bg: '#ffffff', ink: '#111111', accent: '#111111', soft: '#f1f1f1' },
};
export const FONTS = {
  'Playfair Display': 'Playfair+Display:wght@500;700',
  Lora: 'Lora:wght@400;600',
  Poppins: 'Poppins:wght@300;400;600',
  Montserrat: 'Montserrat:wght@400;600;700',
  'Dancing Script': 'Dancing+Script:wght@600',
  Amiri: 'Amiri:wght@400;700',
};
export const gfont = (names) => `https://fonts.googleapis.com/css2?${[...new Set(names)].map((n) => `family=${FONTS[n]}`).join('&')}&display=swap`;

// ---------- shared document builder ----------
export function sheetDoc({ pages, o, preview }) {
  const p = PALETTES[o.palette] || PALETTES.sage;
  const letter = o.paper !== 'A4';
  const W = letter ? '8.5in' : '210mm';
  const H = letter ? '11in' : '297mm';
  const foot = [o.shop && `© ${esc(o.shop)}`, o.license && esc(o.license)].filter(Boolean).join(' · ');
  const css = `
    @page{size:${letter ? 'letter' : 'A4'};margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    :root{--ink:${p.ink};--acc:${p.accent};--soft:${p.soft};--bg:${p.bg};--line:${p.ink}66}
    html,body{margin:0;background:${preview ? '#e8e6e2' : '#fff'}}
    .ruled{flex:1;min-height:.3in;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent calc(.3in - 1px),var(--line) calc(.3in - 1px),var(--line) .3in)}
    .chk{display:inline-block;width:.14in;height:.14in;border:1.3px solid var(--ink);border-radius:3px;flex:none}
    .circ{display:inline-block;width:.2in;height:.2in;border:1.3px solid var(--ink);border-radius:50%}
    .cellb{border:1.2px solid var(--ink)}
    .flush{padding:0 !important}
    ${preview ? 'body{zoom:.62;padding:14px 0}' : ''}
    body{font-family:'${o.body}',sans-serif;color:${p.ink}}
    .sheet{width:${W};height:${H};padding:.55in;position:relative;overflow:hidden;background:${p.bg};
      break-after:page;page-break-after:always;${preview ? 'margin:0 auto 18px;box-shadow:0 2px 14px #0003' : ''}}
    .sheet:last-child{break-after:auto;page-break-after:auto}
    .h{font-family:'${o.head}',serif;color:${p.accent};margin:0;font-weight:700}
    .foot{position:absolute;left:0;right:0;bottom:.25in;text-align:center;font-size:9px;letter-spacing:.04em;color:${p.ink}99}
    .line{border-bottom:1.2px solid ${p.ink}66;height:.26in}
    .rule{height:2px;background:${p.accent};width:1.2in;margin:.1in auto}
    .box{border:1.6px solid ${p.accent};border-radius:6px}
    .soft{background:${p.soft}}
    .small{font-size:10px;color:${p.ink}b3}
  `;
  const body = pages
    .map((pg) => {
      const q = typeof pg === 'string' ? { html: pg } : pg;
      return `<section class="sheet ${q.flush ? 'flush' : ''}">${q.html}${foot && !q.flush ? `<div class="foot">${foot}</div>` : ''}</section>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.title || 'Printable')}</title>
    <link rel="stylesheet" href="${gfont([o.head, o.body])}"><style>${css}</style></head><body>${body}</body></html>`;
}
export const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
export const lines = (n) => Array.from({ length: n }, () => '<div class="line"></div>').join('');
export const list = (s) => String(s || '').split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);


// ---------- layout helpers shared by all products ----------
export const col = (inner, extra = '') => `<div style="height:100%;display:flex;flex-direction:column;gap:.12in;${extra}">${inner}</div>`;
export const head = (t, sub) => `<div style="text-align:center"><h1 class="h" style="font-size:30px;line-height:1.1">${esc(t)}</h1>${sub ? `<div class="small" style="margin-top:3px">${sub}</div>` : ''}</div>`;
export const sec = (title, inner, flex = 1, extra = '') => `<div class="box" style="flex:${flex};padding:.08in .14in .1in;display:flex;flex-direction:column;min-height:0;${extra}"><div class="h" style="font-size:13px;margin-bottom:3px">${esc(title)}</div>${inner}</div>`;
export const ruled = '<div class="ruled"></div>';
export const todo = (n) => Array.from({ length: n }, () => '<div style="display:flex;gap:7px;align-items:center;flex:1;max-height:.36in;border-bottom:1px solid var(--line)"><span class="chk"></span></div>').join('');
export const numbered = (n) => Array.from({ length: n }, (_, i) => `<div style="display:flex;gap:7px;align-items:end;flex:1;max-height:.38in;border-bottom:1px solid var(--line);font-size:11px"><b class="h" style="font-size:13px">${i + 1}</b></div>`).join('');
export const row = (inner, extra = '') => `<div style="display:flex;gap:.12in;${extra}">${inner}</div>`;
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Generic table. cols: header strings; rows: array of arrays (strings, already escaped) or a number of empty rows.
export function table(cols, rows, { rowH = '.3in', widths = [], fs = 10 } = {}) {
  const body = (typeof rows === 'number' ? Array.from({ length: rows }, () => cols.map(() => '')) : rows)
    .map((r) => `<tr>${cols.map((_, i) => `<td class="cellb" style="height:${rowH};padding:0 5px;font-size:${fs}px">${r[i] ?? ''}</td>`).join('')}</tr>`)
    .join('');
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed"><colgroup>${cols.map((_, i) => `<col${widths[i] ? ` style="width:${widths[i]}"` : ''}>`).join('')}</colgroup>
    <thead><tr>${cols.map((c) => `<th class="cellb soft" style="padding:4px 3px;font-size:${fs}px;font-family:inherit">${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
}
