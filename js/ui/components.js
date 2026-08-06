/* ==========================================================================
   Presentational building blocks. Pure functions returning HTML strings —
   interactivity is wired by delegation on [data-action] in app.js.
   ========================================================================== */

import { esc, clamp, round, fmtNum, fmtKcal, fmtVolume } from '../core/utils.js';
import { icon } from './icons.js';

/* ---------------- progress ring ---------------- */

const RING_R = 82;
const RING_C = 2 * Math.PI * RING_R;

export function ring({ pct, over = false, id = '' }) {
  const dash = RING_C * clamp(pct, 0, 1);
  return `
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="grad-ok" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00C7BE"/><stop offset="100%" stop-color="#007AFF"/>
        </linearGradient>
        <linearGradient id="grad-over" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FF9500"/><stop offset="100%" stop-color="#FF453A"/>
        </linearGradient>
      </defs>
      <circle class="ring-track" cx="100" cy="100" r="${RING_R}" stroke-width="15"/>
      <circle ${id ? `id="${id}"` : ''} class="ring-value" cx="100" cy="100" r="${RING_R}" stroke-width="15"
        stroke="url(#${over ? 'grad-over' : 'grad-ok'})"
        stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${(RING_C - dash).toFixed(1)}"/>
    </svg>`;
}

/** Update an already-rendered ring without re-parsing HTML. */
export function updateRing(el, pct, over) {
  if (!el) return;
  el.setAttribute('stroke-dashoffset', (RING_C - RING_C * clamp(pct, 0, 1)).toFixed(1));
  el.setAttribute('stroke', `url(#${over ? 'grad-over' : 'grad-ok'})`);
}

/* ---------------- bars ---------------- */

const MACRO_COLORS = {
  protein: 'var(--grad-protein)',
  carbs: 'var(--grad-carb)',
  fat: 'var(--grad-fat)',
  fiber: 'var(--grad-primary)',
  water: 'var(--grad-water)',
};

export function macroBar({ key, name, value, target, unit = 'g' }) {
  const pct = target > 0 ? (value / target) * 100 : 0;
  const over = pct > 110;
  const grad = MACRO_COLORS[key] || 'var(--grad-primary)';
  return `
    <div class="bar-row">
      <div class="bar-name">${esc(name)}</div>
      <div class="bar-val num">${Math.round(value)} / ${Math.round(target)} ${esc(unit)}</div>
      <div class="bar-track">
        <div class="bar-fill${over ? ' over' : ''}" style="width:${clamp(pct, 0, 100)}%;${over ? '' : `background:${grad}`}"></div>
      </div>
    </div>`;
}

export const macroBars = (rows) => rows.map(macroBar).join('');

/* ---------------- score gauges ---------------- */

const GAUGE_R = 30;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

export function gauge({ value, label, color = 'var(--blue)', action = null }) {
  const v = clamp(value, 0, 100);
  const dash = (GAUGE_C * v) / 100;
  const tone = v >= 80 ? 'var(--green)' : v >= 55 ? color : v >= 35 ? 'var(--orange)' : 'var(--red)';
  return `
    <${action ? 'button' : 'div'} class="gauge"${action ? ` data-action="${action}"` : ''}>
      <div class="g-wrap">
        <svg viewBox="0 0 74 74" aria-hidden="true">
          <circle cx="37" cy="37" r="${GAUGE_R}" fill="none" stroke="var(--track)" stroke-width="7"/>
          <circle cx="37" cy="37" r="${GAUGE_R}" fill="none" stroke="${tone}" stroke-width="7"
            stroke-linecap="round" transform="rotate(-90 37 37)"
            stroke-dasharray="${GAUGE_C.toFixed(1)}" stroke-dashoffset="${(GAUGE_C - dash).toFixed(1)}"
            style="transition:stroke-dashoffset .7s var(--ease)"/>
        </svg>
        <div class="g-num num">${Math.round(v)}</div>
      </div>
      <div class="g-lbl">${esc(label)}</div>
    </${action ? 'button' : 'div'}>`;
}

/* ---------------- tiles ---------------- */

export const tile = ({ value, label, unit = '' }) =>
  `<div class="tile"><b class="num">${esc(String(value))}${unit ? `<span style="font-size:12px"> ${esc(unit)}</span>` : ''}</b><span>${esc(label)}</span></div>`;

export const tiles = (rows, cls = '') => `<div class="tiles ${cls}">${rows.map(tile).join('')}</div>`;

export function statCard({ label, value, unit = '', delta = null, deltaLabel = '' }) {
  const dir = delta == null ? null : delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';
  return `
    <div class="stat-card">
      <div class="lbl">${esc(label)}</div>
      <div class="num-lg num">${esc(String(value))}<span style="font-size:14px;font-weight:600"> ${esc(unit)}</span></div>
      ${dir ? `<div class="delta ${dir}">${delta > 0 ? '+' : ''}${delta}% ${esc(deltaLabel)}</div>` : ''}
    </div>`;
}

/* ---------------- chips ---------------- */

export function confidenceChip(conf, engine) {
  const pct = Math.round(clamp(conf, 0, 1) * 100);
  const cls = pct >= 75 ? 'chip-hi' : pct >= 45 ? 'chip-mid' : 'chip-lo';
  const label = pct >= 75 ? 'pewne' : pct >= 45 ? 'prawdopodobne' : 'zgadywane';
  return `<span class="chip ${cls}">${label} · ${pct}%${engine ? ` · ${esc(engine)}` : ''}</span>`;
}

