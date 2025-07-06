// ================================
// MAIN ORCHESTRATOR SERVICE (Much Smaller!)
// ================================

import { Injectable, inject, signal, WritableSignal, computed } from '@angular/core';
import { ActiveSearch, SearchRequest } from '../models/search.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';

// Composed services using composition pattern
import { SearchStrategyManager } from './managers/search-strategy.manager';
import { SearchStateManager } from './managers/search-state.manager';
import { SearchExecutionManager } from './managers/search-execution.manager';
import { SearchHistoryManager } from './managers/search-history.manager';
import { StreamFilterManager } from './managers/stream-filter.manager';

@Injectable({ providedIn: 'root' })
export class SearchOrchestratorService {
  
  // ================================
  // COMPOSITION - DELEGATE TO MANAGERS
  // ================================
  
  private strategyManager = inject(SearchStrategyManager);
  private stateManager = inject(SearchStateManager);
  private executionManager = inject(SearchExecutionManager);
  private historyManager = inject(SearchHistoryManager);
  private filterManager = inject(StreamFilterManager);

  // ================================
  // PUBLIC API - SIMPLE DELEGATION
  // ================================
  
  // State Management (delegate to StateManager)
  public readonly activeSearches = this.stateManager.activeSearches;
  public readonly isAnySearchActive = computed(() => this.activeSearches().length > 0);
  public readonly activeStreamingSearches = computed(() => 
    this.activeSearches().filter(s => s.isStreaming)
  );

  constructor() {
    // Initialize all managers
    this.setupManagers();
  }

  // ================================
  // MAIN ORCHESTRATION METHODS
  // ================================

  /**
   * Main entry point for all searches
   */
  public performSearch(request: SearchRequest): void {
    console.log('[SearchOrchestrator] Performing search:', request);

    // Use strategy manager to determine approach
    const enhancedRequest = this.strategyManager.enhanceRequest(request);
    
    // Use state manager to create and track search
    const activeSearch = this.stateManager.createActiveSearch(enhancedRequest);

    if (activeSearch.type === 'transaction') {
      activeSearch.isExpanded = true;
      // Collapse SSE searches when transaction search is added
      this.collapseSSESearches();
    }

    this.stateManager.addSearch(activeSearch);
    
    // Use history manager to save
    this.historyManager.saveSearch(activeSearch);
    
    const canExecute = await this.executionManager.canExecuteSearch(request);
    if (!canExecute) {
      console.log('[SearchOrchestrator] Search blocked by execution gating');
      return;
    }
    try {
      // Use execution manager to run the search
      this.executionManager.executeSearch(activeSearch);

      // Mark as completed
      this.executionManager.markSearchCompleted(request, result);
    }
    catch (error) {
      // Mark as completed even on error
      this.executionManager.markSearchCompleted(request, null);
      throw error;
    }
  }

  /**
   * Apply stream filters to a search
   */
  public applyStreamFilters(searchId: string, filters: StreamFilter[]): void {
    console.log('[SearchOrchestrator] Applying stream filters:', searchId, filters);
    
    const search = this.stateManager.getSearchById(searchId);
    if (!search) return;

    // Use filter manager to handle the complexity
    this.filterManager.applyFilters(search, filters);
    
    // Re-execute the search with new filters
    this.executionManager.executeSearch(search);
  }

  // ================================
  // DELEGATION METHODS
  // ================================

  // State Management
  public updateSearchState(id: string, partialState: Partial<ActiveSearch>): void {
    this.stateManager.updateSearch(id, partialState);
  }

  public closeSearch(id: string): void {
    this.executionManager.stopExecution(id);
    this.stateManager.removeSearch(id);
  }

  public clearAllSearches(): void {
    this.executionManager.stopAllExecutions();
    this.stateManager.clearAll();
  }

  // Execution Management
  public fetchDataFor(search: ActiveSearch): void {
    this.executionManager.executeSearch(search);
  }

  public stopSseStream(id: string): void {
    this.executionManager.stopSseStream(id);
  }

  // History Management
  public executeSearchFromHistory(savedSearch: any): void {
    this.historyManager.executeFromHistory(savedSearch, (request) => {
      this.performSearch(request);
    });
  }

  // Strategy Management
  public testQueryDetection(query: string): any {
    return this.strategyManager.testDetection(query);
  }

  public getAvailableStrategies(): string[] {
    return this.strategyManager.getAvailableStrategies();
  }

  // Utility
  public getSearchById(id: string): ActiveSearch | undefined {
    return this.stateManager.getSearchById(id);
  }

  public expandSearch(searchId: string): void {
    const targetSearch = this.stateManager.getSearchById(searchId);
    if (!targetSearch) return;

    // Expand the target search
    this.stateManager.updateSearch(searchId, { isExpanded: true });
    
    // If this is a transaction search triggered by drilldown, collapse SSE searches
    if (targetSearch.type === 'transaction') {
      this.collapseSSESearches();
    }
  }

  /**
   * Collapse a specific search
   */
  public collapseSearch(searchId: string): void {
    this.stateManager.updateSearch(searchId, { isExpanded: false });
  }

  /**
   * Collapse all SSE searches (browse/error) when transaction search opens
   */
  private collapseSSESearches(): void {
    const searches = this.activeSearches();
    searches.forEach(search => {
      if (search.type === 'browse' || search.type === 'error') {
        this.stateManager.updateSearch(search.id, { isExpanded: false });
      }
    });
    console.log('[SearchOrchestrator] Collapsed SSE searches for transaction drilldown');
  }

  // ================================
  // PRIVATE SETUP
  // ================================

  private setupManagers(): void {
    // Configure manager dependencies and cross-references
    this.stateManager.setExecutionManager(this.executionManager);
    this.executionManager.setStateManager(this.stateManager);
    this.filterManager.setStateManager(this.stateManager);
    this.filterManager.setExecutionManager(this.executionManager);
    
    console.log('[SearchOrchestrator] All managers initialized');
  }
}