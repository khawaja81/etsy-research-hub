import { $, esc, api, errorBox, copyText, store } from '../ui.js';
import { auditListing, renderChecks, scoreRing } from '../seo-rules.js';

export async function render(view, ctx) {
  let draft = store.get('seo-draft', { title: '', tags: [], description: '', keyword: '' });
  try {
    const fromListing = sessionStorage.getItem('seo-draft');
    if (fromListing) {
      draft = { keyword: '', ...JSON.parse(fromListing) };
      sessionStorage.removeItem('seo-draft');
    }
  } catch {
    /* ignore */
  }
  let tags = [...(draft.tags || [])];

  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Title & Tag Grader</h1>
      <p>Write or paste your listing title, 13 tags and description. The score updates live against Etsy SEO best practices. Nothing here uses API calls except “Get tag ideas”.</p>
    </div></div>
    <div class="grid split-wide">
      <div class="card stack">
        <label class="field">Main keyword (what buyers search)
          <input class="input" id="f-kw" placeholder="e.g. personalized dog bandana" value="${esc(draft.keyword || '')}">
        </label>
        <label class="field"><span class="row">Title <span class="spacer"></span><span class="counter" id="c-title"></span></span>
          <textarea class="input" id="f-title" rows="3" maxlength="200" placeholder="Personalized Dog Bandana, Custom Name Pet Scarf, Dog Birthday Gift">${esc(draft.title || '')}</textarea>
        </label>
        <div class="field"><span class="row">Tags <span class="spacer"></span><span class="counter" id="c-tags"></span></span>
          <div class="tag-input" id="tag-box"><input id="f-tag" placeholder="Type a tag and press Enter or comma"></div>
          <span class="muted small">Max 13 tags, 20 characters each. Paste a comma-separated list to add many at once.</span>
        </div>
        <label class="field"><span class="row">Description (first part is enough) <span class="spacer"></span><span class="counter" id="c-desc"></span></span>
          <textarea class="input" id="f-desc" rows="6" placeholder="Start with a clear sentence describing the item using your main keywords…">${esc(draft.description || '')}</textarea>
        </label>
        <div class="row">
          <button class="btn secondary sm" id="copy-title">Copy title</button>
          <button class="btn secondary sm" id="copy-tags">Copy tags</button>
          <button class="btn ghost sm" id="clear">Clear all</button>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head" style="align-items:center"><div><h3>SEO score</h3><p>Pass = full points, warning = half</p></div><div id="ring"></div></div>
          <div id="checks"></div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Tag ideas from top competitors</h3><p>Most-used tags among the top 100 listings for your main keyword</p></div></div>
          <button class="btn sm" id="ideas-btn">Get tag ideas</button>
          <div id="ideas" style="margin-top:12px"></div>
        </div>
      </div>
    </div>`;

  const f = { kw: $('#f-kw', view), title: $('#f-title', view), tag: $('#f-tag', view), desc: $('#f-desc', view) };
  const box = $('#tag-box', view);

  function drawTags() {
    box.querySelectorAll('.chip').forEach((c) => c.remove());
    tags.forEach((t, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip' + (t.length > 20 ? ' bad' : '');
      chip.innerHTML = `${esc(t)} <span class="muted small">${t.length}</span> <button type="button" class="x" data-i="${i}" aria-label="Remove">×</button>`;
      box.insertBefore(chip, f.tag);
    });
  }

  function update() {
    const title = f.title.value;
    const desc = f.desc.value;
    const ct = $('#c-title', view);
    ct.textContent = `${title.length}/140`;
    ct.classList.toggle('over', title.length > 140);
    const cg = $('#c-tags', view);
    cg.textContent = `${tags.length}/13`;
    cg.classList.toggle('over', tags.length > 13);
    $('#c-desc', view).textContent = `${desc.length} chars`;
    const res = auditListing({ title, tags, description: desc, keyword: f.kw.value });
    $('#ring', view).innerHTML = scoreRing(res.score);
    $('#checks', view).innerHTML = renderChecks(res.checks);
    store.set('seo-draft', { title, tags, description: desc, keyword: f.kw.value });
  }

  function addTags(text) {
    for (const raw of text.split(/[,\n]/)) {
      const t = raw.trim().toLowerCase();
      if (t && !tags.includes(t) && tags.length < 13) tags.push(t);
    }
    drawTags();
    update();
  }

  f.tag.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTags(f.tag.value);
      f.tag.value = '';
    } else if (e.key === 'Backspace' && !f.tag.value && tags.length) {
      tags.pop();
      drawTags();
      update();
    }
  });
  f.tag.addEventListener('paste', (e) => {
    const text = e.clipboardData.getData('text');
    if (/[,\n]/.test(text)) {
      e.preventDefault();
      addTags(text);
    }
  });
  f.tag.addEventListener('blur', () => {
    if (f.tag.value.trim()) {
      addTags(f.tag.value);
      f.tag.value = '';
    }
  });
  box.addEventListener('click', (e) => {
    const x = e.target.closest('.x');
    if (x) {
      tags.splice(Number(x.dataset.i), 1);
      drawTags();
      update();
    } else f.tag.focus();
  });
  [f.kw, f.title, f.desc].forEach((el) => el.addEventListener('input', update));
  $('#copy-title', view).addEventListener('click', () => copyText(f.title.value));
  $('#copy-tags', view).addEventListener('click', () => copyText(tags.join(', ')));
  $('#clear', view).addEventListener('click', () => {
    f.kw.value = f.title.value = f.desc.value = '';
    tags = [];
    drawTags();
    update();
  });

  $('#ideas-btn', view).addEventListener('click', async (e) => {
    const kw = f.kw.value.trim() || tags[0] || '';
    const box2 = $('#ideas', view);
    if (!kw) {
      box2.innerHTML = '<p class="muted small">Enter a main keyword first.</p>';
      return;
    }
    e.target.disabled = true;
    box2.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await api('/api/keyword', { q: kw, depth: 100 });
      if (!ctx.alive()) return;
      const n = data.summary.sample_size;
      const ideas = data.summary.tags.filter((t) => !tags.includes(t.term) && t.term.length <= 20).slice(0, 30);
      box2.innerHTML = ideas.length
        ? `<div class="chips">${ideas.map((t) => `<button class="chip" data-add="${esc(t.term)}" title="Used by ${t.count} of ${n} top listings">+ ${esc(t.term)} <span class="muted small">${Math.round(t.pct)}%</span></button>`).join('')}</div>
           <p class="muted small" style="margin-top:8px">% = share of top listings using the tag. Click to add.</p>`
        : '<p class="muted small">No new tag ideas found.</p>';
      ctx.refreshStatus();
    } catch (err) {
      box2.innerHTML = errorBox(err);
    }
    e.target.disabled = false;
  });
  $('#ideas', view).addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    if (tags.length >= 13) return alert('You already have 13 tags. Remove one first.');
    addTags(b.dataset.add);
    b.remove();
  });

  drawTags();
  update();
}
