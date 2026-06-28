// src/lib/share.ts
// Firestore-backed sharing — creates shareable links for reports, searches, and folders.
// Links require the recipient to be authenticated.
import {
  collection, doc, setDoc, getDoc, getFirestore,
} from 'firebase/firestore';
import { app } from './firebase';
import type { SavedReport, Folder, SearchHistoryItem } from '../types';

const db = getFirestore(app, 'biogrid');
const sharesCol = () => collection(db, 'shares');

// ── Share payload types ──────────────────────────────────────────────────────
export type ShareType = 'report' | 'search' | 'folder';

export interface ShareDoc {
  id: string;
  type: ShareType;
  createdBy: string;
  createdAt: number;
  report?: SavedReport;
  search?: SearchHistoryItem;
  folder?: { folder: Folder; reports: SavedReport[] };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function generateShareId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** Remove undefined/NaN/Infinity that Firestore rejects */
function cleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    if (value === undefined || value === Infinity || value === -Infinity || (typeof value === 'number' && isNaN(value))) return null;
    return value;
  }));
}

/** Clean a report for Firestore — keep rawData but sanitize values */
function cleanReport(r: SavedReport): SavedReport {
  return cleanForFirestore(r);
}

// ── Create a share ─────────────────────────────────────────────────────────────
export async function createShareLink(
  uid: string,
  type: ShareType,
  payload: { report?: SavedReport; search?: SearchHistoryItem; folder?: { folder: Folder; reports: SavedReport[] } },
): Promise<string> {
  const id = generateShareId();

  const cleanPayload: Partial<ShareDoc> = {};
  if (payload.report) cleanPayload.report = cleanReport(payload.report);
  if (payload.search) cleanPayload.search = cleanForFirestore(payload.search);
  if (payload.folder) {
    cleanPayload.folder = {
      folder: cleanForFirestore(payload.folder.folder),
      reports: payload.folder.reports.map(cleanReport),
    };
  }

  const shareDoc = cleanForFirestore({
    id,
    type,
    createdBy: uid,
    createdAt: Date.now(),
    ...cleanPayload,
  });

  console.log('[Share] Writing share doc:', id, 'type:', type, 'size:', JSON.stringify(shareDoc).length);
  await setDoc(doc(sharesCol(), id), shareDoc);
  console.log('[Share] Write succeeded');

  const base = window.location.origin + window.location.pathname;
  return `${base}?share=${id}`;
}

// ── Copy to clipboard with fallback ────────────────────────────────────────────
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for non-HTTPS contexts
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

// ── Retrieve a share ───────────────────────────────────────────────────────────
export async function getShareDoc(shareId: string): Promise<ShareDoc | null> {
  const snap = await getDoc(doc(sharesCol(), shareId));
  return snap.exists() ? (snap.data() as ShareDoc) : null;
}
