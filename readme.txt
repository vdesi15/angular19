import { Injectable, inject, signal, WritableSignal } from '@angular/core';
// ... other imports

export interface ActiveSearch extends SearchRequest {
  // ... other properties
  data: ElkHit[];
  version: number; // ✨ Add a version number to the state object
}

@Injectable({ providedIn: 'root' })
export class SearchOrchestratorService {
  public activeSearches: WritableSignal<ActiveSearch[]> = signal([]);
  // ...

  public performSearch(request: SearchRequest): void {
    // ...
    const newSearch: ActiveSearch = {
      // ...
      data: [],
      version: 0, // ✨ Initialize version to 0
    };
    // ...
  }

  private processSseEvent(id: string, event: SseEvent): void {
    this.activeSearches.update(searches => 
      searches.map(s => {
        if (s.id !== id) return s;
        
        switch(event.type) {
          case 'OPEN':
            return { ...s, isLoading: true, isStreaming: true, data: [], version: s.version + 1 };
          case 'DATA':
            if (!event.data?.hits) return s;
            const newHits = event.data.hits;
            const updatedData = [...s.data, ...newHits];
            
            // ✨ THE KEY: Increment the version number with every data update!
            return { 
              ...s, 
              isLoading: false,
              data: updatedData,
              totalRecords: event.data.total ?? s.totalRecords,
              version: s.version + 1 
            };
          case 'END':
          case 'ERROR':
            return { ...s, isLoading: false, isStreaming: false, error: event.error?.message, version: s.version + 1 };
          default:
            return s;
        }
      })
    );
  }

  // ... rest of service
}