// src/lib/firestore.ts
// Firestore helpers — read/write user data under users/{uid}/...
import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
  getFirestore, getDoc, updateDoc, QuerySnapshot, DocumentData,
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
  paused?: boolean;
  avatarSeed?: string;
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
// Top-level denormalised index for admin dashboard (no subcollection traversal needed)
const userIndexDoc = (uid: string) => doc(db, 'userIndex', uid);

export async function saveUserProfile(uid: string, profile: UserProfile, email?: string, photoURL?: string): Promise<void> {
  const now = Date.now();
  await setDoc(profileDoc(uid), { ...profile, updatedAt: now });
  // Also write to userIndex so the admin dashboard can list all users efficiently.
  await setDoc(userIndexDoc(uid), {
    uid,
    email: email ?? '',
    firstName: profile.firstName,
    lastName: profile.lastName,
    company: profile.company,
    role: profile.role,
    createdAt: profile.createdAt,
    updatedAt: now,
    paused: profile.paused ?? false,
    avatarSeed: profile.avatarSeed ?? '',
    photoURL: photoURL ?? '',
  });
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileDoc(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/** Patch photoURL (and avatarSeed) into userIndex so admin sees current images. */
export async function syncUserIndex(uid: string, photoURL?: string | null, avatarSeed?: string): Promise<void> {
  try {
    const patch: Record<string, any> = {};
    if (photoURL !== undefined) patch.photoURL = photoURL ?? '';
    if (avatarSeed !== undefined) patch.avatarSeed = avatarSeed;
    if (Object.keys(patch).length > 0) {
      await updateDoc(userIndexDoc(uid), patch);
    }
  } catch {
    // userIndex doc may not exist yet (first login before onboarding) — ignore
  }
}

function getClientDetails() {
  const ua = typeof window !== 'undefined' ? navigator.userAgent : '';
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Simple OS detection
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Simple Browser detection
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opr/i.test(ua)) browser = 'Opera';

  return { browser, os, userAgent: ua };
}

export async function recordLoginHistory(uid: string): Promise<void> {
  const { browser, os, userAgent } = getClientDetails();
  const loginRef = doc(collection(db, 'users', uid, 'loginHistory'));
  await setDoc(loginRef, {
    id: loginRef.id,
    timestamp: Date.now(),
    browser,
    os,
    userAgent,
    localTime: new Date().toLocaleString(),
  });
}

