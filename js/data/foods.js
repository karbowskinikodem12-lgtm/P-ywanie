/* ==========================================================================
   Embedded ingredient database — values per 100 g edible portion.

   Sources: USDA FoodData Central composite values cross-checked against the
   Polish IŻŻ tables for local staples (pieczywo, twaróg, kasze). Micronutrient
   figures are typical values, not lab results for a specific batch — the app
   presents them as estimates everywhere they surface.

   Row layout (V array), 32 slots, in NUTRIENT_KEYS order:
     kcal, protein, carbs, fat, fiber, sugar, satFat,
     sodium(mg), potassium(mg), calcium(mg), iron(mg), magnesium(mg), zinc(mg),
     copper(mg), selenium(µg), phosphorus(mg), omega3(g), omega6(g),
     cholesterol(mg), vitA(µg RAE), B1(mg), B2(mg), B3(mg), B5(mg), B6(mg),
     B7(µg), B9(µg), B12(µg), C(mg), D(µg), E(mg), K(µg)

   Meta:
     cat     — grouping used by the picker and the heuristic vision engine
     emoji   — used as a lightweight icon everywhere
     serving — typical single portion in grams
     unit    — optional "piece" weight (1 egg, 1 slice of bread…)
     color   — [hue 0-360, saturation 0-1, value 0-1] dominant appearance
     tex     — surface roughness 0 (smooth/liquid) … 1 (very textured)
     dens    — g per ml, used when a portion is estimated from volume
     en      — English label, fed to the on-device zero-shot vision model
   ========================================================================== */

import { NUTRIENT_KEYS } from './nutrients.js';

const FOODS = [];

function f(id, pl, meta, v) {
  const n = {};
  for (let i = 0; i < NUTRIENT_KEYS.length; i++) n[NUTRIENT_KEYS[i]] = v[i] || 0;
  FOODS.push({
    id, name: pl, kind: 'food',
    en: meta.en, cat: meta.cat, emoji: meta.emoji,
    serving: meta.serving || 100,
    unit: meta.unit || null,
    unitName: meta.unitName || null,
    color: meta.color || [40, 0.3, 0.7],
    tex: meta.tex ?? 0.5,
    dens: meta.dens ?? 1,
    tags: meta.tags || [],
    per100: n,
  });
}

/* ---------------- mięso, ryby, jaja ---------------- */

f('chicken_breast', 'Pierś z kurczaka', { en: 'grilled chicken breast', cat: 'protein', emoji: '🍗', serving: 150, color: [35, .22, .78], tex: .55, tags: ['obiad', 'białko'] },
  [165, 31, 0, 3.6, 0, 0, 1.0, 74, 256, 15, 1.0, 29, 1.0, .04, 27, 228, .03, .6, 85, 9, .07, .11, 13.7, 1.0, .60, 5, 4, .30, 0, .1, .30, .3]);

f('chicken_thigh', 'Udko z kurczaka', { en: 'roasted chicken thigh', cat: 'protein', emoji: '🍗', serving: 140, color: [28, .38, .62], tex: .6 },
  [209, 26, 0, 10.9, 0, 0, 3.0, 88, 230, 12, 1.3, 23, 2.2, .09, 22, 190, .06, 2.1, 135, 16, .07, .20, 6.2, 1.2, .35, 5, 8, .90, 0, .2, .40, 2.6]);

f('turkey_breast', 'Pierś z indyka', { en: 'roasted turkey breast', cat: 'protein', emoji: '🦃', serving: 150, color: [35, .18, .80], tex: .5 },
  [135, 30, 0, 1.0, 0, 0, .3, 64, 302, 12, 1.1, 29, 1.6, .06, 28, 230, .02, .2, 68, 6, .05, .14, 9.9, .90, .70, 5, 6, .40, 0, .2, .10, 0]);

f('beef_lean', 'Wołowina chuda', { en: 'grilled lean beef steak', cat: 'protein', emoji: '🥩', serving: 150, color: [12, .55, .42], tex: .62 },
  [217, 26, 0, 12, 0, 0, 4.6, 56, 318, 18, 2.6, 24, 5.4, .09, 26, 210, .02, .3, 78, 0, .08, .18, 5.5, .60, .50, 3, 8, 2.40, 0, .1, .40, 1.5]);

f('ground_beef', 'Mielone wołowe', { en: 'cooked ground beef', cat: 'protein', emoji: '🥩', serving: 120, color: [16, .48, .38], tex: .75 },
  [254, 26, 0, 16, 0, 0, 6.2, 78, 318, 24, 2.5, 21, 5.9, .08, 21, 198, .03, .4, 88, 0, .05, .20, 5.1, .60, .35, 3, 9, 2.60, 0, .1, .40, 1.3]);

f('pork_loin', 'Schab', { en: 'roasted pork loin', cat: 'protein', emoji: '🥓', serving: 140, color: [20, .35, .62], tex: .55 },
  [143, 26, 0, 3.5, 0, 0, 1.2, 53, 423, 6, .90, 28, 2.0, .07, 38, 246, .01, .3, 70, 2, .90, .30, 8.0, .90, .60, 3, 1, .70, .6, .7, .20, 0]);

f('pork_cutlet', 'Kotlet schabowy', { en: 'breaded fried pork cutlet', cat: 'protein', emoji: '🍖', serving: 160, color: [30, .55, .60], tex: .8, tags: ['obiad'] },
  [290, 22, 12, 17, .6, .8, 4.2, 300, 350, 25, 1.3, 25, 1.8, .08, 30, 200, .15, 3.5, 85, 12, .60, .25, 6.5, .80, .40, 4, 12, .60, .4, .6, 1.80, 6]);

f('salmon', 'Łosoś', { en: 'baked salmon fillet', cat: 'protein', emoji: '🐟', serving: 150, color: [18, .62, .78], tex: .45, tags: ['omega3'] },
  [208, 20, 0, 13, 0, 0, 3.1, 59, 363, 9, .30, 27, .40, .05, 36, 240, 2.30, .70, 55, 12, .23, .15, 8.5, 1.60, .60, 5, 26, 3.20, 0, 11, 3.50, .1]);

f('cod', 'Dorsz', { en: 'baked cod fillet', cat: 'protein', emoji: '🐟', serving: 160, color: [40, .08, .88], tex: .4 },
  [82, 18, 0, .7, 0, 0, .1, 54, 413, 16, .40, 32, .50, .03, 33, 203, .20, .01, 43, 12, .08, .07, 2.1, .15, .24, 2, 7, .90, 1, 1.1, .60, .1]);

f('tuna_can', 'Tuńczyk z puszki', { en: 'canned tuna in water', cat: 'protein', emoji: '🐟', serving: 120, color: [25, .30, .60], tex: .7 },
  [116, 26, 0, 1.0, 0, 0, .3, 320, 237, 11, 1.0, 28, .70, .05, 68, 185, .25, .02, 36, 5, .03, .07, 13.3, .20, .32, 2, 4, 2.50, 0, 1.7, .50, .1]);

f('mackerel', 'Makrela', { en: 'smoked mackerel', cat: 'protein', emoji: '🐟', serving: 120, color: [30, .35, .55], tex: .55, tags: ['omega3'] },
  [205, 19, 0, 13.9, 0, 0, 3.3, 90, 314, 12, 1.6, 76, .60, .07, 44, 217, 2.60, .20, 70, 50, .18, .35, 9.1, .90, .40, 6, 1, 8.70, .4, 16, 1.50, 5]);

f('herring', 'Śledź', { en: 'pickled herring', cat: 'protein', emoji: '🐟', serving: 100, color: [35, .20, .70], tex: .5 },
  [158, 18, 0, 9, 0, 0, 2.0, 90, 327, 57, 1.1, 32, 1.0, .09, 36, 236, 1.70, .13, 60, 28, .09, .23, 3.2, .60, .30, 5, 9, 13.7, .7, 4.2, 1.10, .1]);

f('shrimp', 'Krewetki', { en: 'cooked shrimp', cat: 'protein', emoji: '🍤', serving: 120, color: [12, .55, .82], tex: .5 },
  [99, 24, .2, .3, 0, 0, .05, 111, 259, 70, .50, 39, 1.6, .26, 38, 237, .30, .02, 189, 54, .02, .02, 1.8, .30, .16, 1, 19, 1.30, 0, .1, 1.20, .3]);

