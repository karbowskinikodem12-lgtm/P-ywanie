/* ==========================================================================
   Device capability probe.

   Decides which analysis path the device can actually sustain. The result is
   advisory: the orchestrator always keeps the heuristic path warm, so a wrong
   guess costs accuracy, never a broken flow.
   ========================================================================== */

let cached = null;

export async function probe(force = false) {
  if (cached && !force) return cached;

  const caps = {
    webgpu: false,
    webgpuAdapter: null,
    webnn: false,
    wasmSimd: false,
    threads: navigator.hardwareConcurrency || 2,
    memoryGB: navigator.deviceMemory || null,
    online: navigator.onLine !== false,
    saveData: !!navigator.connection?.saveData,
    effectiveType: navigator.connection?.effectiveType || null,
    storageCached: false,
    reason: null,
  };

  /* WebGPU — the fast path for on-device inference. */
  try {
    if (navigator.gpu?.requestAdapter) {
      const adapter = await withTimeout(navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }), 2500);
      if (adapter) {
        caps.webgpu = true;
        caps.webgpuAdapter = adapter.info?.description || adapter.info?.vendor || 'gpu';
      }
    }
  } catch { /* treated as unavailable */ }

  /* WebNN — Safari/Edge experimental NPU path, used when present. */
  try {
    if ('ml' in navigator && typeof navigator.ml.createContext === 'function') caps.webnn = true;
  } catch { /* ignored */ }

  caps.wasmSimd = detectWasmSimd();
  caps.storageCached = await modelProbablyCached();

  if (!caps.online && !caps.storageCached) caps.reason = 'offline';
  else if (caps.saveData) caps.reason = 'save-data';
  else if (!caps.webgpu && !caps.wasmSimd) caps.reason = 'no-runtime';

  cached = caps;
  return caps;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((r) => setTimeout(() => r(null), ms))]);
}

/** Feature-detect WebAssembly SIMD by compiling a tiny module that uses it. */
function detectWasmSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
      10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]));
  } catch { return false; }
}

/**
 * Has the model already been downloaded? transformers.js stores weights in
 * the Cache Storage bucket `transformers-cache`, so its presence means the
 * model path works even with no network.
 */
async function modelProbablyCached() {
  try {
    if (!('caches' in window)) return false;
    const keys = await caches.keys();
    const name = keys.find((k) => k.includes('transformers'));
    if (!name) return false;
    const cache = await caches.open(name);
    const entries = await cache.keys();
    return entries.length > 0;
  } catch { return false; }
}

/**
 * Recommended engine for a device.
 * @returns {'model'|'assist'} 'model' → try on-device inference first.
 */
export function recommendEngine(caps, settings) {
  const mode = settings?.vision?.mode || 'auto';
  if (mode === 'assist') return 'assist';
  if (mode === 'model') return 'model';

  if (!settings?.vision?.allowDownload && !caps.storageCached) return 'assist';
  if (!caps.online && !caps.storageCached) return 'assist';
  if (caps.saveData && !caps.storageCached) return 'assist';
  if (caps.webgpu || caps.webnn) return 'model';
  // CPU-only inference is viable but slow; only worth it once cached locally
  // or on a machine with enough cores to finish in a few seconds.
  if (caps.wasmSimd && (caps.storageCached || caps.threads >= 6)) return 'model';
  return 'assist';
}

export function describeCaps(caps) {
  if (!caps) return 'Sprawdzam możliwości urządzenia…';
  if (caps.webgpu) return `Model lokalny na GPU (WebGPU${caps.webgpuAdapter ? ` · ${caps.webgpuAdapter}` : ''})`;
  if (caps.webnn) return 'Model lokalny na akceleratorze NPU (WebNN)';
  if (caps.wasmSimd) return 'Model lokalny na procesorze (WebAssembly SIMD)';
  return 'Tryb wspomagany — rozpoznawanie bez modelu';
}

export const resetProbe = () => { cached = null; };
