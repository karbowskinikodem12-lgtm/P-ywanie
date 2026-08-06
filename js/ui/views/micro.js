/* ==========================================================================
   Micronutrients — full 31-nutrient breakdown with deficiencies, excesses
   and concrete fixes.
   ========================================================================== */

import { esc, clamp } from '../../core/utils.js';
import { icon } from '../icons.js';
import * as sheet from '../sheet.js';
import { nutrientRow, sectionTitle, gauge, callout, emptyState } from '../components.js';
import {
  NUTRIENTS, VITAMIN_KEYS, MINERAL_KEYS, MACRO_KEYS, FAT_KEYS,
} from '../../data/nutrients.js';
import { statusOf, microScore, nutrientIssues, recommendations, chronicGaps } from '../../domain/analysis.js';

export const id = 'micro';
export const title = 'Mikroskładniki';

let tab = 'vit';   // vit | min | macro

export function render(ctx) {
  const { totals, targets, day, history } = ctx;
  const score = microScore(totals, targets);
  const issues = nutrientIssues(totals, targets, { mealCount: totals.meals });
  const tips = recommendations({ totals, targets, day, issues }, 4);
  const gaps = chronicGaps(history);

  if (!totals.meals) {
    return `
      <div class="glass" style="padding:6px 0">
        ${emptyState({
          emoji: '🍊',
          title: 'Brak danych na dziś',
          text: 'Dodaj pierwszy posiłek — wtedy policzę wszystkie 31 składników i pokażę, czego brakuje.',
          action: 'capture:photo',
          actionLabel: 'Zrób zdjęcie',
        })}
      </div>
      ${gaps.length ? chronicSection(gaps) : ''}`;
  }

  const keys = tab === 'vit' ? VITAMIN_KEYS : tab === 'min' ? MINERAL_KEYS : [...MACRO_KEYS, ...FAT_KEYS];

  return `
    <section class="glass pad-lg">
      <div class="gauges" style="grid-template-columns:1fr">
        ${gauge({ value: score, label: 'Wynik mikroskładników', color: 'var(--mint)' })}
      </div>
      <p class="hint t-center t-sm t-sub" style="margin-top:12px">
        ${scoreCopy(score, issues)}
      </p>
    </section>

    ${issues.low.length || issues.high.length ? `
      ${sectionTitle('Wymaga uwagi')}
      <div class="advice">
        ${issues.low.slice(0, 3).map((s) => flagRow(s, 'low')).join('')}
        ${issues.high.slice(0, 2).map((s) => flagRow(s, 'high')).join('')}
      </div>` : `
      ${sectionTitle('Stan')}
      ${callout('ok', 'Wszystkie mikroskładniki w normie. Tak trzymaj.', 'checkCircle')}`}

    ${sectionTitle('Wszystkie składniki')}
    <div class="seg" role="tablist">
      <button role="tab" aria-selected="${tab === 'vit'}" data-action="micro:tab" data-tab="vit">Witaminy</button>
      <button role="tab" aria-selected="${tab === 'min'}" data-action="micro:tab" data-tab="min">Minerały</button>
      <button role="tab" aria-selected="${tab === 'macro'}" data-action="micro:tab" data-tab="macro">Makro i tłuszcze</button>
    </div>
    <section class="glass nut-group">
      ${keys.map((k) => {
        const s = statusOf(k, totals[k], targets[k]);
        return `<button style="display:block;width:100%;text-align:left" data-action="micro:detail" data-key="${k}">${nutrientRow(s)}</button>`;
      }).join('')}
    </section>

    ${tips.length ? `
      ${sectionTitle('Co z tym zrobić')}
      <div class="advice">
        ${tips.map((t) => `
          <div class="advice-item">
            <span class="ic">${t.icon}</span>
            <div><b>${esc(t.title)}</b><div class="fix">${esc(t.fix)}</div></div>
          </div>`).join('')}
      </div>` : ''}

    ${gaps.length ? chronicSection(gaps) : ''}

    <p class="note">
      Wartości mikroskładników pochodzą z tabel składu produktów i są szacunkami dla typowej porcji —
      świetne do wyłapania trendu, nie do rozliczania się co do miligrama. Jeśli coś siedzi poniżej
      50% przez kilka dni z rzędu, to sygnał do rozmowy z dietetykiem, a nie do paniki.
    </p>`;
}

