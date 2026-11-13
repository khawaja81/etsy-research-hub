import { esc, api, runPool, compact, loading } from '../ui.js';

// Digital-download ideas per event (printables, templates, planners) — scored live on demand.
const DIGITAL = {
  'New Year’s Eve': ['2027 digital planner', 'goal setting printable', 'vision board printable', 'new years eve party games printable'],
  'Lunar New Year': ['lunar new year printable', 'red envelope template printable', 'lunar new year coloring pages'],
  'Ramadan begins': ['ramadan planner printable', 'ramadan activities for kids printable', 'ramadan calendar printable'],
  'Valentine’s Day': ['valentine card printable', 'galentines party games printable', 'love coupon book printable', 'valentine classroom cards'],
  'Eid al-Fitr': ['eid card template', 'eid party printable', 'eid activities kids printable'],
  'Mothering Sunday (UK)': ['mothers day card printable', 'mothers day coupon book printable', 'mum questionnaire printable'],
  'St. Patrick’s Day': ['st patricks day printable games', 'shamrock coloring pages', 'st patricks day classroom printable'],
  Easter: ['easter egg hunt clues printable', 'easter basket tags printable', 'easter coloring pages', 'easter invitation template'],
  'Earth Day': ['earth day worksheet printable', 'earth day coloring pages', 'recycling chart printable'],
  'Teacher Appreciation Week': ['teacher appreciation card printable', 'teacher gift tag printable', 'teacher appreciation coupon'],
  'Mother’s Day (US)': ['mothers day card printable', 'mothers day coupon book printable', 'mom questionnaire printable', 'gift certificate template'],
  'Graduation season': ['graduation party invitation template', 'graduation sign printable', 'graduation announcement template', 'graduation photo banner printable'],
  'Pride Month': ['pride month printable poster', 'pride coloring pages', 'rainbow wall art printable'],
  'Wedding season': ['wedding seating chart template', 'wedding timeline template', 'wedding welcome sign template', 'wedding program template'],
  'Father’s Day': ['fathers day card printable', 'fathers day coupon book printable', 'dad questionnaire printable'],
  '4th of July': ['4th of july printable games', '4th of july party printables', 'patriotic coloring pages'],
  'Back to School': ['teacher planner printable', 'classroom labels editable', 'student planner printable', 'back to school sign printable'],
  Halloween: ['halloween party games printable', 'halloween invitation template', 'halloween bingo printable', 'halloween printable decor'],
  Diwali: ['diwali invitation template', 'diwali greeting card printable', 'rangoli coloring page'],
  'Thanksgiving (US)': ['thanksgiving menu template', 'thanksgiving printable games', 'thankful tree printable', 'friendsgiving invitation template'],
  'Black Friday & Cyber Monday': ['christmas budget planner', 'gift list tracker printable', 'small business planner', 'gift tag printable'],
  Hanukkah: ['hanukkah printable activities', 'hanukkah card printable', 'hanukkah party games printable'],
  Christmas: ['christmas gift tags printable', 'advent calendar printable', 'christmas bingo printable', 'christmas party invitation template', 'santa letter printable'],
};

