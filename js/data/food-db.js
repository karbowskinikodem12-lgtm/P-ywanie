/* ==========================================================================
   Unified food API over foods.js + dishes.js.

   Everything downstream (vision, meal editor, search, quick-add) talks to
   this module only, so the storage format of the raw tables can change
   without touching the UI.
   ========================================================================== */

import FOODS, { FOOD_INDEX } from './foods.js';
import DISHES, { DISH_INDEX } from './dishes.js';
import { emptyTotals, accumulate } from './nutrients.js';
import { normalize } from '../core/utils.js';

export const ALL_ITEMS = [...FOODS, ...DISHES];
const INDEX = new Map(ALL_ITEMS.map((x) => [x.id, x]));

/** Cache for derived dish composition — recipes never change at runtime. */
const dishCache = new Map();

export const getItem = (id) => INDEX.get(id) || null;
export const isDish = (id) => DISH_INDEX.has(id);

export const CATEGORIES = [
  { id: 'protein', name: 'Mięso i ryby', emoji: '🍗' },
  { id: 'dairy', name: 'Nabiał', emoji: '🥛' },
  { id: 'grain', name: 'Zboża i skrobia', emoji: '🍚' },
  { id: 'veg', name: 'Warzywa', emoji: '🥦' },
  { id: 'fruit', name: 'Owoce', emoji: '🍎' },
  { id: 'legume', name: 'Strączki', emoji: '🫘' },
  { id: 'fat', name: 'Tłuszcze i orzechy', emoji: '🥑' },
  { id: 'snack', name: 'Przekąski', emoji: '🍫' },
  { id: 'drink', name: 'Napoje', emoji: '🥤' },
  { id: 'supp', name: 'Sport', emoji: '🥤' },
  { id: 'sauce', name: 'Dodatki', emoji: '🧂' },
  { id: 'dish', name: 'Dania', emoji: '🍽️' },
];

/* ---------------- nutrition ---------------- */

/** Per-100 g nutrient vector for any item (dishes are derived from parts). */
export function per100(id) {
  const item = INDEX.get(id);
  if (!item) return emptyTotals();
  if (item.kind === 'food') return item.per100;

  if (dishCache.has(id)) return dishCache.get(id);

  const totals = emptyTotals();
  let mass = 0;
  for (const [foodId, grams] of item.parts) {
    const food = FOOD_INDEX.get(foodId);
    if (!food) continue;
    accumulate(totals, food.per100, grams / 100);
    mass += grams;
  }
  // Cooking loses water; a plated dish weighs ~8% less than its raw parts.
  const plated = mass * 0.92;
  const per = emptyTotals();
  if (plated > 0) accumulate(per, totals, 100 / plated);
  dishCache.set(id, per);
  return per;
}

/** Nutrient totals for `grams` of item `id`. */
export function totalsFor(id, grams) {
  const t = emptyTotals();
  return accumulate(t, per100(id), (+grams || 0) / 100);
}

/**
 * Nutrient totals for a list of {foodId, grams}.
 *
 * An item may instead carry `frozenTotals` + `baseGrams`: meals imported from
 * the pre-database version know their nutrition but not their ingredients, so
 * their figures are scaled by weight rather than recomputed. Without this they
 * would silently drop to zero the first time the user opened them.
 */
export function totalsForItems(items) {
  const t = emptyTotals();
  for (const it of items || []) {
    if (!it || it.hidden) continue;
    if (it.frozenTotals) {
      const ratio = it.baseGrams > 0 ? (+it.grams || 0) / it.baseGrams : 1;
      accumulate(t, it.frozenTotals, ratio);
      continue;
    }
    accumulate(t, per100(it.foodId), (+it.grams || 0) / 100);
  }
  return t;
}

/** Energy of a single item, honouring the frozen-totals form. */
export function itemKcal(item) {
  if (!item) return 0;
  if (item.frozenTotals) {
    const ratio = item.baseGrams > 0 ? (+item.grams || 0) / item.baseGrams : 1;
    return (item.frozenTotals.kcal || 0) * ratio;
  }
  return (per100(item.foodId).kcal * (+item.grams || 0)) / 100;
}

/** Break a dish portion down into its ingredients, scaled to `grams`. */
export function expandDish(id, grams) {
  const item = INDEX.get(id);
  if (!item) return [];
  if (item.kind === 'food') {
    return [{ foodId: id, name: item.name, emoji: item.emoji, grams: Math.round(grams) }];
  }
  const factor = (+grams || item.serving) / item.serving;
  return item.parts.map(([foodId, g]) => {
    const food = FOOD_INDEX.get(foodId);
    return {
      foodId,
      name: food?.name || foodId,
      emoji: food?.emoji || '🍽️',
      grams: Math.max(1, Math.round(g * factor)),
    };
  });
}

