import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, shareReplay, map } from 'rxjs';
import { ColumnDefinition } from '../../features/search-logs/models/column-definition.model';

type ColumnDefinitionResponse = Record<string, ColumnDefinition[]>;

@Injectable({ providedIn: 'root' })
export class ColumnDefinitionService {
  private http = inject(HttpClient);
  private definitions: WritableSignal<ColumnDefinitionResponse | null> = signal(null);

  loadDefinitions() {
    return this.http.get<ColumnDefinitionResponse>('/api/getcolumns').pipe( // URL will be handled by interceptor
      tap(data => this.definitions.set(data)),
      shareReplay(1)
    );
  }

  getColumnsFor(appName: string, viewType: 'browse' | 'error'): ColumnDefinition[] {
    const key = `${appName}.${viewType}columns`;
    const allDefs = this.definitions();
    return allDefs ? (allDefs[key] ?? []) : [];
  }
}