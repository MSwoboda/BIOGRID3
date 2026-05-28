import { useState, useEffect } from 'react';
import { Category, Folder, SavedReport, SearchHistoryItem } from './types';
import { generateId } from './lib/utils';

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

export function useStore() {
  const [folders, setFolders] = useLocalStorage<Folder[]>('biogrid_folders', []);
  const [savedReports, setSavedReports] = useLocalStorage<SavedReport[]>('biogrid_saved_reports', []);
  const [searchHistory, setSearchHistory] = useLocalStorage<SearchHistoryItem[]>('biogrid_search_history', []);

  const addFolder = (name: string) => {
    const newFolder: Folder = { id: generateId(), name, createdAt: Date.now() };
    setFolders([...folders, newFolder]);
    return newFolder;
  };

  const removeFolder = (id: string) => {
    setFolders(folders.filter(f => f.id !== id));
    setSavedReports(savedReports.map(r => r.folderId === id ? { ...r, folderId: null } : r));
  };

  const saveReport = (report: Omit<SavedReport, 'savedAt' | 'id'> & { id?: string }) => {
    const newReport: SavedReport = {
      ...report,
      id: report.id || generateId(),
      savedAt: Date.now(),
    };
    
    // update if exists
    if (savedReports.find(r => r.id === newReport.id)) {
        setSavedReports(savedReports.map(r => r.id === newReport.id ? newReport : r));
    } else {
        setSavedReports([newReport, ...savedReports]);
    }
  };

  const removeReport = (id: string) => {
    setSavedReports(savedReports.filter(r => r.id !== id));
  };
  
  const updateReportNotes = (id: string, notes: string) => {
     setSavedReports(savedReports.map(r => r.id === id ? { ...r, notes } : r));
  };

  const moveReport = (id: string, folderId: string | null) => {
     setSavedReports(savedReports.map(r => r.id === id ? { ...r, folderId } : r));
  }

  const addSearchHistory = (category: Category, query: string) => {
      const newHistory: SearchHistoryItem = {
          id: generateId(),
          category,
          query,
          timestamp: Date.now()
      };
      setSearchHistory(prev => {
          // Remove duplicates
          const filtered = prev.filter(h => !(h.category === category && h.query.toLowerCase() === query.toLowerCase()));
          return [newHistory, ...filtered].slice(0, 50); // keep last 50
      });
  };

  const clearSearchHistory = () => {
      setSearchHistory([]);
  };

  return {
    folders,
    savedReports,
    searchHistory,
    addFolder,
    removeFolder,
    saveReport,
    removeReport,
    updateReportNotes,
    moveReport,
    addSearchHistory,
    clearSearchHistory
  };
}