// Handmade (physical) product ideas per event — scored live on demand, same as digital ideas.
const HANDMADE = {
  'New Year’s Eve': ['personalized 2027 notebook', 'handmade sparkler holder', 'custom new year ornament'],
  'Lunar New Year': ['handmade red envelope pouch', 'zodiac embroidered keychain', 'lunar new year crochet charm'],
  'Ramadan begins': ['handmade ramadan lantern', 'ramadan advent calendar wooden', 'handmade prayer beads tasbih'],
  'Valentine’s Day': ['handmade soap valentine', 'personalized couple keychain', 'crochet heart plush', 'soy candle valentine gift', 'birth flower necklace'],
  'Eid al-Fitr': ['handmade eid gift box', 'embroidered eid cushion cover', 'custom name bracelet gold'],
  'Mothering Sunday (UK)': ['personalised mum necklace', 'handmade bath bomb gift set', 'embroidered flower hoop'],
  'St. Patrick’s Day': ['crochet shamrock', 'handmade clover earrings', 'st patricks day wooden sign'],
  Easter: ['crochet easter bunny', 'personalized easter basket tag wooden', 'handmade easter egg decor', 'easter bunny amigurumi'],
  'Earth Day': ['beeswax food wraps', 'handmade plantable seed paper', 'reusable produce bags'],
  'Teacher Appreciation Week': ['personalized teacher keychain', 'teacher candle gift', 'embroidered teacher tote'],
  'Mother’s Day (US)': ['personalized mom necklace', 'birth flower necklace', 'handmade bath bomb set', 'custom candle for mom', 'embroidered flower hoop'],
  'Graduation season': ['personalized graduation keychain', 'graduation cap ornament handmade', 'custom class of 2027 gift'],
  'Pride Month': ['crochet rainbow heart', 'handmade pride earrings', 'pride flag keychain handmade'],
  'Wedding season': ['personalized bridesmaid gift', 'handmade wedding candle favors', 'custom wedding ring dish', 'embroidered wedding handkerchief'],
  'Father’s Day': ['leather keychain personalized dad', 'engraved wooden gift dad', 'handmade beard oil', 'leather wallet handmade'],
  '4th of July': ['crochet flag decor', 'handmade patriotic earrings', 'wooden stars decor'],
  'Back to School': ['personalized pencil case', 'handmade teacher gift', 'embroidered backpack tag'],
  Halloween: ['handmade halloween earrings', 'crochet pumpkin', 'spooky soy candle', 'polymer clay ghost charms'],
  Diwali: ['handmade diya set', 'handmade diwali candle', 'rangoli wooden stencil'],
  'Thanksgiving (US)': ['handmade fall candle', 'crochet pumpkin decor', 'wooden thankful sign'],
  'Black Friday & Cyber Monday': ['soy candle gift set', 'handmade stocking stuffers', 'personalized ornament'],
  Hanukkah: ['handmade menorah', 'hanukkah ornament handmade', 'dreidel wooden handmade'],
  Christmas: ['personalized christmas ornament', 'crochet christmas stocking', 'handmade christmas candle', 'wooden advent calendar', 'embroidered christmas ornament'],
};

// Sale potential 0–100: buyer engagement with top listings (favorites) vs how crowded the search is.
function potential(r) {
  const comp = Math.max(0, Math.min(100, (Math.log10(Math.max(r.count || 1, 1)) - 2) * 25));
  const eng = Math.max(0, Math.min(100, 33 * Math.log10(1 + (r.median_favorites ?? 0))));
  return Math.round(0.55 * eng + 0.45 * (100 - comp));
}
const potentialBadge = (p) =>
  `<span class="badge ${p >= 60 ? 'good' : p >= 40 ? 'warn' : 'bad'}">${p >= 60 ? 'High' : p >= 40 ? 'Medium' : 'Low'} · ${p}</span>`;

const DAY = 86400000;
const d = (y, m, day) => new Date(y, m, day);
const nthWeekday = (y, m, wd, n) => {
  const first = d(y, m, 1);
  return d(y, m, 1 + ((wd - first.getDay() + 7) % 7) + (n - 1) * 7);
};
const lastWeekday = (y, m, wd) => {
  const last = d(y, m + 1, 0);
  return d(y, m, last.getDate() - ((last.getDay() - wd + 7) % 7));
};
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return d(y, month, day);
}
const addDays = (dt, n) => new Date(dt.getTime() + n * DAY);
const table = (map) => (y) => (map[y] ? new Date(map[y] + 'T00:00:00') : null);

