import { esc } from './ui.js';
import { chunk, lines, list, col, head, sec, ruled, todo, row, table } from './studio-core.js';

/*
 * Wedding stationery — fixed layouts, no AI. Four frame styles are drawn with plain CSS/SVG.
 * "Leave blank for handwriting" produces a ready-to-print fill-in version, which buyers can
 * use without any editing software (editable Canva/Corjl versions are built from these layouts).
 */

const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || d));
const sel = (id, label, options, def) => ({ id, label, type: 'select', options, def });
export const STYLES = [['classic', 'Classic double border'], ['arch', 'Arch'], ['modern', 'Modern lines'], ['corners', 'Corner ornaments']];
export const SIZES = [['a2', 'A2 — 4.25×5.5 in (4 per sheet)'], ['5x7', '5×7 in (1 per sheet, trim marks)']];
export const LS = { a2: { w: 4.25, h: 5.5, fs: 11 }, '5x7': { w: 5, h: 7, fs: 14.5 } };

export const common = [
  sel('style', 'Card style', STYLES, 'classic'),
  sel('size', 'Card size', SIZES, 'a2'),
  sel('blank', 'Details', [['no', 'Print my details'], ['yes', 'Leave blank for handwriting']], 'no'),
];

export const ORN = '<div style="display:flex;align-items:center;gap:.5em;justify-content:center;margin:.7em 0;color:var(--acc)"><span style="width:2.2em;height:1px;background:var(--acc)"></span>◆<span style="width:2.2em;height:1px;background:var(--acc)"></span></div>';
const cornerSvg = (pos) => {
  const t = { tl: '', tr: 'transform:scaleX(-1)', bl: 'transform:scaleY(-1)', br: 'transform:scale(-1,-1)' }[pos];
  const place = { tl: 'top:.2in;left:.2in', tr: 'top:.2in;right:.2in', bl: 'bottom:.2in;left:.2in', br: 'bottom:.2in;right:.2in' }[pos];
  return `<svg style="position:absolute;${place};${t}" width="46" height="46" viewBox="0 0 46 46" fill="none" stroke="var(--acc)" stroke-width="1.6"><path d="M2 44V2h42"/><path d="M9 44V9h35" opacity=".55"/><circle cx="2" cy="2" r="3" fill="var(--acc)"/><path d="M16 16l6 6M22 16l-6 6" opacity=".7"/></svg>`;
};

// A decorative frame + centered content, sized in em so it scales with the card.
export function frame(style, inner) {
  const abs = 'position:absolute;';
  let deco = '';
  let pad = '.5in .45in';
  if (style === 'classic') deco = `<div style="${abs}inset:.17in;border:2px solid var(--acc)"></div><div style="${abs}inset:.22in;border:1px solid var(--acc)"></div>`;
  else if (style === 'arch') { deco = `<div style="${abs}inset:.2in .28in;border:2px solid var(--acc);border-radius:999px 999px 8px 8px"></div>`; pad = '.95in .55in .5in'; }
  else if (style === 'modern') deco = `<div style="${abs}top:.32in;left:.4in;right:.4in;height:2px;background:var(--acc)"></div><div style="${abs}bottom:.32in;left:.4in;right:.4in;height:2px;background:var(--acc)"></div>`;
  else deco = ['tl', 'tr', 'bl', 'br'].map(cornerSvg).join('');
  return `${deco}<div style="${abs}inset:0;padding:${pad};display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;line-height:1.35">${inner}</div>`;
}

export const field = (v, id, w = 12) => (v.blank === 'yes'
  ? `<span style="display:inline-block;width:${w}em;border-bottom:1px solid currentColor">&nbsp;</span>`
  : esc(v[id]));
export const names = (v) => `<div class="h" style="font-size:2.3em;line-height:1.1">${field(v, 'n1', 9)}</div><div class="h" style="font-size:1.3em;margin:.1em 0">&amp;</div><div class="h" style="font-size:2.3em;line-height:1.1">${field(v, 'n2', 9)}</div>`;
export const caps = (t) => `<div style="letter-spacing:.22em;text-transform:uppercase;font-size:.72em">${t}</div>`;

