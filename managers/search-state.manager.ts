// managers/search-state.manager.ts
// ================================
// STATE MANAGER - Search State & Lifecycle
// ================================

import { Injectable, inject, signal, WritableSignal, effect, untracked } from '@angular/core';
import { ActiveSearch, SearchRequest, EnhancedSearchRequest } from '../../models/search.model';
import { FiltersService } from 'src/app/core/services/filters.service';

// Forward declaration to avoid circular dependency
let SearchExecutionManager: any;

@Injectable({ providedIn: 'root' })
export class SearchStateManager {
  
  // ================================
  // STATE SIGNALS
  // ================================
  
  public readonly activeSearches: WritableSignal<ActiveSearch[]> = signal([]);
  private filtersService = inject(FiltersService);
  private executionManager: any; // Will be set via setExecutionManager

  constructor() {
    this.setupGlobalFilterEffect();
  }

  // ================================
  // DEPENDENCY INJECTION (avoiding circular deps)
  // ================================

  public setExecutionManager(manager: any): void {
    this.executionManager = manager;
  }

  // ================================
  // SEARCH LIFECYCLE MANAGEMENT
  // ================================

  /**
   * Create a new active search from a request
   */
  public createActiveSearch(request: SearchRequest | EnhancedSearchRequest): ActiveSearch {
    const enhancedRequest = request as EnhancedSearchRequest;
    
    return {
      ...enhancedRequest,
      id: this.generateSearchId(),
      isLoading: true,
      isStreaming: this.isStreamingType(request.type),
      isExpanded: true,
      data: [],
      totalRecords: 0,
      streamFilters: [],
      aggregatedFilterValues: new Map<string, Set<any>>(),
      searchMetadata: {
        detectionResult: enhancedRequest.detectionResult,
        searchStrategy: request.type,
        confidence: enhancedRequest.detectionResult?.confidence,
        originalQuery: enhancedRequest.originalQuery
      }
    };
  }

  /**
   * Add a search to the active list
   */
  public addSearch(search: ActiveSearch): void {
    // Close existing search of same type if needed
    this.closeExistingSearchOfType(search.type);
    
    // Collapse all existing searches
    this.activeSearches.update(searches => {
      const collapsedSearches = searches.map(s => ({ ...s, isExpanded: false }));
      return [search, ...collapsedSearches];
    });

    console.log(`[StateManager] Added search: ${search.title} (${search.id})`);
  }

  /**
   * Update search state
   */
  public updateSearch(id: string, partialState: Partial<ActiveSearch>): void {
    this.activeSearches.update(searches => 
      searches.map(s => s.id === id ? { ...s, ...partialState } : s)
    );
  }

  /**
   * Remove a search
   */
  public removeSearch(id: string): void {
    this.activeSearches.update(searches => searches.filter(s => s.id !== id));
    console.log(`[StateManager] Removed search: ${id}`);
  }

  /**
   * Clear all searches
   */
  public clearAll(): void {
    this.activeSearches.set([]);
    console.log('[StateManager] Cleared all searches');
  }

  // ================================
  // SEARCH QUERYING
  // ================================

  /**
   * Get search by ID
   */
  public getSearchById(id: string): ActiveSearch | undefined {
    return this.activeSearches().find(s => s.id === id);
  }

  /**
   * Get searches by type
   */
  public getSearchesByType(type: string): ActiveSearch[] {
    return this.activeSearches().filter(s => s.type === type);
  }

  /**
   * Get streaming searches
   */
  public getStreamingSearches(): ActiveSearch[] {
    return this.activeSearches().filter(s => s.isStreaming);
  }

  /**
   * Check if any searches are loading
   */
  public hasLoadingSearches(): boolean {
    return this.activeSearches().some(s => s.isLoading);
  }

  // ================================
  // GLOBAL FILTER EFFECTS
  // ================================

  private setupGlobalFilterEffect(): void {
    effect(() => {
      const currentGlobalFilters = this.filtersService.filters();
      
      if (!currentGlobalFilters) {
        console.log('[StateManager] No filters available yet, skipping');
        return;
      }

      untracked(() => {
        console.log('[StateManager] Global filters changed, re-triggering active searches');
        
        const activeSearches = this.activeSearches();
        if (activeSearches.length === 0) {
          console.log('[StateManager] No active searches to re-trigger');
          return;
        }
        
        activeSearches.forEach(search => {
          console.log(`[StateManager] Re-triggering search: ${search.title} (type: ${search.type})`);
          
          this.updateSearch(search.id, {
            isLoading: true,
            data: [],
            error: undefined,
            totalRecords: 0,
            aggregatedFilterValues: new Map()
          });
          
          // Delegate execution to execution manager
          if (this.executionManager) {
            this.executionManager.executeSearch(search);
          }
        });
      });
    }, { allowSignalWrites: true });
  }

  // ================================
  // SEARCH STATE UTILITIES
  // ================================

  /**
   * Generate unique search ID
   */
  private generateSearchId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Check if search type is streaming
   */
  private isStreamingType(type: string): boolean {
    return type === 'browse' || type === 'error';
  }

  /**
   * Close existing search of the same type
   */
  private closeExistingSearchOfType(type: string): void {
    const existingSearch = this.activeSearches().find(s => s.type === type);
    if (existingSearch) {
      this.removeSearch(existingSearch.id);
    }
  }

  // ================================
  // STATE VALIDATION & DEBUGGING
  // ================================

  /**
   * Validate search state consistency
   */
  public validateState(): boolean {
    const searches = this.activeSearches();
    
    // Check for duplicate IDs
    const ids = searches.map(s => s.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      console.error('[StateManager] Duplicate search IDs detected');
      return false;
    }

    // Check for required properties
    const invalidSearches = searches.filter(s => 
      !s.id || !s.title || !s.appName || !s.type
    );
    if (invalidSearches.length > 0) {
      console.error('[StateManager] Invalid searches detected:', invalidSearches);
      return false;
    }

    return true;
  }

  /**
   * Get state summary for debugging
   */
  public getStateSummary(): any {
    const searches = this.activeSearches();
    return {
      totalSearches: searches.length,
      streamingSearches: searches.filter(s => s.isStreaming).length,
      loadingSearches: searches.filter(s => s.isLoading).length,
      expandedSearches: searches.filter(s => s.isExpanded).length,
      searchTypes: [...new Set(searches.map(s => s.type))],
      searchIds: searches.map(s => ({ id: s.id, title: s.title, type: s.type }))
    };
  }

  /**
   * Export state for persistence (future feature)
   */
  public exportState(): any {
    return {
      searches: this.activeSearches().map(search => ({
        ...search,
        // Remove non-serializable properties
        aggregatedFilterValues: Array.from(search.aggregatedFilterValues.entries())
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import state from persistence (future feature)
   */
  public importState(state: any): void {
    if (!state?.searches) return;
    
    const restoredSearches = state.searches.map((search: any) => ({
      ...search,
      // Restore Map from serialized data
      aggregatedFilterValues: new Map(search.aggregatedFilterValues || [])
    }));
    
    this.activeSearches.set(restoredSearches);
    console.log(`[StateManager] Imported ${restoredSearches.length} searches from state`);
  }
}