f('egg', 'Jajko', { en: 'boiled egg', cat: 'protein', emoji: '🥚', serving: 55, unit: 55, unitName: 'sztuka', color: [45, .35, .92], tex: .35, tags: ['śniadanie'] },
  [143, 12.6, .7, 9.5, 0, .4, 3.1, 142, 138, 56, 1.8, 12, 1.3, .07, 30, 198, .08, 1.6, 372, 160, .04, .46, .08, 1.50, .17, 25, 47, 1.10, 0, 2.0, 1.05, .3]);

f('egg_white', 'Białko jaja', { en: 'egg whites', cat: 'protein', emoji: '🥚', serving: 100, color: [50, .05, .95], tex: .2 },
  [52, 10.9, .7, .2, 0, .7, 0, 166, 163, 7, .08, 11, .03, .02, 20, 15, 0, 0, 0, 0, .004, .44, .10, .19, .005, 7, 4, .09, 0, 0, 0, 0]);

f('ham', 'Szynka', { en: 'sliced ham', cat: 'protein', emoji: '🥓', serving: 40, color: [355, .35, .78], tex: .4 },
  [145, 21, 1.5, 6, 0, 1, 2.0, 1200, 300, 9, .90, 20, 1.5, .06, 20, 220, .05, .5, 53, 0, .50, .20, 4.5, .50, .35, 3, 4, .60, 0, .5, .20, 0]);

f('kabanos', 'Kabanos', { en: 'dry smoked sausage', cat: 'protein', emoji: '🌭', serving: 35, color: [10, .55, .45], tex: .65 },
  [470, 25, 1, 40, 0, .5, 15, 1600, 300, 12, 1.5, 18, 2.5, .10, 25, 180, .20, 3.5, 90, 0, .35, .20, 4.5, .60, .30, 4, 3, 1.20, 0, .5, .30, 1]);

f('liver_chicken', 'Wątróbka drobiowa', { en: 'chicken liver', cat: 'protein', emoji: '🍖', serving: 100, color: [5, .50, .35], tex: .55, tags: ['żelazo'] },
  [119, 17, .7, 4.8, 0, 0, 1.6, 71, 230, 8, 9.0, 19, 2.7, .49, 55, 297, .03, .5, 345, 3296, .30, 1.78, 9.7, 6.20, .76, 187, 588, 16.6, 18, .4, .70, 0]);

/* ---------------- nabiał ---------------- */

f('milk', 'Mleko 2%', { en: 'glass of milk', cat: 'dairy', emoji: '🥛', serving: 250, dens: 1.03, color: [45, .04, .97], tex: .05 },
  [50, 3.3, 4.8, 2, 0, 4.8, 1.2, 44, 150, 120, .03, 11, .40, .01, 2, 95, .01, .05, 8, 58, .04, .18, .10, .36, .04, 2, 5, .50, .5, 1.3, .03, .2]);

f('yogurt', 'Jogurt naturalny', { en: 'plain yogurt', cat: 'dairy', emoji: '🥣', serving: 180, dens: 1.03, color: [45, .05, .96], tex: .15 },
  [61, 3.5, 4.7, 3.3, 0, 4.7, 2.1, 46, 155, 121, .05, 12, .60, .01, 2, 95, .02, .07, 13, 27, .03, .14, .08, .39, .03, 2, 7, .37, .5, .1, .06, .2]);

f('skyr', 'Skyr', { en: 'skyr high protein yogurt', cat: 'dairy', emoji: '🥣', serving: 150, dens: 1.05, color: [48, .04, .97], tex: .2, tags: ['białko'] },
  [63, 11, 4, .2, 0, 4, .1, 44, 141, 110, .05, 11, .60, .01, 9, 135, 0, 0, 5, 1, .03, .20, .15, .40, .06, 2, 8, .75, 0, 0, 0, 0]);

f('cottage_cheese', 'Twaróg półtłusty', { en: 'cottage cheese curd', cat: 'dairy', emoji: '🧀', serving: 150, color: [48, .05, .95], tex: .6, tags: ['białko'] },
  [133, 18, 3.5, 5, 0, 3.5, 3.0, 40, 110, 85, .15, 11, .60, .03, 9, 180, .02, .10, 17, 40, .03, .25, .13, .50, .07, 2, 12, .60, 0, .1, .10, .2]);

f('cheese_gouda', 'Ser żółty', { en: 'slice of gouda cheese', cat: 'dairy', emoji: '🧀', serving: 30, color: [45, .55, .90], tex: .3 },
  [356, 25, 2.2, 27, 0, 2.2, 17.6, 819, 121, 700, .24, 29, 3.9, .04, 14, 546, .30, .50, 114, 165, .03, .33, .20, .34, .08, 2, 21, 1.50, 0, .5, .24, 2.3]);

f('mozzarella', 'Mozzarella', { en: 'fresh mozzarella', cat: 'dairy', emoji: '🧀', serving: 60, color: [48, .04, .96], tex: .25 },
  [280, 22, 2.2, 21, 0, 1.0, 13, 627, 76, 505, .44, 20, 2.9, .02, 17, 354, .20, .40, 79, 174, .03, .28, .10, .14, .04, 2, 7, 2.30, 0, .4, .19, 2.3]);

f('kefir', 'Kefir', { en: 'kefir drink', cat: 'dairy', emoji: '🥛', serving: 250, dens: 1.03, color: [45, .04, .96], tex: .08 },
  [55, 3.3, 4, 2, 0, 4, 1.3, 40, 164, 120, .04, 12, .40, .01, 2, 93, .01, .05, 8, 25, .03, .16, .09, .35, .05, 2, 6, .30, .5, .1, .05, .2]);

f('cream', 'Śmietana 18%', { en: 'sour cream', cat: 'dairy', emoji: '🥛', serving: 30, dens: 1.0, color: [45, .05, .95], tex: .1 },
  [184, 2.6, 3.6, 18, 0, 3.4, 11, 40, 120, 95, .05, 10, .30, .01, 2, 80, .10, .35, 60, 180, .03, .15, .08, .30, .03, 2, 6, .30, .6, .7, .40, 1.5]);

f('whey', 'Odżywka białkowa', { en: 'whey protein powder', cat: 'supp', emoji: '🥤', serving: 30, dens: .5, color: [35, .15, .88], tex: .7, tags: ['białko'] },
  [380, 78, 8, 5, 1, 5, 2.5, 380, 500, 450, .60, 60, 3.5, .10, 25, 400, .05, .40, 50, 10, .10, 1.20, 1.0, 2.00, .50, 10, 20, 2.50, 2, .5, .50, 0]);

f('butter', 'Masło', { en: 'butter', cat: 'fat', emoji: '🧈', serving: 10, color: [48, .40, .95], tex: .15 },
  [717, .9, .1, 81, 0, .1, 51, 11, 24, 24, .02, 2, .09, 0, 1, 24, .30, 2.20, 215, 684, .005, .03, .04, .11, .003, .4, 3, .17, 0, 1.5, 2.30, 7]);

/* ---------------- zboża i skrobia ---------------- */

f('rice_white', 'Ryż biały', { en: 'cooked white rice', cat: 'grain', emoji: '🍚', serving: 200, dens: .85, color: [45, .05, .94], tex: .7, tags: ['obiad'] },
  [130, 2.7, 28, .3, .4, .05, .07, 1, 35, 10, .20, 12, .50, .07, 8, 43, .01, .08, 0, 0, .02, .01, .40, .39, .05, .5, 58, 0, 0, 0, .04, 0]);

f('rice_brown', 'Ryż brązowy', { en: 'cooked brown rice', cat: 'grain', emoji: '🍚', serving: 200, dens: .85, color: [35, .25, .68], tex: .72 },
  [123, 2.7, 26, 1, 1.6, .3, .26, 4, 86, 3, .60, 39, .70, .10, 6, 103, .01, .35, 0, 0, .10, .02, 1.50, .40, .15, 1, 4, 0, 0, 0, .10, .6]);