// Lays a list of card contents onto sheets: 4 per sheet for A2, 1 per sheet (with trim marks) for 5x7.
export function layoutCards(v, inners) {
  const S = LS[v.size] || LS.a2;
  const card = (html) => `<div class="st-card" style="width:${S.w}in;height:${S.h}in;position:relative;overflow:hidden;background:var(--bg);font-size:${S.fs}px;color:var(--ink)">${frame(v.style, html)}</div>`;
  if (v.size === '5x7') {
    return inners.map((inner) => ({
      flush: true,
      html: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative"><div style="outline:1px dashed #999;outline-offset:6px">${card(inner)}</div></div>`,
    }));
  }
  return chunk(inners, 4).map((g) => ({
    flush: true,
    html: `<div style="width:8.5in;height:11in;margin:0 auto;display:grid;grid-template-columns:4.25in 4.25in;grid-template-rows:5.5in 5.5in;position:relative">${g.map(card).join('')}
      <div style="position:absolute;left:4.25in;top:0;height:.18in;border-left:1px solid #999"></div><div style="position:absolute;left:4.25in;bottom:0;height:.18in;border-left:1px solid #999"></div>
      <div style="position:absolute;top:5.5in;left:0;width:.18in;border-top:1px solid #999"></div><div style="position:absolute;top:5.5in;right:0;width:.18in;border-top:1px solid #999"></div></div>`,
  }));
}
// Same card repeated `count` times.
export const cards = (v, inner, count = 1) => layoutCards(v, Array.from({ length: count }, () => inner));
export const sheetCount = (v, copies) => (v.size === '5x7' ? copies : Math.max(4, Math.ceil(copies / 4) * 4));

