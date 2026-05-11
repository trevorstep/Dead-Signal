/**
 * AUTH MODULE
 * ----------------------------------------------------------------
 * Currently a passthrough using sessionStorage to fake "sessions"
 * during local dev. Replace with Firebase Auth when wiring up.
 *
 * Public API:
 *   await auth.init()
 *   await auth.signInDM()         -> { uid, role: 'dm' }
 *   await auth.joinAsPlayer(code, name) -> { uid, role: 'player', campaignId, playerName }
 *   auth.getCurrentUser()         -> user object or null
 *   auth.signOut()
 *   auth.onChange(callback)       -> unsubscribe
 *
 * Roles: 'dm' | 'player'
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signInAnonymously, onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseConfig } from './adapters/firebaseAdapter.js';

const STORAGE_KEY = 'ds_user';
const listeners = new Set();
let authInstance, db;

function emit(user) {
  listeners.forEach(cb => { try { cb(user); } catch (e) { console.error(e); } });
}

export const auth = {
  async init() {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
    db = getFirestore(app);

    return new Promise((resolve) => {
      onAuthStateChanged(authInstance, (fbUser) => {
        const localUser = this.getCurrentUser();
        if (!fbUser && localUser) {
          sessionStorage.removeItem(STORAGE_KEY);
          emit(null);
        } else if (fbUser && localUser) {
          emit(localUser);
        } else {
          emit(null);
        }
        resolve();
      });
    });
  },

  async signInDM() {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(authInstance, provider);
    const uid = result.user.uid;

    const campaignsRef = collection(db, 'campaigns');
    const q = query(campaignsRef, where('ownerUid', '==', uid));
    const snapshot = await getDocs(q);

    let campaigns = [];
    snapshot.forEach(docSnap => campaigns.push(docSnap.id));

    let campaignId;
    if (campaigns.length === 0) {
      campaignId = this.generateCampaignCode();
      await setDoc(doc(db, 'campaigns', campaignId), {
        ownerUid: uid,
        createdAt: serverTimestamp()
      });
      campaigns.push(campaignId);
    } else {
      const localUser = this.getCurrentUser();
      if (localUser && localUser.campaignId && campaigns.includes(localUser.campaignId)) {
        campaignId = localUser.campaignId;
      } else {
        campaignId = campaigns[0];
      }
    }

    const user = { uid, role: 'dm', name: 'DM', campaignId, campaigns };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    emit(user);
    return user;
  },

  switchCampaign(campaignId) {
    const user = this.getCurrentUser();
    if (user && user.role === 'dm') {
      user.campaignId = campaignId;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      emit(user);
      return user;
    }
  },

  async createNewCampaign() {
    const user = this.getCurrentUser();
    if (!user || user.role !== 'dm') throw new Error('Not DM');
    const code = this.generateCampaignCode();
    await setDoc(doc(db, 'campaigns', code), {
      ownerUid: user.uid,
      createdAt: serverTimestamp()
    });
    user.campaignId = code;
    user.campaigns = [...(user.campaigns || []), code];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    emit(user);
    return code;
  },

  async joinAsPlayer(code, name) {
    if (!code || code.length < 4) throw new Error('Code too short');
    if (!name || name.length < 1) throw new Error('Name required');

    code = code.toUpperCase();
    
    // Authenticate FIRST so Firestore rules allow us to read the campaign doc
    const result = await signInAnonymously(authInstance);
    const uid = result.user.uid;

    const campaignSnap = await getDoc(doc(db, 'campaigns', code));
    if (!campaignSnap.exists()) {
      throw new Error('Campaign not found');
    }

    const playersRef = collection(db, 'campaigns', code, 'players');
    const q = query(playersRef, where('name', '==', name));
    const playerSnaps = await getDocs(q);
    
    let playerId = uid;
    if (!playerSnaps.empty) {
      playerId = playerSnaps.docs[0].id;
    } else {
      await setDoc(doc(db, 'campaigns', code, 'players', playerId), {
        id: playerId,
        name: name,
        hp: 10,
        maxHp: 10,
        inf: 0,
        hum: 10
      });
    }

    const user = {
      uid,
      role: 'player',
      campaignId: code,
      name,
      playerId
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem('ds_player_' + code, JSON.stringify(user));
    localStorage.setItem('ds_my_player_id_' + uid, playerId);

    emit(user);
    return user;
  },

  getCurrentUser() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  async signOut() {
    if (authInstance) await fbSignOut(authInstance);
    sessionStorage.removeItem(STORAGE_KEY);
    emit(null);
  },

  onChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  // Generate a 6-character campaign code (DM use)
  generateCampaignCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I O 0 1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },
};

if (typeof window !== 'undefined') window.auth = auth;
