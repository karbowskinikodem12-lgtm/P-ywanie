/* ==========================================================================
   Toasts — short, non-blocking confirmations with an optional undo action.
   ========================================================================== */

import { $, esc, haptic } from '../core/utils.js';
import { icon } from './icons.js';

let host;
const ICONS = { ok: 'checkCircle', warn: 'warn', err: 'xCircle', info: 'info' };

export function initToast() {
  host = $('#toastHost');
}

/**
 * @param {string} text
 * @param {{kind?:'ok'|'warn'|'err'|'info', duration?:number,
 *          actionLabel?:string, onAction?:Function}} opts
 */
export function toast(text, { kind = 'info', duration = 2800, actionLabel = '', onAction = null } = {}) {
  if (!host) return () => {};

  // Keep the stack shallow — three at once is already noise.
  while (host.children.length >= 3) host.firstElementChild.remove();

  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  node.innerHTML = `${icon(ICONS[kind] || 'info', { size: 17 })}<span style="color:var(--text)">${esc(text)}</span>`;

  if (actionLabel && onAction) {
    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      try { onAction(); } finally { dismiss(); }
    });
    node.append(btn);
  }

  host.append(node);
  haptic(kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : 'light');

  let timer = setTimeout(dismiss, duration);
  node.addEventListener('pointerenter', () => clearTimeout(timer));
  node.addEventListener('pointerleave', () => { timer = setTimeout(dismiss, 1200); });

  function dismiss() {
    clearTimeout(timer);
    if (!node.isConnected) return;
    node.classList.add('out');
    setTimeout(() => node.remove(), 240);
  }

  return dismiss;
}

export const toastOk = (t, o) => toast(t, { kind: 'ok', ...o });
export const toastErr = (t, o) => toast(t, { kind: 'err', duration: 4200, ...o });
export const toastWarn = (t, o) => toast(t, { kind: 'warn', duration: 3600, ...o });
