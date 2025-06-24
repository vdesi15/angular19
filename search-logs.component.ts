import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { SearchFilterService } from './services/search-filters.service';
import { SearchOrchestratorService } from './services/search-orchestrator.service';

@Component({
  selector: 'app-search-logs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="search-logs-container">
      <div class="search-content">
        <h1>{{ pageTitle() }}</h1>
        <p>{{ pageDescription() }}</p>
        
        @if (showSearchBar()) {
          <app-search-bar (search)="onSearch($event)"></app-search-bar>
        }
        
        <app-search-result></app-search-result>
      </div>
    </div>
  `
})
export class SearchLogsComponent {
  private route = inject(ActivatedRoute);
  private filtersService = inject(SearchFilterService);
  private searchOrchestrator = inject(SearchOrchestratorService);

  private routeData = toSignal(this.route.data);

  public readonly mode = computed(() => {
    return this.routeData()?.['mode'] ?? 'search';
  });

  public readonly showSearchBar = computed(() => {
    return this.mode() === 'search';
  });

  public readonly pageTitle = computed(() => {
    switch (this.mode()) {
      case 'browse': return 'Live Log Browser';
      case 'error': return 'Error Log Monitor';
      case 'search': return 'Smart Search';
      default: return 'Search Logs';
    }
  });

  public readonly pageDescription = computed(() => {
    switch (this.mode()) {
      case 'browse': return 'Real-time streaming of live application logs';
      case 'error': return 'Real-time monitoring of error logs and exceptions';
      case 'search': return 'Search transactions, JIRA tickets, batches, or ask in natural language';
      default: return 'Search and analyze your application logs';
    }
  });

  constructor() {
    // Effect runs after resolver completes and filters are available
    effect(() => {
      const filters = this.filtersService.filters();
      const currentMode = this.mode();

      if (filters) {
        console.log(`[SearchLogsComponent] Filters ready for mode: ${currentMode}`, filters);
        this.triggerInitialSearchForMode(currentMode);
      }
    }, { allowSignalWrites: true });
  }

  private triggerInitialSearchForMode(mode: string): void {
    switch (mode) {
      case 'browse':
        this.searchOrchestrator.startBrowseMode();
        break;
      case 'error':
        this.searchOrchestrator.startErrorMode();
        break;
      case 'search':
        const filters = this.filtersService.filters();
        if (filters?.streamFilters) {
          // Auto-search if URL contains search parameters
          this.searchOrchestrator.performSearch('', 'browse');
        }
        break;
    }
  }

  public onSearch(query: string): void {
    this.searchOrchestrator.performIntelligentSearch(query);
  }
}