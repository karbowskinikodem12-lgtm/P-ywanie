/* ==========================================================================
   Persistence layer.

   Two object stores in IndexedDB:
     kv      — application state (single "state" record) and small settings
     photos  — full-size meal photos, kept out of the state blob so the
               state stays a few hundred KB and serialises fast

   IndexedDB is unavailable in some private-browsing configurations, so every
   call silently degrades to localStorage, and finally to an in-memory map.
   `db.tier` reports which one is live so the UI can be honest about it.
   ========================================================================== */

import { safeParse } from './utils.js';

const DB_NAME = 'tor-db';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_PHOTOS = 'photos';
const LS_PREFIX = 'tor:';

const memory = new Map();

/** 'idb' | 'local' | 'memory' */
export let tier = 'memory';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no-idb'));
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (e) { return reject(e); }

    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE_KV)) idb.createObjectStore(STORE_KV);
      if (!idb.objectStoreNames.contains(STORE_PHOTOS)) idb.createObjectStore(STORE_PHOTOS);
    };
    req.onsuccess = () => {
      const idb = req.result;
      idb.onversionchange = () => idb.close();
      resolve(idb);
    };
    req.onerror = () => reject(req.error || new Error('idb-open-failed'));
    // Safari occasionally never fires either handler when storage is blocked.
    setTimeout(() => reject(new Error('idb-timeout')), 3000);
  }).catch((e) => { dbPromise = null; throw e; });
  return dbPromise;
}

function idbRun(storeName, mode, fn) {
  return openDB().then((idb) => new Promise((resolve, reject) => {
    const tx = idb.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('tx-failed'));
    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      tx.oncomplete = () => resolve();
    }
  }));
}

/* ---------------- generic key/value ---------------- */

export async function get(key) {
  try {
    const v = await idbRun(STORE_KV, 'readonly', (s) => s.get(key));
    tier = 'idb';
    if (v !== undefined) return v;
  } catch { /* fall through */ }

  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (tier !== 'idb') tier = 'local';
    if (raw != null) return safeParse(raw, raw);
  } catch { /* fall through */ }

  return memory.has(key) ? memory.get(key) : undefined;
}

export async function set(key, value) {
  memory.set(key, value);
  try {
    await idbRun(STORE_KV, 'readwrite', (s) => s.put(value, key));
    tier = 'idb';
    return 'idb';
  } catch { /* fall through */ }

  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    tier = 'local';
    return 'local';
  } catch { /* quota or disabled */ }

  tier = 'memory';
  return 'memory';
}

export async function del(key) {
  memory.delete(key);
  try { await idbRun(STORE_KV, 'readwrite', (s) => s.delete(key)); } catch { /* ignored */ }
  try { localStorage.removeItem(LS_PREFIX + key); } catch { /* ignored */ }
}

/* ---------------- photos ---------------- */

export async function putPhoto(id, dataUrl) {
  if (!id || !dataUrl) return false;
  try {
    await idbRun(STORE_PHOTOS, 'readwrite', (s) => s.put(dataUrl, id));
    return true;
  } catch {
    // Without IndexedDB we simply do not keep full-size photos; the thumbnail
    // stored inside the meal record is enough for the timeline.
    return false;
  }
}

export async function getPhoto(id) {
  if (!id) return null;
  try { return (await idbRun(STORE_PHOTOS, 'readonly', (s) => s.get(id))) || null; }
  catch { return null; }
}

export async function delPhoto(id) {
  if (!id) return;
  try { await idbRun(STORE_PHOTOS, 'readwrite', (s) => s.delete(id)); } catch { /* ignored */ }
}

export async function listPhotoIds() {
  try { return (await idbRun(STORE_PHOTOS, 'readonly', (s) => s.getAllKeys())) || []; }
  catch { return []; }
}

/** Drop photos no longer referenced by any meal. Runs on a slow cadence. */
export async function prunePhotos(keepIds) {
  const keep = new Set(keepIds);
  const all = await listPhotoIds();
  let removed = 0;
  for (const id of all) {
    if (!keep.has(id)) { await delPhoto(id); removed++; }
  }
  return removed;
}

/* ---------------- storage budget ---------------- */

export async function estimate() {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch { /* ignored */ }
  return { usage: 0, quota: 0 };
}

/** Ask the browser to keep our data when disk gets tight. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* ignored */ }
  return false;
}

export const tierLabel = () => ({
  idb: 'pamięć aplikacji (IndexedDB)',
  local: 'pamięć przeglądarki',
  memory: 'tylko ta sesja',
}[tier] || 'nieznana');
