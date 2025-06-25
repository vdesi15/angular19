// managers/search-execution.manager.ts
// ================================
// EXECUTION MANAGER - Search Execution & SSE Handling
// ================================

import { Injectable, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { get } from 'lodash-es';

import { ActiveSearch, ElkHit, SseDataPayload } from '../../models/search.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { FiltersService } from 'src/app/core/services/filters.service';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { SseService, SseEvent } from 'src/app/core/services/sse.service';
import { SearchStrategyManager } from './search-strategy.manager';

// Forward declaration to avoid circular dependency
let SearchStateManager: any;

@Injectable({ providedIn: 'root' })
export class SearchExecutionManager {

  // ================================
  // DEPENDENCIES
  // ================================

  private filtersService = inject(FiltersService);
  private colDefService = inject(ColumnDefinitionService);
  private sseService = inject(SseService);
  private strategyManager = inject(SearchStrategyManager);
  
  private stateManager: any; // Will be set via setStateManager
  private activeSseSubscriptions = new Map<string, Subscription>();

  // ================================
  // DEPENDENCY INJECTION (avoiding circular deps)
  // ================================

  public setStateManager(manager: any): void {
    this.stateManager = manager;
  }

  // ================================
  // MAIN EXECUTION METHODS
  // ================================

  /**
   * Execute a search using the appropriate strategy
   */
  public executeSearch(search: ActiveSearch): void {
    console.log(`[ExecutionManager] Executing search: ${search.title} (${search.type})`);
    
    this.updateSearchState(search.id, { 
      isLoading: true, 
      data: [], 
      error: undefined 
    });

    const strategy = this.strategyManager.getStrategyForSearch(search);
    if (!strategy) {
      this.updateSearchState(search.id, { 
        isLoading: false, 
        error: `No strategy available for search type: ${search.type}` 
      });
      return;
    }

    console.log(`[ExecutionManager] Using strategy: ${strategy.getStrategyName()}`);

    if (search.isStreaming) {
      this.executeStreamingSearch(search, strategy);
    } else {
      this.executeHttpSearch(search, strategy);
    }
  }

  /**
   * Stop execution for a specific search
   */
  public stopExecution(searchId: string): void {
    this.stopSseStream(searchId);
    console.log(`[ExecutionManager] Stopped execution for search: ${searchId}`);
  }

  /**
   * Stop all executions
   */
  public stopAllExecutions(): void {
    console.log('[ExecutionManager] Stopping all executions');
    
    this.activeSseSubscriptions.forEach((subscription, id) => {
      subscription.unsubscribe();
    });
    this.activeSseSubscriptions.clear();
  }

  // ================================
  // HTTP SEARCH EXECUTION
  // ================================

  private executeHttpSearch(search: ActiveSearch, strategy: any): void {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) {
      this.updateSearchState(search.id, { 
        isLoading: false, 
        error: 'Global filters not available' 
      });
      return;
    }

    const startTime = Date.now();
    const observable = strategy.execute(
      search.query || search.type,
      globalFilters,
      search.streamFilters || [],
      search.preFilter
    );

    observable.subscribe({
      next: (response) => {
        const executionTime = Date.now() - startTime;
        console.log(`[ExecutionManager] HTTP search completed in ${executionTime}ms for: ${search.title}`, response);
        
        // Check if this is a TransactionDetailsResponse
      if (this.isTransactionDetailsResponse(response)) {
        this.handleTransactionDetailsResponse(search, response, globalFilters, executionTime);
      } else {
        // Handle regular response (your existing logic)
        this.handleRegularResponse(search, response, globalFilters, executionTime);
      }
      },
      error: (error) => {
        const executionTime = Date.now() - startTime;
        console.error(`[ExecutionManager] HTTP search failed after ${executionTime}ms for: ${search.title}`, error);
        
        this.updateSearchState(search.id, {
          isLoading: false,
          error: this.formatErrorMessage(error),
          searchMetadata: {
            ...search.searchMetadata,
            executionTime
          }
        });
      }
    });
  }

  private handleTransactionDetailsResponse(
  search: ActiveSearch,
  response: TransactionDetailsResponse, 
  globalFilters: SearchFilterModel,
  executionTime: number
): void {
  this.updateSearchState(search.id, {
          isLoading: false,
          data: response.hits.hits, // Direct mapping!
          totalRecords: response.hits.total,
          transactionDetails: response, // Store the whole thing!
          aggregatedFilterValues: this.aggregateFilterValues(
            new Map(),
            response.hits.hits,
            this.resolveAppName(search, globalFilters)
          ),
          searchMetadata: {
            ...search.searchMetadata,
            executionTime,
            searchStrategy: 'TransactionDetails'
          }
        });
}

// NEW: Handle regular response (your existing logic)
private handleRegularResponse(
  search: ActiveSearch,
  response: any, 
  globalFilters: SearchFilterModel,
  executionTime: number
): void {
 
  this.updateSearchState(search.id, {
          isLoading: false,
          data: response.hits || [],
          totalRecords: response.total || 0,
          aggregatedFilterValues: this.aggregateFilterValues(
            new Map(),
            response.hits || [],
            this.resolveAppName(search, globalFilters)
          ),
          searchMetadata: {
            ...search.searchMetadata,
            executionTime
          }
        });
}

private isTransactionDetailsResponse(response: any): response is TransactionDetailsResponse {
  return response && 
         typeof response === 'object' &&
         'hits' in response &&
         'overflow' in response &&
         'call_count' in response;
}

// NEW: Resolve appName based on your requirements
private resolveAppName(search: ActiveSearch, globalFilters: SearchFilterModel): string {
  // Priority 1: Use the search's appName if it exists
  if (search.appName && search.appName.trim()) {
    return search.appName;
  }

  // Priority 2: Use global filter applications
  const applications = globalFilters.application || [];
  
  if (applications.length === 0) {
    return 'generic'; // No apps selected
  } else if (applications.length === 1) {
    return applications[0]; // Single app selected
  } else if (applications.length === 2) {
    return applications.join('_'); // Two apps: "app1_app2"
  } else {
    return 'generic'; // More than 2 apps selected, use generic
  }
}


  // ================================
  // SSE STREAMING EXECUTION
  // ================================

  private executeStreamingSearch(search: ActiveSearch, strategy: any): void {
    this.stopSseStream(search.id);
    
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) {
      this.updateSearchState(search.id, { 
        isLoading: false, 
        error: 'Global filters not available' 
      });
      return;
    }

    console.log(`[ExecutionManager] Starting SSE stream for: ${search.title}`);

    const sseObservable = strategy.execute(
      { type: search.type as 'browse' | 'error' },
      globalFilters,
      search.streamFilters || [],
      search.preFilter
    ) as Observable<SseEvent>;
      
    const subscription = sseObservable.subscribe({
      next: (event) => this.processSseEvent(search.id, event),
      error: (error) => {
        console.error(`[ExecutionManager] SSE stream error for: ${search.title}`, error);
        this.updateSearchState(search.id, {
          isLoading: false,
          isStreaming: false,
          error: this.formatErrorMessage(error)
        });
      },
      complete: () => {
        console.log(`[ExecutionManager] SSE stream completed for: ${search.title}`);
        this.updateSearchState(search.id, {
          isLoading: false,
          isStreaming: false
        });
      }
    });
    
    this.activeSseSubscriptions.set(search.id, subscription);
  }

  /**
   * Stop SSE stream for a specific search
   */
  public stopSseStream(searchId: string): void {
    const subscription = this.activeSseSubscriptions.get(searchId);
    if (subscription) {
      subscription.unsubscribe();
      this.activeSseSubscriptions.delete(searchId);
      this.updateSearchState(searchId, { isLoading: false, isStreaming: false });
      console.log(`[ExecutionManager] Stopped SSE stream for: ${searchId}`);
    }
  }

  // ================================
  // SSE EVENT PROCESSING
  // ================================

  private processSseEvent(searchId: string, event: SseEvent): void {
    if (!this.stateManager) return;

    this.stateManager.activeSearches.update((searches: ActiveSearch[]) => 
      searches.map(search => {
        if (search.id !== searchId) return search;
        
        switch (event.type) {
          case 'OPEN':
            console.log(`[ExecutionManager] SSE connection opened for: ${search.title}`);
            return { ...search, isLoading: true, data: [] };
            
          case 'DATA':
            return this.handleSseDataEvent(search, event);
            
          case 'END':
            console.log(`[ExecutionManager] SSE stream ended for: ${search.title}`);
            return { ...search, isLoading: false, isStreaming: false };
            
          case 'ERROR':
            console.error(`[ExecutionManager] SSE error for: ${search.title}`, event.error);
            return { 
              ...search, 
              isLoading: false, 
              isStreaming: false, 
              error: event.error?.message || 'Streaming error occurred' 
            };
            
          default:
            return search;
        }
      })
    );
  }

  private handleSseDataEvent(search: ActiveSearch, event: SseEvent): ActiveSearch {
    if (!event.data) return search;
    
    const payload = event.data as SseDataPayload;
    const newHits = payload.hits ?? [];
    const currentData = search.data ?? [];
    const updatedData = [...currentData, ...newHits];
    
    const updatedAggregations = this.aggregateFilterValues(
      search.aggregatedFilterValues, 
      newHits, 
      search.appName
    );
    
    console.log(`[ExecutionManager] Received ${newHits.length} new hits for: ${search.title}`);
    
    return { 
      ...search, 
      data: updatedData, 
      isLoading: false, 
      totalRecords: payload.total ?? search.totalRecords, 
      aggregatedFilterValues: updatedAggregations,
      lastUpdated: new Date()
    };
  }

  // ================================
  // DATA AGGREGATION
  // ================================

  /**
   * Aggregate filter values from new hits
   */
  private aggregateFilterValues(
    currentAggregations: Map<string, Set<any>>, 
    newHits: ElkHit[], 
    appName: string
  ): Map<string, Set<any>> {
    const filterableFields = this.colDefService.getFilterableColsFor(appName);
    if (filterableFields.length === 0) {
      return currentAggregations;
    }

    const updatedAggregations = new Map(currentAggregations);

    newHits.forEach(hit => {
      filterableFields.forEach(col => {        
        const value = get(hit._source, col.field);       
        if (value !== undefined && value !== null) {
          if (!updatedAggregations.has(col.field)) {
            updatedAggregations.set(col.field, new Set());
          }
          updatedAggregations.get(col.field)!.add(value);
        }
      });
    });
    
    return updatedAggregations;
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Update search state (delegate to state manager)
   */
  private updateSearchState(id: string, partialState: Partial<ActiveSearch>): void {
    if (this.stateManager) {
      this.stateManager.updateSearch(id, partialState);
    }
  }

  /**
   * Format error message for display
   */
  private formatErrorMessage(error: any): string {
    if (error?.message) {
      return error.message;
    }
    
    if (error?.error?.message) {
      return error.error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    return 'An unexpected error occurred during search execution';
  }

  // ================================
  // EXECUTION MONITORING & DEBUGGING
  // ================================

  /**
   * Get execution statistics
   */
  public getExecutionStats(): any {
    return {
      activeSseStreams: this.activeSseSubscriptions.size,
      streamIds: Array.from(this.activeSseSubscriptions.keys()),
      totalExecutions: 0, // Could be tracked if needed
      avgExecutionTime: 0 // Could be calculated from metadata
    };
  }

  /**
   * Check if a search is currently executing
   */
  public isExecuting(searchId: string): boolean {
    return this.activeSseSubscriptions.has(searchId);
  }

  /**
   * Get all active stream IDs
   */
  public getActiveStreamIds(): string[] {
    return Array.from(this.activeSseSubscriptions.keys());
  }

  /**
   * Validate execution state
   */
  public validateExecutionState(): boolean {
    const streamIds = this.getActiveStreamIds();
    
    if (!this.stateManager) {
      console.error('[ExecutionManager] State manager not set');
      return false;
    }

    // Check that all active streams have corresponding searches
    const activeSearches = this.stateManager.activeSearches();
    const searchIds = activeSearches.map((s: ActiveSearch) => s.id);
    
    const orphanedStreams = streamIds.filter(id => !searchIds.includes(id));
    if (orphanedStreams.length > 0) {
      console.warn('[ExecutionManager] Orphaned streams detected:', orphanedStreams);
      // Clean up orphaned streams
      orphanedStreams.forEach(id => this.stopSseStream(id));
    }

    return true;
  }

  /**
   * Force cleanup of all resources
   */
  public cleanup(): void {
    console.log('[ExecutionManager] Performing cleanup');
    this.stopAllExecutions();
    this.validateExecutionState();
  }
}