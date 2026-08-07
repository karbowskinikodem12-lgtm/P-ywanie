/* ==========================================================================
   Application shell: state wiring, routing, event delegation, lifecycle.
   ========================================================================== */

import {
  $, $$, dayKey, fmtDate, fmtDayLabel, isToday, haptic, debounce, esc,
  paintRange, paintRanges,
} from './core/utils.js';
import * as store from './core/store.js';
import * as db from './core/db.js';
import { initSheet, open as openSheet, close as closeSheet } from './ui/sheet.js';
import { initToast, toast, toastOk, toastErr } from './ui/toast.js';
import { hydrateThumbs } from './ui/thumbs.js';
import { computeTargets } from './domain/targets.js';
import { dayTotals, buildHistory } from './domain/analysis.js';
import * as reminders from './ui/reminders.js';
import * as onboarding from './ui/onboarding.js';
import { warmUp } from './vision/index.js';

import * as dashboard from './ui/views/dashboard.js';
import * as training from './ui/views/training.js';
import * as micro from './ui/views/micro.js';
import * as history from './ui/views/history.js';
import * as settings from './ui/views/settings.js';
import * as analyze from './ui/views/analyze.js';

const VIEWS = { day: dashboard, training, micro, history, me: settings };
const ACTIONS = Object.assign(
  {},
  dashboard.actions, training.actions, micro.actions, history.actions, settings.actions, analyze.actions,
);

let activeView = 'day';
let selectedKey = dayKey();
const scrollMemory = new Map();
let ctx = null;

/* ==========================================================================
   Context
   ========================================================================== */

function buildContext() {
  const state = store.getState();
  const day = store.getDay(selectedKey);
  const targets = computeTargets(state, selectedKey, day);
  const totals = dayTotals(day);

  const targetsFor = (key) => computeTargets(state, key, store.getDay(key));
  const historyFor = (count) => buildHistory(state, selectedKey, count, (key, d) => computeTargets(state, key, d || store.getDay(key)));

  return {
    state,
    key: selectedKey,
    day,
    targets,
    totals,
    history: historyFor(28),
    historyFor,
    targetsFor,
    render,
    go,
    setKey,
    dispatch,
    openSheet,
    closeSheet,
  };
}

/* ==========================================================================
   Rendering
   ========================================================================== */

let renderQueued = false;

export function render(opts = {}) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    paint(opts);
  });
}

function paint({ keepScroll = false, focus = null } = {}) {
  ctx = buildContext();
  const view = VIEWS[activeView];
  const host = $('#viewHost');
  if (!host || !view) return;

  const prevScroll = window.scrollY;
  host.innerHTML = `<section class="view on" id="view-${view.id}">${view.render(ctx)}</section>`;
  paintHeader();
  paintTabs();
  paintFab();

  if (keepScroll) window.scrollTo({ top: prevScroll });
  if (focus) {
    const el = document.getElementById(focus);
    if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); }
  }

  view.afterRender?.(ctx);
  hydrateThumbs(host);
  paintRanges(host);
}

function paintHeader() {
  const view = VIEWS[activeView];
  $('#hTitle').textContent = activeView === 'day' ? fmtDayLabel(selectedKey) : view.title;
  const sub = $('#hDate');
  sub.textContent = activeView === 'day'
    ? fmtDate(selectedKey, { weekday: 'long', day: 'numeric', month: 'long' })
    : (ctx.state.profile.name ? `Cześć, ${ctx.state.profile.name}` : 'Dziennik pływaka');

  const back = $('#headerBack');
  back.classList.toggle('hidden', activeView !== 'day' || isToday(selectedKey));
}

