/**
 * localStorage adapter
 * ----------------------------------------------------------------
 * Stores all collections under keys like `ds:players`, `ds:enemies`.
 * Uses a simple pub/sub for "subscribe" so the UI updates when
 * the data changes locally (mimics what Firestore listeners do).
 *
 * Each collection is stored as an array of documents.
 * Each document has an `id` field.
 */

const PREFIX = 'ds:';
const subscribers = new Map(); // collection -> Set<callback>

function key(collection) { return PREFIX + collection; }

function readCollection(collection) {
  const raw = localStorage.getItem(key(collection));
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { return []; }
}

function writeCollection(collection, docs) {
  localStorage.setItem(key(collection), JSON.stringify(docs));
  notify(collection, docs);
}

function notify(collection, docs) {
  const subs = subscribers.get(collection);
  if (!subs) return;
  subs.forEach(cb => {
    try { cb(docs); } catch (e) { console.error(e); }
  });
}

// Listen for changes from other tabs (storage event)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const collection = e.key.slice(PREFIX.length);
    const docs = readCollection(collection);
    notify(collection, docs);
  });
}

export const localStorageAdapter = {
  async init() {
    // Nothing to set up
    return true;
  },

  subscribe(collection, callback) {
    if (!subscribers.has(collection)) subscribers.set(collection, new Set());
    subscribers.get(collection).add(callback);
    // Immediately deliver current state
    callback(readCollection(collection));
    return () => subscribers.get(collection)?.delete(callback);
  },

  async list(collection) {
    return readCollection(collection);
  },

  async get(collection, id) {
    return readCollection(collection).find(d => d.id === id) || null;
  },

  async set(collection, id, data) {
    const docs = readCollection(collection);
    const idx = docs.findIndex(d => d.id === id);
    const doc = { ...data, id };
    if (idx >= 0) docs[idx] = doc;
    else docs.push(doc);
    writeCollection(collection, docs);
    return doc;
  },

  async update(collection, id, patch) {
    const docs = readCollection(collection);
    const idx = docs.findIndex(d => d.id === id);
    if (idx < 0) return null;
    docs[idx] = { ...docs[idx], ...patch, id };
    writeCollection(collection, docs);
    return docs[idx];
  },

  async remove(collection, id) {
    const docs = readCollection(collection);
    const filtered = docs.filter(d => d.id !== id);
    writeCollection(collection, filtered);
    return true;
  },

  async uploadImage(file) {
    // localStorage version: just return a base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};