export const WEDDING = {
  invite: {
    group: 'Wedding', label: 'Wedding invitation', emoji: '💌', query: 'wedding invitation template', note: 'Four frame styles, two sizes, print-ready or fill-in-by-hand.',
    fields: [
      ...common,
      { id: 'host', label: 'Host line', def: 'Together with their families' },
      { id: 'n1', label: 'Name 1', def: 'Emma' }, { id: 'n2', label: 'Name 2', def: 'James' },
      { id: 'line', label: 'Invitation wording', type: 'textarea', rows: 2, def: 'request the pleasure of your company at their wedding celebration' },
      { id: 'date', label: 'Date', def: 'Saturday, June 12, 2027' }, { id: 'time', label: 'Time', def: 'at four o’clock in the afternoon' },
      { id: 'venue', label: 'Venue', def: 'The Garden House' }, { id: 'address', label: 'Address', def: '123 Main Street, Springfield' },
      { id: 'extra', label: 'Extra line (reception / dress code)', def: 'Dinner and dancing to follow' },
      { id: 'rsvp', label: 'RSVP line', def: 'Kindly reply by May 1' },
    ],
    presets: {},
    build(v) {
      const inner = `${caps(esc(v.host))}<div style="margin:.8em 0 .2em">${names(v)}</div>${ORN}<div style="max-width:78%;font-size:.95em">${esc(v.line)}</div>
        <div style="margin-top:.9em;letter-spacing:.18em;text-transform:uppercase;font-weight:600">${field(v, 'date', 14)}</div><div>${field(v, 'time', 12)}</div>
        <div class="h" style="font-size:1.2em;margin-top:.7em">${field(v, 'venue', 12)}</div><div style="font-size:.9em">${field(v, 'address', 14)}</div>
        <div style="margin-top:.8em;font-size:.9em">${esc(v.extra)}</div><div style="margin-top:.5em;font-size:.78em;opacity:.8">${esc(v.rsvp)}</div>`;
      return cards(v, inner, sheetCount(v, 4));
    },
  },

  savedate: {
    group: 'Wedding', label: 'Save the date', emoji: '📆', query: 'save the date template', note: 'Short card sent before the invitation.',
    fields: [...common, { id: 'n1', label: 'Name 1', def: 'Emma' }, { id: 'n2', label: 'Name 2', def: 'James' }, { id: 'date', label: 'Date', def: 'June 12, 2027' }, { id: 'place', label: 'Location', def: 'Springfield' }, { id: 'tag', label: 'Bottom line', def: 'Formal invitation to follow' }],
    presets: {},
    build(v) {
      const inner = `<div class="h" style="font-size:2.1em;letter-spacing:.04em;margin-bottom:.6em">Save the Date</div>${names(v)}${ORN}<div style="font-size:1.35em;letter-spacing:.15em;text-transform:uppercase;font-weight:600">${field(v, 'date', 12)}</div><div style="margin-top:.3em">${field(v, 'place', 12)}</div><div style="margin-top:1.2em;font-size:.8em;opacity:.8">${esc(v.tag)}</div>`;
      return cards(v, inner, sheetCount(v, 4));
    },
  },

  rsvp: {
    group: 'Wedding', label: 'RSVP card', emoji: '✉️', query: 'rsvp card template', note: 'Accept/decline, guest count and meal choice.',
    fields: [...common, { id: 'by', label: 'Reply by', def: 'May 1' }, { id: 'meals', label: 'Meal choices (comma separated, optional)', def: 'Chicken, Fish, Vegetarian' }],
    presets: {},
    build(v) {
      const ml = list(v.meals);
      const ln = '<span style="display:inline-block;width:70%;border-bottom:1px solid currentColor">&nbsp;</span>';
      const inner = `<div class="h" style="font-size:2em;margin-bottom:.1em">RSVP</div><div style="font-size:.85em">Kindly reply by ${field({ ...v, blank: v.blank }, 'by', 5)}</div>${ORN}
        <div style="text-align:left;width:88%;font-size:.95em;line-height:2.1">Name(s): ${ln}<br>Number attending: <span style="display:inline-block;width:2.5em;border-bottom:1px solid currentColor">&nbsp;</span><br><span class="chk"></span> Joyfully accepts &nbsp; <span class="chk"></span> Regretfully declines
        ${ml.length ? `<br>Meal: ${ml.map((m) => `<span class="chk"></span> ${esc(m)}`).join(' &nbsp; ')}` : ''}<br>Dietary needs: ${ln}</div>`;
      return cards(v, inner, sheetCount(v, 4));
    },
  },

  program: {
    group: 'Wedding', label: 'Ceremony program', emoji: '📜', query: 'wedding program template', note: 'Order of the ceremony on one card.',
    fields: [...common, { id: 'n1', label: 'Name 1', def: 'Emma' }, { id: 'n2', label: 'Name 2', def: 'James' }, { id: 'date', label: 'Date', def: 'June 12, 2027' },
      { id: 'order', label: 'Order of ceremony (one per line)', type: 'textarea', rows: 8, def: 'Processional\nWelcome\nReading\nExchange of vows\nExchange of rings\nPronouncement\nFirst kiss\nRecessional' },
      { id: 'thanks', label: 'Closing line', def: 'Thank you for celebrating with us' }],
    presets: {},
    build(v) {
      const items = String(v.order).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 12);
      const inner = `<div class="h" style="font-size:1.8em">Order of Ceremony</div><div style="font-size:.85em;margin-top:.3em">${field(v, 'n1', 6)} &amp; ${field(v, 'n2', 6)} · ${field(v, 'date', 8)}</div>${ORN}
        <div style="line-height:2">${items.map((i) => `<div>${esc(i)}</div>`).join('')}</div><div style="margin-top:1em;font-size:.8em;opacity:.85">${esc(v.thanks)}</div>`;
      return cards(v, inner, sheetCount(v, 4));
    },
  },

  tablenum: {
    group: 'Wedding', label: 'Table numbers', emoji: '🔢', query: 'wedding table numbers printable', note: 'One large number per card, A2 or 5×7.',
    fields: [...common, { id: 'tables', label: 'Number of tables (1–40)', type: 'number', def: 10 }, { id: 'word', label: 'Word above the number', def: 'Table' }],
    presets: {},
    build(v) {
      const n = num(v.tables, 10, 1, 40);
      const S = LS[v.size] || LS.a2;
      const out = [];
      const make = (i) => `<div style="font-size:1.1em;letter-spacing:.3em;text-transform:uppercase">${esc(v.word)}</div><div class="h" style="font-size:${(S.fs * 0.9).toFixed(1)}em;line-height:1.05;margin-top:.1em">${i}</div>`;
      const cardHtml = Array.from({ length: n }, (_, i) => make(i + 1));
      const card = (html) => `<div style="width:${S.w}in;height:${S.h}in;position:relative;overflow:hidden;background:var(--bg);font-size:${S.fs}px;color:var(--ink)">${frame(v.style, html)}</div>`;
      if (v.size === '5x7') return cardHtml.map((h) => ({ flush: true, html: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><div style="outline:1px dashed #999;outline-offset:6px">${card(h)}</div></div>` }));
      chunk(cardHtml, 4).forEach((g) => out.push({ flush: true, html: `<div style="width:8.5in;height:11in;margin:0 auto;display:grid;grid-template-columns:4.25in 4.25in;grid-template-rows:5.5in 5.5in">${g.map(card).join('')}</div>` }));
      return out;
    },
  },

  place: {
    group: 'Wedding', label: 'Place cards', emoji: '🪑', query: 'wedding place cards template', note: 'Fold-over name cards, 8 per sheet. Add names or leave blank.',
    fields: [
      sel('style', 'Style', STYLES.slice(0, 3), 'classic'),
      { id: 'names', label: 'Guest names (one per line; blank lines stay blank)', type: 'textarea', rows: 8, def: 'Guest Name\nGuest Name\nGuest Name\nGuest Name' },
      { id: 'count', label: 'Total cards (8–80)', type: 'number', def: 16 },
    ],
    presets: {},
    build(v) {
      const given = String(v.names).split(/\r?\n/).map((x) => x.trim());
      const total = num(v.count, 16, 8, 80);
      const all = Array.from({ length: total }, (_, i) => given[i] ?? '');
      const one = (nm) => `<div style="width:3.5in;height:1.95in;position:relative;border:1px dashed #aaa;background:var(--bg);color:var(--ink);font-size:12px;overflow:hidden">${frame(v.style === 'arch' ? 'classic' : v.style, nm ? `<div class="h" style="font-size:2em">${esc(nm)}</div>` : '<div style="width:70%;border-bottom:1px solid currentColor;height:1.4em"></div>')}</div>`;
      return chunk(all, 8).map((g) => ({ flush: true, html: `<div style="width:7.2in;margin:.5in auto 0;display:grid;grid-template-columns:3.5in 3.5in;gap:0 .2in;grid-auto-rows:2.35in;align-content:start">${g.map(one).join('')}</div>` }));
    },
  },

  thanks: {
    group: 'Wedding', label: 'Thank-you card', emoji: '💐', query: 'wedding thank you card template', note: 'Front design for after the wedding.',
    fields: [...common, { id: 'n1', label: 'Name 1', def: 'Emma' }, { id: 'n2', label: 'Name 2', def: 'James' }, { id: 'msg', label: 'Message', type: 'textarea', rows: 3, def: 'Thank you for sharing our day and for your thoughtful gift' }],
    presets: {},
    build(v) {
      const inner = `<div class="h" style="font-size:2.6em;margin-bottom:.2em">Thank You</div>${ORN}<div style="max-width:78%">${esc(v.msg)}</div><div style="margin-top:1em" class="h">${field(v, 'n1', 6)} &amp; ${field(v, 'n2', 6)}</div>`;
      return cards(v, inner, sheetCount(v, 4));
    },
  },

  welcome: {
    group: 'Wedding', label: 'Welcome sign', emoji: '🪧', query: 'wedding welcome sign template', note: 'One big page — scale it up at a print shop (16×20, 18×24).',
    fields: [
      sel('style', 'Style', STYLES, 'classic'),
      { id: 'headline', label: 'Headline', def: 'Welcome to our wedding' },
      { id: 'n1', label: 'Name 1', def: 'Emma' }, { id: 'n2', label: 'Name 2', def: 'James' },
      { id: 'date', label: 'Date', def: 'June 12, 2027' }, { id: 'sub', label: 'Small line', def: 'We are so glad you are here' },
    ],
    presets: {},
    build(v) {
      const inner = `<div class="h" style="font-size:3.6em;line-height:1.05;margin-bottom:.4em">${esc(v.headline)}</div>${ORN}<div style="margin:.4em 0">${names(v)}</div>${ORN}<div style="letter-spacing:.25em;text-transform:uppercase;font-size:1.3em;font-weight:600">${esc(v.date)}</div><div style="margin-top:1em;font-size:1.1em">${esc(v.sub)}</div>`;
      return [{ flush: true, html: `<div style="width:100%;height:100%;position:relative;font-size:19px;color:var(--ink)">${frame(v.style, inner)}</div>` }];
    },
  },

  timeline: {
    group: 'Wedding', label: 'Wedding day timeline', emoji: '⏰', query: 'wedding timeline template', note: 'Hour-by-hour schedule for the day.',
    fields: [
      { id: 'title', label: 'Title', def: 'Wedding Day Timeline' }, { id: 'date', label: 'Date', def: 'June 12, 2027' },
      { id: 'rows', label: 'Schedule (time | event, one per line)', type: 'textarea', rows: 10, def: '9:00 AM | Hair and makeup begins\n12:00 PM | Photographer arrives\n1:30 PM | Getting-ready photos\n3:00 PM | Guests arrive\n4:00 PM | Ceremony\n4:45 PM | Cocktail hour\n6:00 PM | Dinner\n7:30 PM | Toasts and cake\n8:00 PM | First dance\n10:30 PM | Send-off' },
    ],
    presets: {},
    build(v) {
      const rows = String(v.rows).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 16).map((l) => { const [t, ...e] = l.split('|'); return [esc(t.trim()), esc(e.join('|').trim()), '', '']; });
      while (rows.length < 14) rows.push(['', '', '', '']);
      return [col(head(v.title, esc(v.date)) + `<div style="flex:1">${table(['Time', 'What happens', 'Who', 'Notes'], rows, { rowH: '.52in', widths: ['16%', '38%', '20%', '26%'], fs: 11 })}</div>`)];
    },
  },

  checklist: {
    group: 'Wedding', label: 'Wedding planning checklist', emoji: '📝', query: 'wedding planner printable', note: 'Month-by-month checklist plus budget and vendor pages.',
    fields: [
      { id: 'title', label: 'Title', def: 'Wedding Planning Checklist' },
      { id: 'cur', label: 'Currency symbol', def: '$' },
    ],
    presets: {},
    build(v) {
      const blocks = [
        ['12+ months before', ['Set a budget', 'Make a guest list draft', 'Choose a date', 'Book the venue']],
        ['9–11 months', ['Hire a photographer', 'Book catering', 'Start dress / outfit shopping', 'Create a wedding website']],
        ['6–8 months', ['Send save-the-dates', 'Book music / DJ', 'Order invitations', 'Book accommodation for guests']],
        ['3–5 months', ['Send invitations', 'Plan the menu and cake', 'Arrange transport', 'Buy rings']],
        ['1–2 months', ['Final guest count', 'Make the seating chart', 'Final outfit fittings', 'Write vows']],
        ['Final week', ['Confirm all vendors', 'Pack for honeymoon', 'Prepare payments and tips', 'Rest and enjoy']],
      ];
      const box = ([t, items]) => sec(t, items.map((i) => `<div style="display:flex;gap:7px;align-items:center;flex:1;font-size:10.5px;border-bottom:1px solid var(--line)"><span class="chk"></span>${esc(i)}</div>`).join('') + todo(1), 1);
      const p1 = col(head(v.title, 'Edit these to match your plan') + `<div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,1fr);gap:.12in">${blocks.map(box).join('')}</div>`);
      const c = esc(v.cur || '$');
      const p2 = col(head('Wedding Budget') + `<div style="flex:1">${table(['Item', `Budget (${c})`, `Actual (${c})`, 'Paid'], ['Venue', 'Catering', 'Photography', 'Attire', 'Flowers', 'Music', 'Stationery', 'Cake', 'Transport', 'Rings', 'Decor', 'Other'].map((x) => [x, '', '', '<span class="chk"></span>']), { rowH: '.5in', widths: ['38%', '22%', '22%', '18%'], fs: 11 })}</div>`);
      const p3 = col(head('Vendor Contacts') + `<div style="flex:1">${table(['Vendor', 'Name', 'Phone / email', 'Deposit paid'], ['Venue', 'Caterer', 'Photographer', 'Florist', 'Music', 'Baker', 'Officiant', 'Transport'].map((x) => [x, '', '', '<span class="chk"></span>']), { rowH: '.6in', widths: ['22%', '26%', '36%', '16%'], fs: 11 })}</div>`);
      return [p1, p2, p3];
    },
  },
};
