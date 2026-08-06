/* ==========================================================================
   Photo analysis, meal editor and food search.

   These are sheets rather than a tab: the whole capture → recognise → correct
   → save loop happens in one panel so logging a meal never loses the screen
   the user was on.
   ========================================================================== */

import {
  $, esc, uid, clamp, haptic, nowTime, debounce,
} from '../../core/utils.js';
import * as store from '../../core/store.js';
import * as db from '../../core/db.js';
import { icon } from '../icons.js';
import * as sheet from '../sheet.js';
import { toast, toastErr, toastOk } from '../toast.js';
import { spinnerBlock, confidenceChip, emptyState, macroTiles } from '../components.js';
import {
  getItem, searchFoods, totalsForItems, totalsFor, per100, itemKcal, suggestPortion,
  portionPresets, expandDish, CATEGORIES,
} from '../../data/food-db.js';
import { analyzePhoto, ENGINE_LABELS } from '../../vision/index.js';
import { estimatePortion } from '../../vision/portion.js';
import { buildLearningUpdates } from '../../vision/learning.js';
import { guessSlot } from '../../core/store.js';
import { deleteWithUndo } from '../undo.js';
import { SLOT_NAMES } from '../../domain/targets.js';

let session = null;      // the meal currently being composed

const SLOTS = ['breakfast', 'snack', 'lunch', 'dinner'];

/* ==========================================================================
   Entry points
   ========================================================================== */

export function startCapture(ctx, { fromGallery = false } = {}) {
  const input = $(fromGallery ? '#filePick' : '#fileCam');
  if (!input) return;
  input.value = '';
  input.click();
}

export async function handleFile(ctx, file) {
  if (!file) return;

  session = {
    mode: 'photo',
    key: ctx.key,
    name: 'Analizuję…',
    time: nowTime(),
    slot: guessSlot(nowTime()),
    items: [],
    photo: null,
    analyzing: true,
    edited: false,
    engine: null,
    confidence: 0,
    alternatives: [],
    suggestedId: null,
    signature: null,
    warning: null,
  };

  sheet.open(analyzingHtml('Przygotowuję zdjęcie'), { label: 'Analiza posiłku', onClose: onSheetClosed });

  try {
    const result = await analyzePhoto(file, {
      state: ctx.state,
      onProgress: ({ progress, text }) => {
        const step = document.getElementById('progressStep');
        const bar = document.getElementById('progressBar');
        if (step && text) step.textContent = text;
        if (bar) bar.style.width = `${Math.round(clamp(progress, 0, 1) * 100)}%`;
      },
      onPartial: (partial) => {
        // First usable answer — show the editor straight away and let the
        // neural pass upgrade it underneath.
        applyResult(partial, { partial: true });
        renderEditor();
      },
    });

    applyResult(result, { partial: false });
    renderEditor();

    if (result.warning) toast(result.warning, { kind: 'warn', duration: 4200 });
  } catch (e) {
    console.error('[analyze] failed', e);
    if (!session) return;
    sheet.update(`
      <div class="grab"></div>
      <h2>Nie udało się przeanalizować</h2>
      <div class="callout callout-err" style="margin:12px 0">${icon('warn', { size: 18 })}<div>${esc(e?.message || 'Nieznany błąd.')}</div></div>
      <button class="btn btn-primary" data-action="capture:photo">Spróbuj ponownie</button>
      <button class="btn btn-quiet btn-block" data-action="meal:search">Wpisz ręcznie</button>
      <button class="btn btn-quiet btn-block" data-action="sheet:close">Anuluj</button>`);
  }
}

function analyzingHtml(text) {
  return `<div class="grab"></div>${spinnerBlock('Analizuję posiłek', text)}
    <p class="note t-center">Wszystko liczy się na tym urządzeniu. Zdjęcie nie opuszcza telefonu.</p>`;
}

