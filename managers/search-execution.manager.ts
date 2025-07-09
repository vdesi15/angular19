// ================================
// EXECUTION MANAGER - Search Execution & SSE Handling
// ================================

import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { get } from 'lodash-es';

import { ActiveSearch, ElkHit, SearchExecutionContext, SearchResultMetadata, SearchType, SseDataPayload } from '../../models/search.model';
import { SearchFiltersService } from '../../../shared/services/search-filters.service';
import { ColumnDefinitionService } from '../column-definition.service';
import { SseEvent, SseService } from '../sse.service';
import { SearchStrategyManager } from './search-strategy.manager';
import { SearchStrategyName } from '../../models/strategy.model';
import { TransactionDetailsResponse } from '../../models/transaction-details.model';
import { SearchFilterModel } from '../../../shared/models/filters.models';
import { JiraSearchResponse } from '../../models/jira.models';

// Forward declaration to avoid circular dependency
let SearchStateManager: any;

@Injectable({ providedIn: 'root' })
export class SearchExecutionManager {

  private filtersService = inject(SearchFiltersService);
  private colDefService = inject(ColumnDefinitionService);
  private sseService = inject(SseService);
  private strategyManager = inject(SearchStrategyManager);

  private stateManager: any; // Will be set via setStateManager
  private activeSseSubscriptions = new Map<string, Subscription>();
  private executionContexts = new Map<string, SearchExecutionContext>();

  private isExecuting: WritableSignal<Set<string>> = signal(new Set());
  private executionStats: WritableSignal<Map<string, SearchResultMetadata>> = signal(new Map());

  /**
   * DEPENDENCY INJECTION (avoiding circular deps)
   * @param manager - current manager to use.
   */
  public setStateManager(manager: any): void {
    this.stateManager = manager;
  }

  /**
   * Execute a search using the appropriate strategy
   */
  public executeSearch(search: ActiveSearch): void {
    console.log(`[ExecutionManager] Executing search: ${search.title} (${search.type})`);    

    const selectedStrategy = this.getStrategyForSearch(search);
    if (!selectedStrategy) {
      this.updateSearchState(search.id, {
        isLoading: false,
        error: `No strategy available for search type: ${search.type}`
      });
      return;
    }

    if (this.canExecuteSearch(search, selectedStrategy)) {
      this.isExecuting.update(executing => {
        const newSet = new Set(executing);
        newSet.add(search.id);
        return newSet;
      });

      this.updateSearchState(search.id, {
        isLoading: true,
        data: [],
        error: undefined,
        lastUpdated: new Date()
      });

      // Create execution context
      const executionContext = this.createExecutionContext(search, selectedStrategy);
      this.executionContexts.set(search.id, executionContext);


      if (selectedStrategy.strategy.getStrategyName() === SearchStrategyName.SseStreamingStrategy) {
        search.isStreaming = true;
      }

      console.log(`[ExecutionManager] Using strategy: ${selectedStrategy.strategy.getStrategyName()}`);

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

      if (search.isStreaming) {
        this.executeStreamingSearch(search, selectedStrategy);
      } else {
        this.executeHttpSearch(search, selectedStrategy);
      }
      this.markSearchCompleted(search, selectedStrategy)
    }
    else 
    {
      console.log(`[ExecutionManager] Skipping search as search with similar id alrady present.`);
    }

    
  }

  public canExecuteSearch(request: ActiveSearch, selectedStrategy: any): boolean {

    // Generate search key using strategy
    const searchKey = selectedStrategy.strategy.generateSearchKey(
      request.query,
      this.filtersService.filters() || {}
    );

    // Ask strategy if it can execute
    let canExecute = selectedStrategy.strategy.canSearch(searchKey);

    if (canExecute) {
      // Mark as executing in strategy
      selectedStrategy.strategy.markExecuting(searchKey);
    }

    return canExecute;
  }

