/* ==========================================================================
   Thumbnail hydration.

   Meal thumbnails are stored in IndexedDB rather than inside the state blob,
   so list markup ships a placeholder plus `data-thumb-id` and the real image
   is filled in right after paint. Anything already in the in-memory cache is
   rendered inline on the first pass, so scrolling back to a list the user has
   already seen shows no flicker at all.
   ========================================================================== */

import * as db from '../core/db.js';

/** 1×1 transparent GIF — no network, no layout shift. */
export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

let pending = 0;

/**
 * Fill in every not-yet-loaded thumbnail under `root`.
 * Safe to call on every render; already-hydrated images are skipped.
 */
export async function hydrateThumbs(root = document) {
  const nodes = root.querySelectorAll('img[data-thumb-id]');
  if (!nodes.length) return 0;

  const token = ++pending;
  let filled = 0;

  for (const img of nodes) {
    const id = img.dataset.thumbId;
    if (!id) { img.removeAttribute('data-thumb-id'); continue; }

    const cached = db.peekThumb(id);
    if (cached) {
      apply(img, cached);
      filled++;
      continue;
    }

    // Sequential on purpose: reads are cache-backed and short transactions
    // behave better than a burst of parallel ones on older Safari.
    const value = await db.getThumb(id);
    if (token !== pending) return filled;        // a newer render superseded us
    if (!img.isConnected) continue;
    if (value) { apply(img, value); filled++; }
    else img.removeAttribute('data-thumb-id');   // photo is gone; keep the placeholder
  }
  return filled;
}

function apply(img, src) {
  img.src = src;
  img.removeAttribute('data-thumb-id');
  img.classList.add('thumb-loaded');
}
