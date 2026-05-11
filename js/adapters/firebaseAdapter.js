/**
 * ================================================================
 * FIREBASE ADAPTER — STUB
 * ================================================================
 *
 * Trevor — this file is intentionally not connected.
 * The localStorage adapter is the active one in data.js.
 *
 * To activate this:
 *   1. Set up your Firebase project (see HANDOFF_PROMPT.md)
 *   2. Fill in the firebaseConfig object below
 *   3. Implement each method (the shapes match Firestore SDK closely)
 *   4. In data.js, swap the import + adapter assignment
 *
 * The collection structure should mirror the localStorage version:
 *   /campaigns/{campaignId}/players/{playerId}
 *   /campaigns/{campaignId}/enemies/{enemyId}
 *   /campaigns/{campaignId}/quests/{questId}
 *   /campaigns/{campaignId}/maps/{mapId}
 *   /campaigns/{campaignId}/summaries/{summaryId}
 *   /campaigns/{campaignId}/notes/{noteId}
 *   /campaigns/{campaignId}/scenes/{sceneId}    (current scene description for players)
 *
 * Image uploads go to Firebase Storage at:
 *   /campaigns/{campaignId}/uploads/{filename}
 *
 * ================================================================
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const firebaseConfig = {
  // TODO: paste your Firebase config here
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

let db, storage, currentCampaignId = null;

async function enforceQuota(type) {
  if (!currentCampaignId) return;
  const today = new Date().toISOString().slice(0, 10);
  const quotaRef = doc(db, 'campaigns', currentCampaignId, '_meta', 'quota');
  
  const snap = await getDoc(quotaRef);
  const data = snap.exists() ? snap.data() : {};
  
  const writes = data[`${today}_writes`] || 0;
  const uploads = data[`${today}_uploads`] || 0;
  
  if (writes >= 20000 || uploads >= 20) {
    throw new Error('Firestore daily quota exceeded for this campaign.');
  }

  if (type === 'write') {
    await setDoc(quotaRef, { [`${today}_writes`]: increment(1) }, { merge: true });
  } else if (type === 'upload') {
    await setDoc(quotaRef, { [`${today}_uploads`]: increment(1) }, { merge: true });
  }
}

export const firebaseAdapter = {
  async init() {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    storage = getStorage(app);
    
    const user = JSON.parse(sessionStorage.getItem('ds_user') || 'null');
    if (user && user.campaignId) {
      currentCampaignId = user.campaignId;
    }
  },

  subscribe(collectionName, callback) {
    const colRef = collection(db, 'campaigns', currentCampaignId, collectionName);
    const user = JSON.parse(sessionStorage.getItem('ds_user') || 'null');
    
    if (user && user.role === 'player' && (collectionName === 'quests' || collectionName === 'maps')) {
      getDocs(colRef).then(snapshot => {
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        callback(docs);
      });
      return () => {};
    } else {
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        callback(docs);
      });
      return unsubscribe;
    }
  },

  async list(collectionName) {
    await enforceQuota('read');
    const colRef = collection(db, 'campaigns', currentCampaignId, collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
  },

  async get(collectionName, id) {
    await enforceQuota('read');
    const docRef = doc(db, 'campaigns', currentCampaignId, collectionName, id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
  },

  async set(collectionName, id, data) {
    await enforceQuota('write');
    const docRef = doc(db, 'campaigns', currentCampaignId, collectionName, id);
    await setDoc(docRef, data);
  },

  async update(collectionName, id, patch) {
    await enforceQuota('write');
    const docRef = doc(db, 'campaigns', currentCampaignId, collectionName, id);
    await updateDoc(docRef, patch);
  },

  async remove(collectionName, id) {
    await enforceQuota('write');
    const docRef = doc(db, 'campaigns', currentCampaignId, collectionName, id);
    await deleteDoc(docRef);
  },

  async uploadImage(file) {
    await enforceQuota('upload');
    const path = `campaigns/${currentCampaignId}/uploads/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  },
};
