// src/types.ts

export type Category = 'drug' | 'device' | 'food' | 'tobacco';

export interface SavedReport {
  id: string; // unique ID for the report (could be report_number)
  category: Category;
  title: string;
  summary: string; // extracted short summary
  rawData: any;
  notes: string;
  folderId: string | null; // null means unfiled
  savedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface SearchResult {
  meta: {
    results: {
      skip: number;
      limit: number;
      total: number;
    }
  };
  results: any[];
}

export interface CountResult {
  term: string;
  count: number;
}

export interface SearchHistoryItem {
  id: string;
  category: Category;
  query: string;
  timestamp: number;
}

export interface ChartData {
  name: string;
  value: number;
}
