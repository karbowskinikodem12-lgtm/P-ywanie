/* ==========================================================================
   Training view — log sessions and see what they do to the nutrition plan.
   ========================================================================== */

import { esc, clamp, fmtDuration, nowTime, haptic, WEEKDAYS_SHORT, parseKey } from '../../core/utils.js';
import * as store from '../../core/store.js';
import { icon } from '../icons.js';
import * as sheet from '../sheet.js';
import { toastOk } from '../toast.js';
import { listRow, emptyState, sectionTitle, barChart, statCard, tiles } from '../components.js';
import {
  WORKOUT_TYPES, INTENSITIES, getType, burnFor, sweatFor,
  carbNeedFor, loadFor, describeWorkout, formatDistance, swimPace,
} from '../../data/exercise.js';
import { workoutDemand, plannedDailyLoad } from '../../domain/targets.js';
import { trainingScore } from '../../domain/analysis.js';
import { deleteWithUndo } from '../undo.js';

export const id = 'training';
export const title = 'Trening';

let draft = null;

export function render(ctx) {
  const { day, state, history } = ctx;
  const weight = state.profile.weight;
  const demand = workoutDemand(day.workouts, weight);
  const score = trainingScore({ day, training: state.training, history });
  const planned = plannedDailyLoad(state.training);

  const week = history.slice(-7);
  const chartRows = week.map((r) => ({
    key: r.key,
    label: r.key,
    short: WEEKDAYS_SHORT[parseKey(r.key).getDay()],
    value: r.load,
    over: r.load > planned * 1.6,
  }));

  const byType = new Map();
  for (const r of history.slice(-7)) {
    const dayRec = state.days[r.key];
    for (const w of dayRec?.workouts || []) {
      const t = getType(w.type);
      const cur = byType.get(t.id) || { type: t, minutes: 0, distance: 0, kcal: 0, n: 0 };
      cur.minutes += +w.minutes || 0;
      cur.distance += +w.distance || 0;
      cur.kcal += +w.kcal || 0;
      cur.n++;
      byType.set(t.id, cur);
    }
  }

  return `
    ${sectionTitle('Dzisiaj')}
    <section class="glass pad">
      <div class="tiles tiles-3">
        <div class="tile"><b class="num">${demand.minutes}</b><span>minut</span></div>
        <div class="tile"><b class="num">${demand.kcal}</b><span>kcal spalone</span></div>
        <div class="tile"><b class="num">${demand.load}</b><span>load</span></div>
      </div>
      <div class="note" style="margin:14px 4px 0">
        Plan dnia to około <b>${planned}</b> punktów obciążenia. Dzisiaj:
        <b>${demand.load}</b>${demand.load > planned * 1.3 ? ' — mocniej niż zwykle, zadbaj o węglowodany i sen.'
          : demand.load === 0 ? ' — dzień regeneracyjny.' : '.'}
      </div>
    </section>

    ${demand.minutes ? `
      <section class="glass pad" style="margin-top:12px">
        <div class="input-label" style="margin:0 0 10px">Co trening zmienił w celach</div>
        ${tiles([
          { value: `+${demand.kcal}`, label: 'kcal' },
          { value: `+${demand.carbs}`, label: 'węgli g' },
          { value: `+${demand.sweat}`, label: 'wody ml' },
          { value: score.score, label: 'wynik' },
        ])}
      </section>` : ''}

    ${sectionTitle('Sesje', `<button data-action="workout:add">Dodaj</button>`)}
    <div class="glass list">${sessionList(day)}</div>

    ${sectionTitle('Ostatnie 7 dni')}
    <section class="glass chart">
      ${barChart(chartRows, { goal: planned, action: 'history:pick', unit: ' load' })}
      <div class="chart-legend">
        <span><i style="background:var(--grad-primary)"></i>obciążenie dnia</span>
        <span><i style="background:var(--track-strong)"></i>plan (${planned})</span>
      </div>
    </section>

    <div class="stat-grid" style="margin-top:12px">
      ${statCard({ label: 'Sesje w tygodniu', value: score.daysTrained, unit: 'dni' })}
      ${statCard({ label: 'Obciążenie tygodnia', value: score.weekLoad, unit: `/ ${score.weekTarget}` })}
    </div>

    ${byType.size ? `
      ${sectionTitle('Podział na dyscypliny (7 dni)')}
      <div class="glass list">
        ${[...byType.values()].sort((a, b) => b.minutes - a.minutes).map((r) => listRow({
          media: `<div class="wk-icon" style="background:${r.type.color}">${icon(r.type.icon, { size: 24 })}</div>`,
          title: esc(r.type.name),
          meta: `${r.n} ${r.n === 1 ? 'sesja' : 'sesji'} · ${fmtDuration(r.minutes)}${r.distance ? ` · ${formatDistance(r.distance, r.type.distUnit)}` : ''}`,
          value: Math.round(r.kcal),
          valueSub: 'kcal',
        })).join('')}
      </div>` : ''}

    ${sectionTitle('Plan tygodnia')}
    <section class="glass">
      <div class="field">
        <label for="poolH">Woda <span class="hint">godzin tygodniowo</span></label>
        <input id="poolH" data-setting="training.poolHoursWeek" type="number" inputmode="decimal" min="0" max="40" step="0.5" value="${state.training.poolHoursWeek}">
      </div>
      <div class="field">
        <label for="dryH">Ląd <span class="hint">siłownia, bieganie, mobility</span></label>
        <input id="dryH" data-setting="training.dryHoursWeek" type="number" inputmode="decimal" min="0" max="30" step="0.5" value="${state.training.dryHoursWeek}">
      </div>
      <div class="field">
        <label for="phase">Faza</label>
        <select id="phase" data-setting="training.phase">
          ${['off', 'base', 'build', 'peak', 'taper'].map((p) => {
            const names = { off: 'Roztrenowanie', base: 'Baza', build: 'Ciężki blok', peak: 'Szczyt formy', taper: 'Tapering' };
            return `<option value="${p}"${state.training.phase === p ? ' selected' : ''}>${names[p]}</option>`;
          }).join('')}
        </select>
      </div>
    </section>
    <p class="note">Plan tygodnia jest punktem odniesienia: dopóki nie dopiszesz sesji, cele liczą się z niego. Gdy dopiszesz — liczą się z tego, co faktycznie zrobiłeś.</p>
  `;
}