function paintTabs() {
  $$('#tabbar button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === activeView));
}

function paintFab() {
  const bar = $('#fabBar');
  const show = activeView === 'day' || activeView === 'micro';
  bar.classList.toggle('away', !show);
  // Views without the action bar only have to clear the tab bar, so they get
  // their trailing space back instead of ending on a stretch of blank page.
  $('#app').classList.toggle('no-fab', !show);
}

/* ==========================================================================
   Routing
   ========================================================================== */

function go(viewId) {
  if (!VIEWS[viewId] || viewId === activeView) return;
  scrollMemory.set(activeView, window.scrollY);
  activeView = viewId;
  render();
  const remembered = scrollMemory.get(viewId) || 0;
  requestAnimationFrame(() => window.scrollTo({ top: remembered }));
  haptic('light');
}

function setKey(key) {
  selectedKey = key;
  render();
}

/* ==========================================================================
   Event delegation
   ========================================================================== */

function dispatch(action, el) {
  const fn = ACTIONS[action] || SHELL_ACTIONS[action];
  if (!fn) return false;
  try {
    fn(ctx, el);
  } catch (e) {
    console.error(`[action:${action}]`, e);
    toastErr('Coś poszło nie tak. Spróbuj jeszcze raz.');
  }
  return true;
}

const SHELL_ACTIONS = {
  'sheet:close': () => closeSheet(),
  'go:micro': () => go('micro'),
  'go:training': () => go('training'),
  'go:history': () => go('history'),
  'day:today': () => setKey(dayKey()),
};

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  // Checkbox actions must keep their native toggle behaviour.
  if (el.tagName !== 'INPUT') e.preventDefault();
  dispatch(action, el);
}

/** Settings-style inputs: data-setting="profile.weight". */
function onSettingChange(e) {
  const el = e.target.closest('[data-setting]');
  if (el) {
    const path = el.dataset.setting.split('.');
    const value = el.type === 'checkbox' ? el.checked
      : el.type === 'number' ? (el.value === '' ? null : +el.value)
        : el.value;
    applySetting(path, value);
    render({ keepScroll: true });
    return;
  }

  const dayEl = e.target.closest('[data-day-field]');
  if (dayEl) {
    const value = dayEl.value === '' ? null : (dayEl.type === 'number' ? +dayEl.value : dayEl.value);
    store.setDayField(selectedKey, dayEl.dataset.dayField, value);
    render({ keepScroll: true });
  }
}

function applySetting(path, value) {
  const [root, ...rest] = path;
  const patch = rest.reduceRight((acc, key) => ({ [key]: acc }), value);
  switch (root) {
    case 'profile': store.setProfile(patch); break;
    case 'training': store.setTraining(patch); break;
    case 'goals': store.setGoals(patch); break;
    case 'settings': store.setSettings(patch); applyTheme(); break;
    default: break;
  }
}

/* ==========================================================================
   Theme
   ========================================================================== */

function applyTheme() {
  const theme = store.getState().settings.theme;
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  const dark = theme === 'dark'
    || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = dark ? '#0A0F14' : '#EEF3F8';
  document.head.append(meta);
}

/* ==========================================================================
   File inputs
   ========================================================================== */

function wireFiles() {
  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) analyze.handleFile(ctx, file);
  };
  $('#fileCam').addEventListener('change', onPhoto);
  $('#filePick').addEventListener('change', onPhoto);

  $('#fileImport').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await store.importState(await file.text());
      toastOk('Kopia wczytana');
      render();
    } catch (err) {
      toastErr(err.message || 'Nie udało się wczytać pliku.');
    }
  });
}

/* ==========================================================================
   Service worker
   ========================================================================== */

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });

    const offerUpdate = (sw) => {
      if (!sw) return;
      toast('Dostępna nowa wersja', {
        duration: 8000,
        actionLabel: 'Odśwież',
        onAction: () => { sw.postMessage({ type: 'SKIP_WAITING' }); },
      });
    };

    // A worker that finished installing during an earlier visit is already
    // parked in `waiting`, and `updatefound` will never fire for it again.
    // Without this the user could sit on the old version indefinitely, never
    // being offered the update that is sitting right there.
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(sw);
      });
    });

    // Only an *update* should reload. On a first visit the worker claims the
    // page and a reload here would restart the app the user just opened.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } catch (e) {
    console.warn('[sw] registration failed', e);
  }
}

/* ==========================================================================
   Install prompt
   ========================================================================== */

let installEvent = null;

function wireInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    const state = store.getState();
    if (state.meta.installPrompted) return;
    // Only ask once the app has proved useful — after a few logged meals.
    const logged = Object.values(state.days).reduce((s, d) => s + (d.meals?.length || 0), 0);
    if (logged < 3) return;

    store.commit((s) => { s.meta.installPrompted = true; }, 'meta');
    toast('Dodaj Tor do ekranu głównego', {
      duration: 9000,
      actionLabel: 'Dodaj',
      onAction: async () => {
        installEvent?.prompt();
        installEvent = null;
      },
    });
  });
}