// [name, date(year), lead days, region, keyword ideas, approx?]
const EVENTS = [
  ['New Year’s Eve', (y) => d(y, 11, 31), 45, 'Global', ['new years eve outfit', 'new year party decorations', '2027 planner', 'new year card']],
  ['Lunar New Year', table({ 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26' }), 45, 'Global', ['lunar new year decor', 'year of the horse', 'red envelope', 'chinese new year gift']],
  ['Ramadan begins', table({ 2027: '2027-02-08', 2028: '2028-01-28' }), 45, 'Global', ['ramadan decorations', 'ramadan calendar kids', 'ramadan gift', 'islamic wall art'], true],
  ['Valentine’s Day', (y) => d(y, 1, 14), 60, 'Global', ['valentines gift for him', 'galentines gift', 'personalized valentine', 'couples gift']],
  ['Eid al-Fitr', table({ 2026: '2026-03-20', 2027: '2027-03-10', 2028: '2028-02-27' }), 45, 'Global', ['eid gifts', 'eid mubarak decorations', 'eid card', 'eid outfit kids'], true],
  ['Mothering Sunday (UK)', (y) => addDays(easter(y), -21), 45, 'UK', ['mothering sunday gift', 'gift for mum', 'personalised mum gift']],
  ['St. Patrick’s Day', (y) => d(y, 2, 17), 45, 'US / IE', ['st patricks day shirt', 'shamrock earrings', 'lucky charm']],
  ['Easter', easter, 50, 'Global', ['easter basket personalized', 'easter decor', 'easter egg hunt', 'bunny gift']],
  ['Earth Day', (y) => d(y, 3, 22), 30, 'Global', ['eco friendly gift', 'reusable', 'zero waste']],
  ['Teacher Appreciation Week', (y) => nthWeekday(y, 4, 1, 1), 40, 'US', ['teacher appreciation gift', 'personalized teacher gift', 'teacher tote bag']],
  ['Mother’s Day (US)', (y) => nthWeekday(y, 4, 0, 2), 60, 'US / CA / AU', ['mothers day gift', 'gift for mom', 'personalized mom necklace', 'grandma gift']],
  ['Graduation season', (y) => d(y, 4, 15), 60, 'US', ['graduation gift', 'class of 2027', 'graduation party decor']],
  ['Pride Month', (y) => d(y, 5, 1), 45, 'Global', ['pride shirt', 'pride earrings', 'lgbtq gift']],
  ['Wedding season', (y) => d(y, 5, 1), 90, 'Global', ['bridesmaid proposal', 'wedding guest book', 'bridal shower gift', 'wedding sign']],
  ['Father’s Day', (y) => nthWeekday(y, 5, 0, 3), 50, 'US / UK / CA', ['fathers day gift', 'gift for dad', 'personalized dad gift', 'new dad gift']],
  ['4th of July', (y) => d(y, 6, 4), 45, 'US', ['4th of july shirt', 'patriotic decor', 'usa earrings']],
  ['Back to School', (y) => d(y, 7, 10), 45, 'US / UK', ['back to school shirt', 'teacher gift', 'kids backpack name tag', 'first day of school sign']],
  ['Halloween', (y) => d(y, 9, 31), 75, 'Global', ['halloween costume', 'halloween decor', 'spooky season', 'halloween shirt']],
  ['Diwali', table({ 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17' }), 45, 'Global', ['diwali decorations', 'diwali gift', 'rangoli', 'diya']],
  ['Thanksgiving (US)', (y) => nthWeekday(y, 10, 4, 4), 50, 'US', ['thanksgiving decor', 'fall table runner', 'thankful sign']],
  ['Black Friday & Cyber Monday', (y) => addDays(nthWeekday(y, 10, 4, 4), 1), 30, 'Global', ['gift for her', 'gift for him', 'stocking stuffers', 'christmas gift ideas']],
  ['Hanukkah', table({ 2026: '2026-12-04', 2027: '2027-12-24', 2028: '2028-12-12' }), 60, 'Global', ['hanukkah gift', 'menorah', 'hanukkah decorations']],
  ['Christmas', (y) => d(y, 11, 25), 90, 'Global', ['personalized christmas ornament', 'christmas gift for her', 'christmas stocking', 'family christmas pajamas']],
];

export async function render(view, ctx) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = addDays(today, 400);
  const list = [];
  for (const [name, fn, lead, region, keywords, approx] of EVENTS) {
    for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
      const date = fn(y);
      if (!date || date < today || date > horizon) continue;
      list.push({
        name, date, lead, region, keywords, approx,
        handmade: HANDMADE[name] || [],
        digital: DIGITAL[name] || keywords.slice(0, 2).map((k) => `${k} printable`),
        listBy: addDays(date, -lead),
      });
      break;
    }
  }
  list.sort((a, b) => a.date - b.date);
  const daysUntil = (dt) => Math.round((dt - today) / DAY);
  const fmtD = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Seasonal Calendar</h1>
      <p>Etsy buyers start searching for seasonal gifts weeks in advance, and new listings need time to be indexed and collect favorites. List (or refresh) seasonal items by the “list by” date.</p>
    </div></div>
    <div class="card" style="margin-bottom:14px">
      <div class="row"><div style="min-width:0"><h3>Best bets to list right now</h3>
        <p class="muted small">Scores digital product ideas for events you should be listing for in the next ~60 days, using live Etsy data (about 1 API call per idea).</p></div>
        <span class="spacer"></span><button class="btn" id="bb-run">Find best bets</button></div>
      <div id="bb-out" style="margin-top:12px"></div>
    </div>
    <div class="card">
      ${list
        .map((e) => {
          const until = daysUntil(e.date);
          const toList = daysUntil(e.listBy);
          const status =
            toList < 0
              ? `<span class="badge bad">List now — ${-toList}d late</span>`
              : toList <= 30
              ? `<span class="badge warn">Start now — ${toList}d to list</span>`
              : `<span class="badge">List by ${fmtD(e.listBy)}</span>`;
          return `<div class="event">
            <div class="date"><span>${e.date.toLocaleDateString('en-US', { month: 'short' })}</span><b>${e.date.getDate()}</b></div>
            <div style="min-width:0">
              <h3>${esc(e.name)} ${e.approx ? '<span class="muted small">(approx.)</span>' : ''}</h3>
              <div class="muted small">${fmtD(e.date)} · in ${until} days · ${esc(e.region)} · list ~${e.lead} days ahead</div>
              <div class="chips" style="margin-top:8px">${e.keywords.map((k) => `<a class="chip" href="#/keyword?q=${encodeURIComponent(k)}">${esc(k)}</a>`).join('')}
                <a class="chip accent" href="#/ideas?q=${encodeURIComponent(e.keywords[0])}&expand=modifiers">More ideas →</a></div>
              <div class="muted small" style="margin-top:10px"><b>Digital product ideas</b> (instant delivery, no shipping)</div>
              <div class="chips" style="margin-top:6px">${e.digital.map((k) => `<a class="chip accent" href="#/digital?q=${encodeURIComponent(k)}">${esc(k)}</a>`).join('')}</div>
              ${e.handmade.length ? `<div class="muted small" style="margin-top:10px"><b>Handmade product ideas</b> (physical, made by you)</div>
              <div class="chips" style="margin-top:6px">${e.handmade.map((k) => `<a class="chip" href="#/handmade?q=${encodeURIComponent(k)}">${esc(k)}</a>`).join('')}</div>` : ''}
              <div style="margin-top:8px"><button class="link-btn small" data-score="${esc(e.name)}">Score these ideas →</button><div class="ev-score"></div></div>
            </div>
            <div>${status}</div>
          </div>`;
        })
        .join('')}
    </div>
    <p class="muted small" style="margin-top:10px">Dates for lunar/Islamic holidays are approximate. Sale potential is an estimate from public Etsy data (buyer engagement vs. competition), not a sales forecast.</p>`;

  const byName = new Map(list.map((e) => [e.name, e]));
  async function score(ideas) {
    const rows = [];
    await runPool(ideas, 3, async (idea) => {
      const r = await api('/api/count', { q: idea.q });
      rows.push({ ...idea, ...r, potential: potential(r) });
    });
    return rows.sort((a, b) => b.potential - a.potential);
  }
  const table = (rows, showEvent) => `<div class="table-wrap"><table class="data"><thead><tr><th>Idea</th><th>Type</th>${showEvent ? '<th>Event</th>' : ''}<th class="num">Listings</th><th>Competition</th><th class="num">Median favs</th><th>Sale potential</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr><td><a href="#/${r.type === 'Handmade' ? 'handmade' : 'digital'}?q=${encodeURIComponent(r.q)}">${esc(r.q)}</a></td><td class="muted small">${esc(r.type)}</td>${showEvent ? `<td class="muted small">${esc(r.event)}</td>` : ''}<td class="num">${compact(r.count)}</td><td>${esc(r.competition)}</td><td class="num">${r.median_favorites ?? '—'}</td><td>${potentialBadge(r.potential)}</td></tr>`
      )
      .join('')}</tbody></table></div>`;

  view.onclick = async (ev) => {
    const btn = ev.target.closest('[data-score]');
    if (btn) {
      const e = byName.get(btn.dataset.score);
      const box = btn.parentElement.querySelector('.ev-score');
      box.innerHTML = loading('Scoring…');
      try {
        const rows = await score([...e.digital.map((q) => ({ q, event: e.name, type: 'Digital' })), ...e.handmade.map((q) => ({ q, event: e.name, type: 'Handmade' }))]);
        if (ctx.alive()) box.innerHTML = table(rows, false);
      } catch (err) {
        box.innerHTML = `<p class="muted small">${esc(err.message)}</p>`;
      }
      return;
    }
    if (ev.target.closest('#bb-run')) {
      const out = view.querySelector('#bb-out');
      const soon = list.filter((e) => daysUntil(e.date) > 0 && daysUntil(e.listBy) <= 60).slice(0, 4);
      if (!soon.length) {
        out.innerHTML = '<p class="muted small">No events need listing in the next 60 days.</p>';
        return;
      }
      out.innerHTML = loading(`Scoring ideas for ${soon.map((e) => e.name).join(', ')}…`);
      try {
        const rows = await score(soon.flatMap((e) => [...e.digital.map((q) => ({ q, event: e.name, type: 'Digital' })), ...e.handmade.map((q) => ({ q, event: e.name, type: 'Handmade' }))]));
        if (ctx.alive()) out.innerHTML = table(rows.slice(0, 12), true);
      } catch (err) {
        out.innerHTML = `<p class="muted small">${esc(err.message)}</p>`;
      }
    }
  };
}