f('pasta', 'Makaron', { en: 'cooked pasta', cat: 'grain', emoji: '🍝', serving: 220, dens: .7, color: [45, .30, .90], tex: .55, tags: ['obiad'] },
  [158, 5.8, 31, .9, 1.8, .6, .17, 1, 44, 7, .50, 18, .50, .08, 26, 58, .01, .30, 0, 0, .10, .05, .40, .10, .05, 1, 7, 0, 0, 0, .06, 0]);

f('pasta_wholegrain', 'Makaron pełnoziarnisty', { en: 'cooked whole wheat pasta', cat: 'grain', emoji: '🍝', serving: 220, dens: .7, color: [32, .35, .60], tex: .6 },
  [124, 5.3, 27, .5, 3.9, .8, .10, 3, 62, 15, 1.1, 43, 1.1, .20, 26, 125, .01, .20, 0, 0, .10, .06, 1.00, .20, .07, 2, 6, 0, 0, 0, .20, .3]);

f('buckwheat', 'Kasza gryczana', { en: 'cooked buckwheat groats', cat: 'grain', emoji: '🍚', serving: 200, dens: .8, color: [28, .35, .45], tex: .8 },
  [92, 3.4, 20, .6, 2.7, .9, .13, 4, 88, 7, .80, 51, .60, .15, 2, 70, .02, .20, 0, 0, .04, .04, .90, .36, .08, 3, 14, 0, 0, 0, .08, 1.9]);

f('millet', 'Kasza jaglana', { en: 'cooked millet', cat: 'grain', emoji: '🍚', serving: 200, dens: .8, color: [48, .40, .85], tex: .75 },
  [119, 3.5, 23, 1, 1.3, .1, .17, 2, 62, 3, .60, 44, .90, .16, 1, 100, .02, .40, 0, 0, .10, .08, 1.30, .17, .10, 2, 19, 0, 0, 0, .02, .3]);

f('oats', 'Płatki owsiane', { en: 'raw rolled oats', cat: 'grain', emoji: '🥣', serving: 70, dens: .4, color: [42, .25, .82], tex: .8, tags: ['śniadanie'] },
  [379, 13, 67, 6.5, 10, 1, 1.2, 6, 362, 52, 4.7, 138, 3.6, .40, 28, 410, .10, 2.40, 0, 0, .50, .15, 1.10, 1.30, .10, 20, 32, 0, 0, 0, .40, 2]);

f('bread_rye', 'Chleb żytni', { en: 'slice of rye bread', cat: 'grain', emoji: '🍞', serving: 35, unit: 35, unitName: 'kromka', color: [28, .45, .45], tex: .7 },
  [259, 8.5, 48, 3.3, 5.8, 3.9, .60, 603, 166, 73, 2.8, 40, 1.8, .20, 30, 125, .05, 1.20, 0, 0, .40, .30, 3.80, .44, .10, 2, 40, 0, .4, 0, .30, 1.2]);

f('bread_wheat', 'Chleb pszenny', { en: 'slice of white bread', cat: 'grain', emoji: '🍞', serving: 35, unit: 35, unitName: 'kromka', color: [40, .35, .82], tex: .6 },
  [265, 9, 49, 3.2, 2.7, 5, .70, 491, 115, 144, 3.6, 23, .90, .15, 22, 99, .03, 1.20, 0, 0, .50, .30, 4.40, .40, .09, 1, 85, 0, 0, 0, .20, .5]);

f('bread_wholegrain', 'Chleb pełnoziarnisty', { en: 'slice of whole grain bread', cat: 'grain', emoji: '🍞', serving: 40, unit: 40, unitName: 'kromka', color: [30, .40, .55], tex: .78 },
  [247, 13, 41, 3.4, 7, 6, .70, 450, 250, 107, 2.5, 82, 1.8, .30, 30, 212, .05, 1.50, 0, 0, .40, .25, 4.40, .60, .20, 3, 42, 0, 0, 0, .50, 1.9]);

f('roll', 'Bułka', { en: 'wheat bread roll', cat: 'grain', emoji: '🥖', serving: 60, unit: 60, unitName: 'sztuka', color: [38, .40, .85], tex: .6 },
  [290, 9.9, 54, 2.5, 2.3, 2, .50, 540, 104, 93, 3.4, 23, .90, .13, 24, 95, .02, 1.00, 0, 0, .50, .35, 4.50, .40, .05, 1, 80, 0, 0, 0, .20, .4]);

f('potato', 'Ziemniaki', { en: 'boiled potatoes', cat: 'grain', emoji: '🥔', serving: 250, dens: .9, color: [45, .30, .88], tex: .55, tags: ['obiad'] },
  [87, 2, 20, .1, 1.8, .9, .03, 4, 379, 8, .30, 20, .30, .19, .3, 44, .01, .03, 0, 0, .10, .02, 1.30, .50, .30, .2, 10, 0, 13, 0, .01, 2.2]);

f('sweet_potato', 'Batat', { en: 'baked sweet potato', cat: 'grain', emoji: '🍠', serving: 200, dens: .9, color: [25, .70, .82], tex: .6 },
  [90, 2, 21, .15, 3.3, 6.5, .05, 36, 475, 38, .70, 27, .30, .16, .2, 54, .01, .06, 0, 961, .10, .11, 1.50, .88, .29, 1, 6, 0, 19.6, 0, .70, 2.3]);

f('fries', 'Frytki', { en: 'french fries', cat: 'grain', emoji: '🍟', serving: 150, dens: .5, color: [42, .65, .88], tex: .7 },
  [312, 3.4, 41, 15, 3.8, .3, 2.3, 210, 579, 18, .80, 32, .50, .15, .3, 107, .06, 4.50, 0, 0, .13, .05, 2.60, .50, .30, .5, 25, 0, 6, 0, 1.50, 12]);

f('corn', 'Kukurydza', { en: 'sweet corn kernels', cat: 'veg', emoji: '🌽', serving: 120, dens: .8, color: [48, .70, .92], tex: .5 },
  [86, 3.2, 19, 1.2, 2.7, 6.3, .20, 15, 270, 2, .50, 37, .50, .05, .6, 89, .02, .50, 0, 9, .15, .06, 1.70, .70, .10, 1, 42, 0, 6.8, 0, .07, .3]);

f('couscous', 'Kuskus', { en: 'cooked couscous', cat: 'grain', emoji: '🍚', serving: 200, dens: .8, color: [42, .30, .85], tex: .7 },
  [112, 3.8, 23, .16, 1.4, .1, .03, 5, 58, 8, .40, 8, .26, .04, 27, 22, 0, .06, 0, 0, .06, .03, .98, .37, .05, 1, 15, 0, 0, 0, .10, .1]);

f('tortilla', 'Tortilla pszenna', { en: 'wheat tortilla wrap', cat: 'grain', emoji: '🌯', serving: 62, unit: 62, unitName: 'sztuka', color: [42, .25, .88], tex: .45 },
  [306, 8, 51, 7.7, 3, 2.5, 2.0, 580, 130, 140, 3.2, 25, .70, .15, 22, 220, .05, 3.00, 0, 0, .40, .25, 3.50, .40, .05, 1, 50, 0, 0, 0, .50, .4]);

f('granola', 'Granola', { en: 'granola cereal', cat: 'grain', emoji: '🥣', serving: 60, dens: .45, color: [30, .50, .65], tex: .85 },
  [471, 10, 64, 20, 7, 20, 3.5, 26, 380, 70, 3.5, 120, 2.5, .40, 15, 330, .50, 6.50, 0, 1, .40, .20, 1.50, .90, .20, 12, 40, 0, .5, 0, 5.00, 2]);

f('rice_cake', 'Wafle ryżowe', { en: 'puffed rice cakes', cat: 'grain', emoji: '🍘', serving: 20, unit: 9, unitName: 'sztuka', color: [45, .10, .92], tex: .9 },
  [387, 8, 81, 3, 4, .4, .60, 26, 280, 12, 1.4, 110, 2.5, .40, 12, 300, .02, 1.10, 0, 0, .10, .05, 5.00, .60, .30, 3, 12, 0, 0, 0, .40, .2]);

/* ---------------- warzywa ---------------- */

