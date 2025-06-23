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

  // ✨ Create a signal directly from the route's data observable
  private routeData = toSignal(this.route.data);

  // ✨ Create a computed signal for the mode
  public mode: Signal<'search' | 'browse' | 'error'> = computed(() => {
    return this.routeData()?.['mode'] ?? 'search';
  });

  // ✨ Computed signal to determine if search bar should be shown
  public showSearchBar = computed(() => {
    return this.mode() === 'search';
  });

  // ✨ Computed signal for page title
  public pageTitle = computed(() => {
    switch (this.mode()) {
      case 'browse': return 'Live Log Browser';
      case 'error': return 'Error Log Monitor';
      case 'search': return 'Smart Search';
      default: return 'Search Logs';
    }
  });

  // ✨ Computed signal for page description
  public pageDescription = computed(() => {
    switch (this.mode()) {
      case 'browse': return 'Real-time streaming of live application logs';
      case 'error': return 'Real-time monitoring of error logs and exceptions';
      case 'search': return 'Search transactions, JIRA tickets, batches, or ask in natural language';
      default: return 'Search and analyze your application logs';
    }
  });

  constructor() {
    // ✨ Create an effect that reacts to changes in the mode
    effect(() => {
      const currentMode = this.mode();
      console.log(`[SearchLogsComponent] Mode changed to: ${currentMode}. Triggering initial search.`);
      this.triggerInitialSearchForMode(currentMode);
    }, { allowSignalWrites: true });
  }

  triggerInitialSearchForMode(mode: 'browse' | 'error' | 'search'): void {
    if (mode === 'search') {
      // In search mode, we wait for user input. Clear old results.
      this.searchOrchestrator.clearAllSearches();
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
    
    // ✨ Enhanced search using the new intelligent detection
    this.searchOrchestrator.performSearch({
      type: 'transaction', // This will be overridden by intelligent detection
      query: query,
      title: `Search: ${query}`,
      appName: appName
    });
  }

  /**
   * Helper method for testing query detection (development only)
   */
  public testQueryDetection(query: string): void {
    if (!query) return;
    
    const result = this.searchOrchestrator.testQueryDetection(query);
    console.log('[SearchLogsComponent] Query detection test:', {
      query,
      result,
      isValid: this.searchOrchestrator.queryDetectionService?.isValidDetection(result)
    });
  }

  /**
   * Get available search strategies (for debugging)
   */
  public getAvailableStrategies(): string[] {
    return this.searchOrchestrator.getAvailableStrategies();
  }

  /**
   * Get current search count
   */
  public getActiveSearchCount(): number {
    return this.searchOrchestrator.activeSearches().length;
  }

  /**
   * Get streaming search count
   */
  public getStreamingSearchCount(): number {
    return this.searchOrchestrator.activeStreamingSearches().length;
  }
}