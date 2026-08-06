/* ==========================================================================
   Analysis: totals, scores, deficiencies and coaching text.

   Every number the dashboard shows is derived here so the UI stays a pure
   rendering layer and the logic is testable on its own.
   ========================================================================== */

import {
  NUTRIENTS, NUTRIENT_KEYS, MICRO_KEYS,
  emptyTotals, accumulate,
} from '../data/nutrients.js';
import { dayLoad } from '../data/exercise.js';
import { plannedDailyLoad } from './targets.js';
import { clamp, round, sum, avg, keyRange } from '../core/utils.js';

/* ---------------- totals ---------------- */

export function dayTotals(day) {
  const totals = emptyTotals();
  for (const meal of day?.meals || []) accumulate(totals, meal.totals);
  const water = sum(day?.water || [], (w) => w.ml);
  const burn = sum(day?.workouts || [], (w) => w.kcal || 0);
  return {
    ...totals,
    water,
    burn,
    load: dayLoad(day?.workouts || []),
    meals: day?.meals?.length || 0,
    workouts: day?.workouts?.length || 0,
  };
}

/** Ratio + qualitative state of one nutrient against its target. */
export function statusOf(key, value, target) {
  const def = NUTRIENTS[key];
  const t = +target || 0;
  const v = +value || 0;
  const pct = t > 0 ? (v / t) * 100 : 0;
  const isLimit = !!def?.limit;
  const ul = def?.ul;

  let state = 'ok';
  if (isLimit) state = pct > 115 ? 'over' : pct > 90 ? 'high' : 'ok';
  else if (ul && v > ul) state = 'over';
  else if (pct < 50) state = 'crit';
  else if (pct < 80) state = 'low';
  else if (pct > 200) state = 'high';

  return { key, value: v, target: t, pct, state, def };
}

/* ---------------- scores ---------------- */

/**
 * Micronutrient score: mean coverage across vitamins and minerals, where
 * anything over 100% counts as 100 (stockpiling vitamin C does not offset a
 * missing iron) and exceeding a documented upper limit costs points.
 */
export function microScore(totals, targets) {
  let acc = 0, n = 0, penalty = 0;
  for (const key of MICRO_KEYS) {
    const s = statusOf(key, totals[key], targets[key]);
    acc += clamp(s.pct, 0, 100);
    n++;
    if (s.state === 'over') penalty += 6;
  }
  const base = n ? acc / n : 0;
  return Math.round(clamp(base - penalty, 0, 100));
}

/**
 * Recovery score — how well today set up tomorrow's session.
 * Weighted mix of refuelling, protein, hydration, sleep and micronutrients,
 * with a penalty when the acute training load runs far ahead of the chronic
 * one (the classic ramp-rate injury flag).
 */
export function recoveryScore({ totals, targets, day, history = [] }) {
  const parts = [];
  const push = (id, name, value, weight) => parts.push({ id, name, value: clamp(value, 0, 1), weight });

  const kcalRatio = targets.kcal ? totals.kcal / targets.kcal : 0;
  // Under-eating hurts a lot; slight over-eating barely matters.
  push('fuel', 'Energia', kcalRatio >= 1 ? clamp(1.15 - (kcalRatio - 1) * 0.45, 0.7, 1) : kcalRatio / 1, 0.24);
  push('protein', 'Białko', targets.protein ? totals.protein / targets.protein : 0, 0.20);
  push('carbs', 'Węglowodany', targets.carbs ? totals.carbs / targets.carbs : 0, 0.18);
  push('water', 'Nawodnienie', targets.water ? totals.water / targets.water : 0, 0.16);

  const sleep = +day?.sleepH || 0;
  push('sleep', 'Sen', sleep ? clamp(sleep / 8.5, 0, 1) : 0.62, 0.14);
  push('micro', 'Mikroskładniki', microScore(totals, targets) / 100, 0.08);

  let score = parts.reduce((s, p) => s + p.value * p.weight, 0) / parts.reduce((s, p) => s + p.weight, 0);

  const acr = acuteChronicRatio(history);
  let flag = null;
  if (acr && acr > 1.45) { score *= 0.9; flag = 'ramp'; }
  else if (acr && acr < 0.7 && history.length > 10) { flag = 'detrain'; }

  return {
    score: Math.round(clamp(score * 100, 0, 100)),
    parts: parts.map((p) => ({ ...p, pct: Math.round(p.value * 100) })),
    acr: acr ? round(acr, 2) : null,
    flag,
  };
}

/**
 * Acute:chronic workload ratio — last 7 days vs the last 28, both as daily
 * averages. Values much above 1.4 are the well-documented spike zone.
 */