f('broccoli', 'Brokuł', { en: 'steamed broccoli', cat: 'veg', emoji: '🥦', serving: 150, dens: .6, color: [95, .55, .45], tex: .85 },
  [34, 2.8, 7, .4, 2.6, 1.7, .04, 33, 316, 47, .70, 21, .40, .05, 2.5, 66, .02, .02, 0, 31, .07, .12, .64, .57, .18, 1.5, 63, 0, 89, 0, .78, 102]);

f('carrot', 'Marchew', { en: 'raw carrot', cat: 'veg', emoji: '🥕', serving: 100, dens: .7, color: [28, .85, .90], tex: .5 },
  [41, .9, 10, .2, 2.8, 4.7, .03, 69, 320, 33, .30, 12, .24, .05, .1, 35, .002, .11, 0, 835, .07, .06, .98, .27, .14, .5, 19, 0, 5.9, 0, .66, 13]);

f('tomato', 'Pomidor', { en: 'fresh tomato', cat: 'veg', emoji: '🍅', serving: 120, dens: .95, color: [5, .80, .85], tex: .25 },
  [18, .9, 3.9, .2, 1.2, 2.6, .03, 5, 237, 10, .30, 11, .17, .06, 0, 24, .003, .08, 0, 42, .04, .02, .60, .09, .08, 1.5, 15, 0, 13.7, 0, .54, 7.9]);

f('cucumber', 'Ogórek', { en: 'sliced cucumber', cat: 'veg', emoji: '🥒', serving: 100, dens: .95, color: [85, .45, .70], tex: .2 },
  [15, .7, 3.6, .1, .5, 1.7, .04, 2, 147, 16, .30, 13, .20, .04, .3, 24, .005, .03, 0, 5, .03, .03, .10, .26, .04, .9, 7, 0, 2.8, 0, .03, 16]);

f('spinach', 'Szpinak', { en: 'fresh spinach leaves', cat: 'veg', emoji: '🥬', serving: 80, dens: .3, color: [110, .60, .40], tex: .6 },
  [23, 2.9, 3.6, .4, 2.2, .4, .06, 79, 558, 99, 2.7, 79, .53, .13, 1, 49, .14, .03, 0, 469, .08, .19, .72, .07, .20, 1, 194, 0, 28, 0, 2.03, 483]);

f('pepper_red', 'Papryka czerwona', { en: 'red bell pepper', cat: 'veg', emoji: '🫑', serving: 120, dens: .7, color: [2, .85, .88], tex: .3 },
  [31, 1, 6, .3, 2.1, 4.2, .03, 4, 211, 7, .43, 12, .25, .02, .1, 26, .01, .05, 0, 157, .05, .09, .98, .32, .29, 1, 46, 0, 128, 0, 1.58, 4.9]);

f('onion', 'Cebula', { en: 'chopped onion', cat: 'veg', emoji: '🧅', serving: 60, dens: .8, color: [45, .15, .92], tex: .35 },
  [40, 1.1, 9.3, .1, 1.7, 4.2, .04, 4, 146, 23, .21, 10, .17, .04, .5, 29, .004, .01, 0, 0, .05, .03, .12, .12, .12, .9, 19, 0, 7.4, 0, .02, .4]);

f('lettuce', 'Sałata', { en: 'lettuce leaves', cat: 'veg', emoji: '🥬', serving: 60, dens: .25, color: [95, .50, .70], tex: .5 },
  [15, 1.4, 2.9, .2, 1.3, .8, .03, 28, 194, 36, .90, 13, .20, .03, .6, 29, .06, .02, 0, 370, .07, .08, .38, .13, .09, 1, 38, 0, 9.2, 0, .29, 126]);

f('cabbage', 'Kapusta', { en: 'shredded cabbage', cat: 'veg', emoji: '🥬', serving: 100, dens: .5, color: [80, .25, .85], tex: .55 },
  [25, 1.3, 5.8, .1, 2.5, 3.2, .03, 18, 170, 40, .47, 12, .18, .02, .3, 26, .02, .02, 0, 5, .06, .04, .23, .21, .12, .4, 43, 0, 36.6, 0, .15, 76]);

f('beetroot', 'Burak', { en: 'cooked beetroot', cat: 'veg', emoji: '🫐', serving: 120, dens: .9, color: [340, .70, .40], tex: .4 },
  [43, 1.6, 9.6, .2, 2.8, 6.8, .03, 78, 325, 16, .80, 23, .35, .08, .7, 40, .005, .06, 0, 2, .03, .04, .33, .16, .07, .4, 109, 0, 4.9, 0, .04, .2]);

f('zucchini', 'Cukinia', { en: 'grilled zucchini', cat: 'veg', emoji: '🥒', serving: 120, dens: .8, color: [90, .40, .65], tex: .35 },
  [17, 1.2, 3.1, .3, 1, 2.5, .08, 8, 261, 16, .37, 18, .32, .05, .2, 38, .06, .03, 0, 10, .04, .09, .45, .20, .16, 1, 24, 0, 17.9, 0, .12, 4.3]);

f('mushroom', 'Pieczarki', { en: 'sauteed mushrooms', cat: 'veg', emoji: '🍄', serving: 100, dens: .5, color: [35, .20, .75], tex: .5 },
  [22, 3.1, 3.3, .3, 1, 2, .05, 5, 318, 3, .50, 9, .52, .32, 9.3, 86, 0, .14, 0, 0, .08, .40, 3.60, 1.50, .10, 12, 17, .04, 2.1, .2, .01, 0]);

f('peas', 'Groszek', { en: 'green peas', cat: 'veg', emoji: '🫛', serving: 120, dens: .8, color: [90, .60, .60], tex: .5 },
  [81, 5.4, 14, .4, 5.1, 5.7, .07, 5, 244, 25, 1.5, 33, 1.24, .18, 1.8, 108, .03, .15, 0, 38, .27, .13, 2.10, .10, .17, .7, 65, 0, 40, 0, .13, 25]);

f('green_beans', 'Fasolka szparagowa', { en: 'green beans', cat: 'veg', emoji: '🫛', serving: 120, dens: .6, color: [95, .55, .55], tex: .45 },
  [31, 1.8, 7, .1, 2.7, 3.3, .03, 6, 211, 37, 1.0, 25, .24, .07, .6, 38, .05, .03, 0, 35, .08, .10, .75, .09, .14, .5, 33, 0, 12.2, 0, .41, 43]);

f('kale', 'Jarmuż', { en: 'kale leaves', cat: 'veg', emoji: '🥬', serving: 70, dens: .3, color: [105, .60, .35], tex: .8 },
  [49, 4.3, 8.8, .9, 3.6, 2.3, .09, 38, 491, 150, 1.5, 47, .56, .29, .9, 92, .18, .14, 0, 500, .11, .13, 1.00, .09, .27, .5, 141, 0, 120, 0, 1.54, 705]);

f('avocado', 'Awokado', { en: 'avocado half', cat: 'fat', emoji: '🥑', serving: 100, dens: .95, color: [75, .55, .55], tex: .3 },
  [160, 2, 8.5, 15, 6.7, .7, 2.1, 7, 485, 12, .55, 29, .64, .19, .4, 52, .11, 1.70, 0, 7, .07, .13, 1.74, 1.39, .26, 3.6, 81, 0, 10, 0, 2.07, 21]);

f('sauerkraut', 'Kapusta kiszona', { en: 'sauerkraut', cat: 'veg', emoji: '🥬', serving: 100, dens: .7, color: [50, .35, .82], tex: .7 },
  [19, .9, 4.3, .1, 2.9, 1.8, .03, 661, 170, 30, 1.5, 13, .19, .10, .6, 20, .01, .04, 0, 1, .02, .02, .14, .09, .13, .5, 24, 0, 15, 0, .14, 13]);

f('garlic', 'Czosnek', { en: 'garlic cloves', cat: 'veg', emoji: '🧄', serving: 6, color: [45, .10, .92], tex: .4 },
  [149, 6.4, 33, .5, 2.1, 1, .09, 17, 401, 181, 1.7, 25, 1.16, .30, 14, 153, .02, .23, 0, 0, .20, .11, .70, .60, 1.24, 1, 3, 0, 31, 0, .08, 1.7]);

