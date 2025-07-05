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
  private strategyManager = inject(SearchStrategyManager);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private filtersService = inject(FiltersService);

  private searchBar = viewChild<SearchBarComponent>('searchBarRef');

  private routeData = toSignal(this.route.data);
  private queryParams = toSignal(this.route.queryParams);

  // Flags to prevent duplicate processing
  private isViewInitialized = false;
  private hasProcessedInitialParams = false;

  public mode: Signal<'search' | 'browse' | 'error'> = computed(() => {
    return this.routeData()?.['mode'] ?? 'search';
  });

  public orderedSearches: Signal<ActiveSearch[]> = computed(() => {
    const searches = this.searchOrchestrator.activeSearches();
    
    const sseSearches = searches.filter(s => s.type === 'browse' || s.type === 'error');
    const transactionSearches = searches.filter(s => s.type === 'transaction');
    
    return [...sseSearches, ...transactionSearches];
  });

  constructor() {
    // Effect for mode changes
    effect(() => {
      const currentMode = this.mode();
      console.log(`[SearchLogsComponent] Mode changed to: ${currentMode}`);
      this.triggerInitialSearchForMode(currentMode);
    }, { allowSignalWrites: true });

    // FIXED: Effect for URL parameter changes (not initial load)
    effect(() => {
      const params = this.queryParams();
      
      // Only process if:
      // 1. View is initialized
      // 2. We've already processed initial params (so this is a change)
      // 3. Params actually exist
      if (params && this.isViewInitialized && this.hasProcessedInitialParams) {
        console.log('[SearchLogsComponent] Processing URL parameter CHANGES:', params);
        this.handleUrlParameters(params);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    console.log('[SearchLogsComponent] Component initialized');
  }

  // FIXED: Only handle initial URL parameters here
  ngAfterViewInit() {
    console.log('[SearchLogsComponent] View initialized');
    this.isViewInitialized = true;
    
    // Process INITIAL URL parameters if they exist
    const initialParams = this.route.snapshot.queryParams;
    if (Object.keys(initialParams).length > 0) {
      console.log('[SearchLogsComponent] Processing INITIAL URL params:', initialParams);
      this.hasProcessedInitialParams = true;
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        this.handleUrlParameters(initialParams);
      }, 100);
    } else {
      // No initial params, but mark as processed so effect can handle future changes
      this.hasProcessedInitialParams = true;
    }
  }

  private handleUrlParameters(params: Record<string, any>): void {
    const hasSearchParams = params['searchText'] || params['jiraId'];
    if (!hasSearchParams) {
      return;
    }

    console.log('[SearchLogsComponent] Processing URL parameters with strategy manager');
    
    const urlResult = this.strategyManager.handleUrlParameters(params);
    
    if (urlResult && urlResult.shouldTriggerSearch) {
      console.log('[SearchLogsComponent] URL result from strategy:', urlResult);
      
      const searchBarComponent = this.searchBar();
      if (searchBarComponent) {
        console.log('[SearchLogsComponent] Setting search term:', urlResult.searchQuery);
        searchBarComponent.setSearchTerm(urlResult.searchQuery);
        
        // Auto-trigger search with strategy-specific metadata
        setTimeout(() => {
          console.log('[SearchLogsComponent] Auto-triggering search for:', urlResult.searchQuery);
          this.handleSearchWithMetadata(urlResult.searchQuery, urlResult.metadata);
        }, 150);
      } else {
        console.warn('[SearchLogsComponent] Search bar component not available, retrying...');
        // Retry with longer delay
        setTimeout(() => {
          const retryComponent = this.searchBar();
          if (retryComponent) {
            retryComponent.setSearchTerm(urlResult.searchQuery);
            setTimeout(() => {
              this.handleSearchWithMetadata(urlResult.searchQuery, urlResult.metadata);
            }, 100);
          } else {
            console.error('[SearchLogsComponent] Search bar component not available after retry');
          }
        }, 500);
      }
    } else {
      console.log('[SearchLogsComponent] No strategy could handle URL parameters');
    }
  }

  private handleSearchWithMetadata(query: string, metadata?: any): void {
    const appName = this.filtersService.filters()?.application[0] ?? 'default-app';
    
    const searchType = metadata?.searchType || 'transaction';
    const title = metadata?.searchType === 'jira' 
      ? `JIRA: ${query}` 
      : `Search Results for: ${query}`;
    
    this.searchOrchestrator.performSearch({
      type: searchType,
      query: query,
      title: title,
      appName: appName,
      metadata: metadata
    });
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
    if (!query?.trim()) {
      console.warn('[SearchLogsComponent] Empty query provided');
      return;
    }

    const trimmedQuery = query.trim();
    const appName = this.filtersService.filters()?.application[0] ?? 'default-app';
    
    console.log('[SearchLogsComponent] Handling search with strategy detection:', trimmedQuery);

    // Create a basic request and let strategy manager enhance it
    const basicRequest = {
      type: 'transaction', // This will be overridden by enhanceRequest
      query: trimmedQuery,
      title: `Search Results for: ${trimmedQuery}`,
      appName: appName
    };

    // Use the existing enhanceRequest method to detect type and enhance
    const enhancedRequest = this.strategyManager.enhanceRequest(basicRequest);
    
    console.log(`[SearchLogsComponent] Enhanced request:`, enhancedRequest);

    // Perform search with enhanced request
    this.searchOrchestrator.performSearch(enhancedRequest);

    this.updateUrlWithStrategy(trimmedQuery);
  }

  private updateUrlWithStrategy(query: string): void {
    const currentParams = { ...this.route.snapshot.queryParams };
    const updatedParams = this.strategyManager.updateUrlForSearch(query, currentParams);
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: updatedParams,
      queryParamsHandling: 'merge'
    });
  }

  public clearAllSearches(): void {
    this.searchOrchestrator.clearAllSearches();
    
    const searchBarComponent = this.searchBar();
    if (searchBarComponent) {
      searchBarComponent.clearSearch();
    }
    
    const currentParams = { ...this.route.snapshot.queryParams };
    const cleanedParams = this.strategyManager.cleanupUrlParams('', currentParams);
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cleanedParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}