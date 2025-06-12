import { HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, of, merge } from 'rxjs';
import { switchMap, concatMap, delay, map, scan, catchError } from 'rxjs/operators';
import { ConfigService } from '../services/config.service';
import { SseEvent } from '../services/sse.service';
import { ElkHit } from '../../features/search-logs/models/search.model';

interface SseManifest {
  files: string[];
  totalRecords: number;
}

export const sseMockInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const configService = inject(ConfigService);
  const http = inject(HttpClient);
  const useMocks = configService.get('useMocks');
  const isStreamingUrl = req.url.includes('/assets/mock-api/sse-');

  if (!useMocks || !isStreamingUrl) return next(req);

  const manifestUrl = req.url;

  return http.get<SseManifest>(manifestUrl).pipe(
    switchMap(manifest => {
      if (!manifest?.files?.length) {
        return from([
          { type: 'OPEN' },
          { type: 'END' }
        ] as SseEvent[]);
      }

      return from(manifest.files).pipe(
        concatMap(fileUrl => of(fileUrl).pipe(delay(250))),
        concatMap(fileUrl => http.get<ElkHit[]>(fileUrl)),
        // ✨ `scan` now concatenates the new chunk of hits with the accumulated array ✨
        scan((acc: ElkHit[], currentChunk: ElkHit[]) => [...acc, ...currentChunk], [] as ElkHit[]),
        map(accumulatedHits => {
          // Each emission contains the *entire accumulated list* so far.
          return {
            type: 'DATA',
            data: accumulatedHits,
            // We can add the total from the manifest to the event payload.
            total: manifest.totalRecords 
          } as SseEvent;
        })
      );
    }),
    (stream$) => merge(
      of({ type: 'OPEN' } as SseEvent),
      stream$,
      of({ type: 'END' } as SseEvent)
    ),
    catchError(error => of({ type: 'ERROR', error: { message: `Could not load manifest: ${manifestUrl}` } } as SseEvent))
  );
};
