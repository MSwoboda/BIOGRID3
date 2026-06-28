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

export interface FilterDim { include: string[]; exclude: string[] }

export interface FiltersSnapshot {
  eventTypes: FilterDim;
  manufacturers: FilterDim;
  deviceNames: FilterDim;
  eventLocations: FilterDim;
  reportSources: FilterDim;
  reporterStates: FilterDim;
  sexes: FilterDim;
  patientProblems: FilterDim;
  productProblems: FilterDim;
  productCodes: FilterDim;
  searchField: string;
  startDate: string;
  endDate: string;
  limit: number | 'All';
}

export interface SearchHistoryItem {
  id: string;
  category: Category;
  query: string;          // display label (joined queries or first query)
  queries: string[];      // all query terms
  timestamp: number;
  saved?: boolean;        // true = pinned saved query
  savedLabel?: string;    // user-chosen label for saved queries
  filters?: FiltersSnapshot;
}

export interface ChartData {
  name: string;
  value: number;
}
export interface ManufacturerGroup {
  id: string;
  name: string;         // user-chosen display name, e.g. "Philips Respironics"
  aliases: string[];    // all raw firm names that belong to this group
  createdAt: number;
}