/** Merge an analysis result into the session without discarding user edits. */
function applyResult(result, { partial }) {
  if (!session) return;
  if (session.edited && !partial) {
    // The user already started correcting — only refresh the metadata.
    session.engine = result.engine;
    session.alternatives = result.alternatives;
    session.analyzing = false;
    return;
  }

  session.name = result.name || 'Posiłek';
  session.items = result.items.map((it) => ({ ...it, uid: uid('it') }));
  session.photo = result.photo;
  session.engine = result.engine;
  session.confidence = result.confidence;
  session.alternatives = result.alternatives || [];
  session.suggestedId = result.suggestedId;
  session.primaryId = result.suggestedId;
  session.signature = result.signature;
  session.warning = result.warning;
  session.slot = result.slot || session.slot;
  session.analyzing = !!partial;
  session.timings = result.timings;
}

/* ==========================================================================
   Editor
   ========================================================================== */

export function renderEditor() {
  if (!session) return;
  // `open` rather than `update`: nested sheets (search, portion) replace the
  // panel, and re-opening restores this editor's own close handler.
  sheet.open(editorHtml(), { label: 'Posiłek', onClose: onSheetClosed });
  wireEditor();
}

/**
 * Small text/number prompt rendered as a sheet — `window.prompt` is blocked in
 * standalone PWAs on iOS and looks nothing like the rest of the app.
 */
function promptSheet({ title, hint = '', value = '', type = 'text', placeholder = '', onSave }) {
  sheet.open(`
    <div class="grab"></div>
    <h2>${esc(title)}</h2>
    ${hint ? `<p class="sheet-sub">${esc(hint)}</p>` : ''}
    <div class="input-box" style="margin-top:12px">
      <input id="promptInput" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"
        autocomplete="off" autocapitalize="sentences" enterkeyhint="done">
    </div>
    <div class="sheet-actions">
      <button class="btn btn-primary" id="promptSave">Zapisz</button>
      <button class="btn btn-quiet btn-block" id="promptCancel">Anuluj</button>
    </div>`, { label: title });

  const input = document.getElementById('promptInput');
  const commit = () => { onSave?.(input.value); };
  input?.focus();
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  document.getElementById('promptSave')?.addEventListener('click', commit);
  document.getElementById('promptCancel')?.addEventListener('click', () => renderEditor());
}

function editorHtml() {
  const totals = totalsForItems(session.items);
  const engineLabel = ENGINE_LABELS[session.engine] || 'Ręcznie';
  const isEdit = session.mode === 'edit';

  return `
    <div class="grab"></div>

    ${session.photo?.display ? `
      <div class="shot-wrap">
        <img class="shot" src="${esc(session.photo.display)}" alt="Zdjęcie posiłku">
        <div class="shot-badge">${icon(session.engine === 'model' ? 'cpu' : 'sparkles', { size: 13 })}${esc(engineLabel)}</div>
      </div>` : ''}

    <div class="spread" style="align-items:flex-start;margin-bottom:6px">
      <h2 class="grow" style="min-width:0">
        <button data-action="meal:rename" style="text-align:left;font:inherit;color:inherit;width:100%">
          ${esc(session.name)} ${icon('edit', { size: 15, cls: 'edit-mark' })}
        </button>
      </h2>
    </div>

    <div class="wrap" style="margin-bottom:12px">
      ${session.mode === 'photo' ? confidenceChip(session.confidence, engineLabel) : ''}
      <button class="chip chip-tap" data-action="meal:time">${icon('clock', { size: 13 })}${esc(session.time)}</button>
      <button class="chip chip-tap" data-action="meal:slot">${esc(SLOT_NAMES[session.slot] || 'Posiłek')}</button>
      ${session.analyzing ? `<span class="chip chip-blue">${icon('refresh', { size: 13 })}dopracowuję…</span>` : ''}
    </div>

    ${session.alternatives?.length && session.mode === 'photo' ? `
      <div class="input-label">To nie to? Popraw jednym dotknięciem</div>
      <div class="alts">
        ${session.alternatives.slice(0, 7).map((a) => `
          <button class="chip chip-tap" data-action="meal:replaceAll" data-id="${esc(a.id)}">
            ${a.emoji} ${esc(a.name)}
          </button>`).join('')}
        <button class="chip chip-tap chip-blue" data-action="meal:pickPrimary">${icon('search', { size: 13 })}Inne</button>
      </div>` : ''}

    <div class="input-label">Składniki (${session.items.length})</div>
    <div class="ing-list">
      ${session.items.length ? session.items.map(ingredientRow).join('')
        : `<div class="callout callout-info">${icon('info', { size: 18 })}<div>Brak składników. Dodaj pierwszy, żeby policzyć posiłek.</div></div>`}
    </div>

    <button class="btn btn-quiet btn-sm" style="width:100%;margin-bottom:14px" data-action="meal:addItem">
      ${icon('plus', { size: 18 })} Dodaj składnik
    </button>

    ${session.items.length ? `
      <div class="portion">
        <div class="ph"><span>Cała porcja</span><b class="num" id="portionTotal">${Math.round(totalGrams())} g</b></div>
        <input type="range" id="portionScale" min="40" max="200" step="5" value="100" aria-label="Skaluj całą porcję">
        <div class="presets">
          <button data-action="meal:scale" data-scale="65">mniejsza</button>
          <button data-action="meal:scale" data-scale="100" aria-pressed="true">jak jest</button>
          <button data-action="meal:scale" data-scale="135">większa</button>
          <button data-action="meal:scale" data-scale="175">XXL</button>
        </div>
      </div>` : ''}

    <div id="mealTotals">${totalTiles(totals)}</div>

    <div class="sheet-actions">
      <button class="btn btn-primary" data-action="meal:save">${isEdit ? 'Zapisz zmiany' : 'Dodaj do dnia'}</button>
      ${isEdit ? `<button class="btn btn-danger btn-block" data-action="meal:delete">Usuń posiłek</button>`
        : `<button class="btn btn-quiet btn-block" data-action="sheet:close">Anuluj</button>`}
    </div>

    ${session.timings ? `<p class="note t-center">Analiza: ${Math.round(session.timings.total)} ms${session.timings.model ? ` · model ${session.timings.model} ms` : ''}</p>` : ''}
  `;
}

