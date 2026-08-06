/* ==========================================================================
   Nutrient definitions.

   Reference intakes are tuned for a heavily-training endurance athlete
   (EFSA / IOM baselines with the documented athlete uplift), not for a
   sedentary adult. Sex and body mass adjustments are applied in
   domain/targets.js — the numbers here are the male 70 kg baseline.
   ========================================================================== */

/** Canonical order used by every totals object in the app. */
export const NUTRIENT_KEYS = [
  'kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satFat',
  'sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'zinc', 'copper',
  'selenium', 'phosphorus', 'omega3', 'omega6', 'cholesterol',
  'vitA', 'vitB1', 'vitB2', 'vitB3', 'vitB5', 'vitB6', 'vitB7', 'vitB9',
  'vitB12', 'vitC', 'vitD', 'vitE', 'vitK',
];

/**
 * kind:  'energy' | 'macro' | 'mineral' | 'vitamin' | 'fat'
 * limit: true  → lower is better, the target is a ceiling
 * prec:  decimals used when displaying the amount
 */
export const NUTRIENTS = {
  kcal: { key: 'kcal', name: 'Energia', short: 'kcal', unit: 'kcal', kind: 'energy', rda: 3200, prec: 0 },

  protein: {
    key: 'protein', name: 'Białko', unit: 'g', kind: 'macro', rda: 140, prec: 0,
    role: 'Odbudowa mięśni po treningu i utrzymanie masy przy dużej objętości.',
    sources: ['kurczak', 'skyr', 'twaróg', 'jajka', 'ryby', 'odżywka białkowa'],
  },
  carbs: {
    key: 'carbs', name: 'Węglowodany', unit: 'g', kind: 'macro', rda: 450, prec: 0,
    role: 'Główne paliwo serii i sprintów — decyduje o jakości drugiego treningu w dniu.',
    sources: ['ryż', 'makaron', 'płatki owsiane', 'banany', 'ziemniaki', 'pieczywo'],
  },
  fat: {
    key: 'fat', name: 'Tłuszcz', unit: 'g', kind: 'macro', rda: 90, prec: 0,
    role: 'Hormony, wchłanianie witamin A/D/E/K, zdrowie stawów.',
    sources: ['oliwa', 'orzechy', 'awokado', 'tłuste ryby', 'masło orzechowe'],
  },
  fiber: {
    key: 'fiber', name: 'Błonnik', unit: 'g', kind: 'macro', rda: 35, prec: 0,
    role: 'Stabilna glikemia i praca jelit przy dużej podaży kalorii.',
    sources: ['warzywa', 'pełne ziarno', 'rośliny strączkowe', 'owoce jagodowe'],
  },
  sugar: {
    key: 'sugar', name: 'Cukry proste', unit: 'g', kind: 'macro', rda: 90, limit: true, prec: 0,
    role: 'Wokół treningu są paliwem, poza nim — zbędnym balastem.',
    sources: [],
  },
  satFat: {
    key: 'satFat', name: 'Tłuszcze nasycone', unit: 'g', kind: 'fat', rda: 30, limit: true, prec: 1,
    role: 'Trzymaj poniżej 10% energii — reszta tłuszczu z olejów i orzechów.',
    sources: [],
  },

  sodium: {
    key: 'sodium', name: 'Sód', unit: 'mg', kind: 'mineral', rda: 2300, ul: 4500, prec: 0,
    role: 'Tracisz go z potem także w wodzie — bez sodu nie utrzymasz nawodnienia.',
    sources: ['sól', 'izotonik', 'pieczywo', 'sery', 'wędliny'],
  },
  potassium: {
    key: 'potassium', name: 'Potas', unit: 'mg', kind: 'mineral', rda: 4700, prec: 0,
    role: 'Skurcz mięśnia i rytm serca. Niedobór = skurcze w nocy po ciężkim bloku.',
    sources: ['banany', 'ziemniaki', 'pomidory', 'jogurt', 'suszone morele'],
  },
  calcium: {
    key: 'calcium', name: 'Wapń', unit: 'mg', kind: 'mineral', rda: 1200, ul: 2500, prec: 0,
    role: 'Kości pływaka nie dostają obciążenia jak u biegacza — wapń jest kluczowy.',
    sources: ['mleko', 'jogurt', 'ser', 'sardynki', 'tofu', 'migdały'],
  },
  iron: {
    key: 'iron', name: 'Żelazo', unit: 'mg', kind: 'mineral', rda: 12, ul: 45, prec: 1,
    role: 'Transport tlenu. Niedobór widać najpierw jako spadek tempa na końcówkach.',
    sources: ['wołowina', 'wątróbka', 'soczewica', 'szpinak', 'kasza gryczana'],
  },
  magnesium: {
    key: 'magnesium', name: 'Magnez', unit: 'mg', kind: 'mineral', rda: 450, prec: 0,
    role: 'Produkcja ATP i rozkurcz mięśnia — pierwszy podejrzany przy skurczach.',
    sources: ['orzechy', 'kasza gryczana', 'gorzka czekolada', 'nasiona', 'szpinak'],
  },
  zinc: {
    key: 'zinc', name: 'Cynk', unit: 'mg', kind: 'mineral', rda: 12, ul: 40, prec: 1,
    role: 'Odporność i regeneracja — spada przy dużym stresie treningowym.',
    sources: ['wołowina', 'pestki dyni', 'sery', 'jaja', 'owoce morza'],
  },
  copper: {
    key: 'copper', name: 'Miedź', unit: 'mg', kind: 'mineral', rda: 1.3, ul: 10, prec: 2,
    role: 'Współpracuje z żelazem przy tworzeniu czerwonych krwinek.',
    sources: ['orzechy nerkowca', 'kakao', 'wątróbka', 'nasiona słonecznika'],
  },
  selenium: {
    key: 'selenium', name: 'Selen', unit: 'µg', kind: 'mineral', rda: 70, ul: 400, prec: 0,
    role: 'Ochrona antyoksydacyjna po dużej objętości tlenowej.',
    sources: ['orzechy brazylijskie', 'ryby', 'jaja', 'pełne ziarno'],
  },
  phosphorus: {
    key: 'phosphorus', name: 'Fosfor', unit: 'mg', kind: 'mineral', rda: 900, ul: 4000, prec: 0,
    role: 'Element ATP i kości — zwykle idzie w parze z białkiem w diecie.',
    sources: ['nabiał', 'mięso', 'ryby', 'pełne ziarno'],
  },

  omega3: {
    key: 'omega3', name: 'Omega 3', unit: 'g', kind: 'fat', rda: 2.5, prec: 2,
    role: 'Wycisza stan zapalny po ciężkich blokach, wspiera stawy barkowe.',
    sources: ['łosoś', 'makrela', 'siemię lniane', 'orzechy włoskie'],
  },
  omega6: {
    key: 'omega6', name: 'Omega 6', unit: 'g', kind: 'fat', rda: 14, ul: 30, prec: 2,
    role: 'Potrzebna, ale nadmiar wobec omega 3 działa prozapalnie.',
    sources: ['olej słonecznikowy', 'orzechy', 'nasiona'],
  },
  cholesterol: {
    key: 'cholesterol', name: 'Cholesterol', unit: 'mg', kind: 'fat', rda: 300, limit: true, prec: 0,
    role: 'Przy diecie sportowca rzadko problem — obserwuj trend, nie pojedynczy dzień.',
    sources: [],
  },

  vitA: {
    key: 'vitA', name: 'Witamina A', unit: 'µg', kind: 'vitamin', rda: 900, ul: 3000, prec: 0,
    role: 'Wzrok w słabym świetle i regeneracja nabłonków.',
    sources: ['marchew', 'bataty', 'wątróbka', 'szpinak', 'jaja'],
  },
  vitB1: {
    key: 'vitB1', name: 'Witamina B1', short: 'B1 tiamina', unit: 'mg', kind: 'vitamin', rda: 1.8, prec: 2,
    role: 'Zamienia węglowodany w energię — zapotrzebowanie rośnie z ilością węgli.',
    sources: ['wieprzowina', 'pełne ziarno', 'nasiona słonecznika', 'strączki'],
  },
  vitB2: {
    key: 'vitB2', name: 'Witamina B2', short: 'B2 ryboflawina', unit: 'mg', kind: 'vitamin', rda: 1.9, prec: 2,
    role: 'Metabolizm tlenowy — u sportowców wytrzymałościowych często na styk.',
    sources: ['mleko', 'jogurt', 'jaja', 'migdały', 'wątróbka'],
  },
  vitB3: {
    key: 'vitB3', name: 'Witamina B3', short: 'B3 niacyna', unit: 'mg', kind: 'vitamin', rda: 18, ul: 35, prec: 1,
    role: 'Produkcja energii w mięśniu.',
    sources: ['drób', 'tuńczyk', 'orzeszki ziemne', 'pełne ziarno'],
  },
  vitB5: {
    key: 'vitB5', name: 'Witamina B5', short: 'B5 kw. pantotenowy', unit: 'mg', kind: 'vitamin', rda: 6, prec: 2,
    role: 'Współtworzy koenzym A — spalanie tłuszczu i węglowodanów.',
    sources: ['jaja', 'awokado', 'kurczak', 'pełne ziarno'],
  },
  vitB6: {
    key: 'vitB6', name: 'Witamina B6', short: 'B6', unit: 'mg', kind: 'vitamin', rda: 1.9, ul: 25, prec: 2,
    role: 'Przemiana białka — rośnie razem z podażą białka.',
    sources: ['kurczak', 'łosoś', 'banany', 'ziemniaki', 'ciecierzyca'],
  },
  vitB7: {
    key: 'vitB7', name: 'Witamina B7', short: 'B7 biotyna', unit: 'µg', kind: 'vitamin', rda: 35, prec: 1,
    role: 'Metabolizm tłuszczów, kondycja skóry i włosów (chlor nie pomaga).',
    sources: ['jaja', 'orzechy', 'nasiona', 'łosoś'],
  },
  vitB9: {
    key: 'vitB9', name: 'Witamina B9', short: 'B9 foliany', unit: 'µg', kind: 'vitamin', rda: 400, ul: 1000, prec: 0,
    role: 'Podział komórek i produkcja krwinek.',
    sources: ['szpinak', 'strączki', 'brokuły', 'awokado'],
  },
  vitB12: {
    key: 'vitB12', name: 'Witamina B12', short: 'B12', unit: 'µg', kind: 'vitamin', rda: 2.8, prec: 2,
    role: 'Krwinki i układ nerwowy — pilnuj przy diecie roślinnej.',
    sources: ['ryby', 'mięso', 'nabiał', 'jaja'],
  },
  vitC: {
    key: 'vitC', name: 'Witamina C', unit: 'mg', kind: 'vitamin', rda: 200, ul: 2000, prec: 0,
    role: 'Kolagen ścięgien i odporność przy dużym obciążeniu.',
    sources: ['papryka', 'cytrusy', 'kiwi', 'truskawki', 'brokuły'],
  },
  vitD: {
    key: 'vitD', name: 'Witamina D', unit: 'µg', kind: 'vitamin', rda: 25, ul: 100, prec: 1,
    role: 'Pływak trenuje pod dachem — od października do marca to niedobór numer jeden.',
    sources: ['tłuste ryby', 'żółtka', 'suplement'],
  },
  vitE: {
    key: 'vitE', name: 'Witamina E', unit: 'mg', kind: 'vitamin', rda: 15, ul: 300, prec: 1,
    role: 'Chroni błony komórkowe przed stresem oksydacyjnym.',
    sources: ['migdały', 'oliwa', 'nasiona słonecznika', 'awokado'],
  },
  vitK: {
    key: 'vitK', name: 'Witamina K', unit: 'µg', kind: 'vitamin', rda: 120, prec: 0,
    role: 'Krzepnięcie i mineralizacja kości.',
    sources: ['jarmuż', 'szpinak', 'brokuły', 'natka pietruszki'],
  },
};

