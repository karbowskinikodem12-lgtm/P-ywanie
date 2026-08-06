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

const MODELS = [
  { id: 'Xenova/clip-vit-base-patch32', dtype: 'q8', label: 'CLIP ViT-B/32' },
  { id: 'Xenova/clip-vit-base-patch16', dtype: 'q8', label: 'CLIP ViT-B/16' },
];

/** Prompt templates — averaging a few phrasings is worth ~3-5 points of top-1. */
const TEMPLATES = [
  'a photo of {}',
  'a close-up photo of {} on a plate',
  'a meal of {}',
];

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

      for (const model of MODELS) {
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
 * Classify a canvas against candidate labels.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas square, already downscaled
 * @param {{id:string,en:string}[]} candidates
 * @returns {Promise<{id:string,score:number}[]>} sorted, best first
 */
export async function classify(canvas, candidates, { topK = 6 } = {}) {
  if (state.status !== 'ready' || !pipe) throw new Error('Model nie jest gotowy.');
  if (!candidates?.length) return [];

  const started = performance.now();
  const byPrompt = new Map();
  const prompts = [];
  for (const c of candidates) {
    const prompt = TEMPLATES[0].replace('{}', c.en);
    prompts.push(prompt);
    byPrompt.set(prompt, c.id);
  }

  const image = await toModelInput(canvas);
  const raw = await timeout(pipe(image, prompts), RUN_TIMEOUT, 'Analiza trwała zbyt długo.');
  state.lastMs = Math.round(performance.now() - started);

  const scores = (Array.isArray(raw) ? raw : [raw])
    .map((r) => ({ id: byPrompt.get(r.label), score: r.score }))
    .filter((r) => r.id);

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
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
