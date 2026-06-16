// src/store.ts — Cloud-backed user data store
// When uid is provided: write-through to Firestore + localStorage
// When uid is null: localStorage only (should not happen in authenticated-only mode)

import { useState, useEffect, useCallback } from 'react';
import { Category, Folder, SavedReport, SearchHistoryItem, ManufacturerGroup } from './types';
import { generateId } from './lib/utils';
import {
  loadUserData,
  saveHistoryItem, clearHistory,
  saveReportDoc, deleteReportDoc,
  saveFolderDoc, deleteFolderDoc,
  saveMfrGroupDoc, deleteMfrGroupDoc,
} from './lib/firestore';

// ── localStorage fallback ──────────────────────────────────────────────────────
function getLS<T>(key: string, def: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
}
function setLS<T>(key: string, val: T) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useStore(uid: string | null) {
  const [folders,       setFolders]       = useState<Folder[]>([]);
  const [savedReports,  setSavedReports]  = useState<SavedReport[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [mfrGroups,     setMfrGroups]     = useState<ManufacturerGroup[]>([]);
  const [cloudLoaded,   setCloudLoaded]   = useState(false);

  // Load from Firestore when user signs in
  useEffect(() => {
    if (!uid) {
      // reset to empty when signed out
      setFolders([]);
      setSavedReports([]);
      setSearchHistory([]);
      setMfrGroups([]);
      setCloudLoaded(false);
      return;
    }
    setCloudLoaded(false);
    loadUserData(uid).then(data => {
      setFolders(data.folders);
      setSavedReports(data.savedReports);
      setSearchHistory(
        [...data.searchHistory].sort((a, b) => b.timestamp - a.timestamp)
      );
      setMfrGroups(data.mfrGroups ?? []);
      setCloudLoaded(true);
    }).catch(err => {
      console.error('Failed to load user data from Firestore:', err);
      setCloudLoaded(true);
    });
  }, [uid]);

  // ── Folders ──────────────────────────────────────────────────────────────────
  const addFolder = useCallback((name: string) => {
    const f: Folder = { id: generateId(), name, createdAt: Date.now() };
    setFolders(prev => [...prev, f]);
    if (uid) saveFolderDoc(uid, f).catch(console.error);
    return f;
  }, [uid]);

  const removeFolder = useCallback((id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setSavedReports(prev => prev.map(r => r.folderId === id ? { ...r, folderId: null } : r));
    if (uid) deleteFolderDoc(uid, id).catch(console.error);
  }, [uid]);

  const renameFolder = useCallback((id: string, name: string) => {
    setFolders(prev => {
      const updated = prev.map(f => f.id === id ? { ...f, name } : f);
      const folder = updated.find(f => f.id === id);
      if (uid && folder) saveFolderDoc(uid, folder).catch(console.error);
      return updated;
    });
  }, [uid]);

  // ── Reports ───────────────────────────────────────────────────────────────────
  const saveReport = useCallback((report: Omit<SavedReport, 'savedAt' | 'id'> & { id?: string }) => {
    const r: SavedReport = { ...report, id: report.id || generateId(), savedAt: Date.now() };
    setSavedReports(prev =>
      prev.find(x => x.id === r.id)
        ? prev.map(x => x.id === r.id ? r : x)
        : [r, ...prev]
    );
    if (uid) saveReportDoc(uid, r).catch(console.error);
  }, [uid]);

  const removeReport = useCallback((id: string) => {
    setSavedReports(prev => prev.filter(r => r.id !== id));
    if (uid) deleteReportDoc(uid, id).catch(console.error);
  }, [uid]);

  const updateReportNotes = useCallback((id: string, notes: string) => {
    setSavedReports(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, notes } : r);
      const r = updated.find(x => x.id === id);
      if (uid && r) saveReportDoc(uid, r).catch(console.error);
      return updated;
    });
  }, [uid]);

  const moveReport = useCallback((id: string, folderId: string | null) => {
    setSavedReports(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, folderId } : r);
      const r = updated.find(x => x.id === id);
      if (uid && r) saveReportDoc(uid, r).catch(console.error);
      return updated;
    });
  }, [uid]);

  // ── Search history ────────────────────────────────────────────────────────────
  const addSearchHistory = useCallback((category: Category, queries: string[], filters?: SearchHistoryItem['filters']) => {
    const query = queries.join(', ');
    const item: SearchHistoryItem = { id: generateId(), category, query, queries, timestamp: Date.now(), filters };
    setSearchHistory(prev => {
      // Deduplicate: remove prior entries with same category + same query string
      const filtered = prev.filter(h => !(h.category === category && h.query.toLowerCase() === query.toLowerCase() && !h.saved));
      const next = [item, ...filtered].slice(0, 100);
      return next;
    });
    if (uid) saveHistoryItem(uid, item).catch(console.error);
  }, [uid]);

  const saveQuery = useCallback((item: SearchHistoryItem, label: string) => {
    const saved: SearchHistoryItem = { ...item, id: generateId(), saved: true, savedLabel: label, timestamp: Date.now() };
    setSearchHistory(prev => {
      // Don't duplicate saved queries with the same label
      const filtered = prev.filter(h => !(h.saved && h.savedLabel === label && h.category === item.category));
      return [saved, ...filtered];
    });
    if (uid) saveHistoryItem(uid, saved).catch(console.error);
    return saved;
  }, [uid]);

  const removeHistoryItem = useCallback((id: string) => {
    setSearchHistory(prev => prev.filter(h => h.id !== id));
    if (uid) clearHistory(uid, [id]).catch(console.error);
  }, [uid]);

  const updateHistoryItem = useCallback((id: string, patch: Partial<SearchHistoryItem>) => {
    setSearchHistory(prev => {
      const next = prev.map(h => h.id === id ? { ...h, ...patch } : h);
      const item = next.find(h => h.id === id);
      if (uid && item) saveHistoryItem(uid, item).catch(console.error);
      return next;
    });
  }, [uid]);

  const clearSearchHistory = useCallback(async () => {
    setSearchHistory(prev => {
      const unsaved = prev.filter(h => !h.saved);
      if (uid) clearHistory(uid, unsaved.map(h => h.id)).catch(console.error);
      return prev.filter(h => h.saved); // keep saved queries
    });
  }, [uid]);

  // ── Manufacturer Groups ───────────────────────────────────────────────────────
  const saveMfrGroup = useCallback((group: ManufacturerGroup) => {
    setMfrGroups(prev => {
      const exists = prev.find(g => g.id === group.id);
      const next = exists ? prev.map(g => g.id === group.id ? group : g) : [...prev, group];
      if (uid) saveMfrGroupDoc(uid, group).catch(console.error);
      return next;
    });
  }, [uid]);

  const removeMfrGroup = useCallback((id: string) => {
    setMfrGroups(prev => prev.filter(g => g.id !== id));
    if (uid) deleteMfrGroupDoc(uid, id).catch(console.error);
  }, [uid]);

  return {
    folders, savedReports, searchHistory, mfrGroups, cloudLoaded,
    addFolder, removeFolder, renameFolder,
    saveReport, removeReport, updateReportNotes, moveReport,
    addSearchHistory, clearSearchHistory, saveQuery, removeHistoryItem, updateHistoryItem,
    saveMfrGroup, removeMfrGroup,
  };
}