f('parsley', 'Natka pietruszki', { en: 'fresh parsley', cat: 'veg', emoji: '🌿', serving: 10, dens: .2, color: [105, .70, .45], tex: .7 },
  [36, 3, 6.3, .8, 3.3, .9, .13, 56, 554, 138, 6.2, 50, 1.07, .15, .1, 58, .01, .12, 0, 421, .09, .10, 1.30, .40, .09, .4, 152, 0, 133, 0, .75, 1640]);

f('cauliflower', 'Kalafior', { en: 'steamed cauliflower', cat: 'veg', emoji: '🥦', serving: 150, dens: .6, color: [50, .06, .90], tex: .7 },
  [23, 1.8, 4.1, .3, 2.3, 1.9, .05, 15, 142, 16, .35, 9, .21, .04, .3, 30, .02, .05, 0, 0, .04, .04, .38, .50, .18, .5, 44, 0, 44, 0, .02, 15]);

f('eggplant', 'Bakłażan', { en: 'roasted eggplant', cat: 'veg', emoji: '🍆', serving: 150, dens: .55, color: [280, .55, .30], tex: .45 },
  [35, 1, 8.6, .2, 3, 3.2, .04, 2, 229, 6, .23, 11, .16, .08, .3, 15, .01, .07, 0, 1, .04, .02, .60, .28, .08, 0, 14, 0, 1.3, 0, .30, 3.5]);

f('radish', 'Rzodkiewka', { en: 'fresh radishes', cat: 'veg', emoji: '🌰', serving: 60, dens: .8, color: [345, .60, .85], tex: .3 },
  [16, .7, 3.4, .1, 1.6, 1.9, 0, 39, 233, 25, .34, 10, .28, .05, .6, 20, 0, .01, 0, 0, .01, .04, .25, .16, .07, 0, 25, 0, 14.8, 0, 0, 1.3]);

f('leek', 'Por', { en: 'cooked leek', cat: 'veg', emoji: '🧅', serving: 120, dens: .5, color: [95, .35, .55], tex: .4 },
  [31, .8, 7.3, .2, .9, 3.5, .03, 10, 90, 47, 1.0, 22, .09, .06, .5, 21, .01, .05, 0, 2, .03, .03, .35, .09, .19, 0, 28, 0, 4, 0, .68, 41]);

f('celery_stalk', 'Seler naciowy', { en: 'celery stalks', cat: 'veg', emoji: '🥬', serving: 80, dens: .5, color: [85, .30, .75], tex: .5 },
  [16, .7, 3, .17, 1.6, 1.3, .04, 80, 260, 40, .2, 11, .13, .04, .4, 24, .01, .07, 0, 22, .02, .06, .32, .25, .07, 0, 36, 0, 3.1, 0, .27, 29]);

f('pumpkin', 'Dynia', { en: 'roasted pumpkin', cat: 'veg', emoji: '🎃', serving: 180, dens: .7, color: [30, .70, .80], tex: .5 },
  [20, .7, 4.9, .1, 1.1, 2, .05, 1, 230, 15, .57, 9, .28, .09, .3, 30, 0, .01, 0, 245, .04, .11, .50, .30, .06, 0, 9, 0, 4.7, 0, 1.06, 1]);

f('brussels_sprouts', 'Brukselka', { en: 'roasted brussels sprouts', cat: 'veg', emoji: '🥬', serving: 150, dens: .55, color: [100, .55, .40], tex: .65 },
  [36, 2.6, 7.1, .3, 3.8, 1.7, .06, 20, 317, 32, 1.2, 20, .40, .07, .6, 60, .10, .02, 0, 38, .08, .09, .50, .31, .22, 0, 61, 0, 62, 0, .30, 140]);

f('asparagus', 'Szparagi', { en: 'grilled asparagus', cat: 'veg', emoji: '🥦', serving: 150, dens: .5, color: [95, .45, .55], tex: .55 },
  [22, 2.4, 4.1, .2, 2, 1.3, .04, 14, 224, 23, 1.14, 14, .54, .13, 4.1, 54, .02, .03, 0, 60, .14, .14, 1.15, .27, .10, .5, 52, 0, 7.7, 0, 1.5, 43]);

f('arugula', 'Rukola', { en: 'arugula leaves', cat: 'veg', emoji: '🥬', serving: 40, dens: .25, color: [105, .55, .45], tex: .55 },
  [25, 2.6, 3.7, .66, 1.6, 2.1, .08, 27, 369, 160, 1.46, 47, .47, .08, .3, 52, .17, .08, 0, 119, .04, .09, .30, .44, .07, 0, 97, 0, 15, 0, .43, 109]);

/* ---------------- owoce ---------------- */

f('banana', 'Banan', { en: 'banana', cat: 'fruit', emoji: '🍌', serving: 120, unit: 120, unitName: 'sztuka', color: [50, .70, .92], tex: .3, tags: ['przekąska', 'potas'] },
  [89, 1.1, 23, .3, 2.6, 12, .11, 1, 358, 5, .26, 27, .15, .08, 1, 22, .03, .05, 0, 3, .03, .07, .67, .33, .37, .2, 20, 0, 8.7, 0, .10, .5]);

f('apple', 'Jabłko', { en: 'apple', cat: 'fruit', emoji: '🍎', serving: 150, unit: 150, unitName: 'sztuka', color: [10, .70, .80], tex: .25 },
  [52, .3, 14, .2, 2.4, 10, .03, 1, 107, 6, .12, 5, .04, .03, 0, 11, .01, .04, 0, 3, .02, .03, .09, .06, .04, .3, 3, 0, 4.6, 0, .18, 2.2]);

f('orange', 'Pomarańcza', { en: 'orange', cat: 'fruit', emoji: '🍊', serving: 130, unit: 130, unitName: 'sztuka', color: [30, .90, .95], tex: .45 },
  [47, .9, 12, .1, 2.4, 9, .02, 0, 181, 40, .10, 10, .07, .05, .5, 14, .007, .02, 0, 11, .09, .04, .28, .25, .06, 1, 30, 0, 53, 0, .18, 0]);

f('blueberry', 'Borówki', { en: 'blueberries', cat: 'fruit', emoji: '🫐', serving: 100, dens: .7, color: [230, .55, .40], tex: .35 },
  [57, .7, 14, .3, 2.4, 10, .03, 1, 77, 6, .28, 6, .16, .06, .1, 12, .06, .09, 0, 3, .04, .04, .42, .12, .05, .5, 6, 0, 9.7, 0, .57, 19]);

f('strawberry', 'Truskawki', { en: 'strawberries', cat: 'fruit', emoji: '🍓', serving: 150, dens: .65, color: [355, .80, .85], tex: .4 },
  [32, .7, 7.7, .3, 2, 4.9, .02, 1, 153, 16, .41, 13, .14, .05, .4, 24, .07, .09, 0, 1, .02, .02, .39, .13, .05, 1.5, 24, 0, 58.8, 0, .29, 2.2]);

f('grapes', 'Winogrona', { en: 'grapes', cat: 'fruit', emoji: '🍇', serving: 120, dens: .8, color: [280, .35, .50], tex: .25 },
  [69, .7, 18, .2, .9, 15, .05, 2, 191, 10, .36, 7, .07, .13, .1, 20, .02, .04, 0, 3, .07, .07, .19, .05, .09, .4, 2, 0, 3.2, 0, .19, 14.6]);

f('kiwi', 'Kiwi', { en: 'kiwi fruit', cat: 'fruit', emoji: '🥝', serving: 90, unit: 90, unitName: 'sztuka', color: [75, .60, .65], tex: .5 },
  [61, 1.1, 15, .5, 3, 9, .03, 3, 312, 34, .31, 17, .14, .13, .2, 34, .04, .25, 0, 4, .03, .03, .34, .18, .06, .5, 25, 0, 92.7, 0, 1.46, 40]);

f('raspberry', 'Maliny', { en: 'raspberries', cat: 'fruit', emoji: '🍓', serving: 100, dens: .6, color: [345, .70, .75], tex: .55 },
  [52, 1.2, 12, .7, 6.5, 4.4, .02, 1, 151, 25, .69, 22, .42, .09, .2, 29, .13, .25, 0, 2, .03, .04, .60, .33, .06, 1.8, 21, 0, 26.2, 0, .87, 7.8]);

