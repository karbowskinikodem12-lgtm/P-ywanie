/* ==========================================================================
   History — days, weeks, months, trends, search and the restore bin.
   ========================================================================== */

import {
  esc, clamp, round, fmtVolume, fmtDate, fmtDayLabel, dayKey, shiftKey, parseKey,
  WEEKDAYS_SHORT, normalize, debounce, isoWeek,
} from '../../core/utils.js';
import * as store from '../../core/store.js';
import { icon } from '../icons.js';
import * as sheet from '../sheet.js';
import { toast, toastOk } from '../toast.js';
import {
  sectionTitle, barChart, sparkline, statCard, listRow, thumb, emptyState, tiles,
} from '../components.js';
import { aggregate, trend, dayTotals, microScore, chronicGaps } from '../../domain/analysis.js';
import { getType, describeWorkout } from '../../data/exercise.js';
import { NUTRIENTS } from '../../data/nutrients.js';

export const id = 'history';
export const title = 'Historia';

const RANGES = [
  { id: 7, label: 'Tydzień' },
  { id: 30, label: 'Miesiąc' },
  { id: 90, label: '3 miesiące' },
];

let range = 7;
let query = '';
let filterType = 'all';   // all | photo | manual | workout

export function render(ctx) {
  const rows = ctx.historyFor(range);
  const stats = aggregate(rows);
  const prevRows = ctx.historyFor(range * 2).slice(0, range);
  const prevStats = aggregate(prevRows);

  const kcalDelta = prevStats.avgKcal ? round(((stats.avgKcal - prevStats.avgKcal) / prevStats.avgKcal) * 100, 1) : null;
  const loadDelta = prevStats.totalLoad ? round(((stats.totalLoad - prevStats.totalLoad) / prevStats.totalLoad) * 100, 1) : null;

  return `
    <div class="seg" role="tablist">
      ${RANGES.map((r) => `<button role="tab" aria-selected="${range === r.id}" data-action="history:range" data-range="${r.id}">${r.label}</button>`).join('')}
    </div>

    ${calendarStrip(ctx)}

    <div class="stat-grid" style="margin-top:6px">
      ${statCard({ label: 'Średnio kcal', value: stats.avgKcal || '—', delta: kcalDelta, deltaLabel: 'vs poprzedni okres' })}
      ${statCard({ label: 'Średnio białka', value: stats.avgProtein || '—', unit: 'g' })}
      ${statCard({ label: 'Nawodnienie', value: stats.avgWater ? fmtVolume(stats.avgWater) : '—' })}
      ${statCard({ label: 'Obciążenie', value: stats.totalLoad, delta: loadDelta, deltaLabel: 'vs poprzedni okres' })}
    </div>

    ${sectionTitle('Kalorie dzień po dniu')}
    <section class="glass chart">
      ${barChart(kcalRows(rows, ctx), { goal: ctx.targets.kcal, selected: ctx.key, action: 'history:pick', unit: ' kcal' })}
      <div class="chart-legend">
        <span><i style="background:var(--grad-primary)"></i>spożycie</span>
        <span><i style="background:var(--track-strong)"></i>cel (${Math.round(ctx.targets.kcal)})</span>
      </div>
    </section>

    ${sectionTitle('Trendy')}
    <section class="glass pad">
      ${trendBlock('Kalorie', rows.map((r) => (r.empty ? null : r.kcal)), 'var(--blue)', trend(rows, (r) => (r.empty ? null : r.kcal)), 'kcal/dzień')}
      ${trendBlock('Białko', rows.map((r) => (r.empty ? null : r.protein)), 'var(--pink)', trend(rows, (r) => (r.empty ? null : r.protein)), 'g/dzień')}
      ${trendBlock('Nawodnienie', rows.map((r) => r.water || null), 'var(--teal)', trend(rows, (r) => r.water || null), 'ml/dzień')}
      ${trendBlock('Obciążenie', rows.map((r) => r.load || null), 'var(--purple)', trend(rows, (r) => r.load || null), 'load/dzień')}
      ${rows.some((r) => r.micro != null) ? trendBlock('Mikroskładniki', rows.map((r) => r.micro), 'var(--mint)', trend(rows, (r) => r.micro), 'pkt') : ''}
      ${rows.some((r) => r.weight) ? trendBlock('Masa ciała', rows.map((r) => r.weight), 'var(--orange)', trend(rows, (r) => r.weight), 'kg') : ''}
    </section>

    ${weeklyTable(rows)}

    ${sectionTitle('Szukaj w posiłkach')}
    <section class="glass pad">
      <div class="search-box" style="margin-bottom:10px">
        ${icon('search', { size: 17 })}
        <input id="histSearch" type="search" placeholder="np. owsianka, kurczak" value="${esc(query)}" autocomplete="off">
      </div>
      <div class="alts">
        ${[['all', 'Wszystko'], ['photo', 'Ze zdjęcia'], ['manual', 'Ręczne'], ['workout', 'Treningi']].map(([id2, label]) =>
          `<button class="chip chip-tap${filterType === id2 ? ' chip-on' : ''}" data-action="history:filter" data-filter="${id2}">${label}</button>`).join('')}
      </div>
    </section>
    <div class="glass list" style="margin-top:10px">${searchResults(ctx)}</div>

    ${trashSection(ctx)}
  `;
}