function ingredientRow(item) {
  const food = getItem(item.foodId);
  const kcal = Math.round(itemKcal(item));
  const frozen = !!item.frozenTotals;
  const conf = clamp(item.confidence ?? 1, 0, 1);
  const confCls = conf >= 0.7 ? '' : conf >= 0.45 ? 'mid' : 'lo';
  return `
    <div class="ing" data-uid="${item.uid}">
      <div class="ic">${item.emoji || food?.emoji || '🍽️'}</div>
      <div>
        <div class="nm">${esc(item.name)}</div>
        <div class="gr num">${Math.round(item.grams)} g</div>
      </div>
      <div class="kc num">${kcal}<span style="font-size:11px;color:var(--sub)"> kcal</span></div>
      <div class="acts">
        ${frozen ? '' : `<button data-action="item:portion" data-uid="${item.uid}" aria-label="Zmień gramaturę ${esc(item.name)}">${icon('scale', { size: 15 })}</button>`}
        <button data-action="item:swap" data-uid="${item.uid}" aria-label="Podmień ${esc(item.name)}">${icon('refresh', { size: 15 })}</button>
        <button data-action="item:remove" data-uid="${item.uid}" aria-label="Usuń ${esc(item.name)}">${icon('x', { size: 15 })}</button>
      </div>
      ${item.source && item.source !== 'manual'
        ? `<div class="conf-track"><div class="conf-fill ${confCls}" style="width:${conf * 100}%"></div></div>` : ''}
    </div>`;
}

const totalTiles = (totals) => macroTiles(totals);

const totalGrams = () => session.items.reduce((s, i) => s + (+i.grams || 0), 0);

