/* ==========================================================================
   First-run flow: four short steps, no account, no upload.
   ========================================================================== */

import { $, esc, clamp, haptic } from '../core/utils.js';
import * as store from '../core/store.js';
import { icon } from './icons.js';
import { computeTargets } from '../domain/targets.js';
import { emptyDay } from '../core/store.js';
import { PHASES } from '../data/exercise.js';

let step = 0;
let draft = null;
let host = null;
let done = null;

const STEPS = ['welcome', 'body', 'training', 'ready'];

export function shouldShow(state) {
  return !state.settings.onboarded;
}

export function start(state, onDone) {
  draft = {
    name: state.profile.name || '',
    sex: state.profile.sex,
    age: state.profile.age,
    height: state.profile.height,
    weight: state.profile.weight,
    poolHoursWeek: state.training.poolHoursWeek,
    dryHoursWeek: state.training.dryHoursWeek,
    phase: state.training.phase,
  };
  done = onDone;
  step = 0;

  host = document.createElement('div');
  host.className = 'onb';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', 'Konfiguracja');
  document.body.append(host);
  paint();
}

function paint() {
  host.innerHTML = `
    <div class="onb-inner">
      <div class="onb-step">${STEP_RENDERERS[STEPS[step]]()}</div>
      <div class="onb-dots" aria-hidden="true">
        ${STEPS.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}
      </div>
      <div>
        <button class="btn btn-primary" id="onbNext">${step === STEPS.length - 1 ? 'Zaczynamy' : 'Dalej'}</button>
        ${step > 0 ? `<button class="btn btn-quiet btn-block" id="onbBack">Wstecz</button>` : ''}
      </div>
    </div>`;

  host.scrollTop = 0;
  $('#onbNext', host).addEventListener('click', next);
  $('#onbBack', host)?.addEventListener('click', () => { step = Math.max(0, step - 1); paint(); });

  host.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('input', () => {
      const key = el.dataset.field;
      draft[key] = el.type === 'number' ? +el.value : el.value;
      const out = host.querySelector(`[data-echo="${key}"]`);
      if (out) out.textContent = el.value;
    });
  });

  host.querySelectorAll('[data-choice]').forEach((el) => {
    el.addEventListener('click', () => {
      const [key, value] = el.dataset.choice.split(':');
      draft[key] = Number.isNaN(+value) || key === 'sex' || key === 'phase' ? value : +value;
      host.querySelectorAll(`[data-choice^="${key}:"]`).forEach((b) => b.setAttribute('aria-pressed', b === el));
      haptic('light');
    });
  });
}

function next() {
  if (step < STEPS.length - 1) {
    step++;
    paint();
    return;
  }
  store.setProfile({
    name: draft.name.trim(),
    sex: draft.sex,
    age: clamp(+draft.age || 18, 10, 90),
    height: clamp(+draft.height || 180, 120, 230),
    weight: clamp(+draft.weight || 72, 30, 200),
  });
  store.setTraining({
    poolHoursWeek: clamp(+draft.poolHoursWeek || 0, 0, 40),
    dryHoursWeek: clamp(+draft.dryHoursWeek || 0, 0, 25),
    phase: draft.phase,
  });
  store.setSettings({ onboarded: true });
  close();
  done?.();
}

function close() {
  host?.remove();
  host = null;
  draft = null;
}

/* ---------------- steps ---------------- */