export function acuteChronicRatio(history) {
  // Needs a real baseline: with two logged sessions the ratio is arithmetic
  // noise, and reporting it as a "300% spike" would be actively misleading.
  if (history.length < 14) return null;
  const loads = history.map((h) => h.load || 0);
  const trainedDays = loads.filter((l) => l > 0).length;
  if (trainedDays < 6) return null;

  const acute = avg(loads.slice(-7));
  const chronic = avg(loads.slice(-28));
  if (!chronic) return null;
  return acute / chronic;
}

/**
 * Training score — did today match the plan, and is the week on track.
 */
export function trainingScore({ day, training, history = [] }) {
  const planned = Math.max(20, plannedDailyLoad(training));
  const today = dayLoad(day?.workouts || []);
  const week = history.slice(-7);
  const weekLoad = sum(week, (h) => h.load || 0);
  const weekTarget = planned * 7;

  // Hitting the plan scores full marks; overshooting is not "better".
  const dayPart = today === 0 ? 0 : clamp(today / planned, 0, 1.25) / 1.25;
  const weekPart = weekTarget ? clamp(weekLoad / weekTarget, 0, 1.15) / 1.15 : 0;
  const daysTrained = week.filter((h) => (h.load || 0) > 0).length;
  const consistency = week.length ? daysTrained / Math.min(7, week.length) : 0;

  // Today carries the most weight — the score has to react to the session the
  // athlete just finished, not only to the shape of the week.
  const score = Math.round(clamp((dayPart * 0.45 + weekPart * 0.35 + consistency * 0.20) * 100, 0, 100));
  return {
    score,
    todayLoad: today,
    plannedLoad: planned,
    weekLoad,
    weekTarget,
    daysTrained,
  };
}

/* ---------------- deficiencies & advice ---------------- */

/** Nutrients meaningfully below or above target, most urgent first. */
export function nutrientIssues(totals, targets, { minMeals = 1, mealCount = 0 } = {}) {
  const low = [];
  const high = [];
  if (mealCount < minMeals) return { low, high };

  for (const key of NUTRIENT_KEYS) {
    if (key === 'kcal') continue;
    const def = NUTRIENTS[key];
    if (!def) continue;
    const s = statusOf(key, totals[key], targets[key]);
    if (def.limit) {
      if (s.pct > 115) high.push(s);
    } else if (s.state === 'crit' || s.state === 'low') {
      low.push(s);
    } else if (s.state === 'over') {
      high.push(s);
    }
  }
  low.sort((a, b) => a.pct - b.pct);
  high.sort((a, b) => b.pct - a.pct);
  return { low, high };
}

/**
 * Actionable recommendations. Returns at most `limit` items, each with the
 * concrete foods that fix it — generic "eat more vegetables" is useless at
 * 21:00 after a double session.
 */
