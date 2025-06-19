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

  constructor() {
    this.strategies['browse'] = inject(SseStrategy);
    this.strategies['error'] = inject(SseStrategy);
    this.strategies['transaction'] = inject(GuidSearchStrategy);

     const filtersService = inject(FiltersService);
  // ✨ Re-trigger streaming searches when global filters change ✨
    effect(() => {
      const filters = filtersService.filters();
      if (!filters) return;

      this.activeSearches().forEach(search => {
        if (search.isStreaming) {
          console.log(`Global filters changed. Re-triggering stream for: ${search.title}`);
          this.fetchDataFor(search); // Re-fetch data for this active stream
        }
      });
    });
  }

  public performSearch(request: SearchRequest): void {
    this.activeSearches.update(searches => searches.map(s => ({ ...s, isExpanded: false })));
    const newSearch: ActiveSearch = { ...request, id: Date.now().toString(), isLoading: true, isStreaming: request.type === 'browse' || request.type === 'error', isExpanded: true, data: [], totalRecords: 0 };
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
}