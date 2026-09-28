import { $, esc, api, store } from '../ui.js';
import { icons } from '../icons.js';

const FEATURES = [
  ['/keyword', 'search', 'Keyword Research', 'Competition, demand & opportunity scores, price ranges, top tags, title words and top shops for any search.'],
  ['/ideas', 'bulb', 'Keyword Ideas', 'Long-tail keyword ideas from buyer autocomplete (Google, “etsy …” searches, Amazon) with competition checks.'],
  ['/compare', 'compare', 'Compare Keywords', 'Put up to 5 keywords side by side and pick the one with the best opportunity.'],
  ['/listing', 'listing', 'Listing Analyzer', 'Any listing’s tags, views, favorites, reviews, SEO audit — and where it ranks for each of its tags.'],
  ['/shop', 'shop', 'Shop Analyzer', 'Competitor shop sales, revenue estimate, best sellers from recent reviews, tags and pricing.'],
  ['/seo', 'tag', 'Title & Tag Grader', 'Score your title, 13 tags and description against Etsy SEO best practices, with tag ideas.'],
  ['/fees', 'calc', 'Profit Calculator', 'Etsy fees (listing, transaction, processing, offsite ads) and your real profit per sale.'],
  ['/calendar', 'calendar', 'Seasonal Calendar', 'Upcoming shopping events and when to list for them, with keyword ideas.'],
];

export async function render(view, ctx) {
  const history = store.get('history', []);
  const saved = store.get('saved', []);
  view.innerHTML = `
    <div id="setup-note"></div>
    <div class="card hero">
      <h1 style="font-size:28px">Find what sells on Etsy</h1>
      <p class="muted" style="margin:6px 0 18px;max-width:640px">Research keywords, spy on competitor listings and shops, and optimize your own listings — using live data from the official Etsy API.</p>
      <form class="search-bar search-hero" id="home-form">
        <input class="input" name="q" placeholder="Search a keyword, e.g. “custom pet portrait”" required>
        <button class="btn" type="submit">${icons.search} Research</button>
      </form>
      <div class="row small" style="margin-top:12px">
        <span class="muted">Or paste:</span>
        <a href="#/listing">a listing URL →</a>
        <a href="#/shop">a shop name →</a>
      </div>
    </div>

    <div class="section-title"><h2>Tools</h2></div>
    <div class="feature-grid">
      ${FEATURES.map(([path, icon, title, text]) => `<a class="card feature" href="#${path}"><div class="ico">${icons[icon]}</div><h3>${title}</h3><p>${text}</p></a>`).join('')}
    </div>

    <div class="grid grid-2" style="margin-top:26px">
      <div class="card">
        <div class="card-head"><h3>Recent searches</h3></div>
        ${history.length ? `<div class="chips">${history.map((h) => `<a class="chip" href="#/keyword?q=${encodeURIComponent(h)}">${esc(h)}</a>`).join('')}</div>` : '<p class="muted small">Your searches will show up here.</p>'}
      </div>
      <div class="card">
        <div class="card-head"><h3>Saved keywords</h3><a class="small" href="#/saved">View all →</a></div>
        ${saved.length ? `<div class="chips">${saved.slice(0, 15).map((s) => `<a class="chip accent" href="#/keyword?q=${encodeURIComponent(s.keyword)}">★ ${esc(s.keyword)}</a>`).join('')}</div>` : '<p class="muted small">Press “Save keyword” on any result to build your list.</p>'}
      </div>
    </div>`;

  $('#home-form', view).addEventListener('submit', (e) => {
    e.preventDefault();
    ctx.go('/keyword', { q: e.target.q.value.trim() });
  });

  try {
    const s = await api('/api/status');
    if (!ctx.alive()) return;
    if (!s.configured) {
      $('#setup-note', view).innerHTML = `<div class="notice warn" style="margin-bottom:16px"><div class="icon">🔑</div><div>
        <h3>One step left: connect your Etsy API key</h3>
        <p>Keyword ideas, the SEO grader, profit calculator and calendar work now. Live Etsy data needs a free Etsy developer key. <a href="#/setup">Set it up in 5 minutes →</a></p></div></div>`;
    }
  } catch {
    /* ignore */
  }
}