function kcalRows(rows, ctx) {
  return rows.map((r) => ({
    key: r.key,
    label: fmtDate(r.key, { day: 'numeric', month: 'short' }),
    short: rows.length > 14
      ? (parseKey(r.key).getDate() % 5 === 0 ? String(parseKey(r.key).getDate()) : '')
      : WEEKDAYS_SHORT[parseKey(r.key).getDay()],
    value: r.kcal,
    over: r.kcal > ctx.targets.kcal * 1.12,
  }));
}

function calendarStrip(ctx) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const key = shiftKey(dayKey(), -i);
    const d = parseKey(key);
    const has = store.hasDay(key);
    days.push(`
      <button class="cal-day" aria-selected="${ctx.key === key}" data-action="history:pick" data-key="${key}">
        <div class="dw">${WEEKDAYS_SHORT[d.getDay()]}</div>
        <div class="dn">${d.getDate()}</div>
        <div class="dot${has ? '' : ' off'}"></div>
      </button>`);
  }
  return `<div class="cal-strip">${days.join('')}</div>`;
}

function trendBlock(label, values, color, delta, unit) {
  const dir = delta == null ? 'flat' : delta > 2 ? 'up' : delta < -2 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  return `
    <div style="margin-bottom:16px">
      <div class="spread" style="margin-bottom:2px">
        <span class="t-bold t-md">${esc(label)}</span>
        <span class="delta ${dir}">${delta == null ? '—' : `${arrow} ${Math.abs(delta)}%`} <span class="t-sub" style="font-weight:500">${esc(unit)}</span></span>
      </div>
      ${sparkline(values, { color })}
    </div>`;
}

function weeklyTable(rows) {
  if (rows.length <= 7) return '';
  const weeks = new Map();
  for (const r of rows) {
    const w = isoWeek(r.key);
    const cur = weeks.get(w) || { week: w, kcal: 0, load: 0, days: 0, water: 0, active: 0 };
    cur.kcal += r.kcal;
    cur.load += r.load;
    cur.water += r.water;
    cur.days++;
    if (!r.empty) cur.active++;
    weeks.set(w, cur);
  }
  const list = [...weeks.values()].slice(-8);
  return `
    ${sectionTitle('Tydzień po tygodniu')}
    <div class="glass list">
      ${list.map((w) => listRow({
        title: `Tydzień ${w.week}`,
        meta: `${w.active} z ${w.days} dni z wpisami · ${fmtVolume(Math.round(w.water / Math.max(1, w.days)))} wody dziennie`,
        value: Math.round(w.kcal / Math.max(1, w.active || 1)),
        valueSub: 'kcal/dzień',
      })).join('')}
    </div>`;
}

/* ---------------- search ---------------- */

function searchResults(ctx) {
  const q = normalize(query);
  const out = [];
  const keys = Object.keys(ctx.state.days).sort().reverse();

  for (const key of keys) {
    const day = ctx.state.days[key];
    if (filterType !== 'workout') {
      for (const m of day.meals || []) {
        if (filterType === 'photo' && !m.thumb) continue;
        if (filterType === 'manual' && m.thumb) continue;
        if (q && !normalize(`${m.name} ${(m.items || []).map((i) => i.name).join(' ')}`).includes(q)) continue;
        out.push({ kind: 'meal', key, item: m });
      }
    }
    if (filterType === 'all' || filterType === 'workout') {
      for (const w of day.workouts || []) {
        const t = getType(w.type);
        if (q && !normalize(`${t.name} ${w.notes || ''}`).includes(q)) continue;
        out.push({ kind: 'workout', key, item: w });
      }
    }
    if (out.length > 60) break;
  }

  if (!out.length) {
    return emptyState({
      emoji: '🗂️',
      title: q ? 'Brak wyników' : 'Pusto',
      text: q ? 'Spróbuj krótszej frazy.' : 'Zapisane posiłki i treningi pojawią się tutaj.',
    });
  }

  return out.slice(0, 40).map((row) => {
    if (row.kind === 'meal') {
      const m = row.item;
      return listRow({
        media: thumb(m.thumb, '🍽️'),
        title: esc(m.name),
        meta: `${fmtDayLabel(row.key)} · ${esc(m.time || '')} · ${Math.round(m.grams || 0)} g`,
        value: Math.round(m.totals?.kcal || 0),
        valueSub: 'kcal',
        action: 'history:openMeal',
        id: `${row.key}|${m.id}`,
      });
    }
    const w = row.item;
    const t = getType(w.type);
    return listRow({
      media: `<div class="wk-icon" style="background:${t.color}">${icon(t.icon, { size: 24 })}</div>`,
      title: esc(t.name),
      meta: `${fmtDayLabel(row.key)} · ${esc(describeWorkout(w))}`,
      value: Math.round(w.kcal || 0),
      valueSub: 'kcal',
      action: 'history:openDay',
      id: row.key,
    });
  }).join('');
}

