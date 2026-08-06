/* ==========================================================================
   Training catalogue: MET values, sweat rates and load coefficients.

   MET figures follow the 2011 Compendium of Physical Activities. Energy is
   computed as: kcal = MET × 3.5 × kg / 200 × minutes, i.e. the standard
   VO2-based formula, then corrected for the athlete's economy at high
   intensity (trained athletes move faster at the same MET, so the compendium
   under-reports their work slightly at the top end).
   ========================================================================== */

export const INTENSITIES = [
  { id: 'easy', name: 'Spokojnie', short: 'L1', factor: 0.78, rpe: 3, color: '#34C759' },
  { id: 'moderate', name: 'Umiarkowanie', short: 'L2', factor: 1.0, rpe: 5, color: '#30B0C7' },
  { id: 'hard', name: 'Mocno', short: 'L3', factor: 1.24, rpe: 7, color: '#FF9500' },
  { id: 'max', name: 'Na maksa', short: 'L4', factor: 1.45, rpe: 9, color: '#FF3B30' },
];

export const INTENSITY_INDEX = new Map(INTENSITIES.map((i) => [i.id, i]));

/**
 * met       — baseline MET at 'moderate'
 * sweat     — ml of fluid lost per hour at 'moderate' (pool sessions still
 *             dehydrate; swimmers routinely lose 400-700 ml/h)
 * carbRate  — g of carbohydrate per hour the session justifies replacing
 * loadK     — multiplier converting minutes into training-load points
 * distUnit  — unit used by the distance field, null when it makes no sense
 */
export const WORKOUT_TYPES = [
  {
    // 7.2 rather than the compendium's 8.3 for continuous freestyle: a real
    // session is intervals, drills and rest walls, not an unbroken swim.
    id: 'swim', name: 'Pływanie', emoji: '🏊', color: '#007AFF',
    met: 7.2, sweat: 500, carbRate: 55, loadK: 1.15, distUnit: 'm', distStep: 100,
    icon: 'swim',
    note: 'Objętość w metrach — 1 km spokojnego kraula to około 20 minut.',
  },
  {
    id: 'gym', name: 'Siłownia', emoji: '🏋️', color: '#AF52DE',
    met: 5.0, sweat: 400, carbRate: 30, loadK: 0.9, distUnit: null,
    icon: 'gym',
    note: 'Licz czas pod obciążeniem razem z przerwami.',
  },
  {
    id: 'run', name: 'Bieganie', emoji: '🏃', color: '#FF9500',
    met: 9.8, sweat: 800, carbRate: 60, loadK: 1.2, distUnit: 'km', distStep: 0.5,
    icon: 'run',
  },
  {
    id: 'bike', name: 'Rower', emoji: '🚴', color: '#34C759',
    met: 7.5, sweat: 650, carbRate: 55, loadK: 1.0, distUnit: 'km', distStep: 1,
    icon: 'bike',
  },
  {
    id: 'walk', name: 'Marsz', emoji: '🚶', color: '#30B0C7',
    met: 3.5, sweat: 300, carbRate: 10, loadK: 0.5, distUnit: 'km', distStep: 0.5,
    icon: 'walk',
  },
  {
    id: 'mobility', name: 'Mobility / rozciąganie', emoji: '🧘', color: '#5856D6',
    met: 2.5, sweat: 150, carbRate: 0, loadK: 0.35, distUnit: null,
    icon: 'mobility',
  },
  {
    id: 'custom', name: 'Inny trening', emoji: '⚡', color: '#FF2D55',
    met: 6.0, sweat: 450, carbRate: 35, loadK: 0.9, distUnit: null,
    icon: 'custom',
  },
];

export const WORKOUT_INDEX = new Map(WORKOUT_TYPES.map((t) => [t.id, t]));

export const getType = (id) => WORKOUT_INDEX.get(id) || WORKOUT_INDEX.get('custom');
export const getIntensity = (id) => INTENSITY_INDEX.get(id) || INTENSITY_INDEX.get('moderate');

