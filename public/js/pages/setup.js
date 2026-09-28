import { $, esc, api, fmtInt, errorBox } from '../ui.js';

export async function render(view, ctx) {
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>API Setup</h1>
      <p>This app reads live Etsy data through the official Etsy Open API v3. You need a free API key (keystring + shared secret) from Etsy’s developer portal.</p>
    </div></div>
    <div class="grid split-wide">
      <div class="card stack">
        <h2>Get your Etsy API key</h2>
        <ol style="margin:0;padding-left:20px;display:grid;gap:10px">
          <li>Log in to Etsy, then open <a href="https://www.etsy.com/developers/register" target="_blank" rel="noopener">etsy.com/developers/register</a> and create an app (any name, e.g. “My Research Tool”).</li>
          <li>Open <a href="https://www.etsy.com/developers/your-apps" target="_blank" rel="noopener">Your Apps</a> and copy the <b>Keystring</b> and the <b>Shared secret</b>. New apps can take a little while for Etsy to activate.</li>
          <li><b>On Railway:</b> open your service → <b>Variables</b> → add:
            <div class="desc" style="margin-top:8px">ETSY_API_KEY=your_keystring
ETSY_SHARED_SECRET=your_shared_secret</div>
            Railway redeploys automatically.</li>
          <li><b>On your computer:</b> copy <code>.env.example</code> to <code>.env</code>, paste the same two values, and run <code>npm start</code>.</li>
          <li>Come back here and press <b>Test connection</b>.</li>
        </ol>
        <div class="divider"></div>
        <h3>Optional settings</h3>
        <dl class="kv">
          <dt><code>APP_PASSWORD</code></dt><dd>Protects the whole site with a password (browser login prompt, any username).</dd>
          <dt><code>ETSY_QPS</code></dt><dd>Max Etsy requests per second (default 4).</dd>
          <dt><code>CACHE_TTL_MINUTES</code></dt><dd>How long Etsy results are cached (default 60). Caching saves your daily API quota.</dd>
        </dl>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>Status</h3><button class="btn sm" id="test">Test connection</button></div>
          <div id="st"></div>
          <div id="test-out" style="margin-top:12px"></div>
        </div>
        <div class="card">
          <h3 style="margin-bottom:8px">What works without a key</h3>
          <p class="small muted">Keyword Ideas (autocomplete), Title & Tag Grader, Profit Calculator and Seasonal Calendar. Keyword Research, Compare, Listing and Shop analysis need the key.</p>
        </div>
      </div>
    </div>`;

  async function drawStatus() {
    const s = await ctx.refreshStatus();
    if (!ctx.alive()) return;
    if (!s) {
      $('#st', view).innerHTML = '<p class="bad-text">Server not reachable.</p>';
      return;
    }
    const u = s.usage || {};
    $('#st', view).innerHTML = `<dl class="kv">
      <dt>API key</dt><dd>${s.configured ? '<span class="badge good">Configured</span>' : '<span class="badge bad">Not set</span>'}</dd>
      <dt>Calls today</dt><dd>${fmtInt(u.calls)} <span class="muted">(+${fmtInt(u.cacheHits)} served from cache)</span></dd>
      <dt>Daily limit</dt><dd>${u.limitPerDay != null ? `${fmtInt(u.remainingToday)} left of ${fmtInt(u.limitPerDay)}` : '<span class="muted">shown after first call</span>'}</dd>
      <dt>Request speed</dt><dd>${u.qps} per second</dd>
      <dt>Cached results</dt><dd>${fmtInt(u.cacheEntries)}</dd>
      <dt>Password</dt><dd>${s.password ? 'On' : 'Off'}</dd>
      ${u.lastError ? `<dt>Last error</dt><dd class="bad-text">${esc(u.lastError)}</dd>` : ''}
    </dl>`;
  }
  await drawStatus();

  $('#test', view).addEventListener('click', async (e) => {
    e.target.disabled = true;
    const box = $('#test-out', view);
    box.innerHTML = '<div class="spinner"></div>';
    try {
      await api('/api/test-connection');
      box.innerHTML = `<div class="notice accent"><div class="icon">✅</div><div><h3>Connected to Etsy</h3><p>Your key works. Try <a href="#/keyword">Keyword Research</a>.</p></div></div>`;
    } catch (err) {
      box.innerHTML = errorBox(err);
    }
    e.target.disabled = false;
    drawStatus();
  });
}
