/* ==========================================================================
   Daily targets.

   The plan is rebuilt on every render from three inputs:
     1. body   — BMR via Mifflin-St Jeor
     2. plan   — weekly training volume and the current macro-cycle phase
     3. today  — the sessions actually logged, which move the target live

   Sessions logged today replace the *expected* share of training energy for
   the day rather than stacking on top of it, so opening the app before
   training and after training gives a consistent number.
   ========================================================================== */

import { NUTRIENTS, NUTRIENT_KEYS, emptyTotals } from '../data/nutrients.js';
import { burnFor, sweatFor, carbNeedFor, loadFor, getPhase } from '../data/exercise.js';
import { clamp, round } from '../core/utils.js';

/** Resting metabolic rate, kcal/day. */
export function bmr({ sex, weight, height, age }) {
  const w = clamp(+weight || 70, 30, 200);
  const h = clamp(+height || 175, 120, 230);
  const a = clamp(+age || 20, 10, 90);
  const base = 10 * w + 6.25 * h - 5 * a;
  return Math.round(base + (sex === 'f' ? -161 : 5));
}

/** Energy burned outside training (school, commuting, fidgeting). */
const NEAT_FACTOR = 1.35;

/**
 * Average training energy per day implied by the weekly plan, in kcal.
 * Used before any session is logged so the target is never "resting only".
 */
export function plannedTrainingKcal(profile, training) {
  const weight = clamp(+profile.weight || 70, 30, 200);
  const pool = burnFor({ type: 'swim', intensity: 'moderate', minutes: (+training.poolHoursWeek || 0) * 60, weight });
  const dry = burnFor({ type: 'gym', intensity: 'moderate', minutes: (+training.dryHoursWeek || 0) * 60, weight });
  return Math.round((pool + dry) / 7);
}

export function plannedDailyLoad(training) {
  const pool = loadFor({ type: 'swim', intensity: 'moderate', minutes: (+training.poolHoursWeek || 0) * 60 });
  const dry = loadFor({ type: 'gym', intensity: 'moderate', minutes: (+training.dryHoursWeek || 0) * 60 });
  return Math.round((pool + dry) / 7);
}

/** Aggregate everything today's sessions imply. */
export function workoutDemand(workouts, weight) {
  let kcal = 0, sweat = 0, carbs = 0, load = 0, minutes = 0;
  for (const w of workouts || []) {
    const min = +w.minutes || 0;
    kcal += +w.kcal || burnFor({ ...w, minutes: min, weight });
    sweat += sweatFor({ ...w, minutes: min });
    carbs += carbNeedFor({ ...w, minutes: min });
    load += loadFor({ ...w, minutes: min });
    minutes += min;
  }
  return { kcal: Math.round(kcal), sweat, carbs, load, minutes };
}

/**
 * Build the full nutrient target vector for a day.
 * @returns {{kcal:number, water:number, ...nutrients}} plus a `meta` block.
 */
