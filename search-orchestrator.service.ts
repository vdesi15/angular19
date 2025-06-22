import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { ActiveSearch, ElkHit, SearchRequest, SearchType, SseDataPayload } from '../models/search.model';
import { SseStrategy } from '../search-strategies/sse-strategy';
import { GuidSearchStrategy } from '../search-strategies/guid-search.strategy';
import { SseService, SseEvent } from 'src/app/core/services/sse.service';
import { Subscription, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SearchOrchestratorService {
  public activeSearches: WritableSignal<ActiveSearch[]> = signal([]);
  private strategies: { [key in SearchType]?: any } = {};
  private activeSseSubscriptions: Map<string, Subscription> = new Map();
  private sseService = inject(SseService);
  private filtersService = inject(FiltersService);

  constructor() {
    this.strategies['browse'] = inject(SseStrategy);
    this.strategies['error'] = inject(SseStrategy);
    this.strategies['transaction'] = inject(GuidSearchStrategy);

     // Convert the service's filter signal into an observable for advanced operations.
    const globalFilters$ = toObservable(this.searchFilterService.filters);

    // This effect now intelligently re-triggers streaming searches.
    effect(() => {
      // 1. Create a derived observable of just the parts we care about.
      const streamingTriggers$ = globalFilters$.pipe(
        // ✨ FIX 2: Safely access application[0] ✨
        map(f => ({ 
          app: f?.application?.[0], // Use optional chaining
          env: f?.environment, 
          loc: f?.location, 
          date: f?.dateRange 
        })),
        // Add a small debounce to prevent rapid-fire re-triggers
        debounceTime(50), 
        // Use deep object comparison to only fire when a value truly changes.
        distinctUntilChanged(isEqual)
      );

      // 2. Convert this derived observable back to a signal to use in the effect.
      const triggers = toSignal(streamingTriggers$);

      // 3. Reading the signal establishes the dependency for this effect.
      const currentTriggers = triggers();

      // 4. Use `untracked` to prevent a loop. This code runs only when `triggers` changes.
      untracked(() => {
        // The first run will have undefined triggers, so we guard against it.
        if (!currentTriggers || !currentTriggers.app) return;

        console.log("[Orchestrator Effect] Global filters changed. Re-triggering active streams.", currentTriggers);
        
        this.activeSearches().forEach(search => {
          if (search.isStreaming) {
            // Re-fetch data for this active stream
            this.fetchDataFor(search);
          }
        });
      });
    });
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
    this.fetchDataFor(newSearch);
  }

  public fetchDataFor(search: ActiveSearch): void {
    const strategy = this.strategies[search.type];
    if (!strategy) { this.updateSearchState(search.id, { isLoading: false, error: 'No strategy found.' }); return; }
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
    if (!globalFilters) { /* ... */ return; }

    // The strategy is a passthrough now. The real work is in the SseService.
    // The 'query' for an SSE stream is just its type.
    const sseObservable: Observable<SseEvent> = this.strategies[search.type]!.execute(
      { type: search.type as 'browse' | 'error' },
      globalFilters,
      search.streamFilters,
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
            return { ...s, data: updatedData, totalRecords: payload.total ?? s.totalRecords, updatedAggregations };
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

    newHits.forEach(hit => {      /
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

    console.log(`[Orchestrator] Applying new stream filters and re-fetching for search: ${currentSearch.title}`);

    // Create an updated search object with the new filters.
    // We also reset the data and set isLoading to true.
    const updatedSearchRequest: ActiveSearch = {
      ...currentSearch,
      streamFilters: newFilters,
      data: [], // Clear existing data
      isLoading: true,
    };
    
    // We update the state first so the UI can immediately show the skeleton loader.
    this.updateSearchState(searchId, updatedSearchRequest);

    // Now, trigger the new data fetch with the updated search object.
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
}