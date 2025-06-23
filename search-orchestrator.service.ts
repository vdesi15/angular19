import { Injectable, inject, signal, WritableSignal, effect, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActiveSearch, ElkHit, SearchRequest, SearchType, SseDataPayload } from '../models/search.model';
import { TransactionDetailsSearch, TransactionDetailsRequest } from 'src/app/core/models/transaction-details.model';
import { SseStrategy } from '../search-strategies/sse-strategy';
import { GuidSearchStrategy } from '../search-strategies/guid-search.strategy';
import { TransactionDetailsStrategy } from '../search-strategies/transaction-details.strategy';
import { SseService, SseEvent } from 'src/app/core/services/sse.service';
import { FiltersService } from 'src/app/core/services/filters.service';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { SearchHistoryService } from 'src/app/core/services/search-history.service';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { SearchFilterModel } from 'src/app/core/models/search-filter.model';
import { Subscription, Observable } from 'rxjs';
import { get } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class SearchOrchestratorService {
  public activeSearches: WritableSignal<ActiveSearch[]> = signal([]);
  public activeTransactionDetails: WritableSignal<TransactionDetailsSearch[]> = signal([]);
  
  private strategies: { [key in SearchType]?: any } = {};
  private activeSseSubscriptions: Map<string, Subscription> = new Map();
  
  private sseService = inject(SseService);
  private filtersService = inject(FiltersService);
  private colDefService = inject(ColumnDefinitionService);
  private searchHistoryService = inject(SearchHistoryService);

  constructor() {
    this.strategies['browse'] = inject(SseStrategy);
    this.strategies['error'] = inject(SseStrategy);
    this.strategies['transaction'] = inject(GuidSearchStrategy);

     effect(() => {
    const currentGlobalFilters = this.filtersService.filters();
    
    console.log(`[Orchestrator Effect] Filters changed:`, currentGlobalFilters);
    
    // Guard against running during initial setup
    if (!currentGlobalFilters) {
      console.log('[Orchestrator Effect] No filters yet, skipping');
      return;
    }

    // ✨ FIXED: Use untracked to prevent this effect from re-running when we update search state
    untracked(() => {
      console.log("[Orchestrator Effect] Global filters changed. Re-triggering ALL active searches.");
      
      // ✨ FIXED: Re-trigger ALL active searches, not just streaming ones
      const activeSearches = this.activeSearches();
      
      if (activeSearches.length === 0) {
        console.log('[Orchestrator Effect] No active searches to re-trigger');
        return;
      }
      
      activeSearches.forEach(search => {
        console.log(`[Orchestrator] Re-triggering search: ${search.title} (type: ${search.type})`);
        
        // ✨ FIXED: Clear data and show loading state immediately
        this.updateSearchState(search.id, {
          isLoading: true,
          data: [],
          error: undefined,
          totalRecords: 0,
          aggregatedFilterValues: new Map() // Clear filter aggregations too
        });
        
        // ✨ FIXED: Then fetch new data
        this.fetchDataFor(search);
      });
    });
  }, { allowSignalWrites: true });
  }

  public performSearch(request: SearchRequest): void {
    // If a streaming search of the same type already exists, close it before starting a new one.
    if (request.type === 'browse' || request.type === 'error') {
        const existingStream = this.activeSearches().find(s => s.type === request.type);
        if (existingStream) {
            this.closeSearch(existingStream.id);
        }
    }
    // Collapse others
    this.activeSearches.update(searches => searches.map(s => ({ ...s, isExpanded: false })));

    // Initialize the state for the new search
    const newSearch: ActiveSearch = {
      ...request,
      id: Date.now().toString(),
      isLoading: true,
      isStreaming: request.type === 'browse' || request.type === 'error',
      isExpanded: true,
      data: [],
      totalRecords: 0,
      streamFilters: [], // Always start with no filters
      aggregatedFilterValues: new Map<string, Set<any>>(),
    };
    
    this.activeSearches.update(searches => [newSearch, ...searches]);
    
    // Save to search history
    this.saveSearchToHistory(newSearch);
    
    this.fetchDataFor(newSearch);
  }

  public fetchDataFor(search: ActiveSearch): void {
    this.updateSearchState(search.id, { isLoading: true, data: [], error: undefined });
    const strategy = this.strategies[search.type];
    if (!strategy) { 
      this.updateSearchState(search.id, { isLoading: false, error: 'No strategy found.' }); 
      return; 
    }
    if (search.isStreaming) this.startSseStream(search);
    else this.fetchHttpRequest(search, strategy);
  }

  private fetchHttpRequest(search: ActiveSearch, strategy: any): void {
    this.updateSearchState(search.id, { isLoading: true });
    const httpRequest$: Observable<any> = strategy.execute(search.query);
    httpRequest$.subscribe({
      next: (response) => this.updateSearchState(search.id, { isLoading: false, data: response.hits, totalRecords: response.total }),
      error: (err) => this.updateSearchState(search.id, { isLoading: false, error: 'API call failed.' })
    });
  }

  private startSseStream(search: ActiveSearch): void {
    this.stopSseStream(search.id);
    
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) { 
      this.updateSearchState(search.id, { isLoading: false, error: 'Global filters not available.' });
      return; 
    }

    // The strategy is a passthrough now. The real work is in the SseService.
    // The 'query' for an SSE stream is just its type.
    const sseObservable: Observable<SseEvent> = this.strategies[search.type]!.execute(
      { type: search.type as 'browse' | 'error' },
      globalFilters,
      search.streamFilters || [], // ✨ Fix: Provide empty array if undefined
      search.preFilter // ✨ The preFilter is now correctly passed
    );
      
    const subscription = sseObservable.subscribe(event => this.processSseEvent(search.id, event));
    this.activeSseSubscriptions.set(search.id, subscription);
  }

  private processSseEvent(id: string, event: SseEvent): void {
    this.activeSearches.update(searches => 
      searches.map(s => {
        if (s.id !== id) return s;
        switch(event.type) {
          case 'OPEN': return { ...s, isLoading: true, data: [] };
          case 'DATA':
            if (!event.data) return s;  
            const payload = event.data as SseDataPayload;
            const newHits = payload.hits ?? [];
            const currentData = s.data ?? [];
            const updatedData = [...currentData, ...newHits];
            const updatedAggregations = this.aggregateFilterValues(s.aggregatedFilterValues, newHits, s.appName);
            return { ...s, data: updatedData, isLoading: false, totalRecords: payload.total ?? s.totalRecords, aggregatedFilterValues: updatedAggregations };
          case 'END':
          case 'ERROR': return { ...s, isLoading: false, isStreaming: false, error: event.error?.message };
          default: return s;
        }
      })
    );
  }

  /**
   * Processes a chunk of new hits and updates the aggregation map.
   * @param currentAggregations The existing map of unique values.
   * @param newHits The new chunk of data from the SSE event.
   * @param appName The current application context to get the correct filterable fields.
   * @returns The updated map.
   */
  private aggregateFilterValues(currentAggregations: Map<string, Set<any>>, newHits: ElkHit[], appName: string): Map<string, Set<any>> {
    const filterableFields = this.colDefService.getFilterableColsFor(appName);
    if (filterableFields.length === 0) {
      return currentAggregations; // No filterable fields defined for this app
    }

    newHits.forEach(hit => {
      filterableFields.forEach(col => {        
        const value = get(hit._source, col.field);       
        if (value !== undefined && value !== null) {
          if (!currentAggregations.has(col.field)) {
            currentAggregations.set(col.field, new Set());
          }
          currentAggregations.get(col.field)!.add(value);
        }
      });
    });
    
    return currentAggregations;
  }
  
  public stopSseStream(id: string): void {
    if (this.activeSseSubscriptions.has(id)) {
      this.activeSseSubscriptions.get(id)?.unsubscribe();
      this.activeSseSubscriptions.delete(id);
      this.updateSearchState(id, { isLoading: false, isStreaming: false });
    }
  }

  public updateSearchState(id: string, partialState: Partial<ActiveSearch>): void {
    this.activeSearches.update(searches => searches.map(s => s.id === id ? { ...s, ...partialState } : s));
  }

  public closeSearch(id: string): void {
    this.stopSseStream(id);
    this.activeSearches.update(searches => searches.filter(s => s.id !== id));
  }

  public applyStreamFilters(searchId: string, newFilters: StreamFilter[]): void {
    const currentSearch = this.activeSearches().find(s => s.id === searchId);
    if (!currentSearch) return;

    console.log(`[Orchestrator] Applying new stream filters and re-fetching for: ${currentSearch.title}`);
    
    // 1. Serialize the filters for the URL
    const serializedFilters = this.serializeFilters(newFilters); // ✨ Fix: newFilters is guaranteed to be StreamFilter[]
    
    // 2. Tell the global filter service to update the URL
    this.filtersService.updateFilters({ streamFilters: serializedFilters });

    // 3. Create the updated search state for our local signal
    const updatedSearchRequest: ActiveSearch = {
      ...currentSearch,
      streamFilters: newFilters,
      data: [], 
      isLoading: true, // This will show the skeleton
      isStreaming: true, // This will show the streaming button
    };
    
    // 4. Update our local state so the UI shows the skeleton loader
    this.updateSearchState(searchId, updatedSearchRequest);

    // 5. Update search history with new filters
    this.updateSearchInHistory(updatedSearchRequest);

    // 6. Trigger the new data fetch with the updated search object
    this.fetchDataFor(updatedSearchRequest);
  }

  // --- SERIALIZATION LOGIC (Now Robust) ---

  private serializeFilters(filters: StreamFilter[]): string {
    if (!filters || filters.length === 0) return '';
    return filters.map(f => `${f.field}:${f.values.join('|')}`).join(',');
  }

  /**
   * ✨ THE ROBUST DESERIALIZER ✨
   * Deserializes the filter string from the URL and enriches it with the
   * correct `displayName` from the ColumnDefinitionService.
   */
  private deserializeFilters(filterString: string | undefined, appName: string): StreamFilter[] {
    if (!filterString || !appName) return [];

    // Get all possible filterable columns for this app to use as a lookup table.
    const filterableCols = this.colDefService.getFilterableColsFor(appName);
    if (filterableCols.length === 0) return [];
    
    try {
      return filterString.split(',').map(s => {
        const [field, valuesStr] = s.split(':');
        
        // Find the corresponding column definition to get the displayName
        const colDef = filterableCols.find(c => c.field === field);
        
        const filter: StreamFilter = { 
          field: field,
          // Use the found displayName, or fall back to the field name if not found.
          displayName: colDef?.displayName ?? field,
          values: valuesStr ? valuesStr.split('|') : []
        };
        return filter;
      }).filter(f => f.values.length > 0); // Ensure we don't create filters with no values
    } catch (e) {
      console.error("Failed to parse stream filters from URL", e);
      return [];
    }
  }

  // --- SEARCH HISTORY MANAGEMENT ---

  private saveSearchToHistory(search: ActiveSearch): void {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) return;

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
  }

  private updateSearchInHistory(search: ActiveSearch): void {
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
  }

  // --- PUBLIC METHODS FOR FAVORITES ---

  public executeSearchFromHistory(savedSearch: any): void {
    // Restore global filters
    this.filtersService.updateFilters(savedSearch.globalFilters);

    // Create and execute the search request
    const request: SearchRequest = {
      type: savedSearch.type,
      title: savedSearch.title,
      appName: savedSearch.appName,
      query: savedSearch.query,
      preFilter: savedSearch.preFilter
    };

    // Wait a tick for global filters to update, then perform search
    setTimeout(() => {
      this.performSearch(request);
      
      // If there are stream filters, apply them after the search starts
      if (savedSearch.streamFilters && savedSearch.streamFilters.length > 0) {
        setTimeout(() => {
          const activeSearch = this.activeSearches().find(s => s.type === savedSearch.type);
          if (activeSearch) {
            this.applyStreamFilters(activeSearch.id, savedSearch.streamFilters);
          }
        }, 100);
      }
    }, 50);
  }

  // --- TRANSACTION DETAILS METHODS ---

  /**
   * Open transaction details for a given transaction ID
   */
  public openTransactionDetails(transactionId: string, parentSearchId?: string): void {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) {
      console.error('[Orchestrator] Cannot open transaction details - global filters not available');
      return;
    }

    // Check if transaction details already open for this ID
    const existing = this.activeTransactionDetails().find(td => 
      td.transactionId === transactionId && 
      td.appName === globalFilters.application[0] &&
      td.environment === globalFilters.environment &&
      td.location === globalFilters.location
    );

    if (existing) {
      // Just expand the existing one
      this.updateTransactionDetailsState(existing.id, { isExpanded: true });
      return;
    }

    // Collapse all other accordion panels
    this.activeSearches.update(searches => searches.map(s => ({ ...s, isExpanded: false })));
    this.activeTransactionDetails.update(details => details.map(d => ({ ...d, isExpanded: false })));

    // Create new transaction details search
    const newTransactionDetails: TransactionDetailsSearch = {
      id: `txn-${Date.now()}`,
      type: 'transactionDetails',
      title: this.transactionDetailsStrategy.buildDisplayTitle(transactionId),
      transactionId,
      appName: globalFilters.application[0],
      environment: globalFilters.environment,
      location: globalFilters.location,
      isLoading: true,
      isExpanded: true,
      data: null,
      parentSearchId
    };

    // Add to active transaction details
    this.activeTransactionDetails.update(details => [newTransactionDetails, ...details]);

    // Fetch the data
    this.fetchTransactionDetails(newTransactionDetails.id);
  }

  /**
   * Fetch transaction details data
   */
  private fetchTransactionDetails(searchId: string): void {
    const search = this.activeTransactionDetails().find(s => s.id === searchId);
    if (!search) return;

    const request: TransactionDetailsRequest = {
      transactionId: search.transactionId,
      appName: search.appName,
      environment: search.environment,
      location: search.location
    };

    this.updateTransactionDetailsState(searchId, { isLoading: true, error: undefined });

    this.transactionDetailsStrategy.execute(request).subscribe({
      next: (response) => {
        console.log(`[Orchestrator] Transaction details loaded for ${search.transactionId}:`, response);
        this.updateTransactionDetailsState(searchId, { 
          isLoading: false, 
          data: response 
        });
      },
      error: (error) => {
        console.error(`[Orchestrator] Failed to load transaction details for ${search.transactionId}:`, error);
        this.updateTransactionDetailsState(searchId, { 
          isLoading: false, 
          error: error.message || 'Failed to load transaction details' 
        });
      }
    });
  }

  /**
   * Update transaction details state
   */
  public updateTransactionDetailsState(id: string, partialState: Partial<TransactionDetailsSearch>): void {
    this.activeTransactionDetails.update(details => 
      details.map(d => d.id === id ? { ...d, ...partialState } : d)
    );
  }

  /**
   * Close transaction details
   */
  public closeTransactionDetails(id: string): void {
    this.activeTransactionDetails.update(details => 
      details.filter(d => d.id !== id)
    );
  }

  /**
   * Retry loading transaction details
   */
  public retryTransactionDetails(id: string): void {
    this.fetchTransactionDetails(id);
  }

  // --- SEARCH HISTORY MANAGEMENT ---

  private saveSearchToHistory(search: ActiveSearch): void {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) return;

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
  }

  private updateSearchInHistory(search: ActiveSearch): void {
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
  }

  // --- PUBLIC METHODS FOR FAVORITES ---

  public executeSearchFromHistory(savedSearch: any): void {
    // Restore global filters
    this.filtersService.updateFilters(savedSearch.globalFilters);

    // Create and execute the search request
    const request: SearchRequest = {
      type: savedSearch.type,
      title: savedSearch.title,
      appName: savedSearch.appName,
      query: savedSearch.query,
      preFilter: savedSearch.preFilter
    };

    // Wait a tick for global filters to update, then perform search
    setTimeout(() => {
      this.performSearch(request);
      
      // If there are stream filters, apply them after the search starts
      if (savedSearch.streamFilters && savedSearch.streamFilters.length > 0) {
        setTimeout(() => {
          const activeSearch = this.activeSearches().find(s => s.type === savedSearch.type);
          if (activeSearch) {
            this.applyStreamFilters(activeSearch.id, savedSearch.streamFilters);
          }
        }, 100);
      }
    }, 50);
  }
}