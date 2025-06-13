import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SearchStrategy } from './search-strategy.interface';
import { SseService } from 'src/app/core/services/sse.service';

@Injectable({ providedIn: 'root' })
export class SseStrategy implements SearchStrategy {
  private sseService = inject(SseService);
  canHandle(query: string): boolean { return false; }

  execute(query: { type: 'browse' | 'error' }, preFilter?: string): Observable<any> {
    return this.sseService.connect(query.type, { preFilter });
  }
}