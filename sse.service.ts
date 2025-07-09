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

  public connectBatch(
    batchId: string,
    globalFilters: SearchFilterModel,
    days: string = '7'
  ): Observable<any> {
    const useMocks = this.configService.get('useMocks');

    if (useMocks) {
      return this.createMockBatchStream(batchId);
    }

    // Real batch SSE connection
    const baseApi = this.configService.get('api.baseUrl');
    const env = globalFilters.environment || 'prod';
    const location = globalFilters.location || 'us-east-1';
    
    // <baseapi>/getsummary/v2/flat/<env>/<location>/<days>/<batchid>
    const url = `${baseApi}/getsummary/v2/flat/${env}/${location}/${days}/${batchId}`;
    
    return this.createBatchRealStream(url);
  }

  private createBatchRealStream(url: string): Observable<any> {
    return new Observable(observer => {
      console.log(`[SseService] Creating batch EventSource connection to: ${url}`);
      
      const eventSource = new EventSource(url, { withCredentials: true });

      const open$ = fromEvent(eventSource, 'open').pipe(
        map(() => ({ type: 'OPEN' }))
      );
      
      // Listen for PushBatchData events
      const data$ = fromEvent<MessageEvent>(eventSource, 'PushBatchData').pipe(
        map(event => {
          try {
            const data = JSON.parse(event.data) as BatchSSEData;
            return { 
              type: 'BATCH_DATA', 
              data: data
            };
          } catch (e) {
            console.error('[SseService] Failed to parse batch data:', e);
            return { 
              type: 'ERROR', 
              error: { message: 'Failed to parse batch data' } 
            };
          }
        })
      );

      const end$ = fromEvent(eventSource, 'endData').pipe(
        map(() => ({ type: 'END' }))
      );
      
      eventSource.onerror = (err) => {
        console.error('[SseService] Batch EventSource error:', err);
        observer.next({ type: 'ERROR', error: { message: 'Connection error' } });
        observer.complete();
        eventSource.close();
      };
      
      const subscription = merge(open$, data$, end$).subscribe(observer);
      
      return () => {
        console.log('[SseService] Cleaning up batch EventSource connection');
        subscription.unsubscribe();
        if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
      };
    });
  }

  private createMockBatchStream(batchId: string): Observable<any> {
    // Mock implementation - return sample batch data
    const mockData: BatchSSEData = {
      api_txnid: 'txn-' + Math.random().toString(36).substr(2, 9),
      time: new Date().toISOString(),
      e_name: 'NA',
      agg: [
        {
          time: new Date().toISOString(),
          type: 'U',
          agg_total_d: 212312,
          agg_total_g: 'AL=324,Added=213',
          agg_total_ud: 'na',
          agg_total_rj: 'na',
          agg_ld: '6|asd|213,3|ert|435,2|rt|123'
        },
        {
          time: new Date().toISOString(),
          type: 'M',
          agg_total_d: 212312,
          agg_total_g: 32423,
          agg_total_ud: 0,
          agg_total_rj: 0,
          agg_ld: '6| |213,3| |435,2| |123'
        }
      ],
      summary: [
        {
          type: 'U',
          time: new Date().toISOString(),
          id: 'u1',
          sid: '2',
          front_id: 'na',
          total_d: '21312',
          usummary: 'na',
          dsummary: '6|asd|213,3|ert|435,2|rt|123',
          gd: '231',
          status: '',
          blist: { '2': 213, '4': 123 }
        }
      ],
      api_name: 'MockAPI',
      v_line: 'v1',
      min: 'true',
      txn_status: true,
      all_rules_passed: true,
      good_u: 213,
      good_m: 213,
      dl_enable: true,
      rules: [
        {
          name: 'r1',
          pass: true,
          message: 'Rule passed successfully'
        }
      ]
    };

    return merge(
      of({ type: 'OPEN' }),
      of({ type: 'BATCH_DATA', data: mockData }).pipe(delay(500)),
      of({ type: 'END' }).pipe(delay(1000))
    );
  }
}