function sessionList(day) {
  if (!day.workouts.length) {
    return emptyState({
      emoji: '🏊',
      title: 'Brak sesji',
      text: 'Dopisz trening, a kalorie, węglowodany i nawodnienie przeliczą się natychmiast.',
      action: 'workout:add',
      actionLabel: 'Dodaj trening',
    });
  }
  return day.workouts.map((w) => {
    const type = getType(w.type);
    const pace = type.id === 'swim' ? swimPace(w.distance, w.minutes) : null;
    return listRow({
      media: `<div class="wk-icon" style="background:${type.color}">${icon(type.icon, { size: 24 })}</div>`,
      title: esc(w.name || type.name),
      meta: `${esc(describeWorkout(w))}${pace ? ` · ${esc(pace)}` : ''}`,
      value: Math.round(w.kcal || 0),
      valueSub: 'kcal',
      action: 'workout:open',
      id: w.id,
    });
  }).join('');
}

/* ==========================================================================
   Workout editor
   ========================================================================== */

/** The four "what this session costs" tiles, shared by paint and live edits. */
function effectTiles(draft2) {
  return `
    <div class="tile"><b class="num">${draft2.kcal}</b><span>kcal</span></div>
    <div class="tile"><b class="num">${carbNeedFor(draft2)}</b><span>węgli g</span></div>
    <div class="tile"><b class="num">${sweatFor(draft2)}</b><span>wody ml</span></div>
    <div class="tile"><b class="num">${loadFor(draft2)}</b><span>load</span></div>`;
}

