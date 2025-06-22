import { Injectable, inject, signal, WritableSignal, effect, untracked, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActiveSearch, ElkHit, SearchRequest, SearchType, SseDataPayload } from '../models/search.model';
import { SseStrategy } from '../search-strategies/sse-strategy';
import { GuidSearchStrategy } from '../search-strategies/guid-search.strategy';
import { SseService, SseEvent } from 'src/app/core/services/sse.service';
import { FiltersService } from 'src/app/core/services/filters.service';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { SearchFilterModel } from 'src/app/core/models/search-filter.model';
import { Subscription, Observable } from 'rxjs';
import { get } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class SearchOrchestratorService {
  public activeSearches: WritableSignal<ActiveSearch[]> = signal([]);
  private strategies: { [key in SearchType]?: any } = {};
  private activeSseSubscriptions: Map<string, Subscription> = new Map();
  private sseService = inject(SseService);
  private filtersService = inject(FiltersService);
  private colDefService = inject(ColumnDefinitionService);

  // Track the previous global filters to detect changes
  private previousGlobalFilters: SearchFilterModel | null = null;

  constructor() {
    this.strategies['browse'] = inject(SseStrategy);
    this.strategies['error'] = inject(SseStrategy);
    this.strategies['transaction'] = inject(GuidSearchStrategy);

    // Effect to handle global filter changes
    effect(() => {
      const currentGlobalFilters = this.filtersService.filters();
      
      if (!currentGlobalFilters) return;

      // Check if this is a real change (not initial setup)
      const hasChanged = this.previousGlobalFilters && 
        JSON.stringify(this.previousGlobalFilters) !== JSON.stringify(currentGlobalFilters);

      if (hasChanged) {
        console.log("[Orchestrator] Global filters changed. Re-triggering active streams.");
        
        untracked(() => {
          // Get all active streaming searches
          const streamingSearches = this.activeSearches().filter(s => s.isStreaming);
          
          streamingSearches.forEach(search => {
            console.log(`[Orchestrator] Re-triggering stream for: ${search.title}`);
            
            // Clear existing data and show loading state
            this.updateSearchState(search.id, { 
              data: [], 
              isLoading: true,
              aggregatedFilterValues: new Map()
            });
            
            // Re-fetch data with new global filters
            this.fetchDataFor(search);
          });
        });
      }

      this.previousGlobalFilters = { ...currentGlobalFilters };
    }, { allowSignalWrites: true });
  }

  public performSearch(request: SearchRequest): void {
    // If a streaming search of the same type already exists, close it
    if (request.type === 'browse' || request.type === 'error') {
      const existingStream = this.activeSearches().find(s => s.type === request.type);
      if (existingStream) {
        this.closeSearch(existingStream.id);
      }
    }

    // Collapse other searches
    this.activeSearches.update(searches => 
      searches.map(s => ({ ...s, isExpanded: false }))
    );

    // Initialize the new search
    const newSearch: ActiveSearch = {
      ...request,
      id: Date.now().toString(),
      isLoading: true,
      isStreaming: request.type === 'browse' || request.type === 'error',
      isExpanded: true,
      data: [],
      totalRecords: 0,
      streamFilters: [],
      aggregatedFilterValues: new Map<string, Set<any>>(),
    };
    
    this.activeSearches.update(searches => [newSearch, ...searches]);
    this.fetchDataFor(newSearch);
  }

  public fetchDataFor(search: ActiveSearch): void {
    const strategy = this.strategies[search.type];
    if (!strategy) {
      this.updateSearchState(search.id, { 
        isLoading: false, 
        error: 'No strategy found.' 
      });
      return;
    }

    if (search.isStreaming) {
      this.startSseStream(search);
    } else {
      this.fetchHttpRequest(search, strategy);
    }
  }

  private fetchHttpRequest(search: ActiveSearch, strategy: any): void {
    this.updateSearchState(search.id, { isLoading: true });
    
    const httpRequest$: Observable<any> = strategy.execute(search.query);
    
    httpRequest$.subscribe({
      next: (response) => {
        this.updateSearchState(search.id, { 
          isLoading: false, 
          data: response.hits, 
          totalRecords: response.total 
        });
      },
      error: (err) => {
        this.updateSearchState(search.id, { 
          isLoading: false, 
          error: 'API call failed.' 
        });
      }
    });
  }

  private startSseStream(search: ActiveSearch): void {
    // Always stop existing stream first
    this.stopSseStream(search.id);
    
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) {
      this.updateSearchState(search.id, { 
        isLoading: false, 
        error: 'No global filters available.' 
      });
      return;
    }

    // Ensure streaming state is set
    this.updateSearchState(search.id, { 
      isStreaming: true,
      isLoading: true
    });

    const sseObservable: Observable<SseEvent> = this.strategies[search.type]!.execute(
      { type: search.type as 'browse' | 'error' },
      globalFilters,
      search.streamFilters,
      search.preFilter
    );
      
    const subscription = sseObservable.subscribe(
      event => this.processSseEvent(search.id, event)
    );
    
    this.activeSseSubscriptions.set(search.id, subscription);
  }

  private processSseEvent(id: string, event: SseEvent): void {
    this.activeSearches.update(searches => 
      searches.map(s => {
        if (s.id !== id) return s;
        
        switch(event.type) {
          case 'OPEN':
            return { 
              ...s, 
              isLoading: true, 
              isStreaming: true,
              data: [], 
              aggregatedFilterValues: new Map() 
            };
            
          case 'DATA':
            if (!event.data) return s;
            
            const payload = event.data as SseDataPayload;
            const newHits = payload.hits ?? [];
            const currentData = s.data ?? [];
            const updatedData = [...currentData, ...newHits];
            const updatedAggregations = this.aggregateFilterValues(
              s.aggregatedFilterValues, 
              newHits, 
              s.appName
            );
            
            return { 
              ...s, 
              data: updatedData, 
              totalRecords: payload.total ?? s.totalRecords,
              aggregatedFilterValues: updatedAggregations,
              isLoading: false // Data is arriving, no longer loading
            };
            
          case 'END':
            return { 
              ...s, 
              isLoading: false, 
              isStreaming: false 
            };
            
          case 'ERROR':
            return { 
              ...s, 
              isLoading: false, 
              isStreaming: false, 
              error: event.error?.message 
            };
            
          default:
            return s;
        }
      })
    );
  }

  private aggregateFilterValues(
    currentAggregations: Map<string, Set<any>>, 
    newHits: ElkHit[], 
    appName: string
  ): Map<string, Set<any>> {
    // Create a new map to ensure immutability
    const newAggregations = new Map(currentAggregations);
    
    const filterableFields = this.colDefService.getFilterableColsFor(appName);
    if (filterableFields.length === 0) {
      return newAggregations;
    }

    newHits.forEach(hit => {
      filterableFields.forEach(col => {
        const value = get(hit._source, col.field);
        if (value !== undefined && value !== null) {
          if (!newAggregations.has(col.field)) {
            newAggregations.set(col.field, new Set());
          }
          newAggregations.get(col.field)!.add(value);
        }
      });
    });
    
    return newAggregations;
  }
  
  public stopSseStream(id: string): void {
    const subscription = this.activeSseSubscriptions.get(id);
    if (subscription) {
      subscription.unsubscribe();
      this.activeSseSubscriptions.delete(id);
      this.updateSearchState(id, { 
        isLoading: false, 
        isStreaming: false 
      });
    }
  }

  public updateSearchState(id: string, partialState: Partial<ActiveSearch>): void {
    this.activeSearches.update(searches => 
      searches.map(s => s.id === id ? { ...s, ...partialState } : s)
    );
  }

  public closeSearch(id: string): void {
    this.stopSseStream(id);
    this.activeSearches.update(searches => 
      searches.filter(s => s.id !== id)
    );
  }

  public applyStreamFilters(searchId: string, newFilters: StreamFilter[]): void {
    const currentSearch = this.activeSearches().find(s => s.id === searchId);
    if (!currentSearch) return;

    console.log(`[Orchestrator] Applying stream filters and re-fetching for: ${currentSearch.title}`);
    
    // Serialize filters for URL
    const serializedFilters = this.serializeFilters(newFilters);
    
    // Update global filters (URL)
    this.filtersService.updateFilters({ streamFilters: serializedFilters });

    // Create updated search with cleared data
    const updatedSearch: ActiveSearch = {
      ...currentSearch,
      streamFilters: newFilters,
      data: [], // Clear existing data
      aggregatedFilterValues: new Map(), // Clear aggregations
      isLoading: true,
      isStreaming: true,
    };
    
    // Update state to show skeleton
    this.updateSearchState(searchId, updatedSearch);

    // Re-fetch data with new filters
    this.fetchDataFor(updatedSearch);
  }

  private serializeFilters(filters: StreamFilter[]): string {
    if (!filters || filters.length === 0) return '';
    return filters.map(f => `${f.field}:${f.values.join('|')}`).join(',');
  }

  private deserializeFilters(filterString: string | undefined, appName: string): StreamFilter[] {
    if (!filterString || !appName) return [];

    const filterableCols = this.colDefService.getFilterableColsFor(appName);
    if (filterableCols.length === 0) return [];
    
    try {
      return filterString.split(',').map(s => {
        const [field, valuesStr] = s.split(':');
        const colDef = filterableCols.find(c => c.field === field);
        
        return {
          field: field,
          displayName: colDef?.displayName ?? field,
          values: valuesStr ? valuesStr.split('|') : []
        };
      }).filter(f => f.values.length > 0);
    } catch (e) {
      console.error("Failed to parse stream filters from URL", e);
      return [];
    }
  }
}