import { $, $$, esc, store, toast } from '../ui.js';
import { icons } from '../icons.js';
import { PALETTES, FONTS, sheetDoc, docShell, pagesToBody, chunk, lines, list } from '../studio-core.js';
import { createEditor } from '../studio-editor.js';
import { PLANNERS } from '../studio-planners.js';
import { WEDDING } from '../studio-wedding.js';
import { EXTRA } from '../studio-extra.js';
import { LOOKS, loadAll, saveTemplate, deleteTemplate, downloadTemplate, importFile } from '../studio-templates.js';

/*
 * Design Studio — builds original, print-ready digital products with fixed layouts.
 * No AI is used anywhere: every layout is coded here, every word is the seller's own or a
 * plain preset the seller can edit. Output is a full HTML document → "Print → Save as PDF".
 * Fonts are SIL Open Font License (Google Fonts), which allow commercial use inside a product.
 */

// ---------- preset texts (plain, original, fully editable) ----------
const COUPONS = {
  mother: ['Breakfast in bed', 'A hug whenever you need one', 'I will do the dishes tonight', 'Movie afternoon, your choice', 'A relaxing foot massage', 'Your favorite dinner, cooked by me', 'One day with no complaints', 'Tea and a long chat', 'A handwritten letter from me', 'A walk together', 'I will wash the car', 'You choose the music all day'],
  valentine: ['A candlelit dinner at home', 'One long cuddle', 'Movie night, your pick', 'A relaxing massage', 'Breakfast in bed', 'A surprise date', 'A handwritten love note', 'A sunset walk together', 'Dessert for two', 'A day without chores', 'A playlist made for you', 'One wish granted (within reason)'],
  father: ['Your favorite breakfast', 'I will wash the car', 'Grill dinner is on me', 'One nap, no interruptions', 'Game night, your pick', 'A long drive with your playlist', 'One coffee run', 'Help with a weekend project', 'A walk and a talk', 'Your favorite dessert', 'A day with no chores', 'A hug that lasts as long as you like'],
  blank: ['', '', '', '', '', '', '', ''],
};
const BINGO = {
  christmas: 'Christmas tree, Star, Ornament, Stocking, Candy cane, Snowman, Reindeer, Sleigh, Wreath, Gingerbread, Mistletoe, Snowflake, Present, Bells, Angel, Elf, Fireplace, Hot cocoa, Lights, Carols, Santa hat, Mittens, Nutcracker, Holly, Penguin, Cookies, Scarf, Ribbon, Cinnamon, Pine cone',
  newyear: 'Countdown, Confetti, Midnight, Resolutions, Fireworks, Party hat, Noisemaker, Streamers, Balloons, Sparkler, Toast, Glitter, Clock, Photo booth, Ball drop, Cheers, Tiara, Disco ball, Snacks, Calendar, Goals, Hugs, Music, Dancing, Sparkles, Midnight kiss, Gold, Silver, Lucky, Fresh start',
  ramadan: 'Crescent moon, Lantern, Dates, Quran, Prayer mat, Iftar, Suhoor, Tasbih, Mosque, Charity, Kindness, Dua, Family, Taraweeh, Star, Zakat, Samosa, Fruit chaat, Water, Patience, Gratitude, Forgiveness, Sharing, Eid, Henna, New clothes, Sweets, Gifts, Visiting, Hugs',
  blank: '',
};

