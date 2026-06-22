// src/lib/adminFirestore.ts
// Admin-only Firestore helpers.
// All functions here read from the `userIndex` top-level collection.
// Firestore rules only allow these reads if the requester has an admins/{uid} document.

import {
  collection, getDocs, doc, query, orderBy, getFirestore, updateDoc, writeBatch
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
}

/** List all registered users from the denormalised userIndex collection. */
export async function listAllUsers(): Promise<AdminUserRecord[]> {
  const snap = await getDocs(
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

/** Fetch a user's login history. */
export async function getUserLoginHistory(uid: string): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'loginHistory'), orderBy('timestamp', 'desc'))
  );
  return snap.docs.map(d => d.data());
}

/** Fetch a user's search history. */
export async function getUserSearchHistory(uid: string): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'searchHistory'), orderBy('timestamp', 'desc'))
  );
  return snap.docs.map(d => d.data());
}

/** Fetch a user's saved reports. */
export async function getUserSavedReports(uid: string): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'savedReports'), orderBy('savedAt', 'desc'))
  );
  return snap.docs.map(d => d.data());
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