function openEditor(ctx, workout = null) {
  const weight = ctx.state.profile.weight;
  draft = workout
    ? { ...workout }
    : {
      id: null,
      type: 'swim',
      intensity: 'moderate',
      minutes: 60,
      distance: 2000,
      notes: '',
      time: nowTime(),
      name: '',
    };

  const paint = () => {
    const type = getType(draft.type);
    draft.kcal = burnFor({ ...draft, weight });

    sheet.open(`
      <div class="grab"></div>
      <h2>${workout ? 'Edytuj trening' : 'Nowy trening'}</h2>
      <p class="sheet-sub">Kalorie liczone z MET, masy ciała i intensywności — aktualizują się na żywo.</p>

      <div class="input-label">Rodzaj</div>
      <div class="alts" style="margin-bottom:14px">
        ${WORKOUT_TYPES.map((t) => `
          <button class="chip chip-tap${draft.type === t.id ? ' chip-on' : ''}" data-wtype="${t.id}">
            ${t.emoji} ${esc(t.name)}
          </button>`).join('')}
      </div>

      <div class="input-label">Intensywność</div>
      <div class="seg" role="tablist" style="margin-bottom:14px">
        ${INTENSITIES.map((i) => `
          <button role="tab" aria-selected="${draft.intensity === i.id}" data-wint="${i.id}">${esc(i.name)}</button>`).join('')}
      </div>

      <div class="portion">
        <div class="ph"><span>Czas</span><b class="num" id="wMinLabel">${fmtDuration(draft.minutes)}</b></div>
        <input type="range" id="wMinutes" min="10" max="240" step="5" value="${clamp(draft.minutes, 10, 240)}" aria-label="Czas trwania">
      </div>

      ${type.distUnit ? `
        <div class="portion">
          <div class="ph"><span>Dystans</span><b class="num" id="wDistLabel">${formatDistance(draft.distance || 0, type.distUnit)}</b></div>
          <input type="range" id="wDistance" min="0" max="${type.distUnit === 'm' ? 10000 : 60}"
            step="${type.distStep}" value="${clamp(draft.distance || 0, 0, type.distUnit === 'm' ? 10000 : 60)}" aria-label="Dystans">
        </div>` : ''}

      <div class="input-label">Notatka</div>
      <div class="input-box" style="margin-bottom:14px">
        <textarea id="wNotes" placeholder="np. 8×200 na progu, tętno 165" maxlength="240">${esc(draft.notes || '')}</textarea>
      </div>

      <div class="tiles" id="wTiles">${effectTiles(draft)}</div>

      <div class="sheet-actions">
        <button class="btn btn-primary" id="wSave">${workout ? 'Zapisz' : 'Dodaj trening'}</button>
        ${workout ? `<button class="btn btn-danger btn-block" id="wDelete">Usuń trening</button>`
          : `<button class="btn btn-quiet btn-block" data-action="sheet:close">Anuluj</button>`}
      </div>`, { label: 'Trening' });

    wire();
  };

  const wire = () => {
    const weightNow = ctx.state.profile.weight;
    const refreshTiles = () => {
      draft.kcal = burnFor({ ...draft, weight: weightNow });
      const el = document.getElementById('wTiles');
      if (el) el.innerHTML = effectTiles(draft);
    };

    document.querySelectorAll('[data-wtype]').forEach((b) => b.addEventListener('click', () => {
      draft.type = b.dataset.wtype;
      const t = getType(draft.type);
      // Reset the distance to something sane for the new discipline.
      draft.distance = t.distUnit === 'm' ? 2000 : t.distUnit === 'km' ? 8 : 0;
      haptic('light');
      paint();
    }));

    document.querySelectorAll('[data-wint]').forEach((b) => b.addEventListener('click', () => {
      draft.intensity = b.dataset.wint;
      document.querySelectorAll('[data-wint]').forEach((x) => x.setAttribute('aria-selected', x === b));
      haptic('light');
      refreshTiles();
    }));

    const min = document.getElementById('wMinutes');
    min?.addEventListener('input', () => {
      draft.minutes = +min.value;
      document.getElementById('wMinLabel').textContent = fmtDuration(draft.minutes);
      refreshTiles();
    });

    const dist = document.getElementById('wDistance');
    dist?.addEventListener('input', () => {
      draft.distance = +dist.value;
      document.getElementById('wDistLabel').textContent = formatDistance(draft.distance, getType(draft.type).distUnit);
      refreshTiles();
    });

    document.getElementById('wNotes')?.addEventListener('input', (e) => { draft.notes = e.target.value; });

    document.getElementById('wSave')?.addEventListener('click', () => {
      const record = {
        type: draft.type,
        intensity: draft.intensity,
        minutes: +draft.minutes,
        distance: +draft.distance || 0,
        notes: (draft.notes || '').trim(),
        time: draft.time || nowTime(),
        name: draft.name || '',
        kcal: burnFor({ ...draft, weight: ctx.state.profile.weight }),
      };
      if (workout) store.updateWorkout(workout.id, record, ctx.key);
      else store.addWorkout(record, ctx.key);
      draft = null;
      sheet.close();
      ctx.render();
      toastOk(workout ? 'Trening zaktualizowany' : 'Trening dodany — cele przeliczone');
    });

    document.getElementById('wDelete')?.addEventListener('click', () => {
      draft = null;
      sheet.close();
      deleteWithUndo(ctx, { kind: 'workout', id: workout.id, key: ctx.key, message: 'Trening usunięty' });
    });
  };

  paint();
}

export const actions = {
  'workout:add': (ctx) => openEditor(ctx),
  'workout:open': (ctx, el) => {
    const w = ctx.day.workouts.find((x) => x.id === el.dataset.id);
    if (w) openEditor(ctx, w);
  },
};
