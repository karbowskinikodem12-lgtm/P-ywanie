/* ==========================================================================
   "Ty" — profile, goals, reminders, on-device model, data and appearance.
   ========================================================================== */

import { esc, fmtVolume, dayKey, WEEKDAYS_SHORT, haptic } from '../../core/utils.js';
import * as store from '../../core/store.js';
import * as db from '../../core/db.js';
import { icon } from '../icons.js';
import * as sheet from '../sheet.js';
import { toast, toastOk, toastErr } from '../toast.js';
import { sectionTitle, callout, macroTiles } from '../components.js';
import { explainTargets, bmr } from '../../domain/targets.js';
import { PHASES } from '../../data/exercise.js';
import { probe, model } from '../../vision/index.js';
import { deleteWithUndo } from '../undo.js';
import { recommendEngine, resetProbe } from '../../vision/capabilities.js';
import { learningStats } from '../../vision/learning.js';
import { getItem } from '../../data/food-db.js';
import * as reminders from '../reminders.js';

export const id = 'me';
export const title = 'Ty';

let caps = null;

export function render(ctx) {
  const { state, targets, day } = ctx;
  const p = state.profile;
  const stats = learningStats(state.learning);
  const engine = caps ? recommendEngine(caps, state.settings) : null;
  const nextRem = reminders.nextReminder(state);
  const save = store.getSaveInfo();

  return `
    <section class="glass pad-lg">
      <div class="row-flex" style="gap:14px">
        <div class="avatar" style="width:54px;height:54px;font-size:20px">${initials(p.name)}</div>
        <div class="grow">
          <div class="t-bold" style="font-size:19px">${esc(p.name || 'Pływak')}</div>
          <div class="t-sm t-sub">${p.weight} kg · ${p.height} cm · ${p.age} lat · ${PHASES.find((x) => x.id === state.training.phase)?.name || ''}</div>
        </div>
        <button class="icon-btn" data-action="profile:edit" aria-label="Edytuj profil">${icon('edit', { size: 20 })}</button>
      </div>
    </section>

    ${sectionTitle('Dzisiaj')}
    <section class="glass">
      <div class="field">
        <label for="fWeightToday">Masa ciała <span class="hint">rano, na czczo</span></label>
        <input id="fWeightToday" data-day-field="weight" type="number" inputmode="decimal" min="30" max="200" step="0.1"
          placeholder="${p.weight}" value="${day.weight ?? ''}">
      </div>
      <div class="field">
        <label for="fSleep">Sen <span class="hint">godzin ostatniej nocy</span></label>
        <input id="fSleep" data-day-field="sleepH" type="number" inputmode="decimal" min="0" max="14" step="0.5"
          placeholder="8" value="${day.sleepH ?? ''}">
      </div>
      <div class="field">
        <label for="fRpe">Odczucie <span class="hint">jak ciężko było dziś (1–10)</span></label>
        <input id="fRpe" data-day-field="rpe" type="number" inputmode="numeric" min="1" max="10" step="1"
          placeholder="—" value="${day.rpe ?? ''}">
      </div>
    </section>

    ${sectionTitle('Cele dnia')}
    <section class="glass pad">
      ${macroTiles(targets, { decimals: 0 })}
      <div class="tiles tiles-3" style="margin-top:8px">
        <div class="tile"><b class="num">${fmtVolume(targets.water)}</b><span>woda</span></div>
        <div class="tile"><b class="num">${Math.round(targets.fiber)}</b><span>błonnik g</span></div>
        <div class="tile"><b class="num">${targets.meta.bmr}</b><span>BMR kcal</span></div>
      </div>
      <p class="note" style="margin:14px 4px 0">${esc(explainTargets(targets))}</p>
      <p class="note" style="margin:6px 4px 0">
        Białko ${targets.meta.proteinPerKg} g/kg · węglowodany ${targets.meta.carbPerKg} g/kg masy ciała.
      </p>
    </section>

    <section class="glass" style="margin-top:12px">
      <div class="field">
        <label for="goalMode">Tryb celów</label>
        <select id="goalMode" data-setting="goals.mode">
          <option value="auto"${state.goals.mode === 'auto' ? ' selected' : ''}>Automatyczne</option>
          <option value="manual"${state.goals.mode === 'manual' ? ' selected' : ''}>Ręczne</option>
        </select>
      </div>
      ${state.goals.mode === 'manual' ? `
        <div class="field"><label for="gKcal">Kalorie</label>
          <input id="gKcal" data-setting="goals.manual.kcal" type="number" inputmode="numeric" min="1200" max="8000" step="50" value="${state.goals.manual.kcal}"></div>
        <div class="field"><label for="gPro">Białko (g)</label>
          <input id="gPro" data-setting="goals.manual.protein" type="number" inputmode="numeric" min="40" max="400" step="5" value="${state.goals.manual.protein}"></div>
        <div class="field"><label for="gCarb">Węglowodany (g)</label>
          <input id="gCarb" data-setting="goals.manual.carbs" type="number" inputmode="numeric" min="50" max="1200" step="10" value="${state.goals.manual.carbs}"></div>
        <div class="field"><label for="gFat">Tłuszcz (g)</label>
          <input id="gFat" data-setting="goals.manual.fat" type="number" inputmode="numeric" min="20" max="300" step="5" value="${state.goals.manual.fat}"></div>
        <div class="field"><label for="gWater">Woda (ml)</label>
          <input id="gWater" data-setting="goals.manual.water" type="number" inputmode="numeric" min="1000" max="8000" step="100" value="${state.goals.manual.water}"></div>
      ` : ''}
    </section>

    ${sectionTitle('Przypomnienia')}
    <section class="glass">
      <div class="field">
        <label for="remOn">Włącz przypomnienia
          <span class="hint">${remStatusLine(nextRem)}</span></label>
        <label class="switch">
          <input id="remOn" type="checkbox" data-action="rem:toggle" ${state.settings.remindersEnabled ? 'checked' : ''}>
          <i></i>
        </label>
      </div>
    </section>
    ${state.settings.remindersEnabled ? reminderList(state) : ''}

    ${sectionTitle('Rozpoznawanie zdjęć')}
    <section class="glass pad">
      <div class="spread" style="margin-bottom:12px">
        <span class="engine-pill ${model.state.status === 'ready' ? 'on' : model.state.status === 'loading' ? 'load' : 'assist'}">
          <span class="dot"></span>${esc(engineStatusText(engine))}
        </span>
        <button class="btn btn-quiet btn-sm" data-action="vision:detail">Szczegóły</button>
      </div>
      <div class="field" style="padding-left:0;padding-right:0">
        <label for="visionMode">Tryb</label>
        <select id="visionMode" data-setting="settings.vision.mode">
          <option value="auto"${state.settings.vision.mode === 'auto' ? ' selected' : ''}>Automatyczny</option>
          <option value="model"${state.settings.vision.mode === 'model' ? ' selected' : ''}>Zawsze model lokalny</option>
          <option value="assist"${state.settings.vision.mode === 'assist' ? ' selected' : ''}>Zawsze wspomagany</option>
        </select>
      </div>
      <div class="field" style="padding-left:0;padding-right:0">
        <label for="visionDl">Pobieranie modelu
          <span class="hint">jednorazowo ~40 MB, potem działa offline</span></label>
        <label class="switch">
          <input id="visionDl" type="checkbox" data-setting="settings.vision.allowDownload" ${state.settings.vision.allowDownload ? 'checked' : ''}>
          <i></i>
        </label>
      </div>
      <div class="row-flex" style="gap:8px;margin-top:12px">
        <button class="btn btn-quiet btn-sm grow" data-action="vision:load">
          ${model.state.status === 'ready' ? 'Przeładuj model' : 'Pobierz model teraz'}
        </button>
        <button class="btn btn-quiet btn-sm grow" data-action="vision:clear">Wyczyść pamięć modelu</button>
      </div>
    </section>

    ${sectionTitle('Czego się nauczyła aplikacja')}
    <section class="glass pad">
      <div class="tiles tiles-3">
        <div class="tile"><b class="num">${stats.corrections}</b><span>poprawek</span></div>
        <div class="tile"><b class="num">${stats.signatures}</b><span>zapamiętanych zdjęć</span></div>
        <div class="tile"><b class="num">${stats.portions}</b><span>twoich porcji</span></div>
      </div>
      ${stats.favourites.length ? `
        <div class="input-label" style="margin-top:14px">Najczęściej jadasz</div>
        <div class="alts">
          ${stats.favourites.map((f) => {
            const item = getItem(f.id);
            return item ? `<span class="chip">${item.emoji} ${esc(item.name)}</span>` : '';
          }).join('')}
        </div>` : `<p class="note" style="margin:12px 4px 0">Każda poprawka rozpoznania uczy aplikację twoich posiłków. Wszystko zostaje na tym urządzeniu.</p>`}
      ${stats.corrections || stats.signatures ? `
        <button class="btn btn-quiet btn-sm" style="width:100%;margin-top:12px" data-action="learn:reset">Wyczyść naukę</button>` : ''}
    </section>

    ${sectionTitle('Wygląd')}
    <section class="glass">
      <div class="field">
        <label for="theme">Motyw</label>
        <select id="theme" data-setting="settings.theme">
          <option value="auto"${state.settings.theme === 'auto' ? ' selected' : ''}>Jak w systemie</option>
          <option value="light"${state.settings.theme === 'light' ? ' selected' : ''}>Jasny</option>
          <option value="dark"${state.settings.theme === 'dark' ? ' selected' : ''}>Ciemny</option>
        </select>
      </div>
      <div class="field">
        <label for="haptics">Wibracje <span class="hint">delikatna reakcja na dotyk</span></label>
        <label class="switch">
          <input id="haptics" type="checkbox" data-setting="settings.haptics" ${state.settings.haptics ? 'checked' : ''}>
          <i></i>
        </label>
      </div>
      <div class="field">
        <label for="glassSize">Szklanka <span class="hint">ile dolewa przycisk wody</span></label>
        <input id="glassSize" data-setting="settings.glassSize" type="number" inputmode="numeric" min="100" max="1000" step="50" value="${state.settings.glassSize}">
      </div>
    </section>

    ${sectionTitle('Dane')}
    <section class="glass">
      <div class="field"><label>Zapis</label><span class="val" id="storageLine">${esc(db.tierLabel())}${save.at ? ` · ${save.at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : ''}</span></div>
      <div class="field"><label>Dni w historii</label><span class="val num">${Object.keys(state.days).filter((k) => store.hasDay(k)).length}</span></div>
      <div class="field"><label>Zajęte miejsce</label><span class="val num" id="usageLine">liczę…</span></div>
    </section>
    <button class="btn btn-quiet" style="margin-top:10px" data-action="data:export">${icon('download', { size: 18 })} Zapisz kopię do pliku</button>
    <button class="btn btn-quiet btn-block" data-action="data:import">${icon('upload', { size: 18 })} Wczytaj kopię</button>
    <p class="note">Aplikacja zapisuje wszystko sama po każdej zmianie. Kopia do pliku przydaje się przy zmianie telefonu — wystarczy ją potem wczytać.</p>

    <button class="btn btn-danger" style="margin-top:10px" data-action="day:clear">Wyczyść dzisiejszy dzień</button>
    <button class="btn btn-danger btn-block" data-action="data:wipe">Usuń wszystkie dane</button>

    <p class="note t-center" style="margin-top:22px">
      Tor · dziennik pływaka<br>
      Wszystkie obliczenia i zdjęcia zostają na tym urządzeniu.
    </p>`;
}

const initials = (name) => (name || 'T').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'T';

function remStatusLine(next) {
  const perm = reminders.permission();
  if (perm === 'unsupported') return 'Ta przeglądarka nie obsługuje powiadomień';
  if (perm === 'denied') return 'Powiadomienia zablokowane w ustawieniach systemu';
  if (!next) return 'Brak zaplanowanych';
  const meta = reminders.REMINDER_TYPES[next.reminder.type];
  const when = next.delta < 60 ? `za ${next.delta} min` : `za ${Math.round(next.delta / 60)} h`;
  return `Najbliższe: ${meta?.name || ''} ${when}`;
}

function reminderList(state) {
  return `
    <section class="glass" style="margin-top:10px">
      ${(state.reminders || []).map((r) => {
        const meta = reminders.REMINDER_TYPES[r.type] || { name: r.type, emoji: '🔔' };
        return `
          <div class="rem-row">
            <div class="rem-icon">${meta.emoji}</div>
            <div class="grow">
              <div class="rem-time">
                <input type="time" value="${esc(r.time)}" data-rem-time="${r.id}" aria-label="Godzina: ${esc(meta.name)}">
              </div>
              <div class="rem-name">${esc(meta.name)}</div>
              <div class="rem-days">
                ${[1, 2, 3, 4, 5, 6, 0].map((d) => `
                  <button data-rem-day="${r.id}" data-day="${d}" aria-pressed="${r.days.includes(d)}"
                    aria-label="${WEEKDAYS_SHORT[d]}">${WEEKDAYS_SHORT[d]}</button>`).join('')}
              </div>
            </div>
            <label class="switch">
              <input type="checkbox" data-rem-on="${r.id}" ${r.enabled ? 'checked' : ''} aria-label="Włącz ${esc(meta.name)}">
              <i></i>
            </label>
          </div>`;
      }).join('')}
    </section>`;
}

function engineStatusText(engine) {
  if (model.state.status === 'loading') return 'Ładuję model…';
  if (model.state.status === 'ready') return `Model gotowy · ${model.state.modelLabel} · ${model.state.device === 'webgpu' ? 'GPU' : 'CPU'}`;
  if (model.state.status === 'failed') return 'Model niedostępny — tryb wspomagany';
  return engine === 'model' ? 'Model lokalny gotowy do pobrania' : 'Tryb wspomagany';
}

/* ---------------- lifecycle ---------------- */

export async function afterRender(ctx) {
  // Storage usage is async — fill it in once it resolves.
  const line = document.getElementById('usageLine');
  if (line) {
    const { usage, quota } = await db.estimate();
    line.textContent = usage
      ? `${(usage / 1048576).toFixed(1)} MB${quota ? ` z ${(quota / 1048576).toFixed(0)} MB` : ''}`
      : 'nieznane';
  }

  if (!caps) {
    caps = await probe();
    const pill = document.querySelector('.engine-pill');
    if (pill) pill.lastChild.textContent = engineStatusText(recommendEngine(caps, ctx.state.settings));
  }

  // Reminder controls are per-row and easier to wire directly than by action.
  document.querySelectorAll('[data-rem-time]').forEach((el) => {
    el.addEventListener('change', () => updateReminder(ctx, el.dataset.remTime, { time: el.value }));
  });
  document.querySelectorAll('[data-rem-on]').forEach((el) => {
    el.addEventListener('change', () => updateReminder(ctx, el.dataset.remOn, { enabled: el.checked }));
  });
  document.querySelectorAll('[data-rem-day]').forEach((el) => {
    el.addEventListener('click', () => {
      const id2 = el.dataset.remDay;
      const d = +el.dataset.day;
      const r = ctx.state.reminders.find((x) => x.id === id2);
      if (!r) return;
      const days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d];
      el.setAttribute('aria-pressed', days.includes(d));
      updateReminder(ctx, id2, { days });
      haptic('light');
    });
  });
}

function updateReminder(ctx, id2, patch) {
  const list = ctx.state.reminders.map((r) => (r.id === id2 ? { ...r, ...patch } : r));
  store.setReminders(list);
  reminders.schedule(ctx.state);
}

/* ---------------- sheets ---------------- */

function profileSheet(ctx) {
  const p = ctx.state.profile;
  sheet.open(`
    <div class="grab"></div>
    <h2>Twój profil</h2>
    <p class="sheet-sub">Z tych danych liczą się wszystkie cele — od kalorii po zapotrzebowanie na żelazo.</p>
    <section class="glass" style="box-shadow:none;background:var(--fill)">
      <div class="field"><label for="pName">Imię</label>
        <input id="pName" data-setting="profile.name" type="text" value="${esc(p.name)}" placeholder="Twoje imię"></div>
      <div class="field"><label for="pSex">Płeć <span class="hint">wpływa na BMR i normę żelaza</span></label>
        <select id="pSex" data-setting="profile.sex">
          <option value="m"${p.sex === 'm' ? ' selected' : ''}>Mężczyzna</option>
          <option value="f"${p.sex === 'f' ? ' selected' : ''}>Kobieta</option>
        </select></div>
      <div class="field"><label for="pAge">Wiek</label>
        <input id="pAge" data-setting="profile.age" type="number" inputmode="numeric" min="10" max="90" value="${p.age}"></div>
      <div class="field"><label for="pHeight">Wzrost (cm)</label>
        <input id="pHeight" data-setting="profile.height" type="number" inputmode="numeric" min="120" max="230" value="${p.height}"></div>
      <div class="field"><label for="pWeight">Masa ciała (kg)</label>
        <input id="pWeight" data-setting="profile.weight" type="number" inputmode="decimal" min="30" max="200" step="0.5" value="${p.weight}"></div>
    </section>
    <p class="note">BMR: <b>${bmr(p)} kcal</b> — tyle spalasz leżąc cały dzień.</p>
    <div class="sheet-actions">
      <button class="btn btn-primary" data-action="sheet:close">Gotowe</button>
    </div>`, { label: 'Profil' });
}

async function visionSheet(ctx) {
  caps = await probe(true);
  const engine = recommendEngine(caps, ctx.state.settings);
  sheet.open(`
    <div class="grab"></div>
    <h2>Jak działa rozpoznawanie</h2>
    <p class="sheet-sub">
      Zdjęcie nigdy nie opuszcza telefonu. Aplikacja najpierw analizuje kadr lokalnie (kolor, tekstura,
      układ na talerzu), a jeśli urządzenie to udźwignie — dokłada model sieci neuronowej działający
      w przeglądarce. Model dobiera odpowiedź wyłącznie z bazy produktów tej aplikacji.
    </p>

    <div class="glass list" style="box-shadow:none;background:var(--fill)">
      <div class="item"><div class="grow"><div class="title">Wybrana ścieżka</div></div>
        <div class="value" style="font-size:15px">${engine === 'model' ? 'Model lokalny' : 'Wspomagana'}</div></div>
      <div class="item"><div class="grow"><div class="title">Akceleracja</div></div>
        <div class="value" style="font-size:15px">${caps.webgpu ? 'WebGPU' : caps.webnn ? 'WebNN' : caps.wasmSimd ? 'WASM SIMD' : 'brak'}</div></div>
      <div class="item"><div class="grow"><div class="title">Rdzenie CPU</div></div>
        <div class="value num">${caps.threads}</div></div>
      <div class="item"><div class="grow"><div class="title">Model w pamięci urządzenia</div></div>
        <div class="value" style="font-size:15px">${caps.storageCached ? 'tak' : 'nie'}</div></div>
      <div class="item"><div class="grow"><div class="title">Sieć</div></div>
        <div class="value" style="font-size:15px">${caps.online ? (caps.effectiveType || 'online') : 'offline'}</div></div>
      ${model.state.lastMs ? `<div class="item"><div class="grow"><div class="title">Ostatnia analiza</div></div>
        <div class="value num">${model.state.lastMs} ms</div></div>` : ''}
      ${model.state.error ? `<div class="item"><div class="grow"><div class="title">Ostatni błąd</div>
        <div class="meta">${esc(model.state.error)}</div></div></div>` : ''}
    </div>

    ${!caps.webgpu ? callout('info', 'To urządzenie nie udostępnia WebGPU. Model może działać na procesorze, ale wolniej — tryb wspomagany bywa wtedy szybszy i równie wygodny.') : ''}

    <div class="sheet-actions">
      <button class="btn btn-primary" data-action="vision:load">${model.state.status === 'ready' ? 'Przeładuj model' : 'Pobierz i uruchom model'}</button>
      <button class="btn btn-quiet btn-block" data-action="sheet:close">Zamknij</button>
    </div>`, { label: 'Rozpoznawanie' });
}

/* ---------------- actions ---------------- */

export const actions = {
  'profile:edit': (ctx) => profileSheet(ctx),
  'vision:detail': (ctx) => visionSheet(ctx),

  'vision:load': async (ctx) => {
    const c = caps || await probe();
    toast('Pobieram model…');
    const ok = await model.load({
      caps: c,
      onProgress: ({ text }) => {
        const pill = document.querySelector('.engine-pill');
        if (pill && text) pill.lastChild.textContent = text;
      },
    });
    if (ok) toastOk(`Model gotowy · ${model.state.device === 'webgpu' ? 'GPU' : 'CPU'}`);
    else toastErr(model.state.error || 'Nie udało się uruchomić modelu. Zostaje tryb wspomagany.');
    ctx.render();
  },

  'vision:clear': async (ctx) => {
    await model.clearCache();
    resetProbe();
    caps = null;
    toast('Pamięć modelu wyczyszczona');
    ctx.render();
  },

  'learn:reset': (ctx) => {
    store.commit((s) => { s.learning = { corrections: [], priors: {}, portions: {}, signatures: [] }; }, 'learning');
    toast('Nauka wyczyszczona');
    ctx.render();
  },

  'rem:toggle': async (ctx, el) => {
    const on = el.checked;
    if (on) {
      const perm = await reminders.requestPermission();
      if (perm !== 'granted') {
        el.checked = false;
        toastErr(perm === 'unsupported'
          ? 'Ta przeglądarka nie obsługuje powiadomień.'
          : 'Bez zgody na powiadomienia przypomnienia nie zadziałają.');
        return;
      }
      reminders.ensureDefaults(ctx.state);
    } else {
      await reminders.cancelAll();
    }
    store.setSettings({ remindersEnabled: on });
    reminders.schedule(ctx.state);
    ctx.render();
  },

  'data:export': () => {
    try {
      const blob = new Blob([store.exportState()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tor-${dayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toastOk('Kopia zapisana');
    } catch {
      toastErr('Nie udało się zapisać kopii.');
    }
  },

  'data:import': () => document.getElementById('fileImport')?.click(),

  'data:wipe': () => {
    sheet.open(`
      <div class="grab"></div>
      <h2>Usunąć wszystko?</h2>
      <p class="sheet-sub">Znikną wszystkie dni, posiłki, treningi i nauka aplikacji. Tej operacji nie da się cofnąć — jeśli masz wątpliwości, najpierw zapisz kopię.</p>
      <div class="sheet-actions">
        <button class="btn btn-danger-solid" data-action="data:wipeConfirm">Tak, usuń wszystko</button>
        <button class="btn btn-quiet btn-block" data-action="sheet:close">Anuluj</button>
      </div>`, { label: 'Usuwanie danych' });
  },

  'data:wipeConfirm': async (ctx) => {
    await store.wipe();
    sheet.close();
    toast('Dane usunięte');
    ctx.render();
  },

  'day:clear': (ctx) => {
    deleteWithUndo(ctx, { kind: 'day', key: ctx.key, message: 'Dzień wyczyszczony' });
  },
};
