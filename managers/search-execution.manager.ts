// src/app/features/search-logs/services/managers/search-execution.manager.ts
// ================================
// UPDATED EXECUTION MANAGER - Angular 19 with Enhanced Strategy Support
// ================================

import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { get } from 'lodash-es';

import { 
  ActiveSearch, 
  ElkHit, 
  SseDataPayload, 
  EnhancedSearchRequest,
  SearchExecutionContext,
  SearchResultMetadata 
} from '../../models/search.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { SearchFilterModel } from 'src/app/core/models/search-filter.model';
import { FiltersService } from 'src/app/core/services/filters.service';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { SseService, SseEvent } from 'src/app/core/services/sse.service';
import { SearchStrategyManager } from './search-strategy.manager';
import { TransactionDetailsResponse } from '../../models/transactionDetails/transaction-details.model';

// Forward declaration to avoid circular dependency
let SearchStateManager: any;

@Injectable({ providedIn: 'root' })
export class SearchExecutionManager {

  // ================================
  // DEPENDENCIES & STATE
  // ================================

  private filtersService = inject(FiltersService);
  private colDefService = inject(ColumnDefinitionService);
  private sseService = inject(SseService);
  private strategyManager = inject(SearchStrategyManager);
  
  private stateManager: any; // Will be set via setStateManager
  private activeSseSubscriptions = new Map<string, Subscription>();
  private executionContexts = new Map<string, SearchExecutionContext>();
  
  // Angular 19 signals for execution state
  private isExecuting: WritableSignal<Set<string>> = signal(new Set());
  private executionStats: WritableSignal<Map<string, SearchResultMetadata>> = signal(new Map());

  // ================================
  // DEPENDENCY INJECTION (avoiding circular deps)
  // ================================

  public setStateManager(manager: any): void {
    this.stateManager = manager;
  }

  // ================================
  // MAIN EXECUTION METHODS - ENHANCED
  // ================================

  /**
   * Execute a search using the enhanced strategy system
   */
  public executeSearch(search: ActiveSearch): void {
    console.log(`[ExecutionManager] Executing search: ${search.title} (${search.type})`);
    
    // Mark as executing
    this.isExecuting.update(executing => {
      const newSet = new Set(executing);
      newSet.add(search.id);
      return newSet;
    });
    
    // Reset search state
    this.updateSearchState(search.id, { 
      isLoading: true, 
      data: [], 
      error: undefined,
      lastUpdated: new Date()
    });

    // Get strategy using the new system
    const selectedStrategy = this.getStrategyForSearch(search);
    if (!selectedStrategy) {
      this.handleExecutionError(search.id, `No strategy available for search type: ${search.type}`);
      return;
    }

    // Create execution context
    const executionContext = this.createExecutionContext(search, selectedStrategy);
    this.executionContexts.set(search.id, executionContext);

    console.log(`[ExecutionManager] Using strategy: ${selectedStrategy.strategyName} for search: ${search.id}`);

    // Update search metadata with strategy info
    this.updateSearchState(search.id, {
      searchMetadata: {
        ...search.searchMetadata,
        searchStrategy: selectedStrategy.strategyType,
        strategyName: selectedStrategy.strategyName,
        confidence: selectedStrategy.confidence,
        executionTime: undefined // Will be set on completion
      }
    });

    // Execute based on search type
    if (search.isStreaming) {
      this.executeStreamingSearch(search, selectedStrategy);
    } else {
      this.executeHttpSearch(search, selectedStrategy);
    }
  }

  /**
   * Stop execution for a specific search
   */
  public stopExecution(searchId: string): void {
    this.stopSseStream(searchId);
    this.executionContexts.delete(searchId);
    
    this.isExecuting.update(executing => {
      const newSet = new Set(executing);
      newSet.delete(searchId);
      return newSet;
    });
    
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
    this.executionContexts.clear();
    this.isExecuting.set(new Set());
  }

  // ================================
  // ENHANCED STRATEGY SELECTION
  // ================================

  /**
   * Get strategy for a search using the new strategy system
   */
  private getStrategyForSearch(search: ActiveSearch): any {
    // For enhanced searches with strategy info, use that
    if (search.searchMetadata?.searchStrategy) {
      const strategy = this.strategyManager.getStrategy(search.searchMetadata.searchStrategy);
      if (strategy) {
        return {
          strategy,
          strategyName: strategy.getStrategyName(),
          strategyType: search.searchMetadata.searchStrategy,
          confidence: search.searchMetadata.confidence || 0.7
        };
      }
    }

    // For query-based searches, use intelligent selection
    if (search.query && typeof search.query === 'string') {
      const selectedStrategy = this.strategyManager.selectBestStrategy(search.query);
      if (selectedStrategy) {
        const strategyType = this.getStrategyTypeFromStrategy(selectedStrategy);
        return {
          strategy: selectedStrategy,
          strategyName: selectedStrategy.getStrategyName(),
          strategyType,
          confidence: this.calculateConfidence(selectedStrategy, search.query)
        };
      }
    }

    // Fallback to type-based strategy
    const strategy = this.strategyManager.getStrategy(search.type);
    if (strategy) {
      return {
        strategy,
        strategyName: strategy.getStrategyName(),
        strategyType: search.type,
        confidence: 0.5
      };
    }

    return null;
  }