export const chip = (text, cls = '') => `<span class="chip ${cls}">${esc(text)}</span>`;

/* ---------------- list rows ---------------- */

export function listRow({ media, title, meta, value, valueSub, action = '', id = '', tap = true }) {
  return `
    <${action ? 'button' : 'div'} class="item${media ? ' has-media' : ''}${tap && action ? ' item-tap' : ''}"
      ${action ? `data-action="${action}"` : ''} ${id ? `data-id="${esc(id)}"` : ''}>
      ${media || ''}
      <div class="grow">
        <div class="title t-ellipsis">${title}</div>
        ${meta ? `<div class="meta t-ellipsis">${meta}</div>` : ''}
      </div>
      ${value != null ? `<div class="value num">${value}${valueSub ? `<small>${esc(valueSub)}</small>` : ''}</div>` : ''}
    </${action ? 'button' : 'div'}>`;
}

export const thumb = (src, emoji = '🍽️') => (src
  ? `<img class="thumb" src="${esc(src)}" alt="" loading="lazy" decoding="async">`
  : `<div class="thumb-ph" aria-hidden="true">${emoji}</div>`);

export function emptyState({ emoji = '✨', title, text, action = null, actionLabel = '' }) {
  return `
    <div class="empty">
      <span class="emoji">${emoji}</span>
      <b>${esc(title)}</b>
      <span>${esc(text)}</span>
      ${action ? `<button class="btn btn-quiet btn-sm" style="margin:14px auto 0" data-action="${action}">${esc(actionLabel)}</button>` : ''}
    </div>`;
}

/* ---------------- charts ---------------- */

/**
 * Vertical bar chart. `rows` = [{label, value, key, over}]. A dashed goal line
 * is drawn when `goal` is supplied.
 */
export function barChart(rows, { goal = null, selected = null, action = null, height = 128, unit = '' } = {}) {
  const max = Math.max(goal || 0, ...rows.map((r) => r.value), 1) * 1.08;
  const goalTop = goal ? (1 - goal / max) * height : null;
  return `
    <div class="chart-bars" style="height:${height}px">
      ${goalTop != null ? `<div class="chart-goal"><i style="top:${goalTop.toFixed(1)}px"></i></div>` : ''}
      ${rows.map((r) => {
        const h = Math.max(r.value > 0 ? 4 : 3, (r.value / max) * height);
        const cls = [r.value ? '' : 'none', r.over ? 'over' : '', selected === r.key ? 'sel' : ''].filter(Boolean).join(' ');
        return `<div class="col"${action ? ` data-action="${action}" data-key="${esc(r.key || '')}" role="button" tabindex="0"` : ''}
            title="${esc(r.label)}: ${Math.round(r.value)}${esc(unit)}">
            <div class="bar ${cls}" style="height:${h.toFixed(1)}px"></div>
            <small>${esc(r.short ?? r.label)}</small>
          </div>`;
      }).join('')}
    </div>`;
}

/** Smooth sparkline with a soft area fill. */
export function sparkline(values, { color = 'var(--blue)', height = 56, width = 300 } = {}) {
  const vals = values.filter((v) => v != null);
  if (vals.length < 2) return '<div class="t-sub t-sm" style="padding:12px 4px">Za mało danych, żeby narysować trend.</div>';

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = width / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, height - ((v - min) / span) * (height - 8) - 4]);

  // Catmull-Rom → cubic Bézier for a natural curve without a charting library.
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${width},${height} L0,${height} Z`;

  return `
    <svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path class="area" d="${area}" fill="${color}"/>
      <path class="line" d="${d}" stroke="${color}"/>
    </svg>`;
}

/* ---------------- nutrient rows ---------------- */

export function nutrientRow(status) {
  const { def, value, target, pct, state } = status;
  const cls = state === 'crit' ? 'crit' : state === 'low' ? 'low' : state === 'over' || state === 'high' ? 'over' : '';
  const flag = state === 'crit' ? '<span class="nut-flag chip-lo">niedobór</span>'
    : state === 'over' ? '<span class="nut-flag chip-mid">powyżej normy</span>' : '';
  return `
    <div class="nut-row">
      <div class="nut-name">${esc(def.short || def.name)} <i>${esc(def.unit)}</i> ${flag}</div>
      <div class="nut-val num">${fmtNum(value)} / ${fmtNum(target)} · ${Math.round(pct)}%</div>
      <div class="nut-track"><div class="nut-fill ${cls}" style="width:${clamp(pct, 0, 100)}%"></div></div>
    </div>`;
}

/* ---------------- misc ---------------- */

export const sectionTitle = (text, right = '') =>
  `<div class="section-title"><span>${esc(text)}</span>${right}</div>`;

export const callout = (kind, text, iconName = 'info') =>
  `<div class="callout callout-${kind}">${icon(iconName, { size: 18 })}<div>${text}</div></div>`;

export const spinnerBlock = (text, step = '') => `
  <div class="analyzing">
    <div class="ripple"><i></i><i></i><i></i></div>
    <p>${esc(text)}</p>
    <div class="step" id="progressStep">${esc(step)}</div>
    <div class="progress-line"><i id="progressBar"></i></div>
  </div>`;

export { fmtKcal, fmtVolume, fmtNum, round };
