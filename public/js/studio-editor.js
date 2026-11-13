import { esc } from './ui.js';
import { FONTS, PALETTES, gfont, PREVIEW_ZOOM } from './studio-core.js';

/*
 * Canva-style editor for the Design Studio preview. It works directly on the generated
 * HTML inside the preview iframe: click any text to type, select an element to restyle it,
 * add text / shapes / images that you can drag and resize, duplicate or delete pages.
 * Nothing is sent anywhere; no AI is involved.
 */

const EDIT_CSS = `
  [contenteditable]{outline:none;cursor:text}
  [contenteditable]:hover{outline:1px dashed #6c5ce799;outline-offset:1px}
  .ed-sel{outline:2px solid #6c5ce7 !important;outline-offset:1px}
  .ed-obj{position:absolute;box-sizing:border-box}
  .ed-obj[data-t=shape],.ed-obj[data-t=image]{cursor:move}
  .ed-ui{position:absolute;background:#6c5ce7;z-index:99999;user-select:none}
  .ed-move{left:-10px;top:-10px;width:18px;height:18px;border-radius:50%;cursor:move}
  .ed-resize{right:-10px;bottom:-10px;width:18px;height:18px;border-radius:4px;cursor:nwse-resize}
  img{user-select:none;-webkit-user-drag:none}
`;

const hex = (rgb) => {
  const m = String(rgb).match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3 || (m.length > 3 && Number(m[3]) === 0)) return null;
  return '#' + m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('');
};
const px = (v) => parseFloat(v) || 0;

