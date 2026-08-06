/* ==========================================================================
   Image intake and feature extraction.

   Runs entirely on the device: decode → orient → downscale → three canvases
   (model input, analysis input, timeline thumbnail) → colour/texture
   descriptors and a coarse region segmentation.

   Everything here is plain canvas work so it also runs on devices with no
   WebGPU at all — the heuristic engine depends on it.
   ========================================================================== */

import { clamp } from '../core/utils.js';

export const SIZES = { model: 256, analysis: 192, thumb: 128, display: 900 };

/* ---------------- decode ---------------- */

/**
 * Decode a File/Blob honouring EXIF orientation.
 * createImageBitmap is used when available (fast, off the main thread);
 * older Safari falls back to an <img> + objectURL.
 */
export async function decodeImage(file) {
  if (!file) throw new Error('Nie wybrano zdjęcia.');
  if (file.size > 25 * 1024 * 1024) throw new Error('To zdjęcie jest za duże (limit 25 MB).');

  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall through to <img> */ }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('To nie wygląda na zdjęcie.')); };
    img.src = url;
  });
}

function makeCanvas(w, h) {
  if ('OffscreenCanvas' in window) {
    try { return new OffscreenCanvas(w, h); } catch { /* fall through */ }
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Draw a centre-cropped square of `src` at `size` × `size`. */
export function squareCanvas(src, size) {
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

/** Draw the whole frame scaled to fit `max` on the long edge. */
export function fitCanvas(src, max) {
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = makeCanvas(Math.round(w * scale), Math.round(h * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function canvasToDataURL(canvas, quality = 0.8, type = 'image/jpeg') {
  if (canvas.convertToBlob) {
    const blob = await canvas.convertToBlob({ type, quality });
    return blobToDataURL(blob);
  }
  return canvas.toDataURL(type, quality);
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Nie udało się przygotować zdjęcia.'));
    fr.readAsDataURL(blob);
  });
}

/**
 * Full intake: returns the canvases and data URLs the rest of the app needs.
 * The display image is capped at 900 px — enough for a retina sheet, small
 * enough to keep IndexedDB writes instant.
 */
export async function prepareImage(file) {
  const bitmap = await decodeImage(file);
  try {
    const model = squareCanvas(bitmap, SIZES.model);
    const analysis = squareCanvas(bitmap, SIZES.analysis);
    const thumbCanvas = squareCanvas(bitmap, SIZES.thumb);
    const displayCanvas = fitCanvas(bitmap, SIZES.display);

    const [thumb, display] = await Promise.all([
      canvasToDataURL(thumbCanvas, 0.62),
      canvasToDataURL(displayCanvas, 0.8),
    ]);

    return {
      model,
      analysis,
      thumb,
      display,
      width: bitmap.width || bitmap.naturalWidth,
      height: bitmap.height || bitmap.naturalHeight,
    };
  } finally {
    if (bitmap.close) bitmap.close();
  }
}

/* ---------------- colour space ---------------- */

/** RGB (0-255) → HSV with H in degrees, S/V in 0..1. */
export function rgbToHsv(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

/* ---------------- feature extraction ---------------- */

const HUE_BINS = 12;

/**
 * Descriptor of an image (or a masked region of it).
 *
 * hist       — 12-bin hue histogram, saturation-weighted and normalised
 * meanHsv    — average hue (circular), saturation and value
 * edge       — normalised Sobel energy: 0 flat, 1 highly textured
 * satVar     — colour variety; a plate of one ingredient scores low
 * foodRatio  — share of pixels that look like food rather than plate/table
 * brightness — used to warn about very dark photos
 */
export function describe(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const { data } = ctx.getImageData(0, 0, w, h);

  const hist = new Float32Array(HUE_BINS);
  let sinSum = 0, cosSum = 0, satSum = 0, valSum = 0, satSq = 0;
  let foodPx = 0, n = 0;
  const gray = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      gray[y * w + x] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      const [hu, s, v] = rgbToHsv(r, g, b);
      const rad = (hu * Math.PI) / 180;
      const weight = s;                       // grey pixels carry no hue information
      sinSum += Math.sin(rad) * weight;
      cosSum += Math.cos(rad) * weight;
      satSum += s;
      satSq += s * s;
      valSum += v;
      hist[Math.min(HUE_BINS - 1, Math.floor((hu / 360) * HUE_BINS))] += weight;

      // Food heuristic: plates and tablecloths are pale and desaturated,
      // shadows are dark. What is left is usually the meal.
      if (!(s < 0.14 && v > 0.72) && v > 0.12) foodPx++;
      n++;
    }
  }

  const meanS = satSum / n;
  const meanV = valSum / n;
  const meanH = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
  const satVar = Math.max(0, satSq / n - meanS * meanS);

  // Sobel edge energy on the grayscale plane.
  let edgeSum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = -gray[idx - w - 1] - 2 * gray[idx - 1] - gray[idx + w - 1]
        + gray[idx - w + 1] + 2 * gray[idx + 1] + gray[idx + w + 1];
      const gy = -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1]
        + gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];
      edgeSum += Math.hypot(gx, gy);
    }
  }
  const edge = clamp(edgeSum / ((w - 2) * (h - 2)) / 1.6, 0, 1);

  const total = hist.reduce((s, v) => s + v, 0) || 1;
  for (let i = 0; i < HUE_BINS; i++) hist[i] /= total;

  return {
    hist: Array.from(hist),
    meanHsv: [meanH, meanS, meanV],
    edge,
    satVar,
    foodRatio: foodPx / n,
    brightness: meanV,
  };
}

/**
 * Coarse segmentation: split into a grid, merge neighbouring cells with a
 * similar average colour, and return the largest regions. This is what lets
 * the analyser propose several components for a mixed plate (meat + rice +
 * vegetables) instead of one averaged blob.
 */
