// managers/search-history.manager.ts
// ================================
// HISTORY MANAGER - Search History & Favorites
// ================================

import { Injectable, inject } from '@angular/core';
import { ActiveSearch } from '../../models/search.model';
import { SearchHistoryService } from 'src/app/core/services/search-history.service';
import { FiltersService } from 'src/app/core/services/filters.service';

@Injectable({ providedIn: 'root' })
export class SearchHistoryManager {
  
  private searchHistoryService = inject(SearchHistoryService);
  private filtersService = inject(FiltersService);

  // ================================
  // HISTORY MANAGEMENT
  // ================================

  /**
   * Save search to history
   */
  public saveSearch(search: ActiveSearch): void {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) {
      console.warn('[HistoryManager] Cannot save search - no global filters available');
      return;
    }

    this.searchHistoryService.addSearch({
      type: search.type,
      title: search.title,
      appName: search.appName,
      query: search.query,
      preFilter: search.preFilter,
      globalFilters: globalFilters,
      streamFilters: search.streamFilters || [],
      timestamp: new Date().toISOString()
    });

    console.log(`[HistoryManager] Saved search to history: ${search.title}`);
  }

  /**
   * Update search in history
   */
  public updateSearch(search: ActiveSearch): void {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) return;

    this.searchHistoryService.updateSearch({
      type: search.type,
      title: search.title,
      appName: search.appName,
      query: search.query,
      preFilter: search.preFilter,
      globalFilters: globalFilters,
      streamFilters: search.streamFilters || [],
      timestamp: new Date().toISOString()
    });

    console.log(`[HistoryManager] Updated search in history: ${search.title}`);
  }

  /**
   * Execute search from history/favorites
   */
  public executeFromHistory(savedSearch: any, performSearchCallback: (request: any) => void): void {
    console.log('[HistoryManager] Executing search from history:', savedSearch.title);
    
    // Restore global filters first
    this.filtersService.updateFilters(savedSearch.globalFilters);

    // Create search request
    const request = {
      type: savedSearch.type,
      title: savedSearch.title,
      appName: savedSearch.appName,
      query: savedSearch.query,
      preFilter: savedSearch.preFilter
    };

    // Wait for filters to update, then perform search
    setTimeout(() => {
      performSearchCallback(request);
      
      // Apply stream filters if any (with additional delay)
      if (savedSearch.streamFilters && savedSearch.streamFilters.length > 0) {
        console.log('[HistoryManager] Will apply stream filters after search starts');
        // The orchestrator will handle applying stream filters
      }
    }, 50);
  }

  // ================================
  // FAVORITES MANAGEMENT
  // ================================

  /**
   * Toggle favorite status for a search
   */
  public toggleFavorite(searchId: string): void {
    this.searchHistoryService.toggleFavorite(searchId);
  }

  /**
   * Check if search is favorited
   */
  public isFavorite(searchId: string): boolean {
    return this.searchHistoryService.isFavorite(searchId);
  }

  /**
   * Get favorites list
   */
  public getFavorites(): any[] {
    return this.searchHistoryService.favorites();
  }

  /**
   * Get recent searches
   */
  public getRecentSearches(): any[] {
    return this.searchHistoryService.recentSearches();
  }
}

// ================================
// ================================

// managers/stream-filter.manager.ts
// ================================
// STREAM FILTER MANAGER - Filter Serialization & Application
// ================================

import { Injectable, inject } from '@angular/core';
import { ActiveSearch } from '../../models/search.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { FiltersService } from 'src/app/core/services/filters.service';

// Forward declarations to avoid circular dependency
let SearchStateManager: any;
let SearchExecutionManager: any;

@Injectable({ providedIn: 'root' })
export class StreamFilterManager {
  
  private colDefService = inject(ColumnDefinitionService);
  private filtersService = inject(FiltersService);
  
  private stateManager: any;
  private executionManager: any;

  // ================================
  // DEPENDENCY INJECTION
  // ================================

  public setStateManager(manager: any): void {
    this.stateManager = manager;
  }

  public setExecutionManager(manager: any): void {
    this.executionManager = manager;
  }

  // ================================
  // FILTER APPLICATION
  // ================================

