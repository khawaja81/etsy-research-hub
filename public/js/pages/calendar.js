import { esc } from '../ui.js';

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

export async function render(view) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = addDays(today, 400);
  const list = [];
  for (const [name, fn, lead, region, keywords, approx] of EVENTS) {
    for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
      const date = fn(y);
      if (!date || date < today || date > horizon) continue;
      list.push({ name, date, lead, region, keywords, approx, listBy: addDays(date, -lead) });
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
            </div>
            <div>${status}</div>
          </div>`;
        })
        .join('')}
    </div>
    <p class="muted small" style="margin-top:10px">Dates for lunar/Islamic holidays are approximate. Keyword chips open Keyword Research.</p>`;
}