/** Live slider: scales every ingredient without a full re-render. */
function wireEditor() {
  const slider = document.getElementById('portionScale');
  if (!slider) return;
  const base = session.items.map((i) => i.grams);

  const apply = (pct) => {
    session.items.forEach((item, i) => { item.grams = Math.max(1, Math.round((base[i] * pct) / 100)); });
    session.edited = true;
    const totals = totalsForItems(session.items);
    const totalsEl = document.getElementById('mealTotals');
    const gramsEl = document.getElementById('portionTotal');
    if (totalsEl) totalsEl.innerHTML = totalTiles(totals);
    if (gramsEl) gramsEl.textContent = `${Math.round(totalGrams())} g`;
    document.querySelectorAll('.ing').forEach((row) => {
      const item = session.items.find((x) => x.uid === row.dataset.uid);
      if (!item) return;
      row.querySelector('.gr').textContent = `${Math.round(item.grams)} g`;
      row.querySelector('.kc').innerHTML = `${Math.round(itemKcal(item))}<span style="font-size:11px;color:var(--sub)"> kcal</span>`;
    });
  };

  slider.addEventListener('input', () => apply(+slider.value));
  slider.addEventListener('change', () => haptic('light'));
}

/* ==========================================================================
   Food search
   ========================================================================== */

/**
 * @param {object} opts
 *   onPick(item)     — required
 *   title            — sheet heading
 *   category         — initial category filter
 */
