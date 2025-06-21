import { Injectable, inject } from '@angular/core';
import { Observable, from, fromEvent, merge, of } from 'rxjs';
import { switchMap, concatMap, delay, map, catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { HttpClient } from '@angular/common/http';
import { ElkHit, SseDataPayload } from '../../features/search-logs/models/search.model';

/**
 * Defines the standardized shape for all events coming from an SSE stream.
 */
export interface SseEvent {
  type: 'OPEN' | 'DATA' | 'ERROR' | 'END';
  data?: SseDataPayload; 
  error?: any;
}

/**
 * Interface for the manifest file that lists mock SSE data files.
 */
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
  
  /**
   * Connects to an SSE stream for a given type ('browse' or 'error').
   * It checks the configuration and automatically decides whether to create a
   * real EventSource connection or a mocked stream from local files.
   *
   * @param type The type of stream to connect to ('browse' or 'error').
   * @param filters An object containing filter parameters to be sent to the real API.
   * @returns An Observable that emits SseEvent objects.
   */
  public connect(
    type: 'browse' | 'error',
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[],
    preFilter?: string
   ): Observable<SseEvent> {
    const useMocks = this.configService.get('useMocks');

    if (useMocks) {
      console.log(`[SseService] Mocks enabled. Creating MOCK stream for type: ${type}`);
      return this.createMockStream(type);
    }
    
    // --- Real Connection Logic with GET ---
    const apiEndpoints = this.configService.get('api');
    const baseUrl = type === 'browse' ? apiEndpoints.browseSSE : apiEndpoints.errorSSE;

    if (!baseUrl) {
      return of({ type: 'ERROR', error: { message: `Real SSE URL for '${type}' not configured.` } });
    }

    const queryParams = new URLSearchParams();
    streamFilters.forEach(f => queryParams.append(f.field, f.values.join('|')));
    if (preFilter) {
      queryParams.append('preFilter', preFilter);
    }
    // 3. Construct the final URL
    // This is a simplified version. You would also add the global filters here.
    const fullUrl = `${baseUrl}?${queryParams}`;
    
    // You could also add global filters like this:
    // const allParams = new URLSearchParams(requestPayload);
    // allParams.append('application', globalFilters.application.join('&'));
    // allParams.append('environment', globalFilters.environment);
    // const finalUrl = `${baseUrl}?${allParams.toString()}`;

    return this.createRealStream(fullUrl);
  }

  /**
   * Creates an Observable that wraps a real browser EventSource connection.
   * @param url The full URL to the SSE endpoint.
   */
  private createRealStream(url: string): Observable<SseEvent> {
    return new Observable(observer => {
      console.log(`[SseService] Creating real EventSource connection to: ${url}`);
      const eventSource = new EventSource(url, { withCredentials: true });

      // Listen for the 'open' event, signaling a successful connection.
      const open$ = fromEvent(eventSource, 'open').pipe(
        map(() => ({ type: 'OPEN' } as SseEvent))
      );
      
      // Listen for 'pushData' events, which contain our data chunks.
      const data$ = fromEvent<MessageEvent>(eventSource, 'pushData').pipe(
        map(event => ({ type: 'DATA', data: { hits: JSON.parse(event.data), total: event.data.length } as SseDataPayload } as SseEvent))
      );

      // Listen for the 'endData' event, signaling the end of the stream.
      const end$ = fromEvent(eventSource, 'endData').pipe(
        map(() => ({ type: 'END' } as SseEvent))
      );
      
      // Handle terminal errors on the EventSource connection.
      eventSource.onerror = (err) => {
        observer.next({ type: 'ERROR', error: err });
        observer.complete(); // End the stream on error.
        eventSource.close();
      };
      
      // Merge all event types into a single stream.
      const subscription = merge(open$, data$, end$).subscribe(observer);
      
      // Return the teardown logic that will be called on unsubscription.
      return () => {
        subscription.unsubscribe();
        if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
        console.log(`[SseService] Real EventSource connection to ${url} closed.`);
      };
    });
  }
  
  /**
   * Creates a fake SSE stream by reading a manifest file and then streaming
   * the contents of the listed JSON files over time.
   * @param type The type of mock stream to create ('browse' or 'error').
   */
  private createMockStream(type: 'browse' | 'error'): Observable<SseEvent> {
    const mockApiMap = this.configService.get('mockApi');
    // The key in our config that points to the manifest file.
    const mockKey = `^/streamData/${type}$`;
    const manifestUrl = mockApiMap[mockKey];

    if (!manifestUrl) {
      return of({ type: 'ERROR', error: { message: `Mock manifest URL for '${type}' not configured in env.js.` } });
    }

    // This is the RxJS chain that replays the files.
    return this.http.get<SseManifest>(manifestUrl).pipe(
      // Once the manifest is fetched, switch to the streaming logic.
      switchMap((manifest): Observable<SseEvent> => {
        if (!manifest?.files?.length) {
          console.warn(`[SseService] Mock manifest at '${manifestUrl}' is empty or invalid.`);
          return merge(of({ type: 'OPEN' }), of({ type: 'END' }));
        }

        const open$ = of({ type: 'OPEN' } as SseEvent);
        
        // Create an observable from the array of file paths in the manifest.
        const data$ = from(manifest.files).pipe(
          // Process each file URL one by one, waiting 350ms between each one to simulate a stream.
          concatMap((fileUrl: string) => of(fileUrl).pipe(delay(350))),
          // Fetch the content of the JSON file.
          concatMap((fileUrl: string) => this.http.get<SseDataPayload>(fileUrl)),
          // Map the fetched chunk of data into our standard 'DATA' event format.
          map((chunk: SseDataPayload) => ({ type: 'DATA', data: chunk } as SseEvent))
        );
        
        // Create an 'END' event that fires after all data events have been emitted.
        const end$ = of({ type: 'END' } as SseEvent).pipe(delay(350 * manifest.files.length + 500));
        
        return merge(open$, data$, end$);
      }),
      // If fetching the manifest file itself fails, catch the error and emit a proper ERROR event.
      catchError(error => {
        console.error(`[SseService] Failed to load mock manifest '${manifestUrl}'`, error);
        return of({ type: 'ERROR', error: { message: `Could not load manifest: ${manifestUrl}` } } as SseEvent);
      })
    );
  }
}