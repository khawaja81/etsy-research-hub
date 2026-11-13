import { esc } from './ui.js';
import { chunk, list, col, head, sec, ruled, todo, numbered, row, table, lines } from './studio-core.js';
import { STYLES, common, ORN, field, names, caps, layoutCards, cards, sheetCount, frame } from './studio-wedding.js';

/*
 * More fixed-layout products: invitations, kids & family charts, home & business printables.
 * No AI — every layout is code, every word is yours or an editable plain preset.
 */

const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || d));
const sel = (id, label, options, def) => ({ id, label, type: 'select', options, def });
const L = (t) => String(t || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const chk = '<span class="chk"></span>';

export const EXTRA = {
  birthday: {
    group: 'Cards & invitations', label: 'Birthday invitation', emoji: '🎂', query: 'birthday invitation template', note: 'Party invitation — print your details or leave blank for handwriting.',
    fields: [...common,
      { id: 'headline', label: 'Headline', def: 'You’re invited!' }, { id: 'n1', label: 'Name', def: 'Ava' }, { id: 'age', label: 'Age line', def: 'is turning 5' },
      { id: 'date', label: 'Date', def: 'Saturday, May 8' }, { id: 'time', label: 'Time', def: '2:00 – 4:00 PM' },
      { id: 'venue', label: 'Place', def: 'The Park Pavilion' }, { id: 'address', label: 'Address', def: '45 Garden Road' },
      { id: 'extra', label: 'Extra line', def: 'Cake, games and fun' }, { id: 'rsvp', label: 'RSVP line', def: 'Please reply by May 1' }],
    presets: {},
    build(v) {
      const inner = `<div class="h" style="font-size:2.2em">${esc(v.headline)}</div>${ORN}<div style="font-size:.9em">Join us to celebrate</div><div class="h" style="font-size:2.6em;line-height:1.1;margin:.2em 0">${field(v, 'n1', 8)}</div><div>${esc(v.age)}</div>
        <div style="margin-top:1em;letter-spacing:.15em;text-transform:uppercase;font-weight:600">${field(v, 'date', 12)}</div><div>${field(v, 'time', 10)}</div>
        <div class="h" style="font-size:1.15em;margin-top:.7em">${field(v, 'venue', 12)}</div><div style="font-size:.9em">${field(v, 'address', 12)}</div>
        <div style="margin-top:.8em;font-size:.9em">${esc(v.extra)}</div><div style="margin-top:.4em;font-size:.78em;opacity:.8">${esc(v.rsvp)}</div>`;
      return cards(v, inner, sheetCount(v, 4));
    },
  },

  baby: {
    group: 'Cards & invitations', label: 'Baby shower invitation', emoji: '🍼', query: 'baby shower invitation template', note: 'Shower invitation card with RSVP line.',
    fields: [...common,
      { id: 'headline', label: 'Headline', def: 'Baby Shower' }, { id: 'honor', label: 'In honor of', def: 'Honoring Sophie' },
      { id: 'date', label: 'Date', def: 'Sunday, June 6' }, { id: 'time', label: 'Time', def: '1:00 PM' },
      { id: 'venue', label: 'Place', def: 'Maple Garden Cafe' }, { id: 'address', label: 'Address', def: '12 Rose Lane' },
      { id: 'host', label: 'Hosted by', def: 'Hosted by Emily' }, { id: 'rsvp', label: 'RSVP line', def: 'Please reply by May 25' }],
    presets: {},
    build(v) {
      const inner = `${caps('You are invited to a')}<div class="h" style="font-size:2.5em;line-height:1.1;margin:.3em 0">${esc(v.headline)}</div><div>${esc(v.honor)}</div>${ORN}
        <div style="letter-spacing:.15em;text-transform:uppercase;font-weight:600">${field(v, 'date', 12)}</div><div>${field(v, 'time', 8)}</div>
        <div class="h" style="font-size:1.15em;margin-top:.7em">${field(v, 'venue', 12)}</div><div style="font-size:.9em">${field(v, 'address', 12)}</div>
        <div style="margin-top:.8em;font-size:.9em">${esc(v.host)}</div><div style="margin-top:.4em;font-size:.78em;opacity:.8">${esc(v.rsvp)}</div>`;
      return cards(v, inner, sheetCount(v, 4));
    },
  },

  certificate: {
    group: 'Cards & invitations', label: 'Certificate', emoji: '🏅', query: 'certificate template printable', note: 'Award / achievement certificate, one per page.',
    fields: [
      sel('style', 'Frame', STYLES, 'classic'),
      { id: 'title', label: 'Title', def: 'Certificate of Achievement' }, { id: 'pre', label: 'Line above name', def: 'This certificate is proudly presented to' },
      { id: 'name', label: 'Name (leave empty for a line)', def: '' }, { id: 'reason', label: 'For', type: 'textarea', rows: 2, def: 'for outstanding effort, kindness and perseverance' },
      { id: 'date', label: 'Date (empty = line)', def: '' }, { id: 'signer', label: 'Signed by label', def: 'Signature' },
    ],
    presets: {},
    build(v) {
      const ln = (txt, w) => (txt ? esc(txt) : `<span style="display:inline-block;width:${w}em;border-bottom:1.3px solid currentColor">&nbsp;</span>`);
      const inner = `<div class="h" style="font-size:2.6em;line-height:1.1">${esc(v.title)}</div>${ORN}<div style="margin:.8em 0 .3em">${esc(v.pre)}</div><div class="h" style="font-size:2em;margin:.3em 0 .5em;min-height:1.2em">${ln(v.name, 12)}</div>
        <div style="max-width:70%;font-size:1.05em">${esc(v.reason)}</div>
        <div style="display:flex;gap:3em;margin-top:2.5em;font-size:.85em"><div>${ln(v.date, 7)}<div style="opacity:.7">Date</div></div><div><span style="display:inline-block;width:9em;border-bottom:1.3px solid currentColor">&nbsp;</span><div style="opacity:.7">${esc(v.signer)}</div></div></div>`;
      return [{ flush: true, html: `<div style="width:100%;height:100%;position:relative;font-size:19px;color:var(--ink)">${frame(v.style, inner)}</div>` }];
    },
  },

  recipe: {
    group: 'Home & business', label: 'Recipe cards', emoji: '🍲', query: 'recipe card template printable', note: '6×4 in cards, 2 per page, with ingredient and direction lines.',
    fields: [{ id: 'title', label: 'Header', def: 'From the kitchen of' }, { id: 'count', label: 'Cards (2–40)', type: 'number', def: 8 }],
    presets: {},
    build(v) {
      const card = () => `<div class="box" style="height:4.7in;margin-bottom:.2in;padding:.14in .22in;display:flex;flex-direction:column"><div style="display:flex;gap:8px;align-items:end;font-size:12px"><span class="h" style="font-size:15px">${esc(v.title)}</span><span style="flex:1;border-bottom:1.2px solid currentColor;height:.2in"></span></div>
        <div style="display:flex;gap:10px;align-items:end;font-size:11px;margin:.1in 0"><b class="h" style="font-size:20px">Recipe:</b><span style="flex:1;border-bottom:1.2px solid currentColor;height:.22in"></span></div>
        <div style="display:flex;gap:18px;font-size:10px;margin-bottom:.08in">Prep: ______ &nbsp; Cook: ______ &nbsp; Serves: ______ &nbsp; Oven: ______</div>
        <div style="display:flex;gap:.2in;flex:1;min-height:0"><div style="flex:1;display:flex;flex-direction:column"><b class="h" style="font-size:13px">Ingredients</b><div class="ruled"></div></div><div style="flex:1.4;display:flex;flex-direction:column"><b class="h" style="font-size:13px">Directions</b><div class="ruled"></div></div></div></div>`;
      return chunk(Array.from({ length: num(v.count, 8, 2, 40) }), 2).map((g) => g.map(card).join(''));
    },
  },

  bookmark: {
    group: 'Home & business', label: 'Bookmarks', emoji: '🔖', query: 'printable bookmarks', note: '2×6 in bookmarks, 4 per page — use your own quotes or sayings.',
    fields: [
      { id: 'quotes', label: 'Text for each bookmark (one per line; short phrases)', type: 'textarea', rows: 6, def: 'Read more books\nJust one more chapter\nA reader lives a thousand lives\nBooks are a quiet adventure' },
      { id: 'shop', label: 'Small line at bottom', def: '' },
    ],
    presets: {},
    build(v) {
      const q = L(v.quotes);
      const items = Array.from({ length: Math.max(4, Math.ceil(q.length / 4) * 4) }, (_, i) => q[i % Math.max(q.length, 1)] || '');
      const mark = (t) => `<div class="box soft" style="width:2in;height:6in;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:.25in .15in;border-radius:10px;position:relative"><div style="width:.18in;height:.18in;border:1.5px solid currentColor;border-radius:50%;position:absolute;top:.15in;background:#fff"></div>
        <div class="rule"></div><div class="h" style="font-size:22px;line-height:1.3">${esc(t)}</div><div class="rule"></div><div class="small" style="margin-top:.2in">${esc(v.shop)}</div></div>`;
      return chunk(items, 4).map((g) => `<div style="display:flex;gap:.2in;justify-content:center;align-items:flex-start">${g.map(mark).join('')}</div>`);
    },
  },

  orderthanks: {
    group: 'Home & business', label: 'Order thank-you card', emoji: '📦', query: 'thank you for your order card printable', note: 'Insert card for your own orders. Don’t add links to sell outside Etsy.',
    fields: [...common,
      { id: 'headline', label: 'Headline', def: 'Thank you for your order!' }, { id: 'shop', label: 'Shop name', def: 'Your Shop Name' },
      { id: 'msg', label: 'Message', type: 'textarea', rows: 3, def: 'Your support means the world to a small business. I hope you love it!' },
      { id: 'tip', label: 'Care / tip line', def: 'If anything is not right, please message me on Etsy first.' }],
    presets: {},
    build(v) {
      const inner = `<div class="h" style="font-size:2.3em;line-height:1.1">${esc(v.headline)}</div>${ORN}<div style="max-width:78%">${esc(v.msg)}</div><div style="margin:1.1em 0 .2em;font-size:.82em;opacity:.85;max-width:78%">${esc(v.tip)}</div><div class="h" style="font-size:1.3em;margin-top:.8em">${esc(v.shop)}</div>`;
      return cards(v, inner, sheetCount(v, 4));
    },
  },

  chores: {
    group: 'Kids & family', label: 'Chore chart', emoji: '🧽', query: 'chore chart printable', note: 'Weekly chores for kids with day checkboxes.',
    fields: [{ id: 'title', label: 'Title', def: 'Chore Chart' }, { id: 'who', label: 'Name line', def: 'Name' },
      { id: 'tasks', label: 'Chores (one per line)', type: 'textarea', rows: 8, def: 'Make my bed\nBrush my teeth\nTidy my room\nFeed the pet\nSet the table\nHelp with dishes\nPack my school bag\nRead for 15 minutes' },
      { id: 'reward', label: 'Reward line', def: 'If I finish most chores, I earn:' }],
    presets: {},
    build(v) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const rows = L(v.tasks).slice(0, 14).map((t) => [esc(t), ...days.map(() => '<div style="text-align:center"><span class="chk"></span></div>')]);
      while (rows.length < 8) rows.push(['', ...days.map(() => '')]);
      return [col(head(v.title, `${esc(v.who)}: ____________________`) + `<div style="flex:1">${table(['Chore', ...days], rows, { rowH: '.5in', widths: ['36%'], fs: 12 })}</div>` + sec(esc(v.reward), ruled, 0.4))];
    },
  },

  reward: {
    group: 'Kids & family', label: 'Reward chart', emoji: '⭐', query: 'reward chart printable', note: 'Sticker / star chart with a goal and reward.',
    fields: [{ id: 'title', label: 'Title', def: 'My Star Chart' }, { id: 'goal', label: 'Goal', def: 'My goal:' },
      { id: 'cells', label: 'Number of stars (10–40)', type: 'number', def: 30 }, { id: 'prize', label: 'Prize line', def: 'When I fill all the stars I get:' }],
    presets: {},
    build(v) {
      const n = num(v.cells, 30, 10, 40);
      const star = (i) => `<div class="box" style="width:1.18in;height:1.18in;display:flex;align-items:center;justify-content:center;border-radius:50%"><span style="font-size:11px;opacity:.55">${i + 1}</span></div>`;
      return [col(head(v.title) + `<div style="font-size:15px">${esc(v.goal)} <span style="display:inline-block;width:62%;border-bottom:1.3px solid currentColor">&nbsp;</span></div>`
        + `<div style="flex:1;min-height:0;display:grid;grid-template-columns:repeat(5,1fr);justify-items:center;gap:.1in;align-content:start">${Array.from({ length: n }, (_, i) => star(i)).join('')}</div>`
        + sec(esc(v.prize), ruled, 0, 'flex:none;height:.95in'))];
    },
  },

  milestone: {
    group: 'Kids & family', label: 'Baby milestone cards', emoji: '👶', query: 'baby milestone cards printable', note: 'Photo-prop cards for each month, 4 per sheet.',
    fields: [...common, { id: 'sub', label: 'Small text', def: 'Baby’s first year' },
      { id: 'labels', label: 'Card labels (one per line)', type: 'textarea', rows: 10, def: 'Newborn\n1 month\n2 months\n3 months\n4 months\n5 months\n6 months\n7 months\n8 months\n9 months\n10 months\n11 months\n12 months\n1st birthday' }],
    presets: {},
    build(v) {
      const labels = L(v.labels);
      const inners = labels.map((t) => `${caps(esc(v.sub))}<div class="h" style="font-size:3.2em;line-height:1.05;margin:.4em 0">${esc(t)}</div>${ORN}`);
      return layoutCards(v, inners.length ? inners : ['']);
    },
  },

  menu: {
    group: 'Home & business', label: 'Menu', emoji: '🍽️', query: 'menu template printable', note: 'Party, wedding or café menu. Use "Section | item - price" lines.',
    fields: [
      sel('style', 'Frame', STYLES, 'classic'),
      { id: 'title', label: 'Title', def: 'Menu' }, { id: 'sub', label: 'Subtitle', def: 'Emma & James · June 12, 2027' },
      { id: 'items', label: 'Menu lines (Section | item)', type: 'textarea', rows: 12, def: 'Starters | Roasted tomato soup\nStarters | Garden salad\nMain | Herb chicken with potatoes\nMain | Mushroom risotto\nDessert | Lemon tart\nDrinks | Sparkling water · Juice · Tea' },
    ],
    presets: {},
    build(v) {
      const groups = {};
      L(v.items).forEach((l) => { const [s, ...r] = l.split('|'); const k = r.length ? s.trim() : ''; (groups[k] ||= []).push((r.length ? r.join('|') : s).trim()); });
      const body = Object.entries(groups).map(([k, items]) => `${k ? `<div class="h" style="font-size:1.25em;margin:.9em 0 .25em;letter-spacing:.12em;text-transform:uppercase">${esc(k)}</div>` : ''}${items.map((i) => `<div style="margin:.2em 0">${esc(i)}</div>`).join('')}`).join('');
      const inner = `<div class="h" style="font-size:3.4em;line-height:1">${esc(v.title)}</div><div style="margin-top:.4em;font-size:1em;opacity:.85">${esc(v.sub)}</div>${ORN}${body}`;
      return [{ flush: true, html: `<div style="width:100%;height:100%;position:relative;font-size:20px;color:var(--ink)">${frame(v.style, inner)}</div>` }];
    },
  },

  voucher: {
    group: 'Home & business', label: 'Gift voucher', emoji: '🎁', query: 'gift certificate template printable', note: 'Gift certificates, 3 per page, with To/From/Amount lines.',
    fields: [{ id: 'title', label: 'Title', def: 'Gift Certificate' }, { id: 'shop', label: 'From (shop / person)', def: 'Your Name' }, { id: 'terms', label: 'Small print', def: 'Redeemable once · Not exchangeable for cash' }, { id: 'count', label: 'Vouchers (3–30)', type: 'number', def: 6 }],
    presets: {},
    build(v) {
      const ln = (w) => `<span style="display:inline-block;width:${w}%;border-bottom:1.2px solid currentColor">&nbsp;</span>`;
      const one = () => `<div class="box soft" style="height:3in;margin-bottom:.18in;padding:.15in .3in;display:flex;flex-direction:column;justify-content:center;position:relative;border-style:double;border-width:4px">
        <div style="display:flex;justify-content:space-between;align-items:end"><div class="h" style="font-size:30px">${esc(v.title)}</div><div class="small">${esc(v.shop)}</div></div>
        <div style="line-height:2.3;font-size:12px;margin-top:.1in">To: ${ln(70)}<br>Amount / service: ${ln(48)} &nbsp; Valid until: ${ln(18)}<br>From: ${ln(70)}</div><div class="small" style="margin-top:.05in">${esc(v.terms)}</div></div>`;
      return chunk(Array.from({ length: num(v.count, 6, 3, 30) }), 3).map((g) => g.map(one).join(''));
    },
  },

  labels: {
    group: 'Home & business', label: 'Pantry / jar labels', emoji: '🏷️', query: 'pantry labels printable', note: 'Rounded labels, 3 per row. Edit the names to fit your jars.',
    fields: [
      sel('shape', 'Shape', [['rect', 'Rounded rectangle'], ['pill', 'Pill']], 'rect'),
      { id: 'names', label: 'Label text (one per line)', type: 'textarea', rows: 10, def: 'Flour\nSugar\nBrown sugar\nRice\nPasta\nOats\nLentils\nBeans\nCoffee\nTea\nSalt\nSpices' },
    ],
    presets: {},
    build(v) {
      const r = v.shape === 'pill' ? '999px' : '10px';
      const items = L(v.names);
      const lab = (t) => `<div class="box soft" style="height:1in;border-radius:${r};display:flex;align-items:center;justify-content:center;text-align:center;padding:0 .1in"><span class="h" style="font-size:20px">${esc(t)}</span></div>`;
      return chunk(items, 24).map((g) => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.15in;align-content:start">${g.map(lab).join('')}</div>`);
    },
  },
};
