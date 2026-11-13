import { esc } from './ui.js';
import { chunk, col, head, sec, ruled, todo, table } from './studio-core.js';

/*
 * Packaging, labels and trackers for handmade sellers. Use them for your own orders, or sell
 * them as printable digital products to other makers. Fixed layouts — no AI. The care and
 * warning texts are plain starting points: adjust them to your product and check the labeling
 * and safety rules of the country you sell in (this is not legal advice).
 */

const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || d));
const sel = (id, label, options, def) => ({ id, label, type: 'select', options, def });
const L = (t) => String(t || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const ul = '<span style="display:inline-block;border-bottom:1.2px solid currentColor;width:%w%">&nbsp;</span>';
const blank = (w) => ul.replace('%w%', w);
const GROUP = 'Handmade maker tools';

const CARE = {
  candle: 'Trim the wick to 1/4 in before each burn\nBurn 2–4 hours at a time\nKeep away from drafts, children and pets\nNever leave a burning candle unattended\nStop using when 1/2 in of wax remains',
  knit: 'Hand wash cold with mild soap\nDo not wring or twist\nLay flat to dry\nReshape while damp\nStore folded, not hung',
  jewelry: 'Remove before swimming or showering\nAvoid perfume and lotion on the piece\nWipe gently with a soft dry cloth\nStore separately in a dry place',
  leather: 'Keep away from prolonged water\nCondition occasionally with leather balm\nLet dry naturally if it gets wet\nStore away from direct heat',
  wood: 'Wipe with a damp cloth, do not soak\nDry immediately after cleaning\nRe-oil now and then with a suitable finish\nKeep out of direct sun and heat',
  soap: 'Keep the soap dry between uses\nUse a draining soap dish\nFor external use only\nStop use if irritation occurs',
  knife: 'Hand wash and dry immediately\nDo not soak or use a dishwasher\nKeep the blade dry to prevent rust\nStore in a sheath or block\nSharpen with a suitable stone',
  gloves: 'Air dry away from direct heat\nWipe clean with a damp cloth\nCondition leather occasionally\nDo not machine wash\nStore flat in a cool, dry place',
  football: 'Inflate to the pressure marked on the ball\nWipe clean with a damp cloth\nDo not leave in a hot car\nStore slightly deflated away from sunlight',
  ceramic: 'Hand washing is recommended\nAvoid sudden temperature changes\nCheck your own glaze guidance before microwave or dishwasher use',
};
const WARN = {
  candle: 'Burn within sight. Keep away from children, pets and anything flammable. Keep the wick trimmed. Do not burn the last 1/2 in of wax.',
  soap: 'For external use only. Avoid contact with eyes. Stop use if irritation occurs.',
  bath: 'For external use only. Avoid contact with eyes. May make the tub slippery. Stop use if irritation occurs.',
  balm: 'For external use only. Stop use if irritation occurs. Keep out of reach of young children.',
  blank: '',
};

export const HANDMADE = {
  hangtag: {
    group: GROUP, label: 'Hang tags', emoji: '🏷️', query: 'printable hang tags', note: '2×3.5 in tags with punch hole, 8 per page.',
    fields: [
      { id: 'shop', label: 'Shop name', def: 'Your Shop Name' }, { id: 'line', label: 'Product line', def: 'Handmade Candle Collection' },
      { id: 'tagline', label: 'Tagline', def: 'Made by hand with care' },
      { id: 'detail', label: 'Detail lines (one per line)', type: 'textarea', rows: 3, def: 'Hand-poured in small batches\nSoy wax · Cotton wick' },
      { id: 'pages', label: 'Pages (1–8)', type: 'number', def: 2 },
    ],
    presets: {
      'Sialkot leather': { line: 'Genuine Leather Goods', tagline: 'Handcrafted in Sialkot, Pakistan', detail: 'Full-grain leather\nHand-stitched' },
      'Sialkot sports': { line: 'Sports Gear', tagline: 'Made in Sialkot, Pakistan', detail: 'Hand-stitched\nQuality checked' },
      'Sialkot steel': { line: 'Stainless Steel Tools', tagline: 'Crafted in Sialkot, Pakistan', detail: 'Polished finish\nCare card included' },
    },
    build(v) {
      const tag = () => `<div class="box soft" style="width:2in;height:3.5in;border-radius:10px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:.5in .15in .2in">
        <div style="position:absolute;top:.17in;left:50%;margin-left:-.09in;width:.18in;height:.18in;border:1.5px solid currentColor;border-radius:50%;background:#fff"></div>
        <div class="h" style="font-size:17px;line-height:1.15">${esc(v.shop)}</div><div class="rule"></div><div style="font-size:12px;font-weight:600">${esc(v.line)}</div>
        <div class="small" style="margin:.1in 0">${esc(v.tagline)}</div>${L(v.detail).map((d) => `<div style="font-size:10px">${esc(d)}</div>`).join('')}</div>`;
      return Array.from({ length: num(v.pages, 2, 1, 8) }, () => `<div style="display:grid;grid-template-columns:repeat(4,2in);gap:.2in 0;justify-content:center;align-content:start">${Array.from({ length: 8 }, tag).join('')}</div>`);
    },
  },

  carecard: {
    group: GROUP, label: 'Care cards', emoji: '🧼', query: 'care instruction card printable', note: '3.5×2 in cards, 10 per page. Edit the text for your product.',
    fields: [
      { id: 'title', label: 'Title', def: 'Care Instructions' }, { id: 'prod', label: 'Product', def: 'Soy Candle' },
      { id: 'items', label: 'Care lines (one per line, up to 6)', type: 'textarea', rows: 6, def: CARE.candle }, { id: 'shop', label: 'Shop name', def: 'Your Shop Name' },
    ],
    presets: Object.fromEntries([['Candle', 'candle', 'Soy Candle'], ['Knit / crochet', 'knit', 'Knit & Crochet'], ['Jewelry', 'jewelry', 'Handmade Jewelry'], ['Leather', 'leather', 'Leather Goods'], ['Wood', 'wood', 'Wooden Goods'], ['Soap', 'soap', 'Handmade Soap'], ['Ceramic', 'ceramic', 'Ceramics'], ['Knife / steel', 'knife', 'Knives & Steel'], ['Sports gloves', 'gloves', 'Sports Gloves'], ['Football', 'football', 'Footballs']].map(([n, k, p]) => [n, { prod: p, items: CARE[k] }])),
    build(v) {
      const card = () => `<div class="box" style="width:3.5in;height:2in;padding:.12in .18in;display:flex;flex-direction:column;border-radius:6px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="h" style="font-size:15px">${esc(v.title)}</span><span class="small">${esc(v.prod)}</span></div><div class="rule" style="margin:.05in 0 .06in;width:100%"></div>
        <ul style="margin:0;padding-left:15px;font-size:9.5px;line-height:1.45;flex:1">${L(v.items).slice(0, 6).map((i) => `<li>${esc(i)}</li>`).join('')}</ul><div class="small" style="text-align:right;font-size:8.5px">${esc(v.shop)}</div></div>`;
      return [{ flush: true, html: `<div style="width:7in;margin:.5in auto 0;display:grid;grid-template-columns:3.5in 3.5in">${Array.from({ length: 10 }, card).join('')}</div>` }];
    },
  },

  earringcard: {
    group: GROUP, label: 'Earring display cards', emoji: '💎', query: 'earring card template printable', note: '3.5×2.5 in cards with hole guides, 6 per page.',
    fields: [
      { id: 'shop', label: 'Shop name', def: 'Your Shop Name' }, { id: 'line', label: 'Main line', def: 'Handmade Earrings' },
      { id: 'sub', label: 'Small line', def: 'Nickel-free hooks' }, sel('gap', 'Hole spacing', [['.5', 'Close (.5 in)'], ['.8', 'Medium (.8 in)'], ['1.1', 'Wide (1.1 in)']], '.8'),
    ],
    presets: {},
    build(v) {
      const g = Number(v.gap) || 0.8;
      const card = () => `<div class="box soft" style="width:3.5in;height:2.5in;position:relative;text-align:center;border-radius:6px;border-style:dashed">
        <div style="position:absolute;top:.28in;left:50%;margin-left:-${g / 2 + 0.06}in;width:.12in;height:.12in;border:1.3px solid currentColor;border-radius:50%;background:#fff"></div>
        <div style="position:absolute;top:.28in;left:50%;margin-left:${g / 2 - 0.06}in;width:.12in;height:.12in;border:1.3px solid currentColor;border-radius:50%;background:#fff"></div>
        <div class="small" style="position:absolute;top:.52in;left:0;right:0;font-size:8px">poke here</div>
        <div style="position:absolute;top:1.05in;left:0;right:0"><div class="h" style="font-size:19px">${esc(v.line)}</div><div class="small" style="margin-top:3px">${esc(v.sub)}</div></div>
        <div class="h" style="position:absolute;bottom:.2in;left:0;right:0;font-size:12px">${esc(v.shop)}</div></div>`;
      return [{ flush: true, html: `<div style="width:7in;margin:.5in auto 0;display:grid;grid-template-columns:3.5in 3.5in;grid-auto-rows:2.5in">${Array.from({ length: 6 }, card).join('')}</div>` }];
    },
  },

  label: {
    group: GROUP, label: 'Product / ingredient labels', emoji: '🧴', query: 'candle label template printable', note: '3.5×2.3 in labels, 8 per page. Check your country’s labeling rules.',
    fields: [
      { id: 'name', label: 'Product name', def: 'Lavender Soy Candle' }, { id: 'variant', label: 'Scent / variant', def: 'Lavender & Cedar' }, { id: 'weight', label: 'Net weight', def: '8 oz (227 g)' },
      { id: 'ingredients', label: 'Ingredients / materials', type: 'textarea', rows: 2, def: 'Soy wax, fragrance oil, cotton wick' },
      { id: 'warn', label: 'Warnings (edit to match your product and local law)', type: 'textarea', rows: 3, def: WARN.candle },
      { id: 'by', label: 'Handmade by', def: 'Your Shop Name' }, { id: 'batch', label: 'Batch / date line', def: 'Batch: ______   Date: ______' },
    ],
    presets: { Candle: { name: 'Lavender Soy Candle', ingredients: 'Soy wax, fragrance oil, cotton wick', warn: WARN.candle }, Soap: { name: 'Oatmeal Soap', variant: 'Oat & Honey', weight: '4 oz (113 g)', ingredients: 'List every ingredient in the order your local rules require', warn: WARN.soap }, 'Bath bomb': { name: 'Fizzy Bath Bomb', variant: 'Citrus', weight: '3 oz (85 g)', ingredients: 'List every ingredient in the order your local rules require', warn: WARN.bath }, 'Lip balm': { name: 'Lip Balm', variant: 'Vanilla', weight: '0.15 oz (4 g)', ingredients: 'List every ingredient in the order your local rules require', warn: WARN.balm } },
    build(v) {
      const lab = () => `<div class="box" style="width:3.5in;height:2.3in;padding:.12in .18in;display:flex;flex-direction:column;border-radius:8px;overflow:hidden">
        <div class="h" style="font-size:19px;line-height:1.1">${esc(v.name)}</div><div style="font-size:11px;margin:.02in 0 .05in">${esc(v.variant)} · <b>${esc(v.weight)}</b></div><div class="rule" style="margin:.03in 0 .06in;width:100%"></div>
        <div style="font-size:8.5px;line-height:1.35"><b>Ingredients / materials:</b> ${esc(v.ingredients)}</div>
        <div style="font-size:8px;line-height:1.3;margin-top:.05in"><b>Warning:</b> ${esc(v.warn)}</div>
        <div style="margin-top:auto;display:flex;justify-content:space-between;font-size:8.5px"><span>Handmade by <b>${esc(v.by)}</b></span><span>${esc(v.batch)}</span></div></div>`;
      return [{ flush: true, html: `<div style="width:7in;margin:.4in auto 0;display:grid;grid-template-columns:3.5in 3.5in;grid-auto-rows:2.4in">${Array.from({ length: 8 }, lab).join('')}</div>` }];
    },
  },

  bizcard: {
    group: GROUP, label: 'Business cards', emoji: '📇', query: 'business card template printable', note: '3.5×2 in, 10 per page. Keep the card about your Etsy shop.',
    fields: [{ id: 'shop', label: 'Shop name', def: 'Your Shop Name' }, { id: 'tag', label: 'Tagline', def: 'Handmade with love' }, { id: 'etsy', label: 'Etsy line', def: 'Find me on Etsy: YourShopName' }, { id: 'thanks', label: 'Small note', def: 'Thank you for supporting a small business!' }],
    presets: {},
    build(v) {
      const c = () => `<div class="box soft" style="width:3.5in;height:2in;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-radius:4px"><div class="h" style="font-size:22px">${esc(v.shop)}</div><div class="rule"></div><div style="font-size:11px">${esc(v.tag)}</div>
        <div style="font-size:10px;margin-top:.12in;font-weight:600">${esc(v.etsy)}</div><div class="small" style="margin-top:.04in;font-size:8.5px">${esc(v.thanks)}</div></div>`;
      return [{ flush: true, html: `<div style="width:7in;margin:.5in auto 0;display:grid;grid-template-columns:3.5in 3.5in">${Array.from({ length: 10 }, c).join('')}</div>` }];
    },
  },

  roundlabel: {
    group: GROUP, label: 'Round sticker labels', emoji: '⭕', query: 'round sticker labels printable', note: 'Packaging seals. 2 in (12 per page) or 1.5 in (20 per page).',
    fields: [{ id: 'l1', label: 'Line 1', def: 'Handmade' }, { id: 'l2', label: 'Line 2', def: 'with love' }, { id: 'shop', label: 'Shop name', def: 'Your Shop Name' }, sel('size', 'Size', [['2', '2 in (12 per page)'], ['1.5', '1.5 in (20 per page)']], '2')],
    presets: {},
    build(v) {
      const d = Number(v.size) || 2;
      const cols = d === 2 ? 3 : 4, rows = d === 2 ? 4 : 5;
      const one = () => `<div class="box soft" style="width:${d}in;height:${d}in;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center"><div class="h" style="font-size:${d * 10}px;line-height:1.05">${esc(v.l1)}</div><div style="font-size:${d * 5.5}px">${esc(v.l2)}</div><div class="small" style="font-size:${d * 4.5}px;margin-top:.04in">${esc(v.shop)}</div></div>`;
      return [{ flush: true, html: `<div style="width:8.5in;margin:.4in auto 0;display:grid;grid-template-columns:repeat(${cols},${d}in);gap:${d === 2 ? '.3in .6in' : '.25in .3in'};justify-content:center">${Array.from({ length: cols * rows }, one).join('')}</div>` }];
    },
  },

  orderform: {
    group: GROUP, label: 'Custom order form', emoji: '📝', query: 'custom order form template', note: 'For made-to-order and personalized items.',
    fields: [{ id: 'title', label: 'Title', def: 'Custom Order Form' }, { id: 'shop', label: 'Shop name', def: 'Your Shop Name' },
      { id: 'opts', label: 'Choices to tick (one per line)', type: 'textarea', rows: 6, def: 'Gift wrap\nRush processing\nGift message card\nExtra packaging protection' }],
    presets: {},
    build(v) {
      const row = (t) => `<div style="display:flex;gap:8px;align-items:end;font-size:13px;height:.46in"><b style="white-space:nowrap">${esc(t)}:</b><span style="flex:1;border-bottom:1.2px solid currentColor;height:.2in"></span></div>`;
      return [col(head(v.title, esc(v.shop)) + ['Name', 'Order number', 'Item', 'Size / dimensions', 'Color(s)', 'Needed by'].map(row).join('')
        + sec('Personalization (exact wording)', ruled, 1.2) + sec('Extras', L(v.opts).map((o) => `<div style="display:flex;gap:7px;align-items:center;flex:1;font-size:12px"><span class="chk"></span>${esc(o)}</div>`).join(''), 1) + sec('Notes', ruled, 0.8))];
    },
  },

  pricetag: {
    group: GROUP, label: 'Market price tags', emoji: '💲', query: 'price tags printable craft fair', note: 'Craft-fair tags, 24 per page.',
    fields: [{ id: 'shop', label: 'Shop name', def: 'Your Shop Name' }, { id: 'cur', label: 'Currency symbol', def: '$' }],
    presets: {},
    build(v) {
      const t = () => `<div class="box" style="width:2.2in;height:1.1in;padding:.05in .12in;display:flex;flex-direction:column;justify-content:space-between;border-radius:5px"><div class="small" style="font-size:8px">${esc(v.shop)}</div>
        <div style="font-size:10px;display:flex;gap:6px;align-items:end">Item: <span style="flex:1;border-bottom:1px solid currentColor;height:.16in"></span></div><div class="h" style="font-size:20px">${esc(v.cur)} ____</div></div>`;
      return [{ flush: true, html: `<div style="width:7.3in;margin:.4in auto 0;display:grid;grid-template-columns:repeat(3,2.2in);gap:.12in .35in;justify-content:center">${Array.from({ length: 24 }, t).join('')}</div>` }];
    },
  },

  inventory: {
    group: GROUP, label: 'Inventory & cost tracker', emoji: '📦', query: 'inventory tracker printable', note: 'Stock, cost and price sheet for makers.',
    fields: [{ id: 'title', label: 'Title', def: 'Inventory Tracker' }, { id: 'pages', label: 'Pages (1–4)', type: 'number', def: 2 }],
    presets: {},
    build(v) {
      return Array.from({ length: num(v.pages, 2, 1, 4) }, () => col(head(v.title, 'Month: ____________') + `<div style="flex:1">${table(['Item', 'SKU', 'In stock', 'Cost', 'Price', 'Reorder at', 'Notes'], 20, { rowH: '.4in', widths: ['24%', '11%', '10%', '10%', '10%', '12%', '23%'], fs: 10 })}</div>`));
    },
  },

  ordertracker: {
    group: GROUP, label: 'Order & production tracker', emoji: '🧾', query: 'order tracker printable small business', note: 'Track made-to-order items from order to shipment.',
    fields: [{ id: 'title', label: 'Title', def: 'Order Tracker' }, { id: 'pages', label: 'Pages (1–4)', type: 'number', def: 2 }],
    presets: {},
    build(v) {
      const c = '<div style="text-align:center"><span class="chk"></span></div>';
      return Array.from({ length: num(v.pages, 2, 1, 4) }, () => col(head(v.title) + `<div style="flex:1">${table(['Order #', 'Date', 'Customer', 'Item', 'Due', 'Made', 'Shipped', 'Tracking'], Array.from({ length: 20 }, () => ['', '', '', '', '', c, c, '']), { rowH: '.4in', widths: ['10%', '9%', '16%', '19%', '9%', '8%', '9%', '20%'], fs: 9 })}</div>`));
    },
  },

  origin: {
    group: GROUP, label: 'Made in Sialkot labels', emoji: '🇵🇰', query: 'made in pakistan label', note: 'Origin stickers for packaging. Use only if the item is really made there.',
    fields: [
      { id: 'l1', label: 'Small line above', def: 'Handcrafted in' }, { id: 'place', label: 'Place', def: 'Sialkot, Pakistan' },
      { id: 'l2', label: 'Line below', def: 'Made with pride by skilled artisans' }, { id: 'shop', label: 'Shop name', def: 'Your Shop Name' },
      sel('shape', 'Shape', [['round', 'Round 2 in (12 per page)'], ['rect', 'Rectangle 3.4×1.2 in (16 per page)']], 'round'),
    ],
    presets: {},
    build(v) {
      if (v.shape === 'rect') {
        const r = () => `<div class="box soft" style="width:3.4in;height:1.2in;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-radius:8px"><div class="small" style="letter-spacing:.2em;text-transform:uppercase;font-size:8px">${esc(v.l1)}</div><div class="h" style="font-size:21px;line-height:1.1">${esc(v.place)}</div><div style="font-size:8.5px">${esc(v.l2)}</div><div class="small" style="font-size:8px;margin-top:2px">${esc(v.shop)}</div></div>`;
        return [{ flush: true, html: `<div style="width:7.2in;margin:.5in auto 0;display:grid;grid-template-columns:3.4in 3.4in;gap:.1in .25in;justify-content:center">${Array.from({ length: 16 }, r).join('')}</div>` }];
      }
      const c = () => `<div class="box soft" style="width:2in;height:2in;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:.15in"><div class="small" style="letter-spacing:.18em;text-transform:uppercase;font-size:7px">${esc(v.l1)}</div><div class="h" style="font-size:19px;line-height:1.1;margin:2px 0">${esc(v.place)}</div><div style="font-size:7.5px;line-height:1.25">${esc(v.l2)}</div><div class="small" style="font-size:7px;margin-top:3px">${esc(v.shop)}</div></div>`;
      return [{ flush: true, html: `<div style="width:8.5in;margin:.4in auto 0;display:grid;grid-template-columns:repeat(3,2in);gap:.3in .6in;justify-content:center">${Array.from({ length: 12 }, c).join('')}</div>` }];
    },
  },

  warranty: {
    group: GROUP, label: 'Warranty & authenticity card', emoji: '🛡️', query: 'certificate of authenticity card printable', note: '3.5×2 in cards, 10 per page. Only promise what you will honor.',
    fields: [
      { id: 'title', label: 'Title', def: 'Certificate of Authenticity' }, { id: 'product', label: 'Product line', def: 'Handmade Leather Goods' },
      { id: 'made', label: 'Made in line', def: 'Handcrafted in Sialkot, Pakistan' }, { id: 'material', label: 'Material line', def: 'Genuine leather · Hand-stitched' },
      { id: 'warranty', label: 'Warranty line (edit to what you really offer)', def: '6-month workmanship guarantee' }, { id: 'shop', label: 'Shop name', def: 'Your Shop Name' },
    ],
    presets: {},
    build(v) {
      const c = () => `<div class="box" style="width:3.5in;height:2in;padding:.12in .18in;display:flex;flex-direction:column;border-radius:6px;overflow:hidden;border-style:double;border-width:4px">
        <div class="h" style="font-size:15px;text-align:center">${esc(v.title)}</div><div class="rule" style="margin:.04in auto .06in"></div>
        <div style="text-align:center;font-size:10px;line-height:1.5"><b>${esc(v.product)}</b><br>${esc(v.made)}<br>${esc(v.material)}<br>${esc(v.warranty)}</div>
        <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:end;font-size:8.5px"><span>No. ${blank('.6in')}</span><span>${esc(v.shop)}</span></div></div>`;
      return [{ flush: true, html: `<div style="width:7in;margin:.5in auto 0;display:grid;grid-template-columns:3.5in 3.5in">${Array.from({ length: 10 }, c).join('')}</div>` }];
    },
  },
};