// ---------- products ----------
const PARTY = {
  coupon: {
    label: 'Coupon book', emoji: '🎟️', query: 'mothers day coupon book printable', note: 'Mother’s Day, Valentine’s, Father’s Day. 8 coupons per page.',
    fields: [
      { id: 'title', label: 'Cover title', def: 'Love Coupons' },
      { id: 'forWho', label: 'Cover subtitle', def: 'Redeem anytime, with love' },
      { id: 'items', label: 'Coupons (one per line)', type: 'textarea', rows: 10, def: COUPONS.mother.join('\n') },
    ],
    presets: { 'Mother’s Day': { title: 'Mother’s Day Coupons', forWho: 'For the best mom', items: COUPONS.mother.join('\n') }, 'Valentine’s': { title: 'Love Coupons', forWho: 'Redeem anytime, with love', items: COUPONS.valentine.join('\n') }, 'Father’s Day': { title: 'Father’s Day Coupons', forWho: 'For the best dad', items: COUPONS.father.join('\n') }, 'Blank (write your own)': { title: 'Coupon Book', forWho: 'Good for one favor', items: COUPONS.blank.join('\n') } },
    build(v) {
      const items = String(v.items || '').split('\n').map((x) => x.trim());
      const cover = `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center" class="box">
        <div class="small" style="letter-spacing:.3em;text-transform:uppercase">A little book of</div>
        <h1 class="h" style="font-size:54px;margin:.2in .4in">${esc(v.title)}</h1><div class="rule"></div>
        <p style="font-size:17px;margin:.1in 0 .5in">${esc(v.forWho)}</p>
        <div style="width:70%;text-align:left;font-size:14px">To: <span style="display:inline-block;width:70%;border-bottom:1.2px solid currentColor"></span><br><br>From: <span style="display:inline-block;width:65%;border-bottom:1.2px solid currentColor"></span></div></div>`;
      const pages = chunk(items, 8).map((grp) => `<div style="display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:2.25in;gap:.2in;height:100%;align-content:start">${grp.map((t) => `
        <div class="box soft" style="border-style:dashed;border-width:2px;border-radius:14px;padding:.18in;text-align:center;display:flex;flex-direction:column;justify-content:center">
          <div class="small" style="letter-spacing:.25em;text-transform:uppercase">Coupon</div>
          <div class="h" style="font-size:19px;margin:.08in 0;line-height:1.2">${esc(t) || '&nbsp;'}</div>
          ${t ? '' : '<div class="line"></div><div class="line"></div>'}
          <div class="small" style="margin-top:.08in">Redeem by: ____________</div></div>`).join('')}</div>`);
      return [cover, ...pages];
    },
  },

  bingo: {
    label: 'Bingo cards', emoji: '🎯', query: 'christmas bingo printable', note: 'Unique cards, 2 per page + caller sheet.',
    fields: [
      { id: 'title', label: 'Title', def: 'Christmas Bingo' },
      { id: 'head5', label: 'Column letters (5)', def: 'B,I,N,G,O' },
      { id: 'words', label: 'Words (need 24+ for 5×5)', type: 'textarea', rows: 6, def: BINGO.christmas },
      { id: 'cards', label: 'Number of unique cards (2–30)', type: 'number', def: 10 },
    ],
    presets: { Christmas: { title: 'Christmas Bingo', words: BINGO.christmas }, 'New Year’s Eve': { title: 'New Year Bingo', words: BINGO.newyear }, 'Ramadan / Eid': { title: 'Ramadan Bingo', words: BINGO.ramadan } },
    build(v) {
      const words = [...new Set(list(v.words))];
      if (words.length < 24) return [`<div style="padding:1in;text-align:center"><h2 class="h">Add at least 24 different words</h2><p>You have ${words.length}. A 5×5 card has 24 words plus a free space.</p></div>`];
      const heads = list(v.head5).slice(0, 5);
      while (heads.length < 5) heads.push('');
      const n = Math.max(2, Math.min(30, Number(v.cards) || 10));
      const seen = new Set();
      const cards = [];
      let tries = 0;
      while (cards.length < n && tries++ < 500) {
        const pick = [...words].sort(() => Math.random() - 0.5).slice(0, 24);
        const key = [...pick].sort().join('|');
        if (!seen.has(key)) { seen.add(key); cards.push(pick); }
      }
      const card = (pick, i) => {
        const cells = [...pick.slice(0, 12), null, ...pick.slice(12)];
        return `<div style="height:4.75in;margin-bottom:.2in"><div style="text-align:center"><h1 class="h" style="font-size:30px">${esc(v.title)}</h1><div class="small">Card ${i + 1}</div></div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:.3in repeat(5,.72in);gap:4px;margin-top:.08in">
          ${heads.map((h) => `<div class="h" style="text-align:center;font-size:20px;background:${'transparent'}">${esc(h)}</div>`).join('')}
          ${cells.map((c) => `<div class="box ${c === null ? 'soft' : ''}" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:4px;font-size:${c && c.length > 12 ? 10 : 12}px;line-height:1.15">${c === null ? `<b class="h" style="font-size:13px">FREE</b>` : esc(c)}</div>`).join('')}</div></div>`;
      };
      const callers = `<h1 class="h" style="text-align:center;font-size:30px">${esc(v.title)} — Caller sheet</h1><p class="small" style="text-align:center">Cut the words into slips and draw them one at a time.</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:.15in">${words.map((w) => `<div class="box" style="padding:8px 4px;text-align:center;font-size:12px">${esc(w)}</div>`).join('')}</div>`;
      return [...chunk(cards, 2).map((g, gi) => g.map((c, i) => card(c, gi * 2 + i)).join('')), callers];
    },
  },

  tags: {
    label: 'Gift tags', emoji: '🏷️', query: 'christmas gift tags printable', note: '12 tags per page with To/From lines.',
    fields: [
      { id: 'greetings', label: 'Greetings (comma or line separated; cycled)', type: 'textarea', rows: 3, def: 'Merry Christmas, Happy Holidays, Joy, Peace, Love, Season’s Greetings' },
      { id: 'pages', label: 'Pages', type: 'number', def: 2 },
    ],
    presets: { Christmas: { greetings: 'Merry Christmas, Happy Holidays, Joy, Peace, Love, Season’s Greetings' }, Birthday: { greetings: 'Happy Birthday, Make a wish, Celebrate, Hooray, Cheers to you' }, 'Eid / Ramadan': { greetings: 'Eid Mubarak, Ramadan Kareem, Blessings, With love, Taqabbalallahu minna wa minkum' }, Thanks: { greetings: 'Thank you, With gratitude, Just because, For you' } },
    build(v) {
      const g = list(v.greetings);
      const g2 = g.length ? g : ['Happy Holidays'];
      const total = Math.max(1, Math.min(10, Number(v.pages) || 2));
      return Array.from({ length: total }, (_, pi) => `<div style="display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:2.2in;gap:.18in;align-content:start;height:100%">
        ${Array.from({ length: 12 }, (_, i) => `<div class="box soft" style="position:relative;border-radius:10px 10px 10px 10px;padding:.32in .12in .1in;text-align:center;display:flex;flex-direction:column;justify-content:space-between">
          <div style="position:absolute;top:.1in;left:50%;width:.16in;height:.16in;margin-left:-.08in;border:1.6px solid currentColor;border-radius:50%;background:#fff"></div>
          <div class="h" style="font-size:17px;line-height:1.2">${esc(g2[(pi * 12 + i) % g2.length])}</div>
          <div class="small" style="text-align:left">To: ____________<br><br>From: __________</div></div>`).join('')}</div>`);
    },
  },

  ramadan: {
    label: 'Ramadan tracker', emoji: '🌙', query: 'ramadan planner printable', note: '30-day prayer, Quran and good-deeds tracker.',
    fields: [
      { id: 'title', label: 'Title', def: 'Ramadan Tracker' },
      { id: 'year', label: 'Year / subtitle', def: '1448 AH' },
      { id: 'start', label: 'First day of Ramadan (optional, shows dates)', type: 'date', def: '' },
      { id: 'cols', label: 'Columns (comma separated)', type: 'textarea', rows: 2, def: 'Fajr, Dhuhr, Asr, Maghrib, Isha, Taraweeh, Quran pages, Charity, Good deed' },
    ],
    presets: {},
    build(v) {
      const cols = list(v.cols).slice(0, 10);
      const start = v.start ? new Date(v.start + 'T00:00:00') : null;
      const cell = 'border:1.2px solid currentColor;height:.27in';
      const days = Array.from({ length: 30 }, (_, i) => {
        const d = start ? new Date(start.getTime() + i * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        return `<tr><td style="${cell};font-weight:700;text-align:center">${i + 1}</td><td class="small" style="${cell};text-align:center">${d}</td>${cols.map(() => `<td style="${cell}"></td>`).join('')}</tr>`;
      }).join('');
      const th = 'border:1.2px solid currentColor;padding:4px 2px;font-size:9px';
      const track = `<div style="text-align:center"><h1 class="h" style="font-size:36px">${esc(v.title)}</h1><div class="small">${esc(v.year)}</div></div>
        <table style="width:100%;border-collapse:collapse;margin-top:.12in;font-size:10px">
        <thead><tr><th class="soft" style="${th}">Day</th><th class="soft" style="${th}">Date</th>${cols.map((c) => `<th class="soft" style="${th}">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${days}</tbody></table>`;
      const goals = `<h1 class="h" style="text-align:center;font-size:32px">My Ramadan Goals</h1><div class="rule"></div>
        ${['Spiritual goals', 'Quran goals', 'Family & community', 'Habits to build', 'Habits to leave'].map((t) => `<h3 class="h" style="font-size:16px;margin:.15in 0 0">${t}</h3>${lines(2)}`).join('')}`;
      const duas = `<h1 class="h" style="text-align:center;font-size:32px">Dua List &amp; Gratitude</h1><div class="rule"></div>
        <h3 class="h" style="font-size:16px">Duas I want to make</h3>${lines(8)}<h3 class="h" style="font-size:16px;margin-top:.2in">I am grateful for</h3>${lines(8)}`;
      return [track, goals, duas];
    },
  },

  seating: {
    label: 'Seating chart', emoji: '💍', query: 'wedding seating chart template', note: 'Table cards with numbered name lines.',
    fields: [
      { id: 'title', label: 'Title', def: 'Seating Chart' },
      { id: 'names', label: 'Couple / event name', def: 'Emma & James · June 12, 2027' },
      { id: 'tables', label: 'Number of tables (1–24)', type: 'number', def: 10 },
      { id: 'seats', label: 'Seats per table (2–12)', type: 'number', def: 8 },
    ],
    presets: {},
    build(v) {
      const t = Math.max(1, Math.min(24, Number(v.tables) || 10));
      const s = Math.max(2, Math.min(12, Number(v.seats) || 8));
      const cover = `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center" class="box"><div class="small" style="letter-spacing:.3em;text-transform:uppercase">Welcome</div>
        <h1 class="h" style="font-size:58px;margin:.2in">${esc(v.title)}</h1><div class="rule"></div><p style="font-size:18px">${esc(v.names)}</p><p class="small">Find your name and table</p></div>`;
      const cards = Array.from({ length: t }, (_, i) => `<div class="box" style="padding:.12in .15in;height:4.3in"><div class="h" style="text-align:center;font-size:22px;border-bottom:2px solid currentColor;padding-bottom:4px">Table ${i + 1}</div>
        ${Array.from({ length: s }, (_, k) => `<div style="display:flex;gap:6px;align-items:end;height:${(3.45 / s).toFixed(2)}in;font-size:10px"><span class="small" style="width:14px">${k + 1}</span><span style="flex:1;border-bottom:1px solid currentColor;height:.2in"></span></div>`).join('')}</div>`);
      return [cover, ...chunk(cards, 4).map((g) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.2in;align-content:start">${g.join('')}</div>`)];
    },
  },

  santa: {
    label: 'Secret Santa', emoji: '🎅', query: 'secret santa printable', note: 'Wish-list cards, 2 per page, plus a rules page.',
    fields: [
      { id: 'title', label: 'Title', def: 'Secret Santa' },
      { id: 'budget', label: 'Budget', def: '$25' },
      { id: 'date', label: 'Gift exchange date', def: 'December 20' },
      { id: 'cards', label: 'Wish-list cards (2–20)', type: 'number', def: 8 },
    ],
    presets: {},
    build(v) {
      const rules = `<div style="text-align:center"><h1 class="h" style="font-size:52px">${esc(v.title)}</h1><div class="rule"></div></div>
        <div class="box soft" style="padding:.3in;margin-top:.3in;font-size:16px;line-height:1.7">
        <b>How it works</b><ol><li>Everyone writes a name on a slip and draws one.</li><li>Keep your person a secret!</li><li>Fill in your wish-list card so your Santa knows what you like.</li><li>Bring a wrapped gift under <b>${esc(v.budget)}</b>.</li><li>Exchange gifts on <b>${esc(v.date)}</b>.</li></ol></div>
        <h3 class="h" style="margin-top:.3in">Who is playing</h3>${lines(10)}`;
      const n = Math.max(2, Math.min(20, Number(v.cards) || 8));
      const card = () => `<div class="box" style="height:4.6in;margin-bottom:.2in;padding:.2in .3in"><h2 class="h" style="text-align:center;font-size:26px">${esc(v.title)} Wish List</h2><div class="rule"></div>
        ${['Name', 'Favorite colors', 'Favorite treats', 'Hobbies', 'Sizes', 'Allergies', 'Gift ideas'].map((t) => `<div style="display:flex;gap:8px;align-items:end;font-size:12px;height:.43in"><b style="white-space:nowrap">${t}:</b><span style="flex:1;border-bottom:1.2px solid currentColor;height:.2in"></span></div>`).join('')}</div>`;
      return [rules, ...chunk(Array.from({ length: n }), 2).map((g) => g.map(card).join(''))];
    },
  },

  nye: {
    label: 'New Year cards', emoji: '🎆', query: 'new years eve party games printable', note: 'Predictions & resolutions cards, 4 per page.',
    fields: [
      { id: 'year', label: 'Year', def: '2027' },
      { id: 'cards', label: 'Number of cards (4–40)', type: 'number', def: 12 },
    ],
    presets: {},
    build(v) {
      const n = Math.max(4, Math.min(40, Number(v.cards) || 12));
      const card = () => `<div class="box" style="padding:.15in .2in;height:4.55in;position:relative"><h2 class="h" style="text-align:center;font-size:28px">Hello ${esc(v.year)}!</h2><div class="rule"></div>
        <div style="font-size:11px;margin-bottom:6px">Name: ____________________</div>
        <b class="h" style="font-size:14px">My 3 predictions</b>${lines(3)}
        <b class="h" style="font-size:14px;display:block;margin-top:.1in">One thing I leave behind</b>${lines(1)}
        <b class="h" style="font-size:14px;display:block;margin-top:.1in">My resolution</b>${lines(2)}</div>`;
      return chunk(Array.from({ length: n }), 4).map((g) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.18in;align-content:start">${g.map(card).join('')}</div>`);
    },
  },
};
for (const p of Object.values(PARTY)) p.group = 'Seasonal & party';
PARTY.seating.group = 'Wedding';
const PRODUCTS = { ...PLANNERS, ...WEDDING, ...EXTRA, ...PARTY };
const GROUPS = ['Planners', 'Wedding', 'Cards & invitations', 'Kids & family', 'Home & business', 'Seasonal & party'];

