/* ==========================================================================
   Bottom sheet: one live sheet at a time, iOS-style drag-to-dismiss,
   focus trapping, Escape/back-button handling.
   ========================================================================== */

import { $, haptic, prefersReducedMotion, paintRanges } from '../core/utils.js';

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
  setBody(html);
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
    update(nextHtml) { if (current) setBody(nextHtml); },
    close: () => close(),
    el: body,
  };
}

export function update(html) {
  if (current && body) setBody(html);
}

/**
 * The single way sheet content is written. Anything that has to run against
 * freshly injected markup belongs here, so no call site can forget it.
 */
function setBody(html) {
  body.innerHTML = html;
  paintRanges(body);
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

/**
 * Pointer Events rather than touch: the same code then serves finger, mouse
 * and stylus, and it is testable in a desktop browser.
 */
function attachDrag() {
  const DISMISS_AT = 110;   // px of pull that commits to closing
  let startY = 0;
  let dy = 0;
  let dragging = false;
  let pointerId = null;

  const onDown = (e) => {
    if (!current?.dismissible) return;
    // Only start a dismiss drag from the top of the scroll area, otherwise the
    // gesture belongs to the sheet's own scrolling.
    if (sheet.scrollTop > 0) return;
    // Never hijack a drag that starts on a control the user is operating.
    if (e.target.closest('input[type="range"], input[type="time"], select, textarea')) return;

    pointerId = e.pointerId;
    startY = e.clientY;
    dy = 0;
    dragging = true;
  };

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dy = e.clientY - startY;
    if (dy <= 0) { sheet.style.transform = ''; return; }

    if (!sheet.classList.contains('dragging')) {
      sheet.classList.add('dragging');
      // Capture only once we are sure this is a drag, so taps still land.
      try { sheet.setPointerCapture(pointerId); } catch { /* ignored */ }
    }
    // Rubber-band: the further you pull, the more resistance.
    sheet.style.transform = `translateY(${dy < 120 ? dy : 120 + (dy - 120) * 0.35}px)`;
    if (e.cancelable) e.preventDefault();
  };

  const onUp = (e) => {
    if (!dragging || (e.pointerId != null && e.pointerId !== pointerId)) return;
    dragging = false;
    sheet.classList.remove('dragging');
    try { sheet.releasePointerCapture(pointerId); } catch { /* ignored */ }
    pointerId = null;

    if (dy > DISMISS_AT) { haptic('light'); close(); }
    else sheet.style.transform = '';
    dy = 0;
  };

  sheet.addEventListener('pointerdown', onDown, { passive: true });
  sheet.addEventListener('pointermove', onMove, { passive: false });
  sheet.addEventListener('pointerup', onUp);
  sheet.addEventListener('pointercancel', onUp);
}