/* ---------------- trash ---------------- */

function trashSection(ctx) {
  const trash = ctx.state.trash.slice().reverse();
  if (!trash.length) return '';
  return `
    ${sectionTitle('Kosz', `<button data-action="history:emptyTrash">Wyczyść</button>`)}
    <div class="glass list">
      ${trash.slice(0, 12).map((t) => {
        const label = t.kind === 'meal' ? t.item.name : t.kind === 'workout' ? getType(t.item.type).name : 'Cały dzień';
        const when = new Date(t.at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return listRow({
          title: esc(label),
          meta: `${fmtDayLabel(t.key)} · usunięto ${when}`,
          value: `<span class="chip chip-blue">Przywróć</span>`,
          action: 'history:restore',
          id: t.id,
        });
      }).join('')}
    </div>
    <p class="note trash-note">Usunięte wpisy trzymamy 30 dni, potem znikają automatycznie.</p>`;
}

/* ---------------- day detail ---------------- */

function openDay(ctx, key) {
  const day = ctx.state.days[key];
  const totals = dayTotals(day || {});
  const targets = ctx.targetsFor(key);

  sheet.open(`
    <div class="grab"></div>
    <h2>${esc(fmtDayLabel(key))}</h2>
    <p class="sheet-sub">${esc(fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>

    ${tiles([
      { value: Math.round(totals.kcal), label: 'kcal' },
      { value: Math.round(totals.protein), label: 'białko g' },
      { value: Math.round(totals.carbs), label: 'węgle g' },
      { value: Math.round(totals.fat), label: 'tłuszcz g' },
    ])}

    <div class="tiles tiles-3" style="margin-top:8px">
      <div class="tile"><b class="num">${fmtVolume(totals.water)}</b><span>woda</span></div>
      <div class="tile"><b class="num">${totals.load}</b><span>load</span></div>
      <div class="tile"><b class="num">${microScore(totals, targets)}</b><span>mikro</span></div>
    </div>

    ${day?.meals?.length ? `
      <div class="input-label" style="margin-top:16px">Posiłki</div>
      <div class="glass list" style="background:var(--fill);box-shadow:none">
        ${day.meals.map((m) => listRow({
          media: thumb(m.thumb, '🍽️'),
          title: esc(m.name),
          meta: `${esc(m.time || '')} · ${Math.round(m.grams || 0)} g`,
          value: Math.round(m.totals?.kcal || 0),
          valueSub: 'kcal',
        })).join('')}
      </div>` : '<p class="note">Brak posiłków tego dnia.</p>'}

    ${day?.workouts?.length ? `
      <div class="input-label" style="margin-top:16px">Treningi</div>
      <div class="glass list" style="background:var(--fill);box-shadow:none">
        ${day.workouts.map((w) => {
          const t = getType(w.type);
          return listRow({
            media: `<div class="wk-icon" style="background:${t.color}">${icon(t.icon, { size: 24 })}</div>`,
            title: esc(t.name),
            meta: esc(describeWorkout(w)),
            value: Math.round(w.kcal || 0),
            valueSub: 'kcal',
          });
        }).join('')}
      </div>` : ''}

    <div class="sheet-actions">
      <button class="btn btn-primary" data-action="history:goto" data-key="${key}">Otwórz ten dzień</button>
      <button class="btn btn-quiet btn-block" data-action="sheet:close">Zamknij</button>
    </div>`, { label: 'Dzień' });
}

/* ---------------- wiring ---------------- */

export function afterRender(ctx) {
  const input = document.getElementById('histSearch');
  if (!input) return;
  const onInput = debounce(() => {
    query = input.value;
    const list = input.closest('.view')?.querySelector('.glass.list');
    ctx.render({ keepScroll: true, focus: 'histSearch' });
  }, 200);
  input.addEventListener('input', onInput);
}

export const actions = {
  'history:range': (ctx, el) => { range = +el.dataset.range; ctx.render(); },
  'history:filter': (ctx, el) => { filterType = el.dataset.filter; ctx.render(); },
  'history:pick': (ctx, el) => {
    const key = el.dataset.key || el.closest('[data-key]')?.dataset.key;
    if (key) openDay(ctx, key);
  },
  'history:openDay': (ctx, el) => openDay(ctx, el.dataset.id),
  'history:goto': (ctx, el) => {
    sheet.close();
    ctx.setKey(el.dataset.key);
    ctx.go('day');
  },
  'history:openMeal': (ctx, el) => {
    const [key, mealId] = String(el.dataset.id).split('|');
    ctx.setKey(key);
    ctx.go('day');
    // Give the day view a frame to mount before opening the editor on it.
    requestAnimationFrame(() => ctx.dispatch('meal:open', { dataset: { id: mealId } }));
  },
  'history:restore': (ctx, el) => {
    if (store.restoreTrash(el.dataset.id)) {
      toastOk('Przywrócono');
      ctx.render();
    }
  },
  'history:emptyTrash': (ctx) => {
    store.emptyTrash();
    toast('Kosz wyczyszczony');
    ctx.render();
  },
};