export function createEditor({ frame, bar, getState, notify }) {
  let on = false;
  let sel = null;
  let sheet = null;
  let lastRange = null;
  let undo = [];
  let redo = [];
  let zoom = PREVIEW_ZOOM;
  let timer = null;
  const fonts = new Set();
  const doc = () => frame.contentDocument;

  // ---------- history ----------
  const cleanClone = (forExport) => {
    const c = doc().body.cloneNode(true);
    c.querySelectorAll('.ed-ui').forEach((n) => n.remove());
    c.querySelectorAll('.ed-sel').forEach((n) => { n.classList.remove('ed-sel'); if (!n.getAttribute('class')) n.removeAttribute('class'); });
    if (forExport) {
      c.querySelectorAll('[contenteditable]').forEach((n) => { n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck'); });
      c.querySelectorAll('[data-t]').forEach((n) => n.removeAttribute('data-t'));
    }
    return c;
  };
  const snap = () => {
    const h = cleanClone(false).innerHTML;
    if (h === undo[undo.length - 1]) return;
    undo.push(h);
    if (undo.length > 60) undo.shift();
    redo = [];
    syncBar();
  };
  const restore = (h) => {
    clearSel();
    doc().body.innerHTML = h;
    syncBar();
  };
  const doUndo = () => { if (undo.length > 1) { redo.push(undo.pop()); restore(undo[undo.length - 1]); } };
  const doRedo = () => { if (redo.length) { const h = redo.pop(); undo.push(h); restore(h); } };

  // ---------- selection ----------
  function removeUi() { doc().querySelectorAll('.ed-ui').forEach((n) => n.remove()); }
  function clearSel() {
    if (sel) sel.classList.remove('ed-sel');
    removeUi();
    sel = null;
  }
  function select(el) {
    clearSel();
    sel = el;
    if (el) {
      el.classList.add('ed-sel');
      if (el.classList.contains('ed-obj')) {
        for (const cls of ['ed-move', 'ed-resize']) {
          const u = doc().createElement('div');
          u.className = `ed-ui ${cls}`;
          u.setAttribute('contenteditable', 'false');
          el.appendChild(u);
        }
      }
    }
    syncBar();
  }

  // ---------- helpers ----------
  const ensureFont = (name) => {
    if (!FONTS[name] || fonts.has(name)) return;
    fonts.add(name);
    const l = doc().createElement('link');
    l.rel = 'stylesheet';
    l.href = gfont([name]);
    doc().head.appendChild(l);
  };
  const rangeText = () => {
    const s = doc().getSelection();
    return s && s.rangeCount && !s.isCollapsed ? s.getRangeAt(0) : null;
  };
  // Run an execCommand on the saved text selection (the toolbar steals focus from the iframe).
  function onText(fn) {
    if (!lastRange || lastRange.collapsed) return false;
    const s = doc().getSelection();
    s.removeAllRanges();
    s.addRange(lastRange);
    doc().execCommand('styleWithCSS', false, true);
    fn();
    return true;
  }
  const sheetOf = () => sheet || doc().querySelector('.sheet');
  const place = (obj) => {
    const sh = sheetOf();
    if (!sh) return;
    const cs = getComputedStyle(sh);
    obj.style.left = `${Math.round(px(cs.width) * 0.28)}px`;
    obj.style.top = `${Math.round(px(cs.height) * 0.35)}px`;
    obj.style.zIndex = '10';
    sh.appendChild(obj);
    select(obj);
    snap();
  };
  const newObj = (type, style, inner = '') => {
    const o = doc().createElement('div');
    o.className = 'ed-obj';
    o.dataset.t = type;
    o.setAttribute('style', style);
    o.innerHTML = inner;
    return o;
  };

  // ---------- add things ----------
  function addText() {
    const st = getState();
    ensureFont(st.head);
    const o = newObj('text', `width:3in;font-size:30px;text-align:center;color:var(--ink);font-family:'${st.head}',serif`, 'Your text');
    o.setAttribute('contenteditable', 'true');
    place(o);
  }
  const addShape = (kind) => {
    const styles = {
      box: 'width:1.8in;height:1.1in;background:var(--soft);border:2px solid var(--acc);border-radius:8px',
      circle: 'width:1.3in;height:1.3in;background:var(--soft);border:2px solid var(--acc);border-radius:50%',
      line: 'width:2.2in;height:0;border-top:3px solid var(--acc)',
    };
    place(newObj('shape', styles[kind]));
  };
  function addImage(file) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { notify('Image is over 3 MB — use a smaller file'); return; }
    const r = new FileReader();
    r.onload = () => {
      place(newObj('image', 'width:2in;height:2in', `<img src="${r.result}" alt="" style="width:100%;height:100%;object-fit:contain;pointer-events:none">`));
    };
    r.readAsDataURL(file);
  }

  // ---------- page + element operations ----------
  const strip = (n) => { n.querySelectorAll('.ed-ui').forEach((x) => x.remove()); n.classList.remove('ed-sel'); n.querySelectorAll('.ed-sel').forEach((x) => x.classList.remove('ed-sel')); };
  function dupPage() {
    const sh = sheetOf();
    if (!sh) return;
    clearSel();
    const c = sh.cloneNode(true);
    strip(c);
    sh.after(c);
    sheet = c;
    snap();
  }
  function delPage() {
    const sh = sheetOf();
    if (!sh || doc().querySelectorAll('.sheet').length < 2) { notify('A design needs at least one page'); return; }
    clearSel();
    const next = sh.nextElementSibling || sh.previousElementSibling;
    sh.remove();
    sheet = next;
    snap();
  }
  function blankPage() {
    const sh = sheetOf();
    clearSel();
    const n = doc().createElement('section');
    n.className = 'sheet';
    (sh || doc().body.lastElementChild)?.after(n);
    if (!sh) doc().body.appendChild(n);
    sheet = n;
    snap();
  }
  function copyCard() {
    const card = sel?.closest?.('.st-card') || sheetOf()?.querySelector('.st-card');
    if (!card) { notify('Click inside a card first'); return; }
    clearSel();
    const html = card.innerHTML;
    doc().querySelectorAll('.st-card').forEach((c) => { if (c !== card) c.innerHTML = html; });
    snap();
    notify('Copied to every card');
  }
  function delSel() { if (sel) { const s = sel; clearSel(); s.remove(); snap(); } }
  function dupSel() {
    if (!sel) return;
    const c = sel.cloneNode(true);
    strip(c);
    if (c.classList.contains('ed-obj')) { c.style.left = `${px(getComputedStyle(sel).left) + 24}px`; c.style.top = `${px(getComputedStyle(sel).top) + 24}px`; }
    sel.after(c);
    select(c);
    snap();
  }
  function setStyle(prop, val) { if (sel) { sel.style[prop] = val; snap(); syncBar(); } }

  // ---------- toolbar ----------
  const fontOpts = Object.keys(FONTS).map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  bar.innerHTML = `
    <div class="ed-row">
      <button class="btn secondary sm" data-c="undo" title="Undo (Ctrl+Z)">↶ Undo</button><button class="btn secondary sm" data-c="redo" title="Redo (Ctrl+Y)">↷ Redo</button>
      <span class="ed-sep"></span>
      <button class="btn secondary sm" data-c="text">T Text</button><button class="btn secondary sm" data-c="box">▭ Box</button><button class="btn secondary sm" data-c="circle">◯ Circle</button><button class="btn secondary sm" data-c="line">— Line</button>
      <label class="btn secondary sm" style="cursor:pointer">🖼 Image<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-c="image" hidden></label>
      <span class="ed-sep"></span>
      <button class="btn secondary sm" data-c="duppage">⧉ Duplicate page</button><button class="btn secondary sm" data-c="blankpage">＋ Blank page</button><button class="btn secondary sm" data-c="delpage">🗑 Delete page</button>
      <button class="btn secondary sm" data-c="copycard" title="For invitations: copy this card's edits to all cards">⇉ Copy card to all</button>
      <span class="ed-sep"></span>
      <label class="small">Zoom <select class="input" data-c="zoom" style="width:auto;display:inline-block;padding:3px 6px"><option value="0.5">50%</option><option value="0.62">62%</option><option value="0.8" selected>80%</option><option value="1">100%</option></select></label>
    </div>
    <div class="ed-row" id="ed-sel-row">
      <select class="input" data-c="font" style="width:auto;padding:3px 6px">${fontOpts}</select>
      <button class="btn secondary sm" data-c="sizeminus">A−</button><input class="input" data-c="size" type="number" min="4" max="400" style="width:62px;padding:3px 6px"><button class="btn secondary sm" data-c="sizeplus">A+</button>
      <label class="small" title="Text color">A <input type="color" data-c="color"></label>
      <span id="ed-sw"></span>
      <button class="btn secondary sm" data-c="bold"><b>B</b></button><button class="btn secondary sm" data-c="italic"><i>I</i></button><button class="btn secondary sm" data-c="underline"><u>U</u></button>
      <button class="btn secondary sm" data-c="left">⟸</button><button class="btn secondary sm" data-c="center">≡</button><button class="btn secondary sm" data-c="right">⟹</button>
      <span class="ed-sep"></span>
      <label class="small" title="Fill color">Fill <input type="color" data-c="fill"></label><button class="btn secondary sm" data-c="nofill">no fill</button>
      <label class="small" title="Border color">Border <input type="color" data-c="border"></label><button class="btn secondary sm" data-c="noborder">no border</button>
      <span class="ed-sep"></span>
      <button class="btn secondary sm" data-c="dup">⧉ Duplicate</button><button class="btn secondary sm" data-c="front">▲ Front</button><button class="btn secondary sm" data-c="back">▼ Back</button><button class="btn secondary sm" data-c="del">🗑 Delete</button>
    </div>
    <p class="muted small" style="margin:6px 0 0">Click any text to type. Click an element to restyle it. Added items have a ● handle to move and a ■ handle to resize. Select part of a text to bold / recolor just that part.</p>
    <style>.ed-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}.ed-sep{width:1px;height:20px;background:var(--border)}.ed-row input[type=color]{width:30px;height:26px;padding:0;border:1px solid var(--border);border-radius:6px;background:none;vertical-align:middle}.ed-sw{display:inline-block;width:18px;height:18px;border-radius:50%;border:1px solid #0003;cursor:pointer;margin-right:3px}</style>`;

  bar.addEventListener('mousedown', (e) => {
    // keep the text selection inside the iframe when clicking buttons
    if (e.target.closest('button,label') && !e.target.closest('input[type=color]')) e.preventDefault();
  });
  const act = (c, v, target) => {
    const d = doc();
    switch (c) {
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'text': addText(); break;
      case 'box': case 'circle': case 'line': addShape(c); break;
      case 'duppage': dupPage(); break;
      case 'delpage': delPage(); break;
      case 'blankpage': blankPage(); break;
      case 'copycard': copyCard(); break;
      case 'zoom': zoom = Number(v) || 0.8; d.body.style.zoom = zoom; break;
      case 'dup': dupSel(); break;
      case 'del': delSel(); break;
      case 'front': if (sel?.classList.contains('ed-obj')) setStyle('zIndex', String((Number(sel.style.zIndex) || 10) + 1)); break;
      case 'back': if (sel?.classList.contains('ed-obj')) setStyle('zIndex', String(Math.max(1, (Number(sel.style.zIndex) || 10) - 1))); break;
      case 'nofill': setStyle('background', 'transparent'); break;
      case 'noborder': setStyle('border', '0'); break;
      case 'left': case 'center': case 'right': setStyle('textAlign', c); break;
      case 'sizeplus': case 'sizeminus': if (sel) setStyle('fontSize', `${Math.max(4, Math.round(px(getComputedStyle(sel).fontSize)) + (c === 'sizeplus' ? 2 : -2))}px`); break;
      case 'size': if (sel && Number(v) > 0) setStyle('fontSize', `${Number(v)}px`); break;
      case 'font':
        ensureFont(v);
        if (!onText(() => d.execCommand('fontName', false, v)) && sel) setStyle('fontFamily', `'${v}'`); else snap();
        break;
      case 'color':
        if (!onText(() => d.execCommand('foreColor', false, v)) && sel) setStyle('color', v); else snap();
        break;
      case 'bold': case 'italic': case 'underline':
        if (!onText(() => d.execCommand(c))) {
          if (sel) {
            const cs = getComputedStyle(sel);
            if (c === 'bold') setStyle('fontWeight', Number(cs.fontWeight) >= 600 ? '400' : '700');
            else if (c === 'italic') setStyle('fontStyle', cs.fontStyle === 'italic' ? 'normal' : 'italic');
            else setStyle('textDecoration', cs.textDecorationLine.includes('underline') ? 'none' : 'underline');
          }
        } else snap();
        break;
      case 'fill': setStyle('background', v); break;
      case 'border': if (sel) { sel.style.borderStyle = sel.style.borderStyle && sel.style.borderStyle !== 'none' ? sel.style.borderStyle : 'solid'; if (!px(getComputedStyle(sel).borderTopWidth)) sel.style.borderWidth = '2px'; setStyle('borderColor', v); } break;
      case 'image': addImage(target.files?.[0]); target.value = ''; break;
      default: break;
    }
  };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-c]');
    if (b) act(b.dataset.c, null, b);
    const sw = e.target.closest('.ed-sw');
    if (sw) act('color', sw.dataset.v);
  });
  bar.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('input[type=color],select[data-c]')) act(t.dataset.c, t.value, t);
  });
  bar.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('input[type=file]')) act('image', null, t);
    if (t.matches('input[type=number]')) act('size', t.value, t);
  });

  function syncBar() {
    const row = bar.querySelector('#ed-sel-row');
    if (!row) return;
    const has = Boolean(sel);
    row.style.opacity = has ? '1' : '.4';
    row.style.pointerEvents = has ? 'auto' : 'none';
    bar.querySelector('[data-c=undo]').disabled = undo.length < 2;
    bar.querySelector('[data-c=redo]').disabled = !redo.length;
    const st = getState();
    const p = PALETTES[st.palette] || PALETTES.sage;
    bar.querySelector('#ed-sw').innerHTML = [p.ink, p.accent, p.soft, '#ffffff', '#000000'].map((c) => `<span class="ed-sw" data-v="${c}" style="background:${c}"></span>`).join('');
    if (!has) return;
    const cs = getComputedStyle(sel);
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const f = bar.querySelector('[data-c=font]');
    if (FONTS[fam]) f.value = fam;
    bar.querySelector('[data-c=size]').value = Math.round(px(cs.fontSize));
    bar.querySelector('[data-c=color]').value = hex(cs.color) || '#000000';
    bar.querySelector('[data-c=fill]').value = hex(cs.backgroundColor) || '#ffffff';
    bar.querySelector('[data-c=border]').value = hex(cs.borderTopColor) || '#000000';
  }

  // ---------- iframe wiring ----------
  function wire() {
    const d = doc();
    if (!d.getElementById('ed-style')) {
      const s = d.createElement('style');
      s.id = 'ed-style';
      s.textContent = EDIT_CSS;
      d.head.appendChild(s);
    }
    d.body.style.zoom = zoom;
    // every element that holds its own text becomes editable
    d.querySelectorAll('body *').forEach((el) => {
      if (['SCRIPT', 'STYLE', 'svg', 'path', 'circle', 'IMG'].includes(el.tagName) || el.closest('svg')) return;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own) { el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); }
    });
    d.addEventListener('click', (e) => {
      const t = e.target;
      const sh = t.closest?.('.sheet');
      if (sh) sheet = sh;
      if (t.closest?.('.ed-ui')) return;
      if (t === d.body || t === d.documentElement || t.classList?.contains('sheet')) { select(null); return; }
      select(t.closest('.ed-obj') || t);
    });
    d.addEventListener('selectionchange', () => { const r = rangeText(); if (r) lastRange = r.cloneRange(); });
    d.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(snap, 500); });
    d.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !d.activeElement?.isContentEditable) { e.preventDefault(); delSel(); }
    });
    d.addEventListener('mousedown', (e) => {
      const obj = e.target.closest?.('.ed-obj');
      if (!obj) return;
      const ui = e.target.closest('.ed-ui');
      const resize = ui?.classList.contains('ed-resize');
      const moveHandle = ui?.classList.contains('ed-move');
      const free = obj.dataset.t === 'shape' || obj.dataset.t === 'image';
      if (!resize && !moveHandle && !free) return; // text objects: normal typing
      e.preventDefault();
      if (sel !== obj) select(obj);
      const cs = getComputedStyle(obj);
      const sx = e.clientX, sy = e.clientY, l = px(cs.left), t = px(cs.top), w = px(cs.width), h = px(cs.height);
      const mv = (ev) => {
        const dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;
        if (resize) {
          obj.style.width = `${Math.max(16, w + dx)}px`;
          if (obj.dataset.t !== 'text' && obj.dataset.t !== 'line') obj.style.height = `${Math.max(8, h + dy)}px`;
        } else { obj.style.left = `${l + dx}px`; obj.style.top = `${t + dy}px`; }
      };
      const up = () => { d.removeEventListener('mousemove', mv); d.removeEventListener('mouseup', up); snap(); };
      d.addEventListener('mousemove', mv);
      d.addEventListener('mouseup', up);
    });
  }

  return {
    isOn: () => on,
    enable() {
      on = true;
      undo = []; redo = []; sel = null; sheet = null; lastRange = null;
      fonts.clear();
      wire();
      bar.hidden = false;
      bar.querySelector('[data-c=zoom]').value = String(zoom);
      snap();
      syncBar();
      bar.querySelector('[data-c=copycard]').hidden = !doc().querySelector('.st-card');
    },
    disable() { on = false; bar.hidden = true; sel = null; },
    // Palette / font / paper changes while editing: restyle live without losing edits.
    applyTheme(st) {
      if (!on) return;
      const d = doc();
      const p = PALETTES[st.palette] || PALETTES.sage;
      ensureFont(st.head);
      ensureFont(st.body);
      let s = d.getElementById('ed-theme');
      if (!s) { s = d.createElement('style'); s.id = 'ed-theme'; d.head.appendChild(s); }
      const letter = st.paper !== 'A4';
      s.textContent = `:root{--ink:${p.ink};--acc:${p.accent};--soft:${p.soft};--bg:${p.bg};--line:${p.ink}66}
        body{font-family:'${st.body}',sans-serif;color:${p.ink}} .h{font-family:'${st.head}',serif;color:${p.accent}}
        .sheet{background:${p.bg};width:${letter ? '8.5in' : '210mm'};height:${letter ? '11in' : '297mm'}}
        .rule{background:${p.accent}} .box{border-color:${p.accent}} .soft{background:${p.soft}} .small{color:${p.ink}b3} .foot{color:${p.ink}99} .line{border-bottom-color:${p.ink}66}`;
      syncBar();
    },
    usedFonts: () => [...fonts],
    exportBody: () => cleanClone(true).innerHTML,
  };
}
