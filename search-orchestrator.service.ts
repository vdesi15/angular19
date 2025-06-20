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

     const filtersService = inject(FiltersService);
     effect(() => {
      // 1. Create a signal of just the global filters that matter for streaming.
      const streamingFilters = toSignal(
        this.searchFilterService.filters$.pipe(
          map(f => ({ app: f?.application[0], env: f?.environment, loc: f?.location, date: f?.dateRange })),
          // `isEqual` from lodash provides a deep object comparison.
          // This ensures the stream only re-triggers when a value *actually* changes.
          distinctUntilChanged(isEqual)
        )
      );

      // 2. Read the signal to establish dependency.
      const filters = streamingFilters();

      // 3. We are outside the initial creation, so we can untrack to prevent loops.
      untracked(() => {
        if (!filters || !filters.app) return; // Don't do anything if filters aren't ready

        console.log("[Orchestrator Effect] Global filters changed. Re-triggering active streams.");
        
        // Re-fetch data for any active streaming search
        this.activeSearches().forEach(search => {
          if (search.isStreaming) {
            this.fetchDataFor(search);
          }
        });
      });
    });
  }

  public performSearch(request: SearchRequest): void {
    this.activeSearches.update(searches => searches.map(s => ({ ...s, isExpanded: false })));
    const initialStreamFilters = this.deserializeFilters(this.filtersService.filters()?.streamFilters,request.appName);
    const newSearch: ActiveSearch = { ...request, streamFilters: initialStreamFilters, id: Date.now().toString(), isLoading: true, isStreaming: request.type === 'browse' || request.type === 'error', isExpanded: true, data: [], totalRecords: 0 };
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
    if (!globalFilters) {
      this.updateSearchState(search.id, { isLoading: false, error: 'Global filters not available.' });
      return;
    }

    const sseObservable: Observable<SseEvent> = this.sseService.connect(
      search.type as 'browse' | 'error', 
      globalFilters,
      search.streamFilters
    );
    const sseObservable: Observable<SseEvent> = this.strategies[search.type]!.execute({ type: search.type }, search.preFilter);
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
            return { ...s, data: updatedData, totalRecords: payload.total ?? s.totalRecords };
          case 'END':
          case 'ERROR': return { ...s, isLoading: false, isStreaming: false, error: event.error?.message };
          default: return s;
        }
      })
    );
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

  /**
   * Called by the UI when the user applies new stream filters.
   */
  public applyStreamFilters(searchId: string, newFilters: StreamFilter[]): void {
    const serializedFilters = this.serializeFilters(newFilters);
    this.updateSearchState(searchId, { streamFilters: newFilters });
    this.searchFilterService.updateFilters({ streamFilters: serializedFilters });
    
    // Manually re-trigger the data fetch for this specific search.
    const currentSearch = this.activeSearches().find(s => s.id === searchId);
    if (currentSearch) {
      this.fetchDataFor(currentSearch);
    }
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