/* ==========================================================================
   Boot
   ========================================================================== */

async function boot() {
  initSheet();
  initToast();
  wireFiles();
  wireInstall();

  document.addEventListener('click', onClick);
  document.addEventListener('change', onSettingChange);
  // Sliders paint their travelled portion from --pct; follow the drag.
  document.addEventListener('input', (e) => {
    if (e.target?.type === 'range') paintRange(e.target);
  });
  $('#tabbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (btn) go(btn.dataset.tab);
  });
  $('#headerBack').addEventListener('click', () => setKey(dayKey()));
  $('#avatarBtn').addEventListener('click', () => go('me'));

  await store.init();
  applyTheme();
  db.requestPersistence();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (store.getState().settings.theme === 'auto') applyTheme();
  });

  // Re-render whenever the store changes, coalesced to one frame.
  store.subscribe(debounce((_, reason) => {
    if (reason === 'saved') return;
    render({ keepScroll: true });
  }, 30));

  ctx = buildContext();

  if (onboarding.shouldShow(store.getState())) {
    onboarding.start(store.getState(), () => {
      render();
      reminders.ensureDefaults(store.getState());
    });
  }

  render();
  registerSW();
  handleLaunchAction();

  // Anything not needed for first paint happens after the UI is interactive.
  requestIdleCallbackSafe(async () => {
    reminders.schedule(store.getState());
    warmUp(store.getState());
    const moved = await store.migrateInlineThumbs();
    if (moved) console.info(`[storage] moved ${moved} thumbnails out of the state blob`);
    pruneOrphanPhotos();
  });

  // The app is typically left open overnight. When it comes back to the
  // foreground on a new date, follow the clock — unless the user had
  // deliberately navigated to some other day.
  let shownDay = dayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const today = dayKey();
    if (today !== shownDay) {
      if (selectedKey === shownDay) selectedKey = today;   // was on "today"
      shownDay = today;
    }
    render({ keepScroll: true });
    reminders.schedule(store.getState());
  });
}

/**
 * App-shortcut deep links (?action=photo|workout|water) declared in the
 * manifest. The parameter is consumed so a reload does not repeat the action.
 */
function handleLaunchAction() {
  let action;
  try { action = new URLSearchParams(location.search).get('action'); } catch { return; }
  if (!action) return;

  // `window.` is required here: this module imports the history *view* as
  // `history`, which shadows the global History object.
  try { window.history.replaceState(null, '', location.pathname); } catch { /* ignored */ }

  // One frame so the first paint is on screen before a sheet slides over it.
  requestAnimationFrame(() => {
    switch (action) {
      case 'photo': dispatch('capture:photo', null); break;
      case 'workout': go('training'); dispatch('workout:add', null); break;
      case 'water': dispatch('water:add', null); toast('Dolane do dziennika'); break;
      default: break;
    }
  });
}

/** Images whose meal was deleted are dead weight — clean them up quietly. */
async function pruneOrphanPhotos() {
  try {
    const removed = await db.prunePhotos(store.referencedPhotoIds());
    if (removed) console.info(`[storage] removed ${removed} orphaned images`);
  } catch { /* ignored */ }
}

function requestIdleCallbackSafe(fn) {
  if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 2500 });
  else setTimeout(fn, 800);
}

/* Global error surface: never leave the user staring at a frozen screen. */
window.addEventListener('error', (e) => {
  console.error('[app] uncaught', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[app] unhandled rejection', e.reason);
});

boot().catch((e) => {
  console.error('[app] boot failed', e);
  document.body.innerHTML = `
    <div style="max-width:420px;margin:80px auto;padding:24px;text-align:center;font-family:system-ui">
      <h2 style="margin-bottom:8px">Nie udało się uruchomić aplikacji</h2>
      <p style="color:#77828D;font-size:15px;line-height:1.5">${esc(e?.message || 'Nieznany błąd')}</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:14px 22px;border:0;border-radius:14px;background:#007AFF;color:#fff;font-size:16px;font-weight:600">
        Spróbuj ponownie
      </button>
    </div>`;
});

export { ctx };