/** Effective MET for a type + intensity pair. */
export function metFor(typeId, intensityId) {
  const t = getType(typeId);
  const i = getIntensity(intensityId);
  // Above threshold the cost climbs faster than the linear factor suggests.
  const curve = i.factor > 1 ? 1 + (i.factor - 1) * 1.12 : i.factor;
  return t.met * curve;
}

/**
 * Energy cost of a session in kcal.
 * `weight` in kg, `minutes` in minutes. Returns a rounded integer.
 */
export function burnFor({ type, intensity, minutes, weight }) {
  const met = metFor(type, intensity);
  const kg = Math.max(30, +weight || 70);
  const min = Math.max(0, +minutes || 0);
  const kcal = (met * 3.5 * kg / 200) * min;
  return Math.round(kcal);
}

/** Fluid loss in ml for a session, used by the hydration target. */
export function sweatFor({ type, intensity, minutes }) {
  const t = getType(type);
  const i = getIntensity(intensity);
  return Math.round((t.sweat * i.factor) * ((+minutes || 0) / 60));
}

/** Carbohydrate the session justifies replacing, in grams. */
export function carbNeedFor({ type, intensity, minutes }) {
  const t = getType(type);
  const i = getIntensity(intensity);
  return Math.round(t.carbRate * i.factor * ((+minutes || 0) / 60));
}

/** Arbitrary-but-consistent load points, comparable across session types. */
export function loadFor({ type, intensity, minutes }) {
  const t = getType(type);
  const i = getIntensity(intensity);
  return Math.round((+minutes || 0) * t.loadK * i.factor * (i.rpe / 5));
}

/** Sum of the load of every session in a day. */
export const dayLoad = (workouts = []) => workouts.reduce((s, w) => s + loadFor(w), 0);

/** Human summary for a session, e.g. "3200 m · 75 min · mocno". */
export function describeWorkout(w) {
  const t = getType(w.type);
  const i = getIntensity(w.intensity);
  const bits = [];
  if (w.distance) bits.push(`${formatDistance(w.distance, t.distUnit)}`);
  if (w.minutes) bits.push(`${w.minutes} min`);
  bits.push(i.name.toLowerCase());
  return bits.join(' · ');
}

export function formatDistance(value, unit) {
  const v = +value || 0;
  if (unit === 'm') return v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(v)} m`;
  if (unit === 'km') return `${v.toFixed(1).replace('.', ',')} km`;
  return String(v);
}

/** Pace helper for the swim log: seconds per 100 m. */
export function swimPace(distanceM, minutes) {
  if (!distanceM || !minutes) return null;
  const secPer100 = (minutes * 60) / (distanceM / 100);
  const m = Math.floor(secPer100 / 60);
  const s = Math.round(secPer100 % 60);
  return `${m}:${String(s).padStart(2, '0')} / 100 m`;
}

/** Training phases shift the whole nutrition plan. */
export const PHASES = [
  { id: 'off', name: 'Roztrenowanie', kcal: 0.88, carb: 0.75, desc: 'Przerwa lub choroba' },
  { id: 'base', name: 'Baza', kcal: 1.0, carb: 1.0, desc: 'Objętość, spokojna intensywność' },
  { id: 'build', name: 'Ciężki blok', kcal: 1.09, carb: 1.18, desc: 'Dwa treningi dziennie, dużo pracy progowej' },
  { id: 'peak', name: 'Szczyt formy', kcal: 1.05, carb: 1.12, desc: 'Praca startowa, krótkie mocne serie' },
  { id: 'taper', name: 'Tapering', kcal: 0.94, carb: 1.05, desc: 'Mniej objętości, pełne glikogeny' },
];

export const PHASE_INDEX = new Map(PHASES.map((p) => [p.id, p]));
export const getPhase = (id) => PHASE_INDEX.get(id) || PHASE_INDEX.get('base');
