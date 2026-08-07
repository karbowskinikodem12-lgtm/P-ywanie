/* ==========================================================================
   Dashboard — everything about today on one screen.
   ========================================================================== */

import { esc, clamp, fmtVolume, haptic } from '../../core/utils.js';
import * as store from '../../core/store.js';
import { icon } from '../icons.js';
import {
  ring, macroBars, gauge, listRow, thumb, emptyState, sectionTitle, adviceList, workoutRow,
} from '../components.js';
import { coachLine, recommendations, microScore, recoveryScore, trainingScore, nutrientIssues } from '../../domain/analysis.js';
import { toast } from '../toast.js';

export const id = 'day';
export const title = 'Dzisiaj';

export function render(ctx) {
  const { totals, targets, day, state } = ctx;
  const left = targets.kcal - totals.kcal;
  const pct = targets.kcal ? totals.kcal / targets.kcal : 0;
  const over = pct > 1.08;

  const micro = microScore(totals, targets);
  const recovery = recoveryScore({ totals, targets, day, history: ctx.history });
  const training = trainingScore({ day, training: state.training, history: ctx.history });
  const issues = nutrientIssues(totals, targets, { mealCount: totals.meals });
  const tips = recommendations({ totals, targets, day, issues, training: state.training }, 2);

  return `
    <section class="glass hero">
      <div class="level${over ? ' over' : ''}" style="height:${clamp(pct, 0, 1.02) * 100}%" aria-hidden="true">
        <div class="wave"></div><div class="wave b"></div>
      </div>

      <div class="ring-wrap">
        ${ring({ pct: clamp(pct, 0, 1), over, id: 'kcalRing' })}
        <div class="ring-face">
          <div class="big num${left < 0 ? ' over' : ''}">${Math.abs(Math.round(left))}</div>
          <div class="cap">${left >= 0 ? 'kcal do celu' : 'kcal ponad cel'}</div>
          <div class="sub-cap">${Math.round(totals.kcal)} z ${Math.round(targets.kcal)} kcal${totals.burn ? ` · spalone ${Math.round(totals.burn)}` : ''}</div>
        </div>
      </div>

      <div class="bars">
        ${macroBars([
          { key: 'protein', name: 'Białko', value: totals.protein, target: targets.protein },
          { key: 'carbs', name: 'Węglowodany', value: totals.carbs, target: targets.carbs },
          { key: 'fat', name: 'Tłuszcz', value: totals.fat, target: targets.fat },
          { key: 'fiber', name: 'Błonnik', value: totals.fiber, target: targets.fiber },
        ])}
      </div>

      <div class="coach">
        ${icon('bulb', { size: 17 })}
        <div>${coachLine({ totals, targets, day })}</div>
      </div>
    </section>

    <div class="quick">
      <button data-action="water:add">${icon('drop')}<span>+${state.settings.glassSize} ml</span></button>
      <button data-action="workout:add">${icon('swim')}<span>Trening</span></button>
    </div>

    <section class="glass scores" style="margin-top:12px">
      <div class="gauges">
        ${gauge({ value: micro, label: 'Mikroskładniki', color: 'var(--mint)', action: 'go:micro' })}
        ${gauge({ value: recovery.score, label: 'Regeneracja', color: 'var(--blue)', action: 'scores:recovery' })}
        ${gauge({ value: training.score, label: 'Trening', color: 'var(--purple)', action: 'go:training' })}
      </div>
      <div class="hint">${scoreHint(recovery, training, micro)}</div>
    </section>

    ${waterCard(ctx)}

    ${tips.length ? `${sectionTitle('Na teraz')}${adviceList(tips)}` : ''}

    ${sectionTitle('Trening', day.workouts.length ? `<button data-action="workout:add">Dodaj</button>` : '')}
    <div class="glass list">${workoutList(day)}</div>

    ${sectionTitle('Posiłki', mealSummary(day))}
    <div class="glass list">${mealList(day)}</div>
  `;
}

function scoreHint(recovery, training, micro) {
  if (recovery.flag === 'ramp') {
    return `Obciążenie ostatnich 7 dni jest o ${Math.round((recovery.acr - 1) * 100)}% wyższe niż średnia z miesiąca. Zadbaj o sen i węglowodany.`;
  }
  const weakest = recovery.parts.slice().sort((a, b) => a.value - b.value)[0];
  if (recovery.score < 60 && weakest) {
    return `Regenerację najmocniej ciągnie w dół: ${weakest.name.toLowerCase()} (${weakest.pct}%).`;
  }
  if (micro < 55) return 'Mikroskładniki poniżej normy — sprawdź zakładkę Mikro, które dokładnie.';
  if (training.todayLoad === 0) return 'Dzień bez treningu. Cele kaloryczne są już do tego dopasowane.';
  return 'Wszystkie trzy wskaźniki liczą się z dzisiejszych wpisów i aktualizują na bieżąco.';
}

