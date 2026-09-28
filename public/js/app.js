import { $, $$, api, esc, initTooltip, copyText, fmtInt } from './ui.js';
import { icons } from './icons.js';
import * as home from './pages/home.js';
import * as keyword from './pages/keyword.js';
import * as ideas from './pages/ideas.js';
import * as compare from './pages/compare.js';
import * as listing from './pages/listing.js';
import * as shop from './pages/shop.js';
import * as seo from './pages/seo.js';
import * as fees from './pages/fees.js';
import * as calendar from './pages/calendar.js';
import * as saved from './pages/saved.js';
import * as setup from './pages/setup.js';

const NAV = [
  { group: null, items: [{ path: '/', label: 'Dashboard', icon: 'home', page: home }] },
  {
    group: 'Research',
    items: [
      { path: '/keyword', label: 'Keyword Research', icon: 'search', page: keyword },
      { path: '/ideas', label: 'Keyword Ideas', icon: 'bulb', page: ideas },
      { path: '/compare', label: 'Compare Keywords', icon: 'compare', page: compare },
    ],
  },
  {
    group: 'Analyze',
    items: [
      { path: '/listing', label: 'Listing Analyzer', icon: 'listing', page: listing },
      { path: '/shop', label: 'Shop Analyzer', icon: 'shop', page: shop },
    ],
  },
  {
    group: 'Optimize',
    items: [
      { path: '/seo', label: 'Title & Tag Grader', icon: 'tag', page: seo },
      { path: '/fees', label: 'Profit Calculator', icon: 'calc', page: fees },
    ],
  },
  {
    group: 'Plan',
    items: [
      { path: '/calendar', label: 'Seasonal Calendar', icon: 'calendar', page: calendar },
      { path: '/saved', label: 'Saved Keywords', icon: 'star', page: saved },
      { path: '/setup', label: 'API Setup', icon: 'settings', page: setup },
    ],
  },
];
const ROUTES = new Map(NAV.flatMap((g) => g.items).map((i) => [i.path, i]));

$('#nav').innerHTML = NAV.map(
  (g) =>
    (g.group ? `<div class="nav-group">${esc(g.group)}</div>` : '') +
    g.items.map((i) => `<a href="#${i.path}" data-path="${i.path}">${icons[i.icon]}<span>${esc(i.label)}</span></a>`).join('')
).join('');

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', params: Object.fromEntries(new URLSearchParams(qs)) };
}

export function go(path, params = {}, { replace = false } = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  const hash = `#${path}${qs ? '?' + qs : ''}`;
  if (replace) history.replaceState(null, '', hash);
  else if (location.hash !== hash) location.hash = hash;
  else render();
  if (replace) render();
}

let renderId = 0;
async function render() {
  const { path, params } = parseHash();
  const route = ROUTES.get(path) || ROUTES.get('/');
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.path === route.path));
  document.title = route.path === '/' ? 'Etsy Research Hub' : `${route.label} · Etsy Research Hub`;
  closeMenu();
  const id = ++renderId;
  const view = $('#view');
  const ctx = { alive: () => id === renderId, go, params, path: route.path, refreshStatus };
  view.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    await route.page.render(view, ctx);
  } catch (err) {
    console.error(err);
    if (ctx.alive()) view.innerHTML = `<div class="notice bad"><div>⚠️</div><div>${esc(err.message)}</div></div>`;
  }
}

// ---------- chrome ----------
function closeMenu() {
  $('#sidebar').classList.remove('open');
  $('#scrim').classList.remove('open');
}
$('#menu-btn').addEventListener('click', () => {
  $('#sidebar').classList.add('open');
  $('#scrim').classList.add('open');
});
$('#scrim').addEventListener('click', closeMenu);

function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function paintThemeBtn() {
  $('#theme-toggle').textContent = currentTheme() === 'dark' ? '☀️  Light mode' : '🌙  Dark mode';
}
$('#theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* ignore */
  }
  paintThemeBtn();
});
paintThemeBtn();

export async function refreshStatus() {
  const el = $('#api-status');
  try {
    const s = await api('/api/status');
    const u = s.usage || {};
    if (s.configured) {
      const ok = !u.lastError || !/^(401|403)/.test(u.lastError);
      el.innerHTML = `<span class="dot ${ok ? 'ok' : 'bad'}"></span><span>${ok ? 'Etsy API connected' : 'API key problem'}<br><span class="muted small">${fmtInt(u.calls)} calls today${u.remainingToday != null ? ` · ${fmtInt(u.remainingToday)} left` : ''}</span></span>`;
    } else {
      el.innerHTML = `<span class="dot bad"></span><span>API key not set<br><span class="muted small">Click to set up</span></span>`;
    }
    return s;
  } catch {
    el.innerHTML = `<span class="dot bad"></span><span>Server offline</span>`;
    return null;
  }
}

// Global delegated actions
document.addEventListener('click', (e) => {
  const copy = e.target.closest('[data-copy-tags]');
  if (copy) {
    copyText(copy.dataset.copyTags);
    return;
  }
  const copyAny = e.target.closest('[data-copy]');
  if (copyAny) copyText(copyAny.dataset.copy);
});

initTooltip();
window.addEventListener('hashchange', render);
render();
refreshStatus();
setInterval(refreshStatus, 60000);
