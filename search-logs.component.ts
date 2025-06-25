// search-logs.component.ts
import { Component, inject, effect, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { SearchOrchestratorService } from './services/search-orchestrator.service';
import { FiltersService } from 'src/app/core/services/filters.service';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { SearchResultComponent } from './components/search-result/search-result.component';
import { TransactionDetailsComponent } from './components/transaction-details/transaction-details.component';

@Component({
  selector: 'app-search-logs',
  standalone: true,
  imports: [
    CommonModule, 
    SearchBarComponent, 
    SearchResultComponent,
    TransactionDetailsComponent
  ],
  templateUrl: './search-logs.component.html',
  styleUrls: ['./search-logs.component.scss']
})
export class SearchLogsComponent {
  public searchOrchestrator = inject(SearchOrchestratorService);
  private route = inject(ActivatedRoute);
  private filtersService = inject(FiltersService);

  private routeData = toSignal(this.route.data);

  public mode: Signal<'search' | 'browse' | 'error'> = computed(() => {
    return this.routeData()?.['mode'] ?? 'search';
  });

  public orderedSearches: Signal<ActiveSearch[]> = computed(() => {
    const searches = this.searchOrchestrator.activeSearches();
    
    // Separate SSE searches (browse/error) from transaction searches
    const sseSearches = searches.filter(s => s.type === 'browse' || s.type === 'error');
    const transactionSearches = searches.filter(s => s.type === 'transaction');
    
    // Return in order: SSE first, then transactions, then others
    return [...sseSearches, ...transactionSearches];
  });

  constructor() {
    effect(() => {
      const currentMode = this.mode();
      console.log(`[SearchLogsComponent] Mode changed to: ${currentMode}. Triggering initial search.`);
      this.triggerInitialSearchForMode(currentMode);
    }, { allowSignalWrites: true });
  }

  triggerInitialSearchForMode(mode: 'browse' | 'error' | 'search'): void {
    if (mode === 'search') {
      return;
    }

    const appName = this.filtersService.filters()?.application[0] ?? 'default-app';
    const request = {
      type: mode,
      title: mode === 'browse' ? 'Live Logs (Browse)' : 'Live Logs (Errors)',
      appName: appName,
      preFilter: mode === 'error' ? 'log.level:error' : undefined
    };

    this.searchOrchestrator.performSearch(request);
  }

  handleSearch(query: string): void {
    const appName = this.filtersService.filters()?.application[0] ?? 'default-app';
    this.searchOrchestrator.performSearch({
      type: 'transaction',
      query: query,
      title: `Search Results for: ${query}`,
      appName: appName
    });
  }
}