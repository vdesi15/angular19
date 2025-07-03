// search-logs.component.ts
import { Component, inject, effect, computed, Signal, viewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { SearchOrchestratorService } from './services/search-orchestrator.service';
import { SearchStrategyManager } from './services/search-strategy.manager'; // NEW
import { FiltersService } from 'src/app/core/services/filters.service';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { SearchResultComponent } from './components/search-result/search-result.component';
import { TransactionDetailsComponent } from './components/transaction-details/transaction-details.component';
import { ActiveSearch } from './models/search.model';

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
export class SearchLogsComponent implements OnInit {
  public searchOrchestrator = inject(SearchOrchestratorService);
  private strategyManager = inject(SearchStrategyManager); // NEW
  private route = inject(ActivatedRoute);
  private router = inject(Router); // NEW
  private filtersService = inject(FiltersService);

  // NEW: ViewChild for search bar to control it programmatically
  private searchBar = viewChild<SearchBarComponent>('app-search-bar');

  private routeData = toSignal(this.route.data);
  
  // NEW: Convert queryParams to signal for reactive URL handling
  private queryParams = toSignal(this.route.queryParams);

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
    // Existing effect for mode changes
    effect(() => {
      const currentMode = this.mode();
      console.log(`[SearchLogsComponent] Mode changed to: ${currentMode}. Triggering initial search.`);
      this.triggerInitialSearchForMode(currentMode);
    }, { allowSignalWrites: true });

    // NEW: Effect for URL parameter handling
    effect(() => {
      const params = this.queryParams();
      if (params) {
        console.log('[SearchLogsComponent] Query params changed:', params);
        this.handleUrlParameters(params);
      }
    }, { allowSignalWrites: true });
  }

  // NEW: OnInit for initial URL handling
  ngOnInit() {
    // Handle initial URL parameters if they exist
    const initialParams = this.route.snapshot.queryParams;
    if (Object.keys(initialParams).length > 0) {
      console.log('[SearchLogsComponent] Initial URL params:', initialParams);
      this.handleUrlParameters(initialParams);
    }
  }

  // NEW: URL parameter handling using strategy manager
  private handleUrlParameters(params: Record<string, any>): void {
    // Skip if no relevant search parameters
    const hasSearchParams = params['searchText'] || params['jiraId'];
    if (!hasSearchParams) {
      return;
    }

    console.log('[SearchLogsComponent] Processing URL parameters with strategy manager');
    
    // Let strategy manager handle URL parameters
    const urlResult = this.strategyManager.handleUrlParameters(params);
    
    if (urlResult && urlResult.shouldTriggerSearch) {
      console.log('[SearchLogsComponent] URL result from strategy:', urlResult);
      
      // Populate search bar with decoded query
      const searchBarComponent = this.searchBar();
      if (searchBarComponent) {
        searchBarComponent.setSearchTerm(urlResult.searchQuery);
        
        // Auto-trigger search with strategy-specific metadata
        setTimeout(() => {
          console.log('[SearchLogsComponent] Auto-triggering search for:', urlResult.searchQuery);
          this.handleSearchWithMetadata(urlResult.searchQuery, urlResult.metadata);
        }, 100);
      }
    } else {
      console.log('[SearchLogsComponent] No strategy could handle URL parameters');
    }
  }

  // NEW: Enhanced search handler with metadata support
  private handleSearchWithMetadata(query: string, metadata?: any): void {
    const appName = this.filtersService.filters()?.application[0] ?? 'default-app';
    
    // Use metadata from URL strategy if available
    const searchType = metadata?.searchType || 'transaction';
    const title = metadata?.searchType === 'jira' 
      ? `JIRA: ${query}` 
      : `Search Results for: ${query}`;
    
    this.searchOrchestrator.performSearch({
      type: searchType,
      query: query,
      title: title,
      appName: appName,
      metadata: metadata // Pass through strategy metadata
    });
  }

  // EXISTING: Keep your original triggerInitialSearchForMode method
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

  // ENHANCED: Update your existing handleSearch method to use strategy manager for URL updates
  handleSearch(query: string): void {
    const appName = this.filtersService.filters()?.application[0] ?? 'default-app';
    
    // Perform the search
    this.searchOrchestrator.performSearch({
      type: 'transaction', // Will be auto-detected by strategy manager
      query: query,
      title: `Search Results for: ${query}`,
      appName: appName
    });

    // NEW: Update URL using strategy manager
    this.updateUrlWithStrategy(query);
  }

  // NEW: Update URL using appropriate strategy
  private updateUrlWithStrategy(query: string): void {
    const currentParams = { ...this.route.snapshot.queryParams };
    const updatedParams = this.strategyManager.updateUrlForSearch(query, currentParams);
    
    console.log('[SearchLogsComponent] Updating URL params:', updatedParams);
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: updatedParams,
      queryParamsHandling: 'merge'
    });
  }

  // NEW: Method to clear searches and clean up URL
  public clearAllSearches(): void {
    this.searchOrchestrator.clearAllSearches();
    
    // Clear search bar
    const searchBarComponent = this.searchBar();
    if (searchBarComponent) {
      searchBarComponent.clearSearch();
    }
    
    // Clean up URL using strategy manager
    const currentParams = { ...this.route.snapshot.queryParams };
    const cleanedParams = this.strategyManager.cleanupUrlParams('', currentParams);
    
    console.log('[SearchLogsComponent] Cleaning URL params:', cleanedParams);
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cleanedParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}