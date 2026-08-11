/* ==========================================================================
   Build marker.

   There is no build step here, so nothing stamps a version into the files and
   two devices running different releases look identical from the outside.
   That matters more than it sounds: a phone holding an old service worker
   renders the old app perfectly, so "is this fixed?" and "did this reach me?"
   are indistinguishable from a screenshot — which has already cost one round
   of diagnosing a bug that was in fact simply not deployed yet.

   Shown in Settings → Dane. Bump it with any release worth telling apart.
   ========================================================================== */

export const BUILD = '2026-08-11';
