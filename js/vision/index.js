/* ==========================================================================
   Vision orchestrator.

   Guarantees, in order of importance:
     1. The user always gets a usable result. Every stage after the heuristic
        pass is an upgrade, never a prerequisite.
     2. Something appears on screen in well under a second — the heuristic
        proposal is emitted immediately while the model is still warming up.
     3. Switching between the neural and the assisted path is invisible apart
        from an honest confidence badge.

   Timeline of one analysis:

     decode ─► features ─► heuristic ─► [emit partial]
                                  └──► model (if viable) ─► [emit final]
   ========================================================================== */

import { prepareImage, describe, segment, signatureOf, qualityWarning } from './image.js';
import { probe, recommendEngine, describeCaps } from './capabilities.js';
import * as model from './model-engine.js';
import { analyse as heuristicAnalyse, proposeMeal, shortlistFor, slotForHour } from './heuristic-engine.js';
import { matchSignature, confidenceBoost } from './learning.js';
import { estimatePortion, estimatePlateMass, distributeMass } from './portion.js';
import { getItem, expandDish, visionLabels } from '../data/food-db.js';
import { clamp } from '../core/utils.js';

export const ENGINE_LABELS = {
  model: 'Model lokalny',
  assist: 'Tryb wspomagany',
  learned: 'Rozpoznane z historii',
};

/**
 * @typedef {object} AnalysisResult
 * @property {'model'|'assist'|'learned'} engine
 * @property {string} name        proposed meal name
 * @property {string} suggestedId primary item id the engine proposed
 * @property {number} confidence  0..1 for the primary item
 * @property {Array}  items       [{foodId,name,emoji,grams,confidence,source}]
 * @property {Array}  alternatives one-tap corrections for the primary item
 * @property {object} photo       {thumb, display}
 * @property {Array}  signature   image descriptor for the learning memory
 * @property {string|null} warning
 * @property {object} timings
 */

/**
 * Analyse a photo.
 *
 * @param {File|Blob} file
 * @param {object} opts
 * @param {object} opts.state      application state (settings + learning)
 * @param {(p:{stage:string,progress:number,text:string})=>void} [opts.onProgress]
 * @param {(r:AnalysisResult)=>void} [opts.onPartial] called with the instant result
 * @returns {Promise<AnalysisResult>}
 */
export async function analyzePhoto(file, { state, onProgress, onPartial } = {}) {
  const t0 = performance.now();
  const report = (stage, progress, text) => onProgress?.({ stage, progress, text });
  const settings = state?.settings || {};
  const learning = state?.learning || {};
  const hour = new Date().getHours();

  /* ---- 1. decode & downscale ---- */
  report('prepare', 0.08, 'Przygotowuję zdjęcie…');
  const image = await prepareImage(file);
  const tPrepare = performance.now();

  /* ---- 2. local features (always, ~30-80 ms) ---- */
  report('features', 0.22, 'Analizuję kadr…');
  const features = describe(image.analysis);
  const seg = segment(image.analysis);
  const signature = signatureOf(features);
  const warning = qualityWarning(features);
  const tFeatures = performance.now();

  /* ---- 3. personal memory + heuristic proposal ---- */
  const matches = matchSignature(signature, learning);
  const ranked = heuristicAnalyse(features, seg, {
    hour,
    priors: learning.priors || {},
    learnedMatches: matches,
  });
  const proposal = proposeMeal(ranked, seg, features);

  const partial = buildResult({
    ranked, proposal, features, seg, image, signature, learning,
    engine: matches.length && matches[0].weight > 0.9 ? 'learned' : 'assist',
    learnedWeight: matches[0]?.id === (proposal.primary?.id) ? matches[0].weight : 0,
    warning, hour,
    timings: { prepare: tPrepare - t0, features: tFeatures - tPrepare, total: performance.now() - t0 },
  });

  onPartial?.(partial);
  report('proposal', 0.4, 'Mam wstępne rozpoznanie');

  /* ---- 4. neural upgrade, when the device can sustain it ---- */
  const caps = await probe();
  const wanted = recommendEngine(caps, settings);
  if (wanted !== 'model') {
    report('done', 1, describeCaps(caps));
    return { ...partial, caps, engineReason: caps.reason || 'assist-mode' };
  }

  try {
    if (!model.isReady()) {
      report('model', 0.45, 'Ładuję model na urządzeniu…');
      const ok = await model.load({
        caps,
        onProgress: (p) => report('model', 0.45 + (p.progress || 0) * 0.35, p.text),
      });
      if (!ok) throw new Error(model.state.error || 'Model niedostępny');
    }

    report('classify', 0.85, 'Rozpoznaję składniki…');
    const wide = caps.webgpu === true;
    const candidates = shortlistFor(ranked, { size: wide ? 90 : 48, wide: false });
    const neural = await model.classify(image.model, candidates, { topK: 8 });
    if (!neural.length) throw new Error('Model nie zwrócił wyniku');

    // Fuse: the model decides *what*, the heuristic and the personal memory
    // adjust *how sure* we are.
    const fused = neural.map((n) => {
      const heur = ranked.items.find((x) => x.id === n.id);
      const boost = confidenceBoost(n.id, { matches, priors: learning.priors || {} });
      const agreement = heur ? 1 + clamp(heur.score, 0, 0.6) * 0.5 : 1;
      return { id: n.id, score: clamp(n.score * boost * agreement, 0, 0.985), region: heur?.region ?? null };
    }).sort((a, b) => b.score - a.score);

    const neuralRanked = { ...ranked, items: mergeRanked(fused, ranked.items) };
    const neuralProposal = proposeMeal(neuralRanked, seg, features);

    const final = buildResult({
      ranked: neuralRanked, proposal: neuralProposal, features, seg, image, signature, learning,
      engine: 'model', warning, hour,
      timings: {
        prepare: tPrepare - t0,
        features: tFeatures - tPrepare,
        model: model.state.lastMs,
        total: performance.now() - t0,
      },
    });

    report('done', 1, `${ENGINE_LABELS.model} · ${model.state.modelLabel || ''}`.trim());
    return { ...final, caps, engineReason: model.state.device };
  } catch (e) {
    // Any failure here is a downgrade, not an error the user has to deal with.
    console.warn('[vision] model path unavailable:', e?.message || e);
    report('done', 1, 'Tryb wspomagany — model niedostępny');
    return {
      ...partial,
      caps,
      engine: partial.engine === 'learned' ? 'learned' : 'assist',
      engineReason: 'model-failed',
      engineError: e?.message || String(e),
    };
  }
}