export function openSearch(ctx, { onPick, title = 'Znajdź jedzenie', initial = '' } = {}) {
  const priors = ctx.state.learning.priors || {};
  let category = null;
  let query = initial;

  const html = () => `
    <div class="grab"></div>
    <h2>${esc(title)}</h2>
    <div class="search-box" style="margin-top:12px">
      ${icon('search', { size: 17 })}
      <input id="foodSearch" type="search" inputmode="search" autocomplete="off"
        aria-label="Szukaj produktu lub dania" placeholder="np. owsianka, kurczak, banan" value="${esc(query)}">
    </div>
    <div class="alts" id="catRow">
      <button class="chip chip-tap${category ? '' : ' chip-on'}" data-cat="">Wszystko</button>
      ${CATEGORIES.map((c) => `<button class="chip chip-tap${category === c.id ? ' chip-on' : ''}" data-cat="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}
    </div>
    <div class="results" id="foodResults">${resultsHtml(query, category, priors)}</div>`;

  const handle = sheet.open(html(), { label: title });

  const input = document.getElementById('foodSearch');
  const results = document.getElementById('foodResults');

  const refresh = () => { results.innerHTML = resultsHtml(query, category, priors); };
  const onInput = debounce(() => { query = input.value; refresh(); }, 120);

  input?.addEventListener('input', onInput);
  document.getElementById('catRow')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    category = btn.dataset.cat || null;
    document.querySelectorAll('#catRow .chip').forEach((c) => c.classList.toggle('chip-on', (c.dataset.cat || null) === category));
    refresh();
  });

  results?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-food]');
    if (!btn) return;
    const item = getItem(btn.dataset.food);
    if (item) onPick?.(item);
  });

  return handle;
}

function resultsHtml(query, category, priors) {
  const items = searchFoods(query, { priors, category, limit: 40 });
  if (!items.length) {
    return emptyState({
      emoji: '🔍',
      title: 'Nic nie znaleziono',
      text: 'Spróbuj prostszej nazwy — np. „ryż” zamiast „ryż basmati z patelni”.',
    });
  }
  return items.map((item) => {
    const p = per100(item.id);
    const serving = suggestPortion(item.id, { portions: {} });
    return `
      <button class="item item-tap has-media" data-food="${esc(item.id)}">
        <div class="thumb-ph">${item.emoji}</div>
        <div class="grow">
          <div class="title t-ellipsis">${esc(item.name)}</div>
          <div class="meta t-ellipsis">${item.kind === 'dish' ? 'danie' : 'produkt'} · ${Math.round(p.kcal)} kcal / 100 g · porcja ${serving} g</div>
        </div>
        <div class="value num">${Math.round((p.kcal * serving) / 100)}<small>kcal</small></div>
      </button>`;
  }).join('');
}

/* ==========================================================================
   Portion picker
   ========================================================================== */

export function openPortion(ctx, { foodId, grams, onConfirm, title = null }) {
  const item = getItem(foodId);
  if (!item) return;

  const start = grams || suggestPortion(foodId, ctx.state.learning);
  const presets = portionPresets(foodId);
  const max = Math.max(Math.round(start * 3), 300);

  sheet.open(`
    <div class="grab"></div>
    <h2>${esc(title || item.name)}</h2>
    <p class="sheet-sub">${Math.round(per100(foodId).kcal)} kcal w 100 g${item.unit ? ` · 1 ${item.unitName} ≈ ${item.unit} g` : ''}</p>

    <div class="portion">
      <div class="ph"><span>Porcja</span><b class="num" id="pGrams">${start} g</b></div>
      <input type="range" id="pSlider" min="5" max="${max}" step="5" value="${start}" aria-label="Gramatura">
      <div class="presets">
        ${presets.map((p) => `<button data-preset="${p.grams}">${esc(p.label)}</button>`).join('')}
      </div>
    </div>

    <div id="pTiles"></div>

    <div class="sheet-actions">
      <button class="btn btn-primary" id="pConfirm">Gotowe</button>
      <button class="btn btn-quiet btn-block" data-action="sheet:close">Anuluj</button>
    </div>`, { label: 'Porcja' });

  const slider = document.getElementById('pSlider');
  const label = document.getElementById('pGrams');
  const tilesEl = document.getElementById('pTiles');

  const paint = () => {
    const g = +slider.value;
    label.textContent = `${g} g`;
    tilesEl.innerHTML = macroTiles(totalsFor(foodId, g));
  };
  paint();

  slider.addEventListener('input', paint);
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    slider.value = b.dataset.preset;
    paint();
    haptic('light');
  }));
  document.getElementById('pConfirm').addEventListener('click', () => {
    onConfirm?.(+slider.value);
  });
}

/* ==========================================================================
   Manual meal (search → build)
   ========================================================================== */

export function startManual(ctx) {
  openSearch(ctx, {
    title: 'Dodaj posiłek',
    onPick: (item) => {
      openPortion(ctx, {
        foodId: item.id,
        onConfirm: (grams) => {
          const items = item.kind === 'dish'
            ? expandDish(item.id, grams).map((p) => ({ ...p, uid: uid('it'), confidence: 1, source: 'manual' }))
            : [{ uid: uid('it'), foodId: item.id, name: item.name, emoji: item.emoji, grams, confidence: 1, source: 'manual' }];

          session = {
            mode: 'manual',
            key: ctx.key,
            name: item.name,
            time: nowTime(),
            slot: guessSlot(nowTime()),
            items,
            photo: null,
            engine: null,
            confidence: 1,
            alternatives: [],
            suggestedId: item.id,
            primaryId: item.id,
            signature: null,
            edited: true,
            analyzing: false,
          };
          renderEditor();
        },
      });
    },
  });
}

/* ==========================================================================
   Edit an existing meal
   ========================================================================== */

export async function openMeal(ctx, mealId) {
  const meal = ctx.day.meals.find((m) => m.id === mealId);
  if (!meal) return;

  session = {
    mode: 'edit',
    mealId,
    key: ctx.key,
    name: meal.name,
    time: meal.time || nowTime(),
    slot: meal.slot || guessSlot(meal.time),
    items: (meal.items || []).map((i) => ({ ...i, uid: uid('it') })),
    photo: { thumb: meal.thumb || null, display: meal.thumb || null },
    photoId: meal.photoId,
    thumbId: meal.thumbId || null,
    engine: meal.source,
    confidence: meal.confidence ?? 1,
    alternatives: [],
    suggestedId: null,
    signature: meal.signature || null,
    edited: false,
    analyzing: false,
  };

  // Legacy meals carry totals but no ingredient list — keep them editable by
  // showing a single synthetic row.
  if (!session.items.length) {
    session.items = [{
      uid: uid('it'), foodId: null, name: meal.name, emoji: '🍽️',
      grams: meal.grams || 0, confidence: 1, source: 'legacy',
      frozenTotals: meal.totals, baseGrams: meal.grams || 0,
    }];
  }

  sheet.open(editorHtml(), { label: 'Edycja posiłku', onClose: onSheetClosed });
  wireEditor();

  // Images live outside the state blob; fetch them lazily. The thumbnail
  // arrives first so the sheet is never blank, then the full-size photo.
  if (meal.thumbId && !meal.thumb) {
    const t = await db.getThumb(meal.thumbId);
    if (t && session?.mealId === mealId) {
      session.photo = { thumb: t, display: session.photo.display || t };
      renderEditor();
    }
  }
  if (meal.photoId) {
    const full = await db.getPhoto(meal.photoId);
    if (full && session?.mealId === mealId) {
      session.photo = { ...session.photo, display: full };
      renderEditor();
    }
  }
}

/* ==========================================================================
   Persistence
   ========================================================================== */

async function saveMeal(ctx) {
  if (!session || !session.items.length) {
    toastErr('Dodaj przynajmniej jeden składnik.');
    return;
  }

  const totals = totalsForItems(session.items);
  const grams = Math.round(totalGrams());
  const items = session.items.map(({ uid: _u, ...rest }) => rest);
  const isNewPhoto = !!(session.photo?.display && !session.photoId);
  const photoId = isNewPhoto ? uid('ph') : session.photoId;
  const thumbId = photoId || session.thumbId || null;

  const record = {
    name: session.name,
    time: session.time,
    slot: session.slot,
    grams,
    items,
    totals,
    // Images are keyed, not embedded — see store.migrateInlineThumbs.
    thumbId,
    photoId: photoId || null,
    source: session.engine || 'manual',
    confidence: session.confidence,
    signature: session.signature || null,
  };

  if (session.mode === 'edit') {
    store.updateMeal(session.mealId, record, session.key);
    toastOk('Zapisano zmiany');
  } else {
    store.addMeal(record, session.key);
    toastOk('Dodano do dnia');
  }

  // Images are written after the state so the meal appears instantly.
  if (photoId && session.photo?.display) {
    db.putPhoto(photoId, session.photo.display).catch(() => {});
  }
  if (thumbId && session.photo?.thumb) {
    db.putThumb(thumbId, session.photo.thumb).catch(() => {});
  }

  applyLearning();
  session = null;
  sheet.close();
  ctx.render();
}

/** Persist what this meal taught us about the user's habits. */
function applyLearning() {
  if (!session) return;
  // The identity to remember is the dish the user accepted — not the first
  // ingredient of its recipe, which would teach the wrong thing entirely.
  const primary = session.primaryId || session.items[0]?.fromDish || session.items[0]?.foodId || null;
  const updates = buildLearningUpdates({
    signature: session.signature,
    accepted: primary,
    suggested: session.suggestedId,
    items: session.items,
  });

  for (const c of updates.corrections) store.recordCorrection(c);
  for (const s of updates.signatures) store.recordSignature(s);
  for (const p of updates.portions) store.recordPortion(p.id, p.grams);

  // Confirming a suggestion is itself a signal — count it as a prior.
  if (primary && session.suggestedId === primary) {
    store.recordCorrection({ from: null, to: primary, confirmed: true });
  }
}

function onSheetClosed() {
  session = null;
}

/* ==========================================================================
   Actions
   ========================================================================== */

export const actions = {
  'capture:photo': (ctx) => startCapture(ctx),
  'capture:gallery': (ctx) => startCapture(ctx, { fromGallery: true }),
  'meal:search': (ctx) => startManual(ctx),
  'meal:open': (ctx, el) => openMeal(ctx, el.dataset.id),
  'meal:save': (ctx) => saveMeal(ctx),

  'meal:delete': (ctx) => {
    if (!session?.mealId) return;
    const { mealId, key } = session;
    session = null;
    sheet.close();
    deleteWithUndo(ctx, { kind: 'meal', id: mealId, key, message: 'Posiłek usunięty' });
  },

  'meal:rename': () => {
    if (!session) return;
    promptSheet({
      title: 'Nazwa posiłku',
      value: session.name,
      placeholder: 'np. Owsianka po treningu',
      onSave: (v) => {
        session.name = v.trim().slice(0, 60) || session.name;
        session.edited = true;
        renderEditor();
      },
    });
  },

  'meal:time': () => {
    if (!session) return;
    promptSheet({
      title: 'Godzina posiłku',
      hint: 'Decyduje o tym, do której pory dnia trafi posiłek.',
      value: session.time,
      type: 'time',
      onSave: (v) => {
        if (!/^\d{1,2}:\d{2}$/.test(v)) { toastErr('Podaj godzinę w formacie 14:30.'); return; }
        session.time = v.padStart(5, '0');
        session.slot = guessSlot(session.time);
        renderEditor();
      },
    });
  },

  'meal:slot': () => {
    if (!session) return;
    const i = SLOTS.indexOf(session.slot);
    session.slot = SLOTS[(i + 1) % SLOTS.length];
    renderEditor();
  },

  'meal:scale': (ctx, el) => {
    const slider = document.getElementById('portionScale');
    if (!slider) return;
    slider.value = el.dataset.scale;
    slider.dispatchEvent(new Event('input'));
    document.querySelectorAll('.presets button').forEach((b) => b.setAttribute('aria-pressed', b === el));
    haptic('light');
  },

  /** One-tap correction of the whole recognition. */
  'meal:replaceAll': (ctx, el) => {
    const item = getItem(el.dataset.id);
    if (!item || !session) return;
    const grams = session.mode === 'photo'
      ? estimatePortion(item.id, { foodRatio: 0.45, meanHsv: [0, 0, 0], edge: 0 }, null, { learning: ctx.state.learning }).grams
      : suggestPortion(item.id, ctx.state.learning);

    session.items = item.kind === 'dish'
      ? expandDish(item.id, grams).map((p) => ({ ...p, uid: uid('it'), confidence: 1, source: 'correction' }))
      : [{ uid: uid('it'), foodId: item.id, name: item.name, emoji: item.emoji, grams, confidence: 1, source: 'correction' }];

    session.name = item.name;
    session.primaryId = item.id;
    session.edited = true;
    session.confidence = 1;
    haptic('ok');
    renderEditor();
  },

  'meal:pickPrimary': (ctx) => {
    openSearch(ctx, {
      title: 'Co to jest?',
      onPick: (item) => {
        actions['meal:replaceAll'](ctx, { dataset: { id: item.id } });
      },
    });
  },

  'meal:addItem': (ctx) => {
    openSearch(ctx, {
      title: 'Dodaj składnik',
      onPick: (item) => {
        openPortion(ctx, {
          foodId: item.id,
          onConfirm: (grams) => {
            session.items.push({
              uid: uid('it'), foodId: item.id, name: item.name,
              emoji: item.emoji, grams, confidence: 1, source: 'manual',
            });
            session.edited = true;
            renderEditor();
          },
        });
      },
    });
  },

  'item:portion': (ctx, el) => {
    const item = session?.items.find((i) => i.uid === el.dataset.uid);
    if (!item) return;
    openPortion(ctx, {
      foodId: item.foodId,
      grams: item.grams,
      title: item.name,
      onConfirm: (grams) => {
        item.grams = grams;
        session.edited = true;
        renderEditor();
      },
    });
  },

  'item:swap': (ctx, el) => {
    const item = session?.items.find((i) => i.uid === el.dataset.uid);
    if (!item) return;
    const previous = item.foodId;
    openSearch(ctx, {
      title: `Zamiast: ${item.name}`,
      onPick: (picked) => {
        item.foodId = picked.id;
        item.name = picked.name;
        item.emoji = picked.emoji;
        item.confidence = 1;
        item.source = 'correction';
        item.grams = suggestPortion(picked.id, ctx.state.learning);
        session.edited = true;
        // A swap is the strongest possible training signal.
        store.recordCorrection({ from: previous, to: picked.id });
        haptic('ok');
        renderEditor();
      },
    });
  },

  'item:remove': (ctx, el) => {
    if (!session) return;
    const i = session.items.findIndex((x) => x.uid === el.dataset.uid);
    if (i < 0) return;
    const [removed] = session.items.splice(i, 1);
    session.edited = true;
    haptic('light');
    renderEditor();
    toast(`Usunięto: ${removed.name}`, {
      actionLabel: 'Cofnij',
      onAction: () => { session?.items.splice(i, 0, removed); renderEditor(); },
    });
  },
};

export { session };
