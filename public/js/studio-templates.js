import { PALETTES, FONTS } from './studio-core.js';

/*
 * Template looks, "My templates" storage (this browser only) and import/export.
 * Imported files are sanitized: scripts, event handlers, forms, frames and every remote
 * resource are removed, so a template can never run code or load anything from the internet.
 */

export const LOOKS = [
  { id: 'sage', name: 'Minimal Sage', palette: 'sage', head: 'Lora', body: 'Poppins' },
  { id: 'boho', name: 'Boho Terracotta', palette: 'terracotta', head: 'Dancing Script', body: 'Lora' },
  { id: 'navygold', name: 'Elegant Navy & Gold', palette: 'navy', head: 'Playfair Display', body: 'Montserrat' },
  { id: 'blush', name: 'Soft Blush Script', palette: 'blush', head: 'Dancing Script', body: 'Poppins' },
  { id: 'mono', name: 'Modern Black & White', palette: 'mono', head: 'Montserrat', body: 'Montserrat' },
  { id: 'dusty', name: 'Dusty Blue Classic', palette: 'dustyblue', head: 'Playfair Display', body: 'Lora' },
  { id: 'burgundy', name: 'Burgundy Romance', palette: 'burgundy', head: 'Playfair Display', body: 'Poppins' },
  { id: 'lavender', name: 'Lavender Dream', palette: 'lavender', head: 'Dancing Script', body: 'Poppins' },
  { id: 'emerald', name: 'Emerald (Ramadan / Eid)', palette: 'emerald', head: 'Amiri', body: 'Lora' },
  { id: 'holiday', name: 'Holiday Cheer', palette: 'holiday', head: 'Playfair Display', body: 'Poppins' },
];

const KEY = 'studio-templates';
const FORMAT = 'etsy-research-hub-template';
const MAX_FILE = 8 * 1024 * 1024;

export function loadAll() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Browser storage is full. Delete an old template or use Export to keep it as a file.' };
  }
}
export function saveTemplate(t) {
  const list = loadAll();
  const item = { id: `t${Date.now().toString(36)}`, created: new Date().toISOString(), ...t };
  list.unshift(item);
  const r = writeAll(list);
  return r.ok ? { ok: true, item } : r;
}
export function deleteTemplate(id) { writeAll(loadAll().filter((t) => t.id !== id)); }

const cleanState = (s = {}) => ({
  palette: PALETTES[s.palette] ? s.palette : 'sage',
  head: FONTS[s.head] ? s.head : 'Playfair Display',
  body: FONTS[s.body] ? s.body : 'Poppins',
  paper: s.paper === 'A4' ? 'A4' : 'letter',
});

export function downloadTemplate(t) {
  const data = { format: FORMAT, version: 1, name: t.name, product: t.product || '', state: cleanState(t.state), fonts: (t.fonts || []).filter((f) => FONTS[f]), html: t.html };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = `${String(t.name || 'template').replace(/[^\w-]+/g, '-').toLowerCase()}.template.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------- sanitizer ----------
const BAD_TAGS = 'script,iframe,frame,frameset,object,embed,link,meta,base,form,input,button,textarea,select,noscript,audio,video,source,track,canvas,applet';
const URL_ATTRS = ['href', 'src', 'xlink:href', 'poster', 'action', 'formaction', 'background'];
const scrubCss = (css) => String(css)
  .replace(/@import[^;]*;?/gi, '')
  .replace(/url\(\s*(['"]?)\s*(?!data:image\/(?:png|jpe?g|gif|webp|svg\+xml)[;,])[^)]*\1\s*\)/gi, 'none')
  .replace(/expression\s*\(|behavior\s*:|-moz-binding/gi, '');

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll(BAD_TAGS).forEach((n) => n.remove());
  const walk = (root) => {
    root.querySelectorAll('*').forEach((el) => {
      for (const a of [...el.attributes]) {
        const name = a.name.toLowerCase();
        const val = a.value;
        if (name.startsWith('on') || name === 'srcdoc' || name === 'contenteditable') el.removeAttribute(a.name);
        else if (URL_ATTRS.includes(name) && !/^\s*(#|data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,])/i.test(val)) el.removeAttribute(a.name);
        else if (name === 'style') el.setAttribute('style', scrubCss(val));
      }
      if (el.tagName === 'STYLE') el.textContent = scrubCss(el.textContent);
      if (el.tagName === 'IMG' && !el.getAttribute('src')) el.remove();
    });
  };
  walk(doc);
  // <style> blocks from <head> must travel with the body markup
  const headStyles = [...doc.head.querySelectorAll('style')].map((s) => s.outerHTML).join('');
  let body = doc.body.innerHTML;
  if (!doc.body.querySelector('.sheet')) body = `<section class="sheet" style="padding:.55in">${body}</section>`;
  return headStyles + body;
}

// ---------- import ----------
export async function importFile(file) {
  if (!file) throw new Error('No file chosen');
  if (file.size > MAX_FILE) throw new Error('File is over 8 MB. Use a smaller file.');
  const name = file.name.replace(/\.[^.]+$/, '').replace(/\.template$/i, '') || 'Imported design';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const text = () => file.text();
  const dataUrl = () => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file')); r.readAsDataURL(file); });

  if (ext === 'json') {
    let d;
    try { d = JSON.parse(await text()); } catch { throw new Error('This is not a valid template file.'); }
    if (d?.format !== FORMAT || typeof d.html !== 'string') throw new Error('This JSON is not a template exported from this tool.');
    return { name: d.name || name, product: d.product || '', state: cleanState(d.state), fonts: (d.fonts || []).filter((f) => FONTS[f]), html: sanitizeHtml(d.html) };
  }
  if (ext === 'html' || ext === 'htm') return { name, product: '', state: cleanState(), fonts: [], html: sanitizeHtml(await text()) };
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
    const url = await dataUrl();
    if (!/^data:image\/(png|jpe?g|webp|svg\+xml)/i.test(url)) throw new Error('Unsupported image type.');
    return { name, product: '', state: cleanState(), fonts: [], html: `<section class="sheet flush" style="background-image:url(&quot;${url}&quot;);background-size:cover;background-position:center"></section>` };
  }
  if (ext === 'pdf') throw new Error('PDF files cannot be opened here. In Canva (or any tool) download the page as PNG or SVG, then import that image and add editable text on top.');
  throw new Error('Supported files: .json (exported from this tool), .html, .png, .jpg, .webp, .svg');
}
