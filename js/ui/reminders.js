/* ==========================================================================
   Reminders.

   Two delivery paths, picked automatically:
     • Notification Triggers (TimestampTrigger) — fires even when the app is
       closed, on browsers that support it.
     • In-session timers — a guaranteed fallback that fires while the app is
       open, plus a catch-up check when the app is re-opened.

   No push server is involved: everything is scheduled on the device.
   ========================================================================== */

import { uid, minutesOfDay, dayKey, clamp } from '../core/utils.js';
import * as store from '../core/store.js';

export const REMINDER_TYPES = {
  breakfast: { name: 'Śniadanie', emoji: '🍳', body: 'Zacznij dzień od porządnego śniadania — poranna woda tego wymaga.' },
  lunch: { name: 'Obiad', emoji: '🍛', body: 'Pora na obiad. Białko plus węglowodany, żeby popołudniowy trening miał z czego iść.' },
  dinner: { name: 'Kolacja', emoji: '🍽️', body: 'Kolacja domyka dzień — dobierz ją do tego, ile jeszcze zostało do celu.' },
  water: { name: 'Woda', emoji: '💧', body: 'Szklanka wody. W basenie nie czujesz pragnienia, a tracisz płyny tak samo.' },
  postworkout: { name: 'Po treningu', emoji: '💪', body: 'Okno potreningowe: 25–30 g białka i porcja węglowodanów w ciągu godziny.' },
  sleep: { name: 'Sen', emoji: '😴', body: 'Czas kończyć dzień. Sen to najmocniejszy pojedynczy czynnik regeneracji.' },
  recovery: { name: 'Regeneracja', emoji: '🧘', body: 'Rolowanie, rozciąganie, 10 minut spokoju. Jutro podziękujesz.' },
};

export const DEFAULT_REMINDERS = [
  { type: 'breakfast', time: '07:00', days: [1, 2, 3, 4, 5, 6, 0], enabled: true },
  { type: 'water', time: '10:30', days: [1, 2, 3, 4, 5, 6, 0], enabled: true },
  { type: 'lunch', time: '13:30', days: [1, 2, 3, 4, 5, 6, 0], enabled: true },
  { type: 'postworkout', time: '17:30', days: [1, 2, 3, 4, 5], enabled: true },
  { type: 'water', time: '18:30', days: [1, 2, 3, 4, 5, 6, 0], enabled: false },
  { type: 'dinner', time: '20:00', days: [1, 2, 3, 4, 5, 6, 0], enabled: true },
  { type: 'recovery', time: '21:00', days: [1, 2, 3, 4, 5], enabled: false },
  { type: 'sleep', time: '22:15', days: [1, 2, 3, 4, 5, 6, 0], enabled: true },
];

const timers = new Set();
let fired = new Map();     // reminderId → dayKey it last fired on

export function ensureDefaults(state) {
  if (state.reminders?.length) return false;
  store.setReminders(DEFAULT_REMINDERS.map((r) => ({ id: uid('r'), ...r })));
  return true;
}

export const permission = () => (('Notification' in window) ? Notification.permission : 'unsupported');

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); }
  catch { return 'denied'; }
}

/* ---------------- scheduling ---------------- */

export async function schedule(state) {
  clearTimers();
  if (!state.settings.remindersEnabled) return;
  if (permission() !== 'granted') return;

  const list = (state.reminders || []).filter((r) => r.enabled);
  if (!list.length) return;

  const reg = await getRegistration();
  const supportsTriggers = 'showTrigger' in Notification.prototype && reg;

  if (supportsTriggers) {
    await scheduleWithTriggers(reg, list);
    return;
  }

  const now = new Date();
  const today = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const r of list) {
    if (!r.days.includes(today)) continue;
    const at = minutesOfDay(r.time);
    if (at <= nowMin) continue;
    const delay = (at - nowMin) * 60000 - now.getSeconds() * 1000;
    // setTimeout beyond ~24 days overflows; reminders are always same-day.
    const t = setTimeout(() => fire(r), clamp(delay, 1000, 86400000));
    timers.add(t);
  }
}