// Used by other pages to offer "Design this" for a researched keyword.
export function matchProduct(q) {
  const s = String(q || '').toLowerCase();
  const rules = [['coupon', /coupon/], ['bingo', /bingo/], ['tags', /gift tag/], ['ramadan', /ramadan|eid/], ['seating', /seating chart/], ['santa', /secret santa/], ['nye', /new year|nye/],
    ['invite', /wedding invit/], ['savedate', /save the date/], ['rsvp', /rsvp/], ['program', /wedding program/], ['tablenum', /table number/], ['place', /place card/], ['thanks', /thank you card/], ['welcome', /welcome sign/], ['timeline', /wedding timeline/], ['checklist', /wedding (planner|checklist)/],
    ['birthday', /birthday invit/], ['baby', /baby shower/], ['certificate', /^certificate|certificate template/], ['recipe', /recipe card/], ['bookmark', /bookmark/], ['orderthanks', /thank you for your order/], ['chores', /chore/], ['reward', /reward chart|star chart/], ['milestone', /milestone/], ['menu', /menu template|menu printable/], ['voucher', /gift certificate|voucher/], ['labels', /pantry label|jar label|label/],
    ['daily', /daily planner/], ['weekly', /weekly planner/], ['monthly', /monthly (planner|calendar)|calendar printable/], ['habit', /habit/], ['budget', /budget/], ['meal', /meal (plan|planner)/], ['todo', /to.?do/], ['goals', /goal/], ['gratitude', /gratitude|journal/], ['workout', /workout|fitness/], ['cleaning', /cleaning/], ['student', /student|school planner|teacher planner/]];
  return rules.find(([, re]) => re.test(s))?.[0] || null;
}

