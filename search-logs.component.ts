// src/app/features/search-logs/search-logs.component.ts
import { 
  Component, 
  inject, 
  effect, 
  computed, 
  Signal, 
  OnInit,
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map, distinctUntilChanged } from 'rxjs';

import { SearchOrchestratorService } from './services/search-orchestrator.service';
import { SearchFilterService } from '../../core/services/filters.service';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { SearchResultComponent } from './components/search-result/search-result.component';
import { TransactionDetailsComponent } from './components/transaction-details/transaction-details.component';

/**
 * Enhanced Search Logs Component using Angular 19 features.
 * 
 * Key improvements:
 * - Better lifecycle management with DestroyRef
 * - Reactive URL parameter handling
 * - Improved state synchronization
 * - Better error handling and loading states
 * - Optimized change detection
 */
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
  private readonly searchOrchestrator = inject(SearchOrchestratorService);
  private readonly route = inject(ActivatedRoute);
  private readonly filtersService = inject(SearchFilterService);
  private readonly destroyRef = inject(DestroyRef);

  // ================================
  // REACTIVE STATE SIGNALS
  // ================================

  // Route data signals
  private readonly routeData = toSignal(this.route.data);
  private readonly queryParams = toSignal(this.route.queryParams);

  // Computed signals for route properties
  public readonly mode: Signal<'search' | 'browse' | 'error'> = computed(() => {
    return this.routeData()?.['mode'] ?? 'search';
  });

  public readonly allowedFilters: Signal<string[]> = computed(() => {
    return this.routeData()?.['allowedFilters'] ?? [];
  });

  // UI state computed signals
  public readonly showSearchBar = computed(() => this.mode() === 'search');
  
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

  // Service state signals
  public readonly filters = this.filtersService.filters;
  public readonly hasFilters = this.filtersService.hasFilters;
  public readonly filterSummary = this.filtersService.filterSummary;

  // Search orchestrator state
  public readonly activeSearches = this.searchOrchestrator.activeSearches;
  public readonly isLoading = computed(() => 
    this.activeSearches().some(search => search.isLoading)
  );

  // ================================
  // LIFECYCLE METHODS
  // ================================

  constructor() {
    // Effect to handle mode changes and trigger appropriate searches
    effect(() => {
      const currentMode = this.mode();
      const currentFilters = this.filters();
      
      console.log(`[SearchLogsComponent] Mode: ${currentMode}, Filters ready: ${!!currentFilters}`);
      
      if (currentFilters) {
        this.handleModeChange(currentMode);
      }
    }, { allowSignalWrites: true });

    // Effect to handle URL parameter changes
    effect(() => {
      const params = this.queryParams();
      if (params && Object.keys(params).length > 0) {
        console.log('[SearchLogsComponent] URL parameters changed:', params);
        this.handleUrlParameterChange(params);
      }
    }, { allowSignalWrites: true });

    // Watch for filter validation errors
    effect(() => {
      const errors = this.filtersService.getValidationErrors();
      if (errors.length > 0) {
        console.warn('[SearchLogsComponent] Filter validation errors:', errors);
      }
    });
  }

  ngOnInit(): void {
    console.log('[SearchLogsComponent] Component initialized');
    
    // Set up any additional subscriptions that need explicit cleanup
    this.setupRouteSubscriptions();
  }

  // ================================
  // EVENT HANDLERS
  // ================================

  public handleSearch(query: string): void {
    if (!query?.trim()) {
      console.warn('[SearchLogsComponent] Empty search query provided');
      return;
    }

    const filters = this.filters();
    if (!filters) {
      console.error('[SearchLogsComponent] No filters available for search');
      return;
    }

    const appName = filters.application?.[0] ?? 'default-app';
    
    console.log('[SearchLogsComponent] Executing search:', { query, appName });

    // Use intelligent search detection
    this.searchOrchestrator.performSearch({
      type: 'transaction', // Will be overridden by intelligent detection
      query: query.trim(),
      title: `Search: ${query}`,
      appName: appName
    });
  }

  public handleClearSearch(): void {
    console.log('[SearchLogsComponent] Clearing all searches');
    this.searchOrchestrator.clearAllSearches();
  }

  public handleRefresh(): void {
    console.log('[SearchLogsComponent] Refreshing current view');
    const currentMode = this.mode();
    this.triggerSearchForMode(currentMode, true);
  }

  // ================================
  // DEVELOPMENT/DEBUG METHODS
  // ================================

  public testQueryDetection(query: string): void {
    if (!query?.trim()) return;
    
    const result = this.searchOrchestrator.testQueryDetection(query);
    console.log('[SearchLogsComponent] Query detection test:', {
      query,
      result,
      isValid: result?.confidence > 0.7
    });
  }

  public getAvailableStrategies(): string[] {
    return this.searchOrchestrator.getAvailableStrategies();
  }

  public getDebugInfo(): any {
    return {
      mode: this.mode(),
      hasFilters: this.hasFilters(),
      filterSummary: this.filterSummary(),
      activeSearchCount: this.activeSearches().length,
      isLoading: this.isLoading(),
      allowedFilters: this.allowedFilters()
    };
  }

  // ================================
  // PRIVATE IMPLEMENTATION
  // ================================

  private handleModeChange(mode: 'search' | 'browse' | 'error'): void {
    console.log(`[SearchLogsComponent] Handling mode change to: ${mode}`);
    
    // Clear existing searches when mode changes
    this.searchOrchestrator.clearAllSearches();
    
    // Trigger appropriate search for the new mode
    this.triggerSearchForMode(mode);
  }

  private handleUrlParameterChange(params: Record<string, any>): void {
    // URL parameter handling is now managed by the resolver and guards
    // This method can be used for any additional URL-specific logic
    console.log('[SearchLogsComponent] URL parameters processed by guards/resolver');
  }

  private triggerSearchForMode(mode: 'search' | 'browse' | 'error', force: boolean = false): void {
    if (mode === 'search' && !force) {
      // In search mode, wait for user input unless forced
      console.log('[SearchLogsComponent] Search mode - waiting for user input');
      return;
    }

    const filters = this.filters();
    if (!filters) {
      console.warn('[SearchLogsComponent] Cannot trigger search without filters');
      return;
    }

    const appName = filters.application?.[0] ?? 'default-app';
    
    const searchRequest = {
      type: mode as 'browse' | 'error',
      title: this.getSearchTitle(mode),
      appName: appName,
      preFilter: mode === 'error' ? 'log.level:error' : undefined
    };

    console.log('[SearchLogsComponent] Triggering search for mode:', { mode, request: searchRequest });
    this.searchOrchestrator.performSearch(searchRequest);
  }

  private getSearchTitle(mode: string): string {
    switch (mode) {
      case 'browse': return 'Live Logs (Browse)';
      case 'error': return 'Live Logs (Errors)';
      case 'search': return 'Search Results';
      default: return `Live Logs (${mode})`;
    }
  }

  private setupRouteSubscriptions(): void {
    // Watch for navigation events that might affect our component state
    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef),
      distinctUntilChanged(),
      filter(params => Object.keys(params).length > 0)
    ).subscribe(params => {
      console.log('[SearchLogsComponent] Route params changed:', params);
      // Handle any route parameter specific logic here
    });

    // Watch for fragment changes (useful for deep linking to specific searches)
    this.route.fragment.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(fragment => !!fragment)
    ).subscribe(fragment => {
      console.log('[SearchLogsComponent] Route fragment changed:', fragment);
      this.handleFragmentNavigation(fragment);
    });
  }

  private handleFragmentNavigation(fragment: string): void {
    // Handle deep linking to specific search results or states
    if (fragment.startsWith('search-')) {
      const searchId = fragment.replace('search-', '');
      const search = this.searchOrchestrator.getSearchById(searchId);
      
      if (search) {
        console.log('[SearchLogsComponent] Navigating to search via fragment:', searchId);
        // Additional logic for highlighting or focusing specific search results
      }
    }
  }
}