f('dates', 'Daktyle', { en: 'medjool dates', cat: 'fruit', emoji: '🌴', serving: 40, color: [25, .60, .35], tex: .6 },
  [282, 2.5, 75, .4, 8, 63, .03, 2, 656, 39, 1.02, 43, .29, .36, 3, 62, .01, .02, 0, 0, .05, .07, 1.60, .80, .25, 4, 19, 0, .4, 0, .05, 2.7]);

f('raisins', 'Rodzynki', { en: 'raisins', cat: 'fruit', emoji: '🍇', serving: 40, dens: .6, color: [30, .55, .30], tex: .65 },
  [299, 3, 79, .5, 3.7, 59, .06, 11, 749, 50, 1.88, 32, .22, .32, .6, 101, .01, .05, 0, 0, .11, .13, .77, .10, .17, 2, 5, 0, 2.3, 0, .12, 3.5]);

f('apricot_dried', 'Morele suszone', { en: 'dried apricots', cat: 'fruit', emoji: '🍑', serving: 40, color: [28, .80, .75], tex: .6 },
  [241, 3.4, 63, .5, 7.3, 53, .02, 10, 1162, 55, 2.66, 32, .39, .34, 2.2, 71, 0, .08, 0, 180, .02, .07, 2.60, .52, .14, 2, 10, 0, 1, 0, 4.33, 3.1]);

f('watermelon', 'Arbuz', { en: 'watermelon slices', cat: 'fruit', emoji: '🍉', serving: 250, dens: .95, color: [350, .70, .85], tex: .2 },
  [30, .6, 7.6, .15, .4, 6.2, .02, 1, 112, 7, .24, 10, .10, .04, .4, 11, 0, .05, 0, 28, .03, .02, .18, .22, .05, .4, 3, 0, 8.1, 0, .05, .1]);

f('mango', 'Mango', { en: 'mango chunks', cat: 'fruit', emoji: '🥭', serving: 150, dens: .9, color: [40, .85, .92], tex: .3 },
  [60, .8, 15, .4, 1.6, 14, .09, 1, 168, 11, .16, 10, .09, .11, .6, 14, .05, .02, 0, 54, .03, .04, .67, .20, .12, .6, 43, 0, 36.4, 0, .90, 4.2]);

f('pear', 'Gruszka', { en: 'pear', cat: 'fruit', emoji: '🍐', serving: 160, unit: 160, unitName: 'sztuka', color: [60, .45, .78], tex: .3 },
  [57, .4, 15, .1, 3.1, 10, .02, 1, 116, 9, .18, 7, .10, .08, .1, 12, 0, .05, 0, 1, .01, .03, .16, .05, .03, .2, 7, 0, 4.3, 0, .12, 4.4]);

f('plum', 'Śliwka', { en: 'plums', cat: 'fruit', emoji: '🍑', serving: 110, unit: 55, unitName: 'sztuka', color: [285, .45, .35], tex: .25 },
  [46, .7, 11.4, .28, 1.4, 9.9, .02, 0, 157, 6, .17, 7, .10, .06, 0, 16, 0, .05, 0, 17, .03, .03, .42, .14, .03, 0, 5, 0, 9.5, 0, .26, 6.4]);

f('cherries', 'Czereśnie', { en: 'sweet cherries', cat: 'fruit', emoji: '🍒', serving: 120, dens: .7, color: [355, .70, .35], tex: .2 },
  [63, 1.1, 16, .2, 2.1, 12.8, .04, 0, 222, 13, .36, 11, .07, .06, 0, 21, .03, .05, 0, 3, .03, .03, .15, .20, .05, 0, 4, 0, 7, 0, .07, 2.1]);

f('peach', 'Brzoskwinia', { en: 'peach', cat: 'fruit', emoji: '🍑', serving: 150, unit: 150, unitName: 'sztuka', color: [30, .65, .85], tex: .3 },
  [39, .9, 9.5, .25, 1.5, 8.4, .02, 0, 190, 6, .25, 9, .17, .07, 0, 20, 0, .07, 0, 16, .02, .03, .81, .15, .03, 0, 4, 0, 6.6, 0, .73, 2.6]);

f('pineapple', 'Ananas', { en: 'pineapple chunks', cat: 'fruit', emoji: '🍍', serving: 130, dens: .75, color: [50, .75, .90], tex: .35 },
  [50, .5, 13.1, .12, 1.4, 9.9, 0, 1, 109, 13, .29, 12, .12, .11, 0, 8, 0, .02, 0, 3, .08, .03, .50, .21, .11, 0, 18, 0, 47.8, 0, .02, .7]);

f('pomegranate', 'Granat', { en: 'pomegranate arils', cat: 'fruit', emoji: '🍎', serving: 90, dens: .8, color: [345, .60, .55], tex: .5 },
  [83, 1.7, 18.7, 1.2, 4, 13.7, .12, 3, 236, 10, .3, 12, .35, .16, .5, 36, .01, .08, 0, 0, .07, .05, .29, .60, .08, 0, 38, 0, 10.2, 0, .60, 16.4]);

f('fig', 'Figa', { en: 'fresh figs', cat: 'fruit', emoji: '🍈', serving: 100, unit: 50, unitName: 'sztuka', color: [320, .40, .40], tex: .35 },
  [74, .75, 19.2, .3, 2.9, 16.3, .06, 1, 232, 35, .37, 17, .15, .07, 0, 14, 0, .13, 0, 7, .06, .05, .40, .30, .11, 0, 6, 0, 2, 0, .11, 4.7]);

f('grapefruit', 'Grejpfrut', { en: 'grapefruit', cat: 'fruit', emoji: '🍊', serving: 200, unit: 200, unitName: 'sztuka', color: [10, .55, .90], tex: .4 },
  [42, .8, 10.7, .1, 1.6, 6.9, .01, 0, 135, 22, .08, 9, .08, .04, 0, 8, 0, .02, 0, 46, .04, .02, .27, .28, .04, 0, 10, 0, 33.3, 0, .13, 0]);

f('lemon', 'Cytryna', { en: 'lemon', cat: 'fruit', emoji: '🍋', serving: 60, unit: 60, unitName: 'sztuka', color: [55, .75, .90], tex: .35 },
  [29, 1.1, 9.3, .3, 2.8, 2.5, .04, 2, 138, 26, .6, 8, .06, .04, .4, 16, 0, .04, 0, 1, .04, .02, .10, .19, .08, 0, 11, 0, 53, 0, .15, 0]);

f('melon', 'Melon', { en: 'cantaloupe melon', cat: 'fruit', emoji: '🍈', serving: 160, dens: .85, color: [35, .60, .90], tex: .3 },
  [34, .8, 8.2, .2, .9, 7.9, .04, 16, 267, 9, .21, 12, .18, .04, .4, 15, 0, .02, 0, 169, .04, .02, .73, .11, .07, 0, 21, 0, 36.7, 0, .05, 2.5]);

f('coconut', 'Kokos', { en: 'fresh coconut meat', cat: 'fat', emoji: '🥥', serving: 40, dens: .5, color: [40, .05, .95], tex: .6 },
  [354, 3.3, 15.2, 33.5, 9, 6.2, 29.7, 20, 356, 14, 2.4, 32, 1.1, .44, 10.1, 113, 0, .37, 0, 0, .07, .02, .54, .30, .05, 0, 26, 0, 3.3, 0, .24, .2]);

f('blackberry', 'Jeżyny', { en: 'blackberries', cat: 'fruit', emoji: '🫐', serving: 100, dens: .6, color: [290, .55, .25], tex: .5 },
  [43, 1.4, 9.6, .5, 5.3, 4.9, .01, 1, 162, 29, .62, 20, .53, .17, .4, 22, .10, .20, 0, 11, .02, .03, .65, .28, .03, 0, 25, 0, 21, 0, 1.17, 19.8]);

f('blackcurrant', 'Czarna porzeczka', { en: 'blackcurrants', cat: 'fruit', emoji: '🫐', serving: 80, dens: .6, color: [280, .60, .20], tex: .35 },
  [63, 1.4, 15.4, .4, 4.3, 8, .03, 2, 322, 55, 1.5, 24, .27, .09, 0, 59, .01, .09, 0, 12, .05, .05, .30, .40, .07, 0, 0, 0, 181, 0, 1.0, 0]);

