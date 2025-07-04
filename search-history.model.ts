// src/app/core/models/search-history.model.ts
import { SearchType } from '../../features/search-logs/models/search.model';
import { StreamFilter } from './stream-filter.model';
import { SearchFilterModel } from './search-filter.model';

/**
 * Represents a saved search that can be stored in cookies and restored later
 */
export interface SavedSearch {
  id: string;
  type: SearchType;
  title: string;
  appName: string;
  query?: any;
  preFilter?: string;
  globalFilters: SearchFilterModel;
  streamFilters: StreamFilter[];
  timestamp: string;
  isFavorite?: boolean;
}

/**
 * Container for all saved searches stored in cookies
 */
export interface SearchHistory {
  favorites: SavedSearch[];
  recentSearches: SavedSearch[];
  maxRecentSearches: number;
}

/**
 * Display model for search items in the UI
 */
export interface SearchDisplayItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  timestamp: Date;
  searchData: SavedSearch;
}

/**
 * Cookie storage keys
 */
export const COOKIE_KEYS = {
  SEARCH_HISTORY: 'app_search_history',
  SEARCH_FAVORITES: 'app_search_favorites'
} as const;