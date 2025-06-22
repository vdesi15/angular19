import { Injectable, inject } from '@angular/core';
import { Observable, from, fromEvent, merge, of } from 'rxjs';
import { switchMap, concatMap, delay, map, catchError, scan } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { HttpClient } from '@angular/common/http';
import { ElkHit, SseDataPayload } from '../../features/search-logs/models/search.model';
import { SearchFilterModel } from '../models/search-filter.model';
import { StreamFilter } from '../models/stream-filter.model';

export interface SseEvent {
  type: 'OPEN' | 'DATA' | 'ERROR' | 'END';
  data?: SseDataPayload; 
  error?: any;
}

interface SseManifest {
  files: string[];
  totalRecords: number;
}

@Injectable({
  providedIn: 'root'
})
export class SseService {
  private configService = inject(ConfigService);
  private http = inject(HttpClient);
  
  public connect(
    type: 'browse' | 'error',
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[],
    preFilter?: string
  ): Observable<SseEvent> {
    const useMocks = this.configService.get('useMocks');

    if (useMocks) {
      console.log(`[SseService] Mocks enabled. Creating MOCK stream for type: ${type}`);
      return this.createMockStream(type, streamFilters);
    }
    
    // Real Connection Logic
    const apiEndpoints = this.configService.get('api');
    const baseUrl = type === 'browse' ? apiEndpoints.browseSSE : apiEndpoints.errorSSE;

    if (!baseUrl) {
      return of({ type: 'ERROR', error: { message: `Real SSE URL for '${type}' not configured.` } });
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add global filters
    if (globalFilters.application?.length) {
      queryParams.append('applications', globalFilters.application.join(','));
    }
    if (globalFilters.environment) {
      queryParams.append('environment', globalFilters.environment);
    }
    if (globalFilters.location) {
      queryParams.append('location', globalFilters.location);
    }
    if (globalFilters.dateRange) {
      // Add date range parameters based on your API requirements
      const dr = globalFilters.dateRange;
      if (dr.isAbsolute) {
        queryParams.append('startDate', dr.startDate.toISOString());
        queryParams.append('endDate', dr.endDate.toISOString());
      } else {
        queryParams.append('relativeValue', dr.relativeValue?.toString() ?? '');
        queryParams.append('relativeUnit', dr.relativeUnit ?? '');
      }
    }
    
    // Add stream filters
    streamFilters.forEach(filter => {
      queryParams.append(`filter.${filter.field}`, filter.values.join('|'));
    });
    
    // Add pre-filter if provided
    if (preFilter) {
      queryParams.append('preFilter', preFilter);
    }

    const fullUrl = `${baseUrl}?${queryParams.toString()}`;
    
    return this.createRealStream(fullUrl);
  }

  private createRealStream(url: string): Observable<SseEvent> {
    return new Observable(observer => {
      console.log(`[SseService] Creating new EventSource connection to: ${url}`);
      
      const eventSource = new EventSource(url, { withCredentials: true });

      // Track connection state
      let hasReceivedData = false;

      const open$ = fromEvent(eventSource, 'open').pipe(
        map(() => {
          console.log('[SseService] EventSource connection opened');
          return { type: 'OPEN' } as SseEvent;
        })
      );
      
      const data$ = fromEvent<MessageEvent>(eventSource, 'pushData').pipe(
        map(event => {
          hasReceivedData = true;
          try {
            const data = JSON.parse(event.data);
            return { 
              type: 'DATA', 
              data: { 
                hits: data.hits || data, 
                total: data.total || 0 
              } as SseDataPayload 
            } as SseEvent;
          } catch (e) {
            console.error('[SseService] Failed to parse SSE data:', e);
            return { 
              type: 'ERROR', 
              error: { message: 'Failed to parse data' } 
            } as SseEvent;
          }
        })
      );

      const end$ = fromEvent(eventSource, 'endData').pipe(
        map(() => {
          console.log('[SseService] Received endData event');
          return { type: 'END' } as SseEvent;
        })
      );
      
      eventSource.onerror = (err) => {
        console.error('[SseService] EventSource error:', err);
        observer.next({ type: 'ERROR', error: { message: 'Connection error' } });
        observer.complete();
        eventSource.close();
      };
      
      const subscription = merge(open$, data$, end$).subscribe(observer);
      
      return () => {
        console.log('[SseService] Cleaning up EventSource connection');
        subscription.unsubscribe();
        if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
      };
    });
  }
  
  private createMockStream(type: 'browse' | 'error', streamFilters: StreamFilter[]): Observable<SseEvent> {
    const mockApiMap = this.configService.get('mockApi');
    const mockKey = `^/streamData/${type}$`;
    const manifestUrl = mockApiMap[mockKey];

    if (!manifestUrl) {
      return of({ type: 'ERROR', error: { message: `Mock manifest URL for '${type}' not configured.` } });
    }

    return this.http.get<SseManifest>(manifestUrl).pipe(
      switchMap((manifest): Observable<SseEvent> => {
        if (!manifest?.files?.length) {
          console.warn(`[SseService] Mock manifest at '${manifestUrl}' is empty or invalid.`);
          return merge(of({ type: 'OPEN' }), of({ type: 'END' }));
        }

        const open$ = of({ type: 'OPEN' } as SseEvent);
        
        // Accumulate data to simulate streaming
        const data$ = from(manifest.files).pipe(
          concatMap((fileUrl: string) => of(fileUrl).pipe(delay(350))),
          concatMap((fileUrl: string) => this.http.get<ElkHit[]>(fileUrl)),
          scan((acc: ElkHit[], currentChunk: ElkHit[]) => {
            // Apply stream filters if any
            let filteredChunk = currentChunk;
            if (streamFilters.length > 0) {
              filteredChunk = currentChunk.filter(hit => {
                return streamFilters.every(filter => {
                  const value = this.getNestedValue(hit._source, filter.field);
                  return filter.values.includes(String(value));
                });
              });
            }
            return [...acc, ...filteredChunk];
          }, [] as ElkHit[]),
          map(accumulatedHits => ({
            type: 'DATA',
            data: {
              hits: accumulatedHits,
              total: manifest.totalRecords
            } as SseDataPayload
          } as SseEvent))
        );
        
        const end$ = of({ type: 'END' } as SseEvent).pipe(
          delay(350 * manifest.files.length + 500)
        );
        
        return merge(open$, data$, end$);
      }),
      catchError(error => {
        console.error(`[SseService] Failed to load mock manifest '${manifestUrl}'`, error);
        return of({ type: 'ERROR', error: { message: `Could not load manifest: ${manifestUrl}` } } as SseEvent);
      })
    );
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}