import { Injectable, signal, computed, WritableSignal } from '@angular/core';
import { SavedSearch, SearchHistory, SearchDisplayItem, COOKIE_KEYS } from '../models/saved-search.model';

@Injectable({
  providedIn: 'root'
})
export class SearchHistoryService {
  private readonly MAX_RECENT_SEARCHES = 20;
  private readonly COOKIE_EXPIRY_DAYS = 30;

  // Internal signals for state management
  private _searchHistory: WritableSignal<SearchHistory> = signal({
    favorites: [],
    recentSearches: [],
    maxRecentSearches: this.MAX_RECENT_SEARCHES
  });

  // Public readonly signals
  public readonly searchHistory = this._searchHistory.asReadonly();
  
  // Computed signals for easy access
  public readonly favorites = computed(() => this.searchHistory().favorites);
  public readonly recentSearches = computed(() => this.searchHistory().recentSearches);

  // Display items for UI
  public readonly favoriteDisplayItems = computed(() => 
    this.favorites().map(search => this.createDisplayItem(search))
  );

  public readonly recentDisplayItems = computed(() => 
    this.recentSearches().map(search => this.createDisplayItem(search))
  );

  constructor() {
    this.loadFromCookies();
  }

  /**
   * Add a new search to recent searches
   */
  public addSearch(search: Omit<SavedSearch, 'id'>): void {
    const newSearch: SavedSearch = {
      ...search,
      id: this.generateSearchId(search),
      isFavorite: false
    };

    this._searchHistory.update(current => {
      // Remove any existing search with same signature to avoid duplicates
      const filtered = current.recentSearches.filter(s => s.id !== newSearch.id);
      
      // Add new search to the beginning
      const updated = [newSearch, ...filtered];
      
      // Keep only the most recent searches
      const trimmed = updated.slice(0, this.MAX_RECENT_SEARCHES);

      return {
        ...current,
        recentSearches: trimmed
      };
    });

    this.saveToCookies();
  }

  /**
   * Update an existing search (used when filters are modified)
   */
  public updateSearch(search: Omit<SavedSearch, 'id'>): void {
    const searchId = this.generateSearchId(search);
    
    this._searchHistory.update(current => {
      // Update in recent searches
      const recentIndex = current.recentSearches.findIndex(s => s.id === searchId);
      if (recentIndex >= 0) {
        const updatedRecent = [...current.recentSearches];
        updatedRecent[recentIndex] = { ...search, id: searchId, isFavorite: false };
        
        return {
          ...current,
          recentSearches: updatedRecent
        };
      }

      // If not found in recent, add as new
      return current;
    });

    this.saveToCookies();
  }

  /**
   * Toggle favorite status of a search
   */
  public toggleFavorite(searchId: string): void {
    this._searchHistory.update(current => {
      // Find in recent searches
      const recentSearch = current.recentSearches.find(s => s.id === searchId);
      
      if (recentSearch) {
        if (recentSearch.isFavorite) {
          // Remove from favorites
          return {
            ...current,
            favorites: current.favorites.filter(f => f.id !== searchId),
            recentSearches: current.recentSearches.map(s => 
              s.id === searchId ? { ...s, isFavorite: false } : s
            )
          };
        } else {
          // Add to favorites
          const favoriteSearch = { ...recentSearch, isFavorite: true };
          return {
            ...current,
            favorites: [favoriteSearch, ...current.favorites],
            recentSearches: current.recentSearches.map(s => 
              s.id === searchId ? favoriteSearch : s
            )
          };
        }
      }

      // Check if it's already in favorites (toggle off)
      const favoriteSearch = current.favorites.find(f => f.id === searchId);
      if (favoriteSearch) {
        return {
          ...current,
          favorites: current.favorites.filter(f => f.id !== searchId)
        };
      }

      return current;
    });

    this.saveToCookies();
  }

  /**
   * Remove a search from recent searches
   */
  public removeFromRecent(searchId: string): void {
    this._searchHistory.update(current => ({
      ...current,
      recentSearches: current.recentSearches.filter(s => s.id !== searchId)
    }));

    this.saveToCookies();
  }

  /**
   * Clear all recent searches
   */
  public clearRecentSearches(): void {
    this._searchHistory.update(current => ({
      ...current,
      recentSearches: []
    }));

    this.saveToCookies();
  }