/** Keep neural order, append heuristic-only candidates as alternatives. */
function mergeRanked(fused, heuristicItems) {
  const seen = new Set(fused.map((f) => f.id));
  const extras = heuristicItems
    .filter((h) => !seen.has(h.id))
    .map((h) => ({ ...h, score: h.score * 0.5 }));
  return [...fused, ...extras];
}

/* ---------------- result assembly ---------------- */

function buildResult({ ranked, proposal, features, seg, image, signature, learning, engine, warning, hour, timings, learnedWeight = 0 }) {
  const primary = proposal.primary;
  const primaryItem = primary ? getItem(primary.id) : null;

  const items = [];
  let name = 'Posiłek';
  let confidence = 0;

  if (primaryItem) {
    name = primaryItem.name;
    confidence = clamp(primary.score, 0, 0.99);
    // A photo the user has already confirmed deserves more than the generic
    // heuristic ceiling — that is the whole point of remembering it.
    if (engine === 'learned' && learnedWeight > 0) {
      confidence = clamp(0.55 + learnedWeight * 0.18, 0, 0.9);
    }

    const portion = estimatePortion(primaryItem.id, features, seg, { learning });

    if (primaryItem.kind === 'dish') {
      // Show the recipe breakdown so every ingredient is individually
      // correctable, and scale it to the estimated plate size.
      const dishGrams = Math.round(clamp(portion.grams / (primaryItem.serving || 400), 0.5, 2.2) * primaryItem.serving);
      for (const part of expandDish(primaryItem.id, dishGrams)) {
        items.push({
          foodId: part.foodId,
          name: part.name,
          emoji: part.emoji,
          grams: part.grams,
          confidence: clamp(confidence * 0.92, 0.05, 0.95),
          source: engine,
          fromDish: primaryItem.id,
        });
      }
    } else {
      items.push({
        foodId: primaryItem.id,
        name: primaryItem.name,
        emoji: primaryItem.emoji,
        grams: portion.grams,
        confidence,
        source: engine,
      });
    }

    /* Extra plate components found by region analysis. */
    if (proposal.components.length) {
      const plateMass = estimatePlateMass(features, seg);
      const areas = proposal.components.map((c) => seg.regions[c.region]?.area ?? 0.2);
      const masses = distributeMass(areas.map((area) => ({ area })), plateMass * 0.55);
      proposal.components.forEach((c, i) => {
        const item = getItem(c.id);
        if (!item || items.some((x) => x.foodId === item.id)) return;
        items.push({
          foodId: item.id,
          name: item.name,
          emoji: item.emoji,
          grams: Math.min(masses[i] || 100, item.serving * 2),
          confidence: clamp(c.score * 0.85, 0.05, 0.9),
          source: engine,
        });
      });
      if (items.length > 1) name = `${primaryItem.name} +${items.length - 1}`;
    }
  }

  const alternatives = ranked.items
    .filter((x) => x.id !== primary?.id)
    .slice(0, 8)
    .map((x) => {
      const item = getItem(x.id);
      return item ? { id: item.id, name: item.name, emoji: item.emoji, score: x.score } : null;
    })
    .filter(Boolean);

  return {
    engine,
    name,
    suggestedId: primary?.id || null,
    confidence,
    items,
    alternatives,
    photo: { thumb: image.thumb, display: image.display },
    signature,
    features: { brightness: features.brightness, edge: features.edge, foodRatio: features.foodRatio },
    slot: slotForHour(hour),
    warning,
    timings,
  };
}

/* ---------------- warm start ---------------- */

/**
 * Kick off model loading in the background so the first photo of the day is
 * as fast as the tenth. Called from the app shell once the UI is idle.
 */
export async function warmUp(state) {
  try {
    const caps = await probe();
    if (recommendEngine(caps, state?.settings) !== 'model') return false;
    if (model.isReady() || model.state.status === 'loading') return true;
    // Only warm automatically when the weights are already on the device;
    // never spend someone's mobile data without them asking for a photo.
    if (!caps.storageCached) return false;
    await model.load({ caps });
    return model.isReady();
  } catch { return false; }
}

export { model, probe, describeCaps, visionLabels };
