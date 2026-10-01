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
          <dt><code>ADMIN_USERNAME</code></dt><dd>Admin login name (default <code>admin</code>).</dd>
          <dt><code>ADMIN_PASSWORD</code></dt><dd>Starting admin password. The admin can change it under My Account; changing this variable later resets it.</dd>
          <dt><code>SESSION_SECRET</code></dt><dd>Long random text used to sign login cookies. Without it everyone is logged out on each restart.</dd>
          <dt><code>DATA_DIR</code></dt><dd>Folder where user accounts are saved (default <code>./data</code>). On Railway, attach a volume and point this at it.</dd>
          <dt><code>ETSY_QPS</code></dt><dd>Max Etsy requests per second (default 4).</dd>
          <dt><code>CACHE_TTL_MINUTES</code></dt><dd>How long Etsy results are cached (default 60, max 360 — Etsy’s API terms allow listing data up to 6 hours old). Caching saves your daily API quota.</dd>
          <dt><code>GEMINI_API_KEY</code></dt><dd><b>Free</b> AI writer for the <a href="#/builder">Listing Builder</a>: create a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> (Google account, no card). Free tier has daily limits, and Google may use free-tier prompts (your product details + aggregate Etsy stats) to improve its products. Optional <code>GEMINI_MODEL</code> (default <code>gemini-3.8-flash</code>).</dd>
          <dt><code>ANTHROPIC_API_KEY</code></dt><dd>Paid alternative (Claude, from <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>). If both keys are set, Gemini is used unless <code>AI_PROVIDER=anthropic</code>. Without any key the built-in writer is used.</dd>
          <dt><code>CLAUDE_MODEL</code></dt><dd>AI model for the Listing Builder (default <code>claude-opus-5-5</code>).</dd>
        </dl>
        <div class="divider"></div>
        <h3>Listing Builder — keeping your shop safe</h3>
        <ul class="small" style="margin:0;padding-left:18px;display:grid;gap:6px;color:var(--text-2)">
          <li>Only Etsy’s official API is used, read-only — no scraping, no shop login, nothing is posted or edited.</li>
          <li>Requests are throttled and cached (≤ 6 hours), and the app shows Etsy’s required “not endorsed or certified” notice.</li>
          <li>The AI only sees aggregate keyword statistics, never other sellers’ titles or descriptions.</li>
          <li>Every listing is checked for trademarks, medical claims, off-Etsy contact info, Etsy limits, vintage/handmade claims and AI disclosure.</li>
        </ul>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>Status</h3><button class="btn sm" id="test">Test connection</button></div>
          <div id="st"></div>
          <div id="test-out" style="margin-top:12px"></div>
        </div>
        <div class="card">
          <h3 style="margin-bottom:8px">Listing Builder</h3>
          <div id="builder-st"><p class="muted small">Checking…</p></div>
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
      ${u.lastError ? `<dt>Last error</dt><dd class="bad-text">${esc(u.lastError)}</dd>` : ''}
    </dl>`;
  }
  await drawStatus();
  try {
    const b = await api('/api/builder/status');
    if (ctx.alive()) {
      $('#builder-st', view).innerHTML = `<dl class="kv">
        <dt>Live Etsy data</dt><dd>${b.etsy ? '<span class="badge good">On</span>' : '<span class="badge bad">Needs the Etsy key</span>'}</dd>
        <dt>AI writer</dt><dd>${b.ai ? `<span class="badge good">On</span> <span class="muted">${esc(b.model)}</span>` : '<span class="badge">Off — built-in writer</span>'}</dd>
      </dl>`;
    }
  } catch {
    /* status is optional */
  }

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
