import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, shareReplay, map } from 'rxjs';
import { ViewDefinition } from '../models/view-definition.model';

@Injectable({ providedIn: 'root' })
export class ViewDefinitionService {
  private http = inject(HttpClient);
  private views: WritableSignal<ViewDefinition[] | null> = signal(null);

  loadViews() {
    return this.http.get<any>('/api/getcolumns').pipe( // Uses the same endpoint
      map(response => response['views.filter'] ?? []),
      tap(data => this.views.set(data)),
      shareReplay(1)
    );
  }

  getViewsForApp(appName: string): ViewDefinition[] {
    const allViews = this.views();
    if (!allViews) return [];
    return allViews.filter(view => view.apps.includes(appName));
  }
}