  /**
   * Create execution context for tracking
   */
  private createExecutionContext(search: ActiveSearch, selectedStrategy: any): SearchExecutionContext {
    return {
      searchId: search.id,
      strategy: selectedStrategy.strategyType,
      strategyName: selectedStrategy.strategyName,
      startTime: new Date(),
      globalFilters: this.filtersService.filters(),
      streamFilters: search.streamFilters || [],
      preFilter: search.preFilter,
      metadata: {
        originalQuery: search.query,
        confidence: selectedStrategy.confidence,
        searchType: search.type
      }
    };
  }

  // ================================
  // HTTP SEARCH EXECUTION - ENHANCED
  // ================================

  private executeHttpSearch(search: ActiveSearch, selectedStrategy: any): void {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) {
      this.handleExecutionError(search.id, 'Global filters not available');
      return;
    }

    const startTime = Date.now();
    const observable = selectedStrategy.strategy.execute(
      search.query || search.type,
      globalFilters,
      search.streamFilters || [],
      search.preFilter
    );

    observable.subscribe({
      next: (response) => {
        const executionTime = Date.now() - startTime;
        console.log(`[ExecutionManager] HTTP search completed in ${executionTime}ms for: ${search.title}`, response);
        
        // Handle different response types
        if (this.isTransactionDetailsResponse(response)) {
          this.handleTransactionDetailsResponse(search, response, globalFilters, executionTime, selectedStrategy);
        } else {
          this.handleRegularResponse(search, response, globalFilters, executionTime, selectedStrategy);
        }
      },
      error: (error) => {
        const executionTime = Date.now() - startTime;
        console.error(`[ExecutionManager] HTTP search failed after ${executionTime}ms for: ${search.title}`, error);
        this.handleExecutionError(search.id, this.formatErrorMessage(error), executionTime);
      }
    });
  }

  // ================================
  // RESPONSE HANDLERS - ENHANCED
  // ================================

  private handleTransactionDetailsResponse(
    search: ActiveSearch,
    response: TransactionDetailsResponse, 
    globalFilters: SearchFilterModel,
    executionTime: number,
    selectedStrategy: any
  ): void {
    const resultMetadata: SearchResultMetadata = {
      executionTime,
      strategy: selectedStrategy.strategyType,
      strategyName: selectedStrategy.strategyName,
      confidence: selectedStrategy.confidence,
      recordCount: response.hits?.hits?.length || 0,
      hasMore: false,
      lastUpdated: new Date(),
      errors: [],
      warnings: []
    };

    this.updateSearchState(search.id, {
      isLoading: false,
      data: response.hits?.hits || [],
      totalRecords: response.hits?.total || 0,
      transactionDetails: response,
      searchMetadata: {
        ...search.searchMetadata,
        executionTime,
        searchStrategy: selectedStrategy.strategyType,
        strategyName: selectedStrategy.strategyName
      }
    });

    this.updateExecutionStats(search.id, resultMetadata);
    this.markExecutionComplete(search.id);
  }

  private handleRegularResponse(
    search: ActiveSearch,
    response: any,
    globalFilters: SearchFilterModel,
    executionTime: number,
    selectedStrategy: any
  ): void {
    const hits = response.hits || [];
    const total = response.total || 0;

    const updatedAggregations = this.aggregateFilterValues(
      search.aggregatedFilterValues || new Map(),
      hits,
      search.appName
    );

    const resultMetadata: SearchResultMetadata = {
      executionTime,
      strategy: selectedStrategy.strategyType,
      strategyName: selectedStrategy.strategyName,
      confidence: selectedStrategy.confidence,
      recordCount: hits.length,
      hasMore: hits.length < total,
      lastUpdated: new Date(),
      errors: response.errors || [],
      warnings: response.warnings || []
    };

    this.updateSearchState(search.id, {
      isLoading: false,
      data: hits,
      totalRecords: total,
      aggregatedFilterValues: updatedAggregations,
      searchMetadata: {
        ...search.searchMetadata,
        executionTime,
        searchStrategy: selectedStrategy.strategyType,
        strategyName: selectedStrategy.strategyName
      }
    });

    this.updateExecutionStats(search.id, resultMetadata);
    this.markExecutionComplete(search.id);
  }

  // ================================
  // STREAMING SEARCH EXECUTION - ENHANCED
  // ================================

  private executeStreamingSearch(search: ActiveSearch, selectedStrategy: any): void {
    console.log(`[ExecutionManager] Starting SSE stream for: ${search.title}`);
    
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) {
      this.handleExecutionError(search.id, 'Global filters not available for streaming search');
      return;
    }

    this.stopSseStream(search.id);

    const startTime = Date.now();
    const sseObservable = this.sseService.getEventSource(
      search.type as 'browse' | 'error',
      globalFilters,
      search.preFilter
    );

    const subscription = sseObservable.subscribe({
      next: (event: SseEvent) => {
        if (event.type === 'pushData' && event.data) {
          const updatedSearch = this.updateStreamData(search, event.data);
          this.updateSearchState(search.id, updatedSearch);
        }
      },
      error: (error) => {
        const executionTime = Date.now() - startTime;
        console.error(`[ExecutionManager] SSE stream failed after ${executionTime}ms for: ${search.title}`, error);
        this.handleExecutionError(search.id, this.formatErrorMessage(error), executionTime);
      },
      complete: () => {
        const executionTime = Date.now() - startTime;
        console.log(`[ExecutionManager] SSE stream completed after ${executionTime}ms for: ${search.title}`);
        this.markExecutionComplete(search.id);
      }
    });

    this.activeSseSubscriptions.set(search.id, subscription);
  }

  // ================================
  // ERROR HANDLING & COMPLETION
  // ================================

  private handleExecutionError(searchId: string, errorMessage: string, executionTime?: number): void {
    this.updateSearchState(searchId, {
      isLoading: false,
      error: errorMessage,
      searchMetadata: {
        executionTime: executionTime || 0
      }
    });

    this.markExecutionComplete(searchId);
  }

  private markExecutionComplete(searchId: string): void {
    this.isExecuting.update(executing => {
      const newSet = new Set(executing);
      newSet.delete(searchId);
      return newSet;
    });

    this.executionContexts.delete(searchId);
  }

  private updateExecutionStats(searchId: string, metadata: SearchResultMetadata): void {
    this.executionStats.update(stats => {
      const newStats = new Map(stats);
      newStats.set(searchId, metadata);
      return newStats;
    });
  }

  // ================================
  // SSE MANAGEMENT
  // ================================

  public stopSseStream(searchId: string): void {
    const subscription = this.activeSseSubscriptions.get(searchId);
    if (subscription) {
      subscription.unsubscribe();
      this.activeSseSubscriptions.delete(searchId);
      console.log(`[ExecutionManager] Stopped SSE stream for: ${searchId}`);
    }
  }

  private updateStreamData(search: ActiveSearch, payload: SseDataPayload): Partial<ActiveSearch> {
    const newHits: ElkHit[] = payload?.hits ? payload.hits : [];
    const currentData = search.data ?? [];
    const updatedData = [...currentData, ...newHits];
    
    const updatedAggregations = this.aggregateFilterValues(
      search.aggregatedFilterValues, 
      newHits, 
      search.appName
    );
    
    console.log(`[ExecutionManager] Received ${newHits.length} new hits for: ${search.title}`);
    
    return { 
      data: updatedData, 
      isLoading: false, 
      totalRecords: payload.total ?? search.totalRecords, 
      aggregatedFilterValues: updatedAggregations,
      lastUpdated: new Date()
    };
  }

  // ================================
  // UTILITY METHODS
  // ================================

  private getStrategyTypeFromStrategy(strategy: any): string {
    const strategies = this.strategyManager.getStrategyInfo();
    const found = strategies.find(s => s.name === strategy.getStrategyName());
    return found?.type || 'unknown';
  }

  private calculateConfidence(strategy: any, query: string): number {
    const metadata = strategy.getMetadata?.();
    if (metadata?.confidence === 'high') return 0.9;
    if (metadata?.confidence === 'medium') return 0.7;
    if (metadata?.confidence === 'low') return 0.5;
    return 0.6;
  }

  private isTransactionDetailsResponse(response: any): response is TransactionDetailsResponse {
    return response && 
           typeof response === 'object' && 
           'hits' in response &&
           response.hits &&
           'hits' in response.hits &&
           Array.isArray(response.hits.hits);
  }

  private aggregateFilterValues(
    currentAggregations: Map<string, Set<any>>, 
    newHits: ElkHit[], 
    appName: string
  ): Map<string, Set<any>> {
    const filterableFields = this.colDefService.getFilterableColsFor(appName);
    if (filterableFields.length === 0) {
      return currentAggregations || new Map();
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

  private updateSearchState(id: string, partialState: Partial<ActiveSearch>): void {
    if (this.stateManager) {
      this.stateManager.updateSearch(id, partialState);
    }
  }

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
  // PUBLIC API - MONITORING & STATS
  // ================================

  /**
   * Get execution statistics
   */
  public getExecutionStats(): any {
    return {
      activeSseStreams: this.activeSseSubscriptions.size,
      streamIds: Array.from(this.activeSseSubscriptions.keys()),
      currentlyExecuting: Array.from(this.isExecuting()),
      executionMetadata: Object.fromEntries(this.executionStats())
    };
  }

  /**
   * Check if a search is currently executing
   */
  public isExecuting(searchId: string): boolean {
    return this.isExecuting().has(searchId);
  }

  /**
   * Get execution context for a search
   */
  public getExecutionContext(searchId: string): SearchExecutionContext | undefined {
    return this.executionContexts.get(searchId);
  }

  /**
   * Get result metadata for a search
   */
  public getResultMetadata(searchId: string): SearchResultMetadata | undefined {
    return this.executionStats().get(searchId);
  }
}