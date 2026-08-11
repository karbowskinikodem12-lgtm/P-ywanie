/* ==========================================================================
   On-device vision model (zero-shot image classification).

   Runs CLIP through transformers.js entirely in the browser — WebGPU when the
   device exposes it, WebAssembly otherwise. Weights are fetched once and kept
   in the browser's Cache Storage, so every later analysis works offline.

   Zero-shot is deliberate: the candidate labels come from our own food
   database, so the model can only ever answer with something the app knows
   how to turn into nutrition. Adding a food to the database automatically
   teaches the recogniser about it — no retraining, no server.
   ========================================================================== */

const RUNTIME_URLS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5',
  'https://unpkg.com/@huggingface/transformers@3.7.5',
];

/**
 * Ordered best-first *for the device*, see `modelsFor`.
 *
 * B/16 cuts the image into 16-pixel patches where B/32 uses 32, so it sees
 * roughly four times as much spatial detail and is markedly more accurate —
 * about five points of zero-shot ImageNet top-1 between them — at around four
 * times the compute. On a GPU that is affordable and worth taking; on the
 * WebAssembly path it is the difference between a wait and a hang, so there
 * the smaller model leads and B/16 is only ever a fallback.
 */
const MODELS = [
  { id: 'Xenova/clip-vit-base-patch16', dtype: 'q8', label: 'CLIP ViT-B/16', heavy: true },
  { id: 'Xenova/clip-vit-base-patch32', dtype: 'q8', label: 'CLIP ViT-B/32', heavy: false },
];

const modelsFor = (device) => (device === 'webgpu'
  ? MODELS
  : [...MODELS].sort((a, b) => Number(a.heavy) - Number(b.heavy)));

/**
 * Prompt used for every candidate label — the exact food-domain template from
 * OpenAI's CLIP prompt-engineering notes for the Food-101 benchmark, which
 * measurably outperforms a bare "a photo of {}" for this kind of label set.
 * Averaging several templates buys a little more, but now that every call
 * scores the full database (~200 candidates, see index.js) rather than a
 * shortlist, doubling the text-encoder passes for a marginal gain isn't worth
 * it on a phone.
 */
const PROMPT = 'a photo of {}, a type of food';

/**
 * Subjects that are not food, scored alongside the menu.
 *
 * This is the difference between a classifier that can be wrong and one that
 * cannot say no. Zero-shot classification is a softmax over exactly the labels
 * it is handed: give it two hundred foods and nothing else, and every image on
 * earth is a food — the probabilities are forced to add up to one across the
 * menu. A photo of someone's knees came back "pork cutlet with potatoes, 78%"
 * for precisely that reason, and no threshold on that number could ever have
 * caught it, because the number was never measuring "is this food".
 *
 * With these in the running the question becomes answerable, so the list has
 * to cover what a phone camera actually catches by accident: people, clothes,
 * rooms, pets, screens, the floor. `an empty plate` and `dirty dishes` earn
 * their place separately — those are the near misses of this app in
 * particular, a camera pointed at the table a moment too early or too late.
 */
const NOT_FOOD = [
  'a person', 'a close-up of a human face', 'hands', 'bare legs', 'feet',
  'clothing', 'a pair of blue jeans', 'a shirt', 'shoes',
  'a room interior', 'furniture', 'a sofa', 'a bed', 'a wooden floor', 'a wall',
  'a cat', 'a dog',
  'a car', 'a street', 'a building', 'a landscape', 'the sky', 'a houseplant',
  'a computer screen', 'a phone screen', 'a page of text', 'a receipt',
  'an empty plate', 'an empty table', 'dirty dishes in a sink',
  'a dark blurry photo of nothing',
];

/** Negatives are not food, so they must not carry the food template. */
const NOT_FOOD_PROMPT = 'a photo of {}';

const LOAD_TIMEOUT = 45000;
const RUN_TIMEOUT = 20000;

export const state = {
  status: 'idle',      // idle | loading | ready | failed | unsupported
  device: null,        // webgpu | wasm
  modelLabel: null,
  error: null,
  loadedAt: null,
  lastMs: null,
};

let pipe = null;
let loadPromise = null;
let transformers = null;

const listeners = new Set();
export const onStateChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function emit() { for (const fn of listeners) { try { fn({ ...state }); } catch { /* ignored */ } } }

function setStatus(patch) {
  Object.assign(state, patch);
  emit();
}