export const MACRO_KEYS = ['protein', 'carbs', 'fat', 'fiber'];
export const VITAMIN_KEYS = NUTRIENT_KEYS.filter((k) => NUTRIENTS[k].kind === 'vitamin');
export const MINERAL_KEYS = NUTRIENT_KEYS.filter((k) => NUTRIENTS[k].kind === 'mineral');
export const FAT_KEYS = NUTRIENT_KEYS.filter((k) => NUTRIENTS[k].kind === 'fat');
/** Everything that feeds the micronutrient score. */
export const MICRO_KEYS = [...VITAMIN_KEYS, ...MINERAL_KEYS].filter((k) => k !== 'sodium');

/** kcal per gram, used to sanity-check imported foods and to build meals. */
export const ATWATER = { protein: 4, carbs: 4, fat: 9, fiber: 2, alcohol: 7 };

export function emptyTotals() {
  const t = {};
  for (const k of NUTRIENT_KEYS) t[k] = 0;
  return t;
}

/** Add `src * factor` into `target` in place (hot path — kept allocation-free). */
export function accumulate(target, src, factor = 1) {
  if (!src) return target;
  for (let i = 0; i < NUTRIENT_KEYS.length; i++) {
    const k = NUTRIENT_KEYS[i];
    const v = src[k];
    if (v) target[k] += v * factor;
  }
  return target;
}

export function scaleTotals(src, factor) {
  const t = emptyTotals();
  return accumulate(t, src, factor);
}

export function sumTotals(list) {
  const t = emptyTotals();
  for (const x of list) accumulate(t, x);
  return t;
}

/** Legacy (v1/v2) short keys → canonical keys, used by the store migration. */
export const LEGACY_MAP = {
  kcal: 'kcal', p: 'protein', c: 'carbs', f: 'fat', fib: 'fiber', sug: 'sugar',
  'vit.a': 'vitA', 'vit.d': 'vitD', 'vit.e': 'vitE', 'vit.k': 'vitK', 'vit.c': 'vitC',
  'vit.b1': 'vitB1', 'vit.b2': 'vitB2', 'vit.b3': 'vitB3', 'vit.b6': 'vitB6',
  'vit.b9': 'vitB9', 'vit.b12': 'vitB12',
  'min.ca': 'calcium', 'min.fe': 'iron', 'min.mg': 'magnesium', 'min.zn': 'zinc',
  'min.k': 'potassium', 'min.na': 'sodium', 'min.p': 'phosphorus', 'min.se': 'selenium',
};