function scoreCopy(score, issues) {
  if (score >= 85) return 'Prawie komplet. Dieta pokrywa niemal wszystkie witaminy i minerały.';
  if (score >= 65) return `Solidnie, ale ${issues.low.length} ${issues.low.length === 1 ? 'składnik jest' : 'składniki są'} poniżej normy.`;
  if (score >= 45) return 'Sporo braków — najczęściej wystarczy dołożyć warzywa, nabiał i pełne ziarno.';
  return 'Dużo luk. Zacznij od dwóch najniższych pozycji poniżej — reszta zwykle podciąga się sama.';
}

function flagRow(s, kind) {
  const def = s.def;
  const fix = kind === 'low'
    ? `${def.role} Uzupełnisz: ${def.sources.slice(0, 3).join(', ') || 'urozmaiceniem diety'}.`
    : def.limit
      ? 'Patrz na średnią tygodniową, jeden dzień niczego nie przesądza.'
      : 'Powyżej górnego bezpiecznego poziomu — sprawdź, czy nie dublujesz suplementu.';
  return `
    <button class="advice-item" style="width:100%;text-align:left" data-action="micro:detail" data-key="${def.key}">
      <span class="ic">${kind === 'low' ? (def.kind === 'vitamin' ? '🍊' : '🧲') : '🔺'}</span>
      <div>
        <b>${esc(def.name)} — ${Math.round(s.pct)}% normy</b>
        <div class="fix">${esc(fix)}</div>
      </div>
    </button>`;
}

function chronicSection(gaps) {
  return `
    ${sectionTitle('Powtarza się od dni')}
    <section class="glass pad">
      ${gaps.map((g) => `
        <div class="bar-row">
          <div class="bar-name">${esc(g.def.name)}</div>
          <div class="bar-val num">${g.days} z ostatnich dni poniżej 70%</div>
          <div class="bar-track thin"><div class="bar-fill over" style="width:${Math.round(g.share * 100)}%"></div></div>
        </div>`).join('')}
      <p class="note" style="margin:14px 4px 0">
        Braki, które wracają przez wiele dni, mają realny wpływ na formę — w odróżnieniu od pojedynczego słabszego dnia.
      </p>
    </section>`;
}

/* ---------------- detail sheet ---------------- */

function openDetail(ctx, key) {
  const def = NUTRIENTS[key];
  if (!def) return;
  const s = statusOf(key, ctx.totals[key], ctx.targets[key]);

  // Which of today's meals actually delivered this nutrient.
  const contributions = (ctx.day.meals || [])
    .map((m) => ({ name: m.name, value: m.totals?.[key] || 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  sheet.open(`
    <div class="grab"></div>
    <h2>${esc(def.name)}</h2>
    <p class="sheet-sub">${esc(def.role || '')}</p>

    <div class="portion" style="margin-top:4px">
      <div class="ph">
        <span>Dzisiaj</span>
        <b class="num">${s.value.toFixed(def.prec ?? 1).replace(/\.0$/, '')} / ${s.target} ${esc(def.unit)}</b>
      </div>
      <div class="bar-track" style="margin-top:12px">
        <div class="bar-fill${s.state === 'over' ? ' over' : ''}" style="width:${clamp(s.pct, 0, 100)}%"></div>
      </div>
      <div class="t-sm t-sub" style="margin-top:8px">${Math.round(s.pct)}% dziennej normy${def.ul ? ` · górny limit ${def.ul} ${esc(def.unit)}` : ''}</div>
    </div>

    ${def.sources?.length ? `
      <div class="input-label">Najlepsze źródła</div>
      <div class="alts" style="margin-bottom:14px">
        ${def.sources.map((src) => `<span class="chip">${esc(src)}</span>`).join('')}
      </div>` : ''}

    ${contributions.length ? `
      <div class="input-label">Skąd dziś pochodzi</div>
      <div class="glass list" style="margin-bottom:14px;box-shadow:none;background:var(--fill)">
        ${contributions.map((c) => `
          <div class="item">
            <div class="grow"><div class="title t-ellipsis">${esc(c.name)}</div></div>
            <div class="value num">${c.value.toFixed(def.prec ?? 1).replace(/\.0$/, '')}<small>${esc(def.unit)}</small></div>
          </div>`).join('')}
      </div>` : ''}

    <div class="sheet-actions">
      <button class="btn btn-quiet" data-action="sheet:close">Zamknij</button>
    </div>`, { label: def.name });
}

export const actions = {
  'micro:tab': (ctx, el) => { tab = el.dataset.tab; ctx.render(); },
  'micro:detail': (ctx, el) => openDetail(ctx, el.dataset.key),
};
