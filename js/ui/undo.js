/* ==========================================================================
   Deletion with a one-tap undo.

   Every destructive action in the app follows the same contract: remove the
   record, push it to the trash, and offer it back for a few seconds. Keeping
   that in one place means no screen can accidentally ship a delete that cannot
   be taken back.
   ========================================================================== */

import * as store from '../core/store.js';
import { toast } from './toast.js';

const REMOVERS = {
  meal: store.removeMeal,
  workout: store.removeWorkout,
  day: (id, key) => store.clearDay(key),
};

/**
 * @param {object} ctx      app context (used to re-render)
 * @param {object} opts     { kind: 'meal'|'workout'|'day', id, key, message }
 * @returns {boolean}       whether anything was removed
 */
export function deleteWithUndo(ctx, { kind, id, key, message }) {
  const remove = REMOVERS[kind];
  if (!remove) return false;
  if (!remove(id, key)) return false;

  const trash = store.getState().trash;
  const entry = trash[trash.length - 1];
  ctx.render();

  toast(message || 'Usunięto', {
    duration: 5000,
    actionLabel: 'Cofnij',
    onAction: () => {
      if (entry) store.restoreTrash(entry.id);
      ctx.render();
    },
  });
  return true;
}
