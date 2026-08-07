/* ==========================================================================
   Tiny helpers shared by every module. No dependencies.
   ========================================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element with props/children in one call. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Escape untrusted text before it lands in an innerHTML template. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const round = (n, d = 0) => { const p = 10 ** d; return Math.round((+n || 0) * p) / p; };
export const sum = (arr, pick = (x) => x) => arr.reduce((s, x) => s + (+pick(x) || 0), 0);
export const avg = (arr, pick = (x) => x) => (arr.length ? sum(arr, pick) / arr.length : 0);
export const lerp = (a, b, t) => a + (b - a) * t;

export function uid(prefix = 'i') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------------- numbers ---------------- */

/** Human-friendly amount: keeps one decimal only while it matters. */
export function fmtNum(n, unit = '') {
  const v = +n || 0;
  const a = Math.abs(v);
  let s;
  if (a >= 100) s = String(Math.round(v));
  else if (a >= 10) s = String(round(v, 1));
  else if (a >= 1) s = String(round(v, 1));
  else if (a >= 0.1) s = String(round(v, 2));
  else if (a === 0) s = '0';
  else s = String(round(v, 3));
  return unit ? `${s} ${unit}` : s;
}

export const fmtKcal = (n) => Math.round(+n || 0).toLocaleString('pl-PL');

/** 1250 → "1,25 l" ; 800 → "800 ml" */
export function fmtVolume(ml) {
  const v = Math.round(+ml || 0);
  return v >= 1000 ? `${(v / 1000).toFixed(2).replace('.', ',')} l` : `${v} ml`;
}

export function fmtDuration(min) {
  const m = Math.round(+min || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/* ---------------- dates ---------------- */

/** Local-time day key (YYYY-MM-DD). Never use toISOString — it shifts by TZ. */
export function dayKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date, n) {
  const d = date instanceof Date ? new Date(date) : parseKey(date);
  d.setDate(d.getDate() + n);
  return d;
}

export const shiftKey = (key, n) => dayKey(addDays(parseKey(key), n));

/** Inclusive list of day keys ending at `endKey`. */
export function keyRange(endKey, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftKey(endKey, -i));
  return out;
}

export const isToday = (key) => key === dayKey();

export const WEEKDAYS_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

export function fmtDate(key, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  try { return parseKey(key).toLocaleDateString('pl-PL', opts); }
  catch { return key; }
}

export function fmtDayLabel(key) {
  if (isToday(key)) return 'Dzisiaj';
  if (key === shiftKey(dayKey(), -1)) return 'Wczoraj';
  if (key === shiftKey(dayKey(), 1)) return 'Jutro';
  return fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const minutesOfDay = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** ISO week number — used to bucket history into weeks. */
export function isoWeek(date) {
  const d = new Date(date instanceof Date ? date : parseKey(date));
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/* ---------------- flow control ---------------- */

export function debounce(fn, ms = 180) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function throttle(fn, ms = 100) {
  let last = 0, timer;
  return (...a) => {
    const now = Date.now();
    const wait = ms - (now - last);
    if (wait <= 0) { last = now; fn(...a); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...a); }, wait); }
  };
}

/**
 * Range inputs draw their travelled portion from a `--pct` custom property,
 * because WebKit offers no pseudo-element for it. Call after injecting markup
 * that contains sliders; while one is being dragged, app.js keeps it current.
 */
export function paintRange(input) {
  if (!input) return;
  const min = +input.min || 0;
  const max = input.max === '' ? 100 : +input.max;
  const span = max - min;
  const pct = span > 0 ? ((+input.value - min) / span) * 100 : 0;
  input.style.setProperty('--pct', `${clamp(pct, 0, 100)}%`);
}

export function paintRanges(root = document) {
  root?.querySelectorAll?.('input[type=range]').forEach(paintRange);
}

export const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Yield to the main thread so long loops never block scrolling. */
export const idle = () => new Promise((r) => (
  'requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 0)
));

/* ---------------- device ---------------- */

export function haptic(kind = 'light') {
  if (!navigator.vibrate) return;
  const map = { light: 8, medium: 14, heavy: 22, ok: [10, 40, 14], err: [22, 60, 22] };
  try { navigator.vibrate(map[kind] ?? 8); } catch { /* ignored */ }
}

export const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** JSON.parse that never throws. */
export function safeParse(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}

/** Deep-ish merge for plain objects (arrays are replaced, not merged). */
export function merge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k]))
      ? merge(base[k], v)
      : v;
  }
  return out;
}

/** Strip Polish diacritics + case for search matching. */
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .trim();
}