/**
 * Notification Triggers survive the app being closed. We schedule the next 7
 * days and refresh the window on every launch.
 */
async function scheduleWithTriggers(reg, list) {
  try {
    const existing = await reg.getNotifications({ includeTriggered: false });
    for (const n of existing) n.close();
  } catch { /* ignored */ }

  const now = Date.now();
  for (const r of list) {
    const meta = REMINDER_TYPES[r.type];
    if (!meta) continue;
    for (let d = 0; d < 7; d++) {
      const when = new Date();
      when.setDate(when.getDate() + d);
      const [h, m] = r.time.split(':').map(Number);
      when.setHours(h, m, 0, 0);
      if (when.getTime() <= now) continue;
      if (!r.days.includes(when.getDay())) continue;
      try {
        await reg.showNotification(`${meta.emoji} ${meta.name}`, {
          body: meta.body,
          tag: `${r.id}-${dayKey(when)}`,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          silent: false,
          // eslint-disable-next-line no-undef
          showTrigger: new TimestampTrigger(when.getTime()),
          data: { type: r.type, url: './' },
        });
      } catch { /* the browser refused this one; the rest still schedule */ }
    }
  }
}

function fire(reminder) {
  const meta = REMINDER_TYPES[reminder.type];
  if (!meta) return;
  const today = dayKey();
  if (fired.get(reminder.id) === today) return;
  fired.set(reminder.id, today);

  try {
    const body = contextualBody(reminder.type) || meta.body;
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(`${meta.emoji} ${meta.name}`, {
        body, tag: reminder.id, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' },
      })).catch(() => {});
    } else {
      // eslint-disable-next-line no-new
      new Notification(`${meta.emoji} ${meta.name}`, { body, icon: 'icon-192.png' });
    }
  } catch { /* notification blocked mid-session */ }
}

/** Make the copy useful: reference what the day actually looks like. */
function contextualBody(type) {
  const state = store.getState();
  const day = store.getDay();
  if (type === 'water') {
    const drank = (day.water || []).reduce((s, w) => s + w.ml, 0);
    if (drank > 0) return `Wypite dziś: ${(drank / 1000).toFixed(1).replace('.', ',')} l. Dolej szklankę.`;
  }
  if (type === 'postworkout' && !(day.workouts || []).length) {
    return 'Jeśli dziś trenowałeś, dopisz sesję — cele przeliczą się same.';
  }
  if ((type === 'lunch' || type === 'dinner') && !(day.meals || []).length) {
    return 'Dziś nie ma jeszcze żadnego posiłku. Jedno zdjęcie i masz komplet.';
  }
  return null;
}

async function getRegistration() {
  try { return await navigator.serviceWorker?.ready; } catch { return null; }
}

export function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
}

/** Cancel every scheduled trigger (used when reminders are switched off). */
export async function cancelAll() {
  clearTimers();
  const reg = await getRegistration();
  if (!reg) return;
  try {
    const ns = await reg.getNotifications({ includeTriggered: true });
    for (const n of ns) n.close();
  } catch { /* ignored */ }
}

/** Next reminder that will fire, for the settings summary line. */
export function nextReminder(state) {
  const list = (state.reminders || []).filter((r) => r.enabled);
  if (!list.length) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let best = null;
  for (let d = 0; d < 7; d++) {
    const weekday = (now.getDay() + d) % 7;
    for (const r of list) {
      if (!r.days.includes(weekday)) continue;
      const at = minutesOfDay(r.time);
      if (d === 0 && at <= nowMin) continue;
      const delta = d * 1440 + at - nowMin;
      if (!best || delta < best.delta) best = { reminder: r, delta, weekday };
    }
  }
  return best;
}