  // Mark search as completed in strategy
  public markSearchCompleted(request: ActiveSearch, selectedStrategy: any): void {
    if (selectedStrategy.strategy) {
      const searchKey = selectedStrategy.strategy.generateSearchKey(
        request.query,
        this.filtersService.filters() || {}
      );
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
  // STRATEGY SELECTION
  // ================================

  /**
   * Get the SearchType based on the search type string.
   * @param strategyString searchType string
   * @returns SearchType 
   */
  private validateSearchType(strategyString: string): SearchType | null {
    const validTypes: SearchType[] = ['browse', 'error', 'transaction', 'jira', 'lot', 'natural'];

    if (validTypes.includes(strategyString as SearchType)) {
      return strategyString as SearchType;
    }

    console.warn(`[ExecutionManager] Invalid strategy type: ${strategyString}`);
    return null;
  }


  /**
   * Get strategy for a search using the new strategy system
   */
  private getStrategyForSearch(search: ActiveSearch): any {
    if (search.searchMetadata?.searchStrategy) {
      const strategyType = this.validateSearchType(search.searchMetadata.searchStrategy);
      if (strategyType) {
        const strategy = this.strategyManager.getStrategy(strategyType);
        if (strategy) {
          return {
            strategy,
            strategyName: strategy.getStrategyName(),
            strategyType: strategyType,
            confidence: search.searchMetadata.confidence || 0.7
          };
        }
      }
    }

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
  // HTTP SEARCH EXECUTION
  // ================================

  private executeHttpSearch(search: ActiveSearch, selectedStrategy: any): void {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) {
      this.updateSearchState(search.id, {
        isLoading: false,
        error: 'Global filters not available'
      });
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
      next: (response: any) => {
        const executionTime = Date.now() - startTime;
        console.log(`[ExecutionManager] HTTP search completed in ${executionTime}ms for: ${search.title}`, response);

        if (this.isTransactionDetailsResponse(response)) {
          this.handleTransactionDetailsResponse(search, response, globalFilters, executionTime, selectedStrategy);
        } 
        else if (this.isJiraDetailsResponse(response)) {
          this.updateSearchState(search.id, { appName: this.filtersService.filters()?.applications[0] });
          this.handleTransactionDetailsResponse(search, (response as unknown as JiraSearchResponse).transactionDetails, globalFilters, executionTime, selectedStrategy);
        } else {
          // Handle regular response (your existing logic)
          this.handleRegularResponse(search, response, globalFilters, executionTime, selectedStrategy);
        }
      },
      error: (error: any) => {
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

  private isTransactionDetailsResponse(response: any): response is TransactionDetailsResponse {
    return response &&
      typeof response === 'object' &&
      'hits' in response &&
      Array.isArray(response.hits.hits) &&
      !('jiraDetails' in response);
  }

  private isJiraDetailsResponse(response: any): response is TransactionDetailsResponse {
    return response &&
      typeof response === 'object' &&
      'hits' in response && 
      'jiraDetails' in response;
  }

  private handleTransactionDetailsResponse(search: ActiveSearch,
                                            response: TransactionDetailsResponse | undefined,
                                            globalFilters: SearchFilterModel,
                                            executionTime: number,
                                            selectedStrategy: any): void {

    const resultMetadata: SearchResultMetadata = {
      executionTime,
      strategy: selectedStrategy.strategyType,
      strategyName: selectedStrategy.strategyName,
      confidence: selectedStrategy.confidence,
      recordCount: response?.hits?.hits?.length || 0,
      hasMore: false,
      lastUpdated: new Date(),
      errors: [],
      warnings: []
    };

    this.updateSearchState(search.id, {  
      isLoading: false,
      data: response?.hits?.hits as ElkHit[], 
      totalRecords: response?.hits?.total || 0,
      transactionDetails: response, 
      aggregatedFilterValues: this.aggregateFilterValues(
        new Map(),
        response?.hits?.hits ?? [],
        this.resolveAppName(search, globalFilters)
      ),
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

  // Handle regular response
  private handleRegularResponse(search: ActiveSearch,
                                response: any,
                                globalFilters: SearchFilterModel,
                                executionTime: number,
                                selectedStrategy: any): void {

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
      data: response.hits || [],
      totalRecords: response.total || 0,
      aggregatedFilterValues: this.aggregateFilterValues(
        new Map(),
        response.hits || [],
        this.resolveAppName(search, globalFilters)
      ),
      searchMetadata: {
        ...search.searchMetadata,
        executionTime,
        searchStrategy: selectedStrategy.strategyType,
        strategyName: selectedStrategy.strategyName
      }
    });
  }

  private resolveAppName(search: ActiveSearch, globalFilters: SearchFilterModel): string {

    if (search.appName && search.appName.trim()) {
      return search.appName;
    }

    const applications = globalFilters.applications || [];

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

  private executeStreamingSearch(search: ActiveSearch, selectedStrategy: any): void {
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

    const sseObservable = selectedStrategy.strategy.execute(
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
        this.markExecutionComplete(search.id);
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

  private processSseEvent(searchId: string, event: any): void {
  if (!this.stateManager) return;

  this.stateManager.activeSearches.update((searches: ActiveSearch[]) =>
    searches.map(search => {
      if (search.id !== searchId) return search;

      switch (event.type) {
        case 'OPEN':
          console.log(`[ExecutionManager] SSE connection opened for: ${search.title}`);
          return { ...search, isLoading: true, data: [], batchData: [] };

        case 'DATA':
          return this.handleSseDataEvent(search, event);

        case 'BATCH_DATA':
          return this.handleBatchDataEvent(search, event);

        case 'END':
          console.log(`[ExecutionManager] SSE stream ended for: ${search.title}`);
          return { ...search, isLoading: false, isStreaming: false };

        case 'ERROR':
          console.error(`[ExecutionManager] SSE error for: ${search.title}`, event.error);
          return { ...search, isLoading: false, error: event.error?.message };

        default:
          return search;
      }
    })
  );
}

private handleBatchDataEvent(search: ActiveSearch, event: any): ActiveSearch {
  if (!event.data) return search;

  const batchData = event.data;
  const currentBatchData = search.batchData || [];
  const updatedBatchData = [...currentBatchData, batchData];

  console.log(`[ExecutionManager] Received batch data for: ${search.title}`);

  return {
    ...search,
    batchData: updatedBatchData,
    isLoading: false,
    totalRecords: updatedBatchData.length
  };
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

  /**
   * Update search state (delegate to state manager)
   */
  private updateSearchState(id: string, partialState: Partial<ActiveSearch>): void {
    if (this.stateManager) {
      this.stateManager.updateSearch(id, partialState);
    }
  }

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
   *
  public isExecuting(searchId: string): boolean {
    return this.activeSseSubscriptions.has(searchId);
  }* 
  
  
  public isExecuting(searchId: string): boolean {
    return this.isExecuting().has(searchId);
  }
  */
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
