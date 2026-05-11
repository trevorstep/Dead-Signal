/**
 * ============================================================
 * DATA LAYER — adapter pattern
 * ============================================================
 *
 * The UI talks ONLY to dataLayer methods. The underlying
 * implementation can be swapped (localStorage now, Firebase later)
 * without touching any UI code.
 *
 * Trevor — when you're ready to wire up Firebase, see firebaseAdapter.js
 * which has TODO stubs and a Claude handoff prompt at the bottom.
 *
 * Public API:
 *   await dataLayer.init()
 *   dataLayer.subscribe(collection, callback) -> unsubscribe fn
 *   await dataLayer.list(collection)
 *   await dataLayer.get(collection, id)
 *   await dataLayer.set(collection, id, data)
 *   await dataLayer.update(collection, id, patch)
 *   await dataLayer.remove(collection, id)
 *   await dataLayer.uploadImage(file) -> dataURL or storage URL
 *
 * Collections used by the app:
 *   players, enemies, quests, rolls, maps, summaries, notes, scenes
 * ============================================================
 */

// import { localStorageAdapter } from './adapters/localStorageAdapter.js';
import { firebaseAdapter } from './adapters/firebaseAdapter.js';

// ── PICK YOUR ADAPTER HERE ──
// Trevor: change this single line when you wire up Firebase.
// const adapter = localStorageAdapter;
const adapter = firebaseAdapter;

// ── QUOTA GUARD ──
// Daily circuit breaker — stops all writes/uploads if exceeded.
// Adjust thresholds to match your Firebase free-tier comfort.
const QUOTA = {
  reads_per_day:    50000,    // Firebase free tier: 50k reads/day
  writes_per_day:   20000,    // Firebase free tier: 20k writes/day
  uploads_per_day:  20,       // arbitrary cap on map uploads
  bytes_per_day:    50 * 1024 * 1024, // 50MB/day
};

const QUOTA_KEY = 'ds_quota';

function getQuotaState() {
  const raw = localStorage.getItem(QUOTA_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return { date: today, reads: 0, writes: 0, uploads: 0, bytes: 0 };
  const state = JSON.parse(raw);
  if (state.date !== today) return { date: today, reads: 0, writes: 0, uploads: 0, bytes: 0 };
  return state;
}

function bumpQuota(field, amount = 1) {
  const state = getQuotaState();
  state[field] = (state[field] || 0) + amount;
  localStorage.setItem(QUOTA_KEY, JSON.stringify(state));
  checkQuotaWarning(state);
  return state;
}

function checkQuotaWarning(state) {
  const warningEl = document.getElementById('quotaWarning');
  if (!warningEl) return;
  const overReads   = state.reads   > QUOTA.reads_per_day  * 0.85;
  const overWrites  = state.writes  > QUOTA.writes_per_day * 0.85;
  const overUploads = state.uploads > QUOTA.uploads_per_day * 0.85;
  if (overReads || overWrites || overUploads) {
    warningEl.classList.add('show');
    warningEl.textContent = '⚠ Approaching daily limit — service will pause to prevent fees';
  } else {
    warningEl.classList.remove('show');
  }
}

function isQuotaExceeded(field) {
  const state = getQuotaState();
  if (state[field] >= QUOTA[`${field}_per_day`]) return true;
  return false;
}

export const dataLayer = {
  async init() {
    if (adapter.init) await adapter.init();
  },

  subscribe(collection, callback) {
    return adapter.subscribe(collection, callback);
  },

  async list(collection) {
    bumpQuota('reads');
    return adapter.list(collection);
  },

  async get(collection, id) {
    bumpQuota('reads');
    return adapter.get(collection, id);
  },

  async set(collection, id, data) {
    if (isQuotaExceeded('writes')) {
      throw new Error('Daily write quota exceeded. Service paused.');
    }
    bumpQuota('writes');
    return adapter.set(collection, id, data);
  },

  async update(collection, id, patch) {
    if (isQuotaExceeded('writes')) {
      throw new Error('Daily write quota exceeded. Service paused.');
    }
    bumpQuota('writes');
    return adapter.update(collection, id, patch);
  },

  async remove(collection, id) {
    bumpQuota('writes');
    return adapter.remove(collection, id);
  },

  async uploadImage(file) {
    if (isQuotaExceeded('uploads')) {
      throw new Error('Daily upload quota exceeded.');
    }
    bumpQuota('uploads');
    bumpQuota('bytes', file.size);
    return adapter.uploadImage(file);
  },

  // Helper for generating unique ids
  uid() {
    return Math.random().toString(36).slice(2, 11);
  },

  // Direct quota access for UI display
  getQuota() {
    return { state: getQuotaState(), limits: QUOTA };
  },
};

// Make available globally for non-module debugging in console
if (typeof window !== 'undefined') {
  window.dataLayer = dataLayer;
}
