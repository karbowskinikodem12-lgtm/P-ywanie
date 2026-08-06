/* ==========================================================================
   Application state: a single serialisable object plus typed mutators.

   Rules:
     • Nothing outside this module mutates `state` directly.
     • Every mutator goes through `commit()` which persists (debounced) and
       notifies subscribers exactly once per frame.
     • Deletions go to `trash` first so History can offer "Cofnij".
   ========================================================================== */

import * as db from './db.js';
import { dayKey, uid, merge, clamp, safeParse } from './utils.js';
import { LEGACY_MAP } from '../data/nutrients.js';

const STATE_KEY = 'state';
const SCHEMA_VERSION = 3;
const MAX_DAYS = 400;          // ~13 months of history
const TRASH_TTL_DAYS = 30;
const MAX_TRASH = 60;

export const DEFAULT_STATE = {
  version: SCHEMA_VERSION,
  profile: {
    name: '',
    sex: 'm',
    age: 18,
    height: 180,
    weight: 72,
    sport: 'swim',
    level: 'competitive',
  },
  training: {
    phase: 'base',        // base | build | peak | taper | off
    poolHoursWeek: 14,
    dryHoursWeek: 3,
    sessionsPerDay: 2,
  },
  goals: {
    mode: 'auto',
    manual: { kcal: 3200, protein: 140, carbs: 450, fat: 90, water: 3500 },
  },
  settings: {
    theme: 'auto',                 // auto | light | dark
    haptics: true,
    onboarded: false,
    remindersEnabled: false,
    vision: {
      mode: 'auto',                // auto | model | assist
      allowDownload: true,         // may fetch the on-device model over the network
      device: 'auto',              // auto | webgpu | wasm
      lastEngine: null,
    },
    glassSize: 250,
  },
  days: {},
  reminders: [],
  learning: { corrections: [], priors: {}, portions: {}, signatures: [] },
  trash: [],
  meta: { lastOpen: null, installPrompted: false, created: null },
};

export function emptyDay(key) {
  return { key, meals: [], workouts: [], water: [], weight: null, sleepH: null, rpe: null, note: '' };
}

/* ---------------- reactive core ---------------- */

let state = structuredCloneSafe(DEFAULT_STATE);
let listeners = new Set();
let saveTimer = null;
let notifyQueued = false;
let lastSaveAt = null;
let saveTier = null;
let loaded = false;

function structuredCloneSafe(o) {
  try { return structuredClone(o); } catch { return JSON.parse(JSON.stringify(o)); }
}

export const getState = () => state;
export const getSaveInfo = () => ({ at: lastSaveAt, tier: saveTier ?? db.tier, loaded });

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(reason) {
  if (notifyQueued) return;
  notifyQueued = true;
  requestAnimationFrame(() => {
    notifyQueued = false;
    for (const fn of listeners) {
      try { fn(state, reason); } catch (e) { console.error('[store] listener failed', e); }
    }
  });
}

/**
 * Apply a mutation. The mutator receives the live state and may modify it
 * freely; returning `false` marks the change as a no-op.
 */
export function commit(mutator, reason = 'update') {
  const result = mutator(state);
  if (result === false) return false;
  scheduleSave();
  notify(reason);
  return true;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}

export async function flush() {
  clearTimeout(saveTimer);
  try {
    prune();
    saveTier = await db.set(STATE_KEY, state);
    lastSaveAt = new Date();
    notify('saved');
  } catch (e) {
    console.error('[store] save failed', e);
  }
}

// Never lose the last few edits when the app is backgrounded on iOS.
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', () => { flush(); });

/* ---------------- housekeeping ---------------- */

function prune() {
  const keys = Object.keys(state.days).sort();
  if (keys.length > MAX_DAYS) {
    for (const k of keys.slice(0, keys.length - MAX_DAYS)) delete state.days[k];
  }
  const cutoff = Date.now() - TRASH_TTL_DAYS * 86400000;
  state.trash = state.trash.filter((t) => t.at > cutoff).slice(-MAX_TRASH);
  if (state.learning.corrections.length > 800) {
    state.learning.corrections = state.learning.corrections.slice(-800);
  }
  if (state.learning.signatures.length > 300) {
    state.learning.signatures = state.learning.signatures.slice(-300);
  }
}

/* ---------------- load & migrate ---------------- */

export async function init() {
  let stored = null;
  try { stored = await db.get(STATE_KEY); } catch { /* ignored */ }

  if (stored && typeof stored === 'object') {
    state = migrate(stored);
  } else {
    const legacy = readLegacy();
    state = legacy ? migrate(legacy) : structuredCloneSafe(DEFAULT_STATE);
    if (legacy) console.info('[store] imported legacy data');
  }

  if (!state.meta.created) state.meta.created = new Date().toISOString();
  state.meta.lastOpen = new Date().toISOString();
  loaded = true;
  saveTier = db.tier;
  await flush();
  return state;
}

