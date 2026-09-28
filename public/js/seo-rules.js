// Etsy listing SEO checks shared by the Title & Tag Grader and the Listing Analyzer.

const STOP = new Set('a an and or the for of to in on with by at from as is it this that your you my our'.split(' '));
const words = (s) => (s || '').toLowerCase().match(/[a-z0-9']+/g) || [];

export function auditListing({ title = '', tags = [], description = null, keyword = '' }) {
  const checks = [];
  const add = (status, weight, label, detail = '') => checks.push({ status, weight, label, detail });
  const t = title.trim();
  const kw = keyword.trim().toLowerCase();
  tags = tags.map((x) => x.trim().toLowerCase()).filter(Boolean);

  // ---- title ----
  if (!t) add('fail', 3, 'Add a title', 'The title is the most important search field on Etsy.');
  else if (t.length > 140) add('fail', 3, `Title is ${t.length}/140 characters`, 'Etsy cuts titles at 140 characters.');
  else if (t.length < 40) add('warn', 3, `Title is short (${t.length} chars)`, 'Describe what it is, who it’s for and key attributes (material, color, size, occasion).');
  else add('pass', 3, `Title length is good (${t.length}/140)`, t.length > 120 ? 'Long is OK — Etsy recommends clear, readable titles over keyword lists.' : '');

  if (t) {
    const first = t.slice(0, 40).toLowerCase();
    if (kw) {
      if (first.includes(kw)) add('pass', 3, 'Main keyword is at the start of the title');
      else if (t.toLowerCase().includes(kw)) add('warn', 3, 'Main keyword is in the title but not in the first 40 characters', 'Front-load the phrase buyers search for.');
      else add('fail', 3, `Main keyword “${kw}” is not in the title`);
    }
    const counts = {};
    for (const w of words(t)) if (!STOP.has(w) && w.length > 2) counts[w] = (counts[w] || 0) + 1;
    const stuffed = Object.entries(counts).filter(([, c]) => c > 2).map(([w]) => w);
    if (stuffed.length) add('warn', 2, 'Some words are repeated 3+ times', `Repeated: ${stuffed.join(', ')}. Repetition doesn’t boost ranking — use tags for variations.`);
    else add('pass', 2, 'No keyword stuffing in the title');

    const caps = (t.match(/\b[A-Z]{3,}\b/g) || []).filter((w) => !/^(USA|UK|SVG|PNG|PDF|DIY|XL|XXL|LED|DXF|EPS|JPG|JPEG|BTS|LGBTQ)$/.test(w));
    if (caps.length > 1) add('warn', 1, 'Avoid ALL CAPS words', caps.slice(0, 5).join(', '));

    const seps = (t.match(/[|,]/g) || []).length;
    if (seps > 5) add('warn', 1, `Title has ${seps} separators`, 'Etsy recommends readable titles — keep the most important phrases and move the rest to tags.');
  }

  // ---- tags ----
  if (tags.length === 13) add('pass', 3, 'All 13 tags are used');
  else if (tags.length >= 10) add('warn', 3, `${tags.length}/13 tags used`, 'Every empty tag slot is a missed search phrase.');
  else add('fail', 3, `Only ${tags.length}/13 tags used`, 'Use all 13 tags.');

  const long = tags.filter((x) => x.length > 20);
  if (long.length) add('fail', 2, `${long.length} tag(s) are longer than 20 characters`, long.join(', '));
  else if (tags.length) add('pass', 2, 'All tags fit the 20-character limit');

  const bad = tags.filter((x) => /[^a-z0-9 '\-&™©®]/i.test(x));
  if (bad.length) add('fail', 1, 'Tags contain characters Etsy does not allow', bad.join(', '));

  const dupes = tags.filter((x, i) => tags.indexOf(x) !== i);
  if (dupes.length) add('fail', 2, 'Duplicate tags', [...new Set(dupes)].join(', '));

  const multi = tags.filter((x) => x.includes(' ')).length;
  if (tags.length) {
    if (multi >= 8) add('pass', 2, `${multi} tags are multi-word phrases`);
    else add('warn', 2, `Only ${multi} multi-word tags`, 'Long-tail phrases (“gift for dog mom”) match more specific searches than single words.');
  }

  const single = tags.filter((x) => !x.includes(' '));
  const titleWords = new Set(words(t));
  const wasted = single.filter((x) => titleWords.has(x));
  if (wasted.length >= 2) add('warn', 1, 'Single-word tags that are already in the title', `${wasted.join(', ')} — try longer phrases instead.`);

  if (t && tags.length) {
    const tl = t.toLowerCase();
    const overlap = tags.filter((x) => tl.includes(x)).length;
    if (overlap >= 2) add('pass', 2, `${overlap} tags also appear in the title`, 'Matching title & tags reinforces relevance.');
    else add('warn', 2, 'Few tags match phrases in your title', 'Repeat your most important 2–3 phrases in both title and tags.');
  }

  if (kw && tags.length) {
    if (tags.some((x) => x === kw || x.includes(kw) || kw.includes(x))) add('pass', 2, 'Main keyword is used as a tag');
    else add('warn', 2, 'Main keyword is not in your tags');
  }

  // ---- description ----
  if (description !== null) {
    const d = description.trim();
    if (!d) add('fail', 2, 'No description', 'Etsy and Google read the first lines of your description.');
    else if (d.length < 160) add('warn', 2, `Description is short (${d.length} chars)`, 'Add details: size, materials, personalization, shipping, care.');
    else add('pass', 2, `Description has ${d.length} characters`);
    if (d) {
      const firstLine = d.slice(0, 160).toLowerCase();
      const probe = kw || words(t).filter((w) => !STOP.has(w)).slice(0, 3).join(' ');
      if (probe && (firstLine.includes(probe) || words(probe).every((w) => firstLine.includes(w))))
        add('pass', 1, 'First sentence of the description describes the item with keywords');
      else add('warn', 1, 'Start the description with your main keywords', 'Google shows the first ~160 characters as your snippet.');
    }
  }

  const scored = checks.filter((c) => c.status !== 'info');
  const total = scored.reduce((a, c) => a + c.weight, 0) || 1;
  const got = scored.reduce((a, c) => a + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight / 2 : 0), 0);
  const order = { fail: 0, warn: 1, info: 2, pass: 3 };
  checks.sort((a, b) => order[a.status] - order[b.status]);
  return { score: Math.round((got / total) * 100), checks };
}

export function renderChecks(checks) {
  const icon = { pass: '✓', warn: '!', fail: '✕', info: 'i' };
  return `<div class="check-list">${checks
    .map(
      (c) => `<div class="check"><span class="ic ${c.status}">${icon[c.status]}</span><div><div>${escapeHtml(c.label)}</div>${c.detail ? `<div class="sub">${escapeHtml(c.detail)}</div>` : ''}</div></div>`
    )
    .join('')}</div>`;
}

export function scoreRing(score) {
  const c = score >= 80 ? 'var(--good)' : score >= 60 ? 'var(--warn)' : score >= 40 ? 'var(--serious)' : 'var(--critical)';
  return `<div class="score-ring" style="--v:${score};--c:${c}"><div>${score}</div></div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
