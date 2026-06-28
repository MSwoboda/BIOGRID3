// src/lib/adminFirestore.ts
// Admin-only Firestore helpers.
// All functions here read from the `userIndex` top-level collection.
// Firestore rules only allow these reads if the requester has an admins/{uid} document.

import {
  collection, getDocs, getDocsFromServer, doc, query, orderBy, getFirestore, updateDoc, writeBatch
} from 'firebase/firestore';
import { app } from './firebase';

const db = getFirestore(app, 'biogrid');

export interface AdminUserRecord {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  createdAt: number;
  updatedAt?: number;
  paused?: boolean;
  photoURL?: string;
  avatarSeed?: string;
}

/** List all registered users from the denormalised userIndex collection. */
export async function listAllUsers(): Promise<AdminUserRecord[]> {
  // Always fetch from server to get the latest data
  const snap = await getDocsFromServer(
    query(collection(db, 'userIndex'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => d.data() as AdminUserRecord);
}

/** Toggle user suspension. Updates both the profile doc and the userIndex doc. */
export async function setUserSuspension(uid: string, paused: boolean): Promise<void> {
  const indexRef = doc(db, 'userIndex', uid);
  const profileRef = doc(db, 'users', uid, 'profile', 'data');
  await Promise.all([
    updateDoc(indexRef, { paused }),
    updateDoc(profileRef, { paused }),
  ]);
}

/** Fetch a user's login history — always from server for freshness. */
export async function getUserLoginHistory(uid: string): Promise<any[]> {
  try {
    const snap = await getDocsFromServer(
      query(collection(db, 'users', uid, 'loginHistory'), orderBy('timestamp', 'desc'))
    );
    return snap.docs.map(d => d.data());
  } catch (err) {
    console.error(`[Admin] Failed to load login history for ${uid}:`, err);
    // Fallback: try without orderBy (in case the field doesn't exist on some docs)
    const snap = await getDocsFromServer(collection(db, 'users', uid, 'loginHistory'));
    return snap.docs
      .map(d => d.data())
      .sort((a: any, b: any) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }
}

/** Fetch a user's search history — always from server for freshness. */
export async function getUserSearchHistory(uid: string): Promise<any[]> {
  try {
    const snap = await getDocsFromServer(
      query(collection(db, 'users', uid, 'searchHistory'), orderBy('timestamp', 'desc'))
    );
    return snap.docs.map(d => d.data());
  } catch (err) {
    console.error(`[Admin] Failed to load search history for ${uid}:`, err);
    // Fallback: try without orderBy
    const snap = await getDocsFromServer(collection(db, 'users', uid, 'searchHistory'));
    return snap.docs
      .map(d => d.data())
      .sort((a: any, b: any) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }
}

/** Fetch a user's saved reports — always from server for freshness. */
export async function getUserSavedReports(uid: string): Promise<any[]> {
  try {
    const snap = await getDocsFromServer(
      query(collection(db, 'users', uid, 'savedReports'), orderBy('savedAt', 'desc'))
    );
    return snap.docs.map(d => d.data());
  } catch (err) {
    console.error(`[Admin] Failed to load saved reports for ${uid}:`, err);
    // Fallback: try without orderBy
    const snap = await getDocsFromServer(collection(db, 'users', uid, 'savedReports'));
    return snap.docs
      .map(d => d.data())
      .sort((a: any, b: any) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  }
}

/** Purges all Firestore data belonging to the user. */
export async function purgeUserData(uid: string): Promise<void> {
  const batch = writeBatch(db);

  // 1. Delete userIndex record
  batch.delete(doc(db, 'userIndex', uid));

  // 2. Delete profile record
  batch.delete(doc(db, 'users', uid, 'profile', 'data'));

  // 3. Delete subcollections (we must fetch their documents first)
  const [hSnap, rSnap, fSnap, gSnap, lSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'searchHistory')),
    getDocs(collection(db, 'users', uid, 'savedReports')),
    getDocs(collection(db, 'users', uid, 'folders')),
    getDocs(collection(db, 'users', uid, 'mfrGroups')),
    getDocs(collection(db, 'users', uid, 'loginHistory')),
  ]);

  hSnap.docs.forEach(d => batch.delete(d.ref));
  rSnap.docs.forEach(d => batch.delete(d.ref));
  fSnap.docs.forEach(d => batch.delete(d.ref));
  gSnap.docs.forEach(d => batch.delete(d.ref));
  lSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
}