// ---------- page ----------
export async function render(view, ctx) {
  const key = PRODUCTS[ctx.params.p] ? ctx.params.p : 'weekly';
  const prod = PRODUCTS[key];
  const saved = store.get('studio-common', {});
  const state = { palette: saved.palette || 'sage', head: saved.head || 'Playfair Display', body: saved.body || 'Poppins', paper: saved.paper || 'letter', shop: saved.shop || '', license: saved.license ?? 'Personal use only · Not for resale' };
  const vals = Object.fromEntries(prod.fields.map((f) => [f.id, f.def]));

  const opt = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(v.name || k)}</option>`).join('');
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Design Studio</h1>
      <p>Pick a product, edit the words, choose colors and fonts, then save it as a print-ready PDF. Layouts are built into the app — <b>no AI is used</b>, so the design is yours and fits Etsy’s Creativity Standards (“Designed by” you).</p>
    </div></div>
    <input class="input" id="st-search" placeholder="Search ${Object.keys(PRODUCTS).length} templates — e.g. planner, wedding, kids, menu…" style="max-width:420px;margin-bottom:6px">
    <div id="st-groups">${GROUPS.map((g) => `<div class="st-g"><div class="muted small" style="margin:8px 0 4px;font-weight:600">${g}</div><div class="chips">${Object.entries(PRODUCTS).filter(([, p]) => p.group === g).map(([k, p]) => `<a class="chip ${k === key ? 'accent' : ''}" data-k="${esc((p.label + ' ' + g + ' ' + (p.query || '')).toLowerCase())}" href="#/studio?p=${k}">${p.emoji} ${esc(p.label)}</a>`).join('')}</div></div>`).join('')}</div>
    <details class="card" id="st-looks" style="margin:14px 0 0"><summary style="cursor:pointer;font-weight:600">🎨 Template looks — ${LOOKS.length} ready-made styles for this design (click one to apply)</summary>
      <div id="st-looks-grid" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px"></div></details>
    <details class="card" id="st-mine" style="margin:10px 0 14px"><summary style="cursor:pointer;font-weight:600">📁 My templates &amp; import</summary>
      <div class="row" style="margin:10px 0;flex-wrap:wrap">
        <label class="btn secondary sm" style="cursor:pointer">⬆ Import template / image<input type="file" id="st-import" accept=".json,.html,.htm,.png,.jpg,.jpeg,.webp,.svg" hidden></label>
        <span class="muted small">Import a template exported from here (.json), an HTML file, or a PNG/JPG/SVG page (e.g. exported from Canva) to use as a background and add editable text on top.</span></div>
      <div id="st-mine-list"></div>
      <p class="muted small" style="margin-top:8px">Saved templates live in this browser only — use <b>Export</b> to keep a backup file. Only import designs you created or have the right to use.</p></details>
    <div class="grid split-wide">
      <div class="card stack" id="st-form">
        <div><h3>${prod.emoji} ${esc(prod.label)}</h3><p class="muted small">${esc(prod.note)}</p></div>
<div id="st-fields" class="stack">
        ${Object.keys(prod.presets).length ? `<label class="field">Start from a preset<select class="input" id="st-preset"><option value="">— choose —</option>${Object.keys(prod.presets).map((k) => `<option>${esc(k)}</option>`).join('')}</select></label>` : ''}
        ${prod.fields.map((f) => f.type === 'textarea'
          ? `<label class="field">${esc(f.label)}<textarea class="input" data-f="${f.id}" rows="${f.rows || 4}">${esc(f.def)}</textarea></label>`
          : f.type === 'select'
          ? `<label class="field">${esc(f.label)}<select class="input" data-f="${f.id}">${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${val === String(f.def) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select></label>`
          : `<label class="field">${esc(f.label)}<input class="input" data-f="${f.id}" type="${f.type || 'text'}" value="${esc(f.def)}"></label>`).join('')}
        </div>
        <details class="advanced" open><summary>Style &amp; branding</summary>
          <div class="field-row">
            <label class="field">Colors<select class="input" data-s="palette">${opt(PALETTES, state.palette)}</select></label>
            <label class="field">Heading font<select class="input" data-s="head">${opt(FONTS, state.head)}</select></label>
            <label class="field">Body font<select class="input" data-s="body">${opt(FONTS, state.body)}</select></label>
            <label class="field">Paper<select class="input" data-s="paper"><option value="letter" ${state.paper === 'letter' ? 'selected' : ''}>US Letter</option><option value="A4" ${state.paper === 'A4' ? 'selected' : ''}>A4</option></select></label>
            <label class="field">Shop name (footer)<input class="input" data-s="shop" value="${esc(state.shop)}"></label>
            <label class="field">License line<input class="input" data-s="license" value="${esc(state.license)}"></label>
          </div>
        </details>
        <div class="row"><button class="btn" id="st-print">🖨 Save as PDF / Print</button>
          <a class="btn secondary" href="#/digital?q=${encodeURIComponent(prod.query)}">Research this niche</a>
          <a class="btn secondary" href="#/builder">Write the listing</a></div>
        <p class="muted small">In the print window choose <b>Save as PDF</b>, the matching paper size, margins <b>None</b>, and tick <b>Background graphics</b>. Make a Letter and an A4 version and include both (Etsy allows 5 files, 20&nbsp;MB each).</p>
      </div>
      <div class="card"><div class="card-head"><div><h3>Preview</h3><p id="st-hint">Updates as you type</p></div>
          <div class="row"><button class="btn secondary sm" id="st-save" title="Save this design to My templates">💾 Save as my template</button>
          <button class="btn" id="st-edit">✏️ Customize like Canva</button></div></div>
        <div id="ed-bar" hidden style="margin-bottom:8px"></div>
        <iframe id="st-prev" title="Preview" style="width:100%;height:70vh;border:1px solid var(--border);border-radius:10px;background:#e8e6e2"></iframe></div>
    </div>
    <div class="card" style="margin-top:16px"><h3>${icons.shield} Before you list</h3><ul style="margin:6px 0 0;padding-left:18px" class="small">
      <li>Write the coupon/prompt text in your own words — presets are plain starting points, edit them.</li>
      <li>The fonts here are open-license (OFL) and allowed inside a product you sell. If you add other fonts, check their commercial license.</li>
      <li>Don’t add characters, brands, song lyrics or celebrity names. Santa, Easter bunny and generic icons are fine.</li>
      <li>Make mockups from a photo of your actual printed file so photos match what buyers receive.</li>
      <li>Keep your source settings (this page) and drafts as proof of your own work. Run the finished listing through the <a href="#/policy">Policy Checker</a> with “AI tools used” unticked.</li></ul></div>`;

  const frame = $('#st-prev', view);
  const opts = () => ({ ...state, title: vals.title || prod.label });
  let editing = false;
  const ed = createEditor({ frame, bar: $('#ed-bar', view), getState: () => state, notify: toast });
  const build = () => {
    try { return sheetDoc({ pages: prod.build(vals), o: opts(), preview: true }); } catch (e) { return `<p style="font:14px sans-serif;padding:20px">${esc(e.message)}</p>`; }
  };
  let t;
  const draw = () => {
    if (editing) return;
    clearTimeout(t);
    t = setTimeout(() => { frame.srcdoc = build(); }, 120);
  };

  view.oninput = (e) => {
    const f = e.target.dataset?.f;
    const s = e.target.dataset?.s;
    if (s) { state[s] = e.target.value; store.set('studio-common', state); }
    if (editing) { if (s) ed.applyTheme(state); return; }
    if (f) vals[f] = e.target.value;
    if (f || s) draw();
  };
  const preset = $('#st-preset', view);
  preset?.addEventListener('change', () => {
    const p = prod.presets[preset.value];
    if (!p) return;
    Object.assign(vals, p);
    $$('[data-f]', view).forEach((el) => { if (p[el.dataset.f] !== undefined) el.value = p[el.dataset.f]; });
    draw();
  });
  // Customize mode: the preview becomes a Canva-style editor and the content fields are locked.
  const split = $('.split-wide', view);
  const setEditing = (on) => {
    editing = on;
    $('#st-fields', view).style.display = on ? 'none' : '';
    $('#st-edit', view).textContent = on ? '↩ Back to form (discards edits)' : '✏️ Customize like Canva';
    $('#st-edit', view).classList.toggle('secondary', on);
    $('#st-hint', view).textContent = on ? 'Click text to type · click an element to restyle it' : 'Updates as you type';
    split.style.gridTemplateColumns = on ? 'minmax(0,1fr)' : '';
    frame.style.height = on ? '78vh' : '70vh';
  };
  $('#st-edit', view).addEventListener('click', () => {
    if (editing) {
      if (!confirm('Go back to the form? Your manual edits will be discarded.')) return;
      ed.disable();
      setEditing(false);
      frame.srcdoc = build();
      return;
    }
    clearTimeout(t);
    setEditing(true);
    frame.addEventListener('load', () => { ed.enable(); ed.applyTheme(state); }, { once: true });
    frame.srcdoc = build();
  });

  $('#st-print', view).addEventListener('click', () => {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups for this site, then try again'); return; }
    const html = editing
      ? docShell({ bodyHtml: ed.exportBody(), o: { ...opts(), extraFonts: ed.usedFonts() }, preview: false })
      : sheetDoc({ pages: prod.build(vals), o: opts(), preview: false });
    w.document.open();
    w.document.write(html);
    w.document.close();
    const go = () => setTimeout(() => w.print(), 400);
    (w.document.fonts?.ready || Promise.resolve()).then(go, go);
  });

  // ----- search across all templates -----
  $('#st-search', view).addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    $$('#st-groups .chip', view).forEach((c) => { c.style.display = !q || c.dataset.k.includes(q) ? '' : 'none'; });
    $$('#st-groups .st-g', view).forEach((g) => { g.style.display = [...g.querySelectorAll('.chip')].some((c) => c.style.display !== 'none') ? '' : 'none'; });
  });

  // ----- template looks (palette + fonts) with live thumbnails -----
  const syncStyleInputs = () => $$('[data-s]', view).forEach((el) => { if (state[el.dataset.s] !== undefined) el.value = state[el.dataset.s]; });
  const applyLook = (l) => {
    Object.assign(state, { palette: l.palette, head: l.head, body: l.body });
    store.set('studio-common', state);
    syncStyleInputs();
    if (editing) ed.applyTheme(state); else draw();
  };
  const looks = $('#st-looks', view);
  let looksDone = false;
  looks.addEventListener('toggle', () => {
    if (!looks.open || looksDone) return;
    looksDone = true;
    let first;
    try { first = prod.build(vals)[0]; } catch { first = '<p>Preview unavailable</p>'; }
    $('#st-looks-grid', view).innerHTML = LOOKS.map((l) => `<button type="button" class="card" data-look="${l.id}" style="padding:6px;cursor:pointer;text-align:center;width:150px;border:1px solid var(--border);background:var(--surface)">
      <iframe tabindex="-1" style="width:136px;height:182px;border:0;pointer-events:none;background:#e8e6e2;border-radius:6px" srcdoc="${esc(sheetDoc({ pages: [first], o: { ...state, palette: l.palette, head: l.head, body: l.body, zoom: 0.165 }, preview: true }))}"></iframe>
      <div class="small" style="margin-top:4px;font-weight:600">${esc(l.name)}</div></button>`).join('');
  });
  $('#st-looks-grid', view).addEventListener('click', (e) => {
    const b = e.target.closest('[data-look]');
    if (b) applyLook(LOOKS.find((l) => l.id === b.dataset.look));
  });

  // ----- my templates, import, save -----
  const gstate = () => ({ palette: state.palette, head: state.head, body: state.body, paper: state.paper });
  const openTemplate = (tpl) => {
    clearTimeout(t);
    if (editing) ed.disable();
    Object.assign(state, tpl.state || {});
    store.set('studio-common', state);
    syncStyleInputs();
    setEditing(true);
    frame.addEventListener('load', () => { ed.enable({ fonts: tpl.fonts || [] }); ed.applyTheme(state); }, { once: true });
    frame.srcdoc = docShell({ bodyHtml: tpl.html, o: { ...opts(), title: tpl.name, extraFonts: tpl.fonts || [] }, preview: true });
    frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const renderMine = () => {
    const all = loadAll();
    $('#st-mine-list', view).innerHTML = all.length
      ? `<div class="stack" style="gap:6px">${all.map((x) => `<div class="row" style="gap:8px;align-items:center;border:1px solid var(--border);border-radius:8px;padding:6px 10px">
          <div style="flex:1;min-width:0"><b>${esc(x.name)}</b> <span class="muted small">${esc(PRODUCTS[x.product]?.label || 'Imported')} · ${new Date(x.created).toLocaleDateString()}</span></div>
          <button class="btn sm" data-open="${x.id}">Open &amp; edit</button><button class="btn secondary sm" data-export="${x.id}">Export</button><button class="btn secondary sm" data-del="${x.id}">Delete</button></div>`).join('')}</div>`
      : '<p class="muted small">No saved templates yet. Design something and press “Save as my template”.</p>';
  };
  renderMine();
  $('#st-mine-list', view).addEventListener('click', (e) => {
    const id = (e.target.closest('[data-open]') || e.target.closest('[data-export]') || e.target.closest('[data-del]'))?.dataset;
    const tpl = loadAll().find((x) => x.id === (id?.open || id?.export || id?.del));
    if (!tpl) return;
    if (id.open) openTemplate(tpl);
    else if (id.export) downloadTemplate(tpl);
    else if (confirm(`Delete “${tpl.name}”?`)) { deleteTemplate(tpl.id); renderMine(); }
  });
  $('#st-import', view).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    try {
      const tpl = await importFile(file);
      toast(`Imported “${tpl.name}” — edit it, then press Save as my template`);
      openTemplate(tpl);
    } catch (err) {
      toast(err.message);
      alert(err.message);
    }
  });
  $('#st-save', view).addEventListener('click', () => {
    const name = prompt('Name for this template', `${prod.label} — my design`);
    if (!name) return;
    const html = editing ? ed.exportBody({ keepMeta: true }) : pagesToBody(prod.build(vals), opts());
    const r = saveTemplate({ name: name.slice(0, 80), product: key, state: gstate(), fonts: editing ? ed.usedFonts() : [], html });
    if (r.ok) { toast('Saved to My templates'); renderMine(); $('#st-mine', view).open = true; } else alert(r.error);
  });
  draw();
}
