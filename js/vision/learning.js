/* ==========================================================================
   Learning layer.

   Three memories, all local:
     priors      — how often the user logs each food (frequency prior)
     signatures  — image descriptor → confirmed food, a nearest-neighbour
                   memory that makes the *same* recurring meal recognisable
                   even when the generic model gets it wrong
     portions    — the user's habitual gram amount per food

   Nothing is uploaded and nothing is shared between users; the model itself
   is never fine-tuned. This is deliberately a thin personalisation layer that
   can be inspected and cleared from Settings.
   ========================================================================== */

import { signatureDistance } from './image.js';
import { clamp } from '../core/utils.js';

const MATCH_THRESHOLD = 0.16;   // cosine distance below which photos "look alike"
const MAX_MATCHES = 5;

/**
 * Foods previously confirmed on photos that look like this one.
 * @returns {{id:string, weight:number, distance:number}[]}
 */
export function matchSignature(signature, learning) {
  const entries = learning?.signatures || [];
  if (!signature || !entries.length) return [];

  const scored = [];
  for (const entry of entries) {
    const d = signatureDistance(signature, entry.sig);
    if (d < MATCH_THRESHOLD) scored.push({ id: entry.id, distance: d, at: entry.at });
  }
  if (!scored.length) return [];

  scored.sort((a, b) => a.distance - b.distance);

  // Merge duplicates: several confirmations of the same food reinforce it.
  const merged = new Map();
  const now = Date.now();
  for (const s of scored.slice(0, 24)) {
    const proximity = 1 - s.distance / MATCH_THRESHOLD;      // 0..1
    const ageDays = (now - (s.at || now)) / 86400000;
    const recency = clamp(1 - ageDays / 240, 0.35, 1);        // 8-month half-life
    const weight = proximity * recency;
    const cur = merged.get(s.id) || { id: s.id, weight: 0, distance: s.distance };
    cur.weight += weight;
    cur.distance = Math.min(cur.distance, s.distance);
    merged.set(s.id, cur);
  }

  return [...merged.values()]
    .map((m) => ({ ...m, weight: clamp(m.weight, 0, 2.2) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_MATCHES);
}

/**
 * Confidence bonus for a candidate given the learned memories.
 * Applied multiplicatively by the orchestrator.
 */
export function confidenceBoost(id, { matches = [], priors = {} } = {}) {
  const match = matches.find((m) => m.id === id);
  let boost = 1;
  if (match) boost *= 1 + clamp(match.weight, 0, 2) * 0.28;
  const prior = priors[id] || 0;
  if (prior > 0) boost *= 1 + clamp(prior, 0, 15) * 0.02;
  return boost;
}

/**
 * Build the records to persist after the user accepts (or fixes) a result.
 * Called once per saved meal.
 */
export function buildLearningUpdates({ signature, accepted, suggested, items }) {
  const updates = { corrections: [], signatures: [], portions: [] };

  if (accepted && signature) {
    updates.signatures.push({ id: accepted, sig: signature, at: Date.now() });
  }
  if (accepted && suggested && accepted !== suggested) {
    updates.corrections.push({ from: suggested, to: accepted, at: Date.now() });
  }
  for (const item of items || []) {
    if (item.foodId && item.grams) updates.portions.push({ id: item.foodId, grams: item.grams });
  }
  return updates;
}

/** Human-readable summary for the settings screen. */
export function learningStats(learning) {
  const corrections = learning?.corrections?.length || 0;
  const signatures = learning?.signatures?.length || 0;
  const portions = Object.keys(learning?.portions || {}).length;
  const favourites = Object.entries(learning?.priors || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ id, n }));
  return { corrections, signatures, portions, favourites };
}
