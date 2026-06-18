// src/lib/firestore.ts
// Firestore helpers — read/write user data under users/{uid}/...
import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
  getFirestore, getDoc, QuerySnapshot, DocumentData,
} from 'firebase/firestore';
import { app } from './firebase';
import type { SavedReport, Folder, SearchHistoryItem, ManufacturerGroup } from '../types';

// ── User Profile type ──────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  agreedToTerms: boolean;
  termsAgreedAt: number;
  marketingConsent: boolean;
  createdAt: number;
  updatedAt?: number;
}

// Named database created in the biogrid-app project
const db = getFirestore(app, 'biogrid');

// ── Collection refs ────────────────────────────────────────────────────────────
const historyCol  = (uid: string) => collection(db, 'users', uid, 'searchHistory');
const reportsCol  = (uid: string) => collection(db, 'users', uid, 'savedReports');
const foldersCol  = (uid: string) => collection(db, 'users', uid, 'folders');
const mfrGroupCol = (uid: string) => collection(db, 'users', uid, 'mfrGroups');

// ── Generic snapshot → array ───────────────────────────────────────────────────
function snapToArray<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map(d => ({ ...d.data() } as T));
}

// ── Load all user data on sign-in ──────────────────────────────────────────────
export async function loadUserData(uid: string): Promise<{
  searchHistory: SearchHistoryItem[];
  savedReports: SavedReport[];
  folders: Folder[];
  mfrGroups: ManufacturerGroup[];
}> {
  const [hSnap, rSnap, fSnap, gSnap] = await Promise.all([
    getDocs(historyCol(uid)),
    getDocs(reportsCol(uid)),
    getDocs(foldersCol(uid)),
    getDocs(mfrGroupCol(uid)),
  ]);
  return {
    searchHistory: snapToArray<SearchHistoryItem>(hSnap),
    savedReports:  snapToArray<SavedReport>(rSnap),
    folders:       snapToArray<Folder>(fSnap),
    mfrGroups:     snapToArray<ManufacturerGroup>(gSnap),
  };
}

// ── Write helpers (called on every mutation) ───────────────────────────────────
export async function saveHistoryItem(uid: string, item: SearchHistoryItem) {
  await setDoc(doc(historyCol(uid), item.id), item);
}

export async function deleteHistoryItems(uid: string, ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach(id => batch.delete(doc(historyCol(uid), id)));
  await batch.commit();
}

export async function clearHistory(uid: string, ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach(id => batch.delete(doc(historyCol(uid), id)));
  await batch.commit();
}

export async function saveReportDoc(uid: string, report: SavedReport) {
  await setDoc(doc(reportsCol(uid), report.id), report);
}

export async function deleteReportDoc(uid: string, id: string) {
  await deleteDoc(doc(reportsCol(uid), id));
}

export async function saveFolderDoc(uid: string, folder: Folder) {
  await setDoc(doc(foldersCol(uid), folder.id), folder);
}

export async function deleteFolderDoc(uid: string, id: string) {
  await deleteDoc(doc(foldersCol(uid), id));
}

export async function saveMfrGroupDoc(uid: string, group: ManufacturerGroup) {
  await setDoc(doc(mfrGroupCol(uid), group.id), group);
}

export async function deleteMfrGroupDoc(uid: string, id: string) {
  await deleteDoc(doc(mfrGroupCol(uid), id));
}

// ── User Profile helpers ───────────────────────────────────────────────────────
const profileDoc = (uid: string) => doc(db, 'users', uid, 'profile', 'data');

export async function saveUserProfile(uid: string, profile: UserProfile): Promise<void> {
  await setDoc(profileDoc(uid), { ...profile, updatedAt: Date.now() });
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileDoc(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
