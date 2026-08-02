// IndexedDB data layer. See ARCHITECTURE.md for the API contract.
import { seedData } from './seed.js';

const DB_NAME = 'poppyshuffle';
const DB_VERSION = 1;
export const STORES = ['settings', 'inventory', 'clients', 'projects', 'payments'];

let _db = null;
const listeners = new Set();

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = _db.transaction(store, mode);
    const os = t.objectStore(store);
    const out = fn(os);
    t.oncomplete = () => resolve(out?.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function emit(store) {
  for (const fn of listeners) { try { fn(store); } catch (e) { console.error(e); } }
}

async function all(store) {
  return tx(store, 'readonly', os => {
    const req = os.getAll();
    return { get result() { return req.result; } };
  });
}

async function get(store, id) {
  return tx(store, 'readonly', os => {
    const req = os.get(id);
    return { get result() { return req.result; } };
  });
}

async function put(store, obj) {
  if (!obj.id) obj.id = crypto.randomUUID();
  obj.updatedAt = new Date().toISOString();
  await tx(store, 'readwrite', os => os.put(obj));
  emit(store);
  return obj;
}

async function bulkPut(store, objs) {
  for (const o of objs) {
    if (!o.id) o.id = crypto.randomUUID();
    if (!o.updatedAt) o.updatedAt = new Date().toISOString();
  }
  await tx(store, 'readwrite', os => { for (const o of objs) os.put(o); });
  emit(store);
  return objs;
}

async function remove(store, id) {
  await tx(store, 'readwrite', os => os.delete(id));
  emit(store);
}

async function clearStore(store) {
  await tx(store, 'readwrite', os => os.clear());
}

async function exportJSON() {
  const stores = {};
  for (const s of STORES) stores[s] = await all(s);
  return { app: 'poppyshuffle', version: DB_VERSION, exportedAt: new Date().toISOString(), stores };
}

async function importJSON(data, { merge = false } = {}) {
  if (!data || data.app !== 'poppyshuffle' || !data.stores) {
    throw new Error('Not a valid PoppyShuffle export file.');
  }
  for (const s of STORES) {
    const rows = data.stores[s] || [];
    if (!merge) await clearStore(s);
    if (rows.length) {
      await tx(s, 'readwrite', os => { for (const r of rows) if (r && r.id) os.put(r); });
    }
  }
  for (const s of STORES) emit(s);
}

async function seedIfEmpty() {
  const existing = await all('settings');
  if (existing.length) return;
  const data = seedData();
  for (const s of STORES) {
    if (data[s]?.length) {
      await tx(s, 'readwrite', os => { for (const r of data[s]) os.put(r); });
    }
  }
}

async function resetToSeed() {
  for (const s of STORES) await clearStore(s);
  await seedIfEmpty();
  for (const s of STORES) emit(s);
}

export const db = {
  ready: (async () => { _db = await open(); await seedIfEmpty(); })(),
  all, get, put, bulkPut, remove, exportJSON, importJSON, resetToSeed,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