/** Read the pre-modular single-file version out of localStorage. */
function readLegacy() {
  try {
    const raw = localStorage.getItem('swim-log');
    if (!raw) return null;
    const d = safeParse(raw);
    if (!d || !d.days) return null;
    return { __legacy: true, ...d };
  } catch { return null; }
}

function migrate(input) {
  let s = input;

  if (s.__legacy) {
    const p = s.profile || {};
    const next = structuredCloneSafe(DEFAULT_STATE);
    next.profile.weight = +p.w || next.profile.weight;
    next.training.poolHoursWeek = clamp((+p.h || 2) * 6, 0, 40);
    next.training.dryHoursWeek = clamp(+p.dry || 3, 0, 25);
    next.training.phase = ({ 1: 'base', 1.15: 'base', 1.3: 'build', 0.9: 'taper' })[String(p.i)] || 'base';
    next.settings.onboarded = true;

    for (const [key, meals] of Object.entries(s.days || {})) {
      const day = emptyDay(key);
      day.meals = (meals || []).map((m) => legacyMeal(m, key));
      next.days[key] = day;
    }
    return next;
  }

  // Forward migrations, applied in order.
  if (!s.version || s.version < 3) {
    s = merge(structuredCloneSafe(DEFAULT_STATE), s);
    s.version = 3;
  }

  const base = structuredCloneSafe(DEFAULT_STATE);
  const out = merge(base, s);
  out.days = {};
  for (const [k, d] of Object.entries(s.days || {})) {
    out.days[k] = { ...emptyDay(k), ...d, key: k };
  }
  out.trash = Array.isArray(s.trash) ? s.trash : [];
  out.reminders = Array.isArray(s.reminders) ? s.reminders : base.reminders;
  out.learning = merge(base.learning, s.learning || {});
  out.version = SCHEMA_VERSION;
  return out;
}

function legacyMeal(m, key) {
  const totals = {};
  for (const [from, to] of Object.entries(LEGACY_MAP)) {
    const [a, b] = from.split('.');
    const v = b ? (m[a] || {})[b] : m[a];
    if (v != null) totals[to] = +v || 0;
  }
  return {
    id: uid('m'),
    name: m.n || 'Posiłek',
    time: m.t || '12:00',
    ts: new Date(`${key}T${(m.t || '12:00')}:00`).getTime(),
    grams: +m.g || 0,
    slot: guessSlot(m.t),
    source: 'legacy',
    thumb: m.img || null,
    photoId: null,
    items: [{ name: m.n || 'Posiłek', grams: +m.g || 0, confidence: 0.6, foodId: null }],
    totals,
  };
}

export function guessSlot(time) {
  const h = parseInt(String(time || '12:00').slice(0, 2), 10) || 12;
  if (h < 10) return 'breakfast';
  if (h < 12) return 'snack';
  if (h < 16) return 'lunch';
  if (h < 18) return 'snack';
  if (h < 22) return 'dinner';
  return 'snack';
}

/* ---------------- selectors ---------------- */

export function getDay(key = dayKey()) {
  return state.days[key] || emptyDay(key);
}

export function hasDay(key) {
  const d = state.days[key];
  return !!d && (d.meals.length || d.workouts.length || d.water.length);
}

export function dayKeys() {
  return Object.keys(state.days).sort();
}

function ensureDay(key) {
  if (!state.days[key]) state.days[key] = emptyDay(key);
  return state.days[key];
}

/* ---------------- mutators: meals ---------------- */

export function addMeal(meal, key = dayKey()) {
  const record = { id: uid('m'), ts: Date.now(), source: 'manual', items: [], ...meal, key };
  commit((s) => { ensureDay(key).meals.push(record); }, 'meal:add');
  return record;
}

export function updateMeal(id, patch, key = dayKey()) {
  return commit((s) => {
    const day = ensureDay(key);
    const i = day.meals.findIndex((m) => m.id === id);
    if (i < 0) return false;
    day.meals[i] = { ...day.meals[i], ...patch };
  }, 'meal:update');
}

export function removeMeal(id, key = dayKey()) {
  return commit((s) => {
    const day = ensureDay(key);
    const i = day.meals.findIndex((m) => m.id === id);
    if (i < 0) return false;
    const [item] = day.meals.splice(i, 1);
    s.trash.push({ id: uid('t'), at: Date.now(), kind: 'meal', key, item });
  }, 'meal:remove');
}

export function moveMeal(id, fromKey, toKey) {
  return commit((s) => {
    const from = ensureDay(fromKey);
    const i = from.meals.findIndex((m) => m.id === id);
    if (i < 0) return false;
    const [item] = from.meals.splice(i, 1);
    ensureDay(toKey).meals.push({ ...item, key: toKey });
  }, 'meal:move');
}

/* ---------------- mutators: workouts ---------------- */

