import { Component, inject, effect, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { SearchOrchestratorService } from './services/search-orchestrator.service';
import { FiltersService } from 'src/app/core/services/filters.service';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { SearchResultComponent } from './components/search-result/search-result.component';

@Component({
  selector: 'app-search-logs',
  standalone: true,
  imports: [CommonModule, SearchBarComponent, SearchResultComponent],
  templateUrl: './search-logs.component.html',
  styleUrls: ['./search-logs.component.scss']
})
export class SearchLogsComponent {
  public searchOrchestrator = inject(SearchOrchestratorService);
  private route = inject(ActivatedRoute);
  private filtersService = inject(FiltersService);

  // ✨ STEP 1: Create a signal directly from the route's data observable. ✨
  // This signal will automatically update whenever you navigate between routes
  // that use this component (e.g., from /browse to /errors).
  private routeData = toSignal(this.route.data);

  // ✨ STEP 2: Create a computed signal for the mode. ✨
  // It derives its value from the reactive routeData signal.
  public mode: Signal<'search' | 'browse' | 'error'> = computed(() => {
    return this.routeData()?.['mode'] ?? 'search';
  });

  constructor() {
    // ✨ STEP 3: Create an effect that reacts to changes in the mode. ✨
    // This replaces the logic that was previously in ngOnInit.
    effect(() => {
      const currentMode = this.mode();
      console.log(`[SearchLogsComponent] Mode changed to: ${currentMode}. Triggering initial search.`);
      this.triggerInitialSearchForMode(currentMode);
    }, { allowSignalWrites: true }); // allowSignalWrites might be needed if performSearch updates signals immediately.
  }

  triggerInitialSearchForMode(mode: 'browse' | 'error' | 'search'): void {
    if (mode === 'search') {
      // In search mode, we wait for user input. We might want to clear old results.
      // this.searchOrchestrator.clearAllSearches();
      return;
    }

    const appName = this.filtersService.filters()?.application[0] ?? 'default-app';
    const request = {
      type: mode, // 'browse' or 'error'
      title: mode === 'browse' ? 'Live Logs (Browse)' : 'Live Logs (Errors)',
      appName: appName,
      preFilter: mode === 'error' ? 'log.level:error' : undefined
    };

    // Every time the mode changes, this will initiate the correct streaming search.
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