export function segment(canvas, { grid = 8, maxRegions = 4 } = {}) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const { data } = ctx.getImageData(0, 0, w, h);
  const cw = Math.floor(w / grid);
  const ch = Math.floor(h / grid);
  const cells = [];
  const mid = (grid - 1) / 2;

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let r = 0, g = 0, b = 0, n = 0, lum = 0, lumSq = 0;
      for (let y = gy * ch; y < (gy + 1) * ch; y++) {
        for (let x = gx * cw; x < (gx + 1) * cw; x++) {
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
          const l = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          lum += l; lumSq += l * l;
        }
      }
      const hsv = rgbToHsv(r / n, g / n, b / n);
      // Local luminance spread is a far better texture cue than the global
      // edge energy: rice and milk share a colour but not a surface.
      const sd = Math.sqrt(Math.max(0, lumSq / n - (lum / n) ** 2));
      const tex = clamp(sd / 30, 0, 1);
      // Pale + bright is only *plate* out towards the rim. Rice, potatoes and
      // curd sit in the middle of the frame and look exactly the same — the
      // earlier version discarded them as tableware.
      const edgeness = Math.max(Math.abs(gx - mid), Math.abs(gy - mid)) / mid;
      const pale = hsv[1] < 0.14 && hsv[2] > 0.72;
      cells.push({
        gx, gy, hsv, tex, id: -1,
        plate: pale && tex < 0.22 && edgeness > 0.45,
        dark: hsv[2] < 0.14,
        edgeness,
      });
    }
  }

  // Flood-fill merge over the 4-neighbourhood with an HSV distance threshold.
  const at = (gx, gy) => (gx < 0 || gy < 0 || gx >= grid || gy >= grid ? null : cells[gy * grid + gx]);
  const close = (a, b) => {
    let dh = Math.abs(a.hsv[0] - b.hsv[0]);
    if (dh > 180) dh = 360 - dh;
    return (dh / 180) * 0.9 + Math.abs(a.hsv[1] - b.hsv[1]) * 1.1 + Math.abs(a.hsv[2] - b.hsv[2]) * 0.9 < 0.30;
  };

  let next = 0;
  for (const cell of cells) {
    if (cell.id >= 0 || cell.plate || cell.dark) continue;
    const id = next++;
    const queue = [cell];
    cell.id = id;
    while (queue.length) {
      const c = queue.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nb = at(c.gx + dx, c.gy + dy);
        if (nb && nb.id < 0 && !nb.plate && !nb.dark && close(c, nb)) {
          nb.id = id;
          queue.push(nb);
        }
      }
    }
  }

  const groups = new Map();
  for (const cell of cells) {
    if (cell.id < 0) continue;
    const gsum = groups.get(cell.id) || { id: cell.id, cells: [], h: 0, s: 0, v: 0 };
    gsum.cells.push(cell);
    groups.set(cell.id, gsum);
  }

  const regions = [...groups.values()].map((gr) => {
    // Circular mean of hue across the region.
    let sin = 0, cos = 0, s = 0, v = 0, tex = 0;
    for (const c of gr.cells) {
      const rad = (c.hsv[0] * Math.PI) / 180;
      sin += Math.sin(rad) * c.hsv[1];
      cos += Math.cos(rad) * c.hsv[1];
      s += c.hsv[1];
      v += c.hsv[2];
      tex += c.tex;
    }
    const n = gr.cells.length;
    const bounds = gr.cells.reduce((acc, c) => ({
      x0: Math.min(acc.x0, c.gx), y0: Math.min(acc.y0, c.gy),
      x1: Math.max(acc.x1, c.gx), y1: Math.max(acc.y1, c.gy),
    }), { x0: grid, y0: grid, x1: 0, y1: 0 });

    return {
      area: n / (grid * grid),
      color: [((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360, s / n, v / n],
      tex: tex / n,
      bounds: {
        x: bounds.x0 / grid, y: bounds.y0 / grid,
        w: (bounds.x1 - bounds.x0 + 1) / grid, h: (bounds.y1 - bounds.y0 + 1) / grid,
      },
      cells: n,
    };
  });

  regions.sort((a, b) => b.area - a.area);
  const plateRatio = cells.filter((c) => c.plate).length / cells.length;

  return {
    regions: regions.filter((r) => r.area >= 0.045).slice(0, maxRegions),
    plateRatio,
    foodRatio: cells.filter((c) => !c.plate && !c.dark).length / cells.length,
  };
}

/**
 * Compact numeric signature used by the learning layer for nearest-neighbour
 * lookups. Stable length (16) so old entries stay comparable.
 */
export function signatureOf(features) {
  const [h, s, v] = features.meanHsv;
  return [
    ...features.hist,                       // 12
    s, v,
    features.edge,
    clamp(features.foodRatio, 0, 1),
  ].map((x) => Math.round(x * 1000) / 1000);
}

/** Cosine-style distance between two signatures (lower = more alike). */
export function signatureDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 1;
  return 1 - dot / Math.sqrt(na * nb);
}

/** Quality gate — tells the user why a photo will not analyse well. */
export function qualityWarning(features) {
  if (features.brightness < 0.18) return 'Zdjęcie jest bardzo ciemne — wynik będzie zgrubny.';
  if (features.brightness > 0.94 && features.meanHsv[1] < 0.1) return 'Zdjęcie jest prześwietlone — spróbuj bez lampy.';
  if (features.foodRatio < 0.12) return 'Nie widzę tu wyraźnie jedzenia. Ustaw kadr z góry, na całą porcję.';
  if (features.edge < 0.02) return 'Zdjęcie wygląda na rozmyte — przytrzymaj telefon chwilę dłużej.';
  return null;
}