export function recommendations(ctx, limit = 4) {
  const { totals, targets, day, hour = new Date().getHours(), issues } = ctx;
  const out = [];
  const gap = (k) => Math.max(0, (targets[k] || 0) - (totals[k] || 0));
  const pct = (k) => (targets[k] ? (totals[k] / targets[k]) * 100 : 0);

  const load = dayLoad(day?.workouts || []);
  const hasTrained = load > 0;

  /* --- energy --- */
  if (totals.meals === 0) {
    out.push({
      icon: '📷', tone: 'info',
      title: hour < 11 ? 'Zacznij dzień od śniadania' : 'Dziś jeszcze nic nie zapisałeś',
      fix: hour < 11
        ? 'Zrób zdjęcie pierwszego talerza — reszta policzy się sama.'
        : 'Dodaj to, co masz przed sobą. Nawet szacunek jest lepszy niż pusty dzień.',
    });
  } else if (pct('kcal') < 70 && hour >= 18) {
    out.push({
      icon: '⚠️', tone: 'warn',
      title: `Brakuje ${Math.round(gap('kcal'))} kcal do celu`,
      fix: 'Przy takiej objętości treningu deficyt odbije się jutro rano. Dołóż pełnowartościowy posiłek, nie samą przekąskę.',
    });
  } else if (pct('kcal') > 118) {
    out.push({
      icon: 'ℹ️', tone: 'info',
      title: `${Math.round(totals.kcal - targets.kcal)} kcal ponad cel`,
      fix: 'Po ciężkim dniu to normalne. Sprawdź w Historii, czy to jednorazowy skok, czy tygodniowy trend.',
    });
  }

  /* --- carbohydrate timing --- */
  if (pct('carbs') < 70) {
    out.push({
      icon: '🍚', tone: 'warn',
      title: `Do celu brakuje ${Math.round(gap('carbs'))} g węglowodanów`,
      fix: hour < 16
        ? 'Zjedz je przed treningiem: ryż, makaron, banan, płatki. To paliwo na serie, nie zapas.'
        : 'Uzupełnij wieczorem, inaczej jutro rano popłyniesz na pustym baku.',
    });
  }

  /* --- protein --- */
  if (pct('protein') < 80) {
    out.push({
      icon: '🥚', tone: 'warn',
      title: `Białko: brakuje ${Math.round(gap('protein'))} g`,
      fix: 'Skyr, twaróg, jajka albo odżywka. Rozbij na dwa podejścia — jednorazowa dawka powyżej 40 g się marnuje.',
    });
  }

  /* --- hydration --- */
  const waterPct = targets.water ? (totals.water / targets.water) * 100 : 0;
  if (waterPct < 60 && hour >= 14) {
    out.push({
      icon: '💧', tone: 'warn',
      title: `Wypito ${Math.round(totals.water)} z ${targets.water} ml`,
      fix: 'W wodzie nie czujesz pragnienia, ale tracisz płyny tak samo. Butelka przy torze i szklanka do każdego posiłku.',
    });
  }

  /* --- post-workout window --- */
  if (hasTrained && pct('protein') < 60 && (day?.meals?.length || 0) < 3) {
    out.push({
      icon: '⏱️', tone: 'info',
      title: 'Okno potreningowe',
      fix: 'W ciągu godziny po wyjściu z wody: 25–30 g białka i 60–80 g węglowodanów. Shake z bananem załatwia oba.',
    });
  }

  /* --- micronutrients: name the two worst and how to fix them --- */
  for (const s of (issues?.low || []).slice(0, 3)) {
    if (out.length >= limit + 2) break;
    const def = s.def;
    if (!def || !def.sources?.length) continue;
    out.push({
      icon: def.kind === 'vitamin' ? '🍊' : '🧲', tone: s.state === 'crit' ? 'warn' : 'info',
      title: `${def.name}: ${Math.round(s.pct)}% normy`,
      fix: `${def.role} Najszybciej uzupełnisz: ${def.sources.slice(0, 3).join(', ')}.`,
    });
  }

  /* --- excesses --- */
  for (const s of (issues?.high || []).slice(0, 1)) {
    const def = s.def;
    if (!def) continue;
    out.push({
      icon: '🔺', tone: 'warn',
      title: `${def.name} powyżej normy (${Math.round(s.pct)}%)`,
      fix: def.limit
        ? 'Sam w sobie jeden dzień nic nie zmienia — patrz na średnią tygodniową.'
        : 'Przekroczony górny bezpieczny poziom. Sprawdź, czy nie dublujesz suplementu.',
    });
  }

  /* --- sleep --- */
  if (!day?.sleepH && hour >= 20) {
    out.push({
      icon: '😴', tone: 'info',
      title: 'Dopisz sen',
      fix: 'Sen jest najmocniejszym pojedynczym czynnikiem regeneracji. Bez niego wynik regeneracji to tylko połowa obrazu.',
    });
  }

  return out.slice(0, limit);
}

/**
 * The single coaching sentence on the dashboard ring card.
 * Returns HTML (bold fragments only) — inputs are numbers, never user text.
 */
export function coachLine({ totals, targets, day, hour = new Date().getHours() }) {
  const g = (n) => `<b>${Math.round(n)} g</b>`;
  const left = targets.kcal - totals.kcal;
  const meals = day?.meals?.length || 0;
  const trained = (day?.workouts?.length || 0) > 0;

  if (!meals) {
    return hour < 11
      ? 'Śniadanie przed poranną wodą to najtańsze kilka sekund na 100 m. Zeskanuj pierwszy talerz.'
      : 'Dzień leci, a lista jest pusta. Zeskanuj to, co masz przed sobą.';
  }

  if (left < -targets.kcal * 0.08) {
    return `Jesteś <b>${Math.round(-left)} kcal</b> ponad cel. Po ciężkim dwufazowym dniu to normalne — sprawdź, czy tak samo wygląda tydzień.`;
  }

  const ratios = {
    protein: totals.protein / targets.protein,
    carbs: totals.carbs / targets.carbs,
    fat: totals.fat / targets.fat,
  };
  const [worstKey, worstVal] = Object.entries(ratios).sort((a, b) => a[1] - b[1])[0];

  if (worstVal >= 0.95 && left < targets.kcal * 0.08) {
    return trained
      ? 'Cel domknięty, makro na miejscu. Teraz sen — regeneracja robi resztę roboty.'
      : 'Wszystko domknięte. Dzień bez treningu też się liczy — jutro wracasz do wody z pełnym bakiem.';
  }

  if (worstKey === 'carbs' && worstVal < 0.7) {
    return hour < 16
      ? `Brakuje ${g(targets.carbs - totals.carbs)} węglowodanów. Wrzuć je przed treningiem — ryż, makaron, banan.`
      : `Zostało ${g(targets.carbs - totals.carbs)} węglowodanów. Wieczorem uzupełnij do końca, inaczej jutro rano zabraknie paliwa.`;
  }
  if (worstKey === 'protein' && worstVal < 0.8) {
    return `Do celu brakuje ${g(targets.protein - totals.protein)} białka. Skyr, twaróg, jajka albo shake — najlepiej w dwóch podejściach.`;
  }
  if (worstKey === 'fat' && worstVal < 0.6) {
    return `Tłuszcz siedzi nisko — brakuje ${g(targets.fat - totals.fat)}. Orzechy, oliwa, awokado. Przy dużej objętości to hormony i stawy.`;
  }
  if (totals.fiber < targets.fiber * 0.5) {
    return `Makro wygląda dobrze, ale błonnika jest ${g(totals.fiber)} z ${Math.round(targets.fiber)}. Warzywa i pełne ziarno do kolejnego posiłku.`;
  }
  if (totals.water < targets.water * 0.5 && hour >= 15) {
    return `Wypite <b>${Math.round(totals.water)} ml</b> z ${targets.water}. Nawodnienie robi tu więcej niż ostatnie 200 kcal.`;
  }
  return `Zostało <b>${Math.round(left)} kcal</b> do celu. Rozbij to na posiłek i przekąskę, zamiast dobijać wszystko przed snem.`;
}

