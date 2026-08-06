/* ==========================================================================
   Bottom sheet: one live sheet at a time, iOS-style drag-to-dismiss,
   focus trapping, Escape/back-button handling.
   ========================================================================== */

import { $, haptic, prefersReducedMotion } from '../core/utils.js';

let scrim, sheet, body;
let current = null;
let lastFocused = null;

export function initSheet() {
  scrim = $('#scrim');
  sheet = $('#sheet');
  body = $('#sheetBody');
  if (!scrim || !sheet) return;

  scrim.addEventListener('click', () => close());
  document.addEventListener('keydown', onKeydown);
  attachDrag();

  // The hardware/browser back gesture should dismiss the sheet, not the app.
  window.addEventListener('popstate', () => { if (current) close({ fromHistory: true }); });
}

function onKeydown(e) {
  if (!current) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key !== 'Tab') return;

  const focusables = sheet.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/**
 * Open (or replace) the sheet.
 * @returns {{update:(html:string)=>void, close:()=>void, el:HTMLElement}}
 */
export function open(html, { label = 'Panel', onClose = null, dismissible = true } = {}) {
  if (!sheet) return { update() {}, close() {}, el: document.createElement('div') };

  if (!current) {
    lastFocused = document.activeElement;
    try { history.pushState({ sheet: true }, ''); } catch { /* ignored */ }
  }

  current = { onClose, dismissible };
  sheet.setAttribute('aria-label', label);
  body.innerHTML = html;
  sheet.scrollTop = 0;
  sheet.classList.add('on');
  scrim.classList.add('on');
  document.body.style.overflow = 'hidden';

  // Focus the first meaningful control so keyboard and VoiceOver land inside.
  requestAnimationFrame(() => {
    const target = sheet.querySelector('[autofocus], input, button.btn-primary, button');
    target?.focus?.({ preventScroll: true });
  });

  return {
    update(nextHtml) { if (current) body.innerHTML = nextHtml; },
    close: () => close(),
    el: body,
  };
}

export function update(html) {
  if (current && body) body.innerHTML = html;
}

export function close({ fromHistory = false } = {}) {
  if (!current || !sheet) return;
  const { onClose } = current;
  current = null;

  sheet.classList.remove('on');
  scrim.classList.remove('on');
  sheet.style.transform = '';
  document.body.style.overflow = '';

  if (!fromHistory) {
    try { if (history.state?.sheet) history.back(); } catch { /* ignored */ }
  }

  const delay = prefersReducedMotion() ? 0 : 380;
  setTimeout(() => { if (!current && body) body.innerHTML = ''; }, delay);

  lastFocused?.focus?.({ preventScroll: true });
  lastFocused = null;
  try { onClose?.(); } catch (e) { console.error('[sheet] onClose failed', e); }
}

export const isOpen = () => !!current;

/* ---------------- drag to dismiss ---------------- */

function attachDrag() {
  let startY = 0;
  let dy = 0;
  let dragging = false;
  let startedAtTop = true;

  const onStart = (e) => {
    if (!current?.dismissible) return;
    const t = e.touches ? e.touches[0] : e;
    // Only start a dismiss drag from the top of the scroll area, otherwise
    // the gesture belongs to the sheet's own scrolling.
    startedAtTop = sheet.scrollTop <= 0;
    startY = t.clientY;
    dy = 0;
    dragging = true;
  };

  const onMove = (e) => {
    if (!dragging || !startedAtTop) return;
    const t = e.touches ? e.touches[0] : e;
    dy = t.clientY - startY;
    if (dy <= 0) { sheet.style.transform = ''; return; }
    sheet.classList.add('dragging');
    // Rubber-band: the further you pull, the more resistance.
    sheet.style.transform = `translateY(${dy < 120 ? dy : 120 + (dy - 120) * 0.35}px)`;
    if (e.cancelable) e.preventDefault();
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    if (dy > 110) { haptic('light'); close(); }
    else sheet.style.transform = '';
    dy = 0;
  };

  sheet.addEventListener('touchstart', onStart, { passive: true });
  sheet.addEventListener('touchmove', onMove, { passive: false });
  sheet.addEventListener('touchend', onEnd);
  sheet.addEventListener('touchcancel', onEnd);
}