  /**
   * Clear all favorites
   */
  public clearFavorites(): void {
    this._searchHistory.update(current => ({
      ...current,
      favorites: [],
      recentSearches: current.recentSearches.map(s => ({ ...s, isFavorite: false }))
    }));

    this.saveToCookies();
  }

  /**
   * Check if a search is favorited
   */
  public isFavorite(searchId: string): boolean {
    return this.favorites().some(f => f.id === searchId);
  }

  /**
   * Generate a unique ID for a search based on its content
   */
  private generateSearchId(search: Omit<SavedSearch, 'id'>): string {
    const signature = JSON.stringify({
      type: search.type,
      appName: search.appName,
      query: search.query,
      preFilter: search.preFilter,
      globalFilters: {
        application: search.globalFilters.application,
        environment: search.globalFilters.environment,
        location: search.globalFilters.location,
        dateRange: search.globalFilters.dateRange
      },
      streamFilters: search.streamFilters
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
      const char = signature.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Create display item for UI
   */
  private createDisplayItem(search: SavedSearch): SearchDisplayItem {
    const icon = this.getSearchIcon(search.type);
    const subtitle = this.createSubtitle(search);

    return {
      id: search.id,
      title: search.title,
      subtitle,
      icon,
      timestamp: new Date(search.timestamp),
      searchData: search
    };
  }

  /**
   * Get icon based on search type
   */
  private getSearchIcon(type: string): string {
    switch (type) {
      case 'browse': return 'pi pi-list';
      case 'error': return 'pi pi-exclamation-triangle';
      case 'transaction': return 'pi pi-search';
      default: return 'pi pi-file';
    }
  }

  /**
   * Create subtitle for display
   */
  private createSubtitle(search: SavedSearch): string {
    const parts: string[] = [];
    
    // Add app name
    if (search.appName) {
      parts.push(search.appName);
    }

    // Add environment
    if (search.globalFilters.environment) {
      parts.push(search.globalFilters.environment);
    }

    // Add location if different from environment
    if (search.globalFilters.location && search.globalFilters.location !== search.globalFilters.environment) {
      parts.push(search.globalFilters.location);
    }

    // Add date range info
    if (search.globalFilters.dateRange) {
      const dr = search.globalFilters.dateRange;
      if (!dr.isAbsolute && dr.relativeValue && dr.relativeUnit) {
        parts.push(`Last ${dr.relativeValue} ${dr.relativeUnit}`);
      }
    }

    // Add stream filters if any
    if (search.streamFilters && search.streamFilters.length > 0) {
      const filterCount = search.streamFilters.length;
      parts.push(`${filterCount} filter${filterCount > 1 ? 's' : ''}`);
    }

    return parts.join(' • ');
  }

  /**
   * Load search history from cookies
   */
  private loadFromCookies(): void {
    try {
      const favoritesData = this.getCookie(COOKIE_KEYS.SEARCH_FAVORITES);
      const historyData = this.getCookie(COOKIE_KEYS.SEARCH_HISTORY);

      let favorites: SavedSearch[] = [];
      let recentSearches: SavedSearch[] = [];

      if (favoritesData) {
        favorites = JSON.parse(favoritesData);
      }

      if (historyData) {
        recentSearches = JSON.parse(historyData);
      }

      this._searchHistory.set({
        favorites,
        recentSearches,
        maxRecentSearches: this.MAX_RECENT_SEARCHES
      });
    } catch (error) {
      console.error('Failed to load search history from cookies:', error);
    }
  }

  /**
   * Save search history to cookies
   */
  private saveToCookies(): void {
    try {
      const current = this.searchHistory();
      
      this.setCookie(
        COOKIE_KEYS.SEARCH_FAVORITES, 
        JSON.stringify(current.favorites), 
        this.COOKIE_EXPIRY_DAYS
      );
      
      this.setCookie(
        COOKIE_KEYS.SEARCH_HISTORY, 
        JSON.stringify(current.recentSearches), 
        this.COOKIE_EXPIRY_DAYS
      );
    } catch (error) {
      console.error('Failed to save search history to cookies:', error);
    }
  }

  /**
   * Set cookie with expiration
   */
  private setCookie(name: string, value: string, days: number): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }

  /**
   * Get cookie value
   */
  private getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    
    return null;
  }
}