export function addWorkout(workout, key = dayKey()) {
  const record = { id: uid('w'), ts: Date.now(), ...workout, key };
  commit(() => { ensureDay(key).workouts.push(record); }, 'workout:add');
  return record;
}

export function updateWorkout(id, patch, key = dayKey()) {
  return commit(() => {
    const day = ensureDay(key);
    const i = day.workouts.findIndex((w) => w.id === id);
    if (i < 0) return false;
    day.workouts[i] = { ...day.workouts[i], ...patch };
  }, 'workout:update');
}

export function removeWorkout(id, key = dayKey()) {
  return commit((s) => {
    const day = ensureDay(key);
    const i = day.workouts.findIndex((w) => w.id === id);
    if (i < 0) return false;
    const [item] = day.workouts.splice(i, 1);
    s.trash.push({ id: uid('t'), at: Date.now(), kind: 'workout', key, item });
  }, 'workout:remove');
}

/* ---------------- mutators: hydration & day fields ---------------- */

export function addWater(ml, key = dayKey()) {
  const entry = { id: uid('h'), ml: Math.round(ml), ts: Date.now() };
  commit(() => { ensureDay(key).water.push(entry); }, 'water:add');
  return entry;
}

export function undoWater(key = dayKey()) {
  return commit(() => {
    const day = ensureDay(key);
    if (!day.water.length) return false;
    day.water.pop();
  }, 'water:undo');
}

export function setDayField(key, field, value) {
  return commit(() => { ensureDay(key)[field] = value; }, 'day:field');
}

export function clearDay(key = dayKey()) {
  return commit((s) => {
    const day = state.days[key];
    if (!day) return false;
    s.trash.push({ id: uid('t'), at: Date.now(), kind: 'day', key, item: structuredCloneSafe(day) });
    state.days[key] = emptyDay(key);
  }, 'day:clear');
}

/* ---------------- trash ---------------- */

export function restoreTrash(trashId) {
  return commit((s) => {
    const i = s.trash.findIndex((t) => t.id === trashId);
    if (i < 0) return false;
    const [entry] = s.trash.splice(i, 1);
    const day = ensureDay(entry.key);
    if (entry.kind === 'meal') day.meals.push(entry.item);
    else if (entry.kind === 'workout') day.workouts.push(entry.item);
    else if (entry.kind === 'day') s.days[entry.key] = entry.item;
    return true;
  }, 'trash:restore');
}

export function emptyTrash() {
  return commit((s) => { s.trash = []; }, 'trash:empty');
}

/* ---------------- profile / settings ---------------- */

export function setProfile(patch) {
  return commit((s) => { s.profile = { ...s.profile, ...patch }; }, 'profile');
}

export function setTraining(patch) {
  return commit((s) => { s.training = { ...s.training, ...patch }; }, 'training');
}

export function setGoals(patch) {
  return commit((s) => { s.goals = merge(s.goals, patch); }, 'goals');
}

export function setSettings(patch) {
  return commit((s) => { s.settings = merge(s.settings, patch); }, 'settings');
}

export function setReminders(list) {
  return commit((s) => { s.reminders = list; }, 'reminders');
}

/* ---------------- learning ---------------- */

export function recordCorrection(entry) {
  return commit((s) => {
    s.learning.corrections.push({ at: Date.now(), ...entry });
    if (entry.to) s.learning.priors[entry.to] = (s.learning.priors[entry.to] || 0) + 1;
    if (entry.from && entry.from !== entry.to) {
      s.learning.priors[entry.from] = (s.learning.priors[entry.from] || 0) - 0.5;
    }
  }, 'learning');
}

export function recordPortion(foodId, grams) {
  if (!foodId || !grams) return false;
  return commit((s) => {
    const prev = s.learning.portions[foodId];
    // Exponential moving average: the user's most recent habit dominates.
    s.learning.portions[foodId] = prev ? Math.round(prev * 0.65 + grams * 0.35) : Math.round(grams);
  }, 'learning');
}

export function recordSignature(sig) {
  return commit((s) => { s.learning.signatures.push(sig); }, 'learning');
}

/* ---------------- import / export ---------------- */

export function exportState() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'tor' }, null, 0);
}

export async function importState(json, { mergeDays = true } = {}) {
  const parsed = typeof json === 'string' ? safeParse(json) : json;
  if (!parsed || typeof parsed !== 'object' || !parsed.days) {
    throw new Error('To nie jest kopia zapasowa aplikacji Tor.');
  }
  const incoming = migrate(parsed);
  commit((s) => {
    const days = mergeDays ? { ...s.days, ...incoming.days } : incoming.days;
    Object.assign(s, incoming, { days });
  }, 'import');
  await flush();
  return true;
}

export async function wipe() {
  state = structuredCloneSafe(DEFAULT_STATE);
  state.meta.created = new Date().toISOString();
  await db.del(STATE_KEY);
  try { localStorage.removeItem('swim-log'); } catch { /* ignored */ }
  await flush();
  notify('wipe');
}
