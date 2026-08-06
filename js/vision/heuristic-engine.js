/* ==========================================================================
   Heuristic engine — the always-available fallback.

   No model, no network: it reasons from colour, texture, region layout, the
   time of day and what this particular user actually eats. Accuracy is well
   below the neural path, so its confidence is capped and the UI always shows
   the alternatives one tap away.

   It also runs *before* the model on every analysis, which is what makes the
   transition seamless: the sheet is never empty while weights download.
   ========================================================================== */

import { byAppearance, getItem, visionLabels } from '../data/food-db.js';
import { clamp } from '../core/utils.js';

/** Meal slot implied by the clock — dishes carry a preferred slot. */
export function slotForHour(hour) {
  if (hour < 10) return 'breakfast';
  if (hour < 12) return 'snack';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'snack';
  if (hour < 23) return 'dinner';
  return 'snack';
}

/**
 * Rank database items for an image.
 *
 * @param {object} features   from image.describe()
 * @param {object} seg        from image.segment()
 * @param {object} ctx        { hour, priors, learnedMatches }
 * @returns {{items:{id:string,score:number,region:number|null}[], regions:object[]}}
 */
export function analyse(features, seg, ctx = {}) {
  const hour = ctx.hour ?? new Date().getHours();
  const slot = slotForHour(hour);
  const priors = ctx.priors || {};
  const scores = new Map();

  const bump = (id, value, region = null) => {
    const cur = scores.get(id) || { id, score: 0, region };
    cur.score += value;
    if (region != null && cur.region == null) cur.region = region;
    scores.set(id, cur);
  };

  /* 1 — whole-image appearance.
     Deliberately weak: the mean colour of a plated meal is mostly plate, so
     this only nudges the ranking rather than driving it. */
  const globalMatches = byAppearance(features.meanHsv, features.edge, { limit: 14 });
  for (const m of globalMatches) bump(m.item.id, m.score * 0.35);

  /* 2 — per-region appearance: this is what finds "meat + rice + broccoli". */
  seg.regions.forEach((region, i) => {
    const regionTex = region.tex ?? clamp(features.edge * (0.6 + region.area), 0, 1);
    // A large, colourless, smooth region is almost certainly the plate itself
    // rather than a pale food, so it should not out-vote a small vivid one.
    const tableware = region.color[1] < 0.09 && regionTex < 0.4 ? 0.35 : 1;
    const matches = byAppearance(region.color, regionTex, { limit: 6 });
    for (const m of matches) {
      // Larger regions carry more evidence, but a small vivid one (broccoli
      // next to rice) still needs to register.
      bump(m.item.id, m.score * (0.8 + region.area * 2.4) * tableware, i);
    }
  });

  /* 3 — context: time of day, user habits, texture sanity. */
  for (const entry of scores.values()) {
    const item = getItem(entry.id);
    if (!item) continue;

    if (item.kind === 'dish') {
      entry.score *= 1.15;
      if (item.slot === slot) entry.score *= 1.30;
      else if (item.slot === 'breakfast' && slot !== 'breakfast') entry.score *= 0.72;
    }

    // Liquids look flat; a textured photo is almost never a drink. And when a
    // plate rim is visible, nobody photographed a glass of milk.
    if (item.cat === 'drink' || item.id === 'milk' || item.id === 'cream' || item.id === 'kefir') {
      if (features.edge > 0.22) entry.score *= 0.4;
      if ((seg.plateRatio ?? 0) > 0.08) entry.score *= 0.35;
    }
    if (item.cat === 'sauce') entry.score *= 0.5;

    // Learned frequency: foods this user logs often are simply more likely.
    const prior = priors[entry.id] || 0;
    if (prior > 0) entry.score *= 1 + clamp(prior, 0, 12) * 0.05;
    else if (prior < 0) entry.score *= 0.85;
  }

  /* 4 — memory of past corrections on similar-looking photos. */
  for (const match of ctx.learnedMatches || []) {
    bump(match.id, match.weight * 1.8);
  }

  const items = [...scores.values()].sort((a, b) => b.score - a.score);

  // Normalise to 0..1 relative to the best hit, then cap: a colour histogram
  // is not evidence enough to ever claim near-certainty.
  const best = items[0]?.score || 1;
  for (const it of items) it.score = clamp((it.score / best) * 0.58, 0, 0.58);

  return { items: items.slice(0, 12), regions: seg.regions, slot };
}

/**
 * Turn the ranked list into a proposed meal: a primary item plus, when the
 * photo clearly shows several components, the best match for each region.
 */
export function proposeMeal(ranked, seg) {
  const top = ranked.items[0];
  if (!top) return { primary: null, components: [] };

  const primaryItem = getItem(top.id);
  const multiRegion = seg.regions.length >= 2 && seg.regions[1].area > 0.12;

  // A dish already implies its components — do not stack extra guesses on it.
  if (primaryItem?.kind === 'dish' || !multiRegion) {
    return { primary: top, components: [] };
  }

  const used = new Set([top.id]);
  const components = [];
  for (let i = 1; i < seg.regions.length && components.length < 3; i++) {
    // Components must be single ingredients. A dish already stands for a whole
    // plate, so adding one next to the primary would double-count the meal.
    const forRegion = ranked.items.find((x) => (
      x.region === i && !used.has(x.id) && getItem(x.id)?.kind === 'food'
    ));
    if (!forRegion) continue;
    used.add(forRegion.id);
    components.push(forRegion);
  }
  return { primary: top, components };
}

/**
 * Shortlist for the neural stage. Feeding CLIP 150 labels costs a text-encoder
 * pass per label, so the heuristic narrows the field first — the model then
 * only has to discriminate between plausible options, which is both faster
 * and measurably more accurate than a wide-open list.
 */
export function shortlistFor(ranked, { size = 48, wide = false } = {}) {
  const all = visionLabels();
  if (wide) return all;

  const picked = new Map();
  for (const entry of ranked.items) {
    const item = all.find((x) => x.id === entry.id);
    if (item) picked.set(item.id, item);
  }
  // Always include a spread of common dishes so the model can escape a bad
  // heuristic guess rather than being trapped inside it.
  for (const item of all) {
    if (picked.size >= size) break;
    if (item.kind === 'dish') picked.set(item.id, item);
  }
  for (const item of all) {
    if (picked.size >= size) break;
    picked.set(item.id, item);
  }
  return [...picked.values()].slice(0, size);
}