function timeout(promise, ms, message) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(message)), ms); }),
  ]);
}

/* ---------------- loading ---------------- */

async function importRuntime() {
  if (transformers) return transformers;
  let lastError = null;
  for (const url of RUNTIME_URLS) {
    try {
      transformers = await import(/* @vite-ignore */ url);
      return transformers;
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error('Nie udało się pobrać środowiska modelu.');
}

/**
 * Load the model. Safe to call repeatedly — concurrent callers share one load.
 * @param {(p:{stage:string, progress:number, text:string})=>void} onProgress
 */
export function load({ caps, onProgress } = {}) {
  if (state.status === 'ready') return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    setStatus({ status: 'loading', error: null });
    const report = (stage, progress, text) => onProgress?.({ stage, progress, text });

    try {
      report('runtime', 0.05, 'Przygotowuję model…');
      const lib = await timeout(importRuntime(), LOAD_TIMEOUT, 'Pobieranie modelu trwało zbyt długo.');

      // Hosted weights only — we never look for a local /models directory,
      // which would produce a wall of 404s on a static host.
      lib.env.allowLocalModels = false;
      lib.env.useBrowserCache = true;
      if (lib.env.backends?.onnx?.wasm) {
        lib.env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
      }

      const device = caps?.webgpu ? 'webgpu' : 'wasm';
      let lastError = null;

      for (const model of modelsFor(device)) {
        try {
          report('weights', 0.15, 'Pobieram wagi modelu…');
          const created = await timeout(
            lib.pipeline('zero-shot-image-classification', model.id, {
              device,
              dtype: model.dtype,
              progress_callback: (p) => {
                if (p?.status === 'progress' && p.total) {
                  const frac = p.loaded / p.total;
                  report('weights', 0.15 + frac * 0.75, `Pobieram model… ${Math.round(frac * 100)}%`);
                } else if (p?.status === 'ready') {
                  report('weights', 0.95, 'Uruchamiam model…');
                }
              },
            }),
            LOAD_TIMEOUT,
            'Model nie zdążył się załadować.',
          );
          pipe = created;
          setStatus({
            status: 'ready', device, modelLabel: model.label, loadedAt: Date.now(), error: null,
          });
          report('ready', 1, 'Model gotowy');
          return true;
        } catch (e) {
          lastError = e;
          // A WebGPU failure is usually a driver/limits problem — retry on CPU
          // once before giving up on the model path entirely.
          if (device === 'webgpu') {
            try {
              report('weights', 0.2, 'Przełączam na tryb procesora…');
              pipe = await timeout(
                lib.pipeline('zero-shot-image-classification', model.id, { device: 'wasm', dtype: model.dtype }),
                LOAD_TIMEOUT,
                'Model nie zdążył się załadować.',
              );
              setStatus({ status: 'ready', device: 'wasm', modelLabel: model.label, loadedAt: Date.now() });
              return true;
            } catch (e2) { lastError = e2; }
          }
        }
      }
      throw lastError || new Error('Żaden model nie wystartował.');
    } catch (e) {
      setStatus({ status: 'failed', error: e?.message || String(e) });
      pipe = null;
      return false;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/* ---------------- inference ---------------- */

/**
 * How far ahead a non-food label has to be before the photo is rejected.
 *
 * Deliberately above 1: the two mistakes are not equally cheap. Refusing a
 * real dinner sends someone back to the camera for a photo that was fine,
 * while accepting a doubtful one costs a tap on an alternative. So a negative
 * has to beat the best food outright, not merely tie with it.
 */
const REJECT_MARGIN = 1.15;

/**
 * Decide whether an image is food at all, from the scores of both label sets.
 *
 * Split out from `classify` and exported so it can be exercised against known
 * distributions without a model: the weights are a 50 MB download and a WebGPU
 * context, which no test wants as a dependency.
 *
 * @param {{id:string,score:number}[]} foods
 * @param {{label:string,score:number}[]} rejects
 */
export function foodVerdict(foods, rejects) {
  const foodMass = foods.reduce((s, f) => s + f.score, 0);
  const rejectMass = rejects.reduce((s, r) => s + r.score, 0);
  const total = foodMass + rejectMass;

  const bestFood = foods[0] || null;
  const bestReject = rejects[0] || null;

  // Compared at the top of each list, never as sums: there are two hundred
  // foods against thirty negatives, so totals would hand food a seven-to-one
  // head start that has nothing to do with the picture.
  const isFood = !bestReject || !bestFood
    ? !!bestFood
    : bestFood.score * REJECT_MARGIN >= bestReject.score;

  // How sure we are it is food at all, as opposed to which food it is.
  //
  // Read off the two tops for the same reason the verdict is: `foodMass` is
  // inflated by there simply being two hundred food labels to thirty
  // negatives, so it sits around 0.85 whatever the picture shows and would
  // damp nothing. The gap between the leaders does not care how many labels
  // stood behind each of them.
  const top = (bestFood?.score ?? 0) + (bestReject?.score ?? 0);
  const certainty = top > 0 ? (bestFood?.score ?? 0) / top : 0;

  return {
    isFood,
    certainty,
    // Kept for the diagnostics panel; not a confidence signal — see above.
    foodShare: total > 0 ? foodMass / total : 0,
    foodMass,
    bestFoodScore: bestFood?.score ?? 0,
    rejectedAs: isFood ? null : bestReject?.label ?? null,
    rejectScore: bestReject?.score ?? 0,
  };
}

/**
 * Classify a canvas against the food menu *and* a set of non-food subjects.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas square, already downscaled
 * @param {{id:string,en:string}[]} candidates
 * @returns {Promise<{items:{id:string,score:number}[], verdict:object}>}
 *   `items` are renormalised across the food labels only, so a score answers
 *   "which food" and the verdict answers "is this food"; multiplying the two
 *   is what the UI shows as confidence.
 */
export async function classify(canvas, candidates, { topK = 6 } = {}) {
  if (state.status !== 'ready' || !pipe) throw new Error('Model nie jest gotowy.');
  if (!candidates?.length) return { items: [], verdict: foodVerdict([], []) };

  const started = performance.now();
  const byPrompt = new Map();
  const prompts = [];

  for (const c of candidates) {
    const prompt = PROMPT.replace('{}', c.en);
    prompts.push(prompt);
    byPrompt.set(prompt, { kind: 'food', id: c.id });
  }
  for (const n of NOT_FOOD) {
    const prompt = NOT_FOOD_PROMPT.replace('{}', n);
    prompts.push(prompt);
    byPrompt.set(prompt, { kind: 'reject', label: n });
  }

  const image = await toModelInput(canvas);
  const raw = await timeout(pipe(image, prompts), RUN_TIMEOUT, 'Analiza trwała zbyt długo.');
  state.lastMs = Math.round(performance.now() - started);

  const foods = [];
  const rejects = [];
  for (const r of (Array.isArray(raw) ? raw : [raw])) {
    const meta = byPrompt.get(r.label);
    if (!meta) continue;
    if (meta.kind === 'food') foods.push({ id: meta.id, score: r.score });
    else rejects.push({ label: meta.label, score: r.score });
  }
  foods.sort((a, b) => b.score - a.score);
  rejects.sort((a, b) => b.score - a.score);

  const verdict = foodVerdict(foods, rejects);

  // Renormalised across foods: with negatives in the pool the raw scores no
  // longer sum to one over the menu, and downstream fusion assumes they do.
  const items = verdict.foodMass > 0
    ? foods.slice(0, topK).map((f) => ({ id: f.id, score: f.score / verdict.foodMass }))
    : [];

  return { items, verdict };
}

/**
 * transformers.js accepts a RawImage; building one from the canvas avoids a
 * second decode of a data URL.
 */
async function toModelInput(canvas) {
  const lib = transformers;
  if (lib?.RawImage?.fromCanvas) {
    try { return await lib.RawImage.fromCanvas(canvas); } catch { /* fall through */ }
  }
  if (canvas.convertToBlob) {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    if (lib?.RawImage?.fromBlob) return lib.RawImage.fromBlob(blob);
    return URL.createObjectURL(blob);
  }
  return canvas.toDataURL('image/png');
}

/** Drop the model from memory (settings → "zwolnij pamięć"). */
export async function unload() {
  try { await pipe?.dispose?.(); } catch { /* ignored */ }
  pipe = null;
  setStatus({ status: 'idle', device: null, modelLabel: null, error: null, loadedAt: null });
}

/** Remove cached weights so the next load re-downloads them. */
export async function clearCache() {
  await unload();
  try {
    if (!('caches' in window)) return false;
    const keys = await caches.keys();
    for (const k of keys) if (k.includes('transformers')) await caches.delete(k);
    return true;
  } catch { return false; }
}

export const isReady = () => state.status === 'ready';