/**
 * Sanity check: does the declared energy match the macros? Used by tests.
 * `carbs` follows the USDA "by difference" convention and already contains
 * fibre, so fibre is subtracted before being charged at its own 2 kcal/g.
 */
export function energyDrift(id) {
  const p = per100(id);
  const netCarbs = Math.max(0, p.carbs - p.fiber);
  const derived = p.protein * 4 + netCarbs * 4 + p.fiber * 2 + p.fat * 9;
  if (!p.kcal) return derived ? 1 : 0;
  return Math.abs(derived - p.kcal) / p.kcal;
}

/* ---------------- search ---------------- */

const searchIndex = ALL_ITEMS.map((x) => ({
  id: x.id,
  hay: normalize(`${x.name} ${x.en} ${(x.tags || []).join(' ')}`),
  name: normalize(x.name),
  item: x,
}));

/**
 * Ranked search. Prefix matches on the Polish name win, then word-boundary
 * matches, then anything containing the query. `priors` (the learned
 * frequency map) breaks ties so a swimmer's regular foods float to the top.
 */
export function searchFoods(query, { limit = 30, priors = {}, category = null } = {}) {
  const q = normalize(query);
  let pool = searchIndex;
  if (category) pool = pool.filter((r) => r.item.cat === category);

  if (!q) {
    return pool
      .slice()
      .sort((a, b) => (priors[b.id] || 0) - (priors[a.id] || 0) || a.item.name.localeCompare(b.item.name, 'pl'))
      .slice(0, limit)
      .map((r) => r.item);
  }

  const scored = [];
  for (const r of pool) {
    let score = 0;
    if (r.name === q) score = 1000;
    else if (r.name.startsWith(q)) score = 600 - r.name.length;
    else if (new RegExp(`\\b${escapeRe(q)}`).test(r.hay)) score = 400 - r.hay.indexOf(q);
    else if (r.hay.includes(q)) score = 200 - r.hay.indexOf(q);
    else continue;
    score += Math.min(60, (priors[r.id] || 0) * 8);
    if (r.item.kind === 'dish') score += 12;   // dishes are what people photograph
    scored.push({ score, item: r.item });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function byCategory(cat) {
  return ALL_ITEMS.filter((x) => x.cat === cat).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

/* ---------------- portions ---------------- */

/**
 * Portion suggestion in grams: the user's learned habit for this food beats
 * the table default, which beats a category fallback.
 */
export function suggestPortion(id, learning = {}) {
  const learned = learning.portions?.[id];
  if (learned) return learned;
  const item = INDEX.get(id);
  if (item?.serving) return item.serving;
  return 150;
}

/** Portion presets shown under the slider, tuned per category. */
export function portionPresets(id) {
  const item = INDEX.get(id);
  if (!item) return [{ label: '100 g', grams: 100 }];
  const base = item.serving || 100;
  if (item.unit) {
    return [
      { label: `½ ${item.unitName || 'szt.'}`, grams: Math.round(item.unit * 0.5) },
      { label: `1 ${item.unitName || 'szt.'}`, grams: item.unit },
      { label: `2 ${item.unitName || 'szt.'}`, grams: item.unit * 2 },
      { label: `3 ${item.unitName || 'szt.'}`, grams: item.unit * 3 },
    ];
  }
  return [
    { label: 'mała', grams: Math.round(base * 0.65) },
    { label: 'zwykła', grams: base },
    { label: 'duża', grams: Math.round(base * 1.4) },
    { label: 'XXL', grams: Math.round(base * 1.9) },
  ];
}

/* ---------------- vision support ---------------- */

/**
 * Candidate labels for the zero-shot vision model. Dishes come first because
 * a photographed plate is far more likely to be a dish than a bare ingredient.
 */
export function visionLabels() {
  return ALL_ITEMS
    .filter((x) => x.en && x.cat !== 'sauce')
    .map((x) => ({ id: x.id, en: x.en, name: x.name, kind: x.kind, cat: x.cat, emoji: x.emoji }));
}

/** Items whose appearance is closest to a colour/texture signature. */
export function byAppearance(color, tex, { limit = 8, catBias = null } = {}) {
  const [h, s, v] = color;
  const scored = ALL_ITEMS.map((item) => {
    const [ih, is, iv] = item.color;
    let dh = Math.abs(ih - h);
    if (dh > 180) dh = 360 - dh;                 // hue is circular
    const dist = (dh / 180) * 1.6 + Math.abs(is - s) * 1.0 + Math.abs(iv - v) * 0.9
      + Math.abs((item.tex ?? .5) - tex) * 0.7;
    let score = 1 / (1 + dist);
    if (catBias && item.cat === catBias) score *= 1.25;
    if (item.kind === 'dish') score *= 1.1;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export { FOODS, DISHES };