f('gooseberry', 'Agrest', { en: 'gooseberries', cat: 'fruit', emoji: '🫐', serving: 100, dens: .6, color: [90, .50, .55], tex: .3 },
  [44, .9, 10.2, .6, 4.3, 6.9, .04, 1, 198, 25, .31, 10, .12, .10, 0, 27, .05, .10, 0, 15, .04, .03, .30, .27, .08, 0, 6, 0, 27.7, 0, .37, 11]);

f('rhubarb', 'Rabarbar', { en: 'stewed rhubarb', cat: 'fruit', emoji: '🌿', serving: 150, dens: .6, color: [350, .40, .70], tex: .35 },
  [25, .5, 5.5, .1, 1.5, 1.1, .02, 2, 218, 145, .1, 10, .10, .02, 1.1, 12, 0, .03, 0, 5, .01, .02, .21, .06, .01, 0, 5, 0, 5.2, 0, .27, 22.4]);

/* ---------------- strączki i roślinne białko ---------------- */

f('lentils', 'Soczewica', { en: 'cooked lentils', cat: 'legume', emoji: '🫘', serving: 180, dens: .85, color: [25, .45, .55], tex: .7 },
  [116, 9, 20, .4, 8, 1.8, .05, 2, 369, 19, 3.3, 36, 1.27, .25, 2.8, 180, .04, .11, 0, 0, .17, .07, 1.06, .64, .18, 1.5, 181, 0, 1.5, 0, .11, 1.7]);

f('chickpeas', 'Ciecierzyca', { en: 'cooked chickpeas', cat: 'legume', emoji: '🫘', serving: 160, dens: .85, color: [42, .45, .78], tex: .65 },
  [164, 8.9, 27, 2.6, 7.6, 4.8, .27, 7, 291, 49, 2.9, 48, 1.53, .35, 3.7, 168, .04, 1.10, 0, 1, .12, .06, .53, .29, .14, .5, 172, 0, 1.3, 0, .35, 4]);

f('beans_red', 'Fasola czerwona', { en: 'red kidney beans', cat: 'legume', emoji: '🫘', serving: 160, dens: .85, color: [10, .60, .45], tex: .6 },
  [127, 8.7, 22.8, .5, 6.4, .3, .07, 1, 405, 28, 2.9, 45, 1.07, .24, 1.1, 142, .11, .13, 0, 0, .16, .06, .58, .22, .12, 1, 130, 0, 1.2, 0, .03, 8.4]);

f('tofu', 'Tofu', { en: 'firm tofu', cat: 'legume', emoji: '🧊', serving: 120, dens: 1.0, color: [48, .10, .92], tex: .35 },
  [144, 15, 2.8, 8.7, 2.3, .6, 1.3, 14, 237, 683, 2.66, 58, 1.57, .38, 12, 190, .40, 4.30, 0, 0, .16, .10, .38, .13, .09, 2, 29, 0, .2, 0, .01, 2.4]);

f('hummus', 'Hummus', { en: 'hummus dip', cat: 'legume', emoji: '🥣', serving: 60, dens: 1.0, color: [45, .35, .82], tex: .4 },
  [166, 7.9, 14, 9.6, 6, .3, 1.4, 379, 228, 38, 2.44, 71, 1.83, .40, 2.5, 176, .15, 4.40, 0, 1, .18, .06, .58, .30, .16, 2, 83, 0, 0, 0, .80, 6]);

f('soy_milk', 'Napój sojowy', { en: 'soy milk', cat: 'dairy', emoji: '🥛', serving: 250, dens: 1.03, color: [42, .12, .90], tex: .05 },
  [43, 3.3, 1.8, 1.8, .5, .9, .20, 51, 118, 123, .40, 15, .12, .13, 1.5, 52, .07, .90, 0, 60, .06, .07, .10, .20, .05, 1, 9, 1.10, 0, 1.1, .10, .6]);

/* ---------------- orzechy, nasiona, tłuszcze ---------------- */

f('almonds', 'Migdały', { en: 'almonds', cat: 'fat', emoji: '🌰', serving: 30, dens: .6, color: [30, .40, .70], tex: .7 },
  [579, 21, 22, 50, 12.5, 4.4, 3.8, 1, 733, 269, 3.7, 270, 3.1, 1.03, 4.1, 481, .003, 12.3, 0, 0, .20, 1.14, 3.60, .47, .14, 57, 44, 0, 0, 0, 25.6, 0]);

f('walnuts', 'Orzechy włoskie', { en: 'walnuts', cat: 'fat', emoji: '🌰', serving: 30, dens: .5, color: [32, .45, .55], tex: .85, tags: ['omega3'] },
  [654, 15, 14, 65, 6.7, 2.6, 6.1, 2, 441, 98, 2.9, 158, 3.1, 1.59, 4.9, 346, 9.08, 38.1, 0, 1, .34, .15, 1.10, .57, .54, 19, 98, 0, 1.3, 0, .70, 2.7]);

f('cashews', 'Nerkowce', { en: 'cashew nuts', cat: 'fat', emoji: '🌰', serving: 30, dens: .6, color: [42, .35, .82], tex: .6 },
  [553, 18, 30, 44, 3.3, 5.9, 7.8, 12, 660, 37, 6.7, 292, 5.8, 2.20, 19.9, 593, .06, 7.8, 0, 0, .42, .06, 1.06, .86, .42, 13, 25, 0, .5, 0, .90, 34]);

f('peanut_butter', 'Masło orzechowe', { en: 'peanut butter', cat: 'fat', emoji: '🥜', serving: 25, dens: 1.1, color: [30, .60, .65], tex: .45 },
  [588, 25, 20, 50, 6, 9, 10, 17, 649, 49, 1.9, 168, 2.9, .42, 9.6, 335, .01, 12.7, 0, 0, .11, .11, 13.1, 1.10, .44, 60, 87, 0, 0, 0, 9.10, .5]);

f('olive_oil', 'Oliwa z oliwek', { en: 'olive oil', cat: 'fat', emoji: '🫒', serving: 10, dens: .92, color: [55, .70, .70], tex: .05 },
  [884, 0, 0, 100, 0, 0, 13.8, 2, 1, 1, .56, 0, 0, 0, 0, 0, .76, 9.80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14.3, 60]);

f('rapeseed_oil', 'Olej rzepakowy', { en: 'rapeseed oil', cat: 'fat', emoji: '🛢️', serving: 10, dens: .92, color: [50, .70, .85], tex: .05 },
  [884, 0, 0, 100, 0, 0, 7.4, 0, 0, 0, .07, 0, 0, 0, 0, 0, 9.10, 18.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 17.5, 71]);

f('sunflower_seeds', 'Nasiona słonecznika', { en: 'sunflower seeds', cat: 'fat', emoji: '🌻', serving: 25, dens: .55, color: [40, .35, .60], tex: .75 },
  [584, 21, 20, 51, 8.6, 2.6, 4.5, 9, 645, 78, 5.3, 325, 5.0, 1.80, 53, 660, .07, 23, 0, 1, 1.48, .36, 8.30, 1.10, 1.34, 29, 227, 0, 1.4, 0, 35.2, 2.7]);

f('pumpkin_seeds', 'Pestki dyni', { en: 'pumpkin seeds', cat: 'fat', emoji: '🎃', serving: 25, dens: .55, color: [80, .45, .55], tex: .7 },
  [559, 30, 11, 49, 6, 1.4, 8.7, 7, 809, 46, 8.8, 592, 7.8, 1.34, 9.4, 1233, .12, 20.7, 0, 1, .27, .15, 4.99, .75, .14, 13, 58, 0, 1.9, 0, 2.18, 7.3]);

f('flaxseed', 'Siemię lniane', { en: 'ground flaxseed', cat: 'fat', emoji: '🌱', serving: 15, dens: .6, color: [28, .55, .45], tex: .8, tags: ['omega3'] },
  [534, 18, 29, 42, 27, 1.6, 3.7, 30, 813, 255, 5.7, 392, 4.3, 1.22, 25, 642, 22.8, 5.9, 0, 0, 1.64, .16, 3.10, .99, .47, 6, 87, 0, .6, 0, .31, 4.3]);