function waterCard(ctx) {
  const { totals, targets, state } = ctx;
  const glass = state.settings.glassSize || 250;
  const glasses = Math.ceil(targets.water / glass);
  const filled = Math.floor(totals.water / glass);
  const dots = Array.from({ length: Math.min(glasses, 16) }, (_, i) =>
    `<div class="glass-dot${i < filled ? ' full' : ''}"></div>`).join('');

  return `
    ${sectionTitle('Nawodnienie')}
    <section class="glass water-card">
      <div class="water-head">
        <b class="num">${fmtVolume(totals.water)}</b>
        <span class="g num">cel ${fmtVolume(targets.water)}</span>
      </div>
      <div class="glasses">${dots}</div>
      <div class="water-actions">
        <button class="btn btn-quiet btn-sm" data-action="water:add" data-ml="${glass}">+${glass} ml</button>
        <button class="btn btn-quiet btn-sm" data-action="water:add" data-ml="500">+500 ml</button>
        <button class="btn btn-quiet btn-sm" data-action="water:undo" aria-label="Cofnij ostatnią porcję">${icon('undo', { size: 18 })}</button>
      </div>
    </section>`;
}

function workoutList(day) {
  if (!day.workouts.length) {
    return emptyState({
      emoji: '🏊',
      title: 'Brak treningu',
      text: 'Dopisz sesję, a cele kaloryczne i nawodnienie przeliczą się same.',
      action: 'workout:add',
      actionLabel: 'Dodaj trening',
    });
  }
  return day.workouts
    .map((w) => workoutRow(w, { action: 'workout:open', extraMeta: w.notes ? ` · ${esc(w.notes)}` : '' }))
    .join('');
}

function mealSummary(day) {
  if (!day.meals.length) return '';
  const n = day.meals.length;
  const word = n === 1 ? 'posiłek' : n < 5 ? 'posiłki' : 'posiłków';
  return `<span>${n} ${word}</span>`;
}

function mealList(day) {
  if (!day.meals.length) {
    return emptyState({
      emoji: '📷',
      title: 'Jeszcze pusto',
      text: 'Zrób zdjęcie pierwszego posiłku — składniki i mikroskładniki policzą się same.',
      action: 'capture:photo',
      actionLabel: 'Zrób zdjęcie',
    });
  }
  return day.meals
    .slice()
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .map((m) => listRow({
      media: thumb(m, '🍽️'),
      title: esc(m.name),
      meta: `${esc(m.time || '')} · ${Math.round(m.grams || 0)} g · B ${Math.round(m.totals?.protein || 0)} / W ${Math.round(m.totals?.carbs || 0)} / T ${Math.round(m.totals?.fat || 0)}`,
      value: Math.round(m.totals?.kcal || 0),
      valueSub: 'kcal',
      action: 'meal:open',
      id: m.id,
    })).join('');
}

/* ---------------- actions owned by this view ---------------- */

export const actions = {
  'water:add': (ctx, el) => {
    const ml = +el?.dataset.ml || ctx.state.settings.glassSize || 250;
    store.addWater(ml, ctx.key);
    haptic('light');
  },
  'water:undo': (ctx) => {
    if (store.undoWater(ctx.key)) toast('Cofnięto ostatnią porcję');
  },
  'scores:recovery': (ctx) => {
    const rec = recoveryScore({ totals: ctx.totals, targets: ctx.targets, day: ctx.day, history: ctx.history });
    ctx.openSheet(`
      <div class="grab"></div>
      <h2>Regeneracja ${rec.score}/100</h2>
      <p class="sheet-sub">Składowe liczone z dzisiejszych wpisów. Waga każdej z nich odzwierciedla jej realny wpływ na jutrzejszy trening.</p>
      ${rec.parts.map((p) => `
        <div class="bar-row">
          <div class="bar-name">${esc(p.name)}</div>
          <div class="bar-val num">${p.pct}%</div>
          <div class="bar-track thin"><div class="bar-fill" style="width:${clamp(p.pct, 0, 100)}%"></div></div>
        </div>`).join('')}
      ${rec.acr ? `<p class="note">Stosunek obciążenia 7 do 28 dni: <b>${rec.acr}</b>. Bezpieczny zakres to 0,8–1,3.</p>` : ''}
      <div class="sheet-actions">
        <button class="btn btn-quiet" data-action="sheet:close">Zamknij</button>
      </div>`, { label: 'Regeneracja' });
  },
};