const STEP_RENDERERS = {
  welcome: () => `
    <img class="onb-logo" src="icon-512.png" alt="" width="76" height="76">
    <h1>Tor</h1>
    <p class="lead">Dziennik żywienia i treningu dla pływaka.<br>Zdjęcie posiłku zamienia się w komplet składników — bez konta, bez chmury.</p>
    <div class="stack">
      ${feature('camera', 'Zdjęcie zamiast wpisywania', 'Rozpoznawanie działa na twoim telefonie. Zdjęcia nigdzie nie wychodzą.')}
      ${feature('target', 'Cele liczone z treningu', 'Dopisujesz sesję — kalorie, węglowodany i nawodnienie same się przeliczają.')}
      ${feature('sparkles', '31 składników odżywczych', 'Nie tylko kalorie: witaminy, minerały, omega 3, błonnik.')}
      ${feature('lock', 'Wszystko zostaje u ciebie', 'Dane trzymane lokalnie. Kopię możesz zapisać do pliku w każdej chwili.')}
    </div>`,

  body: () => `
    <h1 style="margin-top:10px">Kilka liczb o tobie</h1>
    <p class="lead">Bez nich cele byłyby zgadywaniem. Zmienisz je później w zakładce „Ty”.</p>
    <section class="glass" style="margin-bottom:12px">
      <div class="field"><label for="oName">Imię <span class="hint">opcjonalnie</span></label>
        <input id="oName" data-field="name" type="text" value="${esc(draft.name)}" placeholder="Twoje imię"></div>
      <div class="field"><label for="oAge">Wiek</label>
        <input id="oAge" data-field="age" type="number" inputmode="numeric" min="10" max="90" value="${draft.age}"></div>
      <div class="field"><label for="oHeight">Wzrost (cm)</label>
        <input id="oHeight" data-field="height" type="number" inputmode="numeric" min="120" max="230" value="${draft.height}"></div>
      <div class="field"><label for="oWeight">Masa ciała (kg)</label>
        <input id="oWeight" data-field="weight" type="number" inputmode="decimal" min="30" max="200" step="0.5" value="${draft.weight}"></div>
    </section>
    <div class="input-label">Płeć <span style="font-weight:400">— wpływa na przemianę materii i normę żelaza</span></div>
    <div class="choice-grid">
      <button class="choice" data-choice="sex:m" aria-pressed="${draft.sex === 'm'}"><span class="ic">🏊‍♂️</span><b>Mężczyzna</b></button>
      <button class="choice" data-choice="sex:f" aria-pressed="${draft.sex === 'f'}"><span class="ic">🏊‍♀️</span><b>Kobieta</b></button>
    </div>`,

  training: () => `
    <h1 style="margin-top:10px">Jak wygląda twój tydzień</h1>
    <p class="lead">Tyle godzin, ile realnie robisz w typowym tygodniu. To punkt odniesienia — pojedyncze sesje dopiszesz na bieżąco.</p>
    <section class="glass" style="margin-bottom:14px">
      <div class="field"><label for="oPool">Woda <span class="hint">godzin tygodniowo</span></label>
        <input id="oPool" data-field="poolHoursWeek" type="number" inputmode="decimal" min="0" max="40" step="0.5" value="${draft.poolHoursWeek}"></div>
      <div class="field"><label for="oDry">Ląd <span class="hint">siłownia, bieganie, mobility</span></label>
        <input id="oDry" data-field="dryHoursWeek" type="number" inputmode="decimal" min="0" max="25" step="0.5" value="${draft.dryHoursWeek}"></div>
    </section>
    <div class="input-label">Faza treningowa</div>
    <div class="choice-grid">
      ${PHASES.map((p) => `
        <button class="choice" data-choice="phase:${p.id}" aria-pressed="${draft.phase === p.id}">
          <span class="ic">${{ off: '🌙', base: '🌊', build: '🔥', peak: '⚡', taper: '🎯' }[p.id]}</span>
          <b>${esc(p.name)}</b><span>${esc(p.desc)}</span>
        </button>`).join('')}
    </div>`,

  ready: () => {
    const preview = computeTargets(
      {
        profile: { ...draft },
        training: { phase: draft.phase, poolHoursWeek: draft.poolHoursWeek, dryHoursWeek: draft.dryHoursWeek },
        goals: { mode: 'auto', manual: {} },
      },
      null,
      emptyDay('preview'),
    );
    return `
      <h1 style="margin-top:10px">Twój plan startowy</h1>
      <p class="lead">Tak wygląda przeciętny dzień treningowy. Każda dopisana sesja przesunie te liczby.</p>
      <section class="glass pad-lg">
        <div class="tiles">
          <div class="tile"><b class="num">${Math.round(preview.kcal)}</b><span>kcal</span></div>
          <div class="tile"><b class="num">${Math.round(preview.protein)}</b><span>białko g</span></div>
          <div class="tile"><b class="num">${Math.round(preview.carbs)}</b><span>węgle g</span></div>
          <div class="tile"><b class="num">${Math.round(preview.fat)}</b><span>tłuszcz g</span></div>
        </div>
        <div class="tiles tiles-2" style="margin-top:8px">
          <div class="tile"><b class="num">${(preview.water / 1000).toFixed(1).replace('.', ',')} l</b><span>woda</span></div>
          <div class="tile"><b class="num">${preview.meta.bmr}</b><span>BMR kcal</span></div>
        </div>
      </section>
      <div class="callout callout-info" style="margin-top:14px">
        ${icon('lock', { size: 18 })}
        <div>Zdjęcia i dane zostają na tym urządzeniu. Aplikacja działa też bez internetu.</div>
      </div>`;
  },
};

function feature(iconName, title, text) {
  return `
    <div class="advice-item">
      <span class="ic" style="color:var(--blue)">${icon(iconName, { size: 20 })}</span>
      <div><b>${esc(title)}</b><div class="fix">${esc(text)}</div></div>
    </div>`;
}