  /**
   * Apply stream filters to a search
   */
  public applyFilters(search: ActiveSearch, newFilters: StreamFilter[]): void {
    console.log(`[FilterManager] Applying ${newFilters.length} filters to: ${search.title}`);
    
    // 1. Serialize filters for URL storage
    const serializedFilters = this.serializeFilters(newFilters);
    this.filtersService.updateFilters({ streamFilters: serializedFilters });

    // 2. Update search state
    const updatedSearch = {
      ...search,
      streamFilters: newFilters,
      data: [], 
      isLoading: true,
      isStreaming: search.type === 'browse' || search.type === 'error'
    };
    
    if (this.stateManager) {
      this.stateManager.updateSearch(search.id, updatedSearch);
    }

    // 3. Update history
    // Note: This would typically call back to HistoryManager
    console.log('[FilterManager] Stream filters applied and state updated');
  }

  // ================================
  // FILTER SERIALIZATION
  // ================================

  /**
   * Serialize stream filters for URL storage
   */
  public serializeFilters(filters: StreamFilter[]): string {
    if (!filters || filters.length === 0) return '';
    return filters.map(f => `${f.field}:${f.values.join('|')}`).join(',');
  }

  /**
   * Deserialize stream filters from URL
   */
  public deserializeFilters(filterString: string | undefined, appName: string): StreamFilter[] {
    if (!filterString || !appName) return [];

    const filterableCols = this.colDefService.getFilterableColsFor(appName);
    if (filterableCols.length === 0) return [];
    
    try {
      return filterString.split(',').map(s => {
        const [field, valuesStr] = s.split(':');
        const colDef = filterableCols.find(c => c.field === field);
        
        const filter: StreamFilter = { 
          field: field,
          displayName: colDef?.displayName ?? field,
          values: valuesStr ? valuesStr.split('|') : []
        };
        return filter;
      }).filter(f => f.values.length > 0);
    } catch (e) {
      console.error('[FilterManager] Failed to parse stream filters from URL', e);
      return [];
    }
  }

  // ================================
  // FILTER VALIDATION
  // ================================

  /**
   * Validate that filters are applicable to the search
   */
  public validateFilters(filters: StreamFilter[], appName: string): StreamFilter[] {
    const filterableCols = this.colDefService.getFilterableColsFor(appName);
    const validFieldNames = new Set(filterableCols.map(col => col.field));
    
    return filters.filter(filter => {
      if (!validFieldNames.has(filter.field)) {
        console.warn(`[FilterManager] Invalid filter field: ${filter.field}`);
        return false;
      }
      
      if (!filter.values || filter.values.length === 0) {
        console.warn(`[FilterManager] Filter has no values: ${filter.field}`);
        return false;
      }
      
      return true;
    });
  }

  /**
   * Merge filters, removing duplicates
   */
  public mergeFilters(existing: StreamFilter[], newFilters: StreamFilter[]): StreamFilter[] {
    const merged = [...existing];
    
    newFilters.forEach(newFilter => {
      const existingIndex = merged.findIndex(f => f.field === newFilter.field);
      if (existingIndex >= 0) {
        // Replace existing filter
        merged[existingIndex] = newFilter;
      } else {
        // Add new filter
        merged.push(newFilter);
      }
    });
    
    return merged;
  }

  // ================================
  // FILTER UTILITIES
  // ================================

  /**
   * Remove a specific filter
   */
  public removeFilter(filters: StreamFilter[], fieldToRemove: string): StreamFilter[] {
    return filters.filter(f => f.field !== fieldToRemove);
  }

  /**
   * Clear all filters
   */
  public clearAllFilters(): StreamFilter[] {
    return [];
  }

  /**
   * Get filter summary for display
   */
  public getFilterSummary(filters: StreamFilter[]): string {
    if (filters.length === 0) return 'No filters applied';
    
    const summary = filters.map(filter => {
      const valueCount = filter.values.length;
      return `${filter.displayName}: ${valueCount} value${valueCount > 1 ? 's' : ''}`;
    }).join(', ');
    
    return `${filters.length} filter${filters.length > 1 ? 's' : ''} applied (${summary})`;
  }
}

// ================================
// ================================

// managers/index.ts
// ================================
// BARREL EXPORT - Easy imports
// ================================

export { SearchStrategyManager } from './search-strategy.manager';
export { SearchStateManager } from './search-state.manager';
export { SearchExecutionManager } from './search-execution.manager';
export { SearchHistoryManager } from './search-history.manager';
export { StreamFilterManager } from './stream-filter.manager';