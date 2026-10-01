import { $, esc, store, copyText, toast } from '../ui.js';
import { P, scoreRing, ETSY_NOTICE, renderIssues, scoreLabel, autoFix, fullText } from '../builder/shared.js';

const KEY = 'policy-check-draft';

export async function render(view) {
  const d = store.get(KEY, { title: '', tags: '', description: '', itemType: 'handmade', aiDesign: false });
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Policy Checker</h1>
      <p>Paste a listing you already wrote (or one from another tool) to find anything that breaks Etsy’s rules: title & tag limits, trademarks, medical claims, off-Etsy contact details, “vintage”/“handmade” claims and AI disclosure. Runs in your browser — no API calls.</p>
    </div></div>
    <div class="grid split-wide">
      <div class="card stack">
        <label class="field"><span class="row">Title <span class="spacer"></span><span class="counter" id="c-title"></span></span>
          <textarea class="input" id="k-title" rows="2">${esc(d.title)}</textarea></label>
        <label class="field"><span class="row">Tags (comma separated) <span class="spacer"></span><span class="counter" id="c-tags"></span></span>
          <input class="input" id="k-tags" value="${esc(d.tags)}"></label>
        <label class="field">Description<textarea class="input" id="k-desc" rows="12">${esc(d.description)}</textarea></label>
        <div class="field-row">
          <label class="field">Item type<select class="input" id="k-type">
            ${[['handmade', 'Handmade'], ['digital', 'Digital download'], ['pod', 'Print-on-demand'], ['vintage', 'Vintage (20+ years)'], ['supply-resell', 'Craft supply (sourced)']]
              .map(([k, l]) => `<option value="${k}" ${d.itemType === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
          <label class="field" style="align-self:end"><span class="row small" style="gap:6px;min-height:40px"><input type="checkbox" id="k-ai" ${d.aiDesign ? 'checked' : ''}> AI tools used in the design</span></label>
        </div>
        <div class="row">
          <button class="btn" id="k-fix">🛠 Auto-fix</button>
          <button class="btn secondary" id="k-copy">Copy all</button>
          <button class="btn ghost" id="k-clear">Clear</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head" style="align-items:center"><div><h3 id="k-label">Paste a listing</h3><p id="k-sub"></p></div><div id="k-ring"></div></div>
        <div id="k-checks"></div>
      </div>
    </div>
    <p class="muted small" style="margin-top:18px">${esc(ETSY_NOTICE)}</p>`;

  const el = { title: $('#k-title', view), tags: $('#k-tags', view), desc: $('#k-desc', view), type: $('#k-type', view), ai: $('#k-ai', view) };
  const ctxOf = () => ({ itemType: el.type.value, itemTypeLabel: el.type.selectedOptions[0].textContent, aiDesign: el.ai.checked, shopName: '' });
  const listingOf = () => ({
    title: el.title.value.replace(/\n/g, ' '),
    tags: el.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    description: el.desc.value,
    materials: [],
    altTexts: [],
  });

  function update() {
    store.set(KEY, { title: el.title.value, tags: el.tags.value, description: el.desc.value, itemType: el.type.value, aiDesign: el.ai.checked });
    const l = listingOf();
    $('#c-title', view).textContent = `${l.title.length}/140`;
    $('#c-title', view).classList.toggle('over', l.title.length > 140);
    $('#c-tags', view).textContent = `${l.tags.length}/13`;
    $('#c-tags', view).classList.toggle('over', l.tags.length > 13);
    if (!l.title && !l.description && !l.tags.length) {
      $('#k-ring', view).innerHTML = '';
      $('#k-label', view).textContent = 'Paste a listing';
      $('#k-sub', view).textContent = '';
      $('#k-checks', view).innerHTML = '<p class="muted small">Results update as you type.</p>';
      return;
    }
    const r = P.checkListing(l, ctxOf());
    $('#k-ring', view).innerHTML = scoreRing(r.score);
    $('#k-label', view).textContent = scoreLabel(r);
    $('#k-sub', view).textContent = `${r.errors} to fix · ${r.warns} to check · ${r.infos} tips`;
    $('#k-checks', view).innerHTML = renderIssues(r);
  }

  [el.title, el.tags, el.desc].forEach((x) => x.addEventListener('input', update));
  [el.type, el.ai].forEach((x) => x.addEventListener('change', update));
  $('#k-fix', view).addEventListener('click', () => {
    const l = autoFix(listingOf(), ctxOf(), null, null);
    el.title.value = l.title;
    el.tags.value = l.tags.join(', ');
    el.desc.value = l.description;
    update();
    toast('Auto-fixed — review anything still flagged');
  });
  $('#k-copy', view).addEventListener('click', () => copyText(fullText(listingOf())));
  $('#k-clear', view).addEventListener('click', () => {
    el.title.value = el.tags.value = el.desc.value = '';
    update();
  });
  update();
}
