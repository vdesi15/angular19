import { Injectable, inject } from '@angular/core';
import { Observable, fromEvent, merge, of } from 'rxjs';
import { map, catchError, switchMap, from, concatMap, delay } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { HttpClient } from '@angular/common/http';
import { ElkHit } from '../../features/search-logs/models/search.model';

export interface SseEvent {
  type: 'OPEN' | 'DATA' | 'ERROR' | 'END';
  data?: ElkHit[]; 
  error?: any;
}

interface SseManifest {
  files: string[];
}

@Injectable({ providedIn: 'root' })
export class SseService {
  private configService = inject(ConfigService);
  private http = inject(HttpClient);
  
  connect(type: 'browse' | 'error', filters: any): Observable<SseEvent> {
    const useMocks = this.configService.get('useMocks');

    if (useMocks) {
      return this.createMockStream(type);
    }
    
    const sseEndpoints = this.configService.get('api');
    const url = type === 'browse' ? sseEndpoints.browseSSE : sseEndpoints.errorSSE;
    if (!url) {
      return of({ type: 'ERROR', error: { message: `Real SSE URL for '${type}' not configured.` } });
    }
    // Append filters to URL as query params...
    return this.createRealStream(url);
  }

  private createRealStream(url: string): Observable<SseEvent> {
    return new Observable(observer => {
      const eventSource = new EventSource(url, { withCredentials: true });
      const open$ = fromEvent(eventSource, 'open').pipe(map(() => ({ type: 'OPEN' } as SseEvent)));
      const data$ = fromEvent<MessageEvent>(eventSource, 'pushData').pipe(map(event => ({ type: 'DATA', data: JSON.parse(event.data) as ElkHit[] } as SseEvent)));
      const end$ = fromEvent(eventSource, 'endData').pipe(map(() => ({ type: 'END' } as SseEvent)));
      eventSource.onerror = (err) => observer.error({ type: 'ERROR', error: err });
      const subscription = merge(open$, data$, end$).subscribe(observer);
      return () => {
        subscription.unsubscribe();
        if (eventSource.readyState !== EventSource.CLOSED) eventSource.close();
      };
    });
  }
  
  private createMockStream(type: 'browse' | 'error'): Observable<SseEvent> {
    const mockApiMap = this.configService.get('mockApi');
    const mockKey = `^/streamData/${type}$`;
    const manifestUrl = mockApiMap[mockKey];
    if (!manifestUrl) {
      return of({ type: 'ERROR', error: { message: `Mock manifest URL for '${type}' not configured.` } });
    }

    return this.http.get<SseManifest>(manifestUrl).pipe(
      switchMap(manifest => {
        const open$ = of({ type: 'OPEN' } as SseEvent);
        const data$ = from(manifest.files).pipe(
          concatMap(fileUrl => of(fileUrl).pipe(delay(350))),
          concatMap(fileUrl => this.http.get<ElkHit[]>(fileUrl)),
          map(chunk => ({ type: 'DATA', data: chunk } as SseEvent))
        );
        const end$ = of({ type: 'END' } as SseEvent).pipe(delay(350 * manifest.files.length + 500));
        return merge(open$, data$, end$);
      }),
      catchError(error => of({ type: 'ERROR', error: { message: `Could not load manifest: ${manifestUrl}` } } as SseEvent))
    );
  }
}