/* ---------------- history aggregation ---------------- */

/** Per-day summary rows for the last `count` days ending at `endKey`. */
export function buildHistory(state, endKey, count, targetsFor) {
  const rows = [];
  for (const key of keyRange(endKey, count)) {
    const day = state.days[key];
    const totals = dayTotals(day || { meals: [], workouts: [], water: [] });
    const targets = targetsFor ? targetsFor(key, day) : null;
    rows.push({
      key,
      totals,
      targets,
      load: totals.load,
      kcal: totals.kcal,
      water: totals.water,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      burn: totals.burn,
      meals: totals.meals,
      workouts: totals.workouts,
      sleepH: day?.sleepH || null,
      weight: day?.weight || null,
      micro: targets ? microScore(totals, targets) : null,
      empty: !day || (!day.meals?.length && !day.workouts?.length && !day.water?.length),
    });
  }
  return rows;
}

/** Averages over a set of history rows, ignoring empty days for nutrition. */
export function aggregate(rows) {
  const active = rows.filter((r) => !r.empty && r.meals > 0);
  const withLoad = rows.filter((r) => r.load > 0);
  const totals = emptyTotals();
  for (const r of active) accumulate(totals, r.totals);

  return {
    days: rows.length,
    activeDays: active.length,
    trainingDays: withLoad.length,
    avgKcal: Math.round(avg(active, (r) => r.kcal)),
    avgProtein: Math.round(avg(active, (r) => r.protein)),
    avgCarbs: Math.round(avg(active, (r) => r.carbs)),
    avgFat: Math.round(avg(active, (r) => r.fat)),
    avgWater: Math.round(avg(rows, (r) => r.water)),
    avgMicro: Math.round(avg(active.filter((r) => r.micro != null), (r) => r.micro)),
    totalLoad: sum(rows, (r) => r.load),
    totalBurn: sum(rows, (r) => r.burn),
    totalKcal: Math.round(sum(active, (r) => r.kcal)),
    avgSleep: round(avg(rows.filter((r) => r.sleepH), (r) => r.sleepH), 1),
    totals,
  };
}

/** Percent change between the two halves of a series; null when too sparse. */
export function trend(rows, pick) {
  const vals = rows.map(pick).filter((v) => v != null && v > 0);
  if (vals.length < 4) return null;
  const half = Math.floor(vals.length / 2);
  const older = avg(vals.slice(0, half));
  const newer = avg(vals.slice(half));
  if (!older) return null;
  return round(((newer - older) / older) * 100, 1);
}

/** Which micronutrients keep coming up short across the range. */
export function chronicGaps(rows, limit = 5) {
  // "Keeps coming up short" needs more than one logged day to mean anything.
  const activeDays = rows.filter((r) => !r.empty && r.meals).length;
  if (activeDays < 4) return [];

  const counts = new Map();
  for (const r of rows) {
    if (r.empty || !r.targets || !r.meals) continue;
    for (const key of MICRO_KEYS) {
      const s = statusOf(key, r.totals[key], r.targets[key]);
      if (s.pct < 70) counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const active = rows.filter((r) => !r.empty && r.meals).length || 1;
  return [...counts.entries()]
    .map(([key, n]) => ({ key, days: n, share: n / active, def: NUTRIENTS[key] }))
    .filter((x) => x.share >= 0.4)
    .sort((a, b) => b.share - a.share)
    .slice(0, limit);
}