export function computeTargets(state, dayKeyStr, day) {
  const { profile, training, goals } = state;
  const weight = clamp(+profile.weight || 70, 30, 200);
  const phase = getPhase(training.phase);
  const workouts = day?.workouts || [];
  const demand = workoutDemand(workouts, weight);

  const rmr = bmr(profile);
  const baseline = Math.round(rmr * NEAT_FACTOR);
  const planned = plannedTrainingKcal(profile, training);

  // Logged sessions replace the planned share; an empty day keeps the plan so
  // the ring is meaningful in the morning.
  const trainingKcal = workouts.length ? demand.kcal : planned;

  let kcal = Math.round((baseline + trainingKcal) * phase.kcal);

  /* ---- macros ---- */
  // Protein climbs with training stress but plateaus — more than ~2.2 g/kg
  // buys nothing for a swimmer already hitting energy needs.
  const proteinPerKg = clamp(
    1.7 + (phase.id === 'build' ? 0.35 : phase.id === 'peak' ? 0.3 : phase.id === 'taper' ? 0.2 : 0.15)
      + (demand.minutes > 150 ? 0.15 : 0),
    1.6, 2.3,
  );
  const protein = Math.round(weight * proteinPerKg);

  // Carbohydrate is driven by the session load, which is what actually
  // empties glycogen. 5 g/kg on a rest day up to 10 g/kg on a double day.
  const loadRef = Math.max(30, plannedDailyLoad(training));
  const loadRatio = clamp((demand.load || loadRef) / loadRef, 0.35, 2.0);
  const carbPerKg = clamp((4.5 + loadRatio * 2.6) * phase.carb, 3.0, 11);
  let carbs = Math.round(weight * carbPerKg);

  const fatMin = Math.round(weight * 0.8);
  let fat = Math.round((kcal - protein * 4 - carbs * 4) / 9);
  if (fat < fatMin) {
    // Never squeeze fat below the hormonal floor — trim carbs instead.
    fat = fatMin;
    carbs = Math.max(Math.round(weight * 3), Math.round((kcal - protein * 4 - fat * 9) / 4));
  }

  /* ---- hydration ---- */
  const water = Math.round((weight * 35 + (demand.sweat || 550)) / 50) * 50;

  /* ---- micronutrients ---- */
  const t = emptyTotals();
  const energyScale = clamp(kcal / 2500, 0.8, 1.8);   // B-vitamins track energy flux
  const massScale = clamp(weight / 70, 0.8, 1.5);
  const female = profile.sex === 'f';

  for (const key of NUTRIENT_KEYS) {
    const def = NUTRIENTS[key];
    if (!def) continue;
    let v = def.rda;
    switch (key) {
      case 'vitB1': case 'vitB2': case 'vitB3': case 'vitB5':
        v *= energyScale; break;
      case 'vitB6':
        v *= clamp(protein / 140, 0.8, 1.6); break;
      case 'magnesium': case 'potassium': case 'phosphorus': case 'zinc':
        v *= massScale; break;
      case 'iron':
        v *= female ? 1.75 : 1; break;
      case 'sodium':
        v = 2000 + Math.round((demand.sweat || 400) * 0.9); break;
      case 'fiber':
        v = clamp(Math.round(kcal / 1000 * 12), 28, 50); break;
      case 'sugar':
        v = Math.round(kcal * 0.12 / 4); break;   // ceiling: 12% of energy
      case 'satFat':
        v = Math.round(kcal * 0.09 / 9); break;
      case 'vitD':
        v = 25; break;
      default: break;
    }
    t[key] = round(v, def.prec ?? 1);
  }

  t.kcal = kcal;
  t.protein = protein;
  t.carbs = carbs;
  t.fat = fat;

  /* ---- manual override ---- */
  if (goals.mode === 'manual') {
    const m = goals.manual || {};
    if (m.kcal) t.kcal = +m.kcal;
    if (m.protein) t.protein = +m.protein;
    if (m.carbs) t.carbs = +m.carbs;
    if (m.fat) t.fat = +m.fat;
  }

  const waterTarget = goals.mode === 'manual' && goals.manual?.water ? +goals.manual.water : water;

  return {
    ...t,
    water: waterTarget,
    meta: {
      bmr: rmr,
      baseline,
      trainingKcal,
      plannedTrainingKcal: planned,
      demand,
      phase,
      proteinPerKg: round(proteinPerKg, 2),
      carbPerKg: round(carbPerKg, 1),
      loadRatio: round(loadRatio, 2),
      manual: goals.mode === 'manual',
    },
  };
}

/** One-line explanation of where the calorie number comes from. */
export function explainTargets(targets) {
  const m = targets.meta;
  if (m.manual) return 'Cele ustawione ręcznie w profilu.';
  return `${m.baseline} kcal na podtrzymanie + ${m.trainingKcal} kcal z treningu`
    + (m.phase.kcal !== 1 ? ` · korekta na fazę „${m.phase.name}”` : '');
}

/** Split the day's energy into meal slots — used by reminders and coaching. */
export function slotPlan(targets) {
  const k = targets.kcal;
  return [
    { slot: 'breakfast', name: 'Śniadanie', kcal: Math.round(k * 0.24) },
    { slot: 'snack1', name: 'Przekąska', kcal: Math.round(k * 0.10) },
    { slot: 'lunch', name: 'Obiad', kcal: Math.round(k * 0.30) },
    { slot: 'snack2', name: 'Po treningu', kcal: Math.round(k * 0.14) },
    { slot: 'dinner', name: 'Kolacja', kcal: Math.round(k * 0.22) },
  ];
}

export const SLOT_NAMES = {
  breakfast: 'Śniadanie',
  snack: 'Przekąska',
  snack1: 'Przekąska',
  snack2: 'Po treningu',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  preworkout: 'Przed treningiem',
  postworkout: 'Po treningu',
};