f('chia', 'Nasiona chia', { en: 'chia seeds', cat: 'fat', emoji: '🌱', serving: 15, dens: .6, color: [30, .30, .35], tex: .75, tags: ['omega3'] },
  [486, 17, 42, 31, 34, 0, 3.3, 16, 407, 631, 7.7, 335, 4.6, .92, 55, 860, 17.8, 5.8, 0, 0, .62, .17, 8.80, .70, .10, 5, 49, 0, 1.6, 0, .50, 0]);

f('brazil_nut', 'Orzechy brazylijskie', { en: 'brazil nuts', cat: 'fat', emoji: '🌰', serving: 15, dens: .6, color: [35, .40, .60], tex: .7, tags: ['selen'] },
  [656, 14, 12, 66, 7.5, 2.3, 15.1, 3, 659, 160, 2.43, 376, 4.06, 1.74, 1917, 725, .02, 20.5, 0, 0, .62, .04, .30, .18, .10, 8, 22, 0, .7, 0, 5.65, 0]);

/* ---------------- przekąski, słodycze, napoje ---------------- */

f('dark_chocolate', 'Gorzka czekolada', { en: 'dark chocolate', cat: 'snack', emoji: '🍫', serving: 25, color: [25, .60, .25], tex: .3 },
  [598, 7.8, 46, 43, 11, 24, 24, 20, 715, 73, 11.9, 228, 3.3, 1.77, 6.8, 308, .03, 1.40, 3, 2, .03, .08, 1.05, .42, .04, 3, 12, .28, 0, 0, .59, 7.3]);

f('honey', 'Miód', { en: 'honey', cat: 'snack', emoji: '🍯', serving: 20, dens: 1.4, color: [40, .85, .85], tex: .1 },
  [304, .3, 82, 0, .2, 82, 0, 4, 52, 6, .42, 2, .22, .04, .8, 4, 0, 0, 0, 0, 0, .04, .12, .07, .02, .1, 2, 0, .5, 0, 0, 0]);

f('sugar', 'Cukier', { en: 'sugar', cat: 'snack', emoji: '🧂', serving: 8, dens: .85, color: [45, .05, .98], tex: .6 },
  [387, 0, 100, 0, 0, 100, 0, 1, 2, 1, .05, 0, .01, .01, .6, 0, 0, 0, 0, 0, 0, .02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

f('protein_bar', 'Baton proteinowy', { en: 'protein bar', cat: 'supp', emoji: '🍫', serving: 60, unit: 60, unitName: 'sztuka', color: [28, .45, .40], tex: .6 },
  [350, 30, 38, 9, 6, 12, 4, 280, 400, 300, 3.0, 80, 3.0, .30, 12, 300, .10, 1.50, 10, 50, .30, .40, 5.00, 1.00, .50, 8, 40, 1.50, 15, 1.5, 2.00, 2]);

f('energy_gel', 'Żel energetyczny', { en: 'energy gel', cat: 'supp', emoji: '🧃', serving: 40, unit: 40, unitName: 'sztuka', dens: 1.3, color: [40, .50, .80], tex: .1 },
  [250, 0, 62, 0, 0, 30, 0, 250, 50, 5, .10, 5, .10, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0]);

f('isotonic', 'Izotonik', { en: 'sports drink', cat: 'drink', emoji: '🥤', serving: 500, dens: 1.03, color: [190, .45, .85], tex: .02, tags: ['nawodnienie'] },
  [26, 0, 6.4, 0, 0, 5.5, 0, 40, 30, 3, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0]);

f('orange_juice', 'Sok pomarańczowy', { en: 'orange juice', cat: 'drink', emoji: '🧃', serving: 250, dens: 1.04, color: [32, .85, .92], tex: .05 },
  [45, .7, 10.4, .2, .2, 8.4, .02, 1, 200, 11, .20, 11, .05, .04, .1, 17, .01, .02, 0, 8, .09, .03, .40, .19, .04, .5, 30, 0, 50, 0, .04, .1]);

f('cola', 'Napój gazowany', { en: 'cola soft drink', cat: 'drink', emoji: '🥤', serving: 330, dens: 1.04, color: [20, .70, .25], tex: .02 },
  [42, 0, 10.6, 0, 0, 10.6, 0, 4, 2, 2, .10, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

f('coffee', 'Kawa', { en: 'black coffee', cat: 'drink', emoji: '☕', serving: 200, dens: 1.0, color: [25, .70, .20], tex: .02 },
  [2, .3, 0, 0, 0, 0, 0, 5, 49, 2, .01, 3, .02, 0, 0, 3, 0, 0, 0, 0, 0, .08, .19, .03, 0, .1, .2, 0, 0, 0, 0, 0]);

f('ketchup', 'Ketchup', { en: 'ketchup', cat: 'sauce', emoji: '🍅', serving: 20, dens: 1.1, color: [5, .85, .60], tex: .1 },
  [101, 1.2, 25, .1, .3, 22, .03, 907, 281, 15, .35, 13, .17, .11, .5, 29, .01, .06, 0, 42, .01, .08, 1.40, .10, .16, 1, 9, 0, 4, 0, 1.50, 2.6]);

f('mayo', 'Majonez', { en: 'mayonnaise', cat: 'sauce', emoji: '🥄', serving: 15, dens: .95, color: [48, .25, .95], tex: .1 },
  [680, 1, .6, 75, 0, .6, 11.6, 635, 20, 8, .21, 1, .10, .02, 2.4, 28, 4.20, 38, 42, 50, .01, .02, .02, .10, .02, 1, 6, .30, 0, 2, 13, 97]);

f('jam', 'Dżem', { en: 'fruit jam', cat: 'snack', emoji: '🍓', serving: 20, dens: 1.3, color: [355, .70, .55], tex: .15 },
  [250, .4, 62, .1, 1.1, 48, .01, 32, 77, 20, .50, 6, .06, .06, 1, 13, 0, 0, 0, 2, .01, .03, .30, .05, .03, .3, 8, 0, 8, 0, .20, 3.5]);

f('ice_cream', 'Lody', { en: 'ice cream scoop', cat: 'snack', emoji: '🍨', serving: 100, dens: .6, color: [40, .20, .95], tex: .25 },
  [207, 3.5, 24, 11, .7, 21, 6.8, 80, 199, 128, .09, 14, .70, .03, 2, 105, .10, .40, 44, 118, .04, .24, .12, .60, .05, 2, 5, .40, .6, .2, .30, .3]);

f('cookie', 'Ciastko', { en: 'cookies', cat: 'snack', emoji: '🍪', serving: 30, color: [32, .50, .65], tex: .55 },
  [480, 6, 64, 22, 2.5, 33, 11, 380, 130, 50, 2.2, 25, .60, .15, 8, 95, .10, 4.50, 30, 40, .15, .15, 1.50, .30, .05, 2, 25, .10, 0, .3, 1.50, 6]);

f('chips', 'Chipsy', { en: 'potato chips', cat: 'snack', emoji: '🥔', serving: 40, dens: .25, color: [42, .60, .85], tex: .8 },
  [536, 7, 53, 34, 4.8, .3, 3.2, 525, 1275, 24, 1.6, 67, 1.1, .36, 8, 165, .10, 12, 0, 0, .17, .20, 3.80, .60, .60, 1, 45, 0, 31, 0, 6.20, 17]);

f('salt', 'Sól', { en: 'table salt', cat: 'sauce', emoji: '🧂', serving: 1, color: [0, 0, 1], tex: .5 },
  [0, 0, 0, 0, 0, 0, 0, 38758, 8, 24, .33, 1, .10, .03, .1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

f('water', 'Woda', { en: 'glass of water', cat: 'drink', emoji: '💧', serving: 250, dens: 1, color: [200, .10, .95], tex: 0, tags: ['nawodnienie'] },
  [0, 0, 0, 0, 0, 0, 0, 4, 1, 10, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

export default FOODS;
export const FOOD_INDEX = new Map(FOODS.map((x) => [x.id, x]));
