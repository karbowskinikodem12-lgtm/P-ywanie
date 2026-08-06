/* ==========================================================================
   Portion estimation.

   A phone photo carries no absolute scale, so the estimate combines three
   weak signals into one usable number:

     1. how much of the frame the food occupies, relative to a typical plate
     2. the item's own standard serving and bulk density
     3. what this user actually eats of that food (strongest signal once known)

   The result is presented as an editable slider, never as a fact — the
   returned `confidence` drives how loudly the UI asks for a correction.
   ========================================================================== */

import { getItem } from '../data/food-db.js';
import { clamp } from '../core/utils.js';

/** Share of the frame a normally-plated, well-framed meal covers. */
const REFERENCE_COVERAGE = 0.46;

/**
 * @param {string} foodId
 * @param {object} features  from image.describe()
 * @param {object} seg       from image.segment()
 * @param {object} opts      { learning, regionArea }
 * @returns {{grams:number, confidence:number, basis:string}}
 */
export function estimatePortion(foodId, features, seg, opts = {}) {
  const item = getItem(foodId);
  const learned = opts.learning?.portions?.[foodId] || null;
  const standard = item?.serving || 150;

  // Coverage: prefer the specific region when the item came from one.
  const coverage = opts.regionArea
    ? clamp(opts.regionArea / 0.5, 0.25, 2.2)
    : clamp((seg?.foodRatio ?? features?.foodRatio ?? REFERENCE_COVERAGE) / REFERENCE_COVERAGE, 0.4, 2.0);

  // A visible plate rim means the frame is a plated meal — coverage is then
  // informative. A tight close-up tells us nothing about absolute size.
  const plateVisible = (seg?.plateRatio ?? 0) > 0.10;
  const areaWeight = plateVisible ? 0.75 : 0.35;
  const areaFactor = 1 + (coverage - 1) * areaWeight;

  // Bulk density: a bowl of leaves and a bowl of rice cover the frame alike
  // but differ four-fold in mass.
  const density = item?.dens ?? 1;
  const densityFactor = clamp(0.75 + density * 0.35, 0.7, 1.35);

  let grams = standard * areaFactor * densityFactor;
  let basis = plateVisible ? 'kadr z talerzem' : 'typowa porcja';
  let confidence = plateVisible ? 0.55 : 0.4;

  if (learned) {
    // The user's own habit dominates once we have it, but the photo can still
    // pull the estimate when this serving clearly differs from the usual one.
    grams = learned * 0.68 + grams * 0.32;
    basis = 'twoja zwykła porcja';
    confidence = 0.72;
  }

  // Snap to a readable step so the slider does not read "137 g".
  const step = grams > 400 ? 25 : grams > 120 ? 10 : 5;
  grams = Math.max(step, Math.round(grams / step) * step);

  return { grams, confidence, basis };
}

/**
 * Split an estimated total mass across the components of a multi-item plate,
 * weighted by how much of the frame each one occupies.
 */
export function distributeMass(components, totalGrams) {
  const weights = components.map((c) => Math.max(0.08, c.area ?? 0.25));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return components.map((c, i) => Math.max(5, Math.round((weights[i] / sum) * totalGrams / 5) * 5));
}

/** Total plate mass a photo suggests, before knowing what is on it. */
export function estimatePlateMass(features, seg) {
  const coverage = clamp((seg?.foodRatio ?? features?.foodRatio ?? 0.45) / REFERENCE_COVERAGE, 0.4, 2.0);
  const base = 420;                       // grams on a typical full dinner plate
  return Math.round((base * coverage) / 25) * 25;
}

/** Fine-grained slider bounds for an item, in grams. */
export function portionRange(foodId, grams) {
  const item = getItem(foodId);
  const base = grams || item?.serving || 150;
  return {
    min: Math.max(5, Math.round(base * 0.2 / 5) * 5),
    max: Math.round(base * 3 / 10) * 10,
    step: base > 300 ? 10 : 5,
  };
}

